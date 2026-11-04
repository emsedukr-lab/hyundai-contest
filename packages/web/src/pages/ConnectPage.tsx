import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { SelectableCard } from '@astryxdesign/core/SelectableCard';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Switch } from '@astryxdesign/core/Switch';
import { Heading, Text } from '@astryxdesign/core/Text';
import { isTerminal, parseQrFragment, sampleTrip, type SessionView } from '@tteonaljido/shared';
import { pairings, trips, type PairingRecord } from '../lib/db';
import { codeLabel, periodLabel } from '../lib/format';
import { ApiError, cancel, claim, confirmCode, finish, openPairing, send, status, supportsWebCrypto } from '../lib/pairing';
import { navigate } from '../lib/router';
import { newDoc, nightsLabel, nowIso, planWarnings, unassignedVisits, type TripDoc } from '../lib/trips';

type Stage = 'loading' | 'invalid' | 'unsupported' | 'intro' | 'code' | 'pick' | 'consent' | 'approve' | 'status';

const STEPS = ['연결', '코드 확인', '여행 선택', '보낼 정보', '보내기'];
const STEP_OF: Partial<Record<Stage, number>> = { intro: 0, code: 1, pick: 2, consent: 3, approve: 4, status: 4 };
const LAST_SID = 'tteonaljido.lastSid';

const ERROR_TEXT: Record<string, string> = {
  ALREADY_CLAIMED: '이미 사용된 QR이에요. 차량에서 새 QR을 받아 다시 스캔해 주세요.',
  EXPIRED: '시간이 지난 QR이에요. 차량에서 새 QR을 받아 다시 스캔해 주세요.',
  NOT_FOUND: '연결 정보를 찾을 수 없어요. 차량에서 새 QR을 받아 주세요.',
  FINGERPRINT: 'QR과 연결 대상이 일치하지 않아요. 보내지 말고 차량에서 새 QR을 받아 주세요.',
  UNAUTHORIZED: '연결 확인에 실패했어요. 차량에서 새 QR을 받아 주세요.',
  NETWORK: '인터넷 연결을 확인한 뒤 다시 시도해 주세요. 보낸 내용은 그대로 다시 보내져요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  PAYLOAD_CONFLICT: '이 연결로는 이미 다른 여행을 보냈어요. 차량에서 새 QR을 받아 주세요.',
  UNSUPPORTED_SCHEMA: '차량 앱 업데이트가 필요해요. 이 휴대폰의 여행 형식을 차량 앱이 아직 지원하지 않아요.',
  UNSUPPORTED_VERSION: '차량 앱 업데이트가 필요해요.',
  APPLYING: '차량에서 이미 저장하는 중이라 취소할 수 없어요. 차량 화면을 확인해 주세요.',
  INVALID_STATE: '지금 단계에서는 할 수 없는 작업이에요. 상태를 새로 확인해 주세요.',
};

const RESULT_TEXT: Record<string, string> = {
  IMPORTED_NEW: '차량에 새 여행으로 불러왔어요',
  UPDATED: '차량의 같은 여행을 최신 버전으로 바꿨어요',
  SAVED_AS_COPY: '차량에 별도 여행(사본)으로 저장했어요',
  ALREADY_IMPORTED: '차량에 이미 같은 버전이 있어요. 바뀐 것은 없어요',
  USER_DECLINED: '차량에서 불러오기를 취소했어요',
  INVALID_PAYLOAD: '차량이 여행 내용을 확인하지 못해 불러오지 않았어요',
  UNSUPPORTED_VERSION: '차량 앱 업데이트가 필요해서 불러오지 않았어요',
  DECRYPT_FAILED: '차량에서 내용을 열지 못했어요. 새 QR로 다시 시도해 주세요',
  STORAGE_ERROR: '차량 저장에 실패했어요. 차량 화면을 확인해 주세요',
};

/** What the phone may honestly claim at each server state: sending is not the same as being applied. */
function statusText(v: SessionView): { title: string; detail: string; tone: 'info' | 'success' | 'warning' | 'error'; done: boolean } {
  switch (v.state) {
    case 'CLAIMED':
      return { title: '아직 보내지 않았어요', detail: '여행을 고르고 보내기를 눌러 주세요.', tone: 'info', done: false };
    case 'MOBILE_APPROVED':
      return v.carFetched
        ? { title: '차량이 받았어요 · 아직 적용 전', detail: '차량 화면에서 내용을 확인하고 불러오기를 승인해 주세요.', tone: 'info', done: false }
        : { title: '차량으로 보냈어요 · 아직 적용 전', detail: '차량이 받을 때까지 기다리는 중이에요.', tone: 'info', done: false };
    case 'CAR_APPLYING':
      return { title: '차량에서 저장하는 중이에요', detail: '잠시만 기다려 주세요.', tone: 'info', done: false };
    case 'APPLIED':
      return { title: RESULT_TEXT[v.resultCode ?? ''] ?? '차량에 적용됐어요', detail: '차량에서 여행 목록을 확인할 수 있어요.', tone: 'success', done: true };
    case 'REJECTED':
      return { title: RESULT_TEXT[v.resultCode ?? ''] ?? '차량에서 불러오지 않았어요', detail: '필요하면 차량에서 새 QR을 받아 다시 보내 주세요.', tone: 'warning', done: true };
    case 'EXPIRED':
      return v.expireReason === 'UNCONFIRMED'
        ? { title: '차량 적용 여부를 확인하지 못했어요', detail: '차량 화면의 여행 목록에서 직접 확인해 주세요.', tone: 'warning', done: true }
        : { title: '연결 시간이 지났어요', detail: '차량에서 새 QR을 받아 다시 시작해 주세요.', tone: 'warning', done: true };
    case 'CANCELLED':
      return {
        title: v.cancelReason === 'MOBILE' ? '연결을 취소했어요' : v.cancelReason === 'SECURITY' ? '보안을 위해 연결이 중단됐어요' : '차량에서 연결을 취소했어요',
        detail: '보낸 내용은 서버에서 지워졌어요.',
        tone: 'warning',
        done: true,
      };
    default:
      return { title: '연결 대기 중', detail: '', tone: 'info', done: false };
  }
}

export function ConnectPage() {
  const [stage, setStage] = useState<Stage>('loading');
  const [rec, setRec] = useState<PairingRecord | null>(null);
  const [docs, setDocs] = useState<TripDoc[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [includeHome, setIncludeHome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const scanSecret = useRef<string | null>(null);

  const doc = useMemo(() => docs.find((d) => d.tripId === picked) ?? null, [docs, picked]);
  const fail = (e: unknown) => setErr(ERROR_TEXT[e instanceof ApiError ? e.code : 'NETWORK'] ?? '문제가 생겼어요. 다시 시도해 주세요.');

  // Read the QR fragment once, then remove it from the address bar and history.
  useEffect(() => {
    void (async () => {
      await pairings.prune();
      setDocs(await trips.all());
      if (!supportsWebCrypto()) return setStage('unsupported');
      const link = parseQrFragment(location.hash);
      if (location.hash) history.replaceState(null, '', '/c');
      let r: PairingRecord | undefined;
      if (link) {
        scanSecret.current = link.scanSecret;
        r = await openPairing(link);
      } else {
        const sid = sessionStorage.getItem(LAST_SID);
        r = sid ? await pairings.get(sid) : undefined;
      }
      if (!r) return setStage('invalid');
      sessionStorage.setItem(LAST_SID, r.sid);
      setRec(r);
      setPicked(r.tripId);
      setIncludeHome(r.includeHome);
      if (r.sealed) setStage('status');
      else if (r.codeConfirmed) setStage('pick');
      else if (r.mobileToken) setStage('code');
      else if (link) setStage('intro');
      else setStage('invalid'); // reloaded before connecting: the secret is gone, so scan again
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!rec?.mobileToken) return;
    try {
      const v = await status(rec);
      setView(v);
      setErr(null);
      if (isTerminal(v.state)) await finish(rec, `${v.state}:${v.resultCode ?? v.expireReason ?? v.cancelReason ?? ''}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') {
        setView((prev) => prev ?? null);
        setErr('연결 기록이 이미 정리됐어요. 차량 화면에서 결과를 확인해 주세요.');
        await pairings.remove(rec.sid);
      } else fail(e);
    }
  }, [rec]);

  // Poll only while the page is visible and the session can still change.
  useEffect(() => {
    if (!rec?.mobileToken || stage === 'intro' || stage === 'loading') return;
    if (view && isTerminal(view.state)) return;
    void refresh();
    const t = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), 2000);
    return () => window.clearInterval(t);
  }, [rec, stage, view?.state, refresh]);

  const doClaim = async () => {
    if (!rec || !scanSecret.current) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await claim(rec, scanSecret.current);
      scanSecret.current = null;
      setRec(r);
      setStage('code');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!rec || !doc) return;
    setBusy(true);
    setErr(null);
    try {
      setRec(await send(rec, doc, includeHome && !!doc.home));
      setStage('status');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!rec) return;
    setBusy(true);
    try {
      if (rec.mobileToken) setView(await cancel(rec));
      await finish(rec, 'CANCELLED:MOBILE');
      setStage('status');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const addSample = async () => {
    const d = await newDoc({ ...sampleTrip(nowIso()), tripId: crypto.randomUUID() });
    await trips.put(d);
    setDocs(await trips.all());
    setPicked(d.tripId);
  };

  const sessionOver = !!view && isTerminal(view.state);
  const st = view ? statusText(view) : null;

  const content = (() => {
    switch (stage) {
      case 'loading':
        return <Spinner />;
      case 'unsupported':
        return <Banner status="error" title="이 브라우저에서는 연결할 수 없어요" description="휴대폰 기본 카메라로 QR을 다시 스캔해 기본 브라우저(Safari·Chrome)에서 열어 주세요." />;
      case 'invalid':
        return (
          <Banner
            status="warning"
            title="QR을 다시 스캔해 주세요"
            description="연결 정보가 없거나 형식이 맞지 않아요. 주차한 상태에서 차량의 '모바일 여행 불러오기' 화면에 표시된 QR을 휴대폰 카메라로 스캔해 주세요."
          />
        );
      case 'intro':
        return (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>차량 연결 요청</Heading>
              <Text type="supporting" color="secondary">
                차량 화면의 QR로 들어왔어요. 이 연결은 여행 하나를 한 번 보내는 데만 쓰이고, 계정이나 기기 연결이 남지 않아요.
              </Text>
            </VStack>
            <List hasDividers>
              <ListItem label="1. 연결하고 확인 코드 보기" description="차량 화면의 6자리 코드와 같은지 비교해요" />
              <ListItem label="2. 보낼 여행 고르기" description="이 휴대폰에 저장된 여행 중 하나만 골라요" />
              <ListItem label="3. 휴대폰에서 보내기 승인" description="보낼 정보를 확인하고 승인해요" />
              <ListItem label="4. 차량에서 불러오기 승인" description="차량에서 한 번 더 승인해야 불러와져요" />
            </List>
          </VStack>
        );
      case 'code':
        return (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>확인 코드를 비교해 주세요</Heading>
              <Text type="supporting" color="secondary">
                차량 화면에 보이는 코드와 같아야 해요. 다르면 다른 차량이나 잘못된 연결일 수 있어요.
              </Text>
            </VStack>
            <Card variant="muted" padding={6}>
              <VStack gap={1} align="center">
                <Text type="supporting" color="secondary">
                  확인 코드
                </Text>
                <Text type="display-2" hasTabularNumbers>
                  {rec?.confirmCode ? codeLabel(rec.confirmCode) : '------'}
                </Text>
              </VStack>
            </Card>
          </VStack>
        );
      case 'pick':
        return (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>차량으로 보낼 여행</Heading>
              <Text type="supporting" color="secondary">
                하나만 골라요. 고른 여행만 보내지고, 다른 여행은 이 휴대폰에 그대로 남아요.
              </Text>
            </VStack>
            {docs.length === 0 && <Banner status="info" title="저장된 여행이 없어요" description="샘플 여행을 추가하거나 새 여행을 만든 뒤 이 화면으로 돌아오세요." />}
            <VStack gap={2}>
              {docs.map((d) => {
                const warnings = planWarnings(d.plan, d.home).filter((w) => w.level === 'warning').length;
                return (
                  <SelectableCard key={d.tripId} label={d.plan.name} isSelected={picked === d.tripId} onChange={(on) => setPicked(on ? d.tripId : null)}>
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center">
                        <StackItem size="fill">
                          <Text type="label">{d.plan.name}</Text>
                        </StackItem>
                        <Badge variant="neutral" label={`v${d.revision}`} />
                      </HStack>
                      <Text type="supporting" color="secondary">
                        {periodLabel(d.plan.startDate, d.plan.endDate)} · {nightsLabel(d.plan)} · 장소 {d.plan.places.length}곳
                      </Text>
                      {warnings > 0 && <Badge variant="warning" label={`확인할 점 ${warnings}`} />}
                    </VStack>
                  </SelectableCard>
                );
              })}
            </VStack>
            <HStack gap={2}>
              <Button label="샘플 여행 추가" variant="secondary" size="sm" onClick={addSample} />
              <Button label="새 여행 만들기" variant="ghost" size="sm" onClick={() => navigate('/trips/new')} />
            </HStack>
          </VStack>
        );
      case 'consent':
        return doc ? (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>보낼 정보 확인</Heading>
              <Text type="supporting" color="secondary">
                여행을 실행하는 데 필요한 정보만 보내요. 휴대폰에서 암호화되어 서버는 내용을 볼 수 없어요.
              </Text>
            </VStack>
            <Switch
              label="집 주소 포함"
              value={includeHome && !!doc.home}
              isDisabled={!doc.home}
              onChange={setIncludeHome}
              description={doc.home ? `${doc.home.address} · 끄면 차량 내비게이션의 '집'을 사용해요` : "저장된 집 주소가 없어요. 차량 내비게이션의 '집'을 사용해요"}
            />
            <List hasDividers header={<Text type="label">보내는 정보</Text>}>
              <ListItem label="여행 이름·기간·시간대" description={`${doc.plan.name} · ${periodLabel(doc.plan.startDate, doc.plan.endDate)}`} />
              <ListItem label={`장소 ${doc.plan.places.length}곳`} description="이름·주소·좌표, 배정 안 된 장소 포함" />
              <ListItem label="일차별 순서와 시간" description="방문 순서, 희망·고정 시각, 체류 시간, 변경 허용 여부, 입력한 이동시간" />
              <ListItem label="숙소와 출발·귀가 설정" description="박별 숙소, 첫날 출발 기준, 출발지와 마지막 귀가지" />
              <ListItem label="집 주소" description={includeHome && doc.home ? '포함' : '포함하지 않음'} />
            </List>
            <List hasDividers header={<Text type="label">보내지 않는 정보</Text>}>
              <ListItem label="계정·결제·예약번호·비밀번호·메모" description="전송 형식에 해당 칸이 없어요" />
              <ListItem label="이 휴대폰의 다른 여행" />
            </List>
          </VStack>
        ) : null;
      case 'approve':
        return doc && rec ? (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>보내기 전에 확인</Heading>
              <Text type="supporting" color="secondary">
                보내면 차량 화면에 요약이 떠요. 차량에서 한 번 더 승인해야 불러와져요.
              </Text>
            </VStack>
            <MetadataList orientation="vertical">
              <MetadataListItem label="여행">{`${doc.plan.name} (v${doc.revision})`}</MetadataListItem>
              <MetadataListItem label="기간">{`${periodLabel(doc.plan.startDate, doc.plan.endDate)} · ${nightsLabel(doc.plan)}`}</MetadataListItem>
              <MetadataListItem label="장소">{`${doc.plan.places.length}곳 · 고정 일정 ${doc.plan.visits.filter((v) => v.fixed).length}개 · 미배정 ${unassignedVisits(doc.plan).length}곳`}</MetadataListItem>
              <MetadataListItem label="집 주소">{includeHome && doc.home ? '포함' : '포함하지 않음'}</MetadataListItem>
              <MetadataListItem label="연결 대상">{`확인 코드 ${rec.confirmCode ? codeLabel(rec.confirmCode) : ''} · 차량 앱 ${rec.carAppVersion ?? ''}`}</MetadataListItem>
            </MetadataList>
          </VStack>
        ) : null;
      case 'status':
        return (
          <VStack gap={4}>
            {st ? (
              <Banner status={st.tone} title={st.title} description={st.detail} />
            ) : (
              <HStack gap={2} vAlign="center">
                <Spinner />
                <Text>상태를 확인하는 중이에요</Text>
              </HStack>
            )}
            {view && (
              <List hasDividers>
                <ListItem label="휴대폰에서 보냄" endContent={<Badge variant={rec?.sealed || view.state !== 'CLAIMED' ? 'success' : 'neutral'} label={rec?.sealed || view.state !== 'CLAIMED' ? '완료' : '대기'} />} />
                <ListItem label="차량이 받음" endContent={<Badge variant={view.carFetched ? 'success' : 'neutral'} label={view.carFetched ? '완료' : '대기'} />} />
                <ListItem
                  label="차량에 적용"
                  endContent={<Badge variant={view.state === 'APPLIED' ? 'success' : sessionOver ? 'warning' : 'neutral'} label={view.state === 'APPLIED' ? '완료' : sessionOver ? '안 됨' : '대기'} />}
                />
              </List>
            )}
          </VStack>
        );
    }
  })();

  const footer = (() => {
    const cancelBtn = !sessionOver && rec?.mobileToken && <Button label="연결 취소" variant="ghost" isDisabled={busy} onClick={doCancel} />;
    switch (stage) {
      case 'intro':
        return <Button label="연결하고 확인 코드 보기" variant="primary" isLoading={busy} onClick={doClaim} />;
      case 'code':
        return (
          <>
            <Button label="달라요 · 취소" variant="secondary" isDisabled={busy} onClick={doCancel} />
            <Button label="같아요" variant="primary" onClick={async () => rec && (setRec(await confirmCode(rec)), setStage('pick'))} />
          </>
        );
      case 'pick':
        return (
          <>
            {cancelBtn}
            <Button label="다음" variant="primary" isDisabled={!doc} onClick={() => setStage('consent')} />
          </>
        );
      case 'consent':
        return (
          <>
            <Button label="이전" variant="secondary" onClick={() => setStage('pick')} />
            <Button label="다음" variant="primary" onClick={() => setStage('approve')} />
          </>
        );
      case 'approve':
        return (
          <>
            <Button label="이전" variant="secondary" isDisabled={busy} onClick={() => setStage('consent')} />
            <Button label="차량으로 보내기" variant="primary" isLoading={busy} onClick={doSend} />
          </>
        );
      case 'status':
        return sessionOver ? (
          <Button label="내 여행으로" variant="primary" onClick={() => navigate('/')} />
        ) : (
          <>
            {cancelBtn}
            {err && rec?.sealed && view?.state === 'CLAIMED' && <Button label="다시 보내기" variant="primary" isLoading={busy} onClick={doSend} />}
            <Button label="상태 새로고침" variant="secondary" onClick={() => void refresh()} />
          </>
        );
      default:
        return <Button label="내 여행으로" variant="secondary" onClick={() => navigate('/')} />;
    }
  })();

  const step = STEP_OF[stage];
  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <Heading level={1}>모바일 여행 보내기</Heading>
            {step !== undefined && (
              <Stepper activeStep={step} label="진행 단계">
                {STEPS.map((s, i) => (
                  <Step key={s} step={i} label={s} status={i === step && stage === 'status' && view?.state === 'APPLIED' ? 'success' : undefined} />
                ))}
              </Stepper>
            )}
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            {err && <Banner status="error" title={err} />}
            {content}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end" wrap="wrap">
            {footer}
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

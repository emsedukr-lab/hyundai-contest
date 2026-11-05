import { useEffect, useMemo, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Endpoint, Home, Trip, Visit } from '@tteonaljido/shared';
import { DaysSection } from '../editor/DaysSection';
import { CATEGORY_LABEL, PlaceSearch } from '../editor/PlaceSearch';
import { VisitDialog } from '../editor/VisitDialog';
import { trips } from '../lib/db';
import { navigate } from '../lib/router';
import { REASON_LABEL, addPlace, emptyPlan, newDoc, nightsLabel, planWarnings, savePlan, setPeriod, unassignedVisits, updateVisit, type TripDoc } from '../lib/trips';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

const endpointValue = (e: Endpoint) => (e.kind === 'HOME' ? 'HOME' : e.placeRef);
const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : { kind: 'PLACE', placeRef: v });

export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = tripId ? await trips.get(tripId) : await newDoc(emptyPlan());
      if (!d) return navigate('/', true);
      setDoc(d);
      setPlan(d.plan);
      setHome(d.home);
    })();
  }, [tripId]);

  const warnings = useMemo(() => (plan ? planWarnings(plan, home) : []), [plan, home]);
  if (!plan || !doc) return <Spinner />;

  const edit = (p: Trip) => {
    setPlan(p);
    setDirty(true);
    setSaved(null);
  };
  const endpointOptions = [{ value: 'HOME', label: '집' }, ...plan.places.map((p) => ({ value: p.placeRef, label: p.name }))];

  const save = async () => {
    const next = await savePlan(doc, plan, home);
    await trips.put(next);
    setDoc(next);
    setPlan(next.plan);
    setDirty(false);
    setSaved(next.revision === doc.revision && tripId ? '바뀐 내용이 없어요' : `저장했어요 · v${next.revision}`);
    if (!tripId) navigate(`/trips/${next.tripId}`, true);
  };

  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label="뒤로" variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>{tripId ? '여행 편집' : '새 여행'}</Heading>
            <Badge variant="neutral" label={`v${doc.revision}${dirty ? ' · 수정 중' : ''}`} />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={6}>
            {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
            {saved && <Banner status="success" title={saved} isDismissable onDismiss={() => setSaved(null)} />}

            <VStack gap={3}>
              <Heading level={2}>기본</Heading>
              <FormLayout>
                <TextInput label="여행 이름" value={plan.name} onChange={(v) => edit({ ...plan, name: v.slice(0, 60) })} isRequired />
                <DateRangeInput
                  label="여행 기간"
                  value={{ start: plan.startDate, end: plan.endDate } as Range}
                  maxRangeSpan={14}
                  hasClear={false}
                  description={`${nightsLabel(plan)} · 시간대 ${plan.timezone}`}
                  onChange={(r) => {
                    if (!r) return;
                    try {
                      edit(setPeriod(plan, r.start, r.end));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </FormLayout>
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>출발과 귀가</Heading>
              <FormLayout>
                <SegmentedControl
                  label="첫날 기준"
                  value={plan.firstDay.basis}
                  onChange={(v) =>
                    edit({
                      ...plan,
                      firstDay: v === 'DEPART_ORIGIN' ? { basis: 'DEPART_ORIGIN', departTime: '09:00' } : { basis: 'ARRIVE_FIRST_STOP', arriveTime: '10:00', prepMinutes: 10 },
                    })
                  }>
                  <SegmentedControlItem value="DEPART_ORIGIN" label="출발 시각" />
                  <SegmentedControlItem value="ARRIVE_FIRST_STOP" label="첫 장소 도착 시각" />
                </SegmentedControl>
                {plan.firstDay.basis === 'DEPART_ORIGIN' ? (
                  <TimeInput
                    label="첫날 출발 시각"
                    increment={30}
                    value={plan.firstDay.departTime as ISOTime}
                    onChange={(v) => v && edit({ ...plan, firstDay: { basis: 'DEPART_ORIGIN', departTime: String(v).slice(0, 5) } })}
                  />
                ) : (
                  <HStack gap={2}>
                    <TimeInput
                      label="첫 장소 도착"
                      increment={30}
                      value={plan.firstDay.arriveTime as ISOTime}
                      onChange={(v) => v && plan.firstDay.basis === 'ARRIVE_FIRST_STOP' && edit({ ...plan, firstDay: { ...plan.firstDay, arriveTime: String(v).slice(0, 5) } })}
                    />
                    <NumberInput
                      label="출발 준비(분)"
                      value={plan.firstDay.prepMinutes}
                      isIntegerOnly
                      onChange={(v) =>
                        plan.firstDay.basis === 'ARRIVE_FIRST_STOP' && edit({ ...plan, firstDay: { ...plan.firstDay, prepMinutes: Math.max(0, Math.min(240, Math.round(v ?? 0))) } })
                      }
                    />
                  </HStack>
                )}
                <Selector label="출발지" options={endpointOptions} value={endpointValue(plan.origin)} onChange={(v) => edit({ ...plan, origin: toEndpoint(v) })} />
                <Selector label="마지막 날 귀가지" options={endpointOptions} value={endpointValue(plan.finalDestination)} onChange={(v) => edit({ ...plan, finalDestination: toEndpoint(v) })} />
              </FormLayout>
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>집 주소 (선택)</Heading>
              <Text type="supporting" color="secondary">
                이 휴대폰에만 저장돼요. 차로 보낼 때 포함할지 따로 물어봐요. 넣지 않으면 차량 내비게이션의 '집'을 써요.
              </Text>
              {home ? (
                <HStack gap={2} vAlign="center">
                  <Text>{home.address}</Text>
                  <Button label="지우기" variant="ghost" size="sm" onClick={() => (setHome(null), setDirty(true))} />
                </HStack>
              ) : (
                <PlaceSearch
                  label="집 주소 검색"
                  onPick={(p) => {
                    // Home needs coordinates; without them the car keeps using its navigation HOME.
                    if (p.latE7 === null || p.lonE7 === null) return setError("집은 검색 결과나 좌표로만 넣을 수 있어요. 비워 두면 차량 내비의 '집'을 써요.");
                    setHome({ address: (p.address || p.name).slice(0, 120), latE7: p.latE7, lonE7: p.lonE7 });
                    setDirty(true);
                  }}
                />
              )}
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>장소</Heading>
              <PlaceSearch onPick={(p) => edit(addPlace(plan, p))} />
              <List hasDividers header={<Text type="label">{`전체 장소 ${plan.places.length}곳`}</Text>}>
                {plan.places.map((p) => {
                  const v = plan.visits.find((x) => x.placeRef === p.placeRef);
                  const where = v ? (v.unassignedReason ? '미배정' : `${plan.days.find((d) => d.visitOrder.includes(v.visitId))?.dayIndex}일차`) : '숙소';
                  return <ListItem key={p.placeRef} label={p.name} description={`${CATEGORY_LABEL[p.category]} · ${where}${v?.fixed ? ` · 고정 ${v.fixed.time}` : ''}`} onClick={() => setOpenPlace(p.placeRef)} />;
                })}
              </List>
            </VStack>

            <Divider />
            <DaysSection plan={plan} onChange={edit} onOpenPlace={setOpenPlace} onError={setError} />

            {unassignedVisits(plan).length > 0 && (
              <VStack gap={3}>
                <Heading level={2}>배정 안 된 장소</Heading>
                <Text type="supporting" color="secondary">
                  지우지 않고 사유와 함께 남겨 둬요. 차량으로도 그대로 보내져요.
                </Text>
                <List hasDividers>
                  {unassignedVisits(plan).map((v) => (
                    <ListItem
                      key={v.visitId}
                      label={plan.places.find((p) => p.placeRef === v.placeRef)?.name ?? v.visitId}
                      endContent={
                        <Selector
                          label="사유"
                          isLabelHidden
                          size="sm"
                          options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))}
                          value={v.unassignedReason ?? 'NOT_SCHEDULED_YET'}
                          onChange={(r) => edit(updateVisit(plan, v.visitId, { unassignedReason: r as Visit['unassignedReason'] }))}
                        />
                      }
                    />
                  ))}
                </List>
              </VStack>
            )}

            {warnings.length > 0 && (
              <VStack gap={2}>
                <Heading level={2}>확인할 점</Heading>
                {warnings.map((w) => (
                  <Banner key={w.text} status={w.level} title={w.text} />
                ))}
              </VStack>
            )}

            {tripId && <Button label="이 여행 삭제" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} />}
          </VStack>
          <VisitDialog plan={plan} placeRef={openPlace} onChange={edit} onClose={() => setOpenPlace(null)} />
          <AlertDialog
            isOpen={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="이 여행을 삭제할까요?"
            description="이 휴대폰에서만 지워져요. 이미 차량으로 불러온 여행은 차량에서 따로 지워야 해요."
            actionLabel="삭제"
            actionVariant="destructive"
            onAction={async () => {
              await trips.remove(doc.tripId);
              navigate('/', true);
            }}
          />
        </LayoutContent>
      }
      footer={
        <LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end">
            <Button label="닫기" variant="secondary" onClick={() => navigate('/')} />
            <Button label={dirty || !tripId ? '저장' : '저장됨'} variant="primary" isDisabled={!dirty && !!tripId} onClick={save} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

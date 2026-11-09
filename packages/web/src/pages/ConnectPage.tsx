import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { SelectableCard } from '@astryxdesign/core/SelectableCard';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Switch } from '@astryxdesign/core/Switch';
import { Heading, Text } from '@astryxdesign/core/Text';
import { isTerminal, parseQrFragment, sampleTrip, type SessionView } from '@tteonaljido/shared';
import { PushScreen } from '../components/shell/Screens';
import { CardListHeader } from '../components/toss/Card';
import { pairings, trips, type PairingRecord } from '../lib/db';
import { codeLabel, periodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { Tag } from '../components/shell/Tag';
import { ApiError, cancel, claim, confirmCode, finish, openPairing, seal, status, supportsWebCrypto, upload } from '../lib/pairing';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { newDoc, nightsLabel, nowIso, planWarnings, unassignedVisits, type TripDoc } from '../lib/trips';

type Stage = 'loading' | 'invalid' | 'unsupported' | 'intro' | 'code' | 'pick' | 'consent' | 'approve' | 'status';

const STEPS = [t('connect.step.connect'), t('connect.step.code'), t('connect.step.pick'), t('connect.step.consent'), t('connect.step.send')];
const STEP_OF: Partial<Record<Stage, number>> = { intro: 0, code: 1, pick: 2, consent: 3, approve: 4, status: 4 };
const LAST_SID = 'tteonaljido.lastSid';

/** Only for resuming via 연결 탭 › 이어서. Some private modes throw on sessionStorage; the connection itself works without it. */
const lastSid = {
  get: () => {
    try {
      return sessionStorage.getItem(LAST_SID);
    } catch {
      return null;
    }
  },
  set: (sid: string) => {
    try {
      sessionStorage.setItem(LAST_SID, sid);
    } catch {
      /* no resume in this window */
    }
  },
};

const ERROR_TEXT: Record<string, string> = {
  ALREADY_CLAIMED: t('connect.error.alreadyClaimed'),
  EXPIRED: t('connect.error.expired'),
  NOT_FOUND: t('connect.error.notFound'),
  FINGERPRINT: t('connect.error.fingerprint'),
  UNAUTHORIZED: t('connect.error.unauthorized'),
  NETWORK: t('connect.error.network'),
  RATE_LIMITED: t('connect.error.rateLimited'),
  PAYLOAD_CONFLICT: t('connect.error.payloadConflict'),
  UNSUPPORTED_SCHEMA: t('connect.error.unsupportedSchema'),
  UNSUPPORTED_VERSION: t('connect.error.unsupportedVersion'),
  APPLYING: t('connect.error.applying'),
  INVALID_STATE: t('connect.error.invalidState'),
  PAYLOAD_TOO_LARGE: t('connect.error.tooLarge'),
  INVALID_LOCAL: t('connect.error.invalidLocal'),
};

const RESULT_TEXT: Record<string, string> = {
  IMPORTED_NEW: t('connect.result.importedNew'),
  UPDATED: t('connect.result.updated'),
  SAVED_AS_COPY: t('connect.result.savedAsCopy'),
  HOME_ADDED: t('connect.result.homeAdded'),
  ALREADY_IMPORTED: t('connect.result.alreadyImported'),
  USER_DECLINED: t('connect.result.userDeclined'),
  INVALID_PAYLOAD: t('connect.result.invalidPayload'),
  UNSUPPORTED_VERSION: t('connect.result.unsupportedVersion'),
  DECRYPT_FAILED: t('connect.result.decryptFailed'),
  STORAGE_ERROR: t('connect.result.storageError'),
};

/** The server holds (or held) this phone's upload. Only then may the phone say "sent": a sealed copy on the phone proves nothing. */
const landed = (v: SessionView) =>
  v.state === 'MOBILE_APPROVED' || v.state === 'CAR_APPLYING' || v.state === 'APPLIED' || v.state === 'REJECTED' || v.carFetched || (v.state === 'EXPIRED' && (v.expireReason === 'RESULT' || v.expireReason === 'UNCONFIRMED'));

/** Nothing more will change. An UNCONFIRMED expiry still can: the car's late APPLIED report upgrades it until the server purges the session. */
const settled = (v: SessionView) => isTerminal(v.state) && !(v.state === 'EXPIRED' && v.expireReason === 'UNCONFIRMED');

const outcomeOf = (v: SessionView) => `${v.state}:${v.resultCode ?? v.expireReason ?? v.cancelReason ?? ''}`;

/** What the phone may honestly claim at each server state: sending is not the same as being applied. */
function statusText(v: SessionView): { title: string; detail: string; tone: 'info' | 'success' | 'warning' | 'error'; done: boolean } {
  switch (v.state) {
    case 'CLAIMED':
      return { title: t('connect.status.notSent'), detail: t('connect.status.notSent.detail'), tone: 'info', done: false };
    case 'MOBILE_APPROVED':
      return v.carFetched
        ? { title: t('connect.status.received'), detail: t('connect.status.received.detail'), tone: 'info', done: false }
        : { title: t('connect.status.sent'), detail: t('connect.status.sent.detail'), tone: 'info', done: false };
    case 'CAR_APPLYING':
      return { title: t('connect.status.applying'), detail: t('connect.status.applying.detail'), tone: 'info', done: false };
    case 'APPLIED':
      return { title: RESULT_TEXT[v.resultCode ?? ''] ?? t('connect.status.applied'), detail: t('connect.status.applied.detail'), tone: 'success', done: true };
    case 'REJECTED':
      return { title: RESULT_TEXT[v.resultCode ?? ''] ?? t('connect.status.rejected'), detail: t('connect.status.rejected.detail'), tone: 'warning', done: true };
    case 'EXPIRED':
      return v.expireReason === 'UNCONFIRMED'
        ? { title: t('connect.status.unconfirmed'), detail: t('connect.status.unconfirmed.detail'), tone: 'warning', done: true }
        : { title: t('connect.status.expired'), detail: t('connect.status.expired.detail'), tone: 'warning', done: true };
    case 'CANCELLED':
      return {
        title: v.cancelReason === 'MOBILE' ? t('connect.status.cancelledByPhone') : v.cancelReason === 'SECURITY' ? t('connect.status.cancelledForSecurity') : t('connect.status.cancelledByCar'),
        detail: t('connect.status.cancelled.detail'),
        tone: 'warning',
        done: true,
      };
    default:
      return { title: t('connect.status.waiting'), detail: '', tone: 'info', done: false };
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
  const [dead, setDead] = useState(false); // the session is gone (404/401): stop polling, no more actions
  const [sent, setSent] = useState(false); // the server confirmed the upload at least once on this page
  const scanSecret = useRef<string | null>(null);
  const finished = useRef<string | null>(null); // the outcome already logged, so repeated polls don't log it again
  const pollErr = useRef(false); // the banner shows a polling error (cleared by the next good poll), not an action's error

  const doc = useMemo(() => docs.find((d) => d.tripId === picked) ?? null, [docs, picked]);
  // Home lives in 설정 (one address for every trip); a trip's stored copy is not what gets sent.
  const home = defaultHome();
  const fail = (e: unknown, fromPoll = false) => {
    pollErr.current = fromPoll;
    setErr(ERROR_TEXT[e instanceof ApiError ? e.code : 'NETWORK'] ?? t('connect.error.unknown'));
  };

  // Read the QR fragment once, then remove it from the address bar and history.
  useEffect(() => {
    // The secret leaves the address bar first, synchronously: before any await and before any early return.
    const link = parseQrFragment(location.hash);
    if (location.hash) history.replaceState(null, '', '/c');
    void (async () => {
      try {
        await pairings.prune();
        setDocs(await trips.all());
      } catch {
        return setStage('invalid'); // storage unavailable (some private modes); the secret is already gone from the URL
      }
      if (!supportsWebCrypto()) return setStage('unsupported');
      let r: PairingRecord | undefined;
      try {
        if (link) {
          scanSecret.current = link.scanSecret;
          r = await openPairing(link);
        } else {
          const sid = lastSid.get();
          r = sid ? await pairings.get(sid) : undefined;
        }
      } catch {
        return setStage('unsupported'); // key generation or storage failed in this browser; scanning again here won't help
      }
      if (!r) return setStage('invalid');
      lastSid.set(r.sid);
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

  /** Logs each distinct outcome once (an UNCONFIRMED expiry may later be followed by APPLIED) and forgets the record. */
  const settle = async (r: PairingRecord, outcome: string) => {
    if (finished.current === outcome) return;
    finished.current = outcome;
    await finish(r, outcome);
  };

  const observe = async (r: PairingRecord, v: SessionView) => {
    setView(v);
    if (landed(v)) setSent(true);
    if (isTerminal(v.state)) await settle(r, outcomeOf(v));
  };

  const refresh = useCallback(async () => {
    if (!rec?.mobileToken) return;
    try {
      const v = await status(rec);
      if (pollErr.current) {
        pollErr.current = false;
        setErr(null);
      }
      await observe(rec, v);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'NOT_FOUND' || e.code === 'UNAUTHORIZED')) {
        setDead(true); // the session is gone or no longer ours; there is nothing left to poll or send
        await pairings.remove(rec.sid).catch(() => {});
        if (finished.current) return; // the outcome is already on screen; the server only dropped its tombstone
        pollErr.current = false;
        if (rec.sealed) {
          // Something may have reached the car: the car screen has the answer.
          setErr(t('connect.error.recordGone'));
          setStage('status');
        } else {
          // Nothing was sent: the only way on is a new QR.
          setErr(ERROR_TEXT[e.code]);
          setStage('invalid');
        }
      } else fail(e, true);
    }
  }, [rec]);

  // Poll only while the page is visible and the session can still change.
  useEffect(() => {
    if (!rec?.mobileToken || dead || stage === 'intro' || stage === 'loading' || stage === 'invalid') return;
    if (view && settled(view)) return;
    void refresh();
    const t = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), 2000);
    return () => window.clearInterval(t);
  }, [rec, stage, view?.state, dead, refresh]);

  // The car cancelled or the session expired while the user was still choosing, or an upload whose answer was lost did land:
  // show the real state (an earlier error no longer applies), and don't let them pick or send again into a session that has moved on.
  useEffect(() => {
    if (!view || !(isTerminal(view.state) || landed(view))) return;
    setErr(null);
    if (stage !== 'status') setStage('status');
  }, [view?.state]);

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
    // On the status screen this re-sends the body already sealed (and approved); otherwise it seals the current choice first.
    const resend = stage === 'status';
    if (!rec || dead || (!resend && !doc)) return;
    setBusy(true);
    setErr(null);
    let next = rec;
    try {
      if (!resend) next = await seal(rec, { ...doc!, home }, includeHome && !!home);
      const v = await upload(next);
      setRec(next);
      setSent(true); // an accepted PUT means the server has (or had) exactly this body
      setStage('status');
      await observe(next, v);
    } catch (e) {
      // Keep what IndexedDB now holds, so a retry sends the same bytes and the outcome is logged against the sealed trip.
      if (next !== rec) setRec(next);
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!rec || dead) return;
    setBusy(true);
    try {
      if (rec.mobileToken) setView(await cancel(rec));
      await settle(rec, 'CANCELLED:MOBILE');
      setStage('status');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const addSample = async () => {
    const d = await newDoc({ ...sampleTrip(nowIso()), tripId: crypto.randomUUID() }, defaultHome());
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
        return <Banner status="error" title={t('connect.unsupported.title')} description={t('connect.unsupported.description')} />;
      case 'invalid':
        return (
          <Banner
            status="warning"
            title={t('connect.invalid.title')}
            description={t('connect.invalid.description')}
          />
        );
      case 'intro':
        return (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>{t('connect.intro.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('connect.intro.description')}
              </Text>
            </VStack>
            <Card padding={0}>
              <List hasDividers>
                <ListItem label={t('connect.intro.step1')} description={t('connect.intro.step1.detail')} />
                <ListItem label={t('connect.intro.step2')} description={t('connect.intro.step2.detail')} />
                <ListItem label={t('connect.intro.step3')} description={t('connect.intro.step3.detail')} />
                <ListItem label={t('connect.intro.step4')} description={t('connect.intro.step4.detail')} />
              </List>
            </Card>
          </VStack>
        );
      case 'code':
        return (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>{t('connect.code.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('connect.code.description')}
              </Text>
            </VStack>
            <Card variant="muted" padding={6}>
              <VStack gap={1} align="center">
                <Text type="supporting" color="secondary">
                  {t('connect.code.label')}
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
              <Heading level={2}>{t('connect.pick.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('connect.pick.description')}
              </Text>
            </VStack>
            {docs.length === 0 && <Banner status="info" title={t('common.noTrips')} description={t('connect.pick.empty')} />}
            <VStack gap={2}>
              {docs.map((d) => {
                const warnings = planWarnings(d.plan, home, d.lodgingTbd).filter((w) => w.level === 'warning').length;
                return (
                  <SelectableCard key={d.tripId} label={d.plan.name} isSelected={picked === d.tripId} onChange={(on) => setPicked(on ? d.tripId : null)}>
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center">
                        <StackItem size="fill">
                          <Text type="label">{d.plan.name}</Text>
                        </StackItem>
                        <span className="tn-rev">{`v${d.revision}`}</span>
                      </HStack>
                      <Text type="supporting" color="secondary">
                        {t('common.tripSummary', { period: periodLabel(d.plan.startDate, d.plan.endDate), nights: nightsLabel(d.plan), places: d.plan.places.length })}
                      </Text>
                      {warnings > 0 && (
                        <span>
                          <Tag tone="warn">{t('connect.pick.warnings', { n: warnings })}</Tag>
                        </span>
                      )}
                    </VStack>
                  </SelectableCard>
                );
              })}
            </VStack>
            <HStack gap={2}>
              <Button label={t('common.addSample')} variant="secondary" size="sm" onClick={addSample} />
              <Button label={t('connect.pick.newTrip')} variant="ghost" size="sm" onClick={() => navigate('/trips/new')} />
            </HStack>
          </VStack>
        );
      case 'consent':
        return doc ? (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>{t('connect.consent.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('connect.consent.description')}
              </Text>
            </VStack>
            <Switch
              label={t('connect.consent.includeHome')}
              value={includeHome && !!home}
              isDisabled={!home}
              onChange={setIncludeHome}
              description={home ? t('connect.consent.homeOn', { address: home.address }) : t('connect.consent.noHome')}
            />
            <Card padding={0}>
              <List hasDividers header={<CardListHeader>{t('connect.consent.sent')}</CardListHeader>}>
                <ListItem label={t('connect.consent.basics')} description={`${doc.plan.name} · ${periodLabel(doc.plan.startDate, doc.plan.endDate)}`} />
                <ListItem label={t('connect.consent.places', { n: doc.plan.places.length })} description={t('connect.consent.places.detail')} />
                <ListItem label={t('connect.consent.days')} description={t('connect.consent.days.detail')} />
                <ListItem label={t('connect.consent.lodging')} description={t('connect.consent.lodging.detail')} />
                <ListItem label={t('common.homeAddress')} description={includeHome && home ? t('common.included') : t('common.notIncluded')} />
              </List>
            </Card>
            <Card padding={0}>
              <List hasDividers header={<CardListHeader>{t('connect.consent.notSent')}</CardListHeader>}>
                <ListItem label={t('connect.consent.private')} description={t('connect.consent.private.detail')} />
                <ListItem label={t('connect.consent.otherTrips')} />
              </List>
            </Card>
          </VStack>
        ) : null;
      case 'approve':
        return doc && rec ? (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>{t('connect.approve.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('connect.approve.description')}
              </Text>
            </VStack>
            <Card>
              <MetadataList orientation="vertical">
                <MetadataListItem label={t('connect.approve.trip')}>{`${doc.plan.name} (v${doc.revision})`}</MetadataListItem>
                <MetadataListItem label={t('connect.approve.period')}>{`${periodLabel(doc.plan.startDate, doc.plan.endDate)} · ${nightsLabel(doc.plan)}`}</MetadataListItem>
                <MetadataListItem label={t('connect.approve.places')}>
                  {t('connect.approve.placesValue', { places: doc.plan.places.length, fixed: doc.plan.visits.filter((v) => v.fixed).length, unassigned: unassignedVisits(doc.plan).length })}
                </MetadataListItem>
                <MetadataListItem label={t('common.homeAddress')}>{includeHome && home ? t('common.included') : t('common.notIncluded')}</MetadataListItem>
                <MetadataListItem label={t('connect.approve.target')}>
                  {t('connect.approve.targetValue', { code: rec.confirmCode ? codeLabel(rec.confirmCode) : '', version: rec.carAppVersion ?? '' })}
                </MetadataListItem>
              </MetadataList>
            </Card>
            {(() => {
              // The conflicts the car would also flag — shown once more right before sending, so nothing surprises on arrival.
              const warnings = planWarnings(doc.plan, home, doc.lodgingTbd).filter((w) => w.level === 'warning');
              return warnings.length === 0 ? null : (
                <VStack gap={1}>
                  <Text type="label">{t('connect.approve.conflicts', { n: warnings.length })}</Text>
                  {warnings.map((w, n) => (
                    <Banner key={n} status="warning" title={w.text} />
                  ))}
                </VStack>
              );
            })()}
          </VStack>
        ) : null;
      case 'status':
        return (
          <VStack gap={4}>
            {st ? (
              <Banner status={st.tone} title={st.title} description={st.detail} />
            ) : dead ? null : (
              <HStack gap={2} vAlign="center">
                <Spinner />
                <Text>{t('connect.status.checking')}</Text>
              </HStack>
            )}
            {view && (
              <Card padding={0}>
                <List hasDividers>
                  <ListItem
                    label={t('connect.track.sent')}
                    endContent={
                      <Tag tone={sent || landed(view) ? 'ok' : sessionOver ? 'warn' : 'neutral'}>
                        {sent || landed(view) ? t('connect.track.done') : sessionOver ? t('connect.track.failed') : t('connect.track.waiting')}
                      </Tag>
                    }
                  />
                  <ListItem label={t('connect.track.received')} endContent={<Tag tone={view.carFetched ? 'ok' : 'neutral'}>{view.carFetched ? t('connect.track.done') : t('connect.track.waiting')}</Tag>} />
                  <ListItem
                    label={t('connect.track.applied')}
                    endContent={
                      <Tag tone={view.state === 'APPLIED' ? 'ok' : sessionOver ? 'warn' : 'neutral'}>
                        {view.state === 'APPLIED' ? t('connect.track.done') : sessionOver ? t('connect.track.failed') : t('connect.track.waiting')}
                      </Tag>
                    }
                  />
                </List>
              </Card>
            )}
          </VStack>
        );
    }
  })();

  const footer = (() => {
    const cancelBtn = !sessionOver && !dead && rec?.mobileToken && <Button label={t('connect.cancel')} variant="ghost" isDisabled={busy} onClick={doCancel} />;
    switch (stage) {
      case 'intro':
        return (
          <StackItem size="fill">
            <Button label={t('connect.intro.action')} variant="primary" width="100%" isLoading={busy} onClick={doClaim} />
          </StackItem>
        );
      case 'code':
        return (
          <>
            <Button label={t('connect.code.mismatch')} variant="secondary" isDisabled={busy} onClick={doCancel} />
            <StackItem size="fill">
              <Button label={t('connect.code.match')} variant="primary" width="100%" onClick={async () => rec && !dead && (setRec(await confirmCode(rec)), setStage('pick'))} />
            </StackItem>
          </>
        );
      case 'pick':
        return (
          <>
            {cancelBtn}
            <StackItem size="fill">
              <Button label={t('common.next')} variant="primary" width="100%" isDisabled={!doc} onClick={() => setStage('consent')} />
            </StackItem>
          </>
        );
      case 'consent':
        return (
          <>
            <Button label={t('common.prev')} variant="secondary" onClick={() => setStage('pick')} />
            <StackItem size="fill">
              <Button label={t('common.next')} variant="primary" width="100%" onClick={() => setStage('approve')} />
            </StackItem>
          </>
        );
      case 'approve':
        return (
          <>
            <Button label={t('common.prev')} variant="secondary" isDisabled={busy} onClick={() => setStage('consent')} />
            <StackItem size="fill">
              <Button label={t('connect.send')} variant="primary" width="100%" isLoading={busy} onClick={doSend} />
            </StackItem>
          </>
        );
      case 'status':
        return sessionOver || dead ? (
          <StackItem size="fill">
            <Button label={t('connect.toTrips')} variant="primary" width="100%" onClick={() => navigate('/')} />
          </StackItem>
        ) : (
          <>
            {cancelBtn}
            {/* The server says nothing has arrived (a reload after a failed upload lands here): offer the send, whatever the banner shows. */}
            {rec?.sealed && view?.state === 'CLAIMED' && !sent && <Button label={t('connect.resend')} variant="primary" isLoading={busy} onClick={doSend} />}
            <Button label={t('connect.refresh')} variant="secondary" onClick={() => void refresh()} />
          </>
        );
      default:
        return <Button label={t('connect.toTrips')} variant="secondary" onClick={() => navigate('/')} />;
    }
  })();

  const step = STEP_OF[stage];
  return (
    <PushScreen title={t('connect.title')} onBack={() => navigate('/car')} cta={footer}>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        {/* A five-label stepper doesn't fit 360pt; the progress bar's accessible label names the current step. */}
        {step !== undefined && (
          <ProgressBar label={`${t('connect.stepper')}: ${STEPS[step]}`} value={step + 1} max={STEPS.length} hasValueLabel formatValueLabel={(v, m) => `${STEPS[step]} · ${v}/${m}`} />
        )}
        {err && <Banner status="error" title={err} />}
        {content}
      </div>
    </PushScreen>
  );
}

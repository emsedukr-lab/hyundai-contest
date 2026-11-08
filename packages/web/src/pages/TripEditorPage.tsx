import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { dayIssues, type Home, type Trip } from '@tteonaljido/shared';
import { MoreIcon, PencilIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { DayTimeline } from '../editor/DayTimeline';
import { RecommendDialog } from '../editor/RecommendDialog';
import { ShareDialog } from '../editor/ShareDialog';
import { EndSheet } from '../editor/sheets/EndSheet';
import { LegSheet } from '../editor/sheets/LegSheet';
import { PlaceSheet, type Notice } from '../editor/sheets/PlaceSheet';
import { SendSheet } from '../editor/sheets/SendSheet';
import { StartSheet } from '../editor/sheets/StartSheet';
import { TripInfoPanel } from '../editor/TripInfoPanel';
import { VisitDialog } from '../editor/VisitDialog';
import { TRIPS_CHANGED, trips } from '../lib/db';
import { shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { emptyPlan, newDoc, nightsLabel, nowIso, relinkLegs, rememberLegs, savePlan, unassignedVisits, type LegBook, type TripDoc } from '../lib/trips';
import '../editor/timeline.css';

/** Which bottom sheet is open (one at a time; dialogs such as place details may stack above it). */
type SheetState = { kind: 'start' } | { kind: 'leg'; k: number } | { kind: 'end' } | { kind: 'place' } | { kind: 'send' } | { kind: 'map' } | null;

/** The plan as stored and shared: a blank name becomes the default one (the transfer needs a name). */
const named = (p: Trip): Trip => (p.name.trim() ? p : { ...p, name: t('trip.defaultName') });

/** Writes the trip to this phone (a new revision only when its content changed) and tells listening lists. */
async function persist(doc: TripDoc, plan: Trip, home: Home | null): Promise<TripDoc> {
  const next = await savePlan(doc, named(plan), home);
  await trips.put(next);
  window.dispatchEvent(new Event(TRIPS_CHANGED));
  return next;
}

/** 'MM/DD–MM/DD' for the title line, from the same short labels as the day tabs (weekday dropped). */
const shortPeriod = (start: string, end: string) => {
  const s = shortDate(start).replace(/\(.*\)$/, '');
  return start === end ? s : `${s}–${shortDate(end).replace(/\(.*\)$/, '')}`;
};

/**
 * The trip editor as one timeline (M26–27): a title that jumps to the 여행 정보 tab, then tabs [여행 정보][1일차]… with
 * 경로 추천 and 지도. 여행 정보 sets name → period → 출발 장소 → 귀가 시 도착 장소 in the page (a new trip opens there);
 * a day tab shows that day as a route from 출발 to 숙소/귀가. Every input opens in a bottom sheet; problems show
 * on the node they concern. Below: 보관함 (places on no day yet) and one action — 저장 while there are unsaved edits,
 * then 경로 보고 차로 보내기 (sending always starts from the car's QR, so that sheet shows the route and the steps).
 */
export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  // The one home address, set in 설정 and shared by every trip (route checks, map, recommend, what the car may get).
  const [home] = useState(defaultHome);
  const [dirty, setDirty] = useState(false);
  // 'info' = the 여행 정보 tab (a new trip opens there), else a day number.
  const [day, setDay] = useState(tripId ? '1' : 'info');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Travel times typed this session by pair of places, so reordering does not throw them away. */
  const book = useRef<LegBook>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);
  // The latest state for saves that happen outside a render: leaving by browser back (unmount) or the app going away.
  const latest = useRef<{ doc: TripDoc | null; plan: Trip | null; dirty: boolean }>({ doc: null, plan: null, dirty: false });
  latest.current = { doc, plan, dirty };
  /** Saves run one after another so two of them never race on the same revision. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveNow = (): Promise<TripDoc | null> => {
    const run = queue.current.then(async () => {
      const now = latest.current;
      if (!now.dirty || !now.doc || !now.plan) return null;
      now.dirty = false;
      const next = await persist(now.doc, now.plan, home);
      latest.current.doc = next; // edits made while saving stay marked as unsaved
      return next;
    });
    queue.current = run.catch(() => undefined);
    return run;
  };

  useEffect(() => {
    void (async () => {
      // A new trip starts with an empty name, so the field shows its placeholder; saving fills in the default if left blank.
      const d = tripId ? await trips.get(tripId) : await newDoc({ ...emptyPlan(), name: '' }, defaultHome());
      if (!d) return navigate('/', true);
      setDoc(d);
      book.current = new Map();
      rememberLegs(d.plan, book.current);
      setPlan(d.plan);
    })();
  }, [tripId]);

  // Long trips scroll their day tabs sideways; fade the edge that has more, so a cut tab reads as "scroll", not broken.
  const dayCount = plan?.days.length ?? 0;
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      el.dataset.fadeLeft = String(el.scrollLeft > 2);
      el.dataset.fadeRight = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [dayCount]);

  // Auto-save: leaving by browser back unmounts the editor; closing or switching away hides the page.
  useEffect(() => {
    const hide = () => {
      void saveNow().then((next) => {
        if (!next) return;
        setDoc(next);
        setDirty(false);
        // A new trip now has an address; keep it without re-mounting the editor while the user is away.
        if (location.pathname === '/trips/new') history.replaceState(null, '', `/trips/${next.tripId}`);
      });
    };
    const onVisibility = () => document.visibilityState === 'hidden' && hide();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', hide);
      void saveNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Days with something to fix get a dot on their tab: a timetable conflict or a night without lodging.
  const attention = useMemo(() => {
    if (!plan) return new Set<number>();
    const last = plan.days.length - 1;
    return new Set(plan.days.filter((d, i) => (i < last && !d.lodgingPlaceRef) || dayIssues(plan, d.dayIndex).some((x) => x.severity === 'CONFLICT')).map((d) => d.dayIndex));
  }, [plan]);
  if (!plan || !doc) return <Spinner />;

  const onInfo = day === 'info';
  // On the 여행 정보 tab the map and send sheets follow day 1.
  const dayIndex = plan.days.find((d) => String(d.dayIndex) === day)?.dayIndex ?? plan.days[0].dayIndex;
  const openInfo = () => {
    setDay('info');
    window.scrollTo({ top: 0 });
  };
  const pool = unassignedVisits(plan);
  const poolNeedsCare = pool.some((v) => v.fixed);

  const edit = (p: Trip) => {
    const linked = relinkLegs(plan, p, book.current);
    rememberLegs(linked, book.current);
    setPlan(linked);
    setDirty(true);
  };
  const fail = (m: string) => setNotice({ tone: 'error', text: m });

  const save = async () => {
    latest.current = { doc, plan, dirty: true };
    const next = (await saveNow()) ?? doc;
    setDoc(next);
    setPlan(next.plan);
    setDirty(false);
    setNotice({ tone: 'success', text: next.revision === doc.revision && tripId ? t('editor.noChanges') : t('editor.saved', { revision: next.revision }) });
    if (!tripId) navigate(`/trips/${next.tripId}`, true);
  };

  /** Makes a copy of the current trip (places, days, home and all) as a new trip and opens it. The original is untouched. */
  const duplicate = async () => {
    if (dirty) await save(); // keep unsaved edits in the original too, not only in the copy
    const clone: Trip = { ...structuredClone(plan), tripId: crypto.randomUUID(), name: t('trip.copyName', { name: plan.name }).slice(0, 60), revision: 1, updatedAt: nowIso() };
    const nd = await newDoc(clone, home);
    await trips.put(nd);
    navigate(`/trips/${nd.tripId}`);
  };

  /** Leave the editor (back to the trips tab, or to 설정 to change a start place); unsaved edits are saved first. */
  const leave = async (to = '/') => {
    await saveNow();
    navigate(to);
  };
  const close = () => setSheet(null);

  const menuItems = [
    ...(tripId ? [{ label: t('trip.duplicate'), onClick: () => void duplicate() }] : []),
    { label: t('share.button'), onClick: () => setSharing(true) },
    ...(tripId ? [{ type: 'divider' as const }, { label: t('editor.delete'), variant: 'destructive' as const, onClick: () => setConfirmDelete(true) }] : []),
  ];

  const title = (
    <button type="button" className="tl-title" onClick={openInfo} aria-label={t('tl.editBasics')}>
      <span className="tl-title-name">
        <span>{plan.name || (tripId ? t('editor.titleEdit') : t('editor.titleNew'))}</span>
        <PencilIcon />
      </span>
      <span className="tl-title-sub">{t('tl.summary', { period: shortPeriod(plan.startDate, plan.endDate), nights: nightsLabel(plan) })}</span>
    </button>
  );

  const showSave = dirty || !tripId;
  const cta = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" className="tl-pool" onClick={() => setSheet({ kind: 'place' })} aria-label={`${t('tl.pool', { n: pool.length })}${poolNeedsCare ? ` · ${t('tl.fixedPool')}` : ''}`}>
        {t('tl.pool', { n: pool.length })}
        {poolNeedsCare && <span className="tl-dot" aria-hidden="true" />}
      </button>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        {showSave ? (
          <Button label={t('editor.save')} variant="primary" size="lg" width="100%" onClick={save} />
        ) : (
          <Button label={t('tl.send')} variant="primary" size="lg" width="100%" onClick={() => setSheet({ kind: 'send' })} />
        )}
      </div>
    </div>
  );

  return (
    <PushScreen
      title={title}
      onBack={() => leave()}
      actions={
        <>
          <Badge variant="neutral" label={`v${doc.revision}${dirty ? ` · ${t('editor.unsaved')}` : ''}`} />
          <DropdownMenu
            items={menuItems}
            presentation="popover"
            renderTrigger={(props) => (
              <button type="button" className="tn-iconbtn" aria-label={t('editor.more')} {...props}>
                <MoreIcon />
              </button>
            )}
          />
        </>
      }
      cta={cta}>
      <div className="tl-dayrow">
        <div className="tl-daytabs" ref={tabsRef}>
          <TabList role="tablist" aria-label={t('days.title')} value={onInfo ? 'info' : String(dayIndex)} onChange={setDay} hasDivider={false}>
            <Tab value="info" panelId="day-panel" label={t('tl.basicsTitle')} />
            {plan.days.map((d) => (
              <Tab
                key={d.dayIndex}
                value={String(d.dayIndex)}
                panelId="day-panel"
                label={t('common.day', { day: d.dayIndex })}
                endContent={attention.has(d.dayIndex) ? <span className="tl-dot" role="img" aria-label={t('tl.dayAttention')} /> : undefined}
              />
            ))}
          </TabList>
        </div>
        <div className="tl-dayactions">
          <Button label={t('recommend.button')} variant="secondary" size="sm" onClick={() => setRecommending(true)} />
          <Button label={t('tl.map')} variant="secondary" size="sm" onClick={() => setSheet({ kind: 'map' })} />
        </div>
      </div>

      {notice && (
        <div className="tn-pad" style={{ paddingTop: 12 }}>
          <Banner status={notice.tone} title={notice.text} isDismissable onDismiss={() => setNotice(null)} />
        </div>
      )}
      {/* ARIA tabs: one panel whose content follows the selected day. */}
      <div id="day-panel" role="tabpanel" aria-label={onInfo ? t('tl.basicsTitle') : t('common.day', { day: dayIndex })} style={{ paddingTop: onInfo ? 20 : 12, paddingBottom: 16 }}>
        {onInfo ? (
          <TripInfoPanel plan={plan} home={home} onChange={edit} onOpenSettings={() => leave('/settings')} onPlanDays={() => setDay(String(plan.days[0].dayIndex))} />
        ) : (
          <DayTimeline
            plan={plan}
            home={home}
            dayIndex={dayIndex}
            onChange={edit}
            onError={fail}
            onOpenPlace={setOpenPlace}
            onOpenStart={() => setSheet({ kind: 'start' })}
            onOpenLeg={(k) => setSheet({ kind: 'leg', k })}
            onOpenEnd={() => setSheet({ kind: 'end' })}
            onAddPlace={() => setSheet({ kind: 'place' })}
          />
        )}
      </div>

      <StartSheet isOpen={sheet?.kind === 'start'} onClose={close} plan={plan} home={home} dayIndex={dayIndex} onChange={edit} onOpenSettings={() => leave('/settings')} />
      {sheet?.kind === 'leg' && <LegSheet isOpen onClose={close} plan={plan} dayIndex={dayIndex} k={sheet.k} onChange={edit} />}
      <EndSheet isOpen={sheet?.kind === 'end'} onClose={close} plan={plan} home={home} dayIndex={dayIndex} onChange={edit} onOpenPlace={setOpenPlace} onOpenSettings={() => leave('/settings')} />
      <PlaceSheet isOpen={sheet?.kind === 'place'} onClose={close} plan={plan} dayIndex={dayIndex} onChange={edit} onOpenPlace={setOpenPlace} onNotice={setNotice} />
      {(sheet?.kind === 'send' || sheet?.kind === 'map') && <SendSheet key={`${sheet.kind}${dayIndex}`} isOpen onClose={close} plan={plan} home={home} dayIndex={dayIndex} mode={sheet.kind} />}

      <VisitDialog plan={plan} placeRef={openPlace} onChange={edit} onClose={() => setOpenPlace(null)} />
      <RecommendDialog isOpen={recommending} plan={plan} home={home} book={book.current} onApply={edit} onClose={() => setRecommending(false)} />
      <ShareDialog isOpen={sharing} doc={{ ...doc, plan: named(plan), home }} onClose={() => setSharing(false)} />
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('editor.delete.title')}
        description={t('editor.delete.description')}
        actionLabel={t('editor.delete.action')}
        actionVariant="destructive"
        onAction={async () => {
          latest.current.dirty = false; // deleting: nothing to auto-save on the way out
          await trips.remove(doc.tripId);
          navigate('/', true);
        }}
      />
    </PushScreen>
  );
}

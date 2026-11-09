import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Spinner } from '@astryxdesign/core/Spinner';
import { dayIssues, type Home, type Trip } from '@tteonaljido/shared';
import { ChevronIcon, MoreIcon, PencilIcon, PlusIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { endpointName } from '../editor/dayInfo';
import { DayTimeline } from '../editor/DayTimeline';
import { NotesContext } from '../editor/NotesContext';
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
import { periodLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { cleanNotes, setNote, type TripNotes } from '../lib/notes';
import { applyRun, emptyRuns, fetchRun, runSignature } from '../lib/routeTimes';
import { defaultHome } from '../lib/settings';
import { emptyPlan, newDoc, nightsLabel, nowIso, relinkLegs, rememberLegs, savePlan, unassignedVisits, type LegBook, type TripDoc } from '../lib/trips';
import '../editor/timeline.css';

/** Which bottom sheet is open (one at a time; dialogs such as place details may stack above it). */
type SheetState =
  | { kind: 'start'; day: number }
  | { kind: 'leg'; day: number; k: number }
  | { kind: 'end'; day: number }
  | { kind: 'map'; day: number }
  | { kind: 'place' }
  | { kind: 'send' }
  | null;

/** Section header height under the 56pt top bar: a day counts as "in view" once its header is stuck there. */
const STUCK_AT = 56 + 56;

/** The plan as stored and shared: a blank name becomes the default one (the transfer needs a name). */
const named = (p: Trip): Trip => (p.name.trim() ? p : { ...p, name: t('trip.defaultName') });

/** Writes the trip to this phone (a new revision only when its content changed) and tells listening lists. */
async function persist(doc: TripDoc, plan: Trip, home: Home | null, notes: TripNotes): Promise<TripDoc> {
  // Notes are phone-only and outside the plan's hash: changing only a memo keeps the version the car knows.
  const next: TripDoc = { ...(await savePlan(doc, named(plan), home)), notes: cleanNotes(notes, new Set(plan.places.map((p) => p.placeRef))) };
  await trips.put(next);
  window.dispatchEvent(new Event(TRIPS_CHANGED));
  return next;
}

/** 'MM/DD–MM/DD' for the title line, from the same short labels as the day headers (weekday dropped). */
const shortPeriod = (start: string, end: string) => {
  const s = shortDate(start).replace(/\(.*\)$/, '');
  return start === end ? s : `${s}–${shortDate(end).replace(/\(.*\)$/, '')}`;
};

/**
 * The trip editor as one page (M30): 여행 정보, then every day as a route from 출발 to 숙소/귀가, one after another in a
 * single scroll. Each section's header sticks under the top bar while its section is on screen, so you always see which
 * part you are in. Places are added with the floating + button (to the day in view; its badge counts the places on no
 * day yet). Every input opens in a bottom sheet; problems show on the node they concern. Below: one action — 저장 while
 * there are unsaved edits, then 경로 보고 차로 보내기. Leaving saves on its own (M29).
 */
export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  // The one home address, set in 설정 and shared by every trip (route checks, map, recommend, what the car may get).
  const [home] = useState(defaultHome);
  const [dirty, setDirty] = useState(false);
  /** Phone-only memos and lodging check-in/out, by place (saved with the trip, never sent to the car). */
  const [notes, setNotes] = useState<TripNotes>({});
  /** 여행 정보 open for editing: a new trip starts open; a saved one shows its summary until expanded. */
  const [infoOpen, setInfoOpen] = useState(!tripId);
  /** The day whose header is stuck under the top bar (the + button adds there); day 1 while 여행 정보 is in view. */
  const [focusDay, setFocusDay] = useState(1);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Travel times typed this session by pair of places, so reordering does not throw them away. */
  const book = useRef<LegBook>(new Map());
  // The latest state for saves that happen outside a render: leaving by browser back (unmount) or the app going away.
  const latest = useRef<{ doc: TripDoc | null; plan: Trip | null; notes: TripNotes; dirty: boolean }>({ doc: null, plan: null, notes: {}, dirty: false });
  latest.current = { doc, plan, notes, dirty };
  /** Auto travel times: only after the user changed something, each empty stretch asked once, stopped if unavailable. */
  const edited = useRef(false);
  const asked = useRef(new Set<string>());
  const routeOff = useRef(false);
  /** Saves run one after another so two of them never race on the same revision. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveNow = (): Promise<TripDoc | null> => {
    const run = queue.current.then(async () => {
      const now = latest.current;
      if (!now.dirty || !now.doc || !now.plan) return null;
      now.dirty = false;
      const next = await persist(now.doc, now.plan, home, now.notes);
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
      setNotes(cleanNotes(d.notes));
      book.current = new Map();
      rememberLegs(d.plan, book.current);
      setPlan(d.plan);
    })();
  }, [tripId]);

  // Which day is in view: the last day section whose top has reached the stuck-header line.
  const dayCount = plan?.days.length ?? 0;
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = 1;
      for (const el of document.querySelectorAll<HTMLElement>('section[data-day]')) if (el.getBoundingClientRect().top <= STUCK_AT) current = Number(el.dataset.day);
      setFocusDay(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
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

  /**
   * Fills empty legs from Kakao directions. Automatic after a route change (each stretch once, silent); from the menu it
   * retries everything and says what happened. Answers land only where the leg is still empty and unchanged.
   */
  const fillLegs = async (manual: boolean) => {
    const cur = latest.current.plan;
    if (!cur || (!manual && routeOff.current)) return;
    const runs = emptyRuns(cur).filter((r) => manual || !asked.current.has(runSignature(r)));
    if (!runs.length) return manual ? setNotice({ tone: 'info', text: t('tl.autoLegsNone') }) : undefined;
    let filled = 0;
    for (const run of runs) {
      asked.current.add(runSignature(run));
      const minutes = await fetchRun(run);
      if (!minutes) {
        routeOff.current = true;
        if (manual) setNotice({ tone: 'error', text: t('tl.autoLegsOff') });
        return;
      }
      const now = latest.current.plan;
      if (!now) return;
      const out = applyRun(now, run, minutes);
      if (!out.filled) continue;
      filled += out.filled;
      rememberLegs(out.plan, book.current);
      latest.current.plan = out.plan;
      setPlan(out.plan);
      setDirty(true);
    }
    routeOff.current = false;
    if (manual) setNotice({ tone: filled ? 'success' : 'info', text: filled ? t('tl.autoLegsDone', { n: filled }) : t('tl.autoLegsNone') });
  };
  // After an edit that left legs empty (a stop moved, added or removed; lodging or an end changed), fill them shortly after.
  useEffect(() => {
    if (!plan || !edited.current) return;
    const timer = setTimeout(() => void fillLegs(false), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Days with something to fix get a dot on their header: a timetable conflict or a night without lodging.
  const attention = useMemo(() => {
    if (!plan) return new Set<number>();
    const last = plan.days.length - 1;
    return new Set(plan.days.filter((d, i) => (i < last && !d.lodgingPlaceRef) || dayIssues(plan, d.dayIndex).some((x) => x.severity === 'CONFLICT')).map((d) => d.dayIndex));
  }, [plan]);
  if (!plan || !doc) return <Spinner />;

  const nightCount = plan.days.length - 1;
  const missingNights = plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef).length;
  const pool = unassignedVisits(plan);
  const poolNeedsCare = pool.some((v) => v.fixed);
  const targetDay = plan.days.some((d) => d.dayIndex === focusDay) ? focusDay : plan.days[0].dayIndex;

  const edit = (p: Trip) => {
    const linked = relinkLegs(plan, p, book.current);
    rememberLegs(linked, book.current);
    setPlan(linked);
    setDirty(true);
    edited.current = true;
  };
  const fail = (m: string) => setNotice({ tone: 'error', text: m });
  const notesApi = {
    notes,
    setNote: (placeRef: string, patch: Parameters<typeof setNote>[2]) => {
      setNotes((n) => setNote(n, placeRef, patch));
      setDirty(true);
    },
  };
  /** Brings a day's section to the top, under its own stuck header. */
  const showDay = (day: number) => requestAnimationFrame(() => document.getElementById(`day-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  const save = async () => {
    latest.current = { doc, plan, notes, dirty: true };
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
    const nd: TripDoc = { ...(await newDoc(clone, home)), notes: cleanNotes(notes) }; // the copy keeps its memos (same places)
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
    { label: t('recommend.button'), onClick: () => setRecommending(true) },
    { label: t('tl.autoLegs'), onClick: () => void fillLegs(true) },
    ...(tripId ? [{ label: t('trip.duplicate'), onClick: () => void duplicate() }] : []),
    { label: t('share.button'), onClick: () => setSharing(true) },
    ...(tripId ? [{ type: 'divider' as const }, { label: t('editor.delete'), variant: 'destructive' as const, onClick: () => setConfirmDelete(true) }] : []),
  ];

  const title = (
    <button
      type="button"
      className="tl-title"
      onClick={() => {
        setInfoOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label={t('tl.editBasics')}>
      <span className="tl-title-name">
        <span>{plan.name || (tripId ? t('editor.titleEdit') : t('editor.titleNew'))}</span>
        <PencilIcon />
      </span>
      <span className="tl-title-sub">{t('tl.summary', { period: shortPeriod(plan.startDate, plan.endDate), nights: nightsLabel(plan) })}</span>
    </button>
  );

  const cta =
    dirty || !tripId ? (
      <Button label={t('editor.save')} variant="primary" size="lg" width="100%" onClick={save} />
    ) : (
      <Button label={t('tl.send')} variant="primary" size="lg" width="100%" onClick={() => setSheet({ kind: 'send' })} />
    );

  return (
    <NotesContext.Provider value={notesApi}>
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
      {notice && (
        <div className="tn-pad" style={{ paddingTop: 12 }}>
          <Banner status={notice.tone} title={notice.text} isDismissable onDismiss={() => setNotice(null)} />
        </div>
      )}

      <section id="trip-info" aria-labelledby="trip-info-h">
        <h2 id="trip-info-h" className="tl-sechead">
          <span className="tl-sechead-title">{t('tl.basicsTitle')}</span>
          {missingNights > 0 && !infoOpen && <span className="tl-dot" role="img" aria-label={t('tl.dayAttention')} />}
          <button type="button" className="tl-textbtn tl-toggle" aria-expanded={infoOpen} aria-controls="trip-info-body" onClick={() => setInfoOpen((o) => !o)}>
            {infoOpen ? t('tl.collapse') : t('tl.expand')}
            <span className={`tl-chev${infoOpen ? ' is-open' : ''}`} aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
        </h2>
        <div id="trip-info-body" style={{ paddingTop: 16, paddingBottom: 8 }}>
          {infoOpen ? (
            <TripInfoPanel plan={plan} home={home} onChange={edit} onOpenSettings={() => leave('/settings')} />
          ) : (
            // Collapsed (a saved trip): the trip's frame at a glance; tap to open it for editing.
            <div className="tn-pad">
              <button type="button" className="tl-infocard tl-infosummary" onClick={() => setInfoOpen(true)} aria-label={`${t('tl.basicsTitle')} · ${t('tl.expand')}`}>
                <span className="tl-name">{plan.name || t('editor.name')}</span>
                <span className="tl-line">{`${periodLabel(plan.startDate, plan.endDate)} · ${nightsLabel(plan)}`}</span>
                <span className="tl-meta">{t('tl.routeLine', { start: t('tl.start'), from: endpointName(plan, plan.origin), end: t('tl.home'), to: endpointName(plan, plan.finalDestination) })}</span>
                {nightCount > 0 &&
                  (missingNights > 0 ? (
                    <span className="tl-warn-text">{t('tl.lodgingMissing', { n: missingNights })}</span>
                  ) : (
                    <span className="tl-meta">{t('tl.lodgingCount', { set: nightCount, nights: nightCount })}</span>
                  ))}
              </button>
            </div>
          )}
        </div>
      </section>

      {plan.days.map((d) => (
        <section key={d.dayIndex} id={`day-${d.dayIndex}`} data-day={d.dayIndex} aria-labelledby={`day-${d.dayIndex}-h`}>
          <h2 id={`day-${d.dayIndex}-h`} className="tl-sechead">
            <span className="tl-sechead-title">{`${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}`}</span>
            {attention.has(d.dayIndex) && <span className="tl-dot" role="img" aria-label={t('tl.dayAttention')} />}
            <span style={{ marginLeft: 'auto' }}>
              <Button label={t('tl.map')} variant="secondary" size="sm" onClick={() => setSheet({ kind: 'map', day: d.dayIndex })} />
            </span>
          </h2>
          {/* The last day leaves room so its end card can scroll clear of the floating + button. */}
          <div style={{ paddingTop: 12, paddingBottom: d.dayIndex === plan.days[plan.days.length - 1].dayIndex ? 88 : 16 }}>
            <DayTimeline
              plan={plan}
              home={home}
              dayIndex={d.dayIndex}
              onChange={edit}
              onError={fail}
              onOpenPlace={setOpenPlace}
              onOpenStart={() => setSheet({ kind: 'start', day: d.dayIndex })}
              onOpenLeg={(k) => setSheet({ kind: 'leg', day: d.dayIndex, k })}
              onOpenEnd={() => setSheet({ kind: 'end', day: d.dayIndex })}
            />
          </div>
        </section>
      ))}

      {/* Add a place: to the day in view. The badge counts places collected but on no day yet. */}
      <button
        type="button"
        className="tl-fab"
        onClick={() => setSheet({ kind: 'place' })}
        aria-label={`${t('tl.placeSheet')}${pool.length ? ` · ${t('tl.pool', { n: pool.length })}` : ''}${poolNeedsCare ? ` · ${t('tl.fixedPool')}` : ''}`}>
        <PlusIcon />
        {pool.length > 0 && (
          <span className={`tl-fab-badge${poolNeedsCare ? ' is-warn' : ''}`} aria-hidden="true">
            {pool.length}
          </span>
        )}
      </button>

      {sheet?.kind === 'start' && <StartSheet isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} onChange={edit} onOpenSettings={() => leave('/settings')} />}
      {sheet?.kind === 'leg' && <LegSheet isOpen onClose={close} plan={plan} dayIndex={sheet.day} k={sheet.k} onChange={edit} />}
      {sheet?.kind === 'end' && <EndSheet isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} onChange={edit} onOpenPlace={setOpenPlace} onOpenSettings={() => leave('/settings')} />}
      {sheet?.kind === 'place' && (
        <PlaceSheet
          isOpen
          onClose={close}
          plan={plan}
          initialDay={targetDay}
          onChange={edit}
          onOpenPlace={setOpenPlace}
          onNotice={setNotice}
          onAdded={showDay}
        />
      )}
      {sheet?.kind === 'map' && <SendSheet key={`map${sheet.day}`} isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} mode="map" />}
      {sheet?.kind === 'send' && <SendSheet key={`send${targetDay}`} isOpen onClose={close} plan={plan} home={home} dayIndex={targetDay} mode="send" />}

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
    </NotesContext.Provider>
  );
}

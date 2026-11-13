import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Spinner } from '@astryxdesign/core/Spinner';
import { dayIssues, hhmm, type Home, type Trip } from '@tteonaljido/shared';
import { ChevronIcon, MoreIcon, PlusIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { endpointName } from '../editor/dayInfo';
import { DayTabs } from '../editor/DayTabs';
import { DayTimeline } from '../editor/DayTimeline';
import { FasterOrderCard } from '../editor/FasterOrderCard';
import { LaterStartCard } from '../editor/LaterStartCard';
import { NotesContext } from '../editor/NotesContext';
import { RecommendDialog } from '../editor/RecommendDialog';
import { ShareDialog } from '../editor/ShareDialog';
import { EndSheet } from '../editor/sheets/EndSheet';
import { LegSheet } from '../editor/sheets/LegSheet';
import { PlaceSheet, type Notice } from '../editor/sheets/PlaceSheet';
import { SendSheet } from '../editor/sheets/SendSheet';
import { StartSheet } from '../editor/sheets/StartSheet';
import { TripInfoPanel } from '../editor/TripInfoPanel';
import { TripSetup } from '../editor/TripSetup';
import { VisitDialog } from '../editor/VisitDialog';
import { TRIPS_CHANGED, trips } from '../lib/db';
import { minutesLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { getHere, locate, locateIfAllowed, onHere } from '../lib/here';
import { navigate } from '../lib/router';
import { applyFaster, daySig, dismiss, findFaster, isDismissed, type FasterOrder } from '../lib/fasterOrder';
import { laterSig, laterStart, withDeparture } from '../lib/laterStart';
import { cleanNotes, setNote, type TripNotes } from '../lib/notes';
import { allRuns, applyRun, cleanLegMeters, daySummary, emptyRuns, fetchRun, kmLabel, runSignature } from '../lib/routeTimes';
import { defaultHome } from '../lib/settings';
import { cleanLodgingTbd, cleanSetup, emptyPlan, legKeys, newDoc, nightsLabel, nowIso, placeOf, relinkLegs, rememberLegs, savePlan, unassign, unassignedVisits, visitOf, type LegBook, type TripDoc, type TripSetupState } from '../lib/trips';
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

/** This phone's calendar date as YYYY-MM-DD (to find "today" among the trip's days). */
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Pull distance (after resistance) at which letting go recalculates; the strip never grows past PULL_MAX. */
const PULL_AT = 64;
const PULL_MAX = 96;

/** Section header height under the 56pt top bar: a day counts as "in view" once its header is stuck there. */
// The line under the top bar (56) and the day chip bar (56): a section counts as current once its top reaches it.
const STUCK_AT = 56 + 56 + 8;

/** The plan as stored and shared: a blank name becomes the default one (the transfer needs a name). */
const named = (p: Trip): Trip => (p.name.trim() ? p : { ...p, name: t('trip.defaultName') });

/** Writes the trip to this phone (a new revision only when its content changed) and tells listening lists. */
async function persist(doc: TripDoc, plan: Trip, home: Home | null, notes: TripNotes, legMeters: Record<string, number>, lodgingTbd: number[], setup: TripSetupState | null, fresh = false): Promise<TripDoc> {
  // Notes and distances are phone-only and outside the plan's hash: changing only those keeps the version the car knows.
  // A trip saved for the first time is v1, whatever was typed before (its blank starting doc was never stored).
  const next: TripDoc = {
    ...(fresh ? await newDoc({ ...named(plan), tripId: doc.tripId, revision: 1, updatedAt: nowIso() }, home) : await savePlan(doc, named(plan), home)),
    notes: cleanNotes(notes, new Set(plan.places.map((p) => p.placeRef))),
    legMeters: cleanLegMeters(legMeters, plan),
    lodgingTbd: cleanLodgingTbd(lodgingTbd, plan),
    setup: setup ?? undefined, // phone-only: where a new trip is in its step-by-step setup (M43)
  };
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
 * part you are in. Places are added with the floating + button to the whole trip (M40: a day is set in the place's details;
 * its badge counts the places on no day yet). Every input opens in a bottom sheet; problems show on the node they concern. Below: one action — 저장 while
 * there are unsaved edits, then 경로 보고 차로 보내기. Leaving saves on its own (M29).
 */
export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  // The one home address, set in 설정 and shared by every trip (route checks, map, recommend, what the car may get).
  const [home] = useState(defaultHome);
  // The phone's own position, for a trip that starts from 현재 위치 (M61): session-only, see lib/here.ts.
  const [here, setHereState] = useState(getHere);
  const [locating, setLocating] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** Phone-only memos and lodging check-in/out, by place (saved with the trip, never sent to the car). */
  const [notes, setNotes] = useState<TripNotes>({});
  // Closing a 늦게 출발하기 card is remembered outside React (like 더 빠른 순서); this only makes the screen look again.
  const [, setLaterClosed] = useState(0);
  /** Phone-only recommended-route length per leg key (metres), from Kakao; shown as "· 7.3km" on the travel pills. */
  const [legMeters, setLegMeters] = useState<Record<string, number>>({});
  /** Phone-only: nights marked 미정 (no lodging needed yet, so no warning). */
  const [lodgingTbd, setLodgingTbdState] = useState<number[]>([]);
  /** A new trip's step-by-step setup (M43); null once done (and for trips made before it). */
  const [setup, setSetup] = useState<TripSetupState | null>(null);
  const inSetupRef = useRef(false);
  inSetupRef.current = !!setup && !setup.done; // pull-to-refresh has nothing to recalculate during setup
  /** Pull to refresh: how far the page is pulled down at the top, and whether a recalculation is running. */
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** When Kakao last answered (shown as "as of HH:MM" in the travel-time sheet). */
  const [routeAt, setRouteAt] = useState<Date | null>(null);
  /** Pull-to-refresh during the trip (M43): today's day recomputed from this minute — screen only, never saved. */
  const [liveFrom, setLiveFrom] = useState<{ dayIndex: number; minute: number } | null>(null);
  /** 여행 정보 open for editing: a new trip starts open; a saved one shows its summary until expanded. */
  const [infoOpen, setInfoOpen] = useState(!tripId);
  /** The day whose header is stuck under the top bar (the + button adds there); day 1 while 여행 정보 is in view. */
  const [focusDay, setFocusDay] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Travel times typed this session by pair of places, so reordering does not throw them away. */
  const book = useRef<LegBook>(new Map());
  /** M54 더 빠른 순서: a confirmed shorter order per day; each shape of a day is checked once per session. */
  const [faster, setFaster] = useState<Record<number, FasterOrder>>({});
  const fasterAsked = useRef(new Set<string>());
  const fasterRun = useRef<'idle' | 'busy' | 'again'>('idle');
  // The latest state for saves that happen outside a render: leaving by browser back (unmount) or the app going away.
  const latest = useRef<{ doc: TripDoc | null; plan: Trip | null; notes: TripNotes; legMeters: Record<string, number>; lodgingTbd: number[]; setup: TripSetupState | null; dirty: boolean }>({ doc: null, plan: null, notes: {}, legMeters: {}, lodgingTbd: [], setup: null, dirty: false });
  latest.current = { doc, plan, notes, legMeters, lodgingTbd, setup, dirty };
  /** Auto travel times: only after the user changed something, each empty stretch asked once, stopped if unavailable. */
  const edited = useRef(false);
  const asked = useRef(new Set<string>());
  const routeOff = useRef(false);
  /** Not stored yet (a new trip until its first save); once deleting, nothing may write the trip back. */
  const fresh = useRef(!tripId);
  const deleting = useRef(false);
  /** What the last save wrote, to tell whether anything changed while it ran (a Kakao fill landing mid-save). */
  const lastSaved = useRef<{ plan: Trip | null; notes: TripNotes | null; legMeters: Record<string, number> | null; lodgingTbd: number[] | null }>({ plan: null, notes: null, legMeters: null, lodgingTbd: null });
  const unchangedSinceSave = () =>
    latest.current.plan === lastSaved.current.plan && latest.current.notes === lastSaved.current.notes && latest.current.legMeters === lastSaved.current.legMeters && latest.current.lodgingTbd === lastSaved.current.lodgingTbd;
  /** Saves run one after another so two of them never race on the same revision. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveNow = (): Promise<TripDoc | null> => {
    const run = queue.current.then(async () => {
      const now = latest.current;
      if (deleting.current || !now.dirty || !now.doc || !now.plan) return null;
      now.dirty = false;
      lastSaved.current = { plan: now.plan, notes: now.notes, legMeters: now.legMeters, lodgingTbd: now.lodgingTbd };
      const next = await persist(now.doc, now.plan, home, now.notes, now.legMeters, now.lodgingTbd, now.setup, fresh.current);
      fresh.current = false;
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
      setLegMeters(cleanLegMeters(d.legMeters, d.plan));
      setLodgingTbdState(cleanLodgingTbd(d.lodgingTbd, d.plan));
      // A brand-new trip starts its step-by-step setup; a saved one resumes where it was (or is done).
      setSetup(tripId ? cleanSetup(d.setup) : { done: false, step: 1 });
      book.current = new Map();
      rememberLegs(d.plan, book.current);
      setPlan(d.plan);
    })();
  }, [tripId]);

  // Which section is in view (0 = 여행 정보): the last day section whose top has reached the line under the chip bar.
  const dayCount = plan?.days.length ?? 0;
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = 0;
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
        if (unchangedSinceSave()) setDirty(false); // a fill that landed meanwhile is still unsaved
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
   * Asks Kakao directions for travel times and distances. 'auto' runs after a route change: only empty legs, each stretch
   * once, silent. 'refresh' (pull to refresh, or 이동시간·거리 다시 계산) re-asks every leg between known places and
   * replaces its time — the way to bring typed or old estimates in line with the real route. Answers land only on legs
   * still between the same two places. Legs from or to home are asked too when 설정 has the home address (M39).
   */
  const askKakao = async (mode: 'auto' | 'refresh'): Promise<number | null> => {
    const cur = latest.current.plan;
    if (!cur || (mode === 'auto' && routeOff.current)) return 0;
    const runs = mode === 'refresh' ? allRuns(cur, home) : emptyRuns(cur, home).filter((r) => !asked.current.has(runSignature(r)));
    let filled = 0;
    for (const run of runs) {
      asked.current.add(runSignature(run));
      const result = await fetchRun(run);
      if (!result) {
        routeOff.current = true;
        return null; // directions unavailable right now
      }
      const now = latest.current.plan;
      if (!now) return filled;
      setRouteAt(new Date()); // Kakao answered: the times are as of now
      const out = applyRun(now, run, result, { overwrite: mode === 'refresh' });
      if (Object.entries(out.meters).some(([k, m]) => latest.current.legMeters[k] !== m)) {
        const merged = { ...latest.current.legMeters, ...out.meters };
        latest.current.legMeters = merged;
        setLegMeters(merged);
        setDirty(true);
      }
      filled += out.filled;
      if (out.plan !== now) {
        rememberLegs(out.plan, book.current);
        latest.current.plan = out.plan;
        setPlan(out.plan);
        setDirty(true);
      }
    }
    routeOff.current = false;
    return filled;
  };
  /** Pull to refresh / menu: recalculate the whole trip and say what happened. */
  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const n = await askKakao('refresh');
    setRefreshing(false);
    if (n === null) return setNotice({ tone: 'error', text: t('tl.autoLegsOff') });
    // M43: during the trip, today is recomputed as if leaving now — on this screen only (the plan keeps its times).
    const at = new Date();
    const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    const cur = latest.current.plan;
    const today = cur?.days.find((d) => d.date === localDate(at));
    if (today) {
      setLiveFrom({ dayIndex: today.dayIndex, minute: at.getHours() * 60 + at.getMinutes() });
      return setNotice({ tone: 'success', text: t('tl.liveRecalc', { day: today.dayIndex, time: clock }) });
    }
    setNotice(n ? { tone: 'success', text: t('tl.refreshDoneAt', { n, time: clock }) } : { tone: 'info', text: t('tl.refreshNone') });
  };
  const refreshRef = useRef(refreshAll);
  refreshRef.current = refreshAll;

  // Pull to refresh: at the very top of the editor, pulling down and letting go recalculates every leg with Kakao. Only
  // a downward drag from scroll position 0 counts, never while a sheet, dialog or menu is open or a stop is being dragged.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain'; // the browser's own pull-to-reload would leave the editor
    let g: { x0: number; y0: number; pulling: boolean; dist: number } | null = null;
    // Closed menus and dialogs stay in the DOM (hidden), so only a visible one counts.
    // (checkVisibility is missing before iOS 17.4, so fall back to <dialog open> / layout boxes.)
    const shown = (el: HTMLElement) => (el instanceof HTMLDialogElement ? el.open : typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0);
    const covered = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], dialog')].some(shown);
    const onStart = (e: TouchEvent) => {
      g = null;
      if (inSetupRef.current || e.touches.length !== 1 || window.scrollY > 0 || covered() || (e.target as Element).closest?.('.tl-handle')) return;
      g = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, pulling: false, dist: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!g) return;
      const dx = e.touches[0].clientX - g.x0;
      const dy = e.touches[0].clientY - g.y0;
      if (!g.pulling) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dy <= 0 || Math.abs(dx) >= dy || window.scrollY > 0) return void (g = null); // scrolling or swiping a card
        g.pulling = true;
      }
      if (e.cancelable) e.preventDefault();
      g.dist = Math.min(PULL_MAX, Math.max(0, dy) * 0.55);
      setPull(g.dist);
    };
    const onEnd = () => {
      if (g?.pulling && g.dist >= PULL_AT) void refreshRef.current();
      if (g?.pulling) setPull(0);
      g = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      root.style.overscrollBehaviorY = before;
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  // After an edit that left legs empty (a stop moved, added or removed; lodging or an end changed), fill them shortly after.
  // Opening a trip fills its empty legs once too (e.g. the legs to and from home in a trip made before M39); a time the
  // user typed is never replaced here.
  const opened = useRef(false);
  useEffect(() => {
    if (!plan) return;
    if (!edited.current && opened.current) return;
    opened.current = true;
    const timer = setTimeout(() => void askKakao('auto'), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // A trip that starts from 현재 위치 (M61): its first leg is timed from where this phone is. The position is asked
  // without a prompt when the browser already allows it; otherwise the first leg's sheet offers [현재 위치로 계산].
  // When the position arrives, the leg it unlocks is filled like any other empty leg.
  const startsHere = plan?.origin.kind === 'CURRENT';
  useEffect(() => onHere(setHereState), []);
  useEffect(() => {
    if (startsHere) void locateIfAllowed();
  }, [startsHere]);
  useEffect(() => {
    if (!here || !startsHere) return;
    const timer = setTimeout(() => void askKakao('auto'), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, startsHere]);
  const locateNow = async () => {
    setLocating(true);
    const r = await locate();
    setLocating(false);
    if (!r.ok) setNotice({ tone: 'error', text: t(r.reason === 'denied' ? 'tl.locateDenied' : 'tl.locateFailed') });
  };

  // M54: once a day's legs are timed, look for a faster order (straight lines first; Kakao only for a real candidate).
  const checkFaster = async () => {
    if (fasterRun.current !== 'idle') return void (fasterRun.current = 'again');
    fasterRun.current = 'busy';
    try {
      for (const d of latest.current.plan?.days ?? []) {
        const cur = latest.current.plan;
        if (!cur || inSetupRef.current) break;
        const sig = daySig(cur, home, d.dayIndex);
        const owner = latest.current.doc?.tripId ?? 'new';
        if (fasterAsked.current.has(sig) || isDismissed(owner, sig)) continue;
        const s = await findFaster(cur, home, d.dayIndex, book.current, fetchRun);
        if (s === 'wait') continue; // asked again once the day's travel times are in
        fasterAsked.current.add(sig);
        const now = latest.current.plan;
        if (s && now && daySig(now, home, d.dayIndex) === s.sig) setFaster((f) => ({ ...f, [d.dayIndex]: s }));
      }
    } finally {
      const again = (fasterRun.current as string) === 'again'; // set by a call made while this one ran
      fasterRun.current = 'idle';
      if (again) void checkFaster();
    }
  };
  useEffect(() => {
    if (!plan || refreshing) return;
    const timer = setTimeout(() => void checkFaster(), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, refreshing]);

  // Days with something to fix get a dot on their header: a timetable conflict or a night without lodging.
  const attention = useMemo(() => {
    if (!plan) return new Set<number>();
    const last = plan.days.length - 1;
    return new Set(plan.days.filter((d, i) => (i < last && !d.lodgingPlaceRef && !lodgingTbd.includes(d.dayIndex)) || dayIssues(plan, d.dayIndex).some((x) => x.severity === 'CONFLICT')).map((d) => d.dayIndex));
  }, [plan, lodgingTbd]);
  if (!plan || !doc) return <Spinner />;

  const nightCount = plan.days.length - 1;
  const missingNights = plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef && !lodgingTbd.includes(d.dayIndex)).length; // 미정 nights are fine
  const tbdNights = plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef && lodgingTbd.includes(d.dayIndex)).length;
  /** A new trip still in its step-by-step setup (M43): the days stay hidden until the route plan is applied. */
  const inSetup = !!setup && !setup.done;
  const pool = unassignedVisits(plan);
  /** Legs Kakao can measure (both ends located; home only with an address in 설정) — the rest the car's navigation times. */
  const askableLegs = new Set(allRuns(plan, home).flatMap((r) => r.keys));
  const poolNeedsCare = pool.some((v) => v.fixed);
  const targetDay = plan.days.some((d) => d.dayIndex === focusDay) ? focusDay : plan.days[0].dayIndex;
  // A day at a glance under its heading (M45): driving total · Kakao km · when the day ends · legs still without a time.
  const summaryLine = (dayIndex: number) => {
    const s = daySummary(plan, dayIndex, legMeters, liveFrom?.dayIndex === dayIndex ? liveFrom.minute : undefined);
    const last = dayIndex === plan.days[plan.days.length - 1].dayIndex;
    const rest = [
      s.meters !== null ? kmLabel(s.meters) : '',
      s.endAt !== null ? t(last ? 'tl.daySummary.home' : 'tl.daySummary.lodging', { time: hhmm(s.endAt) }) : '',
      s.unknownLegs > 0 ? t('tl.daySummary.unknown', { n: s.unknownLegs }) : '',
    ].filter(Boolean);
    // M54: the day's driving time leads, in bold; the rest stays quiet.
    const drive = s.driveMinutes > 0 ? <strong className="tl-sum-drive">{t('tl.daySummary.drive', { time: minutesLabel(s.driveMinutes) })}</strong> : null;
    if (!drive) return rest.join(' · ');
    return (
      <>
        {drive}
        {rest.length > 0 && ` · ${rest.join(' · ')}`}
      </>
    );
  };
  // Day chip bar: jump to a section, landing just under the stuck bars (scroll-margin-top in timeline.css).
  const jumpTo = (day: number) => document.getElementById(day === 0 ? 'trip-info' : `day-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const edit = (p: Trip) => {
    const linked = relinkLegs(latest.current.plan ?? plan, p, book.current);
    rememberLegs(linked, book.current);
    latest.current.plan = linked; // a second edit before the next render builds on this one
    setPlan(linked);
    setDirty(true);
    edited.current = true;
    setLiveFrom(null); // a "from now" view no longer matches an edited plan
    setNotice((n) => (n?.undo ? null : n)); // once something else changed, an old 되돌리기 would undo that too
  };
  const fail = (m: string) => setNotice({ tone: 'error', text: m });
  const dropFaster = (dayIndex: number) =>
    setFaster((f) => {
      const next = { ...f };
      delete next[dayIndex];
      return next;
    });
  /** [바꾸기] on a 더 빠른 순서 card: the new order with its Kakao times; 되돌리기 puts the day back. */
  const applyFasterOrder = (s: FasterOrder) => {
    const before = latest.current.plan;
    if (!before) return;
    const next = applyFaster(before, s);
    rememberLegs(next, book.current); // so edit() keeps the Kakao times on the new legs
    edit(next);
    const merged = { ...latest.current.legMeters, ...s.meters };
    latest.current.legMeters = merged;
    setLegMeters(merged);
    dropFaster(s.dayIndex);
    setNotice({ tone: 'info', text: t('tl.faster.applied', { time: minutesLabel(s.saved) }), undo: () => edit(before) });
  };
  /** Takes a stop off its day (it waits in 보관함) and offers 되돌리기, which puts the plan back as it was. */
  const removeStop = (visitId: string) => {
    const before = latest.current.plan ?? plan;
    const v = visitOf(before, visitId);
    if (!v) return;
    try {
      edit(unassign(before, visitId));
    } catch (e) {
      return fail((e as Error).message);
    }
    setNotice({ tone: 'info', text: t('tl.removedStop', { name: placeOf(before, v.placeRef)?.name ?? '' }), undo: () => edit(before) });
  };
  const notesApi = {
    notes,
    setNote: (placeRef: string, patch: Parameters<typeof setNote>[2]) => {
      setNotes((n) => setNote(n, placeRef, patch));
      setDirty(true);
    },
    lodgingTbd,
    /** 미정 on a night: its lodging is no longer required (no red card, no warning); choosing a lodging lifts it. */
    setLodgingTbd: (dayIndex: number, on: boolean) => {
      setLodgingTbdState((cur) => (on ? [...new Set([...cur, dayIndex])].sort((a, b) => a - b) : cur.filter((n) => n !== dayIndex)));
      setDirty(true);
    },
  };

  const save = async () => {
    const wasDirty = dirty;
    latest.current = { doc, plan, notes, legMeters, lodgingTbd, setup, dirty: true };
    const next = (await saveNow()) ?? doc;
    setDoc(next);
    if (unchangedSinceSave()) {
      setPlan(next.plan);
      setDirty(false);
    }
    // A memo or distance change keeps the version (phone-only) but was still saved.
    setNotice({ tone: 'success', text: !wasDirty && tripId ? t('editor.noChanges') : t('editor.saved', { revision: next.revision }) });
    if (!tripId) navigate(`/trips/${next.tripId}`, true);
  };

  /** Makes a copy of the current trip (places, days, home and all) as a new trip and opens it. The original is untouched. */
  const duplicate = async () => {
    if (dirty) await save(); // keep unsaved edits in the original too, not only in the copy
    const clone: Trip = { ...structuredClone(plan), tripId: crypto.randomUUID(), name: t('trip.copyName', { name: named(plan).name }).slice(0, 60), revision: 1, updatedAt: nowIso() };
    // The copy keeps its memos and distances (same places, same legs).
    const nd: TripDoc = { ...(await newDoc(clone, home)), notes: cleanNotes(notes), legMeters: cleanLegMeters(legMeters, clone), lodgingTbd: cleanLodgingTbd(lodgingTbd, clone) };
    await trips.put(nd);
    navigate(`/trips/${nd.tripId}`);
  };

  /** Leave the editor (back to the trips tab, or to 설정 to change a start place); unsaved edits are saved first. */
  const leave = async (to = '/') => {
    const next = await saveNow();
    // A new trip now exists under its own address: put that on this history entry so Back reopens it, not a blank trip.
    if (next && location.pathname === '/trips/new') history.replaceState(null, '', `/trips/${next.tripId}`);
    navigate(to);
  };
  const close = () => setSheet(null);

  const menuItems = [
    { label: t('recommend.button'), onClick: () => setRecommending(true) },
    { label: t('tl.recalc'), onClick: () => void refreshAll() },
    ...(tripId ? [{ label: t('trip.duplicate'), onClick: () => void duplicate() }] : []),
    { label: t('share.button'), onClick: () => setSharing(true) },
    ...(tripId ? [{ type: 'divider' as const }, { label: t('editor.delete'), onClick: () => setConfirmDelete(true) }] : []),
  ];

  // Top bar (M53): only the dates and n박 n일. The name lives in the 여행 정보 card; tapping the dates still goes to it.
  const period = t('tl.summary', { period: shortPeriod(plan.startDate, plan.endDate), nights: nightsLabel(plan) });
  const title = (
    <button
      type="button"
      className="tl-title"
      onClick={() => {
        if (!inSetup) setInfoOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label={`${period} · ${t('tl.editBasics')}`}>
      {period}
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
      cta={inSetup ? undefined : cta}>
      {(pull > 0 || refreshing) && (
        <div className="tl-ptr" style={{ height: refreshing ? 48 : pull }} role="status">
          {refreshing ? (
            <>
              <Spinner size="sm" />
              {t('tl.refreshing')}
            </>
          ) : (
            <>
              <span className={`tl-ptr-arrow${pull >= PULL_AT ? ' is-ready' : ''}`} aria-hidden="true">
                ↓
              </span>
              {pull >= PULL_AT ? t('tl.refreshRelease') : t('tl.refreshPull')}
            </>
          )}
        </div>
      )}
      {notice && !notice.undo && (
        <div className="tn-pad" style={{ paddingTop: 12 }}>
          <Banner status={notice.tone} title={notice.text} isDismissable onDismiss={() => setNotice(null)} />
        </div>
      )}
      {/* A notice with 되돌리기 floats above the bottom bar, so it is seen wherever the stop was swiped away. */}
      <div role="status">
        {notice?.undo && (
          <UndoSnackbar
            text={notice.text}
            onUndo={() => {
              notice.undo?.();
              setNotice(null);
            }}
            onClose={() => setNotice(null)}
          />
        )}
      </div>

      {inSetup ? (
        <TripSetup
          plan={plan}
          home={home}
          step={setup!.step}
          onStep={(step) => {
            setSetup({ done: false, step });
            setDirty(true);
          }}
          onChange={edit}
          onOpenPlace={setOpenPlace}
          onNotice={setNotice}
          onOpenSettings={() => leave('/settings')}
          onFinish={(result) => {
            if (result) {
              rememberLegs(result.plan, book.current); // so edit() keeps the Kakao times on the new legs
              setRouteAt(new Date());
              edit(result.plan);
              const merged = { ...latest.current.legMeters, ...result.meters };
              latest.current.legMeters = merged;
              setLegMeters(merged);
            }
            setSetup(null); // done: from here the trip shows its days
            setDirty(true);
            setInfoOpen(false);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <>
        <DayTabs days={plan.days.map((d) => d.dayIndex)} active={focusDay} onPick={jumpTo} />
        <section id="trip-info" aria-labelledby="trip-info-h" className={`tl-section tl-info${infoOpen ? ' is-open' : ''}`}>
          {infoOpen ? (
            <div className="tl-sechead">
              <h2 id="trip-info-h" className="tl-sechead-title">
                {t('tl.basicsTitle')}
              </h2>
              <button type="button" className="tl-textbtn tl-toggle" aria-expanded="true" aria-controls="trip-info-body" onClick={() => setInfoOpen(false)}>
                {t('tl.collapse')}
                <span className="tl-chev is-open" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
            </div>
          ) : (
            // Collapsed (M53): no heading row — the chip bar names this section. One two-line card is the toggle.
            <h2 id="trip-info-h" className="tn-sr-only">
              {t('tl.basicsTitle')}
            </h2>
          )}
          <div id="trip-info-body">
            {infoOpen ? (
              <div style={{ paddingTop: 4, paddingBottom: 8 }}>
                <TripInfoPanel plan={plan} home={home} onChange={edit} onOpenSettings={() => leave('/settings')} />
              </div>
            ) : (
              <div className="tn-pad">
                <button
                  type="button"
                  className="tl-infocard tl-infosummary"
                  aria-expanded="false"
                  aria-controls="trip-info-body"
                  onClick={() => setInfoOpen(true)}
                  aria-label={`${t('tl.basicsTitle')} · ${t('tl.expand')}`}>
                  <span className="tl-infosum-top">
                    <span className="tl-infosum-name">{plan.name || t('editor.name')}</span>
                    {missingNights > 0 && <span className="tl-dot" role="img" aria-label={t('tl.dayAttention')} />}
                    <span className="tl-chev" aria-hidden="true">
                      <ChevronIcon />
                    </span>
                  </span>
                  <span className="tl-infosum-meta">
                    <span>{t('tl.routeShort', { from: endpointName(plan, plan.origin), to: endpointName(plan, plan.finalDestination) })}</span>
                    {nightCount > 0 &&
                      (missingNights > 0 ? (
                        <span className="tl-required-text">{t('tl.lodgingMissing', { n: missingNights })}</span>
                      ) : (
                        <span>{tbdNights > 0 ? t('tl.lodgingCountTbd', { set: nightCount - tbdNights, nights: nightCount, tbd: tbdNights }) : t('tl.lodgingCount', { set: nightCount, nights: nightCount })}</span>
                      ))}
                    {tripId && <span className="tl-infosum-rev">{`v${doc.revision}`}</span>}
                  </span>
                </button>
              </div>
            )}
          </div>
        </section>

        {plan.days.map((d) => (
          <section key={d.dayIndex} id={`day-${d.dayIndex}`} data-day={d.dayIndex} aria-labelledby={`day-${d.dayIndex}-h`} className="tl-section">
            {/* Day heading (M45): the day, its summary line from the Kakao times, and the map. Not sticky — the chip bar is. */}
            <div className="tl-sechead">
              <div className="tl-sechead-text">
                <h2 id={`day-${d.dayIndex}-h`} className="tl-sechead-title">
                  {`${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}`}
                  {attention.has(d.dayIndex) && <span className="tl-dot" role="img" aria-label={t('tl.dayAttention')} />}
                </h2>
                <p className="tl-sechead-sum">{summaryLine(d.dayIndex)}</p>
              </div>
              <Button label={t('tl.map')} variant="secondary" size="sm" onClick={() => setSheet({ kind: 'map', day: d.dayIndex })} />
            </div>
            {(() => {
              const s = faster[d.dayIndex];
              if (!s || s.sig !== daySig(plan, home, d.dayIndex)) return null;
              return (
                <FasterOrderCard
                  dayIndex={d.dayIndex}
                  saved={s.saved}
                  names={s.order.map((id) => placeOf(plan, visitOf(plan, id)?.placeRef ?? '')?.name ?? id)}
                  onApply={() => applyFasterOrder(s)}
                  onDismiss={() => {
                    dismiss(doc.tripId, s.sig);
                    dropFaster(d.dayIndex);
                  }}
                />
              );
            })()}
            {(() => {
              // 늦게 출발하기: an hour or more to spare before the day's first fixed time, within the lodging's check-out.
              const s = laterStart(plan, d.dayIndex, notes);
              if (!s || isDismissed(doc.tripId, laterSig(s))) return null;
              return (
                <LaterStartCard
                  s={s}
                  name={placeOf(plan, visitOf(plan, s.visitId)?.placeRef ?? '')?.name ?? ''}
                  onApply={() => edit(withDeparture(plan, d.dayIndex, s.to))}
                  onDismiss={() => {
                    dismiss(doc.tripId, laterSig(s));
                    setLaterClosed((n) => n + 1);
                  }}
                />
              );
            })()}
            {/* The last day leaves room so its end card can scroll clear of the floating + button. */}
            <div style={{ paddingTop: 4, paddingBottom: d.dayIndex === plan.days[plan.days.length - 1].dayIndex ? 88 : 8 }}>
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
                onRemoveStop={removeStop}
                legMeters={legMeters}
                startAt={liveFrom?.dayIndex === d.dayIndex ? liveFrom.minute : undefined}
              askable={askableLegs}
              />
            </div>
          </section>
        ))}

        {/* Add a place: to the whole trip (its day is set in the place's details). The badge counts places on no day yet. */}
        <button
          type="button"
          className={`tl-fab${notice?.undo ? ' is-raised' : ''}`}
          onClick={() => setSheet({ kind: 'place' })}
          aria-label={`${t('tl.placeSheet')}${pool.length ? ` · ${t('tl.pool', { n: pool.length })}` : ''}${poolNeedsCare ? ` · ${t('tl.fixedPool')}` : ''}`}>
          <PlusIcon />
          {pool.length > 0 && (
            <span className={`tl-fab-badge${poolNeedsCare ? ' is-warn' : ''}`} aria-hidden="true">
              {pool.length}
            </span>
          )}
        </button>
        </>
      )}

      {sheet?.kind === 'start' && <StartSheet isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} onChange={edit} onOpenSettings={() => leave('/settings')} />}
      {sheet?.kind === 'leg' && (
        <LegSheet
          isOpen
          onClose={close}
          plan={plan}
          dayIndex={sheet.day}
          k={sheet.k}
          legMeters={legMeters}
          askable={askableLegs.has(legKeys(plan, sheet.day)[sheet.k] ?? '')}
          routeAt={routeAt}
          refreshing={refreshing}
          onRecalc={() => void refreshAll()}
          // The trip's first leg, when its start is not a point yet: say what would time it and offer that.
          help={
            sheet.day !== 1 || sheet.k !== 0 || askableLegs.has(legKeys(plan, 1)[0] ?? '') ? undefined
            : plan.origin.kind === 'CURRENT' ? { text: t('tl.legFromHere'), action: t('tl.legLocate'), busy: locating, onAction: () => void locateNow() }
            : plan.origin.kind === 'HOME' && !home ? { text: t('tl.legNeedsHome'), action: t('tl.legSetHome'), onAction: () => void leave('/settings/place/home') }
            : undefined
          }
        />
      )}
      {sheet?.kind === 'end' && <EndSheet isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} onChange={edit} onOpenPlace={setOpenPlace} onOpenSettings={() => leave('/settings')} />}
      {sheet?.kind === 'place' && (
        <PlaceSheet isOpen onClose={close} plan={plan} onChange={edit} onOpenPlace={setOpenPlace} onNotice={setNotice} />
      )}
      {sheet?.kind === 'map' && <SendSheet key={`map${sheet.day}`} isOpen onClose={close} plan={plan} home={home} dayIndex={sheet.day} mode="map" />}
      {sheet?.kind === 'send' && <SendSheet key={`send${targetDay}`} isOpen onClose={close} plan={plan} home={home} dayIndex={targetDay} mode="send" />}

      <VisitDialog plan={plan} placeRef={openPlace} onChange={edit} onUnassign={removeStop} onError={fail} onClose={() => setOpenPlace(null)} />
      <RecommendDialog isOpen={recommending} plan={plan} home={home} book={book.current} onApply={edit} onClose={() => setRecommending(false)} />
      <ShareDialog isOpen={sharing} doc={{ ...doc, plan: named(plan), home }} onClose={() => setSharing(false)} />
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('editor.delete.title')}
        description={t('editor.delete.description')}
        actionLabel={t('editor.delete.action')}
        actionVariant="destructive" // the confirm step of a destructive action: the negative fill (design/TOSS.md §5)
        onAction={async () => {
          deleting.current = true; // deleting: nothing may save the trip back on the way out (a re-render resets `dirty`)
          await trips.remove(doc.tripId);
          navigate('/', true);
        }}
      />
    </PushScreen>
    </NotesContext.Provider>
  );
}

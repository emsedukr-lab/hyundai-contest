import {
  addDays,
  buildTransfer,
  contentHash,
  dayIssues,
  epochDay,
  TRANSFER_LIMITS,
  type Day,
  type DayIssue,
  type Endpoint,
  type Home,
  type Place,
  type Trip,
  type TripTransfer,
  type Visit,
} from '@tteonaljido/shared';
import { t } from './i18n';
import type { TripNotes } from './notes';

/**
 * A trip as kept on this phone. `plan` is the editable trip in transfer shape (home always null);
 * the home address lives beside it and is only copied into a transfer when the user agrees.
 */
export interface TripDoc {
  tripId: string;
  revision: number;
  updatedAt: string;
  planHash: string;
  plan: Trip;
  home: Home | null;
  /** Phone-only notes per place (memo, lodging check-in/out); never part of the transfer. */
  notes?: TripNotes;
  /** Phone-only recommended-route length per leg ("from>to" → metres), from Kakao directions; never part of the transfer. */
  legMeters?: Record<string, number>;
  /**
   * Phone-only (M41): nights whose lodging the user marked 미정 — no lodging needed yet, so no warning. Day indexes of
   * nights (1…days-1) that still have no lodging; outside the plan's hash, never sent (the car sees an empty night).
   */
  lodgingTbd?: number[];
  /**
   * Phone-only (M43): where a new trip is in its step-by-step setup (1 정보 · 2 장소 · 3 예약·꼭 · 4 경로 추천). Until
   * `done`, the editor shows the setup instead of the days. Missing on trips made before — those count as done.
   */
  setup?: TripSetupState;
}

const rand = () => Math.random().toString(36).slice(2, 10);
export const newRef = (prefix: string) => `${prefix}${rand()}`;

export const nowIso = () => {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
};

export const todayIn = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

/** Hash of what the plan says, ignoring bookkeeping fields, so saving an unchanged plan never bumps the revision. */
export const planHash = (plan: Trip) => contentHash({ ...plan, revision: 0, updatedAt: '', home: null });

const emptyDay = (dayIndex: number, date: string): Day => ({ dayIndex, date, departTime: dayIndex === 1 ? null : '09:00', endBy: null, visitOrder: [], legs: [null], lodgingPlaceRef: null });

export function emptyPlan(tripId: string = crypto.randomUUID()): Trip {
  const start = addDays(todayIn('Asia/Seoul'), 7);
  return {
    tripId,
    revision: 1,
    updatedAt: nowIso(),
    name: t('trip.defaultName'),
    timezone: 'Asia/Seoul',
    startDate: start,
    endDate: addDays(start, 1),
    firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
    origin: { kind: 'HOME' },
    finalDestination: { kind: 'HOME' },
    home: null,
    places: [],
    visits: [],
    days: [emptyDay(1, start), emptyDay(2, addDays(start, 1))],
  };
}

export async function newDoc(plan: Trip, home: Home | null = null): Promise<TripDoc> {
  const clean = { ...plan, home: null };
  return { tripId: plan.tripId, revision: plan.revision, updatedAt: plan.updatedAt, planHash: await planHash(clean), plan: clean, home };
}

/** Saves an edited plan: the revision goes up only when the plan's content actually changed. */
export async function savePlan(doc: TripDoc, plan: Trip, home: Home | null): Promise<TripDoc> {
  const clean = { ...plan, tripId: doc.tripId, home: null };
  const hash = await planHash(clean);
  if (hash === doc.planHash) return { ...doc, home, plan: { ...clean, revision: doc.revision, updatedAt: doc.updatedAt } };
  const revision = doc.revision + 1;
  const updatedAt = nowIso();
  return { tripId: doc.tripId, revision, updatedAt, planHash: hash, plan: { ...clean, revision, updatedAt }, home };
}

/** The only path from a stored trip to the wire: a whitelist copy, home only with consent. */
export function toTransfer(doc: TripDoc, includeHome: boolean): Promise<TripTransfer> {
  const trip: Trip = { ...doc.plan, tripId: doc.tripId, revision: doc.revision, updatedAt: doc.updatedAt, home: includeHome ? doc.home : null };
  return buildTransfer(trip, nowIso());
}

/* ---------- edit operations (pure; return a new plan) ---------- */

const mapDay = (plan: Trip, dayIndex: number, f: (d: Day) => Day): Trip => ({ ...plan, days: plan.days.map((d) => (d.dayIndex === dayIndex ? f(d) : d)) });
const patchVisit = (plan: Trip, visitId: string, patch: Partial<Visit>): Trip => ({ ...plan, visits: plan.visits.map((v) => (v.visitId === visitId ? { ...v, ...patch } : v)) });

export const dayCount = (start: string, end: string) => epochDay(end) - epochDay(start) + 1;

/** Changes the period. Day N keeps day N's plan; visits on days that no longer exist become unassigned. */
export function setPeriod(plan: Trip, start: string, end: string): Trip {
  const n = dayCount(start, end);
  if (n < 1 || n > TRANSFER_LIMITS.maxDays) throw new Error(t('trip.error.period', { max: TRANSFER_LIMITS.maxDays }));
  const days = Array.from({ length: n }, (_, i) => {
    const old = plan.days[i];
    return old ? { ...old, dayIndex: i + 1, date: addDays(start, i) } : emptyDay(i + 1, addDays(start, i));
  });
  const dropped = new Set(plan.days.slice(n).flatMap((d) => d.visitOrder));
  return {
    ...plan,
    startDate: start,
    endDate: end,
    days,
    visits: plan.visits.map((v) => (dropped.has(v.visitId) ? { ...v, unassignedReason: 'OUTSIDE_PERIOD' } : v)),
  };
}

/** How many more places this trip can take before the transfer limits (100 places, 100 visits) would be broken. */
export const placeRoom = (plan: Trip) => Math.max(0, Math.min(TRANSFER_LIMITS.maxPlaces - plan.places.length, TRANSFER_LIMITS.maxVisits - plan.visits.length));

export function addPlace(plan: Trip, p: Omit<Place, 'placeRef'>, stayMinutes = 60): Trip {
  // Past the limits the car would refuse the whole trip at the very end; stop here, where the user can still act.
  if (placeRoom(plan) <= 0) throw new Error(t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces }));
  const placeRef = newRef('p');
  const place: Place = { ...p, placeRef };
  const visits =
    p.category === 'LODGING'
      ? plan.visits
      : [
          ...plan.visits,
          {
            visitId: newRef('v'),
            placeRef,
            stayMinutes,
            prepMinutes: 0,
            importance: 'NORMAL' as const,
            desiredTime: null,
            fixed: null,
            dateFlexible: true,
            timeFlexible: true,
            unassignedReason: 'NOT_SCHEDULED_YET' as const,
          },
        ];
  return { ...plan, places: [...plan.places, place], visits };
}

/** A place that is only a start or end point: not lodging and no visit (nobody stops there on the way). */
export const isEndpointOnly = (plan: Trip, placeRef: string) => {
  const p = plan.places.find((x) => x.placeRef === placeRef);
  return !!p && p.category !== 'LODGING' && !plan.visits.some((v) => v.placeRef === placeRef);
};

/** The trip's two ends: where day 1 starts and where the last day ends. */
export type EndpointSide = 'origin' | 'finalDestination';

/**
 * Sets one end of the trip. A place that existed only to be the old end (endpoint-only, not the other end or any
 * night's lodging) is dropped with it, so trying 회사 then 즐겨찾기 doesn't leave stray places behind.
 */
export function setEndpoint(plan: Trip, which: EndpointSide, endpoint: Endpoint): Trip {
  const prev = plan[which];
  const next: Trip = { ...plan, [which]: endpoint };
  if (prev.kind !== 'PLACE' || (endpoint.kind === 'PLACE' && endpoint.placeRef === prev.placeRef)) return next;
  const ref = prev.placeRef;
  const other = next[which === 'origin' ? 'finalDestination' : 'origin'];
  const stillUsed = (other.kind === 'PLACE' && other.placeRef === ref) || next.days.some((d) => d.lodgingPlaceRef === ref);
  return isEndpointOnly(next, ref) && !stillUsed ? removePlace(next, ref) : next;
}

/** Sets the first-day start (see [setEndpoint]). */
export const setOrigin = (plan: Trip, origin: Endpoint): Trip => setEndpoint(plan, 'origin', origin);

/** A saved place (설정 › 회사, 즐겨찾기): name plus address and coordinates. */
export type StartPreset = Home & { name: string };

/** The trip's copy of a saved place, matched by name and coordinates. */
export const presetInPlan = (plan: Trip, preset: StartPreset) =>
  plan.places.find((p) => p.latE7 === preset.latE7 && p.lonE7 === preset.lonE7 && p.name === preset.name.slice(0, TRANSFER_LIMITS.nameMax));

/**
 * Starts or ends the trip at a saved place. The transfer only knows HOME or a place of the trip, so the preset joins
 * the trip as an endpoint-only place (no visit: the day begins or ends there, nobody stops there on the way) — or the
 * copy already there is reused, so starting and ending at 회사 shares one place.
 */
export function endpointFromPreset(plan: Trip, which: EndpointSide, preset: StartPreset): Trip {
  const same = presetInPlan(plan, preset);
  if (same) return setEndpoint(plan, which, { kind: 'PLACE', placeRef: same.placeRef });
  const place: Place = {
    placeRef: newRef('p'),
    name: preset.name.slice(0, TRANSFER_LIMITS.nameMax),
    address: preset.address.slice(0, TRANSFER_LIMITS.addressMax),
    latE7: preset.latE7,
    lonE7: preset.lonE7,
    category: 'OTHER',
    source: { provider: 'MANUAL', externalId: null },
    naviPoi: null,
    hours: { status: 'UNKNOWN' },
  };
  return setEndpoint({ ...plan, places: [...plan.places, place] }, which, { kind: 'PLACE', placeRef: place.placeRef });
}

/** Starts the trip from a saved place (see [endpointFromPreset]). */
export const startFromPreset = (plan: Trip, preset: StartPreset): Trip => endpointFromPreset(plan, 'origin', preset);

export function removePlace(plan: Trip, placeRef: string): Trip {
  let next = plan;
  for (const v of plan.visits.filter((v) => v.placeRef === placeRef)) next = unassign(next, v.visitId);
  return {
    ...next,
    places: next.places.filter((p) => p.placeRef !== placeRef),
    visits: next.visits.filter((v) => v.placeRef !== placeRef),
    days: next.days.map((d) => (d.lodgingPlaceRef === placeRef ? { ...d, lodgingPlaceRef: null } : d)),
    origin: next.origin.kind === 'PLACE' && next.origin.placeRef === placeRef ? { kind: 'HOME' } : next.origin,
    finalDestination: next.finalDestination.kind === 'PLACE' && next.finalDestination.placeRef === placeRef ? { kind: 'HOME' } : next.finalDestination,
  };
}

/** Removes a visit from its day. The travel time across the gap is unknown until re-entered. */
export function unassign(plan: Trip, visitId: string, reason: Visit['unassignedReason'] = 'NOT_SCHEDULED_YET'): Trip {
  const days = plan.days.map((d) => {
    const k = d.visitOrder.indexOf(visitId);
    if (k < 0) return d;
    return { ...d, visitOrder: d.visitOrder.filter((id) => id !== visitId), legs: [...d.legs.slice(0, k), null, ...d.legs.slice(k + 2)] };
  });
  return patchVisit({ ...plan, days }, visitId, { unassignedReason: reason });
}

export function assign(plan: Trip, visitId: string, dayIndex: number): Trip {
  const cleared = plan.visits.find((v) => v.visitId === visitId)?.unassignedReason === null ? unassign(plan, visitId) : plan;
  const day = cleared.days.find((d) => d.dayIndex === dayIndex);
  if (!day) return plan;
  if (day.visitOrder.length >= TRANSFER_LIMITS.maxVisitsPerDay) throw new Error(t('trip.error.dayFull', { max: TRANSFER_LIMITS.maxVisitsPerDay }));
  const n = day.visitOrder.length;
  const placed = mapDay(cleared, dayIndex, (d) => ({ ...d, visitOrder: [...d.visitOrder, visitId], legs: [...d.legs.slice(0, n), null, null] }));
  return patchVisit(placed, visitId, { unassignedReason: null });
}

/** Puts a visit on a day from its place details (M40): to the end of that day; already there → unchanged. */
export function moveToDay(plan: Trip, visitId: string, dayIndex: number): Trip {
  const current = plan.days.find((d) => d.visitOrder.includes(visitId))?.dayIndex;
  return current === dayIndex ? plan : assign(plan, visitId, dayIndex);
}

export function move(plan: Trip, dayIndex: number, k: number, dir: -1 | 1): Trip {
  return mapDay(plan, dayIndex, (d) => {
    const j = k + dir;
    if (j < 0 || j >= d.visitOrder.length) return d;
    const order = [...d.visitOrder];
    [order[k], order[j]] = [order[j], order[k]];
    const touched = new Set([k, k + 1, j, j + 1]);
    return { ...d, visitOrder: order, legs: d.legs.map((l, i) => (touched.has(i) ? null : l)) };
  });
}

/** Moves one stop from index `from` to index `to` (drag-and-drop). Like [move] it clears the legs whose endpoints changed. */
export function moveTo(plan: Trip, dayIndex: number, from: number, to: number): Trip {
  return mapDay(plan, dayIndex, (d) => {
    if (from === to || from < 0 || to < 0 || from >= d.visitOrder.length || to >= d.visitOrder.length) return d;
    const order = [...d.visitOrder];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    // legs[i] is the leg into position i; everything between the two positions gets new neighbours, so null [lo, hi+1].
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    return { ...d, visitOrder: order, legs: d.legs.map((l, i) => (i >= lo && i <= hi + 1 ? null : l)) };
  });
}

/**
 * A day's timetable issues sorted by where the timeline shows them: a stop's card (issues naming a visit), the start
 * node (leaving before midnight), the end node (arriving after the target time), or the day itself (anything else).
 */
export function nodeIssues(plan: Trip, dayIndex: number, severity: DayIssue['severity'] = 'CONFLICT') {
  const out = { start: [] as DayIssue[], end: [] as DayIssue[], byVisit: {} as Record<string, DayIssue[]>, other: [] as DayIssue[] };
  for (const i of dayIssues(plan, dayIndex)) {
    if (i.severity !== severity) continue;
    if (i.visitId) (out.byVisit[i.visitId] ??= []).push(i);
    else if (i.code === 'DEPART_PREVIOUS_DAY') out.start.push(i);
    else if (i.code === 'PAST_END_BY') out.end.push(i);
    else out.other.push(i);
  }
  return out;
}

/**
 * Where a place picked from the timeline's "+ 장소 추가" landed: on the day, as that night's lodging, kept in the trip
 * (a lodging when the night already has one, or on the last day), or in the 보관함 because the day is full.
 */
export type AddOutcome = { plan: Trip; placed: 'day' | 'lodging' | 'kept' | 'pool'; reason?: string };

/** Adds a place and puts it at the end of the day being viewed (lodging fills an unset night instead). */
export function addToDay(plan: Trip, p: Omit<Place, 'placeRef'>, dayIndex: number): AddOutcome {
  const added = addPlace(plan, p);
  const place = added.places[added.places.length - 1];
  if (p.category === 'LODGING') {
    const day = added.days.find((d) => d.dayIndex === dayIndex);
    const isLast = added.days[added.days.length - 1]?.dayIndex === dayIndex;
    return day && !isLast && !day.lodgingPlaceRef ? { plan: setLodging(added, dayIndex, place.placeRef), placed: 'lodging' } : { plan: added, placed: 'kept' };
  }
  const visit = added.visits[added.visits.length - 1];
  try {
    return { plan: assign(added, visit.visitId, dayIndex), placed: 'day' };
  } catch (e) {
    return { plan: added, placed: 'pool', reason: (e as Error).message }; // day full: it waits in the 보관함
  }
}

export const setLeg = (plan: Trip, dayIndex: number, k: number, minutes: number | null): Trip =>
  mapDay(plan, dayIndex, (d) => ({ ...d, legs: d.legs.map((l, i) => (i === k ? (minutes === null ? null : { minutes, source: 'USER_ESTIMATE' }) : l)) }));

export const setLodging = (plan: Trip, dayIndex: number, placeRef: string | null): Trip => mapDay(plan, dayIndex, (d) => ({ ...d, lodgingPlaceRef: placeRef }));

export const setDepart = (plan: Trip, dayIndex: number, time: string | null): Trip => mapDay(plan, dayIndex, (d) => ({ ...d, departTime: time }));

/** Target time to reach the night's lodging (or home on the last day); the car warns when the day runs past it. */
export const setEndBy = (plan: Trip, dayIndex: number, time: string | null): Trip => mapDay(plan, dayIndex, (d) => ({ ...d, endBy: time }));

/* ---------- travel times follow their pair of places ---------- */

const endpointKey = (e: Endpoint) => (e.kind === 'HOME' ? '@home' : e.placeRef);

/** "from>to" for each leg of a day (same idea as the car's LegKeys); null where an end is not set. */
export function legKeys(plan: Trip, dayIndex: number): (string | null)[] {
  const d = plan.days[dayIndex - 1];
  const start = dayIndex === 1 ? endpointKey(plan.origin) : plan.days[dayIndex - 2].lodgingPlaceRef;
  const end = dayIndex === plan.days.length ? endpointKey(plan.finalDestination) : d.lodgingPlaceRef;
  const points = [start, ...d.visitOrder.map((id) => visitOf(plan, id)?.placeRef ?? null), end];
  return points.slice(0, -1).map((from, k) => (from && points[k + 1] ? `${from}>${points[k + 1]}` : null));
}

/** Travel times the user typed this editing session, by pair of places (kept in memory only). */
export type LegBook = Map<string, number>;

export function rememberLegs(plan: Trip, book: LegBook) {
  plan.days.forEach((d) =>
    legKeys(plan, d.dayIndex).forEach((key, k) => {
      const leg = d.legs[k];
      if (key && leg) book.set(key, leg.minutes);
    }),
  );
}

/**
 * After an edit (reorder, add, remove, lodging, origin, final destination), a leg whose two ends changed takes the
 * time typed for that exact pair (A→B, never the reverse), or becomes unknown. A leg whose ends did not change keeps
 * its value; clearing it also forgets it.
 */
export function relinkLegs(prev: Trip, next: Trip, book: LegBook): Trip {
  let touched = false;
  const days = next.days.map((d) => {
    const before = prev.days.find((p) => p.dayIndex === d.dayIndex);
    const oldKeys = before ? legKeys(prev, d.dayIndex) : [];
    const newKeys = legKeys(next, d.dayIndex);
    const legs = d.legs.map((leg, k) => {
      const key = newKeys[k];
      // No key yet (lodging, origin or destination not set): nothing to relink against, so the typed value stays.
      if (!key) return leg;
      if (key === oldKeys[k]) {
        if (!leg && before?.legs[k]) book.delete(key);
        return leg;
      }
      const known = book.get(key);
      const relinked = known === undefined ? null : { minutes: known, source: 'USER_ESTIMATE' as const };
      if (relinked?.minutes !== leg?.minutes) touched = true;
      return relinked;
    });
    return { ...d, legs };
  });
  return touched ? { ...next, days } : next;
}

export const updateVisit = patchVisit;

export const updatePlace = (plan: Trip, placeRef: string, patch: Partial<Place>): Trip => ({
  ...plan,
  places: plan.places.map((p) => (p.placeRef === placeRef ? { ...p, ...patch } : p)),
});

/** Changes a place's category and keeps its visit in step: lodging has no visit, every other kind has one. */
export function changeCategory(plan: Trip, placeRef: string, category: Place['category']): Trip {
  let next = updatePlace(plan, placeRef, { category });
  const hasVisit = plan.visits.some((v) => v.placeRef === placeRef);
  if (category === 'LODGING' && hasVisit) {
    for (const v of plan.visits.filter((v) => v.placeRef === placeRef)) next = unassign(next, v.visitId);
    next = { ...next, visits: next.visits.filter((v) => v.placeRef !== placeRef) };
  } else if (category !== 'LODGING' && !hasVisit) {
    next = {
      ...next,
      visits: [...next.visits, { visitId: newRef('v'), placeRef, stayMinutes: 60, prepMinutes: 0, importance: 'NORMAL', desiredTime: null, fixed: null, dateFlexible: true, timeFlexible: true, unassignedReason: 'NOT_SCHEDULED_YET' }],
    };
  }
  return next;
}

/* ---------- read helpers ---------- */

export const placeOf = (plan: Trip, ref: string) => plan.places.find((p) => p.placeRef === ref);
export const visitOf = (plan: Trip, id: string) => plan.visits.find((v) => v.visitId === id);
export const unassignedVisits = (plan: Trip) => plan.visits.filter((v) => v.unassignedReason !== null);
export const lodgingPlaces = (plan: Trip) => plan.places.filter((p) => p.category === 'LODGING');

/* ---------- 이어서 묵기 (M49): the same lodging over several nights ---------- */

/**
 * Lodgings to offer for night `dayIndex`: the nights before it first (the nearest night first — usually the hotel you are
 * already in), then the nights after it, then the trip's other lodging places. Each place once; nights only (the last
 * day has none).
 */
export function lodgingSuggestions(plan: Trip, dayIndex: number) {
  const nights = plan.days.slice(0, -1);
  const before = nights.filter((d) => d.dayIndex < dayIndex).reverse();
  const after = nights.filter((d) => d.dayIndex > dayIndex);
  const refs = [...before, ...after].map((d) => d.lodgingPlaceRef).filter((r): r is string => !!r);
  const ordered = [...refs, ...lodgingPlaces(plan).map((p) => p.placeRef)];
  return [...new Set(ordered)].map((ref) => placeOf(plan, ref)).filter((p): p is NonNullable<typeof p> => !!p);
}

/** The nights after `dayIndex` that still have no lodging and were not left 미정 on purpose. */
export const laterEmptyNights = (plan: Trip, dayIndex: number, tbd: readonly number[]) =>
  plan.days.slice(0, -1).filter((d) => d.dayIndex > dayIndex && !d.lodgingPlaceRef && !tbd.includes(d.dayIndex)).map((d) => d.dayIndex);

/** Puts one lodging on several nights at once. */
export const fillNights = (plan: Trip, nights: readonly number[], placeRef: string): Trip => nights.reduce((p, n) => setLodging(p, n, placeRef), plan);

export const nightsLabel = (plan: Trip) => {
  const n = plan.days.length;
  return n === 1 ? t('trip.dayTrip') : t('trip.nights', { nights: n - 1, days: n });
};

export const REASON_LABEL: Record<NonNullable<Visit['unassignedReason']>, string> = {
  NOT_SCHEDULED_YET: t('trip.reason.notScheduledYet'),
  NO_TIME: t('trip.reason.noTime'),
  OUTSIDE_PERIOD: t('trip.reason.outsidePeriod'),
  CLOSED: t('trip.reason.closed'),
  USER_EXCLUDED: t('trip.reason.userExcluded'),
};

export interface Warning {
  level: 'warning' | 'info';
  text: string;
}

/** A timetable finding (same codes as the car's re-check) in the UI language. */
export function issueText(i: DayIssue): string {
  const [day, a, b, c] = i.args;
  switch (i.code) {
    case 'FIRST_DEPARTURE_UNKNOWN': return t('timeline.firstDepartureUnknown');
    case 'DEPARTURE_UNKNOWN': return t('timeline.departureUnknown', { day });
    case 'DEPART_PREVIOUS_DAY': return t('timeline.departPreviousDay');
    case 'LEG_UNKNOWN': return t('timeline.legUnknown', { day, n: a });
    case 'LATE_FOR_FIXED': return t('timeline.lateForFixed', { day, name: a, fixed: b, expected: c });
    case 'FIXED_UNCHECKED': return t('timeline.fixedUnchecked', { day, name: a, fixed: b });
    case 'CLOSED_DATE': return t('timeline.closedDate', { day, name: a });
    case 'CLOSED_WEEKDAY': return t('timeline.closedWeekday', { day, name: a });
    case 'OUTSIDE_HOURS': return t('timeline.outsideHours', { day, name: a, start: b, end: c });
    case 'PAST_END_BY': return t('timeline.pastEndBy', { day, end: a, endBy: b });
  }
}

export type SetupStep = 1 | 2 | 3 | 4;
export interface TripSetupState {
  done: boolean;
  step: SetupStep;
}

/** A stored setup state, or null (done) when missing or malformed. */
export function cleanSetup(raw: unknown): TripSetupState | null {
  const r = raw as Partial<TripSetupState> | null | undefined;
  if (!r || typeof r !== 'object' || r.done !== false) return null;
  const step = [1, 2, 3, 4].includes(r.step as number) ? (r.step as SetupStep) : 1;
  return { done: false, step };
}

/** Whether a setup step may move on, and if not, what is missing (shown under the step). */
export function setupReady(plan: Trip, lodgingTbd: readonly number[], step: SetupStep): { ok: boolean; reason?: string } {
  if (step === 1) {
    if (!plan.name.trim()) return { ok: false, reason: t('setup.need.name') };
    const open = plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef && !lodgingTbd.includes(d.dayIndex)).length;
    if (open > 0) return { ok: false, reason: t('setup.need.lodging', { n: open }) };
  }
  if (step === 2 && plan.visits.length === 0) return { ok: false, reason: t('setup.need.places') };
  return { ok: true };
}

/**
 * 예약 (M43): a reservation pins a visit to a day and time — fixed (RESERVATION), not movable by date or time, and put
 * on that day. `day` null lifts it: the fixed time goes, the visit is free again and waits in 저장 목록.
 */
export function setReservation(plan: Trip, visitId: string, day: number | null, time: string | null): Trip {
  if (day === null || time === null) {
    const freed = updateVisit(plan, visitId, { fixed: null, timeFlexible: true, dateFlexible: true });
    return freed.days.some((d) => d.visitOrder.includes(visitId)) ? unassign(freed, visitId) : freed;
  }
  const pinned = updateVisit(plan, visitId, { fixed: { time, kind: 'RESERVATION' }, timeFlexible: false, dateFlexible: false });
  return moveToDay(pinned, visitId, day);
}

/** Keeps only nights that still exist and still have no lodging (a chosen lodging, or a shorter trip, ends 미정). */
export function cleanLodgingTbd(raw: unknown, plan: Trip): number[] {
  if (!Array.isArray(raw)) return [];
  const open = new Set(plan.days.slice(0, -1).filter((d) => !d.lodgingPlaceRef).map((d) => d.dayIndex));
  return [...new Set(raw.filter((n): n is number => typeof n === 'number' && open.has(n)))].sort((a, b) => a - b);
}

/** Advice shown while editing. Nothing here blocks saving or sending; the car re-checks everything. */
export function planWarnings(plan: Trip, home: Home | null, lodgingTbd: readonly number[] = []): Warning[] {
  const out: Warning[] = [];
  const last = plan.days.length - 1;
  plan.days.forEach((d, i) => {
    // A night marked 미정 needs no lodging (M41).
    if (i < last && !d.lodgingPlaceRef && !lodgingTbd.includes(d.dayIndex)) out.push({ level: 'warning', text: t('trip.warn.noLodging', { day: d.dayIndex }) });
    if (i === last && d.lodgingPlaceRef) out.push({ level: 'warning', text: t('trip.warn.lastLodging') });
  });
  for (const v of plan.visits) {
    const name = placeOf(plan, v.placeRef)?.name ?? '';
    if (v.fixed && v.unassignedReason !== null) out.push({ level: 'warning', text: t('trip.warn.fixedUnassigned', { name }) });
    if (v.fixed && !/:(00|30)$/.test(v.fixed.time)) out.push({ level: 'warning', text: t('trip.warn.fixedSlot', { name }) });
  }
  // Timetable conflicts are found here before sending, with the same rules the car uses on arrival.
  for (const d of plan.days) for (const i of dayIssues(plan, d.dayIndex)) if (i.severity === 'CONFLICT') out.push({ level: 'warning', text: issueText(i) });
  const missing = plan.days.reduce((n, d) => n + d.legs.filter((l) => l === null).length, 0);
  if (missing) out.push({ level: 'info', text: t('trip.warn.missingLegs', { n: missing }) });
  // Lodging is left out, as in the car.
  const unknownHours = plan.places.filter((p) => p.hours.status === 'UNKNOWN' && p.category !== 'LODGING').length;
  if (unknownHours) out.push({ level: 'info', text: t('trip.warn.unknownHours', { n: unknownHours }) });
  if ((plan.origin.kind === 'HOME' || plan.finalDestination.kind === 'HOME') && !home) {
    out.push({ level: 'info', text: t('trip.warn.noHome') });
  }
  return out;
}

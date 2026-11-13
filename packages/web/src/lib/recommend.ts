import { getHere } from './here';
import { KEY_HERE, KEY_HOME, minutes, optimizeTrip, type Endpoint, type GapSlot, type Home, type LodgingNote, type Trip, type Visit } from '@tteonaljido/shared';
import type { NewPlace } from '../editor/PlaceSearch';
import type { TripNotes } from './notes';
import { assign, move, moveToDay, placeOf, rememberLegs, unassign, visitOf, type LegBook } from './trips';

/**
 * 이동경로 자동 추천 (route recommendation). {@link recommend} arranges the whole trip with the shared optimizer (M64);
 * the straight-line helpers below it (`orderDay`, `shorterDayOrder`) stay for the editor's 더 빠른 순서 card.
 * Everything here is pure and deterministic, never edits the schema shape, and changes order through the same pure
 * ops (assign/move) the editor uses, so travel-time bookkeeping (LegBook/relinkLegs) keeps working.
 */

/** Reasons we treat as "not placed yet", so the recommender may assign them to a day. User/engine exclusions are left alone. */
const ASSIGNABLE: ReadonlySet<NonNullable<Visit['unassignedReason']>> = new Set(['NOT_SCHEDULED_YET', 'NO_TIME']);
const IMP: Record<Visit['importance'], number> = { MUST: 0, NORMAL: 1, OPTIONAL: 2 };

type Pt = { latE7: number | null; lonE7: number | null };

/** Equirectangular metres between two E7 coordinates; null when any coordinate is missing. Port of the car's `metres`. */
export function metresE7(latA: number | null, lonA: number | null, latB: number | null, lonB: number | null): number | null {
  if (latA === null || lonA === null || latB === null || lonB === null) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const lat1 = rad(latA / 1e7);
  const lat2 = rad(latB / 1e7);
  const dLon = rad((lonB - lonA) / 1e7);
  const x = dLon * Math.cos((lat1 + lat2) / 2);
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Distance between two points, Infinity when either is missing coordinates (so it loses every min-comparison). */
const dist = (a: Pt | null, b: Pt | null): number => (a && b ? metresE7(a.latE7, a.lonE7, b.latE7, b.lonE7) ?? Infinity : Infinity);
const hasCoord = (p: Pt | null): p is Pt => !!p && p.latE7 !== null && p.lonE7 !== null;

const placePt = (plan: Trip, ref: string | null): Pt | null => {
  if (!ref) return null;
  const p = placeOf(plan, ref);
  return p ? { latE7: p.latE7, lonE7: p.lonE7 } : null;
};
const visitPt = (plan: Trip, visitId: string): Pt | null => {
  const v = visitOf(plan, visitId);
  return v ? placePt(plan, v.placeRef) : null;
};
const endpointPt = (plan: Trip, home: Home | null, e: Endpoint): Pt | null =>
  e.kind === 'HOME' ? (home ? { latE7: home.latE7, lonE7: home.lonE7 } : null) : e.kind === 'PLACE' ? placePt(plan, e.placeRef) : getHere(); // 현재 위치: the phone's position when known

/** Where a day starts from: day 1 = origin; later days = the previous night's lodging. */
const startPt = (plan: Trip, home: Home | null, dayIndex: number): Pt | null =>
  dayIndex === 1 ? endpointPt(plan, home, plan.origin) : placePt(plan, plan.days[dayIndex - 2]?.lodgingPlaceRef ?? null);
/** Where a day should end near: last day = final destination; otherwise that day's lodging. */
const endPt = (plan: Trip, home: Home | null, dayIndex: number): Pt | null =>
  dayIndex === plan.days.length ? endpointPt(plan, home, plan.finalDestination) : placePt(plan, plan.days[dayIndex - 1]?.lodgingPlaceRef ?? null);

/** Nights (days 1..n-1) that have no lodging set yet; the last day legitimately ends at the final destination. */
export function missingLodgingDays(plan: Trip): number[] {
  const last = plan.days.length - 1;
  return plan.days.flatMap((d, i) => (i < last && !d.lodgingPlaceRef ? [d.dayIndex] : []));
}

/** Minutes to drive a straight-line distance, where no measured time is known: a road factor, slower in town than between towns. */
export function estimateDriveMinutes(metres: number): number {
  const road = metres * 1.35;
  const perMinute = road > 30_000 ? 1_250 : road > 5_000 ? 670 : 420;
  return Math.max(3, Math.round(road / perMinute));
}

export interface RecommendOptions {
  /** Driving times already measured for a pair of places (the editor's leg book); the plan's own legs are used as well. */
  book?: LegBook;
  /** The trip's phone-only notes: a lodging's check-in and check-out times are read from them. */
  notes?: TripNotes;
  /** Favorite places outside the trip that may be offered for a gap of two hours or more. */
  pool?: (NewPlace & { id: string })[];
  iterations?: number;
}

export interface RecommendInsights {
  gaps: (GapSlot & { beforeName: string })[];
  lodgingNotes: (LodgingNote & { time: string })[];
  /** Rules that must hold and do not in the best plan found (a booking that cannot be reached, a place closed all trip). */
  hardViolations: number;
}

export interface Recommendation {
  plan: Trip;
  insights: RecommendInsights;
}

/**
 * 경로 추천 (M64): the whole trip arranged at once by the shared optimizer — which day each place goes on, and in what
 * order — under the planning rules it documents (parking and booking lead times, opening hours, meal times, cafes after
 * meals, check-in and check-out). Driving times come from what has been measured (the plan's own legs, the leg book)
 * and, for pairs nobody has measured yet, from the straight-line distance; the caller then asks for real times along
 * the proposed order, as before. Pure and deterministic; the input is untouched, and the result is realized through
 * the editor's own operations so the travel-time bookkeeping keeps working.
 */
export function recommend(plan: Trip, home: Home | null, opts: RecommendOptions = {}): Recommendation {
  const known = new Map(opts.book ?? []);
  rememberLegs(plan, known);
  const poolPts = new Map((opts.pool ?? []).map((f) => [`fav:${f.id}`, { latE7: f.latE7, lonE7: f.lonE7 }]));
  const pt = (key: string): Pt | null => (key === KEY_HOME ? (home ? { latE7: home.latE7, lonE7: home.lonE7 } : null) : key === KEY_HERE ? getHere() : (poolPts.get(key) ?? placePt(plan, key)));
  const movable = plan.visits.filter((v) => placeOf(plan, v.placeRef)?.category !== 'LODGING').length;
  const lodging = Object.fromEntries(
    Object.entries(opts.notes ?? {}).flatMap(([ref, n]) => (n.checkIn || n.checkOut ? [[ref, { ...(n.checkIn ? { checkIn: minutes(n.checkIn) } : {}), ...(n.checkOut ? { checkOut: minutes(n.checkOut) } : {}) }]] : [])),
  );
  // Estimates are brought in line with this trip's measured legs (their median ratio), so that a pair nobody has
  // measured is not preferred — or avoided — just because the estimate runs fast or slow in this region.
  const ratios = [...known].flatMap(([key, minutes]) => {
    const [a, b] = key.split('>');
    const m = dist(pt(a), pt(b));
    return isFinite(m) && m > 300 && minutes > 0 ? [minutes / estimateDriveMinutes(m)] : [];
  }).sort((x, y) => x - y);
  const scale = ratios.length >= 3 ? Math.min(2, Math.max(0.7, ratios[Math.floor(ratios.length / 2)])) : 1;
  const result = optimizeTrip({
    trip: plan,
    drive: (a, b) => {
      // A measured time for this pair, else the one measured the other way round, else the estimate.
      const measured = known.get(`${a}>${b}`) ?? known.get(`${b}>${a}`);
      if (measured !== undefined) return measured;
      const m = dist(pt(a), pt(b));
      return isFinite(m) ? Math.max(3, Math.round(estimateDriveMinutes(m) * scale)) : null;
    },
    lodging,
    pool: (opts.pool ?? []).filter((f) => f.latE7 !== null && !plan.places.some((p) => p.name === f.name && p.latE7 === f.latE7)).map((f) => ({ key: `fav:${f.id}`, name: f.name, category: f.category, hours: f.hours })),
    // Enough steps to settle a trip of this size (measured: the 13-stop sample settles well inside this), capped for big ones.
    config: { iterations: opts.iterations ?? Math.min(12_000, 2_000 + 800 * movable) },
  });

  // Realize through the editor's own pure ops so leg bookkeeping stays consistent.
  let p = plan;
  for (const d of plan.days) {
    for (const id of result.order[d.dayIndex] ?? []) {
      const was = dayOf(plan, id);
      if (was === null) p = assign(p, id, d.dayIndex);
      else if (was !== d.dayIndex) p = moveToDay(p, id, d.dayIndex);
    }
  }
  for (const id of result.unassigned) if (dayOf(plan, id) !== null) p = unassign(p, id, 'NO_TIME');
  for (const d of plan.days) p = reorderDay(p, d.dayIndex, result.order[d.dayIndex] ?? []);

  const nameOf = (visitId: string) => placeOf(plan, visitOf(plan, visitId)?.placeRef ?? '')?.name ?? visitId;
  const noteTime = (n: LodgingNote): string => {
    const ref = n.kind === 'CHECKOUT_BEFORE_DEPARTURE' ? plan.days[n.dayIndex - 2]?.lodgingPlaceRef : plan.days[n.dayIndex - 1]?.lodgingPlaceRef;
    const note = ref ? opts.notes?.[ref] : undefined;
    return (n.kind === 'CHECKOUT_BEFORE_DEPARTURE' ? note?.checkOut : note?.checkIn) ?? '';
  };
  return {
    plan: p,
    insights: {
      gaps: result.gaps.map((g) => ({ ...g, beforeName: nameOf(g.beforeVisitId) })),
      lodgingNotes: result.lodgingNotes.map((n) => ({ ...n, time: noteTime(n) })),
      hardViolations: result.hardViolations,
    },
  };
}

/** The recommended plan alone (see {@link recommend}). */
export const recommendRoute = (plan: Trip, home: Home | null, opts: RecommendOptions = {}): Trip => recommend(plan, home, opts).plan;

/** Orders one day's visitIds: fixed times are hard anchors (by time); free stops are inserted toward the lodging; meal→cafe. */
export function orderDay(plan: Trip, home: Home | null, dayIndex: number, ids: string[]): string[] {
  type Node = { visitId: string | null; pt: Pt | null };
  const vis = (id: string) => visitOf(plan, id)!;
  const fixed = ids.filter((id) => vis(id).fixed).sort((a, b) => vis(a).fixed!.time.localeCompare(vis(b).fixed!.time) || a.localeCompare(b));
  const free = ids.filter((id) => !vis(id).fixed);
  const sortFree = (list: string[]) =>
    [...list].sort(
      (a, b) =>
        IMP[vis(a).importance] - IMP[vis(b).importance] ||
        (vis(a).desiredTime ?? '99:99').localeCompare(vis(b).desiredTime ?? '99:99') ||
        a.localeCompare(b),
    );
  const freeCoord = sortFree(free.filter((id) => hasCoord(visitPt(plan, id))));
  const freeNoCoord = sortFree(free.filter((id) => !hasCoord(visitPt(plan, id))));

  const path: Node[] = [{ visitId: null, pt: startPt(plan, home, dayIndex) }, ...fixed.map((id) => ({ visitId: id, pt: visitPt(plan, id) })), { visitId: null, pt: endPt(plan, home, dayIndex) }];
  for (const id of freeCoord) {
    const pt = visitPt(plan, id);
    let at = -1;
    let bestCost = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const base = dist(path[i].pt, path[i + 1].pt);
      const c = dist(path[i].pt, pt) + dist(pt, path[i + 1].pt) - base;
      if (isFinite(c) && c < bestCost) {
        bestCost = c;
        at = i;
      }
    }
    path.splice((at < 0 ? path.length - 2 : at) + 1, 0, { visitId: id, pt }); // no usable edge → just before the end anchor
  }
  // Name-only (no-coord) free stops can't be placed by proximity; keep them together just before the end anchor, in order.
  path.splice(path.length - 1, 0, ...freeNoCoord.map((id) => ({ visitId: id, pt: null })));

  const order = path.map((n) => n.visitId).filter((id): id is string => id !== null);
  // meal → cafe: a cafe should follow a meal, not precede it (one left-to-right pass; fixed stops are never moved).
  for (let k = 0; k < order.length - 1; k++) {
    const a = vis(order[k]);
    const b = vis(order[k + 1]);
    if (!a.fixed && !b.fixed && placeOf(plan, a.placeRef)?.category === 'CAFE' && placeOf(plan, b.placeRef)?.category === 'FOOD') {
      [order[k], order[k + 1]] = [order[k + 1], order[k]];
    }
  }
  return order;
}

/** Bubbles the day's stops into `target` order using the adjacent-swap `move`, so only changed legs are cleared. */
export function reorderDay(plan: Trip, dayIndex: number, target: string[]): Trip {
  let p = plan;
  for (let i = 0; i < target.length; i++) {
    const cur = p.days[dayIndex - 1].visitOrder.indexOf(target[i]);
    for (let k = cur; k > i; k--) p = move(p, dayIndex, k, -1);
  }
  return p;
}

export interface RouteChange {
  visitId: string;
  placeRef: string;
  name: string;
  fromDay: number | null;
  toDay: number | null;
  moved: boolean;
  newlyAssigned: boolean;
  noCoords: boolean;
}

export interface RecommendationDiff {
  changes: RouteChange[];
  addedCount: number;
  movedCount: number;
  overflowCount: number;
  noCoordsCount: number;
  changed: boolean;
}

const dayOf = (plan: Trip, visitId: string): number | null => plan.days.find((d) => d.visitOrder.includes(visitId))?.dayIndex ?? null;
const idxOf = (plan: Trip, visitId: string): number => plan.days.find((d) => d.visitOrder.includes(visitId))?.visitOrder.indexOf(visitId) ?? -1;

/** What changed between the current plan and a recommendation, for the preview. `changed:false` ⇒ nothing to apply. */
export function summarizeRecommendation(before: Trip, after: Trip): RecommendationDiff {
  const changes: RouteChange[] = [];
  let addedCount = 0;
  let movedCount = 0;
  let noCoordsCount = 0;
  for (const v of after.visits) {
    const fromDay = dayOf(before, v.visitId);
    const toDay = dayOf(after, v.visitId);
    const newlyAssigned = fromDay === null && toDay !== null;
    const moved = fromDay !== null && toDay !== null && (fromDay !== toDay || idxOf(before, v.visitId) !== idxOf(after, v.visitId));
    if (!newlyAssigned && !moved) continue;
    const p = placeOf(after, v.placeRef);
    const noCoords = !p || p.latE7 === null;
    if (newlyAssigned) addedCount++;
    if (moved) movedCount++;
    if (noCoords) noCoordsCount++;
    changes.push({ visitId: v.visitId, placeRef: v.placeRef, name: p?.name ?? v.placeRef, fromDay, toDay, moved, newlyAssigned, noCoords });
  }
  const overflowCount = after.visits.filter(
    (v) => dayOf(before, v.visitId) === null && dayOf(after, v.visitId) === null && v.unassignedReason !== null && ASSIGNABLE.has(v.unassignedReason),
  ).length;
  const orderChanged = after.days.some((d) => {
    const b = before.days.find((x) => x.dayIndex === d.dayIndex);
    return !b || b.visitOrder.length !== d.visitOrder.length || b.visitOrder.some((id, i) => id !== d.visitOrder[i]);
  });
  return { changes, addedCount, movedCount, overflowCount, noCoordsCount, changed: orderChanged };
}

/* ---------- M54: a faster order for one day (the editor's '더 빠른 순서' card) ---------- */

/** Straight-line metres of a day's chain start → stops (in `order`) → end; Infinity when a stop has no coordinates. */
export function chainMetres(plan: Trip, home: Home | null, dayIndex: number, order: string[]): number {
  const pts = [startPt(plan, home, dayIndex), ...order.map((id) => visitPt(plan, id)), endPt(plan, home, dayIndex)];
  let m = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    if (!hasCoord(pts[i]) || !hasCoord(pts[i + 1])) {
      if (i === 0 || i + 1 === pts.length - 1) continue; // an unknown start/end (home without an address) adds nothing either way
      return Infinity;
    }
    m += dist(pts[i], pts[i + 1]);
  }
  return m;
}

/** A stop's time anchor: its fixed time, else its 희망 time; null for a free stop. */
const anchorTime = (plan: Trip, id: string): string | null => {
  const v = visitOf(plan, id);
  return v?.fixed?.time ?? v?.desiredTime ?? null;
};
/** Stops with a time (fixed or 희망) must stay in time order among themselves. */
const anchorsInOrder = (plan: Trip, order: string[]) => {
  const times = order.map((id) => anchorTime(plan, id)).filter((x): x is string => x !== null);
  return times.every((x, i) => i === 0 || times[i - 1] <= x);
};

/** 2-opt on the straight-line chain; a reversal never flips two timed stops (so their order holds). */
function twoOpt(plan: Trip, home: Home | null, dayIndex: number, start: string[]): string[] {
  let best = [...start];
  let bestLen = chainMetres(plan, home, dayIndex, best);
  for (let improved = true, pass = 0; improved && pass < 20; pass++) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const seg = best.slice(i, j + 1);
        if (seg.filter((id) => anchorTime(plan, id) !== null).length > 1) continue;
        const next = [...best.slice(0, i), ...seg.reverse(), ...best.slice(j + 1)];
        const len = chainMetres(plan, home, dayIndex, next);
        if (len < bestLen - 1 && anchorsInOrder(plan, next)) {
          best = next;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * A shorter visiting order for one day by straight-line distance — the cheap first check before asking Kakao (M54).
 * Tries the recommender's own order and a 2-opt of the current one; timed stops (fixed or 희망) keep their time order.
 * null when the day has fewer than 2 stops, a stop without coordinates, or nothing at least `minGain` shorter.
 */
export function shorterDayOrder(plan: Trip, home: Home | null, dayIndex: number, minGain = 0.1): string[] | null {
  const ids = plan.days[dayIndex - 1]?.visitOrder ?? [];
  if (ids.length < 2) return null;
  const now = chainMetres(plan, home, dayIndex, ids);
  if (!isFinite(now) || now <= 0) return null;
  const tries = [twoOpt(plan, home, dayIndex, ids)];
  const rec = orderDay(plan, home, dayIndex, ids);
  if (anchorsInOrder(plan, rec)) tries.push(twoOpt(plan, home, dayIndex, rec));
  const best = tries.reduce((a, b) => (chainMetres(plan, home, dayIndex, b) < chainMetres(plan, home, dayIndex, a) ? b : a));
  if (best.join() === ids.join()) return null;
  return chainMetres(plan, home, dayIndex, best) <= now * (1 - minGain) ? best : null;
}

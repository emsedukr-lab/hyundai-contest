import { TRANSFER_LIMITS, type Endpoint, type Home, type Trip, type Visit } from '@tteonaljido/shared';
import { assign, move, placeOf, unassignedVisits, visitOf } from './trips';

/**
 * 이동경로 자동 추천 (route recommendation). All pure and deterministic: given a plan (and the home address, which lives
 * beside the plan — `plan.home` is always null here), it assigns still-unassigned places across the days by proximity
 * and orders each day so the route flows from the day's start toward its lodging, keeping fixed-time visits in time
 * order and preferring meal→cafe. It never edits the schema shape; order changes go through the same pure ops
 * (assign/move) the editor uses, so travel-time bookkeeping (LegBook/relinkLegs) keeps working.
 */

const MAX_PER_DAY = TRANSFER_LIMITS.maxVisitsPerDay;
/** Reasons we treat as "not placed yet", so the recommender may assign them to a day. User/engine exclusions are left alone. */
const ASSIGNABLE: ReadonlySet<NonNullable<Visit['unassignedReason']>> = new Set(['NOT_SCHEDULED_YET', 'NO_TIME']);
/** Metres of detour that one extra stop on a day is "worth" — balances geography against evening out stops per day. */
const LOAD_PENALTY = 1500;
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
  e.kind === 'HOME' ? (home ? { latE7: home.latE7, lonE7: home.lonE7 } : null) : placePt(plan, e.placeRef);

/** Where a day starts from: day 1 = origin; later days = the previous night's lodging. */
const startPt = (plan: Trip, home: Home | null, dayIndex: number): Pt | null =>
  dayIndex === 1 ? endpointPt(plan, home, plan.origin) : placePt(plan, plan.days[dayIndex - 2]?.lodgingPlaceRef ?? null);
/** Where a day should end near: last day = final destination; otherwise that day's lodging. */
const endPt = (plan: Trip, home: Home | null, dayIndex: number): Pt | null =>
  dayIndex === plan.days.length ? endpointPt(plan, home, plan.finalDestination) : placePt(plan, plan.days[dayIndex - 1]?.lodgingPlaceRef ?? null);

/** Centroid of a day's current coord-bearing stops, or null. */
function centroid(plan: Trip, dayIndex: number): Pt | null {
  const pts = plan.days[dayIndex - 1].visitOrder.map((id) => visitPt(plan, id)).filter(hasCoord) as { latE7: number; lonE7: number }[];
  if (!pts.length) return null;
  const lat = Math.round(pts.reduce((s, p) => s + p.latE7, 0) / pts.length);
  const lon = Math.round(pts.reduce((s, p) => s + p.lonE7, 0) / pts.length);
  return { latE7: lat, lonE7: lon };
}
/** The point a day "pulls toward" when deciding where a new place belongs: its lodging, else its stops' centre, else its start. */
const dayAnchor = (plan: Trip, home: Home | null, dayIndex: number): Pt | null => {
  const e = endPt(plan, home, dayIndex);
  if (hasCoord(e)) return e;
  const c = centroid(plan, dayIndex);
  if (hasCoord(c)) return c;
  const s = startPt(plan, home, dayIndex);
  return hasCoord(s) ? s : null;
};

/** Nights (days 1..n-1) that have no lodging set yet; the last day legitimately ends at the final destination. */
export function missingLodgingDays(plan: Trip): number[] {
  const last = plan.days.length - 1;
  return plan.days.flatMap((d, i) => (i < last && !d.lodgingPlaceRef ? [d.dayIndex] : []));
}

/** The recommended plan: assign unassigned places to days, then order every day toward its lodging. Pure; input untouched. */
export function recommendRoute(plan: Trip, home: Home | null): Trip {
  // Phase A/B — assign still-unplaced visits to days by proximity, balancing stops per day and respecting the per-day cap.
  const counts = new Map<number, number>(plan.days.map((d) => [d.dayIndex, d.visitOrder.length]));
  const anchors = new Map<number, Pt | null>(plan.days.map((d) => [d.dayIndex, dayAnchor(plan, home, d.dayIndex)]));
  const assignTo = new Map<string, number>();
  const assignable = unassignedVisits(plan)
    .filter((v) => v.unassignedReason && ASSIGNABLE.has(v.unassignedReason))
    .sort((a, b) => IMP[a.importance] - IMP[b.importance] || a.visitId.localeCompare(b.visitId));
  for (const v of assignable) {
    const pt = placePt(plan, v.placeRef);
    let best = -1;
    let bestCost = Infinity;
    for (const d of plan.days) {
      if ((counts.get(d.dayIndex) ?? 0) >= MAX_PER_DAY) continue;
      const geo = dist(pt, anchors.get(d.dayIndex) ?? null);
      const cost = (isFinite(geo) ? geo : 0) + LOAD_PENALTY * (counts.get(d.dayIndex) ?? 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = d.dayIndex;
      }
    }
    if (best < 0) continue; // every day is full → leave unassigned (overflow)
    assignTo.set(v.visitId, best);
    counts.set(best, (counts.get(best) ?? 0) + 1);
  }

  // Phase C — for each day, compute the target order over its final visit set (current stops + newly assigned).
  const targetOrder = new Map<number, string[]>();
  for (const d of plan.days) {
    const ids = [...d.visitOrder, ...[...assignTo].filter(([, day]) => day === d.dayIndex).map(([id]) => id)];
    targetOrder.set(d.dayIndex, orderDay(plan, home, d.dayIndex, ids));
  }

  // Phase D — realize through the editor's own pure ops so leg bookkeeping stays consistent.
  let p = plan;
  for (const [visitId, dayIndex] of assignTo) p = assign(p, visitId, dayIndex);
  for (const d of plan.days) p = reorderDay(p, d.dayIndex, targetOrder.get(d.dayIndex) ?? []);
  return p;
}

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

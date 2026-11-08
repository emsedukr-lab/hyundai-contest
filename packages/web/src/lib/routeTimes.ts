import type { Trip } from '@tteonaljido/shared';
import { legKeys, setLeg } from './trips';

/**
 * Travel times from Kakao directions, filled into legs that are empty after the route changed (a stop moved, added or
 * removed, lodging or the start/end changed). Only legs whose two ends have coordinates are asked for, and never a leg
 * that starts or ends at home: home stays on this phone (the car's navigation times those legs itself). The result is
 * stored like a typed estimate (the transfer has one leg source); the user can still change it.
 */
export interface Point {
  latE7: number;
  lonE7: number;
}
/** A stretch of one day where every leg is empty and every point is known: one directions request. */
export interface LegRun {
  dayIndex: number;
  fromK: number;
  points: Point[];
  /** The leg keys ("from>to") at the time of asking, to make sure an answer still fits when it arrives. */
  keys: string[];
}

const MAX_POINTS = 25;

/** [start, ...stops, end] of a day with coordinates, null where unknown — and null for home, which is never sent. */
function knownPoints(plan: Trip, dayIndex: number): (Point | null)[] {
  const day = plan.days[dayIndex - 1];
  const at = (ref: string | null | undefined): Point | null => {
    const p = ref ? plan.places.find((x) => x.placeRef === ref) : undefined;
    return p && p.latE7 !== null && p.lonE7 !== null ? { latE7: p.latE7, lonE7: p.lonE7 } : null;
  };
  const start = dayIndex === 1 ? (plan.origin.kind === 'PLACE' ? at(plan.origin.placeRef) : null) : at(plan.days[dayIndex - 2].lodgingPlaceRef);
  const end = dayIndex === plan.days.length ? (plan.finalDestination.kind === 'PLACE' ? at(plan.finalDestination.placeRef) : null) : at(day.lodgingPlaceRef);
  const stops = day.visitOrder.map((id) => at(plan.visits.find((v) => v.visitId === id)?.placeRef));
  return [start, ...stops, end];
}

/** Every run of empty, askable legs in the trip. */
export function emptyRuns(plan: Trip): LegRun[] {
  const runs: LegRun[] = [];
  for (const day of plan.days) {
    const pts = knownPoints(plan, day.dayIndex);
    const keys = legKeys(plan, day.dayIndex);
    let run: LegRun | null = null;
    day.legs.forEach((leg, k) => {
      const ok = leg === null && pts[k] && pts[k + 1] && keys[k];
      if (!ok) return void (run = null);
      if (!run || run.points.length >= MAX_POINTS) {
        run = { dayIndex: day.dayIndex, fromK: k, points: [pts[k]!], keys: [] };
        runs.push(run);
      }
      run.points.push(pts[k + 1]!);
      run.keys.push(keys[k]!);
    });
  }
  return runs;
}

/** Puts an answer into the plan: only legs still empty and still between the same two places get a time. */
export function applyRun(plan: Trip, run: LegRun, minutes: (number | null)[]): { plan: Trip; filled: number } {
  const keys = legKeys(plan, run.dayIndex);
  const day = plan.days[run.dayIndex - 1];
  let next = plan;
  let filled = 0;
  run.keys.forEach((key, i) => {
    const k = run.fromK + i;
    const m = minutes[i];
    if (!day || day.legs[k] !== null || keys[k] !== key || typeof m !== 'number') return;
    next = setLeg(next, run.dayIndex, k, m);
    filled++;
  });
  return { plan: next, filled };
}

export const runSignature = (run: LegRun) => `${run.dayIndex}:${run.keys.join(',')}`;

/** Asks the relay (which asks Kakao Mobility). null = directions unavailable right now. */
export async function fetchRun(run: LegRun): Promise<(number | null)[] | null> {
  try {
    const res = await fetch('/api/v1/routes/durations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: run.points }) });
    if (!res.ok) return null;
    const data = (await res.json()) as { minutes?: unknown };
    return Array.isArray(data.minutes) && data.minutes.length === run.keys.length ? data.minutes.map((m) => (typeof m === 'number' ? m : null)) : null;
  } catch {
    return null;
  }
}

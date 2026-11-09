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

/** Every run of empty, askable legs in the trip (automatic fill after a route change). */
export const emptyRuns = (plan: Trip): LegRun[] => runs(plan, true);

/** Every run of askable legs, filled or not (pull-to-refresh / 다시 계산: re-ask Kakao for the whole trip). */
export const allRuns = (plan: Trip): LegRun[] => runs(plan, false);

function runs(plan: Trip, onlyEmpty: boolean): LegRun[] {
  const runs: LegRun[] = [];
  for (const day of plan.days) {
    const pts = knownPoints(plan, day.dayIndex);
    const keys = legKeys(plan, day.dayIndex);
    let run: LegRun | null = null;
    day.legs.forEach((leg, k) => {
      const ok = (!onlyEmpty || leg === null) && pts[k] && pts[k + 1] && keys[k];
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

/** Kakao's answer for one run: driving minutes and the recommended route's length in metres, per leg. */
export interface RunResult {
  minutes: (number | null)[];
  meters: (number | null)[];
}

/**
 * Puts an answer into the plan. Only legs still between the same two places are touched; without `overwrite` only
 * empty ones get a time (automatic fill), with it every such leg is replaced (refresh). Distances come back as a map
 * by leg key — phone-only, the transfer has no field for them.
 */
export function applyRun(plan: Trip, run: LegRun, result: RunResult, opts: { overwrite?: boolean } = {}): { plan: Trip; filled: number; meters: Record<string, number> } {
  const keys = legKeys(plan, run.dayIndex);
  const day = plan.days[run.dayIndex - 1];
  let next = plan;
  let filled = 0;
  const meters: Record<string, number> = {};
  run.keys.forEach((key, i) => {
    const k = run.fromK + i;
    if (!day || keys[k] !== key) return;
    const d = result.meters[i];
    if (typeof d === 'number') meters[key] = d;
    const m = result.minutes[i];
    if (typeof m !== 'number' || (!opts.overwrite && day.legs[k] !== null)) return;
    if (day.legs[k]?.minutes === m) return void filled++; // already right
    next = setLeg(next, run.dayIndex, k, m);
    filled++;
  });
  return { plan: next, filled, meters };
}

/** Keeps only distances for legs that still exist (by key), so stale pairs don't pile up in the saved trip. */
export function cleanLegMeters(raw: unknown, plan: Trip): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const live = new Set(plan.days.flatMap((d) => legKeys(plan, d.dayIndex)).filter((k): k is string => !!k));
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) if (live.has(key) && typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 2_000_000) out[key] = Math.round(v);
  return out;
}

/** "7.3km" — one decimal, as the recommended route's length. */
export const kmLabel = (m: number) => `${(m / 1000).toFixed(1)}km`;

export const runSignature = (run: LegRun) => `${run.dayIndex}:${run.keys.join(',')}`;

/** Asks the relay (which asks Kakao Mobility). null = directions unavailable right now. */
export async function fetchRun(run: LegRun): Promise<RunResult | null> {
  try {
    const res = await fetch('/api/v1/routes/durations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: run.points }) });
    if (!res.ok) return null;
    const data = (await res.json()) as { minutes?: unknown; meters?: unknown };
    const list = (v: unknown) => (Array.isArray(v) && v.length === run.keys.length ? v.map((m) => (typeof m === 'number' ? m : null)) : null);
    const minutes = list(data.minutes);
    if (!minutes) return null;
    return { minutes, meters: list(data.meters) ?? run.keys.map(() => null) };
  } catch {
    return null;
  }
}

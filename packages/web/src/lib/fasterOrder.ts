import { dayIssues, timeline, type Home, type Trip } from '@tteonaljido/shared';
import { reorderDay, shorterDayOrder } from './recommend';
import { allRuns, applyRun, type LegRun, type RunResult } from './routeTimes';
import { leaveFor, relinkLegs, setLeg, type LegBook } from './trips';

/**
 * 더 빠른 순서 (M54): for one day, a visiting order that drives at least {@link MIN_SAVED} minutes less — first found on
 * straight lines ({@link shorterDayOrder}), then checked with Kakao's real driving times for that order. It is only
 * offered when it adds no timetable conflict and leaves no more fixed times short of their 15-minute margin.
 */
export const MIN_SAVED = 10;

export interface FasterOrder {
  dayIndex: number;
  /** The day as it was when checked ({@link daySig}); a suggestion for an older shape of the day is dropped. */
  sig: string;
  order: string[];
  /** Driving minutes saved. */
  saved: number;
  /** The day's legs in the new order (Kakao minutes), by leg index. */
  legs: (number | null)[];
  meters: Record<string, number>;
}

/** What the suggestion depends on: the day's stops in order and where its start, stops and end are. */
export function daySig(plan: Trip, home: Home | null, dayIndex: number): string {
  const day = plan.days[dayIndex - 1];
  if (!day) return '';
  const pts = allRuns(plan, home)
    .filter((r) => r.dayIndex === dayIndex)
    .map((r) => `${r.fromK}:${r.points.map((p) => `${p.latE7},${p.lonE7}`).join(';')}`);
  return `${dayIndex}|${day.visitOrder.join(',')}|${pts.join('|')}`;
}

const driveTotal = (legs: readonly ({ minutes: number } | null)[]) => legs.reduce((s, l) => s + (l?.minutes ?? 0), 0);
const conflicts = (p: Trip, d: number) => dayIssues(p, d).filter((x) => x.severity === 'CONFLICT').length;
const shortMargins = (p: Trip, d: number) => {
  const times = Object.fromEntries(timeline(p, d).map((x) => [x.visitId, x]));
  return p.days[d - 1].visitOrder.filter((_, k) => leaveFor(p, d, k, times)?.tone === 'short').length;
};

/**
 * 'wait' = the day's legs are not all timed yet (ask again once they are); null = nothing faster (or Kakao unavailable).
 * `fetchRun` is injected so tests (and the editor) decide how Kakao is reached.
 */
export async function findFaster(
  plan: Trip,
  home: Home | null,
  dayIndex: number,
  book: LegBook,
  fetchRun: (run: LegRun) => Promise<RunResult | null>,
): Promise<FasterOrder | null | 'wait'> {
  const day = plan.days[dayIndex - 1];
  if (!day || day.visitOrder.length < 2) return null;
  if (day.legs.some((l) => l === null)) return 'wait';
  const order = shorterDayOrder(plan, home, dayIndex);
  if (!order) return null;
  let next = relinkLegs(plan, reorderDay(plan, dayIndex, order), new Map(book));
  const meters: Record<string, number> = {};
  for (const run of allRuns(next, home).filter((r) => r.dayIndex === dayIndex)) {
    const res = await fetchRun(run);
    if (!res) return null;
    const a = applyRun(next, run, res, { overwrite: true });
    next = a.plan;
    Object.assign(meters, a.meters);
  }
  const legs = next.days[dayIndex - 1].legs;
  if (legs.some((l) => l === null)) return null;
  const saved = driveTotal(day.legs) - driveTotal(legs);
  if (saved < MIN_SAVED) return null;
  if (conflicts(next, dayIndex) > conflicts(plan, dayIndex)) return null;
  if (shortMargins(next, dayIndex) > shortMargins(plan, dayIndex)) return null;
  return { dayIndex, sig: daySig(plan, home, dayIndex), order, saved, legs: legs.map((l) => l?.minutes ?? null), meters };
}

/** The current plan with the suggested order and its Kakao times on that day (other days untouched). */
export function applyFaster(plan: Trip, s: FasterOrder): Trip {
  let p = reorderDay(plan, s.dayIndex, s.order);
  s.legs.forEach((m, k) => (p = setLeg(p, s.dayIndex, k, m)));
  return p;
}

/* [닫기] remembers the day as it was, so the same suggestion doesn't come back; any change to the day asks again. */
const DISMISSED = 'tn.fasterDismissed';
const readDismissed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
export const isDismissed = (tripId: string, sig: string) => readDismissed().includes(`${tripId}#${sig}`);
export function dismiss(tripId: string, sig: string) {
  try {
    localStorage.setItem(DISMISSED, JSON.stringify([...readDismissed().slice(-199), `${tripId}#${sig}`]));
  } catch {
    /* private mode: it only stays closed for this session */
  }
}

import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { applyRun, emptyRuns } from './routeTimes';
import { move, setLeg } from './trips';

const day = (t: ReturnType<typeof sampleTrip>, i: number) => t.days[i - 1];

describe('Kakao travel times (routeTimes)', () => {
  it('finds runs of empty legs between known places after a reorder, never touching home', () => {
    const t = move(sampleTrip(), 2, 0, 1); // swapping two stops on day 2 empties the legs around them
    const runs = emptyRuns(t).filter((r) => r.dayIndex === 2);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.points.length).toBe(r.keys.length + 1);
    // day 1 starts and day 4 ends at home: those legs are never asked for
    expect(emptyRuns(t).some((r) => r.dayIndex === 1 && r.fromK === 0)).toBe(false);
    const lastDay = t.days.length;
    expect(emptyRuns(t).some((r) => r.dayIndex === lastDay && r.fromK + r.keys.length === day(t, lastDay).legs.length)).toBe(false);
  });

  it('fills only legs that are still empty and still between the same places', () => {
    const t = move(sampleTrip(), 2, 0, 1);
    const run = emptyRuns(t).find((r) => r.dayIndex === 2)!;
    const minutes = run.keys.map((_, i) => 10 + i);
    const done = applyRun(t, run, minutes);
    expect(done.filled).toBe(run.keys.length);
    expect(day(done.plan, 2).legs[run.fromK]?.minutes).toBe(10);
    // the user typed one meanwhile: it is kept
    const typed = setLeg(t, 2, run.fromK, 42);
    expect(day(applyRun(typed, run, minutes).plan, 2).legs[run.fromK]?.minutes).toBe(42);
    // the route changed again meanwhile: the old answer no longer fits
    const moved = move(t, 2, 1, 1);
    const stale = applyRun(moved, run, minutes);
    expect(stale.filled).toBeLessThan(run.keys.length);
  });
});

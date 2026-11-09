import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { allRuns, applyRun, cleanLegMeters, emptyRuns, kmLabel } from './routeTimes';
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
    const meters = run.keys.map(() => 4200);
    const done = applyRun(t, run, { minutes, meters });
    expect(done.filled).toBe(run.keys.length);
    expect(day(done.plan, 2).legs[run.fromK]?.minutes).toBe(10);
    // the user typed one meanwhile: it is kept
    const typed = setLeg(t, 2, run.fromK, 42);
    expect(day(applyRun(typed, run, { minutes, meters }).plan, 2).legs[run.fromK]?.minutes).toBe(42);
    // the route changed again meanwhile: the old answer no longer fits
    const moved = move(t, 2, 1, 1);
    const stale = applyRun(moved, run, { minutes, meters });
    expect(stale.filled).toBeLessThan(run.keys.length);
  });
});

describe('refresh (pull to refresh / 다시 계산)', () => {
  it('re-asks every leg between known places, filled or not, and overwrites them; home legs stay out', () => {
    const t = sampleTrip();
    const runs = allRuns(t);
    expect(runs.reduce((n, r) => n + r.keys.length, 0)).toBeGreaterThan(emptyRuns(t).reduce((n, r) => n + r.keys.length, 0));
    const r = runs.find((x) => x.dayIndex === 2)!;
    const out = applyRun(t, r, { minutes: r.keys.map(() => 33), meters: r.keys.map(() => 7342) }, { overwrite: true });
    expect(out.filled).toBe(r.keys.length);
    expect(day(out.plan, 2).legs[r.fromK]?.minutes).toBe(33);
    expect(Object.values(out.meters)).toEqual(r.keys.map(() => 7342));
    expect(runs.some((x) => x.dayIndex === 1 && x.fromK === 0)).toBe(false); // from home
  });

  it('keeps only distances of legs that still exist, and labels them with one decimal', () => {
    const t = sampleTrip();
    const r = allRuns(t)[0];
    expect(cleanLegMeters({ [r.keys[0]]: 7342.4, 'gone>gone': 100, bad: 'x' }, t)).toEqual({ [r.keys[0]]: 7342 });
    expect(kmLabel(7342)).toBe('7.3km');
    expect(kmLabel(450)).toBe('0.5km');
  });
});

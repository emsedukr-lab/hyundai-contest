import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { allRuns, applyRun, cleanLegMeters, daySummary, emptyRuns, kmLabel } from './routeTimes';
import { legKeys, move, setLeg } from './trips';

const day = (t: ReturnType<typeof sampleTrip>, i: number) => t.days[i - 1];

describe('Kakao travel times (routeTimes)', () => {
  it('finds runs of empty legs between known places after a reorder; without a home address the home legs are not asked', () => {
    const t = move(sampleTrip(), 2, 0, 1); // swapping two stops on day 2 empties the legs around them
    const runs = emptyRuns(t).filter((r) => r.dayIndex === 2);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.points.length).toBe(r.keys.length + 1);
    // day 1 starts and day 4 ends at home, and no home address is given: those legs can't be asked for
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
  it('re-asks every leg between known places, filled or not, and overwrites them; home legs need a home address', () => {
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

describe('a travel time cleared on purpose', () => {
  it('stays empty on the automatic fill (skip), while its distance is still kept', () => {
    const t = move(sampleTrip(), 2, 0, 1);
    const run = emptyRuns(t).find((r) => r.dayIndex === 2)!;
    const minutes = run.keys.map(() => 12);
    const meters = run.keys.map(() => 3000);
    const out = applyRun(t, run, { minutes, meters }, { skip: new Set([run.keys[0]]) });
    expect(day(out.plan, 2).legs[run.fromK]).toBeNull();
    expect(out.filled).toBe(run.keys.length - 1);
    expect(out.meters[run.keys[0]]).toBe(3000);
  });
});

describe('legs to and from home', () => {
  const home = { address: '세종시 한누리대로 2130', latE7: 364_800_000, lonE7: 1_272_890_000 };
  it('are asked with the home coordinates from 설정 when the trip starts or ends at home', () => {
    const t = sampleTrip(); // starts and ends at home
    const first = allRuns(t, home).find((r) => r.dayIndex === 1 && r.fromK === 0);
    expect(first?.points[0]).toEqual({ latE7: home.latE7, lonE7: home.lonE7 });
    expect(first?.keys[0].startsWith('@home>')).toBe(true);
    const lastDay = t.days.length;
    const back = allRuns(t, home).find((r) => r.dayIndex === lastDay && r.fromK + r.keys.length === day(t, lastDay).legs.length);
    expect(back?.points[back.points.length - 1]).toEqual({ latE7: home.latE7, lonE7: home.lonE7 });
  });
  it('fill the empty home leg and keep its distance under the @home key', () => {
    const t = setLeg(sampleTrip(), 1, 0, null);
    const run = emptyRuns(t, home).find((r) => r.dayIndex === 1 && r.fromK === 0)!;
    const out = applyRun(t, run, { minutes: run.keys.map(() => 95), meters: run.keys.map(() => 151_200) });
    expect(day(out.plan, 1).legs[0]?.minutes).toBe(95);
    expect(out.meters[run.keys[0]]).toBe(151_200);
    expect(kmLabel(151_200)).toBe('151.2km');
  });
});

describe('daySummary (day heading)', () => {
  it('adds up the timed legs, gives km only when every timed leg has a distance, and counts unknown legs', () => {
    const t = sampleTrip();
    const d = day(t, 2);
    const timed = d.legs.filter((l) => l !== null);
    const s0 = daySummary(t, 2, {});
    expect(s0.driveMinutes).toBe(timed.reduce((a, l) => a + l!.minutes, 0));
    expect(s0.unknownLegs).toBe(d.legs.length - timed.length);
    expect(s0.meters).toBeNull(); // no distances known
    const keys = legKeys(t, 2);
    const all = Object.fromEntries(keys.flatMap((k, i) => (k && d.legs[i] ? [[k, 1000 * (i + 1)]] : [])));
    const s1 = daySummary(t, 2, all);
    expect(s1.meters).toBe(Object.values(all).reduce((a, m) => a + m, 0));
    // one timed leg without a distance → no total km
    const firstTimed = keys.findIndex((k, i) => k && d.legs[i]);
    const partial = { ...all };
    delete partial[keys[firstTimed]!];
    expect(daySummary(t, 2, partial).meters).toBeNull();
  });

  it('ends when the last leg arrives, follows a later start, and counts an emptied leg as unknown', () => {
    const t = sampleTrip();
    const base = daySummary(t, 2, {});
    expect(base.endAt).not.toBeNull();
    const later = daySummary(t, 2, {}, base.endAt! - 60); // leave much later
    expect(later.endAt!).toBeGreaterThan(base.endAt!);
    const emptied = setLeg(t, 2, 0, null);
    const s = daySummary(emptied, 2, {});
    expect(s.unknownLegs).toBe(base.unknownLegs + 1);
    expect(s.driveMinutes).toBe(base.driveMinutes - day(t, 2).legs[0]!.minutes);
  });
});

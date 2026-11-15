import { beforeEach, describe, expect, it } from 'vitest';
import { dayIssues, sampleTrip, type Trip } from '@tteonaljido/shared';
import { applyFaster, daySig, dismiss, findFaster, isDismissed, MIN_SAVED } from './fasterOrder';
import { metresE7, shorterDayOrder } from './recommend';
import { allRuns, applyRun, type LegRun } from './routeTimes';

/** Minutes the fake "Kakao" drives: proportional to the straight line (`perKm` minutes a kilometre). */
const fakeKakao = (perKm: number) => async (run: LegRun) => {
  const minutes = run.points.slice(1).map((p, i) => Math.max(1, Math.ceil((metresE7(run.points[i].latE7, run.points[i].lonE7, p.latE7, p.lonE7)! / 1000) * perKm)));
  return { minutes, meters: minutes.map((m) => m * 500) };
};

const place = (t: Trip, ref: string) => t.places.find((p) => p.placeRef === ref)!;
const visitPlace = (t: Trip, id: string) => place(t, t.visits.find((v) => v.visitId === id)!.placeRef);

/** Day 3 of the sample as a zigzag: v8 sits right by the night's hotel (the end), v9 right by the morning's (the start). */
async function zigzag(perKm = 2): Promise<Trip> {
  const t = sampleTrip();
  const start = place(t, t.days[1].lodgingPlaceRef!); // day 3 starts at day 2's lodging
  const end = place(t, t.days[2].lodgingPlaceRef!);
  Object.assign(visitPlace(t, 'v8'), { latE7: end.latE7! + 20_000, lonE7: end.lonE7! + 20_000 });
  Object.assign(visitPlace(t, 'v9'), { latE7: start.latE7! + 20_000, lonE7: start.lonE7! + 20_000 });
  // the current order's legs, timed by the same fake Kakao
  let p = t;
  for (const run of allRuns(p, null).filter((r) => r.dayIndex === 3)) p = applyRun(p, run, (await fakeKakao(perKm)(run))!, { overwrite: true }).plan;
  return p;
}

describe('더 빠른 순서', () => {
  beforeEach(() => localStorage.clear());

  it('finds the straight-line shortcut and confirms it with driving times', async () => {
    const t = await zigzag();
    expect(t.days[2].visitOrder).toEqual(['v8', 'v9']);
    expect(shorterDayOrder(t, null, 3)).toEqual(['v9', 'v8']);
    const s = await findFaster(t, null, 3, new Map(), fakeKakao(2));
    expect(s).not.toBeNull();
    expect(s).not.toBe('wait');
    if (!s || s === 'wait') return;
    expect(s.order).toEqual(['v9', 'v8']);
    expect(s.saved).toBeGreaterThanOrEqual(MIN_SAVED);
    expect(s.sig).toBe(daySig(t, null, 3));
    const applied = applyFaster(t, s);
    expect(applied.days[2].visitOrder).toEqual(['v9', 'v8']);
    expect(applied.days[2].legs.map((l) => l?.minutes ?? null)).toEqual(s.legs);
    expect(applied.days[1]).toEqual(t.days[1]); // other days untouched
  });

  it('stays quiet when the saving is under 10 minutes, or the day is already the shortest', async () => {
    const slow = await zigzag(0.05); // every leg ~1 minute: nothing worth switching for
    expect(await findFaster(slow, null, 3, new Map(), fakeKakao(0.05))).toBeNull();
    const t = sampleTrip();
    expect(await findFaster(t, null, 4, new Map(), fakeKakao(2))).toBeNull(); // one stop
  });

  it('waits for the day to be timed first', async () => {
    const t = await zigzag();
    t.days[2].legs[1] = null;
    expect(await findFaster(t, null, 3, new Map(), fakeKakao(2))).toBe('wait');
  });

  it('never offers an order that makes a fixed time late', async () => {
    const t = await zigzag();
    // v8 fixed just after the current order reaches it: going to v9 first would be late
    const v8 = t.visits.find((v) => v.visitId === 'v8')!;
    v8.fixed = { time: '11:30', kind: 'RESERVATION' };
    expect(dayIssues(t, 3).filter((x) => x.severity === 'CONFLICT')).toHaveLength(0);
    expect(await findFaster(t, null, 3, new Map(), fakeKakao(2))).toBeNull();
  });

  it('keeps timed stops (fixed or 희망) in time order', async () => {
    const t = await zigzag();
    expect(shorterDayOrder(t, null, 3)).toEqual(['v9', 'v8']);
    t.visits.find((v) => v.visitId === 'v8')!.desiredTime = '10:30';
    t.visits.find((v) => v.visitId === 'v9')!.desiredTime = '13:00';
    expect(shorterDayOrder(t, null, 3)).toBeNull(); // the shortcut would put 13:00 before 10:30
    t.visits.find((v) => v.visitId === 'v8')!.desiredTime = null; // only one timed stop: free to move around it
    expect(shorterDayOrder(t, null, 3)).toEqual(['v9', 'v8']);
  });

  it('a closed suggestion stays closed for that shape of the day', () => {
    expect(isDismissed('trip1', 'sig')).toBe(false);
    dismiss('trip1', 'sig');
    expect(isDismissed('trip1', 'sig')).toBe(true);
    expect(isDismissed('trip1', 'other')).toBe(false);
  });
});

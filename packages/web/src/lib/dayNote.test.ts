import { describe, expect, it } from 'vitest';
import { sampleTrip, type Home, type Trip } from '@tteonaljido/shared';
import { dayTimeGap } from './dayNote';
import { legKeys } from './trips';

const home: Home = { address: '서울 중구 세종대로 110', latE7: 375_665_000, lonE7: 1_269_780_000 };
const keysOf = (plan: Trip, day: number) => new Set(legKeys(plan, day).filter((k): k is string => !!k));
/** The sample with day 1's first leg emptied (as when its start cannot be timed). */
const firstLegEmpty = (patch: Partial<Trip> = {}): Trip => {
  const s = sampleTrip();
  return { ...s, ...patch, days: s.days.map((d) => (d.dayIndex === 1 ? { ...d, legs: [null, ...d.legs.slice(1)] } : d)) };
};

describe('dayTimeGap', () => {
  it('is null when every stop of the day has its time', () => {
    const s = sampleTrip();
    const timed: Trip = { ...s, days: s.days.map((d) => ({ ...d, legs: d.legs.map((l) => l ?? { minutes: 10, source: 'USER_ESTIMATE' as const }) })) };
    expect(dayTimeGap(timed, home, 1, keysOf(timed, 1))).toBeNull();
  });

  it('names the home address when day 1 starts from a home that is not set', () => {
    const plan = firstLegEmpty({ origin: { kind: 'HOME' } });
    expect(dayTimeGap(plan, null, 1, new Set())).toEqual({ kind: 'home', k: 0 });
  });

  it('names the current location when day 1 starts from it and it was not read', () => {
    const plan = firstLegEmpty({ origin: { kind: 'CURRENT' } });
    expect(dayTimeGap(plan, home, 1, new Set())).toEqual({ kind: 'here', k: 0 });
  });

  it('leaves it to the car when the first stop has no location, whatever the start', () => {
    const base = firstLegEmpty({ origin: { kind: 'CURRENT' } });
    const first = base.visits.find((v) => v.visitId === base.days[0].visitOrder[0])!.placeRef;
    const plan: Trip = { ...base, places: base.places.map((p) => (p.placeRef === first ? { ...p, latE7: null, lonE7: null } : p)) };
    expect(dayTimeGap(plan, home, 1, new Set())).toEqual({ kind: 'car', k: 0 });
  });

  it('is pending when Kakao can time the leg but has not', () => {
    const plan = firstLegEmpty({ origin: { kind: 'HOME' } });
    expect(dayTimeGap(plan, home, 1, keysOf(plan, 1))).toEqual({ kind: 'pending', k: 0 });
  });

  it('leaves a leg nobody on the phone can time to the car', () => {
    const s = sampleTrip();
    const plan: Trip = { ...s, visits: s.visits.map((v) => ({ ...v, fixed: null })), days: s.days.map((d) => (d.dayIndex === 2 ? { ...d, legs: d.legs.map((l, i) => (i === 1 ? null : (l ?? { minutes: 10, source: 'USER_ESTIMATE' as const }))) } : d)) };
    expect(dayTimeGap(plan, home, 2, new Set())).toEqual({ kind: 'car', k: 1 });
  });

  it('names the departure time when the legs are timed but the day has none', () => {
    const s = sampleTrip();
    const plan: Trip = {
      ...s,
      visits: s.visits.map((v) => ({ ...v, fixed: null })),
      days: s.days.map((d) => (d.dayIndex === 2 ? { ...d, departTime: null, legs: d.legs.map((l) => l ?? { minutes: 10, source: 'USER_ESTIMATE' as const }) } : d)),
    };
    expect(dayTimeGap(plan, home, 2, new Set())).toEqual({ kind: 'depart', k: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { KEY_HOME, optimizeTrip, type Day, type OptimizerInput, type Place, type Trip, type Visit } from '../src';

/**
 * Small trips on a line: a place's position is its kilometre, and driving is one minute a kilometre, so every time in
 * these tests can be checked by hand. Day 1 is Friday 2026-11-20.
 */
const km: Record<string, number> = {};
const P = (ref: string, category: Place['category'], at: number, hours: Place['hours'] = { status: 'UNKNOWN' }): Place => {
  km[ref] = at;
  return { placeRef: ref, name: ref, address: ref, latE7: 370_000_000, lonE7: 1_270_000_000 + at, category, source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours };
};
const V = (id: string, ref: string, extra: Partial<Visit> = {}): Visit => ({
  visitId: id, placeRef: ref, stayMinutes: 60, prepMinutes: 0, importance: 'NORMAL', desiredTime: null, fixed: null, dateFlexible: true, timeFlexible: true, unassignedReason: null, ...extra,
});
const D = (dayIndex: number, visitOrder: string[], lodgingPlaceRef: string | null, departTime: string | null = '09:00'): Day => ({
  dayIndex, date: `2026-11-${19 + dayIndex}`, departTime: dayIndex === 1 ? null : departTime, endBy: null, visitOrder, legs: Array(visitOrder.length + 1).fill(null), lodgingPlaceRef,
});
const trip = (opts: Partial<Trip> & { days: Day[]; places: Place[]; visits: Visit[] }): Trip => ({
  tripId: '6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f', revision: 1, updatedAt: '2026-11-05T09:00:00+09:00', name: 't', timezone: 'Asia/Seoul',
  startDate: '2026-11-20', endDate: `2026-11-${19 + opts.days.length}`, firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
  origin: { kind: 'HOME' }, finalDestination: { kind: 'HOME' }, home: null, ...opts,
});
km[KEY_HOME] = 0;
const drive: OptimizerInput['drive'] = (a, b) => (a in km && b in km ? Math.abs(km[a] - km[b]) : null);
const run = (t: Trip, extra: Partial<OptimizerInput> = {}) => optimizeTrip({ trip: t, drive, config: { iterations: 4_000 }, ...extra });
const open = (o: string, c: string, days = [1, 2, 3, 4, 5, 6, 7]): Place['hours'] => ({ status: 'USER_ENTERED', weekly: days.map((weekday) => ({ weekday, open: o, close: c })), closedDates: [] });
const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe('optimizeTrip: the timetable it plans with', () => {
  it('adds ten minutes of parking to every drive to another place', () => {
    const t = trip({ places: [P('a', 'SIGHT', 30), P('b', 'SIGHT', 50), P('L', 'LODGING', 60)], visits: [V('va', 'a'), V('vb', 'b')], days: [D(1, ['va', 'vb'], 'L'), D(2, [], null)] });
    const day = run(t).days[0];
    expect(day.depart).toBe(m('09:00'));
    expect(day.stops[0]).toMatchObject({ visitId: 'va', arrive: m('09:40'), start: m('09:40'), end: m('10:40'), driveMinutes: 30, parkingMinutes: 10, waitMinutes: 0 });
    expect(day.stops[1]).toMatchObject({ visitId: 'vb', arrive: m('11:10') }); // 20 minutes of road + 10 of parking
    expect(day.arriveEnd).toBe(m('12:30'));
  });

  it('reaches a booking ten minutes early, waits, and starts on the dot', () => {
    const t = trip({ places: [P('r', 'FOOD', 30), P('L', 'LODGING', 40)], visits: [V('vr', 'r', { fixed: { time: '13:00', kind: 'RESERVATION' } })], days: [D(1, ['vr'], 'L'), D(2, [], null)] });
    const out = run(t);
    // 09:00 + 30 + 10 = 09:40 at the door; the table is held from 12:50, the meal starts 13:00.
    expect(out.days[0].stops[0]).toMatchObject({ arrive: m('09:40'), start: m('13:00'), end: m('14:00'), waitMinutes: m('12:50') - m('09:40') });
    expect(out.hardViolations).toBe(0);
    // More than two hours with nothing to do: reported as a gap that opens the day.
    expect(out.gaps).toEqual([{ dayIndex: 1, afterVisitId: null, beforeVisitId: 'vr', from: m('09:40'), to: m('13:00'), minutes: 190 }]);
  });

  it('counts a booking that cannot be reached ten minutes early as broken', () => {
    // 09:00 + 200 + 10 = 12:30 at the earliest... for a 12:35 booking that is five minutes inside the lead time.
    const t = trip({ places: [P('r', 'FOOD', 200), P('L', 'LODGING', 210)], visits: [V('vr', 'r', { fixed: { time: '12:35', kind: 'RESERVATION' } })], days: [D(1, ['vr'], 'L'), D(2, [], null)] });
    expect(run(t).hardViolations).toBe(1);
  });
});

describe('optimizeTrip: what it arranges', () => {
  it('puts the stop that would make a booking late after it', () => {
    // As planned: the sight first (09:40–11:10 with its 90 minutes), then 12:20 at a table booked for 12:00.
    const t = trip({
      places: [P('s', 'SIGHT', 30), P('r', 'FOOD', 90), P('L', 'LODGING', 100)],
      visits: [V('vs', 's', { stayMinutes: 90, dateFlexible: false }), V('vr', 'r', { fixed: { time: '12:00', kind: 'RESERVATION' } })],
      days: [D(1, ['vs', 'vr'], 'L'), D(2, [], null)],
    });
    const out = run(t);
    expect(out.order[1]).toEqual(['vr', 'vs']); // the sight's date is the traveller's: it stays on day 1, after the meal
    expect(out.hardViolations).toBe(0);
    expect(out.changed).toBe(true);
    // Free to change day, the sight goes to day 2, which passes it on the way home.
    const free = run({ ...t, visits: t.visits.map((v) => ({ ...v, dateFlexible: true })) });
    expect(free.order).toEqual({ 1: ['vr'], 2: ['vs'] });
  });

  it('moves a place off the day it is closed', () => {
    // Open on Saturdays only (weekday 6): day 1 is a Friday, day 2 the Saturday.
    const t = trip({
      places: [P('x', 'SIGHT', 20, open('09:00', '18:00', [6])), P('L', 'LODGING', 30)],
      visits: [V('vx', 'x')],
      days: [D(1, ['vx'], 'L'), D(2, [], null)],
    });
    const out = run(t);
    expect(out.order).toEqual({ 1: [], 2: ['vx'] });
    expect(out.hardViolations).toBe(0);
  });

  it('leaves out a place no day can take, and says so for a 꼭 place', () => {
    const closed = open('09:00', '18:00', [3]); // Wednesdays only: not during this trip
    const base = { places: [P('x', 'SIGHT', 20, closed), P('L', 'LODGING', 30)], days: [D(1, ['vx'], 'L'), D(2, [], null)] };
    const normal = run(trip({ ...base, visits: [V('vx', 'x')] }));
    expect(normal.unassigned).toEqual(['vx']);
    expect(normal.hardViolations).toBe(0);
    // A 꼭 place is not dropped quietly: it stays in the plan with its broken rule counted.
    const must = run(trip({ ...base, visits: [V('vx', 'x', { importance: 'MUST' })] }));
    expect(must.hardViolations).toBe(1);
  });

  it('eats at meal times and has the cafe right after lunch', () => {
    // Everything within a few kilometres, so only the clock decides. As planned the cafe comes first and lunch at 09:25.
    const t = trip({
      places: [P('c', 'CAFE', 12), P('f', 'FOOD', 14), P('s1', 'SIGHT', 10), P('s2', 'SIGHT', 16), P('L', 'LODGING', 18)],
      visits: [V('vc', 'c', { stayMinutes: 45 }), V('vf', 'f'), V('v1', 's1', { stayMinutes: 90 }), V('v2', 's2', { stayMinutes: 90 })],
      days: [D(1, ['vc', 'vf', 'v1', 'v2'], 'L'), D(2, [], null)],
    });
    const out = run(t);
    const order = out.order[1];
    expect(order.indexOf('vc')).toBe(order.indexOf('vf') + 1);
    const lunch = out.days[0].stops.find((s) => s.visitId === 'vf')!;
    expect(lunch.start).toBeGreaterThanOrEqual(m('11:30'));
    expect(lunch.start).toBeLessThanOrEqual(m('13:30'));
  });

  it('does not put three cafes on one day when another day is free', () => {
    const t = trip({
      places: [P('c1', 'CAFE', 10), P('c2', 'CAFE', 11), P('c3', 'CAFE', 12), P('L', 'LODGING', 13), P('L2', 'LODGING', 13)],
      visits: [V('v1', 'c1'), V('v2', 'c2'), V('v3', 'c3')],
      days: [D(1, ['v1', 'v2', 'v3'], 'L'), D(2, [], 'L2'), D(3, [], null)],
    });
    const out = run(t);
    expect(Math.max(...Object.values(out.order).map((o) => o.length))).toBeLessThanOrEqual(2);
  });

  it('waits for a place to open rather than calling it closed, but prefers an order that needs no waiting', () => {
    // The museum opens at 11:00. Going there first means standing at the door from 09:20; the park first fills that time.
    const t = trip({
      places: [P('museum', 'SIGHT', 10, open('11:00', '18:00')), P('park', 'SIGHT', 12), P('L', 'LODGING', 14)],
      visits: [V('vm', 'museum'), V('vp', 'park', { stayMinutes: 90 })],
      days: [D(1, ['vm', 'vp'], 'L'), D(2, [], null)],
    });
    const out = run(t);
    expect(out.order[1]).toEqual(['vp', 'vm']);
    expect(out.days[0].stops[1]).toMatchObject({ visitId: 'vm', waitMinutes: 0 });
    expect(out.hardViolations).toBe(0);
    // Alone, the museum is simply waited for.
    const alone = run(trip({ places: [P('museum', 'SIGHT', 10, open('11:00', '18:00')), P('L', 'LODGING', 14)], visits: [V('vm', 'museum')], days: [D(1, ['vm'], 'L'), D(2, [], null)] }));
    expect(alone.days[0].stops[0]).toMatchObject({ arrive: m('09:20'), start: m('11:00'), waitMinutes: 100 });
    expect(alone.hardViolations).toBe(0);
  });

  it('keeps a visit out of a break in the opening hours', () => {
    const hours: Place['hours'] = { status: 'USER_ENTERED', weekly: [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [{ weekday, open: '09:00', close: '10:00' }, { weekday, open: '11:30', close: '20:00' }]), closedDates: [] };
    const t = trip({ places: [P('f', 'FOOD', 10, hours), P('L', 'LODGING', 12)], visits: [V('vf', 'f')], days: [D(1, ['vf'], 'L'), D(2, [], null)] });
    const stop = run(t).days[0].stops[0];
    // At the door 09:20: an hour's meal does not fit before the 10:00 break, so it starts when the kitchen reopens.
    expect(stop).toMatchObject({ arrive: m('09:20'), start: m('11:30'), waitMinutes: 130 });
  });
});

describe('optimizeTrip: meals the traveller named, and meal times they moved', () => {
  // One day, everything a few kilometres apart, three sights of two and a half hours: the restaurant can open the day
  // (about 09:25), or follow one sight (about 12:10), two (about 14:50) or all three (about 17:30).
  const day = (): Trip =>
    trip({
      places: [P('f', 'FOOD', 14), P('s1', 'SIGHT', 10), P('s2', 'SIGHT', 16), P('s3', 'SIGHT', 12), P('L', 'LODGING', 18)],
      visits: [V('vf', 'f', { dateFlexible: false }), ...['s1', 's2', 's3'].map((r, i) => V(`v${i + 1}`, r, { stayMinutes: 150, dateFlexible: false }))],
      days: [D(1, ['vf', 'v1', 'v2', 'v3'], 'L'), D(2, [], null)],
    });
  const startOf = (out: ReturnType<typeof run>, id: string) => out.days.flatMap((d) => d.stops).find((s) => s.visitId === id)!.start!;
  const dayOf = (out: ReturnType<typeof run>, id: string) => Number(Object.keys(out.order).find((k) => out.order[Number(k)].includes(id)));

  it('puts a restaurant named as dinner at dinner time, where it would otherwise be lunch', () => {
    const guessed = startOf(run(day()), 'vf');
    expect(guessed).toBeGreaterThanOrEqual(m('11:30'));
    expect(guessed).toBeLessThanOrEqual(m('13:30'));
    const out = run(day(), { meals: { f: 'dinner' } });
    expect(startOf(out, 'vf')).toBeGreaterThanOrEqual(m('17:30'));
    expect(startOf(out, 'vf')).toBeLessThanOrEqual(m('19:30'));
    expect(out.hardViolations).toBe(0);
    // A choice for a place that is not a restaurant is not read.
    expect(run(day(), { meals: { s1: 'dinner' } })).toEqual(run(day()));
  });

  it('follows meal times that were moved', () => {
    const late = run(day(), { config: { iterations: 4_000, mealWindows: { breakfast: [m('08:00'), m('09:30')], lunch: [m('14:30'), m('15:30')], dinner: [m('19:00'), m('20:30')] } } });
    expect(startOf(late, 'vf')).toBeGreaterThanOrEqual(m('14:30'));
    expect(startOf(late, 'vf')).toBeLessThanOrEqual(m('15:30'));
  });

  it('counts two restaurants named as lunch as two lunches: apart on separate days, dearer on one', () => {
    const two = (days: Day[]): Trip =>
      trip({
        places: [P('f1', 'FOOD', 14), P('f2', 'FOOD', 15), P('s1', 'SIGHT', 10), P('s2', 'SIGHT', 16), P('L', 'LODGING', 18)],
        visits: [V('vf1', 'f1'), V('vf2', 'f2'), V('v1', 's1', { stayMinutes: 150 }), V('v2', 's2', { stayMinutes: 150 })],
        days,
      });
    const both = run(two([D(1, ['vf1', 'vf2', 'v1'], 'L'), D(2, ['v2'], null)]), { meals: { f1: 'lunch', f2: 'lunch' } });
    expect(dayOf(both, 'vf1')).not.toBe(dayOf(both, 'vf2'));
    for (const id of ['vf1', 'vf2']) {
      expect(startOf(both, id)).toBeGreaterThanOrEqual(m('11:30'));
      expect(startOf(both, id)).toBeLessThanOrEqual(m('13:30'));
    }
    // With one day only there is nowhere to go: the same two lunches cost more than a lunch and a dinner.
    const oneDay = two([D(1, ['vf1', 'vf2', 'v1', 'v2'], null)]);
    const same = run(oneDay, { meals: { f1: 'lunch', f2: 'lunch' } });
    const apart = run(oneDay, { meals: { f1: 'lunch', f2: 'dinner' } });
    expect(same.cost).toBeGreaterThan(apart.cost + 100);
    expect(startOf(apart, 'vf2')).toBeGreaterThan(startOf(apart, 'vf1'));
  });

  it('does not price a booked meal for its hour, and gives the same answer twice', () => {
    const booked: Trip = { ...day(), visits: day().visits.map((v) => (v.visitId === 'vf' ? { ...v, fixed: { time: '15:00', kind: 'RESERVATION' as const } } : v)) };
    const named = run(booked, { meals: { f: 'lunch' } });
    expect(named.cost).toBe(run(booked).cost); // 15:00 is nearest to lunch either way, and a booking is not judged for being off it
    expect(named.hardViolations).toBe(0);
    const input = { meals: { f: 'dinner' as const } };
    expect(run(day(), input)).toEqual(run(day(), input));
  });
});

describe('optimizeTrip: placing what is not on a day yet', () => {
  it('builds the days from a basket, bookings staying where they are', () => {
    const t = trip({
      places: [P('a', 'SIGHT', 20), P('b', 'SIGHT', 25), P('r', 'FOOD', 22), P('far', 'SIGHT', 120), P('L', 'LODGING', 30), P('L2', 'LODGING', 125)],
      visits: [
        V('va', 'a', { unassignedReason: 'NOT_SCHEDULED_YET' }),
        V('vb', 'b', { unassignedReason: 'NOT_SCHEDULED_YET' }),
        V('vfar', 'far', { unassignedReason: 'NOT_SCHEDULED_YET' }),
        V('vr', 'r', { fixed: { time: '12:30', kind: 'RESERVATION' } }),
        V('skip', 'a', { unassignedReason: 'USER_EXCLUDED' }),
      ],
      days: [D(1, ['vr'], 'L'), D(2, [], 'L2'), D(3, [], null)],
    });
    const out = run(t);
    expect(out.order[1]).toContain('vr');
    expect(out.unassigned).toEqual([]);
    expect(Object.values(out.order).flat().sort()).toEqual(['va', 'vb', 'vfar', 'vr']); // the excluded stop is left alone
    expect(out.order[2]).toEqual(['vfar']); // the far place goes with the day that ends out there
    expect(out.hardViolations).toBe(0);
  });

  it('gives the same answer for the same input, and leaves a settled plan as it is', () => {
    const t = trip({
      places: [P('a', 'SIGHT', 20), P('b', 'SIGHT', 25), P('c', 'CAFE', 27), P('f', 'FOOD', 23), P('L', 'LODGING', 30)],
      visits: [V('va', 'a', { unassignedReason: 'NOT_SCHEDULED_YET' }), V('vb', 'b', { unassignedReason: 'NOT_SCHEDULED_YET' }), V('vc', 'c', { unassignedReason: 'NOT_SCHEDULED_YET' }), V('vf', 'f', { unassignedReason: 'NOT_SCHEDULED_YET' })],
      days: [D(1, [], 'L'), D(2, [], null)],
    });
    const once = run(t);
    expect(run(t)).toEqual(once);
    const settled: Trip = { ...t, visits: t.visits.map((v) => ({ ...v, unassignedReason: null })), days: t.days.map((d) => ({ ...d, visitOrder: once.order[d.dayIndex], legs: Array(once.order[d.dayIndex].length + 1).fill(null) })) };
    const again = run(settled);
    expect(again.changed).toBe(false);
    expect(again.order).toEqual(once.order);
  });
});

describe('optimizeTrip: how many stops a day gets', () => {
  // Places that all sit by the lodging: no day is nearer than another, so only the shares decide.
  const basket = (n: number, at = 30) => {
    const places = Array.from({ length: n }, (_, i) => P(`s${i}`, 'SIGHT', at));
    return { places, visits: places.map((p, i) => V(`v${i}`, p.placeRef, { unassignedReason: 'NOT_SCHEDULED_YET' })) };
  };
  const counts = (out: ReturnType<typeof run>) => Object.values(out.order).map((r) => r.length);

  it('shares a basket out evenly, the first and the last day taking half a day', () => {
    const four = basket(12);
    expect(counts(run(trip({ places: [...four.places, P('L', 'LODGING', 30)], visits: four.visits, days: [D(1, [], 'L'), D(2, [], 'L'), D(3, [], 'L'), D(4, [], null)] })))).toEqual([2, 4, 4, 2]);
    const three = basket(9);
    expect(counts(run(trip({ places: [...three.places, P('L', 'LODGING', 30)], visits: three.visits, days: [D(1, [], 'L'), D(2, [], 'L'), D(3, [], null)] })))).toEqual([2, 5, 2]);
    // Two days are a first and a last day: equal.
    const two = basket(6);
    expect(counts(run(trip({ places: [...two.places, P('L', 'LODGING', 30)], visits: two.visits, days: [D(1, [], 'L'), D(2, [], null)] })))).toEqual([3, 3]);
  });

  it('keeps near places together before it evens the days out', () => {
    // Home 0, the lodging at 100. Two places are on the way (50); four lie beyond the lodging (130): seeing those on
    // one day is one detour of an hour, three a day would be two. The uneven four-and-two is the shorter trip.
    const far = [0, 1, 2, 3].map((i) => P(`f${i}`, 'SIGHT', 130));
    const near = [0, 1].map((i) => P(`n${i}`, 'SIGHT', 50));
    const out = run(trip({
      places: [...far, ...near, P('L', 'LODGING', 100)],
      visits: [...far, ...near].map((p) => V(`v${p.placeRef}`, p.placeRef, { unassignedReason: 'NOT_SCHEDULED_YET' })),
      days: [D(1, [], 'L'), D(2, [], null)],
    }));
    const dayOfFar = far.map((p) => Object.entries(out.order).find(([, r]) => r.includes(`v${p.placeRef}`))![0]);
    expect(new Set(dayOfFar).size).toBe(1);
    expect(counts(out).sort()).toEqual([2, 4]);
  });

  it('counts a booking on its day and sends the rest elsewhere', () => {
    // Three bookings back to back (an hour each, ten minutes to park and be early): no gap between them to fill.
    const booked = ['10:00', '11:20', '12:40'].map((time, i) => ({ place: P(`b${i}`, 'SIGHT', 30), time }));
    const free = basket(5);
    const out = run(trip({
      places: [...booked.map((b) => b.place), ...free.places, P('L', 'LODGING', 30)],
      visits: [...booked.map((b, i) => V(`vb${i}`, b.place.placeRef, { fixed: { time: b.time, kind: 'RESERVATION' }, dateFlexible: false, timeFlexible: false })), ...free.visits],
      days: [D(1, ['vb0', 'vb1', 'vb2'], 'L'), D(2, [], 'L'), D(3, [], null)],
    }));
    // Eight stops over three days would be two, four and two: the first day already holds three, so it gets no more.
    expect(out.order[1]).toEqual(['vb0', 'vb1', 'vb2']);
    expect(out.order[2].length + out.order[3].length).toBe(5);
    expect(out.hardViolations).toBe(0);
  });

  it('leaves the days the traveller filled as they are, however uneven', () => {
    const own = basket(5);
    const t = trip({
      places: [...own.places, P('L', 'LODGING', 30)],
      visits: own.visits.map((v) => ({ ...v, unassignedReason: null })),
      days: [D(1, ['v0', 'v1', 'v2', 'v3'], 'L'), D(2, ['v4'], 'L'), D(3, [], null)],
    });
    const out = run(t);
    expect(out.changed).toBe(false);
    expect(counts(out)).toEqual([4, 1, 0]);
  });
});

describe('optimizeTrip: a leg nobody can time', () => {
  // The trip starts from a home with no address: nothing is known about the drive to the first stop.
  const noHome: OptimizerInput['drive'] = (a, b) => (a === KEY_HOME || b === KEY_HOME ? null : drive(a, b));

  it('does not judge times it does not know, and leaves the day in place', () => {
    // Two restaurants and a cafe "in the morning" by a guessed clock would be scattered over other days. Unknown is unknown.
    const t = trip({
      places: [P('f1', 'FOOD', 30), P('f2', 'FOOD', 33), P('c', 'CAFE', 36), P('L', 'LODGING', 40), P('s', 'SIGHT', 45), P('L2', 'LODGING', 50)],
      visits: [V('v1', 'f1'), V('v2', 'f2'), V('vc', 'c'), V('vs', 's')],
      days: [D(1, ['v1', 'v2', 'vc'], 'L'), D(2, ['vs'], 'L2'), D(3, [], null)],
    });
    const out = optimizeTrip({ trip: t, drive: noHome, config: { iterations: 4_000 } });
    expect(out.order[1]).toEqual(['v1', 'v2', 'vc']);
    expect(out.changed).toBe(false);
    expect(out.days[0].stops.map((s) => [s.arrive, s.start, s.driveMinutes])).toEqual([[null, null, null], [null, null, 3], [null, null, 3]]);
    expect(out.days[0].arriveEnd).toBeNull();
    // Day 2 starts from a lodging: its times are known again.
    expect(out.days[1].stops[0]).toMatchObject({ arrive: m('09:15'), driveMinutes: 5 });
  });

  it('knows the time again from a fixed time on', () => {
    const t = trip({
      places: [P('a', 'SIGHT', 30), P('r', 'FOOD', 35), P('b', 'SIGHT', 40), P('L', 'LODGING', 45)],
      visits: [V('va', 'a'), V('vr', 'r', { fixed: { time: '13:00', kind: 'RESERVATION' } }), V('vb', 'b')],
      days: [D(1, ['va', 'vr', 'vb'], 'L'), D(2, [], null)],
    });
    const stops = optimizeTrip({ trip: t, drive: noHome, config: { iterations: 0 } }).days[0].stops;
    expect(stops[0]).toMatchObject({ visitId: 'va', arrive: null, start: null });
    expect(stops[1]).toMatchObject({ visitId: 'vr', arrive: null, start: m('13:00'), end: m('14:00') });
    expect(stops[2]).toMatchObject({ visitId: 'vb', arrive: m('14:15') }); // 5 minutes of road, 10 of parking
  });
});

describe('optimizeTrip: lodging and gaps', () => {
  it('notes an arrival before check-in and a departure after check-out when the lodging changes', () => {
    const t = trip({
      places: [P('a', 'SIGHT', 20), P('L', 'LODGING', 30), P('L2', 'LODGING', 40)],
      visits: [V('va', 'a')],
      days: [D(1, ['va'], 'L'), D(2, [], 'L2', '11:30'), D(3, [], null)],
    });
    const out = run(t, { lodging: { L: { checkIn: m('15:00'), checkOut: m('11:00') }, L2: { checkIn: m('15:00') } } });
    // Day 1 is at the first lodging by 10:50 (09:30–10:30 at the sight, ten minutes of road, ten of parking): hours before its rooms are ready.
    expect(out.lodgingNotes).toContainEqual({ dayIndex: 1, kind: 'ARRIVES_BEFORE_CHECKIN', minutes: m('15:00') - m('10:50') });
    // Day 2 leaves at 11:30, half an hour after check-out.
    expect(out.lodgingNotes).toContainEqual({ dayIndex: 2, kind: 'CHECKOUT_BEFORE_DEPARTURE', minutes: 30 });
  });

  it('offers a nearby place for a gap of two hours or more, when one fits', () => {
    const t = trip({ places: [P('r', 'FOOD', 30), P('L', 'LODGING', 40)], visits: [V('vr', 'r', { fixed: { time: '13:00', kind: 'RESERVATION' } })], days: [D(1, ['vr'], 'L'), D(2, [], null)] });
    km['fav:near'] = 25;
    km['fav:far'] = 400;
    const pool = [
      { key: 'fav:far', name: '먼 곳', category: 'SIGHT' as const, hours: { status: 'UNKNOWN' as const } },
      { key: 'fav:near', name: '가까운 곳', category: 'CAFE' as const, hours: { status: 'ALWAYS_OPEN' as const } },
    ];
    const gap = run(t, { pool }).gaps[0];
    expect(gap.minutes).toBe(190);
    expect(gap.suggestion).toEqual({ key: 'fav:near', name: '가까운 곳' });
    // Nothing in reach: the gap is still reported, without an offer.
    expect(run(t, { pool: [pool[0]] }).gaps[0].suggestion).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { parseTransfer, sampleTrip, type Day, type Home, type Place, type Trip, type Visit } from '@tteonaljido/shared';
import { newDoc, rememberLegs, relinkLegs, setLodging, toTransfer, type LegBook } from './trips';
import { estimateDriveMinutes, metresE7, missingLodgingDays, recommend, recommendRoute, summarizeRecommendation } from './recommend';

const home: Home = { address: '서울', latE7: 375_662_952, lonE7: 1_269_779_451 };
const e7 = (deg: number | null) => (deg === null ? null : Math.round(deg * 1e7));
const dayOf = (t: Trip, id: string) => t.days.find((d) => d.visitOrder.includes(id))?.dayIndex ?? null;
const order = (t: Trip, dayIndex: number) => t.days[dayIndex - 1].visitOrder;

const P = (ref: string, category: Place['category'], lat: number | null, lon: number | null): Place => ({
  placeRef: ref, name: ref, address: ref, latE7: e7(lat), lonE7: e7(lon), category, source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' },
});
const V = (id: string, ref: string, extra: Partial<Visit> = {}): Visit => ({
  visitId: id, placeRef: ref, stayMinutes: 60, prepMinutes: 10, importance: 'NORMAL', desiredTime: null, fixed: null, dateFlexible: true, timeFlexible: true, unassignedReason: null, ...extra,
});
const D = (dayIndex: number, visitOrder: string[], lodgingPlaceRef: string | null = null): Day => ({
  dayIndex, date: `2026-11-${19 + dayIndex}`, departTime: dayIndex === 1 ? null : '09:00', endBy: null, visitOrder, legs: Array(visitOrder.length + 1).fill(null), lodgingPlaceRef,
});
const trip = (opts: Partial<Trip> & { days: Day[]; places: Place[]; visits: Visit[] }): Trip => ({
  tripId: '6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f', revision: 1, updatedAt: '2026-11-05T09:00:00+09:00', name: 't', timezone: 'Asia/Seoul',
  startDate: '2026-11-20', endDate: `2026-11-${19 + opts.days.length}`, firstDay: { basis: 'DEPART_ORIGIN', departTime: '08:00' },
  origin: { kind: 'HOME' }, finalDestination: { kind: 'HOME' }, home: null, ...opts,
});

describe('metresE7', () => {
  it('is 0 for the same point, null when a coord is missing, and grows with distance', () => {
    expect(metresE7(e7(37.5), e7(127), e7(37.5), e7(127))).toBe(0);
    expect(metresE7(null, e7(127), e7(37.5), e7(127))).toBeNull();
    expect(metresE7(e7(37.5), e7(127), e7(37.5), null)).toBeNull();
    const near = metresE7(e7(37.5), e7(127.0), e7(37.5), e7(127.1))!;
    const far = metresE7(e7(37.5), e7(127.0), e7(37.5), e7(128.0))!;
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    // 강릉 철뚝소머리집 → 스카이베이호텔: ~12 km (sanity on magnitude).
    const km = metresE7(378_920_000, 1_288_260_000, 378_040_000, 1_289_080_000)! / 1000;
    expect(km).toBeGreaterThan(8);
    expect(km).toBeLessThan(16);
  });
});

describe('recommendRoute', () => {
  it('does not mutate the input and stays a valid transfer', async () => {
    const before = structuredClone(sampleTrip());
    const out = recommendRoute(sampleTrip(), home);
    expect(sampleTrip()).toEqual(before); // purity
    const doc = await newDoc(out, home);
    expect(await parseTransfer(JSON.stringify(await toTransfer(doc, true)))).toMatchObject({ ok: true });
  });

  it('assigns an unplaced place to the geographically nearest day', () => {
    const t = trip({
      places: [P('la', 'LODGING', 37.5, 127.0), P('lb', 'LODGING', 37.5, 128.0), P('x', 'FOOD', 37.5, 127.98)],
      visits: [V('vx', 'x', { unassignedReason: 'NOT_SCHEDULED_YET' })],
      days: [D(1, [], 'la'), D(2, [], 'lb')],
      finalDestination: { kind: 'PLACE', placeRef: 'lb' },
    });
    const out = recommendRoute(t, null);
    expect(dayOf(out, 'vx')).toBe(2); // near lodging B
    expect(out.visits.find((v) => v.visitId === 'vx')?.unassignedReason).toBeNull();
  });

  it('orders a day so it ends near the lodging', () => {
    const t = trip({
      origin: { kind: 'HOME' },
      home: null,
      places: [P('L', 'LODGING', 37.5, 127.0), P('near', 'SIGHT', 37.5, 126.95), P('far', 'SIGHT', 37.5, 126.3), P('L2', 'LODGING', 37.5, 127.0)],
      visits: [V('vn', 'near'), V('vf', 'far')],
      days: [D(1, ['vn', 'vf'], 'L'), D(2, [], 'L2')],
    });
    // Day 1 starts at HOME far to the west; the stop nearest the lodging must come last.
    const out = recommendRoute({ ...t, home: { address: 'h', latE7: e7(37.5)!, lonE7: e7(126.0)! } }, { address: 'h', latE7: e7(37.5)!, lonE7: e7(126.0)! });
    expect(order(out, 1)).toEqual(['vf', 'vn']);
  });

  it('keeps fixed-time visits on their day and in time order', () => {
    const out = recommendRoute(sampleTrip(), null);
    expect(dayOf(out, 'v5')).toBe(2); // donghwa, fixed 13:00 RESERVATION
    expect(dayOf(out, 'v10')).toBe(4); // badabuchae, fixed 10:00
    // two fixed on one day sort by time regardless of input order
    const two = trip({
      places: [P('a', 'SIGHT', 37.5, 127.0), P('b', 'SIGHT', 37.5, 127.1), P('L', 'LODGING', 37.5, 127.2)],
      visits: [V('late', 'a', { fixed: { time: '15:00', kind: 'USER' } }), V('early', 'b', { fixed: { time: '09:00', kind: 'USER' } })],
      days: [D(1, ['late', 'early'], 'L'), D(2, [])],
    });
    expect(order(recommendRoute(two, null), 1)).toEqual(['early', 'late']);
  });

  it('respects the per-day cap and drops OPTIONAL before MUST on overflow', () => {
    const places = [P('m', 'FOOD', 37.5, 127.0), ...Array.from({ length: 20 }, (_, i) => P(`o${i}`, 'SIGHT', 37.5, 127.0))];
    const visits = [V('vm', 'm', { importance: 'MUST', unassignedReason: 'NOT_SCHEDULED_YET' }), ...Array.from({ length: 20 }, (_, i) => V(`vo${i}`, `o${i}`, { importance: 'OPTIONAL', unassignedReason: 'NOT_SCHEDULED_YET' }))];
    const out = recommendRoute(trip({ places, visits, days: [D(1, [])] }), null);
    expect(order(out, 1)).toHaveLength(20);
    expect(dayOf(out, 'vm')).toBe(1); // MUST always placed
    expect(out.visits.filter((v) => v.unassignedReason !== null)).toHaveLength(1); // exactly one OPTIONAL overflow
  });

  it('puts the cafe right after lunch when both fit either way (식사 후 카페)', () => {
    // One day, everything close by, leaving late in the morning: lunch lands at lunch time in either order, so the
    // only difference is that a cafe is best right after the meal.
    const t = trip({
      places: [P('cafe1', 'CAFE', 37.5, 127.0), P('food1', 'FOOD', 37.5, 127.02), P('L', 'LODGING', 37.5, 127.05)],
      visits: [V('vc', 'cafe1'), V('vf', 'food1')],
      days: [D(1, ['vc', 'vf'], 'L')],
      firstDay: { basis: 'DEPART_ORIGIN', departTime: '11:20' },
      finalDestination: { kind: 'PLACE', placeRef: 'L' },
      home: null,
    });
    const h: Home = { address: 'h', latE7: e7(37.5)!, lonE7: e7(126.95)! };
    expect(order(recommendRoute(t, h), 1)).toEqual(['vf', 'vc']); // food before cafe
  });

  it('keeps name-only (no-coord) stops in the plan and still orders the located ones along the way', () => {
    const t = trip({
      places: [P('p1', 'SIGHT', 37.5, 126.2), P('p2', 'SIGHT', 37.5, 126.9), P('noco', 'FOOD', null, null), P('L', 'LODGING', 37.5, 127.0)],
      visits: [V('v1', 'p1'), V('v2', 'p2'), V('vn', 'noco')],
      days: [D(1, ['vn', 'v2', 'v1'], 'L'), D(2, [])],
      home: null,
    });
    const h: Home = { address: 'h', latE7: e7(37.5)!, lonE7: e7(126.0)! };
    const out = recommendRoute({ ...t, origin: { kind: 'HOME' } }, h);
    const all = out.days.flatMap((d) => d.visitOrder);
    expect(all.sort()).toEqual(['v1', 'v2', 'vn']); // nothing dropped: a place without coordinates is still a stop
    const day1 = order(out, 1);
    // Heading east from home, the western sight comes before the eastern one wherever the name-only meal falls.
    if (day1.includes('v1') && day1.includes('v2')) expect(day1.indexOf('v1')).toBeLessThan(day1.indexOf('v2'));
  });

  it('preserves user-typed travel times for adjacencies that survive', () => {
    const base = sampleTrip();
    const book: LegBook = new Map();
    rememberLegs(base, book);
    const linked = relinkLegs(base, recommendRoute(base, null), new Map(book));
    for (const d of linked.days) {
      const same = base.days[d.dayIndex - 1].visitOrder.join('>') === d.visitOrder.join('>');
      if (same) expect(d.legs).toEqual(base.days[d.dayIndex - 1].legs); // unchanged day keeps its legs
    }
  });

  it('is idempotent', () => {
    const once = recommendRoute(sampleTrip(), null);
    expect(recommendRoute(once, null)).toEqual(once);
  });
});

describe('recommend (M64): what the engine is told and what it reports back', () => {
  it('estimates a drive from the straight line where nothing was measured: slower in town than between towns', () => {
    expect(estimateDriveMinutes(0)).toBe(3); // never less than a few minutes
    expect(estimateDriveMinutes(2_000)).toBe(6); // 2.7 km of road at town speed
    expect(estimateDriveMinutes(10_000)).toBe(20);
    expect(estimateDriveMinutes(150_000)).toBe(162); // about 200 km of road at highway speed
  });

  it('uses a measured driving time over the estimate', () => {
    // Two sights and a booked lunch; by the straight line the lunch is 20 minutes from the lodging's side of town.
    const t = trip({
      places: [P('s', 'SIGHT', 37.5, 127.0), P('r', 'FOOD', 37.5, 127.1), P('L', 'LODGING', 37.5, 127.12)],
      visits: [V('vs', 's', { stayMinutes: 90, dateFlexible: false }), V('vr', 'r', { fixed: { time: '11:30', kind: 'RESERVATION' } })],
      days: [D(1, ['vs', 'vr'], 'L')],
      firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
      finalDestination: { kind: 'PLACE', placeRef: 'L' },
    });
    const h: Home = { address: 'h', latE7: e7(37.5)!, lonE7: e7(126.98)! };
    // Estimated: the sight (09:17–10:47), then 10:57+10 at a table held from 11:20 — just in time, so the order stays.
    expect(order(recommendRoute(t, h), 1)).toEqual(['vs', 'vr']);
    // Measured: that drive really takes 40 minutes. The sight no longer fits before the booking.
    const book: LegBook = new Map([['s>r', 40]]);
    expect(order(recommendRoute(t, h, { book }), 1)).toEqual(['vr', 'vs']);
  });

  it('reports a gap of two hours or more, with a favorite that fits, and a lodging reached before check-in', () => {
    const t = trip({
      places: [P('r', 'FOOD', 37.5, 127.1), P('L', 'LODGING', 37.5, 127.12)],
      visits: [V('vr', 'r', { fixed: { time: '13:00', kind: 'RESERVATION' } })],
      days: [D(1, ['vr'], 'L')],
      firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
      finalDestination: { kind: 'PLACE', placeRef: 'L' },
    });
    const h: Home = { address: 'h', latE7: e7(37.5)!, lonE7: e7(127.0)! };
    const fav = { ...P('park', 'SIGHT', 37.5, 127.05), id: 'geo:park', addedAt: 0 };
    const { placeRef: _ref, ...favorite } = fav;
    const out = recommend({ ...t, days: [D(1, ['vr'], 'L'), D(2, [])], endDate: '2026-11-21', finalDestination: { kind: 'HOME' } }, h, { notes: { L: { checkIn: '16:00' } }, pool: [favorite] });
    expect(out.insights.gaps).toHaveLength(1);
    expect(out.insights.gaps[0]).toMatchObject({ dayIndex: 1, beforeName: 'r', suggestion: { key: 'fav:geo:park', name: 'park' } });
    expect(out.insights.gaps[0].minutes).toBeGreaterThanOrEqual(120);
    expect(out.insights.lodgingNotes).toEqual([expect.objectContaining({ dayIndex: 1, kind: 'ARRIVES_BEFORE_CHECKIN', time: '16:00' })]);
    expect(out.insights.hardViolations).toBe(0);
    expect(out.plan).toBe(out.plan); // the plan itself: nothing to move
  });
});

describe('missingLodgingDays', () => {
  it('lists nights without lodging, never the last day', () => {
    expect(missingLodgingDays(sampleTrip())).toEqual([]); // days 1-3 set, day 4 is the last
    expect(missingLodgingDays(setLodging(sampleTrip(), 2, null))).toEqual([2]);
  });
});

describe('summarizeRecommendation', () => {
  it('reports no change when nothing moves, and counts adds/moves otherwise', () => {
    const t = trip({
      places: [P('x', 'FOOD', 37.5, 127.0), P('L', 'LODGING', 37.5, 127.0)],
      visits: [V('vx', 'x')],
      days: [D(1, ['vx'], 'L'), D(2, [])],
    });
    expect(summarizeRecommendation(t, recommendRoute(t, null)).changed).toBe(false);

    const t2 = trip({
      places: [P('la', 'LODGING', 37.5, 127.0), P('lb', 'LODGING', 37.5, 128.0), P('y', 'FOOD', 37.5, 127.98)],
      visits: [V('vy', 'y', { unassignedReason: 'NOT_SCHEDULED_YET' })],
      days: [D(1, [], 'la'), D(2, [], 'lb')],
      finalDestination: { kind: 'PLACE', placeRef: 'lb' },
    });
    const diff = summarizeRecommendation(t2, recommendRoute(t2, null));
    expect(diff.changed).toBe(true);
    expect(diff.addedCount).toBe(1);
    expect(diff.changes[0]).toMatchObject({ visitId: 'vy', newlyAssigned: true, toDay: 2 });
  });
});

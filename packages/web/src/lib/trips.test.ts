import { describe, expect, it, vi } from 'vitest';
import { parseTransfer, sampleTrip, type Trip } from '@tteonaljido/shared';
import { stopRangeText, waitBeforeStart, suggestVisitTime, updateVisit, fillNights, laterEmptyNights, lodgingSuggestions, addPlace, addToDay, cleanLodgingTbd, cleanSetup, moveToDay, placeRoom, setReservation, setupReady, assign, changeCategory, emptyPlan, isEndpointOnly, move, moveTo, endpointFromPreset, newDoc, nodeIssues, planWarnings, relinkLegs, rememberLegs, removePlace, savePlan, setDepart, setEndBy, setLeg, setEndpoint, setLodging, setOrigin, setPeriod, startFromPreset, toTransfer, unassign, type LegBook } from './trips';

// The warning assertions below check the Korean copy; jsdom reports navigator.language as en-US.
vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));

const home = { address: '서울특별시 중구 세종대로 110', latE7: 375_662_952, lonE7: 1_269_779_451 };
const day = (t: Trip, i: number) => t.days[i - 1];

describe('trip edits keep the transfer valid', () => {
  it('every edit sequence still parses as a valid transfer', async () => {
    let t = sampleTrip();
    t = unassign(t, 'v2');
    t = assign(t, 'v11', 3);
    t = move(t, 2, 0, 1);
    t = setLeg(t, 2, 1, 25);
    t = addPlace(t, { name: '주문진 수산시장', address: '강릉시 주문진읍', latE7: 378_930_000, lonE7: 1_288_260_000, category: 'FOOD', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } });
    t = removePlace(t, 'lake');
    t = setPeriod(t, '2026-11-21', '2026-11-23');
    const doc = await newDoc(t, home);
    expect(await parseTransfer(JSON.stringify(await toTransfer(doc, true)))).toMatchObject({ ok: true });
  });

  it('moveTo reorders a day to an arbitrary index and clears the affected legs', () => {
    const base = sampleTrip();
    const t = moveTo(base, 1, 0, 2); // v1 → end of day 1 (v1,v2,v3 → v2,v3,v1)
    expect(day(t, 1).visitOrder).toEqual(['v2', 'v3', 'v1']);
    expect(day(t, 1).legs.every((l) => l === null)).toBe(true); // every leg between the ends is re-checked
    expect(day(t, 2).visitOrder).toEqual(day(base, 2).visitOrder); // other days untouched
  });

  it('moveTo is a no-op when from === to or out of range', () => {
    const base = sampleTrip();
    expect(day(moveTo(base, 1, 1, 1), 1).visitOrder).toEqual(day(base, 1).visitOrder);
    expect(day(moveTo(base, 1, 1, 1), 1).legs).toEqual(day(base, 1).legs);
    expect(day(moveTo(base, 1, 0, 9), 1).visitOrder).toEqual(day(base, 1).visitOrder);
  });

  it('removing a stop marks the travel time across the gap unknown', () => {
    const t = unassign(sampleTrip(), 'v2');
    expect(day(t, 1).visitOrder).toEqual(['v1', 'v3']);
    expect(day(t, 1).legs).toEqual([null, null, { minutes: 20, source: 'USER_ESTIMATE' }]);
    expect(t.visits.find((v) => v.visitId === 'v2')?.unassignedReason).toBe('NOT_SCHEDULED_YET');
  });

  it('shortening the period keeps dropped visits as unassigned (never deleted)', () => {
    const t = setPeriod(sampleTrip(), '2026-11-20', '2026-11-21');
    expect(t.days).toHaveLength(2);
    for (const id of ['v8', 'v9', 'v10']) expect(t.visits.find((v) => v.visitId === id)?.unassignedReason).toBe('OUTSIDE_PERIOD');
    expect(t.visits).toHaveLength(sampleTrip().visits.length);
  });

  it('moving the trip keeps each day plan and only re-dates it', () => {
    const t = setPeriod(sampleTrip(), '2026-12-01', '2026-12-04');
    expect(t.days.map((d) => d.date)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
    expect(day(t, 2).visitOrder).toEqual(day(sampleTrip(), 2).visitOrder);
  });

  it('refuses more than 14 days', () => {
    expect(() => setPeriod(sampleTrip(), '2026-11-20', '2026-12-10')).toThrow();
  });

  it('lodging places get no visit; others start unassigned', () => {
    const base = { address: '', latE7: 377_000_000, lonE7: 1_289_000_000, source: { provider: 'MANUAL' as const, externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' as const } };
    const t = addPlace(addPlace(sampleTrip(), { ...base, name: '새 숙소', category: 'LODGING' }), { ...base, name: '새 카페', category: 'CAFE' });
    expect(t.visits).toHaveLength(sampleTrip().visits.length + 1);
    expect(t.visits.at(-1)?.unassignedReason).toBe('NOT_SCHEDULED_YET');
  });
});

describe('revision and consent', () => {
  it('saving an unchanged plan does not bump the revision; a real change does', async () => {
    const doc = await newDoc(sampleTrip());
    const same = await savePlan(doc, structuredClone(doc.plan), null);
    expect(same.revision).toBe(doc.revision);
    const changed = await savePlan(doc, { ...doc.plan, name: '강릉 바다 여행' }, null);
    expect(changed.revision).toBe(doc.revision + 1);
  });

  it('home address leaves the phone only with consent', async () => {
    const doc = await newDoc(sampleTrip(), home);
    expect((await toTransfer(doc, false)).trip.home).toBeNull();
    expect((await toTransfer(doc, true)).trip.home).toEqual(home);
  });

  it('the transfer is a whitelist copy even if the stored doc carries extra fields', async () => {
    const doc = await newDoc(sampleTrip());
    const polluted = { ...doc, plan: { ...doc.plan, memo: '예약번호 1234' } as unknown as Trip };
    expect(await parseTransfer(JSON.stringify(await toTransfer(polluted, false)))).toMatchObject({ ok: false, code: 'SCHEMA' });
  });
});

describe('warnings', () => {
  it('flags missing lodging, unassigned fixed visits and unknown travel times', () => {
    let t = sampleTrip();
    t = { ...t, days: t.days.map((d) => (d.dayIndex === 2 ? { ...d, lodgingPlaceRef: null } : d)) };
    t = unassign(t, 'v5');
    const texts = planWarnings(t, null).map((w) => w.text).join('\n');
    expect(texts).toContain('2일차 밤에 묵을 숙소');
    expect(texts).toContain("고정 일정 '강릉짬뽕순두부 동화가든 본점'");
    expect(texts).toContain('이동시간이 비어 있는 구간');
    expect(texts).toContain("차량 내비의 '집'");
  });
});

describe('places added by name only', () => {
  it('a place without coordinates still makes a valid transfer', async () => {
    const t = addPlace(sampleTrip(), { name: '묵호 논골담길', address: '', latE7: null, lonE7: null, category: 'OTHER', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } });
    const doc = await newDoc(t);
    expect(await parseTransfer(JSON.stringify(await toTransfer(doc, false)))).toMatchObject({ ok: true });
  });
});

describe('travel times follow their pair of places', () => {
  const relink = (prev: Trip, next: Trip, book: LegBook) => {
    const linked = relinkLegs(prev, next, book);
    rememberLegs(linked, book);
    return linked;
  };

  it('moving stops back restores the typed times; the reverse direction is not reused', () => {
    const book: LegBook = new Map();
    const t0 = sampleTrip(); // day 2: skybay → v4 lake (5) → v5 donghwa (10) → v6 mandong (15) → v7 umji (10) → shilla (15)
    rememberLegs(t0, book);
    const swapped = relink(t0, move(t0, 2, 1, 1), book); // lake, mandong, donghwa, umji
    // lake>mandong and donghwa>umji were never typed; mandong>donghwa is the reverse of donghwa>mandong (15): not reused
    expect(day(swapped, 2).legs.map((l) => l?.minutes ?? null)).toEqual([5, null, null, null, 15]);
    const back = relink(swapped, move(swapped, 2, 1, 1), book);
    expect(day(back, 2).legs.map((l) => l?.minutes ?? null)).toEqual([5, 10, 15, 10, 15]);
  });

  it('removing and re-adding a stop keeps the times typed for each pair', () => {
    const book: LegBook = new Map();
    const t0 = sampleTrip();
    rememberLegs(t0, book);
    const without = relink(t0, unassign(t0, 'v7'), book);
    expect(day(without, 2).legs.map((l) => l?.minutes ?? null)).toEqual([5, 10, 15, null]); // mandong → shilla never typed
    const again = relink(without, assign(without, 'v7', 2), book);
    expect(day(again, 2).legs.map((l) => l?.minutes ?? null)).toEqual([5, 10, 15, 10, 15]);
  });

  it('a lodging change re-checks the legs on both nights it touches', () => {
    const book: LegBook = new Map();
    const t0 = sampleTrip();
    rememberLegs(t0, book);
    const moved = relink(t0, setLodging(t0, 1, 'shilla'), book);
    expect(day(moved, 1).legs.at(-1)).toBeNull(); // bohemian → shilla: unknown
    expect(day(moved, 2).legs[0]).toBeNull(); // shilla → lake: unknown
    const back = relink(moved, setLodging(moved, 1, 'skybay'), book);
    expect(day(back, 1).legs.at(-1)?.minutes).toBe(20);
    expect(day(back, 2).legs[0]?.minutes).toBe(5);
  });

  it('clearing a leg forgets it', () => {
    const book: LegBook = new Map();
    const t0 = sampleTrip();
    rememberLegs(t0, book);
    const cleared = relink(t0, setLeg(t0, 2, 0, null), book);
    expect(book.has('skybay>lake')).toBe(false);
    expect(day(cleared, 2).legs[0]).toBeNull();
  });
});

describe('timetable on the phone', () => {
  it('a missed fixed time is a warning before sending', () => {
    const late = setDepart(sampleTrip(), 4, '09:55');
    const w = planWarnings(late, home).filter((x) => x.level === 'warning').map((x) => x.text);
    expect(w).toContain("4일차 '정동심곡바다부채길' 고정 10:00에 늦어요 (예상 10:05)");
  });

  it('a return-by time that the day runs past is a warning', () => {
    const t = setEndBy(sampleTrip(), 2, '16:00');
    expect(day(t, 2).endBy).toBe('16:00');
    expect(planWarnings(t, home).map((x) => x.text)).toContain('2일차 도착 예상 16:10 · 목표 16:00보다 늦어요');
  });

  it('unknown opening hours leave lodging out, as the car does', () => {
    expect(planWarnings(sampleTrip(), home).map((x) => x.text)).toContain('영업정보 미확인 11곳');
  });
});

describe('travel times before lodging is set', () => {
  const market = { name: '주문진 수산시장', address: '강릉시 주문진읍', latE7: 378_930_000, lonE7: 1_288_260_000, category: 'FOOD' as const, source: { provider: 'MANUAL' as const, externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' as const } };

  it('keeps a typed time on a leg whose far end is not set yet, through later edits', () => {
    const book: LegBook = new Map();
    let t = addPlace(emptyPlan('6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f'), market); // 2 days, no lodging yet
    t = assign(t, t.visits[0].visitId, 1);
    rememberLegs(t, book);
    const typed = relinkLegs(t, setLeg(t, 1, 1, 30), book); // the leg towards the still-unset lodging
    rememberLegs(typed, book);
    expect(day(typed, 1).legs[1]?.minutes).toBe(30);
    const renamed = relinkLegs(typed, { ...typed, name: '강릉' }, book);
    expect(day(renamed, 1).legs[1]?.minutes).toBe(30);
  });
});

describe('changing a place category keeps the visit in sync', () => {
  it('a non-lodging place gains a visit, a lodging place loses it', () => {
    let t = sampleTrip();
    const n0 = t.visits.length;
    t = changeCategory(t, 'skybay', 'FOOD'); // skybay is lodging (no visit) → gains one
    expect(t.visits.filter((v) => v.placeRef === 'skybay').length).toBe(1);
    expect(t.visits.length).toBe(n0 + 1);
    t = changeCategory(t, 'cheolttuk', 'LODGING'); // a food place → loses its visit, off its day
    expect(t.visits.some((v) => v.placeRef === 'cheolttuk')).toBe(false);
    expect(t.days.every((d) => d.visitOrder.every((id) => t.visits.some((v) => v.visitId === id)))).toBe(true);
  });
});

describe('start presets (설정 › 회사·즐겨찾기)', () => {
  const work = { name: '현대자동차 본사', address: '서울 서초구 헌릉로 12', latE7: 374_634_000, lonE7: 1_270_394_000 };
  const gym = { name: '양재 체육관', address: '서울 서초구 양재동', latE7: 374_700_000, lonE7: 1_270_300_000 };

  it('a preset joins as an endpoint-only place (no visit) and becomes the start; the transfer stays valid', async () => {
    const base = sampleTrip();
    const t = startFromPreset(base, work);
    const p = t.places.find((x) => x.name === work.name)!;
    expect(t.origin).toEqual({ kind: 'PLACE', placeRef: p.placeRef });
    expect(t.visits.some((v) => v.placeRef === p.placeRef)).toBe(false);
    expect(isEndpointOnly(t, p.placeRef)).toBe(true);
    expect(t.visits.length).toBe(base.visits.length); // no new unassigned stop
    expect(await parseTransfer(JSON.stringify(await toTransfer(await newDoc(t, home), true)))).toMatchObject({ ok: true });
  });

  it('reuses the copy already in the trip instead of adding it twice', () => {
    const once = startFromPreset(sampleTrip(), work);
    const twice = startFromPreset(setOrigin(once, { kind: 'HOME' }), work);
    expect(twice.places.filter((x) => x.name === work.name)).toHaveLength(1);
  });

  it('switching start drops the old preset place, but keeps it while it is the final destination', () => {
    const atWork = startFromPreset(sampleTrip(), work);
    const ref = (atWork.origin as { placeRef: string }).placeRef;
    expect(startFromPreset(atWork, gym).places.some((x) => x.placeRef === ref)).toBe(false);
    expect(setOrigin(atWork, { kind: 'HOME' }).places.some((x) => x.placeRef === ref)).toBe(false);
    const roundTrip = { ...atWork, finalDestination: { kind: 'PLACE' as const, placeRef: ref } };
    expect(setOrigin(roundTrip, { kind: 'HOME' }).places.some((x) => x.placeRef === ref)).toBe(true);
  });

  it('never drops a real stop or lodging when the start moves away from it', () => {
    const base = sampleTrip();
    const stop = base.visits[0].placeRef;
    const fromStop = setOrigin(base, { kind: 'PLACE', placeRef: stop });
    expect(setOrigin(fromStop, { kind: 'HOME' }).places.some((x) => x.placeRef === stop)).toBe(true);
  });
});

describe('timeline nodes (M26)', () => {
  const market = { name: '주문진 수산시장', address: '강릉시 주문진읍', latE7: 378_930_000, lonE7: 1_288_260_000, category: 'FOOD' as const, source: { provider: 'MANUAL' as const, externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' as const } };

  it('sorts conflicts onto the node that shows them', () => {
    const late = setEndBy(setDepart(sampleTrip(), 4, '09:55'), 2, '16:00');
    const d4 = nodeIssues(late, 4);
    expect(Object.values(d4.byVisit).flat().map((i) => i.code)).toContain('LATE_FOR_FIXED'); // on the stop it is about
    expect(nodeIssues(late, 2).end.map((i) => i.code)).toEqual(['PAST_END_BY']); // on the lodging/home card
    expect(nodeIssues(sampleTrip(), 1).other).toEqual([]);
  });

  it('a picked place lands at the end of the day being viewed', () => {
    const base = sampleTrip();
    const r = addToDay(base, market, 2);
    expect(r.placed).toBe('day');
    const v = r.plan.visits[r.plan.visits.length - 1];
    expect(day(r.plan, 2).visitOrder.at(-1)).toBe(v.visitId);
    expect(v.unassignedReason).toBeNull();
  });

  it('a lodging fills an unset night, otherwise it is just kept in the trip', () => {
    const inn = { ...market, name: '경포 게스트하우스', category: 'LODGING' as const };
    const open = setLodging(sampleTrip(), 1, null);
    const r = addToDay(open, inn, 1);
    expect(r.placed).toBe('lodging');
    expect(day(r.plan, 1).lodgingPlaceRef).toBe(r.plan.places.at(-1)!.placeRef);
    expect(addToDay(sampleTrip(), inn, 1).placed).toBe('kept'); // night 1 already has lodging
    expect(addToDay(open, inn, open.days.length).placed).toBe('kept'); // the last day ends at home
  });

  it('a full day keeps the new place in the 보관함 instead of failing', () => {
    let t = sampleTrip();
    while (day(t, 1).visitOrder.length < 20) t = addToDay(t, market, 1).plan;
    const r = addToDay(t, market, 1);
    expect(r.placed).toBe('pool');
    expect(r.reason).toBeTruthy();
    expect(r.plan.visits.at(-1)!.unassignedReason).toBe('NOT_SCHEDULED_YET');
  });
});

describe('return destination presets (M27)', () => {
  const work = { name: '현대자동차 본사', address: '서울 서초구 헌릉로 12', latE7: 374_634_000, lonE7: 1_270_394_000 };
  const gym = { name: '양재 체육관', address: '서울 서초구 양재동', latE7: 374_700_000, lonE7: 1_270_300_000 };

  it('ending at a saved place adds it as an endpoint-only place and the transfer stays valid', async () => {
    const t = endpointFromPreset(sampleTrip(), 'finalDestination', work);
    const p = t.places.find((x) => x.name === work.name)!;
    expect(t.finalDestination).toEqual({ kind: 'PLACE', placeRef: p.placeRef });
    expect(isEndpointOnly(t, p.placeRef)).toBe(true);
    expect(await parseTransfer(JSON.stringify(await toTransfer(await newDoc(t, home), true)))).toMatchObject({ ok: true });
  });

  it('starting and ending at the same saved place shares one place', () => {
    const t = endpointFromPreset(startFromPreset(sampleTrip(), work), 'finalDestination', work);
    expect(t.places.filter((x) => x.name === work.name)).toHaveLength(1);
    expect(t.origin).toEqual(t.finalDestination);
  });

  it('changing the return drops the old place unless the start still uses it', () => {
    const atGym = endpointFromPreset(sampleTrip(), 'finalDestination', gym);
    const ref = (atGym.finalDestination as { placeRef: string }).placeRef;
    expect(setEndpoint(atGym, 'finalDestination', { kind: 'HOME' }).places.some((x) => x.placeRef === ref)).toBe(false);
    const both = startFromPreset(atGym, gym);
    expect(setEndpoint(both, 'finalDestination', { kind: 'HOME' }).places.some((x) => x.placeRef === ref)).toBe(true);
  });
});

describe('place limits (100 places / 100 visits)', () => {
  it('refuses a place past the limit instead of building a trip the car would reject', () => {
    let t: Trip = emptyPlan();
    const p = { name: '장소', address: '', latE7: 375_000_000, lonE7: 1_270_000_000, category: 'SIGHT' as const, hours: { status: 'UNKNOWN' as const }, source: { provider: 'MANUAL' as const, externalId: null }, naviPoi: null };
    for (let i = 0; i < 100; i++) t = addPlace(t, { ...p, name: `장소 ${i}` });
    expect(placeRoom(t)).toBe(0);
    expect(() => addPlace(t, p)).toThrow();
  });
});

describe('a place gets its day only from its details (moveToDay, M40)', () => {
  it('puts a whole-trip place at the end of the chosen day', () => {
    const t0 = sampleTrip();
    const pooled = t0.visits.find((v) => v.unassignedReason !== null)!;
    const t1 = moveToDay(t0, pooled.visitId, 2);
    expect(day(t1, 2).visitOrder.at(-1)).toBe(pooled.visitId);
    expect(t1.visits.find((v) => v.visitId === pooled.visitId)?.unassignedReason).toBeNull();
    expect(day(t1, 2).legs.length).toBe(day(t1, 2).visitOrder.length + 1);
  });
  it('moves a stop from one day to the end of another, keeping legs = stops + 1 on both', () => {
    const t0 = sampleTrip();
    const id = day(t0, 2).visitOrder[0];
    const t1 = moveToDay(t0, id, 3);
    expect(day(t1, 2).visitOrder).not.toContain(id);
    expect(day(t1, 3).visitOrder.at(-1)).toBe(id);
    for (const d of [2, 3]) expect(day(t1, d).legs.length).toBe(day(t1, d).visitOrder.length + 1);
  });
  it('leaves the plan alone when the stop is already on that day', () => {
    const t0 = sampleTrip();
    const id = day(t0, 2).visitOrder[0];
    expect(moveToDay(t0, id, 2)).toBe(t0);
  });
});

describe('nights marked 미정 (M41, phone-only)', () => {
  it('silence the missing-lodging warning for that night only', () => {
    const t0 = setLodging(setLodging(sampleTrip(), 1, null), 2, null);
    const texts = (tbd: number[]) => planWarnings(t0, null, tbd).map((w) => w.text);
    expect(texts([]).filter((x) => x.includes('숙소')).length).toBe(2);
    expect(texts([1]).filter((x) => x.includes('숙소')).length).toBe(1);
    expect(texts([1, 2]).filter((x) => x.includes('숙소')).length).toBe(0);
  });
  it('keep only nights that exist and still have no lodging', () => {
    const t0 = setLodging(sampleTrip(), 1, null); // night 1 empty, nights 2–3 have lodging, day 4 is the last day
    expect(cleanLodgingTbd([1, 2, 4, 9, 1, 'x'], t0)).toEqual([1]);
    expect(cleanLodgingTbd(undefined, t0)).toEqual([]);
  });
});

describe('new-trip setup (M43)', () => {
  it('step 1 needs a name and every night settled (lodging or 미정); step 2 needs a place', () => {
    const t0 = { ...setLodging(sampleTrip(), 1, null), name: '' };
    expect(setupReady(t0, [], 1).ok).toBe(false);
    const named = { ...t0, name: '강릉' };
    expect(setupReady(named, [], 1)).toMatchObject({ ok: false });
    expect(setupReady(named, [1], 1).ok).toBe(true);
    expect(setupReady({ ...emptyPlan(), visits: [] }, [], 2).ok).toBe(false);
    expect(setupReady(sampleTrip(), [], 3).ok).toBe(true);
  });
  it('a reservation pins the visit to its day and time; lifting it frees the visit again', () => {
    const t0 = sampleTrip();
    const pooled = t0.visits.find((v) => v.unassignedReason !== null)!;
    const booked = setReservation(t0, pooled.visitId, 2, '12:00');
    const v = booked.visits.find((x) => x.visitId === pooled.visitId)!;
    expect(v.fixed).toEqual({ time: '12:00', kind: 'RESERVATION' });
    expect(v.timeFlexible).toBe(false);
    expect(day(booked, 2).visitOrder).toContain(pooled.visitId);
    const freed = setReservation(booked, pooled.visitId, null, null);
    const f = freed.visits.find((x) => x.visitId === pooled.visitId)!;
    expect(f.fixed).toBeNull();
    expect(f.unassignedReason).not.toBeNull();
  });
  it('reads a stored setup state; anything else counts as done', () => {
    expect(cleanSetup({ done: false, step: 3 })).toEqual({ done: false, step: 3 });
    expect(cleanSetup({ done: false, step: 9 })).toEqual({ done: false, step: 1 });
    expect(cleanSetup(undefined)).toBeNull();
    expect(cleanSetup({ done: true, step: 4 })).toBeNull();
  });
});

describe('이어서 묵기 (M49)', () => {
  // sample: night 1 skybay, night 2 shilla, night 3 topsten; clear nights 2 and 3 to plan them
  const base = setLodging(setLodging(sampleTrip(), 2, null), 3, null);

  it('offers the nearest earlier night first, then later nights, then the other lodging places, each once', () => {
    const s2 = lodgingSuggestions(base, 2).map((p) => p.placeRef);
    expect(s2[0]).toBe('skybay'); // night 1's hotel, the one you are already in
    expect(new Set(s2).size).toBe(s2.length);
    expect(s2).toEqual(expect.arrayContaining(['shilla', 'topsten'])); // the trip's other lodgings still offered
    const t = setLodging(base, 3, 'topsten');
    expect(lodgingSuggestions(t, 2).map((p) => p.placeRef).slice(0, 2)).toEqual(['skybay', 'topsten']);
  });

  it('fills only the later empty nights that were not left 미정', () => {
    expect(laterEmptyNights(base, 1, [])).toEqual([2, 3]);
    expect(laterEmptyNights(base, 1, [2])).toEqual([3]); // 미정 stays 미정
    expect(laterEmptyNights(base, 3, [])).toEqual([]); // the last night: nothing after it (the last day has no night)
    const filled = fillNights(base, laterEmptyNights(base, 1, []), 'skybay');
    expect(filled.days.slice(0, -1).map((d) => d.lodgingPlaceRef)).toEqual(['skybay', 'skybay', 'skybay']);
    expect(filled.days.at(-1)!.lodgingPlaceRef).toBeNull();
  });
});

describe('suggested stop time (M50)', () => {
  const t0 = sampleTrip();
  const d2 = t0.days[1].visitOrder; // day 2: v4 v5(fixed 13:00) v6 v7

  it('suggests 09:00 for the first stop and a place on no day', () => {
    expect(suggestVisitTime(t0, d2[0])).toBe('09:00');
    expect(suggestVisitTime(t0, 'no-such-visit')).toBe('09:00');
  });

  it('is one hour after the nearest earlier timed stop, on the half hour, at most 23:30', () => {
    const fixed = t0.visits.find((v) => v.visitId === d2[1])!.fixed!.time;
    const plus1 = `${String(Number(fixed.slice(0, 2)) + 1).padStart(2, '0')}:${fixed.slice(3)}`;
    expect(suggestVisitTime(t0, d2[2])).toBe(plus1);
    expect(suggestVisitTime(t0, d2[3])).toBe(plus1); // the stop between has no time of its own: look further back
    const odd = updateVisit(t0, d2[2], { desiredTime: '14:10' });
    expect(suggestVisitTime(odd, d2[3])).toBe('15:30'); // 15:10 rounds up to the half hour
    const late = updateVisit(t0, d2[2], { desiredTime: '23:10' });
    expect(suggestVisitTime(late, d2[3])).toBe('23:30');
  });

  it('for a stop about to join a day, looks at every stop already on it', () => {
    const fixed = t0.visits.find((v) => v.visitId === d2[1])!.fixed!.time;
    const plus1 = `${String(Number(fixed.slice(0, 2)) + 1).padStart(2, '0')}:${fixed.slice(3)}`;
    expect(suggestVisitTime(t0, 'not-on-day-2-yet', 2)).toBe(plus1);
    expect(suggestVisitTime(t0, 'x', 99)).toBe('09:00');
  });
});

describe('compact card times (M51)', () => {
  it('writes a stop as start ~ end, the stay added on', () => {
    expect(stopRangeText({ start: 14 * 60 + 10, end: 15 * 60 + 10 })).toBe('14:10 ~ 15:10');
    expect(stopRangeText({ start: 23 * 60 + 30, end: 24 * 60 + 30 })).toBe('23:30 ~ 00:30(+1)'); // past midnight, as the car writes it
    expect(stopRangeText({ start: null, end: null })).toBeNull();
    expect(stopRangeText(undefined)).toBeNull();
  });

  it('finds the wait before a fixed start only from 15 minutes up', () => {
    expect(waitBeforeStart({ arrive: 9 * 60 + 37, start: 13 * 60 })).toBe(203); // 09:37 → 13:00 = 3시간 23분
    expect(waitBeforeStart({ arrive: 12 * 60 + 46, start: 13 * 60 })).toBe(null); // 14 minutes
    expect(waitBeforeStart({ arrive: 12 * 60 + 45, start: 13 * 60 })).toBe(15);
    expect(waitBeforeStart({ arrive: null, start: 13 * 60 })).toBeNull();
    expect(waitBeforeStart({ arrive: 13 * 60, start: 13 * 60 })).toBeNull();
  });
});

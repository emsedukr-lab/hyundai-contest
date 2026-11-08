import { describe, expect, it, vi } from 'vitest';
import { parseTransfer, sampleTrip, type Trip } from '@tteonaljido/shared';
import { addPlace, assign, changeCategory, emptyPlan, isEndpointOnly, move, moveTo, newDoc, planWarnings, relinkLegs, rememberLegs, removePlace, savePlan, setDepart, setEndBy, setLeg, setLodging, setOrigin, setPeriod, startFromPreset, toTransfer, unassign, type LegBook } from './trips';

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
    const late = setDepart(sampleTrip(), 4, '09:45');
    const w = planWarnings(late, home).filter((x) => x.level === 'warning').map((x) => x.text);
    expect(w).toContain("4일차 '정동심곡바다부채길' 고정 10:00에 늦어요 (예상 10:15)");
  });

  it('a return-by time that the day runs past is a warning', () => {
    const t = setEndBy(sampleTrip(), 2, '16:00');
    expect(day(t, 2).endBy).toBe('16:00');
    expect(planWarnings(t, home).map((x) => x.text)).toContain('2일차 도착 예상 16:30 · 목표 16:00보다 늦어요');
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

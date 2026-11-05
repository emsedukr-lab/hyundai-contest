import { describe, expect, it, vi } from 'vitest';
import { parseTransfer, sampleTrip, type Trip } from '@tteonaljido/shared';
import { addPlace, assign, move, newDoc, planWarnings, removePlace, savePlan, setLeg, setPeriod, toTransfer, unassign } from './trips';

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

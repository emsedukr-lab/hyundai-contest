import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { t } from './i18n';
import { dateOverlaps, pickNextTrip, sortOtherTrips, tripWhen } from './nextTrip';
import { nowIso, todayIn, type TripDoc } from './trips';

const doc = (id: string, start: string, end: string, updatedAt = nowIso()): TripDoc => {
  const plan = { ...sampleTrip(nowIso()), tripId: id, startDate: start, endDate: end };
  return { tripId: id, plan, revision: 1, updatedAt, hash: '', home: null } as unknown as TripDoc;
};

describe('다음 여행 (M45)', () => {
  it('says how far away a trip is, which day of it today is, or that it is over', () => {
    expect(tripWhen('2026-11-20', '2026-11-23', '2026-11-09')).toEqual({ label: t('home.next.inDays', { n: 11 }), focusDay: 1 });
    expect(tripWhen('2026-11-20', '2026-11-23', '2026-11-19').label).toBe(t('home.next.tomorrow'));
    expect(tripWhen('2026-11-20', '2026-11-23', '2026-11-20')).toEqual({ label: t('home.next.today'), focusDay: 1 });
    expect(tripWhen('2026-11-20', '2026-11-23', '2026-11-22')).toEqual({ label: t('home.next.onDay', { day: 3 }), focusDay: 3 });
    expect(tripWhen('2026-11-20', '2026-11-23', '2026-11-24')).toEqual({ label: t('home.next.past'), focusDay: null });
  });

  it('puts the trip under way first, else the soonest upcoming, else the most recently edited', () => {
    const today = todayIn('Asia/Seoul');
    const shift = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const past = doc('past', shift(-10), shift(-8));
    const later = doc('later', shift(30), shift(32));
    const soon = doc('soon', shift(5), shift(6));
    const now = doc('now', shift(-1), shift(1));
    expect(pickNextTrip([past, later, soon, now])?.tripId).toBe('now');
    expect(pickNextTrip([past, later, soon])?.tripId).toBe('soon');
    expect(pickNextTrip([past])?.tripId).toBe('past'); // only past trips: the first in list order (most recently edited)
    expect(pickNextTrip([])).toBeNull();
  });
});

describe('다른 여행 order and date overlaps (M49)', () => {
  const today = todayIn('Asia/Seoul');
  const shift = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const named = (id: string, name: string, s: number, e: number) => {
    const d = doc(id, shift(s), shift(e));
    d.plan.name = name;
    return d;
  };

  it('lists trips ahead by departure (then end, then name), then past trips latest first', () => {
    const dec = named('dec', '연말', 40, 42);
    const gangneung = named('gn', '강릉', 14, 17);
    const mokpo = named('mp', '목포 여행', 15, 18);
    const draft = named('nw', '새 여행', 14, 18);
    const old = named('old', '지난봄', -100, -98);
    const older = named('older', '작년', -300, -298);
    const order = sortOtherTrips([dec, gangneung, old, mokpo, older, draft]).map((d) => d.tripId);
    expect(order).toEqual(['gn', 'nw', 'mp', 'dec', 'old', 'older']);
  });

  it('marks each trip with the others whose dates overlap it', () => {
    const a = named('a', '강릉', 14, 17);
    const b = named('b', '목포 여행', 15, 18);
    const c = named('c', '새 여행', 14, 18);
    const d = named('d', '연말', 40, 42);
    const e = named('e', '하루', 17, 17); // touches 강릉's last day: still overlaps
    const map = dateOverlaps([a, b, c, d, e]);
    expect(map.get('a')!.map((x) => x.tripId).sort()).toEqual(['b', 'c', 'e']);
    expect(map.get('b')!.map((x) => x.tripId).sort()).toEqual(['a', 'c', 'e']);
    expect(map.has('d')).toBe(false);
  });
});

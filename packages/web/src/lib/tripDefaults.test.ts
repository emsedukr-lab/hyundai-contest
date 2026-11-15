import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { departure, sampleTrip } from '@tteonaljido/shared';
import { setTripDefaults, tripDefaults } from './settings';
import { collectedPlaces, emptyPlan, endpointFromPreset, setEndBy, setEndpoint, setPeriod } from './trips';

beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
const key = 'tteonaljido.tripDefaults';
const work = { name: '회사', address: '서울 서초구 헌릉로 12', latE7: 374634000, lonE7: 1270394000 };

it('keeps the original defaults when no preference is saved', () => {
  const plan = emptyPlan();
  expect(plan.origin).toEqual({ kind: 'CURRENT' });
  expect(plan.finalDestination).toEqual({ kind: 'HOME' });
  expect(departure(plan, 1)).toBe(9 * 60);
  expect(plan.days.at(-1)?.endBy).toBeNull();
});

it('copies saved endpoints and times into new trips without collecting endpoints as visits', () => {
  let draft = endpointFromPreset(emptyPlan(), 'origin', work);
  draft = setEndpoint(draft, 'finalDestination', draft.origin);
  draft = setEndBy({ ...draft, firstDay: { basis: 'DEPART_ORIGIN', departTime: '18:00' } }, 2, '22:00');
  const existing = sampleTrip();
  const before = structuredClone(existing);
  setTripDefaults(draft);
  const next = emptyPlan();
  expect(next.tripId).not.toBe(draft.tripId);
  expect(next.origin).toEqual(next.finalDestination);
  expect(next.places.map((p) => p.name)).toEqual(['회사']);
  expect(collectedPlaces(next)).toHaveLength(0);
  expect(departure(next, 1)).toBe(18 * 60);
  expect(next.days.at(-1)?.endBy).toBe('22:00');
  expect(existing).toEqual(before);
  const longer = setPeriod(next, '2026-11-17', '2026-11-20');
  expect(longer.days.map((d) => d.endBy)).toEqual([null, null, null, '22:00']);
  expect(setPeriod(longer, '2026-11-17', '2026-11-17').days[0].endBy).toBe('22:00');
});

it('keeps dated arrival constraints on an already scheduled trip when its period changes', () => {
  const plan = setEndBy(setEndBy(sampleTrip(), 2, '19:00'), 4, '22:00');
  const changed = setPeriod(plan, '2026-11-17', '2026-11-18');
  expect(changed.days[1].endBy).toBe('19:00');
});

it('rejects corrupted settings, missing references and invalid final destinations', () => {
  setTripDefaults(emptyPlan());
  const good = tripDefaults()!;
  for (const bad of [
    { ...good, origin: { kind: 'PLACE', placeRef: 'missing' } },
    { ...good, finalDestination: { kind: 'CURRENT' } },
    { ...good, firstDay: { basis: 'DEPART_ORIGIN', departTime: '25:00' } },
    { ...good, endBy: 'noon' },
  ]) {
    localStorage.setItem(key, JSON.stringify(bad));
    expect(tripDefaults()).toBeNull();
    expect(emptyPlan().origin).toEqual({ kind: 'CURRENT' });
  }
  localStorage.setItem(key, '{bad json');
  expect(tripDefaults()).toBeNull();
});

it('reports failed writes and preserves the last saved defaults', () => {
  setTripDefaults(emptyPlan());
  const before = tripDefaults();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  expect(() => setTripDefaults({ ...emptyPlan(), origin: { kind: 'HOME' } })).toThrow();
  expect(tripDefaults()).toEqual(before);
});

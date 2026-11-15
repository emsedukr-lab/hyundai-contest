import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import bundled from '../data/gangneung-example.json';

beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('adds the same validated December example once across simultaneous visits', async () => {
  const { ensureExampleTrip, EXAMPLE_TRIP_ID } = await import('./exampleTrip');
  const { trips } = await import('./db');
  await Promise.all([ensureExampleTrip(), ensureExampleTrip()]);
  expect(await trips.all()).toHaveLength(1);
  const doc = (await trips.get(EXAMPLE_TRIP_ID))!;
  expect(doc.plan).toMatchObject({ startDate: '2026-12-10', endDate: '2026-12-13', home: null });
  expect(doc.home).toBeNull();
  expect(doc.plan.places).toHaveLength(14);
  expect(doc.plan.days.map((d) => doc.plan.places.find((p) => p.placeRef === d.lodgingPlaceRef)?.name ?? null)).toEqual([
    '연곡해변솔향기캠핑장', '강릉오죽한옥마을', '강릉 바다내음 캠핑장', null,
  ]);
  expect(doc.plan.days.flatMap((d) => d.visitOrder)).toHaveLength(11);
});

it('preserves an existing imported or edited example and all personal trips', async () => {
  const { ensureExampleTrip, EXAMPLE_TRIP_ID } = await import('./exampleTrip');
  const { trips } = await import('./db');
  const { checkBackupTrip } = await import('./backup');
  const edited = (await checkBackupTrip(bundled))!;
  edited.plan.name = '내가 수정한 여행';
  const personalId = crypto.randomUUID();
  const personal = { ...edited, tripId: personalId, plan: { ...edited.plan, tripId: personalId, name: '개인 여행' } };
  await trips.put(edited); await trips.put(personal);
  await ensureExampleTrip();
  expect(await trips.get(EXAMPLE_TRIP_ID)).toEqual(edited);
  expect(await trips.get(personal.tripId)).toEqual(personal);
  expect(await trips.all()).toHaveLength(2);
});

it('does not recreate a deleted example even after trash expires', async () => {
  const { ensureExampleTrip, EXAMPLE_TRIP_ID } = await import('./exampleTrip');
  const { trips, trash, TRASH_RETENTION_MS } = await import('./db');
  await ensureExampleTrip(); await trash.move(EXAMPLE_TRIP_ID);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + TRASH_RETENTION_MS + 1);
  await trash.prune(); await ensureExampleTrip();
  expect(await trips.get(EXAMPLE_TRIP_ID)).toBeUndefined();
  expect(await trash.all()).toEqual([]);
});

it('respects an example already in trash before initialization', async () => {
  const { ensureExampleTrip, EXAMPLE_TRIP_ID } = await import('./exampleTrip');
  const { trips, trash } = await import('./db');
  const { checkBackupTrip } = await import('./backup');
  await trips.put((await checkBackupTrip(bundled))!); await trash.move(EXAMPLE_TRIP_ID);
  await ensureExampleTrip();
  expect(await trips.get(EXAMPLE_TRIP_ID)).toBeUndefined();
  expect((await trash.all())[0].tripId).toBe(EXAMPLE_TRIP_ID);
});

it('upgrades version 3 without losing trips, favorites, history or connections', async () => {
  const old = await openDB('tteonaljido', 3, { upgrade(d) {
    d.createObjectStore('trips', { keyPath: 'tripId' }); d.createObjectStore('trash', { keyPath: 'tripId' });
    d.createObjectStore('favorites', { keyPath: 'id' }); d.createObjectStore('pairing', { keyPath: 'sid' });
    const log = d.createObjectStore('sendLog', { keyPath: 'id', autoIncrement: true }); log.createIndex('byTrip', 'tripId');
  } });
  const personal = { ...bundled, tripId: 'personal', plan: { ...bundled.plan, tripId: 'personal' } };
  await old.put('trips', personal); await old.put('favorites', { id: 'favorite' });
  await old.put('pairing', { sid: 'connection' }); await old.put('sendLog', { tripId: 'personal', at: 1 }); old.close();
  const { ensureExampleTrip } = await import('./exampleTrip'); await ensureExampleTrip();
  const upgraded = await openDB('tteonaljido', 4);
  expect(await upgraded.get('trips', 'personal')).toEqual(personal);
  expect(await upgraded.get('favorites', 'favorite')).toEqual({ id: 'favorite' });
  expect(await upgraded.get('pairing', 'connection')).toEqual({ sid: 'connection' });
  expect(await upgraded.count('sendLog')).toBe(1); upgraded.close();
});

it('rolls back both the trip and marker on a storage failure, then allows retry', async () => {
  const { ensureExampleTrip, EXAMPLE_TRIP_ID } = await import('./exampleTrip');
  const { trips } = await import('./db');
  const put = IDBObjectStore.prototype.put;
  const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
    if (this.name === 'meta') throw new DOMException('Full', 'QuotaExceededError');
    return put.apply(this, args);
  });
  await expect(ensureExampleTrip()).rejects.toThrow('Full');
  expect(await trips.get(EXAMPLE_TRIP_ID)).toBeUndefined();
  failure.mockRestore(); await ensureExampleTrip();
  expect(await trips.all()).toHaveLength(1);
});

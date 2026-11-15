import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { trash, trips, TRASH_RETENTION_MS } from './db';
import { emptyPlan, newDoc } from './trips';

let legacyId: string;
beforeAll(async () => {
  const old = await openDB('tteonaljido', 2, { upgrade(db) {
    db.createObjectStore('trips', { keyPath: 'tripId' });
    db.createObjectStore('favorites', { keyPath: 'id' });
    db.createObjectStore('pairing', { keyPath: 'sid' });
    db.createObjectStore('sendLog', { keyPath: 'id', autoIncrement: true });
  } });
  const doc = await newDoc(emptyPlan()); legacyId = doc.tripId;
  await old.put('trips', doc); old.close();
});
afterEach(() => vi.restoreAllMocks());

it('adds trash storage without losing existing trips on upgrade', async () => {
  expect((await trips.get(legacyId))?.tripId).toBe(legacyId);
  expect(await trash.all()).toEqual([]);
});
it('moves and restores the complete trip, including setup and notes', async () => {
  const doc = { ...await newDoc(emptyPlan()), setup: { done: false, step: 2 as const }, notes: { hotel: { memo: '예약 정보' } } };
  await trips.put(doc);
  expect(await trash.move(doc.tripId)).toBe(true);
  expect(await trips.get(doc.tripId)).toBeUndefined();
  expect((await trash.all()).find((e) => e.tripId === doc.tripId)?.doc).toEqual(doc);
  expect(await trash.restore(doc.tripId)).toEqual(doc);
  expect(await trips.get(doc.tripId)).toEqual(doc);
});
it('keeps trips for 30 days and deletes them at expiry', async () => {
  const start = Date.now(); const now = vi.spyOn(Date, 'now').mockReturnValue(start);
  const doc = await newDoc(emptyPlan()); await trips.put(doc); await trash.move(doc.tripId);
  now.mockReturnValue(start + TRASH_RETENTION_MS - 1);
  expect((await trash.all()).some((e) => e.tripId === doc.tripId)).toBe(true);
  now.mockReturnValue(start + TRASH_RETENTION_MS);
  expect(await trash.restore(doc.tripId)).toBeNull();
  expect((await trash.all()).some((e) => e.tripId === doc.tripId)).toBe(false);
  expect(await trips.get(doc.tripId)).toBeUndefined();
});
it('automatically prunes expired entries while keeping newer ones', async () => {
  const start = Date.now(); const now = vi.spyOn(Date, 'now').mockReturnValue(start);
  const old = await newDoc(emptyPlan()); await trips.put(old); await trash.move(old.tripId);
  now.mockReturnValue(start + 1000);
  const recent = await newDoc(emptyPlan()); await trips.put(recent); await trash.move(recent.tripId);
  now.mockReturnValue(start + TRASH_RETENTION_MS);
  const entries = await trash.all();
  expect(entries.some((e) => e.tripId === old.tripId)).toBe(false);
  expect(entries.some((e) => e.tripId === recent.tripId)).toBe(true);
});
it('does not overwrite an existing trip when restoring an older backup of it', async () => {
  const doc = await newDoc(emptyPlan()); await trips.put(doc); await trash.move(doc.tripId);
  const newer = { ...doc, plan: { ...doc.plan, name: '다시 가져온 여행' } };
  await trips.put(newer);
  expect(await trash.restore(doc.tripId)).toBeNull();
  expect(await trips.get(doc.tripId)).toEqual(newer);
  expect((await trash.all()).some((e) => e.tripId === doc.tripId)).toBe(true);
});
it('keeps the original when writing to trash fails', async () => {
  const doc = await newDoc(emptyPlan()); await trips.put(doc);
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await expect(trash.move(doc.tripId)).rejects.toThrow('Full');
  expect(await trips.get(doc.tripId)).toEqual(doc);
});

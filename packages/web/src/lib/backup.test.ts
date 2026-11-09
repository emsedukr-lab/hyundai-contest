import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { checkBackupTrip } from './backup';
import { newDoc } from './trips';

const S = sampleTrip();

describe('backup import check (checkBackupTrip)', () => {
  it('accepts a trip exported from this app and keeps its notes', async () => {
    const doc = { ...(await newDoc(sampleTrip())), notes: { [S.places[0].placeRef]: { memo: '2층' } } };
    const back = await checkBackupTrip(JSON.parse(JSON.stringify(doc)));
    expect(back?.tripId).toBe(S.tripId);
    expect(back?.plan.places.length).toBe(S.places.length);
    expect(back?.notes?.[S.places[0].placeRef]?.memo).toBe('2층');
  });

  it('refuses an entry that is not a valid trip instead of storing it', async () => {
    expect(await checkBackupTrip({ tripId: '11111111-1111-4111-8111-111111111111', revision: 1, updatedAt: '2026-11-01T00:00:00+09:00', plan: { tripId: '11111111-1111-4111-8111-111111111111', name: 'x' } })).toBeNull();
    expect(await checkBackupTrip(null)).toBeNull();
    expect(await checkBackupTrip({ plan: 'nope' })).toBeNull();
    const doc = await newDoc(sampleTrip());
    expect(await checkBackupTrip({ ...doc, revision: undefined })).toBeNull();
  });

  it('stores the trip under its plan id, so the overwrite warning counts the right trips', async () => {
    const doc = await newDoc(sampleTrip());
    const back = await checkBackupTrip({ ...doc, tripId: 'something-else' });
    expect(back?.tripId).toBe(S.tripId);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { b64url, exportPublicRaw, fingerprint, generateKeyPair, sampleTrip, type SessionState } from '@tteonaljido/shared';
import { pairings, sendLog, type PairingRecord } from './db';
import { ApiError, claim, confirmCode, finish, openPairing, seal, upload } from './pairing';
import { newDoc, type TripDoc } from './trips';

/** A fake relay: answers claim/status/payload like the worker would, and lets a test drop or fail a response. */
function relay() {
  const r = { state: 'CLAIMED' as SessionState, puts: [] as string[], failPut: null as null | 'drop-response' | 'network' };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/claim')) return json(claimRes);
    if (path.endsWith('/status')) return json({ state: r.state });
    if (path.endsWith('/payload') && init?.method === 'PUT') {
      if (r.failPut === 'network') throw new TypeError('Failed to fetch');
      r.puts.push(String(init.body));
      if (r.state === 'CLAIMED') r.state = 'MOBILE_APPROVED';
      if (r.failPut === 'drop-response') throw new TypeError('Failed to fetch'); // reached the server, the answer was lost
      return json({ state: r.state });
    }
    return json({ error: 'NOT_FOUND' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return r;
}

let claimRes: { mobileToken: string; carPub: string; carAppVersion: string; supportedSchemaVersions: number[] };
let rec: PairingRecord;
let doc: TripDoc;
let other: TripDoc;

beforeEach(async () => {
  const car = await generateKeyPair();
  const carPub = await exportPublicRaw(car.publicKey);
  claimRes = { mobileToken: 'tok', carPub: b64url(carPub), carAppVersion: 'test', supportedSchemaVersions: [1] };
  relay();
  const sid = b64url(crypto.getRandomValues(new Uint8Array(16)));
  rec = await confirmCode(await claim(await openPairing({ sid, scanSecret: 'secret', fingerprint: await fingerprint(carPub) }), 'secret'));
  doc = await newDoc(sampleTrip());
  other = await newDoc({ ...sampleTrip(), tripId: crypto.randomUUID(), name: '다른 여행' });
});

afterEach(() => vi.unstubAllGlobals());

describe('sending a trip (phone side)', () => {
  it('stores the sealed trip before the upload, so a retry after a lost response sends the same bytes', async () => {
    const r = relay();
    r.failPut = 'drop-response';
    const sealed = await seal(rec, doc, false);
    expect((await pairings.get(rec.sid))?.sealed).toEqual(sealed.sealed);
    await expect(upload(sealed)).rejects.toMatchObject({ code: 'NETWORK' });
    r.failPut = null;
    // Even from the caller's stale copy (no sealed body in it) the retry re-sends the identical ciphertext.
    const again = await seal(rec, doc, false);
    await upload(again);
    expect(r.puts).toHaveLength(2);
    expect(r.puts[1]).toBe(r.puts[0]);
  });

  it('does not replace a body that already reached the car with a different trip', async () => {
    const r = relay();
    r.failPut = 'drop-response';
    const first = await seal(rec, doc, false);
    await upload(first).catch(() => {});
    await expect(seal(rec, other, false)).rejects.toMatchObject({ code: 'PAYLOAD_CONFLICT' });
    const stored = await pairings.get(rec.sid);
    expect(stored?.tripId).toBe(doc.tripId);
    expect(stored?.sealed).toEqual(first.sealed);
  });

  it('lets the user switch trips while nothing has reached the server yet', async () => {
    const r = relay();
    r.failPut = 'network';
    await upload(await seal(rec, doc, false)).catch(() => {});
    r.failPut = null;
    const next = await seal(rec, other, false);
    expect(next.tripId).toBe(other.tripId);
    await upload(next);
    expect(r.state).toBe('MOBILE_APPROVED');
  });

  it('refuses to seal for a record that was already cleared, instead of bringing it back', async () => {
    await pairings.remove(rec.sid);
    const err = await seal(rec, doc, false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('NOT_FOUND');
    expect(await pairings.get(rec.sid)).toBeUndefined();
  });

  it('logs the trip that was actually sealed, even from a stale copy of the record', async () => {
    relay();
    await seal(rec, doc, false);
    await finish(rec, 'APPLIED:IMPORTED_NEW');
    expect((await sendLog.forTrip(doc.tripId)).map((e) => e.outcome)).toContain('APPLIED:IMPORTED_NEW');
    expect(await pairings.get(rec.sid)).toBeUndefined();
  });
});

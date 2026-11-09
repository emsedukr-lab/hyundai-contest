import { SELF, env, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  aadFor,
  b64url,
  buildTransfer,
  decrypt,
  deriveSessionKeys,
  encrypt,
  exportPublicRaw,
  fingerprint,
  fromB64url,
  generateKeyPair,
  importPublicRaw,
  parseTransfer,
  sampleTrip,
  sharedSecret,
  utf8,
  type ClaimResponse,
  type CreateSessionResponse,
  type SessionView,
} from '@tteonaljido/shared';

const API = 'https://relay.test/api/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ipCounter = 0;
const nextIp = () => `198.51.100.${++ipCounter % 250}`;

async function call<T = unknown>(method: string, path: string, opts: { token?: string; body?: unknown; ip?: string; raw?: string } = {}) {
  const res = await SELF.fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': opts.ip ?? nextIp(),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function newCar() {
  const keys = await generateKeyPair();
  const pubRaw = await exportPublicRaw(keys.publicKey);
  const res = await call<CreateSessionResponse>('POST', '/sessions', { body: { carPub: b64url(pubRaw), appVersion: '0.1.0', supportedSchemaVersions: [1] } });
  expect(res.status).toBe(201);
  return { keys, pubRaw, ...res.body };
}

async function claim(car: Awaited<ReturnType<typeof newCar>>, scanSecret = car.scanSecret) {
  const keys = await generateKeyPair();
  const pubRaw = await exportPublicRaw(keys.publicKey);
  const res = await call<ClaimResponse>('POST', `/sessions/${car.sid}/claim`, { body: { scanSecret, mobilePub: b64url(pubRaw) } });
  return { keys, pubRaw, ...res };
}

async function sealedPayload(car: Awaited<ReturnType<typeof newCar>>, phone: Awaited<ReturnType<typeof claim>>) {
  const carPub = await importPublicRaw(fromB64url(phone.body.carPub));
  expect(await fingerprint(fromB64url(phone.body.carPub))).toBe(await fingerprint(car.pubRaw));
  const z = await sharedSecret(phone.keys.privateKey, carPub);
  const k = await deriveSessionKeys(z, car.sid, car.pubRaw, phone.pubRaw);
  const transfer = await buildTransfer(sampleTrip(), '2026-11-05T10:00:00+09:00');
  const sealed = await encrypt(k.key, utf8(JSON.stringify(transfer)), aadFor(car.sid, 1));
  return { ...sealed, schemaVersion: 1, code: k.confirmCode };
}

describe('pairing relay', () => {
  it("accepts the car's HOME_ADDED result (same trip resent with the home address added)", async () => {
    const car = await newCar();
    const phone = await claim(car);
    const sealed = await sealedPayload(car, phone);
    await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 } });
    await call('GET', `/sessions/${car.sid}/payload`, { token: car.carToken });
    await call('POST', `/sessions/${car.sid}/lock`, { token: car.carToken });
    const done = await call<SessionView>('POST', `/sessions/${car.sid}/result`, { token: car.carToken, body: { outcome: 'APPLIED', resultCode: 'HOME_ADDED', appliedRevision: 1 } });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ state: 'APPLIED', resultCode: 'HOME_ADDED' });
  });

  it('refuses a payload whose schemaVersion is not a safe integer (400, not a crash)', async () => {
    const car = await newCar();
    const phone = await claim(car);
    const sealed = await sealedPayload(car, phone);
    const up = await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1e300 } });
    expect(up.status).toBe(400);
  });

  it('runs the whole handoff and keeps only ciphertext', async () => {
    const car = await newCar();
    const phone = await claim(car);
    expect(phone.status).toBe(200);
    const sealed = await sealedPayload(car, phone);

    const up = await call<SessionView>('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 } });
    expect(up.body.state).toBe('MOBILE_APPROVED');

    const got = await call<{ iv: string; ct: string; mobilePub: string }>('GET', `/sessions/${car.sid}/payload`, { token: car.carToken });
    expect(got.status).toBe(200);
    const z = await sharedSecret(car.keys.privateKey, await importPublicRaw(fromB64url(got.body.mobilePub)));
    const k = await deriveSessionKeys(z, car.sid, car.pubRaw, fromB64url(got.body.mobilePub));
    expect(k.confirmCode).toBe(sealed.code);
    const plain = new TextDecoder().decode(await decrypt(k.key, got.body.iv, got.body.ct, aadFor(car.sid, 1)));
    expect(await parseTransfer(plain)).toMatchObject({ ok: true });

    const mobileStatus = await call<SessionView>('GET', `/sessions/${car.sid}/status`, { token: phone.body.mobileToken });
    expect(mobileStatus.body).toMatchObject({ state: 'MOBILE_APPROVED', carFetched: true });

    expect((await call<SessionView>('POST', `/sessions/${car.sid}/lock`, { token: car.carToken })).body.state).toBe('CAR_APPLYING');
    const done = await call<SessionView>('POST', `/sessions/${car.sid}/result`, { token: car.carToken, body: { outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 } });
    expect(done.body).toMatchObject({ state: 'APPLIED', resultCode: 'IMPORTED_NEW' });
    // Payload is gone after the session ends.
    expect((await call('GET', `/sessions/${car.sid}/payload`, { token: car.carToken })).status).toBe(409);
    expect((await call<SessionView>('GET', `/sessions/${car.sid}/status`, { token: phone.body.mobileToken })).body.state).toBe('APPLIED');
  });

  it('a QR can be claimed once', async () => {
    const car = await newCar();
    expect((await claim(car)).status).toBe(200);
    const second = await claim(car);
    expect(second).toMatchObject({ status: 409, body: { error: 'ALREADY_CLAIMED' } });
  });

  it('locks the session after five wrong secrets', async () => {
    const car = await newCar();
    for (let i = 0; i < 5; i++) expect((await claim(car, 'A'.repeat(22))).status).toBe(401);
    const snap = await call<SessionView>('GET', `/sessions/${car.sid}`, { token: car.carToken });
    expect(snap.body).toMatchObject({ state: 'CANCELLED', cancelReason: 'SECURITY' });
    expect((await claim(car)).status).toBe(409);
  });

  it('re-upload of the same body is accepted, a different body is refused', async () => {
    const car = await newCar();
    const phone = await claim(car);
    const sealed = await sealedPayload(car, phone);
    const body = { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 };
    expect((await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body })).status).toBe(200);
    expect((await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body })).status).toBe(200);
    const other = await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { ...body, ct: sealed.ct.slice(0, -2) + 'AA' } });
    expect(other).toMatchObject({ status: 409, body: { error: 'PAYLOAD_CONFLICT' } });
  });

  it('the phone cannot cancel while the car is applying; the car can', async () => {
    const car = await newCar();
    const phone = await claim(car);
    const sealed = await sealedPayload(car, phone);
    await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 } });
    await call('POST', `/sessions/${car.sid}/lock`, { token: car.carToken });
    expect(await call('POST', `/sessions/${car.sid}/cancel`, { token: phone.body.mobileToken })).toMatchObject({ status: 409, body: { error: 'APPLYING' } });
    expect((await call<SessionView>('POST', `/sessions/${car.sid}/cancel`, { token: car.carToken })).body.state).toBe('CANCELLED');
  });

  it('rejects tokens of the wrong party', async () => {
    const car = await newCar();
    const phone = await claim(car);
    expect((await call('GET', `/sessions/${car.sid}`)).status).toBe(401);
    expect((await call('GET', `/sessions/${car.sid}`, { token: phone.body.mobileToken })).status).toBe(401);
    expect((await call('GET', `/sessions/${car.sid}/status`, { token: car.carToken })).status).toBe(401);
    expect((await call('POST', `/sessions/${car.sid}/lock`, { token: phone.body.mobileToken })).status).toBe(401);
  });

  it('lets the same phone re-claim after a lost response, but refuses a second phone', async () => {
    const car = await newCar();
    const first = await claim(car);
    expect(first.status).toBe(200);
    // Same phone (same key), same scan secret: a fresh token, not a 409.
    const again = await call<ClaimResponse>('POST', `/sessions/${car.sid}/claim`, { body: { scanSecret: car.scanSecret, mobilePub: b64url(first.pubRaw) } });
    expect(again.status).toBe(200);
    expect(again.body.mobileToken).not.toBe(first.body.mobileToken);
    // A different phone with the same scan secret is still refused.
    const other = await claim(car);
    expect(other.status).toBe(409);
    expect(other.body).toMatchObject({ error: 'ALREADY_CLAIMED' });
  });

  it('treats an identical re-upload after the session ends as success', async () => {
    const car = await newCar();
    const phone = await claim(car);
    const sealed = await sealedPayload(car, phone);
    await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 } });
    await call('GET', `/sessions/${car.sid}/payload`, { token: car.carToken });
    await call('POST', `/sessions/${car.sid}/lock`, { token: car.carToken });
    await call('POST', `/sessions/${car.sid}/result`, { token: car.carToken, body: { outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 } });
    // The phone's upload response was lost; its identical re-send sees the final state, not a 409.
    const resend = await call<SessionView>('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, body: { iv: sealed.iv, ct: sealed.ct, schemaVersion: 1 } });
    expect(resend.status).toBe(200);
    expect(resend.body.state).toBe('APPLIED');
  });

  it('rejects state-changing actions over GET', async () => {
    const car = await newCar();
    for (const action of ['lock', 'result', 'cancel']) {
      expect((await call('GET', `/sessions/${car.sid}/${action}`, { token: car.carToken })).status).toBe(404);
    }
  });

  it('refuses oversized payloads', async () => {
    const car = await newCar();
    const phone = await claim(car);
    const res = await call('PUT', `/sessions/${car.sid}/payload`, { token: phone.body.mobileToken, raw: JSON.stringify({ iv: 'A'.repeat(16), ct: 'A'.repeat(140_000), schemaVersion: 1 }) });
    expect(res).toMatchObject({ status: 413, body: { error: 'PAYLOAD_TOO_LARGE' } });
  });

  it('refuses an invalid car key', async () => {
    const res = await call('POST', '/sessions', { body: { carPub: 'A'.repeat(87), appVersion: '0.1.0', supportedSchemaVersions: [1] } });
    expect(res.status).toBe(400);
  });

  it('expires the QR, then purges the tombstone', async () => {
    const car = await newCar();
    await sleep(1100);
    expect(await claim(car)).toMatchObject({ status: 410, body: { error: 'EXPIRED' } });
    const snap = await call<SessionView>('GET', `/sessions/${car.sid}`, { token: car.carToken });
    expect(snap.body).toMatchObject({ state: 'EXPIRED', expireReason: 'QR' });
    await sleep(1100);
    const stub = env.PAIRING.get(env.PAIRING.idFromName(car.sid));
    await runDurableObjectAlarm(stub);
    expect((await call('GET', `/sessions/${car.sid}`, { token: car.carToken })).status).toBe(404);
  });

  it('pushes state changes to the car over a WebSocket', async () => {
    const car = await newCar();
    const res = await SELF.fetch(`${API}/sessions/${car.sid}/events`, { headers: { Upgrade: 'websocket', Authorization: `Bearer ${car.carToken}` } });
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    const states: string[] = [];
    ws.addEventListener('message', (e) => {
      states.push(JSON.parse(e.data as string).session.state);
    });
    ws.accept();
    await claim(car);
    await sleep(100);
    expect(states).toEqual(['CREATED', 'CLAIMED']);
    ws.close();
  });

  it('rate-limits session creation per address', async () => {
    const ip = '203.0.113.9';
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const keys = await generateKeyPair();
      const carPub = b64url(await exportPublicRaw(keys.publicKey));
      statuses.push((await call('POST', '/sessions', { ip, body: { carPub, appVersion: '0.1.0', supportedSchemaVersions: [1] } })).status);
    }
    expect(statuses).toContain(429);
  });

  it('place search reports unavailable without a server key', async () => {
    expect((await call('POST', '/places/search', { raw: JSON.stringify({ q: '강릉' }) })).status).toBe(503);
    expect((await call('GET', '/places/search?q=x')).status).toBe(404); // the term is never accepted in a URL
  });
});

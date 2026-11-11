import { SELF, env, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { FLEET_DOC_EXAMPLES as DOC, restampFleetExample, type FleetReadiness } from '@tteonaljido/shared';
import worker, { type Env } from '../src/index';

const API = 'https://relay.test/api/v1/fleet';
const TOKEN = 'test-only-fleet-token';
let ipCounter = 0;
const ip = () => `198.51.102.${++ipCounter % 250}`;
let vehicleCounter = 0;
/** A fresh vehicle per test: each id is its own Durable Object. */
const newVehicle = () => `e79049fb-e744-11ef-8dd9-${String(++vehicleCounter).padStart(12, '0')}`;

/**
 * The worker as an operator would switch it on: the real bindings plus a webhook token. The deployed configuration has
 * no token, so `SELF` (the worker exactly as configured) is what proves "off by default" below.
 */
const ON: Env = { ...env, FLEET_WEBHOOK_TOKEN: TOKEN };

interface Opts {
  token?: string | null;
  body?: unknown;
  raw?: string;
  env?: Env;
}

function request(method: string, path: string, opts: Opts = {}) {
  const token = opts.token === undefined ? TOKEN : opts.token;
  return new Request(`${API}${path}`, {
    method,
    // What the docs say a webhook request carries, plus the registered Custom Header.
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-API-Version': 'v1.0', 'CF-Connecting-IP': ip(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
}

async function call<T = unknown>(method: string, path: string, opts: Opts = {}) {
  const res = await worker.fetch(request(method, path, opts), opts.env ?? ON);
  return { status: res.status, body: (await res.json()) as T, headers: res.headers };
}

const post = (body: unknown, opts: Opts = {}) => call('POST', '/webhook', { ...opts, body });
const readiness = (vehicleId: string, query = '') => call<FleetReadiness>('GET', `/vehicles/${vehicleId}/readiness${query}`);
const fresh = <T extends { items: { messageTime: string }[] }>(example: T, vehicleId: string) => ({ ...restampFleetExample(example, Date.now()), vehicleId });
const object = (vehicleId: string) => env.FLEET.get(env.FLEET.idFromName(vehicleId));
const storedKeys = (vehicleId: string) => runInDurableObject(object(vehicleId), async (_, state) => [...(await state.storage.list()).keys()]);

const COMPLETED = { status: 'completed', message: 'Request processed successfully.' };

describe('Pleos Fleet 웹훅 수신 (fleet webhook)', () => {
  it('is off as deployed: no token configured, every fleet route is 404 and nothing is stored', async () => {
    const id = newVehicle();
    const hook = await SELF.fetch(request('POST', '/webhook', { body: { ...DOC.periodic3, vehicleId: id } }));
    expect(hook.status).toBe(404);
    expect(await hook.json()).toEqual({ error: 'NOT_FOUND' });
    const read = await SELF.fetch(request('GET', `/vehicles/${id}/readiness?km=207`));
    expect(read.status).toBe(404);
    await read.arrayBuffer();
    expect(await storedKeys(id)).toEqual([]);
  });

  it('refuses a missing or wrong token on both routes (401), before reading anything', async () => {
    const id = newVehicle();
    for (const token of [null, 'wrong', TOKEN.slice(0, -1), `${TOKEN}x`, '']) {
      expect(await post({ ...DOC.periodic3, vehicleId: id }, { token })).toMatchObject({ status: 401, body: { error: 'UNAUTHORIZED' } });
      expect((await call('GET', `/vehicles/${id}/readiness`, { token })).status).toBe(401);
    }
    expect((await readiness(id)).status).toBe(404); // nothing got in
  });

  it('answers each documented payload example with the documented 200 body', async () => {
    for (const example of [DOC.periodic1, DOC.periodic2, DOC.periodic3, DOC.event1]) {
      const res = await post(example);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(COMPLETED);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    // As printed the examples are dated 2025, so today they can only be called stale.
    const r = await readiness(DOC.periodic3.vehicleId, '?km=207');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ level: 'CAUTION', items: [{ code: 'STALE', level: 'CAUTION' }], updatedAt: Date.parse('2025-02-12T08:12:58.628Z') });
  });

  it('readiness reflects the webhook: SOC 95 / DTE 412 is READY for 207 km, ENERGY_SHORT for 400 km', async () => {
    const id = newVehicle();
    expect((await post(fresh(DOC.periodic3, id))).status).toBe(200);

    const ok = await readiness(id, '?km=207');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ level: 'READY', items: [], known: ['ENERGY_SHORT'] });

    const short = await readiness(id, '?km=400');
    expect(short.body).toMatchObject({ level: 'CAUTION', items: [{ code: 'ENERGY_SHORT', level: 'CAUTION', detail: { dteKm: 412, tripKm: 400, socPercent: 95 } }] });

    // Without a distance the range check is not made at all.
    expect((await readiness(id)).body).toMatchObject({ level: 'READY', items: [], known: [] });
  });

  it('folds later webhooks into the same vehicle, newest value winning', async () => {
    const id = newVehicle();
    await post(fresh(DOC.periodic3, id));
    const now = Date.now();
    const lamp = (value: string, at: number) => ({
      vin: DOC.event1.vin,
      vehicleId: id,
      itemsCount: 1,
      items: [{ messageTime: new Date(now).toISOString(), data: { WarningLamp: { BrakeOil: { value, eventTime: new Date(at).toISOString() } } } }],
    });
    expect((await post(lamp('LOW', now))).status).toBe(200);
    expect((await post(lamp('NORMAL', now - 60_000))).status).toBe(200); // delivered late: must not clear the warning
    const r = await readiness(id, '?km=207');
    expect(r.body).toMatchObject({ level: 'STOP', items: [{ code: 'BRAKE_FLUID_LOW', level: 'STOP' }], known: ['ENERGY_SHORT', 'BRAKE_FLUID_LOW'] });
  });

  it('answers a malformed body with the documented 400 bodies', async () => {
    const id = newVehicle();
    const syntax = await post(undefined, { raw: '{"vin":"HMGSDV00000000001","vehicleId":' });
    expect(syntax).toMatchObject({ status: 400 });
    expect(syntax.body).toEqual({ error: 'Bad Request', message: 'There is a syntax error in the request data.' });

    const missing = await post({ vehicleId: id, itemsCount: 1, items: [{ data: {} }] });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      error: 'Bad Request',
      message: 'Required fields are missing in the request.',
      errors: [
        { field: 'vin', message: 'This field is required.', code: 'ERR_MISSING_FIELD' },
        { field: 'items[0].messageTime', message: 'This field is required.', code: 'ERR_MISSING_FIELD' },
      ],
    });

    const invalid = await post({ ...DOC.periodic3, vehicleId: id, itemsCount: 'one', items: [{ messageTime: 'yesterday', data: {} }] });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      error: 'Bad Request',
      message: 'Validation failed for the request data.',
      errors: [
        { field: 'itemsCount', code: 'ERR_INVALID_VALUE' },
        { field: 'items[0].messageTime', code: 'ERR_INVALID_VALUE' },
      ],
    });

    expect((await readiness(id)).status).toBe(404); // a refused request leaves nothing behind
  });

  it('refuses a body over the size cap', async () => {
    const res = await post(undefined, { raw: JSON.stringify({ ...DOC.periodic3, pad: 'x'.repeat(256 * 1024) }) });
    expect(res).toMatchObject({ status: 413, body: { error: 'PAYLOAD_TOO_LARGE' } });
  });

  it('readiness: unknown vehicle, odd id, odd km and wrong methods', async () => {
    const id = newVehicle();
    expect(await readiness(id, '?km=207')).toMatchObject({ status: 404, body: { error: 'NOT_FOUND' } });
    expect((await readiness('not_a.vehicle')).status).toBe(404);
    expect((await readiness('x'.repeat(65))).status).toBe(404);
    await post(fresh(DOC.periodic3, id));
    for (const km of ['abc', '-5', '', '1e3', '12.3456']) expect((await readiness(id, `?km=${km}`)).status).toBe(400);
    expect((await readiness(id, '?km=207.5')).status).toBe(200);
    expect((await call('POST', `/vehicles/${id}/readiness`)).status).toBe(404);
    expect((await call('GET', '/webhook')).status).toBe(404);
    expect((await call('GET', `/vehicles/${id}`)).status).toBe(404);
  });

  it('stores the reduced state only: no VIN, no position, no request body', async () => {
    const id = newVehicle();
    expect((await post(fresh(DOC.periodic1, id))).status).toBe(200);
    expect(await storedKeys(id)).toEqual(['state']);
    const stored = await runInDurableObject(object(id), async (_, state) => [...(await state.storage.list())]);
    expect(stored[0][1]).toMatchObject({ vehicleId: id, values: { 'Vehicle.Speed': { value: 33 }, 'Vehicle.Odometer': { value: 85488.20000000001 } } });
    const text = JSON.stringify(stored);
    for (const leak of ['"vin"', 'HMGSDV', 'Latitude', 'Longitude', '-154.91', '-18.69', 'messageTime', '"items"']) expect(text).not.toContain(leak);
  });

  it('a webhook carrying none of the kept fields creates no record', async () => {
    const id = newVehicle();
    const now = new Date().toISOString();
    const res = await post({ vin: DOC.event1.vin, vehicleId: id, itemsCount: 1, items: [{ messageTime: now, data: { Vehicle: { Latitude: { value: 37.75, eventTime: now }, Longitude: { value: 128.87, eventTime: now } } } }] });
    expect(res).toMatchObject({ status: 200, body: COMPLETED });
    expect((await readiness(id)).status).toBe(404);
    expect(await storedKeys(id)).toEqual([]);
  });

  it('deletes a vehicle 24 hours after its last webhook', async () => {
    const id = newVehicle();
    const before = Date.now();
    await post(fresh(DOC.periodic3, id));
    const alarm = await runInDurableObject(object(id), (_, state) => state.storage.getAlarm());
    expect(alarm).toBeGreaterThanOrEqual(before + 24 * 3600_000);
    expect(alarm).toBeLessThanOrEqual(Date.now() + 24 * 3600_000);

    expect(await runDurableObjectAlarm(object(id))).toBe(true);
    expect((await readiness(id)).status).toBe(404);
    expect(await storedKeys(id)).toEqual([]);
  });

  it('answers the documented 503 with retry_after when the state cannot be saved', async () => {
    const down = { idFromName: () => ({}), get: () => ({ ingest: () => Promise.reject(new Error('storage down')) }) } as unknown as Env['FLEET'];
    const res = await post(fresh(DOC.periodic3, newVehicle()), { env: { ...ON, FLEET: down } });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Service Unavailable', message: 'The server is temporarily unable to process the request. Please try again later.', retry_after: 30 });
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});

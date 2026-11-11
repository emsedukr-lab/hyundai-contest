import { FLEET_VEHICLE_ID, fleetReadiness, parseFleetWebhook, type FleetFieldError } from '@tteonaljido/shared';
import { bearer, error, hashSecret, json, matchesHash, readJson } from './http';
import type { Env } from './index';

/**
 * Pleos Fleet API webhook receiver, and the readiness answer built from what it receives.
 *
 * Off unless FLEET_WEBHOOK_TOKEN is set, and production sets none: registering a webhook needs a Pleos Fleet contract
 * and approval, so the live service has never called this. Until then it is proven with the docs' payload examples.
 * The token is the Custom Header the operator registers in Pleos Fleet (`Authorization: Bearer <token>`, the docs' own
 * example); the same token reads the readiness. Bodies, tokens and vehicle ids are never logged.
 */
const MAX_BODY = 256 * 1024; // a transmission is a few samples of a few dozen values; this is far above that
const RETRY_AFTER_S = 30;

const vehicle = (env: Env, vehicleId: string) => env.FLEET.get(env.FLEET.idFromName(vehicleId), { locationHint: 'apac' });

/* The callback bodies below are the ones the Fleet API docs ask a webhook endpoint to answer with. */
const completed = () => json({ status: 'completed', message: 'Request processed successfully.' });
const syntaxError = () => json({ error: 'Bad Request', message: 'There is a syntax error in the request data.' }, 400);
const invalid = (errors: FleetFieldError[]) =>
  json(
    {
      error: 'Bad Request',
      message: errors.some((e) => e.code === 'ERR_MISSING_FIELD') ? 'Required fields are missing in the request.' : 'Validation failed for the request data.',
      errors,
    },
    400,
  );
const unavailable = () =>
  json({ error: 'Service Unavailable', message: 'The server is temporarily unable to process the request. Please try again later.', retry_after: RETRY_AFTER_S }, 503, {
    'Retry-After': String(RETRY_AFTER_S),
  });
const internal = () => json({ error: 'Internal Server Error', message: 'An internal server error occurred. Please try again later.' }, 500);

/** `parts` is the split path: api, v1, fleet, ... */
export async function fleet(req: Request, env: Env, url: URL, parts: string[]): Promise<Response> {
  if (!env.FLEET_WEBHOOK_TOKEN) return error('NOT_FOUND');
  // Both sides are hashed first, so the comparison is constant-time and equal-length whatever was sent.
  if (!(await matchesHash(bearer(req), await hashSecret(env.FLEET_WEBHOOK_TOKEN)))) return error('UNAUTHORIZED');

  if (parts.length === 4 && parts[3] === 'webhook' && req.method === 'POST') return webhook(req, env);
  if (parts.length === 6 && parts[3] === 'vehicles' && parts[5] === 'readiness' && req.method === 'GET' && FLEET_VEHICLE_ID.test(parts[4])) {
    return readiness(env, parts[4], url.searchParams.get('km'));
  }
  return error('NOT_FOUND');
}

async function webhook(req: Request, env: Env): Promise<Response> {
  try {
    const body = await readJson<unknown>(req, MAX_BODY);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    if (body === null) return syntaxError();
    const parsed = parseFleetWebhook(body);
    if (!parsed.ok) return invalid(parsed.errors);
    try {
      await vehicle(env, parsed.payload.vehicleId).ingest(parsed.payload);
    } catch {
      // Storage or the object being unreachable is temporary: Fleet retries, and the reducer makes a repeat harmless.
      return unavailable();
    }
    return completed();
  } catch {
    return internal();
  }
}

/** `km` is the trip's planned distance; without it the range check is simply not made. */
async function readiness(env: Env, vehicleId: string, km: string | null): Promise<Response> {
  if (km !== null && !/^\d{1,6}(\.\d{1,3})?$/.test(km)) return error('BAD_REQUEST');
  const state = await vehicle(env, vehicleId).current();
  if (!state) return error('NOT_FOUND');
  return json(fleetReadiness(state, { tripKm: km === null ? undefined : Number(km), now: Date.now() }));
}

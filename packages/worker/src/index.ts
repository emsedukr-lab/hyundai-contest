import { randomId } from '@tteonaljido/shared';
import { fleet } from './fleet';
import { error, json, readJson } from './http';
import { searchPlaces } from './kakao';
import { routeDurations, routePaths } from './route';
import { resolveShare } from './resolve';

export { PairingSession } from './pairingSession';
export { FleetVehicle } from './fleetVehicle';

export interface Env {
  PAIRING: DurableObjectNamespace<import('./pairingSession').PairingSession>;
  FLEET: DurableObjectNamespace<import('./fleetVehicle').FleetVehicle>;
  ASSETS: Fetcher;
  RL_CREATE: RateLimit;
  RL_CLAIM: RateLimit;
  RL_API: RateLimit;
  RL_SEARCH: RateLimit;
  RL_ROUTE: RateLimit;
  KAKAO_REST_KEY?: string;
  /** Unset in production, which leaves the Fleet webhook routes answering 404 (see fleet.ts). */
  FLEET_WEBHOOK_TOKEN?: string;
  TTL_QR?: string;
  TTL_UPLOAD?: string;
  TTL_RESULT?: string;
  TTL_APPLYING?: string;
  TTL_TOMBSTONE?: string;
}

const SID = /^[A-Za-z0-9_-]{22}$/;
const ACTIONS = new Set(['events', 'claim', 'payload', 'lock', 'result', 'cancel', 'status']);

const stub = (env: Env, sid: string) => env.PAIRING.get(env.PAIRING.idFromName(sid), { locationHint: 'apac' });

async function limited(rl: RateLimit, key: string) {
  try {
    return !(await rl.limit({ key })).success;
  } catch {
    return false; // never fail closed on the limiter itself
  }
}

/** Rewrites the request onto the session's Durable Object, keeping method, headers and body. */
const forward = (env: Env, sid: string, action: string, req: Request) => stub(env, sid).fetch(new Request(`https://session/${action}`, req));

/**
 * The phone app (packages/mobile) serves its pages from inside the app, so its API calls arrive cross-origin from these
 * two fixed origins (Capacitor's Android and iOS defaults). Nothing else is answered cross-origin: the mobile web is
 * same-origin and the car is not a browser. The API has no cookies, so this opens nothing a plain HTTP client lacks.
 */
const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const origin = req.headers.get('Origin');
    const appOrigin = origin && APP_ORIGINS.has(origin) ? origin : null;
    if (appOrigin && req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': appOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    const res = await api(req, env, url);
    if (!appOrigin || res.status === 101) return res;
    // Errors too: without the header the app could not read the error code and would show a network failure.
    const out = new Response(res.body, res);
    out.headers.set('Access-Control-Allow-Origin', appOrigin);
    out.headers.append('Vary', 'Origin');
    return out;
  },
} satisfies ExportedHandler<Env>;

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  if (await limited(env.RL_API, ip)) return error('RATE_LIMITED');

  const parts = url.pathname.split('/').filter(Boolean); // api, v1, ...
  if (parts[1] !== 'v1') return error('NOT_FOUND');

  if (parts[2] === 'health' && parts.length === 3) return json({ ok: true, serverTime: Date.now() });

  if (parts[2] === 'places' && parts[3] === 'search') {
    if (req.method !== 'POST') return error('NOT_FOUND');
    if (await limited(env.RL_SEARCH, ip)) return error('RATE_LIMITED');
    // The term travels in the body, never in the URL, so request logs cannot carry it.
    const body = await readJson<Record<string, unknown>>(req, 1024);
    if (!body || body === 'TOO_LARGE') return error('BAD_REQUEST');
    return searchPlaces(body, env.KAKAO_REST_KEY);
  }

  if (parts[2] === 'routes' && (parts[3] === 'durations' || parts[3] === 'paths')) {
    if (req.method !== 'POST') return error('NOT_FOUND');
    if (await limited(env.RL_ROUTE, ip)) return error('RATE_LIMITED');
    // Coordinates of the day's stops (home too when set in 설정); passed to Kakao Mobility, not stored or logged.
    const body = await readJson<Record<string, unknown>>(req, 4096);
    if (!body || body === 'TOO_LARGE') return error('BAD_REQUEST');
    return parts[3] === 'paths' ? routePaths(body, env.KAKAO_REST_KEY) : routeDurations(body, env.KAKAO_REST_KEY);
  }

  if (parts[2] === 'places' && parts[3] === 'resolve') {
    if (req.method !== 'POST') return error('NOT_FOUND');
    if (await limited(env.RL_SEARCH, ip)) return error('RATE_LIMITED');
    // The shared URL travels in the body; the Worker fetches it (allow-listed hosts only) and reads the place name.
    const body = await readJson<Record<string, unknown>>(req, 2048);
    if (!body || body === 'TOO_LARGE') return error('BAD_REQUEST');
    // One RL_SEARCH hit per link, even when a Kakao folder's points are then named with several Local API calls.
    return resolveShare(body, fetch, env.KAKAO_REST_KEY);
  }

  if (parts[2] === 'fleet') return fleet(req, env, url, parts);

  if (parts[2] !== 'sessions') return error('NOT_FOUND');

  if (parts.length === 3 && req.method === 'POST') {
    if (await limited(env.RL_CREATE, ip)) return error('RATE_LIMITED');
    const body = await readJson<Record<string, unknown>>(req, 4096);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    if (!body) return error('BAD_REQUEST');
    const sid = randomId();
    return stub(env, sid).fetch(new Request('https://session/create', { method: 'POST', body: JSON.stringify({ ...body, sid }) }));
  }

  const sid = parts[3];
  if (!sid || !SID.test(sid)) return error('NOT_FOUND');
  if (parts.length === 4 && req.method === 'GET') return forward(env, sid, 'snapshot', req);

  const action = parts[4];
  if (parts.length !== 5 || !ACTIONS.has(action)) return error('NOT_FOUND');
  // Each action has exactly one method; a GET must never drive state (lock/cancel/result).
  const allowed = action === 'payload' ? ['GET', 'PUT'] : action === 'status' || action === 'events' ? ['GET'] : ['POST'];
  if (!allowed.includes(req.method)) return error('NOT_FOUND');
  if (action === 'claim' && (await limited(env.RL_CLAIM, ip))) return error('RATE_LIMITED');
  if (action === 'events' && req.headers.get('Upgrade') !== 'websocket') return error('BAD_REQUEST');
  return forward(env, sid, action, req);
}

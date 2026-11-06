import { randomId } from '@tteonaljido/shared';
import { error, json, readJson } from './http';
import { searchPlaces } from './kakao';

export { PairingSession } from './pairingSession';

export interface Env {
  PAIRING: DurableObjectNamespace<import('./pairingSession').PairingSession>;
  ASSETS: Fetcher;
  RL_CREATE: RateLimit;
  RL_CLAIM: RateLimit;
  RL_API: RateLimit;
  RL_SEARCH: RateLimit;
  KAKAO_REST_KEY?: string;
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

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
  },
} satisfies ExportedHandler<Env>;

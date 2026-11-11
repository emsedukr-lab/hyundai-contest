import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const API = 'https://relay.test/api/v1';
const ANDROID = 'https://localhost';
const IOS = 'capacitor://localhost';
const SID = 'A'.repeat(22);
let ipCounter = 0;
const ip = () => `198.51.101.${++ipCounter % 250}`;

const preflight = (origin: string, method = 'POST') =>
  SELF.fetch(`${API}/places/search`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'authorization,content-type', 'CF-Connecting-IP': ip() },
  });

describe('휴대폰 앱의 교차 출처 요청 (CORS)', () => {
  it('answers the preflight for both app origins', async () => {
    for (const origin of [ANDROID, IOS]) {
      const res = await preflight(origin, 'PUT');
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
      expect(res.headers.get('Vary')).toBe('Origin');
    }
  });

  it('does not answer a preflight from any other origin', async () => {
    for (const origin of ['https://evil.example', 'http://localhost', 'https://localhost:8443', 'null']) {
      const res = await preflight(origin);
      expect(res.status).toBe(404);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      await res.arrayBuffer();
    }
  });

  it('marks answers to the app, errors and session answers included', async () => {
    const ok = await SELF.fetch(`${API}/health`, { headers: { Origin: ANDROID, 'CF-Connecting-IP': ip() } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ANDROID);
    expect(((await ok.json()) as { ok: boolean }).ok).toBe(true);

    const unknown = await SELF.fetch(`${API}/nope`, { headers: { Origin: IOS, 'CF-Connecting-IP': ip() } });
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get('Access-Control-Allow-Origin')).toBe(IOS);
    expect(((await unknown.json()) as { error: string }).error).toBe('NOT_FOUND');

    // A session route is answered by the Durable Object; the header must survive that hop too.
    const session = await SELF.fetch(`${API}/sessions/${SID}/status`, { headers: { Origin: ANDROID, Authorization: 'Bearer x', 'CF-Connecting-IP': ip() } });
    expect(session.status).toBeGreaterThanOrEqual(400);
    expect(session.headers.get('Access-Control-Allow-Origin')).toBe(ANDROID);
    expect(session.headers.get('Cache-Control')).toBe('no-store');
    await session.arrayBuffer();
  });

  it('leaves same-origin and other-origin answers unmarked', async () => {
    for (const headers of [{}, { Origin: 'https://evil.example' }] as Record<string, string>[]) {
      const res = await SELF.fetch(`${API}/health`, { headers: { ...headers, 'CF-Connecting-IP': ip() } });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      await res.arrayBuffer();
    }
  });
});

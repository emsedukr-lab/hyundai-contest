import { describe, expect, it } from 'vitest';
import { staticMap } from '../src/staticMap';

const gyeongpo = { latE7: 377_953_000, lonE7: 1_288_965_000 };
const anmok = { latE7: 377_717_000, lonE7: 1_289_480_000 };

describe('정적 지도 프록시 (staticMap)', () => {
  it('asks Kakao with the REST key and every stop as a marker, and hands the image back no-store', async () => {
    let seen: { url: string; auth: string } | null = null;
    const fetcher = (async (url: string, init?: RequestInit) => {
      seen = { url, auth: (init?.headers as Record<string, string>).Authorization };
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }) as unknown as typeof fetch;
    const res = await staticMap({ points: [gyeongpo, anmok], width: 640, height: 512 }, 'KEY', fetcher);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(seen!.auth).toBe('KakaoAK KEY');
    const q = new URL(seen!.url).searchParams;
    expect(q.get('size')).toBe('640x512');
    expect(q.getAll('markers')).toEqual(['location:128.8965,37.7953|option:false', 'location:128.948,37.7717|option:false']);
  });

  it('rejects bad input before spending a call, and says so when there is no key or Kakao refuses', async () => {
    const never = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
    expect((await staticMap({ points: [], width: 640, height: 512 }, 'k', never)).status).toBe(400);
    expect((await staticMap({ points: Array(6).fill(gyeongpo), width: 640, height: 512 }, 'k', never)).status).toBe(400);
    expect((await staticMap({ points: [gyeongpo], width: 5000, height: 512 }, 'k', never)).status).toBe(400);
    expect((await staticMap({ points: [{ latE7: 1.5, lonE7: 2 }], width: 640, height: 512 }, 'k', never)).status).toBe(400);
    expect((await staticMap({ points: [gyeongpo], width: 640, height: 512 }, undefined, never)).status).toBe(503);
    const denied = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
    expect((await staticMap({ points: [gyeongpo], width: 640, height: 512 }, 'k', denied)).status).toBe(502);
    const notImage = (async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    expect((await staticMap({ points: [gyeongpo], width: 640, height: 512 }, 'k', notImage)).status).toBe(502);
  });
});

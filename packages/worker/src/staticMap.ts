import { error, json, SECURITY_HEADERS } from './http';
import type { Point } from './route';

/**
 * The car's next-trip card shows a real map (Kakao's static map) instead of a drawn sketch. The car asks here, never
 * Kakao directly, so the Kakao REST key stays on the server. Only the few stops to mark (at most 5, Kakao's limit) and
 * the picture size are sent; the image is returned as it came and is neither stored nor logged, and it is sent
 * `no-store`: Kakao's terms do not allow keeping a static map for a later visit, so the car asks again each time it
 * needs the map and holds it only while the screen is open.
 */
const MAX_MARKERS = 5;
const isPoint = (p: unknown): p is Point => {
  const v = p as Point;
  return !!v && Number.isInteger(v.latE7) && Number.isInteger(v.lonE7) && Math.abs(v.latE7) <= 900_000_000 && Math.abs(v.lonE7) <= 1_800_000_000;
};
const inRange = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

export async function staticMap(body: Record<string, unknown>, key: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const { points, width, height } = body;
  if (!Array.isArray(points) || points.length < 1 || points.length > MAX_MARKERS || !points.every(isPoint)) return error('BAD_REQUEST');
  if (!inRange(width, 200, 1024) || !inRange(height, 200, 1024)) return error('BAD_REQUEST');
  if (!key) return json({ error: 'MAP_UNAVAILABLE' }, 503);

  const q = new URLSearchParams();
  q.set('size', `${width}x${height}`);
  q.set('scale', '1');
  q.set('format', 'jpg');
  // option:false — every marker counts toward the map's centre and zoom, so all of them are in view.
  for (const p of points as Point[]) q.append('markers', `location:${p.lonE7 / 1e7},${p.latE7 / 1e7}|option:false`);
  try {
    const res = await fetcher(`https://dapi.kakao.com/v2/maps/staticmap?${q}`, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return json({ error: 'MAP_UNAVAILABLE' }, 502);
    const type = res.headers.get('Content-Type') ?? '';
    if (!type.startsWith('image/')) return json({ error: 'MAP_UNAVAILABLE' }, 502);
    return new Response(res.body, { status: 200, headers: { ...SECURITY_HEADERS, 'Content-Type': type } });
  } catch {
    return json({ error: 'MAP_UNAVAILABLE' }, 502);
  }
}

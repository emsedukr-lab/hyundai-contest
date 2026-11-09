import { error, json } from './http';

/**
 * Driving times between consecutive stops for the trip editor, from Kakao Mobility directions, proxied so the Kakao
 * REST key never reaches the browser. Only the coordinates of the stops in question are sent; nothing is stored or
 * logged. The phone never sends home coordinates here (legs touching home stay for the car's own navigation).
 */
export interface Point {
  latE7: number;
  lonE7: number;
}

const MAX_POINTS = 25; // a day holds at most 20 stops plus its two ends
const SAME_SPOT_M = 30; // Kakao refuses origin == destination; a leg this short is 0 minutes without asking

const isPoint = (p: unknown): p is Point => {
  const v = p as Point;
  return !!v && Number.isInteger(v.latE7) && Number.isInteger(v.lonE7) && Math.abs(v.latE7) <= 900_000_000 && Math.abs(v.lonE7) <= 1_800_000_000;
};

/** Metres between two points (equirectangular is plenty at this scale). */
export function distanceM(a: Point, b: Point): number {
  const k = Math.PI / 180 / 1e7;
  const x = (b.lonE7 - a.lonE7) * k * Math.cos(((a.latE7 + b.latE7) / 2) * k);
  const y = (b.latE7 - a.latE7) * k;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * Drops consecutive points at the same spot (their leg is 0 minutes) and remembers, for every original leg, which
 * section of the route to ask Kakao for (or null for a same-spot leg).
 */
export function planRequest(points: Point[]): { route: Point[]; sectionOf: (number | null)[] } {
  const route: Point[] = [points[0]];
  const sectionOf: (number | null)[] = [];
  for (let i = 1; i < points.length; i++) {
    if (distanceM(route[route.length - 1], points[i]) < SAME_SPOT_M) sectionOf.push(null);
    else {
      route.push(points[i]);
      sectionOf.push(route.length - 2);
    }
  }
  return { route, sectionOf };
}

const xy = (p: Point) => ({ x: p.lonE7 / 1e7, y: p.latE7 / 1e7 });

/** `body` is `{ points: [{latE7, lonE7}, …] }` (2–25); the answer is `{ minutes, meters }`, one entry per leg each. */
export async function routeDurations(body: Record<string, unknown>, key: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const points = body.points;
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS || !points.every(isPoint)) return error('BAD_REQUEST');
  if (!key) return json({ error: 'ROUTE_UNAVAILABLE' }, 503);
  const { route, sectionOf } = planRequest(points);
  const minutes: (number | null)[] = sectionOf.map((s) => (s === null ? 0 : null));
  const meters: (number | null)[] = sectionOf.map((s) => (s === null ? 0 : null));
  if (route.length < 2) return json({ provider: 'KAKAO', minutes, meters });
  try {
    const res = await fetcher('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
      method: 'POST',
      headers: { Authorization: `KakaoAK ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: xy(route[0]),
        destination: xy(route[route.length - 1]),
        waypoints: route.slice(1, -1).map(xy),
        priority: 'RECOMMEND',
        alternatives: false,
        road_details: false,
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return json({ error: 'ROUTE_UNAVAILABLE' }, 502);
    type Leg = { duration?: number; distance?: number };
    const data = (await res.json()) as { routes?: { result_code?: number; summary?: Leg; sections?: Leg[] }[] };
    const r = data.routes?.[0];
    // No drivable route (an island, a closed road): the legs stay empty and the car marks them 'Check'.
    if (!r || r.result_code !== 0) return json({ provider: 'KAKAO', minutes, meters });
    const sections: Leg[] = r.sections ?? (route.length === 2 && r.summary ? [r.summary] : []);
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    sectionOf.forEach((s, i) => {
      if (s === null) return;
      const sec = sections[s];
      if (ok(sec?.duration)) minutes[i] = Math.min(1440, Math.max(1, Math.ceil(sec.duration / 60)));
      if (ok(sec?.distance)) meters[i] = Math.round(sec.distance); // the recommended route's length, metres
    });
    return json({ provider: 'KAKAO', minutes, meters });
  } catch {
    return json({ error: 'ROUTE_UNAVAILABLE' }, 502);
  }
}

import { error, json } from './http';

/**
 * Driving times between consecutive stops for the trip editor, from Kakao Mobility directions, proxied so the Kakao
 * REST key never reaches the browser. Only the coordinates of the stops in question are sent (home too, when the phone
 * has a home address in 설정); nothing is stored or logged. The same request also returns each leg's road line for
 * the day map ({@link routePaths}).
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

type Section = { duration?: number; distance?: number; roads?: { vertexes?: number[] }[] };

/** Validates `{ points }`, asks Kakao for one route through them, and hands back each leg's section (or a ready response). */
async function askKakao(
  body: Record<string, unknown>,
  key: string | undefined,
  fetcher: typeof fetch,
): Promise<Response | { sectionOf: (number | null)[]; sections: Section[] | null }> {
  const points = body.points;
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS || !points.every(isPoint)) return error('BAD_REQUEST');
  if (!key) return json({ error: 'ROUTE_UNAVAILABLE' }, 503);
  const { route, sectionOf } = planRequest(points);
  if (route.length < 2) return { sectionOf, sections: [] };
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
    const data = (await res.json()) as { routes?: { result_code?: number; summary?: Section; sections?: Section[] }[] };
    const r = data.routes?.[0];
    // No drivable route (an island, a closed road): the legs stay empty and the car marks them 'Check'.
    if (!r || r.result_code !== 0) return { sectionOf, sections: null };
    return { sectionOf, sections: r.sections ?? (route.length === 2 && r.summary ? [r.summary] : []) };
  } catch {
    return json({ error: 'ROUTE_UNAVAILABLE' }, 502);
  }
}

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** `body` is `{ points: [{latE7, lonE7}, …] }` (2–25); the answer is `{ minutes, meters }`, one entry per leg each. */
export async function routeDurations(body: Record<string, unknown>, key: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const asked = await askKakao(body, key, fetcher);
  if (asked instanceof Response) return asked;
  const { sectionOf, sections } = asked;
  const minutes: (number | null)[] = sectionOf.map((s) => (s === null ? 0 : null));
  const meters: (number | null)[] = sectionOf.map((s) => (s === null ? 0 : null));
  sectionOf.forEach((s, i) => {
    if (s === null || !sections) return;
    const sec = sections[s];
    if (ok(sec?.duration)) minutes[i] = Math.min(1440, Math.max(1, Math.ceil(sec.duration / 60)));
    if (ok(sec?.distance)) meters[i] = Math.round(sec.distance); // the recommended route's length, metres
  });
  return json({ provider: 'KAKAO', minutes, meters });
}

const PATH_TOLERANCE_M = 5; // a drawn route line loses nothing visible at this tolerance
const PATH_MAX_POINTS = 1500; // per leg; a longer road keeps its shape at a coarser tolerance

/** Douglas–Peucker on [lat, lon] pairs (degrees), tolerance in metres; keeps both ends. */
export function simplify(pts: [number, number][], toleranceM: number): [number, number][] {
  if (pts.length <= 2) return pts;
  const k = Math.PI / 180;
  const cos = Math.cos(pts[0][0] * k);
  const m = (p: [number, number]) => [p[1] * k * cos * 6_371_000, p[0] * k * 6_371_000] as const; // x, y in metres
  const xy2 = pts.map(m);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy2[a];
    const [bx, by] = xy2[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let farD = toleranceM;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy2[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dx * (ay - py) - dy * (ax - px)) / len;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** One section's road line from Kakao's `roads[].vertexes` (x,y = lon,lat pairs), joins de-duplicated, simplified. */
export function sectionPath(sec: Section | undefined): [number, number][] | null {
  const raw: [number, number][] = [];
  for (const road of sec?.roads ?? []) {
    const v = road.vertexes ?? [];
    for (let i = 0; i + 1 < v.length; i += 2) {
      const p: [number, number] = [v[i + 1], v[i]];
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      const last = raw[raw.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) raw.push(p);
    }
  }
  if (raw.length < 2) return null;
  let tol = PATH_TOLERANCE_M;
  let out = simplify(raw, tol);
  while (out.length > PATH_MAX_POINTS) out = simplify(raw, (tol *= 2));
  return out;
}

/**
 * The road each leg actually takes, for drawing the day's route on the map like a navigation app. Same body as
 * durations; the answer is `{ paths }`, one per leg: `[latE5, lonE5, …]` integers, `[]` for a same-spot leg, null when
 * Kakao has no road for it.
 */
export async function routePaths(body: Record<string, unknown>, key: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const asked = await askKakao(body, key, fetcher);
  if (asked instanceof Response) return asked;
  const { sectionOf, sections } = asked;
  const paths = sectionOf.map((s) => {
    if (s === null) return [];
    const line = sections ? sectionPath(sections[s]) : null;
    return line ? line.flatMap(([lat, lon]) => [Math.round(lat * 1e5), Math.round(lon * 1e5)]) : null;
  });
  return json({ provider: 'KAKAO', paths });
}

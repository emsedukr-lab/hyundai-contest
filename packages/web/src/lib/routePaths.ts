import { apiUrl } from './platform';
import type { LegRun, Point } from './routeTimes';

/**
 * The road each leg of a day actually takes, for drawing the day map like a navigation app instead of straight
 * lines. Same coordinates as the travel-time request (one Kakao directions call per run of the day), through the relay;
 * the lines are kept in memory for this session only, so reopening the map or switching days doesn't ask again.
 */
export interface LegLine {
  key: string;
  from: Point;
  to: Point;
  /** [lat, lon] degrees along the road; [] = same spot (nothing to draw); null = no road known (draw a dashed line). */
  path: [number, number][] | null;
}

type Fetcher = typeof fetch;
type Paths = (number[] | null)[];

const cache = new Map<string, Promise<Paths | null>>();
const runKey = (run: LegRun) => run.points.map((p) => `${p.latE7},${p.lonE7}`).join(';');

/** `[latE5, lonE5, …]` from the relay → [lat, lon] degree pairs. */
export function decodePath(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i] / 1e5, flat[i + 1] / 1e5]);
  return out;
}

async function askPaths(run: LegRun, fetcher: Fetcher): Promise<Paths | null> {
  try {
    const res = await fetcher(apiUrl('/api/v1/routes/paths'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: run.points }) });
    if (!res.ok) return null;
    const data = (await res.json()) as { paths?: unknown };
    if (!Array.isArray(data.paths) || data.paths.length !== run.keys.length) return null;
    return data.paths.map((p) => (Array.isArray(p) && p.every((n) => typeof n === 'number') ? (p as number[]) : null));
  } catch {
    return null;
  }
}

/** One run's road lines, asked once per session (a failed answer is not remembered, so the next opening tries again). */
function pathsFor(run: LegRun, fetcher: Fetcher): Promise<Paths | null> {
  const k = runKey(run);
  let p = cache.get(k);
  if (!p) {
    p = askPaths(run, fetcher).then((r) => {
      if (!r) cache.delete(k);
      return r;
    });
    cache.set(k, p);
  }
  return p;
}

/** Every askable leg of the given runs (one day's) with its two ends and its road line. Runs are asked one after another. */
export async function roadLines(runs: LegRun[], fetcher: Fetcher = fetch): Promise<LegLine[]> {
  const out: LegLine[] = [];
  for (const run of runs) {
    const paths = await pathsFor(run, fetcher);
    run.keys.forEach((key, i) => {
      const raw = paths?.[i];
      out.push({ key, from: run.points[i], to: run.points[i + 1], path: raw ? decodePath(raw) : null });
    });
  }
  return out;
}

/** For tests: forget the session's road lines. */
export const clearRoadLines = () => cache.clear();

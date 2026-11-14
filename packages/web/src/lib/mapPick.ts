import type { Place, Trip } from '@tteonaljido/shared';
import type { MapRect, PlaceHit } from './pairing';

/**
 * The logic behind 지도에서 보고 담기 (the map picker in the add-place sheet), kept apart from the Kakao map so it can be
 * tested without one. Every coordinate here comes from the trip or from the part of the map the user is looking at —
 * never from the user's own location.
 */

/** The area the relay accepts for a map search (same numbers as the worker's `parseRect`). */
export const KOREA: MapRect = [124, 33, 132, 39.5];

/** The map's rect cut to {@link KOREA}, so a view that runs out to sea still searches; null if nothing is left. */
export function clampRect(r: MapRect): MapRect | null {
  const out: MapRect = [Math.max(r[0], KOREA[0]), Math.max(r[1], KOREA[1]), Math.min(r[2], KOREA[2]), Math.min(r[3], KOREA[3])];
  return out[0] < out[2] && out[1] < out[3] ? out : null;
}

/**
 * A view over about 100 km across is a province, not the area of a trip: a chip would bring back 15 places from
 * anywhere in it, so the picker asks to zoom in first. A whole city on a tall phone map (about 25 × 55 km) still
 * searches; so does a keyword at any zoom.
 */
export const tooWide = (r: MapRect) => r[2] - r[0] > 1.2 || r[3] - r[1] > 1;

type Point = { latE7: number; lonE7: number };

/** Straight-line distance in metres (haversine). */
export function distanceM(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const la1 = (a.latE7 / 1e7) * rad;
  const la2 = (b.latE7 / 1e7) * rad;
  const dLat = la2 - la1;
  const dLon = ((b.lonE7 - a.lonE7) / 1e7) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const hasCoords = (p: Place): p is Place & Point => p.latE7 !== null && p.lonE7 !== null;
const sameName = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/** The trip place this result already is — the same Kakao place, or the same name within 50 m — or null. */
export function tripMatch(plan: Trip, hit: PlaceHit): string | null {
  const p = plan.places.find(
    (p) => (p.source.provider === 'KAKAO' && !!hit.externalId && p.source.externalId === hit.externalId) || (sameName(p.name, hit.name) && hasCoords(p) && distanceM(p, hit) <= 50),
  );
  return p?.placeRef ?? null;
}

/** Metres from this result to the nearest place already in the trip (itself excluded), or null if none has coordinates. */
export function nearestTripM(plan: Trip, hit: PlaceHit): number | null {
  const self = tripMatch(plan, hit);
  let best: number | null = null;
  for (const p of plan.places) {
    if (p.placeRef === self || !hasCoords(p)) continue;
    const d = distanceM(p, hit);
    if (best === null || d < best) best = d;
  }
  return best;
}

/** "400m", "2.4km", "12km" — rounded the way a person would say it (the caller adds 약). */
export function distanceText(m: number): string {
  if (m < 950) return `${Math.max(100, Math.round(m / 100) * 100)}m`;
  const km = m / 1000;
  return km < 9.95 ? `${Math.round(km * 10) / 10}km` : `${Math.round(km)}km`;
}

/**
 * What the map shows first: the trip's places that have coordinates — every day's stops and 담아 둔 곳 — or, when
 * there are none, its lodging; empty means there is nothing to centre on until the user searches.
 */
export function startPoints(plan: Trip): (Place & Point)[] {
  const visited = new Set(plan.visits.map((v) => v.placeRef));
  const stops = plan.places.filter((p) => visited.has(p.placeRef) && hasCoords(p)) as (Place & Point)[];
  if (stops.length) return stops;
  return plan.places.filter((p) => p.category === 'LODGING' && hasCoords(p)) as (Place & Point)[];
}

/** Every trip place with coordinates, for the neutral route-context pins. */
export const tripPins = (plan: Trip) => plan.places.filter(hasCoords) as (Place & Point)[];

/** 목록 | 지도 in the add-place sheet: the last choice, for this browser tab only. */
export type CollectMode = 'list' | 'map';
const MODE_KEY = 'tteonaljido.collectMode';
export function lastMode(): CollectMode {
  try {
    return sessionStorage.getItem(MODE_KEY) === 'map' ? 'map' : 'list';
  } catch {
    return 'list';
  }
}
export function rememberMode(m: CollectMode) {
  try {
    sessionStorage.setItem(MODE_KEY, m);
  } catch {
    /* private mode: the choice just isn't kept */
  }
}

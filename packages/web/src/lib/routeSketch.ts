import type { Endpoint, Home, Trip } from '@tteonaljido/shared';

/**
 * 경로 스케치 (route sketch): a day's stops laid out by their relative coordinates, for a no-map "route at a glance".
 * Pure and dependency-free so it honors the strict CSP (the component draws it as inline SVG — no tiles, no external
 * script, no new key). Coordinates are only relative (min/max normalized into a unit box); nothing leaves the device.
 */

export interface SketchNode {
  kind: 'start' | 'stop' | 'end';
  label: string;
  /** 1-based stop number (null for the day's start/end anchors). */
  n: number | null;
  x: number;
  y: number;
}

export interface Sketch {
  nodes: SketchNode[];
  /** Names of stops with no coordinates (can't be plotted; shown as a note). */
  noCoords: string[];
  width: number;
  height: number;
}

/** A day's ordered point (start anchor, numbered stops, end anchor) with its real coordinates — for the map or the sketch. */
export interface DayPoint {
  kind: 'start' | 'stop' | 'end';
  label: string;
  n: number | null;
  latE7: number | null;
  lonE7: number | null;
}

const placeOf = (plan: Trip, ref: string | null) => (ref ? plan.places.find((p) => p.placeRef === ref) ?? null : null);
const visitRef = (plan: Trip, visitId: string) => plan.visits.find((v) => v.visitId === visitId)?.placeRef ?? null;
const endpointRef = (e: Endpoint) => (e.kind === 'PLACE' ? e.placeRef : null);

function anchor(plan: Trip, home: Home | null, e: Endpoint, homeLabel: string): { latE7: number | null; lonE7: number | null; label: string } | null {
  if (e.kind === 'HOME') return home ? { latE7: home.latE7, lonE7: home.lonE7, label: homeLabel } : null;
  if (e.kind === 'CURRENT') return null; // the car's position when it leaves: nothing to draw yet
  const p = placeOf(plan, endpointRef(e));
  return p ? { latE7: p.latE7, lonE7: p.lonE7, label: p.name } : null;
}

/** The day's start → stops → end in order, each with its coordinates (null when unknown). Pure; nothing leaves the device. */
export function dayPoints(plan: Trip, home: Home | null, dayIndex: number, opts?: { homeLabel?: string }): DayPoint[] {
  const homeLabel = opts?.homeLabel ?? '집';
  const day = plan.days[dayIndex - 1];
  const out: DayPoint[] = [];
  const start =
    dayIndex === 1 ? anchor(plan, home, plan.origin, homeLabel) : (() => { const p = placeOf(plan, plan.days[dayIndex - 2]?.lodgingPlaceRef ?? null); return p ? { latE7: p.latE7, lonE7: p.lonE7, label: p.name } : null; })();
  if (start) out.push({ kind: 'start', label: start.label, n: null, latE7: start.latE7, lonE7: start.lonE7 });
  day.visitOrder.forEach((id, i) => {
    const p = placeOf(plan, visitRef(plan, id));
    out.push({ kind: 'stop', label: p?.name ?? id, n: i + 1, latE7: p?.latE7 ?? null, lonE7: p?.lonE7 ?? null });
  });
  const end =
    dayIndex === plan.days.length ? anchor(plan, home, plan.finalDestination, homeLabel) : (() => { const p = placeOf(plan, day.lodgingPlaceRef); return p ? { latE7: p.latE7, lonE7: p.lonE7, label: p.name } : null; })();
  if (end) out.push({ kind: 'end', label: end.label, n: null, latE7: end.latE7, lonE7: end.lonE7 });
  return out;
}

const ratio = (v: number, min: number, span: number) => (span > 0 ? (v - min) / span : 0.5);

/** Normalizes a day's points into a `width`×`height` box (north up). Points without coordinates are returned in `noCoords`. */
export function daySketch(plan: Trip, home: Home | null, dayIndex: number, opts?: { width?: number; height?: number; pad?: number; homeLabel?: string }): Sketch {
  const width = opts?.width ?? 100;
  const height = opts?.height ?? 100;
  const pad = opts?.pad ?? 12;
  const raws = dayPoints(plan, home, dayIndex, { homeLabel: opts?.homeLabel });
  const plot = raws.filter((r): r is DayPoint & { latE7: number; lonE7: number } => r.latE7 !== null && r.lonE7 !== null);
  const noCoords = raws.filter((r) => r.kind === 'stop' && (r.latE7 === null || r.lonE7 === null)).map((r) => r.label);
  if (plot.length === 0) return { nodes: [], noCoords, width, height };
  // Scale to the stops' own extent (≥2) so a far-away origin/home doesn't collapse the day's stops into one dot; the
  // start/end anchors are still plotted but clamp to the edge when they fall outside that box.
  const stops = plot.filter((r) => r.kind === 'stop');
  const base = stops.length >= 2 ? stops : plot;
  const minLat = Math.min(...base.map((r) => r.latE7));
  const maxLat = Math.max(...base.map((r) => r.latE7));
  const minLon = Math.min(...base.map((r) => r.lonE7));
  const maxLon = Math.max(...base.map((r) => r.lonE7));
  const clamp = (v: number) => Math.max(pad, Math.min(width - pad, v));
  const clampY = (v: number) => Math.max(pad, Math.min(height - pad, v));
  const nodes: SketchNode[] = plot.map((r) => ({
    kind: r.kind,
    label: r.label,
    n: r.n,
    x: clamp(pad + ratio(r.lonE7, minLon, maxLon - minLon) * (width - 2 * pad)),
    y: clampY(pad + (1 - ratio(r.latE7, minLat, maxLat - minLat)) * (height - 2 * pad)), // invert so north is up
  }));
  return { nodes, noCoords, width, height };
}

/** One day of the whole-trip sketch: its stops (and that night's lodging) in order, joined to the previous day's end. */
export interface TripSketchDay {
  dayIndex: number;
  /** The previous day's last plotted point, so the route reads as one line from day to day (null on the first). */
  from: { x: number; y: number } | null;
  points: { x: number; y: number; kind: 'stop' | 'lodging'; n: number | null }[];
}

export interface TripSketch {
  days: TripSketchDay[];
  width: number;
  height: number;
  /** How many points could be placed (places without coordinates are skipped). */
  plotted: number;
}

/**
 * 전체 동선 (M45, the 여행 tab's next-trip card): every day's stops and lodgings on one sketch. North up, and unlike the
 * day sketch it keeps the map's proportions (longitude scaled by cos(latitude)) so the trip's shape reads true. Home is
 * left out — a far-away start would shrink the trip itself to a dot. Pure; coordinates never leave the device.
 */
export function tripSketch(plan: Trip, opts?: { width?: number; height?: number; pad?: number }): TripSketch {
  const width = opts?.width ?? 300;
  const height = opts?.height ?? 140;
  const pad = opts?.pad ?? 16;
  type Raw = { dayIndex: number; kind: 'stop' | 'lodging'; n: number | null; latE7: number; lonE7: number };
  const raws: Raw[] = [];
  for (const day of plan.days) {
    day.visitOrder.forEach((id, i) => {
      const p = placeOf(plan, visitRef(plan, id));
      if (p && p.latE7 !== null && p.lonE7 !== null) raws.push({ dayIndex: day.dayIndex, kind: 'stop', n: i + 1, latE7: p.latE7, lonE7: p.lonE7 });
    });
    const lodging = day.dayIndex < plan.days.length ? placeOf(plan, day.lodgingPlaceRef) : null;
    if (lodging && lodging.latE7 !== null && lodging.lonE7 !== null) raws.push({ dayIndex: day.dayIndex, kind: 'lodging', n: null, latE7: lodging.latE7, lonE7: lodging.lonE7 });
  }
  if (raws.length === 0) return { days: [], width, height, plotted: 0 };
  const lat0 = ((raws.reduce((a, r) => a + r.latE7, 0) / raws.length) * 1e-7 * Math.PI) / 180;
  const k = Math.cos(lat0);
  const xs = raws.map((r) => r.lonE7 * k);
  const ys = raws.map((r) => r.latE7);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX ? (width - 2 * pad) / spanX : Infinity, spanY ? (height - 2 * pad) / spanY : Infinity);
  // Centre the shape in the box (a north–south trip stands in the middle instead of hugging the left edge).
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const at = (i: number) => ({ x: offX + (xs[i] - minX) * scale, y: offY + (maxY - ys[i]) * scale });
  const days: TripSketchDay[] = [];
  let last: { x: number; y: number } | null = null;
  for (const day of plan.days) {
    const points = raws.flatMap((r, i) => (r.dayIndex === day.dayIndex ? [{ ...at(i), kind: r.kind, n: r.n }] : []));
    if (points.length === 0) continue;
    days.push({ dayIndex: day.dayIndex, from: last, points });
    last = points[points.length - 1];
  }
  return { days, width, height, plotted: raws.length };
}

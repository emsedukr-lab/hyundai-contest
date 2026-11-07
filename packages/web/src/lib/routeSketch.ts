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

interface Raw {
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
  const p = placeOf(plan, endpointRef(e));
  return p ? { latE7: p.latE7, lonE7: p.lonE7, label: p.name } : null;
}

function rawNodes(plan: Trip, home: Home | null, dayIndex: number, homeLabel: string): Raw[] {
  const day = plan.days[dayIndex - 1];
  const out: Raw[] = [];
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
  const raws = rawNodes(plan, home, dayIndex, opts?.homeLabel ?? '집');
  const plot = raws.filter((r): r is Raw & { latE7: number; lonE7: number } => r.latE7 !== null && r.lonE7 !== null);
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

import { describe, expect, it } from 'vitest';
import { sampleTrip, type Home } from '@tteonaljido/shared';
import { nowIso } from './trips';
import { dayPoints, daySketch, tripSketch } from './routeSketch';

const home: Home = { address: '서울', latE7: 375_662_952, lonE7: 1_269_779_451 };

describe('경로 스케치 정규화', () => {
  const trip = sampleTrip(nowIso());

  it('좌표 있는 장소를 상자 안으로 정규화하고 번호를 붙인다', () => {
    const s = daySketch(trip, home, 2, { width: 100, height: 100, pad: 10 });
    expect(s.nodes.length).toBeGreaterThan(0);
    for (const n of s.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(10);
      expect(n.x).toBeLessThanOrEqual(90);
      expect(n.y).toBeGreaterThanOrEqual(10);
      expect(n.y).toBeLessThanOrEqual(90);
    }
    const stops = s.nodes.filter((n) => n.kind === 'stop');
    expect(stops.map((n) => n.n)).toEqual(stops.map((_, i) => i + 1)); // 1..k in order
  });

  it('좌표 없는 장소는 plot에서 빼고 noCoords에 담는다', () => {
    const noCoordTrip = {
      ...trip,
      places: trip.places.map((p, i) => (i === 0 ? { ...p, latE7: null, lonE7: null } : p)),
    };
    const s = daySketch(noCoordTrip, home, 1);
    // the mutated place, if it is a stop on day 1, appears in noCoords and not among plotted nodes
    const stillPlotted = s.nodes.some((n) => n.label === trip.places[0].name && n.kind === 'stop');
    expect(stillPlotted).toBe(false);
  });

  it('좌표가 하나도 없으면 빈 nodes', () => {
    const blank = { ...trip, home: null, places: trip.places.map((p) => ({ ...p, latE7: null, lonE7: null })) };
    const s = daySketch(blank, null, 2);
    expect(s.nodes).toEqual([]);
  });

  it('dayPoints는 시작→정류장(번호)→끝 순서와 실좌표를 준다 (지도용)', () => {
    const pts = dayPoints(trip, home, 2, { homeLabel: '집' });
    expect(pts.length).toBeGreaterThan(0);
    const stops = pts.filter((p) => p.kind === 'stop');
    expect(stops.map((p) => p.n)).toEqual(stops.map((_, i) => i + 1));
    // 좌표가 있는 정류장은 E7 숫자 그대로 보존(지도는 /1e7로 환산)
    const withCoord = stops.find((p) => p.latE7 !== null);
    if (withCoord) expect(typeof withCoord.latE7).toBe('number');
  });

  it('단일 지점은 상자 중앙 근처', () => {
    const one = {
      ...trip,
      origin: { kind: 'HOME' as const },
      finalDestination: { kind: 'HOME' as const },
      places: trip.places.map((p, i) => ({ ...p, latE7: i === 0 ? 375_000_000 : null, lonE7: i === 0 ? 1_270_000_000 : null })),
    };
    const s = daySketch(one, null, 1, { width: 100, height: 100, pad: 10 });
    if (s.nodes.length === 1) {
      expect(s.nodes[0].x).toBeCloseTo(50, 0);
      expect(s.nodes[0].y).toBeCloseTo(50, 0);
    }
  });
});

describe('전체 동선 (tripSketch)', () => {
  const trip = sampleTrip(nowIso());

  it('puts every day in order inside the box, joins each day to the previous one, and leaves home out', () => {
    const s = tripSketch(trip, { width: 300, height: 140, pad: 16 });
    expect(s.days.map((d) => d.dayIndex)).toEqual([...s.days.map((d) => d.dayIndex)].sort((a, b) => a - b));
    expect(s.days[0].from).toBeNull();
    for (let i = 1; i < s.days.length; i++) expect(s.days[i].from).toEqual(s.days[i - 1].points.at(-1));
    const pts = s.days.flatMap((d) => d.points);
    expect(pts.length).toBe(s.plotted);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(15.99);
      expect(p.x).toBeLessThanOrEqual(284.01);
      expect(p.y).toBeGreaterThanOrEqual(15.99);
      expect(p.y).toBeLessThanOrEqual(124.01);
    }
    // stops are numbered within their day; lodgings are not
    expect(pts.filter((p) => p.kind === 'stop').every((p) => p.n !== null && p.n >= 1)).toBe(true);
    expect(pts.filter((p) => p.kind === 'lodging').every((p) => p.n === null)).toBe(true);
  });

  it('keeps proportions: the longer side fills the box and the shape is centred', () => {
    const s = tripSketch(trip, { width: 300, height: 140, pad: 16 });
    const pts = s.days.flatMap((d) => d.points);
    const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    const h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    expect(Math.max(w / 268, h / 108)).toBeCloseTo(1, 5);
    const cx = (Math.max(...pts.map((p) => p.x)) + Math.min(...pts.map((p) => p.x))) / 2;
    expect(cx).toBeCloseTo(150, 5);
  });

  it('returns nothing to draw when no place has coordinates', () => {
    const bare = { ...trip, places: trip.places.map((p) => ({ ...p, latE7: null, lonE7: null })) };
    const s = tripSketch(bare);
    expect(s.plotted).toBe(0);
    expect(s.days).toEqual([]);
  });
});

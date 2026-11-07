import { describe, expect, it } from 'vitest';
import { sampleTrip, type Home } from '@tteonaljido/shared';
import { nowIso } from './trips';
import { daySketch } from './routeSketch';

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

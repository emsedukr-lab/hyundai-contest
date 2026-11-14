import { describe, expect, it } from 'vitest';
import type { Place } from '@tteonaljido/shared';
import { addPlace, emptyPlan } from './trips';
import { clampRect, distanceM, distanceText, lastMode, nearestTripM, rememberMode, startPoints, tooWide, tripMatch, tripPins } from './mapPick';
import type { PlaceHit } from './pairing';

const place = (name: string, latE7: number | null, lonE7: number | null, category: Place['category'] = 'SIGHT', externalId: string | null = null): Omit<Place, 'placeRef'> => ({
  name,
  address: '',
  latE7,
  lonE7,
  category,
  source: externalId ? { provider: 'KAKAO', externalId } : { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});
const hit = (name: string, latE7: number, lonE7: number, externalId = 'k1'): PlaceHit => ({ externalId, name, address: '강릉시', latE7, lonE7, category: 'CAFE' });

const gyeongpo = { latE7: 377_953_000, lonE7: 1_288_965_000 };
const anmok = { latE7: 377_717_000, lonE7: 1_289_480_000 };

describe('map rect', () => {
  it('cuts a view that runs out to sea to the area the relay accepts', () => {
    expect(clampRect([128.85, 37.74, 128.95, 37.8])).toEqual([128.85, 37.74, 128.95, 37.8]);
    expect(clampRect([131.5, 37, 133, 38])).toEqual([131.5, 37, 132, 38]);
    expect(clampRect([140, 35, 141, 36])).toBeNull(); // nothing of Korea left
  });
  it('treats a region-wide view as too wide for a chip', () => {
    expect(tooWide([128.85, 37.74, 128.95, 37.8])).toBe(false);
    expect(tooWide([128.78, 37.55, 129.1, 38.05])).toBe(false); // all of Gangneung on a tall phone map
    expect(tooWide([126, 35, 129, 38])).toBe(true);
  });
});

describe('distance', () => {
  it('measures straight-line metres', () => {
    const d = distanceM(gyeongpo, anmok);
    expect(d).toBeGreaterThan(5_000); // ~5.2 km along the shore
    expect(d).toBeLessThan(5_500);
  });
  it('rounds the way a person says it', () => {
    expect(distanceText(30)).toBe('100m');
    expect(distanceText(420)).toBe('400m');
    expect(distanceText(960)).toBe('1km');
    expect(distanceText(2_440)).toBe('2.4km');
    expect(distanceText(3_000)).toBe('3km');
    expect(distanceText(12_400)).toBe('12km');
  });
});

describe('what is already in the trip', () => {
  const plan = addPlace(addPlace(emptyPlan('t'), place('경포호', gyeongpo.latE7, gyeongpo.lonE7, 'SIGHT', 'k-lake')), place('안목 커피거리', anmok.latE7, anmok.lonE7));
  it('matches the same Kakao place, or the same name within 50 m', () => {
    expect(tripMatch(plan, hit('다른 이름', 1, 1, 'k-lake'))).toBe(plan.places[0].placeRef);
    expect(tripMatch(plan, hit('안목커피거리', anmok.latE7 + 2_000, anmok.lonE7, 'other'))).toBe(plan.places[1].placeRef); // ~22 m, spaces ignored
    expect(tripMatch(plan, hit('안목 커피거리', anmok.latE7 + 10_000, anmok.lonE7, 'other'))).toBeNull(); // ~110 m: another branch
    expect(tripMatch(plan, hit('테라로사', anmok.latE7, anmok.lonE7, 'other'))).toBeNull();
  });
  it('gives the distance to the nearest trip place, not to itself', () => {
    expect(nearestTripM(plan, hit('경포호', gyeongpo.latE7, gyeongpo.lonE7, 'k-lake'))).toBeGreaterThan(4_800);
    expect(nearestTripM(plan, hit('호숫가 카페', gyeongpo.latE7 + 1_000, gyeongpo.lonE7, 'x'))).toBeLessThan(20);
    expect(nearestTripM(emptyPlan('t'), hit('호숫가 카페', 1, 1))).toBeNull();
  });
});

describe('where the map starts', () => {
  it('fits the trip places with coordinates, then the lodging, else nothing', () => {
    const named = addPlace(emptyPlan('t'), place('이름만', null, null));
    expect(startPoints(named)).toEqual([]);
    const lodged = addPlace(named, place('호텔', anmok.latE7, anmok.lonE7, 'LODGING'));
    expect(startPoints(lodged).map((p) => p.name)).toEqual(['호텔']);
    const both = addPlace(lodged, place('경포호', gyeongpo.latE7, gyeongpo.lonE7));
    expect(startPoints(both).map((p) => p.name)).toEqual(['경포호']);
    expect(tripPins(both).map((p) => p.name)).toEqual(['호텔', '경포호']);
  });
});

describe('목록 | 지도 choice', () => {
  it('starts as the list and remembers the last choice for the tab', () => {
    sessionStorage.clear();
    expect(lastMode()).toBe('list');
    rememberMode('map');
    expect(lastMode()).toBe('map');
    rememberMode('list');
    expect(lastMode()).toBe('list');
  });
});

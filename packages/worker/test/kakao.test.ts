import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { categoryOf, parseRect, searchPlaces } from '../src/kakao';

describe('categoryOf: a searched place\'s kind from Kakao\'s group code and category path', () => {
  it('keeps a restaurant a meal', () => {
    expect(categoryOf('FD6', '음식점 > 한식 > 국밥')).toBe('FOOD');
    expect(categoryOf('FD6', '음식점 > 술집 > 실내포장마차')).toBe('FOOD');
    expect(categoryOf('FD6', '')).toBe('FOOD'); // no path given: the group code decides, as before
  });
  it('does not call a snack shop a restaurant', () => {
    // A hangwa or rice-cake shop sells things to take away: it is a shop, not a meal.
    expect(categoryOf('FD6', '음식점 > 간식 > 떡,한과')).toBe('OTHER');
    expect(categoryOf('FD6', '음식점 > 간식 > 닭강정')).toBe('OTHER');
    expect(categoryOf('FD6', '음식점 > 간식')).toBe('OTHER');
    // A bakery or an ice-cream place is a dessert stop.
    expect(categoryOf('FD6', '음식점 > 간식 > 제과,베이커리')).toBe('CAFE');
    expect(categoryOf('FD6', '음식점 > 간식 > 아이스크림')).toBe('CAFE');
  });
  it('maps the other groups as before', () => {
    expect(categoryOf('CE7', '음식점 > 카페 > 커피전문점')).toBe('CAFE');
    expect(categoryOf('AD5', '여행 > 숙박 > 호텔')).toBe('LODGING');
    expect(categoryOf('AT4', '여행 > 관광,명소 > 호수')).toBe('SIGHT');
    expect(categoryOf('', '가정,생활 > 식품판매')).toBe('OTHER');
  });
});

const gangneung = [128.85, 37.74, 128.95, 37.8];
const doc = { id: '123', place_name: '테라로사', category_group_code: 'CE7', category_name: '음식점 > 카페', address_name: '강릉시 구정면', road_address_name: '', x: '128.9', y: '37.76' };

/** A fake Kakao that answers one document and remembers the URL it was asked. */
function fakeKakao(status = 200) {
  const seen: URL[] = [];
  const fetcher = (async (input: URL | string) => {
    seen.push(new URL(String(input)));
    return new Response(JSON.stringify({ documents: [doc] }), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}

describe('parseRect: the part of the map on screen', () => {
  it('takes four finite numbers inside Korea, min below max', () => {
    expect(parseRect(gangneung)).toEqual(gangneung);
    expect(parseRect([126.5, 33.2, 126.9, 33.5])).toEqual([126.5, 33.2, 126.9, 33.5]); // Jeju
  });
  it('rejects anything else', () => {
    for (const bad of [
      null,
      'x',
      [1, 2, 3],
      [128.85, 37.74, 128.95, 37.8, 1],
      ['128.85', 37.74, 128.95, 37.8],
      [128.95, 37.74, 128.85, 37.8], // min and max swapped
      [128.85, 37.8, 128.95, 37.8], // no height
      [NaN, 37.74, 128.95, 37.8],
      [128.85, 37.74, Infinity, 37.8],
      [-122.5, 37.7, -122.3, 37.8], // San Francisco
      [139.6, 35.6, 139.8, 35.7], // Tokyo
      [123, 37, 125, 38], // half out at sea to the west
    ])
      expect(parseRect(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('searchPlaces: map search (category or keyword inside the rect)', () => {
  it('a chip searches its Kakao group inside the rect, nearest the middle first', async () => {
    const groups = { FOOD: 'FD6', CAFE: 'CE7', LODGING: 'AD5', SIGHT: 'AT4' } as const;
    for (const [category, code] of Object.entries(groups)) {
      const k = fakeKakao();
      const res = await searchPlaces({ category, rect: gangneung }, 'key', k.fetcher);
      expect(res.status).toBe(200);
      const u = k.seen[0];
      expect(u.pathname).toBe('/v2/local/search/category.json');
      expect(u.searchParams.get('category_group_code')).toBe(code);
      expect(u.searchParams.get('rect')).toBe('128.85,37.74,128.95,37.8');
      expect(u.searchParams.get('sort')).toBe('distance');
      expect(u.searchParams.get('x')).toBe('128.9');
      expect(u.searchParams.get('y')).toBe('37.77');
      expect(u.searchParams.get('size')).toBe('15');
      expect(u.searchParams.get('page')).toBe('1');
      expect(u.searchParams.has('query')).toBe(false);
    }
  });

  it('answers in the same shape as a keyword search', async () => {
    const res = await searchPlaces({ category: 'CAFE', rect: gangneung }, 'key', fakeKakao().fetcher);
    expect(await res.json()).toEqual({
      provider: 'KAKAO',
      results: [{ externalId: '123', name: '테라로사', address: '강릉시 구정면', latE7: 377_600_000, lonE7: 1_289_000_000, category: 'CAFE' }],
    });
  });

  it('a keyword with a rect stays a keyword search, limited to the rect', async () => {
    const k = fakeKakao();
    await searchPlaces({ q: '  초당 순두부 ', rect: gangneung }, 'key', k.fetcher);
    const u = k.seen[0];
    expect(u.pathname).toBe('/v2/local/search/keyword.json');
    expect(u.searchParams.get('query')).toBe('초당 순두부');
    expect(u.searchParams.get('rect')).toBe('128.85,37.74,128.95,37.8');
    expect(u.searchParams.get('sort')).toBe('accuracy');
    expect(u.searchParams.get('size')).toBe('15');
    expect(u.searchParams.has('category_group_code')).toBe(false);
    // keyword + chip: only that kind
    const k2 = fakeKakao();
    await searchPlaces({ q: '순두부', rect: gangneung, category: 'FOOD' }, 'key', k2.fetcher);
    expect(k2.seen[0].pathname).toBe('/v2/local/search/keyword.json');
    expect(k2.seen[0].searchParams.get('category_group_code')).toBe('FD6');
  });

  it('a keyword alone is the search it always was', async () => {
    const k = fakeKakao();
    await searchPlaces({ q: '경포호' }, 'key', k.fetcher);
    const u = k.seen[0];
    expect(u.pathname).toBe('/v2/local/search/keyword.json');
    expect(u.searchParams.get('size')).toBe('10');
    expect(u.searchParams.has('rect')).toBe(false);
    expect(u.searchParams.has('sort')).toBe(false);
  });

  it('bad input is a 400 before Kakao is asked', async () => {
    const k = fakeKakao();
    for (const body of [
      {},
      { q: '' },
      { q: 'x'.repeat(61) },
      { category: 'CAFE' }, // a chip needs the map's rect
      { category: 'OTHER', rect: gangneung },
      { category: 'cafe', rect: gangneung },
      { category: 7, rect: gangneung },
      { category: 'toString', rect: gangneung },
      { q: '카페', rect: [1, 2, 3, 4] },
      { q: '카페', rect: '128.85,37.74,128.95,37.8' },
      { category: 'FOOD', rect: [128.95, 37.74, 128.85, 37.8] },
    ])
      expect((await searchPlaces(body, 'key', k.fetcher)).status, JSON.stringify(body)).toBe(400);
    expect(k.seen).toHaveLength(0);
  });

  it('no key is 503 and Kakao refusing is 502, as before', async () => {
    expect((await searchPlaces({ category: 'FOOD', rect: gangneung }, undefined, fakeKakao().fetcher)).status).toBe(503);
    expect((await searchPlaces({ category: 'FOOD', rect: gangneung }, 'key', fakeKakao(401).fetcher)).status).toBe(502);
  });

  it('route: POST only, bad rect → 400, oversized body → 400', async () => {
    const post = (body: string) => SELF.fetch('https://example.com/api/v1/places/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect((await post(JSON.stringify({ category: 'FOOD', rect: [0, 0, 1, 1] }))).status).toBe(400);
    expect((await post(JSON.stringify({ q: '카페', pad: 'x'.repeat(1100) }))).status).toBe(400);
    expect((await SELF.fetch('https://example.com/api/v1/places/search')).status).toBe(404);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Place } from '@tteonaljido/shared';
import type { Resolved, ResolvedList } from './pairing';
import { fromListPlace, inTrip, mergeLists, readPaste, sameAsShared } from './pasteImport';

const list: Resolved = {
  kind: 'list',
  source: 'naver',
  title: '인천',
  total: 2,
  places: [
    { name: '홍두병', address: '인천 제물포구 차이나타운로 48', latE7: 374752900, lonE7: 1266190800, category: 'CAFE' },
    { name: '태림봉', address: '인천 제물포구 차이나타운로59번길 23', latE7: 374739500, lonE7: 1266194700, category: 'FOOD' },
  ],
};

const place = (over: Partial<Place>): Place => ({
  placeRef: 'p1',
  name: '홍두병',
  address: '',
  latE7: 374752900,
  lonE7: 1266190800,
  category: 'CAFE',
  source: { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
  ...over,
});

describe('붙여넣기 읽기 (readPaste)', () => {
  it('링크가 저장 목록이면 목록으로', async () => {
    const resolve = vi.fn(async () => list);
    expect(await readPaste('[네이버 지도]\n인천\nhttps://naver.me/GntDZ5jO', resolve)).toEqual({ kind: 'list', list });
    expect(resolve).toHaveBeenCalledWith('https://naver.me/GntDZ5jO');
  });

  it('카카오맵 링크는 서버에 묻지 않고 kakao, 네이버 한 장소 링크는 복사한 이름 그대로 (없으면 읽은 이름)', async () => {
    const never = vi.fn(async () => list);
    for (const text of ['https://kko.to/x', '[카카오맵] 경포호 https://kko.to/G5MMYHyPRX', '[카카오맵 즐겨찾기]\n대구\nhttps://kko.to/G5MMYHyPRX', '테라로사\nhttps://place.map.kakao.com/8654759'])
      expect(await readPaste(text, never)).toEqual({ kind: 'kakao' });
    expect(never).not.toHaveBeenCalled();
    expect(await readPaste('경포호\nhttps://naver.me/a', async () => ({ kind: 'place', name: '경포호수', address: '' }))).toEqual({ kind: 'terms', terms: ['경포호'] });
    expect(await readPaste('https://naver.me/a', async () => ({ name: '경포호', address: '' }))).toEqual({ kind: 'terms', terms: ['경포호'] });
  });

  it('여러 줄은 서버에 묻지 않고 이름들로, 읽지 못한 링크는 이름이 있으면 이름으로', async () => {
    const resolve = vi.fn(async () => list);
    expect(await readPaste('경포호\n오죽헌\n초당\nhttps://naver.me/a', resolve)).toEqual({ kind: 'terms', terms: ['경포호', '오죽헌', '초당'] });
    expect(resolve).not.toHaveBeenCalled();
    const fail = async () => {
      throw new Error('x');
    };
    expect(await readPaste('경포호 https://naver.me/a', fail)).toEqual({ kind: 'terms', terms: ['경포호'] });
    expect(await readPaste('https://naver.me/a', fail)).toEqual({ kind: 'failed' });
    expect(await readPaste('   ', fail)).toEqual({ kind: 'empty' });
  });

  it('휴대폰 앱에서 복사한 전문(머리말·목록 이름·링크)에서 링크를 뽑아 목록으로', async () => {
    const resolve = vi.fn(async () => list);
    expect(await readPaste('[네이버지도]\n대구\nhttps://naver.me/aaa', resolve)).toEqual({ kind: 'list', list });
    expect(resolve).toHaveBeenCalledWith('https://naver.me/aaa');
  });

  it('공유 여러 개를 한꺼번에 붙여넣으면 링크마다 읽어 한 목록으로 (겹치는 곳은 한 번, 못 읽은 링크는 빼고)', async () => {
    const [a, b] = list.kind === 'list' ? list.places : [];
    const c = { name: '신포닭강정', address: '인천 중구 우현로49번길 3', latE7: 374719000, lonE7: 1266290000, category: 'FOOD' as const };
    const lists: Record<string, ResolvedList> = {
      aaa: { kind: 'list', source: 'naver', title: '대구', total: 2, places: [a, b] },
      bbb: { kind: 'list', source: 'naver', title: '경남', total: 2, places: [b, c] },
    };
    const resolve = vi.fn(async (url: string) => {
      const found = lists[url.split('/').pop() ?? ''];
      if (!found) throw new Error('x');
      return found;
    });
    const text = '[네이버지도]\n대구\nhttps://naver.me/aaa, [네이버지도]\n경남\nhttps://naver.me/bbb, [네이버지도]\n강릉\nhttps://naver.me/zzz';
    expect(await readPaste(text, resolve)).toEqual({ kind: 'list', list: { kind: 'list', source: 'naver', title: '대구 · 경남', total: 3, places: [a, b, c] } });
    expect(resolve.mock.calls.map((call) => call[0])).toEqual(['https://naver.me/aaa', 'https://naver.me/bbb', 'https://naver.me/zzz']);
    expect(mergeLists([lists.aaa])).toBe(lists.aaa);
  });

  it('링크 여러 개가 모두 한 장소면 복사한 이름들로, 이름이 없으면 읽은 이름들로', async () => {
    const one = async (url: string): Promise<Resolved> => ({ kind: 'place', name: url.endsWith('/a') ? '경포호' : '오죽헌', address: '' });
    expect(await readPaste('경포호수\nhttps://naver.me/a\n오죽헌 한옥\nhttps://naver.me/b', one)).toEqual({ kind: 'terms', terms: ['경포호수', '오죽헌 한옥'] });
    expect(await readPaste('https://naver.me/a https://naver.me/b', one)).toEqual({ kind: 'terms', terms: ['경포호', '오죽헌'] });
    expect(
      await readPaste('https://naver.me/a https://naver.me/b', async () => {
        throw new Error('x');
      }),
    ).toEqual({ kind: 'failed' });
  });

  it('네이버 링크와 다른 링크가 섞이면 네이버 링크를 읽는다', async () => {
    const resolve = vi.fn(async () => list);
    expect(await readPaste('https://example.com/a\nhttps://naver.me/aaa', resolve)).toEqual({ kind: 'list', list });
    expect(resolve).toHaveBeenCalledWith('https://naver.me/aaa');
  });
});

describe('이미 담긴 곳', () => {
  it('목록: 같은 이름 50m 안이거나 같은 주소', () => {
    const p = fromListPlace(list.kind === 'list' ? list.places[0] : (null as never));
    expect(p.source).toEqual({ provider: 'MANUAL', externalId: null });
    expect(inTrip([place({})], p)).toBe(true);
    expect(inTrip([place({ latE7: 374762900 })], p)).toBe(false); // ~110 m away
    expect(inTrip([place({ name: '다른 곳', latE7: null, lonE7: null, address: '인천 제물포구 차이나타운로 48' })], p)).toBe(true);
    expect(inTrip([place({ name: '홍 두 병' })], p)).toBe(true);
  });

  it('/add: 같은 카카오 장소이거나 같은 이름 50m 안 (주소만 같으면 다른 곳)', () => {
    const kakao = place({ source: { provider: 'KAKAO', externalId: '123' }, latE7: null, lonE7: null });
    expect(sameAsShared([kakao], { ...place({}), source: { provider: 'KAKAO', externalId: '123' } })).toBe(kakao);
    expect(sameAsShared([place({ address: 'A' })], { ...place({ name: '다른 곳', address: 'A' }) })).toBeNull();
    expect(sameAsShared([place({})], place({ placeRef: 'x' }))).not.toBeNull();
    expect(sameAsShared([place({ latE7: null, lonE7: null })], place({ latE7: null, lonE7: null }))).not.toBeNull();
    expect(sameAsShared([place({ latE7: null, lonE7: null })], place({}))).toBeNull();
  });
});

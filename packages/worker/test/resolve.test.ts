import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { allowedHost, isKakaoFolder, naverCategory, naverFolderApi, naverPlacePage, parseOg, resolveShare } from '../src/resolve';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe('공유 링크 og 파싱 (parseOg)', () => {
  it('og:title·og:description을 읽고 사이트 접미사를 뗀다', () => {
    expect(parseOg(page('<meta property="og:title" content="경포호 : 네이버 지도"><meta property="og:description" content="강원 강릉시 운정동">'))).toEqual({ name: '경포호', address: '강원 강릉시 운정동' });
  });

  it('속성 순서가 반대여도 읽는다', () => {
    expect(parseOg(page(`<meta content='테라로사 | 카카오맵' property='og:title'>`))?.name).toBe('테라로사');
  });

  it('큰따옴표 값 안의 아포스트로피에서 잘리지 않는다', () => {
    expect(parseOg(page(`<meta property="og:title" content="Mom's Touch 강릉점">`))?.name).toBe("Mom's Touch 강릉점");
  });

  it('이름·숫자 엔티티를 풀어 준다', () => {
    expect(parseOg(page('<meta property="og:title" content="A&amp;B &#44; &#xAC00;&#39;">'))?.name).toBe("A&B , 가'");
  });

  it('네이버 장소 페이지: 제목 끝 제어문자와 접미사를 떼고, 리뷰 수 설명은 주소로 쓰지 않는다', () => {
    const html = page('<meta property="og:title" content="테라로사 커피공장 강릉본점 : 네이버\u001c"><meta property="og:description" content="방문자리뷰 20,158 · 블로그리뷰 9,839">');
    expect(parseOg(html)).toEqual({ name: '테라로사 커피공장 강릉본점', address: '' });
  });

  it('장소가 아닌 앱 홈(앱 이름만)이나 og:title 없음은 실패', () => {
    expect(parseOg(page('<meta property="og:title" content="네이버 지도">'))).toBeNull();
    expect(parseOg(page('<meta property="og:title" content="카카오맵">'))).toBeNull();
    expect(parseOg(page('<title>x</title>'))).toBeNull();
  });
});

describe('공유 링크 SSRF 가드 (네트워크 없이)', () => {
  it('허용 호스트만 통과', () => {
    for (const h of ['naver.me', 'm.place.naver.com', 'kko.to', 'kko.kakao.com', 'place.map.kakao.com']) expect(allowedHost(h)).toBe(true);
    for (const h of ['evil.com', 'naver.com.evil.com', 'kakao.com.attacker.net', 'notnaver.me', 'kko.kl', 'localhost', '127.0.0.1']) expect(allowedHost(h)).toBe(false);
  });

  it('네이버 지도 앱 주소는 같은 장소의 모바일 장소 페이지로 바꿔 읽는다', () => {
    expect(naverPlacePage(new URL('https://map.naver.com/p/entry/place/10968214?placePath=%2Fhome'))?.toString()).toBe('https://m.place.naver.com/place/10968214/home');
    expect(naverPlacePage(new URL('https://map.naver.com/p/search/%ED%85%8C/place/10968214?c=15'))?.toString()).toBe('https://m.place.naver.com/place/10968214/home');
    expect(naverPlacePage(new URL('https://map.naver.com/p/search/abc'))).toBeNull();
    expect(naverPlacePage(new URL('https://place.map.kakao.com/8654759'))).toBeNull();
  });

  it('https 아닌 링크·비허용 호스트·잘못된 URL은 가져오지 않고 400', async () => {
    for (const url of ['http://naver.me/abc', 'https://evil.com/x', 'https://127.0.0.1/', 'not a url', '']) {
      const res = await resolveShare({ url });
      expect(res.status).toBe(400);
    }
  });

  it('라우트: POST /api/v1/places/resolve 도 같은 가드', async () => {
    const res = await SELF.fetch('https://example.com/api/v1/places/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://evil.com/x' }) });
    expect(res.status).toBe(400);
  });
});

const SHARE = '2232c3a969494ef5858ee4f333b191d5';
const OWNER = { nick: '여행자닉', profileImageUrl: 'https://p.example/me.jpg', userId: 'owner-id' };

/** A Naver saved-list answer shaped like the real one, owner fields included so the test can check they are dropped. */
function naverFolder(list: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return {
    folder: { folderId: 1, name: '인천', memo: '내 메모', userId: 'owner-id', userIdNo: 42, encryptedUserIdNo: 'enc', shareId: SHARE, bookmarkCount: list.length, placeUserProfile: OWNER, externalLink: 'https://x.example' },
    bookmarkList: list,
    unavailableCount: 0,
    mismatchedCount: 0,
    removed: false,
    ...extra,
  };
}
const bm = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  displayName: '',
  px: 126.61908,
  py: 37.47529,
  type: 'place',
  sid: '123',
  address: '인천 제물포구 차이나타운로 48',
  mcid: 'CAFE',
  mcidName: '카페',
  available: true,
  memo: '비밀 메모',
  url: 'https://owner.example/link',
  bookmarkId: 9,
  ...over,
});

/** A fake upstream: answers by URL and records every URL asked. */
function upstream(routes: Record<string, () => Response>) {
  const seen: string[] = [];
  const fetcher = (async (input: URL | string) => {
    const u = String(input);
    seen.push(u);
    for (const [prefix, answer] of Object.entries(routes)) if (u.startsWith(prefix)) return answer();
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}
const redirect = (to: string) => () => new Response(null, { status: 307, headers: { Location: to } });
const jsonRes = (body: unknown) => () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const API = `https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${SHARE}/bookmarks`;

describe('네이버 저장 목록 링크', () => {
  it('공유 폴더 주소와 pages 주소는 같은 목록 JSON 주소로 바꾼다', () => {
    expect(naverFolderApi(new URL(`https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}`))?.toString()).toBe(`${API}?start=0&limit=100&sort=lastUseTime`);
    expect(naverFolderApi(new URL(`https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}/place/1?c=15`))?.toString()).toBe(`${API}?start=0&limit=100&sort=lastUseTime`);
    expect(naverFolderApi(new URL(`${API}?start=0&limit=20`))?.toString()).toBe(`${API}?start=0&limit=100&sort=lastUseTime`);
    expect(naverFolderApi(new URL('https://map.naver.com/p/favorite/sharedPlace/folder/abc'))).toBeNull();
    expect(naverFolderApi(new URL(`https://evil.com/p/favorite/sharedPlace/folder/${SHARE}`))).toBeNull();
    expect(naverFolderApi(new URL('https://map.naver.com/p/entry/place/10968214'))).toBeNull();
  });

  it('naver.me → 폴더 → 목록: 이름·주소·좌표·종류만 돌려주고 주인 정보는 버린다', async () => {
    const list = [bm('홍두병'), bm('태림봉', { mcid: 'DINING', mcidName: '음식점', px: 126.61947, py: 37.47395, displayName: '태림봉 차이나타운점' })];
    const up = upstream({ 'https://naver.me/': redirect(`https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}`), [API]: jsonRes(naverFolder(list)) });
    const res = await resolveShare({ url: 'https://naver.me/GntDZ5jO' }, up.fetcher);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      kind: 'list',
      source: 'naver',
      title: '인천',
      total: 2,
      places: [
        { name: '홍두병', address: '인천 제물포구 차이나타운로 48', latE7: 374752900, lonE7: 1266190800, category: 'CAFE' },
        { name: '태림봉 차이나타운점', address: '인천 제물포구 차이나타운로 48', latE7: 374739500, lonE7: 1266194700, category: 'FOOD' },
      ],
    });
    const text = JSON.stringify(body);
    for (const leaked of ['여행자닉', 'owner-id', 'enc', '내 메모', '비밀 메모', 'owner.example', 'me.jpg', SHARE]) expect(text).not.toContain(leaked);
    // the folder page itself is never opened: straight from the redirect to the JSON
    expect(up.seen.map((u) => new URL(u).hostname)).toEqual(['naver.me', 'pages.map.naver.com']);
  });

  it('장소가 아닌 것·쓸 수 없는 곳·좌표 없는 곳은 빼고, 100곳까지만', async () => {
    const many = Array.from({ length: 130 }, (_, i) => bm(`곳${i}`));
    const list = [bm('지운 곳', { available: false }), bm('경로', { type: 'route' }), bm('좌표 없음', { px: null, py: null }), bm('엉뚱한 좌표', { px: 500, py: 37 }), ...many];
    const up = upstream({ [API]: jsonRes(naverFolder(list)) });
    const body = (await (await resolveShare({ url: `https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}` }, up.fetcher)).json()) as { places: { name: string }[]; total: number };
    expect(body.places).toHaveLength(100);
    expect(body.places[0].name).toBe('곳0');
    expect(body.places.map((p) => p.name)).not.toContain('지운 곳');
    expect(body.total).toBe(134);
  });

  it('종류: 코드 먼저, 없으면 이름 낱말', () => {
    expect(naverCategory('DINING', '')).toBe('FOOD');
    expect(naverCategory('CAFE', '')).toBe('CAFE');
    expect(naverCategory('ACCOMMODATION', '')).toBe('LODGING');
    expect(naverCategory('TRAVEL', '')).toBe('SIGHT');
    expect(naverCategory('', '펜션')).toBe('LODGING');
    expect(naverCategory('ETC', '관광명소')).toBe('SIGHT');
    expect(naverCategory('ETC', '한식 음식점')).toBe('FOOD');
    expect(naverCategory('', '주차장')).toBe('OTHER');
  });

  it('목록 JSON이 실패하거나 1MB를 넘거나 장소가 없으면 실패', async () => {
    const url = `https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}`;
    for (const answer of [() => new Response('x', { status: 500 }), () => new Response('not json'), jsonRes(naverFolder([])), () => new Response('a'.repeat(1024 * 1024 + 10))]) {
      const res = await resolveShare({ url }, upstream({ [API]: answer }).fetcher);
      expect(res.status).toBe(422);
    }
  });

  it('리다이렉트가 허용 밖으로 가면 열지 않는다', async () => {
    const up = upstream({ 'https://naver.me/': redirect('https://evil.com/p/favorite/sharedPlace/folder/' + SHARE) });
    expect((await resolveShare({ url: 'https://naver.me/x' }, up.fetcher)).status).toBe(422);
    expect(up.seen).toEqual(['https://naver.me/x']);
    expect((await resolveShare({ url: `http://map.naver.com/p/favorite/sharedPlace/folder/${SHARE}` }, up.fetcher)).status).toBe(400);
  });
});

describe('카카오맵 즐겨찾기 폴더', () => {
  it('폴더 링크는 알아보되 열지 않는다 (카카오가 자동 접근을 막음)', async () => {
    expect(isKakaoFolder(new URL('https://applink.map.kakao.com/collection?folderid=24854214&share_code=abc'))).toBe(true);
    expect(isKakaoFolder(new URL('https://map.kakao.com/?map_type=TYPE_SKYVIEW&folderid=24854214&page=bookmark'))).toBe(true);
    expect(isKakaoFolder(new URL('https://place.map.kakao.com/8654759'))).toBe(false);

    const direct = upstream({});
    const res = await resolveShare({ url: 'https://applink.map.kakao.com/collection?folderid=24854214&share_code=abc' }, direct.fetcher);
    expect(await res.json()).toEqual({ kind: 'unsupported', source: 'kakao' });
    expect(direct.seen).toEqual([]);

    const short = upstream({ 'https://kko.to/': () => new Response(null, { status: 301, headers: { Location: 'https://map.kakao.com/?folderid=24854214&share_code=x' } }) });
    expect(await (await resolveShare({ url: 'https://kko.to/gAVlmNOVJR' }, short.fetcher)).json()).toEqual({ kind: 'unsupported', source: 'kakao' });
    expect(short.seen).toEqual(['https://kko.to/gAVlmNOVJR']);
  });
});

describe('한 장소 링크', () => {
  it('지금처럼 이름·주소에 kind: place', async () => {
    const up = upstream({
      'https://naver.me/': redirect('https://map.naver.com/p/entry/place/10968214'),
      'https://m.place.naver.com/place/10968214/home': () => new Response(page('<meta property="og:title" content="경포호 : 네이버"><meta property="og:description" content="강원 강릉시 운정동">')),
    });
    expect(await (await resolveShare({ url: 'https://naver.me/abc' }, up.fetcher)).json()).toEqual({ kind: 'place', name: '경포호', address: '강원 강릉시 운정동' });
  });
});

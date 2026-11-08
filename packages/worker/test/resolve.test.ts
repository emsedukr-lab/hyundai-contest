import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { allowedHost, parseOg, resolveShare } from '../src/resolve';

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

  it('장소가 아닌 앱 홈(앱 이름만)이나 og:title 없음은 실패', () => {
    expect(parseOg(page('<meta property="og:title" content="네이버 지도">'))).toBeNull();
    expect(parseOg(page('<meta property="og:title" content="카카오맵">'))).toBeNull();
    expect(parseOg(page('<title>x</title>'))).toBeNull();
  });
});

describe('공유 링크 SSRF 가드 (네트워크 없이)', () => {
  it('허용 호스트만 통과', () => {
    for (const h of ['naver.me', 'm.place.naver.com', 'kko.kl', 'kko.to', 'place.map.kakao.com']) expect(allowedHost(h)).toBe(true);
    for (const h of ['evil.com', 'naver.com.evil.com', 'kakao.com.attacker.net', 'notnaver.me', 'localhost', '127.0.0.1']) expect(allowedHost(h)).toBe(false);
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

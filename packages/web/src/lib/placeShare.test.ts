import { describe, expect, it } from 'vitest';
import { sharedParamsFromSearch, sharedPlaceTerm, sharedUrl } from './placeShare';

describe('지도앱 공유 수집 파싱', () => {
  it('제목이 있으면 제목을 검색어로', () => {
    expect(sharedPlaceTerm({ title: '경포호', text: 'https://naver.me/abc', url: 'https://naver.me/abc' })).toBe('경포호');
  });

  it('제목이 없거나 링크면 본문의 첫 비URL 줄을 쓴다', () => {
    expect(sharedPlaceTerm({ title: '', text: '강릉 커피거리\nhttps://kko.kl/xyz' })).toBe('강릉 커피거리');
    expect(sharedPlaceTerm({ title: 'https://maps.app.goo.gl/x', text: '안목해변\nhttps://maps.app.goo.gl/x' })).toBe('안목해변');
  });

  it('쓸 만한 장소명이 없으면 null', () => {
    expect(sharedPlaceTerm({ title: 'https://naver.me/a', text: 'https://naver.me/a' })).toBeNull();
    expect(sharedPlaceTerm({})).toBeNull();
  });

  it('공유된 링크를 찾아낸다 (url, 없으면 본문에서)', () => {
    expect(sharedUrl({ url: 'https://naver.me/abc' })).toBe('https://naver.me/abc');
    expect(sharedUrl({ text: '안목해변 https://kko.kl/xyz 추천' })).toBe('https://kko.kl/xyz');
    expect(sharedUrl({ title: '경포호', text: '경포호' })).toBeNull();
  });

  it('쿼리스트링에서 공유 payload를 읽는다', () => {
    const p = sharedParamsFromSearch('?title=%EA%B2%BD%ED%8F%AC%ED%98%B8&text=hi&url=https%3A%2F%2Fnaver.me%2Fa');
    expect(p.title).toBe('경포호');
    expect(p.text).toBe('hi');
    expect(p.url).toBe('https://naver.me/a');
  });
});

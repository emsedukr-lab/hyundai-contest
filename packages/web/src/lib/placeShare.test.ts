import { describe, expect, it } from 'vitest';
import { parsePastedPlace, sharedParamsFromSearch, sharedPlaceTerm, sharedUrl } from './placeShare';

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

describe('지도앱 복사 붙여넣기 파싱 (parsePastedPlace)', () => {
  it('네이버: 이름 줄 + 링크 줄', () => {
    const r = parsePastedPlace('경포호\nhttps://naver.me/abc');
    expect(r.term).toBe('경포호');
    expect(r.url).toBe('https://naver.me/abc');
  });

  it('카카오: [카카오맵] 접두사와 한 줄에 섞인 링크를 걷어낸다', () => {
    expect(parsePastedPlace('[카카오맵] 테라로사 커피공장 강릉본점 https://kko.kl/xyz').term).toBe('테라로사 커피공장 강릉본점');
  });

  it('한 줄에 이름과 링크가 함께 있어도 이름만', () => {
    expect(parsePastedPlace('안목해변 https://naver.me/x 추천!').term).toBe('안목해변 추천!');
  });

  it('앱 이름만 있는 머리글 줄은 건너뛴다', () => {
    expect(parsePastedPlace('네이버 지도\n경포대\nhttps://naver.me/z').term).toBe('경포대');
    expect(parsePastedPlace('카카오맵\n강문해변').term).toBe('강문해변');
  });

  it('링크만 있고 이름이 없으면 term은 null, url은 반환', () => {
    const r = parsePastedPlace('https://naver.me/onlylink');
    expect(r.term).toBeNull();
    expect(r.url).toBe('https://naver.me/onlylink');
  });

  it('빈 문자열이면 둘 다 null', () => {
    expect(parsePastedPlace('   ')).toEqual({ term: null, url: null });
  });
});

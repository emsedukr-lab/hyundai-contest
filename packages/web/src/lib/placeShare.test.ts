import { describe, expect, it } from 'vitest';
import { isAddressLine, isKakaoLink, isNaverLink, naverShareText, parsePastedPlace, parsePastedPlaces, pastedLinks, sharedParamsFromSearch, sharedPlaceTerm, sharedUrl } from './placeShare';

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

describe('여러 줄 붙여넣기 파싱 (parsePastedPlaces)', () => {
  it('줄마다 한 곳씩', () => {
    expect(parsePastedPlaces('경포호\n안목해변\n강릉중앙시장')).toEqual(['경포호', '안목해변', '강릉중앙시장']);
  });

  it('번호·불릿·줄 안 링크를 걷어낸다', () => {
    expect(parsePastedPlaces('1. 경포호\n2) 안목해변 https://naver.me/a\n- 테라로사\n• 강문해변')).toEqual(['경포호', '안목해변', '테라로사', '강문해변']);
  });

  it('[카카오맵] 접두사와 앱이름 전용 줄 처리', () => {
    expect(parsePastedPlaces('카카오맵\n[카카오맵] 경포대\n네이버 지도')).toEqual(['경포대']);
  });

  it('대소문자 무시 중복 제거·빈 줄 무시', () => {
    expect(parsePastedPlaces('경포호\n\n경포호\n  \n안목해변')).toEqual(['경포호', '안목해변']);
  });

  it('최대 개수로 자른다', () => {
    const many = Array.from({ length: 40 }, (_, i) => `장소${i}`).join('\n');
    expect(parsePastedPlaces(many, 30)).toHaveLength(30);
  });

  it('빈 입력은 빈 배열', () => {
    expect(parsePastedPlaces('   \n\n')).toEqual([]);
  });
});

describe('공유 텍스트 정리 (자동 추가 이름·주소 줄)', () => {
  const naverShare = '[네이버 지도]\n경포호\n강원특별자치도 강릉시 운정동 256\nhttps://naver.me/x';

  it('공유 제목·본문의 줄 안 링크·[카카오맵]·앱이름 줄을 걷어낸다', () => {
    expect(sharedPlaceTerm({ text: '안목해변 https://kko.kl/xyz 추천' })).toBe('안목해변 추천');
    expect(sharedPlaceTerm({ title: '[카카오맵] 경포대' })).toBe('경포대');
    expect(sharedPlaceTerm({ title: '네이버 지도', text: '경포호\nhttps://naver.me/a' })).toBe('경포호');
  });

  it('공유 본문의 주소 줄은 장소가 아니다', () => {
    expect(sharedPlaceTerm({ text: naverShare })).toBe('경포호');
    expect(parsePastedPlace(naverShare).term).toBe('경포호');
    expect(parsePastedPlaces(naverShare)).toEqual(['경포호']);
  });

  it('주소 줄 판별: 도·시군구·번지가 모두 있어야 주소', () => {
    for (const a of ['강원 강릉시 저동 94', '서울 중구 세종대로 110', '경기 성남시 분당구 판교역로 166', '강원특별자치도 강릉시 운정동 256-1']) expect(isAddressLine(a)).toBe(true);
    for (const n of ['부산 해운대 블루라인파크', '제주 4.3평화공원', '서울숲', '광주 서구 1913송정역시장', '경기 수원시 화성행궁', '테라로사 경포호수점']) expect(isAddressLine(n)).toBe(false);
  });

  it('카카오맵 링크를 알아본다 (가져오지 않음)', () => {
    for (const u of ['https://kko.to/G5MMYHyPRX', 'https://place.map.kakao.com/8654759', 'https://map.kakao.com/?folderid=1', 'https://kakao.com/x']) expect(isKakaoLink(u)).toBe(true);
    for (const u of ['https://naver.me/abc', 'https://map.naver.com/p/entry/place/1', 'https://kakao.com.evil.net/x', 'https://kko.kl/xyz', null, 'not a url']) expect(isKakaoLink(u)).toBe(false);
  });
});


describe('clipboard Naver Map share detection', () => {
  it('링크만 복사한 것도, 휴대폰 앱이 복사한 전문(머리말·이름·링크)도 받는다', () => {
    expect(naverShareText('  https://naver.me/example\n')).toBe('https://naver.me/example');
    expect(naverShareText('[네이버지도]\n대구\nhttps://naver.me/example')).toBe('[네이버지도]\n대구\nhttps://naver.me/example');
    expect(naverShareText('[네이버 지도]\r\n 철뚝소머리집 \r\n강원 강릉시 옥천로 1\r\nhttps://naver.me/example\r\n')).toBe('[네이버 지도]\n철뚝소머리집\n강원 강릉시 옥천로 1\nhttps://naver.me/example');
    expect(naverShareText('[네이버 지도] 경포호 https://naver.me/example,')).toBe('[네이버 지도] 경포호\nhttps://naver.me/example');
  });

  it('네이버 지도 공유가 아닌 복사 내용은 받지 않는다 (다른 링크·링크 여러 개·긴 글)', () => {
    const long = `${'긴 글 '.repeat(50)}https://naver.me/x`;
    for (const text of ['https://naver.me/', 'https://map.naver.com/p/entry/place/123', 'https://example.com https://naver.me/x', '[네이버지도]\n대구\nhttps://naver.me/x\n[네이버지도]\n경남\nhttps://naver.me/y', 'http://naver.me/x', 'https://naver.me.evil.test/x', 'https://naver.me@evil.test/x', 'https://user@naver.me/x', 'https://news.naver.com', 'https://kko.to/example', '장소 이름', long, '하나\n둘\n셋\n넷\n다섯\nhttps://naver.me/x'])
      expect(naverShareText(text)).toBeNull();
  });

  it('공유 여러 개를 쉼표로 이어 붙여도 링크와 이름을 따로 읽는다', () => {
    const text = '[네이버지도]\n대구\nhttps://naver.me/aaa, [네이버지도]\n경남\nhttps://naver.me/bbb , [네이버지도]\n강릉\nhttps://naver.me/ccc';
    expect(pastedLinks(text)).toEqual(['https://naver.me/aaa', 'https://naver.me/bbb', 'https://naver.me/ccc']);
    expect(pastedLinks('https://naver.me/aaa https://naver.me/aaa')).toEqual(['https://naver.me/aaa']);
    expect(parsePastedPlaces(text)).toEqual(['대구', '경남', '강릉']);
    expect(parsePastedPlace('경포호 https://naver.me/aaa.').url).toBe('https://naver.me/aaa');
  });

  it('서버에 물어볼 수 있는 링크는 https 네이버 주소뿐', () => {
    for (const u of ['https://naver.me/aaa', 'https://map.naver.com/p/entry/place/1', 'https://m.place.naver.com/place/1/home']) expect(isNaverLink(u)).toBe(true);
    for (const u of ['http://naver.me/aaa', 'https://naver.me.evil.test/x', 'https://user@naver.me/x', 'https://notnaver.com/x', 'https://kko.to/x', 'not a url']) expect(isNaverLink(u)).toBe(false);
  });
});

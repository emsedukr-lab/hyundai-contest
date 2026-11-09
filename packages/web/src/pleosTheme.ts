import { defineTheme } from '@astryxdesign/core/theme';

/**
 * Pleos 모바일 테마 (M45) — Pleos Connect 2.1.5 공식 토큰(design/android-res)을 휴대폰 크기로 옮긴 것.
 * 차량 앱과 같은 언어: 회색 캔버스(background/primary #F7F8FA) 위 흰 컨테이너(Surface/container), 주 버튼·선택은
 * 그래파이트(button/filled #44464E, 다크 #E0E1E6), 보조 버튼은 잉크 5%(button/basic). 파랑(informative/positive)은
 * 정보에만 — 링크·텍스트 버튼(--color-text-accent)과 '고정' 태그. 스위치 켜짐은 informative/active 초록(shell.css).
 * 텍스트는 알파 잉크를 각 바탕 위 단색으로 풀어 적었다(보조 = 잉크 64% → #68696a, 흰 바탕 5.5:1).
 * 모서리: 차량 dp × 0.6 — 버튼 S 10 · M/필드 14 · 카드 16 · L 버튼 20 · 시트 24. 그림자: Pleos Level1·Level2.
 * 폰트 파일은 테마가 싣지 않으므로 Asta Sans는 src/fonts.css(@font-face, self-host)로 싣는다.
 */
export const pleosTheme = defineTheme({
  name: 'pleos',

  // 강조 = 그래파이트(주 버튼·선택), 차가운 무채색. [light, dark].
  color: { accent: ['#44464e', '#e0e1e6'], neutralStyle: 'cool', contrast: 'standard' },

  // 본문 16 기준(iOS 입력창 확대 방지). Pleos 글자 사다리(Title 24·22·20 / Body 18·17·16 / Label 14·12)는 shell.css 변수.
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: 'Asta Sans', fallbacks: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", Roboto, "Helvetica Neue", Arial, sans-serif' },
    heading: { weight: 'bold', weights: { 1: 'bold', 2: 'bold', 3: 'bold', 4: 'bold' } },
  },

  // 120 누름 · 200 토글 · 320 시트.
  motion: { fast: 120, medium: 200, slow: 320, ratio: 0.8 },

  radius: { base: 4, multiplier: 1 },

  tokens: {
    // 바탕: 회색 캔버스, 흰 컨테이너(Surface/container), 눌림·입력 바탕(basic/100), 떠 있는 면(background/popup).
    '--color-background-body': ['#f7f8fa', '#131417'],
    '--color-background-surface': ['#ffffff', '#1d1e21'],
    '--color-background-card': ['#ffffff', '#1d1e21'],
    '--color-background-muted': ['#edeef2', '#313236'],
    '--color-background-popover': ['#ffffff', '#313236'],
    // 텍스트·아이콘 사다리(주 · 보조 64% · 비활성 32%).
    '--color-text-primary': ['#131417', '#ffffff'],
    '--color-text-secondary': ['#68696a', '#aaaaab'],
    '--color-text-disabled': ['#b5b5b6', '#5a5b5c'],
    '--color-icon-primary': ['#131417', '#ffffff'],
    '--color-icon-secondary': ['#68696a', '#aaaaab'],
    // 강조 = 그래파이트, 위 글자 흰색(9.4:1) / 다크는 밝은 회색 위 잉크(14:1).
    '--color-accent': ['#44464e', '#e0e1e6'],
    '--color-on-accent': ['#ffffff', '#131417'],
    // 파랑은 정보 글자·아이콘에만(흰 바탕 4.9:1, 다크 카드 위 5.6:1).
    '--color-text-accent': ['#0064ff', '#3d96ff'],
    '--color-icon-accent': ['#0064ff', '#3d96ff'],
    // 구분선: divider/secondary 10%, divider/tertiary 20%.
    '--color-border': ['#e7e7e8', '#323336'],
    '--color-border-emphasized': ['#d0d0d1', '#48494c'],
    '--border-width': '1px',
    // 시맨틱: 오류 채움·보더 informative/negative, 글자는 대비 맞춘 값. 경고 글자는 regulation 주황을 어둡게.
    '--color-error': ['#fe3d16', '#ff4c28'],
    '--color-text-error': ['#d82e08', '#ff6a4d'],
    '--color-text-warning': ['#a35500', '#ff9f2e'],
    // 포커스 = 강조(그래파이트), Pleos field/focused와 같은 계열.
    '--focus-outline-color': 'var(--color-accent)',
    // 모서리 사다리(차량 dp × 0.6).
    '--radius-inner': '10px',
    '--radius-element': '14px',
    '--radius-container': '16px',
    '--radius-page': '24px',
    // 그림자: 바탕 위 컨테이너는 없음, 떠 있는 것 Level1, 시트·팝업 Level2.
    '--shadow-low': '0px 1px 2px 0px #1314170a',
    '--shadow-med': '0px 6px 24px 0px #00000014',
    '--shadow-high': '0px 8px 32px 0px #00000029, 0px 2px 2px 0px #00000014',
  },
});

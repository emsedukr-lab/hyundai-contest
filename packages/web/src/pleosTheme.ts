import { defineTheme } from '@astryxdesign/core/theme';

/**
 * Pleos 모바일 테마 — design/DESIGN.md(Pleos Connect 2.1.5 공식 디자인 시스템)의 토큰을 휴대폰 크기(차량 dp × 0.6)로 옮긴 것.
 * 차량 앱과 같은 규칙: 바탕 background/primary 위 컨테이너 surface/basic(다크에서는 두 색이 같아 1px divider/secondary
 * 보더가 컨테이너를 만든다 — shell.css), 주 버튼·선택은 그래파이트(button/filled #44464E, 다크 #E0E1E6), 보조 버튼은
 * 잉크 5%(button/basic). 유채색은 상태 표시에만: 스위치 켜짐·완료 = informative/active, 링크·텍스트 버튼 =
 * informative/positive(--color-text-accent), 오류 = informative/negative. '주의'는 색 없이 잉크와 굵기(경고 색 없음).
 * 텍스트는 알파 잉크를 각 바탕 위 단색으로 풀어 적었다(보조 = 잉크 64% → #68696a, 흰 바탕 5.5:1).
 * 모서리(8·12·16·20·24·32·48 × 0.6): 작은 컨트롤 10 · 중간 컨트롤·입력칸 14 · 컨테이너·큰 버튼 19 · 시트·팝업 29.
 * 그림자는 Pleos 3단계뿐이고 값은 shell.css의 --pleos-shadow-level1~3 한 곳에 있다(여기서는 그 변수를 가리킨다).
 * 굵기는 400·700만: Astryx의 medium(500)·semibold(600)를 400·700으로 돌린다. 12px(20sp × 0.6) 미만 글자는 없다.
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
    // 바탕 background/primary, 컨테이너 surface/basic, 한 단계 진한 면 surface/high, 떠 있는 면 background/popup.
    '--color-background-body': ['#f7f8fa', '#1d1e21'],
    '--color-background-surface': ['#ffffff', '#1d1e21'],
    '--color-background-card': ['#ffffff', '#1d1e21'],
    '--color-background-muted': ['#edeef2', '#313236'],
    '--color-background-popover': ['#ffffff', '#313236'],
    // 옅은 면(button/basic/enabled = controller/tab_background)과 눌림 겹침(dim/dark/primary·secondary), 뒤 가림 overlay/default.
    '--color-neutral': ['#1314170d', '#ffffff0d'],
    '--color-overlay-hover': ['#1314170d', '#ffffff0d'],
    '--color-overlay-pressed': ['#1314171a', '#ffffff1a'],
    '--color-overlay': ['#13141733', '#13141780'],
    // 텍스트·아이콘 사다리(주 · 보조 64% · 비활성 32%).
    '--color-text-primary': ['#131417', '#ffffff'],
    '--color-text-secondary': ['#68696a', '#aaaaab'],
    '--color-text-disabled': ['#b5b5b6', '#5a5b5c'],
    '--color-icon-primary': ['#131417', '#ffffff'],
    '--color-icon-secondary': ['#68696a', '#aaaaab'],
    // 강조 = 그래파이트, 위 글자 흰색(9.4:1) / 다크는 밝은 회색 위 잉크(14:1).
    '--color-accent': ['#44464e', '#e0e1e6'],
    '--color-on-accent': ['#ffffff', '#131417'],
    // informative/positive는 링크·텍스트 버튼 글자에만(흰 바탕 4.9:1, 다크는 대비를 맞춘 값 — 카드 위 5.6:1).
    '--color-text-accent': ['#0064ff', '#3d96ff'],
    '--color-icon-accent': ['#0064ff', '#3d96ff'],
    // 구분선·보더: divider/secondary 10%, divider/tertiary 20% (알파 그대로 — 어느 면 위에서도 같은 단계).
    '--color-border': ['#1314171a', '#ffffff1a'],
    '--color-border-emphasized': ['#13141733', '#ffffff33'],
    '--border-width': '1px',
    // 시맨틱: 오류 채움·보더 informative/negative, 글자는 대비 맞춘 값. 경고 색은 없다 — 주의는 잉크(굵기·점)로.
    '--color-error': ['#fe3d16', '#ff4c28'],
    '--color-text-error': ['#d82e08', '#ff6a4d'],
    '--color-text-warning': ['#131417', '#ffffff'],
    // 알림 상자(Banner) 안 글자는 상태와 무관하게 잉크 — 상태는 아이콘 색 하나로만(shell.css).
    '--color-on-info-muted': ['#131417', '#ffffff'],
    '--color-on-success-muted': ['#131417', '#ffffff'],
    '--color-on-warning-muted': ['#131417', '#ffffff'],
    '--color-on-error-muted': ['#131417', '#ffffff'],
    // 포커스 = 강조(그래파이트), Pleos field/focused와 같은 계열.
    '--focus-outline-color': 'var(--color-accent)',
    // 컨트롤 높이(M47, Pleos × 0.6): 작은 버튼 64dp → 36, 입력칸·드롭다운 small 80dp와 버튼 medium → 48, 큰 버튼 → 56.
    // Astryx 기본(28·32·36)은 손가락에 작고, 48px 시각 선택·검색창과 한 줄에 놓이면 높이가 어긋났다.
    '--size-element-sm': '36px',
    '--size-element-md': '48px',
    '--size-element-lg': '56px',
    // 모서리 사다리(차량 dp × 0.6): 16 → 10, 24 → 14, 32 → 19, 48 → 29.
    '--radius-inner': '10px',
    '--radius-element': '14px',
    '--radius-container': '19px',
    '--radius-page': '29px',
    // 그림자 3단계(값은 shell.css :root): 스위치 노브·선택된 칸·드롭다운 Level1, 시트 Level2. 컨테이너는 그림자 없이 보더.
    '--shadow-low': 'var(--pleos-shadow-level1)',
    '--shadow-med': 'var(--pleos-shadow-level1)',
    '--shadow-high': 'var(--pleos-shadow-level2)',
    // 굵기는 Regular 400 · Bold 700만.
    '--font-weight-medium': '400',
    '--font-weight-semibold': '700',
    // 가장 작은 글자 12px(Label/Small 20sp × 0.6).
    '--font-size-4xs': '0.75rem',
    '--font-size-3xs': '0.75rem',
    '--font-size-2xs': '0.75rem',
    '--font-size-xs': '0.75rem',
  },
});

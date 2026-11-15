import { defineTheme } from '@astryxdesign/core/theme';

/**
 * 토스 모바일 테마 — design/TOSS.md(토스 디자인 시스템 시각 언어, 2026-11-14 사용자 결정)의 색 역할(§2)·글꼴 사다리(§3)·
 * 모양(§4)을 Astryx 토큰으로 옮긴 것. 디자인 체계만 바꿨고 화면 배치·문구·기능은 그대로다.
 * - 회색 바탕(canvas) 위 흰 면(surface) — 카드·컨테이너는 보더·그림자 없음(shell.css). 떠 있는 면(시트·팝업·메뉴)은 surface-float.
 * - 강조는 토스 블루 하나: 주 버튼 채움·선택·포커스·스위치 켜짐·진행. 파란 글자(링크·ghost 버튼)는 대비를 맞춘 accent-text.
 *   보조 버튼은 옅은 회색 채움(fill-weak), 파괴적 확인은 negative 채움.
 * - 시맨틱 색은 뜻이 있을 때만: 빨강 오류·늦음, 초록 여유·완료, 주황 확인 필요(점·아이콘만, 글자는 잉크).
 * - 눌림은 한 단계 진하게(fill-weak-pressed, 주 버튼은 accent-pressed — shell.css가 변형별로 정함), 비활성은 전체 30%.
 * 값은 TOSS.md 표 그대로이고, 같은 값을 shell.css `:root`의 `--tn-*` 역할 변수가 한 번 더 이름 붙여 앱 CSS에 준다.
 * 그림자 다섯 개는 그 변수(--tn-shadow-*)를 가리킨다. 글꼴 파일은 테마가 싣지 않으므로 Pretendard Variable은
 * src/fonts.css(@font-face, self-host)로 싣는다. 굵기는 400·500·600·700.
 */
export const tossTheme = defineTheme({
  name: 'toss',

  // 강조 = 토스 블루(blue-500), 차가운 무채색. [light, dark].
  color: { accent: ['#3182f6', '#3485fa'], neutralStyle: 'cool', contrast: 'standard' },

  // 본문 15(body-2). 크기·줄높이는 아래 tokens에서 TOSS.md §3 사다리로 정확히 맞춘다(입력값 17은 shell.css).
  typography: {
    scale: { base: 15, ratio: 1.2 },
    body: {
      family: 'Pretendard Variable',
      fallbacks: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", Roboto, "Helvetica Neue", sans-serif',
    },
    heading: { weight: 'bold', weights: { 1: 'bold', 2: 'bold', 3: 'bold', 4: 'semibold' } },
  },

  // 120 누름 · 200 토글 · 320 시트, ease cubic-bezier(0.22, 0.61, 0.36, 1). 바운스 없음.
  motion: { fast: 120, medium: 200, slow: 320, ratio: 0.8, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },

  radius: { base: 4, multiplier: 1 },

  tokens: {
    // 바탕 canvas, 카드·컨테이너 surface, 떠 있는 면 surface-float, 옅은 면 fill-weak.
    '--color-background-body': ['#f2f4f6', '#17171c'],
    '--color-background-surface': ['#ffffff', '#202027'],
    '--color-background-card': ['#ffffff', '#202027'],
    '--color-background-muted': ['#f2f4f6', '#2c2c35'],
    '--color-background-popover': ['#ffffff', '#2c2c35'],
    '--color-background-inverted': ['#191f28', '#3c3c47'],
    // 보조 버튼 채움 = fill-weak. 눌림·hover는 불투명한 한 단계(fill-weak-pressed · fill-weak)를 면 위에 칠한다
    // (Astryx는 이 색을 배경 이미지로 겹친다) — 주 버튼·파괴적 버튼은 shell.css가 자기 눌림 색으로 바꾼다.
    '--color-neutral': ['#f2f4f6', '#2c2c35'],
    '--color-overlay-hover': ['#f2f4f6', '#2c2c35'],
    '--color-overlay-pressed': ['#e5e8eb', '#3c3c47'],
    // 시트·팝업 뒤 가림: 검정 56%.
    '--color-overlay': ['#0000008f', '#0000008f'],
    // 글자·아이콘 사다리: primary grey-900 · secondary grey-700 · disabled grey-400.
    '--color-text-primary': ['#191f28', '#ffffff'],
    '--color-text-secondary': ['#4e5968', '#c3c3c6'],
    '--color-text-disabled': ['#b0b8c1', '#62626d'],
    '--color-icon-primary': ['#191f28', '#ffffff'],
    '--color-icon-secondary': ['#4e5968', '#c3c3c6'],
    '--color-icon-disabled': ['#b0b8c1', '#62626d'],
    // 강조: 채움 accent(blue-500) 위 흰 글자 3.7:1(큰 글자 기준 — 휴대폰 주 버튼 글자는 15~17 굵게).
    '--color-accent': ['#3182f6', '#3485fa'],
    '--color-on-accent': ['#ffffff', '#ffffff'],
    '--color-accent-muted': ['#e8f3ff', '#202c4d'],
    // 파란 글자(링크·ghost 버튼·정보 태그) — 4.5:1 이상.
    '--color-text-accent': ['#1065cc', '#6aa8ff'],
    '--color-icon-accent': ['#3182f6', '#3485fa'],
    // 구분선·입력칸 보더·칩 보더 = hairline(grey-200).
    '--color-border': ['#e5e8eb', '#3c3c47'],
    '--color-border-emphasized': ['#e5e8eb', '#3c3c47'],
    '--border-width': '1px',
    // 트랙(스위치 꺼짐·진행 막대 바탕)과 자리표시 면.
    '--color-track': ['#d1d6db', '#4d4d59'],
    '--color-skeleton': ['#f2f4f6', '#2c2c35'],
    // 시맨틱: 오류 채움·보더 negative, 글자 negative-text. 완료 positive. 정보 = 강조. 확인 필요는 점·아이콘만 warning, 글자는 잉크.
    '--color-error': ['#f04452', '#f04251'],
    '--color-on-error': ['#ffffff', '#ffffff'],
    '--color-text-error': ['#d22030', '#ff6b76'],
    '--color-icon-error': ['#f04452', '#f04251'],
    '--color-border-error': ['#f04452', '#f04251'],
    '--color-text-success': ['#007738', '#3cc57a'],
    '--color-icon-success': ['#007738', '#3cc57a'],
    '--color-text-info': ['#1065cc', '#6aa8ff'],
    '--color-icon-info': ['#3182f6', '#3485fa'],
    '--color-text-warning': ['#191f28', '#ffffff'],
    '--color-icon-warning': ['#ff8800', '#ffa552'],
    '--color-border-warning': ['#ff8800', '#ffa552'],
    // 알림 상자(Banner) 안 글자는 상태와 무관하게 잉크 — 상태는 아이콘 색 하나로(shell.css).
    '--color-on-info-muted': ['#191f28', '#ffffff'],
    '--color-on-success-muted': ['#191f28', '#ffffff'],
    '--color-on-warning-muted': ['#191f28', '#ffffff'],
    '--color-on-error-muted': ['#191f28', '#ffffff'],
    // 포커스 = 강조.
    '--focus-outline-color': 'var(--color-accent)',
    // 컨트롤 높이(TOSS.md §4 휴대폰): 버튼 S 32 · 입력칸·버튼 L 48 · 버튼 XL 56(하단 고정). 버튼 M 40은 shell.css가 버튼에만.
    '--size-element-sm': '32px',
    '--size-element-md': '48px',
    '--size-element-lg': '56px',
    // 모서리 사다리: 작은 컨트롤 8 · 입력칸·버튼 M 12 · 카드·시트·대화상자 20 · 큰 섹션 24.
    '--radius-inner': '8px',
    '--radius-element': '12px',
    '--radius-container': '20px',
    '--radius-page': '24px',
    // 그림자(값은 shell.css :root): 세그먼트·노브 shadow-1, 메뉴 shadow-2, 대화상자 shadow-3.
    '--shadow-low': 'var(--tn-shadow-1)',
    '--shadow-med': 'var(--tn-shadow-2)',
    '--shadow-high': 'var(--tn-shadow-3)',
    // 굵기 400·500·600·700.
    '--font-weight-normal': '400',
    '--font-weight-medium': '500',
    '--font-weight-semibold': '600',
    '--font-weight-bold': '700',
    // 글자 사다리(TOSS.md §3 휴대폰, px → rem): caption 12 · body-3 13 · body-2 15 · body-1/title-2 17 · title-1 18 ·
    // h4 20 · h3 22 · h2 24. 가장 작은 글자 12.
    '--font-size-4xs': '0.75rem',
    '--font-size-3xs': '0.75rem',
    '--font-size-2xs': '0.75rem',
    '--font-size-xs': '0.75rem',
    '--font-size-sm': '0.8125rem',
    '--font-size-base': '0.9375rem',
    '--font-size-lg': '1.0625rem',
    '--font-size-xl': '1.25rem',
    '--font-size-2xl': '1.375rem',
    '--font-size-3xl': '1.5rem',
    // Heading 1~6, one step down the toss ladder (휴대폰은 클 필요 없음): h3 22/29/700 · h4 20/27/700 ·
    // title-1 18/26/600 · title-2 17/25/600 · label-m 15/23/600 · label-m 15/19/600.
    '--text-heading-1-size': 'var(--font-size-2xl)',
    '--text-heading-1-leading': '1.3182',
    '--text-heading-2-size': 'var(--font-size-xl)',
    '--text-heading-2-leading': '1.35',
    '--text-heading-3-size': '1.125rem',
    '--text-heading-3-leading': '1.4444',
    '--text-heading-3-weight': 'var(--font-weight-semibold)',
    '--text-heading-4-size': 'var(--font-size-lg)',
    '--text-heading-4-leading': '1.4706',
    '--text-heading-4-weight': 'var(--font-weight-semibold)',
    '--text-heading-5-size': 'var(--font-size-base)',
    '--text-heading-5-leading': '1.5333',
    '--text-heading-5-weight': 'var(--font-weight-semibold)',
    '--text-heading-6-size': 'var(--font-size-base)',
    '--text-heading-6-leading': '1.2667',
    '--text-heading-6-weight': 'var(--font-weight-semibold)',
    // 본문 body-2 15/23/400 · 보조 body-3 13/20/400 · large = title-2 17/25/600 · label = label-m 15/19/600.
    '--text-body-size': 'var(--font-size-base)',
    '--text-body-leading': '1.5333',
    '--text-supporting-size': 'var(--font-size-sm)',
    '--text-supporting-leading': '1.5385',
    '--text-large-size': 'var(--font-size-lg)',
    '--text-large-leading': '1.4706',
    '--text-large-weight': 'var(--font-weight-semibold)',
    '--text-label-size': 'var(--font-size-base)',
    '--text-label-leading': '1.2667',
    '--text-label-weight': 'var(--font-weight-semibold)',
  },
});

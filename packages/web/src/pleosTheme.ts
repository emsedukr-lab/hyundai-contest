import { defineTheme } from '@astryxdesign/core/theme';

/**
 * Pleos 모바일 테마 — Pleos Connect 디자인 시스템의 모바일 지침(TDS 형태 + Pleos 색 + Asta Sans)을 Astryx 토큰으로 옮긴 것.
 * 흰 캔버스(basic-00)와 회색 섹션(basic-50), 유일 강조색 informative-positive(#0064ff / 다크 #0082ff), 1px 헤어라인, m-radius 사다리.
 * Pleos 텍스트·보더 토큰은 알파 잉크라 각 바탕 위의 단색으로 풀어 적었다(예: 2차 텍스트 = 잉크 64% → #68696a, 흰 바탕 5.5:1).
 * 빨강 '글자'는 Pleos 지침상 4.5:1에 못 미쳐 Astryx 대비 생성기에 맡기고, 채움·보더용 --color-error만 Pleos 값으로 둔다.
 * 폰트 파일은 테마가 싣지 않으므로 Asta Sans는 src/fonts.css(@font-face, self-host)로 싣는다.
 */
export const pleosTheme = defineTheme({
  name: 'pleos',

  // 강조 hue 하나 + 차가운 무채색. [light, dark].
  color: { accent: ['#0064ff', '#0082ff'], neutralStyle: 'cool', contrast: 'standard' },

  // 본문 16 기준(iOS 입력창 확대 방지), Pleos 모바일 타입 사다리는 화면에서 직접 지정.
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: 'Asta Sans', fallbacks: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", Roboto, "Helvetica Neue", Arial, sans-serif' },
    heading: { weight: 'bold', weights: { 1: 'bold', 2: 'bold', 3: 'bold', 4: 'bold' } },
  },

  // Pleos/TDS 모션: 120 누름 · 200 토글 · 320 시트.
  motion: { fast: 120, medium: 200, slow: 320, ratio: 0.8 },

  radius: { base: 4, multiplier: 1 },

  tokens: {
    // 바탕: 흰 캔버스, 회색 섹션 카드(basic-50), 떠 있는 면(popup).
    '--color-background-body': ['#ffffff', '#131417'],
    '--color-background-surface': ['#ffffff', '#131417'],
    '--color-background-card': ['#f7f8fa', '#1d1e21'],
    '--color-background-muted': ['#edeef2', '#313236'],
    '--color-background-popover': ['#ffffff', '#313236'],
    // 텍스트·아이콘 사다리.
    '--color-text-primary': ['#131417', '#ffffff'],
    '--color-text-secondary': ['#68696a', '#aaaaab'],
    '--color-text-disabled': ['#b5b5b6', '#5a5b5c'],
    '--color-icon-primary': ['#131417', '#ffffff'],
    '--color-icon-secondary': ['#68696a', '#aaaaab'],
    // 강조색과 그 위 라벨(다크 블루 위 흰 글자는 3.7:1이라 다크에선 잉크).
    '--color-accent': ['#0064ff', '#0082ff'],
    '--color-text-accent': ['#0064ff', '#0082ff'],
    '--color-icon-accent': ['#0064ff', '#0082ff'],
    '--color-on-accent': ['#ffffff', '#131417'],
    // 1px 헤어라인(divider-secondary 10%), 강조 보더(divider-tertiary 20%).
    '--color-border': ['#e7e7e8', '#2b2c2e'],
    '--color-border-emphasized': ['#d0d0d1', '#424345'],
    '--border-width': '1px',
    // 시맨틱 빨강(채움·보더).
    '--color-error': ['#fe3d16', '#ff4c28'],
    // 포커스는 강조색.
    '--focus-outline-color': 'var(--color-accent)',
    // m-radius: 필드·M 버튼 12 · L 버튼 14 · 다이얼로그·시트 20 · 큰 카드 24.
    '--radius-inner': '12px',
    '--radius-element': '14px',
    '--radius-container': '20px',
    '--radius-page': '24px',
    // 평면 기본, 떠 있을 때만 m-shadow.
    '--shadow-low': '0px 1px 2px 0px #1314170a, 0px 1px 1px 0px #1314170a',
    '--shadow-med': '0px 4px 12px 0px #1314170f, 0px 1px 2px 0px #1314170a',
    '--shadow-high': '0px 12px 32px 0px #1314171a, 0px 2px 6px 0px #1314170f',
  },
});

import { defineTheme } from '@astryxdesign/core/theme';

/**
 * 토스(Toss) 디자인 테마 — Toss Design System(TDS) 스펙을 Astryx 토큰으로 옮긴 것.
 * cool-blue 무채색 캔버스 + 유일 강조색 Toss Blue(#3182F6), 공격적 라운드, 평면+헤어라인 보더, Pretendard.
 * 폰트 파일은 테마가 로드하지 않으므로 Pretendard는 src/fonts.css(@font-face, self-host)로 싣는다.
 */
export const tossTheme = defineTheme({
  name: 'toss',

  // Toss Blue 단일 강조 hue + cool 중성색(토스 grey는 차가운 blue-tinted). [light, dark].
  color: { accent: ['#3182F6', '#3485FA'], neutralStyle: 'cool', contrast: 'standard' },

  // Pretendard(= Toss Product Sans의 공개 대체). 파일은 fonts.css에서 로드, 없으면 시스템 한글 폰트로 폴백.
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: 'Pretendard Variable', fallbacks: 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", Roboto, "Helvetica Neue", Arial, sans-serif' },
    heading: { weight: 'bold', weights: { 1: 'bold', 2: 'bold', 3: 'bold', 4: 'bold' } },
  },

  // 토스 모션: 짧고 스냅. 120 / 200 / 320ms.
  motion: { fast: 120, medium: 200, slow: 320, ratio: 0.8 },

  radius: { base: 4, multiplier: 1 },

  tokens: {
    // 표면: 회색 바탕 위 흰 카드 (라이트), 차가운 다크.
    '--color-background-body': ['#F2F4F6', '#141417'],
    '--color-background-surface': ['#FFFFFF', '#1C1C22'],
    '--color-background-card': ['#FFFFFF', '#1C1C22'],
    '--color-background-popover': ['#FFFFFF', '#26262E'],
    // 강조색과 그 위 라벨.
    '--color-accent': ['#3182F6', '#3485FA'],
    '--color-on-accent': '#FFFFFF',
    // 1px 헤어라인 보더.
    '--color-border': ['#E5E8EB', '#2E2E36'],
    '--border-width': '1px',
    // 시맨틱: 에러는 토스 red-500.
    '--color-error': ['#F04452', '#F04251'],
    // 포커스는 강조색.
    '--focus-outline-color': 'var(--color-accent)',
    // 공격적 라운드: 입력/버튼·카드·페이지.
    '--radius-inner': '8px',
    '--radius-element': '14px',
    '--radius-container': '18px',
    '--radius-page': '24px',
    // 평면 기본 + navy 알파의 미세한 그림자(floating/modal에만 쓰임).
    '--shadow-low': '0 1px 2px rgba(25,31,40,0.04), 0 1px 1px rgba(25,31,40,0.04)',
    '--shadow-med': '0 4px 12px rgba(25,31,40,0.06), 0 1px 2px rgba(25,31,40,0.04)',
    '--shadow-high': '0 12px 32px rgba(25,31,40,0.10), 0 2px 6px rgba(25,31,40,0.06)',
  },
});

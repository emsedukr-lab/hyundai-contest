import { expect, it, vi } from 'vitest';
import { placeRegion, tripPeriodLabel } from './format';

vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));

it.each([
  ['인천 강화군 강화읍 향나무길5번길 12', '강화읍'],
  ['인천 강화군 길상면 초지리 123', '길상면'],
  ['인천 강화군 초지리 123', '초지리'],
  ['서울특별시 강남구 역삼1동 12-3', '역삼1동'],
  ['서울특별시 중구 세종대로 110 아파트 A동', '중구'],
  ['', ''],
  ['London Westminster', 'London Westminster'],
])('shows a useful area for %s', (address, expected) => {
  expect(placeRegion(address)).toBe(expected);
});

it('shows weekdays and duration together, including a same-day trip', () => {
  expect(tripPeriodLabel('2026-11-17', '2026-11-20')).toBe('11.17.(화)–11.20.(금) · 3박 4일');
  expect(tripPeriodLabel('2026-11-15', '2026-11-15')).toBe('11.15.(일)–11.15.(일) · 0박 1일');
});

import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Trip } from '@tteonaljido/shared';
import { addPlace, emptyPlan, removePlace } from '../lib/trips';
import { byName } from './PlaceSearch';
import { PlaceCollector } from './sheets/PlaceSheet';

vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
vi.mock('../lib/kakaoSdk', () => ({ JS_KEY: 'test' }));
vi.mock('./CollectedPlacesMap', () => ({ CollectedPlacesMap: () => createElement('div', { role: 'region', 'aria-label': '담은 장소 지도' }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
const open = vi.fn();
function Collector() {
  const [plan, setPlan] = useState<Trip>(() => {
    let plan = addPlace(emptyPlan(), { ...byName('조양방직'), category: 'CAFE', address: '인천 강화군 강화읍 향나무길5번길 12' });
    plan = addPlace(plan, { ...byName('숙소'), category: 'LODGING', address: '인천 강화군 초지리 123' });
    return { ...plan, places: [...plan.places, { ...byName('출발지'), placeRef: 'origin-only' }], origin: { kind: 'PLACE' as const, placeRef: 'origin-only' } };
  });
  return createElement(PlaceCollector, { plan, onChange: setPlan, onOpenPlace: open, onNotice: vi.fn(), onRemovePlace: (ref) => setPlan(removePlace(plan, ref)) });
}
it('puts search before import, shows regions and counts, and removes with a quiet accessible icon', async () => {
  render(createElement(Collector));
  await screen.findByRole('region', { name: '담은 장소 지도' });
  const search = screen.getByRole('search');
  const paste = screen.getByRole('button', { name: '네이버 지도 저장목록' });
  expect(screen.queryByRole('button', { name: '지도 선택' })).toBeNull();
  expect(search.compareDocumentPosition(paste) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('heading', { name: '담은 장소 (2곳)' })).toBeTruthy();
  expect(screen.getByText('카페·디저트 · 강화읍')).toBeTruthy();
  expect(screen.getByText('숙소 · 초지리')).toBeTruthy();
  expect(screen.queryByText(/날짜 정하기 전/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '조양방직 삭제' }));
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '담은 장소 (1곳)' })).toBeTruthy();
});
it('shows the map above the saved list without view tabs and keeps search available', async () => {
  render(createElement(Collector));
  const map = await screen.findByRole('region', { name: '담은 장소 지도' });
  const place = screen.getByText('조양방직');
  expect(map.compareDocumentPosition(place) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('radio', { name: '지도' })).toBeNull();
  expect(screen.queryByRole('radio', { name: '목록' })).toBeNull();
  const search = screen.getByRole('textbox', { name: '장소 검색' });
  fireEvent.change(search, { target: { value: '다음 맛집' } });
  expect((screen.getByRole('textbox', { name: '장소 검색' }) as HTMLInputElement).value).toBe('다음 맛집');
  expect(screen.getByRole('button', { name: '네이버 지도 저장목록' })).toBeTruthy();
  expect(screen.getByText('조양방직')).toBeTruthy();
});

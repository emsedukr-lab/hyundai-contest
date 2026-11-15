import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StartPlacePage } from './StartPlacePage';
import { presetLabel, presetPlace, presetSlots, setPresetPlace } from '../lib/settings';
import type { NewPlace } from '../editor/PlaceSearch';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { navigate: vi.fn() };
});
vi.mock('../lib/router', () => ({ navigate: mocks.navigate }));
vi.mock('../editor/PlaceSearch', () => ({ PlaceSearch: ({ onPick }: { onPick: (p: NewPlace) => void }) => createElement('button', { onClick: () => onPick({ name: '서울역', address: '서울 중구 한강대로 405', latE7: 375550000, lonE7: 1269700000, category: 'OTHER', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } }) }, '검색 결과 선택') }));
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it('saves the custom name and selected address together only after Save', () => {
  render(createElement(StartPlacePage, { slot: 'new' }));
  fireEvent.change(screen.getByRole('textbox', { name: '장소 이름' }), { target: { value: '본가' } });
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 선택' }));
  expect(presetSlots()).toEqual(['home', 'work']);
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const id = presetSlots()[2];
  expect(presetLabel(id)).toBe('본가');
  expect(presetPlace(id)?.address).toBe('서울 중구 한강대로 405');
  expect(mocks.navigate).toHaveBeenCalledWith('/settings');
});
it('preserves the registered place when saving an edit fails', () => {
  setPresetPlace('fav1', { name: '기존 장소', address: '서울', latE7: 375550000, lonE7: 1269700000 });
  render(createElement(StartPlacePage, { slot: 'fav1' }));
  fireEvent.change(screen.getByRole('textbox', { name: '장소 이름' }), { target: { value: '새 이름' } });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(presetLabel('fav1')).toBe('기존 장소');
  expect(screen.getByText('장소를 저장하지 못했어요. 다시 시도해 주세요')).toBeTruthy();
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it('removes a registered custom place without leaving an empty slot', () => {
  setPresetPlace('fav1', { name: '기존 장소', address: '서울', latE7: 375550000, lonE7: 1269700000 });
  render(createElement(StartPlacePage, { slot: 'fav1' }));
  fireEvent.click(screen.getByRole('button', { name: '장소 삭제' }));
  expect(presetSlots()).toEqual(['home', 'work']);
  expect(mocks.navigate).toHaveBeenCalledWith('/settings');
});

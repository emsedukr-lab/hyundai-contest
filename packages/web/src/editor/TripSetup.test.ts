import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TripSetup } from './TripSetup';
import { emptyPlan, type SetupStep } from '../lib/trips';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { clipboard: vi.fn(), readPaste: vi.fn(), changed: vi.fn() };
});
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
vi.mock('../lib/kakaoSdk', () => ({ JS_KEY: null }));
vi.mock('../lib/pasteImport', async (original) => ({ ...await original<typeof import('../lib/pasteImport')>(), readPaste: mocks.readPaste }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { readText: mocks.clipboard }, configurable: true });
  mocks.readPaste.mockResolvedValue({ kind: 'list', list: { kind: 'list', source: 'naver', title: '공유 목록', total: 2,
    places: ['바다', '호텔'].map((name, i) => ({ name, address: `주소${i}`, latE7: 375000000 + i * 10000, lonE7: 1270000000, category: 'OTHER' })),
  } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Setup() {
  const [step, onStep] = useState<SetupStep>(1);
  const [plan, setPlan] = useState(emptyPlan);
  return createElement(TripSetup, { plan, home: null, step, onStep,
    onChange: (next) => { mocks.changed(next); setPlan(next); },
    onOpenPlace: vi.fn(), onNotice: vi.fn(), onOpenSettings: vi.fn(), onFinish: vi.fn(),
  });
}

it('asks before resolving the clipboard URL and adds only the checked places after consent', async () => {
  mocks.clipboard.mockResolvedValue('[네이버 지도]\n강릉\nhttps://naver.me/example');
  render(createElement(Setup));
  expect(screen.getByRole('heading', { name: '장소 담기' })).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: '여행명' }), { target: { value: '제주 가족 여행' } });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('heading', { name: '복사한 네이버 지도 링크를 불러올까요?' });
  expect(mocks.readPaste).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '불러오기' }));
  await screen.findByRole('checkbox', { name: /바다/ });
  expect(mocks.readPaste).toHaveBeenCalledExactlyOnceWith('https://naver.me/example');
  fireEvent.click(screen.getByRole('checkbox', { name: /호텔/ }));
  fireEvent.click(screen.getByRole('button', { name: '1곳 담기' }));
  expect(mocks.changed.mock.lastCall?.[0].places.map((p: { name: string }) => p.name)).toEqual(['바다']);
  fireEvent.click(screen.getByRole('button', { name: '1곳 담기 완료 · 다음' }));
  await screen.findByRole('heading', { name: '숙소·예약' });
  expect(screen.getByText('새 여행 · 2/3')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '이전' }));
  expect((screen.getByRole('textbox', { name: '여행명' }) as HTMLInputElement).value).toBe('제주 가족 여행');
  expect(screen.getByRole('heading', { name: '장소 담기' })).toBeTruthy();
});
it('does not read the shared list when the offer is declined', async () => {
  mocks.clipboard.mockResolvedValue('https://naver.me/example');
  render(createElement(Setup));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(await screen.findByRole('button', { name: '나중에' }));
  expect(mocks.readPaste).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '장소 담기' })).toBeTruthy();
});
it.each(['', '메모만 있는 클립보드', 'https://example.com', 'https://naver.me.evil.test/x'])('continues without an offer for unrelated clipboard text: %s', async (text) => {
  mocks.clipboard.mockResolvedValue(text);
  render(createElement(Setup));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: '복사한 네이버 지도 링크를 불러올까요?' })).toBeNull();
  expect(mocks.readPaste).not.toHaveBeenCalled();
});
it('keeps manual collection available when clipboard access is denied', async () => {
  mocks.clipboard.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  render(createElement(Setup));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: '장소 담기' })).toBeTruthy();
  expect(mocks.readPaste).not.toHaveBeenCalled();
});

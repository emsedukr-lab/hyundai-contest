import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { departure } from '@tteonaljido/shared';
import { TripInfoPanel } from './TripInfoPanel';
import { emptyPlan, endpointFromPreset, setPeriod } from '../lib/trips';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { changed: vi.fn(), search: vi.fn() };
});
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
vi.mock('../lib/pairing', async (original) => ({ ...await original<typeof import('../lib/pairing')>(), searchPlaces: mocks.search }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Basics() {
  const [plan, setPlan] = useState(() => endpointFromPreset(setPeriod(emptyPlan(), '2026-11-17', '2026-11-20'), 'finalDestination', { name: '공항', address: '인천', latE7: 374600000, lonE7: 1264400000 }));
  return createElement(TripInfoPanel, { plan, home: null, section: 'basics', onChange: (next) => { mocks.changed(next); setPlan(next); }, onOpenSettings: vi.fn() });
}
it('labels the period with weekdays and duration, and clears an editable trip name', () => {
  render(createElement(Basics));
  expect(screen.getByText('여행 기간', { selector: 'label' })).toBeTruthy();
  expect(screen.getByText('11.17.(화)–11.20.(금) · 3박 4일')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '여행명 지우기' }));
  expect((screen.getByRole('textbox', { name: '여행명' }) as HTMLInputElement).value).toBe('');
});
it('searches within the endpoint sheet and copies the chosen start into the destination', async () => {
  mocks.search.mockResolvedValue([{ name: '서울역', address: '서울 중구', latE7: 375550000, lonE7: 1269700000, category: 'OTHER', externalId: 'station' }]);
  render(createElement(Basics));
  expect(screen.getByRole('button', { name: '출발지와 동일' }).getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByText('출발지를 지정하면 같은 장소로 설정할 수 있어요')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '출발지 · 출발 당일 현위치' }));
  expect(screen.getByRole('button', { name: '출발 당일 현위치' })).toBeTruthy();
  const input = screen.getByRole('textbox', { name: '주소·장소 검색' });
  fireEvent.change(input, { target: { value: '서울역' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(await screen.findByText('서울역', { exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: '출발지 · 서울역' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '출발지와 동일' }));
  const plan = mocks.changed.mock.lastCall![0];
  expect(plan.finalDestination).toEqual(plan.origin);
  expect(screen.getByRole('button', { name: '출발지와 동일 · 적용됨' })).toBeTruthy();
  expect(plan.places.map((p: { name: string }) => p.name)).toEqual(['서울역']);
  expect(plan.visits).toHaveLength(0);
});
it('sets and clears last-day arrival using the undecided action', () => {
  render(createElement(Basics));
  fireEvent.click(screen.getByRole('button', { name: '마지막 날 도착 시간' }));
  fireEvent.click(screen.getByRole('button', { name: '오후 6:00' }));
  expect(mocks.changed.mock.lastCall![0].days.at(-1).endBy).toBe('18:00');
  fireEvent.click(screen.getByRole('button', { name: '마지막 날 도착 시간 · 18:00' }));
  fireEvent.click(screen.getByRole('button', { name: '미정' }));
  expect(mocks.changed.mock.lastCall![0].days.at(-1).endBy).toBeNull();
});
it('uses the chosen first departure time in the actual timeline calculation', async () => {
  render(createElement(Basics));
  fireEvent.click(screen.getByRole('button', { name: '첫날 출발 시간 · 09:00' }));
  fireEvent.click(screen.getByRole('radio', { name: '오후' }));
  fireEvent.click(screen.getByRole('button', { name: '오후 6:00' }));
  expect(departure(mocks.changed.mock.lastCall![0], 1)).toBe(18 * 60);
});

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlacesPage } from './PlacesPage';
import { trips } from '../lib/db';
import { emptyPlan, newDoc } from '../lib/trips';
import type { NewPlace } from '../editor/PlaceSearch';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { all: vi.fn(), get: vi.fn(), put: vi.fn() };
});
vi.mock('../lib/db', () => ({ trips: mocks, favorites: { all: async () => [] } }));
vi.mock('../lib/pasteImport', () => ({
  takeHandOff: () => null,
  readPaste: async () => ({ kind: 'list', list: { title: '네이버 목록', places: [], total: 0, kind: 'list', source: 'naver' } }),
}));
vi.mock('../editor/BulkAddDialog', () => ({
  BulkAddDialog: ({ onAdd, onClose }: { onAdd: (p: NewPlace[]) => void; onClose: () => void }) => createElement('button', {
    onClick: () => {
      onAdd([{ name: '가져온 장소', address: '', category: 'OTHER', latE7: null, lonE7: null, source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } }]);
      onClose();
    },
  }, '선택한 장소 담기'),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('creates a named trip from pasted places even when an existing trip is available', async () => {
  const old = await newDoc({ ...emptyPlan(), name: '기존 여행' });
  mocks.all.mockResolvedValue([old]);
  render(createElement(PlacesPage));
  fireEvent.click(await screen.findByRole('combobox', { name: '담을 여행' }));
  fireEvent.click(await screen.findByRole('option', { name: '새 여행 만들기' }));
  fireEvent.change(screen.getByRole('textbox', { name: '여행명' }), { target: { value: '  제주 가족 여행  ' } });
  fireEvent.change(screen.getByRole('textbox', { name: '네이버 지도에서 복사한 내용' }), { target: { value: 'https://naver.me/list' } });
  fireEvent.click(screen.getByRole('button', { name: '여행에 담기' }));
  fireEvent.click(await screen.findByRole('button', { name: '선택한 장소 담기' }));
  await waitFor(() => expect(trips.put).toHaveBeenCalled());
  const saved = mocks.put.mock.calls[0][0];
  expect(saved.tripId).not.toBe(old.tripId);
  expect(saved.plan.name).toBe('제주 가족 여행');
  expect(saved.plan.places.map((p: { name: string }) => p.name)).toEqual(['가져온 장소']);
  expect(old.plan.places).toHaveLength(0);
});

it('adds to the selected existing trip without changing its name', async () => {
  const old = await newDoc({ ...emptyPlan(), name: '기존 여행' });
  mocks.all.mockResolvedValue([old]);
  mocks.get.mockResolvedValue(old);
  render(createElement(PlacesPage));
  await waitFor(() => expect(screen.getByRole('combobox', { name: '담을 여행' }).textContent).toContain('기존 여행'));
  expect(screen.queryByRole('textbox', { name: '여행명' })).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '네이버 지도에서 복사한 내용' }), { target: { value: 'https://naver.me/list' } });
  fireEvent.click(screen.getByRole('button', { name: '여행에 담기' }));
  fireEvent.click(await screen.findByRole('button', { name: '선택한 장소 담기' }));
  await waitFor(() => expect(trips.put).toHaveBeenCalled());
  expect(mocks.put.mock.calls[0][0]).toMatchObject({ tripId: old.tripId, plan: { name: '기존 여행', places: [{ name: '가져온 장소' }] } });
});

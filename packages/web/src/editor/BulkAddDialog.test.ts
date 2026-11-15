import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { BulkAddDialog } from './BulkAddDialog';
import type { ResolvedList } from '../lib/pairing';

vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));
vi.mock('../lib/kakaoSdk', () => ({ JS_KEY: null }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

const list: ResolvedList = {
  kind: 'list', source: 'naver', title: '여행 목록', total: 3,
  places: ['바다', '카페', '호텔'].map((name, i) => ({ name, address: `주소 ${i}`, latE7: 370000000 + i * 10000, lonE7: 1270000000, category: 'OTHER' })),
};

it('selects all, clears all and adds only the individually checked places', async () => {
  const onAdd = vi.fn();
  render(createElement(BulkAddDialog, { isOpen: true, list, lodgingOnly: false, onClose: vi.fn(), onAdd }));
  await waitFor(() => expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(3));
  fireEvent.click(screen.getByRole('button', { name: '전체 해제' }));
  expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '전체 선택' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /카페/ }));
  fireEvent.click(screen.getByRole('button', { name: '2곳 담기' }));
  expect(onAdd.mock.calls[0][0].map((p: { name: string }) => p.name)).toEqual(['바다', '호텔']);
});

it('prevents adding more than the available room after selecting all', async () => {
  const onAdd = vi.fn();
  render(createElement(BulkAddDialog, { isOpen: true, list, room: 1, lodgingOnly: false, onClose: vi.fn(), onAdd }));
  await waitFor(() => expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: '전체 선택' }));
  const add = screen.getByRole('button', { name: '3곳 담기' });
  expect(add.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(add);
  expect(onAdd).not.toHaveBeenCalled();
});

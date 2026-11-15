import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlaceSearch } from './PlaceSearch';
import type { PlaceHit } from '../lib/pairing';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { search: vi.fn(), notice: vi.fn(), readPaste: vi.fn() };
});
vi.mock('../lib/pasteImport', () => ({ readPaste: mocks.readPaste }));
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
vi.mock('../lib/pairing', async (original) => ({ ...await original<typeof import('../lib/pairing')>(), searchPlaces: mocks.search }));
vi.mock('../components/ToastNotice', () => ({ ToastNotice: (props: unknown) => { mocks.notice(props); return null; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const hit = (name: string): PlaceHit => ({ name, address: '강릉', latE7: 377000000, lonE7: 1289000000, category: 'SIGHT', externalId: name });
function search(term: string) {
  const input = screen.getByRole('textbox', { name: '장소 검색' });
  fireEvent.change(input, { target: { value: term } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
}

it.each(['typing', 'clear button'])('removes the search results when cleared by %s', async (method) => {
  mocks.search.mockResolvedValue([hit('경포호')]);
  render(createElement(PlaceSearch, { compact: true, onPick: vi.fn() }));
  const input = search('경포');
  await screen.findByText('경포호', { exact: true });
  if (method === 'typing') fireEvent.change(input, { target: { value: '' } });
  else fireEvent.click(screen.getByRole('button', { name: /clear|지우기|삭제/i }));
  expect((input as HTMLInputElement).value).toBe('');
  expect(screen.queryByText('경포호', { exact: true })).toBeNull();
});

it.each(['success', 'failure'])('ignores a late %s after the search is cleared', async (result) => {
  let resolve!: (hits: PlaceHit[]) => void, reject!: (e: Error) => void;
  mocks.search.mockReturnValue(new Promise<PlaceHit[]>((yes, no) => { resolve = yes; reject = no; }));
  render(createElement(PlaceSearch, { compact: true, onPick: vi.fn() }));
  fireEvent.change(search('경포'), { target: { value: '' } });
  await act(async () => { if (result === 'success') resolve([hit('경포호')]); else reject(new Error('offline')); });
  expect(screen.queryByText('경포호', { exact: true })).toBeNull();
  expect(mocks.notice).not.toHaveBeenCalled();
});

it('keeps newer results when an older request finishes last', async () => {
  let old!: (hits: PlaceHit[]) => void;
  mocks.search.mockReturnValueOnce(new Promise<PlaceHit[]>((resolve) => { old = resolve; })).mockResolvedValueOnce([hit('서울역')]);
  render(createElement(PlaceSearch, { compact: true, onPick: vi.fn() }));
  search('경포');
  search('서울');
  await screen.findByText('서울역', { exact: true });
  await act(async () => old([hit('경포호')]));
  expect(screen.getByText('서울역', { exact: true })).toBeTruthy();
  expect(screen.queryByText('경포호', { exact: true })).toBeNull();
});

it.each(['장소 이름', 'https://map.naver.com/p/entry/place/1', 'https://naver.me.evil.test/x'])('does not import or search unrelated clipboard content: %s', async (text) => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => text } });
  render(createElement(PlaceSearch, { onPickMany: vi.fn(), onPick: vi.fn() }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '네이버 지도 저장목록' })));
  expect(mocks.readPaste).not.toHaveBeenCalled();
  expect(mocks.search).not.toHaveBeenCalled();
  expect(mocks.notice).toHaveBeenCalledWith(expect.objectContaining({ title: 'https://naver.me/로 시작하는 네이버 지도 링크를 복사해 주세요' }));
});

it('imports a copied Naver short link', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => ' https://naver.me/example ' } });
  mocks.readPaste.mockResolvedValue({ kind: 'empty' });
  render(createElement(PlaceSearch, { onPickMany: vi.fn(), onPick: vi.fn() }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '네이버 지도 저장목록' })));
  expect(mocks.readPaste).toHaveBeenCalledExactlyOnceWith('https://naver.me/example');
});

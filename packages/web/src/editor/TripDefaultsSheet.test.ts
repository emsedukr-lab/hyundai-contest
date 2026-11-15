import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { tripDefaults } from '../lib/settings';
import { TripDefaultsSheet } from './TripDefaultsSheet';

vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const chooseTime = () => {
  fireEvent.click(screen.getByRole('button', { name: '첫날 출발 시간 · 09:00' }));
  fireEvent.click(screen.getByRole('radio', { name: '오후' }));
  fireEvent.click(screen.getByRole('button', { name: '오후 6:00' }));
};

it('keeps edits as a draft until save and cancels without changing defaults', () => {
  const closed = vi.fn();
  render(createElement(TripDefaultsSheet, { onClose: closed, onSaved: vi.fn() }));
  chooseTime();
  expect(tripDefaults()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(closed).toHaveBeenCalledOnce();
  expect(tripDefaults()).toBeNull();
});

it('saves the edited time and reports a storage failure without closing', () => {
  const saved = vi.fn();
  render(createElement(TripDefaultsSheet, { onClose: vi.fn(), onSaved: saved }));
  chooseTime();
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByText('설정을 저장하지 못했어요. 다시 시도해 주세요')).toBeTruthy();
  failure.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(saved).toHaveBeenCalledOnce();
  expect(tripDefaults()?.firstDay).toEqual({ basis: 'DEPART_ORIGIN', departTime: '18:00' });
});

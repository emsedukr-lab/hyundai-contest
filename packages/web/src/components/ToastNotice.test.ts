import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastNotice } from './ToastNotice';
import type { ToastOptions } from '@astryxdesign/core/Toast';
import { UndoSnackbar } from './UndoSnackbar';

const show = vi.hoisted(() => vi.fn((_options: ToastOptions) => vi.fn()));
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => show }));
afterEach(() => { cleanup(); show.mockClear(); });

it('does not restart a notification when its parent renders with a new callback', () => {
  const first = vi.fn(), latest = vi.fn();
  const view = render(createElement(ToastNotice, { status: 'success', title: '저장 완료', onDismiss: first }));
  const hidden = () => show.mock.calls[0][0].onHide?.('auto');
  view.rerender(createElement(ToastNotice, { status: 'success', title: '저장 완료', onDismiss: latest }));
  expect(show).toHaveBeenCalledOnce();
  hidden();
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});

it('does not clear a replacement message when an older toast finishes closing', () => {
  const old = vi.fn(), current = vi.fn();
  const view = render(createElement(ToastNotice, { status: 'info', title: '첫 알림', onDismiss: old }));
  const options = show.mock.calls[0][0];
  const dismiss = show.mock.results[0].value;
  view.rerender(createElement(ToastNotice, { status: 'error', title: '새 알림', onDismiss: current }));
  expect(dismiss).toHaveBeenCalledOnce();
  options.onHide?.('manual');
  expect(old).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();
});

it('keeps the undo action and dismiss callback usable in the shared toast', () => {
  const undo = vi.fn(), close = vi.fn();
  render(createElement(UndoSnackbar, { text: '삭제 완료', onUndo: undo, onClose: close }));
  const options = show.mock.calls[0][0];
  render(options.renderContent!({ body: options.body, endContent: options.endContent, type: 'info', isAutoHide: true,
    autoHideDuration: 8000, dismiss: () => options.onHide?.('manual') }));
  fireEvent.click(screen.getByRole('button', { name: /^(Undo|되돌리기)$/ }));
  expect(undo).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: /^삭제 완료 ·/ }));
  expect(close).toHaveBeenCalledOnce();
});

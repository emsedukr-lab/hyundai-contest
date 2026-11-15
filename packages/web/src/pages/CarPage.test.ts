import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { sendIntent } from '../lib/sendIntent';
import { CarPage } from './CarPage';

vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));
vi.mock('../lib/db', () => ({
  sendLog: { recent: async () => [{ tripId: 'trip-1', revision: 1, at: Date.now() }] },
  trips: { all: async () => [{ tripId: 'trip-1', plan: { name: '강릉 여행' } }] },
}));
vi.mock('../components/QrScanner', () => ({ QrScanner: ({ tripName, onClose }: { tripName?: string; onClose: () => void }) => createElement('button', { onClick: onClose }, `scanner:${tripName ?? 'none'}`) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });

it('puts the guide before scanning and starts a new general scan without an old trip choice', async () => {
  sendIntent.set('old-trip');
  render(createElement(CarPage));
  const guide = screen.getByText('연결 및 전송 방법');
  const scan = screen.getByRole('button', { name: '차량 QR 코드 스캔' });
  expect(guide.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(scan);
  await screen.findByText('scanner:none');
  expect(sendIntent.get()).toBeNull();
});

it('resends a recent itinerary through a fresh scan with its name and id selected', async () => {
  render(createElement(CarPage));
  fireEvent.click(await screen.findByRole('button', { name: /강릉 여행.*다시 보내기/ }));
  await screen.findByText('scanner:강릉 여행');
  expect(sendIntent.get()).toBe('trip-1');
});

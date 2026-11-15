import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import bundled from '../data/gangneung-example.json';
import type { TripDoc } from '../lib/trips';
import { HomePage } from './HomePage';

const mocks = vi.hoisted(() => {
  Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
  return { docs: [] as unknown[], ensure: vi.fn().mockResolvedValue(undefined) };
});
vi.mock('../lib/db', () => ({ trips: { all: async () => mocks.docs }, sendLog: { recent: async () => [] }, TRIPS_CHANGED: 'trips-changed', trash: {} }));
vi.mock('../lib/exampleTrip', () => ({ ensureExampleTrip: mocks.ensure, EXAMPLE_TRIP_ID: '2071798a-c1b2-4b04-85e8-83c50daf8380' }));
beforeEach(() => { mocks.docs = []; vi.clearAllMocks(); });
afterEach(cleanup);

it('shows the public example immediately on a fresh home screen', async () => {
  mocks.docs = [structuredClone(bundled)]; render(createElement(HomePage));
  await screen.findByText('예시');
  expect(document.querySelector('.tn-next-name')?.textContent).toBe('강릉 3박 4일');
  expect(mocks.ensure).toHaveBeenCalledOnce();
});

it('keeps personal trips first and excludes the example from date-conflict warnings', async () => {
  const example = structuredClone(bundled) as TripDoc;
  const personalId = crypto.randomUUID();
  const personal = { ...example, tripId: personalId, plan: { ...example.plan, tripId: personalId, name: '내 여행' } };
  mocks.docs = [example, personal]; render(createElement(HomePage));
  await screen.findByText('내 여행');
  expect(document.querySelector('.tn-next-name')?.textContent).toBe('내 여행');
  expect(screen.queryByText(/날짜 겹침/)).toBeNull();
  expect(screen.getByText('예시')).toBeTruthy();
});

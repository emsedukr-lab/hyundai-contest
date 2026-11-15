import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { sampleTrip, type Trip } from '@tteonaljido/shared';
import { TripSetup } from './TripSetup';

/** The 예약·꼭 갈 곳 cards of the new-trip steps: a booking is added with a text button, and what it implies shows. */
vi.hoisted(() => Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true }));
vi.mock('../lib/db', () => ({ favorites: { all: async () => [] } }));
vi.mock('../lib/kakaoSdk', () => ({ JS_KEY: null }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(cleanup);

let latest: Trip;
function Step3() {
  const [plan, setPlan] = useState<Trip>(sampleTrip);
  latest = plan;
  return createElement(TripSetup, { plan, home: null, step: 3, onStep: vi.fn(), onChange: setPlan, onOpenPlace: vi.fn(), onNotice: vi.fn(), onOpenSettings: vi.fn(), onFinish: vi.fn() });
}
const NAME = '철뚝소머리집';
const pin = () => screen.getByRole('button', { name: `'${NAME}' 꼭 갈 곳` });
// The card is the pin's row's parent: the name and pin row, then the meal chips, then the booking.
const card = () => within(pin().parentElement!.parentElement!);
const visit = () => latest.visits.find((v) => v.placeRef === 'cheolttuk')!;

it('adds a booking from a text button; a booked place is a must-see and its meal follows from the time', () => {
  render(createElement(Step3));
  // The sample has one booking (동화가든) and one more must-see (바다부채길).
  expect(screen.getByText('꼭 갈 곳 2곳 · 예약 1곳')).toBeTruthy();
  expect(pin().getAttribute('aria-pressed')).toBe('false');
  expect(card().getByText('식당')).toBeTruthy();
  expect(card().getByText('식사 때')).toBeTruthy();
  expect(card().getByRole('button', { name: '상관없음' })).toBeTruthy();

  fireEvent.click(card().getByRole('button', { name: '+ 예약 시각 넣기' }));
  expect(visit().fixed?.kind).toBe('RESERVATION');
  expect(visit().dateFlexible).toBe(false);
  // The pin shows on and is locked — the stored importance is not touched.
  expect(pin().getAttribute('aria-pressed')).toBe('true');
  expect((pin() as HTMLButtonElement).disabled).toBe(true);
  expect(visit().importance).toBe('NORMAL');
  expect(card().queryByText('식사 때')).toBeNull();
  expect(card().queryByRole('button', { name: '+ 예약 시각 넣기' })).toBeNull();
  expect(screen.getByText('꼭 갈 곳 3곳 · 예약 2곳')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: `'${NAME}' 예약 지우기` }));
  expect(visit().fixed).toBeNull();
  expect(pin().getAttribute('aria-pressed')).toBe('false');
  expect((pin() as HTMLButtonElement).disabled).toBe(false);
  expect(card().getByText('식사 때')).toBeTruthy();
  expect(card().getByRole('button', { name: '+ 예약 시각 넣기' })).toBeTruthy();
  expect(screen.getByText('꼭 갈 곳 2곳 · 예약 1곳')).toBeTruthy();
});

it('turns a must-see on and off with the pin, and counts it', () => {
  render(createElement(Step3));
  fireEvent.click(pin());
  expect(visit().importance).toBe('MUST');
  expect(pin().getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('꼭 갈 곳 3곳 · 예약 1곳')).toBeTruthy();
  fireEvent.click(pin());
  expect(visit().importance).toBe('NORMAL');
  expect(screen.getByText('꼭 갈 곳 2곳 · 예약 1곳')).toBeTruthy();
});

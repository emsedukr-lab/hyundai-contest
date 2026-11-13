import { describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { hoursLines, isSimpleHours } from './hours';

const hoursOf = (ref: string) => {
  const h = sampleTrip().places.find((p) => p.placeRef === ref)!.hours;
  if (h.status !== 'USER_ENTERED') throw new Error(`${ref} has no hours`);
  return h;
};

describe('opening hours grouped for reading', () => {
  it('one pair of times on every open weekday is simple; the closed weekday is listed', () => {
    const h = hoursOf('gyodong'); // closed on Mondays
    expect(isSimpleHours(h)).toBe(true);
    expect(hoursLines(h)).toEqual({ open: [{ days: [2, 3, 4, 5, 6, 7], spans: [{ open: '10:00', close: '18:00' }] }], closed: [1] });
  });

  it('a break in the day is two spans, in order', () => {
    const h = hoursOf('donghwa'); // 16:00–17:00 break, closed on Wednesdays
    expect(isSimpleHours(h)).toBe(false);
    expect(hoursLines(h)).toEqual({
      open: [{ days: [1, 2, 4, 5, 6, 7], spans: [{ open: '07:00', close: '16:00' }, { open: '17:00', close: '19:30' }] }],
      closed: [3],
    });
  });

  it('weekdays with different times get a line each', () => {
    const h = hoursOf('badabuchae'); // opens an hour earlier at the weekend
    expect(isSimpleHours(h)).toBe(false);
    expect(hoursLines(h).open).toEqual([
      { days: [1, 2, 3, 4, 5], spans: [{ open: '09:00', close: '15:30' }] },
      { days: [6, 7], spans: [{ open: '08:00', close: '15:30' }] },
    ]);
  });
});

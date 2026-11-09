import { describe, expect, it } from 'vitest';
import { timeLabel, timeOptions } from './format';
import { t } from './i18n';

describe('time picker choices (M47)', () => {
  it('lists the whole day on the grid, in order', () => {
    const half = timeOptions(30);
    expect(half).toHaveLength(48);
    expect(half[0]).toBe('00:00');
    expect(half[1]).toBe('00:30');
    expect(half.at(-1)).toBe('23:30');
    expect(timeOptions(15)).toHaveLength(96);
  });

  it('keeps an off-grid current value as a choice, sorted in place; ignores junk', () => {
    const opts = timeOptions(30, '10:15');
    expect(opts).toHaveLength(49);
    expect(opts.slice(opts.indexOf('10:00'), opts.indexOf('10:00') + 3)).toEqual(['10:00', '10:15', '10:30']);
    expect(timeOptions(30, '13:00')).toHaveLength(48); // already on the grid
    expect(timeOptions(30, 'nope')).toHaveLength(48);
  });

  it('reads as morning/afternoon with a 12-hour clock', () => {
    expect(timeLabel('00:00')).toBe(t('time.label', { ampm: t('time.am'), h: 12, m: '00' }));
    expect(timeLabel('09:30')).toBe(t('time.label', { ampm: t('time.am'), h: 9, m: '30' }));
    expect(timeLabel('12:00')).toBe(t('time.label', { ampm: t('time.pm'), h: 12, m: '00' }));
    expect(timeLabel('13:05')).toBe(t('time.label', { ampm: t('time.pm'), h: 1, m: '05' }));
  });
});

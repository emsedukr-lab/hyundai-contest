import { describe, expect, it } from 'vitest';
import { chipLabel, periodOf, pickerTimes, timeLabel, timeOptions } from './format';
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
    expect(timeLabel('00:00')).toBe(t('time.label', { ampm: t('time.am'), h: 0, m: '00' })); // midnight reads 0, never 12 (M50)
    expect(timeLabel('09:30')).toBe(t('time.label', { ampm: t('time.am'), h: 9, m: '30' }));
    expect(timeLabel('12:00')).toBe(t('time.label', { ampm: t('time.pm'), h: 12, m: '00' }));
    expect(timeLabel('13:05')).toBe(t('time.label', { ampm: t('time.pm'), h: 1, m: '05' }));
  });
});

describe('grid time picker (M50)', () => {
  it('오전 shows 06:00–11:30 (12 chips), dawn adds 00:00–05:30; 오후 is 12:00–23:30 (24 chips)', () => {
    const am = pickerTimes('am');
    expect(am).toHaveLength(12);
    expect([am[0], am.at(-1)]).toEqual(['06:00', '11:30']);
    const dawn = pickerTimes('am', { dawn: true });
    expect(dawn).toHaveLength(24);
    expect(dawn[0]).toBe('00:00');
    const pm = pickerTimes('pm');
    expect(pm).toHaveLength(24);
    expect([pm[0], pm.at(-1)]).toEqual(['12:00', '23:30']);
  });

  it('adds an off-grid current value to its own tab, only where that tab shows it', () => {
    expect(pickerTimes('am', { current: '10:15' })).toContain('10:15');
    expect(pickerTimes('pm', { current: '10:15' })).not.toContain('10:15');
    expect(pickerTimes('am', { current: '04:10' })).not.toContain('04:10'); // dawn hidden
    expect(pickerTimes('am', { current: '04:10', dawn: true })).toContain('04:10');
  });

  it('names the half of the day and writes chips on a 12-hour clock', () => {
    expect([periodOf('00:00'), periodOf('11:30'), periodOf('12:00'), periodOf('23:30')]).toEqual(['am', 'am', 'pm', 'pm']);
    expect([chipLabel('00:30'), chipLabel('09:00'), chipLabel('12:30'), chipLabel('13:00')]).toEqual(['0:30', '9:00', '12:30', '1:00']);
  });
});

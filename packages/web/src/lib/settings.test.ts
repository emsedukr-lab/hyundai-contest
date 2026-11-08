import { beforeEach, describe, expect, it } from 'vitest';
import { defaultHome, presetPlace, setPresetPlace } from './settings';

const home = { name: '서울시청', address: '서울특별시 중구 세종대로 110', latE7: 375_662_952, lonE7: 1_269_779_451 };
const work = { name: '현대자동차 본사', address: '서울 서초구 헌릉로 12', latE7: 374_634_000, lonE7: 1_270_394_000 };

describe('start presets in settings', () => {
  beforeEach(() => localStorage.clear());

  it('집 is the one home address (same key every trip reads)', () => {
    setPresetPlace('home', home);
    expect(defaultHome()).toEqual({ address: home.address, latE7: home.latE7, lonE7: home.lonE7 });
    expect(presetPlace('home')?.address).toBe(home.address);
    setPresetPlace('home', null);
    expect(defaultHome()).toBeNull();
  });

  it('회사 and 즐겨찾기 keep their own place and clear independently', () => {
    setPresetPlace('work', work);
    setPresetPlace('fav2', { ...work, name: '단골 카페' });
    expect(presetPlace('work')).toEqual(work);
    expect(presetPlace('fav2')?.name).toBe('단골 카페');
    expect(presetPlace('fav1')).toBeNull();
    setPresetPlace('work', null);
    expect(presetPlace('work')).toBeNull();
    expect(presetPlace('fav2')?.name).toBe('단골 카페');
  });

  it('a corrupted or out-of-range entry reads as unset instead of reaching a trip', () => {
    localStorage.setItem('tteonaljido.originPresets', JSON.stringify({ work: { ...work, latE7: 9_999_999_999 }, fav1: { address: 'x' } }));
    expect(presetPlace('work')).toBeNull();
    expect(presetPlace('fav1')).toBeNull();
    localStorage.setItem('tteonaljido.originPresets', '{not json');
    expect(presetPlace('work')).toBeNull();
  });
});

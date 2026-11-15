import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPresetPlace, defaultHome, isPresetSlot, presetLabel, presetPlace, presetSlots, setPresetPlace } from './settings';

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


describe('named frequent places', () => {
  beforeEach(() => localStorage.clear());
  it('starts with only home/work and supports more than three named places', () => {
    expect(presetSlots()).toEqual(['home', 'work']);
    const ids = Array.from({ length: 4 }, (_, i) => addPresetPlace({ ...work, name: `자주 쓰는 곳 ${i}` }));
    expect(new Set(ids).size).toBe(4);
    expect(presetSlots()).toEqual(['home', 'work', ...ids]);
    expect(ids.map(presetLabel)).toEqual(['자주 쓰는 곳 0', '자주 쓰는 곳 1', '자주 쓰는 곳 2', '자주 쓰는 곳 3']);
    setPresetPlace(ids[0], { ...work, name: '본가' });
    expect(presetLabel(ids[0])).toBe('본가');
    setPresetPlace(ids[0], null);
    expect(presetSlots()).not.toContain(ids[0]);
  });
  it('keeps previously registered favourite slots and shows their place names', () => {
    setPresetPlace('fav2', { ...work, name: '서울역' });
    expect(presetSlots()).toEqual(['home', 'work', 'fav2']);
    expect(presetLabel('fav2')).toBe('서울역');
    expect(presetPlace('fav2')?.address).toBe(work.address);
  });
  it('rejects unknown slots and corrupt custom locations', () => {
    const id = 'place-12345678-1234-1234-1234-123456789abc';
    expect(isPresetSlot(id)).toBe(true);
    for (const bad of ['new', 'place-x', '__proto__', '../home']) expect(isPresetSlot(bad)).toBe(false);
    localStorage.setItem('tteonaljido.originPresets', JSON.stringify({ [id]: { ...work, lonE7: 9999999999 }, unknown: work }));
    expect(presetSlots()).toEqual(['home', 'work']);
  });
  it('reports a failed storage write instead of claiming a new place was saved', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    try { expect(() => addPresetPlace(work)).toThrow(); expect(presetSlots()).toEqual(['home', 'work']); }
    finally { spy.mockRestore(); }
  });
});

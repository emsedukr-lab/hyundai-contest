import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Trip } from '@tteonaljido/shared';
import { detectLang, dictionaries, fill } from './i18n';

const placeholders = (s: string) => new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]));

describe('dictionaries', () => {
  it('ko and en have the same keys', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.ko).sort());
  });

  it('every placeholder in a Korean string also appears in its English string', () => {
    for (const [key, ko] of Object.entries(dictionaries.ko)) {
      const en = placeholders(dictionaries.en[key as keyof typeof dictionaries.ko]);
      for (const name of placeholders(ko)) expect(en.has(name), `${key} is missing {${name}} in English`).toBe(true);
    }
  });

  it('English plurals pick the singular only for 1', () => {
    expect(fill('{n} {n|place|places}', { n: 1 })).toBe('1 place');
    expect(fill('{n} {n|place|places}', { n: 0 })).toBe('0 places');
  });
});

describe('language', () => {
  it('is English only when navigator.language starts with "en"', () => {
    expect(['en', 'en-US', 'EN-gb'].map(detectLang)).toEqual(['en', 'en', 'en']);
    expect(['ko-KR', 'ja', '', undefined, null].map(detectLang)).toEqual(['ko', 'ko', 'ko', 'ko', 'ko']);
  });

  const load = async (language: string) => {
    vi.resetModules();
    Object.defineProperty(navigator, 'language', { value: language, configurable: true });
    return { ...(await import('./format')), ...(await import('./trips')) };
  };
  const days = (n: number) => ({ days: Array.from({ length: n }) }) as unknown as Trip;
  afterAll(() => void Reflect.deleteProperty(navigator, 'language'));

  it('keeps the Korean formats', async () => {
    const f = await load('ko-KR');
    expect(f.periodLabel('2026-11-20', '2026-11-23')).toBe('11월 20일 (금) ~ 11월 23일 (월)');
    expect([45, 60, 90].map(f.minutesLabel)).toEqual(['45분', '1시간', '1시간 30분']);
    expect([1, 4].map((n) => f.nightsLabel(days(n)))).toEqual(['당일', '3박 4일']);
  });

  it('formats English dates, durations and nights', async () => {
    const f = await load('en-US');
    expect(f.periodLabel('2026-11-20', '2026-11-23')).toBe('Fri, Nov 20 – Mon, Nov 23');
    expect([45, 60, 90].map(f.minutesLabel)).toEqual(['45m', '1h', '1h 30m']);
    expect([1, 2, 4].map((n) => f.nightsLabel(days(n)))).toEqual(['Day trip', '1 night, 2 days', '3 nights, 4 days']);
  });
});

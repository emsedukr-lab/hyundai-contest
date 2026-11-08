import { describe, expect, it } from 'vitest';
import { MEMO_MAX, cleanNotes, setNote } from './notes';

describe('trip notes (phone only)', () => {
  it('keeps a memo and valid check-in/out times, drops what is malformed or empty', () => {
    const n = cleanNotes({ inn: { memo: '1203호', checkIn: '15:00', checkOut: '11:00' }, bad: { checkIn: '25:00', memo: '   ' }, junk: 3 });
    expect(n).toEqual({ inn: { memo: '1203호', checkIn: '15:00', checkOut: '11:00' } });
  });

  it('caps the memo and keeps only places still in the trip', () => {
    const n = cleanNotes({ a: { memo: 'x'.repeat(500) }, gone: { memo: 'old' } }, new Set(['a']));
    expect(n.a.memo).toHaveLength(MEMO_MAX);
    expect(n.gone).toBeUndefined();
  });

  it('setNote merges, clears a field with empty input, and removes an empty note', () => {
    let n = setNote({}, 'inn', { checkIn: '15:00' });
    n = setNote(n, 'inn', { memo: '주차 B2' });
    expect(n.inn).toEqual({ checkIn: '15:00', memo: '주차 B2' });
    n = setNote(n, 'inn', { checkIn: null });
    expect(n.inn).toEqual({ memo: '주차 B2' });
    n = setNote(n, 'inn', { memo: '' });
    expect(n.inn).toBeUndefined();
  });
});

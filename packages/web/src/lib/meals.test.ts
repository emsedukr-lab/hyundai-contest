import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MEAL_TIMES, mealTimes, mealTimesError, mealsOf, setMealTimes, toMealWindows, type MealTimes } from './meals';
import { cleanNotes, setNote } from './notes';

const moved: MealTimes = { breakfast: ['07:30', '09:00'], lunch: ['12:00', '14:00'], dinner: ['18:00', '20:00'] };

describe('meal times in settings (phone only)', () => {
  beforeEach(() => localStorage.clear());

  it('reads the usual times until others are set, and goes back to them on reset', () => {
    expect(mealTimes()).toEqual(DEFAULT_MEAL_TIMES);
    setMealTimes(moved);
    expect(mealTimes()).toEqual(moved);
    setMealTimes(null);
    expect(mealTimes()).toEqual(DEFAULT_MEAL_TIMES);
    expect(localStorage.length).toBe(0);
  });

  it('says what is wrong with one meal among the others', () => {
    expect(mealTimesError({ ...moved, lunch: ['13:00', '13:00'] }, 'lunch')).toBe('ORDER');
    expect(mealTimesError({ ...moved, lunch: ['08:30', '13:00'] }, 'lunch')).toBe('OVERLAP_BEFORE');
    expect(mealTimesError({ ...moved, lunch: ['12:00', '18:30'] }, 'lunch')).toBe('OVERLAP_AFTER');
    expect(mealTimesError({ ...moved, lunch: ['09:00', '18:00'] }, 'lunch')).toBeNull(); // touching its neighbours is fine
  });

  it('keeps only a valid set: an overlapping or corrupted entry reads as the usual times', () => {
    setMealTimes({ ...moved, dinner: ['13:00', '20:00'] });
    expect(mealTimes()).toEqual(DEFAULT_MEAL_TIMES);
    localStorage.setItem('tteonaljido.mealTimes', JSON.stringify({ breakfast: ['8', '9'], lunch: ['11:30', '13:30'] }));
    expect(mealTimes()).toEqual(DEFAULT_MEAL_TIMES);
    localStorage.setItem('tteonaljido.mealTimes', '{not json');
    expect(mealTimes()).toEqual(DEFAULT_MEAL_TIMES);
  });

  it('hands the optimizer minutes of the day', () => {
    expect(toMealWindows(DEFAULT_MEAL_TIMES)).toEqual({ breakfast: [480, 570], lunch: [690, 810], dinner: [1050, 1170] });
  });
});

describe('a restaurant\'s meal in the trip notes', () => {
  it('is kept with the other notes, cleared with null, and dropped when it is not a meal', () => {
    let n = setNote({}, 'f', { meal: 'DINNER' });
    n = setNote(n, 'f', { memo: '웨이팅 있음' });
    expect(n.f).toEqual({ meal: 'DINNER', memo: '웨이팅 있음' });
    expect(cleanNotes({ f: { meal: 'DINNER' }, g: { meal: 'SUPPER' } })).toEqual({ f: { meal: 'DINNER' } });
    expect(mealsOf(n)).toEqual({ f: 'dinner' });
    n = setNote(n, 'f', { meal: null });
    expect(n.f).toEqual({ memo: '웨이팅 있음' });
    expect(mealsOf(n)).toEqual({});
  });
});

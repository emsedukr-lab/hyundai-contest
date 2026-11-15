import type { MealSlot, MealWindows } from '@tteonaljido/shared';
import { minutes } from '@tteonaljido/shared';
import { t } from './i18n';
import type { TripNotes } from './notes';

/**
 * 식사: which meal a restaurant is for, and when each meal is eaten. Both live on this phone only — the choice in
 * the trip's notes (per place), the times in 설정 (one set for every trip, localStorage like the home address) — and are
 * read by the route recommendation alone. Neither is part of what the car receives (the transfer schema is unchanged).
 */
export const MEAL_CHOICES = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;
export type MealChoice = (typeof MEAL_CHOICES)[number];
export const isMealChoice = (v: unknown): v is MealChoice => (MEAL_CHOICES as readonly unknown[]).includes(v);

const SLOT: Record<MealChoice, MealSlot> = { BREAKFAST: 'breakfast', LUNCH: 'lunch', DINNER: 'dinner' };
export const slotOf = (meal: MealChoice): MealSlot => SLOT[meal];
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** A meal's time as ["HH:MM", "HH:MM"] (from, to). */
export type MealTimes = Record<MealSlot, [string, string]>;
export const DEFAULT_MEAL_TIMES: MealTimes = { breakfast: ['08:00', '09:30'], lunch: ['11:30', '13:30'], dinner: ['17:30', '19:30'] };

const KEY = 'tteonaljido.mealTimes';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type MealTimesError = 'ORDER' | 'OVERLAP_BEFORE' | 'OVERLAP_AFTER';

/**
 * What is wrong with one meal's time among the others, or null: it must end after it starts, begin no earlier than the
 * meal before it ends, and end no later than the meal after it begins (touching is fine: 아침 until 11:30, 점심 from 11:30).
 */
export function mealTimesError(times: MealTimes, slot: MealSlot): MealTimesError | null {
  const [from, to] = times[slot];
  if (from >= to) return 'ORDER';
  const i = MEAL_SLOTS.indexOf(slot);
  if (i > 0 && times[MEAL_SLOTS[i - 1]][1] > from) return 'OVERLAP_BEFORE';
  if (i < MEAL_SLOTS.length - 1 && times[MEAL_SLOTS[i + 1]][0] < to) return 'OVERLAP_AFTER';
  return null;
}

const wellFormed = (v: unknown): v is MealTimes =>
  !!v &&
  typeof v === 'object' &&
  MEAL_SLOTS.every((s) => {
    const w = (v as Record<string, unknown>)[s];
    return Array.isArray(w) && w.length === 2 && w.every((x) => typeof x === 'string' && TIME.test(x));
  });
export const validMealTimes = (v: unknown): v is MealTimes => wellFormed(v) && MEAL_SLOTS.every((s) => mealTimesError(v, s) === null);

/** The meal times set in 설정; the defaults when none were set or the stored value is not usable. */
export function mealTimes(): MealTimes {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (validMealTimes(data)) return { breakfast: [...data.breakfast], lunch: [...data.lunch], dinner: [...data.dinner] };
  } catch {
    /* storage blocked or unreadable: the defaults */
  }
  return DEFAULT_MEAL_TIMES;
}

/** Keeps the meal times (only a valid set); null goes back to the defaults. */
export function setMealTimes(times: MealTimes | null): void {
  try {
    if (!times || (validMealTimes(times) && isDefaultMealTimes(times))) localStorage.removeItem(KEY);
    else if (validMealTimes(times)) localStorage.setItem(KEY, JSON.stringify({ breakfast: times.breakfast, lunch: times.lunch, dinner: times.dinner }));
  } catch {
    /* storage blocked: the setting just isn't kept */
  }
}

export const isDefaultMealTimes = (times: MealTimes) => MEAL_SLOTS.every((s) => times[s][0] === DEFAULT_MEAL_TIMES[s][0] && times[s][1] === DEFAULT_MEAL_TIMES[s][1]);

/** "11:30–13:30" */
export const mealRange = (times: MealTimes, slot: MealSlot) => `${times[slot][0]}–${times[slot][1]}`;

export const mealLabel = (slot: MealSlot): string => (slot === 'breakfast' ? t('meal.breakfast') : slot === 'lunch' ? t('meal.lunch') : t('meal.dinner'));
export const mealChoiceLabel = (meal: MealChoice): string => mealLabel(slotOf(meal));

/** The meal times in the optimizer's minutes of the day. */
export const toMealWindows = (times: MealTimes): MealWindows => ({
  breakfast: [minutes(times.breakfast[0]), minutes(times.breakfast[1])],
  lunch: [minutes(times.lunch[0]), minutes(times.lunch[1])],
  dinner: [minutes(times.dinner[0]), minutes(times.dinner[1])],
});

/** The chosen meals of a trip's notes, as the optimizer reads them (by placeRef). */
export const mealsOf = (notes: TripNotes | undefined): Record<string, MealSlot> =>
  Object.fromEntries(Object.entries(notes ?? {}).flatMap(([ref, n]) => (n.meal ? [[ref, slotOf(n.meal)]] : [])));

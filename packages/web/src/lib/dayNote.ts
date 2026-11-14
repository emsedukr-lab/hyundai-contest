import { timeline, type Home, type Trip } from '@tteonaljido/shared';
import { legKeys } from './trips';

/**
 * Why a day's stop times are unknown, as the one thing that would make them known (the first cause on the day):
 * - `home`: day 1 starts from 집 and 설정 has no home address yet;
 * - `here`: day 1 starts from 현재 위치 and this phone's position was not read yet;
 * - `depart`: the day has no departure time;
 * - `pending`: Kakao can time the leg but has not answered (yet, or it failed) — recalculating may fill it;
 * - `car`: nobody on the phone can time the leg (a place without a location, a night without lodging): the car's
 *   navigation times it. Never a reason to invent a time (PRODUCT.md: the navigation measures, the phone estimates).
 * `k` is the leg (and the stop it leads into) where the times stop being known. Null when every stop has its time.
 */
export type TimeGap = { kind: 'home' | 'here' | 'depart' | 'pending' | 'car'; k: number };

export function dayTimeGap(plan: Trip, home: Home | null, dayIndex: number, askable: ReadonlySet<string>, startAt?: number): TimeGap | null {
  const day = plan.days[dayIndex - 1];
  if (!day) return null;
  const k = timeline(plan, dayIndex, startAt).findIndex((st) => st.start === null);
  if (k < 0) return null;
  if (day.legs[k]) return { kind: 'depart', k }; // the leg is timed, so it is the clock before it that is missing
  const key = legKeys(plan, dayIndex)[k];
  if (key && askable.has(key)) return { kind: 'pending', k };
  // The start can only be what is missing when the stop it leads to has a location; a place added by name waits for the car either way.
  const to = plan.places.find((p) => p.placeRef === plan.visits.find((v) => v.visitId === day.visitOrder[k])?.placeRef);
  if (dayIndex === 1 && k === 0 && to && to.latE7 !== null && to.lonE7 !== null) {
    if (plan.origin.kind === 'HOME' && !home) return { kind: 'home', k };
    if (plan.origin.kind === 'CURRENT') return { kind: 'here', k };
  }
  return { kind: 'car', k };
}

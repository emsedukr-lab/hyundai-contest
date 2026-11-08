import type { Endpoint, Trip } from '@tteonaljido/shared';
import { t } from '../lib/i18n';
import { placeOf, visitOf } from '../lib/trips';

export const endpointName = (plan: Trip, e: Endpoint) => (e.kind === 'HOME' ? t('common.home') : (placeOf(plan, e.placeRef)?.name ?? t('common.place')));

/**
 * What one day of the timeline runs between: day 1 starts at the trip's origin, later days at the previous night's
 * lodging; the last day ends at the final destination, the others at that night's lodging (name null while unset).
 */
export function dayEnds(plan: Trip, dayIndex: number) {
  const i = Math.max(0, plan.days.findIndex((d) => d.dayIndex === dayIndex));
  const day = plan.days[i];
  const isFirst = i === 0;
  const isLast = i === plan.days.length - 1;
  const startName = isFirst ? endpointName(plan, plan.origin) : (placeOf(plan, plan.days[i - 1].lodgingPlaceRef ?? '')?.name ?? t('days.prevLodgingUnset'));
  const endName = isLast ? endpointName(plan, plan.finalDestination) : (placeOf(plan, day.lodgingPlaceRef ?? '')?.name ?? null);
  return { day, i, isFirst, isLast, startName, endName };
}

/** The two ends of leg `k` of a day (leg k leads into stop k; the last leg into the day's end). */
export function legEnds(plan: Trip, dayIndex: number, k: number) {
  const { day, startName, endName } = dayEnds(plan, dayIndex);
  const stopName = (j: number) => placeOf(plan, visitOf(plan, day.visitOrder[j])?.placeRef ?? '')?.name ?? t('common.place');
  return { from: k === 0 ? startName : stopName(k - 1), to: k >= day.visitOrder.length ? (endName ?? t('days.lodgingUnset')) : stopName(k) };
}

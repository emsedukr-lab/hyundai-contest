import { t } from './i18n';
import { dayCount, todayIn, type TripDoc } from './trips';

/** Where a trip stands today: days until it leaves, which day of it we are on, or that it is over. */
export function tripWhen(startDate: string, endDate: string, today: string): { label: string; focusDay: number | null } {
  if (today < startDate) {
    const n = dayCount(today, startDate) - 1;
    return { label: n === 1 ? t('home.next.tomorrow') : t('home.next.inDays', { n }), focusDay: 1 };
  }
  if (today <= endDate) {
    const day = dayCount(startDate, today);
    return { label: day === 1 && today === startDate ? t('home.next.today') : t('home.next.onDay', { day }), focusDay: day };
  }
  return { label: t('home.next.past'), focusDay: null };
}

/** The trip to put first: the one under way, else the soonest upcoming, else the most recently edited (list order). */
export function pickNextTrip(docs: TripDoc[]): TripDoc | null {
  if (docs.length === 0) return null;
  const today = (d: TripDoc) => todayIn(d.plan.timezone);
  const ongoing = docs.find((d) => d.plan.startDate <= today(d) && today(d) <= d.plan.endDate);
  if (ongoing) return ongoing;
  const upcoming = docs.filter((d) => d.plan.startDate > today(d)).sort((a, b) => a.plan.startDate.localeCompare(b.plan.startDate));
  return upcoming[0] ?? docs[0];
}

/**
 * '다른 여행' order (M49): trips still ahead or under way by departure date (then end date, then name), then past trips
 * with the most recent first — so the list reads on in time below the next-trip card.
 */
export function sortOtherTrips(docs: TripDoc[]): TripDoc[] {
  const past = (d: TripDoc) => d.plan.endDate < todayIn(d.plan.timezone);
  const byStart = (a: TripDoc, b: TripDoc) =>
    a.plan.startDate.localeCompare(b.plan.startDate) || a.plan.endDate.localeCompare(b.plan.endDate) || a.plan.name.localeCompare(b.plan.name, 'ko');
  const ahead = docs.filter((d) => !past(d)).sort(byStart);
  const done = docs.filter(past).sort((a, b) => byStart(b, a));
  return [...ahead, ...done];
}

/** For each trip, the other trips whose dates overlap it (a.start ≤ b.end and b.start ≤ a.end) — M49. */
export function dateOverlaps(docs: TripDoc[]): Map<string, TripDoc[]> {
  const out = new Map<string, TripDoc[]>();
  for (const a of docs) {
    const others = docs.filter((b) => b !== a && a.plan.startDate <= b.plan.endDate && b.plan.startDate <= a.plan.endDate);
    if (others.length) out.set(a.tripId, others);
  }
  return out;
}

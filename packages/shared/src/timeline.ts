import type { Trip, Visit } from './tripTransfer';

/**
 * The phone's copy of the car's timetable rules (car/core-trip TripValidator: departure, timeline, dayEnd and the
 * day-level findings), so the editor can show times and conflicts before sending. Same codes and args as Kotlin;
 * schema/fixtures/timeline/* keeps the two in step (TimelineParityTest on the car side).
 * Missing travel times are "cannot check", never "OK".
 */
export interface StopTime {
  visitId: string;
  arrive: number | null;
  start: number | null;
  end: number | null;
}

export type DayIssueCode =
  | 'FIRST_DEPARTURE_UNKNOWN'
  | 'DEPARTURE_UNKNOWN'
  | 'DEPART_PREVIOUS_DAY'
  | 'LEG_UNKNOWN'
  | 'LATE_FOR_FIXED'
  | 'FIXED_UNCHECKED'
  | 'CLOSED_DATE'
  | 'CLOSED_WEEKDAY'
  | 'OUTSIDE_HOURS'
  | 'PAST_END_BY';

export interface DayIssue {
  severity: 'CONFLICT' | 'UNCERTAIN';
  code: DayIssueCode;
  dayIndex: number;
  args: string[];
  /** The stop it is about (for the editor); not part of the cross-language contract. */
  visitId?: string;
}

export const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Same output as Kotlin `TripValidator.hhmm`: "전날" before midnight, "(+1)" past it. */
export const hhmm = (m: number) =>
  m < 0 ? '전날' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${m >= 1440 ? '(+1)' : ''}`;

const visitOf = (trip: Trip, id: string) => trip.visits.find((v) => v.visitId === id)!;
const placeName = (trip: Trip, ref: string) => trip.places.find((p) => p.placeRef === ref)?.name ?? ref;

/** Departure minute of a day, or null when it cannot be known. */
export function departure(trip: Trip, dayIndex: number): number | null {
  const day = trip.days[dayIndex - 1];
  if (dayIndex > 1) return day.departTime ? minutes(day.departTime) : null;
  const f = trip.firstDay;
  if (f.basis === 'DEPART_ORIGIN') return f.departTime ? minutes(f.departTime) : null; // optional
  // Arrival basis: leave `leg` minutes before the target arrival; getting ready (prepMinutes) comes before that.
  const leg = day.legs[0];
  return leg ? minutes(f.arriveTime) - leg.minutes : null;
}

/**
 * Arrival = clock + leg; a visit starts on arrival and not before its fixed time, which also restores the chain.
 * Parking time (`prepMinutes`) is NOT counted: it stays in the transfer for compatibility, and real parking time
 * will later come from the car's own data (navigation ended → ignition off + belt released + doors locked).
 */
function walk(start: number | null, items: [Visit, number | null][]): StopTime[] {
  let clock = start;
  return items.map(([v, leg]) => {
    const arrive = clock !== null && leg !== null ? clock + leg : null;
    const fixed = v.fixed ? minutes(v.fixed.time) : null;
    const begin = arrive !== null ? Math.max(arrive, fixed ?? 0) : fixed;
    const end = begin !== null ? begin + v.stayMinutes : null;
    clock = end;
    return { visitId: v.visitId, arrive, start: begin, end };
  });
}

/**
 * The day's stop times. `startAt` (minute of the day) replaces the planned departure — the phone uses it to recompute
 * today "from now" on pull-to-refresh; without it this is the shared rule the car mirrors.
 */
export function timeline(trip: Trip, dayIndex: number, startAt?: number): StopTime[] {
  const day = trip.days[dayIndex - 1];
  return walk(
    startAt ?? departure(trip, dayIndex),
    day.visitOrder.map((id, k) => [visitOf(trip, id), day.legs[k]?.minutes ?? null]),
  );
}

export function dayEnd(trip: Trip, dayIndex: number, startAt?: number): number | null {
  const day = trip.days[dayIndex - 1];
  const last = day.visitOrder.length === 0 ? (startAt ?? departure(trip, dayIndex)) : timeline(trip, dayIndex, startAt).at(-1)!.end;
  const leg = day.legs.at(-1);
  return last !== null && leg ? last + leg.minutes : null;
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
/** ISO weekday (Mon 1 … Sun 7) of a YYYY-MM-DD date. */
const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
};

function hoursIssue(trip: Trip, ref: string, date: string, st: StopTime): { code: DayIssueCode; extra: string[] } | null {
  const h = trip.places.find((p) => p.placeRef === ref)!.hours;
  if (h.status !== 'USER_ENTERED') return null;
  if (h.closedDates.includes(date)) return { code: 'CLOSED_DATE', extra: [] };
  const today = h.weekly.filter((w) => w.weekday === weekday(date));
  if (today.length === 0) return { code: 'CLOSED_WEEKDAY', extra: [] };
  if (st.start === null || st.end === null) return null;
  const fits = today.some((w) => {
    const o = minutes(w.open);
    let c = minutes(w.close);
    if (c <= o) c += 1440;
    return st.start! >= o && st.end! <= c;
  });
  return fits ? null : { code: 'OUTSIDE_HOURS', extra: [hhmm(st.start), hhmm(st.end)] };
}

/** The day-level findings of the car's re-check, in the same order and with the same args. */
export function dayIssues(trip: Trip, dayIndex: number): DayIssue[] {
  const out: DayIssue[] = [];
  const add = (severity: DayIssue['severity'], code: DayIssueCode, args: (string | number)[], visitId?: string) =>
    out.push({ severity, code, dayIndex, args: args.map(String), ...(visitId ? { visitId } : {}) });
  const n = dayIndex;
  const d = trip.days[n - 1];
  const dep = departure(trip, n);
  if (dep === null) {
    // A first day with no departure time chosen reads like any other day without one; FIRST_DEPARTURE_UNKNOWN
    // stays for the arrival basis whose first travel time is missing.
    const freeFirst = n === 1 && trip.firstDay.basis === 'DEPART_ORIGIN' && trip.firstDay.departTime === null;
    if (n === 1 && !freeFirst) add('UNCERTAIN', 'FIRST_DEPARTURE_UNKNOWN', []);
    else add('UNCERTAIN', 'DEPARTURE_UNKNOWN', [n]);
  } else if (n === 1 && dep < 0) add('CONFLICT', 'DEPART_PREVIOUS_DAY', []);
  const missing = d.legs.filter((l) => l === null).length;
  if (missing > 0) add('UNCERTAIN', 'LEG_UNKNOWN', [n, missing]);
  const date = addDays(trip.startDate, n - 1);
  for (const st of timeline(trip, n)) {
    const v = visitOf(trip, st.visitId);
    const name = placeName(trip, v.placeRef);
    const fixed = v.fixed ? minutes(v.fixed.time) : null;
    if (fixed !== null && st.arrive !== null && st.arrive > fixed) add('CONFLICT', 'LATE_FOR_FIXED', [n, name, v.fixed!.time, hhmm(st.arrive)], v.visitId); // no parking time
    if (fixed !== null && st.arrive === null) add('UNCERTAIN', 'FIXED_UNCHECKED', [n, name, v.fixed!.time], v.visitId);
    const h = hoursIssue(trip, v.placeRef, date, st);
    if (h) add('CONFLICT', h.code, [n, name, ...h.extra], v.visitId);
  }
  const end = dayEnd(trip, n);
  if (d.endBy && end !== null && end > minutes(d.endBy)) add('CONFLICT', 'PAST_END_BY', [n, hhmm(end), d.endBy]);
  return out;
}

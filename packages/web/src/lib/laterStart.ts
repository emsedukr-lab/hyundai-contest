import { dayIssues, departure, hhmm, minutes, timeline, type Trip } from '@tteonaljido/shared';
import type { TripNotes } from './notes';
import { FIXED_BUFFER, setDepart } from './trips';

/**
 * 늦게 출발하기: when a day reaches its first fixed time (a booking) with an hour or more to spare, leaving later is
 * an alternative to waiting there or filling the time — the stops before the booking simply move later with the
 * departure. How late is bounded by the booking itself (still reached {@link FIXED_BUFFER} minutes early), by the
 * half-hour grid departure times are picked on, by anything the later times would break (opening hours, the day's
 * end target), and — on a day that leaves its lodging for good — by the lodging's check-out time: the traveller's
 * own where it was entered, else the usual {@link USUAL_CHECK_OUT}, said to be assumed.
 * Read off the timetable the app shows (timeline.ts), so the spare time here is the one on the day's 여유 tag.
 */
export const USUAL_CHECK_OUT = '11:00';
/** Spare minutes before a fixed time from which a later start is worth offering. */
const WORTH = 60;
const GRID = 30;

export interface LaterStart {
  dayIndex: number;
  /** "HH:MM": the planned departure and the later one. */
  from: string;
  to: string;
  minutes: number;
  /** The stop with the fixed time the day is early for. */
  visitId: string;
  fixedTime: string;
  /** Minutes to spare before that fixed time (beyond arriving 15 minutes early): as planned, and leaving later. */
  spareBefore: number;
  spareAfter: number;
  /** The check-out time that bounds the departure, when the day leaves a lodging for good. */
  checkOut: { time: string; assumed: boolean } | null;
  /** True when check-out, not the booking, is what stops the departure from moving later still. */
  limitedByCheckOut: boolean;
}

/** The plan with that day's departure set (day 1 departs from the trip's start, later days from the night's lodging). */
export const withDeparture = (plan: Trip, dayIndex: number, time: string): Trip =>
  dayIndex === 1 ? { ...plan, firstDay: { basis: 'DEPART_ORIGIN', departTime: time } } : setDepart(plan, dayIndex, time);

const conflicts = (plan: Trip, dayIndex: number) => dayIssues(plan, dayIndex).filter((i) => i.severity === 'CONFLICT').length;

export function laterStart(plan: Trip, dayIndex: number, notes: TripNotes = {}): LaterStart | null {
  const day = plan.days[dayIndex - 1];
  if (!day || (dayIndex === 1 && plan.firstDay.basis !== 'DEPART_ORIGIN')) return null;
  const dep = departure(plan, dayIndex);
  if (dep === null) return null;
  // The first stop with a fixed time: everything before it is free to move later with the departure.
  const k = day.visitOrder.findIndex((id) => plan.visits.find((v) => v.visitId === id)?.fixed);
  if (k < 0) return null;
  const visit = plan.visits.find((v) => v.visitId === day.visitOrder[k])!;
  const arrive = timeline(plan, dayIndex)[k]?.arrive ?? null;
  if (arrive === null) return null;
  const spare = minutes(visit.fixed!.time) - FIXED_BUFFER - arrive;
  if (spare < WORTH) return null;

  // Leaving a lodging the trip does not come back to tonight: the room is given up by check-out.
  let checkOut: LaterStart['checkOut'] = null;
  if (dayIndex > 1) {
    const fromRef = plan.days[dayIndex - 2].lodgingPlaceRef;
    const toRef = dayIndex === plan.days.length ? null : day.lodgingPlaceRef;
    if (fromRef && fromRef !== toRef) {
      const entered = notes[fromRef]?.checkOut;
      checkOut = { time: entered ?? USUAL_CHECK_OUT, assumed: !entered };
    }
  }
  const limit = checkOut ? minutes(checkOut.time) : Infinity;
  const wanted = dep + spare;
  const before = conflicts(plan, dayIndex);
  for (let to = Math.floor(Math.min(wanted, limit) / GRID) * GRID; to - dep >= GRID; to -= GRID) {
    if (conflicts(withDeparture(plan, dayIndex, hhmm(to)), dayIndex) > before) continue; // a place would close, or the day would end too late
    return {
      dayIndex,
      from: hhmm(dep),
      to: hhmm(to),
      minutes: to - dep,
      visitId: visit.visitId,
      fixedTime: visit.fixed!.time,
      spareBefore: spare,
      spareAfter: spare - (to - dep),
      checkOut,
      limitedByCheckOut: limit < wanted && to + GRID > limit,
    };
  }
  return null;
}

/** What a later-start offer depends on, so one the traveller closed stays closed until something about it changes. */
export const laterSig = (s: LaterStart) => `later:${s.dayIndex}:${s.from}>${s.to}:${s.visitId}@${s.fixedTime}`;

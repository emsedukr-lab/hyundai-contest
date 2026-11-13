import { describe, expect, it } from 'vitest';
import { sampleTrip, timeline, type Trip } from '@tteonaljido/shared';
import { laterStart, withDeparture } from './laterStart';
import { setDepart, setEndBy, updateVisit } from './trips';

/**
 * The sample's day 2: leaves 스카이베이 at 09:30, 경포호 09:35–11:05, then 동화가든 booked for 13:00 (arrive 11:15).
 * That night is at another hotel (신라모노그램), so day 2 leaves 스카이베이 for good.
 */
const sample = sampleTrip();

describe('laterStart', () => {
  it('offers the latest half-hour that still reaches the booking 15 minutes early, within check-out', () => {
    // 13:00 − 15 − 11:15 = 90 minutes to spare → 11:00 by the booking alone, which is also the usual check-out.
    expect(laterStart(sample, 2)).toMatchObject({
      dayIndex: 2, from: '09:30', to: '11:00', minutes: 90, visitId: 'v5', fixedTime: '13:00', spareBefore: 90, spareAfter: 0,
      checkOut: { time: '11:00', assumed: true },
    });
    // Leaving then, the booking is reached exactly 15 minutes early.
    expect(timeline(withDeparture(sample, 2, '11:00'), 2)[1].arrive).toBe(12 * 60 + 45);
  });

  it('stops at the check-out time the traveller entered', () => {
    const out = laterStart(sample, 2, { skybay: { checkOut: '10:00' } })!;
    expect(out).toMatchObject({ to: '10:00', minutes: 30, spareAfter: 60, checkOut: { time: '10:00', assumed: false }, limitedByCheckOut: true });
    // Already leaving at check-out: nothing to offer.
    expect(laterStart(setDepart(sample, 2, '10:00'), 2, { skybay: { checkOut: '10:00' } })).toBeNull();
  });

  it('has no check-out limit when the trip sleeps at the same lodging again', () => {
    const sameHotel: Trip = { ...sample, days: sample.days.map((d) => (d.dayIndex === 2 ? { ...d, lodgingPlaceRef: 'skybay' } : d)) };
    // With an earlier start there are three hours to spare; only the booking bounds the departure.
    const early = setDepart(sameHotel, 2, '08:00');
    expect(laterStart(early, 2, { skybay: { checkOut: '10:00' } })).toMatchObject({ from: '08:00', to: '11:00', checkOut: null, limitedByCheckOut: false });
  });

  it('does not move a stop past its closing time', () => {
    const closesAt = (close: string): Trip => ({ ...sample, places: sample.places.map((p) => (p.placeRef === 'lake' ? { ...p, hours: { status: 'USER_ENTERED', weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: '09:00', close })), closedDates: [] } } : p)) });
    // 경포호 closing at 11:30: its 90 minutes fit until a 09:55 start — no half-hour to gain.
    expect(laterStart(closesAt('11:30'), 2)).toBeNull();
    // Closing at 12:10: leaving 10:30 fits (10:35–12:05), 11:00 does not.
    expect(laterStart(closesAt('12:10'), 2)).toMatchObject({ to: '10:30', spareAfter: 30 });
  });

  it('leaves the rest of the day where it was: after the fixed time nothing moves', () => {
    const later = withDeparture(sample, 2, '11:00');
    expect(timeline(later, 2).slice(1).map((st) => st.end)).toEqual(timeline(sample, 2).slice(1).map((st) => st.end));
    // So a target for the day's end does not stand in the way.
    expect(laterStart(setEndBy(sample, 2, '16:30'), 2)).toMatchObject({ to: '11:00' });
  });

  it('offers nothing without a real margin, a known time or a fixed time', () => {
    expect(laterStart(updateVisit(sample, 'v5', { fixed: { time: '12:00', kind: 'RESERVATION' } }), 2)).toBeNull(); // 30 minutes to spare
    expect(laterStart(setDepart(sample, 2, null), 2)).toBeNull(); // no departure time: no times at all
    expect(laterStart(sample, 3)).toBeNull(); // no fixed time that day
    expect(laterStart(sample, 1)).toBeNull(); // day 1's first leg is unknown (home without an address)
  });

  it('works for the first day too, which has no lodging to check out of', () => {
    // Day 4 moved to day-1 shape: a booking at 13:00, a known 60-minute drive from a start place, leaving 09:00.
    const t: Trip = {
      ...sample,
      origin: { kind: 'PLACE', placeRef: 'skybay' },
      firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
      days: sample.days.map((d) => (d.dayIndex === 1 ? { ...d, visitOrder: ['v1'], legs: [{ minutes: 60, source: 'USER_ESTIMATE' as const }, null] } : d)),
      visits: sample.visits.map((v) => (v.visitId === 'v1' ? { ...v, fixed: { time: '13:00', kind: 'RESERVATION' as const } } : v.visitId === 'v2' || v.visitId === 'v3' ? { ...v, unassignedReason: 'NOT_SCHEDULED_YET' as const } : v)),
    };
    // 13:00 − 15 − 10:00 = 165 minutes → 11:30 on the half-hour grid, 15 minutes still to spare.
    expect(laterStart(t, 1)).toMatchObject({ from: '09:00', to: '11:30', spareBefore: 165, spareAfter: 15, checkOut: null });
  });
});

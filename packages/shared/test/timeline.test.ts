import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dayEnd, dayIssues, departure, hhmm, minutes, parseTransfer, sampleTrip, timeline, type Trip } from '../src/index';

const schema = join(__dirname, '../../../schema');
const withDay = (t: Trip, n: number, patch: Partial<Trip['days'][number]>): Trip => ({ ...t, days: t.days.map((d) => (d.dayIndex === n ? { ...d, ...patch } : d)) });

describe('timetable (same rules as the car)', () => {
  const sample = sampleTrip();

  it('waits for a fixed reservation', () => {
    const t = Object.fromEntries(timeline(sample, 2).map((s) => [s.visitId, s]));
    expect(t.v4.arrive).toBe(minutes('09:35'));
    expect(t.v5.arrive).toBe(minutes('11:15'));
    expect(t.v5.start).toBe(minutes('13:00'));
    expect(dayEnd(sample, 2)).toBe(minutes('16:10'));
  });

  it('does not count parking time: a visit starts on arrival even when prepMinutes is set', () => {
    const withPrep: Trip = { ...sample, visits: sample.visits.map((v) => ({ ...v, prepMinutes: 30 })) };
    const t = Object.fromEntries(timeline(withPrep, 2).map((s) => [s.visitId, s]));
    expect(t.v4.start).toBe(t.v4.arrive);
    expect(dayEnd(withPrep, 2)).toBe(dayEnd(sample, 2));
  });

  it('recomputes a day from another start (the phone "from now" view), still waiting for fixed times', () => {
    const base = Object.fromEntries(timeline(sample, 2).map((s) => [s.visitId, s]));
    const later = Object.fromEntries(timeline(sample, 2, minutes('10:00')).map((s) => [s.visitId, s]));
    expect(later.v4.arrive! - base.v4.arrive!).toBe(minutes('10:00') - minutes('09:30'));
    expect(later.v5.start).toBe(minutes('13:00')); // the reservation still holds
    expect(dayEnd(sample, 2, minutes('10:00'))).toBe(dayEnd(sample, 2)); // and re-anchors the rest of the day
  });

  it('reports unknown legs instead of guessing', () => {
    expect(departure(sample, 1)).toBe(minutes('08:00'));
    expect(timeline(sample, 1)[0].arrive).toBeNull();
    expect(dayIssues(sample, 1).map((i) => i.code)).toEqual(['LEG_UNKNOWN']);
  });

  it('flags being late for a fixed time with the expected arrival', () => {
    const late = withDay(sample, 4, { departTime: '09:55' });
    const issue = dayIssues(late, 4).find((i) => i.code === 'LATE_FOR_FIXED')!;
    expect(issue).toMatchObject({ severity: 'CONFLICT', visitId: 'v10', args: ['4', '정동심곡바다부채길', '10:00', '10:05'] });
  });

  it('checks the return-by time', () => {
    expect(dayIssues(withDay(sample, 2, { endBy: '16:00' }), 2).at(-1)).toMatchObject({ code: 'PAST_END_BY', args: ['2', '16:10', '16:00'] });
    expect(dayIssues(withDay(sample, 2, { endBy: '17:00' }), 2)).toEqual([]);
  });

  it('formats like the car', () => {
    expect(hhmm(-5)).toBe('전날');
    expect(hhmm(605)).toBe('10:05');
    expect(hhmm(1450)).toBe('00:10(+1)');
  });

  it('matches the committed parity fixtures (regenerate with npm run schema)', async () => {
    const want = JSON.parse(readFileSync(join(schema, 'fixtures/timeline-expectations.json'), 'utf8')) as Record<string, unknown[]>;
    const files = readdirSync(join(schema, 'fixtures/timeline')).map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(Object.keys(want).sort());
    for (const name of files) {
      const parsed = await parseTransfer(readFileSync(join(schema, `fixtures/timeline/${name}.json`), 'utf8'));
      if (!parsed.ok) throw new Error(`${name}: ${parsed.code}`);
      const trip = parsed.transfer.trip;
      const got = trip.days.map((d) => ({
        dayIndex: d.dayIndex,
        departure: departure(trip, d.dayIndex),
        stops: timeline(trip, d.dayIndex),
        dayEnd: dayEnd(trip, d.dayIndex),
        issues: dayIssues(trip, d.dayIndex).map(({ severity, code, dayIndex, args }) => ({ severity, code, dayIndex, args })),
      }));
      expect(got, name).toEqual(want[name]);
    }
  });
});

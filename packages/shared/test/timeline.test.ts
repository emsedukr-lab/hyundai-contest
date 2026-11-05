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
    expect(t.v5.arrive).toBe(minutes('11:25'));
    expect(t.v5.start).toBe(minutes('13:00'));
    expect(dayEnd(sample, 2)).toBe(minutes('16:30'));
  });

  it('reports unknown legs instead of guessing', () => {
    expect(departure(sample, 1)).toBe(minutes('08:00'));
    expect(timeline(sample, 1)[0].arrive).toBeNull();
    expect(dayIssues(sample, 1).map((i) => i.code)).toEqual(['LEG_UNKNOWN']);
  });

  it('flags being late for a fixed time with the expected arrival', () => {
    const late = withDay(sample, 4, { departTime: '09:45' });
    const issue = dayIssues(late, 4).find((i) => i.code === 'LATE_FOR_FIXED')!;
    expect(issue).toMatchObject({ severity: 'CONFLICT', visitId: 'v10', args: ['4', '정동심곡바다부채길', '10:00', '10:15'] });
  });

  it('checks the return-by time', () => {
    expect(dayIssues(withDay(sample, 2, { endBy: '16:00' }), 2).at(-1)).toMatchObject({ code: 'PAST_END_BY', args: ['2', '16:30', '16:00'] });
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

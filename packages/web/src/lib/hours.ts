import type { OpeningHours } from '@tteonaljido/shared';

type Entered = Extract<OpeningHours, { status: 'USER_ENTERED' }>;

/** Weekdays (1 = Monday) that are open at the same times, with those times in order. */
export interface HoursLine {
  days: number[];
  spans: Array<{ open: string; close: string }>;
}

const spansOf = (h: Entered, weekday: number) =>
  h.weekly.filter((w) => w.weekday === weekday).map(({ open, close }) => ({ open, close })).sort((a, b) => a.open.localeCompare(b.open));

/**
 * Weekly hours grouped for reading: weekdays that share the same times on one line, Monday first, and the weekdays with
 * no hours as closed. Two spans on a day are a break in between (07:00–16:00 · 17:00–19:30).
 */
export function hoursLines(h: Entered): { open: HoursLine[]; closed: number[] } {
  const open: HoursLine[] = [];
  const closed: number[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const spans = spansOf(h, weekday);
    if (spans.length === 0) {
      closed.push(weekday);
      continue;
    }
    const key = JSON.stringify(spans);
    const same = open.find((l) => JSON.stringify(l.spans) === key);
    if (same) same.days.push(weekday);
    else open.push({ days: [weekday], spans });
  }
  return { open, closed };
}

/** One open–close pair shared by every open weekday: what the two time fields and the weekday chips can edit. */
export const isSimpleHours = (h: Entered): boolean => {
  const { open } = hoursLines(h);
  return open.length === 1 && open[0].spans.length === 1;
};

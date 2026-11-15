import { epochDay } from '@tteonaljido/shared';
import { lang, t } from './i18n';

const WEEKDAY = lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar strings are formatted without time-zone conversion (they are already local to the trip). */
export function dateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return t('date.day', { month: lang === 'en' ? MONTH_EN[m - 1] : m, day: d, weekday });
}

export const periodLabel = (start: string, end: string) => (start === end ? dateLabel(start) : t('date.range', { start: dateLabel(start), end: dateLabel(end) }));

export const minutesLabel = (m: number) =>
  m < 60 ? t('duration.min', { m }) : m % 60 === 0 ? t('duration.hour', { h: m / 60 }) : t('duration.hourMin', { h: Math.floor(m / 60), m: m % 60 });

export const codeLabel = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** The local calendar date (YYYY-MM-DD) of a timestamp, for `dateLabel`. */
export const dayOf = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A compact day label for tabs: "11/16(월)" (Korean) or "Mon Nov 16". */
export function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return t('date.short', { month: lang === 'en' ? MONTH_EN[m - 1] : m, day: d, weekday });
}

/** 12-hour clock, but midnight reads 0 (오전 0:30), so it never looks like noon's 12:30 in the 오후 tab (M50). */
const clockHour = (h: number) => (h === 0 ? 0 : h % 12 || 12);

/** "오후 1:30" / "1:30 PM" for an "HH:MM" time — the same reading the time picker and the cards use. */
export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return t('time.label', { ampm: h < 12 ? t('time.am') : t('time.pm'), h: clockHour(h), m: String(m).padStart(2, '0') });
}

/**
 * The choices of a time picker (M47): every `step` minutes through the day (00:00 … 23:30 by default), plus the current
 * value when it is off that grid (an older typed 10:15 still shows and stays chosen).
 */
export function timeOptions(step = 30, current?: string | null): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  if (current && /^\d\d:\d\d$/.test(current) && !out.includes(current)) out.push(current), out.sort();
  return out;
}

export type DayPeriod = 'am' | 'pm';

/** 오전 (before noon) or 오후 for an "HH:MM" time. */
export const periodOf = (hhmm: string): DayPeriod => (Number(hhmm.slice(0, 2)) < 12 ? 'am' : 'pm');

/** Minutes after midnight → "HH:MM". */
const hhmmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * The chips of one tab of the time picker (M50): 오전 shows 06:00–11:30 (the dawn hours 00:00–05:30 only when `dawn`),
 * 오후 12:00–23:30, every `step` minutes. The current value is added when it is off that grid and in this tab, so an older
 * typed 10:15 still shows chosen.
 */
export function pickerTimes(period: DayPeriod, opts: { step?: number; dawn?: boolean; current?: string | null } = {}): string[] {
  const step = opts.step ?? 30;
  const from = period === 'pm' ? 12 * 60 : opts.dawn ? 0 : 6 * 60;
  const to = period === 'pm' ? 24 * 60 : 12 * 60;
  const out: string[] = [];
  for (let m = from; m < to; m += step) out.push(hhmmOf(m));
  const c = opts.current;
  if (c && /^\d\d:\d\d$/.test(c) && periodOf(c) === period && !out.includes(c)) {
    const inShown = period === 'pm' || opts.dawn || Number(c.slice(0, 2)) >= 6;
    if (inShown) out.push(c), out.sort();
  }
  return out;
}

/** The short chip text: "9:00", "12:30" (the tab already says 오전/오후). */
export const chipLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${clockHour(h)}:${String(m).padStart(2, '0')}`;
};

/**
 * "마지막 전송 11월 14일 (토)" for a trip row — and, when the trip was changed since (its revision moved on), that it
 * was. The version numbers themselves stay out of the lists (M66); the pairing page shows them where two versions meet.
 */
export const sentLabel = (sent: { revision: number; at: number }, currentRevision: number) =>
  t(sent.revision === currentRevision ? 'home.lastSend' : 'home.lastSendChanged', { date: dateLabel(dayOf(sent.at)) });

/** A useful neighbourhood/town label without the street number or building name. */
export function placeRegion(address: string): string {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  const street = parts.findIndex((p) => /(?:대로|로|길)$/.test(p) || /^\d/.test(p));
  const area = street < 0 ? parts : parts.slice(0, street);
  return area.find((p) => /[읍면동리]$/.test(p))
    ?? [...area].reverse().find((p) => /[시군구]$/.test(p))
    ?? parts.slice(0, 2).join(' ');
}

/** Weekdays and duration belong with the editable period, not the page title. */
export function tripPeriodLabel(start: string, end: string): string {
  const stamp = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return t('date.tripDay', { month: lang === 'en' ? MONTH_EN[m - 1] : m, day: d, weekday: WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] });
  };
  const days = epochDay(end) - epochDay(start) + 1;
  return t('date.tripPeriod', { start: stamp(start), end: stamp(end), nights: days - 1, days });
}

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

/** "오후 1:30" / "1:30 PM" for an "HH:MM" time — the same reading the time picker and the cards use. */
export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return t('time.label', { ampm: h < 12 ? t('time.am') : t('time.pm'), h: h % 12 || 12, m: String(m).padStart(2, '0') });
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

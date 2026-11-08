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

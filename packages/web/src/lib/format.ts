const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** Calendar strings are formatted without time-zone conversion (they are already local to the trip). */
export function dateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
}

export const periodLabel = (start: string, end: string) => (start === end ? dateLabel(start) : `${dateLabel(start)} ~ ${dateLabel(end)}`);

export const minutesLabel = (m: number) => (m < 60 ? `${m}분` : m % 60 === 0 ? `${m / 60}시간` : `${Math.floor(m / 60)}시간 ${m % 60}분`);

export const codeLabel = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

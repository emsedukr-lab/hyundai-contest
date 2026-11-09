import { useEffect, useRef } from 'react';
import { t } from '../lib/i18n';

/**
 * 일차 칩 바 (M45, Pleos Tabs · Box): 여행 정보 · 1일차 · 2일차 …, stuck under the top bar like the car app's day tabs.
 * The editor stays one continuous scroll (M30): a chip jumps to its section, and scrolling moves the selection (0 = 여행
 * 정보). The selected chip is graphite; the row scrolls sideways on long trips and keeps the selection in view.
 */
export function DayTabs({ days, active, onPick }: { days: number[]; active: number; onPick: (day: number) => void }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = row.current;
    const chip = r?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!r || !chip) return;
    const left = chip.offsetLeft - 20;
    const right = chip.offsetLeft + chip.offsetWidth + 20 - r.clientWidth;
    if (r.scrollLeft > left) r.scrollTo({ left, behavior: 'smooth' });
    else if (r.scrollLeft < right) r.scrollTo({ left: right, behavior: 'smooth' });
  }, [active]);
  const chip = (day: number, label: string) => (
    <button key={day} type="button" className="tl-daytab" aria-current={active === day ? 'true' : undefined} onClick={() => onPick(day)}>
      {label}
    </button>
  );
  return (
    <nav className="tl-daytabs" aria-label={t('tl.dayTabs')}>
      <div className="tl-daytabs-row" ref={row}>
        {chip(0, t('tl.basicsTitle'))}
        {days.map((d) => chip(d, t('common.day', { day: d })))}
      </div>
    </nav>
  );
}

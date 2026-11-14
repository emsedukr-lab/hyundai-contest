import { useEffect, useRef } from 'react';
import { t } from '../lib/i18n';

/**
 * 일차 탭 바 (Pleos `ivi_segmented_control/solid`): 전체 · 1일차 · 2일차 …, stuck under the top bar like the car
 * app's day tabs. The editor stays one continuous scroll (M30): a tab jumps to its section, and scrolling moves the
 * selection (0 = 여행 정보). The selected segment is the raised face of the bar (timeline.css); the segments scroll
 * sideways inside the bar on long trips and keep the selection in view.
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
        {chip(0, t('tl.dayAll'))}
        {days.map((d) => chip(d, t('common.day', { day: d })))}
      </div>
    </nav>
  );
}

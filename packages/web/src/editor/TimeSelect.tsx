import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { chipLabel, periodOf, pickerTimes, timeLabel, type DayPeriod } from '../lib/format';
import { t } from '../lib/i18n';
import { Sheet } from './Sheet';
import './timeSelect.css';

/**
 * 시각 선택 (과제 1 Option A): times are chosen, never typed — and never from a 48-row list. The field opens a small
 * sheet over the current one: [오전 | 오후], then the half hours as a 4-column grid of 44px chips. 오전 shows 06:00–11:30;
 * the dawn hours (0:00–5:30) open on request. A tap saves and closes. With no value yet, the suggested time (a stop's
 * suggestion is one hour after the stop before it, else 오전 9:00) is outlined and focused, and its half of the day is the
 * tab that opens. `clearable` adds [없음]. Same API as before, plus `suggest`.
 */
export function TimeSelect({
  label,
  value,
  onChange,
  step = 30,
  clearable = false,
  clearLabel = t('time.none'),
  placeholder,
  suggest,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (time: string | null) => void;
  step?: number;
  clearable?: boolean;
  clearLabel?: string;
  placeholder?: string;
  suggest?: string | null;
}) {
  const current = value ?? null;
  const suggested = suggest ?? '09:00';
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<DayPeriod>('am');
  const [dawn, setDawn] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    const focus = current ?? suggested;
    setPeriod(periodOf(focus));
    setDawn(Number(focus.slice(0, 2)) < 6);
    setOpen(true);
  };
  const pick = (time: string | null) => {
    onChange(time);
    setOpen(false);
  };
  // Opening (or switching tab) puts keyboard focus on the chosen chip, else the suggested one.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => grid.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(id);
  }, [open, period, dawn]);

  const times = pickerTimes(period, { step, dawn, current });
  const focusTime = current ?? suggested;

  return (
    <>
      <span className={`ts${current ? '' : ' is-empty'}`}>
        <button type="button" className="ts-field" aria-haspopup="dialog" aria-expanded={open} aria-label={current ? `${label} · ${current}` : label} onClick={openPicker}>
          <svg className="ts-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* The chosen time reads as on the day's cards — 24-hour "14:30"; the picker below keeps 오전/오후. */}
          <span className="ts-value">{current ?? placeholder ?? label}</span>
          <svg className="ts-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
      <Sheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={clearable ? <Button label={clearLabel} variant="secondary" size="lg" width="100%" onClick={() => pick(null)} /> : undefined}>
        <div className="tp">
          <SegmentedControl label={t('time.period')} value={period} onChange={(v) => setPeriod(v as DayPeriod)}>
            <SegmentedControlItem value="am" label={t('time.am')} />
            <SegmentedControlItem value="pm" label={t('time.pm')} />
          </SegmentedControl>
          {period === 'am' && (
            <button type="button" className="tl-textbtn tp-dawn" aria-expanded={dawn} onClick={() => setDawn((d) => !d)}>
              {dawn ? t('time.dawnHide') : t('time.dawnShow')}
            </button>
          )}
          <div className="tp-grid" ref={grid} role="group" aria-label={`${label} · ${period === 'am' ? t('time.am') : t('time.pm')}`}>
            {times.map((time) => {
              const on = time === current;
              const isSuggested = !current && time === suggested;
              return (
                <button
                  key={time}
                  type="button"
                  className={`tp-chip${on ? ' is-on' : ''}${isSuggested ? ' is-suggested' : ''}`}
                  aria-pressed={on}
                  aria-label={timeLabel(time)}
                  data-focus={time === focusTime ? 'true' : undefined}
                  onClick={() => pick(time)}>
                  {chipLabel(time)}
                </button>
              );
            })}
          </div>
          {!current && <p className="tp-hint">{t('time.suggested', { time: timeLabel(suggested) })}</p>}
        </div>
      </Sheet>
    </>
  );
}

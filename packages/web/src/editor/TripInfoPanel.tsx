import { useId, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Calendar, type DateRange } from '@astryxdesign/core/Calendar';
import type { Home, Trip } from '@tteonaljido/shared';
import { BedIcon, CalendarIcon, CloseIcon } from '../components/shell/icons';
import { shortDate, tripPeriodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { defaultTripName, setPeriod } from '../lib/trips';
import { TripEndpoints } from './TripEndpoints';
import { LodgingField } from './LodgingField';
import { useNotes } from './NotesContext';
import { Sheet } from './Sheet';
import './timeline.css';

/** Basics and collected places share the first setup page; lodging is selected afterwards. */
export function TripInfoPanel({ plan, home, onChange, onOpenSettings, showRequired = true, section = 'all', showEndpoints = true }: {
  plan: Trip;
  home: Home | null;
  onChange: (p: Trip) => void;
  onOpenSettings: () => void;
  showRequired?: boolean;
  section?: 'all' | 'basics' | 'lodging';
  showEndpoints?: boolean;
}) {
  const { lodgingTbd } = useNotes();
  const nameId = useId();
  const periodId = useId();
  const [error, setError] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [left, setLeft] = useState<number[]>([]);
  const nights = plan.days.slice(0, -1);
  const period = tripPeriodLabel(plan.startDate, plan.endDate);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <ToastNotice status="error" title={error} onDismiss={() => setError(null)} />}
      {section !== 'lodging' && <>
        <div className="tn-pad">
          <div className="tl-infocard">
            <label htmlFor={nameId} className="tl-kicker">{t('editor.name')}</label>
            <div className="ti-name-control">
              <input id={nameId} className="tl-name-input" placeholder={defaultTripName(plan)} value={plan.name} maxLength={60} onChange={(e) => onChange({ ...plan, name: e.target.value.slice(0, 60) })} />
              {plan.name && <button type="button" className="tn-iconbtn" aria-label={t('setup.clearName')} onClick={() => { onChange({ ...plan, name: '' }); document.getElementById(nameId)?.focus(); }}><CloseIcon /></button>}
            </div>
            <label htmlFor={periodId} className="tl-kicker">{t('editor.period')}</label>
            <button id={periodId} type="button" className="ti-period-button" aria-haspopup="dialog" aria-expanded={periodOpen} aria-label={`${t('editor.period')} · ${plan.startDate}–${plan.endDate} · ${period}`} onClick={() => setPeriodOpen(true)}>
              <CalendarIcon /><span>{period}</span>
            </button>
          </div>
        </div>
        {showEndpoints && <div className="tn-pad">
          <div className="tl-infocard">
            <h3 className="tl-sheet-section">{t('setup.endpoints')}</h3>
            <TripEndpoints plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
          </div>
        </div>}
        <Sheet isOpen={periodOpen} onClose={() => setPeriodOpen(false)} title={t('editor.period')}>
          <Calendar mode="range" value={{ start: plan.startDate, end: plan.endDate } as DateRange} maxRangeSpan={14} numberOfMonths={1} onChange={(range) => {
            try { onChange(setPeriod(plan, range.start, range.end)); setError(null); setPeriodOpen(false); }
            catch (e) { setError((e as Error).message); }
          }} />
        </Sheet>
      </>}
      {section !== 'basics' && <div className="tl">
        {nights.map((d, i) => {
          // No lodging yet, and not marked 미정: the toss input-error look (red 1.5px border, red helper line) — in a new
          // trip only once the field was left empty or 다음 was tried; before that the same line is a neutral hint.
          const open = !d.lodgingPlaceRef && !lodgingTbd.includes(d.dayIndex);
          const required = open && (showRequired || left.includes(d.dayIndex));
          return (
          <div className={`tl-row${i === 0 ? ' is-first' : ''}${i === nights.length - 1 ? ' is-last' : ''}`} key={d.dayIndex}>
            <div className="tl-rail">
              <span className={`tl-marker${required ? ' is-required' : ''}`} aria-hidden="true">
                <BedIcon />
              </span>
            </div>
            <div className={`tl-card${required ? ' is-required' : ''}`}>
              <div className="tl-card-body">
                <span className="tl-kicker">{`${t('tl.nightLodging', { day: d.dayIndex })} · ${shortDate(d.date)}`}</span>
                <LodgingField
                  plan={plan}
                  dayIndex={d.dayIndex}
                  onChange={onChange}
                  // the same hotel several nights in a row: its times and memo once, on the first night
                  showNotes={!d.lodgingPlaceRef || nights[i - 1]?.lodgingPlaceRef !== d.lodgingPlaceRef}
                  isError={required}
                  onLeave={() => setLeft((cur) => (cur.includes(d.dayIndex) ? cur : [...cur, d.dayIndex]))}
                />
              </div>
            </div>
          </div>
          );
        })}
      </div>}
    </div>
  );
}

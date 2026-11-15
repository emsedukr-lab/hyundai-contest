import { useId, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Calendar, type DateRange } from '@astryxdesign/core/Calendar';
import type { Home, Trip } from '@tteonaljido/shared';
import { BedIcon, CalendarIcon, CloseIcon, FlagIcon, PinIcon } from '../components/shell/icons';
import { shortDate, tripPeriodLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { defaultTripName, setEndBy, setPeriod } from '../lib/trips';
import { EndpointField } from './EndpointField';
import { LodgingField } from './LodgingField';
import { useNotes } from './NotesContext';
import { Sheet } from './Sheet';
import { TimeSelect } from './TimeSelect';
import './timeline.css';

/** Basics and collected places share the first setup page; lodging is selected afterwards. */
export function TripInfoPanel({ plan, home, onChange, onOpenSettings, showRequired = true, section = 'all' }: {
  plan: Trip;
  home: Home | null;
  onChange: (p: Trip) => void;
  onOpenSettings: () => void;
  showRequired?: boolean;
  section?: 'all' | 'basics' | 'lodging';
}) {
  const { lodgingTbd } = useNotes();
  const nameId = useId();
  const periodId = useId();
  const [error, setError] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [left, setLeft] = useState<number[]>([]);
  const nights = plan.days.slice(0, -1);
  const lastDay = plan.days[plan.days.length - 1];
  const first = plan.firstDay;
  const period = tripPeriodLabel(plan.startDate, plan.endDate);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div className="tn-pad"><Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} /></div>}
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
        <div className="tn-pad">
          <div className="tl-infocard ti-endpoints">
            <h3 className="tl-sheet-section">{t('setup.endpoints')}</h3>
            <div className="ti-endpoint-row">
              <span className="ti-endpoint-icon is-start" aria-hidden="true"><PinIcon /></span>
              <div className="ti-endpoint-field">
                <span className="tl-kicker">{t('editor.startPlace')}</span>
                <EndpointField which="origin" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
              </div>
              <div className="ti-endpoint-field ti-endpoint-time">
                <span className="tl-kicker">{first.basis === 'DEPART_ORIGIN' ? t('setup.departTimeShort') : t('editor.arriveTime')}</span>
                <TimeSelect label={first.basis === 'DEPART_ORIGIN' ? t('setup.departTime') : t('editor.arriveTime')} value={first.basis === 'DEPART_ORIGIN' ? first.departTime : first.arriveTime} clearable={first.basis === 'DEPART_ORIGIN'} placeholder={t('time.none')} onChange={(time) => {
                  if (first.basis === 'ARRIVE_FIRST_STOP') { if (time) onChange({ ...plan, firstDay: { ...first, arriveTime: time } }); }
                  else onChange({ ...plan, firstDay: { ...first, departTime: time } });
                }} />
              </div>
            </div>
            <div className="ti-endpoint-row">
              <span className="ti-endpoint-icon" aria-hidden="true"><FlagIcon /></span>
              <div className="ti-endpoint-field">
                <span className="tl-kicker">{t('tl.endPlace')}</span>
                <EndpointField which="finalDestination" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
              </div>
              <div className="ti-endpoint-field ti-endpoint-time">
                <span className="tl-kicker">{t('setup.returnTimeShort')}</span>
                <TimeSelect label={t('setup.returnTime')} value={lastDay.endBy} clearable clearLabel={t('time.undecided')} placeholder={t('time.undecided')} suggest="18:00" onChange={(time) => onChange(setEndBy(plan, lastDay.dayIndex, time))} />
              </div>
            </div>
          </div>
        </div>
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
          <div className="tl-row" key={d.dayIndex}>
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

import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { BedIcon, FlagIcon } from '../components/shell/icons';
import { shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { setPeriod } from '../lib/trips';
import { EndpointField } from './EndpointField';
import { LodgingField } from './LodgingField';
import './timeline.css';

type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

/**
 * 여행 정보 — the editor page's first section, styled like the day timelines below it. A header card holds the trip's
 * name (large, typed in place) and its dates; then the trip's frame on the same dashed rail: 출발 → each night's
 * lodging → 귀가, each a grey card with a small kicker. Everything is edited right here (no popup).
 */
export function TripInfoPanel({ plan, home, onChange, onOpenSettings }: { plan: Trip; home: Home | null; onChange: (p: Trip) => void; onOpenSettings: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const nights = plan.days.slice(0, -1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <div className="tn-pad">
          <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />
        </div>
      )}
      <div className="tn-pad">
        <div className="tl-infocard">
          <input
            className="tl-name-input"
            aria-label={t('editor.name')}
            placeholder={t('editor.name')}
            value={plan.name}
            maxLength={60}
            onChange={(e) => onChange({ ...plan, name: e.target.value.slice(0, 60) })}
          />
          <DateRangeInput
            label={t('editor.period')}
            isLabelHidden
            value={{ start: plan.startDate, end: plan.endDate } as Range}
            maxRangeSpan={14}
            hasClear={false}
            onChange={(r) => {
              if (!r) return;
              try {
                onChange(setPeriod(plan, r.start, r.end));
                setError(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </div>
      </div>

      <div className="tl">
        <div className="tl-row is-first">
          <div className="tl-rail">
            <span className="tl-marker is-accent" aria-hidden="true" />
          </div>
          <div className="tl-card">
            <div className="tl-card-body">
              <span className="tl-kicker">{t('tl.start')}</span>
              <EndpointField which="origin" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
            </div>
          </div>
        </div>
        {nights.map((d, i) => (
          <div className="tl-row" key={d.dayIndex}>
            <div className="tl-rail">
              <span className={`tl-marker${d.lodgingPlaceRef ? '' : ' is-warn'}`} aria-hidden="true">
                <BedIcon />
              </span>
            </div>
            <div className={`tl-card${d.lodgingPlaceRef ? '' : ' is-warn'}`}>
              <div className="tl-card-body">
                <span className="tl-kicker">{`${t('tl.nightLodging', { day: d.dayIndex })} · ${shortDate(d.date)}`}</span>
                <LodgingField
                  plan={plan}
                  dayIndex={d.dayIndex}
                  onChange={onChange}
                  // the same hotel several nights in a row: its times and memo once, on the first night
                  showNotes={!d.lodgingPlaceRef || nights[i - 1]?.lodgingPlaceRef !== d.lodgingPlaceRef}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="tl-row is-last">
          <div className="tl-rail">
            <span className="tl-marker" aria-hidden="true">
              <FlagIcon />
            </span>
          </div>
          <div className="tl-card">
            <div className="tl-card-body">
              <span className="tl-kicker">{t('tl.home')}</span>
              <EndpointField which="finalDestination" compact plan={plan} home={home} onChange={onChange} onOpenSettings={onOpenSettings} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

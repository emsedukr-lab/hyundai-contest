import { useEffect, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import type { Home, Trip } from '@tteonaljido/shared';
import { BedIcon, FlagIcon } from '../components/shell/icons';
import { shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { setPeriod } from '../lib/trips';
import { EndpointField } from './EndpointField';
import { LodgingField } from './LodgingField';
import { useNotes } from './NotesContext';
import './timeline.css';

type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

/**
 * 여행 정보 — the editor page's first section, styled like the day timelines below it. A header card holds the trip's
 * name (large, typed in place) and its dates; then the trip's frame on the same dashed rail: 출발 → each night's
 * lodging → 귀가, each a grey card with a small kicker. Everything is edited right here (no popup).
 *
 * `isNew` (the setup's first step, M66): the name field takes the focus on entry, and a night without lodging is not
 * an error yet — it shows a neutral hint until that night's field was left empty or 다음 was tried (`showRequired`).
 * In the editor of an existing trip a missing lodging is a real gap and shows as one from the start.
 */
export function TripInfoPanel({
  plan,
  home,
  onChange,
  onOpenSettings,
  isNew = false,
  showRequired = true,
}: {
  plan: Trip;
  home: Home | null;
  onChange: (p: Trip) => void;
  onOpenSettings: () => void;
  isNew?: boolean;
  showRequired?: boolean;
}) {
  const { lodgingTbd } = useNotes();
  const [error, setError] = useState<string | null>(null);
  /** Nights whose lodging field was visited and left empty. */
  const [left, setLeft] = useState<number[]>([]);
  const nights = plan.days.slice(0, -1);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isNew && !plan.name) nameRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
            ref={nameRef}
            className="tl-name-input"
            aria-label={t('editor.name')}
            placeholder={t('editor.name')}
            value={plan.name}
            maxLength={60}
            onChange={(e) => onChange({ ...plan, name: e.target.value.slice(0, 60) })}
          />
          {/* The whole 48px field opens the calendar (M66): the trigger's hit area is stretched over the field (timeline.css). */}
          <DateRangeInput
            label={t('editor.period')}
            isLabelHidden
            controlClassName="tl-datefield"
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

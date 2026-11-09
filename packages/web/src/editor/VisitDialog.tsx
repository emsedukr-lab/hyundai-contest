import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { DateInput } from '@astryxdesign/core/DateInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Switch } from '@astryxdesign/core/Switch';
import { Token } from '@astryxdesign/core/Token';
import { useEffect, useState, type ReactNode } from 'react';
import type { OpeningHours, Place, Trip, Visit } from '@tteonaljido/shared';
import { dateLabel, minutesLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { REASON_LABEL, changeCategory, moveToDay, removePlace, updatePlace, updateVisit } from '../lib/trips';
import { LodgingNoteFields, PlaceMemoField } from './NotesContext';
import { CATEGORY_LABEL, CATEGORY_OPTIONS } from './PlaceSearch';
import { Sheet } from './Sheet';
import './visitSheet.css';
import { TimeSelect } from './TimeSelect';

const WEEKDAYS = ['visit.weekday.1', 'visit.weekday.2', 'visit.weekday.3', 'visit.weekday.4', 'visit.weekday.5', 'visit.weekday.6', 'visit.weekday.7'] as const;
const ALL_DAYS = ['1', '2', '3', '4', '5', '6', '7'];
const STAY_PRESETS = [30, 60, 90, 120, 180];
const STAY_STEP = 15;
const STAY_MAX = 720;
/** A fixed time sits on the half hour (the car's slots). */
const toHalfHour = (time: string) => time.replace(/:(\d\d)$/, (_, m) => (Number(m) < 30 ? ':00' : ':30'));

type TimeMode = 'free' | 'desired' | 'fixed';

/** One labelled block of the sheet: a small title, then its controls. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="vd-group">
      <h3 className="vd-group-title">{title}</h3>
      {children}
    </section>
  );
}

/** A labelled row: the label on the left, the control taking the rest. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vd-row">
      <span className="vd-label">{label}</span>
      <div className="vd-control">{children}</div>
    </div>
  );
}

/**
 * 장소 상세 (M46): one place and its visit, as a bottom sheet like the editor's other sheets — grouped and labelled
 * instead of a dozen unlabelled fields in a centred dialog.
 *   일정 — the day (M40: places start on the whole trip and get a day here or from 경로 추천), the arrival time as one
 *          choice (자유 / 희망 / 고정 — the desired and fixed times used to be two inputs showing the same time), and the
 *          flexibility that goes with it.
 *   머무는 시간 — in hours and minutes with presets and ±15, not a raw minute count.
 *   중요도 · 메모 · 영업시간 (Kakao Map link, or typed hours) · 장소 정보 (type, the 보관함 reason) last, as they change least.
 * Edits apply live; 장소 삭제 asks once. Choosing 전체 일정 takes a stop off its day (the keyboard way to swipe it off).
 */
export function VisitDialog({
  plan,
  placeRef,
  onChange,
  onUnassign,
  onError,
  onClose,
}: {
  plan: Trip;
  placeRef: string | null;
  onChange: (p: Trip) => void;
  onUnassign: (visitId: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  // Hooks first, before any early return (rules of hooks); each opened place starts without a pending delete.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickDate, setPickDate] = useState<ISODateString | undefined>(undefined);
  // The last arrival time while the sheet is open, so 고정 → 자유 → 고정 comes back to the same time.
  const [lastTime, setLastTime] = useState<string | null>(null);
  useEffect(() => {
    setConfirmDelete(false);
    setPickDate(undefined);
    setLastTime(null);
  }, [placeRef]);
  const place = plan.places.find((p) => p.placeRef === placeRef);
  const visit = plan.visits.find((v) => v.placeRef === placeRef);
  if (!place) return null;

  const onDay = visit ? plan.days.find((d) => d.visitOrder.includes(visit.visitId))?.dayIndex ?? null : null;
  const setDay = (v: string) => {
    if (!visit) return;
    if (v === 'all') return onDay !== null && onUnassign(visit.visitId); // back to the whole trip, with 되돌리기
    try {
      onChange(moveToDay(plan, visit.visitId, Number(v))); // to the end of that day
    } catch (e) {
      onError((e as Error).message); // e.g. the day already has the most stops a day can hold
    }
  };
  // Kakao's local API has no opening hours; a place found through Kakao links to its Kakao Map page, which shows them.
  const kakaoPage = place.source.provider === 'KAKAO' && place.source.externalId && /^\d+$/.test(place.source.externalId) ? `https://place.map.kakao.com/${place.source.externalId}` : null;
  const setVisit = (patch: Partial<Visit>) => visit && onChange(updateVisit(plan, visit.visitId, patch));
  const setPlace = (patch: Partial<Place>) => onChange(updatePlace(plan, place.placeRef, patch));

  // Arrival time as one choice. Switching carries the time over (a fixed time snaps to the half hour) and clears the
  // other kind, so the car never gets a desired and a fixed time that disagree.
  const mode: TimeMode = visit?.fixed ? 'fixed' : visit?.desiredTime ? 'desired' : 'free';
  const shownTime = visit?.fixed?.time ?? visit?.desiredTime ?? null;
  const setMode = (next: TimeMode) => {
    if (!visit || next === mode) return;
    if (shownTime) setLastTime(shownTime);
    const base = shownTime ?? lastTime ?? '12:00';
    if (next === 'free') setVisit({ desiredTime: null, fixed: null });
    else if (next === 'desired') setVisit({ desiredTime: base, fixed: null });
    else setVisit({ fixed: { time: toHalfHour(base), kind: 'USER' }, desiredTime: null, timeFlexible: false });
  };
  const setTime = (time: string | null) => {
    if (!visit || !time) return;
    if (mode === 'fixed') setVisit({ fixed: { ...visit.fixed!, time: toHalfHour(time) } });
    else setVisit({ desiredTime: time });
  };
  const setStay = (m: number) => setVisit({ stayMinutes: Math.max(0, Math.min(STAY_MAX, Math.round(m))) });

  const hours = place.hours;
  const daily = hours.status === 'USER_ENTERED' ? hours.weekly[0] : null;
  const closedDates = hours.status === 'USER_ENTERED' ? hours.closedDates : [];
  // Keeps the weekly hours; only the closed-date list changes (deduped, sorted, capped as the schema allows).
  const setClosedDates = (dates: string[]) => hours.status === 'USER_ENTERED' && setPlace({ hours: { ...hours, closedDates: [...new Set(dates)].sort().slice(0, 31) } });
  // One opening time for every open weekday; days left unticked are closed (the car flags a visit on them).
  const openDays = hours.status === 'USER_ENTERED' ? hours.weekly.map((w) => String(w.weekday)) : ALL_DAYS;
  const setHours = (open: string, close: string, days: string[]) => {
    const weekly = days.map(Number).sort((a, b) => a - b).map((weekday) => ({ weekday, open, close }));
    setPlace({ hours: { status: 'USER_ENTERED', weekly, closedDates: hours.status === 'USER_ENTERED' ? hours.closedDates : [] } as OpeningHours });
  };
  const setDaily = (open: string, close: string) => setHours(open, close, openDays);
  const toggleDay = (day: string) => {
    if (!daily) return;
    const next = openDays.includes(day) ? openDays.filter((d) => d !== day) : [...openDays, day];
    if (next.length > 0) setHours(daily.open, daily.close, next); // at least one open day
  };

  const footer = confirmDelete ? (
    <div className="vd-foot">
      <p className="vd-confirm">{visit?.fixed ? t('visit.delete.confirmFixed', { time: visit.fixed.time }) : t('visit.delete.confirm')}</p>
      <div className="vd-foot-row">
        <Button label={t('common.cancel')} variant="secondary" size="lg" onClick={() => setConfirmDelete(false)} />
        <Button
          label={t('visit.delete')}
          variant="destructive"
          size="lg"
          width="100%"
          onClick={() => {
            onChange(removePlace(plan, place.placeRef));
            onClose();
          }}
        />
      </div>
    </div>
  ) : (
    <div className="vd-foot-row">
      {/* A quiet first step: red only on the confirm, so the rare delete doesn't shout on every place. */}
      <Button label={t('visit.delete')} variant="secondary" size="lg" onClick={() => setConfirmDelete(true)} />
      <Button label={t('common.close')} variant="primary" size="lg" width="100%" onClick={onClose} />
    </div>
  );

  return (
    <Sheet isOpen={!!placeRef} onClose={onClose} title={place.name} height="tall" footer={footer}>
      <div className="vd">
        <div className="vd-head">
          <p className="vd-sub">{[CATEGORY_LABEL[place.category], place.address].filter(Boolean).join(' · ')}</p>
          {kakaoPage && (
            <a className="tl-extlink vd-kakao" href={kakaoPage} target="_blank" rel="noopener noreferrer">
              {t('tl.openKakaoHours')}
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>

        {visit && (
          <Group title={t('visit.section.schedule')}>
            <Row label={t('visit.day')}>
              <Selector
                label={t('visit.day')}
                isLabelHidden
                placement="below"
                options={[{ value: 'all', label: t('visit.dayAll') }, ...plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))]}
                value={onDay === null ? 'all' : String(onDay)}
                onChange={setDay}
              />
            </Row>
            <Row label={t('visit.timeMode')}>
              <SegmentedControl label={t('visit.timeMode')} value={mode} onChange={(v) => setMode(v as TimeMode)}>
                <SegmentedControlItem value="free" label={t('visit.timeMode.free')} />
                <SegmentedControlItem value="desired" label={t('visit.timeMode.desired')} />
                <SegmentedControlItem value="fixed" label={t('visit.timeMode.fixed')} />
              </SegmentedControl>
            </Row>
            {mode !== 'free' && (
              <Row label="">
                <div className="vd-time">
                  <TimeSelect label={mode === 'fixed' ? t('visit.fixedTime') : t('visit.desiredTime')} value={shownTime} onChange={setTime} />
                  {mode === 'fixed' && (
                    <button
                      type="button"
                      className={`tl-chip${visit.fixed?.kind === 'RESERVATION' ? ' is-on' : ''}`}
                      aria-pressed={visit.fixed?.kind === 'RESERVATION'}
                      onClick={() => setVisit({ fixed: { ...visit.fixed!, kind: visit.fixed?.kind === 'RESERVATION' ? 'USER' : 'RESERVATION' } })}>
                      {t('visit.fixedKind.reservation')}
                    </button>
                  )}
                </div>
              </Row>
            )}
            <p className="vd-hint">{mode === 'fixed' ? t('visit.fixed.detail') : mode === 'desired' ? t('visit.timeMode.desiredHint') : t('visit.timeMode.freeHint')}</p>
            <div className="vd-switches">
              <Switch label={t('visit.dateFlexible')} labelPosition="start" labelSpacing="spread" value={visit.dateFlexible} onChange={(v) => setVisit({ dateFlexible: v })} />
              {mode !== 'fixed' && <Switch label={t('visit.timeFlexible')} labelPosition="start" labelSpacing="spread" value={visit.timeFlexible} onChange={(v) => setVisit({ timeFlexible: v })} />}
            </div>
          </Group>
        )}

        {visit && (
          <Group title={t('visit.stayTitle')}>
            <div className="vd-stay">
              <span className="vd-stay-value" aria-live="polite">
                {minutesLabel(visit.stayMinutes)}
              </span>
              <div className="vd-stepper">
                <button type="button" className="vd-step" aria-label={t('visit.stayLess')} disabled={visit.stayMinutes <= 0} onClick={() => setStay(visit.stayMinutes - STAY_STEP)}>
                  −
                </button>
                <button type="button" className="vd-step" aria-label={t('visit.stayMore')} disabled={visit.stayMinutes >= STAY_MAX} onClick={() => setStay(visit.stayMinutes + STAY_STEP)}>
                  +
                </button>
              </div>
            </div>
            <div className="vd-chips" role="group" aria-label={t('visit.stayTitle')}>
              {STAY_PRESETS.map((m) => (
                <button key={m} type="button" className={`tl-chip${visit.stayMinutes === m ? ' is-on' : ''}`} aria-pressed={visit.stayMinutes === m} onClick={() => setStay(m)}>
                  {minutesLabel(m)}
                </button>
              ))}
            </div>
          </Group>
        )}

        {visit && (
          <Group title={t('visit.importance')}>
            <SegmentedControl label={t('visit.importance')} value={visit.importance} onChange={(v) => setVisit({ importance: v as Visit['importance'] })}>
              <SegmentedControlItem value="MUST" label={t('common.must')} />
              <SegmentedControlItem value="NORMAL" label={t('visit.importance.normal')} />
              <SegmentedControlItem value="OPTIONAL" label={t('visit.importance.optional')} />
            </SegmentedControl>
          </Group>
        )}

        {/* Phone-only notes: lodging gets check-in/out and a memo, any other place a memo. */}
        <Group title={t('tl.memo')}>{place.category === 'LODGING' ? <LodgingNoteFields placeRef={place.placeRef} /> : <PlaceMemoField placeRef={place.placeRef} />}</Group>

        <Group title={t('visit.hoursTitle')}>
          <Switch
            label={t('visit.hours')}
            labelPosition="start"
            labelSpacing="spread"
            value={hours.status === 'USER_ENTERED'}
            onChange={(on) => (on ? setDaily('09:00', '21:00') : setPlace({ hours: { status: 'UNKNOWN' } }))}
          />
          {!daily && <p className="vd-hint">{t('visit.hours.detail')}</p>}
          {daily && (
            <>
              <div className="vd-pair">
                <TimeSelect label={t('visit.opens')} value={daily.open} onChange={(v) => v && setDaily(v, daily.close)} />
                <span className="vd-dash" aria-hidden="true">
                  –
                </span>
                <TimeSelect label={t('visit.closes')} value={daily.close} onChange={(v) => v && setDaily(daily.open, v)} />
              </div>
              <div className="vd-days" role="group" aria-label={t('visit.openDays')}>
                {WEEKDAYS.map((key, i) => (
                  <button key={key} type="button" className={`tl-chip vd-day${openDays.includes(ALL_DAYS[i]) ? ' is-on' : ''}`} aria-pressed={openDays.includes(ALL_DAYS[i])} onClick={() => toggleDay(ALL_DAYS[i])}>
                    {t(key)}
                  </button>
                ))}
              </div>
              <p className="vd-hint">{t('visit.openDays.detail')}</p>
              <DateInput
                label={t('visit.closedDates')}
                isLabelHidden
                placeholder={t('visit.closedDates')}
                value={pickDate}
                min={plan.startDate as ISODateString}
                max={plan.endDate as ISODateString}
                hasClear
                onChange={(v) => {
                  if (v && closedDates.length < 31) setClosedDates([...closedDates, v]);
                  setPickDate(undefined);
                }}
              />
              {closedDates.length > 0 && (
                <div className="vd-chips">
                  {closedDates.map((d) => (
                    <Token key={d} label={dateLabel(d)} onRemove={() => setClosedDates(closedDates.filter((x) => x !== d))} />
                  ))}
                </div>
              )}
            </>
          )}
        </Group>

        <Group title={t('visit.section.place')}>
          <Row label={t('common.type')}>
            <Selector label={t('common.type')} isLabelHidden placement="above" options={CATEGORY_OPTIONS} value={place.category} onChange={(v) => onChange(changeCategory(plan, place.placeRef, v as Place['category']))} />
          </Row>
          {visit && visit.unassignedReason !== null && (
            // On no day yet (보관함): why, as the car shows it.
            <Row label={t('editor.unassigned.reason')}>
              <Selector
                label={t('editor.unassigned.reason')}
                isLabelHidden
                placement="above"
                options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))}
                value={visit.unassignedReason}
                onChange={(r) => setVisit({ unassignedReason: r as Visit['unassignedReason'] })}
              />
            </Row>
          )}
        </Group>
      </div>
    </Sheet>
  );
}

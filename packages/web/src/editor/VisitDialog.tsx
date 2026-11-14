import { Button } from '@astryxdesign/core/Button';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { DateInput } from '@astryxdesign/core/DateInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Token } from '@astryxdesign/core/Token';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OpeningHours, Place, Trip, Visit } from '@tteonaljido/shared';
import { dateLabel, minutesLabel, shortDate } from '../lib/format';
import { hoursLines, isSimpleHours } from '../lib/hours';
import { t } from '../lib/i18n';
import { REASON_LABEL, changeCategory, moveToDay, removePlace, suggestVisitTime, updatePlace, updateVisit } from '../lib/trips';
import { MEAL_CHOICES, isMealChoice, mealChoiceLabel, mealRange, mealTimes, slotOf } from '../lib/meals';
import { LodgingNoteFields, PlaceMemoField, useNotes } from './NotesContext';
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

/**
 * A block that changes least, folded to one row (M66): its title and the current value ("영업시간 · 모름"), opening in
 * place. Astryx Collapsible carries the button, aria-expanded and the chevron.
 */
function Fold({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <section className="vd-fold">
      <Collapsible
        defaultIsOpen={false}
        trigger={
          <span className="vd-fold-row">
            <span className="vd-fold-title">{title}</span>
            <span className="vd-fold-value">{value}</span>
          </span>
        }>
        <div className="vd-fold-body">{children}</div>
      </Collapsible>
    </section>
  );
}

/**
 * 세그먼트 (M69): every single choice in the sheet is an Astryx SegmentedControl (track fill-weak, the chosen cell on the
 * surface with shadow-1 and primary text at 600 — shell.css) of one height (48), inside a sideways scroller so a long
 * row (the trip's days, the stay presets on a 320 phone) scrolls instead of wrapping or truncating. The chosen cell is
 * kept in view. A value that matches no item (a stay that is not a preset) leaves every cell unchosen.
 */
function Segments({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { value: string; label: string }[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const sc = scroller.current;
      const on = sc?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      if (!sc || !on || sc.scrollWidth <= sc.clientWidth) return;
      const box = sc.getBoundingClientRect();
      const cell = on.getBoundingClientRect();
      sc.scrollLeft += cell.left - box.left - (box.width - cell.width) / 2; // centred, clamped by the browser
    });
    return () => window.cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="vd-seg" ref={scroller}>
      <SegmentedControl label={label} value={value} onChange={onChange}>
        {items.map((i) => (
          <SegmentedControlItem key={i.value} value={i.value} label={i.label} />
        ))}
      </SegmentedControl>
    </div>
  );
}

/** A labelled row: the label on the left, the control taking the rest (the label above it on a phone under 380). */
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
 *   중요도 · 메모 · 영업시간 (Kakao Map link, or typed hours) · 장소 정보 (type, why it is on no day) change least: each is
 *   one folded row showing its current value (M66), so the sheet opens on the two things people come to set.
 * Edits apply live, so the one button is 완료; 장소 삭제 is a quiet text button at the end of the sheet and asks once (the
 * confirm carries the negative fill). Choosing 전체 일정 takes a stop off its day (the keyboard way to swipe it off).
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
  const { notes, setNote } = useNotes();
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
    const base = shownTime ?? lastTime ?? suggestVisitTime(plan, visit.visitId); // M50: an hour after the stop before
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
  // Hours with a break or times that differ by weekday (as a sample or an imported place may have) are shown as read:
  // the two time fields and the weekday chips below can only hold one pair of times for every open day.
  const grouped = hours.status === 'USER_ENTERED' && !isSimpleHours(hours) ? hoursLines(hours) : null;
  const daysLabel = (days: number[]) => (days.length === 7 ? t('visit.hours.everyDay') : days.map((d) => t(WEEKDAYS[d - 1])).join('·'));
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

  // One-line values for the folded rows.
  const note = notes[place.placeRef];
  const memoValue =
    [place.category === 'LODGING' && note?.checkIn ? t('tl.checkInAt', { time: note.checkIn }) : '', place.category === 'LODGING' && note?.checkOut ? t('tl.checkOutAt', { time: note.checkOut }) : '', note?.memo?.split('\n')[0] ?? '']
      .filter(Boolean)
      .join(' · ') || t('visit.fold.none');
  const hoursValue =
    hours.status === 'UNKNOWN' ? t('visit.hours.unknown')
    : hours.status === 'ALWAYS_OPEN' ? t('visit.hours.none')
    : daily && !grouped ? `${openDays.length === 7 ? t('visit.hours.everyDay') : daysLabel(openDays.map(Number))} ${daily.open}–${daily.close}`
    : t('visit.hours.enter');
  const importanceValue = visit?.importance === 'MUST' ? t('common.mustAria') : visit?.importance === 'OPTIONAL' ? t('visit.importance.optional') : t('visit.importance.normal');

  const flexItems = [
    { value: 'no', label: t('visit.flex.keep') },
    { value: 'yes', label: t('visit.flex.change') },
  ];

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
    <Button label={t('tl.done')} variant="primary" size="lg" width="100%" onClick={onClose} />
  );

  return (
    <Sheet isOpen={!!placeRef} onClose={onClose} title={place.name} footer={footer}>
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
              <Segments
                label={t('visit.day')}
                value={onDay === null ? 'all' : String(onDay)}
                onChange={setDay}
                items={[{ value: 'all', label: t('visit.dayAllShort') }, ...plan.days.map((d) => ({ value: String(d.dayIndex), label: t('common.day', { day: d.dayIndex }) }))]}
              />
              {/* The chosen day's date under the control (the cells carry only 1일차 · 2일차 …). */}
              <p className="vd-caption" aria-live="polite">
                {onDay === null ? t('visit.dayNone') : shortDate(plan.days.find((d) => d.dayIndex === onDay)!.date)}
              </p>
            </Row>
            <Row label={t('visit.timeMode')}>
              <Segments
                label={t('visit.timeMode')}
                value={mode}
                onChange={(v) => setMode(v as TimeMode)}
                items={[
                  { value: 'free', label: t('visit.timeMode.free') },
                  { value: 'desired', label: t('visit.timeMode.desired') },
                  { value: 'fixed', label: t('visit.timeMode.fixed') },
                ]}
              />
            </Row>
            {mode !== 'free' && (
              <Row label="">
                <div className="vd-time">
                  <TimeSelect label={mode === 'fixed' ? t('visit.fixedTime') : t('visit.desiredTime')} value={shownTime} suggest={suggestVisitTime(plan, visit.visitId)} onChange={setTime} />
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
            {/* 식사 (M67): a restaurant's meal, for the route recommendation; the hint names the time it is held to. */}
            {place.category === 'FOOD' && (
              <>
                <Row label={t('meal.title')}>
                  <Segments
                    label={t('meal.title')}
                    value={note?.meal ?? 'auto'}
                    onChange={(v) => setNote(place.placeRef, { meal: isMealChoice(v) ? v : null })}
                    items={[{ value: 'auto', label: t('meal.auto') }, ...MEAL_CHOICES.map((m) => ({ value: m, label: mealChoiceLabel(m) }))]}
                  />
                </Row>
                <p className="vd-hint">{note?.meal ? t('meal.hint', { meal: mealChoiceLabel(note.meal), range: mealRange(mealTimes(), slotOf(note.meal)) }) : t('meal.autoHint')}</p>
              </>
            )}
            {/* 날짜 · 시간 바꿔도 됨 (the visit's dateFlexible / timeFlexible): 그대로 | 바꿔도 돼요. A fixed time cannot move. */}
            <Row label={t('visit.flex.date')}>
              <Segments label={t('visit.dateFlexible')} value={visit.dateFlexible ? 'yes' : 'no'} onChange={(v) => setVisit({ dateFlexible: v === 'yes' })} items={flexItems} />
            </Row>
            {mode !== 'fixed' && (
              <Row label={t('visit.flex.time')}>
                <Segments label={t('visit.timeFlexible')} value={visit.timeFlexible ? 'yes' : 'no'} onChange={(v) => setVisit({ timeFlexible: v === 'yes' })} items={flexItems} />
              </Row>
            )}
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
            <Segments
              label={t('visit.stayTitle')}
              value={STAY_PRESETS.includes(visit.stayMinutes) ? String(visit.stayMinutes) : ''}
              onChange={(v) => setStay(Number(v))}
              items={STAY_PRESETS.map((m) => ({ value: String(m), label: minutesLabel(m) }))}
            />
          </Group>
        )}

        {visit && (
          <Fold title={t('visit.importance')} value={importanceValue}>
            <Segments
              label={t('visit.importance')}
              value={visit.importance}
              onChange={(v) => setVisit({ importance: v as Visit['importance'] })}
              items={[
                { value: 'MUST', label: t('common.must') },
                { value: 'NORMAL', label: t('visit.importance.normal') },
                { value: 'OPTIONAL', label: t('visit.importance.optional') },
              ]}
            />
          </Fold>
        )}

        {/* Phone-only notes: lodging gets check-in/out and a memo, any other place a memo. */}
        <Fold title={t('tl.memo')} value={memoValue}>
          {place.category === 'LODGING' ? <LodgingNoteFields placeRef={place.placeRef} /> : <PlaceMemoField placeRef={place.placeRef} />}
        </Fold>

        <Fold title={t('visit.hoursTitle')} value={hoursValue}>
          {/* 모름 · 따로 없음 (a lake, a beach, a street: nothing to check) · 직접 입력 */}
          <Segments
            label={t('visit.hoursTitle')}
            value={hours.status}
            onChange={(v) => {
              if (v === hours.status) return;
              if (v === 'USER_ENTERED') setDaily('09:00', '21:00');
              else setPlace({ hours: { status: v === 'ALWAYS_OPEN' ? 'ALWAYS_OPEN' : 'UNKNOWN' } });
            }}
            items={[
              { value: 'UNKNOWN', label: t('visit.hours.unknown') },
              { value: 'ALWAYS_OPEN', label: t('visit.hours.none') },
              { value: 'USER_ENTERED', label: t('visit.hours.enter') },
            ]}
          />
          {hours.status === 'UNKNOWN' && <p className="vd-hint">{t('visit.hours.detail')}</p>}
          {hours.status === 'ALWAYS_OPEN' && <p className="vd-hint">{t('visit.hours.noneDetail')}</p>}
          {daily && grouped && (
            <>
              <ul className="vd-hours">
                {grouped.open.map((l) => (
                  <li key={l.days.join('')}>
                    <span className="vd-hours-days">{daysLabel(l.days)}</span>
                    <span>{l.spans.map((x) => `${x.open}–${x.close}`).join(' · ')}</span>
                  </li>
                ))}
                {grouped.closed.length > 0 && (
                  <li>
                    <span className="vd-hours-days">{daysLabel(grouped.closed)}</span>
                    <span>{t('visit.hours.closed')}</span>
                  </li>
                )}
              </ul>
              <p className="vd-hint">{t('visit.hours.grouped')}</p>
            </>
          )}
          {daily && !grouped && (
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
            </>
          )}
          {daily && (
            <>
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
        </Fold>

        <Fold title={t('visit.section.place')} value={CATEGORY_LABEL[place.category]}>
          <Row label={t('common.type')}>
            <Segments
              label={t('common.type')}
              items={CATEGORY_OPTIONS}
              value={place.category}
              onChange={(v) => {
                onChange(changeCategory(plan, place.placeRef, v as Place['category']));
                if (v !== 'FOOD' && note?.meal) setNote(place.placeRef, { meal: null }); // a meal belongs to a restaurant only
              }}
            />
          </Row>
          {visit && visit.unassignedReason !== null && (
            // On no day yet (담아 둔 곳): why, as the car shows it.
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
        </Fold>

        {/* The rare, destructive action: last in the scroll and quiet. Its confirm takes over the footer. */}
        {!confirmDelete && (
          <button type="button" className="tl-textbtn vd-delete" onClick={() => setConfirmDelete(true)}>
            {t('visit.delete')}
          </button>
        )}
      </div>
    </Sheet>
  );
}

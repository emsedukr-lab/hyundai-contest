import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { Token } from '@astryxdesign/core/Token';
import { useEffect, useState } from 'react';
import type { OpeningHours, Place, Trip, Visit } from '@tteonaljido/shared';
import { dateLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { FieldPrefix } from './FieldPrefix';
import { LodgingNoteFields, PlaceMemoField } from './NotesContext';
import { REASON_LABEL, changeCategory, moveToDay, removePlace, updatePlace, updateVisit } from '../lib/trips';
import { CATEGORY_OPTIONS } from './PlaceSearch';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
const iso = (s: string | null | undefined) => (s ?? undefined) as ISOTime;
const hhmm = (v: ISOTime) => (v ? String(v).slice(0, 5) : null);
const WEEKDAYS = ['visit.weekday.1', 'visit.weekday.2', 'visit.weekday.3', 'visit.weekday.4', 'visit.weekday.5', 'visit.weekday.6', 'visit.weekday.7'] as const;
const ALL_DAYS = ['1', '2', '3', '4', '5', '6', '7'];

/**
 * Edits one place and its visit attributes: its day (M40 — places start on the whole trip and get a day only here, or
 * with 경로 추천), stay, importance, desired/fixed time, flexibility and hours. Choosing 전체 일정 takes a stop off its
 * day, the keyboard and screen-reader way to do what swiping the card does.
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
  useEffect(() => {
    setConfirmDelete(false);
    setPickDate(undefined);
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

  return (
    <Dialog isOpen={!!placeRef} onOpenChange={(o) => !o && onClose()} width={520}>
      <DialogHeader title={place.name} subtitle={place.address} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <FormLayout>
          <Selector label={t('common.type')} isLabelHidden placement="below" options={CATEGORY_OPTIONS} value={place.category} onChange={(v) => onChange(changeCategory(plan, place.placeRef, v as Place['category']))} />
          {visit && (
            <Selector
              label={t('visit.day')}
              isLabelHidden
              placement="below"
              options={[{ value: 'all', label: t('visit.dayAll') }, ...plan.days.map((d) => ({ value: String(d.dayIndex), label: `${t('common.day', { day: d.dayIndex })} · ${shortDate(d.date)}` }))]}
              value={onDay === null ? 'all' : String(onDay)}
              onChange={setDay}
            />
          )}
          {/* Phone-only notes: lodging gets check-in/out and a memo, any other place a memo. */}
          {place.category === 'LODGING' ? <LodgingNoteFields placeRef={place.placeRef} /> : <PlaceMemoField placeRef={place.placeRef} />}
          {visit && visit.unassignedReason !== null && (
            // On no day yet (보관함): why, as the car shows it.
            <Selector
              label={t('editor.unassigned.reason')}
              isLabelHidden
              placement="below"
              options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))}
              value={visit.unassignedReason}
              onChange={(r) => setVisit({ unassignedReason: r as Visit['unassignedReason'] })}
            />
          )}
          {visit ? (
            <>
              <NumberInput label={t('visit.stay')} isLabelHidden startIcon={<span className="tl-infield">{t('visit.stay')}</span>} value={visit.stayMinutes} onChange={(v) => setVisit({ stayMinutes: Math.max(0, Math.min(720, Math.round(v))) })} step={15} isIntegerOnly />
              <SegmentedControl label={t('visit.importance')} value={visit.importance} onChange={(v) => setVisit({ importance: v as Visit['importance'] })}>
                <SegmentedControlItem value="MUST" label={t('common.must')} />
                <SegmentedControlItem value="NORMAL" label={t('visit.importance.normal')} />
                <SegmentedControlItem value="OPTIONAL" label={t('visit.importance.optional')} />
              </SegmentedControl>
              <FieldPrefix prefix={visit.desiredTime ? t('visit.desiredTime') : null}>
                <TimeInput label={t('visit.desiredTime')} isLabelHidden placeholder={t('visit.desiredTime')} value={iso(visit.desiredTime)} onChange={(v) => setVisit({ desiredTime: hhmm(v) })} hasClear />
              </FieldPrefix>
              <Switch
                label={t('visit.fixed')}
                value={!!visit.fixed}
                onChange={(on) => setVisit(on ? { fixed: { time: visit.desiredTime?.replace(/:(\d\d)$/, (_, m) => (Number(m) < 30 ? ':00' : ':30')) ?? '12:00', kind: 'USER' }, timeFlexible: false } : { fixed: null })}
              />
              {visit.fixed && (
                <HStack gap={2}>
                  <TimeInput label={t('visit.fixedTime')} isLabelHidden value={iso(visit.fixed.time)} increment={30} onChange={(v) => v && setVisit({ fixed: { ...visit.fixed!, time: hhmm(v)! } })} />
                  <Selector
                    label={t('common.type')}
                    isLabelHidden
                    placement="below"
                    options={[
                      { value: 'RESERVATION', label: t('visit.fixedKind.reservation') },
                      { value: 'USER', label: t('visit.fixedKind.user') },
                    ]}
                    value={visit.fixed.kind}
                    onChange={(v) => setVisit({ fixed: { ...visit.fixed!, kind: v as 'RESERVATION' | 'USER' } })}
                  />
                </HStack>
              )}
              <Switch label={t('visit.dateFlexible')} value={visit.dateFlexible} onChange={(v) => setVisit({ dateFlexible: v })} />
              <Switch label={t('visit.timeFlexible')} value={visit.timeFlexible} isDisabled={!!visit.fixed} onChange={(v) => setVisit({ timeFlexible: v })} />
            </>
          ) : null}
          {kakaoPage && (
            <a className="tl-extlink" href={kakaoPage} target="_blank" rel="noopener noreferrer">
              {t('tl.openKakaoHours')}
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <Switch
            label={t('visit.hours')}
            value={hours.status === 'USER_ENTERED'}
            onChange={(on) => (on ? setDaily('09:00', '21:00') : setPlace({ hours: { status: 'UNKNOWN' } }))}
          />
          {daily && (
            <HStack gap={2}>
              <TimeInput label={t('visit.opens')} isLabelHidden value={iso(daily.open)} increment={30} onChange={(v) => v && setDaily(hhmm(v)!, daily.close)} />
              <TimeInput label={t('visit.closes')} isLabelHidden value={iso(daily.close)} increment={30} onChange={(v) => v && setDaily(daily.open, hhmm(v)!)} />
            </HStack>
          )}
          {daily && (
            <CheckboxList label={t('visit.openDays')} isLabelHidden value={openDays} onChange={(days) => days.length > 0 && setHours(daily.open, daily.close, days)}>
              {WEEKDAYS.map((key, i) => (
                <CheckboxListItem key={key} value={ALL_DAYS[i]} label={t(key)} />
              ))}
            </CheckboxList>
          )}
          {daily && (
            <VStack gap={2}>
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
                <HStack gap={1} wrap="wrap">
                  {closedDates.map((d) => (
                    <Token key={d} label={dateLabel(d)} onRemove={() => setClosedDates(closedDates.filter((x) => x !== d))} />
                  ))}
                </HStack>
              )}
            </VStack>
          )}
        </FormLayout>
        {confirmDelete ? (
          <VStack gap={2}>
            <Text type="supporting" color="secondary">
              {visit?.fixed ? t('visit.delete.confirmFixed', { time: visit.fixed.time }) : t('visit.delete.confirm')}
            </Text>
            <HStack gap={2} hAlign="between">
              <Button
                label={t('visit.delete')}
                variant="destructive"
                onClick={() => {
                  onChange(removePlace(plan, place.placeRef));
                  onClose();
                }}
              />
              <Button label={t('common.cancel')} variant="secondary" onClick={() => setConfirmDelete(false)} />
            </HStack>
          </VStack>
        ) : (
          <HStack gap={2} hAlign="between">
            {/* A quiet first step: red only on the confirm below, so the rare delete doesn't shout on every place. */}
            <Button label={t('visit.delete')} variant="ghost" onClick={() => setConfirmDelete(true)} />
            <Button label={t('common.close')} variant="primary" onClick={onClose} />
          </HStack>
        )}
      </VStack>
    </Dialog>
  );
}

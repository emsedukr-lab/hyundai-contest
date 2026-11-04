import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { OpeningHours, Place, Trip, Visit } from '@tteonaljido/shared';
import { removePlace, updatePlace, updateVisit } from '../lib/trips';
import { CATEGORY_OPTIONS } from './PlaceSearch';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
const t = (s: string | null | undefined) => (s ?? undefined) as ISOTime;
const hhmm = (v: ISOTime) => (v ? String(v).slice(0, 5) : null);

/** Edits one place and its visit attributes (stay, importance, desired/fixed time, flexibility, hours). */
export function VisitDialog({ plan, placeRef, onChange, onClose }: { plan: Trip; placeRef: string | null; onChange: (p: Trip) => void; onClose: () => void }) {
  const place = plan.places.find((p) => p.placeRef === placeRef);
  const visit = plan.visits.find((v) => v.placeRef === placeRef);
  if (!place) return null;
  const setVisit = (patch: Partial<Visit>) => visit && onChange(updateVisit(plan, visit.visitId, patch));
  const setPlace = (patch: Partial<Place>) => onChange(updatePlace(plan, place.placeRef, patch));
  const hours = place.hours;
  const daily = hours.status === 'USER_ENTERED' ? hours.weekly[0] : null;
  const setDaily = (open: string, close: string) => {
    const weekly = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open, close }));
    setPlace({ hours: { status: 'USER_ENTERED', weekly, closedDates: hours.status === 'USER_ENTERED' ? hours.closedDates : [] } as OpeningHours });
  };

  return (
    <Dialog isOpen={!!placeRef} onOpenChange={(o) => !o && onClose()} width={520}>
      <DialogHeader title={place.name} subtitle={place.address} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <FormLayout>
          <Selector label="종류" options={CATEGORY_OPTIONS} value={place.category} onChange={(v) => setPlace({ category: v as Place['category'] })} />
          {visit ? (
            <>
              <NumberInput label="머무는 시간(분)" value={visit.stayMinutes} onChange={(v) => setVisit({ stayMinutes: Math.max(0, Math.min(720, Math.round(v))) })} step={15} isIntegerOnly />
              <NumberInput label="주차·입장 준비(분)" value={visit.prepMinutes} onChange={(v) => setVisit({ prepMinutes: Math.max(0, Math.min(120, Math.round(v))) })} step={5} isIntegerOnly />
              <SegmentedControl label="중요도" value={visit.importance} onChange={(v) => setVisit({ importance: v as Visit['importance'] })}>
                <SegmentedControlItem value="MUST" label="꼭" />
                <SegmentedControlItem value="NORMAL" label="보통" />
                <SegmentedControlItem value="OPTIONAL" label="여유 있으면" />
              </SegmentedControl>
              <TimeInput label="희망 도착 시각" value={t(visit.desiredTime)} onChange={(v) => setVisit({ desiredTime: hhmm(v) })} hasClear isOptional />
              <Switch
                label="시각 고정 (예약 등)"
                description="30분 단위. 고정 일정은 차량에서도 옮기지 않아요"
                value={!!visit.fixed}
                onChange={(on) => setVisit(on ? { fixed: { time: visit.desiredTime?.replace(/:(\d\d)$/, (_, m) => (Number(m) < 30 ? ':00' : ':30')) ?? '12:00', kind: 'USER' }, timeFlexible: false } : { fixed: null })}
              />
              {visit.fixed && (
                <HStack gap={2}>
                  <TimeInput label="고정 시각" value={t(visit.fixed.time)} increment={30} onChange={(v) => v && setVisit({ fixed: { ...visit.fixed!, time: hhmm(v)! } })} />
                  <Selector
                    label="종류"
                    options={[
                      { value: 'RESERVATION', label: '예약' },
                      { value: 'USER', label: '직접 정함' },
                    ]}
                    value={visit.fixed.kind}
                    onChange={(v) => setVisit({ fixed: { ...visit.fixed!, kind: v as 'RESERVATION' | 'USER' } })}
                  />
                </HStack>
              )}
              <Switch label="날짜 바꿔도 됨" value={visit.dateFlexible} onChange={(v) => setVisit({ dateFlexible: v })} />
              <Switch label="시간 바꿔도 됨" value={visit.timeFlexible} isDisabled={!!visit.fixed} onChange={(v) => setVisit({ timeFlexible: v })} />
            </>
          ) : (
            <Text type="supporting" color="secondary">
              숙소는 일차별 '묵을 곳'으로 지정해요.
            </Text>
          )}
          <Switch
            label="영업시간 직접 입력"
            description="입력하지 않으면 차량에 '영업정보 미확인'으로 표시돼요"
            value={hours.status === 'USER_ENTERED'}
            onChange={(on) => (on ? setDaily('09:00', '21:00') : setPlace({ hours: { status: 'UNKNOWN' } }))}
          />
          {daily && (
            <HStack gap={2}>
              <TimeInput label="여는 시각" value={t(daily.open)} increment={30} onChange={(v) => v && setDaily(hhmm(v)!, daily.close)} />
              <TimeInput label="닫는 시각" value={t(daily.close)} increment={30} onChange={(v) => v && setDaily(daily.open, hhmm(v)!)} />
            </HStack>
          )}
        </FormLayout>
        <HStack gap={2} hAlign="between">
          <Button
            label="장소 삭제"
            variant="destructive"
            onClick={() => {
              onChange(removePlace(plan, place.placeRef));
              onClose();
            }}
          />
          <Button label="닫기" variant="primary" onClick={onClose} />
        </HStack>
      </VStack>
    </Dialog>
  );
}

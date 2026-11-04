import { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Endpoint, Trip } from '@tteonaljido/shared';
import { dateLabel, minutesLabel } from '../lib/format';
import { assign, lodgingPlaces, move, placeOf, setDepart, setLeg, setLodging, unassign, unassignedVisits, visitOf } from '../lib/trips';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];

const endpointName = (plan: Trip, e: Endpoint) => (e.kind === 'HOME' ? '집' : (placeOf(plan, e.placeRef)?.name ?? '장소'));

/** Per-day order, travel times, departure and lodging. Edits never move fixed visits on their own. */
export function DaysSection({ plan, onChange, onOpenPlace, onError }: { plan: Trip; onChange: (p: Trip) => void; onOpenPlace: (ref: string) => void; onError: (m: string) => void }) {
  const [tab, setTab] = useState('1');
  const day = plan.days.find((d) => String(d.dayIndex) === tab) ?? plan.days[0];
  const i = day.dayIndex - 1;
  const isLast = i === plan.days.length - 1;
  const start = i === 0 ? endpointName(plan, plan.origin) : (placeOf(plan, plan.days[i - 1].lodgingPlaceRef ?? '')?.name ?? '전날 숙소 (미정)');
  const end = isLast ? endpointName(plan, plan.finalDestination) : (placeOf(plan, day.lodgingPlaceRef ?? '')?.name ?? '숙소 (미정)');
  const pool = unassignedVisits(plan);
  const safe = (f: () => Trip) => {
    try {
      onChange(f());
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const leg = (k: number) => (
    <HStack gap={2} vAlign="center" key={`leg${k}`}>
      <Text type="supporting" color="secondary">
        ↓ 이동
      </Text>
      <NumberInput
        label={`${k}번 구간 이동 시간(분)`}
        isLabelHidden
        value={day.legs[k]?.minutes ?? null}
        placeholder="미입력"
        onChange={(v: number | null) => safe(() => setLeg(plan, day.dayIndex, k, v === null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1440, Math.round(v)))))}
        hasClear
        isIntegerOnly
        width={120}
      />
      <Text type="supporting" color="secondary">
        {day.legs[k] ? minutesLabel(day.legs[k]!.minutes) : '확인 필요'}
      </Text>
    </HStack>
  );

  return (
    <VStack gap={3}>
      <Heading level={2}>일차별 일정</Heading>
      <TabList value={String(day.dayIndex)} onChange={setTab} hasDivider>
        {plan.days.map((d) => (
          <Tab key={d.dayIndex} value={String(d.dayIndex)} label={`${d.dayIndex}일차`} />
        ))}
      </TabList>
      <Text type="supporting" color="secondary">
        {dateLabel(day.date)}
      </Text>
      {i === 0 ? (
        <Text type="supporting">{plan.firstDay.basis === 'DEPART_ORIGIN' ? `${start}에서 ${plan.firstDay.departTime} 출발` : `${start}에서 출발 · 첫 장소 ${plan.firstDay.arriveTime} 도착 기준`}</Text>
      ) : (
        <TimeInput label={`${start}에서 출발`} value={(day.departTime ?? undefined) as ISOTime} increment={30} hasClear onChange={(v) => safe(() => setDepart(plan, day.dayIndex, v ? String(v).slice(0, 5) : null))} />
      )}
      <VStack gap={2}>
        {day.visitOrder.length === 0 && <Text color="secondary">아직 넣은 장소가 없어요</Text>}
        {day.visitOrder.flatMap((id, k) => {
          const v = visitOf(plan, id)!;
          const p = placeOf(plan, v.placeRef)!;
          return [
            leg(k),
            <Card key={id} padding={3}>
              <HStack gap={2} vAlign="center">
                <StackItem size="fill">
                  <VStack gap={0.5}>
                    <HStack gap={1} vAlign="center" wrap="wrap">
                      <Text type="label">{`${k + 1}. ${p.name}`}</Text>
                      {v.fixed && <Badge variant="info" label={`고정 ${v.fixed.time}`} />}
                      {v.importance === 'MUST' && <Badge variant="warning" label="꼭" />}
                    </HStack>
                    <Text type="supporting" color="secondary">
                      {`머무는 시간 ${minutesLabel(v.stayMinutes)}${v.desiredTime ? ` · 희망 ${v.desiredTime}` : ''}`}
                    </Text>
                  </VStack>
                </StackItem>
                <Button label="위로" size="sm" variant="ghost" isDisabled={k === 0} onClick={() => safe(() => move(plan, day.dayIndex, k, -1))} />
                <Button label="아래로" size="sm" variant="ghost" isDisabled={k === day.visitOrder.length - 1} onClick={() => safe(() => move(plan, day.dayIndex, k, 1))} />
                <Button label="상세" size="sm" variant="ghost" onClick={() => onOpenPlace(p.placeRef)} />
                <Button label="빼기" size="sm" variant="ghost" onClick={() => safe(() => unassign(plan, id))} />
              </HStack>
            </Card>,
          ];
        })}
        {leg(day.visitOrder.length)}
        <Text type="label">{isLast ? `귀가: ${end}` : `묵을 곳: ${end}`}</Text>
      </VStack>
      {pool.length > 0 && (
        <Selector
          label={`${day.dayIndex}일차에 장소 넣기`}
          placeholder="배정 안 된 장소에서 고르기"
          options={pool.map((v) => ({ value: v.visitId, label: placeOf(plan, v.placeRef)?.name ?? v.visitId }))}
          value=""
          onChange={(id) => safe(() => assign(plan, id, day.dayIndex))}
        />
      )}
      {!isLast && (
        <Selector
          label={`${day.dayIndex}일차 밤 숙소`}
          placeholder={lodgingPlaces(plan).length ? '숙소 고르기' : "먼저 '숙소' 종류의 장소를 추가해 주세요"}
          options={[{ value: '', label: '미정' }, ...lodgingPlaces(plan).map((p) => ({ value: p.placeRef, label: p.name }))]}
          value={day.lodgingPlaceRef ?? ''}
          onChange={(ref) => safe(() => setLodging(plan, day.dayIndex, ref || null))}
          description="다음 날은 이 숙소에서 출발해요. 같은 숙소를 여러 날 고를 수 있어요."
        />
      )}
    </VStack>
  );
}

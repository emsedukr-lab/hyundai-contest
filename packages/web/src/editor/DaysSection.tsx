import { useMemo, useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { dayEnd, dayIssues, hhmm, timeline, type Endpoint, type Home, type Trip } from '@tteonaljido/shared';
import { dateLabel, minutesLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { assign, issueText, lodgingPlaces, move, moveTo, placeOf, setDepart, setEndBy, setLeg, setLodging, unassign, unassignedVisits, visitOf } from '../lib/trips';
import { RouteSketch } from './RouteSketch';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];

const endpointName = (plan: Trip, e: Endpoint) => (e.kind === 'HOME' ? t('common.home') : (placeOf(plan, e.placeRef)?.name ?? t('common.place')));

/** Wraps a stop card so it can be dragged to reorder (a top-right handle; up/down buttons remain as a fallback). */
function SortableStop({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' }}>
      <button
        type="button"
        aria-label={t('days.drag')}
        {...attributes}
        {...listeners}
        style={{ position: 'absolute', top: 10, right: 10, cursor: 'grab', border: 'none', background: 'transparent', color: 'inherit', fontSize: 18, lineHeight: 1, padding: 4, touchAction: 'none', zIndex: 1 }}>
        ⠿
      </button>
      {children}
    </div>
  );
}

/** Per-day order, travel times, departure and lodging. Edits never move fixed visits on their own. */
export function DaysSection({ plan, home, onChange, onOpenPlace, onError }: { plan: Trip; home: Home | null; onChange: (p: Trip) => void; onOpenPlace: (ref: string) => void; onError: (m: string) => void }) {
  const [tab, setTab] = useState('1');
  const [showSketch, setShowSketch] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const day = plan.days.find((d) => String(d.dayIndex) === tab) ?? plan.days[0];
  const i = day.dayIndex - 1;
  const isLast = i === plan.days.length - 1;
  const start = i === 0 ? endpointName(plan, plan.origin) : (placeOf(plan, plan.days[i - 1].lodgingPlaceRef ?? '')?.name ?? t('days.prevLodgingUnset'));
  const end = isLast ? endpointName(plan, plan.finalDestination) : (placeOf(plan, day.lodgingPlaceRef ?? '')?.name ?? t('days.lodgingUnset'));
  const pool = unassignedVisits(plan);
  // The same timetable the car re-checks on arrival, shown while editing.
  const times = useMemo(() => Object.fromEntries(timeline(plan, day.dayIndex).map((st) => [st.visitId, st])), [plan, day.dayIndex]);
  const conflicts = useMemo(() => dayIssues(plan, day.dayIndex).filter((x) => x.severity === 'CONFLICT'), [plan, day.dayIndex]);
  const endAt = dayEnd(plan, day.dayIndex);
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));
  const timeLine = (id: string) => {
    const st = times[id];
    if (!st || st.start === null) return t('days.timeCheck');
    return st.arrive === null ? t('days.timeStart', { start: clock(st.start) }) : t('days.times', { arrive: clock(st.arrive), start: clock(st.start) });
  };
  const safe = (f: () => Trip) => {
    try {
      onChange(f());
    } catch (e) {
      onError((e as Error).message);
    }
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = day.visitOrder.indexOf(String(active.id));
    const to = day.visitOrder.indexOf(String(over.id));
    if (from >= 0 && to >= 0) safe(() => moveTo(plan, day.dayIndex, from, to));
  };

  const leg = (k: number) => (
    <HStack gap={2} vAlign="center" key={`leg${k}`}>
      <Text type="supporting" color="secondary">
        {t('days.travel')}
      </Text>
      <NumberInput
        label={t('days.legLabel', { k })}
        isLabelHidden
        value={day.legs[k]?.minutes ?? null}
        placeholder={t('days.legEmpty')}
        onChange={(v: number | null) => safe(() => setLeg(plan, day.dayIndex, k, v === null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1440, Math.round(v)))))}
        hasClear
        isIntegerOnly
        width={120}
      />
      <Text type="supporting" color="secondary">
        {day.legs[k] ? minutesLabel(day.legs[k]!.minutes) : t('days.needsCheck')}
      </Text>
    </HStack>
  );

  return (
    <VStack gap={3}>
      <Heading level={2}>{t('days.title')}</Heading>
      <TabList value={String(day.dayIndex)} onChange={setTab} hasDivider>
        {plan.days.map((d) => (
          <Tab key={d.dayIndex} value={String(d.dayIndex)} label={t('common.day', { day: d.dayIndex })} />
        ))}
      </TabList>
      <Text type="supporting" color="secondary">
        {dateLabel(day.date)}
      </Text>
      {conflicts.map((x, n) => (
        <Banner key={`${x.code}${n}`} status="error" title={issueText(x)} />
      ))}
      {i === 0 ? (
        <Text type="supporting">{plan.firstDay.basis === 'DEPART_ORIGIN' ? t('days.departAt', { start, time: plan.firstDay.departTime }) : t('days.departArrive', { start, time: plan.firstDay.arriveTime })}</Text>
      ) : (
        <TimeInput label={t('days.departFrom', { start })} value={(day.departTime ?? undefined) as ISOTime} increment={30} hasClear onChange={(v) => safe(() => setDepart(plan, day.dayIndex, v ? String(v).slice(0, 5) : null))} />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={day.visitOrder} strategy={verticalListSortingStrategy}>
      <VStack gap={2}>
        {day.visitOrder.length === 0 && <Text color="secondary">{t('days.empty')}</Text>}
        {day.visitOrder.flatMap((id, k) => {
          const v = visitOf(plan, id)!;
          const p = placeOf(plan, v.placeRef)!;
          return [
            leg(k),
            <SortableStop key={id} id={id}>
            <Card padding={3}>
              <VStack gap={1}>
                <HStack gap={1} vAlign="center" wrap="wrap">
                  <Text type="label">{`${k + 1}. ${p.name}`}</Text>
                  {v.fixed && <Badge variant="info" label={t('common.fixedAt', { time: v.fixed.time })} />}
                  {v.importance === 'MUST' && <Badge variant="warning" label={t('common.must')} />}
                  {!v.fixed && !v.timeFlexible && <Badge variant="neutral" label={t('days.timeFirm')} />}
                  {!v.dateFlexible && <Badge variant="neutral" label={t('days.dateFirm')} />}
                  {conflicts.some((x) => x.visitId === id) && <Badge variant="error" label={t('days.conflict')} />}
                </HStack>
                <Text type="supporting">{timeLine(id)}</Text>
                <Text type="supporting" color="secondary">
                  {`${t('days.stay', { duration: minutesLabel(v.stayMinutes) })}${v.desiredTime ? ` · ${t('days.desired', { time: v.desiredTime })}` : ''}`}
                </Text>
                <HStack gap={1} wrap="wrap">
                  <Button label={t('days.up')} size="sm" variant="ghost" isDisabled={k === 0} onClick={() => safe(() => move(plan, day.dayIndex, k, -1))} />
                  <Button label={t('days.down')} size="sm" variant="ghost" isDisabled={k === day.visitOrder.length - 1} onClick={() => safe(() => move(plan, day.dayIndex, k, 1))} />
                  <Button label={t('days.details')} size="sm" variant="ghost" onClick={() => onOpenPlace(p.placeRef)} />
                  <Button label={t('days.remove')} size="sm" variant="ghost" onClick={() => safe(() => unassign(plan, id))} />
                </HStack>
              </VStack>
            </Card>
            </SortableStop>,
          ];
        })}
        {leg(day.visitOrder.length)}
        <Text type="label">{`${isLast ? t('days.endHome', { end }) : t('days.endLodging', { end })}${endAt !== null ? ` · ${t('days.dayEnd', { time: clock(endAt) })}` : ''}`}</Text>
        <TimeInput
          label={t('days.endBy', { end })}
          description={t('days.endBy.detail')}
          value={(day.endBy ?? undefined) as ISOTime}
          increment={30}
          hasClear
          isOptional
          onChange={(v) => safe(() => setEndBy(plan, day.dayIndex, v ? String(v).slice(0, 5) : null))}
        />
      </VStack>
      </SortableContext>
      </DndContext>
      <VStack gap={2}>
        <Button label={showSketch ? t('sketch.hide') : t('sketch.title')} size="sm" variant="ghost" onClick={() => setShowSketch((v) => !v)} />
        {showSketch && <RouteSketch plan={plan} home={home} dayIndex={day.dayIndex} />}
      </VStack>
      {pool.length > 0 && (
        <Selector
          label={t('days.addPlace', { day: day.dayIndex })}
          placeholder={t('days.addPlace.placeholder')}
          options={pool.map((v) => ({ value: v.visitId, label: placeOf(plan, v.placeRef)?.name ?? v.visitId }))}
          value=""
          onChange={(id) => safe(() => assign(plan, id, day.dayIndex))}
        />
      )}
      {!isLast && (
        <Selector
          label={t('days.lodging', { day: day.dayIndex })}
          placeholder={lodgingPlaces(plan).length ? t('days.lodging.placeholder') : t('days.lodging.none')}
          options={[{ value: '', label: t('days.lodging.unset') }, ...lodgingPlaces(plan).map((p) => ({ value: p.placeRef, label: p.name }))]}
          value={day.lodgingPlaceRef ?? ''}
          onChange={(ref) => safe(() => setLodging(plan, day.dayIndex, ref || null))}
          description={t('days.lodging.detail')}
        />
      )}
    </VStack>
  );
}

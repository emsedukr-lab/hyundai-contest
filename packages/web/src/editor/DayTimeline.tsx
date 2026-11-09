import { useMemo } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { dayEnd, hhmm, timeline, type DayIssue, type Home, type Trip } from '@tteonaljido/shared';
import { BedIcon, FlagIcon, GripIcon, MoreIcon } from '../components/shell/icons';
import { minutesLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { issueText, move, moveTo, nodeIssues, placeOf, unassign, visitOf } from '../lib/trips';
import { dayEnds, legEnds } from './dayInfo';
import { useNotes } from './NotesContext';
import './timeline.css';

interface Props {
  plan: Trip;
  home: Home | null;
  dayIndex: number;
  onChange: (p: Trip) => void;
  onError: (m: string) => void;
  onOpenPlace: (ref: string) => void;
  onOpenStart: () => void;
  onOpenLeg: (k: number) => void;
  onOpenEnd: () => void;
}

/**
 * One day as a vertical route: 출발 → (이동 → 장소)… → 이동 → 숙소 (or 귀가 on the last day); places are added with the
 * editor's floating + button. Every
 * problem shows on the node it is about — a tinted card edge and one line of text — instead of a list at the bottom.
 * Stops reorder by their handle (pointer or keyboard) or the ⋯ menu; fixed visits never move on their own.
 */
export function DayTimeline({ plan, home, dayIndex, onChange, onError, onOpenPlace, onOpenStart, onOpenLeg, onOpenEnd }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { day, i, isFirst, isLast, startName, endName } = dayEnds(plan, dayIndex);
  const { notes } = useNotes();
  // Phone-only notes shown in grey: the night's lodging (check-in/out, memo) and, on the next morning, its check-out.
  const lodgingNote = !isLast && day.lodgingPlaceRef ? notes[day.lodgingPlaceRef] : undefined;
  const prevCheckOut = !isFirst ? notes[plan.days[i - 1]?.lodgingPlaceRef ?? '']?.checkOut : undefined;
  const lodgingTimes = [lodgingNote?.checkIn ? t('tl.checkInAt', { time: lodgingNote.checkIn }) : '', lodgingNote?.checkOut ? t('tl.checkOutAt', { time: lodgingNote.checkOut }) : ''].filter(Boolean).join(' · ');
  const times = useMemo(() => Object.fromEntries(timeline(plan, day.dayIndex).map((st) => [st.visitId, st])), [plan, day.dayIndex]);
  const issues = useMemo(() => nodeIssues(plan, day.dayIndex), [plan, day.dayIndex]);
  const endAt = dayEnd(plan, day.dayIndex);
  const clock = (m: number) => (m < 0 ? t('days.prevDay') : hhmm(m));
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

  // 출발
  const fd = plan.firstDay;
  const startTime = isFirst
    ? fd.basis === 'DEPART_ORIGIN'
      ? t('tl.departAt', { time: fd.departTime })
      : t('tl.arriveBasis', { time: fd.arriveTime })
    : day.departTime
      ? t('tl.departAt', { time: day.departTime })
      : null;

  // 끝: a night's lodging, or home/the final place on the last day
  const lodgingMissing = !isLast && endName === null;
  const lastLodging = isLast && !!day.lodgingPlaceRef;
  const endWarn = lodgingMissing || lastLodging;
  const endTimes = [endAt !== null ? t('days.dayEnd', { time: clock(endAt) }) : '', day.endBy ? t('tl.endBy', { time: day.endBy }) : ''].filter(Boolean).join(' · ');

  const leg = (k: number) => {
    const l = day.legs[k];
    const { from, to } = legEnds(plan, day.dayIndex, k);
    return (
      <div className="tl-row" key={`leg${k}`}>
        <div className="tl-rail" />
        <div className="tl-legrow">
          <button type="button" className={`tl-leg${l ? '' : ' is-missing'}`} aria-label={`${t('tl.legTitle')} · ${t('tl.legRoute', { from, to })}`} onClick={() => onOpenLeg(k)}>
            <span aria-hidden="true">↓</span>
            {l ? t('tl.legMinutes', { duration: minutesLabel(l.minutes) }) : `${t('tl.legMissing')} · ${t('days.needsCheck')}`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="tl">
      {issues.other.map((x, n) => (
        <div key={`${x.code}${n}`} style={{ marginBottom: 8 }}>
          <Banner status="error" title={issueText(x)} />
        </div>
      ))}

      <div className="tl-row is-first">
        <div className="tl-rail">
          <span className="tl-marker is-accent" aria-hidden="true" />
        </div>
        <div className={`tl-card${issues.start.length ? ' is-error' : !startTime ? ' is-warn' : ''}`}>
          <button type="button" className="tl-card-main" onClick={onOpenStart}>
            <span className="tl-kicker">{`${t('tl.start')} · ${shortDate(day.date)}`}</span>
            <span className="tl-name">{startName}</span>
            {startTime ? <span className="tl-line">{startTime}</span> : <span className="tl-warn-text">{t('tl.departUnset')}</span>}
            {prevCheckOut && <span className="tl-memo">{t('tl.checkOutAt', { time: prevCheckOut })}</span>}
            {issues.start.map((x, n) => (
              <span key={n} className="tl-error-text">
                {issueText(x)}
              </span>
            ))}
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={day.visitOrder} strategy={verticalListSortingStrategy}>
          {day.visitOrder.map((id, k) => [
            leg(k),
            <StopCard
              key={id}
              plan={plan}
              id={id}
              k={k}
              count={day.visitOrder.length}
              time={times[id]}
              clock={clock}
              issues={issues.byVisit[id] ?? []}
              onOpen={(ref) => onOpenPlace(ref)}
              onMove={(dir) => safe(() => move(plan, day.dayIndex, k, dir))}
              onUnassign={() => safe(() => unassign(plan, id))}
            />,
          ])}
        </SortableContext>
      </DndContext>

      {leg(day.visitOrder.length)}

      <div className="tl-row is-last">
        <div className="tl-rail">
          <span className={`tl-marker${endWarn ? ' is-warn' : ''}`} aria-hidden="true">
            {isLast ? <FlagIcon /> : <BedIcon />}
          </span>
        </div>
        <div className={`tl-card${issues.end.length ? ' is-error' : endWarn ? ' is-warn' : ''}`}>
          <button type="button" className="tl-card-main" onClick={onOpenEnd}>
            <span className="tl-kicker">{isLast ? t('tl.home') : t('common.lodging')}</span>
            {lodgingMissing ? <span className="tl-name tl-warn-text" style={{ fontSize: 17 }}>{t('tl.lodgingUnset')}</span> : <span className="tl-name">{endName}</span>}
            {endTimes && <span className="tl-line">{endTimes}</span>}
            {lodgingTimes && <span className="tl-memo">{lodgingTimes}</span>}
            {lodgingNote?.memo && <span className="tl-memo">{lodgingNote.memo}</span>}
            {lastLodging && <span className="tl-warn-text">{t('trip.warn.lastLodging')}</span>}
            {issues.end.map((x, n) => (
              <span key={n} className="tl-error-text">
                {issueText(x)}
              </span>
            ))}
          </button>
        </div>
      </div>
    </div>
  );
}

type StopTime = ReturnType<typeof timeline>[number] | undefined;

/** One stop: number on the rail, the card opens its details; ⋯ moves or takes it off the day; the drag handle sits at the far right. */
function StopCard({
  plan,
  id,
  k,
  count,
  time,
  clock,
  issues,
  onOpen,
  onMove,
  onUnassign,
}: {
  plan: Trip;
  id: string;
  k: number;
  count: number;
  time: StopTime;
  clock: (m: number) => string;
  issues: DayIssue[];
  onOpen: (ref: string) => void;
  onMove: (dir: -1 | 1) => void;
  onUnassign: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { notes } = useNotes();
  const v = visitOf(plan, id)!;
  const p = placeOf(plan, v.placeRef)!;
  const memo = notes[p.placeRef]?.memo;
  const conflict = issues.length > 0;
  const timeText =
    !time || time.start === null ? t('days.timeCheck') : time.arrive === null ? t('days.timeStart', { start: clock(time.start) }) : t('days.times', { arrive: clock(time.arrive), start: clock(time.start) });
  const meta = [t('days.stay', { duration: minutesLabel(v.stayMinutes) }), v.desiredTime ? t('days.desired', { time: v.desiredTime }) : '', p.hours.status === 'UNKNOWN' ? t('tl.hoursUnknown') : '']
    .filter(Boolean)
    .join(' · ');
  const fixedSlot = !!v.fixed && !/:(00|30)$/.test(v.fixed.time);

  return (
    <div
      ref={setNodeRef}
      className="tl-row"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 5 : undefined }}>
      <div className="tl-rail">
        <span className={`tl-marker${conflict ? ' is-warn' : ''}`} aria-hidden="true">
          {k + 1}
        </span>
      </div>
      <div className={`tl-card${conflict ? ' is-error' : fixedSlot ? ' is-warn' : ''}`}>
        <button type="button" className="tl-card-main" onClick={() => onOpen(p.placeRef)}>
          <span className="tl-name-row">
            <span className="tl-name">{p.name}</span>
            {v.fixed && <Badge variant="info" label={t('common.fixedAt', { time: v.fixed.time })} />}
            {v.importance === 'MUST' && <Badge variant="warning" label={t('common.must')} />}
            {!v.fixed && !v.timeFlexible && <Badge variant="neutral" label={t('days.timeFirm')} />}
            {!v.dateFlexible && <Badge variant="neutral" label={t('days.dateFirm')} />}
          </span>
          <span className="tl-line">{timeText}</span>
          <span className="tl-meta">{meta}</span>
          {memo && <span className="tl-memo">{memo}</span>}
          {issues.map((x, n) => (
            <span key={n} className="tl-error-text">
              {issueText(x)}
            </span>
          ))}
          {fixedSlot && <span className="tl-warn-text">{t('tl.fixedSlot')}</span>}
        </button>
        <div className="tl-card-end">
          <DropdownMenu
            items={[
              { label: t('days.up'), isDisabled: k === 0, onClick: () => onMove(-1) },
              { label: t('days.down'), isDisabled: k === count - 1, onClick: () => onMove(1) },
              { type: 'divider' as const },
              { label: t('tl.unassign'), onClick: onUnassign },
            ]}
            presentation="popover"
            renderTrigger={(props) => (
              <button type="button" className="tn-iconbtn" aria-label={t('tl.more', { name: p.name })} {...props}>
                <MoreIcon />
              </button>
            )}
          />
          <button type="button" className="tl-handle" aria-label={t('days.drag')} {...attributes} {...listeners}>
            <GripIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

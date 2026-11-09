import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { dayEnd, hhmm, timeline, type DayIssue, type Home, type Trip } from '@tteonaljido/shared';
import { BedIcon, FlagIcon, GripIcon } from '../components/shell/icons';
import { minutesLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { kmLabel } from '../lib/routeTimes';
import { issueText, legKeys, moveTo, nodeIssues, placeOf, visitOf } from '../lib/trips';
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
  /** Takes a stop off this day (back to 보관함); the editor offers 되돌리기. */
  onRemoveStop: (visitId: string) => void;
  /** Phone-only recommended-route length by leg key (metres), from Kakao. */
  legMeters: Record<string, number>;
}

/**
 * One day as a vertical route: 출발 → (이동 → 장소)… → 이동 → 숙소 (or 귀가 on the last day); places are added with the
 * editor's floating + button. Every
 * problem shows on the node it is about — a tinted card edge and one line of text — instead of a list at the bottom.
 * Stops reorder by dragging their handle (pointer or keyboard); swiping a stop to the left takes it off the day. Fixed
 * visits never move on their own.
 */
export function DayTimeline({ plan, home, dayIndex, onChange, onError, onOpenPlace, onOpenStart, onOpenLeg, onOpenEnd, onRemoveStop, legMeters }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { day, i, isFirst, isLast, startName, endName } = dayEnds(plan, dayIndex);
  const { notes, lodgingTbd } = useNotes();
  // Phone-only notes shown in grey: the night's lodging (check-in/out, memo) and, on the next morning, its check-out.
  const lodgingNote = !isLast && day.lodgingPlaceRef ? notes[day.lodgingPlaceRef] : undefined;
  const prevCheckOut = !isFirst ? notes[plan.days[i - 1]?.lodgingPlaceRef ?? '']?.checkOut : undefined;
  const lodgingTimes = [lodgingNote?.checkIn ? t('tl.checkInAt', { time: lodgingNote.checkIn }) : '', lodgingNote?.checkOut ? t('tl.checkOutAt', { time: lodgingNote.checkOut }) : ''].filter(Boolean).join(' · ');
  const times = useMemo(() => Object.fromEntries(timeline(plan, day.dayIndex).map((st) => [st.visitId, st])), [plan, day.dayIndex]);
  const issues = useMemo(() => nodeIssues(plan, day.dayIndex), [plan, day.dayIndex]);
  const keys = useMemo(() => legKeys(plan, day.dayIndex), [plan, day.dayIndex]);
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
  // Screen-reader text for the drag handle, in the app's language (dnd-kit's defaults are English only).
  const nameOf = (id: UniqueIdentifier) => {
    const v = visitOf(plan, String(id));
    return (v && placeOf(plan, v.placeRef)?.name) ?? '';
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('tl.dragPicked', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('tl.dragMoved', { name: nameOf(active.id), n: day.visitOrder.indexOf(String(over.id)) + 1 }) : undefined),
    onDragEnd: ({ active, over }) => (over ? t('tl.dragMoved', { name: nameOf(active.id), n: day.visitOrder.indexOf(String(over.id)) + 1 }) : undefined),
    onDragCancel: () => t('tl.dragCanceled'),
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
  // 미정 (M41): the night needs no lodging yet — a quiet grey line instead of the red 'choose lodging' card.
  const lodgingTbdHere = lodgingMissing && lodgingTbd.includes(day.dayIndex);
  const lodgingRequired = lodgingMissing && !lodgingTbdHere;
  const lastLodging = isLast && !!day.lodgingPlaceRef;
  const endWarn = lastLodging;
  const endTimes = [endAt !== null ? t('days.dayEnd', { time: clock(endAt) }) : '', day.endBy ? t('tl.endBy', { time: day.endBy }) : ''].filter(Boolean).join(' · ');

  const leg = (k: number) => {
    const l = day.legs[k];
    const { from, to } = legEnds(plan, day.dayIndex, k);
    const m = keys[k] ? legMeters[keys[k]!] : undefined;
    const km = l && m ? ` · ${kmLabel(m)}` : '';
    return (
      <div className="tl-row" key={`leg${k}`}>
        <div className="tl-rail" />
        <div className="tl-legrow">
          <button type="button" className={`tl-leg${l ? '' : ' is-missing'}`} aria-label={`${t('tl.legTitle')} · ${t('tl.legRoute', { from, to })}`} onClick={() => onOpenLeg(k)}>
            <span aria-hidden="true">↓</span>
            {l ? `${t('tl.legMinutes', { duration: minutesLabel(l.minutes) })}${km}` : `${t('tl.legMissing')} · ${t('days.needsCheck')}`}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('tl.dragHelp') } }}>
        <SortableContext items={day.visitOrder} strategy={verticalListSortingStrategy}>
          {day.visitOrder.map((id, k) => [
            leg(k),
            <StopCard
              key={id}
              plan={plan}
              id={id}
              k={k}
              time={times[id]}
              clock={clock}
              issues={issues.byVisit[id] ?? []}
              onOpen={(ref) => onOpenPlace(ref)}
              onRemove={() => onRemoveStop(id)}
            />,
          ])}
        </SortableContext>
      </DndContext>

      {leg(day.visitOrder.length)}

      <div className="tl-row is-last">
        <div className="tl-rail">
          <span className={`tl-marker${lodgingRequired ? ' is-required' : endWarn ? ' is-warn' : ''}`} aria-hidden="true">
            {isLast ? <FlagIcon /> : <BedIcon />}
          </span>
        </div>
        <div className={`tl-card${issues.end.length ? ' is-error' : lodgingRequired ? ' is-required' : endWarn ? ' is-warn' : ''}`}>
          <button type="button" className="tl-card-main" onClick={onOpenEnd}>
            <span className="tl-kicker">{isLast ? t('tl.home') : t('common.lodging')}</span>
            {lodgingTbdHere ? (
              <span className="tl-name tl-meta" style={{ fontSize: 17 }}>{t('tl.lodgingTbd')}</span>
            ) : lodgingMissing ? (
              <span className="tl-name tl-required-text" style={{ fontSize: 17 }}>{t('tl.lodgingUnset')}</span>
            ) : (
              <span className="tl-name">{endName}</span>
            )}
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

/** One stop: number on the rail; tapping the card opens its details, swiping it left takes it off the day, and the drag handle at the far right reorders. */
function StopCard({
  plan,
  id,
  k,
  time,
  clock,
  issues,
  onOpen,
  onRemove,
}: {
  plan: Trip;
  id: string;
  k: number;
  time: StopTime;
  clock: (m: number) => string;
  issues: DayIssue[];
  onOpen: (ref: string) => void;
  onRemove: () => void;
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
      <SwipeToRemove cardClass={conflict ? ' is-error' : fixedSlot ? ' is-warn' : ''} actionLabel={t('tl.unassignPlace', { name: p.name })} onRemove={onRemove}>
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
          <button type="button" className="tl-handle" aria-label={t('days.drag')} {...attributes} {...listeners}>
            <GripIcon />
          </button>
        </div>
      </SwipeToRemove>
    </div>
  );
}

/** How far a half-swiped card rests open, showing its 빼기 button. */
const OPEN_AT = -88;

/**
 * A card that slides left to reveal a red 빼기 behind it. Past 45% of its width (or a quick fling) it is removed on
 * release; a shorter swipe rests open so 빼기 can be tapped, and tapping the card or Esc closes it again. Only a sideways
 * gesture counts — vertical scrolling passes through (touch-action: pan-y) — and the drag handle is left to dnd-kit.
 * The tap that ends a swipe never opens the card's details.
 */
function SwipeToRemove({ cardClass, actionLabel, onRemove, children }: { cardClass: string; actionLabel: string; onRemove: () => void; children: ReactNode }) {
  const [x, setX] = useState(0);
  const [sliding, setSliding] = useState(false);
  const gesture = useRef<{ id: number; x0: number; y0: number; t0: number; base: number; width: number; sideways: boolean } | null>(null);
  const swipedAt = useRef(-Infinity);
  const card = useRef<HTMLDivElement>(null);
  // The slide-out finishes before the stop is removed; by then the editor may have re-rendered, so call its newest handler.
  const removeRef = useRef(onRemove);
  removeRef.current = onRemove;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remove = () => {
    if (timer.current !== undefined) return; // already on its way out
    setSliding(false);
    setX(-(card.current?.offsetWidth ?? 400));
    timer.current = window.setTimeout(() => removeRef.current(), 160);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('.tl-handle')) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, base: x, width: e.currentTarget.offsetWidth, sideways: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.sideways) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) return void (gesture.current = null); // a scroll, not a swipe
      g.sideways = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setSliding(true);
    }
    setX(Math.min(0, Math.max(-g.width, g.base + dx)));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.sideways) return;
    swipedAt.current = e.timeStamp;
    setSliding(false);
    const dx = e.clientX - g.x0;
    const at = Math.min(0, g.base + dx);
    const speed = dx / Math.max(1, e.timeStamp - g.t0); // px per ms; negative is leftward
    if (at < -g.width * 0.45 || (speed < -0.8 && dx < -48)) remove();
    else setX(at < OPEN_AT / 2 ? OPEN_AT : 0);
  };
  const onPointerCancel = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.sideways) return;
    setSliding(false);
    setX(g.base);
  };
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const afterSwipe = e.timeStamp - swipedAt.current < 400;
    if (!afterSwipe && x === 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!afterSwipe) setX(0); // tapping an open card closes it
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && x !== 0) {
      e.stopPropagation();
      setX(0);
    }
  };
  const open = x !== 0;

  return (
    <div className={`tl-swipe${open || sliding ? ' is-open' : ''}`} onKeyDown={onKeyDown}>
      <div className="tl-swipe-back" aria-hidden={!open}>
        <button type="button" className="tl-swipe-action" tabIndex={open ? 0 : -1} aria-label={actionLabel} onClick={remove}>
          {t('tl.unassignShort')}
        </button>
      </div>
      <div
        ref={card}
        className={`tl-card tl-swipe-card${cardClass}`}
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: sliding ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}>
        {children}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Banner } from '@astryxdesign/core/Banner';
import { dayEnd, hhmm, timeline, type DayIssue, type Home, type Trip } from '@tteonaljido/shared';
import { BedIcon, FlagIcon, GripIcon, LockIcon } from '../components/shell/icons';
import { minutesLabel, shortDate } from '../lib/format';
import { t } from '../lib/i18n';
import { Tag } from '../components/shell/Tag';
import { SwipeToRemove } from '../components/SwipeToRemove';
import { kmLabel } from '../lib/routeTimes';
import { issueText, leaveFor, legKeys, moveTo, nodeIssues, placeOf, stopRangeText, visitOf } from '../lib/trips';
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
  /** Pull-to-refresh during the trip (M43): this day recomputed as if leaving at this minute (screen only). */
  startAt?: number;
  /** Leg keys Kakao can measure; the others are timed by the car's navigation (no typing since M43). */
  askable?: ReadonlySet<string>;
}

/**
 * One day as a vertical route: 출발 → (이동 → 장소)… → 이동 → 숙소 (or 귀가 on the last day); places are added with the
 * editor's floating + button. Every
 * problem shows on the node it is about — a tinted card edge and one line of text — instead of a list at the bottom.
 * Stops reorder by dragging their handle (pointer or keyboard); swiping a stop to the left takes it off the day. Fixed
 * visits never move on their own.
 */
export function DayTimeline({ plan, home, dayIndex, onChange, onError, onOpenPlace, onOpenStart, onOpenLeg, onOpenEnd, onRemoveStop, legMeters, startAt, askable }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { day, i, isFirst, isLast, startName, endName } = dayEnds(plan, dayIndex);
  const { lodgingTbd } = useNotes();
  const times = useMemo(() => Object.fromEntries(timeline(plan, day.dayIndex, startAt).map((st) => [st.visitId, st])), [plan, day.dayIndex, startAt]);
  const issues = useMemo(() => nodeIssues(plan, day.dayIndex), [plan, day.dayIndex]);
  const keys = useMemo(() => legKeys(plan, day.dayIndex), [plan, day.dayIndex]);
  const endAt = dayEnd(plan, day.dayIndex, startAt);
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
  const startTime = startAt !== undefined
    ? t('tl.liveFrom', { time: hhmm(startAt) })
    : isFirst
    ? fd.basis === 'DEPART_ORIGIN'
      ? fd.departTime
        ? t('tl.departAt', { time: fd.departTime })
        : null
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

  const leg = (k: number) => {
    const l = day.legs[k];
    const { from, to } = legEnds(plan, day.dayIndex, k);
    const m = keys[k] ? legMeters[keys[k]!] : undefined;
    const km = l && m ? ` · ${kmLabel(m)}` : '';
    // Empty: Kakao hasn't answered yet (a warning), or the leg can't be asked at all — the car's navigation times it (neutral).
    const byCar = !l && !(keys[k] && askable?.has(keys[k]!));
    // M54: into a fixed time, the latest time to leave the previous place to be there 15 minutes early.
    const leave = leaveFor(plan, day.dayIndex, k, times, startAt);
    return (
      <div className="tl-row" key={`leg${k}`}>
        <div className="tl-rail" />
        <div className="tl-legrow">
          <button type="button" className={`tl-leg${l || byCar ? '' : ' is-missing'}`} aria-label={`${t('tl.legTitle')} · ${t('tl.legRoute', { from, to })}`} onClick={() => onOpenLeg(k)}>
            {l || byCar ? <span aria-hidden="true">↓</span> : <span className="tn-warn-dot" aria-hidden="true" />}
            {/* M51: '↓ 11분 · 7.3km' — the word 이동 is implied by the arrow on the route line */}
            {l ? `${minutesLabel(l.minutes)}${km}` : byCar ? t('tl.legByCarShort') : t('tl.legPending')}
          </button>
          {/* M54 (replaces M51's wait caption): leave by F − 15 − the drive; spare time to stay longer, or a missed margin */}
          {leave && (
            <span className={`tn-tag tl-wait${leave.tone === 'spare' ? ' is-warn' : leave.tone === 'short' ? ' is-error' : ' is-ink'}`} title={t('tl.leaveHint')}>
              {leave.tone === 'spare'
                ? t('tl.leaveSpare', { time: clock(leave.time), gap: minutesLabel(leave.spare!) })
                : leave.tone === 'short'
                  ? t('tl.leaveShort', { time: clock(leave.time), gap: minutesLabel(-leave.spare!) })
                  : t('tl.departAt', { time: clock(leave.time) })}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tl tl-day">
      {issues.other.map((x, n) => (
        <div key={`${x.code}${n}`} style={{ marginBottom: 8 }}>
          <Banner status="error" title={issueText(x)} />
        </div>
      ))}

      <div className="tl-row is-first">
        <div className="tl-rail">
          <span className="tl-marker is-accent" aria-hidden="true" />
        </div>
        {/* M51: a 1-line slim bar — [출발] name … 09:30 출발. Check-out times stay in the lodging sheet. */}
        <div className={`tl-card tl-bar${issues.start.length ? ' is-error' : ''}`}>
          <button type="button" className="tl-card-main" onClick={onOpenStart} aria-label={`${t('tl.start')} · ${shortDate(day.date)} · ${startName}`}>
            <span className="tl-bar-row">
              <Tag>{t('tl.start')}</Tag>
              <span className="tl-bar-name">{startName}</span>
              {/* Departure is optional (M48): without one the bar says so quietly instead of asking for it. */}
              <span className={`tl-bar-time${startTime ? '' : ' is-quiet'}`}>{startTime ?? t('tl.departFree')}</span>
            </span>
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
        {/* M51: a 1-line slim bar — [숙소]/[귀가] name … 17:45 도착. Check-in/out and memo live in the lodging sheet. */}
        <div className={`tl-card tl-bar${issues.end.length ? ' is-error' : lodgingRequired ? ' is-required' : endWarn ? ' is-warn' : ''}`}>
          <button type="button" className="tl-card-main" onClick={onOpenEnd}>
            <span className="tl-bar-row">
              <Tag>{isLast ? t('tl.home') : t('common.lodging')}</Tag>
              {lodgingTbdHere ? (
                <span className="tl-bar-name is-quiet">{t('tl.lodgingTbd')}</span>
              ) : lodgingMissing ? (
                <span className="tl-bar-name tl-required-text">{t('tl.lodgingUnset')}</span>
              ) : (
                <span className="tl-bar-name">{endName}</span>
              )}
              {endAt !== null && <span className="tl-bar-time">{t('tl.barArrive', { time: clock(endAt) })}</span>}
            </span>
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
  // M51 — line 2: 'start ~ end · stay' (no 도착/머무는 시간 labels). A fixed time leads with a blue lock (the time it is
  // held to); a stop whose date or time is only held, not set, a grey one. Desired time and memo trail and truncate.
  const known = stopRangeText(time);
  const range = known ?? t('days.timeCheck');
  const lock = v.fixed ? 'fixed' : !v.timeFlexible || !v.dateFlexible ? 'firm' : null;
  const lockLabel = [v.fixed ? t('common.fixedAt', { time: v.fixed.time }) : !v.timeFlexible ? t('days.timeFirm') : '', !v.dateFlexible ? t('days.dateFirm') : '']
    .filter(Boolean)
    .join(' · ');
  // Unknown opening hours stay in the place's details (M45) — on every card they were noise, not information.
  const rest = [minutesLabel(v.stayMinutes), !v.fixed && v.desiredTime ? t('days.desired', { time: v.desiredTime }) : '', memo ?? '']
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
      <SwipeToRemove
        cardClassName={`tl-card${conflict ? ' is-error' : fixedSlot ? ' is-warn' : ''}`}
        actionText={t('tl.unassignShort')}
        actionLabel={t('tl.unassignPlace', { name: p.name })}
        ignore=".tl-handle"
        onRemove={onRemove}>
        <button type="button" className="tl-card-main" onClick={() => onOpen(p.placeRef)}>
          {/* M51 — line 1: the name on one line (ellipsis) and only 꼭 beside it. */}
          <span className="tl-name-row">
            <span className="tl-name">{p.name}</span>
            {v.importance === 'MUST' && <Tag tone="ink">{t('common.must')}</Tag>}
          </span>
          <span className="tl-line2">
            {lock && (
              <span className={`tl-lock${lock === 'fixed' ? ' is-fixed' : ''}`} role="img" aria-label={lockLabel}>
                <LockIcon />
              </span>
            )}
            <span className={`tl-range${lock === 'fixed' ? ' is-fixed' : ''}${known ? '' : ' is-unknown'}`}>{range}</span>
            <span className="tl-rest">{` · ${rest}`}</span>
          </span>
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


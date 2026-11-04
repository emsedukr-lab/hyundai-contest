import {
  addDays,
  buildTransfer,
  contentHash,
  epochDay,
  TRANSFER_LIMITS,
  type Day,
  type Home,
  type Place,
  type Trip,
  type TripTransfer,
  type Visit,
} from '@tteonaljido/shared';

/**
 * A trip as kept on this phone. `plan` is the editable trip in transfer shape (home always null);
 * the home address lives beside it and is only copied into a transfer when the user agrees.
 */
export interface TripDoc {
  tripId: string;
  revision: number;
  updatedAt: string;
  planHash: string;
  plan: Trip;
  home: Home | null;
}

const rand = () => Math.random().toString(36).slice(2, 10);
export const newRef = (prefix: string) => `${prefix}${rand()}`;

export const nowIso = () => {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
};

export const todayIn = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

/** Hash of what the plan says, ignoring bookkeeping fields, so saving an unchanged plan never bumps the revision. */
export const planHash = (plan: Trip) => contentHash({ ...plan, revision: 0, updatedAt: '', home: null });

const emptyDay = (dayIndex: number, date: string): Day => ({ dayIndex, date, departTime: dayIndex === 1 ? null : '09:00', endBy: null, visitOrder: [], legs: [null], lodgingPlaceRef: null });

export function emptyPlan(tripId: string = crypto.randomUUID()): Trip {
  const start = addDays(todayIn('Asia/Seoul'), 7);
  return {
    tripId,
    revision: 1,
    updatedAt: nowIso(),
    name: '새 여행',
    timezone: 'Asia/Seoul',
    startDate: start,
    endDate: addDays(start, 1),
    firstDay: { basis: 'DEPART_ORIGIN', departTime: '09:00' },
    origin: { kind: 'HOME' },
    finalDestination: { kind: 'HOME' },
    home: null,
    places: [],
    visits: [],
    days: [emptyDay(1, start), emptyDay(2, addDays(start, 1))],
  };
}

export async function newDoc(plan: Trip, home: Home | null = null): Promise<TripDoc> {
  const clean = { ...plan, home: null };
  return { tripId: plan.tripId, revision: plan.revision, updatedAt: plan.updatedAt, planHash: await planHash(clean), plan: clean, home };
}

/** Saves an edited plan: the revision goes up only when the plan's content actually changed. */
export async function savePlan(doc: TripDoc, plan: Trip, home: Home | null): Promise<TripDoc> {
  const clean = { ...plan, tripId: doc.tripId, home: null };
  const hash = await planHash(clean);
  if (hash === doc.planHash) return { ...doc, home, plan: { ...clean, revision: doc.revision, updatedAt: doc.updatedAt } };
  const revision = doc.revision + 1;
  const updatedAt = nowIso();
  return { tripId: doc.tripId, revision, updatedAt, planHash: hash, plan: { ...clean, revision, updatedAt }, home };
}

/** The only path from a stored trip to the wire: a whitelist copy, home only with consent. */
export function toTransfer(doc: TripDoc, includeHome: boolean): Promise<TripTransfer> {
  const trip: Trip = { ...doc.plan, tripId: doc.tripId, revision: doc.revision, updatedAt: doc.updatedAt, home: includeHome ? doc.home : null };
  return buildTransfer(trip, nowIso());
}

/* ---------- edit operations (pure; return a new plan) ---------- */

const mapDay = (plan: Trip, dayIndex: number, f: (d: Day) => Day): Trip => ({ ...plan, days: plan.days.map((d) => (d.dayIndex === dayIndex ? f(d) : d)) });
const patchVisit = (plan: Trip, visitId: string, patch: Partial<Visit>): Trip => ({ ...plan, visits: plan.visits.map((v) => (v.visitId === visitId ? { ...v, ...patch } : v)) });

export const dayCount = (start: string, end: string) => epochDay(end) - epochDay(start) + 1;

/** Changes the period. Day N keeps day N's plan; visits on days that no longer exist become unassigned. */
export function setPeriod(plan: Trip, start: string, end: string): Trip {
  const n = dayCount(start, end);
  if (n < 1 || n > TRANSFER_LIMITS.maxDays) throw new Error(`여행 기간은 1~${TRANSFER_LIMITS.maxDays}일이에요`);
  const days = Array.from({ length: n }, (_, i) => {
    const old = plan.days[i];
    return old ? { ...old, dayIndex: i + 1, date: addDays(start, i) } : emptyDay(i + 1, addDays(start, i));
  });
  const dropped = new Set(plan.days.slice(n).flatMap((d) => d.visitOrder));
  return {
    ...plan,
    startDate: start,
    endDate: end,
    days,
    visits: plan.visits.map((v) => (dropped.has(v.visitId) ? { ...v, unassignedReason: 'OUTSIDE_PERIOD' } : v)),
  };
}

export function addPlace(plan: Trip, p: Omit<Place, 'placeRef'>, stayMinutes = 60): Trip {
  const placeRef = newRef('p');
  const place: Place = { ...p, placeRef };
  const visits =
    p.category === 'LODGING'
      ? plan.visits
      : [
          ...plan.visits,
          {
            visitId: newRef('v'),
            placeRef,
            stayMinutes,
            prepMinutes: 10,
            importance: 'NORMAL' as const,
            desiredTime: null,
            fixed: null,
            dateFlexible: true,
            timeFlexible: true,
            unassignedReason: 'NOT_SCHEDULED_YET' as const,
          },
        ];
  return { ...plan, places: [...plan.places, place], visits };
}

export function removePlace(plan: Trip, placeRef: string): Trip {
  let next = plan;
  for (const v of plan.visits.filter((v) => v.placeRef === placeRef)) next = unassign(next, v.visitId);
  return {
    ...next,
    places: next.places.filter((p) => p.placeRef !== placeRef),
    visits: next.visits.filter((v) => v.placeRef !== placeRef),
    days: next.days.map((d) => (d.lodgingPlaceRef === placeRef ? { ...d, lodgingPlaceRef: null } : d)),
    origin: next.origin.kind === 'PLACE' && next.origin.placeRef === placeRef ? { kind: 'HOME' } : next.origin,
    finalDestination: next.finalDestination.kind === 'PLACE' && next.finalDestination.placeRef === placeRef ? { kind: 'HOME' } : next.finalDestination,
  };
}

/** Removes a visit from its day. The travel time across the gap is unknown until re-entered. */
export function unassign(plan: Trip, visitId: string, reason: Visit['unassignedReason'] = 'NOT_SCHEDULED_YET'): Trip {
  const days = plan.days.map((d) => {
    const k = d.visitOrder.indexOf(visitId);
    if (k < 0) return d;
    return { ...d, visitOrder: d.visitOrder.filter((id) => id !== visitId), legs: [...d.legs.slice(0, k), null, ...d.legs.slice(k + 2)] };
  });
  return patchVisit({ ...plan, days }, visitId, { unassignedReason: reason });
}

export function assign(plan: Trip, visitId: string, dayIndex: number): Trip {
  const cleared = plan.visits.find((v) => v.visitId === visitId)?.unassignedReason === null ? unassign(plan, visitId) : plan;
  const day = cleared.days.find((d) => d.dayIndex === dayIndex);
  if (!day) return plan;
  if (day.visitOrder.length >= TRANSFER_LIMITS.maxVisitsPerDay) throw new Error(`하루에 ${TRANSFER_LIMITS.maxVisitsPerDay}곳까지 넣을 수 있어요`);
  const n = day.visitOrder.length;
  const placed = mapDay(cleared, dayIndex, (d) => ({ ...d, visitOrder: [...d.visitOrder, visitId], legs: [...d.legs.slice(0, n), null, null] }));
  return patchVisit(placed, visitId, { unassignedReason: null });
}

export function move(plan: Trip, dayIndex: number, k: number, dir: -1 | 1): Trip {
  return mapDay(plan, dayIndex, (d) => {
    const j = k + dir;
    if (j < 0 || j >= d.visitOrder.length) return d;
    const order = [...d.visitOrder];
    [order[k], order[j]] = [order[j], order[k]];
    const touched = new Set([k, k + 1, j, j + 1]);
    return { ...d, visitOrder: order, legs: d.legs.map((l, i) => (touched.has(i) ? null : l)) };
  });
}

export const setLeg = (plan: Trip, dayIndex: number, k: number, minutes: number | null): Trip =>
  mapDay(plan, dayIndex, (d) => ({ ...d, legs: d.legs.map((l, i) => (i === k ? (minutes === null ? null : { minutes, source: 'USER_ESTIMATE' }) : l)) }));

export const setLodging = (plan: Trip, dayIndex: number, placeRef: string | null): Trip => mapDay(plan, dayIndex, (d) => ({ ...d, lodgingPlaceRef: placeRef }));

export const setDepart = (plan: Trip, dayIndex: number, time: string | null): Trip => mapDay(plan, dayIndex, (d) => ({ ...d, departTime: time }));

export const updateVisit = patchVisit;

export const updatePlace = (plan: Trip, placeRef: string, patch: Partial<Place>): Trip => ({
  ...plan,
  places: plan.places.map((p) => (p.placeRef === placeRef ? { ...p, ...patch } : p)),
});

/* ---------- read helpers ---------- */

export const placeOf = (plan: Trip, ref: string) => plan.places.find((p) => p.placeRef === ref);
export const visitOf = (plan: Trip, id: string) => plan.visits.find((v) => v.visitId === id);
export const unassignedVisits = (plan: Trip) => plan.visits.filter((v) => v.unassignedReason !== null);
export const lodgingPlaces = (plan: Trip) => plan.places.filter((p) => p.category === 'LODGING');

export const nightsLabel = (plan: Trip) => {
  const n = plan.days.length;
  return n === 1 ? '당일' : `${n - 1}박 ${n}일`;
};

export const REASON_LABEL: Record<NonNullable<Visit['unassignedReason']>, string> = {
  NOT_SCHEDULED_YET: '아직 일정에 넣지 않음',
  NO_TIME: '시간이 부족함',
  OUTSIDE_PERIOD: '여행 기간 밖',
  CLOSED: '방문일 휴무',
  USER_EXCLUDED: '이번엔 제외',
};

export interface Warning {
  level: 'warning' | 'info';
  text: string;
}

/** Advice shown while editing. Nothing here blocks saving or sending; the car re-checks everything. */
export function planWarnings(plan: Trip, home: Home | null): Warning[] {
  const out: Warning[] = [];
  const last = plan.days.length - 1;
  plan.days.forEach((d, i) => {
    if (i < last && !d.lodgingPlaceRef) out.push({ level: 'warning', text: `${d.dayIndex}일차 밤에 묵을 숙소를 정해 주세요` });
    if (i === last && d.lodgingPlaceRef) out.push({ level: 'warning', text: '마지막 날은 숙소 대신 귀가지로 끝나요' });
  });
  for (const v of plan.visits) {
    const name = placeOf(plan, v.placeRef)?.name ?? '';
    if (v.fixed && v.unassignedReason !== null) out.push({ level: 'warning', text: `고정 일정 '${name}'이 어느 날에도 들어가 있지 않아요` });
    if (v.fixed && !/:(00|30)$/.test(v.fixed.time)) out.push({ level: 'warning', text: `고정 시각은 30분 단위예요 (${name})` });
  }
  const missing = plan.days.reduce((n, d) => n + d.legs.filter((l) => l === null).length, 0);
  if (missing) out.push({ level: 'info', text: `이동시간이 비어 있는 구간 ${missing}곳은 차량에서 '확인 필요'로 표시돼요` });
  const unknownHours = plan.places.filter((p) => p.hours.status === 'UNKNOWN').length;
  if (unknownHours) out.push({ level: 'info', text: `영업정보 미확인 ${unknownHours}곳` });
  if ((plan.origin.kind === 'HOME' || plan.finalDestination.kind === 'HOME') && !home) {
    out.push({ level: 'info', text: "집 주소를 넣지 않으면 차량 내비의 '집'을 사용해요" });
  }
  return out;
}

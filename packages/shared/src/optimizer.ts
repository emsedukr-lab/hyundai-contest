import type { Place, Trip, Visit } from './tripTransfer';
import { TRANSFER_LIMITS } from './tripTransfer';
import { minutes } from './timeline';

/**
 * 여행 동선 최적화: which day each place goes on and in what order, for the whole trip at once.
 *
 * An adaptive large-neighbourhood search under simulated annealing (ALNS-SA), in plain TypeScript with no dependency,
 * so the phone and the server can both run it and the car can port it. It starts from the plan as it stands, takes
 * stops out and puts them back where they cost least, swaps and moves them within and between days, and keeps the
 * cheapest timetable it has seen. "Cost" is one number per timetable:
 *
 *  - driving and parking minutes, and minutes spent waiting (for a booking, for a place to open);
 *  - meals at meal times (아침 08:00–09:30, 점심 11:30–13:30, 저녁 17:30–19:30 unless `mealWindows` says otherwise), no
 *    second lunch or dinner in a day; a restaurant the traveller named as a meal (`meals`) is held to that meal's time;
 *  - at most `maxCafesPerDay` cafes a day, and a cafe is best right after lunch (less so after dinner);
 *  - a place left out costs by its importance; a day that runs past its end costs by the minute;
 *  - the stops are shared out evenly over the days, the first and the last day taking half a day's share (the drive
 *    there and the drive home) — weighed lightly, so that near places stay together first;
 *  - and what must never happen costs more than everything else together: a booking not reached
 *    `reservationLeadMinutes` early (parking included), a visit on a closed day or outside opening hours, a 꼭 place
 *    left out.
 *
 * The timetable inside the search follows the planning rules given for this engine: every drive to another place adds
 * `parkingMinutes`, a booking is reached `reservationLeadMinutes` early and starts on the dot, and arriving before a
 * place opens (or in its break) means waiting until it does. The timetable the apps show (`timeline.ts`, mirrored by
 * the car) counts no parking time and no waiting for opening hours, so the search also walks that clock and avoids
 * orders it would flag — a recommendation should not arrive with a conflict on it.
 *
 * Deterministic: the random numbers come from `seed`, and the amount of work from `iterations`.
 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
/** When each meal is eaten: [from, to] in minutes of the day. */
export type MealWindows = Record<MealSlot, [number, number]>;
export const DEFAULT_MEAL_WINDOWS: MealWindows = { breakfast: [480, 570], lunch: [690, 810], dinner: [1050, 1170] };

export interface OptimizerConfig {
  parkingMinutes: number;
  reservationLeadMinutes: number;
  maxCafesPerDay: number;
  /** A wait this long before a stop is reported as a gap worth filling. */
  gapMinutes: number;
  /** Departure assumed for a day that has none set (minutes of the day). The plan itself is not changed. */
  defaultDepart: number;
  /** End of day assumed where the day has no target. */
  defaultEndBy: number;
  iterations: number;
  seed: number;
  /** Meal times a restaurant's start is judged against (the traveller may move them). */
  mealWindows: MealWindows;
}

export const OPTIMIZER_DEFAULTS: OptimizerConfig = {
  parkingMinutes: 10,
  reservationLeadMinutes: 10,
  maxCafesPerDay: 2,
  gapMinutes: 120,
  defaultDepart: 9 * 60,
  defaultEndBy: 21 * 60,
  iterations: 12_000,
  seed: 20_261_113,
  mealWindows: DEFAULT_MEAL_WINDOWS,
};

/** How long a visit lasts when the traveller has not said: a meal an hour, a cafe 45 minutes, a sight an hour and a half. */
export const DEFAULT_STAY: Record<Place['category'], number> = { FOOD: 60, CAFE: 45, SIGHT: 90, OTHER: 60, LODGING: 0 };

/** Ends of a day's route that are not places of the trip. */
export const KEY_HOME = '@home';
export const KEY_HERE = '@here';

export interface PoolPlace {
  key: string;
  name: string;
  category: Place['category'];
  hours: Place['hours'];
  stayMinutes?: number;
}

export interface OptimizerInput {
  trip: Trip;
  /** Driving minutes between two keys (a placeRef, {@link KEY_HOME}, {@link KEY_HERE}, a pool key); null when unknown. */
  drive: (fromKey: string, toKey: string) => number | null;
  /** Check-in and check-out minute of a lodging, where the traveller entered them (by placeRef). */
  lodging?: Record<string, { checkIn?: number; checkOut?: number }>;
  /**
   * The meal a restaurant is for, where the traveller said so (by placeRef; FOOD places only). Such a stop is judged
   * against that meal's time instead of the one its clock time is nearest to; without an entry nothing changes.
   */
  meals?: Record<string, MealSlot>;
  /** Places outside the trip that may fill a long gap. */
  pool?: PoolPlace[];
  config?: Partial<OptimizerConfig>;
}

/** Times are null after a leg nobody can time (until a fixed time sets the clock again), as on the timetable the apps show. */
export interface PlannedStop {
  visitId: string;
  /** At the door, parking done. */
  arrive: number | null;
  start: number | null;
  end: number | null;
  /** null where the drive to this stop is not known. */
  driveMinutes: number | null;
  parkingMinutes: number;
  waitMinutes: number;
}

export interface PlannedDay {
  dayIndex: number;
  depart: number;
  stops: PlannedStop[];
  /** Arrival at the night's lodging or the final destination; null when the day has no end set. */
  arriveEnd: number | null;
}

export interface GapSlot {
  dayIndex: number;
  /** The stop before the gap; null when the gap opens the day. */
  afterVisitId: string | null;
  beforeVisitId: string;
  from: number;
  to: number;
  minutes: number;
  /** A pool place that fits into the gap with the least extra driving. */
  suggestion?: { key: string; name: string };
}

export type LodgingNote = { dayIndex: number; kind: 'CHECKOUT_BEFORE_DEPARTURE' | 'ARRIVES_BEFORE_CHECKIN'; minutes: number };

export interface Optimized {
  /** visitIds per dayIndex, in visiting order. */
  order: Record<number, string[]>;
  /** Places the search could not fit (they were unplaced before, or no day could take them). */
  unassigned: string[];
  days: PlannedDay[];
  gaps: GapSlot[];
  lodgingNotes: LodgingNote[];
  cost: number;
  /** Rules that must never be broken and still are in the best timetable found (0 for a clean plan). */
  hardViolations: number;
  /** False when nothing better than the plan as it stands was found: `order` is then the plan's own. */
  changed: boolean;
}

/*
 * Costs, in one currency: a minute of driving is 3. The soft preferences are sized against that — being an hour off a
 * meal time costs about what 40 minutes of driving does, a second lunch about 100 — so that a meal at the right hour is
 * worth a detour but never a trip across the map. (Sized an order of magnitude larger, as first drafted, half an hour
 * off lunch outweighed twelve hours of driving, and a restaurant next to day 2's hotel was sent to day 1 for breakfast.)
 */
const HARD = 1_000_000;
/** An order the apps' own timetable would flag (arriving before opening): allowed by the rules, but not recommended. */
const SHOWN_CONFLICT = 4_000;
const DRIVE = 3;
const WAIT = 1.8;
/** Waiting past an hour: a stop of the trip's own should go there first. */
const LONG_WAIT = 3;
const MEAL_OFF = { base: 40, perMinute: 1.5, most: 250 };
/**
 * A meal the traveller named is priced by the same minute, but the price keeps growing for longer: a dinner
 * place at lunchtime is five hours off, and under the usual cap 12:30 and 15:00 would cost the same — on a day that
 * ends mid-afternoon the search then had no reason to move it out of lunchtime (seen on the sample trip). The rate is
 * unchanged, so a detour is still weighed by the minute; only the furthest miss (dinner at noon) costs more, about two
 * second lunches.
 */
const MEAL_OFF_CHOSEN_MOST = 600;
const MEAL_TWICE = 300;
const CAFE_OVER = 400;
const CAFE_AFTER = { lunch: 60, other: 25 };
/** Past a day's end: by the minute — steeply past a target the traveller set, gently past the assumed 21:00. */
const LATE_END = { set: 80, assumed: 6 };
/**
 * A stop the traveller already put on a day stays there unless moving it is clearly worth it (about fifty minutes of
 * driving): a recommendation reorders a planned trip, and moves a place to another day only for a real reason.
 */
const OTHER_DAY = 150;
/**
 * A meal whose time is unknown (a day that starts from an address nobody has): neither rewarded nor punished like a
 * timed one, but not free either — otherwise every badly timed restaurant would flee to the day nothing is known about.
 */
const MEAL_UNTIMED = 100;
/** Moving a stop from its own day to where its time would be unknown is not a recommendation anyone can check. */
const INTO_THE_UNKNOWN = 5_000;
/**
 * How much of a day there is to fill, next to the other days: the first day begins with the drive there and the last
 * ends with the drive home, so each of the two takes half of what a day in between does. (A two-day trip has only
 * such days, which makes them equal; a one-day trip has nothing to share out.)
 */
const DAY_SHARE = { edge: 0.5, between: 1 };
/**
 * Each stop a day holds over or under its share costs this, squared — one stop off is about seven minutes of driving.
 * Keeping near places together comes first: an even split wins only among arrangements that drive about the same.
 * Squared, so that a pile does not stand (three stops too many on one day cost what an hour of driving does) and an
 * empty day next to full ones does not either.
 */
const UNEVEN = 20;
/** A different arrangement has to be this much cheaper than the plan as it stands (about five minutes of driving). */
const MIN_GAIN = 15;
const FALLBACK_DRIVE = 20;
const UNPLACED: Record<Visit['importance'], number> = { MUST: HARD, NORMAL: 75_000, OPTIONAL: 25_000 };
const ASSIGNABLE: ReadonlySet<string> = new Set(['NOT_SCHEDULED_YET', 'NO_TIME']);
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

type Span = [open: number, close: number];
/** 'any' = nothing to check; [] = closed that day. */
type DayHours = 'any' | Span[];

interface Node {
  id: string;
  key: string;
  category: Place['category'];
  /** The meal the traveller named for this restaurant; null when it is to be told from the clock. */
  meal: MealSlot | null;
  stay: number;
  fixed: number | null;
  desired: number | null;
  importance: Visit['importance'];
  /** The day this stop must stay on (a booking, or a date the traveller fixed); null when any day will do. */
  pinnedDay: number | null;
  /** The day the plan has it on now; null when it is not placed yet. */
  homeDay: number | null;
  hours: DayHours[];
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
};

function hoursOn(h: Place['hours'], date: string): DayHours {
  if (h.status !== 'USER_ENTERED') return 'any';
  if (h.closedDates.includes(date)) return [];
  return h.weekly
    .filter((w) => w.weekday === weekday(date))
    .map((w): Span => {
      const o = minutes(w.open);
      const c = minutes(w.close);
      return [o, c <= o ? c + 1440 : c];
    })
    .sort((a, b) => a[0] - b[0]);
}

/** Small seeded generator (mulberry32): the same seed gives the same search. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayEval {
  cost: number;
  hard: number;
  plan: PlannedDay;
  gaps: GapSlot[];
  notes: LodgingNote[];
}

interface State {
  routes: string[][];
  unassigned: string[];
}

export function optimizeTrip(input: OptimizerInput): Optimized {
  const cfg = { ...OPTIMIZER_DEFAULTS, ...input.config };
  const MEALS = cfg.mealWindows;
  const { trip } = input;
  const nDays = trip.days.length;
  const placeOf = new Map(trip.places.map((p) => [p.placeRef, p]));
  const dates = trip.days.map((_, i) => addDays(trip.startDate, i));

  /* ---------- the stops the search may arrange ---------- */
  const nodes = new Map<string, Node>();
  const dayOfVisit = new Map<string, number>();
  trip.days.forEach((d, i) => d.visitOrder.forEach((id) => dayOfVisit.set(id, i)));
  for (const v of trip.visits) {
    const assigned = dayOfVisit.get(v.visitId);
    if (assigned === undefined && !(v.unassignedReason && ASSIGNABLE.has(v.unassignedReason))) continue; // left out on purpose
    const p = placeOf.get(v.placeRef);
    if (!p) continue;
    nodes.set(v.visitId, {
      id: v.visitId,
      key: v.placeRef,
      category: p.category,
      meal: p.category === 'FOOD' ? (input.meals?.[v.placeRef] ?? null) : null,
      stay: v.stayMinutes,
      fixed: v.fixed ? minutes(v.fixed.time) : null,
      desired: v.desiredTime ? minutes(v.desiredTime) : null,
      importance: v.importance,
      pinnedDay: assigned !== undefined && (v.fixed || !v.dateFlexible) ? assigned : null,
      homeDay: assigned ?? null,
      hours: dates.map((date) => hoursOn(p.hours, date)),
    });
  }
  const node = (id: string) => nodes.get(id)!;

  /* ---------- where each day starts and ends ---------- */
  const endKey = (e: Trip['origin'] | Trip['finalDestination']): string | null => (e.kind === 'HOME' ? KEY_HOME : e.kind === 'PLACE' ? e.placeRef : KEY_HERE);
  const startKeys = trip.days.map((_, i) => (i === 0 ? endKey(trip.origin) : trip.days[i - 1].lodgingPlaceRef));
  const endKeys = trip.days.map((d, i) => (i === nDays - 1 ? endKey(trip.finalDestination) : d.lodgingPlaceRef));

  const legCache = new Map<string, number | null>();
  /** Driving minutes for fitting a place into a gap (an unknown drive counts as the fallback). */
  const drive = (a: string | null, b: string | null): number => leg(a, b).minutes;
  const park = (a: string | null, b: string | null) => (!a || !b || a === b ? 0 : cfg.parkingMinutes);

  const departOf = (i: number): number => {
    const d = trip.days[i];
    if (i > 0) return d.departTime ? minutes(d.departTime) : cfg.defaultDepart;
    const f = trip.firstDay;
    return f.basis === 'DEPART_ORIGIN' && f.departTime ? minutes(f.departTime) : cfg.defaultDepart;
  };

  /** A leg as the search may count on it: `known` is false where nobody has a driving time for it (no address, no coordinates). */
  const leg = (a: string | null, b: string | null): { minutes: number; known: boolean } => {
    if (!a || !b) return { minutes: 0, known: false };
    if (a === b) return { minutes: 0, known: true };
    const k = `${a}>${b}`;
    let m = legCache.get(k);
    if (m === undefined) {
      m = input.drive(a, b);
      legCache.set(k, m);
    }
    // An unknown drive still costs something, so that not knowing is never the cheap way out.
    return m === null ? { minutes: FALLBACK_DRIVE, known: false } : { minutes: m, known: true };
  };

  /* ---------- one day's timetable and what it costs ---------- */
  /**
   * Times follow the same rule as the timetable the apps show: after a leg nobody can time, the clock is unknown until
   * a fixed time sets it again, and nothing that depends on the clock (meal times, opening hours, waiting) is judged
   * for a stop whose time is unknown. A trip that starts "from home" with no address is not arranged around a guess.
   */
  function evalDay(i: number, route: string[]): DayEval {
    const day = trip.days[i];
    let cost = 0;
    let hard = 0;
    const stops: PlannedStop[] = [];
    const gaps: GapSlot[] = [];
    const notes: LodgingNote[] = [];
    const broke = (extra = 0) => {
      hard += 1;
      cost += HARD + extra;
    };

    const from = startKeys[i];
    // A first day timed by its first stop: the arrival there is the given, the departure follows from the drive.
    const firstArrival = i === 0 && trip.firstDay.basis === 'ARRIVE_FIRST_STOP' ? minutes(trip.firstDay.arriveTime) : null;
    let depart = departOf(i);
    if (firstArrival !== null) {
      const first = route[0] ? node(route[0]).key : endKeys[i];
      depart = firstArrival - leg(from, first).minutes - park(from, first);
    }
    // Leaving a lodging for another one: the room has to be given up by its check-out time.
    const leaving = i > 0 && from && from !== endKeys[i] ? input.lodging?.[from]?.checkOut : undefined;
    if (leaving !== undefined && depart > leaving) notes.push({ dayIndex: day.dayIndex, kind: 'CHECKOUT_BEFORE_DEPARTURE', minutes: depart - leaving });

    let clock: number | null = depart; // this engine's clock: parking and waiting included
    let shown: number | null = depart; // the clock of the timetable the apps show: neither
    let prev: string | null = from;
    let prevId: string | null = null;
    let cafes = 0;
    let untimedMeals = 0;
    const meals = { breakfast: 0, lunch: 0, dinner: 0 };
    let prevLunchMeal = false;
    let prevWasMeal = false;

    route.forEach((id, k) => {
      const n = node(id);
      const l = leg(prev, n.key);
      const p = park(prev, n.key);
      let arrive: number | null = clock !== null && l.known ? clock + l.minutes + p : null;
      let shownArrive: number | null = shown !== null && l.known ? shown + l.minutes : null;
      if (k === 0 && firstArrival !== null) arrive = shownArrive = firstArrival;
      const hours = n.hours[i];
      let start: number | null = arrive;
      let wait = 0;
      let shownStart: number | null = shownArrive;

      if (hours !== 'any' && hours.length === 0) broke(); // closed that day
      if (n.fixed !== null) {
        const latest = n.fixed - cfg.reservationLeadMinutes;
        if (arrive !== null) {
          if (arrive > latest) broke((arrive - latest) * 5_000);
          else wait = latest - arrive;
        }
        const at = (start = arrive === null ? n.fixed : Math.max(arrive, n.fixed));
        shownStart = shownArrive === null ? n.fixed : Math.max(shownArrive, n.fixed);
        if (hours !== 'any' && hours.length > 0 && !hours.some(([o, c]) => at >= o && at + n.stay <= c)) broke();
      } else if (arrive !== null && hours !== 'any' && hours.length > 0) {
        // The first opening span the whole stay fits into, waiting for it to begin if need be.
        const at = arrive;
        const span = hours.find(([o, c]) => Math.max(at, o) + n.stay <= c);
        if (!span) broke(Math.max(0, at + n.stay - hours[hours.length - 1][1]) * 1_000);
        else {
          start = Math.max(at, span[0]);
          wait = start - at;
          // The shown timetable does not wait: an arrival before opening would read as a conflict there.
          if (shownStart !== null && (shownStart < span[0] || shownStart + n.stay > span[1])) cost += SHOWN_CONFLICT;
        }
      }
      const end = start === null ? null : start + n.stay;
      if (n.fixed === null && n.desired !== null && start !== null) cost += Math.abs(start - n.desired) * 2;

      let isLunchMeal = false;
      if (n.category === 'FOOD' && start !== null) {
        // Which meal this is: the one the traveller named, else the meal time it falls in, or — off every meal time —
        // the one it is nearest to.
        const at = start;
        const off = (w: readonly [number, number]) => (at < w[0] ? w[0] - at : at > w[1] ? at - w[1] : 0);
        const slot = n.meal ?? MEAL_SLOTS.reduce((a, b) => (off(MEALS[b]) < off(MEALS[a]) ? b : a));
        // One of each a day: two restaurants an hour apart are two lunches, whatever the clock says.
        if (meals[slot] > 0) cost += MEAL_TWICE;
        meals[slot] += 1;
        isLunchMeal = slot === 'lunch';
        if (off(MEALS[slot]) > 0 && n.fixed === null) cost += Math.min(n.meal ? MEAL_OFF_CHOSEN_MOST : MEAL_OFF.most, MEAL_OFF.base + off(MEALS[slot]) * MEAL_OFF.perMinute);
      }
      // Untimed meals: each further one on the day costs more, as a second lunch would.
      if (n.category === 'FOOD' && start === null) cost += MEAL_UNTIMED * ++untimedMeals;
      if (start === null && n.homeDay !== null && n.homeDay !== i) cost += INTO_THE_UNKNOWN;
      if (n.category === 'CAFE') {
        cafes += 1;
        if (cafes > cfg.maxCafesPerDay) cost += CAFE_OVER;
        if (prevWasMeal) cost -= prevLunchMeal ? CAFE_AFTER.lunch : CAFE_AFTER.other;
      }
      if (n.homeDay !== null && n.homeDay !== i) cost += OTHER_DAY;
      if (arrive !== null && start !== null && wait >= cfg.gapMinutes) gaps.push({ dayIndex: day.dayIndex, afterVisitId: prevId, beforeVisitId: id, from: arrive, to: start, minutes: wait });

      cost += (l.minutes + p) * DRIVE + wait * WAIT + Math.max(0, wait - 60) * LONG_WAIT;
      stops.push({ visitId: id, arrive, start, end, driveMinutes: l.known ? l.minutes : null, parkingMinutes: p, waitMinutes: wait });
      clock = end;
      shown = shownStart === null ? null : shownStart + n.stay;
      prev = n.key;
      prevId = id;
      prevWasMeal = n.category === 'FOOD';
      prevLunchMeal = isLunchMeal;
    });

    const to = endKeys[i];
    let arriveEnd: number | null = null;
    if (to) {
      const l = leg(prev, to);
      cost += l.minutes * DRIVE;
      arriveEnd = clock !== null && l.known ? clock + l.minutes + park(prev, to) : null;
      if (arriveEnd !== null) {
        // A new lodging takes guests from its check-in time: arriving earlier is time spent waiting for the room.
        const checkIn = i < nDays - 1 && to !== from ? input.lodging?.[to]?.checkIn : undefined;
        if (checkIn !== undefined && arriveEnd < checkIn) {
          cost += (checkIn - arriveEnd) * 2.5;
          notes.push({ dayIndex: day.dayIndex, kind: 'ARRIVES_BEFORE_CHECKIN', minutes: checkIn - arriveEnd });
        }
        const endBy = day.endBy ? minutes(day.endBy) : cfg.defaultEndBy;
        if (arriveEnd > endBy) cost += (arriveEnd - endBy) * (day.endBy ? LATE_END.set : LATE_END.assumed);
      }
    }
    return { cost, hard, plan: { dayIndex: day.dayIndex, depart, stops, arriveEnd }, gaps, notes };
  }

  const unplacedCost = (ids: string[]) => ids.reduce((s, id) => s + (node(id).fixed !== null ? HARD : UNPLACED[node(id).importance]), 0);
  const unplacedHard = (ids: string[]) => ids.filter((id) => node(id).fixed !== null || node(id).importance === 'MUST').length;

  /* ---------- how evenly the stops are shared out over the days ---------- */
  const share = trip.days.map((_, i) => (i === 0 || i === nDays - 1 ? DAY_SHARE.edge : DAY_SHARE.between));
  const shareSum = share.reduce((a, b) => a + b, 0);
  /**
   * What an arrangement costs for how far each day's number of stops is from its share of all that are placed.
   * A stop the traveller put on a day (and so a booking, a fixed date) is counted on that day wherever the search
   * tries it: it makes its day fuller for the others, but evening the days out is never a reason to move it. The
   * stops that had no day yet are the ones shared out.
   */
  const uneven = (routes: string[][]): number => {
    if (nDays < 2) return 0;
    const load = routes.map(() => 0);
    routes.forEach((r, i) => r.forEach((id) => (load[node(id).homeDay ?? i] += 1)));
    const placed = load.reduce((a, b) => a + b, 0);
    return load.reduce((sum, c, i) => sum + (c - (placed * share[i]) / shareSum) ** 2, 0) * UNEVEN;
  };

  /* ---------- search state with per-day costs kept ---------- */
  const total = (s: State, ev: DayEval[]) => ev.reduce((sum, e) => sum + e.cost, 0) + unplacedCost(s.unassigned) + uneven(s.routes);
  const clone = (s: State): State => ({ routes: s.routes.map((r) => [...r]), unassigned: [...s.unassigned] });
  const evalAll = (s: State) => s.routes.map((r, i) => evalDay(i, r));

  const current: State = {
    routes: trip.days.map((d) => d.visitOrder.filter((id) => nodes.has(id))),
    unassigned: [...nodes.keys()].filter((id) => !dayOfVisit.has(id)),
  };
  const cap = TRANSFER_LIMITS.maxVisitsPerDay;
  const mayGo = (id: string, i: number) => node(id).pinnedDay === null || node(id).pinnedDay === i;

  /** The cheapest place for a stop among the days it may go on; null when no day has room. */
  function bestInsertion(s: State, ev: DayEval[], id: string): { day: number; at: number; delta: number } | null {
    let best: { day: number; at: number; delta: number } | null = null;
    const even = uneven(s.routes);
    for (let i = 0; i < nDays; i++) {
      if (!mayGo(id, i) || s.routes[i].length >= cap) continue;
      // One more stop on this day: what that does to the shares, whichever position it takes.
      const tilt = uneven(s.routes.map((r, d) => (d === i ? [...r, id] : r))) - even;
      for (let at = 0; at <= s.routes[i].length; at++) {
        const route = [...s.routes[i].slice(0, at), id, ...s.routes[i].slice(at)];
        const delta = evalDay(i, route).cost - ev[i].cost + tilt;
        if (!best || delta < best.delta) best = { day: i, at, delta };
      }
    }
    return best;
  }

  /** Puts every unplaced stop where it costs least — unless leaving it out is cheaper still. Most important first. */
  function repair(s: State, ev: DayEval[]) {
    const rank = { MUST: 0, NORMAL: 1, OPTIONAL: 2 } as const;
    const todo = [...s.unassigned].sort((a, b) => (node(a).fixed !== null ? -1 : 0) - (node(b).fixed !== null ? -1 : 0) || rank[node(a).importance] - rank[node(b).importance] || a.localeCompare(b));
    for (const id of todo) {
      const spot = bestInsertion(s, ev, id);
      if (!spot || spot.delta >= unplacedCost([id])) continue;
      s.routes[spot.day].splice(spot.at, 0, id);
      s.unassigned.splice(s.unassigned.indexOf(id), 1);
      ev[spot.day] = evalDay(spot.day, s.routes[spot.day]);
    }
  }

  // The plan as it stands is the yardstick; its unplaced stops are put in first so the search starts from a full plan.
  const baseline = clone(current);
  const baselineEvals = evalAll(baseline);
  repair(baseline, baselineEvals);
  const baselineCost = total(baseline, baselineEvals);

  let cur = clone(baseline);
  let curEvals = [...baselineEvals];
  let curCost = baselineCost;
  let best = clone(cur);
  let bestEvals = [...curEvals];
  let bestCost = curCost;

  const movable = [...nodes.keys()];
  const rand = rng(cfg.seed);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const daysWith = (s: State, min: number) => s.routes.map((r, i) => (r.length >= min ? i : -1)).filter((i) => i >= 0);

  /* ---------- neighbourhoods: each returns the days it touched, or null when it had nothing to do ---------- */
  type Op = (s: State, ev: DayEval[]) => number[] | null;
  const ops: Op[] = [
    // swap two stops of one day
    (s) => {
      const d = daysWith(s, 2);
      if (!d.length) return null;
      const i = pick(d);
      const a = Math.floor(rand() * s.routes[i].length);
      let b = Math.floor(rand() * (s.routes[i].length - 1));
      if (b >= a) b += 1;
      [s.routes[i][a], s.routes[i][b]] = [s.routes[i][b], s.routes[i][a]];
      return [i];
    },
    // move one stop within its day
    (s) => {
      const d = daysWith(s, 2);
      if (!d.length) return null;
      const i = pick(d);
      const [id] = s.routes[i].splice(Math.floor(rand() * s.routes[i].length), 1);
      s.routes[i].splice(Math.floor(rand() * (s.routes[i].length + 1)), 0, id);
      return [i];
    },
    // reverse a stretch of one day (2-opt)
    (s) => {
      const d = daysWith(s, 3);
      if (!d.length) return null;
      const i = pick(d);
      const a = Math.floor(rand() * (s.routes[i].length - 1));
      const b = a + 1 + Math.floor(rand() * (s.routes[i].length - a - 1));
      s.routes[i].splice(a, b - a + 1, ...s.routes[i].slice(a, b + 1).reverse());
      return [i];
    },
    // move one stop to another day
    (s) => {
      if (nDays < 2) return null;
      const from = pick(daysWith(s, 1).length ? daysWith(s, 1) : [0]);
      const free = s.routes[from].filter((id) => node(id).pinnedDay === null);
      const to = Math.floor(rand() * nDays);
      if (!free.length || to === from || s.routes[to].length >= cap) return null;
      const id = pick(free);
      s.routes[from].splice(s.routes[from].indexOf(id), 1);
      s.routes[to].splice(Math.floor(rand() * (s.routes[to].length + 1)), 0, id);
      return [from, to];
    },
    // swap two stops of different days
    (s) => {
      if (nDays < 2) return null;
      const a = Math.floor(rand() * nDays);
      const b = Math.floor(rand() * nDays);
      const fa = s.routes[a].filter((id) => node(id).pinnedDay === null);
      const fb = s.routes[b].filter((id) => node(id).pinnedDay === null);
      if (a === b || !fa.length || !fb.length) return null;
      const x = pick(fa);
      const y = pick(fb);
      s.routes[a][s.routes[a].indexOf(x)] = y;
      s.routes[b][s.routes[b].indexOf(y)] = x;
      return [a, b];
    },
    // destroy and repair: take a tenth to a quarter of the stops out and put each back where it costs least
    (s, ev) => {
      const placed = s.routes.flat();
      if (placed.length < 2) return null;
      const k = Math.max(1, Math.min(6, Math.round(placed.length * (0.1 + rand() * 0.15))));
      const touched = new Set<number>();
      for (let n = 0; n < k; n++) {
        const id = pick(s.routes.flat());
        const i = s.routes.findIndex((r) => r.includes(id));
        s.routes[i].splice(s.routes[i].indexOf(id), 1);
        s.unassigned.push(id);
        touched.add(i);
      }
      for (const i of touched) ev[i] = evalDay(i, s.routes[i]);
      const before = s.routes.map((r) => r.length);
      repair(s, ev);
      s.routes.forEach((r, i) => r.length !== before[i] && touched.add(i));
      return [...touched];
    },
    // a cafe right after a meal of the same day
    (s) => {
      const d = s.routes.map((r, i) => (r.some((id) => node(id).category === 'CAFE') && r.some((id) => node(id).category === 'FOOD') ? i : -1)).filter((i) => i >= 0);
      if (!d.length) return null;
      const i = pick(d);
      const cafe = pick(s.routes[i].filter((id) => node(id).category === 'CAFE'));
      s.routes[i].splice(s.routes[i].indexOf(cafe), 1);
      const meal = pick(s.routes[i].filter((id) => node(id).category === 'FOOD'));
      s.routes[i].splice(s.routes[i].indexOf(meal) + 1, 0, cafe);
      return [i];
    },
    // bring an unplaced stop in, or take a droppable one out
    (s) => {
      if (s.unassigned.length && rand() < 0.7) {
        const id = pick(s.unassigned);
        const days = [...Array(nDays).keys()].filter((i) => mayGo(id, i) && s.routes[i].length < cap);
        if (!days.length) return null;
        const i = pick(days);
        s.unassigned.splice(s.unassigned.indexOf(id), 1);
        s.routes[i].splice(Math.floor(rand() * (s.routes[i].length + 1)), 0, id);
        return [i];
      }
      const droppable = s.routes.flat().filter((id) => node(id).fixed === null && node(id).importance !== 'MUST');
      if (!droppable.length) return null;
      const id = pick(droppable);
      const i = s.routes.findIndex((r) => r.includes(id));
      s.routes[i].splice(s.routes[i].indexOf(id), 1);
      s.unassigned.push(id);
      return [i];
    },
  ];

  /* ---------- simulated annealing over the neighbourhoods, which earn their share by what they find ---------- */
  const weights = ops.map(() => 1);
  const steps = movable.length < 1 ? 0 : cfg.iterations;
  const t0 = 1_500;
  const tMin = 0.5;
  const cooling = steps > 0 ? Math.pow(tMin / t0, 1 / steps) : 1;
  let temperature = t0;
  for (let step = 0; step < steps; step++) {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < ops.length - 1 && r >= weights[k]) r -= weights[k++];
    const next = clone(cur);
    const nextEvals = [...curEvals];
    const touched = ops[k](next, nextEvals);
    let reward = 0;
    if (touched) {
      for (const i of touched) nextEvals[i] = evalDay(i, next.routes[i]);
      const cost = total(next, nextEvals);
      const delta = cost - curCost;
      if (delta < 0 || rand() < Math.exp(-delta / temperature)) {
        reward = delta < 0 ? 1.5 : 0.5;
        cur = next;
        curEvals = nextEvals;
        curCost = cost;
        if (cost < bestCost - 1e-9) {
          reward = 3;
          best = clone(next);
          bestEvals = [...nextEvals];
          bestCost = cost;
        }
      }
    }
    weights[k] = Math.max(0.2, weights[k] * 0.98 + reward * 0.02);
    temperature = Math.max(tMin, temperature * cooling);
  }

  /* ---------- polish: take each stop out and put it where it costs least (or leave it out), while that still helps ---------- */
  for (let improved = movable.length > 0, pass = 0; improved && pass < 20; pass++) {
    improved = false;
    for (const id of movable) {
      const from = best.routes.findIndex((r) => r.includes(id));
      const trial = clone(best);
      const trialEvals = [...bestEvals];
      if (from >= 0) {
        trial.routes[from].splice(trial.routes[from].indexOf(id), 1);
        trialEvals[from] = evalDay(from, trial.routes[from]);
        trial.unassigned.push(id);
      }
      const spot = bestInsertion(trial, trialEvals, id);
      if (spot && spot.delta < unplacedCost([id])) {
        trial.routes[spot.day].splice(spot.at, 0, id);
        trial.unassigned.splice(trial.unassigned.indexOf(id), 1);
        trialEvals[spot.day] = evalDay(spot.day, trial.routes[spot.day]);
      }
      const cost = total(trial, trialEvals);
      if (cost < bestCost - 1e-9) {
        best = trial;
        bestEvals = trialEvals;
        bestCost = cost;
        improved = true;
      }
    }
  }

  // Nothing clearly better than the plan as it stands (with its unplaced stops put in): keep that.
  const keep = bestCost > baselineCost - MIN_GAIN;
  const final = keep ? baseline : best;
  const finalEvals = keep ? baselineEvals : bestEvals;
  const same = (a: string[][], b: string[][]) => a.every((r, i) => r.length === b[i].length && r.every((id, k) => id === b[i][k]));

  const gaps = finalEvals.flatMap((e) => e.gaps);
  suggestForGaps(gaps, final);

  return {
    order: Object.fromEntries(final.routes.map((r, i) => [trip.days[i].dayIndex, r])),
    unassigned: final.unassigned,
    days: finalEvals.map((e) => e.plan),
    gaps,
    lodgingNotes: finalEvals.flatMap((e) => e.notes),
    cost: keep ? baselineCost : bestCost,
    hardViolations: finalEvals.reduce((s, e) => s + e.hard, 0) + unplacedHard(final.unassigned),
    changed: !same(final.routes, current.routes),
  };

  /** For each long gap, the pool place that fits in it with the least extra driving (each place offered once). */
  function suggestForGaps(found: GapSlot[], s: State) {
    const pool = input.pool ?? [];
    if (!pool.length) return;
    const used = new Set(s.routes.flat().map((id) => node(id).key));
    for (const gap of found) {
      const i = trip.days.findIndex((d) => d.dayIndex === gap.dayIndex);
      const before = gap.afterVisitId ? node(gap.afterVisitId).key : startKeys[i];
      const after = node(gap.beforeVisitId).key;
      // The gap was measured at the door of the next stop; the detour replaces the direct drive there.
      const free = gap.minutes + drive(before, after) + park(before, after);
      const leaveAt = gap.from - drive(before, after) - park(before, after);
      let pickKey: PoolPlace | null = null;
      let least = Infinity;
      for (const c of pool) {
        if (used.has(c.key)) continue;
        const stay = c.stayMinutes ?? DEFAULT_STAY[c.category];
        const inMin = drive(before, c.key) + park(before, c.key);
        const outMin = drive(c.key, after) + park(c.key, after);
        if (inMin + stay + outMin > free) continue;
        const hours = hoursOn(c.hours, dates[i]);
        const at = leaveAt + inMin;
        if (hours !== 'any' && !hours.some(([o, cl]) => at >= o && at + stay <= cl)) continue;
        if (inMin + outMin < least) {
          least = inMin + outMin;
          pickKey = c;
        }
      }
      if (pickKey) {
        gap.suggestion = { key: pickKey.key, name: pickKey.name };
        used.add(pickKey.key);
      }
    }
  }
}

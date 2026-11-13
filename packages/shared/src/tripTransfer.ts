import { z } from 'zod';

/** Trip transfer schema v1 — the only shape that ever leaves the phone (spec 24-3). */

export const TRANSFER_LIMITS = {
  maxDays: 14,
  maxPlaces: 100,
  maxVisits: 100,
  maxVisitsPerDay: 20,
  nameMax: 60,
  addressMax: 120,
} as const;

const isCalendarDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, 'invalid calendar date');
export const TimeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const Ref = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const LatE7 = z.int().min(-900_000_000).max(900_000_000);
const LonE7 = z.int().min(-1_800_000_000).max(1_800_000_000);
const Name = z.string().min(1).max(TRANSFER_LIMITS.nameMax);
const Address = z.string().max(TRANSFER_LIMITS.addressMax);

export const PlaceCategory = z.enum(['SIGHT', 'FOOD', 'CAFE', 'LODGING', 'OTHER']);
export const Importance = z.enum(['MUST', 'NORMAL', 'OPTIONAL']);
export const UnassignedReason = z.enum(['NOT_SCHEDULED_YET', 'NO_TIME', 'OUTSIDE_PERIOD', 'CLOSED', 'USER_EXCLUDED']);

export const NaviPoi = z.strictObject({
  poiId: z.string().min(1).max(40),
  poiSubId: z.string().max(40),
  poiProvider: z.string().min(1).max(40),
});

export const OpeningHours = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('UNKNOWN') }),
  z.strictObject({
    status: z.literal('USER_ENTERED'),
    weekly: z.array(z.strictObject({ weekday: z.int().min(1).max(7), open: TimeStr, close: TimeStr })).max(21),
    closedDates: z.array(DateStr).max(31),
  }),
]);

/** Coordinates are optional (e.g. added by name when search is unavailable); the car then finds the place in its navigation. */
export const Place = z.strictObject({
  placeRef: Ref,
  name: Name,
  address: Address,
  latE7: LatE7.nullable(),
  lonE7: LonE7.nullable(),
  category: PlaceCategory,
  source: z.strictObject({
    provider: z.enum(['KAKAO', 'MANUAL']),
    externalId: z.string().max(40).nullable(),
  }),
  naviPoi: NaviPoi.nullable(),
  hours: OpeningHours,
}).refine((p) => (p.latE7 === null) === (p.lonE7 === null), 'latE7 and lonE7 must both be set or both be null');

export const Visit = z.strictObject({
  visitId: Ref,
  placeRef: Ref,
  stayMinutes: z.int().min(0).max(720),
  prepMinutes: z.int().min(0).max(120),
  importance: Importance,
  desiredTime: TimeStr.nullable(),
  fixed: z.strictObject({ time: TimeStr, kind: z.enum(['RESERVATION', 'USER']) }).nullable(),
  dateFlexible: z.boolean(),
  timeFlexible: z.boolean(),
  unassignedReason: UnassignedReason.nullable(),
});

export const Leg = z.strictObject({ minutes: z.int().min(0).max(1440), source: z.enum(['USER_ESTIMATE']) });

export const Day = z.strictObject({
  dayIndex: z.int().min(1).max(TRANSFER_LIMITS.maxDays),
  date: DateStr,
  departTime: TimeStr.nullable(),
  endBy: TimeStr.nullable(),
  visitOrder: z.array(Ref).max(TRANSFER_LIMITS.maxVisitsPerDay),
  legs: z.array(Leg.nullable()).max(TRANSFER_LIMITS.maxVisitsPerDay + 1),
  lodgingPlaceRef: Ref.nullable(),
});

export const FirstDay = z.discriminatedUnion('basis', [
  // departTime null = no departure time chosen (M48: departure is optional on every day, the first included)
  z.strictObject({ basis: z.literal('DEPART_ORIGIN'), departTime: TimeStr.nullable() }),
  z.strictObject({ basis: z.literal('ARRIVE_FIRST_STOP'), arriveTime: TimeStr, prepMinutes: z.int().min(0).max(240) }),
]);

const HomeEnd = z.strictObject({ kind: z.literal('HOME') });
const PlaceEnd = z.strictObject({ kind: z.literal('PLACE'), placeRef: Ref });

/**
 * Where the first day starts (M59): 집, a place of the trip (a saved 회사 · 즐겨찾기 joins the trip as a place), or
 * CURRENT — wherever the car is when it leaves. CURRENT carries no coordinates: the car's navigation supplies them on
 * 「여기서 출발」. It is what a trip starts from when no place was chosen. Later days start from the lodging of the night before.
 */
export const Endpoint = z.discriminatedUnion('kind', [HomeEnd, PlaceEnd, z.strictObject({ kind: z.literal('CURRENT') })]);

/** Where the last day ends: 집 or a place of the trip. The current location is a place to start from, not one to return to. */
export const FinalDestination = z.discriminatedUnion('kind', [HomeEnd, PlaceEnd]);

export const Home = z.strictObject({ address: z.string().min(1).max(TRANSFER_LIMITS.addressMax), latE7: LatE7, lonE7: LonE7 });

export const Trip = z.strictObject({
  tripId: z.uuid(),
  revision: z.int().min(1),
  updatedAt: z.iso.datetime({ offset: true }),
  name: Name,
  timezone: z
    .string()
    .regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/)
    .max(40)
    .refine((tz) => {
      // A well-formed but unknown id would crash every date on the car; both sides reject it (Kotlin: ZoneId.of).
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'unknown time zone'),
  startDate: DateStr,
  endDate: DateStr,
  firstDay: FirstDay,
  origin: Endpoint,
  finalDestination: FinalDestination,
  home: Home.nullable(),
  places: z.array(Place).max(TRANSFER_LIMITS.maxPlaces),
  visits: z.array(Visit).max(TRANSFER_LIMITS.maxVisits),
  days: z.array(Day).min(1).max(TRANSFER_LIMITS.maxDays),
});

export const TripTransfer = z.strictObject({
  schema: z.literal('trip-transfer'),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  contentHash: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  trip: Trip,
});

export type TripTransfer = z.infer<typeof TripTransfer>;
export type Trip = z.infer<typeof Trip>;
export type Place = z.infer<typeof Place>;
export type Visit = z.infer<typeof Visit>;
export type Day = z.infer<typeof Day>;
export type Leg = z.infer<typeof Leg>;
export type FirstDay = z.infer<typeof FirstDay>;
export type Endpoint = z.infer<typeof Endpoint>;
export type FinalDestination = z.infer<typeof FinalDestination>;
export type Home = z.infer<typeof Home>;
export type OpeningHours = z.infer<typeof OpeningHours>;

export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;

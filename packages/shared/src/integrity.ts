import protocol from '../../../schema/pairing-protocol.v1.json' with { type: 'json' };
import { contentHash } from './canonical';
import { TripTransfer, type Trip } from './tripTransfer';

/**
 * Structural integrity of a transfer. These are the only reasons an import is rejected outright;
 * everything else (conflicts, unknown hours, missing legs) is shown to the user and never auto-fixed.
 * Check order is part of the contract: TransferIntegrity.kt returns the same first code.
 */
export type IntegrityCode =
  | 'TOO_LARGE'
  | 'SCHEMA'
  | 'UNSUPPORTED_VERSION'
  | 'DATE_RANGE'
  | 'DAY_COUNT_MISMATCH'
  | 'DAY_SEQUENCE'
  | 'DUPLICATE_REF'
  | 'UNKNOWN_PLACE_REF'
  | 'UNKNOWN_VISIT_REF'
  | 'DUPLICATE_ASSIGNMENT'
  | 'LEGS_LENGTH'
  | 'UNASSIGNED_REASON_MISMATCH'
  | 'HASH_MISMATCH';

export type ParseResult = { ok: true; transfer: TripTransfer } | { ok: false; code: IntegrityCode; detail?: string };

export const epochDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export const addDays = (date: string, n: number) => new Date((epochDay(date) + n) * 86_400_000).toISOString().slice(0, 10);

export function checkIntegrity(trip: Trip): { code: IntegrityCode; detail: string } | null {
  const span = epochDay(trip.endDate) - epochDay(trip.startDate);
  if (span < 0) return { code: 'DATE_RANGE', detail: `${trip.startDate} > ${trip.endDate}` };
  if (trip.days.length !== span + 1) return { code: 'DAY_COUNT_MISMATCH', detail: `${trip.days.length} != ${span + 1}` };
  for (const [i, day] of trip.days.entries()) {
    if (day.dayIndex !== i + 1 || day.date !== addDays(trip.startDate, i)) return { code: 'DAY_SEQUENCE', detail: `day ${i + 1}` };
  }

  const places = new Set<string>();
  for (const p of trip.places) {
    if (places.has(p.placeRef)) return { code: 'DUPLICATE_REF', detail: p.placeRef };
    places.add(p.placeRef);
  }
  const visits = new Map<string, string>();
  for (const v of trip.visits) {
    if (visits.has(v.visitId)) return { code: 'DUPLICATE_REF', detail: v.visitId };
    visits.set(v.visitId, v.placeRef);
  }

  const placeRefs = [
    ...trip.visits.map((v) => v.placeRef),
    ...trip.days.flatMap((d) => (d.lodgingPlaceRef ? [d.lodgingPlaceRef] : [])),
    ...[trip.origin, trip.finalDestination].flatMap((e) => (e.kind === 'PLACE' ? [e.placeRef] : [])),
  ];
  for (const ref of placeRefs) if (!places.has(ref)) return { code: 'UNKNOWN_PLACE_REF', detail: ref };

  for (const day of trip.days) {
    for (const ref of day.visitOrder) if (!visits.has(ref)) return { code: 'UNKNOWN_VISIT_REF', detail: ref };
  }
  const assigned = new Set<string>();
  for (const day of trip.days) {
    for (const ref of day.visitOrder) {
      if (assigned.has(ref)) return { code: 'DUPLICATE_ASSIGNMENT', detail: ref };
      assigned.add(ref);
    }
  }
  for (const day of trip.days) {
    if (day.legs.length !== day.visitOrder.length + 1) return { code: 'LEGS_LENGTH', detail: `day ${day.dayIndex}` };
  }
  for (const v of trip.visits) {
    if (assigned.has(v.visitId) === (v.unassignedReason !== null)) return { code: 'UNASSIGNED_REASON_MISMATCH', detail: v.visitId };
  }
  return null;
}

export async function parseTransfer(text: string): Promise<ParseResult> {
  if (new TextEncoder().encode(text).length > protocol.limits.maxPlaintextBytes) return { ok: false, code: 'TOO_LARGE' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, code: 'SCHEMA', detail: 'json' };
  }
  const head = raw as { schema?: unknown; schemaVersion?: unknown };
  if (head && head.schema === 'trip-transfer' && typeof head.schemaVersion === 'number' && head.schemaVersion !== 1) {
    return { ok: false, code: 'UNSUPPORTED_VERSION', detail: String(head.schemaVersion) };
  }
  const parsed = TripTransfer.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'SCHEMA', detail: parsed.error.issues[0]?.path.join('.') };
  const broken = checkIntegrity(parsed.data.trip);
  if (broken) return { ok: false, ...broken };
  if ((await contentHash(parsed.data.trip)) !== parsed.data.contentHash) return { ok: false, code: 'HASH_MISMATCH' };
  return { ok: true, transfer: parsed.data };
}

export async function buildTransfer(trip: Trip, exportedAt: string): Promise<TripTransfer> {
  return { schema: 'trip-transfer', schemaVersion: 1, exportedAt, contentHash: await contentHash(trip), trip };
}

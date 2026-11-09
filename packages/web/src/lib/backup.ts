import { buildTransfer, parseTransfer, type Trip } from '@tteonaljido/shared';
import { cleanNotes } from './notes';
import { cleanLegMeters } from './routeTimes';
import { cleanLodgingTbd, newDoc, nowIso, type TripDoc } from './trips';

/**
 * One trip from a backup file, checked the way the car checks a transfer (schema, limits, references) before it may be
 * stored. Returns the trip ready to save — keyed by its own plan id, phone-only notes and distances cleaned — or null
 * when the entry is not a valid trip. A broken entry stored as-is would crash the trip list on every launch.
 */
export async function checkBackupTrip(entry: unknown): Promise<TripDoc | null> {
  try {
    const d = entry as Partial<TripDoc> | null;
    if (!d || typeof d !== 'object' || !d.plan || typeof d.plan !== 'object') return null;
    const plan = { ...d.plan, revision: d.revision, updatedAt: d.updatedAt, home: d.home ?? null } as Trip;
    const parsed = await parseTransfer(JSON.stringify(await buildTransfer(plan, nowIso())));
    if (!parsed.ok) return null;
    const trip = parsed.transfer.trip;
    const doc = await newDoc({ ...trip, home: null }, trip.home);
    return { ...doc, notes: cleanNotes(d.notes), legMeters: cleanLegMeters(d.legMeters, trip), lodgingTbd: cleanLodgingTbd(d.lodgingTbd, trip) };
  } catch {
    return null;
  }
}

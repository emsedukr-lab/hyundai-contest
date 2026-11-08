/**
 * Notes kept with a trip on this phone only — not part of what the car receives (the transfer schema is unchanged):
 * per place, a memo (a room number, a parking tip) and, for lodging, check-in / check-out times. Stored on the trip
 * document in IndexedDB, so they travel with backups but not with a send to the car or a friend's share file.
 */
export interface PlaceNote {
  memo?: string;
  /** "HH:MM" */
  checkIn?: string;
  /** "HH:MM" */
  checkOut?: string;
}
/** By placeRef. */
export type TripNotes = Record<string, PlaceNote>;

export const MEMO_MAX = 200;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Only well-formed notes survive (memo text capped, times as HH:MM), empty ones are dropped; with `keep`, only those places. */
export function cleanNotes(raw: unknown, keep?: Set<string>): TripNotes {
  const out: TripNotes = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [ref, v] of Object.entries(raw as Record<string, unknown>)) {
    if (keep && !keep.has(ref)) continue;
    if (!v || typeof v !== 'object') continue;
    const n = v as Record<string, unknown>;
    const note: PlaceNote = {};
    if (typeof n.memo === 'string' && n.memo.trim()) note.memo = n.memo.slice(0, MEMO_MAX);
    if (typeof n.checkIn === 'string' && TIME.test(n.checkIn)) note.checkIn = n.checkIn;
    if (typeof n.checkOut === 'string' && TIME.test(n.checkOut)) note.checkOut = n.checkOut;
    if (Object.keys(note).length) out[ref] = note;
  }
  return out;
}

/** Changes one place's note; a field set to '' or null is removed, and an empty note disappears. */
export function setNote(notes: TripNotes, placeRef: string, patch: { [K in keyof PlaceNote]?: string | null }): TripNotes {
  const merged: Record<string, unknown> = { ...notes[placeRef], ...patch };
  const one = cleanNotes({ [placeRef]: merged });
  const next = { ...notes };
  if (one[placeRef]) next[placeRef] = one[placeRef];
  else delete next[placeRef];
  return next;
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FavoritePlace } from './favorites';
import type { TripDoc } from './trips';

/** Everything lives in this browser only: no account, no server copy of trips. */
export interface PairingRecord {
  sid: string;
  fingerprint: string;
  keyPair: CryptoKeyPair; // private key is non-extractable
  mobilePub: string;
  mobileToken: string | null;
  carPub: string | null;
  carAppVersion: string | null;
  supportedSchemaVersions: number[];
  confirmCode: string | null;
  codeConfirmed: boolean;
  tripId: string | null;
  revision: number | null;
  includeHome: boolean;
  sealed: { iv: string; ct: string; schemaVersion: number } | null;
  createdAt: number;
}

export interface SendLogEntry {
  id?: number;
  tripId: string;
  revision: number;
  at: number;
  outcome: string;
}

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export interface TrashedTrip {
  tripId: string;
  doc: TripDoc;
  deletedAt: number;
}

interface Schema extends DBSchema {
  meta: { key: string; value: boolean };
  trash: { key: string; value: TrashedTrip };
  trips: { key: string; value: TripDoc };
  pairing: { key: string; value: PairingRecord };
  sendLog: { key: number; value: SendLogEntry; indexes: { byTrip: string } };
  favorites: { key: string; value: FavoritePlace };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () =>
  (dbp ??= openDB<Schema>('tteonaljido', 4, {
    blocking() { void dbp?.then((d) => d.close()); dbp = null; },
    terminated() { dbp = null; },
    // Keep existing stores and trips when adding favorites or trash.
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('trips', { keyPath: 'tripId' });
        d.createObjectStore('pairing', { keyPath: 'sid' });
        d.createObjectStore('sendLog', { keyPath: 'id', autoIncrement: true }).createIndex('byTrip', 'tripId');
      }
      if (oldVersion < 2) {
        d.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (oldVersion < 3) d.createObjectStore('trash', { keyPath: 'tripId' });
      if (oldVersion < 4) d.createObjectStore('meta');
    },
  }));

/** Fired after the editor saves a trip (also on its way out), so open lists can reload. */
export const TRIPS_CHANGED = 'tteonaljido:trips-changed';

export const trips = {
  /** One transaction across tabs: preserve edits and remember deletion after trash expires. */
  seedExample: async (doc: TripDoc) => {
    const tx = (await db()).transaction(['trips', 'trash', 'meta'], 'readwrite');
    try {
      const key = `example:${doc.tripId}`;
      if (!(await tx.objectStore('meta').get(key))) {
        if (!(await tx.objectStore('trips').get(doc.tripId)) && !(await tx.objectStore('trash').get(doc.tripId))) {
          await tx.objectStore('trips').put(doc);
        }
        await tx.objectStore('meta').put(true, key);
      }
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  },
  all: async () => (await (await db()).getAll('trips')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  get: async (id: string) => (await db()).get('trips', id),
  put: async (doc: TripDoc) => void (await (await db()).put('trips', doc)),
  remove: async (id: string) => void (await (await db()).delete('trips', id)),
};

/** Moves and restores use one transaction so a failed write never loses the original trip. */
export const trash = {
  move: async (id: string): Promise<boolean> => {
    const tx = (await db()).transaction(['trips', 'trash'], 'readwrite');
    try {
      const doc = await tx.objectStore('trips').get(id);
      if (doc) {
        await tx.objectStore('trash').put({ tripId: id, doc, deletedAt: Date.now() });
        await tx.objectStore('trips').delete(id);
      }
      await tx.done;
      return !!doc;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  },
  restore: async (id: string): Promise<TripDoc | null> => {
    const tx = (await db()).transaction(['trips', 'trash'], 'readwrite');
    try {
      const entry = await tx.objectStore('trash').get(id);
      let restored: TripDoc | null = null;
      if (entry && entry.deletedAt + TRASH_RETENTION_MS <= Date.now()) {
        await tx.objectStore('trash').delete(id);
      } else if (entry && !(await tx.objectStore('trips').get(id))) {
        await tx.objectStore('trips').put(entry.doc);
        await tx.objectStore('trash').delete(id);
        restored = entry.doc;
      }
      await tx.done;
      return restored;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  },
  prune: async () => {
    const tx = (await db()).transaction('trash', 'readwrite');
    for (const entry of await tx.store.getAll()) {
      if (entry.deletedAt + TRASH_RETENTION_MS <= Date.now()) await tx.store.delete(entry.tripId);
    }
    await tx.done;
  },
  all: async (): Promise<TrashedTrip[]> => {
    await trash.prune();
    return (await (await db()).getAll('trash')).sort((a, b) => b.deletedAt - a.deletedAt);
  },
};

export const favorites = {
  all: async () => (await (await db()).getAll('favorites')).sort((a, b) => b.addedAt - a.addedAt),
  put: async (f: FavoritePlace) => void (await (await db()).put('favorites', f)),
  remove: async (id: string) => void (await (await db()).delete('favorites', id)),
};

export const pairings = {
  get: async (sid: string) => (await db()).get('pairing', sid),
  put: async (r: PairingRecord) => void (await (await db()).put('pairing', r)),
  remove: async (sid: string) => void (await (await db()).delete('pairing', sid)),
  /** Drops pairing records older than a day; sessions never live that long. */
  prune: async () => {
    const d = await db();
    for (const r of await d.getAll('pairing')) if (Date.now() - r.createdAt > 86_400_000) await d.delete('pairing', r.sid);
  },
};

export const sendLog = {
  add: async (e: SendLogEntry) => void (await (await db()).add('sendLog', e)),
  forTrip: async (tripId: string) => (await db()).getAllFromIndex('sendLog', 'byTrip', tripId),
  /** Sends across every trip, newest first (the 차량 tab's recent list). */
  recent: async (limit = 20) => (await (await db()).getAll('sendLog')).sort((a, b) => b.at - a.at).slice(0, limit),
};

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
}

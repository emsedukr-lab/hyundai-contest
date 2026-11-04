import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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

interface Schema extends DBSchema {
  trips: { key: string; value: TripDoc };
  pairing: { key: string; value: PairingRecord };
  sendLog: { key: number; value: SendLogEntry; indexes: { byTrip: string } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () =>
  (dbp ??= openDB<Schema>('tteonaljido', 1, {
    upgrade(d) {
      d.createObjectStore('trips', { keyPath: 'tripId' });
      d.createObjectStore('pairing', { keyPath: 'sid' });
      d.createObjectStore('sendLog', { keyPath: 'id', autoIncrement: true }).createIndex('byTrip', 'tripId');
    },
  }));

export const trips = {
  all: async () => (await (await db()).getAll('trips')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  get: async (id: string) => (await db()).get('trips', id),
  put: async (doc: TripDoc) => void (await (await db()).put('trips', doc)),
  remove: async (id: string) => void (await (await db()).delete('trips', id)),
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
};

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
}

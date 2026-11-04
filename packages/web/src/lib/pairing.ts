import {
  aadFor,
  b64url,
  canonicalJson,
  deriveSessionKeys,
  encrypt,
  exportPublicRaw,
  fingerprint,
  fromB64url,
  generateKeyPair,
  importPublicRaw,
  sharedSecret,
  utf8,
  type ClaimResponse,
  type ErrorCode,
  type QrLink,
  type SessionView,
} from '@tteonaljido/shared';
import { pairings, sendLog, type PairingRecord } from './db';
import { toTransfer, type TripDoc } from './trips';

/** Phone side of one handoff. Every network step is safe to repeat after a reload or a dropped connection. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK' | 'FINGERPRINT' | 'UNSUPPORTED_SCHEMA' | 'SEARCH_UNAVAILABLE',
    readonly status = 0,
  ) {
    super(code);
  }
}

async function api<T>(method: string, path: string, token?: string | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: ErrorCode };
  if (!res.ok) throw new ApiError(data.error ?? 'NETWORK', res.status);
  return data;
}

export const supportsWebCrypto = () => typeof crypto !== 'undefined' && !!crypto.subtle && window.isSecureContext;

/** Starts or resumes the pairing for a scanned QR. Does not contact the server. */
export async function openPairing(link: QrLink): Promise<PairingRecord> {
  const existing = await pairings.get(link.sid);
  if (existing && existing.fingerprint === link.fingerprint) return existing;
  const keyPair = await generateKeyPair(false);
  const rec: PairingRecord = {
    sid: link.sid,
    fingerprint: link.fingerprint,
    keyPair,
    mobilePub: b64url(await exportPublicRaw(keyPair.publicKey)),
    mobileToken: null,
    carPub: null,
    carAppVersion: null,
    supportedSchemaVersions: [],
    confirmCode: null,
    codeConfirmed: false,
    tripId: null,
    revision: null,
    includeHome: false,
    sealed: null,
    createdAt: Date.now(),
  };
  await pairings.put(rec);
  return rec;
}

async function sessionKeys(rec: PairingRecord) {
  const carPubRaw = fromB64url(rec.carPub!);
  const z = await sharedSecret(rec.keyPair.privateKey, await importPublicRaw(carPubRaw));
  return deriveSessionKeys(z, rec.sid, carPubRaw, fromB64url(rec.mobilePub));
}

/** Uses the one-time scan secret. The car key is checked against the fingerprint printed in the QR. */
export async function claim(rec: PairingRecord, scanSecret: string): Promise<PairingRecord> {
  if (rec.mobileToken) return rec;
  const res = await api<ClaimResponse>('POST', `/sessions/${rec.sid}/claim`, null, { scanSecret, mobilePub: rec.mobilePub });
  if ((await fingerprint(fromB64url(res.carPub))) !== rec.fingerprint) throw new ApiError('FINGERPRINT');
  const next: PairingRecord = {
    ...rec,
    mobileToken: res.mobileToken,
    carPub: res.carPub,
    carAppVersion: res.carAppVersion,
    supportedSchemaVersions: res.supportedSchemaVersions,
  };
  next.confirmCode = (await sessionKeys(next)).confirmCode;
  await pairings.put(next);
  return next;
}

export async function confirmCode(rec: PairingRecord): Promise<PairingRecord> {
  const next = { ...rec, codeConfirmed: true };
  await pairings.put(next);
  return next;
}

/** Encrypts the chosen trip once and uploads it; a retry re-sends the identical ciphertext. */
export async function send(rec: PairingRecord, doc: TripDoc, includeHome: boolean): Promise<PairingRecord> {
  if (!rec.supportedSchemaVersions.includes(1)) throw new ApiError('UNSUPPORTED_SCHEMA');
  let next = rec;
  const sameChoice = rec.sealed && rec.tripId === doc.tripId && rec.revision === doc.revision && rec.includeHome === includeHome;
  if (!sameChoice) {
    const transfer = await toTransfer(doc, includeHome);
    const keys = await sessionKeys(rec);
    const sealed = await encrypt(keys.key, utf8(canonicalJson(transfer)), aadFor(rec.sid, 1));
    next = { ...rec, tripId: doc.tripId, revision: doc.revision, includeHome, sealed: { ...sealed, schemaVersion: 1 } };
    await pairings.put(next);
  }
  await api<SessionView>('PUT', `/sessions/${rec.sid}/payload`, rec.mobileToken, next.sealed);
  return next;
}

export const status = (rec: PairingRecord) => api<SessionView>('GET', `/sessions/${rec.sid}/status`, rec.mobileToken);

export const cancel = (rec: PairingRecord) => api<SessionView>('POST', `/sessions/${rec.sid}/cancel`, rec.mobileToken);

/** Records the end of a session (no car identifiers) and forgets its keys and token. */
export async function finish(rec: PairingRecord, outcome: string) {
  if (rec.tripId && rec.revision) await sendLog.add({ tripId: rec.tripId, revision: rec.revision, at: Date.now(), outcome });
  await pairings.remove(rec.sid);
}

export interface PlaceHit {
  externalId: string;
  name: string;
  address: string;
  latE7: number;
  lonE7: number;
  category: 'SIGHT' | 'FOOD' | 'CAFE' | 'LODGING' | 'OTHER';
}

export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const res = await api<{ results: PlaceHit[] }>('GET', `/places/search?q=${encodeURIComponent(q)}`);
  return res.results;
}

import {
  aadFor,
  b64url,
  canonicalJson,
  type ClaimResponse,
  deriveSessionKeys,
  encrypt,
  type ErrorCode,
  exportPublicRaw,
  fingerprint,
  fromB64url,
  generateKeyPair,
  importPublicRaw,
  parseTransfer,
  PROTOCOL,
  type QrLink,
  type SessionView,
  sharedSecret,
  utf8,
} from '@tteonaljido/shared';
import { pairings, sendLog, type PairingRecord } from './db';
import { apiUrl } from './platform';
import { toTransfer, type TripDoc } from './trips';

/** Phone side of one handoff. Every network step is safe to repeat after a reload or a dropped connection. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK' | 'FINGERPRINT' | 'UNSUPPORTED_SCHEMA' | 'SEARCH_UNAVAILABLE' | 'INVALID_LOCAL',
    readonly status = 0,
  ) {
    super(code);
  }
}

async function api<T>(method: string, path: string, token?: string | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/v1${path}`), {
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

export const status = (rec: PairingRecord) => api<SessionView>('GET', `/sessions/${rec.sid}/status`, rec.mobileToken);

/**
 * Encrypts the chosen trip once and stores it before anything is sent, so every retry re-sends the identical ciphertext.
 * The stored record decides, not the caller's copy: an earlier attempt may have sealed (and even delivered) a body whose
 * response was lost.
 */
export async function seal(rec: PairingRecord, doc: TripDoc, includeHome: boolean): Promise<PairingRecord> {
  const saved = await pairings.get(rec.sid);
  if (!saved) throw new ApiError('NOT_FOUND'); // finished or dropped: don't bring a dead token back
  if (!saved.supportedSchemaVersions.includes(1)) throw new ApiError('UNSUPPORTED_SCHEMA');
  if (saved.sealed && saved.tripId === doc.tripId && saved.revision === doc.revision && saved.includeHome === includeHome) return saved;
  if (saved.sealed) {
    // A different choice may replace the earlier body only while the server holds nothing; once it landed, the stored body is what was sent.
    const v = await status(saved);
    if (v.state !== 'CLAIMED') throw new ApiError(v.state === 'EXPIRED' ? 'EXPIRED' : v.state === 'CANCELLED' ? 'INVALID_STATE' : 'PAYLOAD_CONFLICT');
  }
  const transfer = await toTransfer(doc, includeHome);
  // The same check the car runs on arrival, done here so a bad trip is caught before it leaves the phone.
  const checked = await parseTransfer(JSON.stringify(transfer));
  if (!checked.ok) throw new ApiError('INVALID_LOCAL');
  const plain = utf8(canonicalJson(transfer));
  // Same limit the car and the relay apply, checked here so the user hears it before anything is sent.
  if (plain.byteLength > PROTOCOL.limits.maxPlaintextBytes) throw new ApiError('PAYLOAD_TOO_LARGE', 413);
  const keys = await sessionKeys(saved);
  const sealed = await encrypt(keys.key, plain, aadFor(saved.sid, 1));
  const next: PairingRecord = { ...saved, tripId: doc.tripId, revision: doc.revision, includeHome, sealed: { ...sealed, schemaVersion: 1 } };
  await pairings.put(next);
  return next;
}

/** Uploads the sealed trip. Safe to repeat: the server accepts the identical body again, during and after the session. */
export async function upload(rec: PairingRecord): Promise<SessionView> {
  if (!rec.sealed) throw new ApiError('INVALID_LOCAL');
  return api<SessionView>('PUT', `/sessions/${rec.sid}/payload`, rec.mobileToken, rec.sealed);
}

export const cancel = (rec: PairingRecord) => api<SessionView>('POST', `/sessions/${rec.sid}/cancel`, rec.mobileToken);

/** Records the end of a session (no car identifiers) and forgets its keys and token. */
export async function finish(rec: PairingRecord, outcome: string) {
  // The stored copy names the trip that was actually sealed, even when the caller's copy is older.
  const saved = (await pairings.get(rec.sid)) ?? rec;
  if (saved.tripId && saved.revision) await sendLog.add({ tripId: saved.tripId, revision: saved.revision, at: Date.now(), outcome });
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

/** The part of the map on screen, `[minLon, minLat, maxLon, maxLat]` — never the user's own location. */
export type MapRect = [number, number, number, number];
/** The kinds a map search can look for (the map picker's chips). */
export type MapCategory = 'SIGHT' | 'FOOD' | 'CAFE' | 'LODGING';

/**
 * The term goes in the request body, not the URL, so no request log can carry it. With `rect` the search keeps to that
 * part of the map; with `category` (and `rect`) the term may be empty: every place of that kind in the rect.
 */
export async function searchPlaces(q: string, opts: { rect?: MapRect; category?: MapCategory } = {}): Promise<PlaceHit[]> {
  const body: { q: string; rect?: MapRect; category?: MapCategory } = { q };
  if (opts.rect) body.rect = opts.rect;
  if (opts.category) body.category = opts.category;
  const res = await api<{ results: PlaceHit[] }>('POST', '/places/search', null, body);
  return res.results;
}

export interface ResolvedPlace {
  /** Older servers answered without `kind`; that is a single place too. */
  kind?: 'place';
  name: string;
  address: string;
}

/** One place of a shared saved list, already located (the server read it from the list itself). */
export interface ListPlace {
  name: string;
  address: string;
  latE7: number;
  lonE7: number;
  category: PlaceHit['category'];
}

/** A Naver "저장 목록" link: the list's name, how many it holds, and its places (at most 100). No owner details. */
export interface ResolvedList {
  kind: 'list';
  source: 'naver';
  title: string;
  total: number;
  places: ListPlace[];
}

/** A link the server knows but can't read (a Kakao Map favorites folder: Kakao blocks automated access). */
export interface ResolvedUnsupported {
  kind: 'unsupported';
  source: 'kakao';
}

export type Resolved = ResolvedPlace | ResolvedList | ResolvedUnsupported;

/** Asks the server to follow a Naver/Kakao share link and read the place (or saved list) from it (throws ApiError on failure). */
export async function resolvePlace(url: string): Promise<Resolved> {
  return api<Resolved>('POST', '/places/resolve', null, { url });
}

/** A single place's name from a resolve answer, or null when the link was a list or an unsupported folder. */
export const resolvedName = (r: Resolved): string | null => (r.kind === 'list' || r.kind === 'unsupported' ? null : r.name || null);

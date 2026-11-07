import { parseTransfer, type Trip, type TripTransfer } from '@tteonaljido/shared';
import { newDoc, nowIso, toTransfer, type TripDoc } from './trips';

/**
 * 친구에게 여행 공유 (share a trip with a friend). A single trip is whitelisted through `toTransfer` — the same wire
 * shape the car receives — with the **home address left out**, then encrypted with a passcode and written to a file the
 * friend opens in their own mobile web. Nothing passes through any server (no relay, no link): the file travels over
 * whatever the two people already use (messenger, AirDrop, email). The passcode is shared out of band.
 *
 * Crypto: AES-256-GCM, key derived from the passcode with PBKDF2-SHA256 (per-file random salt). A wrong passcode fails
 * GCM authentication, so it is indistinguishable from a tampered file — we report "wrong passcode" either way.
 */

const MAGIC = 'tteonaljido-share';
const VERSION = 1;
const PBKDF2_ITERS = 150_000;

export interface ShareFile {
  schema: typeof MAGIC;
  v: number;
  /** base64 — PBKDF2 salt (16 bytes). */
  salt: string;
  /** base64 — AES-GCM IV (12 bytes). */
  iv: string;
  /** base64 — AES-GCM ciphertext of the JSON trip-transfer. */
  ct: string;
}

export type ImportResult = { ok: true; transfer: TripTransfer } | { ok: false; reason: 'format' | 'passcode' | 'invalid' };

/** A standalone ArrayBuffer copy of a byte array (WebCrypto's BufferSource types want an ArrayBuffer-backed view). */
const ab = (u: Uint8Array): ArrayBuffer => {
  const b = new ArrayBuffer(u.byteLength);
  new Uint8Array(b).set(u);
  return b;
};
const b64 = (b: ArrayBuffer | Uint8Array): string => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passcode: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', ab(new TextEncoder().encode(passcode)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** A fresh 6-digit passcode (cryptographically random), shown once so the sender can read it to the friend. */
export function newPasscode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

/** Encrypt one trip (home excluded) under `passcode` into a shareable file object. */
export async function exportShare(doc: TripDoc, passcode: string): Promise<ShareFile> {
  const transfer = await toTransfer(doc, false); // includeHome = false: a shared trip never carries the home address
  const plaintext = new TextEncoder().encode(JSON.stringify(transfer));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, ab(salt));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, key, ab(plaintext));
  return { schema: MAGIC, v: VERSION, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** True when a file's text looks like a share file (so the importer can tell it apart from a plaintext backup). */
export function isShareFile(text: string): boolean {
  try {
    const o = JSON.parse(text) as { schema?: unknown };
    return o?.schema === MAGIC;
  } catch {
    return false;
  }
}

/** Decrypt and structurally validate a shared file. Returns the same validated transfer shape the car accepts. */
export async function importShare(text: string, passcode: string): Promise<ImportResult> {
  let file: ShareFile;
  try {
    file = JSON.parse(text) as ShareFile;
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (file?.schema !== MAGIC || file.v !== VERSION || !file.salt || !file.iv || !file.ct) return { ok: false, reason: 'format' };
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(passcode, ab(unb64(file.salt)));
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ab(unb64(file.iv)) }, key, ab(unb64(file.ct)));
  } catch {
    return { ok: false, reason: 'passcode' }; // GCM auth failure = wrong passcode or tampered file
  }
  const parsed = await parseTransfer(new TextDecoder().decode(plain));
  if (!parsed.ok) return { ok: false, reason: 'invalid' };
  return { ok: true, transfer: parsed.transfer };
}

/** A fresh local trip from an imported share: a new id and revision, so it never overwrites the friend's own trips; home stays empty. */
export function docFromShare(transfer: TripTransfer): Promise<TripDoc> {
  const plan: Trip = { ...transfer.trip, tripId: crypto.randomUUID(), revision: 1, updatedAt: nowIso(), home: null };
  return newDoc(plan, null);
}

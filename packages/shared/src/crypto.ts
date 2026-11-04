import protocol from '../../../schema/pairing-protocol.v1.json' with { type: 'json' };
import { b64url, fromB64url, sha256, utf8 } from './canonical';

/**
 * End-to-end crypto for one handoff (spec 24-2): P-256 ECDH -> HKDF-SHA256 -> AES-256-GCM.
 * The relay only ever stores ciphertext. Mirrors HandoffCrypto.kt; shared vectors in schema/fixtures/crypto.
 */
const C = protocol.crypto;
const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const;

export type Bytes = Uint8Array<ArrayBuffer>;

export const randomBytes = (n: number): Bytes => crypto.getRandomValues(new Uint8Array(n));
export const randomId = () => b64url(randomBytes(C.idBytes));

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export async function generateKeyPair(extractable = false): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(P256, extractable, ['deriveBits']) as Promise<CryptoKeyPair>;
}

export async function exportPublicRaw(key: CryptoKey): Promise<Bytes> {
  return new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer);
}

export async function importPublicRaw(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error('expected uncompressed P-256 point');
  return crypto.subtle.importKey('raw', raw, P256, true, []);
}

/** First 16 bytes of SHA-256(pubRaw), base64url — printed in the QR so the phone can authenticate the car key. */
export async function fingerprint(pubRaw: Bytes): Promise<string> {
  return b64url((await sha256(pubRaw)).slice(0, C.fingerprintBytes));
}

export async function sharedSecret(privateKey: CryptoKey, peerPublic: CryptoKey): Promise<Bytes> {
  // `public` is the WebCrypto member name; some type packages spell it differently.
  const params = { name: 'ECDH', public: peerPublic } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
  return new Uint8Array(await crypto.subtle.deriveBits(params, privateKey, 256));
}

async function hkdf(z: Bytes, salt: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const ikm = await crypto.subtle.importKey('raw', z, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, ikm, bytes * 8));
}

const info = (label: string, carPub: Bytes, mobilePub: Bytes) => concat(utf8(label), new Uint8Array([0]), carPub, mobilePub);
export const saltFor = (sid: string) => sha256(utf8(C.saltPrefix + sid));
export const aadFor = (sid: string, schemaVersion: number) => utf8(`${C.aadPrefix}${sid}|${schemaVersion}`);

export interface SessionKeys {
  key: Bytes;
  confirmCode: string;
}

export async function deriveSessionKeys(z: Bytes, sid: string, carPub: Bytes, mobilePub: Bytes): Promise<SessionKeys> {
  const salt = await saltFor(sid);
  const key = await hkdf(z, salt, info(C.infoKey, carPub, mobilePub), 32);
  const c = await hkdf(z, salt, info(C.infoConfirm, carPub, mobilePub), 4);
  const n = ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0;
  return { key, confirmCode: String(n % 1_000_000).padStart(6, '0') };
}

export const formatConfirmCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export async function encrypt(key: Bytes, plaintext: Bytes, aad: Bytes, iv: Bytes = randomBytes(C.ivBytes)) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, k, plaintext));
  return { iv: b64url(iv), ct: b64url(ct) };
}

export async function decrypt(key: Bytes, iv: string, ct: string, aad: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv), additionalData: aad }, k, fromB64url(ct)));
}

/** Constant-time comparison for secrets of equal encoding. */
export function timingSafeEqual(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

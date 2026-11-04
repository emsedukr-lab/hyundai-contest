import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aadFor,
  buildTransfer,
  canonicalJson,
  contentHash,
  decrypt,
  deriveSessionKeys,
  encrypt,
  exportPublicRaw,
  fingerprint,
  fromB64url,
  generateKeyPair,
  importPublicRaw,
  parseTransfer,
  sampleTrip,
  sharedSecret,
  utf8,
  b64url,
} from '../src/index';

const schemaDir = join(__dirname, '../../../schema');
const read = (rel: string) => readFileSync(join(schemaDir, rel), 'utf8');
const expectations = JSON.parse(read('fixtures/expectations.json')) as Record<string, { valid: boolean; code?: string }>;

describe('transfer fixtures (parity contract with Kotlin)', () => {
  for (const [file, want] of Object.entries(expectations)) {
    it(file, async () => {
      const got = await parseTransfer(read(`fixtures/${file}`));
      if (want.valid) expect(got).toMatchObject({ ok: true });
      else expect(got).toMatchObject({ ok: false, code: want.code });
    });
  }
});

describe('canonical JSON', () => {
  it('sorts keys by UTF-16 code units and escapes like JSON.stringify', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'], 가: '"\n', A: { z: 0, y: -2 } })).toBe('{"A":{"y":-2,"z":0},"a":[true,null,"x"],"b":1,"가":"\\"\\n"}');
  });
  it('rejects non-integers', () => {
    expect(() => canonicalJson({ a: 0.5 })).toThrow();
  });
  it('hash ignores key order', async () => {
    const t = sampleTrip();
    const reordered = Object.fromEntries(Object.entries(t).reverse());
    expect(await contentHash(reordered)).toBe(await contentHash(t));
  });
});

describe('crypto vectors', () => {
  const v = JSON.parse(read('fixtures/crypto/vectors.json'));
  const importPrivate = (k: { d: string; x: string; y: string }) =>
    crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', ...k }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);

  it('reproduces shared secret, key, confirm code and ciphertext', async () => {
    const carPub = fromB64url(v.car.publicRaw);
    const mobilePub = fromB64url(v.mobile.publicRaw);
    const z1 = await sharedSecret(await importPrivate(v.car), await importPublicRaw(mobilePub));
    const z2 = await sharedSecret(await importPrivate(v.mobile), await importPublicRaw(carPub));
    expect(b64url(z1)).toBe(v.sharedSecret);
    expect(b64url(z2)).toBe(v.sharedSecret);
    expect(await fingerprint(carPub)).toBe(v.car.fingerprint);
    const keys = await deriveSessionKeys(z1, v.sid, carPub, mobilePub);
    expect(b64url(keys.key)).toBe(v.key);
    expect(keys.confirmCode).toBe(v.confirmCode);
    const plaintext = canonicalJson(JSON.parse(read('fixtures/valid/sample.json')));
    const sealed = await encrypt(keys.key, utf8(plaintext), aadFor(v.sid, 1), fromB64url(v.iv));
    expect(sealed.ct).toBe(v.ciphertext);
    expect(new TextDecoder().decode(await decrypt(keys.key, v.iv, v.ciphertext, aadFor(v.sid, 1)))).toBe(plaintext);
  });

  it('rejects ciphertext bound to another session', async () => {
    await expect(decrypt(fromB64url(v.key), v.iv, v.ciphertext, aadFor('other-session-id-00000', 1))).rejects.toThrow();
  });

  it('two fresh parties derive the same code; a third key does not', async () => {
    const car = await generateKeyPair();
    const phone = await generateKeyPair();
    const mitm = await generateKeyPair();
    const carPub = await exportPublicRaw(car.publicKey);
    const phonePub = await exportPublicRaw(phone.publicKey);
    const mitmPub = await exportPublicRaw(mitm.publicKey);
    const a = await deriveSessionKeys(await sharedSecret(car.privateKey, phone.publicKey), 's', carPub, phonePub);
    const b = await deriveSessionKeys(await sharedSecret(phone.privateKey, car.publicKey), 's', carPub, phonePub);
    const m = await deriveSessionKeys(await sharedSecret(car.privateKey, mitm.publicKey), 's', carPub, mitmPub);
    expect(a.confirmCode).toBe(b.confirmCode);
    expect(m.key).not.toEqual(a.key);
  });
});

describe('buildTransfer', () => {
  it('round-trips through parseTransfer', async () => {
    const t = await buildTransfer(sampleTrip(), '2026-11-05T10:00:00+09:00');
    expect(await parseTransfer(JSON.stringify(t))).toMatchObject({ ok: true });
  });
  it('rejects oversized payloads before parsing', async () => {
    expect(await parseTransfer('x'.repeat(100_000))).toMatchObject({ ok: false, code: 'TOO_LARGE' });
  });
});

/**
 * End-to-end smoke test against a running relay (wrangler dev or a deployment):
 * plays both the car and the phone, including E2E encryption and the confirm code.
 *   npx tsx tools/pairing-smoke.mts http://localhost:8787
 */
import {
  aadFor, b64url, buildTransfer, decrypt, deriveSessionKeys, encrypt, exportPublicRaw, fingerprint, formatQrUrl,
  fromB64url, generateKeyPair, importPublicRaw, parseQrFragment, parseTransfer, sampleTrip, sharedSecret, utf8,
} from '../packages/shared/src/index';

const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const api = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data as any;
};
const step = (s: string) => console.log(`✓ ${s}`);

const car = await generateKeyPair();
const carPub = await exportPublicRaw(car.publicKey);
const created = await api('POST', '/sessions', undefined, { carPub: b64url(carPub), appVersion: 'smoke', supportedSchemaVersions: [1] });
const qr = formatQrUrl(base, { sid: created.sid, scanSecret: created.scanSecret, fingerprint: await fingerprint(carPub) });
step(`car created session, QR ${qr.slice(0, base.length + 12)}… (${Math.round((created.qrExpiresAt - created.serverTime) / 1000)}s)`);

const link = parseQrFragment(new URL(qr).hash)!;
const phone = await generateKeyPair();
const phonePub = await exportPublicRaw(phone.publicKey);
const claimed = await api('POST', `/sessions/${link.sid}/claim`, undefined, { scanSecret: link.scanSecret, mobilePub: b64url(phonePub) });
if ((await fingerprint(fromB64url(claimed.carPub))) !== link.fingerprint) throw new Error('car key fingerprint mismatch');
const phoneKeys = await deriveSessionKeys(await sharedSecret(phone.privateKey, await importPublicRaw(fromB64url(claimed.carPub))), link.sid, fromB64url(claimed.carPub), phonePub);
step(`phone claimed, confirm code ${phoneKeys.confirmCode}`);

const transfer = await buildTransfer(sampleTrip(), new Date().toISOString());
const sealed = await encrypt(phoneKeys.key, utf8(JSON.stringify(transfer)), aadFor(link.sid, 1));
await api('PUT', `/sessions/${link.sid}/payload`, claimed.mobileToken, { ...sealed, schemaVersion: 1 });
step('phone uploaded ciphertext');

const got = await api('GET', `/sessions/${created.sid}/payload`, created.carToken);
const carKeys = await deriveSessionKeys(await sharedSecret(car.privateKey, await importPublicRaw(fromB64url(got.mobilePub))), created.sid, carPub, fromB64url(got.mobilePub));
if (carKeys.confirmCode !== phoneKeys.confirmCode) throw new Error('confirm codes differ');
const parsed = await parseTransfer(new TextDecoder().decode(await decrypt(carKeys.key, got.iv, got.ct, aadFor(created.sid, 1))));
if (!parsed.ok) throw new Error(`car rejected payload: ${parsed.code}`);
step(`car decrypted "${parsed.transfer.trip.name}" (codes match: ${carKeys.confirmCode})`);

await api('POST', `/sessions/${created.sid}/lock`, created.carToken);
await api('POST', `/sessions/${created.sid}/result`, created.carToken, { outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 });
const status = await api('GET', `/sessions/${link.sid}/status`, claimed.mobileToken);
if (status.state !== 'APPLIED' || status.resultCode !== 'IMPORTED_NEW') throw new Error(`phone saw ${status.state}/${status.resultCode}, expected APPLIED/IMPORTED_NEW`);
step(`phone sees ${status.state}/${status.resultCode}`);

const again = await fetch(`${base}/api/v1/sessions/${link.sid}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scanSecret: link.scanSecret, mobilePub: b64url(phonePub) }) });
if (again.status !== 409) throw new Error(`reused QR returned ${again.status}`);
step('reused QR refused (409)');
console.log('pairing smoke test passed');

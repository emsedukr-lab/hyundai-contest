/**
 * Real-phone test without the car emulator: this script plays the car against a relay, shows the QR
 * on the Mac screen, and reports each step as the phone (default camera + browser) goes through it.
 * The trip is decrypted and validated with the same shared code the car uses, then "applied".
 *   npx tsx tools/phone-test.mts [https://tteonaljido.tteonaljido-worker.workers.dev]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import {
  aadFor, b64url, decrypt, deriveSessionKeys, exportPublicRaw, fingerprint, formatQrUrl, fromB64url,
  generateKeyPair, importPublicRaw, parseTransfer, sharedSecret,
} from '../packages/shared/src/index';

const base = (process.argv[2] ?? 'https://tteonaljido.tteonaljido-worker.workers.dev').replace(/\/$/, '');
const out = fileURLToPath(new URL('../.work/', import.meta.url));
mkdirSync(out, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${s}`);

const api = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
};

async function newSession() {
  const car = await generateKeyPair();
  const carPub = await exportPublicRaw(car.publicKey);
  const s = await api('POST', '/sessions', undefined, { carPub: b64url(carPub), appVersion: 'phone-test', supportedSchemaVersions: [1] });
  const url = formatQrUrl(base, { sid: s.sid, scanSecret: s.scanSecret, fingerprint: await fingerprint(carPub) });
  const png = `${out}phone-test-qr.png`;
  await QRCode.toFile(png, url, { errorCorrectionLevel: 'M', margin: 4, scale: 12, color: { dark: '#000000', light: '#FFFFFF' } });
  try {
    execFileSync('open', [png]);
  } catch {
    /* not on macOS */
  }
  log(`새 QR 표시 (${png}) · 5분 동안 1회 · 휴대폰 기본 카메라로 스캔하세요. 세션 ${s.sid.slice(0, 4)}…`);
  return { car, carPub, s };
}

// Re-issues the QR while nobody has connected, so the tester is not racing the 5-minute window.
const giveUp = Date.now() + 30 * 60_000;
let { car, carPub, s } = await newSession();
let code = '';
let last = '';
while (Date.now() < giveUp) {
  const v = await api('GET', `/sessions/${s.sid}`, s.carToken).catch((e) => ({ state: 'ERROR', error: String(e) }));
  if (v.state === 'EXPIRED' && v.expireReason === 'QR') {
    log('QR 만료(휴대폰 연결 없음) → 새 QR');
    ({ car, carPub, s } = await newSession());
    last = '';
    continue;
  }
  if (v.state !== last) {
    last = v.state;
    if (v.state === 'CLAIMED') {
      const mp = fromB64url(v.mobilePub);
      code = (await deriveSessionKeys(await sharedSecret(car.privateKey, await importPublicRaw(mp)), s.sid, carPub, mp)).confirmCode;
      log(`휴대폰 연결됨 · 차량 쪽 확인 코드 ${code.slice(0, 3)} ${code.slice(3)} (휴대폰 화면과 같은지 보세요)`);
    } else if (v.state === 'MOBILE_APPROVED') {
      const p = await api('GET', `/sessions/${s.sid}/payload`, s.carToken);
      const mp = fromB64url(p.mobilePub);
      const keys = await deriveSessionKeys(await sharedSecret(car.privateKey, await importPublicRaw(mp)), s.sid, carPub, mp);
      const parsed = await parseTransfer(new TextDecoder().decode(await decrypt(keys.key, p.iv, p.ct, aadFor(s.sid, p.schemaVersion))));
      if (!parsed.ok) {
        log(`받은 여행이 올바르지 않음: ${parsed.code}`);
        await api('POST', `/sessions/${s.sid}/result`, s.carToken, { outcome: 'REJECTED', resultCode: 'INVALID_PAYLOAD', appliedRevision: null });
        break;
      }
      const t = parsed.transfer.trip;
      log(`받음: ${t.name} v${t.revision} · ${t.startDate}~${t.endDate} · 장소 ${t.places.length}곳 · 집 주소 ${t.home ? '포함' : '미포함'}`);
      log('휴대폰에 "차량이 받았어요 · 아직 적용 전"이 보이는지 확인하세요. 5초 뒤 차량 승인으로 처리합니다.');
      await sleep(5000);
      await api('POST', `/sessions/${s.sid}/lock`, s.carToken);
      await api('POST', `/sessions/${s.sid}/result`, s.carToken, { outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: t.revision });
      log('적용 보고 완료 · 휴대폰에 "차량에 새 여행으로 불러왔어요"가 보여야 합니다.');
    } else {
      log(`상태: ${v.state}${v.expireReason ? ` (${v.expireReason})` : ''}${v.cancelReason ? ` (${v.cancelReason})` : ''}${v.error ? ` ${v.error}` : ''}`);
    }
    if (['APPLIED', 'REJECTED', 'CANCELLED'].includes(v.state) || (v.state === 'EXPIRED' && v.expireReason !== 'QR')) break;
  }
  await sleep(1000);
}
log('시험 끝');

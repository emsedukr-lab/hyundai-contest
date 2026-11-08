/**
 * Browser E2E for the phone side (spec 24-1 steps 2–9, 24-6 mobile screens):
 * a Node "fake car" creates the session and decrypts the payload; real Chrome plays the phone.
 * Needs `npm run build -w @tteonaljido/web` and `wrangler dev` on :8787 (or pass a base URL).
 *   npx tsx tools/e2e-mobile.mts [http://localhost:8787]
 * Screenshots go to docs/evidence/m3/.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import {
  aadFor, b64url, decrypt, deriveSessionKeys, exportPublicRaw, fingerprint, formatQrUrl, fromB64url,
  generateKeyPair, importPublicRaw, parseTransfer, sharedSecret,
} from '../packages/shared/src/index';

const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const shots = fileURLToPath(new URL('../docs/evidence/m3/', import.meta.url));
mkdirSync(shots, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`✓ ${what}`);
};
const until = async (f: () => Promise<boolean>, what: string, ms = 10_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await f()) return check(true, what);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout: ${what}`);
};
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}${name}.png`, fullPage: true });

// Car creates a session.
const car = await generateKeyPair();
const carPub = await exportPublicRaw(car.publicKey);
const s = await api('POST', '/sessions', undefined, { carPub: b64url(carPub), appVersion: 'e2e-car', supportedSchemaVersions: [1] });
const qr = formatQrUrl(base, { sid: s.sid, scanSecret: s.scanSecret, fingerprint: await fingerprint(carPub) });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', isMobile: true, hasTouch: true });
const page = await ctx.newPage();
try {
  await page.goto(qr);
  await page.getByText('차량 연결 요청').waitFor();
  check(new URL(page.url()).hash === '', 'QR secret removed from the address bar');
  const snap0 = await api('GET', `/sessions/${s.sid}`, s.carToken);
  check(snap0.state === 'CREATED', 'opening the link alone does not claim the session');
  await shot(page, '01-intro');

  await click(page, '연결하고 확인 코드 보기');
  await page.getByText('확인 코드를 비교해 주세요').waitFor();
  const phoneCode = (await page.getByText(/^\d{3} \d{3}$/).textContent())!.replace(' ', '');
  const snap1 = await api('GET', `/sessions/${s.sid}`, s.carToken);
  const mobilePub = fromB64url(snap1.mobilePub);
  const keys = await deriveSessionKeys(await sharedSecret(car.privateKey, await importPublicRaw(mobilePub)), s.sid, carPub, mobilePub);
  check(keys.confirmCode === phoneCode, `phone and car show the same code (${phoneCode})`);
  await shot(page, '02-code');

  await click(page, '같아요');
  await page.getByText('차량으로 보낼 여행').waitFor();
  await click(page, '샘플 여행 추가');
  await page.getByText('강릉 3박 4일').first().waitFor();
  await shot(page, '03-pick');
  await click(page, '다음');
  await page.getByText('보낼 정보 확인').waitFor();
  await shot(page, '04-consent');
  await click(page, '다음');
  await page.getByText('보내기 전에 확인').waitFor();
  await shot(page, '05-approve');
  await click(page, '차량으로 보내기');
  await page.getByText('차량으로 보냈어요 · 아직 적용 전').waitFor();
  check(true, 'phone says "sent, not applied yet" before the car fetches');
  await shot(page, '06-sent');

  const got = await api('GET', `/sessions/${s.sid}/payload`, s.carToken);
  const parsed = await parseTransfer(new TextDecoder().decode(await decrypt(keys.key, got.iv, got.ct, aadFor(s.sid, 1))));
  check(parsed.ok, 'car decrypts and validates the trip');
  if (parsed.ok) {
    const t = parsed.transfer.trip;
    check(t.days.length === 4 && t.days[1].lodgingPlaceRef === 'shilla', 'multi-day days and lodging survive the transfer');
    check(t.visits.find((v) => v.visitId === 'v5')?.fixed?.time === '13:00', 'fixed schedule survives the transfer');
    check(t.home === null, 'home address not sent without consent');
  }
  await page.getByText('차량이 받았어요 · 아직 적용 전').waitFor();
  check(true, 'phone says "car received, not applied yet"');

  await api('POST', `/sessions/${s.sid}/lock`, s.carToken);
  await api('POST', `/sessions/${s.sid}/result`, s.carToken, { outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 });
  await page.getByText('차량에 새 여행으로 불러왔어요').waitFor();
  check(true, 'phone shows "applied" only after the car reports it');
  await shot(page, '07-applied');

  const second = await ctx.newPage();
  await second.goto(qr);
  await second.getByRole('button', { name: '연결하고 확인 코드 보기' }).click();
  await until(async () => (await second.getByText('이미 사용된 QR이에요', { exact: false }).count()) > 0, 'reusing the QR is refused');
  await shot(second, '08-reused');
  // W2: a browser without WebCrypto still removes the secret from the address bar before it gives up.
  const car2 = await generateKeyPair();
  const carPub2 = await exportPublicRaw(car2.publicKey);
  const s2 = await api('POST', '/sessions', undefined, { carPub: b64url(carPub2), appVersion: 'e2e-car', supportedSchemaVersions: [1] });
  const qr2 = formatQrUrl(base, { sid: s2.sid, scanSecret: s2.scanSecret, fingerprint: await fingerprint(carPub2) });
  const noCrypto = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', isMobile: true, hasTouch: true });
  await noCrypto.addInitScript("Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined, configurable: true });"); // a string: tsx would inject a helper into a function
  const bare = await noCrypto.newPage();
  await bare.goto(qr2);
  await bare.getByText('이 브라우저에서는 연결할 수 없어요').waitFor();
  check(new URL(bare.url()).hash === '', 'without WebCrypto the secret is still removed from the address bar');
  await noCrypto.close();

  // M11/M12 features (independent of the pairing flow): place-share intake and friend-share.
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(base);
  await mp.getByRole('button', { name: /샘플/ }).first().click();
  await mp.getByText('강릉 3박 4일').first().waitFor();
  // Place-share intake: a map app shares a place to /add?title=…
  await mp.goto(`${base}/add?title=${encodeURIComponent('경포호')}`);
  await mp.getByText('장소 추가').waitFor();
  check((await mp.getByText("'경포호'", { exact: false }).count()) > 0, 'shared place name shown on /add');
  await shot(mp, '09-add-shared');
  // Friend-share dialog: encrypted file, home excluded, 6-digit passcode.
  const tripId = (await mp.evaluate(
    () => new Promise<string>((res) => { const r = indexedDB.open('tteonaljido'); r.onsuccess = () => { const tx = r.result.transaction('trips').objectStore('trips').getAllKeys(); tx.onsuccess = () => res(String(tx.result[0])); }; }),
  )) as string;
  await mp.goto(`${base}/trips/${tripId}`);
  // Sharing sits in the editor's 더보기 menu.
  await mp.getByRole('button', { name: '더보기', exact: true }).click();
  await mp.getByRole('menuitem', { name: '친구에게 공유' }).click();
  await mp.getByText('친구에게 여행 공유').waitFor();
  check((await mp.getByText('집 주소는 공유되지 않아요').count()) > 0, 'friend-share excludes the home address');
  check((await mp.getByText(/^\d{6}$/).count()) > 0, 'friend-share shows a 6-digit passcode');
  await shot(mp, '10-share');
  await m.close();

  console.log('mobile E2E passed');
} finally {
  await browser.close();
}

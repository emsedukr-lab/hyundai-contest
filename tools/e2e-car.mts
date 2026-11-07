/**
 * Full handoff E2E on the Pleos Connect emulator: the real car app (adb + UI Automator) and a real browser
 * as the phone. Covers spec 24-1 steps 1–9, the decision table for a resend, QR scanability from the car's
 * own screen, and hiding the QR while driving (emulator demo gate). Needs the dev debug APK and `wrangler dev` on :8787.
 *   npx tsx tools/e2e-car.mts [emulator-serial]
 * Screenshots go to docs/evidence/m4/.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright-core';

const SERIAL = process.argv[2] ?? process.env.ANDROID_SERIAL ?? 'emulator-5580';
const ADB = process.env.ANDROID_ADB ?? `${homedir()}/Library/Android/sdk/platform-tools/adb`;
const PKG = 'io.tteonaljido.car';
const USER = process.env.CAR_USER ?? '10';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = fileURLToPath(new URL('../docs/evidence/m4/', import.meta.url));
mkdirSync(shots, { recursive: true });

const adb = (...args: string[]) => execFileSync(ADB, ['-s', SERIAL, ...args], { maxBuffer: 64 << 20 });
const sh = (cmd: string) => adb('shell', cmd).toString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`✓ ${what}`);
};

interface Node { text: string; desc: string; x: number; y: number }
function ui(): Node[] {
  // The Pleos driving view (a separate system window) sometimes answers the dump instead of our app: retry until our tree is there.
  let xml = '';
  for (let i = 0; i < 4 && !xml.includes('package="io.tteonaljido.car"'); i++) {
    try {
      sh('uiautomator dump /sdcard/ui.xml >/dev/null 2>&1');
      xml = sh('cat /sdcard/ui.xml');
    } catch {
      xml = '';
    }
  }
  if (!xml.includes('package="io.tteonaljido.car"')) return [];
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => {
    const n = m[0];
    const [, x1, y1, x2, y2] = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)!.map(Number);
    return { text: n.match(/ text="([^"]*)"/)![1], desc: n.match(/content-desc="([^"]*)"/)![1], x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  });
}
async function waitFor(pred: (nodes: Node[]) => Node | undefined, what: string, ms = 40_000): Promise<Node> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = pred(ui());
    if (hit) return hit;
    await sleep(1_500); // each poll launches a UI Automator runtime in the guest; keep it light
  }
  throw new Error(`timeout waiting for car: ${what}`);
}
const byText = (t: string | RegExp) => (ns: Node[]) => ns.find((n) => (typeof t === 'string' ? n.text.includes(t) : t.test(n.text)));
const byTag = (tag: string) => (ns: Node[]) => ns.find((n) => n.desc === tag);
const tap = (n: Node) => sh(`input tap ${Math.round(n.x)} ${Math.round(n.y)}`);
const carShot = (name: string) => {
  const png = adb('exec-out', 'screencap', '-p');
  writeFileSync(`${shots}${name}.png`, png);
  return png;
};
const decodeQr = (png: Buffer) => {
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
};
const qrFromLog = () => {
  const lines = adb('logcat', '-d', '-s', 'Tteonaljido:D').toString().split('\n').filter((l) => l.includes('QR '));
  return lines.at(-1)?.split('QR ')[1]?.trim() ?? null;
};
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

async function phoneSends(page: Page, url: string, addSample: boolean) {
  await page.goto(url);
  await click(page, '연결하고 확인 코드 보기');
  await page.getByText('확인 코드를 비교해 주세요').waitFor();
  const code = (await page.getByText(/^\d{3} \d{3}$/).textContent())!;
  await click(page, '같아요');
  await page.getByText('차량으로 보낼 여행').waitFor();
  if (addSample) await click(page, '샘플 여행 추가');
  else await page.getByText('강릉 3박 4일').first().click();
  await click(page, '다음');
  await click(page, '다음');
  await click(page, '차량으로 보내기');
  return code;
}

async function newQr(): Promise<string> {
  adb('logcat', '-c');
  tap(await waitFor(byTag('import'), 'import button'));
  await waitFor(byText('남은 시간'), 'QR screen');
  await sleep(500);
  const url = qrFromLog();
  check(url?.includes('/c#v1.'), 'car created a one-time session and shows a QR');
  return url!;
}

// The emulator's VHAL injection is blocked on user builds, so driving is simulated with the app's
// emulator-only demo gate (debug builds). Demo mode also keeps test data out of the real store.
const demo = (driving: boolean) => sh(`am start --user ${USER} -n ${PKG}/.MainActivity --ez demo true --ez demoDriving ${driving}`);
sh(`am force-stop ${PKG}`);
demo(false);
await waitFor(byText('떠날지도'), 'app start');
// Start clean through the app's own UI (also exercises "모든 여행 삭제").
// Debug builds: the demo store is emptied by an intent, not through the Settings popup (UI Automator misses popups on a loaded emulator).
sh(`am start --user ${USER} -n ${PKG}/.MainActivity --ez demo true --ez demoDriving false --ez demoWipe true`);
await waitFor(byText('저장된 여행이 없어요'), 'empty trip list');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
try {
  /* ---------- round 1: new trip ---------- */
  const url1 = await newQr();
  const scanned = decodeQr(carShot('02-qr'));
  check(scanned === url1, 'QR decodes from a screenshot of the car screen to the session link');
  check(!/[?&](trip|home|token)/i.test(scanned ?? '') && new URL(scanned!).search === '', 'QR carries no trip, address or token in path/query');

  demo(true);
  await waitFor(byText('주행 중에는 사용할 수 없어요'), 'driving lock screen');
  check(decodeQr(carShot('03-driving-hides-qr')) === null, 'no QR is on screen while driving');
  demo(false);
  await waitFor(byText('남은 시간'), 'QR back after parking');
  check(decodeQr(carShot('03b-qr-back')) === url1, 'session survives the driving interruption (same QR after parking)');

  const page = await ctx.newPage();
  const phoneCode = await phoneSends(page, url1, true);
  await waitFor(byText('받은 여행 확인'), 'car review screen');
  check(byText(`코드 ${phoneCode}`)(ui()), `car summary shows the same confirm code as the phone (${phoneCode})`);
  carShot('04-review-new');
  await page.getByText('차량이 받았어요 · 아직 적용 전').waitFor();
  check(!(await page.getByText('차량에 새 여행으로 불러왔어요').isVisible().catch(() => false)), 'phone waits for the car approval (sent ≠ applied)');
  check(byText('새 여행이에요')(ui()), 'car offers "새 여행" for an unknown trip');
  tap(await waitFor(byTag('choice_IMPORT_NEW'), 'import choice'));
  await waitFor(byText('새 여행으로 불러왔어요'), 'car done');
  carShot('05-imported');
  await page.getByText('차량에 새 여행으로 불러왔어요').waitFor();
  check(await page.getByText('차량에 새 여행으로 불러왔어요').isVisible(), 'phone shows applied only after the car approved');

  tap(await waitFor(byText('여행 보기'), 'open trip'));
  await waitFor(byText('다음 목적지'), 'trip detail');
  carShot('06-detail');
  check(byText('스카이베이호텔 경포')(ui()) || byText('묵을 곳')(ui()), 'day plan with lodging is shown in the car');
  sh('input keyevent KEYCODE_BACK');

  /* ---------- round 2: same trip again → no duplicate ---------- */
  await waitFor(byTag('import'), 'trip list');
  const before = ui().filter((n) => n.text === '강릉 3박 4일').length;
  const url2 = await newQr();
  check(url2 !== url1, 'a new QR is a new session');
  const page2 = await ctx.newPage();
  await phoneSends(page2, url2, false);
  await waitFor(byText('이미 불러온 여행과 같아요'), 'same-version notice');
  carShot('07-same-version');
  tap(await waitFor(byTag('choice_ACKNOWLEDGE_SAME'), 'acknowledge'));
  await page2.getByText('차량에 이미 같은 버전이 있어요').waitFor();
  check(await page2.getByText('차량에 이미 같은 버전이 있어요').isVisible(), 'resending the same revision changes nothing and tells the phone');
  sh('input keyevent KEYCODE_BACK');
  await waitFor(byTag('import'), 'trip list');
  const after = ui().filter((n) => n.text === '강릉 3박 4일').length;
  check(after === before && after === 1, `no duplicate trip after the resend (${before} → ${after})`);
  carShot('08-list');

  /* ---------- round 3: reuse of an old QR ---------- */
  const page3 = await ctx.newPage();
  await page3.goto(url1);
  await click(page3, '연결하고 확인 코드 보기');
  await page3.getByText('이미 사용된 QR이에요', { exact: false }).waitFor();
  check(await page3.getByText('이미 사용된 QR이에요', { exact: false }).isVisible(), 'a used QR cannot be claimed again');

  /* ---------- round 4: M12 — bundle send on the trip's own day (defer/pre-send are unit-tested + manual) ---------- */
  // Put the demo clock on day 2 (2026-11-21) so the live "오늘 경로 전송" (multi-stop send) surfaces for that day.
  sh(`am start --user ${USER} -n ${PKG}/.MainActivity --ez demo true --ez demoDriving false --es demoNow 2026-11-21T09:00`);
  tap(await waitFor(byText('강릉 3박 4일'), 'open trip on day 2'));
  await waitFor(byText('다음 목적지'), 'trip detail (today)');
  carShot('09-bundle-send');
  check(byTag('guideToday')(ui()), 'car shows "오늘 경로 전송" (bundle send) on a day with ≥2 upcoming stops');
  sh('input keyevent KEYCODE_BACK');

  console.log('car E2E passed');
} finally {
  demo(false);
  await browser.close();
}

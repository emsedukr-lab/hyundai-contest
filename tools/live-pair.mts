/**
 * Live pairing check, as a user meets it: the SIGNED RELEASE car APK on the Pleos Connect emulator and the deployed
 * mobile web (a phone-sized Chrome) talking through the deployed server. No debug hooks: the QR is read from the car's
 * own screen, the car is driven only by taps on its UI. Screenshots of both screens at every step go to OUT.
 *   npx tsx tools/live-pair.mts [emulator-serial] [out-dir]
 *   LIVE_ORIGIN=CURRENT … sends the same trip starting from the car's current location (no start place chosen).
 *   LIVE_START=2026-11-13 … sends it moved to start on that day.
 *   LIVE_DAY1=v3,v1,v2 … sends it with day 1 in that order and its legs untimed (M63: a day the car's navigation can reorder).
 *   LIVE_DEMO=1 … pairs into the emulator's demo store (설정 → 시연 모드), for the demo clock and driving switch.
 * Needs: the emulator running with apk/떠날지도_release.apk installed fresh (empty trip list).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright-core';

const SERIAL = process.argv[2] ?? 'emulator-5580';
const OUT = (process.argv[3] ?? 'docs/evidence/live-pair').replace(/\/?$/, '/');
const BASE = 'https://tteonaljido.tteonaljido-worker.workers.dev';
const ADB = process.env.ANDROID_ADB ?? `${homedir()}/Library/Android/sdk/platform-tools/adb`;
const PKG = 'io.tteonaljido.car';
const USER = process.env.CAR_USER ?? '10';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });

const adb = (...args: string[]) => execFileSync(ADB, ['-s', SERIAL, ...args], { maxBuffer: 64 << 20 });
const sh = (cmd: string) => adb('shell', cmd).toString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: { ok: boolean; what: string }[] = [];
const check = (ok: unknown, what: string) => {
  results.push({ ok: !!ok, what });
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) throw new Error(`FAILED: ${what}`);
};

interface Node { text: string; desc: string; x: number; y: number }
function ui(): Node[] {
  let xml = '';
  for (let i = 0; i < 4 && !xml.includes(`package="${PKG}"`); i++) {
    try {
      sh('uiautomator dump /sdcard/ui.xml >/dev/null 2>&1');
      xml = sh('cat /sdcard/ui.xml');
    } catch {
      xml = '';
    }
  }
  if (!xml.includes(`package="${PKG}"`)) return [];
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => {
    const n = m[0];
    const [, x1, y1, x2, y2] = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)!.map(Number);
    return { text: n.match(/ text="([^"]*)"/)![1], desc: n.match(/content-desc="([^"]*)"/)![1], x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  });
}
async function waitFor(pred: (nodes: Node[]) => Node | undefined, what: string, ms = 45_000): Promise<Node> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = pred(ui());
    if (hit) return hit;
    await sleep(1_500);
  }
  throw new Error(`timeout waiting for car: ${what}`);
}
const byText = (t: string | RegExp) => (ns: Node[]) => ns.find((n) => (typeof t === 'string' ? n.text.includes(t) : t.test(n.text)));
const byTag = (tag: string) => (ns: Node[]) => ns.find((n) => n.desc === tag);
const tap = (n: Node) => sh(`input tap ${Math.round(n.x)} ${Math.round(n.y)}`);
const carShot = (name: string) => {
  const png = adb('exec-out', 'screencap', '-p');
  writeFileSync(`${OUT}${name}-car.png`, png);
  return png;
};
const phoneShot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}-phone.png` });
const decodeQr = (png: Buffer) => {
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
};
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

async function newQr(name: string): Promise<string> {
  tap(await waitFor(byTag('import'), 'import button'));
  await waitFor(byText('남은 시간'), 'QR screen');
  await sleep(800);
  const url = decodeQr(carShot(name));
  check(url?.startsWith(`${BASE}/c#v1.`), `car shows a one-time QR for the deployed server (${url?.slice(0, 60)}…)`);
  check(new URL(url!).search === '' && !/trip|home|token/i.test(new URL(url!).pathname), 'the QR link carries no trip, address or token');
  return url!;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
try {
  /* ---------- 0. both apps open ---------- */
  sh(`am force-stop ${PKG}`);
  sh(`am start --user ${USER} -n ${PKG}/.MainActivity`);
  if (process.env.LIVE_DEMO) {
    // LIVE_DEMO=1: pair into the emulator's demo store (설정 → 시연 모드), so the demo clock and driving switch can be used on the trip.
    tap(await waitFor((ns) => ns.find((n) => n.text === '설정'), 'settings button'));
    tap(await waitFor(byText('시연 모드'), 'demo mode switch'));
    await sleep(800);
    sh('input keyevent 4');
  }
  await waitFor(byText('저장된 여행이 없어요'), 'empty trip list');
  carShot('01');
  const phone = await ctx.newPage();
  await phone.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await phone.evaluate(async () => {
    localStorage.clear();
    await new Promise((r) => { const q = indexedDB.deleteDatabase('tteonaljido'); q.onsuccess = q.onerror = q.onblocked = r; });
  });
  await phone.goto(`${BASE}/?sample=1`, { waitUntil: 'networkidle' });
  await phone.getByText('강릉 3박 4일').first().waitFor();
  // LIVE_ORIGIN=CURRENT: the same trip with no start place chosen (M59) — the first day starts from where the car is.
  // LIVE_START=YYYY-MM-DD: the same trip moved to start on that day (so day 1 can be "today" on the car).
  if (process.env.LIVE_ORIGIN === 'CURRENT' || process.env.LIVE_START || process.env.LIVE_DAY1) {
    await phone.evaluate(async ({ current, start, day1 }) => {
      const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open('tteonaljido'); q.onsuccess = () => r(q.result); });
      const tx = db.transaction('trips', 'readwrite');
      const st = tx.objectStore('trips');
      const all = await new Promise<any[]>((r) => { const q = st.getAll(); q.onsuccess = () => r(q.result); }); // eslint-disable-line @typescript-eslint/no-explicit-any
      const d = all.find((x) => x.plan.name === '강릉 3박 4일');
      if (current) d.plan.origin = { kind: 'CURRENT' };
      if (start) {
        // no helper function in here: the bundler's name helper does not exist inside the page
        const t0 = Date.parse(`${start}T00:00:00Z`);
        for (let i = 0; i < d.plan.days.length; i++) d.plan.days[i].date = new Date(t0 + i * 86_400_000).toISOString().slice(0, 10);
        d.plan.startDate = d.plan.days[0].date;
        d.plan.endDate = d.plan.days[d.plan.days.length - 1].date;
      }
      if (day1) {
        d.plan.days[0].visitOrder = day1;
        d.plan.days[0].legs = d.plan.days[0].legs.map(() => null);
      }
      st.put(d);
      await new Promise((r) => (tx.oncomplete = r));
    }, { current: process.env.LIVE_ORIGIN === 'CURRENT', start: process.env.LIVE_START ?? null, day1: process.env.LIVE_DAY1?.split(',') ?? null });
    await phone.reload({ waitUntil: 'networkidle' });
    await phone.getByText('강릉 3박 4일').first().waitFor();
  }
  await phoneShot(phone, '01');
  const carVersion = sh(`dumpsys package ${PKG}`).match(/versionName=(\S+)/)?.[1] ?? '?';
  check(true, `car app (release ${carVersion}) and mobile web (deployed) are both open: car has no trips, phone has "강릉 3박 4일"`);

  /* ---------- 1. car shows a QR, phone opens it ---------- */
  const url1 = await newQr('02');
  await phone.goto(url1, { waitUntil: 'networkidle' });
  await phoneShot(phone, '02');
  await click(phone, '연결하고 확인 코드 보기');
  await phone.getByText('확인 코드를 비교해 주세요').waitFor();
  const code = (await phone.getByText(/^\d{3} \d{3}$/).textContent())!;
  await sleep(1500);
  await phoneShot(phone, '03');
  const carCode = await waitFor(byText(code), `car shows the confirm code ${code}`, 20_000).catch(() => null);
  carShot('03');
  check(carCode, `phone and car show the same confirm code (${code})`);

  /* ---------- 2. phone picks the trip and sends it ---------- */
  await click(phone, '같아요');
  await phone.getByText('차량으로 보낼 여행').waitFor();
  await phone.getByText('강릉 3박 4일').first().click();
  await phoneShot(phone, '04');
  await click(phone, '다음');
  await sleep(600);
  await phoneShot(phone, '05');
  await click(phone, '다음');
  await sleep(600);
  await phoneShot(phone, '06');
  await click(phone, '차량으로 보내기');

  /* ---------- 3. car reviews it; phone waits for the car ---------- */
  await waitFor(byText('받은 여행 확인'), 'car review screen');
  check(byText(`코드 ${code}`)(ui()), 'the car review is labelled with the same code');
  check(byText('강릉 3박 4일')(ui()), 'the car received "강릉 3박 4일"');
  carShot('07');
  await phone.getByText('차량이 받았어요 · 아직 적용 전').waitFor();
  await phoneShot(phone, '07');
  check(true, 'phone says "sent, not applied yet" while the car reviews');

  /* ---------- 4. car imports; phone sees it applied ---------- */
  tap(await waitFor(byTag('choice_IMPORT_NEW'), 'import choice'));
  await waitFor(byText('새 여행으로 불러왔어요'), 'car done');
  carShot('08');
  await phone.getByText('차량에 새 여행으로 불러왔어요').waitFor();
  await phoneShot(phone, '08');
  check(true, 'phone shows "applied" only after the car imported');

  /* ---------- 5. the trip in the car ---------- */
  tap(await waitFor(byText('여행 보기'), 'open trip'));
  await waitFor(byText('다음 목적지'), 'trip detail');
  await sleep(800);
  carShot('09');
  const nodes = ui();
  check(byText('강릉 3박 4일')(nodes), 'the car shows the trip detail');
  check(byText(/스카이베이호텔 경포|묵을 곳/)(nodes), 'the day plan with lodging arrived intact');
  sh('input keyevent KEYCODE_BACK');

  /* ---------- 6. same trip again: no duplicate ---------- */
  await waitFor(byTag('import'), 'trip list');
  const url2 = await newQr('10');
  check(url2 !== url1, 'a new QR is a new session');
  const phone2 = await ctx.newPage();
  await phone2.goto(url2, { waitUntil: 'networkidle' });
  await click(phone2, '연결하고 확인 코드 보기');
  await phone2.getByText('확인 코드를 비교해 주세요').waitFor();
  await click(phone2, '같아요');
  await phone2.getByText('차량으로 보낼 여행').waitFor();
  await phone2.getByText('강릉 3박 4일').first().click();
  await click(phone2, '다음');
  await click(phone2, '다음');
  await click(phone2, '차량으로 보내기');
  await waitFor(byText('이미 불러온 여행과 같아요'), 'same-version notice');
  carShot('11');
  tap(await waitFor(byTag('choice_ACKNOWLEDGE_SAME'), 'acknowledge'));
  await phone2.getByText('차량에 이미 같은 버전이 있어요').waitFor();
  await phoneShot(phone2, '11');
  sh('input keyevent KEYCODE_BACK');
  await waitFor(byTag('import'), 'trip list');
  const count = ui().filter((n) => n.text === '강릉 3박 4일').length;
  carShot('12');
  check(count === 1, `resending the same version adds nothing (trips named "강릉 3박 4일": ${count})`);

  /* ---------- 7. an old QR cannot be reused ---------- */
  const phone3 = await ctx.newPage();
  await phone3.goto(url1, { waitUntil: 'networkidle' });
  await click(phone3, '연결하고 확인 코드 보기');
  await phone3.getByText('이미 사용된 QR이에요', { exact: false }).waitFor();
  await phoneShot(phone3, '12');
  check(true, 'a used QR is refused on the phone');

  console.log(`live pairing passed (${results.length} checks)`);
} finally {
  writeFileSync(`${OUT}results.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, serial: SERIAL, results }, null, 2));
  await browser.close();
}

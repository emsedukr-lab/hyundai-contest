/**
 * Records the demo take: the release car app on the Pleos emulator (adb screenrecord, full 2560×1440) and a phone
 * browser (Chrome screencast at 2× device pixels), against the deployed relay. Also samples the car app's memory.
 * Output in .work/demo/: car_N.mp4, phone.mp4, timeline.json (captions, waits, offsets, memory samples).
 * tools/compose-demo.mts (landscape) and tools/compose-shorts.mts (vertical) turn it into media/demo/*.mp4.
 *   npx tsx tools/record-demo.mts [emulator-serial]
 * The QR is read from a screenshot of the car screen, exactly as a phone camera would.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright-core';

const SERIAL = process.argv[2] ?? 'emulator-5580';
const ADB = `${homedir()}/Library/Android/sdk/platform-tools/adb`;
const PKG = 'io.tteonaljido.car';
const HOME = 'https://tteonaljido.tteonaljido-worker.workers.dev/';
const work = fileURLToPath(new URL('../.work/demo/', import.meta.url));

mkdirSync(work, { recursive: true });


const adb = (...a: string[]) => execFileSync(ADB, ['-s', SERIAL, ...a], { maxBuffer: 64 << 20 });
const sh = (c: string) => adb('shell', c).toString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const [, a, b, c, d] = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)!.map(Number);
    return { text: n.match(/ text="([^"]*)"/)![1], desc: n.match(/content-desc="([^"]*)"/)![1], x: (a + c) / 2, y: (b + d) / 2 };
  });
}
async function waitFor(pred: (n: Node[]) => Node | undefined, what: string, ms = 40_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = pred(ui());
    if (hit) return hit;
    await sleep(1_500); // each poll launches a UI Automator runtime in the guest; keep it light
  }
  throw new Error(`timeout: ${what}`);
}
const byText = (t: string) => (ns: Node[]) => ns.find((n) => n.text.includes(t));
const byTag = (t: string) => (ns: Node[]) => ns.find((n) => n.desc === t);
const tap = (n: Node) => sh(`input tap ${Math.round(n.x)} ${Math.round(n.y)}`);
/** Taps the target until the expected screen shows up (a first tap can land before the app has settled). */
async function tapUntil(target: (n: Node[]) => Node | undefined, expect: (n: Node[]) => Node | undefined, what: string) {
  for (let i = 0; i < 4; i++) {
    tap(await waitFor(target, `${what} (target)`));
    try {
      return await waitFor(expect, what, 8_000);
    } catch {
      console.log(`retry tap: ${what}`);
    }
  }
  throw new Error(`timeout: ${what}`);
}
const click = (p: Page, name: string) => p.getByRole('button', { name, exact: true }).click();

const perf: Array<{ step: string; pssKb: number }> = [];
const sample = (step: string) => {
  const m = sh(`dumpsys meminfo ${PKG}`).match(/TOTAL PSS:\s+(\d+)/);
  if (m) perf.push({ step, pssKb: Number(m[1]) });
};

const t0 = Date.now();
const captions: Array<{ at: number; text: string }> = [];
const caption = (text: string) => {
  captions.push({ at: (Date.now() - t0) / 1000, text });
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}] ${text}`);
};

const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}] ${m}`);
/** Marks a stretch spent waiting on the network or a page load; the composers trim long waits automatically. */
const waits: Array<{ from: number; to: number; what: string }> = [];
async function waiting<T>(what: string, fn: () => Promise<T>): Promise<T> {
  const from = (Date.now() - t0) / 1000;
  try {
    return await fn();
  } finally {
    waits.push({ from, to: (Date.now() - t0) / 1000, what });
  }
}

// Car: wipe our own app's data (no trips from earlier runs) and start on the empty trip list.
sh(`am force-stop ${PKG}`);
sh(`pm clear --user 10 ${PKG}`);
sh(`am start --user 10 -n ${PKG}/.MainActivity`);
await waitFor(byTag('import'), 'trip list');
await sleep(3000);

// Demo mode (separate store) must be on: the demo clock and the demo arrival signal only exist with it. Done before
// recording starts, so the switch is not in the video.
tap(await waitFor(byTag('settings'), 'settings'));
tap(await waitFor(byTag('demo'), 'demo on'));
await sleep(600);
tap(await waitFor(byTag('목록'), 'back from settings'));
await waitFor(byTag('import'), 'trip list (demo)');

// screenrecord stops itself after 180 s, so chain segments until told to stop; each segment's start is kept for alignment.
sh('rm -f /sdcard/demo_*.mp4');
const segments: Array<{ file: string; at: number }> = [];
let stopping = false;
const record = (): Promise<void> => {
  const file = `/sdcard/demo_${segments.length}.mp4`;
  const p = spawn(ADB, ['-s', SERIAL, 'shell', 'screenrecord', '--size', '2560x1440', '--bit-rate', '16000000', '--time-limit', '170', file]);
  segments.push({ file, at: (Date.now() - t0) / 1000 });
  return new Promise((resolve) => p.once('exit', () => (stopping ? resolve() : record().then(resolve))));
};
const recording = record();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
});
const page = await ctx.newPage();
// Phone video: a screenshot loop at ~12 fps in device pixels (780×1688). Playwright's recordVideo and Chrome's
// screencast both ignore the 2× mobile emulation here and come out soft (~390 px wide).
rmSync(`${work}phone_frames`, { recursive: true, force: true });
mkdirSync(`${work}phone_frames`, { recursive: true });
const phoneFrames: Array<{ file: string; at: number }> = [];
let shooting = true;
const shooter = (async () => {
  while (shooting) {
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 90, timeout: 2000 });
      // Stamp when the call returns: a capture can wait seconds during a page load, and the image shows the page then.
      const at = (Date.now() - t0) / 1000;
      const file = `phone_frames/${String(phoneFrames.length).padStart(5, '0')}.jpg`;
      writeFileSync(`${work}${file}`, buf);
      phoneFrames.push({ file, at });
    } catch {
      // mid-navigation; take the next one
    }
    await sleep(70);
  }
})();
const open = (url: string) => waiting('phone page load', () => page.goto(url, { waitUntil: 'domcontentloaded' }));
await open(HOME);
await sleep(1500);

let failure: string | null = null;
const readQr = () => {
  const shot = PNG.sync.read(adb('exec-out', 'screencap', '-p'));
  const url = jsQR(new Uint8ClampedArray(shot.data), shot.width, shot.height)?.data;
  if (!url) throw new Error('QR not readable from the car screen');
  return url;
};
try {
  caption("휴대폰에서 짠 3박 4일 강릉 여행 · 예약 2곳, 숙소 3박 · 경포호는 '여유 있으면' 일정");
  await click(page, '샘플 여행 추가');
  await page.getByText('강릉 3박 4일', { exact: true }).first().click();
  const day2 = page.locator('button[data-tab-value="2"]'); // Astryx tabs are buttons, not role=tab
  await day2.waitFor();
  await sleep(1200);
  await day2.scrollIntoViewIfNeeded();
  await sleep(1500);
  await day2.click();
  await sleep(2500);
  // 경포호 as '여유 있으면' (optional), as a user would mark it; the current sample already is, then nothing changes.
  await page.getByRole('button', { name: '상세', exact: true }).first().click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByText('여유 있으면', { exact: true }).click();
  await sleep(1500);
  await dlg.getByRole('button', { name: '닫기', exact: true }).click();
  const save = page.getByRole('button', { name: '저장', exact: true });
  if (await save.isEnabled().catch(() => false)) await save.click();
  await sleep(1500);
  await click(page, '뒤로');
  await page.getByText('내 여행').waitFor();
  await sleep(800);

  caption('① 주차 중 차량에서 「모바일 여행 불러오기」 · QR은 5분 동안 한 번만 쓸 수 있어요');
  await waiting('QR session', () => tapUntil(byTag('import'), byText('남은 시간'), 'QR'));
  await sleep(3000);
  sample('QR 표시');
  const url = readQr();

  caption('② 휴대폰 카메라로 스캔 · 링크를 여는 것만으로는 아무것도 보내지 않아요');
  await open(url);
  await waiting('phone page load', () => page.getByText('차량 연결 요청').waitFor());
  await sleep(3500);
  await click(page, '연결하고 확인 코드 보기');
  caption('③ 두 화면의 6자리 확인 코드가 같은지 비교 · 종단간 암호화 키에서 만든 코드예요');
  await waiting('claim', async () => {
    await page.getByText('확인 코드를 비교해 주세요').waitFor();
    await waitFor(byText('휴대폰이 연결됐어요'), 'car code');
  });
  await sleep(4500);
  sample('코드 확인');
  await click(page, '같아요');
  caption('④ 보낼 여행을 하나 고르고, 보낼 항목을 확인 · 집 주소는 기본으로 보내지 않아요');
  await page.getByText('차량으로 보낼 여행').waitFor();
  await sleep(1500);
  await page.getByText('강릉 3박 4일', { exact: true }).first().click();
  await sleep(1500);
  await click(page, '다음');
  await page.getByText('보낼 정보 확인').waitFor();
  await page.mouse.wheel(0, 500);
  await sleep(3500);
  await click(page, '다음');
  await sleep(2000);
  caption('⑤ 휴대폰에서 전송 승인 · 서버도 내용을 볼 수 없게 암호화해요 · 아직 차량에 적용 전');
  await click(page, '차량으로 보내기');
  await page.getByText('아직 적용 전').first().waitFor();
  await waiting('car receive', () => waitFor(byText('받은 여행 확인'), 'review'));
  caption('⑥ 차량이 다시 검사 · 고정 일정·이동시간·숙소·영업정보를 보여 주고 계획은 바꾸지 않아요');
  await sleep(6500);
  sample('요약·재검증');
  caption('⑦ 차량에서 한 번 더 승인해야 불러와요 → 휴대폰에도 「적용됨」');
  tap(await waitFor(byTag('choice_IMPORT_NEW'), 'import choice'));
  await waitFor(byText('새 여행으로 불러왔어요'), 'imported');
  await page.getByText('차량에 새 여행으로 불러왔어요').waitFor();
  await sleep(4500);

  caption('⑧ 같은 여행을 다시 보내면? 중복 없이 「바뀐 것 없음」 · 새 버전이면 업데이트할지 물어봐요');
  tap(await waitFor(byTag('닫기'), 'close'));
  await open(HOME); // a camera opens a fresh page; /c#old → /c#new alone would only change the fragment
  await waiting('QR session', () => tapUntil(byTag('import'), byText('남은 시간'), 'QR 2'));
  await sleep(1500);
  await open(readQr());
  await click(page, '연결하고 확인 코드 보기');
  await waiting('claim', async () => {
    await page.getByText('확인 코드를 비교해 주세요').waitFor();
    await waitFor(byText('휴대폰이 연결됐어요'), 'car code 2');
  });
  await click(page, '같아요');
  await page.getByText('차량으로 보낼 여행').waitFor();
  await page.getByText('강릉 3박 4일', { exact: true }).first().click();
  await click(page, '다음');
  await page.getByText('보낼 정보 확인').waitFor();
  await click(page, '다음');
  await click(page, '차량으로 보내기');
  await waiting('car receive', () => waitFor(byText('이미 불러온 여행과 같아요'), 'same version'));
  await sleep(3500);
  tap(await waitFor(byTag('choice_ACKNOWLEDGE_SAME'), 'ack'));
  await page.getByText('차량에 이미 같은 버전이 있어요').waitFor();
  await sleep(3500);

  caption('⑨ 출발 전 [여기서 출발] · 내비가 현재 위치에서 예상 시간과 도착 시 배터리를 알려 주고 비어 있던 첫 구간을 채워요');
  tap(await waitFor(byTag('여행 보기'), 'open trip'));
  await waitFor(byText('다음 목적지'), 'detail');
  await sleep(2500);
  tap(await waitFor(byTag('departHere'), 'depart here'));
  await waiting('navi estimate', () => waitFor(byText('내비 예상'), 'estimate', 20_000));
  await sleep(4000);
  tap(await waitFor(byTag('확인'), 'dismiss estimate'));
  await sleep(4500);
  sample('여기서 출발');

  // Emulator-only demo clock (Settings → demo card) to the trip's day 2, 09:00; trimmed from the video as a wait.
  await waiting('demo clock', async () => {
    tap(await waitFor(byTag('목록'), 'to list'));
    tap(await waitFor(byTag('settings'), 'settings'));
    tap(await waitFor(byTag('demoClock'), 'demo clock'));
    await sleep(800);
    tap(await waitFor(byTag('목록'), 'back from settings'));
    tap(await waitFor(byText('강릉 3박 4일'), 'open trip'));
    await waitFor(byText('시연 시각'), 'demo clock line');
  });
  caption('⑩ 여행 당일(시연 시각 11/21 09:00) · 지금 출발하면 13:00 예약까지 여유가 얼마인지 바로 보여요');
  await sleep(4500);
  sample('여행 상세');
  caption('⑪ 「다음 목적지 안내」 → 현대자동차그룹 내비게이션이 경로 안내를 시작해요');
  tap(await waitFor(byTag('guide'), 'guide'));
  await sleep(2000);
  const replace = ui().find((n) => n.desc === '바꾸기');
  if (replace) {
    log('replace current route');
    tap(replace);
  }
  await sleep(7000); // the navigation comes to the front with the new route
  sh(`am start --user 10 -n ${PKG}/.MainActivity`);
  await waiting('navigation confirm', () => waitFor(byText('안내를 시작했어요'), 'guidance confirmed', 45_000));
  await sleep(2500);
  tap(await waitFor(byTag('확인'), 'dismiss guide'));
  caption('⑫ 내비 남은 시간으로 다시 계산 · 늦을 것 같으면 선택 일정 건너뛰기를 제안해요 (에뮬레이터 위치 성남 기준)');
  await waitFor(byText('늦을 수 있어요'), 'late status', 15_000).catch(() => log('not late with the current traffic'));
  await sleep(5500);
  const skip = ui().find((n) => n.desc === 'skip');
  if (skip) {
    tap(skip);
    caption('⑬ 건너뛰어도 계획은 그대로 · 다음 목적지가 예약 식당으로 바뀌고 언제든 되돌릴 수 있어요');
    await sleep(5000);
    tap(await waitFor(byTag('unskip'), 'unskip'));
    await sleep(1500);
  }
  // The emulator's navigation never moves, so its arrival event is stood in for by the labelled demo signal.
  await waiting('demo arrival', async () => {
    tap(await waitFor(byTag('목록'), 'to list 2'));
    tap(await waitFor(byTag('settings'), 'settings 2'));
    tap(await waitFor(byTag('demoArrive'), 'demo arrive'));
    await sleep(800);
    tap(await waitFor(byTag('목록'), 'back from settings 2'));
    tap(await waitFor(byText('강릉 3박 4일'), 'open trip 2'));
    await waitFor(byText('시연 신호로 표시'), 'arrival note');
  });
  caption('⑭ 내비가 도착을 알리면 방문함으로 표시해요 · 에뮬레이터는 움직이지 않아 시연 신호로 보여 줘요');
  await sleep(5000);
  caption('떠날지도 · 한 번만 가져오고 계정 연결은 없어요 · 주행 중에는 다음 목적지와 상태 한 줄만 보여요');
  await sleep(5000);
} catch (e) {
  failure = e instanceof Error ? e.message : String(e);
  console.error('FAILED:', failure);
  writeFileSync(`${work}failure.png`, adb('exec-out', 'screencap', '-p'));
} finally {
  shooting = false;
  await shooter;
  await ctx.close();
  await browser.close();
  stopping = true;
  sh('pkill -INT screenrecord || true');
  await recording;
  await sleep(1500);
}
const total = (Date.now() - t0) / 1000;
segments.forEach((s, i) => adb('pull', s.file, `${work}car_${i}.mp4`));
// One continuous car clip: each segment holds its last frame across the short gap before the next one starts.
const durationOf = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const carClip = (() => {
  if (segments.length === 1) return 'car_0.mp4';
  const parts = segments.map((s, i) => {
    const next = segments[i + 1];
    const gap = next ? Math.max(0, next.at - (s.at + durationOf(`${work}car_${i}.mp4`))) : 0;
    return `[${i}:v]fps=30${gap > 0 ? `,tpad=stop_mode=clone:stop_duration=${gap.toFixed(3)}` : ''}[s${i}]`;
  });
  const graph = `${parts.join(';')};${segments.map((_, i) => `[s${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[v]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...segments.flatMap((_, i) => ['-i', `${work}car_${i}.mp4`]), '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', `${work}car_all.mp4`]);
  return 'car_all.mp4';
})();
// Constant 30 fps clip: output frame n shows the latest screenshot taken by phoneStart + n/30. Built as a numbered
// symlink sequence because concat-demuxer durations get rounded per frame and drift by seconds over a take.
const phoneStart = phoneFrames[0].at;
rmSync(`${work}phone_seq`, { recursive: true, force: true });
mkdirSync(`${work}phone_seq`);
for (let n = 0, j = 0; phoneStart + n / 30 < total; n++) {
  while (j + 1 < phoneFrames.length && phoneFrames[j + 1].at <= phoneStart + n / 30) j++;
  symlinkSync(`${work}${phoneFrames[j].file}`, `${work}phone_seq/${String(n).padStart(5, '0')}.jpg`);
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', `${work}phone_seq/%05d.jpg`, '-vf', 'scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:0:0:white', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', `${work}phone.mp4`]);
writeFileSync(`${work}timeline.json`, JSON.stringify({ failure, total, phoneStart, segments: [{ file: carClip, at: segments[0].at }], rawSegments: segments.map((s, i) => ({ file: `car_${i}.mp4`, at: s.at })), captions, waits, perf }, null, 2));
console.log(JSON.stringify({ failure, total, perf }, null, 1));
if (failure) process.exitCode = 1;

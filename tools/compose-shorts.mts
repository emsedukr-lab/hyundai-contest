/**
 * Vertical short (1080×1920, under 60 s) for the contest's short-form challenge (Instagram Reels / YouTube Shorts),
 * cut from the same raw take as the landscape demo (tools/record-demo.mts → .work/demo/).
 *   npx tsx tools/compose-shorts.mts            → media/demo/떠날지도_숏폼.mp4
 * Structure follows the challenge guide: Spot (the moment) → Solve (app screens) → Scene (using it), then an end card.
 * Scenes are anchored on the recorder's caption timestamps, network/page-load waits are trimmed, and each scene is
 * sped up so the whole short fits in TARGET seconds. Text stays inside the area Reels/Shorts leave uncovered
 * (top ~160 px, bottom ~370 px and the right-hand buttons are covered by the platform UI).
 * No audio: add music from the platform's licensed library when posting.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = `${root}.work/demo/`;
const tmp = `${work}shorts/`;
const out = `${root}media/demo/떠날지도_숏폼.mp4`;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(`${root}media/demo`, { recursive: true });

interface Timeline {
  phoneStart: number;
  total: number;
  segments: Array<{ file: string; at: number }>;
  captions: Array<{ at: number; text: string }>;
  waits?: Array<{ from: number; to: number; what: string }>;
}
const tl: Timeline = JSON.parse(readFileSync(`${work}timeline.json`, 'utf8'));
const car = { file: `${work}${tl.segments[0].file}`, at: tl.segments[0].at };
const probe = (f: string) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number);
const [carW] = probe(car.file);
const k = carW / 2560; // crops below are in full-resolution (2560×1440) display pixels
// Phone: phone.mp4 is 780×1688 (device pixels). An older take only has Playwright's phone.webm (390×760 page area).
const phone = existsSync(`${work}phone.mp4`)
  ? { file: `${work}phone.mp4`, prep: 'null' }
  : { file: `${work}phone.webm`, prep: 'crop=390:760:0:0,scale=780:1520:flags=lanczos,pad=780:1688:0:0:white' };

const W = 1080, H = 1920, FPS = 30, TARGET = 56;
/** The app's window on the car display (right of the vehicle panel, above the dock), incl. the status bar. */
const CAR_APP = { x: 854, y: 0, w: 1706, h: 1300 };

/** Region of the car display in full-resolution pixels; region of the phone page in device pixels (780 wide). */
interface Roi { x: number; y: number; w: number; h: number }
interface Scene { anchor: string; until: string; title: string; sub: string; car?: Roi; phone?: { y: number; h: number }; skipStart?: number; weight?: number }
const FULL_PHONE = { y: 0, h: 1688 };
const SCENES: Scene[] = [
  { anchor: '휴대폰에서 짠', until: '①', phone: FULL_PHONE, title: '여행은 휴대폰에서\n다 짰는데', sub: '차에 타면 목적지를 또 하나씩 입력?', weight: 0.7 },
  { anchor: '①', until: '②', car: CAR_APP, title: '차 화면에 QR 한 번', sub: '주차 중에만 · 5분 동안 한 번만 쓰는 QR', skipStart: 0.5, weight: 0.7 },
  { anchor: '②', until: '③', phone: FULL_PHONE, title: '휴대폰 카메라로 스캔', sub: '앱 설치도, 로그인도 없어요', weight: 0.7 },
  { anchor: '③', until: '④', car: { x: 860, y: 180, w: 900, h: 360 }, phone: { y: 220, h: 600 }, title: '두 화면 코드가 같으면\n내 차 맞아요', sub: '종단간 암호화 · 서버도 내용을 볼 수 없어요', weight: 0.8 },
  { anchor: '⑤', until: '⑦', car: CAR_APP, title: '차가 일정을 다시 검사', sub: '예약 시각 · 숙소 · 이동시간 확인 필요를 표시', weight: 0.8 },
  { anchor: '⑦', until: '⑧', car: { x: 860, y: 170, w: 1300, h: 560 }, phone: { y: 160, h: 560 }, title: '차에서 한 번 더 승인하면 끝', sub: '휴대폰에도 바로 「적용됨」', weight: 0.7 },
  { anchor: '⑨', until: '⑩', car: CAR_APP, title: '여기서 출발하면\n내비가 시간·배터리 예상', sub: '비어 있던 이동시간이 채워져요' },
  { anchor: '⑪', until: '⑫', car: CAR_APP, title: '버튼 하나로 내비 안내', sub: '현대자동차그룹 내비게이션이 경로를 안내해요', weight: 0.8 },
  { anchor: '⑫', until: '⑭', car: CAR_APP, title: '늦을 것 같으면\n먼저 알려 줘요', sub: '내비 남은 시간으로 다시 계산 · 선택 일정 건너뛰기 제안' },
  { anchor: '⑭', until: '떠날지도', car: CAR_APP, title: '도착하면 자동으로 방문 표시', sub: '내비 도착 알림 연동 (에뮬레이터는 시연 신호)', weight: 0.7 },
];

const capAt = (prefix: string) => {
  const c = tl.captions.find((x) => x.text.startsWith(prefix));
  if (!c) throw new Error(`caption not found: ${prefix}`);
  return c.at;
};
/** Kept sub-ranges of [a,b]: waits longer than 1.6 s are cut down to 0.6 s at each end. */
const keep = (a: number, b: number): Array<[number, number]> => {
  const cuts = (tl.waits ?? []).filter((w) => w.to - w.from > 1.6).map((w) => [w.from + 0.6, w.to - 0.6] as [number, number]);
  let parts: Array<[number, number]> = [[a, b]];
  for (const [c0, c1] of cuts) parts = parts.flatMap(([x, y]) => (c1 <= x || c0 >= y ? [[x, y]] : ([[x, c0], [c1, y]] as Array<[number, number]>).filter(([p, q]) => q - p > 0.2)));
  return parts;
};
const plan = SCENES.map((s) => {
  const a = capAt(s.anchor) + (s.skipStart ?? 0);
  const b = capAt(s.until);
  const parts = keep(a, b);
  return { ...s, parts, raw: parts.reduce((t, [x, y]) => t + (y - x), 0) };
});
const END = 3.2;
// Each scene gets a share of the time proportional to its weight, read time at least 2.6 s; speed = raw / share.
const budget = TARGET - END;
const weights = plan.map((p) => (p.weight ?? 1) * Math.sqrt(p.raw));
const wsum = weights.reduce((a, b) => a + b, 0);
const scenes = plan.map((p, i) => {
  const dur = Math.max(2.6, (budget * weights[i]) / wsum);
  return { ...p, dur, speed: Math.max(1, p.raw / dur) };
});

// ---- cards (dark background + text) drawn in Chrome ----
const font = `${root}design/fonts/asta_sans.ttf`;
const css = `@font-face { font-family: Asta; src: url('file://${font}'); }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; background: #0f1115; color: #fff; font-family: Asta, 'Apple SD Gothic Neo', sans-serif; overflow: hidden; }
.brand { position: absolute; left: 60px; top: 170px; font-size: 30px; font-weight: 700; color: #6ea0ff; letter-spacing: -0.3px; }
.title { position: absolute; left: 60px; right: 60px; top: 220px; font-size: 76px; line-height: 1.18; font-weight: 800; letter-spacing: -2px; white-space: pre-line; }
.sub { position: absolute; left: 60px; right: 60px; font-size: 40px; line-height: 1.35; font-weight: 500; color: #b4b9c2; letter-spacing: -0.5px; }
.label { position: absolute; font-size: 26px; font-weight: 600; color: #7d838d; }`;
interface Box { x: number; y: number; w: number; h: number }
/** Stacks text, then car and/or phone, scaled to fit and centered in the area the platform UI leaves free. */
const SAFE_BOTTOM = 1560;
const sceneHtml = (s: (typeof scenes)[number], i: number) => {
  const lines = s.title.split('\n').length;
  const subTop = 220 + lines * 90 + 18;
  const top = subTop + 54 + 70;
  const avail = SAFE_BOTTOM - top;
  const gap = s.car && s.phone ? 64 : 0;
  let cw = s.car ? Math.min(1000, s.car.w * 1.2) : 0; // up to 1.2× of the 2560-px display
  let pw = s.phone ? (s.car ? Math.min(760, s.phone.h > 1000 ? 560 : 760) : 600) : 0;
  let ch = s.car ? (cw * s.car.h) / s.car.w : 0;
  let ph = s.phone ? (pw * s.phone.h) / 780 : 0;
  const fit = Math.min(1, (avail - gap) / (ch + ph));
  cw *= fit; ch *= fit; pw *= fit; ph *= fit;
  let y = top + (avail - (ch + ph + gap)) / 2;
  const boxes: { car?: Box; phone?: Box } = {};
  const r = (b: Box): Box => ({ x: Math.round(b.x / 2) * 2, y: Math.round(b.y / 2) * 2, w: Math.round(b.w / 2) * 2, h: Math.round(b.h / 2) * 2 });
  if (s.car) { boxes.car = r({ x: (W - cw) / 2, y, w: cw, h: ch }); y += ch + gap; }
  if (s.phone) boxes.phone = r({ x: (W - pw) / 2, y, w: pw, h: ph });
  const label = (b: Box | undefined, text: string) => (b ? `<div class="label" style="left:${b.x}px; top:${b.y - 36}px">${text}</div>` : '');
  const frame = (b: Box | undefined) => (b ? `<div style="position:absolute; left:${b.x - 4}px; top:${b.y - 4}px; width:${b.w + 8}px; height:${b.h + 8}px; background:#2a2e36; border-radius:10px"></div>` : '');
  const html = `<style>${css}</style>
    <div class="brand">떠날지도${i === 0 ? '' : ` · ${i}/${scenes.length - 1}`}</div>
    <div class="title">${s.title}</div>
    <div class="sub" style="top:${subTop}px">${s.sub}</div>
    ${frame(boxes.car)}${frame(boxes.phone)}
    ${label(boxes.car, '차량 화면 · Pleos Connect')}${label(boxes.phone, '휴대폰 · 모바일 웹')}`;
  return { html, boxes };
};
const endHtml = `<style>${css}
  .c { position: absolute; left: 60px; right: 60px; top: 520px; text-align: center; }
  .n { font-size: 150px; font-weight: 800; letter-spacing: -5px; }
  .t { margin-top: 30px; font-size: 52px; font-weight: 700; line-height: 1.3; letter-spacing: -1px; }
  .s { margin-top: 40px; font-size: 34px; color: #9aa0aa; line-height: 1.5; }
  .bar { width: 120px; height: 8px; background: #276ef1; margin: 46px auto 0; border-radius: 4px; }
</style><div class="c"><div class="n">떠날지도</div><div class="t">휴대폰에서 짠 여행을<br>QR 한 번으로 차에</div><div class="bar"></div>
<div class="s">Pleos Connect 차량용 앱<br>계정 연결 없음 · 내비 남은 시간으로 예약 시각을 지켜요</div></div>`;

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const shoot = async (html: string, file: string) => {
  writeFileSync(`${tmp}card.html`, `<!doctype html><meta charset="utf-8">${html}`);
  await page.goto(`file://${tmp}card.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
};
const built = [];
for (const [i, s] of scenes.entries()) {
  const { html, boxes } = sceneHtml(s, i);
  await shoot(html, `${tmp}bg_${i}.png`);
  built.push({ ...s, boxes });
}
await shoot(endHtml, `${tmp}end.png`);
await browser.close();

// ---- one clip per scene, then concat ----
const f = (n: number) => n.toFixed(3);
const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const clips: string[] = [];
for (const [i, s] of built.entries()) {
  const n = s.parts.length;
  const g: string[] = [];
  const pieces = (src: string, offset: number, label: string, prep: string) => {
    g.push(`[${src}]fps=${FPS},${prep},split=${n}${s.parts.map((_, j) => `[${label}s${j}]`).join('')}`);
    s.parts.forEach(([a, b], j) => g.push(`[${label}s${j}]trim=start=${f(Math.max(0, a - offset))}:end=${f(b - offset)},setpts=PTS-STARTPTS[${label}${j}]`));
    g.push(`${s.parts.map((_, j) => `[${label}${j}]`).join('')}concat=n=${n}:v=1:a=0,setpts=PTS/${s.speed.toFixed(4)}[${label}v]`);
  };
  let last = '0:v';
  if (s.boxes.car && s.car) {
    const b = s.boxes.car, c = s.car;
    pieces('1:v', car.at, 'car', `crop=${Math.round(c.w * k)}:${Math.round(c.h * k)}:${Math.round(c.x * k)}:${Math.round(c.y * k)},scale=${b.w}:${b.h}:flags=lanczos`);
    g.push(`[${last}][carv]overlay=${b.x}:${b.y}:eof_action=repeat[o1]`);
    last = 'o1';
  }
  if (s.boxes.phone && s.phone) {
    const b = s.boxes.phone, c = s.phone;
    pieces('2:v', tl.phoneStart, 'ph', `${phone.prep},crop=780:${c.h}:0:${c.y},scale=${b.w}:${b.h}:flags=lanczos`);
    g.push(`[${last}][phv]overlay=${b.x}:${b.y}:eof_action=repeat[o2]`);
    last = 'o2';
  }
  const file = `${tmp}scene_${i}.mp4`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS), '-i', `${tmp}bg_${i}.png`, '-i', car.file, '-i', phone.file, '-filter_complex', g.join(';'), '-map', `[${last}]`, '-t', f(s.dur), ...enc, file], { stdio: 'inherit' });
  clips.push(file);
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS), '-i', `${tmp}end.png`, '-t', f(END), ...enc, `${tmp}end.mp4`]);
clips.push(`${tmp}end.mp4`);
writeFileSync(`${tmp}list.txt`, clips.map((c) => `file '${c}'`).join('\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${tmp}list.txt`, '-c', 'copy', '-movflags', '+faststart', out]);
const total = scenes.reduce((t, s) => t + s.dur, 0) + END;
console.log(JSON.stringify({ out, seconds: Number(total.toFixed(1)), scenes: scenes.map((s) => ({ title: s.title.replace('\n', ' '), dur: Number(s.dur.toFixed(1)), speed: Number(s.speed.toFixed(2)) })) }, null, 1));

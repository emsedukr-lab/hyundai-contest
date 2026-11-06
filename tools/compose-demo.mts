/**
 * Turns the raw demo recording (tools/record-demo.mts → .work/demo/) into media/demo/떠날지도_시연.mp4:
 * car screen and phone side by side on a 1920×1080 frame, Korean captions, waiting stretches cut out.
 *   npx tsx tools/compose-demo.mts
 * This ffmpeg has no drawtext/libass, so the frame and captions are drawn as transparent PNGs in Chrome and overlaid.
 * Only waits are removed (page loads, network round trips); every kept second is real, unedited screen video.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = `${root}.work/demo/`;
const outDir = `${root}media/demo/`;
mkdirSync(`${work}overlay`, { recursive: true });
mkdirSync(outDir, { recursive: true });

interface Timeline { phoneStart: number; total: number; segments: Array<{ file: string; at: number }>; captions: Array<{ at: number; text: string }>; waits?: Array<{ from: number; to: number; what: string }> }
const tl: Timeline = JSON.parse(readFileSync(`${work}timeline.json`, 'utf8'));
const carAt = tl.segments[0].at;
// phone.mp4: 780×1688 screenshots (current recorder). phone.webm: the first take's Playwright video (390×760 page area).
const phoneFile = existsSync(`${work}phone.mp4`) ? `${work}phone.mp4` : `${work}phone.webm`;
const phonePrep = phoneFile.endsWith('.mp4') ? 'null' : 'crop=390:760:0:0,scale=390:844:flags=lanczos';

/**
 * Kept stretches in recording time (seconds since the recorder started): from just before the first caption to the end,
 * minus the middle of every logged wait longer than 2 s (page loads, network round trips), which keeps 0.7 s at each end.
 * KEEP='[[a,b],…]' overrides this (the first take, which logged no waits, used hand-picked ranges).
 */
const autoKeep = (): Array<[number, number]> => {
  const start = Math.max(tl.segments[0].at, tl.phoneStart) + 0.5;
  const end = Math.min(tl.total - 1.5, tl.captions.at(-1)!.at + 9);
  let parts: Array<[number, number]> = [[start, end]];
  for (const w of tl.waits ?? []) {
    if (w.to - w.from <= 2) continue;
    const [c0, c1] = [w.from + 0.7, w.to - 0.7];
    parts = parts.flatMap(([x, y]) => (c1 <= x || c0 >= y ? [[x, y]] : ([[x, c0], [c1, y]] as Array<[number, number]>).filter(([p, q]) => q - p > 0.2)));
  }
  return parts;
};
const KEEP: Array<[number, number]> = JSON.parse(process.env.KEEP ?? 'null') ?? autoKeep();
const total = KEEP.reduce((s, [a, b]) => s + (b - a), 0);
/** Maps a recording time to output time; times inside a cut snap to the next kept stretch. */
const toOut = (g: number) => {
  let acc = 0;
  for (const [a, b] of KEEP) {
    if (g < a) return acc;
    if (g <= b) return acc + (g - a);
    acc += b - a;
  }
  return acc;
};

// ---- overlays (frame + one PNG per caption) ----
const W = 1920, H = 1080;
const CAR = { x: 40, y: 124, w: 1410, h: 793 };
const PHONE = { x: 1480, y: 100, w: 400, h: 866 }; // phone.mp4 is the whole 780×1688 page
const font = `${root}design/fonts/asta_sans.ttf`;
const css = `
  @font-face { font-family: Asta; src: url('file://${font}'); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; font-family: Asta, 'Apple SD Gothic Neo', sans-serif; }
`;
const frameHtml = `<style>${css}
  body { background: #0f1115; color: #fff; position: relative; }
  .t { position: absolute; left: 40px; top: 30px; font-size: 34px; font-weight: 700; letter-spacing: -0.5px; }
  .t span { font-weight: 500; color: #9aa0aa; font-size: 26px; margin-left: 14px; }
  .n { position: absolute; left: ${PHONE.x}px; top: ${PHONE.y + PHONE.h + 18}px; width: ${PHONE.w}px; font-size: 17px; color: #7d838d; line-height: 1.5; }
  .l { position: absolute; font-size: 20px; color: #b4b9c2; font-weight: 600; }
  .slot { position: absolute; background: #1b1e24; border-radius: 6px; }
</style>
<div class="t">떠날지도<span>휴대폰에서 만든 여행을 QR로 차에 불러오기</span></div>
<div class="n">Pleos Connect 에뮬레이터(release APK)와 휴대폰 브라우저를 실서버로 연결해 녹화 · 기다리는 구간만 잘라냄</div>
<div class="l" style="left:${CAR.x}px; top:${CAR.y - 32}px">차량 화면 · Pleos Connect</div>
<div class="l" style="left:${PHONE.x}px; top:${PHONE.y - 32}px">휴대폰 · 모바일 웹</div>
<div class="slot" style="left:${CAR.x - 4}px; top:${CAR.y - 4}px; width:${CAR.w + 8}px; height:${CAR.h + 8}px"></div>
<div class="slot" style="left:${PHONE.x - 4}px; top:${PHONE.y - 4}px; width:${PHONE.w + 8}px; height:${PHONE.h + 8}px"></div>`;

const captionHtml = (text: string) => {
  const m = text.match(/^([①-⑳])\s*(.*)$/);
  const badge = m ? `<b>${m[1]}</b>` : '';
  const body = (m ? m[2] : text).replace(/ · /g, '<i> · </i>');
  return `<style>${css}
    html, body { background: transparent; }
    .c { position: absolute; left: ${CAR.x}px; top: ${CAR.y + CAR.h + 18}px; width: ${CAR.w}px; min-height: 112px;
         background: rgba(255,255,255,0.06); border-left: 6px solid #276ef1; border-radius: 4px; padding: 18px 28px;
         display: flex; gap: 18px; align-items: center; color: #fff; font-size: 31px; line-height: 1.38; font-weight: 600; letter-spacing: -0.3px; }
    b { color: #6ea0ff; font-size: 40px; font-weight: 700; }
    i { font-style: normal; color: #7d838d; }
  </style><div class="c">${badge}<div>${body}</div></div>`;
};

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const shoot = async (html: string, file: string) => {
  writeFileSync(`${work}overlay/page.html`, `<!doctype html><meta charset="utf-8">${html}`);
  await page.goto(`file://${work}overlay/page.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
};
await shoot(frameHtml, `${work}overlay/frame.png`);
const caps = tl.captions.map((c, i) => ({ ...c, file: `${work}overlay/cap_${i}.png`, from: toOut(c.at), to: i + 1 < tl.captions.length ? toOut(tl.captions[i + 1].at) : total }));
for (const c of caps) await shoot(captionHtml(c.text), c.file);
await browser.close();

// ---- ffmpeg graph ----
const f = (n: number) => n.toFixed(3);
const pieces = (label: string, offset: number) =>
  KEEP.map(([a, b], i) => `[${label}s${i}]trim=start=${f(a - offset)}:end=${f(b - offset)},setpts=PTS-STARTPTS[${label}${i}]`).join(';');
const concat = (label: string) => `${KEEP.map((_, i) => `[${label}${i}]`).join('')}concat=n=${KEEP.length}:v=1:a=0`;

const inputs = ['-loop', '1', '-framerate', '30', '-i', `${work}overlay/frame.png`, '-i', `${work}${tl.segments[0].file}`, '-i', phoneFile];
caps.forEach((c) => inputs.push('-loop', '1', '-framerate', '30', '-i', c.file));
const graph = [
  `[1:v]fps=30,split=${KEEP.length}${KEEP.map((_, i) => `[cars${i}]`).join('')}`,
  pieces('car', carAt),
  `${concat('car')},scale=${CAR.w}:${CAR.h}:flags=lanczos[carv]`,
  `[2:v]fps=30,${phonePrep},tpad=stop_mode=clone:stop_duration=8,split=${KEEP.length}${KEEP.map((_, i) => `[phs${i}]`).join('')}`,
  pieces('ph', tl.phoneStart),
  `${concat('ph')},scale=${PHONE.w}:${PHONE.h}:flags=lanczos[phv]`,
  `[0:v][carv]overlay=${CAR.x}:${CAR.y}:shortest=0[b1]`,
  `[b1][phv]overlay=${PHONE.x}:${PHONE.y}:eof_action=repeat[b2]`,
  ...caps.map((c, i) => `[b${i + 2}][${i + 3}:v]overlay=0:0:enable='between(t,${f(c.from)},${f(c.to - 0.001)})'[b${i + 3}]`),
].join(';');
const last = `[b${caps.length + 2}]`;
const out = `${outDir}떠날지도_시연.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', last, '-t', f(total), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit', maxBuffer: 1 << 26 });
console.log(JSON.stringify({ out, seconds: Number(total.toFixed(1)), captions: caps.map((c) => [Number(c.from.toFixed(1)), c.text.slice(0, 18)]) }, null, 1));

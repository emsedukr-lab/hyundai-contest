/**
 * Puts the screenshots of a live pairing run (tools/live-pair.mts) side by side: one long overview.png and one
 * pair-NN.png per step, car screen next to phone screen with a caption that says what the step proved.
 *   npx tsx tools/compose-live-pair.mts [dir]        (default docs/evidence/2026-11-10_live-pair)
 * Reads NN-car.png / NN-phone.png and results.json from the folder and writes overview.png and one pair-NN.png per step.
 * Optional 13-car.png / 14-car.png (the guidance popup and the navigation's route screen) add a last step.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const DIR = (process.argv[2] ?? 'docs/evidence/2026-11-10_live-pair').replace(/\/?$/, '/');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const run = JSON.parse(readFileSync(`${DIR}results.json`, 'utf8'));
const results: { ok: boolean; what: string }[] = run.results ?? run;
const find = (re: RegExp) => results.map((r) => r.what.match(re)?.[1]).find(Boolean) ?? '';
const version = find(/release ([\d.]+)/);
const code = find(/same confirm code \(([\d ]+)\)/);
const passed = results.filter((r) => r.ok).length;
// The day the check ran, in local time (toISOString would give the UTC day).
const date = new Date(run.at ?? Date.now()).toLocaleDateString('sv-SE');

const img = (name: string, kind: 'car' | 'phone') => {
  const file = `${DIR}${name}`;
  if (!existsSync(file)) return '';
  return `<img class="${kind}" src="data:image/png;base64,${readFileSync(file).toString('base64')}">`;
};
interface Shot { file: string; kind: 'car' | 'phone'; caption: string }
const steps: { n: string; title: string; shots: Shot[] }[] = [
  { n: '1', title: '시작', shots: [
    { file: '01-car.png', kind: 'car', caption: `차량: 서명 release APK ${version}, 저장된 여행 없음` },
    { file: '01-phone.png', kind: 'phone', caption: '휴대폰: 배포된 모바일 웹, 여행 탭의 "강릉 3박 4일"' },
  ] },
  { n: '2', title: '차량이 일회용 QR을 띄움', shots: [
    { file: '02-car.png', kind: 'car', caption: '주차 중 "모바일 여행 불러오기" → QR(5분·1회, 여행·개인정보 없음)' },
    { file: '02-phone.png', kind: 'phone', caption: 'QR을 열면 연결 화면' },
  ] },
  { n: '3', title: '같은 확인 코드', shots: [
    { file: '03-car.png', kind: 'car', caption: `차량: "휴대폰이 연결됐어요" · ${code}` },
    { file: '03-phone.png', kind: 'phone', caption: `휴대폰: ${code} — 두 화면이 같음` },
  ] },
  { n: '3+', title: '휴대폰에서 여행 고르고 보내기', shots: [
    { file: '04-phone.png', kind: 'phone', caption: '보낼 여행 고르기(강릉 3박 4일 · v1)' },
    { file: '05-phone.png', kind: 'phone', caption: '보낼 정보 확인 — 집 주소는 포함하지 않음' },
    { file: '06-phone.png', kind: 'phone', caption: `보내기 전 확인 — 연결 대상: 확인 코드 ${code} · 차량 앱 ${version}` },
  ] },
  { n: '4', title: '차량이 받은 여행을 다시 확인', shots: [
    { file: '07-car.png', kind: 'car', caption: `코드 ${code} · 강릉 3박 4일(v1) · 다시 확인한 결과 → [불러오기]` },
    { file: '07-phone.png', kind: 'phone', caption: '휴대폰: "차량이 받았어요 · 아직 적용 전"' },
  ] },
  { n: '5', title: '차량이 불러옴 → 휴대폰에 적용 표시', shots: [
    { file: '08-car.png', kind: 'car', caption: '차량: "새 여행으로 불러왔어요"' },
    { file: '08-phone.png', kind: 'phone', caption: '휴대폰: "차량에 새 여행으로 불러왔어요"' },
  ] },
  { n: '6', title: '차량에 도착한 여행', shots: [
    { file: '09-car.png', kind: 'car', caption: '왼쪽 하루 동선, 오른쪽 다음 목적지' },
  ] },
  { n: '7', title: '같은 여행을 다시 보내면', shots: [
    { file: '11-car.png', kind: 'car', caption: '차량: "이미 불러온 여행과 같아요"(중복 없음)' },
    { file: '11-phone.png', kind: 'phone', caption: '휴대폰: "차량에 이미 같은 버전이 있어요"' },
  ] },
  { n: '8', title: '쓴 QR은 다시 못 씀', shots: [
    { file: '12-car.png', kind: 'car', caption: '차량 목록: 강릉 3박 4일 1개' },
    { file: '12-phone.png', kind: 'phone', caption: '휴대폰: 이전 QR → "이미 사용된 QR이에요"' },
  ] },
];
if (existsSync(`${DIR}14-car.png`)) {
  steps.push({ n: '9', title: '현대차 내비로 안내', shots: [
    ...(existsSync(`${DIR}13-car.png`) ? [{ file: '13-car.png', kind: 'car' as const, caption: '[다음 목적지 안내] → 내비가 확정한 목적지로 안내 시작' }] : []),
    { file: '14-car.png', kind: 'car', caption: 'Pleos 내비의 경로 안내 화면' },
  ] });
}

const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
  body { margin: 0; padding: 48px 40px; width: 1570px; font: 26px/1.5 -apple-system, "Apple SD Gothic Neo", sans-serif; color: #131417; background: #f7f8fa; }
  h1 { font-size: 40px; margin: 0 0 8px; }
  .sub { color: #686a72; margin: 0 0 40px; }
  section { padding: 24px 0 40px; }
  h2 { display: flex; align-items: center; gap: 16px; font-size: 32px; margin: 0 0 20px; }
  h2 span { display: inline-flex; align-items: center; justify-content: center; min-width: 48px; height: 48px; padding: 0 8px; border-radius: 12px; background: #44464e; color: #fff; font-size: 26px; }
  .row { display: flex; gap: 32px; align-items: flex-start; }
  figure { margin: 0; }
  img { display: block; border-radius: 16px; border: 1px solid #1314171a; }
  img.car { width: 900px; }
  img.phone { width: 300px; }
  figcaption { margin-top: 12px; color: #44464e; font-size: 24px; max-width: 900px; }
  figure:has(img.phone) figcaption { max-width: 300px; }
</style>
<h1>떠날지도 차량 앱 ↔ 휴대폰 연동 확인</h1>
<p class="sub">${date} · 차량: 서명 release APK ${version}(Pleos Connect Emulator 2.1.0) · 휴대폰: 배포된 모바일 웹(휴대폰 크기 Chrome) · 서버: tteonaljido.tteonaljido-worker.workers.dev · 자동 확인 ${passed}항목 통과</p>
${steps.map((s) => `<section><h2><span>${s.n}</span>${s.title}</h2><div class="row">${s.shots.map((x) => `<figure>${img(x.file, x.kind)}<figcaption>${x.caption}</figcaption></figure>`).join('')}</div></section>`).join('')}
</html>`;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1650, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
writeFileSync(`${DIR}overview.png`, await page.screenshot({ fullPage: true }));
const sections = page.locator('section');
// One pair-NN.png per step, in order.
let k = 0;
for (let i = 0; i < steps.length; i++) {
  k += 1;
  writeFileSync(`${DIR}pair-${String(k).padStart(2, '0')}.png`, await sections.nth(i).screenshot());
}
await browser.close();
console.log(`overview.png and ${k} pair images written to ${DIR}`);

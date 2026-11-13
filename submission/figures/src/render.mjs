// Renders figure pages to PNG: node render.mjs <name...>. Each page exposes #frame and sets window.__ready when drawn.
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Volumes/1/현대공모전/package.json');
const { chromium } = require('playwright-core');
const DIR = dirname(fileURLToPath(import.meta.url));
const names = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1400 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
for (const n of names) {
  await page.goto(`http://127.0.0.1:8765/figures/src/${n}.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 }).catch(() => console.log(`${n}: not ready in time`));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => window.__info ?? '');
  await page.locator('#frame').screenshot({ path: `${DIR}/../${n}.raw.png` });
  console.log(`rendered ${n}${info ? ' · ' + info : ''}`);
}
await browser.close();

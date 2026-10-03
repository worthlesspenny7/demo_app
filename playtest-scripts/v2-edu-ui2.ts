import { chromium } from 'playwright';
import { LESSONS } from '../content/lessons.js';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const BASE = 'http://127.0.0.1:4176';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
for (const l of LESSONS) {
  await page.goto(`${BASE}/#/school/${l.id}`); await page.waitForTimeout(150);
  const t = await page.locator('body').innerText();
  const bad = (t.match(/NaN|undefined|\[object/g) ?? []).length;
  // answer the check with the stored answer, expect a correct message
  const opts = page.locator('.check input, .check label, input[type=radio]'); const n = await opts.count();
  console.log(l.id.padEnd(17), 'chars', t.length, 'bad', bad, 'check options', n, 'answer idx', l.check.answer);
  if (l.id === 'pause-arithmetic' || l.id === 'timed-leads') console.log('   ', t.split('\n').filter(x => /seconds compared|ramp from|call 40|dwell =/.test(x)).join(' // ').slice(0, 700));
}
await page.goto(`${BASE}/#/school/four-s`); await page.waitForTimeout(200); await page.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/v2-34-lesson-four-s.png', fullPage: false });
await page.goto(`${BASE}/#/school/transits`); await page.waitForTimeout(200); await page.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/v2-35-lesson-transits.png' });
console.log('errors', JSON.stringify(errs)); await browser.close();

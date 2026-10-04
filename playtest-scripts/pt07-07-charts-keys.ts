/** PT-07 step 7: charts overlay (C) and keys help (?) on D11 Silver at 1366x768; read chart (b) Stop & Go as Josh would (the sit time for each
 *  IN>OUT pair) and save it as the dwell table for the legal D11 run. Fresh profile, never saved. */
import { launch, goto, log, reset, hold, shot, OUT } from './pt07-common.js';
import { writeFileSync } from 'node:fs';
const F = '07-charts-keys.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/drill/D11/1/1'); await hold(page);
await page.keyboard.press('c'); await page.waitForTimeout(200);
const ov = page.locator('#charts-overlay, .charts-overlay, .overlay').first();
log(F, 'overlay box ' + JSON.stringify(await ov.boundingBox()) + '\n' + (await ov.innerText()).slice(0, 2500));
await shot(page, 'charts-overlay-d11');
const tables = await page.evaluate(() => [...document.querySelectorAll('#charts-overlay table, .charts-overlay table, .overlay table')].map(t => [...t.querySelectorAll('tr')].map(r => [...r.querySelectorAll('th,td')].map(c => (c as HTMLElement).innerText.trim()))));
log(F, 'tables: ' + tables.length + ' sizes ' + tables.map(t => t.length + 'x' + (t[1] ?? []).length).join(', '));
for (const [i, t] of tables.entries()) log(F, `table ${i}:\n` + t.map(r => r.join(' | ')).join('\n'));
// chart (b): header row = OUT speeds, first col = IN speed; values = sit time for a 15 s stop
const b = tables.find(t => t.some(r => r.join(' ').match(/OUT/))) && tables[1];
if (b) {
  const head = b.find(r => r.filter(c => /^\d+$/.test(c)).length >= 5)!; const outs = head.filter(c => /^\d+$/.test(c)).map(Number);
  const dw: Record<string, number> = {};
  for (const r of b) { const nums = r.filter(c => c !== ''); if (!/^\d+$/.test(nums[0] ?? '') || r === head) continue; const vin = Number(nums[0]); const vals = r.slice(r.length - outs.length); outs.forEach((vo, k) => { const v = Number(vals[k]); if (Number.isFinite(v) && vals[k] !== '') dw[`${vin}>${vo}`] = v; }); }
  writeFileSync(`${OUT}/dwell-table.json`, JSON.stringify(dw)); log(F, 'dwell table entries ' + Object.keys(dw).length + ' e.g. 48>48=' + dw['48>48'] + ' 35>35=' + dw['35>35']);
}
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
await page.keyboard.press('?'); await page.waitForTimeout(200);
const k = page.locator('#keys-overlay'); log(F, 'keys overlay ' + JSON.stringify(await k.boundingBox()) + ' visible ' + await k.isVisible() + '\n' + (await k.innerText()).slice(0, 2000));
await shot(page, 'keys-overlay');
await page.keyboard.press('Escape'); await page.waitForTimeout(100); log(F, 'after Esc visible ' + await k.isVisible());
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();

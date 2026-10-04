/** PT-08 step 12: the PT-07 low items in a scratch copy of the evening's profile: Mark… prompt (N13), chart (c) cliff (N18), Sawtooth face (N17),
 *  campaign standings and tier names (B20), School index minutes (B22), the printable book with hand marks, the D11 legal clock caption (N15),
 *  the stage title in the cockpit and Debrief, and the keys overlay. Never saved (PT08_NOSAVE=1). */
import { launch, goto, shot, txt, log, reset, hold, adv, SHOTS } from './pt08-common.js';
const F = '12-misc.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
async function mark(n: number, label: RegExp, typed: string | null): Promise<void> {
  const row = page.locator(`#book .row[data-n="${n}"]`); await row.scrollIntoViewIfNeeded();
  const sel = row.locator('select.mark-sel'); const opts = await sel.locator('option').allInnerTexts();
  const v = await sel.locator('option').evaluateAll((os, src) => (os as HTMLOptionElement[]).find(o => new RegExp(src).test(o.textContent ?? ''))?.value ?? '', label.source);
  await sel.selectOption(v); await page.waitForTimeout(150);
  const inp = page.locator('input[type=text]:focus'); const ph = await inp.getAttribute('placeholder').catch(() => null); const dv = await inp.inputValue().catch(() => null); const bb = await inp.boundingBox().catch(() => null);
  const rb = await row.boundingBox();
  log(F, `line ${n} ${label}: prompt "${ph}" default "${dv}" at ${JSON.stringify(bb)}; row at ${JSON.stringify(rb)}`);
  if (typed !== null) await inp.fill(typed);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  log(F, '  -> alert: ' + await txt(page, '#alert') + ' | row: ' + (await row.innerText()).replace(/\n/g, ' / ').slice(0, 200));
}
await goto(page, '#/cockpit/drill/D03/0/1'); await hold(page);
await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
await mark(2, /^P /, null); await mark(2, /Loss/, null); await mark(4, /Time of day/, '');
await page.locator('#book .row[data-n="2"]').screenshot({ path: `${SHOTS}/pt08-mark-row-d03.png` });
// N18: chart (c) from the overlay
await page.keyboard.press('c'); await page.waitForTimeout(200);
const ov = await page.locator('body').innerText(); const ci = ov.indexOf('(c)'); log(F, '== chart (c) ==\n' + ov.slice(ci, ci + 1400));
await page.keyboard.press('Escape');
// N17 clock
await page.locator('#clock').screenshot({ path: `${SHOTS}/pt08-clock-sawtooth.png` });
// printable book with marks
const pb = page.locator('a', { hasText: /Print book/ }); log(F, 'print link: ' + await pb.count());
if (await pb.count()) { await pb.first().click(); await page.waitForTimeout(600); log(F, 'print url ' + page.url()); const t = await page.locator('#view').innerText(); log(F, 'printable shows P mark: ' + /P\s?\d/.test(t) + ' | first 600: ' + t.slice(0, 600)); await shot(page, 'book-print-marks'); }
// School index
await goto(page, '#/school'); log(F, '== SCHOOL ==\n' + (await page.locator('#view').innerText()).slice(0, 500));
// campaign
await goto(page, '#/campaign'); await page.waitForTimeout(200); log(F, '== CAMPAIGN ==\n' + (await page.locator('#view').innerText()).slice(0, 1500));
// D11 legal clock caption, stage title
await goto(page, '#/cockpit/drill/D11/1/1'); await hold(page);
log(F, 'D11 legal clock caption: ' + await txt(page, '.clockcap, #clockcap, .clock-caption') + ' | under clock: ' + await page.evaluate(() => { const c = document.querySelector('#clock'); return c?.parentElement?.innerText?.slice(0, 200) ?? ''; }));
log(F, 'D11 preread: ' + (await txt(page, '#preread')).slice(0, 900));
await goto(page, '#/cockpit/builtin/stage/1'); await hold(page);
log(F, 'stage hint: ' + (await txt(page, '#hintbar')).slice(0, 120) + ' | preread title: ' + (await txt(page, '#preread')).slice(0, 60));
await page.keyboard.press('?'); await page.waitForTimeout(150); log(F, 'keys overlay: ' + (await page.locator('body').innerText()).match(/KEYS[\s\S]{0,1200}/)?.[0]);
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();

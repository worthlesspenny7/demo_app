/** PT-07 step 10: the pre-read "Mark…" presets (PREREAD-002) on D03 Bronze and D11 Silver, and the dash clock faces (INST-003: Sawtooth
 *  default, bezel option). Scratch profile, never saved. */
import { launch, goto, shot, txt, log, reset, hold, adv, SHOTS } from './pt07-common.js';
const F = '10-marks-clock.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
async function mark(n: number, label: RegExp, typed: string | null): Promise<void> {
  const row = page.locator(`#book .row[data-n="${n}"]`); await row.scrollIntoViewIfNeeded();
  const sel = row.locator('select.mark-sel'); const opts = await sel.locator('option').allInnerTexts();
  const v = await sel.locator('option').evaluateAll((os, src) => (os as HTMLOptionElement[]).find(o => new RegExp(src).test(o.textContent ?? ''))?.value ?? '', label.source);
  await sel.selectOption(v); await page.waitForTimeout(150);
  const inp = page.locator('input[type=text]:focus'); const ph = await inp.getAttribute('placeholder').catch(() => null); const dv = await inp.inputValue().catch(() => null); const bb = await inp.boundingBox().catch(() => null);
  log(F, `line ${n} ${label}: options [${opts.join(' | ')}]; prompt "${ph}" default "${dv}" at ${JSON.stringify(bb)}`);
  if (typed !== null) await inp.fill(typed);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  log(F, '  -> alert: ' + await txt(page, '#alert') + ' | row now: ' + (await row.innerText()).replace(/\n/g, ' / ').slice(0, 300));
}
await goto(page, '#/cockpit/drill/D03/0/1'); await hold(page);
await mark(2, /^P /, null);          // accept the suggested chart pause
await mark(2, /Loss/, null);
await mark(3, /COMES QUICK/, null);
await mark(4, /Time of day/, '');     // nothing typed: what does it say?
await page.locator('#book .row[data-n="2"]').screenshot({ path: `${SHOTS}/pt07-mark-row-d03.png` });
await goto(page, '#/book/current'); await page.waitForTimeout(400); log(F, 'printable book (current) shows P mark: ' + /P\d/.test(await page.locator('#book-sheets').innerText().catch(() => '')));
await goto(page, '#/cockpit/drill/D11/1/1'); await hold(page);
await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
const stopRow = await page.evaluate(() => { const o = (window as any).__rally.observe(); const r = o.book.find((b: any) => b.pause); return r ? r.n : 2; });
await mark(stopRow, /^P /, '9.6');
// clocks
await goto(page, '#/cockpit/drill/D16/0/1'); await hold(page); await adv(page, 37);
await page.locator('#clock').screenshot({ path: `${SHOTS}/pt07-clock-sawtooth.png` });
log(F, 'clock title/aria: ' + await page.locator('#clock').getAttribute('title') + ' / ' + await page.locator('#clock').getAttribute('aria-label') + ' size ' + JSON.stringify(await page.locator('#clock').boundingBox()));
await goto(page, '#/settings'); await page.waitForTimeout(200);
const s = page.locator('select').filter({ hasText: /Sawtooth/ }); await s.selectOption('bezel').catch(e => log(F, 'bezel select ' + e));
await goto(page, '#/cockpit/drill/D16/0/1'); await hold(page); await adv(page, 37);
await page.locator('#clock').screenshot({ path: `${SHOTS}/pt07-clock-bezel.png` });
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();

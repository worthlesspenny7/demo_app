/** PT-08 step 14: the printable book (#/book/...) after marking D03 line 2 in the cockpit: are the hand marks on the printed page? Scratch profile. */
import { launch, goto, shot, txt, log, reset, hold } from './pt08-common.js';
const F = '14-printbook.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/drill/D03/0/1'); await hold(page);
const row = page.locator('#book .row[data-n="2"]'); const sel = row.locator('select.mark-sel');
const v = await sel.locator('option').evaluateAll(os => (os as HTMLOptionElement[]).find(o => /^P /.test(o.textContent ?? ''))?.value ?? ''); await sel.selectOption(v); await page.waitForTimeout(100); await page.keyboard.press('Enter');
const link = page.locator('a', { hasText: /Print book/ }); log(F, 'link href ' + await link.first().getAttribute('href') + ' target ' + await link.first().getAttribute('target'));
const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 3000 }).catch(() => null), link.first().click()]);
const p = popup ?? page; await p.waitForTimeout(800); log(F, 'opened ' + p.url());
const t = await p.locator('body').innerText(); log(F, 'has P23.5: ' + /P\s?23\.5/.test(t) + '\n' + t.slice(0, 800));
await p.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt08-book-print-marks.png' });
await h.browser.close();

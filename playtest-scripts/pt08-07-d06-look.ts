/** PT-08 step 7a: D06 Bronze, a first look as Josh opens it from the path: pre-read, the perf card, the whole book (the MARK lines name the pairs),
 *  the charts overlay (C), and the Reference's Packard charts. Scratch profile (PT08_NOSAVE=1). */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt08-common.js';
const F = '07-d06-look.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/'); log(F, 'starthere: ' + await txt(page, '#starthere'));
log(F, '== D06 card on Home ==\n' + await page.locator('[data-drill="D06"], .card:has-text("D06")').first().innerText().catch(() => '(none)'));
await page.locator('#starthere').click(); await page.waitForTimeout(300); await hold(page);
log(F, 'url ' + page.url());
await shot(page, 'd06-preread');
log(F, '== HINT ==\n' + await txt(page, '#hintbar') + '\n== PREREAD ==\n' + await txt(page, '#preread') + '\n== PERF ==\n' + await txt(page, '#perfcard'));
const o = await obs(page);
log(F, '== BOOK (engine) ==\n' + o.book.map((b: any) => `${b.n}: ${b.text ?? ''} | speed ${b.speed ?? ''} pause ${b.pause ?? ''} turn ${b.turn ?? ''}`).join('\n'));
await page.keyboard.press('c'); await page.waitForTimeout(200);
await shot(page, 'd06-charts-overlay');
log(F, '== CHARTS OVERLAY ==\n' + (await page.locator('.charts-overlay, #charts, .overlay').first().innerText().catch(() => '(none)')).slice(0, 6000));
await page.keyboard.press('Escape');
await goto(page, '#/reference'); log(F, '== REFERENCE (first 5000) ==\n' + (await page.locator('#view').innerText()).slice(0, 5000));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();

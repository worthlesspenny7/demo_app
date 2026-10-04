/** PT-08 step 1: fresh profile -> Home -> Start here, following the NEW path (EDU-005) as a rookie: four-s, griid-cameo, protocol,
 *  then whatever the lesson's primary button offers, until the path reaches a drill (D09). Every lesson's text is dumped (word count, minutes card),
 *  the check is answered (wrong first where a rookie plausibly slips), and the protocol lesson's Dad card is printed (print media + PDF). */
import { launch, goto, shot, txt, log, reset, OUT } from './pt08-common.js';
const F = '01-lessons.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/');
await shot(page, 'home-fresh');
log(F, '== HOME (fresh) ==\n' + (await page.locator('#view').innerText()).slice(0, 4000));
log(F, 'starthere button: ' + await txt(page, '#starthere'));
await page.locator('#starthere').click(); await page.waitForTimeout(250);
const wrongFirst: Record<string, RegExp> = { 'four-s': /whole delay/, transits: /2:37:00/, lost: /drive faster/ };
for (let k = 0; k < 8; k++) {
  const url = page.url(); log(F, `\n######## step ${k}: ${url}`);
  const m = /#\/school\/([\w-]+)/.exec(url); if (!m) break;
  const id = m[1]!;
  const body = await page.locator('#view').innerText();
  log(F, `== LESSON ${id} == (${body.split(/\s+/).length} words)\n` + body);
  if (id === 'protocol') {
    const card = page.locator('.printcard'); log(F, 'printcard count ' + await card.count());
    if (await card.count()) {
      await card.first().scrollIntoViewIfNeeded(); await shot(page, 'protocol-card-screen');
      await page.evaluate(() => document.documentElement.classList.add('print-card-only'));
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: `${OUT}/dad-card.pdf`, format: 'Letter', printBackground: true }).catch(e => log(F, 'pdf failed ' + e));
      await shot(page, 'dad-card-print', true);
      log(F, 'print-media visible text:\n' + await page.evaluate(() => { const out: string[] = []; document.querySelectorAll('body *').forEach(e => { const s = getComputedStyle(e); if (s.display !== 'none' && s.visibility !== 'hidden' && e.children.length === 0 && (e as HTMLElement).innerText?.trim()) out.push((e as HTMLElement).innerText.trim()); }); return out.join(' | '); }));
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => document.documentElement.classList.remove('print-card-only'));
    }
  }
  const opts = page.locator('.quiz .opt'); const labels = await opts.allInnerTexts();
  const w = wrongFirst[id] ? labels.findIndex(l => wrongFirst[id]!.test(l)) : -1;
  if (w >= 0) { await opts.nth(w).click(); await page.waitForTimeout(100); log(F, 'WRONG picked: ' + labels[w] + ' -> ' + await txt(page, '.quiz p.danger')); }
  // the right answer: the one the lesson explains (read off the page's own check, as a reader who got it would)
  let ok = false;
  for (let i = 0; i < labels.length && !ok; i++) { if (i === w) continue; await opts.nth(i).click(); await page.waitForTimeout(80); ok = (await page.locator('.quiz p.ok').count()) > 0; if (!ok) log(F, 'also wrong: ' + labels[i]); else log(F, 'RIGHT: ' + labels[i] + ' -> ' + (await txt(page, '.quiz p.ok')).slice(0, 300)); }
  await shot(page, `lesson-${id}-end`);
  const btns = await page.locator('#view .actions button').allInnerTexts(); log(F, 'nav buttons: ' + btns.join(' | '));
  const prim = page.locator('#view .actions button.primary').first(); const pt = await prim.innerText(); log(F, 'primary: ' + pt);
  await prim.click(); await page.waitForTimeout(250);
}
log(F, '\nlanded on: ' + page.url());
await goto(page, '#/'); log(F, '== HOME after lessons ==\n' + await txt(page, '#starthere-panel')); log(F, 'starthere button: ' + await txt(page, '#starthere'));
await shot(page, 'home-after-lessons');
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();

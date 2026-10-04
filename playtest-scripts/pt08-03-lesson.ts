/** PT-08 step 3 (generic): Home -> the Start-here button -> the lesson it opens; read it (dump), answer the check (a rookie's slip first where
 *  one is plausible), then press the lesson's primary button and log where it goes. usage: tsx pt08-03-lesson.ts <label> */
import { launch, goto, shot, txt, log, reset } from './pt08-common.js';
const [label = 'lesson'] = process.argv.slice(2);
const F = `03-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/'); log(F, 'starthere: ' + await txt(page, '#starthere'));
await page.locator('#starthere').click(); await page.waitForTimeout(250);
const id = (/#\/school\/([\w-]+)/.exec(page.url()) ?? [])[1] ?? '?';
const body = await page.locator('#view').innerText();
log(F, `== LESSON ${id} (${body.split(/\s+/).length} words) ==\n${body}`);
const wrongFirst: Record<string, RegExp> = { lost: /drive faster/i, transits: /2:37:00/, 'ghost-car': /plus the braking/, 'measure-car': /69.9/ };
const opts = page.locator('.quiz .opt'); const labels = await opts.allInnerTexts();
const w = wrongFirst[id] ? labels.findIndex(l => wrongFirst[id]!.test(l)) : -1;
if (w >= 0) { await opts.nth(w).click(); await page.waitForTimeout(80); log(F, 'WRONG: ' + labels[w] + ' -> ' + await txt(page, '.quiz p.danger')); }
for (let i = 0; i < labels.length; i++) { if (i === w) continue; await opts.nth(i).click(); await page.waitForTimeout(80); if (await page.locator('.quiz p.ok').count()) { log(F, 'RIGHT (' + (i + 1) + '): ' + labels[i] + ' -> ' + await txt(page, '.quiz p.ok')); break; } log(F, 'wrong try: ' + labels[i]); }
await shot(page, `lesson-${id}-end`);
log(F, 'nav: ' + (await page.locator('#view .actions button').allInnerTexts()).join(' | '));
const prim = page.locator('#view .actions button.primary').first(); log(F, 'primary: ' + await prim.innerText());
await prim.click(); await page.waitForTimeout(300); log(F, 'primary goes to ' + page.url());
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();

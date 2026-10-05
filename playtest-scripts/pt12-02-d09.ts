/** PT-12: copy of the PT-11 script, port 4183, scratch pt12. */
/** PT-11 (deck seed via PT12_DECK, default 123). PT-10 step 2: D09 trap quiz from the path. The deck's seed is Date.now() % 1000, pinned to 123 here so the deck can be read twice.
 *  usage: tsx pt12-02-d09.ts dump            (scratch profile: answer 1 to every card, log the card, the right answer and the tip)
 *         tsx pt12-02-d09.ts play 2,1,4,...  (shared profile: Josh's own answers, real digit keys + Enter) */
import { launch, goto, shot, txt, log, reset } from './pt12-common.js';
const [mode = 'dump', answers = ''] = process.argv.slice(2);
const F = `02-d09-${mode}-${process.env.PT12_DECK ?? 123}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }, mode === 'dump');
const { page } = h;
await goto(page, '#/');
await page.evaluate((sx) => { const d0 = Date.now; (Date as any).now = () => Math.floor(d0() / 1000) * 1000 + sx; location.hash = '#/quiz/D09'; }, Number(process.env.PT12_DECK ?? 123));
await page.waitForTimeout(300);
const ans = answers.split(',').map(Number);
for (let i = 0; i < 20; i++) {
  const prompt = await txt(page, '.quiz .panel p'); const opts = await page.locator('.quiz .opt').allInnerTexts();
  if (i === 0) await shot(page, `d09-card1-${mode}`);
  const k = mode === 'dump' ? 1 : (ans[i] ?? 1);
  await page.keyboard.press(String(k)); await page.waitForTimeout(60);
  const fb = await txt(page, '.quiz .panel p.ok, .quiz .panel p.danger');
  log(F, `\n## card ${i + 1}: ${prompt}\n${opts.map((o, j) => `   ${o.replace(/\n/g, ' ')}`).join('\n')}\n -> pressed ${k}: ${fb}`);
  if (mode === 'play' && i === 3) await shot(page, 'd09-feedback');
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
}
log(F, '\n== RESULT ==\n' + await txt(page, '.quiz .panel'));
log(F, 'result buttons: ' + (await page.locator('.quiz .panel button').allInnerTexts()).join(' | '));
if (mode === 'play') { await shot(page, 'd09-result'); await goto(page, '#/'); log(F, '== HOME ==\n' + await txt(page, '#starthere-panel')); await h.close(); }
else await h.browser.close();
log(F, 'errors: ' + JSON.stringify(h.errors));

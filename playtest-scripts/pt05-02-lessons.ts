/** PT-05 step 2: read every School lesson as a rookie: word count, reading time, check question, first-try naive answer, what the Next button offers. */
import { launch, goto, shot, log, reset } from './pt05-common.js';
const F = '02-lessons.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/school');
log(F, '== SCHOOL INDEX ==\n' + await page.locator('#view').innerText());
await shot(page, 'school-index');
const uniq = ['ghost-car', 'four-s', 'which-timer', 'pause-arithmetic', 'timed-leads', 'recovery', 'calibration', 'griid-cameo', 'protocol', 'markup', 'transits', 'rally-school'].map(id => `#/school/${id}`);
for (const href of uniq) {
  await goto(page, href);
  const body = await page.locator('#view').innerText();
  const words = body.split(/\s+/).length;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const btns = await page.locator('#view button').allInnerTexts();
  log(F, `\n== ${href}: ${words} words (~${Math.round(words / 200)} min at 200 wpm), page ${height} px ==`);
  log(F, 'buttons: ' + btns.join(' | '));
  const q = body.indexOf('CHECK'); log(F, body.slice(q, q + 900));
  log(F, 'video-tag count: ' + (body.match(/video, not in the documents/g) ?? []).length + '; REG/HB citations: ' + (body.match(/\b(REG|HB) /g) ?? []).length);
  const id = href.split('/').pop();
  if (['which-timer', 'protocol', 'rally-school', 'transits', 'four-s'].includes(id!)) await shot(page, `lesson-${id}-full`, true);
  if (id === 'protocol') log(F, '== PROTOCOL FULL ==\n' + body);
  if (id === 'transits') log(F, '== TRANSITS FULL ==\n' + body);
  if (id === 'which-timer') log(F, '== WHICH-TIMER FULL ==\n' + body);
}
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();

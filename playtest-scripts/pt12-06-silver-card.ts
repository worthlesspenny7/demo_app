/** PT-12: copy of the PT-11 script, port 4183, scratch pt12. */
/** PT-11: what the Silver withheld card tells Josh at a timed change (D04) and a landmark change (D05), beside the Debrief's own lead. Scratch fresh profile.
 *  Screenshots the perf card when the card shows the withheld timed / ramp line, and the C overlay's chart (a) cell for that pair. */
import { launch, goto, shot, txt, log, reset, hold } from './pt12-common.js';
import { playHuman } from './pt12-human.js';
const F = '06-silver-card.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
for (const [hash, sel, label] of [['drill/D04/1/1', '#withheld-timed', 'd04-silver-card'], ['drill/D05/1/1', '#withheld-ramp', 'd05-silver-card']] as const) {
  await goto(page, `#/cockpit/${hash}`); await hold(page);
  await playHuman(page, { mode: 'card', chart: true, leadRule: 'lead', start: 'count', warn: true, pullUp: true, scale: 4, until: `!!document.querySelector('${sel}')` } as any);
  log(F, `== ${hash}: ${await txt(page, sel)}\n${await txt(page, '#timed-anchor')}`);
  await shot(page, label);
}
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
// PT-12: the Reference page's "From the lessons" section (PLAY-048)
{ const h2 = await launch({ width: 1366, height: 768 }, true); await goto(h2.page, '#/reference'); await h2.page.waitForTimeout(400);
  const sec = h2.page.locator('text=FROM THE LESSONS').first(); await sec.scrollIntoViewIfNeeded().catch(() => {}); await h2.page.waitForTimeout(200); await shot(h2.page, 'reference-from-lessons'); await h2.browser.close(); }

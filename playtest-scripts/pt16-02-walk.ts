/** Pass 1 walker: from the current School page, read it (words, scroll, chips), screenshot, and tap the bottom primary button while the page
 *  is a reading page (concept/example) or already complete; stop at the first interactive page that is not complete and print it.
 *  usage: tsx pt16-02-walk.ts <hash or ''> <shotPrefix> [maxPages] */
import { open, shot, look, tap, words, BASE } from './pt16-common.js';
const [hash = '', prefix = 'walk', max = '12'] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/' + (hash ? '?mode=mobile' + hash : ''));
await page.waitForSelector('[data-screen]'); await page.waitForTimeout(300);
for (let i = 0; i < Number(max); i++) {
  const l = await look(page);
  const w = words(l.text);
  console.log(`--- ${l.hash} ${JSON.stringify(l.school)} words=${w} pageScroll=${JSON.stringify(l.pageScroll)} doc=${JSON.stringify(l.docScroll)} chips=${JSON.stringify(l.chips)}`);
  console.log(l.text.replace(/\n+/g, ' | '));
  console.log('buttons:', l.buttons.filter(b => !/^page \d/.test(b)).join(' ; '));
  await shot(page, `${prefix}-${i}`);
  const s = l.school;
  if (!s || (!s.complete && !['concept', 'example'].includes(s.kind))) { console.log('STOP: interactive page'); break; }
  const primary = page.locator('[data-action=next], [data-testid=start]').last();
  if (!(await primary.count())) { console.log('STOP: no next'); break; }
  await tap(page, '[data-testid=start]:visible, [data-action=next]:visible');
  await page.waitForTimeout(250);
}
console.log('errors', errors);
await ctx.close();

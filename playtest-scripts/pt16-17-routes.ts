/** Pass 2: old-lesson redirects (#/school/<old id>), #/lesson/<id> long form, Rules under Reference. Fresh profile. */
import { open, BASE } from './pt16-common.js';
const ids = ['calibration', 'calibration-laps', 'call-pattern', 'column-b', 'first-morning', 'four-s', 'ghost-car', 'griid-cameo', 'ice-calls', 'lost', 'lost-doctrine', 'markup', 'measure-car', 'pause-arithmetic', 'penalties', 'protocol', 'protocol-rules', 'rally-school', 'recovery', 'restart-steps', 'sign-vocabulary', 'stop-count', 'timed-leads', 'transits', 'which-timer', 'no-such-lesson'];
const { ctx, page, errors } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-routes' });
for (const id of ids) {
  await page.goto(`${BASE}/?mode=mobile#/school/${id}`); await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({ hash: location.hash, screen: (document.querySelector('[data-screen]') as HTMLElement | null)?.dataset.screen, mod: (document.querySelector('[data-screen]') as HTMLElement | null)?.dataset.module, head: ((document.querySelector('[data-screen]') as HTMLElement | null)?.innerText ?? '').split('\n').slice(0, 3).join(' / ') }));
  await page.goto(`${BASE}/?mode=mobile#/lesson/${id}`); await page.waitForTimeout(200);
  const l = await page.evaluate(() => (document.querySelector('.lesson h1') as HTMLElement | null)?.innerText ?? `(no lesson h1) ${(document.body.innerText).slice(0, 60).replace(/\n/g, ' ')}`);
  console.log(`${id.padEnd(18)} -> ${r.hash} [${r.screen}${r.mod ? ' ' + r.mod : ''}] ${r.head.slice(0, 60)} | long form: ${l}`);
}
await page.goto(`${BASE}/?mode=mobile#/reference/rules`); await page.waitForTimeout(300);
console.log('rules', await page.evaluate(() => [(document.querySelector('#rules-page h1') as HTMLElement | null)?.innerText, document.querySelectorAll('.rule-card').length]));
await page.goto(`${BASE}/?mode=mobile#/reference`); await page.waitForTimeout(300);
console.log('reference rules link', await page.locator('a[href="#/reference/rules"]').count());
console.log('errors', errors); await ctx.close();

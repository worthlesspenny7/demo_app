/** Print the oracle answer and option labels for mini-sim pages. usage: <hash>... */
import { open, BASE } from './pt17-common.js';
const { ctx, page } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-probe' });
for (const h of process.argv.slice(2)) {
  await page.goto(BASE + '/?mode=mobile' + h); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ o: (window as any).__rally.school.oracle(), opts: [...document.querySelectorAll('.s2-miniacts [data-option]')].map(b => `${(b as HTMLElement).dataset.option}=${(b as HTMLElement).innerText}`), q: document.querySelector('.s2-minisim .mprompt')?.textContent }));
  console.log(h, r.q, '| oracle', JSON.stringify(r.o), '|', r.opts.join(' ; '));
}
await ctx.close();

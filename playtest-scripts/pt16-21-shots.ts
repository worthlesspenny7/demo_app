/** Screenshots of specific School pages (fresh audit profile, 390x844). usage: <hash>=<name> ... */
import { open, shot, BASE } from './pt16-common.js';
const { ctx, page } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-audit-390' });
for (const a of process.argv.slice(2)) { const [h, n] = a.split('='); await page.goto(`${BASE}/?mode=mobile${h}`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(900); await shot(page, n!); }
await ctx.close();

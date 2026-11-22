/** Pass 2: Continue course from Home (fresh profile): Start, read two pages, leave with the x, see Home, tap Continue course; reload of bare URL. */
import { open, shot, BASE } from './pt16-common.js';
import fs from 'node:fs';
const prof = '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-continue';
fs.rmSync(prof, { recursive: true, force: true });
const { ctx, page, errors } = await open({ profile: prof });
const tapSel = async (sel: string) => { const b = (await page.locator(sel).first().boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(350); };
const where = () => page.evaluate(() => `${location.hash} [${(document.querySelector('[data-screen]') as HTMLElement | null)?.dataset.screen}] ${((document.querySelector('[data-screen]') as HTMLElement | null)?.innerText ?? '').replace(/\n+/g, ' | ').slice(0, 140)}`);
await page.goto(BASE + '/'); await page.waitForSelector('[data-testid=start]');
await tapSel('[data-testid=start]'); console.log('after Start:', await where());
await page.locator('[data-testid=speed-slider]').fill('35'); await page.waitForSelector('.s2-widget.s2-done', { timeout: 30000 });
await tapSel('[data-action=next]:visible'); console.log('page 3:', await where());
await tapSel('[data-action=next]:visible'); console.log('page 4:', await where());
// leave with the x in the strip
const x = page.locator('.s2 a, .s2 button').filter({ hasText: /^×$/ }); console.log('x count', await x.count(), await x.first().getAttribute('href').catch(() => null));
await tapSel('.s2 :is(a,button):text-is("×")'); console.log('after x:', await where());
await shot(page, '18-home-continue');
const cont = page.locator('[data-testid=continue-course]'); console.log('continue label:', await cont.innerText().catch(() => 'NONE'));
if (await cont.count()) { await tapSel('[data-testid=continue-course]'); console.log('after Continue:', await where()); }
await page.goto(BASE + '/'); await page.reload(); await page.waitForTimeout(400); console.log('bare URL again:', await where());
// Modules list
await page.goto(BASE + '/?mode=mobile#/school/modules'); await page.waitForTimeout(400); console.log('modules list:', await where()); await shot(page, '19-modules-list');
console.log('errors', errors); await ctx.close();

/** PT-07: dump the last Debrief of the shared profile (every fold open) to a file, read-only. usage: tsx pt07-debrief-dump.ts <file> */
import { launch, goto, log, reset } from './pt07-common.js';
const F = process.argv[2] ?? 'debrief-dump.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
await goto(page, '#/debrief'); await page.waitForTimeout(400);
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
log(F, await page.locator('#view').innerText());
await h.browser.close();

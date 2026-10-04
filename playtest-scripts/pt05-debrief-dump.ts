/** PT-05 helper: open the last Debrief in the shared profile with every fold open and print it in full. */
import { launch, goto } from './pt05-common.js';
const h = await launch({ width: 1366, height: 768 });
await goto(h.page, '#/debrief');
for (const d of await h.page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
console.log(await h.page.locator('#view').innerText());
await h.browser.close();

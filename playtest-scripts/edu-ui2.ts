import { launch, goto, pause } from './common.js';
const h = await launch(); const { page } = h;
await goto(page, '#/cockpit/drill/D03/2/1'); await page.waitForTimeout(500); await pause(page);
const t = await page.evaluate(() => document.body.innerText);
console.log(t.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40).join(' | ').slice(0, 1500));
await h.close();

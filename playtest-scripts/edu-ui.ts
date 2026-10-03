/** EDUCATION validation: what a UI learner can actually see (restart out-time, digital readouts, card panel at Gold/legal rungs). */
import { launch, goto, pause, text } from './common.js';
const h = await launch();
const { page } = h;
for (const [drill, tier] of [['D16', 0], ['D16', 2], ['D03', 2], ['D12', 1]] as [string, number][]) {
  await goto(page, `#/cockpit/drill/${drill}/${tier}/1`);
  await page.waitForTimeout(400);
  await pause(page);
  const book = await page.evaluate(() => Array.from(document.querySelectorAll('.row')).map(r => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).slice(0, 6));
  const caps = await page.evaluate(() => ({
    clockChip: document.querySelector('#chip-clock, .chip-clock')?.textContent ?? null,
    swCap: Array.from(document.querySelectorAll('*')).filter(e => e.children.length === 0 && /bezel [\d.]+ s/.test(e.textContent ?? '')).map(e => e.textContent).slice(0, 1),
    cardPanel: Array.from(document.querySelectorAll('.lapboard .box')).map(b => (b as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 220)),
    bodyText: document.body.innerText.match(/[Rr]estart[^\n]{0,80}/g)?.slice(0, 4) ?? [],
  }));
  console.log(drill, 'tier', tier, JSON.stringify({ book, caps }, null, 1).slice(0, 1800));
}
await h.close();

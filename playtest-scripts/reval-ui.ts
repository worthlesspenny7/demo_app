/** RE-VALIDATION: what a UI learner sees per rung (restart out-time, digital readouts, computed card). */
import { launch, goto, pause } from './common.js';
const h = await launch();
const { page } = h; await page.addInitScript('window.__name = (f) => f;');
for (const [drill, tier, seed] of [['D16', 0, 1], ['D16', 1, 1], ['D16', 2, 1], ['D03', 0, 1], ['D03', 2, 1], ['D07', 0, 1], ['D12', 0, 1], ['D12', 1, 1], ['D15', 0, 1]] as [string, number, number][]) {
  await goto(page, `#/cockpit/drill/${drill}/${tier}/${seed}`);
  await page.waitForTimeout(500);
  await pause(page);
  const info = await page.evaluate(() => {
    const t = (sel: string) => Array.from(document.querySelectorAll(sel)).map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
    const body = document.body.innerText.replace(/\s+/g, ' ');
    return {
      rows: t('.row').slice(0, 5),
      lapboard: t('.lapboard .box').map(s => s.slice(0, 200)),
      digitalChips: body.match(/PRE-READ[^|]{0,40}/g)?.slice(0, 2),
      swCap: body.match(/(running|stopped) · bezel[^·]{0,40}/)?.[0] ?? null,
      clockCap: body.match(/[0-9:]{7,8} · start [0-9:]+|official start [0-9:]+/)?.[0] ?? null,
      speedoCap: body.match(/[0-9.]+ mph · (holding|no speed)[^·]{0,20}/)?.[0] ?? null,
      cardWord: /\bcard \d+\.\d s|dwell \d+\.\d|call \d+ at \d+\.\d/.test(body),
      restartText: body.match(/RESTART[^.]{0,60}/gi)?.slice(0, 3) ?? [],
    };
  });
  console.log(`\n== ${drill} t${tier} s${seed}`, JSON.stringify(info));
}
await h.close();

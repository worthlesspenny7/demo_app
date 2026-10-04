/** PT-05 generic run: open a drill (or builtin) in the shared profile, screenshot the pre-read, play it with the human model, then
 *  dump the Debrief with every fold opened, and Home's Start-here state.
 *  usage: tsx pt05-run.ts <hash e.g. drill/D03/0/1> <label> '<HumanOpts json>' [width height] */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt05-common.js';
import { playHuman } from './pt05-human.js';
const [hash, label, json, W, Hh] = process.argv.slice(2);
const opts = JSON.parse(json ?? '{"mode":"card"}');
const F = `run-${label}.txt`; reset(F);
const h = await launch({ width: Number(W ?? 1366), height: Number(Hh ?? 768) });
const { page } = h;
await goto(page, `#/cockpit/${hash}`);
await hold(page);
await shot(page, `${label}-preread`);
log(F, `== ${hash} (${label}) opts ${json}`);
log(F, '== HINT ==\n' + await txt(page, '#hintbar'));
log(F, '== PREREAD ==\n' + await txt(page, '#preread'));
log(F, '== DRAWER ==\n' + await txt(page, '.drawer .bar'));
const o0 = await obs(page); log(F, 'book lines ' + o0.book.length + ' start ' + o0.startTime + ' aids ' + JSON.stringify(o0.aids));
const t0 = Date.now();
const r = await playHuman(page, { ...opts, log: s => log(F, s), snap: async (n: string) => { await shot(page, `${label}-${n}`); log(F, `== at ${n}: PERF ==\n` + await txt(page, '#perfcard') + '\n== DRIVER ==\n' + await txt(page, '#driverlog') + '\n== NEXT ==\n' + await txt(page, '#next-call')); } });
log(F, `played: finished ${r.finished} sim ${r.sim.toFixed(0)} s, wall est ${r.wall.toFixed(0)} s (${(r.wall / 60).toFixed(1)} min), keys ${r.keys.length}, script ${(Date.now() - t0) / 1000}s`);
await page.waitForTimeout(600);
if (!/debrief/.test(page.url())) { log(F, 'NOT FINISHED; url ' + page.url()); await shot(page, `${label}-unfinished`); log(F, 'driver: ' + await txt(page, '#driverlog') + '\nperf: ' + await txt(page, '#perfcard') + '\nobs ' + JSON.stringify(await obs(page)).slice(0, 800)); }
else {
  await shot(page, `${label}-debrief`);
  for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
  await shot(page, `${label}-debrief-full`, true);
  log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText());
}
await goto(page, '#/');
log(F, '== HOME ==\n' + await txt(page, '#starthere-panel') + '\n' + await txt(page, '#lastruns'));
log(F, 'errors: ' + JSON.stringify(h.errors) + ' dialogs ' + JSON.stringify(h.dialogs));
await h.close();

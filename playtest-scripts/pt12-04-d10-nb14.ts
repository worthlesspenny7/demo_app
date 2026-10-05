/** PT-12: copy of the PT-11 script, port 4183, scratch pt12. */
/** PT-11: is N-B14 gone on every STOP-T in D10? Scratch fresh profile. For each seed and tier, a card follower plays D10 with turn calls at
 *  <turnFt> ft before the book line's node (the PT-10 rookie called at ~500 ft and met the side road first). Every driver message of the run is
 *  kept (a reference to sim.driverMsgs survives the Debrief), plus the sim's turnKept events and the Debrief stars and tips.
 *  usage: PT12_OUT=<dir> PT12_NOSAVE=1 tsx pt12-04-d10-nb14.ts <seeds e.g. 1-10> <tiers e.g. 0,1> <turnFt list e.g. 500,900> */
import { launch, goto, txt, log, reset, hold, shot } from './pt12-common.js';
import { playHuman } from './pt12-human.js';
const [seedsS = '1-10', tiersS = '0,1', ftS = '500,900'] = process.argv.slice(2);
const [a, b] = seedsS.split('-').map(Number); const seeds = Array.from({ length: (b ?? a!) - a! + 1 }, (_, i) => a! + i);
const F = `04-d10-nb14.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
const sum: string[] = [];
for (const tier of tiersS.split(',').map(Number)) for (const ft of ftS.split(',').map(Number)) for (const seed of seeds) {
  await goto(page, `#/cockpit/drill/D10/${tier}/${seed}`); await hold(page);
  await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
  const info = await page.evaluate(() => { const w = window as any; w.__msgs = w.__rally.sim.driverMsgs; w.__ev = w.__rally.sim.events; const bk = w.__rally.observe().book; return bk.filter((x: any) => x.pause !== undefined && x.turn && x.turn !== 'S').map((x: any) => x.n + ':' + x.turn); });
  // the Bronze next-call prompt: sample it as the car closes on each STOP-T
  const r = await playHuman(page, { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, turnFt: ft, uturnOnDeadEnd: true } as any);
  const msgs: any[] = await page.evaluate(() => ((window as any).__msgs ?? []).map((m: any) => ({ tod: Math.round(m.tod), text: m.text })));
  const kept: number = await page.evaluate(() => ((window as any).__ev ?? []).filter((e: any) => e.type === 'turnKept').length);
  await page.waitForTimeout(500);
  if (seed === 1 && tier === 0 && ft === 500) await shot(page, 'd10-s1-bronze-debrief');
  const deb = /debrief/.test(page.url()) ? await page.locator('#view').innerText() : 'NOT FINISHED';
  const stars = (/[★☆]{3}/.exec(deb) ?? ['?'])[0];
  const bad = msgs.filter(m => /Too late|did not call a turn|Wrong way|off course|Where are we|missed/i.test(m.text));
  const ts = msgs.filter(m => /at the T/i.test(m.text));
  const line = `D10 tier ${tier} seed ${seed} call@${ft}ft: ${stars}, STOP-turn lines [${info.join(' ')}], turnKept ${kept}, bad msgs ${bad.length}${bad.length ? ' (' + bad.map(m => m.text).join(' | ') + ')' : ''}, "at the T" check-offs ${ts.length}; 10 % in Debrief: ${/10 %/.test(deb)}; finished ${r.finished}`;
  sum.push(line); log(F, line);
  log(F, '   msgs: ' + msgs.map(m => m.text).join(' / ').slice(0, 2500));
  log(F, '   debrief head: ' + deb.slice(0, 900).replace(/\n/g, ' / '));
}
log(F, '\n== SUMMARY ==\n' + sum.join('\n'));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();

/** PT-08 probe: D08 Bronze, what the screen tells a card follower about making up a delay (slow truck, red light): the perf card, the ledger box,
 *  Dad's lines and the pace chip right after each delay. Scratch profile. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt08-common.js';
import { playHuman } from './pt08-human.js';
const F = 'probe-d08-makeup.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/cockpit/drill/D08/0/1'); await hold(page);
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as const;
let first = true;
for (const k of [1, 2, 3]) {
  await playHuman(page, { ...base, keepState: !first, until: "o.ahead.some(f => (f.kind === 'slow' || f.signalColor === 'red' || f.gateDown) && f.approxDistanceFt <= 100)" }); first = false;
  let o = await obs(page); if (o.phase === 'finished') break;
  log(F, `\n## delay ${k} at tod ${o.tod.toFixed(1)}: ${JSON.stringify(o.ahead.filter((f: any) => f.kind !== 'intersection'))}`);
  { const t0 = o.tod; await playHuman(page, { ...base, keepState: true, until: `o.tod >= ${t0 + 75}` }); }
  o = await obs(page);
  await shot(page, `d08-after-delay${k}`);
  log(F, `after delay ${k} tod ${o.tod.toFixed(1)} aids ${JSON.stringify(o.aids)}\nPERF: ${await txt(page, '#perfcard')}\nLEDGER: ${await txt(page, '#ledgerbox, .ledger, #ledger')}\nDRIVER: ${(await txt(page, '#driverlog')).split('\n').slice(-5).join(' / ')}\nHINT: ${await txt(page, '#hintbar')}`);
}
await h.browser.close();

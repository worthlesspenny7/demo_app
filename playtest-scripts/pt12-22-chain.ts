/** PT-12: a chained timed change (GEN-017, REG Example #14) played by a Bronze card follower who reads only the perf card (noChain: he does not work out the
 *  second step from Column C himself). Logs the card, Dad's lines, the next-call prompt and the speed for 2 minutes after the landmark.
 *  usage: PT12_OUT=<dir> PT12_NOSAVE=1 tsx pt12-22-chain.ts builtin/stage/2 17 */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt12-common.js';
import { playHuman } from './pt12-human.js';
const [hash = 'builtin/stage/2', lineS = '17'] = process.argv.slice(2); const line = Number(lineS);
const F = `22-chain-${hash.replace(/\W/g, '_')}-${line}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
await goto(page, `#/cockpit/${hash}`); await hold(page);
const base: any = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 8, makeUp: false, countAloud: true, noChain: true, log: (s: string) => log(F, s) };
await playHuman(page, { ...base, until: `S.lineTod && S.lineTod[${line}] !== undefined` });
const o0 = await obs(page); const t0 = o0.tod; const ins = (o0.book as any[]).find(b => b.n === line);
log(F, `line ${line}: ${ins.text}\n  timed ${JSON.stringify(ins.timed)}`);
for (let k = 0; k < 14; k++) {
  await playHuman(page, { ...base, keepState: true, until: `o.tod >= ${t0 + (k + 1) * 10}` });
  const o = await obs(page);
  log(F, `+${(o.tod - t0).toFixed(0)} s: target ${o.driver.targetIndicated} speedo ${Number(o.speedo?.reading ?? 0).toFixed(1)} pace ${o.aids?.earlyLate?.toFixed?.(1)} | next-call "${await txt(page, '#next-call')}" | card "${(await txt(page, '#perfcard')).split('\n').filter(l => /Timed|Line|call|hold/i.test(l)).slice(0, 3).join(' / ')}" | Dad "${(await txt(page, '#driverlog')).split('\n').slice(-2).join(' / ')}"`);
  if (k === 6) await shot(page, `chain-${line}-step2`);
}
await h.browser.close();

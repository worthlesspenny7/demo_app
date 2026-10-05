/** PT-12 (rewritten from pt11-10-stage): a day stage played by the human model in a scratch profile, with the realism-v4 rows watched.
 *  usage: PT12_OUT=<dir> PT12_NOSAVE=1 tsx pt12-10-stage.ts <hash e.g. builtin/stage/1 | drill/D12/0/1> <label> <card|legal> <lines to sample, e.g. 45,58,83,173>
 *  card  = Bronze card follower (the PT-11 Josh: K on the card prompt, 10 % rule from the pace aid, P behind trucks, TA from the helper) at 8x;
 *  legal = no card: dwell from the simple chart (Dec in + Acc out + TS/G at a turning stop), ramp leads from the Lead column, own-time launch, K at holds, TA from his own laps.
 *  At every sample line it stops ~15 s after the car passes it (or when the car stops there) and logs the car's speedo, the driver state, the perf card and Dad's last lines.
 *  sim.events is kept (window.__EV) so the stops, waits and departures at the new rows can be read after the finish. */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt12-common.js';
import { playHuman } from './pt12-human.js';
const [hash = 'builtin/stage/1', label = 'stage-s1', mode = 'card', linesS = ''] = process.argv.slice(2);
const sample = linesS.split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
const F = `10-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
await goto(page, `#/cockpit/${hash}`); await hold(page);
await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {}); await hold(page);
let o = await obs(page);
log(F, `${hash}: book ${o.book.length} lines, launch ${JSON.stringify(o.launch)}, asp ${o.asp}`);
log(F, '== PREREAD ==\n' + (await txt(page, '#preread')).slice(0, 1200) + '\n== PERF ==\n' + (await txt(page, '#perfcard')).slice(0, 1500));
await shot(page, `${label}-preread`);
await page.evaluate(() => { (window as any).__EV = (window as any).__rally.sim.events; });
const pc = await txt(page, '#perfcard');
const legal = mode === 'legal';
const v0 = (o.book as any[]).find(b => typeof b.speed === 'number')?.speed ?? 35;
const lead = (() => { const row = pc.split('\n').map(r => r.trim().split(/\s+/)).find(c => Number(c[0]) === v0 && c.length >= 4); return row ? Math.round(Number(row[2])) : 4; })();
const base: any = legal ? { mode: 'legal', chart: true, leadRule: 'lead', start: 'own', lead, kAtHolds: true, countAloud: true, ta: true, warn: true, pullUp: true, scale: 8, uturnOnDeadEnd: true, log: (s: string) => log(F, s) }
  : { mode: 'card', chart: false, start: 'count', warn: true, pullUp: true, scale: 8, uturnOnDeadEnd: true, makeUp: true, countAloud: true, ta: true, log: (s: string) => log(F, s) };
log(F, `mode ${mode}${legal ? `, own launch lead ${lead} s (0 > ${v0})` : ''}`);
let wall = 0; let first = true;
for (const n of sample) {
  const ins = (o.book as any[]).find(b => b.n === n);
  const r = await playHuman(page, { ...base, keepState: !first, until: `o.stoppedAtLine === ${n} || (S.lineTod && S.lineTod[${n}] && o.tod > S.lineTod[${n}] + 15)` }); first = false; wall = r.wall;
  o = await obs(page); if (o.phase === 'finished') { log(F, `finished before line ${n}`); break; }
  log(F, `\n#### line ${n} "${(ins?.text ?? '').slice(0, 120)}" C=${JSON.stringify({ sp: ins?.speed, p: ins?.pause, timed: ins?.timed })}\n  tod ${o.tod.toFixed(1)} state ${o.driver.state} target ${o.driver.targetIndicated} speedo ${JSON.stringify(o.speedo?.reading ?? o.speedo)} stoppedAt ${o.stoppedAtLine} pace ${o.aids?.earlyLate}`);
  log(F, '  driver: ' + (await txt(page, '#driverlog')).split('\n').slice(-4).join(' / '));
  log(F, '  card: ' + (await txt(page, '#perfcard')).replace(/\n/g, ' | ').slice(0, 700));
  log(F, '  next-call: ' + await txt(page, '#next-call'));
  await shot(page, `${label}-L${n}`);
}
const r = await playHuman(page, { ...base, keepState: !first }); wall = r.wall;
log(F, `played: finished ${r.finished} wall est ${(wall / 60).toFixed(1)} min, sim ${(r.sim / 60).toFixed(1)} min`);
const ev = await page.evaluate(() => JSON.parse(JSON.stringify(((window as any).__EV ?? []).filter((e: any) => !['instrument', 'count', 'nextCall'].includes(e.type))))).catch(() => []);
const book = o.book as any[];
for (const n of sample) {
  const ins = book.find(b => b.n === n); if (!ins) continue;
  const nodeEv = ev.find((e: any) => e.type === 'node' && e.detail?.nodeId === ins.nodeId);
  const around = nodeEv ? ev.filter((e: any) => Math.abs(e.tod - nodeEv.tod) < 60 && ['wait', 'depart', 'release', 'driver', 'turn', 'traffic', 'restart'].includes(e.type)).map((e: any) => `${(e.tod - nodeEv.tod).toFixed(1)} ${e.type} ${JSON.stringify(e.detail ?? {}).slice(0, 120)}`) : [];
  log(F, `events at line ${n}: node ${nodeEv ? nodeEv.tod.toFixed(1) : 'none'}; ${around.join(' ; ')}`);
}
await page.waitForTimeout(800);
if (!/debrief/.test(page.url())) { o = await obs(page); log(F, 'NOT FINISHED ' + page.url() + ' state ' + o?.driver?.state + ' line ' + o?.currentLine); await shot(page, `${label}-unfinished`).catch(() => {}); }
else { await shot(page, `${label}-debrief`).catch(e => log(F, 'debrief screenshot failed: ' + String(e).slice(0, 120))); for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true); log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText()); }
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.browser.close();

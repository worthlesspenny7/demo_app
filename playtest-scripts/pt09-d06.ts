/**
 * PT-09 area 3: D06 raw-run parsing and grading edges, plus a fairness check: do the true measurements a player could take in the sim
 * (loss between the MARK lines, from the run's own events) land within 1 s of the truth the rubric grades against?
 * Usage: npx tsx playtest-scripts/pt09-d06.ts
 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { parseChartRuns, parseChartNotes, parseRawRuns, deriveFromRaw, chartPairs, driverOf } from '../src/core/drills/d06.js';
import { Simulator, type Action, type StageResult } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { buildPerfTable, matrixAt, stopLoss, accelLoss } from '../src/core/perf-table.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { instructionS, type Scenario } from '../src/core/course.js';

const d = drillById('D06')!; const log = console.log; const issues: string[] = [];
const play = (sc: Scenario, notes: string[]): StageResult => { const sim = new Simulator(sc, { watch: 'digital' }); let done = false; const o = new OracleBot(sim, { useWatch: true });
  const b: Bot = { name: 'n', onTick(s) { if (!done) { done = true; for (const t of notes) s.act({ type: 'note', text: t } as Action); } o.onTick(s); } }; return runBot(sim, b); };
const grade = (sc: Scenario, notes: string[]) => { const r = play(sc, notes); return d.rubric(r, sc); };

// ---- 1. malformed notes: never throw, never NaN, never panic on pathological length
{
  const sc = d.scenario(1, 1); const pairs = chartPairs(sc.tags); const p = pairs[0]!;
  const junk = ['', ' ', 'stopgo', 'stopgo 30>40', 'stopgo 30>40 =', 'stopgo 30>40 = abc', 'stopgo 30>40 = -', 'stopgo 30>40 = 1e3', 'stopgo 30>40 = Infinity', 'stopgo 30>40 = NaN', 'stopgo 30>40 runs', 'stopgo 30>40 runs 8.4 8.6 x 8.5',
    'stopgo >40 = 8', 'stopgo 30> = 8', 'stopgo 30>40>50 = 8', 'turn 40>35 = 4.0.1', 'turn 40>35 = .5', 'turn 40>35 = 4,5', 'accel 0>40 = 4,5', 'const 25 runs', 'const runs 19.8', 'const 25 runs -19.8 -19.9', 'acc 25 runs 18.0 18.1 B: 3',
    'A: B: stopgo 30>40 = 8', 'B:', 'B', 'driver', 'driver B', 'stopgo 30>40 = 8 stopgo 30>40 = 9', '```stopgo 30>40 = 8```', 'STOPGO 30>40 = 8.4', 'Stop & Go 30 -> 40 = 8.4', 'stop and go 30 → 40: 8.4', 'sg 30/40 = 8.4', 'ad 0>40 = 4.5', 'a'.repeat(200000), ' '.repeat(200000) + 'stopgo 30>40 = 8', 'stopgo' + ' '.repeat(100000) + '30>40 = 8', 'const 25 runs ' + '1 '.repeat(100000), '9'.repeat(5000), 'stopgo 30>40 = ' + '9'.repeat(400)];
  for (const j of junk) {
    const t0 = Date.now();
    try { const rb = grade(sc, [j]); const ms = Date.now() - t0; if (/NaN|Infinity/.test(JSON.stringify(rb))) issues.push(`junk ${JSON.stringify(j.slice(0, 40))}: NaN/Infinity in the rubric`); if (ms > 3000) issues.push(`junk ${JSON.stringify(j.slice(0, 30))} (${j.length} chars): slow ${ms} ms`); }
    catch (e) { issues.push(`junk ${JSON.stringify(j.slice(0, 40))}: threw ${(e as Error).message}`); }
  }
  // parsers directly
  const t0 = Date.now(); parseRawRuns(['const 25 runs ' + '1 '.repeat(200000)]); parseChartRuns(['stopgo 30>40 runs ' + '1 '.repeat(200000)]); const ms = Date.now() - t0; log(`parse of 200k-run notes: ${ms} ms`);
  void p;
}

// ---- 2. raw runs: derived cells, negatives, per-driver tags, 55 mph
{
  const sc = d.scenario(2, 1); const perf = buildPerfTable(sc.car); const drv = driverOf(sc.tags);
  const T = 40 / 3600 * 5280 / 1.4667; void T;
  // the player's raw run times between two marks 1000 ft apart: const = 1000/v; acc = const + accelLoss; brk = const + decelLoss(=perf.accel[v][0])
  const run = (v: number, extra: number): string => { const t = 1000 / (v * 1.4667) + extra; return [t, t + 0.1, t - 0.1, t].map(x => x.toFixed(2)).join(' '); };
  const speeds = [25, 30, 35, 40, 45, 50, 55];
  const lines: string[] = [];
  for (const v of speeds) { lines.push(`const ${v} runs ${run(v, 0)}`); lines.push(`acc ${v} runs ${run(v, matrixAt(perf.accel, 0, v))}`); lines.push(`brk ${v} runs ${run(v, matrixAt(perf.accel, v, 0))}`); }
  const raw = parseRawRuns(lines, drv); const dv = deriveFromRaw(raw);
  let worst = 0, wp = '';
  for (const a of speeds) for (const b of speeds) { const tv = matrixAt(perf.stopGo, a, b); const got = dv.pause[`${a}>${b}`]; if (got === undefined) { issues.push(`derived pause ${a}>${b} missing`); continue; } const e = Math.abs(got - tv); if (e > worst) { worst = e; wp = `${a}>${b} derived ${got} vs chart ${tv.toFixed(1)}`; } }
  log(`raw -> derived stop&go pause: worst error ${worst.toFixed(2)} s (${wp}); negatives ${dv.negatives.length} discrepant ${dv.discrepant.length} over15 ${dv.pauseOver15.length}`);
  if (worst > 0.6) issues.push(`raw-run derived stop-and-go pause differs from the chart by ${worst.toFixed(2)} s (${wp})`);
  // acc cell: derived acc[v] vs chart accel 0>v
  let wacc = 0; for (const v of speeds) wacc = Math.max(wacc, Math.abs(dv.acc[v]! - matrixAt(perf.accel, 0, v))); log(`derived acc worst error ${wacc.toFixed(2)} s`);
  // per-driver tags
  const pairs = chartPairs(sc.tags); const zero = pairs.find(p => p.kind === 'accel' && p.vIn === 0);
  const sg = pairs.find(p => p.kind === 'stopGo')!; const tv = matrixAt(perf.stopGo, sg.vIn, sg.vOut);
  const note = (tag: string, val: number): string => `${tag}stopgo ${sg.vIn}>${sg.vOut} = ${val.toFixed(1)}`;
  const stars = (notes: string[]) => { const rb = grade(sc, notes); return rb.headline.split(' ')[0]; };
  const wrongDrv = drv === 'A' ? 'B' : 'A';
  log(`scenario driver ${drv}; stop&go pair ${sg.vIn}>${sg.vOut} truth ${tv.toFixed(1)}`);
  const cases: [string, string[]][] = [
    ['untagged correct', [note('', tv)]], [`${drv}: correct`, [note(`${drv}: `, tv)]], [`${drv.toLowerCase()}: correct (lowercase)`, [note(`${drv.toLowerCase()}: `, tv)]], [`driver ${drv} correct`, [note(`driver ${drv} `, tv)]], [`driver ${drv}: correct`, [note(`driver ${drv}: `, tv)]],
    [`${drv} - correct`, [note(`${drv} - `, tv)]], [`${drv} correct (no colon)`, [note(`${drv} `, tv)]], [`${wrongDrv}: correct (the other driver)`, [note(`${wrongDrv}: `, tv)]], [`${wrongDrv}: wrong then ${drv}: right`, [note(`${wrongDrv}: `, tv + 5), note(`${drv}: `, tv)]],
    [`${drv}: wrong then ${wrongDrv}: right`, [note(`${drv}: `, tv + 5), note(`${wrongDrv}: `, tv)]], ['two untagged, last right', [note('', tv + 5), note('', tv)]], ['two untagged, last wrong', [note('', tv), note('', tv + 5)]],
    ['leading space + tag', [`  ${drv}:  stopgo ${sg.vIn}>${sg.vOut}   =   ${tv.toFixed(1)}  `]], ['tag after a sentence', [`my notes ${drv}: stopgo ${sg.vIn}>${sg.vOut} = ${tv.toFixed(1)}`]], ['tag mid-note (second chart)', [`stopgo ${sg.vIn}>${sg.vOut} = ${(tv + 5).toFixed(1)} ${wrongDrv}: stopgo ${sg.vIn}>${sg.vOut} = ${tv.toFixed(1)}`]],
  ];
  for (const [name, ns] of cases) log(`  ${name.padEnd(46)} -> first-pair match: ${(() => { const r = play(sc, ns); const rb = d.rubric(r, sc); const line = rb.feedback.find(l => l.startsWith(`stop & go ${sg.vIn}>${sg.vOut}:`)) ?? '?'; return line.slice(0, 80); })()}`);
  void zero; void stars;
  // negative derived cells
  const neg = ['const 30 runs 19.0 19.0 19.0 19.0', 'acc 30 runs 18.0 18.0 18.0 18.0', 'brk 30 runs 18.5 18.5 18.5 18.5'];
  const rb = grade(sc, neg); log('negative derived cells:', rb.feedback.filter(l => /NEGATIVE|above 15/.test(l)).map(l => l.slice(0, 120)).join(' || ') || 'NOT FLAGGED');
  if (!rb.feedback.some(l => /NEGATIVE/.test(l))) issues.push('negative derived cells (acc < const) not flagged');
  // a derived stop-and-go that is not > 15: pause comes out over 15
  // 55 mph at Silver
  const sc55 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(s => d.scenario(s, 1)).filter(s => chartPairs(s.tags).some(p => p.vIn === 55 || p.vOut === 55));
  log(`Silver seeds 1-12 with a 55 mph pair: ${sc55.length}`);
  for (const s of sc55.slice(0, 2)) {
    const pr = chartPairs(s.tags).filter(p => p.vIn === 55 || p.vOut === 55); const pf = buildPerfTable(s.car);
    const ns = pr.map(p => `${p.kind === 'stopGo' ? 'stopgo' : p.kind === 'stopMid' ? 'stopmid' : p.kind} ${p.vIn}>${p.vOut} = ${(p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, s.car) : matrixAt(p.kind === 'stopGo' ? pf.stopGo : p.kind === 'accel' ? pf.accel : pf.turns, p.vIn, p.vOut)).toFixed(1)}`);
    const r = play(s, ns); const rb2 = d.rubric(r, s); log(`  ${s.id}: pairs ${pr.map(p => `${p.kind}:${p.vIn}>${p.vOut}`).join(',')} -> ${rb2.headline}; extrapolated flag: ${rb2.feedback.some(l => /extrapolated/.test(l))}; Silver car extrapolated list ${JSON.stringify(pf.extrapolated)}; the hidden Ford has real 55 cells: ${s.car.tables ? 'table' : 'model'}`);
  }
}

// ---- 3. fairness: the measurements a player can really take between the MARK lines vs the rubric's truth
{
  const res: string[] = []; let fair = 0, total = 0; const starsBy: Record<string, number[]> = {}; const byKind: Record<string, { n: number; bad: number; worst: number; sum: number }> = {};
  for (const tier of [0, 1, 2]) for (let seed = 1; seed <= 10; seed++) {
    const sc = d.scenario(seed, tier); const perf = buildPerfTable(sc.car); const sim = new Simulator(sc, { watch: 'digital' });
    const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true })); const g = buildGhost(sc);   // the measurer: no lead, no recovery, full pause (what a person timing the car does)
    const insBy = (txt: RegExp) => sc.book.find(i => txt.test(i.text ?? ''));
    const crossOf = (n: string, inout: 'in' | 'out') => { const ins = insBy(new RegExp(`^MARK ${n} ${inout}\\b`)); if (!ins) return null; const e = r.events.find(x => x.type === 'node' && x.detail?.nodeId === ins.nodeId); return e ? { tod: e.tod, ghost: ghostTimeAt(g, instructionS(sc.course, ins)) } : null; };
    const allPairs = chartPairs(sc.tags); const myNotes: string[] = [];
    for (const p of allPairs) {
      const idx = allPairs.filter(q => q.kind === p.kind).indexOf(p) + 1; const id = p.kind === 'stopGo' ? `A${idx}` : p.kind === 'accel' ? `B${idx}` : p.kind === 'turn' ? `C${idx}` : 'D1';
      const a = crossOf(id, 'in'), b = crossOf(id, 'out'); if (!b) continue;
      const tv = p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, sc.car) : matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut);
      let measured: number;
      if (p.kind === 'accel' && p.vIn === 0) measured = b.tod - b.ghost;                          // late at the out mark against the ghost
      else if (!a) continue;
      else if (p.kind === 'stopGo') { const w = r.events.find(e => e.type === 'wait' && e.tod > a.tod && e.tod < b.tod); const rel = w ? r.events.find(e => e.type === 'release' && e.tod > w.tod) : null; const dwell = w && rel ? rel.tod - w.tod : 0; measured = dwell + ((b.ghost - a.ghost) - (b.tod - a.tod)); }
      else measured = (b.tod - a.tod) - (b.ghost - a.ghost);
      myNotes.push(`${p.kind === 'stopGo' ? 'stopgo' : p.kind === 'stopMid' ? 'stopmid' : p.kind} ${p.vIn}>${p.vOut} = ${measured.toFixed(1)}`);
      const err = Math.abs(measured - tv); const k = `${p.kind}${tier === 0 ? '-B' : tier === 1 ? '-S' : '-G'}`; const e = (byKind[k] ??= { n: 0, bad: 0, worst: 0, sum: 0 }); e.n++; e.sum += measured - tv; e.worst = Math.max(e.worst, err); total++;
      if (err <= 1) fair++; else { e.bad++; if (res.length < 12) res.push(`${sc.id} ${p.kind} ${p.vIn}>${p.vOut}: measured ${measured.toFixed(2)} truth ${tv.toFixed(2)} (err ${err.toFixed(2)})`); }
    }
    { const sim2 = new Simulator(sc, { watch: 'digital' }); let done = false; const o2 = new OracleBot(sim2, { ignoreLosses: true });
      const r2 = runBot(sim2, { name: 'm', onTick(s2) { if (!done) { done = true; for (const t of myNotes) s2.act({ type: 'note', text: t } as Action); } o2.onTick(s2); } }); (starsBy[['Bronze', 'Silver', 'Gold'][tier]!] ??= []).push(d.rubric(r2, sc).stars); }
  }
  log('stars of an honest measurer (rookie-bot run, notes = what the run measured):', Object.entries(starsBy).map(([k, v]) => `${k} ${v.join('/')}`).join(' | '));
  log(`fairness: ${fair}/${total} pairs measurable within 1 s of the graded truth (rookie/measurer-driven runs, seeds 1-10, 3 tiers)`);
  for (const [k, v] of Object.entries(byKind).sort()) log(`  ${k.padEnd(12)} n ${String(v.n).padStart(3)} outside 1 s ${String(v.bad).padStart(3)} worst ${v.worst.toFixed(2)} mean bias ${(v.sum / v.n).toFixed(2)}`);
  log(res.join('\n'));
}
log('ISSUES', issues.length); log(issues.join('\n'));
void parseChartNotes; void accelLoss;

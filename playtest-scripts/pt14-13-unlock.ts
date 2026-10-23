/** PT-14: how many runs until the Boss opens (all meters >= 50 %) and Legal (80 %), for the rule-card follower and for a rookie who is
 *  right about 70 % of the time (the follower, with a random wrong option or a 3 s late tap 30 % of the time). Daily set first each day,
 *  then practice runs, as the phone Home offers them. Headless (src/core/decision Progress in memory). */
import { Progress, Scheduler, DecisionRun, SKILLS, bossUnlocked } from '../src/core/decision/index.js';
import { follow } from './pt14-follower.js';
import { screenOf, toResponse } from './pt14-10-follower-audit.js';
let rs = 7; const rnd = (): number => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
function play(run: DecisionRun, pWrong: number): void {
  for (let i = 0; i < 200; i++) {
    const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
    const d = st.decision; const r = run.currentRunner()!; const arrow = (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined;
    let resp = toResponse(follow(screenOf(d, run.plan.rung, arrow), () => 0.2), d);
    if (rnd() < pWrong) { if (resp.optionId && d.options) resp = { optionId: d.options.find(o => o.id !== resp.optionId)!.id }; else if (resp.tapSeconds !== undefined) resp = { tapSeconds: resp.tapSeconds + 3 }; else if (resp.taps) resp = { taps: [resp.taps[0]!, resp.taps[1]! + 3] }; }
    run.answer(resp);
  }
}
const out: Record<string, unknown> = {};
for (const [name, pWrong] of [['follower', 0], ['rookie 70 %', 0.3]] as const) {
  const p = new Progress(null); let runs = 0; let bossAt: number | null = null; let day = 0; const trace: string[] = [];
  while (runs < 60 && bossAt === null) {
    const dk = `2026-11-${String(1 + day).padStart(2, '0')}`;
    for (let i = 0; i < 3 && bossAt === null; i++) { const plan = p.dailyPlan(i, dk); const run = new DecisionRun(plan); play(run, pWrong); p.recordRun(run.result(), plan, dk); runs++; if (bossUnlocked(p.state(), dk)) bossAt = runs; }
    for (let k = 0; k < 2 && bossAt === null; k++) { const plan = p.practicePlan([...SKILLS], 1000 + runs, dk); const run = new DecisionRun(plan); play(run, pWrong); p.recordRun(run.result(), plan, dk); runs++; if (bossUnlocked(p.state(), dk)) bossAt = runs; }
    trace.push(`day ${day + 1} after ${runs} runs: ${SKILLS.map(s => `${s} ${Math.round(p.meter(s, dk) * 100)}`).join(', ')}`);
    day++;
  }
  out[name] = { bossOpensAfterRuns: bossAt, days: day, trace };
}
console.log(JSON.stringify(out, null, 1));

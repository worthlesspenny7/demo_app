/** PT-14 probe: on Boss legs, why does a rule-card follower (START on Mark!, CALL at interval - lead on the watch) miss timed starts?
 *  Logs the car's pace against the ghost at the card, the truth taps and the follower's taps. */
import { Scheduler, DecisionRun } from '../src/core/decision/index.js';
import { follow } from './pt14-follower.js';
import { screenOf, toResponse } from './pt14-10-follower-audit.js';
const rows: string[] = [];
for (const [rung, base] of [[2, 0], [1, 1]] as const) for (let s = 1; s <= 10; s++) {
  const run = new DecisionRun(Scheduler.boss(s * 1237 + base, null, rung).plan()); let idx = 0;
  for (let i = 0; i < 200; i++) {
    const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
    const d = st.decision; const r = run.currentRunner()!; idx++;
    const arrow = (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined;
    const a = follow(screenOf(d, rung, arrow), () => 0.2);
    if (d.kind === 'timedStart') {
      const pace = r.sim.pace(); const o = r.oracle(d);
      const v = run.answer(toResponse(a, d));
      rows.push(`rung ${rung} seed ${s} card ${idx} ${r.scenario.tags?.includes('boss') ? 'LEG' : 'micro'} pace ${pace.toFixed(1)} s | truth [${o.taps}] follower [${(a as any).taps.map((x: number) => x.toFixed(1))}] | ${v.correct ? 'RIGHT' : 'WRONG ' + v.missed} | ${d.prompt}`);
    } else run.answer(toResponse(a, d));
  }
}
console.log(rows.join('\n'));

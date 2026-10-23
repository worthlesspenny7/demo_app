/** PT-15 probe: a compressed Boss timed start (the hold skips ahead 2 s after the sign) answered with a START that is 2.5 s late in wall
 *  time (after the jump): what does the verdict say? Also a START 1.0 s late (before the jump) for contrast. */
import { Scheduler, DecisionRun } from '../src/core/decision/index.js';
import { cardOf } from '../src/core/decision/runner.js';
import { follow } from './pt15-follower.js';
for (let s = 1; s <= 40; s++) {
  const run = new DecisionRun(Scheduler.boss(s * 4241 + 7, null, 2).plan());
  for (let i = 0; i < 200; i++) {
    const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
    const d = st.decision; const r = run.currentRunner()!;
    if (d.kind === 'timedStart' && d.timing?.skip) {
      const t = d.timing; const sign = t.truthSeconds; const good = follow(d, { react: () => 0.25 }).taps!;
      for (const lateWall of [1.0, 2.5]) {
        const startCard = cardOf(t, sign + lateWall); const call = good[1];
        const rr = new DecisionRun(Scheduler.boss(s * 4241 + 7, null, 2).plan());
        // replay to the same card with oracle answers
        for (let k = 0; k < 200; k++) { const s2 = rr.next(); if (!s2) break; if (s2.type === 'rule') { rr.ack(); continue; } if (s2.decision.id === d.id) { const v = rr.answer({ taps: [startCard, Math.max(call, startCard + 0.5)] }); console.log(`seed ${s}: "${d.prompt.slice(0, 60)}" skip ${JSON.stringify(t.skip)} START ${lateWall} s late (wall) -> card ${startCard.toFixed(1)}: ${v.correct ? 'Right' : 'Not quite'} ${v.missed ?? ''} ${v.secondsDelta} | ${v.chosen}`); break; } rr.answer(rr.oracle()); }
      }
      process.exit(0);
    }
    run.answer(run.oracle());
  }
}

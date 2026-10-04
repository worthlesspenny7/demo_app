/** PT-06 area 2: same TA-window float edge on real generated days: the end-of-stage TA window, a request at exactly 900.0 s after the TA point. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot } from '../src/agent/bots.js';
let bad = 0, n = 0; const rows: string[] = [];
for (let seed = 1; seed <= 16; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true, noRecovery: true }); (bot as any).declareTA = () => {};
  let n2 = 0; while (sim.phase !== 'finished' && n2 < 2) { bot.onTick(); sim.step(0.1); if (sim.taState().windowOpen && !(sim as any)._seen) { (sim as any)._seen = true; } const st = sim.taState(); if (st.windowOpen && st.endOfStage) { n2 = 2; } }
  if (sim.phase === 'finished') continue;
  const t0 = sim.tod, tick0 = sim.tick; for (let i = 0; i < 9000; i++) sim.step(0.1);
  const open = sim.taState().windowOpen; n++; rows.push(`seed ${seed}: tick ${tick0} tod ${t0} phase after 900 s ${sim.phase} open ${open} secondsLeft ${sim.taState().secondsLeft}`); if (!open && sim.phase !== 'finished') { bad++; rows.push(`seed ${seed}: end-of-stage TA point at tod ${t0} (tick ${tick0}); 900.0 s later windowOpen=false`); }
}
console.log(`end-of-stage windows checked ${n}; closed one tick early at exactly 900.0 s: ${bad}`); console.log(rows.join('\n'));

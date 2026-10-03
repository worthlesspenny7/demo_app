/** PT-04: "human-ish" rungs the shipped ladder lacks: reaction-noise navigator (+TA), with and without the truth ledger. */
import { Simulator, type Action } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot, type Bot } from '../src/agent/bots.js';
import { rng } from '../src/core/rng.js';
import { DRIVER_DAD_ROOKIE, DRIVER_DAD_SPORTSMAN, type Scenario } from '../src/core/course.js';

function jittered(sim: Simulator, seed: number, mean: number, sd: number): () => void {
  const r = rng(`jit:${seed}`); const q: { at: number; a: Action }[] = []; const orig = sim.act.bind(sim);
  (sim as unknown as { act: (a: Action) => void }).act = (a: Action) => {
    if (a.type === 'call.go' || a.type === 'call.speed' || a.type === 'call.turn') q.push({ at: sim.tod + Math.max(0, mean + r.gauss(0, sd)), a }); else orig(a);
  };
  return () => { for (let i = q.length - 1; i >= 0; i--) if (q[i]!.at <= sim.tod) { const [x] = q.splice(i, 1); orig(x!.a); } };
}
const seeds = (process.argv[2] ?? '1,2,3,4,5,6').split(',').map(Number);
const variants: { name: string; opt: ConstructorParameters<typeof OracleBot>[1]; mean: number; sd: number; drv?: typeof DRIVER_DAD_ROOKIE }[] = [
  { name: 'truth-ledger, reaction 0.3+-0.2 s, DadSportsman', opt: { useWatch: true }, mean: 0.3, sd: 0.2, drv: DRIVER_DAD_SPORTSMAN },
  { name: 'truth-ledger, reaction 0.5+-0.4 s, DadRookie', opt: { useWatch: true }, mean: 0.5, sd: 0.4, drv: DRIVER_DAD_ROOKIE },
  { name: 'no ledger (noRecovery), reaction 0.3+-0.2, DadSportsman', opt: { useWatch: true, noRecovery: true }, mean: 0.3, sd: 0.2, drv: DRIVER_DAD_SPORTSMAN },
];
for (const v of variants) {
  const tot: number[] = [];
  for (const seed of seeds) {
    const base = generateStage(seed, PROFILES.fullStage); const sc: Scenario = { ...base, driver: v.drv ?? base.driver };
    const sim = new Simulator(sc, { watch: 'analog' }); const bot = new OracleBot(sim, v.opt); const flush = jittered(sim, seed, v.mean, v.sd);
    let t = 0; while (sim.phase !== 'finished' && t < 9 * 3600) { flush(); bot.onTick(); for (const [k, q] of Object.entries(sim.taQualifying)) { const leg = Number(k); if (q > 0 && (sim.taDeclared[leg] ?? 0) !== Math.round(q)) sim.act({ type: 'ta.declare', seconds: Math.round(q), legIndex: leg }); } sim.step(0.1); t += 0.1; }
    const r = sim.result(); tot.push(r.score.raw);
    console.log(`${v.name.padEnd(60)} seed ${seed} legs ${r.score.legs.length} raw ${String(r.score.raw).padStart(4)} (x.845 ${r.score.score.toFixed(1)}) aces ${r.score.aces} err[${r.score.legs.map(l => l.error ?? 'MISS').join(',')}]`);
  }
  console.log(`   -> mean raw/day ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)}\n`);
}

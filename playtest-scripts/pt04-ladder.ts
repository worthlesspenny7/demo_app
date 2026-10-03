/** PT-04 realism validation: bot ladder on the generated full stage with the 4 h runBot cap lifted and an optional TA-declaring oracle.
 *  npx tsx playtest-scripts/pt04-ladder.ts [seeds=1,2,3]  */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot, type Bot } from '../src/agent/bots.js';
import { STOCK_1939_SPEEDO } from '../src/core/builder.js';
import { DRIVER_DAD_ROOKIE, DRIVER_DAD_SPORTSMAN, type Scenario } from '../src/core/course.js';

class TaBot implements Bot {
  name = 'oracle+TA';
  constructor(private inner: OracleBot) {}
  onTick(sim: Simulator): void {
    this.inner.onTick();
    // declare exactly the qualifying delay of the leg just completed / in progress (cap handled by the engine)
    for (const [k, v] of Object.entries(sim.taQualifying)) { const leg = Number(k); if (v > 0 && (sim.taDeclared[leg] ?? 0) !== Math.round(v)) sim.act({ type: 'ta.declare', seconds: Math.round(v), legIndex: leg }); }
  }
}
function run(sc: Scenario, mk: (sim: Simulator) => Bot, maxSeconds = 9 * 3600) {
  const sim = new Simulator(sc, { watch: 'analog' }); const bot = mk(sim);
  let t = 0; while (sim.phase !== 'finished' && t < maxSeconds) { bot.onTick(sim); sim.step(0.1); t += 0.1; }
  return { r: sim.result(), sim };
}
const seeds = (process.argv[2] ?? '1,2,3').split(',').map(Number);
const bots: Record<string, (sim: Simulator) => Bot> = {
  'oracle(noTA)': sim => new OracleBot(sim, { useWatch: true }),
  'oracle+TA': sim => new TaBot(new OracleBot(sim, { useWatch: true })),
  'rookie(ignoreLosses)': sim => new OracleBot(sim, { ignoreLosses: true }),
  'noPause': sim => new OracleBot(sim, { forgetPauses: true }),
  'lateCall1.5s': sim => new OracleBot(sim, { latency: 1.5 }),
  'noRecovery': sim => new OracleBot(sim, { useWatch: true, noRecovery: true }),
};
for (const [name, mk] of Object.entries(bots)) {
  for (const seed of seeds) {
    const sc = generateStage(seed, PROFILES.fullStage);
    const { r } = run(sc, mk);
    const legs = r.score.legs.map(l => l.error === null ? 'MISS' : String(l.error)).join(',');
    console.log(`${name.padEnd(22)} seed ${seed} legs=${r.score.legs.length} raw ${String(r.score.raw).padStart(5)} x.845=${r.score.score.toFixed(1).padStart(6)} aces ${r.score.aces} obsMissed ${r.observationMissed} off ${r.offCourseCount} err[${legs}] bench=${r.score.benchmark} secsLateStart ${r.secondsLateAtStart}`);
  }
}
// Human-ish rungs: Dad sportsman/rookie driver + stock speedometer, oracle navigator that does NOT calibrate
for (const [dn, drv] of [['sportsman', DRIVER_DAD_SPORTSMAN], ['rookie', DRIVER_DAD_ROOKIE]] as const) {
  for (const seed of seeds) {
    const base = generateStage(seed, PROFILES.fullStage);
    const sc: Scenario = { ...base, driver: drv };
    const { r } = run(sc, sim => new TaBot(new OracleBot(sim, { useWatch: true })));
    console.log(`oracle+TA Dad-${dn}(Timewise)   seed ${seed} raw ${String(r.score.raw).padStart(5)} x.845=${r.score.score.toFixed(1)} aces ${r.score.aces} err[${r.score.legs.map(l => l.error ?? 'MISS').join(',')}]`);
    const sc2: Scenario = { ...base, driver: drv, speedo: STOCK_1939_SPEEDO };
    const { r: r2 } = run(sc2, sim => new TaBot(new OracleBot(sim, { useWatch: true })));
    console.log(`oracle+TA Dad-${dn}(stock,uncal) seed ${seed} raw ${String(r2.score.raw).padStart(5)} x.845=${r2.score.score.toFixed(1)} aces ${r2.score.aces} err[${r2.score.legs.map(l => l.error ?? 'MISS').join(',')}]`);
  }
}

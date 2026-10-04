/** Does holding 44 on a 40 assigned gain 6 s in 60 s of driving (HB/10c: 10 % = 1 s per 10 s)? */
import { Simulator, } from '../src/core/sim.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, TRAINING_AIDS } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
const sc = new ScenarioBuilder({ id: 'mk', name: 'mk', startTime: hms(8,0,0), asp: 0, seed: 1, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE, aids: TRAINING_AIDS, prereadSeconds: 60 }).start(40).advanceMiles(6).checkpoint().advanceFt(300).finish().build();
for (const [hold, secs] of [[40, 0], [44, 60], [48, 60]] as const) {
  const sim = new Simulator(sc, { watch: 'digital' });
  while (sim.phase === 'preread' && sim.tod < sc.startTime - 8) sim.step(0.1);
  sim.act({ type: 'start' } as any);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.1) sim.step(0.1); };
  run(100); const p0 = sim.pace();
  if (secs) { sim.act({ type: 'call.speed', mph: hold } as any); run(secs + 8); sim.act({ type: 'call.speed', mph: 40 } as any); run(30); }
  else run(98);
  console.log(`hold ${hold} for ${secs}s: pace before ${p0.toFixed(2)}, after ${sim.pace().toFixed(2)}, gain ${(p0 - sim.pace()).toFixed(2)} s`);
}

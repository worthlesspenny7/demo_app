/** PT-06 area 1/CAL-006: pace cars must be suppressed during the calibration run (API.md: "Suppressed during the calibration run"); observe() still returns paceCars / an ahead[] car there. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot } from '../src/agent/bots.js';
import { instructionS } from '../src/core/course.js';
for (const rung of [0, 1, 3]) {
  const sc = generateStage(4, { ...PROFILES.fullStage, asp: 3, aids: undefined } as never); (sc as any).aids = { ...sc.aids, rung };
  const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  const cal = sc.book.filter(i => i.section === 'calibration'); const lo = instructionS(sc.course, cal[0]!), hi = instructionS(sc.course, cal[cal.length - 1]!);
  let n = 0, withPace = 0, withCar = 0, gaining = 0, early = 0, outside = 0, k = 0;
  while (sim.phase !== 'finished' && sim.car.s < hi + 200) {
    bot.onTick(); sim.step(0.1); if (++k % 10) continue; const o = sim.observe({ peek: true });
    if (sim.car.s >= lo && sim.car.s <= hi) { n++; if (o.paceCars.ahead || o.paceCars.behind) { withPace++; if (withPace <= 3) console.log('  sample in run at s', Math.round(sim.car.s), 'frac', ((sim.car.s - lo) / (hi - lo)).toFixed(3), JSON.stringify(o.paceCars)); } if (o.ahead.some(f => f.kind === 'car')) withCar++; if (o.cues.gainingOnCarAhead) gaining++; if (o.aids.earlyLate !== undefined) early++; } else if (o.paceCars.ahead || o.paceCars.behind) outside++;
  }
  console.log(`rung ${rung}: calibration run samples ${n}: paceCars present ${withPace}, ahead[] car ${withCar}, gaining cue ${gaining}, aids.earlyLate ${early}; outside the run paceCars ${outside}`);
}

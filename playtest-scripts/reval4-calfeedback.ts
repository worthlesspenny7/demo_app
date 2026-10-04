/** CAL-006: during the calibration run no live early/late at any rung; after it, rung 3 gets pace feedback again. Also: driver says nothing about early/late. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { LEGAL_AIDS, TRAINING_AIDS } from '../src/core/course.js';
for (const rung of [3, 2, 1, 0]) {
  const sc = generateStage(1, { ...PROFILES.fullStage, aids: rung >= 2 ? { ...TRAINING_AIDS, rung } : { ...LEGAL_AIDS, rung } } as any);
  const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  const cal = sc.book.filter(b => b.section === 'calibration'); const calEndN = cal[cal.length - 1]!.n;
  let inCal = 0, calWithLive = 0, outCal = 0, outWithLive = 0; const driverEL: string[] = [];
  for (let t = 0; t < 400000 && sim.phase !== 'finished' && sim.currentLine <= calEndN + 30; t++) {
    bot.onTick(sim); sim.step(0.1);
    if (t % 10) continue; const o = sim.observe({ peek: true });
    const inRun = (sim as any).inCalibrationRun() as boolean;
    const live = typeof o.aids.earlyLate === 'number' || typeof o.aids.countdown === 'number';
    if (inRun) { inCal++; if (live) calWithLive++; } else if (sim.car.s > 0 && sim.currentLine > calEndN) { outCal++; if (live) outWithLive++; }
    for (const m of o.driver.messages) if (/early|late|ahead of|behind/i.test(m.text) && !driverEL.includes(m.text)) driverEL.push(m.text);
  }
  console.log(`rung ${rung}: in calibration samples ${inCal}, with live early/late ${calWithLive}; after: ${outCal}, with live ${outWithLive}; driver early/late lines: ${JSON.stringify(driverEL.slice(0, 4))}`);
}

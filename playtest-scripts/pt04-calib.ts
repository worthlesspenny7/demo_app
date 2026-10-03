/** PT-04: does the generated calibration section let a navigator with the STOCK speedo recover? Calibrating oracle computes k from the 50-mph run, sets a constant cheat card. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { STOCK_1939_SPEEDO } from '../src/core/builder.js';
import { cheatCard, calibrationFactor } from '../src/core/calibration.js';
import { DRIVER_DAD_SPORTSMAN, type Scenario } from '../src/core/course.js';

for (const seed of [1, 2, 3, 4]) {
  const base = generateStage(seed, PROFILES.fullStage);
  const sc: Scenario = { ...base, driver: DRIVER_DAD_SPORTSMAN, speedo: STOCK_1939_SPEEDO };
  const calLines = sc.book.filter(i => i.section === 'calibration');
  const calNodes = new Set(calLines.map(i => i.nodeId));
  const sim = new Simulator(sc, { watch: 'analog' }); const bot = new OracleBot(sim, { useWatch: true });
  const seen: { nodeId: string; tod: number }[] = []; let carded = false; let kUsed = 1;
  let t = 0;
  while (sim.phase !== 'finished' && t < 9 * 3600) {
    bot.onTick();
    for (const [k, q] of Object.entries(sim.taQualifying)) { const leg = Number(k); if (q > 0 && (sim.taDeclared[leg] ?? 0) !== Math.round(q)) sim.act({ type: 'ta.declare', seconds: Math.round(q), legIndex: leg }); }
    sim.step(0.1); t += 0.1;
    if (!carded) {
      for (const e of sim.events) if (e.type === 'node' && calNodes.has(String(e.detail?.nodeId)) && !seen.find(s => s.nodeId === e.detail?.nodeId)) seen.push({ nodeId: String(e.detail!.nodeId), tod: e.tod });
      const lastCal = calLines[calLines.length - 1]!;
      if (seen.find(s => s.nodeId === lastCal.nodeId)) {
        const ivs: { perfect: number; actual: number }[] = [];
        for (let i = 2; i < calLines.length - 1; i++) { const a = seen.find(s => s.nodeId === calLines[i - 1]!.nodeId), b = seen.find(s => s.nodeId === calLines[i]!.nodeId); if (a && b) ivs.push({ perfect: calLines[i]!.perfectInterval!, actual: b.tod - a.tod }); }
        kUsed = calibrationFactor(ivs); sim.act({ type: 'card.set', card: cheatCard(kUsed) }); carded = true;
      }
    }
  }
  const r = sim.result();
  console.log(`seed ${seed}: k=${kUsed.toFixed(4)} (speedo reads ${((1 / kUsed - 1) * 100).toFixed(1)}% high at 50) raw ${r.score.raw} x.845 ${r.score.score.toFixed(1)} err[${r.score.legs.map(l => l.error ?? 'MISS').join(',')}]`);
}

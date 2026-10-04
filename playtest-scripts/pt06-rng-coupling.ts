/** PT-06 area 9: hidden hazards should belong to the scenario, not to the navigator's action history. Cross-traffic holds at STOP signs are drawn from the shared driver RNG, so they move with the number of call.speed ramps. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot, type BotName } from '../src/agent/bots.js';
for (const seed of [2, 5, 7, 11]) {
  const sc = { ...builtinScenario('varied', seed), trafficWaitProbability: 0.6 }; const rows: string[] = [];
  for (const bot of ['oracle', 'rookie', 'noPause'] as BotName[]) {
    const sim = new Simulator(sc, { watch: 'digital' }); const b = makeBot(bot, sim, 1)!; const tr: string[] = []; let was = false; let t = 0;
    while (sim.phase !== 'finished' && t < 7200) { b.onTick(sim); sim.step(0.1); t += 0.1; const w = sim.waitingForGo && sim.waitReason === 'stop'; if (w && !was) { const left = (sim as any).trafficClearTod - sim.tod; tr.push(left > 0 ? `${left.toFixed(1)}s@${Math.round(sim.car.s)}` : `0@${Math.round(sim.car.s)}`); } was = w; }
    rows.push(`${bot}: ${tr.join(' ') || '-'}`);
  }
  console.log(`seed ${seed}: ` + rows.join(' || '));
}

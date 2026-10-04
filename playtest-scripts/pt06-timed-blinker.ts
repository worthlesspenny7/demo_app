/** PT-06 area 7: unprinted YIELD / BLINKER nodes inside a timed interval (generator validates only printed lines): the car loses seconds inside the stopwatch interval. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot } from '../src/agent/bots.js';
import { instructionS } from '../src/core/course.js';
for (const [seed, line] of [[19, 134], [14, 104], [20, 162]] as const) {
  const sc = generateStage(seed, PROFILES.fullStage); const ins = sc.book.find(i => i.n === line)!; const s0 = instructionS(sc.course, ins); const reach = s0 + ins.timed!.holdSpeed * 1.4666667 * ins.timed!.seconds;
  const node = sc.course.nodes.find(n => n.s > s0 + 5 && n.s <= reach && (n.control === 'YIELD' || n.control === 'BLINKER'))!;
  const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  let pBefore: number | null = null, pAfter: number | null = null;
  while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); if (pBefore === null && sim.car.s >= s0 + 5) pBefore = sim.pace(); if (pAfter === null && sim.car.s >= Math.min(reach, node.s + 400)) { pAfter = sim.pace(); break; } }
  console.log(`seed ${seed} timed line ${line} (${ins.timed!.holdSpeed} mph x ${ins.timed!.seconds} s): ${node.control} node ${Math.round(node.s - s0)} ft into the interval, not printed; pace at the timed line ${pBefore?.toFixed(1)} s, 400 ft after the node ${pAfter?.toFixed(1)} s (change ${(pAfter! - pBefore!).toFixed(1)} s)`);
}

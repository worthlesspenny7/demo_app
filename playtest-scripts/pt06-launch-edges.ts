/** PT-06 area 1: launch finding thresholds (late > 2 s, early > 3 s), launch = own - netLoss, oneMinute 50-70 s. Starts at launch + d for several d, at an early and a late time of day (float edge). */
import { simpleStart, Simulator, until, log } from './pt06-common.js';
const rows: string[] = [];
for (const d of [-71, -70, -69, -50, -49, -3.2, -3.1, -3.0, -2.9, 0, 1.9, 2.0, 2.1, 2.2, 49, 50, 51, 65, 70, 71]) {
  const sc = simpleStart(0, 0, 3, 200); const sim = new Simulator(sc); const li = sim.launchInfo()!;
  until(sim, () => sim.tod >= li.launchTime + d - 1e-9, 400); sim.act({ type: 'start' });
  const f = sim.result().findings; const sd = sim.result().startDeltas[0]!;
  rows.push(`d ${d}: actual-launch ${(sd.actual! - li.launchTime).toFixed(2)} delta ${sd.delta} findings ${f.map(x => x.kind).join(',') || '-'}`);
}
log(rows.join('\n'));

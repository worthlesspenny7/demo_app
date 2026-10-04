/** PT-09: 'Too late, I can't make that turn' (turnMissed) by drill tier: how often does the OracleBot miss a 90-degree turn, and at what approach speed vs the assigned speed? */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const rows: string[] = [];
for (const [id, seeds] of [['D12', 10], ['D06', 10], ['D10', 10], ['D13', 10]] as [string, number][]) for (const tier of [0, 1, 2]) {
  let miss = 0, runs = 0; const detail: string[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const sc = drillById(id)!.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); runs++;
    for (const e of r.events.filter(x => x.type === 'turnMissed')) { miss++; const ins = sc.book.find(b => b.nodeId === e.detail?.nodeId); const idx = sc.book.indexOf(ins!); let vin = 0; for (let j = idx - 1; j >= 0; j--) { const b = sc.book[j]!; const v = b.timed ? b.timed.thenSpeed : b.speed; if (v !== undefined) { vin = v; break; } } detail.push(`s${seed}: ${vin}->${ins?.speed ?? '?'} mph, node ${e.detail?.speedMph} mph, angle ${e.detail?.angle}`); }
  }
  rows.push(`${id} ${['Bronze', 'Silver', 'Gold'][tier]}: ${miss} turnMissed in ${runs} oracle runs ${detail.join(' | ')}`);
}
console.log(rows.join('\n'));

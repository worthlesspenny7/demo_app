/** V4: Dad protocol lines in a driven stage: ICE, mark, holding NN, rock-back count, keep counting. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
const sc = generateStage(2, { ...PROFILES.fullStage, asp: 20 } as any);
const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
const seen = new Map<string, number>(); let n = 0; const first: string[] = [];
let id = 0;
for (let t = 0; t < 700000 && sim.phase !== 'finished' && sim.tod < sc.startTime + 3 * 3600; t++) {
  bot.onTick(sim); sim.step(0.1);
  const msgs = sim.observe({ peek: true }).driver.messages;
  for (const m of msgs) if (m.id > id) { id = m.id; const key = m.text.replace(/\d+/g, 'N'); seen.set(key, (seen.get(key) ?? 0) + 1); if (first.length < 90) first.push(`${(m.tod - sc.startTime).toFixed(0)}s [${m.kind}] ${m.text}`); }
}
console.log('distinct driver lines (digits -> N):'); for (const [k, v] of [...seen].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
console.log('\nfirst messages:\n' + first.slice(0, 60).join('\n'));

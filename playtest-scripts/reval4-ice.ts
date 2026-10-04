import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
const sc = generateStage(2, { ...PROFILES.fullStage, asp: 20 } as any);
const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
let id = 0; const lines: string[] = []; let identified = false; let counted = 0;
for (let t = 0; t < 300000 && sim.phase !== 'finished' && lines.length < 40; t++) {
  bot.onTick(sim); sim.step(0.1);
  const o = sim.observe({ peek: true });
  if (!identified && sim.phase === 'running' && sim.car.v > 5 && o.ahead.some(f => f.sign && f.approxDistanceFt < 900 && f.approxDistanceFt > 400)) { sim.act({ type: 'call.identify', text: 'Next: sign JCT' } as any); identified = true; lines.push(`${(sim.tod - sc.startTime).toFixed(0)} NAV: call.identify`); }
  if (!counted && o.stoppedAtLine && o.driver.waitingForGo) { counted = 1; lines.push(`${(sim.tod - sc.startTime).toFixed(0)} NAV: X (count starts at rock-back)`); }
  for (const m of o.driver.messages) if (m.id > id) { id = m.id; if (/see it|Mark|Keep counting|Stopped|keep|holding/i.test(m.text)) lines.push(`${(m.tod - sc.startTime).toFixed(0)} DAD: ${m.text}`); }
}
console.log(lines.join('\n'));

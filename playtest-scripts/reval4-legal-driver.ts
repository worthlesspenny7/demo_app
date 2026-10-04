import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { LEGAL_AIDS } from '../src/core/course.js';
const sc = generateStage(2, { ...PROFILES.fullStage, asp: 20, aids: { ...LEGAL_AIDS, rung: 0 } } as any);
const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
let id = 0; const seen = new Set<string>(); const out: string[] = [];
for (let t = 0; t < 700000 && sim.phase !== 'finished' && sim.tod < sc.startTime + 4 * 3600; t++) { bot.onTick(sim); sim.step(0.1);
  for (const m of sim.observe({ peek: true }).driver.messages) if (m.id > id) { id = m.id; const k = m.text.replace(/\d+/g, 'N'); if (!seen.has(k) && /Restart|exact|Lunch|time|launch|seconds|warm/i.test(m.text)) { seen.add(k); out.push(`${m.kind}: ${m.text}`); } } }
console.log('rung', sc.aids.rung, 'book style', sc.bookStyle); console.log(out.join('\n'));
const o = sim.observe({ peek: true }); console.log('perfcard-launch at rung0 (obs.launch):', JSON.stringify(sim.launchInfo()));

/** PT-09: why does the oracle go off course? Usage: npx tsx playtest-scripts/pt09-offcourse.ts D06 2 7 [bot] */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const [id, tier, seed, bot] = [process.argv[2]!, Number(process.argv[3]), Number(process.argv[4]), process.argv[5] ?? 'oracle'];
const sc = drillById(id)!.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' });
const r = runBot(sim, new OracleBot(sim, bot === 'oracle' ? { useWatch: true } : bot === 'noCalibration' ? { useWatch: true, noCalibration: true } : { useWatch: true }));
console.log('oc', r.offCourseCount, 'dnf', r.dnf, r.finishReason ?? '');
const i = r.events.findIndex(e => e.type === 'offCourse');
for (const e of r.events.slice(Math.max(0, i - 14), i + 4)) console.log(e.tod.toFixed(1), e.type, JSON.stringify(e.detail).slice(0, 220));
const bad = r.events.find(e => e.type === 'offCourse'); const nodeId = bad?.detail?.nodeId; const ins = sc.book.find(b => b.nodeId === nodeId);
console.log('node', nodeId, 'book line', ins?.n, ins?.text, ins?.turn, 'speed', ins?.speed);

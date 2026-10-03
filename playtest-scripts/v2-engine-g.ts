import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot } from '../src/agent/bots.js';
const sc = generateStage(1, PROFILES.fullStage); const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 1)!;
let t = 0; while (sim.phase !== 'finished' && !sim.taState().windowOpen && t < 80000) { bot.onTick(sim); sim.step(0.1); t += 0.1; }
const st = sim.taState(); console.log('open at', sim.tod, 'ends', st.windowEndsTod, 'endOfStage', st.endOfStage, 'eligible', st.eligibleLegs.join(','));
let n = 0; while (sim.tod < (st.windowEndsTod ?? 0) + 5 && n < 200000) { bot.onTick(sim); sim.step(0.1); n++; }
console.log('now', sim.tod, 'phase', sim.phase, 'windowOpen', sim.taState().windowOpen);
sim.act({ type: 'ta.request', legIndex: 2, seconds: 20, fromLine: 30, toLine: 31 } as any); console.log('late request:', JSON.stringify(sim.taRequests.at(-1)));

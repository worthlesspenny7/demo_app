/** PT-09: at an exact-transit OUT hold and at the lunch hold, does advance {untilEvent} wake at the departure time? (it does at a time-of-day restart) */
import '../src/core/drills/index.js';
import { Session } from '../src/agent/protocol.js';
import { drillById } from '../src/core/drills/registry.js';
import { OracleBot } from '../src/agent/bots.js';
const sc = drillById('D16')!.scenario(2, 1); const s = new Session(sc, { watch: 'digital' }); const sim = s.sim; const bot = new OracleBot(sim, { useWatch: true });
let t = 0; let prev = false; let n = 0;
while (sim.phase !== 'finished' && t < 6 * 3600) {
  bot.onTick(sim); sim.step(0.1); t += 0.1;
  const w = sim.waitingForGo && sim.waitReason === 'hold';
  if (w && !prev) {
    n++; const nd = sc.course.nodes.filter(x => x.s <= sim.car.s + 5).pop()!; const goTod = sim.holdGoTod(nd)!; const tod0 = sim.tod; const rows: string[] = [];
    // silence the bot: the navigator is the agent now; ask only for untilEvent advances until we are past the departure time
    let guard = 0; while (sim.tod < goTod + 120 && guard++ < 12 && sim.phase !== 'finished') { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 3000 }) as any; rows.push(`${r.seconds}s->${r.stoppedOn} (departure ${(goTod - sim.tod).toFixed(0)} s ahead)`); if (r.stoppedOn === 'launch') break; }
    console.log(`hold ${n} (${(goTod - tod0).toFixed(0)} s to go): ${rows.join(' | ')}; past the departure time by ${(sim.tod - goTod).toFixed(0)} s, still waiting ${sim.waitingForGo}`);
    sim.act({ type: 'call.go' }); if (n >= 3) break;
  }
  prev = w;
}

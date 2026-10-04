/** PT-09: untilEvent while the car waits at a restart / exact-transit OUT / lunch hold: is the launch a stop reason? */
import '../src/core/drills/index.js';
import { Session } from '../src/agent/protocol.js';
import { drillById } from '../src/core/drills/registry.js';
import { OracleBot } from '../src/agent/bots.js';
for (const seed of [2]) {
  const sc = drillById('D16')!.scenario(seed, 1); const s = new Session(sc, { watch: 'digital' }); const sim = s.sim; const bot = new OracleBot(sim, { useWatch: true });
  let t = 0; let prev = false; const rows: string[] = [];
  while (sim.phase !== 'finished' && t < 6 * 3600) {
    bot.onTick(sim); sim.step(0.1); t += 0.1;
    const w = sim.waitingForGo && sim.waitReason === 'hold';
    if (w && !prev) {
      const li = sim.launchInfo(); const nd = sc.course.nodes.filter(n => n.s <= sim.car.s + 5).pop()!; const go = sim.holdGoTod(nd);
      // what would an untilEvent advance do from here? run it on a clone-free basis by asking the protocol with the bot silenced for a moment
      rows.push(`hold at s=${sim.car.s.toFixed(0)} node ${nd.id}: launchInfo ${li ? `${li.kind} toLaunch ${li.secondsToLaunch.toFixed(0)}` : 'null'}; holdGoTod ${go === null ? 'n/a' : (go - sim.tod).toFixed(0) + ' s ahead'}`);
    }
    prev = w;
  }
  console.log(rows.join('\n'));
}

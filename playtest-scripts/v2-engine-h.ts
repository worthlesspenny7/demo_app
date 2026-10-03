import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot } from '../src/agent/bots.js';
for (const [off, which] of [[0, 'all'], [-400, 'first'], [-400, 'all'], [-700, 'all']] as const) {
  const sc = generateStage(1, PROFILES.fullStage); const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 1)!;
  let t = 0; let cnt = 0; const done = new Set<string>();
  while (sim.phase !== 'finished' && t < 80000) {
    if (off !== 0 && sim.waitingForGo) { const node = sc.course.nodes.find(n => n.id === (sim as any).waitNodeId); const ins = node && sc.book.find(i => i.nodeId === node.id); if (ins?.promotedStop && (which === 'all' || cnt === 0)) { const g = sim.holdGoTod(node!)!; if (sim.tod >= g + off) { sim.act({ type: 'call.go' }); done.add(ins.nodeId); } } }
    bot.onTick(sim); sim.step(0.1); t += 0.1; }
  const r = sim.result();
  console.log(`off ${off} ${which}: earlyDepartureMinutes ${JSON.stringify(r.earlyDepartureMinutes)} penalty ${r.score.earlyDeparturePenalty} items ${JSON.stringify(r.score.earlyDepartures)} raw ${r.score.raw} promoted rows ${sc.book.filter(i => i.promotedStop).map(i => i.n + ':' + i.promotedStop!.kind).join(',')}`);
}

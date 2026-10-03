import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot, runBot } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
import { championshipTotal, DIVISION_DISCARDS, compareStandings } from '../src/core/scoring.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { accelLoss } from '../src/core/perf-table.js';
import { formatClock } from '../src/core/units.js';
await registerAll();
const hdr = (s: string) => console.log('\n=== ' + s);
hdr('F1 TA cap 1770 inside a window + wrong leg + after window');
{
  const d = drillById('D08b')!; const sc = d.scenario(3, 0); const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 3)!;
  let t = 0; while (sim.phase !== 'finished' && !sim.taState().windowOpen && t < 20000) { bot.onTick(sim); sim.step(0.1); t += 0.1; }
  console.log('window open', sim.taState().windowOpen, 'secondsLeft', sim.taState().secondsLeft, 'eligible', sim.taState().eligibleLegs.join(','));
  const last = () => JSON.stringify(sim.taRequests.at(-1));
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 1780, fromLine: 4, toLine: 5 } as any); console.log('1780:', last());
  sim.act({ type: 'ta.request', legIndex: 7, seconds: 20, fromLine: 4, toLine: 5 } as any); console.log('wrong leg 7:', last());
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 20, fromLine: 5, toLine: 4 } as any); console.log('reversed lines:', last());
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 0, fromLine: 4, toLine: 5 } as any); console.log('zero:', last());
  sim.step(16 * 60);
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 20, fromLine: 4, toLine: 5 } as any); console.log('after 15m window:', last());
  console.log('window state', sim.taState().windowOpen);
}
hdr('F2 promoted-stop early departure 60 s then 300 s (D16 seed 2, shift -400 s / -700 s)');
for (const off of [-400, -700]) {
  const sc = drillById('D16')!.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 2)!;
  const orig = sim.holdGoTod.bind(sim);
  (sim as any).holdGoTod = (node: any) => { const g = orig(node); const ins = sc.book.find(i => i.nodeId === node.id); return g !== null && ins?.promotedStop ? g + off : g; };
  // the sim's own early check uses holdGoTod too: it is the scheduled time -> early = (go-tod)/60; so shifting go earlier makes bot leave early but sim thinks schedule moved. Use real schedule: restore for the check
  let t = 0; (sim as any).holdGoTod = orig;
  const botGo = (node: any) => { const g = orig(node); const ins = sc.book.find(i => i.nodeId === node.id); return g !== null && ins?.promotedStop ? g + off : g; };
  // emulate bot decision: call go when tod >= botGo
  const origAct = sim.act.bind(sim);
  (sim as any).act = (a: any) => { if (a.type === 'call.go' && sim.waitingForGo) { const node = sc.course.nodes.find(n => n.id === (sim as any).waitNodeId)!; const ins = sc.book.find(i => i.nodeId === node.id); if (ins?.promotedStop) { const g = botGo(node)!; if (sim.tod < g) return; } } origAct(a); };
  const r = runBot(sim, bot);
  console.log(`off ${off}: earlyDepartureMinutes ${JSON.stringify(r.earlyDepartureMinutes)} penalty ${r.score.earlyDeparturePenalty} items ${JSON.stringify(r.score.earlyDepartures)} raw ${r.score.raw}`);
}
hdr('F3 championshipTotal discards per division');
{
  const mkStage = (n: number, items: number[]) => ({ stage: n, score: { penaltyItems: items, raw: items.reduce((a, b) => a + b, 0), ageFactor: 0.845, dnf: false } as any });
  const stages = [1, 2, 3, 4, 5, 6, 7].map(n => mkStage(n, [10 * n, 5, 3, 1, 0, 2, 8])).concat([mkStage(8, [7, 7, 7]), mkStage(9, [4, 4])] as any);
  for (const div of Object.keys(DIVISION_DISCARDS) as any[]) { const c = championshipTotal(stages as any, div, { year: 1939 }); console.log(div, 'discards', c.discardCount, 'discarded', c.discarded.join(','), 'raw', c.raw, 'afterDiscards', c.afterDiscards, 'age', c.ageFactor, 'factored', c.ageFactored); }
  console.log('tiebreak older year first:', compareStandings({ name: 'a', total: 10, scoringYear: 1939 }, { name: 'b', total: 10, scoringYear: 1950 }));
}
hdr('F4 free zone after every transit end (2 min, VII.C.5.c): min perfect time from transit end/restart to next CP');
for (const seed of [1, 2, 3, 4, 5]) {
  const sc = generateStage(seed, PROFILES.fullStage); const sim = new Simulator(sc); void sim;
  // legs from ghost
  const ghostMod = await import('../src/core/ghost.js');
  const g = (ghostMod as any).buildGhost ? (ghostMod as any).buildGhost(sc) : null;
  const legs = g?.legs ?? [];
  const ends: number[] = []; // route s of transit-end/restart lines
  const { instructionS } = await import('../src/core/course.js');
  const sEnd = sc.book.filter(i => i.transit?.end || i.restartTime !== undefined).map(i => instructionS(sc.course, i));
  const cps = sc.checkpoints.filter(c => c.kind === 'timing').map(c => c.s);
  const dists = sEnd.map(s => { const next = cps.find(c => c > s); return next === undefined ? null : ((next - s) / 5280).toFixed(2) + ' mi'; });
  const durs = legs.map((l: any) => Math.round(l.perfectDuration));
  console.log(`seed ${seed}: restart/transit-end rows at ${sEnd.map(s => (s / 5280).toFixed(1)).join(',')} mi; distance to next timing CP ${dists.join(', ')}; leg perfect durations(s) ${durs.join(',')}`);
}
hdr('F5 sight-zone penalty 30 s (V.E.3.a): hold <=5 mph within sight of a Timing CP');
for (const slow of [false, true]) {
  const T0 = 8 * 3600;
  const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(2).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).observationFinish().build();
  const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' });
  const cp1 = sc.checkpoints[0]!; let t = 0;
  while (sim.phase !== 'finished' && t < 20000) { if (slow && sim.car.s > cp1.s - 380 && sim.car.s < cp1.s - 200) sim.act({ type: 'call.speed', mph: 4 }); else if (slow && sim.car.s >= cp1.s - 200) sim.act({ type: 'call.speed', mph: 30 }); sim.step(0.1); t += 0.1; }
  const r = sim.result(); console.log(slow ? 'slow to 4 mph within sight:' : 'steady:', r.score.legs.map(l => `err ${l.error} pen ${l.penalty} sight ${l.extras.sightZone}`).join(' | '));
}
hdr('F6 stopwatch lap/split via sim (digital) : start, lap x3, observe, recall, reset guard');
{
  const sc = drillById('D07')!.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' });
  sim.act({ type: 'skipPreread', secondsBefore: 3 } as any); sim.act({ type: 'start' }); sim.act({ type: 'watch.start' } as any);
  for (const dt of [11.37, 8.04, 12.5]) { sim.step(dt); sim.act({ type: 'watch.lap' } as any); const sw = sim.observe().stopwatch as any; console.log('after lap', JSON.stringify({ mode: sw.mode, frozen: sw.frozen, table: sw.lapTable, reading: sw.reading })); }
  sim.step(6); const sw2 = sim.observe().stopwatch as any; console.log('6 s later frozen?', sw2.frozen, 'reading', sw2.reading);
  sim.act({ type: 'watch.reset' } as any); console.log('reset while running -> laps', (sim.observe().stopwatch as any).lapTable.length);
  sim.act({ type: 'watch.mode', mode: 'tod' } as any); const sw3 = sim.observe().stopwatch as any; console.log('TOD mode reading', sw3.reading, 'sim.tod', sim.tod);
}

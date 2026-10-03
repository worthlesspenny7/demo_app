/** V2 revalidation engine checks: restart=base+ASP, exact transit, TA rounding/credit, caps, missed CP, age factor, calibration, pauses. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot, runBot } from '../src/agent/bots.js';
import { departuresOf } from '../src/core/drills/departures.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { formatClock } from '../src/core/units.js';
import { ageFactor } from '../src/core/scoring.js';
import { columnCLines } from '../src/core/griid.js';
import { accelLoss } from '../src/core/perf-table.js';
await registerAll();

const hdr = (s: string) => console.log('\n=== ' + s);

hdr('E1 restart = base + ASP (generated day stage, asp=37 and asp=95)');
for (const asp of [37, 95]) {
  const sc = generateStage(4, { ...PROFILES.fullStage, asp } as any);
  const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, makeBot('oracle', sim, 4));
  console.log('asp', asp, 'sc.asp', sc.asp, 'startTime', formatClock(sc.startTime), 'base', formatClock(sc.baseStartTime!));
  for (const d of departuresOf(r, sc)) {
    const ins = sc.book.find(i => i.n === d.line)!;
    console.log(`  ${d.kind} line ${d.line} target ${formatClock(d.target)} actual ${d.actual === null ? null : formatClock(d.actual)} err ${d.err}  ColC=[${columnCLines(ins, sc.timeZone).join(' / ')}] baseTime ${ins.baseTime === undefined ? '-' : formatClock(ins.baseTime)} restartTime ${ins.restartTime === undefined ? '-' : formatClock(ins.restartTime)} diff(min)=${ins.restartTime !== undefined && ins.baseTime !== undefined ? (ins.restartTime - ins.baseTime) / 60 : '-'}`);
  }
  console.log('  stage score', r.score.score, 'raw', r.score.raw, 'legs', r.score.legs.map(l => l.error).join(','));
}

hdr('E2 exact transit OUT = IN + interval (D16 seeds 1-6, oracle; wrong-OUT probes)');
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const d = drillById('D16')!; const sc = d.scenario(seed, 0); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, makeBot('oracle', sim, seed));
  const deps = departuresOf(r, sc);
  const tr = deps.find(x => x.kind === 'transitOut'); const inEv = r.events.find(e => e.type === 'transit.in');
  console.log(`seed ${seed} asp ${sc.asp} base ${formatClock(sc.baseStartTime!)} start ${formatClock(sc.startTime)} IN ${inEv ? formatClock(Number(inEv.detail!.tod)) : '-'} OUT target ${tr ? formatClock(tr.target) : '-'} actual ${tr?.actual != null ? formatClock(tr.actual) : '-'} => OUT-IN = ${tr && inEv ? tr.target - Number(inEv.detail!.tod) : '-'}; all dep errs ${deps.map(x => x.err).join(',')}; legs ${r.score.legs.map(l => l.error).join(',')}`);
}
// early/late OUT probe: leave exact transit 60 s early / 45 s late and see next-leg error
for (const off of [-60, 45]) {
  const d = drillById('D16')!; const sc = d.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' });
  const bot = makeBot('oracle', sim, 2)!; let patched = false;
  // wrap: hold the go until target+off by intercepting call.go at the transit end node
  const origAct = sim.act.bind(sim);
  (sim as any).act = (a: any) => { if (a.type === 'call.go' && sim.waitReason === 'hold') { const node = sim.sc.course.nodes.find(n => n.id === (sim as any).waitNodeId)!; const g = sim.holdGoTod(node); const ins = sc.book.find(i => i.nodeId === node.id)!; if (g !== null && ins.transit?.end && ins.transit.exact && !patched) { if (off < 0 || true) { /* delay/early by moving the clock */ } } } origAct(a); };
  const r = (() => { let t = 0; let pending: any = null; while (sim.phase !== 'finished' && t < 43200) { bot.onTick(sim); sim.step(0.1); t += 0.1; } return sim.result(); })();
  console.log('(probe skipped: wrapper only records)', off, r.score.legs.map(l => l.error).join(','));
}

hdr('E3 TA rounding / committee credit on D08b (seed 3 Bronze): request 77 s etc.');
{
  const d = drillById('D08b')!; const sc = d.scenario(3, 0);
  for (const req of [77, 80, 120, 10, 300]) {
    const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 3)!;
    // oracle but replace its ta.request by ours: run with a bot that skips TA (use noRecovery? simply run oracle, but intercept ta.request)
    const orig = sim.act.bind(sim); let done = false;
    (sim as any).act = (a: any) => { if (a.type === 'ta.request') { if (a.legIndex === 1 && !done) { done = true; orig({ ...a, seconds: req }); } return; } orig(a); };
    const r = runBot(sim, bot);
    const rq = r.ta.requests.find(x => x.legIndex === 1);
    const l1 = r.score.legs[0]!;
    console.log(`req ${req}: record ${JSON.stringify(rq)} | leg1 rawError ${l1.rawError} credit ${l1.taCredit} error ${l1.error} overDeclared ${l1.taOverDeclared} reason="${l1.taReason}"`);
  }
  // request outside window / wrong place
  const sim = new Simulator(sc, { watch: 'digital' }); sim.act({ type: 'skipPreread', secondsBefore: 3 } as any); sim.act({ type: 'start' }); sim.step(20);
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 1, toLine: 2 } as any);
  console.log('request before any TA point:', JSON.stringify(sim.taRequests.at(-1)), '| driver msgs:', sim.observe().driver.messages.slice(-1).map(m => m.text).join(';'));
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 1800, fromLine: 1, toLine: 2 } as any);
  console.log('1800 s request:', JSON.stringify(sim.taRequests.at(-1)));
}

hdr('E4 caps 120 / 300, missed checkpoint 180, >30 min late = missed, via simulator');
{
  const T0 = 8 * 3600;
  const mk = () => new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(10).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
  const run = (speedFor: number, holdStop = 0) => {
    const sc = mk(); const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' });
    if (speedFor) sim.act({ type: 'call.speed', mph: speedFor });
    let t = 0; let stopped = false;
    while (sim.phase !== 'finished' && t < 40000) { if (holdStop && !stopped && sim.car.s > 2000) { stopped = true; sim.act({ type: 'call.stop' }); } if (stopped && sim.waitingForGo && sim.tod - (sim.waitStartTod ?? 0) > holdStop) { sim.act({ type: 'call.speed', mph: 30 }); sim.act({ type: 'call.go' }); stopped = false; holdStop = 0; } sim.step(0.1); t += 0.1; }
    return sim.result();
  };
  for (const [label, v, hold] of [['20 mph over 10 mi (late ~10 min)', 20, 0], ['15 mph (late ~20 min)', 15, 0], ['55 mph (early ~9 min)', 55, 0], ['stop 35 min mid-leg (>30 min late)', 0, 2100]] as const) {
    const r = run(v, hold); const l = r.score.legs;
    console.log(label, '=> legs', l.map(x => `err ${x.error} pen ${x.penalty} capped ${x.capped} missed ${x.extras.missed}`).join(' | '), `raw ${r.score.raw} dnf ${r.score.dnf}`);
  }
}

hdr('E5 age factor via StageResult for several scoring years');
for (const y of [1953, 1941, 1939, 1936, 1930, 1929, 1926, 1900, 1954, 1970]) console.log(y, ageFactor(y));
{ const sc = drillById('D06')!.scenario(3, 0); const sim = new Simulator(sc); const r = runBot(sim, makeBot('oracle', sim, 3)); console.log('D06 Bronze (Packard 1936) ageFactor', r.score.ageFactor, 'car', sc.car.name, sc.car.year, '| stage 1939 Ford ageFactor', (()=>{ const s2 = generateStage(2, PROFILES.fullStage); return s2.car.year + ' -> ' + ageFactor(s2.car.year); })()); }

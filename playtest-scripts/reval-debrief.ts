/** RE-VALIDATION: debrief rows (eager arming, D16 restart, D04 compound line, late turn calls P10). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { nodeById } from '../src/core/course.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';

// 1. D10 eager arming
{ const d = drillById('D10')!; const sc = d.scenario(1, 0); const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true }); const called = new Set<number>();
  const bot: Bot = { name: 'eager', onTick(ss) { if (ss.phase === 'running') for (const ins of sc.book) { if (!ins.turn || ins.turn === 'S' || called.has(ins.n)) continue; const ds = nodeById(sc.course, ins.nodeId).s - ss.car.s; if (ds < 900 && ds > 0) { called.add(ins.n); ss.act({ type: 'call.turn', dir: ins.turn }); } } inner.onTick(ss); } };
  const r = runBot(sim, bot); const rb = d.rubric(r, sc); const vm = debriefViewModel(r, sc, {});
  console.log('D10 eager: stars', rb.stars, '| rubric:', rb.feedback.join(' || ')); console.log('   VM tips:', vm.tips.join(' || ')); console.log('   VM headline:', vm.headline);
  console.log('   driver msgs:', r.events.filter(e => e.type === 'driver').map(e => String(e.detail?.text ?? e.detail?.message ?? JSON.stringify(e.detail))).slice(0, 5).join(' / '));
  console.log('   VM keys:', Object.keys(vm).join(','), ' offCourse rows:', JSON.stringify((vm as any).offCourse ?? (vm as any).turns?.filter((x: any) => /off|wrong/i.test(JSON.stringify(x))) ?? null).slice(0, 300)); }
// 2. D16 restart rows + stops
for (const bn of ['oracle', 'rookie']) { const d = drillById('D16')!; const sc = d.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, bn === 'oracle' ? { useWatch: true } : { ignoreLosses: true })); const vm = debriefViewModel(r, sc, {});
  console.log(`D16 ${bn} legs`, r.score.legs.map(l => l.error).join(','), '| stops rows', vm.stops.length, '| restarts', JSON.stringify(vm.restarts).slice(0, 400), '| tip:', vm.tip.slice(0, 120)); }
// 3. D07/D17 restart worked arithmetic
{ const d = drillById('D07')!; const sc = d.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); const vm = debriefViewModel(r, sc, {}); console.log('D07 oracle stops:', vm.stops.map(s => `${s.text ?? ''} ideal ${s.correctDwell?.toFixed(1)} yours ${s.yourDwell.toFixed(1)}`).join(' | ').slice(0, 400), '| restarts', JSON.stringify(vm.restarts).slice(0, 300)); }
// 4. D04 compound-line timed rows, correct play, seeds 1-6
for (const s of [1, 2, 3, 4, 5, 6]) { const d = drillById('D04')!; const sc = d.scenario(s, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); const vm = debriefViewModel(r, sc, {});
  console.log(`D04 s${s} oracle legs ${r.score.legs.map(l => l.error)} timed rows:`, vm.timed.map(x => x.text).join(' || ').slice(0, 600)); }
// 5. P10 late turn call: call 60 ft / 20 ft before the node
for (const [id, ft] of [['D10', 60], ['D10', 20], ['D11', 60], ['D11', 20], ['D10', 300]] as [string, number][]) {
  const stars: number[] = []; const msg: string[] = []; const oc: number[] = []; const turnMissed: number[] = [];
  for (const s of [1, 2, 3, 4]) { const d = drillById(id)!; const sc = d.scenario(s, 0); const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true }); const called = new Set<number>();
    const bot: Bot = { name: 'late', onTick(ss) { if (ss.phase === 'running') for (const ins of sc.book) { if (!ins.turn || ins.turn === 'S' || called.has(ins.n)) continue; const ds = nodeById(sc.course, ins.nodeId).s - ss.car.s; if (ds < ft && ds > 0) { called.add(ins.n); ss.act({ type: 'call.turn', dir: ins.turn }); } } inner.onTick(ss); } };
    // oracle calls too: suppress its own turn calls by wrapping act is complex; instead use latency bot semantic: just let the oracle call first (documented) -> use custom copy below
    const sim2 = new Simulator(sc); const inner2 = new OracleBot(sim2, { useWatch: true }); const origAct = sim2.act.bind(sim2); (sim2 as any).act = (a: any) => { if (a.type === 'call.turn') return null; return origAct(a); };
    const called2 = new Set<number>(); const bot2: Bot = { name: 'late', onTick(ss) { if (ss.phase === 'running') for (const ins of sc.book) { if (!ins.turn || ins.turn === 'S' || called2.has(ins.n)) continue; const ds = nodeById(sc.course, ins.nodeId).s - ss.car.s; if (ds < ft && ds > 0) { called2.add(ins.n); origAct({ type: 'call.turn', dir: ins.turn } as any); } } inner2.onTick(ss); } };
    void bot; const r = runBot(sim2, bot2); const rb = d.rubric(r, sc); stars.push(rb.stars); oc.push(r.offCourseCount); turnMissed.push(r.events.filter(e => e.type === 'turnMissed' || (e.type === 'driver' && /too late/i.test(JSON.stringify(e.detail)))).length); msg.push(r.score.legs.map(l => l.error === null ? 'M' : Math.round(l.error)).join('/')); }
  console.log(`P10 ${id} turn called ${ft} ft out: stars ${stars.join('')} offCourse ${oc.join(',')} 'too late' events ${turnMissed.join(',')} legs ${msg.join(' ')}`);
}

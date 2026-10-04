/** V4: lost doctrine through the engine: take a wrong turn in D10, turn around, start the watch, note doubled time; read the procedure + rubric. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { lostProcedure, LOST_GUIDANCE } from '../src/core/drills/lost.js';
for (const mode of ['doctrine', 'noWatchNoNote']) {
  const sc = drillById('D10')!.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' });
  const flip: Record<string, string> = { L: 'R', R: 'L' }; let flipped = false; const act0 = sim.act.bind(sim);
  (sim as { act: (a: Action) => void }).act = (a: Action) => { if (!flipped && a.type === 'call.turn' && flip[a.dir]) { flipped = true; return act0({ ...a, dir: flip[a.dir] } as Action); } return act0(a); };
  let uturned = false; let offSince: number | null = null; let noted = false; let tu = 0;
  const o = new OracleBot(sim, { useWatch: true });
  const r = runBot(sim, { name: 'lost', onTick(s) {
    const ob = s.observe({ peek: true });
    if (!uturned && ob.driver.state === 'offcourse') { offSince ??= ob.tod; if (ob.tod - offSince >= 20) { uturned = true; tu = ob.tod; if (mode === 'doctrine') s.act({ type: 'watch.reset', force: true } as any), s.act({ type: 'watch.start' } as any); s.act({ type: 'call.uturn' } as any); } }
    if (uturned && !noted && mode === 'doctrine' && s.observe({ peek: true }).driver.state !== 'offcourse') { noted = true; const el = (s.observe({ peek: true }).tod - tu); s.act({ type: 'note', text: `lost ${(el * 2).toFixed(0)}` } as any); }
    o.onTick(s); } } as any, 3 * 3600);
  const lp = lostProcedure(r); const rb = drillById('D10')!.rubric(r, sc);
  console.log(mode, 'offCourse', r.offCourseCount, 'procedure', JSON.stringify(lp), 'stars', rb.stars, rb.headline, JSON.stringify(rb.feedback).slice(0, 500));
  const leg = r.score.legs.find(l => Math.abs(l.error) > 20); console.log('  leg errors', r.score.legs.map(l => Math.round(l.error)).join(','), 'tip', rb.tip?.slice(0, 300));
}
console.log(LOST_GUIDANCE);

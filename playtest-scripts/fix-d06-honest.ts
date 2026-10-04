/** Fix sprint PT-08/PT-09: an honest D06 measurer (rookie bot: no lead, no recovery, full pause) notes what the run measured; prints stars per tier and the misses. Usage: npx tsx playtest-scripts/fix-d06-honest.ts [seeds] */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { chartPairs, runMeasurement } from '../src/core/drills/d06.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const d = drillById('D06')!; const N = Number(process.argv[2] ?? 10);
for (const tier of [0, 1, 2]) { const stars: number[] = [];
  for (let seed = 1; seed <= N; seed++) {
    const sc = d.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
    const name = (k: string) => k === 'stopGo' ? 'stopgo' : k === 'stopMid' ? 'stopmid' : k;
    const notes = chartPairs(sc.tags).map(p => { const m = runMeasurement(r, sc, p); return m === null ? null : `${name(p.kind)} ${p.vIn}>${p.vOut} = ${m.toFixed(1)}`; }).filter((x): x is string => !!x);
    const sim2 = new Simulator(sc, { watch: 'digital' }); let done = false; const o2 = new OracleBot(sim2, { ignoreLosses: true });
    const r2 = runBot(sim2, { name: 'm', onTick(s) { if (!done) { done = true; for (const t of notes) s.act({ type: 'note', text: t } as Action); } o2.onTick(s); } });
    const rb = d.rubric(r2, sc); stars.push(rb.stars);
    if (rb.stars < 3) console.log(sc.id, rb.headline, '\n ', rb.feedback.filter(l => /off by|not noted|outlier/.test(l)).join('\n  '), '\n  notes:', notes.join(' | '), r2.offCourseCount ? `offCourse ${r2.offCourseCount}` : '');
  }
  console.log(['Bronze', 'Silver', 'Gold'][tier], stars.join(''));
}

/** Fix sprint PT-08 N-B12: a D10 run that takes one wrong turn; the attribution buckets must sum to the leg error (no off-course double count). Usage: npx tsx playtest-scripts/fix-d10-offcourse.ts [seed] */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const seed = Number(process.argv[2] ?? 1);
const sc = drillById('D10')!.scenario(seed, 0); const sim = new Simulator(sc, { watch: 'digital' });
const flip: Record<string, string> = { L: 'R', R: 'L' }; let flipped = false; const act0 = sim.act.bind(sim);
(sim as { act: (a: Action) => void }).act = (a: Action) => { if (!flipped && a.type === 'call.turn' && flip[a.dir]) { flipped = true; return act0({ ...a, dir: flip[a.dir] } as Action); } return act0(a); };
let uturned = false; let offSince: number | null = null;
const o = new OracleBot(sim, { useWatch: true });
const r = runBot(sim, { name: 'flip', onTick(s) { const ob = s.observe({ peek: true }); if (!uturned && ob.driver.state === 'offcourse') { offSince ??= ob.tod; if (ob.tod - offSince >= 20) { uturned = true; s.act({ type: 'call.uturn' }); } } o.onTick(s); } });
console.log('offCourse', r.offCourseCount);
for (const a of r.attribution) { const sum = Object.values(a.buckets).reduce((x, y) => x + y, 0); const leg = r.score.legs[a.legIndex - 1] as unknown as Record<string, unknown>; console.log(`leg ${a.legIndex}: error ${JSON.stringify(leg)} sum ${sum.toFixed(1)}`, JSON.stringify(Object.fromEntries(Object.entries(a.buckets).map(([k, v]) => [k, Math.round(v * 10) / 10])))); }
for (const e of r.events.filter(e => /offCourse|rejoin|uturn|turn$|driver/.test(e.type)).slice(0, 30)) console.log(e.tod.toFixed(1), e.s.toFixed(0), e.type, JSON.stringify(e.detail ?? {}).slice(0, 100));

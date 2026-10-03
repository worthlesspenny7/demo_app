/** EDUCATION validation: trap drills (D10, D18, D11) with an eager turn-caller (arms every turn 900 ft out) vs the oracle (checks decoys). Also audits D10 book text vs route. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { nodeById } from '../src/core/course.js';

for (const id of ['D10', 'D18', 'D11']) {
  for (const t of [0, 2]) {
    const rows: string[] = [];
    for (const mode of ['oracle', 'eager900', 'eager1500']) {
      const stars: number[] = []; const oc: number[] = []; const err: string[] = [];
      for (let s = 1; s <= 8; s++) {
        const d = drillById(id)!; const sc = d.scenario(s, t); const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true });
        const called = new Set<number>(); const reach = mode === 'eager900' ? 900 : 1500;
        const bot: Bot = { name: mode, onTick(ss) { if (mode !== 'oracle' && ss.phase === 'running') { for (const ins of sc.book) { if (!ins.turn || ins.turn === 'S' || called.has(ins.n)) continue; const ds = nodeById(sc.course, ins.nodeId).s - ss.car.s; if (ds > 0 && ds <= reach) { called.add(ins.n); ss.act({ type: 'call.turn', dir: ins.turn }); } } } inner.onTick(ss); } };
        const r = runBot(sim, bot); const rb = d.rubric(r, sc); stars.push(rb.stars); oc.push(r.offCourseCount); err.push(r.score.legs.map(l => l.error === null ? 'M' : l.error).join('/'));
      }
      rows.push(`${id} t${t} ${mode.padEnd(9)} stars=${stars.join('')} offCourse=${oc.join(',')} err=${err.join(' ')}`);
    }
    console.log(rows.join('\n'));
  }
}
// D10 book-text vs route audit (BUG-2 regression)
let mism = 0, tot = 0; const kinds: Record<string, number> = {};
for (let s = 1; s <= 30; s++) { const sc = drillById('D10')!.scenario(s, 0); for (const ins of sc.book) { const n = nodeById(sc.course, ins.nodeId); if (n.exits && ins.turn) { tot++; const route = n.exits.find(e => e.isRoute)!; const nt = Math.abs(route.angle) < 20 ? 'S' : Math.abs(route.angle) < 60 ? (route.angle < 0 ? 'BL' : 'BR') : route.angle < 0 ? 'L' : 'R'; const wordOk = ins.text.toLowerCase().includes({ S: 'straight', BL: 'bear left', BR: 'bear right', L: 'left', R: 'right' }[nt]!); if (!wordOk) { mism++; if (mism < 4) console.log('MISMATCH', s, ins.n, ins.text, nt); } } }
  for (const n of sc.course.nodes) { for (const e of n.exits ?? []) kinds[`${e.kind}/${e.surface ?? 'paved'}${n.control && n.control !== 'none' ? '@' + n.control : ''}`] = (kinds[`${e.kind}/${e.surface ?? 'paved'}${n.control && n.control !== 'none' ? '@' + n.control : ''}`] ?? 0) + 1; } }
console.log(`D10 text/route mismatches: ${mism}/${tot}`); console.log('exit kinds', JSON.stringify(kinds));

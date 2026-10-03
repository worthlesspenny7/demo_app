/** RE-VALIDATION: does the headline tip name the real largest cause? Truth rule: M<=3 -> "clean"; else largest attribution bucket with the sign of the net leg error (ta excluded). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';

const classify = (t: string): string => /^Clean run/.test(t) ? 'clean' : /stops cost more|left stops too early/.test(t) ? 'stop' : /left the start|start too early/.test(t) ? 'start' : /Landmark speed changes/.test(t) ? 'speedChange' : /Timed changes/.test(t) ? 'timedChange' : /Lights, trains/.test(t) ? 'hazard' : /wrong turn cost/.test(t) ? 'offCourse' : /Turns cost/.test(t) ? 'turn' : /Cruise segments|cruise segments/.test(t) ? 'cruise' : /Review the attribution/.test(t) ? 'default' : 'other';
const drills = ['D03', 'D04', 'D05', 'D07', 'D08', 'D08b', 'D10', 'D15', 'D16', 'D17', 'D18', 'D11', 'D12'];
const tot: Record<string, { rub: number; vm: number; n: number }> = {}; const lines: string[] = [];
let grand = { rub: 0, vm: 0, n: 0 }; const fail = { n: 0, vm: 0, rub: 0 }; const pass = { n: 0, vm: 0, clean: 0 }; const wrongList: string[] = [];
for (const id of drills) { const d = drillById(id)!; for (const t of [0, 2]) for (const bn of ['oracle', 'rookie']) for (const s of (id === 'D12' ? [1, 2, 3] : [1, 2, 3, 4, 5])) {
  const sc = d.scenario(s, t); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, bn === 'oracle' ? { useWatch: true } : { ignoreLosses: true }));
  const rb = d.rubric(r, sc); const vm = debriefViewModel(r, sc, {}); const errs = r.score.legs.map(l => l.error ?? 0);
  const M = errs.reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, errs.length); const E = errs.reduce((a, b) => a + b, 0);
  const b: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) b[k] = (b[k] ?? 0) + v;
  const cands = Object.entries(b).filter(([k, v]) => k !== 'ta' && Math.sign(v) === Math.sign(E) && Math.abs(v) >= 2).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  let expect = M <= 3 ? 'clean' : (r.offCourseCount ? 'offCourse' : cands[0]?.[0] ?? 'clean');
  // acceptable alternates: any bucket >= 70% of the largest same-sign bucket
  const ok = (tip: string) => { const c = classify(tip); if (c === 'other') return null; if (c === expect) return true; if (expect !== 'clean' && cands.some(([k, v]) => k === c && Math.abs(v) >= 0.7 * Math.abs(cands[0]![1]))) return true; return false; };
  const rr = ok(rb.feedback[0] ?? ''); const vv = ok(vm.tip ?? '');
  const key = `${id}/${bn}`; tot[key] ??= { rub: 0, vm: 0, n: 0 };
  if (rr !== null || vv !== null) { const use = vv !== null ? vv : rr; tot[key]!.n++; grand.n++; if (rr) { tot[key]!.rub++; grand.rub++; } if (vv) { tot[key]!.vm++; grand.vm++; } if (M > 3) { fail.n++; if (vv) fail.vm++; if (rr) fail.rub++; } else { pass.n++; if (classify(vm.tip ?? '') === 'clean') pass.clean++; }
    if (!use) wrongList.push(`${id} t${t} ${bn} s${s} M=${M.toFixed(1)} expect=${expect} VMtip=${classify(vm.tip ?? '')} RUBtip=${classify(rb.feedback[0] ?? '')} ATT=${Object.entries(b).filter(([, v]) => Math.abs(v) >= 2).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v.toFixed(0)}`).join(',')}`); }
} }
for (const [k, v] of Object.entries(tot)) lines.push(`${k.padEnd(12)} VM tip right ${v.vm}/${v.n}   rubric tip right ${v.rub}/${v.n}`);
console.log(lines.join('\n')); console.log('GRAND (gradable runs):', grand, 'FAILING runs (M>3):', fail, 'GOOD runs (M<=3): VM says Clean in', pass.clean, 'of', pass.n); console.log('--- VM-tip wrong (or rubric when VM n/a):'); console.log(wrongList.join('\n'));

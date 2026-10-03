/** RE-VALIDATION: markdown matrix rows (stars per seed, modal "Fix this next" tip class, right-cause count). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';
const classify = (t: string): string => /^Clean run|Nothing systematic/.test(t) ? 'Clean' : /stops cost more|left stops too early/.test(t) ? 'stop dwell' : /left the start|start too early/.test(t) ? 'start/lead' : /Landmark speed changes/.test(t) ? 'ramp lead' : /Timed changes/.test(t) ? 'timed seg' : /Lights, trains/.test(t) ? 'hazard/TA' : /wrong turn cost/.test(t) ? 'off course' : /Turns cost/.test(t) ? 'turn loss' : /driver wandered/.test(t) ? 'driver wander' : /speedometer reads/.test(t) ? 'speedo' : /Review the attribution/.test(t) ? 'generic' : /Triage|Note each/.test(t) ? 'drill note' : /Lead each departure/.test(t) ? 'lead(D16)' : /Confirm the landmark/.test(t) ? 'landmark(D10)' : 'other';
const drills = (process.argv[2] ?? 'D03,D04,D05,D06,D07,D08,D08b,D10,D15,D16,D17,D18,D11,D12').split(',');
const rows: string[] = [];
for (const id of drills) { const d = drillById(id)!; for (const t of [0, 2]) { const cells: string[] = [];
  for (const bn of ['oracle', 'rookie']) {
    const stars: number[] = []; const tips: string[] = []; const rtips: string[] = []; let okc = 0, n = 0;
    for (const s of [1, 2, 3, 4, 5]) {
      const sc = d.scenario(s, t); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, bn === 'oracle' ? { useWatch: true } : { ignoreLosses: true }));
      const rb = d.rubric(r, sc); stars.push(rb.stars); const vm = debriefViewModel(r, sc, {}); tips.push(classify(vm.tip)); rtips.push(classify(rb.feedback[0] ?? ''));
      const errs = r.score.legs.map(l => l.error ?? 0); const M = errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length; const E = errs.reduce((a, b) => a + b, 0);
      const b: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) b[k] = (b[k] ?? 0) + v;
      void E; void b; void M;
    }
    const mode = (xs: string[]) => { const c: Record<string, number> = {}; xs.forEach(x => c[x] = (c[x] ?? 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v > 1 || xs.length > 1 ? ' x' + v : ''}`).slice(0, 2).join(' / '); };
    cells.push(`${stars.join('/')} | ${mode(tips)}${id === 'D10' || id === 'D15' || id === 'D16' || id === 'D06' ? ' (rubric: ' + mode(rtips) + ')' : ''}`);
    void okc; void n;
  }
  rows.push(`| ${id} | t${t} | ${cells[0]} | ${cells[1]} |`);
} }
console.log('| Drill | Tier | Oracle stars (s1-5) | Oracle "Fix this next" | Rookie stars | Rookie "Fix this next" |'); console.log(rows.join('\n'));

/** EDUCATION validation: oracle + honest Time Allowance (declare the summed signal/train wait per leg) across 20 seeds. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
const ids = (process.argv[2] ?? 'D18,D11,D08,D08b').split(',');
for (const id of ids) for (const t of [0, 2]) {
  const d = drillById(id)!; const hist = [0, 0, 0, 0]; const bad: string[] = []; const hist0 = [0, 0, 0, 0];
  for (let s = 1; s <= 20; s++) {
    const sc = d.scenario(s, t);
    { const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); hist0[d.rubric(r, sc).stars]!++; }
    const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true }); const declared = new Set<number>();
    const bot: Bot = { name: 'ta', onTick(ss) { inner.onTick(ss); const evs = ss.events; const leg = 1 + evs.filter(e => e.type === 'checkpoint' && e.detail?.kind === 'timing').length;
      if (declared.has(leg)) return; let lastCp = -1; evs.forEach((e, i) => { if (e.type === 'checkpoint' && e.detail?.kind === 'timing') lastCp = i; });
      const seg = evs.slice(lastCp + 1); let q = 0; let open: number | null = null; let any = false;
      for (const e of seg) { if (e.type === 'wait' && (e.detail?.reason === 'train' || e.detail?.reason === 'signal')) { open = e.tod; any = true; } else if (e.type === 'release' && open !== null) { q += e.tod - open; open = null; } }
      if (any && open === null && q >= 3) { declared.add(leg); ss.act({ type: 'ta.declare', seconds: Math.round(q) }); } } };
    const r = runBot(sim, bot); const rb = d.rubric(r, sc); hist[rb.stars]!++; if (rb.stars <= 1) bad.push(`s${s}[${r.score.legs.map(l => l.error + (l.taOverDeclared ? 'OVR' : '')).join(',')}]`);
  }
  console.log(`${id} t${t}: no-TA oracle 0*=${hist0[0]} 1*=${hist0[1]} 2*=${hist0[2]} 3*=${hist0[3]} | with TA 0*=${hist[0]} 1*=${hist[1]} 2*=${hist[2]} 3*=${hist[3]} ${bad.slice(0, 6).join(' ')}`);
}

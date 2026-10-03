/** EDUCATION validation: learner-technique bots the stock bots lack (k-card calibration, TA declaring, pre-read annotating, D01 lapping). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { cheatCard, calibrationFactor } from '../src/core/calibration.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';

function wrap(sim: Simulator, inner: Bot | null, extra: (sim: Simulator) => void): Bot { return { name: inner?.name ?? 'x', onTick(s) { inner?.onTick(s); extra(s); } }; }
const line = (id: string, t: number, s: number, bn: string, r: ReturnType<Simulator['result']>, rb: ReturnType<ReturnType<typeof drillById>['rubric']>) =>
  console.log(`${id} t${t} s${s} ${bn.padEnd(16)} legs=[${r.score.legs.map(l => l.error).join(',')}] stars=${rb.stars} | ${rb.headline.slice(0, 80)} | tip: ${rb.feedback[0]?.slice(0, 90)}`);

// ---- A. calibration (D07, D17): k from laps vs Column C, applied via setFactor (Timewise) or card (stock) ----
function calBot(sim: Simulator, mode: 'none' | 'k' | 'kNoisy'): Bot {
  const inner = new OracleBot(sim, { useWatch: true, noRecovery: true });
  let applied = false;
  return wrap(sim, inner, s => {
    if (mode === 'none' || applied) return;
    const book = s.sc.book; const cal = book.filter(b => b.section === 'calibration' && b.perfectCumulative !== undefined);
    const lastNode = cal[cal.length - 1]; if (!lastNode) return;
    const nodeEv = s.events.filter(e => e.type === 'node' && cal.some(c => c.nodeId === e.detail?.nodeId));
    if (nodeEv.length < cal.length) return; // run not finished yet
    const iv: { perfect: number; actual: number }[] = [];
    for (let i = 1; i < cal.length; i++) iv.push({ perfect: cal[i]!.perfectCumulative! - cal[i - 1]!.perfectCumulative!, actual: nodeEv[i]!.tod - nodeEv[i - 1]!.tod + (mode === 'kNoisy' ? (i % 2 ? 0.4 : -0.4) : 0) });
    // learner uses cumulative Column C (robust): total perfect / total actual
    const k = calibrationFactor(iv);
    applied = true;
    if (s.sc.speedo.kind === 'timewise') s.act({ type: 'speedo.setFactor', k });
    else s.act({ type: 'card.set', card: cheatCard(k) });
    (globalThis as any).__k = k;
  });
}
for (const id of ['D07', 'D17']) for (const t of [0, 1, 2]) for (const mode of ['none', 'k', 'kNoisy'] as const) {
  const stars: number[] = []; const out: string[] = [];
  for (const s of [1, 2, 3, 4, 5]) {
    const d = drillById(id)!; const sc = d.scenario(s, t); const sim = new Simulator(sc, { useCard: false });
    const r = runBot(sim, calBot(sim, mode)); const rb = d.rubric(r, sc); stars.push(rb.stars);
    out.push(`s${s}[${r.score.legs.map(l => l.error).join(',')}]k=${(((globalThis as any).__k) ?? 1).toFixed(3)}`); (globalThis as any).__k = undefined;
  }
  console.log(`CAL ${id} t${t} ${mode.padEnd(6)} stars=${stars.join('/')} ${out.join(' ')}`);
}

// ---- B. TA declaring for D08b/D08/D18 ----
function taBot(sim: Simulator, inner: Bot, over = 0): Bot {
  let declared = 0; let credited = new Set<string>();
  return wrap(sim, inner, s => {
    // declare just before each checkpoint is crossed (any time after waits: keep running total of qualifying wait seconds)
    const qual = s.events.filter(e => e.type === 'wait' && (e.detail?.reason === 'train' || e.detail?.reason === 'signal'));
    const rel = s.events.filter(e => e.type === 'release');
    void qual; void rel; void declared; void credited;
  });
}
// qualifying seconds are in attribution hazard bucket; simpler: replay twice (first pass to learn hazard seconds, second to declare)
for (const [id, tiers] of [['D08b', [0, 2]], ['D08', [0, 2]], ['D18', [0, 2]]] as [string, number[]][]) for (const t of tiers) for (const mode of ['noTA', 'TA', 'TAover20'] as const) {
  const stars: number[] = []; const out: string[] = [];
  for (const s of [1, 2, 3]) {
    const d = drillById(id)!; const sc = d.scenario(s, t);
    // pass 1: oracle to measure hazard seconds per leg
    const sim1 = new Simulator(sc); const r1 = runBot(sim1, new OracleBot(sim1, { useWatch: true }));
    const haz = r1.attribution.map(a => ({ leg: a.legIndex, h: Math.max(0, a.buckets.hazard) }));
    const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true });
    let done = false;
    const bot = wrap(sim, inner, ss => { if (mode === 'noTA' || done) return; const cp = ss.events.filter(e => e.type === 'checkpoint' && e.detail?.kind === 'timing'); void cp; });
    // declare near the end of each leg: when next checkpoint within 1200 ft; implement by scheduling at start of each hazard release instead
    const declaredFor = new Set<number>();
    const bot2: Bot = { name: 'ta', onTick(ss) { inner.onTick(ss); if (mode === 'noTA') return; const legIdx = 1 + ss.events.filter(e => e.type === 'checkpoint' && e.detail?.kind === 'timing').length; const hz = haz.find(x => x.leg === legIdx); if (!hz || declaredFor.has(legIdx) || hz.h < 5) return; const waits = ss.events.filter(e => e.type === 'wait' && (e.detail?.reason === 'train' || e.detail?.reason === 'signal')); const rels = ss.events.filter(e => e.type === 'release'); if (waits.length && rels.length >= waits.length) { declaredFor.add(legIdx); ss.act({ type: 'ta.declare', seconds: Math.round(hz.h + (mode === 'TAover20' ? 20 : 0)) }); } } };
    void bot;
    const r = runBot(sim, bot2); const rb = d.rubric(r, sc); stars.push(rb.stars);
    out.push(`s${s}[${r.score.legs.map(l => l.error + (l.taOverDeclared ? 'OVR' : '')).join(',')}]haz=${haz.map(h => h.h.toFixed(0)).join('/')}`);
  }
  console.log(`TA ${id} t${t} ${mode.padEnd(8)} stars=${stars.join('/')} ${out.join(' ')}`);
}

// ---- C. D15 pre-read annotating ----
for (const t of [0, 2]) for (const frac of [0, 0.5, 1]) {
  const stars: number[] = []; const out: string[] = [];
  for (const s of [1, 2, 3]) {
    const d = drillById('D15')!; const sc = d.scenario(s, t); const sim = new Simulator(sc); const inner = new OracleBot(sim, { useWatch: true });
    const pauses = sc.book.filter(b => b.pause && b.pause > 0); const nA = Math.round(pauses.length * frac);
    for (const p of pauses.slice(0, nA)) sim.act({ type: 'line.annotate', n: p.n, text: 'go 7s' });
    const r = runBot(sim, inner); const rb = d.rubric(r, sc); stars.push(rb.stars); out.push(`s${s}[${r.score.legs.map(l => l.error).join(',')}]cov=${r.prereadCoverage.toFixed(2)}(${pauses.length}p)`);
  }
  console.log(`D15 t${t} annotate ${frac} stars=${stars.join('/')} ${out.join(' ')}`);
}

// ---- D. D01 lap bot with reaction noise ----
for (const [bias, jitter] of [[0, 0], [0.15, 0.1], [0.3, 0.3], [0.2, 0.7], [0.5, 0.2]]) for (const t of [0, 2]) {
  const d = drillById('D01')!; const stars: number[] = []; const out: string[] = [];
  for (const s of [1, 2]) {
    const sc = d.scenario(s, t); const sim = new Simulator(sc); const seen = new Set<string>();
    const rnd = (() => { let x = s * 7919 + 1; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; })();
    const pending: number[] = [];
    const bot: Bot = { name: 'lap', onTick(ss) { if (ss.phase === 'preread' && ss.tod >= sc.startTime) { ss.act({ type: 'start' }); ss.act({ type: 'watch.start' }); }
      for (const e of ss.events) if (e.type === 'node' && !seen.has(String(e.detail?.nodeId)) && e.detail?.kind === 'sign') { seen.add(String(e.detail?.nodeId)); pending.push(ss.tod + bias + (rnd() * 2 - 1) * jitter * 1.7); }
      while (pending.length && pending[0]! <= ss.tod) { pending.shift(); ss.act({ type: 'watch.lap' }); } } };
    const r = runBot(sim, bot); const rb = d.rubric(r, sc); stars.push(rb.stars); out.push(rb.headline);
  }
  console.log(`D01 t${t} bias ${bias} jitter ${jitter}: stars=${stars.join('/')} | ${out[0]}`);
}

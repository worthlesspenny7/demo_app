/** PT-09: D07 skill bot (two-pass): read the watch at each calibration point, note "cal N = interval / cumulative", set the factor k. Seeds 1-10 x 3 tiers. Also the naive variants. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { calibrationTruth } from '../src/core/drills/d07.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
const d = drillById('D07')!; const fmt = (s: number): string => `${Math.floor(s / 60)}m${(s % 60).toFixed(1).padStart(4, '0')}`;
const out: string[] = [];
for (const tier of [0, 1, 2]) {
  const cells: string[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const sc = d.scenario(seed, tier);
    const s1 = new Simulator(sc, { watch: 'digital' }); const r1 = runBot(s1, new OracleBot(s1, { useWatch: true, noCalibration: true }));
    const { points, trueK } = calibrationTruth(r1, sc); const last = points[points.length - 1]!;
    const notes = points.filter(p => p.watchInterval !== null).map(p => `cal ${p.point} = ${fmt(p.watchInterval!)} / ${fmt(p.watchCumulative!)}`);
    const variants: Record<string, (s: Simulator) => void> = {};
    const run = (name: string, opts: ConstructorParameters<typeof OracleBot>[1], hook: (s: Simulator, done: { n: boolean; f: boolean }) => void) => {
      const s = new Simulator(sc, { watch: 'digital' }); const o = new OracleBot(s, opts); const done = { n: false, f: false };
      const b: Bot = { name, onTick(ss) { hook(ss, done); o.onTick(ss); } }; const r = runBot(s, b); const rb = d.rubric(r, sc); return { stars: rb.stars, raw: r.score.raw, head: rb.headline };
    };
    const full = run('skill', { useWatch: true }, (ss, done) => { if (!done.n) { done.n = true; for (const t of notes) ss.act({ type: 'note', text: t } as Action); } if (!done.f && ss.tod > last.crossTod! + 2) { done.f = true; ss.act({ type: 'note', text: `k = ${trueK!.toFixed(4)}` } as Action); if (sc.speedo.kind === 'timewise') ss.act({ type: 'speedo.setFactor', k: trueK! } as Action); } });
    const notesOnly = run('notesOnly', { useWatch: true }, (ss, done) => { if (!done.n) { done.n = true; for (const t of notes) ss.act({ type: 'note', text: t } as Action); } });
    const factorOnly = run('factorOnly', { useWatch: true }, (ss, done) => { if (!done.f && ss.tod > last.crossTod! + 2) { done.f = true; ss.act({ type: 'note', text: `k = ${trueK!.toFixed(4)}` } as Action); if (sc.speedo.kind === 'timewise') ss.act({ type: 'speedo.setFactor', k: trueK! } as Action); } });
    const sloppy = run('sloppyReads', { useWatch: true }, (ss, done) => { if (!done.n) { done.n = true; for (const t of notes.map(n => n.replace(/(\d)m(\d\d\.\d)/g, (_m, a, b) => `${a}m${(Number(b) + 0.6).toFixed(1).padStart(4, '0')}`))) ss.act({ type: 'note', text: t } as Action); } });
    cells.push(`${full.stars}${notesOnly.stars}${factorOnly.stars}${sloppy.stars}(raw ${full.raw})`);
    void variants;
  }
  out.push(`tier ${tier}: [full, notesOnly, factorOnly, +0.6s sloppy reads] per seed: ${cells.join(' ')}`);
}
console.log(out.join('\n'));

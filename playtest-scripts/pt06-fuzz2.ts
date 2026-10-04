/** PT-06 area 8: heavier fuzz, V3-weighted actions, all aids rungs, asp 0..6, day / leg / drill scenarios, long advances; invariants checked after every step. */
import { Simulator, type Action } from '../src/core/sim.js';
import { Session } from '../src/agent/protocol.js';
import { generateStage, generateLeg, PROFILES } from '../src/core/generator/generate.js';
import { rng } from '../src/core/rng.js';
import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/registry.js';
import type { Scenario } from '../src/core/course.js';
const problems: string[] = [];
const fin = (v: unknown, p: string, out: string[]): void => { if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`${p}=${v}`); } else if (Array.isArray(v)) v.forEach((x, i) => fin(x, `${p}[${i}]`, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'junk') continue; fin(x, `${p}.${k}`, out); } };
const drills = allDrills();
const N = Number(process.argv[2] ?? 40);
for (let idx = 0; idx < N; idx++) {
  const r = rng(5000 + idx); const kind = idx % 4;
  let sc: Scenario;
  if (kind === 0) sc = generateStage(100 + idx, { ...PROFILES.fullStage, asp: idx % 7 });
  else if (kind === 1) sc = generateLeg(100 + idx, { ...PROFILES.fullLeg, asp: idx % 5 });
  else { const d = drills[idx % drills.length]!; sc = d.scenario(100 + idx, idx % d.tiers.length); }
  (sc as any).aids = { ...sc.aids, rung: (idx % 4) as 0 | 1 | 2 | 3 };
  const sess = new Session(sc, { watch: idx % 2 ? 'digital' : 'analog' }); const sim = sess.sim; let lastTod = sim.tod, lastPhase = sim.phase; const L = sc.book.length;
  const t0 = Date.now();
  try {
    for (let i = 0; i < 350 && sim.phase !== 'finished'; i++) {
      const c = Math.floor(r.next() * 40);
      const acts: Action[] = [
        { type: 'start' }, { type: 'pullUp' }, { type: 'call.warn', seconds: 30 }, { type: 'count', n: Math.floor(r.next() * 12) }, { type: 'call.identify', text: 'x' }, { type: 'call.go' }, { type: 'call.go' },
        { type: 'call.speed', mph: 10 + Math.floor(r.next() * 46) }, { type: 'call.speed', mph: 10 + Math.floor(r.next() * 46) }, { type: 'call.turn', dir: (['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR'] as const)[Math.floor(r.next() * 7)]! }, { type: 'call.stop' },
        { type: 'clock.read', source: 'stopwatch' }, { type: 'watch.mode', mode: 'tod' }, { type: 'watch.mode', mode: 'chrono' }, { type: 'watch.start' }, { type: 'watch.lap' }, { type: 'watch.recall' }, { type: 'watch.reset', force: true },
        { type: 'ledger.set', entries: [{ seconds: Math.round(r.next() * 20 - 10), source: 'stop' }] }, { type: 'ledger.set', seconds: Math.round(r.next() * 60 - 30) },
        { type: 'ta.request', legIndex: 1 + Math.floor(r.next() * 4), seconds: 10 * Math.floor(r.next() * 20), fromLine: 1, toLine: Math.max(1, Math.floor(r.next() * L)) }, { type: 'ta.declare', seconds: 10 * Math.floor(r.next() * 5) }, { type: 'scorecard.ack' },
        { type: 'speed.emergency', mph: 10 + Math.floor(r.next() * 20) }, { type: 'speed.resume' }, { type: 'call.uturn' }, { type: 'call.pass' }, { type: 'call.pullover' }, { type: 'line.set', n: 1 + Math.floor(r.next() * L) }, { type: 'skipPreread', secondsBefore: Math.floor(r.next() * 60) },
        { type: 'speedo.setFactor', k: 0.9 + r.next() * 0.2 }, { type: 'note', text: 'n' }, { type: 'call.go' }, { type: 'call.go' }, { type: 'call.speed', mph: 25 }, { type: 'call.speed', mph: 45 }, { type: 'watch.stop' }, { type: 'bezel.set', seconds: 12 }, { type: 'card.set', card: { '35': 36.5 } }, { type: 'line.annotate', n: 1, text: 'a' }, { type: 'count', n: 0 },
      ];
      const rep = sess.handle({ type: 'act', action: acts[c % acts.length]! }); if (rep.type === 'error') { /* validation refusals are fine */ }
      const secs = r.chance(0.2) ? Math.floor(r.next() * 300) : Math.floor(r.next() * 20);
      const adv = sess.handle({ type: 'advance', seconds: secs }); if (adv.type === 'error') problems.push(`scenario ${idx} (${sc.id}) advance error ${adv.message}`);
      if (sim.tod < lastTod - 1e-9) problems.push(`scenario ${idx}: tod went backwards ${lastTod} -> ${sim.tod}`); lastTod = sim.tod;
      if (lastPhase === 'running' && sim.phase === 'preread') problems.push(`scenario ${idx}: phase went back to preread`); if (lastPhase === 'finished' && sim.phase !== 'finished') problems.push(`scenario ${idx}: left finished`); lastPhase = sim.phase;
      const bad: string[] = []; fin(sim.observe({ peek: true }), 'obs', bad); if (bad.length) { problems.push(`scenario ${idx} (${sc.id}) step ${i}: non-finite observation ${bad.slice(0, 4).join(',')}`); break; }
      if (Date.now() - t0 > 60000) { problems.push(`scenario ${idx} (${sc.id}): >60 s wall clock (hang?)`); break; }
    }
    const bad: string[] = []; fin(sim.result(), 'result', bad); if (bad.length) problems.push(`scenario ${idx} (${sc.id}) result non-finite ${bad.slice(0, 5).join(',')}`);
    if (JSON.stringify(sim.result()).length > 8e6) problems.push(`scenario ${idx}: result > 8 MB`);
  } catch (e) { problems.push(`scenario ${idx} (${sc.id}) THREW ${(e as Error).stack?.split('\n').slice(0, 4).join(' / ')}`); }
}
console.log('fuzz2 done; PROBLEMS', problems.length); console.log(problems.join('\n'));

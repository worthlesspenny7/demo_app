/**
 * PT-09: drill x tier x seed x bot matrix. Usage: npx tsx playtest-scripts/pt09-matrix.ts D03,D04 [seeds=1-10] [outfile]
 * Writes one JSON line per run: {drill,tier,seed,bot,stars,score,raw,oc,dnf,findings,disc,err}.
 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { idealNotes } from '../src/core/drills/d15.js';
import { chartPairs } from '../src/core/drills/d06.js';
import { buildPerfTable, matrixAt, stopLoss } from '../src/core/perf-table.js';
import { formatClock } from '../src/core/units.js';
import type { Scenario } from '../src/core/course.js';
import { appendFileSync, writeFileSync } from 'node:fs';

const ids = (process.argv[2] ?? 'D03').split(',');
const nseeds = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? '/dev/stdout';
if (out !== '/dev/stdout') writeFileSync(out, '');
const BOTS = ['oracle', 'rookie', 'noPause', 'goCount', 'wrongMinute', 'noClockReads', 'noCalibration', 'skill'] as const;

const withHook = (inner: Bot, before: (s: Simulator) => void): Bot => ({ name: inner.name, onTick(s) { before(s); inner.onTick(s); } });
const mmss = (x: number): string => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;

/** the skill bot of a drill: the oracle plus the one thing that drill grades that the stock oracle does not do */
function skillBot(id: string, sc: Scenario, sim: Simulator): Bot | null {
  const o = new OracleBot(sim, { useWatch: true });
  if (id === 'D01') {
    const seen = new Set<string>(); let started = false;
    return { name: 'lapper', onTick(s) {
      if (s.phase === 'preread' && !started && s.tod >= sc.startTime - 4.5) { started = true; s.act({ type: 'start' }); s.act({ type: 'watch.start' }); }
      for (const e of s.events) if (e.type === 'node' && String(e.detail?.kind) === 'sign' && !seen.has(String(e.detail?.nodeId))) { seen.add(String(e.detail?.nodeId)); s.act({ type: 'watch.lap' }); if (s.watch) {/* recall so the split is free for the next lap */ } }
    } };
  }
  if (id === 'D06') {
    const perf = buildPerfTable(sc.car); let done = false;
    return withHook(o, s => { if (done) return; done = true; for (const p of chartPairs(sc.tags)) {
      const tv = p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, sc.car) : matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut);
      const w = p.kind === 'stopGo' ? 'stopgo' : p.kind === 'stopMid' ? 'stopmid' : p.kind;
      s.act({ type: 'note', text: `${w} ${p.vIn}>${p.vOut} = ${tv.toFixed(1)}` });
    } });
  }
  if (id === 'D15') {
    let done = false; const outDone = new Set<number>();
    return withHook(o, s => {
      if (!done) { done = true; for (const x of idealNotes(sc)) s.act({ type: 'line.annotate', n: x.n, text: x.text } as Action); }
      for (const ev of s.events) if (ev.type === 'transit.in' && !outDone.has(Number(ev.detail?.n))) { outDone.add(Number(ev.detail?.n)); const begin = sc.book.find(b => b.n === Number(ev.detail?.n))!; const end = sc.book.find(b => b.transit?.end && b.transit.exact && b.restartTime === undefined && b.n > begin.n); if (begin.transit && end) s.act({ type: 'line.annotate', n: end.n, text: `OUT ${formatClock(Number(ev.detail!.tod) + begin.transit.seconds)}` } as Action); }
    });
  }
  if (id === 'D17') {
    const cal = sc.book.find(i => i.calibrationStart); let doneAfter = false;
    return withHook(o, s => {
      if (doneAfter || !cal || !s.events.some(e => e.type === 'watchLost')) return; doneAfter = true;
      const t0 = s.events.find(e => e.type === 'node' && e.detail?.nodeId === cal.nodeId)?.tod; if (t0 === undefined) return;
      s.act({ type: 'clock.read' }); s.act({ type: 'note', text: `elapsed ${mmss(s.tod - t0)}` }); s.act({ type: 'watch.start' });
    });
  }
  return o;
}

function mk(bot: string, id: string, sc: Scenario, sim: Simulator, seed: number): Bot {
  switch (bot) {
    case 'oracle': return new OracleBot(sim, { useWatch: true });
    case 'rookie': return new OracleBot(sim, { ignoreLosses: true });
    case 'noPause': return new OracleBot(sim, { forgetPauses: true });
    case 'goCount': return new OracleBot(sim, { goCount: true });
    case 'wrongMinute': return new OracleBot(sim, { useWatch: true, wrongMinute: true });
    case 'noClockReads': return new OracleBot(sim, { useWatch: true, noClockReads: true });
    case 'noCalibration': return new OracleBot(sim, { useWatch: true, noCalibration: true });
    default: return skillBot(id, sc, sim)!;
  }
  void seed;
}

for (const id of ids) {
  const d = drillById(id); if (!d || d.kind !== 'drive') { console.error('skip', id); continue; }
  for (let tier = 0; tier < d.tiers.length; tier++) for (let seed = 1; seed <= nseeds; seed++) for (const bot of BOTS) {
    const row: Record<string, unknown> = { drill: id, tier, seed, bot };
    try {
      const sc = d.scenario(seed, tier); const sim = new Simulator(sc);
      const t0 = Date.now(); const r = runBot(sim, mk(bot, id, sc, sim, seed)); const rb = d.rubric(r, sc);
      Object.assign(row, { stars: rb.stars, score: rb.score, raw: r.score.raw, oc: r.offCourseCount, dnf: !!r.dnf, findings: (r.findings ?? []).map(f => f.kind), disc: (r.instrumentDiscipline ?? []).map(f => f.kind), tip: (rb.tip ?? '').slice(0, 140), ms: Date.now() - t0 });
    } catch (e) { row.err = (e as Error).message.slice(0, 160); }
    appendFileSync(out === '/dev/stdout' ? '/dev/stdout' : out, JSON.stringify(row) + '\n');
  }
}

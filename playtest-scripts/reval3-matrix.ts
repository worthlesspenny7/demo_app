/**
 * RE-VALIDATION v3 (education): naive play vs by-the-lesson play per drive drill at one tier, seeds 1-5.
 * usage: npx tsx playtest-scripts/reval3-matrix.ts D03,D04 [tier=0] [seeds=1,2,3,4,5]   -> JSON lines on stdout (one run per line)
 * naive = ignores the lesson (rookie bot / goCount / wrongMinute / no calibration / eager turn calls / no notes);
 * lesson = scripted by the lesson (oracle bot, calibrated factor + read-off notes, true chart notes, ideal pre-read notes).
 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { nodeById } from '../src/core/course.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';
import { buildPerfTable, matrixAt, stopLoss } from '../src/core/perf-table.js';
import { calibrationFactor, cheatCard } from '../src/core/calibration.js';
import { idealNotes } from '../src/core/drills/d15.js';
import { chartPairs } from '../src/core/drills/d06.js';
import { packardValue } from '../content/reference-data.js';
import { formatClock } from '../src/core/units.js';
import { rng } from '../src/core/rng.js';

const drills = (process.argv[2] ?? 'D03').split(',');
const tier = Number(process.argv[3] ?? 0);
const seeds = (process.argv[4] ?? '1,2,3,4,5').split(',').map(Number);

const classify = (t: string): string =>
  /^Clean run/.test(t) ? 'clean' : /^Leg times are clean, but/.test(t) ? 'cleanbut' : /recovered .* s in cruise/.test(t) ? 'recoveredShort' : /stops cost more|left stops too early/.test(t) ? 'stop' : /left the start|start too early/.test(t) ? 'start'
    : /Landmark speed changes/.test(t) ? 'speedChange' : /Timed changes/.test(t) ? 'timedChange' : /Lights, trains/.test(t) ? 'hazard' : /wrong turn cost/.test(t) ? 'offCourse' : /Turns cost/.test(t) ? 'turn'
      : /never called/.test(t) ? 'uncalled' : /Cruise segments|cruise segments|You ran (slow|fast) on the cruise/.test(t) ? 'cruise' : /Review the attribution/.test(t) ? 'default' : 'other';

const mmss = (x: number): string => `${Math.floor(x / 60)}m${(x % 60).toFixed(1).padStart(4, '0')}s`;
function interceptAct(sim: Simulator, fn: (a: Action) => void): void { const orig = sim.act.bind(sim); (sim as unknown as { act: (a: Action) => void }).act = (a: Action) => { fn(a); orig(a); }; }
function mkSim(sc: ReturnType<ReturnType<typeof drillById>['scenario']>): Simulator { return new Simulator(sc, (sc.tags ?? []).includes('watch:digital') ? { watch: 'digital' } : {}); }

type Make = (sim: Simulator, sc: ReturnType<ReturnType<typeof drillById>['scenario']>, seed: number) => Bot;
const rookie: Make = sim => new OracleBot(sim, { ignoreLosses: true });
const oracle: Make = sim => new OracleBot(sim, { useWatch: true });
const goCount: Make = sim => new OracleBot(sim, { goCount: true });
const wrongMinute: Make = sim => new OracleBot(sim, { useWatch: true, wrongMinute: true });

/** D07/D17 by the lesson: lap at the asterisk and every calibration point (the oracle does), write "cal n = interval / cumulative" read off the watch, compute k = printed cumulative / read cumulative, set the factor. Recovery off, so only calibration can save the run. */
const calLesson: Make = (sim, sc) => {
  const inner = new OracleBot(sim, { useWatch: true, noRecovery: true });
  const cal = sc.book.filter(b => b.section === 'calibration'); let startTod: number | null = null; let prev: number | null = null; let n = 0; let done = false;
  interceptAct(sim, a => {
    if (a.type === 'watch.start' && cal.length && sim.car.s >= 0) { /* the oracle restarts the watch at the asterisk; the last start before the first lap wins */ if (n === 0) startTod = sim.tod; }
    if (a.type === 'watch.lap' && startTod !== null && n < cal.length - 1) {
      n++; const cum = sim.tod - startTod; const iv = cum - (prev === null ? 0 : prev - startTod); prev = sim.tod;
      sim.act({ type: 'note', text: `cal ${n} = ${mmss(iv)} / ${mmss(cum)}` });
      if (n === cal.length - 1 && !done) { done = true; const printed = cal[n]!.perfectCumulative!; const k = calibrationFactor([{ perfect: printed, actual: cum }]); sim.act(sc.speedo.kind === 'timewise' ? { type: 'speedo.setFactor', k } : { type: 'card.set', card: cheatCard(k) }); }
    }
  });
  return inner;
};
const calNaive: Make = sim => new OracleBot(sim, { useWatch: true, noCalibration: true, noRecovery: true });

/** D10 naive: arms every turn 900 ft out, whatever the road offers on the way (the eager turn-caller). */
const eager: Make = (sim, sc) => {
  const inner = new OracleBot(sim, { useWatch: true }); const called = new Set<number>();
  return { name: 'eager900', onTick(ss) { if (ss.phase === 'running') for (const ins of sc.book) { if (!ins.turn || ins.turn === 'S' || called.has(ins.n)) continue; const ds = nodeById(sc.course, ins.nodeId).s - ss.car.s; if (ds > 0 && ds <= 900) { called.add(ins.n); ss.act({ type: 'call.turn', dir: ins.turn }); } } inner.onTick(ss); } };
};

/** D01: lap at each marker. latency/jitter in seconds; dbl = presses lap again 0.25 s later (a lap while the split is frozen). */
const lapBot = (latency: number, jitter: number, dbl: boolean): Make => (sim, sc, seed) => {
  const r = rng(`d01:${seed}:${latency}`); const marks = sc.book.filter(b => b.sign || /Lap at/.test(b.text)).map(b => ({ n: b.n, s: nodeById(sc.course, b.nodeId).s, done: false, fire: 0 }));
  let started = false; const queue: { at: number; a: Action }[] = [];
  return { name: 'lap', onTick(ss) {
    if (ss.phase === 'preread' && !started && ss.tod >= sc.startTime - 4.5) { started = true; ss.act({ type: 'start' }); ss.act({ type: 'watch.start' }); }
    if (ss.phase === 'running') for (const m of marks) if (!m.done && ss.car.s >= m.s) { m.done = true; const at = ss.tod + Math.max(0, latency + (r.next() - 0.5) * 2 * jitter); queue.push({ at, a: { type: 'watch.lap' } }); if (dbl) queue.push({ at: at + 0.25, a: { type: 'watch.lap' } }); }
    for (const q of queue.filter(x => x.at <= ss.tod)) ss.act(q.a); queue.splice(0, queue.length, ...queue.filter(x => x.at > ss.tod));
  } };
};

/** D06: notes. truth value per pair as the rubric computes it. */
function d06Notes(sc: ReturnType<ReturnType<typeof drillById>['scenario']>, mode: 'truth' | 'packard' | 'ignoreLosses'): string[] {
  const perf = buildPerfTable(sc.car); const out: string[] = [];
  for (const p of chartPairs(sc.tags)) {
    const w = p.kind === 'stopGo' ? 'stopgo' : p.kind === 'accel' ? 'accel' : p.kind === 'turn' ? 'turn' : 'stopmid';
    const truth = p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, sc.car) : matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut);
    if (mode === 'truth') out.push(`${w} ${p.vIn}>${p.vOut} = ${truth.toFixed(1)}`);
    else if (mode === 'ignoreLosses') out.push(`${w} ${p.vIn}>${p.vOut} = ${p.kind === 'stopGo' ? 15 : 0}`);
    else { // copy from the handbook's printed Packard charts; pairs outside 15-50 cannot be copied
      const id = p.kind === 'stopGo' ? 'stopgo' : p.kind === 'accel' ? 'accel' : p.kind === 'turn' ? 'turn' : 'stopgo';
      const v = packardValue(id as 'accel' | 'stopgo' | 'turn', p.vIn, p.vOut); if (v === null) continue;
      out.push(`${w} ${p.vIn}>${p.vOut} = ${(p.kind === 'stopMid' ? 15 - v : v).toFixed(1)}`);
    }
  }
  return out;
}
const d06Play = (mode: 'none' | 'truth' | 'packard' | 'ignoreLosses'): Make => (sim, sc) => {
  const inner = new OracleBot(sim, { useWatch: true }); let done = false;
  return { name: 'd06', onTick(ss) { if (!done) { done = true; if (mode !== 'none') for (const t of d06Notes(sc, mode)) ss.act({ type: 'note', text: t }); } inner.onTick(ss); } };
};

/** D15: ideal notes written in the pre-read; the exact-transit OUT time written when the car passes the IN line. mode 'printedPause' writes the printed pause instead of the chart pause. */
const d15Play = (mode: 'none' | 'ideal' | 'printedPause'): Make => (sim, sc) => {
  const inner = new OracleBot(sim, mode === 'none' ? { ignoreLosses: true } : { useWatch: true }); let done = false; const outDone = new Set<number>();
  return { name: 'd15', onTick(ss) {
    if (!done) { done = true; if (mode !== 'none') for (const x of idealNotes(sc)) { let t = x.text; if (mode === 'printedPause') { const ins = sc.book.find(b => b.n === x.n)!; if (ins.pause) t = t.replace(/pause [\d.]+ s/, `pause ${ins.pause} s`); } ss.act({ type: 'line.annotate', n: x.n, text: t }); } }
    if (mode !== 'none') for (const ev of ss.events) if (ev.type === 'transit.in' && !outDone.has(Number(ev.detail?.n))) {
      outDone.add(Number(ev.detail?.n)); const begin = sc.book.find(b => b.n === Number(ev.detail?.n)); const end = sc.book.find(b => b.transit?.end && b.transit.exact && b.restartTime === undefined && b.n > begin!.n);
      if (begin?.transit && end) ss.act({ type: 'line.annotate', n: end.n, text: `OUT ${formatClock(Number(ev.detail!.tod) + begin.transit.seconds)}` });
    }
    inner.onTick(ss);
  } };
};

interface Play { name: string; kind: 'naive' | 'lesson'; make: Make }
const PLAYS: Record<string, Play[]> = {
  D01: [{ name: 'naive: laps by watching the dial (0.9 s late +-0.6, double press)', kind: 'naive', make: lapBot(0.9, 0.6, true) }, { name: 'lesson: lap as the bumper passes', kind: 'lesson', make: lapBot(0.05, 0.1, false) }],
  D03: [{ name: 'naive: rookie (full printed pause)', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D04: [{ name: 'naive: rookie (counts from own go, no lead)', kind: 'naive', make: rookie }, { name: 'naive-b: goCount (counts from own go, keeps lead)', kind: 'naive', make: goCount }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D05: [{ name: 'naive: rookie (change at the sign)', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D06: [{ name: 'naive: no notes', kind: 'naive', make: d06Play('none') }, { name: 'naive-b: forgets the losses (15 / 0 / 0)', kind: 'naive', make: d06Play('ignoreLosses') }, { name: 'lesson-b: copies the printed Packard charts (pairs off 15-50 left blank)', kind: 'lesson', make: d06Play('packard') }, { name: 'lesson: true measured values', kind: 'lesson', make: d06Play('truth') }],
  D07: [{ name: 'naive: rookie', kind: 'naive', make: rookie }, { name: 'naive-b: no calibration, no recovery', kind: 'naive', make: calNaive }, { name: 'lesson: laps + notes + factor, no recovery', kind: 'lesson', make: calLesson }],
  D08: [{ name: 'naive: rookie (no recovery)', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D08b: [{ name: 'naive: rookie (no TA, no recovery)', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D10: [{ name: 'naive: eager turn caller (900 ft)', kind: 'naive', make: eager }, { name: 'naive-b: rookie', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D11: [{ name: 'naive: rookie', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D12: [{ name: 'naive: rookie', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D15: [{ name: 'naive: no notes, rookie run', kind: 'naive', make: d15Play('none') }, { name: 'naive-b: notes with the printed pause (not the chart pause)', kind: 'naive', make: d15Play('printedPause') }, { name: 'lesson: six notations', kind: 'lesson', make: d15Play('ideal') }],
  D16: [{ name: 'naive: wrong minute at the first restart', kind: 'naive', make: wrongMinute }, { name: 'naive-b: rookie (no launch lead)', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
  D17: [{ name: 'naive: rookie', kind: 'naive', make: rookie }, { name: 'naive-b: no calibration, no recovery', kind: 'naive', make: calNaive }, { name: 'lesson: laps + notes + factor, no recovery', kind: 'lesson', make: calLesson }],
  D18: [{ name: 'naive: rookie', kind: 'naive', make: rookie }, { name: 'lesson: oracle', kind: 'lesson', make: oracle }],
};

for (const id of drills) {
  const d = drillById(id)!;
  for (const p of PLAYS[id] ?? []) for (const s of seeds) {
    const t0 = Date.now();
    try {
      const sc = d.scenario(s, tier); const sim = mkSim(sc); const bot = p.make(sim, sc, s);
      const r = runBot(sim, bot); const rb = d.rubric(r, sc); const vm = debriefViewModel(r, sc, {});
      const errs = r.score.legs.map(l => l.error ?? 0); const M = errs.reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, errs.length); const E = errs.reduce((a, b) => a + b, 0);
      const b: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) b[k] = (b[k] ?? 0) + v;
      const cands = Object.entries(b).filter(([k, v]) => k !== 'ta' && Math.sign(v) === Math.sign(E) && Math.abs(v) >= 2).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
      const expect = M <= 3 ? 'clean' : r.offCourseCount ? 'offCourse' : cands[0]?.[0] ?? 'clean';
      const cls = classify(vm.tip); const alt = cands.filter(([, v]) => Math.abs(v) >= 0.7 * Math.abs(cands[0]?.[1] ?? 1e9)).map(([k]) => k);
      const right = cls === 'other' ? null : cls === expect || (expect !== 'clean' && alt.includes(cls)) || (expect === 'clean' && cls === 'cleanbut');
      console.log(JSON.stringify({ drill: id, tier, play: p.name, kind: p.kind, seed: s, stars: rb.stars, headline: rb.headline, raw: r.score.raw, M: Math.round(M * 10) / 10, E: Math.round(E * 10) / 10, oc: r.offCourseCount, legs: errs.map(e => Math.round(e * 10) / 10),
        att: Object.entries(b).filter(([, v]) => Math.abs(v) >= 2).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v.toFixed(0)}`).join(','), expect, cls, right, vmTip: vm.tip, vmTip2: vm.tips[1] ?? null, rubTip0: rb.feedback[0] ?? '', rubFb: rb.feedback.slice(0, 4), findings: (r.findings ?? []).map(f => f.kind).slice(0, 4), dnf: r.dnf, secs: (Date.now() - t0) / 1000 }));
    } catch (e) { console.log(JSON.stringify({ drill: id, tier, play: p.name, kind: p.kind, seed: s, error: String((e as Error).stack ?? e).slice(0, 400) })); }
  }
}

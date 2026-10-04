/** PT-06 areas 8+9: random bot 100 seeds x 300 actions; extended all-actions fuzz; NaN/Infinity scan of result(); determinism; replay == live. */
import { Simulator, replay, validateAction, type Action } from '../src/core/sim.js';
import { Session } from '../src/agent/protocol.js';
import { RandomBot, runBot } from '../src/agent/bots.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { generateStage, generateLeg, PROFILES } from '../src/core/generator/generate.js';
import { rng } from '../src/core/rng.js';
import type { Scenario } from '../src/core/course.js';

function scan(v: unknown, path: string, out: string[]): void {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`${path}=${v}`); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => scan(x, `${path}[${i}]`, out)); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`, out);
}
const mode = process.argv[2] ?? 'all';
const problems: string[] = [];

if (mode === 'random' || mode === 'all') {
  // random bot, 100 seeds, 300 actions (random bot acts every 1-7 s, so run until ~300 actions)
  let ex = 0, nan = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const sc: Scenario = seed % 4 === 0 ? builtinScenario('onestop', seed) : seed % 4 === 1 ? builtinScenario('varied', seed) : seed % 4 === 2 ? generateLeg(seed, PROFILES.fullLeg) : builtinScenario('mechanical', seed);
    try {
      const sim = new Simulator(sc); const bot = new RandomBot(sim, seed);
      let t = 0; while (sim.phase !== 'finished' && sim.actions.length < 300 && t < 6 * 3600) { bot.onTick(); sim.step(0.1); t += 0.1; }
      const r = sim.result(); const bad: string[] = []; scan(r, 'result', bad); scan(sim.observe(), 'obs', bad);
      if (bad.length) { nan++; problems.push(`random seed ${seed} (${sc.id}): non-finite ${bad.slice(0, 4).join(', ')}`); }
    } catch (e) { ex++; problems.push(`random seed ${seed} (${sc.id}) threw ${(e as Error).message}`); }
  }
  console.log(`random bot: exceptions ${ex}, nan ${nan}`);
}

// extended fuzz: every action type, valid and invalid payloads, through Session.handle and checked for throw/NaN/determinism/replay
function randAction(r: ReturnType<typeof rng>, sc: Scenario): Action {
  const n = (lo: number, hi: number) => lo + r.next() * (hi - lo);
  const pick = <T,>(a: T[]): T => a[Math.floor(r.next() * a.length)]!;
  const L = sc.book.length;
  const t = pick(['call.speed', 'call.speed', 'call.turn', 'call.stop', 'call.go', 'call.go', 'pullUp', 'call.warn', 'call.identify', 'count', 'clock.read', 'watch.start', 'watch.lap', 'watch.mode', 'watch.reset', 'watch.recall', 'ledger.set', 'ta.request', 'ta.declare', 'scorecard.ack', 'speed.emergency', 'speed.resume', 'line.set', 'note', 'call.uturn', 'call.pass', 'call.pullover', 'bezel.set', 'speedo.setFactor', 'card.set', 'start', 'skipPreread', 'line.annotate', 'watch.stop']);
  switch (t) {
    case 'call.speed': return { type: 'call.speed', mph: Math.round(n(5, 60)) };
    case 'call.turn': return { type: 'call.turn', dir: pick(['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR', 'JL', 'JR'] as const) };
    case 'call.warn': return { type: 'call.warn', seconds: Math.round(n(1, 90)) };
    case 'call.identify': return { type: 'call.identify', text: 'sign' };
    case 'count': return { type: 'count', n: Math.round(n(-3, 12)) };
    case 'clock.read': return { type: 'clock.read', source: pick(['clock', 'stopwatch', undefined] as const) };
    case 'watch.mode': return { type: 'watch.mode', mode: pick(['chrono', 'tod', undefined] as const) };
    case 'watch.reset': return { type: 'watch.reset', force: r.chance(0.3) };
    case 'ledger.set': return r.chance(0.5) ? { type: 'ledger.set', seconds: Math.round(n(-40, 40)) } : { type: 'ledger.set', entries: [{ seconds: Math.round(n(-10, 10)), source: 'x' }, { seconds: 3, source: 'y' }] };
    case 'ta.request': return { type: 'ta.request', legIndex: Math.round(n(1, 7)), seconds: pick([0, 10, 30, 37, 90, 1770, 1780]), fromLine: Math.round(n(1, L)), toLine: Math.round(n(1, L)), password: pick([undefined, '1234']), carNumber: 5 };
    case 'ta.declare': return { type: 'ta.declare', seconds: pick([0, 10, 33, 90]), legIndex: pick([undefined, 1, 2]) };
    case 'speed.emergency': return { type: 'speed.emergency', mph: Math.round(n(5, 40)) };
    case 'line.set': return { type: 'line.set', n: Math.round(n(1, L)) };
    case 'note': return { type: 'note', text: 'n' };
    case 'bezel.set': return { type: 'bezel.set', seconds: Math.round(n(0, 59)) };
    case 'speedo.setFactor': return { type: 'speedo.setFactor', k: n(0.8, 1.2) };
    case 'card.set': return { type: 'card.set', card: { '35': 36 } };
    case 'skipPreread': return { type: 'skipPreread', secondsBefore: Math.round(n(0, 120)) };
    case 'line.annotate': return { type: 'line.annotate', n: Math.round(n(1, L)), text: 'a' };
    default: return { type: t } as Action;
  }
}
if (mode === 'fuzz' || mode === 'all') {
  const scs: Scenario[] = []; for (let s = 1; s <= 12; s++) { scs.push(s % 3 === 0 ? generateStage(s, { ...PROFILES.fullStage, asp: s % 4 }) : s % 3 === 1 ? generateLeg(s, { ...PROFILES.fullLeg, asp: 1 + (s % 3) }) : builtinScenario('varied', s)); }
  scs.forEach((sc, idx) => {
    const run = (): { sim: Simulator; replies: string[] } => {
      const sess = new Session(sc, { watch: idx % 2 ? 'digital' : 'analog' }); const r = rng(1000 + idx); const replies: string[] = [];
      for (let i = 0; i < 400 && sess.sim.phase !== 'finished'; i++) {
        if (i % 40 === 0) sess.handle({ type: 'act', action: { type: 'skipPreread', secondsBefore: 5 } });
        const a = randAction(r, sc);
        const rep = sess.handle(r.chance(0.1) ? { type: 'act', action: a, when: { elapsed: Math.round(r.next() * 10) } } : { type: 'act', action: a });
        replies.push(JSON.stringify(rep.type === 'ack' ? { ok: true } : rep));
        const rep2 = sess.handle({ type: 'advance', seconds: Math.round(r.next() * 20) });
        replies.push(JSON.stringify(rep2));
        if (rep2.type === 'error') problems.push(`fuzz scenario ${idx} (${sc.id}) step ${i}: ${rep2.message}`);
      }
      return { sim: sess.sim, replies };
    };
    try {
      const A = run(); const B = run();
      const ra = JSON.stringify(A.sim.result()), rb = JSON.stringify(B.sim.result());
      if (ra !== rb) problems.push(`fuzz scenario ${idx} (${sc.id}): result() differs between two identical runs`);
      if (A.replies.join('|') !== B.replies.join('|')) problems.push(`fuzz scenario ${idx} (${sc.id}): protocol replies differ between two identical runs`);
      const bad: string[] = []; scan(A.sim.result(), 'result', bad); scan(A.sim.observe({ peek: true }), 'obs', bad); if (bad.length) problems.push(`fuzz scenario ${idx} (${sc.id}): non-finite ${bad.slice(0, 5).join(', ')}`);
      // replay equals live: replay up to the live final tick
      const live = A.sim; const acts = live.actions;
      const rep = new Simulator(sc, { watch: idx % 2 ? 'digital' : 'analog' }); let i = 0; const sorted = [...acts].sort((a, b) => a.tick - b.tick);
      while (rep.tick < live.tick) { while (i < sorted.length && sorted[i]!.tick <= rep.tick) { rep.act(sorted[i]!.action); i++; } rep.step(0.1); }
      while (i < sorted.length && sorted[i]!.tick <= rep.tick) { rep.act(sorted[i]!.action); i++; }
      const rr = JSON.stringify(rep.result()); const rl = JSON.stringify(live.result());
      if (rr !== rl) { const a = JSON.parse(rl), b = JSON.parse(rr); const keys = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); problems.push(`fuzz scenario ${idx} (${sc.id}): replay != live, keys ${keys.join(',')}`); }
    } catch (e) { problems.push(`fuzz scenario ${idx} (${sc.id}) threw ${(e as Error).stack?.split('\n').slice(0, 3).join(' / ')}`); }
  });
  console.log('fuzz done');
  // hostile payloads: wrong types / ranges for every action; the session must answer with ack or error, never throw, and the state must stay finite
  const hostile: unknown[] = [null, 'x', 1e400, -1, NaN, 1e9, {}, [], true, '4', 0.5, -0, 2 ** 53];
  const keys = ['mph', 'dir', 'seconds', 'n', 'legIndex', 'fromLine', 'toLine', 'source', 'mode', 'k', 'text', 'card', 'entries', 'password', 'carNumber', 'witnesses', 'secondsBefore', 'force', 'phone', 'stage', 'cause'];
  const types = ['call.speed', 'call.turn', 'call.warn', 'call.identify', 'count', 'clock.read', 'watch.mode', 'watch.reset', 'watch.bezel', 'ledger.set', 'ta.request', 'ta.declare', 'speed.emergency', 'line.set', 'line.annotate', 'note', 'bezel.set', 'speedo.setFactor', 'card.set', 'skipPreread'];
  const rr = rng(777); let acks = 0, errs = 0;
  const sc = generateStage(5, { ...PROFILES.fullStage, asp: 2 }); const sess = new Session(sc, { watch: 'digital' });
  sess.handle({ type: 'act', action: { type: 'skipPreread', secondsBefore: 5 } }); sess.handle({ type: 'act', action: { type: 'start' } });
  for (let i = 0; i < 4000; i++) {
    const a: Record<string, unknown> = { type: types[Math.floor(rr.next() * types.length)] };
    for (const k of keys) if (rr.chance(0.25)) a[k] = hostile[Math.floor(rr.next() * hostile.length)];
    const rep = sess.handle({ type: 'act', action: a as unknown as Action }); if (rep.type === 'ack') { acks++; const bad = validateAction(a); if (bad) problems.push(`hostile ack despite invalid: ${JSON.stringify(a)}: ${bad}`); } else if (rep.type === 'error') errs++; else problems.push('hostile: odd reply ' + rep.type);
    if (i % 10 === 0) { const adv = sess.handle({ type: 'advance', seconds: 3 }); if (adv.type === 'error') problems.push(`hostile advance error after ${JSON.stringify(a)}: ${adv.message}`); }
  }
  { const bad: string[] = []; scan(sess.sim.result(), 'result', bad); scan(sess.sim.observe({ peek: true }), 'obs', bad); if (bad.length) problems.push(`hostile: non-finite ${bad.slice(0, 6).join(', ')}`); }
  console.log(`hostile: acks ${acks} errors ${errs} phase ${sess.sim.phase} tod ${sess.sim.tod}`);
}
console.log('PROBLEMS', problems.length); console.log(problems.join('\n'));

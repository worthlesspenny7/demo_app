/** RE-VALIDATION (education): D06 note grading, D15 annotations, D07 calibration, D12 benchmark stars. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { stopLoss, dwellFor, accelLoss } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';
import { calibrationFactor, cheatCard } from '../src/core/calibration.js';

const which = process.argv[2] ?? 'all';
const wrap = (inner: Bot, extra: (s: Simulator) => void): Bot => ({ name: 'w', onTick(s) { inner.onTick(s); extra(s); } });

if (which === 'all' || which === 'd06') {
  console.log('=== D06 truth (Ford stopLoss v->v):', [25, 35, 45].map(v => `${v}=${stopLoss(v, v, FORD_1939).toFixed(2)}`).join(' '), ' accelLoss35', accelLoss(35, FORD_1939).toFixed(2));
  const d = drillById('D06')!;
  const T = Object.fromEntries([25, 35, 45].map(v => [v, stopLoss(v, v, FORD_1939)]));
  const variants: Record<string, string[]> = {
    none: [],
    'exact "v = x.x"': [25, 35, 45].map(v => `${v} = ${T[v]!.toFixed(1)}`),
    'exact "v: x" one note': [`25: ${T[25]!.toFixed(1)}, 35: ${T[35]!.toFixed(1)}, 45: ${T[45]!.toFixed(1)}`],
    'exact "v mph x s"': [25, 35, 45].map(v => `${v} mph ${T[v]!.toFixed(1)} s`),
    'off by +0.8': [25, 35, 45].map(v => `${v} = ${(T[v]! + 0.8).toFixed(1)}`),
    'off by +1.5': [25, 35, 45].map(v => `${v} = ${(T[v]! + 1.5).toFixed(1)}`),
    'wrong by -3 (rookie: forgot loss)': [25, 35, 45].map(v => `${v} = ${(T[v]! - 3).toFixed(1)}`),
    'one right, two wrong': [`25 = ${T[25]!.toFixed(1)}`, '35 = 3', '45 = 15'],
    'constant 8 for all (no measuring)': [25, 35, 45].map(v => `${v} = 8`),
    'copy card example "35 = 7.6" only': ['35 = 7.6'],
    'three junk notes (old rubric = 3 stars)': ['a', 'b', 'c'],
    'ramp-time style "35 = 7.6 s ramp"': ['35 = 7.6 s'],
    'guess spam, 3 guesses at 35 (first wrong)': ['35 = 5', '35 = 6', '35 = 7.5'],
  };
  for (const [name, notes] of Object.entries(variants)) {
    const sc = d.scenario(1, 0); const sim = new Simulator(sc); const bot = wrap(new OracleBot(sim, { useWatch: true }), s => { if (s.phase === 'preread' && notes.length && !(s as any).__n) { (s as any).__n = 1; for (const t of notes) s.act({ type: 'note', text: t } as Action); } });
    const r = runBot(sim, bot); const rb = d.rubric(r, sc);
    console.log(`D06 ${name.padEnd(42)} stars=${rb.stars} | ${rb.headline} | ${rb.feedback.slice(1).join(' / ')}`);
  }
  const sc = d.scenario(1, 0); console.log('D06 scenario book lines:', sc.book.map(b => b.text).join(' | ').slice(0, 300), 'objective:', d.objective);
}

if (which === 'all' || which === 'd15') {
  const d = drillById('D15')!;
  console.log('=== D15');
  for (const t of [0, 2]) for (const s of [1, 2, 3, 4, 5]) {
    const sc = d.scenario(s, t);
    const pauses = sc.book.filter(b => b.pause); let v = sc.book[0]!.speed ?? 35; const info: string[] = [];
    for (const ins of sc.book) { const vIn = v; const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? v; if (ins.pause) info.push(`n${ins.n} p${ins.pause} turn=${ins.turn} ${vIn}->${vOut}`); v = ins.timed ? ins.timed.thenSpeed : vOut; }
    console.log(`D15 t${t} s${s}: ${sc.book.length} lines, ${pauses.length} pause lines [${info.join('; ')}] preread ${sc.prereadSeconds}s`);
  }
  // truth dwell as the BOT would compute it vs the rubric's ideal (turn 'S' check)
  const ideals = (sc: ReturnType<typeof d.scenario>) => { let v = sc.book[0]!.speed ?? 35; const out: { n: number; botIdeal: number; rubricIdeal: number; turn?: string }[] = [];
    for (const ins of sc.book) { const vIn = v; const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? v;
      if (ins.pause) {
        const ang = ins.turn ? ({ L: 90, R: 90, S: 0, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 } as any)[ins.turn] as number : 0;
        const botCap = ang >= 20 ? (ang > 120 ? sc.car.turnSpeedMph.acute : ang >= 60 ? sc.car.turnSpeedMph.turn : sc.car.turnSpeedMph.bear) : undefined;
        const rubCap = ins.turn ? (['BL', 'BR'].includes(ins.turn) ? sc.car.turnSpeedMph.bear : ['AL', 'AR'].includes(ins.turn) ? sc.car.turnSpeedMph.acute : sc.car.turnSpeedMph.turn) : undefined;
        out.push({ n: ins.n, turn: ins.turn, botIdeal: dwellFor(ins.pause, vIn || vOut, vOut, sc.car, botCap), rubricIdeal: dwellFor(ins.pause, vIn || vOut, vOut, sc.car, rubCap) });
      }
      v = ins.timed ? ins.timed.thenSpeed : vOut; }
    return out; };
  for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) console.log(`D15 ideal check s${s}:`, ideals(d.scenario(s, 0)).map(x => `n${x.n} ${x.turn ?? '-'} physical ${x.botIdeal.toFixed(1)} rubric ${x.rubricIdeal.toFixed(1)}`).join('; '));
  const modes: Record<string, (ideal: number) => string | null> = { none: () => null, 'correct number': i => i.toFixed(1), 'correct, text "go at 7.3s"': i => `go at ${i.toFixed(1)}s`, 'off by 1.5 s': i => (i + 1.5).toFixed(1), 'off by 3 s': i => (i + 3).toFixed(1), 'printed pause (rookie error)': () => 'P', 'junk "x"': () => 'x', 'empty string': () => '', 'wrong dwell 0': () => '0' };
  for (const t of [0, 2]) for (const [name, fn] of Object.entries(modes)) {
    const stars: number[] = []; const hd: string[] = [];
    for (const s of [1, 2, 3, 4, 5]) {
      const sc = d.scenario(s, t); const sim = new Simulator(sc); const idl = ideals(sc);
      const inner = new OracleBot(sim, { useWatch: true }); let done = false;
      const bot = wrap(inner, ss => { if (done) return; done = true; for (const x of idl) { let txt = fn(x.botIdeal); if (txt === 'P') txt = String(sc.book.find(b => b.n === x.n)!.pause); if (txt !== null) ss.act({ type: 'line.annotate', n: x.n, text: txt } as Action); } });
      const r = runBot(sim, bot); const rb = d.rubric(r, sc); stars.push(rb.stars); if (s === 1) hd.push(rb.headline);
    }
    console.log(`D15 t${t} ${name.padEnd(32)} stars=${stars.join('/')} | ${hd[0]}`);
  }
}

if (which === 'all' || which === 'd07') {
  console.log('=== D07/D17 calibration');
  for (const id of ['D07', 'D17']) {
    const d = drillById(id)!;
    for (const t of [0, 1, 2]) for (const mode of ['oracle(recovery,no k)', 'noRecovery,no k', 'noRecovery,k from true gain', 'noRecovery,k from calibration run']) {
      const stars: number[] = []; const legs: string[] = []; const gains: string[] = [];
      for (const s of [1, 2, 3, 4, 5]) {
        const sc = d.scenario(s, t); const sim = new Simulator(sc, { useCard: false });
        const inner = new OracleBot(sim, mode.startsWith('oracle') ? { useWatch: true } : { useWatch: true, noRecovery: true });
        let applied = false;
        const bot = wrap(inner, ss => {
          if (applied) return;
          if (mode === 'noRecovery,k from true gain') { applied = true; const k = 1 / sc.speedo.gain; ss.act(sc.speedo.kind === 'timewise' ? { type: 'speedo.setFactor', k } as Action : { type: 'card.set', card: cheatCard(k) } as Action); }
          else if (mode === 'noRecovery,k from calibration run') {
            const cal = ss.sc.book.filter(b => b.section === 'calibration' && b.perfectCumulative !== undefined); const ev = ss.events.filter(e => e.type === 'node' && cal.some(c => c.nodeId === e.detail?.nodeId));
            if (cal.length < 2 || ev.length < cal.length) return; applied = true;
            const iv = []; for (let i = 1; i < cal.length; i++) iv.push({ perfect: cal[i]!.perfectCumulative! - cal[i - 1]!.perfectCumulative!, actual: ev[i]!.tod - ev[i - 1]!.tod });
            const k = calibrationFactor(iv); ss.act(sc.speedo.kind === 'timewise' ? { type: 'speedo.setFactor', k } as Action : { type: 'card.set', card: cheatCard(k) } as Action);
          }
        });
        const r = runBot(sim, bot); const rb = d.rubric(r, sc); stars.push(rb.stars); legs.push(`[${r.score.legs.map(l => Math.round(l.error ?? 0)).join(',')}]`); gains.push(sc.speedo.gain.toFixed(3));
      }
      console.log(`${id} t${t} ${mode.padEnd(36)} stars=${stars.join('/')} legs ${legs.join(' ')} gains ${gains.join(' ')}`);
    }
  }
}

if (which === 'all' || which === 'd12') {
  console.log('=== D12 benchmark stars');
  const d = drillById('D12')!;
  const rows: string[] = [];
  for (const lat of [0, 0.5, 1, 1.5, 2.5, 4]) for (const s of [1, 2]) {
    const sc = d.scenario(s, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true, latency: lat || undefined }));
    const rb = d.rubric(r, sc); rows.push(`lat ${lat} s${s}: raw ${r.score.raw} (${r.score.benchmark}) oc${r.offCourseCount} -> ${rb.stars}*`);
  }
  console.log(rows.join('\n'));
  // direct threshold probe with synthetic raw values
  const sc = d.scenario(1, 0); const sim = new Simulator(sc); const base = runBot(sim, new OracleBot(sim, { useWatch: true }));
  for (const raw of [0, 13, 13.5, 14, 25, 26, 46, 47, 100]) { const fake = { ...base, offCourseCount: 0, score: { ...base.score, raw } } as typeof base; console.log(`synthetic raw ${raw} -> ${d.rubric(fake, sc).stars}*`); }
  const fake2 = { ...base, offCourseCount: 2, score: { ...base.score, raw: 5 } } as typeof base; console.log('raw 5 with 2 off-course ->', d.rubric(fake2, sc).stars + '*');
  console.log('D12 feedback:', d.rubric(base, sc).feedback.join(' || '));
}

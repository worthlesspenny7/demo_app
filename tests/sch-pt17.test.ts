/** PT-17 fix sprint (SCH-028..037): the newcomer replay's top ten, engine and content parts. DOM parts: e2e/school-pt17.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE, STOP_EXAMPLE, TERM_MODULE, EARLY_RULE, moduleRule, pageText, FIGURES } from '../content/course.js';
import type { MinisimPage, Page } from '../content/course-types.js';
import { words } from '../content/rules.js';
import { miniSim, tryItPlan, tryItStars, tryItPassed, runKinds, registerCourse, POINTER_OF_CONTROL, DecisionRun, SIGN_FORMS, type Decision, type DecisionKind, type Verdict } from '../src/core/decision/index.js';
import { signCaseMiss } from '../src/core/decision/runner.js';
import { stopLoss } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';
import { verdictParts, ruleWithoutSource } from '../src/ui/mobile/cards.js';
import { figureSvg } from '../src/ui/school2/figures.js';
import { newcomerLanding } from '../src/ui/school2/progress.js';
import { schoolRedirect } from '../src/ui/school2/sources.js';
import { HOLD_SECONDS, WhereCheckpointModel } from '../src/ui/school2/widget-models.js';

registerCourse(COURSE);
const read = (p: string): string => readFileSync(p, 'utf8');
type Sim = { m: typeof COURSE[number]; mi: number; pi: number; p: MinisimPage; at: string };
const sims: Sim[] = COURSE.flatMap((m, mi) => m.pages.flatMap((p, pi) => p.kind === 'minisim' ? [{ m, mi, pi, p: p as MinisimPage, at: `${m.id} page ${pi + 1}` }] : []));
const roundsOf = (p: MinisimPage): MinisimPage[] => [p, ...(p.rounds ?? []).map(r => ({ ...p, ...r, rounds: undefined }))];
function cardOf(p: Pick<MinisimPage, 'decisionKind' | 'seed' | 'control' | 'variant' | 'form' | 'pointer'>): { d: Decision; run: ReturnType<typeof miniSim> } {
  const run = miniSim(p.decisionKind, p.seed, { control: p.control, ...(p.variant !== undefined ? { variant: p.variant } : {}), ...(p.form ? { form: p.form } : {}), ...(p.pointer ? { pointer: p.pointer } : {}) });
  let s = run.next(); while (s && s.type === 'rule') { run.ack(); s = run.next(); }
  if (!s || s.type !== 'decision') throw new Error(`${p.decisionKind} ${p.seed}: no card`);
  return { d: s.decision, run };
}
/** Every verdict a card can give: each option, or the oracle tap, a late tap and no tap. */
function verdictsOf(p: Pick<MinisimPage, 'decisionKind' | 'seed' | 'control' | 'variant' | 'form' | 'pointer'>): { d: Decision; vs: Verdict[] } {
  const { d } = cardOf(p); const vs: Verdict[] = [];
  const answers = d.options?.length ? d.options.map(o => ({ optionId: o.id }))
    : d.timing?.kind === 'startStop' ? [{ taps: [d.timing.truthSeconds, d.timing.secondTapSeconds ?? d.timing.truthSeconds] }, { taps: [d.timing.truthSeconds + 4, (d.timing.secondTapSeconds ?? 0) + 6] }, null]
    : d.timing ? [{ tapSeconds: d.timing.truthSeconds }, { tapSeconds: d.timing.truthSeconds + 5 }, { tapSeconds: Math.max(0, d.timing.truthSeconds - 4) }, null] : [];
  for (const a of answers) { const { run } = cardOf(p); vs.push(run.answer(a)); }
  return { d, vs };
}
const pointerOf = (p: MinisimPage): string => p.pointer ?? POINTER_OF_CONTROL[p.control];
const done = (...ids: string[]) => ({ modulesDone: ids, pages: {}, tryItStars: {} });
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(f) ? [p] : []; });

describe('SCH-028 Start starts the clock', () => {
  it('SCH-028 the tap-watch calls onStart (which moves the card time origin to the Start tap) before it takes t0, in the mini-sim and the run screen', () => {
    const tw = read('src/ui/mobile/tapwatch.ts');
    const begin = /const begin = \(\): void => \{([^\n]*)\};/.exec(tw)![1]!;
    expect(begin.indexOf('o.onStart?.()')).toBeGreaterThanOrEqual(0);
    expect(begin.indexOf('o.onStart?.()')).toBeLessThan(begin.indexOf('t0 = now()'));
    for (const f of ['src/ui/school2/minisim.ts', 'src/ui/mobile/run.ts']) {
      const s = read(f);
      expect(s, f).toMatch(/const cardNow = \(\): number => (miniView|view)\.shownAt \+ (miniCardSeconds\(now\)|cardSeconds\(\))/);
      expect(s, f).toMatch(/const onStart = \(\): void => \{ (miniView|view)\.shownAt = (now|wallSeconds)\(\); (miniView|view)\.started = true;/);
      expect(s.match(/now: cardNow/g)?.length, f).toBe(2);
    }
  });
});

describe('SCH-029 Module 1 trap wrong-answer lines', () => {
  it('SCH-029 every Module 1 sign case: each wrong answer names its own trap and quotes that row\'s Column C; no "one item per line" rule', () => {
    const m1 = COURSE[1]!; const cases = m1.pages.flatMap(p => p.kind === 'minisim' ? roundsOf(p as MinisimPage).filter(x => x.form?.startsWith('sign:')) : []);
    expect(cases.map(c => c.form)).toEqual([...SIGN_FORMS]);
    const lines = new Set<string>();
    for (const c of cases) {
      const { d, vs } = verdictsOf(c); const col = d.context.row?.columnC.join(' ').trim() ?? '';
      const wrong = vs.filter(v => !v.correct); expect(wrong.length, c.form).toBeGreaterThanOrEqual(2);
      for (const v of wrong) {
        const rule = ruleWithoutSource(v.rule, v.source);
        expect(rule, c.form).not.toMatch(/one item per line|40 MPH\.?$/);
        expect(rule, c.form).toContain(col ? `"${col}"` : 'nothing');
        if (c.form !== 'sign:normal') { expect(rule, c.form).toMatch(/^Trap: the /); expect(v.missed, c.form).toBeTruthy(); }
        lines.add(rule.replace(/"[^"]*"|\d+|SPEED LIMIT \d+|WELCOME TO [A-Z ]+/g, ''));
      }
    }
    expect(lines.size).toBe(SIGN_FORMS.length);   // one line per case: each names its own trap
    // the posted-limit case: picking the sign's number quotes Column C's other speed
    const lim = cardOf({ ...(cases[1]!), control: 'book' }); const posted = /SPEED LIMIT (\d+)/.exec(lim.d.prompt)![1]!;
    const v = lim.run.answer({ optionId: `v${posted}` }); expect(v.correct).toBe(false);
    expect(ruleWithoutSource(v.rule, v.source)).toContain(`"${lim.d.context.row!.columnC.join(' ')}"`); expect(ruleWithoutSource(v.rule, v.source)).not.toContain(`"${posted} MPH"`);
    expect(signCaseMiss(undefined, { colC: '25 MPH', truth: 25, held: 30, sign: '', remark: '' }).rule).toContain('"25 MPH"');
  });
});

describe('SCH-030 Module 4 is one car', () => {
  it('SCH-030 the worked example comes from the engine (stopLoss of the cards\' car) and every School pause card agrees with it to 0.1 s; m4 p3 is the example\'s 30 -> 40 card', () => {
    for (const x of STOP_EXAMPLE) expect(x.sit).toBe(Math.round((15 - stopLoss(x.vIn, x.vOut, FORD_1939)) * 10) / 10);
    expect(read('content/course.ts')).toMatch(/sit: Math\.round\(\(15 - stopLoss\(vIn, vOut, FORD_1939\)\) \* 10\) \/ 10/);
    const sitOf = (d: Decision): number => Number(/sit ([\d.]+) s/.exec(d.prompt)![1]);
    const pauseSims = sims.filter(s => s.p.decisionKind === 'pause');
    expect(pauseSims.length).toBeGreaterThanOrEqual(5);
    for (const s of pauseSims) {
      expect(s.p.form, s.at).toBe('straight');
      const { d } = cardOf(s.p); const io = d.context.speeds!; const pause = Number(/Pause (\d+) s/.exec(d.prompt)![1]);
      expect(sitOf(d), s.at).toBeCloseTo(Math.round((pause - stopLoss(io.in!, io.out!, FORD_1939)) * 10) / 10, 5);
      const ex = STOP_EXAMPLE.find(x => x.vIn === io.in && x.vOut === io.out); if (ex && pause === 15) expect(sitOf(d), s.at).toBe(ex.sit);
    }
    const p3 = COURSE[4]!.pages[2] as MinisimPage; expect(p3.kind).toBe('minisim');
    const { d } = cardOf(p3); expect(d.context.speeds).toMatchObject({ in: STOP_EXAMPLE[0]!.vIn, out: STOP_EXAMPLE[0]!.vOut }); expect(sitOf(d)).toBe(STOP_EXAMPLE[0]!.sit);
    expect(pageText(COURSE[4]!.pages[1]!)).toContain(`sit ${STOP_EXAMPLE[0]!.sit.toFixed(1)} s`); expect(figureSvg('chart-cell')).toContain(`sit ${STOP_EXAMPLE[0]!.sit.toFixed(1)} s`);
    // equal speeds lose the same on every School pause card (m2, m4, m12 try-its use the straight form too)
    for (const id of ['m2', 'm4', 'm12']) {
      const m = COURSE.find(x => x.id === id)!; expect(m.tryIt.forms?.pause, id).toBe('straight');
      for (let seed = 1; seed <= 6; seed++) {
        const run = new DecisionRun(tryItPlan(m, seed));
        for (let i = 0; i < 12; i++) {
          const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
          const dd = st.decision;
          if (dd.kind === 'pause') { const io = dd.context.speeds!; const pause = Number(/Pause (\d+) s/.exec(dd.prompt)![1]); expect(sitOf(dd), `${id} ${seed}`).toBeCloseTo(Math.round((pause - stopLoss(io.in!, io.out!, FORD_1939)) * 10) / 10, 5); }
          run.answer(run.oracle());
        }
      }
    }
  });
});

describe('SCH-031 try-it stars', () => {
  it('SCH-031 stars come from correct answers: 0 of 5 is 0, 3 stars needs 5 of 5 or 4 of 5 within tolerance; below 3 of 5 the primary is Try again; recaps say correct', () => {
    expect(tryItStars({ correct: 0, total: 5, secondsTotal: 0 })).toBe(0);
    expect(tryItStars({ correct: 0, total: 5, secondsTotal: 6.5 })).toBe(0);
    expect(tryItStars({ correct: 5, total: 5, secondsTotal: 30 })).toBe(3);
    expect(tryItStars({ correct: 4, total: 5, secondsTotal: 3 })).toBe(3);
    expect(tryItStars({ correct: 4, total: 5, secondsTotal: 40 })).toBe(2);
    expect(tryItStars({ correct: 3, total: 5, secondsTotal: 2 })).toBe(2);
    expect(tryItStars({ correct: 2, total: 5, secondsTotal: 2 })).toBe(1);
    expect(tryItPassed({ correct: 2, total: 5 })).toBe(false); expect(tryItPassed({ correct: 3, total: 5 })).toBe(true);
    const t = read('src/ui/school2/tryit.ts');
    expect(t).toMatch(/recordTryIt\(id, core\.tryItStars\(r\)\)/); expect(t).toMatch(/passed \? 'Again' : 'Try again'/); expect(t).toMatch(/\.\.\.\(passed \? \[again, next\] : \[next, again\]\)/);
  });
  it('SCH-021 SCH-031 recap and "you can now" strings never use "right" (try-it and run recaps say "N of M correct")', () => {
    for (const f of ['src/ui/school2/tryit.ts', 'src/ui/mobile/recap.ts']) { const s = read(f); expect(s, f).not.toMatch(/\bright\b/); expect(s, f).toMatch(/of \$\{r\.total\} correct/); }
    for (const m of COURSE) expect(m.youCanNow, m.id).not.toMatch(/\bright\b/i);
    for (const p of walk('src/ui')) { const s = read(p); expect(s.match(/of \$\{[^}]*total\} right/g), p).toBeNull(); }
  });
});

describe('SCH-032 widgets behind Start', () => {
  it('SCH-022 SCH-032 holdSpeed, whereCheckpoint and tapLap show the goal and a Start in place of their control; nothing steps or counts before it', () => {
    const w = read('src/ui/school2/widgets.ts');
    expect(w).toMatch(/export function startGate\(/);
    expect(w).toMatch(/startGate\(slider, \(\) => \{ started = true;/); expect(w).toMatch(/if \(started\) m\.step\(/);
    expect(w).toMatch(/startGate\(btn, \(\) => \{ started = true; t0 = now\(\); \}\)/); expect(w).toMatch(/btn\.onclick = \(\) => \{ if \(started\) finish/);
    expect(w).toMatch(/startGate\(lapBtn, \(\) => \{ started = true; t0 = now\(\); \}\)/); expect(w).toMatch(/if \(!started\) return;\n\s+const t = now\(\) - t0; if \(m\.lap\(t\)/);
    expect(w.match(/const t = started \? now\(\) - t0 : 0;/g)?.length).toBe(2);
    expect(w).toMatch(/if \(page\.params\.goal\) host\.append/);   // the instructions come first
    // a run's call with a deadline (turn cards) waits under Start too: options disabled, the bar and its timer start on the tap
    const r = read('src/ui/mobile/run.ts'); expect(r).toMatch(/btns\.forEach\(b => \{ b\.disabled = true; \}\)/); expect(r).toMatch(/go\.onclick = \(ev\) => \{\s+ev\.preventDefault\(\); go\.remove\(\); view\.started = true;/); expect(r).toMatch(/timers\.push\(window\.setTimeout\(\(\) => submit\(null\), secs \* 1000\)\)/);
  });
});

describe('SCH-033 a newcomer\'s second visit', () => {
  it('SCH-033 opening the page consumes nothing: the bare page lands on the School until Module 0 is done; no runs or drills played', () => {
    expect(newcomerLanding(null, null)).toEqual({ school: true, first: true });
    const dec = (o: object): string => JSON.stringify({ version: 1, runs: 0, ...o });
    expect(newcomerLanding(null, dec({ course: { modulesDone: [], pages: {}, tryItStars: {} } }))).toEqual({ school: true, first: true });   // opened, nothing reached
    expect(newcomerLanding(null, dec({ course: { modulesDone: [], pages: { m0: 3 }, tryItStars: {} } }))).toEqual({ school: true, first: false });   // mid Module 0: continue
    expect(newcomerLanding(null, dec({ course: { modulesDone: ['m0'], pages: { m0: 8 }, tryItStars: { m0: 2 } } })).school).toBe(false);
    expect(newcomerLanding(null, dec({ runs: 2 })).school).toBe(false);
    expect(newcomerLanding(JSON.stringify({ drills: { D01: { stars: 1 } } }), null).school).toBe(false);
    expect(newcomerLanding(JSON.stringify({ drills: {}, lessons: {} }), null).school).toBe(true);
    expect(read('src/ui/main.ts')).toMatch(/newcomerLanding\(localStorage\.getItem\(PROGRESS_KEY\), localStorage\.getItem\(DECISION_PROGRESS_KEY\)\)/);
  });
  it('SCH-013 SCH-033 a visitor with no course progress draws only Module 0-6 kinds in daily and skill runs', () => {
    const core = runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'))!;
    for (const c of [null, undefined, done()]) {
      const k = runKinds(c)!; expect(k).not.toBeNull(); expect([...k].sort()).toEqual([...core].sort());
      for (const bad of ['ta', 'lost', 'transitOut', 'makeup', 'hazard'] as DecisionKind[]) expect(k).not.toContain(bad);
    }
    expect(read('src/ui/mobile/engine.ts')).toMatch(/runKinds/); expect(read("src/ui/mobile/engine.ts")).toMatch(/\?\.course \?\? null\)/);
  });
});

describe('SCH-034 option verdicts show no seconds in the School', () => {
  it('SCH-034 verdictParts noSeconds drops the seconds; the mini-sim and the try-it pass it for cards without a timer', () => {
    const v: Verdict = { decisionId: 'x', kind: 'preread', skill: 'safetyCourse', secondsDelta: 65.5, correct: false, rule: 'Follow the arrow (HB).', ruleId: 'R', source: 'HB', expected: 'Left', chosen: 'Right', missed: 'the bold arrow', nextDecisionIn: null };
    expect(verdictParts(v, { noSeconds: true }).seconds).toBe(''); expect(verdictParts(v).seconds).toBe('+65.5 s');
    expect(verdictParts(v, { noSeconds: true }).head).toBe('Not quite: the bold arrow');
    expect(read('src/ui/school2/minisim.ts')).toMatch(/verdictParts\(v, \{ noSeconds: !miniView\.decision\?\.timing \}\)/);
    expect(read('src/ui/mobile/run.ts')).toMatch(/verdictParts\(v, \{ noSeconds: !!session\.courseTry && !view\.decision\?\.timing \}\)/);
  });
});

describe('SCH-035 teach before ask', () => {
  it('SCH-035 m5 lap + hold - lead comes after "Timed holds"; m10 OUT after "Exact transits"; m6 p8 tests the queue; m9 p7 asks the leg its page teaches', () => {
    const idx = (m: number, re: RegExp): number => COURSE[m]!.pages.findIndex(p => re.test(pageText(p)) && p.kind === 'concept');
    const m5 = COURSE[5]!.pages; const lap = m5.findIndex(p => p.kind === 'minisim' && p.decisionKind === 'watch');
    expect(idx(5, /^Timed holds/)).toBeGreaterThanOrEqual(0); expect(idx(5, /^Timed holds/)).toBeLessThan(lap);
    const m10 = COURSE[10]!.pages; const out = m10.findIndex(p => p.kind === 'minisim' && p.decisionKind === 'transitOut');
    expect(idx(10, /^Exact transits/)).toBeLessThan(out);
    const q = COURSE[6]!.pages[7] as MinisimPage; expect(q.kind).toBe('minisim'); expect(q.form).toBe('queue');
    const answers = new Map<string, string>();
    for (const r of roundsOf(q)) {
      const { d, run } = cardOf(r); expect(d.prompt).toMatch(/car ahead/); expect(d.options!.length).toBe(4);
      const o = run.oracle()!; answers.set(r.why, o.optionId!);
      const wrong = d.options!.find(x => x.id !== o.optionId)!; const v = cardOf(r).run.answer({ optionId: wrong.id }); expect(v.correct).toBe(false); expect(v.ruleId).toBe('RULE-013');
    }
    expect([...answers.values()].sort()).toEqual(['around', 'wait']);   // wait for the car ahead; go around one that sits past its minute
    const ta = COURSE[9]!.pages[6] as MinisimPage; expect(ta.form).toBe('taLeg'); expect(pageText(COURSE[9]!.pages[5]!)).toMatch(/checkpoints passed plus one/);
    for (const seed of [ta.seed, ta.seed + 1, ta.seed + 2]) {
      const { d, run } = cardOf({ ...ta, seed }); const passed = Number(/You passed (\d+) checkpoint/.exec(d.prompt)![1]);
      expect(run.oracle()!.optionId).toBe(`l${passed + 1}`); expect(ta.why).toMatch(/checkpoints passed plus one/);
    }
  });
});

describe('SCH-036 module-aware words', () => {
  it('SCH-036 no term (Dec/Acc, half a ramp, chrono, pre-read) appears in a page, pointer, card prompt or verdict before the module that introduces it', () => {
    const bad: string[] = [];
    const scan = (text: string, mi: number, where: string): void => { for (const [term, tm] of Object.entries(TERM_MODULE)) if (mi < tm && text.toLowerCase().includes(term.toLowerCase())) bad.push(`${where}: "${term}" (module ${tm}) in ${text}`); };
    COURSE.forEach((m, mi) => {
      m.pages.forEach((p, pi) => scan(pageText(p), mi, `${m.id} p${pi + 1}`));
      scan(`${m.teaches} ${m.youCanNow}`, mi, `${m.id} lines`);
      for (const s of sims.filter(x => x.mi === mi)) for (const r of roundsOf(s.p)) {
        scan(pointerOf(r), mi, `${s.at} pointer`);
        const { d, vs } = verdictsOf(r); scan(`${d.prompt} ${(d.options ?? []).map(o => o.label).join(' ')}`, mi, `${s.at} card`);
        for (const v of vs) scan(moduleRule(ruleWithoutSource(v.rule, v.source), v.kind, mi), mi, `${s.at} verdict`);
      }
      for (let seed = 1; seed <= 4; seed++) {   // the try-it's cards and verdicts
        const plan = tryItPlan(m, seed); const run = new DecisionRun(plan);
        for (let i = 0; i < 10; i++) {
          const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
          const d = st.decision; scan(`${d.prompt} ${(d.options ?? []).map(o => o.label).join(' ')}`, mi, `${m.id} try-it card`);
          const o = run.oracle(); const wrongResp = d.options?.length ? { optionId: d.options.find(x => x.id !== o?.optionId)!.id } : null;
          const v = run.answer(wrongResp); scan(moduleRule(ruleWithoutSource(v.rule, v.source), v.kind, mi), mi, `${m.id} try-it verdict`);
        }
      }
    });
    expect(bad).toEqual([]);
    expect(Object.keys(EARLY_RULE).sort()).toEqual(['pause', 'speedChange']);
    expect(read('src/ui/school2/minisim.ts')).toMatch(/moduleRule\(vp\.rule, v\.kind, env\.moduleIndex/); expect(read('src/ui/mobile/run.ts')).toMatch(/moduleRule\(vp\.rule, v\.kind, moduleIndex\(session\.courseTry\)\)/);
  });
  it('SCH-036 "pre-read" is explained once, on the first page that uses it (Module 1 page 1), before any card says it', () => {
    const uses = COURSE.flatMap((m, mi) => m.pages.flatMap((p, pi) => /pre-?read/i.test(pageText(p)) ? [{ mi, pi, p }] : []));
    expect(uses[0]!.mi).toBe(1); expect(uses[0]!.pi).toBe(0); expect(uses[0]!.p.kind).toBe('concept');
    expect(pageText(uses[0]!.p)).toMatch(/is the pre-read/);
    expect(COURSE.flatMap(m => m.pages).filter(p => /is the pre-read/.test(pageText(p))).length).toBe(1);
    const firstCard = sims.find(s => s.p.decisionKind === 'preread')!; expect(firstCard.mi).toBe(1); expect(firstCard.pi).toBeGreaterThan(0);
  });
});

describe('SCH-037 newcomer polish', () => {
  /** PT-17's time model: 200 wpm on every word shown (pages, card prompts and options, the why, one miss rule per case), 1.5 s per
   *  navigation tap, 3 s per choice, the widgets' real durations, two 5-card try-its. */
  function minutes(mods: typeof COURSE): number {
    let w = 0; let s = 0;
    mods.forEach((m, mi) => {
      for (const p of m.pages) {
        s += 1.5;
        if (p.kind === 'minisim') for (const r of roundsOf(p as MinisimPage)) {
          const { d, vs } = verdictsOf(r); const miss = vs.find(v => !v.correct);
          w += words(d.prompt) + (d.options ?? []).reduce((a, o) => a + words(o.label), 0) + words(r.why) + (miss ? words(moduleRule(ruleWithoutSource(miss.rule, miss.source), miss.kind, mi)) : 0);
          s += 3 + 3 + 1.5 + (d.timing ? d.timing.truthSeconds + 2 : 0);
        } else w += words(pageText(p));
        if (p.kind === 'check') s += 3;
        if (p.kind === 'widget') s += p.widget === 'holdSpeed' ? HOLD_SECONDS + 6 : p.widget === 'whereCheckpoint' ? new WhereCheckpointModel(p.params.speed ?? 30, p.params.miles ?? 0.1).perfect + 3 : 20;
      }
      for (let i = 0; i < 5; i++) { const st = new DecisionRun(tryItPlan(m, i + 1)); let x = st.next(); while (x && x.type === 'rule') { st.ack(); x = st.next(); } if (x?.type === 'decision') { const v = st.answer(st.oracle()); w += words(x.decision.prompt) + (x.decision.options ?? []).reduce((a, o) => a + words(o.label), 0) + words(ruleWithoutSource(v.rule, v.source)); s += 3 + 1.5; } }
      w += words(m.youCanNow); s += 3;
    });
    return w / 200 + s / 60;
  }
  it('SCH-037 Modules 0 + 1 take under 10 minutes at 200 wpm (all six traps kept); m4 p1 under 70 words; m5 p3 sentence case', () => {
    const t = minutes(COURSE.slice(0, 2)); console.log(`Modules 0 + 1: ${t.toFixed(2)} min`); expect(t).toBeLessThan(10);
    expect(COURSE[1]!.pages.flatMap(p => p.kind === 'minisim' ? roundsOf(p as MinisimPage).map(r => r.form).filter(Boolean) : []).length).toBe(7);
    expect(words(pageText(COURSE[4]!.pages[0]!))).toBeLessThan(70);
    for (const m of COURSE) for (const p of m.pages) if (p.kind === 'concept') expect(p.words, `${m.id} ${p.title}`).not.toMatch(/[.!?] [a-z]/);
  });
  it('SCH-037 every concept figure is drawn (two seats on Module 0\'s three parties); old ids and rule ids redirect to a module, anything else to the module list', () => {
    for (const m of COURSE) for (const p of m.pages as Page[]) if (p.kind === 'concept' && p.figure) { expect(FIGURES[p.figure], p.figure).toBeDefined(); expect(figureSvg(p.figure), `${m.id} ${p.title} ${p.figure}`).not.toBe(''); }
    const parties = COURSE[0]!.pages.find(p => p.kind === 'concept' && p.title === 'Three parties') as { figure?: string };
    expect(parties.figure).toBe('two-seats'); expect(figureSvg('two-seats')).toMatch(/navigator/);
    expect(schoolRedirect('ice-calls')).toBe('#/school/m2');
    expect(schoolRedirect('protocol')).toBe('#/school/m2');
    expect(schoolRedirect('RULE-013')).toBe('#/school/m10');
    expect(schoolRedirect('nonsense')).toBe('#/school/modules');
    expect(read('content/videos.ts')).toMatch(/url/);   // video URL plumbing untouched
  });
});

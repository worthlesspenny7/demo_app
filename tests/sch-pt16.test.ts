/** PT-16 fix sprint (SCH-011..020): the newcomer playtest's top ten, engine and content parts. DOM parts: e2e/school-pt16.spec.ts. */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { COURSE, FIRST_VISIT, STOP_EXAMPLE, pageText, pageWords, controlsThrough } from '../content/course.js';
import type { MinisimPage } from '../content/course-types.js';
import { EXCERPTS } from '../content/excerpts.js';
import { RULES, words } from '../content/rules.js';
import { miniSim, tryItPlan, runKinds, registerCourse, POINTER_OF_CONTROL, cardPointer, Scheduler, DecisionRun, playRun, randomAnswerer, oracleAnswerer, SKILLS, verdictRule, type Decision, type DecisionKind } from '../src/core/decision/index.js';
import { microSubcase } from '../src/core/decision/scenarios.js';
import { stopLoss } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';
import { CONTROL_LABEL } from '../src/ui/school2/sources.js';
import { sourceKeys } from '../src/ui/school2/sheet.js';
import { verdictParts, ruleWithoutSource, cueState } from '../src/ui/mobile/cards.js';
import { controlsOf } from '../src/ui/mobile/guided.js';
import { swallowGestureClick, swallowedClicks } from '../src/ui/mobile/tapwatch.js';
import { TRY_AGAIN_ARM_MS } from '../src/ui/school2/minisim.js';
import { WhereCheckpointModel } from '../src/ui/school2/widget-models.js';
import { figureSvg } from '../src/ui/school2/figures.js';

registerCourse(COURSE);
const read = (p: string): string => readFileSync(p, 'utf8');
const sims = COURSE.flatMap((m, mi) => m.pages.flatMap((p, pi) => p.kind === 'minisim' ? [{ m, mi, p: p as MinisimPage, at: `${m.id} page ${pi + 1}` }] : []));
function cardOf(p: MinisimPage): { d: Decision; run: ReturnType<typeof miniSim> } {
  const run = miniSim(p.decisionKind, p.seed, { control: p.control, ...(p.variant !== undefined ? { variant: p.variant } : {}), ...(p.form ? { form: p.form } : {}), ...(p.pointer ? { pointer: p.pointer } : {}) });
  let s = run.next(); while (s && s.type === 'rule') { run.ack(); s = run.next(); }
  if (!s || s.type !== 'decision') throw new Error(`${p.decisionKind} ${p.seed}: no card`);
  return { d: s.decision, run };
}
const pointerOf = (p: MinisimPage): string => p.pointer ?? POINTER_OF_CONTROL[p.control];
const done = (...ids: string[]) => ({ modulesDone: ids, pages: {}, tryItStars: {} });

describe('SCH-011 touch: the verdict survives the tap that produced it', () => {
  const g = globalThis as unknown as { document?: unknown };
  const had = 'document' in g; const old = g.document;
  afterEach(() => { if (had) g.document = old; else delete g.document; });
  it('SCH-011 after a touch pointerdown on the tap-watch the next click of the gesture is swallowed (a mouse click is not); Try again arms after 400 ms', () => {
    const doc = new EventTarget(); g.document = doc;
    let reached = 0; doc.addEventListener('click', () => { reached++; });
    const before = swallowedClicks;
    swallowGestureClick({ pointerType: 'touch' } as unknown as Event);
    const c1 = new Event('click', { cancelable: true }); doc.dispatchEvent(c1);
    expect(c1.defaultPrevented).toBe(true); expect(swallowedClicks).toBe(before + 1);
    const c2 = new Event('click', { cancelable: true }); doc.dispatchEvent(c2);   // the explicit second tap goes through
    expect(c2.defaultPrevented).toBe(false); expect(reached).toBeGreaterThanOrEqual(1);
    swallowGestureClick({ pointerType: 'mouse' } as unknown as Event);
    const c3 = new Event('click', { cancelable: true }); doc.dispatchEvent(c3); expect(c3.defaultPrevented).toBe(false);
    expect(TRY_AGAIN_ARM_MS).toBe(400);
    const src = read('src/ui/school2/minisim.ts');
    expect(src).toMatch(/'data-action': 'try-again', disabled: ''/); expect(src).toMatch(/again\.disabled = false; \}, TRY_AGAIN_ARM_MS/);
    expect(read('src/ui/mobile/tapwatch.ts').match(/swallowGestureClick\(ev\)/g)?.length).toBe(2);
  });
});

describe('SCH-012 pointers say what is graded', () => {
  it('SCH-012 callAtMark names the call half a ramp before the Mark at the tick, in CONTROL_LABEL, the engine pointer and the m5 why lines', () => {
    const want = 'Tap CALL half a ramp before the Mark, when the bar reaches the tick.';
    expect(CONTROL_LABEL.callAtMark).toBe(want); expect(POINTER_OF_CONTROL.callAtMark).toBe(want);
    const m5 = COURSE[5]!; const why = m5.pages.flatMap(p => p.kind === 'minisim' ? [p.why] : []).join(' ');
    expect(why).not.toMatch(/act on Mark/i); expect(why).toMatch(/lead|half a ramp/);
  });
  // what each kind's card accepts: the timed kinds by the button they press, the option cards by a tap / pick on an option
  const VERBS: Record<string, RegExp> = { speedChange: /\bCALL\b/, timedStart: /\bSTART\b[\s\S]*\bCALL\b/, pause: /\bGO\b/, restart: /\bLAUNCH\b/, watchLap: /\bSTART\b[\s\S]*\bLAP\b/ };
  const BUTTONS = /\b(START|STOP|LAP|CALL|GO|LAUNCH)\b/;
  it('SCH-012 every mini-sim page: the card comes up, its pointer names a verb the card accepts and only what the card shows (book row, chart, clock, bar)', () => {
    for (const { p, at } of sims) {
      const { d } = cardOf(p); const ptr = cardPointer(pointerOf(p), d);
      // R4 (PT-18): any number a pointer quotes is on the card it points at (prompt or chart)
      for (const n of ptr.match(/\d+(?:\.\d+)?/g) ?? []) expect(`${d.prompt} ${d.context.chart?.seconds.toFixed(1) ?? ''}`, `${at}: pointer "${ptr}" quotes ${n}`).toContain(n);
      expect(d.kind, at).toBe(p.decisionKind);
      expect(words(ptr), at).toBeLessThanOrEqual(14);
      const lapForm = d.kind === 'watch' && d.timing?.kind === 'startStop';
      const verb = lapForm ? VERBS.watchLap : d.options?.length ? undefined : VERBS[d.kind];   // PT-17 SCH-035: the start-queue restart is an option card
      if (verb) { expect(d.timing, at).toBeTruthy(); expect(ptr, `${at}: "${ptr}"`).toMatch(verb); }
      else { expect(d.options?.length, at).toBeGreaterThan(0); expect(ptr, `${at}: "${ptr}"`).toMatch(/\b(tap|pick)\b/i); expect(ptr, `${at}: "${ptr}" names a button the card lacks`).not.toMatch(BUTTONS); }
      if (/book row/i.test(ptr)) expect(d.context.row, `${at} has no book row`).toBeTruthy();
      if (/chart/i.test(ptr)) expect(d.context.chart, `${at} has no chart`).toBeTruthy();
      if (/clock/i.test(ptr)) expect(d.context.clock, `${at} has no clock`).toBeTruthy();
      if (/\bbar\b|tick/i.test(ptr)) expect(d.timing?.signSeconds, `${at} has no bar`).toBeTruthy();
      if (/\btick\b/.test(ptr) && d.kind === 'speedChange') expect(d.context.chart?.meaning, `${at}: the CALL tick needs the lead`).toBe('lead');
      // the page's control is one the card shows (the ring has a target; e2e checks the rendered ring)
      const shows = new Set([...controlsOf(d), ...(d.options?.length ? ['callTurn', 'callSpeed', 'makeup', 'taCard', 'holdCard'] : []), ...(d.context.row ? ['book'] : []), ...(d.timing?.signSeconds ? ['callSpeed'] : []), ...(/CALL/.test(`${d.timing?.tapLabel ?? ''} ${d.timing?.secondTapLabel ?? ''}`) ? ['callAtMark'] : [])]);
      expect([...shows], `${at} control ${p.control}`).toContain(p.control);
    }
  });
});

describe('SCH-013 runs use only what the course taught', () => {
  const FORBIDDEN: DecisionKind[] = ['ta', 'lost', 'transitOut', 'makeup', 'hazard'];
  it('SCH-013 runKinds: the core kinds for a visitor who never started the course (PT-17), null after modules 7-10; else the core kinds plus completed modules', () => {
    expect(runKinds(done())).toEqual(runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6')));
    const core = runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'))!;
    for (const k of FORBIDDEN) expect(core).not.toContain(k);
    for (const k of ['checkpoint', 'preread', 'turn', 'pause', 'watch', 'speedChange', 'timedStart', 'restart', 'clock'] as DecisionKind[]) expect(core).toContain(k);
    expect(runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'))).toContain('lost');
    expect(runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'))).toBeNull();
    expect(read('src/ui/mobile/engine.ts')).toMatch(/runKinds/);
  });
  it('SCH-013 over 20 seeds no daily or skill run after module 6 contains ta, lost, transitOut or makeup cards (repeats included)', () => {
    const kinds = runKinds(done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'))!;
    for (let seed = 1; seed <= 20; seed++) {
      const runs = [Scheduler.daily(`2026-11-${String(seed).padStart(2, '0')}`, seed % 3, null, 2, kinds), ...SKILLS.map(s => new Scheduler([s], seed * 97, null, { mode: 'practice', kinds }))];
      for (const sch of runs) {
        const plan = sch.plan();
        for (const it of plan.items) if (it.type === 'decision') expect(FORBIDDEN, `seed ${seed} ${plan.skills.join(',')}`).not.toContain(it.micro.kind);
        const r = playRun(new DecisionRun(plan), seed % 2 ? randomAnswerer(seed) : oracleAnswerer());
        for (const v of r.verdicts) expect(FORBIDDEN, `seed ${seed} played`).not.toContain(v.kind);
        expect(r.total).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

describe('SCH-014 Module 1 and 2 try-its', () => {
  it('SCH-014 Module 2 try-it: preread, turn and pause only (no speed changes); a pre-read "what speed" card is answered from the book, not the Module 2 speed call', () => {
    expect(COURSE[2]!.tryIt.kinds).toEqual(['preread', 'turn', 'pause']);
    for (let s = 1; s <= 10; s++) for (const it of tryItPlan(COURSE[2]!, s).items) if (it.type === 'decision') expect(['preread', 'turn', 'pause']).toContain(it.micro.kind);
    const d = { kind: 'preread', prompt: 'Line 3: what speed?', context: { row: {} }, timing: undefined } as unknown as Decision;
    expect(controlsOf(d)).not.toContain('callSpeed');
    const g = read('src/ui/mobile/guided.ts');
    expect(g).toMatch(/tryIt && HIDE_UNTIL_INTRODUCED\.includes\(c\)/); expect(g).toMatch(/reachedKinds\(\)\.has\(d\.kind\)/);
  });
});

describe('SCH-015 Module 3 stopwatch card', () => {
  it('SCH-015 Module 3 mini-sims and try-it play the watch as START at one sign and LAP at the next, with the sign cue and a lap read-off', () => {
    const m3 = COURSE[3]!;
    const ws = m3.pages.filter((p): p is MinisimPage => p.kind === 'minisim');
    expect(ws.length).toBe(2); for (const p of ws) expect(p.form).toBe('lap');
    expect(m3.tryIt.forms).toEqual({ watch: 'lap' });
    for (const p of ws) {
      const { d, run } = cardOf(p);
      expect(d.timing?.kind).toBe('startStop'); expect(d.timing?.tapLabel).toBe('START'); expect(d.timing?.secondTapLabel).toBe('LAP');
      expect(d.timing?.cues?.length).toBe(2); expect(d.prompt).not.toMatch(/\blead\b/i);
      const o = run.oracle()!; const v = run.answer(o);
      expect(v.correct).toBe(true); expect(v.chosen).toMatch(/^your lap reads /); expect(v.rule).not.toMatch(/half a ramp|lead/);
      const again = run.retry(); let s = again.next(); while (s?.type === 'rule') { again.ack(); s = again.next(); }
      const w = again.answer({ taps: [o.taps![0]!, o.taps![1]! + 2] }); expect(w.correct).toBe(false); expect(w.missed).toMatch(/^LAP 2\.0 s late/);
    }
    for (let s = 1; s <= 6; s++) { const plan = tryItPlan(m3, s); for (const it of plan.items) if (it.type === 'decision') expect(it.micro.form).toBe('lap'); }
    // the bar runs to the next sign and says Mark at each
    const cues = [{ at: 5, ft: 300, label: 'bridge' }, { at: 15, ft: 900, label: 'barn' }];
    expect(cueState(cues, 0)).toMatchObject({ frac: 1, ft: 300, label: 'bridge', mark: false });
    expect(cueState(cues, 5.5)).toMatchObject({ label: 'barn', mark: true });
    expect(cueState(cues, 10)).toMatchObject({ frac: 0.5, ft: 300, label: 'barn' });
  });
  it('SCH-015 "lead" is taught in Module 5 (a concept and the lap-plus-hold card moved there), never used in Modules 0-4', () => {
    for (const m of COURSE.slice(0, 5)) for (const p of m.pages) expect(pageText(p), m.id).not.toMatch(/\blead\b/i);
    const m5 = COURSE[5]!;
    expect(m5.pages.some(p => p.kind === 'concept' && /\blead\b/i.test(p.words))).toBe(true);
    expect(m5.pages.some(p => p.kind === 'minisim' && p.decisionKind === 'watch' && !p.form)).toBe(true);
    expect(m5.tryIt.kinds).toContain('watch');
  });
});

describe('SCH-016 whereCheckpoint', () => {
  it('SCH-016 the car drives with the ghost, the strip is the leg, a tap as both reach the sign is an Ace, and the score is explained', () => {
    const m = new WhereCheckpointModel(35, 0.2, 4);
    expect(m.carMph).toBe(35); expect(m.carAtCheckpoint()).toBeCloseTo(m.perfect, 6);
    m.press(m.perfect); expect(m.score()!.penalty).toBe(0); expect(m.explain()).toMatch(/ghost reached the sign at [\d.]+ s.*0 points, an Ace!/);
    const late = new WhereCheckpointModel(35, 0.2, 4); late.press(late.perfect + 2.2);
    expect(late.explain()).toMatch(/2\.2 s after it\. The crew counts whole seconds: 2 points\./);
    const w = read('src/ui/school2/widgets.ts');
    expect(w).toMatch(/s2-greensign/); expect(w).toMatch(/r\.place\(r\.ghost/); expect(w).toMatch(/const frac = \(s: number\): number => s \/ m\.legFt;/);
    expect(read('src/ui/styles.css')).toMatch(/\.s2-greensign/);
  });
});

describe('SCH-017 Module 4 numbers', () => {
  it('SCH-017 Module 4 says once that this app\'s car is not the handbook\'s Packard; its example, figure and mini-sims quote the app\'s car', () => {
    for (const x of STOP_EXAMPLE) expect(x.sit).toBe(Math.round((15 - stopLoss(x.vIn, x.vOut, FORD_1939)) * 10) / 10);
    const m4 = COURSE[4]!; const t = m4.pages.map(pageText).join(' ');
    expect(t.match(/not that Packard/g)?.length).toBe(1);
    const ex = m4.pages.find(p => p.kind === 'example')!; expect(pageText(ex)).toMatch(/this app's car/); expect(pageText(ex)).toContain(`sit ${STOP_EXAMPLE[0]!.sit.toFixed(1)}`);
    expect(figureSvg('chart-cell')).toContain(`sit ${STOP_EXAMPLE[0]!.sit.toFixed(1)} s`); expect(figureSvg('chart-cell')).toContain("This app's car");
    expect(read('src/core/decision/scenarios.ts')).toMatch(/car: FORD_1939/);   // the mini-sims' car
  });
});

describe('SCH-018 verdict sources are chips', () => {
  it('SCH-018 verdict text carries no citation; the source resolves to excerpt chips; the speed-change verdict cites splitting the sign (HB p.12, video 2026 92:24)', () => {
    for (const k of ['pause', 'speedChange', 'timedStart', 'restart', 'hazard', 'ta', 'lost', 'checkpoint', 'clock', 'watch', 'makeup', 'preread', 'turn', 'transitOut'] as DecisionKind[]) {
      const vr = verdictRule(k); const plain = ruleWithoutSource(vr.sentence, vr.card.source);
      expect(plain, k).not.toMatch(/HB p|REG |\[\d+:\d\d\]|\(video|simulator convention/); expect(plain.endsWith(`(${vr.card.source}).`), k).toBe(false);
    }
    const sp = verdictRule('speedChange'); expect(sourceKeys(sp.card.source).slice(0, 2)).toEqual(['hb:p12', 'video:2026:92:24']); expect(sourceKeys(sp.card.source).join()).not.toMatch(/120:16/);
    const v = { decisionId: 'x', kind: 'speedChange', skill: 'stayOnTime', secondsDelta: 1, correct: false, rule: sp.sentence, ruleId: sp.card.id, source: sp.card.source, expected: 'e', chosen: 'c', nextDecisionIn: null } as const;
    expect(verdictParts(v).rule).not.toContain('('); expect(verdictParts(v).source).toBe(sp.card.source);
    let resolved = 0; for (const r of RULES) if (sourceKeys(r.source).length) resolved++;
    expect(resolved / RULES.length).toBeGreaterThan(0.8);
    expect(read('src/ui/school2/minisim.ts')).toMatch(/sourceChips\(v\.source/); expect(read('src/ui/mobile/run.ts')).toMatch(/sourceChips\(vp\.source/);
  });
});

describe('SCH-020 newcomer polish', () => {
  it('SCH-020 the first page (first-visit line + page 1 + its figure labels) is under 70 words; Module 0 try-it green signs only; citations show no repo paths', () => {
    const fig = figureSvg((COURSE[0]!.pages[0] as { figure?: string }).figure).replace(/<[^>]+>/g, ' ');
    expect(words(FIRST_VISIT.line) + pageWords(COURSE[0]!.pages[0]!) + words(fig)).toBeLessThan(70);
    expect(Object.values(COURSE[0]!.tryIt.variants?.checkpoint ?? [])).not.toHaveLength(0);
    for (let s = 1; s <= 20; s++) for (const it of tryItPlan(COURSE[0]!, s).items) if (it.type === 'decision') expect(microSubcase(it.micro.kind, it.micro.variant)).toBe('green');
    // a missed card's repeat keeps to the allowed variants
    const plan = tryItPlan(COURSE[0]!, 3); const run = new DecisionRun(plan);
    playRun(run, { name: 'wrong', respond: d => ({ optionId: d.options!.find(o => o.id !== run.oracle()?.optionId)!.id }) });
    for (const v of run.verdicts) expect(v.kind).toBe('checkpoint');
    for (const e of Object.values(EXCERPTS)) expect(e.citation, e.key).not.toMatch(/docs\/|research|\.md\b/);
  });
  it('SCH-020 CDT is explained once (Module 6 and a time-zone chip), Module 12 says Desk opens when the module is done, Module 9 marks the red light as the app\'s default, Home keeps Continue course until Module 12', () => {
    expect(COURSE.map(m => m.pages.map(pageText).join(' ')).join(' ').match(/Central Daylight Time/g)?.length).toBe(1);
    expect(read('src/ui/school2/sheet.ts')).toMatch(/CDT: 'Central Daylight Time'/); expect(read('src/ui/school2/minisim.ts')).toMatch(/zoneChip\(d\.context\.zone\)/);
    expect(COURSE[12]!.pages.map(pageText).join(' ')).toMatch(/Desk mode opens when you finish this module/);
    expect(COURSE[12]!.pages.map(pageText).join(' ')).not.toMatch(/Beat it and Desk/);
    const m9 = pageText(COURSE[9]!.pages[0]!); expect(m9).toMatch(/rules list only examples; this app also counts a red light/);
    expect(read('src/ui/mobile/home.ts')).toMatch(/courseStarted\(cv\.state\) && deskUnlocked\(cv\.state\) \? null : continueTarget\(cv\)/);
    expect(controlsThrough(2)).toContain('distanceBar');   // the bar is taught with the driver's Mark in Module 2, before Module 2's CALL card
  });
});

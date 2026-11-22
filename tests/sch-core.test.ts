import { describe, it, expect } from 'vitest';
import { miniSim, tryItPlan, tryItRun, DecisionRun, DECISION_KINDS, Progress, emptyProgress, DECISION_PROGRESS_KEY, randomAnswerer, playRun, oracleAnswerer, guidedControls, coreDone, deskUnlocked, emptyCourse, registerCourse, type DecisionKind } from '../src/core/decision/index.js';
import { Session } from '../src/agent/protocol.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { CONTROL_IDS, type ControlId } from '../content/course-types.js';

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
const fakeCourse = (n = 13) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, controls: [CONTROL_IDS[Math.min(i, CONTROL_IDS.length - 1)]!] as ControlId[], tryIt: { skills: [] as string[], kinds: (['turn', 'pause'] as DecisionKind[]), cards: 5 } }));

describe('SCH-005 mini-sim engine', () => {
  it('exactly one decision of the kind, for every kind and 8 seeds', () => {
    for (const kind of DECISION_KINDS) for (let seed = 1; seed <= 8; seed++) {
      const m = miniSim(kind, seed); const s = m.next();
      expect(s?.type, `${kind}/${seed}`).toBe('decision');
      if (s?.type !== 'decision') continue;
      expect(s.decision.kind).toBe(kind);
      expect(m.total).toBe(1);
      m.answer(m.oracle());
      expect(m.done()).toBe(true);
      const r = m.result(); expect(r.total).toBe(1); expect(r.correct).toBe(1);
      expect(m.verdicts).toHaveLength(1);
    }
  });
  it('is deterministic and has guided metadata', () => {
    const a = miniSim('turn', 7), b = miniSim('turn', 7);
    expect(JSON.stringify(a.next())).toBe(JSON.stringify(b.next()));
    expect(a.guided.control).toBe('callTurn'); expect(a.guided.pointer.length).toBeGreaterThan(5);
    expect(miniSim('turn', 7, { control: 'book' }).guided.control).toBe('book');
  });
  it('retry replays the same scenario for a second try', () => {
    const a = miniSim('speedChange', 5); const sa = a.next(); a.answer(null);
    const r = a.retry(); expect(r.attempt).toBe(2); expect(JSON.stringify(r.next())).toBe(JSON.stringify(sa));
    r.answer(r.oracle()); expect(r.result().correct).toBe(1);
  });
  it('random answers never crash (50 seeds, every kind)', () => {
    for (let seed = 0; seed < 50; seed++) for (const kind of DECISION_KINDS) { const m = miniSim(kind, seed); const res = playRun(m, randomAnswerer(seed)); expect(res.total).toBe(1); }
  });
});

describe('SCH-007 try-it plan', () => {
  const mod = { id: 'm4', tryIt: { skills: ['stayOnTime'], kinds: ['pause', 'restart'] as DecisionKind[], cards: 5 } };
  it('5 decisions, only the module kinds, no rule cards, reproducible', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = tryItPlan(mod, seed); expect(p.decisionCount).toBe(5);
      expect(p.items.every(i => i.type === 'decision')).toBe(true); expect(p.items).toHaveLength(5);
      expect(JSON.stringify(tryItPlan(mod, seed))).toBe(JSON.stringify(p));
      const run = tryItRun(mod, seed); const res = playRun(run, randomAnswerer(seed));
      expect(res.total).toBe(5); expect(res.ruleCardsShown).toEqual([]);
      expect(res.verdicts.every(v => mod.tryIt.kinds.includes(v.kind))).toBe(true);
    }
    expect(JSON.stringify(tryItPlan(mod, 1))).not.toBe(JSON.stringify(tryItPlan(mod, 2)));
  });
  it('a single-kind module with misses stays on its kind', () => {
    const one = { id: 'm1', tryIt: { skills: [], kinds: ['preread'] as DecisionKind[], cards: 5 } };
    for (let seed = 1; seed <= 10; seed++) { const res = playRun(new DecisionRun(tryItPlan(one, seed)), { name: 'wrong', respond: () => null }); expect(res.total).toBe(5); expect(res.verdicts.every(v => v.kind === 'preread')).toBe(true); }
    expect(playRun(tryItRun(mod, 3), oracleAnswerer()).correct).toBe(5);
  });
});

describe('SCH-004 course progress', () => {
  it('persists and round-trips under the decision key', () => {
    const st = store(); const p = new Progress(st);
    p.markPage('m0', 2); p.markPage('m0', 1); p.markTryIt('m0', 2); p.markTryIt('m0', 1); p.markPage('m1', 3);
    expect(st.m.has(DECISION_PROGRESS_KEY)).toBe(true);
    const q = new Progress(st); const c = q.courseState();
    expect(c).toEqual({ modulesDone: ['m0'], pages: { m0: 2, m1: 3 }, tryItStars: { m0: 2 } });
    expect(JSON.parse(st.m.get(DECISION_PROGRESS_KEY)!).meters).toBeTruthy();
  });
  it('survives garbage and keeps the course through a run result', () => {
    const st = store(); st.setItem(DECISION_PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), course: { modulesDone: [5, 'm1', '<x>'], pages: { m1: 'a', m2: 4 }, tryItStars: null } }));
    expect(new Progress(st).courseState()).toEqual({ modulesDone: ['m1'], pages: { m2: 4 }, tryItStars: {} });
    expect(emptyProgress().course).toEqual(emptyCourse());
  });
  it('coreDone after modules 0-6, deskUnlocked after 12', () => {
    const course = fakeCourse(); const st = store(); const p = new Progress(st);
    for (let i = 0; i < 6; i++) p.markTryIt(`m${i}`, 1);
    expect(p.coreDone(course)).toBe(false); p.markTryIt('m6', 3); expect(p.coreDone(course)).toBe(true); expect(p.coreDone()).toBe(true);
    expect(p.deskUnlocked(course)).toBe(false); p.markTryIt('m12', 1); expect(new Progress(st).deskUnlocked(course)).toBe(true);
    expect(coreDone(emptyCourse())).toBe(false); expect(deskUnlocked(emptyCourse())).toBe(false);
  });
  it('guidedControls introduces controls one module at a time', () => {
    const course = fakeCourse(); const c = emptyCourse();
    expect(guidedControls(c, course)).toEqual({ introduced: [], newest: null, guided: true });
    c.pages.m0 = 1; expect(guidedControls(c, course).introduced).toEqual(['book']);
    c.modulesDone.push('m0'); c.pages.m1 = 2; const g = guidedControls(c, course);
    expect(g.introduced).toEqual(['book', 'callTurn']); expect(g.newest).toBe('callTurn'); expect(g.guided).toBe(true);
    for (let i = 0; i < 7; i++) if (!c.modulesDone.includes(`m${i}`)) c.modulesDone.push(`m${i}`);
    const u = guidedControls(c, course); expect(u.guided).toBe(false); expect(u.newest).toBeNull(); expect(u.introduced).not.toContain('desk');
    c.modulesDone.push('m12'); expect(guidedControls(c, course).introduced).toContain('desk');
  });
  it('a module may not use controls from later modules in the fake ladder (monotone prefix)', () => {
    const course = fakeCourse(); const seen: ControlId[] = [];
    for (const m of course) { for (const c of m.controls) expect(CONTROL_IDS.indexOf(c)).toBeGreaterThanOrEqual(Math.max(-1, ...seen.map(s => CONTROL_IDS.indexOf(s)))); seen.push(...m.controls); }
  });
});

describe('SCH protocol', () => {
  const answer = (s: Session, seed: number, step: any) => {
    const d = step.decision; const r = seed % 3;
    if (r === 0) return null;
    if (d.options?.length) return { optionId: d.options[seed % d.options.length].id };
    if (d.timing?.kind === 'startStop') return { taps: [1, 5] };
    return { tapSeconds: (seed % 7) + 0.5 };
  };
  it('school.minisim and school.tryit: random answers never crash (50 seeds)', () => {
    registerCourse(fakeCourse());
    for (let seed = 0; seed < 50; seed++) {
      const s = new Session(builtinScenario('onestop'));
      const kind = DECISION_KINDS[seed % DECISION_KINDS.length]!;
      const a = s.handle({ type: 'school.minisim', kind, seed });
      expect(a.type).toBe('decision'); if (a.type !== 'decision') continue;
      expect(a.guided?.control).toBeTruthy(); expect(a.plan.decisionCount).toBe(1);
      const v = s.handle({ type: 'decision.answer', response: answer(s, seed, a.step) });
      expect(v.type).toBe('verdict'); if (v.type === 'verdict') expect(v.done).toBe(true);
      const t = s.handle({ type: 'school.tryit', moduleId: 'm3', seed });
      expect(t.type).toBe('decision'); if (t.type !== 'decision') continue;
      let step: any = t.step; let n = 0;
      while (step && n < 20) { const r = s.handle({ type: 'decision.answer', response: answer(s, seed + n, step) }); expect(r.type).toBe('verdict'); n++; if (r.type === 'verdict' && r.done) break; step = (s.handle({ type: 'decision.next' }) as any).step; }
      expect(n).toBe(5);
    }
  });
  it('rejects bad kinds, seeds and unknown modules', () => {
    registerCourse(fakeCourse());
    const s = new Session(builtinScenario('onestop'));
    expect(s.handle({ type: 'school.minisim', kind: 'nope' as DecisionKind, seed: 1 }).type).toBe('error');
    expect(s.handle({ type: 'school.minisim', kind: 'turn', seed: -1 }).type).toBe('error');
    expect(s.handle({ type: 'school.tryit', moduleId: 'zz', seed: 1 }).type).toBe('error');
  });
});

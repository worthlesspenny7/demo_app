/** Phase VIII core: decision mode (MOB-001..007, MOB-012, MOB-030..032 engine parts). */
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { buildGhost } from '../src/core/ghost.js';
import { validateScenario } from '../src/core/course.js';
import { OracleBot, runBot, DecisionBot } from '../src/agent/bots.js';
import { Session } from '../src/agent/protocol.js';
import { createProgressStore, type StorageLike } from '../src/ui/viewmodels/progress.js';
import { RULES } from '../content/rules.js';
import {
  DecisionRunner, Scheduler, DecisionRun, runResult, playRun, oracleAnswerer, randomAnswerer, microScenario, bossScenario, Progress, applyRunResult, emptyProgress,
  legalUnlocked, bossUnlocked, dailySeed, DECISION_KINDS, SKILLS, SKILL_OF_KIND, TIMED_KINDS, KINDS_OF_SKILL, PROMPT_MAX_WORDS, MAX_RULE_CARDS, RUN_MAX_DECISIONS,
  words, DECISION_PROGRESS_KEY, type Decision, type DecisionKind, type Verdict, type Skill, type DecisionResponse,
} from '../src/core/decision/index.js';

const wc = (s: string): number => s.trim().split(/\s+/).length;
function memStore(): StorageLike & { data: Record<string, string> } { const data: Record<string, string> = {}; return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } }; }
/** Play a runner to the end answering with `fn` (default: the oracle). */
function playRunner(run: DecisionRunner, fn?: (d: Decision) => DecisionResponse | null): { decisions: Decision[]; verdicts: Verdict[] } {
  const decisions: Decision[] = []; const verdicts: Verdict[] = [];
  for (let d = run.next(); d; d = run.next()) { decisions.push(d); verdicts.push(run.answer(d, fn ? fn(d) : run.oracle(d))); }
  return { decisions, verdicts };
}
function micro(kind: DecisionKind, seed: number, variant = 0) {
  const m = microScenario(kind, seed, variant);
  return { m, run: new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns }) };
}

describe('MOB-001 DecisionRunner API', () => {
  it('MOB-001 next() returns a Decision with kind, skill, a short prompt and context; answer() returns a Verdict with the rule and its source', () => {
    const { run } = micro('pause', 3);
    const d = run.next()!;
    expect(d).toBeTruthy(); expect(d.kind).toBe('pause'); expect(d.skill).toBe(SKILL_OF_KIND.pause);
    expect(wc(d.prompt)).toBeLessThanOrEqual(PROMPT_MAX_WORDS);
    expect(d.context.tod).toBeGreaterThan(0); expect(d.context.row?.line).toBeGreaterThan(0); expect(d.context.row?.columnC.length).toBeGreaterThan(0);
    expect(d.context.speeds?.in).toBeGreaterThan(0); expect(d.context.chart?.kind).toBe('stopGo');
    expect(d.timing?.kind).toBe('countdown'); expect(d.timing!.truthSeconds).toBeGreaterThan(0);
    expect(run.next()).toBe(d);   // idempotent until answered
    const v = run.answer(d, run.oracle(d));
    expect(v.decisionId).toBe(d.id); expect(v.correct).toBe(true); expect(Math.abs(v.secondsDelta)).toBeLessThan(0.05);
    expect(v.rule).toMatch(/\(.+\)\.$/); expect(v.source.length).toBeGreaterThan(3); expect(wc(v.rule)).toBeLessThanOrEqual(60);
    expect(RULES.some(r => r.id === v.ruleId)).toBe(true);   // the rule text comes from content/rules.ts
    expect(() => run.answer(d, { tapSeconds: 1 })).toThrow();
    expect(run.next()).toBeNull();
    const res = run.finish(); expect(res.score.legs.length).toBeGreaterThan(0);
  });
  it('MOB-001 option cards list options and the verdict names the expected and chosen answers; a null response is a timeout', () => {
    const { run } = micro('turn', 2);
    const d = run.next()!; expect(d.kind).toBe('turn'); expect(d.options!.length).toBeGreaterThanOrEqual(3); expect(d.deadlineSeconds).toBeGreaterThan(0);
    const right = run.oracle(d).optionId!; const wrong = d.options!.find(o => o.id !== right)!.id;
    const v = run.answer(d, { optionId: wrong, tapSeconds: 0 });
    expect(v.correct).toBe(false); expect(v.secondsDelta).toBeGreaterThan(5); expect(v.chosen).not.toBe(v.expected);
    const { run: r2 } = micro('pause', 1); const d2 = r2.next()!; const v2 = r2.answer(d2, null);
    expect(v2.correct).toBe(false); expect(v2.chosen).toBe('no GO');
  });
  it('MOB-001 deterministic: the same scenario and the same responses give the same decisions and verdicts', () => {
    const sc = drillById('D18')!.scenario(2, 0);
    const a = playRunner(new DecisionRunner(sc), d => d.timing ? { tapSeconds: d.timing.truthSeconds + 0.4, taps: d.timing.secondTapSeconds !== undefined ? [d.timing.truthSeconds, d.timing.secondTapSeconds + 0.4] : undefined } : { optionId: d.options![0]!.id });
    const b = playRunner(new DecisionRunner(sc), d => d.timing ? { tapSeconds: d.timing.truthSeconds + 0.4, taps: d.timing.secondTapSeconds !== undefined ? [d.timing.truthSeconds, d.timing.secondTapSeconds + 0.4] : undefined } : { optionId: d.options![0]!.id });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.verdicts.slice(0, -1).every(v => v.nextDecisionIn !== null && v.nextDecisionIn >= 0)).toBe(true);
    expect(a.verdicts[a.verdicts.length - 1]!.nextDecisionIn).toBeNull();
  });
});

describe('MOB-002 decision kinds', () => {
  it('MOB-002 every kind is found in its micro scenario and answered right by the oracle', () => {
    for (const kind of DECISION_KINDS) for (const seed of [1, 2, 3]) for (const variant of [0, 1, 2, 3]) {
      const { m, run } = micro(kind, seed, variant);
      expect(validateScenario(m.scenario), `${kind} ${seed} ${variant}`).toEqual([]);
      const { decisions, verdicts } = playRunner(run);
      expect(decisions.map(d => d.kind), `${kind} ${seed} ${variant}`).toEqual([kind]);
      expect(verdicts[0]!.correct, `${kind} ${seed} ${variant}: ${verdicts[0]!.expected} / ${verdicts[0]!.chosen}`).toBe(true);
      expect(Math.abs(verdicts[0]!.secondsDelta), `${kind} ${seed} ${variant}`).toBeLessThanOrEqual(2);
    }
  }, 60_000);
  it('MOB-002 full drills surface the real points: D16 restart / transitOut / clock, D08b hazard / ta, D04 timedStart, D05 speedChange, D03 pause', () => {
    const kindsOf = (id: string): Set<string> => new Set(playRunner(new DecisionRunner(drillById(id)!.scenario(1, 0))).decisions.map(d => d.kind));
    const d16 = kindsOf('D16'); for (const k of ['restart', 'transitOut', 'clock', 'checkpoint']) expect(d16.has(k), k).toBe(true);
    const d08b = kindsOf('D08b'); for (const k of ['hazard', 'ta', 'turn']) expect(d08b.has(k), k).toBe(true);
    expect(kindsOf('D04').has('timedStart')).toBe(true); expect(kindsOf('D05').has('speedChange')).toBe(true); expect(kindsOf('D03').has('pause')).toBe(true);
  });
  it('MOB-002 a missed turn surfaces a lost card; turning round at once is right and costs least', () => {
    const { run } = micro('lost', 2); const d = run.next()!; expect(d.kind).toBe('lost'); expect(run.oracle(d).optionId).toBe('uturn');
    const good = run.answer(d, { optionId: 'uturn' });
    const { run: r2 } = micro('lost', 2); const d2 = r2.next()!; const bad = r2.answer(d2, { optionId: 'continue' });
    expect(good.correct).toBe(true); expect(bad.correct).toBe(false); expect(bad.secondsDelta).toBeGreaterThan(good.secondsDelta);
    expect(r2.finish().score.legs[0]!.error!).toBeGreaterThan(run.finish().score.legs[0]!.error!);
  });
  it('MOB-002 hazard doctrine: claim and make up the odd seconds for a train or tractor, make up a slow truck or a light (REG V.H.1)', () => {
    const truth = [0, 1, 2, 3].map(v => { const { run } = micro('hazard', 1, v); const d = run.next()!; return `${d.context.hazard!.kind}:${run.oracle(d).optionId}`; });
    expect(truth).toEqual(['slow:makeup', 'train:both', 'tractor:both', 'signal:makeup']);
  });
});

describe('MOB-003 oracle answers reproduce the Desk score', () => {
  for (const id of ['D03', 'D04', 'D05', 'D16', 'D18']) {
    it(`MOB-003 ${id} seeds 1-3: the oracle through the runner is within 2 s per leg of the OracleBot`, () => {
      for (const seed of [1, 2, 3]) {
        const sc = drillById(id)!.scenario(seed, 0);
        const s1 = new Simulator(sc); const desk = runBot(s1, new OracleBot(s1, { useWatch: true }));
        const run = new DecisionRunner(sc); const { decisions, verdicts } = playRunner(run); const dm = run.finish();
        expect(decisions.length, `${id} ${seed}`).toBeGreaterThan(2);
        expect(verdicts.every(v => v.correct), `${id} ${seed}`).toBe(true);
        expect(dm.score.legs.length).toBe(desk.score.legs.length);
        desk.score.legs.forEach((l, i) => expect(Math.abs((l.error ?? 0) - (dm.score.legs[i]!.error ?? 999)), `${id} seed ${seed} leg ${i + 1}`).toBeLessThanOrEqual(2));
      }
    });
  }
  it('MOB-003 between decisions there is no make-up unless chosen: a 5 s late GO stays in the leg', () => {
    const { run } = micro('pause', 4); const d = run.next()!;
    const v = run.answer(d, { tapSeconds: d.timing!.truthSeconds + 5 });
    expect(v.correct).toBe(false); expect(v.secondsDelta).toBeCloseTo(5, 1);
    expect(run.finish().score.legs[0]!.error!).toBeGreaterThanOrEqual(4);
  });
});

describe('MOB-004 timing decisions', () => {
  it('MOB-004 timing truth and grading: pause (D03), restart (D16), timedStart (D04), speedChange (D05)', () => {
    const tol = { pause: 1.0, restart: 1.0, timedStart: 1.3, speedChange: 1.3 } as const;
    for (const kind of TIMED_KINDS) {
      for (const off of [0.5, 2.5]) {
        const { run } = micro(kind as DecisionKind, 5); const d = run.next()!;
        expect(d.timing, kind).toBeTruthy(); expect(d.timing!.toleranceSeconds).toBe(tol[kind as keyof typeof tol]);
        const t = d.timing!;
        const res: DecisionResponse = t.kind === 'startStop' ? { taps: [t.truthSeconds, t.secondTapSeconds! + off] } : { tapSeconds: t.truthSeconds + off };
        const v = run.answer(d, res);
        expect(v.correct, `${kind} +${off}`).toBe(off < t.toleranceSeconds);
        expect(v.secondsDelta, `${kind} +${off}`).toBeCloseTo(off, 1);
      }
    }
    expect(micro('pause', 5).run.next()!.timing!.kind).toBe('countdown');
    expect(micro('restart', 5).run.next()!.timing!.kind).toBe('tapAt');
    expect(micro('timedStart', 5).run.next()!.timing!.kind).toBe('startStop');
    expect(micro('speedChange', 5).run.next()!.timing!.kind).toBe('tapAt');
  });
  it('MOB-004 micro runs: timed segments are 10-25 s and every leg is 60-200 s of ghost time', () => {
    for (const kind of DECISION_KINDS) for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sc = microScenario(kind, seed, seed % 4).scenario;
      for (const ins of sc.book) if (ins.timed) { expect(ins.timed.seconds).toBeGreaterThanOrEqual(10); expect(ins.timed.seconds).toBeLessThanOrEqual(25); }
      for (const leg of buildGhost(sc).legs) { expect(leg.perfectDuration, `${kind} ${seed}`).toBeGreaterThanOrEqual(60); expect(leg.perfectDuration, `${kind} ${seed}`).toBeLessThanOrEqual(200); }
    }
  });
  it('MOB-004 a late tap is applied in the sim: a launch 3 s late shows in the start deltas', () => {
    const { run } = micro('restart', 2); const d = run.next()!; run.answer(d, { tapSeconds: d.timing!.truthSeconds + 3 });
    const r = run.finish(); const sd = r.startDeltas.find(x => x.kind === 'restart')!; expect(sd.delta!).toBeGreaterThan(2.5); expect(sd.delta!).toBeLessThan(3.6);
  });
});

describe('MOB-005 Scheduler', () => {
  it('MOB-005 a run has 10-15 decisions, mixes skills and is reproducible from its seed', () => {
    for (const seed of [1, 2, 3, 4]) {
      const plan = new Scheduler([...SKILLS], seed).plan();
      const slots = plan.items.filter(i => i.type === 'decision');
      expect(slots.length).toBeGreaterThanOrEqual(10); expect(slots.length).toBeLessThanOrEqual(15); expect(plan.decisionCount).toBe(slots.length);
      const firstFive = new Set(slots.slice(0, 5).map(i => i.type === 'decision' ? i.micro.skill : ''));
      expect(firstFive.size).toBe(5);
      expect(JSON.stringify(new Scheduler([...SKILLS], seed).plan())).toBe(JSON.stringify(plan));
      for (const it of slots) if (it.type === 'decision') expect((KINDS_OF_SKILL[it.micro.skill] as readonly string[]).includes(it.micro.kind)).toBe(true);
    }
  });
  it('MOB-005 rule cards: before the first decision of an unpassed skill, at most three, never for a passed skill', () => {
    const plan = new Scheduler(['stayOnTime', 'recovery'], 9).plan();
    expect(plan.items[0]!.type).toBe('rule');
    const firstOf = (sk: Skill) => plan.items.findIndex(i => i.type === 'decision' && i.micro.skill === sk);
    for (const sk of ['stayOnTime', 'recovery'] as Skill[]) { const i = firstOf(sk); expect(plan.items[i - 1]!.type).toBe('rule'); const r = plan.items[i - 1]!; if (r.type === 'rule') expect(r.card.skill).toBe(sk); }
    const all = new Scheduler([...SKILLS], 9).plan(); expect(all.items.filter(i => i.type === 'rule').length).toBe(MAX_RULE_CARDS);
    const p = emptyProgress(); p.meters.stayOnTime = { value: 0.85, correct: 20, total: 21, lastDay: '2026-10-22', passed: true };
    const passed = new Scheduler(['stayOnTime', 'recovery'], 9, p).plan();
    expect(passed.items.filter(i => i.type === 'rule').map(i => i.type === 'rule' ? i.card.skill : '')).toEqual(['recovery']);
    // a card already seen is swapped for another card of the same skill when there is one
    const seen = emptyProgress(); const first = plan.items[0]!; if (first.type === 'rule') seen.rulesSeen = [first.card.id];
    const again = new Scheduler(['stayOnTime', 'recovery'], 9, seen).plan(); const c = again.items[0]!;
    if (c.type === 'rule' && first.type === 'rule') expect(c.card.id).not.toBe(first.card.id);
  });
  it('MOB-005 a missed skill comes back later in the same run (up to 15 decisions)', () => {
    const run = new Scheduler([...SKILLS], 3).start();
    let s = run.next(); while (s?.type === 'rule') { run.ack(); s = run.next(); }
    const total0 = run.total; const sk = s!.type === 'decision' ? s!.decision.skill : null;
    const d = s!.type === 'decision' ? s!.decision : null!;
    const wrong: DecisionResponse = d.options ? { optionId: d.options.find(o => o.id !== run.oracle()!.optionId)!.id } : { tapSeconds: (d.timing!.truthSeconds + 9), taps: [0, (d.timing!.secondTapSeconds ?? 0) + 9] };
    const v = run.answer(wrong); expect(v.correct).toBe(false);
    expect(run.total).toBe(total0 + 1);
    const rest = playRun(run, oracleAnswerer());
    expect(rest.verdicts.slice(1).some(x => x.skill === sk)).toBe(true);
    expect(rest.total).toBeLessThanOrEqual(RUN_MAX_DECISIONS);
    const r2 = playRun(new Scheduler([...SKILLS], 3).start(), randomAnswerer(3)); expect(r2.total).toBeLessThanOrEqual(RUN_MAX_DECISIONS);
  });
  it('MOB-005 same seed and the same answers give the same result; restore() rebuilds an unfinished run', () => {
    const plan = new Scheduler(['stayOnTime', 'startOnTime', 'instruments'], 21).plan();
    const a = new DecisionRun(plan); const ra = playRun(a, randomAnswerer(5));
    const b = new DecisionRun(plan); const rb = playRun(b, { name: 'replay', respond: () => a.responses[b.verdicts.length] ?? null });
    expect(JSON.stringify(rb)).toBe(JSON.stringify(ra));
    const c = DecisionRun.restore(plan, a.responses.slice(0, 5)); expect(c.verdicts.length).toBe(5);
    const rc = playRun(c, { name: 'replay', respond: () => a.responses[c.verdicts.length] ?? null });
    expect(JSON.stringify(rc.verdicts)).toBe(JSON.stringify(ra.verdicts));
  });
});

describe('MOB-006 run result', () => {
  const v = (correct: boolean, s: number, skill: Skill = 'stayOnTime'): Verdict => ({ decisionId: 'x', kind: 'pause', skill, secondsDelta: s, correct, rule: 'r (src).', ruleId: 'RULE-016', source: 'src', expected: 'e', chosen: 'c', nextDecisionIn: null });
  it('MOB-006 stars: 3 at >= 90 % and |seconds| <= 10, 2 at >= 75 %, 1 at >= 50 %; tallies and the three worst cards', () => {
    expect(runResult({ seed: 1, mode: 'practice' }, Array.from({ length: 10 }, () => v(true, 0.5))).stars).toBe(3);
    expect(runResult({ seed: 1, mode: 'practice' }, [...Array.from({ length: 9 }, () => v(true, 2)), v(false, 3)]).stars).toBe(2);   // 90 % but 21 s
    expect(runResult({ seed: 1, mode: 'practice' }, [...Array.from({ length: 8 }, () => v(true, 0)), v(false, 1), v(false, 1)]).stars).toBe(2);
    expect(runResult({ seed: 1, mode: 'practice' }, [...Array.from({ length: 6 }, () => v(true, 0)), ...Array.from({ length: 4 }, () => v(false, 1))]).stars).toBe(1);
    expect(runResult({ seed: 1, mode: 'practice' }, [...Array.from({ length: 4 }, () => v(true, 0)), ...Array.from({ length: 6 }, () => v(false, 1))]).stars).toBe(0);
    const r = runResult({ seed: 1, mode: 'practice' }, [...Array.from({ length: 4 }, () => v(true, 0, 'recovery')), v(false, 1), v(false, -7), v(false, 3), v(true, 12), v(false, 2), v(false, 0)]);
    expect(r.stars).toBe(1); expect(r.correct).toBe(5); expect(r.total).toBe(10); expect(r.secondsTotal).toBe(25);
    expect(r.tallies.recovery).toEqual({ skill: 'recovery', correct: 4, total: 4, seconds: 0 }); expect(r.tallies.stayOnTime.total).toBe(6);
    expect(r.worst.map(w => w.verdict.secondsDelta)).toEqual([-7, 3, 2]); expect(r.worst[0]!.rule).toBe('r (src).');
  });
  it('MOB-006 an oracle run earns 3 stars, a random one does not', () => {
    for (const seed of [1, 2]) {
      const o = playRun(new Scheduler([...SKILLS], seed).start(), oracleAnswerer()); expect(o.correct).toBe(o.total); expect(o.stars).toBe(3);
      const r = playRun(new Scheduler([...SKILLS], seed).start(), randomAnswerer(seed)); expect(r.stars).toBeLessThan(3);
    }
  });
});

describe('MOB-007 agent protocol', () => {
  const sc = drillById('D03')!.scenario(1, 0);
  it('MOB-007 hello reports the modes; decision.next / decision.answer play a run to its RunResult', () => {
    const s = new Session(sc); const h = s.handle({ type: 'hello' }); expect(h.type === 'hello' && h.modes).toEqual(['desk', 'decision']);
    let rep = s.handle({ type: 'decision.next', start: { seed: 4, skills: ['stayOnTime'] } }); let guard = 0; let last = null as null | ReturnType<Session['handle']>;
    while (rep.type === 'decision' && !rep.done && guard++ < 60) {
      if (rep.step!.type === 'decision') {
        const d = rep.step!.decision; expect(s.handle({ type: 'decision.next' })).toEqual(rep);   // idempotent
        last = s.handle({ type: 'decision.answer', response: d.timing?.kind === 'startStop' ? { taps: [d.timing.truthSeconds, d.timing.secondTapSeconds!] } : d.timing ? { tapSeconds: d.timing.truthSeconds } : { optionId: d.options![0]!.id } });
        expect(last.type).toBe('verdict');
      }
      rep = s.handle({ type: 'decision.next' });
    }
    expect(rep.type === 'decision' && rep.done).toBe(true);
    expect(last?.type === 'verdict' && last.done && last.result!.total).toBeGreaterThanOrEqual(10);
    expect(s.handle({ type: 'decision.answer', response: null }).type).toBe('error');
    expect(s.handle({ type: 'decision.next', start: { mode: 'nope' as 'boss' } }).type).toBe('error');
    expect(s.handle({ type: 'decision.run', bot: 'oracle', seed: 2, skills: ['bogus' as Skill] }).type).toBe('error');
  });
  it('MOB-007 decision.run plays a whole run with the DecisionBot (oracle all right)', () => {
    const rep = new Session(sc).handle({ type: 'decision.run', bot: 'oracle', seed: 7 });
    expect(rep.type).toBe('run'); if (rep.type !== 'run') return;
    expect(rep.result.correct).toBe(rep.result.total); expect(rep.bot).toBe('oracle');
    expect(new DecisionBot('random', 3).name).toBe('random');
  });
  for (const half of [0, 1]) {
    it(`MOB-007 the random bot never crashes a run (seeds ${half * 25 + 1}-${half * 25 + 25})`, () => {
      for (let seed = half * 25 + 1; seed <= half * 25 + 25; seed++) {
        const rep = new Session(sc).handle({ type: 'decision.run', bot: 'random', seed, mode: seed % 7 === 0 ? 'daily' : 'practice', day: '2026-10-23', dailyIndex: seed % 3 });
        expect(rep.type, `seed ${seed}: ${rep.type === 'error' ? rep.message : ''}`).toBe('run');
        if (rep.type === 'run') { expect(rep.result.total).toBeGreaterThanOrEqual(10); expect(rep.result.verdicts.every(v => Number.isFinite(v.secondsDelta))).toBe(true); }
      }
    }, 60_000);
  }
});

describe('MOB-012 text budget (engine part)', () => {
  it('MOB-012 no generated prompt exceeds 40 words (every kind, seeds, variants, rungs, the boss leg)', () => {
    let n = 0;
    for (const kind of DECISION_KINDS) for (const seed of [1, 2, 3, 4]) for (const variant of [0, 1, 2, 3]) for (const rung of [0, 2] as const) {
      const m = microScenario(kind, seed, variant, rung); const run = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns });
      for (const d of playRunner(run).decisions) { n++; expect(words(d.prompt), d.prompt).toBeLessThanOrEqual(40); for (const o of d.options ?? []) expect(words(o.label)).toBeLessThanOrEqual(12); }
    }
    const boss = bossScenario(5); const br = new DecisionRunner(boss.scenario, { kinds: boss.kinds, maxDecisions: boss.maxDecisions, prereadRows: boss.prereadRows });
    for (const d of playRunner(br).decisions) { n++; expect(words(d.prompt), d.prompt).toBeLessThanOrEqual(40); }
    expect(n).toBeGreaterThan(400);
  }, 60_000);
  it('MOB-012 no run has more than three rule cards', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const skills = SKILLS.filter((_, i) => (seed >> i) & 1); const plan = new Scheduler(skills.length ? skills : [...SKILLS], seed).plan();
      expect(plan.items.filter(i => i.type === 'rule').length).toBeLessThanOrEqual(3);
    }
    for (const seed of [1, 2, 3]) { const r = playRun(new Scheduler([...SKILLS], seed).start(), randomAnswerer(seed)); expect(r.ruleCardsShown.length).toBeLessThanOrEqual(3); }
  });
});

describe('MOB-030..032 progress', () => {
  const res = (skill: Skill, correct: number, wrong: number) => runResult({ seed: 1, mode: 'practice' }, [
    ...Array.from({ length: correct }, () => ({ decisionId: 'a', kind: KINDS_OF_SKILL[skill][0] as DecisionKind, skill, secondsDelta: 0, correct: true, rule: '', ruleId: '', source: '', expected: '', chosen: '', nextDecisionIn: null })),
    ...Array.from({ length: wrong }, () => ({ decisionId: 'b', kind: KINDS_OF_SKILL[skill][0] as DecisionKind, skill, secondsDelta: 5, correct: false, rule: '', ruleId: '', source: '', expected: '', chosen: '', nextDecisionIn: null })),
  ], ['RULE-016']);
  it('MOB-030 daily set: three seeds per calendar day, new the next day; completion and the streak by day; Continue resumes an unfinished run', () => {
    const p = new Progress(memStore());
    expect(p.dailySeeds('2026-10-23')).toEqual([0, 1, 2].map(i => dailySeed('2026-10-23', i)));
    expect(new Set(p.dailySeeds('2026-10-23')).size).toBe(3); expect(p.dailySeeds('2026-10-24')).not.toEqual(p.dailySeeds('2026-10-23'));
    const plan = p.dailyPlan(1, '2026-10-23'); expect(plan.mode).toBe('daily'); expect(plan.seed).toBe(dailySeed('2026-10-23', 1));
    p.recordRun(res('stayOnTime', 10, 0), plan, '2026-10-23'); expect(p.dailyDone('2026-10-23')).toEqual([1]); expect(p.dailyDone('2026-10-24')).toEqual([]);
    expect(p.state().streak).toEqual({ current: 1, best: 1, lastDay: '2026-10-23' });
    p.recordRun(res('stayOnTime', 1, 0), null, '2026-10-23'); expect(p.state().streak.current).toBe(1);
    p.recordRun(res('stayOnTime', 1, 0), null, '2026-10-24'); expect(p.state().streak.current).toBe(2);
    p.recordRun(res('stayOnTime', 1, 0), null, '2026-10-27'); expect(p.state().streak).toEqual({ current: 1, best: 2, lastDay: '2026-10-27' });
    // Continue across reloads
    const store = memStore(); const q = new Progress(store); const run = Scheduler.daily('2026-10-23', 0).start();
    const r = playRun(run, randomAnswerer(1), 6); void r; q.saveUnfinished(run.plan, run.responses);
    const reloaded = new Progress(store).unfinished()!; const back = DecisionRun.restore(reloaded.plan, reloaded.responses);
    expect(back.verdicts.map(v => v.decisionId)).toEqual(run.verdicts.map(v => v.decisionId));
    expect(JSON.stringify(back.next())).toBe(JSON.stringify(run.next()));
  });
  it('MOB-031 meters fill with correct decisions, drain with misses and idle days; legal rung at 80 %, boss at 60 % in all five', () => {
    let s = emptyProgress();
    s = applyRunResult(s, res('stayOnTime', 6, 0), '2026-10-01'); const up = s.meters.stayOnTime.value; expect(up).toBeGreaterThan(0.4);
    s = applyRunResult(s, res('stayOnTime', 0, 2), '2026-10-01'); expect(s.meters.stayOnTime.value).toBeLessThan(up);
    expect(legalUnlocked(s, 'stayOnTime', '2026-10-01')).toBe(false);
    s = applyRunResult(s, res('stayOnTime', 15, 0), '2026-10-01'); expect(legalUnlocked(s, 'stayOnTime', '2026-10-01')).toBe(true); expect(s.meters.stayOnTime.passed).toBe(true);
    const p = new Progress(memStore()); expect(p.meter('stayOnTime')).toBe(0);
    for (const sk of SKILLS) p.recordRun(res(sk, 8, 0), null, '2026-10-01');
    expect(p.bossUnlocked('2026-10-01')).toBe(true); expect(bossUnlocked(p.state(), '2026-10-01')).toBe(true);
    expect(p.meter('recovery', '2026-10-20')).toBeLessThan(p.meter('recovery', '2026-10-02'));   // idle decay
    expect(p.bossUnlocked('2026-10-30')).toBe(false);
    const boss = playRun(Scheduler.boss(5).start(), oracleAnswerer());
    expect(boss.total).toBeGreaterThanOrEqual(18); expect(boss.total).toBeLessThanOrEqual(25); expect(boss.mode).toBe('boss');
    expect(new Set(boss.verdicts.map(v => v.skill)).size).toBeGreaterThanOrEqual(3);
    // the legal rung: no chart cell on the card
    const m = microScenario('pause', 2, 0, 0); const d = new DecisionRunner(m.scenario, { kinds: m.kinds, rung: 0 }).next()!; expect(d.context.chart ?? null).toBeNull(); expect(d.prompt).not.toMatch(/chart says/);
  }, 30_000);
  it('MOB-032 decision progress lives beside the Desk progress: drill stars and aces remain; a drill run records its stars there', () => {
    const store = memStore();
    const desk = createProgressStore(store); desk.recordRun('D03', { stars: 2, aces: 3, score: 4.2 }); desk.markLesson('four-s');
    const p = new Progress(store, DECISION_PROGRESS_KEY, desk);
    p.recordRun(res('stayOnTime', 10, 0), { mode: 'practice', drillId: 'D05' }, '2026-10-23');
    const again = createProgressStore(store);
    expect(again.get('D03')!.stars).toBe(2); expect(again.get('D03')!.aces).toBe(3); expect(again.lessonDone('four-s')).toBe(true);
    expect(again.get('D05')!.stars).toBe(3);
    expect(JSON.parse(store.data[DECISION_PROGRESS_KEY]!).meters.stayOnTime.correct).toBe(10);
    expect(new Progress(store).state().rulesSeen).toEqual(['RULE-016']);
    // garbage in storage never throws
    store.data[DECISION_PROGRESS_KEY] = '{"meters": 5, "streak": "x"}'; expect(new Progress(store).state().streak.current).toBe(0);
  });
});

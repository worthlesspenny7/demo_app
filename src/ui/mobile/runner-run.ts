/**
 * Decision mode on the real engine while the core Scheduler is still a stub (Phase VIII integration step): a run is a chain of real
 * legs (the built-in varied leg, D03 pauses, D04/D05 speed changes, D08 recovery, D08b the train, D10 lost, D16 restarts) played through
 * the core DecisionRunner, restricted to the decision kinds of the requested skills, until the run's 10-15 decisions are found.
 * A rule card from content/rules.ts (MOB-010) is shown before the first decision of a skill whose rule the player has not seen,
 * at most three a run (MOB-005). The plan stores the legs, so "Continue" replays the stored responses deterministically.
 * engine.ts prefers the core Scheduler as soon as it plans cards; this module then goes unused.
 */
import { DecisionRunner, SKILL_OF_KIND, DECISION_KINDS, type Decision, type DecisionKind, type DecisionResponse, type RunPlan, type RunResult, type RunStep, type Skill, type Verdict, type RuleCard } from '../../core/decision/index.js';
import { nodeById, type Scenario } from '../../core/course.js';
import { cameoOfNode } from '../../core/cameo.js';
import { allDrills } from '../../core/drills/index.js';
import { builtinScenario } from '../../agent/scenarios.js';
import { RULES } from '../../../content/rules.js';
import { stubResult } from './stub-engine.js';

type LegTemplate = { src: 'builtin'; name: string } | { src: 'drill'; id: string; tier: number };
export type Leg = LegTemplate & { seed: number };
export interface RunnerPlan extends RunPlan { engine: 'runner'; legs: Leg[]; kinds: DecisionKind[]; rulesSeen: string[] }

/** Legs that exercise each skill (the first is played first). */
const POOL: Record<Skill, LegTemplate[]> = {
  safetyCourse: [{ src: 'builtin', name: 'varied' }, { src: 'drill', id: 'D10', tier: 0 }],
  startOnTime: [{ src: 'drill', id: 'D16', tier: 0 }, { src: 'builtin', name: 'varied' }],
  stayOnTime: [{ src: 'drill', id: 'D03', tier: 0 }, { src: 'drill', id: 'D05', tier: 0 }, { src: 'drill', id: 'D04', tier: 0 }],
  recovery: [{ src: 'drill', id: 'D08', tier: 0 }, { src: 'drill', id: 'D08b', tier: 0 }, { src: 'drill', id: 'D10', tier: 0 }],
  instruments: [{ src: 'drill', id: 'D16', tier: 0 }, { src: 'builtin', name: 'varied' }],
};
const MIXED: LegTemplate[] = [{ src: 'builtin', name: 'varied' }, { src: 'drill', id: 'D16', tier: 0 }, { src: 'drill', id: 'D03', tier: 0 }, { src: 'drill', id: 'D08', tier: 0 }];

export function legScenario(l: Leg): Scenario | null {
  try {
    if (l.src === 'builtin') return builtinScenario(l.name, l.seed);
    const d = allDrills().find(x => x.id === l.id); return d ? d.scenario(l.seed, l.tier, 0) : null;
  } catch { return null; }
}

/** The rule card for a decision kind the player has not seen (content/rules.ts), as the core's RuleCard. */
export function ruleFor(kind: DecisionKind, seen: ReadonlySet<string>): RuleCard | null {
  const c = RULES.find(r => r.kinds.includes(kind) && !seen.has(r.id));
  return c ? { id: c.id, skill: c.skill as Skill, text: c.text, source: c.source } : null;
}

class Chain {
  private li = -1; private runner: DecisionRunner | null = null; private found = 0;
  constructor(private readonly plan: RunnerPlan) {}
  /** The next decision across the legs (null when the legs or the decision budget are spent). */
  next(): { d: Decision; runner: DecisionRunner } | null {
    for (let guard = 0; guard < this.plan.legs.length + 2; guard++) {
      if (this.found >= this.plan.decisionCount) return null;
      if (this.runner) {
        let d: Decision | null = null; try { d = this.runner.next(); } catch { d = null; }
        if (d) return { d: withCameo(d, this.runner.scenario), runner: this.runner };
        this.runner = null;
      }
      this.li++;
      const leg = this.plan.legs[this.li]; if (!leg) return null;
      const sc = legScenario(leg); if (!sc) continue;
      try { this.runner = new DecisionRunner(sc, { kinds: this.plan.kinds, rung: this.plan.rung, maxDecisions: this.plan.decisionCount - this.found }); } catch { this.runner = null; }
    }
    return null;
  }
  counted(): void { this.found++; }
}

/** Build the plan: pick legs until the requested number of decisions is found (an oracle probe through the real runner). */
export function runnerPlan(req: { skills: Skill[]; seed: number; mode: RunPlan['mode']; rung: 0 | 1 | 2 | 3; decisions?: number }, rulesSeen: string[] = []): RunnerPlan | null {
  const skills = req.skills.length ? req.skills : (['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'] as Skill[]);
  const kinds = DECISION_KINDS.filter(k => skills.includes(SKILL_OF_KIND[k]));
  const want = Math.max(10, Math.min(req.mode === 'boss' ? 25 : 15, req.decisions ?? (req.mode === 'boss' ? 25 : 12)));
  const pool = skills.length === 1 ? POOL[skills[0]!] : MIXED;
  const legs: Leg[] = []; let found = 0;
  for (let i = 0; i < 8 && found < want; i++) {
    const t = pool[i % pool.length]!; const seed = ((req.seed + i * 7919) % 9973) + 1;
    const leg = { ...t, seed } as Leg;
    const sc = legScenario(leg); if (!sc) continue;
    try {
      const r = new DecisionRunner(sc, { kinds, rung: req.rung, maxDecisions: want - found });
      let n = 0;
      for (let k = 0; k < 40; k++) { const d = r.next(); if (!d) break; r.answer(d, r.oracle(d)); n++; }
      if (n > 0) { legs.push(leg); found += n; }
    } catch { /* a leg the runner cannot play yet: skip it */ }
  }
  if (found < 1) return null;
  return { seed: req.seed, mode: req.mode, skills, rung: req.rung, items: [], decisionCount: Math.min(want, found), engine: 'runner', legs, kinds, rulesSeen: [...rulesSeen] };
}

/** MOB-026: the core's BookRowView leaves Column A empty for now; draw the row's CAMEO from the scenario with the shared renderer. */
export function withCameo(d: Decision, sc: Scenario): Decision {
  const fill = (row: Decision['context']['row']): Decision['context']['row'] => {
    if (!row || row.cameoSvg) return row;
    try {
      const ins = sc.book.find(b => b.n === row.line); if (!ins?.nodeId) return row;
      const svg = cameoOfNode(nodeById(sc.course, ins.nodeId), ins.turn ?? null, 96);
      return svg ? { ...row, cameoSvg: svg } : row;
    } catch { return row; }
  };
  const row = fill(d.context.row), nextRow = fill(d.context.nextRow);
  return row === d.context.row && nextRow === d.context.nextRow ? d : { ...d, context: { ...d.context, ...(row ? { row } : {}), ...(nextRow ? { nextRow } : {}) } };
}

export const isRunnerPlan = (p: RunPlan): p is RunnerPlan => (p as Partial<RunnerPlan>).engine === 'runner' && Array.isArray((p as Partial<RunnerPlan>).legs);

/** The DecisionRun surface over the chain. */
export class RunnerRun {
  readonly verdicts: Verdict[] = [];
  private readonly chain: Chain;
  private cur: { d: Decision; runner: DecisionRunner } | null = null;
  private pendingRule: RuleCard | null = null;
  private readonly seen: Set<string>;
  private readonly shown: string[] = [];
  private ruleChecked = false;
  constructor(readonly plan: RunnerPlan) { this.chain = new Chain(plan); this.seen = new Set(plan.rulesSeen); }
  next(): RunStep | null {
    if (!this.cur) { this.cur = this.chain.next(); this.ruleChecked = false; }
    if (!this.cur) return null;
    const of = Math.max(this.plan.decisionCount, this.verdicts.length + 1);
    if (!this.ruleChecked) {
      this.ruleChecked = true;
      const skillShown = this.shown.some(id => RULES.find(r => r.id === id)?.skill === this.cur!.d.skill);
      if (!skillShown && this.shown.length < 3) this.pendingRule = ruleFor(this.cur.d.kind, this.seen);
    }
    if (this.pendingRule) return { type: 'rule', card: this.pendingRule, index: this.verdicts.length, of };
    return { type: 'decision', decision: this.cur.d, index: this.verdicts.length, of };
  }
  ack(): void { if (this.pendingRule) { this.seen.add(this.pendingRule.id); this.shown.push(this.pendingRule.id); this.pendingRule = null; } }
  answer(response: DecisionResponse | null): Verdict {
    if (!this.cur) this.next();
    if (!this.cur) throw new Error('no decision to answer');
    this.pendingRule = null;
    const v = this.cur.runner.answer(this.cur.d, response);
    this.verdicts.push(v); this.chain.counted(); this.cur = null;
    return v;
  }
  oracle(d: Decision): DecisionResponse | null { try { return this.cur && this.cur.d.id === d.id ? this.cur.runner.oracle(d) : null; } catch { return null; } }
  done(): boolean { return this.next() === null; }
  result(): RunResult { return stubResult(this.plan, this.verdicts, this.shown); }
}

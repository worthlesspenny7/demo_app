/**
 * Scheduler and DecisionRun (MOB-005 / MOB-006). A run is 10-15 decisions drawn from micro scenarios across the planned skills. A rule
 * card goes before the first decision of a skill the player has not passed (at most three per run, never for a passed skill); a missed
 * decision brings its skill back later in the same run (up to 15 decisions). Seeded: the same plan and the same answers give the same
 * run and the same RunResult.
 */
import type { Scenario } from '../course.js';
import { rng } from '../rng.js';
import { DecisionRunner } from './runner.js';
import { buildMicro, bossScenario, KINDS_OF_SKILL, type MicroScenario } from './scenarios.js';
import { allRuleCards, introCardFor, verdictRule } from './rules.js';
import { SKILLS, SKILL_OF_KIND, type Decision, type DecisionKind, type DecisionProgressState, type DecisionResponse, type MicroSpec, type RuleCard, type RunItem, type RunPlan, type RunResult, type RunStep, type Skill, type SkillTally, type Verdict } from './types.js';

export const RUN_MIN_DECISIONS = 10;
export const RUN_MAX_DECISIONS = 15;
export const MAX_RULE_CARDS = 3;
export const MAX_REPEATS_PER_SKILL = 2;
export const BOSS_DECISIONS = 25;

export interface SchedulerOptions { mode?: RunPlan['mode']; rung?: 0 | 1 | 2 | 3; decisions?: number; day?: string; dailyIndex?: number; drillId?: string }

const seedOf = (label: string): number => rng(label).int(1, 2 ** 31 - 2);
/** Seed of the daily set's run `index` (0..2) on `day` ("2026-10-23"): the same all day, a new one tomorrow (MOB-030). */
export function dailySeed(day: string, index: number): number { return seedOf(`daily:${day}:${index}`); }

export class Scheduler {
  constructor(readonly skillPlan: Skill[], readonly seed: number, readonly progress: DecisionProgressState | null = null, readonly opts: SchedulerOptions = {}) {}

  /** The daily set's run `index` (0..2): every skill, re-randomised per calendar day. */
  static daily(day: string, index: number, progress: DecisionProgressState | null = null, rung: 0 | 1 | 2 | 3 = 2): Scheduler {
    return new Scheduler([...SKILLS], dailySeed(day, index), progress, { mode: 'daily', day, dailyIndex: index, rung });
  }
  /** The boss run: a full generated leg in decision mode (MOB-031). */
  static boss(seed: number, progress: DecisionProgressState | null = null, rung: 0 | 1 | 2 | 3 = 1): Scheduler {
    return new Scheduler([...SKILLS], seed, progress, { mode: 'boss', rung });
  }

  plan(): RunPlan {
    const mode = this.opts.mode ?? 'practice'; const rung = this.opts.rung ?? 2;
    const skills = [...new Set(this.skillPlan.filter(s => (SKILLS as readonly string[]).includes(s)))];
    const plan: RunPlan = { seed: this.seed, mode, skills: skills.length ? skills : [...SKILLS], rung, items: [], decisionCount: 0, ...(this.opts.day ? { day: this.opts.day } : {}), ...(this.opts.dailyIndex !== undefined ? { dailyIndex: this.opts.dailyIndex } : {}), ...(this.opts.drillId ? { drillId: this.opts.drillId } : {}) };
    if (mode === 'boss') { plan.items = [{ type: 'decision', micro: { kind: 'turn', skill: 'safetyCourse', seed: this.seed, variant: 0, bossLeg: BOSS_DECISIONS } }]; plan.decisionCount = BOSS_DECISIONS; return plan; }
    const r = rng(`plan:${this.seed}:${plan.skills.join(',')}`);
    const n = Math.max(RUN_MIN_DECISIONS, Math.min(RUN_MAX_DECISIONS, Math.round(this.opts.decisions ?? r.int(10, 12))));
    // mix the skills: rounds of the skill list in a fresh order each round, each skill cycling through its kinds
    const kindIdx: Record<string, number> = {}; const slots: MicroSpec[] = [];
    let round = 0;
    while (slots.length < n) {
      const order = shuffled(plan.skills, rng(`plan:${this.seed}:round:${round++}`));
      for (const sk of order) {
        if (slots.length >= n) break;
        const kinds = KINDS_OF_SKILL[sk]; const i = kindIdx[sk] ?? r.int(0, kinds.length - 1); kindIdx[sk] = i + 1;
        const kind = kinds[i % kinds.length]!;
        slots.push({ kind, skill: sk, seed: seedOf(`slot:${this.seed}:${slots.length}`), variant: r.int(0, 3) });
      }
    }
    const items: RunItem[] = []; const shownSkills = new Set<Skill>(); let rules = 0;
    const seen = new Set(this.progress?.rulesSeen ?? []);
    for (const m of slots) {
      if (!shownSkills.has(m.skill)) {
        shownSkills.add(m.skill);
        const passed = this.progress?.meters?.[m.skill]?.passed === true;
        if (!passed && rules < MAX_RULE_CARDS) { items.push({ type: 'rule', card: pickCard(m.skill, m.kind, seen) }); rules++; }
      }
      items.push({ type: 'decision', micro: m });
    }
    plan.items = items; plan.decisionCount = slots.length;
    return plan;
  }
  start(): DecisionRun { return new DecisionRun(this.plan()); }
}

function shuffled<T>(arr: readonly T[], r: ReturnType<typeof rng>): T[] { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
/** A card for the skill that precedes this kind, preferring one the player has not seen yet. */
function pickCard(skill: Skill, kind: DecisionKind, seen: Set<string>): RuleCard {
  const primary = introCardFor(skill, kind);
  if (!seen.has(primary.id)) return primary;
  const alt = allRuleCards().find(c => c.skill === skill && c.kinds?.includes(kind) && !seen.has(c.id));
  return alt ?? primary;
}

/** Plays a RunPlan: rule cards and decisions in order, repeats for misses, then the RunResult. */
export class DecisionRun {
  readonly responses: (DecisionResponse | null)[] = [];
  readonly verdicts: Verdict[] = [];
  readonly ruleCardsShown: string[] = [];
  private queue: RunItem[];
  private runner: DecisionRunner | null = null;
  private runnerMax = 0;
  private step: RunStep | null | undefined = undefined;
  private repeats: Partial<Record<Skill, number>> = {};
  private planned: number;
  private skipped = 0;
  private current: RunItem | null = null;
  private retries = 0;
  constructor(readonly plan: RunPlan) { this.queue = plan.items.slice(); this.planned = plan.decisionCount; }

  /** Rebuild an unfinished run from its plan and the answers so far (deterministic replay, MOB-030 "Continue"). */
  static restore(plan: RunPlan, responses: (DecisionResponse | null)[]): DecisionRun {
    const run = new DecisionRun(plan);
    for (const res of responses) {
      let s = run.next();
      while (s && s.type === 'rule') { run.ack(); s = run.next(); }
      if (!s) break;
      run.answer(res);
    }
    return run;
  }

  /** Total decisions this run will have (planned + repeats inserted so far - micro scenarios that produced none). */
  get total(): number { return this.planned - this.skipped; }
  /** The scenario of the decision on screen (for the book row renderer), or null. */
  scenario(): Scenario | null { return this.runner?.scenario ?? null; }
  /** The DecisionRunner playing the current micro scenario (agents, debugging). */
  currentRunner(): DecisionRunner | null { return this.runner; }

  next(): RunStep | null {
    if (this.step !== undefined) return this.step;
    for (;;) {
      if (this.runner && this.runner.decisions.length < this.runnerMax) {
        const d = this.runner.next();
        if (d) return (this.step = { type: 'decision', decision: d, index: this.verdicts.length + 1, of: this.total });
        const cur = this.current;
        if (this.runner.decisions.length === 0 && cur?.type === 'decision' && !cur.micro.bossLeg && this.retries < 2) {
          // a micro scenario that offered no decision (rare): try another layout of the same kind
          this.retries++; this.queue.unshift({ type: 'decision', micro: { ...cur.micro, seed: cur.micro.seed + 7919, variant: cur.micro.variant + 1 } });
        } else this.skipped += this.runnerMax - this.runner.decisions.length;
      }
      this.runner = null;
      const it = this.queue.shift();
      if (it && !(it.type === 'decision' && this.current?.type === 'decision' && it.micro.kind === this.current.micro.kind && this.retries > 0 && it.micro.seed === this.current.micro.seed + 7919)) this.retries = 0;
      this.current = it ?? null;
      if (!it) return (this.step = null);
      if (it.type === 'rule') return (this.step = { type: 'rule', card: it.card, index: this.verdicts.length, of: this.total });
      const boss = it.micro.bossLeg;
      const m: MicroScenario = boss ? bossScenario(it.micro.seed, this.plan.rung) : buildMicro(it.micro, this.plan.rung);
      this.runnerMax = boss ?? m.maxDecisions;
      this.runner = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: this.runnerMax, prereadRows: m.prereadRows, missTurns: m.missTurns, rung: this.plan.rung });
    }
  }
  /** Acknowledge the rule card on screen. */
  ack(): void {
    const s = this.next(); if (!s || s.type !== 'rule') return;
    this.ruleCardsShown.push(s.card.id); this.step = undefined;
  }
  /** TRUTH: the perfect navigator's response to the decision on screen (bots, tests). */
  oracle(): DecisionResponse | null {
    const s = this.next(); if (!s || s.type !== 'decision' || !this.runner) return null;
    return this.runner.oracle(s.decision);
  }
  answer(response: DecisionResponse | null): Verdict {
    const s = this.next();
    if (!s || s.type !== 'decision' || !this.runner) throw new Error('no decision on screen');
    const v = this.runner.answer(s.decision, response);
    this.responses.push(response ?? null); this.verdicts.push(v); this.step = undefined;
    if (this.plan.mode === 'boss' && this.runner.decisions.length >= this.runnerMax) this.runner = null;
    // MOB-005: a missed skill comes back later in the same run
    if (!v.correct && this.plan.mode !== 'boss' && this.total < RUN_MAX_DECISIONS && (this.repeats[v.skill] ?? 0) < MAX_REPEATS_PER_SKILL) {
      this.repeats[v.skill] = (this.repeats[v.skill] ?? 0) + 1;
      const n = this.verdicts.length;
      const micro: MicroSpec = { kind: v.kind, skill: v.skill, seed: seedOf(`repeat:${this.plan.seed}:${n}`), variant: (n + 1) % 4 };
      // two decisions later (or at the end)
      let pos = 0, dec = 0; while (pos < this.queue.length && dec < 2) { if (this.queue[pos]!.type !== 'rule') dec++; pos++; }
      this.queue.splice(pos, 0, { type: 'decision', micro }); this.planned++;
    }
    return v;
  }
  done(): boolean { return this.next() === null; }
  result(): RunResult { return runResult(this.plan, this.verdicts, this.ruleCardsShown); }
}

/** MOB-006: the run's result from its verdicts. */
export function runResult(plan: Pick<RunPlan, 'seed' | 'mode'>, verdicts: Verdict[], ruleCardsShown: string[] = []): RunResult {
  const tallies = Object.fromEntries(SKILLS.map(s => [s, { skill: s, correct: 0, total: 0, seconds: 0 } satisfies SkillTally])) as Record<Skill, SkillTally>;
  for (const v of verdicts) { const t = tallies[v.skill]; t.total++; if (v.correct) t.correct++; t.seconds = Math.round((t.seconds + Math.abs(v.secondsDelta)) * 10) / 10; }
  const correct = verdicts.filter(v => v.correct).length; const total = verdicts.length;
  const secondsTotal = Math.round(verdicts.reduce((a, v) => a + Math.abs(v.secondsDelta), 0) * 10) / 10;
  const pct = total ? correct / total : 0;
  const stars: 0 | 1 | 2 | 3 = total === 0 ? 0 : pct >= 0.9 && secondsTotal <= 10 ? 3 : pct >= 0.75 ? 2 : pct >= 0.5 ? 1 : 0;
  const worst = verdicts.map((v, i) => ({ v, i })).sort((a, b) => Number(a.v.correct) - Number(b.v.correct) || Math.abs(b.v.secondsDelta) - Math.abs(a.v.secondsDelta) || a.i - b.i)
    .slice(0, 3).map(({ v }) => ({ verdict: v, rule: v.rule, source: v.source }));
  return { seed: plan.seed, mode: plan.mode, verdicts: verdicts.slice(), secondsTotal, correct, total, tallies, stars, worst, ruleCardsShown: ruleCardsShown.slice() };
}

/** A navigator answering decision cards: the oracle (truth) or seeded random answers (MOB-007). */
export interface DecisionAnswerer { name: string; respond(d: Decision, run: DecisionRun): DecisionResponse | null }
export function oracleAnswerer(): DecisionAnswerer { return { name: 'oracle', respond: (_d, run) => run.oracle() }; }
export function randomAnswerer(seed: number): DecisionAnswerer {
  const r = rng(`random-answers:${seed}`);
  return {
    name: 'random',
    respond(d) {
      if (r.chance(0.05)) return null;
      if (d.options?.length) return { optionId: r.pick(d.options).id, ...(d.deadlineSeconds !== undefined ? { tapSeconds: r.next() * d.deadlineSeconds * 1.5 } : {}) };
      if (d.timing?.kind === 'startStop') { const a = r.next() * (d.timing.truthSeconds + 4); return { taps: [a, a + r.next() * ((d.timing.secondTapSeconds ?? 10) + 8)] }; }
      if (d.timing) return { tapSeconds: r.next() * d.timing.maxSeconds };
      return null;
    },
  };
}
/** Play a whole run with an answerer (agents, tests): rule cards are acknowledged, every decision answered. */
export function playRun(run: DecisionRun, who: DecisionAnswerer, maxSteps = 200): RunResult {
  for (let i = 0; i < maxSteps; i++) {
    const s = run.next(); if (!s) break;
    if (s.type === 'rule') { run.ack(); continue; }
    run.answer(who.respond(s.decision, run));
  }
  return run.result();
}
export { verdictRule, SKILL_OF_KIND };

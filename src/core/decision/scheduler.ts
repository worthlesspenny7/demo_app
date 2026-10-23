/**
 * Scheduler and DecisionRun (MOB-005 / MOB-006). A run is 10-15 decisions drawn from micro scenarios across the planned skills. A rule
 * card goes before the first decision of a skill the player has not passed (at most three per run, never for a passed skill); a missed
 * decision brings its skill back later in the same run (up to 15 decisions). Seeded: the same plan and the same answers give the same
 * run and the same RunResult.
 */
import type { Scenario } from '../course.js';
import { rng } from '../rng.js';
import { DecisionRunner } from './runner.js';
import { buildMicro, bossScenario, KINDS_OF_SKILL, BOSS_LEG_DECISIONS, microSubcase, type MicroScenario } from './scenarios.js';
import { introCardFor, verdictRule } from './rules.js';
import { SKILLS, SKILL_OF_KIND, DECISION_KINDS, TIMED_KINDS, type Decision, type DecisionKind, type DecisionProgressState, type DecisionResponse, type MicroSpec, type RunItem, type RunPlan, type RunResult, type RunStep, type Skill, type SkillTally, type Verdict } from './types.js';

export const RUN_MIN_DECISIONS = 10;
export const RUN_MAX_DECISIONS = 15;
export const MAX_RULE_CARDS = 3;
export const MAX_REPEATS_PER_SKILL = 2;
/** MOB-053: at most this many cards of one kind in a run, repeats included. */
export const MAX_PER_KIND = 2;
/** PT-14 N5: a single-skill run is at least this share of its skill. */
export const SKILL_RUN_SHARE = 2 / 3;
/** PT-14 N5: the per-kind cap of a run: MAX_PER_KIND, relaxed in a single-skill run to 3 (4 for a skill of two kinds) so that the skill's
 *  own kinds fill at least two thirds of the run before any other skill tops it up. */
export function maxPerKindFor(skills: readonly Skill[], n: number): number {
  if (skills.length !== 1) return MAX_PER_KIND;
  const kinds = KINDS_OF_SKILL[skills[0]!].length;
  return Math.max(3, Math.ceil(Math.ceil(n * SKILL_RUN_SHARE) / kinds));
}
/** PT-14 N7: an option card between two timing cards (pause, restart, timed start, speed change), so real-time waits do not come in a row.
 *  When there are enough option cards, the fewest moves (the skill mix of the plan stays); otherwise the timing cards are cut into
 *  (options + 1) groups as even as possible with an option card between two groups. */
export function interleave<T>(items: T[], timed: (x: T) => boolean): T[] {
  const T_ = items.filter(timed); const O = items.filter(x => !timed(x));
  if (!T_.length || !O.length) return items.slice();
  if (T_.length <= O.length + 1) {
    // the fewest, nearest swaps of a timing card with an option card (the skill rounds of the plan stay as they were)
    const a = items.slice();
    const pairs = (xs: T[]): number => xs.reduce((n, x, i) => n + (i > 0 && timed(x) && timed(xs[i - 1]!) ? 1 : 0), 0);
    for (let guard = 0; guard < items.length; guard++) {
      const i = a.findIndex((x, k) => k > 0 && timed(x) && timed(a[k - 1]!)); if (i < 0) break;
      const before = pairs(a); let done = false;
      const ks = a.map((_, k) => k).filter(k => k !== i && k !== i - 1 && !timed(a[k]!)).sort((x, y) => Number(x > i) - Number(y > i) || Math.abs(x - i) - Math.abs(y - i));
      for (const k of ks) {
        const t = k < i ? i - 1 : i; const b = a.slice(); [b[k], b[t]] = [b[t]!, b[k]!];
        if (pairs(b) < before) { a.splice(0, a.length, ...b); done = true; break; }
      }
      if (!done) break;
    }
    if (!a.some((x, i) => i > 0 && timed(x) && timed(a[i - 1]!))) return a;
  }
  const groups = Math.min(O.length + 1, T_.length); const out: T[] = []; let ti = 0; let oi = 0;
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(T_.length / groups) + (g < T_.length % groups ? 1 : 0);
    for (let i = 0; i < size; i++) out.push(T_[ti++]!);
    if (oi < O.length && g < groups - 1) out.push(O[oi++]!);
  }
  while (oi < O.length) out.push(O[oi++]!);
  return out;
}
/** MOB-059: the Boss run's fixed card count: the generated leg (one card per kind) then micro cards for every kind it did not give. */
export const BOSS_DECISIONS = 22;

/** A DecisionRunner for a micro scenario (or the boss leg) with everything the scenario asks of it. */
export function microRunner(m: MicroScenario, rung?: 0 | 1 | 2 | 3, maxDecisions?: number): DecisionRunner {
  return new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: maxDecisions ?? m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns, ...(rung !== undefined ? { rung } : {}), ...(m.hint ? { hint: m.hint } : {}), ...(m.maxPerKind !== undefined ? { maxPerKind: m.maxPerKind } : {}) });
}

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
  /** The boss run: a full generated leg in decision mode, then every kind it missed (MOB-031, MOB-059). The first Boss plays at rung 2
   *  (the chart on the card); later ones at rung 1, where the card keeps the chart behind a button. */
  static boss(seed: number, progress: DecisionProgressState | null = null, rung?: 0 | 1 | 2 | 3): Scheduler {
    return new Scheduler([...SKILLS], seed, progress, { mode: 'boss', rung: rung ?? ((progress?.bossRuns ?? 0) > 0 ? 1 : 2) });
  }

  plan(): RunPlan {
    const mode = this.opts.mode ?? 'practice'; const rung = this.opts.rung ?? 2;
    const skills = [...new Set(this.skillPlan.filter(s => (SKILLS as readonly string[]).includes(s)))];
    const plan: RunPlan = { seed: this.seed, mode, skills: skills.length ? skills : [...SKILLS], rung, items: [], decisionCount: 0, ...(this.opts.day ? { day: this.opts.day } : {}), ...(this.opts.dailyIndex !== undefined ? { dailyIndex: this.opts.dailyIndex } : {}), ...(this.opts.drillId ? { drillId: this.opts.drillId } : {}) };
    if (mode === 'boss') { plan.items = [{ type: 'decision', micro: { kind: 'turn', skill: 'safetyCourse', seed: this.seed, variant: 0, bossLeg: BOSS_LEG_DECISIONS } }]; plan.decisionCount = BOSS_DECISIONS; return plan; }
    const r = rng(`plan:${this.seed}:${plan.skills.join(',')}`);
    const n = Math.max(RUN_MIN_DECISIONS, Math.min(RUN_MAX_DECISIONS, Math.round(this.opts.decisions ?? r.int(10, 12))));
    const cap = maxPerKindFor(plan.skills, n); if (cap !== MAX_PER_KIND) plan.maxPerKind = cap;
    // mix the skills: rounds of the skill list in a fresh order each round, each skill cycling through its kinds, at most MAX_PER_KIND
    // cards of one kind (MOB-053); when the planned skills run out of kinds the other skills fill the run
    const kindIdx: Record<string, number> = {}; const perKind: Partial<Record<DecisionKind, number>> = {}; const slots: MicroSpec[] = [];
    // PT-14 N5 / N7: a single-skill run of a skill whose cards are all real-time waits (Stay on time) keeps two thirds for the skill and
    // tops up with option cards, so an option card can sit between its timing cards (>= 4 decisions a minute)
    const ownMax = plan.skills.length === 1 && KINDS_OF_SKILL[plan.skills[0]!].every(k => TIMED_KINDS.includes(k)) ? Math.ceil(n * SKILL_RUN_SHARE) : n;
    const take = (sk: Skill): boolean => {
      if (plan.skills.length === 1 && sk === plan.skills[0] && slots.filter(m => m.skill === sk).length >= ownMax) return false;
      const kinds = KINDS_OF_SKILL[sk]; let i = kindIdx[sk] ?? r.int(0, kinds.length - 1);
      for (let j = 0; j < kinds.length; j++, i++) {
        const kind = kinds[i % kinds.length]!;
        if ((perKind[kind] ?? 0) >= cap) continue;
        if (ownMax < n && sk !== plan.skills[0] && TIMED_KINDS.includes(kind)) continue;   // the top-up of a Stay-on-time run is option cards
        kindIdx[sk] = i + 1; perKind[kind] = (perKind[kind] ?? 0) + 1;
        slots.push({ kind, skill: sk, seed: seedOf(`slot:${this.seed}:${slots.length}`), variant: r.int(0, 3) });
        return true;
      }
      return false;
    };
    const others = shuffled(SKILLS.filter(s => !plan.skills.includes(s)), rng(`plan:${this.seed}:others`));
    for (const pool of [plan.skills, others]) {
      let round = 0;
      while (slots.length < n) {
        const order = shuffled(pool, rng(`plan:${this.seed}:round:${round++}`)); let any = false;
        for (const sk of order) { if (slots.length >= n) break; if (take(sk)) any = true; }
        if (!any) break;
      }
    }
    const items: RunItem[] = []; const shownSkills = new Set<Skill>(); let rules = 0;
    // PT-14 N7: an option card between timing cards (the planned skills keep their share; only the order changes)
    const ordered = interleave(slots, m => TIMED_KINDS.includes(m.kind));
    for (const m of ordered) {
      if (!shownSkills.has(m.skill)) {
        shownSkills.add(m.skill);
        const passed = this.progress?.meters?.[m.skill]?.passed === true;
        // PT-14 N3: the rule card is the rule of the slot it stands before (its kind and sub-case), seen before or not
        if (!passed && rules < MAX_RULE_CARDS) { items.push({ type: 'rule', card: introCardFor(m.skill, m.kind, microSubcase(m.kind, m.variant)) }); rules++; }
      }
      items.push({ type: 'decision', micro: m });
    }
    plan.items = items; plan.decisionCount = slots.length;
    return plan;
  }
  start(): DecisionRun { return new DecisionRun(this.plan()); }
}

function shuffled<T>(arr: readonly T[], r: ReturnType<typeof rng>): T[] { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }

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
  /** PT-14 N5: the run's per-kind cap (relaxed in a single-skill run). */
  private readonly cap: number;
  constructor(readonly plan: RunPlan) { this.queue = plan.items.slice(); this.planned = plan.decisionCount; this.cap = plan.maxPerKind ?? MAX_PER_KIND; }

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

  /** MOB-053 / BUG-16: the run's card count, fixed at plan time (a repeat takes the place of a later card; a micro that gives no card is
   *  replaced by another kind). Only when no replacement can be found does it shrink. */
  get total(): number { return this.planned - this.skipped; }
  /** The scenario of the decision on screen (for the book row renderer), or null. */
  scenario(): Scenario | null { return this.runner?.scenario ?? null; }
  /** The DecisionRunner playing the current micro scenario (agents, debugging). */
  currentRunner(): DecisionRunner | null { return this.runner; }

  /** Cards of `kind` played, on screen or still queued. */
  private kindCount(kind: DecisionKind): number {
    return this.verdicts.filter(v => v.kind === kind).length + (this.step && this.step.type === 'decision' && this.step.decision.kind === kind && !this.answeredStep ? 1 : 0)
      + this.queue.filter(it => it.type === 'decision' && !it.micro.bossLeg && it.micro.kind === kind).length;
  }
  private answeredStep = false;
  /** A kind of `skill` (or any kind, when `skill` is null) still under the cap, preferring `kind` itself; null when none is. */
  private kindUnderCap(kind: DecisionKind | null, skill: Skill | null, salt: string): DecisionKind | null {
    if (kind && this.kindCount(kind) < this.cap) return kind;
    const pool = skill ? [...KINDS_OF_SKILL[skill]] as DecisionKind[] : [...DECISION_KINDS];
    const c = shuffled(pool, rng(`cap:${this.plan.seed}:${salt}`)).filter(k => this.kindCount(k) < this.cap);
    return c[0] ?? null;
  }
  private bossFilled = false;
  /** MOB-059: after the boss leg, one micro card for every kind it did not give, then more (under the cap) to the fixed count. */
  private fillBoss(): void {
    this.bossFilled = true;
    const r = rng(`boss-fill:${this.plan.seed}`);
    const seen = new Set(this.verdicts.map(v => v.kind));
    const left = Math.max(0, this.planned - this.verdicts.length);
    const kinds: DecisionKind[] = shuffled(DECISION_KINDS.filter(k => !seen.has(k)), r);
    let guard = 0;
    while (kinds.length < left && guard++ < 200) {
      const k = this.kindUnderCap(null, null, `boss:${guard}`); if (!k) break;
      const pending = kinds.filter(x => x === k).length;
      if (this.verdicts.filter(v => v.kind === k).length + pending >= MAX_PER_KIND) { if (DECISION_KINDS.every(x => this.verdicts.filter(v => v.kind === x).length + kinds.filter(y => y === x).length >= MAX_PER_KIND)) break; continue; }
      kinds.push(k);
    }
    kinds.slice(0, left).forEach((kind, i) => this.queue.push({ type: 'decision', micro: { kind, skill: SKILL_OF_KIND[kind], seed: seedOf(`boss:${this.plan.seed}:${i}`), variant: r.int(0, 3) } }));
    this.skipped += Math.max(0, left - kinds.length);
  }

  next(): RunStep | null {
    if (this.step !== undefined) return this.step;
    for (;;) {
      if (this.runner && this.runner.decisions.length < this.runnerMax) {
        const d = this.runner.next();
        if (d) { this.answeredStep = false; return (this.step = { type: 'decision', decision: d, index: this.verdicts.length + 1, of: this.total }); }
        const cur = this.current;
        if (cur?.type === 'decision' && cur.micro.bossLeg) { /* the boss leg ended early: fillBoss covers the rest */ }
        else if (this.runner.decisions.length === 0 && cur?.type === 'decision' && this.retries < 3) {
          // a micro scenario that offered no decision (rare): another layout, then another kind of the same skill (the count stays fixed)
          this.retries++;
          const kind = this.retries < 3 ? cur.micro.kind : (this.kindUnderCap(null, cur.micro.skill, `skip:${this.verdicts.length}`) ?? cur.micro.kind);
          // (variant + 12 keeps the sub-case, so the rule card shown before it still fits: PT-14 N3)
          this.queue.unshift({ type: 'decision', micro: { ...cur.micro, kind, skill: SKILL_OF_KIND[kind], seed: cur.micro.seed + 7919, variant: cur.micro.variant + 12 } });
        } else this.skipped += this.runnerMax - this.runner.decisions.length;
      }
      if (this.plan.mode === 'boss' && !this.bossFilled && this.current?.type === 'decision' && this.current.micro.bossLeg) this.fillBoss();
      this.runner = null;
      const it = this.queue.shift();
      if (it && !(it.type === 'decision' && this.current?.type === 'decision' && this.retries > 0 && it.micro.seed === this.current.micro.seed + 7919)) this.retries = 0;
      this.current = it ?? null;
      if (!it) return (this.step = null);
      if (it.type === 'rule') return (this.step = { type: 'rule', card: it.card, index: this.verdicts.length, of: this.total });
      const boss = it.micro.bossLeg;
      const m: MicroScenario = boss ? bossScenario(it.micro.seed, this.plan.rung) : buildMicro(it.micro, this.plan.rung);
      this.runnerMax = boss ?? m.maxDecisions;
      this.runner = microRunner(m, this.plan.rung, this.runnerMax);
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
    this.responses.push(response ?? null); this.verdicts.push(v); this.step = undefined; this.answeredStep = true;
    if (this.plan.mode === 'boss' && this.runner.decisions.length >= this.runnerMax) this.runner = null;
    // MOB-005 / MOB-053: a missed skill comes back two cards later, in the place of a planned card (the count stays), under the kind cap
    if (!v.correct && this.plan.mode !== 'boss' && (this.repeats[v.skill] ?? 0) < MAX_REPEATS_PER_SKILL) {
      const kind = this.kindUnderCap(v.kind, v.skill, `repeat:${this.verdicts.length}`);
      const slots = this.queue.map((it, i) => ({ it, i })).filter(x => x.it.type === 'decision' && !(x.i > 0 && this.queue[x.i - 1]!.type === 'rule'));
      const target = slots.slice(1).find(x => x.it.type === 'decision' && x.it.micro.skill !== v.skill) ?? slots.slice(1)[0] ?? slots[0];
      if (kind && target) {
        this.repeats[v.skill] = (this.repeats[v.skill] ?? 0) + 1;
        const n = this.verdicts.length;
        this.queue[target.i] = { type: 'decision', micro: { kind, skill: v.skill, seed: seedOf(`repeat:${this.plan.seed}:${n}`), variant: (n + 1) % 4 } };
      }
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

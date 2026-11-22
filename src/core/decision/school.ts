/**
 * Rally School 2.0 engine hooks (Phase IX, SCH-004 / SCH-005 / SCH-007). Pure: no DOM, no clock.
 *  - miniSim(kind, seed): a DecisionRun with exactly one decision of `kind` (microScenario + DecisionRunner), the guided control and
 *    its pointer, and retry() for the second try after a wrong answer.
 *  - tryItPlan(module, seed, progress): the module's closing run, exactly 5 decisions, only the module's kinds, no rule cards.
 * The course data (content/course.ts) is the content agent's; only its types are used here, structurally.
 */
import { CONTROL_IDS, type ControlId } from '../../../content/course-types.js';
import { rng } from '../rng.js';
import { DecisionRun, interleave } from './scheduler.js';
import { SKILL_OF_KIND, SKILLS, TIMED_KINDS, type MicroForm, type DecisionKind, type DecisionProgressState, type MicroSpec, type RunPlan, type Skill } from './types.js';
import type { Progress } from './progress.js';

export { CONTROL_IDS };
export type { ControlId };

/** The control a card of each kind exercises (the default pointer target of miniSim). */
export const CONTROL_OF_KIND: Record<DecisionKind, ControlId> = {
  preread: 'book', turn: 'callTurn', speedChange: 'callAtMark', timedStart: 'callAtMark', pause: 'chartCell', restart: 'launch',
  transitOut: 'holdCard', makeup: 'makeup', hazard: 'taCard', ta: 'taCard', lost: 'callTurn', checkpoint: 'callSpeed', clock: 'clock', watch: 'watchLap',
};
/** One-line pointers (<= 14 words) naming the one control a mini-sim page teaches. */
export const POINTER_OF_CONTROL: Record<ControlId, string> = {
  book: 'Look at the book row, then tap your answer.',
  callTurn: 'Tap the turn you would call to the driver.',
  callSpeed: 'Tap the speed you would call.',
  go: 'Tap GO when the watch reaches the wait.',
  watchStartStop: 'Tap START at the first sign, LAP at the second.',
  watchLap: 'Tap LAP as the car reaches the sign.',
  chartCell: 'Read the chart cell, then tap GO on that second.',
  distanceBar: 'Watch the bar; tap CALL when it reaches the tick.',
  // PT-16 B2: what is graded right is the call half a ramp before the sign, not the call on Mark
  callAtMark: 'Tap CALL half a ramp before the Mark, when the bar reaches the tick.',
  clock: 'Read the clock and watch, then tap your answer.',
  todStrip: 'Read the time of day, then tap your answer.',
  launch: 'Tap LAUNCH at the second you work out.',
  makeup: 'Pick the make-up move.',
  taCard: 'Pick what to do about the delay.',
  holdCard: 'Pick the OUT time.',
  desk: 'The Desk has every control.',
};

/** R4 (PT-18): a pointer is built from the card in front of the player. A number in a pointer ("about 2 s before the hold ends") is the
 *  card's own lead (the chart's seconds, as the prompt prints it) or, on a card that prints none, "half a ramp"; a watch card with START and
 *  LAP points at both, in that order. */
export function cardPointer(pointer: string, d: { kind: DecisionKind; prompt: string; timing?: { kind: string } | undefined; context?: { chart?: { seconds: number } | null | undefined } | undefined }): string {
  let out = pointer;
  if (/\babout [\d.]+ s before\b/.test(out)) {
    const n = d.prompt.match(/\b(\d+(?:\.\d+)?) s before\b/)?.[1] ?? (d.context?.chart ? d.context.chart.seconds.toFixed(1) : null);
    out = out.replace(/\babout [\d.]+ s before\b/, n ? `${n} s before` : 'half a ramp before');
  }
  if (d.kind === 'watch' && d.timing?.kind === 'startStop' && /^Tap LAP as the car reaches the sign\.$/.test(out)) out = POINTER_OF_CONTROL.watchStartStop;
  return out;
}

export interface MiniSimOptions { rung?: 0 | 1 | 2 | 3; control?: ControlId; variant?: number; /** PT-16 SCH-015 / SCH-025: the School form of the kind */ form?: MicroForm; /** PT-16 SCH-012: the page's own pointer line */ pointer?: string }
export interface GuidedInfo { control: ControlId; pointer: string }

/** SCH-005: a run of exactly one decision of `kind` (same DecisionRun API the run screen uses), plus the guided metadata. */
export class MiniSim extends DecisionRun {
  readonly kind: DecisionKind;
  readonly seed: number;
  readonly guided: GuidedInfo;
  /** 1 for the first try, 2 after retry(). */
  readonly attempt: number;
  private readonly spec: { kind: DecisionKind; seed: number; opts: MiniSimOptions };
  constructor(kind: DecisionKind, seed: number, opts: MiniSimOptions = {}, attempt = 1) {
    super(miniPlan(kind, seed, opts));
    this.kind = kind; this.seed = seed; this.attempt = attempt; this.spec = { kind, seed, opts };
    const control = opts.control ?? CONTROL_OF_KIND[kind];
    this.guided = { control, pointer: opts.pointer ?? POINTER_OF_CONTROL[control] };
  }
  /** The same scenario again for a second try (a fresh run; the first run's verdict stays with the caller). */
  retry(): MiniSim { return new MiniSim(this.spec.kind, this.spec.seed, this.spec.opts, this.attempt + 1); }
}

function miniPlan(kind: DecisionKind, seed: number, opts: MiniSimOptions): RunPlan {
  const skill = SKILL_OF_KIND[kind];
  const micro: MicroSpec = { kind, skill, seed, variant: opts.variant ?? ((seed % 4) + 4) % 4, ...(opts.form ? { form: opts.form } : {}) };
  return { seed, mode: 'practice', skills: [skill], rung: opts.rung ?? 2, items: [{ type: 'decision', micro }], decisionCount: 1 };
}

export function miniSim(kind: DecisionKind, seed: number, opts: MiniSimOptions = {}): MiniSim { return new MiniSim(kind, seed, opts); }

/** SCH-007: the cards in a try-it run. */
export const TRY_IT_CARDS = 5;
export interface TryItModule { id: string; tryIt: { skills: readonly string[]; kinds: readonly DecisionKind[]; cards: number;
  /** PT-16 SCH-020: the sub-case variants a kind may take (Module 0: green checkpoints only) */ variants?: Partial<Record<DecisionKind, readonly number[]>>;
  /** PT-16 SCH-015: the School form a kind is played in (Module 3: the watch as START / LAP) */ forms?: Partial<Record<DecisionKind, MicroForm>> };
  /** the module's pages (only mini-sim kinds are read, by runKinds) */ pages?: readonly { kind: string; decisionKind?: DecisionKind }[] }

/**
 * SCH-007: the module's closing run: exactly 5 decisions drawn only from `module.tryIt.kinds` (round-robin from a seeded order, the
 * kinds cycling so each appears), no rule cards, timed cards kept apart where there are option cards. Reproducible from (module, seed).
 * `progress` is accepted for symmetry with the Scheduler (the try-it never shows rule cards, so it does not change the plan).
 */
export function tryItPlan(module: TryItModule, seed: number, _progress?: Progress | DecisionProgressState | null): RunPlan {
  void _progress;
  const kinds = [...new Set(module.tryIt.kinds)];
  if (!kinds.length) throw new Error(`module ${module.id} has no try-it kinds`);
  const r = rng(`tryit:${module.id}:${seed}`);
  const order = kinds.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const slots: MicroSpec[] = [];
  for (let i = 0; i < TRY_IT_CARDS; i++) {
    const kind = order[i % order.length]!;
    const vs = module.tryIt.variants?.[kind]; const form = module.tryIt.forms?.[kind];
    slots.push({ kind, skill: SKILL_OF_KIND[kind], seed: rng(`tryit-slot:${module.id}:${seed}:${i}`).int(1, 2 ** 31 - 2), variant: vs?.length ? vs[r.int(0, vs.length - 1)]! : r.int(0, 3), ...(form ? { form } : {}) });
  }
  const ordered = interleave(slots, m => TIMED_KINDS.includes(m.kind));
  const skills = [...new Set(ordered.map(m => m.skill))] as Skill[];
  // maxPerKind 99: a missed card's repeat keeps its own kind, so the run never leaves the module's kinds
  const variants = module.tryIt.variants ? Object.fromEntries(Object.entries(module.tryIt.variants).map(([k, v]) => [k, [...(v ?? [])]])) as RunPlan['variants'] : undefined;
  return { seed, mode: 'practice', skills: skills.length ? skills : [...SKILLS], rung: 2, items: ordered.map(micro => ({ type: 'decision', micro })), decisionCount: TRY_IT_CARDS, maxPerKind: 99, kinds, ...(variants ? { variants } : {}) };
}
/** PT-17 N4 (B15): try-it stars come from correct answers: 0 correct is 0 stars; 3 stars needs every card correct, or all but one with the
 *  seconds off within TRY_IT_SECONDS_FOR_3; 3 of 5 (60 %) is 2 stars; any correct answer is 1. Below TRY_IT_PASS of the cards the
 *  recap's first button is "Try again". */
export const TRY_IT_SECONDS_FOR_3 = 10;
export const TRY_IT_PASS = 0.6;
export function tryItStars(r: { correct: number; total: number; secondsTotal: number }): 0 | 1 | 2 | 3 {
  const { correct, total } = r; if (!total || correct <= 0) return 0;
  if (correct >= total || (total - correct === 1 && correct >= 4 && r.secondsTotal <= TRY_IT_SECONDS_FOR_3)) return 3;
  return correct / total >= TRY_IT_PASS ? 2 : 1;
}
/** R2 (PT-18): the recap's sum line. "n of m correct", plus " · x s off" only when the run had a timed card (an option run has no seconds). */
export function recapSum(r: { correct: number; total: number; secondsTotal: number; verdicts?: readonly { kind: DecisionKind }[] }): string {
  const timed = (r.verdicts ?? []).some(v => TIMED_KINDS.includes(v.kind));
  return `${r.correct} of ${r.total} correct${timed ? ` · ${r.secondsTotal.toFixed(1)} s off` : ''}`;
}
export const tryItPassed = (r: { correct: number; total: number }): boolean => r.total > 0 && r.correct / r.total >= TRY_IT_PASS;
export function tryItRun(module: TryItModule, seed: number, progress?: Progress | DecisionProgressState | null): DecisionRun { return new DecisionRun(tryItPlan(module, seed, progress)); }

/** The course the agent protocol resolves module ids against (the app or the CLI registers content/course.ts's COURSE once). */
let registered: readonly (TryItModule & { controls?: readonly ControlId[] })[] = [];
export function registerCourse(modules: readonly (TryItModule & { controls?: readonly ControlId[] })[]): void { registered = modules; }
export function courseModule(id: string): (TryItModule & { controls?: readonly ControlId[] }) | undefined { return registered.find(m => m.id === id); }

/** PT-16 SCH-013 / PT-17 SCH-033: modules 0..6 are the core; until modules 7..10 are also done, daily and skill runs draw only the
 *  kinds of the core modules plus those of every module completed so far (the try-it and mini-sim kinds), also for a visitor who never
 *  started the course. null = no limit: modules 7..10 are done (or no course is registered). */
export const RUN_LIMIT_CORE = 7;
export const RUN_LIMIT_UNTIL = [7, 8, 9, 10];
export function runKinds(c: { modulesDone: readonly string[]; pages?: Record<string, number> } | null | undefined, modules: readonly TryItModule[] = registered): DecisionKind[] | null {
  if (!modules.length) return null;
  // PT-17 N6 (B13): a visitor with no course progress is limited to the core kinds too (Home's daily and skill runs never serve a newcomer
  // a TA claim or an exact transit before the course has taught them)
  const done = new Set(c?.modulesDone ?? []);
  if (RUN_LIMIT_UNTIL.every(i => modules[i] && done.has(modules[i]!.id))) return null;
  const out = new Set<DecisionKind>();
  modules.forEach((m, i) => {
    if (i >= RUN_LIMIT_CORE && !done.has(m.id)) return;
    for (const k of m.tryIt.kinds) out.add(k);
    for (const p of m.pages ?? []) if (p.kind === 'minisim' && p.decisionKind) out.add(p.decisionKind);
  });
  return [...out];
}

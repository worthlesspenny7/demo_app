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
import { SKILL_OF_KIND, SKILLS, TIMED_KINDS, type DecisionKind, type DecisionProgressState, type MicroSpec, type RunPlan, type Skill } from './types.js';
import type { Progress } from './progress.js';

export { CONTROL_IDS };
export type { ControlId };

/** The control a card of each kind exercises (the default pointer target of miniSim). */
export const CONTROL_OF_KIND: Record<DecisionKind, ControlId> = {
  preread: 'book', turn: 'callTurn', speedChange: 'callAtMark', timedStart: 'callAtMark', pause: 'chartCell', restart: 'launch',
  transitOut: 'holdCard', makeup: 'makeup', hazard: 'taCard', ta: 'taCard', lost: 'callTurn', checkpoint: 'book', clock: 'clock', watch: 'watchLap',
};
/** One-line pointers (<= 12 words) naming the one control a mini-sim page teaches. */
export const POINTER_OF_CONTROL: Record<ControlId, string> = {
  book: 'Look at the book row, then tap your answer.',
  callTurn: 'Tap the turn you would call to the driver.',
  callSpeed: 'Tap the speed you would call.',
  go: 'Tap GO when the stop is over.',
  watchStartStop: 'Tap START and STOP on the stopwatch.',
  watchLap: 'Tap LAP at the marker.',
  chartCell: 'Read the chart cell, then answer.',
  distanceBar: 'Watch the distance bar for the Mark.',
  callAtMark: 'Tap CALL at the Mark.',
  clock: 'Read the dash clock.',
  todStrip: 'Read the time of day strip.',
  launch: 'Tap LAUNCH at the second you work out.',
  makeup: 'Pick the make-up move.',
  taCard: 'Use the TA card to claim the delay.',
  holdCard: 'Use the hold card for the OUT time.',
  desk: 'The Desk has every control.',
};

export interface MiniSimOptions { rung?: 0 | 1 | 2 | 3; control?: ControlId; variant?: number }
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
    this.guided = { control, pointer: POINTER_OF_CONTROL[control] };
  }
  /** The same scenario again for a second try (a fresh run; the first run's verdict stays with the caller). */
  retry(): MiniSim { return new MiniSim(this.spec.kind, this.spec.seed, this.spec.opts, this.attempt + 1); }
}

function miniPlan(kind: DecisionKind, seed: number, opts: MiniSimOptions): RunPlan {
  const skill = SKILL_OF_KIND[kind];
  const micro: MicroSpec = { kind, skill, seed, variant: opts.variant ?? ((seed % 4) + 4) % 4 };
  return { seed, mode: 'practice', skills: [skill], rung: opts.rung ?? 2, items: [{ type: 'decision', micro }], decisionCount: 1 };
}

export function miniSim(kind: DecisionKind, seed: number, opts: MiniSimOptions = {}): MiniSim { return new MiniSim(kind, seed, opts); }

/** SCH-007: the cards in a try-it run. */
export const TRY_IT_CARDS = 5;
export interface TryItModule { id: string; tryIt: { skills: readonly string[]; kinds: readonly DecisionKind[]; cards: number } }

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
    slots.push({ kind, skill: SKILL_OF_KIND[kind], seed: rng(`tryit-slot:${module.id}:${seed}:${i}`).int(1, 2 ** 31 - 2), variant: r.int(0, 3) });
  }
  const ordered = interleave(slots, m => TIMED_KINDS.includes(m.kind));
  const skills = [...new Set(ordered.map(m => m.skill))] as Skill[];
  // maxPerKind 99: a missed card's repeat keeps its own kind, so the run never leaves the module's kinds
  return { seed, mode: 'practice', skills: skills.length ? skills : [...SKILLS], rung: 2, items: ordered.map(micro => ({ type: 'decision', micro })), decisionCount: TRY_IT_CARDS, maxPerKind: 99 };
}
export function tryItRun(module: TryItModule, seed: number, progress?: Progress | DecisionProgressState | null): DecisionRun { return new DecisionRun(tryItPlan(module, seed, progress)); }

/** The course the agent protocol resolves module ids against (the app or the CLI registers content/course.ts's COURSE once). */
let registered: readonly (TryItModule & { controls?: readonly ControlId[] })[] = [];
export function registerCourse(modules: readonly (TryItModule & { controls?: readonly ControlId[] })[]): void { registered = modules; }
export function courseModule(id: string): (TryItModule & { controls?: readonly ControlId[] }) | undefined { return registered.find(m => m.id === id); }

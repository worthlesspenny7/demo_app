/** Drill definitions. DESIGN §14. */
import type { Scenario, AidsConfig, DriverSpec } from '../course.js';
import type { StageResult } from '../sim.js';

/**
 * `tip` (EDU-002): the drill's own "Fix this next" sentence. When the stars come from something other than the leg error (call timing, chart
 * cells, notations, laps, departures) it names that skill; it is never "Clean run" under a 0-2 star result. The Debrief shows it first.
 */
export interface Rubric { score: number; stars: 0 | 1 | 2 | 3; feedback: string[]; headline: string; tip?: string }

export interface DrillTier { name: string; aids: AidsConfig; driver: DriverSpec; description: string }

export interface Drill {
  id: string;                 // e.g. "D03"
  title: string;
  objective: string;          // one sentence, learner-facing
  skills: string[];           // P1..P13 ids from REQUIREMENTS §2
  /** Approximate minutes of sim time per run. */
  minutes: number;
  /** Build a fresh scenario; `tier` picks aids/driver; `seed` makes runs reproducible/variable. */
  scenario(seed: number, tier: number): Scenario;
  tiers: DrillTier[];
  /** Grade a finished run. */
  rubric(result: StageResult, scenario: Scenario): Rubric;
  /** Drill ids (with min stars) required before this unlocks. */
  unlock: { drill: string; stars: number }[];
  /** EDU-005: School lessons to read first (shown as a link on the drill card); `lessonGate` ones must be passed before the drill unlocks. */
  readFirst?: string[];
  lessonGate?: string[];
  /** EDU-005: per-tier extra unlocks, e.g. Gold D03/D04/D05 need D06 passed (index into `tiers`). */
  tierUnlock?: Record<number, { drill: string; stars: number }[]>;
  /** Static (non-driving) drills render their own UI; the engine does not run. */
  kind: 'drive' | 'quiz' | 'math' | 'reading';
}

/** Decision mode public API (MOB-001..007, docs/spec/MOBILE.md). Types only; the implementations live in
 *  runner.ts (DecisionRunner), scheduler.ts (Scheduler, DecisionRun), scenarios.ts (micro scenarios) and
 *  progress.ts (Progress). Import everything from './index.js'. */
import type { Scenario } from '../course.js';

/** The Four S's as five skill meters (MOB-006, MOB-031). */
export type Skill = 'safetyCourse' | 'startOnTime' | 'stayOnTime' | 'recovery' | 'instruments';
export const SKILLS: readonly Skill[] = ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'];
export const SKILL_TITLE: Record<Skill, string> = {
  safetyCourse: 'Safety and course', startOnTime: 'Start on time', stayOnTime: 'Stay on time', recovery: 'Recovery', instruments: 'Instruments',
};

/** Decision point kinds (MOB-002). */
export type DecisionKind =
  | 'preread' | 'turn' | 'speedChange' | 'timedStart' | 'pause' | 'restart' | 'transitOut'
  | 'makeup' | 'hazard' | 'ta' | 'lost' | 'checkpoint' | 'clock' | 'watch';
export const DECISION_KINDS: readonly DecisionKind[] = ['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock', 'watch'];
/** Which meter a decision kind fills. */
export const SKILL_OF_KIND: Record<DecisionKind, Skill> = {
  preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', lost: 'recovery',
  restart: 'startOnTime', transitOut: 'startOnTime',
  pause: 'stayOnTime', speedChange: 'stayOnTime', timedStart: 'stayOnTime',
  makeup: 'recovery', hazard: 'recovery', ta: 'recovery',
  clock: 'instruments', watch: 'instruments',
};
/** The kinds the player answers in real time (MOB-004); every other kind is instant. */
export const TIMED_KINDS: readonly DecisionKind[] = ['pause', 'restart', 'timedStart', 'speedChange'];

export interface DecisionOption { id: string; label: string }

/** Real-time decisions (MOB-004). All seconds are measured from the moment the card is shown (the
 *  decision's `context.tod`). `truthSeconds` is the ideal tap; `toleranceSeconds` is what still counts as
 *  correct. 'countdown': hold, then tap GO at truthSeconds (pause). 'tapAt': tap the launch / call second
 *  (restart, speedChange). 'startStop': tap START at the sign (truth 0 = now), then tap the next speed at
 *  `secondTapSeconds` (timedStart). */
export interface TimingSpec {
  kind: 'tapAt' | 'countdown' | 'startStop';
  truthSeconds: number;
  toleranceSeconds: number;
  /** startStop only: the ideal second tap, from the card's moment. */
  secondTapSeconds?: number;
  /** Longest wait the UI should allow before answering automatically (a late tap). */
  maxSeconds: number;
  /** MOB-052: seconds from the card's moment until the front of the car reaches the sign (the driver says "Mark!" then and the
   *  distance bar reaches zero). Present on speedChange and timedStart cards, the only cards that ask for a tap "at the sign". */
  signSeconds?: number;
  /** Distance to the sign at the card's moment (ft), for the shrinking distance bar. */
  signFt?: number;
  /** MOB-058: the big digits of the face show the time of day (restart / launch cards); the elapsed count is small. */
  todPrimary?: boolean;
  /** PT-14 N6: a long hold shown compressed. When the card's clock reaches `at` s it jumps to `to` s (the watch and the TOD digits jump,
   *  the card says so with `note`); taps are still reported in card seconds. Wall time after the jump = card time - (to - at). */
  skip?: { at: number; to: number; note: string; /** PT-15 P5: the full explanation, shown behind "details" (the prompt carries only `note`). */ detail?: string };
  /** What the tap does in the car ("GO", "LAUNCH", "CALL 45", "START"). */
  tapLabel: string;
  secondTapLabel?: string;
}

/** A book row as shown on the card (GRIID columns, see src/core/griid.ts). */
export interface BookRowView {
  line: number;
  odometer: string;          // Column A box ("0045")
  miles: number;
  columnB: string[];         // pictogram ids (columnBSymbols)
  columnC: string[];         // speeds / pauses / times (columnCLines)
  columnD: string;           // remark or GRIID-004 sentence (empty at the legal rung)
  cameoSvg?: string;
}

/** A simple chart cell the card uses (MOB-050): `meaning` says what the number is: 'sit' = the time to wait at a pause (pause - loss),
 *  'loss' = the stop-and-go or standing-start loss to subtract, 'lead' = how early to call a change. The chip is labelled by it. */
export interface ChartCell { kind: 'stopGo' | 'accel' | 'lead' | 'turn' | 'speedChange'; vIn: number; vOut: number; seconds: number; meaning?: 'sit' | 'loss' | 'lead' }

/** The facts a card may show (MOB-001). Absent fields are not relevant to the decision. */
export interface DecisionContext {
  /** Time of day (s since midnight) at the moment of the card. */
  tod: number;
  /** Seconds since the stage start. */
  elapsed: number;
  /** PT-14: the stage's time-zone label as the book prints it ("CDT"); times on the card read "CDT 9:31:50" (12-hour). */
  zone?: string;
  line?: number;
  row?: BookRowView;
  nextRow?: BookRowView;
  speeds?: { current: number; assigned: number; in?: number; out?: number; target?: number };
  distanceFt?: number;
  /** Printed or computed times (time of day in s since midnight unless named Seconds). */
  times?: { base?: number; own?: number; launch?: number; in?: number; out?: number; intervalSeconds?: number; pauseSeconds?: number; /** MOB-058: starting position in minutes after the base time (RULE-010) */ position?: number };
  /** The simple chart cell that applies (buildPerfTable), seconds; `kind` names the chart. */
  chart?: ChartCell | null;
  /** Seconds late (+) / early (-) against the ghost at this moment; present only for recovery cards. */
  lateSeconds?: number;
  hazard?: { kind: string; label: string };
  /** Dash clock face (degrees from 12) and its minute when readable. */
  clock?: { hourAngle: number; minuteAngle: number; secondAngle: number; minuteAmbiguous: boolean; minute: number | null };
  /** TA ledger facts for a ta card: `measured` = the delay on the watch (whole s), `madeUp` = what the card says could be made up. */
  ta?: { measured: number; claim: number; cause: string | null; legIndex: number; madeUp?: number };
  /** MOB-053: the stopwatch as a stopwatch card shows it (main digits and the lap table, seconds). */
  watch?: { reading: number; laps: { interval: number; cumulative: number }[] };
  /** MOB-055: a posted limit the card shows (make-up), mph. */
  limit?: number;
  /** MOB-055: what lies ahead within the make-up room (a timed interval or the checkpoint) and how far, ft. */
  room?: { what: 'timed' | 'checkpoint'; ft: number };
  /** MOB-056: a lost card: seconds since the car left the route, and the extra time of the detour when the road meets the route again (null = it does not). */
  lost?: { agoSeconds: number; detourSeconds: number | null };
  /** Free text the card may print under the prompt (<= 20 words). */
  note?: string;
}

export interface Decision {
  /** Unique within a runner: `${kind}:${line}:${n}`. */
  id: string;
  kind: DecisionKind;
  skill: Skill;
  /** <= 40 words (MOB-012). */
  prompt: string;
  context: DecisionContext;
  options?: DecisionOption[];
  timing?: TimingSpec;
  /** Instant cards with a time limit (turn): seconds the player has. */
  deadlineSeconds?: number;
}

/** The navigator's answer. `optionId` for option cards; `tapSeconds` (from the card's moment) for timed
 *  cards; `taps` for startStop (two taps). A missing / null answer = no action (timeout). */
export interface DecisionResponse { optionId?: string; tapSeconds?: number; taps?: number[] }

export interface Verdict {
  decisionId: string;
  kind: DecisionKind;
  skill: Skill;
  /** Seconds against the ghost this decision cost (+ late / - early) measured at the verdict moment;
   *  for instant choices, the cost relative to the right answer. */
  secondsDelta: number;
  correct: boolean;
  /** One sentence naming the rule, ending with its source in parentheses. */
  rule: string;
  ruleId: string;
  source: string;
  /** What the right answer was, short ("GO at 8.4 s", "Left"). */
  expected: string;
  /** What the player did, short. */
  chosen: string;
  /** MOB-054: the part that was missed, for the headline ("START 1.6 s early", "claimed 10 s too much"); absent when right. */
  missed?: string;
  /** Seconds of sim time until the next decision (null when none left in this scenario). */
  nextDecisionIn: number | null;
}

/** A rule card shown before the first decision of a skill not yet passed (MOB-005, MOB-010). */
export interface RuleCard { id: string; skill: Skill; text: string; source: string; title?: string; kinds?: DecisionKind[]; /** MOB-061: the card as a phone screen shows it (one rule and its number, <= 40 words); `text` stays one tap away. */ short?: string }

export interface DecisionRunnerOptions {
  /** Which kinds are presented; the others are handled by the runner as a perfect navigator. Default: all. */
  kinds?: readonly DecisionKind[];
  /** Aids rung (0 = legal, no hints, chart cell withheld). Default: the scenario's. */
  rung?: 0 | 1 | 2 | 3;
  /** Stop after this many presented decisions (micro-runs). */
  maxDecisions?: number;
}

/** One micro scenario slot in a run (MOB-004/005). */
export interface MicroSpec {
  kind: DecisionKind; skill: Skill; seed: number; variant: number;
  /** Boss run: play a full generated leg (seed = `seed`) in decision mode, up to this many decisions of every kind (MOB-031). */
  bossLeg?: number;
}

export type RunItem =
  | { type: 'rule'; card: RuleCard }
  | { type: 'decision'; micro: MicroSpec };

export interface RunPlan {
  seed: number;
  /** 'practice' (skill plan), 'daily' (daily set run), 'boss' (full leg). */
  mode: 'practice' | 'daily' | 'boss';
  skills: Skill[];
  rung: 0 | 1 | 2 | 3;
  items: RunItem[];
  /** Decision slots (10-15; boss about 25). Repeats inserted during play may add up to 15 in total. */
  decisionCount: number;
  /** The calendar day of a daily-set run ("2026-10-23") and its index 0..2. */
  day?: string; dailyIndex?: number;
  /** MOB-032: the Desk drill this run stands in for (its stars are recorded there too). */
  drillId?: string;
  /** PT-14 N5: the per-kind cap of this run (MAX_PER_KIND, relaxed in a single-skill run so the run is two thirds that skill). */
  maxPerKind?: number;
}

export interface SkillTally { skill: Skill; correct: number; total: number; seconds: number }

export interface RunResult {
  seed: number;
  mode: RunPlan['mode'];
  verdicts: Verdict[];
  secondsTotal: number;
  correct: number;
  total: number;
  tallies: Record<Skill, SkillTally>;
  stars: 0 | 1 | 2 | 3;
  /** The three worst cards (most seconds or wrong) with their rule. */
  worst: { verdict: Verdict; rule: string; source: string }[];
  ruleCardsShown: string[];
}

export type RunStep =
  | { type: 'rule'; card: RuleCard; index: number; of: number }
  | { type: 'decision'; decision: Decision; index: number; of: number };

/** Persisted progress for decision mode (MOB-030/031/032), stored next to the Desk progress. */
export interface SkillMeter { value: number; correct: number; total: number; lastDay: string | null; passed: boolean }
export interface DecisionProgressState {
  version: 1;
  meters: Record<Skill, SkillMeter>;
  streak: { current: number; best: number; lastDay: string | null };
  daily: { day: string | null; completed: number[]; best: Record<string, number> };
  rulesSeen: string[];
  /** Unfinished run for "Continue": its plan and the responses so far (replayed deterministically). */
  unfinished: { plan: RunPlan; responses: (DecisionResponse | null)[] } | null;
  runs: number;
  /** MOB-059: finished Boss runs (the first one plays at rung 2 with the chart on the card, later ones at rung 1 with a chart button). */
  bossRuns?: number;
}

export type { Scenario };

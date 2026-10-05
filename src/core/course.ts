/** Course (hidden truth) and book (visible) types. See docs/spec/DESIGN.md §3. */
export type Surface = 'paved' | 'gravel';
export type ExitKind = 'road' | 'driveway' | 'lot' | 'deadend' | 'private';
export type Control = 'STOP' | 'YIELD' | 'SIGNAL' | 'BLINKER' | 'RR' | 'none';
export type TurnDir = 'L' | 'R' | 'S' | 'BL' | 'BR' | 'AL' | 'AR' | 'JL' | 'JR';
/**
 * Sign faces of the CAMEO sign library (11a section 3, 11b section 3). 'rect' / 'blade' / 'shield' are text signs (green freeway, street name, route shield);
 * 'speedlimit' is the white "Speed Limit NN" rectangle (the posted limit, NOT the assigned speed); 'diamond', 'curve', 'reverse-curve', 'stop-ahead', 'speed-ahead',
 * 'crossroad' and 'rr-advance' are warning signs (white diamond or round, black pictogram, optional advisory plaque); 'business' is the white-on-black box;
 * 'tracks' is the railroad-tracks row with its yield triangle; 'tollbooth' and 'landmark' are the line-drawn pictures with a caption.
 */
export type SignShape = 'octagon' | 'triangle' | 'rect' | 'diamond' | 'blade' | 'shield' | 'rr' | 'checkpoint'
  | 'speedlimit' | 'curve' | 'reverse-curve' | 'stop-ahead' | 'speed-ahead' | 'crossroad' | 'rr-advance' | 'business' | 'tracks' | 'tollbooth' | 'landmark';
/** Where a sign stands: left or right of the road, or overhead (the box is centred on the arrow, 11a: row 12 "sign overhead"). */
export type SignSide = 'L' | 'R' | 'O';
export type TimeZoneLabel = 'EDT' | 'EST' | 'CDT' | 'CST' | 'MDT' | 'MST' | 'PDT' | 'PST';
export type Section = 'warmup' | 'calibration' | 'start' | 'transit' | 'freezone' | 'lunch' | 'refuel' | 'pit' | 'finish' | 'restart';

export interface Exit {
  /** Degrees relative to the approach heading: 0 straight, negative left, positive right. */
  angle: number;
  surface: Surface;
  kind: ExitKind;
  name?: string;
  /** The name is printed in parentheses in the CAMEO, "(US 1 North)": an unposted or informational name (REG VII.B.3.e). */
  bracketed?: boolean;
  /** Traffic control facing traffic on that exit road (e.g. a STOP for the side road). */
  controlOnExit?: Control;
  isRoute: boolean;
}

/** `plaque`: the advisory speed on the small rectangle under a warning diamond (large number over small "MPH"). */
export interface Sign { text: string; shape: SignShape; side: SignSide; plaque?: number }

export interface Node {
  id: string;
  /** Hidden arc-length position (ft) from stage start. */
  s: number;
  kind: 'intersection' | 'sign' | 'landmark' | 'start' | 'finish';
  /** What controls OUR approach at this node. */
  control: Control;
  exits?: Exit[];
  sign?: Sign;
  /** Feet before s at which the feature becomes visible. */
  sightDistance: number;
  /** Feet before s where the car stops (stop line). Default 0. */
  stopLineOffset?: number;
  /** Optional description shown in the road view ("bridge", "RR crossing", "church on R"). */
  label?: string;
  /** Ramp or multi-lane approach: the CAMEO draws lane-marking ticks on the stem (11a row 4). */
  ramp?: boolean;
  /** GEN-016: the car comes to a full stop here although the control is not a STOP sign: a flashing-red blinker or railroad tracks the book pauses at (REG Example #15, 11b rows 102-103). */
  fullStop?: boolean;
}

/** `delayed`: Column C prints the interval first ("1m12s / 40 MPH"); holdSpeed is the speed already in force (VII.E.2.d). */
/** GEN-017: the speed in force once a timed segment (and its chain) is over. */
export function timedFinalSpeed(t: TimedSegment): number { return t.chain?.length ? t.chain[t.chain.length - 1]!.thenSpeed : t.thenSpeed; }
export interface TimedSegment { holdSpeed: number; seconds: number; thenSpeed: number; delayed?: boolean;
  /** GEN-017: a chained timed change (REG Example #14 "30 MPH / 0m36s / 45 MPH / 1m12s / 50 MPH"): after thenSpeed, hold it for chain[0].seconds, then chain[0].thenSpeed, ... */
  chain?: { seconds: number; thenSpeed: number }[] }

export interface Instruction {
  n: number;
  nodeId: string;
  text: string;
  section?: Section;
  turn?: TurnDir;
  /** Assigned speed (mph) from this point. */
  speed?: number;
  /** Seconds added to the leg at this point. */
  pause?: number;
  timed?: TimedSegment;
  perfectInterval?: number;
  perfectCumulative?: number;
  hint?: string;
  /** TOD seconds for start/restart lines (= baseTime + scenario.asp * 60 when baseTime is set). */
  restartTime?: number;
  /** Printed base time of day of a start/restart line (STAGE-002: the team leaves at base + ASP minutes). */
  baseTime?: number;
  /** GRIID Column D remark ("Comes quick", "Look sharp", "$1.50"); `hint` is kept as a legacy alias with the same text. */
  remark?: string;
  /** Transit (STAGE-003). `exact`: take exactly `seconds` (OUT = IN + seconds); advisory transits print "(seconds)". `end`: this line ends a transit. */
  transit?: TransitSpec;
  /** Guide row before a transit end: the seconds from this row to the end of the transit, printed "(0m30s)" (HB p.26 #11). Not scored. */
  transitGuide?: number;
  /** GRIID-011: a countdown row inside a long advisory transit: the time left to its end in whole minutes, printed "(10m00s)", "(8m00s)", "(3m00s)". Not scored. */
  transitCountdown?: number;
  /** Free zone begin/end (VII.C.5); no Timing Checkpoint lies between begin and end. */
  freeZone?: 'begin' | 'end';
  /** "End timed portion" line (crossed-out clock). */
  endTimed?: boolean;
  /** Time Allowance point (yellow box): requests are accepted for `windowSeconds` after the car passes it. */
  /** ENG-028: `stage` = the Stage number the TA row prints ("Today is Stage N.", REG Example #18 / #36) and the web form prefills */
  taPoint?: { windowSeconds: number; endOfStage: boolean; stage?: number };
  /** Promoted lunch/pit/refuel/rest stop inside a transit: "leave here X prior to your end-of-transit time". */
  promotedStop?: { kind: 'pit' | 'meal' | 'refuel' | 'rest'; leaveBeforeEndSeconds: number; /** an unhosted meal: the book prints "no-host" above the knife and fork */ noHost?: boolean };
  /** Information Box row (GRIID-016, 11a section 3): a rounded box over Columns B and C with the body text (host dinner, parc ferme, parking); Column D keeps its own list. Not an action: the line is complete when passed. */
  infoBox?: string;
  /** First line of the speedometer calibration run ("26m00s / 50 MPH / * 0m00.0s"). */
  calibrationStart?: boolean;
  /** GRIID-005: the number as printed when it is lettered ("3a", "3b"); `n` stays the unique execution order. */
  printed?: string;
  /** GRIID-005: the line is marked "omitted": it stays in the numbering and is skipped in execution. */
  omitted?: boolean;
}

/**
 * `exact` is true only where the instruction says "take exactly" (Column D, HB #30): OUT = IN + seconds. An interval printed without
 * parentheses is NOT automatically exact (REG VII.B.3.c(4) defines only the parenthesised advisory form; HB #10 `9m00s` and #34 `30m00s`
 * are plain but not "exactly"). `plain` prints the interval without parentheses for such official-but-not-exact intervals
 * (the calibration run's allowance, the transit to the finish).
 */
export interface TransitSpec { exact: boolean; seconds: number; miles?: number; end?: boolean; plain?: boolean }
/** PLAY-002: a suggested pace for a transit / warm-up line that prints no speed: printed miles over printed minutes, to the whole mph (null when the box prints no distance). */
export function transitPaceMph(t: TransitSpec | undefined): number | null {
  if (!t || t.end || !(t.miles !== undefined && t.miles > 0) || !(t.seconds > 0)) return null;
  return Math.max(5, Math.round(t.miles / (t.seconds / 3600)));
}

export interface Checkpoint { id: string; s: number; kind: 'timing' | 'observation'; sightDistance: number }

export interface SignalHazard { kind: 'signal'; s: number; redSeconds: number; greenSeconds: number; offset: number }
export interface TrainHazard { kind: 'train'; s: number; startTod: number; durationSeconds: number }
export interface SlowHazard { kind: 'slow'; s: number; speedMph: number; lengthFt: number; passWindowAfterFt?: number }
export interface ConstructionHazard { kind: 'construction'; s: number; speedMph: number; lengthFt: number }
/** Accident scene (V.H.1): the car is held to `speedMph` through the zone; the delay it causes is Time-Allowance qualifying. */
export interface AccidentHazard { kind: 'accident'; s: number; speedMph: number; lengthFt: number }
/**
 * TAF-002 / 10c Time Delay Form: delays the committee names (tractor, school bus, construction, combine) are Time-Allowance qualifying.
 * `tractor` and `combine` hold the car to `speedMph` through the zone (slow); `schoolBus` blocks the lane: while the bus is stopped
 * (`startTod` .. `startTod + durationSeconds`) a car arriving at `s` waits behind it (blocking).
 */
export interface TractorHazard { kind: 'tractor'; s: number; speedMph: number; lengthFt: number }
export interface CombineHazard { kind: 'combine'; s: number; speedMph: number; lengthFt: number }
export interface SchoolBusHazard { kind: 'schoolBus'; s: number; startTod: number; durationSeconds: number }
export type Hazard = SignalHazard | TrainHazard | SlowHazard | ConstructionHazard | AccidentHazard | TractorHazard | CombineHazard | SchoolBusHazard;

export interface CarSpec {
  name: string;
  year: number;
  /** Initial acceleration (ft/s^2) at rest. */
  a0: number;
  /** Speed (ft/s) at which acceleration approaches its floor. */
  vMax: number;
  /** Comfortable deceleration (ft/s^2). */
  aDec: number;
  turnSpeedMph: { turn: number; bear: number; acute: number };
  /** Length (ft) the car holds its apex speed in a turn (default 60): the part of a real turn that no chart-free model shows. */
  turnZoneFt?: number;
  /** Table-driven charts (CHART-002): when present, perf-table functions read these instead of simulating the model. */
  tables?: CarTables;
  /** SPEED-001: speeds (mph) of `tables` that are extrapolated, not printed (Packard: 55). */
  extrapolated?: number[];
}

/** Handbook-layout chart matrices (IN speed rows x OUT speed columns, tenths of a second). */
export interface Matrix { speeds: number[]; rows: Record<number, Record<number, number>> }
export interface CarTables { accel: Matrix; stopGo: Matrix; turns: Matrix }
/** SPEED-001: speeds a car's own chart does not print but the simulator extends (the Packard's printed 15-50 mph, extended to 55); flagged so the UI can mark them. */

export type SpeedoKind = 'timewise' | 'mechanical';
export interface SpeedoSpec {
  kind: SpeedoKind;
  /** Hidden multiplicative error of the true reading (1.0 = perfect). */
  gain: number;
  offset: number;      // mph
  quad: number;        // mph per mph^2
  tau: number;         // lag seconds
  bounce: number;      // mph amplitude
}

export type DriverSkill = 'rookie' | 'sportsman' | 'expert' | 'perfect';
export interface DriverSpec {
  skill: DriverSkill;
  /** 0..1, larger = less consistent ramps. */
  inconsistency: number;
  patienceSeconds: number;
  name: string;
}

export interface RulesConfig {
  /** Leg penalty caps (V.E.1.b-c): late 120 s, early 300 s. */
  maxLate: number;
  maxEarly: number;
  /** Missed Timing / Observation Checkpoint (V.E.2.a, c) and a checkpoint reached > missedCpLateMinutes after the computed cumulative perfect time (V.C.2.b). */
  missedCheckpoint: number;
  missedCpLateMinutes: number;
  /** Stopping or <= 5 mph within sight of a Timing Checkpoint (V.E.3.a). */
  sightZonePenalty: number;
  /** Observation Checkpoint crossed without the stop (V.A.1.b(1), REG-005). */
  observationMissPenalty: number;
  /** Leaving a promoted lunch/pit/rest stop more than this many minutes early (V.E.3.h): 1st / 2nd offence penalties, 3rd+ referral. */
  earlyDepartureMinutes: number;
  earlyDeparturePenalties: [number, number];
  /** Stage 0 (Trophy Run) is not part of the cumulative score (V.C.2.f). */
  trophyRunCounts: boolean;
  /** Over-request above the possible credit by more than this many seconds is flagged (TA-003). */
  taOverDeclareTolerance: number;
  /** Q5: is a red-signal wait a qualifying Time Allowance delay? Default false: V.H.1 names only a train blockage and assisting at an accident; the knob stays for committee discretion. */
  taForSignals: boolean;
  /** Committee credit granularity in seconds: the credit is rounded DOWN to a multiple of 10 s (V.H.3, V.H.6). Legacy books without a TA point score with 1 s. */
  taGranularitySeconds: number;
  /** Maximum single request (V.H.3): 29m30s. */
  taMaxRequestSeconds: number;
  /** Digital stopwatch: seconds a lap split stays frozen before the display releases itself; 0 = hold until recall (WATCH-008). */
  splitHoldSeconds: number;
  /** INST-001: the analog dash clock's minute hand is ambiguous this many seconds either side of the minute change (default 5). */
  clockMinuteSlop: number;
  /** TAF-001: 'web' = the 2026 web form after the TA point window; 'paper' = the older sheets handed in at any red (observation) checkpoint stop, no window (practice only). */
  taMode: 'web' | 'paper';
}

export interface AidsConfig {
  /** Aids ladder rung (DRILL-007): 3 full aids, 2 coarse, 1 driver check-off only, 0 Great Race legal. */
  rung: 0 | 1 | 2 | 3;
  paceBar: boolean;          // show seconds early/late live (rung 3 numeric, rung 2 coarse arrow)
  countdown: boolean;        // 3-2-1 cue before a timed change
  cumulativeTimes: boolean;  // print perfect cumulative times for all lines
  autoAdvanceLine: boolean;  // current line follows the car
  showTruthAfter: boolean;   // debrief shows truth (always true)
  /** Navigator's speedometer view: 'marks' = coarse mark spacing (legal realism), 'fine' = driver's reading. */
  showSpeedo: 'marks' | 'fine';
  /** Driver names each executed line ("Did the stop, forty-three"). */
  checkOff: boolean;
  /** Immediate checkpoint card (rung >= 2). */
  cpCard: boolean;
  offCourseAlert: boolean;
  /**
   * PT-10 N-C7: the perf card prints the dwell and the call times (the answer sheet). Default: rung 3 only; Silver (rung 2 in the usual 3-2-1 ladder) shows the chart and
   * the player does the arithmetic. A drill whose Bronze tier is itself at rung 2 (D16, D18, D11) sets this so Bronze keeps its numbers.
   */
  printsTimes?: boolean;
}

export interface Course { nodes: Node[]; lengthFt: number }

export interface Scenario {
  /** Rows per printed page when the book is laid out by hand (D15 uses 6); undefined = the default of 7 (ROWS_PER_PAGE in griid.ts). */
  rowsPerPage?: number;
  id: string;
  name: string;
  seed: number;
  car: CarSpec;
  speedo: SpeedoSpec;
  driver: DriverSpec;
  course: Course;
  book: Instruction[];
  checkpoints: Checkpoint[];
  hazards: Hazard[];
  /** Official start time of this team: printed base + asp minutes (STAGE-002). */
  startTime: number;
  /** Printed base start time of day (before the assigned starting position). Defaults to startTime when asp = 0. */
  baseStartTime?: number;
  /** Assigned starting position in minutes (STAGE-002); 0 for drills. */
  asp: number;
  /** Time-zone label printed on clock faces ("CDT 8:55:00"). */
  timeZone: TimeZoneLabel;
  /** 'example' prints the GRIID-004 sentence in Column D; 'race' prints remarks only (GRIID-009). */
  bookStyle: 'example' | 'race';
  prereadSeconds: number;
  rules: RulesConfig;
  aids: AidsConfig;
  /** Off-course excursion length (ft) used when a wrong exit is taken. */
  excursionFt?: number;
  /** Probability that cross traffic holds the car at a STOP for an extra 2-12 s. */
  trafficWaitProbability?: number;
  tags?: string[];
  /** PLAY-005: 'drill' = a drill-sized start (D01-D05): no start queue and no count; the car launches itself on the printed launch second. Default: the full start procedure. */
  startProcedure?: 'full' | 'drill';
}

export const DEFAULT_RULES: RulesConfig = {
  maxLate: 120, maxEarly: 300, missedCheckpoint: 180, missedCpLateMinutes: 30,
  sightZonePenalty: 30, observationMissPenalty: 180,
  earlyDepartureMinutes: 5, earlyDeparturePenalties: [60, 300],
  trophyRunCounts: false, taOverDeclareTolerance: 10, taForSignals: false, taGranularitySeconds: 10, taMaxRequestSeconds: 1770, splitHoldSeconds: 5, clockMinuteSlop: 5, taMode: 'web',
};
export const LEGAL_AIDS: AidsConfig = { rung: 0, paceBar: false, countdown: false, cumulativeTimes: false, autoAdvanceLine: false, showTruthAfter: true, showSpeedo: 'marks', checkOff: false, cpCard: false, offCourseAlert: false };
export const TRAINING_AIDS: AidsConfig = { rung: 3, paceBar: true, countdown: true, cumulativeTimes: true, autoAdvanceLine: true, showTruthAfter: true, showSpeedo: 'fine', checkOff: true, cpCard: true, offCourseAlert: true };
/** Aids ladder (DRILL-007). */
export function aidsForRung(rung: 0 | 1 | 2 | 3): AidsConfig {
  switch (rung) {
    case 3: return { ...TRAINING_AIDS };
    case 2: return { rung: 2, paceBar: true, countdown: true, cumulativeTimes: false, autoAdvanceLine: false, showTruthAfter: true, showSpeedo: 'fine', checkOff: true, cpCard: true, offCourseAlert: false };
    case 1: return { rung: 1, paceBar: false, countdown: false, cumulativeTimes: false, autoAdvanceLine: false, showTruthAfter: true, showSpeedo: 'marks', checkOff: true, cpCard: false, offCourseAlert: false };
    default: return { ...LEGAL_AIDS };
  }
}

export const FORD_1939: CarSpec = { name: '1939 Ford Deluxe (85 hp flathead V8)', year: 1939, a0: 7.0, vMax: 110, aDec: 8, turnSpeedMph: { turn: 12, bear: 22, acute: 8 } };
export const MODERN_CAR: CarSpec = { name: 'Modern sedan', year: 1974, a0: 11, vMax: 160, aDec: 10, turnSpeedMph: { turn: 15, bear: 25, acute: 10 } };

export const DRIVER_DAD_ROOKIE: DriverSpec = { skill: 'rookie', inconsistency: 0.12, patienceSeconds: 25, name: 'Dad' };
export const DRIVER_DAD_SPORTSMAN: DriverSpec = { skill: 'sportsman', inconsistency: 0.06, patienceSeconds: 25, name: 'Dad' };
export const DRIVER_EXPERT: DriverSpec = { skill: 'expert', inconsistency: 0.03, patienceSeconds: 25, name: 'Dad' };
export const DRIVER_PERFECT: DriverSpec = { skill: 'perfect', inconsistency: 0, patienceSeconds: 1e9, name: 'Ghost' };
/** Instantaneous car used for SIM-014 ghost-equivalence tests. */
export const INSTANT_CAR: CarSpec = { name: 'Instant (ghost) car', year: 1974, a0: 1e5, vMax: 1e9, aDec: 1e5, turnSpeedMph: { turn: 1e4, bear: 1e4, acute: 1e4 } };

/** Handbook chart helper: rows are IN speeds, each row lists the OUT-speed columns in `speeds` order. */
function matrixOf(speeds: number[], rows: number[][]): Matrix {
  const out: Matrix = { speeds, rows: {} };
  speeds.forEach((r, i) => { out.rows[r] = {}; speeds.forEach((c, j) => { out.rows[r]![c] = rows[i]![j]!; }); });
  return out;
}
/** SPEED-001: extend a printed matrix by one speed (linear from the last two printed speeds), cells to 0.1 s and never below 0; the printed cells are untouched. `zeroDiagonal` keeps IN == OUT at 0 (the acceleration chart). */
function extendMatrix(m: Matrix, v: number, zeroDiagonal: boolean): Matrix {
  const sp = m.speeds; const a = sp[sp.length - 1]!, b = sp[sp.length - 2]!; const r1 = (x: number): number => Math.max(0, Math.round(x * 10) / 10);
  const speeds = [...sp, v]; const rows: Matrix['rows'] = {};
  for (const r of sp) { rows[r] = { ...m.rows[r]! }; rows[r]![v] = r1(m.rows[r]![a]! + (m.rows[r]![a]! - m.rows[r]![b]!)); }
  rows[v] = {};
  for (const c of sp) rows[v]![c] = r1(m.rows[a]![c]! + (m.rows[a]![c]! - m.rows[b]![c]!));
  rows[v]![v] = zeroDiagonal ? 0 : r1(rows[a]![v]! + (rows[a]![v]! - rows[b]![v]!));
  return { speeds, rows };
}
const extendTables = (t: CarTables): CarTables => ({ accel: extendMatrix(t.accel, 55, true), stopGo: extendMatrix(t.stopGo, 55, false), turns: extendMatrix(t.turns, 55, false) });
const PK_ACCEL = [0, 15, 20, 25, 30, 35, 40, 45, 50];
const PK_SPEEDS = [15, 20, 25, 30, 35, 40, 45, 50];
/**
 * 1936 Packard 120B coupe: the three example charts of the Rookie Handbook (main body p.7-9), table-driven (CHART-002).
 * The handbook prints 15..50 mph only. The physical model below is fitted to those charts so the simulated car loses what the tables say.
 */
export const PACKARD_1936: CarSpec = {
  name: '1936 Packard 120B (handbook example charts)', year: 1936, a0: 11.5, vMax: 65, aDec: 11.75, turnSpeedMph: { turn: 15, bear: 25, acute: 10 }, turnZoneFt: 36,
  tables: extendTables({
    accel: matrixOf(PK_ACCEL, [
      [0, 1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4],
      [1, 0, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4],
      [1.2, 0.2, 0, 0.5, 1.6, 2.3, 3.2, 4.3, 5.3],
      [1.3, 0.3, 0.1, 0, 1.1, 1.8, 2.7, 3.8, 4.6],
      [1.9, 0.9, 0.7, 0.6, 0, 0.7, 1.6, 2.7, 3.5],
      [2, 1, 0.8, 0.7, 0.1, 0, 0.9, 2, 2.8],
      [2.4, 1.4, 1.2, 1.1, 0.5, 0.4, 0, 1.1, 1.9],
      [2.8, 1.8, 1.6, 1.5, 0.9, 0.8, 0.4, 0, 0.8],
      [3.3, 2.3, 2.1, 2, 1.4, 1.3, 0.9, 0.5, 0],
    ]),
    stopGo: matrixOf(PK_SPEEDS, [
      [13, 12.7, 12.2, 11.1, 10.4, 9.5, 8.4, 7.6],
      [12.8, 12.5, 12, 10.9, 10.2, 9.3, 8.2, 7.4],
      [12.7, 12.4, 11.9, 10.8, 10.1, 9.2, 8.1, 7.3],
      [12.1, 11.8, 11.3, 10.2, 9.5, 8.6, 7.5, 6.7],
      [12, 11.7, 11.2, 10.1, 9.4, 8.5, 7.4, 6.6],
      [11.6, 11.3, 10.8, 9.7, 9, 8.1, 7, 6.2],
      [11.2, 10.9, 10.4, 9.3, 8.6, 7.7, 6.6, 5.8],
      [10.7, 10.4, 9.9, 8.8, 8.1, 7.2, 6.1, 5.3],
    ]),
    turns: matrixOf(PK_SPEEDS, [
      [0, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4],
      [0.2, 0.5, 1, 2.1, 2.8, 3.7, 4.8, 5.6],
      [0.3, 0.6, 1.1, 2.2, 2.9, 3.8, 4.9, 5.7],
      [0.9, 1.2, 1.7, 2.8, 3.5, 4.4, 5.5, 6.3],
      [1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4],
      [1.4, 1.7, 2.2, 3.3, 4, 4.9, 6, 6.8],
      [1.8, 2.1, 2.6, 3.7, 4.4, 5.3, 6.4, 7.2],
      [2.3, 2.6, 3.1, 4.2, 4.9, 5.8, 6.9, 7.7],
    ]),
  }),
  extrapolated: [55],
};
/** Known cars selectable in the UI / drills. */
export const KNOWN_CARS: Record<string, CarSpec> = { FORD_1939, PACKARD_1936, MODERN_CAR };

export function nodeById(course: Course, id: string): Node {
  const n = course.nodes.find(x => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

/**
 * GRIID-007 (VII.E.2): course position (ft) where an instruction's speed change takes effect. At a sign or landmark it is the
 * node; at an intersection with a referenced control (the CAMEO shows a sign or light) it is that control's stop line;
 * otherwise it is the centre of the intersection / apex of the turn (the node's s).
 */
export function instructionS(course: Course, ins: Instruction): number {
  const n = nodeById(course, ins.nodeId);
  return n.kind === 'intersection' && n.control !== 'none' ? n.s - (n.stopLineOffset ?? 0) : n.s;
}

/** Validate structural invariants; returns a list of problems (empty = valid). */
/** ENG-008: the rules keys a scenario must carry as finite numbers. */
const RULE_NUMBERS = ['maxLate', 'maxEarly', 'missedCheckpoint', 'missedCpLateMinutes', 'sightZonePenalty', 'observationMissPenalty', 'earlyDepartureMinutes', 'taOverDeclareTolerance', 'taGranularitySeconds', 'taMaxRequestSeconds', 'splitHoldSeconds', 'clockMinuteSlop'] as const;
/** ENG-008: fill the V2/V3 fields a scenario file written before them lacks (rules merged over DEFAULT_RULES, asp 0, CDT, example wording). */
export function normalizeScenario(sc: Scenario): Scenario {
  const x = sc as Partial<Scenario> & Scenario;
  return { ...x, rules: { ...DEFAULT_RULES, ...(x.rules ?? {}) }, asp: typeof x.asp === 'number' && Number.isFinite(x.asp) ? x.asp : 0, timeZone: x.timeZone ?? 'CDT', bookStyle: x.bookStyle ?? 'example', baseStartTime: x.baseStartTime ?? x.startTime };
}
export function validateScenario(sc: Scenario): string[] {
  const problems: string[] = [];
  // ENG-008: a scenario without a numeric asp or a complete rules block would draw NaN pace cars or score NaN
  if (!(typeof sc.asp === 'number' && Number.isFinite(sc.asp) && sc.asp >= 0)) problems.push('asp must be a number of minutes >= 0 (0 for drills); load older files through normalizeScenario');
  if (!sc.rules || typeof sc.rules !== 'object') problems.push('rules missing');
  else { for (const k of RULE_NUMBERS) if (!(typeof sc.rules[k] === 'number' && Number.isFinite(sc.rules[k]))) problems.push(`rules.${k} must be a finite number`);
    if (!Array.isArray(sc.rules.earlyDeparturePenalties) || sc.rules.earlyDeparturePenalties.length !== 2) problems.push('rules.earlyDeparturePenalties must be [first, second]'); }
  if (!sc.course || !Array.isArray(sc.course.nodes) || !Array.isArray(sc.book) || !Array.isArray(sc.checkpoints)) { problems.push('course, book and checkpoints are required'); return problems; }
  const nodes = sc.course.nodes;
  for (let i = 1; i < nodes.length; i++) if (nodes[i]!.s < nodes[i - 1]!.s) problems.push(`nodes not sorted at ${nodes[i]!.id}`);
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) problems.push('duplicate node ids');
  for (const ins of sc.book) {
    if (!ids.has(ins.nodeId)) problems.push(`instruction ${ins.n} references unknown node ${ins.nodeId}`);
    if (ins.speed !== undefined && (ins.speed < 5 || ins.speed > 80)) problems.push(`instruction ${ins.n} speed out of range`);
  }
  for (let i = 1; i < sc.book.length; i++) {
    const a = nodeById(sc.course, sc.book[i - 1]!.nodeId).s, b = nodeById(sc.course, sc.book[i]!.nodeId).s;
    if (b < a) problems.push(`instruction ${sc.book[i]!.n} is out of order along the course`);
  }
  for (const n of nodes) {
    if (n.kind === 'intersection') {
      const routes = (n.exits ?? []).filter(e => e.isRoute).length;
      if (routes !== 1) problems.push(`intersection ${n.id} has ${routes} route exits`);
    }
  }
  for (const cp of sc.checkpoints) if (cp.s < 0 || cp.s > sc.course.lengthFt) problems.push(`checkpoint ${cp.id} off course`);
  // GHOST-010: numbering, timed segments must not span the next speed/pause/turn node, no CP at a pause node
  sc.book.forEach((ins, i) => { if (ins.n !== i + 1) problems.push(`instruction numbering not contiguous at index ${i}`); });
  for (let i = 0; i < sc.book.length; i++) {
    const ins = sc.book[i]!;
    if (ins.timed) {
      const s0 = instructionS(sc.course, ins); let sv = s0 + ins.timed.holdSpeed * 1.4666666666666666 * ins.timed.seconds;
      { let v = ins.timed.thenSpeed; for (const c of ins.timed.chain ?? []) { sv += v * 1.4666666666666666 * c.seconds; v = c.thenSpeed; } }   // GEN-017: the chain's end
      const next = sc.book.slice(i + 1).find(j => j.speed !== undefined || j.pause !== undefined || j.turn !== undefined || j.timed !== undefined);
      if (next && nodeById(sc.course, next.nodeId).s <= sv) problems.push(`instruction ${ins.n}: timed segment reaches past instruction ${next.n}`);
    }
    if (ins.pause) {
      const n = nodeById(sc.course, ins.nodeId); const line = n.s - (n.stopLineOffset ?? 0);
      for (const cp of sc.checkpoints) if (cp.s >= line - 50 && cp.s <= n.s + 50) problems.push(`checkpoint ${cp.id} sits at pause node of instruction ${ins.n}`);
    }
  }
  const first = sc.book[0];
  if (!first || first.section !== 'start' || first.restartTime === undefined) problems.push('book must begin with a start line carrying restartTime');
  if (first && first.speed === undefined && !first.transit) problems.push('start line must assign a speed');
  // STAGE-001/STAGE-004: no Timing Checkpoint in the tire warm-up, the calibration run, a transit, a free zone, or the 2-minute free zone after a transit end
  const timingCps = sc.checkpoints.filter(c => c.kind === 'timing');
  const insS = (ins: Instruction): number => nodeById(sc.course, ins.nodeId).s;
  let freeFrom: number | null = null; let transitFrom: number | null = null;
  let assigned = first?.speed ?? 0;
  for (const ins of sc.book) {
    const s0 = insS(ins);
    const bounds: { from: number; to: number; why: string }[] = [];
    if (ins.transit && !ins.transit.end) transitFrom = s0;
    if (ins.transit?.end || (ins.restartTime !== undefined && ins.section === 'restart')) {
      if (transitFrom !== null) bounds.push({ from: transitFrom, to: s0, why: 'transit' });
      transitFrom = null;
      const vEnd = ins.speed ?? assigned;
      // ENG-025: the 2-minute free zone is 120 s of the ghost's time from the transit end or the time-of-day restart, at the speeds of the rows that follow (not the end row's speed alone)
      if (vEnd > 0) bounds.push({ from: s0, to: freeZoneEndS(sc, ins, vEnd), why: `2-minute free zone after the ${ins.transit?.end ? 'transit' : 'restart'}` });
    }
    if (ins.freeZone === 'begin') freeFrom = s0;
    if (ins.freeZone === 'end' && freeFrom !== null) { bounds.push({ from: freeFrom, to: s0, why: 'free zone' }); freeFrom = null; }
    for (const b of bounds) for (const cp of timingCps) if (cp.s > b.from && cp.s < b.to) problems.push(`timing checkpoint ${cp.id} lies in a ${b.why}`);
    if (ins.speed !== undefined) assigned = ins.speed; else if (ins.timed) assigned = timedFinalSpeed(ins.timed);
    if (ins.transit?.end && ins.speed !== undefined) assigned = ins.speed;
  }
  const calIns = sc.book.filter(i => i.section === 'calibration'); const warm = sc.book.filter(i => i.section === 'warmup');
  if (calIns.length) { const lo = insS(calIns[0]!), hi = insS(calIns[calIns.length - 1]!); for (const cp of timingCps) if (cp.s >= lo && cp.s <= hi) problems.push(`timing checkpoint ${cp.id} lies in the calibration run (free zone, V.B.2.a)`); }
  if (warm.length) { const lo = insS(warm[0]!), hi = insS(warm[warm.length - 1]!); for (const cp of timingCps) if (cp.s >= lo && cp.s <= hi) problems.push(`timing checkpoint ${cp.id} lies in the tire warm-up (free zone, V.B.2.a)`); }
  return problems;
}

/** ENG-025: where 120 s of the ghost's time after `from` ends: the rows that follow set the speed (a pause adds its seconds). */
export function freeZoneEndS(sc: Pick<Scenario, 'book' | 'course'>, from: Instruction, vFrom: number, seconds = 120): number {
  const fps = (mph: number): number => Math.max(1, mph) * 1.4666666666666666;
  const sOf = (i: Instruction): number => nodeById(sc.course, i.nodeId).s;
  let s = sOf(from), t = 0, v = vFrom;
  for (const r of sc.book.slice(sc.book.indexOf(from) + 1)) {
    const sr = sOf(r); const dt = (sr - s) / fps(v);
    if (t + dt >= seconds) return s + (seconds - t) * fps(v);
    t += dt + (r.pause ?? 0); s = sr;
    if (r.timed) v = Math.max(r.timed.holdSpeed, r.timed.thenSpeed, ...(r.timed.chain ?? []).map(c => c.thenSpeed)); else if (r.speed !== undefined) v = r.speed;
    if (t >= seconds) return s;
  }
  return s + Math.max(0, seconds - t) * fps(v);
}

/** PLAY-027: a measuring run (D06): starts and restarts leave ON the second and speeds are called AT the sign, so the loss shows against the ghost (no launch lead, no ramp lead). */
export const MEASURE_RUN_TAG = 'measure-run';
export function isMeasureRun(sc: { tags?: string[] } | null | undefined): boolean { return !!sc?.tags?.includes(MEASURE_RUN_TAG); }

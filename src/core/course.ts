/** Course (hidden truth) and book (visible) types. See docs/spec/DESIGN.md §3. */
export type Surface = 'paved' | 'gravel';
export type ExitKind = 'road' | 'driveway' | 'lot' | 'deadend' | 'private';
export type Control = 'STOP' | 'YIELD' | 'SIGNAL' | 'BLINKER' | 'RR' | 'none';
export type TurnDir = 'L' | 'R' | 'S' | 'BL' | 'BR' | 'AL' | 'AR' | 'JL' | 'JR';
export type SignShape = 'octagon' | 'triangle' | 'rect' | 'diamond' | 'blade' | 'shield' | 'rr' | 'checkpoint';
export type Section = 'warmup' | 'calibration' | 'start' | 'transit' | 'freezone' | 'lunch' | 'refuel' | 'pit' | 'finish' | 'restart';

export interface Exit {
  /** Degrees relative to the approach heading: 0 straight, negative left, positive right. */
  angle: number;
  surface: Surface;
  kind: ExitKind;
  name?: string;
  /** Traffic control facing traffic on that exit road (e.g. a STOP for the side road). */
  controlOnExit?: Control;
  isRoute: boolean;
}

export interface Sign { text: string; shape: SignShape; side: 'L' | 'R' }

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
}

export interface TimedSegment { holdSpeed: number; seconds: number; thenSpeed: number }

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
  /** TOD seconds for start/restart lines. */
  restartTime?: number;
}

export interface Checkpoint { id: string; s: number; kind: 'timing' | 'observation'; sightDistance: number }

export interface SignalHazard { kind: 'signal'; s: number; redSeconds: number; greenSeconds: number; offset: number }
export interface TrainHazard { kind: 'train'; s: number; startTod: number; durationSeconds: number }
export interface SlowHazard { kind: 'slow'; s: number; speedMph: number; lengthFt: number; passWindowAfterFt?: number }
export interface ConstructionHazard { kind: 'construction'; s: number; speedMph: number; lengthFt: number }
export type Hazard = SignalHazard | TrainHazard | SlowHazard | ConstructionHazard;

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
}

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
  maxPerCp: number;
  sightZonePenalty: number;
  observationMissPenalty: number;
  earlyRestartPenalty: number;
  earlyRestartMinutes: number;
  missedCpLateMinutes: number;
  trophyRunCounts: boolean;
  rookieDropWorstLeg: boolean;
  taOverDeclareTolerance: number;
  /** Q5: is a red-signal wait a qualifying Time Allowance delay? */
  taForSignals: boolean;
  taGranularitySeconds: number;
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
}

export interface Course { nodes: Node[]; lengthFt: number }

export interface Scenario {
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
  startTime: number;
  prereadSeconds: number;
  rules: RulesConfig;
  aids: AidsConfig;
  /** Off-course excursion length (ft) used when a wrong exit is taken. */
  excursionFt?: number;
  /** Probability that cross traffic holds the car at a STOP for an extra 2-12 s. */
  trafficWaitProbability?: number;
  tags?: string[];
}

export const DEFAULT_RULES: RulesConfig = {
  maxPerCp: 300, sightZonePenalty: 30, observationMissPenalty: 60,
  earlyRestartPenalty: 60, earlyRestartMinutes: 5, missedCpLateMinutes: 30,
  trophyRunCounts: false, rookieDropWorstLeg: false, taOverDeclareTolerance: 5, taForSignals: true, taGranularitySeconds: 1,
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
export const DRIVER_EXPERT: DriverSpec = { skill: 'expert', inconsistency: 0.03, patienceSeconds: 25, name: 'Pro' };
export const DRIVER_PERFECT: DriverSpec = { skill: 'perfect', inconsistency: 0, patienceSeconds: 1e9, name: 'Ghost' };
/** Instantaneous car used for SIM-014 ghost-equivalence tests. */
export const INSTANT_CAR: CarSpec = { name: 'Instant (ghost) car', year: 1974, a0: 1e5, vMax: 1e9, aDec: 1e5, turnSpeedMph: { turn: 1e4, bear: 1e4, acute: 1e4 } };

export function nodeById(course: Course, id: string): Node {
  const n = course.nodes.find(x => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

/** Validate structural invariants; returns a list of problems (empty = valid). */
export function validateScenario(sc: Scenario): string[] {
  const problems: string[] = [];
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
      const s0 = nodeById(sc.course, ins.nodeId).s; const sv = s0 + ins.timed.holdSpeed * 1.4666666666666666 * ins.timed.seconds;
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
  if (first && first.speed === undefined) problems.push('start line must assign a speed');
  return problems;
}

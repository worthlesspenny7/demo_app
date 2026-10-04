/** The Simulator: world state machine. DESIGN §7, §9, §11. */
import {
  type Scenario, type Node, type Exit, type TurnDir, type Checkpoint, type Hazard, type Instruction, type SlowHazard, type ConstructionHazard, type AccidentHazard, type TractorHazard, type CombineHazard, type SchoolBusHazard,
  nodeById, instructionS, transitPaceMph, isMeasureRun,
} from './course.js';
import { buildGhost, ghostTimeAt, exactTransitBegin, type GhostTable, type Leg } from './ghost.js';
import { Car } from './car.js';
import { Speedometer } from './speedo.js';
import { Stopwatch, RallyClock, DEFAULT_WATCH, type WatchKind, type WatchMode } from './stopwatch.js';
import { rng, type Rng } from './rng.js';
import { signalIsRed, trainActive, signalRedRemaining, trainRemaining } from './hazards.js';
import { scoreLeg, scoreStage, type CheckpointRecord, type LegScore, type StageScore } from './scoring.js';
import { mphToFps, fpsToMph, roundToSecond, formatClock } from './units.js';
import { apexSpeed, accelLoss, stopLoss } from './perf-table.js';
import { makeUpTotal, type LedgerEntry } from './ledger.js';

export type Action =
  | { type: 'watch.start' } | { type: 'watch.stop' } | { type: 'watch.toggle' } | { type: 'watch.lap' } | { type: 'watch.recall' } | { type: 'watch.reset'; force?: boolean } | { type: 'watch.mode'; mode?: WatchMode }
  /** `source: 'stopwatch'` = a read of the digital watch's TOD mode (INST-002): counts as a clock read only while the watch is in TOD mode. */
  | { type: 'clock.read'; source?: 'clock' | 'stopwatch' } | { type: 'watch.bezel'; seconds: number }
  /** `seconds` = the believed lateness (+ late / - early); MAKEUP-001 `entries` = the running make-up list {seconds, source}, whose sum is the make-up total (seconds defaults to that total). */
  | { type: 'ledger.set'; seconds?: number; entries?: LedgerEntry[] }
  | { type: 'bezel.set'; seconds: number }
  | { type: 'call.speed'; mph: number }
  | { type: 'call.turn'; dir: TurnDir }
  | { type: 'call.stop' } | { type: 'call.go' } | { type: 'call.uturn' } | { type: 'call.pass' } | { type: 'call.pullover' }
  | { type: 'line.set'; n: number } | { type: 'line.annotate'; n: number; text: string } | { type: 'note'; text: string } | { type: 'abort' }
  | { type: 'ta.request'; legIndex: number; seconds: number; fromLine: number; toLine: number; note?: string;
      /** TAF-001 web-form fields (all optional; a missing one is listed in the record's `missingFields`). */
      carNumber?: number; password?: string; phone?: string; stage?: number | string; cause?: string; witnesses?: { ahead?: string | number; behind?: string | number };
      /** TAF-003 paper sheet: the request kind (Time Allowance V.H.1, Emergency Reduced Speed V.H.2, Formal Problem Resolution VI.A.2 = +30 s), the contestant's status, the circumstances, the "Witnessed by" rows. */
      requestType?: TaRequestType; contestantStatus?: 'driver' | 'navigator'; circumstances?: string; witnessedBy?: TaWitness[] }
  /** Deprecated alias of ta.request for the current leg at a TA point (kept for older scripts). */
  | { type: 'ta.declare'; seconds: number; legIndex?: number }
  | { type: 'scorecard.ack' }
  | { type: 'speed.emergency'; mph: number } | { type: 'speed.resume' }
  /** START-001: move up to the line; refused while the car ahead is still at the sign. */
  | { type: 'pullUp' }
  /** START-001: "about 30 seconds" warning to the driver before a start / restart (seconds defaults to 30). */
  | { type: 'call.warn'; seconds?: number }
  /** PROTO-001: ICE, identify. The driver answers "I see it too" and says "mark" at the sign. */
  | { type: 'call.identify'; text: string }
  /** PROTO-001: one number of the stop count ("9 ... 1 go", then "0, 1, 2" while the driver has not gone). */
  | { type: 'count'; n: number }
  | { type: 'speedo.setFactor'; k: number } | { type: 'card.set'; card: Record<string, number> }
  | { type: 'start' } | { type: 'skipPreread'; secondsBefore?: number };

export interface VisibleExit { angle: number; surface: string; kind: string; name?: string; controlOnExit?: string }
export interface VisibleFeature {
  nodeId?: string;
  kind: 'intersection' | 'sign' | 'landmark' | 'start' | 'finish' | 'checkpoint' | 'signal' | 'train' | 'slow' | 'construction' | 'accident' | 'roadEnd' | 'tractor' | 'combine' | 'schoolBus' | 'car';
  approxDistanceFt: number;
  control?: string;
  exits?: VisibleExit[];
  sign?: { text?: string; shape: string; side: string };
  label?: string;
  signalColor?: 'red' | 'green';
  gateDown?: boolean;
  /** START-002: the pace car one minute ahead (kind 'car'): `offsetSeconds` is -60; `gaining` = we are closing on it (the only live early/late cue in legal mode). */
  paceCar?: { offsetSeconds: number; gaining: boolean };
}

export interface DriverMessage { id: number; tod: number; text: string; kind: 'readback' | 'question' | 'info' }

/** TAF-003: the three requests the paper sheet serves. */
export type TaRequestType = 'time-allowance' | 'emergency-reduced-speed' | 'formal-problem';
/** One "Witnessed by (for V.H.1)" row of the paper sheet: car number, name or description, contestant or official. */
export interface TaWitness { car?: string | number; description?: string; role?: 'contestant' | 'official' }
/** One Time Allowance request as filed (TA-001) and what happened to it. */
export interface TaRequestRecord {
  tod: number; legIndex: number; /** as typed */ requested: number; /** after rounding to a multiple of 10 s against the team (V.H.6) */ adjusted: number;
  fromLine: number; toLine: number; note?: string; status: 'filed' | 'refused'; reason?: string; /** rounding that was applied, e.g. "1m17s adjusted to 1m10s" */ adjustment?: string;
  /** TAF-001 web-form fields as filed. */
  carNumber?: number; password?: string; phone?: string; stage?: number | string; cause?: string; witnesses?: { ahead?: string | number; behind?: string | number };
  /** TAF-001: form fields left blank (carNumber, password, phone, stage, cause). Informational: the request is still filed. */
  missingFields?: string[];
  /** TAF-003 paper sheet fields. */
  requestType?: TaRequestType; contestantStatus?: 'driver' | 'navigator'; circumstances?: string; witnessedBy?: TaWitness[];
}
/** TA-002 / UI-031: what the navigator can see about the Time Allowance procedure. */
export interface TaState {
  /** The scenario prints at least one TA point (yellow box). Without one (legacy books) requests are accepted anywhere. */
  hasTaPoints: boolean;
  windowOpen: boolean; windowEndsTod: number | null; secondsLeft: number | null; endOfStage: boolean;
  /** Legs that may be requested at the current TA point. */
  eligibleLegs: number[];
  requests: TaRequestRecord[]; scorecardAcked: boolean; emergency: boolean;
  /** TAF-001: 'web' (the 2026 form within the TA point window) or 'paper' (classic sheets handed in at a red checkpoint stop, no window). */
  mode: 'web' | 'paper';
  /** Paper mode: the car is stopped at a red (observation) checkpoint, the only place a sheet can be filed; `windowOpen` mirrors it. */
  atRedCheckpoint: boolean;
}
export interface TaAdvice {
  legIndex: number; measuredDelay: number; recoverable: number; /** measured minus recoverable, floored at 0 */ possible: number; /** floor(possible / 10) * 10 */ suggested: number; fromLine: number | null; toLine: number | null;
  /** TAF-002: seconds actually stopped (stopwatch from wheels-stop to go) at qualifying stops of the leg. */
  stoppedSeconds: number;
  /** TAF-002: chart stop-and-go loss for the speeds of those stops (stopLoss(vIn, vOut)). */
  chartLoss: number;
  /** TAF-002: delay of drive-through qualifying zones (tractor, combine, construction, accident, emergency speed), already measured in seconds. */
  otherDelay: number;
  /** TAF-002: measured delay = stopped time + chart loss (+ drive-through delay), to 0.1 s. */
  measured: number;
  /** TAF-002: the odd seconds (measured mod 10, whole seconds) the navigator makes up so the request is a multiple of 10: "delayed 3:47, made up 7, claim 3:40". */
  makeUpToRound: number;
  /** TAF-002: the request to file: floor(measured / 10) * 10 ("3:40"). */
  claim: number;
  /** TAF-001: what delayed the car in this leg (train, tractor, schoolBus, construction, combine, accident, emergency), or null. */
  cause: string | null;
}

/** TAF-002: causes a Time Delay Form names (10c). */
export const TA_CAUSES = ['train', 'tractor', 'schoolBus', 'construction', 'combine', 'accident'] as const;

/** START-001: the launch plan of the next start / restart: leave early by the car's standing-start net loss (chart (a) 0 -> v). */
export interface LaunchInfo {
  /** ENG-021: 'transitOut' = the end of an exact transit (IN + interval), 'lunch' = a promoted (meal, pit, refuel, rest) stop, while the car waits there */
  line: number; kind: 'start' | 'restart' | 'transitOut' | 'lunch';
  /** Own time: printed base + ASP minutes (a hold: its out time). */
  ownTime: number;
  /** Speed (mph) the car accelerates to, and its net loss from rest to that speed (chart (a)). */
  speed: number; netLoss: number;
  /** ownTime - netLoss: the second the navigator says go. */
  launchTime: number;
  secondsToLaunch: number;
  /** The "about 30 seconds" warning has been given (call.warn). */
  warned: boolean;
}
export interface QueuedCar { position: number; relative: 'ahead' | 'behind'; leavesTod: number; /** still at the sign (it has not left yet) */ atSign: boolean; /** this car ahead is slow to leave (go around it) */ sitting: boolean }
/** START-001: the cars queued at the sign (seeded ghosts): nobody releases you, you pull up when the car ahead has left on its minute. */
export interface StartQueue { cars: QueuedCar[]; carAheadAtSign: boolean; carAheadLeavesTod: number | null; pulledUp: boolean }
/** START-002: a pace car one minute ahead or behind on the road. */
export interface PaceCarView { offsetSeconds: number; position: number; distanceFt: number; /** seconds of its own error against its minute (hidden from the player in the UI, shown here for the debrief) */ errorSeconds: number }
export interface PaceCars { ahead: PaceCarView | null; behind: PaceCarView | null }
/** PROTO-001 rung >= 2: what the navigator is expected to call next. */
export interface NextCall { line: number; call: string; text: string }
/** INST-001: the dash clock as the navigator sees it (aids rung <= 1 withholds `minute` while ambiguous). */
export interface ClockView { hourAngle: number; minuteAngle: number; secondAngle: number; minuteAmbiguous: boolean; hour: number; minute: number | null; second: number }

/** Debrief findings of the run (UI-037 names them separately). */
export interface DebriefFinding { kind: 'oneMinuteMistake' | 'timedIntervalDisturbed' | 'lateLaunch' | 'earlyLaunch'; line: number; text: string; seconds?: number }
/** START-001: one start / restart against its launch time. delta = actual - launchTime (+ late). */
export interface StartDelta { line: number; kind: 'start' | 'restart'; ownTime: number; netLoss: number; launchTime: number; actual: number | null; delta: number | null; warned: boolean; pulledUp: boolean; refusedPullUps: number;
  /** ENG-005: the car reached the restart line after its launch time, so the departure was not the navigator's choice (no late-side finding). */
  arrivedLate?: boolean;
  /** PLAY-005: the simulator launched the car itself (drill-sized start at the printed launch second, or the 30-minute auto-departure). */
  auto?: 'drill' | 'late' }

export interface Observation {
  phase: 'preread' | 'running' | 'finished';
  tod: number;
  secondsToStart: number;
  stopwatch: { kind: WatchKind; running: boolean; reading: number; laps: number[]; bezel: number; bezelRemaining: number; dialSeconds: number; /** WATCH-008 (always set by the simulator) */ mode?: WatchMode; lapTable?: { interval: number; cumulative: number }[]; frozen?: boolean; recalled?: number | null };
  ledger: number | null;
  bezel: number;
  speedo: { reading: number; kind: string };
  book: Instruction[];
  currentLine: number;
  ahead: VisibleFeature[];
  driver: { messages: DriverMessage[]; state: string; targetIndicated: number | null; pendingTurn: TurnDir | null; waitingForGo: boolean; lastExecutedLine: number | null };
  annotations: Record<number, string>;
  /** Line number of the instruction at the node the car is stopped/waiting at (the navigator can see the sign); null otherwise. */
  stoppedAtLine: number | null;
  carStopped: boolean;
  offCourseHint: boolean;
  aids: { earlyLate?: number; countdown?: number | null; cumulativePerfectAtNextLine?: number };
  notes: string[];
  /** Hidden at aids rung <= 1 (SIM-027). */
  legIndex: number | null;
  startTime: number;
  rules: Scenario['rules'];
  /** Time Allowance procedure state (TA-002); asp / zone label for the restart card (STAGE-002). */
  ta: TaState;
  asp: number; timeZone: string;
  /** INST-001: hand angles and the minute ambiguity of the dash clock. */
  clock: ClockView;
  /** START-001: the upcoming start / restart's own time, launch time and net loss (preread, or stopped at a restart line); otherwise null. */
  launch: LaunchInfo | null;
  startQueue: StartQueue | null;
  /** START-002: the cars one minute behind / ahead (rung >= 1 always when within sight; rung 0 occasionally). The car ahead is also in `ahead` (kind 'car'). */
  paceCars: PaceCars;
  cues: { gainingOnCarAhead: boolean };
  /** MAKEUP-001: the navigator's make-up entries and their running total. */
  ledgerEntries: LedgerEntry[]; makeUpTotal: number;
  /** PROTO-001 (aids rung >= 2): the expected next navigator call; null otherwise. */
  nextCall: NextCall | null;
}

export interface InstrumentFinding { kind: 'clockForTimeOfDay' | 'clockForInterval' | 'calibrationWithoutLap' | 'lapWhileFrozen'; line: number; text: string }
export interface SimEvent { tod: number; s: number; type: string; detail?: Record<string, unknown> }

export type Bucket = 'cruise' | 'stop' | 'speedChange' | 'timedChange' | 'hazard' | 'offCourse' | 'turn' | 'start' | 'ta';
export interface LegAttribution { legIndex: number; buckets: Record<Bucket, number>; cruiseSeconds: number; meanSpeedRatio: number; stops: { nodeId: string; line: number | null; pause: number; actualCost: number; dwell: number; /** dwell up to the navigator's go call (the part the navigator controls) */ goDwell: number; /** seconds the driver was held by traffic after the go call (ledger-eligible, not the navigator's error) */ trafficWait: number; vIn: number; vOut: number; turn: string | null }[] }

export interface StageResult {
  scenarioId: string;
  score: StageScore;
  records: CheckpointRecord[];
  attribution: LegAttribution[];
  events: SimEvent[];
  instructionsExecuted: number;
  drivingSeconds: number;
  offCourseCount: number;
  observationMissed: boolean;
  ghostEndTod: number;
  ledgerLog: { tod: number; believed: number; truth: number; legIndex: number; makeUpTotal?: number }[];
  actions: { tick: number; action: Action }[];
  secondsLateAtStart: number;
  prereadCoverage: number;
  engineVersion: string;
  /** WATCH-009: misuse of the clock / stopwatch found in the run. */
  instrumentDiscipline: InstrumentFinding[];
  instrumentLog: { tod: number; kind: string; mode: WatchMode; source?: 'clock' | 'stopwatch' }[];
  /** DNF / FNS: the final Timing or Observation Checkpoint was missed (REG-001). */
  dnf: boolean;
  /** Every Time Allowance request with the committee's decision per leg in score.legs[i].taReason (TA-003). */
  ta: { requests: TaRequestRecord[]; scorecardAcked: boolean | null };
  /** Promoted-stop early departures, minutes early (REG-005). */
  earlyDepartureMinutes: number[];
  /** START-001: every start / restart against its launch time. */
  startDeltas: StartDelta[];
  /** INST-002 / MAKEUP-001 / START-001: oneMinuteMistake, timedIntervalDisturbed, lateLaunch, earlyLaunch. */
  findings: DebriefFinding[];
}
/** 3.1.0 (PT-06 bug 4): cross-traffic holds come from a keyed stream per STOP node and the driver's noise / ramps from their own streams. */
/** 3.2.0 (fix sprint PT-08 / PT-09): measuring runs leave on the second, launchInfo covers exact-transit OUT and promoted stops, a turn called in time is made, the off-course rejoin is booked once, the call.over event. */
export const ENGINE_VERSION = '3.2.0';

interface OffCourse { nodeId: string; nodeS: number; branchDist: number; phase: 'out' | 'turning' | 'back'; turnTimer: number; exitKind: string }

const TICK = 0.1;
const TURN_DIRS = new Set(['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR', 'JL', 'JR']);
const ACTION_TYPES = new Set(['watch.mode', 'clock.read', 'ta.request', 'scorecard.ack', 'speed.emergency', 'speed.resume', 'watch.start', 'watch.stop', 'watch.toggle', 'watch.lap', 'watch.recall', 'watch.reset', 'watch.bezel', 'bezel.set', 'ledger.set', 'call.speed', 'call.turn', 'call.stop', 'call.go', 'call.uturn', 'call.pass', 'call.pullover', 'line.set', 'line.annotate', 'note', 'abort', 'ta.declare', 'speedo.setFactor', 'card.set', 'start', 'skipPreread', 'pullUp', 'call.warn', 'call.identify', 'count']);
export const ACTION_LIST = [...ACTION_TYPES];
const num = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
/** Returns an error message for a malformed action, or null when valid (BUG 7/8/12 of PT-01). */
export function validateAction(a: unknown): string | null {
  if (!a || typeof a !== 'object' || typeof (a as { type?: unknown }).type !== 'string') return 'action must be an object with a string type';
  const x = a as Record<string, unknown>; const t = x.type as string;
  if (!ACTION_TYPES.has(t)) return `unknown action type ${t}`;
  switch (t) {
    case 'call.speed': return num(x.mph, 0, 80) ? null : 'call.speed.mph must be a finite number 0..80';
    case 'call.turn': return typeof x.dir === 'string' && TURN_DIRS.has(x.dir) ? null : 'call.turn.dir must be one of L R S BL BR AL AR JL JR';
    case 'watch.mode': return x.mode === undefined || x.mode === 'chrono' || x.mode === 'tod' ? null : 'watch.mode.mode must be chrono or tod';
    case 'watch.reset': return x.force === undefined || typeof x.force === 'boolean' ? null : 'watch.reset.force must be a boolean';
    case 'watch.bezel': case 'bezel.set': return num(x.seconds, -86400, 86400) ? null : `${t}.seconds must be a finite number`;
    case 'clock.read': return x.source === undefined || x.source === 'clock' || x.source === 'stopwatch' ? null : 'clock.read.source must be clock or stopwatch';
    case 'ledger.set': {
      if (x.entries !== undefined) {
        if (!Array.isArray(x.entries) || x.entries.length > 200 || !x.entries.every(e => e && typeof e === 'object' && num((e as { seconds?: unknown }).seconds, -3600, 3600) && typeof (e as { source?: unknown }).source === 'string' && (e as { source: string }).source.length <= 40)) return 'ledger.set.entries must be [{seconds (+-3600), source (<= 40 chars)}]';
        return x.seconds === undefined || num(x.seconds, -3600, 3600) ? null : 'ledger.set.seconds must be a finite number within +-3600';
      }
      return num(x.seconds, -3600, 3600) ? null : 'ledger.set.seconds must be a finite number within +-3600';
    }
    case 'call.warn': return x.seconds === undefined || num(x.seconds, 1, 600) ? null : 'call.warn.seconds must be 1..600';
    case 'call.identify': return typeof x.text === 'string' && x.text.length <= 200 ? null : 'call.identify.text must be a string (<= 200 chars)';
    case 'count': return num(x.n, -1000, 1000) && Number.isInteger(x.n) ? null : 'count.n must be an integer';
    case 'ta.declare': return num(x.seconds, 0, 3600) && (x.legIndex === undefined || (num(x.legIndex, 1, 1000) && Number.isInteger(x.legIndex))) ? null : 'ta.declare.seconds must be 0..3600 (legIndex a whole leg number)';
    case 'ta.request': {
      if (!(num(x.legIndex, 1, 1000) && num(x.seconds, 0, 86400) && num(x.fromLine, 1, 10000) && num(x.toLine, 1, 10000) && (x.note === undefined || (typeof x.note === 'string' && x.note.length <= 500)))) return 'ta.request needs legIndex, seconds, fromLine, toLine (and an optional note of at most 500 chars)';
      if (!Number.isInteger(x.legIndex) || !Number.isInteger(x.fromLine) || !Number.isInteger(x.toLine)) return 'ta.request legIndex, fromLine and toLine must be whole numbers';
      if (x.password !== undefined && !(typeof x.password === 'string' && /^\d{4}$/.test(x.password))) return 'ta.request.password must be 4 digits';
      if (x.phone !== undefined && !(typeof x.phone === 'string' && x.phone.length <= 24)) return 'ta.request.phone must be a string (<= 24 chars)';
      if (x.carNumber !== undefined && !num(x.carNumber, 0, 9999)) return 'ta.request.carNumber must be a number';
      if (x.stage !== undefined && !((typeof x.stage === 'number' && num(x.stage, 0, 20)) || (typeof x.stage === 'string' && x.stage.length <= 12))) return 'ta.request.stage must be a stage number';
      if (x.cause !== undefined && !(typeof x.cause === 'string' && x.cause.length <= 40)) return 'ta.request.cause must be a string (<= 40 chars)';
      if (x.requestType !== undefined && !['time-allowance', 'emergency-reduced-speed', 'formal-problem'].includes(x.requestType as string)) return 'ta.request.requestType must be time-allowance, emergency-reduced-speed or formal-problem';
      if (x.contestantStatus !== undefined && x.contestantStatus !== 'driver' && x.contestantStatus !== 'navigator') return 'ta.request.contestantStatus must be driver or navigator';
      if (x.circumstances !== undefined && !(typeof x.circumstances === 'string' && x.circumstances.length <= 600)) return 'ta.request.circumstances must be a string (<= 600 chars)';
      if (x.witnessedBy !== undefined && !(Array.isArray(x.witnessedBy) && x.witnessedBy.length <= 4)) return 'ta.request.witnessedBy must be a list of at most 4 rows';
      if (x.witnesses !== undefined) { const w = x.witnesses as Record<string, unknown> | null; if (!w || typeof w !== 'object' || !['ahead', 'behind'].every(k => w[k] === undefined || typeof w[k] === 'number' || (typeof w[k] === 'string' && (w[k] as string).length <= 40))) return 'ta.request.witnesses must be {ahead?, behind?} (cars ahead / behind)'; }
      return null;
    }
    case 'speed.emergency': return num(x.mph, 5, 60) ? null : 'speed.emergency.mph must be a finite number 5..60';
    case 'line.set': return num(x.n, 1, 10000) ? null : 'line.set.n must be a line number';
    case 'line.annotate': return num(x.n, 1, 10000) && Number.isInteger(x.n) && typeof x.text === 'string' && x.text.length <= 500 ? null : 'line.annotate needs a whole line number n and text (<= 500 chars)';
    case 'note': return typeof x.text === 'string' ? null : 'note.text must be a string';   // ENG-025: a note over 2 000 characters is truncated (sanitizeAction), never refused
    case 'speedo.setFactor': return num(x.k, 0.5, 2) ? null : 'speedo.setFactor.k must be a finite number 0.5..2';
    case 'card.set': return x.card && typeof x.card === 'object' && Object.values(x.card as Record<string, unknown>).every(v => num(v, 0, 80)) ? null : 'card.set.card must map speeds to finite mph values';
    case 'skipPreread': return x.secondsBefore === undefined || num(x.secondsBefore, 0, 86400) ? null : 'skipPreread.secondsBefore must be a finite number';
    default: return null;
  }
}
/** ENG-017: the fields each action type carries; anything else is dropped before the action is recorded or logged. */
const ACTION_KEYS: Record<string, string[]> = {
  'watch.reset': ['force'], 'watch.mode': ['mode'], 'clock.read': ['source'], 'watch.bezel': ['seconds'], 'bezel.set': ['seconds'], 'ledger.set': ['seconds', 'entries'],
  'call.speed': ['mph'], 'call.turn': ['dir'], 'line.set': ['n'], 'line.annotate': ['n', 'text'], note: ['text'],
  'ta.request': ['legIndex', 'seconds', 'fromLine', 'toLine', 'note', 'carNumber', 'password', 'phone', 'stage', 'cause', 'witnesses', 'requestType', 'contestantStatus', 'circumstances', 'witnessedBy'],
  'ta.declare': ['seconds', 'legIndex'], 'speed.emergency': ['mph'], 'call.warn': ['seconds'], 'call.identify': ['text'], count: ['n'], 'speedo.setFactor': ['k'], 'card.set': ['card'], skipPreread: ['secondsBefore'],
};
/** ENG-017: a copy of a (validated) action with only its documented fields; nested rows are rebuilt the same way. */
/** ENG-025: the longest note kept; a longer one is cut to this length. */
export const NOTE_MAX = 2000;
export function sanitizeAction(a: Action): Action {
  const src = a as unknown as Record<string, unknown>; const out: Record<string, unknown> = { type: a.type };
  for (const k of ACTION_KEYS[a.type] ?? []) if (src[k] !== undefined) out[k] = src[k];
  if (Array.isArray(out.entries)) out.entries = (out.entries as { seconds: number; source: string }[]).map(e => ({ seconds: e.seconds, source: e.source }));
  if (out.witnesses && typeof out.witnesses === 'object') { const w = out.witnesses as Record<string, unknown>; out.witnesses = { ...(w.ahead !== undefined ? { ahead: w.ahead } : {}), ...(w.behind !== undefined ? { behind: w.behind } : {}) }; }
  if (Array.isArray(out.witnessedBy)) out.witnessedBy = (out.witnessedBy as Record<string, unknown>[]).map(w => { const r: Record<string, unknown> = {}; if (w && typeof w === 'object') { if (typeof w.car === 'string' || (typeof w.car === 'number' && Number.isFinite(w.car))) r.car = w.car; if (typeof w.description === 'string') r.description = w.description.slice(0, 200); if (w.role === 'contestant' || w.role === 'official') r.role = w.role; } return r; });
  if (out.card && typeof out.card === 'object') out.card = { ...(out.card as Record<string, number>) };
  if (a.type === 'note' && typeof out.text === 'string' && out.text.length > NOTE_MAX) out.text = out.text.slice(0, NOTE_MAX);   // ENG-025
  return out as unknown as Action;
}
const TURN_ZONE_FT = 60;
const turnZoneOf = (c: { turnZoneFt?: number }): number => c.turnZoneFt ?? TURN_ZONE_FT;

export interface SimOptions { watch?: WatchKind; dialSeconds?: 30 | 60; useCard?: boolean; mainRoadRule?: 'pavement-first' | 'straight-as-possible'; navigatorLatency?: number }

export class Simulator {
  readonly sc: Scenario;
  readonly ghost: GhostTable;
  readonly car: Car;
  readonly speedo: Speedometer;
  readonly watch: Stopwatch;
  readonly clock: RallyClock;
  readonly rnd: Rng;
  /** ENG-004: the driver's speed-holding noise and his ramp factors use their own streams, so hidden hazards do not depend on the navigator's calls. */
  private readonly drvRng: Rng;
  private readonly rampRng: Rng;
  tod: number;
  phase: Observation['phase'] = 'preread';
  readonly events: SimEvent[] = [];
  /** Full transcript (observe() only returns messages since the previous observe). */
  driverMsgs: DriverMessage[] = [];
  private pendingMsgs: DriverMessage[] = [];
  // navigator state
  currentLine = 1;
  notes: string[] = [];
  ledger: number | null = null;
  ledgerLog: { tod: number; believed: number; truth: number; legIndex: number; makeUpTotal?: number }[] = [];
  card: Record<string, number> = {};
  useCard: boolean;
  // driver state
  targetIndicated: number | null = null;
  pendingTurn: TurnDir | null = null;
  holdRequested = false;
  waitingForGo = false;
  waitReason: 'stop' | 'ask' | 'signal' | 'train' | 'hold' | 'roadEnd' | 'finish' | 'pullover' | null = null;
  waitStartTod = 0;
  patienceWarned = false;
  passRequested = false;
  pullover = false;
  private bias = 0;
  private nextNodeIdx = 0;
  private nextCpIdx = 0;
  private off: OffCourse | null = null;
  offCourseCount = 0;
  // ---- V3 state ----
  private readonly protoRng: Rng;
  /** MAKEUP-001: the navigator's make-up entries (ledger.set {entries}). */
  ledgerEntries: LedgerEntry[] = [];
  /** START-001: every start / restart against its launch time, in the order they happened. */
  startDeltas: StartDelta[] = [];
  /** Debrief findings: oneMinuteMistake, timedIntervalDisturbed, lateLaunch, earlyLaunch. */
  debriefFindings: DebriefFinding[] = [];
  private launchStates = new Map<number, { warned: boolean; warnTod: number | null; expectSaid: boolean; pulledUp: boolean; refused: number }>();
  private queueCache = new Map<number, QueuedCar[]>();
  private netLossCache = new Map<number, number>();
  private nextHoldingTod: number | null = null;
  private identified: { text: string; tod: number } | null = null;
  private zeroCounts = 0;
  private nextInsPtr = 0;
  private nextCallNow: NextCall | null = null;
  private nextCallLine = 0;
  private gapHistory: { tod: number; gap: number }[] = [];
  private gainingNow = false;
  private paceParams: Record<'ahead' | 'behind', { c: number; a1: number; p1: number; f1: number; a2: number; p2: number; f2: number }> | null = null;
  private occasional = { block: -1, visible: false };
  /** MAKEUP-001: a make-up in progress (the called speed is well above the assigned speed); dropped at the next assigned-speed change. */
  makeUp: { pct: number; assigned: number; calledMph: number; sinceTod: number } | null = null;
  /** How many times the simulator dropped the "+%" at a speed change (the oracle re-applies it). */
  makeUpDrops = 0;
  /** TAF-002: qualifying stops per leg: seconds stopped (wheels-stop to go) and the speeds for the chart loss. */
  taStops: { leg: number; stopped: number; vIn: number; vOut: number }[] = [];
  private waitLeg = 0;
  /** What delayed each leg (for the TA form's cause field). */
  taCause: Record<number, string> = {};
  private blockEp: { leg: number; t0: number; line: number; mph: number } | null = null;
  private timedWatch: { line: number; holdSpeed: number; startTod: number; over: number; flagged: boolean } | null = null;
  // checkpoints / legs
  records: CheckpointRecord[] = [];
  legIndex = 1;
  legAnchorActual: number;
  legAnchorGhost: number;
  /** TOD at which the ghost changes speed for the active timed segment, mapped onto the car's leg clock (truth). */
  timedChangeGhostTod(): number | null { return this.timedChange ? this.legAnchorActual + (ghostTimeAt(this.ghost, this.timedChange.atS) - this.legAnchorGhost) : null; }
  /** Time Allowance requested per leg, after rounding to a multiple of 10 s (TA-001). */
  taDeclared: Record<number, number> = {};
  /** Measured qualifying delay per leg: trains, accident scenes, hazard-forced stops, emergency reduced speed (TA-004). */
  taQualifying: Record<number, number> = {};
  /** Seconds of that delay the team could have made up before the checkpoint at +10 % (TA-003). */
  taRecoverable: Record<number, number> = {};
  taRequests: TaRequestRecord[] = [];
  /** Instruction numbers between which each leg's qualifying delay occurred. */
  private taLines: Record<number, { from: number; to: number }> = {};
  private taWindow: { startTod: number; endTod: number; endOfStage: boolean; insN: number; legBase: number } | null = null;
  private taLegBase = 0;
  /** Between a transit's begin line and its end / the next restart: no Time Allowance delay accrues. */
  private inTransit = false;
  private readonly hasTaPoints: boolean;
  /** The structured TA procedure applies: a printed TA point, or the paper mode (sheets handed in at a red checkpoint). */
  private get taStructured(): boolean { return this.hasTaPoints || this.sc.rules.taMode === 'paper'; }
  scorecardAcked = false;
  /** Emergency reduced speed (V.H.2): non-null while the navigator has declared it. */
  emergency: { startTod: number } | null = null;
  private qualEpisode: { leg: number; delay: number } | null = null;
  /** Rounded TOD at which each exact-transit begin line was crossed (IN time, STAGE-003). */
  transitIn: Record<number, number> = {};
  /** Departures from promoted stops, minutes early (V.E.3.h). */
  earlyDepartureMinutes: number[] = [];
  /** TOD of the most recent official start / restart / exact-transit OUT time (V.C.2.b(2)). */
  private officialAnchorActual: number;
  private anchorShift = 0;
  private nodeCrossTod = 0;
  private checkoffs: { n: number; what: string | null; ins: Instruction; crossTod: number; afterS: number | null }[] = [];
  // attribution
  private buckets: Record<Bucket, number> = this.emptyBuckets();
  private cruiseDt = 0; private cruiseDs = 0; private cruiseGhostDs = 0;
  private legStops: LegAttribution['stops'] = [];
  attribution: LegAttribution[] = [];
  private curStop: { nodeId: string; line: number | null; pause: number; startTod: number; dwellStart: number | null; dwell: number; goCalledAt: number | null; vIn: number; vOut: number; turn: string | null } | null = null;
  private rampTarget: number | null = null; private rampKind: 'speedChange' | 'timedChange' | null = null;
  private lastSpeedChangeWasTimed = false;
  private timedChange: { atS: number; atTod: number; nodeId: string; line: number } | null = null;
  /** Which instruction node anchors the active timed segment (truth, for bots/debrief). */
  timedChangeNodeId(): string | null { return this.timedChange?.nodeId ?? null; }
  private restartMinutesEarly = 0;
  private drivingSeconds = 0;
  private finishedTod: number | null = null;
  private departed = false;
  private autoDeparted: 'drill' | 'late' | null = null;
  private slowSaid = new Set<number>();
  /** Turn zone: cap applies while car.s < turnZoneEndS; set when the exit is known (pre-braking) and at crossing. */
  private turnZoneEndS = -1; private turnCap = Infinity;
  private executed = new Set<number>();

  constructor(sc: Scenario, opts: SimOptions = {}) {
    this.sc = sc;
    this.ghost = buildGhost(sc);
    this.rnd = rng(sc.seed);
    { const slop = sc.rules.clockMinuteSlop ?? 5; this.clock = new RallyClock(slop, (rng(`${sc.seed}:v3:clock`).next() * 2 - 1) * slop); }
    this.protoRng = rng(`${sc.seed}:v3:proto`);
    this.drvRng = rng(`${sc.seed}:drv`); this.rampRng = rng(`${sc.seed}:ramp`);
    this.car = new Car(sc.car);
    this.speedo = new Speedometer(sc.speedo, this.rnd.fork('speedo'));
    this.watch = new Stopwatch(opts.watch ?? DEFAULT_WATCH, opts.dialSeconds ?? 60, sc.rules.splitHoldSeconds ?? 5);
    this.useCard = opts.useCard ?? false;
    this.mainRoadRule = opts.mainRoadRule ?? 'pavement-first';
    this.tod = sc.startTime - sc.prereadSeconds;
    this.tod0 = this.tod;
    { const t = (sc.tags ?? []).find(x => x.startsWith('forceWatchReset:')); this.forceResetAt = t ? Number(t.split(':')[1]) : null; }
    this.legAnchorActual = sc.startTime;
    this.legAnchorGhost = sc.startTime;
    this.officialAnchorActual = sc.startTime;
    this.hasTaPoints = sc.book.some(i => i.taPoint);
    this.nextNodeIdx = 0;
    if (sc.prereadSeconds <= 0) { /* still requires start */ }
  }
  private readonly mainRoadRule: 'pavement-first' | 'straight-as-possible';

  // ---------- WATCH-009: device for purpose ----------
  /** Which instrument each timing action used: clock reads, stopwatch start/lap/stop, TOD-mode toggles. */
  instrumentLog: { tod: number; kind: 'clock.read' | 'watch.start' | 'watch.stop' | 'watch.lap' | 'watch.mode'; mode: WatchMode; /** clock.read only: which face was read (INST-002) */ source?: 'clock' | 'stopwatch' }[] = [];
  private findings: InstrumentFinding[] = [];
  private anchors: { tod: number; line: number; kind: 'timed' | 'pause' | 'calibration'; /** PLAY-030: a second instant whose lap also counts */ alt?: number }[] = [];
  private stoppedTod = new Map<number, number>();
  /** PLAY-030: the braking part of the stop loss before a STOP + timed line (the ghost arrives that much before the car stops): stop loss minus the standing-start loss. */
  private brakeShare(ins: Instruction): number {
    let vIn: number | undefined; for (const b of this.sc.book) { if (b === ins) break; if (b.timed) vIn = b.timed.thenSpeed; else if (b.speed !== undefined) vIn = b.speed; }
    const hold = ins.timed!.holdSpeed; try { return Math.max(0, stopLoss(vIn ?? hold, hold, this.sc.car) - accelLoss(hold, this.sc.car)); } catch { return 0; }
  }
  private instr(kind: 'clock.read' | 'watch.start' | 'watch.stop' | 'watch.lap' | 'watch.mode', source?: 'clock' | 'stopwatch'): void { this.instrumentLog.push({ tod: this.tod, kind, mode: this.watch.mode, ...(source ? { source } : {}) }); this.log('instrument', { kind, mode: this.watch.mode, ...(source ? { source } : {}) }); }
  /** Was the time of day read from the clock (or the watch in TOD mode) within the last 60 s? */
  private clockRecentlyRead(): boolean {
    if (this.watch.kind === 'digital' && this.watch.mode === 'tod') return true;
    return this.instrumentLog.some(e => this.tod - e.tod <= 60 && (e.kind === 'clock.read' || (e.kind === 'watch.mode' && e.mode === 'tod')));
  }
  private checkClockUse(what: string, line: number): void {
    if (!this.clockRecentlyRead()) this.findings.push({ kind: 'clockForTimeOfDay', line, text: `${what} (line ${line}) was taken with the stopwatch in chrono mode and no clock read in the last minute: read the time of day from the clock` });
  }
  /** ENG-006: exact-transit IN crossings, judged at the end: a clock read (or TOD-mode read) from 60 s before to 60 s after the sign counts (the IN time is read as the sign goes by). */
  private pendingInChecks: { tod: number; line: number; todMode: boolean }[] = [];
  private disciplineFindings(): InstrumentFinding[] {
    const out = [...this.findings];
    for (const c of this.pendingInChecks) {
      const read = c.todMode || this.instrumentLog.some(e => e.tod >= c.tod - 60 && e.tod <= c.tod + 60 && (e.kind === 'clock.read' || (e.kind === 'watch.mode' && e.mode === 'tod')));
      if (!read) out.push({ kind: 'clockForTimeOfDay', line: c.line, text: `Exact-transit IN time (line ${c.line}) was taken with the stopwatch in chrono mode and no clock read within a minute of the sign: read the time of day from the clock` });
    }
    const near = (a: { tod: number }, t: number, before: number, after: number): boolean => a.tod >= t - before && a.tod <= t + after;
    for (const a of this.anchors) {
      const used = this.instrumentLog.some(e => (e.kind === 'watch.start' || e.kind === 'watch.lap') && (near(e, a.tod, 2, a.kind === 'calibration' ? 3 : 2) || (a.alt !== undefined && near(e, a.alt, 2, 2))));
      if (used) continue;
      if (a.kind === 'calibration') out.push({ kind: 'calibrationWithoutLap', line: a.line, text: `Calibration point at line ${a.line} was passed without a lap on the stopwatch` });
      else out.push({ kind: 'clockForInterval', line: a.line, text: `${a.kind === 'timed' ? 'Timed segment' : 'Pause'} at line ${a.line} had no stopwatch start or lap within 2 s of its anchor: count intervals on the stopwatch, not the clock` });
    }
    return out;
  }

  private emptyBuckets(): Record<Bucket, number> { return { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 }; }

  // ---------- public API ----------
  act(a: Action): void {
    const bad = validateAction(a); if (bad) throw new Error(bad);
    a = sanitizeAction(a);
    const now = this.tod;
    this.actions.push({ tick: this.tick, action: a });
    if (a.type.startsWith('watch.') || a.type.startsWith('line.') || a.type === 'note' || a.type === 'bezel.set') this.log(a.type, { ...(a as unknown as Record<string, unknown>) });
    switch (a.type) {
      case 'watch.start': this.watch.start(now); this.instr('watch.start'); break;
      case 'watch.stop': this.watch.stop(now); this.instr('watch.stop'); break;
      case 'watch.toggle': { const was = this.watch.running; this.watch.toggle(now); this.instr(was ? 'watch.stop' : 'watch.start'); break; }
      case 'watch.lap': {
        if (this.watch.kind === 'digital' && this.watch.isFrozen(now)) this.findings.push({ kind: 'lapWhileFrozen', line: this.currentLine, text: `Lap taken while the split from the previous point was still frozen (line ${this.currentLine}): press recall first, or wait for the display to release` });
        this.watch.lap(now); this.instr('watch.lap'); break;
      }
      case 'watch.reset': if (!this.watch.reset(now, a.force === true)) this.say('Watch: stop it before resetting (or force the reset)', 'info'); break;
      case 'watch.recall': this.watch.recall(now); break;
      case 'watch.mode': { const before = this.watch.mode; if (a.mode) this.watch.setMode(a.mode); else this.watch.toggleMode(); if (this.watch.mode !== before) this.instr('watch.mode'); break; }
      case 'clock.read': {
        // INST-002: a read of the stopwatch's TOD mode is the unambiguous clock read; reading the chrono face is not a time-of-day read
        if (a.source === 'stopwatch' && !(this.watch.kind === 'digital' && this.watch.mode === 'tod')) { this.say('The watch is in chrono mode: switch it to TOD to read the time of day', 'info'); break; }
        this.instr('clock.read', a.source ?? 'clock'); break;
      }
      case 'abort': if (this.phase !== 'finished') { this.phase = 'finished'; this.log('abort'); } break;
      case 'line.annotate': this.annotations[a.n] = a.text; break;
      case 'watch.bezel': this.watch.setBezel(a.seconds); break;
      case 'ledger.set': {
        if (a.entries) this.ledgerEntries = a.entries.map(e => ({ seconds: e.seconds, source: e.source }));
        const believed = a.seconds ?? makeUpTotal(this.ledgerEntries);
        this.ledger = believed;
        this.ledgerLog.push({ tod: now, believed, truth: this.phase === 'running' ? this.pace() : 0, legIndex: this.legIndex, makeUpTotal: makeUpTotal(this.ledgerEntries) });
        this.log('ledger.set', { seconds: believed, truth: this.phase === 'running' ? this.pace() : null, makeUpTotal: makeUpTotal(this.ledgerEntries) });
        break;
      }
      case 'bezel.set': this.clock.setBezel(a.seconds); break;
      case 'line.set': this.currentLine = Math.max(1, Math.min(this.sc.book.length, Math.round(a.n))); break;
      case 'note': this.notes.push(a.text); break;
      case 'ta.request': this.fileTa(a.legIndex, a.seconds, a.fromLine, a.toLine, a.note, false, a); break;
      case 'ta.declare': {
        const hasPoints = this.sc.book.some(i => i.taPoint);
        let leg = a.legIndex;
        if (leg === undefined) {
          if (hasPoints) { const base = this.taWindow?.legBase ?? 0; const elig = Array.from({ length: Math.max(0, this.legIndex - 1 - base) }, (_, i) => base + 1 + i); leg = elig.filter(l => (this.taQualifying[l] ?? 0) > 0).pop() ?? elig[elig.length - 1] ?? Math.max(1, this.legIndex - 1); }
          else leg = this.lastQualifyingLeg !== null && this.lastQualifyingLeg === this.legIndex - 1 && this.tod - this.lastCpTod < 180 ? this.lastQualifyingLeg : this.legIndex;
        }
        this.fileTa(leg, a.seconds, this.currentLine, this.currentLine, undefined, !hasPoints);
        break;
      }
      case 'scorecard.ack': {
        if (this.taWindow?.endOfStage && this.tod <= this.taWindow.endTod + 1e-6) { this.scorecardAcked = true; this.say('Scoring crew: scorecard acknowledged', 'info'); this.log('scorecard.ack'); }
        else { this.say('Scoring crew: the scorecard is acknowledged at the end-of-stage TA point, within its window', 'info'); this.log('scorecard.refused'); }
        break;
      }
      case 'speed.emergency': {
        if (this.phase !== 'running') break;
        this.emergency = this.emergency ?? { startTod: now };
        this.targetIndicated = a.mph; this.announceAtSpeed = true;
        this.say(`Emergency reduced speed ${a.mph}`, 'readback'); this.log('speed.emergency', { mph: a.mph });
        this.beginRamp();
        break;
      }
      case 'speed.resume': {
        if (!this.emergency) { this.say('We are not under emergency reduced speed', 'info'); break; }
        this.closeQualEpisode(); this.emergency = null;
        const assigned = Math.round(fpsToMph(this.ghostSpeedAt(this.routeS())));
        if (assigned > 0) { const mph = this.useCard && this.card[String(assigned)] !== undefined ? this.card[String(assigned)]! : assigned; this.targetIndicated = mph; this.announceAtSpeed = true; this.say(`Resuming ${mph}`, 'readback'); this.log('speed.resume', { mph }); this.beginRamp(); }
        break;
      }
      case 'pullUp': {
        const ins = this.launchLine();
        if (!ins) { this.say('Nothing to pull up to right now', 'info'); this.log('pullUp.refused', { reason: 'none' }); break; }
        const st = this.launchStateFor(ins.n); const q = this.startQueue(ins);
        if (q && q.carAheadAtSign) { st.refused++; this.say('Not yet: the car ahead is still at the sign', 'info'); this.log('pullUp.refused', { line: ins.n, carAheadLeavesTod: q.carAheadLeavesTod }); break; }
        st.pulledUp = true; this.say('Pulling up to the line', 'readback'); this.log('pullUp', { line: ins.n });
        break;
      }
      case 'call.warn': {
        const li = this.launchInfo();
        if (!li) { this.say('Nothing to warn me about right now', 'info'); break; }
        const st = this.launchStateFor(li.line); st.warned = true; st.warnTod = this.tod;
        this.say(`About ${a.seconds ?? 30} seconds, got it`, 'readback'); this.log('call.warn', { line: li.line, seconds: a.seconds ?? 30, toLaunch: Math.round((li.launchTime - this.tod) * 10) / 10 });
        break;
      }
      case 'call.identify': this.identified = { text: a.text, tod: this.tod }; this.say('I see it too', 'readback'); this.log('call.identify', { text: a.text }); break;
      case 'count': {
        this.log('count', { n: a.n }); this.say(String(a.n), 'readback');
        if (a.n >= 0 && this.goPending) { this.zeroCounts++; if (this.zeroCounts === 1) this.say('Keep counting', 'info'); }   // said once at the zero: the count goes on (0, 1, 2) until he goes
        break;
      }
      case 'speedo.setFactor': this.speedo.setFactor(a.k); this.log('speedo.setFactor', { k: a.k }); break;
      case 'card.set': this.card = { ...a.card }; this.useCard = true; break;
      case 'skipPreread': if (this.phase === 'preread') { let target = this.sc.startTime - Math.max(0, a.secondsBefore ?? 0); { const li = this.launchInfo(); if (li) target = Math.min(target, li.launchTime - 1); }   // PLAY-026: a fast-forward never lands on or after the launch second
        if (target > this.tod) { const ticks = Math.round((target - this.tod) / TICK); this.tick += ticks; this.tod = this.tod0 + this.tick * TICK; } } break;
      case 'start': this.depart(); break;
      case 'call.speed': {
        let mph = a.mph;
        if (this.useCard && this.card[String(a.mph)] !== undefined) mph = this.card[String(a.mph)]!;
        this.targetIndicated = mph; this.announceAtSpeed = true;
        this.say(`Holding ${mph}`, 'readback');
        this.log('call.speed', { mph });
        if (this.pullover && this.phase === 'running') { if (this.waitingForGo && this.waitReason === 'pullover' && this.car.v === 0) this.release('pullover'); this.pullover = false; } // ENG-002: a speed call ends the pull-over
        this.speedAsked = false;
        this.noteMakeUp(mph);
        this.beginRamp();
        break;
      }
      case 'call.turn': this.pendingTurn = a.dir; this.turnArm = { s: this.car.s, v: this.car.v }; this.say(`${turnWord(a.dir)} ahead, got it`, 'readback'); this.log('call.turn', { dir: a.dir });
        if (this.waitingForGo && this.waitReason === 'ask') { this.release('ask'); }
        break;
      case 'call.stop': this.holdRequested = true; this.say('Stopping at the next one', 'readback'); this.log('call.stop'); break;
      case 'call.go':
        this.log('call.go');
        if (this.phase === 'preread') { this.depart(); break; }
        if (this.waitingForGo && (this.waitReason === 'stop' || this.waitReason === 'hold' || this.waitReason === 'finish' || this.waitReason === 'pullover')) {
          if (this.curStop && this.curStop.goCalledAt === null) this.curStop.goCalledAt = this.tod;
          if (this.waitReason === 'stop' && this.tod < this.trafficClearTod) { this.goPending = true; this.zeroCounts = 0; this.say('Waiting on traffic', 'info'); this.say('Keep counting', 'info'); this.log('traffic', { wait: this.trafficClearTod - this.tod, ledgerEligible: true }); }
          else { const wn = this.waitNodeId; this.say('Going', 'readback'); this.release(this.waitReason); if (wn) this.checkEarlyDeparture(wn); }
        }
        else if (this.waitingForGo) this.say(`Can't go yet (${this.waitReason})`, 'info');
        else if (this.car.v === 0 && this.phase === 'running' && this.atStopLineSoon()) { this.goRequestedEarly = true; this.goRequestedAt = this.tod; this.say('Go, got it', 'readback'); }
        else if (this.car.v === 0 && this.phase === 'running') this.say(this.startRamp ? 'Already rolling' : 'We are not at a stop: I go when the road ahead is clear', 'info'); // ENG-001: never stored for a later STOP
        else if (this.phase === 'running' && this.stopAhead()) { this.say('No: we stop at that Stop Sign. Running a Stop Sign is a DNF (V.E.3.e)', 'question'); this.log('stopSkipRefused'); }
        else this.say('Already rolling', 'info');
        break;
      case 'call.uturn':
        this.log('call.uturn');
        if (this.off && this.off.phase === 'out') { this.off.phase = 'turning'; this.off.turnTimer = 20; this.say('Turning around', 'readback'); }
        else this.say('Turn around? We are on course as far as I can tell', 'question');
        break;
      case 'call.pass': this.passRequested = true; this.say('Will pass when clear', 'readback'); this.log('call.pass'); break;
      case 'call.pullover': this.pullover = true; this.say('Pulling over. Say go (or call a speed) when we leave', 'readback'); this.log('call.pullover'); break;
    }
  }

  private depart(auto: 'drill' | 'late' | null = null): void {
    if (this.phase !== 'preread') return;
    this.phase = 'running'; this.goRequestedEarly = false;
    this.autoDeparted = auto;
    this.departed = true;
    const early = this.sc.startTime - this.tod;
    this.log('depart', { early });
    if (this.sc.book[0]) this.recordStartDelta(this.sc.book[0], this.tod, undefined, auto ?? undefined);
    this.nextHoldingTod = this.tod + 120 + this.protoRng.next() * 120;
    if (early > 0) this.buckets.start -= early; // ghost anchor is official start: leaving early = early
    else { this.buckets.start += -early; this.secondsLateAtStart = -early; }
    const first = this.sc.book[0]!;
    if (first.speed !== undefined && this.targetIndicated === null) this.targetIndicated = this.useCard && this.card[String(first.speed)] !== undefined ? this.card[String(first.speed)]! : first.speed;
    if (this.targetIndicated === null) this.askSpeed(first); // PLAY-002: a warm-up / transit line with no printed speed: he asks instead of sitting silent
    else { const li = this.launchInfo(first); const vsLaunch = li ? this.tod - li.launchTime : 0;   // PLAY-026: "on time" means on the launch second, not on the printed time
      this.say(vsLaunch > 1.5 && early > -2 ? `Leaving ${Math.round(vsLaunch)} s after our launch second` : early > 2 ? `Leaving ${Math.round(early)} s early` : early < -2 ? `Leaving ${Math.round(-early)} s late` : 'Rolling on time', 'info'); }
    this.executed.add(1);
    // PLAY-008: the start line is done once the car leaves: the pointer (and the perf card) move to line 2 at once
    this.lastExecutedLine = 1; this.lastCrossedLine = 1;
    if (this.sc.aids.autoAdvanceLine && this.currentLine === 1) this.currentLine = Math.min(this.sc.book.length, 2);
    if (first.transit && !first.transit.end) this.inTransit = true;
    this.nextNodeIdx = this.sc.course.nodes.findIndex(n => n.s > 0);
    if (this.nextNodeIdx < 0) this.nextNodeIdx = this.sc.course.nodes.length;
    this.car.mode = 'cruise';
    this.startRamp = true; this.announceAtSpeed = true;
    if (this.sc.car.a0 >= 1e4 && this.targetIndicated !== null) this.car.v = mphToFps(this.speedo.inverse(this.targetIndicated)); // instant (ghost) car leaves at speed
  }

  /** PLAY-002: the driver has no speed to drive (a transit or warm-up line prints none): he asks, naming the transit pace the box implies. */
  private speedAsked = false; private speedAskTod = -Infinity;
  private askSpeed(ins: Instruction | undefined): void {
    const t = ins?.transit; const pace = transitPaceMph(t);
    const what = ins?.section === 'warmup' || /warm-?up/i.test(ins?.text ?? '') ? 'the warm-up' : t ? 'the transit' : 'this line';
    this.say(pace !== null ? `What speed for ${what}? The book prints none: about ${pace} mph makes ${t!.miles} mi in ${Math.round(t!.seconds / 60)} min` : `What speed for ${what}? The book prints none`, 'question');
    this.speedAsked = true; this.speedAskTod = this.tod; this.log('speed.asked', { line: ins?.n ?? null, suggested: pace });
  }
  /** The transit / warm-up line the car is driving now (the last begin line it has passed), for the speed question. */
  private transitLineHere(): Instruction | undefined {
    let found: Instruction | undefined;
    for (const ins of this.sc.book) { if (instructionS(this.sc.course, ins) > this.car.s + 1) break; if (ins.transit && !ins.transit.end) found = ins; else if (ins.transit?.end) found = undefined; }
    return found ?? this.sc.book[0];
  }

  /** `clock: true` records that the navigator looked at the time of day (WATCH-009). */
  observe(opts: { peek?: boolean; clock?: boolean } = {}): Observation {
    if (opts.clock) this.instr('clock.read');
    const msgs = opts.peek ? [...this.pendingMsgs] : this.pendingMsgs; if (!opts.peek) this.pendingMsgs = [];
    const ahead = this.visibleFeatures();
    const aids: Observation['aids'] = {};
    // CAL-006: no live early/late feedback while the calibration run is being driven, at any rung (the navigator does the math afterwards)
    const calRun = this.inCalibrationRun();
    if (this.sc.aids.paceBar && this.phase === 'running' && !calRun) aids.earlyLate = Math.round(this.pace() * 10) / 10;
    if (this.sc.aids.countdown && this.timedChange && !calRun) { const ghostChange = this.legAnchorActual + (ghostTimeAt(this.ghost, this.timedChange.atS) - this.legAnchorGhost); aids.countdown = Math.round((ghostChange - this.tod) * 10) / 10; }
    if (this.sc.aids.cumulativeTimes && !calRun) { const ins = this.sc.book[this.currentLine - 1]; if (ins) aids.cumulativePerfectAtNextLine = ghostTimeAt(this.ghost, instructionS(this.sc.course, ins)) - this.sc.startTime; }
    const pace = this.paceCarsNow(); const hands = this.clock.hands(this.tod);
    const launch = this.launchInfo(); const lline = launch ? this.sc.book.find(i => i.n === launch.line) ?? null : null;
    return {
      phase: this.phase, tod: this.tod, secondsToStart: this.sc.startTime - this.tod,
      stopwatch: { kind: this.watch.kind, running: this.watch.running, reading: this.watch.reading(this.tod), laps: [...this.watch.laps], bezel: this.watch.bezel, bezelRemaining: (Math.round(this.watch.bezelRemaining(this.tod) * 5) / 5) % this.watch.dialSeconds, dialSeconds: this.watch.dialSeconds, mode: this.watch.mode, lapTable: this.watch.lapTable(), frozen: this.watch.isFrozen(this.tod), recalled: this.watch.recalled },
      ledger: this.ledger,
      bezel: this.clock.bezel,
      speedo: { reading: this.navigatorSpeedoReading(), kind: this.sc.speedo.kind },
      book: this.sc.book, currentLine: this.currentLine, ahead,
      driver: { messages: msgs, state: this.driverState(), targetIndicated: this.targetIndicated, pendingTurn: this.pendingTurn, waitingForGo: this.waitingForGo, lastExecutedLine: this.sc.aids.checkOff ? this.lastExecutedLine : null },
      annotations: { ...this.annotations },
      stoppedAtLine: this.waitingForGo && this.waitNodeId ? (this.sc.book.find(i => i.nodeId === this.waitNodeId)?.n ?? null) : null,
      carStopped: this.car.v === 0, offCourseHint: this.sc.aids.offCourseAlert && this.off !== null && this.off.branchDist > this.sc.excursionFt! * 0.5,
      aids, notes: [...this.notes], legIndex: this.sc.aids.rung >= 2 ? this.legIndex : null, startTime: this.sc.startTime, rules: this.sc.rules,
      ta: this.taState(), asp: this.sc.asp, timeZone: this.sc.timeZone,
      clock: { hourAngle: hands.hourAngle, minuteAngle: hands.minuteAngle, secondAngle: hands.secondAngle, minuteAmbiguous: hands.minuteAmbiguous, hour: hands.hour, minute: this.sc.aids.rung <= 1 && hands.minuteAmbiguous ? null : hands.minute, second: hands.second },
      launch, startQueue: lline && (launch!.kind === 'start' || launch!.kind === 'restart') && !(this.sc.startProcedure === 'drill' && lline.n === 1) ? this.startQueue(lline) : null,
      paceCars: calRun ? { ahead: null, behind: null } : { ahead: pace.ahead && pace.aheadVisible ? pace.ahead : null, behind: pace.behind && pace.behindVisible ? pace.behind : null }, // ENG-019: none in the calibration run
      cues: { gainingOnCarAhead: !calRun && pace.aheadVisible && this.gainingNow },
      ledgerEntries: this.ledgerEntries.map(e => ({ ...e })), makeUpTotal: makeUpTotal(this.ledgerEntries),
      nextCall: this.sc.aids.rung >= 2 ? this.nextCallNow : null,
    };
  }

  /** Advance simulated time; always integrates in fixed 0.1 s ticks for determinism. */
  step(dt: number): void {
    this.accum += dt;
    while (this.accum >= TICK - 1e-9 && this.phase !== 'finished') { this.accum -= TICK; this.doTick(TICK); }
    if (this.phase === 'finished') this.accum = 0;
  }
  private accum = 0;
  private forceResetAt: number | null = null;
  /** Integer tick count since construction; tod = tod0 + tick * TICK exactly (SIM-025). */
  tick = 0;
  private readonly tod0: number;
  actions: { tick: number; action: Action }[] = [];
  annotations: Record<number, string> = {};
  lastExecutedLine: number | null = null;
  /** Last instruction whose node the car has crossed (internal; the driver's check-off waits for completion, GRIID-006). */
  private lastCrossedLine: number | null = null;
  secondsLateAtStart = 0;

  private doTick(dt: number): void {
    if (this.phase === 'finished') return;
    this.tick++;
    const todNext = this.tod0 + this.tick * TICK;
    if (this.phase === 'preread') {
      this.tod = todNext; this.launchTick();
      // PLAY-005: a drill-sized start launches the car itself on the printed launch second (no queue, no count)
      if (this.sc.startProcedure === 'drill') { const li = this.launchInfo(); if (li && this.tod >= li.launchTime - 1e-6) { this.depart('drill'); return; } }
      if (this.tod > this.sc.startTime + 30 * 60) { this.say('We are 30 minutes late, I am leaving', 'info'); this.depart('late'); }
      return;
    }
    this.drivingSeconds += dt;
    if (this.forceResetAt !== null && this.drivingSeconds >= this.forceResetAt) { this.forceResetAt = null; this.watch.stop(this.tod); this.watch.reset(this.tod); this.log('watchLost'); this.say('Your watch! It fell and reset', 'info'); }
    const sBefore = this.car.s;
    const vgBefore = this.ghostSpeedAt(this.routeS());
    this.driverStep(dt);
    this.speedo.step(dt, this.car.mph());
    this.tod = todNext;
    const wasOff = !!this.off;
    if (this.off) this.offCourseStep(dt, sBefore);
    else this.routeStep(sBefore);
    this.v3Tick(dt);
    // attribution increment: de = dt - ds/vg (ghost speed where the car is on the route)
    // PLAY-032: the tick that rejoins the route moves car.s back to the junction: it is off-course time, never a huge negative ds booked to the turn bucket
    const ds = this.off || wasOff ? 0 : this.car.s - sBefore;
    const vg = vgBefore > 0 ? vgBefore : 1e9;
    const de = dt - ds / vg;
    this.buckets[wasOff ? 'offCourse' : this.currentBucket()] += de;
    // TA-004: only an accident scene or a declared emergency reduced speed accrues qualifying delay while driving (trains and signals are booked at the stop)
    // ENG-010: a printed-pause stop (or any stop the book or the stop booking pays) inside a zone is not zone delay
    // (the dwell, the braking into the stop and the pull-away back up to the zone's speed are the stop's, which the pause and the chart pause time pay)
    const zoneMph = this.activeAccident()?.speedMph ?? this.activeQualZone()?.speedMph ?? null;
    const inStop = this.waitingForGo || (this.curStop !== null && (this.car.mode === 'stopping' || (zoneMph !== null && this.car.v < mphToFps(zoneMph) - 0.3)));
    if (!this.off && !inStop && (this.emergency || this.activeAccident() || this.activeQualZone())) { this.accrueEpisode(Math.max(0, de)); this.taCause[this.legIndex] = this.activeAccident() ? 'accident' : this.activeQualZone()?.kind ?? 'emergency'; }
    else if (this.qualEpisode && !inStop) this.closeQualEpisode();
    if (this.currentBucket() === 'cruise') { this.cruiseDt += dt; this.cruiseDs += ds; this.cruiseGhostDs += vg * dt; }
    if (this.off && this.off.phase === 'turning') { this.off.turnTimer -= dt; if (this.off.turnTimer <= 0) { this.off.phase = 'back'; this.say('Heading back', 'info'); } }
    this.checkFinish();
  }

  /** ENG-007: once result() has been read, no request can be filed (the committee's numbers are in it). */
  private resultRead = false;
  result(): StageResult {
    if (this.phase === 'finished') this.resultRead = true;
    const legs = this.scoreLegs();
    const attribution = [...this.attribution, this.currentAttribution()].filter(a => a.legIndex <= Math.max(1, this.ghost.legs.length));
    for (const l of legs) { const a = attribution.find(x => x.legIndex === l.index); if (a && l.taCredit) a.buckets.ta = -l.taCredit; }
    const pauseLines = this.sc.book.filter(i => i.pause);
    const startTick = this.actions.find(a => a.action.type === 'start')?.tick ?? Infinity;
    const annotatedBefore = pauseLines.filter(i => this.actions.some(a => a.action.type === 'line.annotate' && a.action.n === i.n && a.tick <= startTick)).length;
    const obsRec = this.records.find(r => r.kind === 'observation');
    const hasObs = this.sc.checkpoints.some(c => c.kind === 'observation');
    const observationMissed = hasObs && !(obsRec && obsRec.stopped);
    const observationNeverReached = hasObs && !(obsRec && obsRec.actualTod !== null);
    const score = scoreStage(legs, this.sc.car.year, this.sc.rules, { observationMissed, observationNeverReached, earlyDepartureMinutes: this.earlyDepartureMinutes, formalProblems: this.taRequests.filter(r => r.requestType === 'formal-problem' && r.status === 'filed').length });
    const hasEndTa = this.sc.book.some(i => i.taPoint?.endOfStage);
    return {
      scenarioId: this.sc.id, score, records: [...this.records], attribution,
      events: [...this.events], instructionsExecuted: this.executed.size, drivingSeconds: this.drivingSeconds, offCourseCount: this.offCourseCount,
      observationMissed, ghostEndTod: this.ghost.endTod, ledgerLog: [...this.ledgerLog],
      actions: [...this.actions], secondsLateAtStart: this.secondsLateAtStart, prereadCoverage: pauseLines.length ? annotatedBefore / pauseLines.length : 1, engineVersion: ENGINE_VERSION,
      instrumentDiscipline: this.disciplineFindings(), instrumentLog: [...this.instrumentLog],
      dnf: score.dnf, ta: { requests: this.taRequests.map(r => ({ ...r })), scorecardAcked: hasEndTa ? this.scorecardAcked : null }, earlyDepartureMinutes: [...this.earlyDepartureMinutes],
      startDeltas: this.allStartDeltas(), findings: this.debriefFindings.map(f => ({ ...f })),
    };
  }

  /** Seconds late (+) or early (-) right now relative to the current leg anchor. */
  pace(): number {
    const g = ghostTimeAt(this.ghost, this.routeS());
    return (this.tod - this.legAnchorActual) - (g - this.legAnchorGhost);
  }

  /** SIM-019: the navigator glances at the driver's gauge and reads it to mark spacing unless aids allow the fine reading. */
  private navigatorSpeedoReading(): number {
    const fine = this.speedo.reading(this.car.mph());
    if (this.sc.aids.showSpeedo === 'fine') return fine;
    const q = this.sc.speedo.kind === 'mechanical' ? 5 : 1;
    return Math.round(fine / q) * q;
  }

  // ---------- internals ----------
  private routeS(): number { return this.off ? this.off.nodeS : this.car.s; }
  private ghostSpeedAt(s: number): number {
    const bps = this.ghost.breakpoints; let lo = 0, hi = bps.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bps[mid]!.s <= s) lo = mid; else hi = mid - 1; }
    return bps[lo]!.v;
  }
  private log(type: string, detail?: Record<string, unknown>): void { this.events.push({ tod: this.tod, s: this.car.s, type, detail }); }
  private msgSeq = 0;
  private say(text: string, kind: DriverMessage['kind']): void { const m = { id: ++this.msgSeq, tod: this.tod, text, kind }; this.driverMsgs.push(m); this.pendingMsgs.push(m); this.log('driver', { text, kind }); }
  private driverState(): string {
    if (this.phase !== 'running') return this.phase;
    if (this.off) { if (!this.sc.aids.offCourseAlert) return this.off.phase === 'turning' ? 'uturn' : 'cruise'; return this.off.phase === 'out' ? 'offcourse' : this.off.phase === 'turning' ? 'uturn' : 'returning'; }
    if (this.waitingForGo) return `waiting:${this.waitReason}`;
    return this.car.mode;
  }
  private startRamp = false;
  private turnRecovering = false;
  /** ENG-024: where and how fast the car was when the last turn was called (judges "too late"). */
  private turnArm: { s: number; v: number } | null = null;
  private announceAtSpeed = false;
  private currentBucket(): Bucket {
    if (this.off) return 'offCourse';
    if (this.startRamp) return 'start';
    if (this.waitingForGo && (this.waitReason === 'signal' || this.waitReason === 'train')) return 'hazard';
    if (this.waitingForGo && this.waitReason === 'stop' && this.goPending) return 'hazard'; // PLAY-006: cross traffic after the go is a hazard (ledger), not the navigator's stop
    if (this.curStop) return 'stop';
    if (this.activeSlowHazard() || this.activeAccident() || this.blockerAhead()) return 'hazard';
    if (this.car.s < this.turnZoneEndS || this.turnRecovering) return 'turn';
    if (this.rampKind) return this.rampKind;
    return 'cruise';
  }

  private beginRamp(): void {
    if (this.targetIndicated === null) return;
    const trueTarget = mphToFps(this.speedo.inverse(this.targetIndicated));
    if (Math.abs(trueTarget - this.car.v) > mphToFps(1.5) && !this.curStop && !this.off) {
      this.rampTarget = trueTarget;
      this.rampKind = this.timedChange ? 'timedChange' : 'speedChange';
      this.car.accelFactor = 1 + this.rampRng.gauss(0, this.sc.driver.inconsistency);
      this.car.decelFactor = 1 + this.rampRng.gauss(0, this.sc.driver.inconsistency);
    }
  }

  private release(reason: string): void {
    // TAF-002: a qualifying stop (train, or a signal when rules.taForSignals) is booked as seconds stopped + the chart stop-and-go loss for its speeds
    if ((this.waitReason === 'train' || (this.waitReason === 'signal' && this.sc.rules.taForSignals)) && !this.inTransit) {
      const vIn = this.curStop?.vIn ?? Math.round(fpsToMph(this.ghostSpeedAt(this.routeS()))); const vOut = this.curStop?.vOut ?? vIn;
      const stopped = Math.max(0, this.tod - this.waitStartTod);
      this.taStops.push({ leg: this.waitLeg || this.legIndex, stopped, vIn, vOut });
      if (this.waitReason === 'train') {
        this.taCause[this.waitLeg || this.legIndex] = 'train';
        // the chart loss joins the stopped time as one delay: the make-up estimate is for the whole delay, not once per part
        const chart = stopLoss(vIn, vOut, this.sc.car); const lg = this.waitLeg || this.legIndex;
        const before = this.recoverableFor(stopped), after = this.recoverableFor(stopped + chart);
        this.addQualifying(chart, false, this.lineOfNodeId(this.waitNodeId)); if (!this.inTransit) this.taRecoverable[lg] = (this.taRecoverable[lg] ?? 0) + (after - before);
      }
    }
    this.waitingForGo = false; this.waitReason = null; this.patienceWarned = false;
    if (this.waitNodeId) { const wn = this.sc.course.nodes.find(x => x.id === this.waitNodeId); { const k = wn ? this.holdKind(wn) : null; if (wn && (k === 'restart' || k === 'transitEnd')) this.checkClockUse(k === 'restart' ? 'Restart time' : 'Exact-transit OUT time', this.sc.book.find(i => i.nodeId === wn.id)?.n ?? 0);
      if (wn && k === 'restart') { const ri = this.sc.book.find(i => i.nodeId === wn.id); if (ri) this.recordStartDelta(ri, this.tod, this.waitStartTod); }
      if (wn && k === 'transitEnd') { const go = this.holdGoTod(wn); const ri = this.sc.book.find(i => i.nodeId === wn.id); if (go !== null && ri) this.checkOneMinute(ri.n, go, this.tod, 'Exact-transit OUT', this.waitStartTod); } } if (wn && this.isHoldNode(wn)) this.startRamp = true; this.releasedNodeId = this.waitNodeId; this.waitNodeId = null; }
    this.announceAtSpeed = true;
    if (this.curStop) { this.curStop.dwell = this.curStop.dwellStart !== null ? this.tod - this.curStop.dwellStart : 0; }
    this.car.accelFactor = 1 + this.rampRng.gauss(0, this.sc.driver.inconsistency);
    this.goRequestedEarly = false; if (this.pullover && this.car.v === 0) this.pullover = false; // ENG-002: going again ends a pull-over
    this.log('release', { reason });
  }

  /** An accident scene the car is driving through (its delay qualifies for a Time Allowance, V.H.1). */
  private activeAccident(): AccidentHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) if (h.kind === 'accident' && this.car.s >= h.s && this.car.s < h.s + h.lengthFt) return h;
    return null;
  }

  /** TAF-002: a tractor, combine or construction zone the car is driving through; the delay it causes qualifies for a Time Allowance (Time Delay Form). */
  private activeQualZone(): TractorHazard | CombineHazard | ConstructionHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) if ((h.kind === 'tractor' || h.kind === 'combine' || h.kind === 'construction') && this.car.s >= h.s && this.car.s < h.s + h.lengthFt) return h;
    return null;
  }
  /** TAF-002: a school bus stopped with its red lights flashing in the lane ahead (blocking): the car waits behind it while the bus is stopped. */
  private blockerAhead(): SchoolBusHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) if (h.kind === 'schoolBus' && this.tod >= h.startTod && this.tod < h.startTod + h.durationSeconds && this.car.s <= h.s - 30 && h.s - this.car.s < 900) return h;
    return null;
  }

  private activeSlowHazard(): SlowHazard | ConstructionHazard | TractorHazard | CombineHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) {
      if (h.kind === 'slow' && this.passRequested && this.car.s >= h.s + h.lengthFt) this.passRequested = false;
      if ((h.kind === 'slow' || h.kind === 'construction' || h.kind === 'tractor' || h.kind === 'combine') && this.car.s >= h.s && this.car.s < h.s + h.lengthFt) {
        if (h.kind === 'slow' && this.passRequested && h.passWindowAfterFt !== undefined && this.car.s >= h.s + h.passWindowAfterFt) continue;
        return h;
      }
    }
    return null;
  }

  private nextNode(): Node | null { return this.sc.course.nodes[this.nextNodeIdx] ?? null; }
  /**
   * The next intersection the driver will actually turn at (a callout is armed and matches an exit of 20 degrees or more), looking past
   * driveways and side roads he will drive by: he sees the turn coming and brakes for it, not for the node nearest the car.
   */
  private nextTurnNode(): Node | null {
    const nodes = this.sc.course.nodes;
    for (let i = this.nextNodeIdx; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (n.s - this.car.s > 1500) break;
      if (n.kind !== 'intersection' || !n.exits || !n.exits.length) continue;
      if (Math.abs(this.peekExit(n).angle) >= 20) return n;
    }
    return this.nextNode();
  }

  /** Driver: decide target speed and stop point, step the car. */
  private driverStep(dt: number): void {
    const drv = this.sc.driver;
    // speed-holding error process (indicated mph)
    const sd = drv.skill === 'perfect' ? 0 : drv.skill === 'expert' ? 0.2 : drv.skill === 'sportsman' ? 0.5 : 1.0;
    const tauB = 30;
    this.bias += (-this.bias / tauB) * dt + sd * Math.sqrt(2 * dt / tauB) * this.drvRng.gauss();
    const jitter = this.drvRng.gauss(0, sd * 0.15);
    let targetTrue = this.targetIndicated === null ? 0 : mphToFps(Math.max(0, this.speedo.inverse(this.targetIndicated + this.bias + jitter)));
    if (this.off) { this.offCourseDrive(dt, targetTrue); return; }

    // hazards limiting speed
    const slow = this.activeSlowHazard();
    if (slow) targetTrue = Math.min(targetTrue, mphToFps(slow.speedMph));
    const accident = this.activeAccident();
    if (accident) targetTrue = Math.min(targetTrue, mphToFps(accident.speedMph));
    // approaching an intersection where we will turn: brake to the turn cap so we arrive at it, hold it for 60 ft past the node
    const nn = this.nextTurnNode();
    if (nn && nn.kind === 'intersection' && nn.exits && this.car.s < nn.s + turnZoneOf(this.sc.car)) {
      const ex = this.peekExit(nn);
      const ang = Math.abs(ex.angle);
      if (ang >= 20) {
        const cap = mphToFps(ang > 120 ? this.sc.car.turnSpeedMph.acute : ang >= 60 ? this.sc.car.turnSpeedMph.turn : this.sc.car.turnSpeedMph.bear);
        const dist = nn.s - this.car.s;
        const brakeDist = Math.max(0, (this.car.v * this.car.v - cap * cap) / (2 * this.car.aDec()));
        if (dist <= brakeDist + this.car.v * 0.3 || this.car.s >= nn.s - 5) { this.turnCap = cap; this.turnZoneEndS = nn.s + turnZoneOf(this.sc.car); }
      }
    }
    if (this.car.s < this.turnZoneEndS) { targetTrue = Math.min(targetTrue, this.turnCap); this.turnRecovering = true; }
    else if (this.turnRecovering && (this.car.v >= targetTrue - mphToFps(0.5) || this.waitingForGo || this.curStop)) this.turnRecovering = false;
    if (this.pullover) targetTrue = 0;

    // determine whether we must stop at the next node
    let stopAt: number | null = null;
    const node = this.nextNode();
    if (node) {
      const line = node.s - (node.stopLineOffset ?? 0);
      const dist = line - this.car.s;
      const mustStop = this.mustStopAt(node);
      if (mustStop && dist > -1) stopAt = line;
      // arrived and stopped at the line?
      if (stopAt !== null && this.car.v === 0 && Math.abs(this.car.s - line) <= 2 && !this.waitingForGo) this.beginWait(node);
      if (this.waitingForGo) {
        // auto releases
        if (this.waitReason === 'signal' && !this.signalRedAt(node)) { this.say('Green', 'info'); this.release('signal'); }
        if (this.waitReason === 'train' && !this.trainAt(node)) { this.say('Train cleared', 'info'); this.release('train'); }
        if (this.waitReason === 'stop' && this.goPending && this.tod >= this.trafficClearTod) { this.goPending = false; this.say('Clear, going', 'info'); this.release('stop'); }
        if (this.waitReason === 'stop' && !this.holdRequested) {
          const waited = this.tod - this.waitStartTod;
          if (waited > drv.patienceSeconds && !this.patienceWarned) { this.patienceWarned = true; this.say('Going?', 'question'); }
          if (waited > 2 * drv.patienceSeconds) { this.say("I'm going", 'info'); this.release('patience'); }
        }
        if (this.waitingForGo) { this.car.step(dt, 0, line); return; }
        // released: fall through with no stop
        stopAt = null;
        if (this.mustStopAt(node) && this.car.v === 0) {
          // just released from this node; allow leaving
        }
      }
      if (this.releasedNodeId === node.id) stopAt = null;
    }
    if (this.pullover) stopAt = null;
    { const blk = this.blockerAhead(); this.car.step(dt, targetTrue, blk ? (stopAt === null ? blk.s - 40 : Math.min(stopAt, blk.s - 40)) : stopAt); }
    if (stopAt !== null && node && this.car.v === 0 && Math.abs(this.car.s - stopAt) <= 2 && !this.waitingForGo) {
      this.beginWait(node);
      if (this.goRequestedEarly && this.tod - this.goRequestedAt > 1.5) this.goRequestedEarly = false; // ENG-001: a go is for the stop the car is settling at, not the next one
      if (this.goRequestedEarly) { this.goRequestedEarly = false; if (this.curStop && this.curStop.goCalledAt === null) this.curStop.goCalledAt = this.tod; if (this.waitReason === 'stop' || this.waitReason === 'hold' || this.waitReason === 'finish') { if (this.waitReason === 'stop' && this.tod < this.trafficClearTod) { this.goPending = true; this.say('Waiting on traffic', 'info'); } else { const wn = this.waitNodeId; this.say('Going', 'readback'); this.release(this.waitReason); if (wn) this.checkEarlyDeparture(wn); } } }
      this.car.step(0, 0, stopAt); return;
    }
    if (this.pullover && this.car.v === 0) { if (!this.waitingForGo) { this.waitingForGo = true; this.waitReason = 'pullover'; this.waitStartTod = this.tod; this.log('pulledOver'); } } // ENG-002: its own wait (a 'finish' wait would end the stage)
    if (this.startRamp && this.targetIndicated !== null && this.car.v >= mphToFps(this.speedo.inverse(this.targetIndicated)) - 0.3) this.startRamp = false;
    // ramp bookkeeping
    if (this.rampKind && this.rampTarget !== null && Math.abs(this.car.v - this.rampTarget) < 0.3) { this.rampKind = null; this.rampTarget = null; }
    if (this.announceAtSpeed && this.targetIndicated !== null && !this.waitingForGo && this.car.v > 0 && Math.abs(this.car.v - mphToFps(this.speedo.inverse(this.targetIndicated))) < mphToFps(0.5)) { this.announceAtSpeed = false; this.say(`At ${this.targetIndicated}`, 'info'); }
  }
  private releasedNodeId: string | null = null;
  private waitNodeId: string | null = null;
  private trafficClearTod = 0;
  private goPending = false;
  private turnConsumed = false;
  private goRequestedEarly = false;
  private goRequestedAt = -Infinity;
  /** ENG-001: the car is at rest within a few feet of the stop line of a node it must stop at (the go of a stop it is settling at). */
  private atStopLineSoon(): boolean {
    const n = this.nextNode(); if (!n || this.off || !this.mustStopAt(n)) return false;
    const line = n.s - (n.stopLineOffset ?? 0);
    return line - this.car.s <= 6 && line - this.car.s > -2;
  }

  private mustStopAt(node: Node): boolean {
    if (this.releasedNodeId === node.id) return false;
    if (node.control === 'STOP') return true;
    if (this.holdRequested) return true;
    if (this.isHoldNode(node)) return true;
    if (node.kind === 'finish' && this.holdRequested) return true;
    if (node.control === 'SIGNAL' && this.signalRedAt(node)) return true;
    if (node.control === 'RR' && this.trainAt(node)) return true;
    if (node.kind === 'intersection' && !this.pendingTurn && !this.hasStraightExit(node)) return true; // a T: ask
    return false;
  }
  private signalRedAt(node: Node): boolean {
    const h = this.sc.hazards.find(h => h.kind === 'signal' && Math.abs(h.s - node.s) < 1);
    return h ? signalIsRed(h as Extract<Hazard, { kind: 'signal' }>, this.tod) : false;
  }
  private trainAt(node: Node): boolean {
    const h = this.sc.hazards.find(h => h.kind === 'train' && Math.abs(h.s - node.s) < 1);
    return h ? trainActive(h as Extract<Hazard, { kind: 'train' }>, this.tod) : false;
  }
  private isRestartNode(node: Node): boolean { const ins = this.sc.book.find(i => i.nodeId === node.id); return !!ins && ins.section === 'restart' && ins.restartTime !== undefined; }
  /** Nodes where the car waits for its time: a time-of-day restart, the end of an exact transit (leave at IN + interval), a promoted lunch/pit/rest stop. */
  private holdKind(node: Node): 'restart' | 'transitEnd' | 'promoted' | null {
    const ins = this.sc.book.find(i => i.nodeId === node.id); if (!ins) return null;
    if (ins.section === 'restart' && ins.restartTime !== undefined) return 'restart';
    if (ins.transit?.end && ins.transit.exact && !ins.restartTime) return 'transitEnd';
    if (ins.promotedStop) return 'promoted';
    return null;
  }
  private isHoldNode(node: Node): boolean { return this.holdKind(node) !== null; }
  private lineOfNode(node: Node): number | undefined { return this.sc.book.find(i => i.nodeId === node.id)?.n; }
  /** Seconds the book already grants at this node: a printed pause on a signal covers part of a red wait (REG-006). */
  private pauseGranted(node: Node): number { return this.sc.book.find(i => i.nodeId === node.id)?.pause ?? 0; }
  /** OUT time of the exact transit ended by this line: the recorded IN time + its interval (STAGE-003). */
  transitOutFor(endIns: Instruction): number | null {
    const idx = this.sc.book.indexOf(endIns); const begin = exactTransitBegin(this.sc.book, idx);
    if (!begin) return null; const inT = this.transitIn[begin.n];
    return inT === undefined ? null : inT + begin.transit!.seconds;
  }
  /** TOD the navigator must say go at a hold node (restart time, transit OUT, or the scheduled departure of a promoted stop), or null. */
  holdGoTod(node: Node): number | null {
    const ins = this.sc.book.find(i => i.nodeId === node.id); const k = this.holdKind(node); if (!ins || !k) return null;
    if (k === 'restart') return ins.restartTime!;
    if (k === 'transitEnd') return this.transitOutFor(ins);
    const idx = this.sc.book.indexOf(ins);
    for (let j = idx + 1; j < this.sc.book.length; j++) {
      const x = this.sc.book[j]!;
      if (x.restartTime !== undefined) return x.restartTime - ins.promotedStop!.leaveBeforeEndSeconds;
      if (x.transit?.end) { const out = x.transit.exact ? this.transitOutFor(x) : null; return out === null ? null : out - ins.promotedStop!.leaveBeforeEndSeconds; }
    }
    return null;
  }
  /** V.E.3.h: leaving a promoted stop more than 5 minutes before the scheduled departure is penalised. */
  private checkEarlyDeparture(nodeId: string): void {
    const node = this.sc.course.nodes.find(x => x.id === nodeId); if (!node || this.holdKind(node) !== 'promoted') return;
    const go = this.holdGoTod(node); if (go === null) return;
    const early = (go - this.tod) / 60;
    if (early > 0) { this.earlyDepartureMinutes.push(Math.round(early * 100) / 100); this.log('promotedStop.early', { minutesEarly: early, scheduled: go }); if (early > this.sc.rules.earlyDepartureMinutes) this.say(`Scoring crew: you left ${early.toFixed(1)} minutes before the scheduled departure (V.E.3.h)`, 'info'); }
  }
  /** A Stop Sign is the next control within sight. */
  private stopAhead(): boolean { const n = this.nextNode(); return !!n && n.control === 'STOP' && n.s - this.car.s < 2000; }
  private hasStraightExit(node: Node): boolean { return (node.exits ?? []).some(e => Math.abs(e.angle) < 20 && e.kind === 'road'); }

  private beginWait(node: Node): void {
    this.waitingForGo = true; this.waitStartTod = this.tod; this.patienceWarned = false; this.waitNodeId = node.id; this.waitLeg = this.legIndex;
    if (node.control === 'SIGNAL' && this.signalRedAt(node)) { this.waitReason = 'signal'; this.say('Red light', 'info'); if (this.sc.rules.taForSignals) this.addQualifying(Math.max(0, signalRedRemaining(this.sc.hazards.find(h => h.kind === 'signal' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'signal' }>, this.tod) - this.pauseGranted(node)), true, this.lineOfNode(node)); }
    else if (node.control === 'RR' && this.trainAt(node)) { this.waitReason = 'train'; this.say('Train!', 'info'); this.addQualifying(trainRemaining(this.sc.hazards.find(h => h.kind === 'train' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'train' }>, this.tod), true, this.lineOfNode(node)); }
    else if (this.isHoldNode(node)) {
      this.waitReason = 'hold';
      const k = this.holdKind(node); const go = this.holdGoTod(node);
      // PLAY-007: the line names the kind of hold (restart, exact-transit OUT, lunch / pit / fuel / rest stop)
      // N15: at the legal rungs (aids rung <= 1) the driver never states the computed time: the navigator works it out from the book (base + ASP, IN + interval, restart - 45m)
      const legal = this.sc.aids.rung <= 1;
      if (k === 'restart') this.say(go !== null && !legal ? `Restart line. Our time is ${formatClock(go)}: give me 30 seconds and count me down to the launch second` : legal ? 'Restart line. What is our time? Give me 30 seconds and count me down to the launch second' : 'Restart line. Count me down to our launch second', 'info');
      else if (k === 'transitEnd') this.say(go !== null && !legal ? `End of the exact transit. Say go at our out time ${formatClock(go)}` : legal ? 'End of the exact transit. What is our out time? Say go on it' : 'End of the exact transit. Say go at our out time', 'info');
      else { const pk = this.sc.book.find(i => i.nodeId === node.id)?.promotedStop?.kind; const word = pk === 'meal' ? 'Lunch' : pk === 'refuel' ? 'Fuel' : pk === 'pit' ? 'Pit' : pk === 'rest' ? 'Rest' : 'Promoted';
        this.say(go !== null && !legal ? `${word} stop. We leave AT ${formatClock(go)}, not before ${formatClock(go - this.sc.rules.earlyDepartureMinutes * 60)} (${this.sc.rules.earlyDepartureMinutes}-minute penalty window)` : legal ? `${word} stop. When do we leave? Not more than ${this.sc.rules.earlyDepartureMinutes} minutes early (the penalty window)` : `${word} stop`, 'info'); }
    }
    else if (node.control === 'STOP') { this.waitReason = 'stop'; this.say('Stopped', 'info'); const p = this.sc.trafficWaitProbability ?? 0; if (p > 0) { const tr = rng(`${this.sc.seed}:traffic:${node.id}`); if (tr.chance(p)) this.trafficClearTod = this.tod + tr.next() * 20; } }
    else if (this.holdRequested) { this.waitReason = node.kind === 'finish' ? 'finish' : 'hold'; this.say('Stopped here', 'info'); }
    else if (node.kind === 'intersection' && !this.pendingTurn) { this.waitReason = 'ask'; this.say('Left or right?', 'question'); }
    else { this.waitReason = 'hold'; }
    this.holdRequested = false;
    { const pi = this.sc.book.find(i => i.nodeId === node.id); if (pi?.pause && pi.pause > 0) { if (pi.timed) this.stoppedTod.set(pi.n, this.tod); else this.anchors.push({ tod: this.tod, line: pi.n, kind: 'pause' }); } }   // PLAY-030: a STOP + timed line has one anchor, the ghost's departure
    if (this.curStop) this.curStop.dwellStart = this.tod;
    this.log('wait', { nodeId: node.id, reason: this.waitReason });
  }
  private lastQualifyingLeg: number | null = null; private lastCpTod = -Infinity;
  /** A delay that qualifies for a Time Allowance (TA-004), with the time the team could still make up before the next checkpoint (TA-003). */
  private addQualifying(sec: number, finalizeNow = true, atLine?: number): void {
    if (!(sec > 0) || this.inTransit) return; // nothing in a transit, warm-up or calibration run is timed against the ghost
    const leg = this.legIndex;
    this.taQualifying[leg] = (this.taQualifying[leg] ?? 0) + sec; this.lastQualifyingLeg = leg;
    const line = atLine ?? this.lastCrossedLine ?? this.currentLine; const l = this.taLines[leg];
    this.taLines[leg] = l ? { from: Math.min(l.from, line), to: Math.max(l.to, line) } : { from: line, to: line };
    if (finalizeNow) this.taRecoverable[leg] = (this.taRecoverable[leg] ?? 0) + this.recoverableFor(sec);
  }
  /** Seconds of a delay of `sec` that the team could have recovered driving 10 % over the assigned speed to the next Timing Checkpoint: remaining distance / assigned speed x 0.1 (TA-003). */
  private recoverableFor(sec: number): number {
    if (!this.taStructured) return 0; // legacy books without a printed TA point keep the plain min(request, measured, lateness) credit
    let cpS: number | null = null;
    for (let i = this.nextCpIdx; i < this.sc.checkpoints.length; i++) { const c = this.sc.checkpoints[i]!; if (c.kind === 'timing') { cpS = c.s; break; } }
    if (cpS === null) return 0;
    const remaining = Math.max(0, cpS - this.routeS());
    const v = this.ghostSpeedAt(this.routeS());
    if (!(v > 0)) return 0;
    return Math.min(sec, remaining / v * 0.1);
  }
  /** Close a running accident / emergency-speed delay episode: book what could have been made up (called at its end or at the checkpoint). */
  private closeQualEpisode(): void {
    if (!this.qualEpisode) return;
    this.taRecoverable[this.qualEpisode.leg] = (this.taRecoverable[this.qualEpisode.leg] ?? 0) + this.recoverableFor(this.qualEpisode.delay);
    this.qualEpisode = null;
  }
  private accrueEpisode(sec: number): void {
    if (!(sec > 0)) return;
    if (this.qualEpisode && this.qualEpisode.leg !== this.legIndex) this.closeQualEpisode();
    this.qualEpisode = this.qualEpisode ?? { leg: this.legIndex, delay: 0 };
    this.qualEpisode.delay += sec;
    this.addQualifying(sec, false);
  }

  /** What the Time Allowance committee would see for a leg (TA-005): measured delay, what could have been made up, and a suggested request. Truth: for ledgers and bots. */
  taAdvice(legIndex: number): TaAdvice {
    const measured = this.taQualifying[legIndex] ?? 0; const rec = Math.min(measured, this.taRecoverable[legIndex] ?? 0);
    const possible = Math.max(0, measured - rec);
    const l = this.taLines[legIndex];
    const stops = this.taStops.filter(x => x.leg === legIndex);
    const r1 = (x: number): number => Math.round(x * 10) / 10;
    const stoppedSeconds = r1(stops.reduce((a, x) => a + x.stopped, 0)); const chartLoss = r1(stops.reduce((a, x) => a + stopLoss(x.vIn, x.vOut, this.sc.car), 0));
    const otherDelay = r1(Math.max(0, measured - stoppedSeconds - chartLoss));
    const measuredTotal = r1(stoppedSeconds + chartLoss + otherDelay);
    const whole = Math.round(measuredTotal);
    return { legIndex, measuredDelay: measured, recoverable: rec, possible, suggested: Math.floor(possible / 10) * 10, fromLine: l?.from ?? null, toLine: l?.to ?? null, stoppedSeconds, chartLoss, otherDelay, measured: measuredTotal, makeUpToRound: whole % 10, claim: Math.floor(whole / 10) * 10, cause: this.taCause[legIndex] ?? null };
  }
  /** TAF-001: the leg number the TA form asks for = timing checkpoints passed at `tod` + 1 (default: now). */
  legNumberFor(tod: number = this.tod): number {
    let passed = 0;
    for (const r of this.records) if (r.kind === 'timing' && r.rawTod !== null && r.rawTod <= tod + 1e-9) passed++;
    return passed + 1;
  }
  /** TAF-001 paper mode: the car is stopped at a red (observation) checkpoint. */
  private atRedCheckpoint(): boolean { return this.records.some(r => r.kind === 'observation' && r.stopped === true); }

  /** TA-001/TA-002: validate and book a Time Allowance request. `lenient` = legacy books without a TA point (no window, no 10 s rounding). */
  private fileTa(legIndex: number, seconds: number, fromLine: number, toLine: number, note: string | undefined, lenient: boolean, form?: Extract<Action, { type: 'ta.request' }>): void {
    const rec: TaRequestRecord = { tod: this.tod, legIndex, requested: seconds, adjusted: seconds, fromLine, toLine, note, status: 'filed' };
    if (form) {
      for (const k of ['carNumber', 'password', 'phone', 'stage', 'cause', 'witnesses', 'requestType', 'contestantStatus', 'circumstances', 'witnessedBy'] as const) if (form[k] !== undefined) (rec as unknown as Record<string, unknown>)[k] = form[k];
      rec.missingFields = (['carNumber', 'password', 'phone', 'stage', 'cause'] as const).filter(k => form[k] === undefined || form[k] === '');
    }
    const paper = this.sc.rules.taMode === 'paper';
    const refuse = (reason: string): void => { rec.status = 'refused'; rec.reason = reason; rec.adjusted = 0; this.taRequests.push(rec); this.say(`Scoring crew: request refused. ${reason}`, 'info'); this.log('ta.refused', { legIndex, seconds, reason }); };
    const nLegs = this.ghost.legs.length;
    // ENG-007: once the stage has finished the committee's numbers are known: no more requests (no result peeking)
    // (a paper sheet may still be handed in at the final red checkpoint stop, until the result has been read)
    if (this.phase === 'finished' && (!paper || this.resultRead)) return refuse('The stage has finished: requests are filed during the stage, at the TA point.');
    if (!lenient && paper) {
      // TAF-001 classic paper sheets: handed in at a red (observation) checkpoint stop, no window; any completed leg
      if (!this.atRedCheckpoint()) return refuse('Paper Time Allowance sheets are handed in at a red (observation) checkpoint stop.');
      if (!(legIndex >= 1 && legIndex <= this.legIndex - 1)) return refuse(`Leg ${legIndex} has not been completed.`);
    } else if (!lenient) {
      if (!this.taWindow) return refuse('Time Allowance requests are accepted only at a printed TA point (the yellow box after End timed portion).');
      if (this.tod > this.taWindow.endTod + 1e-6) return refuse(`The ${Math.round((this.taWindow.endTod - this.taWindow.startTod) / 60)}-minute window after the TA point has closed.`);
      if (!(legIndex > this.taWindow.legBase && legIndex <= this.taWindow.legBase + Math.max(0, this.taEligibleCount()))) return refuse(`Leg ${legIndex} is not one of the legs of the portion that just ended.`);
    } else if (legIndex < 1 || legIndex > nLegs) return refuse(`There is no leg ${legIndex}.`);
    if (form?.requestType === 'formal-problem') {
      // TAF-003: a Formal Problem Resolution Request (VI.A.2) asks no allowance: the contestant consents to 30 s added to the total stage score
      rec.requested = 0; rec.adjusted = 0; this.taRequests.push(rec); this.say('Scoring crew: Formal Problem Resolution Request received (30 s will be added to the stage score).', 'info'); this.log('ta.formal', { legIndex }); return;
    }
    if (!(seconds > 0) || (!lenient && seconds < 10)) return refuse('A request must be at least 0m10s.'); // ENG-011: never rounded up past the request
    if (seconds > this.sc.rules.taMaxRequestSeconds) return refuse(`A request may not exceed ${Math.floor(this.sc.rules.taMaxRequestSeconds / 60)}m${this.sc.rules.taMaxRequestSeconds % 60}s.`);
    if (fromLine > toLine || toLine > this.sc.book.length) return refuse('Name the instruction numbers on or between which the delay occurred.');
    if (!lenient && this.taRequests.some(r => r.legIndex === legIndex && r.status === 'filed' && r.requestType !== 'formal-problem')) return refuse(`Leg ${legIndex} already has a request on file: one request per leg.`); // ENG-011: a second request does not silently replace the first
    if (!lenient && seconds % 10 !== 0) {
      // V.H.6: adjusted up or down to a multiple of 0m10s, to the possible detriment of the contestant
      const lo = Math.floor(seconds / 10) * 10; const hi = lo + 10; const measured = this.taQualifying[legIndex] ?? 0;
      rec.adjusted = measured < (lo + hi) / 2 ? lo : hi;
      rec.adjustment = `${fmtMS(seconds)} adjusted to ${fmtMS(rec.adjusted)}`;
      this.say(`Scoring crew: ${rec.adjustment}`, 'info');
    }
    this.taDeclared[legIndex] = rec.adjusted;
    this.taRequests.push(rec);
    this.log('ta.request', { legIndex, seconds, adjusted: rec.adjusted, fromLine, toLine });
    this.log('ta.declare', { legIndex, seconds: rec.adjusted });
  }
  private taEligibleCount(): number { return this.taWindow ? this.taWindowLegs : 0; }
  private taWindowLegs = 0;
  taState(): TaState {
    const w = this.taWindow; const paper = this.sc.rules.taMode === 'paper'; const atRed = this.atRedCheckpoint();
    if (paper) {
      const legs = atRed ? Array.from({ length: Math.max(0, this.legIndex - 1) }, (_, i) => i + 1) : [];
      return { hasTaPoints: this.sc.book.some(i => i.taPoint), windowOpen: atRed, windowEndsTod: null, secondsLeft: null, endOfStage: false, eligibleLegs: legs, requests: this.taRequests.map(r => ({ ...r })), scorecardAcked: this.scorecardAcked, emergency: this.emergency !== null, mode: 'paper', atRedCheckpoint: atRed };
    }
    const open = !!w && this.tod <= w.endTod + 1e-6;
    const eligible = open ? Array.from({ length: this.taWindowLegs }, (_, i) => w!.legBase + 1 + i) : [];
    return {
      hasTaPoints: this.sc.book.some(i => i.taPoint), windowOpen: open, windowEndsTod: open ? w!.endTod : null, secondsLeft: open ? Math.max(0, w!.endTod - this.tod) : null, endOfStage: open ? w!.endOfStage : false,
      eligibleLegs: eligible, requests: this.taRequests.map(r => ({ ...r })), scorecardAcked: this.scorecardAcked, emergency: this.emergency !== null, mode: 'web', atRedCheckpoint: atRed,
    };
  }

  // ---------- V3: start / restart procedure (START-001/002) ----------
  private launchStateFor(line: number): { warned: boolean; warnTod: number | null; expectSaid: boolean; pulledUp: boolean; refused: number } {
    let st = this.launchStates.get(line);
    if (!st) { st = { warned: false, warnTod: null, expectSaid: false, pulledUp: false, refused: 0 }; this.launchStates.set(line, st); }
    return st;
  }
  /** The line of the start / restart the car is waiting for: line 1 before the start, a time-of-day restart while stopped at its line; otherwise null. */
  private launchLine(): Instruction | null {
    if (this.phase === 'preread') return this.sc.book[0] ?? null;
    if (this.phase === 'running' && this.waitingForGo && this.waitNodeId) {
      const ins = this.sc.book.find(i => i.nodeId === this.waitNodeId);
      if (ins && ins.section === 'restart' && ins.restartTime !== undefined) return ins;
    }
    return null;
  }
  /** ENG-021: the exact-transit OUT or promoted-stop line the car is waiting at (null elsewhere). */
  private holdLaunchLine(): Instruction | null {
    if (this.phase !== 'running' || !this.waitingForGo || !this.waitNodeId) return null;
    const node = this.sc.course.nodes.find(n => n.id === this.waitNodeId); if (!node) return null;
    const k = this.holdKind(node); if (k !== 'transitEnd' && k !== 'promoted') return null;
    return this.sc.book.find(i => i.nodeId === node.id) ?? null;
  }
  private launchSpeed(ins: Instruction): number {
    if (ins.speed !== undefined) return ins.speed;
    { const p = transitPaceMph(ins.transit); if (p !== null) return p; } // PLAY-009: the same speed the cockpit's launch plan uses
    const v = Math.round(fpsToMph(this.ghostSpeedAt(instructionS(this.sc.course, ins) + 1)));
    return v > 0 ? v : 30;
  }
  /** Chart (a) 0 -> v: the net seconds the car loses standing-start to the speed, against the ghost that is already at speed. */
  private netLossFor(mph: number): number {
    let v = this.netLossCache.get(mph);
    if (v === undefined) { v = accelLoss(mph, this.sc.car); this.netLossCache.set(mph, v); }
    return v;
  }
  /** START-001: own time, the standing-start net loss and the launch time (own time - net loss) of a start / restart line. */
  launchInfo(ins: Instruction | null = this.launchLine() ?? this.holdLaunchLine()): LaunchInfo | null {
    if (!ins) return null;
    // ENG-021: an exact-transit OUT or a promoted stop the car is waiting at launches like a restart: its out time minus the standing-start loss
    const holdNode = ins.restartTime === undefined && ins.n !== 1 ? this.sc.course.nodes.find(n => n.id === ins.nodeId) : undefined;
    const holdK = holdNode ? this.holdKind(holdNode) : null;
    if (holdNode && holdK !== 'transitEnd' && holdK !== 'promoted') return null;
    const holdOut = holdNode ? this.holdGoTod(holdNode) : null; if (holdNode && holdOut === null) return null;
    const ownTime = holdOut ?? ins.restartTime ?? this.sc.startTime; const speed = this.launchSpeed(ins);
    const raw = this.netLossFor(speed); const netLoss = Math.round(raw * 10) / 10;
    const launchTime = ownTime - (isMeasureRun(this.sc) ? 0 : Math.round(raw)); // PLAY-009: one rounding rule everywhere: launch on the whole second, own time minus the net loss rounded; PLAY-027: a measuring run leaves ON the second
    return { line: ins.n, kind: holdK === 'transitEnd' ? 'transitOut' : holdK === 'promoted' ? 'lunch' : ins.n === 1 ? 'start' : 'restart', ownTime, speed, netLoss, launchTime, secondsToLaunch: launchTime - this.tod, warned: this.launchStateFor(ins.n).warned };
  }
  /** The driver's expectation: "about 30 seconds" before we go. Said once when the navigator has not warned him within 45 s of the launch time. */
  private launchTick(): void {
    const li = this.launchInfo(); if (!li) return;
    const st = this.launchStateFor(li.line);
    if (this.sc.startProcedure === 'drill' && li.kind === 'start') return;
    // ENG-003: a request to the navigator (a question), so an agent's advance {untilEvent} wakes on it
    if (!st.expectSaid && !st.warned && this.tod >= li.launchTime - 45 && this.tod < li.launchTime) { st.expectSaid = true; this.say('Give me about 30 seconds before we go', 'question'); this.log('launch.expect', { line: li.line, launchTime: li.launchTime }); }
  }
  private queueFor(ins: Instruction): QueuedCar[] {
    const hit = this.queueCache.get(ins.n); if (hit) return hit;
    const own = ins.restartTime ?? this.sc.startTime; const asp = this.sc.asp; const r = rng(`${this.sc.seed}:v3:queue:${ins.n}`);
    const cars: QueuedCar[] = [];
    const nAhead = asp >= 1 ? Math.min(asp, r.int(1, 3)) : 0;
    for (let k = 1; k <= nAhead; k++) { const sits = k === 1 && r.chance(0.15); cars.push({ position: asp - k, relative: 'ahead', leavesTod: own - 60 * k + (sits ? r.int(12, 35) : r.int(0, 3)), atSign: false, sitting: sits }); }
    const nBehind = r.int(1, 3);
    for (let k = 1; k <= nBehind; k++) cars.push({ position: asp + k, relative: 'behind', leavesTod: own + 60 * k + r.int(0, 3), atSign: true, sitting: false });
    this.queueCache.set(ins.n, cars);
    return cars;
  }
  /** START-001: the cars queued at the sign around our position (seeded ghosts); `carAheadAtSign` stays true until the car one minute ahead has left. */
  startQueue(ins: Instruction): StartQueue {
    const cars = this.queueFor(ins).map(c => ({ ...c, atSign: this.tod < c.leavesTod }));
    const a = cars.find(c => c.relative === 'ahead' && c.position === this.sc.asp - 1);
    return { cars, carAheadAtSign: !!a && a.atSign, carAheadLeavesTod: a?.leavesTod ?? null, pulledUp: this.launchStateFor(ins.n).pulledUp };
  }
  /** INST-002: a departure one minute (50-70 s) off its time is the one-minute mistake. Returns true when it is. */
  private checkOneMinute(line: number, target: number, actual: number, what: string, arrival?: number): boolean {
    const d = actual - target;
    if (Math.abs(d) < 50 || Math.abs(d) > 70) return false;
    if (d > 0 && arrival !== undefined && arrival >= target - 2) return false; // ENG-005: the car was not there yet; a late arrival is not a misread minute
    this.debriefFindings.push({ kind: 'oneMinuteMistake', line, seconds: Math.round(d), text: `${what} (line ${line}) left ${Math.abs(Math.round(d))} s ${d > 0 ? 'late' : 'early'}: the minute was misread. The dash clock's minute hand is loose within ${this.sc.rules.clockMinuteSlop ?? 5} s of the minute change: take the time of day from the stopwatch's TOD mode and the seconds from the clock's second hand.` });
    this.log('oneMinuteMistake', { line, seconds: Math.round(d) });
    return true;
  }
  /** `arrival` = when the car reached a restart line (ENG-005); `auto` = the simulator launched the car itself (PLAY-005): only discretionary departures get a finding. */
  private recordStartDelta(ins: Instruction, actual: number, arrival?: number, auto?: 'drill' | 'late'): void {
    if (this.startDeltas.some(d => d.line === ins.n)) return;
    const li = this.launchInfo(ins)!; const st = this.launchStateFor(ins.n);
    const delta = Math.round((actual - li.launchTime) * 10) / 10;
    const arrivedLate = arrival !== undefined && arrival >= li.launchTime - 2;
    this.startDeltas.push({ line: ins.n, kind: li.kind as "start" | "restart", ownTime: li.ownTime, netLoss: li.netLoss, launchTime: li.launchTime, actual, delta, warned: st.warned, pulledUp: st.pulledUp, refusedPullUps: st.refused, ...(arrivedLate ? { arrivedLate } : {}), ...(auto ? { auto } : {}) });
    if (auto) return;
    const what = li.kind === 'start' ? 'Start' : 'Restart';
    // PLAY-005: leaving the pre-read early without running the launch procedure (no "about 30 seconds") is an early departure by choice, not a misread minute
    const fromPreread = li.kind === 'start' && !st.warned;
    if (!(fromPreread && delta < 0) && this.checkOneMinute(ins.n, li.ownTime, actual, what, arrival)) return;
    if (delta > 2 && !arrivedLate) this.debriefFindings.push({ kind: 'lateLaunch', line: ins.n, seconds: delta, text: `${what} (line ${ins.n}) left ${delta.toFixed(1)} s after the launch time: launch = own time minus the standing-start net loss (${li.netLoss.toFixed(1)} s).` });
    else if (delta < -3) this.debriefFindings.push({ kind: 'earlyLaunch', line: ins.n, seconds: delta, text: fromPreread ? (this.sc.startProcedure === 'drill' ? `${what} (line ${ins.n}): you departed from the pre-read ${(-delta).toFixed(1)} s before your launch time. In a drill the car launches itself on the printed second: wait for it, or fast-forward to the launch.` : `${what} (line ${ins.n}): you departed from the pre-read ${(-delta).toFixed(1)} s before your launch time. Wait for your minute: give the driver "about 30 seconds" and count down so GO lands on the launch second.`) : `${what} (line ${ins.n}) left ${(-delta).toFixed(1)} s before the launch time: lead the car by its net loss (${li.netLoss.toFixed(1)} s) only.` });
  }
  private allStartDeltas(): StartDelta[] {
    const out = [...this.startDeltas];
    for (const ins of this.sc.book) {
      if (!(ins.n === 1 || (ins.section === 'restart' && ins.restartTime !== undefined)) || out.some(d => d.line === ins.n)) continue;
      const li = this.launchInfo(ins)!; const st = this.launchStateFor(ins.n);
      out.push({ line: ins.n, kind: li.kind as "start" | "restart", ownTime: li.ownTime, netLoss: li.netLoss, launchTime: li.launchTime, actual: null, delta: null, warned: st.warned, pulledUp: st.pulledUp, refusedPullUps: st.refused });
    }
    return out.sort((a, b) => a.line - b.line);
  }

  // ---------- V3: pace cars (START-002) ----------
  /** Seeded, smooth error (s) of the pace car against its own minute: a constant offset plus two slow wobbles. Pure function of time. */
  private paceErr(kind: 'ahead' | 'behind', t: number): number {
    if (!this.paceParams) {
      const r = rng(`${this.sc.seed}:v3:pace`);
      const mk = (): { c: number; a1: number; p1: number; f1: number; a2: number; p2: number; f2: number } => ({ c: (r.next() * 2 - 1) * 3, a1: 0.8 + r.next() * 1.2, p1: 600 + r.next() * 400, f1: r.next() * 6.283, a2: 0.5 + r.next() * 1.0, p2: 1200 + r.next() * 1200, f2: r.next() * 6.283 });   // within +-6 s, drifting at under 2 % of the speed
      this.paceParams = { ahead: mk(), behind: mk() };
    }
    const q = this.paceParams[kind];
    return q.c + q.a1 * Math.sin(2 * Math.PI * t / q.p1 + q.f1) + q.a2 * Math.sin(2 * Math.PI * t / q.p2 + q.f2);
  }
  /** Course position (ft) the ghost has reached at ghost time t (the inverse of ghostTimeAt; stays on a pause). */
  private ghostPosAt(t: number): number {
    const bps = this.ghost.breakpoints; if (!bps.length || t <= bps[0]!.t) return 0;
    let lo = 0, hi = bps.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bps[mid]!.t <= t) lo = mid; else hi = mid - 1; }
    const bp = bps[lo]!; const nxt = bps[lo + 1];
    let sPos = bp.v > 0 ? bp.s + (t - bp.t) * bp.v : bp.s;
    sPos = nxt ? Math.min(sPos, nxt.s) : Math.min(sPos, this.sc.course.lengthFt);
    return sPos;
  }
  private occasionalVisible(): boolean {
    const block = Math.floor(this.tod / 45);
    if (this.occasional.block !== block) this.occasional = { block, visible: rng(`${this.sc.seed}:v3:occ:${block}`).next() < 0.3 };
    return this.occasional.visible;
  }
  /** START-002: the cars one minute ahead (position asp - 1) and behind (asp + 1), with their seeded errors. Only with an assigned starting position of 1 or more. */
  private paceCarsNow(): { ahead: PaceCarView | null; behind: PaceCarView | null; aheadVisible: boolean; behindVisible: boolean } {
    const none = { ahead: null, behind: null, aheadVisible: false, behindVisible: false };
    if (!(this.sc.asp >= 1) || this.phase !== 'running' || this.off) return none; // ENG-008: a scenario without a numeric asp has no pace cars
    const sSelf = this.car.s; const SIGHT = 5280; const r1 = (x: number): number => Math.round(x * 10) / 10;
    const eA = this.paceErr('ahead', this.tod), eB = this.paceErr('behind', this.tod);
    const dA = this.ghostPosAt(this.tod + 60 - eA) - sSelf, dB = sSelf - this.ghostPosAt(this.tod - 60 - eB);
    const vis = this.sc.aids.rung >= 1 ? true : this.occasionalVisible();
    return {
      ahead: dA > 0 ? { offsetSeconds: -60, position: this.sc.asp - 1, distanceFt: dA, errorSeconds: r1(eA) } : null,
      behind: dB > 0 ? { offsetSeconds: 60, position: this.sc.asp + 1, distanceFt: dB, errorSeconds: r1(eB) } : null,
      aheadVisible: dA > 0 && dA <= SIGHT && vis, behindVisible: dB > 0 && dB <= SIGHT && vis,
    };
  }
  /** CAL-006: the car is between the calibration run's first and last calibration points. */
  private calRange: { lo: number; hi: number } | null | undefined;
  private inCalibrationRun(): boolean {
    if (this.phase !== 'running') return false;
    if (this.calRange === undefined) {
      const cal = this.sc.book.filter(i => i.section === 'calibration');
      this.calRange = cal.length ? { lo: instructionS(this.sc.course, cal.find(i => i.calibrationStart) ?? cal[0]!), hi: instructionS(this.sc.course, cal[cal.length - 1]!) } : null;
    }
    return !!this.calRange && !this.off && this.car.s >= this.calRange.lo && this.car.s <= this.calRange.hi;
  }

  // ---------- V3: make-up (MAKEUP-001) ----------
  /** A called speed >= 8 % (and >= 3 mph) above the assigned speed in force is a make-up in progress; calling a normal speed again ends it. */
  private noteMakeUp(indicated: number): void {
    if (this.phase !== 'running' || this.inTransit || this.emergency || this.off) return;
    const here = this.routeS(); const assigned = fpsToMph(this.ghostSpeedAt(here));
    let ref = assigned;
    { const bps = this.ghost.breakpoints; for (const bp of bps) { if (bp.s > here) { if (bp.s - here <= 1500) ref = Math.max(ref, fpsToMph(bp.v)); break; } } } // a lead call for the speed about to take effect is no make-up
    const trueMph = this.speedo.inverse(indicated);
    if (assigned >= 10 && ref > 0 && trueMph >= ref + 0.9) this.log('call.over', { mph: Math.round(trueMph * 10) / 10, ref: Math.round(ref) });   // ENG-022: any call above the assigned speed is a recovery attempt (the D08/D18 gates)
    if (assigned >= 10 && ref > 0 && trueMph >= ref * 1.08 && trueMph - ref >= 3) { this.makeUp = { pct: Math.round((trueMph / ref - 1) * 1000) / 10, assigned: Math.round(assigned), calledMph: indicated, sinceTod: this.tod }; this.log('makeUp.begin', { pct: this.makeUp.pct, assigned: this.makeUp.assigned }); }
    else if (this.makeUp) { this.log('makeUp.end', {}); this.makeUp = null; }
  }
  /** At a line that changes the assigned speed the "+%" falls away: a navigator who has not called the new speed gets the new assigned speed (and re-applies the make-up after, MAKEUP-001). */
  private dropMakeUpAt(ins: Instruction): void {
    const mu = this.makeUp; if (!mu) return;
    const nv = ins.timed ? ins.timed.holdSpeed : ins.speed;
    if (nv === undefined || nv === mu.assigned) return;
    if (this.targetIndicated !== mu.calledMph) { this.makeUp = null; this.log('makeUp.end', { line: ins.n }); return; }
    const mph = this.useCard && this.card[String(nv)] !== undefined ? this.card[String(nv)]! : nv;
    const from = this.targetIndicated;
    this.targetIndicated = mph; this.announceAtSpeed = true;
    this.say(`Assigned speed is ${nv} now: dropping the extra`, 'info'); this.log('makeUp.dropped', { line: ins.n, from, to: mph });
    this.makeUp = null; this.makeUpDrops++; this.beginRamp();
  }
  private lineOfNodeId(id: string | null): number | undefined { return id ? this.sc.book.find(i => i.nodeId === id)?.n : undefined; }

  // ---------- V3: per-tick extras ----------
  private v3Tick(dt: number): void {
    if (this.phase !== 'running') return;
    if (this.waitingForGo) this.launchTick();
    // PLAY-010: the driver speaks up once when a slow vehicle holds him under the called speed
    { const sl = this.activeSlowHazard();
      if (sl && sl.kind === 'slow' && !this.slowSaid.has(sl.s) && !this.passRequested && this.targetIndicated !== null && this.targetIndicated > sl.speedMph + 3 && this.car.mph() <= sl.speedMph + 1) {
        this.slowSaid.add(sl.s); this.say(`Stuck behind a slow vehicle at about ${sl.speedMph}: call pass (P) when it is clear, or time the loss and make it up`, 'question'); this.log('slow.stuck', { mph: sl.speedMph });
      } }
    // PLAY-002: still no speed called: ask again every 30 s while the car sits
    if (this.targetIndicated === null && !this.waitingForGo && !this.off && this.car.v === 0 && this.tod - this.speedAskTod >= 30) this.askSpeed(this.transitLineHere());
    // PROTO-001: an unprompted read-back every 2-4 minutes while rolling ("holding 35")
    if (this.nextHoldingTod !== null && this.tod >= this.nextHoldingTod) {
      if (this.targetIndicated !== null && !this.waitingForGo && !this.off && this.car.v > mphToFps(1)) this.say(`Holding ${this.targetIndicated}`, 'readback');
      this.nextHoldingTod = this.tod + 120 + this.protoRng.next() * 120;
    }
    // TAF-002: a school bus stopped in the lane: the stop is stopped time + the chart loss (qualifying)
    const blk = this.blockerAhead();
    if (blk && this.car.v < mphToFps(0.2) && !this.blockEp) { this.blockEp = { leg: this.legIndex, t0: this.tod, line: this.lastCrossedLine ?? this.currentLine, mph: Math.round(fpsToMph(this.ghostSpeedAt(this.routeS()))) }; this.say('School bus stopped with its red lights on: waiting behind it', 'info'); }
    if (!blk && this.blockEp) {
      const e = this.blockEp; this.blockEp = null; const stopped = this.tod - e.t0;
      this.taStops.push({ leg: e.leg, stopped, vIn: e.mph, vOut: e.mph }); this.taCause[e.leg] = 'schoolBus';
      this.addQualifying(stopped + stopLoss(e.mph, e.mph, this.sc.car), true, e.line); this.say('The bus is moving, going', 'info');
    }
    // MAKEUP-001: making up inside a stopwatch-timed interval disturbs it
    const tw = this.timedWatch;
    if (tw && !tw.flagged && this.timedChange && this.makeUp) {
      const gt = this.timedChangeGhostTod();
      if (gt !== null && this.tod > tw.startTod + 4 && this.tod < gt - 3 && !this.waitingForGo && this.car.mph() > tw.holdSpeed * 1.03 + 0.3) {
        tw.over += dt;
        if (tw.over >= 3) { tw.flagged = true; this.debriefFindings.push({ kind: 'timedIntervalDisturbed', line: tw.line, text: `Timed interval at line ${tw.line} disturbed: the car ran above the assigned ${tw.holdSpeed} mph while the stopwatch interval was running. Never make up time inside a timed interval; make it up before or after.` }); this.log('timedIntervalDisturbed', { line: tw.line }); }
      }
    }
    // START-002: closing rate on the car ahead, once a second
    if (this.tick % 10 === 0) {
      const pc = this.paceCarsNow();
      if (pc.ahead) {
        this.gapHistory.push({ tod: this.tod, gap: pc.ahead.distanceFt }); while (this.gapHistory.length && this.tod - this.gapHistory[0]!.tod > 14) this.gapHistory.shift();
        const old = [...this.gapHistory].reverse().find(h => this.tod - h.tod >= 8);
        this.gainingNow = !!old && old.gap - pc.ahead.distanceFt > 16;
      } else { this.gapHistory = []; this.gainingNow = false; }
    }
    // PROTO-001 rung >= 2: the next call the navigator is expected to make, once per line, 700 ft out
    if (this.sc.aids.rung >= 2) {
      const book = this.sc.book;
      while (this.nextInsPtr < book.length && (this.executed.has(book[this.nextInsPtr]!.n) || book[this.nextInsPtr]!.omitted)) this.nextInsPtr++;
      const ins = book[this.nextInsPtr];
      if (this.nextCallNow && this.nextCallNow.line < (ins?.n ?? Infinity)) this.nextCallNow = null;
      // PLAY-008: a prompt whose call has been made goes away (never "call the left" while the left is pending)
      if (this.nextCallNow) { const c = this.nextCallNow.call; const m = /^call\.(turn|speed) (\S+)$/.exec(c);
        if (m && m[1] === 'turn' && this.pendingTurn === m[2]) this.nextCallNow = null;
        else if (m && m[1] === 'speed' && !this.sc.book[this.nextCallNow.line - 1]?.timed && this.targetIndicated !== null && (Math.abs(this.targetIndicated - Number(m[2])) < 0.01 || this.targetIndicated === this.card[m[2]!])) this.nextCallNow = null;
        else if (c === 'call.stop' && this.holdRequested) this.nextCallNow = null; }
      if (ins && this.nextCallLine !== ins.n) {
        const d = instructionS(this.sc.course, ins) - this.car.s;
        if (d <= 700 && d > -30) { this.nextCallLine = ins.n; const nc = this.expectedCall(ins); if (nc) { this.nextCallNow = nc; this.log('nextCall', { ...nc }); } }
      }
    }
  }
  private expectedCall(ins: Instruction): NextCall | null {
    const n = ins.n; const cur = Math.round(fpsToMph(this.ghostSpeedAt(this.routeS())));
    if (ins.section === 'finish') return { line: n, call: 'call.stop', text: `Next: line ${n} is the finish, call stop` };
    if ((ins.section === 'restart' && ins.restartTime !== undefined) || (ins.transit?.end && ins.transit.exact) || ins.promotedStop) return { line: n, call: 'call.go', text: `Next: line ${n} holds the car, count down and say go on the second` };
    if (ins.turn && ins.turn !== 'S') return { line: n, call: `call.turn ${ins.turn}`, text: `Next: call the ${turnWord(ins.turn).toLowerCase()} at line ${n}` };
    if (ins.pause) return { line: n, call: 'call.go', text: `Next: line ${n} is a stop with a ${ins.pause} s pause: count the chart pause time, then go` };
    if (ins.timed) return { line: n, call: `call.speed ${ins.timed.holdSpeed}`, text: `Next: line ${n} starts a timed segment, ${ins.timed.holdSpeed} for ${ins.timed.seconds} s, then ${ins.timed.thenSpeed}` };
    if (ins.speed !== undefined && ins.speed !== cur) return { line: n, call: `call.speed ${ins.speed}`, text: `Next: call ${ins.speed} at line ${n}` };
    return null;
  }

  /** Handle node crossings and checkpoints along the route. */
  private routeStep(sBefore: number): void {
    const s = this.car.s;
    // stop bookkeeping: entering braking zone for a stop node
    const node = this.nextNode();
    if (node && !this.curStop && this.car.mode === 'stopping' && this.mustStopAt(node) && !this.releasedNodeId && !this.isHoldNode(node) && node.kind !== 'finish') {
      const ins = this.sc.book.find(i => i.nodeId === node.id);
      this.curStop = { nodeId: node.id, line: ins?.n ?? null, pause: ins?.pause ?? 0, startTod: this.tod, dwellStart: null, dwell: 0, goCalledAt: null, vIn: Math.round(this.car.mph()), vOut: ins?.timed ? ins.timed.holdSpeed : ins?.speed ?? Math.round(this.car.mph()), turn: ins?.turn ?? null };
      this.stopBucketAtStopStart = this.buckets.stop;
      this.log('stop.begin', { nodeId: node.id });
    }
    // checkpoints
    for (; this.nextCpIdx < this.sc.checkpoints.length; ) {
      const cp = this.sc.checkpoints[this.nextCpIdx]!;
      if (s >= cp.s - cp.sightDistance && sBefore < cp.s && cp.kind === 'timing') {
        if (this.car.v <= mphToFps(5)) { const rec = this.ensureRecord(cp); if (!rec.sightViolation) { rec.sightViolation = true; this.log('sightZoneViolation', { cpId: cp.id }); } }
      }
      if (s >= cp.s && sBefore < cp.s) { const frac = s > sBefore ? (cp.s - sBefore) / (s - sBefore) : 1; this.crossCheckpoint(cp, this.tod - TICK * (1 - frac)); this.nextCpIdx++; continue; }
      break;
    }
    // observation stop check
    const obs = this.records.find(r => r.kind === 'observation' && r.stopped === false);
    if (obs) { const cp = this.sc.checkpoints.find(c => c.id === obs.cpId)!; if (this.car.v === 0 && s - cp.s <= 200) { obs.stopped = true; this.log('observation.stopped'); } }
    // nodes
    while (this.nextNodeIdx < this.sc.course.nodes.length) {
      const n = this.sc.course.nodes[this.nextNodeIdx]!;
      if (s < n.s) break;
      if (this.mustStopAt(n) || (this.waitingForGo && this.waitNodeId === n.id)) break;
      { const frac = s > sBefore ? Math.min(1, Math.max(0, (n.s - sBefore) / (s - sBefore))) : 1; this.nodeCrossTod = this.tod - TICK * (1 - frac); }
      this.crossNode(n);
      this.nextNodeIdx++;
      if (this.off) break;
    }
    // speed-ramp end after a stop: when back up to target (or well past the node), close the stop record
    if (this.curStop && this.curStop.dwellStart !== null && !this.waitingForGo && this.car.v > 0 && this.targetIndicated !== null) {
      const atSpeed = Math.abs(this.car.v - mphToFps(this.speedo.inverse(this.targetIndicated))) < mphToFps(0.5);
      const stopNode = this.sc.course.nodes.find(x => x.id === this.curStop!.nodeId);
      if (atSpeed || (stopNode && this.car.s > stopNode.s + 2500)) this.closeStop();
    }
    if (this.releasedNodeId) { const rn = this.sc.course.nodes.find(x => x.id === this.releasedNodeId); if (rn && s > rn.s + 5) this.releasedNodeId = null; }
    // timed change due?
    if (this.timedChange && this.tod >= this.timedChange.atTod + 60) this.timedChange = null;
    this.processCheckoffs();
  }

  /** GRIID-006: an instruction is complete when its last speed change has been made (the car has settled at the speed the navigator called), or at the node when it has none. */
  private processCheckoffs(): void {
    while (this.checkoffs.length) {
      const c = this.checkoffs[0]!; const ins = c.ins;
      let ready = true;
      if (c.afterS !== null && this.car.s < c.afterS) ready = false;
      else if (ins.speed !== undefined || ins.timed || ins.pause) {
        // the last speed change is made once the car has settled at the speed the navigator called for the book's final speed
        const final = ins.timed ? ins.timed.thenSpeed : ins.speed;
        const called = final === undefined || this.targetIndicated === final || (this.card[String(final)] !== undefined && this.targetIndicated === this.card[String(final)]);
        ready = called && !this.waitingForGo && !this.off && this.car.v > 0 && this.targetIndicated !== null && Math.abs(this.car.v - mphToFps(this.speedo.inverse(this.targetIndicated))) < mphToFps(0.5);
      }
      if (!ready && this.tod - c.crossTod > (c.afterS !== null ? 150 : 90)) ready = true;
      if (!ready) break;
      this.checkoffs.shift();
      this.lastExecutedLine = c.n;
      if (this.sc.aids.checkOff) { if (c.what) this.say(`Did ${c.what}, line ${c.n}`, 'info'); else this.say(`Straight on past line ${c.n}, you did not call a turn`, 'question'); }
    }
  }

  private closeStop(): void {
    if (!this.curStop) return;
    const cost = this.buckets.stop; // bucket since leg start; approximate per-stop by delta
    const goDwell = this.curStop.goCalledAt !== null && this.curStop.dwellStart !== null ? Math.max(0, this.curStop.goCalledAt - this.curStop.dwellStart) : this.curStop.dwell;
    this.legStops.push({ nodeId: this.curStop.nodeId, line: this.curStop.line, pause: this.curStop.pause, actualCost: cost - this.stopBucketAtStopStart, dwell: this.curStop.dwell, goDwell, trafficWait: Math.max(0, this.curStop.dwell - goDwell), vIn: this.curStop.vIn, vOut: this.curStop.vOut, turn: this.curStop.turn });
    this.log('stop.end', { nodeId: this.curStop.nodeId, dwell: this.curStop.dwell });
    this.curStop = null;
  }
  private stopBucketAtStopStart = 0;

  private ensureRecord(cp: Checkpoint): CheckpointRecord {
    let rec = this.records.find(r => r.cpId === cp.id);
    if (!rec) { rec = { cpId: cp.id, kind: cp.kind, actualTod: null, rawTod: null, sightViolation: false, stopped: cp.kind === 'observation' ? false : undefined }; this.records.push(rec); }
    return rec;
  }

  private crossCheckpoint(cp: Checkpoint, crossTod: number): void {
    const rec = this.ensureRecord(cp);
    rec.rawTod = crossTod; rec.actualTod = roundToSecond(crossTod);
    this.log('checkpoint', { cpId: cp.id, kind: cp.kind, actualTod: rec.actualTod, pace: this.pace() });
    if (cp.kind === 'timing') {
      this.closeQualEpisode();
      this.lastCpTod = this.tod;
      this.attribution.push(this.currentAttribution());
      this.buckets = this.emptyBuckets(); this.cruiseDt = 0; this.cruiseDs = 0; this.cruiseGhostDs = 0; this.legStops = [];
      this.legIndex++;
      this.legAnchorActual = rec.actualTod!;
      this.legAnchorGhost = ghostTimeAt(this.ghost, cp.s);
    }
  }

  private currentAttribution(): LegAttribution {
    return { legIndex: this.legIndex, buckets: { ...this.buckets }, cruiseSeconds: this.cruiseDt, meanSpeedRatio: this.cruiseGhostDs > 0 ? this.cruiseDs / this.cruiseGhostDs : 1, stops: [...this.legStops] };
  }

  private crossNode(n: Node): void {
    this.log('node', { nodeId: n.id, kind: n.kind, control: n.control });
    if (n.kind !== 'start') this.log('passed', { what: n.sign ? n.sign.text : n.label ?? (n.control !== 'none' ? n.control : n.kind) });
    const ins = this.sc.book.find(i => i.nodeId === n.id);
    // PROTO-001: the driver says "mark" at the sign / landmark the navigator identified
    if (this.identified && n.kind !== 'start' && (n.sign || n.label || n.kind === 'landmark' || n.kind === 'sign')) { if (this.tod - this.identified.tod <= 180) { this.say('Mark', 'readback'); this.log('mark', { nodeId: n.id, identified: this.identified.text }); } this.identified = null; }
    if (ins) this.dropMakeUpAt(ins);
    if (ins) {
      this.executed.add(ins.n); this.lastCrossedLine = ins.n;
      if (this.sc.aids.autoAdvanceLine) this.currentLine = Math.min(this.sc.book.length, ins.n + 1);
      if (ins.pause) { this.buckets.stop -= ins.pause; if (!this.curStop) { /* pause without a stop node: still credited to stop bucket */ } }
      if (ins.transit && !ins.transit.end) this.inTransit = true;
      if (ins.transit?.end || (ins.restartTime !== undefined && ins.section === 'restart')) this.inTransit = false;
      if (ins.transit && !ins.transit.end && ins.transit.exact === true) { this.transitIn[ins.n] = roundToSecond(this.nodeCrossTod); this.log('transit.in', { n: ins.n, tod: this.transitIn[ins.n] }); this.pendingInChecks.push({ tod: this.nodeCrossTod, line: ins.n, todMode: this.watch.kind === 'digital' && this.watch.mode === 'tod' }); }
      if (ins.timed) { const st = ins.pause ? this.stoppedTod.get(ins.n) : undefined;
        // PLAY-030: on a STOP + timed line the count starts when the ghost leaves = "Stopped" + the pause - the braking part of the stop loss (the card's anchor); a lap at "Stopped" counts too
        if (st !== undefined) { const brake = this.brakeShare(ins); this.anchors.push({ tod: st + ins.pause! - brake, line: ins.n, kind: 'timed', alt: st }); }
        else this.anchors.push({ tod: this.nodeCrossTod, line: ins.n, kind: 'timed' }); }
      if (ins.section === 'calibration') this.anchors.push({ tod: this.nodeCrossTod, line: ins.n, kind: 'calibration' });
      if (ins.restartTime !== undefined && ins.section === 'restart') {
        const early = ins.restartTime - this.tod; // tod here = departure from the restart line
        this.restartMinutesEarly = Math.max(this.restartMinutesEarly, early / 60);
        this.buckets = this.emptyBuckets(); this.legStops = []; this.cruiseDt = 0; this.cruiseDs = 0; this.cruiseGhostDs = 0; // transit into the restart is unscored
        this.legAnchorActual = ins.restartTime; this.legAnchorGhost = ins.restartTime;
        this.officialAnchorActual = ins.restartTime; this.anchorShift = 0;
        this.log('restart', { early });
      } else if (ins.transit?.end && ins.transit.exact) {
        const out = this.transitOutFor(ins);
        if (out !== null) {
          // STAGE-003: leaving early or late shifts the next leg by that amount; the leg clock is anchored at the OUT time
          const gAt = ghostTimeAt(this.ghost, instructionS(this.sc.course, ins));
          this.buckets = this.emptyBuckets(); this.legStops = []; this.cruiseDt = 0; this.cruiseDs = 0; this.cruiseGhostDs = 0;
          this.legAnchorActual = out; this.legAnchorGhost = gAt; this.officialAnchorActual = out; this.anchorShift = out - gAt;
          this.log('transit.out', { out, early: out - this.tod });
        }
      }
      if (ins.taPoint) {
        this.taWindowLegs = Math.max(0, this.legIndex - 1 - this.taLegBase);
        this.taWindow = { startTod: this.tod, endTod: this.tod + ins.taPoint.windowSeconds, endOfStage: ins.taPoint.endOfStage, insN: ins.n, legBase: this.taLegBase };
        this.taLegBase = this.legIndex - 1;
        this.log('ta.point', { n: ins.n, windowSeconds: ins.taPoint.windowSeconds, endOfStage: ins.taPoint.endOfStage });
        this.say(ins.taPoint.endOfStage ? 'TA point: file any Time Allowance request now, and acknowledge the scorecard' : 'TA point: file any Time Allowance request now', 'info');
      }
      if (ins.timed) { const atS = instructionS(this.sc.course, ins) + mphToFps(ins.timed.holdSpeed) * ins.timed.seconds; this.timedChange = { atS, atTod: this.tod + ins.timed.seconds, nodeId: n.id, line: ins.n }; this.timedWatch = { line: ins.n, holdSpeed: ins.timed.holdSpeed, startTod: this.tod, over: 0, flagged: false }; }
      else if (ins.speed !== undefined || ins.pause || ins.turn) { this.timedChange = null; this.timedWatch = null; } // a later speed/pause/turn line ends any earlier timed segment
    }
    let offRoute = false; let turnCalledHere = false;
    if (n.kind === 'intersection' && n.exits && n.exits.length) {
      const chosen = this.chooseExit(n); turnCalledHere = this.turnConsumed; this.turnConsumed = false;
      const angle = Math.abs(chosen.angle);
      let taken = chosen;
      if (angle >= 20) {
        const cap = angle > 120 ? this.sc.car.turnSpeedMph.acute : angle >= 60 ? this.sc.car.turnSpeedMph.turn : this.sc.car.turnSpeedMph.bear;
        const capFps = mphToFps(cap);
        // ENG-024: a turn called in time (at the call there was room to brake to the turn speed, plus a second to react) is made, even from 50-55 mph:
        // the driver arrives a little fast (an apex of 20-25 mph) and scrubs it in the turn. Only a call too late to brake for is "too late".
        const arm = this.turnArm; const armDist = arm ? n.s - arm.s : -1;
        const inTime = !!arm && turnCalledHere && armDist >= Math.max(0, (arm.v * arm.v - capFps * capFps) / (2 * this.car.aDec())) + arm.v * 1.0;
        if (this.car.v > capFps * 1.6 && angle >= 60 && !inTime) {
          // Called too late: the driver cannot slow enough and misses the turn (straight-as-possible instead). Teaches "call turns early".
          this.say(`Too late, I can't make that ${turnWord(this.pendingTurn ?? 'L').toLowerCase()} at this speed`, 'question');
          this.log('turnMissed', { nodeId: n.id, speedMph: Math.round(this.car.mph()), angle: chosen.angle });
          const roads = n.exits!.filter(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private');
          taken = roads.slice().sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0] ?? chosen;
          if (Math.abs(taken.angle) >= 60) { this.turnCap = capFps; this.turnZoneEndS = n.s + turnZoneOf(this.sc.car); if (this.car.v > capFps * 1.3) this.car.v = capFps * 1.3; } // a T: he still has to turn somewhere, hard braking
        } else {
          this.turnCap = capFps; this.turnZoneEndS = n.s + turnZoneOf(this.sc.car);
          if (this.car.v > this.turnCap * 1.3) this.car.v = this.turnCap * 1.3; // slightly late: scrub off the rest in the turn
        }
      }
      if (!taken.isRoute) this.goOffCourse(n, taken);
      offRoute = !taken.isRoute;
    }
    // Driver check-off (aid, GRIID-006): fires when the instruction is COMPLETE (its last speed change made), not at the node; says what he actually did.
    if (ins && ins.section !== 'start' && !offRoute) {
      const what = ins.turn && ins.turn !== 'S' ? (turnCalledHere ? 'the turn' : null) : ins.pause ? 'the stop' : 'that one';
      const atS = ins.timed ? instructionS(this.sc.course, ins) + mphToFps(ins.timed.holdSpeed) * ins.timed.seconds : null;
      this.checkoffs.push({ n: ins.n, what, ins, crossTod: this.tod, afterS: atS });
    }
    if (n.control === 'YIELD' || n.control === 'BLINKER') { const cap = mphToFps(n.control === 'YIELD' ? 10 : 20); if (this.car.s >= this.turnZoneEndS || cap < this.turnCap) { this.turnCap = this.car.s < this.turnZoneEndS ? Math.min(cap, this.turnCap) : cap; this.turnZoneEndS = Math.max(this.turnZoneEndS, n.s + 40); if (this.car.v > this.turnCap) this.car.v = this.turnCap; } }
    if (n.kind === 'finish' && this.waitReason !== 'finish') { /* finish banner: course ends at lengthFt */ }
  }

  /** Which exit the driver would take right now (no side effects). */
  peekExit(n: Node): Exit {
    const exits = n.exits!;
    const roads = exits.filter(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private');
    if (this.pendingTurn) {
      const band = bandFor(this.pendingTurn);
      const cands = roads.filter(e => e.angle >= band[0] && e.angle <= band[1]).sort((a, b) => Math.abs(a.angle - band[2]) - Math.abs(b.angle - band[2]));
      if (cands.length) return cands[0]!;
    }
    const pool = this.mainRoadRule === 'pavement-first' && roads.some(e => e.surface === 'paved') ? roads.filter(e => e.surface === 'paved') : roads;
    return (pool.length ? pool : exits).slice().sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0]!;
  }

  private chooseExit(n: Node): Exit {
    const exits = n.exits!;
    const roads = exits.filter(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private');
    if (this.pendingTurn) {
      const dir = this.pendingTurn;
      const band = bandFor(dir);
      const cands = roads.filter(e => e.angle >= band[0] && e.angle <= band[1]).sort((a, b) => Math.abs(a.angle - band[2]) - Math.abs(b.angle - band[2]));
      if (cands.length) { this.pendingTurn = null; this.turnConsumed = true; this.log('turn', { dir, angle: cands[0]!.angle, route: cands[0]!.isRoute }); return cands[0]!; }
      if (dir === 'S' || dir === 'JL' || dir === 'JR') this.pendingTurn = null;
      else this.say(`No ${turnWord(dir).toLowerCase()} here, staying on`, 'question');
    }
    // straight as possible / main road
    const pool = this.mainRoadRule === 'pavement-first' && roads.some(e => e.surface === 'paved') ? roads.filter(e => e.surface === 'paved') : roads;
    const main = (pool.length ? pool : exits).slice().sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0]!;
    this.log('mainRoad', { angle: main.angle, route: main.isRoute });
    return main;
  }

  private goOffCourse(n: Node, exit: Exit): void {
    this.offCourseCount++;
    this.off = { nodeId: n.id, nodeS: n.s, branchDist: 0, phase: 'out', turnTimer: 0, exitKind: exit.kind };
    this.releasedNodeId = null;
    this.log('offCourse', { nodeId: n.id, angle: exit.angle, kind: exit.kind });
  }

  private offCourseDrive(dt: number, targetTrue: number): void {
    const off = this.off!;
    if (off.phase === 'turning') { this.car.step(dt, 0, this.car.s); this.car.v = 0; return; }
    const roadEnd = off.phase === 'out' && off.branchDist >= this.sc.excursionFt! - 1;
    if (roadEnd) {
      if (!this.waitingForGo) { this.waitingForGo = true; this.waitReason = 'roadEnd'; this.waitStartTod = this.tod; this.say('Road ends here. Dead end!', 'question'); }
      this.car.step(dt, 0, this.car.s); return;
    }
    this.car.step(dt, Math.min(targetTrue, mphToFps(35)), null);
  }

  private offCourseStep(dt: number, sBefore: number): void {
    const off = this.off!; const ds = this.car.s - sBefore;
    if (off.phase === 'out') off.branchDist += ds;
    else if (off.phase === 'back') {
      off.branchDist -= ds;
      if (off.branchDist <= 0) {
        // rejoin at the node on the route exit
        this.car.s = off.nodeS + 1;
        this.off = null; this.waitingForGo = false; this.waitReason = null;
        this.log('rejoin', { nodeId: off.nodeId });
        this.say('Back on course', 'info');
      }
    }
    if (off.phase === 'turning' && this.waitingForGo && this.waitReason === 'roadEnd') { this.waitingForGo = false; this.waitReason = null; }
  }

  private checkFinish(): void {
    if (this.phase !== 'running') return;
    const end = this.sc.course.lengthFt;
    const stoppedAtFinish = this.waitingForGo && this.waitReason === 'finish';
    // V.C.2.b(2): more than 30 minutes after the computed perfect time of the final checkpoint (timing or observation) it counts as missed
    const lastLeg = this.ghost.legs[this.ghost.legs.length - 1]; const lastObs = this.ghost.observations[this.ghost.observations.length - 1];
    const finalPerfect = Math.max(lastLeg?.perfectTod ?? -Infinity, lastObs?.perfectTod ?? -Infinity);
    if (Number.isFinite(finalPerfect) && this.tod > finalPerfect + this.anchorShift + this.sc.rules.missedCpLateMinutes * 60) { this.phase = 'finished'; this.log('finished', { reason: 'timeout' }); return; }
    if (this.car.s >= end || (stoppedAtFinish && this.car.v === 0)) {
      if (this.car.s >= end && this.car.v > 0) { this.car.v = 0; this.car.mode = 'stopped'; }
      this.phase = 'finished'; this.finishedTod = this.tod;
      this.log('finished');
    }
  }

  /** Actual anchor TODs for every ghost leg: official start/restart time, exact-transit OUT time, or the previous CP actual. */
  private scoreLegs(): LegScore[] {
    const out: LegScore[] = [];
    let prevActual: number | null = null; let cumAnchor = this.sc.startTime;
    for (const leg of this.ghost.legs) {
      const rec = this.records.find(r => r.cpId === leg.cpId);
      let anchorActual: number;
      if (leg.anchor.kind === 'official') { anchorActual = leg.anchor.tod; cumAnchor = anchorActual; }
      else if (leg.anchor.kind === 'transit') {
        const endIns = this.sc.book.find(i => i.n === (leg.anchor as { endN: number }).endN)!;
        const o = this.transitOutFor(endIns); anchorActual = o ?? (prevActual ?? this.sc.startTime); cumAnchor = anchorActual;
      } else anchorActual = prevActual ?? this.sc.startTime;
      const ta = this.taDeclared[leg.index] ?? 0; const q = this.taQualifying[leg.index] ?? 0;
      out.push(scoreLeg({ leg, record: rec, anchorActual, cumulativeAnchorActual: cumAnchor, taDeclared: ta, taQualifying: q, taRecoverable: Math.min(q, this.taRecoverable[leg.index] ?? 0) }, this.taStructured ? this.sc.rules : { ...this.sc.rules, taGranularitySeconds: 1 }));
      prevActual = rec?.actualTod ?? (anchorActual + leg.perfectDuration);
    }
    return out;
  }

  private visibleFeatures(): VisibleFeature[] {
    const out: VisibleFeature[] = [];
    if (this.phase !== 'running' && this.phase !== 'preread') return out;
    const s = this.car.s;
    const r50 = (d: number) => Math.max(0, Math.round(d / 50) * 50);
    if (this.off) {
      if (this.off.phase === 'out' && this.sc.excursionFt! - this.off.branchDist < 600) out.push({ kind: 'roadEnd', approxDistanceFt: r50(this.sc.excursionFt! - this.off.branchDist), label: 'DEAD END' });
      return out;
    }
    for (let i = this.nextNodeIdx; i < this.sc.course.nodes.length; i++) {
      const n = this.sc.course.nodes[i]!;
      const d = n.s - s;
      if (d > n.sightDistance) break;
      const f: VisibleFeature = { nodeId: n.id, kind: n.kind, approxDistanceFt: r50(d), control: n.control !== 'none' ? n.control : undefined, label: n.label };
      if (n.exits) f.exits = n.exits.map(e => ({ angle: e.angle, surface: e.surface, kind: e.kind, name: d <= n.sightDistance / 2 ? e.name : undefined, controlOnExit: e.controlOnExit }));
      if (n.sign) f.sign = { shape: n.sign.shape, side: n.sign.side, text: d <= n.sightDistance / 2 ? n.sign.text : undefined };
      if (n.control === 'SIGNAL') f.signalColor = this.signalRedAt(n) ? 'red' : 'green';
      if (n.control === 'RR') f.gateDown = this.trainAt(n);
      out.push(f);
    }
    for (let i = this.nextCpIdx; i < this.sc.checkpoints.length; i++) {
      const cp = this.sc.checkpoints[i]!; const d = cp.s - s;
      if (d > cp.sightDistance) break;
      out.push({ kind: 'checkpoint', approxDistanceFt: r50(d), label: cp.kind === 'timing' ? 'CHECKPOINT (green sign)' : 'OBSERVATION CHECKPOINT (red GREAT RACE STOP board)' });
    }
    for (const h of this.sc.hazards) {
      if ((h.kind === 'slow' || h.kind === 'construction' || h.kind === 'accident' || h.kind === 'tractor' || h.kind === 'combine') && h.s - s <= 400 && h.s + h.lengthFt > s) out.push({ kind: h.kind, approxDistanceFt: r50(Math.max(0, h.s - s)), label: h.kind === 'slow' ? `Slow vehicle ahead (~${h.speedMph} mph)` : h.kind === 'accident' ? `Accident scene ahead (${h.speedMph} mph)` : h.kind === 'tractor' ? `Tractor ahead (~${h.speedMph} mph)` : h.kind === 'combine' ? `Combine ahead (~${h.speedMph} mph)` : `Construction zone ${h.speedMph} mph` });
      if (h.kind === 'schoolBus' && this.tod >= h.startTod && this.tod < h.startTod + h.durationSeconds && h.s - s <= 600 && h.s > s - 5) out.push({ kind: 'schoolBus', approxDistanceFt: r50(Math.max(0, h.s - s)), label: 'School bus stopped, red lights flashing' });
    }
    { const pc = this.paceCarsNow(); if (pc.ahead && pc.aheadVisible && !this.inCalibrationRun()) out.push({ kind: 'car', approxDistanceFt: r50(pc.ahead.distanceFt), label: 'Car one minute ahead', paceCar: { offsetSeconds: -60, gaining: this.gainingNow } }); }
    out.sort((a, b) => a.approxDistanceFt - b.approxDistanceFt);
    return out;
  }
}

function bandFor(dir: TurnDir): [number, number, number] {
  switch (dir) {
    case 'L': case 'JL': return [-120, -60, -90];
    case 'BL': return [-60, -20, -45];
    case 'S': return [-20, 20, 0];
    case 'BR': return [20, 60, 45];
    case 'R': case 'JR': return [60, 120, 90];
    case 'AL': return [-180, -120, -150];
    case 'AR': return [120, 180, 150];
  }
}
export function turnWord(dir: TurnDir): string {
  return { L: 'Left', R: 'Right', S: 'Straight', BL: 'Bear left', BR: 'Bear right', AL: 'Acute left', AR: 'Acute right', JL: 'Jog left', JR: 'Jog right' }[dir];
}
function fmtMS(sec: number): string { const s = Math.round(sec); return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`; }
export { fpsToMph };


/** SIM-022: re-run a scenario applying recorded actions at their ticks; identical result for identical inputs. */
export function replay(scenario: Scenario, actions: { tick: number; action: Action }[], opts: SimOptions & { engineVersion?: string } = {}): Simulator {
  if (opts.engineVersion && opts.engineVersion !== ENGINE_VERSION) throw new Error(`replay recorded with engine ${opts.engineVersion}, current ${ENGINE_VERSION}`);
  const sim = new Simulator(scenario, opts);
  const sorted = [...actions].sort((a, b) => a.tick - b.tick);
  let i = 0;
  const lastTick = sorted.length ? sorted[sorted.length - 1]!.tick : 0;
  while ((sim.phase as string) !== 'finished') {
    while (i < sorted.length && sorted[i]!.tick <= sim.tick) { sim.act(sorted[i]!.action); i++; }
    if ((sim.phase as string) === 'finished') break;
    sim.step(TICK);
    if (sim.tick > lastTick + 36000 * 4) break; // safety: 4 h after the last action
  }
  return sim;
}

/** The Simulator: world state machine. DESIGN §7, §9, §11. */
import {
  type Scenario, type Node, type Exit, type TurnDir, type Checkpoint, type Hazard, type Instruction, type SlowHazard, type ConstructionHazard,
  nodeById,
} from './course.js';
import { buildGhost, ghostTimeAt, type GhostTable, type Leg } from './ghost.js';
import { Car } from './car.js';
import { Speedometer } from './speedo.js';
import { Stopwatch, RallyClock, type WatchKind } from './stopwatch.js';
import { rng, type Rng } from './rng.js';
import { signalIsRed, trainActive, signalRedRemaining, trainRemaining } from './hazards.js';
import { scoreLeg, scoreStage, type CheckpointRecord, type LegScore, type StageScore } from './scoring.js';
import { mphToFps, fpsToMph, roundToSecond } from './units.js';

export type Action =
  | { type: 'watch.start' } | { type: 'watch.stop' } | { type: 'watch.toggle' } | { type: 'watch.lap' } | { type: 'watch.recall' } | { type: 'watch.reset' } | { type: 'watch.bezel'; seconds: number }
  | { type: 'ledger.set'; seconds: number }
  | { type: 'bezel.set'; seconds: number }
  | { type: 'call.speed'; mph: number }
  | { type: 'call.turn'; dir: TurnDir }
  | { type: 'call.stop' } | { type: 'call.go' } | { type: 'call.uturn' } | { type: 'call.pass' } | { type: 'call.pullover' }
  | { type: 'line.set'; n: number } | { type: 'line.annotate'; n: number; text: string } | { type: 'note'; text: string } | { type: 'abort' }
  | { type: 'ta.declare'; seconds: number; legIndex?: number }
  | { type: 'speedo.setFactor'; k: number } | { type: 'card.set'; card: Record<string, number> }
  | { type: 'start' } | { type: 'skipPreread'; secondsBefore?: number };

export interface VisibleExit { angle: number; surface: string; kind: string; name?: string; controlOnExit?: string }
export interface VisibleFeature {
  nodeId?: string;
  kind: 'intersection' | 'sign' | 'landmark' | 'start' | 'finish' | 'checkpoint' | 'signal' | 'train' | 'slow' | 'construction' | 'roadEnd';
  approxDistanceFt: number;
  control?: string;
  exits?: VisibleExit[];
  sign?: { text?: string; shape: string; side: string };
  label?: string;
  signalColor?: 'red' | 'green';
  gateDown?: boolean;
}

export interface DriverMessage { id: number; tod: number; text: string; kind: 'readback' | 'question' | 'info' }

export interface Observation {
  phase: 'preread' | 'running' | 'finished';
  tod: number;
  secondsToStart: number;
  stopwatch: { kind: WatchKind; running: boolean; reading: number; laps: number[]; bezel: number; bezelRemaining: number; dialSeconds: number };
  ledger: number | null;
  bezel: number;
  speedo: { reading: number; kind: string };
  book: Instruction[];
  currentLine: number;
  ahead: VisibleFeature[];
  driver: { messages: DriverMessage[]; state: string; targetIndicated: number | null; pendingTurn: TurnDir | null; waitingForGo: boolean; lastExecutedLine: number | null };
  annotations: Record<number, string>;
  carStopped: boolean;
  offCourseHint: boolean;
  aids: { earlyLate?: number; countdown?: number | null; cumulativePerfectAtNextLine?: number };
  notes: string[];
  /** Hidden at aids rung <= 1 (SIM-027). */
  legIndex: number | null;
  startTime: number;
  rules: Scenario['rules'];
}

export interface SimEvent { tod: number; s: number; type: string; detail?: Record<string, unknown> }

export type Bucket = 'cruise' | 'stop' | 'speedChange' | 'timedChange' | 'hazard' | 'offCourse' | 'turn' | 'start' | 'ta';
export interface LegAttribution { legIndex: number; buckets: Record<Bucket, number>; cruiseSeconds: number; meanSpeedRatio: number; stops: { nodeId: string; line: number | null; pause: number; actualCost: number; dwell: number; vIn: number; vOut: number; turn: string | null }[] }

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
  ledgerLog: { tod: number; believed: number; truth: number; legIndex: number }[];
  actions: { tick: number; action: Action }[];
  secondsLateAtStart: number;
  prereadCoverage: number;
  engineVersion: string;
}
export const ENGINE_VERSION = '1.1.0';

interface OffCourse { nodeId: string; nodeS: number; branchDist: number; phase: 'out' | 'turning' | 'back'; turnTimer: number; exitKind: string }

const TICK = 0.1;
const TURN_DIRS = new Set(['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR', 'JL', 'JR']);
const ACTION_TYPES = new Set(['watch.start', 'watch.stop', 'watch.toggle', 'watch.lap', 'watch.recall', 'watch.reset', 'watch.bezel', 'bezel.set', 'ledger.set', 'call.speed', 'call.turn', 'call.stop', 'call.go', 'call.uturn', 'call.pass', 'call.pullover', 'line.set', 'line.annotate', 'note', 'abort', 'ta.declare', 'speedo.setFactor', 'card.set', 'start', 'skipPreread']);
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
    case 'watch.bezel': case 'bezel.set': return num(x.seconds, -86400, 86400) ? null : `${t}.seconds must be a finite number`;
    case 'ledger.set': return num(x.seconds, -3600, 3600) ? null : 'ledger.set.seconds must be a finite number within +-3600';
    case 'ta.declare': return num(x.seconds, 0, 3600) && (x.legIndex === undefined || num(x.legIndex, 1, 1000)) ? null : 'ta.declare.seconds must be 0..3600';
    case 'line.set': return num(x.n, 1, 10000) ? null : 'line.set.n must be a line number';
    case 'line.annotate': return num(x.n, 1, 10000) && typeof x.text === 'string' && x.text.length <= 500 ? null : 'line.annotate needs n and text (<= 500 chars)';
    case 'note': return typeof x.text === 'string' && x.text.length <= 2000 ? null : 'note.text must be a string';
    case 'speedo.setFactor': return num(x.k, 0.5, 2) ? null : 'speedo.setFactor.k must be a finite number 0.5..2';
    case 'card.set': return x.card && typeof x.card === 'object' && Object.values(x.card as Record<string, unknown>).every(v => num(v, 0, 80)) ? null : 'card.set.card must map speeds to finite mph values';
    case 'skipPreread': return x.secondsBefore === undefined || num(x.secondsBefore, 0, 86400) ? null : 'skipPreread.secondsBefore must be a finite number';
    default: return null;
  }
}
const TURN_ZONE_FT = 60;

export interface SimOptions { watch?: WatchKind; dialSeconds?: 30 | 60; useCard?: boolean; mainRoadRule?: 'pavement-first' | 'straight-as-possible'; navigatorLatency?: number }

export class Simulator {
  readonly sc: Scenario;
  readonly ghost: GhostTable;
  readonly car: Car;
  readonly speedo: Speedometer;
  readonly watch: Stopwatch;
  readonly clock = new RallyClock();
  readonly rnd: Rng;
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
  ledgerLog: { tod: number; believed: number; truth: number; legIndex: number }[] = [];
  card: Record<string, number> = {};
  useCard: boolean;
  // driver state
  targetIndicated: number | null = null;
  pendingTurn: TurnDir | null = null;
  holdRequested = false;
  waitingForGo = false;
  waitReason: 'stop' | 'ask' | 'signal' | 'train' | 'hold' | 'roadEnd' | 'finish' | null = null;
  waitStartTod = 0;
  patienceWarned = false;
  passRequested = false;
  pullover = false;
  private bias = 0;
  private nextNodeIdx = 0;
  private nextCpIdx = 0;
  private off: OffCourse | null = null;
  offCourseCount = 0;
  // checkpoints / legs
  records: CheckpointRecord[] = [];
  legIndex = 1;
  legAnchorActual: number;
  legAnchorGhost: number;
  /** TOD at which the ghost changes speed for the active timed segment, mapped onto the car's leg clock (truth). */
  timedChangeGhostTod(): number | null { return this.timedChange ? this.legAnchorActual + (ghostTimeAt(this.ghost, this.timedChange.atS) - this.legAnchorGhost) : null; }
  taDeclared: Record<number, number> = {};
  taQualifying: Record<number, number> = {};
  // attribution
  private buckets: Record<Bucket, number> = this.emptyBuckets();
  private cruiseDt = 0; private cruiseDs = 0; private cruiseGhostDs = 0;
  private legStops: LegAttribution['stops'] = [];
  attribution: LegAttribution[] = [];
  private curStop: { nodeId: string; line: number | null; pause: number; startTod: number; dwellStart: number | null; dwell: number; vIn: number; vOut: number; turn: string | null } | null = null;
  private rampTarget: number | null = null; private rampKind: 'speedChange' | 'timedChange' | null = null;
  private lastSpeedChangeWasTimed = false;
  private timedChange: { atS: number; atTod: number } | null = null;
  private restartMinutesEarly = 0;
  private drivingSeconds = 0;
  private finishedTod: number | null = null;
  private departed = false;
  /** Turn zone: cap applies while car.s < turnZoneEndS; set when the exit is known (pre-braking) and at crossing. */
  private turnZoneEndS = -1; private turnCap = Infinity;
  private executed = new Set<number>();

  constructor(sc: Scenario, opts: SimOptions = {}) {
    this.sc = sc;
    this.ghost = buildGhost(sc);
    this.rnd = rng(sc.seed);
    this.car = new Car(sc.car);
    this.speedo = new Speedometer(sc.speedo, this.rnd.fork('speedo'));
    this.watch = new Stopwatch(opts.watch ?? 'analog', opts.dialSeconds ?? 60);
    this.useCard = opts.useCard ?? false;
    this.mainRoadRule = opts.mainRoadRule ?? 'pavement-first';
    this.tod = sc.startTime - sc.prereadSeconds;
    this.tod0 = this.tod;
    { const t = (sc.tags ?? []).find(x => x.startsWith('forceWatchReset:')); this.forceResetAt = t ? Number(t.split(':')[1]) : null; }
    this.legAnchorActual = sc.startTime;
    this.legAnchorGhost = sc.startTime;
    this.nextNodeIdx = 0;
    if (sc.prereadSeconds <= 0) { /* still requires start */ }
  }
  private readonly mainRoadRule: 'pavement-first' | 'straight-as-possible';

  private emptyBuckets(): Record<Bucket, number> { return { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 }; }

  // ---------- public API ----------
  act(a: Action): void {
    const bad = validateAction(a); if (bad) throw new Error(bad);
    const now = this.tod;
    this.actions.push({ tick: this.tick, action: a });
    if (a.type.startsWith('watch.') || a.type.startsWith('line.') || a.type === 'note' || a.type === 'bezel.set') this.log(a.type, { ...(a as unknown as Record<string, unknown>) });
    switch (a.type) {
      case 'watch.start': this.watch.start(now); break;
      case 'watch.stop': this.watch.stop(now); break;
      case 'watch.toggle': this.watch.toggle(now); break;
      case 'watch.lap': this.watch.lap(now); break;
      case 'watch.reset': if (!this.watch.reset(now)) this.say('Analog watch: stop it before resetting', 'info'); break;
      case 'watch.recall': this.watch.recall(); break;
      case 'abort': if (this.phase !== 'finished') { this.phase = 'finished'; this.log('abort'); } break;
      case 'line.annotate': this.annotations[a.n] = a.text; break;
      case 'watch.bezel': this.watch.setBezel(a.seconds); break;
      case 'ledger.set': this.ledger = a.seconds; this.ledgerLog.push({ tod: now, believed: a.seconds, truth: this.phase === 'running' ? this.pace() : 0, legIndex: this.legIndex }); this.log('ledger.set', { seconds: a.seconds, truth: this.phase === 'running' ? this.pace() : null }); break;
      case 'bezel.set': this.clock.setBezel(a.seconds); break;
      case 'line.set': this.currentLine = Math.max(1, Math.min(this.sc.book.length, Math.round(a.n))); break;
      case 'note': this.notes.push(a.text); break;
      case 'ta.declare': { const leg = a.legIndex ?? (this.lastQualifyingLeg !== null && this.lastQualifyingLeg === this.legIndex - 1 && this.tod - this.lastCpTod < 180 ? this.lastQualifyingLeg : this.legIndex); this.taDeclared[leg] = Math.max(0, a.seconds); this.log('ta.declare', { legIndex: leg, seconds: a.seconds }); break; }
      case 'speedo.setFactor': this.speedo.setFactor(a.k); this.log('speedo.setFactor', { k: a.k }); break;
      case 'card.set': this.card = { ...a.card }; this.useCard = true; break;
      case 'skipPreread': if (this.phase === 'preread') { const target = this.sc.startTime - Math.max(0, a.secondsBefore ?? 0); if (target > this.tod) { const ticks = Math.round((target - this.tod) / TICK); this.tick += ticks; this.tod = this.tod0 + this.tick * TICK; } } break;
      case 'start': this.depart(); break;
      case 'call.speed': {
        let mph = a.mph;
        if (this.useCard && this.card[String(a.mph)] !== undefined) mph = this.card[String(a.mph)]!;
        this.targetIndicated = mph; this.announceAtSpeed = true;
        this.say(`Holding ${mph}`, 'readback');
        this.log('call.speed', { mph });
        this.beginRamp();
        break;
      }
      case 'call.turn': this.pendingTurn = a.dir; this.say(`${turnWord(a.dir)} ahead, got it`, 'readback'); this.log('call.turn', { dir: a.dir });
        if (this.waitingForGo && this.waitReason === 'ask') { this.release('ask'); }
        break;
      case 'call.stop': this.holdRequested = true; this.say('Stopping at the next one', 'readback'); this.log('call.stop'); break;
      case 'call.go':
        this.log('call.go');
        if (this.phase === 'preread') { this.depart(); break; }
        if (this.waitingForGo && (this.waitReason === 'stop' || this.waitReason === 'hold' || this.waitReason === 'finish')) {
          if (this.waitReason === 'stop' && this.tod < this.trafficClearTod) { this.goPending = true; this.say('Waiting on traffic', 'info'); this.log('traffic', { wait: this.trafficClearTod - this.tod, ledgerEligible: true }); }
          else { this.say('Going', 'readback'); this.release(this.waitReason); }
        }
        else if (this.waitingForGo) this.say(`Can't go yet (${this.waitReason})`, 'info');
        else if (this.car.v === 0 && this.phase === 'running') { this.goRequestedEarly = true; this.say('Go, got it', 'readback'); }
        else this.say('Already rolling', 'info');
        break;
      case 'call.uturn':
        this.log('call.uturn');
        if (this.off && this.off.phase === 'out') { this.off.phase = 'turning'; this.off.turnTimer = 20; this.say('Turning around', 'readback'); }
        else this.say('Turn around? We are on course as far as I can tell', 'question');
        break;
      case 'call.pass': this.passRequested = true; this.say('Will pass when clear', 'readback'); this.log('call.pass'); break;
      case 'call.pullover': this.pullover = true; this.say('Pulling over', 'readback'); this.log('call.pullover'); break;
    }
  }

  private depart(): void {
    if (this.phase !== 'preread') return;
    this.phase = 'running';
    this.departed = true;
    const early = this.sc.startTime - this.tod;
    this.log('depart', { early });
    if (early > 0) this.buckets.start -= early; // ghost anchor is official start: leaving early = early
    else { this.buckets.start += -early; this.secondsLateAtStart = -early; }
    this.say(early > 2 ? `Leaving ${Math.round(early)} s early` : early < -2 ? `Leaving ${Math.round(-early)} s late` : 'Rolling on time', 'info');
    const first = this.sc.book[0]!;
    if (first.speed !== undefined && this.targetIndicated === null) this.targetIndicated = this.useCard && this.card[String(first.speed)] !== undefined ? this.card[String(first.speed)]! : first.speed;
    this.executed.add(1);
    this.nextNodeIdx = this.sc.course.nodes.findIndex(n => n.s > 0);
    if (this.nextNodeIdx < 0) this.nextNodeIdx = this.sc.course.nodes.length;
    this.car.mode = 'cruise';
    this.startRamp = true; this.announceAtSpeed = true;
    if (this.sc.car.a0 >= 1e4 && this.targetIndicated !== null) this.car.v = mphToFps(this.speedo.inverse(this.targetIndicated)); // instant (ghost) car leaves at speed
  }

  observe(opts: { peek?: boolean } = {}): Observation {
    const msgs = opts.peek ? [...this.pendingMsgs] : this.pendingMsgs; if (!opts.peek) this.pendingMsgs = [];
    const ahead = this.visibleFeatures();
    const aids: Observation['aids'] = {};
    if (this.sc.aids.paceBar && this.phase === 'running') aids.earlyLate = Math.round(this.pace() * 10) / 10;
    if (this.sc.aids.countdown && this.timedChange) { const ghostChange = this.legAnchorActual + (ghostTimeAt(this.ghost, this.timedChange.atS) - this.legAnchorGhost); aids.countdown = Math.round((ghostChange - this.tod) * 10) / 10; }
    if (this.sc.aids.cumulativeTimes) { const ins = this.sc.book[this.currentLine - 1]; if (ins) aids.cumulativePerfectAtNextLine = ghostTimeAt(this.ghost, nodeById(this.sc.course, ins.nodeId).s) - this.sc.startTime; }
    return {
      phase: this.phase, tod: this.tod, secondsToStart: this.sc.startTime - this.tod,
      stopwatch: { kind: this.watch.kind, running: this.watch.running, reading: this.watch.reading(this.tod), laps: [...this.watch.laps], bezel: this.watch.bezel, bezelRemaining: Math.round(this.watch.bezelRemaining(this.tod) * 5) / 5, dialSeconds: this.watch.dialSeconds },
      ledger: this.ledger,
      bezel: this.clock.bezel,
      speedo: { reading: this.navigatorSpeedoReading(), kind: this.sc.speedo.kind },
      book: this.sc.book, currentLine: this.currentLine, ahead,
      driver: { messages: msgs, state: this.driverState(), targetIndicated: this.targetIndicated, pendingTurn: this.pendingTurn, waitingForGo: this.waitingForGo, lastExecutedLine: this.sc.aids.checkOff ? this.lastExecutedLine : null },
      annotations: { ...this.annotations },
      stoppedAtLine: this.waitingForGo && this.waitNodeId ? (this.sc.book.find(i => i.nodeId === this.waitNodeId)?.n ?? null) : null,
      carStopped: this.car.v === 0, offCourseHint: this.sc.aids.offCourseAlert && this.off !== null && this.off.branchDist > this.sc.excursionFt! * 0.5,
      aids, notes: [...this.notes], legIndex: this.sc.aids.rung >= 2 ? this.legIndex : null, startTime: this.sc.startTime, rules: this.sc.rules,
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
  secondsLateAtStart = 0;

  private doTick(dt: number): void {
    if (this.phase === 'finished') return;
    this.tick++;
    const todNext = this.tod0 + this.tick * TICK;
    if (this.phase === 'preread') { this.tod = todNext; if (this.tod > this.sc.startTime + 30 * 60) { this.say('We are 30 minutes late, I am leaving', 'info'); this.depart(); } return; }
    this.drivingSeconds += dt;
    if (this.forceResetAt !== null && this.drivingSeconds >= this.forceResetAt) { this.forceResetAt = null; this.watch.stop(this.tod); this.watch.reset(this.tod); this.log('watchLost'); this.say('Your watch! It fell and reset', 'info'); }
    const sBefore = this.car.s;
    const vgBefore = this.ghostSpeedAt(this.routeS());
    this.driverStep(dt);
    this.speedo.step(dt, this.car.mph());
    this.tod = todNext;
    if (this.off) this.offCourseStep(dt, sBefore);
    else this.routeStep(sBefore);
    // attribution increment: de = dt - ds/vg (ghost speed where the car is on the route)
    const ds = this.off ? 0 : this.car.s - sBefore;
    const vg = vgBefore > 0 ? vgBefore : 1e9;
    const de = dt - ds / vg;
    this.buckets[this.currentBucket()] += de;
    if (this.currentBucket() === 'cruise') { this.cruiseDt += dt; this.cruiseDs += ds; this.cruiseGhostDs += vg * dt; }
    if (this.off && this.off.phase === 'turning') { this.off.turnTimer -= dt; if (this.off.turnTimer <= 0) { this.off.phase = 'back'; this.say('Heading back', 'info'); } }
    this.checkFinish();
  }

  result(): StageResult {
    const legs = this.scoreLegs();
    const attribution = [...this.attribution, this.currentAttribution()].filter(a => a.legIndex <= Math.max(1, this.ghost.legs.length));
    for (const l of legs) { const a = attribution.find(x => x.legIndex === l.index); if (a && l.taCredit) a.buckets.ta = -l.taCredit; }
    const pauseLines = this.sc.book.filter(i => i.pause);
    const startTick = this.actions.find(a => a.action.type === 'start')?.tick ?? Infinity;
    const annotatedBefore = pauseLines.filter(i => this.actions.some(a => a.action.type === 'line.annotate' && a.action.n === i.n && a.tick <= startTick)).length;
    const obsRec = this.records.find(r => r.kind === 'observation');
    const observationMissed = this.sc.checkpoints.some(c => c.kind === 'observation') && !(obsRec && obsRec.stopped);
    const score = scoreStage(legs, this.sc.car.year, this.sc.rules, { observationMissed, earlyRestartMinutes: this.restartMinutesEarly });
    return {
      scenarioId: this.sc.id, score, records: [...this.records], attribution,
      events: [...this.events], instructionsExecuted: this.executed.size, drivingSeconds: this.drivingSeconds, offCourseCount: this.offCourseCount,
      observationMissed, ghostEndTod: this.ghost.endTod, ledgerLog: [...this.ledgerLog],
      actions: [...this.actions], secondsLateAtStart: this.secondsLateAtStart, prereadCoverage: pauseLines.length ? annotatedBefore / pauseLines.length : 1, engineVersion: ENGINE_VERSION,
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
  private announceAtSpeed = false;
  private currentBucket(): Bucket {
    if (this.off) return 'offCourse';
    if (this.startRamp) return 'start';
    if (this.waitingForGo && (this.waitReason === 'signal' || this.waitReason === 'train')) return 'hazard';
    if (this.curStop) return 'stop';
    if (this.activeSlowHazard()) return 'hazard';
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
      this.car.accelFactor = 1 + this.rnd.gauss(0, this.sc.driver.inconsistency);
      this.car.decelFactor = 1 + this.rnd.gauss(0, this.sc.driver.inconsistency);
    }
  }

  private release(reason: string): void {
    this.waitingForGo = false; this.waitReason = null; this.patienceWarned = false;
    if (this.waitNodeId) { this.releasedNodeId = this.waitNodeId; this.waitNodeId = null; }
    this.announceAtSpeed = true;
    if (this.curStop) { this.curStop.dwell = this.curStop.dwellStart !== null ? this.tod - this.curStop.dwellStart : 0; }
    this.car.accelFactor = 1 + this.rnd.gauss(0, this.sc.driver.inconsistency);
    this.log('release', { reason });
  }

  private activeSlowHazard(): SlowHazard | ConstructionHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) {
      if (h.kind === 'slow' && this.passRequested && this.car.s >= h.s + h.lengthFt) this.passRequested = false;
      if ((h.kind === 'slow' || h.kind === 'construction') && this.car.s >= h.s && this.car.s < h.s + h.lengthFt) {
        if (h.kind === 'slow' && this.passRequested && h.passWindowAfterFt !== undefined && this.car.s >= h.s + h.passWindowAfterFt) continue;
        return h;
      }
    }
    return null;
  }

  private nextNode(): Node | null { return this.sc.course.nodes[this.nextNodeIdx] ?? null; }

  /** Driver: decide target speed and stop point, step the car. */
  private driverStep(dt: number): void {
    const drv = this.sc.driver;
    // speed-holding error process (indicated mph)
    const sd = drv.skill === 'perfect' ? 0 : drv.skill === 'expert' ? 0.2 : drv.skill === 'sportsman' ? 0.5 : 1.0;
    const tauB = 30;
    this.bias += (-this.bias / tauB) * dt + sd * Math.sqrt(2 * dt / tauB) * this.rnd.gauss();
    const jitter = this.rnd.gauss(0, sd * 0.15);
    let targetTrue = this.targetIndicated === null ? 0 : mphToFps(Math.max(0, this.speedo.inverse(this.targetIndicated + this.bias + jitter)));
    if (this.off) { this.offCourseDrive(dt, targetTrue); return; }

    // hazards limiting speed
    const slow = this.activeSlowHazard();
    if (slow) targetTrue = Math.min(targetTrue, mphToFps(slow.speedMph));
    // approaching an intersection where we will turn: brake to the turn cap so we arrive at it, hold it for 60 ft past the node
    const nn = this.nextNode();
    if (nn && nn.kind === 'intersection' && nn.exits && this.car.s < nn.s + TURN_ZONE_FT) {
      const ex = this.peekExit(nn);
      const ang = Math.abs(ex.angle);
      if (ang >= 20) {
        const cap = mphToFps(ang > 120 ? this.sc.car.turnSpeedMph.acute : ang >= 60 ? this.sc.car.turnSpeedMph.turn : this.sc.car.turnSpeedMph.bear);
        const dist = nn.s - this.car.s;
        const brakeDist = Math.max(0, (this.car.v * this.car.v - cap * cap) / (2 * this.car.aDec()));
        if (dist <= brakeDist + this.car.v * 0.3 || this.car.s >= nn.s - 5) { this.turnCap = cap; this.turnZoneEndS = nn.s + TURN_ZONE_FT; }
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
    this.car.step(dt, targetTrue, stopAt);
    if (stopAt !== null && node && this.car.v === 0 && Math.abs(this.car.s - stopAt) <= 2 && !this.waitingForGo) {
      this.beginWait(node);
      if (this.goRequestedEarly) { this.goRequestedEarly = false; if (this.waitReason === 'stop' || this.waitReason === 'hold' || this.waitReason === 'finish') { if (this.waitReason === 'stop' && this.tod < this.trafficClearTod) { this.goPending = true; this.say('Waiting on traffic', 'info'); } else { this.say('Going', 'readback'); this.release(this.waitReason); } } }
      this.car.step(0, 0, stopAt); return;
    }
    if (this.pullover && this.car.v === 0) { if (!this.waitingForGo) { this.waitingForGo = true; this.waitReason = 'finish'; this.waitStartTod = this.tod; this.log('pulledOver'); } }
    if (this.startRamp && this.targetIndicated !== null && this.car.v >= mphToFps(this.speedo.inverse(this.targetIndicated)) - 0.3) this.startRamp = false;
    // ramp bookkeeping
    if (this.rampKind && this.rampTarget !== null && Math.abs(this.car.v - this.rampTarget) < 0.3) { this.rampKind = null; this.rampTarget = null; }
    if (this.announceAtSpeed && this.targetIndicated !== null && !this.waitingForGo && this.car.v > 0 && Math.abs(this.car.v - mphToFps(this.speedo.inverse(this.targetIndicated))) < mphToFps(0.5)) { this.announceAtSpeed = false; this.say(`At ${this.targetIndicated}`, 'info'); }
  }
  private releasedNodeId: string | null = null;
  private waitNodeId: string | null = null;
  private trafficClearTod = 0;
  private goPending = false;
  private goRequestedEarly = false;

  private mustStopAt(node: Node): boolean {
    if (this.releasedNodeId === node.id) return false;
    if (node.control === 'STOP') return true;
    if (this.holdRequested) return true;
    if (this.isRestartNode(node)) return true;
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
  private hasStraightExit(node: Node): boolean { return (node.exits ?? []).some(e => Math.abs(e.angle) < 20 && e.kind === 'road'); }

  private beginWait(node: Node): void {
    this.waitingForGo = true; this.waitStartTod = this.tod; this.patienceWarned = false; this.waitNodeId = node.id;
    if (node.control === 'SIGNAL' && this.signalRedAt(node)) { this.waitReason = 'signal'; this.say('Red light', 'info'); if (this.sc.rules.taForSignals) this.addQualifying(signalRedRemaining(this.sc.hazards.find(h => h.kind === 'signal' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'signal' }>, this.tod)); }
    else if (node.control === 'RR' && this.trainAt(node)) { this.waitReason = 'train'; this.say('Train!', 'info'); this.addQualifying(trainRemaining(this.sc.hazards.find(h => h.kind === 'train' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'train' }>, this.tod)); }
    else if (this.isRestartNode(node)) { this.waitReason = 'hold'; this.say('Lunch stop. Say go at our restart time', 'info'); }
    else if (node.control === 'STOP') { this.waitReason = 'stop'; this.say('Stopped', 'info'); const p = this.sc.trafficWaitProbability ?? 0; if (p > 0 && this.rnd.chance(p)) { this.trafficClearTod = this.tod + this.rnd.next() * 20; } }
    else if (this.holdRequested) { this.waitReason = node.kind === 'finish' ? 'finish' : 'hold'; this.say('Stopped here', 'info'); }
    else if (node.kind === 'intersection' && !this.pendingTurn) { this.waitReason = 'ask'; this.say('Left or right?', 'question'); }
    else { this.waitReason = 'hold'; }
    this.holdRequested = false;
    if (this.curStop) this.curStop.dwellStart = this.tod;
    this.log('wait', { nodeId: node.id, reason: this.waitReason });
  }
  private lastQualifyingLeg: number | null = null; private lastCpTod = -Infinity;
  private addQualifying(sec: number): void { this.taQualifying[this.legIndex] = (this.taQualifying[this.legIndex] ?? 0) + sec; this.lastQualifyingLeg = this.legIndex; }

  /** Handle node crossings and checkpoints along the route. */
  private routeStep(sBefore: number): void {
    const s = this.car.s;
    // stop bookkeeping: entering braking zone for a stop node
    const node = this.nextNode();
    if (node && !this.curStop && this.car.mode === 'stopping' && this.mustStopAt(node) && !this.releasedNodeId) {
      const ins = this.sc.book.find(i => i.nodeId === node.id);
      this.curStop = { nodeId: node.id, line: ins?.n ?? null, pause: ins?.pause ?? 0, startTod: this.tod, dwellStart: null, dwell: 0, vIn: Math.round(this.car.mph()), vOut: ins?.timed ? ins.timed.holdSpeed : ins?.speed ?? Math.round(this.car.mph()), turn: ins?.turn ?? null };
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
  }

  private closeStop(): void {
    if (!this.curStop) return;
    const cost = this.buckets.stop; // bucket since leg start; approximate per-stop by delta
    this.legStops.push({ nodeId: this.curStop.nodeId, line: this.curStop.line, pause: this.curStop.pause, actualCost: cost - this.stopBucketAtStopStart, dwell: this.curStop.dwell, vIn: this.curStop.vIn, vOut: this.curStop.vOut, turn: this.curStop.turn });
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
    if (ins) {
      this.executed.add(ins.n); this.lastExecutedLine = ins.n;
      if (this.sc.aids.checkOff && ins.section !== 'start') this.say(`Did ${ins.turn ? 'the turn' : ins.pause ? 'the stop' : 'that one'}, line ${ins.n}`, 'info');
      if (this.sc.aids.autoAdvanceLine) this.currentLine = Math.min(this.sc.book.length, ins.n + 1);
      if (ins.pause) { this.buckets.stop -= ins.pause; if (!this.curStop) { /* pause without a stop node: still credited to stop bucket */ } }
      if (ins.restartTime !== undefined && ins.section === 'restart') {
        const early = ins.restartTime - this.tod; // tod here = departure from the restart line
        this.restartMinutesEarly = Math.max(this.restartMinutesEarly, early / 60);
        this.buckets = this.emptyBuckets(); this.legStops = []; this.cruiseDt = 0; this.cruiseDs = 0; this.cruiseGhostDs = 0; // transit into the restart is unscored
        this.legAnchorActual = ins.restartTime; this.legAnchorGhost = ins.restartTime;
        this.log('restart', { early });
      }
      if (ins.timed) { this.timedChange = { atS: n.s + mphToFps(ins.timed.holdSpeed) * ins.timed.seconds, atTod: this.tod + ins.timed.seconds }; }
      else if (ins.speed !== undefined && this.timedChange && this.tod > this.timedChange.atTod - 60) { /* speed change after a timed segment */ }
    }
    if (n.kind === 'intersection' && n.exits && n.exits.length) {
      const chosen = this.chooseExit(n);
      const angle = Math.abs(chosen.angle);
      if (angle >= 20) {
        const cap = angle > 120 ? this.sc.car.turnSpeedMph.acute : angle >= 60 ? this.sc.car.turnSpeedMph.turn : this.sc.car.turnSpeedMph.bear;
        this.turnCap = mphToFps(cap); this.turnZoneEndS = n.s + TURN_ZONE_FT;
        if (this.car.v > this.turnCap * 1.3) this.car.v = this.turnCap * 1.3; // late braking: scrub off what pre-braking missed
      }
      if (!chosen.isRoute) this.goOffCourse(n, chosen);
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
      if (cands.length) { this.pendingTurn = null; this.log('turn', { dir, angle: cands[0]!.angle, route: cands[0]!.isRoute }); return cands[0]!; }
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
    const lastLeg = this.ghost.legs[this.ghost.legs.length - 1];
    if (lastLeg && this.tod > lastLeg.perfectTod + this.sc.rules.missedCpLateMinutes * 60) { this.phase = 'finished'; this.log('finished', { reason: 'timeout' }); return; }
    if (this.car.s >= end || (stoppedAtFinish && this.car.v === 0)) {
      if (this.car.s >= end && this.car.v > 0) { this.car.v = 0; this.car.mode = 'stopped'; }
      this.phase = 'finished'; this.finishedTod = this.tod;
      this.log('finished');
    }
  }

  private scoreLegs(): LegScore[] {
    const out: LegScore[] = [];
    let prevActual: number | null = null;
    for (const leg of this.ghost.legs) {
      const rec = this.records.find(r => r.cpId === leg.cpId);
      const anchorActual: number = leg.anchor.kind === 'official' ? leg.anchor.tod : (prevActual ?? this.sc.startTime);
      out.push(scoreLeg({ leg, record: rec, anchorActual, taDeclared: this.taDeclared[leg.index] ?? 0, taQualifying: this.taQualifying[leg.index] ?? 0 }, this.sc.rules));
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
      out.push({ kind: 'checkpoint', approxDistanceFt: r50(d), label: cp.kind === 'timing' ? 'CHECKPOINT (green sign)' : 'OBSERVATION CHECKPOINT' });
    }
    for (const h of this.sc.hazards) {
      if ((h.kind === 'slow' || h.kind === 'construction') && h.s - s <= 400 && h.s + h.lengthFt > s) out.push({ kind: h.kind, approxDistanceFt: r50(Math.max(0, h.s - s)), label: h.kind === 'slow' ? `Slow vehicle ahead (~${h.speedMph} mph)` : `Construction zone ${h.speedMph} mph` });
    }
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

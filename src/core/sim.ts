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
  | { type: 'watch.start' } | { type: 'watch.stop' } | { type: 'watch.toggle' } | { type: 'watch.lap' } | { type: 'watch.reset' }
  | { type: 'bezel.set'; seconds: number }
  | { type: 'call.speed'; mph: number }
  | { type: 'call.turn'; dir: TurnDir }
  | { type: 'call.stop' } | { type: 'call.go' } | { type: 'call.uturn' } | { type: 'call.pass' } | { type: 'call.pullover' }
  | { type: 'line.set'; n: number } | { type: 'note'; text: string }
  | { type: 'ta.declare'; seconds: number }
  | { type: 'speedo.setFactor'; k: number } | { type: 'card.set'; card: Record<string, number> }
  | { type: 'start' } | { type: 'skipPreread' };

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

export interface DriverMessage { tod: number; text: string; kind: 'readback' | 'question' | 'info' }

export interface Observation {
  phase: 'preread' | 'running' | 'finished';
  tod: number;
  secondsToStart: number;
  stopwatch: { kind: WatchKind; running: boolean; reading: number; laps: number[] };
  bezel: number;
  speedo: { reading: number; kind: string };
  book: Instruction[];
  currentLine: number;
  ahead: VisibleFeature[];
  driver: { messages: DriverMessage[]; state: string; targetIndicated: number | null; pendingTurn: TurnDir | null; waitingForGo: boolean };
  carStopped: boolean;
  offCourseHint: boolean;
  aids: { earlyLate?: number; countdown?: number | null; cumulativePerfectAtNextLine?: number };
  notes: string[];
  legIndex: number;
  startTime: number;
  rules: Scenario['rules'];
}

export interface SimEvent { tod: number; s: number; type: string; detail?: Record<string, unknown> }

export type Bucket = 'cruise' | 'stop' | 'speedChange' | 'timedChange' | 'hazard' | 'offCourse' | 'turn' | 'start' | 'ta';
export interface LegAttribution { legIndex: number; buckets: Record<Bucket, number>; cruiseSeconds: number; meanSpeedRatio: number; stops: { nodeId: string; pause: number; actualCost: number; dwell: number }[] }

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
}

interface OffCourse { nodeId: string; nodeS: number; branchDist: number; phase: 'out' | 'turning' | 'back'; turnTimer: number; exitKind: string }

const TICK = 0.1;
const TURN_ZONE_FT = 60;

export interface SimOptions { watch?: WatchKind; useCard?: boolean; mainRoadRule?: 'pavement-first' | 'straight-as-possible'; navigatorLatency?: number }

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
  private driverMsgs: DriverMessage[] = [];
  private pendingMsgs: DriverMessage[] = [];
  // navigator state
  currentLine = 1;
  notes: string[] = [];
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
  taDeclared: Record<number, number> = {};
  taQualifying: Record<number, number> = {};
  // attribution
  private buckets: Record<Bucket, number> = this.emptyBuckets();
  private cruiseDt = 0; private cruiseDs = 0; private cruiseGhostDs = 0;
  private legStops: LegAttribution['stops'] = [];
  attribution: LegAttribution[] = [];
  private curStop: { nodeId: string; pause: number; startTod: number; dwellStart: number | null; dwell: number } | null = null;
  private rampTarget: number | null = null; private rampKind: 'speedChange' | 'timedChange' | null = null;
  private lastSpeedChangeWasTimed = false;
  private timedChange: { atS: number; atTod: number } | null = null;
  private restartMinutesEarly = 0;
  private drivingSeconds = 0;
  private finishedTod: number | null = null;
  private departed = false;
  private turnZoneUntil = -1; private turnCap = Infinity;
  private executed = new Set<number>();

  constructor(sc: Scenario, opts: SimOptions = {}) {
    this.sc = sc;
    this.ghost = buildGhost(sc);
    this.rnd = rng(sc.seed);
    this.car = new Car(sc.car);
    this.speedo = new Speedometer(sc.speedo, this.rnd.fork('speedo'));
    this.watch = new Stopwatch(opts.watch ?? 'analog');
    this.useCard = opts.useCard ?? false;
    this.mainRoadRule = opts.mainRoadRule ?? 'pavement-first';
    this.tod = sc.startTime - sc.prereadSeconds;
    this.legAnchorActual = sc.startTime;
    this.legAnchorGhost = sc.startTime;
    this.nextNodeIdx = 0;
    if (sc.prereadSeconds <= 0) { /* still requires start */ }
  }
  private readonly mainRoadRule: 'pavement-first' | 'straight-as-possible';

  private emptyBuckets(): Record<Bucket, number> { return { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 }; }

  // ---------- public API ----------
  act(a: Action): void {
    const now = this.tod;
    switch (a.type) {
      case 'watch.start': this.watch.start(now); break;
      case 'watch.stop': this.watch.stop(now); break;
      case 'watch.toggle': this.watch.toggle(now); break;
      case 'watch.lap': this.watch.lap(now); break;
      case 'watch.reset': this.watch.reset(now); break;
      case 'bezel.set': this.clock.setBezel(a.seconds); break;
      case 'line.set': this.currentLine = Math.max(1, Math.min(this.sc.book.length, Math.round(a.n))); break;
      case 'note': this.notes.push(a.text); break;
      case 'ta.declare': this.taDeclared[this.legIndex] = Math.max(0, a.seconds); this.log('ta.declare', { legIndex: this.legIndex, seconds: a.seconds }); break;
      case 'speedo.setFactor': this.speedo.setFactor(a.k); this.log('speedo.setFactor', { k: a.k }); break;
      case 'card.set': this.card = { ...a.card }; break;
      case 'skipPreread': if (this.phase === 'preread') { this.tod = Math.max(this.tod, this.sc.startTime); } break;
      case 'start': this.depart(); break;
      case 'call.speed': {
        let mph = a.mph;
        if (this.useCard && this.card[String(a.mph)] !== undefined) mph = this.card[String(a.mph)]!;
        this.targetIndicated = mph;
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
        if (this.waitingForGo && (this.waitReason === 'stop' || this.waitReason === 'hold' || this.waitReason === 'finish')) { this.say('Going', 'readback'); this.release(this.waitReason); }
        else if (this.waitingForGo) this.say(`Can't go yet (${this.waitReason})`, 'info');
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
    else this.buckets.start += -early;
    this.say(early > 2 ? `Leaving ${Math.round(early)} s early` : early < -2 ? `Leaving ${Math.round(-early)} s late` : 'Rolling on time', 'info');
    const first = this.sc.book[0]!;
    if (first.speed !== undefined && this.targetIndicated === null) this.targetIndicated = this.useCard && this.card[String(first.speed)] !== undefined ? this.card[String(first.speed)]! : first.speed;
    this.executed.add(1);
    this.nextNodeIdx = this.sc.course.nodes.findIndex(n => n.s > 0);
    if (this.nextNodeIdx < 0) this.nextNodeIdx = this.sc.course.nodes.length;
    this.car.mode = 'cruise';
  }

  observe(): Observation {
    const msgs = this.pendingMsgs; this.pendingMsgs = [];
    const ahead = this.visibleFeatures();
    const aids: Observation['aids'] = {};
    if (this.sc.aids.paceBar && this.phase === 'running') aids.earlyLate = Math.round(this.pace() * 10) / 10;
    if (this.sc.aids.countdown && this.timedChange) aids.countdown = Math.max(0, Math.round((this.timedChange.atTod - this.tod) * 10) / 10);
    if (this.sc.aids.cumulativeTimes) { const ins = this.sc.book[this.currentLine - 1]; if (ins) aids.cumulativePerfectAtNextLine = ghostTimeAt(this.ghost, nodeById(this.sc.course, ins.nodeId).s) - this.sc.startTime; }
    return {
      phase: this.phase, tod: this.tod, secondsToStart: this.sc.startTime - this.tod,
      stopwatch: { kind: this.watch.kind, running: this.watch.running, reading: this.watch.reading(this.tod), laps: [...this.watch.laps] },
      bezel: this.clock.bezel,
      speedo: { reading: this.speedo.reading(this.car.mph()), kind: this.sc.speedo.kind },
      book: this.sc.book, currentLine: this.currentLine, ahead,
      driver: { messages: msgs, state: this.driverState(), targetIndicated: this.targetIndicated, pendingTurn: this.pendingTurn, waitingForGo: this.waitingForGo },
      carStopped: this.car.v === 0, offCourseHint: this.off !== null && this.off.branchDist > this.sc.excursionFt! * 0.5,
      aids, notes: [...this.notes], legIndex: this.legIndex, startTime: this.sc.startTime, rules: this.sc.rules,
    };
  }

  /** Advance simulated time; always integrates in fixed 0.1 s ticks for determinism. */
  step(dt: number): void {
    this.accum += dt;
    while (this.accum >= TICK - 1e-9 && this.phase !== 'finished') { this.accum -= TICK; this.tick(TICK); }
    if (this.phase === 'finished') this.accum = 0;
  }
  private accum = 0;

  private tick(dt: number): void {
    if (this.phase === 'finished') return;
    if (this.phase === 'preread') { this.tod += dt; return; }
    this.drivingSeconds += dt;
    const sBefore = this.car.s;
    const vgBefore = this.ghostSpeedAt(this.routeS());
    this.driverStep(dt);
    this.speedo.step(dt, this.car.mph());
    this.tod += dt;
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
    const obsRec = this.records.find(r => r.kind === 'observation');
    const observationMissed = this.sc.checkpoints.some(c => c.kind === 'observation') && !(obsRec && obsRec.stopped);
    const score = scoreStage(legs, this.sc.car.year, this.sc.rules, { observationMissed, earlyRestartMinutes: this.restartMinutesEarly });
    return {
      scenarioId: this.sc.id, score, records: [...this.records], attribution: [...this.attribution, this.currentAttribution()],
      events: [...this.events], instructionsExecuted: this.executed.size, drivingSeconds: this.drivingSeconds, offCourseCount: this.offCourseCount,
      observationMissed, ghostEndTod: this.ghost.endTod,
    };
  }

  /** Seconds late (+) or early (-) right now relative to the current leg anchor. */
  pace(): number {
    const g = ghostTimeAt(this.ghost, this.routeS());
    return (this.tod - this.legAnchorActual) - (g - this.legAnchorGhost);
  }

  // ---------- internals ----------
  private routeS(): number { return this.off ? this.off.nodeS : this.car.s; }
  private ghostSpeedAt(s: number): number {
    const bps = this.ghost.breakpoints; let lo = 0, hi = bps.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bps[mid]!.s <= s) lo = mid; else hi = mid - 1; }
    return bps[lo]!.v;
  }
  private log(type: string, detail?: Record<string, unknown>): void { this.events.push({ tod: this.tod, s: this.car.s, type, detail }); }
  private say(text: string, kind: DriverMessage['kind']): void { const m = { tod: this.tod, text, kind }; this.driverMsgs.push(m); this.pendingMsgs.push(m); this.log('driver', { text, kind }); }
  private driverState(): string {
    if (this.phase !== 'running') return this.phase;
    if (this.off) return this.off.phase === 'out' ? 'offcourse' : this.off.phase === 'turning' ? 'uturn' : 'returning';
    if (this.waitingForGo) return `waiting:${this.waitReason}`;
    return this.car.mode;
  }
  private currentBucket(): Bucket {
    if (this.off) return 'offCourse';
    if (this.waitingForGo && (this.waitReason === 'signal' || this.waitReason === 'train')) return 'hazard';
    if (this.curStop) return 'stop';
    if (this.activeSlowHazard()) return 'hazard';
    if (this.tod < this.turnZoneUntil) return 'turn';
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
    if (this.curStop) { this.curStop.dwell = this.curStop.dwellStart !== null ? this.tod - this.curStop.dwellStart : 0; }
    this.car.accelFactor = 1 + this.rnd.gauss(0, this.sc.driver.inconsistency);
    this.log('release', { reason });
  }

  private activeSlowHazard(): SlowHazard | ConstructionHazard | null {
    if (this.off) return null;
    for (const h of this.sc.hazards) {
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
    const sd = drv.skill === 'expert' ? 0.2 : drv.skill === 'sportsman' ? 0.5 : 1.0;
    const tauB = 30;
    this.bias += (-this.bias / tauB) * dt + sd * Math.sqrt(2 * dt / tauB) * this.rnd.gauss();
    const jitter = this.rnd.gauss(0, sd * 0.15);
    let targetTrue = this.targetIndicated === null ? 0 : mphToFps(Math.max(0, this.speedo.inverse(this.targetIndicated + this.bias + jitter)));
    if (this.off) { this.offCourseDrive(dt, targetTrue); return; }

    // hazards limiting speed
    const slow = this.activeSlowHazard();
    if (slow) targetTrue = Math.min(targetTrue, mphToFps(slow.speedMph));
    if (this.tod < this.turnZoneUntil) targetTrue = Math.min(targetTrue, this.turnCap);
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
        if ((this.waitReason === 'stop' || this.waitReason === 'hold') && !this.holdRequested) {
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
    if (this.pullover && this.car.v === 0) { if (!this.waitingForGo) { this.waitingForGo = true; this.waitReason = 'finish'; this.waitStartTod = this.tod; this.log('pulledOver'); } }
    // ramp bookkeeping
    if (this.rampKind && this.rampTarget !== null && Math.abs(this.car.v - this.rampTarget) < 0.3) { this.rampKind = null; this.rampTarget = null; }
  }
  private releasedNodeId: string | null = null;
  private waitNodeId: string | null = null;

  private mustStopAt(node: Node): boolean {
    if (this.releasedNodeId === node.id) return false;
    if (node.control === 'STOP') return true;
    if (this.holdRequested) return true;
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
  private hasStraightExit(node: Node): boolean { return (node.exits ?? []).some(e => Math.abs(e.angle) < 20 && e.kind === 'road'); }

  private beginWait(node: Node): void {
    this.waitingForGo = true; this.waitStartTod = this.tod; this.patienceWarned = false; this.waitNodeId = node.id;
    if (node.control === 'SIGNAL' && this.signalRedAt(node)) { this.waitReason = 'signal'; this.say('Red light', 'info'); this.addQualifying(signalRedRemaining(this.sc.hazards.find(h => h.kind === 'signal' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'signal' }>, this.tod)); }
    else if (node.control === 'RR' && this.trainAt(node)) { this.waitReason = 'train'; this.say('Train!', 'info'); this.addQualifying(trainRemaining(this.sc.hazards.find(h => h.kind === 'train' && Math.abs(h.s - node.s) < 1) as Extract<Hazard, { kind: 'train' }>, this.tod)); }
    else if (node.control === 'STOP') { this.waitReason = 'stop'; this.say('Stopped', 'info'); }
    else if (this.holdRequested) { this.waitReason = node.kind === 'finish' ? 'finish' : 'hold'; this.say('Stopped here', 'info'); }
    else if (node.kind === 'intersection' && !this.pendingTurn) { this.waitReason = 'ask'; this.say('Left or right?', 'question'); }
    else { this.waitReason = 'hold'; }
    this.holdRequested = false;
    if (this.curStop) this.curStop.dwellStart = this.tod;
    this.log('wait', { nodeId: node.id, reason: this.waitReason });
  }
  private addQualifying(sec: number): void { this.taQualifying[this.legIndex] = (this.taQualifying[this.legIndex] ?? 0) + sec; }

  /** Handle node crossings and checkpoints along the route. */
  private routeStep(sBefore: number): void {
    const s = this.car.s;
    // stop bookkeeping: entering braking zone for a stop node
    const node = this.nextNode();
    if (node && !this.curStop && node.control === 'STOP' && this.car.mode === 'stopping' && !this.releasedNodeId) {
      const ins = this.sc.book.find(i => i.nodeId === node.id);
      this.curStop = { nodeId: node.id, pause: ins?.pause ?? 0, startTod: this.tod, dwellStart: null, dwell: 0 };
      this.log('stop.begin', { nodeId: node.id });
    }
    // checkpoints
    for (; this.nextCpIdx < this.sc.checkpoints.length; ) {
      const cp = this.sc.checkpoints[this.nextCpIdx]!;
      if (s >= cp.s - cp.sightDistance && sBefore < cp.s && cp.kind === 'timing') {
        if (this.car.v <= mphToFps(5)) { const rec = this.ensureRecord(cp); if (!rec.sightViolation) { rec.sightViolation = true; this.log('sightZoneViolation', { cpId: cp.id }); } }
      }
      if (s >= cp.s && sBefore < cp.s) { this.crossCheckpoint(cp); this.nextCpIdx++; continue; }
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
    // speed-ramp end after a stop: when back up to target, close the stop record
    if (this.curStop && this.releasedNodeId && this.car.mode === 'cruise' && this.targetIndicated !== null && Math.abs(this.car.v - mphToFps(this.speedo.inverse(this.targetIndicated))) < 0.5) {
      this.closeStop();
    }
    if (this.releasedNodeId) { const rn = this.sc.course.nodes.find(x => x.id === this.releasedNodeId); if (rn && s > rn.s + 5) this.releasedNodeId = null; }
    // timed change due?
    if (this.timedChange && this.tod >= this.timedChange.atTod + 60) this.timedChange = null;
  }

  private closeStop(): void {
    if (!this.curStop) return;
    const cost = this.buckets.stop; // bucket since leg start; approximate per-stop by delta
    this.legStops.push({ nodeId: this.curStop.nodeId, pause: this.curStop.pause, actualCost: cost - this.stopBucketAtStopStart, dwell: this.curStop.dwell });
    this.log('stop.end', { nodeId: this.curStop.nodeId, dwell: this.curStop.dwell });
    this.curStop = null;
  }
  private stopBucketAtStopStart = 0;

  private ensureRecord(cp: Checkpoint): CheckpointRecord {
    let rec = this.records.find(r => r.cpId === cp.id);
    if (!rec) { rec = { cpId: cp.id, kind: cp.kind, actualTod: null, rawTod: null, sightViolation: false, stopped: cp.kind === 'observation' ? false : undefined }; this.records.push(rec); }
    return rec;
  }

  private crossCheckpoint(cp: Checkpoint): void {
    const rec = this.ensureRecord(cp);
    rec.rawTod = this.tod; rec.actualTod = roundToSecond(this.tod);
    this.log('checkpoint', { cpId: cp.id, kind: cp.kind, actualTod: rec.actualTod, pace: this.pace() });
    if (cp.kind === 'timing') {
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
    const ins = this.sc.book.find(i => i.nodeId === n.id);
    if (ins) {
      this.executed.add(ins.n);
      if (this.sc.aids.autoAdvanceLine) this.currentLine = Math.min(this.sc.book.length, ins.n + 1);
      if (ins.pause) { this.buckets.stop -= ins.pause; if (!this.curStop) { /* pause without a stop node: still credited to stop bucket */ } }
      if (ins.restartTime !== undefined && ins.section === 'restart') {
        const early = ins.restartTime - this.tod;
        this.restartMinutesEarly = Math.max(this.restartMinutesEarly, early / 60);
        this.attribution.push(this.currentAttribution()); this.buckets = this.emptyBuckets(); this.legStops = [];
        this.legAnchorActual = ins.restartTime; this.legAnchorGhost = ins.restartTime;
        this.log('restart', { early });
      }
      if (ins.timed) { this.timedChange = { atS: n.s + mphToFps(ins.timed.holdSpeed) * ins.timed.seconds, atTod: this.tod + ins.timed.seconds }; }
      else if (ins.speed !== undefined && this.timedChange && this.tod > this.timedChange.atTod - 60) { /* speed change after a timed segment */ }
    }
    if (this.curStop && this.curStop.nodeId === n.id) this.stopBucketAtStopStart = this.buckets.stop - 0; // bucket already includes braking + pause credit
    if (n.kind === 'intersection' && n.exits && n.exits.length) {
      const chosen = this.chooseExit(n);
      const angle = Math.abs(chosen.angle);
      if (angle >= 20) {
        const cap = angle > 120 ? this.sc.car.turnSpeedMph.acute : angle >= 60 ? this.sc.car.turnSpeedMph.turn : this.sc.car.turnSpeedMph.bear;
        this.turnCap = mphToFps(cap); this.turnZoneUntil = this.tod + TURN_ZONE_FT / Math.max(this.car.v, 5) + 1.0;
        if (this.car.v > this.turnCap) this.car.v = this.turnCap; // simplified: the driver slowed into the turn
      }
      if (!chosen.isRoute) this.goOffCourse(n, chosen);
    }
    if (n.kind === 'finish' && this.waitReason !== 'finish') { /* finish banner: course ends at lengthFt */ }
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

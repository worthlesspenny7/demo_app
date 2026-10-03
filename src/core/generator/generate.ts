/**
 * Procedural scenario generator (DESIGN §13, GEN-001..GEN-008). Deterministic from (seed, profile); uses only rng.ts.
 *
 * Shape: [START] [calibration >= 15 mi @ 50] leg_1 ... [lunch RESTART] ... leg_N [FINISH + observation CP].
 * Each leg is planned first (a list of items at relative positions), then its one hidden timing checkpoint is
 * chosen against the item list, then everything is emitted through ScenarioBuilder in course order.
 *
 * Placement rules keep the OracleBot (truth-reading autopilot) inside +-5 s per leg: nodes whose cost the ghost
 * ignores (turns without a STOP, signals, trains, yields, slow traffic) need recovery road before a checkpoint,
 * a turn callout is armed 600 ft out so real-road distractors in the callout's band sit >= 650 ft before the node,
 * and a timed segment's virtual node never reaches the next instruction (GHOST-010).
 */
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE, type NodeSpec, type InsSpec } from '../builder.js';
import {
  type Scenario, type CarSpec, type SpeedoSpec, type DriverSpec, type AidsConfig, type Exit, type Control, type TurnDir, type Section, type TimeZoneLabel,
  FORD_1939, DRIVER_EXPERT, TRAINING_AIDS, validateScenario, nodeById,
} from '../course.js';
import { buildGhost, ghostTimeAt, annotatePerfectTimes } from '../ghost.js';
import { rng, type Rng } from '../rng.js';
import { milesToFt, mphToFps } from '../units.js';
import { TRAPS, GENERIC_DISTRACTORS, trapToNodeSpec, trapDistractorBefore, routeExit, mainRoadExit, exitForCallout, type TrapCard } from './traps.js';

export type LineType = 'stop' | 'turn' | 'speedSign' | 'landmarkSpeed' | 'curveSign' | 'timed' | 'signal' | 'rr' | 'trap' | 'straight';

export interface GenProfile {
  /** Number of legs (= timing checkpoints). 0 = seeded 4-7 (full stage default). */
  legs: number;
  lineDensity: 'low' | 'normal' | 'high';
  /** 0..1: probability weight of trap cards and distractor nodes. */
  trapDensity: number;
  signals: boolean;
  trains: boolean;
  slowTraffic: boolean;
  calibration: boolean;
  lunchRestart: boolean;
  car?: CarSpec;
  speedo?: SpeedoSpec;
  driver?: DriverSpec;
  aids?: AidsConfig;
  startTime?: number;
  trafficWaitProbability?: number;
  /** GEN-002: alias for `legs` ("12-CP day"). */
  cpCount?: number;
  /** GEN-003: force at least one deliberately missing pause. */
  noPauseTraps?: boolean;
  /** Relative weights of line types (drills); missing keys use the defaults. */
  mix?: Partial<Record<LineType, number>>;
  /** Fraction of lines in town clusters (default 0.3). */
  townFraction?: number;
  name?: string;
  /**
   * STAGE-001 skeleton: 'day' = start + tire warm-up, speedometer calibration run (3-6 calibration points), transit, time-of-day restart,
   * timed portion, "End timed portion" + TA point, a lunch transit with promoted stops, a restart, a second timed portion, End timed portion + TA point,
   * a transit to the finish, finish line with the Observation Checkpoint.
   */
  skeleton?: 'day';
  /** REG-006: probability that a STOP prints the 15 s pause in Column C (default 1; the full-day profiles use 0.85). The car stops either way. */
  pauseOnStopProbability?: number;
  /** REG-006: probability that a traffic signal prints a pause (default 0). */
  pauseOnSignalProbability?: number;
  /** STAGE-004: probability of one free zone per timed portion (default 0). */
  freeZoneProbability?: number;
  /** End the (last) timed portion with "End timed portion", its end-of-stage TA point and a transit to the finish (DRILL-025). */
  endTimed?: boolean;
  /** DRILL-025: a one-leg timed portion begins with an advisory transit (the way in) ending at a time-of-day restart at base + ASP, like the day skeleton's morning restart. */
  transitIn?: boolean;
  /** Assigned starting position in minutes and the time-zone label printed on clock faces (STAGE-002). */
  asp?: number;
  timeZone?: TimeZoneLabel;
  bookStyle?: 'example' | 'race';
}

/** STAGE-007: multiples of 5 from 15 to 55; 20 is the common town speed, 50 and 55 are highway speeds. */
export const SPEEDS: readonly number[] = [20, 25, 30, 35, 40, 45, 50, 55];
const TOWN_SPEEDS: readonly number[] = [20, 25, 30, 35];
const RURAL_SPEEDS: readonly number[] = [30, 35, 40, 45, 50, 55];
const FT_MI = 5280;

/** Feet a checkpoint must sit AFTER an item (sight zone: a stopped car 400 ft before the CP would violate SIM-004) and BEFORE it (braking). */
const AFTER = { control: 500, speed: 300, plain: 100 };
const BEFORE = { control: 400, plain: 100 };
/**
 * Seconds the ghost ignores but the car loses, which the OracleBot does NOT pre-compensate (it only pre-compensates
 * stops and speed-change ramps). The checkpoint chooser requires this "debt" to be recoverable before the CP.
 */
const COST = { stop: 0.5, stopNoPause: 7, signalRed: 10, trainHit: 12, yield: 6, blinker: 3.5, turn: 7, bear: 2.5, speed: 0.3, timed: 1.5, none: 0 };
/** Oracle recovery: +2 mph over the assigned speed (+5 when more than 6 s late), only when > 900 ft from the next instruction node. */
function recoveryPerFt(speedMph: number, debt: number): number { const d = debt > 6 ? 5 : 2; return 0.65 * (1 / mphToFps(speedMph) - 1 / mphToFps(speedMph + d)); } // ~65 % efficient in practice
const MAX_DEBT_AT_CP = 2.5;

interface Item {
  at: number;             // ft from leg start
  node: NodeSpec;
  ins?: InsSpec;          // undefined = distractor (never carries an instruction)
  kind: LineType | 'distractor' | 'calibration';
  /** Hard geometric exclusion (ft) after / before the item for a checkpoint. */
  costAfter: number;
  needBefore: number;
  /** Uncompensated seconds the car loses here (see COST). */
  cost: number;
  /** Assigned speed after this item (distractors: unchanged). */
  speedAfter: number;
  signal?: { redSeconds: number; greenSeconds: number; offset: number };
  train?: { durationSeconds: number; hit: boolean };
  slow?: { at: number; speedMph: number; lengthFt: number; passWindowAfterFt: number };
  trapId?: string;
  cpAfterFt?: [number, number];
  town: boolean;
}

interface CpChoice { at: number; mode: 'afterStop' | 'afterSpeed' | 'open'; anchorKind?: string }

export const PROFILES: Record<'pauseDrill' | 'timedDrill' | 'landmarkDrill' | 'calibration' | 'recovery' | 'fullLeg' | 'combo' | 'fullStage', GenProfile> = {
  pauseDrill: { name: 'pauseDrill', pauseOnStopProbability: 1, legs: 1, lineDensity: 'low', trapDensity: 0, signals: false, trains: false, slowTraffic: false, calibration: false, lunchRestart: false, mix: { stop: 70, straight: 10, speedSign: 10, turn: 0, timed: 0, landmarkSpeed: 5, curveSign: 5 }, townFraction: 0 },
  timedDrill: { name: 'timedDrill', legs: 1, lineDensity: 'low', trapDensity: 0, signals: false, trains: false, slowTraffic: false, calibration: false, lunchRestart: false, mix: { timed: 60, stop: 10, speedSign: 15, straight: 10, turn: 0, landmarkSpeed: 5, curveSign: 0 }, townFraction: 0 },
  landmarkDrill: { name: 'landmarkDrill', legs: 1, lineDensity: 'low', trapDensity: 0, signals: false, trains: false, slowTraffic: false, calibration: false, lunchRestart: false, mix: { speedSign: 35, landmarkSpeed: 30, curveSign: 15, stop: 10, straight: 5, turn: 0, timed: 5 }, townFraction: 0 },
  calibration: { name: 'calibration', legs: 1, lineDensity: 'low', trapDensity: 0, signals: false, trains: false, slowTraffic: false, calibration: true, lunchRestart: false, mix: { stop: 30, speedSign: 30, straight: 20, turn: 0, timed: 0 }, townFraction: 0 },
  recovery: { name: 'recovery', pauseOnStopProbability: 0.85, legs: 1, lineDensity: 'normal', trapDensity: 0.1, signals: true, trains: true, slowTraffic: true, calibration: false, lunchRestart: false, trafficWaitProbability: 0.3 },
  fullLeg: { name: 'fullLeg', pauseOnStopProbability: 0.85, endTimed: true, legs: 1, lineDensity: 'normal', trapDensity: 0.35, signals: true, trains: true, slowTraffic: true, calibration: false, lunchRestart: false, trafficWaitProbability: 0.15 },
  combo: { name: 'combo', pauseOnStopProbability: 0.85, legs: 2, lineDensity: 'normal', trapDensity: 0.3, signals: true, trains: false, slowTraffic: true, calibration: false, lunchRestart: false },
  fullStage: { name: 'fullStage', skeleton: 'day', pauseOnStopProbability: 0.85, freeZoneProbability: 0.5, endTimed: true, legs: 0, lineDensity: 'normal', trapDensity: 0.3, signals: true, trains: true, slowTraffic: true, calibration: true, lunchRestart: true, trafficWaitProbability: 0.15 },
};

const LANDMARKS = ['bridge', 'church on R', 'water tower on L', 'cattle guard', 'county line sign', 'grain elevator on R', 'cemetery on L', 'overpass', 'fire station on R', 'creek bridge'];
const SIGN_TEXTS: { text: string; shape: 'rect' | 'diamond' | 'shield' | 'blade' }[] = [
  { text: 'SPEED LIMIT 35', shape: 'rect' }, { text: 'SPEED LIMIT 45', shape: 'rect' }, { text: 'REDUCED SPEED AHEAD', shape: 'rect' }, { text: 'PASS WITH CARE', shape: 'rect' },
  { text: 'NO PASSING ZONE', shape: 'rect' }, { text: 'SCHOOL', shape: 'rect' }, { text: 'JCT 12', shape: 'shield' }, { text: 'CITY LIMIT', shape: 'rect' }, { text: 'HILL', shape: 'diamond' }, { text: 'DEER CROSSING', shape: 'diamond' },
];
const TOWN_NAMES = ['MILLBROOK', 'ELDORA', 'CENTERVILLE', 'FAIRFIELD', 'OSAGE', 'NEW HAMPTON', 'DECORAH', 'TIPTON', 'WAVERLY', 'CLARION'];

class Generator {
  private readonly r: Rng;
  private readonly b: ScenarioBuilder;
  private readonly tags: string[];
  private speed = 35;
  /** Lines emitted so far (the start line is 1). */
  private get lineNo(): number { return this.b.lineCount; }
  private cpNo = 0;
  private legCounter = 0;
  private perLeg: number[] = [];
  private freeZoneFtAfterTransit = 0;
  private afterStopPlaced = false;
  private usedTraps = new Set<string>();
  private trainsPlaced = 0; private trainHits = 0;
  private makeTrain(): { durationSeconds: number; hit: boolean } | undefined {
    if (!this.profile.trains || this.trainsPlaced >= 2) return undefined;
    this.trainsPlaced++;
    const hit = this.trainHits < 1 && this.r.chance(0.6); if (hit) this.trainHits++;
    return { durationSeconds: this.r.int(60, 120), hit };
  }
  private trapsUsedThisLeg = new Set<string>();
  private noPauseThisLeg = 0;
  /** The last leg of a timed portion must place a checkpoint after a STOP when none has been placed yet (GEN-007). */
  private forceAfterStop = false;
  private missingPauses = 0;
  readonly legs: number;

  constructor(readonly seed: number, readonly profile: GenProfile, private readonly kind: 'leg' | 'stage') {
    this.r = rng(`gen:${kind}:${seed}`);
    const wanted = profile.cpCount ?? profile.legs;
    this.legs = kind === 'leg' ? 1 : wanted > 0 ? wanted : this.r.int(4, 7);
    this.tags = [`gen:${profile.name ?? kind}`, `seed:${seed}`];
    this.b = new ScenarioBuilder({
      id: `gen-${profile.name ?? kind}-${seed}`, name: `${profile.name ?? kind} #${seed}`, seed, startTime: profile.startTime ?? 8 * 3600,
      car: profile.car ?? FORD_1939, speedo: profile.speedo ?? PERFECT_TIMEWISE, driver: profile.driver ?? DRIVER_EXPERT, aids: profile.aids ?? TRAINING_AIDS,
      tags: this.tags, trafficWaitProbability: profile.trafficWaitProbability ?? 0, asp: profile.asp, timeZone: profile.timeZone, bookStyle: profile.bookStyle,
    });
  }

  // ---------- public ----------
  build(): Scenario {
    const p = this.profile;
    this.perLeg = this.linesPerLeg();
    const day = p.skeleton === 'day' && this.kind === 'stage';
    if (day) this.tags.push('stage:day');
    if (p.calibration || day) this.emitOpening();
    else if (p.transitIn && this.kind === 'leg') this.emitTransitIn();
    else { this.speed = this.r.pick(RURAL_SPEEDS); this.b.start(this.speed); }
    const afterRestart = !!(p.calibration || day || (p.transitIn && this.kind === 'leg'));
    if (day) {
      const a = Math.ceil(this.legs / 2);
      this.emitLegs(a, { firstIsStop: false, lastOfStage: false, afterTransit: afterRestart });
      this.emitLunchTransit();
      this.emitLegs(this.legs - a, { firstIsStop: true, lastOfStage: true, afterTransit: true });
    } else {
      const lunchAfter = p.lunchRestart && this.legs >= 2 ? Math.max(1, Math.floor(this.legs / 2)) : -1;
      if (lunchAfter > 0) {
        this.emitLegs(lunchAfter, { firstIsStop: false, lastOfStage: false, afterTransit: afterRestart });
        this.emitLunchTransit();
        this.emitLegs(this.legs - lunchAfter, { firstIsStop: true, lastOfStage: true, afterTransit: true });
      } else this.emitLegs(this.legs, { firstIsStop: false, lastOfStage: true, afterTransit: afterRestart });
    }
    if (p.endTimed) this.emitClosing();
    else { this.b.advanceFt(milesToFt(0.3 + 0.3 * this.r.next())); this.b.observationFinish(); }
    const sc = this.b.build();
    const problems = [...validateScenario(sc), ...checkRouteExits(sc)];
    if (problems.length) throw new Error(`generator produced an invalid scenario (seed ${this.seed}): ${problems.join('; ')}`);
    return sc;
  }

  // ---------- sizing ----------
  private linesPerLeg(): number[] {
    const d = this.profile.lineDensity;
    if (this.legs === 1) {
      const n = d === 'low' ? this.r.int(10, 14) : d === 'normal' ? this.r.int(26, 32) : this.r.int(36, 44);
      return [n];
    }
    const day = this.profile.skeleton === 'day';
    const fixed = day ? 42 : (this.profile.calibration ? 9 : 0) + 3; // warm-up, calibration, transit, TA and lunch lines, restarts, finish
    const total = d === 'low' ? this.r.int(110, 150) : d === 'normal' ? this.r.int(185, 235) : this.r.int(245, 300);
    const per = Math.max(6, Math.round((total - fixed) / this.legs));
    return Array.from({ length: this.legs }, () => per + this.r.int(-2, 2));
  }

  // ---------- STAGE-001 opening: warm-up, calibration run, transit, restart ----------
  private emitOpening(): void {
    const b = this.b, r = this.r;
    const town = r.pick(TOWN_NAMES);
    this.speed = 50;
    b.start(undefined);
    b.warmup({ seconds: 1200 });
    const warmMiles = r.int(75, 90) / 10;
    b.advanceFt(milesToFt(0.3 + 0.4 * r.next()));
    this.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('R'), sightDistance: 800 }, { turn: 'R' });
    b.advanceMiles(1.0 + 0.8 * r.next());
    this.instruction({ sign: { text: `LEAVING ${town} CITY LIMIT`, shape: 'rect', side: 'R' }, sightDistance: 500 }, {});
    b.advanceMiles(1.5 + r.next());
    // the Example Rally prints no pause at this stop: the driver stops anyway (REG-006)
    this.instruction({ control: 'STOP', exits: EXITS.crossroads('S'), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'S' });
    const warmLeft = warmMiles - b.position / 5280;
    b.advanceMiles(Math.max(0.5, warmLeft));
    // speedometer calibration run: >= 15 miles, mostly 50 mph, 3-6 calibration points with official times to 0.1 s
    const calMiles = r.int(155, 205) / 10; const points = r.int(3, 6);
    const w = Array.from({ length: points }, () => 0.7 + r.next()); const wsum = w.reduce((x, y) => x + y, 0);
    const gaps = w.map(x => calMiles * x / wsum);
    const t1miles = r.int(25, 60) / 10; const t1sec = Math.ceil(t1miles / 30 * 3600 / 60) * 60;
    b.calibrationRun({ miles: calMiles, speed: 50, points, gaps, allowanceExtraSeconds: 60 * r.int(2, 5), thenTransit: { exact: false, seconds: t1sec } });
    this.tags.push(`calibration:miles:${calMiles.toFixed(1)}:points:${points}`);
    b.advanceMiles(t1miles * 0.55);
    const bear = r.pick(['BL', 'BR'] as const);
    this.instruction({ exits: EXITS.wye(bear), sightDistance: 600, label: 'Y' }, { turn: bear });
    b.advanceMiles(t1miles * 0.45);
    // time-of-day restart: printed base = start + warm-up + calibration allowance + transit (HB: 8:00 + 20m + 26m + 9m = 8:55), plus ASP minutes for the team
    const base = b.opts.startTime + 1200 + b.calibrationInfo!.allowanceSeconds + t1sec;
    this.speed = r.pick(TOWN_SPEEDS);
    b.restart(this.speed, base);
    this.tags.push(`restart:base:${base}`);
    this.freeZoneFtAfterTransit = Math.ceil(120 * mphToFps(this.speed)) + 400;
  }

  // ---------- DRILL-025: an advisory transit in, then the time-of-day restart that opens the timed portion ----------
  private emitTransitIn(): void {
    const b = this.b, r = this.r;
    this.speed = r.pick(TOWN_SPEEDS); b.start(this.speed);
    const miles = r.int(28, 42) / 10; const secs = Math.ceil(miles / 30 * 3600 / 60) * 60; // an advisory time for a 30 mph pace
    b.advanceMiles(0.25); b.transit({ exact: false, seconds: secs, miles });
    b.advanceMiles(miles * 0.5);
    this.instruction({ sign: { text: `${r.pick(TOWN_NAMES)} CITY LIMIT`, shape: 'rect', side: 'R' }, sightDistance: 500 }, {});
    b.advanceMiles(miles * 0.5 - 0.25);
    // the printed base time = the team's start + the transit + two minutes of margin (the team adds its ASP)
    const base = b.opts.startTime + Math.ceil((secs + 150) / 60) * 60;
    this.speed = r.pick(TOWN_SPEEDS);
    b.restart(this.speed, base);
    this.tags.push(`restart:base:${base}`, 'transit:in');
    this.freeZoneFtAfterTransit = Math.ceil(120 * mphToFps(this.speed)) + 400;
  }

  // ---------- timed portions ----------
  private emitLegs(count: number, o: { firstIsStop: boolean; lastOfStage: boolean; afterTransit: boolean }): void {
    const p = this.profile; const forceNoPause = !!p.noPauseTraps;
    const fzLeg = count > 1 && this.r.chance(p.freeZoneProbability ?? 0) ? this.r.int(0, count - 1) : -1;
    for (let k = 0; k < count; k++) {
      const leg = ++this.legCounter; const n = this.perLeg[leg - 1]!;
      const lastLeg = o.lastOfStage && k === count - 1;
      const items = this.planLeg(n, { firstIsStop: o.firstIsStop && k === 0, forceMissingPause: forceNoPause && leg === 1, calmTail: lastLeg });
      this.forceAfterStop = k === count - 1;
      const cp = this.chooseCheckpoint(items, lastLeg, k === 0 && o.afterTransit ? this.freeZoneFtAfterTransit : 0);
      if (k === fzLeg) this.addFreeZone(items, cp);
      this.emitLeg(items, cp);
      const lastAt = items[items.length - 1]!.at;
      let v = this.legStartSpeed; for (const it of items) { if (it.at > cp.at) break; if (it.ins) v = it.speedAfter; }
      this.carrySpeed = v;
      this.carry = items.filter(it => it.at > cp.at).map(it => ({ ...it, at: it.at - lastAt, slow: it.slow ? { ...it.slow, at: it.slow.at - lastAt } : undefined }));
    }
    this.carry = []; // the end of a timed portion re-anchors the clock: no debt carries over
  }

  /** STAGE-004: one free zone inside this leg, on two existing instruction rows with no Timing Checkpoint between them. */
  private addFreeZone(items: Item[], cp: CpChoice): void {
    const rows = items.filter(i => i.ins && !i.ins.timed);
    const pairs: [Item, Item][] = [];
    for (let i = 0; i < rows.length; i++) for (let j = i + 2; j < rows.length; j++) {
      const a = rows[i]!, b = rows[j]!;
      if ((b.at < cp.at - 150) || (a.at > cp.at + 150)) pairs.push([a, b]);
    }
    if (!pairs.length) return;
    const [a, b] = this.r.pick(pairs);
    a.ins = { ...a.ins!, freeZone: 'begin' }; b.ins = { ...b.ins!, freeZone: 'end' };
    this.tags.push(`freezone:${this.lineNo + items.filter(i => i.ins && i.at <= a.at).length + 1}`);
  }

  // ---------- lunch transit (STAGE-001 / STAGE-005) ----------
  /**
   * End of a timed portion: "End timed portion" (+ TA point), a transit holding a hosted meal stop ("leave 45m prior to your end-of-transit time")
   * and optionally a rest stop, then the time-of-day restart. The numbers are chosen so the transit pace (what a navigator drives) gets the car
   * to the meal stop with time to spare, and from the meal stop to the restart before the restart minute.
   */
  private emitLunchTransit(): void {
    const b = this.b, r = this.r;
    b.advanceFt(milesToFt(0.25 + 0.3 * r.next()));
    const g = buildGhost(b.build());
    const tEnd = ghostTimeAt(g, b.position);
    const m1 = r.int(60, 90) / 10, m2 = r.int(65, 85) / 10; const leadMeal = 45 * 60;
    const pace = 15; // mph: the slowest pace a transit navigator is told to drive; transit allowances below are generous
    const t1 = m1 / pace * 3600 + 120;
    const L = Math.ceil((leadMeal + t1 + 300) / 300) * 300;
    const M = m1 + m2;
    const withRest = r.chance(0.5);
    b.endTimedPortion({ endOfStage: false, transit: { exact: false, seconds: L, miles: Math.round(M * 10) / 10 } });
    b.advanceMiles(m1 * 0.5);
    this.instruction({ sign: { text: `${r.pick(TOWN_NAMES)} CITY LIMIT`, shape: 'rect', side: 'R' }, sightDistance: 500 }, {});
    b.advanceMiles(m1 * 0.5);
    b.promotedStop('meal', leadMeal);
    const restMiles = withRest ? 0.4 : 0;
    b.advanceMiles(m2 * 0.5);
    this.instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 600, label: 'side road R' }, { turn: 'R' });
    b.advanceMiles(m2 * 0.5 - restMiles - 0.3);
    if (withRest) { b.promotedStop('rest', 180); b.advanceMiles(restMiles); }
    b.advanceMiles(0.3);
    const base = Math.ceil((tEnd + L) / 60) * 60 - b.opts.asp * 60;
    this.speed = r.pick(TOWN_SPEEDS);
    b.restart(this.speed, base);
    this.tags.push(`lunch:restart:${b.lineCount}:${base}`);
    this.freeZoneFtAfterTransit = Math.ceil(120 * mphToFps(this.speed)) + 400;
  }

  /** "End timed portion" with the end-of-stage TA point, then the exact-time transit to the finish line and its Observation Checkpoint. */
  private emitClosing(): void {
    const b = this.b, r = this.r;
    b.advanceFt(milesToFt(0.25 + 0.3 * r.next()));
    const miles = r.int(80, 160) / 10; const secs = Math.ceil(miles / 30 * 3600 / 60) * 60;
    b.endTimedPortion({ endOfStage: true, transit: { exact: true, seconds: secs, miles } });
    b.advanceMiles(miles * 0.45);
    const d = r.pick(['L', 'R'] as const);
    this.instruction({ exits: EXITS.tee(d), sightDistance: 600, label: 'T' }, { turn: d });
    b.advanceMiles(miles * 0.55 - 0.05);
    b.observationFinish();
  }

  // ---------- leg planning ----------
  private planLeg(nLines: number, o: { firstIsStop: boolean; forceMissingPause: boolean; calmTail: boolean }): Item[] {
    const items: Item[] = [];
    const town = this.townMask(nLines);
    this.legStartSpeed = this.speed;
    let pos = 0, minNextGap = 500, lastInsAt = 0, noTimedWithin = 0, runningDebt = 0;
    this.lastCalmFromAt = -1;
    this.trapsUsedThisLeg.clear(); this.noPauseThisLeg = 0;
    const missingPauseLine = o.forceMissingPause ? this.r.int(Math.max(1, Math.floor(nLines / 3)), Math.max(1, Math.floor(nLines * 0.55))) : -1;
    for (let i = 0; i < nLines; i++) {
      const inTown = town[i]!;
      let gap = inTown ? milesToFt(0.1 + 0.4 * this.r.next()) : milesToFt(0.2 + 2.3 * Math.pow(this.r.next(), 4));
      gap = Math.max(gap, minNextGap);
      // calm lines (no uncompensated losses): the final leg's tail before the last CP, and whenever the modeled debt is already high
      const tail = o.calmTail && i >= Math.floor(nLines * 0.6);
      if (tail && this.lastCalmFromAt < 0) this.lastCalmFromAt = pos + gap;
      const calm = tail || runningDebt > 7;
      let type: LineType = i === 0 && o.firstIsStop ? 'stop' : this.chooseType(inTown);
      if (calm && !['stop', 'speedSign', 'landmarkSpeed', 'straight'].includes(type)) type = this.r.pick(['stop', 'speedSign', 'landmarkSpeed', 'straight'] as const);
      let card: TrapCard | null = null;
      if (type === 'trap') {
        card = this.pickCard(inTown, gap);
        if (card?.shortNotice && minNextGap > 790) card = null; // a short-notice line cannot follow a long timed segment
        if (!card) type = 'stop';
      }
      if (i === missingPauseLine && !tail) { type = 'trap'; card = TRAPS.find(t => t.id === 'missing-pause')!; }
      // a turn word (incl. Straight) is called out 600 ft before its node and would overwrite an earlier pending callout:
      // every line carrying one sits >= 720 ft after the previous instruction node (short-notice cards: 680-790)
      const hasTurn = type === 'stop' || type === 'signal' || type === 'turn' || type === 'straight' || (type === 'trap' && !!card?.turn);
      if (hasTurn) gap = card?.shortNotice ? this.r.int(680, 790) : Math.max(gap, 720);
      // a timed segment never reaches the next leg's / lunch / finish line, and the next timed line waits >= 65 s of cruise
      // after the previous change (the OracleBot reads the sim's previous timed change for 60 s: docs/status/ENGINE-BUGS.md #2)
      if (type === 'timed' && (i === nLines - 1 || gap < noTimedWithin)) type = 'speedSign';
      const built = this.buildLine(type, card, inTown, gap);
      if (!built) { i--; minNextGap = Math.max(minNextGap, gap + 300); continue; }
      gap = built.gap;
      // slow traffic on long rural segments, placed just after the previous instruction node
      let slow: Item['slow'] | undefined;
      if (this.profile.slowTraffic && !inTown && !calm && gap >= 7920 && this.r.chance(0.35) && this.speed >= 40) {
        slow = { at: lastInsAt + 400, speedMph: this.speed - 10, lengthFt: this.r.int(1000, 1600), passWindowAfterFt: 500 };
      }
      // distractors (GEN-006): from the card, or a generic one with trapDensity probability
      const at = pos + gap;
      const d = card ? trapDistractorBefore(card, this.r) : (this.profile.trapDensity > 0 && this.r.chance(this.profile.trapDensity * 0.5) ? this.genericDistractor() : null);
      if (d) {
        const prevAt = pos;
        let before = d.beforeFt;
        const minBefore = d.node.exits?.some(e => !e.isRoute && e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private') ? 650 : 300;
        if (at - before - prevAt < 150) before = at - prevAt - 150;
        if (before >= minBefore && !(slow && at - before < slow.at + slow.lengthFt + 200)) {
          const dn = d.node;
          const cost = dn.control === 'YIELD' ? COST.yield : dn.control === 'BLINKER' ? COST.blinker : COST.none;
          items.push({ at: at - before, node: dn, kind: 'distractor', costAfter: AFTER.plain, needBefore: BEFORE.plain, cost, speedAfter: this.speed, town: inTown });
        }
      }
      const item: Item = { ...built.item, at, slow, speedAfter: built.speedAfter, town: inTown };
      if (item.trapId) { this.tags.push(`trap:${item.trapId}:${this.lineNo + this.countIns(items) + 1}`); }
      items.push(item);
      // speed state
      this.speed = built.speedAfter;
      pos = at; lastInsAt = at;
      runningDebt = this.debtAt(items, at + 1);
      minNextGap = built.minNextGap;
      noTimedWithin = built.item.kind === 'timed' ? built.minNextGap + 65 * mphToFps(built.speedAfter) : 0;
    }
    items.sort((a, b) => a.at - b.at);
    return items;
  }

  private countIns(items: Item[]): number { return items.filter(i => i.ins).length; }

  private townMask(n: number): boolean[] {
    const frac = this.profile.townFraction ?? 0.3;
    const mask = new Array<boolean>(n).fill(false);
    if (frac <= 0) return mask;
    let want = Math.round(n * frac);
    let guard = 0;
    while (want > 0 && guard++ < 10) {
      const size = Math.min(want, this.r.int(5, 8));
      const start = this.r.int(1, Math.max(1, n - size - 1));
      for (let i = start; i < Math.min(n, start + size); i++) if (!mask[i]) { mask[i] = true; want--; }
    }
    return mask;
  }

  private chooseType(town: boolean): LineType {
    const p = this.profile;
    const base: Record<LineType, number> = town
      ? { stop: 32, signal: p.signals ? 22 : 0, turn: 8, speedSign: 17, landmarkSpeed: 4, curveSign: 0, timed: 5, rr: 0, straight: 8, trap: p.trapDensity * 30 }
      : { stop: 22, signal: 0, turn: 12, speedSign: 16, landmarkSpeed: 10, curveSign: 6, timed: 12, rr: p.trains ? 3 : 0, straight: 6, trap: p.trapDensity * 30 };
    const w = { ...base, ...(p.mix ?? {}) };
    if (!p.signals) w.signal = 0;
    if (!p.trains) w.rr = 0;
    const entries = Object.entries(w) as [LineType, number][];
    const total = entries.reduce((s, [, v]) => s + Math.max(0, v), 0);
    let x = this.r.next() * total;
    for (const [k, v] of entries) { x -= Math.max(0, v); if (x < 0 && v > 0) return k; }
    return 'stop';
  }

  private pickCard(town: boolean, gap: number): TrapCard | null {
    const p = this.profile;
    const pool = TRAPS.filter(c =>
      !this.trapsUsedThisLeg.has(c.id) &&
      (c.id !== 'speed-at-signal' || p.signals) && (c.id !== 'rr-crossing' || p.trains) &&
      (c.id !== 'missing-pause' || p.trapDensity >= 0.25 || p.noPauseTraps) &&
      (town || c.id !== 'speed-at-signal') && (!c.shortNotice || gap >= 650));
    if (!pool.length) return null;
    // prefer cards not yet used anywhere in the stage
    const fresh = pool.filter(c => !this.usedTraps.has(c.id));
    return this.r.pick(fresh.length ? fresh : pool);
  }

  private genericDistractor(): { node: NodeSpec; beforeFt: number; why: string } {
    const d = this.r.pick(GENERIC_DISTRACTORS);
    return { node: { ...d.node, exits: d.node.exits?.map(e => ({ ...e })) }, beforeFt: this.r.int(d.minBeforeFt, d.maxBeforeFt), why: d.why };
  }

  private pickSpeed(town: boolean, mustChange: boolean): number {
    const pool = (town ? TOWN_SPEEDS : RURAL_SPEEDS).filter(s => !mustChange || s !== this.speed);
    const near = pool.filter(s => Math.abs(s - this.speed) <= 15);
    return this.r.pick(near.length ? near : pool);
  }

  private hintFor(gap: number, kind: LineType, has: string | undefined): string | undefined {
    if (has) return has;
    if (gap <= 800 && (kind === 'stop' || kind === 'turn' || kind === 'signal')) return 'Comes quick';
    if (!this.r.chance(0.2)) return undefined;
    return this.r.pick(['Look sharp', 'Look sharp', 'Comes quick', 'Follow this Curve Warning Sign']).replace('Comes quick', gap <= 1200 ? 'Comes quick' : 'Look sharp').replace('Follow this Curve Warning Sign', kind === 'curveSign' ? 'Follow this Curve Warning Sign' : 'Look sharp');
  }

  /** Build one line's node/instruction. Returns null when the type cannot fit (caller retries with a longer gap). */
  private buildLine(type: LineType, card: TrapCard | null, town: boolean, gap: number): { item: Omit<Item, 'at' | 'town' | 'speedAfter'>; gap: number; speedAfter: number; minNextGap: number } | null {
    const r = this.r;
    let speedAfter = this.speed;
    let minNextGap = 500;
    switch (type) {
      case 'trap': {
        const c = card!;
        const needsTurnRoom = !!c.turn && c.turn !== 'S';
        if (needsTurnRoom && !c.shortNotice) gap = Math.max(gap, 720);
        const changeSpeed = c.speedChange || r.chance(0.6);
        speedAfter = changeSpeed ? this.pickSpeed(town, c.speedChange ?? false) : this.speed;
        const { node, ins } = trapToNodeSpec(c, { speed: speedAfter });
        ins.hint = this.hintFor(gap, 'trap', ins.hint);
        const ex = c.exits;
        const ang = ex.length ? Math.abs(routeExit(ex)!.angle) : 0;
        const isControl = c.control === 'STOP' || c.control === 'SIGNAL' || c.control === 'RR';
        let cost = changeSpeed ? COST.speed : COST.none;
        if (c.control === 'STOP') cost = c.pause === null ? COST.stopNoPause : COST.stop;
        else if (c.control === 'SIGNAL') cost = this.profile.signals ? COST.signalRed : COST.speed;
        else if (c.control === 'YIELD') cost = COST.yield;
        else if (c.control === 'BLINKER') cost = COST.blinker;
        else if (ang >= 60) cost = COST.turn;
        else if (ang >= 20) cost = COST.bear;
        const item: Omit<Item, 'at' | 'town' | 'speedAfter'> = { node, ins, kind: 'trap', costAfter: isControl ? AFTER.control : changeSpeed ? AFTER.speed : AFTER.plain, needBefore: isControl ? BEFORE.control : BEFORE.plain, cost, trapId: c.id, cpAfterFt: c.cpAfterFt };
        if (c.control === 'SIGNAL' && this.profile.signals) item.signal = this.signalSpec();
        if (c.control === 'RR' && this.profile.trains) { item.train = this.makeTrain(); item.cost = item.train?.hit ? COST.trainHit : COST.speed; }
        if (c.pause === null) this.missingPauses++;
        this.usedTraps.add(c.id); this.trapsUsedThisLeg.add(c.id);
        return { item, gap, speedAfter, minNextGap };
      }
      case 'stop': {
        const dir = r.pick(['L', 'R', 'S', 'S'] as const);
        if (dir !== 'S') gap = Math.max(gap, 720);
        speedAfter = r.chance(0.6) ? this.pickSpeed(town, false) : this.speed;
        const useTee = dir !== 'S' && r.chance(0.4);
        const exits = useTee ? EXITS.tee(dir as 'L' | 'R') : EXITS.crossroads(dir);
        const node: NodeSpec = { control: 'STOP', exits, sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' }, label: useTee ? 'T' : undefined };
        // REG-006: the book prints the 15 s pause on most STOPs (profile.pauseOnStopProbability), not all; the driver stops either way
        // at most two unprinted pauses per leg: the missing seconds are uncompensated by anyone who trusts the ghost, and the checkpoint chooser must be able to find recovery road
        const printPause = this.noPauseThisLeg >= 2 || r.chance(this.profile.pauseOnStopProbability ?? 1);
        if (!printPause) this.noPauseThisLeg++;
        const ins: InsSpec = { turn: dir, pause: printPause ? 15 : undefined, speed: speedAfter, hint: this.hintFor(gap, 'stop', undefined) };
        return { item: { node, ins, kind: 'stop', costAfter: AFTER.control, needBefore: BEFORE.control, cost: printPause ? COST.stop : COST.stopNoPause }, gap, speedAfter, minNextGap };
      }
      case 'signal': {
        const dir = r.pick(['S', 'S', 'L', 'R'] as const);
        if (dir !== 'S') gap = Math.max(gap, 720);
        speedAfter = r.chance(0.7) ? this.pickSpeed(town, false) : this.speed;
        const node: NodeSpec = { control: 'SIGNAL', exits: EXITS.crossroads(dir), sightDistance: 800 };
        const ins: InsSpec = { turn: dir, speed: speedAfter, pause: r.chance(this.profile.pauseOnSignalProbability ?? 0) ? 15 : undefined, hint: this.hintFor(gap, 'signal', undefined) };
        return { item: { node, ins, kind: 'signal', costAfter: AFTER.control, needBefore: BEFORE.control, cost: COST.signalRed, signal: this.signalSpec() }, gap, speedAfter, minNextGap };
      }
      case 'rr': {
        speedAfter = r.chance(0.5) ? this.pickSpeed(town, false) : this.speed;
        const node: NodeSpec = { kind: 'landmark', control: 'RR', sign: { text: 'RR', shape: 'rr', side: 'R' }, sightDistance: 700, label: 'RR crossing' };
        const ins: InsSpec = { speed: speedAfter, hint: this.hintFor(gap, 'rr', undefined) };
        const train = this.makeTrain();
        return { item: { node, ins, kind: 'rr', costAfter: AFTER.control, needBefore: BEFORE.control, cost: train?.hit ? COST.trainHit : COST.speed, train }, gap, speedAfter, minNextGap };
      }
      case 'turn': {
        gap = Math.max(gap, 720);
        const kind = r.pick(['tee', 'wye', 'wye', 'side', 'cross'] as const);
        let exits: Exit[]; let turn: TurnDir; let label: string | undefined;
        if (kind === 'tee') { const d = r.pick(['L', 'R'] as const); exits = EXITS.tee(d); turn = d; label = 'T'; }
        else if (kind === 'wye') { const d = r.pick(['BL', 'BR'] as const); exits = EXITS.wye(d); turn = d; label = 'Y'; }
        else if (kind === 'side') { const d = r.pick(['L', 'R'] as const); exits = EXITS.sideRoad(d, { route: 'turn' }); turn = d; label = `side road ${d}`; }
        else { const d = r.pick(['L', 'R'] as const); exits = EXITS.crossroads(d); turn = d; label = 'crossroads'; }
        speedAfter = r.chance(0.5) ? this.pickSpeed(town, false) : this.speed;
        const node: NodeSpec = { exits, sightDistance: 600, label };
        const ins: InsSpec = { turn, speed: speedAfter, hint: this.hintFor(gap, 'turn', undefined) };
        const ang = Math.abs(routeExit(exits)!.angle);
        return { item: { node, ins, kind: 'turn', costAfter: AFTER.plain, needBefore: BEFORE.plain, cost: ang >= 60 ? COST.turn : COST.bear }, gap, speedAfter, minNextGap };
      }
      case 'speedSign': {
        speedAfter = this.pickSpeed(town, true);
        const s0 = town && r.chance(0.5) ? { text: `${r.pick(TOWN_NAMES)} CITY LIMIT`, shape: 'rect' as const } : r.pick(SIGN_TEXTS);
        const s = s0.text.startsWith('SPEED LIMIT') ? { text: `SPEED LIMIT ${speedAfter}`, shape: s0.shape } : s0; // a posted limit is never below the assigned speed
        const node: NodeSpec = { sign: { text: s.text, shape: s.shape, side: r.chance(0.8) ? 'R' : 'L' }, sightDistance: 500 };
        const ins: InsSpec = { speed: speedAfter, hint: this.hintFor(gap, 'speedSign', undefined) };
        return { item: { node, ins, kind: 'speedSign', costAfter: AFTER.speed, needBefore: BEFORE.plain, cost: COST.speed }, gap, speedAfter, minNextGap };
      }
      case 'curveSign': {
        speedAfter = this.pickSpeed(town, true);
        const node: NodeSpec = { sign: { text: 'CURVE', shape: 'diamond', side: 'R' }, sightDistance: r.chance(0.3) ? 200 : 500 };
        const ins: InsSpec = { speed: speedAfter, hint: r.chance(0.6) ? 'Follow this Curve Warning Sign' : this.hintFor(gap, 'curveSign', undefined) };
        return { item: { node, ins, kind: 'curveSign', costAfter: AFTER.speed, needBefore: BEFORE.plain, cost: COST.speed }, gap, speedAfter, minNextGap };
      }
      case 'landmarkSpeed': {
        speedAfter = this.pickSpeed(town, true);
        const lm = r.pick(LANDMARKS);
        const node: NodeSpec = { label: lm, sightDistance: 500 };
        const ins: InsSpec = { speed: speedAfter, hint: this.hintFor(gap, 'landmarkSpeed', undefined) };
        return { item: { node, ins, kind: 'landmarkSpeed', costAfter: AFTER.speed, needBefore: BEFORE.plain, cost: COST.speed }, gap, speedAfter, minNextGap };
      }
      case 'timed': {
        const hold = this.pickSpeed(town, true);
        const then = this.pickSpeedExcept(town, hold);
        const seconds = town ? r.int(20, 40) : r.int(20, 90);
        const reach = mphToFps(hold) * seconds;
        minNextGap = Math.ceil(reach + 350);
        speedAfter = then;
        const lm = r.pick(LANDMARKS);
        const node: NodeSpec = { label: lm, sightDistance: 500 };
        const timed = { holdSpeed: hold, seconds, thenSpeed: then };
        const ins: InsSpec = { timed, speed: hold, hint: this.hintFor(gap, 'timed', undefined) };
        return { item: { node, ins, kind: 'timed', costAfter: Math.ceil(reach) + 600, needBefore: BEFORE.plain, cost: COST.timed }, gap, speedAfter, minNextGap };
      }
      case 'straight': {
        speedAfter = r.chance(0.5) ? this.pickSpeed(town, false) : this.speed;
        const side = r.pick(['L', 'R', 'X'] as const);
        const exits = side === 'X' ? EXITS.crossroads('S') : EXITS.sideRoad(side);
        const node: NodeSpec = { exits, sightDistance: 600, label: side === 'X' ? 'crossroads' : `side road ${side}` };
        const ins: InsSpec = { turn: 'S', speed: speedAfter, hint: this.hintFor(gap, 'straight', undefined) };
        return { item: { node, ins, kind: 'straight', costAfter: speedAfter !== this.speed ? AFTER.speed : AFTER.plain, needBefore: BEFORE.plain, cost: speedAfter !== this.speed ? COST.speed : COST.none }, gap, speedAfter, minNextGap };
      }
    }
    return null;
  }

  private pickSpeedExcept(town: boolean, except: number): number {
    const pool = (town ? TOWN_SPEEDS : RURAL_SPEEDS).filter(s => s !== except && Math.abs(s - except) <= 15);
    return this.r.pick(pool.length ? pool : SPEEDS.filter(s => s !== except));
  }

  private signalSpec(): Item['signal'] {
    const red = this.r.int(30, 45), green = this.r.int(40, 60);
    return { redSeconds: red, greenSeconds: green, offset: this.r.int(0, red + green - 1) };
  }

  // ---------- checkpoint placement (GEN-005 / GEN-007) ----------
  private chooseCheckpoint(items: Item[], lastLeg: boolean, minX = 0): CpChoice {
    const ins = items.filter(i => i.ins);
    const last = ins[ins.length - 1]!;
    const ok = (x: number): boolean => {
      for (const it of items) {
        if (it.at <= x) { if (x - it.at < it.costAfter) return false; }
        else if (it.at - x < it.needBefore) return false;
        if (it.slow && x > it.slow.at && x < it.slow.at + it.slow.lengthFt + 300) return false;
      }
      // SIM-021: the sim ends 30 min after the last perfect CP time, so the final CP sits in the tail of the last leg
      if (lastLeg && (last.at - x > 8 * FT_MI || x < this.lastCalmFromAt + 600)) return false;
      return x >= Math.max(600, minX) && this.debtAt(items, x) <= MAX_DEBT_AT_CP;
    };
    const nextAfter = (it: Item): number => items.find(j => j.at > it.at)?.at ?? last.at;
    const sample = (lo: number, hi: number): number | null => {
      if (hi - lo < 50) return null;
      for (let k = 0; k < 14; k++) { const x = lo + this.r.next() * (hi - lo); if (ok(x)) return Math.round(x); }
      return null;
    };
    const afterStop: CpChoice[] = []; const afterSpeed: CpChoice[] = [];
    for (const it of ins) {
      if (it === last) break;
      const nx = nextAfter(it);
      if (it.node.control === 'STOP' && it.ins?.pause) {
        const [lo, hi] = it.cpAfterFt ?? [500, 1500];
        const x = sample(it.at + lo, Math.min(it.at + hi, nx - BEFORE.control));
        if (x !== null) afterStop.push({ at: x, mode: 'afterStop', anchorKind: 'STOP' });
      } else if ((it.kind === 'speedSign' || it.kind === 'landmarkSpeed' || it.kind === 'curveSign' || (it.kind === 'straight' && it.costAfter === AFTER.speed)) && it.ins?.speed !== undefined) {
        const x = sample(it.at + 300, Math.min(it.at + 2100, nx - BEFORE.control));
        if (x !== null) afterSpeed.push({ at: x, mode: 'afterSpeed', anchorKind: 'speed change' });
      }
    }
    const open: CpChoice[] = [];
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i]!, b = items[i + 1]!;
      if (b.at - a.at < 1500) continue;
      const x = sample(a.at + 600, b.at - b.needBefore);
      if (x !== null) open.push({ at: x, mode: 'open' });
    }
    // force one "CP right after a STOP" per stage (GEN-007); otherwise ~55 % inopportune placements
    const inopportune = [...afterStop, ...afterSpeed];
    let choice: CpChoice | undefined;
    if (afterStop.length && !this.afterStopPlaced && (lastLeg || this.forceAfterStop || this.r.chance(0.5))) choice = this.r.pick(afterStop);
    else if (inopportune.length && this.r.chance(0.55)) choice = this.r.pick(inopportune);
    else if (open.length) choice = this.r.pick(open);
    else if (inopportune.length) choice = this.r.pick(inopportune);
    if (!choice) {
      // best effort: scan every geometrically legal position and take the one the oracle reaches with the least debt
      const geomOk = (x: number): boolean => {
        for (const it of items) {
          if (it.at <= x) { if (x - it.at < it.costAfter) return false; }
          else if (it.at - x < it.needBefore) return false;
          if (it.slow && x > it.slow.at && x < it.slow.at + it.slow.lengthFt + 300) return false;
        }
        return x >= minX && !(lastLeg && (last.at - x > 8 * FT_MI || x < this.lastCalmFromAt + 600));
      };
      let bestX = -1, bestDebt = Infinity;
      for (let x = 600; x < last.at - BEFORE.control; x += 100) { if (!geomOk(x)) continue; const d = this.debtAt(items, x); if (d < bestDebt - 1e-9 || (lastLeg && d <= bestDebt + 0.1)) { bestDebt = d; bestX = x; } }
      if (bestX < 0) { const b2 = items[items.length - 2]; bestX = Math.round(b2 ? Math.max(b2.at + Math.max(b2.costAfter, 600), last.at - last.needBefore - 50) : last.at - 600); }
      choice = { at: bestX, mode: 'open' };
      this.tags.push(`cp:cp${this.cpNo + 1}:bestEffort:${bestDebt.toFixed(1)}`);
    }
    if (choice.mode === 'afterStop') this.afterStopPlaced = true;
    this.tags.push(`cp:cp${this.cpNo + 1}:debt:${this.debtAt(items, choice.at).toFixed(1)}`);
    return choice;
  }

  /** Uncompensated seconds the oracle still carries when it reaches `x` (costs minus recovery room, never negative). */
  private debtAt(items: Item[], x: number): number {
    type Ev = { at: number; cost: number; ins: boolean; speedAfter?: number };
    const evs: Ev[] = [];
    for (const it of [...this.carry, ...items]) {
      if (it.at >= x) continue;
      evs.push({ at: it.at, cost: it.cost, ins: !!it.ins, speedAfter: it.ins ? it.speedAfter : undefined });
      if (it.slow) {
        const v = it.slow.speedMph, v0 = Math.max(v + 1, this.speedBefore(items, it));
        evs.push({ at: it.slow.at + it.slow.lengthFt, cost: it.slow.lengthFt * (1 / mphToFps(v) - 1 / mphToFps(v0)), ins: false });
      }
    }
    evs.sort((a, b) => a.at - b.at);
    let debt = 0, speed = this.carry.length ? this.carrySpeed : this.legStartSpeed;
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k]!; const next = evs[k + 1];
      debt += e.cost;
      if (e.speedAfter !== undefined) speed = e.speedAfter;
      const end = next ? Math.min(next.at, x) : x;
      const zone = !next || next.ins ? 900 : 0;
      const usable = Math.max(0, end - e.at - zone - 200);
      debt = Math.max(0, debt - usable * recoveryPerFt(speed, debt));
    }
    return debt;
  }
  private speedBefore(items: Item[], it: Item): number {
    let v = this.carry.length ? this.carrySpeed : this.legStartSpeed;
    for (const j of [...this.carry, ...items]) { if (j.at >= it.at) break; if (j.ins) v = j.speedAfter; }
    return v;
  }
  private carrySpeed = 35;
  private lastCalmFromAt = -1;
  private legStartSpeed = 35;
  /** Items of the previous plan that lie after its checkpoint (re-based to this leg's start, at <= 0): same timing leg. */
  private carry: Item[] = [];

  // ---------- emission ----------
  private emitLeg(items: Item[], cp: CpChoice): void {
    const b = this.b;
    const legStart = b.position;
    let prevAt = 0, cpDone = false;
    for (const it of items) {
      if (!cpDone && cp.at <= it.at) { b.advanceFt(cp.at - prevAt); prevAt = cp.at; this.emitCheckpoint(cp, items); cpDone = true; }
      if (it.slow) b.hazard({ kind: 'slow', s: legStart + it.slow.at, speedMph: it.slow.speedMph, lengthFt: it.slow.lengthFt, passWindowAfterFt: it.slow.passWindowAfterFt });
      b.advanceFt(it.at - prevAt); prevAt = it.at;
      if (it.ins) {
        this.instruction(it.node, it.ins);
        if (it.node.control === 'STOP' && it.ins.pause === undefined) this.tags.push(it.trapId === 'missing-pause' ? `trap:missingPause:${this.lineNo}` : `stop:noPause:${this.lineNo}`);
      } else b.node(it.node);
      if (it.signal) b.hazard({ kind: 'signal', redSeconds: it.signal.redSeconds, greenSeconds: it.signal.greenSeconds, offset: it.signal.offset });
      if (it.train) {
        // ~50 % of oracle arrivals meet the train: it either started 20 s before the ghost arrives or cleared 25 s before
        const g = buildGhost(b.build());
        const t = ghostTimeAt(g, b.position);
        const hit = it.train.hit;
        b.hazard({ kind: 'train', startTod: hit ? t - 20 : t - it.train.durationSeconds - 25, durationSeconds: it.train.durationSeconds });
        this.tags.push(`train:${this.lineNo}:${hit ? 'hit' : 'miss'}`);
      }
    }
    if (!cpDone) { b.advanceFt(cp.at - prevAt); this.emitCheckpoint(cp, items); }
  }

  private emitCheckpoint(cp: CpChoice, items: Item[]): void {
    this.b.checkpoint('timing', 400);
    this.cpNo++;
    if (cp.mode !== 'open') this.tags.push(`cp:cp${this.cpNo}:afterManeuver:${cp.anchorKind}`);
    // also tag turns/signals within 0.4 mi before (statistics for GEN-007)
    const prev = items.filter(i => i.ins && i.at <= cp.at && cp.at - i.at <= 0.4 * FT_MI);
    if (cp.mode === 'open' && prev.some(i => i.ins?.turn && i.ins.turn !== 'S' || i.node.control === 'SIGNAL')) this.tags.push(`cp:cp${this.cpNo}:afterManeuver:turn`);
  }

  private instruction(node: NodeSpec, ins: InsSpec): void { this.b.instruction(node, ins); }
}

function fmtT(sec0: number): string { const sec = Math.round(sec0); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

/** GEN-008 self-check: one route exit per intersection, consistent with the callout band or the main-road rule. */
export function checkRouteExits(sc: Scenario, rule: 'pavement-first' | 'straight-as-possible' = 'pavement-first'): string[] {
  const out: string[] = [];
  const insByNode = new Map(sc.book.map(i => [i.nodeId, i] as const));
  for (const n of sc.course.nodes) {
    if (n.kind !== 'intersection' || !n.exits) continue;
    const routes = n.exits.filter(e => e.isRoute);
    if (routes.length !== 1) { out.push(`${n.id}: ${routes.length} route exits`); continue; }
    const ins = insByNode.get(n.id);
    const taken = ins?.turn ? exitForCallout(n.exits, ins.turn, rule) : mainRoadExit(n.exits, rule);
    if (!taken.isRoute) out.push(`${n.id}: driver would take angle ${taken.angle} (${ins?.turn ?? 'main road'})`);
    if (!ins?.turn && !n.exits.some(e => Math.abs(e.angle) < 20 && e.kind === 'road') && !(ins && !ins.turn && mainRoadExit(n.exits, rule).isRoute && n.control === 'none' && ins.text.includes('Main Road'))) {
      if (!ins) out.push(`${n.id}: distractor without a straight road`);
    }
  }
  return out;
}

/** One leg (one timing CP) from the profile; calibration/lunch only when the profile asks. */
export function generateLeg(seed: number, profile: GenProfile = PROFILES.fullLeg): Scenario {
  return new Generator(seed, { ...profile, lunchRestart: false }, 'leg').build();
}

/** A full stage: calibration, N legs, lunch restart, finish with observation CP (GEN-002). */
export function generateStage(seed: number, profile: GenProfile = PROFILES.fullStage): Scenario {
  return new Generator(seed, profile, 'stage').build();
}

/** Section a checkpoint sits in: the section of the last instruction at or before it. */
export function sectionAt(sc: Scenario, s: number): Section | undefined {
  let sec: Section | undefined;
  for (const ins of sc.book) { const ns = nodeById(sc.course, ins.nodeId).s; if (ns > s) break; sec = ins.section; }
  return sec;
}

export type { Control };


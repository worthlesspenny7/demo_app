/** Fluent builder for scenarios (used by tests, drills and the generator). */
import {
  type Scenario, type Node, type Instruction, type Exit, type Control, type TurnDir, type Checkpoint, type Hazard,
  type CarSpec, type SpeedoSpec, type DriverSpec, type RulesConfig, type AidsConfig, type Section, type Sign, type TimedSegment, type TransitSpec, type TimeZoneLabel,
  DEFAULT_RULES, TRAINING_AIDS, FORD_1939, DRIVER_EXPERT,
} from './course.js';
import { annotatePerfectTimes } from './ghost.js';
import { formatClockFace, formatInterval } from './griid.js';
import { milesToFt, mphToFps } from './units.js';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export const PERFECT_TIMEWISE: SpeedoSpec = { kind: 'timewise', gain: 1, offset: 0, quad: 0, tau: 0.3, bounce: 0 };
export const STOCK_1939_SPEEDO: SpeedoSpec = { kind: 'mechanical', gain: 1.03, offset: 1.0, quad: 0.0003, tau: 1.0, bounce: 0.7 };

export interface NodeSpec {
  kind?: Node['kind'];
  control?: Control;
  exits?: Exit[];
  sign?: Sign;
  sightDistance?: number;
  stopLineOffset?: number;
  label?: string;
}
export interface InsSpec {
  text?: string;
  section?: Section;
  turn?: TurnDir;
  speed?: number;
  pause?: number;
  timed?: TimedSegment;
  /** Column D remark ("Comes quick"); `hint` is the legacy name for the same thing. */
  hint?: string;
  remark?: string;
  restartTime?: number;
  baseTime?: number;
  transit?: TransitSpec;
  transitGuide?: number;
  freeZone?: 'begin' | 'end';
  endTimed?: boolean;
  taPoint?: { windowSeconds: number; endOfStage: boolean };
  promotedStop?: { kind: 'pit' | 'meal' | 'refuel' | 'rest'; leaveBeforeEndSeconds: number };
  calibrationStart?: boolean;
  /** GRIID-005: lettered row label ("3a") and omitted rows (kept in the numbering, never executed). */
  printed?: string;
  omitted?: boolean;
}

export interface BuilderOptions {
  id?: string; name?: string; seed?: number;
  /** Printed base start time of day; the team's own start is base + asp minutes. */
  startTime?: number;
  /** Assigned starting position in minutes (STAGE-002). */
  asp?: number; timeZone?: TimeZoneLabel; bookStyle?: 'example' | 'race';
  car?: CarSpec; speedo?: SpeedoSpec; driver?: DriverSpec; rules?: Partial<RulesConfig>; aids?: AidsConfig;
  prereadSeconds?: number; excursionFt?: number; tags?: string[]; trafficWaitProbability?: number;
}

/** Standard exits for common intersections (angle: negative = left). */
export const EXITS = {
  straightRoad(): Exit[] { return [{ angle: 0, surface: 'paved', kind: 'road', isRoute: true }]; },
  /** Four-way; route goes `dir`. */
  crossroads(dir: 'L' | 'R' | 'S', opts: { sideControl?: Control } = {}): Exit[] {
    return [
      { angle: -90, surface: 'paved', kind: 'road', isRoute: dir === 'L', controlOnExit: opts.sideControl },
      { angle: 0, surface: 'paved', kind: 'road', isRoute: dir === 'S' },
      { angle: 90, surface: 'paved', kind: 'road', isRoute: dir === 'R', controlOnExit: opts.sideControl },
    ];
  },
  /** T: our road ends; route goes L or R. */
  tee(dir: 'L' | 'R'): Exit[] {
    return [
      { angle: -90, surface: 'paved', kind: 'road', isRoute: dir === 'L' },
      { angle: 90, surface: 'paved', kind: 'road', isRoute: dir === 'R' },
    ];
  },
  /** Side road joins from one side; route continues straight unless dir given. */
  sideRoad(side: 'L' | 'R', opts: { route?: 'S' | 'turn'; surface?: 'paved' | 'gravel'; kind?: Exit['kind']; name?: string; control?: Control } = {}): Exit[] {
    const turn = opts.route === 'turn';
    return [
      { angle: 0, surface: 'paved', kind: 'road', isRoute: !turn },
      { angle: side === 'L' ? -90 : 90, surface: opts.surface ?? 'paved', kind: opts.kind ?? 'road', isRoute: turn, name: opts.name, controlOnExit: opts.control },
    ];
  },
  /** Y fork; route bears L or R. */
  wye(dir: 'BL' | 'BR'): Exit[] {
    return [
      { angle: -35, surface: 'paved', kind: 'road', isRoute: dir === 'BL' },
      { angle: 35, surface: 'paved', kind: 'road', isRoute: dir === 'BR' },
    ];
  },
};

// ---------- GRIID-004 wording ----------

export interface DescribeCtx {
  /** Assigned speed in force before this line (for "Continue previous average speed ..."). */
  prevSpeed?: number;
  /** Instruction number of the exact transit's begin line (for "Leave this point 20 minutes after instruction #31"). */
  transitBeginN?: number;
  /** Seconds of the exact transit being ended. */
  transitSeconds?: number;
  /** Official calibration time (seconds) quoted on the calibration lines. */
  calibrationOfficialSeconds?: number;
}

const CONTROL_WORD: Record<Control, string> = { STOP: 'Stop Sign', SIGNAL: 'Traffic Light', BLINKER: 'Blinker', YIELD: 'Yield Sign', RR: 'Railroad Crossing', none: '' };
const TURN_VERB: Record<TurnDir, string> = { L: 'Turn left', R: 'Turn right', S: 'Go straight', BL: 'Bear left', BR: 'Bear right', AL: 'Make an acute left turn', AR: 'Make an acute right turn', JL: 'Jog left', JR: 'Jog right' };

/** "20 minutes", "3 hours 25 minutes", "45 seconds". */
export function intervalWords(sec0: number): string {
  const sec = Math.round(sec0); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s && !h) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 seconds';
}
function shapeOf(node: NodeSpec): string | undefined {
  const ex = node.exits; if (!ex || !ex.length) return undefined;
  if (ex.length === 1) return undefined;
  const big = ex.filter(e => Math.abs(e.angle) >= 60).length, small = ex.filter(e => Math.abs(e.angle) < 20).length;
  if (ex.length >= 3) return small ? 'crossroad' : 'junction';
  if (ex.length === 2 && big === 2) return 'T';
  if (ex.length === 2 && small === 1 && big === 1) return 'sideroad';
  if (ex.length === 2 && big === 0) return 'Y';
  return 'junction';
}
function transitSentence(t: TransitSpec): string {
  const mi = t.miles !== undefined ? `approximately ${t.miles % 1 === 0 ? t.miles : t.miles.toFixed(1)} miles` : 'approximately ?? miles';
  return t.exact ? `Begin Transit of ${mi}; take exactly ${intervalWords(t.seconds)} to complete the Transit.` : `Begin Transit of ${mi}; take approximately ${intervalWords(t.seconds)} to complete the Transit.`;
}

/** The written instruction of Column D (GRIID-004), in the wording of the Example Rally. */
export function describeInstruction(spec: InsSpec, node: NodeSpec, ctx: DescribeCtx = {}): string {
  const parts: string[] = [];
  const routeName = node.exits?.find(e => e.isRoute)?.name;
  const ctrl = node.control && node.control !== 'none' ? CONTROL_WORD[node.control] : undefined;
  const shape = shapeOf(node);
  const mphWords = (v: number): string => `${v} miles per hour`;
  // where a speed change takes effect (GRIID-007)
  const where = node.sign ? 'at the referenced sign' : ctrl ? `at the referenced ${ctrl}` : node.exits && node.exits.length ? 'at the apex of the intersection (since there is no referenced sign)' : node.label ? 'at the referenced landmark' : 'at this point';
  const isStart = spec.section === 'start';
  if (isStart && spec.restartTime !== undefined) parts.push(`Leave here at ${formatClockFace(spec.baseTime ?? spec.restartTime)} plus your assigned start position in minutes.`);
  if (spec.section === 'restart' && spec.restartTime !== undefined) {
    parts.push(`${spec.transit?.end ? 'End Transit at the referenced sign. ' : ''}Time-of-day restart. Leave this point at ${formatClockFace(spec.baseTime ?? spec.restartTime)} plus your assigned start position in minutes.`);
  } else if (spec.transit?.end && !spec.transit.exact) parts.push(`End Transit ${where}.`);
  else if (spec.transit?.end && spec.transit.exact) parts.push(`End Transit at the referenced sign. Leave this point ${intervalWords(ctx.transitSeconds ?? spec.transit.seconds)} after instruction #${ctx.transitBeginN ?? '?'}.`);
  if (spec.promotedStop) {
    const k = spec.promotedStop; const lead = intervalWords(k.leaveBeforeEndSeconds);
    parts.push(k.kind === 'meal' ? `Hosted meal stop (usually lunch). After lunch, leave here ${lead} prior to your end-of-transit time. (Meal stops always occur within Transits, and the time given is included in the specified transit time.)`
      : k.kind === 'refuel' ? `Refueling stop. Leave here ${lead} prior to your end-of-transit time.`
      : k.kind === 'pit' ? `Hosted Pit stop; leave here ${lead} prior to your end-of-transit time.`
      : `Rest Stop. Leave here ${lead} prior to your end-of-transit time.`);
  }
  if (spec.calibrationStart) parts.push(`End Tire Warm-up. Begin Speedometer Calibration Run${spec.transit?.miles !== undefined ? ` of approximately ${spec.transit.miles % 1 === 0 ? spec.transit.miles : spec.transit.miles.toFixed(1)} miles` : ''}; the transit time is ${intervalWords(spec.transit?.seconds ?? 0)}. Start your stopwatch here.`);
  else if (spec.section === 'calibration') parts.push(node.sign ? `Calibration point at the referenced sign: your time from the previous point is in Column C.` : `Calibration point at the referenced landmark: your time from the previous point is in Column C.`);
  if (spec.endTimed) parts.push('End timed portion. The timed portion of the stage resumes at the next restart, if there is one; otherwise, this is the end of the timed portion of the stage.');
  if (spec.taPoint) {
    const w = formatInterval(spec.taPoint.windowSeconds);
    parts.push(spec.taPoint.endOfStage
      ? `Within ${w}, submit your Time Allowance request(s) for this afternoon's run, if any. Then, whether or not you submitted any Time Allowances today, acknowledge your scorecard so that it can be printed.`
      : `Within ${w}, submit your Time Allowance request(s) for this morning's run, if any. If you have no Time Allowances, no action is required at this time.`);
  }
  if (spec.section === 'finish') parts.push('Finish Line. End Stage. Stop at Observation Checkpoint.');
  // route / reference sentence
  if (!spec.promotedStop && !spec.taPoint && spec.section !== 'finish' && !spec.calibrationStart && spec.section !== 'calibration' && !spec.endTimed && !spec.transit && spec.section !== 'restart' && !(isStart && !spec.turn)) {
    if (spec.turn) {
      const bearAtY = (spec.turn === 'BL' || spec.turn === 'BR') && shape === 'Y'; // "Bear right onto Interstate 75 North." (Example Rally #8)
      const at = `${shape && !bearAtY ? ` at a ${shape}` : ''}${ctrl ? ` at a ${ctrl}` : ''}`;
      if (spec.turn === 'S') parts.push(`${routeName ? `Go straight to cross ${routeName}` : 'Go straight'}${at}.`);
      else parts.push(`${TURN_VERB[spec.turn]}${routeName ? ` onto ${routeName}` : ''}${at}.`);
    } else if (node.sign) parts.push(`Pass a sign on your ${node.sign.side === 'L' ? 'left' : 'right'} reading in whole or in part '${node.sign.text}'.`);
    else if (node.control === 'RR') parts.push('Grade level Railroad Crossing.');
    else if (ctrl) parts.push(`Cross${routeName ? ` ${routeName}` : ''} at a ${ctrl}.`);
    else if (node.label) parts.push(`Pass the ${node.label}.`);
  }
  // pause, speed, timed
  const hasPause = spec.pause !== undefined && spec.pause > 0;
  if (spec.timed) {
    const t = spec.timed; const iv = intervalWords(t.seconds);
    if (t.delayed) parts.push(`${hasPause ? `Pause ${spec.pause} seconds, then continue` : 'Continue'} at the previous average speed (in this case ${mphWords(t.holdSpeed)}) for ${iv}, then change average speed to ${mphWords(t.thenSpeed)}.`);
    else parts.push(`${hasPause ? `Pause ${spec.pause} seconds, then begin` : 'Begin'} average speed of ${mphWords(t.holdSpeed)} ${hasPause ? '' : where}${hasPause ? '' : ' '}for ${iv}, then change average speed to ${mphWords(t.thenSpeed)}.`.replace(/\s+/g, ' '));
  } else if (spec.speed !== undefined && !spec.transit) {
    if (spec.section === 'restart' || isStart) parts.push(`Begin average speed of ${mphWords(spec.speed)}.`);
    else if (hasPause) parts.push(`Pause ${spec.pause} seconds, then change average speed to ${mphWords(spec.speed)}.`);
    else if (spec.speed === ctx.prevSpeed) parts.push(`Continue average speed of ${mphWords(spec.speed)}.`);
    else parts.push(`Change average speed to ${mphWords(spec.speed)} ${where}.`);
  } else if (hasPause) {
    parts.push(ctx.prevSpeed !== undefined ? `Pause ${spec.pause} seconds, then continue the previous average speed (in this case ${mphWords(ctx.prevSpeed)}).` : `Pause ${spec.pause} seconds.`);
  } else if (spec.speed === undefined && !spec.timed && node.control === 'RR' && ctx.prevSpeed !== undefined && !spec.transit) {
    parts.push(`Continue previous average speed (in this case ${mphWords(ctx.prevSpeed)}) since no speed is given.`);
  }
  if (spec.speed !== undefined && spec.transit && !spec.calibrationStart && spec.section !== 'calibration') parts.push(`Begin average speed of ${mphWords(spec.speed)}.`);
  if (spec.calibrationStart && spec.speed !== undefined) parts.push(`Begin average speed of ${mphWords(spec.speed)}.`);
  if (spec.transit && !spec.transit.end && !spec.calibrationStart && !isStart) parts.push(transitSentence(spec.transit));
  if (isStart && spec.transit) parts.push(`Begin Tire Warm-up (a transit of ${spec.transit.miles !== undefined ? `approximately ${spec.transit.miles % 1 === 0 ? spec.transit.miles : spec.transit.miles.toFixed(1)} miles` : 'approximately ?? miles'}); take ${spec.transit.exact ? 'exactly' : 'approximately'} ${intervalWords(spec.transit.seconds)}.`);
  if (spec.freeZone === 'begin') parts.push('Begin Free Zone.');
  if (spec.freeZone === 'end') parts.push('End Free Zone.');
  return parts.join(' ').replace(/\s+/g, ' ').trim() || 'Continue.';
}

interface Meta { spec: InsSpec; node: NodeSpec; ctx: DescribeCtx; customText: boolean }

export class ScenarioBuilder {
  private nodes: Node[] = [];
  private book: Instruction[] = [];
  private meta: Meta[] = [];
  private checkpoints: Checkpoint[] = [];
  private hazards: Hazard[] = [];
  private s = 0;
  private nid = 0;
  private cpid = 0;
  private trafficWaitProbability: number;
  /** Assigned speed in force after the last instruction (for wording and delayed changes). */
  private curSpeed: number | undefined;
  /** Section applied to instructions that give none (warm-up, calibration, transit). */
  private sectionDefault: Section | undefined;
  private openTransit: { idx: number; s: number } | null = null;
  /** Official calibration time (rounded up to the minute) and the transit allowance printed on the begin line, once calibrationRun() has been called. */
  calibrationInfo: { officialSeconds: number; allowanceSeconds: number } | null = null;
  readonly opts: Required<Pick<BuilderOptions, 'id' | 'name' | 'seed' | 'startTime' | 'car' | 'speedo' | 'driver' | 'aids' | 'prereadSeconds' | 'excursionFt' | 'asp' | 'timeZone' | 'bookStyle'>> & { rules: RulesConfig; tags: string[] };

  constructor(o: BuilderOptions = {}) {
    const aids = o.aids ?? TRAINING_AIDS;
    this.opts = {
      id: o.id ?? 'scenario', name: o.name ?? 'Scenario', seed: o.seed ?? 1, startTime: o.startTime ?? 8 * 3600,
      car: o.car ?? FORD_1939, speedo: o.speedo ?? PERFECT_TIMEWISE, driver: o.driver ?? DRIVER_EXPERT,
      rules: { ...DEFAULT_RULES, ...(o.rules ?? {}) }, aids, prereadSeconds: o.prereadSeconds ?? 30,
      excursionFt: o.excursionFt ?? 2640, tags: o.tags ?? [], asp: o.asp ?? 0, timeZone: o.timeZone ?? 'CDT', bookStyle: o.bookStyle ?? (aids.rung >= 2 ? 'example' : 'race'),
    };
    this.trafficWaitProbability = o.trafficWaitProbability ?? 0;
  }

  get position(): number { return this.s; }
  /** Number of instruction lines added so far. */
  get lineCount(): number { return this.book.length; }
  /** Assigned speed in force after the last instruction. */
  get currentSpeed(): number | undefined { return this.curSpeed; }
  /** The team's own start time: printed base + ASP minutes. */
  get teamStartTime(): number { return this.opts.startTime + this.opts.asp * 60; }
  advanceMiles(mi: number): this { this.s += milesToFt(mi); return this; }
  advanceFt(ft: number): this { this.s += ft; return this; }

  /** Time of day a restart printed at `baseTod` means for this team (STAGE-002). */
  restartTimeFor(baseTod: number): number { return baseTod + this.opts.asp * 60; }

  /** Start line at the current position (normally 0). `speed` may be omitted when a warm-up transit follows (STAGE-001). */
  start(speed?: number, opts: { restartTime?: number; text?: string } = {}): this {
    const restartTime = opts.restartTime ?? this.teamStartTime;
    return this.instruction({ kind: 'start', control: 'none', sightDistance: 300, label: 'Start banner' }, { section: 'start', speed, restartTime, baseTime: opts.restartTime === undefined ? this.opts.startTime : undefined, text: opts.text });
  }

  node(spec: NodeSpec): string {
    const id = `n${++this.nid}`;
    this.nodes.push({ id, s: this.s, kind: spec.kind ?? (spec.exits ? 'intersection' : spec.sign ? 'sign' : 'landmark'), control: spec.control ?? 'none', exits: spec.exits, sign: spec.sign, sightDistance: spec.sightDistance ?? 600, stopLineOffset: spec.stopLineOffset, label: spec.label });
    return id;
  }

  /** Add a node at the current position with an instruction bound to it. */
  instruction(node: NodeSpec, ins0: InsSpec): this {
    const ins: InsSpec = ins0.omitted ? { section: ins0.section, omitted: true, printed: ins0.printed, text: ins0.text ?? 'Omitted.' } : ins0;
    const id = this.node(ins0.omitted ? { ...node, exits: undefined, control: 'none', sign: undefined } : node);
    const n = this.book.length + 1;
    const section = ins.section ?? this.sectionDefault;
    const remark = ins.remark ?? ins.hint;
    const spec: InsSpec = { ...ins, section };
    const exact = this.openTransit ? this.book[this.openTransit.idx]!.transit : undefined;
    const ctx: DescribeCtx = { prevSpeed: this.curSpeed, transitBeginN: exact?.exact ? this.book[this.openTransit!.idx]!.n : undefined, transitSeconds: exact?.seconds };
    const text = ins.text ?? describeInstruction(spec, node, ctx);
    this.book.push({
      n, nodeId: id, text, section, turn: ins.turn, speed: ins.speed, pause: ins.pause, timed: ins.timed, hint: remark, remark, restartTime: ins.restartTime, baseTime: ins.baseTime,
      transit: ins.transit, ...(ins.transitGuide !== undefined ? { transitGuide: ins.transitGuide } : {}), freeZone: ins.freeZone, endTimed: ins.endTimed, taPoint: ins.taPoint, promotedStop: ins.promotedStop, calibrationStart: ins.calibrationStart,
      ...(ins.printed ? { printed: ins.printed } : {}), ...(ins.omitted ? { omitted: true } : {}),
    });
    this.meta.push({ spec, node, ctx, customText: ins.text !== undefined });
    if (ins.timed) this.curSpeed = ins.timed.thenSpeed; else if (ins.speed !== undefined) this.curSpeed = ins.speed;
    return this;
  }

  /** Common: STOP sign at a crossroads/T with route direction, Pause 15, new speed. Pass `pause: undefined` explicitly via noPause for a book that prints none (REG-006). */
  stop(dir: 'L' | 'R' | 'S', speed: number, opts: { pause?: number; noPause?: boolean; exits?: Exit[]; hint?: string; sightDistance?: number } = {}): this {
    const exits = opts.exits ?? (dir === 'S' ? EXITS.crossroads('S') : EXITS.crossroads(dir));
    return this.instruction({ control: 'STOP', exits, sightDistance: opts.sightDistance ?? 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: dir, pause: opts.noPause ? undefined : opts.pause ?? 15, speed, hint: opts.hint });
  }

  /** Speed change at a sign (e.g. speed limit sign). */
  speedAtSign(text: string, speed: number, opts: { side?: 'L' | 'R'; shape?: Sign['shape']; hint?: string } = {}): this {
    return this.instruction({ sign: { text, shape: opts.shape ?? 'rect', side: opts.side ?? 'R' }, sightDistance: 500 }, { speed, hint: opts.hint });
  }

  /** Timed segment starting at a landmark. `delayed`: the interval comes first and the speed already in force is held (VII.E.2.d). */
  timedAt(label: string, timed: TimedSegment, opts: { hint?: string; delayed?: boolean } = {}): this {
    const t = opts.delayed ? { ...timed, delayed: true } : timed;
    return this.instruction({ label, sightDistance: 500 }, { timed: t, speed: t.delayed ? undefined : t.holdSpeed, hint: opts.hint });
  }

  checkpoint(kind: 'timing' | 'observation' = 'timing', sightDistance = 400): this {
    this.checkpoints.push({ id: `cp${++this.cpid}`, s: this.s, kind, sightDistance });
    return this;
  }

  // ---------- STAGE-001 skeleton ----------

  /**
   * HB p.26 #11: the row before the end of an advisory transit prints "(0m30s)", the time left to the end of the transit. Set on the previous row,
   * computed from the transit's own pace (course distance / printed seconds), in whole 5 s; skipped when that row is the transit's own begin line.
   */
  private markTransitGuide(endS: number): void {
    const o = this.openTransit; if (!o) return;
    const begin = this.book[o.idx]!; const t = begin.transit; if (!t || t.exact || t.end || !(t.seconds > 0)) return;
    const prev = this.book[this.book.length - 1]!; if (!prev || prev.n <= begin.n || prev.transitGuide !== undefined || prev.restartTime !== undefined || prev.promotedStop) return;
    const prevS = this.nodes.find(n => n.id === prev.nodeId)?.s; if (prevS === undefined || !(endS > prevS) || !(endS > o.s)) return;
    const left = Math.round(t.seconds * (endS - prevS) / (endS - o.s) / 5) * 5;
    if (left >= 5 && left < t.seconds) prev.transitGuide = left;
  }

  /** Close the open transit: record its approximate length on the begin line (the odometer box) and refresh its sentence. */
  private closeTransit(atS: number): void {
    if (!this.openTransit) return;
    const b = this.book[this.openTransit.idx]!; const m = this.meta[this.openTransit.idx]!;
    if (b.transit) {
      b.transit = { ...b.transit, miles: b.transit.miles ?? Math.round((atS - this.openTransit.s) / 5280 * 10) / 10 };
      m.spec = { ...m.spec, transit: b.transit };
      if (!m.customText) b.text = describeInstruction(m.spec, m.node, m.ctx);
    }
    this.openTransit = null;
    if (this.sectionDefault === 'transit') this.sectionDefault = undefined;
  }
  private markTransitOpen(): void { this.openTransit = { idx: this.book.length - 1, s: this.s }; }

  /** Tire warm-up (a transit of ~8 miles / 20 min) begun by the start line, which must already exist (STAGE-001). */
  warmup(o: { seconds?: number; miles?: number } = {}): this {
    const first = this.book[0]; if (!first || first.section !== 'start') throw new Error('warmup() needs the start line first');
    // the start line keeps section 'start'; the warm-up is its transit, and the lines that follow default to section 'warmup'
    first.transit = { exact: false, plain: true, seconds: o.seconds ?? 1200, miles: o.miles ?? 8 };
    const m = this.meta[0]!; m.spec = { ...m.spec, transit: first.transit };
    if (!m.customText) first.text = describeInstruction(m.spec, m.node, m.ctx);
    this.sectionDefault = 'warmup';
    this.openTransit = { idx: 0, s: this.s };
    return this;
  }

  /**
   * Speedometer calibration run (STAGE-006): the begin line carries the transit allowance (official time rounded up to the minute + `allowanceExtraSeconds`),
   * then `points` calibration points spread over `miles`; the last point is the end of the run and may begin the next transit.
   * Official interval / cumulative times (0.1 s) are filled in by build() through the ghost.
   */
  calibrationRun(o: { miles: number; speed?: number; points: number; gaps?: number[]; allowanceExtraSeconds?: number; thenTransit?: { exact?: boolean; seconds: number }; landmarks?: string[] }): this {
    const speed = o.speed ?? 50; const n = Math.max(1, o.points);
    this.closeTransit(this.s); // the warm-up ends where the calibration run begins
    const gaps = o.gaps ?? Array.from({ length: n }, () => o.miles / n);
    const total = gaps.reduce((a, b) => a + b, 0);
    const official = Math.ceil(total * 3600 / speed / 60) * 60;
    this.calibrationInfo = { officialSeconds: official, allowanceSeconds: official + (o.allowanceExtraSeconds ?? 120) };
    this.sectionDefault = 'calibration';
    this.instruction({ sign: { text: 'CALIBRATION START', shape: 'rect', side: 'R' }, sightDistance: 500 },
      { section: 'calibration', speed, calibrationStart: true, transit: { exact: false, plain: true, seconds: official + (o.allowanceExtraSeconds ?? 120), miles: Math.round(total * 10) / 10 } });
    for (let k = 0; k < n; k++) {
      this.advanceMiles(gaps[k]!);
      const last = k === n - 1;
      const lm = o.landmarks?.[k];
      const node: NodeSpec = lm ? { label: lm, sightDistance: 500 } : { sign: { text: `CAL ${k + 1}`, shape: 'rect', side: 'R' }, sightDistance: 500 };
      this.instruction(node, { section: 'calibration', transit: last && o.thenTransit ? { exact: o.thenTransit.exact ?? false, seconds: o.thenTransit.seconds } : undefined });
      if (last && o.thenTransit) { this.markTransitOpen(); this.sectionDefault = 'transit'; }
    }
    if (!(n > 0 && o.thenTransit)) this.sectionDefault = undefined;
    return this;
  }

  /** Begin a transit (STAGE-003): `exact` = take exactly `seconds` (OUT = IN + seconds); otherwise the time in parentheses is advisory. */
  transit(o: { exact?: boolean; seconds: number; miles?: number }): this {
    this.closeTransit(this.s);
    this.sectionDefault = 'transit';
    this.instruction({ kind: 'landmark', control: 'none', sightDistance: 400, label: 'Begin transit' }, { section: 'transit', transit: { exact: o.exact ?? false, seconds: o.seconds, miles: o.miles } });
    this.markTransitOpen();
    return this;
  }

  /**
   * End the open transit at a referenced sign. For an exact transit the car must leave at IN + seconds (the hold node of the simulator);
   * for an advisory transit it is simply the end line (use restart() when a time-of-day restart follows).
   */
  endTransit(o: { speed?: number; text?: string } = {}): this {
    const open = this.openTransit; const begin = open ? this.book[open.idx]!.transit : undefined;
    if (!open || !begin) throw new Error('endTransit() without a transit');
    this.markTransitGuide(this.s);
    const end = { exact: begin.exact, seconds: begin.seconds, end: true as const };
    this.instruction({ sign: { text: 'END TRANSIT', shape: 'rect', side: 'R' }, sightDistance: 500 }, { section: 'transit', transit: end, speed: o.speed, text: o.text });
    this.closeTransit(this.s);
    return this;
  }

  /** Time-of-day restart at base + ASP minutes (STAGE-002); it ends an open transit. */
  restart(speed: number, baseTod: number, opts: { text?: string } = {}): this {
    const ending = !!this.openTransit;
    if (ending) this.markTransitGuide(this.s);
    const restartTime = this.restartTimeFor(baseTod);
    this.instruction({ kind: 'landmark', control: 'none', sightDistance: 300, label: 'Restart' }, { section: 'restart', speed, restartTime, baseTime: baseTod, text: opts.text, transit: ending ? { exact: false, seconds: 0, end: true } : undefined });
    if (ending) this.closeTransit(this.s);
    this.sectionDefault = undefined;
    return this;
  }

  /** Begin a free zone (crossed camera): no Timing Checkpoint until endFreeZone() (STAGE-004). */
  freeZone(o: { node?: NodeSpec; remark?: string } = {}): this {
    return this.instruction(o.node ?? { sign: { text: 'FREE ZONE', shape: 'rect', side: 'R' }, sightDistance: 500 }, { freeZone: 'begin', remark: o.remark });
  }
  endFreeZone(o: { node?: NodeSpec; remark?: string } = {}): this {
    return this.instruction(o.node ?? { sign: { text: 'END FREE ZONE', shape: 'rect', side: 'R' }, sightDistance: 500 }, { freeZone: 'end', remark: o.remark });
  }

  /**
   * "End timed portion" (crossed clock) and the TA point after it (TA-002): a yellow box instruction, 100 ft on, whose
   * `taPoint.windowSeconds` (default 15m00s) is how long requests are accepted. `transit` begins the transit on the end-timed line.
   */
  endTimedPortion(o: { endOfStage?: boolean; windowSeconds?: number; transit?: { exact?: boolean; plain?: boolean; seconds: number; miles?: number } } = {}): this {
    this.closeTransit(this.s);
    this.instruction({ sign: { text: 'END TIMED', shape: 'rect', side: 'R' }, sightDistance: 500 }, { endTimed: true, transit: o.transit ? { exact: o.transit.exact ?? false, ...(o.transit.plain ? { plain: true } : {}), seconds: o.transit.seconds, miles: o.transit.miles } : undefined });
    if (o.transit) { this.markTransitOpen(); this.sectionDefault = 'transit'; }
    this.advanceFt(100);
    this.instruction({ kind: 'landmark', control: 'none', sightDistance: 300, label: 'Time Allowance point' }, { taPoint: { windowSeconds: o.windowSeconds ?? 900, endOfStage: o.endOfStage ?? false } });
    return this;
  }

  /** Hosted pit / meal / refuel / rest stop inside a transit: leave `leaveBeforeEndSeconds` prior to the end-of-transit time (STAGE-005). */
  promotedStop(kind: 'pit' | 'meal' | 'refuel' | 'rest', leaveBeforeEndSeconds: number): this {
    const section: Section = kind === 'meal' ? 'lunch' : kind === 'rest' ? 'transit' : kind;
    return this.instruction({ kind: 'landmark', control: 'none', sightDistance: 400, label: kind === 'meal' ? 'Lunch stop' : kind === 'refuel' ? 'Fuel stop' : kind === 'pit' ? 'Pit stop' : 'Rest stop' }, { section, promotedStop: { kind, leaveBeforeEndSeconds } });
  }

  /** Finish line with the Observation Checkpoint stop (STAGE-001). */
  observationFinish(): this {
    this.checkpoint('observation', 400);
    this.markTransitGuide(this.s);
    this.instruction({ kind: 'finish', control: 'none', sightDistance: 400, label: 'Finish banner' }, { section: 'finish' });
    this.closeTransit(this.s);
    return this;
  }
  finish(): this { return this.observationFinish(); }

  hazard(h: DistributiveOmit<Hazard, 's'> & { s?: number }): this {
    this.hazards.push({ ...h, s: h.s ?? this.s } as Hazard);
    return this;
  }

  /** Mark the instruction lines from index `from` to the last as calibration section. */
  markSection(section: Section, fromN: number, toN?: number): this {
    for (const ins of this.book) if (ins.n >= fromN && (toN === undefined || ins.n <= toN)) ins.section = ins.section ?? section;
    return this;
  }

  /** Build the scenario. Pure: the builder can keep adding after a build (the generator builds mid-way to ask the ghost for times). */
  build(): Scenario {
    const lengthFt = Math.max(this.s, ...this.nodes.map(n => n.s), ...this.checkpoints.map(c => c.s));
    const book = this.book.map(b => ({ ...b }));
    if (this.openTransit) { // a transit still open at the end of the course: its box is the distance to the end
      const o = this.openTransit; const b = book[o.idx]!;
      if (b.transit && b.transit.miles === undefined) { b.transit = { ...b.transit, miles: Math.round((lengthFt - o.s) / 5280 * 10) / 10 }; const m = this.meta[o.idx]!; if (!m.customText) b.text = describeInstruction({ ...m.spec, transit: b.transit }, m.node, m.ctx); }
    }
    const sc: Scenario = {
      id: this.opts.id, name: this.opts.name, seed: this.opts.seed, car: this.opts.car, speedo: this.opts.speedo, driver: this.opts.driver,
      course: { nodes: [...this.nodes].sort((a, b) => a.s - b.s), lengthFt }, book, checkpoints: [...this.checkpoints].sort((a, b) => a.s - b.s), hazards: this.hazards,
      startTime: this.teamStartTime, baseStartTime: this.opts.startTime, asp: this.opts.asp, timeZone: this.opts.timeZone, bookStyle: this.opts.bookStyle,
      prereadSeconds: this.opts.prereadSeconds, rules: this.opts.rules, aids: this.opts.aids, excursionFt: this.opts.excursionFt, tags: this.opts.tags, trafficWaitProbability: this.trafficWaitProbability,
    };
    if (sc.book.some(i => i.section === 'calibration')) annotatePerfectTimes(sc);
    return sc;
  }
}

export { mphToFps };

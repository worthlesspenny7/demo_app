/** Fluent builder for scenarios (used by tests, drills and the generator). */
import {
  type Scenario, type Node, type Instruction, type Exit, type Control, type TurnDir, type Checkpoint, type Hazard,
  type CarSpec, type SpeedoSpec, type DriverSpec, type RulesConfig, type AidsConfig, type Section, type Sign, type TimedSegment,
  DEFAULT_RULES, TRAINING_AIDS, FORD_1939, DRIVER_EXPERT,
} from './course.js';
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
  hint?: string;
  restartTime?: number;
}

export interface BuilderOptions {
  id?: string; name?: string; seed?: number; startTime?: number;
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

export function describeInstruction(spec: InsSpec, node: NodeSpec): string {
  const parts: string[] = [];
  const at = node.control && node.control !== 'none' ? node.control : node.sign ? `"${node.sign.text}"` : node.label ?? (node.exits && node.exits.length === 2 && node.exits.every(e => Math.abs(e.angle) >= 60) ? 'T' : node.exits && node.exits.length === 2 && node.exits.every(e => Math.abs(e.angle) < 60) ? 'Y' : undefined);
  const turnWords: Record<TurnDir, string> = { L: 'Left', R: 'Right', S: 'Straight', BL: 'Bear Left', BR: 'Bear Right', AL: 'Acute Left', AR: 'Acute Right', JL: 'Jog Left', JR: 'Jog Right' };
  if (spec.section === 'start') parts.push('START');
  else if (spec.section === 'restart') parts.push('RESTART');
  else if (spec.section === 'finish') parts.push('FINISH');
  if (spec.turn) parts.push(at ? `${turnWords[spec.turn]} at ${at}` : turnWords[spec.turn]);
  else if (at && (spec.speed !== undefined || spec.pause !== undefined || spec.timed) && spec.section !== 'start') parts.push(`At ${at}`);
  if (spec.pause !== undefined) parts.push(`Pause ${spec.pause}`);
  if (spec.timed) parts.push(`${spec.timed.holdSpeed} mph for ${fmtT(spec.timed.seconds)} then ${spec.timed.thenSpeed}`);
  else if (spec.speed !== undefined) parts.push(`Speed ${spec.speed}`);
  return parts.join('. ') || 'Continue';
}
function fmtT(sec: number): string { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

export class ScenarioBuilder {
  private nodes: Node[] = [];
  private book: Instruction[] = [];
  private checkpoints: Checkpoint[] = [];
  private hazards: Hazard[] = [];
  private s = 0;
  private nid = 0;
  private cpid = 0;
  private trafficWaitProbability: number;
  readonly opts: Required<Pick<BuilderOptions, 'id' | 'name' | 'seed' | 'startTime' | 'car' | 'speedo' | 'driver' | 'aids' | 'prereadSeconds' | 'excursionFt'>> & { rules: RulesConfig; tags: string[] };

  constructor(o: BuilderOptions = {}) {
    this.opts = {
      id: o.id ?? 'scenario', name: o.name ?? 'Scenario', seed: o.seed ?? 1, startTime: o.startTime ?? 8 * 3600,
      car: o.car ?? FORD_1939, speedo: o.speedo ?? PERFECT_TIMEWISE, driver: o.driver ?? DRIVER_EXPERT,
      rules: { ...DEFAULT_RULES, ...(o.rules ?? {}) }, aids: o.aids ?? TRAINING_AIDS, prereadSeconds: o.prereadSeconds ?? 30,
      excursionFt: o.excursionFt ?? 2640, tags: o.tags ?? [],
    };
    this.trafficWaitProbability = o.trafficWaitProbability ?? 0;
  }

  get position(): number { return this.s; }
  advanceMiles(mi: number): this { this.s += milesToFt(mi); return this; }
  advanceFt(ft: number): this { this.s += ft; return this; }

  /** Start line at the current position (normally 0). */
  start(speed: number, opts: { restartTime?: number; text?: string } = {}): this {
    return this.instruction({ kind: 'start', control: 'none', sightDistance: 300, label: 'Start banner' }, { section: 'start', speed, restartTime: opts.restartTime ?? this.opts.startTime, text: opts.text });
  }

  node(spec: NodeSpec): string {
    const id = `n${++this.nid}`;
    this.nodes.push({ id, s: this.s, kind: spec.kind ?? (spec.exits ? 'intersection' : spec.sign ? 'sign' : 'landmark'), control: spec.control ?? 'none', exits: spec.exits, sign: spec.sign, sightDistance: spec.sightDistance ?? 600, stopLineOffset: spec.stopLineOffset, label: spec.label });
    return id;
  }

  /** Add a node at the current position with an instruction bound to it. */
  instruction(node: NodeSpec, ins: InsSpec): this {
    const id = this.node(node);
    this.book.push({ n: this.book.length + 1, nodeId: id, text: ins.text ?? describeInstruction(ins, node), section: ins.section, turn: ins.turn, speed: ins.speed, pause: ins.pause, timed: ins.timed, hint: ins.hint, restartTime: ins.restartTime });
    return this;
  }

  /** Common: STOP sign at a crossroads/T with route direction, Pause 15, new speed. */
  stop(dir: 'L' | 'R' | 'S', speed: number, opts: { pause?: number; exits?: Exit[]; hint?: string; sightDistance?: number } = {}): this {
    const exits = opts.exits ?? (dir === 'S' ? EXITS.crossroads('S') : EXITS.crossroads(dir));
    return this.instruction({ control: 'STOP', exits, sightDistance: opts.sightDistance ?? 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: dir, pause: opts.pause ?? 15, speed, hint: opts.hint });
  }

  /** Speed change at a sign (e.g. speed limit sign). */
  speedAtSign(text: string, speed: number, opts: { side?: 'L' | 'R'; shape?: Sign['shape']; hint?: string } = {}): this {
    return this.instruction({ sign: { text, shape: opts.shape ?? 'rect', side: opts.side ?? 'R' }, sightDistance: 500 }, { speed, hint: opts.hint });
  }

  /** Timed segment starting at a landmark. */
  timedAt(label: string, timed: TimedSegment, opts: { hint?: string } = {}): this {
    return this.instruction({ label, sightDistance: 500 }, { timed, speed: timed.holdSpeed, hint: opts.hint });
  }

  checkpoint(kind: 'timing' | 'observation' = 'timing', sightDistance = 400): this {
    this.checkpoints.push({ id: `cp${++this.cpid}`, s: this.s, kind, sightDistance });
    return this;
  }

  /** Lunch/restart: a stop node with an official restart time. */
  restart(speed: number, restartTime: number, opts: { text?: string } = {}): this {
    return this.instruction({ kind: 'landmark', control: 'none', sightDistance: 300, label: 'Restart' }, { section: 'restart', speed, restartTime, text: opts.text });
  }

  finish(): this {
    this.checkpoint('observation', 400);
    return this.instruction({ kind: 'finish', control: 'none', sightDistance: 400, label: 'Finish banner' }, { section: 'finish', text: 'FINISH. Stop at Observation Checkpoint' });
  }

  hazard(h: DistributiveOmit<Hazard, 's'> & { s?: number }): this {
    this.hazards.push({ ...h, s: h.s ?? this.s } as Hazard);
    return this;
  }

  /** Mark the instruction lines from index `from` to the last as calibration section. */
  markSection(section: Section, fromN: number, toN?: number): this {
    for (const ins of this.book) if (ins.n >= fromN && (toN === undefined || ins.n <= toN)) ins.section = ins.section ?? section;
    return this;
  }

  build(): Scenario {
    const lengthFt = Math.max(this.s, ...this.nodes.map(n => n.s), ...this.checkpoints.map(c => c.s));
    return {
      id: this.opts.id, name: this.opts.name, seed: this.opts.seed, car: this.opts.car, speedo: this.opts.speedo, driver: this.opts.driver,
      course: { nodes: [...this.nodes].sort((a, b) => a.s - b.s), lengthFt }, book: this.book, checkpoints: [...this.checkpoints].sort((a, b) => a.s - b.s), hazards: this.hazards,
      startTime: this.opts.startTime, prereadSeconds: this.opts.prereadSeconds, rules: this.opts.rules, aids: this.opts.aids, excursionFt: this.opts.excursionFt, tags: this.opts.tags, trafficWaitProbability: this.trafficWaitProbability,
    };
  }
}

export { mphToFps };

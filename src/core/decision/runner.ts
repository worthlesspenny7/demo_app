/**
 * DecisionRunner (MOB-001..004): wraps a Simulator and fast-forwards it in fixed 0.1 s ticks to the next decision point the
 * navigator owns. The Navigator (navigator.ts) drives everything in between (assigned speeds, called turns, chart pauses, TA filing,
 * no make-up unless chosen). `next()` returns a Decision; `answer()` turns the response into real sim actions (go, launch, call.turn,
 * call.speed, watch.lap, ta.request, call.uturn, clock.read, pullover / make-up speed calls) and returns the Verdict. Deterministic:
 * the same scenario and the same responses give the same decisions and verdicts.
 */
import type { Scenario, Instruction, TurnDir, Hazard, Node } from '../course.js';
import { nodeById, type Exit } from '../course.js';
import { Simulator, turnWord, type StageResult } from '../sim.js';
import { accelLoss, stopLoss, rampLead, chartLead } from '../perf-table.js';
import { columnBSymbols, columnCLines, columnD, odometerBox, formatInterval, formatClockFace } from '../griid.js';
import { signalIsRed, trainActive } from '../hazards.js';
import { mphToFps } from '../units.js';
import { rng } from '../rng.js';
import { TA_CAUSES } from '../sim.js';
import { Navigator, emptyOverrides, isHoldIns, chartDwell, capFor, ruleClaim, type NavPlan, type NavOverrides } from './navigator.js';
import type { MicroHint } from './scenarios.js';
import { verdictRule, words } from './rules.js';
import { SKILL_OF_KIND, type BookRowView, type Decision, type DecisionContext, type DecisionKind, type DecisionOption, type DecisionResponse, type DecisionRunnerOptions, type TimingSpec, type Verdict, DECISION_KINDS } from './types.js';

const TICK = 0.1;
const r1 = (x: number): number => Math.round(x * 10) / 10;
const clockStr = (tod: number): string => formatClockFace(Math.round(tod));
/** MOB-012: prompts are at most 40 words; a longer one is cut at a word boundary (tests assert none is). */
export const PROMPT_MAX_WORDS = 40;
/** MOB-061: the words a decision card asks the player to read: the prompt plus every option label (the phone adds the strip and the kind, <= 6 words). */
export const CARD_MAX_WORDS = 32;
export function cardWords(d: Pick<Decision, 'prompt' | 'options'>): number { return words(d.prompt) + (d.options ?? []).reduce((a, o) => a + words(o.label), 0); }
function clip(s: string): string { const w = s.trim().split(/\s+/); return w.length <= PROMPT_MAX_WORDS ? s.trim() : `${w.slice(0, PROMPT_MAX_WORDS).join(' ')}`; }

/** Correct-answer tolerances for the timed kinds (seconds), after the drill rubrics: D03 (1 s legs), D16 (late > 2 s finding), D04 / D05 call errors. */
export const TIMING_TOLERANCE: Record<'pause' | 'restart' | 'timedStart' | 'speedChange', number> = { pause: 1.0, restart: 1.0, timedStart: 1.3, speedChange: 1.3 };

/** PT-14 N6: no card stays open longer than this many seconds of wall time; a hold whose last tap is later than HOLD_MAX_SECONDS is
 *  shown compressed (the watch jumps to SKIP_LEAD_SECONDS before the tap). */
export const WALL_MAX_SECONDS = 30;
export const HOLD_MAX_SECONDS = 25;
export const SKIP_LEAD_SECONDS = 5;
/** Card seconds -> wall seconds on a card's timing (after a skip the card clock runs `to - at` ahead of the wall). */
export function wallOf(t: Pick<TimingSpec, 'skip'>, cardSeconds: number): number { const k = t.skip; return k && cardSeconds >= k.to ? cardSeconds - (k.to - k.at) : k && cardSeconds > k.at ? k.at : cardSeconds; }
/** Wall seconds -> card seconds (what the watch shows). */
export function cardOf(t: Pick<TimingSpec, 'skip'>, wallSeconds: number): number { const k = t.skip; return k && wallSeconds >= k.at ? wallSeconds + (k.to - k.at) : wallSeconds; }
/** The wall time the card may stay open (its timeout in wall seconds). */
export function wallMaxOf(t: Pick<TimingSpec, 'skip' | 'maxSeconds'>): number { return wallOf(t, t.maxSeconds); }
/** PT-14 N6: compress a long hold and cap the card's open time at WALL_MAX_SECONDS of wall time. */
export function fitWall(t: TimingSpec): TimingSpec {
  const last = t.secondTapSeconds ?? t.truthSeconds;
  let skip = t.skip;
  if (!skip && last > HOLD_MAX_SECONDS) {
    const at = r1(t.kind === 'startStop' ? t.truthSeconds + 2 : 3);
    const to = r1(last - SKIP_LEAD_SECONDS);
    if (to > at + 1) skip = { at, to, note: 'Long hold: it jumps.', detail: `Long hold: ${t.kind === 'startStop' ? 'two seconds after your START' : 'a few seconds in'} the watch jumps ahead to ${SKIP_LEAD_SECONDS} s before the ${t.kind === 'startStop' ? 'CALL' : t.tapLabel}.` };
  }
  const jump = skip ? skip.to - skip.at : 0;
  const maxSeconds = r1(Math.max(Math.min(t.maxSeconds, WALL_MAX_SECONDS + jump), last + t.toleranceSeconds + 2));
  return { ...t, maxSeconds, ...(skip ? { skip } : {}) };
}

type Variant = string;
interface Pending {
  d: Decision; key: string; tod0: number; pace0: number; oracle: DecisionResponse;
  /** kind-specific facts the grader needs */
  x: Record<string, unknown>;
}

function dirLabel(d: TurnDir): string { return turnWord(d); }
function dirForAngle(a: number): TurnDir { if (a <= -120) return 'AL'; if (a < -60) return 'L'; if (a < -20) return 'BL'; if (a <= 20) return 'S'; if (a <= 60) return 'BR'; if (a < 120) return 'R'; return 'AR'; }
/** MOB-055: what the navigator sees, never the category ("TA cause") itself; `long` / `short` says how long it will hold the car. */
function hazardScene(h: Hazard, d: number, size: 'short' | 'long'): { scene: string; label: string } {
  const ft = `${Math.max(0, Math.round(d / 50) * 50)} ft`;
  switch (h.kind) {
    // PT-14 C-1: the scene says what RULE-031 decides on: a slow truck you can pass (not a cause), a farm tractor or combine you cannot pass,
    // construction holding traffic, a school bus, a train, an accident scene (REG V.H.1, V.H.5; Time Delay Form [00:04])
    case 'slow': return { scene: `A slow truck ${ft} ahead at ${h.speedMph} mph; you can pass it soon.`, label: 'Slow truck' };
    case 'tractor': return size === 'long' ? { scene: `A farm tractor ${ft} ahead at ${h.speedMph} mph; you cannot pass for miles.`, label: 'Farm tractor' } : { scene: `A farm tractor ${ft} ahead is turning into a field gate.`, label: 'Farm tractor' };
    case 'combine': return { scene: `A combine ${ft} ahead fills the road; you cannot pass it.`, label: 'Combine' };
    case 'train': return size === 'long' ? { scene: `Gates down ${ft} ahead: a long freight is just starting across.`, label: 'Crossing gates' } : { scene: `Gates down ${ft} ahead: the last cars are passing.`, label: 'Crossing gates' };
    case 'signal': return { scene: `The signal ${ft} ahead has just turned red.`, label: 'Red light' };
    case 'schoolBus': return { scene: `A school bus ${ft} ahead stops, red lights flashing.`, label: 'School bus' };
    case 'construction': return { scene: `Road work ${ft} ahead: one lane, a flagger holding traffic.`, label: 'Road work' };
    case 'accident': return { scene: `An accident scene ${ft} ahead; people need help.`, label: 'Accident scene' };
  }
}
const CLOCK_OPTS = [{ id: 'tod', label: 'Watch, TOD mode' }, { id: 'chrono', label: 'Watch, chrono' }, { id: 'min', label: 'Clock minute hand' }, { id: 'sec', label: 'Clock second hand' }];
const CLOCK_LABEL: Record<string, string> = Object.fromEntries(CLOCK_OPTS.map(o => [o.id, o.label]));
const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const signed = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} s`;

export class DecisionRunner {
  readonly sim: Simulator;
  readonly scenario: Scenario;
  readonly nav: Navigator;
  readonly verdicts: Verdict[] = [];
  readonly decisions: Decision[] = [];
  readonly kinds: ReadonlySet<DecisionKind>;
  readonly rung: 0 | 1 | 2 | 3;
  private readonly max: number;
  private readonly prereadRows: number;
  private pending: Pending | null = null;
  private seen = new Set<string>();
  private presented = 0;
  private suppress = 0;
  private lostSeen = 0;
  private finished = false;
  private scheduled: { when: () => boolean; run: () => void }[] = [];
  private readonly ov: NavOverrides;
  private n = 0;
  private readonly hint: MicroHint;
  private readonly maxPerKind: number;
  /** MOB-056: the car left the route; the lost card comes `delay` s later (the driver has to notice first). */
  private lostPending: { count: number; offTod: number; delay: number; exit: Exit | null; nodeS: number; v: number } | null = null;
  /** MOB-053: a timed line whose lap at the sign the navigator takes; the watch card comes just after it. */
  private watchArm: { n: number; crossTod: number; plan: NavPlan; key: string } | null = null;

  constructor(scenario: Scenario, opts: DecisionRunnerOptions & { prereadRows?: number; recovery?: 'off' | 'oracle'; missTurns?: number[]; hint?: MicroHint; maxPerKind?: number } = {}) {
    this.scenario = scenario;
    this.sim = new Simulator(scenario, { watch: 'digital' });
    this.kinds = new Set(opts.kinds ?? DECISION_KINDS);
    this.rung = opts.rung ?? scenario.aids.rung;
    this.max = opts.maxDecisions ?? Infinity;
    this.prereadRows = opts.prereadRows ?? 1;
    this.hint = opts.hint ?? {};
    this.maxPerKind = opts.maxPerKind ?? Infinity;
    this.ov = emptyOverrides();
    this.ov.recovery = { mode: opts.recovery ?? 'off' };
    for (const n of opts.missTurns ?? []) this.ov.turn.set(n, { dir: null });
    this.nav = new Navigator(this.sim, this.ov);
  }

  /** Fast-forward to the next presented decision; null when the scenario is finished (or the decision budget is spent). */
  next(): Decision | null {
    if (this.pending) return this.pending.d;
    if (this.finished) return null;
    const p = this.scan();
    return p ? p.d : null;
  }

  /** TRUTH: the response a perfect navigator gives (bots, tests). */
  oracle(decision: Decision): DecisionResponse {
    if (!this.pending || this.pending.d.id !== decision.id) throw new Error(`decision ${decision.id} is not pending`);
    return { ...this.pending.oracle };
  }

  /** Apply the response as real sim actions, continue to the verdict moment and return the Verdict. A null response is a timeout. */
  answer(decision: Decision, response: DecisionResponse | null): Verdict {
    const p = this.pending;
    if (!p || p.d.id !== decision.id) throw new Error(`decision ${decision.id} is not pending`);
    this.pending = null;
    const res = sanitize(response);
    const v = this.grade(p, res);
    // prefetch the next decision so the verdict can say how far away it is
    const verdictTod = this.sim.tod;
    const nx = this.finished ? null : this.scan();
    const out: Verdict = { ...v, nextDecisionIn: nx ? r1(nx.tod0 - verdictTod) : null };
    this.verdicts.push(out);
    return out;
  }

  /** Drive to the finish with the navigator (no more decisions) and return the Desk result. */
  finish(): StageResult {
    if (this.pending) { const p = this.pending; this.answer(p.d, p.oracle); }
    this.suppress++;
    this.run(() => false, 12 * 3600);
    this.suppress--;
    this.finished = true;
    return this.sim.result();
  }
  get done(): boolean { return this.finished && !this.pending; }

  // ------------------------------------------------------------------ loop
  private tickOnce(): void {
    this.fallbacks();
    if (this.scheduled.length) { const due = this.scheduled.filter(s => s.when()); this.scheduled = this.scheduled.filter(s => !due.includes(s)); for (const s of due) s.run(); }
    this.nav.onTick();
    this.sim.step(TICK);
  }
  /** Step until `until()` or the stage ends; returns false when it ended or ran out of time. */
  private run(until: () => boolean, maxSeconds: number): boolean {
    const t0 = this.sim.tod;
    while (this.sim.phase !== 'finished') {
      if (until()) return true;
      if (this.sim.tod - t0 > maxSeconds) return false;
      this.tickOnce();
    }
    if (this.sim.phase === 'finished' && this.sim.sc.rules.taMode === 'paper' && !this.paperDone) { this.paperDone = true; this.nav.onTick(); }
    return until();
  }
  private paperDone = false;
  /** A moment the runner took from the navigator but never showed (budget spent, another card first): give it back to the navigator. */
  private fallbacks(): void {
    const sim = this.sim;
    const w = this.watchArm;
    if (w && sim.tod > w.crossTod + 6) {
      this.watchArm = null; this.seen.add(w.key);
      const seg = w.plan.ins.timed!; const tmov = this.ov.timed.get(w.n);
      if (tmov && tmov !== 'wait' && tmov.callAt === Infinity) this.ov.timed.set(w.n, { lapAt: tmov.lapAt, callAt: (tmov.lapAt ?? w.crossTod) + seg.seconds - rampLead(seg.holdSpeed, seg.thenSpeed, this.scenario.car) });
    }
    const l = this.lostPending;
    if (l && sim.tod > l.offTod + l.delay + 8) { this.lostPending = null; this.ov.uturn = 'auto'; }
  }
  private makeupCooldown = -Infinity;
  private scan(): Pending | null {
    const sim = this.sim; const limit = sim.sc.startTime + 14 * 3600;
    while (sim.phase !== 'finished' && sim.tod < limit) {
      if (!this.suppress && this.presented < this.max) {
        const p = this.detect();
        if (p) { this.pending = p; this.presented++; this.decisions.push(p.d); return p; }
      }
      this.tickOnce();
    }
    if (sim.phase === 'finished' && sim.sc.rules.taMode === 'paper' && !this.paperDone) { this.paperDone = true; this.nav.onTick(); }
    this.finished = true;
    return null;
  }

  // ------------------------------------------------------------------ helpers
  private lead(key: string, lo: number, hi: number): number { return lo + rng(`${this.scenario.seed}:dp:${key}`).next() * (hi - lo); }
  private shuffle<T>(key: string, arr: T[]): T[] { const r = rng(`${this.scenario.seed}:opt:${key}`); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
  private ctx(extra: Partial<DecisionContext> = {}): DecisionContext { return { tod: this.sim.tod, elapsed: r1(this.sim.tod - this.scenario.startTime), zone: this.scenario.timeZone, ...extra }; }
  /** PT-14: one clock format on the card: 12-hour with the zone label in front, as Column C prints it ("CDT 9:31:50"). */
  private clk(tod: number): string { return `${this.scenario.timeZone} ${clockStr(tod)}`; }
  /** PT-14 N4: the right answer's rank among the option values is drawn uniformly (0 = smallest .. k - 1) and the distractors are taken
   *  from plausible mistakes on each side (`below` / `above`, most plausible first); the shown order is shuffled. Returns the values. */
  private ranked(key: string, truth: number, below: number[], above: number[], k: number, eq: (a: number, b: number) => boolean = (a, b) => a === b): number[] {
    const r = rng(`${this.scenario.seed}:rank:${key}`);
    const uniq = (xs: number[]): number[] => xs.filter((x, i) => !eq(x, truth) && xs.findIndex(y => eq(x, y)) === i);
    const lo = uniq(below.filter(x => x < truth)); const hi = uniq(above.filter(x => x > truth));
    const feasible = Array.from({ length: k }, (_, i) => i).filter(i => lo.length >= i && hi.length >= k - 1 - i);
    const rank = feasible.length ? feasible[r.int(0, feasible.length - 1)]! : Math.min(lo.length, k - 1);
    const pickN = (xs: number[], n: number): number[] => { const a = xs.slice(); const out: number[] = []; while (out.length < n && a.length) out.push(a.splice(r.int(0, Math.min(a.length, 3) - 1), 1)[0]!); return out; };
    const vals = [...pickN(lo, rank), truth, ...pickN(hi, k - 1 - rank)];
    return vals;
  }
  private row(ins: Instruction | undefined): BookRowView | undefined {
    if (!ins) return undefined; const sc = this.scenario;
    const node = sc.course.nodes.find(nd => nd.id === ins.nodeId);
    return { line: ins.n, odometer: odometerBox(ins) ?? '', miles: Math.round((node?.s ?? 0) / 5280 * 100) / 100, columnB: [...columnBSymbols(ins)], columnC: columnCLines(ins, sc.timeZone), columnD: this.rung <= 0 ? (ins.remark ?? '') : columnD(ins, sc.bookStyle) };
  }
  private nextIns(ins: Instruction): Instruction | undefined { return this.scenario.book.find(i => i.n === ins.n + 1); }
  /** The chart number printed in the prompt (rung 2+). */
  private showChart(): boolean { return this.rung >= 2; }
  /** The chart cell in the context: shown at rung 2+, behind a Chart button at rung 1 (MOB-059), withheld at the legal rung 0. */
  private chartAvail(): boolean { return this.rung >= 1; }
  private make(kind: DecisionKind, key: string, prompt: string, context: DecisionContext, extra: { options?: DecisionOption[]; timing?: TimingSpec; deadlineSeconds?: number }, oracle: DecisionResponse, x: Record<string, unknown> = {}): Pending {
    this.seen.add(key);
    if (extra.timing) { extra = { ...extra, timing: fitWall(extra.timing) }; if (extra.timing!.skip) prompt = prompt.replace(/^Line \d+: /, '').replace(/START on Dad's Mark!, then CALL \d+ half a ramp/, 'START on Mark!, CALL half a ramp').replace(/START on Dad's Mark!, then CALL/, 'START on Mark!, CALL'); }   // PT-15 P5: a compressed hold keeps a short prompt (the jump is explained behind "details", skip.detail)
    const d: Decision = { id: `${kind}:${key.split(':').slice(1).join(':') || '0'}:${++this.n}`, kind, skill: SKILL_OF_KIND[kind], prompt: clip(prompt), context, ...extra };
    return { d, key, tod0: this.sim.tod, pace0: this.safePace(), oracle, x };
  }
  private safePace(): number { try { const p = this.sim.pace(); return Number.isFinite(p) ? p : 0; } catch { return 0; } }
  private atStopLine(node: Node): boolean { return this.sim.waitingForGo && Math.abs(this.sim.car.s - (node.s - (node.stopLineOffset ?? 0))) < 3; }
  private steadyAt(mph: number): boolean { const car = this.sim.car; return car.mode === 'cruise' && Math.abs(car.v - mphToFps(mph)) < mphToFps(1.5); }
  private nearPlans(): NavPlan[] { const s = this.sim.car.s; return this.nav.plans.filter(p => p.s - s > -100 && p.s - s < 3000); }
  private assigned(): number { return this.nav.assignedNow() ?? 30; }
  /** A hazard zone, signal or crossing between the car and `s` (the car would not hold its speed to it). */
  private hazardBefore(s: number): boolean {
    const c = this.sim.car.s;
    return this.scenario.hazards.some(h => { const end = 'lengthFt' in h ? h.s + h.lengthFt : h.s; return end >= c - 5 && h.s <= s + 100; })
      || this.scenario.course.nodes.some(n => n.s > c + 1 && n.s < s - 1 && (n.control === 'STOP' || n.control === 'SIGNAL' || n.control === 'RR' || !!n.fullStop));
  }

  // ------------------------------------------------------------------ detection (order = priority)
  /** The kinds still presented (MOB-059: a boss leg gives at most `maxPerKind` cards of one kind; the navigator does the rest). */
  private owns(kind: DecisionKind): boolean { return this.kinds.has(kind) && (this.maxPerKind === Infinity || this.decisions.filter(d => d.kind === kind).length < this.maxPerKind); }
  private detect(): Pending | null {
    const sim = this.sim; const k = { has: (x: DecisionKind) => this.owns(x) };
    if (sim.phase === 'preread') {
      return (k.has('preread') ? this.detectPreread() : null) ?? (k.has('clock') ? this.detectClock() : null) ?? (k.has('restart') ? this.detectStart() : null);
    }
    if (sim.phase !== 'running') return null;
    this.autoHazard();
    return (k.has('lost') ? this.detectLost() : null)
      ?? (k.has('hazard') ? this.detectHazard() : null)
      ?? (k.has('pause') ? this.detectPause() : null)
      ?? (k.has('clock') ? this.detectClock() : null)
      ?? (k.has('restart') ? this.detectHold() : null)
      ?? (k.has('watch') ? this.detectWatch() : null)
      ?? (k.has('transitOut') ? this.detectTransitOut() : null)
      ?? (k.has('ta') ? this.detectTa() : null)
      ?? (k.has('checkpoint') ? this.detectCheckpoint() : null)
      ?? (k.has('turn') ? this.detectTurn() : null)
      ?? (k.has('timedStart') ? this.detectTimed() : null)
      ?? (k.has('speedChange') ? this.detectSpeed() : null)
      ?? (k.has('makeup') ? this.detectMakeup() : null);
  }

  // preread: one card per row that needs a call (which way / what speed / how long to wait)
  private detectPreread(): Pending | null {
    const asked = [...this.seen].filter(s => s.startsWith('preread:')).length;
    if (asked >= this.prereadRows) return null;
    const sc = this.scenario;
    for (const p of this.nav.plans) {
      const ins = p.ins; if (ins.n === 1 || ins.omitted || this.seen.has(`preread:${ins.n}`)) continue;
      const turn = ins.turn && ins.turn !== 'S' ? ins.turn : null;
      const pause = (ins.pause ?? 0) > 0 && !isHoldIns(ins) ? ins.pause! : null;
      const speedCh = ins.speed !== undefined && !ins.timed && p.vIn > 0 && ins.speed !== p.vIn ? ins.speed : null;
      if (!turn && pause === null && speedCh === null) continue;
      const key = `preread:${ins.n}`; const ctx = this.ctx({ line: ins.n, row: this.row(ins), nextRow: this.row(this.nextIns(ins)) });
      if (turn) {
        const opts = this.turnOptions(key, ins, turn);
        return this.make('preread', key, `Pre-read, line ${ins.n}. Which way does the book send you here?`, ctx, { options: opts }, { optionId: turn }, { what: 'turn', truth: turn, ins });
      }
      if (pause !== null) {
        const dwell = r1(chartDwell(sc, p)); ctx.speeds = { current: p.vIn, assigned: p.vIn, in: p.vIn, out: p.vOut }; ctx.times = { pauseSeconds: pause };
        // MOB-050: the pre-read chip is the LOSS to subtract (the pause card's chip is the time to SIT)
        if (this.chartAvail()) ctx.chart = { kind: 'stopGo', vIn: p.vIn, vOut: p.vOut, seconds: r1(stopLoss(p.vIn || p.vOut, p.vOut, sc.car, capFor(sc, ins.turn))), meaning: 'loss' };
        // PT-14 N4: the right wait is the smallest, the middle or the largest equally often (mistakes: go at once, the loss itself, the
        // loss taken twice / the printed pause, the loss added)
        const loss = r1(Math.max(0, pause - dwell));
        const cands = this.ranked(key, dwell, [0, loss, r1(dwell - loss)].filter(x => x >= 0), [pause, r1(pause + loss), r1(dwell + 2 * loss)], 3, (a, b) => Math.abs(a - b) < 0.95);
        const opts = this.shuffle(key, cands).map(v => ({ id: `w${v}`, label: v === 0 ? 'Go at once' : `Wait ${v} s` }));
        // PT-14 item 9: the loss the rule needs is on the card itself at rung 2
        const lossTxt = this.showChart() ? `, loss ${loss.toFixed(1)} s` : '';
        return this.make('preread', key, `Line ${ins.n}: pause ${pause} s, in ${p.vIn}, out ${p.vOut}${lossTxt}. How long do you sit?`, ctx, { options: opts }, { optionId: `w${dwell}` }, { what: 'pause', truth: dwell, ins, plan: p });
      }
      const v = speedCh!; ctx.speeds = { current: p.vIn, assigned: p.vIn };   // MOB-055: never the answer in a chip; Column C is the book
      const cands = [...new Set([v, p.vIn, v + 5 <= 55 ? v + 5 : v - 10, v - 5 >= 10 ? v - 5 : v + 10])].filter(x => x > 0).slice(0, 4);
      const opts = this.shuffle(key, cands).map(x => ({ id: `v${x}`, label: `${x} mph` }));
      return this.make('preread', key, `Pre-read, line ${ins.n}. What speed do you call at this sign?`, ctx, { options: opts }, { optionId: `v${v}` }, { what: 'speed', truth: v, ins, plan: p });
    }
    return null;
  }

  /** Options for a turn: the book's direction plus the other roads at that node (and Straight). */
  private turnOptions(key: string, ins: Instruction, truth: TurnDir): DecisionOption[] {
    const node = nodeById(this.scenario.course, ins.nodeId);
    const dirs = new Set<TurnDir>([truth]);
    for (const e of node.exits ?? []) { if (e.kind === 'driveway' || e.kind === 'lot' || e.kind === 'private') continue; dirs.add(dirForAngle(e.angle)); }
    for (const extra of ['S', truth.endsWith('L') || truth === 'L' ? 'R' : 'L'] as TurnDir[]) if (dirs.size < 3) dirs.add(extra);
    return this.shuffle(key, [...dirs].slice(0, 4)).map(d => ({ id: d, label: dirLabel(d) }));
  }

  // restart: the stage start (full start procedure only)
  private detectStart(): Pending | null {
    const sim = this.sim; const sc = this.scenario;
    if (sc.startProcedure === 'drill' || this.seen.has('restart:1')) return null;
    const li = sim.launchInfo(); if (!li || li.kind !== 'start') return null;
    const lead = this.lead('restart:1', 10, 20);
    if (sim.tod < li.launchTime - lead) return null;
    this.ov.depart = 'wait';
    return this.launchCard('restart:1', sc.book[0]!, li.ownTime, li.launchTime, li.netLoss, sc.book[0]!.baseTime ?? sc.baseStartTime ?? sc.startTime, 'start');
  }
  // restart: waiting at a time-of-day restart, an exact-transit OUT or a promoted stop
  private detectHold(): Pending | null {
    const sim = this.sim; if (!sim.waitingForGo) return null;
    for (const p of this.nearPlans()) {
      if (!isHoldIns(p.ins) || p.stopHandled) continue;
      const key = `restart:${p.ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(this.scenario.course, p.ins.nodeId); if (!this.atStopLine(node)) continue;
      const hl = this.holdLaunch(p); if (!hl) continue;
      const promoted = !!p.ins.promotedStop;
      const lead = this.lead(key, 10, 20);
      if (sim.tod < hl.launch - lead) continue;
      this.ov.go.set(p.ins.n, 'wait');
      return this.launchCard(key, p.ins, hl.go, hl.launch, hl.netLoss, p.ins.baseTime, promoted ? 'lunch' : p.ins.transit?.end ? 'transitOut' : 'restart');
    }
    return null;
  }
  private launchCard(key: string, ins: Instruction, own: number, launch: number, netLoss: number, base: number | undefined, what: 'start' | 'restart' | 'transitOut' | 'lunch'): Pending {
    const sim = this.sim; const truth = Math.max(0, r1(launch - sim.tod));
    // MOB-058: a restart may print the base time and the starting position instead of your own time (RULE-010)
    const asp = this.scenario.asp ?? 0;
    const byBase = what === 'restart' && !!this.hint.base && base !== undefined && asp > 0;
    const vOut = this.nav.plans.find(p => p.ins === ins)?.vOut ?? 0;
    const ctx = this.ctx({ line: ins.n, row: this.row(ins), times: byBase ? { base, position: asp } : { own }, speeds: { current: 0, assigned: 0, out: vOut } });
    ctx.clock = this.clockView();
    if (this.chartAvail() && what !== 'lunch') ctx.chart = { kind: 'accel', vIn: 0, vOut, seconds: netLoss, meaning: 'loss' };
    const name = what === 'start' ? 'Start' : what === 'lunch' ? 'Lunch departure' : what === 'transitOut' ? 'Transit OUT' : 'Restart';
    const yours = byBase ? `base ${this.clk(base!)}, you start ${ordinal(asp)}` : `your time ${this.clk(own)}`;
    const prompt = what === 'lunch'
      ? `${name}, line ${ins.n}: leave at ${this.clk(own)}. Tap LEAVE on that second.`
      : this.showChart()
        ? `${name}, line ${ins.n}: ${yours}; standing-start loss ${netLoss.toFixed(1)} s. Tap LAUNCH on the launch second.`
        : `${name}, line ${ins.n}: ${yours}. Lead by the standing-start loss; tap LAUNCH on the launch second.`;
    const timing: TimingSpec = { kind: 'tapAt', truthSeconds: truth, toleranceSeconds: TIMING_TOLERANCE.restart, maxSeconds: truth + 20, tapLabel: what === 'lunch' ? 'LEAVE' : 'LAUNCH', todPrimary: true };
    return this.make('restart', key, prompt, ctx, { timing }, { tapSeconds: truth }, { ins, own, launch, what, netLoss, byBase, variant: what === 'lunch' ? 'lunch' : byBase ? 'base' : 'default' });
  }
  private clockView(): DecisionContext['clock'] {
    const h = this.sim.clock.hands(this.sim.tod);
    return { hourAngle: h.hourAngle, minuteAngle: h.minuteAngle, secondAngle: h.secondAngle, minuteAmbiguous: h.minuteAmbiguous, minute: h.minuteAmbiguous && this.rung <= 1 ? null : h.minute };
  }

  /** Launch time of day at a hold (promoted stops leave on their time; others lead by the standing-start loss), or null while unknown. */
  private holdLaunch(p: NavPlan): { go: number; launch: number; netLoss: number } | null {
    const go = this.sim.holdGoTod(nodeById(this.scenario.course, p.ins.nodeId)); if (go === null) return null;
    if (p.ins.promotedStop) return { go, launch: go, netLoss: 0 };
    const li = this.sim.launchInfo(p.ins);
    return { go, launch: li?.launchTime ?? go - Math.round(accelLoss(p.vOut, this.scenario.car)), netLoss: li?.netLoss ?? r1(accelLoss(p.vOut, this.scenario.car)) };
  }
  // clock (MOB-057): a departure 25-45 s away. The card asks which instrument to use for one job: the minute (at a minute change the
  // dash clock's loose minute hand can be a minute off, RULE-037; away from it the clock is fine too), the launch second (count it in off
  // the clock's second hand, RULE-038) or the next interval (the stopwatch, RULE-039).
  private detectClock(): Pending | null {
    const sim = this.sim; let line: number | null = null; let launch: number | null = null;
    if (sim.phase === 'preread') { if (this.scenario.startProcedure === 'drill') return null; const li = sim.launchInfo(); if (li && li.kind === 'start') { line = 1; launch = li.launchTime; } }
    else if (sim.waitingForGo) {
      for (const p of this.nearPlans()) {
        if (!isHoldIns(p.ins) || p.stopHandled) continue;
        const node = nodeById(this.scenario.course, p.ins.nodeId); if (!this.atStopLine(node)) continue;
        const hl = this.holdLaunch(p); if (!hl) continue; line = p.ins.n; launch = hl.launch; break;
      }
    }
    if (line === null || launch === null) return null;
    const key = `clock:${line}`; if (this.seen.has(key)) return null;
    const slop = this.scenario.rules.clockMinuteSlop ?? 5; const sec = ((Math.round(launch) % 60) + 60) % 60;
    const atChange = sec >= 60 - slop - 3 || sec <= slop + 3;
    const q = this.hint.clock ?? (atChange ? 'minute' : 'second');
    if (q === 'minute' && !this.hint.clock && !atChange) { this.seen.add(key); return null; }
    const to = launch - sim.tod; const lead = this.lead(key, 25, 45);
    if (to > lead) return null;
    if (to < 8) { this.seen.add(key); return null; }
    const h = sim.clock.hands(launch); const shown = Math.floor(h.minuteAngle / 6 + 1e-9) % 60; const misleading = shown !== h.minute;
    const ctx = this.ctx({ line, clock: this.clockView(), times: { launch } });
    const at = this.clk(launch); const inS = Math.round(to / 5) * 5;
    const prompt = q === 'minute' ? `You launch at ${at}, in about ${inS} s. Where do you read the minute from?`
      : q === 'second' ? `Launch at ${at}, in about ${inS} s; you know the minute. What do you count the second in from?`
        : `After the launch the book times an interval. What do you time it with?`;
    // the right instruments: the watch in TOD mode always gives the minute; the clock's minute hand only away from a minute change
    const good = q === 'minute' ? (atChange ? ['tod'] : ['tod', 'min']) : q === 'second' ? ['sec', 'tod'] : ['chrono'];
    const truth = q === 'second' ? 'sec' : q === 'interval' ? 'chrono' : 'tod';
    return this.make('clock', key, prompt, ctx, { options: this.shuffle(key, CLOCK_OPTS) }, { optionId: truth }, { q, good, truth, misleading, shown, minute: h.minute, atChange });
  }

  // pause: stopped at a STOP row with a printed pause
  private detectPause(): Pending | null {
    const sim = this.sim; if (!sim.waitingForGo || (sim.waitReason !== 'stop' && sim.waitReason !== 'hold')) return null;
    for (const p of this.nearPlans()) {
      const ins = p.ins; if (!((ins.pause ?? 0) > 0) || isHoldIns(ins) || p.stopHandled) continue;
      const key = `pause:${ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(this.scenario.course, ins.nodeId); if (!(node.control === 'STOP' || node.fullStop) || !this.atStopLine(node)) continue;
      // MOB-050: the printed number IS the graded number: the chart dwell (pause minus the stop-and-go loss, turn-capped when the row turns)
      const vIn = p.vIn || p.vOut; const dwell = r1(chartDwell(this.scenario, p));
      this.ov.go.set(ins.n, 'wait');
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), nextRow: this.row(this.nextIns(ins)), speeds: { current: 0, assigned: p.vOut, in: vIn, out: p.vOut }, times: { pauseSeconds: ins.pause! } });
      if (this.chartAvail()) ctx.chart = { kind: 'stopGo', vIn, vOut: p.vOut, seconds: dwell, meaning: 'sit' };
      const prompt = this.showChart()
        ? `Stopped at line ${ins.n}. Pause ${ins.pause} s, in ${vIn}, out ${p.vOut}: sit ${dwell.toFixed(1)} s on the watch, then tap GO.`
        : `Stopped at line ${ins.n}. Pause ${ins.pause} s, in ${vIn}, out ${p.vOut}. Sit the chart time, then tap GO.`;
      const timing: TimingSpec = { kind: 'countdown', truthSeconds: dwell, toleranceSeconds: TIMING_TOLERANCE.pause, maxSeconds: Math.max(dwell + 15, ins.pause! + 10), tapLabel: 'GO' };
      return this.make('pause', key, prompt, ctx, { timing }, { tapSeconds: dwell }, { ins, dwell });
    }
    return null;
  }

  // transitOut: the IN time of an exact transit was just taken
  private detectTransitOut(): Pending | null {
    const sim = this.sim;
    for (const p of this.nearPlans()) {
      const t = p.ins.transit; if (!t || !t.exact || t.end) continue;
      const tin = sim.transitIn[p.ins.n]; const key = `transitOut:${p.ins.n}`; if (tin === undefined || this.seen.has(key)) continue;
      const out = tin + t.seconds; const endIns = this.scenario.book.find(i => i.n > p.ins.n && i.transit?.end);
      // PT-14 N4: OUT is the earliest, the middle or the latest of the three equally often (mistakes: a minute carried wrong, 30 s or 10 s off)
      const cands = this.shuffle(key, this.ranked(key, out, [out - 60, out - 30, out - 10], [out + 60, out + 30, out + 10], 3));
      const opts = cands.map(c => ({ id: `t${c}`, label: clockStr(c) }));
      const ctx = this.ctx({ line: p.ins.n, row: this.row(p.ins), times: { in: tin, intervalSeconds: t.seconds } });
      return this.make('transitOut', key, `Exact transit, line ${p.ins.n}: IN ${this.clk(tin)}, take exactly ${formatInterval(t.seconds)}. What is your OUT time?`, ctx, { options: opts }, { optionId: `t${out}` }, { out, endIns });
    }
    return null;
  }

  // ta (MOB-051): the TA window is open for a delayed leg. The card prints the measured delay and what could be made up; the right claim is
  // what RULE-032 / RULE-033 teach from exactly those numbers (ruleClaim).
  private detectTa(): Pending | null {
    for (const leg of this.nav.pendingTaLegs()) {
      const key = `ta:${leg}`; if (this.seen.has(key) || this.ov.ta.has(leg)) continue;
      const adv = this.sim.taAdvice(leg); if (!(adv.measuredDelay > 0)) continue;
      const M = Math.round(adv.measured); const R = Math.min(M, Math.round(adv.recoverable)); const truth = ruleClaim(M, R);
      // PT-14 N4: the right claim is the smallest, second, third or largest of the four equally often (mistakes: claim everything,
      // round up, forget the made-up part, take it off twice, a step either way, no claim)
      const all = Math.floor(M / 10) * 10; const up = Math.ceil(Math.max(0, M - R) / 10) * 10;
      const cands = this.ranked(key, truth, [Math.max(0, truth - 10), Math.max(0, truth - 20), Math.floor(Math.max(0, M - 2 * R) / 10) * 10, Math.max(0, truth - 30), 0], [truth + 10, all, up, truth + 20, all + 10, truth + 30], 4).sort((a, b) => a - b);
      this.ov.ta.set(leg, 'wait');
      const opts = cands.map(c => ({ id: `c${c}`, label: c === 0 ? 'No claim' : `Claim ${formatInterval(c)}` }));
      const ctx = this.ctx({ ta: { measured: M, claim: truth, cause: adv.cause, legIndex: leg, madeUp: R } });
      const prompt = `TA point. Leg ${leg} was delayed ${formatInterval(M)} by a ${adv.cause ?? 'qualifying delay'}${R > 0 ? `; about ${R} s of it could be made up` : '; none of it could be made up'}. What do you claim?`;
      return this.make('ta', key, prompt, ctx, { options: opts }, { optionId: `c${truth}` }, { leg, oracle: truth, M, R });
    }
    return null;
  }

  /** A hazard the player does not own (no hazard and no make-up cards): the navigator makes the time up for the rest of the leg, as the oracle does. */
  private autoHazard(): void {
    if (this.owns('hazard') || this.owns('makeup')) return;
    const s = this.sim.car.s;
    for (let i = 0; i < this.scenario.hazards.length; i++) {
      const h = this.scenario.hazards[i]!; const key = `hazardAuto:${i}`; if (this.seen.has(key)) continue;
      const end = 'lengthFt' in h ? h.s + h.lengthFt : h.s;
      if (s >= h.s - 400 && s <= end + 50) { this.seen.add(key); if (this.ov.recovery.mode === 'off') this.ov.recovery = { mode: 'on', untilLeg: this.sim.legIndex }; }
    }
  }
  /** How long a hazard will hold the car: the micro scenario says; on a generated leg, from the hazard itself. */
  private hazardSize(h: Hazard, arrive: number): 'short' | 'long' {
    if (this.hint.size) return this.hint.size;
    if (h.kind === 'train') return h.startTod + h.durationSeconds - arrive > 20 ? 'long' : 'short';
    if (h.kind === 'tractor') return h.lengthFt > 600 ? 'long' : 'short';
    return 'long';
  }
  // hazard (MOB-055): a train, tractor, red light, slow truck or road work in sight. The card describes what is seen and how long it looks;
  // a qualifying delay that will be long: make up what you can and claim the rest (RULE-031..033); a short one or a light / truck: make it up.
  private detectHazard(): Pending | null {
    const sim = this.sim; const s = sim.car.s; const sc = this.scenario;
    for (let i = 0; i < sc.hazards.length; i++) {
      const h = sc.hazards[i]!; const key = `hazard:${i}`; if (this.seen.has(key)) continue;
      if (h.s < s - 5) { if (!('lengthFt' in h) || h.s + h.lengthFt < s) continue; }
      const d = h.s - s; const v = Math.max(sim.car.v, mphToFps(10)); const arrive = sim.tod + Math.max(0, d) / v;
      let show = false;
      // PT-14 item 10: the distance at which the card comes varies (no stamped "400 ft ahead")
      const f = this.lead(`${key}:d`, 0.6, 1.4);
      if (h.kind === 'slow' || h.kind === 'construction' || h.kind === 'accident' || h.kind === 'tractor' || h.kind === 'combine') show = d <= 400 * f;
      else if (h.kind === 'train') show = d <= 600 * f && (trainActive(h, sim.tod) || trainActive(h, arrive));
      else if (h.kind === 'signal') show = d <= 500 * f && d > 30 && signalIsRed(h, arrive) && !this.nav.plans.some(p => p.ins.pause !== undefined && Math.abs(p.s - h.s) < 5);
      else if (h.kind === 'schoolBus') show = d <= 600 && d > 0 && arrive >= h.startTod && arrive < h.startTod + h.durationSeconds;
      if (!show) { if (d < 0 && !('lengthFt' in h)) this.seen.add(key); continue; }
      // PT-14 C-1: the card follows RULE-031 (a red light is never a cause on the card, whatever rules.taForSignals says)
      const qualifying = (TA_CAUSES as readonly string[]).includes(h.kind);
      const size = this.hazardSize(h, arrive);
      const opts = this.shuffle(key, [{ id: 'ta', label: 'Claim the whole delay' }, { id: 'both', label: 'Make up what you can, claim the rest' }, { id: 'makeup', label: 'Make it all up' }]);
      const truth = qualifying && size === 'long' ? 'both' : 'makeup';
      // a short qualifying delay leaves nothing to claim: "make up what you can, claim the rest" claims nothing and is not wrong (RULE-032)
      const good = qualifying && size === 'short' ? ['makeup', 'both'] : [truth];
      const leg = sim.legIndex; const view = hazardScene(h, d, size);
      const ctx = this.ctx({ hazard: { kind: h.kind, label: view.label }, distanceFt: Math.max(0, Math.round(d / 50) * 50), speeds: { current: Math.round(sim.car.mph()), assigned: this.assigned() } });
      return this.make('hazard', key, `${view.scene} Your plan?`, ctx, { options: opts }, { optionId: truth }, { h, qualifying, leg, truth, good, size });
    }
    return null;
  }

  // lost (MOB-056): the car left the route; the card comes when the driver notices, 6-28 s later (never "0 s ago"). Turning round costs the
  // way out twice plus about 20 s to turn (RULE-034); when this road meets the route again, a detour that costs less is cheaper (RULE-043).
  private detectLost(): Pending | null {
    const sim = this.sim;
    if (sim.offCourseCount > this.lostSeen) {
      this.lostSeen = sim.offCourseCount;
      const ev = [...sim.events].reverse().find(e => e.type === 'offCourse');
      const node = ev ? this.scenario.course.nodes.find(n => n.id === ev.detail?.nodeId) : undefined;
      const exit = node?.exits?.find(e => e.angle === ev?.detail?.angle) ?? null;
      const delay = this.hint.lostAgo ?? Math.round(this.lead(`lost:${sim.offCourseCount}`, 6, 22));
      this.ov.uturn = 'wait';
      this.lostPending = { count: sim.offCourseCount, offTod: ev?.tod ?? sim.tod, delay, exit, nodeS: node?.s ?? sim.car.s, v: mphToFps(this.assigned()) };
    }
    const l = this.lostPending; if (!l) return null;
    const stuck = sim.waitingForGo && sim.waitReason === 'roadEnd';
    if (sim.tod < l.offTod + l.delay && !stuck) return null;
    this.lostPending = null;
    const key = `lost:${l.count}`; const ago = Math.max(1, Math.round(sim.tod - l.offTod));
    const rj = l.exit?.rejoin; const detour = rj ? Math.max(5, Math.round((rj.afterFt - rj.atFt) / l.v / 5) * 5) : null;
    const back = 2 * ago + 20;
    const truth = detour !== null && detour < back && !stuck ? 'continue' : 'uturn';
    const opts = this.shuffle(key, [{ id: 'uturn', label: 'Turn around, time it' }, { id: 'continue', label: 'Keep going, rejoin ahead' }, { id: 'ta', label: 'Keep going, claim a TA' }]);
    const prompt = detour !== null
      ? `You left the route ${ago} s ago. This road rejoins it: a detour about ${detour} s longer. What now?`
      : `You left the route ${ago} s ago; this road does not meet it again. What now?`;
    const ctx = this.ctx({ lost: { agoSeconds: ago, detourSeconds: detour }, note: 'Off course' });
    return this.make('lost', key, prompt, ctx, { options: opts }, { optionId: truth }, { offTod: l.offTod, events0: sim.events.length, truth, ago, detour, back });
  }

  // checkpoint (MOB-055): a green timing sign (do nothing, RULE-003), a red GREAT RACE STOP board (stop and talk to the worker, RULE-003),
  // or a green sign with the rally car ahead slowing and pulling off before it (still do nothing: never 5 mph near a green sign, RULE-004)
  private detectCheckpoint(): Pending | null {
    const sim = this.sim; const s = sim.car.s;
    const look = this.hint.checkpoint ?? 'green';
    const cp = this.scenario.checkpoints.find(c => c.s > s); if (!cp) return null;
    if (cp.kind !== (look === 'red' ? 'observation' : 'timing')) return null;
    const key = `checkpoint:${cp.id}`; if (this.seen.has(key)) return null;
    const d = cp.s - s; if (d > cp.sightDistance || d < 150 || sim.car.mode !== 'cruise' || sim.waitingForGo) return null;
    const opts = this.shuffle(key, [{ id: 'nothing', label: 'Hold speed' }, { id: 'slow', label: 'Slow right down' }, { id: 'stop', label: 'Stop and check in' }]);
    const ft = Math.round(d / 50) * 50; const assigned = this.assigned();
    const prompt = look === 'red' ? `A red GREAT RACE STOP board is ${ft} ft ahead. What do you do?`
      : look === 'carAhead' ? `A green CHECKPOINT sign is ${ft} ft ahead. The rally car ahead slows and pulls off before it. What do you do?`
        : `A green CHECKPOINT sign is ${ft} ft ahead; you are at ${assigned}, on time. What do you do?`;
    const ctx = this.ctx({ distanceFt: ft, speeds: { current: Math.round(sim.car.mph()), assigned }, note: look === 'red' ? 'Red STOP board' : 'Green CHECKPOINT sign' });
    const truth = look === 'red' ? 'stop' : 'nothing';
    return this.make('checkpoint', key, prompt, ctx, { options: opts }, { optionId: truth }, { cp, look, truth });
  }

  // turn: the decision point of a turn line is within the lead distance
  private detectTurn(): Pending | null {
    const sim = this.sim; const car = sim.car;
    for (const p of this.nearPlans()) {
      const ins = p.ins; if (!ins.turn || ins.turn === 'S' || p.turnCalled) continue;
      const key = `turn:${ins.n}`; if (this.seen.has(key)) continue;
      // PT-14 item 10: the call comes 1-1.5 x the navigator's own call distance out (no stamped "600 ft ahead")
      const lead = Math.max(600, car.v * 9) * this.lead(`${key}:d`, 1.0, 1.5) + car.v * 0.5;
      const o = this.ov.turn.get(ins.n); if (o && o !== 'wait' && o.dir === null) continue;   // a deliberately missed turn (lost scenarios)
      const d = p.s - car.s; if (d > lead || d < 0) continue;
      if (d < 250 && car.v > mphToFps(15)) { this.seen.add(key); continue; }   // too close to be fair: the navigator calls it
      const cap = capFor(this.scenario, ins.turn) ?? 15; const brake = Math.max(0, (car.v ** 2 - mphToFps(cap) ** 2) / (2 * this.scenario.car.aDec));
      const deadline = Math.max(1, r1((d - brake) / Math.max(car.v, mphToFps(5)) - 1));
      this.ov.turn.set(ins.n, 'wait');
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), nextRow: this.row(this.nextIns(ins)), distanceFt: Math.round(d / 50) * 50, speeds: { current: Math.round(car.mph()), assigned: this.assigned() } });
      const remark = ins.remark ? ` Book: "${ins.remark}".` : '';
      return this.make('turn', key, `Line ${ins.n} is ${Math.round(d / 50) * 50} ft ahead.${remark} Call the turn.`, ctx, { options: this.turnOptions(key, ins, ins.turn), deadlineSeconds: deadline }, { optionId: ins.turn, tapSeconds: 0 }, { ins, truth: ins.turn, deadline });
    }
    return null;
  }

  // timedStart: a timed line's sign is a few seconds ahead
  private detectTimed(): Pending | null {
    const sim = this.sim; const car = sim.car; const sc = this.scenario;
    for (const p of this.nearPlans()) {
      const ins = p.ins; const seg = ins.timed; if (!seg || p.speedCalled) continue;
      const key = `timedStart:${ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(sc.course, ins.nodeId); if (node.control === 'STOP' || node.fullStop || isHoldIns(ins)) continue;
      const d = p.s - car.s; if (d < 0) { this.seen.add(key); continue; }
      const tSign = d / Math.max(car.v, 1); const lead = this.lead(key, 3.5, 6);   // PT-14 N7: the sign 3.5-6 s after the card (was 4-8)
      if (tSign > lead) continue;
      if (tSign < 1.5 || !this.steadyAt(p.vIn || seg.holdSpeed) || this.hazardBefore(p.s + mphToFps(seg.holdSpeed) * seg.seconds)) { this.seen.add(key); continue; }
      // PT-14 C-2: the interval starts where the speed change is, the moment the car's own front reaches the sign (REG VII.E.2.d), as
      // the watch card's lap does; never the ghost's arrival (a car off pace would be graded against a time the card never showed)
      const L = chartLead(seg.holdSpeed, seg.thenSpeed, sc.car);
      const t1 = r1(tSign); const t2 = r1(t1 + seg.seconds - L);
      this.ov.timed.set(ins.n, 'wait');
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), distanceFt: Math.round(d), speeds: { current: Math.round(car.mph()), assigned: seg.holdSpeed }, times: { intervalSeconds: seg.seconds } });
      if (this.chartAvail()) ctx.chart = { kind: 'lead', vIn: seg.holdSpeed, vOut: seg.thenSpeed, seconds: L, meaning: 'lead' };
      // MOB-052: Dad says "Mark!" as the front of the car reaches the sign (RULE-022); the distance bar reaches zero then
      const prompt = this.showChart()
        ? `Line ${ins.n}: START on Dad's Mark!, then CALL ${seg.thenSpeed} ${L.toFixed(1)} s before the ${formatInterval(seg.seconds)} ends.`
        : `Line ${ins.n}: START on Dad's Mark!, then CALL ${seg.thenSpeed} half a ramp before the ${formatInterval(seg.seconds)} ends.`;
      const timing: TimingSpec = { kind: 'startStop', truthSeconds: t1, secondTapSeconds: t2, toleranceSeconds: TIMING_TOLERANCE.timedStart, maxSeconds: Math.max(t2 + 12, t1 + seg.seconds + 8), tapLabel: 'START', secondTapLabel: `CALL ${seg.thenSpeed}`, signSeconds: t1, signFt: Math.round(d) };
      return this.make('timedStart', key, prompt, ctx, { timing }, { taps: [t1, t2] }, { ins, t1, t2 });
    }
    return null;
  }

  // speedChange: a landmark speed change is in sight
  private detectSpeed(): Pending | null {
    const sim = this.sim; const car = sim.car; const sc = this.scenario;
    for (const p of this.nearPlans()) {
      const ins = p.ins; if (ins.speed === undefined || ins.timed || p.speedCalled || !(p.vIn > 0) || ins.speed === p.vIn) continue;
      const key = `speedChange:${ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(sc.course, ins.nodeId); if (node.control === 'STOP' || node.fullStop || isHoldIns(ins) || ins.section === 'start' || ins.section === 'restart') continue;
      const o = this.ov.speed.get(ins.n); const mph = o && o !== 'wait' ? o.mph : ins.speed;
      const ld = rampLead(p.vIn, ins.speed, sc.car); const d = p.s - car.s; const tCall = (d - mphToFps(p.vIn) * ld - 1) / Math.max(car.v, 1);
      const lead = this.lead(key, 5, 10);   // PT-14 N7: the call 5-10 s after the card (was 8-16)
      if (tCall > lead) continue;
      if (tCall < 2 || !this.steadyAt(p.vIn) || this.hazardBefore(p.s)) { if (tCall < 2 || this.hazardBefore(p.s)) this.seen.add(key); continue; }
      void mph;
      this.ov.speed.set(ins.n, 'wait');
      const t = r1(tCall);
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), distanceFt: Math.round(d / 10) * 10, speeds: { current: Math.round(car.mph()), assigned: p.vIn, in: p.vIn, out: ins.speed } });
      const L = chartLead(p.vIn, ins.speed, sc.car);
      if (this.chartAvail()) ctx.chart = { kind: 'lead', vIn: p.vIn, vOut: ins.speed, seconds: L, meaning: 'lead' };
      // MOB-052: the sign arrives on screen (distance bar to zero, Dad's "Mark!" at the sign); the call leads it by the chart lead
      const prompt = this.showChart()
        ? `Line ${ins.n}: ${p.vIn} to ${ins.speed} at the sign. Call ${ins.speed} ${L.toFixed(1)} s before Dad's Mark!`
        : `Line ${ins.n}: ${p.vIn} to ${ins.speed} at the sign. Call ${ins.speed} half a ramp before Dad's Mark!`;
      const signSeconds = r1(d / Math.max(car.v, 1));
      const timing: TimingSpec = { kind: 'tapAt', truthSeconds: t, toleranceSeconds: TIMING_TOLERANCE.speedChange, maxSeconds: Math.max(t + 12, signSeconds + 4), tapLabel: `CALL ${ins.speed}`, signSeconds, signFt: Math.round(d) };
      return this.make('speedChange', key, prompt, ctx, { timing }, { tapSeconds: t }, { ins, plan: p, t, lead: ld });
    }
    return null;
  }

  // watch (MOB-053): the navigator laps the watch as the car reaches a timed line's sign; just after, the card shows the watch (main digits
  // and the lap table) and asks at which reading to call the next speed: the lap's cumulative plus the interval minus the lead (RULE-021).
  private detectWatch(): Pending | null {
    const sim = this.sim; const car = sim.car; const sc = this.scenario;
    const w = this.watchArm;
    if (w) {
      if (sim.tod < w.crossTod + 1.5) return null;
      this.watchArm = null;
      const seg = w.plan.ins.timed!; const laps = sim.watch.lapTable(); const lap = laps[laps.length - 1];
      if (!lap || !sim.watch.running) { this.fallbackWatch(w); return null; }
      const reading = sim.watch.reading(sim.tod); const L = chartLead(seg.holdSpeed, seg.thenSpeed, sc.car);
      const truth = r1(lap.cumulative + seg.seconds - L);
      // PT-14 N4: the right reading is the smallest .. largest of the four equally often (mistakes: no lead, the lead added, the lead twice,
      // a second or two off the interval)
      const floor = reading + 1;
      const vals = this.ranked(w.key, truth, [r1(truth - L), r1(truth - 2), r1(truth - L - 2), r1(truth - 3)].filter(x => x > floor), [r1(truth + L), r1(truth + 2 * L), r1(truth + 2), r1(truth + 3)], 4, (a, b) => Math.abs(a - b) < 0.45);
      const opts = this.shuffle(w.key, vals).map(x => ({ id: `r${x}`, label: formatInterval(x, true) }));
      const ctx = this.ctx({ line: w.n, row: this.row(w.plan.ins), speeds: { current: Math.round(car.mph()), assigned: seg.holdSpeed }, times: { intervalSeconds: seg.seconds }, watch: { reading: r1(reading), laps: laps.slice(-3).map(x => ({ interval: r1(x.interval), cumulative: r1(x.cumulative) })) } });
      if (this.chartAvail()) ctx.chart = { kind: 'lead', vIn: seg.holdSpeed, vOut: seg.thenSpeed, seconds: L, meaning: 'lead' };
      // PT-14 item 9: the lap and the lead the rule needs are in the prompt at rung 2 (the lead stays behind the Chart button at rung 1)
      const prompt = this.showChart()
        ? `Line ${w.n}: ${seg.holdSpeed} for ${formatInterval(seg.seconds)}, then ${seg.thenSpeed}; lead ${L.toFixed(1)} s. You lapped ${formatInterval(lap.cumulative, true)} at the sign. Call ${seg.thenSpeed} at?`
        : `Line ${w.n}: ${seg.holdSpeed} for ${formatInterval(seg.seconds)}, then ${seg.thenSpeed}. You lapped ${formatInterval(lap.cumulative, true)} at the sign. Call ${seg.thenSpeed} at?`;
      return this.make('watch', w.key, prompt, ctx, { options: opts }, { optionId: `r${truth}` }, { n: w.n, truth, L, reading, seg });
    }
    for (const p of this.nearPlans()) {
      const ins = p.ins; const seg = ins.timed; if (!seg || p.speedCalled) continue;
      const key = `watch:${ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(sc.course, ins.nodeId); if (node.control === 'STOP' || node.fullStop || isHoldIns(ins)) continue;
      const d = p.s - car.s; if (d < 0) { this.seen.add(key); continue; }
      const tSign = d / Math.max(car.v, 1);
      if (tSign > 6) continue;
      this.seen.add(key);
      if (tSign < 1 || !this.steadyAt(p.vIn || seg.holdSpeed) || this.hazardBefore(p.s + mphToFps(seg.holdSpeed) * seg.seconds) || seg.seconds < 12 || !sim.watch.running) continue;
      const crossTod = sim.tod + tSign;
      this.ov.timed.set(ins.n, { lapAt: crossTod, callAt: Infinity });
      this.watchArm = { n: ins.n, crossTod, plan: p, key };
      return null;
    }
    return null;
  }
  private fallbackWatch(w: { n: number; crossTod: number; plan: NavPlan }): void {
    const seg = w.plan.ins.timed!; const tmov = this.ov.timed.get(w.n);
    this.ov.timed.set(w.n, { lapAt: tmov && tmov !== 'wait' ? tmov.lapAt : w.crossTod, callAt: w.crossTod + seg.seconds - rampLead(seg.holdSpeed, seg.thenSpeed, this.scenario.car) });
  }

  // makeup (MOB-055): >= 5 s off in open cruise. The card prints the lateness, the open road left (to the checkpoint or to a timed interval,
  // inside which nothing may be made up, RULE-027) and any posted limit. By the cards: +10 % takes 10 x S seconds (RULE-025), +20 % takes
  // 5 x S (RULE-026), never above the limit (RULE-005); either fits = either is right.
  private detectMakeup(): Pending | null {
    const sim = this.sim; if (this.ov.recovery.mode !== 'off') return null;
    const leg = sim.legIndex; if (this.seen.has(`makeup:${leg}`) || sim.tod < this.makeupCooldown) return null;
    const key = `makeup:${leg}:${[...this.seen].filter(x => x.startsWith(`makeup:${leg}:`)).length}`;
    if (!this.nav.inOpenCruise()) return null;
    const pace = this.safePace(); if (Math.abs(pace) < 5) return null;
    const assigned = this.assigned(); if (!this.steadyAt(assigned)) return null;
    const cp = this.scenario.checkpoints.find(c => c.s > sim.car.s); if (!cp) return null;
    const fps = mphToFps(assigned);
    const timed = this.nav.plans.find(p => p.s > sim.car.s && p.s < cp.s && p.ins.timed);
    const roomFt = (timed ? timed.s : cp.s) - sim.car.s;
    const T = Math.floor(roomFt / fps / 5) * 5; const S = Math.round(Math.abs(pace)); const late = pace > 0;
    const limit = this.hint.limit;
    const ok10 = 10 * S <= T && (limit === undefined || !late || assigned * 1.1 <= limit + 1e-9);
    const ok20 = 5 * S <= T && (limit === undefined || !late || assigned * 1.2 <= limit + 1e-9);
    if (!ok10 && !ok20) return null;   // nowhere to recover safely before the checkpoint / interval
    const good = new Set<string>(); if (ok10) good.add('p10'); if (ok20) good.add('p20');
    const nxPause = this.nav.plans.find(p => p.s > sim.car.s && p.s < cp.s && (p.ins.pause ?? 0) > 0 && !isHoldIns(p.ins));
    const nxDwell = nxPause ? chartDwell(this.scenario, nxPause) : 0;
    if (late && nxPause && nxDwell >= S) good.add('stop');
    const best = ok10 ? 'p10' : 'p20';
    const sg = late ? '+' : '−';
    const opts: DecisionOption[] = [
      { id: 'p10', label: `${sg}10 % for ${10 * S} s` },
      { id: 'p20', label: `${sg}20 % for ${5 * S} s` },
      { id: 'leave', label: `Hold ${assigned}` },
    ];
    if (late && nxPause) opts.push({ id: 'stop', label: `Cut the stop at line ${nxPause.ins.n}` });
    const room = timed ? `a timed interval starts in about ${T} s` : `about ${T} s of open road left`;
    const ctx = this.ctx({ lateSeconds: r1(pace), speeds: { current: Math.round(sim.car.mph()), assigned }, room: { what: timed ? 'timed' : 'checkpoint', ft: Math.round(roomFt / 50) * 50 }, ...(limit !== undefined ? { limit } : {}) });
    const prompt = `${S} s ${late ? 'late' : 'early'} at ${assigned} mph${limit !== undefined ? `, posted limit ${limit}` : ''}; ${room}. Your plan?`;
    const m10 = r1(assigned * (late ? 1.1 : 0.9)), m20 = r1(assigned * (late ? 1.2 : 0.8));
    return this.make('makeup', key, prompt, ctx, { options: this.shuffle(key, opts) }, { optionId: best }, { good: [...good], late, a: S, nxPause, nxDwell, cp, m10, m20, limit, timed: !!timed, T });
  }

  // ------------------------------------------------------------------ grading
  private grade(p: Pending, res: DecisionResponse | null): Omit<Verdict, 'nextDecisionIn'> {
    const k = p.d.kind;
    /** MOB-054: the rule sentence is picked by what decided the card (`variant`); `missed` names the missed part for the headline. */
    const base = (correct: boolean, seconds: number, expected: string, chosen: string, variant?: Variant, missed?: string) => {
      const vr = verdictRule(k, variant);
      return { decisionId: p.d.id, kind: k, skill: p.d.skill, secondsDelta: r1(seconds), correct, rule: vr.sentence, ruleId: vr.card.id, source: vr.card.source, expected, chosen, ...(!correct && missed ? { missed } : {}) };
    };
    const tap = (fallback: number): number => res?.tapSeconds !== undefined ? Math.max(0, res.tapSeconds) : fallback;
    const early = (x: number): string => `${Math.abs(x).toFixed(1)} s ${x > 0 ? 'late' : 'early'}`;
    const sim = this.sim;
    switch (k) {
      case 'pause': {
        const dwell = p.x.dwell as number; const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds);
        this.ov.go.set(ins.n, p.tod0 + t);
        const delta = t - dwell; const none = res?.tapSeconds === undefined;
        return base(Math.abs(delta) <= TIMING_TOLERANCE.pause, delta, `GO at ${dwell.toFixed(1)} s`, none ? 'no GO' : `GO at ${t.toFixed(1)} s`, none ? 'nogo' : delta < 0 ? 'early' : 'default', none ? 'no GO' : `GO ${early(delta)}`);
      }
      case 'restart': {
        const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds); const truth = p.d.timing!.truthSeconds;
        if (ins.n === 1 && sim.phase === 'preread') this.ov.depart = p.tod0 + t; else this.ov.go.set(ins.n, p.tod0 + t);
        const delta = t - truth; const none = res?.tapSeconds === undefined;
        const minuteOff = Math.abs(delta) >= 45;
        const onOwn = !minuteOff && Math.abs(delta - (p.x.netLoss as number)) < 1 && (p.x.netLoss as number) >= 1;
        const variant = p.x.variant === 'lunch' ? 'lunch' : minuteOff ? (p.x.byBase ? 'base' : 'minute') : onOwn ? 'default' : (p.x.byBase ? 'base' : 'default');
        return base(Math.abs(delta) <= TIMING_TOLERANCE.restart, delta, `${p.x.what === 'lunch' ? 'Leave' : 'Launch'} at ${clockStr(p.x.launch as number)}`, none ? 'no tap' : `${clockStr(p.tod0 + t)}${Math.abs(delta) >= 0.05 ? ` (${signed(delta)})` : ''}`, variant,
          none ? 'no LAUNCH' : minuteOff ? `a minute ${delta > 0 ? 'late' : 'early'}` : onOwn ? 'launched on your own time, not early by the loss' : `LAUNCH ${early(delta)}`);
      }
      case 'timedStart': {
        const ins = p.x.ins as Instruction; const t1 = p.x.t1 as number; const t2 = p.x.t2 as number;
        const taps = res?.taps && res.taps.length >= 1 ? res.taps.map(x => Math.max(0, x)) : res?.tapSeconds !== undefined ? [Math.max(0, res.tapSeconds)] : [];
        const a = taps[0] ?? t1; const b = taps[1] ?? Math.max(a, t2 + 5);
        this.ov.timed.set(ins.n, { lapAt: p.tod0 + a, callAt: p.tod0 + Math.max(a, b) });
        const callDelta = Math.max(a, b) - t2; const startDelta = a - t1;
        const startOk = Math.abs(startDelta) <= 1.5; const callOk = Math.abs(callDelta) <= TIMING_TOLERANCE.timedStart;
        // MOB-054 / BUG-11: the headline seconds are the part that was missed (START first)
        const delta = !taps.length ? callDelta : !startOk ? startDelta : callDelta;
        return base(startOk && callOk && taps.length > 0, delta, `START on Mark!, CALL at ${t2.toFixed(1)} s`, taps.length ? `START ${signed(startDelta)}, CALL at ${Math.max(a, b).toFixed(1)} s` : 'no taps',
          !taps.length || startOk ? 'default' : 'start', !taps.length ? 'no START' : !startOk ? `START ${early(startDelta)}` : `CALL ${early(callDelta)}`);
      }
      case 'speedChange': {
        const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds);
        this.ov.speed.set(ins.n, { mph: ins.speed!, at: p.tod0 + t });
        // D05 grading: the call against the sign crossing minus the lead (the car holds its speed to the sign: no hazard or stop between)
        const delta = t - (p.x.t as number); const none = res?.tapSeconds === undefined;
        return base(Math.abs(delta) <= TIMING_TOLERANCE.speedChange, delta, `CALL ${(p.x.lead as number).toFixed(1)} s before the sign`, none ? 'no call' : early(delta), delta < 0 && !none ? 'early' : 'late', none ? 'no CALL' : `CALL ${early(delta)}`);
      }
      case 'turn': {
        const ins = p.x.ins as Instruction; const truth = p.x.truth as TurnDir; const chosen = res?.optionId as TurnDir | undefined;
        const valid = chosen && (['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR', 'JL', 'JR'] as string[]).includes(chosen) ? chosen : null;
        const t = res?.tapSeconds !== undefined ? Math.max(0, res.tapSeconds) : 0;
        this.ov.turn.set(ins.n, { dir: valid, at: p.tod0 + t });
        const plan = this.nav.plans.find(x => x.ins === ins)!; const off0 = sim.offCourseCount;
        const lostOwned = this.kinds.has('lost');
        this.suppress++;
        this.run(() => sim.offCourseCount > off0 || sim.car.s > plan.s + 200, 600);
        if (sim.offCourseCount > off0 && !lostOwned) this.run(() => sim.events.slice(-30).some(e => e.type === 'rejoin') && sim.car.mode === 'cruise', 900);
        this.suppress--;
        const went = sim.offCourseCount > off0;
        const late = valid === truth && t > (p.x.deadline as number);
        return base(!went && valid === truth && !late, went ? Math.max(0, this.safePace() - p.pace0) : 0, turnWord(truth), valid ? `${turnWord(valid)}${late ? ' (late)' : ''}` : 'no call', late ? 'late' : 'default', !valid ? 'no call' : late ? 'the call came too late' : `called ${turnWord(valid)}`);
      }
      case 'preread': {
        const what = p.x.what as string; const ins = p.x.ins as Instruction; const opt = res?.optionId ?? '';
        if (what === 'turn') {
          const truth = p.x.truth as TurnDir; const ok = opt === truth;
          if (!ok) this.ov.turn.set(ins.n, { dir: (opt || null) as TurnDir | null });
          const cost = ok ? 0 : 2 * (this.scenario.excursionFt ?? 2640) / mphToFps(30) + 20;
          return base(ok, cost, turnWord(truth), opt ? turnWord(opt as TurnDir) : 'no answer', 'turn', 'the bold arrow');
        }
        if (what === 'pause') {
          const truth = p.x.truth as number; const v = Number(opt.slice(1)); const ok = opt === `w${truth}`;
          if (!ok) this.ov.dwell.set(ins.n, Number.isFinite(v) ? v : 0);
          return base(ok, ok ? 0 : (Number.isFinite(v) ? v : 0) - truth, `Wait ${truth} s`, opt ? (v === 0 ? 'Go at once' : `Wait ${v} s`) : 'no answer', 'pause', 'the pause minus the loss');
        }
        const truth = p.x.truth as number; const v = Number(opt.slice(1)); const ok = v === truth;
        if (!ok && Number.isFinite(v) && v > 0) this.ov.speed.set(ins.n, { mph: v });
        // projected cost: the wrong speed held to the next speed line
        const plan = p.x.plan as NavPlan; const nx = this.nav.plans.find(q => q.s > plan.s && (q.ins.speed !== undefined || q.ins.timed));
        const dist = (nx ? nx.s : this.scenario.course.lengthFt) - plan.s;
        const cost = ok || !(v > 0) ? (ok ? 0 : 60) : dist / mphToFps(v) - dist / mphToFps(truth);
        return base(ok, cost, `${truth} mph`, opt ? `${v} mph` : 'no answer', 'speed', 'the speed in Column C');
      }
      case 'transitOut': {
        const out = p.x.out as number; const endIns = p.x.endIns as Instruction | undefined; const chosen = Number((res?.optionId ?? '').slice(1));
        const ok = chosen === out;
        if (!ok && endIns) {
          const plan = this.nav.plans.find(x => x.ins === endIns);
          const pick = Number.isFinite(chosen) && chosen > 0 ? chosen : out + 60;
          this.ov.go.set(endIns.n, pick - Math.round(accelLoss(plan?.vOut ?? 30, this.scenario.car)));
          this.seen.add(`restart:${endIns.n}`); this.seen.add(`clock:${endIns.n}`);
        }
        const d = (Number.isFinite(chosen) && chosen > 0 ? chosen : out + 60) - out;
        return base(ok, ok ? 0 : d, `OUT ${clockStr(out)}`, Number.isFinite(chosen) && chosen > 0 ? `OUT ${clockStr(chosen)}` : 'no answer', 'default', `OUT a minute ${d > 0 ? 'late' : 'early'}`);
      }
      case 'clock': {
        const q = p.x.q as string; const good = p.x.good as string[]; const opt = res?.optionId && CLOCK_LABEL[res.optionId] ? res.optionId : null;
        if (q === 'minute') sim.act({ type: 'clock.read', source: opt === 'min' || opt === 'sec' ? 'clock' : 'stopwatch' });
        const ok = !!opt && good.includes(opt);
        // what the wrong instrument risks: the loose minute hand a minute, the chrono no time of day at all, the clock's second hand for an interval a second or two
        const cost = ok ? 0 : q === 'interval' ? 2 : opt === 'chrono' ? 60 : q === 'minute' ? 60 : 5;
        const truth = p.x.truth as string;
        return base(ok, cost, CLOCK_LABEL[truth]!, opt ? CLOCK_LABEL[opt]! : 'no answer', q === 'second' ? 'second' : q === 'interval' ? 'interval' : p.x.atChange ? 'default' : 'mid',
          q === 'minute' ? 'the minute' : q === 'second' ? 'the launch second' : 'the interval');
      }
      case 'watch': {
        const truth = p.x.truth as number; const n = p.x.n as number; const seg = p.x.seg as { holdSpeed: number; seconds: number; thenSpeed: number };
        const x = Number((res?.optionId ?? '').slice(1)); const chosen = Number.isFinite(x) && x > 0 ? x : truth + 5;
        const reading = p.x.reading as number; const tmov = this.ov.timed.get(n);
        this.ov.timed.set(n, { lapAt: tmov && tmov !== 'wait' ? tmov.lapAt : p.tod0, callAt: p.tod0 + (chosen - reading) });
        void seg;
        const ok = Math.abs(chosen - truth) < 0.05;
        return base(ok, chosen - truth, `CALL at ${formatInterval(truth, true)}`, res?.optionId ? `CALL at ${formatInterval(chosen, true)}` : 'no answer', 'default', `CALL ${early(chosen - truth)}`);
      }
      case 'ta': {
        const leg = p.x.leg as number; const oracle = p.x.oracle as number; const c = Number((res?.optionId ?? '').slice(1));
        const claim = Number.isFinite(c) && c >= 0 ? c : 0;
        this.ov.ta.set(leg, claim); this.nav.fileTa(leg, claim);
        // seconds this claim left on the table (+) or claimed beyond what the rule allows (-)
        const over = claim > oracle;
        return base(claim === oracle, oracle - claim, oracle ? `Claim ${formatInterval(oracle)}` : 'No claim', claim ? `Claim ${formatInterval(claim)}` : 'No claim', over ? 'over' : 'default',
          over ? `claimed ${claim - oracle} s more than you could not make up` : `claimed ${oracle - claim} s less than the rule`);
      }
      case 'hazard': {
        const h = p.x.h as Hazard; const qualifying = p.x.qualifying as boolean; const truth = p.x.truth as string; const leg = p.x.leg as number; const good = p.x.good as string[];
        const opt = res?.optionId === 'ta' || res?.optionId === 'makeup' || res?.optionId === 'both' ? res.optionId : 'ta';
        if (opt === 'makeup' || opt === 'both') this.ov.recovery = { mode: 'on', untilLeg: leg };
        // a leg is claimed when any of its hazards was answered with a claim; 'makeup' alone files nothing for it
        if (opt === 'makeup') { if (!this.ov.ta.has(leg)) this.ov.ta.set(leg, 'skip'); }
        else if (this.ov.ta.get(leg) === 'skip') this.ov.ta.delete(leg);
        this.seen.add(`makeup:${leg}`);
        // the verdict moment: the hazard is behind the car and it is back at speed
        const end = 'lengthFt' in h ? h.s + h.lengthFt : h.s;
        const pace0 = p.pace0;
        this.suppress++; this.run(() => sim.car.s > end + 50 && (sim.car.mode === 'cruise' || sim.car.s > end + 2000), 1800); this.suppress--;
        const D = Math.max(0, this.safePace() - pace0);
        const adv = sim.taAdvice(leg);
        const cp = this.scenario.checkpoints.find(c => c.s > sim.car.s);
        const R = qualifying ? Math.min(D, adv.recoverable) : Math.min(D, cp ? (cp.s - sim.car.s) / mphToFps(this.assigned()) * (1 - 1 / 1.1) : 0);
        const ok = good.includes(opt);
        const cost = ok ? 0 : qualifying ? (opt === 'makeup' ? Math.max(0, D - R) : Math.min(D, R)) : (opt === 'makeup' ? 0 : D);
        const label: Record<string, string> = { ta: 'Claim the whole delay', makeup: 'Make it all up', both: 'Make up what you can, claim the rest' };
        // MOB-054: the sentence that decides it: a light is not named (make it up); a delay you cannot fully make up is claimed; never claim what you can make up
        const variant = h.kind === 'signal' ? 'light' : !qualifying ? 'noTa' : opt === 'makeup' ? 'claim' : 'small';
        const missed = !qualifying ? (h.kind === 'signal' ? 'a traffic light is not a Time Allowance' : 'not a Time Allowance cause') : opt === 'ta' ? 'claimed time you can make up' : 'the delay you could not make up was not claimed';
        return base(ok, cost, label[truth]!, res?.optionId ? label[opt]! : 'no answer', variant, missed);
      }
      case 'makeup': {
        const opt = res?.optionId ?? 'leave'; const good = p.x.good as string[]; const a = p.x.a as number; const late = p.x.late as boolean;
        const cp = p.x.cp as { s: number; id: string }; const limit = p.x.limit as number | undefined; const timed = p.x.timed as boolean;
        this.makeupCooldown = sim.tod + 45;
        const want = good.includes('p10') ? `${late ? '+' : '−'}10 %` : `${late ? '+' : '−'}20 %`;
        const variantFor = (o: string): string => o === 'p20' && !good.includes('p20') ? (limit !== undefined ? 'limit' : 'big') : o === 'p10' && !good.includes('p10') ? (timed ? 'room' : 'big') : o === 'p20' ? 'big' : 'default';
        if (opt === 'p10' || opt === 'p20') {
          const pct = opt === 'p10' ? 10 : 20;
          this.ov.recovery = { mode: 'on', pct, sinceLeg: sim.legIndex };
          const recs = sim.records.length; const int0 = this.nav.interrupted;
          // the verdict moment: back on time, the checkpoint, or the first line that needs precise work (the make-up resumes after it)
          this.suppress++; this.run(() => (this.ov.recovery.mode === 'off' && this.nav.recovering === null) || sim.records.length > recs || this.nav.interrupted > int0 || sim.waitingForGo, 900); this.suppress--;
          const crossed = sim.records.length > recs; const done = this.ov.recovery.mode === 'off';
          const tLeft = (cp.s - sim.car.s) / mphToFps(this.assigned());
          const gain = Math.max(0, tLeft) * pct / (100 + pct);
          const resid = crossed ? (sim.result().score.legs.find(l => l.cpId === cp.id)?.rawError ?? this.safePace()) : done ? this.safePace() : Math.sign(this.safePace()) * Math.max(0, Math.abs(this.safePace()) - gain);
          const ok = good.includes(opt);
          return base(ok, resid, want, opt === 'p10' ? `${late ? '+' : '−'}10 %` : `${late ? '+' : '−'}20 %`, variantFor(opt),
            opt === 'p20' && limit !== undefined ? `+20 % is above the posted ${limit}` : opt === 'p10' ? `10 x ${a} s does not fit before the ${timed ? 'timed interval' : 'checkpoint'}` : 'the wrong rate');
        }
        if (opt === 'stop' && p.x.nxPause) {
          const np = p.x.nxPause as NavPlan; const dwell = p.x.nxDwell as number;
          this.ov.dwell.set(np.ins.n, Math.max(0, dwell - a)); this.seen.add(`pause:${np.ins.n}`);
          return base(good.includes('stop'), Math.max(0, a - dwell) * (late ? 1 : -1), want, `Cut the stop at line ${np.ins.n}`, 'stop', 'the stop is shorter than the time owed');
        }
        this.seen.add(`makeup:${sim.legIndex}`);   // left: no second card in this leg
        return base(false, late ? a : -a, want, 'Leave it', 'default', `${a} s left on the table`);
      }
      case 'lost': {
        const opt = res?.optionId ?? 'continue'; const truth = p.x.truth as string;
        if (opt === 'uturn') { sim.act({ type: 'call.uturn' }); sim.act({ type: 'watch.lap' }); this.nav.markOffHandled(); this.ov.uturn = 'auto'; }
        else this.ov.uturn = 'deadEnd';
        const ev0 = p.x.events0 as number;
        this.suppress++; this.run(() => sim.events.slice(ev0).some(e => e.type === 'rejoin') && (sim.car.mode === 'cruise' || sim.waitingForGo), 1800); this.suppress--;
        this.ov.uturn = 'auto';
        const ok = opt === truth;
        const detour = p.x.detour as number | null; const back = p.x.back as number;
        // the cost against the better choice: with a road that meets the route again, the difference of the two by the card's numbers;
        // on a dead end, what the trip out and back cost beyond turning round at once
        const ago = Math.max(0, p.tod0 - (p.x.offTod as number));
        const cost = ok ? 0 : detour !== null ? Math.abs(back - detour) : Math.max(0, this.safePace() - p.pace0 - (ago + 20));
        const label: Record<string, string> = { uturn: 'Turn around now', continue: 'Keep going, rejoin', ta: 'Claim a TA' };
        const variant = opt === 'ta' ? 'ta' : truth === 'continue' ? 'loop' : 'default';
        return base(ok, cost, label[truth]!, res?.optionId ? (label[opt] ?? opt) : 'no answer', variant,
          opt === 'ta' ? 'a wrong turn is never a Time Allowance' : truth === 'continue' ? `the ${detour} s detour beats ${back} s back` : detour !== null ? `${back} s back beats the ${detour} s detour` : 'this road does not meet the route again');
      }
      case 'checkpoint': {
        const opt = res?.optionId ?? 'nothing'; const cp = p.x.cp as { s: number; id: string; kind: string }; const truth = p.x.truth as string; const look = p.x.look as string;
        const assigned = this.assigned();
        if (opt === 'slow') { sim.act({ type: 'call.speed', mph: 5 }); this.scheduled.push({ when: () => sim.car.s > cp.s + 30, run: () => sim.act({ type: 'call.speed', mph: this.nav.ind(assigned) }) }); }
        else if (opt === 'stop') {
          // at the red board the stop is made just past it, where the worker stands; at a green sign wherever the driver pulls over
          const pull = (): void => { sim.act({ type: 'call.pullover' }); let since: number | null = null; this.scheduled.push({ when: () => { if (sim.car.v === 0 && since === null) since = sim.tod; return since !== null && sim.tod >= since + 5; }, run: () => sim.act({ type: 'call.speed', mph: this.nav.ind(assigned) }) }); };
          if (cp.kind === 'observation') this.scheduled.push({ when: () => sim.car.s > cp.s + 10, run: pull }); else pull();
        }
        const recs = sim.records.length; const sz0 = sim.events.filter(e => e.type === 'sightZoneViolation').length;
        this.suppress++; this.run(() => sim.records.length > recs && this.scheduled.length === 0 && sim.car.mode === 'cruise', 600); this.suppress--;
        const ok = opt === truth;
        let cost: number;
        if (cp.kind === 'observation') {
          const rec = sim.records.find(r => r.cpId === cp.id);
          cost = ok ? 0 : rec?.stopped ? 0 : this.scenario.rules.observationMissPenalty;
        } else {
          const lg = sim.result().score.legs.find(l => l.cpId === cp.id);
          const pen = (sim.events.filter(e => e.type === 'sightZoneViolation').length - sz0) * (this.scenario.rules.sightZonePenalty ?? 30);
          const c = (lg?.rawError ?? this.safePace()) - p.pace0 + pen;
          cost = ok ? c : Math.max(c, pen);
        }
        const label: Record<string, string> = { nothing: 'Hold speed', slow: 'Slow down', stop: 'Stop and check in' };
        const variant = look === 'red' ? 'red' : ok ? 'default' : 'slow';
        return base(ok, cost, label[truth]!, label[opt] ?? opt, variant, look === 'red' ? 'a red board means stop' : 'never stop or crawl near a green sign');
      }
    }
  }
}

function sanitize(r: DecisionResponse | null | undefined): DecisionResponse | null {
  if (!r || typeof r !== 'object') return null;
  const out: DecisionResponse = {};
  if (typeof r.optionId === 'string' && r.optionId.length <= 40) out.optionId = r.optionId;
  if (typeof r.tapSeconds === 'number' && Number.isFinite(r.tapSeconds)) out.tapSeconds = Math.min(3600, Math.max(0, r.tapSeconds));
  if (Array.isArray(r.taps)) { const t = r.taps.filter(x => typeof x === 'number' && Number.isFinite(x)).slice(0, 2).map(x => Math.min(3600, Math.max(0, x))); if (t.length) out.taps = t; }
  return out.optionId === undefined && out.tapSeconds === undefined && out.taps === undefined ? null : out;
}
export { words as promptWords };

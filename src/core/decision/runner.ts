/**
 * DecisionRunner (MOB-001..004): wraps a Simulator and fast-forwards it in fixed 0.1 s ticks to the next decision point the
 * navigator owns. The Navigator (navigator.ts) drives everything in between (assigned speeds, called turns, chart pauses, TA filing,
 * no make-up unless chosen). `next()` returns a Decision; `answer()` turns the response into real sim actions (go, launch, call.turn,
 * call.speed, watch.lap, ta.request, call.uturn, clock.read, pullover / make-up speed calls) and returns the Verdict. Deterministic:
 * the same scenario and the same responses give the same decisions and verdicts.
 */
import type { Scenario, Instruction, TurnDir, Hazard, Node } from '../course.js';
import { nodeById } from '../course.js';
import { Simulator, turnWord, type StageResult } from '../sim.js';
import { ghostTimeAt } from '../ghost.js';
import { accelLoss, stopLoss, rampLead, chartLead, buildPerfTable, matrixAt } from '../perf-table.js';
import { columnBSymbols, columnCLines, columnD, odometerBox, formatInterval, formatClockFace } from '../griid.js';
import { signalIsRed, trainActive } from '../hazards.js';
import { mphToFps } from '../units.js';
import { rng } from '../rng.js';
import { TA_CAUSES } from '../sim.js';
import { Navigator, emptyOverrides, isHoldIns, chartDwell, capFor, bandOf, type NavPlan, type NavOverrides } from './navigator.js';
import { verdictRule, words } from './rules.js';
import { SKILL_OF_KIND, type BookRowView, type Decision, type DecisionContext, type DecisionKind, type DecisionOption, type DecisionResponse, type DecisionRunnerOptions, type TimingSpec, type Verdict, DECISION_KINDS } from './types.js';

const TICK = 0.1;
const r1 = (x: number): number => Math.round(x * 10) / 10;
const clockStr = (tod: number): string => formatClockFace(Math.round(tod));
/** MOB-012: prompts are at most 40 words; a longer one is cut at a word boundary (tests assert none is). */
export const PROMPT_MAX_WORDS = 40;
function clip(s: string): string { const w = s.trim().split(/\s+/); return w.length <= PROMPT_MAX_WORDS ? s.trim() : `${w.slice(0, PROMPT_MAX_WORDS).join(' ')}`; }

/** Correct-answer tolerances for the timed kinds (seconds), after the drill rubrics: D03 (1 s legs), D16 (late > 2 s finding), D04 / D05 call errors. */
export const TIMING_TOLERANCE: Record<'pause' | 'restart' | 'timedStart' | 'speedChange', number> = { pause: 1.0, restart: 1.0, timedStart: 1.3, speedChange: 1.3 };

type Variant = string;
interface Pending {
  d: Decision; key: string; tod0: number; pace0: number; oracle: DecisionResponse;
  /** kind-specific facts the grader needs */
  x: Record<string, unknown>;
}

function dirLabel(d: TurnDir): string { return turnWord(d); }
function dirForAngle(a: number): TurnDir { if (a <= -120) return 'AL'; if (a < -60) return 'L'; if (a < -20) return 'BL'; if (a <= 20) return 'S'; if (a <= 60) return 'BR'; if (a < 120) return 'R'; return 'AR'; }
const HAZ_LABEL: Record<string, string> = { slow: 'Slow truck', construction: 'Construction zone', accident: 'Accident scene', tractor: 'Tractor', combine: 'Combine', schoolBus: 'School bus stopped', train: 'Train at the crossing', signal: 'Red light' };

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

  constructor(scenario: Scenario, opts: DecisionRunnerOptions & { prereadRows?: number; recovery?: 'off' | 'oracle'; missTurns?: number[] } = {}) {
    this.scenario = scenario;
    this.sim = new Simulator(scenario, { watch: 'digital' });
    this.kinds = new Set(opts.kinds ?? DECISION_KINDS);
    this.rung = opts.rung ?? scenario.aids.rung;
    this.max = opts.maxDecisions ?? Infinity;
    this.prereadRows = opts.prereadRows ?? 1;
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
  private ctx(extra: Partial<DecisionContext> = {}): DecisionContext { return { tod: this.sim.tod, elapsed: r1(this.sim.tod - this.scenario.startTime), ...extra }; }
  private row(ins: Instruction | undefined): BookRowView | undefined {
    if (!ins) return undefined; const sc = this.scenario;
    const node = sc.course.nodes.find(nd => nd.id === ins.nodeId);
    return { line: ins.n, odometer: odometerBox(ins) ?? '', miles: Math.round((node?.s ?? 0) / 5280 * 100) / 100, columnB: [...columnBSymbols(ins)], columnC: columnCLines(ins, sc.timeZone), columnD: this.rung <= 0 ? (ins.remark ?? '') : columnD(ins, sc.bookStyle) };
  }
  private nextIns(ins: Instruction): Instruction | undefined { return this.scenario.book.find(i => i.n === ins.n + 1); }
  private showChart(): boolean { return this.rung >= 2; }
  private make(kind: DecisionKind, key: string, prompt: string, context: DecisionContext, extra: { options?: DecisionOption[]; timing?: TimingSpec; deadlineSeconds?: number }, oracle: DecisionResponse, x: Record<string, unknown> = {}): Pending {
    this.seen.add(key);
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
  private detect(): Pending | null {
    const sim = this.sim; const k = this.kinds;
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
        if (this.showChart()) ctx.chart = { kind: 'stopGo', vIn: p.vIn, vOut: p.vOut, seconds: r1(pause - dwell) };
        const cands = [...new Set([dwell, pause, 0].map(r1))];
        const opts = this.shuffle(key, cands).map(v => ({ id: `w${v}`, label: v === 0 ? 'Go at once' : `Wait ${v} s` }));
        return this.make('preread', key, `Pre-read, line ${ins.n}: STOP, pause ${pause} s, in ${p.vIn}, out ${p.vOut}. How long do you sit before GO?`, ctx, { options: opts }, { optionId: `w${dwell}` }, { what: 'pause', truth: dwell, ins, plan: p });
      }
      const v = speedCh!; ctx.speeds = { current: p.vIn, assigned: p.vIn, in: p.vIn, out: v };
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
    const ctx = this.ctx({ line: ins.n, row: this.row(ins), times: { own, launch, ...(base !== undefined ? { base } : {}) }, speeds: { current: 0, assigned: 0, out: this.nav.plans.find(p => p.ins === ins)?.vOut ?? 0 } });
    ctx.clock = this.clockView();
    if (this.showChart() && what !== 'lunch') ctx.chart = { kind: 'accel', vIn: 0, vOut: ctx.speeds!.out ?? 0, seconds: netLoss };
    const name = what === 'start' ? 'Start' : what === 'lunch' ? 'Lunch departure' : what === 'transitOut' ? 'Transit OUT' : 'Restart';
    const prompt = what === 'lunch'
      ? `${name}, line ${ins.n}: leave at ${clockStr(own)}. Tap LEAVE on that second.`
      : this.showChart()
        ? `${name}, line ${ins.n}: your time ${clockStr(own)}, standing-start loss ${netLoss.toFixed(1)} s. Tap LAUNCH on the launch second.`
        : `${name}, line ${ins.n}: your time ${clockStr(own)}. Lead the car by its standing-start loss and tap LAUNCH on the launch second.`;
    const timing: TimingSpec = { kind: 'tapAt', truthSeconds: truth, toleranceSeconds: TIMING_TOLERANCE.restart, maxSeconds: truth + 20, tapLabel: what === 'lunch' ? 'LEAVE' : 'LAUNCH' };
    return this.make('restart', key, prompt, ctx, { timing }, { tapSeconds: truth }, { ins, own, launch, what, variant: what === 'lunch' ? 'lunch' : 'default' });
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
  // clock: a departure 25-45 s away whose launch second sits at a minute change (the loose minute hand can be a minute off)
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
    const slop = this.scenario.rules.clockMinuteSlop ?? 5; const sec = ((launch % 60) + 60) % 60;
    if (!(sec >= 60 - slop - 3 || sec <= slop + 3)) { this.seen.add(key); return null; }
    const to = launch - sim.tod; const lead = this.lead(key, 25, 45);
    if (to > lead) return null;
    if (to < 8) { this.seen.add(key); return null; }
    const h = sim.clock.hands(launch); const shown = Math.floor(h.minuteAngle / 6 + 1e-9) % 60; const misleading = shown !== h.minute;
    const ctx = this.ctx({ line, clock: this.clockView(), times: { launch } });
    const opts = this.shuffle(key, [{ id: 'watch', label: 'Stopwatch in TOD mode' }, { id: 'clock', label: 'Dash clock minute hand' }]);
    return this.make('clock', key, `Your launch second lands at the top of a minute. Where do you take the minute from?`, ctx, { options: opts }, { optionId: 'watch' }, { misleading, shown, minute: h.minute });
  }

  // pause: stopped at a STOP row with a printed pause
  private detectPause(): Pending | null {
    const sim = this.sim; if (!sim.waitingForGo || (sim.waitReason !== 'stop' && sim.waitReason !== 'hold')) return null;
    for (const p of this.nearPlans()) {
      const ins = p.ins; if (!((ins.pause ?? 0) > 0) || isHoldIns(ins) || p.stopHandled) continue;
      const key = `pause:${ins.n}`; if (this.seen.has(key)) continue;
      const node = nodeById(this.scenario.course, ins.nodeId); if (!(node.control === 'STOP' || node.fullStop) || !this.atStopLine(node)) continue;
      const vIn = p.vIn || p.vOut; const dwell = r1(chartDwell(this.scenario, p)); const loss = r1(stopLoss(vIn, p.vOut, this.scenario.car, capFor(this.scenario, ins.turn)));
      this.ov.go.set(ins.n, 'wait');
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), nextRow: this.row(this.nextIns(ins)), speeds: { current: 0, assigned: p.vOut, in: vIn, out: p.vOut }, times: { pauseSeconds: ins.pause! } });
      if (this.showChart()) ctx.chart = { kind: 'stopGo', vIn, vOut: p.vOut, seconds: (ins.pause === 15 ? matrixAt(buildPerfTable(this.scenario.car).stopGo, vIn, p.vOut) : r1(ins.pause! - loss)) };
      const prompt = this.showChart()
        ? `Stopped at line ${ins.n}. Pause ${ins.pause} s, in ${vIn}, out ${p.vOut}: the chart says sit ${ctx.chart!.seconds} s. Tap GO when it is done.`
        : `Stopped at line ${ins.n}. Pause ${ins.pause} s, in ${vIn}, out ${p.vOut}. Count the chart pause and tap GO.`;
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
      const cands = this.shuffle(key, [out, out + 60, out - 60]);
      const opts = cands.map(c => ({ id: `t${c}`, label: clockStr(c) }));
      const ctx = this.ctx({ line: p.ins.n, row: this.row(p.ins), times: { in: tin, intervalSeconds: t.seconds } });
      return this.make('transitOut', key, `Exact transit, line ${p.ins.n}: IN ${clockStr(tin)}, take exactly ${formatInterval(t.seconds)}. What is your OUT time?`, ctx, { options: opts }, { optionId: `t${out}` }, { out, endIns });
    }
    return null;
  }

  // ta: the TA window is open for a delayed leg
  private detectTa(): Pending | null {
    for (const leg of this.nav.pendingTaLegs()) {
      const key = `ta:${leg}`; if (this.seen.has(key) || this.ov.ta.has(leg)) continue;
      const adv = this.sim.taAdvice(leg); if (!(adv.measuredDelay > 0)) continue;
      const oracle = this.nav.oracleClaim(leg);
      const cands = [...new Set([oracle, oracle + 10, Math.max(0, oracle - 10), Math.ceil(adv.measuredDelay / 10) * 10])].sort((a, b) => a - b).slice(0, 4);
      this.ov.ta.set(leg, 'wait');
      const opts = cands.map(c => ({ id: `c${c}`, label: c === 0 ? 'No claim' : `Claim ${formatInterval(c)}` }));
      const ctx = this.ctx({ ta: { measured: adv.measured, claim: adv.claim, cause: adv.cause, legIndex: leg } });
      const recov = Math.round(adv.recoverable);
      return this.make('ta', key, `Time Allowance point. Leg ${leg} was delayed ${formatInterval(adv.measured)} by a ${adv.cause ?? 'qualifying delay'}${recov > 0 ? `; about ${recov} s of it could be made up` : ''}. What do you claim?`, ctx, { options: opts }, { optionId: `c${oracle}` }, { leg, oracle });
    }
    return null;
  }

  /** A hazard the player does not own (no hazard and no make-up cards): the navigator makes the time up for the rest of the leg, as the oracle does. */
  private autoHazard(): void {
    if (this.kinds.has('hazard') || this.kinds.has('makeup')) return;
    const s = this.sim.car.s;
    for (let i = 0; i < this.scenario.hazards.length; i++) {
      const h = this.scenario.hazards[i]!; const key = `hazardAuto:${i}`; if (this.seen.has(key)) continue;
      const end = 'lengthFt' in h ? h.s + h.lengthFt : h.s;
      if (s >= h.s - 400 && s <= end + 50) { this.seen.add(key); if (this.ov.recovery.mode === 'off') this.ov.recovery = { mode: 'on', untilLeg: this.sim.legIndex }; }
    }
  }
  // hazard: a train, tractor, red light, slow truck or construction in sight
  private detectHazard(): Pending | null {
    const sim = this.sim; const s = sim.car.s; const sc = this.scenario;
    for (let i = 0; i < sc.hazards.length; i++) {
      const h = sc.hazards[i]!; const key = `hazard:${i}`; if (this.seen.has(key)) continue;
      if (h.s < s - 5) { if (!('lengthFt' in h) || h.s + h.lengthFt < s) continue; }
      const d = h.s - s; const v = Math.max(sim.car.v, mphToFps(10)); const arrive = sim.tod + Math.max(0, d) / v;
      let show = false;
      if (h.kind === 'slow' || h.kind === 'construction' || h.kind === 'accident' || h.kind === 'tractor' || h.kind === 'combine') show = d <= 400;
      else if (h.kind === 'train') show = d <= 600 && (trainActive(h, sim.tod) || trainActive(h, arrive));
      else if (h.kind === 'signal') show = d <= 500 && d > 30 && signalIsRed(h, arrive) && !this.nav.plans.some(p => p.ins.pause !== undefined && Math.abs(p.s - h.s) < 5);
      else if (h.kind === 'schoolBus') show = d <= 600 && d > 0 && arrive >= h.startTod && arrive < h.startTod + h.durationSeconds;
      if (!show) { if (d < 0 && !('lengthFt' in h)) this.seen.add(key); continue; }
      const qualifying = (TA_CAUSES as readonly string[]).includes(h.kind) || (h.kind === 'signal' && !!sc.rules.taForSignals);
      const opts = this.shuffle(key, [{ id: 'ta', label: 'Wait it out, claim a Time Allowance' }, { id: 'makeup', label: 'Wait it out, make the time up' }, { id: 'both', label: 'Claim the measured delay, make up the odd seconds' }]);
      const truth = qualifying ? 'both' : 'makeup';
      const leg = sim.legIndex;
      const ctx = this.ctx({ hazard: { kind: h.kind, label: HAZ_LABEL[h.kind] ?? h.kind }, distanceFt: Math.max(0, Math.round(d / 50) * 50), speeds: { current: Math.round(sim.car.mph()), assigned: this.assigned() } });
      return this.make('hazard', key, `${HAZ_LABEL[h.kind] ?? h.kind} ahead, ${Math.max(0, Math.round(d / 50) * 50)} ft. It will cost you time. What is your plan?`, ctx, { options: opts }, { optionId: truth }, { h, qualifying, leg, truth });
    }
    return null;
  }

  // lost: the car left the route (a missed or wrong turn)
  private detectLost(): Pending | null {
    const sim = this.sim; if (sim.offCourseCount <= this.lostSeen) return null;
    this.lostSeen = sim.offCourseCount; const key = `lost:${sim.offCourseCount}`;
    const ev = [...sim.events].reverse().find(e => e.type === 'offCourse'); const ago = ev ? r1(sim.tod - ev.tod) : 0;
    this.ov.uturn = 'wait';
    const opts = this.shuffle(key, [{ id: 'uturn', label: 'Turn around now, time the way back' }, { id: 'continue', label: 'Keep going, it may rejoin' }, { id: 'ta', label: 'Keep going, claim a Time Allowance' }]);
    return this.make('lost', key, `Dad says this road does not match the book. You left the route ${Math.round(ago)} s ago. What now?`, this.ctx({ note: 'Off course' }), { options: opts }, { optionId: 'uturn' }, { offTod: ev?.tod ?? sim.tod, events0: sim.events.length });
  }

  // checkpoint: a timing checkpoint sign in sight
  private detectCheckpoint(): Pending | null {
    const sim = this.sim; const s = sim.car.s;
    const cp = this.scenario.checkpoints.find(c => c.s > s); if (!cp || cp.kind !== 'timing') return null;
    const key = `checkpoint:${cp.id}`; if (this.seen.has(key)) return null;
    const d = cp.s - s; if (d > cp.sightDistance || d < 150 || sim.car.mode !== 'cruise' || sim.waitingForGo) return null;
    const opts = this.shuffle(key, [{ id: 'nothing', label: 'Hold speed, drive through' }, { id: 'slow', label: 'Slow right down to read it' }, { id: 'stop', label: 'Stop at the sign and check in' }]);
    const ctx = this.ctx({ distanceFt: Math.round(d / 50) * 50, speeds: { current: Math.round(sim.car.mph()), assigned: this.assigned() }, note: 'Green CHECKPOINT sign' });
    return this.make('checkpoint', key, `A green CHECKPOINT sign is ${Math.round(d / 50) * 50} ft ahead. What do you do?`, ctx, { options: opts }, { optionId: 'nothing' }, { cp });
  }

  // turn: the decision point of a turn line is within the lead distance
  private detectTurn(): Pending | null {
    const sim = this.sim; const car = sim.car; const lead = Math.max(600, car.v * 9) + car.v * 0.5;
    for (const p of this.nearPlans()) {
      const ins = p.ins; if (!ins.turn || ins.turn === 'S' || p.turnCalled) continue;
      const key = `turn:${ins.n}`; if (this.seen.has(key)) continue;
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
      const tSign = d / Math.max(car.v, 1); const lead = this.lead(key, 4, 8);
      if (tSign > lead) continue;
      if (tSign < 1.5 || !this.steadyAt(p.vIn || seg.holdSpeed) || this.hazardBefore(p.s + mphToFps(seg.holdSpeed) * seg.seconds)) { this.seen.add(key); continue; }
      const ghostSign = sim.legAnchorActual + (ghostTimeAt(sim.ghost, p.s) - sim.legAnchorGhost);
      const change = ghostSign + seg.seconds; const ld = rampLead(seg.holdSpeed, seg.thenSpeed, sc.car);
      const t1 = r1(tSign); const t2 = r1(change - ld - sim.tod);
      this.ov.timed.set(ins.n, 'wait');
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), distanceFt: Math.round(d), speeds: { current: Math.round(car.mph()), assigned: seg.holdSpeed, in: p.vIn, out: seg.thenSpeed }, times: { intervalSeconds: seg.seconds } });
      if (this.showChart()) ctx.chart = { kind: 'lead', vIn: seg.holdSpeed, vOut: seg.thenSpeed, seconds: chartLead(seg.holdSpeed, seg.thenSpeed, sc.car) };
      const prompt = this.showChart()
        ? `Line ${ins.n}: ${seg.holdSpeed} for ${formatInterval(seg.seconds)}, then ${seg.thenSpeed}. Tap START at the sign, then CALL ${seg.thenSpeed} ${ctx.chart!.seconds.toFixed(1)} s before the count ends.`
        : `Line ${ins.n}: ${seg.holdSpeed} for ${formatInterval(seg.seconds)}, then ${seg.thenSpeed}. Tap START at the sign, then CALL ${seg.thenSpeed} half a ramp early.`;
      const timing: TimingSpec = { kind: 'startStop', truthSeconds: t1, secondTapSeconds: t2, toleranceSeconds: TIMING_TOLERANCE.timedStart, maxSeconds: t2 + 15, tapLabel: 'START', secondTapLabel: `CALL ${seg.thenSpeed}` };
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
      const lead = this.lead(key, 8, 16);
      if (tCall > lead) continue;
      if (tCall < 2 || !this.steadyAt(p.vIn) || this.hazardBefore(p.s)) { if (tCall < 2 || this.hazardBefore(p.s)) this.seen.add(key); continue; }
      void mph;
      this.ov.speed.set(ins.n, 'wait');
      const t = r1(tCall);
      const ctx = this.ctx({ line: ins.n, row: this.row(ins), distanceFt: Math.round(d / 10) * 10, speeds: { current: Math.round(car.mph()), assigned: p.vIn, in: p.vIn, out: ins.speed } });
      if (this.showChart()) ctx.chart = { kind: 'lead', vIn: p.vIn, vOut: ins.speed, seconds: chartLead(p.vIn, ins.speed, sc.car) };
      const prompt = this.showChart()
        ? `Line ${ins.n}: ${p.vIn} to ${ins.speed} at the sign, ${Math.round(d / 10) * 10} ft ahead. Lead ${ctx.chart!.seconds.toFixed(1)} s. Tap CALL so the change splits the sign.`
        : `Line ${ins.n}: ${p.vIn} to ${ins.speed} at the sign ahead. Tap CALL so the change splits the sign.`;
      const timing: TimingSpec = { kind: 'tapAt', truthSeconds: t, toleranceSeconds: TIMING_TOLERANCE.speedChange, maxSeconds: t + 12, tapLabel: `CALL ${ins.speed}` };
      return this.make('speedChange', key, prompt, ctx, { timing }, { tapSeconds: t }, { ins, plan: p, t, lead: ld });
    }
    return null;
  }

  // makeup: >= 5 s late (or early) in open cruise with room before the checkpoint
  private detectMakeup(): Pending | null {
    const sim = this.sim; if (this.ov.recovery.mode !== 'off') return null;
    const leg = sim.legIndex; if (this.seen.has(`makeup:${leg}`) || sim.tod < this.makeupCooldown) return null;
    const key = `makeup:${leg}:${[...this.seen].filter(x => x.startsWith(`makeup:${leg}:`)).length}`;
    if (!this.nav.inOpenCruise()) return null;
    const pace = this.safePace(); if (Math.abs(pace) < 5) return null;
    const assigned = this.assigned(); if (!this.steadyAt(assigned)) return null;
    const cp = this.scenario.checkpoints.find(c => c.s > sim.car.s); if (!cp) return null;
    const tCp = (cp.s - sim.car.s) / mphToFps(assigned);
    const late = pace > 0; const a = Math.abs(pace);
    const fits10 = 1.1 * 10 * a <= tCp; const fits20 = 1.2 * 5 * a <= tCp;
    if (!fits20 && tCp < 20) return null;   // nowhere to recover: the checkpoint is too close
    const good = new Set<string>(); if (fits10) good.add('p10'); if (fits20 || !fits10) good.add('p20');
    const nxPause = this.nav.plans.find(p => p.s > sim.car.s && p.s < cp.s && (p.ins.pause ?? 0) > 0 && !isHoldIns(p.ins));
    const nxDwell = nxPause ? chartDwell(this.scenario, nxPause) : 0;
    if (late && nxPause && nxDwell >= a) good.add('stop');
    const best = a > 25 || !fits10 ? 'p20' : 'p10';
    const m10 = r1(assigned * (late ? 1.1 : 0.9)), m20 = r1(assigned * (late ? 1.2 : 0.8));
    const opts: DecisionOption[] = [
      { id: 'p10', label: `${late ? '+' : '-'}10 %: ${m10} mph for ${Math.round(10 * a)} s` },
      { id: 'p20', label: `${late ? '+' : '-'}20 %: ${m20} mph for ${Math.round(5 * a)} s` },
      { id: 'leave', label: `Hold ${assigned}, leave it` },
    ];
    if (late && nxPause) opts.push({ id: 'stop', label: `Cut the stop at line ${nxPause.ins.n}` });
    const ctx = this.ctx({ lateSeconds: r1(pace), speeds: { current: Math.round(sim.car.mph()), assigned }, distanceFt: Math.round((this.nav.nextLine().d) / 50) * 50 });
    return this.make('makeup', key, `You are ${Math.round(a)} s ${late ? 'late' : 'early'} at ${assigned} mph with open road ahead. How do you get back on time?`, ctx, { options: this.shuffle(key, opts) }, { optionId: best }, { good: [...good], late, a, nxPause, nxDwell, cp, variant: best === 'p20' ? 'big' : 'default' });
  }

  // ------------------------------------------------------------------ grading
  private grade(p: Pending, res: DecisionResponse | null): Omit<Verdict, 'nextDecisionIn'> {
    const k = p.d.kind;
    const base = (correct: boolean, seconds: number, expected: string, chosen: string, variant?: Variant) => {
      const vr = verdictRule(k, variant);
      return { decisionId: p.d.id, kind: k, skill: p.d.skill, secondsDelta: r1(seconds), correct, rule: vr.sentence, ruleId: vr.card.id, source: vr.card.source, expected, chosen };
    };
    const tap = (fallback: number): number => res?.tapSeconds !== undefined ? Math.max(0, res.tapSeconds) : fallback;
    const sim = this.sim;
    switch (k) {
      case 'pause': {
        const dwell = p.x.dwell as number; const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds);
        this.ov.go.set(ins.n, p.tod0 + t);
        const delta = t - dwell;
        return base(Math.abs(delta) <= TIMING_TOLERANCE.pause, delta, `GO at ${dwell.toFixed(1)} s`, res?.tapSeconds === undefined ? 'no GO' : `GO at ${t.toFixed(1)} s`);
      }
      case 'restart': {
        const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds); const truth = p.d.timing!.truthSeconds;
        if (ins.n === 1 && sim.phase === 'preread') this.ov.depart = p.tod0 + t; else this.ov.go.set(ins.n, p.tod0 + t);
        const delta = t - truth;
        return base(Math.abs(delta) <= TIMING_TOLERANCE.restart, delta, `${p.x.what === 'lunch' ? 'Leave' : 'Launch'} at ${clockStr(p.x.launch as number)}`, res?.tapSeconds === undefined ? 'no tap' : `${clockStr(p.tod0 + t)}${Math.abs(delta) >= 0.05 ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)} s)` : ''}`, p.x.variant as string);
      }
      case 'timedStart': {
        const ins = p.x.ins as Instruction; const t1 = p.x.t1 as number; const t2 = p.x.t2 as number;
        const taps = res?.taps && res.taps.length >= 1 ? res.taps.map(x => Math.max(0, x)) : res?.tapSeconds !== undefined ? [Math.max(0, res.tapSeconds)] : [];
        const a = taps[0] ?? t1; const b = taps[1] ?? Math.max(a, t2 + 5);
        this.ov.timed.set(ins.n, { lapAt: p.tod0 + a, callAt: p.tod0 + Math.max(a, b) });
        const delta = Math.max(a, b) - t2;
        const ok = Math.abs(delta) <= TIMING_TOLERANCE.timedStart && Math.abs(a - t1) <= 1.5;
        return base(ok, delta, `START at the sign, CALL at ${t2.toFixed(1)} s`, taps.length ? `START ${(a - t1 >= 0 ? '+' : '') + (a - t1).toFixed(1)} s, CALL at ${Math.max(a, b).toFixed(1)} s` : 'no taps');
      }
      case 'speedChange': {
        const ins = p.x.ins as Instruction; const t = tap(p.d.timing!.maxSeconds); const plan = p.x.plan as NavPlan;
        this.ov.speed.set(ins.n, { mph: ins.speed!, at: p.tod0 + t });
        // D05 grading: the call against the sign crossing minus the lead (the car holds its speed to the sign: no hazard or stop between)
        void plan;
        const delta = t - (p.x.t as number);
        return base(Math.abs(delta) <= TIMING_TOLERANCE.speedChange, delta, `CALL ${(p.x.lead as number).toFixed(1)} s before the sign`, res?.tapSeconds === undefined ? 'no call' : `${delta > 0 ? `${delta.toFixed(1)} s late` : `${(-delta).toFixed(1)} s early`}`);
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
        return base(!went && valid === truth && !late, went ? Math.max(0, this.safePace() - p.pace0) : 0, turnWord(truth), valid ? `${turnWord(valid)}${late ? ' (late)' : ''}` : 'no call');
      }
      case 'preread': {
        const what = p.x.what as string; const ins = p.x.ins as Instruction; const opt = res?.optionId ?? '';
        if (what === 'turn') {
          const truth = p.x.truth as TurnDir; const ok = opt === truth;
          if (!ok) this.ov.turn.set(ins.n, { dir: (opt || null) as TurnDir | null });
          const cost = ok ? 0 : 2 * (this.scenario.excursionFt ?? 2640) / mphToFps(30) + 20;
          return base(ok, cost, turnWord(truth), opt ? turnWord(opt as TurnDir) : 'no answer', 'turn');
        }
        if (what === 'pause') {
          const truth = p.x.truth as number; const v = Number(opt.slice(1)); const ok = opt === `w${truth}`;
          if (!ok) this.ov.dwell.set(ins.n, Number.isFinite(v) ? v : 0);
          return base(ok, ok ? 0 : (Number.isFinite(v) ? v : 0) - truth, `Wait ${truth} s`, opt ? (v === 0 ? 'Go at once' : `Wait ${v} s`) : 'no answer', 'pause');
        }
        const truth = p.x.truth as number; const v = Number(opt.slice(1)); const ok = v === truth;
        if (!ok && Number.isFinite(v) && v > 0) this.ov.speed.set(ins.n, { mph: v });
        // projected cost: the wrong speed held to the next speed line
        const plan = p.x.plan as NavPlan; const nx = this.nav.plans.find(q => q.s > plan.s && (q.ins.speed !== undefined || q.ins.timed));
        const dist = (nx ? nx.s : this.scenario.course.lengthFt) - plan.s;
        const cost = ok || !(v > 0) ? (ok ? 0 : 60) : dist / mphToFps(v) - dist / mphToFps(truth);
        return base(ok, cost, `${truth} mph`, opt ? `${v} mph` : 'no answer', 'speed');
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
        return base(ok, ok ? 0 : (Number.isFinite(chosen) && chosen > 0 ? chosen : out + 60) - out, `OUT ${clockStr(out)}`, Number.isFinite(chosen) && chosen > 0 ? `OUT ${clockStr(chosen)}` : 'no answer');
      }
      case 'clock': {
        const opt = res?.optionId === 'clock' ? 'clock' : res?.optionId === 'watch' ? 'watch' : null;
        sim.act({ type: 'clock.read', source: opt === 'clock' ? 'clock' : 'stopwatch' });
        const ok = opt === 'watch';
        return base(ok, ok ? 0 : (p.x.misleading ? 60 : 0), 'Stopwatch TOD', opt === 'clock' ? `Dash clock${p.x.misleading ? ` (it showed minute ${p.x.shown})` : ''}` : opt === 'watch' ? 'Stopwatch TOD' : 'no answer');
      }
      case 'ta': {
        const leg = p.x.leg as number; const oracle = p.x.oracle as number; const c = Number((res?.optionId ?? '').slice(1));
        const claim = Number.isFinite(c) && c >= 0 ? c : 0;
        this.ov.ta.set(leg, claim); this.nav.fileTa(leg, claim);
        // seconds this claim left on the table (+) or claimed beyond what the committee credits (-)
        return base(claim === oracle, oracle - claim, `Claim ${formatInterval(oracle)}`, claim ? `Claim ${formatInterval(claim)}` : 'No claim');
      }
      case 'hazard': {
        const h = p.x.h as Hazard; const qualifying = p.x.qualifying as boolean; const truth = p.x.truth as string; const leg = p.x.leg as number;
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
        const cost = opt === truth ? 0 : qualifying ? (opt === 'makeup' ? Math.max(0, D - R) : Math.min(D, R)) : (opt === 'ta' ? D : 0);
        const label: Record<string, string> = { ta: 'Claim a TA', makeup: 'Make it up', both: 'Claim the delay, make up the odd seconds' };
        return base(opt === truth, cost, label[truth]!, res?.optionId ? label[opt]! : 'no answer');
      }
      case 'makeup': {
        const opt = res?.optionId ?? 'leave'; const good = p.x.good as string[]; const a = p.x.a as number; const late = p.x.late as boolean;
        const cp = p.x.cp as { s: number; id: string };
        this.makeupCooldown = sim.tod + 45;
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
          return base(good.includes(opt), resid, good.includes('p10') ? '+10 %' : '+20 %', opt === 'p10' ? `${late ? '+' : '-'}10 %` : `${late ? '+' : '-'}20 %`, opt === 'p20' ? 'big' : 'default');
        }
        if (opt === 'stop' && p.x.nxPause) {
          const np = p.x.nxPause as NavPlan; const dwell = p.x.nxDwell as number;
          this.ov.dwell.set(np.ins.n, Math.max(0, dwell - a)); this.seen.add(`pause:${np.ins.n}`);
          return base(good.includes('stop'), Math.max(0, a - dwell) * (late ? 1 : -1), good.includes('p10') ? '+10 %' : '+20 %', `Cut the stop at line ${np.ins.n}`, 'stop');
        }
        this.seen.add(`makeup:${sim.legIndex}`);   // left: no second card in this leg
        return base(false, late ? a : -a, good.includes('p10') ? '+10 %' : '+20 %', 'Leave it');
      }
      case 'lost': {
        const opt = res?.optionId ?? 'continue';
        if (opt === 'uturn') { sim.act({ type: 'call.uturn' }); sim.act({ type: 'watch.lap' }); this.nav.markOffHandled(); this.ov.uturn = 'auto'; }
        else this.ov.uturn = 'deadEnd';
        const ev0 = p.x.events0 as number;
        this.suppress++; this.run(() => sim.events.slice(ev0).some(e => e.type === 'rejoin') && (sim.car.mode === 'cruise' || sim.waitingForGo), 1800); this.suppress--;
        this.ov.uturn = 'auto';
        // the cost against turning round at once: back the way the car came out, plus about 20 s to turn
        const ago = Math.max(0, p.tod0 - (p.x.offTod as number));
        const cost = opt === 'uturn' ? 0 : Math.max(0, this.safePace() - p.pace0 - (ago + 20));
        const label: Record<string, string> = { uturn: 'Turn around now', continue: 'Keep going', ta: 'Claim a TA' };
        return base(opt === 'uturn', cost, label.uturn!, res?.optionId ? (label[opt] ?? opt) : 'no answer');
      }
      case 'checkpoint': {
        const opt = res?.optionId ?? 'nothing'; const cp = p.x.cp as { s: number; id: string };
        const assigned = this.assigned();
        if (opt === 'slow') { sim.act({ type: 'call.speed', mph: 5 }); this.scheduled.push({ when: () => sim.car.s > cp.s + 30, run: () => sim.act({ type: 'call.speed', mph: this.nav.ind(assigned) }) }); }
        else if (opt === 'stop') {
          sim.act({ type: 'call.pullover' }); let since: number | null = null;
          this.scheduled.push({ when: () => { if (sim.car.v === 0 && since === null) since = sim.tod; return since !== null && sim.tod >= since + 5; }, run: () => sim.act({ type: 'call.speed', mph: this.nav.ind(assigned) }) });
        }
        const recs = sim.records.length; const sz0 = sim.events.filter(e => e.type === 'sightZoneViolation').length;
        this.suppress++; this.run(() => sim.records.length > recs && this.scheduled.length === 0, 600); this.suppress--;
        const lg = sim.result().score.legs.find(l => l.cpId === cp.id);
        const pen = (sim.events.filter(e => e.type === 'sightZoneViolation').length - sz0) * (this.scenario.rules.sightZonePenalty ?? 30);
        const cost = (lg?.rawError ?? this.safePace()) - p.pace0 + pen;
        const label: Record<string, string> = { nothing: 'Drive through', slow: 'Slow down', stop: 'Stop' };
        return base(opt === 'nothing', opt === 'nothing' ? cost : Math.max(cost, pen), label.nothing!, label[opt] ?? opt, opt === 'nothing' ? 'default' : 'slow');
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

/**
 * The decision-mode navigator (MOB-003): the OracleBot's procedure (src/agent/bots.ts, kept there unchanged) re-hosted in the core with
 * per-line overrides, so a DecisionRunner can hand single moments to the player and let this navigator drive everything in between:
 * assigned speeds held, turns called as the book says, stops and holds worked from the charts, Time Allowance filed, and NO make-up
 * unless the runner switches it on (recovery 'off' / 'on'). With recovery 'oracle' and no overrides it behaves like the OracleBot.
 * An override value 'wait' means "the player owns this moment and has not answered yet": the navigator does nothing for it.
 */
import type { Simulator, Action } from '../sim.js';
import type { Scenario, Instruction, TurnDir } from '../course.js';
import { nodeById, instructionS, timedFinalSpeed } from '../course.js';
import { accelLoss, stopLoss, rampLead } from '../perf-table.js';
import { mphToFps } from '../units.js';

export interface NavPlan { ins: Instruction; s: number; vIn: number; vOut: number; turnCalled: boolean; speedCalled: boolean; stopHandled: boolean; crossedTod: number | null; transitMph: number | null }

export function transitSpeedFor(ins: Instruction): number | null {
  const t = ins.transit; if (!t || t.end || !t.miles || t.seconds <= 0) return null;
  const pace = Math.min(55, Math.max(15, Math.ceil(t.miles / (t.seconds / 3600) / 5) * 5));
  return ins.section === 'calibration' && !ins.calibrationStart ? Math.max(pace, 35) : pace;
}
export function planBook(sc: Scenario): NavPlan[] {
  let v = 0; const out: NavPlan[] = [];
  for (const ins of sc.book) {
    const vIn = v;
    const tm = ins.speed === undefined && !ins.timed ? transitSpeedFor(ins) : null;
    const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? tm ?? v;
    out.push({ ins, s: instructionS(sc.course, ins), vIn, vOut, turnCalled: false, speedCalled: false, stopHandled: false, crossedTod: null, transitMph: tm });
    v = ins.timed ? timedFinalSpeed(ins.timed) : vOut;
  }
  return out;
}
export const isHoldIns = (ins: Instruction): boolean => (ins.section === 'restart' && ins.restartTime !== undefined) || !!(ins.transit?.end && ins.transit.exact && ins.restartTime === undefined) || !!ins.promotedStop;
export function bandOf(dir: TurnDir): [number, number] {
  switch (dir) { case 'L': case 'JL': return [-120, -60]; case 'BL': return [-60, -20]; case 'S': return [-20, 20]; case 'BR': return [20, 60]; case 'R': case 'JR': return [60, 120]; case 'AL': return [-180, -120]; case 'AR': return [120, 180]; }
}
export function turnAngle(dir: TurnDir): number { return { L: 90, R: 90, S: 0, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 }[dir]; }
/** Turn-speed cap the chart uses for a stop that exits through a turn. */
export function capFor(sc: Scenario, dir: TurnDir | undefined): number | undefined {
  const a = dir ? turnAngle(dir) : 0;
  return a >= 20 ? (a > 120 ? sc.car.turnSpeedMph.acute : a >= 60 ? sc.car.turnSpeedMph.turn : sc.car.turnSpeedMph.bear) : undefined;
}
/** Chart dwell at a pause row: printed pause minus the stop-and-go loss for the IN / OUT pair (never below 0). */
export function chartDwell(sc: Scenario, p: NavPlan): number {
  const pause = p.ins.pause ?? 0;
  return Math.max(0, pause - stopLoss(p.vIn || p.vOut, p.vOut, sc.car, capFor(sc, p.ins.turn)));
}
/**
 * MOB-051: the Time Allowance claim the rule cards teach (RULE-032, RULE-033; REG V.H.5 "Delayed 0m45s ... Made up 0m25s. Request 0m20s",
 * V.H.6 multiples of 0m10s; Time Delay Form video "delayed 3m47s, make up 7 s, claim 3m40s"): take off what can be made up, claim the
 * multiple of 10 s at or below the rest and make up the odd seconds. Under 10 s there is nothing to claim. Whole seconds, as the card prints them.
 */
export function ruleClaim(measuredSeconds: number, madeUpSeconds: number): number {
  const rest = Math.max(0, Math.round(measuredSeconds) - Math.max(0, Math.round(madeUpSeconds)));
  return Math.floor(rest / 10) * 10;
}
export const isStopPlan = (sc: Scenario, p: NavPlan): boolean => { const node = nodeById(sc.course, p.ins.nodeId); return node.control === 'STOP' || !!node.fullStop || isHoldIns(p.ins) || p.ins.section === 'finish'; };

export type Wait = 'wait';
export interface Recovery { mode: 'oracle' | 'off' | 'on'; /** 'on' with a fixed rate (10 or 20 %) or the oracle's size rule */ pct?: number; /** keep recovering until this leg ends */ untilLeg?: number; /** recover until done, but never past the end of this leg (a checkpoint resets the error) */ sinceLeg?: number }
export interface NavOverrides {
  /** Preread departure time of day (the stage start). */
  depart?: number | Wait;
  /** Go time of day at a stop or hold (pause rows, restarts, exact-transit OUT, promoted stops). */
  go: Map<number, number | Wait>;
  /** Dwell override at a pause row (preread answer). */
  dwell: Map<number, number>;
  /** Turn call: direction (null = never call it) and the time of day to call it at (default: the oracle's lead). */
  turn: Map<number, { dir: TurnDir | null; at?: number } | Wait>;
  /** Speed for a row (landmark change, exit speed of a stop) and when to call it. */
  speed: Map<number, { mph: number; at?: number } | Wait>;
  /** Timed line: when to lap at the sign and when to call the first change. */
  timed: Map<number, { lapAt?: number; callAt: number } | Wait>;
  /** Time Allowance per leg: seconds to claim, or skip. */
  ta: Map<number, number | 'skip' | Wait>;
  recovery: Recovery;
  /** Off course: turn around at once ('auto'), only at the dead end, or wait for the player. */
  uturn: 'auto' | 'deadEnd' | Wait;
}
export function emptyOverrides(): NavOverrides { return { go: new Map(), dwell: new Map(), turn: new Map(), speed: new Map(), timed: new Map(), ta: new Map(), recovery: { mode: 'oracle' }, uturn: 'auto' }; }

export class Navigator {
  readonly plans: NavPlan[];
  readonly ov: NavOverrides;
  private departed = false;
  timedPending: { plan: NavPlan; thenSpeed: number; called: boolean; step?: number; from?: number; afterG?: number } | null = null;
  private stopWaitSince: number | null = null;
  private readonly holdPlans: NavPlan[];
  private readonly calPlans: NavPlan[];
  private lastGlance = -1e9;
  private calStart: number | null = null;
  private calSeen = new Set<number>();
  private k: number | null = null;
  private offSeen = 0;
  /** Time of day the car stopped at the pause / hold it is waiting at (null when not waiting). */
  get stoppedSince(): number | null { return this.stopWaitSince; }
  constructor(private readonly sim: Simulator, ov: NavOverrides = emptyOverrides(), private readonly useWatch = true) {
    this.ov = ov;
    this.plans = planBook(sim.sc);
    this.holdPlans = this.plans.filter(p => isHoldIns(p.ins) || (p.ins.transit?.exact === true && !p.ins.transit.end));
    this.calPlans = this.plans.filter(p => p.ins.section === 'calibration');
  }
  /** Indicated speed to call for an assigned (true) speed (CAL-002). */
  ind(assigned: number): number {
    if (this.k === null || this.sim.sc.speedo.kind === 'timewise') return assigned;
    return Math.round(assigned / this.k * 2) / 2;
  }
  /** Assigned speed in force at the car (truth from the book), the timed hold / then speed included. */
  assignedNow(): number | null {
    let assigned: number | null = null; const s = this.sim.car.s;
    for (const p of this.plans) { if (p.s <= s) assigned = p.ins.timed ? (this.timedPending?.called && this.timedPending.plan === p ? p.ins.timed.thenSpeed : p.ins.timed.holdSpeed) : p.ins.speed ?? p.transitMph ?? assigned; else break; }
    return assigned;
  }
  private glance(): void {
    const sim = this.sim;
    if (sim.tod - this.lastGlance < 20 - 1e-6) return;
    let near = false;
    if (sim.phase === 'preread') near = sim.sc.startTime - sim.tod <= 120;
    else if (sim.phase === 'running') {
      const s = sim.car.s; const v = Math.max(sim.car.v, mphToFps(10));
      for (const p of this.holdPlans) {
        const d = p.s - s; if (d < -100) continue;
        const goTod = isHoldIns(p.ins) ? sim.holdGoTod(nodeById(sim.sc.course, p.ins.nodeId)) : null;
        near = goTod !== null ? goTod - sim.tod <= 120 : d / v <= 120; break;
      }
    }
    if (near) { this.lastGlance = sim.tod; this.readClock(); }
    else if (sim.watch.kind === 'digital' && sim.watch.mode === 'tod' && sim.tod - this.lastGlance > 30) sim.act({ type: 'watch.mode', mode: 'chrono' });
  }
  private readClock(): void {
    const sim = this.sim;
    if (sim.watch.kind === 'digital') { if (sim.watch.mode !== 'tod') sim.act({ type: 'watch.mode', mode: 'tod' }); sim.act({ type: 'clock.read', source: 'stopwatch' }); }
    else sim.act({ type: 'clock.read' });
  }
  private pulled = new Set<number>(); private warned = new Set<number>(); private seenDrops = 0;
  private procedure(): void {
    const sim = this.sim;
    const li = sim.launchInfo(); if (!li) return;
    const ins = sim.sc.book.find(i => i.n === li.line); if (!ins) return;
    if (!this.pulled.has(li.line) && !sim.startQueue(ins).carAheadAtSign) { this.pulled.add(li.line); sim.act({ type: 'pullUp' }); }
    if (!this.warned.has(li.line) && sim.tod >= li.launchTime - 30) { this.warned.add(li.line); sim.act({ type: 'call.warn', seconds: 30 }); }
  }
  private calibrate(): void {
    const sim = this.sim; const car = sim.car;
    for (const p of this.calPlans) {
      if (this.calSeen.has(p.ins.n)) continue;
      if (car.s < p.s) break;
      this.calSeen.add(p.ins.n);
      const crossed = sim.tod - (car.s - p.s) / Math.max(car.v, 1);
      if (p.ins.calibrationStart) {
        this.calStart = crossed;
        if (this.useWatch) { sim.act({ type: 'watch.stop' }); sim.act({ type: 'watch.reset' }); sim.act({ type: 'watch.start' }); }
      } else {
        if (this.useWatch) sim.act({ type: 'watch.lap' });
        if (this.calStart !== null && p.ins.perfectCumulative !== undefined && crossed > this.calStart + 1) this.k = p.ins.perfectCumulative / (crossed - this.calStart);
      }
    }
  }
  private act(a: Action): void { this.sim.act(a); }
  /** The runner turned the car around itself (lost card): do not call the U-turn again. */
  markOffHandled(): void { this.offSeen = this.sim.offCourseCount; }
  /** The default departure time of the stage start (oracle: start time minus the standing-start loss). */
  defaultDepart(): number { const sc = this.sim.sc; const v0 = sc.book[0]!.speed ?? this.plans[0]!.transitMph ?? 30; return sc.startTime - accelLoss(v0, sc.car); }
  /** The oracle's go time at a hold (restart / exact-transit OUT / promoted stop), or null while unknown. */
  defaultHoldGo(p: NavPlan): number | null {
    const sim = this.sim; const goTod = sim.holdGoTod(nodeById(sim.sc.course, p.ins.nodeId)); if (goTod === null) return null;
    return goTod - (p.ins.promotedStop ? 0 : accelLoss(p.vOut, sim.sc.car));
  }

  onTick(): void {
    const sim = this.sim; const sc = sim.sc; const car = sim.car; const ov = this.ov;
    if (this.stopWaitSince !== null && !sim.waitingForGo && car.v > 0) this.stopWaitSince = null;
    this.glance();
    this.procedure();
    if (sim.phase === 'finished' && sc.rules.taMode === 'paper') this.declareTA();
    if (sim.phase === 'preread') {
      const dep = ov.depart === undefined ? this.defaultDepart() : ov.depart;
      if (!this.departed && dep !== 'wait' && sim.tod >= dep - 1e-6) {
        this.departed = true; sim.act({ type: 'start' }); if (this.useWatch) sim.act({ type: 'watch.start' });
        if (sc.book[0]!.speed === undefined && this.plans[0]!.transitMph !== null) this.act({ type: 'call.speed', mph: this.ind(this.plans[0]!.transitMph) });
      }
      return;
    }
    if (sim.phase !== 'running') return;
    if (!this.departed) { this.departed = true; if (this.useWatch) sim.act({ type: 'watch.start' }); }
    // off course: turn around (the lost doctrine), at once or at the dead end, unless the player owns it
    if (sim.offCourseCount > this.offSeen) {
      const stuck = sim.waitingForGo && sim.waitReason === 'roadEnd';
      if (ov.uturn === 'auto' || (ov.uturn === 'deadEnd' && stuck)) { this.offSeen = sim.offCourseCount; this.act({ type: 'call.uturn' }); if (this.useWatch) sim.act({ type: 'watch.lap' }); }
    }
    const s = car.s;
    this.calibrate();
    const turnLeadFt = Math.max(600, car.v * 9);
    for (const p of this.plans) {
      if (p.ins.section === 'start') continue;
      const d = p.s - s;
      if (d < -30 && p.crossedTod === null) p.crossedTod = sim.tod;
      if (d < -100) continue;
      if (d > Math.max(900, turnLeadFt + 50)) break;
      const n = p.ins.n;
      const node = nodeById(sc.course, p.ins.nodeId);
      const isStop = node.control === 'STOP' || !!node.fullStop || isHoldIns(p.ins) || (p.ins.section === 'finish');
      // turn callout
      const tov = ov.turn.get(n);
      if (p.ins.turn && !p.turnCalled && d <= turnLeadFt && tov !== 'wait') {
        const dir = tov ? tov.dir : p.ins.turn;
        if (dir === null) p.turnCalled = true;
        else if (!tov || tov.at === undefined || sim.tod >= tov.at - 1e-6) {
          const band = bandOf(dir);
          const decoy = sc.course.nodes.some(nd => nd.s > car.s - 1 && nd.s < p.s - 5 && nd.kind === 'intersection' && (nd.exits ?? []).some(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private' && e.angle >= band[0] && e.angle <= band[1] && (Math.abs(e.angle) >= 20 || dir === 'S')));
          if (!decoy || d <= 120) { p.turnCalled = true; this.act({ type: 'call.turn', dir }); }
        }
      }
      if (p.ins.section === 'finish' && !p.stopHandled && d <= 500) { p.stopHandled = true; this.act({ type: 'call.stop' }); }
      // landmark speed change (no stop): lead by half the ramp
      const sov = ov.speed.get(n);
      if (!isStop && p.ins.speed !== undefined && !p.ins.timed && !p.speedCalled && p.vIn > 0 && p.ins.speed !== p.vIn && sov !== 'wait') {
        const mph = sov ? sov.mph : p.ins.speed;
        if (sov?.at !== undefined) { if (sim.tod >= sov.at - 1e-6) { p.speedCalled = true; this.act({ type: 'call.speed', mph: this.ind(mph) }); } }
        else {
          const dLead = mphToFps(p.vIn) * rampLead(p.vIn, mph, sc.car);
          if (d <= dLead + 1) { p.speedCalled = true; this.act({ type: 'call.speed', mph: this.ind(mph) }); }
        }
      }
      if (p.transitMph !== null && !p.speedCalled && d <= 0 && sim.targetIndicated !== this.ind(p.transitMph)) { p.speedCalled = true; this.act({ type: 'call.speed', mph: this.ind(p.transitMph) }); }
      // timed segment anchor: arm when crossing (or at the player's START tap)
      const tmov = ov.timed.get(n);
      if (p.ins.timed && !p.speedCalled && tmov !== 'wait' && (tmov?.lapAt !== undefined ? sim.tod >= tmov.lapAt - 1e-6 : d <= 0)) {
        p.speedCalled = true;
        if (this.useWatch && !isStop) sim.act({ type: 'watch.lap' });
        if (!isStop) this.act({ type: 'call.speed', mph: this.ind(p.ins.timed.holdSpeed) });
        this.timedPending = { plan: p, thenSpeed: p.ins.timed.thenSpeed, called: false };
      }
      // stop handling
      if (isStop && sim.waitingForGo && Math.abs(car.s - (node.s - (node.stopLineOffset ?? 0))) < 3 && !p.stopHandled) {
        if (this.stopWaitSince === null) {
          this.stopWaitSince = sim.tod;
          const so = sov && sov !== 'wait' ? sov.mph : undefined;
          const out = so ?? (p.ins.timed ? p.ins.timed.holdSpeed : p.ins.speed ?? p.vIn);
          if (this.ind(out) !== (sim.targetIndicated ?? -1)) this.act({ type: 'call.speed', mph: this.ind(out) });
          if (this.useWatch) sim.act({ type: 'watch.lap' });
        }
        const gov = ov.go.get(n);
        if (gov === 'wait') { /* the player owns this go */ }
        else if (gov !== undefined) {
          if (sim.tod >= gov - 1e-6) { p.stopHandled = true; this.stopWaitSince = null; this.act({ type: 'call.go' }); if (this.useWatch && p.ins.timed && !isHoldIns(p.ins)) sim.act({ type: 'watch.lap' }); }
        } else if (isHoldIns(p.ins)) {
          const go = this.defaultHoldGo(p);
          if (go === null || sim.tod >= go) { p.stopHandled = true; this.stopWaitSince = null; this.act({ type: 'call.go' }); }
        } else if (sim.waitReason === 'stop' || sim.waitReason === 'hold') {
          const dwell = ov.dwell.get(n) ?? chartDwell(sc, p);
          if (sim.tod - this.stopWaitSince >= dwell) { p.stopHandled = true; this.stopWaitSince = null; this.act({ type: 'call.go' }); if (this.useWatch && p.ins.timed) sim.act({ type: 'watch.lap' }); }
        }
      }
    }
    // timed change call
    if (this.timedPending && !this.timedPending.called) {
      const tp = this.timedPending; const seg = tp.plan.ins.timed!;
      const tmov = (tp.step ?? 0) === 0 ? ov.timed.get(tp.plan.ins.n) : undefined;
      let due: boolean;
      if (tmov && tmov !== 'wait') due = sim.tod >= tmov.callAt - 1e-6;
      else {
        const ghostTod = sim.timedChangeNodeId() === tp.plan.ins.nodeId ? sim.timedChangeGhostTod() : null;
        const lead = rampLead(tp.from ?? seg.holdSpeed, tp.thenSpeed, sc.car);
        due = ghostTod !== null && (tp.afterG === undefined || ghostTod > tp.afterG + 0.5) && sim.tod >= ghostTod - lead;
      }
      if (due) {
        tp.called = true; this.act({ type: 'call.speed', mph: this.ind(tp.thenSpeed) });
        const k = tp.step ?? 0; const nx = seg.chain?.[k];
        const ghostTod = sim.timedChangeNodeId() === tp.plan.ins.nodeId ? sim.timedChangeGhostTod() : null;
        if (nx) this.timedPending = { plan: tp.plan, thenSpeed: nx.thenSpeed, called: false, step: k + 1, from: tp.thenSpeed, afterG: ghostTod ?? sim.tod };
      }
    }
    if (this.timedPending?.called && car.s > this.timedPending.plan.s + 3 * 5280) this.timedPending = null;
    this.recover();
    this.declareTA();
  }

  private taDone = new Set<number>();
  /** The claim for a leg by the rule cards (RULE-032 / RULE-033, REG V.H.5 / V.H.6): see ruleClaim; the numbers are the ones the TA card prints. */
  oracleClaim(leg: number): number { const adv = this.sim.taAdvice(leg); return ruleClaim(Math.round(adv.measured), Math.round(adv.recoverable)); }
  /** Legs whose TA is still to be filed while the window is open (for the runner's ta decision). */
  pendingTaLegs(): number[] {
    const st = this.sim.taState(); if (!st.hasTaPoints || !st.windowOpen) return [];
    return st.eligibleLegs.filter(l => !this.taDone.has(l));
  }
  fileTa(leg: number, seconds: number): void {
    const sim = this.sim; const adv = sim.taAdvice(leg); this.taDone.add(leg);
    if (seconds > 0) this.act({ type: 'ta.request', legIndex: leg, seconds, fromLine: adv.fromLine ?? 1, toLine: adv.toLine ?? adv.fromLine ?? 1, note: `Delayed ${Math.round(adv.measuredDelay)} s. Made up ${Math.round(adv.recoverable)} s.`, carNumber: 1, password: '1939', phone: '555-0100', stage: 1, cause: adv.cause ?? 'train', witnesses: { ahead: 2, behind: 4 } });
  }
  private declareTA(): void {
    const sim = this.sim; const st = sim.taState();
    if (st.hasTaPoints) {
      if (!st.windowOpen) return;
      for (const leg of st.eligibleLegs) {
        if (this.taDone.has(leg)) continue;
        const o = this.ov.ta.get(leg);
        if (o === 'wait') continue;
        if (o === 'skip') { this.taDone.add(leg); continue; }
        this.fileTa(leg, o ?? this.oracleClaim(leg));
      }
      if (st.endOfStage && !sim.scorecardAcked && ![...this.ov.ta.values()].includes('wait')) this.act({ type: 'scorecard.ack' });
      return;
    }
    const leg = sim.legIndex; const adv = sim.taAdvice(leg); const o = this.ov.ta.get(leg);
    if (o === 'wait' || o === 'skip') return;
    if (adv.measuredDelay > 0 && !this.taDone.has(leg) && !sim.waitingForGo) { this.taDone.add(leg); this.act({ type: 'ta.declare', seconds: o ?? Math.round(adv.possible), legIndex: leg }); }
  }

  /** True while the car is inside a transit / warm-up (nothing there is timed against the ghost). */
  inTransit(): boolean {
    const car = this.sim.car; let inTransit = false;
    for (const p of this.plans) { if (p.s > car.s) break; if ((p.ins.transit && !p.ins.transit.end) || p.ins.section === 'start' && p.ins.transit) inTransit = true; else if (p.ins.transit?.end || p.ins.restartTime !== undefined || p.ins.section === 'finish') inTransit = false; }
    return inTransit;
  }
  /** The next book line ahead of the car and its distance (ft); `delicate` = it needs a stop, turn or speed change worked precisely. */
  nextLine(): { plan: NavPlan | null; d: number; delicate: boolean } {
    const sim = this.sim; const car = sim.car; const assigned = this.assignedNow();
    let nextD = Infinity; let nextPlan: NavPlan | null = null;
    for (const p of this.plans) if (p.s > car.s) { nextD = p.s - car.s; nextPlan = p; break; }
    const delicate = !!nextPlan && (nextPlan.ins.pause !== undefined || (nextPlan.ins.turn !== undefined && nextPlan.ins.turn !== 'S') || nextPlan.ins.timed !== undefined || (nextPlan.ins.speed !== undefined && nextPlan.ins.speed !== assigned) || isHoldIns(nextPlan.ins) || nextPlan.ins.section === 'finish' || (sim.sc.course.nodes.find(n => n.id === nextPlan!.ins.nodeId)?.control ?? 'none') !== 'none');
    return { plan: nextPlan, d: nextD, delicate };
  }
  /** Open cruise: not waiting, no timed count running, not in a transit, the next line not within reach. */
  inOpenCruise(): boolean {
    const sim = this.sim; const car = sim.car;
    if (sim.phase !== 'running' || sim.waitingForGo || (this.timedPending && !this.timedPending.called) || this.inTransit()) return false;
    const nl = this.nextLine();
    return !(nl.d < (nl.delicate ? 900 : 300) || car.mode !== 'cruise');
  }

  recovering: number | null = null;
  /** How many times an 'on' recovery was paused by a line that needs precise work (it resumes after). */
  interrupted = 0;
  /** Make-up: the oracle's (recovery 'oracle'), or only while the runner has switched it on. */
  private recover(): void {
    const sim = this.sim; const car = sim.car; const rc = this.ov.recovery;
    if (rc.mode === 'on' && ((rc.untilLeg !== undefined && sim.legIndex > rc.untilLeg) || (rc.sinceLeg !== undefined && sim.legIndex > rc.sinceLeg))) { this.ov.recovery = { mode: 'off' }; }
    if (this.ov.recovery.mode === 'off') { if (this.recovering !== null) { const a = this.assignedNow(); this.recovering = null; if (a !== null) this.act({ type: 'call.speed', mph: this.ind(a) }); } return; }
    if (sim.waitingForGo || this.timedPending && !this.timedPending.called) return;
    if (this.inTransit()) { this.recovering = null; return; }
    const assigned = this.assignedNow();
    if (assigned === null) return;
    const pace = sim.pace();
    if (this.seenDrops !== sim.makeUpDrops) { this.seenDrops = sim.makeUpDrops; this.recovering = null; }
    const nl = this.nextLine();
    const nearEvent = nl.d < (nl.delicate ? 900 : 300) || car.mode !== 'cruise';
    if (this.recovering !== null) {
      const done = this.recovering > assigned ? pace < 0.3 : pace > -0.3;
      if (done || nearEvent) {
        this.recovering = null; this.act({ type: 'call.speed', mph: this.ind(assigned) });
        if (done && this.ov.recovery.mode === 'on' && this.ov.recovery.untilLeg === undefined) this.ov.recovery = { mode: 'off' };
        if (!done && this.ov.recovery.mode === 'on') this.interrupted++;
      }
      return;
    }
    if (!nearEvent && Math.abs(pace) > 0.8 && Math.abs(car.mph() - assigned) < 1.5) {
      const big = Math.abs(pace); const pct = this.ov.recovery.mode === 'on' ? this.ov.recovery.pct : undefined;
      const d = pct ? Math.max(2, Math.ceil(assigned * pct / 100)) : big > 25 ? Math.ceil(assigned * 0.2) : big > 6 ? Math.max(5, Math.ceil(assigned * 0.1)) : 2;
      this.recovering = pace > 0 ? assigned + d : Math.max(15, assigned - d);
      this.act({ type: 'call.speed', mph: this.ind(this.recovering) });
    }
  }
}

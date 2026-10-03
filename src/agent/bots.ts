/** Scripted navigators used for playtesting and validation. DESIGN §15. They may read TRUTH. */
import { Simulator, type Action } from '../core/sim.js';
import type { Scenario, Instruction, TurnDir } from '../core/course.js';
import { nodeById, instructionS } from '../core/course.js';
import { accelLoss, stopLoss, rampLead } from '../core/perf-table.js';
import { mphToFps } from '../core/units.js';
import { rng, type Rng } from '../core/rng.js';

export type BotName = 'oracle' | 'rookie' | 'noPause' | 'lateCall' | 'goCount' | 'random' | 'none';

export interface Bot { name: string; onTick(sim: Simulator): void }

interface Plan { ins: Instruction; s: number; vIn: number; vOut: number; turnCalled: boolean; speedCalled: boolean; stopHandled: boolean; crossedTod: number | null; /** speed to drive through a transit begun on this line */ transitMph: number | null }

/** Speed that covers a transit's approximate miles in its allowed time, rounded UP to a multiple of 5 so the car arrives early and waits (HB p.11). */
function transitSpeedFor(ins: Instruction): number | null {
  const t = ins.transit; if (!t || t.end || !t.miles || t.seconds <= 0) return null;
  return Math.min(55, Math.max(15, Math.ceil(t.miles / (t.seconds / 3600) / 5) * 5));
}

/** Assigned speed in force just before each instruction (from the book); a transit's pace stands in for the assigned speed. */
function planBook(sc: Scenario): Plan[] {
  let v = 0; const out: Plan[] = [];
  for (const ins of sc.book) {
    const vIn = v;
    const tm = ins.speed === undefined && !ins.timed ? transitSpeedFor(ins) : null;
    const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? tm ?? v;
    out.push({ ins, s: instructionS(sc.course, ins), vIn, vOut, turnCalled: false, speedCalled: false, stopHandled: false, crossedTod: null, transitMph: tm });
    v = ins.timed ? ins.timed.thenSpeed : vOut;
  }
  return out;
}
const isHoldIns = (ins: Instruction): boolean => (ins.section === 'restart' && ins.restartTime !== undefined) || !!(ins.transit?.end && ins.transit.exact && ins.restartTime === undefined) || !!ins.promotedStop;

export interface OracleOptions {
  /** Add this latency (s) to every callout. */
  latency?: number;
  /** Ignore the car's losses (rookie): full pause dwell, no ramp lead, no early start. */
  ignoreLosses?: boolean;
  /** Forget pauses entirely: go as soon as stopped. */
  forgetPauses?: boolean;
  /** Keep the stopwatch busy like a real navigator (start at depart, lap at each node). */
  useWatch?: boolean;
  /** Disable truth-based recovery in cruise (to measure uncorrected errors). */
  noRecovery?: boolean;
  /** Start timed-segment counts at our own 'go' instead of the ghost's departure (BOT-005). */
  goCount?: boolean;
}

export class OracleBot implements Bot {
  name = 'oracle';
  private plans: Plan[];
  private queue: { at: number; a: Action }[] = [];
  private departed = false;
  private timedPending: { plan: Plan; thenSpeed: number; called: boolean } | null = null;
  private stopWaitSince: number | null = null;
  private restartHandled = new Set<number>();
  constructor(private readonly sim: Simulator, private readonly o: OracleOptions = {}) {
    this.plans = planBook(sim.sc);
    if (o.ignoreLosses) this.name = 'rookie';
    if (o.forgetPauses) this.name = 'noPause';
    if (o.latency) this.name = 'lateCall';
    if (o.goCount) this.name = 'goCount';
  }
  private act(a: Action): void { if (this.o.latency) this.queue.push({ at: this.sim.tod + this.o.latency, a }); else this.sim.act(a); }
  private flush(): void { const now = this.sim.tod; const due = this.queue.filter(q => q.at <= now); this.queue = this.queue.filter(q => q.at > now); for (const q of due) this.sim.act(q.a); }

  onTick(): void {
    const sim = this.sim; const sc = sim.sc; const car = sim.car;
    this.flush();
    if (sim.phase === 'preread') {
      const v0 = sc.book[0]!.speed ?? this.plans[0]!.transitMph ?? 30;
      const lead = this.o.ignoreLosses ? 0 : accelLoss(v0, sc.car);
      if (!this.departed && sim.tod >= sc.startTime - lead - 1e-6) {
        this.departed = true; sim.act({ type: 'start' }); if (this.o.useWatch) sim.act({ type: 'watch.start' });
        if (sc.book[0]!.speed === undefined && this.plans[0]!.transitMph !== null) this.act({ type: 'call.speed', mph: this.plans[0]!.transitMph });
      }
      return;
    }
    if (sim.phase !== 'running') return;
    const s = car.s;
    for (const p of this.plans) {
      if (p.ins.section === 'start') continue;
      const d = p.s - s;
      if (d < -30 && p.crossedTod === null) p.crossedTod = sim.tod;
      if (d < -100) continue; // already passed: nothing below applies (keeps a 250-line stage O(active lines) per tick)
      if (d > 900) break;
      const node = nodeById(sc.course, p.ins.nodeId);
      const isStop = node.control === 'STOP' || isHoldIns(p.ins) || (p.ins.section === 'finish');
      // turn callout
      if (p.ins.turn && !p.turnCalled && d <= 600) {
        // do not arm while an intervening real-road exit would match the callout (the driver would take it)
        const band = bandOf(p.ins.turn);
        const decoy = sc.course.nodes.some(nd => nd.s > car.s - 1 && nd.s < p.s - 5 && nd.kind === 'intersection' && (nd.exits ?? []).some(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private' && e.angle >= band[0] && e.angle <= band[1] && (Math.abs(e.angle) >= 20 || p.ins.turn === 'S')));
        if (!decoy || d <= 120) { p.turnCalled = true; this.act({ type: 'call.turn', dir: p.ins.turn }); }
      }
      // finish: hold at the banner
      if (p.ins.section === 'finish' && !p.stopHandled && d <= 500) { p.stopHandled = true; this.act({ type: 'call.stop' }); }
      // landmark speed change (no stop): lead by half the ramp
      if (!isStop && p.ins.speed !== undefined && !p.ins.timed && !p.speedCalled && p.vIn > 0 && p.ins.speed !== p.vIn) {
        const lead = this.o.ignoreLosses ? 0 : rampLead(p.vIn, p.ins.speed, sc.car);
        const dLead = mphToFps(p.vIn) * lead;
        if (d <= dLead + 1) { p.speedCalled = true; this.act({ type: 'call.speed', mph: p.ins.speed }); }
      }
      // a transit has no assigned speed: drive its pace (rounded up) so the car arrives early and waits
      if (p.transitMph !== null && !p.speedCalled && d <= 0 && sim.targetIndicated !== p.transitMph) { p.speedCalled = true; this.act({ type: 'call.speed', mph: p.transitMph }); }
      // timed segment anchor: arm when crossing
      if (p.ins.timed && !p.speedCalled && d <= 0) {
        p.speedCalled = true;
        if (!isStop) this.act({ type: 'call.speed', mph: p.ins.timed.holdSpeed });
        this.timedPending = { plan: p, thenSpeed: p.ins.timed.thenSpeed, called: false };
      }
      // stop handling
      if (isStop && sim.waitingForGo && Math.abs(car.s - (node.s - (node.stopLineOffset ?? 0))) < 3 && !p.stopHandled) {
        if (this.stopWaitSince === null) {
          this.stopWaitSince = sim.tod;
          // set the exit speed so the driver accelerates to it after go
          const out = p.ins.timed ? p.ins.timed.holdSpeed : p.ins.speed ?? p.vIn;
          if (out !== (sim.targetIndicated ?? -1)) this.act({ type: 'call.speed', mph: out });
          if (this.o.useWatch) sim.act({ type: 'watch.lap' });
        }
        if (isHoldIns(p.ins)) {
          // restart: leave at the time-of-day; exact transit: at IN + interval; promoted stop: at the scheduled departure (never 5 minutes early)
          const goTod = sim.holdGoTod(node);
          const lead = this.o.ignoreLosses || p.ins.promotedStop ? 0 : accelLoss(p.vOut, sc.car);
          if (goTod === null || sim.tod >= goTod - lead) { p.stopHandled = true; this.stopWaitSince = null; this.act({ type: 'call.go' }); }
        } else if (sim.waitReason === 'stop' || sim.waitReason === 'hold') {
          const pause = p.ins.pause ?? 0;
          const turnAng = p.ins.turn ? turnAngle(p.ins.turn) : 0;
          const cap = turnAng >= 20 ? (turnAng > 120 ? sc.car.turnSpeedMph.acute : turnAng >= 60 ? sc.car.turnSpeedMph.turn : sc.car.turnSpeedMph.bear) : undefined;
          const loss = this.o.ignoreLosses ? 0 : stopLoss(p.vIn || p.vOut, p.vOut, sc.car, cap);
          const dwell = this.o.forgetPauses ? 0 : Math.max(0, pause - loss);
          if (sim.tod - this.stopWaitSince >= dwell) { p.stopHandled = true; this.stopWaitSince = null; this.act({ type: 'call.go' }); }
        }
      }
    }
    // timed change call
    if (this.timedPending && !this.timedPending.called) {
      const tp = this.timedPending; const seg = tp.plan.ins.timed!;
      const ghostTod = sim.timedChangeNodeId() === tp.plan.ins.nodeId ? sim.timedChangeGhostTod() : null;
      const lead = this.o.ignoreLosses ? 0 : rampLead(seg.holdSpeed, seg.thenSpeed, sc.car);
      let due: boolean;
      if (this.o.ignoreLosses || this.o.goCount) { if (tp.plan.crossedTod === null && car.s > tp.plan.s) tp.plan.crossedTod = sim.tod; due = tp.plan.crossedTod !== null && sim.tod >= tp.plan.crossedTod + seg.seconds - (this.o.goCount ? lead : 0); }
      else due = ghostTod !== null && sim.tod >= ghostTod - lead;
      if (due) { tp.called = true; this.act({ type: 'call.speed', mph: tp.thenSpeed }); }
    }
    if (this.timedPending?.called && car.s > this.timedPending.plan.s + 3 * 5280) this.timedPending = null;
    this.recover();
    this.declareTA();
  }

  /**
   * Time Allowance (TA-001/TA-002): a real navigator files at the printed TA point, one request per delayed leg, in multiples of 10 s:
   * the measured delay rounded down to 10 s, never more than what the committee can credit (measured minus what could be made up, rounded up).
   * Books without a TA point (legacy drills) use the deprecated ta.declare once per leg.
   */
  private taDone = new Set<number>();
  private declareTA(): void {
    if (this.o.ignoreLosses) return;
    const sim = this.sim; const st = sim.taState();
    if (st.hasTaPoints) {
      if (!st.windowOpen) return;
      for (const leg of st.eligibleLegs) {
        if (this.taDone.has(leg)) continue; this.taDone.add(leg);
        const adv = sim.taAdvice(leg); const amount = Math.min(Math.floor(adv.measuredDelay / 10) * 10, Math.ceil(adv.possible / 10) * 10);
        if (amount > 0) this.act({ type: 'ta.request', legIndex: leg, seconds: amount, fromLine: adv.fromLine ?? 1, toLine: adv.toLine ?? adv.fromLine ?? 1, note: `Delayed ${Math.round(adv.measuredDelay)} s by a train or accident scene. Made up ${Math.round(adv.recoverable)} s.` });
      }
      if (st.endOfStage && !sim.scorecardAcked) this.act({ type: 'scorecard.ack' });
      return;
    }
    const leg = sim.legIndex; const adv = sim.taAdvice(leg);
    if (adv.measuredDelay > 0 && !this.taDone.has(leg) && !sim.waitingForGo) { this.taDone.add(leg); this.act({ type: 'ta.declare', seconds: Math.round(adv.possible), legIndex: leg }); }
  }

  /** Make up or burn off accumulated error in open cruise (uses truth pace; the "perfect navigator"). */
  private recovering: number | null = null;
  private recover(): void {
    if (this.o.ignoreLosses || this.o.forgetPauses || this.o.noRecovery) return;
    const sim = this.sim; const car = sim.car;
    if (sim.waitingForGo || this.timedPending && !this.timedPending.called) return;
    // no pace chasing inside the warm-up / calibration / transit part of the stage: nothing there is timed against the ghost
    let inTransit = false;
    for (const p of this.plans) { if (p.s > car.s) break; if ((p.ins.transit && !p.ins.transit.end) || p.ins.section === 'start' && p.ins.transit) inTransit = true; else if (p.ins.transit?.end || p.ins.restartTime !== undefined || p.ins.section === 'finish') inTransit = false; }
    if (inTransit) { this.recovering = null; return; }
    // find assigned speed now and distance to the next instruction node
    let assigned: number | null = null; let nextD = Infinity; let nextPlan: Plan | null = null;
    for (const p of this.plans) { if (p.s <= car.s) assigned = p.ins.timed ? (this.timedPending?.called ? p.ins.timed.thenSpeed : p.ins.timed.holdSpeed) : p.ins.speed ?? assigned; else { nextD = p.s - car.s; nextPlan = p; break; } }
    if (assigned === null) return;
    const pace = sim.pace();
    // keep the pace-making speed until close to the next line, unless that line needs a stop, a turn or a speed change worked precisely
    const delicate = !!nextPlan && (nextPlan.ins.pause !== undefined || (nextPlan.ins.turn !== undefined && nextPlan.ins.turn !== 'S') || nextPlan.ins.timed !== undefined || (nextPlan.ins.speed !== undefined && nextPlan.ins.speed !== assigned) || isHoldIns(nextPlan.ins) || nextPlan.ins.section === 'finish' || (sim.sc.course.nodes.find(n => n.id === nextPlan!.ins.nodeId)?.control ?? 'none') !== 'none');
    const nearEvent = nextD < (delicate ? 900 : 300) || car.mode !== 'cruise';
    if (this.recovering !== null) {
      // done when the lateness (or earliness) he was working off is gone, including when a checkpoint has just reset the clock
      const done = this.recovering > assigned ? pace < 0.3 : pace > -0.3;
      if (done || nearEvent) { this.recovering = null; this.act({ type: 'call.speed', mph: assigned }); }
      return;
    }
    if (!nearEvent && Math.abs(pace) > 0.8 && Math.abs(car.mph() - assigned) < 1.5) {
      // the 10 % rule (HB p.10): the bigger the lateness the harder he drives, up to +20 %; a small error gets +2 mph
      const big = Math.abs(pace); const d = big > 25 ? Math.ceil(assigned * 0.2) : big > 6 ? Math.max(5, Math.ceil(assigned * 0.1)) : 2;
      this.recovering = pace > 0 ? assigned + d : Math.max(15, assigned - d);
      this.act({ type: 'call.speed', mph: this.recovering });
    }
  }
}
function bandOf(dir: TurnDir): [number, number] {
  switch (dir) { case 'L': case 'JL': return [-120, -60]; case 'BL': return [-60, -20]; case 'S': return [-20, 20]; case 'BR': return [20, 60]; case 'R': case 'JR': return [60, 120]; case 'AL': return [-180, -120]; case 'AR': return [120, 180]; }
}
function turnAngle(dir: TurnDir): number { return { L: 90, R: 90, S: 0, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 }[dir]; }

export class RandomBot implements Bot {
  name = 'random';
  private r: Rng; private next = 0;
  constructor(private readonly sim: Simulator, seed = 1) { this.r = rng(seed); }
  onTick(): void {
    const sim = this.sim;
    if (sim.phase === 'preread' && sim.tod >= sim.sc.startTime) sim.act({ type: 'start' });
    if (sim.tod < this.next) return;
    this.next = sim.tod + 1 + this.r.next() * 6;
    const dirs: TurnDir[] = ['L', 'R', 'S', 'BL', 'BR', 'AL', 'AR'];
    const choices: Action[] = [
      { type: 'watch.toggle' }, { type: 'watch.lap' }, { type: 'watch.reset' }, { type: 'watch.bezel', seconds: this.r.int(0, 59) },
      { type: 'call.speed', mph: this.r.pick([20, 25, 30, 35, 40, 45, 50, 55]) }, { type: 'call.turn', dir: this.r.pick(dirs) },
      { type: 'call.stop' }, { type: 'call.go' }, { type: 'call.uturn' }, { type: 'call.pass' }, { type: 'line.set', n: this.r.int(1, 50) },
      { type: 'note', text: 'x' }, { type: 'ta.declare', seconds: this.r.int(0, 60) }, { type: 'ledger.set', seconds: this.r.int(-30, 30) },
      { type: 'card.set', card: { '35': 36 } }, { type: 'bezel.set', seconds: this.r.int(0, 59) },
    ];
    const a = this.r.pick(choices);
    try { sim.act(a); } catch (e) { if (!(a.type === 'speedo.setFactor')) throw e; }
  }
}

export function makeBot(name: BotName, sim: Simulator, seed = 1): Bot | null {
  switch (name) {
    case 'oracle': return new OracleBot(sim, { useWatch: true });
    case 'rookie': return new OracleBot(sim, { ignoreLosses: true });
    case 'noPause': return new OracleBot(sim, { forgetPauses: true });
    case 'lateCall': return new OracleBot(sim, { latency: 1.5 });
    case 'goCount': return new OracleBot(sim, { goCount: true });
    case 'random': return new RandomBot(sim, seed);
    case 'none': return null;
  }
}

/** Run a bot to completion. Returns the result. */
export function runBot(sim: Simulator, bot: Bot | null, maxSeconds = 12 * 3600): ReturnType<Simulator['result']> {
  let t = 0;
  while (sim.phase !== 'finished' && t < maxSeconds) { bot?.onTick(sim); sim.step(0.1); t += 0.1; }
  return sim.result();
}

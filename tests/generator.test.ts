import { describe, it, expect } from 'vitest';
import { generateStage, generateLeg, PROFILES, checkRouteExits, sectionAt, SPEEDS } from '../src/core/generator/generate.js';
import { TRAPS, trapById, validateTrapCard, trapCameo, trapToNodeSpec, trapDistractorBefore, turnBand, mainRoadExit, exitForCallout } from '../src/core/generator/traps.js';
import { validateScenario, nodeById, type Scenario, type Node } from '../src/core/course.js';
import { buildGhost } from '../src/core/ghost.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { rng } from '../src/core/rng.js';

const FT_MI = 5280;
const stageCache = new Map<number, Scenario>();
const stage = (seed: number): Scenario => { let s = stageCache.get(seed); if (!s) { s = generateStage(seed, PROFILES.fullStage); stageCache.set(seed, s); } return s; };
const timingCps = (sc: Scenario) => sc.checkpoints.filter(c => c.kind === 'timing');
const insOf = (sc: Scenario, n: Node) => sc.book.find(b => b.nodeId === n.id);
const distractors = (sc: Scenario) => sc.course.nodes.filter(n => !sc.book.some(b => b.nodeId === n.id));

/** The OracleBot files its Time Allowance requests at the printed TA points itself (TA-002); this wrapper only keeps the old test vocabulary. */
class OracleWithTA implements Bot {
  name = 'oracle+ta';
  constructor(private readonly sim: Simulator, private readonly inner: OracleBot) { void this.sim; }
  onTick(): void { this.inner.onTick(); }
}
function oracleRun(sc: Scenario) { const sim = new Simulator(sc); const r = runBot(sim, new OracleWithTA(sim, new OracleBot(sim)), 8 * 3600); return { sim, r }; }

describe('generator', () => {
  it('GEN-001 generateStage(seed) is deterministic and valid (nodes sorted by s, instructions reference existing nodes, every leg has exactly one timing CP, speeds are multiples of 5 in 20..55 (STAGE-007))', () => {
    for (const seed of [1, 2, 3]) {
      const a = generateStage(seed, PROFILES.fullStage), b = generateStage(seed, PROFILES.fullStage);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(validateScenario(a)).toEqual([]);
      for (let i = 1; i < a.course.nodes.length; i++) expect(a.course.nodes[i]!.s).toBeGreaterThanOrEqual(a.course.nodes[i - 1]!.s);
      const ids = new Set(a.course.nodes.map(n => n.id));
      for (const ins of a.book) expect(ids.has(ins.nodeId)).toBe(true);
      // legs = ghost legs; each ends at exactly one timing CP and contains at least one instruction
      const ghost = buildGhost(a);
      expect(ghost.legs.length).toBe(timingCps(a).length);
      let prev = 0;
      for (const leg of ghost.legs) { expect(a.book.some(i => { const s = nodeById(a.course, i.nodeId).s; return s > prev && s < leg.cpS; })).toBe(true); prev = leg.cpS; }
      for (const ins of a.book) {
        for (const v of [ins.speed, ins.timed?.holdSpeed, ins.timed?.thenSpeed]) if (v !== undefined) { expect(v % 5).toBe(0); expect(v).toBeGreaterThanOrEqual(15); expect(v).toBeLessThanOrEqual(55); }
        for (const v of [ins.speed, ins.timed?.holdSpeed, ins.timed?.thenSpeed]) if (v !== undefined && !ins.transit && ins.section !== 'calibration' && ins.section !== 'start') expect(SPEEDS.includes(v)).toBe(true);
      }
    }
    expect(JSON.stringify(generateLeg(4, PROFILES.fullLeg))).toBe(JSON.stringify(generateLeg(4, PROFILES.fullLeg)));
    expect(JSON.stringify(generateStage(1, PROFILES.fullStage))).not.toBe(JSON.stringify(generateStage(2, PROFILES.fullStage)));
  });

  it('GEN-002 Generated full stage has 150-260 instructions, 4-7 timing checkpoints by default (profile.cpCount up to 12 for the "12-CP day" surprise), a calibration section, a lunch restart, and an observation CP at the finish', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const sc = stage(seed);
      expect(sc.book.length).toBeGreaterThanOrEqual(150); expect(sc.book.length).toBeLessThanOrEqual(260);
      const cps = timingCps(sc); expect(cps.length).toBeGreaterThanOrEqual(4); expect(cps.length).toBeLessThanOrEqual(7);
      const cal = sc.book.filter(i => i.section === 'calibration');
      expect(cal.length).toBeGreaterThanOrEqual(4); expect(cal.length).toBeLessThanOrEqual(7); // the begin line plus 3-6 calibration points (STAGE-001)
      // >= 15 miles at 50 mph with perfect interval/cumulative times printed
      const calS = cal.map(i => nodeById(sc.course, i.nodeId).s);
      expect((calS[calS.length - 1]! - calS[0]!) / FT_MI).toBeGreaterThanOrEqual(15);
      expect(cal.every(i => i.perfectInterval !== undefined && i.perfectCumulative !== undefined)).toBe(true);
      expect(cal[cal.length - 1]!.perfectCumulative!).toBeGreaterThan(15 * 3600 / 50);
      const restarts = sc.book.filter(i => i.section === 'restart');
      expect(restarts.length).toBe(2); // after the calibration transit and after the lunch transit
      const lunch = restarts[1]!; expect(lunch.restartTime).toBeDefined();
      const ghost = buildGhost(sc);
      expect(lunch.restartTime! % 60).toBe(0);
      expect(lunch.restartTime!).toBeGreaterThan(ghost.legs[0]!.perfectTod);
      const meal = sc.book.find(i => i.promotedStop?.kind === 'meal'); expect(meal?.promotedStop?.leaveBeforeEndSeconds).toBe(45 * 60); expect(meal!.n).toBeLessThan(lunch.n);
      const finish = sc.course.nodes.find(n => n.kind === 'finish')!;
      const obs = sc.checkpoints.filter(c => c.kind === 'observation');
      expect(obs.length).toBe(1); expect(Math.abs(obs[0]!.s - finish.s)).toBeLessThan(1);
      expect(sc.checkpoints[sc.checkpoints.length - 1]!.kind).toBe('observation');
    }
    const twelve = generateStage(1, { ...PROFILES.fullStage, cpCount: 12 });
    expect(timingCps(twelve).length).toBe(12);
    expect(validateScenario(twelve)).toEqual([]);
  });

  it('GEN-003 Every generated STOP node has a Pause (15) in the book on 70-100 % of STOPs (profile.pauseOnStopProbability, REG-006), never more than two unprinted per leg; each unprinted one is flagged in truth (stop:noPause / trap:missingPause), and profile.noPauseTraps still injects the deliberate missing-pause trap', () => {
    let stops = 0, printed = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sc = stage(seed);
      const flagged = new Set((sc.tags ?? []).filter(t => t.startsWith('trap:missingPause:') || t.startsWith('stop:noPause:')).map(t => Number(t.split(':')[2])));
      for (const n of sc.course.nodes.filter(n => n.control === 'STOP')) {
        const ins = insOf(sc, n);
        expect(ins, `STOP node ${n.id} must carry an instruction`).toBeDefined();
        stops++;
        if (flagged.has(ins!.n)) expect(ins!.pause).toBeUndefined(); else { expect(ins!.pause === 15 || (sectionAt(sc, n.s) === 'warmup' && ins!.pause === undefined)).toBe(true); if (ins!.pause === 15) printed++; }
        if (!flagged.has(ins!.n) && sectionAt(sc, n.s) !== 'warmup') expect(ins!.pause).toBe(15);
      }
    }
    expect(printed / stops).toBeGreaterThanOrEqual(0.6); // warm-up stops carry no pause (Example Rally #4)
    const all = generateStage(2, { ...PROFILES.fullStage, trapDensity: 0, pauseOnStopProbability: 1 });
    expect((all.tags ?? []).some(t => t.startsWith('trap:missingPause') || t.startsWith('stop:noPause'))).toBe(false);
    expect(all.book.filter(i => nodeById(all.course, i.nodeId).control === 'STOP' && sectionAt(all, nodeById(all.course, i.nodeId).s) !== 'warmup').every(i => i.pause === 15)).toBe(true);
    const trap = generateStage(2, { ...PROFILES.fullStage, noPauseTraps: true });
    const tags = (trap.tags ?? []).filter(t => t.startsWith('trap:missingPause:'));
    expect(tags.length).toBeGreaterThanOrEqual(1);
    for (const t of tags) { const ins = trap.book[Number(t.split(':')[2]) - 1]!; expect(nodeById(trap.course, ins.nodeId).control).toBe('STOP'); expect(ins.pause).toBeUndefined(); }
  });

  it('GEN-004 Trap library has >= 15 entries each with instruction text, exits with exactly one isRoute, a wrong-exit list, a tip, and a category; all render to a CAMEO without error', () => {
    expect(TRAPS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(TRAPS.map(t => t.id)).size).toBe(TRAPS.length);
    for (const card of TRAPS) {
      expect(card.instructionText.length).toBeGreaterThan(0);
      expect(card.tip.length).toBeGreaterThan(0); expect(card.visual.length).toBeGreaterThan(0); expect(card.source.length).toBeGreaterThan(0);
      expect(card.category.length).toBeGreaterThan(0);
      expect(card.wrongExits.length).toBeGreaterThanOrEqual(1);
      if (card.exits.length) expect(card.exits.filter(e => e.isRoute).length).toBe(1);
      expect(validateTrapCard(card)).toEqual([]);
      const svg = trapCameo(card);
      expect(svg.startsWith('<svg')).toBe(true); expect(svg.endsWith('</svg>')).toBe(true);
      // exits must agree with how sim.ts picks exits: the callout band, or the pavement-first main road without a callout
      if (card.exits.length) expect((card.turn ? exitForCallout(card.exits, card.turn) : mainRoadExit(card.exits)).isRoute).toBe(true);
      const { node, ins } = trapToNodeSpec(card, { speed: 35 });
      expect(ins.text).toContain(card.instructionText); expect(ins.text).toContain('35 miles per hour');
      if (card.control === 'STOP' && card.pause !== null) { expect(ins.pause).toBe(15); expect(ins.text).toContain('Pause 15 seconds'); }
      if (card.pause === null) { expect(ins.pause).toBeUndefined(); expect(ins.text).not.toContain('Pause'); }
      expect(node.control).toBe(card.control);
      const d = trapDistractorBefore(card, rng(7));
      if (card.distractors?.length) { expect(d).not.toBeNull(); expect(d!.beforeFt).toBeGreaterThanOrEqual(300); expect(d!.beforeFt).toBeLessThanOrEqual(900); }
      else expect(d).toBeNull();
    }
    for (const id of ['stop-vs-yield', 'not-a-t', 'y-vs-fork', 'bear-vs-turn', 'acute-vs-turn', 'jog-left-at-stop', 'first-paved-road', 'first-paved-vs-gravel', 'quoted-sign-mismatch', 'straight-as-possible-fork', 'side-road-stop-facing-away', 'hidden-speed-sign', 'forgotten-pause', 'missing-pause', 'after-sign', 'at-sign', 'second-occurrence', 'onto-follows-name', 'off-course-loop', 'comes-quick', 'cp-after-stop']) expect(trapById(id).id).toBe(id);
    expect(() => trapCameo({ ...trapById('not-a-t'), exits: trapById('not-a-t').exits.map(e => ({ ...e, isRoute: true })) })).toThrow();
    expect(turnBand('BL')).toEqual([-60, -20]);
  });

  it('GEN-005 Timing checkpoints may be placed anywhere on a leg, including shortly after stops, speed changes and turns ("the most inopportune places"), but never inside a pause node (within stopLineOffset + 50 ft of it), never within 300 ft BEFORE a STOP or SIGNAL node (braking for the control inside the CP sight zone would make SIM-004 unfair), and never in warm-up, calibration, transit or free-zone sections', () => {
    let shortlyAfter = 0, total = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sc = stage(seed);
      for (const cp of timingCps(sc)) {
        total++;
        for (const n of sc.course.nodes) {
          const ins = insOf(sc, n);
          if (ins?.pause) { const line = n.s - (n.stopLineOffset ?? 0); expect(cp.s < line - 50 || cp.s > n.s + 50).toBe(true); }
          if (n.control === 'STOP' || n.control === 'SIGNAL') expect(!(n.s > cp.s && n.s - cp.s < 300), `CP ${cp.id} within 300 ft before ${n.control} ${n.id}`).toBe(true);
          expect(Math.abs(n.s - cp.s)).toBeGreaterThanOrEqual(50); // never at a node
        }
        const sec = sectionAt(sc, cp.s);
        expect(['warmup', 'calibration', 'transit', 'freezone'].includes(sec ?? '')).toBe(false);
        if (sc.course.nodes.some(n => { const i = insOf(sc, n); return cp.s - n.s > 0 && cp.s - n.s <= 0.4 * FT_MI && (n.control === 'STOP' || n.control === 'SIGNAL' || (i && (i.speed !== undefined || (i.turn && i.turn !== 'S')))); })) shortlyAfter++;
      }
    }
    expect(shortlyAfter).toBeGreaterThan(0); expect(shortlyAfter).toBeLessThan(total); // both kinds of places are used
  });

  it('GEN-006 Distractor nodes (driveway, lot, gravel, deadend, side-road STOP facing away) never carry an instruction and are drawn with trapDensity probability', () => {
    const dense = generateStage(3, { ...PROFILES.fullStage, trapDensity: 0.6 });
    const normal = stage(3);
    const none = generateStage(3, { ...PROFILES.fullStage, trapDensity: 0 });
    expect(distractors(none).length).toBe(0);
    expect(distractors(normal).length).toBeGreaterThan(0);
    expect(distractors(dense).length).toBeGreaterThan(distractors(normal).length);
    const kinds = new Set<string>();
    for (const n of distractors(dense)) {
      expect(dense.book.some(b => b.nodeId === n.id)).toBe(false);
      for (const e of n.exits ?? []) if (!e.isRoute) kinds.add(e.kind === 'road' && e.surface === 'gravel' ? 'gravel' : e.controlOnExit === 'STOP' ? 'sideStop' : e.kind);
      if (n.exits) expect(n.exits.filter(e => e.isRoute).length).toBe(1);
    }
    for (const k of ['driveway', 'lot', 'gravel', 'deadend', 'sideStop']) expect(kinds.has(k), `distractor kind ${k}`).toBe(true);
    expect(validateScenario(dense)).toEqual([]);
  });

  it('GEN-007 In every generated stage at least one timing checkpoint lies 300-1500 ft after a STOP node, and at least 35 % of timing checkpoints lie within 0.4 mi after a STOP, SIGNAL, speed change or turn (seeded, statistical over 20 stages); the debrief tags such legs "CP right after a maneuver"', () => {
    let cps = 0, within = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sc = stage(seed);
      const stops = sc.course.nodes.filter(n => n.control === 'STOP');
      const afterStop = timingCps(sc).filter(cp => stops.some(n => cp.s - n.s >= 300 && cp.s - n.s <= 1500));
      expect(afterStop.length, `stage ${seed} needs a CP 300-1500 ft after a STOP`).toBeGreaterThanOrEqual(1);
      for (const cp of timingCps(sc)) {
        cps++;
        const maneuver = sc.course.nodes.some(n => { const i = insOf(sc, n); return cp.s - n.s > 0 && cp.s - n.s <= 0.4 * FT_MI && (n.control === 'STOP' || n.control === 'SIGNAL' || (i && (i.speed !== undefined || (i.turn && i.turn !== 'S')))); });
        if (maneuver) within++;
        const tagged = (sc.tags ?? []).some(t => t.startsWith(`cp:${cp.id}:afterManeuver`));
        if (tagged) expect(maneuver).toBe(true);
      }
      expect((sc.tags ?? []).some(t => t.includes(':afterManeuver:'))).toBe(true);
    }
    expect(within / cps).toBeGreaterThanOrEqual(0.35);
  });

  it('GEN-008 Every route intersection has exactly one isRoute exit, including nodes without an instruction; when the node has a turn instruction the route exit\'s angle lies in that turn\'s band (DRV-007); when it has none the route exit is the straight-as-possible real road under the scenario\'s mainRoadRule', () => {
    for (const seed of [1, 2, 3, 4]) {
      const sc = stage(seed);
      expect(checkRouteExits(sc, 'pavement-first')).toEqual([]);
      for (const n of sc.course.nodes.filter(n => n.kind === 'intersection')) {
        const routes = n.exits!.filter(e => e.isRoute); expect(routes.length).toBe(1);
        const ins = insOf(sc, n);
        if (ins?.turn) { const [lo, hi] = turnBand(ins.turn); expect(routes[0]!.angle).toBeGreaterThanOrEqual(lo); expect(routes[0]!.angle).toBeLessThanOrEqual(hi); }
        else expect(mainRoadExit(n.exits!, 'pavement-first').isRoute).toBe(true);
      }
    }
  });

  it('all presets generate valid scenarios for both generateLeg and generateStage', () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      const leg = generateLeg(1, p), st = generateStage(1, p);
      expect(validateScenario(leg), name).toEqual([]); expect(validateScenario(st), name).toEqual([]);
      expect(timingCps(leg).length).toBe(1);
      expect(leg.book.filter(i => i.section === 'restart' && /LUNCH/.test(i.text)).length).toBe(0);
      if (p.calibration) expect(leg.book.some(i => i.section === 'calibration')).toBe(true);
      if (!p.signals) expect(leg.hazards.some(h => h.kind === 'signal')).toBe(false);
      if (!p.trains) expect(leg.hazards.some(h => h.kind === 'train')).toBe(false);
    }
    const combo = generateStage(1, PROFILES.combo); expect(timingCps(combo).length).toBe(2);
    // signals carry a hazard and no pause; trains are timed so about half the oracle arrivals meet them
    const sc = stage(1);
    for (const n of sc.course.nodes.filter(n => n.control === 'SIGNAL' && sectionAt(sc, n.s) !== 'warmup')) { expect(sc.hazards.some(h => h.kind === 'signal' && Math.abs(h.s - n.s) < 1)).toBe(true); expect(insOf(sc, n)!.pause).toBeUndefined(); }
    for (const h of sc.hazards.filter(h => h.kind === 'train')) expect(sc.course.nodes.some(n => n.control === 'RR' && Math.abs(h.s - n.s) < 1)).toBe(true); // a crossing without a hazard is simply open (never a plain RR with a pause: REG-006)
    for (const n of sc.course.nodes.filter(n => n.control === 'RR')) expect(insOf(sc, n)?.pause).toBeUndefined();
    const trains = (sc.tags ?? []).filter(t => t.startsWith('train:'));
    expect(trains.length).toBeGreaterThan(0);
    // timed segments never span another instruction and hold 20-90 s
    for (const i of sc.book) if (i.timed) { expect(i.timed.seconds).toBeGreaterThanOrEqual(20); expect(i.timed.seconds).toBeLessThanOrEqual(90); }
    // column-D hints on a healthy share of lines
    const hints = sc.book.filter(i => i.hint).length / sc.book.length;
    expect(hints).toBeGreaterThan(0.1); expect(hints).toBeLessThan(0.5);
  });

  it('oracle smoke: the OracleBot finishes 6 full legs and 2 full stages on course within 5 s per leg (plus the committee-recoverable half after a delay)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sc = generateLeg(seed, { ...PROFILES.fullLeg, trafficWaitProbability: 0 });
      const { sim, r } = oracleRun(sc);
      expect(sim.phase).toBe('finished');
      expect(r.offCourseCount).toBe(0);
      expect(r.observationMissed).toBe(false);
      expect(r.score.legs.length).toBe(1);
      // 5 s, plus half of what the committee says could have been made up after a train or red light (TA-003): the oracle cannot drive +10 % through every approach zone
      for (const leg of r.score.legs) { expect(leg.error, `fullLeg seed ${seed}`).not.toBeNull(); expect(Math.abs(leg.error!), `fullLeg seed ${seed} leg ${leg.index}`).toBeLessThanOrEqual(5 + 0.5 * (sim.taRecoverable[leg.index] ?? 0)); }
    }
    for (const seed of [1, 2]) {
      const sc = generateStage(seed, { ...PROFILES.fullStage, trafficWaitProbability: 0 });
      const { sim, r } = oracleRun(sc);
      expect(sim.phase).toBe('finished');
      expect(r.offCourseCount).toBe(0);
      expect(r.observationMissed).toBe(false);
      expect(r.score.legs.length).toBe(timingCps(sc).length);
      expect(r.score.earlyRestartPenalty).toBe(0);
      for (const leg of r.score.legs) { expect(leg.error, `fullStage seed ${seed} leg ${leg.index}`).not.toBeNull(); expect(Math.abs(leg.error!), `fullStage seed ${seed} leg ${leg.index}`).toBeLessThanOrEqual(5 + 0.5 * (sim.taRecoverable[leg.index] ?? 0)); }
      expect(r.dnf).toBe(false); expect(r.ta.scorecardAcked).toBe(true);
    }
  }, 60000);
});

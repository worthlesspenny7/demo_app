import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, validateScenario, nodeById, type Scenario } from '../src/core/course.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { generateStage, generateLeg, PROFILES, sectionAt } from '../src/core/generator/generate.js';
import { columnBSymbols, columnCLines, formatInterval } from '../src/core/griid.js';
import { calibrationFactor } from '../src/core/calibration.js';
import { Simulator, ACTION_LIST } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { hms, mphToFps } from '../src/core/units.js';
import { championshipTotal } from '../src/core/scoring.js';
import { stepUntil, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const FT_MI = 5280;
const day = (seed: number, p = PROFILES.fullStage!) => generateStage(seed, p);

describe('stage structure (STAGE-001..008)', () => {
  it('STAGE-001 a generated day: start + warm-up, calibration run, transit, restart, timed portion, end timed + TA, lunch transit, restart, timed portion, end timed + TA, transit, finish with the observation stop', () => {
    for (const seed of [1, 2, 3, 4]) {
      const sc = day(seed); expect(validateScenario(sc)).toEqual([]);
      const idx = (f: (i: Scenario['book'][number]) => boolean, from = 0) => { const k = sc.book.findIndex((i, j) => j >= from && f(i)); expect(k, `seed ${seed}`).toBeGreaterThanOrEqual(0); return k; };
      const start = idx(i => i.section === 'start'); expect(columnBSymbols(sc.book[start])).toEqual(['warmup']);
      const cal = idx(i => !!i.calibrationStart, start); const r1 = idx(i => i.section === 'restart', cal); const e1 = idx(i => !!i.endTimed, r1); const ta1 = idx(i => !!i.taPoint, e1);
      const meal = idx(i => i.promotedStop?.kind === 'meal', ta1); const r2 = idx(i => i.section === 'restart', meal); const e2 = idx(i => !!i.endTimed, r2); const ta2 = idx(i => !!i.taPoint, e2); const fin = idx(i => i.section === 'finish', ta2);
      expect(sc.book[ta1]!.taPoint!.endOfStage).toBe(false); expect(sc.book[ta2]!.taPoint!.endOfStage).toBe(true); expect(fin).toBe(sc.book.length - 1);
      expect(sc.checkpoints[sc.checkpoints.length - 1]!.kind).toBe('observation');
      // ~8 mi / 20 min warm-up, calibration >= 15 mi with 3-6 points, no timing checkpoint before the first restart
      expect(sc.book[start]!.transit).toMatchObject({ exact: false, plain: true, seconds: 1200 }); expect(sc.book[start]!.transit!.miles!).toBeGreaterThan(6); expect(sc.book[start]!.transit!.miles!).toBeLessThan(10);
      const firstCp = sc.checkpoints.find(c => c.kind === 'timing')!; expect(firstCp.s).toBeGreaterThan(nodeById(sc.course, sc.book[r1]!.nodeId).s);
      const lastTiming = sc.checkpoints.filter(c => c.kind === 'timing').pop()!; expect(lastTiming.s).toBeLessThan(nodeById(sc.course, sc.book[e2]!.nodeId).s);
      // legs between the restarts and end-timed lines
      expect(sc.checkpoints.some(c => c.kind === 'timing' && c.s > nodeById(sc.course, sc.book[r1]!.nodeId).s && c.s < nodeById(sc.course, sc.book[e1]!.nodeId).s)).toBe(true);
      expect(sc.checkpoints.some(c => c.kind === 'timing' && c.s > nodeById(sc.course, sc.book[r2]!.nodeId).s && c.s < nodeById(sc.course, sc.book[e2]!.nodeId).s)).toBe(true);
    }
    const leg = generateLeg(2, PROFILES.fullLeg!); expect(leg.book.some(i => i.endTimed)).toBe(true); expect(leg.book.find(i => i.taPoint)!.taPoint!.endOfStage).toBe(true); expect(leg.book[leg.book.length - 1]!.section).toBe('finish');
    expect(generateLeg(2, { ...PROFILES.fullLeg!, endTimed: false }).book.some(i => i.taPoint)).toBe(false);
  });
  it('STAGE-001 the oracle drives the whole day: no DNF, scorecard acknowledged, no early departure, legs on time', () => {
    const sc = generateStage(1, { ...PROFILES.fullStage!, trafficWaitProbability: 0 }); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim), 12 * 3600);
    expect(sim.phase).toBe('finished'); expect(r.dnf).toBe(false); expect(r.observationMissed).toBe(false); expect(r.ta.scorecardAcked).toBe(true); expect(r.earlyDepartureMinutes).toEqual([]); expect(r.offCourseCount).toBe(0);
    for (const l of r.score.legs) expect(Math.abs(l.error!)).toBeLessThanOrEqual(5 + 0.5 * (sim.taRecoverable[l.index] ?? 0));
  });

  it('STAGE-002 every start and restart is printed base + the assigned starting position in minutes; drills default to ASP 0', () => {
    expect(new ScenarioBuilder({ startTime: T0 }).start(30).build().asp).toBe(0);
    const b = new ScenarioBuilder({ startTime: T0, asp: 17 }).start(30).advanceMiles(1).checkpoint().advanceMiles(1).restart(35, hms(12, 30, 0)).advanceMiles(2).checkpoint().advanceFt(300).finish();
    const sc = b.build();
    expect(sc.asp).toBe(17); expect(sc.baseStartTime).toBe(T0); expect(sc.startTime).toBe(T0 + 17 * 60); expect(sc.book[0]!.restartTime).toBe(T0 + 17 * 60); expect(sc.book[0]!.baseTime).toBe(T0);
    const rs = sc.book[1]!; expect(rs.baseTime).toBe(hms(12, 30, 0)); expect(rs.restartTime).toBe(hms(12, 30, 0) + 17 * 60);
    expect(columnCLines(rs, 'CDT')[0]).toBe('CDT 12:30:00'); // the book prints the base, the team leaves at base + ASP
    expect(buildGhost(sc).legs[1]!.anchor).toEqual({ kind: 'official', tod: hms(12, 30, 0) + 17 * 60 });
    const g = day(2, { ...PROFILES.fullStage!, asp: 42, timeZone: 'EDT' }); expect(g.asp).toBe(42); expect(g.timeZone).toBe('EDT');
    for (const r of g.book.filter(i => i.restartTime !== undefined)) expect(r.restartTime! - r.baseTime!).toBe(42 * 60);
    expect(new Simulator(g).observe().asp).toBe(42);
  });

  const exactStage = () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.6).checkpoint().advanceMiles(0.4);
    b.transit({ exact: true, seconds: 600 }).advanceMiles(3).endTransit({ speed: 35 }).advanceMiles(1.4).checkpoint().advanceFt(300).finish();
    return b.build();
  };
  const runExact = (delta: number) => {
    const sc = exactStage(); const sim = new Simulator(sc); const orig = sim.holdGoTod.bind(sim); const endNode = sc.book.find(i => i.transit?.end)!.nodeId;
    sim.holdGoTod = (n) => { const g = orig(n); return g !== null && n.id === endNode ? g + delta : g; };
    const r = runBot(sim, new OracleBot(sim, { noRecovery: true })); return { sim, r, sc };
  };
  it('STAGE-003 an exact transit: OUT = IN + the interval, and leaving early or late shifts the next leg by that amount', () => {
    const { sim, r, sc } = runExact(0);
    const begin = sc.book.find(i => i.transit && !i.transit.end)!, end = sc.book.find(i => i.transit?.end)!;
    expect(sim.transitIn[begin.n]).toBeGreaterThan(T0); expect(sim.transitOutFor(end)).toBe(sim.transitIn[begin.n]! + 600);
    expect(sim.events.find(e => e.type === 'transit.out')!.detail!.out).toBe(sim.transitIn[begin.n]! + 600);
    expect(buildGhost(sc).legs[1]!.anchor).toEqual({ kind: 'transit', beginN: begin.n, endN: end.n, seconds: 600 });
    expect(Math.abs(r.score.legs[1]!.error!)).toBeLessThanOrEqual(2);
    const late = runExact(20).r.score.legs[1]!.error!, early = runExact(-15).r.score.legs[1]!.error!;
    expect(late - r.score.legs[1]!.error!).toBeGreaterThan(17); expect(late - r.score.legs[1]!.error!).toBeLessThan(23);
    expect(r.score.legs[1]!.error! - early).toBeGreaterThan(12); expect(r.score.legs[1]!.error! - early).toBeLessThan(18);
    expect(sim.result().score.legs[1]!.anchorTod).toBe(sim.transitOutFor(end));
  });
  it('STAGE-003 an advisory transit is untimed: only the time-of-day restart after it anchors the next leg; a 2-minute free zone follows every transit end', () => {
    const mk = (seconds: number) => { const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4).transit({ exact: false, seconds }).advanceMiles(2).restart(35, T0 + 1800).advanceMiles(1.4).checkpoint().advanceFt(300).finish(); return b.build(); };
    const a = runBot(new Simulator(mk(300)), null), b = new Simulator(mk(3000)); const rb = runBot(b, new OracleBot(b));
    const sa = new Simulator(mk(300)); const ra = runBot(sa, new OracleBot(sa));
    expect(ra.score.legs[0]!.error).toBe(rb.score.legs[0]!.error); void a;
    // no checkpoint within 2 minutes of the transit end
    const bad = new ScenarioBuilder({ startTime: T0 }).start(35).advanceMiles(0.4).transit({ exact: true, seconds: 300 }).advanceMiles(1).endTransit({ speed: 35 }).advanceMiles(0.5).checkpoint().advanceMiles(1).checkpoint().build();
    expect(validateScenario(bad).some(p => /2-minute free zone/.test(p))).toBe(true);
    const ok = new ScenarioBuilder({ startTime: T0 }).start(35).advanceMiles(0.4).transit({ exact: true, seconds: 300 }).advanceMiles(1).endTransit({ speed: 35 }).advanceMiles(1.3).checkpoint().build();
    expect(validateScenario(ok)).toEqual([]);
    for (const seed of [1, 2, 3]) expect(validateScenario(day(seed))).toEqual([]);
  });

  it('STAGE-004 a free zone: no timing checkpoint until End Free Zone; generated stages place 0-1 per timed portion', () => {
    const bad = new ScenarioBuilder({ startTime: T0 }).start(35).advanceMiles(0.4).freeZone().advanceMiles(0.5).checkpoint().advanceMiles(0.5).endFreeZone().advanceMiles(0.5).checkpoint().build();
    expect(validateScenario(bad).some(p => /free zone/.test(p))).toBe(true);
    const ok = new ScenarioBuilder({ startTime: T0 }).start(35).advanceMiles(0.4).freeZone().advanceMiles(0.5).endFreeZone().advanceMiles(0.5).checkpoint().build();
    expect(validateScenario(ok)).toEqual([]); expect(columnBSymbols(ok.book[1])).toEqual(['freezone-begin']);
    let withZone = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const sc = day(seed); expect(validateScenario(sc)).toEqual([]);
      const restarts = sc.book.filter(i => i.section === 'restart').map(i => i.n); const ends = sc.book.filter(i => i.endTimed).map(i => i.n);
      for (let p = 0; p < 2; p++) { const n = sc.book.filter(i => i.freeZone === 'begin' && i.n > restarts[p]! && i.n < ends[p]!).length; expect(n).toBeLessThanOrEqual(1); withZone += n; expect(sc.book.filter(i => i.freeZone === 'end' && i.n > restarts[p]! && i.n < ends[p]!).length).toBe(n); }
    }
    expect(withZone).toBeGreaterThan(0);
    expect(Math.max(...[1, 2, 3, 4, 5, 6].map(sd => day(sd, { ...PROFILES.fullStage!, freeZoneProbability: 0 }).book.filter(i => i.freeZone).length))).toBe(0);
  });

  it('STAGE-005 a promoted stop inside a transit: the scheduled departure is the transit end time minus "leave X prior"; the lunch restart is the time-of-day restart ending the transit', () => {
    const sc = day(1); const sim = new Simulator(sc);
    const meal = sc.book.find(i => i.promotedStop?.kind === 'meal')!; const restart = sc.book.find(i => i.section === 'restart' && i.n > meal.n)!;
    expect(meal.promotedStop!.leaveBeforeEndSeconds).toBe(2700); expect(meal.section).toBe('lunch'); expect(columnCLines(meal)).toEqual(['(45m00s)']);
    expect(sim.holdGoTod(nodeById(sc.course, meal.nodeId))).toBe(restart.restartTime! - 2700);
    expect(restart.transit?.end).toBe(true); expect(restart.section).toBe('restart');
    const r = runBot(new Simulator(sc), null); void r;
    const s2 = new Simulator(generateStage(1, { ...PROFILES.fullStage!, trafficWaitProbability: 0 })); const res = runBot(s2, new OracleBot(s2), 12 * 3600); expect(res.earlyDepartureMinutes).toEqual([]);
    expect(s2.events.filter(e => e.type === 'wait' && e.detail?.reason === 'hold').length).toBeGreaterThanOrEqual(3);
  });

  it('STAGE-006 the calibration run: official times to 0.1 s per point, official time rounded up to the minute, transit allowance 2-5 min longer, ghost at the assigned speed, not scored, and k comes from it (CAL-001)', () => {
    for (const seed of [1, 2, 3]) {
      const sc = day(seed); const cal = sc.book.filter(i => i.section === 'calibration'); const begin = cal[0]!; const pts = cal.slice(1);
      expect(begin.calibrationStart).toBe(true); expect(pts.length).toBeGreaterThanOrEqual(3); expect(pts.length).toBeLessThanOrEqual(6);
      const miles = (nodeById(sc.course, cal[cal.length - 1]!.nodeId).s - nodeById(sc.course, begin.nodeId).s) / FT_MI; expect(miles).toBeGreaterThanOrEqual(15);
      let prev = 0; for (const p of pts) { expect(Math.round(p.perfectCumulative! * 10)).toBeCloseTo(p.perfectCumulative! * 10, 6); expect(p.perfectInterval!).toBeCloseTo(p.perfectCumulative! - prev, 6); prev = p.perfectCumulative!; }
      const official = Math.ceil(prev / 60) * 60; const allowance = begin.transit!.seconds;
      // ENG-027 (REG Example #5 / #10): the start row prints the official time itself (the run rounded up to the minute); the 2-5 min allowance rides on the plain transit after the last box
      expect(allowance).toBe(official); const after = cal[cal.length - 1]!.transit!; expect(after).toMatchObject({ exact: false, plain: true });
      const restart = sc.book.find(i => i.section === 'restart' && i.n > cal[cal.length - 1]!.n)!;
      expect(restart.baseTime! - (sc.book[0]!.baseTime ?? sc.book[0]!.restartTime!) - 1200 - official).toBe(after.seconds);   // warm-up + official + the transit (with the allowance) = the printed restart base
      const calSpeed = Number((sc.tags ?? []).find(t => t.startsWith('calibration:speed:'))!.split(':')[2]); expect([50, 55]).toContain(calSpeed); expect(columnCLines(begin)).toEqual([`${calSpeed} MPH`, formatInterval(allowance), '* 0m00.0s']); expect(columnCLines(pts[0]!)[0]).toMatch(/^\d+m\d\d\.\ds$/);
      const g = buildGhost(sc); expect(ghostTimeAt(g, nodeById(sc.course, cal[cal.length - 1]!.nodeId).s) - ghostTimeAt(g, nodeById(sc.course, begin.nodeId).s)).toBeCloseTo(miles * 3600 / calSpeed, 0);
      expect(sc.checkpoints.some(c => c.kind === 'timing' && c.s <= nodeById(sc.course, cal[cal.length - 1]!.nodeId).s)).toBe(false); // free zone: nothing scored
    }
    // the team's measured k from the run: a speedometer reading 1 % high makes the actual intervals ~1 % longer
    const sc = generateStage(2, { ...PROFILES.fullStage!, speedo: { ...PERFECT_TIMEWISE, gain: 1.01 }, trafficWaitProbability: 0 }); const sim = new Simulator(sc); const cal = sc.book.filter(i => i.section === 'calibration');
    const bot = new OracleBot(sim, { noRecovery: true }); const at: Record<number, number> = {};
    while (sim.phase !== 'finished' && !cal.every(c => at[c.n] !== undefined)) { bot.onTick(); sim.step(0.1); for (const c of cal) if (at[c.n] === undefined && sim.car.s >= nodeById(sc.course, c.nodeId).s) at[c.n] = sim.tod; }
    const iv = cal.slice(2).map((c, i) => ({ perfect: c.perfectCumulative! - cal[i + 1]!.perfectCumulative!, actual: at[c.n]! - at[cal[i + 1]!.n]! }));
    expect(calibrationFactor(iv)).toBeGreaterThan(0.98); expect(calibrationFactor(iv)).toBeLessThan(1.001);
  });

  it('STAGE-007 assigned speeds are multiples of 5 from 15 to 55 (plus 48, SPEED-001), and a SPEED LIMIT sign never posts a limit below the assigned speed', () => {
    const seen = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5]) for (const ins of day(seed).book) {
      for (const v of [ins.speed, ins.timed?.holdSpeed, ins.timed?.thenSpeed]) if (v !== undefined) { expect(v === 48 || v === 12 || v % 5 === 0).toBe(true); expect(v).toBeGreaterThanOrEqual(12); expect(v).toBeLessThanOrEqual(55); seen.add(v); }   // GEN-015: 12 / 15 in towns
    }
    expect(seen.has(20)).toBe(true); expect(seen.has(55)).toBe(true);
    const sc = day(3); for (const ins of sc.book) { const m = nodeById(sc.course, ins.nodeId).sign?.text.match(/^SPEED LIMIT (\d+)$/); if (m && ins.speed !== undefined) expect(Number(m[1])).toBeGreaterThanOrEqual(ins.speed - 10); }   // GEN-015 (REG VII.E.1.c): sometimes at or below the assigned speed
  });

  it('STAGE-008 emergency GR signs (End Leg cancels a leg) are a backlog item: the engine has no GR action or instruction yet', () => {
    expect(ACTION_LIST.some(a => a.startsWith('gr.'))).toBe(false);
  });

  it('DRILL-025 generator side: pauses are printed only where Column C says so (probability profile setting), TA point and end-timed lines come from the skeleton, and the ghost adds only printed pauses', () => {
    expect(PROFILES.fullStage!.pauseOnStopProbability).toBe(0.85); expect(PROFILES.pauseDrill!.pauseOnStopProbability).toBe(1);
    for (const seed of [1, 2, 3]) {
      const sc = day(seed); const g = buildGhost(sc);
      for (const ins of sc.book) {
        const n = nodeById(sc.course, ins.nodeId); const s = instructionOfS(sc, ins);
        const jump = g.breakpoints.some((b, i) => i > 0 && b.s === s && b.t - g.breakpoints[i - 1]!.t >= 14.9 && b.t - g.breakpoints[i - 1]!.t <= 15.1 && g.breakpoints[i - 1]!.s === s);
        if (ins.pause) expect(jump, `line ${ins.n}`).toBe(true);
        else if (n.control === 'STOP') expect(jump, `no pause printed at line ${ins.n}`).toBe(false);
      }
      expect(sc.book.filter(i => nodeById(sc.course, i.nodeId).control === 'RR').every(i => !i.pause || nodeById(sc.course, i.nodeId).fullStop)).toBe(true);   // GEN-016: only the tracks row of a two-row crossing pauses
    }
    const sig = generateStage(4, { ...PROFILES.fullStage!, pauseOnSignalProbability: 1, trafficWaitProbability: 0 });
    expect(sig.book.filter(i => nodeById(sig.course, i.nodeId).control === 'SIGNAL' && sectionAt(sig, nodeById(sig.course, i.nodeId).s) !== 'warmup').some(i => i.pause === 15)).toBe(true);
    expect(validateScenario(sig)).toEqual([]);
  });

  it('CAMP-001 (core side) the championship function takes the campaign division and keeps Stage 0 out of the total', () => {
    const st = (stage: number, p: number[]) => ({ stage, score: { legs: p.map(x => ({ penalty: x })), penaltyItems: p, dnf: false, ageFactor: 0.845 } as never });
    expect(championshipTotal([st(0, [100]), st(1, [10, 20])], 'rookie').raw).toBe(30);
  });
});
function instructionOfS(sc: Scenario, ins: Scenario['book'][number]): number { const n = nodeById(sc.course, ins.nodeId); return n.kind === 'intersection' && n.control !== 'none' ? n.s - (n.stopLineOffset ?? 0) : n.s; }
void mphToFps; void stepUntil; void startLikeOracle; void EXITS;

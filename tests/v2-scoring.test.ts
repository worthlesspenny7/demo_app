import { describe, it, expect } from 'vitest';
import { scoreLeg, scoreStage, ageFactor, championshipTotal, compareStandings, rankStandings, DIVISION_DISCARDS, TIE_BREAK_ORDER, type LegScore, type StageScore } from '../src/core/scoring.js';
import { DEFAULT_RULES, DRIVER_EXPERT } from '../src/core/course.js';
import type { Leg } from '../src/core/ghost.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { hms, milesToFt } from '../src/core/units.js';
import { stepUntil, startLikeOracle, runToEnd } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const leg = (i: number, dur: number): Leg => ({ index: i, cpId: `cp${i}`, cpS: 1000 * i, perfectTod: T0 + dur, perfectDuration: dur, cumulativePerfect: dur, anchor: i === 1 ? { kind: 'official', tod: T0 } : { kind: 'checkpoint', cpId: `cp${i - 1}` } });
const rec = (cpId: string, actual: number | null, sight = false) => ({ cpId, kind: 'timing' as const, actualTod: actual, rawTod: actual, sightViolation: sight });
const score = (dur: number, actual: number | null, extra: Partial<Parameters<typeof scoreLeg>[0]> = {}): LegScore => scoreLeg({ leg: leg(1, dur), record: actual === null ? undefined : rec('cp1', actual), anchorActual: T0, taDeclared: 0, taQualifying: 0, ...extra }, DEFAULT_RULES);

describe('REG scoring (2026 Event Regulations V.C-V.E)', () => {
  it('REG-001 leg penalty = |actual - perfect| in whole seconds, capped 120 s late and 300 s early; the cap applies after a Time Allowance', () => {
    expect(score(600, T0 + 612).penalty).toBe(12);
    expect(score(600, T0 + 590).penalty).toBe(10);
    expect(score(600, T0 + 600 + 119).penalty).toBe(119);
    expect(score(600, T0 + 600 + 121).penalty).toBe(120);
    expect(score(1200, T0 + 1200 - 299).penalty).toBe(299);
    expect(score(1200, T0 + 1200 - 400).penalty).toBe(300);
    expect(score(600, T0 + 600 + 400).capped).toBe(true);
    expect(DEFAULT_RULES.maxLate).toBe(120); expect(DEFAULT_RULES.maxEarly).toBe(300);
  });
  it('REG-001 a never-crossed checkpoint, or one more than 30 minutes after the cumulative perfect time, scores 180 s and counts as missed', () => {
    const never = score(600, null); expect(never.penalty).toBe(180); expect(never.extras.missed).toBe(true);
    const late = score(600, T0 + 600 + 31 * 60); expect(late.penalty).toBe(180); expect(late.extras.missed).toBe(true);
    // "from the most recent start or restart": leg 2 is only 12 s late after its own checkpoint anchor but 31 min late against the cumulative perfect time
    const l2: Leg = { ...leg(2, 300), cumulativePerfect: 900 };
    const cum = scoreLeg({ leg: l2, record: rec('cp2', T0 + 900 + 31 * 60), anchorActual: T0 + 900 + 31 * 60 - 312, cumulativeAnchorActual: T0, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(cum.rawError).toBe(12); expect(cum.extras.missed).toBe(true);
    expect(DEFAULT_RULES.missedCheckpoint).toBe(180);
  });
  it('REG-001 missing the final checkpoint scores the stage DNF/FNS: leg penalties so far plus 180 s per missed leg', () => {
    const legs = [score(600, T0 + 604), scoreLeg({ leg: leg(2, 600), record: undefined, anchorActual: T0 + 604, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES), scoreLeg({ leg: leg(3, 600), record: undefined, anchorActual: T0 + 604, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES)];
    const st = scoreStage(legs, 1939, DEFAULT_RULES, { observationMissed: false });
    expect(st.dnf).toBe(true); expect(st.dnfReason).toMatch(/final Timing Checkpoint/); expect(st.raw).toBe(4 + 180 + 180);
    expect(scoreStage([legs[0]!], 1939, DEFAULT_RULES, { observationMissed: false }).dnf).toBe(false);
    expect(scoreStage([legs[0]!], 1939, DEFAULT_RULES, { observationMissed: true, observationNeverReached: true }).dnf).toBe(true);
  });
  it('REG-001 an aborted stage in the simulator is flagged DNF and every unreached leg scores 180 s; times are recorded to the nearest second', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(1).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'start' }); sim.step(10); sim.act({ type: 'abort' });
    const r = sim.result(); expect(r.dnf).toBe(true); expect(r.score.legs.map(l => l.penalty)).toEqual([180, 180]);
    const ok = new Simulator(sc); const r2 = runBot(ok, new OracleBot(ok)); expect(r2.dnf).toBe(false);
    for (const rc of r2.records) if (rc.actualTod !== null) expect(Number.isInteger(rc.actualTod)).toBe(true);
  });

  it('REG-002 the age factor is the printed V.D table, never interpolated', () => {
    const printed: Record<number, number> = { 1953: 0.915, 1952: 0.91, 1951: 0.905, 1950: 0.9, 1949: 0.895, 1948: 0.89, 1947: 0.885, 1946: 0.88, 1945: 0.875, 1944: 0.87, 1943: 0.865, 1942: 0.86, 1941: 0.855, 1940: 0.85, 1939: 0.845, 1938: 0.84, 1937: 0.835, 1936: 0.83, 1935: 0.825, 1934: 0.82, 1933: 0.815, 1932: 0.81, 1931: 0.805, 1930: 0.8, 1929: 0.79, 1928: 0.78, 1927: 0.77, 1926: 0.76, 1925: 0.75, 1924: 0.74, 1923: 0.73, 1922: 0.72, 1921: 0.71, 1920: 0.7, 1919: 0.69, 1918: 0.68, 1917: 0.67, 1916: 0.66, 1915: 0.65, 1914: 0.64, 1913: 0.63, 1912: 0.62, 1911: 0.61, 1910: 0.6, 1909: 0.59, 1908: 0.58, 1907: 0.57, 1906: 0.56, 1905: 0.55, 1904: 0.54, 1903: 0.53, 1902: 0.52, 1901: 0.51, 1900: 0.5 };
    for (const [y, f] of Object.entries(printed)) expect(ageFactor(Number(y)), `year ${y}`).toBe(f);
    expect(ageFactor(1954)).toBe(1); expect(ageFactor(1999)).toBe(1);
    expect(ageFactor(1939)).toBe(0.845); expect(ageFactor(1936)).toBe(0.83); expect(ageFactor(1926)).toBe(0.76);
    const legs = [score(600, T0 + 640)];
    expect(scoreStage(legs, 1939, DEFAULT_RULES, { observationMissed: false }).score).toBe(33.8); // 40 s x 0.845
    expect(scoreStage([score(600, T0 + 633)], 1936, DEFAULT_RULES, { observationMissed: false }).score).toBe(27.39); // rounded to 0.01 s (V.C.2.e)
  });

  const stageOf = (stage: number, items: number[], year = 1939): { stage: number; score: StageScore } => ({ stage, score: { legs: items.map((p, i) => ({ index: i + 1, penalty: p } as LegScore)), penaltyItems: items, dnf: false, ageFactor: ageFactor(year) } as StageScore });
  it('REG-003 championship scoring pools stages 1-7, discards the worst legs per division (3/4/5/6/5), keeps stages 8-9 whole and leaves stage scores undiscarded', () => {
    expect(DIVISION_DISCARDS).toEqual({ grand: 3, expert: 4, sportsman: 5, rookie: 6, xcup: 5 });
    const stages = [
      stageOf(0, [500, 500]), // Trophy Run never counts
      stageOf(1, [10, 90, 5]), stageOf(2, [20, 0, 8, 100]), stageOf(3, [60, 4, 2]), stageOf(4, [1, 3, 120]), stageOf(8, [30, 40]), stageOf(9, [7, 9]),
    ];
    const pool = [10, 90, 5, 20, 0, 8, 100, 60, 4, 2, 1, 3, 120].sort((a, b) => b - a); // stages 1-4 only
    const rookie = championshipTotal(stages, 'rookie');
    expect(rookie.discarded).toEqual(pool.slice(0, 6)); expect(rookie.discardCount).toBe(6);
    expect(rookie.raw).toBe(pool.reduce((a, b) => a + b, 0) + 70 + 16);
    expect(rookie.afterDiscards).toBe(pool.slice(6).reduce((a, b) => a + b, 0) + 70 + 16);
    expect(rookie.ageFactored).toBe(Math.round(rookie.afterDiscards * 0.845 * 100) / 100);
    expect(rookie.stagesCounted).not.toContain(0);
    expect(championshipTotal(stages, 'grand').afterDiscards).toBe(pool.slice(3).reduce((a, b) => a + b, 0) + 86);
    expect(championshipTotal(stages, 'expert').discarded.length).toBe(4); expect(championshipTotal(stages, 'sportsman').discarded.length).toBe(5); expect(championshipTotal(stages, 'xcup').discarded.length).toBe(5);
    // stages 8-9 are never discarded even when they hold the worst legs
    const late = [stageOf(1, [1, 2]), stageOf(8, [500])];
    expect(championshipTotal(late, 'rookie').afterDiscards).toBe(500);
    // a DNF in the Championship Run removes eligibility but stays in the total
    const dnf = { stage: 9, score: { ...stageOf(9, [50]).score, dnf: true } };
    expect(championshipTotal([dnf], 'rookie').championshipEligible).toBe(false);
  });
  it('REG-003 a V.E.3 penalty is one of the discardable legs and stage totals carry the raw / after-discards / age-factored split', () => {
    const legs = [score(600, T0 + 605)];
    const st = scoreStage(legs, 1939, DEFAULT_RULES, { observationMissed: true, earlyDepartureMinutes: [7] });
    expect(st.penaltyItems).toEqual([5, 180, 60]);
    const total = championshipTotal([{ stage: 1, score: st }], 'rookie');
    expect(total.raw).toBe(245); expect(total.afterDiscards).toBe(0); expect(total.ageFactored).toBe(0);
  });

  it('REG-004 ties: lower score, then the older Scoring Year, then the better Trophy Run position; Stage 0 is not in the cumulative score', () => {
    expect(TIE_BREAK_ORDER[1]).toMatch(/older/);
    const a = { name: 'a', total: 12.5, scoringYear: 1939, trophyRunPosition: 9 }, b = { name: 'b', total: 12.5, scoringYear: 1936, trophyRunPosition: 20 }, c = { name: 'c', total: 12.5, scoringYear: 1936, trophyRunPosition: 4 }, d = { name: 'd', total: 11, scoringYear: 1954 };
    expect(rankStandings([a, b, c, d]).map(x => x.name)).toEqual(['d', 'c', 'b', 'a']);
    expect(compareStandings(a, a)).toBe(0);
    expect(compareStandings({ ...a, trophyRunPosition: undefined }, { ...a, trophyRunPosition: 3 })).toBeGreaterThan(0);
    expect(DEFAULT_RULES.trophyRunCounts).toBe(false);
    expect(championshipTotal([stageOf(0, [99]), stageOf(1, [3])], 'rookie').raw).toBe(3);
  });

  it('REG-005 stopping or slowing to 5 mph or less within sight of a Timing Checkpoint costs 30 s; 6 mph does not', () => {
    const mk = () => new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.6).checkpoint('timing', 400).advanceFt(300).finish().build();
    const run = (mph: number) => { const sc = mk(); const sim = new Simulator(sc); startLikeOracle(sim); const cpS = sc.checkpoints[0]!.s; stepUntil(sim, () => sim.car.s >= cpS - 350); sim.act({ type: 'call.speed', mph }); runToEnd(sim); return sim.result().score.legs[0]!; };
    expect(run(3).extras.sightZone).toBe(DEFAULT_RULES.sightZonePenalty); expect(DEFAULT_RULES.sightZonePenalty).toBe(30);
    expect(run(8).extras.sightZone).toBe(0);
  });
  it('REG-005 failure to stop at a Stop Sign is DNF, so the driver always stops and a "skip the stop" go call is refused with the rule quoted', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); sim.step(30); sim.observe();
    sim.act({ type: 'call.go' });
    expect(sim.observe().driver.messages.some(m => /DNF \(V\.E\.3\.e\)/.test(m.text))).toBe(true); expect(sim.events.some(e => e.type === 'stopSkipRefused')).toBe(true);
    stepUntil(sim, () => sim.waitingForGo, 120); expect(sim.waitReason).toBe('stop'); expect(sim.car.v).toBe(0); // he stopped without any stop callout
  });
  it('REG-005 leaving a promoted lunch / pit / rest stop more than 5 minutes early costs 60 s the first time and 300 s the second; the observation stop missed costs 180 s', () => {
    const build = () => {
      const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4).checkpoint().advanceFt(900);
      b.endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 3600 } }).advanceMiles(0.6); b.promotedStop('meal', 2700).advanceMiles(0.3); b.promotedStop('rest', 1800).advanceMiles(0.3);
      return b.restart(35, T0 + 3600 + 300).advanceMiles(0.4).checkpoint().advanceFt(300).observationFinish().build();
    };
    const sc = build(); const sim = new Simulator(sc); startLikeOracle(sim);
    const mealN = sc.book.find(i => i.promotedStop?.kind === 'meal')!.n, restN = sc.book.find(i => i.promotedStop?.kind === 'rest')!.n;
    const bot = new OracleBot(sim); const goEarly = (n: number) => { stepUntil(sim, () => sim.waitingForGo && sim.observe().stoppedAtLine === n, 3000); sim.act({ type: 'call.go' }); };
    // drive with the oracle until the first promoted stop, then break its rule: leave at once
    while (sim.phase !== 'finished' && !(sim.waitingForGo && sim.observe().stoppedAtLine === mealN)) { bot.onTick(); sim.step(0.1); }
    sim.act({ type: 'call.go' });
    while (sim.phase !== 'finished' && !(sim.waitingForGo && sim.observe().stoppedAtLine === restN)) { bot.onTick(); sim.step(0.1); }
    sim.act({ type: 'call.go' }); void goEarly;
    while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
    const r = sim.result(); expect(r.earlyDepartureMinutes.length).toBe(2); expect(r.earlyDepartureMinutes.every(m => m > 5)).toBe(true);
    expect(r.score.earlyDepartures.map(e => e.penalty)).toEqual([60, 300]); expect(r.score.earlyDeparturePenalty).toBe(360);
    // the same stage left on schedule has no penalty
    const sim2 = new Simulator(sc); const r2 = runBot(sim2, new OracleBot(sim2)); expect(r2.score.earlyDeparturePenalty).toBe(0);
    // observation stop: crossing the finish without stopping
    const open = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).checkpoint().advanceFt(500).finish().build();
    const a = new Simulator(open); startLikeOracle(a); runToEnd(a); expect(a.result().score.observationPenalty).toBe(180);
  });
  it('REG-005 a late start has no penalty of its own: it simply makes the first leg late', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.step(30 + 20); sim.act({ type: 'start' }); runToEnd(sim); const r = sim.result();
    expect(r.secondsLateAtStart).toBeCloseTo(20, 1); expect(r.score.legs[0]!.error!).toBeGreaterThan(15); expect(r.score.legs[0]!.penalty).toBe(Math.abs(r.score.legs[0]!.error!)); expect(r.score.earlyDeparturePenalty).toBe(0);
  });

  it('REG-006 a pause adds its printed seconds regardless of the control (blinker, signal, stop sign); a railroad crossing prints none; the engine assumes no pause the book does not print', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(30).advanceMiles(1);
    b.instruction({ control: 'BLINKER', exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', pause: 15, speed: 30 }).advanceMiles(1);
    b.instruction({ control: 'RR', sightDistance: 600, label: 'RR crossing' }, {}).advanceMiles(1);
    b.instruction({ control: 'STOP', exits: EXITS.crossroads('S'), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'S' }).advanceMiles(1).checkpoint();
    const sc = b.build(); const g = buildGhost(sc);
    const at = (mi: number) => ghostTimeAt(g, milesToFt(mi)) - T0;
    expect(at(1) - 120 + 1 / 44).toBeCloseTo(15, 0); // 15 s printed at the blinker
    expect(at(2) - at(1) - 15 - 120 + 15).toBeCloseTo(0, 5); // the segment after it is plain 30 mph; the RR crossing adds nothing
    expect(at(3.5) - at(3)).toBeCloseTo(60, 3); // the STOP sign without a printed pause adds nothing to the ghost
    expect(sc.book.find(i => i.turn === 'S' && sc.course.nodes.find(n => n.id === i.nodeId)!.control === 'STOP')!.pause).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { allDrills, drillById } from '../src/core/drills/registry.js';
import { isUnlocked } from '../src/core/drills/index.js';
import { validateScenario, aidsForRung, LEGAL_AIDS } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { STOCK_1939_SPEEDO } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { headlineTip } from '../src/core/drills/rubrics.js';
import { dwellFor, buildPerfTable, matrixAt, stopLoss } from '../src/core/perf-table.js';
import { FORD_1939, PACKARD_1936, nodeById, instructionS } from '../src/core/course.js';
import { formatClock } from '../src/core/units.js';
import { formatInterval } from '../src/core/griid.js';
import { runOracle, patchAct, delayGoAtLine } from './drill-helpers.js';
import { d16Plan } from '../src/core/drills/d16.js';
import { committeeView, NAV_ERROR_QUOTE } from '../src/core/drills/d08b.js';
import { chartPairs, parseChartNotes } from '../src/core/drills/d06.js';
import { idealNotes, pageOf, ROWS_PER_PAGE } from '../src/core/drills/d15.js';
import { parseCalNotes, parseDuration, calibrationTruth } from '../src/core/drills/d07.js';
import { campaignAsp } from '../src/core/drills/staged.js';
import { departuresOf } from '../src/core/drills/departures.js';
import { instrumentFindingLines } from '../src/core/drills/rubrics.js';
import { recordCampaignStage, loadCampaign, campaignSummary, setCampaignDivision, TROPHY_RUN_SEED } from '../src/ui/viewmodels/campaign.js';
import { championshipTotal, compareStandings, rankStandings, DIVISION_DISCARDS, ageFactor } from '../src/core/scoring.js';

const driveDrills = () => allDrills().filter(d => d.kind === 'drive' && !['D12', 'D13'].includes(d.id));

describe('drill curriculum', () => {
  it('DRILL-001 every drill has id, title, objective, scenario factory, rubric, aids tiers and unlock rule', () => {
    const ds = allDrills(); expect(ds.length).toBeGreaterThanOrEqual(16);
    for (const d of ds) { expect(d.id).toMatch(/^D\d\d/); expect(d.title.length).toBeGreaterThan(3); expect(d.objective.length).toBeGreaterThan(10); expect(typeof d.scenario).toBe('function'); expect(typeof d.rubric).toBe('function'); expect(d.tiers.length).toBeGreaterThanOrEqual(1); expect(Array.isArray(d.unlock)).toBe(true); expect(d.skills.length).toBeGreaterThan(0); }
  });
  it('DRILL-002 pause drill rubric stars: 3 if mean |error| <= 1, 2 if <= 3, 1 if <= 6', () => {
    const d = drillById('D03')!; const sc = d.scenario(1, 0);
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const rb = d.rubric(r, sc); expect(rb.stars).toBeGreaterThanOrEqual(2);
    const simR = new Simulator(sc); const rr = runBot(simR, new OracleBot(simR, { ignoreLosses: true })); const rbR = d.rubric(rr, sc); expect(rbR.stars).toBeLessThanOrEqual(1);
    // synthetic thresholds
    const fake = (mean: number) => ({ ...r, score: { ...r.score, legs: r.score.legs.map(l => ({ ...l, error: mean, penalty: Math.abs(mean) })) }, offCourseCount: 0 });
    expect(d.rubric(fake(1), sc).stars).toBe(3); expect(d.rubric(fake(3), sc).stars).toBe(2); expect(d.rubric(fake(6), sc).stars).toBe(1); expect(d.rubric(fake(7), sc).stars).toBe(0);
  });
  it('DRILL-003 trap quiz drill exists as a static quiz kind', () => { const d = drillById('D09')!; expect(d.kind).toBe('quiz'); expect(d.unlock).toEqual([]); });
  it('DRILL-004 unlock rules: D09/D14 open; D18 needs D03,D04,D05,D08,D10 at 2 stars; D11 needs D18 + D07; D12 needs D11, D15, D16; D13 needs D12', () => {
    const none: Record<string, number> = {};
    expect(isUnlocked(drillById('D09')!, none)).toBe(true); expect(isUnlocked(drillById('D14')!, none)).toBe(true); expect(isUnlocked(drillById('D18')!, none)).toBe(false);
    const some = { D03: 2, D04: 2, D05: 2, D08: 2, D10: 2 }; expect(isUnlocked(drillById('D18')!, some)).toBe(true); expect(isUnlocked(drillById('D11')!, some)).toBe(false);
    expect(isUnlocked(drillById('D11')!, { ...some, D18: 1, D07: 2 })).toBe(true);
    expect(isUnlocked(drillById('D12')!, { D11: 1 })).toBe(false); expect(isUnlocked(drillById('D12')!, { D11: 1, D15: 1, D16: 1 })).toBe(true);
    expect(isUnlocked(drillById('D13')!, { D12: 1 })).toBe(true);
  });
  it('DRILL-005 aids defaults: rung 3 for D01-D05 Bronze, rung 2 for D18/D11 Bronze (coarse pace, the cliff fix), rung 0 for D12+; legal mode has no aids', () => {
    for (const id of ['D01', 'D03', 'D04', 'D05']) expect(drillById(id)!.tiers[0]!.aids.rung).toBe(3);
    expect(drillById('D18')!.tiers[0]!.aids.rung).toBe(2); expect(drillById('D11')!.tiers[0]!.aids.rung).toBe(2); expect(drillById('D11')!.tiers[1]!.aids.rung).toBe(1); expect(drillById('D11')!.tiers[2]!.aids.rung).toBe(0);
    for (const id of ['D12', 'D13']) for (const t of drillById(id)!.tiers) expect(t.aids.rung).toBe(0);
    const legal = aidsForRung(0); expect(legal).toEqual(LEGAL_AIDS); expect(legal.paceBar).toBe(false); expect(legal.countdown).toBe(false); expect(legal.cumulativeTimes).toBe(false); expect(legal.showSpeedo).toBe('marks');
  });
  it('DRILL-006 D18 combo has exactly one of each element and ~4-8 minutes of ghost time', () => {
    for (const seed of [1, 2, 3]) {
      const sc = drillById('D18')!.scenario(seed, 0);
      const stops = sc.book.filter(i => i.pause).length, timed = sc.book.filter(i => i.timed).length, signs = sc.book.filter(i => !i.pause && !i.timed && !i.turn && i.speed !== undefined && i.section !== 'start').length;
      expect(stops).toBe(1); expect(timed).toBe(1); expect(signs).toBe(1); expect(sc.checkpoints.filter(c => c.kind === 'timing').length).toBe(1); expect(sc.hazards.length).toBe(1);
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); expect(r.ghostEndTod - sc.startTime).toBeGreaterThan(3 * 60); expect(r.ghostEndTod - sc.startTime).toBeLessThan(9 * 60);
    }
    expect(drillById('D11')!.unlock.some(u => u.drill === 'D18')).toBe(true);
  });
  it('DRILL-007 aids ladder rungs are distinct and every drive drill is playable at every tier', () => {
    const r3 = aidsForRung(3), r2 = aidsForRung(2), r1 = aidsForRung(1), r0 = aidsForRung(0);
    expect(r3.paceBar && r3.countdown && r3.cumulativeTimes && r3.cpCard).toBe(true);
    expect(r2.paceBar && r2.countdown && !r2.cumulativeTimes && r2.cpCard && r2.checkOff).toBe(true);
    expect(!r1.paceBar && !r1.countdown && r1.checkOff && !r1.cpCard).toBe(true);
    expect(!r0.paceBar && !r0.checkOff && r0.showSpeedo === 'marks').toBe(true);
    for (const d of driveDrills()) for (let t = 0; t < d.tiers.length; t++) { const sc = d.scenario(2, t); expect(validateScenario(sc), `${d.id} tier ${t}`).toEqual([]); }
  });
  it('DRILL-009 every drive drill scenario validates for seeds 1..10 and the oracle finishes it quickly', () => {
    for (const d of driveDrills()) {
      for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, 0); expect(validateScenario(sc), `${d.id} seed ${seed}`).toEqual([]); }
      const sc = d.scenario(1, 0); const t0 = Date.now(); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); expect(sim.phase).toBe('finished'); expect(Date.now() - t0, d.id).toBeLessThan(4000); expect(r.offCourseCount, d.id).toBe(0);
    }
  });
  it('DRILL-010 three tiers per drive drill with increasing difficulty; D03 Gold uses a different hidden car behaviour', () => {
    for (const d of driveDrills()) { expect(d.tiers.length).toBe(3); expect(d.tiers.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold']); expect(d.tiers[0]!.aids.rung).toBeGreaterThanOrEqual(d.tiers[2]!.aids.rung); }
    const d03 = drillById('D03')!; expect(d03.scenario(1, 2).trafficWaitProbability).toBeGreaterThan(0); expect(d03.scenario(1, 0).trafficWaitProbability).toBe(0);
  });
  it('DRILL-011 D04 includes >= 2 short changes (T < 20 s) and >= 2 compound STOP+timed lines', () => {
    const sc = drillById('D04')!.scenario(4, 0);
    expect(sc.book.filter(i => i.timed && i.timed.seconds < 20).length).toBeGreaterThanOrEqual(2);
    expect(sc.book.filter(i => i.timed && i.pause).length).toBeGreaterThanOrEqual(2);
  });
  it('DRILL-014 D17 forces a watch reset mid-leg and the rubric scores the residual', () => {
    const d = drillById('D17')!; const sc = d.scenario(1, 0); expect(sc.tags!.some(t => t.startsWith('forceWatchReset:'))).toBe(true);
    const sim = new Simulator(sc); sim.act({ type: 'watch.start' }); const r = runBot(sim, new OracleBot(sim));
    expect(r.events.some(e => e.type === 'watchLost')).toBe(true); expect(d.rubric(r, sc).stars).toBeGreaterThanOrEqual(1);
  });
  it('headline tips name the largest bucket', () => {
    const d = drillById('D03')!; const sc = d.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
    expect(headlineTip(r)).toMatch(/stops|Go earlier/);
  });
});

// ---------- V2 drills (DRILL-021..026, CAMP-001) ----------

describe('DRILL-021 D16 time-of-day discipline with ASP, exact transit, lunch and rollovers (supersedes DRILL-013: a wrong-minute departure is 0 stars)', () => {
  const d = drillById('D16')!;
  it('DRILL-021 a drawn ASP (1-120) is on the scenario, the start is base + ASP, and the book has one exact in-leg transit, one advisory transit with a lunch "leave 45m prior", and a restart at base + ASP', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sc = d.scenario(seed, 0);
      expect(sc.asp).toBeGreaterThanOrEqual(1); expect(sc.asp).toBeLessThanOrEqual(120); expect(sc.startTime).toBe(sc.baseStartTime! + sc.asp * 60);
      expect(sc.book[0]!.restartTime).toBe(sc.startTime); expect(sc.book[0]!.baseTime).toBe(sc.baseStartTime);
      const exact = sc.book.filter(i => i.transit && !i.transit.end && i.transit.exact); expect(exact.length).toBe(1); expect(exact[0]!.transit!.seconds).toBe(1200);
      expect(sc.book.filter(i => i.transit?.end && i.transit.exact).length).toBe(1);
      const adv = sc.book.filter(i => i.transit && !i.transit.end && !i.transit.exact); expect(adv.length).toBe(1);
      const lunch = sc.book.filter(i => i.promotedStop); expect(lunch.length).toBe(1); expect(lunch[0]!.promotedStop).toEqual({ kind: 'meal', leaveBeforeEndSeconds: 2700 });
      const restart = sc.book.filter(i => i.n > 1 && i.section === 'restart'); expect(restart.length).toBe(1);
      expect(restart[0]!.restartTime).toBe(restart[0]!.baseTime! + sc.asp * 60);
      expect(sc.book.indexOf(adv[0]!)).toBeLessThan(sc.book.indexOf(lunch[0]!)); expect(sc.book.indexOf(lunch[0]!)).toBeLessThan(sc.book.indexOf(restart[0]!));
      expect(sc.tags).toContain(`asp:${sc.asp}`);
    }
    expect(new Set([1, 2, 3, 4, 5, 6].map(sd => d.scenario(sd, 0).asp)).size).toBeGreaterThan(3);
  });
  it('DRILL-021 the schedule contains an hour rollover (exact-transit IN + 20m00s) and a minute rollover (the car waits for the restart minute to turn)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const p = d16Plan(seed); const hour = (t: number): number => Math.floor(t / 3600);
      expect(hour(p.outEst)).toBe(hour(p.inEst) + 1);                           // IN 9:4x/5x + 20m00s = 10:0x/1x
      expect(Math.floor(p.arriveRestartEst / 60)).toBeLessThan(p.restart / 60);   // arrives in the minute before, leaves when the minute rolls
      expect(p.restart - p.lunchDepart).toBe(2700);
    }
  });
  it('DRILL-021 the oracle that keeps the time of day on the clock leaves every start, OUT, lunch and restart within 1 s: 3 stars on 5 seeds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const sc = d.scenario(seed, 0); const { r } = runOracle(sc); const rb = d.rubric(r, sc);
      const deps = departuresOf(r, sc); expect(deps.map(x => x.kind)).toEqual(['start', 'transitOut', 'promoted', 'restart']);
      for (const x of deps) expect(x.err, `seed ${seed} ${x.kind}`).toBeLessThanOrEqual(1);
      expect(rb.stars, `seed ${seed}: ${rb.headline}`).toBe(3);
      expect(r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'))).toEqual([]);
    }
  });
  it('DRILL-021 oracle 3 stars, naive 0: the shipped oracle (clock glance every 20 s inside the last 2 minutes before a start, IN, OUT, lunch or restart) earns 3 stars with no clock finding, while the wrongMinute bot (a minute late at the first restart) earns 0', () => {
    for (let seed = 1; seed <= 3; seed++) for (const t of [0, 1, 2]) {
      const sc = d.scenario(seed, t);
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); const rb = d.rubric(r, sc);
      expect(rb.stars, `oracle seed ${seed} tier ${t}: ${rb.headline}`).toBe(3); expect(r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'))).toEqual([]);
      expect(r.actions.some(a => a.action.type === 'clock.read')).toBe(true);                       // the glances come from the bot itself, not a test helper
      const sim2 = new Simulator(sc); const bot2 = new OracleBot(sim2, { useWatch: true, wrongMinute: true }); expect(bot2.name).toBe('wrongMinute');
      const naive = runBot(sim2, bot2); const nb = d.rubric(naive, sc);
      expect(nb.stars, `naive seed ${seed} tier ${t}: ${nb.headline}`).toBe(0); expect(nb.feedback.join(' ')).toMatch(/Wrong time: the restart/);
      const dep = departuresOf(naive, sc).find(x => x.kind === 'restart')!; expect(dep.err).toBeGreaterThan(50); expect(dep.err).toBeLessThan(70);
    }
  });
  it('DRILL-021 the glances stop when the navigator does not look: noClockReads leaves a clock finding and caps D16 at 2 stars', () => {
    const sc = d.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true, noClockReads: true }));
    expect(r.actions.some(a => a.action.type === 'clock.read')).toBe(false); expect(r.instrumentDiscipline.some(f => f.kind === 'clockForTimeOfDay')).toBe(true); expect(d.rubric(r, sc).stars).toBe(2);
  });
  it('DRILL-021 the OUT of the exact transit is IN + 20m00s to the second and leaving it a wrong minute late is 0 stars; WATCH-009 clock findings cap a perfect run at 2', () => {
    const sc = d.scenario(1, 0); const out = sc.book.find(i => i.transit?.end && i.transit.exact)!;
    const clean = runOracle(sc); const dep = departuresOf(clean.r, sc).find(x => x.kind === 'transitOut')!;
    const inTod = Number(clean.r.events.find(e => e.type === 'transit.in')!.detail!.tod); expect(dep.target).toBe(inTod + 1200); expect(formatClock(dep.target)).toMatch(/^\d\d:\d\d:\d\d$/);
    // a minute late at the OUT
    const sim = new Simulator(sc); const step = delayGoAtLine(sim, out.n, 60); const late = runOracle(sc, { useWatch: true }, { sim, hook: s => step(s) });
    expect(d.rubric(late.r, sc).stars).toBe(0); expect(d.rubric(late.r, sc).feedback.join(' ')).toMatch(/Wrong time/);
    // 8 s late at the restart: within 10 s = 1 star
    const rl = sc.book.find(i => i.n > 1 && i.section === 'restart')!; const sim2 = new Simulator(sc); const step2 = delayGoAtLine(sim2, rl.n, 8);
    const slow = runOracle(sc, { useWatch: true }, { sim: sim2, hook: s => step2(s) }); expect(d.rubric(slow.r, sc).stars).toBe(1);
    // the start a whole minute late
    const lateStart = new Simulator(sc); lateStart.step(sc.prereadSeconds + 60); lateStart.act({ type: 'start' }); const ls = runOracle(sc, { useWatch: true }, { sim: lateStart }); expect(d.rubric(ls.r, sc).stars).toBe(0);
    // no clock reads: the exact-transit IN/OUT and the restart come off a running chrono -> clock findings, at most 2 stars
    const noClock = runOracle(sc, { useWatch: true }, { clock: false }); expect(noClock.r.instrumentDiscipline.some(f => f.kind === 'clockForTimeOfDay')).toBe(true);
    expect(d.rubric(noClock.r, sc).stars).toBe(2); expect(d.rubric(noClock.r, sc).feedback.join(' ')).toMatch(/WATCH-009/);
  });
});

describe('DRILL-022 D08b Time Allowance at the printed TA point (supersedes DRILL-008)', () => {
  const d = drillById('D08b')!;
  it('DRILL-022 the book prints End timed portion and an end-of-stage TA point; a train (60-120 s) and a signal share leg 1, a farm tractor is leg 2, a driveway and crossroad are leg 3', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const sc = d.scenario(seed, 0);
      expect(sc.book.some(i => i.endTimed)).toBe(true); expect(sc.book.find(i => i.taPoint)!.taPoint).toMatchObject({ endOfStage: true, windowSeconds: 900 });
      const cps = sc.checkpoints.filter(c => c.kind === 'timing'); expect(cps.length).toBe(3);
      const train = sc.hazards.find(h => h.kind === 'train')!; const sig = sc.hazards.find(h => h.kind === 'signal')!; const slow = sc.hazards.find(h => h.kind === 'slow')!;
      expect(train.kind === 'train' && train.durationSeconds >= 60 && train.durationSeconds <= 120).toBe(true);
      expect(sig.s).toBeLessThan(cps[0]!.s); expect(train.s).toBeLessThan(cps[0]!.s); expect(slow.s).toBeGreaterThan(cps[0]!.s); expect(slow.s).toBeLessThan(cps[1]!.s);
      expect(sc.tags).toContain('ta:navLeg:3');
    }
  });
  it('DRILL-022 the oracle files the right leg at the TA point and acknowledges the scorecard: 3 stars on 5 seeds; the rookie bot (never files) and the noPause bot (banked its pauses) earn fewer', () => {
    let oracle = 0, nopause = 0, rookie = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const sc = d.scenario(seed, 0);
      const o = runOracle(sc); const rb = d.rubric(o.r, sc); expect(rb.stars, `seed ${seed}: ${rb.headline}`).toBe(3); oracle += rb.stars;
      expect(o.r.ta.scorecardAcked).toBe(true); expect(o.r.ta.requests.every(q => q.status === 'filed' && q.adjusted % 10 === 0)).toBe(true);
      const view = committeeView(o.r, sc); expect(view[0]!.measured).toBeGreaterThan(15); expect(view[1]!.measured).toBe(0);   // the train qualifies (V.H.1) but the red light does not by default (rules.taForSignals false), and a tractor never does (TA-004)
      const np = runOracle(sc, { forgetPauses: true }); nopause += d.rubric(np.r, sc).stars;
      const rk = runOracle(sc, { ignoreLosses: true }); rookie += d.rubric(rk.r, sc).stars; expect(rk.r.ta.requests.length).toBe(0);
    }
    expect(oracle).toBe(15); expect(nopause).toBeLessThan(oracle); expect(rookie).toBeLessThan(oracle); expect(rookie).toBe(0);
  });
  it('DRILL-022 stars: a request within 30 s of the committee credit is 2 stars, farther off is 1, a missing scorecard acknowledgement caps 3 at 2', () => {
    const sc = d.scenario(1, 0);
    const bump = (by: number) => { const sim = new Simulator(sc); patchAct(sim, a => a.type === 'ta.request' ? { ...a, seconds: a.seconds + by } : undefined); return runOracle(sc, { useWatch: true }, { sim }); };
    expect(d.rubric(bump(20).r, sc).stars).toBe(2); expect(d.rubric(bump(60).r, sc).stars).toBe(1);
    const sim = new Simulator(sc); patchAct(sim, a => a.type === 'scorecard.ack' ? null : undefined);
    const noAck = runOracle(sc, { useWatch: true }, { sim }); expect(noAck.r.ta.scorecardAcked).toBe(false); expect(d.rubric(noAck.r, sc).stars).toBe(2); expect(d.rubric(noAck.r, sc).feedback.join(' ')).toMatch(/acknowledge your scorecard|acknowledge the scorecard/);
  });
  it('DRILL-022 a request for the leg that was a wrong turn scores 0 with REG V.H.1 quoted', () => {
    const sc = d.scenario(1, 0); const x = sc.course.nodes.filter(n => n.exits && n.exits.length === 3).slice(-1)[0]!;
    let wrong = false, filed = false;
    const { r } = runOracle(sc, { useWatch: true }, { hook: sim => {
      if (!wrong && sim.car.s > x.s - 80 && sim.car.s < x.s) { sim.act({ type: 'call.turn', dir: 'L' }); wrong = true; }   // the route turns right
      if (sim.waitReason === 'roadEnd') sim.act({ type: 'call.uturn' });
      const st = sim.taState(); if (st.windowOpen && !filed && st.eligibleLegs.includes(3)) { filed = true; sim.act({ type: 'ta.request', legIndex: 3, seconds: 120, fromLine: 8, toLine: 9, note: 'wrong turn' }); }
    } });
    expect(r.offCourseCount).toBeGreaterThanOrEqual(1); expect(r.attribution[2]!.buckets.offCourse).toBeGreaterThan(60);
    const rb = d.rubric(r, sc); expect(rb.stars).toBe(0); expect(rb.feedback.join(' ')).toContain('V.H.1'); expect(NAV_ERROR_QUOTE).toMatch(/beyond your control/);
  });
});

describe('DRILL-023 D06 Build your charts', () => {
  const d = drillById('D06')!;
  it('DRILL-023 three sections of three IN/OUT pairs (stop & go, accel/decel, turns), the first accel pair from a standstill', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const pairs = chartPairs(d.scenario(seed, 0).tags); expect(pairs.length).toBe(10);
      for (const k of ['stopGo', 'accel', 'turn'] as const) expect(pairs.filter(p => p.kind === k).length).toBe(3);
      expect(pairs.filter(p => p.kind === 'stopMid').length).toBe(1);   // CHART-006: the stop-in-the-middle run
      expect(pairs.find(p => p.kind === 'accel')!.vIn).toBe(0);
    }
  });
  it('DRILL-023 notes like "stopgo 30>40 = 8.4", "turn 40>35 = 4.0", "accel 0>40 = 4.5" are parsed and compared with buildPerfTable(sc.car) within 1 s', () => {
    const m = parseChartNotes(['stopgo 30>40 = 8.4', 'turn 40>35 = 4.0', 'accel 0>40 = 4.5', 'decel 40>30: 1.2', 'stop & go 25 -> 35 = 10.1']);
    expect(m.get('stopGo:30>40')).toBe(8.4); expect(m.get('turn:40>35')).toBe(4); expect(m.get('accel:0>40')).toBe(4.5); expect(m.get('accel:40>30')).toBe(1.2); expect(m.get('stopGo:25>35')).toBe(10.1);
    for (const tier of [0, 1, 2]) {
      const sc = d.scenario(2, tier); const perf = buildPerfTable(sc.car); const pairs = chartPairs(sc.tags);
      const note = (p: typeof pairs[number], off: number): string => `${p.kind === 'stopGo' ? 'stopgo' : p.kind} ${p.vIn}>${p.vOut} = ${((p.kind === 'stopMid' ? Math.round(stopLoss(p.vIn, p.vOut, sc.car) * 10) / 10 : matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut)) + off).toFixed(1)}`;
      const run = (n: number, off: number) => { const sim = new Simulator(sc); pairs.slice(0, n).forEach(p => sim.act({ type: 'note', text: note(p, off) })); return d.rubric(runBot(sim, new OracleBot(sim)), sc); };
      expect(run(10, 0.7).stars, `tier ${tier}`).toBe(3);   // within 1 s
      expect(run(10, 1.6).stars).toBe(0);                  // 1.6 s off everywhere
      expect(run(7, 0).stars).toBe(2); expect(run(4, 0).stars).toBe(1); expect(run(2, 0).stars).toBe(0);
    }
  });
  it('DRILL-023 CHART-002: Bronze hands the Packard charts and drives the Packard (also D03 Bronze); Silver and Gold drive the hidden Ford', () => {
    for (const id of ['D06', 'D03']) { expect(drillById(id)!.scenario(1, 0).car).toBe(PACKARD_1936); }
    expect(drillById('D06')!.scenario(1, 1).car.a0).not.toBe(FORD_1939.a0); expect(drillById('D06')!.scenario(1, 2).car.name).toMatch(/Ford/);
    expect(drillById('D03')!.scenario(1, 1).car.a0).toBe(FORD_1939.a0);
    const t = buildPerfTable(PACKARD_1936); expect(t.accel.rows[0]![40]).toBe(4.5); expect(t.stopGo.rows[30]![40]).toBe(8.6); expect(t.turns.rows[40]![35]).toBe(4);
    // the Packard Bronze run: copying the printed charts earns the stars
    const sc = drillById('D06')!.scenario(1, 0); expect(sc.tags).toContain('charts:packard');
  });
});

describe('DRILL-024 D15 pre-read triage grades the six notations of LESSON-003 (supersedes DRILL-012)', () => {
  const d = drillById('D15')!;
  const annotateAll = (sim: Simulator, notes: { n: number; text: string }[]): void => { for (const a of notes) sim.act({ type: 'line.annotate', n: a.n, text: a.text }); };
  /** Run the cold run with `notes` written before the start and the OUT time written at the end-of-transit line once the IN time is known. */
  const run = (sc: ReturnType<typeof d.scenario>, notes: { n: number; text: string }[], transit = true) => {
    const sim = new Simulator(sc); annotateAll(sim, notes); let done = !transit;
    const begin = sc.book.find(i => i.transit && !i.transit.end && i.transit.exact)!; const end = sc.book.find(i => i.transit?.end && i.transit.exact)!;
    return runOracle(sc, { useWatch: true }, { sim, hook: s => { if (!done && s.transitIn[begin.n] !== undefined) { s.act({ type: 'line.annotate', n: end.n, text: `OUT ${formatClock(s.transitIn[begin.n]! + begin.transit!.seconds)}` }); done = true; } } });
  };
  it('DRILL-024 the book spans >= 3 pages of 6 rows with 40+ lines: "comes quick" at a page top, a speed change at a page bottom, >= 8 printed pauses, a restart at base + ASP and an exact transit', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const sc = d.scenario(seed, 0); expect(validateScenario(sc)).toEqual([]);
      expect(sc.book.length).toBeGreaterThanOrEqual(40); expect(pageOf(sc.book.length)).toBeGreaterThanOrEqual(3); expect(ROWS_PER_PAGE).toBe(6);
      const quick = sc.book.filter(i => /comes quick/i.test(i.remark ?? '')); expect(quick.length).toBeGreaterThanOrEqual(1); expect(quick.every(i => (i.n - 1) % 6 === 0)).toBe(true);
      expect(sc.book.some(i => i.n % 6 === 0 && i.speed !== undefined && i.n > 1)).toBe(true);
      expect(sc.book.filter(i => i.pause).length).toBeGreaterThanOrEqual(8);
      const rs = sc.book.find(i => i.n > 1 && i.section === 'restart')!; expect(rs.restartTime).toBe(rs.baseTime! + sc.asp * 60);
      expect(sc.book.filter(i => i.transit?.exact && !i.transit.end).length).toBe(1);
      for (const i of sc.book) if (i.n > 1 && (i.n - 1) % 6 === 0) expect(i.speed, `page-top line ${i.n} prints no speed`).toBeUndefined();
    }
  });
  it('DRILL-024 all six notations at >= 90 % and a clean cold run is 3 stars; no marks is 0 stars; a missing restart time or OUT time zeroes that notation', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const sc = d.scenario(seed, 0); const full = run(sc, idealNotes(sc)); const rb = d.rubric(full.r, sc);
      expect(rb.stars, `seed ${seed}: ${rb.headline}`).toBe(3); expect(full.r.offCourseCount).toBe(0); expect(rb.headline).toMatch(/pause time next to each pause \d+\/\d+/);
      const naive = runOracle(sc, { useWatch: true }); expect(d.rubric(naive.r, sc).stars).toBe(0);
    }
    const sc = d.scenario(1, 0); const notes = idealNotes(sc);
    const noRestart = run(sc, notes.map(a => ({ ...a, text: a.text.replace(/restart [\d:]+/, 'restart') }))); expect(d.rubric(noRestart.r, sc).stars).toBe(0); expect(d.rubric(noRestart.r, sc).feedback.join(' ')).toMatch(/base .* \+ ASP/);
    const baseOnly = run(sc, notes.map(a => ({ ...a, text: a.text.replace(/restart [\d:]+/, `restart ${formatClock(sc.baseStartTime!)}`) }))); expect(d.rubric(baseOnly.r, sc).stars).toBe(0);
    const noOut = run(sc, notes, false); expect(d.rubric(noOut.r, sc).stars).toBe(0); expect(d.rubric(noOut.r, sc).feedback.join(' ')).toMatch(/exact transit/);
  });
  it('DRILL-024 stars by the worst notation: >= 90 % is 3, >= 70 % is 2, >= 50 % is 1, below is 0 (speeds-not-shown, "comes quick", pause time and page-top carry)', () => {
    const sc = d.scenario(2, 0); const notes = idealNotes(sc); const pure = notes.filter(a => /^\d+ mph$/.test(a.text) && (a.n - 1) % 6 !== 0);
    const without = (drop: Set<number>) => run(sc, notes.filter(a => !drop.has(a.n)));
    expect(pure.length).toBeGreaterThan(14);
    expect(d.rubric(without(new Set(pure.slice(0, 2).map(a => a.n))).r, sc).stars).toBe(3);     // 33/35 = 94 %
    expect(d.rubric(without(new Set(pure.slice(0, 7).map(a => a.n))).r, sc).stars).toBe(2);     // 80 %
    expect(d.rubric(without(new Set(pure.slice(0, 13).map(a => a.n))).r, sc).stars).toBe(1);    // 63 %
    expect(d.rubric(run(sc, notes.map(a => ({ ...a, text: a.text.replace(/\d+ mph;? ?/, '') }))).r, sc).stars).toBe(0);   // no speeds written at all
    // dropping the "comes quick" flag on the previous page's last line zeroes that notation; so does a pause time more than 1 s off
    const q = sc.book.find(i => /comes quick/i.test(i.remark ?? ''))!; const noQuick = run(sc, notes.filter(a => a.n !== q.n - 1)); expect(d.rubric(noQuick.r, sc).stars).toBeLessThanOrEqual(1); expect(d.rubric(noQuick.r, sc).feedback.join(' ')).toMatch(/Comes quick/);
    const off = run(sc, notes.map(a => ({ ...a, text: a.text.replace(/pause ([\d.]+) s/, (_, x) => `pause ${(Number(x) + 2).toFixed(1)} s`) }))); expect(d.rubric(off.r, sc).stars).toBe(0);
    const near = run(sc, notes.map(a => ({ ...a, text: a.text.replace(/pause ([\d.]+) s/, (_, x) => `pause ${(Number(x) + 0.9).toFixed(1)} s`) }))); expect(d.rubric(near.r, sc).stars).toBe(3);
  });
});

describe('DRILL-025 D18/D11/D12/D13 use the STAGE-001 skeleton and print pauses only where Column C says so', () => {
  it('DRILL-025 D18 is one timed portion: start at base + ASP, End timed portion, no TA point, no restart; race-style book at rung <= 1, example style above', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const sc = drillById('D18')!.scenario(seed, 0);
      expect(sc.asp).toBeGreaterThanOrEqual(1); expect(sc.startTime).toBe(sc.baseStartTime! + sc.asp * 60); expect(sc.book[0]!.restartTime).toBe(sc.startTime);
      expect(sc.book.filter(i => i.endTimed).length).toBe(1); expect(sc.book.some(i => i.taPoint)).toBe(false); expect(sc.book.filter(i => i.section === 'restart' && i.n > 1).length).toBe(0);
      expect(sc.checkpoints.filter(c => c.kind === 'timing').length).toBe(1);
    }
    expect(drillById('D18')!.scenario(1, 0).bookStyle).toBe('example'); expect(drillById('D18')!.scenario(1, 1).bookStyle).toBe('race'); expect(drillById('D18')!.scenario(1, 2).bookStyle).toBe('race');
  });
  it('DRILL-025 D11 is one timed portion: an advisory transit in, the restart at base + ASP, one checkpoint, End timed portion and its TA point (and the oracle finishes it on course)', () => {
    for (let seed = 1; seed <= 4; seed++) {
      for (const tier of [0, 1, 2]) {
        const d = drillById('D11')!; const sc = d.scenario(seed, tier); expect(validateScenario(sc)).toEqual([]);
        const tin = sc.book.filter(i => i.transit && !i.transit.end && !i.transit.exact && i.section !== 'start'); expect(tin.length).toBeGreaterThanOrEqual(1);
        const rs = sc.book.filter(i => i.n > 1 && i.section === 'restart'); expect(rs.length).toBe(1); expect(rs[0]!.restartTime).toBe(rs[0]!.baseTime! + sc.asp * 60); expect(sc.asp).toBeGreaterThanOrEqual(1);
        expect(sc.book.filter(i => i.endTimed).length).toBe(1); expect(sc.book.filter(i => i.taPoint).length).toBe(1); expect(sc.checkpoints.filter(c => c.kind === 'timing').length).toBe(1);
        expect(sc.bookStyle).toBe(sc.aids.rung <= 1 ? 'race' : 'example'); expect(tin[0]!.transit!.seconds).toBeGreaterThan(0);
      }
    }
    const d = drillById('D11')!; const sc = d.scenario(1, 0); const o = runOracle(sc); expect(o.sim.phase).toBe('finished'); expect(o.r.offCourseCount).toBe(0); expect(o.r.ta.scorecardAcked === null || o.r.ta.scorecardAcked === true).toBe(true);
  });
  it('DRILL-025 D12 and D13 use the generator\'s day skeleton, draw an ASP per stage, and print pauses only on about 85 % of STOPs', () => {
    let stops = 0, printed = 0;
    for (const seed of [1, 2, 3]) {
      const sc = drillById('D12')!.scenario(seed, 0); expect(sc.tags).toContain('stage:day'); expect(sc.asp).toBeGreaterThanOrEqual(1); expect(sc.asp).toBeLessThanOrEqual(120);
      expect(sc.book.some(i => i.section === 'warmup')).toBe(true); expect(sc.book.some(i => i.calibrationStart)).toBe(true); expect(sc.book.filter(i => i.taPoint).length).toBe(2); expect(sc.book.some(i => i.promotedStop)).toBe(true);
      expect(sc.book.filter(i => i.section === 'restart' && i.n > 1).length).toBeGreaterThanOrEqual(2); expect(sc.bookStyle).toBe('race'); expect(sc.aids.rung).toBe(0);
      for (const ins of sc.book) { if (nodeById(sc.course, ins.nodeId).control === 'STOP') { stops++; if (ins.pause) printed++; } }
    }
    expect(printed / stops).toBeGreaterThan(0.6); expect(printed / stops).toBeLessThan(1); expect(stops - printed).toBeGreaterThanOrEqual(1);
    for (const seed of [1, 2]) { const sc = drillById('D13')!.scenario(seed, 0); expect(sc.asp).toBe(campaignAsp(seed)); expect(sc.tags).toContain('stage:day'); }
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map(campaignAsp)).size).toBeGreaterThan(5);
  });
  it('DRILL-025 every V2 drill validates for seeds 1..10 and the oracle finishes it in < 4 s on course (DRILL-009)', () => {
    for (const id of ['D01', 'D06', 'D07', 'D08b', 'D11', 'D15', 'D16', 'D18']) {
      const d = drillById(id)!;
      for (let seed = 1; seed <= 10; seed++) for (const tier of [0, 2]) expect(validateScenario(d.scenario(seed, tier)), `${id} seed ${seed} tier ${tier}`).toEqual([]);
      const t0 = Date.now(); const { sim, r } = runOracle(d.scenario(1, 0)); expect(sim.phase).toBe('finished'); expect(Date.now() - t0, id).toBeLessThan(4000); expect(r.offCourseCount, id).toBe(0);
    }
  });
});

describe('DRILL-026 D01 and D07 on the digital stopwatch', () => {
  it('DRILL-026 D01 grades lap timing at the landmarks (jitter to 0.1 s) and a lap taken while the split is frozen costs a star (WATCH-009)', () => {
    const d = drillById('D01')!; const sc = d.scenario(1, 0); expect(sc.tags).toContain('watch:digital');
    const marks = sc.book.filter(i => i.n > 1 && i.n < sc.book.length).map(i => instructionS(sc.course, i));
    const lapRun = (jitter: (k: number) => number, doubleAt = -1) => {
      const sim = new Simulator(sc); let k = 0; const queue: { at: number; k: number }[] = [];
      const { r } = runOracle(sc, { latency: 0 }, { sim, clock: false, hook: s => {
        if (s.phase === 'running' && k === 0) s.act({ type: 'watch.start' });
        while (k < marks.length && s.car.s >= marks[k]!) { queue.push({ at: s.tod + jitter(k), k }); if (k === doubleAt) queue.push({ at: s.tod + jitter(k) + 1.5, k: -1 }); k++; }
        for (const q of queue.filter(x => x.at <= s.tod)) s.act({ type: 'watch.lap' }); for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.at <= s.tod) queue.splice(i, 1);
      } });
      return { r, rb: d.rubric(r, sc) };
    };
    const good = lapRun(() => 0.05); expect(good.rb.stars).toBe(3); expect(good.r.instrumentDiscipline.filter(f => f.kind === 'lapWhileFrozen')).toEqual([]);
    const jittery = lapRun(k => (k % 2 ? 1.2 : -0.4)); expect(jittery.rb.stars).toBe(1);
    const frozen = lapRun(() => 0.05, 3); expect(frozen.r.instrumentDiscipline.some(f => f.kind === 'lapWhileFrozen')).toBe(true); expect(frozen.rb.stars).toBe(2); expect(frozen.rb.feedback.join(' ')).toMatch(/frozen/);
    const none = runOracle(sc, { latency: 0 }, { clock: false }); expect(d.rubric(none.r, sc).stars).toBe(0);
  });
  it('DRILL-026 D07 requires a lap at every calibration point, grades "cal 3 = 5m32.0 / 7m21.3" read-offs within 0.3 s, then the factor k', () => {
    expect(parseDuration('5m32.0s')).toBeCloseTo(332, 5); expect(parseDuration('5:32.0')).toBeCloseTo(332, 5);
    expect(parseCalNotes(['cal 3 = 5m32.0 / 7m21.3']).get(3)).toEqual({ interval: 332, cumulative: 441.3 });
    const d = drillById('D07')!;
    const procedure = (t: number, opts: { skipLap?: number; misread?: number; badK?: boolean } = {}) => {
      const sc = d.scenario(2, t); const cal = sc.book.filter(i => i.section === 'calibration'); const pos = cal.map(i => instructionS(sc.course, i)); let idx = 0;
      const { r } = runOracle(sc, { latency: 0 }, { clock: false, hook: sim => {
        if (sim.phase === 'running' && idx < cal.length && sim.car.s >= pos[idx]!) {
          if (idx === 0) sim.act({ type: 'watch.start' });
          else if (idx !== opts.skipLap) {
            sim.act({ type: 'watch.lap' }); const lt = sim.observe({ peek: true }).stopwatch.lapTable!; const row = lt[lt.length - 1]!; const off = idx === opts.misread ? 1 : 0;
            sim.act({ type: 'note', text: `cal ${idx} = ${formatInterval(row.interval + off, true)} / ${formatInterval(row.cumulative + off, true)}` });
            if (idx === cal.length - 1) { const k = (opts.badK ? 1 : cal[idx]!.perfectCumulative! / row.cumulative); if (sc.speedo.kind === 'timewise') sim.act({ type: 'speedo.setFactor', k }); else sim.act({ type: 'card.set', card: { '50': 50 / k } }); }
          }
          idx++;
        }
      } });
      return { sc, r, rb: d.rubric(r, sc) };
    };
    for (const t of [0, 1]) { const x = procedure(t); expect(x.rb.stars, x.rb.headline).toBe(3); expect(x.r.instrumentDiscipline.some(f => f.kind === 'calibrationWithoutLap')).toBe(false); expect(x.rb.headline).toMatch(/read-offs 6\/6/); }
    const missed = procedure(0, { skipLap: 3 }); expect(missed.r.instrumentDiscipline.some(f => f.kind === 'calibrationWithoutLap')).toBe(true); expect(missed.rb.stars).toBeLessThanOrEqual(2);
    const misread = procedure(0, { misread: 2 }); expect(misread.rb.stars).toBeLessThanOrEqual(3); expect(misread.rb.feedback.join(' ')).toMatch(/off\)/);
    const wrongK = procedure(0, { badK: true }); expect(wrongK.rb.stars).toBeLessThanOrEqual(1);
    const truth = calibrationTruth(procedure(0).r, d.scenario(2, 0)); expect(truth.points.length).toBe(6); expect(truth.trueK).toBeGreaterThan(0.95);
    const none = runOracle(d.scenario(2, 0), { latency: 0 }, { clock: false }); expect(d.rubric(none.r, d.scenario(2, 0)).stars).toBe(0);
  });
});

describe('DRILL-002 headline tips and rubrics carry the handbook rule names and the WATCH-009 findings', () => {
  it('DRILL-002 tips name the 10 % rule, the split at the sign, the chart pause time, and list instrument findings when present (WATCH-009)', () => {
    const sc = drillById('D03')!.scenario(2, 1); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
    const mk = (bucket: string, v: number) => ({ ...r, offCourseCount: 0, instrumentDiscipline: [], score: { ...r.score, legs: r.score.legs.map(l => ({ ...l, error: 9, penalty: 9 })) }, attribution: [{ legIndex: 0, buckets: { stop: 0, cruise: 0, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, offCourse: 0, ta: 0, [bucket]: v } }] }) as unknown as typeof r;
    expect(headlineTip(mk('stop', 12), sc)).toMatch(/chart pause time/); expect(headlineTip(mk('speedChange', 8), sc)).toMatch(/split at the sign/); expect(headlineTip(mk('hazard', 14), sc)).toMatch(/10 % rule/);
    expect(headlineTip(mk('turn', 9), sc)).toMatch(/10 % rule/); expect(headlineTip(mk('offCourse', 70), sc)).toMatch(/never ask for a Time Allowance/);
    const f = { ...mk('stop', 12), instrumentDiscipline: [{ kind: 'lapWhileFrozen' as const, line: 4, text: 'x' }, { kind: 'clockForInterval' as const, line: 5, text: 'y' }, { kind: 'clockForInterval' as const, line: 6, text: 'z' }] };
    const tip = headlineTip(f, sc); expect(tip).toMatch(/WATCH-009/); expect(tip).toMatch(/2 x interval counted on the clock/); expect(tip.split(/(?<=\.)\s+(?=[A-Z])/).length).toBeLessThanOrEqual(2);
    const rb = drillById('D03')!.rubric(f, sc); expect(rb.feedback.join(' ')).toMatch(/lap taken while the split was still frozen/); expect(instrumentFindingLines(f.instrumentDiscipline).length).toBe(2);
    expect(headlineTip({ ...mk('stop', 12), score: { ...r.score, legs: r.score.legs.map(l => ({ ...l, error: 0, penalty: 0 })) }, instrumentDiscipline: f.instrumentDiscipline }, sc)).toMatch(/^Clean run.*WATCH-009/);
  });
});

describe('CAMP-001 campaign division, ASP, discards, age factor and the Trophy Run tie-break', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  const items = (stage: number): number[] => [30 + stage, 12, 9, 7, 5, 3, 2 + stage % 3, 1];  // eight legs per stage
  it('CAMP-001 the division defaults to rookie, an ASP (1-120) is drawn per stage and is the one the D13 scenario carries', () => {
    const store = mem(); expect(loadCampaign(store).division).toBe('rookie'); expect(DIVISION_DISCARDS.rookie).toBe(6);
    const sum = campaignSummary(loadCampaign(store), 0); expect(sum.division).toBe('rookie'); expect(sum.discardCount).toBe(6); expect(sum.divisionLabel).toBe('Rookie');
    for (const r of sum.rows) { expect(r.asp).toBeGreaterThanOrEqual(1); expect(r.asp).toBeLessThanOrEqual(120); expect(drillById('D13')!.scenario(r.seed, 0).asp).toBe(r.asp); }
    expect(new Set(sum.rows.map(r => r.asp)).size).toBeGreaterThan(5);
    expect(drillById('D13')!.scenario(TROPHY_RUN_SEED, 0).asp).toBe(sum.trophyRun.asp);
    expect(setCampaignDivision('expert', store).division).toBe('expert'); expect(loadCampaign(store).division).toBe('expert'); expect(campaignSummary(loadCampaign(store), 0).discardCount).toBe(4);
    expect(setCampaignDivision('bogus' as never, store).division).toBe('rookie');
  });
  it('CAMP-001 the championship total discards the division\'s worst legs of Stages 1-7 (REG-003), keeps Stages 8-9 whole, and applies the age factor (REG-002)', () => {
    const store = mem(); const raws: number[] = [];
    for (let st = 1; st <= 9; st++) { const it = items(st); const raw = it.reduce((a, b) => a + b, 0); raws.push(raw); recordCampaignStage({ stage: st, tier: 0, raw, score: Math.round(raw * 0.845 * 100) / 100, aces: 0, penaltyItems: it }, store, st); }
    const pool = [1, 2, 3, 4, 5, 6, 7].flatMap(items).sort((a, b) => b - a);
    for (const div of ['rookie', 'sportsman', 'expert', 'grand', 'xcup'] as const) {
      setCampaignDivision(div, store); const sum = campaignSummary(loadCampaign(store), 0); const n = DIVISION_DISCARDS[div];
      const cut = pool.slice(0, n).reduce((a, b) => a + b, 0); const rawTotal = raws.reduce((a, b) => a + b, 0);
      expect(sum.championship.discarded).toEqual(pool.slice(0, n)); expect(sum.championship.raw).toBe(rawTotal); expect(sum.championship.afterDiscards).toBe(rawTotal - cut);
      expect(sum.championship.ageFactor).toBe(0.845); expect(ageFactor(1939)).toBe(0.845); expect(sum.championship.ageFactored).toBeCloseTo(Math.round((rawTotal - cut) * 0.845 * 100) / 100, 2);
      expect(sum.championship.afterDiscards).toBe(championshipTotal([...Array(9)].map((_, i) => ({ stage: i + 1, score: { legs: [] as never[], dnf: false, penaltyItems: items(i + 1) } })), div).afterDiscards);
      // the per-stage discarded column adds up to the cut, and Stages 8-9 have none
      expect(sum.rows.filter(r => r.stage <= 7).reduce((a, r) => a + (r.discarded ?? 0), 0)).toBe(cut); expect(sum.rows[7]!.discarded).toBe(null);
    }
    // an entry stored without leg detail (before CAMP-001) counts whole and is named
    const legacy = mem(); recordCampaignStage({ stage: 1, tier: 0, raw: 60, score: 50.7, aces: 1 }, legacy, 1); const ls = campaignSummary(loadCampaign(legacy), 0);
    expect(ls.championship.withoutDetail).toEqual([1]); expect(ls.championship.afterDiscards).toBe(60); expect(ls.total).toBeCloseTo(50.7, 5);
  });
  it('CAMP-001 Stage 0 (the Trophy Run, played as seed 10) is excluded from the total and kept for the tie-break; a DNF on Stage 8 or 9 removes eligibility', () => {
    const store = mem(); recordCampaignStage({ stage: 1, tier: 0, raw: 40, score: 33.8, aces: 0, penaltyItems: [20, 10, 10] }, store, 1);
    const before = campaignSummary(loadCampaign(store), 0);
    recordCampaignStage({ stage: TROPHY_RUN_SEED, tier: 0, raw: 90, score: 76, aces: 0, penaltyItems: [60, 30] }, store, 2); recordCampaignStage({ stage: 0, tier: 0, raw: 95, score: 80, aces: 0 }, store, 3);   // the worse replay is ignored
    const after = campaignSummary(loadCampaign(store), 0);
    expect(after.trophyRun).toMatchObject({ played: true, raw: 90, score: 76 }); expect(after.played).toBe(1); expect(after.total).toBe(before.total); expect(after.championship.raw).toBe(before.championship.raw); expect(after.championship.ageFactored).toBe(before.championship.ageFactored);
    expect(recordCampaignStage({ stage: 11, tier: 0, raw: 1, score: 1, aces: 0 }, store).tiers['0']!['11']).toBeUndefined();
    recordCampaignStage({ stage: 9, tier: 0, raw: 400, score: 338, aces: 0, penaltyItems: [180, 180, 40], dnf: true }, store, 4); expect(campaignSummary(loadCampaign(store), 0).championship.eligible).toBe(false);
    expect(campaignSummary(loadCampaign(store), 0).rows[8]!.dnf).toBe(true); expect(after.tieBreak).toEqual(['lower score', 'older Scoring Year', 'higher Trophy Run finishing position']);
  });
  it('CAMP-001 the standings table is ordered by compareStandings: lower score, then the older Scoring Year, then the better Trophy Run position', () => {
    const tie = [{ name: 'newer', total: 50, scoringYear: 1950, trophyRunPosition: 1 }, { name: 'older', total: 50, scoringYear: 1936, trophyRunPosition: 9 }, { name: 'older-better', total: 50, scoringYear: 1936, trophyRunPosition: 2 }, { name: 'low', total: 10, scoringYear: 1960 }];
    expect(rankStandings(tie).map(s => s.name)).toEqual(['low', 'older-better', 'older', 'newer']); expect(compareStandings(tie[1]!, tie[2]!)).toBeGreaterThan(0);
    const store = mem(); for (let st = 1; st <= 3; st++) recordCampaignStage({ stage: st, tier: 0, raw: 100, score: 84.5, aces: 0, penaltyItems: [40, 30, 30] }, store, st);
    const sum = campaignSummary(loadCampaign(store), 0); expect(sum.standings.length).toBe(5); expect(sum.standings.filter(s => s.you).length).toBe(1);
    expect(sum.standings.map(s => s.name)).toEqual(rankStandings(sum.standings).map(s => s.name)); expect(sum.standings.map(s => s.rank)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < sum.standings.length; i++) expect(compareStandings(sum.standings[i - 1]!, sum.standings[i]!)).toBeLessThanOrEqual(0);
  });
});

describe('BOT-007 the oracle works like a navigator: clock glances, a lap at every calibration point, and the measured k on a stock speedometer', () => {
  const stock = (seed: number) => generateStage(seed, { ...PROFILES.fullStage!, speedo: STOCK_1939_SPEEDO, driver: DRIVER_EXPERT, aids: aidsForRung(0), bookStyle: 'race' });
  it('BOT-007 after the calibration run the oracle holds assigned / k: a stock-speedo day scores tens of seconds instead of hundreds, and k matches the speedometer\'s true factor at 50 mph', () => {
    for (const seed of [2, 3]) {
      const sc = stock(seed);
      const sim = new Simulator(sc); const bot = new OracleBot(sim, { useWatch: true }); const r = runBot(sim, bot);
      const ind50 = STOCK_1939_SPEEDO.gain * 50 + STOCK_1939_SPEEDO.offset + STOCK_1939_SPEEDO.quad * 2500;
      const k = (bot as unknown as { k: number }).k; expect(k, `seed ${seed}`).toBeGreaterThan(0); expect(Math.abs(k - 50 / ind50)).toBeLessThan(0.004);
      expect(r.score.raw, `seed ${seed} calibrated`).toBeLessThan(45);
      const sim2 = new Simulator(sc); const raw2 = runBot(sim2, new OracleBot(sim2, { useWatch: true, noCalibration: true })).score.raw;
      expect(raw2, `seed ${seed} never calibrated`).toBeGreaterThan(150);
    }
  });
  it('BOT-007 D12 Silver and Gold (stock speedometer): the oracle no longer scores 0 stars; the team that never calibrates still does', () => {
    const d = drillById('D12')!;
    for (const t of [1, 2]) {
      const sc = d.scenario(1, t); expect(sc.speedo.kind).toBe('mechanical');
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); const rb = d.rubric(r, sc);
      expect(rb.stars, `tier ${t}: ${rb.headline}`).toBeGreaterThanOrEqual(1); expect(r.score.raw).toBeLessThan(60);
      const sim2 = new Simulator(sc); const r2 = runBot(sim2, new OracleBot(sim2, { useWatch: true, noCalibration: true })); expect(d.rubric(r2, sc).stars).toBe(0); expect(r2.score.raw).toBeGreaterThan(150);
    }
  });
  it('BOT-007 the shipped oracle leaves no clock or calibration finding on a generated day: a stopwatch restart at the asterisk, a lap at every calibration point, a clock read inside 20 s before every restart and OUT', () => {
    const sc = generateStage(1, { ...PROFILES.fullStage!, driver: DRIVER_EXPERT });
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
    expect(r.instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay' || f.kind === 'calibrationWithoutLap')).toEqual([]);
    const cal = sc.book.filter(i => i.section === 'calibration'); const laps = sim.instrumentLog.filter(e => e.kind === 'watch.lap' || e.kind === 'watch.start').length; expect(laps).toBeGreaterThanOrEqual(cal.length);
    const reads = sim.instrumentLog.filter(e => e.kind === 'clock.read').map(e => e.tod); expect(reads.length).toBeGreaterThan(10);
    for (const dep of departuresOf(r, sc)) if (dep.actual !== null) expect(reads.some(t => t <= dep.actual! && dep.actual! - t <= 21), `${dep.kind} line ${dep.line}`).toBe(true);
  });
  it('BOT-007 glances are spaced 20 s apart and only when a start, restart, exact-transit or promoted-stop departure is within 2 minutes', () => {
    const sc = drillById('D16')!.scenario(3, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
    const reads = sim.instrumentLog.filter(e => e.kind === 'clock.read').map(e => e.tod);
    for (let i = 1; i < reads.length; i++) expect(reads[i]! - reads[i - 1]!).toBeGreaterThanOrEqual(19.9);
    const deps = departuresOf(r, sc).map(d => d.actual).filter((t): t is number => t !== null);
    const ins = r.events.filter(e => e.type === 'transit.in').map(e => e.tod);
    const known = [sc.startTime, ...ins, ...deps];
    expect(reads.length).toBeGreaterThan(8);
    for (const t of reads) expect(known.some(k => k - t <= 125 && k - t >= -6), `read at ${t.toFixed(0)}`).toBe(true);   // every glance lies inside the 2 minutes before a start, IN, OUT, lunch or restart
    for (const k of known) expect(reads.some(t => k - t <= 21 && k - t >= -1), `an event at ${k.toFixed(0)} was read within 21 s`).toBe(true);
  });
});

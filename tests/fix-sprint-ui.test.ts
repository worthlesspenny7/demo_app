/** Fix sprint PT-05 (2026-10-04): view-model and rubric regressions for the playability fixes. Each test names its spec id (docs/spec/SPECS.md "FIX SPRINT"). */
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { ScenarioBuilder } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { DRIVER_EXPERT, FORD_1939, PACKARD_1936, aidsForRung, type Scenario } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { headlineTip, callErrors } from '../src/core/drills/rubrics.js';
import { workedStops, workedCruise, workedTimed, biasNoise, workedLandmarks, workedTurns, legAssignedSpeeds } from '../src/ui/viewmodels/debrief.js';
import { counterfactuals } from '../src/ui/viewmodels/counterfactual.js';
import { effectiveScale, HOLD_FF_MARGIN_S } from '../src/ui/viewmodels/timescale.js';
import { chartGrids } from '../src/ui/viewmodels/charts.js';
import { perfCardFor, instrumentPolicy, holdCardFor } from '../src/ui/viewmodels/cockpitinfo.js';
import { turnLoss } from '../src/core/perf-table.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const until = (sim: Simulator, pred: () => boolean, max = 3600): void => { let t = 0; while (!pred() && t < max && sim.phase !== 'finished') { sim.step(0.1); t += 0.1; } };

describe('FIX SPRINT PT-05 view-models and rubrics', () => {
  it('PLAY-002 the perf card of a warm-up / transit line with no printed speed prints the suggested pace (printed miles / printed minutes) at every rung', () => {
    const sc = generateStage(1, PROFILES.fullStage); const first = sc.book[0]!; expect(first.speed).toBeUndefined();
    for (const rung of [0, 3] as const) { const c = perfCardFor(sc, 1, instrumentPolicy(aidsForRung(rung)))!; expect(c.transitPace, `rung ${rung}`).toBeDefined(); expect(c.transitPace!.mph).toBe(Math.round(first.transit!.miles! / (first.transit!.seconds / 3600))); expect(c.transitPace!.text).toMatch(/call about \d+ mph \([\d.]+ mi \/ \d+ min\)/); }
  });
  it('PLAY-003 a hold (restart, exact transit, promoted stop) runs at the chosen scale until 45 s before its out time, then at 1x', () => {
    const base = { requested: 8, paused: false, phase: 'running', carStopped: true, waitingForGo: true, nearestFeatureFt: null, hazardActive: false, countdownSeconds: null, bezelRemaining: null };
    expect(HOLD_FF_MARGIN_S).toBe(45);
    expect(effectiveScale({ ...base, holdSecondsLeft: 1500 })).toBe(8); expect(effectiveScale({ ...base, holdSecondsLeft: 46 })).toBe(8);
    expect(effectiveScale({ ...base, holdSecondsLeft: 44 })).toBe(1); expect(effectiveScale({ ...base, holdSecondsLeft: null })).toBe(1); expect(effectiveScale(base)).toBe(1);   // a STOP is still 1x
  });
  it('PLAY-006 a cross-traffic hold after the go is a hazard (ledger), not a late go: the stop row and the What-if use the go call, the tip does not say "go earlier"', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, trafficWaitProbability: 1, seed: 3 }).start(35).advanceMiles(0.5).stop('S', 35, { pause: 15 }).advanceMiles(0.8).checkpoint().advanceFt(300).finish();
    const sc = b.build(); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const traffic = r.events.find(e => e.type === 'traffic'); expect(traffic).toBeDefined();
    const row = workedStops(r.events, sc, r.attribution)[0]!; expect(row.trafficWait).toBeGreaterThan(0.5); expect(Math.abs(row.delta)).toBeLessThan(2);
    expect(r.attribution[0]!.buckets.hazard).toBeGreaterThan(row.trafficWait - 1); expect(Math.abs(r.attribution[0]!.buckets.stop)).toBeLessThan(2);
    expect(headlineTip(r, sc)).not.toMatch(/go earlier/);
    const cf = counterfactuals(r, sc).find(x => x.id.startsWith('stop:')); if (cf) expect(cf.label).toMatch(new RegExp(`instead of ${row.yourDwell.toFixed(1)} s`));
  });
  it('PLAY-006 cruise rows use each leg\'s own assigned speed and name uncalled speeds (the out speed after a STOP), not "your card is low"', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 30 }).start(30).advanceMiles(0.3).stop('S', 40, { pause: 15 }).advanceMiles(2).checkpoint().advanceMiles(0.3).speedAtSign('SPEED LIMIT 45', 45).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const speeds = legAssignedSpeeds(sc); expect(speeds.get(1)!.mph).toBe(40); expect(speeds.get(2)!.mph).toBe(45);
    const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 4 }); sim.act({ type: 'start' });   // never calls 40 after the stop, nor 45
    while (sim.phase !== 'finished') { sim.step(0.1); if (sim.waitingForGo && sim.tod - sim.waitStartTod > 10) sim.act({ type: 'call.go' }); if (sim.waitingForGo && sim.waitReason === 'finish') break; }
    const r = sim.result(); const rows = workedCruise(r.attribution, sc, r.events);
    expect(rows[0]!.text).toMatch(/assigned 40/); expect(rows[0]!.text).toMatch(/never called 40 at line 2/); expect(rows[0]!.text).not.toMatch(/card is/);
    expect(headlineTip(r, sc)).toMatch(/never called/);
  });
  it('PLAY-006 the lunch (promoted) stop, an exact-transit OUT and a hold with no pause are not worked as stops (no "+1950 s stop")', () => {
    const sc = drillById('D16')!.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const rows = workedStops(r.events, sc, r.attribution);
    for (const row of rows) { const ins = sc.book.find(i => i.n === row.line); expect(ins?.promotedStop, `line ${row.line}`).toBeUndefined(); expect(ins?.transit, `line ${row.line}`).toBeUndefined(); expect(Math.abs(row.delta)).toBeLessThan(60); }
  });
  it('PLAY-006 "Clean run" only with no penalty item: an early lunch departure or a finding turns the verdict into the penalty', () => {
    const sc = drillById('D16')!.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    expect(headlineTip(r, sc)).toMatch(/^Clean run/);
    const early = { ...r, score: { ...r.score, earlyDeparturePenalty: 60 } } as typeof r; expect(headlineTip(early, sc)).not.toMatch(/^Clean run/); expect(headlineTip(early, sc)).toMatch(/leave AT the printed time/);
    const finding = { ...r, findings: [{ kind: 'earlyLaunch' as const, line: 1, text: 'Start (line 1): you departed from the pre-read 55.0 s before your launch time.' }] } as typeof r; expect(headlineTip(finding, sc)).not.toMatch(/^Clean run/);
  });
  it('PLAY-006 D04 stars agree with the Debrief bias row (both from the call error), and a naive D05 (speed at the sign) never gets 3 stars', () => {
    const d4 = drillById('D04')!; const sc4 = d4.scenario(3, 0); const s4 = new Simulator(sc4); const r4 = runBot(s4, new OracleBot(s4, { ignoreLosses: true }));
    const rows = workedTimed(r4.events, sc4); const deltas = rows.map(x => x.delta).filter((x): x is number => x !== null);
    const errs = callErrors(r4, sc4, 'timed'); expect(errs.length).toBe(deltas.length);
    for (let i = 0; i < errs.length; i++) expect(errs[i]!).toBeCloseTo(deltas[i]!, 0);
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length; const rb = d4.rubric(r4, sc4); expect(rb.headline).toMatch(new RegExp(`average ${Math.abs(mean).toFixed(1)} s ${mean >= 0 ? 'late' : 'early'}`));
    const bias = biasNoise({ stops: [], timed: rows, landmarks: [], turns: [], cruise: [] }, null); const tr = bias.rows.find(x => x.type === 'timed')!; expect(Math.sign(tr.mean!)).toBe(Math.sign(mean));
    const d5 = drillById('D05')!;
    for (const seed of [1, 2, 3, 4]) for (const tier of [0, 1, 2]) { const sc = d5.scenario(seed, tier); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true })); expect(d5.rubric(r, sc).stars, `seed ${seed} tier ${tier}`).toBeLessThan(3); }
    // B16: a call is never matched to the identical call made for an earlier line
    for (const row of workedLandmarks(runBot(new Simulator(d5.scenario(1, 0)), null as never).events, d5.scenario(1, 0))) expect(row.yourCall === null || row.yourCall > -30).toBe(true);
    void workedTurns;
  });
  it('PLAY-006 a STOP with no printed pause says "make it up", not "go earlier", and stays out of the dwell bias', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop('S', 35, { noPause: true }).advanceMiles(0.5).stop('S', 35, { noPause: true }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); const rows = workedStops(r.events, sc, r.attribution);
    expect(rows.length).toBe(2); for (const row of rows) { expect(row.noPause).toBe(true); expect(row.text).toMatch(/make the seconds up/); expect(row.text).not.toMatch(/go earlier/); }
    expect(biasNoise({ stops: rows, timed: [], landmarks: [], turns: [], cruise: [] }, null).errors.stop).toEqual([]);
  });
  it('PLAY-007 the promoted-stop card reads "leave AT ..., not before ... (5 min penalty window)", never "leave by"', () => {
    const sc = drillById('D16')!.scenario(1, 0); const meal = sc.book.find(i => i.promotedStop)!;
    const card = holdCardFor({ ...sc, rules: sc.rules } as Scenario, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => hms(10, 27, 0) }, meal.n)!;
    expect(card.text).toMatch(/^leave AT 10:27:00 \(not before 10:22:00 - 5 min penalty window/); expect(card.text).not.toMatch(/leave by/);
  });
  it('PLAY-008 the start line is checked off as the car leaves (the pointer moves to line 2), and the next-call prompt goes once its call is made', () => {
    const sc = drillById('D04')!.scenario(1, 0); const sim = new Simulator(sc); until(sim, () => sim.phase === 'running', 200);
    const o = sim.observe({ peek: true }); expect(o.driver.lastExecutedLine).toBe(1); expect(o.currentLine).toBe(2);
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(3), prereadSeconds: 20 }).start(35).advanceMiles(0.6).stop('L', 35, { pause: 15 }).advanceMiles(0.6).checkpoint().advanceFt(300).finish();
    const s2 = new Simulator(b.build()); s2.act({ type: 'skipPreread', secondsBefore: 4 }); s2.act({ type: 'start' }); until(s2, () => s2.observe({ peek: true }).nextCall !== null, 200);
    expect(s2.observe({ peek: true }).nextCall!.call).toBe('call.turn L'); s2.act({ type: 'call.turn', dir: 'L' }); s2.step(0.1); expect(s2.observe({ peek: true }).nextCall).toBeNull();
  });
  it('PLAY-009 the charts carry a 48 mph row and column (the Ford model and the Packard table), and the Ford turn chart\'s 10 mph row is not all zeros', () => {
    for (const car of [FORD_1939, PACKARD_1936]) for (const g of chartGrids(car)) { expect(g.speeds, `${car.name} ${g.id}`).toContain(48); expect(g.rows.some(r => r.in === 48)).toBe(true); }
    const turns = chartGrids(FORD_1939).find(g => g.id === 'turns')!; const row10 = turns.rows.find(r => r.in === 10)!;
    expect(row10.cells.some(c => c.value > 0)).toBe(true); expect(turns.rows.find(r => r.in === 55)!.cells.find(c => c.out === 10)!.value).toBeGreaterThan(0);
    expect(turnLoss(90, 10, 10, FORD_1939)).toBe(0);
  });
  it('PLAY-010 D16, D18 and D11 start from an assigned position >= 1, so the cars one minute ahead and behind are on the road from the first minutes (rung >= 1)', () => {
    for (const id of ['D16', 'D18', 'D11']) {
      const sc = drillById(id)!.scenario(1, 0); expect(sc.asp, id).toBeGreaterThanOrEqual(1); expect(sc.aids.rung).toBeGreaterThanOrEqual(1);
      const sim = new Simulator(sc); const bot = new OracleBot(sim); let seen = 0; let k = 0;
      while (sim.phase !== 'finished' && k < 6000) { bot.onTick(); sim.step(0.1); k++; if (k % 10 === 0 && sim.phase === 'running' && sim.observe({ peek: true }).ahead.some(f => f.kind === 'car')) seen++; }
      expect(seen, id).toBeGreaterThan(10);
    }
  });
});

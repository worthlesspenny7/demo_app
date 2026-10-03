import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { allDrills, drillById } from '../src/core/drills/registry.js';
import { isUnlocked } from '../src/core/drills/index.js';
import { validateScenario, aidsForRung, LEGAL_AIDS } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { headlineTip } from '../src/core/drills/rubrics.js';
import { dwellFor } from '../src/core/perf-table.js';

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
  it('DRILL-005 aids defaults: rung 3 for D01-D05 Bronze, rung 1 for D18/D11 Bronze, rung 0 for D12+; legal mode has no aids', () => {
    for (const id of ['D01', 'D03', 'D04', 'D05']) expect(drillById(id)!.tiers[0]!.aids.rung).toBe(3);
    expect(drillById('D18')!.tiers[0]!.aids.rung).toBe(1); expect(drillById('D11')!.tiers[0]!.aids.rung).toBe(1);
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
  it('DRILL-008 D08b time allowance drill: oracle that declares the measured delay earns 3 stars; no declaration earns 0', () => {
    const d = drillById('D08b')!; const sc = d.scenario(3, 0);
    const sim = new Simulator(sc); const bot = new OracleBot(sim); let declared = false;
    while (sim.phase !== 'finished') { bot.onTick(); if (!declared && (sim.taQualifying[1] ?? 0) > 0 && !sim.waitingForGo && sim.car.mph() > 30) { sim.act({ type: 'ta.declare', seconds: Math.round(sim.taQualifying[1]!) }); declared = true; } sim.step(0.1); }
    const r = sim.result(); const rb = d.rubric(r, sc); expect(rb.stars).toBe(3);
    const sim2 = new Simulator(sc); const r2 = runBot(sim2, new OracleBot(sim2, { ignoreLosses: true })); expect(d.rubric(r2, sc).stars).toBe(0); // rookie bot never declares
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
  it('DRILL-012 D15 pre-read rubric scores annotated pauses before the start', () => {
    const d = drillById('D15')!; const sc = d.scenario(1, 0); expect(sc.prereadSeconds).toBe(600);
    const sim = new Simulator(sc); let v = sc.book[0]!.speed ?? 35;
    for (const ins of sc.book) { const vIn = v, vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? v; if (ins.pause) { const cap = ins.turn ? (['BL', 'BR'].includes(ins.turn) ? sc.car.turnSpeedMph.bear : sc.car.turnSpeedMph.turn) : undefined; sim.act({ type: 'line.annotate', n: ins.n, text: dwellFor(ins.pause, vIn || vOut, vOut, sc.car, cap).toFixed(1) }); } v = ins.timed ? ins.timed.thenSpeed : vOut; }
    const r = runBot(sim, new OracleBot(sim)); expect(r.prereadCoverage).toBe(1); expect(d.rubric(r, sc).stars).toBeGreaterThanOrEqual(2);
    const sim2 = new Simulator(sc); const r2 = runBot(sim2, new OracleBot(sim2)); expect(d.rubric(r2, sc).stars).toBe(0);
  });
  it('DRILL-013 D16 time-of-day: a whole-minute error fails regardless of seconds', () => {
    const d = drillById('D16')!; const sc = d.scenario(1, 0);
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); expect(d.rubric(r, sc).stars).toBeGreaterThanOrEqual(2);
    const late = new Simulator(sc); late.step(120 + 60); late.act({ type: 'start' }); const rl = runBot(late, new OracleBot(late)); expect(d.rubric(rl, sc).stars).toBe(0);
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

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { Session } from '../src/agent/protocol.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator, ENGINE_VERSION } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { PROFILES, generateStage } from '../src/core/generator/generate.js';
import { annotatePerfectTimes } from '../src/core/ghost.js';
import { milesToFt } from '../src/core/units.js';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { headlineTip } from '../src/core/drills/rubrics.js';
import { dwellFor } from '../src/core/perf-table.js';
import { FORD_1939, PACKARD_1936 } from '../src/core/course.js';

describe('PT-01 regressions', () => {
  it('PT01-BUG1 go scheduled on carStopped is honoured in the same tick the car stops', () => {
    const s = new Session(builtinScenario('onestop'));
    s.handle({ type: 'act', action: { type: 'start' } });
    s.handle({ type: 'act', action: { type: 'call.turn', dir: 'S' } });
    s.handle({ type: 'act', action: { type: 'call.go' }, when: { event: 'carStopped' } });
    let fired = false;
    for (let i = 0; i < 10 && !fired; i++) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 120 }); if (r.type === 'advanced' && r.scheduledFired.includes('call.go')) fired = true; }
    expect(fired).toBe(true);
    const r = s.handle({ type: 'advance', seconds: 3 }); expect(r.type).toBe('advanced'); if (r.type !== 'advanced') return;
    expect(r.observation.carStopped).toBe(false);
    expect(s.sim.events.some(e => e.type === 'release' && e.detail?.reason === 'patience')).toBe(false);
  });
  it('PT01-BUG2 driver messages arrive in advanced replies with ids and kinds', () => {
    const s = new Session(builtinScenario('onestop'));
    s.handle({ type: 'act', action: { type: 'start' } });
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 120 }); if (r.type !== 'advanced') break; for (const m of r.observation.driver.messages) { expect(typeof m.id).toBe('number'); expect(['readback', 'question', 'info']).toContain(m.kind); seen.push(m.text); } if (seen.includes('Stopped')) break; }
    expect(seen).toContain('Stopped');
    const ids = new Set(seen); expect(ids.size).toBe(seen.length); // no duplicates across replies
  });
  it('PT01-BUG7/8/12 invalid actions are rejected with errors and never recorded', () => {
    const s = new Session(builtinScenario('onestop'));
    const bad: unknown[] = [{ type: 'call.speed', mph: 'fast' }, { type: 'call.speed', mph: 1e400 }, { type: 'call.speed', mph: -10 }, { type: 'call.turn', dir: 'X' }, { type: 'call.fly' }, { type: 'line.set', n: 'abc' }, { type: 'speedo.setFactor', k: 'x' }];
    for (const a of bad) { const r = s.handle({ type: 'act', action: a as never }); expect(r.type, JSON.stringify(a)).toBe('error'); }
    expect(s.sim.actions.length).toBe(0);
    const ok = s.handle({ type: 'advance', seconds: 1 }); expect(ok.type).toBe('advanced');
    expect(() => s.sim.act({ type: 'call.turn', dir: 'X' as never })).toThrow();
  });
  it('PT01-BUG9 advance is capped and a pre-read overrun departs late automatically', () => {
    const s = new Session(builtinScenario('onestop'));
    const r = s.handle({ type: 'advance', seconds: 3_000_000 }); expect(r.type).toBe('advanced'); if (r.type !== 'advanced') return;
    expect(r.seconds).toBeLessThanOrEqual(3600); expect(['running', 'finished']).toContain(s.sim.phase); expect(s.sim.events.some(e => e.type === 'depart')).toBe(true);
    expect(s.handle({ type: 'advance', seconds: -5 }).type).toBe('error');
  });
  it('PT01-BUG10 no hidden-state leaks in events at rung 0', () => {
    const sc = builtinScenario('varied', 3); // LEGAL_AIDS
    const s = new Session(sc); s.handle({ type: 'act', action: { type: 'start' } });
    const all: string[] = [];
    for (let i = 0; i < 60; i++) { const r = s.handle({ type: 'advance', seconds: 30 }); if (r.type !== 'advanced') break; all.push(...r.events); if (s.sim.phase === 'finished') break; }
    for (const e of all) expect(e, e).not.toMatch(/^(offCourse|rejoin|checkpoint|mainRoad|turn|stop\.begin|node|sightZone)/);
  });
  it('PT01-BUG11 a TA request filed at the TA point books to the leg it names (the delayed leg), not to the current leg', () => {
    const sc = drillById('D08b')!.scenario(3, 0);
    const sim = new Simulator(sc); const bot = new OracleBot(sim, { ignoreLosses: true }); let filed = false; // the rookie bot never files on its own
    while (sim.phase !== 'finished') { bot.onTick(); if (!filed && sim.taState().windowOpen) { filed = true; sim.act({ type: 'ta.request', legIndex: 1, seconds: 60, fromLine: 4, toLine: 5 }); } sim.step(0.1); }
    expect(sim.taDeclared[1]).toBe(60); expect(sim.taDeclared[2]).toBeUndefined(); expect(sim.taDeclared[3]).toBeUndefined();
  });
  it('PT01-LOW15/16/17 cues and refusals: At speed after start, refused analog reset message, card.set enables the card', () => {
    const sim = new Simulator(builtinScenario('straight')); sim.act({ type: 'start' }); sim.step(30);
    expect(sim.driverMsgs.some(m => m.text === 'At 30')).toBe(true);
    sim.act({ type: 'watch.start' }); sim.act({ type: 'watch.reset' }); expect(sim.watch.running).toBe(true); expect(sim.driverMsgs.some(m => /stop it before resetting/.test(m.text))).toBe(true);
    sim.act({ type: 'card.set', card: { '35': 37.5 } }); sim.act({ type: 'call.speed', mph: 35 }); expect(sim.targetIndicated).toBe(37.5);
  });
});

describe('generator wiring and golden transcript', () => {
  it('CAL-003 generated stage calibration section: 3-6 calibration points after the begin line (STAGE-006), at 50 mph, >= 15 miles, perfect times filled', () => {
    const sc = generateStage(4, PROFILES.fullStage!);
    const cal = sc.book.filter(i => i.section === 'calibration');
    expect(cal.length).toBeGreaterThanOrEqual(4); expect(cal.length).toBeLessThanOrEqual(7);
    expect(cal.slice(0, -1).every(i => (i.speed ?? 50) === 50)).toBe(true);
    const s0 = sc.course.nodes.find(n => n.id === cal[0]!.nodeId)!.s, s1 = sc.course.nodes.find(n => n.id === cal[cal.length - 1]!.nodeId)!.s;
    expect(s1 - s0).toBeGreaterThanOrEqual(milesToFt(15));
    expect(cal.slice(1).every(i => (i.perfectInterval ?? 0) > 0)).toBe(true);
    annotatePerfectTimes(sc); expect(cal[cal.length - 1]!.perfectCumulative!).toBeGreaterThan(1000);
  });
  it('D11/D12 use the generator and D13 is a full stage', () => {
    const d11 = drillById('D11')!.scenario(2, 0); expect(d11.book.length).toBeGreaterThan(15); expect(d11.checkpoints.filter(c => c.kind === 'timing').length).toBeGreaterThanOrEqual(1);
    const d12 = drillById('D12')!.scenario(2, 0); expect(d12.book.length).toBeGreaterThan(150); expect(d12.book.some(i => i.section === 'restart')).toBe(true); expect(d12.aids.rung).toBe(0);
  });
  it('SIM-022 golden transcript: the oracle on varied seed 3 reproduces the stored score for this engine version', () => {
    const sc = builtinScenario('varied', 3); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const snapshot = { engineVersion: ENGINE_VERSION, legs: r.score.legs.map(l => ({ cpId: l.cpId, actualTod: l.actualTod, error: l.error })), raw: r.score.raw };
    const path = 'tests/golden/varied-3-oracle.json';
    if (!existsSync(path) || process.env.UPDATE_GOLDEN) { mkdirSync('tests/golden', { recursive: true }); writeFileSync(path, JSON.stringify(snapshot, null, 2)); }
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    if (stored.engineVersion !== ENGINE_VERSION) { writeFileSync(path, JSON.stringify(snapshot, null, 2)); return; } // new engine version: re-baseline
    expect(snapshot).toEqual(stored);
  });
});

describe('post-validation specs', () => {
  it('DRV-018 a sharp turn called too late is refused and the car goes straight; called in time it is taken', async () => {
    const { ScenarioBuilder, EXITS } = await import('../src/core/builder.js');
    const { DRIVER_EXPERT } = await import('../src/core/course.js');
    const { hms } = await import('../src/core/units.js');
    const { stepUntil, runToEnd, startLikeOracle, nodeS } = await import('./helpers.js');
    const mk = () => new ScenarioBuilder({ startTime: hms(8, 0, 0), driver: { ...DRIVER_EXPERT, inconsistency: 0 }, excursionFt: 1200 }).start(45).advanceMiles(0.6).instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 700 }, { turn: 'R', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const late = new Simulator(mk()); startLikeOracle(late); const s = nodeS(late.sc, 'n2');
    stepUntil(late, () => late.car.s >= s - 60); late.act({ type: 'call.turn', dir: 'R' }); runToEnd(late);
    expect(late.events.some(e => e.type === 'turnMissed')).toBe(true); expect(late.offCourseCount).toBe(1);
    const early = new Simulator(mk()); startLikeOracle(early); stepUntil(early, () => early.car.s >= s - 600); early.act({ type: 'call.turn', dir: 'R' }); runToEnd(early);
    expect(early.events.some(e => e.type === 'turnMissed')).toBe(false); expect(early.offCourseCount).toBe(0);
  });
  it('GEN-009 (superseded by STAGE-006) / GEN-010 the calibration run is followed by a transit and a time-of-day restart, train caps and speed-limit text', () => {
    for (const seed of [1, 2, 3]) {
      const sc = generateStage(seed, PROFILES.fullStage!);
      const cal = sc.book.filter(i => i.section === 'calibration'); const last = cal[cal.length - 1]!;
      const restart = sc.book.find(i => i.section === 'restart' && i.n > last.n)!;
      expect(restart).toBeTruthy(); expect(restart.restartTime! % 60).toBe(0); expect(restart.n).toBeGreaterThan(last.n); expect(last.transit && !last.transit.end).toBe(true); expect(restart.transit?.end).toBe(true); expect(restart.baseTime).toBe(restart.restartTime);
      const trains = sc.hazards.filter(h => h.kind === 'train'); expect(trains.length).toBeLessThanOrEqual(2);
      expect((sc.tags ?? []).filter(t => /^train:\d+:hit$/.test(t)).length).toBeLessThanOrEqual(1);
      for (const ins of sc.book) { const n = sc.course.nodes.find(x => x.id === ins.nodeId)!; const m = n.sign?.text.match(/^SPEED LIMIT (\d+)$/); if (m && ins.speed !== undefined) expect(Number(m[1]), `line ${ins.n}`).toBeGreaterThanOrEqual(ins.speed); }
    }
  });
  it('BOT-006 oracle declares TA and handles compound STOP+timed lines (D04 3 stars on 10 seeds)', () => {
    const d = drillById('D04')!;
    for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); expect(d.rubric(r, sc).stars, `seed ${seed}`).toBe(3); }
    const b = drillById('D08b')!; const sc = b.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    expect(r.actions.some(a => a.action.type === 'ta.request')).toBe(true); expect(b.rubric(r, sc).stars).toBeGreaterThanOrEqual(2);
  });
});

describe('re-validation specs (2026-10-03)', () => {
  it('RUB-001 clean run only at mean error <= 3 s; stops lost + cruise recovered is labelled a recovery, not a wandering driver', () => {
    const d = drillById('D03')!; const sc = d.scenario(3, 0);
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    expect(headlineTip(r, sc)).toMatch(/^Clean run/);
    const fake = { ...r, offCourseCount: 0, score: { ...r.score, legs: r.score.legs.map(l => ({ ...l, error: 9, penalty: 9 })) }, attribution: [{ legIndex: 0, buckets: { stop: 14, cruise: -5, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, ta: 0 } }] } as typeof r;
    const tip = headlineTip(fake, sc); expect(tip).not.toMatch(/^Clean run/); expect(tip).toMatch(/lost 14 s in stops and recovered 5 s in cruise/);
    const noisy = { ...fake, attribution: [{ legIndex: 0, buckets: { stop: 0, cruise: 9, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, ta: 0 } }] } as typeof r;
    expect(headlineTip(noisy, sc)).not.toMatch(/^Clean run/);
  });
  it('RUB-002 the ramp after a restart release is booked to start, not cruise', () => {
    const d = drillById('D16')!; const sc = d.scenario(1, 0);
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const restartLeg = sc.book.findIndex(i => i.section === 'restart' && i.restartTime !== undefined && i.n > 1);
    expect(restartLeg).toBeGreaterThan(0);
    const after = r.attribution.find(a => a.legIndex === sc.checkpoints.findIndex(cp => cp.s > sc.course.nodes.find(n => n.id === sc.book[restartLeg]!.nodeId)!.s));
    expect(after).toBeDefined(); expect(Math.abs(after!.buckets.start)).toBeGreaterThan(0); expect(Math.abs(after!.buckets.cruise)).toBeLessThan(2.5);
  });
  it('DRILL-018 D15 is a 48-line, 8-page triage book; the rubric skips empty text, parses "go at 7.3s" style pause notes and applies no turn cap on straight STOPs', async () => {
    const { idealNotes } = await import('../src/core/drills/d15.js');
    const d = drillById('D15')!; const sc = d.scenario(1, 0);
    expect(sc.book.length).toBeGreaterThanOrEqual(40); expect(sc.book.filter(i => i.pause).length).toBeGreaterThanOrEqual(8); expect(sc.book.some(i => i.transit?.exact)).toBe(true);
    const sim = new Simulator(sc);
    for (const a of idealNotes(sc)) sim.act({ type: 'line.annotate', n: a.n, text: a.text.replace(/pause ([\d.]+) s/, 'go at $1s') });   // "go at 7.3s"
    sim.act({ type: 'line.annotate', n: 2, text: '   ' });                                                                      // empty text never counts
    let out = false; const begin = sc.book.find(i => i.transit && !i.transit.end && i.transit.exact)!; const end = sc.book.find(i => i.transit?.end && i.transit.exact)!;
    const bot = new OracleBot(sim);
    while (sim.phase !== 'finished') { bot.onTick(); if (!out && sim.transitIn[begin.n] !== undefined) { out = true; const o = sim.transitIn[begin.n]! + begin.transit!.seconds; sim.act({ type: 'line.annotate', n: end.n, text: `OUT ${Math.floor(o / 3600) % 12}:${String(Math.floor(o / 60) % 60).padStart(2, '0')}:${String(o % 60).padStart(2, '0')}` }); } sim.step(0.1); }
    const r = sim.result(); const rb = d.rubric(r, sc);
    expect(rb.stars).toBeGreaterThanOrEqual(2); expect(rb.feedback.join(' ')).not.toMatch(/you wrote "/);
  });
  it('DRILL-019 D04/D05 stars are capped by per-change error; a lucky net-zero run with bad changes does not get 3 stars', () => {
    for (const id of ['D04', 'D05']) { const d = drillById(id)!; const sc = d.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); expect(d.rubric(r, sc).stars, id).toBe(3);
      const bucket = id === 'D04' ? 'timedChange' : 'speedChange';
      const lucky = { ...r, attribution: r.attribution.map(a => ({ ...a, buckets: { ...a.buckets, [bucket]: 6, cruise: -6 } })) } as typeof r;
      expect(d.rubric(lucky, sc).stars, id).toBeLessThanOrEqual(1); }
  });
  it('DRILL-020 Gold on D03/D04/D05/D18 drives a hidden car variant; Bronze and Silver drive the preset (D03 Bronze: the Packard with its printed chart, CHART-002)', () => {
    for (const id of ['D03', 'D04', 'D05', 'D18']) { const d = drillById(id)!;
      if (id === 'D03') { expect(d.scenario(1, 0).car).toBe(PACKARD_1936); } else expect(d.scenario(1, 0).car.a0, id).toBe(FORD_1939.a0);
      expect(d.scenario(1, 1).car.a0, id).toBe(FORD_1939.a0); const g = d.scenario(1, 2).car; expect(g.a0, id).not.toBe(FORD_1939.a0); expect(Math.abs(g.a0 / FORD_1939.a0 - 1)).toBeLessThanOrEqual(0.15); expect(d.scenario(1, 2).car.name, id).toMatch(/this one/); }
    expect(drillById('D07')!.scenario(1, 2).car.a0).toBe(FORD_1939.a0);
  });
});

describe('check-off honesty', () => {
  it('DRV-019 "Did the turn" only after a called turn; no call at a turn line says so; off-route says nothing', async () => {
    const { ScenarioBuilder, EXITS } = await import('../src/core/builder.js');
    const { DRIVER_EXPERT, aidsForRung } = await import('../src/core/course.js');
    const { hms } = await import('../src/core/units.js');
    const { stepUntil, runToEnd, startLikeOracle, nodeS } = await import('./helpers.js');
    const mk = (route: 'turn' | 'S') => new ScenarioBuilder({ startTime: hms(8, 0, 0), driver: { ...DRIVER_EXPERT, inconsistency: 0 }, excursionFt: 1200, aids: aidsForRung(2) }).start(45).advanceMiles(0.6).instruction({ exits: EXITS.sideRoad('R', { route }), sightDistance: 700 }, { turn: route === 'turn' ? 'R' : 'S', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const texts = (sim: Simulator) => sim.events.filter(e => e.type === 'driver').map(e => String(e.detail?.text));
    // called in time and taken
    const ok = new Simulator(mk('turn')); startLikeOracle(ok); const s = nodeS(ok.sc, 'n2'); stepUntil(ok, () => ok.car.s >= s - 600); ok.act({ type: 'call.turn', dir: 'R' }); stepUntil(ok, () => ok.car.s >= s + 5); ok.act({ type: 'call.speed', mph: 35 }); runToEnd(ok); // GRIID-006: the line is complete once its speed change is made
    expect(texts(ok).some(t => /Did the turn, line 2/.test(t))).toBe(true);
    // no call: the car goes straight (off route) and the driver must not claim the turn
    const none = new Simulator(mk('turn')); startLikeOracle(none); runToEnd(none);
    expect(texts(none).some(t => /Did the turn/.test(t))).toBe(false); expect(none.offCourseCount).toBeGreaterThanOrEqual(1);
    // a turn line whose route is actually straight-through ('S'): no call is fine, he just checks it off
    const st = new Simulator(mk('S')); startLikeOracle(st); stepUntil(st, () => st.car.s >= nodeS(st.sc, 'n2') + 5); st.act({ type: 'call.speed', mph: 35 }); runToEnd(st);
    expect(texts(st).some(t => /Did that one, line 2/.test(t))).toBe(true); expect(st.offCourseCount).toBe(0);
  });
});

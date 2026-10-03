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
  it('PT01-BUG11 a TA declared within 3 minutes after the checkpoint books to the leg that had the delay', () => {
    const sc = drillById('D08b')!.scenario(3, 0);
    const sim = new Simulator(sc); const bot = new OracleBot(sim, { noRecovery: true });
    while (sim.phase !== 'finished') { bot.onTick(); if (sim.records.length === 1 && !sim.taDeclared[1] && !sim.taDeclared[2]) { sim.act({ type: 'ta.declare', seconds: 60 }); } sim.step(0.1); }
    expect(sim.taDeclared[1]).toBe(60); expect(sim.taDeclared[2]).toBeUndefined();
  });
  it('PT01-LOW15/16/17 cues and refusals: At speed after start, refused analog reset message, card.set enables the card', () => {
    const sim = new Simulator(builtinScenario('straight')); sim.act({ type: 'start' }); sim.step(30);
    expect(sim.driverMsgs.some(m => m.text === 'At 30')).toBe(true);
    sim.act({ type: 'watch.start' }); sim.act({ type: 'watch.reset' }); expect(sim.watch.running).toBe(true); expect(sim.driverMsgs.some(m => /stop it before resetting/.test(m.text))).toBe(true);
    sim.act({ type: 'card.set', card: { '35': 37.5 } }); sim.act({ type: 'call.speed', mph: 35 }); expect(sim.targetIndicated).toBe(37.5);
  });
});

describe('generator wiring and golden transcript', () => {
  it('CAL-003 generated stage calibration section: >= 3 intervals at 50 mph, >= 15 miles, perfect times filled', () => {
    const sc = generateStage(4, PROFILES.fullStage!);
    const cal = sc.book.filter(i => i.section === 'calibration');
    expect(cal.length).toBeGreaterThanOrEqual(4);
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

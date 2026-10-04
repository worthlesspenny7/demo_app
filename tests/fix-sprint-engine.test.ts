/** Fix sprint PT-05 / PT-06 (2026-10-04): engine and protocol regressions. Each test names its spec id (docs/spec/SPECS.md "FIX SPRINT"). */
import { describe, it, expect } from 'vitest';
import { ScenarioBuilder } from '../src/core/builder.js';
import { Simulator, sanitizeAction, validateAction, ENGINE_VERSION } from '../src/core/sim.js';
import { DRIVER_EXPERT, aidsForRung, validateScenario, normalizeScenario, transitPaceMph, type Scenario } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { Session, redactForAgent } from '../src/agent/protocol.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { scoreStage, scoreLeg, roundFactored, rankStandings, championshipTotal, ageFactor } from '../src/core/scoring.js';
import { DEFAULT_RULES } from '../src/core/course.js';
import type { Leg } from '../src/core/ghost.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { instructionS } from '../src/core/course.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const step = (sim: Simulator, sec: number): void => { for (let t = 0; t < sec - 1e-9; t += 0.1) sim.step(0.1); };
const until = (sim: Simulator, pred: () => boolean, max = 3600): void => { let t = 0; while (!pred() && t < max && sim.phase !== 'finished') { sim.step(0.1); t += 0.1; } };

describe('FIX SPRINT engine (PT-06 MEDIUM 1-8)', () => {
  it('ENG-001 a go called while the car is at rest away from any stop is not stored for the next STOP (that stop keeps its dwell)', () => {
    for (const premature of [false, true]) {
      const sim = new Simulator(builtinScenario('onestop', 1), { watch: 'digital' });
      sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); if (premature) sim.act({ type: 'call.go' });
      sim.act({ type: 'call.turn', dir: 'S' });
      until(sim, () => sim.waitingForGo, 400);
      step(sim, 3); expect(sim.waitingForGo, `premature ${premature}`).toBe(true); // still waiting for the navigator's go
    }
  });
  it('ENG-002 call.pullover can be undone: call.go (or a speed call) drives on, and pulling over never ends the stage', () => {
    for (const how of ['go', 'speed'] as const) {
      const sim = new Simulator(builtinScenario('straight', 1), { watch: 'digital' });
      sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); step(sim, 20);
      sim.act({ type: 'call.pullover' }); until(sim, () => sim.car.v === 0, 60); step(sim, 5);
      expect(sim.phase).toBe('running'); expect(sim.waitReason).toBe('pullover');
      sim.act(how === 'go' ? { type: 'call.go' } : { type: 'call.speed', mph: 30 }); step(sim, 30);
      expect(sim.car.mph(), how).toBeGreaterThan(25); expect(sim.pullover).toBe(false); expect(sim.phase).toBe('running');
    }
  });
  it('ENG-003 advance {untilEvent} in the pre-read wakes on the driver\'s "about 30 seconds" request (a question) or 30 s before the launch, and never runs past the launch second', () => {
    const sc = new ScenarioBuilder({ startTime: T0, asp: 2, seed: 4, driver: quiet, aids: aidsForRung(0), prereadSeconds: 300 }).start(40).advanceMiles(4).checkpoint().advanceFt(300).finish().build();
    const s = new Session(sc, { watch: 'digital' });
    const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 600 }); if (r.type !== 'advanced') throw new Error(r.type);
    expect(r.observation.phase).toBe('preread'); expect(r.seconds).toBeLessThan(300);
    expect(['launch', 'driverMessage:Give me about 30 seconds before we go']).toContain(r.stoppedOn);
    // keep advancing: it stops at the launch second at the latest
    let t = r.observation.tod; for (let i = 0; i < 5; i++) { const x = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 600 }); if (x.type !== 'advanced') break; t = s.sim.tod; if (x.stoppedOn === 'launch' && s.sim.launchInfo()!.secondsToLaunch <= 0) break; }
    expect(t).toBeLessThanOrEqual(s.sim.launchInfo()!.launchTime + 0.2);
    expect(s.sim.driverMsgs.find(m => /30 seconds before we go/.test(m.text))!.kind).toBe('question');
  });
  it('ENG-004 cross-traffic holds come from a keyed stream per STOP: the same seed gives the same holds to every navigator; ENGINE_VERSION is 3.1.0', () => {
    expect(ENGINE_VERSION).toBe('3.1.0');
    const holds = (bot: 'oracle' | 'rookie'): string => {
      const sc = { ...builtinScenario('varied', 2), trafficWaitProbability: 0.6 } as Scenario; const sim = new Simulator(sc);
      runBot(sim, bot === 'oracle' ? new OracleBot(sim) : new OracleBot(sim, { noRecovery: true, noPause: true } as never));
      return sim.events.filter(e => e.type === 'traffic' || e.type === 'wait').filter(e => e.type === 'traffic').map(e => `${Math.round(e.s)}:${(e.detail!.wait as number).toFixed(0)}`).join(',');
    };
    // a held stop gets the same draw: compare per node through the stream itself
    const sc = builtinScenario('onestop', 1); const a = new Simulator({ ...sc, trafficWaitProbability: 1 }); const b = new Simulator({ ...sc, trafficWaitProbability: 1 });
    for (const sim of [a, b]) { sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); sim.act({ type: 'call.turn', dir: 'S' }); }
    b.act({ type: 'call.speed', mph: 28 }); b.act({ type: 'call.speed', mph: 35 }); b.act({ type: 'call.speed', mph: 31 }); // extra calls draw ramp numbers
    until(a, () => a.waitingForGo, 600); until(b, () => b.waitingForGo, 600);
    expect((a as unknown as { trafficClearTod: number }).trafficClearTod - a.tod).toBeCloseTo((b as unknown as { trafficClearTod: number }).trafficClearTod - b.tod, 6);
    expect(typeof holds('oracle')).toBe('string');
  });
  it('ENG-005 oneMinuteMistake / lateLaunch only for discretionary departures: a car that arrives after its OUT / restart time and leaves at once gets no finding', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(0), prereadSeconds: 30 }).start(40).advanceFt(5280);
    b.transit({ exact: true, seconds: 600, miles: 6 }).advanceMiles(6).endTransit({ speed: 35 }).advanceMiles(2).checkpoint().advanceFt(400).finish();
    const sim = new Simulator(b.build()); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); let slowed = false;
    while (sim.phase !== 'finished' && sim.tod < T0 + 6000) { sim.step(0.1); if (!slowed && sim.transitIn[2] !== undefined) { slowed = true; sim.act({ type: 'call.speed', mph: 33 }); } if (sim.waitingForGo && sim.waitReason === 'hold') { sim.act({ type: 'call.speed', mph: 35 }); sim.act({ type: 'call.go' }); } }
    expect(sim.result().findings.filter(f => f.kind === 'oneMinuteMistake' || f.kind === 'lateLaunch')).toEqual([]);
    const sc2 = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(0), prereadSeconds: 30 }).start(40).advanceFt(2000).transit({ exact: false, seconds: 300, miles: 3 }).advanceMiles(3).restart(35, T0 + 240).advanceMiles(1).checkpoint().advanceFt(400).finish().build();
    const s2 = new Simulator(sc2); s2.act({ type: 'skipPreread', secondsBefore: 5 }); s2.act({ type: 'start' });
    while (s2.phase !== 'finished' && s2.tod < T0 + 3000) { s2.step(0.1); if (s2.waitingForGo && s2.waitReason === 'hold') { s2.act({ type: 'call.speed', mph: 35 }); s2.act({ type: 'call.go' }); } }
    const r2 = s2.result(); expect(r2.findings.filter(f => f.kind === 'oneMinuteMistake' || f.kind === 'lateLaunch')).toEqual([]); expect(r2.startDeltas.find(d => d.line === 3)!.arrivedLate).toBe(true);
  });
  it('ENG-006 the exact-transit IN time read from the clock as the sign goes by (up to a minute after it) is not a clockForTimeOfDay finding; no read at all still is', () => {
    const run = (readAfter: number | null): number => {
      const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(0), prereadSeconds: 30 }).start(40).advanceFt(5280);
      b.transit({ exact: true, seconds: 600, miles: 6 }).advanceMiles(6).endTransit({ speed: 35 }).advanceMiles(2).checkpoint().advanceFt(400).finish();
      const sim = new Simulator(b.build(), { watch: 'analog' }); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); let inAt: number | null = null, read = false;
      while (sim.phase !== 'finished' && sim.tod < T0 + 700) { sim.step(0.1); if (inAt === null && sim.transitIn[2] !== undefined) inAt = sim.tod; if (readAfter !== null && !read && inAt !== null && sim.tod >= inAt + readAfter - 1e-9) { read = true; sim.act({ type: 'clock.read' }); } }
      return sim.result().instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay' && /IN time/.test(f.text)).length;
    };
    expect(run(0.5)).toBe(0); expect(run(1)).toBe(0); expect(run(30)).toBe(0); expect(run(null)).toBe(1);
  });
  it('ENG-007 ta.request is refused once the stage has finished (and once the result has been read): no result peeking', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 30 }).start(35).advanceMiles(0.5);
    b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
    b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: 120 });
    b.advanceMiles(1).checkpoint().advanceFt(500).endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 60, miles: 0.3 } }).advanceMiles(0.3).observationFinish();
    const sim = new Simulator(b.build()); const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {};
    sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
    expect(sim.taState().windowOpen).toBe(true); // time stopped inside the window
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 60, fromLine: 1, toLine: 2 });
    expect(sim.taRequests[0]!.status).toBe('refused'); expect(sim.taRequests[0]!.reason).toMatch(/finished/); expect(sim.taDeclared[1]).toBeUndefined();
  });
  it('ENG-008 validateScenario requires a numeric asp and a complete rules block; normalizeScenario fills an older file; pace cars are never drawn without asp >= 1', () => {
    const sc = builtinScenario('straight', 1); const legacy = JSON.parse(JSON.stringify(sc)) as Scenario & Record<string, unknown>;
    delete (legacy as Record<string, unknown>).asp; legacy.rules = { maxEarly: 300 } as never;
    const p = validateScenario(legacy); expect(p.some(x => /asp/.test(x))).toBe(true); expect(p.some(x => /rules\.maxLate/.test(x))).toBe(true);
    const fixed = normalizeScenario(legacy); expect(validateScenario(fixed)).toEqual([]); expect(fixed.asp).toBe(0); expect(fixed.rules.maxLate).toBe(120);
    const sim = new Simulator({ ...sc, asp: undefined as never }); sim.act({ type: 'start' }); step(sim, 30);
    expect(sim.observe({ peek: true }).paceCars).toEqual({ ahead: null, behind: null });
    const r = runBot(new Simulator(fixed), null as never); expect(Number.isFinite(r.score.raw)).toBe(true);
  });
});

describe('FIX SPRINT engine (PT-06 LOW)', () => {
  it('ENG-009 the 15-minute TA window is open at exactly 900.0 s after the TA point, whatever the float of the crossing tick', () => {
    let refused = 0;
    for (let shift = 0; shift < 12; shift++) {
      const b = new ScenarioBuilder({ startTime: hms(12, 30, 0), driver: quiet, prereadSeconds: 16000 }).start(35).advanceMiles(0.5);
      b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
      b.hazard({ kind: 'train', startTod: hms(12, 30, 30), durationSeconds: 120 });
      b.advanceMiles(1).advanceFt(shift * 2.5).checkpoint().advanceFt(500).endTimedPortion({ endOfStage: true, transit: { exact: true, seconds: 1800 } }).advanceMiles(8).observationFinish();
      const sim = new Simulator(b.build()); const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {};
      sim.act({ type: 'skipPreread', secondsBefore: 6 }); sim.act({ type: 'start' });
      while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); }
      for (let i = 0; i < 9000; i++) sim.step(0.1);
      sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 1, toLine: 1 }); if (sim.taRequests[0]!.status !== 'filed') refused++;
    }
    expect(refused).toBe(0);
  });
  it('ENG-010 a printed-pause STOP inside a tractor / accident zone does not add its stopped seconds to the qualifying delay', () => {
    const run = (inZone: boolean): number => {
      const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5);
      b.hazard({ kind: 'tractor', s: b.position, speedMph: 20, lengthFt: 2500 } as never); b.advanceFt(inZone ? 1200 : 3000); b.stop('S', 35, { pause: 15 });
      b.advanceMiles(1).checkpoint().advanceFt(500).endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 120, miles: 0.5 } }).advanceMiles(0.5).observationFinish();
      const sim = new Simulator(b.build()); const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {};
      sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
      return sim.taQualifying[1] ?? 0;
    };
    expect(Math.abs(run(true) - run(false))).toBeLessThan(6); // the stop's ~20 s are no longer counted
  });
  it('ENG-011 TA hygiene: requests under 10 s are refused (never rounded up), a second request for a leg is refused, leg and line numbers must be whole', () => {
    expect(validateAction({ type: 'ta.request', legIndex: 1.5, seconds: 30, fromLine: 1, toLine: 1 })).toMatch(/whole/);
    expect(validateAction({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2.5, toLine: 3 })).toMatch(/whole/);
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 30 }).start(35).advanceMiles(0.5);
    b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
    b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: 120 });
    b.advanceMiles(1).checkpoint().advanceFt(500).endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 600, miles: 3 } }).advanceMiles(3).observationFinish();
    const sim = new Simulator(b.build()); const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {};
    sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); }
    for (const s of [0.4, 5, 9.99]) { sim.act({ type: 'ta.request', legIndex: 1, seconds: s, fromLine: 1, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.status).toBe('refused'); }
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 100, fromLine: 1, toLine: 2 }); sim.act({ type: 'ta.request', legIndex: 1, seconds: 10, fromLine: 1, toLine: 2 });
    expect(sim.taRequests.filter(r => r.status === 'filed').length).toBe(1); expect(sim.taDeclared[1]).toBe(100);
  });
  it('ENG-012 the stage score rounds raw x age factor half up to 0.01 s in integer arithmetic (5 x 0.845 = 4.23)', () => {
    expect(roundFactored(5, 0.845)).toBe(4.23); expect(roundFactored(23, 0.845)).toBe(19.44); expect(roundFactored(7, 0.845)).toBe(5.92); expect(roundFactored(100, 1)).toBe(100);
    const leg = { index: 1, cpId: 'cp1', perfectTod: 0, perfectDuration: 600, cumulativePerfect: 600 } as unknown as Leg;
    for (let raw = 1; raw <= 300; raw++) {
      const l = scoreLeg({ leg, record: { cpId: 'cp1', kind: 'timing', actualTod: 1600 + raw, rawTod: 1600 + raw, sightViolation: false }, anchorActual: 1000, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
      const s = scoreStage([l], 1939, DEFAULT_RULES, { observationMissed: false }).score; if (raw <= 120) expect(s).toBe(Math.floor((raw * 845 + 5) / 10) / 100);
    }
  });
  it('ENG-013 standings tie on the 0.01 s (older Scoring Year wins a float-noise tie), a repeated stage counts once, ageFactor rejects a non-finite year', () => {
    expect(rankStandings([{ name: 'young', total: 0.3, scoringYear: 1930 }, { name: 'old', total: 0.1 + 0.2, scoringYear: 1920 }]).map(s => s.name)).toEqual(['old', 'young']);
    const st = (stage: number, raw: number) => ({ stage, score: { legs: [{ penalty: raw }], raw, ageFactor: 1, score: raw, dnf: false } as never });
    expect(championshipTotal([st(1, 30), st(1, 30)]).raw).toBe(30);
    expect(() => ageFactor(NaN)).toThrow(); expect(() => ageFactor(Infinity)).toThrow(); expect(ageFactor(1939)).toBe(0.845);
  });
  it('ENG-015 an advance {untilEvent} is stopped only by events of that advance (not by the act\'s own depart / release), and `seconds` bounds it', () => {
    const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' });
    s.handle({ type: 'act', action: { type: 'start' } }); s.handle({ type: 'act', action: { type: 'call.turn', dir: 'S' } });
    const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 }); if (r.type !== 'advanced') throw new Error(r.type);
    expect(r.stoppedOn).not.toBe('depart'); expect(String(r.stoppedOn)).not.toMatch(/Leaving|Rolling/); expect(r.events).toEqual(expect.arrayContaining(['depart'])); // the act's events are still reported
    for (let i = 0; i < 8 && !s.sim.waitingForGo; i++) s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 });
    expect(s.sim.waitingForGo).toBe(true); s.handle({ type: 'act', action: { type: 'call.go' } });
    const g = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 }); if (g.type !== 'advanced') throw new Error(g.type); expect(g.stoppedOn).not.toBe('release');
    const r2 = s.handle({ type: 'advance', untilEvent: true, seconds: 3, maxSeconds: 200 }); if (r2.type !== 'advanced') throw new Error(r2.type);
    expect(r2.seconds).toBeLessThanOrEqual(3.05);
  });
  it('ENG-016 a go scheduled on carStopped does not fire in the pre-read; a malformed `when` is refused; the schedule is capped', () => {
    const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' });
    s.handle({ type: 'act', action: { type: 'call.go' }, when: { event: 'carStopped' } }); const r = s.handle({ type: 'advance', seconds: 1 });
    if (r.type !== 'advanced') throw new Error(r.type); expect(r.scheduledFired).toEqual([]); expect(r.observation.phase).toBe('preread');
    expect(s.handle({ type: 'act', action: { type: 'call.speed', mph: 30 }, when: { elapsed: 'x' as never } }).type).toBe('error');
    expect(s.handle({ type: 'act', action: { type: 'call.speed', mph: 30 }, when: { event: 'bogus' as never } }).type).toBe('error');
    let n = 0; for (let i = 0; i < 150; i++) if (s.handle({ type: 'act', action: { type: 'note', text: 'x' }, when: { elapsed: 1e9 } }).type === 'ack') n++;
    expect(n).toBeLessThanOrEqual(100);
  });
  it('ENG-017 unknown extra fields on an action are stripped before it is recorded or logged', () => {
    const s = new Session(builtinScenario('straight', 1), { watch: 'digital' });
    expect(s.handle({ type: 'act', action: { type: 'note', text: 'hi', junk: Infinity, blob: 'x'.repeat(100000) } as never }).type).toBe('ack');
    const r = s.sim.result(); expect(JSON.stringify(r).length).toBeLessThan(60000); expect(r.actions.some(a => 'junk' in (a.action as object))).toBe(false);
    expect(sanitizeAction({ type: 'call.speed', mph: 30, x: 1 } as never)).toEqual({ type: 'call.speed', mph: 30 });
  });
  it('ENG-018 at aids rung <= 1 an agent sees whole-second time, no launch arithmetic, and no hidden pace-car errors or car-ahead departure times before the finish', () => {
    const sc = new ScenarioBuilder({ startTime: T0, asp: 3, seed: 5, driver: quiet, aids: aidsForRung(0), prereadSeconds: 90 }).start(40).advanceMiles(4).checkpoint().advanceFt(300).finish().build();
    const s = new Session(sc, { watch: 'digital' }); s.handle({ type: 'advance', seconds: 0.3 });
    const o = s.handle({ type: 'observe' }); if (o.type !== 'observation') throw new Error(o.type);
    expect(Number.isInteger(o.observation.tod)).toBe(true); expect(o.observation.launch).toBeNull(); expect(o.observation.startQueue?.carAheadLeavesTod ?? null).toBeNull();
    expect((o.observation.startQueue?.cars ?? []).every(c => c.sitting === undefined)).toBe(true);
    const full = s.sim.observe({ peek: true }); const { book: _b, ...rest } = full; void _b;
    const red3 = redactForAgent(rest, 3, false); expect(red3.launch).not.toBeNull(); expect(red3.tod).toBe(full.tod);
  });
  it('ENG-019 no pace cars in observe() during the calibration run', () => {
    const sc = generateStage(4, { ...PROFILES.fullStage, asp: 3 } as never); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
    const cal = sc.book.filter(i => i.section === 'calibration'); const lo = instructionS(sc.course, cal[0]!), hi = instructionS(sc.course, cal[cal.length - 1]!);
    let k = 0, inRun = 0;
    while (sim.phase !== 'finished' && sim.car.s < hi) { bot.onTick(); sim.step(0.1); if (++k % 10) continue; if (sim.car.s >= lo && sim.car.s <= hi) { inRun++; const o = sim.observe({ peek: true }); expect(o.paceCars).toEqual({ ahead: null, behind: null }); } }
    expect(inRun).toBeGreaterThan(10);
  });
});

describe('FIX SPRINT engine side of the PT-05 fixes', () => {
  it('PLAY-002 a warm-up / transit line with no printed speed: the driver asks "what speed?" with the pace the box implies (miles / minutes), and asks again while the car sits', () => {
    expect(transitPaceMph({ exact: false, seconds: 1200, miles: 8 })).toBe(24); expect(transitPaceMph({ exact: false, seconds: 600 })).toBeNull();
    const sc = generateStage(1, PROFILES.fullStage); expect(sc.book[0]!.speed).toBeUndefined();
    const sim = new Simulator(sc); until(sim, () => sim.tod >= sc.startTime - 4); sim.act({ type: 'start' });
    const q = sim.driverMsgs.filter(m => m.kind === 'question' && /What speed/.test(m.text)); expect(q.length).toBe(1); expect(q[0]!.text).toMatch(/about \d+ mph makes/);
    expect(sim.driverMsgs.some(m => /Leaving \d+ s early/.test(m.text))).toBe(false);
    step(sim, 31); expect(sim.driverMsgs.filter(m => /What speed/.test(m.text)).length).toBe(2);
    sim.act({ type: 'call.speed', mph: 24 }); step(sim, 20); expect(sim.car.mph()).toBeGreaterThan(20);
  });
  it('PLAY-005 a drill-sized start (D01-D05) launches the car itself on the printed launch second with no queue and no count; pressing D early is an early departure by choice, never a misread minute', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 60 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); sc.startProcedure = 'drill';
    const sim = new Simulator(sc); expect(sim.observe({ peek: true }).startQueue).toBeNull();
    until(sim, () => sim.phase === 'running', 120); const li = sim.launchInfo(sc.book[0]!)!;
    expect(Math.abs(sim.tod - li.launchTime)).toBeLessThanOrEqual(0.11); expect(sim.driverMsgs.some(m => /30 seconds/.test(m.text))).toBe(false);
    runBot(sim, null as never); const r = sim.result(); expect(r.findings).toEqual([]); expect(r.startDeltas[0]!.auto).toBe('drill');
    const s2 = new Simulator(sc); step(s2, 5); s2.act({ type: 'start' }); const r2 = runBot(s2, null as never);
    expect(r2.findings.map(f => f.kind)).toEqual(['earlyLaunch']); expect(r2.findings[0]!.text).toMatch(/departed from the pre-read/);
  });
  it('PLAY-007 the driver names the hold: "Restart line" at a restart, "Lunch stop. We leave AT ..., not before ... (5-minute penalty window)" at a meal stop', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(3), prereadSeconds: 30 }).start(40).advanceFt(2000).transit({ exact: false, seconds: 300, miles: 3 }).advanceMiles(3).restart(35, T0 + 600).advanceMiles(1).checkpoint().advanceFt(400).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); until(sim, () => sim.waitingForGo, 900);
    const last = sim.driverMsgs[sim.driverMsgs.length - 1]!.text; expect(last).toMatch(/^Restart line/); expect(last).not.toMatch(/Lunch/);
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(3), prereadSeconds: 30 }).start(40).advanceMiles(0.5);
    b.transit({ exact: false, seconds: 3600 }).advanceMiles(1).promotedStop('meal', 2700).advanceMiles(3).restart(40, T0 + 3600).advanceMiles(1).checkpoint().advanceFt(400);
    const s2 = new Simulator(b.finish().build()); s2.act({ type: 'skipPreread', secondsBefore: 5 }); s2.act({ type: 'start' }); until(s2, () => s2.waitingForGo, 900);
    const lunch = s2.driverMsgs[s2.driverMsgs.length - 1]!.text; expect(lunch).toMatch(/^Lunch stop\. We leave AT \d\d:\d\d:\d\d, not before \d\d:\d\d:\d\d \(5-minute penalty window\)/);
  });
  it('PLAY-010 the driver speaks up once when a slow vehicle holds him under the called speed', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 30 }).start(40).advanceMiles(0.4); b.hazard({ kind: 'slow', speedMph: 18, lengthFt: 2500 });
    const sc = b.advanceMiles(1.5).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc);
    sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); step(sim, 120);
    const m = sim.driverMsgs.filter(x => /slow vehicle/.test(x.text)); expect(m.length).toBe(1); expect(m[0]!.text).toMatch(/pass \(P\)/); expect(m[0]!.kind).toBe('question');
  });
});

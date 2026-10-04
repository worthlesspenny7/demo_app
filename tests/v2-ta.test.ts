import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { DRIVER_EXPERT, DEFAULT_RULES } from '../src/core/course.js';
import { scoreLeg } from '../src/core/scoring.js';
import { Simulator, validateAction, ACTION_LIST, ENGINE_VERSION } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { Session } from '../src/agent/protocol.js';
import { hms } from '../src/core/units.js';
import { stepUntil, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };

/** One timed leg with a train at 0.5 mi, its checkpoint 1.0 mi later, then End timed portion, the TA point and a transit to the finish. */
function trainStage(trainSeconds = 140, opts: { endOfStage?: boolean } = {}) {
  const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5);
  b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
  b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: trainSeconds });
  b.advanceMiles(1.0).checkpoint().advanceFt(500);
  b.endTimedPortion({ endOfStage: opts.endOfStage ?? true, transit: { exact: true, seconds: 1800 } }).advanceMiles(8).observationFinish();
  return b.build();
}
/** An oracle that drives and recovers nothing and never files by itself: the tests file by hand. */
function silentBot(sim: Simulator): OracleBot { const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {}; return bot; }
function runUntilWindow(sim: Simulator, bot: OracleBot): void { while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); } }
function runOut(sim: Simulator, bot: OracleBot): void { while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); } }

describe('Time Allowance (REG V.H)', () => {
  it('TA-001 a request is per leg with instruction numbers, in multiples of 10 s up to 29m30s; other amounts are rounded against the team and the adjustment is reported', () => {
    const sc = trainStage(); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim); runUntilWindow(sim, bot);
    const m = sim.taQualifying[1]!; expect(m).toBeGreaterThan(60);
    const lo = Math.floor(m / 10) * 10; const req = lo + 7;
    sim.act({ type: 'ta.request', legIndex: 1, seconds: req, fromLine: 2, toLine: 2, note: 'Delayed by a train at the crossing' });
    const rec = sim.taRequests[sim.taRequests.length - 1]!;
    expect(rec.status).toBe('filed'); expect(rec.adjusted % 10).toBe(0); expect(rec.adjusted).toBe(m < lo + 5 ? lo : lo + 10); expect(rec.adjustment).toMatch(/adjusted to/);
    expect(sim.observe().driver.messages.some(x => /adjusted to/.test(x.text))).toBe(true);
    expect(sim.taDeclared[1]).toBe(rec.adjusted); expect(rec.fromLine).toBe(2); expect(rec.note).toMatch(/train/);
    // the worked rule: a 1m17s request becomes 1m10s when the measured delay is below 1m15s, 1m20s otherwise
    const a = new Simulator(sc); a.act({ type: 'ta.request', legIndex: 1, seconds: 77, fromLine: 1, toLine: 1 }); expect(a.taRequests[0]!.status).toBe('refused'); // not at a TA point: refused, see TA-002
    // exact multiples are untouched; amounts above 29m30s, zero and nonsense line numbers are refused with the reason
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 1780, fromLine: 2, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.reason).toMatch(/exceed 29m30s/);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 0, fromLine: 2, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.status).toBe('refused');
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 5, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.reason).toMatch(/instruction numbers/);
    sim.act({ type: 'ta.request', legIndex: 7, seconds: 30, fromLine: 2, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.reason).toMatch(/Leg 7/);
    // ENG-011: one request per leg: a second filing for leg 1 is refused (it does not silently replace the first)
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 1770, fromLine: 1, toLine: 4 }); expect(sim.taRequests[sim.taRequests.length - 1]!.status).toBe('refused'); expect(sim.taRequests[sim.taRequests.length - 1]!.reason).toMatch(/already has a request/); expect(sim.taDeclared[1]).toBe(rec.adjusted);
    expect(sim.sc.rules.taMaxRequestSeconds).toBe(1770);
    expect(validateAction({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 1, toLine: 1 })).toBeNull(); expect(validateAction({ type: 'ta.request', seconds: 30 })).not.toBeNull();
    expect(ACTION_LIST).toEqual(expect.arrayContaining(['ta.request', 'scorecard.ack', 'speed.emergency', 'speed.resume', 'ta.declare']));
  });
  it('TA-001 rounding follows the measured delay exactly: 1m17s -> 1m10s below 1m15s of delay, 1m20s from 1m15s', () => {
    // two stages whose train leaves 72 s and 78 s of measured delay (found by search so the test states the rule, not the geometry)
    const find = (target: number) => { for (let d = 60; d < 200; d += 2) { const sim = new Simulator(trainStage(d)); const bot = silentBot(sim); startLikeOracle(sim); runUntilWindow(sim, bot); const q = sim.taQualifying[1] ?? 0; if (Math.abs(q - target) < 2) return d; } return null; };
    for (const [target, want] of [[72, 70], [78, 80]] as const) {
      const d = find(target); expect(d, `train for ${target}`).not.toBeNull();
      const sim = new Simulator(trainStage(d!)); const bot = silentBot(sim); startLikeOracle(sim); runUntilWindow(sim, bot);
      const q = sim.taQualifying[1]!; sim.act({ type: 'ta.request', legIndex: 1, seconds: 77, fromLine: 2, toLine: 2 });
      expect(sim.taRequests[0]!.adjusted, `measured ${q.toFixed(1)}`).toBe(q < 75 ? 70 : 80); expect(sim.taRequests[0]!.adjusted).toBe(want);
    }
  });

  it('TA-002 requests are accepted only inside the window of a printed TA point; elsewhere or after 15m00s they are refused with the reason; the end-of-stage point needs the scorecard', () => {
    const sc = trainStage(); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim);
    const taIns = sc.book.find(i => i.taPoint)!; expect(taIns.taPoint).toEqual({ windowSeconds: 900, endOfStage: true });
    expect(sc.book[sc.book.indexOf(taIns) - 1]!.endTimed).toBe(true); // the yellow box follows "End timed portion"
    expect(sim.observe().ta.hasTaPoints).toBe(true); expect(sim.observe().ta.windowOpen).toBe(false);
    sim.step(100); bot.onTick();
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2, toLine: 2 });
    expect(sim.taRequests[0]!.status).toBe('refused'); expect(sim.taRequests[0]!.reason).toMatch(/printed TA point/);
    sim.act({ type: 'scorecard.ack' }); expect(sim.scorecardAcked).toBe(false); expect(sim.observe().driver.messages.some(m => /scorecard is acknowledged at the end-of-stage TA point/.test(m.text))).toBe(true);
    runUntilWindow(sim, bot);
    const st = sim.observe().ta; expect(st.windowOpen).toBe(true); expect(st.endOfStage).toBe(true); expect(st.secondsLeft).toBeCloseTo(900, 0); expect(st.eligibleLegs).toEqual([1]);
    sim.step(300); expect(sim.observe().ta.secondsLeft).toBeCloseTo(600, 0);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2, toLine: 2 }); expect(sim.taRequests[sim.taRequests.length - 1]!.status).toBe('filed');
    sim.act({ type: 'scorecard.ack' }); expect(sim.scorecardAcked).toBe(true);
    sim.step(700); expect(sim.observe().ta.windowOpen).toBe(false);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 40, fromLine: 2, toLine: 2 }); const last = sim.taRequests[sim.taRequests.length - 1]!; expect(last.status).toBe('refused'); expect(last.reason).toMatch(/window.*closed/);
    expect(sim.taDeclared[1]).toBe(30); // the late request did not replace the filed one
    // a mid-stage TA point does not ask for the scorecard
    const mid = new Simulator(trainStage(140, { endOfStage: false })); const b2 = silentBot(mid); startLikeOracle(mid); runUntilWindow(mid, b2); expect(mid.observe().ta.endOfStage).toBe(false);
    // V.H.1 names only a train blockage and assisting at an accident: rules.taForSignals defaults to false and stays configurable
    expect(sim.sc.rules.taForSignals).toBe(false);
  });
  it('TA-002 the deprecated ta.declare maps to the current leg at a TA point and is refused elsewhere; books without any TA point keep the old anywhere-filing', () => {
    const sc = trainStage(); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim);
    sim.act({ type: 'ta.declare', seconds: 30 }); expect(sim.taRequests[0]!.status).toBe('refused');
    runUntilWindow(sim, bot); sim.act({ type: 'ta.declare', seconds: 40 });
    const r = sim.taRequests[sim.taRequests.length - 1]!; expect(r.status).toBe('filed'); expect(r.legIndex).toBe(1); expect(r.adjusted).toBe(40);
    const legacy = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const l = new Simulator(legacy); l.act({ type: 'ta.declare', seconds: 12, legIndex: 1 }); expect(l.taDeclared[1]).toBe(12); expect(l.observe().ta.hasTaPoints).toBe(false);
  });

  it('TA-003 credit = min(request, measured delay minus the 10 %-recoverable estimate), never making a leg early; an over-request by more than 10 s is flagged', () => {
    const sc = trainStage(); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim); runUntilWindow(sim, bot);
    const adv = sim.taAdvice(1);
    // the estimate is remaining distance / assigned speed x 0.1 at the end of the delay: ~1 mile at 35 mph = 103 s -> ~10 s
    expect(adv.recoverable).toBeGreaterThan(8); expect(adv.recoverable).toBeLessThan(13); expect(adv.possible).toBeCloseTo(adv.measuredDelay - adv.recoverable, 6);
    expect(adv.suggested).toBe(Math.floor(adv.possible / 10) * 10); expect(adv.fromLine).toBe(2);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: adv.suggested, fromLine: 2, toLine: 2 }); runOut(sim, bot);
    const l = sim.result().score.legs[0]!;
    expect(l.taCredit).toBe(adv.suggested); expect(l.error).toBe(l.rawError! - adv.suggested); expect(l.taOverDeclared).toBe(false); expect(l.taReason).toMatch(/^Allowed/);
    // asking for the whole measured delay plus a margin is flagged and capped
    const sim2 = new Simulator(sc); const b2 = silentBot(sim2); startLikeOracle(sim2); runUntilWindow(sim2, b2);
    const a2 = sim2.taAdvice(1); const big = Math.ceil((a2.measuredDelay + 30) / 10) * 10;
    sim2.act({ type: 'ta.request', legIndex: 1, seconds: big, fromLine: 2, toLine: 2 }); runOut(sim2, b2);
    const l2 = sim2.result().score.legs[0]!; expect(l2.taCredit).toBe(Math.floor(Math.min(a2.possible, l2.rawError!) / 10 + 1e-9) * 10);   // rounded DOWN to a multiple of 10 s (V.H.3, V.H.6) expect(l2.taOverDeclared).toBe(true); expect(l2.taReason).toMatch(/could have been made up/);
    // never early: a leg that was recovered after the train gets no credit beyond its lateness
    const sim3 = new Simulator(sc); const b3 = new OracleBot(sim3); (b3 as unknown as { declareTA: () => void }).declareTA = () => {}; startLikeOracle(sim3); runUntilWindow(sim3, b3);
    sim3.act({ type: 'ta.request', legIndex: 1, seconds: 600, fromLine: 2, toLine: 2 }); runOut(sim3, b3);
    const l3 = sim3.result().score.legs[0]!; expect(l3.taCredit).toBeLessThanOrEqual(Math.max(0, l3.rawError!)); expect(l3.error!).toBeGreaterThanOrEqual(l3.rawError! > 0 ? 0 : l3.rawError!);
  });
  it('TA-003 the oracle files at the TA point, rounded down to 10 s, and the committee credits it', () => {
    const sc = trainStage(); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { noRecovery: true }));
    expect(r.ta.requests.length).toBe(1); const q = r.ta.requests[0]!; expect(q.status).toBe('filed'); expect(q.adjusted % 10).toBe(0); expect(q.legIndex).toBe(1);
    expect(r.ta.scorecardAcked).toBe(true); expect(r.score.legs[0]!.taCredit).toBeGreaterThan(40);
    expect(r.engineVersion).toBe(ENGINE_VERSION);
  });

  it('TA-004 only trains, accident scenes, hazard-forced stops and declared emergency reduced speeds qualify; navigation errors, a slow vehicle and cross traffic never do', () => {
    // train: qualifies (above). accident scene: the delay accrues while the car is held to the scene speed
    const acc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4);
    acc.hazard({ kind: 'accident', speedMph: 10, lengthFt: 1500 });
    const sa = acc.advanceMiles(1.0).checkpoint().advanceFt(300).finish().build(); const a = new Simulator(sa); runBot(a, silentBot(a)); // silentBot: the oracle without a TA filing
    expect(a.taQualifying[1]!).toBeGreaterThan(55); expect(a.taQualifying[1]!).toBeLessThan(90); expect(a.taRecoverable[1] ?? 0).toBe(0); // legacy book (no TA point): no committee deduction
    // emergency reduced speed: declared, accrues while slow, stops at speed.resume
    const em = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(2.5).checkpoint().advanceFt(300).finish().build(); const e = new Simulator(em); startLikeOracle(e);
    stepUntil(e, () => e.car.s > 1500); expect(e.taQualifying[1] ?? 0).toBe(0);
    e.act({ type: 'speed.emergency', mph: 20 }); expect(e.observe().ta.emergency).toBe(true); e.step(60); const mid = e.taQualifying[1]!; expect(mid).toBeGreaterThan(20); expect(mid).toBeLessThan(40);
    e.act({ type: 'speed.resume' }); expect(e.observe().ta.emergency).toBe(false); e.step(40); const after = e.taQualifying[1]!; expect(after - mid).toBeLessThan(12); // only the ramp back up
    stepUntil(e, () => Math.abs(e.car.mph() - 35) < 0.5, 60); const settled = e.taQualifying[1]!; e.step(60); expect(e.taQualifying[1]).toBeCloseTo(settled, 1);
    // navigation errors never qualify
    const nav = new ScenarioBuilder({ startTime: T0, driver: quiet, excursionFt: 1500 }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', speed: 35 }).advanceMiles(0.7).checkpoint().advanceFt(300).finish().build();
    const n = new Simulator(nav); startLikeOracle(n); const nb = new OracleBot(n); let turned = false, uturned = false;
    while (n.phase !== 'finished') { nb.onTick(); if (!turned && n.car.s > 2300) { n.act({ type: 'call.turn', dir: 'R' }); turned = true; } if (n.offCourseCount > 0 && !uturned && n.observe({ peek: true }).driver.state === 'offcourse' && n.tod > (n.events.find(x => x.type === 'offCourse')?.tod ?? 0) + 20) { n.act({ type: 'call.uturn' }); uturned = true; } n.step(0.1); }
    expect(n.offCourseCount).toBe(1); expect(n.taQualifying[1] ?? 0).toBe(0); expect(n.result().attribution[0]!.buckets.offCourse).toBeGreaterThan(40);
    // a slow vehicle is "inability to hold the assigned speed": no qualifying delay
    const sv = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(40).advanceMiles(0.3); sv.hazard({ kind: 'slow', speedMph: 25, lengthFt: 3000 });
    const sl = new Simulator(sv.advanceMiles(1.2).checkpoint().advanceFt(300).finish().build()); runBot(sl, silentBot(sl)); expect(sl.taQualifying[1] ?? 0).toBe(0);
    // speed.emergency outside the running phase is ignored, and its parameters are validated
    expect(validateAction({ type: 'speed.emergency', mph: 2 })).not.toBeNull(); expect(validateAction({ type: 'speed.emergency', mph: 25 })).toBeNull();
  });
  it('TA-004 delays inside a transit, the warm-up or the calibration run never qualify', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4).transit({ exact: false, seconds: 900 }).advanceMiles(0.4);
    b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing' }, {}); b.hazard({ kind: 'train', startTod: T0 + 20, durationSeconds: 120 });
    const sc = b.advanceMiles(0.4).restart(35, T0 + 1200).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); runBot(sim, silentBot(sim)); expect(sim.events.some(e => e.type === 'wait' && e.detail?.reason === 'train')).toBe(true); expect(sim.taQualifying[1] ?? 0).toBe(0);
  });

  it('TA-005 the ledger suggests the request: measured delay minus the sim\'s own recovery estimate, rounded down to 10 s, with the instruction numbers, in the handbook wording', () => {
    const sim = new Simulator(trainStage()); const bot = silentBot(sim); startLikeOracle(sim); runUntilWindow(sim, bot);
    const adv = sim.taAdvice(1);
    expect(adv.measuredDelay).toBeGreaterThan(adv.possible); expect(adv.possible).toBeGreaterThan(0); expect(adv.suggested % 10).toBe(0); expect(adv.suggested).toBeLessThanOrEqual(adv.possible);
    const note = `Delayed ${Math.floor(adv.measuredDelay / 60)}m${String(Math.round(adv.measuredDelay % 60)).padStart(2, '0')}s by a train. Made up 0m00s. Request ${Math.floor(adv.suggested / 60)}m${String(adv.suggested % 60).padStart(2, '0')}s.`;
    expect(note).toMatch(/^Delayed \d+m\d\ds by a train\. Made up 0m00s\. Request \d+m\d0s\.$/);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: adv.suggested, fromLine: adv.fromLine!, toLine: adv.toLine!, note });
    expect(sim.taRequests[0]!.note).toBe(note); expect(sim.observe().ta.requests[0]!.adjusted).toBe(adv.suggested);
    expect(new Simulator(trainStage()).taAdvice(1)).toEqual({ legIndex: 1, measuredDelay: 0, recoverable: 0, possible: 0, suggested: 0, fromLine: null, toLine: null, stoppedSeconds: 0, chartLoss: 0, otherDelay: 0, measured: 0, makeUpToRound: 0, claim: 0, cause: null });
  });

  it('TA-006 slowing to 6 mph or more in sight of a Timing Checkpoint (to make a delay a multiple of 10 s) is not penalised; only stopping or 5 mph or less is', () => {
    const mk = () => new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.6).checkpoint('timing', 400).advanceFt(300).finish().build();
    const run = (mph: number) => { const sc = mk(); const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.car.s >= sc.checkpoints[0]!.s - 380); sim.act({ type: 'call.speed', mph }); stepUntil(sim, () => sim.records.length > 0, 200); return sim.records[0]!.sightViolation; };
    expect(run(6)).toBe(false); expect(run(10)).toBe(false); expect(run(4)).toBe(true);
  });

  it('TA-007 the committee credit is rounded DOWN to a multiple of 10 s (V.H.3, V.H.6): 47 s possible credits 40 s, never 45 or 47', () => {
    const leg = { index: 1, cpId: 'cp1', cpS: 1000, perfectTod: T0 + 600, perfectDuration: 600, anchor: { kind: 'official' as const, tod: T0 } };
    const at = (late: number, declared: number, qualifying: number, recoverable = 0) => scoreLeg({ leg, record: { cpId: 'cp1', kind: 'timing', actualTod: T0 + 600 + late, rawTod: T0 + 600 + late, sightViolation: false }, anchorActual: T0, taDeclared: declared, taQualifying: qualifying, taRecoverable: recoverable }, DEFAULT_RULES);
    expect(DEFAULT_RULES.taGranularitySeconds).toBe(10);
    const a = at(90, 50, 47); expect(a.taCredit).toBe(40); expect(a.error).toBe(50);
    expect(at(90, 70, 58, 13).taCredit).toBe(40);                 // 70 requested, 58 measured, 13 recoverable: 45 possible -> 40, as in D08b (was 45)
    expect(at(90, 80, 80).taCredit).toBe(80);                     // an exact multiple is credited whole
    expect(at(25, 50, 50).taCredit).toBe(20);                     // limited by the lateness (25 s) then rounded down
    for (const late of [33, 47, 61, 99]) expect(at(late, 60, 60).taCredit % 10).toBe(0);
  });
  it('TA-008 rules.taForSignals defaults to false (V.H.1 names only a train blockage and an accident): a red light adds no qualifying delay unless the knob is on', () => {
    const mk = (rules?: { taForSignals: boolean }) => { const b = new ScenarioBuilder({ startTime: T0, driver: quiet, rules }).start(35).advanceMiles(0.5);
      b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 40, greenSeconds: 50, offset: T0 + 51.4 - 20 });
      return b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build(); };
    expect(DEFAULT_RULES.taForSignals).toBe(false);
    const off = new Simulator(mk()); startLikeOracle(off); stepUntil(off, () => off.waitingForGo, 300); expect(off.waitReason).toBe('signal'); expect(off.taQualifying[1] ?? 0).toBe(0);
    const on = new Simulator(mk({ taForSignals: true })); startLikeOracle(on); stepUntil(on, () => on.waitingForGo, 300); expect(on.taQualifying[1]!).toBeGreaterThan(5);
  });

  it('TA-002 the agent protocol documents the new actions and carries the TA state in every observation', () => {
    const s = new Session(trainStage());
    const hello = s.handle({ type: 'hello' }); expect(hello.type).toBe('hello'); if (hello.type !== 'hello') return;
    expect(hello.actions.some(a => a.startsWith('ta.request{legIndex'))).toBe(true); expect(hello.actions).toContain('scorecard.ack'); expect(hello.actions.some(a => a.startsWith('speed.emergency'))).toBe(true); expect(hello.instructions).toMatch(/TA point/);
    const bad = s.handle({ type: 'act', action: { type: 'ta.request', legIndex: 1, seconds: 10 } as never }); expect(bad.type).toBe('error');
    const obs = s.handle({ type: 'observe' }); if (obs.type === 'observation') { expect(obs.observation.ta.hasTaPoints).toBe(true); expect(obs.observation.ta.windowOpen).toBe(false); }
  });
});

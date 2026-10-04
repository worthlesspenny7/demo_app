/** PT-09 area 8: protocol (Session.handle). untilEvent with readbacks and launches, scheduled actions in the pre-read, hidden-state redaction at rung <= 1 (and rungs 2-3 keep the data). */
import '../src/core/drills/index.js';
import { Session } from '../src/agent/protocol.js';
import { drillById } from '../src/core/drills/registry.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, LEGAL_AIDS, TRAINING_AIDS, type Scenario, type AidsConfig } from '../src/core/course.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { hms } from '../src/core/units.js';

const log = console.log; const issues: string[] = [];
const aids = (r: number): AidsConfig => r <= 1 ? { ...LEGAL_AIDS, rung: r } : { ...TRAINING_AIDS, rung: r };
const asp2 = (rung: number, preread = 300, asp = 2): Scenario => new ScenarioBuilder({ id: 'p9', name: 'p9', startTime: hms(8, 0, 0), asp, seed: 3, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE, aids: aids(rung), prereadSeconds: preread })
  .start(40).advanceMiles(1).stop('S', 35, { pause: 15 }).advanceMiles(1.5).stop('R', 35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
const adv = (s: Session, a: object) => s.handle({ type: 'advance', ...a } as never) as { type: string; seconds: number; stoppedOn: string | null; events: string[]; observation: any; message?: string };

// ---- 1. untilEvent in the pre-read: wakes 30 s before the launch, then at the launch, never past it
for (const rung of [0, 2]) {
  const s = new Session(asp2(rung), { watch: 'digital' }); const rows: string[] = []; let guard = 0; let pastLaunch = false;
  const launch0 = (s.sim.launchInfo()?.launchTime ?? 0);
  while (s.sim.phase === 'preread' && guard++ < 12) { const r = adv(s, { untilEvent: true, maxSeconds: 600 }); rows.push(`${r.seconds}s -> ${r.stoppedOn} toLaunch ${s.sim.launchInfo()?.secondsToLaunch?.toFixed(1)} tod ${r.observation.tod}`); if (s.sim.tod > launch0 + 0.15 && s.sim.phase === 'preread' && r.stoppedOn !== 'launch') pastLaunch = true; if (rows.length >= 4 && s.sim.phase === 'preread') { s.handle({ type: 'act', action: { type: 'start' } }); } }
  log(`rung ${rung} preread untilEvent: ${rows.join(' | ')}`); if (pastLaunch) issues.push(`rung ${rung}: an untilEvent advance ran past the launch time without a launch stop`);
}
// ---- 1b. drill-sized start (auto launch): the advance wakes on something; the auto-launched car is not silently lost
{
  const sc = drillById('D03')!.scenario(1, 0); const s = new Session(sc, { watch: 'digital' }); const rows: string[] = [];
  for (let i = 0; i < 6; i++) { const r = adv(s, { untilEvent: true, maxSeconds: 120 }); rows.push(`${r.seconds}s ${r.stoppedOn}`); }
  log('D03 untilEvent from the pre-read (auto launch):', rows.join(' | '), '| phase', s.sim.phase);
}
// ---- 1c. a restart hold (D16): launch stop at the hold; readbacks do not stop an advance
{
  const sc = drillById('D16')!.scenario(1, 1); const s = new Session(sc, { watch: 'digital' }); const stops: Record<string, number> = {}; let n = 0;
  while (s.sim.phase === 'preread') { const r0 = adv(s, { untilEvent: true, maxSeconds: 600 }); if (r0.stoppedOn === 'launch' && s.sim.tod >= sc.startTime - 6) s.handle({ type: 'act', action: { type: 'start' } }); }
  while (s.sim.phase === 'running' && n++ < 400) { const r = adv(s, { untilEvent: true, maxSeconds: 120 }); const k = (r.stoppedOn ?? 'none').replace(/driverMessage:.*/, 'driverMessage'); stops[k] = (stops[k] ?? 0) + 1; if (r.stoppedOn === 'launch') s.handle({ type: 'act', action: { type: 'call.go' } }); else if (r.stoppedOn === 'carStopped' && s.sim.waitingForGo && !s.sim.launchInfo()) s.handle({ type: 'act', action: { type: 'call.go' } }); if (r.seconds === 0 && stops['none']! > 50) break; }
  log('D16 stop reasons over a run:', JSON.stringify(stops), 'phase', s.sim.phase);
}
// ---- 1d. readbacks: a call.turn / call.speed readback ("Left ahead, got it") must not stop an untilEvent advance; an act's own events do not either
{
  const s = new Session(asp2(0, 10, 0), { watch: 'digital' }); s.handle({ type: 'act', action: { type: 'start' } }); adv(s, { seconds: 3 });
  s.handle({ type: 'act', action: { type: 'call.speed', mph: 41 } }); const r = adv(s, { untilEvent: true, maxSeconds: 5 });
  log('after a call.speed readback, untilEvent 5 s ->', r.seconds, 's, stoppedOn', r.stoppedOn, 'events', JSON.stringify(r.events)); if (r.seconds < 1 && r.stoppedOn !== 'driverMessage:At 41') issues.push(`a readback stopped an untilEvent advance after ${r.seconds}s (${r.stoppedOn})`);
}
// ---- 2. scheduled actions in the pre-read
{
  const sc = asp2(0, 120, 0); const s = new Session(sc, { watch: 'digital' });
  const a1 = s.handle({ type: 'act', action: { type: 'start' }, when: { elapsed: 100 } }) as any; const a2 = s.handle({ type: 'act', action: { type: 'note', text: 'hello' }, when: { elapsed: 5 } }) as any;
  const a3 = s.handle({ type: 'act', action: { type: 'watch.start' }, when: { event: 'carStarted' } }) as any; const a4 = s.handle({ type: 'act', action: { type: 'line.annotate', n: 1, text: 'x' } as never, when: { event: 'featureVisible' } }) as any;
  const a5 = s.handle({ type: 'act', action: { type: 'watch.lap' }, when: { watchReads: 0 } }) as any;
  log('scheduled acks', a1.type, a1.scheduled, a2.scheduled, a3.scheduled, a4.scheduled, a5.scheduled);
  const r1 = adv(s, { seconds: 10 }) as any; log(' after 10 s of pre-read: scheduledFired', JSON.stringify(r1.scheduledFired), 'phase', s.sim.phase, 'actions', s.sim.actions.map(a => `${a.action.type}@${(a.tick / 10).toFixed(1)}`).join(','));
  if (r1.scheduledFired.includes('watch.lap')) issues.push('scheduled { watchReads: 0 } fires in the first tick of the pre-read (watch not started)');
  if (r1.scheduledFired.includes('line.annotate')) issues.push('scheduled { event: featureVisible } fires in the first tick of the pre-read for a feature that is simply the first thing on the road (no label filter)');
  const r2 = adv(s, { seconds: 100 }) as any; log(' after 110 s: fired', JSON.stringify(r2.scheduledFired), 'phase', s.sim.phase, 'tod', s.sim.tod, 'start', sc.startTime);
  const startAct = s.sim.actions.find(a => a.action.type === 'start'); log(' start executed at tod', startAct ? (sc.startTime - sc.prereadSeconds + startAct.tick / 10).toFixed(1) : 'never', '(armed at pre-read tod', sc.startTime - sc.prereadSeconds, '+ 100 s)');
  // scheduled call.warn / pullUp before a launch, cancel
  const s2 = new Session(asp2(0, 300, 2), { watch: 'digital' }); const w = s2.handle({ type: 'act', action: { type: 'call.warn', seconds: 30 }, when: { elapsed: 250 } }) as any; const c = s2.handle({ type: 'cancel' }) as any; log('schedule + cancel ->', w.scheduled, c.type, c.count);
  const bad = s2.handle({ type: 'act', action: { type: 'call.go' }, when: { elapsed: -1 } as never }) as any; const bad2 = s2.handle({ type: 'act', action: { type: 'call.go' }, when: { elapsed: 1, event: 'carStopped' } as never }) as any;
  log('bad when: elapsed -1 ->', bad.type, '| elapsed + event ->', bad2.type, bad2.message ?? bad2.scheduled);
}
// ---- 3. redaction: every fractional number in observation at rung 0, 1, 2, 3 (running car, ambiguous clock, asp start queue)
function fractional(o: unknown, path = '', out: string[] = []): string[] { if (typeof o === 'number') { if (!Number.isInteger(o)) out.push(`${path}=${o}`); } else if (Array.isArray(o)) o.slice(0, 3).forEach((x, i) => fractional(x, `${path}[${i}]`, out)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) fractional(v, `${path}.${k}`, out); return out; }
const present: Record<number, Record<string, unknown>> = {};
for (const rung of [0, 1, 2, 3]) {
  const sc = asp2(rung, 300, 3); const s = new Session(sc, { watch: 'digital' });
  adv(s, { seconds: 120 }); const pre = (s.handle({ type: 'observe' }) as any).observation;
  s.handle({ type: 'act', action: { type: 'start' } }); adv(s, { seconds: 30.35 });
  // put the clock at an ambiguous second: advance until tod % 60 ~ 57
  let guard = 0; while (guard++ < 700 && !((s.sim.tod % 60) > 56 && (s.sim.tod % 60) < 58)) s.sim.step(0.1);
  const run = (s.handle({ type: 'observe' }) as any).observation;
  const preFrac = fractional(pre).filter(x => !/Angle|angle|\.s=|distanceFt|\.v=|mph|speed|stopwatch|aids|dist|ft|Ft|car\./i.test(x)); const runFrac = fractional(run).filter(x => !/Angle|angle|distanceFt|\.v=|mph|speed|stopwatch|dist|ft|Ft|car\./i.test(x));
  log(`rung ${rung} pre-read observation fractional fields: ${preFrac.join(' ') || 'none'}`); log(`rung ${rung} running observation fractional fields: ${runFrac.join(' ') || 'none'}`);
  present[rung] = { launch: pre.launch, tod: pre.tod, secondsToStart: pre.secondsToStart, paceCarsBehindErr: pre.paceCars?.behind?.errorSeconds, queueLeaves: pre.startQueue?.carAheadLeavesTod, hourAngle: run.clock.hourAngle, minute: run.clock.minute, amb: run.clock.minuteAmbiguous, nextCall: run.nextCall, ta: run.ta ? Object.keys(run.ta).length : null };
  if (rung <= 1) {
    if (!Number.isInteger(pre.tod) || !Number.isInteger(run.tod)) issues.push(`rung ${rung}: observation.tod is fractional (${run.tod})`);
    if (pre.launch !== null) issues.push(`rung ${rung}: launch present`);
    if (pre.paceCars?.behind && pre.paceCars.behind.errorSeconds !== undefined) issues.push(`rung ${rung}: pace-car errorSeconds exposed before the finish`);
    if (pre.startQueue && (pre.startQueue.carAheadLeavesTod !== null)) issues.push(`rung ${rung}: carAheadLeavesTod exposed`);
    if (run.clock.minuteAmbiguous && Math.abs(run.clock.hourAngle * 2 - Math.round(run.clock.hourAngle * 2 / 5) * 5) > 0.001 && Math.floor(run.clock.hourAngle / 2.5) * 2.5 !== run.clock.hourAngle) issues.push(`rung ${rung}: hourAngle not coarse while ambiguous`);
  } else {
    if (pre.launch === null) issues.push(`rung ${rung}: launch missing (rungs 2-3 should still get it)`);
    if (!(pre.paceCars?.behind || pre.paceCars?.ahead)) log(`  note: rung ${rung} pre-read has no paceCars in sight (not necessarily a bug)`);
    if (Number.isInteger(run.tod)) log(`  note: rung ${rung} tod integer by chance (${run.tod})`);
  }
}
log('presence by rung:', JSON.stringify(present));
// fields that survive the redaction at rung 0 and still reveal hidden state
{
  const sc = asp2(0, 300, 3); const s = new Session(sc, { watch: 'digital' }); adv(s, { seconds: 200 }); const o = (s.handle({ type: 'observe' }) as any).observation;
  const keys = Object.keys(o); log('rung 0 observation keys:', keys.join(','));
  log('  startQueue.cars sample:', JSON.stringify(o.startQueue?.cars?.[0] ?? null), '| paceCars', JSON.stringify(o.paceCars), '| ahead[0]', JSON.stringify(o.ahead?.[0] ?? null).slice(0, 200));
  const t = s.handle({ type: 'truth' }) as any; log('  Session truth request at rung 0:', JSON.stringify(t));
  const rr = s.handle({ type: 'result' }) as any; log('  Session result request mid-pre-read at rung 0: type', rr.type, 'legs perfectTod', JSON.stringify(rr.result?.score?.legs?.map((l: any) => l.perfectTod)), 'events', rr.result?.events?.length);
  if (t.type === 'truth') issues.push('Session `truth` request returns exact pace / car position at every aids rung (the rung <= 1 redaction is moot for a caller that asks)');
  if (rr.type === 'result' && rr.result?.score?.legs?.[0]?.perfectTod) issues.push('Session `result` request is allowed mid-run and returns perfect times, attribution and events at rung 0');
  const h = s.handle({ type: 'hello' }) as any; log('  hello keys:', Object.keys(h).join(','), '| actions has truth/result?', h.actions.filter((a: string) => /truth|result/.test(a)).join(',') || 'neither (not advertised)', '| instructions mention truth?', /truth/i.test(h.instructions));
}
log('ISSUES', issues.length); log(issues.join('\n'));

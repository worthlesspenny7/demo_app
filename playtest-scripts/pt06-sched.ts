/** PT-06 protocol: scheduled go on carStopped (PT-01 BUG 1 regression) and scheduling before the start. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Session } from '../src/agent/protocol.js';
import { log } from './pt06-common.js';
{ const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' }); s.handle({ type: 'act', action: { type: 'start' } }); s.handle({ type: 'act', action: { type: 'call.turn', dir: 'S' } });
  s.handle({ type: 'act', action: { type: 'call.go' }, when: { event: 'carStopped' } });
  const out: string[] = []; for (let i = 0; i < 6; i++) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 120 }) as any; out.push(`${r.seconds}s ${r.stoppedOn} fired=${JSON.stringify(r.scheduledFired)} msgs=${r.observation.driver.messages.map((m: any) => m.text).join('/')}`); }
  log(out.join('\n')); }
{ // schedule go on carStopped BEFORE start: it departs the car in the preread
  const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' });
  s.handle({ type: 'act', action: { type: 'call.go' }, when: { event: 'carStopped' } }); const r = s.handle({ type: 'advance', seconds: 1 }) as any;
  log('go scheduled on carStopped in the preread:', 'fired', JSON.stringify(r.scheduledFired), 'phase', r.observation.phase, 'tod', r.observation.tod); }

{ // malformed `when` is accepted and silently never fires; the schedule list is unbounded
  const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' });
  const r1 = s.handle({ type: 'act', action: { type: 'call.speed', mph: 30 }, when: { elapsed: 'x' as never } }); const r2 = s.handle({ type: 'act', action: { type: 'call.speed', mph: 30 }, when: { event: 'bogus' as never } });
  log('when {elapsed:"x"} ->', r1.type, (r1 as any).scheduled, '| when {event:"bogus"} ->', r2.type, (r2 as any).scheduled);
  let n = 0; for (let i = 0; i < 20000; i++) { const r = s.handle({ type: 'act', action: { type: 'note', text: 'x' }, when: { elapsed: 1e9 } }); if (r.type === 'ack') n++; } log('scheduled actions accepted without a cap:', n); }

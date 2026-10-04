/** PT-06 area 1/protocol: events logged by act() are not consumed by the ack, so the next advance{untilEvent} stops on them after 0.1 s. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Session } from '../src/agent/protocol.js';
import { log } from './pt06-common.js';
const s = new Session(builtinScenario('onestop', 1), { watch: 'digital' });
s.handle({ type: 'act', action: { type: 'start' } });
s.handle({ type: 'act', action: { type: 'call.turn', dir: 'S' } });
for (let i = 0; i < 6; i++) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 }) as any; log('advance', i, r.seconds, r.stoppedOn, JSON.stringify(r.events)); if (r.observation.carStopped && r.observation.driver.waitingForGo) break; }
const a = s.handle({ type: 'act', action: { type: 'call.go' } }) as any; log('call.go ack messages:', JSON.stringify(a.observation.driver.messages.map((m: any) => m.text)));
const r2 = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 }) as any; log('next advance:', r2.seconds, r2.stoppedOn, JSON.stringify(r2.events));

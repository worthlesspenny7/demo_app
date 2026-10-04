/** PT-06 protocol: advance {seconds, untilEvent:true} ignores `seconds` (uses maxSeconds, default 120); advance {seconds: 0.05} overruns to 0.1. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Session } from '../src/agent/protocol.js';
const s = new Session(builtinScenario('straight', 1), { watch: 'digital' }); s.handle({ type: 'act', action: { type: 'start' } }); s.handle({ type: 'advance', seconds: 5 });
const a = s.handle({ type: 'advance', seconds: 10, untilEvent: true }) as any; console.log('advance {seconds:10, untilEvent:true} ->', a.seconds, 's, stoppedOn', a.stoppedOn);
const b = s.handle({ type: 'advance', seconds: 0.05 }) as any; console.log('advance {seconds:0.05} ->', b.seconds);
const c = s.handle({ type: 'advance', seconds: 10, untilEvent: true }) as any; console.log('quiet stretch: advance {seconds:10, untilEvent:true} ->', c.seconds, 's, stoppedOn', c.stoppedOn);

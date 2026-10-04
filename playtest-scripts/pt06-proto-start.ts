/** PT-06 area 1 via the JSON protocol: untilEvent in the preread does not stop at the driver's "Give me about 30 seconds" prompt (kind readback), and runs past the launch time. */
import { simpleStart, log } from './pt06-common.js';
import { Session } from '../src/agent/protocol.js';
const sc = simpleStart(2, 0, 4, 300);
const s = new Session(sc, { watch: 'digital' });
const h = s.handle({ type: 'hello' }) as any; log('hello.actions includes pullUp/call.warn/count:', ['pullUp', 'call.warn', 'count', 'call.identify', 'ledger.set', 'ta.request', 'scorecard.ack'].map(a => `${a}=${h.actions.some((x: string) => x.startsWith(a))}`).join(' '));
const r1 = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 600 }) as any;
log('preread untilEvent 600:', JSON.stringify({ seconds: r1.seconds, stoppedOn: r1.stoppedOn, events: r1.events, tod: r1.observation.tod, secondsToStart: r1.observation.secondsToStart, phase: r1.observation.phase, launch: r1.observation.launch && { launchTime: r1.observation.launch.launchTime, secondsToLaunch: r1.observation.launch.secondsToLaunch } }));
log('driver messages:', r1.observation.driver.messages.map((m: any) => `${m.kind}:${m.text}`).join(' | '));

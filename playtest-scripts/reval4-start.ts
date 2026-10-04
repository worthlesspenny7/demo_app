/** V4 realism: start / restart procedure (position 1 = base+1, nobody releases you, launch early by the net loss, 30 s warning, count, pull-up refusal). */
import { Simulator } from '../src/core/sim.js';
import { registerAll } from './v2-reg.js';
import { allDrills } from '../src/core/drills/registry.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
await registerAll();
const hms = (t: number) => { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return `${h}:${String(m).padStart(2,'0')}:${s.toFixed(1).padStart(4,'0')}`; };
const d16 = allDrills().find(d => d.id === 'D16')!;
for (const asp of [1, 27, 42]) {
  const sc = generateStage(3, { ...PROFILES.fullStage, asp } as any);
  console.log(`== generated stage asp=${asp}: base ${hms(sc.baseStartTime ?? 0)} start ${hms(sc.startTime)} -> position ${asp} = base+${(sc.startTime - (sc.baseStartTime ?? 0)) / 60} min`);
}
const sc = d16.scenario(1, 1);
console.log('D16 asp', sc.asp, 'base', hms(sc.baseStartTime ?? 0), 'start', hms(sc.startTime), 'rung', sc.aids.rung, 'startProcedure', (sc as any).startProcedure);
const sim = new Simulator(sc, { watch: 'digital' });
const o0 = sim.observe();
console.log('preread: secondsToStart', o0.secondsToStart.toFixed(0), 'launch', JSON.stringify(o0.launch), 'queue', JSON.stringify(o0.startQueue)?.slice(0, 400), 'pace', JSON.stringify(o0.paceCars));
// try pull up too early
const step = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.1) sim.step(0.1); };
const li = o0.launch!;
console.log('own', hms(li.ownTime), 'netLoss', li.netLoss.toFixed(2), 'launch', hms(li.launchTime), 'speed', li.speed, 'ownTime-launch', (li.ownTime - li.launchTime).toFixed(2));
// advance to 60s before launch; try pullUp while car ahead at sign
step(li.launchTime - sim.tod - 90);
let o = sim.observe(); console.log('t', hms(sim.tod), 'carAheadAtSign', o.startQueue?.carAheadAtSign, 'leaves', o.startQueue?.carAheadLeavesTod && hms(o.startQueue.carAheadLeavesTod), 'pulledUp', o.startQueue?.pulledUp, 'cars', o.startQueue?.cars.length);
try { const r = sim.act({ type: 'pullUp' } as any); console.log('pullUp early ->', JSON.stringify(r)); } catch (e) { console.log('pullUp early threw', String(e)); }
o = sim.observe(); console.log('after pullUp attempt pulledUp', o.startQueue?.pulledUp);
// wait for car ahead to leave
let guard = 0; while (sim.observe().startQueue?.carAheadAtSign && guard++ < 4000) sim.step(0.1);
o = sim.observe(); console.log('car ahead gone at', hms(sim.tod), 'own minus now', (li.ownTime - sim.tod).toFixed(1));
console.log('pullUp ->', JSON.stringify(sim.act({ type: 'pullUp' } as any))); console.log('pulledUp', sim.observe().startQueue?.pulledUp);
// warn 30 s before launch
step(li.launchTime - 30 - sim.tod);
console.log('warn ->', JSON.stringify(sim.act({ type: 'call.warn' } as any)), 'driver msgs', JSON.stringify(sim.observe().driver.messages.slice(-3).map(m => m.text)));
// count 10..1 landing on launch
for (let k = 10; k >= 1; k--) { step(li.launchTime - k - sim.tod); sim.act({ type: 'count', n: k } as any); }
step(li.launchTime - sim.tod); sim.act({ type: 'start' } as any);
console.log('driver log', JSON.stringify(sim.observe().driver.messages.slice(-14).map(m => `${(m.tod-li.launchTime).toFixed(0)}:${m.text}`)));
step(60);
const r = sim.result(); console.log('startDeltas', JSON.stringify(r.startDeltas[0]), 'findings', JSON.stringify(r.findings));
// launch EARLY by net loss: car crosses start at own time? find the ghost vs car time at 0.1 mi

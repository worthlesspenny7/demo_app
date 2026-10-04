/** PT-06 protocol: what observe() hands an agent at aids rung 0 (Great Race legal) that the UI keeps hidden or that INST-001/START-002 say is withheld. */
import { simpleStart, Simulator, adv, log } from './pt06-common.js';
const sc = simpleStart(3, 0, 5, 90); const sim = new Simulator(sc, { watch: 'digital' });
const o = sim.observe({ peek: true });
log('rung', sc.aids.rung, '| tod (fractional seconds)', o.tod, '| launch', JSON.stringify(o.launch && { launchTime: o.launch.launchTime, netLoss: o.launch.netLoss }), '| startQueue car ahead leaves at', o.startQueue?.carAheadLeavesTod, 'sitting flags', JSON.stringify(o.startQueue?.cars.map(c => c.sitting)));
sim.act({ type: "start" }); adv(sim, 25);
const p = sim.observe({ peek: true });
log('paceCars errorSeconds (the hidden seeded error of the car one minute away):', JSON.stringify(p.paceCars));
sim.step(0.3); const c = sim.observe({ peek: true }).clock; log('clock at a minute change (ambiguous window):', JSON.stringify(c), '-> hourAngle alone encodes the time of day to the second:', ((c.hourAngle / 30) * 3600).toFixed(1), 's past 12:00 vs tod', (sim.tod % 43200).toFixed(1));

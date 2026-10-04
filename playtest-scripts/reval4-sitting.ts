import { registerAll } from './v2-reg.js';
import { allDrills } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
await registerAll();
const d16 = allDrills().find(d => d.id === 'D16')!;
let found = 0;
for (let seed = 1; seed <= 40 && found < 3; seed++) {
  const sc = d16.scenario(seed, 1); const sim = new Simulator(sc, { watch: 'digital' });
  const q = sim.observe().startQueue; if (!q) continue;
  if (q.cars.some(c => c.sitting)) { found++; console.log('seed', seed, JSON.stringify(q.cars.map(c => ({ pos: c.position, rel: c.relative, leaves: c.leavesTod, sitting: c.sitting })))); 
    // step to just after the car ahead's scheduled minute and try pullUp
    const ahead = q.cars.find(c => c.relative === 'ahead' && c.sitting)!;
    while (sim.tod < ahead.leavesTod + 5) sim.step(0.1);
    const o = sim.observe(); console.log('  at', (sim.tod - ahead.leavesTod).toFixed(0), 's after its minute: carAheadAtSign', o.startQueue?.carAheadAtSign, 'driver says', JSON.stringify(o.driver.messages.slice(-2).map(m => m.text)));
    sim.act({ type: 'pullUp' } as any); console.log('  pullUp ->', sim.observe().startQueue?.pulledUp, 'driver:', JSON.stringify(sim.observe({peek:true}).driver.messages.slice(-1).map(m=>m.text)));
  }
}
console.log('seeds with a sitting car found:', found);

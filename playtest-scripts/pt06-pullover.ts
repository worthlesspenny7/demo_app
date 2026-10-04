/** PT-06: call.pullover has no undo: after "Pulling over", call.go releases the wait but the driver stays pulled over for the rest of the stage. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator, until, adv, log } from './pt06-common.js';
const sc = builtinScenario('straight', 1); const sim = new Simulator(sc, { watch: 'digital' });
sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); adv(sim, 20);
sim.act({ type: 'call.pullover' }); until(sim, () => sim.car.v === 0, 60); adv(sim, 5);
log('after pullover: waiting', sim.waitingForGo, sim.waitReason, 'v', sim.car.v);
sim.act({ type: 'call.go' }); adv(sim, 30);
log('30 s after call.go: waiting', sim.waitingForGo, sim.waitReason, 'v', sim.car.mph().toFixed(1), 'target', sim.targetIndicated, 'driver:', sim.observe({ peek: true }).driver.messages.slice(-3).map(m => m.text));
sim.act({ type: 'call.speed', mph: 30 }); adv(sim, 30); log('after call.speed 30: v', sim.car.mph().toFixed(1), 'waiting', sim.waitingForGo);

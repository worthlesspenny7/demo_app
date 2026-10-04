/** PT-06 area 1: a call.go sent while the car is at v = 0 but NOT waiting at a node (the first instant after `start`, behind a school bus) sets goRequestedEarly and is kept until the next stop, where the driver then leaves with no dwell. */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator, until, log } from './pt06-common.js';
function run(label: string, premature: boolean) {
  const sc = builtinScenario('onestop', 1); const sim = new Simulator(sc, { watch: 'digital' });
  sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); if (premature) sim.act({ type: 'call.go' });   // "go" in the same instant as "start": the car is still at v = 0
  sim.act({ type: 'call.turn', dir: 'S' });
  until(sim, () => sim.waitingForGo || sim.phase === 'finished', 400);
  const w = sim.events.find(e => e.type === 'wait'); const rel = sim.events.find(e => e.type === 'release' && e.tod >= (w?.tod ?? 0));
  log(`${label}: stopped at ${w?.tod.toFixed(1)} waitingForGo ${sim.waitingForGo}; released ${rel ? (rel.tod - w!.tod).toFixed(1) + ' s after stopping' : 'not yet (waiting for the navigator)'}`);
}
run('no premature go', false); run('premature go right after start', true);

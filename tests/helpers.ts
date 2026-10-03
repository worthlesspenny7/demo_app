import { Simulator, type Action } from '../src/core/sim.js';
import type { Scenario } from '../src/core/course.js';
import { nodeById } from '../src/core/course.js';
import { accelLoss } from '../src/core/perf-table.js';

export const DT = 0.1;

/** Step until predicate true or timeout (sim seconds). Returns elapsed sim seconds. */
export function stepUntil(sim: Simulator, pred: () => boolean, maxSeconds = 3600): number {
  let t = 0;
  while (!pred() && t < maxSeconds) { sim.step(DT); t += DT; }
  return t;
}
export function runToEnd(sim: Simulator, maxSeconds = 7200): void { stepUntil(sim, () => sim.phase === 'finished', maxSeconds); }
export function nodeS(sc: Scenario, nodeId: string): number { return nodeById(sc.course, nodeId).s; }
export function startAtOfficialTime(sim: Simulator): void { stepUntil(sim, () => sim.tod >= sim.sc.startTime); sim.act({ type: 'start' }); }
/** Depart early by the standstill acceleration loss so the first leg starts "on the ghost". */
export function startLikeOracle(sim: Simulator): void {
  const v = sim.sc.book[0]!.speed!;
  const lead = accelLoss(v, sim.sc.car);
  if (sim.tod > sim.sc.startTime - lead) sim.tod = sim.sc.startTime - lead; else stepUntil(sim, () => sim.tod >= sim.sc.startTime - lead);
  sim.act({ type: 'start' });
}
export const act = (sim: Simulator, a: Action) => sim.act(a);

/** Test helpers for the V2 drills: a clock-reading oracle and small action patches. */
import { Simulator, type Action } from '../src/core/sim.js';
import type { Scenario } from '../src/core/course.js';
import { OracleBot, type OracleOptions } from '../src/agent/bots.js';

export interface RunOpts { clock?: boolean; hook?: (sim: Simulator, bot: OracleBot) => void; maxTod?: number; sim?: Simulator }

/** Run the oracle to the end. `clock` (default true) reads the clock every 20 s like a navigator who keeps the time of day on the dash clock (WATCH-009). */
export function runOracle(sc: Scenario, o: OracleOptions = { useWatch: true }, ro: RunOpts = {}): { sim: Simulator; r: ReturnType<Simulator['result']> } {
  const sim = ro.sim ?? new Simulator(sc); const bot = new OracleBot(sim, o); let last = -1e9;
  while (sim.phase !== 'finished' && sim.tod < (ro.maxTod ?? 86400)) {
    if ((ro.clock ?? true) && sim.tod - last >= 20) { sim.act({ type: 'clock.read' }); last = sim.tod; }
    bot.onTick(); ro.hook?.(sim, bot); sim.step(0.1);
  }
  return { sim, r: sim.result() };
}

/** Intercept actions on one simulator: return null to drop, an action to replace, or undefined to pass through. */
export function patchAct(sim: Simulator, fn: (a: Action) => Action | null | undefined): void {
  const orig = sim.act.bind(sim);
  (sim as unknown as { act: (a: Action) => void }).act = (a: Action) => { const b = fn(a); if (b === null) return; orig(b ?? a); };
}

/** Delay the navigator's `go` at the hold on book line `line` by `seconds` (a late restart / OUT). */
export function delayGoAtLine(sim: Simulator, line: number, seconds: number): (s: Simulator) => void {
  const orig = sim.act.bind(sim); let due: number | null = null;
  patchAct(sim, a => { if (a.type === 'call.go' && sim.waitingForGo && sim.observe({ peek: true }).stoppedAtLine === line) { if (due === null) due = sim.tod + seconds; return null; } return undefined; });
  return s => { if (due !== null && s.tod >= due) { due = Infinity; orig({ type: 'call.go' }); } };
}

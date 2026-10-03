# Core engine API (stable surface for UI and agents) - keep in sync with src/core/sim.ts

```ts
import { Simulator, type Action, type Observation, type StageResult } from './core/sim.js';
const sim = new Simulator(scenario, { watch: 'analog' | 'digital', useCard?: boolean });
sim.step(dtSeconds);     // integrates in fixed 0.1 s ticks; safe to pass any dt
sim.observe();           // Observation: what the navigator can see (no hidden positions)
sim.act(action);         // Action union: watch.*, bezel.set, call.speed/turn/stop/go/uturn/pass/pullover,
                         //   line.set, note, ta.declare, speedo.setFactor, card.set, start, skipPreread
sim.phase;               // 'preread' | 'running' | 'finished'
sim.result();            // StageResult: score (legs, raw, ageFactor, score, aces), records, attribution, events
sim.pace();              // TRUTH: seconds late(+)/early(-) now; UI may show only when aids.paceBar
```
Scenarios: `ScenarioBuilder` in src/core/builder.ts (start/stop/speedAtSign/timedAt/checkpoint/restart/finish/hazard).
Ghost: `buildGhost(scenario)`, `ghostTimeAt(table, s)` (truth; debrief only).
Perf table: `stopLoss(vIn,vOut,car)`, `accelLoss(vOut,car)`, `rampLead(v1,v2,car)`, `dwellFor(pause,vIn,vOut,car)`, `buildPerfTable(car)`.
Drills: `src/core/drills/types.ts` (Drill, Rubric, DrillTier), registry in `src/core/drills/registry.ts`.
Generator: `generateLeg(seed, profile)` / `generateStage(seed, profile)` in src/core/generator/generate.ts (`PROFILES` presets: pauseDrill, timedDrill, landmarkDrill, calibration, recovery, fullLeg, combo, fullStage; `GenProfile` knobs legs/cpCount, lineDensity, trapDensity, signals, trains, slowTraffic, calibration, lunchRestart, noPauseTraps, mix). Output passes `validateScenario` and `checkRouteExits`; `scenario.tags` carries truth flags (`trap:<id>:<n>`, `trap:missingPause:<n>`, `cp:cpN:afterManeuver:<kind>`, `train:<n>:hit|miss`).
Traps: `TRAPS`, `trapById`, `trapToNodeSpec(card, {speed})`, `trapDistractorBefore(card, rng)`, `trapCameo(card)` (SVG string), `mainRoadExit`, `exitForCallout`, `turnBand` in src/core/generator/traps.ts.

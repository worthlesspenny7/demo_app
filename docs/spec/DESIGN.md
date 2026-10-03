# DESIGN - Rally Trainer

Status: v1 design, 2026-10-03. Implements docs/spec/REQUIREMENTS.md.
Numbered testable specs live in docs/spec/SPECS.md; this file explains the
architecture and the models.

## 1. Architecture

```
src/core/        pure TypeScript, no DOM, deterministic given a seed
  units.ts        mph<->ft/s, time formatting, rounding rules
  rng.ts          seeded PRNG (mulberry32) so every scenario replays exactly
  course.ts       Course/Node/Instruction types + validation
  ghost.ts        perfect-time integrator (the "ghost car")
  car.ts          physical car: accel/decel limits, speed holding
  speedo.ts       speedometer models (timewise | mechanical) + inverse
  driver.ts       AI driver: executes callouts, obeys controls, asks at Ts
  stopwatch.ts    one stopwatch (analog or digital) + analog clock w/ bezel
  hazards.ts      signals, trains, slow vehicles
  sim.ts          Simulator: world state, step(dt), observe(), act()
  scoring.ts      checkpoint errors, leg reset, age factor, penalties
  attribution.ts  decomposes lost seconds by cause for the debrief
  perf-table.ts   car performance table math (losses, lead times)
  calibration.ts  calibration-run math (k = P/A, cheat card)
  generator/      procedural scenario generator + trap library (data)
  drills/         drill definitions: scenario template + rubric
src/agent/       CLI + JSON-lines protocol + scripted bots
src/ui/          Vite app: screens, canvas instruments, GRIID book, road view
content/         hand-authored scenarios (JSON), trap library, lessons
tests/           vitest; test names carry spec ids, e.g. "GHOST-003 ..."
scripts/         spec:check (every spec id has a test), playtest runners
```

Layering rule: `src/ui` and `src/agent` import `src/core`; `src/core`
imports nothing outside itself. The Simulator is a plain state machine:
`new Simulator(scenario, options)`, `sim.step(dtSeconds)`, `sim.observe()`,
`sim.act(action)`, `sim.result()`. The UI drives it with requestAnimationFrame
at a chosen time scale; agents drive it with explicit steps.

## 2. Units and conventions
- Internal distance: feet. Internal speed: ft/s (1 mph = 1.466667 ft/s).
  Instructions and the speedometer use mph.
- Internal time: seconds since midnight (time of day, "TOD"), float.
  Checkpoint times are rounded to the nearest whole second (R1.7).
- Positions along the route: arc length `s` in feet from the stage start.
- Headings are only needed for CAMEO rendering; the course is 1-D.

## 3. Course model (hidden truth) and the book (visible)

```ts
type Surface = 'paved' | 'gravel';
type ExitKind = 'road' | 'driveway' | 'lot' | 'deadend' | 'private';
interface Exit { angle: number; surface: Surface; kind: ExitKind; name?: string;
                 controlFacingUs?: Control; isRoute: boolean }
type Control = 'STOP' | 'YIELD' | 'SIGNAL' | 'BLINKER' | 'RR' | 'none';
interface Node {
  id: string; s: number;                 // hidden position (ft)
  kind: 'intersection' | 'sign' | 'landmark' | 'start' | 'finish';
  control: Control;                      // what controls OUR approach
  exits?: Exit[];                        // intersections; angle 0 = straight
  sign?: { text: string; shape: 'octagon'|'triangle'|'rect'|'diamond'|'blade'|'shield'; side: 'L'|'R' };
  sightDistance: number;                 // ft before s at which it becomes visible
  stopLineOffset?: number;               // ft before s where a stop happens (default 0)
}
interface Instruction {
  n: number; nodeId: string;             // anchor
  text: string;                          // "Right at STOP", "Speed 35", ...
  cameo?: Cameo;                         // derived from node for rendering
  section?: 'warmup'|'calibration'|'start'|'transit'|'freezone'|'lunch'|'refuel'|'pit'|'finish'|'restart';
  turn?: 'L'|'R'|'S'|'BL'|'BR'|'AL'|'AR'|'JL'|'JR';
  speed?: number;                        // assigned speed from this point (mph)
  pause?: number;                        // seconds added to the leg
  timed?: { holdSpeed: number; seconds: number; thenSpeed: number };
  perfectInterval?: number; perfectCumulative?: number;  // calibration run
  hint?: string;                         // Column D
  restartTime?: number;                  // TOD for start/restart lines
}
interface Checkpoint { id: string; s: number; kind: 'timing'|'observation'; sightDistance: number }
interface Hazard { s: number; kind: 'signal'|'train'|'slow'|'construction'; ... }
interface Scenario { id; name; seed; car: CarSpec; speedo: SpeedoSpec; driver: DriverSpec;
                     course: Course; book: Instruction[]; checkpoints: Checkpoint[];
                     hazards: Hazard[]; startTime: number; rules: RulesConfig; aids: AidsConfig }
```

The player never sees `s`. The book is the GRIID table built from
`Instruction[]`. The road view shows nodes whose `s - sightDistance <= car.s`.

## 4. Ghost car (perfect time) - ghost.ts
Walk nodes in `s` order with assigned speed `v` (ft/s) and time `t`:
- travel: `t += (s_next - s_cur) / v`
- instruction with `pause`: `t += pause`
- instruction with `speed`: `v = speed` at the node (instantaneous)
- instruction with `timed {hold, T, then}`: `v = hold` at the node; a virtual
  node is inserted at `s + hold*T` where `v = then`.
- start/restart lines set `t = restartTime` (anchor).
Outputs: `ghostTimeAt(s)`, per-checkpoint perfect TOD, per-leg perfect
duration. Speed changes take effect exactly at the node's `s` (Q3 default:
near edge of sign / leading edge of intersection; a speed on a turn line
applies at the same point - the difference is < 0.5 s and is noted).

## 5. Physical car - car.ts
State `{ s, v, a }`. Each step (dt = 0.1 s default):
- Driver supplies a target true speed `vT` (after speedo inversion) and a mode
  (cruise | stopping at s_stop | waiting | turning).
- Acceleration limit `aAcc(v) = a0 * max(0.15, 1 - v / vMax)` (ft/s^2).
  1939 Ford Deluxe preset: a0 = 6.2, vMax = 110 ft/s (75 mph) -> 0-35 mph in
  ~10 s, 0-50 in ~18 s. Deceleration limit `aDec = 8` (comfortable), hard
  stop 14. Turn speed caps: 90-degree turn 12 mph, bear 22 mph, acute 8 mph.
- Cruise control law: `a = clamp(kP * (vT - v), -aDec, aAcc(v))`, kP = 0.8.
- Stop: the car begins braking at the distance needed to stop at the stop
  line with `aDec`, dwells until the driver is released (navigator "go" or
  driver's own patience), then accelerates to the target.
- Consistency: the preset ramps are deterministic; `driver.consistency`
  (0..1) scales a per-maneuver random perturbation of a0 and aDec (expert
  0.03, rookie 0.12 relative sd) so performance tables are learnable but not
  exact.

## 6. Speedometer - speedo.ts
`indicated(vTrue_mph) = gain*v + offset + quad*v^2`, then first-order lag
(tau) and bounce (sinusoidal jitter amplitude) and 1-mph needle reading
granularity for the stock unit. Presets:
- `timewise`: gain = factor/trueFactor (player-settable factor; starts with a
  hidden error of +-0.3..1.5 %), offset 0, tau 0.3 s, no bounce, reading to
  0.1 mph (the 825 has fine marks).
- `mechanical1939`: gain 1.00-1.06 (hidden), offset 0..+2, quad small, tau
  1.0 s, bounce +-0.7 mph, 1-mph marks; daily drift re-randomizes gain by
  +-1 % each stage (tires/temperature) so the morning calibration matters.
`inverse(indicatedTarget)` gives the true speed the driver actually holds
when asked to hold an indicated value.

## 7. AI driver ("Dad") - driver.ts
Inputs: callouts (actions). Behaviors:
- Holds the indicated speed last called with an error process: slow bias
  (Ornstein-Uhlenbeck, sd by skill: rookie 1.0 mph, sportsman 0.5, expert
  0.2) plus jitter 0.2 mph.
- Obeys traffic controls regardless of callouts: STOP -> full stop at the
  line and wait for "go"; SIGNAL red -> wait for green; RR with train -> wait.
- Turns: needs a pending turn callout (`turn L/R/BL/...`) before reaching the
  decision point (node s minus 150 ft). If none: at a T the driver stops and
  asks "Left or right?" and waits; elsewhere continues straight-as-possible
  (least direction change among real roads).
- Executes the called direction literally against the node's exits: picks
  the exit whose angle band matches (L ~ -90, BL ~ -45, AL < -110, S ~ 0...).
  If the called direction matches an exit that is NOT the route -> off
  course: the car enters an excursion branch (generated length 0.3-1.5 mi,
  no landmarks); "uturn" returns to the intersection (cost: 2*distance plus
  a 20 s turnaround) and the car rejoins at the node.
- Patience at a stop: after `patienceSeconds` (default 25) without "go" the
  driver says "Going?" and after 2x goes on his own.
- Read-back: every callout is echoed to the log ("Right at the stop, got
  it", "Holding 36"). Questions are logged as driver messages.
- Slow vehicle: driver follows at the vehicle's speed until "pass" is called
  and a passing window is open (hazard property) or the vehicle turns off.

## 8. Stopwatch and clock - stopwatch.ts
- One stopwatch. `analog` preset: 1/5-second sweep hand resolution, 30-minute
  register; `digital`: 0.01 s display. Actions: start, stop, lap (split),
  reset. The analog model exposes a `reading()` quantized to 0.2 s; the
  digital to 0.01 s. Lap stores split and keeps running.
- Analog time-of-day clock: `tod()` plus a rotating bezel offset set by the
  player (seconds). The UI renders both; agents read numbers.
- Navigator reaction model for agents: optional action latency 0.3 s.

## 9. Simulator - sim.ts
Owns: scenario, car, driver, speedo, stopwatch, clock, hazards, event log,
checkpoint records, ghost tables. `step(dt)` advances everything; node
crossings fire events (pass sign, cross stop line, cross checkpoint line
-> record TOD rounded, start next leg). `observe()` returns:
```ts
{ tod, stopwatch: {running, elapsed, laps}, bezel, speedo: {indicated},
  book: Instruction[] (static), currentLine (player-maintained),
  ahead: VisibleFeature[] (within sight, with approxDistanceFt rounded to 50),
  driver: {messages since last observe, state: 'cruise'|'stopped'|'waiting'|...},
  carStopped: boolean, aids: {earlyLate?: number, countdown?: number},
  phase: 'preread'|'running'|'finished', notes }
```
`act(action)` where `action` is one of: `watch.start|stop|lap|reset`,
`bezel.set`, `call.speed(mph)`, `call.turn(dir)`, `call.stop`, `call.go`,
`call.uturn`, `call.pass`, `call.pullover`, `line.set(n)`, `note(text)`,
`ta.declare(seconds)`, `speedo.setFactor(k)`, `card.set(map)`, `start`
(leave at the start line), `skipPreread`.
`result()` returns the stage result: per-checkpoint actual/perfect/error,
leg durations, penalties, raw and age-factored score, aces, attribution.

## 10. Scoring - scoring.ts
- Leg k error: `round(actual_k) - (anchor_{k-1} + perfectLeg_k)` where
  anchor_0 = official start time (or restart time) and anchor_k = recorded
  actual_k (leg reset, R1.7). Penalty = |error| capped at `rules.maxPerCp`
  (default 300). Missed CP (never crossed, or > 30 min late) = cap.
- Sight-zone violation (stopped or <= 5 mph within CP sight distance): fixed
  `rules.sightZonePenalty` (default 30 s) added once per CP.
- Observation CP: must stop within 200 ft after the line; otherwise
  `rules.observationMissPenalty` (default 60).
- Time Allowance: credited seconds = min(declared, measured delay at
  qualifying hazards in that leg); over-declaration by > 5 s flagged.
- Early restart (> 5 min before restart time): penalty `rules.earlyRestart`.
- Stage raw = sum of CP penalties; stage score = raw * ageFactor(year);
  campaign = sum of stage scores. Ace when error = 0.
- Age factor table: known points interpolated linearly; 1954+ = 1.000.

## 11. Attribution - attribution.ts
Define `e(t) = t_car(s) - t_ghost(s)` sampled at every node crossing and
maneuver boundary. Attribute each increment of `e` between consecutive
sample points to the dominant event of that interval:
`cruise` (speed-holding/calibration), `stop` (uncompensated stop loss =
actual stop cost - pause), `speedChange` (ramp timing), `timedChange`
(call timing vs T), `hazard` (signal/train/slow), `offCourse`, `turn`
(turn slow-down). Cruise error is further split into `systematic`
(mean speed ratio over the leg -> calibration) and `random` (the rest).
The debrief shows a per-leg bar of these buckets and a timeline.

## 12. Performance table and calibration helpers
- `stopLoss(vIn, vOut, car)` from the car's ramps: integrate the actual stop
  profile with zero dwell and compare to the ghost; returns seconds.
- `rampLead(v1, v2, car)` = ramp duration / 2.
- `turnLoss(angleBand, vIn, vOut, car)`.
- Calibration: `k = sum(P_i) / sum(A_i)`; `indicatedToHold(assigned) =
  assigned / k`; cheat card = table for 20..50 step 5.
These are what the player writes on the lapboard; the sim can show the true
values after a performance-table drill (the player must measure them in
play, like the real teams do).

## 13. Generator and trap library - generator/
`generateStage(seed, profile)` builds a scenario: calibration section (3-6
intervals at 50 mph with perfect times), then N legs, each a chain of
segments (0.2-2.5 mi) ending at nodes with instructions; speeds from
{25,30,35,40,45,50}; stop signs with Pause 15; towns with signals; a few
timed segments; 1 hidden timing checkpoint per leg at a random point >= 0.5
mi after the leg start and not within 0.3 mi of a stop; distractor nodes
(driveways, gravel roads, side-road STOPs facing away, YIELD before the
STOP) drawn from the trap library by `profile.trapDensity`. Lunch restart
mid-stage for full stages. The trap library (`content/traps.json`) lists each
trap with instruction text, node layout, correct exit, wrong exits and a
tip; the static Trap Quiz drill renders these directly.

## 14. Drills (curriculum) - drills/
Each drill = scenario template + rubric + aids config + unlock rule.
D01 Stopwatch reaction: lap at the sign as it passes; score |error| and sd.
D02 Reading the analog watch: show a dial, enter the reading (UI only).
D03 Pause arithmetic: 8 stops, varying speeds; score per-stop error.
D04 Timed speed changes: 8 changes; score call timing.
D05 Landmark speed changes: lead-time practice.
D06 Build your performance table: free runs, measure losses, enter table;
    score table accuracy vs truth.
D07 Calibration run: hidden speedo error; compute k; run a 10-min leg.
D08 Early/late recovery: injected delays; use 10%/20% rule; one CP.
D09 Trap quiz (static): CAMEO + road view, pick the exit, 20 cards.
D10 Course following in motion: 15 instructions with distractors, no CP
    timing emphasis; score off-course events.
D11 Full leg: one checkpoint, 25-40 instructions.
D12 Full stage: calibration + 4-7 CPs + lunch restart, 150-250 lines.
D13 Campaign: Trophy Run + 9 stages, age factor, division ladder.
D14 Mental math: seconds arithmetic, recovery factors, s/mile (SCCA mode).
Aids (pace bar, 3-2-1 cues, cumulative times, current-line auto-advance)
default ON in D01-D05 and are removed by D11+ ("Great Race legal").

## 15. Agent harness - src/agent/
- `npm run sim -- --scenario <id|file> --bot <oracle|rookie|random|noPause|lateCall> --speed 8 --json`
  runs headless and prints the result JSON + attribution.
- `npm run sim -- --stdin` reads JSON-lines actions and writes observations
  each step; this is how an LLM playtester plays.
- Bots: `oracle` uses hidden truth (perfect card, perfect calls) ->
  validation target 1-3 s/leg with expert driver; `rookie` ignores stop loss
  and ramp lead; `noPause` forgets pauses; `random`; `lateCall` adds 1.5 s
  latency. Validation tests assert the targets in R07 §9.6.

## 16. UI - src/ui/
Vanilla TS + Canvas 2D + minimal CSS, single page, hash router. Screens:
Home (curriculum map + progress), School (lessons), Drill, Cockpit, Debrief,
Reference, Settings. Cockpit layout: road-ahead view (top), instruments
(left: speedometer, clock with bezel, stopwatch), GRIID book (right, current
line highlighted, click to set), callout bar + driver log + lapboard (bottom).
Keyboard: Space start/stop, L lap, R reset, 1-9 speed presets, arrows for
L/R/straight, B bear modifier, G go, U u-turn, T time allowance, N next line.
Time scale control 1x-8x and pause. Progress in localStorage.

## 17. Testing strategy
- Unit tests per core module; property tests for ghost integrator (ghost
  with instantaneous car and perfect driver scores 0 at every CP).
- Scenario tests: hand-built mini-courses with known answers.
- Validation tests: bots vs targets (statistical over seeds).
- UI: pure view-model functions unit-tested; Playwright smoke test on the
  built app (loads, starts a drill, stopwatch runs, debrief appears).
- `scripts/spec-check.ts`: every id in SPECS.md appears in a test name.

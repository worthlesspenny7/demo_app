# DESIGN - Rally Trainer

Status: v1 design, 2026-10-03, revised the same day after the three design reviews
(docs/spec/reviews/). Implements docs/spec/REQUIREMENTS.md.
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

Order of operations within one node is fixed (GHOST-009): (1) the node is
reached at time t; (2) `pause` adds to t; (3) `speed`/`timed.hold` sets v from
this point; (4) a `timed` anchor is the ghost's *departure* time (after the
pause). So for "STOP P15, 25 for 40 then 45" the count the navigator keeps
starts when the ghost leaves, 15 s after arrival, not at "go" (the real car
leaves early by L_stop, so starting the 40-s count at "go" is early by 2-3 s -
a top-3 rookie error). `ghostTimeAt` is right-continuous: at a pause node it
returns the post-pause time (GHOST-008). `validateCourse` rejects timed
segments that cross a speed/pause/turn node and checkpoints inside a pause
node (GHOST-010).

## 5. Physical car - car.ts
State `{ s, v, a }`. Each step (dt = 0.1 s default):
- Driver supplies a target true speed `vT` (after speedo inversion) and a mode
  (cruise | stopping at s_stop | waiting | turning).
- Acceleration limit `aAcc(v) = a0 * max(0.15, 1 - v / vMax)` (ft/s^2).
  1939 Ford Deluxe preset: a0 = 6.2, vMax = 110 ft/s (75 mph) -> 0-35 mph in
  8-12 s (the preset integrates to ~11 s), 0-50 in 15-22 s (~19.5 s).
  stopLoss(v, v) runs 5.6 s at 25 mph to ~11 s at 45 mph (PERF-001). Deceleration limit `aDec = 8` (comfortable), hard
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
  and a passing window is open (hazard property) or the vehicle turns off;
  `call.pass` is a request the driver honours only when the window is open.
- Event callouts (DRV-013): "Stopped" when v reaches 0 at a stop line and
  "At NN" when settled within 0.5 mph of a new target, each within the
  skill's latency (expert 0.3 s, rookie 1.0 s). These are the navigator's
  real cues for starting a dwell count or ending a ramp; the road-view
  pixels are not.
- Cross traffic at a STOP (DRV-014): with a profile probability (town 0.5,
  rural 0.15) a seeded 0-20 s `trafficWait` holds the driver after "go"
  ("Waiting on traffic"). It is logged with measured seconds as a ledger
  event and is never TA-qualifying (R04 §2.3).
- Check-off (DRV-017): after executing a line the driver names it ("Did the
  stop, forty-three"); `observe().driver.lastExecutedLine` carries n. This
  is the realistic anti-lost-my-place scaffold and stays on at aids rung 1.
- Turn callouts arm until the next node with a matching real-road exit; at
  intersections without one the driver says "No right here, staying on"
  (DRV-015). `go` while rolling, `stop` with no control, `uturn` on course
  and `pass` have the fixed semantics of DRV-016.

## 8. Stopwatch and clock - stopwatch.ts
- One stopwatch. `analog` preset: 1/5-second sweep hand resolution, 60-s
  sweep by default (`sweepSeconds` 60 | 30; the 30-s dial is the specialty
  Hanhart), 30-minute register, and a **rotating countdown bezel**
  (`watch.bezel.set(k)`, WATCH-005): the real one-watch technique starts the
  watch on the official start second and never resets it ("stopwatch-as-
  TOD"); pauses and timed segments are counted by turning the bezel to
  hand + (pause - loss). `reset` is refused while the analog watch runs.
  `digital`: 0.01 s display; `lap` freezes the display on the split while
  counting continues, `recall` returns to running time, reset any time
  (WATCH-006). Both expose `reading()` at the dial's resolution.
- Analog time-of-day clock: `tod()` plus a rotating bezel offset set by the
  player (seconds), used for the start/restart minute. The UI renders both;
  agents read numbers.
- Navigator reaction model for agents: optional action latency 0.3 s.

## 9. Simulator - sim.ts
Owns: scenario, car, driver, speedo, stopwatch, clock, hazards, event log,
checkpoint records, ghost tables. `step(dt)` advances everything; node
crossings fire events (pass sign, cross stop line, cross checkpoint line
-> record TOD rounded, start next leg). `observe()` returns:
```ts
{ tod, stopwatch: {running, reading, laps, bezel}, bezel (clock),
  speedo: {reading},            // quantized to the dial's navigator marks (SIM-019)
  book: Instruction[] (static), currentLine (player-maintained),
  ledger: number | null,        // the navigator's own early/late estimate (SIM-018)
  annotations: Record<n, text>, // per-line pre-read notes (SIM-028)
  ahead: VisibleFeature[] (within sight, with approxDistanceFt rounded to 50),
  driver: {messages since last observe, state: 'cruise'|'stopped'|'waiting'|..., lastExecutedLine},
  carStopped: boolean, aids: {earlyLate?: number, countdown?: number},
  phase: 'preread'|'running'|'finished', notes }
```
What the navigator may NOT see: hidden `s`, the leg index, "checkpoint
crossed" events and hazard measured delays while running at aids rung <= 1
(SIM-001, SIM-027), the fine speedometer reading in legal mode (the driver
reads the speedo; the navigator reads the clock and the book), and any
off-course flag unless `aids.offCourseAlert` (SIM-023). `aids.countdown`
for a timed change is computed from the ghost's schedule shifted by the leg
anchor offset, never from the car's own crossing (SIM-020).
`act(action)` where `action` is one of: `watch.start|stop|lap|reset`,
`bezel.set`, `call.speed(mph)`, `call.turn(dir)`, `call.stop`, `call.go`,
`call.uturn`, `call.pass`, `call.pullover`, `line.set(n)`, `note(text)`,
`ta.declare(seconds)`, `speedo.setFactor(k)`, `card.set(map)`, `start`
(leave at the start line), `skipPreread`, plus `watch.bezel.set(k)`,
`watch.recall`, `ledger.set(seconds)` (the hand-kept early/late ledger, the
one thing a Great Race navigator actually knows about pace), `line.annotate(n,
text)` and `abort`.
`result()` returns the stage result: per-checkpoint actual/perfect/error,
leg durations, penalties, raw and age-factored score, aces, attribution, the
ledger time series {tod, ledger, truth}, and `actions: {tick, action}[]` - the
accepted-action log that `replay(scenario, actions)` turns back into the
identical result (SIM-022) and that the debrief counterfactuals re-run.
Time: one fixed step DT = 0.1 behind an accumulator; `tod` derives from the
integer tick and crossing TODs are interpolated inside the tick (SIM-025).

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
`start` (early/late departure) and `ta` (signed TA credit) are buckets too
(ATTR-005). The buckets sum to the scored leg error within 1.5 s (two rounded
TODs). The debrief (§18) shows a per-leg bar of these buckets, a timeline,
and the navigator's ledger against the truth curve.

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
{20,25,30,35,40,45,50} (20 only in towns); stop signs with Pause 15; towns
with signals (no printed pause at a signal, HAZ-005); a few timed segments;
1 hidden timing checkpoint per leg placed where a rallymaster places them -
"the most inopportune places" (R06 §1): weights 35 % within 0.4 mi after a
STOP/SIGNAL/speed change/turn, the rest on open road, with at least one CP
300-1500 ft after a STOP per stage (GEN-005, GEN-007); never inside a pause
node, never within 300 ft before a STOP/SIGNAL (the car would be braking in
the CP sight zone), never in warm-up/calibration/transit/free-zone sections.
`profile.cpCount` 4-7 by default, up to 12. Every route intersection carries
exactly one `isRoute` exit (GEN-008). Distractor nodes
(driveways, gravel roads, side-road STOPs facing away, YIELD before the
STOP) drawn from the trap library by `profile.trapDensity`. Lunch restart
mid-stage for full stages. The trap library (`content/traps.json`) lists each
trap with instruction text, node layout, correct exit, wrong exits and a
tip; the static Trap Quiz drill renders these directly.

## 14. Drills (curriculum) - drills/
Each drill = scenario template + rubric + aids config + unlock rule + tiers.
Tracks: TIMING (D01-D08, D15-D17), COURSE (D09, D10), ARITH (D02, D14),
WHOLE (D18, D11, D12, D13). COURSE and ARITH are open from the start (the
"coffee-break" track). Every drill has three tiers (Bronze/Silver/Gold =
aids rung 3/2/1 and driver expert/sportsman/rookie); stars are stored per
tier (DRILL-010). Transfer happens in D18, the combo "miniature leg", which
sits BEFORE D11 and gates it (DRILL-004, DRILL-006).

D01 Stopwatch reaction: lap at the sign as it passes; score |error| and sd;
    Gold requires typing the next line's turn letter between laps.
D02 Reading the dial: moving sweep hand, minute register, 30/60-s dials,
    bezel countdown; "is the 15 up yet?" questions (UI only).
D03 Pause execution: 8 stops, varying speeds; Bronze with a printed card for
    a known car, Gold with the player's own card on a re-randomised hidden
    car; bezel method or count method; score per-stop dwell error.
D04 Timed speed changes: 8 changes incl. >= 2 short (T < 20 s) and >= 2
    compound "STOP P15, 25 for 40 then 45" (count from the ghost's
    departure, GHOST-009); score change-point error (DRILL-011).
D05 Landmark speed changes: lead-time practice; leading-edge convention.
D06 Build your performance table: 4 structured runs per speed for stop loss
    and ramp lead; enter table; score vs truth; sanity-check quiz with one
    injected implausible row.
D07 Calibration run: (a) Timewise: compute k, set the factor; (b) mechanical
    (Josh's car): per-speed cheat card built pre-event with a true-speed
    reference, then shifted by the morning run's k (CAL-004); run a 10-min
    leg; score leg error and card error.
D08 Ledger and recovery: (a) injected disruptions, state the running offset
    at prompts (`ledger.set`), choose a +5/+10 plan, do not overshoot early,
    stop correcting before a likely CP zone; (b) Time Allowance: a train and
    two signals, time the stops, declare TA at the CP; double-count scored
    (DRILL-008).
D09 Trap quiz (static): CAMEO + road view, pick the exit, 20 cards. Open.
D10 Course following in motion: 15 instructions with distractors; score
    off-course events AND time-to-detect; one wrong-way start scenario.
D11 Full leg: 25-40 instructions, one hidden CP; (a) clean (no hazards, no
    traps, expert driver), (b) real (hazards, traps, sportsman driver).
D12 Full stage: calibration + 4-7 CPs + lunch restart, 150-250 lines; opens
    with D07 as its calibration section; 12-CP surprise variant at Sportsman+.
D13 Campaign: Trophy Run + 9 stages, age factor, division ladder.
D14 Mental math: seconds arithmetic, dwell = pause - loss, recovery factors,
    s/mile (SCCA mode); 60-s rounds. Open.
D15 Pre-read triage: a 20-30 line page, 3 min (scaled) to highlight pauses,
    speed changes, turns and write GO times (`line.annotate`); then run it;
    score missed marks and cold-read execution (DRILL-012).
D16 Time-of-day discipline: out-time with seconds, set the bezel, leave on
    the minute; minute and hour rollover; lunch restart; stopwatch-as-TOD
    (DRILL-013).
D17 Stopwatch loss recovery: the sim resets the watch mid-leg; re-derive
    elapsed from the clock + Column C at the next landmark; score
    time-to-recover (DRILL-014).
D18 Miniature leg (combo): 4-6 min with one stop, one timed change, one
    landmark change, one trap, one hazard, one hidden CP (DRILL-006). Gate
    for D11.
D19 Checkpoint approach (backlog): hold speed through blind corners and
    town entries; sight-zone rule; observation CP stop at the finish.
D20 Protocol (backlog): call the next landmark before opening the book;
    turn callouts before the decision point; read-back acknowledged.
Aids ladder (DRILL-007): rung 3 = numeric pace bar + 3-2-1 cue + cumulative
perfect times + ghost car rendered + immediate CP card; rung 2 = coarse
early/late arrow + 3-2-1 + immediate CP card + driver check-off; rung 1 =
driver check-off only; rung 0 = "Great Race legal" (perfect times on the
calibration run only, speedo at mark granularity, no live early/late).
Defaults per drill in DRILL-005; legal mode cannot enable any aid. The live
pace bar is a training aid only: in the Great Race early/late is knowable
only as the hand-kept ledger, which is why `ledger.set` is graded (SIM-018).

## 15. Agent harness - src/agent/
- `npm run sim -- --scenario <id|file> --bot <oracle|rookie|random|noPause|goCount|lateCall> --json`
  runs headless and prints the result JSON + attribution.
- `npm run sim -- --stdin` is a synchronous request/response protocol
  (AGENT-002..005): one JSON line in, exactly one JSON line out, and sim
  time moves only when asked. A streaming "one observation per step" feed
  was rejected: a 15-min leg would be 9 000 lines and the agent's latency
  would become part of the physics.
  ```jsonc
  {"type":"hello"}                                   // -> {book, rules, aids, car, obs}   (book sent once)
  {"type":"act","action":{"type":"call.speed","mph":35}}  // -> {ok, readBack, obs}       (no time passes)
  {"type":"advance","seconds":30}                    // -> {elapsed, events, obs}
  {"type":"advance","untilEvent":true,"maxSeconds":120}   // stops at the first interesting event
  {"type":"act","action":{"type":"call.go"},"when":{"watchReads":8.5}}  // scheduled: "go at 8.5 on the bezel"
  {"type":"observe"}                                 // -> {obs}
  {"type":"result"}                                  // -> {result, attribution}
  ```
  `untilEvent` stops on: new feature visible, driver message, car stopped or
  started, phase change, scheduled action fired (CP crossings only at aids
  rung >= 2). Malformed input yields `{"error": ...}` and the process
  continues. Scheduled `when` actions let an LLM express the navigator's
  real decision ("lap at the sign", "go at 8.5") without a chat round-trip
  per tick; the oracle bot is truth -> schedule. The same API is available
  in-process as `playScript(scenario, requests)` for tests; a transcript is a
  replay script (SIM-022), so playtests become regression tests.
- Bots: `oracle` uses hidden truth (perfect card, perfect calls) ->
  validation target 1-3 s/leg with expert driver; `rookie` ignores stop loss
  and ramp lead; `noPause` forgets pauses (calls go at wheels-stop; the
  driver still stops, so it is early by 15 - L_stop, BOT-003); `goCount`
  starts timed counts at its own "go" (BOT-005); `random`; `lateCall` adds
  1.5 s latency. Validation tests assert the targets in R07 §9.6.

## 16. UI - src/ui/
Vanilla TS + Canvas 2D + minimal CSS, single page, hash router. Screens:
Home (curriculum map + progress), School (lessons), Drill, Cockpit, Debrief,
Reference, Settings. Cockpit layout (UI-009) models the real eye path
(book -> road -> watch -> road): road-ahead view across the top of the left
pane with the pending callout and Dad's last line overlaid; below it clock
(left), stopwatch (centre, the largest instrument, >= 240 px dial, lap list
below) and speedometer (right, small - it is the driver's gauge; the
navigator sees it at mark granularity, SIM-019); GRIID book as a right
column showing previous line small, current line extra-large, next two
large, rest dimmed; lapboard drawer at the bottom (ledger +/-, perf card,
cheat card, notes). Keyboard (UI-011): Space start/stop, L or Enter lap,
reset only via Shift+R or R held 600 ms (a slip must not destroy a run),
digits type a speed and Enter calls it (the card's indicated value is shown
first when the card is on), Up/Down nudge, arrows L/R/S with B/A/J modifiers
for bear/acute/jog, G go, U u-turn, T time allowance, N/P next/prev line,
+/- time scale, Esc pause. Audio (UI-012): watch click, Dad's read-back via
speechSynthesis, 3-2-1 beeps as an aid, train/signal sounds, mute toggle.
Pre-read phase has real work (UI-013): highlighters, a GO-time column next
to pauses (`line.annotate`), the cheat-card panel.
Time scale is a UI concept only (UI-010): the loop advances the sim by
`wallDt * scale` in fixed DT ticks, caps catch-up at 1 s of sim time per
frame, applies key presses at the tick matching their timestamp and advances
nothing while paused. Adaptive scale runs up to 4x while nothing is in
sight, no hazard is active and no countdown/bezel target is within 15 s, and
drops to 1x otherwise, so reaction tasks stay honest and dead cruise is
compressed; locked to 1x in D01/D03. Progress through an injected
Storage-like interface (localStorage in the browser).

## 17. Testing strategy
- Unit tests per core module; property tests for ghost integrator (ghost
  with instantaneous car and perfect driver scores 0 at every CP).
- Scenario tests: hand-built mini-courses with known answers.
- Validation tests: bots vs targets (statistical over seeds).
- UI: pure view-model functions unit-tested; Playwright smoke test on the
  built app (loads, starts a drill, stopwatch runs, debrief appears).
- `scripts/spec-check.ts`: every id in SPECS.md appears in a test name.

## 18. Debrief - src/ui/debrief (DEBRIEF-001..004)
The debrief is where the learning happens. Top to bottom:
1. Headline card: per-CP rows (actual, perfect, error, ace), stage raw and
   age-factored, benchmark label (SCORE-011) next to the nearest bot on the
   same seed, and exactly ONE "fix this next" tip derived from the largest
   bias bucket (DEBRIEF-003).
2. Seconds-lost-by-cause stacked bar per leg (§11 buckets) and the timeline
   e(t) = t_car - t_ghost with every maneuver and hazard as a marker; the
   navigator's ledger (SIM-018) is drawn against the truth curve so "your
   ledger said +4, truth was +11" is visible.
3. Worked arithmetic per maneuver (DEBRIEF-001): stop #43: entry 35 / exit
   40; card loss 7.2 s; correct dwell = 15 - 7.2 = 7.8 s; you called go at
   11.1 s after "Stopped"; +3.3 s. Timed change #58: T = 36, lead 2.0 s,
   call at 34.0, you called at 36.4, +0.6 s. Cruise: mean true 34.7 for
   assigned 35 -> ratio 0.991 -> 8 s over 15 min -> "your card is 0.3 mph
   low at 35".
4. Counterfactuals (DEBRIEF-002), cheap because SIM-007/SIM-022 make the
   action log replayable: "If you had called go at the card dwell at every
   stop: +1 (was +7)"; "If your calibration card were exact: -2"; "If you
   had declared the 92-s TA: 0"; each row a replay.
5. Bias vs noise by maneuver type (DEBRIEF-003): mean and sd this run and
   over the last 10; bias is fixable by a number on the card, noise only by
   practice - the debrief says which.
In training tiers (aids rung >= 2) a 3-second CP card appears at the
crossing (DEBRIEF-004); at the legal rung everything above appears only
after the stage, as in reality. Backlog: reading-errors list, replay
scrubber, trends (DEBRIEF-005..007), progression meta-game (PROG-*).

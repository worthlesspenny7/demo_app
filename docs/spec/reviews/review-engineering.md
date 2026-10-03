# Engineering review - Rally Trainer design and specs

Reviewer role: senior simulation/game engineer + test architect. Scope: docs/spec/DESIGN.md,
SPECS.md, REQUIREMENTS.md §3-5, package.json, tsconfig.json, vitest.config.ts,
scripts/spec-check.ts. Date: 2026-10-03. No source code exists yet (src/ and tests/ are
empty), so everything below is about the design and the spec text.

Numbers quoted below were computed from the DESIGN §5 preset (a0 = 6.2, vMax = 110 ft/s,
aDec = 8, aAcc(v) = a0 * max(0.15, 1 - v/vMax)) with a 0.01 s Euler integration:

| quantity | value | spec that depends on it |
|---|---|---|
| 0-35 mph | 11.15 s (design text says "~10 s") | CAR-001 passes [8, 12], barely |
| 0-50 mph | 19.49 s | CAR-001 passes [15, 22] |
| stopLoss(v,v) for v = 20..50 | 4.44, 5.64, 6.89, 8.20, 9.57, **11.02**, 12.57 s | **PERF-001 fails at 45 mph** (upper bound 11) |
| stopLoss(20,40) vs (20,20) | 7.74 vs 4.44 | PERF-002 passes |
| ramp 30->40 | 4.46 s; exact lead 2.13 s vs T_r/2 = 2.23 s; 1.5 ft error | PERF-004 passes |
| ramp 20->50 | 13.99 s; exact lead 6.08 s vs T_r/2 = 6.99 s; **40 ft error** | **PERF-004 fails** for large changes |
| expert hold sd (OU 0.2 + jitter 0.2) | **0.283 mph** | **DRV-010 (<= 0.25) fails as written** |
| braking distance 50 mph / 35 mph at 8 ft/s^2 | 336 ft / 165 ft | sightDistance validation (§5) |

---------------------------------------------------------------------------------------

## 1. Architecture risks

### 1.1 Determinism: fixed-step physics vs variable UI frame

The design says "sim.step(dtSeconds)" and "the UI drives it with requestAnimationFrame at a
chosen time scale". If the UI is allowed to pass the frame's dt, UI runs and agent runs
produce different trajectories, SIM-007 only covers dt = 0.1, and replays are impossible.
Fix at the API level: the Simulator has one private fixed step and a public accumulator.

```ts
export const DT = 0.1;                         // the only step size that exists
class Simulator {
  readonly tick: number;                       // integer; tod = startTod + tick * DT (no float drift)
  advance(simSeconds: number): SimEvent[];     // runs floor((acc += simSeconds) / DT) ticks
  stepOnce(): SimEvent[];                      // exactly one tick (agents, tests)
  act(action: Action): ActResult;              // applied at the current tick, before the next step
}
```

Concrete hazards to design around:

- **Time drift**: `t += dt` 18 000 times accumulates ~1e-9..1e-8 s; harmless for scoring but
  it breaks "identical JSON" (SIM-007) across refactors that reorder additions. Derive
  `tod` from the integer tick.
- **Crossing time must be interpolated inside a tick**: at 44 ft/s a tick is 4.4 ft; the
  recorded TOD is rounded to the nearest second, so a ±0.1 s crossing error is small but it
  is *phase dependent* (shifting the start by 0.05 s changes some roundings). Record
  `tCross = t0 + (node.s - sPrev) / (sNext - sPrev) * DT`. Without this SIM-014 ("exactly 0
  on 20 seeds") will flicker near .5 fractions and the attribution residual gets a 0.1 s
  sawtooth.
- **Multiple crossings per tick**: a stop line (`s - stopLineOffset`), the node itself, a
  virtual timed node and a checkpoint can share one tick or the same `s`. Define a total
  order: by `s`, then by kind (`checkpoint < stopLine < sign < intersection < virtual`),
  then by id. Make it a spec (SIM-020 below).
- **RNG stream isolation**: one shared mulberry32 stream means adding a draw anywhere
  (new hazard, extra noise term) changes every other subsystem for the same seed and
  invalidates recorded replays. Use named sub-streams seeded by hashing the name:
  `rng.fork('driver')`, `rng.fork('speedo')`, `rng.fork('hazards')`,
  `rng.fork('excursion:' + nodeId + ':' + exitIdx)`. mulberry32 has a 32-bit state; pair
  it with xmur3 string hashing for the fork names.
- **OU noise must be stepped with the fixed dt** using the exact discretisation
  `x' = x e^{-dt/tau} + sd sqrt(1 - e^{-2dt/tau}) N(0,1)`, otherwise a later dt change
  silently changes driver skill.
- **No wall-clock in core**: a static test that greps `src/core/**` for
  `Math.random|Date.now|performance.now|window|document|localStorage` is cheap and catches
  the most common determinism regressions (DET-001). Note tsconfig puts `DOM` in `lib` for
  the whole project, so the compiler will not catch DOM leakage into core; either add a
  `src/core/tsconfig.json` with `lib: ["ES2022"]` or rely on the grep test.
- **Canonical JSON** for SIM-007/replay: round every float to 1e-6 in `result()` and never
  serialize `Map`/`Set` iteration order; floats like `0.1 + 0.2` will otherwise differ after
  an innocuous refactor.

### 1.2 The 1-D course and the off-course excursion model

The model is right for the problem (the player has no odometer; only the ordering of
landmarks matters), but off-course handling has four gaps.

1. **Missing a turn is not covered.** DESIGN §7 only sends the car off course when "the
   called direction matches an exit that is NOT the route". The most common rookie failure
   is the opposite: the route turns, nobody calls it, the driver goes "straight-as-possible"
   (DRV-005) and leaves the route. Off-course must be decided by *the exit actually taken*
   versus `isRoute`, independent of why it was taken. Consequence: every intersection on
   the route needs exactly one `isRoute` exit even when no instruction exists (GEN-007).
2. **Position representation.** `car.s` is route arc length and CAR-005 wants it monotone
   "while on course". Off course needs its own coordinate:
   ```ts
   type Pose =
     | { kind: 'route'; s: number }
     | { kind: 'excursion'; nodeId: string; exitIdx: number; d: number; outbound: boolean };
   ```
   Do not teleport on `uturn` ("cost: 2*distance plus 20 s"). Simulate it: brake, 20 s
   turnaround, drive back `d` at the called speed with the same car model, rejoin at the
   node with `s = node.s`, heading along the route exit. A teleport breaks the stopwatch
   feel, the attribution sampling (§1.5) and the "landmark did not appear" detection
   skill (P8) the drill is supposed to teach. DRV-006's formula then becomes an
   approximation, not the implementation (see §2).
3. **Event re-firing on rejoin.** When the car comes back to `node.s`, node-crossing events
   for that node must not fire again, and the pending callouts issued while off course must
   be defined (consumed normally, logged; no magic). Keep a `crossedNodeIds` set, or mark
   crossing by *leaving* a node rather than reaching its `s`.
4. **What is on the branch, and how does it end?** "No landmarks" is the right default,
   but the branch needs a terminal (a T or dead end after its 0.3-1.5 mi) so that an
   un-corrected wrong turn ends in DRV-004 ("Left or right?") rather than in an infinite
   drive. The branch content must be seeded per (node, exit), not drawn from the global
   stream at the moment of the event. Also decide termination of the whole stage: a car
   that never u-turns must still produce a `result()` (SIM-021 below): finished when the
   last CP + observation stop is done, or TOD > last perfect CP + 30 min, or `act('abort')`.

Smaller points: `sightDistance` is measured to `node.s`, but the driver reacts to the stop
line at `s - stopLineOffset`; and the "decision point" is `s - 150 ft`. Both impose
`sightDistance >= stopLineOffset + max(150, v^2/(2 aDec))` at the approach speed (336 ft at
50 mph) or the driver brakes at the hard limit and the ramps stop being learnable. Make
`validateCourse` enforce it (GHOST-009/CAR-006 family) and make the generator emit
>= 600 ft for controls approached at >= 45 mph. The decision point itself should be
time-based (`max(150 ft, 3 s * v)`), 150 ft is 2 s at 50 mph.

### 1.3 Driver state machine complexity

DESIGN §7 lists eight behaviours; combined with controls (STOP/YIELD/SIGNAL/RR), hazards
(train/slow/construction), turns, off-course and patience, a naive FSM explodes
(stopped-at-STOP-with-pending-turn-while-signal-red-while-asking-direction...). Split the
driver into (a) a *constraint solver* evaluated every tick and (b) a very small FSM for the
one thing that genuinely has memory: being stopped and waiting for something.

```ts
interface SpeedConstraint { vMax: number; reason: 'cruise'|'turnCap'|'follow'|'yield'|'construction' }
interface StopConstraint  { sStop: number; reason: 'STOP'|'SIGNAL'|'RR'|'ask'|'pullover'|'deadend' }
// per tick: target = min over constraints; stop = nearest StopConstraint ahead of the car
type Waiting = { reason: StopConstraint['reason']; since: number; releasedBy: 'go'|'green'|'trainGone'|'answer'|'patience' };
interface DriverState { pendingTurn?: Dir; waiting?: Waiting; readBackLog: Msg[] }
```

Behavioural decisions the design leaves open and that must be pinned (they decide whether
the driver is usable by a human and by an LLM):

- **Callout horizon.** `call.turn(R)` issued early: does it apply at the next intersection
  that has a right exit, or at the very next intersection (which may have none; DRV-007
  says the driver then "asks and waits", which would be maddening and unrealistic)?
  Recommend: a turn callout arms until the next node having a matching *real-road* exit;
  at nodes without one the driver says "No right here" and continues (DRV-013). A `T`
  with no matching exit asks. Optionally allow an anchor: `call.turn(dir, at?: Control)`
  ("right at the stop") so the driver skips a driveway/gravel road exactly as a real driver
  would, and so the trap drills have a precise failure mode (the player anchors to YIELD
  instead of STOP).
- **`go` when rolling, `stop` with no control** (pullover), `uturn` when on route (the
  player thinks they are lost but are not: a real and instructive mistake; it should cost
  time, not be rejected).
- **Pause at a green signal / pause at a landmark without a stop (Q4).** The design has no
  "burn time" action besides `pullover`; define `call.stop` = stop here until `go`.
- **YIELD** is not mentioned: roll at <= 15 mph unless cross traffic hazard.
- **Turn execution in 1-D**: a turn cap applied as a `SpeedConstraint` over
  `[s - 30, s + 30] ft` gives a deterministic, table-learnable turn loss; "<= 12 mph at
  the node" (DRV-011) then holds by construction.
- **Driver "knows" the inverse speedo.** `vT = inverse(indicated)` is a shortcut: the real
  driver holds a needle; reading noise is where the 1-mph-marks matter. Keep the shortcut
  but (a) invert only the deterministic transfer (gain/offset/quad), never lag or bounce,
  else `inverse` is undefined (SPEEDO-006), and (b) make hold noise depend on the speedo
  preset (mechanical bounce +-0.7 mph should make a rookie worse than on a Timewise).

### 1.4 Ghost integrator edge cases

- **Timed segment crossing a node.** Virtual node at `s_a + hold*T`. If a real node with
  `speed`, `pause` or `turn` lies before the virtual node the semantics are undefined (is
  the 36 s stopwatch time or driving time if there is a Pause in between?). Rally masters do
  not write this; reject it in `validateCourse` with the instruction number (GHOST-009).
  Landmark-only nodes and checkpoints inside a timed segment are fine.
- **Pause at a checkpoint.** `ghostTimeAt(s)` is discontinuous at pause nodes, so a CP at
  the node's `s` is ambiguous (before or after the pause?). The generator avoids it (0.3
  mi), but hand-authored content will not. Make `ghostTimeAt` right-continuous (returns
  post-pause) and provide `ghostTimeAt(s, 'before')`; reject CPs within
  `stopLineOffset + 50 ft` of a pause node (GHOST-011). GHOST-008 as written ("piecewise
  linear") contradicts GHOST-002; it is piecewise linear with upward jumps.
- **Speed change on the same node as a stop.** Ghost: `t += pause; v = speed` (commutes).
  Car: brakes from vIn to the stop line at `s - offset`, accelerates to vOut from there.
  `stopLoss(vIn, vOut)` should be *computed by simulation* of the car model (not the
  closed-form `v/2a_d + v/2a_a`, which assumes constant acceleration and is 10-20 % off for
  this preset), with the ghost switching speeds at `s`, not at the stop line; the offset
  contributes `offset*(1/vIn - 1/vOut)` which is negligible but should be in the same
  function so the player's measured table and the attribution agree exactly.
- **Restart line reached late.** GHOST-005 "regardless of earlier time": if the ghost
  reaches a restart node after `restartTime` the leg has negative slack; emit a validation
  warning and still anchor (GHOST-012).
- **Two instructions on one node** (books write "Right at STOP" and "Speed 35" as separate
  lines): allowed; the ghost processes them in `n` order; validation requires book order ==
  `s` order.
- Keep the ghost pure and reusable: `buildGhost(course, book): GhostTable` returning sorted
  breakpoints `{ s, tBefore, tAfter, v }`, with `timeAt(s)` by binary search. The debrief
  timeline, the oracle bot, the attribution and `perfectInterval` (GHOST-007) all read the
  same table; do not re-derive perfect times anywhere else.

### 1.5 Attribution soundness (ATTR-001)

Telescoping `e(s) = t_car(s) - t_ghost(s)` over a partition of the leg sums *exactly* to
`e(CP_k) - e(CP_{k-1})`, which is the unrounded leg error. Three things break the equality
as specified:

1. **Rounding.** SCORE-001's leg error is `round(a_k) - round(a_{k-1}) - perfectLeg`; the
   two roundings differ from the unrounded error by up to ~1.0 s, so "within 0.5 s"
   (ATTR-001) is a spec that can fail legitimately. Add an explicit `rounding` bucket (=
   scored error - unrounded error, |x| <= 1) and require the *unrounded* buckets to sum to
   the unrounded leg error within 1e-6 (ATTR-005). Exact by construction, not "within".
2. **"Dominant event of the interval" is lossy.** An interval containing a ramp and 20 s of
   cruise lumps the cruise into `speedChange`. Attribute by *phase*, not by interval: the
   car model knows at every tick whether it is cruising (|v - vT| < 1 mph), ramping,
   stopped, turning, following, or off course. For each phase compute its increment of `e`
   (cruise: `ds * (1/v_avg - 1/v_ghost)`; stopped: dwell minus the pause it consumed;
   ramp/turn/offCourse: the raw increment). Then `cruise` splits into `systematic` using
   the leg's mean speed ratio and `random` = remainder. The last bucket is a `residual`
   that must be ~0 (|x| < 0.05) and *is itself a test* of the bookkeeping.
3. **Off course and TA.** During an excursion `s` is not monotone, so sample `e` in time,
   not in `s`; the whole excursion increment goes to `offCourse`. A Time Allowance credit
   reduces the *scored* error but is not a cause of lost time: report `hazard` as measured
   and `taCredit` as a separate signed bucket so `sum(buckets) == scoredError` still
   holds and the debrief can say "you lost 48 s at the train and recovered 45 of it by TA".

Signature:
```ts
interface LegAttribution {
  legIndex: number; scoredError: number; unroundedError: number;
  buckets: { cruiseSystematic; cruiseRandom; stop; speedChange; timedChange; turn; hazard; offCourse; taCredit; rounding; residual }: Record<Bucket, number>;
  timeline: Array<{ t0: number; t1: number; phase: Phase; de: number; nodeId?: string }>;
}
export function attribute(log: SimEventLog, ghost: GhostTable, result: StageResult): LegAttribution[];
```

### 1.6 Agent protocol and how an LLM playtester would actually use it

AGENT-002 ("one observation JSON line per step") does not work for the stated purpose: a
15-minute leg at dt 0.1 is 9 000 observation lines, each carrying the static book; no LLM
(and no human reading a log) can use that. Also, a stream that advances on its own makes the
agent's latency part of the physics, so runs are not reproducible. Make the protocol
synchronous: time passes only when asked, and exactly one reply per request line.

```jsonc
// request lines                                             // reply lines
{"id":1,"hello":true}                                        // -> {"id":1,"book":[...],"rules":...,"aids":...,"car":"ford1939","obs":{...}}  (static once)
{"id":2,"act":{"type":"call.speed","mph":35}}                // -> {"id":2,"ok":true,"readBack":"Holding 35","obs":{...}}  (no time passes)
{"id":3,"advance":{"seconds":30,"untilEvent":true}}          // -> {"id":3,"elapsed":12.4,"events":[...],"obs":{...}}  (stops early at the first interesting event)
{"id":4,"act":{"type":"watch.lap"},"when":{"event":"pass","feature":"STOP sign"}}   // scheduled action, fires at sub-tick precision
{"id":5,"act":{"type":"call.go"},"when":{"watchReads":8.5}}  // "call go when the sweep hand hits 8.5"
{"id":6,"result":true}                                       // -> {"id":6,"result":{...},"attribution":[...]}
```

Why scheduled (`when`) actions matter: an LLM cannot lap a stopwatch "as the sign passes"
through a chat round-trip, but it *can* express the navigator's real decision ("lap at the
sign", "go at 8.5 on the bezel", "call 40 at 34 s"). This is exactly what a human does with
a bezel, so it is not cheating; it also makes the oracle bot trivial (truth -> schedule) and
gives the harness one code path for bots, LLMs and tests. `untilEvent` should stop on: new
feature visible, driver message, car stopped/started, CP crossed (only in debug/aids mode),
phase change, scheduled action fired. Malformed input must yield `{"id":..., "error":...}`
and continue (BOT-004). Provide the same API in-process
(`playScript(scenario, requests[]): replies[]`) so tests never spawn processes except one
CLI smoke test. Keep observations small: `book` only in `hello`; `ahead` capped; distances
rounded; driver messages as a delta since the last observation (already in the design).

### 1.7 Time-scale handling

Time scale is a UI concept only. The loop:

```ts
let acc = 0, last = performance.now();
function frame(now: number) {
  const wall = Math.min(0.25, (now - last) / 1000); last = now;       // clamp after tab was hidden
  if (!paused) acc += wall * timeScale;
  acc = Math.min(acc, 1.0);                                            // never catch up more than 1 s of sim per frame
  for (const a of inputs.drain()) pending.push({ atSim: simTime + a.wallOffset * timeScale, a });
  while (acc >= DT) { firePending(); sim.stepOnce(); acc -= DT; }
  render(viewModel(sim.observe()));
}
```

Risks: (1) at 8x a human's 150 ms reaction is 1.2 s of sim time, which destroys the
reaction drills; lock timeScale to 1x in D01/D03-type drills and record `timeScale` in
`result()` so leaderboards can filter (UI-010). (2) When the tab is hidden rAF stops; on
return, do not simulate the missed minutes (clamp above). (3) Key presses should be
timestamped and applied at the matching tick inside the accumulator loop, otherwise input
is quantised to the frame and 1x play has 16 ms jitter plus up to 100 ms of accumulated
steps. (4) Pause must freeze the stopwatch too (it is sim time, so this is automatic, but
the clock view-model must not read wall time).

### 1.8 Replay

Replay is cheap if, and only if, every input is recorded as `(tick, action)` and the sim
is deterministic (§1.1). `result().actions: {tick, action}[]` plus `scenarioId`, `seed`,
`engineVersion` (a hash of src/core at build time) is the whole replay file. The debrief
scrubber re-simulates and snapshots `observe()` every 10 ticks (a 1-hour stage is 36 000
ticks, ~tens of ms of CPU). Add SIM-022: `replay(scenario, actions)` reproduces identical
`result()` JSON, and refuse to replay a different `engineVersion` (show "recorded with an
older engine" instead of silently diverging). The LLM protocol above *is* a replay script,
so playtest transcripts become regression tests for free (`docs/playtest/*.jsonl`).

---------------------------------------------------------------------------------------

## 2. Spec quality

### 2.1 Specs that are untestable, ambiguous or over-constrained (with rewrites)

| id | problem | proposed rewrite |
|---|---|---|
| UNIT-003 | JS `Math.round(-12.5) = -12`; "round-half-up" is ambiguous for negatives. Errors can be negative. | "roundToSecond applies to TOD (>= 0) and is half-up; leg error is computed from *rounded TODs*, never by rounding a signed difference." |
| GHOST-008 | contradicts GHOST-002 (pause = jump). | "ghostTimeAt is non-decreasing, piecewise linear between breakpoints, with an upward jump equal to the pause at pause nodes; it is right-continuous (returns the post-pause time at the node)." |
| GHOST-005 | ghost may reach the restart after restartTime. | add "...; if the ghost arrives after restartTime, validateCourse reports warning `negativeRestartSlack` and the anchor still applies." |
| CAR-001 vs DESIGN §5 | design says 0-35 "~10 s", preset gives 11.15 s. | keep CAR-001; fix the design text, or set a0 = 7.0 (gives ~9.9 s). Decide once; PERF-001 depends on it. |
| CAR-002 | "stops within 2 ft" needs a snap rule or the P-controller creeps. | add "when remaining distance < 0.5 ft and v < 1 ft/s the car snaps to v = 0, s = sStop; s never exceeds sStop in stopping mode." |
| CAR-004 | "begins exactly when commanded" with a 0.1 s step. | "begins at the first tick after the command". |
| SPEEDO-003 | hidden gain 1.00-1.06, offset 0..2: at 50 mph the excess can be 0, so "between 1 and 5 mph" fails for some seeds. | constrain the preset (gain 1.01-1.05, offset 0.5-1.5) *and* test over seeds 0..99: "reading at 50 mph exceeds truth by 1..5 mph for every seed". |
| DRV-001 | "converges" is false with hold noise on. | add "with driver noise disabled (consistency 0, sd 0)". |
| DRV-004/005 | "T" and "real road" undefined. | define `isT(node)`: no exit with angle in (-20, 20] among exits of kind 'road'; "real road" = kind 'road' and surface 'paved' unless the instruction names gravel. |
| DRV-006 | formula vs simulated return (§1.2). | "...; the time off course equals 2d/v + turnaround (20 s) + the car's ramp and turn losses, within +-3 s of 2d/v + 20 for d >= 0.3 mi; the car rejoins at the node with s = node.s and node events do not re-fire." |
| DRV-007 | closed intervals overlap at -20, 20, +-60, +-120; `JL/JR` (jog) in `Instruction.turn` has no band. | half-open bands: AL (-180,-120], L (-120,-60], BL (-60,-20], S (-20,20), BR [20,60), R [60,120), AR [120,180); define jog as "L then R (or R then L) at the next two nodes" or drop it from v1. |
| DRV-009 / HAZ-002 | "measured seconds" of a hazard delay undefined (dwell only, or dwell + ramps?). | "measured delay = tDepart - tArriveStopLine (stationary time only); ramp losses are not TA-qualifying." |
| DRV-010 | expert sd with OU 0.2 + jitter 0.2 is 0.283 > 0.25; fails by construction. | either jitter 0.1 (combined 0.22) or "expert sd <= 0.35, rookie >= 0.8"; state that sd is measured on true speed vs target over 5 min at dt 0.1 after 30 s settling. |
| WATCH-004 | puts the countdown bezel on the TOD clock; the research (R07 §2.1) and every navigator account put the countdown bezel on the *stopwatch*. The clock bezel is for the start minute at best. | WATCH-004: "clock.tod() equals sim TOD." New WATCH-006: "stopwatch.bezel.set(k) stores k in [0,60); bezelRemaining() = (k - elapsed mod 60) mod 60 for the analog watch; digital has a countdown instead." |
| SIM-004 | a red SIGNAL/STOP inside a CP sight zone (hand-authored) would penalise a forced stop. | add `rules.sightZoneExemptForcedStops` (default true); the generator still keeps 0.3 mi. |
| SIM-006 | fine, but "preread timer 30 min of sim time" must not block `advance`. | add "advance() during preread advances TOD without moving the car". |
| SIM-009 | credit direction undefined (can TA make you early?). | "credit = min(declared, measured, max(legError, 0)); it never turns a late leg into an early one; over-declaration > 5 s sets `taOverDeclared`." |
| SIM-013 | `options.useCard` is an aid, not a rule. | move to `aids.autoCard` and add "OFF in Great Race legal mode". |
| SIM-014 | "exactly 0" flickers when the exact ghost TOD has fraction 0.5 +- float error. | "unrounded error |e| < 1e-6 at every CP and rounded error = 0 unless frac(perfectTOD) is within 1e-6 of 0.5". |
| PERF-001 | stopLoss(45,45) = 11.02 s with the stated preset; the upper bound 11 fails. | "within [4, 13] s for v in 20..50, strictly increasing in v, and within 1 s of the car's table printed in DESIGN" (or change the preset; see CAR-001). |
| PERF-004 | T_r/2 is exact only for a linear ramp; 20->50 gives 40 ft of error with this preset. | "rampLead(v1,v2) is the lead that zeroes the position error (numeric); it is within 0.3 s of T_r/2 for |v2 - v1| <= 15 mph; a timed change called at T - rampLead has |position error| < 5 ft." Print both on the card. |
| ATTR-001 | rounding makes 0.5 s unattainable in general (§1.5). | "unrounded buckets sum to the unrounded leg error within 1e-6; `rounding` bucket in [-1, 1]; `residual` |x| < 0.05." |
| ATTR-002 | "~0" undefined. | "|other buckets| < 0.5 s each". |
| ATTR-003 / VAL-001 | duplicates; "15-minute leg" must be stop-free or the 1 % does not scale. | keep VAL-001 as the bot-level test, ATTR-003 as the bucket test, both on "15 minutes of cruising with no stops". |
| BOT-002 | rookie gains stopLoss(v) which is 4.4 s at 20 mph, 5.6 at 25: ">= 5" fails at low speeds. | ">= 4 s per Pause 15 stop at assigned speeds >= 25 mph". |
| BOT-003 | wrong by construction: at a STOP the driver stops anyway (DRV-002), so a bot that forgets the pause and calls `go` at once is early by 15 - stopLoss(v) = 4-10 s, not 12-18 s. | "noPause bot on a single STOP + Pause 15 leg at 35 mph is early by 15 - stopLoss(35) +- 2 s (about 7 s); on a Pause 15 attached to a non-stop landmark it is early by 15 +- 2 s." |
| VAL-002 | 60 s one-way excursion costs 2*60 + 20 + maneuver losses, i.e. > 140. | "...costs 135-165 s at the next CP only; the following leg's error is within 3 s of the clean run." |
| AGENT-002 | streaming one line per step (§1.6). | "the harness is request/response: each input line yields exactly one output line; `advance` is the only request that moves time; a malformed line yields an error line and the process continues." |
| UI-006 | Playwright in `npm test` will be the slowest and flakiest test. | keep the text; add "runs under `npm run test:e2e`, not `npm test`, and drives sim time through `window.__rally.advance()` rather than wall-clock waits." |
| UI-008 | localStorage is DOM. | "...via an injected `Storage`-like interface; the unit test uses an in-memory map." |
| GEN-004 | "render to a CAMEO without error" is a UI concern inside GEN. | split: GEN-004 data invariants; UI-004b "every trap library entry renders through cameoSvg". |

### 2.2 Important behaviours with no spec (proposed ids and text)

Determinism / time
- **DET-001** `src/core/**` contains no `Math.random`, `Date.now`, `performance.now`, `window`, `document`, `localStorage` (static test).
- **DET-002** `rng.fork(name)` streams are independent: consuming N values from one fork does not change the sequence of another; fork(name) is reproducible from (seed, name).
- **SIM-018** The simulator has a single fixed step DT = 0.1; `advance(x)` runs floor((acc + x)/DT) ticks and carries the remainder; `tod = startTod + tick*DT` exactly (no drift over 36 000 ticks).
- **SIM-019** Event TODs (node crossings, CP crossings, stop-line arrivals) are linearly interpolated within the tick; shifting the start phase by 0.05 s changes a recorded crossing time by < 1e-6 s.
- **SIM-020** Multiple crossings in one tick are processed in (s, kind, id) order with kind order checkpoint < stopLine < sign < intersection < virtual.
- **SIM-021** Termination: phase becomes 'finished' when (a) the observation CP stop is recorded after the last timing CP, or (b) TOD exceeds the last perfect CP TOD by `rules.missedCpMinutes` (30), or (c) `act('abort')`. `result()` is available in every case and marks un-crossed CPs as missed.
- **SIM-022** `result().actions` lists every accepted action as {tick, action}; `replay(scenario, actions)` yields identical result JSON; a replay with a different `engineVersion` is refused with a message.
- **SIM-023** observe() exposes no off-course flag or branch information unless `aids.offCourseAlert` is on; during an excursion `ahead` lists only generated non-landmark features.
- **SIM-024** Taking any exit other than the `isRoute` exit puts the car off course, whether due to a callout or to the default straight-as-possible behaviour.
- **SIM-025** An excursion branch ends in a T or dead end after its generated length; the driver stops there and asks; `call.uturn` works anywhere on the branch.
- **SIM-026** `observe().ahead[].approxDistanceFt` is round-half-up to 50 ft and never negative; a feature is removed once `car.s > node.s`.

Driver
- **DRV-013** A turn callout arms until the next node that has a matching real-road exit; at intermediate intersections without one the driver logs "No <dir> here" and continues straight-as-possible.
- **DRV-014** The driver stops at `node.s - stopLineOffset`; the node's crossing events fire when `car.s` passes `node.s`.
- **DRV-015** `call.go` while rolling is logged and ignored; `call.stop` with no control ahead stops the car within 150 ft (pull-over) until `call.go`; `call.uturn` on route is executed (turnaround + return) and costs time.
- **DRV-016** At a green SIGNAL with a printed Pause the driver does not stop unless told; the ghost pause still applies (OPEN-QUESTIONS Q4).
- **DRV-017** YIELD: the driver slows to <= 15 mph at the line and does not stop unless a cross-traffic hazard is active.
- **DRV-018** Braking for a control starts when the control is visible and within braking distance; if sightDistance is shorter than the comfortable braking distance the driver uses the hard limit (14) and logs "Short stop!".

Ghost / course validation
- **GHOST-009** `validateCourse` rejects a timed segment whose virtual node lies at or beyond the next node carrying speed, pause or turn; landmark-only nodes and checkpoints inside are allowed.
- **GHOST-010** A node with both pause and speed adds the pause then sets the speed; `ghostTimeAt(s)` returns the post-pause time; `ghostTimeAt(s, 'before')` the pre-pause time.
- **GHOST-011** validateCourse rejects a checkpoint within `stopLineOffset + 50 ft` of a pause node.
- **GHOST-012** validateCourse warns when the ghost reaches a restart node after its restartTime.
- **GHOST-013** Book order equals s order (instruction n increases with the anchor's s; virtual positions included); nodes sorted by s; ids unique.
- **GHOST-014** The ghost is invariant to inserting a landmark-only node: times at all other breakpoints are unchanged (property test).

Car / speedo
- **CAR-006** Stopping mode never overshoots: s <= sStop at every tick; snap rule as in CAR-002.
- **CAR-007** Several callouts in one tick: the last speed callout wins, all are logged with the same TOD.
- **SPEEDO-006** `inverse()` uses only the deterministic transfer (gain, offset, quad) and is monotone on 0..100 mph; `inverse(indicated(v)) = v` within 1e-6.

Watch
- **WATCH-005** The analog 30-minute register wraps: `reading()` returns elapsed mod 1800 and the UI shows no lap-of-dial counter unless `aids.watchLaps` is on.
- **WATCH-006** Stopwatch countdown bezel (see 2.1).

Scoring / attribution
- **SCORE-010** TA credit direction (see SIM-009 rewrite).
- **ATTR-005** Bucket partition exactness with `rounding`, `taCredit` and `residual` buckets (see §1.5).
- **ATTR-006** During an excursion `e` is sampled in time; the whole excursion increment is attributed to `offCourse`.

Agent / UI / content
- **AGENT-003** Request/response protocol (see AGENT-002 rewrite), with `id` echoed.
- **AGENT-004** `advance{seconds, untilEvent}` stops early at the first event in {featureVisible, driverMessage, carStopped, carStarted, phaseChange, scheduledFired} and returns the events since the previous reply.
- **AGENT-005** Scheduled actions `when: {event|tod|elapsed|watchReads}` fire at interpolated sub-tick time and are recorded in the action log with the tick at which they fired.
- **AGENT-006** The `hello` reply contains only player-visible information (book without s, rules, aids, car preset name); it is subject to SIM-001.
- **UI-009** The UI loop advances the sim in fixed DT steps by `wallDt * timeScale`, caps catch-up at 1 s of sim time per frame, applies key presses at the tick matching their timestamp, and advances nothing while paused.
- **UI-010** timeScale is locked to 1x in reaction drills (D01, D03) and recorded in `result()`.
- **GEN-007** Every intersection node on the route has exactly one `isRoute` exit; when the node has a turn instruction, the route exit's angle lies in that turn's band; when it has none, the route exit is the straight-as-possible real road.
- **GEN-008** Excursion branches are generated from `rng.fork('excursion:'+nodeId+':'+exitIdx)` and are identical regardless of when the car enters them.
- **CONTENT-001** Every JSON scenario under content/ passes validateCourse and is completed by the oracle bot in < 2 s of CPU.
- **DRILL-006** Every drill's scenario factory produces a validating scenario for seeds 1..10 and the oracle bot finishes it with phase 'finished'.
- **PERF-005** `npm test` core suite: 100 000 simulator ticks complete in < 2 s (regression guard for the 60 s budget).

---------------------------------------------------------------------------------------

## 3. Testing strategy

### 3.1 Property tests and invariants (fast-check, available on the registry: `npm i -D fast-check@^4`)

Arbitraries to write once in `tests/arb.ts`: `arbCourse` (sorted nodes, speeds from the
allowed set, optional pauses, 0-2 timed segments that satisfy GHOST-009), `arbScenario`
(= generateStage(seed) over `fc.nat()`), `arbActionScript` (random `Action`s with
random tick gaps), `arbSeed`.

| module | invariant |
|---|---|
| ghost | non-decreasing; jumps only at pause nodes and equal to the pause; `t(s2) - t(s1) >= (s2 - s1)/vMaxAssigned`; invariant to inserting a landmark-only node (GHOST-014); invariant to node array permutation (sorted internally); total = sum of segment times + pauses. |
| sim vs ghost | instantaneous-car oracle scores |e| < 1e-6 at every CP for any generated scenario and any start phase offset in [0, DT) (SIM-014 + SIM-019 together). |
| determinism | same (scenario, script) -> identical result JSON; consuming extra values from `rng.fork('hazards')` does not change the driver's trajectory (DET-002). |
| car | s monotone on route; v >= 0; |a| within limits every tick; stopping never overshoots; `stopLoss(v,v)` strictly increasing; `rampLead(v1,v2) > 0`. |
| observe | JSON-serialisable; no number in the observation equals any hidden node/CP `s` (SIM-001 as a property, not a key-name check); size < 8 KB. |
| act | arbitrary action scripts never throw (BOT-004) - fast-check shrinking gives the minimal crashing script for free. |
| scoring | penalty in [0, cap]; ace iff error 0; age factor non-decreasing in year; sum of legs = stage raw. |
| attribution | buckets partition exactly (ATTR-005); residual < 0.05. |
| generator | GEN-001..008 for 200 seeds; generation is pure, so this costs milliseconds. |
| watch | elapsed = sum of running intervals; quantisation idempotent; lap never changes elapsed. |

Use `fc.assert(..., { numRuns: Number(process.env.FC_RUNS ?? 50), seed: 1 })`: fixed seed
in CI for reproducibility, more runs on demand. Statistical tests (DRV-010, BOT-001)
use fixed seeds and assert on medians, never on single runs.

### 3.2 UI without flakiness

1. **View-models are pure functions and carry all UI specs.** `stopwatchViewModel(elapsed,
   laps, preset) -> { sweepDeg, minuteDeg, splitDeg?, digits? }`,
   `clockViewModel(tod, bezel)`, `speedoViewModel(indicated, preset)`, `bookRows(book,
   currentLine)`, `debriefViewModel(result, attribution)`, `cameoSvg(node)`. Canvas
   renderers take a view-model and a `CanvasRenderingContext2D`; they are not unit-tested
   (one Playwright screenshot for eyeballing, never pixel-compared).
2. **The app store is injectable**: `createApp({ sim, storage, now })` where `storage` is a
   `{get,set}` map (UI-008 in node) and `now` is a function (loop tests in node with a
   fake frame scheduler).
3. **Playwright smoke** (`tests/e2e/smoke.spec.ts`, script `test:e2e`, not part of `npm
   test`): `@playwright/test@1.56.x` is the release whose Chromium revision is 1194, i.e.
   the browser already present at `/opt/pw-browsers/chromium-1194`. Config:
   ```ts
   // playwright.config.ts
   export default defineConfig({
     testDir: 'tests/e2e', timeout: 30_000, retries: 0, workers: 1,
     webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
     use: { baseURL: 'http://localhost:4173', headless: true,
            launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu'] } },
   });
   ```
   (or set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and let 1.56 find it). Determinism
   inside the browser: load `#/drill/D03?seed=1&test=1`; with `test=1` the app exposes
   `window.__rally = { sim, advance(seconds), act(a) }` and disables the rAF loop, so the
   test drives sim time (`page.evaluate(() => __rally.advance(120))`) instead of waiting on
   wall clock. Assert on `data-testid` text (`stopwatch-digits`, `phase`, `debrief-cp-row`)
   with `expect(...).toHaveText` / `expect.poll`. No `waitForTimeout`, no screenshot
   comparison, one worker, one spec, runs in ~10 s.

### 3.3 Keeping `npm test` under ~60 s

- The simulator should run >= 1 M ticks/s if the step allocates nothing (plain numbers,
  pre-sorted node arrays, index cursors instead of `find`). A full stage (36 000 ticks) is
  then < 50 ms; BOT-001 (10 seeds x one leg) and BOT-004 (50 x 200 actions) are seconds in
  total. Add PERF-005 so a regression shows up as a test, not as a slow CI.
- Split vitest into projects: `core` (unit + property, always), `validation`
  (BOT-*, VAL-*, DRV-010 statistical; included in `npm test` but with `numRuns`/seeds
  tuned to ~15 s total; `FULL=1` widens), `e2e` (Playwright, separate script).
  ```ts
  export default defineConfig({ test: {
    projects: [
      { test: { name: 'core', include: ['tests/core/**/*.test.ts', 'tests/ui/**/*.test.ts', 'tests/agent/**/*.test.ts'], isolate: false, pool: 'threads' } },
      { test: { name: 'validation', include: ['tests/validation/**/*.test.ts'], testTimeout: 30_000 } },
    ],
    coverage: { provider: 'v8', include: ['src/core/**'], enabled: false },
  }});
  ```
- Never spawn processes in tests except one CLI smoke (AGENT-001) on a tiny scenario;
  everything else uses the in-process `playScript`. Keep `tsc` out of vitest
  (`typecheck` is its own script; run it in CI alongside).
- `isolate: false` for the pure core project avoids per-file module re-evaluation (the
  biggest fixed cost in vitest for many small files).

### 3.4 spec-check hardening

`scripts/spec-check.ts` does `tests.includes(id)` over whole files, so an id in a comment or
in a `describe.skip` counts as covered. Tighten to test-name matches
(`/\b(?:it|test)(?:\.(?:each|concurrent))?\(\s*[`'"]([^`'"]*)/g`) and also report
*orphans* (ids used in tests but absent from SPECS.md) and `.skip`/`.todo` tests that
mention an id. Better still, run vitest with `--reporter=json --outputFile` once in CI and
check ids against *passed* test names; that catches skipped and failing "coverage".

---------------------------------------------------------------------------------------

## 4. Implementation order for the fastest playable vertical slice

Target slice: D03 Pause drill (straight course, 3 STOP + Pause 15 nodes, one timing CP,
stopwatch, speed/go callouts) playable in the browser, with a debrief that shows per-CP
error and a stop/cruise attribution, plus the same drill driven by the oracle and noPause
bots from the CLI. Everything after step 11 widens the slice without reworking it.

| # | file(s) | minimum spec set |
|---|---|---|
| 0 | `src/core/types.ts` (all shared types: Scenario, Course, Node, Exit, Instruction, Checkpoint, Hazard, Observation, Action, StageResult, RulesConfig, AidsConfig, CarSpec, SpeedoSpec, DriverSpec), `src/core/index.ts` | - (the contract that lets agents work in parallel; freeze before fan-out) |
| 1 | `src/core/units.ts`, `src/core/rng.ts` | UNIT-001..003, RNG-001, DET-001, DET-002 |
| 2 | `src/core/course.ts` (validateCourse), `src/core/ghost.ts`, `tests/fixtures/mini-courses.ts` | GHOST-001..006, 008..011, 013 |
| 3 | `src/core/car.ts`, `src/core/speedo.ts` (timewise only) | CAR-001..006, SPEEDO-001, 002, 004, 006 |
| 4 | `src/core/stopwatch.ts` | WATCH-001..003, 005, 006 |
| 5 | `src/core/driver.ts` (cruise, STOP stop/go, patience, speed callouts, read-back; straight only) | DRV-001..003, 008, 014, 015 |
| 6 | `src/core/sim.ts`, `src/core/scoring.ts` (advance/stepOnce, interpolated crossings, CP record, result, action log) | SIM-002, 003, 006..008, 010, 011, 015, 018..022, SCORE-001, 002, 006 |
| 7 | `src/core/perf-table.ts` (stopLoss by simulation, dwellFor, rampLead numeric) | PERF-001..004 |
| 8 | `src/core/attribution.ts` (cruise/stop/rounding/residual) | ATTR-001, 002, 005 |
| 9 | `src/core/drills/index.ts`, `src/core/drills/d03-pause.ts`, `content/scenarios/d03-pause.json` | DRILL-001, 002, 006, CONTENT-001 |
| 10 | `src/agent/protocol.ts` (playScript), `src/agent/bots/{oracle,noPause,random}.ts`, `src/agent/cli.ts` | AGENT-001, 003..006, BOT-003, BOT-004 (bots validate the engine before any pixel exists) |
| 11 | `src/ui/viewmodels/{stopwatch,clock,speedo,book,debrief}.ts`, `src/ui/loop.ts`, `src/ui/store.ts`, `src/ui/screens/{home,cockpit,debrief}.ts`, `src/ui/main.ts`, `index.html`, `vite.config.ts` | UI-001..003, 005, 007..010 |
| 12 | `playwright.config.ts`, `tests/e2e/smoke.spec.ts` | UI-006 |
| 13 | exits/turns/off-course: `driver.ts` turns, `course.ts` exits, excursion in `sim.ts` | DRV-004..007, 011, 013, SIM-023..025, GEN-007, 008, ATTR-004, 006, VAL-002 |
| 14 | `hazards.ts` (signals, trains, slow), TA | HAZ-001..003, DRV-009, 012, 016, 017, SIM-009, SCORE-010 |
| 15 | mechanical speedo, `calibration.ts`, timed segments in driver/ghost | SPEEDO-003, 005, CAL-001..003, GHOST-004, 007, 009, DRV-010, ATTR-003, VAL-001 |
| 16 | `generator/`, `content/traps.json`, `cameoSvg` | GEN-001..006, UI-004, DRILL-003 |
| 17 | full stage/campaign, remaining scoring, remaining drills, School/Reference screens | SCORE-003..005, 007..009, SIM-004, 005, 012..014, 016, 017, DRILL-004, 005, BOT-001, 002 |

**What to parallelise across agents** (after step 0 is committed; one owner for
`types.ts`, changes to it go through that owner):

- Agent A (pure math): steps 1, 2, 7, later 15's calibration and 16's generator.
- Agent B (vehicle): steps 3, 4, 5, later 13/14 driver behaviours and hazards.
- Agent C (world): steps 6, 8, 9 against A/B's *interfaces* using tiny hand-written stubs
  (`FakeCar` that moves at the target speed instantly is exactly the oracle car SIM-014
  needs anyway).
- Agent D (UI): step 11 against a `FakeSimulator` that returns scripted `observe()` frames;
  view-model tests need no engine at all.
- Agent E (harness): step 10 against the `Observation`/`Action` types with the same fake;
  wires to the real Simulator when C lands.
- Agent F (content/data): `content/traps.json`, hand scenarios, `cameoSvg` (step 16 data).

Rules that keep the fan-out from colliding: each agent owns the tests for its spec ids and
one directory; no agent edits another's files; run `SPEC_CHECK_SOFT=1 npm run spec:check`
until the wave merges; integration owner runs the full `npm test` + `typecheck` per merge.

---------------------------------------------------------------------------------------

## 5. Data model nits (DESIGN §3)

1. **Instructions need a resolved position of their own.** `Instruction` is anchored by
   `nodeId`, but a timed segment's `then` speed takes effect at `s_anchor + hold*T`, which
   is not a node. Add a resolve step shared by ghost, sim, attribution and debrief:
   ```ts
   interface ResolvedInstruction extends Instruction { s: number; sThen?: number }
   export function resolveBook(course: Course, book: Instruction[]): ResolvedInstruction[];  // validates order, fills s/sThen
   ```
   Never store `s` in the authored JSON (the book is the visible artefact; truth stays in
   `course.nodes`).
2. **`speed` vs `timed.holdSpeed`** duplicate each other; validation: when `timed` is
   present, `speed` must be absent or equal `holdSpeed`.
3. **`text` duplicates the structured fields.** Either generate `text` from the structure
   (`formatInstruction(ins, node)`) or parse it; do not maintain both by hand or the book
   and the truth will disagree in exactly the trap cases where it matters. Recommend
   generating, with an optional `textOverride` for hand-authored quirks. Same for `cameo?:
   Cameo "derived from node"`: derive at render time (`cameoFor(node, turn)`), keep only
   `cameoOverride?`.
4. **`sightDistance` vs `stopLineOffset`**: visibility is to `node.s`, braking is to
   `node.s - stopLineOffset`, decision point is `node.s - 150`. Enforce
   `sightDistance >= stopLineOffset + max(150, vApproach^2/(2*aDec)) + 2 s * vApproach` in
   `validateCourse`, where `vApproach` is the assigned speed at that point (the ghost
   knows it). Also define which `s` the checkpoint "sight zone" uses (cp.s, no offset).
5. **`Exit.controlFacingUs` is misnamed.** Our approach control is `Node.control`; what
   the side road carries is the sign the *cross traffic* sees (we see its back - the
   "side-road STOP facing away" trap). Rename to `Exit.theirControl` and give `Exit.angle`
   a documented sign convention (negative = left, matching DRV-007, measured from our
   heading, entry road excluded from `exits`).
6. **`Exit.isRoute` must be set at every route intersection**, including nodes with no
   instruction (needed to detect off course when the default behaviour is wrong, §1.2).
   Exactly one per node (GEN-007).
7. **`Node.kind` lacks a payload for landmarks** ("end of bridge", "pavement change"):
   add `landmark?: { text: string; side?: 'L'|'R'|'both' }`; `sign` already has one.
8. **`Hazard { s; kind; ... }` is undefined and overlaps with controls.** A SIGNAL is a node
   control with a cycle; a train is an event at an RR node. Attach them to the node to
   avoid a SIGNAL node without a cycle (or a cycle at an `s` that is not a node):
   ```ts
   interface Node { ...; signal?: { redS: number; greenS: number; offsetS: number }; train?: { startTod: number; durationS: number } }
   type Hazard =
     | { kind: 'slow'; fromS: number; toS: number; speedMph: number; passWindows: Array<{ fromS: number; toS: number }> }
     | { kind: 'construction'; fromS: number; toS: number; speedMph: number; flaggerStopS?: number; flaggerWaitS?: number };
   ```
9. **`section` is a range, not a point.** On an instruction it reads as a marker; define
   `Section = { kind; fromN; toN }` on the scenario (or "applies until the next marker").
   Transit/free zones affect the engine: no CP may lie inside, the ghost does not run
   there, and the following start/restart line re-anchors. Spell that out.
10. **`restartTime` is car-specific.** The book says "restart at your assigned time"; the
    number is `base + carMinute`. Model `restart?: { baseTod: number }` on the instruction
    and `carMinute` on the scenario (also drives the official start = `startTime +
    carMinute*60`).
11. **Named-but-undefined types**: `Course`, `CarSpec`, `SpeedoSpec`, `DriverSpec`,
    `RulesConfig`, `AidsConfig`, `Cameo`, `VisibleFeature`. Define them in `types.ts` in
    step 0; at least `Course { nodes: Node[]; lengthFt: number; excursions?: Record<string, ExcursionSpec> }`
    and a `RulesConfig` that lists every default quoted in SPECS (maxPerCp 300,
    sightZonePenalty 30, observationMissPenalty 60, earlyRestart, missedCpMinutes 30,
    trophyRunCounts false, rookieDropWorstLeg false, legResetModel 'R'|'C' from R07 §4.3).
12. **Unit-tagged names.** `s`, `speed`, `pause`, `sightDistance` mix ft, mph and seconds.
    Suffix fields (`sFt`, `speedMph`, `pauseS`, `sightDistanceFt`) or use branded types
    (`type Mph = number & { __mph: true }`). UNIT-001 does not prevent passing mph into a
    ft/s slot; names do.
13. **`Checkpoint.kind: 'observation'`** needs its stop rule parameter (`stopWithinFt`,
    default 200) in rules, and the finish observation CP should not be inside a sight zone
    of a timing CP.
14. **`n` numbering**: 1-based, contiguous, increasing with `s` (GHOST-013). The book is
    the only thing the player sees; a gap or reorder is a trap by accident.
15. **Observation rounding**: `approxDistanceFt` "rounded to 50" - specify round-half-up
    and that a feature at `d < 25` reads 0 and is removed once passed (SIM-026).

---------------------------------------------------------------------------------------

## Appendix: numeric check script used for the table at the top

```js
const a0=6.2,vMax=110,aDec=8,dt=0.01,mph=1.466667;
const accelTo=vT=>{let v=0,s=0,t=0;while(v<vT-1e-9){const a=a0*Math.max(0.15,1-v/vMax);v=Math.min(vT,v+a*dt);s+=v*dt;t+=dt;}return{t,s};};
const stopLoss=(vIn,vOut)=>{const dT=vIn/aDec,dS=vIn*vIn/(2*aDec),acc=accelTo(vOut);return (dT+acc.t)-(dS/vIn+acc.s/vOut);};
// stopLoss(45*mph,45*mph) = 11.02 ; accelTo(35*mph).t = 11.15 ; exact lead for 20->50 = (v2*T_r - s_ramp)/(v2-v1) = 6.08 vs T_r/2 = 6.99
```

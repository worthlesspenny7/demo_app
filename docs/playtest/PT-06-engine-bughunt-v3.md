# PT-06 - Engine and agent-protocol bug hunt on the V3 build

Date: 2026-10-04. Build under test: `4311bf5` (HEAD; the tree was clean when I started), `ENGINE_VERSION` 3.0.0, 447 unit tests green at the
start (`npx vitest run`). Part-way through, another editor began uncommitted work in `src/core` and `src/ui` (TAF-003 paper-sheet fields, CAMEO sign shapes, Information Box,
12 mph chart row): I re-ran every repro and sweep below on that dirty tree and all results are unchanged. Nothing in `src/`, `tests/` or git was touched by me; every repro is a standalone script in `playtest-scripts/pt06-*.ts`
(`npx tsx playtest-scripts/<name>.ts`, no build needed).

Method (same spirit as PT-01): documents first (STATUS HANDOFF, API.md V2/V3, PT-01, SPECS V2/V3), then the code paths of the nine areas, then
repro scripts that drive `Simulator` directly or through `Session.handle` (the `npm run sim` protocol), then batch sweeps (50 generated days,
every generator profile x 30 seeds, every drill x tier x 4 seeds with the oracle, 100 random-bot runs, ~500 fuzzed sessions, 4000 hostile payloads).
Hidden truth was used only to explain a finding after it showed up. No sub-agents were spawned (the areas overlap too much in `sim.ts`).

Severity (PT-01 scale): HIGH = wrong result or a lost session in a documented path; MEDIUM = corrupt or stuck state on plausible input, a debrief
that blames the player wrongly, or hidden-state/scoring semantics wrong; LOW = edge, hygiene, doc or latent.

**Result: 0 HIGH, 8 MEDIUM, 19 LOW.** The core is sturdy: 50 'day' seeds validate clean and the oracle finishes all 50 with no DNF; the random bot, an
all-actions fuzz and 4000 hostile payloads produce no exception and no non-finite number in `observe()` / `result()` (except through unknown extra
fields, bug 17); two identical runs and `replay()` agree bit for bit (except the clock-read hole, bug 21). The bugs are semantic.

---------------------------------------------------------------------------------

## 0. Ranked list

| # | Sev | Area | One line | Repro |
|---|-----|------|----------|-------|
| 1 | MEDIUM | 1 start / protocol | A `call.go` sent while the car is at v = 0 but not at a node is remembered and fires at the next STOP: that stop is left with no dwell | pt06-stale-go.ts |
| 2 | MEDIUM | protocol | `call.pullover` has no undo: after `call.go` the driver says "Going" and never moves again | pt06-pullover.ts |
| 3 | MEDIUM | 1 start / protocol | `advance {untilEvent}` in the pre-read runs straight through the launch time (the driver's "give me 30 seconds" prompt is a `readback`, which untilEvent ignores) | pt06-proto-start.ts |
| 4 | MEDIUM | 9 determinism | Hidden hazards (cross-traffic holds) and driver noise come from one shared RNG, so the same seed gives different holds to different navigators | pt06-rng-coupling.ts |
| 5 | MEDIUM | 3 / 5 transits, findings | `oneMinuteMistake` and `lateLaunch` blame a car that simply ARRIVED 50-70 s (or any time) after the restart / OUT time | pt06-onemin-late-arrival.ts, pt06-onemin-late-restart.ts |
| 6 | MEDIUM | 5 instruments | `clockForTimeOfDay` is decided at the instant the exact-transit IN sign is crossed, so reading the clock at the sign is flagged | pt06-in-clockread.ts |
| 7 | MEDIUM | 2 TA | Result peeking: `ta.request` is accepted after the stage has finished and `result()` shows the committee's measured delay, so an agent can iterate the request | pt06-ta.ts |
| 8 | MEDIUM | 8 robustness | A scenario file written before V2/V3 (no `asp`, partial `rules`) loads without complaint and then draws pace cars with NaN positions, scores NaN, or throws | pt06-legacy-json.ts |
| 9 | LOW | 2 TA | The 900 s window closes one tick early on ~3-20 % of late-day crossings (float compare of `tod` against `tod + 900`) | pt06-ta-window.ts |
| 10 | LOW | 2 TA | A normal printed-pause STOP inside a tractor / construction / accident zone adds its stopped time to the qualifying delay | pt06-ta-stop-in-zone.ts |
| 11 | LOW | 2 TA | Requests under 10 s are filed and rounded UP to 10 s; a second request for a leg silently replaces the first; non-integer leg / line numbers are accepted | pt06-ta.ts |
| 12 | LOW | 6 scoring | Stage score rounds exact half-hundredths down for the 1939 factor (5 x 0.845 -> 4.22, should be 4.23) | pt06-score-rounding.ts |
| 13 | LOW | 6 scoring | `compareStandings` ties broken by float noise; `championshipTotal` double counts a repeated stage; `ageFactor(NaN)` = 0.5 | pt06-standings.ts, pt06-scoring.ts |
| 14 | LOW | 7 generator | Unprinted YIELD / BLINKER nodes (3 of 442 timed lines) and the plain slow-vehicle zone (19 of 442) sit inside stopwatch-timed intervals | pt06-gen-timed-nodes.ts, pt06-timed-blinker.ts |
| 15 | LOW | protocol | Stale events: an act's own events (`depart`, `release`) stop the next `advance {untilEvent}` after 0.1 s (PT-01 LOW 20 is only half fixed); `seconds` is ignored when `untilEvent` is set | pt06-stale-events.ts, pt06-advance-args.ts |
| 16 | LOW | protocol | Scheduled `when {event:'carStopped'}` fires in the pre-read and departs the car; a malformed `when` is acked and never fires; the schedule is uncapped | pt06-sched.ts |
| 17 | LOW | protocol | Unknown extra fields on an action are logged and kept verbatim (Infinity / NaN reach `result().events`, 5 MB payload -> 10 MB result) | pt06-extra-fields.ts |
| 18 | LOW | protocol | `observe()` hands over things the UI hides or the spec withholds: fractional `tod`, `clock.hourAngle` (exact time), `launch`, `startQueue.carAheadLeavesTod/sitting`, `paceCars.errorSeconds` | pt06-leaks.ts |
| 19 | LOW | 1 pace cars | `observe().paceCars` is not suppressed in the calibration run (API.md says it is; the `ahead[]` car and the cue are) | pt06-pace-cal.ts |
| 20 | LOW | CLI | `npm run sim` defaults to the ANALOG watch (INST-002 director's setup unusable by default); `gen:day` is not a profile name | (shell, section 3.20) |
| 21 | LOW | 9 determinism | `observe({clock:true})` logs a clock read that is not an action, so `replay()` loses it | pt06-replay-clock.ts |
| 22 | LOW | 9 determinism | `rng.fork(name)` hashes the parent's current state, not (seed, name) (DET-001) | pt06-rng-fork.ts |
| 23 | LOW | 5 instruments | `lapTable` is unbounded while recall is limited to 10 laps; WATCH-006 and WATCH-008 disagree on reset | pt06-clock.ts |
| 24 | LOW | bots | The oracle never laps at a timed anchor, so `clockForInterval` fires on every timed line of every day (114 of 114 in 12 days) | pt06-discipline.ts |
| 25 | LOW | perf table | `stopLoss(0, x)` is -Infinity / NaN (latent: reachable through `taAdvice` if a stop starts from 0 mph) | pt06-accel.ts |
| 26 | LOW | CLI | `{"type":"quit"}` answers with an `error` ("unknown request") before closing | pt06-sched.ts section note |
| 27 | LOW | spec/doc | Minor: sub-second `advance` overruns to 0.1; sub-0.5 s rounding asymmetry of negative perfect-time ties; `speed.resume` while the ghost is at a pause leaves the emergency speed set | notes in 3.27 |

---------------------------------------------------------------------------------

## 1. MEDIUM bugs

### 1. A premature `call.go` at v = 0 is stored and spent at the next stop (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-stale-go.ts` (onestop; `start` then `call.go` in the same instant, then the normal play).
Expected (PT-01 BUG 1 fix intent, DRV "Already rolling"): a go that does not match a stop the car is in the middle of is refused or ignored.
Actual: `no premature go: stopped at 28853.9, waiting for the navigator` versus `premature go right after start: ... released 0.0 s after stopping`.
The driver answers "Go, got it" and `goRequestedEarly` stays true until the next `beginWait`, where `driverStep` releases the stop at once (zero dwell, the
printed pause skipped, a 10 s early leg). The same flag is set whenever `call.go` meets `car.v === 0 && phase === 'running'` without `waitingForGo`:
behind a stopped school bus (TAF-002, V3), at a dead end, after `call.pullover`, in the first tick after `start`.
Fix: `src/core/sim.ts`, `act()` case `'call.go'` (the `else if (this.car.v === 0 && this.phase === 'running')` branch) and `driverStep()` (the
`goRequestedEarly` consumption): only honour it when the car is braking to a stop node within a few feet (`car.mode === 'stopping'`, `stopAt !== null`), store
`goRequestedAt = tod` and discard it after ~1.5 s, and clear it in `depart()` and `release()`. Add a regression test.

### 2. `call.pullover` is permanent (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-pullover.ts` (straight; 20 s, `call.pullover`, `call.go`, `call.speed 30`).
Expected: pulling over is a stop the navigator can end with go (it logs `waitReason 'finish'`, which `call.go` accepts).
Actual: after `call.go` the driver says "Going", `waitingForGo` is false, and the car stays at v = 0 for good, even after `call.speed 30` (`pullover` is never
cleared, `driverStep` keeps `targetTrue = 0` and stops again at once). The stage can only end by the 30-minute timeout (DNF). `call.pullover` is in
`hello.actions` and DESIGN.md section 15.
Fix: `src/core/sim.ts`, `release()` (clear `this.pullover = false` when the wait was the pull-over) or `act()` `'call.go'` (clear it), and make
`call.speed` / `call.go` the documented way out; or drop the action from `ACTION_TYPES` if nothing uses it (the UI has no key for it).

### 3. `advance {untilEvent}` in the pre-read blows through the launch (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-proto-start.ts` (asp 2, 300 s pre-read, one `advance {untilEvent:true, maxSeconds:600}`).
Expected (START-001): an agent playing the start procedure is woken near the launch time; the driver's "Give me about 30 seconds before we go" is a prompt.
Actual: the reply is `{seconds:600, stoppedOn:null, events:["driver:Give me about 30 seconds before we go"], secondsToStart:-300, phase:'preread'}`:
the prompt is `kind: 'readback'` and `Session.advance` drops readbacks from the stop events, nothing else marks the launch (no `launchWindow`
stop), and the stage does not auto-depart until 30 minutes late. The agent leaves 5 minutes late with no way to have known.
Fix: `src/core/sim.ts`, `launchTick()`: say it as `'question'` (it is a request); `src/agent/protocol.ts`, `advance`: add a stop reason `launch`
when `observation.launch.secondsToLaunch <= 30` or `tod >= startTime` in the pre-read, and clamp an untilEvent advance in the pre-read to the start time.

### 4. Hidden hazards depend on the navigator's actions (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-rng-coupling.ts` (varied seeds 2, 5, 7, 11 with `trafficWaitProbability 0.6`; oracle vs rookie vs noPause).
Expected (DET-001 spirit, SIM-025, "same seed" for daily seeds, drills, campaign benchmarks): the cross-traffic hold at a given STOP is a property of
the scenario. Actual: seed 2 gives oracle `0 / 10.8 / 7.6 s`, rookie `0 / 0 / 1.8 s`, noPause `0 / 15.0 / 2.7 s` at the same three stops. `beginWait()` draws
`this.rnd.chance(p)` / `this.rnd.next()` from the stream that also feeds the driver's speed-error process (every tick) and `beginRamp()` (two `gauss` draws
per `call.speed` that changes the target), so the draws shift with how many speed calls the navigator made.
Fix: `src/core/sim.ts`, `beginWait()` (traffic): draw from a keyed stream, `rng("<seed>:traffic:<nodeId>")`; `beginRamp()` and `driverStep()` use their own
streams (`rng("<seed>:ramp")`, `rng("<seed>:drv")`). Changes every score: bump `ENGINE_VERSION` to 3.0.1 and refresh `tests/golden`.

### 5. `oneMinuteMistake` / `lateLaunch` blame a late ARRIVAL (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-onemin-late-arrival.ts` (exact transit, car at 33 mph, arrives 56.7 s after OUT and leaves at once) and
`pt06-onemin-late-restart.ts` (restart 66.7 s after the car arrives). Also `pt06-drills-oracle.ts`: D13 tier 1 seed 2 gives the oracle `lateLaunch` 83.6 s for a car that arrived at the
restart 81 s after its time (D12 tier 1/2 seed 2 give 20.2 / 13.3 s the same way).
Expected (INST-002, START-001): the finding names a misread minute / a late launch, i.e. a departure the navigator could have made earlier.
Actual: "Exact-transit OUT (line 3) left 57 s late: the minute was misread" and "Restart (line 3) left 67 s late: the minute was misread" for a car that was not
there yet; late arrivals of other sizes are reported as `lateLaunch` ("launch = own time minus the standing-start net loss").
Fix: `src/core/sim.ts`, `checkOneMinute()` and `recordStartDelta()` (called from `release()` for restarts and OUT): take the arrival time
(`this.waitStartTod`) and skip the late-side findings when `arrival >= target - 2` (the departure was not discretionary); add a separate
`lateArrival` finding if wanted.

### 6. `clockForTimeOfDay` at an exact-transit IN is decided too early (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-in-clockread.ts`.
Expected (WATCH-009, INST-002): the navigator takes the IN time from the clock as the sign goes by.
Actual: `checkClockUse('Exact-transit IN time')` runs in `crossNode()` at the instant of the crossing and looks only backwards (60 s), so a `clock.read`
0.5 s or 1 s AFTER the sign is flagged and only a read before the sign passes: `read 0.5 s after the sign: ["Exact-transit IN time (line 2) was taken..."]`,
`read ~1 s before: []`. The OUT and restart checks run at the go, so they are fine.
Fix: `src/core/sim.ts`, `crossNode()` / `disciplineFindings()`: record the IN crossing and decide in `disciplineFindings()` (or 5 s later in `doTick`) whether a
`clock.read` or TOD-mode read lies in `[-60, +5]` s of the crossing.

### 7. Result peeking through the TA window (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-ta.ts` (section "after finish").
Expected (TAF-001/TA-003): the form is filed from what the navigator measured, not from the committee's answer. Actual: when the stage finishes inside the 15 minute
window (time stops, so `secondsLeft` stays > 0) `fileTa()` still accepts requests (`after finish ... request filed; leg error 124 -> 84`), and
`result().score.legs[i].taReason` prints "measured delay 1m38s, 1m00s could have been made up", the committee's hidden numbers. An agent can read the answer and
re-file until the credit is exact.
Fix: `src/core/sim.ts`, `fileTa()`: refuse when `phase === 'finished'` (keep `scorecard.ack` allowed); or withhold `taReason` numbers from `result()` until the window is closed.

### 8. Legacy / partial scenario files (MEDIUM)
Repro: `npx tsx playtest-scripts/pt06-legacy-json.ts`.
Actual: a scenario JSON with no `asp` validates clean and then draws pace cars and a start queue with `position: null` (`this.sc.asp < 1` is false for
`undefined`); partial `rules` (no `maxLate`) validate clean and score `raw NaN`; no `rules` throws in the constructor (`clockMinuteSlop`).
`npm run sim -- --scenario file:x.json` and any saved scenario hit this.
Fix: `src/core/course.ts`, `validateScenario()` (require the `RulesConfig` keys and a numeric `asp`) and `src/agent/cli.ts`, `loadScenario()` (merge
`DEFAULT_RULES`, `asp ?? 0`, `timeZone`, `bookStyle`); `src/core/sim.ts`, `paceCarsNow()` guard `!(this.sc.asp >= 1)`.

---------------------------------------------------------------------------------

## 2. LOW bugs

### 9. TA window float edge
`npx tsx playtest-scripts/pt06-ta-window.ts` (a long pre-read plus `skipPreread` puts the TA point at tick ~162,700, like a 13:00 end-of-stage point): a request at
exactly 900.0 s after the TA point is refused with "window has closed" in 63 of 300 crossing ticks (`windowOpen` is false and `secondsLeft` shows 0).
Cause: `tod = tod0 + tick*0.1` and `endTod = (tod0 + k*0.1) + 900`, so `tod0 + (k+9000)*0.1 > endTod` for ~3 % of ticks past tick 154,841 (about 20 % in some ranges).
Fix: `src/core/sim.ts`, `fileTa()` (`this.tod > this.taWindow.endTod`), `taState()` (`this.tod <= w.endTod`) and `scorecard.ack`: compare with `+ 1e-6` or store `endTick`.
The same `tod`-vs-sum comparison exists in the pull-up (`atSign: tod < leavesTod`) and the split hold (`isFrozen`): one tick, harmless.

### 10. A printed-pause stop inside a qualifying zone is counted as delay
`npx tsx playtest-scripts/pt06-ta-stop-in-zone.ts`: the same 2500 ft zone gives `taQualifying` 47.0 s with a STOP inside it and 35.4 s with the STOP outside; the stopped
seconds are accrued (`de = dt - ds/vg`, `vg` = ghost speed before the line) although the book's pause pays them (TA-004: only the obstacle's delay qualifies).
Fix: `src/core/sim.ts`, `doTick()`: do not call `accrueEpisode` while `this.waitingForGo || this.curStop`, or subtract `pause + stopLoss`.

### 11. TA form hygiene
`pt06-ta.ts`: `ta.request seconds 0.4 / 3 / 4.9 / 5 / 9.99` are filed and adjusted to 10 (rounded UP past the request when measured >= 5 s; the rule says at least 0m10s and
"to the possible detriment"); two requests for leg 1 (100 then 10) leave `taDeclared {1:10}` and two rows with status `filed`; `legIndex: 1.5` and `fromLine: 2.5` pass
`validateAction` (`legIndex 1.5` is refused later with "Leg 1.5..." wording, `fromLine 2.5` is filed). The rounding rule itself matches TA-001 at both edges.
Fix: `src/core/sim.ts`, `validateAction()` (`Number.isInteger` for legIndex/fromLine/toLine) and `fileTa()` (`seconds < 10` refuse; second request for a leg: refuse or mark the earlier row `superseded`).

### 12. Stage score half-rounding
`npx tsx playtest-scripts/pt06-score-rounding.ts`: `raw 5 x 0.845 = 4.225 -> 4.22`, `raw 23 -> 19.43` (half-up gives 4.23 / 19.44) but `raw 7 -> 5.92`. 266 of the first
3000 raw values differ by 0.01 s at the 1939 factor (REG V.C.2.e, REG-002 "rounded to the nearest 0.01 s"); the 0.80 / 0.85 / 0.915 / 1.0 factors are exact.
Fix: `src/core/scoring.ts`, `scoreStage()` and `championshipTotal()`: integer arithmetic, `Math.floor((raw * milli + 5) / 10) / 100` with the factor in thousandths.

### 13. Standings, championship, age factor edges
`pt06-standings.ts`: `compareStandings` uses `a.total !== b.total`; totals are sums of 0.01-rounded scores (10.10 + 20.20 + 30.30 = 60.599999999999994), so a true tie
goes to the lower float, not the older Scoring Year (REG-004). `championshipTotal` counts a repeated stage number twice (`pt06-scoring.ts`: raw 30 for two entries of stage 1);
`ageFactor(NaN)` is 0.5, `ageFactor(Infinity)` 1. Checked fine: caps at exactly 120/300 (120 not capped, 121 capped; -300 / -301), 30-minute miss at 1800 / 1801, DNF + 180 per
missing leg, fewer legs than discards (afterDiscards 0), stage 0 and 10+ ignored, table 1900-1954 matches the regulations row by row.
Fix: `src/core/scoring.ts`, `compareStandings()` (compare `Math.round(x * 100)`), `championshipTotal()` (one entry per stage), `ageFactor()` (reject non-finite).

### 14. Unprinted nodes inside timed intervals
`npx tsx playtest-scripts/pt06-gen-timed-nodes.ts`: of 442 timed lines in 50 days, 3 span a YIELD or BLINKER node that has no book line (seed 14 line 104: +6.4 s inside the
interval; seed 20 line 162: +3.8 s; `pt06-timed-blinker.ts`), and 19 span the plain slow-vehicle zone the generator always places 400 ft after the previous line
(`generate.ts` "slow traffic ... placed just after the previous instruction node"). `validateScenario()` only checks the next PRINTED line with speed / pause / turn / timed.
A make-up inside the interval is a `timedIntervalDisturbed` finding, so these seeds cannot be driven clean.
Fix: `src/core/generator/generate.ts` (the timed-placement guard `noTimedWithin` and the slow-zone placement) and `src/core/course.ts`, `validateScenario()`: treat any node with a control, any route turn and any slow zone as a boundary of a timed interval.

### 15. Stale events and `seconds` + `untilEvent`
`pt06-stale-events.ts`: events from an `act` (`depart`, `release`) stay in the log and stop the next `advance {untilEvent}` after 0.1 s (`stoppedOn: 'release'` right after `call.go`,
`'driverMessage:Leaving 30 s early'` right after `start`); only `readback` kind is filtered. `pt06-advance-args.ts`: `advance {seconds:10, untilEvent:true}` ran 106.5 s (the bound
is `maxSeconds ?? 120`, `seconds` is ignored); `advance {seconds:0.05}` returns 0.1.
Fix: `src/agent/protocol.ts`, `advance`: `const want = req.untilEvent ? Math.min(req.maxSeconds ?? 120, req.seconds ?? Infinity) : ...`; start the event scan at `this.sim.events.length` taken
at the beginning of the advance and put the act's own events in the ack reply instead.

### 16. Scheduling
`pt06-sched.ts`: a `call.go` scheduled `when {event:'carStopped'}` before the start fires on the first tick and departs the car (`o.carStopped` is true in the pre-read);
`when {elapsed:'x'}` and `when {event:'bogus'}` are acked `scheduled:true` and never fire; 20,000 scheduled actions are accepted. (The PT-01 BUG 1 case, a go scheduled on `carStopped` after the start, works.)
Fix: `src/agent/protocol.ts`, `fireScheduled()` (`carStopped` only when `phase === 'running'`) and the `act` branch (validate `elapsed` / `watchReads` finite >= 0, `event` in the enum, cap the list at ~100).

### 17. Extra action fields are kept verbatim
`pt06-extra-fields.ts`: `{"type":"note","text":"hi","junk":1e999,"blob":"<5 MB>"}` is acked; `act()` logs `{...a}` for `watch.* / line.* / note / bezel.set` and keeps the action in
`actions[]`, so `result().events` gets Infinity / NaN (JSON null) and the result grows to 10 MB. The hostile sweep in `pt06-fuzz.ts fuzz` finds the same (`result.events[2].detail.fromLine=Infinity`).
Fix: `src/core/sim.ts`, `act()`: rebuild the action from a per-type whitelist before recording or logging it.

### 18. Observation contents that bypass the rules
`pt06-leaks.ts` (aids rung 0): `tod` has 0.1 s resolution, `clock.hourAngle` encodes the time of day to the second even while `minuteAmbiguous` (INST-001 hides `minute` and nothing else,
so the "director's setup" cannot be enforced on an agent), `launch.launchTime/netLoss` is present at every rung (UI-037 shows it at rung >= 2), `startQueue.carAheadLeavesTod` and `cars[].sitting`
announce when the car ahead will leave and which one will sit, `paceCars.*.errorSeconds` carries the seeded hidden error of the cars one minute away ("shown here for the debrief", START-002).
Fix: `src/core/sim.ts`, `observe()`: round `tod` to whole seconds below rung 3 (or give the agent `clockSecond` instead), drop `hourAngle`'s sub-minute part when ambiguous, null `launch` below rung 2,
omit `errorSeconds` / `sitting` / `carAheadLeavesTod` until `phase === 'finished'`.

### 19. Pace cars in the calibration run
`pt06-pace-cal.ts`: at the start of the calibration range `observe().paceCars.behind` (with `errorSeconds`) is present in 7 of 1267 samples at rungs 0, 1 and 3; API.md START-002 says suppressed
(the `ahead[]` car and `cues.gainingOnCarAhead` are). Fix: `src/core/sim.ts`, `observe()`: `paceCars` gated by `!calRun`.

### 20. CLI defaults
`printf '{"type":"act","action":{"type":"watch.mode","mode":"tod"}}\n{"type":"act","action":{"type":"clock.read","source":"stopwatch"}}\n' | npx tsx src/agent/cli.ts --scenario builtin:onestop --stdin`
returns `stopwatch.kind analog, mode chrono` and "The watch is in chrono mode: switch it to TOD" (misleading on an analog watch). `cli.ts` `arg('watch','analog')` contradicts the standing rule
(digital with TOD is the default, engine `DEFAULT_WATCH`) and API.md's INST-002 recipe. `--scenario gen:day` fails ("unknown profile day"; the day is `gen:fullStage`).
Fix: `src/agent/cli.ts`: default `DEFAULT_WATCH`, accept `gen:day` as an alias; `src/core/sim.ts` `clock.read`: say "this watch has no TOD mode" when `kind === 'analog'`.

### 21. `observe({clock:true})` is not replayable
`pt06-replay-clock.ts`: live `clock reads 1`, replay `0` (the read is an `instr()` call, not an action). The UI uses the `clock.read` action so only API callers are hit.
Fix: `src/core/sim.ts`, `observe()`: record `clock.read` through `act` (or drop the option).

### 22. `rng.fork` is not reproducible from (seed, name)
`pt06-rng-fork.ts`: `rng(5).fork('speedo')` and the same fork after two draws differ (`fork` hashes the current state `a`). DET-001 requires (seed, name). Only `sim.ts` forks (once, before any draw),
so no result changes today. Fix: `src/core/rng.ts`, `fork()`: hash the construction seed.

### 23. Lap memory and reset spec
`pt06-clock.ts`: 55 laps stored and returned in `observe().stopwatch.lapTable` after a day while recall cycles the last 10 (`LAP_MEMORY`); a recall after the 5 s auto-release steps into lap recall and pins the display on that lap
(reasonable, but undocumented); a lap on a never-started watch stores 0. SPECS WATCH-006 ("reset is allowed anytime on digital") contradicts WATCH-008 and the engine ("only while stopped unless held").
Fix: `src/core/stopwatch.ts`, `lap()`/`lapTable()` (cap at a documented size) and the spec text.

### 24. Oracle and the discipline findings
`pt06-discipline.ts`: with `useWatch` the oracle laps at stops and calibration points but not at timed lines, so every timed line is a `clockForInterval` finding on both watch kinds
(114 of 114 in 12 days; `tests/drills.test.ts` BOT-007 only asserts the other two kinds). Not an engine bug: `src/agent/bots.ts`, `OracleBot.onTick()` (timed anchor: `watch.lap` when `useWatch`).

### 25. `stopLoss(0, x)` / `stopLoss(x, 0)` are not finite
`pt06-accel.ts`: `stopLoss(0,35) = -Infinity`, `stopLoss(35,0) = NaN`. Latent: `release()`, `taAdvice()` and the school-bus path call it with `Math.round(ghostSpeed)` / `curStop.vIn`, which is 0 only if a train or bus
wait starts while the ghost is at a pause. Fix: `src/core/perf-table.ts`, `stopLoss()` (return 0 for speeds <= 0).

### 26. `quit`
`cli.ts` breaks on `req.type === 'quit'` after `session.handle` has already answered `{"type":"error","message":"unknown request"}`. Fix: answer `{type:'bye'}` before the loop ends.

### 27. Small notes (no repro needed)
- `speed.resume` while the ghost is at a pause (assigned 0): `emergency` is cleared but the emergency target speed stays set until the next `call.speed`, silently.
- `scoreLeg` rounds `actual - perfect` with `Math.round`, so an exact -2.5 s early scores 2 and +2.5 late scores 3; perfect times are fractional so this is rare.
- `scorecard.ack` before the requests does not lock the requests (TAF-001 does not say it should).

---------------------------------------------------------------------------------

## 3. Coverage by the nine areas, with what was found clean

1. **Start procedure.** `pt06-start.ts`: position n = base + n (asp 1: base + 60 s), the car ahead leaves at own - 60 k + 0-3 s (sometimes +12-35 s), `pullUp` refused until it has left and
   allowed on the tick it leaves, `start` / `call.go` never need it (spec), launch = own - `accelLoss(speed)` rounded to 0.1, `pt06-launch-edges.ts` thresholds exact (late > 2.0 s, early > 3.0 s,
   one-minute 50-70 s of own time, boundaries 2.0 / 3.0 not flagged), pace cars at rung 0 (45 of 400 s, shared 45 s windows) and rung 1-3 (369 of 400 s) with `ahead[]` entry and gaining cue, none with
   asp 0, and 24 days at asp 1-8 where the oracle's every start and restart lands within 2 s of its launch time (`pt06-gen-all.ts`). Bugs: 1, 3, 15, 16, 18, 19.
2. **Time allowance.** Validation outside a TA point and after the window, 10 s rounding at both edges (77 s -> 70 / 80 by measured < / >= 75), credit floor to 10 s and never early, exactly 900.0 s,
   `legNumberFor` (1 / 2 / 2 around the crossing), committee credit vs measured (train 98.2 s, recoverable 60.4, possible 37.8 -> credit 30 of 40), paper mode (refused mid-run; the filing at the red checkpoint is covered by `tests/v3-core.test.ts`, not re-run here),
   a leg with a wrong turn plus a train (credit unchanged, only the train counts), ack ordering. Bugs: 7, 9, 10, 11.
3. **Exact transits.** `pt06-transit.ts`: IN to the second (28890), OUT = IN + 600, go at -65 ... +65 s, hour rollovers 09:41 / 11:59 / 23:55 (no error), IN on a STOP node (IN = first crossing after the go),
   advisory transit has no hold (by code), leaving early / late shifts only the next leg's error, D16 x 30 seeds x 3 tiers: oracle 0 false findings, wrongMinute bot flagged 90 / 90. Bug: 5.
4. **Make-up ledger.** `pt06-makeup.ts`: begin at exactly +3 mph and 8 % (37.8 at 35 is not one, 38 is), drop at a speed-change sign ("Assigned speed is 45 now") and re-apply, `timedIntervalDisturbed` needs
   a make-up call plus 3 s cumulative over 1.03 x hold + 0.3 mph after a 4 s grace (2.5 s not flagged, 2 + 2 s flagged), a make-up begun before a timed line with the same hold speed is flagged. No bug.
5. **Instruments.** `pt06-clock.ts`: ambiguity windows [0, 5) and (55, 60) exact, slop 0 / 1 / 30 / 60 behave, TOD-mode reads count, split hold releases at 5.0 s, lap table across reset correct;
   discipline false positives: bug 6; findings: 24.
6. **Scoring.** `pt06-scoring.ts`: caps, 30-minute miss, DNF, discards, ties, age table. Bugs 12, 13.
7. **Generator.** `pt06-gen.ts` (50 'day' seeds): `validateScenario` clean, oracle finishes 50 / 50 (raw 0-41; 12 seeds >= 14 because of trains, unprinted yields and noPause traps, none DNF), 4-6 timing checkpoints
   everywhere, speeds 10-55, TA point after every End timed portion, Column C prints a pause exactly where `ins.pause` is set (2371 / 2371, `pt06-colc.ts`), `pt06-gen-all.ts`: every other profile x 30 seeds clean
   (`checkRouteExits` too). Bug: 14.
8. **Random bot / fuzz.** 100 seeds, no exception, no non-finite (`pt06-fuzz.ts random`); `pt06-fuzz.ts fuzz` and `pt06-fuzz2.ts 400` (all action types, aids rungs 0-3, asp 0-6, days / legs / drills, long advances): no
   throw, tod monotonic, phase only forward, finite observations and results; 4000 hostile payloads answered `ack` or `error` only. Bugs: 8, 17.
9. **Determinism.** Two live runs identical and `replay()` identical for 7 bots x 3 days and 3 bots on varied (`pt06-replay.ts`, 24 cases) and for the fuzz sessions. Bugs: 4, 21, 22.

## 4. Not covered / limits
- No UI or Playwright work. The `file:` loader was exercised only through objects, not through `--scenario file:`.
- Navigation-error TA was tested once (a wrong left at a crossroads plus a train); lunch / promoted-stop early-departure scoring and `speed.emergency` were read, not stress-tested.
- The generated 'slow traffic in a timed interval' (bug 14) may be intentional; it is listed because it makes a clean timed interval impossible.
- Comparison against V2 for "asp 0 drills unchanged" was not possible (V3 changed generator speeds); the golden transcript test is the only check.

## 5. Script index (all in `playtest-scripts/`)
pt06-common.ts (helpers) | pt06-start, pt06-launch-edges, pt06-proto-start, pt06-pace-cal, pt06-stale-go, pt06-stale-events, pt06-sched, pt06-pullover, pt06-advance-args, pt06-extra-fields, pt06-leaks |
pt06-ta-window, pt06-ta-window-day, pt06-ta, pt06-ta-stop-in-zone, pt06-ta-nav-paper | pt06-transit, pt06-onemin-late-arrival, pt06-onemin-late-restart, pt06-in-clockread, pt06-d16 |
pt06-makeup, pt06-clock, pt06-discipline | pt06-scoring, pt06-score-rounding, pt06-standings, pt06-30min | pt06-gen, pt06-gen-all, pt06-colc, pt06-gen-timed-nodes, pt06-timed-blinker, pt06-oracle-day, pt06-drills-oracle |
pt06-fuzz, pt06-fuzz2, pt06-legacy-json, pt06-accel | pt06-replay, pt06-replay-clock, pt06-rng-coupling, pt06-rng-fork.
Sweeps take 5-90 s each (`pt06-gen.ts` 78 s, `pt06-gen-all.ts 30` 71 s, `pt06-replay.ts` 85 s).

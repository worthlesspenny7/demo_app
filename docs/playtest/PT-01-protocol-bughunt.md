# PT-01 - Engine and agent-protocol bug hunt (LLM playtester, navigator's seat)

Date: 2026-10-03. Engine under test: `384a2e4` (sessions A/seed 2 and the first hostile
batch started on `834132c` + dirty tree; sim.ts was rewritten by a concurrent editor at
09:56 and committed at 09:57 - every finding below was re-verified on `384a2e4` and the
two that the commit fixed are marked FIXED). `ENGINE_VERSION` is `1.0.0` on both.

Scope: `src/core` + `src/agent` through the JSON-lines protocol (no UI). Tools:
`scripts/rally-session.sh` (until it died, see BUG 6), then the identical request lists
replayed in-process with `playScript` (deterministic; transcript = replay script), and
`npx tsx src/agent/cli.ts --stdin` for anything that needed the real JSON parsing path.
Hidden truth (`{"type":"truth"}` and a node dump) was only read *after* each call to
annotate the log, never to decide a call.

Card used (computed from `src/core/perf-table.ts`, 1939 Ford):
`accelLoss 0->35 4.4 s, 0->40 5.2 s`; `stopLoss(40->35, 12-mph turn cap) 9.46`,
`stopLoss(35->40, cap) 9.85`; so dwell at "Pause 15" = 5.5 s / 5.2 s;
`rampLead 35->45 2.55, 45->30 1.9, 30->40 2.3`; `turnLoss90 40->35 7.45`.

---------------------------------------------------------------------------------

## 1. Sessions run

| # | Scenario | Who | Watch | Result (per-leg error, + = late) | Notes |
|---|----------|-----|-------|----------------------------------|-------|
| A1 | builtin:varied seed 2 | me, careful navigator, rung 0 | digital | leg1 **+1**, leg2 **+2** (raw 3, "champion"; was +1/+1 on the pre-commit engine) | 78 requests; depart 5.2 s early, dwell 5.5/4.2/5.5, 37 mph after the T to buy back turn loss |
| A2 | builtin:varied seed 5 | me, careful navigator, rung 0 | digital | leg1 **+5**, leg2 **+1** (raw 6, "expert") | 79 requests; same technique; pre-armed `call.turn` on `featureVisible STOP` |
| A0 | builtin:varied seed 2 | oracle bot (truth) | analog | 0 / 0 (2 aces) | reference |
| B | builtin:onestop (expert, rung 3) | me, hostile | analog + digital | 9 CLI runs, 1 playScript run | see BUGS |
| B9 | varied seed 2 | me, deliberately wrong turn | digital | off course 0.5 mi, dead end, u-turn, rejoin at +510 s | SIM-023 leak, see BUG 10 |
| C1 | builtin:mechanical (stock speedo, rookie, rung 3) | me | analog | hold 40 indicated: **+28 s** on 5 mi (ratio 0.9413) | true 37.0 mph |
| C2 | builtin:mechanical | me | analog | hold 42.5 indicated (= 40/0.9413): **-1 s** | calibration learnable from one run |
| C3 | builtin:mechanical | me | analog | hold 43 (1-mph marks): **-6 s** | |
| TA | custom builder scenario, SIGNAL red 25.4 s / train 20.4 s | me | digital | declared 25 -> credit 25, err +8; +10 over -> flagged; after-CP -> credit 0 (BUG 11) | |

### Ledger (my believed early/late) vs truth, from `result.ledgerLog`
- seed 2: t+86 s 0 / -0.9; t+377 s +6 / +5.9; t+474 s +1 / +2.9; t+655 s 0 / +1.0.
- seed 5: t+126 s 0 / -0.3; t+388 s +6 / +6.5; t+472 s 0 / **-7.4** (at the STOP line: ghost
  pause already counted, GHOST-008 - see LOW 22); t+649 s 0 / +1.1.
So the ledger technique works to ~1-2 s with only driver cues and the book.

### Did the attribution explain my errors?
On `384a2e4`, yes in sum (buckets add to the scored error) and the per-stop records are
now populated: `[{line 2, 40>35 L, cost 5.8, dwell 5.5}, {line 6, 36>40 R, cost 6.6,
dwell 4.2}, {line 8, 39>35 L, cost 6.0, dwell 5.5}]`, `turn +4.5`, `timedChange -1.1`.
Two problems: `cost` excludes the braking half of the stop (BUG 13), and the T-turn's
re-acceleration lands in `cruise`/`speedChange`, so `turn +4.5` under-reports what truth
showed (-0.9 -> +5.8 across the T, i.e. 6.7 s). On `834132c` the attribution was useless
(everything after the first stop in `stop`, `stops []`, no `turn`) - FIXED, see BUG 4.

---------------------------------------------------------------------------------

## 2. BUGS

Severity: HIGH = wrong result or a session-losing failure in a documented path;
MEDIUM = crash/stuck/corrupt state on plausible input, or hidden info/scoring semantics
wrong; LOW = cosmetic, doc, or easy to work around.

### HIGH (open)

**BUG 1 - "go" at the instant the car stops is rejected as "Already rolling"; the
documented scheduled form `{"when":{"event":"carStopped"}}` is consumed and lost.**
Repro (onestop):
```
{"type":"act","action":{"type":"start"}}
{"type":"act","action":{"type":"call.turn","dir":"S"}}
{"type":"act","action":{"type":"call.go"},"when":{"event":"carStopped"}}
{"type":"advance","untilEvent":true,"maxSeconds":120}
{"type":"advance","untilEvent":true,"maxSeconds":120}
{"type":"advance","untilEvent":true,"maxSeconds":120}
```
Expected: the go fires when the car is stopped at the STOP and the driver leaves (or
the schedule waits until `waitingForGo`).
Actual: third advance stops after 16.8 s with `stoppedOn:"driverMessage:Already rolling"`,
`scheduledFired:["call.go"]`, `carStopped:true`, `waitingForGo:false`; next tick logs
`driver:Stopped|wait`; the car then sits until the driver's own patience ("Going?" at 25 s,
"I'm going" at 50 s) -> +42.5 s in the `stop` bucket. Same with an immediate
`{"type":"act","action":{"type":"call.go"}}` sent right after an advance that returned
`stoppedOn:"carStopped"` (seen in A1 at 08:01:08.0). Cause: `Car.step` sets `v=0` in tick
N, `beginWait()` runs in tick N+1 in `driverStep`, but `Session` evaluates `carStopped`
and `call.go` checks `waitingForGo` in between. Fix: run `beginWait` in the same tick the
car reaches `v=0` at a stop line, or make `call.go` while `carStopped && !waitingForGo` set
a pending go, and make the `carStopped` schedule condition `waitingForGo`.

**BUG 2 - Driver messages never arrive in `advanced` replies.**
Repro (onestop):
```
{"type":"act","action":{"type":"start"}}
{"type":"advance","untilEvent":true,"maxSeconds":120}
{"type":"advance","untilEvent":true,"maxSeconds":120}
{"type":"advance","untilEvent":true,"maxSeconds":120}
{"type":"advance","seconds":0.1}
```
Expected: `observation.driver.messages` of the last reply contains `Stopped` (kind
`info`, tod); the API contract says "messages since last observe".
Actual: `events:["driver:Stopped","wait"]` but `observation.driver.messages:[]` in every
`advanced` reply of every session (only `ack`/`observation` replies ever carry messages).
Cause: `Session.fireScheduled()` calls `this.obs()` -> `sim.observe()` **every tick**,
draining `pendingMsgs`; the `untilEvent` loop does it again. The agent loses `kind`
(question vs info), `tod` and the new `id`. Fix: a non-draining peek for internal use, or
collect drained messages and attach them to the reply.

### HIGH (found on 834132c, FIXED by 384a2e4 - kept for the record / regression tests)

**BUG 3 - `skipPreread` then `start` ran the clock backwards by the whole pre-read.**
Repro: `skipPreread`, `watch.start`, `start`, `advance 0.1`. On 834132c tod went
28800 -> 28770.1, stopwatch read -30, pace -29.9, "Rolling on time" had been announced;
onestop scored +17 with `stop +42.5`. Cause: `doTick` re-derives `tod` from `tick` and
skipPreread moved `tod` without `tick`. 384a2e4 moves `tick` too; verified tod 28800.1.

**BUG 4 - Stop record never closed, attribution collapsed into `stop`.**
On 834132c `closeStop()` required `releasedNodeId`, which is cleared 5 ft past the node,
so `stop.end` never fired (oracle included), `stops:[]`, and `currentBucket()` returned
`stop` for the rest of the stage (A1 showed `stop +2.4`, no `turn`, despite a 6.7 s T
loss). 384a2e4 closes on at-speed or node+2500 ft; verified `stop.end` and 3 records.

### MEDIUM

**BUG 5 - The JSON line `null` kills the CLI (exit 1).**
```
null
{"type":"observe"}
```
Expected: `{"type":"error",...}` and the loop continues (DESIGN §15 "malformed input
yields error and the process continues"). Actual: `{"type":"error","message":"Cannot read
properties of null (reading 'type')"}` then `TypeError ... at main (cli.ts:54)` -
`if (req.type === 'result')` dereferences `null`. (`[]`, `42`, `"hello"`, `{}` -> "unknown
request", fine.)

**BUG 6 - `scripts/rally-session.sh send` races the reply pipe: the CLI dies with
`write EPIPE` and every later `send` hangs forever.**
Repro: any session; on the 60th-ish request (`{"type":"act","action":{"type":"call.stop"}}`
in A1) the reply came back as an empty line, `err` shows `Error: write EPIPE at ...
cli.ts:53`, and the next `send` blocked until the tool timeout (exit 143). Cause: `send`
writes to `in` and only then opens `out` for reading; an `act` reply is written in <1 ms,
before any reader exists -> SIGPIPE/EPIPE. `read -r line < out` also blocks forever when
the CLI is dead. Fix: keep a permanent reader open in `start` (e.g. `exec 4<>"$dir/out"`),
or in `send` open `out` read-write before writing, and add a `timeout` to the read.
Lost my first complete seed-2 result; recovered only because the transcript is a replay
script.

**BUG 7 - No validation of numeric fields; a string or Infinity poisons the whole sim.**
```
{"type":"act","action":{"type":"start"}}
{"type":"act","action":{"type":"call.speed","mph":"fast"}}
{"type":"advance","seconds":20}
```
Actual: readback "Holding fast", then `speedo.reading:null`, every `ahead[].approxDistanceFt:
null`, `truth.carS:null` (all NaN), checkpoint never crossed, 300 + 60 penalty, no error
reply. `{"mph":1e400}` -> "Holding Infinity", `targetIndicated:null`, car accelerates
without bound (64 mph at 30 s, still climbing). `{"mph":-10}` -> "Holding -10", "At -10",
car stops in the road. Same class: `speedo.setFactor {"k":"x"}` (clamp(NaN) = NaN),
`line.set {"n":"abc"}` -> `currentLine:null` and `aids.cumulativePerfectAtNextLine`
vanishes, `bezel.set {"seconds":"x"}`. Fix: validate `typeof === 'number' && isFinite`
and a sane range (5..80 mph like `validateScenario`) in `Session.handle` or `act`, reply
`error`.

**BUG 8 - `call.turn` with an unknown direction bricks the session.**
```
{"type":"act","action":{"type":"start"}}
{"type":"act","action":{"type":"call.turn","dir":"X"}}
{"type":"advance","seconds":5}
{"type":"advance","seconds":5}
```
Actual: readback "undefined ahead, got it", then every `advance` returns
`{"type":"error","message":"Cannot read properties of undefined (reading '0')"}`
(`bandFor('X')` undefined in `peekExit`), tod never moves; only a later valid `call.turn`
unsticks it, and nothing tells the agent that. Fix: validate `dir` against `TurnDir`.

**BUG 9 - `advance.seconds` / `maxSeconds` have no cap; pre-read never ends.**
`{"type":"advance","seconds":3000000}` in pre-read took 51 s wall (1e9 would be hours);
`tod` ran to 3028770 with `secondsToStart:-2999970` and the stage never started or
finished. Fix: cap a single advance (e.g. 3600 s) and auto-finish or auto-depart (late
start) when pre-read overruns the start by more than N minutes.

**BUG 10 - Hidden state leaks through `events` type names at aids rung 0.**
Verified on 384a2e4 with `LEGAL_AIDS` (varied):
- `traffic` appears in the tick the car stops, *before* any `call.go`: seeds 3/5/7
  `["driver:Stopped","traffic","wait"]`. The navigator learns a 3.6-12.4 s cross-traffic
  hold is coming and can pre-shorten the dwell. SIM-027 says hazard delays are hidden.
- `offCourse` appears in the advance that crosses the wrong exit (B9: `[...|turn|offCourse]`)
  although `aids.offCourseAlert:false` (SIM-023). `offCourseHint` is also computed from
  hidden `branchDist` regardless of aids (true after 0.25 mi in B9).
- `checkpoint` appears at the crossing (A1 at 08:08:51-58), contradicting the SIM-027
  text "checkpoint crossed events hidden at rung <= 1" (arguably realistic since the green
  sign is in `ahead`; the spec and code disagree).
- `mainRoad`, `stop.begin`, `node`-free `turn`, and my own `ledger.set`/`line.set` echo
  back too (harmless, noisy).
Fix: whitelist event types per rung in `Session.handle('advance')` instead of only
removing `node`.

**BUG 11 - A Time Allowance declared after crossing the checkpoint is booked to the
next leg and credits nothing.**
Custom scenario (SIGNAL, red 25.4 s). Declaring `{"type":"act","action":{"type":"ta.declare",
"seconds":25}}` right after `Green` -> `taCredit 25, error +8`. Declaring the same 25 in
the advance where `events` contains `checkpoint` -> `taCredit 0, error +33`,
`taDeclared:{"2":25}`. In the real event the TA form is handed in *at* the checkpoint
for the leg just run, so this is the natural moment. Fix: `ta.declare` takes an optional
`legIndex`, defaulting to the leg in which the last qualifying wait occurred.

**BUG 12 - Unknown action types are acknowledged `ok:true` and recorded for replay.**
`{"type":"act","action":{"type":"call.fly"}}` -> `{"type":"ack","ok":true,...}`; the
`actions` log (and therefore `replay`) contains it. Expected `error`. (`{"type":"act"}`
and `"action":null` correctly error.)

**BUG 13 - Per-stop `actualCost` omits the braking half of the stop; the debrief will
mislead.** A1 line 2: `pause 15, cost 5.8, dwell 5.5` reads as "11.3 of 15 used, you left
3.7 s early", but the leg's `stop` bucket (-1.1 for two stops) and the card
(`stopLoss(40->35, cap) 9.46 + 5.5 = 14.96`) show the maneuver cost the full 15.
`stopBucketAtStopStart` is captured at the node crossing (after braking and dwell) rather
than at `stop.begin`. Fix: snapshot the bucket at `stop.begin`; report
`{braking, dwell, accel, total, pause}`.

**BUG 14 - `ENGINE_VERSION` stayed `1.0.0` while physics/attribution changed; the same
transcript scores differently.** `A2.jsonl` (78 requests) scored leg 2 `08:13:48 / +1` on
the pre-commit engine and `08:13:49 / +2` on 384a2e4; `replay()`'s version guard cannot
catch it, so saved playtests silently stop being regression tests (SIM-022). Fix: bump
on any change to sim/car/driver/scoring; add a golden-transcript test.

### LOW

**15 - No "At NN" cue after the start.** `announceAtSpeed` is set in `call.speed` and
`release()` but not in `depart()`. Cues from depart to first stop (A2):
`depart | Leaving 5 s early | watch.start | Left ahead, got it | stop.begin | Stopped`.
DRV-013 says "At NN" is the navigator's real cue for ending a ramp.

**16 - Analog `watch.reset` while running is refused silently.** `ack ok:true`, watch
still running, no driver/info message; the agent only finds out by reading
`stopwatch.running`. Reply `error` or add `refused:true`.

**17 - `card.set` is a no-op through the protocol.** `card.set {"35":37.5}` then
`call.speed 35` -> `targetIndicated 35`. `Session`/CLI never pass `useCard:true`.

**18 - `hello.actions` omits `watch.recall`, `line.annotate`, `abort` and the new
`skipPreread{secondsBefore}`;** `instructions` do not mention `when` scheduling,
`truth`, that `result` ends the CLI process (LOW 26), or that sign text is unreadable
beyond half the sight distance.

**19 - Phantom "leg 3" attribution.** Both careful runs and the oracle report
`attr leg 3: cruise +3.2..3.5, ratio 0.69` for the 400 ft after the last timing CP
(braking into the observation stop). There is no leg 3; label it `finish` or drop it.

**20 - `untilEvent` stops on the navigator's own readback one tick later.** Every
`call.turn`/`call.speed`/`call.stop` followed by `advance untilEvent` returns after 0.1 s
with `stoppedOn:"driverMessage:Left ahead, got it"`; likewise `stoppedOn:"depart"` for a
`start` sent before the advance. Costs a round trip per call; readbacks of *my* calls
should not be stop events (questions and `info` should).

**21 - Wording nits.** "Did the turn, line 2" for `Straight at STOP`; "Holding -10" /
"At -10" / "Holding fast" / "Holding Infinity" / "undefined ahead, got it" readbacks
(follow from BUG 7/8); "Turn around? We are on course as far as I can tell" is kind
`question` but needs no answer.

**22 - `ledgerLog.truth` at a pause node is right-continuous.** Stopped at the line-6
STOP in A2 I was +1.7 late, `truth` logged -7.4 (ghost's 15-s pause already applied,
GHOST-008). The debrief "ledger vs truth" curve will show a spurious -15 s dip at every
stop; log the pre-pause value while the car is at the line.

**23 - Spec/code inconsistency on cross traffic.** DESIGN §7 DRV-014 says "0-20 s",
`course.ts` says "2-12 s"; measured 3.6, 11.9, 12.4 s (`rnd.next()*20`).

**24 - Signal/RR stop ramps are booked to `cruise`.** TA scenario: `cruise +7.5,
hazard +25.4` - the 7.5 s is braking/accelerating for the red light, since `curStop` is
only opened for `control === 'STOP'`. Open it for any node the driver stops at.

**25 - `result` terminates the CLI process.** Documented nowhere in `hello`; an agent
that asks for an interim result (allowed in-process) loses the session. Either keep
serving or say so.

**26 - Hostile/odd inputs accepted silently with no feedback:** `start` twice,
`skipPreread` after start, `call.pass` with no slow vehicle (flag stays set forever),
scheduled actions with impossible conditions (`watchReads:99999`, `label:"unicorn"`,
`when:{}`, `event:"bogus"`) are kept forever; `when:{elapsed:-5}` fires next tick. No
way to list or cancel scheduled actions.

Count: HIGH 2 open + 2 fixed during the pass, MEDIUM 10, LOW 12.

---------------------------------------------------------------------------------

## 3. PROTOCOL / USABILITY issues (beyond the bugs)

1. **No "passed the landmark" cue.** For `At bridge. 30 mph for 0:40 then 40` the count
   starts when the ghost passes the bridge. The only signal is the feature vanishing from
   `ahead`, which `untilEvent` does not stop on. I had to schedule the change at
   `(500 ft / 66 ft/s) + 40 - 2.3 s` from the moment the bridge appeared (worked: timed
   bucket -1.1 / -2.0 s). Add `stoppedOn:"featurePassed"` and `when:{event:"featurePassed",
   label}`.
2. **One-tick ordering** (BUG 1) also means `carStopped` and `driver.state:"stopped"` are
   true while `waitingForGo` is false and no "Stopped" has been said; a navigator who
   starts the dwell count on `carStopped` and one who starts on "Stopped" differ by 0.1 s,
   fine, but the go semantics differ completely.
3. `when.event:"featureVisible"` matching: `label` is tested against `label ?? kind`, sign
   text, and control, not against exit kinds/names, and sign text is `undefined` beyond half
   the sight distance, so `label:"SPEED LIMIT"` arms at 250 ft not 500 ft. Document, or
   match on `nodeId` returned in `ahead`.
4. The `advance` reply's `events` are the only reliable channel for driver speech
   (BUG 2) but are flat strings `driver:<text>` without kind/tod/id.
5. `advance untilEvent` returns `seconds` rounded to 0.1 and `stoppedOn` a single reason
   even when several things happened in the tick (e.g. `checkpoint|observation.stopped|
   finished` -> `finished`). Fine, but `events` is needed to see the rest.
6. `truth` is always available - fine for playtesting, but gate it behind a CLI flag so a
   "legal" session cannot be accidentally contaminated.
7. The helper prints exactly one line per `send`; stderr (crashes) is invisible and a
   crashed CLI hangs the caller (BUG 6).
8. There is no `cancelScheduled`/`listScheduled`, and no reply field says a scheduled
   action was *refused* (BUG 1 reports it as fired).
9. `observe()` returns `tod` as float seconds-since-midnight; a `clock: "08:01:08"` string
   and `startTime` alongside would save every agent the same arithmetic.

---------------------------------------------------------------------------------

## 4. REALISM notes (navigator's seat, vs R01 §7 and R03 §2)

- **Runnable without the pace aid: yes.** With book + driver cues + my card I ran seed 2
  to +1/+2 and seed 5 to +5/+1 at rung 0; the cues that mattered were "Stopped",
  "Going", "At NN", "Holding NN" and the `ahead` list. Missing cues: "At NN" after the
  start (LOW 15), nothing when passing a landmark, and the driver never *volunteers* what
  he sees ("stop sign coming up") - real drivers do (R01 §7: driver already knows the next
  landmark). A rung-0 "I see a stop ahead" from the driver would be realistic, not an aid.
- **`ahead` with 50-ft rounding is workable.** 50 ft = 0.85 s at 40 mph; the rounding
  error on a call is <= +-0.4 s, below the driver's own scatter. Sign text appearing only
  inside half the sight distance is a nice touch. Exit geometry (`[-90,0,90]`) 700 ft out
  is a little generous but matches what a navigator infers from a crossroads sign.
- **Book text** reads like a clean GRIID line ("Left at STOP. Pause 15. Speed 35",
  "At bridge. 30 mph for 0:40 then 40", "Continue (driveway on R)") - close to the real
  terse style (R01 §2.2: "turn right at the stop sign, go exactly 25 mph for 40
  seconds..."). Missing versus the real book: no instruction cameo/column D on most lines,
  no "Column C" perfect intervals on any calibration section (the mechanical scenario has
  none), and the hint "Comes quick" is good flavour. `FINISH. Stop at Observation
  Checkpoint` is fine.
- **Stop physics** feel right: a full stop-and-turn costs ~9.5 s of a 15-s pause with this
  car (card and engine agree within 0.3 s), so "wait about 5.5" is exactly the Rowland
  number class (R03 §2.3, 4.5 s for 0->40 in a quicker car). Cross-traffic holds of 4-12 s
  that are not TA-eligible are realistic and nasty.
- **Turn loss at a T** (ghost turns instantly, car brakes to 12 mph) is 6-7 s and is the
  biggest single error source in both runs. That is realistic (R07 §12 turnLoss is on the
  card) but the book gives no hint that the ghost does not slow; a rookie will blame the
  stop. The debrief must show `turn` clearly (it under-reports today).
- **Speedometer (SIM-019):** at rung 0 the navigator's `speedo.reading` of a stock unit is
  40 or 45 only (94%/6% of samples), i.e. useless, which is the intent - the driver reads
  the dial. At rung 3 it shows 39-43 with 1-mph marks, bounce and 1-s lag around a true
  38.3. Calibration task (C): without landmarks with printed perfect times, the only
  measurement a navigator has is the checkpoint result itself (one number per 5 miles);
  from +28 s I derived k = 450/478 = 0.941 and the next run holding 40/k = 42.5 scored -1.
  A real navigator would use the morning calibration run's Column C intervals (R03 §2.1)
  and an analog watch lap at each landmark - the mechanical scenario should have 3-4
  landmarks with `perfectInterval` printed. At rung 3 the live pace bar makes the task
  trivial (slope of earlyLate = 1-k). Also: `speedo.newStage()` (daily drift) is never
  called by the simulator, so the "morning calibration matters" story is not yet modelled.
- **Driver speech volume** is plausible: a readback per call, a cue per maneuver, a
  question at a T. "Going?" after 25 s and "I'm going" after 50 s are good. The driver
  waits forever at a dead end (no patience there) - fine, he should ask, not decide.
- **Unrealistic bits:** `truth` request; `offCourseHint` from hidden distance at rung 0;
  `traffic` event leak (BUG 10); unbounded speed on a 1939 Ford (BUG 7); the stopwatch
  bezel is settable to 0.1 s precision while the real one is a friction ring (fine).

---------------------------------------------------------------------------------

## 5. Five concrete improvement proposals

1. **Make the stop a single atomic tick.** When `Car.step` brings `v` to 0 at a stop
   line, run `beginWait` in the same `doTick`, and let `call.go` while
   `carStopped && !waitingForGo` set `goPending` instead of "Already rolling". Then
   `when:{event:"carStopped"}` becomes the one-line way to express "go at wheels-stop +
   dwell" (`when:{event:"carStopped", plus: 5.5}`). Fixes BUG 1 and the whole class of
   agent off-by-one-tick errors.
2. **Separate "peek" from "observe".** `Session` should use a non-draining
   `sim.peek()` for scheduling and stop detection, and `advanced.observation.driver.messages`
   should carry every message (with `id`, `kind`, `tod`) produced during the advance. Add
   `stoppedOn:"driverQuestion"` distinct from readbacks so `untilEvent` no longer stops on
   my own "Left ahead, got it" (BUG 2, LOW 20).
3. **Validate every action at the protocol boundary** (`typeof number && isFinite`,
   speed 5..80, dir in `TurnDir`, action type in the union, line in 1..n) and reply
   `error` without touching the sim; treat the JSON literal `null` like bad JSON; cap one
   `advance` at 3600 s; whitelist `events` per aids rung. One small `validateRequest()`
   in `protocol.ts` closes BUGS 5, 7, 8, 9, 10, 12.
4. **Landmark-passing cues and a leg-aware TA.** Add `featurePassed` as an `untilEvent`
   stop and `when` event (the realistic "Mark!" of R03 §2.4), give the driver a rung-0
   "stop sign ahead" call when a controlled intersection becomes visible, emit "At NN"
   after the start, and let `ta.declare` take `legIndex` defaulting to the leg of the
   last qualifying wait so the form can be filled at the checkpoint (BUG 11, LOW 15).
5. **Honest debrief numbers and version discipline.** Snapshot the stop bucket at
   `stop.begin` and report `{braking, dwell, accel, total, pause}` per stop; book the
   T-turn's re-acceleration to `turn`; log `ledgerLog.truth` pre-pause while stopped; drop
   the phantom "leg 3"; bump `ENGINE_VERSION` on every physics/scoring change and add a
   golden-transcript test using `docs/playtest` request lists (the A1/A2 request lists are saved in
   `docs/playtest/PT-01-transcripts/*.jsonl`; `playScript(builtinScenario('varied', seed), lines, {watch:'digital'})` reproduces them). Also fix the
   session helper (open the reply FIFO read-write before writing; time out the read) so
   future playtests do not lose their result.

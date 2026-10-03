# SPECS - numbered, testable. Every id must appear in at least one test name.
# Format: ID | statement | verification idea. Status column maintained by scripts/spec-check.
# Priority tags at the end of a line: [P1] must have for a playable + validated v1, [P2] should have; untagged = original v1 set (treat as P1).
# "## BACKLOG" at the bottom holds [P3] future specs; spec-check ignores everything after that heading.

## UNITS / RNG
UNIT-001 mphToFps(60) = 88.0 exactly (60 mph = 88 ft/s) and fpsToMph inverts within 1e-9.
UNIT-002 formatClock(seconds) renders TOD as HH:MM:SS and formatElapsed renders M:SS.s; negative elapsed renders with a leading minus.
UNIT-003 roundToSecond uses round-half-up on the fractional second (12.5 -> 13), matching "to the nearest second".
RNG-001 Seeded rng(seed) produces an identical sequence for the same seed and a different sequence for a different seed.

## GHOST (perfect-time integrator)
GHOST-001 A straight 1-mile course at 30 mph has ghost time 120.0 s at the end.
GHOST-002 A "Pause 15" at a node adds exactly 15 s to the ghost time at and after that node and adds no distance.
GHOST-003 A speed change at a node takes effect at exactly the node's s (instantaneous): 1 mi at 30 then 1 mi at 60 = 120 + 60 s.
GHOST-004 A timed segment "hold 30 for 36 s then 40" switches speed at the virtual position s_anchor + 30mph*36s (= 1584 ft) and the ghost time there is anchor time + 36 s.
GHOST-005 A start/restart line sets the ghost anchor to the instruction's restartTime regardless of earlier time.
GHOST-006 Perfect leg duration between consecutive checkpoints equals ghost(CP_k) - ghost(CP_k-1) and, summed, equals ghost(last CP) - start.
GHOST-007 Calibration-run instructions carry perfectInterval equal to the ghost interval between consecutive calibration nodes and perfectCumulative equal to the cumulative since the calibration start.
GHOST-008 ghostTimeAt(s) is monotone non-decreasing in s and piecewise linear between breakpoints, with an upward jump equal to the pause at pause nodes (GHOST-002); it is right-continuous, i.e. ghostTimeAt(node.s) returns the post-pause time.
GHOST-009 Within one node the ghost applies the pause before the speed/timed change, so a timed anchor equals node arrival + pause: for "STOP P15, 25 for 40 then 45" the virtual node lies at s + 25 mph * 40 s (= 1466.7 ft) and the ghost time there is arrival + 55 s. [P2]
GHOST-010 validateCourse rejects (with the instruction number) a timed segment whose virtual node lies at or beyond the next node carrying speed, pause or turn, and a checkpoint within stopLineOffset + 50 ft of a pause node; it warns when the ghost reaches a restart node after its restartTime; book order must equal s order with n 1-based and contiguous. [P2]

## CAR (physical car)
CAR-001 With the 1939 Ford preset, 0 to 35 mph takes between 8 and 12 s and 0 to 50 mph between 15 and 22 s.
CAR-002 Braking from 35 mph to a stop with aDec = 8 ft/s^2 takes 51.3/8 = 6.4 s (+-0.2) and the car stops within 2 ft of the commanded stop line.
CAR-003 Cruise at a constant target holds within 0.05 mph after settling when the driver noise is zero.
CAR-004 A speed increase from 30 to 40 mph begins exactly when commanded and the ramp duration is deterministic for a given seed and consistency 0.
CAR-005 Position s is monotone non-decreasing while on course; distance integrates speed (1 s at 44 ft/s = 44 ft +-0.1).
CAR-006 Stopping mode never overshoots: s <= sStop at every tick; when the remaining distance is < 0.5 ft and v < 1 ft/s the car snaps to v = 0, s = sStop (this is the rule behind CAR-002). [P2]

## SPEEDO
SPEEDO-001 Timewise model with factor = trueFactor indicates the true speed within 0.05 mph after lag settles.
SPEEDO-002 Timewise with a factor 1% high indicates 1% high (35.35 for 35.0) and inverse() returns the true speed to hold for a wanted indicated value.
SPEEDO-003 Mechanical model indicates gain*v + offset + quad*v^2 before lag; the stock preset reads high at 50 mph by between 1 and 5 mph.
SPEEDO-004 Mechanical reading() is quantized to 1 mph marks; Timewise reading() to 0.1 mph.
SPEEDO-005 Daily drift re-randomizes the mechanical gain by at most +-1% per newStage() call and leaves the Timewise true factor unchanged.
SPEEDO-006 inverse() uses only the deterministic transfer (gain, offset, quad), never lag or bounce; it is monotone on 0..100 mph and inverse(indicated(v)) = v within 1e-6. [P2]

## DRIVER
DRV-001 After call.speed(35) the driver's target indicated speed is 35 and the car's true speed converges to speedo.inverse(35).
DRV-002 At a STOP-controlled node the driver stops at the stop line even with no stop callout, and does not move until call.go (within patience).
DRV-003 With no go within patience (25 s) the driver emits a "Going?" message; at 2x patience the driver departs on his own.
DRV-004 At a T with no pending turn callout the driver stops at the T and emits "Left or right?" and waits.
DRV-005 At a side-road intersection with no callout the driver continues on the straight-as-possible real road.
DRV-006 A turn callout matching a non-route exit sends the car off course; call.uturn returns it to the node after 2x excursion distance / speed plus 20 s, and the car is back on route.
DRV-007 Turn callouts map to exits by angle band: L -> [-120,-60], BL -> [-60,-20], S -> [-20,20], BR -> [20,60], R -> [60,120], AL < -120, AR > 120; if no exit matches the driver asks and waits.
DRV-008 Every callout produces a read-back message in the driver log.
DRV-009 With a red SIGNAL the driver waits for green regardless of callouts; the wait is logged as a hazard delay with measured seconds.
DRV-010 Expert driver hold error sd <= 0.35 mph and rookie >= 0.8 mph, measured as true speed vs target over a 5-minute cruise at dt 0.1 after 30 s settling (statistical, seed-fixed).
DRV-011 Turn execution caps speed (90-degree turn <= 12 mph at the node) and then re-accelerates to the target.
DRV-012 Slow vehicle hazard limits the car to the vehicle's speed until call.pass is issued during an open passing window or the hazard ends.
DRV-013 Driver speech cues: the driver emits "Stopped" (with TOD) within skill latency (expert 0.3 s, rookie 1.0 s) of v reaching 0 at a stop line, and "At <speed>" within 1 s of settling (|v - target| < 0.5 mph) at a newly called target; these are the navigator's cues for starting a dwell count or ending a ramp. [P1]
DRV-014 Cross traffic at a STOP: with probability by profile (town 0.5, rural 0.15, drills configurable) a seeded extra wait of 0-20 s holds the driver after call.go ("Waiting on traffic"); the extra wait is logged as a ledger-eligible event with measured seconds and is NOT TA-qualifying. [P1]
DRV-015 A turn callout arms until the next node that has a matching real-road exit; at intermediate intersections without one the driver says "No <dir> here, staying on" and continues straight-as-possible; a T with no matching exit asks and waits (DRV-004). [P2]
DRV-016 Callout semantics: call.go while rolling is logged and answered "Already rolling"; call.stop with no control ahead stops the car at the next node until call.go; call.uturn while on course is refused with a question and costs nothing; call.pass is a request ("Will pass when clear") that takes effect only once the slow vehicle's passing window is open. [P2]
DRV-017 Check-off: on executing an instruction (turn taken, pause done, speed reached) the driver emits a check-off message naming the line ("Did the stop, forty-three"); observe().driver.lastExecutedLine carries n; the debrief lists "line lost" when line.set lags the check-off by > 1 line for > 60 s. [P2]

## WATCH / CLOCK
WATCH-001 start then step 10 s -> elapsed 10.0; stop freezes elapsed; start again resumes (cumulative).
WATCH-002 lap records the current elapsed as a split and keeps running; reset zeroes elapsed and clears laps only when stopped (analog) or anytime (digital).
WATCH-003 analog reading() is quantized to 0.2 s; digital reading() to 0.01 s.
WATCH-004 clock.tod() equals the simulator TOD; bezel.set(k) stores k seconds and bezelRemaining() = (k - tod_seconds_in_minute) mod 60.
WATCH-005 Analog stopwatch countdown bezel: act('watch.bezel.set', k) stores k seconds in [0, sweepSeconds) (default sweep 60; 30 s option); bezelRemaining() = (k - elapsed mod sweep) mod sweep; observe().stopwatch.bezel exposes it; the analog reset is refused while running so the watch can be run as stopwatch-as-TOD all day. [P1]
WATCH-006 Digital preset: lap freezes the displayed value on the split until act('watch.recall') while elapsed keeps counting; two laps in a row store two splits; reset is allowed anytime on digital. [P2]

## SIM (world, events, observation, actions)
SIM-001 observe() never exposes any node s, checkpoint position, or hazard schedule; it only exposes approxDistanceFt rounded to 50 ft for visible features.
SIM-002 A node becomes visible exactly when car.s >= node.s - sightDistance and disappears once passed.
SIM-003 A timing checkpoint is recorded when car.s crosses cp.s with TOD rounded to the nearest second, and the leg index increments.
SIM-004 The checkpoint sign is visible only inside its sight zone, and stopping or v <= 5 mph inside the zone sets a sightZoneViolation for that CP.
SIM-005 Crossing an observation checkpoint without stopping within 200 ft sets observationMissed.
SIM-006 phase is 'preread' until act('start'); the preread timer is 30 min of sim time by default; act('start') before the official start time records an early departure but the leg anchor stays the official start time.
SIM-007 step(dt) with dt = 0.1 is deterministic: two simulators with the same scenario and the same action script produce identical result() JSON.
SIM-008 result() lists every checkpoint with actual TOD, perfect TOD, error seconds, ace flag, penalty, and totals raw and ageFactored.
SIM-009 act('ta.declare', seconds) in a leg credits min(declared, measured qualifying delay) against that leg's error and flags over-declaration > 5 s.
SIM-010 act('line.set', n) is reflected in observe().currentLine and has no effect on the world.
SIM-011 act('note', text) appends to observe().notes (the lapboard).
SIM-012 act('speedo.setFactor', k) changes the Timewise reading immediately; it is rejected with an error for the mechanical speedo.
SIM-013 act('card.set', {assigned: indicated}) causes call.speed(assigned) to request the indicated value when options.useCard is true.
SIM-014 An instantaneous car with a perfect driver and no losses scores |error| <= 1 at every checkpoint (whole-second rounding of arrival times, as in the real event) and 0 on at least half of them, over 20 seeded scenarios.
SIM-015 The event log records every node crossing, stop, go, hazard start/end, checkpoint, and callout with TOD.
SIM-016 observe().ahead lists exits for intersections with angle, surface, kind and controlFacingUs so a CAMEO can be drawn; sign text is present only when within half the sight distance.
SIM-017 A finished stage reports elapsed real driving time and the number of instructions executed.
SIM-018 act('ledger.set', seconds) stores the navigator's own early(-)/late(+) estimate with TOD; observe().ledger returns the latest value; result().ledger is a time series of {tod, ledger, truth} and the debrief grades it (mean and max |ledger - truth|, and every event where the ledger was not updated within 60 s of a hazard or extra wait). [P1]
SIM-019 observe().speedo.reading is quantized to the preset's navigator mark spacing (mechanical1939 5 mph, timewise 1 mph) rather than the driver's fine reading (SPEEDO-004); the driver still holds the fine reading and his read-back ("At 36") is the navigator's precise source; aids.showSpeedo = 'fine' restores the fine reading at aids rung >= 2. [P1]
SIM-020 aids.countdown for a timed change counts to the ghost's change instant shifted by the current leg anchor offset, i.e. (ghostTimeAt(virtual node) - legAnchorGhost) + legAnchorActual - tod, never to car-crossing + T; for "STOP P15, 25 for 40 then 45" it reaches 0 exactly 55 s after the ghost's arrival at the node (GHOST-009). [P1]
SIM-021 Termination: phase becomes 'finished' when (a) the car reaches course end, (b) the observation CP stop is recorded after the last timing CP, (c) TOD exceeds the last perfect CP TOD by rules.missedCpLateMinutes, or (d) act('abort'); result() is available in every case and marks un-crossed CPs as missed. [P2]
SIM-022 result().actions lists every accepted action as {tick, action}; replay(scenario, actions) reproduces identical result() JSON (SIM-007) and is what the debrief counterfactuals (DEBRIEF-002) re-run; a replay with a different engineVersion is refused with a message. [P1]
SIM-023 observe() exposes no off-course flag or branch information unless aids.offCourseAlert is on; during an excursion ahead[] lists only the branch's own features (SIM-024). [P2]
SIM-024 Taking any exit other than the isRoute exit puts the car off course, whether by callout or by the default straight-as-possible choice; the excursion branch presents an unlisted tell (DEAD END sign, STOP or T) within 0.2-0.8 mi before it ends, the driver stops there and asks, and call.uturn works anywhere on the branch. [P2]
SIM-025 The simulator has one fixed step DT = 0.1 and an accumulator; tod = startTod + tick * DT exactly (no float drift over 36 000 ticks); node, stop-line and checkpoint crossing TODs are linearly interpolated within the tick so shifting the start phase by 0.05 s changes a recorded crossing time by < 1e-6 s. [P2]
SIM-026 A late departure (act('start') after startTime) keeps the official anchor; result() reports secondsLateAtStart, attribution assigns it to 'start', and the driver says "Leaving N s late". [P2]
SIM-027 While phase = 'running' and aids rung <= 1, observe() exposes no leg index, no "checkpoint crossed" event and no hazard measured delay; at rung >= 2 the immediate CP card (DEBRIEF-004) is the only such feedback. [P2]
SIM-028 act('line.annotate', n, text) stores a per-line note (e.g. the dwell "7.8") shown by bookRows; result() reports pre-read coverage = fraction of pause lines annotated before act('start'). [P2]

## SCORING
SCORE-001 Leg error = round(actual_k) - (anchor_{k-1} + perfectLeg_k) with anchor_0 = official start time and anchor_k = actual_k (leg reset).
SCORE-002 Penalty = |error| capped at rules.maxPerCp (default 300); a never-crossed CP scores the cap; > 30 min late scores the cap.
SCORE-003 Sight-zone violation adds rules.sightZonePenalty (default 30) once per CP.
SCORE-004 Observation CP missed adds rules.observationMissPenalty (default 60).
SCORE-005 Age factor: 1954+ = 1.000, 1939 = 0.845, 1953 = 0.915; years between known points interpolate linearly; a 40 s raw stage in a 1939 car scores 33.80.
SCORE-006 Ace flag when error = 0; stage aces counted.
SCORE-007 Early restart > 5 min before restartTime adds rules.earlyRestart penalty.
SCORE-008 Campaign total = sum of stage scores; Trophy Run excluded from total by default (rules.trophyRunCounts = false) but used as tiebreak.
SCORE-009 rules.rookieDropWorstLeg = true removes the worst leg per stage from the stage raw.
SCORE-010 TA credit = min(declared, measured qualifying delay, max(rawError, 0)) rounded to rules.taGranularitySeconds (default 1; Q5): it never turns a late leg into an early one; over-declaration > 5 s sets taOverDeclared. [P2]
SCORE-011 Every stage result carries a benchmark label for the raw day score {champion <= 3, expert <= 13, sportsman <= 25, rookie <= 46, blown > 46} and the result card shows it next to the nearest bot's score on the same seed. [P2]

## PERF TABLE / CALIBRATION
PERF-001 stopLoss(v, v, car) for the 1939 preset is within [5, 12] s for v in 25..45 and increases strictly with v.
PERF-002 stopLoss(vIn, vOut) uses the deceleration ramp from vIn and the acceleration ramp to vOut; stopLoss(20, 40) > stopLoss(20, 20).
PERF-003 dwellFor(pause, vIn, vOut) = pause - stopLoss and is floored at 0.
PERF-004 rampLead(v1, v2) = ramp duration / 2 and, for |v2 - v1| <= 15 mph, a timed change called at T - rampLead has |position error| < 10 ft versus the ghost (simulated); the card prints the lead per from/to pair.
CAL-001 k = sum(P)/sum(A); for P=[100,100,100], A=[103,103,103] k = 0.9709 (+-1e-4).
CAL-002 indicatedToHold(35, k=0.9709) = 36.05 and cheatCard covers 20..50 step 5.
CAL-003 The calibration section of a generated stage has >= 3 intervals at 50 mph and total length >= 15 miles.
CAL-004 Mechanical-speedo cheat card is built per assigned speed (20..50 step 5) in a pre-event drill with a true-speed reference (practice mode), and the morning calibration run shifts every card entry by the single day factor k; a card built by linear scaling from a 50-mph k alone is >= 0.5 mph wrong at 25 mph for the stock preset (the drill shows this). [P1]

## HAZARDS
HAZ-001 A signal with cycle (red 40, green 50, offset) is red at time t iff ((t - offset) mod 90) < 40; the sim reports color only when visible.
HAZ-002 A train hazard blocks the crossing for its duration and the driver's wait is recorded as a qualifying TA delay.
HAZ-003 A slow vehicle hazard records a non-qualifying delay (inability to hold speed is not grounds for TA).
HAZ-005 Generated books print no pause at signals; a red-signal wait is TA-qualifying only when rules.taForSignals (default true, flagged Q5); the lesson states the decision is TA vs make-up, never both. [P2]

## ATTRIBUTION
ATTR-001 Sum of attributed buckets per leg equals the scored leg error within 1.5 s (the scored error is built from two TODs rounded to the second, so the unrounded bucket sum may differ by up to ~1 s plus the integration residual).
ATTR-002 Ignoring stop loss on a single Pause 15 with the 1939 preset attributes 5-11 s to bucket 'stop' and ~0 to other buckets.
ATTR-003 A 1% high speedometer over a 15-minute leg attributes 8-10 s to 'cruise.systematic'.
ATTR-004 A wrong turn with uturn attributes the excursion time to 'offCourse'.
ATTR-005 'start' (early/late departure) and 'ta' (TA credit, signed) are attribution buckets so the debrief can say "lost 48 s at the train, recovered 45 by TA"; ATTR-001 still holds with them included. [P2]

## GENERATOR / TRAPS
GEN-001 generateStage(seed) is deterministic and valid (nodes sorted by s, instructions reference existing nodes, every leg has exactly one timing CP, speeds are multiples of 5 in 20..50; 20 only in town clusters).
GEN-002 Generated full stage has 150-260 instructions, 4-7 timing checkpoints by default (profile.cpCount up to 12 for the "12-CP day" surprise), a calibration section, a lunch restart, and an observation CP at the finish.
GEN-003 Every generated STOP node has a Pause in the book (default 15) unless profile.noPauseTraps injects a missing one deliberately (flagged in truth).
GEN-004 Trap library has >= 15 entries each with instruction text, exits with exactly one isRoute, a wrong-exit list, a tip, and a category; all render to a CAMEO without error.
GEN-005 Timing checkpoints may be placed anywhere on a leg, including shortly after stops, speed changes and turns ("the most inopportune places"), but never inside a pause node (within stopLineOffset + 50 ft of it), never within 300 ft BEFORE a STOP or SIGNAL node (braking for the control inside the CP sight zone would make SIM-004 unfair), and never in warm-up, calibration, transit or free-zone sections.
GEN-006 Distractor nodes (driveway, lot, gravel, deadend, side-road STOP facing away) never carry an instruction and are drawn with trapDensity probability.
GEN-007 In every generated stage at least one timing checkpoint lies 300-1500 ft after a STOP node, and at least 35 % of timing checkpoints lie within 0.4 mi after a STOP, SIGNAL, speed change or turn (seeded, statistical over 20 stages); the debrief tags such legs "CP right after a maneuver". [P1]
GEN-008 Every route intersection has exactly one isRoute exit, including nodes without an instruction; when the node has a turn instruction the route exit's angle lies in that turn's band (DRV-007); when it has none the route exit is the straight-as-possible real road under the scenario's mainRoadRule. [P2]

## DRILLS
DRILL-001 Every drill definition has id, title, objective, scenario factory, rubric(result) -> {score, stars, feedback[]}, aids config, and unlock rule.
DRILL-002 Pause drill rubric: stars 3 if mean |stop error| <= 1 s, 2 if <= 3 s, 1 if <= 6 s.
DRILL-003 Trap quiz has 20 cards from the library and scores correct/incorrect with the tip shown on mistakes.
DRILL-004 Curriculum unlock: D09 (trap quiz) and D14 (mental math) are open from the start; D18 requires 2 stars (any tier) on D03, D04, D05, D08 and D10; D11 requires D18 passed and 2 stars on D07; D12 requires D11 passed and D15, D16 passed; D13 requires D12 passed.
DRILL-005 Aids default by drill: rung 3 for D01-D05, rung 2 for D06-D10 and D15-D17, rung 1 for D18 and D11, rung 0 ("Great Race legal") for D12+; in legal mode no aid can be enabled (rungs defined in DRILL-007).
DRILL-006 D18 "miniature leg" (combo) scenario factory produces, deterministically per seed, exactly one of each: STOP with Pause, timed segment, landmark speed change, trap node from the library, hazard (signal or slow vehicle), hidden timing CP, in 4-6 min of ghost time; D18 sits before D11 in the curriculum and is D11's gate (DRILL-004). [P1]
DRILL-007 Aids ladder: rung 3 = numeric pace bar + 3-2-1 cue + cumulative perfect times + ghost car rendered + immediate CP card; rung 2 = coarse pace (early/late arrow) + 3-2-1 cue + immediate CP card + driver check-off; rung 1 = driver check-off only; rung 0 = "Great Race legal" (perfect times on the calibration run only, speedo at mark granularity, no live early/late); every drill is playable at every rung. [P1]
DRILL-008 D08b Time Allowance drill: a leg with a train (gates down 60-120 s) and two signals; the player times the stops, keeps the ledger and declares TA at the CP; rubric: 3 stars if |declared - qualifying| <= 5 s with no double-count (TA plus made-up time), 2 if <= 15 s, 1 if a TA was declared at all. [P1]
DRILL-009 Every drill's scenario factory and every JSON scenario under content/ passes validateCourse for seeds 1..10 and the oracle bot finishes it with phase 'finished' in < 2 s of CPU each. [P2]
DRILL-010 Every drill has three tiers (Bronze/Silver/Gold = aids rung 3/2/1 and driver expert/sportsman/rookie); stars are stored per tier; the drill card shows the best tier reached; D03 Bronze hands the player a printed card for a known car and Gold uses the player's own card on a re-randomised hidden car. [P2]
DRILL-011 D04 includes >= 2 short changes (T < 20 s) and >= 2 compound "STOP P15, 25 for 40 then 45" changes; the rubric scores the change-point error against the ghost-departure-anchored instant (GHOST-009): 3 stars if mean |error| <= 1 s, 2 if <= 2.5 s, 1 if <= 5 s. [P2]
DRILL-012 D15 pre-read triage rubric: score = marked pauses / total pauses, marked speed changes / total, GO-time arithmetic errors, plus cold-run execution misses on the first 40 lines; 3 stars if all pauses marked and no GO-time error > 1 s. [P2]
DRILL-013 D16 time-of-day discipline rubric: a whole-minute error at a start/restart = fail regardless of seconds; 3 stars if |departure - out-time| <= 1 s on all cases including a minute rollover, an hour rollover and a lunch restart. [P2]
DRILL-014 D17 stopwatch-loss recovery: the sim forces a watch reset at a seeded point between two landmarks; rubric scores seconds until elapsed is re-established within 1 s of truth (from the clock + Column C) and the residual CP error. [P2]

## AGENT HARNESS / BOTS / VALIDATION
AGENT-001 CLI run with --bot oracle --scenario <generated seed> exits 0 and prints result JSON.
AGENT-002 stdin protocol is request/response JSON lines: the client sends {"type":"hello"} | {"type":"act", "action": Action} | {"type":"advance","seconds":n} | {"type":"advance","untilEvent":true,"maxSeconds":n} | {"type":"observe"} | {"type":"result"}; the harness replies exactly one JSON line per request; sim time moves only on advance; the book is sent once, in the hello reply, and never in later observations.
AGENT-003 advance with untilEvent stops early at the first event in {featureVisible, driverMessage, carStopped, carStarted, phaseChange, scheduledFired} (checkpoint crossings only at aids rung >= 2) and the reply carries elapsed seconds plus the events since the previous reply. [P2]
AGENT-004 A malformed request line yields one {"error": ...} reply and the harness continues (BOT-004); the hello reply contains only player-visible information (book without s, rules, aids, car preset name) per SIM-001; the same API is available in-process as playScript(scenario, requests) so tests never spawn processes except the one CLI smoke (AGENT-001). [P2]
AGENT-005 Scheduled actions: an act request may carry "when": {"elapsed": s} | {"watchReads": s} | {"event": "featureVisible", "label": ...}; it fires at the first matching tick, is recorded in result().actions with that tick, and the advance reply lists it as scheduledFired. [P2]
BOT-001 oracle bot on a generated leg with expert driver scores <= 3 s per checkpoint (median over 10 seeds).
BOT-002 rookie bot (ignores stop loss and ramp lead) scores >= 5 s per Pause 15 stop more than oracle on the pause drill.
BOT-003 noPause bot (calls go at wheels-stop with no dwell; the driver still stops at the sign per DRV-002) is EARLY by pause - stopLoss(v) = 4-10 s per forgotten Pause 15 on a single-stop leg (about 7 s at 35 mph with the 1939 preset).
BOT-004 random bot never crashes the simulator over 50 seeds x 200 random actions.
BOT-005 goCount bot starts timed-segment counts at its own "go" instead of the ghost's departure; on D04 compound scenarios (DRILL-011) it is early by 1-3 s per compound instruction at the CP versus oracle. [P2]
VAL-001 1% high speedometer uncorrected over a 15-minute leg costs 8-10 s for the oracle bot.
VAL-002 A wrong turn with 60 s excursion costs ~120-140 s at the next CP only; the following leg scores like a clean leg.

## UI (view-model level; rendering smoke via Playwright)
UI-001 stopwatchViewModel maps elapsed to sweep-hand angle for a configurable sweep (default 60 s: 0.2 s = 1.2 degrees; 30 s option: 2.4 degrees), the 30-minute register angle, and the stopwatch bezel rotation (WATCH-005).
UI-002 clockViewModel maps TOD to hour/minute/second hand angles and bezel rotation.
UI-003 speedoViewModel maps indicated mph to needle angle within the 0-100 dial and clamps.
UI-004 cameoSvg(node) produces an SVG string with a dot, an arrow, one bold path and thin paths for non-route exits, dashed for driveway/lot/deadend/private.
UI-005 bookRows(book, currentLine) marks exactly one current row and formats Column C as "35", "P15", "30 for 0:36 then 40".
UI-006 Playwright smoke (script test:e2e, not part of npm test): app loads, Home shows the curriculum, starting D03 shows the cockpit, Space starts the stopwatch, finishing shows a debrief; the test drives sim time through window.__rally.advance(seconds) (exposed with ?test=1), never wall-clock waits.
UI-007 Debrief view-model lists per-CP rows and an attribution breakdown whose buckets sum to the leg error.
UI-008 Progress persistence: saving a drill result through an injected Storage-like {get,set} interface (localStorage in the browser, an in-memory map in tests) and reloading restores stars and aces.
UI-009 Cockpit layout: road view spans the left pane top (>= 45 % height) with the pending callout and the driver's last line overlaid; below it clock (left), stopwatch (centre, largest, >= 240 px dial, lap list below), speedo (right, small); the GRIID book is a right column showing the previous line small, the current line extra-large, the next two large, the rest dimmed; the lapboard (ledger, perf card, cheat card, notes) is a bottom drawer. [P2]
UI-010 Adaptive time scale is UI-only (src/core has no time scale): the loop advances the sim by wallDt * scale in fixed DT ticks, caps catch-up at 1 s of sim time per frame, advances nothing while paused, runs at up to maxScale (default 4x) only while no feature is within sight, no hazard is active and no countdown/bezel target is within 15 s, drops to 1x otherwise, is locked to 1x in D01 and D03, and records the scale used in the saved drill result. [P1]
UI-011 Keyboard: Space start/stop; L or Enter lap; reset only via Shift+R or R held 600 ms with a confirmation flash; digits type a speed, Enter calls it, Up/Down nudge by 1 (mechanical) or 0.5 (Timewise), and with the card on the typed assigned speed shows the card's indicated value before Enter; arrows L/R/S, B+arrow bear, A+arrow acute, J+arrow jog; G go; U u-turn; T TA; N/P next/prev line; +/- time scale; Esc pause. [P2]
UI-012 Audio: watch click on start/stop/lap, the driver's speech via speechSynthesis when available (text overlay fallback), 3-2-1 beeps when the aid is on, train and signal sounds, a mute toggle; the Playwright smoke runs muted. [P2]
UI-013 Pre-read annotation: during phase 'preread' the book supports highlight colours (pause / speed / turn / quoted sign), a GO-time column next to pauses backed by act('line.annotate') (SIM-028), and a cheat-card panel; annotations persist through the run and appear in the debrief. [P2]

## DEBRIEF
DEBRIEF-001 Worked arithmetic per maneuver: for every stop the debrief view-model yields {entrySpeed, exitSpeed, cardLoss, correctDwell = pause - loss, yourDwell (go - "Stopped"), delta, formulaText} e.g. "dwell = 15 - 7.2 = 7.8 s; you called go at 11.1 s; +3.3 s"; for every timed change {T, rampLead, correctCall, yourCall, delta} and for every cruise segment {assigned, meanTrue, ratio, secondsOver, cardCorrection}. [P1]
DEBRIEF-002 Counterfactuals: the debrief re-runs the scenario (SIM-022) with the player's action log modified by each of (a) "if you had called go at the card dwell at every stop", (b) calls at T - rampLead, (c) exact calibration card, (d) qualifying hazards fully declared as TA; each yields the per-CP error next to the actual one ("+1 (was +7)") and is replayable; ATTR-001 holds for each run. [P1]
DEBRIEF-003 Bias vs noise: per maneuver type (stop, timed, landmark change, turn, cruise) the debrief shows mean and sd of the player's error for this run and the last 10 runs, labels each 'bias' (|mean| > sd, fixable by a number on the card) or 'noise' (fixable by practice), and the headline carries exactly one tip derived from the largest bias bucket (else the largest noise bucket). [P1]
DEBRIEF-004 Immediate CP card: at aids rung >= 2 a timing CP crossing yields {error, largestBucket, largestEvent} shown for 3 s of sim time; at rung <= 1 nothing is shown until the debrief (SIM-027). [P2]

## DETERMINISM
DET-001 src/core/** contains no Math.random, Date.now, performance.now, window, document or localStorage (static test); rng.fork(name) streams are independent (consuming N values from one fork does not change another) and reproducible from (seed, name). [P2]


## ADDED AFTER VALIDATION (2026-10-03)
DRV-018 A 90-degree-or-sharper turn called so late that the car is still above 1.6x the turn speed at the node is refused ("Too late, I can't make that turn"), logged as turnMissed, and the driver continues straight-as-possible (off course if that is not the route); a bear or a turn called in time is taken. [P1]
GEN-009 A generated stage's calibration run is a transit: an official restart line follows "END CALIBRATION" with restartTime rounded up to the minute 2-3 min after the ghost's arrival, the book text shows the restart clock time, and leg 1's clock starts at that restart. [P1]
GEN-010 Generated stages place at most 2 railroad crossings with trains and at most 1 that actually blocks; a "SPEED LIMIT NN" sign never posts a limit below the assigned speed. [P2]
BOT-006 The oracle declares the measured qualifying delay as a Time Allowance once per leg, and times a compound STOP + timed line from the ghost's departure of its own node, never a stale earlier segment. [P2]
RUB-001 Debrief headline: "Clean run" only when the mean |leg error| <= 3 s and the car never left the course; otherwise the headline names the largest cause whose sign matches the net error, and when stops (or another cause) lost time that cruise clawed back it says "lost N s in stops and recovered M s in cruise" instead of calling the recovery a wandering driver. [P1]
RUB-002 Attribution after a restart release: the acceleration ramp from a lunch/calibration restart to the assigned speed is booked to the 'start' bucket, not 'cruise'. [P2]
DRILL-018 D15 is its own scenario (about 40 lines, >= 8 pause lines, >= 2 timed lines, 10 min pre-read); its rubric ignores empty annotations, reads the first number in free text ("go at 7.3s"), and applies no turn cap to a straight-through STOP. [P1]
DRILL-019 D04 and D05 stars are capped by the mean per-change error (timedChange / speedChange buckets per instruction): D04 3/2/1 stars at <= 0.6/1.2/2.5 s, D05 at <= 0.35/0.7/1.2 s, so a run that nets out by luck cannot score 3 stars. [P2]
DRILL-020 Gold tier on D03, D04, D05 and D18 drives a seeded hidden car variant (ramps within +-15 % of the 1939 Ford preset) so the printed card is only approximately right; Bronze and Silver drive the preset. [P2]

## BACKLOG
# [P3] future specs from the design reviews; not required for v1 and ignored by spec-check.
GHOST-011 rules.turnSpeedDatum: 'afterTurn' applies a turn-line speed at s + intersectionWidth, 'leadingEdge' at s; a 35->25 turn over 80 ft differs by 0.62 s between the two (Q3). [P3]
GHOST-012 Transit sections add no travel time and contain no CPs; the ghost time at the following restart line equals restartTime; a free zone keeps the assigned speed and contains no CPs. [P3]
CAR-007 1939 preset acceleration includes shift dips at 12 and 30 mph of shiftDip seconds (0.8 default); 0-40 time exceeds the dip-free integral by 1.4-1.8 s. [P3]
CAR-008 Course grade g(s) (hidden, +-6 %) adds -32.2*g to net acceleration; at 50 mph on +4 % the 1939 preset sags to 46-48 mph and the driver says "Can't hold 50". [P3]
SPEEDO-007 Stock preset gain rises by warmDrift (+0.4 %) over the first 60 min of a stage so a morning k is 0.3-0.5 % stale by 14:00. [P3]
DRV-018 YIELD: the driver slows to <= 15 mph at the line and does not stop unless a cross-traffic hazard is active. [P3]
DRV-019 Braking for a control starts when it is visible and within braking distance; if sightDistance is shorter than the comfortable braking distance the driver uses the hard limit (14 ft/s^2) and logs "Short stop!". [P3]
DRV-020 misreadTurn: at a node with two exits in adjacent bands the driver takes the wrong one at the configured rate (rookie 0.08, expert 0.01) unless the callout names a discriminator (ordinal, surface or control). [P3]
DRV-021 Late callout: a turn callout received after the decision point (max(150 ft, 3 s * v)) is executed if v <= turn cap and logged lateCallout with overshoot feet; otherwise the driver stops and asks. [P3]
DRV-022 Trust 0..1 rises with on-time callouts and falls with late ones; it scales "Going?"/"Which way?" frequency and hesitation at ambiguous intersections (0.5-3 s); it never changes speed-hold error. [P3]
DRV-023 Personality: read-backs and questions are drawn from >= 3 seeded phrasing variants per intent; no driver speech during the last 3 s of an active countdown; "Haven't seen a sign in a while" after 4 min off course at aids rung >= 2. [P3]
WATCH-007 Clock offset: a stage starts with a hidden clock offset in [-20, 20] s when rules.clockSync = true; clock.set is accepted only in preread while the master clock is shown; leg-1 error includes the residual offset, later legs do not. [P3]
SIM-029 act('cp.spotted') within 10 s after crossing a CP is a hit; a CP crossed with no spotted action is reported "missed sighting", a spotted with no CP is a false alarm; no live feedback either way. [P3]
SIM-030 Attention model: act('book.open'/'book.close'); while open at aids rung <= 1 observe().ahead omits sign text and new features are marked unannounced until closed (reveal delay rules.lookDownDelay 1.5 s); every open interval is logged for the debrief. [P3]
SIM-031 Full stages are resumable: state is autosaved at every CP crossing and at lunch (lapboard, ledger, card, annotations) and resume reproduces identical result() for the same actions. [P3]
SCORE-012 TA double count: a leg with TA credit whose uncorrected error would have been within +-3 s is flagged taDoubleCount with the overlap seconds (attribution bucket 'taDoubleCount'). [P3]
PERF-005 npm test core suite: 100 000 simulator ticks complete in < 2 s (regression guard). [P3]
PERF-006 stopLoss(vIn, vOut, turn) adds the turn-cap profile when the exit is a turn; stopLoss(35, 35, 'R') > stopLoss(35, 35, 'S') by 1-3 s for the 1939 preset. [P3]
CAL-005 Calibration section has 10-14 intervals at 50 mph on a highway profile with exactly one interval spoiled by a slow vehicle; intervals carry a quality flag and the suggested k excludes the outlier (> 3 sd). [P3]
HAZ-006 A train hazard queues the car behind 0-4 vehicles; departure after gates-up is delayed 3 s per vehicle; the whole delay is TA-qualifying. [P3]
GEN-009 Town/rural density profile: >= 30 % of instructions fall in town clusters of >= 5 lines within 1.5 mi; at least two "Comes quick" hints per stage sit on lines <= 0.15 mi after the previous line. [P3]
GEN-010 At least one refuel/pit section with a restart line per generated full stage; lunch restart time = lunchBase + carNumber minutes, printed on the restart line. [P3]
GEN-011 Course grade profile g(s) is generated (hidden), bounded +-6 %, with >= 10 % of distance above |3 %| in 'hilly' profiles. [P3]
GEN-012 Excursion branches are generated from rng.fork('excursion:' + nodeId + ':' + exitIdx) and are identical regardless of when the car enters them. [P3]
DRILL-015 D19 checkpoint approach: hold speed through blind corners and town entries; sight-zone rule; observation CP stop at the finish; rubric counts sight-zone violations and missed observation stops. [P3]
DRILL-016 D20 protocol rubric counts (a) book opened with no landmark called in the previous 20 s, (b) turn callouts issued after the decision point, (c) callouts not acknowledged; 3 stars at zero of each. [P3]
DRILL-017 Daily set: three warm-ups (D01 x20, D03-arith x6, D09 x10) re-randomised per calendar day with per-day best; completion increments a daily streak stored with progress. [P3]
PROG-001 Skill ratings P1..P12 are 0-100, updated after every run as an exponentially weighted average (alpha 0.3) of the normalised score for the skills the drill maps to, decaying 2 points per idle day after 3 days. [P3]
PROG-002 Readiness = weighted minimum of skill ratings (P1-P8 weight 1, P9-P12 weight 0.5); Home shows readiness and names the lowest skill as "next". [P3]
PROG-003 Division ladder: each stage result is compared with bots random, rookie, sportsman, expert, oracle on the same seed; promotion after three consecutive stages below the division line, demotion after three above. [P3]
PROG-004 Aces are stored with stage id and CP id and rendered as stickers on the Home car; streaks "stops without a missed pause" and "legs without going off course" are tracked with bests. [P3]
DEBRIEF-005 Reading errors list: missed pause, wrong turn, late turn callout, line lost, forgotten TA declaration; each with line number and TOD. [P3]
DEBRIEF-006 Replay scrubber: the debrief re-simulates and snapshots observe() every 10 ticks; the road view shows both cars, the book highlights the current line, the stopwatch replays at 2x/4x/8x. [P3]
DEBRIEF-007 Trend: sd of stopwatch reaction (D01), card accuracy (D06), aces per stage and division position over the last 10 runs. [P3]
UI-014 Road view renders checkpoint crews as a parked vehicle + green sign on either side, the back of side-road STOP signs, stop bars at intersection leading edges, and sign text only inside half sight distance. [P3]
UI-015 Readiness, skill ratings, aces wall and streaks render on Home from storage (PROG-001..004); "Resume stage" is offered when SIM-031 state exists. [P3]
UI-016 Pace bar (aid) is drawn on the stopwatch bezel area, not as a separate widget; coarse mode shows only an early/late arrow; book focus dims the road view per SIM-030. [P3]

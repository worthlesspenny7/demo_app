# SPECS - numbered, testable. Every id must appear in at least one test name.
# Format: ID | statement | verification idea. Status column maintained by scripts/spec-check.

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
GHOST-008 ghostTimeAt(s) is monotone non-decreasing in s and piecewise linear between nodes.

## CAR (physical car)
CAR-001 With the 1939 Ford preset, 0 to 35 mph takes between 8 and 12 s and 0 to 50 mph between 15 and 22 s.
CAR-002 Braking from 35 mph to a stop with aDec = 8 ft/s^2 takes 51.3/8 = 6.4 s (+-0.2) and the car stops within 2 ft of the commanded stop line.
CAR-003 Cruise at a constant target holds within 0.05 mph after settling when the driver noise is zero.
CAR-004 A speed increase from 30 to 40 mph begins exactly when commanded and the ramp duration is deterministic for a given seed and consistency 0.
CAR-005 Position s is monotone non-decreasing while on course; distance integrates speed (1 s at 44 ft/s = 44 ft +-0.1).

## SPEEDO
SPEEDO-001 Timewise model with factor = trueFactor indicates the true speed within 0.05 mph after lag settles.
SPEEDO-002 Timewise with a factor 1% high indicates 1% high (35.35 for 35.0) and inverse() returns the true speed to hold for a wanted indicated value.
SPEEDO-003 Mechanical model indicates gain*v + offset + quad*v^2 before lag; the stock preset reads high at 50 mph by between 1 and 5 mph.
SPEEDO-004 Mechanical reading() is quantized to 1 mph marks; Timewise reading() to 0.1 mph.
SPEEDO-005 Daily drift re-randomizes the mechanical gain by at most +-1% per newStage() call and leaves the Timewise true factor unchanged.

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
DRV-010 Expert driver hold error sd <= 0.25 mph and rookie >= 0.8 mph measured over a 5-minute cruise (statistical, seed-fixed).
DRV-011 Turn execution caps speed (90-degree turn <= 12 mph at the node) and then re-accelerates to the target.
DRV-012 Slow vehicle hazard limits the car to the vehicle's speed until call.pass is issued during an open passing window or the hazard ends.

## WATCH / CLOCK
WATCH-001 start then step 10 s -> elapsed 10.0; stop freezes elapsed; start again resumes (cumulative).
WATCH-002 lap records the current elapsed as a split and keeps running; reset zeroes elapsed and clears laps only when stopped (analog) or anytime (digital).
WATCH-003 analog reading() is quantized to 0.2 s; digital reading() to 0.01 s.
WATCH-004 clock.tod() equals the simulator TOD; bezel.set(k) stores k seconds and bezelRemaining() = (k - tod_seconds_in_minute) mod 60.

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
SIM-014 The ghost car (an oracle driver with instantaneous speed changes) scores exactly 0 at every checkpoint on any generated scenario (property test over 20 seeds).
SIM-015 The event log records every node crossing, stop, go, hazard start/end, checkpoint, and callout with TOD.
SIM-016 observe().ahead lists exits for intersections with angle, surface, kind and controlFacingUs so a CAMEO can be drawn; sign text is present only when within half the sight distance.
SIM-017 A finished stage reports elapsed real driving time and the number of instructions executed.

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

## PERF TABLE / CALIBRATION
PERF-001 stopLoss(v, v, car) for the 1939 preset is within [5, 11] s for v in 25..45 and increases with v.
PERF-002 stopLoss(vIn, vOut) uses the deceleration ramp from vIn and the acceleration ramp to vOut; stopLoss(20, 40) > stopLoss(20, 20).
PERF-003 dwellFor(pause, vIn, vOut) = pause - stopLoss and is floored at 0.
PERF-004 rampLead(v1, v2) = ramp duration / 2 and a timed change called at T - rampLead has |position error| < 10 ft versus the ghost (simulated).
CAL-001 k = sum(P)/sum(A); for P=[100,100,100], A=[103,103,103] k = 0.9709 (+-1e-4).
CAL-002 indicatedToHold(35, k=0.9709) = 36.05 and cheatCard covers 20..50 step 5.
CAL-003 The calibration section of a generated stage has >= 3 intervals at 50 mph and total length >= 15 miles.

## HAZARDS
HAZ-001 A signal with cycle (red 40, green 50, offset) is red at time t iff ((t - offset) mod 90) < 40; the sim reports color only when visible.
HAZ-002 A train hazard blocks the crossing for its duration and the driver's wait is recorded as a qualifying TA delay.
HAZ-003 A slow vehicle hazard records a non-qualifying delay (inability to hold speed is not grounds for TA).

## ATTRIBUTION
ATTR-001 Sum of attributed buckets per leg equals the leg error within 0.5 s.
ATTR-002 Ignoring stop loss on a single Pause 15 with the 1939 preset attributes 5-11 s to bucket 'stop' and ~0 to other buckets.
ATTR-003 A 1% high speedometer over a 15-minute leg attributes 8-10 s to 'cruise.systematic'.
ATTR-004 A wrong turn with uturn attributes the excursion time to 'offCourse'.

## GENERATOR / TRAPS
GEN-001 generateStage(seed) is deterministic and valid (nodes sorted by s, instructions reference existing nodes, every leg has exactly one timing CP, speeds in 25..50).
GEN-002 Generated full stage has 150-260 instructions, 4-7 timing checkpoints, a calibration section, a lunch restart, and an observation CP at the finish.
GEN-003 Every generated STOP node has a Pause in the book (default 15) unless profile.noPauseTraps injects a missing one deliberately (flagged in truth).
GEN-004 Trap library has >= 15 entries each with instruction text, exits with exactly one isRoute, a wrong-exit list, a tip, and a category; all render to a CAMEO without error.
GEN-005 Timing checkpoints are placed >= 0.5 mi after the leg start and >= 0.3 mi from any STOP or SIGNAL node.
GEN-006 Distractor nodes (driveway, lot, gravel, deadend, side-road STOP facing away) never carry an instruction and are drawn with trapDensity probability.

## DRILLS
DRILL-001 Every drill definition has id, title, objective, scenario factory, rubric(result) -> {score, stars, feedback[]}, aids config, and unlock rule.
DRILL-002 Pause drill rubric: stars 3 if mean |stop error| <= 1 s, 2 if <= 3 s, 1 if <= 6 s.
DRILL-003 Trap quiz has 20 cards from the library and scores correct/incorrect with the tip shown on mistakes.
DRILL-004 Curriculum unlock: D11 requires 2 stars on D03, D04, D07; D12 requires D11 passed; D13 requires D12 passed.
DRILL-005 Aids default: pace bar and countdown ON for D01-D05, OFF for D11+ and cannot be enabled in 'Great Race legal' mode.

## AGENT HARNESS / BOTS / VALIDATION
AGENT-001 CLI run with --bot oracle --scenario <generated seed> exits 0 and prints result JSON.
AGENT-002 stdin protocol: each input line is an action JSON; the harness replies with one observation JSON line per step and a final result line.
BOT-001 oracle bot on a generated leg with expert driver scores <= 3 s per checkpoint (median over 10 seeds).
BOT-002 rookie bot (ignores stop loss and ramp lead) scores >= 5 s per Pause 15 stop more than oracle on the pause drill.
BOT-003 noPause bot scores ~15 s early per forgotten pause (12-18 s) on a single-stop leg.
BOT-004 random bot never crashes the simulator over 50 seeds x 200 random actions.
VAL-001 1% high speedometer uncorrected over a 15-minute leg costs 8-10 s for the oracle bot.
VAL-002 A wrong turn with 60 s excursion costs ~120-140 s at the next CP only; the following leg scores like a clean leg.

## UI (view-model level; rendering smoke via Playwright)
UI-001 stopwatchViewModel maps elapsed to sweep-hand angle (0.2 s = 2.4 degrees on a 30 s dial) and minute-register angle.
UI-002 clockViewModel maps TOD to hour/minute/second hand angles and bezel rotation.
UI-003 speedoViewModel maps indicated mph to needle angle within the 0-100 dial and clamps.
UI-004 cameoSvg(node) produces an SVG string with a dot, an arrow, one bold path and thin paths for non-route exits, dashed for driveway/lot/deadend/private.
UI-005 bookRows(book, currentLine) marks exactly one current row and formats Column C as "35", "P15", "30 for 0:36 then 40".
UI-006 Playwright smoke: app loads, Home shows the curriculum, starting D03 shows the cockpit, Space starts the stopwatch, finishing shows a debrief.
UI-007 Debrief view-model lists per-CP rows and an attribution breakdown whose buckets sum to the leg error.
UI-008 Progress persistence: saving a drill result to localStorage and reloading restores stars and aces.

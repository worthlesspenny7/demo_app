# Realism review - Rally Trainer v1 design (veteran TSD / Great Race navigator)

Reviewed 2026-10-03 against docs/spec/REQUIREMENTS.md, DESIGN.md, SPECS.md,
OPEN-QUESTIONS.md and docs/research/01, 03, 04, 06, 07. No web access; where I
assert something from the seat that the research does not cover I mark it
[SEAT] and it goes into section 4 for Josh to confirm.

Bottom line: the engine core (ghost car, leg reset, dwell = pause - loss,
ramp-centering, calibration math) is right and matches R07 §2-4 and R03 §0.
The defects are in what the *player is allowed to know and do*: several places
hand the learner information or tools a real navigator never has, and a few
generator rules build a kinder course than a rallymaster builds. Those teach
habits that will cost seconds in June.

---------------------------------------------------------------------------

## 1. Realism defects, ranked by how badly they mislead the learner

### D1. One stopwatch, but no bezel on it - the sim forces the reset-at-every-stop habit  (SEVERE)
DESIGN §8 / WATCH-001..004 give the stopwatch start/stop/lap/reset and put the
rotating bezel only on the time-of-day clock. Real one-watch technique (R03
§3.2-3.4, R01 §1.5, R07 §2.1): the watch is started on the official start
second and *never reset* all day ("stopwatch-as-TOD"); pause countdowns and
timed segments are done by rotating the stopwatch's own countdown bezel to
hand + (pause - loss), or by lap/split on a digital. A learner who can only
reset will reset at each stop, lose the TOD reference, and then have no
recovery path after a mis-press (R03 §9 item 8). The analog preset needs a
bezel; the digital preset needs a correct lap-display model (split frozen on
display while the counter runs, "recall" to return). Also: 30-minute register
is fine, but UI-001 assumes a 30-second sweep dial (0.2 s = 2.4 deg). Standard
1/5-s mechanical timers sweep 60 s (R05 line 185); the 30-s sweep is a
specialty Hanhart (R03 §3.4). Make sweep period a preset parameter, default 60.

### D2. The pace bar exposes a number the navigator can never have; the ledger is not a player artefact  (SEVERE)
DESIGN §9 observe().aids.earlyLate and §14 default it ON for D01-D05. In the
Great Race there are no printed times outside the calibration run (default Q1,
R01 §2.2, R03 §0) and checkpoints are hidden, so early/late is knowable ONLY
as a hand-kept ledger of events: "+7 light, -2 rolled the yield, +3 extra
dwell behind the pickup" (R07 §9.5 "Ledger management", R03 §4.1 item 3). The
design gives no action to keep that ledger; `note(text)` is free text the sim
cannot grade. The skill P6 says to teach is exactly the ledger, and the
debrief (U4) cannot show "your ledger said +4, truth was +11" without it. Add
a `ledger.set(seconds)` action and make the debrief compare ledger vs truth
over time. Keep the pace bar only as a *post-run* overlay, never live.

### D3. Checkpoints are placed where a rallymaster would never place them  (SEVERE)
GEN-005: CP >= 0.5 mi after leg start and >= 0.3 mi from any STOP or SIGNAL.
R06 §1 (Great Race 101): checkpoints "occur at the most inopportune places",
"may be on either side of the Race Route"; R06 Implications #5. [SEAT] The
classic placement is 200-600 ft after a stop sign or a speed change, exactly
to catch teams that have not compensated the maneuver yet; and shortly after a
turn into a new road. GEN-005 as written teaches "the stop is behind us, we
can settle in", which is the opposite habit. Also GEN-002's 4-7 CPs must allow
the 12-CP day (R06 §1 Team Hagerty Day 5) via profile, or the learner will
"coast the end of the leg" after CP #7 (R06 Implications #4).

### D4. Mechanical-speedo calibration is modelled as one linear factor from a 50-mph run  (SEVERE for Josh specifically)
DESIGN §12 / CAL-002: k from the morning run, cheat card = assigned/k for
20..50. That is correct for a Timewise (gain-only error). For the stock 1939
unit DESIGN §6 itself models gain + offset + quad + lag + bounce, so a single
50-mph k does not transfer to 25 mph (R07 §3.3: "Mechanical error is NOT a
constant factor ... grows with speed"). Calibration runs are "mostly at 50"
(R04 §2.1). Teaching Josh to scale a non-linear error linearly will put him
0.5-1 mph off at 25-35 mph all day = 10-15 s/day (R03 §2.1). Correct model:
the cheat card is built *pre-event* at every assigned speed (that is what
performance-data days are for, R01 §2.4), and the morning run only shifts the
whole card by the day's drift (SPEEDO-005). D07 must be split accordingly.

### D5. The navigator can read the speedometer to 0.1 mph from the passenger seat  (HIGH)
observe().speedo.indicated is given to the player every step. In the car the
driver watches the speedo and the navigator watches the clock and the book
(R03 §3.5, §6; R01 §5). A stock 1939 dial [SEAT] has coarse marks (likely 5
mph; the rule "no closer than one MPH" in R06 §2 is a *finest-allowed*, not a
requirement - REQUIREMENTS R1.11 misreads it), needle wobble, and the
navigator sees it at a parallax angle. Showing a clean indicated value trains
the navigator to drive the car from the right seat. In Great Race legal mode
the speedo should be hidden or quantized to the dial's marks and the
navigator should rely on the driver's read-back ("holding 36").

### D6. The driver never says "Mark" - the navigator's stopwatch cues are missing  (HIGH)
DRV-008 echoes callouts; nothing announces wheels-stop or at-speed. The real
cue for starting a dwell count is the driver's "stopped"/"Mark!" (R03 §2.4
Team 39; R03 §6 "the person whose hands/feet make the event happen is the one
who timestamps it"), and "at 40" ends a ramp. Without it the player starts
the watch off the road-view pixels, a cue that does not exist in the car.

### D7. BOT-003 contradicts the design's own physics  (HIGH, spec bug)
BOT-003: noPause bot "scores ~15 s early (12-18)". But DRV-002 makes the
driver stop at every STOP regardless, so a bot that says "go" at wheels-stop
still pays L_stop (5-11 s, PERF-001). Net early = 15 - L_stop = 4-10 s. Either
the bot rolls the stop (illegal; not a habit to model) or the target is wrong.
Fix the target to 4-10 s and add a separate "forgot to start the watch, dwelt
the full 15" case (late by L_stop; already ATTR-002).

### D8. Timed segment after a stop: the count starts when the GHOST leaves, not when we do  (HIGH)
The canonical instruction "Right at STOP, 25 for 40 s, then 45" (R01 §2.2,
R04 §2.1). Ghost: arrives at the line, +15 s pause, departs, holds 25 for 40 s
(R07 §9.2). Real car departs at dwell = 15 - L_stop, i.e. v/(2a_a) ~ 2-3 s
*before* the ghost departs. A navigator who starts the 40-s count at "go"
makes the change 2-3 s early -> 1-1.5 s at the CP, every such instruction,
same sign. DESIGN §4 does not state the within-node order (pause, then speed,
then timed anchor) and no spec or drill covers the compound case. This is a
top-3 rookie error [SEAT].

### D9. Signals: Q4 and the generator assume printed pauses at lights  (HIGH, inconsistent)
REQUIREMENTS R1.8 and R04 §2.3 (official Basics page): lights are NOT in the
instructions; stopped at a red = time the stop, take a time allowance or make
it up. OPEN-QUESTIONS Q4 ("green light with a printed Pause") and R07 §1.4/1.6
[MODEL] assume pauses at signals. GEN-003 only pauses STOPs, which is right,
but Q4 and D08 wording push the learner toward "burn the pause at a green".
Default must be: signals carry no pause; the decision is TA vs make-up, and
never both (double-counting a TA is a real rookie error [SEAT]).

### D10. Time allowance is modelled as a precise, instant, per-second credit  (MEDIUM-HIGH)
SIM-009: ta.declare(seconds) credits min(declared, measured). Real: TA
*requests* are submitted (the emergency phone is allowed "for the purpose of
submitting Time Allowance Requests", R04 §2.3), i.e. after the fact, reviewed
by officials, and [SEAT] in practice granted in whole minutes with evidence
(other cars delayed at the same train). The engine model is fine as a
simplification but the UI/lesson must not teach "declare 37 s and you are
made whole". Make granularity (`rules.taGranularitySeconds`, default 60) and
eligibility (`rules.taForSignals`, default per R04 §2.3 = true but flagged)
configurable, and penalize the "TA + made it up anyway" case in attribution.

### D11. Speed on a turn line: DESIGN §4 vs Q3 disagree, and the bias is systematic  (MEDIUM)
DESIGN §4: speed on a turn line applies at the node. OPEN-QUESTIONS Q3
default: "applies after the turn". R07 §1.1: after the turn [MODEL]. The
difference is ~0.5 s per turn (35 vs 25 mph over an 80-ft intersection) but
it is one-signed over 30+ turns/day = 10-20 s systematic. Pick one in the
engine, expose it as `rules.turnSpeedDatum = 'leadingEdge'|'afterTurn'`,
and surface it in the debrief as a bucket when the player's assumption and
the rule differ.

### D12. Calibration run too short and too easy  (MEDIUM)
DESIGN §13: 3-6 intervals at 50. R03 §2.1 (Rowland): "typically 20 minutes
or longer with a dozen or more interval readings"; R01 §4: >= 15 mi. CAL-003
says >= 3 intervals / 15 mi - consistent with the design, not with the
source. The dozen readings matter: it is a stopwatch-split endurance test and
the player must learn to discard an interval wrecked by traffic (slow truck
on the 4-lane) and weight the long ones (R07 §3.2). Also the run is on
interstate/4-lane (R03 §2.1), not back roads: give it a highway profile.

### D13. Driver patience 25 s / 50 s and no cross traffic at STOPs  (MEDIUM)
DRV-003: "Going?" at 25 s, leaves at 50 s. Real dwell is 5-10 s; a driver
sitting 25 s silently at an empty stop sign is unrealistic and masks a lost
count. More important: F5 promises "stop signs (with/without cross traffic
wait)" but DESIGN §7 and HAZ-* never model a cross-traffic wait or a queue at
a 4-way (2 cars ahead = ~8 s you cannot control). R04 §2.3: "if you have to
wait for traffic longer than your planned pause time, you will need to make
up the difference". That is a core ledger event, missing.

### D14. Off-course branches have no tell  (MEDIUM)
DRV-006: excursion "0.3-1.5 mi, no landmarks". With no odometer and no
printed intervals, the only off-course detector in the Great Race is "a
STOP/T/dead end/gravel appeared that is not in the book" (every stop is
printed: R01 §2.1 "every turn, speed change, stop, and start"). An empty
branch cannot be detected by anything but the player's gut; the drill then
teaches nothing. Branches must carry an unlisted control within a plausible
distance.

### D15. Flat earth, perfect throttle  (MEDIUM for a 1939 Ford)
CAR §5 has no grade. An 85-hp flathead sags 2-4 mph on a 4% grade at 50 and
gains on the downhill; the driver's hold error is grade-driven, not Gaussian.
Route 66 country (MO/OK hills) is not flat. Without grade, the "speed hold"
bucket in attribution will under-represent the biggest real-world cruise
error source for this car, and the learner will not practise "Dad, you're
sagging, we're going to be late out of this hill".

### D16. Minor spec-level realism nits
- GEN-001 speeds 25..50: towns use 20 (and school zones); allow 20.
- DESIGN §7 slow vehicle: passing is the driver's safety call, not a
  navigator callout; `call.pass` should be a request the driver may refuse.
- SIM-006: no handling of a LATE start (preread overrun) - should just flow
  into leg-1 error, and the debrief must say so ("you left 14 s late").
- Clock is pre-synced for free (WATCH-004 `tod()` = sim TOD). "Start on
  Time" (R01 §5) includes setting your clock to the master clock; one-time
  `clock.set` with an initial random offset belongs in D11+.
- DESIGN §3 Instruction has `section` but GHOST has no semantics for
  'transit'/'freezone' (no speed / no CPs). Needs a spec.
- Refuel/pit stops with an assigned restart exist (Rowland "19 seconds late
  getting to a restart after a refueling stop", R01 §7) and are absent from
  the generator.

---------------------------------------------------------------------------

## 2. Missing realism that matters for training

### 2.1 What the navigator's hands and eyes actually do
- One hand: stopwatch on a lanyard, thumb on the crown, all day (R03 §3.4).
  Other hand: lapboard with the ring-bound book, pencil, cheat card under the
  clear cover (R01 §1.6). There is no third hand for a clock: the clock is
  read, never touched, except the bezel at a restart.
- Eyes: book -> road -> watch -> road. Every look down is a chance to miss a
  landmark; the official habit is "tell the driver what comes next BEFORE
  looking down" (R01 §5). The sim's road view is always visible, so this
  habit is never exercised. Proposal: a `focus` state ('road'|'book'|'watch')
  that the UI sets from what the player is interacting with; features that
  come into sight while focus != 'road' are revealed with a 1.5-2 s delay
  and logged as "seen late". Default ON from D10.
- Pre-read is physical: highlighter on pauses and speed changes, pencil
  dwell numbers next to each pause ("8.5"), page tabs. The sim needs
  per-line annotation, not one free-text pad (see SIM-019 below).
- Mis-press is real: stop instead of lap, double-tap. A drill for recovering
  elapsed time from the clock + last known event (R03 §9 item 8) is missing
  from D01-D14.

### 2.2 How the road view should reveal landmarks
- Signs read as *shape and colour* first (octagon red, triangle, diamond
  yellow) at long range; text only close (SIM-016 half sight distance - good).
  Blades (street names) are readable only at ~100 ft and often only from the
  far side of the intersection; this is why "Right at 'Oak Rd'" is a trap
  (R04 §1.2, §1.7).
- A STOP for cross traffic shows you its *back* (grey octagon) - render the
  back of side-road signs explicitly (R04 §1.8).
- Wide intersections: the datum (leading edge) is 60-120 ft before the
  centre; render the stop bar / curb line so "leading edge" is learnable
  (R04 §5).
- Checkpoint = a parked car or van with a green Day-Glo sign on a tripod, a
  crew member with a clipboard, on the shoulder, either side (R01 §3.1, R06
  §1). Visible 300-800 ft on a straight, 100 ft after a bend. Teams miss
  them (R01 §7). The sim must render a crew car, not just a sign, and must
  NOT emit a "checkpoint crossed / leg 2" event to the player.
- Hills and curves hide the next sign ("Comes quick", R04 §1.11 "sign hidden
  around a corner").

### 2.3 How the driver (Dad) behaves
- Calls "stopped"/"Mark" at wheels-stop, "at 40" when settled, "truck ahead",
  "I can't hold 50 on this hill", "which way at the stop?" when the callout
  is late, and reads back turns and speeds (R01 §5 "driver should repeat
  important directions back").
- Mis-executes sometimes: takes the 90 when told "bear", rolls a yield, turns
  at the first STOP-shaped sign, overshoots to 42 after a 30->40 change.
  Rowland's Rule #11 "'Right' is not 'correct'" (R06 §2) is a *driver*
  misunderstanding. Error rate should be a DriverSpec knob; it teaches the
  navigator to say "the SECOND right, past the gravel one".
- Refuses unsafe recovery speeds ("not passing here") - Safety First is the
  first S (R01 §5).
- Gets tired and quieter in the afternoon (fewer spontaneous callouts).

### 2.4 Traffic and town realities
- Following traffic at 28 in a 35 zone for a mile (not TA-eligible: R04 §2.3
  "inability to maintain assigned speed").
- 4-way stops with 1-3 cars ahead; left turns waiting for a gap; a pedestrian
  crossing in the lunch town; a school zone with a flashing 20.
- Lights: many, some red; the decision is TA vs make-up (D9). Long reds
  (60-90 s) that cannot be recovered before a likely CP.
- Trains: gates down 1-4 min plus the queue; Roberts' 48-s leg (R06 §2) is
  the canonical "forgot to time it" story.
- Being "rookied": the car ahead turns; you follow (R04 §1.17).
- Lunch town: a transit into a crowd, a 45-min stop, roll-out one per
  minute, your restart second computed from your car number (R06 §1, R01 §4).

### 2.5 What a 1939 Ford Deluxe feels like [SEAT + R01 §6]
- 85-hp flathead V8, 3-speed manual, non-synchro first: acceleration is a
  staircase, not a ramp - clutch dips of 0.5-1 s at the 1-2 (~12 mph) and 2-3
  (~28-32 mph) shifts. L_stop(0->40) therefore has a shift inside it and is
  not a smooth function of speed; a performance table with 5-mph columns is
  needed, not a formula.
- First-year hydraulic brakes: adequate, 0.25 g comfortable (aDec 8 is
  fine), fade on long downhills.
- No power steering, bias-ply tyres: 90-degree turns at 8-10 mph, not 12.
- Speed holding: throttle linkage is coarse; the car hunts +-1 mph on crowned
  two-lane; speed sags on grades and the driver must anticipate.
- Stock speedometer: magnetic drag cup; reads high and increasingly so with
  speed; needle lags ~1 s and wobbles; dial marks are coarse; the drive cable
  resonates at certain speeds. Daily drift with tyre pressure/temperature is
  real (R07 §3.3) - but so is *within-day* drift as tyres heat (afternoon
  rollout smaller -> speedo reads higher).
- June heat, noise, no A/C: the afternoon is a fatigue problem. Routines
  must survive it (R06 Implications #12).

### 2.6 What rookies actually get wrong (ranked, from R06 §6, R04 §2.3, [SEAT])
1. Wrong turn / wrong way out of a start (minutes).
2. Not timing an unplanned stop (train, light, traffic) - 48-s leg.
3. Starting the timed segment at "go" instead of the ghost's departure (D8).
4. Forgetting a pause; or dwelling the full 15 after a long traffic wait
   (when the wait already exceeded 15 - L you go *immediately*).
5. Resetting the only stopwatch and losing TOD / losing the line in the book
   after a "comes quick" cluster.
6. Taking a TA AND making the time up.
7. Correcting past zero into early (penalties symmetric, R03 §5.1).
8. Relaxing after "the usual" 6-7 checkpoints.
9. Wrong restart minute after lunch / refuel.
10. Driving the car from the right seat (watching the speedo instead of the
    clock and the road).

---------------------------------------------------------------------------

## 3. Concrete change requests

### 3.1 DESIGN.md edits

**§4 Ghost car** - add after the bullet list:
> Order of operations within one node is fixed: (1) the node is reached at
> time t; (2) `pause` adds to t; (3) `speed`/`timed.hold` sets v from this
> point; (4) a `timed` anchor is the ghost's departure time (after the
> pause). Sections 'transit' and 'freezone': no checkpoints are placed; in a
> transit no speed applies and the section must end at a restart line that
> re-anchors t. `rules.turnSpeedDatum` selects whether a speed printed on a
> turn line applies at the leading edge or after the turn (default
> 'afterTurn', Q3).

**§5 Physical car** - replace the acceleration sentence:
> Acceleration limit `aAcc(v) = a0 * max(0.15, 1 - v/vMax)` modulated by a
> gear model: the preset has shift points (1->2 at 12 mph, 2->3 at 30 mph)
> each costing `shiftDip` seconds of zero acceleration (1939 preset 0.8 s,
> consistency-scaled). Turn speed caps for the 1939 preset: 90-degree 10 mph,
> bear 20, acute 7. Course grade `g(s)` (hidden, generated, -6..+6 %) adds
> `-32.2*g` ft/s^2 to the car's net acceleration; the driver controller's
> throttle authority saturates so the car sags on grades at a0-limited rate.

**§6 Speedometer** - add:
> Dial marks are a preset parameter: `markSpacingMph` (Timewise 1, stock 5)
> and `readableTo` (Timewise 0.1, stock 1). Stock preset adds within-day
> drift: gain rises linearly by `warmDrift` (default +0.4 %) over the first
> 60 min of driving.

**§7 AI driver** - add bullets:
> - Event callouts: "Stopped" when v reaches 0 at a stop line, "At NN" when
>   within 0.5 mph of a new target for 1 s, "Truck ahead, holding NN" when
>   speed-limited, "Can't hold NN" on grade saturation; latency by skill
>   (expert 0.3 s, rookie 1.0 s).
> - Execution errors: with probability `misreadTurn` (rookie 0.08, expert
>   0.01) at a node with two exits in adjacent angle bands, the driver takes
>   the other one unless the callout named a discriminator (`call.turn(dir,
>   {ordinal|surface|control})`).
> - Patience: "Going?" at `patienceSeconds` default 12; departs on his own at
>   2x only if cross traffic is clear.
> - Cross traffic at STOP: a `trafficWait` hazard (0-20 s, seeded) that holds
>   the driver after "go" until clear; logged as a ledger event.
> - `call.pass` is a request; the driver refuses when `passWindow` is closed.
> Replace "Holds the indicated speed last called" with: holds the needle at
> the nearest readable mark/interpolation permitted by `speedo.readableTo`,
> with hold sd = max(skill sd, 0.25 * markSpacingMph).

**§8 Stopwatch and clock** - add:
> Analog stopwatch has a rotating countdown bezel (`watch.bezel.set(k)`),
> 60-s sweep by default (`sweepSeconds` 60|30), 30-min register. Digital
> preset: `lap` freezes the display on the split while counting continues;
> `recall` returns the display to running time; `reset` any time. The analog
> `reset` is refused while running. The clock starts the stage with a hidden
> offset of +-0..20 s; `clock.set(tod)` is available only in the preread
> phase while the master clock is shown (D11+); in D01-D10 it is pre-synced.

**§9 Simulator** - add to observe(): `focus`, `ledger` (player-maintained),
`annotations[]`; remove `speedo.indicated` when `aids.showSpeedo` is false
(Great Race legal mode shows it quantized to the mark or hides it). Never
expose leg index, "checkpoint crossed", or hazard measured delay during
'running'. Add actions: `ledger.set(seconds)`, `line.annotate(n, text)`,
`watch.bezel.set`, `watch.recall`, `clock.set`, `focus.set`, `cp.spotted`
(player acknowledges a checkpoint; graded in the debrief against truth).

**§10 Scoring** - replace the TA bullet:
> Time Allowance: requests are granted in `rules.taGranularitySeconds`
> (default 60) rounded up from the measured qualifying delay, capped at the
> request; signals qualify only if `rules.taForSignals` (default true, Q5
> flagged). A leg where a TA was granted AND the player recovered the same
> time is early by the overlap; attribution labels it 'taDoubleCount'.

**§13 Generator** - replace the checkpoint sentence:
> 1 hidden timing checkpoint per leg; placement weights: 35 % within 0.1-0.4
> mi after a STOP/SIGNAL or speed change, 25 % within 0.3 mi after a turn
> onto a new road, 40 % on an open straight; never inside a free zone,
> transit, warm-up or calibration section; never within `sightDistance` of
> another CP. `profile.cpCount` 4-7 default, up to 12. Instruction density:
> towns (3-6 lines per mile, speeds 20-30, blades, signals, parked cars),
> rural (0.3-1 line per mile, speeds 40-50), transitions marked by "Comes
> quick" hints. Calibration section: 10-14 intervals at 50 on a highway
> profile with one traffic-spoiled interval. Add refuel/pit sections with an
> assigned restart. Excursion branches carry an unlisted STOP, T, dead-end
> sign or gravel within 0.2-0.8 mi.

**§14 Drills** - add:
> D15 Stopwatch-as-TOD: run a 10-min leg with pauses and a timed segment
> using one never-reset watch and the bezel; score dwell errors and the
> final elapsed read-back.
> D16 Mis-press recovery: watch is reset mid-leg; recover from clock + last
> event; score residual.
> D17 Stop-then-timed compound: "Right at STOP, 25 for 40 then 45" x 6 with
> varying L_stop; score change-point error (targets D8).
> D18 Unplanned stops ledger: trains, lights, 4-way queues; player keeps
> `ledger.set` and decides TA vs make-up; score ledger-vs-truth and
> double-count events.
> D19 Pre-read triage: 240 lines, 30 min of sim clock, annotate pauses with
> dwell and highlight speed changes; score coverage and then run the first
> 40 lines cold.
> D07 is split: D07a "Timewise factor" (single k), D07b "Stock speedo card":
> pre-event multi-speed measurement (with GPS allowed in practice) -> card;
> morning run shifts the card.

### 3.2 SPECS.md edits (replace text)

- **UI-001** -> "stopwatchViewModel maps elapsed to sweep-hand angle for a
  configurable sweep (default 60 s: 0.2 s = 1.2 degrees; 30 s option: 2.4
  degrees), the 30-minute register angle, and the bezel rotation."
- **WATCH-002** -> "lap records the split and keeps counting; on the digital
  preset the display shows the frozen split until `recall`; reset is refused
  while an analog watch is running and allowed anytime on digital."
- **DRV-003** -> "With no go within patience (default 12 s) the driver emits
  'Going?'; at 2x patience he departs on his own only if cross traffic is
  clear; departure is logged."
- **DRV-001** -> "After call.speed(35) the driver's target is the nearest
  readable indication (speedo.readableTo); true speed converges to
  speedo.inverse(target) with hold sd >= 0.25 * markSpacingMph."
- **SIM-001** -> add "...nor the leg index, checkpoint-crossed events, or
  hazard measured delays while phase = 'running'."
- **SIM-009** -> "act('ta.request', seconds) in a leg credits
  ceil(min(requested, measured qualifying delay) / rules.taGranularitySeconds)
  * granularity; signals qualify only when rules.taForSignals; the request is
  logged and reviewed in result(), not applied live."
- **GEN-001** -> speeds in 20..50.
- **GEN-002** -> "...4-7 timing checkpoints by default (profile up to 12)..."
- **GEN-005** -> "Timing checkpoints are never placed in warm-up,
  calibration, transit or free-zone sections, never within another CP's sight
  distance, and at least 35 % of them lie 0.1-0.4 mi after a STOP, SIGNAL,
  speed change or turn (seeded, statistical over 20 stages)."
- **CAL-003** -> "The calibration section has 10-14 intervals at 50 mph on a
  highway profile, total length >= 15 mi, and exactly one interval spoiled by
  a slow-vehicle hazard that the player should discard."
- **BOT-003** -> "noPause bot (calls go at wheels-stop, no dwell) is early by
  15 - L_stop = 4-10 s per forgotten Pause 15 on a single-stop leg."
- **DRV-006** -> add "...the excursion branch contains at least one unlisted
  control (STOP, T, DEAD END sign or gravel) within 0.2-0.8 mi."

### 3.3 New specs

GHOST-009 Within a node the ghost applies pause before speed/timed; a timed
  anchor time equals node arrival + pause; test "STOP P15, 25 for 40 then 45":
  virtual node at s + 25mph*40s, ghost time there = arrival + 55 s.
GHOST-010 Transit sections add no travel time and contain no CPs; the ghost
  time at the following restart line equals restartTime; a free zone keeps
  the assigned speed and contains no CPs.
GHOST-011 rules.turnSpeedDatum: 'afterTurn' applies a turn-line speed at
  s + intersectionWidth; 'leadingEdge' at s; a 35->25 turn over 80 ft
  differs by 0.62 s between the two.
CAR-006 1939 preset acceleration includes shift dips at 12 and 30 mph of
  shiftDip seconds (0.8 default); 0-40 time exceeds the dip-free integral by
  1.4-1.8 s.
CAR-007 On grade g the car's net acceleration includes -32.2*g; at 50 mph on
  +4 % with the 1939 preset steady-state speed sags to 46-48 mph with the
  controller saturated; the driver emits "Can't hold 50".
SPEEDO-006 Stock preset reading() is quantized to markSpacingMph (5) when
  aids.showSpeedo = 'dial'; Timewise to 1 mph marks interpolated to 0.1.
SPEEDO-007 Stock preset gain rises by warmDrift over the first 60 min of a
  stage, so k measured on the calibration run is 0.3-0.5 % stale by 14:00.
DRV-013 The driver emits "Stopped" within skill latency of v = 0 at a stop
  line and "At NN" within 1 s of settling at a new target; both carry TOD.
DRV-014 With misreadTurn > 0 and a node with two exits in adjacent bands,
  the driver takes the wrong exit at the configured rate unless the callout
  carries a discriminator; with discriminator the rate is 0.
DRV-015 A trafficWait hazard at a STOP holds departure after call.go until
  clear; the extra wait is logged as a ledger-eligible event, not a TA.
DRV-016 call.pass is refused (message logged) while the slow vehicle's
  passWindow is closed; the car stays at the vehicle's speed.
WATCH-005 Analog stopwatch bezel: watch.bezel.set(k) stores k seconds;
  bezelRemaining() = (k - elapsed) mod sweepSeconds; reset is refused while
  running.
WATCH-006 Digital lap freezes the displayed value until watch.recall while
  elapsed continues; two laps in a row store two splits.
WATCH-007 Clock offset: a stage starts with a hidden offset in [-20, 20] s
  when rules.clockSync = true; clock.set is accepted only in preread; leg-1
  error includes the residual offset; later legs do not (anchor = recorded
  arrival).
SIM-018 act('ledger.set', s) is stored and timestamped; observe().ledger
  returns it; result() includes a time series of (ledger, truthEarlyLate).
SIM-019 act('line.annotate', n, text) stores per-line notes shown in
  bookRows; result() reports pre-read coverage (fraction of pauses annotated
  before start).
SIM-020 act('cp.spotted') within 10 s after crossing a CP is a hit; a CP
  crossed with no spotted action is reported "missed sighting" in the
  debrief; a spotted with no CP is a false alarm. No live feedback either way.
SIM-021 observe().focus is 'road'|'book'|'watch'; a feature that enters
  sight while focus != 'road' is appended to ahead[] only after
  rules.lookDownDelay (default 1.5 s) and logged "seen late".
SIM-022 A late departure (act('start') after startTime) keeps the official
  anchor; result() reports secondsLateAtStart and attribution assigns it to
  'start'.
SCORE-010 TA credit is rounded up to rules.taGranularitySeconds and applied
  in result(); a leg with TA credit whose uncorrected error would have been
  within +-3 s is flagged taDoubleCount with the overlap seconds.
PERF-005 stopLoss(vIn, vOut, turn) adds the turn-cap profile when the exit is
  a turn; stopLoss(35, 35, 'R') > stopLoss(35, 35, 'S') by 1-3 s for the
  1939 preset.
PERF-006 The 1939 performance table has 5-mph columns 20..50 for stop losses
  and a from/to matrix for ramp leads; values are not fit by a single
  formula (CAR-006 dips) and the sim's "truth table" is produced by
  simulation, not the closed form.
CAL-004 Stock-speedo cheat card is built per assigned speed from a
  multi-speed pre-event measurement (practice mode with a true-speed
  reference); the morning run shifts all card entries by the single day
  factor; a card built by linear scaling from a 50-mph k alone is >= 0.5 mph
  wrong at 25 mph for the stock preset.
CAL-005 Calibration intervals carry a quality flag; the suggested k excludes
  intervals whose measured/perfect ratio deviates > 3 sd from the rest (the
  traffic-spoiled one), and the lesson shows why.
HAZ-004 trafficWait at STOP: seeded 0-20 s hold after go, probability by
  profile (town 0.5, rural 0.15); not TA-qualifying.
HAZ-005 Signal hazards carry no pause in the book (GEN) and are TA-qualifying
  only when rules.taForSignals.
HAZ-006 A train hazard queues the car behind 0-4 vehicles; departure after
  gates-up is delayed by 3 s per vehicle; the whole delay is TA-qualifying.
ATTR-005 'start' (late/early departure and clock offset) and 'taDoubleCount'
  are attribution buckets; ATTR-001 still holds.
GEN-007 Excursion branches contain an unlisted control within 0.2-0.8 mi.
GEN-008 Town/rural density profile: >= 30 % of instructions fall in town
  clusters of >= 5 lines within 1.5 mi; at least two "Comes quick" hints per
  stage sit on lines <= 0.15 mi after the previous line.
GEN-009 At least one refuel/pit section with a restart line per generated
  full stage; the lunch restart time = lunchBase + carNumber minutes and is
  printed on the restart line.
GEN-010 Course grade profile g(s) is generated (hidden), bounded +-6 %, with
  >= 10 % of distance above |3 %| in 'hilly' profiles.
DRILL-006 D15-D19 exist with rubrics as in DESIGN §14; D17 stars: 3 if mean
  change-point error <= 1 s, 2 if <= 2.5 s, 1 if <= 5 s.
DRILL-007 Great Race legal mode hides live earlyLate and hides or
  mark-quantizes the speedometer; the debrief may show both.
BOT-005 'goCount' bot starts timed segments at its own "go" instead of ghost
  departure; on D17 scenarios it is early by 1-2 s per compound instruction
  at the CP versus oracle.
UI-009 Road view renders checkpoint crews as a parked vehicle + green sign on
  either side, the back of side-road STOP signs, stop bars at intersection
  leading edges, and sign text only inside half sight distance.

---------------------------------------------------------------------------

## 4. Assumptions to flag to Josh (only a competitor / the Rookie Handbook can settle)

1. Column C outside the calibration run: speeds, pauses and timed segments
   only - no interval or cumulative times? (Q1; regs wording in R03 §0 says
   "interval times ... and the cumulative times" - is that calibration-only?)
2. Is the calibration run on the clock (part of leg 1 from the stage start)
   or is there a restart line after it? Roberts' 10-min wrong-way start for
   a 21-s day (R06 §2) suggests an untimed first section.
3. Where does a speed printed on a turn line take effect - leading edge or
   after the turn? (Q3; D11.)
4. Are there ever printed pauses at signals / RR crossings / sharp turns, or
   are pauses STOP-only with lights handled by TA? (D9.)
5. Time Allowance mechanics: who may request, how (phone/form), when
   (before the CP? end of day?), granularity (seconds or minutes), evidence
   required, and do traffic lights really qualify (the Basics page says yes;
   many veterans say "lights are part of it")?
6. Start and lunch restart procedure: does an official release you at your
   minute (your clock irrelevant) or do you self-start to your own clock?
   Where is the master clock, and how is the lunch restart time assigned
   (base + car number)?
7. Is the finish Observation Checkpoint timed for score, or only a mandatory
   stop/endorsement?
8. Rookie division: is a worst leg dropped per stage, per event, or not at
   all (the 1:05 "dropped" anecdote, R04 §2.3)?
9. Trophy Run: counts toward overall or tiebreak only (Q9)?
10. Missed-CP cap (V.E.2), sight-zone penalty (V.E.3.a), early/late restart
    penalty values (Q6).
11. Are assigned speeds always multiples of 5, and is 20 (or lower) used in
    towns and school zones?
12. Stock 1939 Ford speedometer: dial mark spacing (2 or 5 mph?), how far it
    reads high at 30/40/50 on Josh's car, needle wobble - and will the team
    really run the stock unit (Croker's page strongly advises a calibratable
    one, R01 §1.2)?
13. Josh's car numbers: 0-35 and 0-50 times, shift speeds, comfortable
    braking, 90-degree turn speed, speed sag on a 4 % grade at 50.
14. Dad's protocol preferences: does he want "Mark"/"stopped" callouts, a
    5-count or 3-count, speed read-backs? The AI driver should be tuned to
    the real driver.
15. Stopwatch choice (digital with lap vs analog with bezel) and whether the
    team will run stopwatch-as-TOD from the start second.
16. Checkpoint density and placement in recent events: how often within a
    few hundred feet after a stop or turn; ever 12 in a day still?
17. Does the GRIID book print the written instruction text in Column A with
    the CAMEO, or in a separate column (R04 §2.2 unresolved)? Affects
    bookRows (UI-005).

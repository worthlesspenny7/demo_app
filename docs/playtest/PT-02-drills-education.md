# PT-02 - Drill curriculum playtest (education pass, headless protocol)

Date 2026-10-03. Playtester: LLM agent acting as Josh (engineer, motivated, has read
docs/research/07 §2/§6 and 03 §9, carries a paper performance card for the 1939 Ford).
Interface: `src/agent/protocol.ts` only (hello / act / advance / observe / result).
No `truth` requests were used while playing; `truth` was used afterwards only to
diagnose engine behaviour. UI not used (being built). No files under src/ or tests/
were touched; the learner agent and repros live in the session scratchpad
(`learner.ts`, `repro-*.ts`, per-run traces).

## 0. The paper card I played with (1939 Ford, from `perf-table.ts`)

| | 20 | 25 | 30 | 35 | 40 | 45 | 50 |
|---|---|---|---|---|---|---|---|
| stop/start loss v->v (s) | 4.1 | 5.2 | 6.4 | 7.6 | 8.9 | 10.2 | 11.7 |
| standstill accel loss 0->v (s) | 2.3 | 3.0 | 3.7 | 4.4 | 5.2 | 6.1 | 7.1 |
| brake half-loss (= stop - accel) | 1.8 | 2.2 | 2.7 | 3.2 | 3.7 | 4.1 | 4.6 |
| 90 deg turn loss v->v (s) | 2.5 | 3.9 | 5.2 | 6.5 | 7.9 | 9.3 | 10.8 |

Mixed pairs used: stop 35>30 6.8, 30>40 7.9, 40>30 7.3, 35>40 8.4, 50>35 9.0;
a stop followed by a 90 deg turn adds ~1-2 s (e.g. 30>40 turn 9.4, 40>40 turn 10.4).
Half-ramp leads: 35>30 1.0, 30>40 2.3, 25>35 2.1, 40>30 1.4, 35>45 2.5, 50>25 2.8.

How I played: start at out-time minus the accel loss; watch running from the start;
lap on every landmark; at a STOP: lap at wheels-stop, call the exit speed and the turn,
schedule `call.go` at `pause - stopLoss`; timed segments: call the hold speed half a
ramp before the landmark, call the "then" speed at `T - lead` counted from the
landmark (or from the ghost's departure after a compound STOP); landmark speed changes
half a ramp early; a seconds ledger for every forced loss and +5 mph for
`(v/5+1) x seconds` to pay it back; TA declared for trains/lights when playing D08b.
Scheduled actions (`act` with `when.elapsed`) were my countdown bezel.

## 1. Per-drill results

Leg errors are signed seconds (+ late). "naive" = full printed pause, no leads, leave
exactly on the out-time (what a first-timer does). Stars from `drill.rubric`.

| Drill | Tier / variant | Leg errors (s) | Stars | Verdict |
|---|---|---|---|---|
| D03 pause arithmetic | Bronze s1, card | 0, -1, +1, 0 (2 aces) | 3 | Skill works exactly as taught. Headline tip WRONG ("stops cost more than the pause") - see BUG-3 |
| D03 | Bronze s1, naive | +24, +14, +16, 0 | 0 | Correct, and the tip is right here. Great "aha" when compared with the card run |
| D03 | Gold s1 / s2 / s3 | 0,+5,+2,-1 / +2,+4,+1,+1 / 0,-1,+1,0 (2 aces) | 2 / 2 / 3 | Rookie driver's stop/start scatter (+-2-4 s) capped 2 of 3 seeds at 2 stars with the same card and play; no traffic wait occurred in my seeds (they do fire: 20 in 72 oracle stops) |
| D04 timed changes | Bronze s1 / s2 | -1, 0 / 0, -1 | 3 / 3 | Compound STOP+timed handled by counting from ghost departure (= stop - brake half + pause) |
| D04 | Bronze, count from my own GO (the trap) | -1, -2 / +2, -2 | 2 / 2 | The trap costs only ~1 s per compound line at these speed pairs; tip says "Clean run" |
| D04 | Gold s1 / s3 | -3, 0 / +2, +3 | 2 / 2 | Driver noise again dominates |
| D05 landmark speed changes | Bronze s1 / s3 | -1, +1 / 0, -1 | 3 / 3 | Headline tip WRONG ("speedometer reads high") on a Timewise, BUG-3 |
| D05 | Bronze s1, naive | +4, -33 | 0 | My agent missed a sign by calling "at" the sign with 0.5 s reaction; realistic lesson, see BUG-9 |
| D05 | Gold s1 / s2 | -4, +3 / -5, 0 | 1 / 2 | Half-ramp lead is worth ~0.6 s per change; rookie-driver cruise noise is 3-5 s per leg. The rubric cannot see the skill at Gold |
| D07 calibration | Bronze s1 k applied / not | +2 / +3 | 3 / 2 | k = 0.9966 (speedo 0.34 % low). Calibration is worth 1 s here because the post-calibration leg is only 4.5 mi |
| D07 | Bronze s2 k applied / not | +5 / +7 | 2 / 1 | Error is mostly the calibration run's own drift (it is inside the scored leg), BUG-6 |
| D07 | Bronze s1, missed one lap, naive interval sum | +84 | 0 | My first run: k=1.195 from 4 intervals vs 6 Column C values. Column C cumulative fixes it. Real trap |
| D07 | Gold s1 cheat-card speeds / none; s2 speeds | +41 / +54 / +50 | 0 / 0 / 0 | Stock speedo 3.8-5.3 % low; 16 mi of calibration run at that error = 44-57 s inside the scored leg; unwinnable, BUG-6 |
| D08 recovery | Bronze s1 recover, no TA | +16, 0 | 1 | Truck (15 s) + 13 s red + 9 s stop loss = 38 s; recovery cut by the STOP and the CP. First attempt (+31) was BUG-1: I never saw "Red light"/"Green" |
| D08 | Bronze s1 / s3 with TA for the light | +9, 0 / +7, 0 | 2 / 2 | TA for the signal is legal here (`taForSignals`) and the objective never says so |
| D08 | Gold s2 with TA | +1 (TA 44), +2 | 3 | 58 s red: without TA this leg is lost |
| D08b time allowance | Bronze s1 TA | 0 (TA 70) ACE | 3 | Best drill of the set. Clear, measurable, correct feedback |
| D08b | Bronze s1 make it up instead | +56 | 0 | 70 s cannot be made up at +5 mph in 1.7 mi: the drill proves why TA exists |
| D08b | Gold s1 / s2 TA | +1 / 0 ACE | 3 / 3 | Qualifying seconds credited correctly even with a rookie driver |
| D10 course following | Bronze s1 / s2 (turn loss on the ledger) | +4 / +8, 0 off course | 3 / 3 | Without paying turn losses back: +15 / +35 -> 2 stars |
| D10 | Gold s1 / s4 | +8 / +10 | 3 / 3 | Same; decoys (driveway, side road, gravel, YIELD, side-STOP) all handled from `ahead` exits |
| D10 | Bronze s1, following the printed TEXT | missed CP (dead end) | 1 | Line 12 says "Bear Left at Y" but the route is BR. Rubric blames me, BUG-2 |
| D16 time of day | Bronze s1 / s2 | 0, +1 / 0, -1 | 3 / 3 | Leave at out-time minus 4.4 s; restart 09:05:05 handled by a scheduled go |
| D16 | Bronze s1 naive (leave ON the second) | +5, +5 | 1 | Feedback "lead each departure by the acceleration loss only" is exactly right |
| D16 | Gold s1 / s3 / s2 naive | 0,+2 / +1,+3 / +3,+1 | 3 / 2 / 2 | Fine. No bezel needed via protocol (tod is a number) |
| D18 combo | Bronze s1 / s2 | +24 / +3 | 0 / 2 | s1: 16 s red light + 6.5 s light stop loss + 4 s turn: no TA, no room to recover -> 0 stars with every skill executed |
| D18 | Bronze s1 with TA | +8 (TA 16) | 1 | Tip: "Review the attribution" (unhelpful) |
| D18 | Gold s1 / s2 | +24 / 0 ACE | 0 / 3 | Seed decides the star count more than skill |

Totals: ~70 drill runs, ~35 distinct conditions, 9 drills x 2+ tiers.

## 2. Answers per drill (a-e)

Legend: (a) objective clear from hello/book? (b) doable with observe() only at this tier?
(c) stars/feedback fair & correct? (d) learned / trap (e) length & density.

**D03 Pause arithmetic.** (a) Yes: title, objective and the hello INSTRUCTIONS all say
"wait less than the printed pause"; the book line "Left at STOP. Pause 30. Speed 40" has
everything the card needs (entry speed from the previous line, exit speed, turn). (b) Yes.
`driver.state = waiting:stop` + `carStopped` is the wheels-stop cue; the stopwatch
reading and `when.elapsed` give the dwell. At Gold the speedo shows 1-mph marks, fine.
(c) Stars fair at Bronze (3 with the card, 0 naive). Headline tip is WRONG on the good
run (BUG-3). The pace-bar aid at the stop line reads "-22.5 early" for a 30 s pause
(BUG-10): a Bronze learner staring at that number would wait LONGER. Gold's extra
difficulty is a rookie driver with +-12 % ramp scatter, which decided 2 vs 3 stars
across seeds with identical play; DRILL-010's "re-randomised hidden car" is not
implemented (same FORD_1939 at every tier). (d) Learned: dwell = pause - loss works to
the second; turning after the stop costs 1-2 s more than a straight exit (the card's
plain stop table does not show it, the turn-capped variant does). Trap I fell into: none
here; the naive baseline showed +15-20 s per stop. (e) 6 stops / 4 CPs in ~9 min: right.
Two CPs after one stop each would give faster feedback; the 30 s pause variant is good.

**D04 Timed speed changes.** (a) Mostly. "30 mph for 0:15 then 40" is clear; the compound
"Straight at STOP. Pause 15. 25 mph for 0:18 then 35" needs the rule that is only given
AFTER the run in the rubric ("the 18 s starts when the ghost leaves"). The hello text
should carry that rule. (b) Yes at all tiers; a landmark label ("bridge", "RR crossing")
is in `ahead` with a 50-ft distance, so `when.elapsed = d/v` gives the mark. Two
consecutive lines both say "At RR crossing" (seed 1) - legal, but a human needs a
"Comes quick" hint. (c) The stars did not separate ghost-anchored counting (3 stars)
from counting from my own GO (2 stars, tip "Clean run") because the compound pairs
(25->35, 30->40) make the error only ~1 s; SPECS DRILL-011 asks for change-point scoring
and the implementation scores the CP error instead. Short changes (15/18 s) are present
as specified. (d) Learned: ghost departs at (stop time - brake half-loss + pause), i.e. I
leave ~3.2 s before the ghost does, then call the change at T - lead counted from the
ghost. Trap: anchoring on my own GO. (e) 6 segments / 2 CPs in ~8 min: good; the
final CP falls inside the last timed segment in 4 of 8 seeds (BUG-7) so the second half
of that compound line is never scored.

**D05 Speed changes at landmarks.** (a) Yes. (b) Yes, but sign TEXT is only visible at
half the sight distance (250 ft) - at 50 mph that is 3.4 s before the sign and the lead
for 50->25 is 2.8 s, so the call window is 0.6 s. Realistic, but at Gold with a 1-mph
mark speedo and no pace bar there is no cue that the sign was passed (BUG-9). (c) Stars
fair at Bronze; wrong headline tip (BUG-3). At Gold the rookie driver's cruise noise
(3-5 s per 0.4-0.9 mi leg) swamps the 0.6 s per change the drill is about: 1-2 stars
for a perfect run. (d) Learned: lead is worth 0.6-1 s per change, 60 changes a day
= 40 s; miss the sign entirely and you lose 30 s. Trap: calling "at" the sign with
human reaction time = missed sign. (e) 8 changes / 2 CPs in ~9 min: good.

**D07 Calibration run.** (a) Yes, the objective is excellent and Column C is in the
book (`perfectInterval`, `perfectCumulative`) exactly as the research describes.
The "Begin calibration run" line does not quote the sign text (CALIBRATION START),
so matching by text fails (BUG-12). (b) Yes: lap at each MILE sign, read the laps,
compute k. `speedo.setFactor` works on the Timewise; on the Gold stock speedo it
returns a protocol error and you fall back to calling corrected indicated speeds -
correct behaviour, but the error text should tell the learner what to do instead.
(c) UNFAIR (BUG-6): the only checkpoint is after the whole 16-mile calibration run, so
the learner's score is dominated by drift accumulated while they were still measuring
k (3-8 s Bronze, 44-57 s Gold). A correct k at Gold earns 0 stars. The remaining leg
(4.5 mi, 6 min) is too short for k to matter (1 % = 3.6 s). The tip "k = sum(perfect)/
sum(actual)" is right but needs "use Column C cumulative, not your interval sum".
(d) Learned: one missed lap turned k into 1.195 and cost 84 s; cumulative Column C is
the safety net. Learned that 0.3-0.7 % Timewise error is barely visible on a 3-min
split (0.6-1.3 s) but a 4-5 % stock error is 7-10 s per split. Trap: a stale scheduled
"back to 50" call fired after the STOP and overrode my 35 (BUG-8). (e) 19 min of 50 mph
with a lap every 3 min is boring but that IS the morning run; the drill should end
with a 10-15 min leg where k matters, with the calibration section untimed.

**D08 Running early or late.** (a) Partly. The objective promises "+5 mph for
(speed/5+1) x seconds" but a 2500-4500 ft truck at 25 mph (25-46 s) plus a 35-65 s red
light plus 9 s of stop loss is 70-120 s on a 4.3-mile leg; at +5 mph you recover
5/45 of a second per second, i.e. you would need 10-18 minutes of open road. Not said:
the light qualifies for a TA under these rules. (b) Yes, once driver messages are
readable (BUG-1 made them invisible: my first run never saw "Red light"/"Green" and
scored +31). The slow truck is in `ahead` as `slow` with its speed; loss is measured
from the speedo and the watch. (c) Harsh: 1 star for a correct recovery plan truncated
by the STOP and the CP; 2 stars with TA for the light; 3 only with TA and a long red
(Gold s2 +1). The feedback lines are correct and useful. (d) Learned: finish the
correction before the next event or re-plan after it (my recovery ran into leg 2 and
made it -8 early); recovering at +5 is slow - at 40 mph it is 9 s of driving per second
owed. Trap: running the recovery across the checkpoint. (e) Right length; too much
loss injected for the recovery rule being taught. Inject 10-20 s, not 70.

**D08b Time Allowance.** (a) Yes - the clearest objective in the set, including
"never TA and make up the same seconds". (b) Yes: `gateDown`, `signalColor` in `ahead`;
wait timed from "Train!" to "Train cleared" (via events, BUG-1). (c) Fair and precise:
the headline prints declared vs qualifying vs credited vs leg error, which is exactly
the worked solution a learner needs. Over-declaring by >5 s is caught. (d) Learned: the
stop/start loss at a light (8.9 s at 35) is NOT credited; you must make that part up.
The no-TA run (+56) taught me why TA exists. Trap: none. (e) 9 min, 3 hazards, 1 CP:
right.

**D10 Course following with distractors.** (a) Yes. Hints "1st paved road" and "Cross
traffic stops, you do not" are in the book. (b) Yes: `ahead[].exits` carries angle,
surface and kind, so a driveway (kind) and gravel (surface) are distinguishable; the
side-STOP shows as `controlOnExit`. The skill that actually matters via the protocol
is WHEN to arm `call.turn`: the driver takes the first matching road exit, so arming
"Left" while a real side road L is still ahead of the STOP T is the off-course. (c)
Objective says "time is secondary" but 3 stars need mean error <= 10 s, and four 90-deg
turns cost 6.5 s each; I only reached 3 stars by putting turn losses on the ledger
(a P6 skill) - fine for Gold, odd for Bronze. The content BUG-2 (text "Bear Left",
route bears right in 5 of 8 seeds) sends a text-following learner into a dead end and
the rubric says "confirm the landmark". (d) Learned: arm the turn only when the target
intersection is the nearest real-road exit in that band. Trap: trusting the book text.
(e) 12-13 lines in ~9 min: good density. The trap variety is small (driveway, side
road, gravel, wye, YIELD-then-STOP, side-STOP); no T-vs-not-a-T, no quoted-sign
exactness, no dead-end "1st paved road" decoy.

**D16 Start on the second.** (a) Yes. Out-time 08:59:11 (minute rollover during
pre-read) and a lunch restart at 09:05:05 are in the book as numbers (`restartTime`);
the TEXT "RESTART. At Restart. Speed 35" does not print the time (BUG-11). (b) Yes -
`tod` is an exact number so the analog-clock/bezel skill (P9) is not exercised at all
via the protocol; `bezel.set` exists but nothing needs it. (c) Fair; "Lead each
departure by the acceleration loss only" is right and the naive run (+5, +5) shows the
cost. The minute-fail rule is good. (d) Learned: a departure is a 0->35 ramp, so leave
4.4 s early at the start AND at lunch. Trap: none via protocol; the hour-rollover case
promised by DRILL-013 does not exist in the scenario. (e) Short (two 0.8-mi legs), fine.

**D18 Miniature leg.** (a) Yes, but Bronze is already aids rung 1 (no pace bar) - a
step up from every feeder drill. (b) Yes. (c) Unfair by seed: s1 has a 16 s red light
whose only legal answer is a TA, and the rubric thresholds (2/5/10) with no TA mention
give 0 stars for an otherwise clean run; s2 is an ACE with the same play. The tip for
the TA run was "Review the attribution: fix the largest bucket first" (the TA bucket is
negative and wins the abs() sort). (d) Learned: a signal is where legs die; turn loss
must be on the ledger. Trap: none new. (e) 5-6 min, one of everything: right size for
a gate; but as the gate to D11 it should not hinge on the signal RNG.

## 3. BUGS (numbered; severity H/M/L)

**BUG-1 (H, protocol) Driver messages never reach `observation.driver.messages`.**
`Session.advance` calls `this.obs()` inside `fireScheduled` every tick and again in the
untilEvent check; `Simulator.observe()` drains `pendingMsgs`, so the reply's
observation (and any later `observe`) has `messages: []`. The only trace is the
`events` array as `"driver:<text>"` strings without tod/kind. "Left or right?",
"Going?", "Red light", "Train!", "Your watch!" are all invisible to an observe-driven
agent. Repro (D08 seed 1 tier 0):
```
{"type":"act","action":{"type":"skipPreread"}}
{"type":"act","action":{"type":"start"}}
{"type":"advance","seconds":3}      -> events ["depart","driver:Rolling on time"], observation.driver.messages []
{"type":"observe"}                  -> driver.messages []
```
Control: a bare `new Simulator(sc)` stepped 3 s returns `["Rolling on time"]` from
`observe()`. Fix: buffer messages per request in `Session` (snapshot before the first
internal obs() and merge), or make `obs()` non-draining and drain only on reply.
(Independently found as BUG 2 in PT-01; this pass shows its education cost: D08 +31 vs
+16 because the red light was never seen, and the D10 "Dead end!" question is silent.)

**BUG-2 (H, content) D10 book text contradicts the route at wyes.** The scenario
builder writes "Bear Left at Y" from `turn: 'BL'`, then the post-pass rewrites
`ins.turn` to match the route exit (BR) without regenerating `text`. Seeds 1, 2, 4, 6, 8
each have 1-4 such lines (`drillById('D10').scenario(1,0).book[11]` =
`{text:"Bear Left at Y. Speed 35", turn:"BR"}`). Following the text at line 12 (seed 1)
-> off course -> dead end -> missed CP (360) and the rubric says "Confirm the landmark".
D09 (quiz) reuses D10 scenarios so it inherits this. Fix: regenerate `text` after
fixing `turn` (or choose the wye direction before calling `instruction`).

**BUG-3 (M, rubric) `headlineTip` includes the unscored tail after the last
checkpoint.** `result().attribution` appends `currentAttribution()` for the segment
after the final CP (finish deceleration/observation stop). On ACE runs this bucket
(stop +3.6 on D03, cruise +2.7-3.6 on D05/D03/D07) is the largest and the tip says
"Your stops cost more than the printed pause" or "You ran slow on the cruise
segments: the speedometer reads high. Calibrate" - on a perfect Timewise. Repro:
oracle bot on `D03.scenario(1,0)` -> legs [0,-1,0,0], 3 stars, feedback[0] = the
speedometer tip. Fix: exclude attribution entries whose legIndex has no scored leg,
and ignore buckets < 2 s per leg.

**BUG-4 (M, attribution) Lunch-restart wait is attributed to `speedChange` (or
`cruise`) and the leg gets two attribution rows.** D16: `attribution` has two
`legIndex: 2` entries; the first carries the 220-235 s hold at the restart node as
`speedChange +223` (if the navigator called the restart speed while stopped; the
`beginRamp` sets `rampKind` because `curStop` is null at a non-STOP node) or
`cruise +226` (oracle). D16 hides it behind a custom rubric, but D12/D13 use
`basicRubric`, whose headline would always blame speed changes after lunch. Repro:
`runBot(new Simulator(D16.scenario(1,0)), new OracleBot(sim))` -> attribution
`[{leg:1},{leg:2,cruise:226},{leg:2,cruise:5},{leg:3}]`. Fix: a `restart`/`hold`
bucket (excluded from tips) and drop/merge the pre-restart row.

**BUG-5 (M, attribution) Turn re-acceleration beyond the 60-ft turn zone counts as
`cruise`.** `currentBucket()` is `turn` only while `car.s < turnZoneEndS`; the ramp
from 12 mph back to 35 after that is `cruise`, so turn-heavy legs show `cruise +5..13`
and the tip blames the speedometer (D18 Bronze s1 first run: "You ran slow on the
cruise segments: the speedometer reads high" with a perfect Timewise). The perf-table
`turnLoss` includes the whole re-accel, so the card and the attribution disagree.

**BUG-6 (H, drill design) D07's scored leg contains the calibration run.** The single
CP is after MILE 6 + STOP + speed-limit leg, so 16 miles driven BEFORE k is known are
scored. Bronze: 3-8 s of unavoidable drift vs thresholds 2/5/10; Gold (stock speedo
3.8-5.3 % low): 44-57 s -> 0 stars with a correct k. Oracle with recovery OFF (no k
applied): Bronze +5 (2 stars), Gold +58 (0 stars) - identical to a learner who
calibrated perfectly but could not recover. Fix: timing CP (or leg anchor reset /
`transit` section) right after MILE 6; make the post-calibration leg 10-15 min so a
1 % error is 6-9 s and k is the thing being scored. D17 inherits the layout.

**BUG-7 (L, content) D04 final checkpoint inside the last timed segment** (seeds 3, 4,
5, 8: `cp2` lies within the 40-mph x 45 s segment of line 7), so the "then" change is
never scored. `advanceMiles(0.5)` after the compound line is shorter than 2640 ft.

**BUG-8 (M, protocol) No way to cancel a scheduled action.** A `call.speed 50` scheduled
as the end of a recovery fired after the next STOP and overrode my exit speed of 35:
1.5 mi at 50 instead of 35 = -41 s (D07 trace, first run). Real navigators cancel a
countdown; the protocol needs `{"type":"cancel", id}` (return an id from scheduled
acks) or `when.unless: 'carStopped'`. (PT-01 §8 also lists the missing cancel.)

**BUG-9 (L/M, protocol realism) No "passed the landmark" cue at rung < 2.** Distances
are quantized to 50 ft and a feature vanishes from `ahead` the tick it is passed;
`node` events are filtered out below rung 2. An agent polling every 0.5 s can never
observe `d <= 25` and has no event to lap on. Seeing a sign go past the A-pillar is
not hidden information; emit `passed:<label>` (or keep `node` events for sign/
landmark kinds) at every rung.

**BUG-10 (M, aid) Pace bar reads minus-the-pause while stopped at a STOP.** With
`paceBar` on (Bronze/Silver), `aids.earlyLate` = -22.5 at wheels-stop for a 30 s pause
and counts up to 0 as you wait: `ghostTimeAt` picks the post-pause breakpoint at the
same s. Repro (D03 s1 t0): `skipPreread`, `start`, `advance untilEvent` until
`stoppedOn:"carStopped"` -> `aids.earlyLate: -22.5`; 5 s later -17.5. A learner reads
"22 s EARLY -> wait longer", the opposite of the lesson. Show the countdown to ghost
departure while `waiting:stop`, or hold the pre-pause value.

**BUG-11 (L, book text) Restart line omits the time:** "RESTART. At Restart. Speed 35"
- the out-time is only in the `restartTime` field. The UI must format it; the hello
text should too (and "At Restart" reads badly).

**BUG-12 (L, book text) Calibration start line does not quote its sign:** text "Begin
calibration run. Speed 50" while the sign reads "CALIBRATION START".

**BUG-13 (L, spec drift)** SPECS DRILL-005 says D06-D10 Bronze = rung 2, code gives
rung 3 (`tiers()` default) for D07/D08/D08b/D10. DRILL-002/DRILL-011 describe stop-error
and change-point-error rubrics; the code uses leg error for both. DRILL-010's
"re-randomised hidden car at Gold" is not implemented (same FORD_1939; Gold = rookie
driver + traffic). DRILL-013's hour-rollover departure does not exist in D16.

**BUG-14 (L, content) D09 and D14 are stubs** that return the D10 / D03 scenarios with
`basicRubric`; a UI that lists them will run a driving leg for a "quiz"/"math" card.

Also noted (not bugs): `hello.book[].nodeId` and `ahead[].nodeId` let an agent match
lines to features by id (I avoided it; a UI will not show ids, but bots will over-fit
to it). `rally-session.sh` works; it needs ~3-4 s after `start` before the first
`send` returns, and `send` has no timeout.

## 4. EDUCATION findings mapped to P1-P13

| Skill | Taught by | Verdict | Evidence |
|---|---|---|---|
| P1 stopwatch handling | D01 (not in this pass); implicit everywhere | Weak via protocol | `watch.lap` is exact; no reaction/jitter component unless D01's node events are exposed (BUG-9 hides them at rung < 2) |
| P2 pause/stop with loss model | D03 | WELL (Bronze) | card run 3 stars/2 aces vs naive 0 stars; mixed entry/exit speeds and turns present. Spoiled by BUG-3/10; Gold tests the driver, not the navigator |
| P3 timed speed changes | D04 | OK, under-measured | compound-line rule only appears in post-run feedback; go-count trap costs ~1 s so rubric cannot teach it (DRILL-011 change-point scoring missing) |
| P4 speed changes at landmarks | D05 | OK at Bronze | lead worth 0.6-1 s/change; Gold rubric sees driver noise, not the lead |
| P5 calibration run | D07 | Content WELL, scoring BROKEN | Column C present; k arithmetic correct; cumulative-vs-interval lesson emerges; but stars measure the calibration drift (BUG-6) and the application window is too short; stock-speedo cheat card untestable |
| P6 ledger + recovery, TA | D08, D08b, D18 | TA WELL, recovery weakly | D08b is the best drill; D08 injects 70-120 s (unrecoverable at +5) without naming TA; "finish before CPs" lesson emerges naturally |
| P7 reading under load | D10, D15 (not tested), D18 | Partly | pre-read via `line.annotate` not exercised; nothing forces reading ahead except the arming-the-turn problem |
| P8 traps / course following | D10 | Partly, undermined | exits/surfaces/kinds visible and correct; arming timing is the real skill; book text bug (BUG-2); trap library small; no off-course detection or recovery arithmetic taught (just penalised) |
| P9 time-of-day discipline | D16 | OK (numbers), not the dial | tod is an exact number; bezel never needed; no hour rollover; good "leave by the accel loss" lesson |
| P10 driver protocol | none (D20 backlog) | Not taught | read-backs exist in events only (BUG-1) |
| P11 endurance / full day | D11-D13 need the generator | Not available | fallbacks are D18/D07 |
| P12 performance table | D06 (counts notes only), D03 | Weak | no comparison of the learner's numbers to truth; Gold does not re-randomise the car |
| P13 SCCA/odometer TSD | D14 stub | Not at all | |

## 5. RUBRIC fairness issues

1. Headline tip from the unscored tail (BUG-3): wrong lesson on the best runs (D03, D05,
   D07, D04 all told me to recalibrate a perfect speedometer or shorten perfect stops).
2. Gold = rookie driver: at D03/D04/D05 the +-12 % ramp scatter and 1-mph bias process
   add 2-5 s per leg; fixed thresholds [1,2.5,5] cannot be met by any navigator action.
   Scale thresholds by driver skill, or score the navigator's own callout error
   (DRILL-002/011 as written) rather than the CP error.
3. D07 scores the calibration drift (BUG-6): 0 stars at Gold for a correct k.
4. D08/D18: a signal red of 30-65 s decides the stars; neither objective mentions the
   legal TA; D18's 3-star threshold (2 s) vs a 16 s light is seed luck.
5. D10 "time is secondary" yet 3 stars require <= 10 s mean error with 4-6 turns at
   6.5 s each; only reachable by paying turn losses back (P6, not the drill's skill).
6. D18 TA run: tip "Review the attribution" because the negative `ta` bucket wins the
   abs() sort; TA should be excluded from the tip ranking.
7. D06 rubric counts `note` actions (3 notes = 3 stars) - no learning signal.
8. basicRubric gives 1 star cap for any off-course even when the book text was wrong
   (BUG-2); the learner is blamed for the author's error.

## 6. Eight improvements ranked by learning impact

1. **Make D07 score what it teaches**: untimed (transit) calibration section with a leg
   anchor reset after MILE 6, then a 10-15 min leg with a STOP, a timed change and two
   CPs where k is applied; debrief shows "if your k were exact: -1 s" vs "with no k:
   +37 s" (DESIGN §16 counterfactuals). At Gold, print the cheat-card the learner
   should have built (indicated per assigned speed) next to theirs.
2. **Fix the feedback channel and the tips**: deliver driver messages (BUG-1), exclude
   the post-CP tail and the TA bucket from `headlineTip` (BUG-3/5.6), add a
   restart/hold bucket (BUG-4), and show the countdown to ghost departure instead of
   "-22 early" at a stop (BUG-10). Wrong lessons are worse than no lessons.
3. **Score the navigator, not the driver, at Gold**: rubrics for D03/D04/D05 should use
   the callout-vs-ghost instant (dwell error per stop, change-point error per segment,
   lead error per sign) that the engine already logs (`stops[].dwell`, `timedChange`,
   `rampKind`), with CP error as a secondary line. Then the rookie driver becomes a
   lesson ("your stops were right, Dad's ramps cost 3 s") instead of a star cap.
4. **Teach TA where it is needed**: D08's objective and hello text should state that
   lights/trains qualify under these rules and that stop/start loss does not; inject
   10-20 s losses in D08 (recoverable at +5) and leave the 70 s train to D08b. Make
   D18's hazard either a short (<= 15 s) light or a slow vehicle so the gate is about
   execution, not RNG.
5. **Fix the book**: regenerate text after the wye fix (BUG-2), quote the calibration
   sign, print restart times, add "Comes quick" when two landmarks share a label or a
   timed segment ends within 300 ft of the next line. Add a pre-run "worked card" at
   Bronze: for each STOP line the dwell, for each timed line the call time, so the
   learner sees the arithmetic before doing it (U4/U5).
6. **Protocol cues for the eyes**: emit `passed:<label>` at every rung (BUG-9), include
   tod/kind for driver messages in `events`, and add `cancel` for scheduled actions
   (BUG-8). Without these, Gold through the protocol is harder than Gold in a car.
7. **Widen the trap library in D10** (T vs not-a-T with a driveway opposite, quoted-sign
   exactness "SPEED LIMIT 35" vs "35 MPH", 1st paved road with a dead-end paved
   driveway, STOP vs YIELD at the same shape) and teach off-course recovery: when the
   driver says "Dead end", the drill should coach `call.uturn` + ledger arithmetic
   instead of running out the 30-min clock.
8. **Implement D06/D12's real P12 loop**: D06 should compare the learner's noted
   stop/start and ramp numbers to `buildPerfTable`, and D03 Gold should use a different
   hidden car (DRILL-010) so the learner must read the table, not memorise 7.6 s.

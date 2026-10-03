# VALIDATION - Realism: does the Rally Trainer prepare a navigator for the actual Great Race?

Validator: realism agent, 2026-10-03. No web access. `src/` and `tests/` untouched. Scripts added under
`playtest-scripts/`: `pt04-ladder.ts` (bot ladder with the 4 h cap lifted + a TA-declaring oracle), `pt04-human.ts`
(reaction-noise navigator, with and without a truth ledger), `pt04-calib.ts` (calibrating oracle on the stock speedo).
Ground truth: docs/research/01, 03, 04, 06, 07, REQUIREMENTS §1/§3, OPEN-QUESTIONS (R0x = research doc 0x).
Method: read every engine file named in the brief, generated 3 full stages (seeds 1-3, 8 for statistics) with
`generateStage(seed, PROFILES.fullStage)` and read them as a navigator, ran 20 drills' scenarios, ran the bot ladder,
checked every lesson / reference sentence, and read the instrument renderers against R05 §5 and R03 §2.2.

Prior art: `docs/spec/reviews/review-realism.md` (design-time review). Where a defect it raised is still open in the built
product I say so ("still open from review D#").

---

## 0. Bottom line

The engine core is genuinely faithful: the ghost car, leg reset, 1 pt/s, Ace, age factor, dwell = pause - loss, ramp
centering, timed-segment anchoring and the 1939 Ford's stop/start losses all reproduce R07 and R01 to within the
precision of the sources (an oracle with TA scores 1-2 s per whole day; the Ford's 0-35 mph is 10.0 s, stop loss at 35 is
7.6 s versus R07's 7.7 s). What is not faithful is **what the player is allowed to see and what the course throws at him**:
calibration is scored and too short, calling a turn 150 ft out is rewarded by a physics teleport, digital readouts and a
free exact performance card replace dial-reading and table-building, hazards are 5-10x too frequent, the stage is about
half a real day, and the score ladder jumps from "champion" to "10x worse than a real rookie" with nothing in between.

**Rubric total: 47 / 70 (67 %). Verdict: YES WITH FIXES.** Josh will learn the core arithmetic correctly from this trainer;
he will also pick up four or five habits that cost seconds or turns in June unless the top-10 fixes below are applied.

---

## 1. Rubric (0-5, evidence)

| # | Dimension | Score | One-line evidence |
|---|-----------|:----:|--------------------|
| 1 | Instruction format / vocabulary | 3 | GRIID 5-column layout, real Col-D hint strings, "35 P15" / "30 for 0:36 then 40" in Col C; but SCCA trap-rally vocabulary over-weighted, Pause printed twice, no warm-up/transit/refuel sections, sign/landmark CAMEO is a bare arrow |
| 2 | Ghost-car timing | 5 | `ghost.ts` is R07 §9.2 line for line; oracle+TA hits 0-2 s/day; timed segments create the virtual landmark at `s + v1*T` after the pause |
| 3 | Stop / pause arithmetic | 4 | Ford stop loss 5.2 (25) / 7.6 (35) / 11.7 (50) vs R07 table 5.5 / 7.7 at 25 / 35; accel loss 0->40 = 5.2 s vs Rowland's 4.5; but every generated Pause is 15, none at turns, cockpit hands out the exact card |
| 4 | Timed segments | 4 | Anchor = ghost departure (after pause), call at T - ramp/2 (R07 §2.3) verified; 8-18 per stage, 20-90 s; no lesson teaches them; segment never ends at a landmark/turn (GHOST-010) |
| 5 | Calibration run | 3 | Math and `shiftCard` design correct; run is **on the clock** (leg 1 includes it), only 6-7 intervals (R03: "a dozen or more"), fake "MILE n" signs 2.5 mi apart, only cumulative printed, Rookie tier uses a perfect Timewise |
| 6 | Checkpoints & scoring | 4 | Leg reset anchored on rounded actual crossing, 1 pt/s, Ace, age 0.845, >30 min = missed, sight zone, observation stop, CP placed 500-1500 ft after STOPs; invented 30/60/300 s penalties; benchmark label on raw not factored; leg lengths 2-100 min |
| 7 | Hazards & time allowances | 3 | Signals, trains, slow traffic and TA = min(declared, measured) match R04 §2.3; trains 5.9/stage (3.8 blocking, 60-120 s) vs one documented 48 s anecdote; no cross-traffic wait in the full stage; TA at 1 s precision |
| 8 | Driver behaviour / callouts | 3 | "Stopped", "At NN", read-backs, "Left or right?" are good; driver never errs, no grade, late turn call is forgiven by a speed teleport, "call 150 ft out" is taught |
| 9 | 1939 Ford physics & stock speedo | 4 | Accel/brake/turn caps consistent with R07 and Q12/Q22; stock speedo has gain+offset+quad+1 s lag+bounce; no grade/shift dips; 6.5 % error at 50 may be too large; default full stage uses a perfect Timewise |
| 10 | Traps & CAMEO visuals | 3 | CAMEO grammar (dot/arrow/bold/thin/dashed) exactly R01/R04; 24 sourced cards; but R04 §0 says GR is tour-style not trap-style, and two cards invent Col-D spoilers |
| 11 | Stage structure | 3 | Start -> calibration -> 4-7 legs -> lunch restart (+45 min) -> observation CP is right; length 115-150 mi / 4-5 h vs ~255 mi/day; 30 s pre-read vs 30 min; no Trophy Run/campaign (D13 is a stub) |
| 12 | Score realism (bot ladder) | 2 | Oracle+TA 1-2 s/day, no-TA oracle 55-99, "rookie" bot 670-890; nothing between champion and 10x-too-bad; default CLI truncates stages at 4 h; star thresholds ignore the benchmarks |
| 13 | Lesson / reference accuracy | 3 | Formulas right; 8 factual slips listed in §2 (ghost "late at every speed change", 150 ft, SPEED-quote rule, "46 s is a blown day", 6.4 vs 7.3, rounded factors, invented penalties stated as fact) |
| 14 | Instrument realism | 3 | Heuer-style 1/5 s sweep + countdown bezel and rotating-bezel rally clock are right; digital readouts on every "analog" instrument, 0-100 mph dial on 240 deg, 30-min register vs R05's 60, stepped needle |
| | **Total** | **47 / 70** | |

---

## 2. Factual errors and unrealistic behaviours, ranked by how much they would mislead Josh

Severity: **S** = will cost turns/minutes or build a habit that fails in the car; **H** = will cost tens of seconds or mis-calibrate expectations;
**M** = distorts practice; **L** = cosmetic.

### 2.1 Severe

**S1. Late turn callouts are physically impossible but forgiven; the trainer teaches "call 150 ft before the decision point".**
`src/core/sim.ts:655` (`if (this.car.v > this.turnCap * 1.3) this.car.v = this.turnCap * 1.3`) snaps the car's speed when a
call arrives too late. Repro (`scratchpad/late.ts`, 45 mph, 90-degree right, Dad sportsman): call at 600 ft -> arrives at
12.1 mph with 8 ft/s^2 braking; call at 150 ft -> arrives at 15.6 mph after a **221 ft/s^2 (6.9 g)** deceleration; call at
60 ft -> **357 ft/s^2 (11 g)**. Nothing is lost, no turn is missed. Braking 45 -> 12 mph at the Ford's 8 ft/s^2 needs ~250 ft,
so a 150 ft call is a missed turn or a panic stop in a real car at 2.3 s of warning. Yet the road view draws a "call turns before
here" line at 150 ft (`src/ui/render/road.ts:24-26`), the debrief says "call 150 ft before the decision point"
(`src/ui/viewmodels/debrief.ts:281, 362`) and lesson 6 repeats "150 ft" (`content/lessons.ts:53`). Contradicts R06 §2/R01 §5 ("the
driver should know what sign, road or intersection comes next before the navigator looks down") and R04 §2.3 (wrong turn is the
dominant loss: 1:05 to ~10 min). *Habit built: leave the call to the last second.* Fix: no speed snap; a late call produces
"can't make it" (driver goes straight / stops and asks) and an off-course event; change all three texts to "call it a quarter mile
(about 15-20 s) out, once the driver has the landmark".

**S2. Calibration run is on the clock, short, and the first leg is therefore unwinnable with the stock speedometer.**
`src/core/generator/generate.ts:140-196`: leg 1 starts at the START line and the run (16-17 mi, ~20 min at 50) lies inside it; CP1 sits
~2 min after "END CALIBRATION" (seed 1: calibration ends 08:20:24, CP1 08:22:25). Run with the stock unit and a *perfect* calibration
(constant-k card built from the 50 mph run, `pt04-calib.ts`): leg 1 error 75, 0, 75, 50 s on seeds 1-4 while every later leg is 0-6 s
(raw day 4 - 86). A player cannot do better than ~20 s on leg 1 even if he computes k after the second interval (the first interval
alone is 133-228 s at a 6.5 % speedometer error). Contradicts R03 §2.1 (Hagerty: tire warm-up and calibration "then they go 'on the
clock'") and Q14's own flag. Also contradicts R03 §2.1 / REVIEW D12 ("a dozen or more interval readings"): only 6-7 intervals
(`generate.ts:183`, `k < 6`), "MILE 1 ... MILE 7" signs are 1.5-3.5 mi apart (`generate.ts:184, 188`; MILE 1 at 2.14 mi, MILE 2 at 4.65 mi,
MILE 4 at 9.14 mi in seed 1) - a navigator who has ever seen a mile marker sees through it. The UI prints only the *cumulative*
perfect time (`src/ui/screens/cockpit.ts:163`, "Col C perfect: M:SS"), never the interval (R01 §2.2 and R03 §0: Column C holds both).
And the **Rookie tier of the full stage uses `PERFECT_TIMEWISE`** (`src/core/drills/index.ts:239`, `speedo: t >= 1 ? STOCK_1939_SPEEDO : sc.speedo`),
so calibration is vacuous there (k = 1.000) even though Josh's car has the stock unit. Fix: start leg 1 at END CALIBRATION (or make the
run an unscored `transit`); 12+ intervals with a realistic spacing and the real number on the marker; print interval and cumulative;
use a hidden-gain speedo in every tier.

**S3. The rung ladder withholds, then hands out, the one number a real navigator may or may not have, and the score cliff between them is 50x.**
Q1 is open: R03 §0/§3.5/§4.1 describe comparing the clock to Column C *cumulative* times at each landmark all day; R01 §2.2 ties the
interval times to the calibration instructions only. The built default is "calibration only" (`src/core/course.ts:160-170`
`LEGAL_AIDS.cumulativeTimes=false`, `aidsForRung` rung 3 only). Consequence measured with a noisy navigator
(`pt04-human.ts`, Dad sportsman, 0.3 +/- 0.2 s reaction, TA declared): **with** the truth pace bar 3.0 raw s/day (champion level, 6 seeds);
**without** it 166 raw s/day (133-193) - about 24 s per leg against a real rookie's 20-46 s per *day* (R06 §4). Either the real book prints
perfect times all day (then rung 0 is much harder than reality and drills a skill - blind event-arithmetic - nobody needs), or it does not
(then rung 3's pace bar trains a dependency that vanishes). The sim gives Josh no way to rehearse the middle state. Fix: confirm Q1 from
the 2026 Rookie Handbook/Great_Race_101.pdf, expose "Column C cumulative on every line" as an independent toggle at rungs 0-2, and
measure the remaining gap (turn losses, YIELD/BLINKER distractors, which the ghost does not pay; see H4).

### 2.2 High

**H1. Digital readouts defeat the analog skills the research says matter.** The "analog" stopwatch shows `0:23.4` plus `bezel 8.4 s (3.2 to go)` and a
lap table (`cockpit.ts:196`); the time-of-day clock - which R01 §1.3 says must have **no digital readout** - shows HH:MM:SS under the dial and in the HUD chip
(`cockpit.ts:200, 207`); the speedometer shows "35 mph" (`cockpit.ts:203`); the road view prints "~450 ft" next to every feature and a feet scale
(`road.ts:67, 23` loop) at every rung, i.e. the odometer-class distance information R01 §1.1 says is covered/unreadable. P1 ("reading an analog dial
to 1/5 s") and the whole "no distance information" premise (R01 §8) are therefore not exercised; Great-Race-legal mode (rung 0) does not hide any of it.

**H2. The cockpit gives the exact performance card for free, in legal mode.** `cockpit.ts:229/241` (`perfCardHtml`) prints "Stop 35 in / 30 out: loss 7.6 s -> dwell 7.4 s",
the ramp lead and the timed-change call time for the next line from the hidden car model, unconditionally. R01 §2.4/R03 §2.3: teams spend "hours, sometimes days" building
a noisy, car-specific table (4+ runs per speed, Rowland Rule 14 "sanity check your charts"). D06 only counts `note` actions
(`drills/index.ts` D06 rubric). *Habit built: look up a perfect number; never measure, never distrust a chart.* The lesson's own check uses 6.4 s for 40->30 while the model
(and the Reference table) says 7.3 s (`content/lessons.ts:21`), so the in-trainer numbers disagree with themselves.

**H3. Hazard frequency is 5-10x reality.** Per stage (8 seeds): 5.9 RR crossings with trains, **3.8 of them blocking the ghost's arrival** for 60-120 s
(`generate.ts:365, 392`, `chance(0.5)`, `int(60,120)`), 6.3 signals of which 3.3 are red. Real record: one documented 48 s train leg (R06 §2); lights are "the single biggest luck
factor" but TA covers them (R04 §2.3). A stage with ~6 minutes of forced train delay teaches the TA drill well but makes TA the main event of the day. Meanwhile the full stage
has `trafficWaitProbability = 0` (`generate.ts:131` default 0, not set in `PROFILES.fullStage`), so **no STOP ever has cross-traffic delay** although Doug Sharp names traffic
as the hardest part (R03 §1.1) and R04 §2.3 says waiting beyond the pause must be made up. Still open from review D13.

**H4. Turn losses are never paid by the rallymaster.** R07 §1.4 [GIVEN]: a Pause attaches to "a stop sign, signal, railroad crossing **or sharp turn**". The generator prints a Pause only on STOPs
(`generate.ts:377`; all pauses are 15) and on one trap card; a 90-degree non-STOP turn costs 6.5 s at 35 mph and 9.3 s at 45 (model: `turnLoss`, `COST.turn = 7`, `generate.ts:65`) against a ghost
that pays 0 and a cockpit card that does not list it (`perfCardHtml` has no turn branch). Ladder evidence: the legal-rung navigator without a ledger lands 20-50 s per leg late
mostly from `turn +13 .. +39 s` per leg (attribution). Either the real book prices turns (then the sim is too punishing and untrains ledger arithmetic) or it does not (then the card must
show turn losses). Needs the same Rookie-Handbook confirmation as Q1.

**H5. Pre-read is 30 seconds, not 30 minutes.** `src/core/builder.ts:106` (`prereadSeconds: o.prereadSeconds ?? 30`) is inherited by every generated stage, D11 and D12/D13
(measured: stage preread 30). R01 §2.1: instructions "exactly 30 minutes before"; R06 §1: ~5 s per instruction when read once. A 222-line book cannot be triaged in 30 s, so P7/D15 triage is not
practised in the mode that matters (D15 alone uses 600 s).

**H6. Benchmarks are mislabelled and the full-stage star thresholds ignore them.** `src/ui/screens/reference.ts:78` says "46 s is a blown day"; R06 §2/§4 says 20-46 s/day are *normal* rookie scores
(Team Hagerty 34 / 46 / 20 s) and 13 s is the best rookie. `benchmarkLabel(raw)` (`src/core/scoring.ts:34`) labels the *unfactored* sum although the published figures are age-factored (x0.845 for the
Ford). D12 grades stars by **mean absolute error per leg** against [3, 13, 25] x driver scale (1.5 for sportsman, 2.2 for rookie) (`drills/index.ts:239`, `rubrics.ts basicRubric`):
3 stars at <= 4.5 s per leg = ~30 s/day, i.e. an ordinary rookie day; 2 stars at 19.5 s per leg = 136 s/day. The star scale is 4-10x looser than the cited benchmark.

### 2.3 Medium

**M1. Standing-start advice invents a procedure.** `cockpit.ts:250` ("Standing start to NN: leave ~X s early") and `OracleBot` both depart before the start time
(`sim.ts depart()` rewards it as "early"). R01 §4/§5: "Start on Time ... official starting time = stage start + position in minutes"; nothing in the sources lets a team leave a flagged
start early. Q14/Q17 flag it as an assumption but the product states it as technique. If the real start is a flag at the minute, the 4-7 s acceleration loss must instead be recovered in the first cruise.

**M2. Assigned speeds are independent of posted signs.** `generate.ts:104-107` picks the sign text and the assigned speed independently: of 61 "SPEED LIMIT NN" lines over 8 stages, 23 (38 %) assign a speed
**above** the posted number; "REDUCED SPEED AHEAD" gets >= 40 mph on 15 of 29; "SCHOOL" gets >= 35 on 17 of 24 (see seed 1 lines 30, 157). R01 §5 (first S: "obey traffic laws").
*Habit built: sign text is decoration; ignore the posted limit when told to go faster.* Also teaches an inconsistency Dad would refuse at the wheel.

**M3. Course vocabulary is trap-rally, not Great Race.** R04 §0: "The Great Race is a tour-style TSD, not a trap rally ... Race Route will never enter a private road, driveway ... without an instruction"; traps are
"mostly unintentional". The generator draws 30 % of lines from a 24-card SCCA-trap library including "Follow pavement (Main Road Rule)" (`traps.ts:169`, a GI-priority device that appears nowhere in R01),
`Right at "SMITH RD"` vs "SMITH ROAD" (R04 §1.7 is SCCA/PCA/Rally WNY), ONTO (`traps.ts:240`), AT/AFTER. Two cards carry **invented Col-D spoilers** ("ONTO: follow the name", D10's "Cross traffic stops, you do not");
real Col-D strings are "Comes quick", "Look sharp", "1st paved road", "Follow this Curve Warning Sign" (R04 §2.2). The lesson's quote-exactness rule is also overstated (L3).

**M4. The written instruction prints the Pause and Speed again, so the "forgotten pause" trap has no teeth.** `describeInstruction` / `generate.ts:377` produce "Right at STOP. Pause 15. Speed 30" in the
text column *and* "30 P15" in Column C. R04 §1.12 describes the Great Race hazard as a pause "buried in a separate column that the navigator reads past". Q26 is open; the duplicated print makes the real error mode unreachable.

**M5. The full stage is about half a real day.** Seeds 1-8: 115-151 miles, 238-302 min of driving (R01 §6: 2,300-2,600 mi / 9 stages = 255-290 mi/day; R04 §2.1: "about once an hour" a checkpoint). Legs average 35 min with a long tail on both sides
(2, 4, 7, 9 min and 70, 100 min legs; `PROFILES.fullStage` stats). Lines per mile 1.5 (real ~1). 25-35 % of lines are STOP + Pause 15 (53-82 pauses per stage). Missing Column-B sections: tire warm-up, transit, free zone, refuel/pit
(`generate.ts:140-205` emits only start, calibration, restart, finish; `Section` type has them). No 12-checkpoint day profile (R06 §1) although `cpCount` exists. Still open from review D16/§3.1.

**M6. The driver never makes execution errors and the road is flat.** No `misread`, grade or shift-dip code exists (grep of `src/core`). Speed-hold error is a Gaussian random walk (`sim.ts driverStep`) independent of terrain; Dad only says "Going?" after 25 s at an empty STOP and leaves at 50 s (`course.ts:175` `patienceSeconds: 25`, `sim.ts:485`).
Still open from review D15/§2.3. Honest effect: truth-ledger rookie-Dad scores 4.7 raw/day (`pt04-human.ts`) - the driver's skill is invisible because the pace bar hides it.

**M7. `D13 "Campaign: the Great Race"` is a relabelled single stage** (`drills/index.ts:243-245`: `scenario(seed,t){ return D12.scenario(seed*100+1, t); }`) though its objective promises Trophy Run + nine stages, age factor and a division ladder.
No campaign state, no Trophy Run, no cumulative score exists (grep `campaign|trophy` in `src`: only the unused `trophyRunCounts` rule). Josh could believe nine-stage endurance has been rehearsed.

**M8. Stock speedometer defaults.** `STOCK_1939_SPEEDO` (`builder.ts:12`: gain 1.03, +1 mph, +0.0003 v^2) reads 53.3 at true 50 (6.5 % high) and 32.2 at true 30 (7.3 %). R07 §3.3 only says error "grows with speed", ~1 % drift with tires. A 6.5 % error costs ~58 s per 15-minute leg
uncalibrated; real stock units are usually within a few percent. The *shape* is good (relative error is larger at low speed, which makes a 50-mph-only constant-k card wrong at 30-35: residual ~0.8 %); the *magnitude* is a guess (Q21). The lesson/Reference show only the constant-k card ("write 20 ... 50 on a cheat card",
`lessons.ts:37`), which R07 §3.3 says is wrong for a mechanical unit (still open from review D4; `perSpeedCard`/`shiftCard` exist in `calibration.ts` but no screen teaches them).

**M9. Instrument details differ from the cited hardware.** (a) The cockpit passes `registerMinutes: 30` (`cockpit.ts:194`) while R05 §5.1 gives the Monte Carlo's central hand as a 0-60 minute register; (b) the speedometer dial is 0-100 mph over 240 degrees (`viewmodels/speedo.ts`) so 1 mph = 2.4 degrees; R03 §2.2 describes the Timewise as using the full 360 degrees with 0.25" per mph; (c) the needle is drawn at the **quantized**
reading (`speedoViewModel(o.speedo.reading, 100)`), so on the stock unit it jumps in 5 mph steps instead of sweeping; (d) the clock numbers every hour, not every second (R01 §1.3 "every second numbered").

**M10. Ladder harness truncates stages.** `src/agent/bots.ts:199` `runBot(..., maxSeconds = 4 * 3600)`; 3 of 8 generated stages need > 4 h, so `npm run sim -- --scenario gen:fullStage --seed 1 --bot oracle`
reports raw 714 with two "missed" checkpoints and the observation CP "missed" (the run was cut at 12:00, CP6 is at 12:26). The three oracle results quoted in earlier status files (714 / 431 / 99) are artefacts.

### 2.4 Low

- **L1** `reference.ts:29` prints the "+10 mph" column with `toFixed(0)`: 3.5 -> "4", 4.5 -> "5", 5.5 -> "6" for 25 / 35 / 45 mph (R07 §6 table says 3.5 / 4.5 / 5.5). ~10 % over-recovery if used as printed.
- **L2** `lessons.ts:9`: "your real car cannot change speed instantly, so you are late at every stop and every speed change" - a slowing car is **early** (R07 §2.2: 40->30 puts you ahead 0.67 s); only the stop/start and speed-up lose time. Half-ramp centering is symmetric.
- **L3** `lessons.ts:28`: "'SPEED LIMIT 45' is not 'SPEED 45'" - the cited GIs (R04 §1.7, SCCA/PCA/WNY) allow quoting a sign "in full or in part" with whole words; only partial words/numbers are excluded. Great Race quote rules were not retrieved. Also "a Y is a fork of roughly equal roads" is not in R04 (Y = both branches turn < 90 degrees, approached from the tail).
- **L4** `lessons.ts:37`: calibration "costs nothing but attention during the first ten minutes" - the run is >= 15 miles / ~18-20 min (R01 §4, R03 §2.1).
- **L5** `reference.ts:58-64` states 30 s sight-zone, 60 s observation-miss, 60 s early-restart, 5 s over-declaration tolerance and a 300 s cap as facts; R01 §3.1 says these values were not retrieved (V.E.2, V.E.3.a) and R01 §2.1 only says failure to stop "may result in a penalty or disqualification". Only the footnote at the end of the Rules panel hedges.
- **L6** `reference.ts:23` leads with a seconds-per-mile table; R03 §0 and R01 §8: distance is hidden, "speed -> seconds-per-mile is not even useful"; that is SCCA odometer math (REQUIREMENTS P13 secondary).
- **L7** Sign/landmark book rows show a bare straight arrow (`cockpit.ts:161`, `node.sign` branch calls `cameoSvg([{angle:0...}], node.control='none')`); R01/R04: CAMEO draws "signs, landmarks, and road and intersection configurations". No sign or landmark picture.
- **L8** CAMEO of a side-road STOP shows the road name text only (`controlOnExit` as a 9 px label); the "back of the octagon" is not drawn (review §2.2 open).
- **L9** Speed multiples of 5 only, 25-50 (`generate.ts:53-55`); R03 §0 quotes "accelerates instantaneously from zero to 22 mph" and Q20 is open. No 20 mph town speeds (review D16).
- **L10** `reference.ts:56-57` "Speed change at a landmark applies from the leading edge of the landmark"; Q3's own default is near edge of a sign, leading edge of an intersection (R04 §1.11).
- **L11** TA is credited to the second for any declaration made any time before the leg's CP (`sim.ts act 'ta.declare'`, `taGranularitySeconds: 1`); review D10 recommended 60 s. Real mechanism unverified (R04 §2.3: phone, "request").
- **L12** Debrief/lesson protocol (Dad says "Stopped"/"At NN" and checks off each line) is presented as the standard; R03 §6 says the only documented protocol is Team 39's driver-called "Mark!" and read-back protocols are unverified (Q23).

---

## 3. Bot ladder versus benchmarks (3 seeds; lifted 9 h cap; full-stage profile; Dad expert driver, perfect Timewise unless noted)

Benchmarks (R06 §4 / R01 §3.4): champions ~1 s per leg (2025 winner 49.72 s over 9 days = 5.5 s/day age-factored); best rookie day 13 s; typical rookie 20-46 s/day; one blown leg 48 s (untimed train); rookie wrong turn 1:05.

| Navigator (script) | Seed 1 | Seed 2 | Seed 3 | raw s/day (x0.845) | Reading |
|---|---:|---:|---:|---|---|
| oracle + TA (`pt04-ladder`) | 1 | 2 | 2 | 1-2 (0.8-1.7) | champion; aces 4-6 / 6-7 legs - plausibly *better* than the 5.5 s/day real champion |
| oracle, no TA (shipped `oracle`) | 55 | 71 | 99 | 55-99 (46-84) | one or two blocking trains = 32-97 s on one leg: the Roberts 48 s story, but every day |
| lateCall 1.5 s | 57 | 82 | 112 | 57-112 | 1.5 s latency is invisible next to the train; shows the recovery loop absorbs latency |
| noPause (go at wheels-stop) | 419 | 246 | 197 | 197-419 | R07 §9.6 "ignoring stop loss 6-9 s/stop" x 53-82 stops; mixed-sign leg errors of 4-113 s |
| rookie (`ignoreLosses`) | 893 | 672 | 678 | 672-893 | ~11 s per stop; 20-30x a real rookie day |
| noRecovery oracle (arithmetic only, no truth pace) | 364 | 201 | 244 | 201-364 | the realistic "paper navigator" with perfect table: still 28-52 s/leg |
| human-ish: truth ledger, 0.3 +/- 0.2 s reaction, Dad sportsman | 3 | 2 | 4 | mean 3.0 (6 seeds) | champion with a pace bar |
| human-ish: truth ledger, 0.5 +/- 0.4 s, Dad rookie | 2 | 3 | 5 | mean 4.7 | champion with a pace bar |
| human-ish: **no ledger**, 0.3 +/- 0.2 s, Dad sportsman, TA | 176 | 193 | 157 | mean 166.5 (112-163 x0.845) | 5-7x worse than a mid rookie |
| stock speedo, uncalibrated, oracle+TA, Dad sportsman | 622 | 570 | 495 | 495-622 | ~70 s per leg: calibration dominates, as R07 §3.4 says |
| stock speedo, calibrated from the run (`pt04-calib`) | 86 | 4 | 80 | leg 1 = 50-75, legs 2-7 = 0-6 | leg 1 is the on-the-clock calibration (S2) |
| shipped CLI default (`npm run sim ... --bot oracle`, 4 h cap) | 714 | 431 | 99 | misleading | missed CPs from truncation (M10) |

Findings: (1) the **endpoints are right** (ghost + oracle + TA = champion; ignoring losses = hundreds of seconds); (2) **no rung reproduces the 13 / 20-46 s/day band** - with a ledger the sim is too easy by 5-10x, without one too hard by 5-7x (S3);
(3) TA-less oracle shows the single highest-leverage human error is the train/light handling, consistent with R06 §2 but at 4x the real frequency (H3); (4) D12 stars (H6) do not map onto this band.
Recommendation: add two bots - "paper navigator" (table with +/-0.5 s noise, event ledger kept by arithmetic, TA) and "rookie with a table" - and tune generator hazards until the second lands at ~20-45 raw s/day.

---

## 4. What the trainer gets right (verified, keep)

- **Ghost:** instantaneous speed changes; Pause adds seconds at the node; timed anchor = ghost's departure (arrival + pause); restart re-anchors; `ghost.ts` = R07 §9.2. Timed change called at T - ramp/2 (`perf-table.ts rampLead`) = R07 §2.3.
- **Car:** 0->25/35/50 mph in 6.7/10.0/17.0 s (Q12/Q22: ~10 s, ~19 s); stop/start loss 7.6 s at 35 (R07 typical-V8 row 7.7); accel loss 0->40 5.2 s (Rowland's 4.5 s car); 8 ft/s^2 braking; turn caps 12/22/8 mph.
- **Scoring:** whole-second rounding of the arrival, leg anchored on the *actual* previous crossing, Ace = 0, age table points 0.845 (1939), 0.85 (1940), 0.915 (1953), 1.0 (1954+) (`scoring.ts:46`), missed after 30 min, sight zone <= 5 mph, observation CP stop.
- **Format:** five-column GRIID layout, CAMEO dot/arrow/bold/thin/dashed, real hint strings, STOP = octagon vs YIELD/BLINKER, lunch restart = arrival + 45 min rounded up (R06 §1), start/restart anchored, ~190-235 lines, 4-7 CPs, one CP "right after a STOP" per stage (R06 "most inopportune places").
- **Hazard semantics:** signal/train qualify for TA, slow traffic and construction do not (R04 §2.3), "wait longer than your pause" is a ledger event, TA never double-counted.
- **Instrument architecture:** one stopwatch (analog 1/5 s with countdown bezel, or digital with lap/recall), one analog TOD clock with rotating bezel, one speedometer, no odometer in the cockpit; analog crown refuses a reset while running (R05 §5.1-5.3, R01 §1.5).
- **Content hygiene:** lesson formulas (k = P/A, indicated = assigned/k, 10 %/20 % rule, dwell = pause - loss) all check out numerically against R07 §3.2 and §6.

---

## 5. Negative-transfer habits (things the trainer rewards that fail in the car)

1. Calling turns at ~150 ft with no consequence (S1) - in the car a turn call needs the driver to see the landmark and brake (~250 ft at 45 mph, comfortably 600+).
2. Reading times off digital text: stopwatch `M:SS.s`, lap list, "to go" bezel numerals, TOD HH:MM:SS, speed text, feet-to-feature labels (H1). In the car there are only hands and a needle.
3. Trusting an exact, free performance card and never sanity-checking or measuring (H2).
4. Steering by the pace bar / truth ledger (rungs 2-3) and discovering no such number exists (S3).
5. Treating Pause as "15, always" and visible inline in the sentence (M4); a real book can hide it in Col C, and other values exist (R04 §1.12 "Pause 30" example; D03 uses 20/30 but the full stage never does).
6. Leaving the start line "X s early" to pay the acceleration loss (M1).
7. Ignoring the posted-speed sign and assigned speeds above it (M2).
8. Spending attention on trap-rally rules (ONTO, exact-quote, Main Road Rule) and trusting Col-D hints that announce the trap (M3).
9. Treating TA as a precise per-second credit that can be filed any time (L11).
10. Expecting a train every 50 minutes and a red every second light (H3), and no cross-traffic at STOPs (H3).
11. Constant-factor cheat card from a single 50-mph run on a mechanical speedometer (M8, lesson text).
12. Calibration as a scored leg that includes the run (S2) - risk of arriving at the real start expecting a penalty-free calibration and a "free" first leg.

## 6. Habits the trainer does not teach (or only nominally)

- **Building and sanity-checking your own performance table** (>= 4 runs per speed): D06 counts `note` actions; the real card is never needed (H2).
- **Reading ahead and calling the next landmark before looking down** (R01 §5 / R06): the road view is always visible, no "eyes down" penalty (review §2.1 `focus` proposal not built).
- **Pre-read triage in 30 minutes** (H5) and marking pauses/speed changes on 220 lines.
- **Keeping a paper ledger of events** (E key exists) *and* trusting it over the pace bar; the pace bar is available at rungs 2-3.
- **Time-allowance procedure** as a phone request with evidence, and the "never TA and make up" rule at realistic granularity (L11).
- **Refuel/pit restarts, transit and free-zone sections, tire warm-up** (M5); Rowland's "19 seconds late to a restart after refueling" (R01 §7).
- **Hills/grade, heat, fatigue, a 7-hour stage** (M5, M6); the full stage is 4-5 h of mostly stop-and-go.
- **A driver who misunderstands** ("bear" vs "right", rolls a yield), and stating discriminators ("the second right, past the gravel").
- **Nine-stage consistency and the Trophy Run** (M7); only a single stage can be played.
- **Rotating clock bezel + stopwatch-as-TOD** is taught in D16 only and only in simplified form; R03 §3.3 says Grand Champions use it all day.
- **Recovery after a wrong-way start / U-turn arithmetic**: `call.uturn` exists (20 s) but no drill puts a wrong turn into a timing context; R06's 10-minute wrong-way day is not rehearsed.
- **Per-speed stock-speedometer cheat card plus morning `shiftCard`** (code exists in `calibration.ts`; no screen/lesson).

---

## 7. Verdict

**Realistic enough: YES WITH FIXES.**

The numbers a navigator carries from this trainer into the car - dwell = pause - loss, half-ramp lead, ghost semantics, leg reset, 1 pt/s, 0.845, k = P/A - are correct and verified by simulation. Without fixes Josh would
come away with (a) a turn-callout deadline that is too late for a real driver, (b) a calibration workflow that is scored and shorter than the real one, (c) dependence on readouts and a free exact card that do not exist in the car,
and (d) a mis-set expectation of how many trains, lights and stops a day contains and what a "good" score is.

### Top 10 fixes, ranked by value to Josh

1. **Turn-call physics and guidance (S1).** Remove the `turnCap*1.3` snap at `sim.ts:655`; a call later than the braking distance (v^2 - cap^2)/(2*aDec) + reaction becomes a missed turn (driver continues, asks, or stops); change `road.ts:24-26`, `debrief.ts:281,362`, `lessons.ts:53` to "a quarter mile / ~15-20 s, after the driver has the landmark".
2. **Calibration off the clock, longer, honest (S2).** Start leg 1 at END CALIBRATION or mark the run `transit`; 12+ intervals; real mile-marker spacing; print interval and cumulative in Col C (`cockpit.ts:163`); hidden-gain speedometer in all D12 tiers (`drills/index.ts:239`); teach per-speed card + `shiftCard`.
3. **Resolve Q1 and H4 against the Rookie Handbook, then expose "Col C cumulative on all lines" and "turn pauses" as rule toggles (S3/H4);** add the "paper navigator" bot rung so the ladder has a 13-46 s/day rung.
4. **Hide digital readouts in legal mode (H1):** stopwatch digital/lap/bezel numerals (`cockpit.ts:196`), TOD digital (`:200, :207`), speed text (`:203`), distance labels and feet scale in `road.ts`; keep them as rung-3 training aids.
5. **Gate the performance card (H2):** show only the player's own table (D06 entries, noisy +/-0.5 s) in legal mode; keep the exact model card as a rung-3 aid and in the debrief; fix lesson 2's 6.4 -> 7.3 consistency.
6. **Reset hazard frequency and add traffic (H3):** trains <= 1 per stage with ~20 % hit probability (`generate.ts:365, 392`), signals concentrated in towns, `trafficWaitProbability` 0.15-0.3 in `PROFILES.fullStage`; vary pauses 10/15/20/30 and add Pause at sharp turns/RR per R07 §1.4 once Q15 is settled.
7. **Make the stage the right size (H5, M5):** 30-minute pre-read default (`builder.ts:106`), 200-250 mi / 40-70 min legs, ~1 line per mile outside towns, add warm-up / refuel / transit / free-zone sections and a 12-CP profile; relabel D12 (150 min) to its true 4-5 h and make D13 a real Trophy Run + 9-stage campaign or retitle it.
8. **Fix benchmarks and stars (H6):** compare the age-factored score; star thresholds from R06 (<= 13 s/day = 3 stars, <= 46 = 1); reference line "20-46 s/day is a normal rookie day"; lift the 4 h cap in `runBot` (M10) so the CLI ladder is trustworthy.
9. **Correct the lessons/reference (L1-L12):** rewrite "late at every speed change", SPEED-quote rule, "first ten minutes", rounded +10 factors, invented penalties marked UNVERIFIED in every sentence, drop seconds-per-mile from the front of Reference; add missing lessons (timed segments, landmark speed changes/ramp lead, checkpoints/sight zone, TA, ledger, performance-table building).
10. **Make the course Great-Race-shaped (M2, M3, M4, M6):** assigned speeds consistent with posted signs; reduce trap-rally weight (ONTO, Main Road Rule, exact-quote) and delete the spoiler hints; put Pause only in Col C (not the sentence) in Gold tiers; add driver execution errors and grade-driven speed sag for the 1939 Ford.

Open facts for Josh to confirm (each changes a default): Q1 (cumulative times all day?), Q14/Q17 (calibration on the clock; start/early-leave procedure), Q15 (pauses at signals/turns), Q16 (TA granularity), Q20/Q21/Q22 (speeds, stock-speedo error, Ford performance), the V.E.2/V.E.3.a penalty values.

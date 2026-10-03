# Re-validation: education (did the fixes make two weeks of play teach P1-P13?)

Validator: EDUCATION re-run, 2026-10-03, build at HEAD 26b842b (engine 1.2.0, UI fix sprint merged). No web access. `src/` and
`tests/` untouched. All new scripts are `playtest-scripts/reval-*.ts` (re-runnable, see section 7). Baseline for every comparison is
`docs/playtest/VALIDATION-education.md` (verdict YES WITH FIXES, top-10 fixes in its section 7).

Method: headless matrix `oracle` (`OracleBot { useWatch: true }`, card technique plus truth-based recovery plus honest TA) vs `rookie`
(`ignoreLosses`, the naive first-timer), drills D03 D04 D05 D06 D07 D08 D08b D10 D15 D16 D17 D18 D11 D12, tiers 0 (Bronze) and 2
(Gold), seeds 1-5, graded by `drill.rubric(result, scenario)`; "Fix this next" is `debriefViewModel(...).tip`; truth causes come from
`result.attribution`. Plus targeted probes (D06 notes, D15 annotations, D07 calibration, D12 benchmarks, late turn calls, debrief rows)
and a Chromium look at what each rung shows (`vite preview`, D16/D03/D07/D12/D15).

## 0. Verdict

**YES WITH FIXES, materially better than before: "yes" for P2, P3 (card half), P5, P6, P8 (in motion), P9, and P12 (stop/start half);
still "no" for P7 (triage), P10 (protocol gradient), P13, and D02/P1 dial reading.** Of the previous top 10: 3 FIXED (2, 3, 7),
6 PARTIAL (1, 4, 5, 6, 8, 9), 1 mostly NOT FIXED (10); of the smaller items 4 fixed, 2 not. The biggest single improvement is the tip:
on runs that actually lost time (mean |leg error| > 3 s, n=137) the debrief "Fix this next" names the real largest same-sign cause in
133 (97 %); it was right in 4 of 14 before. The biggest remaining defect is the inverse: on runs that were fine (mean |error| <= 3 s,
n=115) it says "Clean run" in only 22, otherwise it lectures about a bucket the learner had correctly recovered (and still calls
deliberate recovery "the driver wandered").

Quick answers to the brief:

| Question | Answer |
|---|---|
| Naive play scores 0-1 stars, card technique 3 (2 stochastic) | Yes for D03, D04, D06 (with measured notes), D07 Gold, D08, D08b, D11, D12, D18 (rookie). **No** for D05 (Gold rookie 3/3/2/2/2), D07 Bronze (rookie 3/1/3/2/1: two seeds pass, because the rookie happens to land within 3 s), D10 (rookie always 2), D16 (rookie 1/2/1/1/1: 2 on some seeds), D17 (same as D07). Technique misses: D18 Bronze oracle 1/2/3/2/3, D12 Gold oracle without calibration 0 (by design; with a calibration card 1/2/0 at Gold, 2/3/1 at Silver), D06 and D15 0 until you annotate |
| Tip names the real largest cause | Mostly yes on failing runs (97 %); no on clean runs; custom rubrics D10/D15/D16 have a second tip that differs (section 3) |
| D06 grades "35 = 7.6" against truth | Yes (section 4.1); only stop/start loss, 1 run/speed, +-1 s tolerance |
| D15 rewards correct dwell, penalises wrong | Partly: correct 2-3 stars, wrong/junk/empty 1, none 0; still 1 pause line (4.2) |
| D07 Bronze/Silver require calibrating | Yes (4.3): uncalibrated oracle 1/0/1/1/0 (Bronze), 2/1/2/1/1 (Silver); calibrated 3/3/3/3/3 |
| D12 stars follow 13/25/46 | Yes (4.4), verified with synthetic raw values and real runs |
| Recovery text says E*v/d | Yes, everywhere (lesson 5, Reference, engine tips, D08 objective, D14 card, D08 rubric) |

## 1. Matrix: stars per seed (s1-s5) and the debrief "Fix this next" class

Tip classes: Clean, stop dwell, start/lead, ramp lead, timed seg, hazard/TA, turn loss, off course, driver wander, speedo. For D06,
D10, D15, D16 the rubric's own first bullet is also shown because it differs from the debrief tip.

| Drill | Tier | Oracle stars | Oracle "Fix this next" (modal) | Rookie stars | Rookie "Fix this next" (modal) |
|---|---|---|---|---|---|
| D03 | Bronze | 3/3/3/3/3 | Clean x5 | 0/0/0/0/0 | stop dwell x5 (true: stop +48..51 s) |
| D03 | Gold | 2/2/3/3/3 | stop dwell x3, Clean x1 | 0/0/0/0/0 | stop dwell x5 |
| D04 | Bronze | 3/3/3/3/3 | Clean x5 | 0/0/0/0/0 | stop dwell x5 |
| D04 | Gold | 3/3/3/3/3 | Clean x4, driver wander x1 | 1/1/0/1/1 | stop dwell x5 |
| D05 | Bronze | 3/3/3/3/3 | Clean x5 | 1/1/1/1/1 | start/lead x5 (true: start +4, ramp +1..3) |
| D05 | Gold | 3/3/3/3/2 | ramp lead x2, Clean x2 | **3/3/2/2/2** | start/lead x5 |
| D06 | Bronze | 0/0/0/0/0 (no notes) | stop dwell (rubric: "Note each measurement...") | 0/0/0/0/0 | same |
| D06 | Gold | 0/0/0/0/0 | same | 0/0/0/0/0 | same |
| D07 | Bronze | 3/3/3/3/3 | ramp lead x4, speedo x1 | **3/1/3/2/1** | speedo x5 (true: cruise -19..-37) |
| D07 | Gold | 3/3/2/3/3 | ramp lead x3, speedo x2 | 0/1/0/0/0 | speedo x5 (true: cruise +51..+80) |
| D08 | Bronze | 3/3/3/3/3 | hazard/TA x5 | 0/0/0/0/0 | hazard/TA x4, stop x1 |
| D08 | Gold | 3/3/3/3/3 | hazard/TA x5 | 1/1/1/1/2 | hazard/TA x5 |
| D08b | Bronze | 3/3/3/3/3 | hazard/TA x5 | 0/0/0/0/0 | hazard/TA x5 (true: hazard +66..83) |
| D08b | Gold | 3/3/3/3/3 | hazard/TA x5 | 0/0/0/0/0 | hazard/TA x5 |
| D10 | Bronze | 3/2/3/3/3 | turn loss x5 (rubric: "On course all the way") | **2/2/2/2/2** | stop dwell x4 (rubric: "On course...") |
| D10 | Gold | 3/2/3/3/3 | turn loss x5 | **2/2/2/2/2** | stop dwell x4 |
| D15 | Bronze | 0/0/0/0/0 (no annotation) | mixed (rubric: "Triage order...") | 0/0/0/0/0 | stop dwell x4 |
| D15 | Gold | 0/0/0/0/0 | mixed | 0/0/0/0/0 | stop dwell x5 |
| D16 | Bronze | 3/3/3/3/3 | **driver wander x5** (rubric: "Lead each departure...") | **1/2/1/1/1** | driver wander x3, start/lead x2 |
| D16 | Gold | 3/3/3/3/3 | **driver wander x5** | **1/2/1/1/2** | driver wander x3, start/lead x2 |
| D17 | Bronze | 3/3/3/3/3 | ramp lead x4, speedo x1 | 3/1/3/2/1 | speedo x5 (identical to D07) |
| D17 | Gold | 3/3/2/3/3 | ramp lead x3, speedo x2 | 0/1/0/0/0 | speedo x5 (identical to D07) |
| D18 | Bronze | **1/2/3/2/3** | driver wander x2, turn x2 (s1: generic "Review the attribution") | 0/0/0/0/0 | stop dwell x4, hazard x1 |
| D18 | Gold | 3/2/3/3/3 | turn loss x3, hazard x1 | 0/0/0/0/1 | stop dwell x5 |
| D11 | Bronze | 3/3/3/3/3 | driver wander x2, turn x1 (all runs +-1 s) | 0/0/0/0/0 | stop dwell x4, hazard x1 |
| D11 | Gold | 3/3/3/3/3 | driver wander x2, start x1 | 0/0/0/0/0 | stop dwell x4, hazard x1 |
| D12 | Rookie (t0) | 3/3/3/3/3 | **driver wander x5** (raw 1-5 s, 2-5 aces) | 0/0/0/0/0 | stop dwell x5 |
| D12 | Expert (t2, stock speedo) | 0/0/0/0/0 (no calibration; raw 366-406) | turn/speedo | 0/0/0/0/0 | speedo x5 |

20-seed oracle fairness (3-star counts; `reval-fair.ts`): D03 20/20 Bronze, 17/20 Gold; D04 20/20 and 18/20; D05 20/20 and 19/20;
D08 20/20 both; D08b 15/20 both (honest TA, same as before); D11 18/20 and 19/20; D07 20/20 and 10/20 (Gold stock speedo); **D18 Bronze
5x3, 6x2, 7x1, 2x0 (9/20 at <= 1 star: unchanged from the earlier 9/20), Gold 9x3, 10x2, 1x1**.

Is the tip the right cause? Rule used: if mean |leg error| <= 3 s the right tip is "Clean"; else the largest attribution bucket whose
sign matches the net error (ta excluded; any bucket >= 70 % of it also accepted). Result (`reval-tips.ts`, 252 gradable runs):
failing runs 133/137 right (debrief tip) vs 97/137 (rubric bullet, because D10/D15/D16 have different bullets); good runs: "Clean" in 22/115.
Typical hits: rookie D03/D04/D08/D08b/D11/D12/D18 name the stop dwell or the hazard (the true +50 s / +70 s bucket); D07 rookie names
calibration; D05 rookie names the standing-start loss (true largest bucket). Typical misses: see section 3.

## 2. What the headline tip says now (and whether it is the real cause)

| Run | True cause (attribution) | Debrief tip |
|---|---|---|
| D03 rookie t0 s1 | stop +51, start +4 | "Your stops cost more than the printed pause. Go earlier..." right |
| D04 rookie t0 s1 | stop +13, start +4 | stop dwell: right (the timed-segment part is smaller) |
| D05 rookie t0 | start +4, ramp +1..3 | "You left the start late": right bucket, but the drill's skill (the lead) is not named |
| D07 rookie t0 | cruise -20, stop +9 | "You ran fast ... the speedometer reads low. Calibrate": right |
| D08 rookie t0 | hazard +15, stop +9, start +5 | hazard / TA / +5 mph text: right |
| D08b rookie | hazard +66..83 | hazard / TA: right |
| D10 eager arming (s1) | off course, leg missing | rubric: "driveways, lots and gravel are not roads" (wrong cause); debrief: generic "A wrong turn cost the leg... confirm the landmark" |
| D16 oracle and rookie | start +4 (rookie), cruise +5 (lumped restart accel) | debrief: "Cruise segments ran slow: the driver wandered under..." wrong on all 10 oracle runs (should be Clean) and 6 of 10 rookie runs; rubric bullet "Lead each departure by the acceleration loss" right |
| D11 oracle s4 (error 0) | cruise -111 (deliberate recovery), hazard +87 | "Cruise segments ran fast: the driver wandered over the assigned speed" misleading |
| D12 oracle t0 (raw 1-5, 2-5 aces) | cruise -196..-330 recovery, turn +90..+150 | same "driver wandered" text on a champion run |
| D18 oracle t0 s1 | hazard +18 offset by ta -18, residual +8 | "Review the attribution: fix the largest bucket first" (generic default) |

The old W2 ("the speedometer reads low, call half a mph less" on a perfect Timewise) is gone, replaced by "the driver wandered" in the
same situations: the engine still cannot tell deliberate +5 mph recovery from speed-holding noise.

## 3. Check-list results in detail

### 3.1 D06 performance table (`reval-special.ts d06`)

True Ford (`stopLoss(v, v)`): 25 mph = 5.21 s, 35 = 7.58 s, 45 = 10.20 s (accel loss 35 = 4.43 s).

| Notes entered | Stars | Result |
|---|---|---|
| none | 0 | "not measured (true 5.2 / 7.6 / 10.2)" |
| "25 = 5.2", "35 = 7.6", "45 = 10.2" | 3 | all good |
| one note "25: 5.2, 35: 7.6, 45: 10.2" and "35 mph 7.6 s" forms | 3 | parsed |
| every value +0.8 s | 3 | within 1 s |
| every value +1.5 s | 0 | "off by 1.5 s" |
| every value -3 s (forgot the loss) | 0 | "off by 3.0 s" |
| one right, two wrong | 1 | per-speed feedback |
| constant "= 8" at all speeds (no measuring) | 1 | 35 mph "good" by luck |
| only the card example "35 = 7.6" | 1 | the example is the true value |
| three junk notes (old rubric = 3 stars) | 0 | fixed |
| three guesses at 35, first wrong | 0 | only the first matching note counts |

Verdict: the old "count the notes" rubric is gone and the grading is correct. Gaps: only stop/start loss (the objective also asks for ramp
times, never graded); one run per speed (real car needs 4); tolerance +-1 s is wide against a 5-10 s range (a constant 8 s earns a star);
a typical learner can copy 5.2 / 7.6 / 10.2 from the Reference page, whose answer sheet is **open by default until D06 is passed**
(`reference.ts`: `if (!d06) answerSheet.setAttribute('open', '')`, the opposite of what is wanted); the post-run feedback example "35 = 7.6" is the true value;
no implausible-row sanity check; the hidden car is not re-randomised at Gold (VALIDATION.md still lists it as open).

### 3.2 D15 pre-read (`reval-special.ts d15`)

Scenario: still the D18 scenario, 6-7 book lines with **exactly one pause line** (seeds 1-8), 10-minute pre-read. The brief and objective say 30 minutes and 40 lines.

| Annotation text on the pause (Bronze, seeds 1-5) | Stars |
|---|---|
| none | 0/0/0/0/0 |
| the correct physical dwell, number only | 2/2/3/3/3 (Gold 3/2/3/3/3) |
| correct dwell written as "go at 7.3s" | 1/1/1/1/1 (parseFloat fails on text) |
| off by 1.5 s | 1/2/3/3/1 (see bug below) |
| off by 3 s, the printed pause, "x", empty string, "0" | 1/1/1/1/1 |

So correct numbers are rewarded and wrong ones penalised (1 vs 2-3), but any annotation, including an empty string, beats none (cov >= 0.5 gives 1 star); the
final star also needs mean |leg error| <= 3 s, which is the D18 execution score (seeds 1 and 2 cap at 2 because of the D18 hazard leg). New defect: the rubric's
"ideal dwell" applies the 12 mph turn cap to a straight (`turn: 'S'`) stop (`index.ts` D15 rubric: `ins.turn ? ... : undefined` treats 'S' as a turn), so for straight
stops the ideal is 1.4-1.5 s smaller than the physical dwell (s1 5.2 vs 6.6; s5 4.6 vs 6.1; s7 6.5 vs 7.9): a correct answer eats 70 % of the 2 s tolerance, which is why "off by 1.5 s"
flips stars on seeds 1 and 5. UI highlights ("pause" colour) are not engine actions, so only the typed GO field counts.

### 3.3 D07 and D17 calibration (`reval-special.ts d07`)

Hidden Timewise gain is now 0.967-1.032 at Bronze/Silver (seeds 1-12), stock mechanical 1.012-1.021 + offset + quadratic at Gold. `OracleBot { noRecovery: true }`
(no truth recovery), seeds 1-5:

| Oracle variant | Bronze | Silver | Gold (stock speedo) |
|---|---|---|---|
| truth recovery on, no factor (the stock oracle) | 3/3/3/3/3 | 3/3/3/3/3 | 3/3/2/3/3 (recovery hides it) |
| noRecovery, **uncalibrated** | **1/0/1/1/0** (legs -14..-28 s) | **2/1/2/1/1** | 0/1/0/1/0 (+38..+53 s) |
| noRecovery, `speedo.setFactor(1 / gain)` (the true factor; gain is indicated = gain x true) | 3/3/3/3/3 | 3/3/3/3/3 | cheat card of 1/gain: 1/2/1/1/1 |
| noRecovery, k derived from the calibration-run laps vs Column C | 3/3/3/3/3 | 3/3/3/3/3 | 3/2/2/3/3 |

(`setFactor(gain)` instead of `1/gain` is the wrong direction and scores 0-1: a learner who inverts k is punished, correct.) So calibration now separates skill from
no skill, the D11 gate (D07 >= 2 stars) cannot be passed by skipping it, and Gold shows the extrapolation problem the new lesson text describes (single k from the 50 mph run
leaves 5-23 s). D17 results are **identical to D07** to the last digit (the forced watch reset at 600-900 s has no effect on bots and the rubric is the same leg-error score), so
D17 still teaches nothing measurable.

### 3.4 D12 stars (`reval-special.ts d12`)

Direct probe on the real rubric: raw 0 -> 3, 13 -> 3, 13.5 -> 2, 25 -> 2, 26 -> 1, 46 -> 1, 47 -> 0, and > 1 off-course -> 0. Real runs: oracle with latency 0-4 s gave
raw 1-5 -> 3 stars, 15 -> 2, 20 -> 2, 27-31 -> 1; with calibration card at Silver/Gold raw 23/5/29 -> 2/3/1, raw 30/17/81 -> 1/2/0. The labels in `benchmarkLabel` (3/13/25/46)
match the star bands. Uncalibrated, D12 is 366-556 s raw (0 stars). Real length is still 198-228 lines and **241-294 sim-minutes** while the drill card says 150 min.

## 4. Previous top-10, item by item

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | DEBRIEF-005 tip integrity | **PARTIAL** | Fixed: one engine headline now feeds the debrief tip for every basicRubric drill (identical in all D03-D08b/D11/D12/D17/D18 runs); the turn-callout statistic no longer outranks real causes; right on 133/137 runs that lost time (was 4/14); "speedometer reads low" on a perfect Timewise is gone. Not fixed: no "Clean run if mean |error| <= 3 s" rule (Clean only 22/115 good runs; D08/D08b/D07/D11/D12 perfect runs get hazard/ramp/cruise lectures, 3-star D12 runs "driver wandered over the assigned speed" on -330 s of recovery); `rubrics.headlineTip` still exists and the rubric bullet still differs from the debrief tip on D10, D15, D16 (`feedback[0]` is not the debrief tip); D16 debrief tip wrong on 16 of 20 runs (restart acceleration is lumped into the cruise bucket); D18 s1 generic "Review the attribution". |
| 2 | UI-014 restart time and hold != stop | **FIXED** | Book row reads "RESTART. At Restart. Speed 35  RESTART at 09:05:05" at every tier (Chromium D16 Bronze/Silver/Gold, D12, D07); debrief restart row "Ideal go = out-time - standing-start loss 4.4 s = 09:05:00; you called go at 09:05:05 -> +4.4 s"; D16/D07 `stops` rows exclude the restart (0 rows), so the old "+241 s late, 230.8 s average" tip (W3) is gone; engine `restartTime` now shown. Residual: restart acceleration still lands in `cruise`/`start` buckets (D16 tip). |
| 3 | UI-015 analog fidelity | **FIXED** | `instrumentPolicy`: digital readouts at rung >= 2 only. Chromium: D16 Bronze (rung 2) shows "PRE-READ start in 1:59", "08:57:11 start 08:59:11", "0 mph" caption; D16 Silver (rung 1), D16 Gold, D03 Gold, D12, D15 show "PRE-READ" only, "official start 08:59:11", no stopwatch digital time, no "(0.0 to go)", no speedometer number. D15 Bronze inherits D18's rung 1, so its Bronze already has no digital aids (tier labels differ from the card). |
| 4 | UI-016 / DRILL-010 answer sheet; pace bar | **PARTIAL** | Fixed: computed "card X s"/perf card hidden at rung <= 1 ("Legal mode: no computed card. Work it out on the lapboard"; D03 Gold, D16 Silver/Gold, D12, D15) and shown at Bronze; the pace bar at a stop is now "wait X more s" (Bronze) or only an arrow (Silver) instead of -(pause) counting up to zero (`cockpit.ts` 279-290, read in code and not driven in the browser; PT-02 BUG-10 closed). Not fixed: Silver (rung 2) still gets the computed card (spec said rung 3 only); the Reference true table is open by default until D06 is passed (so it is open during D06) and not replaced by the learner's own; DRILL-010 hidden re-randomised car not implemented (same Ford, same 7.6 s every seed). |
| 5 | DRILL-014 D06 grades the model | **PARTIAL** | Now grades notes against `stopLoss` truth (3.1 above): exact -> 3 stars, junk -> 0, wrong -> 0. Missing: ramp times, >= 4 runs per speed, RMS grading at 0.5 s, sanity-check variant; +-1 s tolerance lenient. |
| 6 | DRILL-015 P3/P4 scored on the skill | **PARTIAL** | Fixed: School lesson "Timed segments and ramp leads: 34 not 36" added (content/lessons.ts); D04 stock-oracle failure (BUG-7) gone (20/20 Bronze, 18/20 Gold 3 stars); worked rows for compound STOP+timed lines improved from +22/+48 s to +3.3..+5.6 s for correct play (still non-zero: D04 s2-s6 line 4/7). Not fixed: D05 stars still use leg error (rookie Gold 3/3/2/2/2, Bronze 1/1/1/1/1, tip names the standing-start loss); D04 goCount (counting from own go) still 3/3/3/3/3, so the ghost-departure rule is unscored; D05/D04 rubrics unchanged. |
| 7 | DRILL-016 calibration must matter | **FIXED** | D07 hidden error +-1.5..3.5 % (spec said >= 2.5 %; the lower bound is 1.5 %): uncalibrated Bronze 1/0/1/1/0, Silver 2/1/2/1/1, calibrated 3 (3.3). Calibration lesson now states the daily redo, cumulative Column C, and the single-k extrapolation limit. Not done: D17 "elapsed re-derived from clock" check; D17 still identical to D07. |
| 8 | DRILL-017 D15 is a triage drill | **PARTIAL** | Numeric GO accuracy (+-2 s) is graded and wrong/junk text scores 1 vs 2-3 for correct (3.2). Not done: still 1 pause line (spec: 40 lines, >= 8 pauses, 20-minute pre-read: 6-7 lines, 10 min), empty text counts as annotated (1 star), "pause" highlight not counted by the engine, straight-stop ideal uses the turn cap (new bug), text like "go at 7.3s" not parsed. |
| 9 | DRILL-018 P8 depth + recovery rule | **PARTIAL (rule FIXED, D10 not)** | D09 now 20 distinct cards from the 24-card library with rule options (not the answer in the prompt), Acute/Jog cards included (`quiz.ts`, categories of misses tracked). Recovery rule text is `E x v / d` everywhere (lesson 5 with "56 s not 64", Reference, engine hazard tip "8 s late at 35 -> 40 mph for 56 s", D08 objective and rubric, D14 card option distractor 64 s). Not fixed: D10 eager-arming rubric tip still "driveways, lots and gravel are not roads" (the real cause is arming early; off-course 8/8 seeds at 900 and 1500 ft, 1 star), the debrief has no off-course worked row, Dad's "No right here, staying on" is only in the driver log; D18 eager = oracle; no T-vs-not-T / quoted-sign / dead-end additions to D10; D10 rookie still 2 stars (the sim driver never takes a driveway). |
| 10 | DRILL-019 / PROTO-001 (P10, P13, P1) | **mostly NOT FIXED** | Partial: a turn called 60 or 20 ft out is now refused by the driver ("Too late") and the run goes off course: D10 4/4 seeds 1 star, D11 3/4 seeds 0 stars (turn called 300 ft out: 3/2/3/3), so late callouts now have a consequence, but it is a cliff, with no "Left or right?" hesitation gradient, no read-back scoring. Not fixed: D02 (dial reading) still on Home but unregistered; no D19 and P13 only tagged on D14's four card types; D12 card 150 min vs 241-294 measured, D13 1500. |

Smaller items from the previous report:

| Item | Status | Evidence |
|---|---|---|
| Lesson 5 / Reference: light stop/start loss not TA-creditable | FIXED | lesson 5 last paragraph |
| Lesson 6 numbers sourced or removed | FIXED | "two minutes / fifteen seconds" replaced by the recorded 1:05 rookie wrong turn |
| Reference sight-zone/observation/early-restart marked as simulator defaults | FIXED | `reference.ts` rules panel cites OPEN-QUESTIONS Q3/Q5/Q6/Q11/Q16/Q18 |
| Per-tier stars (not best-of-any-tier) | FIXED | Home pips per tier (e2e `ui-fixes.spec.ts`) |
| Readiness meter by P-skill | NOT FIXED | no readiness/skill-map in `src/ui` |
| D18 gate fairness (cap hazard or accept 1 star) | NOT FIXED | oracle with honest TA <= 1 star on 9/20 Bronze seeds (same as before), 1/20 Gold; the 5-8 s residual is the uncredited light stop loss plus the turn loss; the objective does not say so |
| D18 / D15 Bronze label vs rung | NEW | D15 is built from D18's tiers, so its "Bronze" has rung 1 not the card's rung 2 |

## 5. Remaining gaps (ranked by learning harm)

1. **Clean-run rule and recovery mislabel (tip noise).** Make the debrief say "Clean run" whenever mean |leg error| <= 3 s, and never describe a bucket the ledger shows
   as recovered ("recovery", not "driver wandered"). Today 93 of 115 good runs, including every D12 champion run, get a corrective lecture. Also move restart acceleration into a
   `start` bucket so the D16 debrief tip stops saying "driver wandered".
2. **D15 is still a one-line drill.** One pause line, 10-minute pre-read, any annotation scores; fix the `S`-turn cap in the rubric ideal, drop empty text, parse "go 7.3", and generate
   a 40-line book with >= 8 pauses and 5 speed changes.
3. **D06 can be copied.** Keep the Reference true table closed until D06 is passed (it is open until then), re-randomise the hidden car at Gold, grade ramp times, tighten tolerance to 0.5 s,
   and stop quoting the true 35 mph value in the instruction example.
4. **D05/D04 stars do not measure the lead or the ghost-departure rule.** Rookie Gold D05 passes with 2-3 stars; goCount in D04 passes with 3.
5. **D10 and D18 cannot fail the decoy.** The sim driver never takes a driveway; the eager-arming off-course carries the wrong tip (driveways) and no worked row.
6. **D17 teaches nothing the bots can see** (identical to D07) and the D16 rookie scores 1-2 stars, passing the D12 gate (D16 >= 1 star).
7. **D18 Bronze gate fairness** (9/20 oracle seeds <= 1 star) and the missing explanation that a light's stop loss is yours to recover.
8. **P10/P13/P1:** protocol gradient and read-back scoring, SCCA/odometer drills or descoping P13, D02, D12/D13 card minutes, readiness meter.
9. D05/D10/D16 rookie passes at Gold (naive gets 2-3 stars) so tier stars overstate skill there; consider scaling thresholds by the leg count, not only driver noise.

## 6. Time budget and progression (changed since last report)

Unlock graph unchanged: D18 needs D03/D04/D05/D08/D10 >= 2; D11 needs D18 >= 1 and D07 >= 2 (now meaningful, since D07 requires calibration); D12 needs D11, D15, D16 >= 1 (D15 = any annotation, D16 =
rookie 1-2 stars, so those two gates remain soft). The first D18 wall persists. D12 is 4-5 h at 1x of real time; the "150 min" label understates it by roughly 2x.

## 7. Reproduce

```
npx tsx playtest-scripts/reval-matrix.ts D03,D04,D05,D06,D07,D08,D08b,D10,D15,D16,D17,D18,D11,D12 0,2 1,2,3,4,5   # stars, rubric tip, debrief tip, attribution, per run
npx tsx playtest-scripts/reval-table.ts [drills]                  # section 1 markdown rows
npx tsx playtest-scripts/reval-tips.ts                            # tip-vs-truth precision (section 1 and 2)
npx tsx playtest-scripts/reval-special.ts d06|d15|d07|d12         # sections 3.1-3.4
npx tsx playtest-scripts/reval-fair.ts                            # 20-seed oracle star distributions
npx tsx playtest-scripts/reval-d12cal.ts                          # D12 with a calibration card at Silver/Gold
npx tsx playtest-scripts/reval-debrief.ts                         # D10 eager arming, D16 restart rows, D04 compound rows, late-turn-call probe
npx tsx playtest-scripts/reval-chk.ts                             # drill registry, D07 gains, D12 length
npx vite preview --port 4173 &  npx tsx playtest-scripts/reval-ui.ts   # what each rung shows (restart time, digital readouts, card)
```

Caveats: the oracle uses truth-based recovery, so it masks calibration error in D07/D12 unless `noRecovery` is used (section 3.3); the "right cause" rule is mechanical (largest same-sign attribution bucket,
alternates within 70 %), so "tip wrong on a clean run" means "advice about a bucket the learner already recovered", not that the named bucket is absent; Silver (tier 1) was probed only in D07/D16/D12; browser checks are
single-seed screenshots of rung behaviour, not full play-throughs.

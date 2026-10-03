# Validation: education (will two weeks of play teach P1-P13 and avoid the rookie traps?)

Validator: EDUCATION pass. Date 2026-10-03. Question: will a motivated engineer playing about two weeks acquire skills P1-P13
(REQUIREMENTS section 2) and avoid the common rookie traps? No web access. `src/` and `tests/` untouched; all scripts are under
`playtest-scripts/edu-*.ts` (re-runnable: `npx tsx playtest-scripts/edu-matrix.ts D03,D04 0,2 1,2,3`).

Method (as briefed): (1) coverage matrix from the drill/lesson/debrief code; (2) headless learner path, `--bot rookie` (ignores
losses = the naive first-timer), `oracle` (card technique), plus bots the stock set lacks (k-card calibrator, honest-TA declarer,
pre-read annotator, eager/late turn caller, D01 lap bot with reaction noise), graded with `drill.rubric(result, scenario)`;
(3) read School/Reference as a student and checked every formula; (4) debrief view-model, rubric tips and counterfactuals on real
result objects, and a Chromium look at what the UI actually shows (`edu-ui.ts`). Baseline: PT-02 findings and
VALIDATION-playability-enjoyment.md (corroborated where noted).

## 0. Verdict

**YES WITH FIXES.** The core loops work and are measurably educational: naive play scores 0 stars and card technique 3 stars on
D03/D04/D08/D18/D11, calibration (D07 Gold) and the Time Allowance (D08b) separate technique from no technique, the debrief's
counterfactuals ("call go at the card dwell: raw 54 -> 5") are the best teaching device in the app. After two weeks Josh will own
P2, P3, P5 (Gold), the TA half of P6, and the course-following half of P8. He will NOT acquire P7, P9, P10, P12, P13 and only
the reaction half of P1, and the app will sometimes teach him wrong lessons (see section 5), because:

1. The debrief "Fix this next" tip is wrong in 10 of 14 sampled runs (right in 4); it even tells a learner who recovered time
   correctly that "the speedometer reads low, call half a mph less".
2. The restart out-time is never displayed (book says "RESTART. At Restart"), the HUD prints digital clock/stopwatch/speedo
   numbers at every rung, and the book/lapboard print the computed dwell ("card 21.6 s") at every rung including Gold: P9, P1
   (dial reading), P12 and the arithmetic half of P2-P4 are bypassed by the UI.
3. D06 (performance table) grades a count of free-text notes, D15 (pre-read) has one pause line, D09 is half tautologies.

## 1. Coverage matrix, P1-P13

Legend: strong / ok / weak / none. "Loop" = feedback loop quality; "Prog" = progression (tiers = Bronze rung 3, Silver rung 2,
Gold rung 1 + rookie driver; D11/D12 Silver/Gold rung 0).

| Skill | Taught by | Practice | Loop (feedback) | Prog | Verdict |
|---|---|---|---|---|---|
| P1 stopwatch handling | D01; implicit in every drill; lesson 2 (bezel) | D01 8 laps, scored on jitter (sd), bias ignored (correct per 03 s9.1) | per-run headline "bias 0.27 s, jitter 0.12 s" exact | Bronze=Gold (tiers change nothing for D01; table 2.1) | ok. Dial READING never required: HUD prints digits (finding F3). D02 (dial reading) is listed on Home but not registered. |
| P2 pause/stop + loss model | D03 (best drill), lesson 2, Reference card, D14 | 6 stops x 3 tiers, mixed entry/exit, turns | worked dwell rows, CF "call go at card dwell" 54 -> 5 | Gold adds rookie driver + traffic wait | strong, but the dwell is printed on every book row at every tier (F4) |
| P3 timed speed changes | D04, Reference "timed segment" | 6 segments, 2 compound STOP+timed | CP error, worked row | tiers | ok. No School lesson. Compound-line worked rows are wrong (+22 / +48 s shown for correct play, F6); goCount (counting from own go) still scores 3 stars so the ghost-departure rule is unscored |
| P4 landmark speed changes | D05, Reference lead table | 8 changes | per-sign rows (right), stars on leg error (wrong) | Gold 3 stars for naive play | weak: the lead is worth ~0.5-1 s per change so stars cannot see it (F6) |
| P5 calibration, k, cheat card | D07, D17, D12 start, lesson 4 | 6-mile run, Column C, Timewise (Bronze/Silver) or stock (Gold) | CF "exact card: 54 -> 4"; cruise row "card is 4.0 % low" | Gold = stock speedo | strong at Gold, weak at Bronze/Silver (no-k scores 3/3/2 stars, F7); lesson omits non-linearity/extrapolation of a 50-mph k |
| P6 ledger, recovery, TA | D08, D08b, D18, lesson 5, Reference, ledger E key | D08 15-35 s losses (fixed), D08b 70 s train | D08b headline prints declared/qualifying/credited; CF fullTa 60 -> 0 | tiers | TA strong (D08b 3 stars with honest TA, 1 star over-declaring); recovery arithmetic stated in ghost time but executed on a real-time watch (F9); the stop/start loss at a light is not credited and no lesson says so |
| P7 reading under load, pre-read | D15 (+ GO-time/highlight strip in the book) | D15 = D18 scenario, 1 pause line, any text counts | "N % of pauses annotated" | rung 2/1/0 | weak (F8): not a triage drill |
| P8 traps / course following | D09 quiz, D10, generator traps (24 cards), lesson 3 | D10: 12 lines, 6 decoy patterns; D11/D12 draw on the 24-card library | off-course -> 1 star cap; "On course. Now add the clock" | tiers | ok in motion (eager turn arming goes off course 8/8 seeds, 1 star), weak in D09 (F10) |
| P9 time-of-day | D16, D17, clock/bezel in UI | restart + minute rollover | minute-fail rule good; tip right | rung | weak: restart time not shown, digital countdown/clock always on (F2, F3) |
| P10 driver protocol | lesson 6 only; Dad read-backs and check-off | none scored | none | none | NONE: a turn called 20 ft before the node costs 0 s and no Dad question (measured D10/D11 seeds 1-4) |
| P11 endurance / score meaning | D11, D12, D13; benchmark labels | D12 measured 268-305 sim-min (card says 150); D13 1500 | benchmark word on headline | D12 gate = D11, D15, D16 | ok for 1-3 stages in two weeks; D13 not reachable; no resume (sibling report B1) |
| P12 performance table | D06, Reference card, lapboard card | D06 = 3 stops + 3 speed changes, 1 run per speed | none: rubric = number of notes | none | NONE (F5): the true Ford table is on the Reference page and the per-line card from minute one |
| P13 SCCA/odometer | D14 (labelled P13) | 20 cards: dwell, s/mile, recovery time, stopwatch add | tip per card | none | NONE: no CAST, odometer factor, min/mile, hundredths-of-minute; s/mile is the only overlap |

Skill-by-tier note: D01 Bronze = Gold, D16 tiers differ only by aids (nothing to remove), D09/D14 single tier.

### 1.1 Top 15 rookie mistakes (docs/research/02 s3; GR-specific from 06) vs app

| # | Mistake | Where taught / punished | Status |
|---|---|---|---|
| 1 | Getting lost; time before route (02 #1, #28, #29) | D10, D11, D12; star cap at 1 when off course; lesson 6 "stop before the leading edge" | ok. Tip names the wrong cause for eager turn arming (F10) |
| 2 | Not reading General Instructions (#2) | Reference "General Instructions: definitions" panel only | weak: no lesson/quiz |
| 3 | Following the car ahead (#3) | no other cars in sim | none (not simulatable; could be a D09 card) |
| 4 | Checking off in advance / losing place (#4) | Dad check-off lines, `line.set` | ok (aid) but unscored |
| 5 | Ignoring new instruction sheets (#5) | not simulated | none |
| 6 | Driving past an unsure intersection (#6, #28) | D09 "Stop and ask" card, lesson 6 | weak |
| 7 | Quoted sign exactness (#7) | D09 OAK RD/DR card, lesson 3, traps.ts `quoted-sign-mismatch` | ok in D11/D12, 1 card in D09 |
| 8 | Main-road rule / T with no instruction (#8) | D09 card, traps.ts `straight-as-possible-fork` | ok (1 card) |
| 9 | Wrong sign class (#9) | none | none |
| 10 | Skipping calibration (#10) | D07/D17/D12, lesson 4 | strong at Gold, weak at Bronze/Silver |
| 11 | Factor on distance not speed (#11) | none (SCCA) | none (P13) |
| 12 | Decimal minutes as min:sec (#12) | none | none (P13) |
| 13 | Forgetting a pause (#13) | D03 noPause 0 stars with tip "left stops too early", D15 highlight | strong |
| 14 | CAST at wrong point (#14) | D05, Reference "leading edge" | ok (rubric blind, debrief rows right) |
| 15 | Watch not synced / start off the second (#15, #16) | D16, D17 | weak: HUD countdown + digital clock (F3) |
| 17 | Carrying error across a checkpoint | lesson 1 "errors do not compound"; timeline resets | ok (reading only) |
| 18 | Speeding to catch up / early overshoot (#18, #19) | symmetric penalty, lesson 5 "never overshoot" | ok; no oscillation feedback |
| 20 | Not allowing for stops/traffic (#20) | D08, D08b, D18, D11 hazards | strong |
| 21 | Blocking observation checkpoint (#21) | `observationMissed` feedback, Reference | ok, no drill |
| GR | Lost watch / train / lunch restart / score meaning (06 #3, #11, #10) | D17, D08b, D16, benchmark label | D08b strong, D17 insensitive (bot result identical to D07), D16 blocked by F2 |
| GR | 12-checkpoint day, wrong-way start (06 #2, #4) | not in generator profiles | none |

## 2. Headless learner path: evidence tables

Harness: `edu-matrix.ts` (bot x drill x tier x seeds 1-3), `edu-fair.ts` (20 seeds), `edu-skills.ts`, `edu-ta.ts`, `edu-traps.ts`.
Stars are `drill.rubric` stars; "legs" are signed leg errors in seconds (+ late). Bots: oracle = card technique + truth-based recovery
(no TA); rookie = full pause, no leads, leave on the second; noPause = forgets pauses; goCount = counts timed segments from its own go;
`k` = oracle without truth recovery that sets Timewise factor / stock cheat card from the calibration run.

### 2.1 Bronze (t0) vs Gold (t2): naive vs technique

| Drill | Naive (rookie) t0 | Naive t2 | Technique t0 | Technique t2 | Does it teach? |
|---|---|---|---|---|---|
| D03 | 0/0/0 (+24,+14,+16) | 0/0/0 | oracle 3/3/3 | 2/2/3 | YES. 20-seed oracle: 20/20 3 stars (t0), 17/20 (t2) |
| D04 | 0/0/0 (+10,+7) | 1/1/0 | goCount 3/3/3 (20/20 seeds); stock oracle 3/3/0 | goCount 3/3/2 | YES for losses; compound-line anchor unscored (goCount = 3 stars). Stock oracle fails 12/20 seeds (+9..+12): root cause is the oracle's `timedChangeGhostTod` on compound lines (instant-car test: oracle +11/+12, no-loss rookie 0/-1), not the drill (goCount 20/20 3 stars) |
| D05 | **2/2/1** (+5,0) | **3/3/2** | 3/3/3 | 3/3/3 | NO at the star level: naive play gets 2-3 stars; the tip it gets is "left the start late" (the standing-start loss), not the missed lead. Debrief landmark rows do show "called 0.0 s before; +4.3 s" |
| D07 | 1/1/1 (+18,+1) | 0/0/0 (+53,+15) | oracle 3/3/3; k-card 3/3/3/3/3 | k-card 3/2/2/2/3 (5 seeds) | Gold YES (no k: 1/1/1/1/0, k: 3/2/2/2/3). Bronze/Silver NO: no-k scores 3/3/2/2/2 because the Timewise error is 0.4-1.2 % (3-12 s); the D11 gate (D07 >= 2 stars) is passable without calibrating |
| D08 | 0/0/0 (+30..+40) | 1/1/1 | oracle 3/3/2; honest TA 20/20 3 stars | oracle 3/3/3 | YES. Loss now 15-34 s and recoverable (PT-02 fix verified) |
| D08b | 0/0/0 (no TA, +60..+83) | 0/0/0 | honest TA 3/3/3; 20 seeds 15x3, 4x2, 1x1 | same | YES, best drill. Over-declare by 20 s = 1 star (flagged) |
| D10 | 2/2/2 (bot follows the book; off-course 0) | 2/2/2 | oracle 3/2/3; eager turn arming (900/1500 ft) 1/1/1/1/1/1/1/1 (off-course 8/8) | same | YES for "don't arm the turn early". NO for driveway/gravel decoys: the sim driver never takes a driveway, so "1st paved road" cannot be failed from the call interface (D18 eager = oracle) |
| D15 | 0/0/0 (no annotation by any stock bot) | 0/0/0 | annotate any text on the 1 pause: 2/2/3 | 3/2/3 | NO: scenario = D18 with a 10-minute pre-read and **one** pause line (`1p`); any `line.annotate` text, even empty, counts; correctness of GO time not graded |
| D16 | 1/2/1 (+5,+5) | 1/2/1 | 3/3/3 | 3/3/3 | Partly: "leave early by the accel loss" learned; clock reading/rollover not exercised (F3), out-time invisible (F2) |
| D17 | 1/1/1 | 0/0/0 | identical to D07 | identical | NO signal: bots never use the watch so the reset is invisible; rubric = leg error. Human recovery cannot be measured |
| D18 | 0/0/0 (+28,+27,+46) | 0/0/0 | oracle 0/2/3 (s1 +26 light) | 3/2/3 | YES, but gate fairness: oracle 20 seeds t0: 6x0, 3x1; with honest TA still 7/20 <= 1 star at Bronze (uncredited 6.5 s light stop loss + 4 s turn in a 5-min leg); t2 2/20 |
| D11 | 0/0/0 (+121..+136) | 0/0/0 | oracle 3/3/1 (s3 train +81 s); honest TA 20/20 3 stars | 19/20 | YES. Eager turn arming: off-course on 4/8 (900 ft) and 7/8 (1500 ft) seeds, 0-1 stars |
| D12 | rookie raw 901, 0 stars | n/a | oracle (no TA) raw 58-73 ("blown": one +54 train leg), 2 stars | stock-speedo oracle raw 422 | Works as a stage. Real length 268-306 sim-min at 1x (card says 150) |
| D01 | n/a | n/a | jitter sd 0.12 -> 3 stars; bias 0.5 s + jitter 0.2 -> 3 stars; jitter 0.42 -> 2 stars | identical to t0 | Fine and honest (bias ignored); tiers do not differ |

### 2.2 Does the headline tip name the real mistake? (13 representative runs)

"Rubric tip" = first line of `drill.rubric().feedback` (engine `headlineTip`, shown as the bullet list under the stars).
"Fix this next" = `debriefViewModel().tip` (the boxed tip on the debrief). The debrief shows BOTH.

| Run (mistake) | Rubric tip | "Fix this next" |
|---|---|---|
| D03 oracle, 3 stars, clean | right: Clean run | WRONG: "Turn callouts come 25.2 s before the intersection: call 150 ft before..." |
| D03 rookie (full pause) | right: stops cost more than the pause | WRONG: turn callouts 35 s before (stop bucket is +51 s) |
| D03 noPause | right: left stops too early | WRONG: turn callouts 15 s before (stop -54 s) |
| D04 goCount (counts from own go) | clean | "Nothing systematic" (acceptable: costs ~1 s) |
| D05 rookie (no lead) | partial: "left the start late" | right: "Speed changes average 2.2 s late: call half a ramp before the sign" |
| D07 Bronze oracle, 3 stars, +1/+1 | WRONG: "Your stops cost more than the printed pause" | plausible (truth: gain 0.4 % high) |
| D07 Gold no k | right: calibrate | right direction; "correct the card by about 0.5 mph" but true error is 4 % (~2 mph) |
| D08 no recovery | right: hazard / TA / +5 mph | WRONG: "Cruise error scatters: the driver is wandering" |
| D08b no TA | right (generic) | WRONG: "You gain 16.9 s per leg at cruise: speedometer reads low" (hazard +70 s) |
| D16 perfect run and rookie | right: lead by the accel loss | WRONG: "Your go calls average 230.8 s late: subtract 231 more from every dwell" (restart hold counted as a stop) |
| D18 oracle (light +18) | right: hazard | WRONG: turn callouts 13.6 s before |
| D11 oracle, 3 stars, -1 | WRONG: "Turns cost time the ghost does not spend" | WRONG: "You gain 27.4 s per leg at cruise: speedometer reads low; call half a mph less" (that is the correct +5 mph recovery of 30 s of turn loss) |
| D10 eager turn arming | WRONG: "driveways, lots and gravel are not roads" | right-ish: "Turn callouts come 13.5 s before the intersection" |

Rubric tip right 10 of 14 (+1 partial); "Fix this next" right 4 of 14 (+1 partial). The same wrong "speedometer reads low" appears on a
Timewise speedo in D04 (oracle t2 s1 and lateCall, 3 stars), D08 lateCall, D11 lateCall/goCount, D12 oracle and lateCall (every D12 run sampled): the
engine `headlineTip` (rubrics.ts) and the view-model `FIX.cruise` both read deliberate recovery overspeed as speedometer error.
`rubrics.ts` also still sums the unscored tail after the last checkpoint (PT-02 BUG-3 half-fixed in the view-model only).

## 3. Rules and lessons as a student (correctness / completeness)

Checked against REQUIREMENTS, research 03/07, and by derivation.

| Rule | Where | Correct? |
|---|---|---|
| dwell = pause - loss; "go immediately = early by the loss" | lesson 2, Reference, perf card | Correct. 7.5 s at 35/35 matches `perf-table` (7.6). |
| lead = ramp/2 ("34 not 36") | Reference lead table, D04/D05 objectives, tips | Correct and complete in the Reference; **no School lesson** teaches timed segments / leads (P3/P4 have no lesson; lesson 6 mentions the lead in one clause). |
| k = sum(perfect)/sum(actual), indicated = assigned/k | lesson 4 + check (300/306 -> 51.0) | Correct, direction right, verified by the k-bot (errors drop 39 -> 6). Omits: a single 50-mph k does not extrapolate to 25 mph on the stock speedo (Gold residuals -10..+10 s), daily redo, use cumulative Column C not interval sums (PT-02 84 s trap). |
| "1 % = 9 s per 15 min" | lesson 4 | Correct. |
| 10 % over for 10x, 20 % over for 5x | lesson 5, Reference | Exact when 10x/5x are **real (watch) seconds**: 1.1v for 10d s gains exactly d. Lesson 5 and research 03 s4.3 call it "slightly under-correcting"; that is only true if T is ghost time. |
| recovery v/5 + 1 (ghost seconds per second owed at +5 mph) | lesson 5, Reference, D14 card, rubric tips, research 07 s6 "8 s late at 35: run 40 for 64 s" | Right in ghost time, **wrong on a stopwatch**: the real-time hold is d*v/5 (56 s, not 64 s). Holding 64 s gains 9.1 s for an 8 s debt (14 % overshoot, i.e. into "early"). Rubric tips and D08's objective do not say which clock; D14 says "(ghost time)" but a learner cannot read ghost time. |
| TA vs make-up, never both | lesson 5, Reference TA entry, D08b | Correct. Missing: the car's stop/start loss at a light/train is NOT credited (PT-02: 8.9 s at 35) and a slow truck does not qualify; both are only learned in the debrief. |
| ghost: instant speed change, pause adds printed seconds, CP resets clock | lesson 1 | Correct. |
| CAMEO dot/arrow/bold/thin/dashed | lesson 3, Reference | Correct. |
| sight zone 30 s, observation stop 200 ft/60 s, early restart 60 s | Reference definitions | Presented as fact; they are [M]/config defaults (OPEN-QUESTIONS Q6) and only the footer says so. |
| "A wrong turn costs two minutes; a missed pause fifteen seconds" | lesson 6 | Not from the research (rookie wrong turn 1:05, R1.9). Unsourced number. |

No lesson/reference statement contradicts the research except the real-vs-ghost recovery ambiguity and the unsourced lesson 6 numbers.
School = 6 lessons x one check; the four-option checks put the right answer at index 1 in 4 of 6 lessons; lessons gate nothing
(unlocks are drill stars only).

## 4. Skill gaps (detail)

**P10 protocol (none).** Lesson 6 is text. Engine facts: a `call.turn` issued 60 or 20 ft before the node scores the same as an early call
(D10/D11 seeds 1-4: stars unchanged, no "Left or right?" from Dad); read-backs are not scored; the check-off is an aid. The only
consequence of callout timing is premature arming (decoy exits), which is a P8 effect. Debrief `workedTurns` measures seconds
before the node and calls anything under 1 s "late" but nothing is charged for it.

**P12 performance table (none).** `D06.rubric` = number of `note` actions (3 notes = 3 stars; the string is never read). `buildPerfTable`
is not used by any drill or UI. The answer key (7x7 stop/start table and ramp-lead table of the true car) is on Reference from minute
one, and the cockpit prints the per-line answer ("card 21.6 s", "call 35 at 31.1 s") at every rung. DRILL-010 (hidden re-randomised car at Gold)
is not implemented, so the learner memorises one Ford. There is no sanity-check-your-charts exercise (06 #8) and no 4-runs-per-speed protocol (D06 has one run per speed).

**P13 SCCA mode (none).** D14 lists P13 but its four card types are dwell-from-given-loss, s/mile, recovery seconds, stopwatch add. No CAST,
odometer factor, minutes-per-mile, hundredths-of-minute pauses, or distance/speed factor application. Either descope P13 in
REQUIREMENTS or add D19.

**P7 pre-read triage (weak).** D15 scenario has about 8 lines and 1 pause line (measured `1p` across seeds 1-3), a 10-minute pre-read,
star = coverage >= 1 and mean |error| <= 3. The brief's 220-line, 20-30-minute triage is not exercised. The UI strip supports four
highlight colours and a GO field but the engine only counts `line.annotate` (GO field `onchange`), while `annotations.coverage` also counts a
"pause" highlight: a learner who highlights but does not type GO gets 0 % in the rubric while the UI-side coverage says otherwise.

**P9 time-of-day (weak).** (a) The book row for a restart reads "RESTART. At Restart. Speed 35" and `restartTime` is not rendered anywhere in
`src/ui` (grep: 0 hits; confirmed in Chromium for D16 Bronze and Gold), while Dad says "Say go at our restart time". (b) The HUD always shows a
digital clock chip, a "PRE-READ - start in 0:59" countdown and "T - 0:59.2" overlay, the clock caption "07:59:00 - start 08:00:00", the
stopwatch caption "0:00.0 stopped - bezel 0.0 s (0.0 to go)" and a numeric speedometer caption, at every tier.
Great Race legal mode has one analog clock, no digital, odometer covered. So "read the minute hand twice" never applies.

**P1 dial reading.** D02 is missing from the registry (Home lists it, silently absent). Nothing requires reading the 1/5-s dial.

## 5. Feedback loop quality

Strong: per-CP table; per-stop "ideal dwell 20.2 vs yours 20.3"; CF rows that replay the learner's own action log
("call go at card dwell: 54 -> 5", "exact card: 54 -> 4", "full TA: 60 -> 0"); bias-vs-noise table; D08b headline (declared vs
qualifying vs credited vs error). Naive -> technique is a one-retry lesson in D03.

Defects that teach wrong lessons (ordered by harm):

- **W1 Two tips, usually conflicting, and the prominent one is mostly wrong** (section 2.2). `tip = bias.tip ?? bucketTip`, and the turn
  row's mean (about -25 s, "seconds before the node") outranks every seconds-of-error bias by magnitude, so "call 150 ft before the
  decision point" wins whenever a leg has turns, including a perfect run and including legs where the stop bucket is +51 s. Sibling report corroborates.
- **W2 Recovery read as speedometer error.** `cruise` bucket negative/positive from deliberate +5/-5 mph recovery becomes "your speedometer
  reads low / call half a mph less" (engine tip and `FIX.cruise`) in D04/D08/D11/D12 on a perfect Timewise speedo. This punishes the exact P6 skill.
- **W3 Restart/hold counted as a stop.** D16 and D07 worked arithmetic lists "Stop at line 9: pause 0 minus loss 9.8 = ideal 0.0; you waited 232.0 s -> +241.8 s",
  and D16's tip says go calls average 230.8 s late.
- **W4 Compound STOP+timed worked rows wrong.** D04 seed 4: "Timed change at line 4: T = 45, call at 43.6; you called at 65.6; +22.0 s" and "-33.4 s" for
  correct play (the VM ignores the 15 s pause / ghost departure that is the lesson).
- **W5 Rubric tip for off-course by eager arming** names driveways/gravel, not "you armed the turn while an earlier real road still matched" (Dad's line "No right here, staying on" is in
  the log only); no worked row shows where Dad turned vs where you meant.
- **W6 Pace bar at a stop** (PT-02 BUG-10, still present): at wheels-stop on a 30 s pause Bronze shows "-21 s" counting up to 0
  (measured; `pace()` = -21.0, -18.0, -15.0 ...). A learner who waits for 0 dwells the full pause = the rookie result (+15..+20 s per stop).
- **W7 Stars vs skill:** D05, D10 (naive 2 stars), D07 Bronze (no-k 3 stars), D15 (any annotation 2 stars), D16 (rookie 1-2) pass gates without the skill.

Other: `D18` Bronze can give 0-1 star for flawless play plus an honest TA (7/20 seeds <= 1 star) because 10-11 s of uncredited stop/turn
loss cannot be recovered in 5 minutes; the objective does not say the light's stop loss is yours to recover.

## 6. Progression sanity (stuck? too easy?)

- Unlock graph (code): D01, D03-D10, D14-D17 open from the start; D18 needs D03, D04, D05, D08, D10 at >= 2 stars; D11 needs D18 >= 1 and D07 >= 2;
  D12 needs D11 >= 1, D15 >= 1, D16 >= 1; D13 needs D12 >= 1. Stars are the best over ANY tier (sibling: not per tier).
- Too easy at the gates: D05 (naive 2-3 stars), D10 (any non-off-course run 2 stars), D15 (annotate anything), D16 (rookie 1-2 stars), D07 (no k passes at
  Bronze/Silver). So a learner can reach D12 without P4, P5(Bronze), P7, P9.
- Stuck risk: the first D18 (Bronze, rung 1: no pace bar) and the first D11 (no card for turn losses; sibling measured +43 s) are the walls. A flawless D18 can still earn 0-1 stars on 35 % of seeds; "Next seed" fixes it but nothing says so.
- Time budget for two weeks (~30-45 min/day, 7-10 h): one pass of D01-D11 + D14-D18 is about 126 nominal minutes (real: 1.3-2x at 1x); three tiers about 6 h; D12 is 268-306 sim-min
  (about 70 min at 4x adaptive per sibling); D13 (1500 min) is not reachable. Realistic outcome: all of D01-D11 at Bronze/Silver, D11 Gold, 1-2 D12 attempts.
- No readiness meter / skill map to P1-P12, no daily set, no division ladder (grep readiness|daily|streak|ladder in `src/ui`: none). The learner cannot see the weakest skill; cards only list "P2 P12" tags.

## 7. Top 10 fixes ranked by learning impact (spec style)

1. **DEBRIEF-005 (tip integrity).** `Fix this next` SHALL come from one function whose inputs are the net per-leg error and buckets whose sign agrees with it; if the mean absolute leg
   error of a run is <= 3 s the tip SHALL be "Clean run" (no maneuver advice); a negative `cruise` bucket while `ledger != 0` or the called speed exceeds the assigned speed SHALL be labelled "recovery" and never produce
   a speedometer tip; the turn-callout statistic SHALL be a candidate only when a callout was absent or later than 150 ft/1 s before the node; `rubrics.headlineTip` SHALL be removed and `rubric.feedback[0]` SHALL
   equal the debrief tip (one tip, not two); post-last-CP tail excluded. Acceptance: re-run section 2.2 and get >= 12 of 14 right.
2. **UI-014 (restart time).** Every `restart`/lunch row SHALL print its out-time in the text and Column C ("OUT 09:05:05"), Dad's line SHALL repeat it, and restart/hold waits SHALL be excluded
   from `workedStops`, `biasNoise.stop`, `counterfactual cardDwell`, and tips (new `hold` bucket). Without it D16 and every stage lunch are unwinnable for a UI player.
3. **UI-015 (analog fidelity).** At rung <= 1 the cockpit SHALL hide: digital clock chip and clock caption, the pre-read countdown digits, the stopwatch digital caption and bezel-remaining number,
   the speedometer numeric caption. Digital aids remain at rung 3 (Bronze) only. D16/D17 SHALL then require reading the clock/bezel.
4. **UI-016 / DRILL-010 (answer sheet).** The per-row "card X s" strip and the lapboard "PERF CARD FOR THE NEXT LINE" SHALL show computed answers only at rung 3; at rung <= 2 they SHALL show only entries the
   learner stored via `card.set`; Reference SHALL show the true table only until D06 is passed once, then collapse to the learner's own; Gold SHALL re-randomise the hidden car (`a0`, `aDec`, `turnSpeedMph`) per seed so the
   table must be read, not memorised. Also fix: pace bar at a stop SHALL display the countdown to ghost departure, not -(pause) (PT-02 BUG-10).
5. **DRILL-014 (D06 grades the model).** D06 SHALL provide structured entries (stop/start loss per in/out pair, ramp time per pair, >= 4 runs per speed) and grade RMS error vs `buildPerfTable(car)` (3 stars <= 0.5 s),
   with a sanity-check variant that injects one implausible row (brake loss > accel loss) the learner must flag. Stars SHALL NOT count notes.
6. **DRILL-015 (P3/P4 scored on the skill).** D05 stars SHALL use mean absolute per-sign lead error (the `landmarks` rows) with Gold scaled by driver noise; D04 SHALL score the change-point error per timed
   segment and SHALL compute compound-line `correctCall` from the ghost departure (pause included) so correct play no longer shows +22/+48 s; add a School lesson "Timed segments and leads: 34 not 36" (P3/P4 have none).
7. **DRILL-016 (calibration must matter).** Bronze/Silver Timewise gain error SHALL be >= 2.5 % (>= 20 s uncorrected over the 15-minute post-restart leg) so a skipped k fails the D11 gate; D07 star thresholds SHALL be relative to
   that; the calibration lesson SHALL state the daily redo, cumulative-not-interval, and that a 50-mph k does not extrapolate on the stock speedo; D17 SHALL log "elapsed re-derived from clock" (a `note`/ledger check) so the reset has an effect.
8. **DRILL-017 (D15 is a triage drill).** D15 SHALL use a 40-line book with >= 8 pauses and 5 speed changes and a 20-minute pre-read; stars SHALL grade GO-text accuracy (|annotated dwell - ideal| <= 1 s) and
   count the "pause" highlight as coverage in the engine as well as the UI; empty text SHALL NOT count.
9. **DRILL-018 (P8 depth).** D09 SHALL draw 20 distinct cards from the 24-card `traps.ts` library, include `Acute left/right` and `Jog` options and a "Stop and ask" option, remove cards whose answer is printed in the prompt
   (5 of 10 today), and track misses by category; D10 SHALL add T-vs-not-a-T, quoted-sign, dead-end "1st paved road" and an off-course worked row ("Dad took the first matching real road at line 3; you armed it 1,400 ft early");
   the eager-arming tip SHALL name that cause. Correct the recovery rule everywhere to the stopwatch form: "+5 mph for d*v/5 s (ghost time d*(v/5+1))" and state that the 10 %/20 % rule is exact on the watch.
10. **DRILL-019 / PROTO-001 (P10, P13, P1).** Score the protocol: a turn called < 150 ft before the node or after Dad asked SHALL cost a hesitation (Dad "Left or right?" + 3 s) and appear in the debrief; read-back/check-off
    accuracy SHALL feed D11 stars; add D02 (analog dial reading, 1/5 s) and either D19 (SCCA odometer/CAST/minutes-per-mile/hundredths-of-minute pauses) or descope P13 from REQUIREMENTS section 2; fix the D12 card to 270-310 min and D13 to its real length.

Also (smaller): lesson 5 and Reference state that a light's stop/start loss is not TA-creditable and a slow truck does not qualify; lesson 6 numbers sourced or removed; per-tier stars and a readiness meter by P-skill (sibling #5);
D18 gate fairness (cap hazard at 15 s or accept 1 star for TA + clean execution); mark Reference sight-zone/observation/early-restart numbers [UNVERIFIED].

## 8. Appendix: how to reproduce

`npx tsx playtest-scripts/edu-matrix.ts D03,D04,D05,D07,D08,D08b,D10,D15,D16,D17,D18,D11 0,2 1,2,3 oracle,rookie,noPause,goCount,lateCall,random,oracleNoRec`
(section 2.1 base data); `edu-debrief.ts` (section 2.2 tips, CF rows); `edu-skills.ts` (k-card, honest TA, annotation, D01 jitter);
`edu-ta.ts`, `edu-fair.ts` (20-seed fairness); `edu-traps.ts` (eager/late turn arming, D10 text-vs-route audit: 0/312 mismatches, PT-02 BUG-2 fixed);
`edu-ui.ts` (needs `vite preview --port 4173`; shows restart text, "card" strips, digital readouts).
PT-02 items verified fixed: BUG-1 driver messages (now `driver` events), BUG-2 D10 text, BUG-6 D07 restructure (restart + 15-min leg), BUG-9 `passed` events, BUG-14 stubs (quiz screens),
D08 hazard sizes, Gold threshold scaling. Still open: BUG-3 (rubrics.ts tail), BUG-4 (restart attribution), BUG-10 (pace bar), BUG-7 (CP inside timed segment; D04 stock oracle),
BUG-11 (restart time), D06 rubric, DRILL-010, DRILL-011.

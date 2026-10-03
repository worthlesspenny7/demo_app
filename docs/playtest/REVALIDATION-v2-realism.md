# REVALIDATION - V2 realism against the Rookie Handbook and the 2026 Event Regulations

Validator: independent realism agent, 2026-10-03. `src/` and `tests/` untouched, nothing committed.
Ground truth: the two PDFs (read page images where the extraction was ambiguous: HB pp.26-30 Appendix D, pp.31-47 Trophy Run;
Regs pp.13-15 and Example Rally pp.27-28) plus docs/research/08, 08b, 09. HB = Rookie Handbook, REG = 2026 Event Regulations.
Scripts: `playtest-scripts/v2-*.ts` (engine: a..k, charts, drills*, d16-clock, book-dump; UI: ui-shots, edu-ui, edu-ui2, edu-check).
Screenshots: `docs/playtest/screenshots/v2-*.png`. Baseline checks: `npx vitest run` 340/340, `npx playwright test` 34/34, build clean.
Method: oracle bot on generated day stages (seeds 1-8) and D16/D08b/D07/D15/D06/D11/D12/D13/D17/D18; scripted probes on
ScenarioBuilder courses for the caps; direct `act()` probes for TA; Playwright (Chromium, vite preview :4176) for the UI.

## 1. Rubric (same 14 rows, 0-5), previous 47/70 -> now 54/70

| # | Dimension | Was | Now | Evidence |
|---|-----------|:--:|:--:|----------|
| 1 | Instruction format / vocabulary | 3 | 4 | Five columns (number, A, B, C, D); Column C stacks match HB p.25-29 line for line: `0 MPH / 0m15s / 40 MPH`, `45 MPH / 1m26s / 55 MPH`, `CDT 8:53:00 / 30 MPH`, `24m00s / 50 MPH / * 0m00.0s`, box `2m43.3s / 2m43.3s`, `(9m00s)`, `(1h25m00s)`, `(45m00s)`, `(3m00s)`. Column B icons with the 4-digit odometer box (`0080`, `0156`, `0045`, `0139`). Column D sentences follow the Example ("Pass a sign on your right reading in whole or in part '...'", "Pause 15 seconds, then change average speed to 30 miles per hour."). `race` style leaves D to remarks ("Look sharp", "Comes quick") like the 2014 Trophy Run. Still missing: street names and landmark pictures in Column A, the "(0m30s) time to the end of the transit" line, clock-face/crossed-watch icons in Column C, speed omitted on real sheets (about 9 %) but only 2 % of generated rows, 6 rows per page (real 6-9). See section 4. Screens: v2-21..26. |
| 2 | Ghost-car timing | 5 | 5 | Oracle on generated stages: 7 legs, errors 0, -1, 1, 7 (train leg), 1, 0, 1 = raw 11 (seed 1); D16 oracle 0 s on every leg; restart anchored at `base + ASP` (E1). Leg reset at each checkpoint matches HB p.13 "automatically on time the instant you reach a checkpoint". |
| 3 | Stop / pause arithmetic | 4 | 4 | Chart (b) for PACKARD_1936 matches the handbook in all 64 cells; Ford is exactly `15 - accel(in>0) - accel(0>out)` in all 81 cells (7.4 s at 35>35, previous R07 7.7). Pause printed on 85 % of STOP rows (378/445 over 8 seeds), 0 % on signals and RR crossings (Trophy Run printed one signal and one blinker, Example #15 a blinker). Every generated pause is 15 s (HB p.8 says it "may be different"). Pause printed iff Column C stack present: 0 mismatches. |
| 4 | Timed segments | 4 | 4 | 4-6 per stage in the `45 MPH / 1m26s / 55 MPH` form, delayed form `1m12s / 40 MPH` supported (GRIID-008); oracle holds them to 1 s. Real Trophy Run has them at about 1 in 20 rows; here about 1 in 35. |
| 5 | Calibration run | 3 | 4 | Official times to 0.1 s: printed vs computed (distance / 50 mph) max difference 0.08 s over 34 points; cumulative column consistent (2m43.3 + 4m41.4 = 7m24.7); asterisk start row; run 15.6-19.8 mi (REG V.B.2.a: at least 15); 3-5 points (HB example 3, Trophy Run 12); official time rounded up and transit allowance +2-5 min (V.B.2.c); not scored. Timewise maths verified: 4315, 1723.2 s vs 1727.3 s -> 8.2 s/h, 1.2 clicks/s/h, 10 clicks, 4305 (HB App. C). Only one assigned speed (50) although V.B.2.b says different speeds may be given. |
| 6 | Checkpoints and scoring | 4 | 5 | Late cap 120 s (570 s late and 1168 s late both = 120, `capped`), early cap 300 s (568 s early = 300), missed checkpoint 180 s, more than 30 min late = missed (1894 s late, then the next CP also missed under V.C.2.b(2), final timing CP -> DNF), observation stop missed 180 s, sight zone 4 mph = +30 s, early lunch departure 60 s then 300 s, age table 55/55 rows equal to REG V.D, discards 3/4/5/6/5 pooled over stages 1-7, stage 8-9 whole. All caps and penalty values as printed on REG p.14. |
| 7 | Hazards and time allowances | 3 | 4 | TA only at a printed TA point, 15 min window (refused after), multiples of 10 s (77 -> 70 when measured 58), max 29m30s (1780 refused), wrong leg and reversed instruction numbers refused, committee credit = measured - recoverable (credit 45 s of 70 requested, reason printed), tractor never qualifies. Trains 14 / 8 stages (D13 0-2). Weak points: signals credit by default although V.H.1 names only trains and accidents; credit can be 45 s (not a multiple of 10); the TA is filed in a form (REG V.H.3: cell phone; Example #18: web page + QR). |
| 8 | Driver behaviour / callouts | 3 | 3 | Not re-tested in depth. "Stopped", "At 50", "Leaving 3 s early", read-backs present; STOP signs always obeyed (V.E.3.e). Late-turn forgiveness and "call 150 ft out" unchanged from the previous report. |
| 9 | 1939 Ford physics and stock speedo | 4 | 4 | Ford charts self-consistent and monotone (0>40 5.2 s, 40>0 3.7 s, 30>40 stop and go 7.1 s). The Ford turn chart is much worse than the Packard (40 in/35 out 7.0 s vs 4.0 s) because the Ford apex is 12 mph (CHART-003); no handbook number to check it against. Stock-speedo error 1 % = 36 s/h consistent with HB p.3. |
| 10 | Traps and CAMEO visuals | 3 | 3 | Dot/arrow/bold/thin/sign box/STOP octagon correct (v2-21). Landmarks are grey captions ("cemetery on L"), not pictures; roads are unnamed; every Column A carries a pill tag ("STOP", "CAL 1", "END TIMED") that no real sheet has. Trap library unchanged. |
| 11 | Stage structure | 3 | 4 | Skeleton equals the Example Rally: start + warm-up (20m00s, 8 mi) -> calibration -> transit -> time-of-day restart -> timed -> End timed portion -> TA row -> hosted meal and rest stop inside a transit -> restart -> free zone -> End timed + end-of-stage TA -> finish (rows 1-12, 113-119, 195-198 of seed 1). D12/D13 use a 30 min pre-read and an ASP (80, 4, 2, 3 for seeds 1-4); `#/cockpit/builtin/stage/N` still uses ASP 0 and a 30 s pre-read. 142-155 mi and 167-198 rows per stage; no in-stage "take exactly 20 minutes" transit outside D16. |
| 12 | Score realism (bot ladder) | 2 | 3 | The default `runBot` cap is now 12 h (a full stage is about 9 h), so the CLI no longer truncates. Oracle 5-11 raw s/day at Bronze (expert benchmark); noPause bot 104-171, rookie bot 470-506 (D12 Bronze). Caps keep a bad leg at 120 s so the ladder is bounded, but there is still no bot between "champion" and "10x a real rookie" (20-46 s). Oracle at Silver/Gold full stage 226-544 s because it never calibrates the stock speedo. |
| 13 | Lesson / reference accuracy | 3 | 4 | Dynamic numbers all render (no NaN), Packard tables, age table, penalty table, Column C table, speed-change table, TA steps, calibration worked example, Four S's quotes all match the documents. Eight slips, all low or medium, in section 3. |
| 14 | Instrument realism | 3 | 3 | Default digital stopwatch with lap/split, 1/100 s, interval over cumulative laps, frozen split with 5 s auto-release, recall, TOD mode, reset only when stopped (WATCH-008, v2-09) is exactly HB p.5. But the cockpit prints a numeric time of day under the analog clock (v2-02) and Settings offers "Digital readout (optional)" for the clock, both prohibited by REG II.H.1.d(1) ("The clock must not have ... digital readout"). |
| | **Total** | **47** | **54 / 70** | |

## 2. V2 spec ids exercised

| Spec id | Result | Evidence |
|---|---|---|
| REG-001 | PASS | Builder course, 10 mi leg: 20 mph -> err 570, pen 120 capped; 15 mph -> 1168, 120; 55 mph -> -568, pen 300 capped; 11.5 mph -> 1894 s late = missed 180, CP2 missed, `dnf true` "The final Timing Checkpoint was missed (V.E.2.b)"; mid-run `result()` -> 180 per remaining leg. |
| REG-002 | PASS | `ageFactor`: 1953 .915, 1941 .855, 1939 .845, 1936 .830, 1930 .800, 1929 .790, 1926 .760, 1900 .500; reference table 55 rows, 0 mismatches vs REG p.13; D06 Bronze (Packard) x0.83, Ford stage x0.845; scorecard "Raw 4 s x 0.845 = 3.38". |
| REG-003 | PASS | `championshipTotal`: discards 3/4/5/6/5 for grand/expert/sportsman/rookie/xcup pooled over stages 1-7 (70,60,50... removed), stages 8-9 kept whole, age-factored total to 0.01. |
| REG-004 | PASS (partly) | `compareStandings`: equal totals, older Scoring Year first (-11). Trophy Run position tie-break NOT TESTED. |
| REG-005 | PASS (partly) | Sight zone 4 mph within 400 ft of CP: pen +30; promoted stop left 6.7 min early (lunch) and rest stop: 60 then 300 (penalty 360); observation CP not stopped: +180. "Skip the STOP" refusal NOT TESTED (no such command found; a no-pause STOP releases on `call.go` and the driver always stops). |
| REG-006 | PASS | 8 seeds, 1514 rows: pause present in the book iff `0 MPH` stack in Column C, 0 mismatches; 85 % of STOP rows print a pause. |
| TA-001 | PASS | Request 77 s with measured 58 s -> "1m17s adjusted to 1m10s"; 80 -> 80. Rounding rule is the sim's own (REG V.H.6 says "to the possible detriment"). |
| TA-002 | PASS | Refused: before any TA point ("only at a printed TA point"), after the window (mid-stage TA point, 5 s after 900 s), 1780 s ("may not exceed 29m30s"), leg 7, from > to, 0 s. End-of-stage `scorecard.ack` recorded. |
| TA-003 | PASS (note) | D08b seed 3: requested 70/80/120/300, measured 58, recoverable 13 -> credit 45 s, `taOverDeclared true`, reason "Allowed 0m45s of 1m10s requested: measured delay 0m58s, 0m13s could have been made up". Credit is not a multiple of 10. |
| TA-004 | PASS | Train/accident only; D08b leg 2 tractor (+29.7 s hazard) gives no credit. Signals credit by default (see section 5). |
| TA-005 | PASS | UI form (v2-13/14): measured/recoverable/suggested table, "0m47s adjusted to 0m50s", "Delayed 1m29s. Made up 0m29s. Request 0m50s." |
| TA-006 | NOT TESTED | |
| GRIID-001 | PASS | v2-21/22: number, A, B, C, D. |
| GRIID-002 | PASS | Stacks listed in rubric row 1; calibration start `24m00s / 50 MPH / * 0m00.0s`; box interval over cumulative; transit `(9m00s)` / `20m00s`; restart `CDT 8:53:00 / 30 MPH`. Missing the `(0m30s)` guide line on the row before a transit end (HB #11). |
| GRIID-003 | PASS | Icons for warm-up, calibration, transit begin/end + odometer digits, free-zone begin/end, end timed, TA, meal, rest, finish (v2-23/24). Crossed-watch drawn in Column B; the HB/REG pages draw it in Column C. |
| GRIID-004 / 009 | PASS | Example wording and `race` vs `example` style verified on seed 1 rows 1-30, 113-119. |
| GRIID-005, 006, 007 | NOT TESTED | (lettered/omitted rows, completion moment, speed-change position; 007 indirectly covered by oracle errors <= 1 s.) |
| GRIID-008 | PASS | Timed and delayed segments held to <= 1 s by the oracle. |
| STAGE-001 | PASS | Skeleton as in rubric row 11. |
| STAGE-002 | PASS | asp 37 and 95: restart row prints base 8:51:00, `restartTime` = base + 37 min and + 95 min, oracle leaves 3 s early (the standing-start lead), 0 error; restart card "base 08:53:00 + ASP 0 min = your time 08:53:00, leave at that second, do not pull up before your minute" (v2-06). |
| STAGE-003 | PASS | D16 seeds 1-6: OUT - IN = 1200 s every time (IN 09:55:14 -> OUT 10:15:14, hour rolls in seed 2); leaving 60 s early / 45 s late changes the next leg to -26 / +22 for a truth-chasing oracle; 2-min free zone after each transit enforced by `validateScenario` (course.ts:345-358). |
| STAGE-004 | PASS | One free-zone pair per stage (rows 178-186 seed 1). |
| STAGE-005 | PASS | Lunch `(45m00s)` leave = restart - 45 min exact; early departure rule above. |
| STAGE-006 | PASS | See rubric row 5. |
| STAGE-007 | PASS (note) | Speeds seen 20-55 in steps of 5 (histogram 20:90 25:119 30:223 35:303 40:213 45:189 50:182 55:121); 15 never generated although the spec says 15-55. |
| STAGE-008 | NOT TESTED | Backlog. |
| CHART-001 | PASS | Three charts, IN rows x OUT columns, accel includes 0 row/col; overlay v2-04 highlights the current pair. |
| CHART-002 | PASS | PACKARD_1936: 200 cells (accel 72, stop & go 64, turns 64) compared with HB 3a/3b/3c, 0 mismatches. Packard has no 55 row/column (neither has the handbook). |
| CHART-003 | NOT TESTED | Only the Ford apex 12 mph chart value (40>35 = 7.0 s) was read, not measured against a driven turn. |
| CHART-004 / 005 | PASS | `timewiseAdjustment(4315, 1723.2, 1727.3)` = 8.2 s/h, 10 clicks, 4305 (exact 4304.76); Reference quotes the three rules and the formulas. |
| LESSON-001..006 | PASS (slips) | All 11 lessons render with no NaN/undefined; slips in section 3. |
| DRILL-021 (D16) | PASS (note) | Oracle 0 s; 3 stars needs a clock glance within 60 s of each departure and at the transit IN: the shipped OracleBot reads once, gets 2 stars (3 clock findings); with a clock read every 20 s it gets 3 stars on seeds 1-3. |
| DRILL-022 (D08b) | PASS | Oracle 3 stars all tiers (29 s raw, credit 45 s), rookie and noPause 0. |
| DRILL-023, 024, 026 (D06, D15, D01/D07 note grading) | NOT TESTED | Need typed notes; bots score 0 by design. |
| DRILL-025 | PASS (note) | Oracle 3 stars at D12/D13 Bronze (raw 5-13 s) and D11/D18; rookie 0; Silver and Gold D12/D13 oracle 0 stars (226-544 s) because it does not calibrate the stock speedo. STATUS claim "oracle 3 stars, naive 0 on every rebuilt drill": FAIL for D16 (oracle 2, rookie 2, noPause 2). |
| CAMP-001 | PASS (partly) | Discards, ASP per D13 seed (80, 4, 2, 3), Stage 0 outside the total (`trophyRunCounts false`). Standings vs benchmark teams NOT TESTED. |
| UI-029 | PASS | v2-02, v2-20..26: 6 rows/page, "Page 1 of 33", stage title, "CDT - ASP 0". |
| UI-030 | PASS | v2-04: (a) accel 0..55, (b) stop & go, (c) turns, current pair highlighted; stop card reads "Chart (b) Stop & Go: 50 in / 35 out". |
| UI-031 | PASS (note) | v2-13/14. The "Use" buttons are clipped at the right edge of the form at 1366x800 and the form covers the ledger and part of the watch. |
| UI-032 | PASS | Restart card, promoted-stop card (v2-07), exact-transit OUT card "IN (read the clock at the sign) + 20m00s = OUT" (v2-12; generic, does not show the recorded IN). |
| UI-033 | FAIL vs REG | Defaults are right (digital stopwatch, analog clock) but a digital clock readout is offered and a numeric time of day is always shown under the analog clock; REG II.H.1.d(1). |
| UI-034 | PASS (note) | Scorecard v2-15: perfect/actual/error/TA credit/penalty per leg, cap note, raw, age factor (1939), stage score 3.38 s. The debrief page is 24,814 px tall at 1366 wide (events/ledger dump). |
| WATCH-008 | PASS | Engine: lap table interval/cumulative (11.3, 8.1, 12.5 s), frozen split auto-releases after 6 s, TOD mode reads rally time, reset refused while running; UI v2-09 (SPLIT frozen, L3/L2/L1 boxes). |
| WATCH-009 | PASS (note) | All four kinds fire: `clockForTimeOfDay`, `calibrationWithoutLap` x6 (no laps), `lapWhileFrozen` (double lap), clean when laps + clock reads. False positives: line 5 (calibration run start) and line 195 (end-of-stage transit) are treated as exact-transit IN lines. |

## 3. Factual slips in the lessons and reference

| # | Where | Says | Correct (citation) | Severity |
|---|---|---|---|---|
| 1 | Reference, CAMEO legend ("A red light may qualify for a Time Allowance"); lesson "Early, late and the 10 % rule" ("Trains and traffic lights may instead be declared as a Time Allowance") | Lights qualify | REG V.H.1 names a train blockage and assisting at an accident; lights are not named (09 TA-002). The Four S's lesson and the TA steps on the same page list only those two. | Medium |
| 2 | Reference, rules summary: "one analog speedometer, one analog time-of-day clock, one stopwatch; calculators and phones prohibited" | Phones prohibited | REG II.H.1.i: a cell phone is allowed for emergencies and for submitting Time Allowance Requests; II.H.1.d(3): the stopwatch may be digital or analog with split/time-of-day; II.H.1.d(2): analog wristwatches allowed. | Low |
| 3 | Lesson "The GRIID page": Column B lists "end of the timed portion (crossed-out clock)" | Column B | HB p.27 (#17, #34) and REG Example #17 draw the crossed-out watch in Column C, above/beside the transit time; Column B holds the hourglass and odometer box. (The extraction doc 08 section 8 has the same slip.) | Low |
| 4 | Lesson "The GRIID page", check explanation: "An exact transit prints its interval without parentheses" | Plain = exact | REG VII.B.3.c(4) only defines parentheses = advisory. Example #10 (`9m00s`) and #34 (`30m00s`) are plain but not "exactly"; the one that must be executed exactly is #30 "take exactly 20 minutes" (HB p.29). HB p.11: an end-of-stage transit is "a guide". The engine copies the slip (calibration run and finish transit flagged exact, see WATCH-009). | Medium |
| 5 | Lessons Four S's and reference TA steps: "file at the TA point (the yellow box)" | Means unspecified | REG V.H.3: "by cellular telephone to the Great Race Scoring Crew" (highlighted); Example #18 (2026): full-width yellow row "Within 15m00s, go to https://www.grscores.com/timeallowance" with a QR code; HB Example #35 (2014): at the Observation Checkpoint. "Within 15 minutes" comes from the Example, not V.H.3. | Low |
| 6 | Lesson "The GRIID page": Y = fork, "bear", "acute", "jog" definitions; Team protocol glossary | Stated as regulation/handbook fact | Neither document defines them (REG glossary has no T/Y; HB p.15 only gives "soft right curve"). Label as team vocabulary. | Low |
| 7 | Lesson "Team protocol" rule 10: "call turns 500-600 ft out", "a recorded rookie wrong turn cost 1:05" | Presented as rule | Not in HB or REG (older research docs 03/04). | Low |
| 8 | Lesson "The ghost car": "a car that slows down is actually slightly ahead of the ghost" | Gain on deceleration | HB p.7 chart (a) books a net time loss for every speed change including every deceleration (50>30 = 1.4 s lost, 40>15 = 1.4 s); the Ford chart does too (50>30 = 1.2 s). | Low |

Checked and correct: Four S's quotes and priorities (HB p.13-14), 10 % rule and lost-time formula (p.10), speed-change split at the sign (p.12) and VII.E.2.b-d, penalty table (V.E.1-3), caps 2/5/3 min, age factor 1939 0.845, TA multiples of 10 s up to 29m30s and wording pattern (V.H.3-6), ASP 42 -> 12:42/12:12 (App. E), lunch 2:55:00 + 12 = 3:07:00 - 0:45 = 2:22:00, refuel 3h10m / pit 2h10m / rest 3 m (REG Example #19-22), 2-minute free zone (VII.C.5.c), Packard 30>40 = 8.6, Timewise example (App. C), "1 % = 36 s/h" (p.3), instructions 30 minutes before the start (VII.B.2.a).

## 4. Remaining differences from the real GRIID page (HB p.25-30 and 2014 Trophy Run p.33-55)

1. Column A: no street names ("Buchanan Blvd", "Kennebunk"), landmarks are grey captions not pictures (courthouse, church, cow), every sign box has a pill tag ("STOP", "CAL 1", "END TIMED") that the real page does not; the arrow is always straight up in the sheets except turns; row 1 has no landmark picture.
2. Column B/C icons: the real restart row shows a watch-face icon with "EDT" above the time and the speed under it (v2-22 shows plain monospace "CDT 8:53:00 / 30 MPH"); end timed portion puts the crossed watch in C; the calibration row shows only the speedometer face and odometer box, here it also carries an hourglass; real odometer box has the last digit white-on-black (here too, small).
3. Missing guide lines: "(0m30s) time to the end of the transit" on the row before a transit end, the "enter exact arrival time ___ + 30:00 / exact departure time" fill-in blanks on a timed transit (Trophy Run #65, #70), round-cornered full-width info boxes (Trophy Run #86, #89: reception and next-day information) and the full-width yellow TA row (REG Example #18, with URL and QR).
4. Column D in race style: real rows carry fuel and food lists, "1st paved road", "turn into middle lane", toll amounts; generated rows only "Look sharp", "Comes quick", "Follow this Curve Warning Sign".
5. Speeds: real sheets omit the speed on about one row in ten (Trophy Run #40, #53, #57, #73, #74 written in by hand); generated rows omit it on 2 %, so the "write every speed not shown" habit is practised only in D15.
6. Pauses: real sheets print `0 MPH / 0m15s` on every STOP, one signal and a blinker; generated stages print 85 % of STOPs and never a signal or RR; no non-15 s pauses.
7. Page density: real 6-9 rows per page, 13 pages for 88 rows (Trophy Run); here 6 per page, 28-33 pages for a stage; page header "Hemmings Motor News Great Race" and event date missing; the page number is printed top outer corner on the real sheets.
8. Calibration: real Trophy Run has 12 points over 24 mi and the Example 3 points over 21 mi at 50 mph with a stated "official time"; generated runs have 3-5 points, one speed.
9. Transits: no in-stage "take exactly" transit on generated stages (Trophy Run #65-70, Example #30-32); the end-of-stage transit is printed exact (`26m00s`) as in Example #34.
10. Stage length and speeds: 142-155 mi and speeds 20-55; the Trophy Run used 20-45; 15 mph is never generated.

## 5. Ranked fixes (small, concrete)

1. REG II.H.1.d(1): remove the "Digital readout (optional)" clock choice from `src/ui/screens/settings.ts` (CLOCK_NOTE) and drop the numeric time of day printed under the analog clock in the cockpit (or show it only in debrief). Same for the numeric indicated-speed readout under the speedometer if aids rung 0-1 (II.H.1.h(2) digital speedometers prohibited).
2. TA and lights: set `rules.taForSignals` default to false (or cap credit at what the committee would allow) and fix the two sentences (Reference CAMEO legend, lesson "Early, late and the 10 % rule") to the V.H.1 wording; keep signals as an option labelled "committee discretion".
3. Instrument discipline false positives: do not treat the calibration-run transit (line 5) and the finish transit as exact-transit IN lines in `sim.ts` instrument checks (HB p.11, Example #10/#34); fix lesson slip 4 in the same commit. Also give `OracleBot` a clock glance every 20 s and a lap at each calibration point so the shipped oracle reaches 3 stars on D16/D12 and the "oracle 3 stars" claim becomes true.
4. D16 does not discriminate (oracle, rookie and noPause bots all 2 stars): add a naive bot that leaves a restart on the wrong minute (or ignores ASP), and make the exact-transit card show the recorded IN time ("IN 09:55:14 + 20m00s = OUT 10:15:14").
5. Book realism, cheap wins in `generate.ts`/`griid` renderer: omit the speed on about 10 % of non-change rows; print the `(0m30s)` guide before transit ends; put the restart watch icon and crossed watch in Column C; render the TA row as a full-width yellow banner with the "Within 15m00s" text; allow 7-8 rows per page; print 15 s pauses on one signal/blinker per stage.
6. TA credit: round the committee credit down to a multiple of 10 s (REG V.H.3), and keep the "reason" text.
7. Debrief: cap the page height (collapse the per-event tables, the page is 24,814 px at 1366 wide) and keep the scorecard table plus TA/instrument sections at the top.
8. `#/cockpit/builtin/stage/N`: use an ASP and the 30-minute pre-read like D12/D13.
9. Lessons: fix slips 1-8 (section 3); citations are in the table.
10. TA form: stop the "Use" buttons clipping at 1366x800 (v2-13).

## 6. Verdict

Yes, with fixes. The engine now reproduces the regulations to the second: scoring caps and the missed-checkpoint, 30-minute and DNF rules, age table, TA procedure, base + ASP restarts, exact transits, free zones, calibration official times to 0.1 s and the Packard charts cell for cell (200/200), and the oracle plays a 142-155 mile generated day in 4-11 s raw. The generated book is recognisably a GRIID sheet in both the example and race style. What still separates it from the real thing is cosmetic and procedural, not arithmetic: the CAMEO lacks names and pictures, the sheets are over-regular (speeds always printed, pauses nearly always), the TA is a form rather than a phone call or web page, the clock may show a digital readout (a rules violation by REG II.H.1.d(1)), and eight small factual slips remain in the lessons and reference. Score 54/70 (was 47/70). Highest-value next step: fixes 1-3.

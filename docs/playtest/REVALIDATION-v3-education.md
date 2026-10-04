# Re-validation v3: education (do the lessons and drills teach a first-time team the Great Race?)

Validator: independent EDUCATION pass, 2026-10-04, build at HEAD bcdc8b3 plus the uncommitted PT-05/PT-06 fix sprint (engine 3.1.0).
Read-only on `src/`, `tests/`, `content/`; nothing committed. New re-runnable scripts are `playtest-scripts/reval3-*.ts` (section 9).
Predecessor: `docs/playtest/REVALIDATION-education.md` (2026-10-03, engine 1.2.0). Sources used for the fact check, in the order the
standing rules give them: `docs/research/09-event-regulations-2026.md` (sections 5, 7-14, 21), `08-rookie-handbook-body.md` (sections 3-7),
`08b` (Appendix B/C), `10-rally-school-videos.md` (section 1) and the per-video files 10a/10b/10c it summarises (to check the
`[mm:ss]` cites), `11a` (frames) for the Column D claim.

## 0. Verdict

**YES WITH FIXES for the lessons and the stay-on-time drills; NOT YET for a first morning run from Dad's card plus LESSON-004 and LESSON-006;
the curriculum order still teaches the Four S's backwards.**

| Question | Answer |
|---|---|
| Are the lessons and Reference factually clean? | Mostly. 0 transcription errors in the numbers I could check (3 Packard charts, 55 age-factor rows, REG penalty rows, Appendix C worked numbers, calibration boxes, TA rules, 30+ video timestamps). 16 slips found: 3 medium (a drill and a lesson contradicting REG V.H.5 / the Time Delay Form video; an "exact transit" rule cited to a clause that says the opposite implication), 13 low (section 1). |
| Does the lesson make the difference (naive 0-1 stars, by-the-lesson 3) at Bronze? | **Yes for 10 of the 16 drive drills** (D03, D04, D05, D06, D07, D08, D08b, D11, D12, D15; D04 only against the rookie, not the goCount variant). **No or partly for D01, D10, D16 (rookie variant), D17, D18**; D13 was not run (section 2). |
| Does the debrief "Fix this next" name the real cause? | **94 % (76/81)** on runs that lost time by the old mechanical rule (mean abs leg error > 3 s; was 97 %), **but only 71 % (78/110)** when graded strictly on the skill the naive play ignored. The misses are structural: stars that come from something other than leg error (D05, D04 goCount, D06, D15 printed pause) print "Clean run", D16 wrong-minute prints "driver wandered", and a "recover more" lecture lands on 8 of 75 three-star runs (all of D08b). |
| Is anything taught before its prerequisite? | Yes: stay-on-time before stay-on-course; leaving on time (D16, LESSON-004) after the whole timing track; D03-D05 Gold need a chart built in D06, which is neither a prerequisite nor a lesson (section 3). |
| Could a driver and navigator who never rallied run a first morning from Dad's card + LESSON-004 + LESSON-006? | **No.** They would probably (a) slow to 5 mph or stop in sight of a green sign, (b) pull up to the restart early, (c) talk or guess on the calibration run, (d) ignore a GR emergency sign, (e) not know a no-pause STOP still needs a full stop (DNF). 14 concrete lines to add in section 4. |

## 1. Fact check: lessons and Reference against the documents and the video synthesis

### 1.1 Slips (correct value and citation)

Severity: M = contradicts a document or another lesson/drill; L = overstated, mis-cited or unlabelled. Line numbers are `content/lessons.ts` unless stated.

| # | Where | What it says | Correct value / issue | Citation | Sev |
|---|---|---|---|---|---|
| 1 | `src/core/drills/d08b.ts:45` (D08b objective; the scenario comment on leg 2 says the same) | "A tractor is not a Time Allowance" | REG itself models a tractor as the TA case: "Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s." Croker: a combine at 10 mph for three miles with no chance to pass qualifies; "if you had to sit there 10 seconds, make it up". The same file's lesson (four-s, :84, :97 check question) teaches the tractor as the worked TA example. Correct: a slow vehicle you can pass or recover from is not creditable; one that holds you with no safe pass is, less what you could make up. | REG V.H.5; 10b P2 [05:43]; 10c Time Delay Form [00:04] | M |
| 2 | :164 (recovery) | "only the wait itself is creditable: the stop/start loss of braking and accelerating is not, so recover that part yourself" | No REG text says this (REG V.H is silent on the loss). The director says the opposite: measured delay = stopped time + the stop-and-go loss from your chart. The engine (`d08b.ts` committeeView, TAF-002), the rally-school lesson (:375) and `reference-data.ts` TA_FORM_FIELDS ("time") all add the chart loss, so the lessons contradict one another. | 10c Time Delay Form [01:38], [04:44]; REG V.H.1-V.H.7 (silent) | M |
| 3 | :322, :206, :211 (explain), `reference-data.ts:104` | A plain interval (26m00s, 30m00s) "is not automatically an exact transit... only Column D saying 'take exactly' makes it exact", cited to REG VII.B.3.c(4) | VII.B.3.c(4) says only "Interval times in parentheses are advisory, but not official": by implication a plain interval is official (V.B.2.c also says warm-up/calibration transit times are "included as part of the scoring time"). HB p.11-12 calls the transit after a time-of-day restart "critical ... executed exactly". "Only take exactly" is a reading of the Example, not a rule. Also "Example #30" and "Example #34" are the 2014 Handbook numbers (2026 Example Rally: "take exactly 20 minutes" is #31, "20 minutes after #31" is #33, the 30m00s transit is #35) while "#18" in the same lessons is the 2026 numbering; label the edition. | REG VII.B.3.c(4), V.B.2.c, 09 section 8.6; HB p.11-12, Appendix D | M |
| 4 | `reference-data.ts:146` CHECKPOINT_FACTS; :404 | "Wave, smile, honk, run your headlights; do not talk to the crew", doc = REG V.A.1.a(2) | V.A.1.a(2) says only "Do not stop at a Timing Checkpoint". Wave/honk/do not talk is video-only (2026 [64:10]; 2024 [70:48]); set `doc: null` / VIDEO_ONLY. | REG V.A.1.a(2)-(3); 10a | L |
| 5 | `reference-data.ts:145`; :404 | "never go slower than 5 mph (30 s)" | Penalty is for "5 MPH or slower" (exactly 5 is also penalised): "never 5 mph or less". The Four S's table row (:92) has it right. | REG V.A.1.a(3), V.E.3.a | L |
| 6 | :196 (calibration) | "The run is at least 15 miles (about 18-20 minutes at 50)" | The minimum is right (V.B.2.a) but the 18-20 min is derived and misleading: the Example Rally run is 21 mi / 26 min (#5), HB Appendix C is 28m43.2s, and the 2026 school says "35-40 min of consistent speed". The lesson's own worked tables use 25m17.8s and 28m43.2s. | REG V.B.2.a, 09 section 8.6; 10a 2026 [29:02] | L |
| 7 | :64 (ghost car) | "champions can average about one second per leg over a nine-day event" | An inference in doc 06 (49.72 s winning total over ~45-60 legs), not in the cited `docs/research/07 section 1, 4`. Label as an estimate and cite 06. | 06 line 168 | L |
| 8 | :62 | "The Great Race gives you no distances and no odometer" | No odometer is right (V.B.1.a, II.H.1.h(6)), but transit and calibration mileage is printed as "approximately N miles" in Column D and as the odometer box in Column B, which lesson 8 itself teaches. | REG V.B.1.a, 09 section 8.1 | L |
| 9 | :130-135, :264 (Rule 6), `reference` | The Ford "costs about 7.6 s" for a 35-35 stop, ramps 2.3 s, "about 4 s" standing start "(HB p.7)" | These are simulator defaults (engine: 0->30 3.7 s, 0->35 4.4 s, 0->40 5.2 s, 0->50 7.1 s; Josh's Ford is OPEN-QUESTIONS Q12/Q22, "not in this document"). HB p.7 is the Packard (0->40 = 4.5 s). Label "simulator default for the Ford until measured". | 09 Q12, Q22; HB p.7 | L |
| 10 | :207 (griid) | "on a real race sheet no sentence appears at all" | Observed on the sheets shown in the 2024/2026 sessions (frames), but the 2026 Example Rally in REG prints the full sentence in Column D on every row (REG wins; Q26). Say "on the sheets shown in the schools". | 09 section 8.1, Q26; 11a line 521 | L |
| 11 | :159 | "Stop shortening is legal only on a pause that is printed" | Unsourced. REG section 13.5: no penalty for a pause shorter than printed. What REG does say and is not taught: you "may lose time at 5 MPH (or faster)" near a checkpoint to bring a delay request to a multiple of 10 s. | REG V.H.5, 09 section 13.5 | L |
| 12 | :82 (four-s) | TA is submitted "by a web page, a phone call, or at the Observation Checkpoint" | V.H.3: cellular telephone to the Scoring Crew at the locations in the instructions; Example #18/#36: web page. "At the Observation Checkpoint" is the paper method (HB p.13 era, 2024 [116:41]) that lesson 12 calls obsolete. | REG V.H.3, 09 section 14, 10-videos section 1 | L |
| 13 | :219-228 glossary | crossroad / sideroad definitions | Used but undefined in REG; they are simulator vocabulary. The caption labels only T, Y and jog as convention. | REG glossary | L |
| 14 | :352 vs :102 (rally-school vs which-timer) | "the director no longer uses a watch for time of day" vs "the clock is still legal and useful" | Clock and Stopwatch [00:37] "When I run, I no longer use a watch" is ambiguous (clock or wristwatch); [01:08] "if you set up this stopwatch correctly, you won't need that watch". The two lessons read it differently. Use the [01:08] quote. | 10c Clock and Stopwatch | L |
| 15 | :113 (which-timer table) | Exact transit: "TOD mode (or a stopwatch interval)" | Source conflict, unflagged: Classen P1 [46:31] starts the stopwatch at the IN line; Steve and Janet warn against stopwatch-only ("they hit the button and they don't know where they are", 2026 [101:15]; 2024 [105:52]); HB p.12 says write the time of day. | 10a, 10b | L |
| 16 | `reference-data.ts` PENALTY_ROWS and lessons | Penalty list stops at V.E.3.h | Missing rules a first morning meets: more than two persons (V.E.3.c, 5 s), support vehicle (V.E.3.d), carried on a trailer (V.E.3.f, DNF), cell phone use after the start line (II.H.1.i: warning, then 10 s, then 1 min), disqualification for dangerous or reckless driving "which may include speeding" (V.F.1.c). | REG V.E.3, II.H.1.i, V.F.1 | L |

### 1.2 Verified correct (no slip)

- Packard accel/decel, stop and go, turn charts: 3 x 72 cells compared programmatically with 08 section 3: **0 mismatches** (`reval3` scratch script, see section 9).
- Age factor table: 55 rows (1954+ down to 1900) compared with REG V.D: **0 mismatches**.
- REG penalty rows (V.E.1 1 s/2 min/5 min, V.E.2 3 min and DNF/FNS, V.E.3.a 30 s, V.E.3.b, V.E.3.e DNF, V.E.3.g 2 min, V.E.3.h 1 min/5 min): correct, including the 30-minute rule (V.C.2.b(2)); the 2 min late / 5 min early caps are confirmed by the director (10b P1 [17:00]).
- TA procedure (V.H.1-V.H.7): 10 s multiples, 29m30s cap, "Within 15m00s", rounding against the contestant, wrong car number refused, wrong leg number not corrected: correct.
- Appendix C numbers: 4.1 s late, 8.2 s/h, 4315/3600 = 1.2, 9.84 -> 10 clicks, 4315 -> 4305 (4304.7), direction rule (slow: reduce) and the correct/actual erratum fix: correct. Calibration box values 1m49.3s, 7m21.3s, 16m02.0s, 25m17.8s match Example #6-#10.
- Morning arithmetic 8:00 + 20m + 26m + 9m = 8:55; ASP 42 / 12:42 / 12:12; lunch 3:07 - 45 min = 2:22; refuel 3h10m and pit 2h10m prior (2026 Example; the 2014 handbook has 2h55m/2h10m); the 2-minute free zone after every transit (VII.C.5.c); promoted-stop penalty (V.E.3.h).
- Make-up arithmetic (44 for 44 s, 38.5 for 40 s, 20 % = 48 at 40 for 5 x delay, 56 s not 64), lost-time formula (5 s lost), split-the-sign (32.5), 36 s counts from the ghost.
- Video cites: about 30 `[mm:ss]` markers sampled across 10a/10b/10c (Clock and Stopwatch [00:37]/[01:08]/[01:39]/[02:41], Starting on Time [01:07]/[03:41]/[04:12], Making Up Time [01:03]-[05:11], Time Delay Form [00:04]/[01:38]/[02:10]/[02:41]/[04:44], Classen [04:08]/[05:39]/[06:11]/[07:42]/[13:25]/[17:00]/[42:26]/[44:27], Croker [12:36]/[13:08]/[14:10]/[15:45]/[19:57]/[24:02]/[35:33], 2024 [44:06]/[53:20]/[69:11]/[86:16]/[88:22]/[90:27]/[90:59], 2026 [10:53]/[29:02]/[38:54]/[53:47]/[58:56]/[64:10]/[75:26]/[78:30]/[80:03]/[83:11]/[97:02]/[101:15]/[105:53]/[110:28]/[121:20]/[122:52]/[125:28]/[137:14]) all match the analysis files. The "about 25 seconds" vs 27 s remark in the start lesson is itself correct.

### 1.3 Numbers with no source (flag each as derived or simulator default)

- 7.6 s stop and go (35-35), 8.9 s (40-40) and every other Ford figure the lessons compute from `FORD_1939` (:6-9, :130-135, :142): simulator default, Q12/Q22 open.
- "about 4 s for the Ford" standing-start loss (:264) and "about 4-5 s" in the engine tips (`rubrics.ts` tipFor start): simulator default, wrongly attached to HB p.7.
- "about one second per leg" (:64): derived in doc 06, cited to 07.
- "18-20 minutes at 50" (:196): derived from 15 miles / 50 mph.
- "nine seconds over a fifteen-minute leg" (:196): arithmetic (1 % of 900 s), not a source number; fine if labelled.
- "within 5 seconds either side of the minute change" (:104): simulator parameter (the video says "55 or 56"), labelled "in the simulator".
- "call turns 500-600 ft out" (:268): labelled "a number from our own research notes": ok.
- "13.6 s" (pause 20 at 30 in / 40 out, :132) and "a 15-minus-chart loss": derived from the Packard footnote; correct but not labelled derived.
- The REG-printed numbers the lessons rely on are all checked (1.2).

## 2. Drive drills at Bronze: naive play vs by-the-lesson play

Method (extends the predecessor's): Bronze (tier 0), seeds 1-5 (and 1-20 for the star distribution), engine 3.1.0, `src/agent/bots.ts` and `OracleBot` options, graded by `drill.rubric`; "Fix this next" is `debriefViewModel(...).tip`. **Naive** = ignores the lesson: `ignoreLosses` (the rookie bot), `goCount`, `wrongMinute`, `noCalibration`+`noRecovery`, an eager turn-caller (arms every turn 900 ft out), no notes, token notes, laps by watching the dial. **By the lesson** = scripted: the oracle, or for D06/D07/D15/D17 a scripted navigator that writes the notes the lesson teaches (true or Packard-copied chart values; `cal n = interval / cumulative` read off the watch plus the factor from the laps with recovery OFF; the six D15 notations plus the OUT time). The oracle uses truth-based recovery except in D07/D17, which would otherwise mask calibration. Raw seconds are the score before the age factor. D13 is a ten-stage campaign built from D12-style stages and was not run.

### 2.1 Stars and raw seconds, seeds 1-5

| Drill | Naive play (stars s1-s5 / raw s) | By-the-lesson play (stars / raw s) | 20-seed star mix naive -> lesson | Lesson makes the difference? |
|---|---|---|---|---|
| D01 stopwatch | laps off the dial (0.9 s late, +-0.6, double press): 1/1/2/1/1 (bias 1.0 s, jitter 0.4 s, 8 laps while frozen on s1) | lap at the bumper: 3/3/3/3/3 | 12x1, 8x2 -> 20x3 | **Partly**: naive reaches 2 stars on 40 % of seeds. D01 grades jitter, not knowledge; only the frozen-lap rule is teachable |
| D03 pauses | rookie 0/0/0/0/0 / 32, 34, 32, 33, 31 | oracle 3/3/3/3/3 / 3, 0, 0, 1, 1 | 20x0 -> 20x3 | **Yes** |
| D04 timed | rookie 0/0/0/0/0 / 14, 17, 19, 19, 21; goCount 2/1/1/1/1 / 1, 0, 3, 2, 2 | oracle 3/3/3/2/3 / 1, 1, 1, 3, 2 | rookie 20x0; goCount 10x1, 10x2 -> 19x3, 1x2 | **Yes for the rookie, no for goCount** (never 0-1; 2 stars on half the seeds) |
| D05 landmark | rookie 0/0/0/0/0 / 3, 2, 2, 3, 1 | oracle 3/3/3/3/3 / 0, 1, 1, 2, 0 | 20x0 -> 20x3 | **Yes** (stars), but the tip is wrong (2.2) |
| D06 charts | no notes 0 x5; forgets the losses (15 / 0 / 0) 0 x5 | true values 3 x5; copies the printed Packard charts 3/2/2/3/3 (9 of 20 seeds reach 3) | 20x0 -> 20x3 (copier: 1x1, 10x2, 9x3) | **Yes** for measuring; a table-copier is capped at 2 stars on 11 of 20 seeds (2.3) |
| D07 calibration | rookie 0 x5 / 6, 12, 6, 11, 26; no calibration + no recovery 0 x5 / 18, 27, 20, 26, 40 | laps + notes + factor, no recovery 3 x5 / 3, 2, 1, 3, 1 | 20x0 -> 20x3 | **Yes** |
| D08 early/late | rookie 0 x5 / 29, 40, 31, 33, 30 | oracle 3 x5 / 0, 0, 0, 0, 0 | 20x0 -> 19x3, 1x2 | **Yes** |
| D08b TA | rookie (no TA, no recovery) 0 x5 / 106, 96, 107, 112, 96 | oracle 3 x5 / 25, 24, 25, 22, 46 | 20x0 -> 20x3 | **Yes** |
| D10 course | eager turn-caller 1 x5 (19 of 20 seeds off course, raw capped at 360); rookie 2 x5 / 52, 67, 84, 69, 69 | oracle 3/2/3/3/3 / 1, 12, 4, 4, 5 | eager 19x1, 1x3; rookie 20x2 -> 16x3, 4x2 | **Only against the eager caller.** A rookie 52-84 s late scores 2 stars (the drill ignores time) |
| D11 full leg | rookie 0 x5 / 79, 120, 100, 120, 120 | oracle 3 x5 / 0, 0, 0, 1, 1 | 20x0 -> 16x3, 2x2, 2x1 | **Yes** |
| D12 stage | rookie 0 x5 / 582, 467, 538, 392, 583 | oracle 3 x5 / 13, 12, 10, 6, 6 | n=5 | **Yes** |
| D13 campaign | not run | not run | - | D12 result applies |
| D15 pre-read | no notes 0 x5 / 114, 117, 113, 113, 114; notes with the printed pause 0 x5 / 11, 8, 9, 10, 11 | six notations 3 x5 / 11, 8, 9, 10, 11 | 20x0, 20x0 -> 20x3 | **Yes** (and strict: 5 of 6 notations also scores 0, see 3.4) |
| D16 start | wrong minute at the restart 0 x5 / 36, 35, 35, 37, 36; rookie, no launch lead 2 x5 / 13, 13, 12, 14, 14 | oracle 3 x5 / 0, 0, 0, 2, 0 | 20x0; 20x2 -> 20x3 | **Yes against the wrong minute; no against ignoring the launch lead** (always 2 stars) |
| D17 lost watch | rookie 3/2/3/2/1 / 6, 12, 6, 11, 26; no calibration 1/1/1/1/0 / 18, 27, 20, 26, 40 | laps + notes + factor 3 x5 / 3, 2, 1, 3, 1 | rookie 8x0, 3x1, 6x2, 3x3 -> 20x3 | **No for the rookie** (3 stars on 3 of 20 seeds; the forced watch reset is not graded) |
| D18 mini leg | rookie 0 x5 / 26, 17, 20, 37, 20 | oracle 3/3/3/0/3 / 3, 0, 3, 13, 1 | 20x0 -> 14x3, 2x2, 2x1, 2x0 | **Yes for the naive side; by-the-lesson is not reliably 3** (seed 4: 0 stars with the hazard recovered, 13 s of stop and turn loss left) |

Silver and Gold (naive stars s1-s5, from the same script): D03 rookie Gold 1 x5; D04 rookie 0-1, goCount Silver 2 x5, Gold 3/2/2/2/2; **D05 rookie Silver 1/0/1/1/1, Gold 2/1/2/2/2**; D08 rookie 0-1; **D10 rookie 2 x5 at both tiers**; D07 rookie 0 x10; D11 rookie 0; D16 rookie 2 x10; D18 rookie Silver 0/1/0/0/0, Gold 1/1/1/0/1 (oracle seed 4 gets 1).

### 2.2 Tip accuracy

Four ways to measure it; the first is the predecessor's rule so the number is comparable.

| Measure | Result | Predecessor |
|---|---|---|
| (a) Runs that lost time (mean abs leg error > 3 s), tip names the largest same-sign attribution bucket (a "lost X s in B and recovered Y in cruise" headline counts as naming B) | **76 / 81 = 94 %** (the 5 misses are all D16 wrong-minute) | 133/137 = 97 % |
| (b) Runs that were fine (mean abs error <= 3 s), tip says "Clean run" or "Leg times are clean, but ..." | **104 / 109 = 95 %** (100 plain "Clean run") | 22 / 115 = 19 % |
| (c) **Strict**: naive runs (110), tip names the cause the naive play injected | **78 / 110 = 71 %** | not measured |
| (d) By-the-lesson runs that earned 3 stars (75): tip is not a misleading lecture | **67 / 75 = 89 %** | not measured |

Strict (c) by drill: D03 5/5, D04-rookie 5/5, D07 10/10, D08 5/5, D08b 5/5, D10-rookie 5/5, D11 5/5, D12 5/5, D15-no-notes 5/5, D16-rookie 5/5, D17 10/10, D18 5/5, D01 5/5 (names the frozen laps) and D10-eager 3/5; **D05 0/5, D04-goCount 0/5, D06 0/10, D15-printed-pause 0/5, D16-wrong-minute 0/5.**

What the headline says on the misses (seed 1):

| Run | True cause | "Fix this next" |
|---|---|---|
| D05 rookie, 0 stars, "landmark calls 2.8 s off each (2.8 s late)" | calls at the sign, no half-ramp lead | "Verdict: Clean run: the remaining seconds are speed-holding noise" |
| D04 goCount, 1-2 stars | counts from own go | "Clean run ..." |
| D06 every play, 0 stars | chart cells wrong or not noted | "Clean run ..." (the stars come from notes, the tip is about leg error) |
| D15 printed pause, 0 stars (pause 0/11) | wrote 15 instead of the chart pause | "Clean run ..." (the rubric bullets do name it) |
| D16 wrong minute, 0 stars, finding `oneMinuteMistake` | left the restart a minute late | "Cruise segments ran fast because the driver wandered over the assigned speed" (the finding is ignored; `headlineTip` only uses findings when mean <= 3 s) |
| D10 eager, 1 star, off course 2294 s | arming the turn early / wrong turn | seeds 1, 3: "You lost 2294 s in offCourse and recovered 5 s in cruise; recover a little more ... 10 % rule" (nonsense for a wrong turn); seeds 2, 4, 5 right |
| D08b oracle, 3 stars (5 of 5 seeds) | none (TA filed, 50 s credited) | "You lost 88 s in hazard and recovered 33 s in cruise; recover a little more, or earlier" (ignores the TA credit) |
| D10 oracle, 3 stars (3 of 5 seeds), D18 oracle s4 | none / residual stop and turn loss | same "recover a little more" lecture |
| D01 naive, 1 star | frozen laps | "Verdict: Clean run ... Instrument discipline: 8 x lap taken while the split was still frozen" (right sentence under the wrong verdict) |

The rookie bot never starts the stopwatch, so every naive tip also carries an "Instrument discipline: no stopwatch start or lap" clause; that is a bot artifact, not a defect.

### 2.3 Other drill findings

- **D06 Bronze copier cap.** Bronze says "your notes should match the printed tables" but 17 of 20 seeds draw at least one pair outside the handbook's printed 15-50 mph range (55 mph, 11 of 20 seeds draw two or more) so a perfect copier is capped at 2 stars on 11 of 20 seeds. No lesson teaches how to measure the car (HB Appendix B, Jeff Stumb's two-pole method, the X-Cup four-runs sheet); the Reference answer sheet is still **open by default until D06 is passed** (`src/ui/screens/reference.ts:77`).
- **D15 cliff.** The grade is the minimum over the six notations; the restart and the transit are one line each, so 5 of 6 notations scored 0 stars in my probe ("everything but the restart": 0/0/0/0/0 at all tiers; one junk note "x": 0). The old "any annotation earns a star" hole is closed. Consider weighting by lines.
- **Time budgets on the cards are wrong** (oracle at 1x, tier 0, simulated driving minutes vs the card): D08b 9 vs 23, D11 15 vs 54-62, D12 150 vs 289-333 (200 lines), D17 8 vs 45, D03 6 vs 9-10, D04 7 vs 9-10, D05 6 vs 8-9, D10 8 vs 11-13. D17 is D07 plus a watch reset the rubric ignores.
- D02 (dial reading) is still in `TRACKS`/`CURRICULUM` but not registered.

### 2.4 Unlock gates the naive play can pass (Silver or Gold stars count)

| Gate | Needs | Naive result | Passes without the lesson? |
|---|---|---|---|
| D18 | D03, D04, D05, D08, D10 >= 2 | D03 rookie 0-1 (blocked); D08 0-1 (blocked) | No (but each of D05 Gold 2, D10 2, D04 goCount 2 is passable alone) |
| D11 | D18 >= 1, D07 >= 2 | D18 rookie 1 star at Gold on 4 of 5 seeds; D07 rookie 0 | No (D07 holds) |
| D12 | D11 >= 1, D15 >= 1, D16 >= 1 | D11 rookie 0; D15 no notes 0; D16 rookie 2 (passes), wrong minute 0 | No (D11 and D15 hold; D16 is soft) |
| D10 >= 2 inside D18's gate | | rookie 2 stars at Silver and Gold, 10/10 | **Yes** |
| D05 >= 2 | | rookie Gold 2 stars on 4 of 5 seeds | **Yes** |

## 3. Curriculum order and unlocks against the handbook's priorities

Priorities (HB p.13-14): the Four S's in order, Safety, Start on time, Stay on course, Stay on time; "much more important than trying to maintain perfect times" for the course; "for rookies, concentrate on the first 3 S's where the errors are usually in minutes"; do not pull up to a restart before your minute (tip 6). The director (10b P1 [06:49]): a team that starts a minute late "proceeds in ignorance".

Actual order: lessons ghost-car, four-s, which-timer, pause-arithmetic, timed-leads, recovery, calibration, griid-cameo, protocol, markup, transits, rally-school. Start-here path (`src/ui/viewmodels/curriculum.ts`): lesson ghost-car, D01, D03, D04, D05, D08, D10, D18. Gates: D18 (D03/D04/D05/D08/D10 >= 2), D11 (D18, D07), D12 (D11, D15, D16).

### 3.1 Findings

1. **Stay on time is taught before stay on course and before start on time.** Lessons 4-7 (pause, timed leads, recovery, calibration) all precede lesson 8 (GRIID/CAMEO) and 9 (protocol); the path puts four stay-on-time drills (D01, D03, D04, D05, then D08) ahead of D10, the only course-following drill. D09 (the trap quiz) is on neither the path nor a gate. This is the inverse of "stay on course before stay on time".
2. **Starts and restarts are late.** LESSON-004 (transits and restarts) is lesson 11 of 12; the launch count, the 30-second warning, "nobody releases you" and "do not pull up early" are in lessons 9 (one line), 11 and 12 only. D16 (start on the second) sits after D15 in the Timing track, is not on the path and is not a gate for D18 or D11 (it is a soft gate for D12). **D01, D03, D04 and D05 run with `startProcedure: 'drill'`** (automatic launch, no queue, no warning), so the first path step where the learner must leave on a second is D08 (step 5), and only D16 grades it.
3. **Prerequisite inversions.** (a) D03/D04/D05 Gold (`HIDDEN_FORD` in `src/core/drills/common.ts`) hide the Ford's numbers, so Gold needs a chart the learner built in D06; D06 is off the path, has no unlock edge and no lesson. (b) D15 grades the restart time (base + ASP) and the exact-transit OUT, which LESSON-004 and D16 teach, and D15 is placed before D16. (c) D10 grades the lost doctrine (stopwatch at the turn-around, double it, rejoin 30 s behind), which is only in lesson 12 (the last) and in the D10 objective. (d) D11 and D12 ask for TA filing, but D08b is not a prerequisite of either gate (D18 has no TA point by design).
4. **Lessons are not attached to drills.** Only lesson 1 is on the path; the drill cards and the cockpit pre-run link to no lesson. The lesson that makes D03 winnable (pause arithmetic) is lesson 4, D04/D05's is lesson 5, D08's is lesson 6; a learner following the Start-here panel never meets them (the objective line on the card is the only teaching).
5. **Safety first** exists only as text in lesson 2 and a penalty row; no drill or card line asks the driver to do anything about it (section 4).
6. **Not taught anywhere** (checked by search in `content/lessons.ts`): measuring the car (D06), GR emergency signs and emergency instruction sheets (REG VII.D.3; Classen [27:58]), the one-time-zone-per-day rule (V.C.1.c; Croker [34:01]), the cell-phone rule (II.H.1.i), what to do during the tire warm-up and the calibration transit.
7. **What is sound:** D07 >= 2 before D11 is meaningful (uncalibrated naive 0 stars at every tier); D15 now needs the real notations; D11 and D12 are guarded; the D18 oracle fairness improved from 9/20 at <= 1 star to 4/20.

### 3.2 Suggested order (no new content needed, only reordering and links)

Lessons: ghost-car, four-s, **transits (start and restart)**, **griid-cameo**, **protocol**, which-timer, pause-arithmetic, timed-leads, recovery, calibration, markup, rally-school. Path: ghost-car, four-s, D01, **D16 (or a short start drill)**, **D09, D10**, D03, D04, D05, D06, D08, D07, D18. Add D16 >= 1 to D18's unlock and D06 >= 1 to the Gold tier of D03/D04/D05. On each drill card show "Read first: <lesson>".

## 4. Dad's card (LESSON-002) plus LESSON-004 and LESSON-006: could a first morning run correctly?

What is good: the call pattern and ICE, read-backs, "Stopped" at the rock-back, GO as the only signal, "keep counting", "comes quick", team errors only, the launch count (30-second warning), the start arithmetic and the exact-transit and lunch arithmetic, and the director's clock method. The card is accurate against HB p.15 and the 2026 school.

What a first morning needs that the three do not say. **Verdict: No.** Lines to add (driver card first, then navigator):

**Add to Dad's card (driver)**
1. "Safety beats seconds. Every STOP sign is a full stop even when the book prints no pause (failing to stop is a DNF). Never speed, pass blind or run a light to catch up. We are behind? Hold the speed; the navigator files a time allowance or we take the loss." (REG V.E.3.e, V.F.1.c; HB p.13 "Safety first")
2. "Green sign: a timing checkpoint. Do not stop and never slow to 5 mph or less in sight of it (30 s). Keep the speed, say nothing to the crew, wave and honk are fine. Red GREAT RACE STOP board: stop, always at the finish (missing the last one is a DNF)." (REG V.A.1, V.E.2.d, V.E.3.a; 10b P1 [04:08], 2026 [64:10])
3. "Calibration run: hold the indicated speed exactly, say nothing about early or late, stay right, tell the navigator about lane endings and traffic. She does the arithmetic afterwards." (2026 [122:52], [82:09]; 2024 [88:22])
4. "Speed corrections are the navigator's job. Never guess ('I'll do 37'): hold the number you were given until she changes it." (2024 [21:59], [22:34])
5. "Look far ahead: train, tractor, school bus, gravel trucks. Tell the navigator at once so she starts the stopwatch." (2024 [23:34]; Time Delay Form [00:37])
6. "Restart point: wait back among the cars, pull up only after the car ahead has left, and if it sits go around it and leave on our minute. No rolling starts." (HB p.15 tip 6; Croker [12:36], [14:10]; Classen [44:27])
7. "Not sure where we are: say so, pull off where it is safe (never in the lane, never in sight of a green sign), no U-turn in traffic, no speeding to catch up. No score is worth an accident." The card's current line "stop short of the intersection" conflicts with the 30 s rule if a checkpoint is in sight. (Croker [04:08]; 2024 [114:06], [119:45]; REG V.A.1.a(3))
8. "Phone off and out of reach from the start line to the finish (warning, then 10 s, then 1 min); no GPS, no digital watch, odometer covered." (REG II.H.1.i, II.H.1.d(2), II.H.2, II.H.1.h(6))
9. "Off the clock (hourglass, camera with a slash): drive safely at any speed but be at the restart early; there is a 2-minute free zone after each transit for parking." (REG VII.C.5; HB p.11)
10. "A Day-Glo GR sign or an emergency sheet overrides the book: follow its instruction number or arrow; I = ignore that sign; End Leg = the leg is cancelled, keep going safely." (REG VII.D.3; Classen [27:58])

**Add to LESSON-004 / LESSON-006 (navigator)**
11. A "first morning, in order" list: pick up the book 30 minutes before your start (ID tag with the car number); check clock and stopwatch against the digital WWV clock there ("trust but verify"); flip every page ("page n of m"); write base + ASP at each restart; tire warm-up (any safe speed, free zone, early is fine); calibration run (stopwatch at the asterisk, lap every box, driver holds exactly); adjust parked, never on the road; transit; arrive early at the restart. (REG V.B.2, V.C.1.b, VII.B.2.a; 10b P2 [02:05]; 2024 [90:27])
12. "The warm-up and calibration are free zones with no timing checkpoint; the first leg begins at the first time-of-day restart (REG V.B.2.a, Q14)." and "the calibration run is 15 miles at least, 20-40 minutes in practice (REG V.B.2.a; 2026 [29:02])" (fixes slip 6).
13. "One time zone all day: the zone at the stage start (REG V.C.1.c); reset your watch only before the next stage."
14. "After End timed portion the day is not over: a checkpoint can follow; at lunch and the finish file time allowances within 15 minutes on the web form and press the red button; at the finish stop at the red board." and "If you reach a restart after your minute, go at once and make the seconds up (REG V.C.2.c scores from your assigned time)."

## 5. Ranked top-10 fix list

| Rank | Fix | Why (evidence) | File hints |
|---|---|---|---|
| 1 | **D16 headline names the wrong cause.** Feed the `oneMinuteMistake` and `lateLaunch` findings and the departure error into the headline whenever stars come from departures, not only when mean leg error <= 3 s | wrong-minute run: 0/5 right; "driver wandered" on every seed | `src/core/drills/rubrics.ts` headlineTip (findings only used under `mean <= 3`); `src/core/drills/d16.ts` rubric; `src/ui/viewmodels/debrief.ts` rankTips |
| 2 | **Never show "Clean run" under a 0-2 star result; let the drill's own failing skill be the headline** (D05 call error, D04 goCount call error, D06 chart cells, D15 notations, D01 frozen laps) | D05 naive 0 stars with "Verdict: Clean run" on 5/5 seeds; D06 20/20; D04 goCount 5/5; D15 printed pause 5/5 | `src/core/drills/rubrics.ts` basicRubric (`feedback[0]`); `src/ui/viewmodels/debrief.ts` rankTips; `src/ui/screens/debrief.ts:33` (Verdict vs Fix this next) |
| 3 | **Retire the "recovered Y s in cruise; recover more" lecture** when TA credit covers the loss (D08b), when the run is 3 stars, and for off-course runs (say "confirm the landmark, turn around, double it" instead of the 10 % rule) | D08b oracle 5/5 3-star runs get it; D10 3 of its 4 three-star runs; D10 eager "lost 2294 s in offCourse ... recover a little more" on 2/5 | `src/core/drills/rubrics.ts` headlineTip (the `recovered > 3 && net > 0` branch runs before `offCourse`) |
| 4 | **Fix the tractor contradiction** in D08b and align the recovery lesson's stop/start-loss sentence with the director and the engine | slips 1 and 2: REG V.H.5, 10b [05:43], 10c [01:38]/[04:44] | `src/core/drills/d08b.ts:45` objective and the leg-2 hazard comment; `content/lessons.ts:164`, :84, :97 |
| 5 | **Reorder the curriculum to the Four S's** and link each drill card to its lesson; add D16 >= 1 to D18's unlock and D06 >= 1 to Gold D03/D04/D05; put D09/D10 before D03 on the path | section 3 | `src/ui/viewmodels/curriculum.ts` (START_PATH, CURRICULUM); `src/core/drills/staged.ts:15` and `common.ts` HIDDEN_FORD; `content/lessons.ts` order; `src/ui/screens/home.ts` drillCard |
| 6 | **Make the gates mean something**: D10 stars should also need mean leg error <= ~20 s (rookie 52-84 s late earns 2 and passes the D18 gate); D16 should cap at 2 for no launch lead and the D12 gate should read >= 2; D17 needs the elapsed-from-clock check (rookie 3 stars on 3/20 seeds); D05/D04 thresholds against the bias row; D18 residual loss (oracle 0-2 stars on 6/20 seeds) | section 2.1, 2.4 | `src/core/drills/index.ts` D10/D17 rubrics; `d16.ts`; `staged.ts` D18 |
| 7 | **Dad's card and LESSON-004/006: add the 14 lines in section 4** (safety, checkpoints, calibration conduct, restart queue, lost, phone, emergency signs, first-morning list, time zone) | section 4 verdict | `content/lessons.ts` protocol card (:270-280), transits (:317-343), which-timer (:99-126) |
| 8 | **Correct the slips table**: label the edition of "Example #30/#34/#18"; "exact transit" wording and its REG cite; "5 MPH or slower" and the video-only wave/honk cite; calibration run length; ghost-car cites; label every Ford number "simulator default" | section 1 (slips 3-13) | `content/lessons.ts` :62, :64, :130-135, :196, :206-211, :264, :322, :404; `content/reference-data.ts` :104, :145-146; add V.E.3.c/d/f, II.H.1.i, V.F.1 to PENALTY_ROWS |
| 9 | **D06: make Bronze copyable and teach the method.** Draw Bronze pairs only inside 15-50 (Packard) or say which pairs must be extrapolated; add a "measure your car" lesson (HB Appendix B, two-pole method, four runs per speed); keep the Reference answer sheet closed until D06 is passed | copier capped at 2 stars on 11/20 seeds; sheet open by default | `src/core/drills/d06.ts` pick3 speeds; `content/lessons.ts` (new lesson); `src/ui/screens/reference.ts:77` |
| 10 | **Fix the drill cards' time budgets, register or remove D02, and soften the D15 cliff** (weight notations by line count so one missed restart line does not zero the drill) | cards say 9/15/150/8 min for drills that run 23/54-62/289-333/45 | `minutes` fields in `src/core/drills/*.ts`; `src/ui/screens/home.ts` TRACKS and `curriculum.ts` CURRICULUM; `src/core/drills/d15.ts` rubric |

## 6. Comparison with the 2026-10-03 report (what changed)

| Item then | Now |
|---|---|
| Tip right on 133/137 failing runs (97 %) | 76/81 (94 %) on the same rule; strict 71 % because star-causes other than leg error are not in the headline |
| "Clean run" on only 22 of 115 good runs | 104 of 109 (fixed) |
| D05 rookie Gold 3/3/2/2/2; D05 Bronze 1/1/1/1/1 | Bronze 0 x20; Gold 2/1/2/2/2 (better, still a pass at 2) |
| D07 Bronze rookie 3/1/3/2/1 | 0 x20 (fixed: reads and a factor are graded) |
| D10 rookie always 2; D16 rookie 1/2/1/1/1; D17 same as D07 | D10 still 2 x20; D16 rookie 2 x20; D17 rookie 0-3 stars (8x0, 3x1, 6x2, 3x3) |
| D15 any annotation scored 1; one pause line; 10-minute pre-read | 48 lines, 8 pages, six notations graded; min-over-notations cliff |
| D18 Bronze oracle 9/20 seeds <= 1 star | 4/20 |
| D06 constant "8" or the card example earned a star; answer sheet open until D06 passed | grading unchanged in spirit (true values 3, no notes 0); sheet still open by default |
| D17 identical to D07 | still the same scenario plus an ungraded watch reset |

## 7. Caveats

- The oracle reads truth for recovery (masks calibration unless `noRecovery`, as in D07/D17); the rookie bot never starts the stopwatch, so its tips always carry an instrument-discipline clause.
- My "naive" plays are mechanical stand-ins (eager caller at 900 ft, lap latency 0.9 s +-0.6, notes copied from the Packard table) and the D01 star mix depends on that chosen jitter; a human novice would land somewhere between the two D01 plays.
- The strict tip measure (c) uses my per-play list of acceptable tip classes (section 2.2); the mechanical measure (a) reproduces the predecessor's rule and is the like-for-like number.
- The slips table checks the lessons against the documents as extracted in `docs/research`; I did not re-open the PDFs. Video cites were checked against the caption analyses, not the captions, except where noted.
- No browser pass (a playability agent covers the UI). Dad's-card findings in section 4 are a content judgement, not a play-through.

## 8. What I did not change

`src/`, `tests/`, `content/` untouched; nothing committed. New files only: this report and `playtest-scripts/reval3-*.ts`.

## 9. Reproduce

```
npx tsx playtest-scripts/reval3-matrix.ts D03,D04,D05 0 1,2,3,4,5     # one JSON line per run: stars, raw, M, attribution, tip class, tip text, rubric bullets
npx tsx playtest-scripts/reval3-matrix.ts D01,D03,D04,D05,D06,D07,D08,D08b,D10,D11,D15,D16,D17,D18 0 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20   # star mixes
npx tsx playtest-scripts/reval3-matrix.ts D12 0 1,2,3,4,5            # about 10 s per seed
npx tsx playtest-scripts/reval3-matrix.ts D03,D04,D05,D07,D08,D10,D15,D16,D18 1   # and 2: Silver and Gold, for the gates
npx tsx playtest-scripts/reval3-len.ts                                # card minutes vs simulated minutes and book length
npx tsx playtest-scripts/reval3-d15gate.ts                            # D15 token-annotation and partial-notation probes
npx tsx playtest-scripts/reval3-d06pairs.ts                           # D06 Bronze pairs outside the printed Packard 15-50 range
npx tsx playtest-scripts/reval3-ford.ts                               # Ford accel / stop-go / ramp numbers vs the lesson text
npx tsx playtest-scripts/reval3-list.ts                               # drill registry with objectives and unlocks
```

The Packard-chart and age-factor comparisons were one-off scripts parsing `docs/research/08-rookie-handbook-body.md` and `09-event-regulations-2026.md` against `content/reference-data.ts` (0 mismatches); they are easy to repeat by diffing those tables.

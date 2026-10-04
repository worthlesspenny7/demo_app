# PT-10: Playability on the PT-08/PT-09 fix sprint (ENGINE 3.2.0, the path in the handbook's S-order)

Build under test: HEAD f8ceba4, which carries 627b7dd (the fix sprint PT-08/PT-09); ENGINE 3.2.0.

## Method
- `npm run build`, then `dist` copied to a pinned scratch snapshot and served with `npx vite preview --port 4180`. Chromium at /opt/pw-browsers/chromium, Playwright, 1366x768.
- Every player action was a real key press or a real click/fill. Sim time moved only through `window.__rally.advance`, with the cockpit loop held.
- **One shared profile.** `playtest-scripts/pt10-path.ts` plays an evening: it reads Home's "Next:" button, clicks it and handles whatever opens (a lesson: read, answer the check, note the lesson's own Next; the D09 deck; a cockpit drill at the tier the button chose), then goes back to Home and repeats while the evening has time left. Evening one started from a fresh profile. Evening two was a new browser on the saved profile (the resume). A third, scratch evening on a copy of the profile finished the path.
- **Wall time.** Lessons at 200 words a minute plus 1 minute for the check; D09 at 15 s a card. A drive takes the cockpit's own scale rules (4x, D01/D03 at 1x, hold fast-forward) plus 2 minutes of pre-read and 2 of Debrief.
- **The player.** Josh is the PT-08 human model: a card follower at Bronze. He presses K when the card asks, uses the 10 % rule and P from the pace aid, counts aloud, gives W, Q and the count, and follows the restart card. The PT-10 additions are listed below.
  - At Silver he works the dwell out from the simple chart himself: pause - DEC(in) - ACC(out).
  - At the legal rung he takes OUT = IN + 20 min off his own clock read, and leaves lunch at the restart minus 45 min.
  - D06 Bronze copies the Packard cells from the C overlay.
  - D07 notes "cal N = i / c" and sets k.
- **Scratch copies** (`PT10_NOSAVE=1`), each on a copy of the evening-two profile:
  - the day stage `builtin/stage/1` at Bronze;
  - D11 at the legal rung (drill/D11/1/1);
  - the D06 Silver/Gold probes;
  - the D10 forced wrong turn;
  - the misc items and D08b.
- **Scripts** (`playtest-scripts/pt10-*.ts`):
  - harness: `pt10-common`, `pt10-human`, `pt10-run`;
  - the path: `pt10-path`;
  - D09: `pt10-02-d09`;
  - D10 lost: `pt10-04-d10-lost`;
  - the stage: `pt10-10-stage`;
  - D08b: `pt10-11-d08b`;
  - misc: `pt10-12-misc`;
  - D06: `pt10-13-d06-overlay` and `pt10-d06-silver`;
  - peeks: `pt10-00-*`.
- **Screenshots.** `docs/playtest/screenshots/pt10-*.png`: 32 files, 5.8 MB in total, all under 1 MB.
- **No Agent tool** was available, so I drove every drill group myself. There were no uncaught page errors in any run.
- **Harness slips** (mine, re-run, not counted):
  - The first evening-one run died on an escaping bug in my new model code.
  - A second run crashed on a null after D10 finished.
  - Both evenings were replayed from a fresh profile.
  - In D11, my legal model never pressed K before the restart, so one clock-read finding is the harness's fault.
  - In the stage, the harness never filed a TA and did not lap the calibration points.

## 1. The two evenings as played

| t | Step (Home's "Next:" button) | Result | Wall |
|---|---|---|---|
| **Evening 1** 0:00 | Lessons: The Four S's (1087 words), Transits and restarts (1445), Which timer, when (1117), The ghost car (305) | Each lesson's "Next on your path" names the next path step. | 24 min of reading |
| 0:24 | D16 Bronze by the card. Fast-forward: "Fast-forward to 45 s before the launch" lands at T-45.0 s, then W, Q and the count. | **★★★**, 1 raw, 2 aces, every departure on its second. The IN clock prompt shows 44 s before the transit sign, and K then counts. | 29 min |
| 0:53 | Lessons: The GRIID page and the CAMEO (988), Team protocol and Dad's card (1893; the card printed to PDF) | | 16 min |
| 1:09 | D09 (20 decision cards; my rookie misses the jog and the acute right) | 18/20 ★★. The result page has "Next on your path: School: when you are lost". | 5 min |
| 1:14 | Lesson "When you are lost" (532 words), then D10 Bronze | ★★ (16 s, on course). At all four STOP-Ts Dad says "Too late, I can't make that left at this speed" for the side road, then "Straight on past line N, you did not call a turn" (N-B14). | 4 + 10 min |
| 1:29 | Lesson "Pause arithmetic" (429), D01 Bronze (Fast-forward to the launch, L at every marker), D03 Bronze (1x) | ★★★, ★★★ | 3 + 9 + 14 min |
| **1:55** | **End of evening one.** Home: "Next: School: timed segments and ramp leads". | 13 of 23 path steps ticked. | |
| **Evening 2** (new browser on the saved profile) | Home shows the ticks, "Last runs: D16 1 raw s ★★★ · D09 2 wrong ★★ …" and the right Next. | Resume clean. | |
| 0:00 | Lesson "Timed segments" (360), D04, D05 | ★★★ (no instrument finding on the compound line), ★★★ | 3 + 10 + 8 min |
| 0:21 | Lesson "Measure your car" (781), D06 Bronze: copy 10 Packard cells from the C overlay into the notes box, then drive | ★★★ 10/10 | 5 + 19 min |
| 0:45 | Lesson "Early, late and the 10 % rule" (969), D08 Bronze with P and the 10 % rule | ★★★, 0 raw, 2 aces. The Debrief says "deliberate make-up … not the driver wandering". | 6 + 8 min |
| 0:59 | Lesson "Calibration" (937), D07 Bronze | ★★★, read-offs 6/6, k 1.0163 | 6 + 21 min |
| 1:26 | "Next: Replay D03 at Silver (D18 needs D03 ★★ at Silver or Gold)", then D04 and D05 at Silver | ★★★ ×3 (the Silver cards still give the dwell and call times) | 14 + 10 + 8 min |
| **1:58** | **End of evening two.** Home: "Next: Replay D08 at Silver (D18 needs D08 ★★ …)". | All 23 Bronze steps ticked; D18 waits for 3 more replays. | |
| scratch evening 3 | Replays of D08, D10 and D16 at Silver (D16 at Silver is legal mode: my own IN + 20 min, lunch = restart - 45), then D18 Bronze | ★★★ ×4. D18's Debrief: "🔒 Next drill: D11 (needs D18 ★, D07 ★★ at Silver or Gold)". Home: "Path complete. …" with no button. | 8 + 10 + 30 + 9 min |
| scratch | Day stage `builtin/stage/1`, Bronze, by the card at 8x | 238 raw (PT-08: 227). Layout is unchanged and fits (road 205, book 392, watch 206, drawer 253 px). The last leg ran +259 (capped at 120) behind a hazard the harness never filed. | 97 min |
| scratch | D11 at the legal rung (rung 1), dwell from the simple chart | ☆☆☆, 31 s. "Your stops cost more than the printed pause, so go earlier" is **true** here: six turning stops each ran 1.5-2.2 s long (N-C5). | 23 min |

**Does it hold together?** Yes. Over three evenings I took 37 path clicks, and none of them dead-ended, opened a locked drill or skipped a lesson. Every lesson's and Debrief's "Next on your path" named exactly the step Home showed next. The cost is reading: evening one is 8 lessons and about 7,800 words (about 47 of 115 minutes) before D03.

## 2. PT-08 bugs N-B1 to N-B16: FIXED / NOT FIXED / REGRESSED

| PT-08 bug | Status | Evidence on this build |
|---|---|---|
| N-B1 The path skips the drills' lessons (High) | **FIXED** | All 12 path lessons come before their drills, in the S-order. D16 comes after transits, which-timer and ghost-car; D08 comes after recovery and is ★★★ first try with the 10 % rule. `pt10-e1-home-start.png`, timeline in `path-e1.txt`. |
| N-B2 The path ends on locks | **FIXED** (leftover N-C6) | After D07, Next is "Replay D03 at Silver (D18 needs D03 ★★ at Silver or Gold)", and so on for D04, D05, D08, D10 and D16. D18 opened only once unlocked. The path-complete text names what D11 and D12 need. But once the path is complete there is no button (`pt10-e3-home-end.png`). |
| N-B3 Fast-forward lands past the launch | **FIXED** | "Fast-forward to 45 s before the launch" leaves secondsToLaunch at 45.0, and W, Q and the count all happen (`pt10-e1-D16-t0-1-after-ff.png`). D16 ★★★. |
| N-B4 D06 accel cells unmeasurable; raw runs | **FIXED** (new N-C1, N-C3) | Bronze copies the Packard (10/10 ★★★). Silver measured honestly (pace aid read at MARK in and MARK out): **10/10 ★★★ on seeds 1 and 2**, including 0>55 (9.5 vs 8.9). Notes survive a retry. |
| N-B5 D09 content | **FIXED** (new N-C2, N-C4) | Each card asks "Which way, and what do you do?" with one decision. The spelling trap is gone, the RR card uses the 2026 web form within 15 min, card 4's tip has no bezel, there are no doubled quotes, and the result has a Next button. |
| N-B6 D11 "go earlier" headline | **FIXED** | It fires only when the dwells really ran long: in the legal run, 6 turning stops ran +1.5 to +2.2 s (see N-C5 for the missing "why"). |
| N-B7 D16 IN prompt at the start line | **FIXED** | "Read the clock now (K)" shows at 09:54:30; the IN sign is at 09:55:14 (44 s later). K counted, with no IN finding. |
| N-B8 Compound STOP + timed anchor | **FIXED** | D04 Bronze and Silver ★★★ "Clean run" with the card's lap at "Stopped + 11.8 s"; no stopwatch finding. |
| N-B9 Dad's card print | **FIXED** (nits N-C13) | The PDF is 1 page, with a black 15 pt title, 21 numbered lines at 11 pt, "the navigator", and "the dash clock is analog with no digital readout; the stopwatch may be digital" (`pt10-dad-card-print.png`). |
| N-B10 10 %-rule make-up blamed on the driver | **FIXED** | D08: "you called a deliberate make-up (+10 % from 8:03:19): that is recovery by the 10 % rule, not the driver wandering". |
| N-B11 Stale alert | **FIXED** | "Pulled up to the sign" is visible just after Q and hidden 60 s after the start (`12-misc.txt`). |
| N-B12 D10 off-course double count | **FIXED** | Forced wrong turn: leg +79 = stops 1 + off course 62 + turns 16; no residual line. Residual lines remain on other drills (N-C10). |
| N-B13 Ledger suggests a TA where none qualifies | **FIXED** | Behind the D08 truck: "No TA point in this drill: time any delay on the watch and make it up with the 10 % rule." (`pt10-misc-d08-truck.png`). |
| N-B14 Turn call spent on a distractor; wrong check-off at a T | **NOT FIXED** (listed as not done) | It reproduces naturally, with no forced error, at all 4 STOP-Ts of D10 seed 1, at Bronze and at Silver. The Bronze "Next: call the left at line 4" prompt appears at 7,687 ft, before the side road (7,888 ft). A call at about 500 ft is spent on the side road ("Too late, I can't make that left at this speed"). Then at the T: "Straight on past line 4, you did not call a turn", while the car stays on course. |
| N-B15 Pre-read / card wording leftovers | **PARTLY** | Fixed: the driver's warning, the TOD sentence, the restart card ("Line 3: your time 10:15:14, launch at 10:15:10 (minus 4 s)"), "Day stage 1", and a single drill-start sentence. Still open: D03's keys "G go when the bezel hits the card dwell / [ ] set the bezel" on the digital stopwatch (N-C12). New: the D06 pre-read contradiction (N-C9). |
| N-B16 Small path and lesson gaps | **PARTLY** | Fixed: (1) D09 Next; (2) quotes; (3) the lesson-1 check now tests the S priority. Still open: lesson 1 still carries the TA procedure (6 TA paragraphs in 1,087 words), and (4) the campaign is locked behind D12, so its benchmark totals could not be checked. |

**Counts: 13 FIXED, 2 PARTLY, 1 NOT FIXED (N-B14, deferred by the sprint), 0 REGRESSED.**

### PT-08 top-10

| # | Item | Status |
|---|---|---|
| 1 | Route the path through the drills' lessons | **FIXED** |
| 2 | Honest path end | **FIXED**; the leftover is no button at path complete (N-C6). |
| 3 | Full-start fast-forward | **FIXED** |
| 4 | D06 measurable as taught | **FIXED**: Silver honest 10/10 on two seeds, Bronze is "copy". But the MARK-out wording misleads (N-C3), and the car's charts are visible at Silver and Gold (N-C1). |
| 5 | D09 content | **FIXED**; new red-light card (N-C2) and answer-length tell (N-C4). |
| 6 | Debrief truth (N-B6, N-B8, N-B10, N-B12) | **FIXED** |
| 7 | D16 prompts | **FIXED** |
| 8 | Dad's card | **FIXED** |
| 9 | Cockpit text hygiene | **PARTLY**: D03 "bezel" keys, and the D06 pre-read contradiction. |
| 10 | Carry-overs | **PARTLY**. Done: the TA worksheet shows Josh's own lap ("Your watch 0m40s beside the engine's 0m59s", D08b) and the lesson-1 check. Open: TA procedure still in lesson 1; the T check-off (N-B14); campaign totals unverified. |

**Top-10: 7 FIXED, 3 PARTLY, 0 REGRESSED.**

## 3. Rubric (0-5; PT-08 in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **4.0** (3.5) | The Home panel prints the four S headings with their steps and the "why" line, and Next is always the step the screen promised. Still against it: 3,950 words (24 min) before the first drive, and about 47 of 115 minutes of evening one spent reading. The D10 chip reads "needs pass the lesson "lost"" (the id), and 10 of 12 lesson checks have option 2 as the answer. |
| 2 | Control scheme | **4.0** (4.0) | K, Q, W and the count work as prompted; the D06 and D07 notes go in the notes box. D03 still tells a digital-watch user to "set the bezel". |
| 3 | Information layout (1366x768) | **4.0** (4.0) | The stage fits (same geometry as PT-08). The folded pre-read box's "Show the pre-read" button overlaps its own title, and the box sits over the scale toolbar (`pt10-e1-D16-t0-1-after-ff.png`). |
| 4 | Pace | **3.5** (3.5) | Fast-forward fixed. Still slow: D16 takes 29 min, a quarter of evening one. D06 Bronze is 19 min of driving to be graded on copying a table. The four Silver replays (about 40 min) before D18 are near-repeats with the same card help. Stage 97 min at 8x. |
| 5 | Feedback and progression | **4.0** (3.5) | "Go earlier", the compound anchor, the make-up credit, the D10 buckets and the honest locks are all right now. Wrong or incomplete: D06 "negative net loss, delete it or re-run" for a literal reader (N-C3); D10 advises the 10 % rule 9 steps before its lesson; the D11 turning-stop "why" is missing; the path ends with no button. |
| 6 | Dad's messages | **4.0** (4.0) | The printed card is good. "Leaving N s after our launch second" never needed (no late launches). In D10, "Too late, I can't make that left" and "Straight on past line N" fire on every STOP-T (N-B14). |
| 7 | Difficulty curve | **3.5** (3.5) | Flat, then a cliff. A card follower gets ★★★ on every Bronze drill except D10 (★★). The Silver replays of D03, D04, D05 and D08 still print the dwell and call times (★★★, little new). D11 at the legal rung is ☆☆☆ (31 s) because turning stops are not on the simple chart. D06 Silver and Gold can be copied. |
| 8 | Session-length fit | **4.5** (4.0) | Each evening ends cleanly between steps; resume is clean (ticks, last runs, same Next). Two evenings tick every Bronze step plus 3 of 6 Silver replays; nothing blocks. |
| 9 | Delight / polish | **4.0** (4.0) | Good: the Four S's panel, the D09 CAMEO decision cards, Dad's card on one page, D16 ★★★ with "Every departure was on its second". Against: residual lines on 0-s legs, "Pro (expert)" in the status line while the panel says Dad, and the overlapping pre-read button. |
| 10 | Frustration / recoverability | **4.5** (4.0) | No zero-star loops, no locked Next and no fast-forward trap. The only friction is D10's repeated "too late" lines and the buttonless path end. |
| 11 | Realism integrity | **4.0** (4.0) | Gained: the spelling trap is gone and the RR card is the 2026 procedure. Lost: D09 now teaches "a red light is a Time Allowance" (contradicting REG V.H.1 and the app's own D08/D08b), and D06's "hidden" car is in plain view. |
| | **Total** | **44.0 / 55** (42.0) | 13 of 16 PT-08 bugs fixed, 0 regressed. The path now does what it says. The new debt sits in D06 Silver/Gold, D09's answer key, and turning stops at the legal rung. |

## 4. Answers

**Does the path now read as the Four S's, and does Next always make sense? Yes, with one gap at the end.**
- Home prints "1. Safety first / 2. Start on time / 3. Stay on course / 4. Stay on time", each with its lessons and drills, under one line on why starts and course come first.
- Over 37 clicks, every lesson's and Debrief's "Next on your path" matched Home's next button:
  - a drill's Read-first lesson always came first;
  - a locked step was replaced by an explained replay ("Replay D04 at Silver (D18 needs D04 ★★ at Silver or Gold)").
- Where it stops making sense:
  - After D18 the path is "complete" with no button. D18's Debrief shows "🔒 Next drill: D11", and the obvious next actions (D18 and D07 at Silver) are not offered, although the same replay mechanism handled D18's own prerequisites (N-C6).
  - The Silver replays are the same seed with the same computed card, so "replay at Silver" reads as a toll rather than a step (N-C7).

**Is D16 right-sized in evening one now? In content, yes. In wall time it is still the biggest single block.**
- It is the first drive, at minute 24. Every word on its card was taught by the three lessons before it.
- The fast-forward stops at T-45 s, the IN prompt comes 44 s before the sign, and a card follower gets ★★★ on the first try. In PT-08 it was ★★ and a fight.
- But it takes 29 minutes (82 minutes of sim time at 4x with the hold fast-forward), a quarter of the evening. The card says "~21 min at 4x".
- Running transits and the lunch hold at 8x by default, or offering "fast-forward to 45 s before the OUT" at every hold, would cut it to about 15 minutes.

**Is D06 measurable as coached at Silver? Yes, if Josh reads the pace aid at both MARKs; no, if he follows the MARK-out sentence literally. And it does not need measuring at all.**
- **Measured as "net = late at MARK out - late at MARK in"** (stop & go chart pause = 15 - net; the accel from 0 = late at MARK out): **10/10 ★★★** on seed 1 (driver B) and seed 2 (`pt10-d06-t1-s1-measure-net-debrief.png`).
- **Following the MARK-out text literally** ("Chart pause time = 15 s minus your seconds late against the ghost here … with the full 15 s sat"): stop & go gives -2.1, -11.9 and -24.1, so stop & go is 0/3 and the run is ★★. The Debrief says "a negative net loss, an outlier: delete it or re-run" (`pt10-d06-t1-s1-measure-literal-debrief.png`).
  - Cause: a measuring run is always late at MARK A1 in (+5.5 s from the on-the-second standing start), and later stops stack on that.
- **Not measuring at all**: press C at the pre-read. The overlay is headed "YOUR CAR'S CHARTS: 1939 FORD DELUXE … (THIS ONE) (DRIVER B)". Copying it scores **10/10 ★★★ at Silver and at Gold** (`pt10-d06-silver-overlay.png`, `pt10-d06-t1-s1-copy-debrief.png`).
  - The card's simple chart and the STOP row's "card 3.5 s" give the same numbers.

**Do D09's which-way cards teach? Mostly, yes, but the answer key leaks.**
- Every card is a scene (a CAMEO picture and the line) plus a decision, and the tip names the rule. Examples: the jog is "TWO turns", acute means "doubles back", AFTER is the first real road past the sign, and green vs red signs.
- Two problems:
  1. **The right option is the longest on 19 of 20 cards.** A test-wise teen scores about 19/20 without reading the scene. Several wrong options are strawmen ("Stop and wait for a GR sign", "Make a U-turn in the road").
  2. **Card 7 ("Straight at SIGNAL") teaches "a red light is a Time Allowance, never both".** That contradicts REG V.H.1 (only a train blockage and an accident are named) and the app's own D08 and D08b, which tell him to make up a red light (`pt10-e1-d09-card7.png`).

**Does Dad's printed card read well? Yes.**
- One Letter page with a black 15 pt title and 21 numbered rules at 11 pt, one rule per line, in plain words ("Do not move until GO", "Green sign = timing checkpoint: do nothing", "Lost: no U-turn in traffic").
- No "she". The instruments line is right.
- Nits:
  - The PDF has no page margin, so text runs to the paper's edge (add `@page { margin: 0.5in }`).
  - The bottom half is blank; 13-14 pt would read better in a moving car.
  - Four lines are cryptic for Dad: 8 "the count goes 0, 1, 2"; 11 "(30 s)"; 17 "'I' = ignore that sign"; 20 "warning, then 10 s, then 1 min".
- See `pt10-dad-card-print.png`.

## 5. New bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| N-C1 | **High** (gate) | D06 Silver/Gold: the "hidden" car's charts are on screen | Open D06 Silver or Gold, press C, copy the cells, drive by the card. **Expected:** the car's numbers are hidden ("Silver and Gold hide the car's numbers, so measure"). **Actual:** the overlay shows "YOUR CAR'S CHARTS … (THIS ONE) (DRIVER B)", the card shows its simple chart, and the STOP rows show "card 3.5 s" (= chart (b) 50>45). 10/10 ★★★ at Silver and at Gold without measuring. | `d06-t1-s1-copy.txt`, `d06-t2-s1-copy.txt`, `pt10-d06-silver-overlay.png`. In `src/ui/screens/cockpit.ts`, `simpleChart(scenario.car)` and the chart overlay ignore the `charts:hidden` tag set in `src/core/drills/d06.ts`. The `card N s` on STOP rows comes from `cockpitinfo.ts`. |
| N-C2 | **Medium** (realism) | D09 card teaches that a red light is a Time Allowance | D09, card "Straight at SIGNAL". **Expected:** no pause; a red light is made up with the 10 % rule (REG V.H.1 names trains and accidents; D08 and D08b say the same). **Actual:** the right answer and tip say "a red light is a Time Allowance, never a make-up AND a TA". | `pt10-e1-d09-card7.png`; `src/core/generator/traps.ts` ~l.266 (tip) and ~l.307 (`speed-at-signal`) |
| N-C3 | **Medium** (education) | D06 MARK-out sentence gives negative cells in a measuring run | D06 Silver, follow "Chart pause time = 15 s minus your seconds late against the ghost here, with the full 15 s sat". **Expected:** the chart cell. **Actual:** -2.1 / -11.9 / -24.1, because the car is already late at MARK in. Stop & go 0/3, ★★. The Debrief says "negative net loss, an outlier: delete it or re-run" (wrong cure: subtract the late at MARK in). At Bronze the same page says "copy the Packard cell" (MARK in), "measure" (MARK out), "sit the full 15 s" and "card 7.2 s" (STOP row). | `d06-t1-s1-measure-literal.txt`, `pt10-e2-D06-t0-1-preread.png`; `src/core/drills/d06.ts` l.185 (MARK out text), rubric l.237-241 |
| N-C4 | **Medium** (education) | Answer-pattern tells | **D09:** the right option is the longest on 19/20 cards (pinned deck seed 123). **Lesson checks:** the answer is option 2 on 10 of 12 path lessons (unshuffled). A rookie learns the pattern instead of the rule. | `path-e1.txt` ("longest-option right on 19/20"); `traps.ts` TRAP_QUIZ right/wrong strings; `content/lessons.ts` `check.answer`; `screens/school.ts` (shuffle at render) |
| N-C5 | **Medium-low** (education) | Turning stops cannot be worked out at the legal rung | D11 rung 1, dwell = pause - DEC(in) - ACC(out) from the card's simple chart, as the pause-arithmetic lesson teaches. **Actual:** each turning stop runs 1.5-2.2 s long ("turn capped at 12 mph": 50>55 costs 14.4 s against the chart's 12.8). ☆☆☆ 31 s. The lesson says "the cockpit card and the Debrief include that", but the legal rung has no card, and the Debrief says "go earlier" without saying by how much at a turn. | `run-d11-legal.txt`, `pt10-d11-legal-debrief.png`; `src/ui/viewmodels/charts.ts` `simpleChart` (no turning-stop column), `content/lessons.ts` pause-arithmetic, `rubrics.ts` tip |
| N-C6 | Medium-low | Path complete with no button; D18's Debrief points at a locked D11 | Finish D18 at Bronze. **Expected:** "Next on your path: Replay D18 at Silver (D11 needs D18 ★)", as for D18's own prerequisites. **Actual:** Home says "Path complete. D11 opens with D18 ★, D07 ★★ at Silver or Gold …" with no button; the Debrief says "🔒 Next drill: D11 (needs …)". | `pt10-e3-home-end.png`, `e3/path-e3.txt`; `src/ui/viewmodels/curriculum.ts` `pathNext` / `pathCompleteText`, `screens/home.ts`, `screens/debrief.ts` |
| N-C7 | Low-Medium (design) | Silver replays are near-repeats | "Replay D03/D04/D05/D08 at Silver": same seed 1, and the Silver card still prints "dwell 20.2 s after", the call times and the ramp leads. ★★★ for a card follower, about 40 min of evening two. The lock is honest but teaches little. | `path-e2.txt` (card dwell parsed at Silver); `src/core/drills/common.ts` `tiers` / `aidsForRung(2)` |
| N-C8 | Low | D10 coaches the 10 % rule before the path teaches it, and ★★★ needs time skill in the course drill | D10 Bronze on course: ★★, "recover it with the 10 % rule right after the turn"; ★★★ needs a leg within 10 s. The recovery lesson comes 9 steps later. | `path-e1.txt` D10 Debrief; D10 rubric / tip |
| N-C9 | Low | D06 pre-read contradicts itself | "A measuring run: leave ON your second (no launch lead) …" and, in the same paragraph, "launch your standing-start loss early". | `12-misc.txt`; `cockpit.ts` generic pre-read sentence |
| N-C10 | Low | Residual lines on legs that came out right | D16: "Leg 2 0 s (buckets sum +4, rounding residual -4)", and "Start / restart +9" when every departure was on its second. The stage shows the same. | `path-e1.txt`; `src/ui/viewmodels/debrief.ts` buckets |
| N-C11 | Low | The lock chip shows a lesson id | Home: "🔒 D10 Course following (needs pass the lesson "lost")". | `pt10-e1-home-start.png`; `curriculum.ts` `startPathState` calls `lockText` without `lessonTitle` |
| N-C12 | Low | "Bezel" keys on the digital watch (N-B15(3) leftover) | D03 keys: "G go when the bezel hits the card dwell · [ ] set the bezel". | `pt10-e1-D03-t0-1-preread.png`; `src/ui/viewmodels/hints.ts` l.8 |
| N-C13 | Low | Dad's card print nits | Zero page margin; half the page blank at 11 pt; lines 8, 11, 17 and 20 are cryptic. | `pt10-dad-card-print.png`; `styles.css` print block, `content/lessons.ts` protocol card |
| N-C14 | Low | Cockpit polish | The folded pre-read's "Show the pre-read" button overlaps the box title over the scale toolbar. The status line says "Pro (expert)" on D16 Bronze while the driver panel says "Dad". | `pt10-e1-D16-t0-1-after-ff.png`; `cockpit.ts` |

Carried over and still open: **N-B14** (D10 distractor and T check-off; see section 2).

## 6. Where the Debrief advice was wrong or unhelpful
1. **D06 Silver, literal measurer.** "A run of -11.9 s is a negative net loss, an outlier: delete it or re-run." Re-running gives the same number; the cure is to subtract the late he had at MARK in (N-C3).
2. **D06 Silver/Gold copied from the overlay.** "Clean run: 10/10 chart cells within 1 s. Keep the chart in the car": praise for copying the hidden answer (N-C1).
3. **D11 legal.** "Your stops cost more than the printed pause, so go earlier" is true, but it never says the turning stops are the cause or by how much (about 1.6 s each) (N-C5).
4. **D10 on course.** "Recover it with the 10 % rule right after the turn", a lesson nine steps ahead (N-C8).
5. **D16 worked row.** "Ideal go = 11:12:00 - 4.4 s = 11:11:55; you called go at 11:11:56 -> +0.5 s", while the card says launch at 11:11:56 and the headline says "on the second". Rounding noise presented as an error.
6. **Helpful and right:**
   - D04: "Compound lines … the 40 s starts when the ghost leaves" (no false instrument line).
   - D08: "deliberate make-up … not the driver wandering".
   - D10 lost: "doubled = 84.4 s … Your 84 s is within 2 s", with the full lost doctrine.
   - D07: per-point read-offs and k.
   - D08b: "Your watch 0m40s beside the engine's 0m59s (off by 19 s: start the watch when the car is held …)".
   - D16: "Every departure was on its second".

## 7. Confusing moments (in the order Josh meets them)
- **Home:** D10's chip says "needs pass the lesson "lost"".
- **Lessons 1-4:** 24 minutes and 3,950 words before he drives. Lesson 1 still spends six paragraphs on TA paperwork. Every check's answer is the second option.
- **D16:** the folded pre-read's button sits on its own title. The status line says "Pro (expert)" though he was told Dad drives.
- **D09:**
  - "Red light: a Time Allowance". The next evening, D08 says make it up.
  - The long answer is always right.
- **D10:** at every STOP-T Dad first says "Too late, I can't make that left at this speed" (for a side road nobody asked for), then "Straight on past line 4, you did not call a turn" as he turns left.
- **D06 Bronze:** one page says "copy the Packard cell", "measure, do not compensate", "sit the full 15 s" and "card 7.2 s". Then 19 minutes of driving, graded only on the copy.
- **Evening two:** "Replay D03 at Silver": the same course, with the same card telling him the dwell.
- **After D18:** "Path complete", and no button.

## 8. What two realistic evenings reach
- **Evening one (about 1:55):**
  - 8 lessons (about 47 min of reading);
  - D16 ★★★, D09 ★★, D10 ★★, D01 ★★★ and D03 ★★★;
  - 13 of 23 path steps.
- **Evening two (about 2:00):**
  - 4 lessons, then D04, D05, D06, D08 and D07, all ★★★ at Bronze;
  - every Bronze step ticked;
  - the first three Silver replays (D03, D04, D05).
- **Evening three:**
  - D08, D10 and D16 at Silver (about 48 min), then D18 (9 min): path complete at about 1:00;
  - then D18 and D07 at Silver for D11, and D11 itself (23 min at 4x, likely ☆☆☆ first time at the legal rung).
  - The day stage is a fourth evening (97 min at 8x).
- My Josh made no driving errors beyond the two planned D09 misses. A real rookie's retries (D10, D06, D08) would end evening two around D07, with the Silver replays filling evening three.

## 9. Top-10 fixes (ranked; file hints)
1. **Hide the car in D06 Silver/Gold (N-C1).**
   - For `charts:hidden` scenarios, show no simple chart, no overlay matrices and no "card N s" on the STOP rows; show "Your car's chart is what you measure today" instead.
   - Files: `src/ui/screens/cockpit.ts` (simpleBox, chart overlay), `src/ui/viewmodels/cockpitinfo.ts`, `src/core/drills/d06.ts` tags.
2. **D06 wording (N-C3, N-C9).**
   - MARK out: "net loss = your late here minus your late at MARK in; chart pause time = 15 - net (with the full 15 s sat)".
   - At Bronze, keep the MARK lines to "copy the Packard cell" and drop the "card N s" / measuring sentences.
   - In the rubric, when a negative stop & go note equals 15 - late(out), say "subtract the late you had at MARK in".
   - Fix the pre-read's launch-lead sentence on measuring runs.
   - Files: `src/core/drills/d06.ts` (l.185, rubric l.237-241), `cockpit.ts` pre-read.
3. **D09 red-light card (N-C2).** Right answer: "Straight on at the leading edge, no pause; a red light is yours to make up with the 10 % rule (REG V.H.1 names trains and accidents)". File: `src/core/generator/traps.ts` `speed-at-signal`.
4. **Answer-pattern tells (N-C4).**
   - Write the D09 wrong options as specific and as long as the right one (no strawmen).
   - Shuffle the lesson check options with a seeded order, and keep `answer` by value.
   - Files: `traps.ts` TRAP_QUIZ, `content/lessons.ts`, `src/ui/screens/school.ts`.
5. **Turning stops at the legal rung (N-C5).**
   - Add a turning-stop note or column to the simple chart ("turning stop: + X s"), and teach it in "Pause arithmetic" with one number.
   - Make the "go earlier" tip name the turning stops and the seconds.
   - Files: `src/ui/viewmodels/charts.ts`, `content/lessons.ts`, `src/core/rubrics.ts`.
6. **N-B14 (D10 distractor and T check-off).**
   - The driver should apply a called turn to the instruction's own intersection (or ask "This one?") instead of spending it on the first road that way.
   - Start the Bronze "Next: call the left" prompt after the distractor.
   - At a T, the check-off says "Did the left at the T".
   - Files: `src/core/sim.ts` `processCheckoffs` / `peekExit`, `cockpitinfo.ts` nextCall.
7. **A button at the path's end (N-C6).** Extend `pathNext` to D11's prerequisites ("Replay D18 at Silver (D11 needs D18 ★)", "Replay D07 at Silver …"), then D11 itself; put the same button on D18's Debrief. Files: `src/ui/viewmodels/curriculum.ts`, `screens/home.ts`, `screens/debrief.ts`.
8. **Make the Silver replays a step up, or shorter (N-C7).** Either drop the computed dwell and call times from the Silver card for D03, D04, D05 and D08 (Josh works them out from the simple chart, as the lesson teaches), or accept Bronze ★★★ plus one Silver drill for D18. Files: `src/core/drills/common.ts` tiers, `aidsForRung`.
9. **Lighten evening one.**
   - Move lesson 1's TA procedure into the recovery lesson.
   - Split "Transits and restarts" (1,445 words) and "Team protocol" (1,893) into a short "read now" part and a reference part.
   - Run transits and holds at 8x so D16 fits about 15 minutes.
   - Files: `content/lessons.ts`, `src/ui/viewmodels/timescale.ts`.
10. **Text hygiene (N-C8, N-C10 to N-C14).**
    - Grade D10 on course and lost doctrine (★★★ without a 10-s leg), with no 10 % advice before its lesson.
    - Hide residual lines on legs that came out right.
    - Use lesson titles in lock chips and drop "bezel" from the D03 keys.
    - Dad's card: `@page` margin, 13 pt, plain wording for lines 8, 11, 17 and 20.
    - Fix the folded pre-read button overlap, and use one driver name.
    - Files: `rubrics.ts`, `debrief.ts`, `curriculum.ts`, `hints.ts`, `styles.css`, `content/lessons.ts`, `cockpit.ts`.

Ratings: realism 4.0/5, fun 4/5. **Verdict: yes, with fixes 1-4 first.**
- The fix sprint landed: 13 of 16 PT-08 bugs are fixed, 7 of the top-10, and nothing regressed.
- The path now reads as the Four S's and its Next button is trustworthy end to end.
- The weak spots moved from navigation to integrity:
  - D06 Silver/Gold can be passed by copying the "hidden" chart;
  - D09 teaches one wrong TA rule and leaks its answers by length;
  - the legal rung cannot work out a turning stop from what it is given.

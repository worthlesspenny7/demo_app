# PT-07: Playability on the fixed V3 build (PT-05 replayed after the PT-05/PT-06 fix sprint)

Build under test: HEAD bcdc8b3 (the fix sprint is commit 5bd53b2; ENGINE 3.1.0). I ran `npm run build`, copied `dist` to a pinned snapshot and served it with `vite preview --port 4178`. The browser was Chromium at /opt/pw-browsers/chromium, driven by Playwright at 1366x768. The method is PT-05's:
- Every player action is a real key press or a real click or fill.
- Sim time moves only through `window.__rally.advance`, and the cockpit loop is held.
- One browser profile carries the evening from script to script: lesson 1, D01, D03, D04, D05, D08b, D18, D16 and D11.
- The full day stage and a second D11 run used copies of that profile. The probes (layout, resume, campaign, book, charts, marks, clocks) used scratch profiles that are never saved.

- **Scripts:** `playtest-scripts/pt07-*.ts`. `pt07-common.ts`, `pt07-human.ts` and `pt07-run.ts` are the PT-05 harness with three changes:
  - port 4178;
  - the wall-time estimate follows the new PLAY-003 rule (a hold runs at the chosen scale until 60 s before its out time);
  - the navigator reads "leave AT" on the lunch card and presses the red Done button.
  The model now also takes an unprinted OUT speed as the speed carried (used for the second D11 run only). The numbered steps are `pt07-01` through `pt07-13`, plus `pt07-probe-*.ts` and `pt07-debrief-dump.ts`.
- **Screenshots:** `docs/playtest/screenshots/pt07-*.png`: 38 files, 6.1 MB in total, the largest 0.65 MB.
- **Sub-agents:** no Agent tool was available in this session, so I drove every drill group myself.
- **Page errors:** zero uncaught page errors or console errors in every run.

## 1. The evening as played

| t (wall) | What Josh did | Result | Wall |
|---|---|---|---|
| 0:00 | Home, then "Next: School: the ghost car". Wrong answer, then right. | The lesson's primary button is now **"Next on your path: D01 Stopwatch on the landmark"**. | 4 min |
| 0:04 | D01 from Start here, naive: pressed D at once. | ★★★ laps but 55 raw s, "blown". The diagnosis is now right: "Early launch: you departed from the pre-read 55.8 s before your launch time". No Observation Checkpoint. Home moves on to D03. | 6 min |
| 0:10 | D01 by the book: "Fast-forward to the launch"; the car launches itself; Space, then L at each marker. | 0 s, 1 ace, ★★★, "Perfect run". | 6 min (1x locked) |
| 0:16 | D03 Bronze naive: waited the printed pause, called the out speed. | 35 s ☆☆☆. The tip is right ("go calls average 6.4 s late"), and the What-if row says "4 pts at the card dwell". | 12 min |
| 0:28 | D03 Bronze by the card, X count. | 3 s ★★★, 1 ace. No turn-loss block at the STOP. The path ticks D03. | 11 min |
| 0:39 | D04 Bronze naive, then by the card, at 4x. | 15 s ☆☆☆ ("timed-change calls 3.7 s off each"), then 2 s **★★☆**: both compound STOP+timed lines were counted from GO (see N5). | 7 + 7 min |
| 0:53 | D05 Bronze naive, then by the card. | Naive **☆☆☆** (was ★★★ in PT-05), but its verdict reads "Clean run". By the card: 1 s ★★★. | 6 + 6 min |
| 1:05 | D08b Bronze: red light timed and made up, train lapped, ledger, web-form login, "Use", Submit, then the pinned **Done (red button)**. | 56 s ★★★, TA 50 of 50 allowed, scorecard acknowledged. Dad: "Stuck behind a slow vehicle at about 18: call pass (P)…" | ~12 min |
| 1:17 | D18 Bronze by the card (ignored the slow truck). | 14 s ☆☆☆. The tip is now the right one: "make it up with the 10 % rule". | 7 min |
| 1:24 | **D16 Bronze** by the card at 8x: queue, W/Q, count, exact transit, lunch "leave AT", restart. | 1 s, 2 aces, ★☆☆. The stars are capped by 3 clock-read findings and by "lunch -3.9 s" (N6, N7). **Holds fast-forward: 15.9 min of wall time (was 63 min).** | 18 min |
| (next evening) | Full day stage `builtin/stage/1` at Bronze by the card, 8x. | Dad asks "What speed for the warm-up? … about 24 mph", and the card prints the same pace. The car moves. 307 s "blown" (no-pause STOPs and turns never made up). **The cockpit collapses at 1366x768 in the pre-read (N1).** | **~95 min at 8x** (was ~157) |
| (later) | D11 Silver (rung 1, legal), dwell from chart (b) in the C overlay. | 39 s ☆☆☆ (my model missed the carried speed at line 14). Re-run with the carried 48 read from the new 48 row: 26 s ☆☆☆. The headline still says "go earlier" (N3). | 23 min at 4x |

**A realistic two-hour evening now reaches D16 Bronze**, which is the V3 start, exact-transit, lunch and restart material. PT-05's evening ended at D18 / D03 Silver.
- Lesson 1 through D18 takes about 87 minutes, including about 2 minutes of reading per Debrief.
- D16 takes about 18 minutes; a D03 Silver or a D18 retry fills the rest.
- The full stage (about 95 min at 8x plus the Debrief) is an evening on its own, and D11 legal adds about 25 minutes.

## 2. PT-05 bugs: FIXED / NOT FIXED / REGRESSED

| PT-05 bug | Status | Evidence on this build |
|---|---|---|
| B1 Start-here path loops on D01 Bronze | **FIXED** | After D01 naive (★★★ laps): "Next: D03 Pause arithmetic". After the evening: School, D01, D03, D04 and D05 ticked, "Next: D08". Lesson 1 and the Debrief carry "Next on your path: …" (`02-d01.txt`, `13-home-end.txt`, `pt07-lesson1-after-check.png`). |
| B2 Day stage: the car never moves after the launch | **FIXED** | 07:59:57 "What speed for the warm-up? The book prints none: about 24 mph makes 8 mi in 20 min", repeated every 30 s. Card: "No speed printed: call about 24 mph (8 mi / 20 min)" (`pt07-stage-after-launch.png`). |
| B3 Restart count invisible; pre-read hides the instruments | **FIXED** (D16) | Start at T-10: the pre-read folds itself to a 128-px strip, and the clock and watch are clear (`pt07-d16-start-T10.png`). Restart at T-5: the card and the "6" sit at the top of the book column, y=110-259 (`pt07-d16-restart-T5.png`). *But see N1: the full stage cockpit now collapses for another reason.* |
| B4 Holds forced to 1x (D16 about 63 min) | **FIXED** | D16 Bronze takes 15.9 min of wall time at 8x. The day stage takes about 95 min at 8x (was about 157). |
| B5 Naive D01 Depart "blown" with the wrong diagnosis | **FIXED** (wording leftovers in N8) | No Observation Checkpoint. The finding is "Early launch … departed from the pre-read 55.8 s before your launch time". The primary button is "Fast-forward to the launch"; D is "Depart early (D)". |
| B6 Lunch "leave by" | **FIXED** | Card: "leave AT 10:27:00 (not before 10:22:00 - 5 min penalty window; 45m00s prior to end of transit)". Dad: "Lunch stop. We leave AT 10:27:00, not before 10:22:00 (5-minute penalty window)". |
| B7 "Clean run" verdicts that contradict the stars | **NOT FIXED** (partly) | No more "Clean run" with a penalty item, but these remain: D05 naive ☆☆☆ "Verdict: Clean run"; D16 ★☆☆ "Clean run … Instrument discipline: 3 x time of day taken without reading the clock"; D04 card ★★☆ "Clean run … 6 x no stopwatch start or lap". `rubrics.ts:85` only checks mean ≤ 3 s and penalties, not the stars or the findings, while PLAY-006 says "no finding". |
| B8 Traffic hold at a STOP billed as a late go | **FIXED** | D18: "Lights, trains or traffic cost you … make it up with the 10 % rule". Stage rows: "you called go at 8.3 s → +0.4 s; traffic held the car 9.6 s (ledger)". |
| B9 Cruise rows use the first speed as "assigned" | **FIXED** (new false positive, N4) | "Leg 1: … assigned 40", "Leg 2 … assigned ~35". |
| B10 Perf card stuck on line 1 through the first timed segment | **FIXED** | D04 card: "Timed change at line 2: call at 12.7; you called at 12.8". D01: the card follows to "Line 4" while lapping. |
| B11 Turn-loss block at a turning STOP | **FIXED** | `pt07-d03-card-stop2.png`: only "Stop 35 in / 40 out (turn capped at 15 mph): loss 6.5 s → dwell 23.5 s". |
| B12 No 48 row; zeros in the Ford turn chart at 10 mph | **FIXED** | 48 row and column on (a), (b), (c) and the simple chart; (c) 10→55 = 6.1 (`07-charts-keys.txt`, `pt07-charts-overlay-d11.png`). |
| B13 Silent slow vehicle | **FIXED** | D08b, D18 and the stage: "Stuck behind a slow vehicle at about 18: call pass (P) when it is clear, or time the loss and make it up". |
| B14 Restart hold line says "Lunch stop" | **FIXED** | "Restart line. Our time is 11:12:00: give me 30 seconds and count me down to the launch second". |
| B15 Launch numbers disagree | **FIXED** | Stage pre-read and card: "launch at 07:59:57 (minus 3 s)". D16 card, Debrief and pre-read: "09:52:56 (minus 4 s for the 4.4 s loss)". A contradictory "Restart, line 1 … leave at that second" block remains (N9). |
| B16 Absurd worked-arithmetic rows | **NOT FIXED** (partly) | The lunch "+1950 s" row and the D05 match-to-an-earlier-call are gone. Still present: D08b "(buckets sum -32, rounding residual +51)", with the cause found (N2); stage "Stop, line 4: entry ? / exit ?; pause 0; car loss ? s" (a STOP inside the warm-up transit). |
| B17 Stale Next-call prompt | **FIXED** | At D03 stop 2 the Next-call bar is empty and only "Pending: turn L" shows. |
| B18 TA "done" button named and placed differently | **FIXED** | "Done (red button)" is pinned in the form header at y=124 (`pt07-d08b-ta-form-filled.png`). |
| B19 30-s banner stays after W | **FIXED** | D16 at T-10, after W: "Pulled up to the sign: hold until your launch time." There is no banner. |
| B20 Campaign "You 0.00" first; Rookie/Sportsman/Expert tier names | **NOT FIXED** | `pt07-campaign.png`: "1 You (1939 Ford, Rookie) 0.00" with 0 of 9 stages played; "Tier: Rookie Sportsman Expert". Listed as not done in STATUS. |
| B21 Discard without a confirm | **FIXED** | "Discard the saved run? It cannot be resumed afterwards." and "Start fresh and discard the saved run?…" (`08-resume.txt`). |
| B22 School index says "three to six minutes each" | **NOT FIXED** | The index still says so, while the cards say 7, 8 and 9 min. Listed as not done. |

**Counts: 18 FIXED, 4 NOT FIXED (B7 and B16 partly; B20 and B22 left by the sprint), 0 REGRESSED.** One new regression in the same area as B3: the full-stage cockpit layout (N1).

Returning-player checks: Resume, F5 and the "choose Resume or Start fresh first" guard on D all work (`pt07-home-resume-panel.png`). Keys help (?) lists W, Q, X, I, M and K and closes on Esc (`pt07-keys-overlay.png`). Pace cars are now met: "car one minute behind" at the D16 restart, and cars ahead and behind in the D16 queue (ASP 13).

## 3. Rubric (0-5; PT-05 in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **4.0** (3.0) | The path works end to end. Lesson 1 leads to D01. The drill start is explained ("The car launches itself at 07:59:56 … fast-forward if you like"). Leftovers: the pre-read's primary button sits below the box's fold at 1366x768 (N10), and the D01 card still says "Warn the driver about 30 s … count" and "Restart, line 1" on a drill start (N8, N9). |
| 2 | Control scheme | **4.0** (3.5) | N is no longer needed at the first stop. The Mark… presets are one select plus Enter with a suggested value at Bronze. The TA form works with the mouse (login, Use, Submit, Done). T no longer focuses a field (N11). |
| 3 | Information layout (1366x768) | **3.0** (3.0) | The drill cockpit is now good: the D16 count is in the book column, the pre-read folds, and the card sits beside the simple chart. **The full stage collapses** (road 34 px, book 25 px at the pre-read; road 128 px after the launch) because the perf card grows without limit (N1). |
| 4 | Pace | **3.5** (2.5) | Holds fast-forward. D16 takes 16 min, the stage 95 min at 8x, and D01-D05 have "Fast-forward to the launch". D01 and D03 stay locked at 1x (10-12 min each); there is no "~N min at 4x" on the cards. |
| 5 | Feedback and progression | **3.5** (3.0) | D05 naive now gets 0 stars, D04 is graded on the call error, the traffic tip is right, and the What-if rows are useful. Trust is still dented by: "you never called 40 at line 3" on a ★★★ run (N4), "Clean run" at 0-1 stars (B7), a doubled TA credit (N2), and "go earlier" for a no-pause STOP (N3). |
| 6 | Dad's messages | **4.0** (3.5) | He asks for the warm-up speed, names the slow truck, the restart and the lunch, and gives the start routine. The echoed 10…1 count still floods the 6-line driver log and pushes his question out of view (`pt07-stage-after-launch.png`). |
| 7 | Difficulty curve | **3.0** (2.5) | A card follower gets ★★★ through D03, D05 and D08b. Uncoached caps remain: D04 ★★ (the compound-line anchor is not on the card, N5), D16 ★ (clock reads never prompted, lunch lead graded, N6, N7), D11 legal 0 ★, stage "blown". |
| 8 | Session-length fit | **4.0** (3.0) | A two-hour evening holds together and reaches D16. Resume, F5 and the confirms are solid. The stage needs its own evening. |
| 9 | Delight / polish | **4.0** (3.5) | The printable page now looks like the organizers' sheet. The hand marks (a struck 0m30s with "P23.5", a circled -6.5) look right. Also good: the Sawtooth dial, the web TA form with its login page, and pace cars on the road. Taken away by the stage layout and noisy Debrief lines. |
| 10 | Frustration / recoverability | **3.5** (3.0) | No blockers: the stage moves, and lunch no longer fails the drill. Frustrations left: the stage cockpit at 1366x768, a Done button that closes the day with nothing filed (N12), and false "never called" lines. |
| 11 | Realism integrity | **4.5** (4.0) | The book anatomy, CAMEO vocabulary, simple chart and footnotes match the frames. So do the web TA form (login, then entry, "between Instructions # & #", 10-s steps), pace cars, the ambiguous minute hand with the TOD hint, and "leave AT". Weak spots: at the legal rung Dad says "Our time is 09:24:00" and the clock caption says "official start 09:14:00", which does the base + ASP arithmetic for Josh (N15); the TA worksheet at Bronze uses the engine's measured delay (0m59s), not Josh's lap (40 s). |
| | **Total** | **41.0 / 55** (34.5) | The four PT-05 blockers are gone and the evening now reaches the V3 material. What is left is one layout regression on the stage and a Debrief that still says a few untrue things. |

## 4. New bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| N1 | **High** | The full day stage cockpit collapses at 1366x768 | Open `#/cockpit/builtin/stage/1` (fresh profile, Bronze). **Expected:** road, clock, watch and book visible as in D16. **Actual:** in the pre-read the drawer (perf card plus the 5th calibration panel) is about 620 px tall. Road 34 px, book 25 px, the watch is a 16-px sliver, and the pre-read box is 0 px with its buttons under the drawer. After the launch the road is 128 px and the watch buttons are cut. It recovers mid-stage (road 195 px) once the card is short. Cause: `.box#perfcard { max-height: none; overflow: visible }` plus the 5-column `.lapboard.with-cal` (perf card 1.8fr) plus the simple chart beside the text plus the Launch, Restart-line-1 and transit-pace blocks. | `pt07-stage-preread-fresh.png`, `pt07-book-cockpit-stage.png`, `pt07-stage-after-launch.png`; `src/ui/styles.css:162-166`; `cockpit.ts` `renderPerfCard` / `renderSimpleChart`. PT-05's stage screenshot had a 155-px road, so this is a regression. |
| N2 | Medium | Time Allowance credit counted twice in the cause buckets | D08b with 0m50s allowed. **Expected:** "Time allowance credit -50", buckets sum = leg error. **Actual:** "-100", "(buckets sum -32, rounding residual +51)". `sim.ts:761` sets `buckets.ta = -l.taCredit`, and `debrief.ts:135` subtracts `l.taCredit` again. | `d08b-full.txt`; `src/core/sim.ts:761`, `src/ui/viewmodels/debrief.ts:135` |
| N3 | Medium | "Go earlier" headline for a STOP with no pause | D11 legal re-run. Every dwell is within +0.6 s (bias row: mean +0.3, sd 0.3, no verdict). **Actual:** the headline says "Your stops cost more than the printed pause, so go earlier". The stop bucket (+16) is line 10's no-pause STOP (car loss 12.2 s), which has to be made up. PLAY-006 is met in the worked rows but not in the headline. | `pt07-d11-legal-carried-debrief.png`; `src/core/drills/rubrics.ts` `headlineTip` (stop branch), `debrief.ts` stop tip |
| N4 | Medium | False "you never called N at line X: the driver kept the old speed" | D03 by the card ★★★: "Leg 1 … ratio 1.002 -> you never called 40 at line 3". Line 3 is 40 in, 40 out, and Dad said "At 40" after GO. The same happens in D08b (35 at line 3) and D11 (25 at line 27). `uncalledSpeeds` flags every STOP line whose out speed was not re-called (`before !== v \|\| ins.pause`), but the driver resumes the old speed by himself, so nothing was lost. | `run-d03-card.txt`; `src/core/drills/rubrics.ts:163-180` (also used by the headline at l.106) |
| N5 | Medium-low | D04 card gives no anchor for a compound STOP + timed line | D04 by the card, lines 4 and 7 ("STOP P15, 25 for 18 then 35"). The card says "call 35 at 15.9 s" with no "from when". The count starts when the ghost leaves (arrival + 15 s); only the Debrief says so afterwards. Counting from GO, the card follower was -2.2 and -2.5 s and got ★★. | `run-d04-card.txt`; `src/ui/viewmodels/cockpitinfo.ts` `perfCardFor` (timed), `cockpit.ts:854` |
| N6 | Medium-low | D16 grades the lunch departure on the second, but allows the launch lead at the exact-transit OUT | D16 Bronze, leading every departure by the standing-start loss as the card and the Debrief teach ("lead the car by the standing-start loss only"). Exact-transit OUT left 10:15:10, due 10:15:14: "(on the second)". Lunch left 10:26:56, due 10:27:00: "(-3.9 s)", "worst departure 3.9 s off". | `d16-bronze.txt`; `src/core/drills/departures.ts:40` (lead per kind), `d16.ts:71`, `cockpitinfo.ts` `holdCardFor` (say "no lead" on the meal card if that is the rule) |
| N7 | Medium-low | D16 at Bronze caps a card follower at ★ for clock reads nobody prompts | "3 x time of day taken without reading the clock (first at line 3) … three stars need no clock finding". The D16 key list names M but not K, and nothing on the exact-transit IN, OUT or restart cards says "read the clock (K)". | `d16-bronze.txt`; `src/core/drills/d16.ts` (keys), `cockpit.ts` restart/hold cards |
| N8 | Low | Drill-start leftovers (D01-D05) | The car launches itself, yet: the card says "Warn the driver about 30 s before; count so the last count lands on the launch second"; the Debrief start row says "no warning to the driver"; the early-departure finding says "give the driver 'about 30 seconds' and count down so GO lands on the launch second". | `pt07-d01-preread.png`, `02-d01.txt`; `cockpit.ts` launch card (l.839), `src/ui/viewmodels/v3.ts:368`, early-launch text |
| N9 | Low | The start line's hold card is titled "Restart, line 1" and says "leave at that second" right under "launch at … (minus 4 s)" | Every start (D01 to the stage). | `pt07-d16-start-T10.png`; `cockpitinfo.ts` `holdCardFor` (start line) |
| N10 | Low | D01-D05 pre-read: "Fast-forward to the launch" and "Depart early (D)" sit below the box's fold | `#skip` y=520 in a 399-px box ending at y=467, under the drawer (`elementFromPoint` is the drawer). Scrolling inside the box reveals them, but nothing shows that it scrolls. | `pt07-d01-preread.png`, `pt07-d01-preread-scrolled.png`, `probe-layout.txt` |
| N11 | Low | T focuses `#ta-request`, which no longer exists | The form has a login page and `ta-min` / `ta-sec`, so after T the keyboard stays in the cockpit. | `src/ui/screens/cockpit.ts:347` |
| N12 | Low | "Done (red button)" closes the day with no prompt while a claim is pending | First D08b attempt: Done with the 0m50s suggestion unfiled gave ☆☆☆ "No Time Allowance request was filed", "Scorecard acknowledged". Expected: "You have an unfiled 0m50s for leg 1: file it first?" | `cockpit.ts` `ta-done-pin` |
| N13 | Low | Mark… presets: the prompt opens in the drawer bar at x=250, far from the book row (x ≥ 929), with only a placeholder; an empty entry says "Nothing to identify: type what to look for" (the ICE wording) | D03, "Time of day" on line 4, Enter on an empty field. | `10-marks-clock.txt`; `cockpit.ts` `promptText` (l.365-372), `writeMark` |
| N14 | Low | Pace chip and pace aid in untimed states | "+27.0 s late" while sitting in the warm-up transit (nothing is timed), "EARLY ▲" during the restart hold, "Pace aid: -28.7 s" while stopped at a STOP. Persists from PT-05. | `pt07-stage-after-launch.png`, `pt07-d16-restart-T5.png`, `pt07-d03-card-stop2.png` |
| N15 | Low | The legal rung does the base + ASP arithmetic for Josh | D11 Silver (rung 1): Dad says "Restart line. Our time is 09:24:00"; the clock caption says "official start 09:14:00". | `run-d11-legal.txt`, `pt07-charts-overlay-d11.png`; `sim.ts` restart `say`, `cockpit.ts` clock caption |
| N16 | Low | The echoed count floods the driver log | Ten lines of digits push Dad's question out of the 6-line panel. | `pt07-stage-after-launch.png`; driver log render |
| N17 | Low (cosmetic) | Sawtooth face | The minute hand is barely longer than the hour hand and does not reach the minute track, so the two hands look alike at 9:51. The paddle tail of the second hand covers "WWV". The "outer numbered track" of INST-003 shows triangles only. | `pt07-clock-sawtooth.png` |
| N18 | Low | Turn chart (c) has a cliff between the 12 and 15 mph rows | 12→15 is 0.1 s but 15→15 is 1.0 s; 12→20 is 0.4 s but 15→20 is 2.0 s. A rookie will not trust it. | `07-charts-keys.txt`; `src/ui/viewmodels/charts.ts` |

## 5. Where the Debrief advice was wrong or unhelpful

1. **D03 by the card, ★★★ champion:** "you never called 40 at line 3: the driver kept the old speed". He did not need to (N4). The same line appears in D08b (with a -4.1 s make-up gain blamed on it) and in D11.
2. **D05 naive, ☆☆☆, 2.6 s late at each change:** "Verdict: Clean run: the remaining seconds are speed-holding noise". The stars line and the tip line say the opposite (B7).
3. **D16 ★☆☆:** "Clean run" next to three instrument findings. Also "Leave on the second; lead the car by the standing-start loss only", while the lunch departure is graded with no lead (N6).
4. **D11 legal:** "go earlier" when every dwell was within 0.6 s and the loss came from a no-pause STOP (N3).
5. **D08b:** "Time allowance credit -100" and "rounding residual +51" (N2). The stop What-if rows are true but useless ("if you had called go at 21.0 s instead of 21.5 s, cp1 would have been +19 (was +19)").
6. **D01 naive:** "give the driver 'about 30 seconds' and count down" in a drill whose car launches itself (N8).
7. **D03 Leg 4:** "+0.1 s … the driver wandered under the speed: call +1 sooner". A tenth of a second should not get a tip.
8. **Helpful and right:**
   - D03 naive "go calls average 6.4 s late", with the What-if "4 pts at the card dwell".
   - D18 "lights, trains or traffic … 10 % rule", and the stage rows "traffic held the car 9.6 s (ledger)".
   - D08b "Leg 1: delayed 58 s by the train, 4 s could have been made up; you requested 50 s, the committee allowed 50 s".
   - Stage "You lost 132 s in stops and recovered 32 s in cruise; recover a little more".
   - D04 naive "write T - lead on the page before the segment".

## 6. Confusing moments (in the order Josh meets them)

- D01 pre-read: the big button you need (Fast-forward) is hidden under the drawer until you scroll the box.
- D01 card: "Launch … launch at 07:59:56" next to "Restart, line 1 … leave at that second" and "Warn the driver … count", in a drill with no count.
- D03 at Bronze still drives the 1936 Packard. The hint says so now ("Bronze hands you the 1936 Packard charts and drives the Packard"), but the age factor (0.830) and the simple chart change under him.
- D04: "call 35 at 15.9 s" at a STOP with a timed segment. From GO, or from "Stopped"?
- D08b: the TA worksheet says "measured 0m59s" when his own laps said 40 s. The form has two red done buttons: the pinned one and the web page's own "CLICK this after submitting ALL Time Allowances".
- D16: lunch left with the same 4-s lead as every other departure turns into "worst departure 3.9 s off".
- Stage: sitting at the warm-up start, the chip says "+27.0 s late" while Dad asks for a speed, and the count digits fill the driver log.
- Legal D11: Dad states "Our time is 09:24:00" for a restart Josh is meant to work out.

## 7. The new features

| Feature | Verdict |
|---|---|
| Pre-read "Mark…" presets (PREREAD-002) | **Help.** One select per row, a suggested number at Bronze (P23.5, the circled -6.5, "(3) COMES QUICK"), and none at the legal rung. The marks render like pencil on the sheet: the struck 0m30s with "P23.5" beside it, the circled loss (`pt07-mark-row-d03.png`). Costs: every row carries a tool strip about 35 px tall, so the cockpit book shows only 3-4 rows; the input appears away from the row (N13); the printable book does not show the marks (known). |
| Sawtooth clock (INST-003) | **Good, and the right default.** White dial, brass rim, WWV under the hub, red second hand. With the loose minute at :58 the warning "minute hand is between marks: read the minute on the watch (TOD, M)" appears. The bezel option works from Settings (`pt07-clock-bezel.png`). Cosmetic issues in N17; at 92-108 px it is small next to the 325-px watch. |
| Simple chart on the card (CHART-007) | **Helps** (Speed / Dec / Acc / S/G / T@15 / T@20 with the 48 and 12 rows, the current speed highlighted). It is the main cause of N1 on the stage, where it squeezes the card text into a narrow column. |
| Web TA form with login (TAF) | **Helps and is realistic** (login page, then entry: Stage, Leg Number, "Between Instructions 5 & 6", Allowance m/s, Reason). Bronze's "Use" button pre-fills everything, the pinned Done fixes B18. See N11 and N12. |
| Drill-sized starts (PLAY-005) | **Help.** D01-D05 no longer open with a 60-s procedure, and the auto-launch removes the PT-05 trap. Wording leftovers in N8 and N9. |
| Hold fast-forward (PLAY-003) | **The biggest win of the sprint.** D16 drops from 63 to 16 minutes and the stage from about 157 to about 95 minutes at 8x. |

## 8. The book renderer against the real 2026 sheet

Reference: `docs/research/frames/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-26.jpg`. Compared with `pt07-book-stage-p1.png`, `pt07-book-stage-p5.png`, `pt07-book-d11-p1.png`, `pt07-book-cockpit-d16.png` and `pt07-mark-row-d03.png`.

**Printable page (`#/book/...`): yes, it now looks like the real sheet.** It matches on:
- **Column layout:** the five-column grid with A B C D heads over an unlettered number gutter, the instruction number bottom-left in the gutter, and no page header.
- **Column B pictograms:** the Column B tire (warm-up) and speedometer (calibration) pictograms with four odometer squares, the last one inverted ("0080", "0186" against the frame's "0090", "0240").
- **Column C:** bold, centred, unboxed: "CDT" over a digital-watch pictogram with "8:00:00", then "20m00s". The calibration row matches the frame's row 6: "50 MPH / 28m00s" over a box with "0m00.0s", and "Cal 1" boxes holding two times.
- **Column A CAMEOs:** the dot and stem, the elbow, sign faces drawn inside the cell ("Leaving New Hampton City Limit", "Calibration Start"), the small outlined STOP glyph and the three-lamp light.
- **Footer:** the three blocks, "© 2026, Great Race" | "Hemmings Motor News Great Race / Page 1 of 39" | stage over date.

It still differs on:
1. **Column D at Bronze.** The Bronze day stage prints example-style sentences in Column D ("Turn right at a crossroad at a Traffic Light."), by design (`bookStyleForRung`). The real page keeps D for remarks ("comes very quick - use rightmost toll booth", "$1.50", "5th" plus a light icon), and the D11 race-style page does too.
2. **Section arrows.** The real page runs a long vertical arrow down Columns B and C from the transit's first row to its end (the tire and clock in row 1 down to row 6). The generated page has none, so the extent of a transit or calibration section is not visible.
3. **Sparse CAMEOs.** Row 1 is a bare arrow, where the frame shows a road name "(US 1 North)" and a landmark picture with a bold caption ("Ogunquit Playhouse"). The traffic-light glyph sits off the junction with a dashed stub.
4. **Footer and page count.** The right footer block says "fullStage #1" rather than a stage name. 200 lines make 39 pages (about 5 rows a page); the real day is 13-26 pages with 6 rows on page 1.
5. **Marks.** The marks Josh writes in the cockpit are not on the printable page (known).

**Cockpit book: the same rows, but it reads as an app list.**
- Each row has the sheet's anatomy and a white page background, the restart and Information Box rows are styled, and there is a "Page 2 of 39" divider (`pt07-stage-midrun.png`).
- But every row carries a dark tool strip (four colour swatches, the "Mark…" select, the GO-at field and the card value) about as tall as a third of the row. Only 3-4 rows fit in the 344-px column, and the dark strips break the sheet look.
- The marks themselves look convincingly hand-written.
- In the stage pre-read the column collapses to 25 px (N1).
- Suggestion: show the tool strip on the current and hovered row only, or behind a "mark-up mode" toggle during the pre-read.

## 9. Does a two-hour evening hold together?

**Yes, now it does.**
- **First hour:** lesson 1 → D01 (naive, then by the book) → D03 (naive, then by the card) → D04 is short, fast-forwardable and teaches cleanly. The path follows Josh and never loops.
- **Second hour:** D05 → D08b (light, train, ledger, web form, Done) → D18 → **D16 in about 18 minutes**. That brings Josh to the V3 start, queue, count, exact-transit, lunch and restart material inside the evening, and nothing blocks.
- **What still sours it:** a few Debrief lines that are simply untrue (N2, N3, N4, B7). The full stage is a separate 95-minute evening, and at 1366x768 it opens on a collapsed cockpit (N1). Fix N1 before Josh's first stage night.

Ratings: realism 4.5/5, fun 4/5 (was 4 and 3).

## 10. Top-10 fixes (ranked; file hints)

1. **Stage cockpit layout at 1366x768 (N1).**
   - Give the perf card a height limit (for example `max-height: 38vh; overflow: auto`) instead of `max-height: none; overflow: visible`.
   - Cap the drawer at about 45 % of the viewport.
   - Fold the simple chart or the calibration panel when the card carries Launch, Restart or transit blocks.
   - Files: `src/ui/styles.css:162-166`; `src/ui/screens/cockpit.ts` `renderPerfCard`, `renderSimpleChart`, the calibration panel.
2. **Debrief truthfulness (N4, N2, N3, B16 leftovers).**
   - In `uncalledSpeeds`, drop STOP lines whose out speed equals the speed carried (`src/core/drills/rubrics.ts:163-180`).
   - Count the TA credit once (`src/core/sim.ts:761` or `src/ui/viewmodels/debrief.ts:135`).
   - When the stop bucket comes from no-pause STOPs, the headline should say "make up the N s with the 10 % rule", not "go earlier" (`rubrics.ts` `headlineTip`, `debrief.ts` stop tip).
   - Skip STOP rows inside transits (`debrief.ts` `workedStops`).
3. **"Clean run" gating (B7).** Require ≥ 2 stars and no instrument or start finding, otherwise lead with the first finding. Files: `src/core/drills/rubrics.ts:77-85`, `src/ui/screens/debrief.ts:33`.
4. **Anchor on compound STOP + timed lines (N5).** The card should read "call 35 at 15.9 s after the ghost leaves = 24.9 s after 'Stopped'". Files: `src/ui/viewmodels/cockpitinfo.ts` `perfCardFor`, `cockpit.ts:854`.
5. **D16 coaching (N6, N7).**
   - Make the lunch departure's lead rule match the exact-transit OUT (`src/core/drills/departures.ts:40`), or print "leave AT, no lead" on the meal card.
   - Add "K read the clock" to the D16 keys and a Bronze nudge on the IN, OUT and restart cards (`src/core/drills/d16.ts`, `cockpit.ts` hold and restart cards).
6. **Drill-start text clean-up (N8, N9, N10).**
   - No warn/count line and no "Restart, line 1" block when `startProcedure === 'drill'`, and title the start line's block "Start".
   - Drop "no warning to the driver" from drill rows.
   - Move the pre-read buttons above the objective, or make the box tall enough.
   - Files: `cockpit.ts` (l.782-789, l.839), `cockpitinfo.ts` `holdCardFor`, `src/ui/viewmodels/v3.ts:368`.
7. **Untimed-state chips and the count flood (N14, N16).**
   - Hide the pace chip and the pace aid in transits, holds and stops (or show "transit: untimed").
   - Collapse the echoed 10…1 count into one updating driver line.
   - Files: `cockpit.ts` HUD and pace aid, the driver log render.
8. **TA form polish (N11, N12).**
   - T focuses the first empty field (`cockpit.ts:347`).
   - Done asks "leg 1 has an unfiled 0m50s claim: file it first?" while a suggestion is pending.
   - At Bronze, show the worksheet with Josh's own lapped delay next to the engine's.
9. **Legal-rung giveaways (N15).**
   - At rung ≤ 1, Dad should say "Restart line: what's our time?" and the clock caption should say "base 09:00 + your ASP".
   - Files: `src/core/sim.ts` restart `say`, `cockpit.ts` clock caption.
10. **Book realism and PT-05 leftovers.**
    - Book: vertical section arrows in B/C for transits and calibration (`src/ui/render/griid.ts`, `src/ui/viewmodels/book.ts`), a stage title in the right footer block, a mark-up toggle for the cockpit tool strip, and marks on the printable page.
    - Campaign: no standings rows before a stage, and Bronze/Silver/Gold tier names (B20, `src/ui/screens/campaign.ts`).
    - School: fix the index minutes (B22, `src/ui/screens/school.ts`).
    - Drill cards: add "~N min at 4x" (`src/ui/screens/home.ts`).

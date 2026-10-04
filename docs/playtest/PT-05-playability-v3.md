# PT-05: Playability and enjoyment on the V3 build (Josh's first two hours)

Build under test: HEAD 14d6c85 (ENGINE 3.0.0). `npm run build`, with the `dist` snapshot pinned and served by `vite preview --port 4177`. Chromium at /opt/pw-browsers/chromium through Playwright at 1366x768, the laptop size Josh is most likely to use. Every player action is a real key press or a real click/fill. Sim time moves only through `window.__rally.advance`, and the cockpit loop is held, so wall-clock time never drives the sim. One browser profile carries the whole session: localStorage is passed from script to script, so the Home path, stars and Last runs behave as they would for Josh. Exceptions: the full day stage ran in a copy of the profile, and the probes used fresh profiles.

- Scripts: `playtest-scripts/pt05-*.ts`. `pt05-human.ts` models the navigator. It only reads what a person sees (book rows, perf-card text, the road's "ahead" list at approximate distances, Dad's lines, the scale rules) and presses keys after a reaction delay of 0.3 ± 0.06 s. It has three modes:
  - `naive`: waits the printed pause, calls speeds at the sign, counts timed segments from the sign.
  - `card`: does what the perf card says.
  - `legal`: works the dwell out from the chart overlay values Josh read.
- `pt05-run.ts` plays one drill from start to finish and dumps the Debrief with every fold open.
- Screenshots: `docs/playtest/screenshots/pt05-*.png`.
- Wall-clock estimates use the cockpit's own adaptive-scale rules (`src/ui/viewmodels/timescale.ts`, plus the launch-count rule). They assume the scale Josh would pick from the hint bar.
- No Sonnet sub-agent tool was available in this session, so I drove every run myself. The "returning player" checks (resume, F5, campaign) are in section 6.
- Zero uncaught page errors in every run.

## 1. The session as played

| t (wall) | What Josh did | Result | Wall time |
|---|---|---|---|
| 0:00 | Home, then "Next: School: the ghost car". Answered the check wrong, then right. | Clear, right-sized (236 words). The primary button then says "Next: The Four S's", not D01. | 4 min |
| 0:04 | D01 from Start here, naive. Pressed the big orange **Depart now (D)** as the pre-read says ("Depart with D"). | ★★★ laps (+0.2 s, jitter 0.0), but the headline reads **"237 points, benchmark: blown"**: "One-minute mistake: the minute was misread … dash clock's minute hand", plus the Observation Checkpoint +180 s. | 7.5 min (locked 1x) |
| 0:12 | D01 Retry by the book: W at T-31, Q, D on the visible GO, S at the finish. | 1 raw s, champion, "Clean run". | 7 min |
| 0:19 | Home: Start here still says **"Next: D01"** after two ★★★ Bronze runs. | Path loop (B1). | n/a |
| 0:20 | D03 Bronze, naive: waited the printed pause and forgot to call 40/30 after GO. | 43 s, 0 ★. Stop tip right. The "Also" line and the cruise lines are wrong (section 4). | 14 min (locked 1x) |
| 0:34 | D03 Bronze by the card: Space at "Stopped", X count, G at the card dwell, out speed after GO. | 3 s, ★★★, 1 ace (+0.3 to +0.6 s per stop). **The best moment of the session.** | 12 min |
| 0:46 | D04 Bronze naive (from the sign, printed seconds), then by the card at 4x. | 14 s ☆, then 2 s ★★★. | 8 + 8 min |
| 1:02 | D05 Bronze naive (speed at the sign), then by the card. | **Naive scored ★★★ champion (1 s)** while every call was 1 to 4 s late. Card: 2 s ★★★. | 6 + 6 min |
| 1:14 | D08b Bronze: red light timed and made up with +10 %; train lapped, put in the ledger, filed on the 2026 web form. | 57 s ★★. TA allowed 50 of 50. Scorecard not acknowledged (button below the fold). Leg 2 lost +31 s to a slow vehicle Dad never mentioned. | ~12 min |
| 1:26 | D18 Bronze (locked on Home, opened by URL) by the card, with X count. | 22 s, 0 ★. Traffic held the car 8.6 s at the stop, and the Debrief blamed Josh's go. | 7 min |
| 1:33 | D03 Silver by the card. | 4 s ★★★, and the path finally ticks D03. "Next" still says D01. | 12 min |
| 1:45 | D16 Bronze by the card (start queue, W/Q, count, exact transit, lunch, restart). | 62 s, ☆☆☆: left lunch 7 min early because the card says **"leave by 10:27:00"** (+60 s). Debrief verdict: **"Clean run"**. | **63 min at 8x**: holds of 17, 24 and 30 min run at forced 1x |
| (2:48) | Full day stage `builtin/stage/1` by the card at 8x. | First attempt: **car never moved after the launch**. The warm-up transit has no speed and nothing prompts Josh (10 min tested, 2 h by script). Retry calling 24 mph: 314 s, "blown", 5 h 26 min of sim time. | **~157 min at 8x** |
| (later) | D11 Silver (rung 1, legal), dwell from chart (b) in the C overlay. | 39 s, 0 ★: one STOP with no pause (12 s unavoidable) and one 48-mph stop he could not look up (the charts have no 48 row). | 26 min at 4x |

The path the task asked for adds up to about 5.5 hours of wall time. **A realistic two-hour evening ends at about D18 or D03 Silver.** D16, the day stage and D11 do not fit, and D16 alone needs an hour even at 8x.

## 2. Rubric (0-5; REVALIDATION-ui score in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **3.0** (4.0) | Start here plus lesson 1 are clear (`pt05-home-fresh-1366.png`, `pt05-lesson1-right.png`). But: (a) the path never advances for Bronze play, and its Next button always opens Bronze seed 1 (B1, `pt05-home-after-d01.png`). (b) D01's pre-read says "Depart with D" next to an orange **Depart now (D)**, and the naive press costs 237 points "blown" on a reaction drill (`pt05-d01-preread.png`, `pt05-d01-debrief.png`). (c) The Observation-Checkpoint S is never mentioned in the D01 pre-read. (d) Three different standing-start numbers sit on one screen (pre-read "about 4.4 s", card "leave ~4.2 s early", "minus 4 s"). (e) Lesson 1 sends Josh to lesson 2 rather than to D01. |
| 2 | Control scheme | **3.5** (4.0) | Digits+Enter, arrows, Space/L, G, and the new W/Q/X keys all work. The keys overlay (?) now fits and no longer covers the HUD. Still: D departs instantly from the pre-read, N is needed at the first stop ("Book is on line 1: press N"), and ICE (I) needs a typed sign name, so nobody will use it while driving. |
| 3 | Information layout (1366x768) | **3.0** (4.0) | The pre-read box covers the clock and the whole stopwatch during the start procedure, which is exactly when LESSON-006 asks Josh to read them (`pt05-d16gold-T-10.png`). The restart count sits at y=241, below the 155-px road view, and cannot be seen (`pt05-d16-restart-count-road-T5.png`). The TA form covers the road and clock and scrolls internally, with File and Acknowledge below the fold (`pt05-d08b-ta-form-filled.png`). At a turning STOP the perf card adds an irrelevant "Turn loss … 10 % rule" block (`pt05-d03-card-stop3.png`). |
| 4 | Pace | **2.5** (3.0) | D01/D03 are still locked at 1x (D03 takes 10 min). Card minutes are now honest (D16 "~1 h 25 min at 1x", D11 "~57 min"). Holds force 1x, though: D16 needs about 63 min even at 8x, the day stage about 2 h 37 min at 8x, and D11 legal 26 min at 4x. There is no "skip to 1 minute before the out-time". |
| 5 | Feedback and progression | **3.0** (4.0) | The stop loop is excellent (D03: 43 s naive, then 3 s by the card; the What-if rows). But the Start-here loop, D05 naive ★★★, D04 "0.1 s off each" next to "2.4 s late", D16 "Clean run" at 0 ★, the D18 traffic delay billed as a late go, "assigned 35" on every leg, and the lunch printed as a 1950-s stop all undercut trust (section 4). |
| 6 | Dad's messages | **3.5** (3.0) | Real progress: "Give me about 30 seconds before we go", the echoed count, "Keep counting", "Waiting on traffic", "Clear, going", "Train!", the scoring crew lines. On the other side: the echoed count floods the 6-line log with digits; every restart hold says **"Lunch stop. Say go at our restart time"** (D11 and D16, where no lunch exists); Dad says nothing when the car sits with no speed (day stage) or when he is stuck behind an 18-mph vehicle (D08b); he never says "I see it" first and only says "Mark" after the navigator types an I. |
| 7 | Difficulty curve | **2.5** (2.5) | Bronze and Silver (rung 3/2, card on screen) give ★★★ for following the card. D18, the first mixed leg, gives a card-follower 0 ★ because of the traffic, turn and hazard seconds nobody coached. D11 legal gives 0 ★ because of a no-pause STOP and the missing 48-mph row. D16's one-minute rule fails the drill on an ambiguous card word. |
| 8 | Session-length fit | **3.0** (4.0) | Resume is solid: the Home panel, the cockpit banner, F5 landing on a pre-read that offers Resume, and the D-key guard ("choose Resume or Start fresh first") (`pt05-home-resume-panel.png`, `pt05-cockpit-resume-banner.png`). But the V3 start and restart practice lives inside hour-long drills, and Discard has no confirm. |
| 9 | Delight / polish | **3.5** (3.5) | The big 10…1 GO count with Dad echoing it, the 2026 TA form with its make-up-the-odd-seconds helper, the printable GRIID book (`pt05-book-drill-D11-1-1.png`), the campaign standings and the driver card. Taken away by a stage that will not move, a count you cannot see, and absurd Debrief lines. |
| 10 | Frustration / recoverability | **3.0** (4.0) | The stuck stage start (no prompt for 10+ min), lunch "leave by" turning into +60 s and 0 ★, the endless Start-here loop, and a silent slow vehicle. Resume and recovery from a wrong turn are good. |
| 11 | Realism integrity | **4.0** (3.5) | V3 is the most faithful build yet: nobody releases you, the launch lead, the car-ahead queue (Q refused, `pt05-d16gold-preread.png`), the loose minute hand with a "read the minute on the watch" warning (`pt05-d16gold-clock-ambiguous.png`), the TA = stopped + chart loss arithmetic, the 10/20 % make-up table with chunks, 48 and 55 mph. Weak spots: the TA helper and "wait N more s" compute the answer at Bronze; legal mode prints "Official start 09:14:00" (base+ASP done for you); the charts have no 48 row; the Ford turn chart's 10-mph row and column are all 0.0; pace cars never showed in two hours. |
| | **Total** | **34.5 / 55** (39.5) | The V3 features are mostly good, but they arrived with new layout, pace and advice regressions, plus one blocker on the full stage. |

## 3. Bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| B1 | **High** | Start-here path never advances for Bronze play, and its button loops on D01 Bronze | Fresh profile. Lesson 1, then D01 Bronze ★★★ twice. **Expected:** "Next: D03" (the panel text says "play D01, D03 and D04 at Bronze"). **Actual:** "Next: D01 Stopwatch on the landmark" forever. The button opens `#/cockpit/drill/D01/0/1` (Bronze), which can never complete the step. After D03 *Silver* ★★★, D03 is ticked but Next still says D01. | `pt05-home-after-d01.png`. `src/ui/viewmodels/curriculum.ts` `startPathFromProgress` (Silver/Gold only, UI-028); `src/ui/screens/home.ts` `startHerePanel` (tier 0 hard-coded, panel text) |
| B2 | **High** | Full day stage: the car never moves after the launch | `builtin/stage/1`, launch on the count. Line 1 is "Begin Tire Warm-up (a transit of approximately 8 miles); take approximately 20 minutes", with no MPH. Dad says "Leaving 3 s early" and the car then stays `state: stopped`, speedo 0, with no Dad line, no Next call (rung 3) and no card hint, for 10 min (2 h in the first scripted try). Typing 40 Enter fixes it. **Expected:** Dad asks "What speed for the warm-up?" or the card says "transit: call ~24 mph (8 mi / 20 min)". | `pt05-stage-stuck-at-start.png`, `pt05-07-stage-start.ts`. `src/core/sim.ts` (depart with no assigned speed, `say` at l.593); `src/ui/viewmodels/cockpitinfo.ts` `perfCardFor` |
| B3 | **High** | The restart count is invisible at 1366x768, and the start pre-read hides the instruments | D16 Bronze restart hold, T-5: `#start-count-road` box y=241, h=57, while the road view ends at y=223. The number is clipped, and only Dad's bubble "Dad: 6" shows it. At the start (D16 Gold) the pre-read box covers the stopwatch completely and half the clock during the launch, so the director's method (watch TOD plus the clock's second hand) cannot be done by eye. | `pt05-d16-restart-count-road-T5.png`, `pt05-d16gold-T-10.png`, `pt05-d16gold-ambiguous-minute.png`. `src/ui/styles.css` (.road-start, .startcard, .preread), `src/ui/screens/cockpit.ts` `roadStart` / `buildPreread` |
| B4 | **High** (pace) | Holds run at forced 1x: D16 takes about 1 h even at 8x | D16 Bronze by the card at 8x. Exact-transit hold 17 min, lunch about 24 min, restart hold 29.5 min, all at 1x because `carStopped`/`waitingForGo` gives scale 1. Total wall about 63 min. The day stage needs about 157 min at 8x. | `pt05-12-d16-restart.ts` log ("hold until launch 1768 s"). `src/ui/viewmodels/timescale.ts` `effectiveScale` (add a hold-seconds-left input), `cockpit.ts` `baseScale` |
| B5 | Medium | Naive Depart scores a reaction drill as "blown", and the diagnosis is wrong | D01 pre-read: press D (as told). Dad says "Leaving 60 s early". Debrief: "237 points … benchmark: blown … observation checkpoint missed", "One-minute mistake: … the minute was misread. The dash clock's minute hand is loose…", and also "Early launch: No start or restart was launched before its launch second" (it left 55 s before). The same trap exists in every drill's pre-read. | `pt05-d01-debrief.png`. `src/ui/viewmodels/v3.ts` findings (50-70 s window treated as a misread; early launch excluded), `cockpit.ts` `buildPreread` (Depart is the primary button), D01 scenario in `src/core/drills/index.ts` (start procedure and Observation Checkpoint in a reaction drill) |
| B6 | Medium | Lunch card says "leave **by** 10:27:00"; leaving early costs +60 s and 0 ★ | D16 Bronze. The meal-stop card reads "leave by 10:27:00 (45m00s prior to end of transit)", while Dad says "We leave at 10:27:00". Leaving at 10:20 gives "Early departure: left a promoted stop 7.0 min early: +60 s" and ☆☆☆. **Expected:** "leave AT 10:27:00, not before". | `run-d16-card` log. `src/ui/viewmodels/cockpitinfo.ts` `holdCardFor` (l.190-211) |
| B7 | Medium | Debrief verdicts contradict the stars and penalties | D16 (above): ☆☆☆ "Wrong minute at … lunch departure" and +60 s, yet "Verdict: Clean run: the remaining seconds are speed-holding noise" and "No one-minute mistake, no disturbed timed interval, no late or early launch". | `src/core/drills/rubrics.ts:54` ("Clean run" ignores penalty items), `src/ui/viewmodels/v3.ts` summary |
| B8 | Medium | A traffic hold at a STOP is billed as a late go | D18 Bronze by the card. Go called at 6.5 s (ideal 6.0), then "Waiting on traffic" for 8.6 s. Fix-this-next: "Your stops cost more than the printed pause, so go earlier". The What-if row says "if you had called go at 6.0 s instead of **15.1 s**" while the worked line says 6.5 s. | `pt05-d18-card-debrief-full.png`. `src/ui/viewmodels/debrief.ts` (stop tip, `counterfactual.ts` dwell uses dwell including traffic) |
| B9 | Medium | Worked cruise uses the book's first speed as "assigned" for every leg, and blames the card | D03 naive (out speeds never called): "Leg 1: mean true speed 31.7 for assigned 35 … your card is 10.6 % low (call more)" and "Cruise error scatters: the driver is wandering". The leg was assigned 40, the speedo is a perfect Timewise, and the real cause is that the navigator never called 40. | `src/ui/viewmodels/debrief.ts:333` `workedCruise` (`assigned = book.find(speed)`) |
| B10 | Medium | The perf card stays on line 1 through the first timed segment | D04 Bronze. Approaching line 2 ("bridge, 30 for 15 s then 40") the card still shows Line 1 (start/launch). Line 2's call time is never shown, and the card follower called at 14.8 instead of 12.7 (+2.1 s). The first stop of every drill still needs N. | `probe-d04` log, `pt05-d03-naive-stop2.png`. `src/ui/viewmodels/cockpitinfo.ts:90` `focusLine`, check-off of line 1 in `sim.ts` |
| B11 | Medium | At a turning STOP the card also shows the non-stop "Turn loss … 10 % rule: 44 mph for 45 s makes up 4.5 s" | D03 line 2 shows "loss 6.5 s (turn capped) → dwell 23.5 s" and also "This turn L 35→40: 4.5 s, 10 % rule …". A rookie will make up 4.5 s the dwell already covered and arrive early. | `pt05-d03-card-stop3.png`. `cockpitinfo.ts` `perfCardFor` (turnLoss for STOP lines) |
| B12 | Medium | Charts have no 48-mph row or column, and the Ford turn chart's 10-mph row and column are all 0.0 | D11 Silver line 14 (48 in/out, STOP P15): Josh could not look 48 up, waited the printed 15 s, and lost 13 s. Generated books assign 48 (SPEED-001). Chart (c) reads "IN 55 / OUT 10 = 0.0" next to "55/15 = 4.7". | `run-d11-legal` log, `pt05-charts-overlay-d11-legal.png`. `src/ui/viewmodels/charts.ts` `chartGrids`, `src/core/perf-table.ts` |
| B13 | Medium-low | A slow vehicle costs 31 s with no Dad line and no prompt | D08b leg 2 shows +31 s. The road shows "Slow vehicle ahead (~18 mph)", Dad says nothing, and P is not in the hint bar. The Debrief lumps it into "Hazards" with no per-leg line. | `pt05-probe-hazards.ts`. `src/core/sim.ts` hazard `say` |
| B14 | Low | Dad's restart hold line says "Lunch stop" | `sim.ts:987` `if (k === 'restart') say('Lunch stop. Say go at our restart time')`. Heard at D11 line 4 and D16 line 6 (no lunch at either). | transcripts |
| B15 | Low | Launch numbers disagree | Stage line 1: pre-read "launch at 07:59:57 (minus 3 s)" vs perf card "07:59:56 (minus 4 s)". D16 Debrief "launch 09:52:55 (minus 4.4 s)" vs card "09:52:56". "Standing start: leave ~4.2 s early" vs "loses about 4.4 s". | `src/ui/viewmodels/v3.ts:47` `startLaunchFor` vs cockpit pre-read text |
| B16 | Low | Absurd worked-arithmetic rows | Stage: "Stop, line 105 (lunch) … you called go at 1939.5 s → +1950.6 s" and "Stop, line 4: entry ? / exit ?". D05: a call made 0.3 s after the sign is matched to the previous identical call, "called 99.4 s before; -97.0 s". D08b leg panel: "(buckets sum -31, rounding residual +50)". | `debrief.ts` worked stops and speed changes |
| B17 | Low | The Next-call prompt goes stale | "Next call: call the left at line 3" while "turn L pending" and stopped at line 3. | `pt05-d03-card-stop3.png` |
| B18 | Low | The TA "done" button is named and placed differently from the lessons | The lessons and the Reference say "red done button". The form says "Acknowledge scorecard", below File in a scrolling panel. D08b lost a star ("scorecard not acknowledged"). | `pt05-d08b-ta-form-filled.png`, `cockpit.ts` TA panel |
| B19 | Low | The "About 30 seconds: tell the driver" banner stays up after W and after "About 30 seconds, got it" | | `pt05-d01-count-banner.png` |
| B20 | Low | Campaign ranks "You 0.00" first before any stage; tiers are named Rookie/Sportsman/Expert while drills say Bronze/Silver/Gold | | `pt05-campaign.png` |
| B21 | Low | Discard a saved run: one click, no confirm | | `pt05-08-resume.ts` |
| B22 | Low | The School index says "three to six minutes each", while the cards say 7, 8 and 9 min | "What the rally school adds" is 2,221 words (~11 min). | `pt05-school-index.png` |

Fixed and confirmed: keys overlay placement (V3), F5 mid-run then Resume (N4), Debrief survives reload in the same session, quiz/numbers no page errors, `#/campaign` lock redirect with a note.

## 4. Where the Debrief advice was wrong or unhelpful

1. **D01 naive.** It says "the minute was misread … loose minute hand". Josh actually pressed D during the pre-read, and "Early launch: none" contradicts a 55-s early departure.
2. **D03 naive.** The "Also" line says "subtract 6 more from every dwell **on the card**, or react on 'one', not 'go'". He never used the card, and "react on one" contradicts the team-protocol lesson, where GO is the only signal.
3. **D03 naive.** "Your card is 10.6 % low (call more)" and "the driver is wandering; ask for the read-back". The real cause was out-speeds never called after the stops. "Assigned 35" is wrong on every leg (B9).
4. **D04.** The stars line says "timed changes 0.1 s off each", while the bias row says "Timed changes average 2.4 s late". The star gate uses the net bucket, not the call error.
5. **D05 naive.** ★★★ "champion" for calling every change at the sign (1 to 4 s late): alternating up and down changes cancel. The drill does not teach "half a ramp early" at Bronze.
6. **D16.** "Clean run" with 0 ★ and +60 s; "no early launch" with a 7-min early lunch departure.
7. **D18.** "Go earlier" for a +0.5-s go plus an 8.6-s traffic hold. The right tip is "traffic: time it, put it in the ledger, make it up".
8. **D11.** A STOP with no pause is billed "ideal dwell 0.0, you called go at 1.0 s → +13.2 s", and the noise row says "Your dwells scatter: count the bezel out loud". The scatter is that unavoidable 12-s loss (it should say "make it up") and one stop at 48 mph that the charts cannot look up.
9. **Instrument discipline.** "Interval counted on the clock" when the player never touched the clock. He just did not lap at the anchor. Suggested wording: "no lap at the landmark".
10. **Helpful and right:** the D03, D04, D08b and day-stage top tips ("dwell = printed pause - loss", "make up stop losses with the 10 % rule", the TA committee line "4 s could have been made up"), the worked dwell lines, the start-vs-launch table and the What-if rows.

## 5. Confusing moments (in the order Josh meets them)

- The lesson's primary button leads to lesson 2. The Home path says D01 next.
- D01 pre-read: "Depart with D" plus an orange "Depart now (D)", and a launch procedure (Q, W, minus 4 s) on a lap-the-markers drill. Then "observation checkpoint missed +180 s", which nobody had mentioned.
- Three numbers for the same standing-start loss (4, 4.2, 4.4 s).
- "Base 08:00:00 + ASP 0 min" in D01 to D05, while the lessons say position 1 is base + 1 minute.
- D03 Bronze silently drives a **1936 Packard** with the Packard's charts. The lessons and Dad's car are the Ford.
- After GO the driver keeps the old speed; nothing tells a rookie that he must call the new one ("Going … At 35" while the book says 40).
- At a turning STOP the card shows both the capped stop loss and a separate turn loss with a make-up instruction.
- "Pace aid: -12.8 s" while stopped at a stop, and "EARLY ▲" during a 30-min restart hold.
- D16 lunch: "leave by" (card) vs "We leave at" (Dad) vs "due 10:27:00" (Debrief).
- Every restart: "Lunch stop. Say go at our restart time".
- Stage start: the car sits after "Leaving 3 s early" with no question from Dad.
- TA form: "Acknowledge scorecard" (the "red done button" from the lessons) is below the fold, and leaving it unpressed costs a star.
- Legal mode still prints "Official start 09:14:00" and "Line 4: RESTART at 09:24:00", which is the base + ASP arithmetic D16 is meant to test.

## 6. Returning-player checks

- **Resume:** Home shows "A run was in progress: stage #1 (saved 1 min ago, 14 actions)" with Resume, Restart the same seed and Discard. Opening the same source shows the cockpit banner, and D is refused until Josh chooses. Resume restored tod 35971 and the running watch. F5 lands on the pre-read with the banner. Discard happens without a confirm (B21). Evidence: `pt05-home-resume-panel.png`, `pt05-cockpit-resume-banner.png`, `pt05-cockpit-after-f5.png`.
- **Campaign:** locked until D12 Silver; `#/campaign` redirects home with the note "The campaign is locked: D13 needs D12 ★ at Silver or Gold". With D12 Silver injected, the screen is clear: ten stages with their ASP, the division discards, the standings and the tie-break rules. The D13 pre-read even has "the car ahead is sitting … pull up around it". Issues are in B20. Evidence: `pt05-campaign.png`.
- **Printable book:** `#/book/drill/D11/1/1` gives 5 pages, race style, a 7/8 rows selector and Print. The stage book is 29 pages, example style. `#/book/last` works. The race-style page looks like the real five-column GRIID (`pt05-book-drill-D11-1-1.png`).
- **Charts (C):** three IN x OUT grids. At Bronze the current pair is highlighted; legal mode says "find your own pair". It is readable, but needs a 48 row and a fix for the 10-mph zeros (B12).
- **Keys (?):** 640x515, centred, fits without scrolling, closes on Esc, lists all of W/Q/X/I/M/K. Fixed.

## 7. The V3 features: help or hindrance

| Feature | Verdict |
|---|---|
| Start queue + launch count (W, Q, 10…1 GO, Dad echoes) | **Helps in D16/D11; gets in the way in D01-D05.** At Bronze the big count in the pre-read is the most satisfying new thing: launch +0.4 s every time, "Leaving 4 s early". Problems: Q refused while the car ahead is at the sign is realistic but unexplained before it happens; the count is invisible at restarts at 1366x768 (B3); at legal rung the pre-read hides the watch and clock (B3); and every short drill now opens with a 60-s procedure whose naive shortcut (D) wrecks the score (B5). |
| Pace cars | **Not seen in two hours.** D01-D05, D08b and the stage run with ASP 0, so there is no car ahead or behind. D16 Gold (rung 0) showed none 30 s after the start (occasional by design). Cannot help Josh yet. |
| TA web form | **Helps.** All the 2026 fields, leg auto-filled, a 10-s step, the helper "measured 0m58s = stopped 0m50s + chart loss 7.8 s; make up the odd 8 s, claim 0m50s", the pattern sentence, and a classic-paper toggle. The helper does the arithmetic at Bronze (an oracle), and the form overlays the road. The Acknowledge button is easy to miss (B18). |
| Make-up ledger | **Helps.** E +7 shows the +10 % (38.5 mph, 70 s) and +20 % (42 mph, 35 s) options, the chunks and "drop at the next speed sign". "Log chunk" took the total to 0. It is a lot of text in a 340-px box, and the Bronze pace aid makes it optional. |
| Driver's new lines | **Mostly helps** (the 30-s request, the count echo, keep counting, waiting on traffic, clear going, train). Hurts where wrong or silent: the "Lunch stop" label (B14), silence on the stuck stage start (B2) and the slow vehicle (B13), and the count digits flooding the log. |
| Ambiguous clock | **Good when you can see it.** The hand is drawn between the numerals at :57 with the warning "minute hand is between marks: read the minute on the watch (TOD, M)". M gives "09:50:57.10", and K notes a TOD read (`pt05-d16gold-watch-tod.png`). It only exists at rung ≤ 1, so Josh never meets it at Bronze, and at the start, where it matters, the pre-read covers it (B3). |

## 8. Realism vs fun, and the driver's card

- **Is a two-hour session engaging?** The **first hour, yes**: lesson 1, D01, D03 and D04 give short, clear loops, and the Debrief turns a 43-s naive run into a 3-s card run with obvious cause and effect. That is the hook, and it works. The **second hour breaks down**:
  - the path loops;
  - D05 rewards doing it wrong;
  - D18, the first "real" mini-leg, gives a careful card-follower 0 ★ with the wrong tip;
  - the V3 start/restart practice (D16) costs an hour of mostly 1x waiting and fails on one word of the lunch card;
  - the full stage does not move until you guess you must call a speed.
- **Ratings:** realism 4/5 (the most faithful build yet), fun 3/5. A rookie gets the procedure right but waits a lot and is sometimes told the wrong reason.
- **Would Dad understand the driver's card?** Mostly, yes. It is eight plain lines: eyes on the road, read back turn and speed, "Stopped" at the rock-back, GO is the only signal, "keep counting", talk only about instructions, "comes quick", team errors (`pt05-driver-card.png`). Three gaps:
  1. Line 3 ("the navigator names the sign; say 'I see it' or 'I see it too'") does not say who says which. It should say "whoever sees it first says 'I see it'; the other says 'I see it too'".
  2. The start routine is missing ("ask for 30 seconds; the count ends on the launch second; leave on GO, not on your minute").
  3. Rule 6 of the lesson ("leave exactly on it") contradicts the launch lead ("leave ~4 s before your minute").

## 9. Top-10 fixes (ranked; file hints)

1. **Unstick the Start-here path (B1).** Let a Bronze ★ complete a path step (unlocks can stay Silver-only), or make the step and its Next button target Silver and say so. Never loop the button on a step that cannot complete. Files: `src/ui/viewmodels/curriculum.ts` (`startPathState`, `startPathFromProgress`), `src/ui/screens/home.ts` (`startHerePanel`: tier 0 and the "at Bronze" text).
2. **Transit start with no speed (B2).** Dad asks "What speed?" when he departs with no assigned speed, and the card prints "transit: about N mph (miles / time)". Do not say "Leaving 3 s early" while the car stays put. Files: `src/core/sim.ts` (start/depart near l.593, driver `say`), `src/ui/viewmodels/cockpitinfo.ts` `perfCardFor`.
3. **Fast-forward through holds (B4).** Let the adaptive scale run during `waiting:hold` until 60-90 s before the out-time (the count already forces 1x from 40 s), and add a "Skip to 1 minute before my time" button on the hold card. Files: `src/ui/viewmodels/timescale.ts` `effectiveScale` (new `holdSecondsLeft` input), `src/ui/screens/cockpit.ts` `baseScale`.
4. **Start/restart layout at 1366x768 (B3).** Dock the start card and count in the drawer or above the instruments, not inside the 155-px road. Make the pre-read box collapsible (or dock it over the book) so the clock and watch stay visible during the launch. Files: `src/ui/styles.css` (.preread, .road-start, .startcard), `cockpit.ts` (`buildPreread`, `roadStart`).
5. **Drill-sized start procedure (B5).** In D01-D05, auto-launch on the count, or make "Depart on the count" the primary button and drop the Observation Checkpoint from D01. Re-word the early-departure finding ("you departed before your time from the pre-read"). Make "Early launch" count any departure before the launch second. Files: `src/core/drills/index.ts` (D01-D05 scenarios), `cockpit.ts` `buildPreread`, `src/ui/viewmodels/v3.ts`.
6. **Debrief consistency pass (B7, B8, B9, B16, section 4).**
   - "Clean run" only when there are no penalty items and the stars are at least 2.
   - Exclude traffic-held seconds from the stop tip.
   - A STOP without a pause should say "make it up", not "go earlier".
   - Skip lunch and warm-up rows.
   - Use each leg's own assigned speed in `workedCruise`.
   - Grade D04/D05 on the absolute call error, not the net bucket.
   - Drop "react on 'one'".
   - Files: `src/ui/viewmodels/debrief.ts` (l.333, l.360, stop rows), `src/core/drills/rubrics.ts:54`, `src/core/drills/index.ts` (D04/D05 rubrics l.44-66), `src/ui/viewmodels/counterfactual.ts`.
7. **Lunch and restart wording (B6, B14).** The card should read "leave AT 10:27:00 (not before: +60 s)". Dad's restart line should be "Restart: say go at our launch second", with "Lunch" kept for meal stops. Files: `cockpitinfo.ts` `holdCardFor` (l.190-211), `src/core/sim.ts:987`.
8. **Perf card accuracy (B10, B11, B17).** Move the pointer off line 1 at Bronze/Silver as soon as the car departs, so the first timed segment has its card. Hide the non-stop "Turn loss / 10 %" block on STOP lines (the dwell already includes it). Clear a Next call once that turn is pending. Files: `cockpitinfo.ts` (`focusLine`, `perfCardFor`), the `sim.ts` `nextCallNow` check-off.
9. **Charts and numbers (B12, B15).** Add a 48 row and column (or a printed "48: halfway between 45 and 50" note), fix the turn chart's 10-mph zeros, and use one rounding rule for the launch everywhere (pre-read, card, Debrief). Files: `src/ui/viewmodels/charts.ts`, `src/core/perf-table.ts`, `src/ui/viewmodels/v3.ts` `startLaunchFor`.
10. **Session polish (B13, B18, B19, B21, pace cars).**
    - Dad: "Stuck behind a slow truck: pass (P) or time it".
    - Rename the TA ack to the lessons' "Done: print my scorecard" and pin it to the top of the form.
    - Clear the 30-s banner after W.
    - Confirm before Discard.
    - Give D16/D18/D11 an ASP ≥ 1 with a visible car ahead, so the pace-car feature is actually met in the first evenings.
    - Show "~N min at 4x" next to "at 1x" on the drill cards.

## 10. Verdict

**Playable for the first hour; fix B1-B4 before Josh tries the V3 material.** The core teaching loop is as good as before. V3 adds real procedure that Josh will meet on the road: the launch count, the queue, the TA form, the make-up ledger and Dad's count. But in the second hour he hits:
- a Home path that loops;
- a full stage whose car never moves;
- a restart count he cannot see on a laptop screen;
- an hour-long D16 of waiting that ends on the word "by".

A half-day sprint on fixes 1-5 would likely bring the score back above 40/55.

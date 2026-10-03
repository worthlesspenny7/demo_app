# Validation: playability and enjoyment (Rally Trainer v1)

Validator: playability + enjoyment pass. Question: will Josh (engineer, solo, evenings, two weeks) find the app playable, clear and fun enough to keep training, and does the game-play serve the realism of the real task?

Method: `npm run build`, `vite preview` on :4174, Chromium (Playwright) at 1366x768 and 1920x1080 (also 1280x720). A modelled first-time-but-competent navigator (`playtest-scripts/val-player.ts`) presses REAL keys (arrows with B/A/J modifiers, digits+Enter, Space, L, N, G, S), reads the on-screen perf card text, has 0.3 s human latency, and only uses `window.__rally.advance` to skip waiting. Sim time stood in for wall time; wall time was computed by replaying the app's own adaptive-scale rules (and checked once in real time: 1x = 3.0 sim s per 3 s, 4x = 12.0, 8x = 24.1). Scripts: `playtest-scripts/val-*.ts`. Screenshots: `docs/playtest/screenshots/val-*.png`.

Session played: Home -> School lesson 1 -> D01 -> D03 Bronze twice (naive, then retry) -> D04 -> D09 quiz -> D18 -> D11 Bronze (full leg, 28 lines, all stops/turns by key) -> D03 Gold and D11 Gold (1920x1080) -> first 20 sim-minutes of D12. Not played: D05, D06, D07, D08/D08b, D10, D14-D17 (so the unlock gate to D18/D11 was bypassed with direct URLs and is judged from the code and the card minutes).

## 1. Rubric (0-5 each, evidence)

| # | Dimension | Score |
|---|---|---|
| 1 | First-run clarity (what to do within 60 s) | 2.0 |
| 2 | Control scheme (eyes-on-road, hands-on-watch) | 3.5 |
| 3 | Information layout at 1366x768 / 1920x1080 | 3.0 |
| 4 | Pace (real time vs adaptive scale; does a 5-min drill hold attention) | 3.0 |
| 5 | Feedback and progression | 3.5 |
| 6 | Dad's messages | 3.0 |
| 7 | Difficulty curve Bronze->Gold, D01->D11->D12 | 2.5 |
| 8 | Session-length fit (stop/resume) | 2.5 |
| 9 | Delight / polish | 3.5 |
| 10 | Frustration points / recoverability | 3.0 |
| 11 | Realism integrity (aids, scoring) | 3.0 |
| | **Total** | **32.5 / 55** |

### 1. First-run clarity: 2.0
- Home (`val-home-1366x768.png`) opens on a two-line blurb and 25 cards, page height 2608 px at 1366x768. Nothing says "start here". D01 and D03 look exactly like D15-D17. School is a nav link, not a first step. D02 is silently absent from the ID sequence.
- Picking D01 (`val-d01-preread-1366x768.png`) shows a generic pre-read overlay about "highlight pauses, write the GO time", which is irrelevant to D01 (a lap-on-the-sign reaction drill). The drill objective ("Lap the watch exactly as the front bumper passes each sign") is on the Home card only; the cockpit never restates it, and there is no "press L" hint. Space/D/L are discoverable only from the overlay text or the Keys button (hidden by default, and it covers the nav bar when opened: `val-cockpit-keys-overlay.png`).
- What works once running: the road view labels the sign ("~150 ft MARKER 1", `val-d01-marker-approach.png`), the book row says "Lap at MARKER 1", and the Bronze pace bar says "+0.4 s late". A patient person works it out in 2-3 minutes, not 60 s.
- Tier select ("Bronze/Silver/Gold") and seed box on every card are unexplained; the drawer jargon "aids rung 3" appears only inside the cockpit.
- School lesson 1 is clear, short, and the check gives a good explanation on a wrong answer (`val-school-lesson1-wrong.png`); the last lesson goes to Home, not to a drill.

### 2. Control scheme: 3.5
- Good: digits+Enter to call a speed (typed 36 -> `speed 36`), arrows for L/R/S with B/A/J held for bear/acute/jog, Space/L/Enter for the watch, G/S/U/P for driver commands, Esc pause, `,`/`.`/`>` scale, **Shift+R** for reset ("a slip must not destroy a run"), `+`/`-` nudge. A run of D11 took ~100 key presses for 28 lines and none were awkward. Left hand on watch keys, right hand on arrows works.
- Problems: (a) **the current book line does not advance to a STOP before the car stops**. At the first stop of D03 (`val-d03-t0-run2-card-at-stop.png`) the book highlight and the perf card still show line 1 "START"; the dwell card for line 2 only appears after N is pressed. My first retry used the line-1 card and dwelled 8.9 s instead of 20.2 s (-11.3 s). Nothing prompts "press N". (b) Ledger/TA open a text input that steals keyboard focus (fine, but unlabelled in the HUD). (c) D09/D14 quizzes are mouse-only (key `1` did nothing). (d) The Keys overlay covers the nav and the HUD.
- Sound could not be judged headless (cue code exists for watch clicks/beeps/speech).

### 3. Information layout: 3.0
Measured rects (`val-05-layout.ts`, `val-06-resize.ts`):
- 1366x768: no overflow except a 2 px page scroll (scrollHeight 770 vs 768). Road view 983x266 (small); the 240 px stopwatch overlaps the bottom 13 px of the road view (`val-d03-run-1366x768.png`); the speedo is 135 px; the lap list is a 24 px-wide column of tiny text (`laps panel: L2 1:05.4 +0:29.1`). Bezel text ("bezel 20.0s") collides with the dial legend. Book shows ~5 lines, drawer fits. Everything needed is visible at once, which is also the realism issue (no look-down cost).
- 1920x1080: roomy and clean (`val-d03-run-1920x1080.png`, `val-d11gold-t900s.png`); the stopwatch is 396 px; the road view is a large empty dark field with a thin road.
- **Resize defect:** fresh load at 1280x720 gives road width 936 with the book at x=922 (overlap). Resizing 1920 -> 1366 on the cockpit leaves the road canvas at 1561 px and a horizontal scroll (scrollWidth 1561 vs 1366) until reload (`val-cockpit-after-shrink-1366.png`). F11 / devtools / snapping a window will trigger it, and reload discards the run.
- Debrief is 2337 px tall at 1366 (3034 for D11 Gold); the headline panel and the checkpoint table are above the fold (good), the rest scrolls.

### 4. Pace: 3.0
- Default time scale is 1x; D01 and D03 are locked at 1x. The adaptive scaler works (verified in real time: 4x -> 12.0 sim s per 3 wall s, 8x -> 24.1; drops to 1x within 800 ft of a feature, at stops, within 15 s of a bezel/countdown).
- Card minutes understate real time at the default: D01 "~3 min" = 4:19, D03 "~6" = 9:56 (locked 1x), D04 "~7" = 9:57 at 1x (6:04 at 4x), D18 "~6" = 5:16 (3:17 at 4x), D11 "~15" = 26:47 at 1x (14:57 at 4x, 13:00 at 8x).
- A 5-minute drill: D18 holds attention (stop, timed change, speed change, turn, light, finish: something every 30-60 s). D01 does not: ~30-40 s of pure waiting between laps for 8 laps, locked at 1x, and D03 has 95-137 s cruise stretches that also cannot be sped up. First-time Josh will not know `>` exists unless he opens Keys.
- D12 at 4x adaptive: first 20 sim-min took 551 s of wall time (calibration cruise at 50 mph); extrapolated ~70 min for a full stage.

### 5. Feedback and progression: 3.5
- Strong: Debrief headline, per-checkpoint table with ACE flags, "worked arithmetic" with the ideal dwell vs your dwell, counterfactuals ("If you had called go at the card dwell: cp1 0 (was +7)", 39 -> 1 pts), bias-vs-noise table with history. The naive run (40 s, 0 stars) -> retry (7 s, 2 stars, 2 aces) shows the loop working; the Debrief absolutely makes you press Retry (`val-d03-t0-run1-naive-debrief.png`).
- Weak: (a) **Stars are per drill, not per tier** (`recordRun` keys on drill id; unlocks use best stars "any tier"), so Gold has no payoff and a Bronze run with the oracle pace aid unlocks everything. (b) Home shows "Last runs: D01 0.06 pts ★★★ · D03 9.8 pts · D09 16 pts": the units differ (mean error, raw seconds, wrong-answer count) while the Debrief shows "40 points / Raw 40 s x 0.845 = 33.8". (c) No "what next" on Home, no readiness/aces wall. (d) D18 Debrief has no Next button (D18 is last by ID); D11 offers "Next drill: D12" even though D12 is locked and 150 min. (e) After a reload the Debrief is gone ("No finished run yet").
- Misleading advice (see section 8 and defects): the top "Fix this next" in the Checkpoints panel was the turn-callout tip in all of D03 run 1, D03 run 2, D04, D18, D11 and D11 Gold, even when the stops bucket was +41 s; and "the speedometer reads low, call half a mph less" appears in D01/D04/D11 where the drawer says "timewise speedo" (perfect), i.e. it is driver speed-hold noise.

### 6. Dad's messages: 3.0
- Content (D04 log, 41 messages in 10 min; D11 102 in 27 min, about one per 15 s): "Leaving 4 s early", "At 35", "Holding 40", "Left ahead, got it", "Stopped", "Going", "Did the turn, line 2", "Going?" (after 25 s idle at a stop), "I'm going" (50 s), "Red light"/"Green", "Left or right?" when no call, "Road ends here. Dead end!".
- Helpful and correct: read-backs confirm key presses without eyes on the screen; the check-off ("Did that one, line 5") is the best anti-lost-place line; "Going?" is a gentle nudge. Not spammy: log panel shows 6 lines, the road bubble one.
- Not in character: no personality, no variants, no "haven't seen a sign in a while", no reaction to a good/bad run. He is a status read-out, not Dad. Also "Did the turn, line 2" was spoken at the stop even though no turn was called and the car then went the wrong way (false reassurance), and the HUD chip says "cruise" while stopped at a dead end.

### 7. Difficulty curve: 2.5
- Bronze -> Silver -> Gold per drill is a driver + aids change (D03 Gold = rookie driver, rung 1; star thresholds are multiplied by 2.2 for rookie, so Gold is not harder to star: the same play scored 2 stars at 7 s Bronze and 2 stars at 9 s Gold).
- **Cliff D03/D04 -> D18/D11:** D03/D04 Bronze are rung 3 (pace bar showing true +/- seconds and a countdown), D18 Bronze and D11 Bronze are already rung 1 (no pace bar, no countdown, leg number hidden) and D11 Silver/Gold are rung 0. First D18 (Bronze): +28 s, 0 stars. First D11 (Bronze): +43 s, 0 stars.
- D11's 43 s was mostly **Turns +30 s** (8 turns) and the app shows the player no turn-loss number anywhere (not in the perf card, Reference, or the Debrief per-turn lines; `grep turnLoss src/ui` returns nothing). The Debrief tip says "Include turn losses on your card" but there is no card entry. That is the largest unexplained error in the first full leg.
- Unlock gate for D18: D03, D04, D05, D08, D10 all at 2 stars (~35 nominal minutes, realistically 90+ with retries), then D18 1 star + D07 2 stars for D11 (D07 alone ~12 min, a calibration run). D12 additionally needs D15 and D16. A realistic route to the first full leg is two to three evenings, which is acceptable pacing but is not signposted.
- D12 Rookie (tier 0) has a 29 s pre-read for a 222-line book (spec says 30 min) and its first 10 min is a calibration run on a timewise (perfect) speedo, i.e. calibration that cannot teach anything until Silver (stock speedo).

### 8. Session-length fit: 2.5
- Drills of 3-10 min fit an evening slot. D11 is 27 min at 1x (15 at 4x); D12 ~70 min at 4x.
- **There is no save/resume.** Reload in a cockpit -> `phase preread`, run gone. Leaving the cockpit via nav silently discards the run (no confirm); Esc pause is the only break (and it is in-memory). The review required resume at leg boundaries for D12; not present.
- Progress (stars/runs) persists to localStorage; the Debrief does not.
- "progress is not being saved (storage blocked)" flashes in the nav on every first load that is not Home (deep link/reload) even though storage works.

### 9. Delight / polish: 3.5
- Analog dials, the CAMEO diagrams, the road view with a "call turns before here" line, the 3-2-1 pace bar, the timeline graph with CP ticks and the "What if" table are genuinely satisfying; zero page errors across ~15 runs. The ACE flag and "benchmark: expert/champion/rookie" labels are good motivators ("champion" on the first D01 run was a real kick).
- Missing delight: no aces wall/car, no streaks, no sound I could verify, an empty-feeling road view, an unstyled quiz (and the D09 pool is 10 distinct cards drawn 20 times with replacement, options always in the same order), no success moment on unlocking.

### 10. Frustration points / recoverability: 3.0
- Recoverable: skipping the turn call -> Dad "Left or right?" / "Going?" -> "I'm going" -> dead end ("Road ends here. Dead end!", `val-lost-no-turn-call.png`). Pressing U recovered in 76 s ("Heading back" at 20 s, "Back on course" at 76 s). But nothing tells you to press U, the car sits forever (the sim never ends; I ran 33 sim-min), and the HUD says "cruise".
- Unclear failures: the card/Debrief mismatch (below), the turn-timing tip, a "reads low" tip with a perfect speedo.
- Lost place: described above (line not advanced at stops); Gold rung 0 never auto-advances the page (the book is the player's job, as in reality).
- Unrecoverable: the resize overflow (reload -> run lost) and any accidental navigation.

### 11. Realism integrity: 3.0
Good: reaction time and dwell noise are scored honestly; Shift+R reset guard; stop/start loss and the ramp lead use the real car model; dwell = pause - loss is exactly the real technique; "never both TA and recovery" is taught; a diligent card follower is rewarded; Pace aid is labelled as an aid.
Undermining or inconsistent:
1. **Perf card ignores turn loss.** For "Left at STOP" lines the drawer/book card says loss 8.4/8.9/7.9 s (dwell 21.6/6.1/7.1) while the Debrief truth is 9.8/10.4/9.4 (ideal 20.2/4.6/5.6). A player who follows the card exactly is +1.4-1.5 s late at every turning stop (D03 Gold: turning stops +2.4/+2.5/+1.6, straight stops +0.9-1.0) and is told by the Debrief that their "go" calls are late.
2. **Pause is free** (Esc stops the sim at any time, including mid-stop) and is not recorded in the Debrief. You can compute on the bench with the clock stopped.
3. **Pace aid at Bronze is an oracle** (true early/late seconds, live) and stars from it unlock Silver/Gold content because stars are per drill, not per tier.
4. Pre-read text is hard-coded "your car loses about 4 s getting up to speed" while the card says 6.4 s for 50 mph (D11), so a player who trusts the overlay starts 2.4 s late (Debrief: Start +3 s Bronze, +19 s Gold).
5. Everything (watch, clock, speedo, book, driver log, card) is on one screen: no look-down cost. The review asked for a held-key full page; it is not implemented.

## 2. First hour (narrative)
**0:00** Josh opens Home. A paragraph, then a wall of cards. He sees "Timing", reads D01 "Stopwatch on the landmark", presses Play. A pre-read overlay about pauses and GO times covers the road for 59 s; the Depart (D) button is obvious. He departs, presses Space (the overlay tells him), and watches a straight road with a car. Signs approach; the book says "Lap at MARKER 1"; the sign is labelled; he presses L as it passes. By lap 3 he gets it. Eight laps take 4 minutes, ~35 s each of waiting. Debrief: three stars, "benchmark: champion". Pleasant, a little thin.

**0:12** He clicks "Next drill: D03". Bronze, seed 1. "Pause 30, Left at STOP". He stops, waits... the book still shows line 1 and the card says "START"; he presses N (guessing from the book header), the card now says "dwell 21.6 s after Stopped". He goes at the card dwell. 10 minutes later: a few seconds off. If he waits the full printed pause instead (my run 1), he is +40 s late with 0 stars, and the Debrief shows exactly why: "ideal dwell 4.6 s, your dwell 15.0 s -> +10.4 s" plus a "What if you had called go at the card dwell: 1 pts (was 39)". He hits Retry. Run 2 scores 7 s, two stars, two aces. This is the moment the app earns its keep.

**0:35** D04 (timed changes) gives one star and a 15.5 s error on the two compound "STOP + timed" lines that the Debrief explains; the Bronze countdown aid helps. The D09 trap quiz (mouse only, 10 distinct cards repeating, answers in a fixed order) is quick and informative, and does not gate anything.

**0:55** The stars he needs for D18 are on D05, D08 and D10, which the Home card marks locked: "needs D03 two stars, D04 two stars, D05, D08, D10". He has two stars on D03, one on D04. He retries D04. He is playing on; the hour ends with three drills at 1-3 stars and a vague sense of what is left. Nothing on Home tells him the next best action.

If he skipped the gating (typed `#/cockpit/drill/D11/0/1`), D11 gives 43 s late at the checkpoint after 27 min at 1x, of which 30 s is turn loss he cannot see on any card.

## 3. Ten best things
1. The Debrief: ideal-vs-actual dwell, worked arithmetic, bias vs noise, the timeline with CP ticks; it explains every second.
2. Counterfactual "What if" rows that re-run your own actions ("39 -> 1 pts").
3. Retry/Next seed one click away; naive -> carded run improved 40 s -> 7 s in one retry.
4. Key scheme: digits+Enter, arrows with B/A/J, Shift+R guard, Esc pause; read-backs close the loop without looking.
5. Adaptive time scale actually works and is clearly reported ("4x (asked 8x)"), 24 sim s per 3 wall s.
6. Dad's "Did that one, line N" check-off and "Going?" nudges.
7. In-world feedback: pace bar, CP card at the crossing, "call turns before here" line, sign labels with distance.
8. Analog stopwatch/clock/speedo and CAMEO cartoons are good to look at and large at 1920x1080.
9. Short drills with a real session shape (D18 in 5 min contains every maneuver).
10. Robust: ~15 full runs, 0 page errors, deterministic seeds, a recoverable wrong-turn path (U).

## 4. Ten most important improvements (ranked, each <= 1 day)
1. **Auto-advance the book to the next stop/landmark line** when the car is within the decision distance (keep manual N for Gold rung 0), and say "press N" in the Silver/Bronze hint. This removes the most damaging lost-place failure (-11 s on the first stop).
2. **Save/resume**: serialise `{scenario id, action log, tod}` every checkpoint to localStorage and offer "Resume leg" on Home; also confirm before leaving a running cockpit.
3. **Fix the resize layout**: re-measure on `resize` (or use CSS grid `minmax(0,1fr)` with the canvas absolutely positioned), and make 1366x768 fit without the 2 px scroll and 13 px stopwatch overlap.
4. **First-run flow**: a "Start here: D01" highlight (and "next recommended" after each Debrief), a D01-specific pre-read that states the objective and keys (Space, L), and show the Keys overlay on the first run.
5. **Make star/tier progress honest**: store stars per tier, unlock on Silver where the design says, show Bronze/Silver/Gold pips on the card, and explain a tier on the card ("Gold = rookie driver, no aids").
6. **Add turn loss to the perf card and Debrief** (per-turn seconds, "this stop is a left turn: loss +1.4"), and make the stop card use the same loss the Debrief calls truth.
7. **Correct the Debrief's turn-callout metric and tip priority**: measure to the decision point, not to the car's departure from a stop, and let "Fix this next" follow the largest bucket (the stops bucket was +41 s while the tip was about callout timing). Drop "speedometer reads low" when the speedo is Timewise.
8. **Default the cockpit to 4x adaptive** after the first run (and show "`>` faster" in the HUD); unlock 4x on D01/D03 for the cruise stretches; fix the card minutes (they are 1x minutes understated by 30-80 %).
9. **Give Dad a voice**: 2-3 variants per line, "Haven't seen a sign in a while" after N minutes without a landmark, a "Dead end! Say U to turn around" prompt, a small reaction on a CP ace/miss; fix the "cruise" HUD state at a dead end and the false "Did the turn" check-off.
10. **Debrief/Home polish**: unify score units on Home ("raw s" everywhere), add Next-drill buttons that respect locks (D18 has none, D11 -> locked D12), persist the last Debrief across reload, fix the false "storage blocked" note, pre-read text ("about 4 s") from the card, make the Keys overlay not cover the nav, and make quizzes keyboard-driven (1-6, Enter).

## 5. Blocking usability defects
No hard blocker for a Sunday session of the short drills. Four serious defects that will bite in the first week:
- **B1 Reload/navigation destroys a running leg; there is no resume** (D11 27 min at 1x; D12 ~70 min at 4x).
- **B2 Cockpit layout does not recover from a resize/zoom/fullscreen change** (horizontal scroll at 1366 after coming from 1920; overlap at fresh 1280x720). Fix = reload = B1.
- **B3 The book/perf card is on the wrong line at a stop** (Bronze/Silver) with no prompt.
- **B4 The Debrief's headline tip can be wrong** (turn-callout metric inflated by stop dwell; "speedometer reads low" under a timewise speedo), which will train Josh to distrust it.
Also: D11 first-leg error is dominated by an invisible turn-loss term (not blocking, but it makes the first full leg feel arbitrary).

## 6. Verdict
**Yes with fixes.** Ready for Josh to enjoy on Sunday for D01-D04 and the D18/D11 loop, because the core teaching loop (play, see exactly why, retry, improve) already works and is the best part of the app. Before he has a good week: fix B3 and B4 (hours), add resume (B1) and the resize fix (B2), and give him a "start here / next" cue. Without those, expect him to enjoy the first two evenings, to hit the D11 turn-loss wall and the 27-minute no-resume leg in evening three, and to stall.

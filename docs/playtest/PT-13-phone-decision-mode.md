# PT-13: phone decision mode playtest (Phase VIII)

Status: complete (2026-10-23). Read-only playtest: nothing under src/, tests/, content/ or public/ was changed; nothing committed.

- Build: commit 4e425f9 (Phase VIII), `npm run build && npx vite preview --port 4185`.
- Browser: Playwright Chromium (/opt/pw-browsers/chromium), 390x844 (geometry also 360x780), touch on, isMobile, real
  `touchscreen.tap`, one shared persistent profile across sessions 1-6 (fresh at the start of session 1). Throwaway profiles only for the
  geometry sweep, the evidence script and the Desk comparison.
- Driving the shell: `?mode=mobile` routes and the `window.__rally.decision` helpers (state, elapsed) as in e2e/mobile-helpers.ts; the
  oracle helper was read and logged but never used to choose an answer, except as "the arrow reader" on turn and which-way cards
  (the CAMEO arrow is on screen) and in the throwaway scripts that hunt for a card kind. Sim time is never advanced by hand: timing cards
  were tapped in real time.
- Tester: one agent playing as Josh (rookie navigator, a few minutes at a time on his phone). No sub-agents (the Agent tool was not
  available in this session). A previous attempt was lost to a container restart; its scripts were reused and fixed (port, one wrong
  selector), its screenshots were replaced by this run's.
- Boss: **unlocked by seeding** every meter to at least 65 % in localStorage (it was still locked after the Daily set and three more runs).
- Scripts: playtest-scripts/pt13-*.ts (harness pt13-common.ts, human model pt13-player.ts, sessions 01-06, geometry 07, core audit 08,
  evidence 09, guess audit 10, Desk on a phone 11). Raw JSON logs were kept in the session scratchpad, not committed.
- Screenshots: docs/playtest/screenshots/pt13-*.png (38 files, all under 200 KB).

## Verdict in one paragraph
The phone mode fixes what Josh complained about: a decision 5 seconds after opening, a median 6.5 s between decisions, a whole run in
2-3 minutes, Continue after closing the app, and it works offline. It clearly beats Desk mode on a phone. What it does not yet do is
reward the player who follows its own rule cards: the pause card's printed number is graded wrong on 15 s rows with a turn, the TA grader
disagrees with the TA card 9 times in 10, and the Boss hides the chart it grades. The timed cards ask for a tap "at the sign" without a
sign, so they test mental arithmetic rather than stopwatch timing. And too many cards have a fixed answer (clock, checkpoint, lost,
make-up, hazard), with Daily run 2 sometimes half the same clock question. Engagement 25/40; fix the four HIGH verdict and timing bugs
and the repetition, and this is the mode Josh will open every day.

## 1. Metrics (target vs measured)
Human model, 102 decisions over 9 runs (Daily 1-3, practice before/after Continue, School Try it, landscape practice, Boss).
"Gap" = wall time between two answer taps as Josh would feel it (verdict read 2-3 s, option cards read 2-3 s, timing cards in real time).
Machine numbers (instant oracle taps, pt13-07-geometry.ts) are given where they differ.

| Target (MOBILE.md / MOB-040..042) | Measured | Verdict |
|---|---|---|
| First decision within 20 s of opening (new player) | **5.1 s** to the first decision card (Home 0.6 s, tap 2.4 s, one 48-word rule card glanced); first tap 7.3 s. Machine: 0.40 s (390x844), 0.44 s (360x780) | Pass |
| Median gap between decisions under 15 s | **6.5 s** pooled (per run 4.9-9.6 s); p75 17.1 s, p90 21.1 s, max 44.6 s; 29 % of gaps over 15 s (timing cards hold 10-29 s) | Pass on the median |
| At least 4 decisions per minute over a run | Daily 6.8 / 4.2 / 4.6; School Try it 4.5; landscape practice 4.7; after Continue 7.6; Boss 6.1 | Pass (rules runs only just) |
| Words on screen before the first tap under 40 | Whole screen (strip + card + buttons): **median 44, 60 of 102 cards over 40**, max 62 (timed start in landscape). Card body only: median 27, max 47, 15 cards at 40 or more | **Fail** (whole screen); borderline (card body) |
| Rule cards under 60 words | Card text 45-60 words (RULE-020 is exactly 60); on screen with the strip and "Got it": 56-71, 6 of 15 over 60 | Borderline |
| A run finishes in under 5 minutes at 1x | Daily 133 / 171 / 185 s; School 160 s; Boss 235 s (24 cards) | Pass |
| Every control in the bottom 40 % (or the watch face), at least 56 px tall | Every rule, decision, verdict and recap screen at 390x844 (human runs + 78 sweep screens) and 360x780 (74 sweep screens): all controls inside the bottom 40 %, all 56 px or taller, 1-4 controls. Off the cards: Home's main button sits at 31 % from the top; School "Try it" buttons are at the top right of each card | Pass (cards) |
| Tap targets at least 48 px | 0 under 48 px in the phone shell (Home, cards, recap, landscape) | Pass |
| No text under 16 px | Phone shell: smallest 16 px (Home 17 px). Outside the shell but reachable from it: School 116 elements under 16 px (13 px sources), Reference 1,048 (12 px table heads) | Pass in the shell; fail on School/Reference |
| No horizontal scroll | None on any screen at 390 or 360 px. Reference panels are cut off inside their own row at 390 px | Pass |
| No page / console errors | 0 page errors, 0 console errors or warnings in all sessions (one shared profile, plus throwaway profiles) | Pass |
| Manifest valid, service worker registered | Manifest 200, all icons 200, Chromium installability errors [], manifest errors []; SW active and controlling, 10 files precached | Pass |
| Offline after one load | Offline reload, start_url, Reference, and a practice run (2 cards) all worked with `context.setOffline(true)` | Pass |
| Run wall time per card | Option cards answered in 2.2-3.0 s (median); timing cards: pause 12.2 s, speed change 10.6 s, restart 17.0 s, timed start 26.3 s median on the card | n/a |

Card mix the human saw (102 decisions): clock 17, speed change 13, restart 12, pause 12, transit OUT 10, turn 10, timed start 6,
checkpoint 5, pre-read 5, TA 4, make-up 3, hazard 3, lost 2. The single most frequent card is the one with a fixed answer.

## 2. Session notes

### Session 1: first open, first 60 seconds, Daily set (fresh profile)
Script: playtest-scripts/pt13-01-first-and-daily.ts. Human model (pt13-player.ts): option cards get a 2-3 s read pause then a real tap;
timing cards are tapped in real time from what the screen shows (prompt numbers, chips, watch digits, TOD strip) plus 0.15-0.25 s
reaction; verdicts are read 2-3 s. Run 1 naive (rule cards glanced 2.5 s, answers what a rookie would do), runs 2-3 by the rule cards
(read at 200 wpm). Turn and pre-read "which way" cards were answered from the CAMEO arrow (the oracle is used only as the arrow reader).

First 60 seconds (doing what the screen says, nothing optional read):

| t (s) | what |
|---|---|
| 0.6 | Home visible: install hint, Daily set, five meters at 0 %, Boss locked line, Dad's card, Reference (63 words) |
| 2.4 | tapped the big yellow "Play daily run 1 of 3" |
| 2.4 | rule card (Recovery, RULE-025, 48 words + strip = 57 on screen), tapped "Got it" |
| 5.1 | **first decision** (make-up: "You are 24 s late at 30 mph...") |
| 7.3 | first decision tapped (+20 %: right) |
| 9.8 | rule card (RULE-003 green/red), glanced |
| 12.3 | checkpoint: "Stop at the sign and check in" -> Not quite, +40.3 s |
| 18.6 | rule card (RULE-020, 60 words, 71 on screen) |
| 21.2 | speed change: tapped CALL at 4.7 s (no sign on screen, a guess) -> 6.5 s early |
| 29.3 / 34.8 / 41.2 / 49.3 / 55.4 | transit OUT right; checkpoint wrong again; speed change wrong; clock wrong; checkpoint wrong a third time |

In 60 s: 8 decisions and 3 rule cards. The pace is real. The rule card for checkpoints (RULE-003) came just before the first checkpoint,
but at a glance it did not stick; the verdict then said exactly why stopping was wrong (+40.3 s, "never stop... within sight of a green
timing checkpoint sign"). The repeat-on-miss logic brought the same checkpoint card back at 35 s and 55 s. (The naive model does not learn
within a run, so 3 of 15 is a lower bound; a real rookie would get the second checkpoint right, which is the point of the repeat.)

Daily set:

| run | policy | wall | decisions | rule cards | right | dec/min | median tap-to-tap gap | max gap | stars | recap |
|---|---|---|---|---|---|---|---|---|---|---|
| Daily 1 | naive | 133 s | 15 | 3 | 3 | 6.8 | 6.4 s | 21.1 s | 0 | 3 of 15 right, 224.1 s off |
| Daily 2 | rules | 171 s | 12 | 2 | 11 | 4.2 | 9.6 s | 44.6 s | 3 | 11 of 12 right, 3.3 s off |
| Daily 3 | rules | 185 s | 14 | 3 | 12 | 4.6 | 9.3 s | 20.4 s | 2 | 12 of 14 right, 5.2 s off |

- Naive vs rules: 3/15 vs 23/26. The rule cards do change the outcome, so the cards teach something real.
- Daily 2 was **6 clock cards out of 12** ("Where do you take the minute from?", same two options, same answer every time). Daily run 2
  plays "the two weakest skills"; Instruments has exactly one decision kind (clock), so a weak Instruments meter turns half the run into
  one repeated question. Daily 3 had 2 more. 11 clock cards in 41 decisions over the set.
- The "rules" player followed the pause card's own number and was graded wrong 3 times out of 6 pause cards (all pause-15 rows, see BUG-01).
- The "rules" player reached the speed-change and timed-start answers only by mental arithmetic in real time (590 ft / 44 ft/s - 2.3 s).
  A rookie cannot do that while the watch runs; the naive guesses were 6.5, 8.2 and 10.5 s early. See BUG-03.
- Card n of N grows as you miss: run 1 went "Card 2 of 10" -> "Card 8 of 15" (each miss inserts a repeat). Progress went backwards on screen.
- Home after the set: Streak 1, Run 1/2/3 done, meters Safety and course 32 %, Start on time 38 %, Stay on time 44 %, Recovery 30 %, Instruments 64 %.
  The Instruments meter is highest only because it was asked 11 times. Boss still locked (needs 60 % on all five).
- Console/page errors: none. No horizontal scroll, smallest text 16 px, every card control inside the bottom 40 %.

### Session 2: Continue after closing mid-run (same profile)
Script: pt13-02-continue.ts. Home now shows "Daily set done: practise" as the big yellow button. Tapped it, played 3 decisions by the
rules, then closed the whole browser context on a fresh turn card (Josh swipes the app away), waited, reopened the profile.

- Home on reopen showed "Continue run (3 of 10 done)" (pt13-11-home-continue.png). One tap brought back **the same card** (turn:2:1,
  card 4 of 11, same prompt) in 0.73 s from page load. Continue works. (screens pt13-10-before-close.png / pt13-12-after-continue.png)
- The yellow primary button above Continue still says "Daily set done: practise" and starts a new run, so on a phone the big button is not
  the run you left; Continue is the grey one below it.
- Part 1: 3 decisions in 78 s (three rule cards, one each before transit, timed start and TA; a 25 s timed-start card). Part 2 after
  Continue: 9 decisions in 71 s, 7.6 decisions per minute, median gap 5.1 s. Recap 9 of 12 right, 30.8 s off, 2 stars.
- **The TA card failed the rules player three times** (BUG-02): "delayed 0m42s by a train; about 11 s of it could be made up" -> by
  RULE-032/033 (and REG V.H.5's own example "Delayed 0m45s ... Made up 0m25s. Request 0m20s") the claim is 42 - 11 = 31 -> 0m30s and make
  up the odd second. Verdict: "Not quite, +10.0 s. Right: Claim 0m40s." Same for 51 - 12 = 39 -> 0m30s (wanted 0m40s) and 19 - 13 = 6 ->
  No claim (wanted 0m10s). Each miss queued another TA card, so the player was told he was wrong three times for applying the card he had
  just been shown. The recap's "Worst three" were all this card.
- The lost card still reads "You left the route 0 s ago" (known from the Phase VIII log; still present).
- No console errors.

### Session 3: a skill run from School "Try it" (same profile)
Script: pt13-03-school-tryit.ts.

- **The phone Home has no School link.** Its links are the Daily/practise button, the five meters (each starts a skill run), Dad's card,
  Reference, Dad's voice and Desk mode. Josh would reach the School only via Reference (it has a "School" link in its first panel) or by
  typing #/school. The meters already do what "Try it" does, so the School grid is effectively hidden on the phone.
- School at 390 px (pt13-21-school-phone.png): one card per rule, "Try it" top-right of each card (64x56 px), 41 words before the first
  Try it, 40 Try it buttons, page 18,211 px tall. 116 text elements under 16 px (sources 13 px, notes 15 px). The "‹ Home" bar works.
- Reference at 390 px (pt13-20-reference-phone.png): the Desk layout squeezed: panels side by side so the second panel is cut off at the
  right edge (it scrolls inside its row; the page itself has no horizontal scroll), 1,048 text elements under 16 px, 12 px table headers.
- Tapped "Try it" on Start on time (#/run?skill=startOnTime -> #/m/run). Run: 1 rule card (RULE-010, 55 words) then 12 decisions in
  160 s, all right, 3 stars, 4.5 decisions/min, median gap 5.4 s, p90 gap 19.9 s.
- **Repetition**: the 12 cards alternated restart / transit OUT only. Every transit card read "IN 9:00:31" (intervals 1m30s, 2m00s or
  2m30s); 4 of 6 restarts read "your time 9:03:00, standing-start loss 4.4 s" (the other two 9:02:51 and 9:02:00, always 4.4 s). By card 5
  the answer was memorised (9:02:56), not worked out. The rule card shown (RULE-010, "restart = base + your starting position") is never
  used: no card gives a base and a position, each one prints "your time".
- Each restart card holds the player 12-20 s while the TOD strip ticks to the launch second. It is honest real time, but nothing happens
  in those seconds, and the number the player needs (TOD, a 16 px grey strip) is far smaller than the elapsed digits he does not need.
- No console errors.

### Session 4: landscape (same profile)
Script: pt13-04-landscape.ts. Started a practice run, turned the phone to 844x390 on the first card, played four cards sideways,
turned back and finished in portrait.

- Rotating kept the run and the card (transitOut:2:1 before and after; the card id was also unchanged on the way back). The body gets
  `mob-landscape`; buttons or the watch go to the left half, the card to the right, Dad's line under the card ("Dad: \"Ready.\""),
  nothing scrolls, no text under 16 px, no tap target under 48 px (pt13-30-landscape-transitOut.png, pt13-31-landscape-clock.png).
- The option buttons sit at the top of the left half (y 57-187 of 390). Holding the phone sideways in two hands that is fine.
- A timed start in landscape showed 62 words on screen (the most of any card in the playtest).
- Dad's line is mostly filler: "Ready." on transit, clock and pre-read cards. It never says "Mark" at the sign, which is exactly what
  the timed cards are missing (see BUG-03).
- **The installed app cannot reach this layout**: public/manifest.webmanifest sets `"orientation": "portrait"`, so a home-screen install
  locks the phone upright on Android (BUG-13).
- Run total (4 landscape + 9 portrait): 12 of 13 right, 3 stars. The one miss was again a pause-15 card followed to the letter
  ("the chart says sit 6.9 s", GO at 7.2 s, graded +1.8 s late, right 5.4 s).
- No console errors.

### Session 5: Boss run (same profile, meters SEEDED)
Script: pt13-05-boss.ts. After the Daily set and three more runs the meters were Safety and course 59 %, Start on time 92 %,
Stay on time 56 %, Recovery 48 %, Instruments 81 % ("Legal" buttons on the two over 80 %). The Boss needs 60 % on all five, so it had
**not** unlocked after about 7 runs and 75 decisions. **I seeded every meter to at least 65 % in localStorage** (rally-trainer.decision.v1)
and reloaded; the Boss button appeared (pt13-40-home-boss-open.png).

- 24 decisions in 235 s, 6.1 decisions/min, median gap 5.8 s, max 18.6 s, 19 of 24 right, 2 stars. The strip said "Card n of 25" and the
  run ended after card 24.
- **Mix**: 9 turns or "which way" pre-reads (all answered by reading one arrow), 9 speed changes, 3 pauses, 1 start, 1 make-up, 1 clock,
  1 speed pre-read. No hazard, TA, checkpoint, lost or transit card, although MOBILE.md promises the Boss as "every kind".
- **The Boss runs at rung 1, which withholds the chart cell, and nothing on the phone gives it back.** The three pause cards read "Pause 15 s,
  in 35, out 45. Count the chart pause and tap GO." The rules player knows the rule (not the printed 15) but has no chart: GO at 15 s,
  graded +9.5, +6.6, +8.7 s late (right 5.7, 8.6, 6.5 s). The start card said "Lead the car by its standing-start loss" with no loss
  shown: +3.2 s (the Ford needs 6 s to 45 mph). These are the "Worst three". In a real car the navigator has the paper chart on his lap;
  here the chart is only in Reference (Desk layout), unreachable during a timed card (BUG-04).
- Speed changes without the lead shown: the player used RULE-020's "about 2 s" and got 7 of 9 right; the misses were 1.6 s late (30 -> 45
  needs 3.5 s) and fine otherwise. Pure arithmetic in real time again (820 ft / 66 ft/s - 2).
- Meters after: Safety and course 90 %, Start on time 74 %, Stay on time 59 %, Recovery 69 %, Instruments 83 %. Safety jumped 31 points
  for nine arrow readings.
- No console errors.

### Session 6: install and offline (same profile)
Script: pt13-06-pwa-offline.ts, then `context.setOffline(true)`.

- Manifest: 200, application/manifest+json, name/short_name "Rally Trainer", start_url ./?mode=mobile, display standalone,
  orientation portrait, theme and background #121821, icons 192/512/maskable 512/SVG all 200. Chromium `Page.getInstallabilityErrors`: [],
  `Page.getAppManifest` errors: [].
- Service worker registered at scope /, active, controlling the page; one cache (rally-trainer-463bff794c62) with 10 entries.
- The install hint showed once on first open and never again (it is a passive note; no install prompt button).
- Offline: reload OK, Home visible, start_url (?mode=mobile) OK, Reference OK, a practice run started and two cards were played
  (pt13-50-offline-home.png, pt13-51-offline-run.png). No errors.

## 3. Engagement rubric (0-5)

| Question | Score | Why |
|---|---|---|
| A decision every few seconds | **4** | Median 6.5 s between answers and 4-8 decisions a minute; the first card is 5 s after opening. But 29 % of gaps are over 15 s: restart cards hold you 12-20 s watching the TOD strip, timed starts 18-29 s, with nothing to do in between. |
| Each card teaches one thing | **3** | Most cards do (checkpoint, restart, transit, make-up, TA). But the pause card does the arithmetic for you ("the chart says sit 11.9 s"), RULE-010 (base + position) is taught and never asked, and the clock card teaches one thing 17 times. |
| The verdict is clear and fair | **2** | Clear: big Right / Not quite, signed seconds, "You: ... Right: ...", haptic. Not fair: following the pause card's own number is graded wrong on about 1 in 5 pause cards (4 of 9 in play), the TA grader disagrees with the TA rule card on 54 of 60 seeds, and Boss pause/start cards hide the number they grade. The rule sentence under the verdict is often a different rule (turns cite "work this line and the next"). |
| The tap-stopwatch feels like a stopwatch | **2** | The pause card is right: the watch runs from the stop, you tap GO at the count, the lap table shows your interval. Restart works off the TOD strip, which is small while the big digits show an elapsed time you do not need. Speed change and timed start ask you to tap "at the sign" with no sign: the only way is ft / (mph x 1.467) in your head while the watch runs. |
| Rule cards short enough | **3** | 45-60 words, 10-18 s to read at a normal pace. On a phone with a "Got it" button Josh skims: the naive run tapped through three cards in 2.5 s each and then got 3 of 15 right. One sentence plus the one number would be read. |
| Progress feels real (meters, streak, stars) | **3** | Meters move after every run, the streak and three daily pills work, stars match the play (0 naive, 3 by the rules). But the meters reward volume, not skill: Instruments hit 64 % on day one from 11 identical clock answers and Safety jumped 31 points in the Boss from nine arrow readings; "Card n of N" grows when you miss; the Boss was still locked after 7 runs. |
| Would you come back tomorrow | **3** | The daily set is quick (2-3 min a run) and the first run is fun because you are wrong a lot and learn why. By run 2 the repetition shows (6 clock cards in 12, every transit IN 9:00:31, every restart loss 4.4 s), and a rookie who obeys the cards still gets told he is wrong on pause and TA cards. |
| Beats Desk mode for a few minutes on a phone | **5** | No contest. Desk mode at 390 px is a 1,960-word, 11,050 px page whose first drill is "~1 h 25 min at 1x" (pt13-80-desk-home-phone.png). Phone mode gives a decision 5 s after opening, finishes a run in under 3 minutes, survives closing the app and works offline. |

Total 25 / 40.

## 4. Bugs (ranked)
Severity: HIGH = teaches the wrong thing or makes a card unwinnable by the rules; MEDIUM = misleading, loses progress, or breaks a target;
LOW = cosmetic or rare.

**BUG-01 HIGH: the pause card prints a "sit" time that its own grader marks wrong.**
Steps: Stay on time run (or Daily) -> a pause card on a "Pause 15 s" row that has a turn, e.g. "Stopped at line 2. Pause 15 s, in 40,
out 35: the chart says sit 6.9 s. Tap GO when it is done." Tap GO when the watch reads 6.9-7.0.
Expected: Right (the card said 6.9 s). Actual: "Not quite +1.5 s. You: GO at 7.0 s. Right: GO at 5.5 s." (pt13-70-pause15-card.png,
pt13-71-pause15-verdict.png). In play 4 of the 9 pause cards that showed a chart were lost this way; the core audit finds 8 of 40 seeds
where the printed number is more than the 1.0 s tolerance away from the truth. Cause: src/core/decision/runner.ts detectPause prints
`matrixAt(stopGo, vIn, vOut)` (the straight-through chart cell) for 15 s pauses, while the truth is `chartDwell()`, which uses
`stopLoss(..., capFor(turn))` (the turn-capped loss). Every other pause length prints `pause - loss` with the same capped loss and agrees.

**BUG-02 HIGH: the TA grader contradicts the TA rule card and REG V.H.5's example.**
Steps: Recovery run -> TA card "Leg 1 was delayed 0m42s by a train; about 11 s of it could be made up. What do you claim?" Apply RULE-033
("make up the odd seconds yourself: delayed 3m47s, make up 7 s, claim 3m40s") and RULE-032 ("Claim only what you could not make up"):
42 - 11 = 31 -> claim 0m30s.
Expected: Right. Actual: "Not quite +10.0 s. Right: Claim 0m40s." Also 15 - 13 = 2 -> No claim graded wrong, "Right: Claim 0m10s"
(pt13-73-ta-verdict.png), which is claiming 8 s the card says could be made up, exactly what V.H.5 says the committee denies.
pt13-10-guess-audit.ts: the RULE-033 answer matches the grader on **6 of 60** seeds. Cause: src/core/decision/navigator.ts `oracleClaim`
= min(floor(measured/10)*10, **ceil**(possible/10)*10). In session 2 the player was told he was wrong three times in a row for applying
the card he had just been shown (each miss queued another TA card).

**BUG-03 HIGH: speed-change and timed-start cards ask for a tap "at the sign" but show no sign.**
Steps: any Stay on time run -> "Line 2: 30 to 40 at the sign, 590 ft ahead. Lead 2.3 s. Tap CALL so the change splits the sign."
The watch starts running; nothing on screen moves or counts down to the sign.
Expected: some cue of the sign arriving (Dad says "Mark" at the posts, RULE-022; a shrinking distance bar; a count). Actual: the only way
to be right is 590 ft / 44 ft/s - 2.3 s = 11.1 s computed in your head while the watch runs. The naive taps were 6.5, 8.2 and 10.5 s
early; the rules player was right only because the script did the arithmetic. Timed start is the same ("Tap START at the sign": 184 ft
at 30 mph = 4.2 s). (pt13-02-d1-speedChange.png, pt13-02-d1-timedStart.png)

**BUG-04 HIGH (Boss): the Boss hides the numbers it grades, and the phone has no way to look them up.**
Steps: Boss run (rung 1) -> "Stopped at line 9. Pause 15 s, in 35, out 45. Count the chart pause and tap GO." No chart cell; the start
card says "Lead the car by its standing-start loss" with no loss. Expected: the chart on hand (in the car it is on paper) or a way to
open it without losing the card. Actual: three pauses graded +9.5, +6.6, +8.7 s; start +3.2 s (pt13-41-boss-pause.png,
pt13-41-boss-recap.png). Cause: Scheduler.boss / bossScenario default rung 1; runner.ts showChart() is rung >= 2.

**BUG-05 HIGH (engagement): Daily run 2 is half one question.**
Steps: fresh profile, Daily runs 1 and 2. Run 2 plays "the two weakest skills"; when Instruments is one of them, its only kind (clock)
fills every Instruments slot. Actual: 6 of 12 cards were "Your launch second lands at the top of a minute. Where do you take the minute
from?" with the same two options and the same answer (the core plan for that case is
RULE-038, clock, RULE-014, transit, clock, restart, clock, transit, clock, restart, transit, clock). Across the playtest the clock card
was 17 of 102 decisions. Cause: src/ui/mobile/progress.ts daily plan + src/core/decision/scheduler.ts (no cap on one kind per run;
KINDS_OF_SKILL.instruments = [clock]).

**BUG-06 MEDIUM: starting any run silently throws away the unfinished one.**
Steps: start a skill run, answer 2 cards, go Home ("Continue run (2 of 12 done)"), tap the big yellow button (Play daily / practise),
go Home again. Expected: Continue still offered, or a "start over?" question. Actual: no Continue; `unfinished` is null in
rally-trainer.decision.v1 (pt13-09-evidence.ts, pt13-74-home-after-yellow.png). The yellow button is the one the eye goes to, above Continue.

**BUG-07 MEDIUM: the verdict's rule sentence is often not the rule that decided the card.**
- Turn and "which way" pre-read: "Always work the current instruction and the next one, especially when Column D says comes quick"
  (RULE-006) for reading an arrow.
- Speed pre-read: "Copy the speed at the bottom of each page to the top of the next" (RULE-007) for reading "40 MPH" off Column C.
- Red light, make it up: shows RULE-031's first sentence "Ask for a Time Allowance only for a delay beyond your control, such as a
  train..."; the sentence that explains the answer ("A traffic light is not named: make that time up") is cut.
- Train, "Wait it out, claim a TA" marked wrong: the same sentence, which reads as if it supports the answer that was marked wrong; the
  rule that decides it (claim only what you cannot make up, RULE-032/033) is not shown.
- TA: "Request time in multiples of 10 seconds..." for a claim-size error.
Cause: src/core/decision/rules.ts verdictRule -> firstSentence of the kind's card; runner.ts passes the same variant for every outcome.

**BUG-08 MEDIUM: one chart label, two meanings.** Pre-read "STOP, pause 15 s, in 35, out 40": the chip reads "Stop & go 35 -> 40
8.4 s" and means the loss to subtract (answer 6.6). The pause card for the same pair reads "Stop & go 35 -> 40 6.6 s" and means the time
to sit. Same label, same speeds, different number (src/ui/mobile/cards.ts chartCellHtml; runner.ts detectPreread vs detectPause).

**BUG-09 MEDIUM: words on screen over the 40-word budget on 60 of 102 cards** (median 44, max 62). The prompt usually stays under 40,
but the strip, the chips, the Column C text and four long option labels push the screen over. Hazard (55), timed start (55), pause (53),
speed change (52), make-up (50), checkpoint (46) are the worst.

**BUG-10 MEDIUM: Reference and School are Desk pages squeezed to 390 px.** Reference: panels side by side, the second cut off at the right
edge; 1,048 text elements under 16 px; 12 px table headers (pt13-20-reference-phone.png). School: 116 elements under 16 px; 18,211 px tall.

**BUG-11 MEDIUM: timed-start verdict headline shows the wrong number when START was the miss.** Naive run: START 1.5 s early, CALL
0.3 s late -> "Not quite +0.3 s", detail "You: START -1.5 s, CALL at 17.7 s". The headline seconds are the part he got right.

**BUG-12 LOW: the restart card makes the needed number small.** The launch is read off the TOD strip (grey, 16 px) while the 64 px digits
count elapsed time the card never uses (pt13-02-d1-restart.png). At 360x780 the chips under the clock face ("at 0", "minute 2") are
pushed under the watch and need a scroll nobody makes mid-count (pt13-60-360-restart.png).

**BUG-13 LOW: installed app cannot rotate.** public/manifest.webmanifest `"orientation": "portrait"` locks the installed PWA upright on
Android, so the MOB-022 landscape cockpit only exists in the browser.

**BUG-14 LOW: no School link on the phone Home**; School is reachable only via Reference or the URL.

**BUG-15 LOW: CAMEO labels overlap their arrows** at phone width: "End Transit" and "End Road Work" are drawn through the arrow stem
with the box offset from the text; "bridge" is struck through by the bridge icon (pt13-02-d1-speedChange.png, pt13-60-360-restart.png,
pt13-02-d1-timedStart.png).

**BUG-16 LOW: "Card n of N" moves backwards.** Each miss adds a repeat, so Daily 1 went "Card 2 of 10" -> "Card 8 of 15". The Boss said
"of 25" and ended after 24.

**BUG-17 LOW: lost card says "You left the route 0 s ago"** (known in LOG.md, still there).

**BUG-18 LOW: chip noise.** Make-up "at 29" next to "late at 30 mph"; restart "at 0"; make-up "6550 ft" with no label (distance to what?);
timed start "in 30 · out 20" for a "25 for 0m21s, then 20" line (the 25 is missing).

**BUG-19 LOW: clock card "Not quite, 0.0 s".** Choosing the dash clock is graded wrong with 0.0 s cost on 38 of 40 seeds, because the
clock only misleads in 2 of 40. The card never shows the minute hand already past the minute, which is the thing RULE-037 warns about.

## 5. Confusing cards, wrong or unhelpful verdicts, guessable cards

### Wrong verdicts (checked against content/rules.ts and the documents)
- Pause on a 15 s row with a turn: the printed "sit" time is graded wrong (BUG-01). The right answer per the app's own chart is not on
  the screen.
- TA claim: grader rounds the unrecoverable delay up; RULE-032, RULE-033 and REG V.H.5's example ("Delayed 0m45s ... Made up 0m25s.
  Request 0m20s") round down / claim only what could not be made up (BUG-02). Either the grader or the cards must change; if the intent is
  V.H.5's "you may lose time at 5 MPH to bring your delay request to a multiple of 0m10s", the card must say so and the card must not
  say "about 11 s could be made up" while expecting you to claim it.
- Train, "Wait it out, claim a Time Allowance" -> Not quite, +13.3 s. The answer is not wrong in kind (you do claim a TA for a train);
  it is wrong in size, and the verdict sentence says "Ask for a TA only for a delay beyond your control, such as a train", which reads as
  agreement. Unhelpful rather than wrong (BUG-07).

### Unhelpful verdicts
- Turn and "which way" pre-read: verdict cites RULE-006 ("work this line and the next, comes quick").
- Speed pre-read: cites RULE-007 (copy the speed to the next page).
- Red light: the deciding sentence of RULE-031 is cut.
- Clock with the dash clock chosen: "Not quite 0.0 s" (BUG-19).
- Timed start with an early START: headline +0.3 s (BUG-11).

### Confusing cards
- Pause card vs pre-read pause card: the same "Stop & go 35 -> 40" chip means "subtract" in one and "sit" in the other (BUG-08).
- Speed change / timed start: "Tap CALL so the change splits the sign" with no sign (BUG-03).
- Restart: the big number is the wrong number (BUG-12); "Transit OUT, line 3" under a "RESTART" header.
- Make-up: "at 29" and "6550 ft" chips; options "+20 %: 36 mph for 118 s" are fine.
- Clock: "Your launch second lands at the top of a minute" while the clock on the card shows 9:02 and some seconds, and a "minute 2"
  chip already tells you the minute (pt13-31-landscape-clock.png). It is a quiz question, not a decision at a moment.
- Lost: "You left the route 0 s ago".
- Rule card RULE-010 (restart = base + position) before a run whose restart cards never give a base and a position.

### Answer guessable without the skill (pt13-08-core-audit.ts, pt13-10-guess-audit.ts, 40-60 seeds each)
| Card | Guess | Right |
|---|---|---|
| Clock | always "Stopwatch in TOD mode" | 40 / 40 |
| Checkpoint | always "Hold speed, drive through" | 40 / 40 |
| Lost | always "Turn around now" | 40 / 40 |
| Make-up | always "+20 %" (+10 % is the doctrinal answer on 36 of 60, but +20 % is also accepted every time) | 60 / 60 |
| Hazard | from the label alone: train / tractor -> "claim the measured delay, make up the odd seconds"; light / slow truck -> "make it up" | 60 / 60 |
| Speed pre-read | pick the number in the "in X · out Y" chip (also printed in Column C) | 60 / 60 |
| Transit OUT | every card is "IN 9:00:31" + 1m30s / 2m00s / 2m30s | IN time 9:00:31 on 60 / 60 |
| Turn / which way | read the one arrow on the CAMEO | always (that is the skill, but it is the easiest one in the game and it fills a third of the Boss) |
| Restart | "your time 9:03:00, loss 4.4 s" on most cards | memorised by card 5 of the School run |
The ones that are not guessable: pause timing (when the chart is right), restart timing, TA size, transit arithmetic the first few times,
speed-change timing (but for the wrong reason: BUG-03).

## 6. Best and worst cards

Best three
1. **Restart / launch** ("your time 9:02:21, standing-start loss 4.4 s. Tap LAUNCH on the launch second"). A real decision in real
   time: subtract, watch the TOD, tap on the second. The naive "tap on my time" lost +4.3 s and the verdict taught RULE-011 exactly. Fix
   the display (BUG-12) and vary the numbers and it is the model card.
2. **Checkpoint, first time.** 20 words, one tap; the naive "stop and check in" costs +40 s and the verdict sentence is the exact rule
   (never stop or crawl near a green sign, REG V.E.3.a). It teaches in one shot; it just should not come back with the same answer.
3. **Pause with a correct chart cell** (20 and 30 s pauses). The phone is the stopwatch, the whole face is GO, the lap table shows your
   interval on the verdict. This is what "feels like a stopwatch" should mean.
(Runner-up: Transit OUT, IN + interval, quick and real, once the IN time varies.)

Worst three
1. **Clock: "Where do you take the minute from?"** Same two options, same answer, 0.0 s cost when you are "wrong", 17 % of all cards and
   6 of 12 in Daily run 2.
2. **TA claim.** The only card that asks for the arithmetic of RULE-033, and the grader disagrees with RULE-033 on 54 of 60 seeds.
3. **Speed change** (and timed start). The skill is calling the change at the sign; the card hides the sign and turns it into a mental
   ft/s division under a running clock. Pause-15 and the chartless Boss pause are close behind.

## 7. Top-10 fix list (ranked)

1. **Make the pause card's number the graded number** (BUG-01). Print `chartDwell()` (or grade against the printed chart cell) for every
   pause length, and label the chip by what it means ("loss 8.4 s" in the pre-read, "sit 6.6 s" on the pause card, BUG-08).
   Files: src/core/decision/runner.ts (detectPause, detectPreread), src/ui/mobile/cards.ts (chartCellHtml).
2. **Make the TA grader and the TA cards agree** (BUG-02). Either claim floor((measured - recoverable) / 10) x 10 as RULE-033 and V.H.5's
   example say, or teach V.H.5's "lose time at 5 MPH to round up" in the card and the options. Show RULE-033's sentence on a size miss.
   Files: src/core/decision/navigator.ts (oracleClaim), runner.ts (detectTa, grade 'ta'), content/rules.ts (RULE-032/033).
3. **Give the timed cards a sign** (BUG-03). Dad says "Mark!" (text flash + speech + haptic) when the posts line up (RULE-022), and the
   player taps START/CALL from that cue; for speed changes show a distance-to-sign bar or count that shrinks in real time. Grade the
   reaction and the lead, not the ft/s arithmetic. Files: src/ui/mobile/run.ts, tapwatch.ts, cards.ts (driverLine); runner.ts timing specs.
4. **Cap repeats and widen Instruments** (BUG-05). At most 2-3 cards of one kind per run; give Instruments more than one kind (read the TOD
   off the watch at a minute change, count in off the second hand, lap / split, which device for which job with varied situations) or
   fold the clock question into restart cards. Files: src/core/decision/scheduler.ts (plan), scenarios.ts (KINDS_OF_SKILL),
   src/ui/mobile/progress.ts (daily plan).
5. **Show the rule that decided the verdict** (BUG-07, BUG-11, BUG-19). Pick the card and sentence by outcome (light -> "a traffic light
   is not named: make it up"; TA size -> RULE-033; turn -> a CAMEO / ICE rule), put the missed part in the headline seconds.
   Files: src/core/decision/rules.ts (verdictRule), runner.ts (grade variants), content/rules.ts (kinds, short verdict lines).
6. **Fix the Boss** (BUG-04). Run it at rung 2 or add a "chart" button that opens the chart cell without leaving the card; make sure every
   kind appears (hazard, TA, checkpoint, transit, lost) and limit arrow-reading turns to a few. Consider unlocking at 50 % or after N
   daily sets so a rookie reaches it in his first week. Files: src/core/decision/scenarios.ts (bossScenario), scheduler.ts (Scheduler.boss),
   runner.ts (showChart), src/core/decision/progress.ts (BOSS_UNLOCK).
7. **Remove the give-aways** (section 5 table). Drop the "in · out" chip on speed pre-reads; accept only the doctrinal make-up choice or
   make the 20 % option cost something (for example a posted limit below the 20 % speed); vary hazards so the label does not decide (TA cause with a
   short delay that should just be made up; a red STOP board vs a green sign; a lost card where rejoining behind a car is right).
   Files: src/core/decision/runner.ts (detectPreread, detectMakeup, detectHazard, detectCheckpoint, detectLost).
8. **Vary the numbers** (sections 2-3). Transit IN times, restart times and standing-start losses (speeds other than 35), and restarts
   that give "base + position" so RULE-010 is exercised. Files: src/core/decision/scenarios.ts (microScenario variants).
9. **Protect the unfinished run** (BUG-06). When a run is unfinished make Continue the big yellow button, and ask before starting another
   run over it. Files: src/ui/mobile/home.ts, src/ui/mobile/index.ts (routes), src/ui/mobile/progress.ts (setUnfinished).
10. **Trim the screen to 40 words and fix the display details** (BUG-09, BUG-12, BUG-15, BUG-18). Shorter prompts (the chips already carry
   the numbers), fewer chips, big TOD digits on restart cards, CAMEO labels placed clear of the arrow. Files: src/core/decision/runner.ts
   (prompts), src/ui/mobile/cards.ts (factsHtml), tapwatch.ts (go mode with TOD primary), src/ui/render/griid.ts / src/core/cameo.ts.

Also worth doing (small): link the School from the phone Home (BUG-14); a phone layout for Reference (BUG-10); manifest orientation
"any" (BUG-13); keep "Card n of N" fixed (BUG-16); the "0 s ago" lost card (BUG-17); shorten rule cards to one sentence plus the number
and keep the long text one tap away.

# PT-03: UI bug hunt (Rally Trainer, Chromium via Playwright)

Date 2026-10-03. Build: `npm run build` + `vite preview :4173`. Driver: `window.__rally` (sim time only, no wall-clock waits).
Scripts: `playtest-scripts/pt03-*.ts` (d03, d04-d18, d07, static, stress, resize, probe-*). Screenshots: `docs/playtest/screenshots/pt03-*.png`.
Zero uncaught page errors and zero console errors in every run (including 300 rapid keys, abort, reload, back/forward).

Counts: crash 0 | wrong data 3 | confusing 10 | cosmetic 4.

## What was played

1. D03 Bronze seed 1, full run: pre-read GO time typed, D at T-2.8 s, Space on the official second, all six STOPs set with `[ ]`/`Shift+[ ]` to the book's "card" dwell, G on the index, finished. Debrief, Home stars, Retry and Next seed checked.
2. D04 and D18 at Silver (tier 1): N / Shift+N / Home / End / click line following, GO-time persistence, countdown aid and pace bar (D04, rung 2), no aids (D18, rung 1), D18 debrief. (My first D04/D18 pass pressed D then Space in the pre-read, 55-60 s early: the -54/-64 errors came from that, not from the app. Reran departing at T-3: D04 +3/+2, D18 -7.)
3. D07 calibration run (laps vs Column C), restart, finish.
4. D09 quiz (20 cards, right and wrong), D14 math (20 cards), all 6 School lessons (wrong then right, "passed" persists).
5. Settings: digital watch, time scale 4x, light theme, rookie driver: all reach the cockpit and survive reload.
6. Stress: rapid keys, 1280x720 / 1366x768 / 1920x1080 / 1024x700, reload mid-run, Debrief with no run, bad routes, back/forward, End run mid-leg and in pre-read, pause/resume, 8x through a stop.

## Bugs (by severity)

### Crash
None found.

### Wrong data

**W1. Book "card" dwell ignores the turn through a STOP, so following the card makes you ~1.5 s late at every turning stop.**
- Steps: D03 Bronze seed 1. Book strip shows `card 21.6 s` (line 2, Left at STOP), `card 6.1 s` (line 3), `card 7.1 s` (line 7). Set bezel to those, G on the index. Open Debrief.
- Expected: card dwell == Debrief "ideal dwell".
- Actual: Debrief says line 2 car loss 9.8 / ideal 20.2 (card said 21.6), line 3 loss 10.4 / ideal 4.6 (card 6.1), line 7 loss 9.4 / ideal 5.6 (card 7.1). Straight stops (lines 4,5,6) match exactly. Cause: `debrief.ts workedStops` calls `stopLoss(vi, vOut, car, turnCap(...))`; `cockpit.ts` (`dwellFor` in the GO strip and `stopLoss` in `perfCardHtml`) omits the turn cap. Result: "Stops (dwell) mean +1.0 s, bias" and the headline tip "Your stops cost more than the printed pause. Go earlier" for a player who did exactly what the card said. The "go at card dwell" counterfactual (62 vs 66 pts) is built on the other number.
- Screenshots: `pt03-cockpit-stop-bezel.png` (card 21.6), `pt03-debrief-d03.png` (ideal 20.2).

**W2. D14 can generate duplicate answer options (one of them marked wrong).**
- Steps: D14, any card of kind "late x factor" with assigned speed 40 (distractors `late*(v/10+1)` and `late*5` are both `late*5`, e.g. `['27 s','15 s','15 s','41 s']`); or pause 15 with loss 7.5 (dwell == loss, `['7.5 s','15 s','22.5 s','7.5 s']`). Probe: `playtest-scripts/pt03-probe-mathdupes.ts`.
- Expected: four distinct options.
- Actual: in the dwell==loss case the correct text appears twice and only the first is accepted, so clicking the identical-looking second one scores wrong with feedback "No: 7.5 s". Source: `src/ui/screens/quiz.ts mathCards` (no dedupe).
- Screenshot: `pt03-math-d14-wrong.png` (generic card; duplicates are seed dependent).

**W3. D07 debrief treats the lunch RESTART as a stop with a missing dwell.**
- Steps: D07 seed 1, run the calibration, G at the restart out-time (or early). Open Debrief.
- Expected: restart line judged against the out-time only.
- Actual: "Stop, line 9: entry 50 / exit 40; pause 0; car loss 9.8 s; ideal dwell 0.0 s; your dwell 0.3 s -> +10.1 s", and tip "Your 'go' calls average 9.8 s late: subtract 10 more from every dwell on the card". Pause is 0 because the hold is until a clock time, so the 9.8 s "car loss" is billed as player error and pollutes the Stops bias row.
- Screenshot: `pt03-debrief-d07-restart-go.png`.

### Confusing

**C1. Current line / perf card lag: at the first STOP the perf card and book highlight are on line 1 (START).**
- Steps: D03 Bronze, drive to the first stop. Drawer "Perf card for the next line" reads "Line 1: START. Speed 35 ... leave ~4.2 s early" while the car is stopped at line 2's STOP; book accent is on row 1. The line only advances after the stop is released (auto-advance fires on executed nodes, and line 1 is never "executed"). At Silver (D04 rung 2, D18 rung 1) it never auto-advances: at the first stop `currentLine` is 1 with `lastExecuted` 3 (N / click required). The card the navigator needs at the STOP (dwell for the current line) is exactly the one not shown; the per-line "card x s" in the book strip is the only reliable source.
- Expected: perf card on the line being executed; at least when waiting at a STOP.
- Screenshots: `pt03-cockpit-stop-bezel.png`, `pt03-d04-countdown-aid.png`.

**C2. False "progress is not being saved (storage blocked)" banner.**
- Steps: load `#/cockpit/...`, `#/settings`, `#/reference` (or D09/D14) directly in a fresh tab. Banner appears (top right of every screenshot). Home and School do not show it. localStorage works (settings persist).
- Cause: `main.ts` reads `app.progress.persistent` before anything has called `load()`, and `persistent` starts false.
- Screenshots: `pt03-layout-1280.png`, `pt03-quiz-d09-wrong.png`.

**C3. The pre-read overlay covers the HUD buttons.**
- Steps: open any cockpit; try to click 1x/2x/4x/8x, Pause, Keys, Mute or End run before departing. `elementFromPoint` returns `DIV.box` for all eight; Playwright click times out. Only keyboard works.
- Expected: HUD above the overlay, or overlay not full-width. Screenshot: `pt03-preread-hud-covered.png`.

**C4. Lapboard note input keeps focus after Enter (keyboard trap).**
- Steps: click the notes box, type, Enter, then press Space to start/stop the watch. The Space is typed into the note (value `" "`), the watch does not toggle, and every cockpit key is dead until Esc. Mid-run this costs the very moment the user is trying to hit. (GO-at box does blur on Enter; ledger/TA prompts refocus the view.) Suggest blur on Enter.

**C5. Digital watch is only a different caption.**
- Steps: Settings -> Digital -> cockpit. Dial is still the analog 1/5 s face with crown, bezel shown "bezel 0.0 s (x to go)", only the text readout becomes 0:00.00. "split recall" (engine `watch.recall`) has no key and is not in the Keys list. Setting description promises "Digital, 1/100 s, split recall".
- Screenshot: `pt03-cockpit-light-digital.png`.

**C6. D07 has no speedo-factor / cheat-card control.**
- Engine accepts `speedo.setFactor` and `card.set`, but the cockpit offers nothing: the user can only jot "k = perfect/actual, hold 50/k" in the free-text note (that note is the only record; I did). The objective line says "set the Timewise factor or build a cheat card". Also the same row shows two "perfect" numbers: `perfect cumulative 12:36` (aid, from the start) next to `Col C perfect: 12:00` (from the cal start), and Column C laps of 3:00 are labelled `"MILE 1..6"` though the signs are 2.5 mi apart (a mile at 50 mph is 1:12). Calibration column-C vs laps itself works (laps 3:00.8, 3:00.7, 3:00.8 vs 3:00 -> k ~ 0.996).
- Screenshot: `pt03-d07-calibration-laps.png`.

**C7. Aborted and unattended runs count as plays.**
- Steps: D03 -> End run in pre-read, or 30 s in. Home shows "1 run, best 300", "Last runs: D03 300 pts"; the 30-s abort also adds a 0.0 "Cruise (card)" point to the bias history. `1260 points over 4 checkpoints` headline. Aborts should not update stars/history, or should say "aborted".
- Screenshot: `pt03-debrief-aborted-midleg.png`.

**C8. Two different "points" in one screen pair.**
- Debrief D03: "66 points ... Raw 66 s x 0.845 = 55.77" (60 s of it is the missed Observation Checkpoint, because nothing in the cockpit prompts "S at the finish"); Home card says "best 1.5" and last-runs "1.5 pts" (rubric mean |leg error|). D09/D14 show "best 18" next to empty stars for a 2/20 run (score = errors, lower better, unlabelled).
- Screenshots: `pt03-debrief-d03.png`, `pt03-home-after-d03.png`.

**C9. Reload, Back/Forward and Retry/Next-seed navigation.**
- Reload mid-run or Forward into a cockpit silently restarts at pre-read; Debrief after reload is "No finished run yet" (result lives only in memory). No warning, no beforeunload.
- Retry/Next seed insert an extra `#/` history entry: Back from the new cockpit lands on Home, not the Debrief.

**C10. Silent rejection of bad input; quiz feedback.**
- `E` then "g5" Enter: ledger prompt closes, nothing set, no message. `T` before departure: no feedback (no alert). Quiz: after a wrong answer the correct option is not highlighted (only red on the pick plus text); the D09 deck is 20 draws from 10 templates (repeats), seeded by `Date.now()`; CAMEO for "side roads have STOP signs" draws no signs.
- Screenshot: `pt03-quiz-d09-wrong.png`.

### Cosmetic

**K1. Small-window cockpit layout (1280x720, 1366x768, 1024x700).** Stopwatch dial top is 22 px above the instruments pane and overlaps the road view; lap list (L1 row) clipped under the drawer (laps bottom 604 > pane bottom 583); book shows 6/9 rows (4/9 at 1024x700); the page scrolls 2 px vertically at every size (scrollH = innerH + 2). 1920x1080 is clean. Screenshots: `pt03-layout-1280.png`, `pt03-layout-1920.png`.

**K2. Light theme HUD.** Clock and "leg" chips are unreadable (dark text on the fixed dark chip background, and the road view stays dark); the reset "flash" is a solid pink square behind the stopwatch. Screenshot: `pt03-cockpit-light-digital.png`, `pt03-settings-light.png` (settings page itself is fine).

**K3. "START START." / "FINISH FINISH."** The tag and the text repeat. The empty Ledger panel in the Debrief stretches to the height of the Bias table.

**K4. HUD controls are tiny** (12 px buttons) for a mouse in a moving "car"; the 8x/Pause/End-run cluster has no spacing from the chips at 1280.

## Usability for the hands-on-watch workflow

- Good: every action has a key; bezel `[ ]` plus `Shift` 0.2 s steps are precise; the bezel caption "bezel 2.6 s (21.6 to go)" and the "card x s" in the book strip let you set a stop in under 3 seconds; Pause (Esc) and 1x lock at stops keep the timing honest.
- The line pointer is the weak link (C1): at Bronze it lags by one, at Silver you must press N; the drawer "Perf card for the next line" is therefore wrong at the moment of use. Show the current-stop dwell prominently (and make the card dwell correct, W1).
- The notes box steals focus (C4), the pre-read steals the mouse (C3), and a stray `B`/`A`/`J` modifier is shown only in the small Callout bar.
- Space with a HUD button focused still toggles the watch (good: it does not double-fire Pause).
- Pre-read: no countdown-to-go bar for the first D; the "depart a few seconds early" advice is easy to miss and pressing D at T-60 gives -55 s with only the pace aid to say so.
- No prompt to call S at the Observation Checkpoint: first-time players lose 60 s (seen in D03 and D18 debriefs).
- Adaptive time scale works: asking 8x gave 8x on open road, "1x (asked 8x)" within ~700 ft of a feature and while waiting at a stop, back to 8x after.

## What worked well

- No crashes, no console errors in ~40 minutes of sim-time driving, 300 rapid keys, abort, reload, bad routes (`#/cockpit/drill/NOPE` -> "Scenario not found").
- Pause/Resume (Esc and button) freeze sim time exactly; 8x adaptive; modifiers (B/A/J + arrow) do not stick.
- Debrief is excellent: per-stop worked arithmetic (matches the engine for straight stops), cause bars, timeline, counterfactuals, bias/noise with fixes. Retry and Next seed work. Stars and runs saved on Home.
- GO-time column edits persist across N/Home/End/click re-renders and reach the engine annotations.
- Countdown aid ("change in x s") counts to the ghost's change moment, resets after each stop, and slows time near zero; pace bar and "+1.6 s" aid agreed with checkpoint error.
- School: all 6 lessons render, grade, mark "passed" and persist; D09/D14 scoring and tips correct; settings persist across reload and apply (digital readout, 4x, rookie driver, light theme).

## Eight prioritized fixes

1. Make the book card, GO strip and perf card use the same `stopLoss(..., turnCap)` as the Debrief (W1); add a test that the two agree for every stop in D03 seeds 1-10.
2. Advance the current line on departure (and to the stop line when `waiting`), or show the stop's dwell in the drawer regardless of the pointer (C1).
3. Judge RESTART lines against the out-time, not stop dwell, in the Debrief and bias history (W3).
4. Fix the false storage banner: read progress before computing `persistent` (C2).
5. Raise the HUD above the pre-read overlay, and blur the notes input on Enter (C3, C4).
6. Dedupe D14 options; highlight the correct option after a wrong answer (W2, C10).
7. Do not record aborted/unattended runs in stars, history or bias (C7); unify "points" vs rubric score on Home/Debrief (C8); prompt "S at the finish".
8. Small-window layout: stop the dial overlapping the road, let the lap list scroll, fix the 2 px overflow, and fix light-theme HUD chips (K1, K2). Also expose a speedo factor/cheat card control for D07 and relabel the "MILE" signs (C6).

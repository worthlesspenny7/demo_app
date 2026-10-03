# Re-validation: UI, playability and enjoyment (after the UI fix sprint)

Build under test: HEAD 26b842b (docs on top of 230051e "UI fix sprint"), `npm run build` + `vite preview :4175`, Chromium via Playwright (1366x768 default; 1280x720, 1024x700, 1920x1080 also). Real key presses, `window.__rally.advance` only to move sim time (real-time loop paused with Esc, as in the earlier passes). Unit tests: 198/198 pass. Scripts: `playtest-scripts/rev-*.ts` (player: `rev-player.ts`, now drives the stop dwell with real `[ ]` bezel keys, Space at "Stopped", G on the index). Screenshots: `docs/playtest/screenshots/reval-*.png`. Zero uncaught page errors in every run except the one quiz TypeError listed as N3.

Session replayed from an empty browser profile: Home "Start here" -> School lesson 1 (wrong, then right) -> D01 -> D03 Bronze naive -> D03 Bronze by the card -> D04 -> D09 quiz (+ D14) -> D18 Bronze -> D11 Bronze (D18/D11 by direct URL, they are locked on Home) -> D03 Gold (legal, at 1920x1080, dwell from the Reference table) -> D07 with the calibration box. Also: Resume (reload mid-run), D16 restart, #/campaign, layouts, light/digital settings, abort, Back/Reload on the Debrief, a wrong-turn run.

Key results of the replay
- D01 Bronze: 3 stars, bias 0.30 s, jitter 0.07 s, 4:07 sim at 1x.
- D03 Bronze naive (wait the printed pause): 40 raw s, 0 stars, Debrief "ideal dwell 4.6, your dwell 15.0 -> +10.4" and the top tip is now the stops tip. Retry by the card with `[ ]` + Space + G: **5 raw s, 2 stars**, every stop +1.0 to +1.3 s (my 0.25 s Space and 0.15 s G latency, SD 0.1), ideal dwells in the Debrief equal the card dwells (20.2 / 4.6 / 7.7 / 7.9 / 8.2 / 5.6, turning stops included).
- D04 Bronze: 10 raw s, 1 star (compound "STOP + timed" lines +16 s, explained by the Debrief; my scripted player counted from the wrong instant).
- D09: 7/20 (guessing), 20 distinct cards, keys 1-4 + Enter work, correct option highlighted after a miss. D14: 0 duplicate options in 120 cards.
- D18 Bronze (rung 1, legal): 28 raw s, 0 stars (identical to the first validation). D11 Bronze: 66 raw s, 0 stars, 27:29 at 1x (stops +37, turns +26).
- D03 Gold (rung 1, rookie Dad, no digital readouts): 11 raw s, 2 stars using only the Reference table + 1.5 s for turns.
- D07: k from Column C vs laps = 180/176.9 = 1.017 (cumulative 354.0 vs 360 at MILE 2); factor set in the box; the next splits were 3:00.1-3:00.2 (before: 2:56.8-2:57.6); restart judged "go 08:22:54, ideal 08:22:54, 0.0 s"; 2 raw s, 3 stars, 45:33 sim.

## 1. Previously reported issues

Status: FIXED = no longer reproduces. NOT FIXED includes "partial" (noted). No REGRESSED item found.

### PT-03

| ID | Issue | Status | Evidence |
|---|---|---|---|
| W1 | Card dwell ignored the turn through a STOP | FIXED | At D03 line 2 the card reads "Stop 35 in / 40 out (turn capped at 12 mph): loss 9.8 s -> dwell 20.2 s" and the Debrief says "car loss 9.8, ideal dwell 20.2"; same for lines 3-7 (4.6, 7.7, 7.9, 8.2, 5.6) (`reval-d03-run2-card-at-stop.png`, `-debrief-full.png`) |
| W2 | D14 duplicate options | FIXED | 120 cards over 6 decks, 0 with duplicate options |
| W3 | D07 restart billed as a stop | FIXED | Worked arithmetic "Restart at line 9: out-time 08:23:00. Ideal go = out-time - standing-start loss 5.2 s = 08:22:54; you called go at 08:22:54 -> 0.0 s", own "Restart (go vs out-time)" bias row |
| C1 | Perf card / book on line 1 at the first STOP | FIXED | Card title "STOPPED: LINE 2", row 2 tagged "STOPPED HERE", "wait 20.2 more s", hint "Book is on line 1: press N". The pointer itself stays on 1 at Bronze until N (residual, see N5) |
| C2 | False "storage blocked" banner | FIXED | `#navnote` empty on direct loads of #/settings, #/cockpit/..., #/quiz/D09 in a fresh profile |
| C3 | Pre-read overlay covers the HUD | FIXED | `button[data-scale=4]` click succeeds in the pre-read |
| C4 | Notes box keeps focus after Enter | FIXED | note blurred; Space then toggles the watch (true -> false) |
| C5 | Digital watch only a caption | NOT FIXED (partial) | Digital now shows a big LCD "0:07.00" (`reval-cockpit-digital-1366.png`) but the dial is still the analog face, bezel still analog, no split recall (UI-REQUESTS #15 admits it) |
| C6a | D07 has no factor / cheat-card control | FIXED | `#calbox`: Set factor and Set card work, speedo caption and splits changed as expected |
| C6b | "MILE 1..6" labels for 3:00 splits; two different "perfect" numbers on one row | NOT FIXED | Book still prints "MILE 5 ... perfect cumulative 15:36 Col C perfect: 15:00" |
| C7 | Aborted runs counted | FIXED | D05 End run: banner "not recorded", Home card "not yet played", not in Last runs |
| C8 | Two kinds of "points" | FIXED | Home "D03 5 raw s", "D09 13 wrong", card "best 5 raw s", Debrief "Raw 5 s x 0.845" |
| C8b | No prompt to call S at the finish | NOT FIXED | No cockpit prompt; Debrief now says "You did not stop at the Observation Checkpoint: call stop before the finish banner" and headline "observation checkpoint missed" after the 60 s is lost |
| C9 | Reload / Back / Retry history | FIXED | Retry no longer adds an entry (Back lands on `#/debrief`); reload on `#/debrief` re-renders it; reload mid-run keeps a saved run (beforeunload fires) |
| C10 | Silent rejection / quiz feedback | FIXED | E + "g5" Enter flashes "Not a number: nothing set"; wrong quiz answers show the right option (`.reveal`). (`T` before departure not re-tested) |
| K1 | Small-window layout | FIXED | 1280x720, 1366x768, 1920x1080, 1024x700: scrollHeight == innerHeight, no overlaps, stopwatch inside the pane, lap list fits (shows last 3 laps) (`reval-layout-*`) |
| K2 | Light theme HUD unreadable | FIXED | chips keep the dark background with light text (`reval-cockpit-light-1366.png`) |
| K3 | "START START", stretched Ledger panel | FIXED | Rows read "START. Speed 35"; Debrief panels align to the top |
| K4 | HUD controls tiny | NOT FIXED | Same 12 px buttons |

### Playability validation

| ID | Issue | Status | Evidence |
|---|---|---|---|
| V1 | No "start here" / next action | FIXED | Home "Start here" panel with a path chip list and "Next: ..." button that advances after each step (lesson, D01, D03, D04, D05, D08, D10, D18) (`reval-home-1366x768.png`) |
| V2 | D01 pre-read generic, objective not restated, no "press L" | FIXED | D01 pre-read has Objective, "The keys that matter" (D, Space, L) and D01-specific text; one-line hint bar in the cockpit |
| V3 | Keys overlay covers nav/HUD | NOT FIXED | Overlay now sits on top of the HUD chips and the pre-read and its first rows are clipped at the top of the road view (`reval-keys-overlay-1366.png`) |
| V5 | Quizzes mouse-only | FIXED | 1-4 answers, Enter/Space next |
| V6 | Resize / zoom layout defect, 1280x720 overlap | FIXED | live 1920 -> 1366 -> 1280 -> 1920 -> 1280 all OK |
| V7a | 2 px scroll, stopwatch overlap, tiny lap list | FIXED | see K1 |
| V7b | Bezel text collides with dial legend | NOT FIXED | "bezel 20.2s" still printed over the dial legend |
| V8 | Card minutes understate real time | NOT FIXED | Cards unchanged (D01 ~3, D03 ~6, D04 ~7, D07 ~12, D18 ~6, D11 ~15) vs 1x sim 4:07, 9:22-9:57, 9:57, 45:33, 5:15, 27:29 |
| V9 | Default 1x, `>` undiscoverable, D01/D03 locked 1x | NOT FIXED | Unchanged; the hint bar does not mention the scale keys and the Keys overlay is broken (V3) |
| V10a | Stars per drill, no tier payoff | FIXED | Per-tier pips on every card (D03 after Gold run: Bronze ★★☆ Gold ★★☆) |
| V10b | Unlocks use best stars of any tier; Bronze oracle aids unlock content | NOT FIXED | `recordRun` still keeps `stars = max`, `best[id] = p.stars` for locks |
| V11 | Home Last-runs unit mismatch | FIXED | "D01 1 raw s ★★★ · D03 40 raw s · D03 5 raw s ★★ · D09 13 wrong" |
| V13 | D18 no Next; D11 offers locked D12 | FIXED | "🔒 Next drill: D11 (needs D18 ★, D07 ★★)" disabled; D11 -> "🔒 D12 (needs D11 ★, D15 ★, D16 ★)" |
| V14 | Debrief gone after reload | FIXED | see C9 |
| V15a | Headline tip wrong (turn tip while stops +41 s) | FIXED | D03/D11 top tip is the stops tip; "speedometer reads low" headline gone |
| V15b | Blames "card / speedo" for speed-hold noise under a perfect speedo | NOT FIXED | Worked arithmetic still "your card is 0.5 % high (call less)" in D01/D03/D04 (D01 has no card); bias row "You gain 1.1 s per leg at cruise ... Call -1 sooner" |
| V16 | Dad has no personality / variants / reactions | NOT FIXED | Same status read-outs |
| V17 | False "Did the turn, line 2" when no turn was called | NOT FIXED | Reproduced in the wrong-turn run (`reval-lost-no-turn-call-1366.png`) |
| V18 | HUD says "cruise" at the dead end | FIXED | chip shows "offcourse"; no prompt to press U (Dad only says "Road ends here. Dead end!") |
| V19 | Difficulty cliff D03/D04 (rung 3) -> D18/D11 (rung 1) | NOT FIXED | D18 Bronze still no card, no pace aid; first D18 28 s / 0 stars, first D11 66 s / 0 stars |
| V20 | Turn loss invisible (D11 Turns +26 s) | NOT FIXED | Turning-STOP loss is now on the card (W1) but non-stop turn loss has no number on the card, Reference or Debrief per-turn (the bucket tip exists) |
| V21 | Unlock path not signposted | FIXED | Start path lists D05, D08, D10 before D18; lock lines list the needed stars |
| V22 | No save/resume; leaving silently discards | FIXED | Home "Resume / Restart the same seed / Discard"; restored stopwatch (running), bezel, notes, GO-at text, driver state; beforeunload; SPA nav-away saves (caveat N4) |
| V24 | Bronze pace aid is an oracle ("wait 20.2 more s") | NOT FIXED | Still shown at Bronze |
| V25 | Pause is free and unrecorded | NOT FIXED | Nothing in the Debrief |
| V26 | Pre-read hard-coded "about 4 s" | FIXED | Computed from the car: 4.4 s at 35, 7.1 s at 50 (D11), 5.2 s at 40 |
| V27 | D09 deck repeats, fixed order | FIXED | 20 distinct cards, options shuffled |
| V28 | No aces wall / streaks / unlock moment | NOT FIXED | not addressed |
| V29 | Everything on one screen; legal mode | FIXED (legal part) | At rung <= 1 (D03 Gold, D18 Bronze/Gold): no digital clock, no mph, no "to go", no computed card ("Legal mode: no computed card"), no `card x s` in the book (`reval-d03gold-at-stop-1920.png`). Bronze/Silver still show everything by design |

Tally: **FIXED 34, NOT FIXED 17 (C5, C6b, C8b, K4, V3, V7b, V8, V9, V10b, V15b, V16, V17, V19, V20, V24, V25, V28), REGRESSED 0.** (PT-03: 15 fixed / 4 not; playability: 19 fixed / 13 not.) Not re-tested: D12 pre-read length / calibration-on-perfect-speedo, `T` before departure.

## 2. New bugs

| # | Sev | Bug | Steps / expected / actual | Screenshot |
|---|---|---|---|---|
| N1 | Medium | Bias/noise verdicts and the "Also:" tips ignore this run's data | D03 by the card: 6 stops, mean +1.1, SD 0.1 -> verdict "noise" and "Your dwells scatter: count the bezel out loud" (rule printed above says |mean| > sd = bias). Rows with N=0/1 or 0.0/0.0 still get a verdict + advice ("Turn callout timing scatters" with SD 0.0; D16 with no stops: "Your dwells scatter"; D01 "Cruise ... Call -1 sooner"). Cause: verdict comes from the 10-run history. Expected: judge this run, hide rows with N=0/1 | `reval-d03-run2-card-debrief-full.png` |
| N2 | Medium | Headline tip contradicts good runs | D16 seed 1 perfect run (0 s, 2 aces): "Fix this next: Landmark speed changes are mistimed. Begin the change half a ramp early" (the +5 s ramp bucket) with "(buckets sum +5, rounding residual -5)", headline "★★★ 0, 0 s". D07: top tip "begin half a ramp early" while the speed-change mean is -0.6 (already early). Expected "Clean run" / tip that follows the sign | `reval-d16-t0-debrief.png` |
| N3 | Low | Uncaught TypeError on the quiz result screen | Finish D09, press a digit: `Cannot read properties of undefined (reading 'classList')` (stale key handler, `buttons[k]` undefined). Harmless but a page error | - |
| N4 | Medium-low | After F5 mid-run the cockpit shows a fresh pre-read with no mention of the saved run | Run D03 12 s in, reload: pre-read of a new run, saved run only on Home ("Resume"). A player who hits F5 believes the run is lost, and starting the new run overwrites the save | `reval-resume-after-reload-cockpit.png` |
| N5 | Low | Perf card clips its last line at <= 1366x768 | At a stop the card (wait-more row + "Book is on line 1: press N") needs 139 px in a 122 px box (`overflow:auto`), the N hint is half hidden; fine at 1920x1080. At Bronze the book pointer itself still needs N | `reval-d03-run2-card-at-stop.png`, `reval-perfcard-at-stop-1280x720.png` |
| N6 | Low | "(60.0 to go)" at the index crossing | Bezel stored as 20.200000000000003: the readout goes 0.4, 0.2, then **60.0** at the instant the hand reaches the index instead of 0.0 (float wrap in `bezelRemaining`) | - |
| N7 | Low | Debrief shows "driving 1:60" | Elapsed 119.97 s formats as 1:60 (seen on a D13 run ended at ~2 min) | - |
| N8 | Low | HUD scale buttons selectable on locked-1x drills | D01/D03: clicking 4x outlines "4x" while the chip says "1x locked" | `reval-d01-run-1366x768.png` |
| N9 | Low | `#/campaign` ignores the D13 lock and has no nav link | D13 card says "Locked: needs D12 ★" but the screen is reachable by URL and Play works. Screen itself is fine: nine stages, tier select, replay, cumulative total; a forced D13 finish recorded Stage 3 correctly | `reval-campaign-1366.png`, `reval-campaign-after-stage-1366.png` |
| N10 | Low | Rookie driver's release lag is billed to the navigator | D03 Gold line 7: G pressed 6.7 s after "wait", driver released 3.9 s later; Debrief "your dwell 10.6 -> +5.0" and "Your stops cost more than the printed pause. Go earlier" | `reval-d03gold-debrief-1920.png` |
| N11 | Cosmetic | Ledger box "Pace aid: -227.8 s" during the D16 restart hold (meaningless while the arrow says EARLY) | - | `reval-d16-t0-restart-hold-1366.png` |

D16 restart rendering itself is good: book row "RESTART at 09:05:05", pre-read "Line 2: RESTART at 09:05:05", card "not a stop ... out-time minus the standing-start loss (4.4 s)", Dad "Lunch stop. Say go at our restart time", Debrief "Ideal go = out-time - 4.4 s = 09:05:00; you called go at 09:05:00 -> 0.0 s". Hour rollover (08:59:11 start, 09:05:05 restart) renders correctly. (The row text duplicates "RESTART. At Restart." + "RESTART at ..." - cosmetic.)

## 3. Playability rubric (0-5; previous in brackets)

| # | Dimension | Score | Why |
|---|---|---|---|
| 1 | First-run clarity | 4.0 (2.0) | Start-here path with a live "Next" button, D01-specific pre-read + hint bar, School -> D01 flow works. Still: lesson 1 ends on lesson 2 not D01, Keys overlay broken, 25 cards below, no S-at-finish prompt |
| 2 | Control scheme | 4.0 (3.5) | Stop card/row follow the stopped line, notes blur, HUD clickable, quiz keys. `>` undiscoverable, pointer still needs N at Bronze |
| 3 | Information layout | 4.0 (3.0) | No overflow/overlap at 1024-1920 incl. live resize. Bezel text on dial, 17 px clip in the card at <= 1366 |
| 4 | Pace | 3.0 (3.0) | Unchanged: 1x default, card minutes 30-280 % low (D07 12 vs 45 min), D01/D03 locked 1x |
| 5 | Feedback and progression | 4.0 (3.5) | Per-tier pips, one unit everywhere, locked Next buttons, Debrief survives reload, restart worked arithmetic. N1/N2 advice glitches, any-tier unlock |
| 6 | Dad's messages | 3.0 (3.0) | Unchanged; false "Did the turn" check-off remains |
| 7 | Difficulty curve | 2.5 (2.5) | Cliff D04 -> D18 (rung 3 -> 1) and invisible non-stop turn loss unchanged; D18 28 s/0 stars, D11 66 s/0 stars; stop arithmetic is now consistent |
| 8 | Session-length fit | 4.0 (2.5) | Resume restores watch, bezel, notes, GO-at; beforeunload; nav-away saves. N4 and card minutes remain |
| 9 | Delight / polish | 3.5 (3.5) | Campaign screen, LCD readout, readable light theme, clean Debrief; offset by broken Keys overlay, "1:60", perfect-run tip |
| 10 | Frustration / recoverability | 4.0 (3.0) | Lost-place, resize, notes focus, aborted-run, reload losses fixed; "offcourse" state shown. No "press U" prompt, no S prompt |
| 11 | Realism integrity | 3.5 (3.0) | Card == Debrief truth, legal mode hides digital readouts and the card, restart judged on out-time, computed pre-read, corrected lessons, factor/card controls. Free pause, Bronze oracle aid unlocking anything remain |
| | **Total** | **39.5 / 55 (was 32.5)** | |

## 4. Verdict for Sunday

**Yes, ready.** The core loop that the first validation praised now also works for a beginner without outside help: Start here -> lesson -> D01 -> D03 (naive 40 s/0 stars -> carded 5 s/2 stars with real bezel keys) -> D04, the card at a stop is the Debrief's truth, a run can be paused across an evening (Resume), the cockpit fits 1280x720 to 1920x1080 and survives a resize, and D07 can actually be calibrated in the app. No blocking defect found; the four earlier blockers (B1 resume, B2 resize, B3 line at stops, B4 wrong headline tip) are all closed.

What Josh should expect to trip over (none blocks play): (1) Keys overlay is unusable, so tell him `>`/`.` speeds time up (adaptive 4x, drops to 1x near features) and `[ ]`, `N` at Bronze; (2) "Fix this next / Also / Bias or noise" advice can be wrong or irrelevant (N1, N2): trust the worked-arithmetic lines, not the "scatter" sentences; (3) D18/D11 Bronze have no card or pace bar (cliff) and non-stop turns cost seconds with no number: first D11 will be 40-70 s late; (4) reload mid-run lands on a fresh pre-read, go Home and press Resume; (5) the card minutes are optimistic: plan D11 as ~27 min at 1x (~15 at 4x), D07 as ~45 min; (6) call S at the finish or lose 60 s.

Suggested next fixes (each <= half a day): N1/N2 (judge this run, hide N<2 rows, "Clean run" when raw <= 3), Keys overlay position, resume banner on the cockpit (N4), turn-loss number on the card, unlock on Silver stars, card minutes from the 1x numbers, S-at-finish prompt, `>` in the hint bar.

# PT-11: Playability on the PT-10 fix sprint (ENGINE 3.3.0)

Build under test: HEAD 7473492 (status-only commits on top of db0837c, "Fix sprint PT-10"); ENGINE 3.3.0.

## Method
- **Build.** `npm run build`, then `dist` copied to a pinned scratch snapshot and served with `npx vite preview --port 4181 --outDir <snapshot>`. Chromium at /opt/pw-browsers/chromium, Playwright, 1366x768.
- **Rules.** Every player action was a real key press or a real click/fill. Sim time moved only through `window.__rally.advance`, with the cockpit loop held.
- **No Agent tool** was available in this session, so I ran every drill group myself. There were no uncaught page errors in any run.
- **One shared profile.** `playtest-scripts/pt11-path.ts` follows Home's "Next:" button only.
  - Evening one started from a fresh profile.
  - Evening two was a new browser on the saved profile (the resume).
  - A scratch evening three (`PT11_OUT=<copy>`) ran on a copy of the evening-two profile. It finished the Silver replays, D18 and D11.
- **Wall-time model.** The same as PT-10:
  - a lesson is 200 words a minute (both pages of a paged lesson), plus 1 minute for the check;
  - D09 is 15 s a card;
  - a drive takes the cockpit's own scale rules, plus 2 minutes of pre-read and 2 of Debrief.
  - D16 now runs at its default 8x. Josh keeps the default. The hold margin is 45 s.
- **The player** is the PT-10 Josh: a card follower at Bronze, who uses K, W, Q and the count, the 10 % rule from the pace aid (D08, D18, D11) and P behind trucks. PT-11 adds three things.
  - **Silver (the card prints no dwell, call time or lead).**
    - Dwell = pause - DEC(in) - ACC(out) from the simple chart.
    - At a stop that turns he also subtracts TS/G - S/G, as the pause-arithmetic lesson now teaches.
    - Timed segments are counted from the ghost's departure (Stopped - DEC + pause), as the card says.
    - The ramp lead is read off chart (a) (C overlay), **as the withheld card tells him** ("minus the ramp lead (chart (a), 30 to 40; press C)").
  - **Legal rung.** No count, so he launches on his own time minus the 0 > v cell of the simple chart, and presses K at holds.
  - **D06 Bronze.** He copies the Packard cells from the C overlay.
- **Scratch probes** (`PT11_NOSAVE=1`, separate output folders):
  - D06 Silver/Gold four ways (`pt11-d06-silver.ts`: measure / stock / blank / debriefcopy);
  - D09 decks and lesson checks (`pt11-02-d09.ts`, `pt11-01-checks.ts`);
  - N-B14 on D10 seeds 1-10 × Bronze/Silver × calls at 500 and 900 ft (`pt11-04-d10-nb14.ts`);
  - Dad's card PDF (`pt11-05-dadcard.ts`);
  - the Silver withheld card (`pt11-06-silver-card.ts`);
  - the day stage `builtin/stage/1` at Bronze (`pt11-10-stage.ts`);
  - D11 at rung 1 (`pt11-run.ts drill/D11/1/1`).
- **Harness slips** (mine; re-run and not counted as product results):
  1. **Evening two, D04 Silver.** My first Silver model read "call 40 at 15 s" out of "call 40 at 15 s minus the ramp lead", so the three D04 Silver tries in evening two called at T. I then re-ran D04 and D05 Silver with the model reading chart (a) exactly as the card says, and both came out ★ again (see N-D1). So evening two's outcome ("stuck on D04 Silver") stands, for a product reason.
  2. **Evening three, D18 Silver.** My first run waited for a start count that the legal rung does not show, and left 30 min late. Evening three was restarted at that step with an own-time launch.
  3. **Evening three uses `leadRule=convert`.** The lead is taken as chart (a) × OUT / |OUT - IN|, which is what the card should say. This shows what the path reaches once N-D1 is fixed. With the card's wording, D04 and D05 Silver are ★.

## 1. The evenings as played

| t | Step (Home's "Next:" button) | Result | Wall |
|---|---|---|---|
| **Evening 1** 0:00 | Lessons: the Four S's (758 words), Transits and restarts (1,464, two pages), Which timer, when (1,117), The ghost car (305) | Every lesson's "Next on your path" was Home's next step. | 22 min |
| 0:22 | D16 Bronze at 8x. "Fast-forward to 45 s before the launch" leaves secondsToLaunch at 45.0; then W, Q and the count. | **★★★**, legs 0/0/+1, "Every departure was on its second" | **19 min** (PT-10: 29) |
| 0:41 | Lessons: the GRIID page (988), Team protocol and Dad's card (1,922, two pages; card printed to PDF) | | 17 min |
| 0:58 | D09 deck (seed pinned); Josh misses the jog and the acute right | 18/20 ★★. The right option was the longest on only 3/20 cards. | 5 min |
| 1:03 | "When you are lost" (532), then D10 Bronze | ★★ (13 s, on course; "Turns +12") | 4 + 10 min |
| 1:17 | "Pause arithmetic" (546), D01 Bronze, D03 Bronze (1x) | ★★★, ★★★ | 4 + 9 + 14 min |
| 1:44 | "Timed segments" (360), D04 Bronze | ★★★ | 3 + 10 min |
| **1:56** | **End of evening one.** Home: "Next: D05 Speed changes at landmarks". | **15 of 23 path steps** (PT-10: 13) | |
| **Evening 2** (new browser on the saved profile) | Home: every tick, "Last runs: D09 2 wrong ★★ · D10 13 raw s ★★ · D01 · D03 · D04 ★★★", Next = D05 | Resume clean (`pt11-e2-home-start.png`) | |
| 0:00 | D05, "Measure your car", D06 Bronze (copy the Packard), "Early, late and the 10 % rule" (paged), D08, "Calibration", D07 | All ★★★ at Bronze | 75 min |
| 1:15 | "Replay D03 at Silver (D18 needs D03 ★★ …)": dwell worked out from the simple chart | ★★★ | 14 min |
| 1:29 | "Replay D04 at Silver" ×3 | **★ ★ ★**. The card says "call 40 at 15 s minus the ramp lead (chart (a), 30 to 40)". Chart (a) 30>40 is 0.5 s, but the lead the Debrief grades on is 2.3 s. | 29 min |
| **1:58** | **End of evening two: stuck.** Home: "Next: Replay D04 at Silver". | All 23 Bronze steps, plus D03 at Silver | |
| scratch evening 3 (lead converted) | D04, D05, D08, D10 and D16 at Silver | ★★★ ×5 (D16 Silver legal: 19 min at 8x) | 56 min |
| 0:56 | D18 Bronze | ★★★. Next: "Read first: Marking up the instructions (before D11)". That lesson has no path Next (N-D9). | 9 + 5 min |
| 1:10 | "Replay D18 at Silver (D11 needs D18 ★)", "Replay D07 at Silver (D11 needs D07 ★★)" | ★ (11 s; no pace aid, so no make-up), ★★★ | 9 + 21 min |
| 1:40 | D11 Bronze | ★ (7 s raw; see N-D6). Home: "Path complete. D11 (full leg) is open; D12 opens with D11 ★, D15 ★ at Silver or Gold." No button. | 26 min |
| scratch | Day stage `builtin/stage/1`, Bronze, by the card at 8x | 238 raw, the same as PT-10 (the harness still files no TA and never laps the calibration points). Layout is unchanged and fits. | 97 min |
| scratch | D11 Silver = rung 1 (dwell from the simple chart with TS/G) | ☆☆☆ **26 s** (PT-10: 31). Turning stops are now +0.4-0.7 s (were +1.5-2.2). | 23 min |

**Does it hold together?** The navigation does:
- 41 path clicks and no dead ends;
- every replay is explained ("D11 needs D18 ★ …");
- the path now leads past D18 to D11 (N-C6 fixed).

The **Silver step does not hold for a card follower**, though. The withheld card sends him to the wrong number for the ramp lead, so D04 and D05 Silver stay ★, and the D18 gate never opens (N-D1).

## 2. PT-10 bugs: FIXED / NOT FIXED / REGRESSED

| PT-10 bug | Status | Evidence on this build |
|---|---|---|
| N-C1 D06 Silver/Gold: hidden car's charts on screen (High) | **FIXED** as filed (new integrity hole N-D2) | C overlay at Silver and Gold: "YOUR CAR'S CHARTS" with 0 cells. The card says "Your car's chart is what you measure today" (printed twice, N-D8), and there is no "card N s" on the STOP rows (`pt11-d06-t1-s1-measure-net-overlay.png`). |
| N-C2 D09 red light taught as a TA | **FIXED** | Card 7 right answer: "Go straight on, new speed at the leading edge; make up a red with the 10 % rule". The tip cites REG V.H.1, and the old answer is now the wrong option "File a Time Allowance for any red light …" (`pt11-e1-d09-card7.png`). |
| N-C3 D06 MARK-out sentence gives negative cells | **FIXED** | "Net = the pace-aid reading at MARK out minus the reading at MARK in (example …)". Following it literally gives 10/10 ★★★ on Silver seeds 1 and 2 and Gold seed 1, all cells positive. The Bronze lines only say "copy"; the pre-read says "launch ON your second" once. |
| N-C4 Answer-pattern tells | **NOT FIXED** (moved) | **D09:** the longest option is right on only 2-3 of 20 cards, but the right one is the **second longest on 15, 15 and 17 of 20** (decks 123, 457, 801). "Pick the only option with a ';' or ':', else the second longest" scores **18, 17 and 20 of 20**. **Lesson checks:** the order is shuffled now (positions 1-4 seen), but the right answer is still the **longest on 6 of the 7 text-answer checks** (four-s 96 vs 57 characters; protocol 76 vs 30; lost 91 vs 45; GRIID 65 vs 57; rally-school 96 vs 81; ghost-car 54 vs 49). `pt11-01-checks.ts` output. |
| N-C5 Turning stops at the legal rung | **FIXED** | The simple chart has a TS/G column. The pause-arithmetic lesson teaches it (35: 9.0 vs 7.6). The tip names the line ("Line 8 is a stop that turns: the turn adds 1.6 s"). D11 rung 1 turning-stop dwells are +0.4 to +0.7 s, and the score went from 31 to 26 s. The tip now misfires on a run that already used the column (N-D5). |
| N-C6 Path complete with no button | **FIXED** | After D18: "Replay D18 at Silver (D11 needs D18 ★ at Silver or Gold)", then "Replay D07 at Silver …", then "D11 Full leg". The path ends only once D11 has a star. |
| N-C7 Silver replays are near-repeats | **FIXED in intent; it now breaks the path (N-D1)** | At Silver the card prints no dwell, call time or ramp lead. D03 Silver needs the chart arithmetic (★★★ when done right). But the withheld timed and ramp lines point to chart (a), which is the net loss, not the lead. A card follower gets ★ on D04 and D05 Silver, and the D18 gate stays shut. The Silver pre-read still prints the launch second (N-D7). |
| N-C8 D10 10 % advice before its lesson; ★★★ needs time skill | **PARTLY** | The advice is fixed ("making seconds up is taught in a later lesson on your path"). The grading is not: an on-course Bronze card follower gets **★ on 6 of 10 seeds** (turns cost 12-25 s), and the tip blames calls and pauses that were exact (N-D3). |
| N-C9 D06 pre-read contradiction | **FIXED** | "A measuring run: leave ON your second … launch ON your second." The Bronze version is "Copy mode: leave ON your second". |
| N-C10 Residual lines on legs that came out right | **PARTLY** | D16 Bronze no longer shows a residual line. Still there: "Start / restart +9" while "Every departure was on its second" (D16 Bronze and Silver); "Ideal go 11:11:55 … +0.5 s" against the card's 11:11:56; residual lines on D11 (-3, -4) and on the stage. |
| N-C11 Lock chip shows the lesson id | **FIXED** | "🔒 D10 Course following (needs pass the lesson "When you are lost")". |
| N-C12 Bezel keys on the digital watch | **FIXED** | D03: "L: digital watch: lap L when you say go, to read your dwell". Leftover: Silver still says "G: go when your count reaches the card dwell" when there is no card dwell (N-D7). |
| N-C13 Dad's card print nits | **FIXED** | 0.6 in margin, 13 pt, one page on Letter and on A4. Lines 8, 11, 17 and 20 are rewritten (§4). Nit: with "Background graphics" on, the margin prints as a solid dark frame (N-D10). |
| N-C14 Cockpit polish | **FIXED** | The folded pre-read is "D16: Start on the second [Show the pre-read]" on one line and clear of the toolbar. The status line reads "Dad (expert)" (`pt11-e1-D16-t0-1-after-ff.png`). |
| N-B14 (carried) D10 turn spent on a distractor; wrong T check-off | **FIXED** | 0 "Too late" and 0 "you did not call a turn" messages in 40 D10 runs: Bronze and Silver, seeds 1-10, calls at 500 and 900 ft, 160 passes of a STOP-turn line, every run finished on course (§4). The check-off says "Did the left at the T, line N", and Dad says "No right here, staying on". `turnKept` fired 1-5 times per run. |

**Counts.**
- **PT-10 bugs 1-8 (N-C1 to N-C8):** 5 FIXED (C1, C2, C3, C5, C6), 2 PARTLY (C7, C8), 1 NOT FIXED (C4), 0 REGRESSED.
- **All 14 plus N-B14:** 10 FIXED, 3 PARTLY, 1 NOT FIXED, 0 REGRESSED.
- No old bug came back. Two of the fixes opened new holes:
  - the Silver card's lead source (N-D1);
  - D06's answer key in the Debrief and the stock-Ford copy (N-D2).

### PT-10 top-10

| # | Item | Status |
|---|---|---|
| 1 | Hide the car in D06 Silver/Gold | **FIXED** on screen. Measuring is still optional (N-D2). |
| 2 | D06 wording | **FIXED** |
| 3 | D09 red-light card | **FIXED** |
| 4 | Answer-pattern tells | **NOT FIXED.** Positions are shuffled, but the length and punctuation tells remain (N-D4). |
| 5 | Turning stops at the legal rung | **FIXED** (tip misfire N-D5) |
| 6 | N-B14 | **FIXED** |
| 7 | A button at the path's end | **FIXED** (small gap N-D9) |
| 8 | Silver replays a step up | **PARTLY.** It is a step up, but D04 and D05 point to the wrong number (N-D1). |
| 9 | Lighten evening one | **PARTLY.** D16 is 19 min (was 29). Reading is about the same: paging splits words but does not cut them (§4). |
| 10 | Text hygiene | **PARTLY.** Lock chips, bezel, driver name, the D06 pre-read and the D10 advice are done. Still open: the D10 grading, "Start / restart +9", and the Silver "card dwell" and "launch at" leftovers. |

**Top-10: 6 FIXED, 3 PARTLY, 1 NOT FIXED, 0 REGRESSED.**

## 3. Rubric (0-5; PT-10 in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **4.0** (4.0) | Home's Four S's panel, lock chips with lesson titles, and a Next that is always the promised step. Against it: 3,644 words (22 min) before the first drive, and lesson-check answers still findable by length. |
| 2 | Control scheme | **4.0** (4.0) | The bezel keys are gone from the digital watch, and K, W, Q, P and L work as prompted. "G: go when your count reaches the card dwell" shows at Silver, where there is no card dwell. |
| 3 | Information layout (1366x768) | **4.0** (4.0) | The folded pre-read is on one line, clear of the toolbar. The stage geometry is unchanged and fits. The D06 Silver card prints its "hidden" sentence twice. |
| 4 | Pace | **4.0** (3.5) | D16 takes 19 min at 8x (was 29), and evening one gets two steps further. Still slow: D06 Bronze (19 min of driving, graded on copying), the stage (97 min at 8x), D11 (26 min). |
| 5 | Feedback and progression | **3.5** (4.0) | Better: no N-B14 lines, "Did the left at the T", turning-stop arithmetic, red-light rule, path end. Wrong now: the Silver card's chart (a) lead (N-D1); D05's Debrief says "half the ramp time … it is on your performance card" when it is not; D10 "keep every call and every pause exact" when turns cost 25 s; D11 "go earlier" and "driver wandered" misfires; the D06 Debrief prints the answer key. |
| 6 | Dad's messages | **4.5** (4.0) | N-B14 is gone ("No right here, staying on", "Did the left at the T"). Dad's card prints well. |
| 7 | Difficulty curve | **3.0** (3.5) | The Silver replays are now a real step (the chart arithmetic). But D04 and D05 Silver are a wall for anyone who follows the card. D10 Bronze (expert driver, 10 s) is stricter than D10 Silver (★★★ at 12 s). D06 Silver can be passed without measuring. |
| 8 | Session-length fit | **4.0** (4.5) | Evening one ends cleanly at 15 of 23 steps, and the resume is clean. Evening two ends on three ★ retries of D04 Silver (29 min with no progress). |
| 9 | Delight / polish | **4.0** (4.0) | D16 ★★★ in 19 min, the CAMEO decision cards, "Did the left at the T", a clean one-page card. Against it: a duplicated card line, "launch at 08:00:00 (minus 0 s)", and "Start / restart +9" under "every departure on its second". |
| 10 | Frustration / recoverability | **3.5** (4.5) | The D04 Silver loop: the hint says "call half a ramp early", the card says "minus the ramp lead (chart (a))", the Debrief says "call … half a ramp before the count ends", and chart (a) 30>40 shows 0.5. Nothing tells him the half ramp is 2.3 s. |
| 11 | Realism integrity | **4.0** (4.0) | Gained: the red-light rule (REG V.H.1) and turning stops. Lost: the Silver card equates the net acceleration loss with the ramp lead, which contradicts the handbook's "split the change at the sign" that the app teaches. |
| | **Total** | **42.5 / 55** (44.0) | The sprint fixed what it targeted (10 of 15 fully). The score drops because the new Silver card sends a card follower to the wrong number at the D18 gate, and two Debrief/grading problems now sit on the path (D10 Bronze, D11). |

## 4. Answers

**Is D06 at Silver now an honest measuring drill? No: the car is hidden on screen, but 3 stars do not require measuring.**
- **Measuring as taught works.** Net = out minus in, and stop & go = 15 - net. That gives 10/10 ★★★ on Silver seeds 1 and 2 and Gold seed 1, with every cell positive (`pt11-d06-t1-s1-measure-net-debrief.png`).
- **Copying the stock Ford instead also works.** The cells come from any other drill's C overlay (D04 Bronze: "YOUR CAR'S CHARTS: 1939 FORD DELUXE"), the simple chart on any Silver card, or the Reference.
  - Silver seeds 1, 2, 3 and 4: **10/10 ★★★**. Silver seeds 5 and 6: ★★ (7/10 and 8/10). Gold seed 1: **10/10 ★★★** (`pt11-d06-t1-s1-stock-debrief.png`, `pt11-d06-t2-s1-stock-debrief.png`).
  - Why: the hidden car is the stock Ford with acceleration and braking scaled by 0.85-1.15 (`goldCar`, `src/core/drills/common.ts`), and the tolerance is 1 s.
- **Not measuring at all also works.**
  1. Drive once with no notes: ☆☆☆, but the Debrief prints every true cell ("stop & go 50>45: not noted (chart 3.5 s)", `pt11-d06-t1-s1-blank-debrief.png`).
  2. Retry the same seed (same hidden car), type those ten numbers, and drive: **10/10 ★★★** (`pt11-d06-t1-s1-debriefcopy-debrief.png`).

**Do the D09 cards and lesson checks still have answer tells? Yes, a new tell in D09 and the old one in the lesson checks.**
- **D09.** "The longest is right" is gone: 3, 2 and 2 of 20 on decks 123, 457 and 801. The sprint did it by making one wrong option longer than the right one, so the right answer became the **second longest on 15, 15 and 17 of 20**.
  - The right answer is also the two-clause procedure. It is the only option with a ';' or ':' on 11 of 20 cards ("Read both lines now; full stop and turn right …").
  - "Only option with ; or :, else the second longest" scores **18/20, 17/20 and 20/20** without reading the scene.
  - Several wrong options are still strawmen: "Turn right where your own road ends instead of turning left"; "Turn left at the junction, away from both of the named roads".
- **Position.** Fixed in both: D09's answers fall on 1/2/3/4 (5/5/3/7 of 20), and lesson options are reshuffled on every visit.
- **Lesson checks.** On 6 of the 7 text-answer checks the right option is still the longest, often by 1.5 to 3.4 times. The 7 numeric checks have no tell.

**Is N-B14 gone on every STOP-T in D10? Yes.**
- The probe was 40 runs: Bronze and Silver, seeds 1-10, turn calls at 500 ft and at 900 ft. Each run had 1-7 STOP-turn lines, 160 passes in all, and every run finished on course.
- The count was **0 "Too late, I can't make that …" and 0 "Straight on past line N, you did not call a turn"**.
- The probe's stars (Bronze 8 ★★ and 12 ★; Silver 2 ★★ and 18 ★) do not grade Josh. The probe's Silver player sat the full printed pause, with no chart.
- Dad holds the call (`turnKept` 1-5 per run) and checks off "Did the left at the T, line N".
- In the path run, D10 seed 1 Bronze stayed on course with the four STOP-T calls at about 500 ft. See `04-d10-nb14.txt` in the scratch folder for every run's message list.

**Are the Silver replays a real step up? Yes in design, but two of them are broken by the card's wording.**
- **Real steps.**
  - D03 Silver: ★★★, only when Josh works pause - DEC(in) - ACC(out) himself, and TS/G at the turning stops.
  - D08 and D10 Silver: ★★★, with the 10 % rule.
  - D16 Silver is the legal mode: his own IN + 20 min and lunch = restart - 45; ★★★.
  - D18 Silver at rung 1 has no pace aid, so the make-up is his own (★ at 11 s, enough for D11).
- **D04 and D05 Silver are broken.** The withheld card says "call 40 at 15 s minus the ramp lead (chart (a), 30 to 40; press C)" and "Speed 35 → 25: call it the chart (a) loss for that pair before the landmark".
  - Chart (a) is the **net seconds lost**: 30>40 = 0.5 s and 35>25 = 0.6 s.
  - The lead the Debrief grades on is the **half ramp**: 2.3 s for 30>40, the lesson's "34 not 36".
  - Followed literally: D04 Silver ★ (calls 1.9 s late) and D05 Silver ★ (2.0 s late).
  - Converting the loss into the lead that cancels it (loss × OUT / |OUT − IN|, nowhere in the app): ★★★ and ★★★.
  - Evidence: `pt11-d04-silver-card.png`, `pt11-d05-silver-card.png`, `pt11-e2-D04-t1-1-debrief.png`.
- **Small leaks.** Silver still prints the launch second ("launch at 07:59:55 (minus 5 s)") in the pre-read and on the card. The hint bar still says "the card dwell".

**Is evening one lighter? Yes in driving, no in reading.**
- **D16.** 19.0 min of wall time at its default 8x, including the pre-read and Debrief (PT-10: 29 min). The fast-forward lands at T-45 s, and the count and W/Q all happen. ★★★.
- **Reading before the first drive.** 3,644 words in 22 min (PT-10: 3,950 words, 24 min). Lesson 1 shrank from 1,087 to 758 words.
- **Reading across the same eight lessons.** 7,632 words (PT-10: 7,796), about 40 minutes.
  - The paging splits "Transits" (1,464) and "Team protocol" (1,922) into two screens each. It does not cut a word, and the protocol lesson grew by 29.
- **Net effect.** Evening one ends after D04 (15 of 23 steps) instead of after D03 (13).

**Dad's card printed to PDF: good, one page, readable in a car.**
- Letter and A4 each fit on one page with a 0.6 in margin. The title is 15 pt bold and the 21 numbered rules are 13 pt black on white, filling about 85 % of the page (`pt11-dad-card-print-letter.png`, `pt11-dad-card-print-a4.png`).
- The rewritten lines read plainly:
  - 8: "If traffic blocks the car, say 'keep counting'";
  - 11: "Never stop or slow to 5 mph or less in sight of it: 30 second penalty";
  - 17: "A sign marked 'I' means ignore it";
  - 20: "The first use gets a warning, the next 10 seconds, then 1 minute".
- Nits:
  1. With Chrome's "Background graphics" on, the 0.6 in margin prints as a solid near-black frame (`pt11-dad-card-print-letter-bg.png`): ink-heavy, and ugly in a car.
  2. Line 6 uses "ICE" without saying what it stands for.
  3. Line 20's "the next 10 seconds" still reads oddly ("the second use costs 10 seconds").
  4. 21 rules is a lot for a driver. Five bold "must" lines at the top (full stop, never move before GO, say back, green = drive on, phones off) would help.

## 5. New bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| N-D1 | **High** (path gate) | The Silver withheld card gives the wrong ramp lead | D04 or D05 at Silver; do what the card says ("call 40 at 15 s minus the ramp lead (chart (a), 30 to 40; press C)"; "call it the chart (a) loss for that pair before the landmark"). **Expected:** the half-ramp lead the drill grades and the lesson teaches (30 > 40: 2.3 s, "34 not 36"). **Actual:** chart (a) is the net loss (30 > 40 = 0.5 s), so calls run about 2 s late. D04 Silver ★ (1.9 s off), D05 Silver ★ (2.0 s off), with D18 needing ★★ in both. Evening two ended on three ★ retries. The Debrief and hint then say "half a ramp" with no number. | `pt11-d04-silver-card.png`, `pt11-d05-silver-card.png`, `pt11-e2-D04-t1-1-debrief.png`, `pt11-d04-silver-cardA-debrief.png`. Text at `src/ui/screens/cockpit.ts` ~l.908 (`withheld-timed`) and ~l.910 (`withheld-ramp`); the D05 rubric line "it is on your performance card" in `src/core/drills/index.ts` ~l.73; the simple chart in `src/ui/viewmodels/charts.ts` has no lead column. |
| N-D2 | **High** (integrity) | D06 Silver/Gold gives 3 stars without measuring | (a) Copy the stock 1939 Ford cells from any other drill's C overlay, the simple chart or the Reference: ★★★ on Silver seeds 1-4 and Gold seed 1, ★★ on seeds 5-6. (b) Drive once with no notes; the Debrief prints every true cell; retry the same seed (same car, notes kept) with those: 10/10 ★★★. **Expected:** only measuring earns stars. | `pt11-d06-t1-s1-stock-debrief.png`, `pt11-d06-t2-s1-stock-debrief.png`, `pt11-d06-t1-s1-blank-debrief.png`, `pt11-d06-t1-s1-debriefcopy-debrief.png`. `goldCar` spread (`src/core/drills/common.ts` l.19), the D06 rubric's "not noted (chart X s)" lines (`src/core/drills/d06.ts` ~l.230-250), retry = same seed. |
| N-D3 | **Medium** | D10 Bronze punishes an on-course card follower; the tip misdiagnoses | D10 Bronze, card follower, on course, calls and dwells within 0.5 s. **Actual:** ★ on 6 of 10 seeds, because turns cost 12-25 s (seed 3: "Turns +25", ★, 28 s). The tip "keep every call and every pause exact" is wrong: they were exact. An off-course excursion run with the lost doctrine scores ★★, which beats on course. At Silver the sportsman scale gives ★★★ at 12 s, so Bronze is harder than Silver. | `04-d10-nb14.txt`, `run-d10-s3.txt`, `pt11-e1-D10-t0-1-debrief.png`. `src/core/drills/index.ts` D10 rubric l.131-136 (`timing` thresholds × `driverScale`), `d10TimingTip` l.108. |
| N-D4 | **Medium** (education) | Answer tells moved, not removed | D09: the right option is the second longest on 15-17/20, and "only option with ; or :, else the second longest" scores 17-20/20. Lesson checks: the right option is the longest on 6 of 7 text checks. | `02-d09-dump-{123,457,801}.txt`, `pt11-01-checks.ts` output. `src/core/generator/traps.ts` TRAP_QUIZ; `content/lessons.ts` `check.options`. |
| N-D5 | Medium-low | D11 legal-rung Debrief headline misfires | D11 rung 1 with dwells from the chart and TS/G (stops +0.4 to +0.7 s; the unpaused STOP at line 10 costs 12.2 s). **Actual:** "Your stops cost more than the printed pause, so go earlier … Line 8 is a stop that turns: … go 1.6 s earlier". Josh already did (ideal dwell 0.6, called at 1.3). The real cure for the stops bucket (+16) is "make up the unpaused STOP's 12 s". | `run-d11-legal.txt`, `pt11-d11-legal-debrief.png`. The headline tip selection and `turningStopNote` in the rubrics module (`src/core/rubrics*`). |
| N-D6 | Medium-low | D11 blames the deliberate 10 % make-up on the driver | D11 Bronze with the 10 % rule from the pace aid (cruise -27 s). **Actual:** "Cruise segments ran fast because the driver wandered over the assigned speed: call small corrections (-1) sooner." D08 has the "deliberate make-up … not the driver wandering" exemption (N-B10); D11 does not. | `pt11-e3-D11-t0-1-debrief.png`, `path-e3.txt`. The same tip code as the D08 fix (cruise-bias headline). |
| N-D7 | Low | Silver leftovers that still print or assume Bronze help | D03/D04/D05/D08 Silver: the pre-read and card print "launch at 07:59:55 (minus 5 s)". The hint says "G: go when your count reaches the card dwell". D05's Debrief says the lead "is on your performance card". D18 Silver's tip cites "the handbook's Packard: approach 40, exit 35 = 4.0 s" for the Ford. | peek of `drill/D08/1/1`; `cockpit.ts` pre-read launch line, `src/ui/viewmodels/hints.ts`, `src/core/drills/index.ts` D05 |
| N-D8 | Low | D06 card text | Silver card prints "Your car's chart is what you measure today: …" twice. The pre-read says "launch at 08:00:00 (minus 0 s)". | peek of `drill/D06/1/1`; `cockpit.ts` (`HIDDEN_CHARTS_TEXT` added twice) |
| N-D9 | Low | Path seams before D11 | After D18, Home sends Josh to "Read first: Marking up the instructions (before D11)". That lesson has no "Next on your path" (only "Next lesson: When you are lost", already passed). After D11 the Debrief has no Next, and Home's "Path complete" has no button toward D15 or D11 at Silver. | `pt11-e3-home-end.png`, `path-e3.txt`; `src/ui/viewmodels/curriculum.ts` `pathNext` / lesson Next in `screens/school.ts` |
| N-D10 | Low | Dad's card prints a dark frame with background graphics | Print with "Background graphics" on: the 0.6 in margin is solid near-black. | `pt11-dad-card-print-letter-bg.png`; `src/ui/styles.css` print block (the page canvas takes the dark `:root` scheme; set the light scheme / a white page background under `html.print-card-only`) |
| N-D11 | Low (carried N-C10) | Start bucket and rounding noise | D16 Bronze and Silver: "Start / restart +9" under "Every departure was on its second"; "Ideal go 11:11:55 … +0.5 s" against the card's 11:11:56. D11: "Start / restart +4" with both launches 0.0 s. | `path-e1.txt`, `path-e3.txt`; `src/ui/viewmodels/debrief.ts` buckets |
| N-D12 | Low (carried) | D06 Bronze is 19 minutes of driving graded on copying | Unchanged from PT-10. | `path-e2.txt` |

## 6. Where the Debrief advice was wrong or unhelpful
1. **D04 Silver (★).** "Count from the ghost's departure and call half a ramp early" is right, but there is no number for the half ramp anywhere at Silver. The card he just used says chart (a), which is 0.5 s (N-D1).
2. **D05 Silver (★).** "Lead time = half the ramp time for that pair of speeds (it is on your performance card)": at Silver it is not on the card.
3. **D06 Silver, blank run.** It prints the whole answer key ("not noted (chart 3.5 s)"), which makes the retry a copy exercise (N-D2).
4. **D10 Bronze on course (★).** "Keep every call and every pause exact": they were (dwells +0.4 to +0.5 s). The 25 s came from four non-stop turns.
5. **D11 rung 1 (☆☆☆, 26 s).** "Go earlier" and "go 1.6 s earlier at line 8" on a run whose turning-stop dwell already took the 1.6 s off. The real loss was the unpaused STOP (12.2 s) left unrecovered.
6. **D11 Bronze (★).** "The driver wandered over the assigned speed" about Josh's own 10 % make-up calls.
7. **D16.** "Start / restart +9" and "Ideal go 11:11:55 … +0.5 s" under "Every departure was on its second".
8. **Right and helpful:**
   - D10 Silver: "Turns cost time the ghost does not spend … recover it with the 10 % rule right after the turn" (now after the recovery lesson).
   - D18 Silver: "You lost about 11 s … and never called a make-up speed".
   - D08 Bronze: the deliberate make-up credit.
   - D07: per-point read-offs and k.
   - D06 measuring: "a negative cell means the net forgot the reading at MARK in".

## 7. Confusing moments (in the order Josh meets them)
- **Lessons.** "Next page" splits Transits and Team protocol, but the evening's reading is the same. Every text check can be answered by picking the long, careful-sounding option.
- **D09.** The two-part answer with a semicolon is the right one.
- **D10 Bronze.** "On course all the way" and still ★ with "keep every call exact", although every call was exact.
- **D04 Silver.** Hint: "call half a ramp early". Card: "15 s minus the ramp lead (chart (a), 30 to 40; press C)". Chart (a): 0.5. Debrief: ★, "call the new speed half a ramp before the count ends". Three tries, same result.
- **D06 Silver.** "Your car's chart is what you measure today" (twice). The answer key appears in the Debrief after a run with no notes.
- **After D18.** "Read first: Marking up the instructions" has no path Next. Then D18 again at Silver, D07 again at Silver, then D11, then "Path complete" with no button.

## 8. What two realistic evenings reach
- **Evening one (1:56):** 9 lessons (about 40 minutes of reading), then D16 ★★★, D09 ★★, D10 ★★, and D01, D03 and D04 ★★★. That is 15 of 23 path steps.
- **Evening two (1:58):** D05, D06, D08 and D07 ★★★ at Bronze with their lessons, so every Bronze step is ticked. Then D03 ★★★ at Silver. Then **stuck**: D04 Silver ★ three times, with the card's lead. A real Josh stops here, or pokes the Reference for an answer that is not there.
- **With N-D1 fixed (scratch evening three, 2:06):** D04, D05, D08, D10 and D16 at Silver ★★★; D18 ★★★; the markup lesson; D18 Silver ★; D07 Silver ★★★; D11 Bronze ★. The path is complete at about 2:06.
  - D11 at rung 1 is still ☆☆☆ on the first try (26 s), because the unpaused STOP's loss has to be made up without a pace aid.
  - The day stage is a fourth evening (97 min at 8x; 238 raw, unchanged).

## 9. Top-10 fixes (ranked; file hints)
1. **Give Silver a real ramp lead (N-D1).**
   - Either add a LEAD column (half ramp from the speed below, or a small "lead IN > OUT" table) to the simple chart, or change the withheld card text to "call it the lead for X > Y (simple chart LEAD) before the landmark".
   - Never point to chart (a) for a lead.
   - Fix the D05 rubric's "it is on your performance card" and the D04 tip to name the number.
   - Add a test: a Silver card follower who reads only what the card names gets ★★ or better on D04 and D05 seeds 1-3.
   - Files: `src/ui/screens/cockpit.ts` (~l.908-910), `src/ui/viewmodels/charts.ts`, `src/core/drills/index.ts` (D04/D05 rubrics), `content/lessons.ts` (timed-leads: say where the lead lives).
2. **Make D06 Silver/Gold need a measurement (N-D2).**
   - Do not print true cells for unmeasured pairs in the Debrief: say "measure it", or show truth only for cells whose MARK laps exist.
   - Draw a new hidden car on Retry when the previous run had no notes, or show truth only after a new seed.
   - Widen `goldCar`'s spread, or grade notes within 0.3 s of the stock Ford as "copied from the Ford chart" unless the MARK laps support them.
   - Files: `src/core/drills/d06.ts` rubric, `src/core/drills/common.ts` `goldCar`.
3. **D10 grading and tip (N-D3).**
   - Grade D10 on course and the doctrine, with a time band that allows the turn losses (or subtract the chart turn losses from the leg error) until the recovery lesson is passed.
   - Make the timing tip name the turns bucket ("4 turns cost 25 s; you will learn to make that up in 'Early, late and the 10 % rule'").
   - Keep Bronze no harsher than Silver.
   - Files: `src/core/drills/index.ts` D10 `rubric`, `d10TimingTip`.
4. **Remove the answer tells for real (N-D4).**
   - Write every option as the same kind of sentence: one clause each, the same length ±10 %, no semicolons in only one option, and vary which option is longest.
   - Add a unit test over TRAP_QUIZ and the lesson checks: the right answer's length rank is spread evenly, and no option is alone in carrying ';' or ':'.
   - Files: `src/core/generator/traps.ts`, `content/lessons.ts`, `tests/`.
5. **D11 Debrief truth (N-D5, N-D6).**
   - Fire "go earlier" only when the mean dwell error is above about 1 s.
   - Drop the turning-stop line when that stop's dwell already took the TS/G off.
   - Lead with the unpaused STOP / make-up item when that is the biggest bucket.
   - Carry D08's deliberate make-up exemption to D11 (and D18, D12).
   - Files: the headline-tip selection and `turningStopNote` in the rubric module; cruise-bias tip.
6. **Silver text leftovers (N-D7, N-D8).**
   - At Silver, no "launch at HH:MM:SS (minus N s)" in the pre-read or on the card.
   - Hint: "G: go when your count reaches your dwell".
   - The Ford, not the Packard, in Silver tips.
   - Print the hidden-car sentence once.
   - No "(minus 0 s)".
   - Files: `cockpit.ts`, `hints.ts`, rubric tips.
7. **Path seams (N-D9).**
   - Give the markup lesson (and every Read-first lesson the path sends to) its "Next on your path".
   - After D11, offer "Next: D15 Pre-read triage (D12 needs D15 ★)" or "Replay D11 at Silver" instead of a buttonless "Path complete".
   - Files: `src/ui/viewmodels/curriculum.ts`, `src/ui/screens/school.ts`, `screens/home.ts`.
8. **Cut evening one's reading, not just page it.**
   - Move the Team protocol lesson's long commentary and the Transits lesson's start walk-through into Reference.
   - Leave "read now" pages of about 600 words, and keep Dad's card on page 1.
   - Target under 2,500 words before D16.
   - Files: `content/lessons.ts` (`splitAt` → a reference link).
9. **Start bucket and rounding (N-D11).** Book a launch on its second as 0 in "Start / restart", and compare the ideal go to the card's whole-second launch. Files: `src/ui/viewmodels/debrief.ts`.
10. **Small polish.**
    - Dad's card: white page background in print (N-D10), spell out "ICE", reword line 20 to "the second use costs 10 seconds, the third 1 minute", and bold the five must-rules.
    - Let D06 Bronze end after the copy, or shorten its drive (N-D12).
    - Files: `src/ui/styles.css`, `content/lessons.ts`, `src/core/drills/d06.ts`.

Ratings: realism 4.0/5, fun 4/5.

**Verdict: yes, with fixes 1-3 first.**
- The sprint landed what it aimed at: D06's hidden charts are hidden, the red-light card follows REG V.H.1, turning stops have a column, N-B14 is gone, the path leads to D11, and D16 is 19 minutes.
- But the new Silver card points at the wrong number for the ramp lead, which blocks the path at D04 and D05 for a card follower.
- D06 Silver can still be passed without measuring.
- D10 Bronze grades a clean course run as ★.

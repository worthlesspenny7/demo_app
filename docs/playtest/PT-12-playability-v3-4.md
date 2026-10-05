# PT-12: Playability on the PT-11 / realism v4 fix sprint (ENGINE 3.4.0)

Build under test: HEAD d340756 (status-only commit on top of b5e02d3, "Fix sprint PT-11/realism v4"); ENGINE 3.4.0.

## Method
- **Build.** `npm run build`, then `dist` copied to a pinned scratch snapshot and served with `npx vite preview --port 4183 --outDir <snapshot>`. Chromium at /opt/pw-browsers/chromium, Playwright, 1366x768.
- **Rules.** Every player action was a real key press or a real click/fill. Sim time moved only through `window.__rally.advance`, with the cockpit loop held. No uncaught page errors in any run.
- **No Agent tool** in this session, so every drill group was played here, in parallel processes.
- **One shared profile** (`playtest-scripts/pt12-path.ts`, Home's "Next:" button only):
  - evening one from a fresh profile (120 min budget);
  - evening two in a new browser on the saved profile (the resume, 120 min);
  - a continuation evening on the same profile, following Next through the Silver replays to "Path complete" and D11.
- **Wall-time model.** Unchanged from PT-11: lessons at 200 words a minute plus 1 min for the check; D09 15 s a card; drives by the cockpit's own scale rules plus 2 min pre-read and 2 min Debrief; D16 at its default 8x.
- **The player** is the PT-11 Josh (card follower at Bronze; K, W, Q, the count; the 10 % rule from the pace aid; P behind trucks). Changes for 3.4.0:
  - **Silver** reads the ramp lead where the withheld card now points: the simple chart's Lead column (row = the speed he is at, ↑ or ↓; several rows added for a 20+ mph change; "about half" / "one and a half times" off the 10 mph grid, exactly as `leadSource` prints it).
  - **Chained timed changes**: the second step is counted from the ghost's first change (the model's own arithmetic; the card does not print it, see N-E3).
  - **Legal rung**: dwells from the simple chart (Dec in + Acc out + TS/G at a turning stop), leads from the Lead column, own-time launch, K at holds.
- **Scratch probes** (`PT12_NOSAVE=1`, separate folders):
  - D04 and D05 Silver seeds 1-3, card follower (`pt12-run.ts`);
  - D06 Silver: measure, stock-Ford copy, blank, and Retry with the previous attempt's numbers (`pt12-d06-silver.ts`, `PT12_ATTEMPT=1`);
  - three D09 decks (123, 457, 801) and the 14 lesson checks, with eight tell predictors (`pt12-02-d09.ts`, `pt12-03-tells.ts`, `pt12-01-checks.ts`);
  - the generator's new rows listed straight from the engine (`pt12-20-genrows.ts`) and from the printable book (`pt12-21-book.ts`);
  - the day stage `builtin/stage/1` and `/2` at Bronze, and D12 Bronze (the legal rung, rung 0, same generated day) on seeds 1 and 2 (`pt12-10-stage.ts`, sampling each new row);
  - a chained timed change for a card follower who reads only the card (`pt12-22-chain.ts`);
  - D11 at the legal rung (Silver = rung 1);
  - Dad's card printed to PDF with background graphics on (`pt12-05-dadcard.ts`);
  - the Silver withheld card and the Reference "From the lessons" page (`pt12-06-silver-card.ts`);
  - Silver Lead-column instruction against the graded lead for all 132 speed pairs (engine import, scratch).
- **Harness slips** (mine; fixed and re-run, not counted as product results):
  1. The first Bronze stage runs called no speed for the post-calibration transit and made up time against the pace aid there (which the screen hides in a transit, N14). The car reached the restart 20 min late. The model now calls the card's "call/drive about N mph" and never makes up in a transit; both seeds were re-run.
  2. The first seed-1 Bronze stage finished but crashed on the Debrief screenshot (30 s timeout under load); re-run with a non-fatal screenshot.
  3. The path walker reported "NO NEXT BUTTON" at the end. The button is there ("Next: Play D11 at Silver ...", `pt12-e3-home-end.png`) under another id. N-D9 is fixed.

## 1. The evenings as played

| t | Step (Home's "Next:" button) | Result | Wall |
|---|---|---|---|
| **Evening 1** 0:00 | Four S's (670 words), Transits and restarts (736), Which timer (895), The ghost car (307) | Every lesson's "Next on your path" = Home's next. | **17 min** (PT-11: 22) |
| 0:17 | D16 Bronze at 8x | ★★★, legs 0/0/+1, "Start / restart +1", ideal go 11:11:56 = the card | 19 min |
| 0:36 | GRIID page (874), Team protocol (1,105; card printed) | | 12 min |
| 0:48 | D09 (deck 123); Josh misses the jog and the acute right | 18/20 ★★; longest option right on 6/20 | 5 min |
| 0:53 | "When you are lost" (406), D10 Bronze | **★★★** (0.8 s after turn losses; "4 turns cost 12 s, not counted against you at Bronze") | 3 + 10 min |
| 1:06 | Pause arithmetic (546), D01, D03 (1x) | ★★★, ★★★ | 4 + 9 + 14 min |
| 1:34 | Timed segments, D04, D05 | ★★★, ★★★ | 3 + 10 + 9 min |
| 1:55 | Measure your car | | 5 min |
| **2:00** | **End of evening one.** Next: D06. | **17 of 23 path steps** (PT-11: 15) | |
| **Evening 2** (new browser) | Home: every tick kept; Next = D06 | Resume clean (`pt12-e2-home-start.png`) | |
| 0:00 | D06 Bronze (copy the Packard), the 10 % rule lesson, D08, Calibration lesson, D07 | All ★★★ | 62 min |
| 1:02 | Replays at Silver: D03, **D04, D05**, D08, D10, D16 (legal, 8x) | **★★★ ×6, every one first try** | 70 min |
| **2:12** | **End of evening two.** Next: D18. | All 23 Bronze steps but D18, and all six D18 gates at Silver | |
| **Evening 3** (same profile) | D18 Bronze; "Marking up" (its Next = "Replay D18 at Silver"); D18 Silver; D07 Silver; D11 Bronze | ★★★; -; ★ (11 s, no make-up without a pace aid); ★★★; ★ (8 s early, deliberate make-up overshoot) | 73 min |
| 1:13 | Home: "Path complete ..." **with a button** "Next: Play D11 at Silver (D12 needs D11 ★ at Silver or Gold)" | Path complete | |
| scratch | D11 at the legal rung (rung 1), seed 1 | ☆☆☆ **25 s** (PT-11: 26); headline is right now (see §4) | 18 min |
| scratch | Day stage at Bronze, seeds 1 and 2 (8x) | see §4: new rows play; three content bugs | 85-100 min each |
| scratch | D12 Bronze = legal rung 0, seeds 1 and 2 | 300 and 284 raw (no pace aid, no make-up: the legal model never recovers) | 88-106 min each |

**Does it hold together? Yes.** 33 path clicks, no dead end, no wall:
- every Silver replay states its reason ("D18 needs D04 ★★ at Silver or Gold");
- the Read-first lesson leads on;
- "Path complete" now carries a button.

The Silver step that stopped evening two in PT-11 (D04 Silver ★ ×3) is gone: a card follower takes all six Silver gates ★★★ on the first try.

## 2. PT-11 bugs: FIXED / NOT FIXED / REGRESSED

| PT-11 bug | Status | Evidence on this build |
|---|---|---|
| N-D1 Silver card's ramp lead (High) | **FIXED** | The card says "call 40 at 15 s minus the lead for 30 → 40 (simple chart, Lead column, row 30, ↑)", and the Lead column reads ↑2.3 (`pt12-d04-silver-card.png`, `pt12-d05-silver-card.png`). A card follower scores D04 Silver ★★★ on seeds 1, 2 and 3 (1/1/3 raw s, calls 0.3 s off) and D05 Silver ★★★ on seeds 1-3 (2/1/0 raw s, 0.4-0.5 s off). The D05 Debrief names the column. The column is incomplete off the 10-mph grid, but D04 and D05 only use on-grid pairs (new N-E4). |
| N-D2 D06 Silver/Gold without measuring (High) | **PARTLY** | **Copying the stock Ford fails:** ☆☆☆ 2/10, "you noted 4.3, the stock Ford's chart cell, not this car's: copying the Ford chart is not measuring" (`pt12-d06-t1-s1-stock-debrief.png`). **A blank run prints no answer key:** "not measured: drive the pair and note the net (retry draws a new car ...)" (`pt12-d06-t1-s1-blank-debrief.png`). **Measuring:** ★★★ 10/10. **But Retry with the previous attempt's numbers:** ★★★ 10/10 without measuring (`pt12-d06-t1-s1-a1-debriefcopy-debrief.png`). The "new" car on attempt 1 is the attempt-0 car within 0.1 % (a0 9.243 vs 9.233, aDec 10.857 vs 10.898), and across attempts 0-3 of seeds 1-5 every cell stays inside the 1 s tolerance (new N-E5). |
| N-D3 D10 Bronze punishes on-course (Medium) | **FIXED** | Path D10 Bronze ★★★: "leg error 0.8 s after the turn losses ... 4 turns cost 12 s (not counted against you at Bronze)". D10 Silver ★★★ at 12 s. Bronze is no harsher than Silver. |
| N-D4 Answer tells (Medium) | **FIXED** (small residue N-E9) | **D09, decks 123 / 457 / 801:** <br>- the longest option is right on 6 / 4 / 6 of 20 and the second longest on 6 / 5 / 5 (chance is 5); <br>- the right option's length rank runs 1-4 evenly; <br>- positions 1-4 are 5/5/3/7, 4/4/8/4 and 5/4/4/7; <br>- no option carries ';' or ':'. <br>**Lesson checks (14):** the right option is the longest on 2 and the second longest on 6. Ratios are 1.07-1.31 on the text checks. Residue: see N-E9. |
| N-D5 D11 legal headline misfire | **FIXED** | D11 rung 1: "Your stops cost 15 s, but your dwells were right (every printed pause within 1 s): the loss is at STOP signs with no pause printed ... make the seconds up with the 10 % rule". |
| N-D6 D11 blames make-up on the driver | **FIXED** | D11 Bronze: "Cruise ran fast because you called a deliberate make-up (the 10 % rule): that is recovery, not the driver wandering. Drop back ... so the make-up does not overshoot into early." |
| N-D7 Silver leftovers | **FIXED** (one slip, N-E10) | The Silver pre-read and card say "launch early by the standing-start loss (simple chart, Acc at 35), to the whole second"; no launch second is printed. Hint: "G: go when your count reaches your dwell". Slip: the D03 Silver objective still says "Bronze hands you the 1936 Packard charts and drives the Packard." |
| N-D8 D06 card text | **FIXED** | The hidden-car sentence is printed once; the pre-read says "launch ON that second" (no "(minus 0 s)"). |
| N-D9 Path seams | **FIXED** | "Marking up" offers "Next on your path: Replay D18 at Silver". The D11 Debrief offers "Play D11 at Silver (D12 needs D11 ★ at Silver or Gold)", and Home's "Path complete" carries the same button (`pt12-e3-home-end.png`). |
| N-D10 Dad's card dark frame | **FIXED** | Letter PDF with background graphics on: a white page, one page, 21 rules; ICE is spelled out; line 20 reads "First use: a warning. Second use: 10 seconds. Third use: 1 minute." (`pt12-dad-card-print-letter-bg.png`). |
| N-D11 Start bucket / rounding | **FIXED** | D16 Bronze: "Start / restart +1" with launches 0.0 / +0.1 s; "Ideal go ... = 11:11:56; you called go at 11:11:56". D11: "Start / restart 0/+1". Residue: D06 Bronze copy mode shows "Start / restart +6" on a drill that says "leave ON the second" (N-E6). |
| N-D12 D06 Bronze long | **NOT FIXED** | 18.8 min, graded on copying (known, LOG "not done"). |

**Counts (12 bugs): 9 FIXED, 1 FIXED with a small residue (N-D4), 1 PARTLY (N-D2), 1 NOT FIXED (N-D12), 0 REGRESSED.**

### PT-11 top-10

| # | Item | Status |
|---|---|---|
| 1 | Real Silver ramp lead | **FIXED** (Lead column incomplete off-grid, N-E4) |
| 2 | D06 Silver needs a measurement | **PARTLY**: Ford copy and blank-run copy are closed; the Retry copy is not (N-E5) |
| 3 | D10 grading and tip | **FIXED** |
| 4 | Answer tells | **FIXED** (small lexical residue, N-E9) |
| 5 | D11 Debrief truth | **FIXED** |
| 6 | Silver text leftovers | **FIXED** (one D03 slip) |
| 7 | Path seams | **FIXED** |
| 8 | Cut evening one's reading | **FIXED**: 2,608 words before D16 (was 3,644); 5,539 across the eight lessons before D01 (was 7,632); Transits and Protocol are one page each with Reference links |
| 9 | Start bucket and rounding | **FIXED** |
| 10 | Small polish | **PARTLY**: print colours, ICE and line 20 are done; the five bold "must" lines on Dad's card and a shorter D06 Bronze are not |

**Top-10: 8 FIXED, 2 PARTLY, 0 NOT FIXED, 0 REGRESSED.**

## 3. Rubric (0-5; PT-11 in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **4.5** (4.0) | 2,608 words (17 min with checks) before the first drive. Tables live on the Reference page ("From the lessons", `pt12-reference-from-lessons.png`). Lesson checks can no longer be answered by length. |
| 2 | Control scheme | **4.0** (4.0) | Unchanged keys. The hint bar matches each tier ("your dwell"). |
| 3 | Information layout (1366x768) | **4.0** (4.0) | The Lead column fits the perf card and the card highlights the rows in use. The new book rows print like the real sheet (§4). At 1366x768 the perf card's simple chart scrolls the 55/50/48 rows out of view. |
| 4 | Pace | **4.0** (4.0) | Unchanged: D06 Bronze 18.8 min of copying; D07 21 min; a day stage 85-100 min at 8x. |
| 5 | Feedback and progression | **4.0** (3.5) | Right now: D04/D05 Silver, D10, D11 headline, D11 make-up, D06 copy detection. Wrong now: <br>- the D06 Debrief coaches compensation on measuring runs (N-E6); <br>- the chain's second step is not on the card, the next-call or the Debrief (N-E3); <br>- the RR-train Debrief blames a call the player never got to make (N-E2); <br>- Home's "Last runs" shows the best stars (N-E8). |
| 6 | Dad's messages | **4.5** (4.5) | "End of the exact transit. What is our out time? Say go on it"; blinker and RR counts; "Train cleared". Against it: Dad says nothing as he holds 40 past a SPEED LIMIT 35 sign (N-E1). |
| 7 | Difficulty curve | **4.0** (3.0) | The Silver replays are a fair step: the arithmetic is on the card, and all six pass first try. D18 Silver ★ is the first place Josh must make time up on his own. D06 Silver can still be passed through Retry. |
| 8 | Session-length fit | **4.5** (4.0) | Evening one ends cleanly at 17 of 23. Evening two ends with every D18 gate open. A third short evening (73 min) reaches "Path complete". No retry loops. |
| 9 | Delight / polish | **4.0** (4.0) | The stage now reads like a 2026 sheet: blinker pauses, "0 MPH / 0m15s / 15 MPH" at the tracks, REG #14 chains, the hourglass transit. Slips: <br>- the "RR tracks" row draws a house landmark; <br>- "note the net.. Retry" has a double period; <br>- the Packard sentence appears on D03 Silver. |
| 10 | Frustration / recoverability | **4.5** (3.5) | Nothing blocks the path. The only ★ results (D18 Silver, D11) carry correct, actionable tips. |
| 11 | Realism integrity | **4.0** (4.0) | Gained: blinker and two-row RR pause rows, 12/15 mph town rows, chained and delayed timed changes, a mid-stage "take exactly" transit, a measured D06 car. Lost: <br>- posted limits below the assigned speed are only painted on: Dad speeds through them (N-E1); <br>- a train at the RR pause row releases the car without GO (N-E2); <br>- at the legal rung the TA helper prints the engine's measured delay (N-E7). |
| | **Total** | **46.0 / 55** (42.5) | The sprint landed every High and Medium item from PT-11. The new generator rows render correctly and mostly play correctly. The remaining problems are the content's edges: posted limits, a train at the new RR row, chain step two, and the Lead column off the 10-mph grid. |

## 4. Answers

**Can D04/D05 Silver be passed by a card follower now? Yes.**
- The withheld card points at the simple chart's Lead column, and the Lead column holds the half-ramp lead the drill grades: 30 → 40 is ↑2.3, the lesson's "34 not 36".
- D04 Silver: ★★★ on seeds 1-3. The calls ran 15 - 2.3 = 12.7, 18 - 2.1 = 15.9 and 36 - 2.3 = 33.7, all 0.3 s off.
- D05 Silver: ★★★ on seeds 1-3, with landmark calls 0.4-0.5 s off.
- In the path both passed on the first try (`pt12-e2-D04-t1-1-debrief.png`).
- Caveat (N-E4): the same column cannot serve every pair a generated day uses. There is no ↑ figure at 48, 50 or 12. "About half" for an 8 mph change gives 1.4 s where 2.3 s is graded. "One and a half times" for changes of 13-45 mph is 1-7 s short. 67 of 132 pairs are unreadable or 0.5 s or more off; all D04/D05 pairs are exact.

**Is D06 at Silver measure-only? Almost.**
- **Copying the Ford chart fails.** The stock Ford's cells from D04's C overlay score ☆☆☆ 2/10, and every copied cell is named: "the stock Ford's chart cell, not this car's: copying the Ford chart is not measuring".
- **A blank run gives no answer key.** Every pair says "not measured ... retry draws a new car".
- **Measuring works.** Net = out minus in; stop & go = 15 - net. That scores ★★★ 10/10.
- **A Retry with the previous Debrief's numbers passes.** The attempt-0 measured notes were typed into attempt 1 (`#/cockpit/drill/D06/1/1/1`, the Retry button's own target) and the car driven without measuring: ★★★ 10/10. The retry car's true cells were identical to one decimal (stop & go 50>45 = 7.1 both times).
  - Root cause: `d06Car` draws f from 1.4-1.6 and seeds the rng with strings that differ only in the last character. Attempts 0-3 of seeds 1-5 give S/G at 50 of 7.2-8.2 s, all inside the 1 s grading tolerance.
  - The Debrief of a measured run also prints "chart X s" for every noted pair. One partly measured run therefore hands over the answers for the next attempt.

**Do any answer tells remain? Length, position and punctuation: no. A weaker lexical one: yes.**
- **D09, three decks:**
  - longest-is-right 6 / 4 / 6 of 20, second longest 6 / 5 / 5, shortest 4 / 5 / 4;
  - positions 5/5/3/7, 4/4/8/4, 5/4/4/7;
  - no ';' or ':' anywhere;
  - "most commas" 11 / 10 / 8 (a mild tell).
- **Lesson checks (14, 10 with text options):** longest-is-right 1, second longest 4, shortest 4; positions reshuffle on every visit.
- **Residue (N-E9):**
  - "Pick the option that repeats the most words of the scene" scores **15, 14 and 15 of 20**.
  - Wrong options often carry a justification word ("since", "because", "anyway", "instead"). No right option among the 60 does, so excluding those options lifts the scene-overlap rule to 16 / 15 / 16.
  - It takes reading the scene, but not understanding it.

**Is evening one's reading lighter? Yes.**
- Before D16: 2,608 words, 13 min of reading plus 4 checks = 17 min (PT-11: 3,644 words, 22 min).
- The eight lessons before D01: 5,539 words, about 28 min (was 7,632, about 38).
- Transits (736) and Team protocol (1,105) are one page each again. Dad's card is still in the protocol lesson, and its tables and examples are one click away on the Reference page.
- Net effect: evening one ends after D05 and "Measure your car" (17 steps) instead of after D04 (15).

**Does the day stage's new content play correctly, and does the book print it like the real sheet?** Mostly yes, with three content bugs.

| New row | Rendered (book, Column C) | Plays (stage Bronze 8x / D12 legal) |
|---|---|---|
| Blinker with pause (seed 1 #45, #50; seed 2 #37, #44; D11 #14) | "0 MPH / 0m15s / 20 MPH", or "0 MPH / 0m15s" when the speed continues, with a flasher symbol (`pt12-book-s1-page9-blinker.png`) | **Yes.** The car stops (fullStop). The Bronze card gives a turn-capped dwell ("Stop 35 in / 35 out (turn capped at 12 mph): loss 9.0 s → dwell 6.0 s"), and the legal model's TS/G dwell came out +0.4 s. |
| 12 / 15 mph town rows (seed 1 #83 CONGESTED AREA 12, #120-123 SPEED LIMIT 15; seed 2 #59 SLOW 15, #66) | "12 MPH", "15 MPH"; the 15 and 12 chart rows exist | **Yes.** Dad: "Holding 12 ... At 12". |
| Posted limit below the assigned speed (seed 1 #58 LIMIT 35 → 40, #162 40 → 45, #166 25 → 30; seed 2 #25, #86 LIMIT 45 → 48) | The white "Speed Limit 35" sign in Column A, "40 MPH" in Column C (`pt12-book-s1-page12-limit.png`) | **No (N-E1).** Dad holds 40.1-40.2 past SPEED LIMIT 35 and 48.3 past SPEED LIMIT 45 (`pt12-stage-s2-bronze-L25.png`). Nothing is said, nothing is scored, and no lesson says what to do. Dad's card rule 1 says "Never speed". |
| Two-row RR crossing (seed 2 #79 round RR sign, 20 MPH; #80 tracks "0 MPH / 0m15s / 15 MPH") | As 11b rows 102-103 (`pt12-book-d12s2-page11-rr.png`). The tracks row also draws a house landmark labelled "RR tracks". | **With no train: yes** (legal: dwell 12 at the tracks, then 15). **With a train: no (N-E2).** The car waits ("Train!", Dad counts 12 … 0 … 29), then on "Train cleared" it drives over the tracks at 20 with no GO and no pause, and never takes 15 (`pt12-stage-s2-bronze-L80.png`). The Debrief then says "Cruise ran fast because 15 at line 80 was never called". |
| Chained timed change (seed 1 #173 "35 / 1m25s / 45 / 1m02s / 55"; seed 2 #17, #47) | REG #14 layout, five stacked items (`pt12-book-d12s2-page3-chain.png`) | **The engine runs the chain; the card does not (N-E3).** The Bronze card prints only "Timed: hold 55 for 50 s, call 40 at 48.1 s (lead 1.9)". The next-call skips to "call 50 at line 18". The Debrief grades only step one. A card follower held 40 instead of 35 for the second step (`pt12-chain-17-step2.png`). |
| Mid-stage exact transit (seed 1 #141-143) | Hourglass and odometer squares in B, "10m00s" plain with an arrow to #143, "35 MPH" (`pt12-book-s1-page28-exact.png`) | **Yes.** Dad: "End of the exact transit. What is our out time? Say go on it". The legal model left at IN + 10 min - 4 s and the leg came out right. Known gap: the blinker in the transit (#142) prints no "(0m45s)" guide (REG #32). |

- **Scores** (they say little about the content; they depend on the model's make-up policy):
  - Bronze seed 2: 106 raw. The make-up stints overshoot to -24..-40 on three legs.
  - Bronze seed 1: 165 raw (legs +42 / +1 / +1 / +2 / +39 / +80). Leg 1 carries a train at the one-row RR (#13), and the harness's TA filing failed on the web form's submit ("element is not visible": a harness limit, as in PT-11). Line 166 shows the same posted-limit problem: speedo 30.1 past SPEED LIMIT 25 (`pt12-stage-s1-bronze-L58.png` shows 40.1 past 35).
  - D12 legal: 300 (seed 1) and 284 (seed 2). The legal Josh has no pace aid and never makes up time (stops +114, hazards +109, turns +76).
- **Book against the frame** (`2026-73m54s+0-five-column-instruction-page-footer-page-1-of-13.jpg`):
  - Matches: the five columns with row numbers; bold centred stacked Column C ("50 MPH / 29m00s"-style); Column B section icons with odometer squares; full-width thin roads; the three-block footer "© 2026, Great Race · Hemmings Motor News Great Race / Page 1 of 40 · Day stage 1 / Monday, October 5, 2026".
  - Differences: the house icon on the RR tracks row; the generic landmark house on "county line sign"; the exact transit's blinker has no "(0m45s)".

## 5. New bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| N-E1 | **Medium** (realism, education) | Posted limits below the assigned speed are painted on only | Day stage seed 1 line 58 ("SPEED LIMIT 35 ... change average speed to 40"), seed 2 line 25 (LIMIT 45, 48). **Expected** (REG VII.E.1.c, the generator's own comment): the car drives at or below the posted limit, loses the time and the team recovers it before the checkpoint; Dad or the Debrief says so; a lesson line explains it. **Actual:** Dad holds 40.1-40.2 / 48.3, says nothing; nothing in the sim, Debrief or lessons models the limit. Contradicts Dad's card rule 1 and the Reference's "20 % ... never above the posted limit, speeding can disqualify". | `10-stage-s1-bronze.txt` line 58, `pt12-stage-s2-bronze-L25.png`. `src/core/sim.ts` (no limit in the driver target; grep shows none), `src/core/generator/generate.ts` l.646-653, `content/lessons.ts` recovery lesson, Dad lines. |
| N-E2 | **Medium** | A train at the two-row RR pause row releases the car without GO | Day stage seed 2 Bronze: the car stops for a train at line 80 ("0 MPH / 0m15s / 15 MPH"). **Expected:** after "Train cleared" the car is still at a pause row: the navigator times the pause (or the train delay for the TA) and says GO, then 15. **Actual:** "Train cleared", "release train", "passed RR tracks", "At 20": no GO, no pause, no 15. The Debrief's headline then blames Josh: "Cruise ran fast because 15 at line 80 was never called". | `10-stage-s2-bronze.txt` timeline 10:01:25-10:02:15, `pt12-stage-s2-bronze-L80.png`. `src/core/sim.ts` train release on a `Node.fullStop` node (~l.1101 wait / l.877 release); cruise-tip selection in the rubrics. |
| N-E3 | **Medium** | Chained timed change: step two is missing from the card, the next-call and the Debrief | builtin/stage/2 line 17, a Bronze card follower. **Expected:** the card prints "then hold 40 for 33 s, call 35 at … s"; next-call reminds of it; the Debrief grades both steps. **Actual:** the card shows step one only; next-call jumps to line 18; the Debrief lists only "Timed change at line 17: T = 50 …"; the car stays at 40 for the 35 step. About 22 % of generated timed rows are chains. | `22-chain-…-17.txt`, `pt12-chain-17-step2.png`. `src/ui/viewmodels/cockpitinfo.ts` l.191-193 (`card.timed` ignores `chain`), `nextCallPrompt` in `src/ui/viewmodels/v3.ts`, the Debrief's timed-change rows. No `chain` anywhere in `src/ui`. |
| N-E4 | **Medium** | The Lead column and `leadSource` fail off the 10-mph grid | 67 of 132 speed pairs are unreadable or 0.5 s or more off the graded `chartLead`:<br>- no ↑ figure at 48, 50 or 12 (48→50 needs 0.9 s, 48→55 2.5, 50→55 1.9);<br>- "about half" for 8 mph: 40→48 gives 1.4, graded 2.3;<br>- "one and a half times" for 13-45 mph: 30→55 gives 3.4, graded 6.6; 10→55 gives 2.5, graded 9.5;<br>- "add the rows" overshoots by 0.6-1.4 s (50→10).<br>D11 legal: "30→48 call 4.3 s before; you called 3.1". | `leadcheck.txt` (scratch); D11 legal Debrief. `src/ui/viewmodels/charts.ts` `leadSource` l.129-134 and the Lead cells l.155 (print ↑ to 55 from 48 and 50, and a lead for 12; scale by the change, or print a small IN > OUT lead table). |
| N-E5 | **Medium-low** (integrity) | D06 Silver Retry is the same car | Silver seed 1: measure on attempt 0 (★★★), then Retry (`/D06/1/1/1`) and type the same ten notes without measuring: **10/10 ★★★**. Every true cell is identical to one decimal. Over attempts 0-3 of seeds 1-5 every cell stays within the 1 s tolerance. | `d06-t1-s1-a1-debriefcopy.txt`, `pt12-d06-t1-s1-a1-debriefcopy-debrief.png`. `src/core/drills/common.ts` `d06Car` l.26-28 (draw a spread wider than 2× the tolerance per attempt, e.g. 1.3-1.9 with each attempt at least 0.15 from the last, and fork the rng properly). |
| N-E6 | Low-medium | The D06 Debrief and next-call coach compensation on measuring runs | **Silver measure:** the MARK lines say "Measure, do not compensate: no lead, no early call" and the run sits the full 15 s. **Actual:** "Your 'go' calls average 8.3 s late: count down the chart pause time on the stopwatch and say GO on the last second"; next-call: "count the chart pause time, then go". **Bronze copy mode** ("call every speed AT its sign, leave ON the second"): the worked arithmetic grades "call 7.6 s before the landmark … +7.2 s", "Ideal go = out-time - standing-start loss … +2.2 s", "Start / restart +6". | `d06-t1-s1-measure-net.txt`, `path-e2.txt` D06 Debrief. `src/core/drills/d06.ts` rubric, the go-late tip in `src/core/drills/rubrics.ts`, `nextCallPrompt` (skip it under `MEASURE_RUN_TAG`), `src/ui/viewmodels/debrief.ts` worked arithmetic. |
| N-E7 | Low-medium (integrity) | The TA helper is an answer sheet at the legal rung | D12 Bronze (rung 0) TA window: "measured 0m47s = stopped 0m37s + chart loss 9.9 s; make up the odd 7 s, claim 0m40s … suggested request 0m20s". Great Race legal means no computed help. | `10-d12-s1-legal.txt` l.122. `src/ui/screens/cockpit.ts` l.529-530: `taHelper(advice(leg), …)` is always shown; at `!policy.computedCard` show only the navigator's own laps. |
| N-E8 | Low | Home "Last runs" shows the best stars, not the run's | D18 Silver ★☆☆ (11 s). Home: "Last runs: … D18 11 raw s ★★★" (`pt12-e3-home-end.png`). | `src/ui/viewmodels/progress.ts` l.87: the history entry uses `stars` (the drill's max), not `clampStars(run.stars)`. |
| N-E9 | Low (education) | Lexical answer tell in D09 | "The option sharing the most words with the scene" is right on 15 / 14 / 15 of 20. "since / because / anyway / instead" appear only in wrong options (0 of 60 right). | `02-d09-dump-*.txt`, `pt12-03-tells.ts`. `src/core/generator/traps.ts` TRAP_QUIZ; add both predictors to `tests/answer-tells.ts`. |
| N-E10 | Low | Text and drawing slips | <br>- D03 Silver objective: "Bronze hands you the 1936 Packard charts and drives the Packard.";<br>- D06 copy Debrief: "Drive the pair and note the net.. Retry";<br>- the RR tracks row draws a house landmark labelled "RR tracks";<br>- D16 ace legs still get "the driver wandered under the speed: call +1 sooner" for +0.3 s. | `pt12-e2-D03-t1-1-preread.png`, `pt12-book-d12s2-page11-rr.png`; `src/core/drills/index.ts` D03 objective, `d06.ts`, `src/core/cameo.ts` landmark picker, cruise tip threshold. |

## 6. Where the Debrief advice was wrong or unhelpful
1. **D06 Silver measuring run (★★★).** "Your 'go' calls average 8.3 s late: count down the chart pause time": the drill told him to sit the full pause (N-E6).
2. **D06 Bronze copy (★★★).** Speed changes "+7.2 s, call 7.6 s before the landmark" and "Start / restart +6" on a drill that says call AT the sign and leave ON the second (N-E6).
3. **Day stage seed 2.** "Cruise ran fast because 15 at line 80 was never called": the car left the RR tracks by itself after the train (N-E2).
4. **Chained rows.** No line for step two, right or wrong (N-E3).
5. **D16 ace legs.** "+0.3 s … the driver wandered: call +1 sooner" (noise).
6. **Right and helpful:**
   - D10 Bronze: "4 turns cost 12 s (not counted against you at Bronze)".
   - D11 legal: "your dwells were right … the loss is at STOP signs with no pause printed".
   - D11 Bronze: the deliberate make-up credit with "drop back … so the make-up does not overshoot into early".
   - D18 Silver: "You lost about 11 s … never called a make-up speed".
   - D06 stock copy: "copying the Ford chart is not measuring".
   - D05 Silver: "read the simple chart's Lead column: the row of the speed you are at".

## 7. Confusing moments (in the order Josh meets them)
- **D03 Silver.** The objective talks about the Packard while the card shows the Ford's simple chart.
- **D06 Silver.** "Measure, do not compensate", then the Debrief says to count down the chart pause. A blank run's Debrief is honest now. A Retry looks like a new car but is the same one.
- **D18 Silver (★).** The first place with no pace aid, so the make-up is his own. The tip says so plainly.
- **Day stage.** Dad drives 40 past a SPEED LIMIT 35 sign without a word. After a train at the tracks the car drives off on its own. The chain's second speed is not on the card.
- **Legal Silver/Gold days.** Changes up from 48 or 50 have no ↑ lead in the chart, and "one and a half times" for a 25 mph change is far off.

## 8. What two evenings reach
- **Evening one (2:00):** 10 lessons (about 30 min of reading); D16 ★★★, D09 ★★, D10 ★★★, D01, D03, D04 and D05 ★★★. **17 of 23** path steps (PT-11: 15).
- **Evening two (2:12):** D06, D08 and D07 ★★★ with their lessons (22 of 23 ticked). Then all six Silver gates for D18 (D03, D04, D05, D08, D10, D16) ★★★ on the first try. Next: D18. (PT-11: stuck on D04 Silver.)
- **A short third evening (1:13):** D18 ★★★, Marking up, D18 Silver ★, D07 Silver ★★★, D11 ★. **Path complete**, with "Play D11 at Silver" offered.
- The day stage is a fourth evening (85-100 min at 8x). D12 at the legal rung is a long, honest grind (284-300 raw for a navigator who does not yet make time up without a pace aid).

## 9. Top-10 fixes (ranked; file hints)
1. **Make posted limits real (N-E1).**
   - The driver holds min(assigned, posted limit) once a SPEED LIMIT sign below the assigned speed is passed, until the next limit or speed change. Ghost and checkpoint stay on the assigned speed.
   - Dad says "Limit 35 here, holding 35". The Debrief books it as "posted limit: N s, recover after the zone".
   - The recovery lesson gets one line on VII.E.1.c.
   - Files: `src/core/sim.ts` driver target, `src/core/generator/generate.ts` l.646-653 (end the zone with a later limit sign), `content/lessons.ts`, the Debrief buckets.
2. **Train at a pause row keeps the stop (N-E2).**
   - On release at a `fullStop` node, the car stays waiting for GO, and the out speed is the navigator's call.
   - The Debrief does not blame the out-speed call when the engine released the car.
   - Files: `src/core/sim.ts` (wait/release around l.877 and l.1101), the cruise tip in the rubrics.
3. **Show and grade the chain's next step (N-E3).**
   - Card: "then hold 40 for 33 s: call 35 at 31.6 s after the change (lead 1.4)".
   - The next-call names step two; the Debrief adds a "Timed change step 2" row.
   - Files: `src/ui/viewmodels/cockpitinfo.ts` l.191-195, `src/ui/viewmodels/v3.ts` `nextCallPrompt`, `src/ui/viewmodels/debrief.ts`.
4. **Complete the Lead column (N-E4).**
   - Print ↑ figures for 48 and 50 (to 55) and for 12 (to 15/20).
   - Replace "half / one and a half" with a small IN > OUT lead table, or with "half the ramp = (Acc(OUT) - Acc(IN)) for ups, (Dec(IN) - Dec(OUT)) for downs" (exact from the chart's own columns).
   - Test: `leadSource` within 0.3 s of `chartLead` for every pair the generator emits.
   - Files: `src/ui/viewmodels/charts.ts` l.129-157.
5. **A real new car on D06 Retry (N-E5).**
   - Widen and decorrelate `d06Car` per attempt, so that the previous attempt's cells miss by more than 1 s on at least half the pairs.
   - Add a test: attempt n's notes fail attempt n+1.
   - Files: `src/core/drills/common.ts` l.26-28, `tests/pt11-fixes.test.ts`.
6. **D06 Debrief and next-call respect measuring runs (N-E6).**
   - No "go late / count down the chart pause", no lead or launch arithmetic, and no Start bucket under `MEASURE_RUN_TAG`.
   - Files: `src/core/drills/d06.ts`, `src/core/drills/rubrics.ts`, `src/ui/viewmodels/v3.ts`, `src/ui/viewmodels/debrief.ts`.
7. **Legal-rung TA helper (N-E7).** Show only the navigator's own lapped delay and the multiple-of-10 rounding at rungs 0-1. File: `src/ui/screens/cockpit.ts` l.529.
8. **Shorten D06 Bronze (N-D12).** End after the copy, or cut the drive to the three MARK pairs. File: `src/core/drills/d06.ts`.
9. **Home "Last runs" stars (N-E8).** File: `src/ui/viewmodels/progress.ts` l.87.
10. **Polish (N-E9, N-E10, PT-11 nit 4).**
    - Vary D09's wording so that the right option does not echo the scene most.
    - Put the justification words in some right options too.
    - Fix the D03 Silver objective, "net..", and the RR tracks picture.
    - Raise the cruise-tip threshold above 0.5 s.
    - Five bold "must" lines on Dad's card.

Ratings: realism 4.0/5, fun 4.5/5.

**Verdict: yes, ship it to Josh and his dad, with fixes 1-3 before the first full day.**
- The path from "Start here" to D11 now runs without a wall in about five hours over three evenings.
- Every PT-11 High and Medium item is fixed, except the D06 Retry loophole.
- The new generated rows look like the 2026 sheets.
- The remaining problems sit at the edges of the new content: posted limits, a train at the new RR row, the second step of a chain, and leads off the 10-mph grid. They matter most once Josh moves on to full days.

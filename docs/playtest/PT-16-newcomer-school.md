# PT-16: Rally School 2.0, played by a newcomer (Phase IX, 2026-11-22)

Tester: independent agent playing someone who has never heard of TSD rallying and got the link from a friend.
Build: `npm run build` of HEAD 169b9e9 (Phase IX), `npx vite preview --port 4188`. Chromium at /opt/pw-browsers/chromium,
390 x 844 (and 360 x 780 for geometry), `hasTouch` + `isMobile`, real touch taps (`page.touchscreen.tap`, CDP touch drags),
one fresh persistent profile for the whole course. Scripts: `playtest-scripts/pt16-*.ts`. Screenshots: `docs/playtest/screenshots/pt16-*.png` (35).
Nothing under src/, tests/, content/ or public/ was edited; nothing committed.

## Verdict in one paragraph
Modules 0 and 1 are a real improvement: short pages, a slider you can play within 30 s, a check, a first book-row mini-sim,
everything fits one phone screen, chips open short on-topic excerpts. From Module 2 on, the course breaks its own rules:
cards use terms and controls the course has not taught yet (lead, Dad's Mark, the distance bar, CDT, transit), the
one-line pointer often tells you to do something different from what the card wants ("Tap CALL at the Mark" when the
right tap is 2.5 s before the Mark), and on a phone a wrong tap on any timed mini-sim silently restarts the card, so you
never see why. The first unguided run after Module 6 has 4 of 12 cards on topics from Modules 7 to 10. SCH-009 is not met
on the rubric (3.2 average against a 4 floor) or on "controls introduced before use".

## SCH-009 targets

| Target | Result | Pass? |
|---|---|---|
| First mini-sim within 90 s of opening the School | First tap (Start) at about 30 s; first hands-on widget ("Hold 35", which SCHOOL.md lists as a Module 0 mini-sim) at about 32 s. The first decision-card mini-sim (m1 p3, "which way") comes at about 5 min. | Yes for the widget; no for a decision-card mini-sim |
| Modules 0 + 1 under 10 minutes | Modelled at 7.9 min (M0 4.4 min, M1 3.5 min), see timing below; about 9.5 min for a 150 wpm reader | Yes (with little room to spare) |
| at least 8 interactions in M0 + M1 | 8 interaction pages (4 + 4) plus 2 try-its; about 46 state-changing taps | Yes |
| No page over one screen | All 99 pages fit at 390 x 844 and 360 x 780 before and after answering (wrong-answer rule text, lap list included). Landscape 844 x 390 scrolls inside the page (see B21) | Yes (portrait) |
| No page over 70 words | Course pages max 66 (m1 p1). But the first page a brand-new visitor sees shows **91 words** (FIRST_VISIT box 30 + concept + figure labels) | No, one page |
| At most 2 chips per page | 78 chips, never more than 2 on a page; none missing; no excerpt pasted into a page | Yes |
| No reference text inline | Clean on pages; **not** clean on verdicts: every mini-sim miss and every run/try-it verdict prints citations inline, e.g. "(HB p.12; timed hold: 2026 Training Session [120:16] (video) (simulator convention))" | No |
| Every control in the first unguided run introduced before | Daily run 1 after m6: TA claim (m9), lost (m7), exact-transit OUT (m10), make-up plan (m8) were not taught | No |
| Rubric each >= 4 | 3 / 4 / 3 / 3 / 3 | No |

### Timing (pass 1, naive)
Wall-clock of an automated player is meaningless (scripts are reopened between steps), so times are modelled the way a
newcomer reads: words on screen at 200 wpm, 1.5 s per navigation tap, 2 to 3 s to choose an answer, and the measured
real-time durations of the widgets and timed cards.

| Moment | Time | Notes |
|---|---|---|
| Page 1 painted | 0.16 s | first visit lands on #/school, Module 0 page 1, "What is this?" box, Start |
| First interaction (Start) | ~30 s | 91 words to read first |
| First mini-sim (Hold 35 widget) in hand | ~32 s | completes ~20 s later (catch up, then 10 s within 1 mph) |
| Where is the checkpoint? | ~66 to 122 s | the leg runs 31 s; I tapped when the car reached the end of the strip, at 44 s (13 points late) |
| Module 0 done (incl. 5-card try-it) | ~4.4 min | try-it: 5 checkpoint cards, ~14 s each |
| First decision-card mini-sim (m1 p3) | ~5 min | |
| Module 1 done | ~7.9 min | one deliberate miss + retry, one check miss |
| Modules 2 to 6, reading + play (excl. try-its) | 2.0 / 2.0 / 2.6 / 2.4 / 2.8 min | try-its 4 s (option cards) to 63 s (timed cards) |

Words per page: concept 35 to 66, example 26 to 34, mini-sim card 27 to 50 (pointer + prompt + row), widget 19 to 48, check 15 to 32.
No page felt like a wall in Modules 0 to 2; Module 3 p2 and the m3 try-it felt like homework (arithmetic with a word, "lead", not yet taught).

### Moments I did not know what to do next (pass 1)
1. m0 p4 "Tap when you think the ghost reached the sign": there is no sign and no ghost on screen, only my car. I tapped when the car reached the end of the strip: 13 points late. The strip is 1.5 x the leg and the car is 1 mph faster than the ghost (pt16-04-where-result.png).
2. m0 try-it card 1: "A red GREAT RACE STOP board ... Stop and check in": red boards and checking in were never mentioned; the module had just said "you just drive past at your speed" (pt16-34).
3. m1 try-it: the speed answers are greyed and look disabled (pt16-36). I was not sure I was allowed to tap them.
4. m2 p4 "Tap the speed you would call": the only button is a clock with CALL 30; the card says "Call 30 1.4 s before Dad's Mark!" (who is Dad? what is Mark?). I tapped after reading, at 4 s: the card jumped back to 470 ft with no message (pt16-10). It did that every time I tapped early.
5. m2 try-it speed change: no distance bar, a greyed CALL button, no clock (pt16-38). Nothing on screen tells you when "2.9 s before Dad's Mark" is.
6. m3 p2 "Tap START and STOP on the stopwatch": no stopwatch buttons; four time options and "lead 2.5 s ... Call 45 at?" (pt16-25).
7. m5 p4 "Tap CALL at the Mark": I waited for "Mark!" to appear on the bar and tapped: wrong (2.6 s late), and the verdict vanished at once and the card restarted (B1 + B2).
8. After Module 6 the daily run asked me to claim a time allowance, decide what to do when lost, compute an exact-transit OUT time and pick a make-up plan (pt16-29).

### Terms used before they were explained
"pre-read" (m1 cards), "call" (m1 p7, taught m2), "CAMEO" (m1 verdict rule), "Dad" and "Mark" (m2 p4; Mark is taught m5),
"lead" and "ramp" (m2 verdict; m3 cards; taught m5), "CDT" (m2 onward, never explained), "chart" / "Dec(in) / Acc(out)"
(m2 try-it verdict; taught m4), "Transit OUT" (m6 p2; taught m10), "TA" (daily run; taught m9), "check in"/red STOP (m0 try-it; taught m11).

## Pass 2 (critical): Modules 7 to 12, Desk unlock, references, widgets, routes

- Modules 7 to 12 play cleanly on the option cards; all try-its finish; Module 12's recap says "Desk mode is open" and
  Home shows the Desk mode link afterwards (it is hidden for course takers before that). Unguided state after m6: no greys, no pointers.
- Reference chips: 78 chips on 46 pages, every one opens a bottom sheet with a 20-78-word excerpt and a citation, closes
  with Close, never pasted into the page. All on topic except loosely: m2 p1 (ICE) and m8 p6 cite HB p.13 "The Four S's".
  None of the 36 video chips can open a video (content/videos.ts has no URLs; urls.txt is blank). Citations show internal
  repo paths ("extraction docs/research/08-rookie-handbook-body.md §7"), which mean nothing to a friend.
- Widgets against the rules (playtest-scripts/pt16-22-models.ts):
  - holdSpeed: a car 1 % fast for 3,600 s drifts exactly 36.00 s early. Correct. The slider moves in 1 mph steps (2.9 % at 35), so 1 % cannot be felt; fine for Module 0.
  - whereCheckpoint: perfect time for 0.3 mi at 35 = 30.86 s (correct, engine ghost). The design is the problem (B7).
  - tapLap: the split question is right (split = cumulative since START), feedback "0.7 s early" when tapping as the car's nose reaches the marker suggests the marker is compared with the car's middle.
  - readScorecard: 11 + 0 + 8 + 8 + 5 = 32, x 0.845 = 27.04; seeds 1 to 5 all correct to REG V.C.2.e rounding; caps applied.
- Old lesson redirects: all 14 `covers` ids redirect to their module (#/school/protocol -> m2, ghost-car -> m0, transits -> m10 ...);
  #/lesson/<id> still shows the long form for the 14 lessons; Rules under Reference has 43 rule cards and a link from Reference.
  Rule-card ids (ice-calls, stop-count, restart-steps ...) and unknown ids land on #/school showing whatever module was last open.
- Desk width (1366 x 768, mouse): the same player in an 820 px column, two columns on concept and mini-sim pages, ArrowRight advances; the mini-sim sits at the bottom with ~350 px empty above it and the book row's bottom edge clipped (pt16-21).
- Landscape (844 x 390): usable but pages scroll inside; the scorecard answers start below the fold (pt16-23).
- Continue course: after Start and three pages, the × goes to Home, whose primary button reads "Continue course: Module 0, page 4" and returns there; reopening the bare URL as a returning visitor shows Home with that button. After Module 6 the button disappears although Modules 7 to 12 remain (B14).
- Try-its use only taught controls? m0 no (red STOP), m1 greys a taught answer, m2 no (speed change without its bar), m3 no (lead arithmetic), m4 yes, m5 yes (but the pointer is wrong), m6 yes; m7 to m12 are unguided so the question does not arise.

## Rubric (0-5)
| | Score | Why |
|---|---|---|
| Clarity for a newcomer | 3 | M0 and M1 are clear; M2 to M6 leak untaught terms, pointers contradict cards, and m4 gives three different "sit" numbers for the same speeds |
| Interaction density | 4 | something to do every one or two pages; but m0 p4 is 31 to 44 s of watching, the two hold widgets are identical, m1's try-it repeats one card three times |
| Fun | 3 | the slider, the stop count and the launch are satisfying; the silent restart loop and the m3 arithmetic are not |
| I know what to do next | 3 | the primary button is always obvious and Continue course works; but the instruction line on timed cards is often wrong, greyed buttons look disabled, and Home forgets the course after m6 |
| Reference access | 3 | chips are tidy and short; no video can be opened, citations show repo paths, and verdicts paste citations inline |

**Would I send this to a friend who has never heard of TSD?** Modules 0 and 1, yes, today; the whole course, not yet:
by Module 2 my friend would tap CALL, watch the card snap back with no explanation, and give up.

## Bugs
| # | Sev | Steps | Expected | Actual | File hint |
|---|---|---|---|---|---|
| B1 | HIGH | Phone (touch), #/school/m2/4, tap CALL 30 at ~3 s (or #/school/m5/4, tap when "Mark!" shows; any timed GO/CALL/LAUNCH mini-sim, wrong tap) | "Not quite: CALL 3.4 s early", the rule, Try again | Verdict is dismissed in the same tap: the compatibility click lands on "Try again", which replaced the button under the finger; the card restarts (mini().attempt 2), no message ever shown. With a mouse it works. (pt16-09-early.ts) | src/ui/school2/minisim.ts verdict() arms Try again synchronously; src/ui/mobile/tapwatch.ts uses pointerdown + preventDefault, which does not cancel the click on touch |
| B2 | HIGH | #/school/m5/4, read the pointer "Tap CALL at the Mark.", tap when Mark! shows | the instruction leads to the right tap | the right tap is 2.5 s before Mark (truth 7.3 s, Mark 9.8 s); same pointer on m5 p6, m12 p6 and every m5 try-it speed card | src/ui/school2/sources.ts CONTROL_LABEL.callAtMark ("tap as Dad says Mark"), engine POINTER_OF_CONTROL, content m5 p4 why "act on Mark" |
| B3 | HIGH | Finish m0-m1, Module 2 try-it, a SPEED CHANGE card | a way to time the call | guided mode hides the distance bar (sign-bar g-hide), greys CALL, no TOD; only a black box saying CALL 50 (pt16-38) | src/ui/mobile/guided.ts; content m2 tryIt kinds include speedChange before distanceBar/callAtMark (m5) |
| B4 | HIGH | Finish m0-m6, Home, Play daily run 1 | only taught kinds (SCH-009) | 12 cards incl. TA claim, lost, exact transit OUT, make-up plan (pt16-29) | daily-set plan in the engine/phone session: filter kinds by course progress until m7-m10 are done |
| B5 | MED | Module 1 try-it, a "What speed" card | taught answer buttons tappable-looking | answers greyed (callSpeed belongs to m2) though m1 teaches "what speed" (pt16-36) | guided.ts control map for preread speed variants; content m1 controls |
| B6 | MED | #/school/m3/2, m3/6, Module 3 try-it | start/stop/lap practice | multiple choice "lead 2.5 s ... Call 45 at?" (lead taught m5); pointer "Tap START and STOP" with no watch buttons (pt16-25, pt16-39) | content/course.ts m3 sims 301/302 and tryIt kinds ['watch']; needs a pure watch variant |
| B7 | MED | #/school/m0/4, watch the car, tap when it reaches the end | a fair way to judge the leg | no sign and no ghost drawn; car 1 mph fast; strip 1.5 x leg; result 13 points late with no hint how to know (pt16-04) | src/ui/school2/widgets.ts mountWhereCheckpoint (draw the green sign and the ghost, or ask for "your car at the sign") |
| B8 | MED | m4 p2 then p3 | one number for 30 in / 40 out | p2 and the example say 8.6 / 9 (handbook Packard), the mini-sim right after says "sit 5.6 s"; the figure says 35->35 sit 9.0, m12 p4 says 35->35 sit 6.0; nothing explains "your car has its own chart" (pt16-27) | content/course.ts m4 p2/p4, src/ui/school2/figures.ts |
| B9 | MED | #/school/m3/4, tap LAP three times | LAP stays put | LAP moves down ~48 px after each lap (the list is inserted above it); list numbers clipped at the left ("." for "1.") (pt16-14) | widgets.ts mountTapLap, .s2 lap list styles |
| B10 | MED | any wrong mini-sim answer; any run/try-it verdict | references as chips | citations inline: "(HB Appendix D (Column A))", "(REG V.A.1.a, V.A.1.b; Rally School Part 1 [04:08], [02:37])"; speed-change rule cites "timed hold: 2026 Training Session [120:16]" | content/rules.ts rule strings / cards.ts verdictParts |
| B11 | MED | mini-sims whose control does not match the card | pointer describes the card | "Tap START and STOP" (m3 p2, m7 p6, lost card), "Tap LAP at the marker" (m3 p6), "Look at the book row" (m7 p4 lost card, no row), "Tap the speed you would call" (m11 p2/p4 checkpoint), "Use the TA card" (m9 p2 hazard), "Use the hold card" (m10, no hold card), "Read the time of day strip" (m6 p2) | content/course.ts sim(..., control), CONTROL_LABEL |
| B12 | LOW | brand-new visitor, page 1 | <= 70 words | 91 words (box 30 + concept) | content FIRST_VISIT or m0 p1 |
| B13 | LOW | open the bare URL, close without tapping, open again | still the School welcome | first visit is consumed by opening; second open shows Home with the install banner | src/ui/main.ts first-visit check |
| B14 | LOW | finish m6, Home | Continue course: Module 7 | no Continue button; only the School link | src/ui/mobile/home.ts |
| B15 | LOW | Module 1 try-it 1 of 5 right | a nudge to try again | "Module 1 done", 0 stars, primary "Module 2" (pt16-37) | tryit.ts recap |
| B16 | LOW | Module 0 try-it | green checkpoints only | 3 of 5 cards are red STOP boards ("check in", taught m11) | content m0 tryIt / checkpoint variants |
| B17 | LOW | Module 1 try-it | variety | the same card (line 2, 35 MPH, Right) 3 of 5 times; every which-way answer is Right | tryItPlan seeds |
| B18 | LOW | m6 p2 | why line about the card | "Base plus position in minutes" on a transit-OUT restart; "Transit OUT", "CDT" untaught | content m6 sim 601 |
| B19 | LOW | m1 p1, p2 | readable figure | "Comes quick" overflows the D box, labels "symbols"/"speed" touch; p2 ("The little map") repeats the five-column figure instead of a CAMEO (pt16-30) | figures.ts |
| B20 | LOW | desk width, any mini-sim | card centred | bottom-anchored with ~350 px empty above; book row bottom border clipped (pt16-21) | styles .s2-minisim desk |
| B21 | LOW | landscape 844 x 390 | one screen | pages scroll inside; scorecard options below the fold | styles |
| B22 | LOW | any chip | a source a friend can use | no video URL for any of 36 video chips; citations show repo paths | content/videos.ts, excerpts.ts citation |
| B23 | LOW | #/school/ice-calls (a rule-card id) | Rules page or a module | #/school with the last-open module | screens/school.ts redirect fallback |
| B24 | LOW | m0 p4 result | same time as the clock | "You said 44.4 s" while the clock showed 44.3 s | widgets.ts |

## Confusing pages
| Module / page | What confused |
|---|---|
| m0 p4 | "the ghost reached the sign": neither is drawn |
| m0 try-it | red STOP boards and "check in" |
| m1 p3-p7 | "PRE-READ" label and "call" never explained |
| m1 try-it | greyed answers |
| m2 p4 | "Dad's Mark", the distance bar, CDT clock, "1.4 s before"; early tap restarts silently |
| m2 try-it | speed change with nothing to time it by |
| m3 p2, p6, try-it | lead arithmetic presented as stopwatch practice |
| m4 p3 | 5.6 s right after reading 8.6 s for the same speeds |
| m5 p4 | "Tap CALL at the Mark" while the card wants the call before the Mark |
| m6 p2 | transit OUT and a why line about base + position |
| m12 p5 | "Beat [the Boss] and Desk mode opens" but Desk opened when I finished Module 12 without playing the Boss |

## Factual slips (against content/excerpts.ts and docs/research)
- Checked and right: m0 "nine days, about 150 teams, a third new, Route 66 Springfield to Pasadena" (REG I.A.3, video 2026 04:44);
  1 point per second, caps 2 min late / 5 min early, missed CP 3 min, > 30 min late = missed (REG V.E.1/2); 30 s for
  5 mph or slower in sight of green (V.E.3); age factor 1939 = 0.845, 1954+ = 1.000 (V.D); Packard 30->40 = 8.6, 40->40 = 8.1,
  50->30 = 8.8 (HB p.8 table); split at 32.5 (HB p.12); 10 % for ten times the seconds, 6 s a minute, 20 % = 12 s a minute (HB p.10, video);
  base 9:05 + position 27 = 9:32, launch 9:31:57 (video Start); exact transit IN + interval, lunch 3:07 - 45 min = 2:22 (HB App. D);
  TA in 10 s steps, 3m47s -> make up 7, claim 3m40 (REG V.H.3, video Delay); claims within 15 minutes (video 2026 110:28).
- Slips / tensions: (1) m4 handbook 8.6 vs simulator 5.6 for the same speeds, unexplained (B8). (2) m12 p5 says beating the
  Boss opens Desk; the app opens Desk on finishing Module 12. (3) m9 p1 lists "a red light" as not qualifying: not in the
  REG V.H.1 excerpt (it is a simulator rule) and not marked as one. (4) The speed-change verdict cites a timed-hold video
  ("timed hold: 2026 Training Session [120:16]") for the split-the-sign rule. (5) m5 p4 why line "act on Mark" contradicts the lead it teaches.

## Three best pages
1. **m0 p2 "Hold 35"** (pt16-02): you touch something 30 seconds after arriving and see "0.9 s late ... on time ... 0.3 s early" move as you drag. The whole idea of TSD in one gesture.
2. **m4 p6 "Tap GO when the stop is over"**: a real stopwatch, a count you can feel, instant "+0.4 s Right". Best mini-sim in the course.
3. **m11 p7 the scorecard** (pt16-33): five legs, a raw total, the age factor, one tap; the arithmetic is visible and right.
(Honourable mention: m1 p3, the first which-way row: clear, one tap, good why line.)

## Three worst pages
1. **m5 p4 "Tap CALL at the Mark"**: the instruction is wrong and, on a phone, a wrong tap restarts the card with no explanation.
2. **m3 p2 "Tap START and STOP on the stopwatch"**: no stopwatch buttons; an arithmetic quiz on a term taught two modules later.
3. **m0 p4 "Where was the checkpoint?"**: no sign, no ghost, a strip longer than the leg; the newcomer's best effort scores 13 points late.

## Top-10 fixes (ranked)
1. **Touch ghost click on timed mini-sims** (B1): in src/ui/school2/minisim.ts verdict(), render "Try again" disabled for ~400 ms or bind it on pointerup after a fresh pointerdown; or call preventDefault on touchend in src/ui/mobile/tapwatch.ts. Add an e2e with `hasTouch` + `touchscreen.tap` on an early CALL.
2. **Fix the callAtMark pointer and m5 p4** (B2, B11): "Tap CALL when the bar reaches the CALL tick, a little before Mark" (src/ui/school2/sources.ts CONTROL_LABEL, engine POINTER_OF_CONTROL, content m5 p4 why). Then audit every minisim's `control` against its card kind (content/course.ts) so no pointer names a button that is not there.
3. **First unguided run uses taught kinds only** (B4): until m7-m10 are done, the daily set and skills runs draw from the m0-m6 kinds (preread, turn, speedChange, pause, watch, timedStart, restart, clock, checkpoint-green); or make the "free runs open" unlock come after m10.
4. **m2 try-it without speed changes, m1 try-it without greyed answers** (B3, B5): drop 'speedChange' from m2 tryIt.kinds (keep turn + pause) or show the bar; map the preread speed variant to 'book' in src/ui/mobile/guided.ts.
5. **Module 3 needs a real stopwatch card** (B6): a watch variant with START/STOP/LAP taps against markers (the tapLap widget already does it), and move the "lead ... Call at?" cards to m5.
6. **Redesign whereCheckpoint** (B7): draw the green sign at the leg end and the ghost; ask "tap as your car passes the sign" and show the ghost's time vs yours, or give the 0.3 mi / 35 mph = 31 s hint before the run (src/ui/school2/widgets.ts).
7. **Reconcile m4 numbers** (B8): one line "your car is not the handbook's Packard; the app uses its own chart", or use the simulator car in p2/p4 and the figure (content/course.ts m4, figures.ts).
8. **No inline citations in verdicts** (B10): strip the parenthetical sources from rule lines in the run and mini-sim verdicts and offer them as one chip (content/rules.ts, src/ui/mobile/cards.ts verdictParts); fix the speed-change source.
9. **tapLap polish** (B9): keep LAP fixed (list below it or capped at the last two), fix the clipped list numbers, compare the tap with the car's nose.
10. **Newcomer polish** (B12-B18): first page under 70 words (trim FIRST_VISIT or the concept), green-only checkpoints in the m0 try-it, Home keeps "Continue course" until m12, a "try again" nudge on 0-star recaps, variety in the m1 try-it, m6 p2 why line, explain CDT once (m6), video URLs or hide the video chips' promise, citations without repo paths.

## Scripts
- `pt16-common.ts` (persistent fresh profile, touch tap/drag helpers), `pt16-01-first-open.ts`, `pt16-02-walk.ts` (naive walker),
  `pt16-03-hold.ts` (slider by touch drag), `pt16-04-where.ts`, `pt16-05-tap.ts` (tap by text), `pt16-06-run.ts` (run/try-it player:
  first / oracle / mixed / early / naive policies), `pt16-07-timed.ts`, `pt16-08-probe.ts`, `pt16-09-early.ts` (B1 repro: click vs touch),
  `pt16-10-auto.ts` (module walker), `pt16-11/12-taplap*.ts`, `pt16-13-mark.ts` (B2 repro), `pt16-14-home.ts`, `pt16-15-audit.ts`
  (every page: words, scroll, chips, sheets; run with `390 844 1` and `360 780 0`), `pt16-16-sheet.ts`, `pt16-17-routes.ts`,
  `pt16-18-continue.ts`, `pt16-19-desk-landscape.ts`, `pt16-20-verdict-fit.ts`, `pt16-21-shots.ts`, `pt16-22-models.ts` (widget rule checks).
  Run from the repo root with `npx tsx playtest-scripts/<file>` against `npx vite preview --port 4188`. Some walkers write extra
  screenshots when re-run; the 35 kept are the numbered pt16-NN-*.png.

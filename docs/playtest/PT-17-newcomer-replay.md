# PT-17: Rally School replay by a newcomer, after fix sprint PT-16 (2026-11-22)

Tester: independent agent playing someone who has never heard of TSD rallying and got the link from a friend.
Build: `npm run build` of HEAD 35a019a (fix sprint PT-16 + Josh's notes SCH-021..027), `npx vite preview --port 4189`.
Chromium at /opt/pw-browsers/chromium, 390 x 844 (360 x 780 for geometry), `hasTouch` + `isMobile`, real touch taps
(`page.touchscreen.tap`, CDP touch drags), one fresh persistent profile. Scripts: `playtest-scripts/pt17-*.ts`.
Screenshots: `docs/playtest/screenshots/pt17-*.png`. Nothing under src/, tests/, content/ or public/ edited; nothing committed.


## Verdict in one paragraph
The fix sprint landed almost everything PT-16 asked for: a wrong tap on a timed card now stays on screen until you tap Try again,
pointers say what is graded, Module 3 has a real stopwatch card, the first unguided run uses only taught kinds, citations are chips,
nobody is called Dad, Module 1 has trap cases that make you think, and the GO card gives the sit time. But one new defect undoes the
Start button: **the time you spend reading a timed card before tapping Start is still on the clock.** The face is frozen, the
watch secretly is not; cards you time by the bar (CALL, START at a sign, START on Mark) grade you late by exactly your reading time,
and the watch jumps forward by it when you tap Start. Add Module 4 quoting two different sit times for the same speeds on consecutive
pages, a Module 1 trap case whose wrong-answer box prints the trap's own number, and try-it stars that give three stars for 0 of 5,
and the course is still not one to send whole. Rubric 3.4 / 5 (was 3.2).

## Timings (pass 1, modelled as in PT-16: 200 wpm, 1.5 s per navigation tap, 3 s per choice, real widget/timed durations)
| Moment | PT-17 | PT-16 | Notes |
|---|---|---|---|
| Page 1 painted | 0.15 s | 0.16 s | bare URL -> #/school, Module 0 page 1, Start |
| First interaction (Start) | ~21 s | ~30 s | 68 words on the page (81 on screen with header and chips) |
| First mini-sim in hand (Hold 35) | ~22 s | ~32 s | ticking before you touch it |
| First decision-card mini-sim (m1 p3) | ~5.2 min | ~5 min | |
| Module 0 done (incl. 5-card try-it) | ~4.5 min | ~4.4 min | +Three parties page, second Hold |
| Module 1 done (incl. try-it, one miss per sim) | ~6.3 min | ~3.5 min | 7 trap rounds added (~715 new words read) |
| **Modules 0 + 1** | **~10.8 min** | ~7.9 min | over the 10 min target; ~9.4 min for a 250 wpm reader |
| Modules 2-6 reading + play (excl. try-its) | ~2.3 / 2.6 / 2.6 / 3.0 / 3.0 min | 2.0 / 2.0 / 2.6 / 2.4 / 2.8 | |
| Try-its m2-m6 (wall) | 28 / 91 / 47 / 69 / 54 s | | "a one-minute run" is 1.5 min in m3 |

Words per page (390 x 844 audit, page text only): concept 27-79 (only m4 p1 over 70, 79 words), example 26-41, mini-sim 31-56,
widget 19-48, check 15-31. Module totals 251 (m3) to 356 (m5). Interactions in M0 + M1: 8 interaction pages, 15 graded
decisions (Module 1's two multi-case pages hold 7), 2 try-its, about 60 taps.

## SCH-009 targets, re-measured
| Target | PT-17 | Pass? (PT-16) |
|---|---|---|
| First mini-sim within 90 s | Hold 35 at ~22 s; first decision card ~5.2 min | Yes for the widget (same) |
| Modules 0 + 1 under 10 min | ~10.8 min modelled | **No** (was yes, 7.9) |
| >= 8 interactions in M0 + M1 | 8 pages, 15 decisions, 2 try-its | Yes (yes) |
| No page over one screen | 0 of 99 pages scroll at 390 x 844 or 360 x 780, before or after answering; landscape shows a "Turn your phone upright" card | Yes (yes) |
| No page over 70 words | m4 p1 79 words; first-visit page now 68 | **No** (no) |
| At most 2 chips per page | 78 reference chips on 99 pages, max 2 (timed cards also carry a "CDT?" chip in the action area) | Yes (yes) |
| No reference text inline | clean on pages and verdicts (sources are chips) | Yes (no) |
| Controls in the first unguided run taught before | all 12 cards are m0-m6 kinds; only the word "chrono" untaught | Yes (no) |
| Rubric each >= 4 | 3 / 4 / 3 / 4 / 3 | **No** (no) |

## Pass 1 log (naive, course.ts not read)
- Bare URL, fresh profile: first paint 148 ms, lands on #/school, Module 0 page 1, 68 words in the page, 81 on screen
  (was 91). One primary button: Start. Page dots are tappable buttons.
- m0 p2 Hold 35: the drift readout runs from page show (0.1 s late at show, 1.0 s late 3 s later) with the car at 25 mph,
  before I have touched anything; there is no Start (pt17-03). Dragging to 46 then 35 by touch: "Held it: well done." after
  ~11 s of holding with no progress indicator.
- m0 p4 Where is the checkpoint: green sign and ghost are now drawn, strip = leg (B7 fixed). But the leg clock starts at
  page show (0.0 s, 1.0 s a second later), no Start button: a scored timed challenge that ticks while you read the
  instruction (SCH-022). Tapping as my car's nose reached the sign: "The ghost reached the sign at 20.6 s. You tapped at
  20.4 s, 0.2 s before it. The crew counts whole seconds: 1 point." 0.2 s early costing a point is puzzling without
  more words; no retry (button turns into a dimmed "Done").
- m0 p5 "The Great Race" (51 words): three small stills (lapboard slide, rally clock, STOP board) with captions and a credit
  line "Stills from Great Race rally school videos" (pt17-08). They are thumbnails ~110 px wide in the middle of page 5, not an
  opening vibe page; no video (no URL). m0 p6 "Three parties" (55 words): organizers via the Course Instructions, navigator
  (co-driver), driver; "In this game, you are the navigator." Clear; no picture, half the screen empty (pt17-09).
- m0 p7 a second Hold widget (Hold 40), same mechanics, also ticking before any Start (car at 30 mph on show).
- m0 p8 check: "You pass the green sign 4 seconds after the ghost. What do you score?" 4 / 0 / 8 / 40 points. A real test of the
  page before (SCH-023). Wrong: "Not quite: 4 points." (no why). Right: "Correct."
- m0 try-it: five checkpoint cards, all green (B16 fixed) but all the same question with a different distance; option cards print
  a meaningless "+0.1 s" in the verdict; the "Stop and check in" option is a concept the module never taught. Recap:
  "Module 0 done ... **5 of 5 right** · 0.8 s off" ("right" as the score word, SCH-021).
- Returning to the bare URL (same profile) shows Home: install banner, "Continue course: Module 1, page 1", the daily set and
  five skill runs with no hint that they are not for a beginner yet. Desk mode is hidden.
- m1 p1/p2: figure now draws a CAMEO in Column A (B19 half fixed), but "Comes quick" still overflows the D box and the
  "symbols"/"speed" labels touch (pt17-14). p2 "The little map" is still the same five-column strip, not a junction drawing.
- m1 p3 which-way (pointer "Look at the book row, then tap your answer."): wrong tap Left -> red box "Not quite: the bold arrow
  **+65.5 s**", rule mentions "CAMEO" (untaught word), chip HB App. D, Try again disabled for 0.4 s then works on touch (pt17-16).
  A seconds figure on a which-way question is baffling. Right -> "Correct 0.0 s".
- m1 p6 sign cases (3 rounds) and p7 (4 rounds), SCH-025: normal case (sign and Column C agree), then sign says 40 / Column C 30,
  then CURVE sign with blank C; then partial quote "Welcome to", two SPEED LIMIT signs, overhead sign, bracketed old speed.
  Every correct answer starts "Trap: ..." and names the trap. **But every wrong answer prints the generic rule "Column C prints
  the speed to drive from that line on, one item per line: 40 MPH."** On the case where the sign says 40 and Column C says 30,
  I picked 40 and the red box told me "40 MPH" (pt17-20). The current speed in the blank-C case ("holding 30") is hidden under
  "details"; you learn it only from the option label "Hold 30". "Two SPEED LIMIT signs ... what speed at that sign?" gives itself away.
- m1 p8 check "Column C is empty on this line. What speed do you drive?" repeats the curve case (fine).
- m1 try-it: 5 pre-read cards, mixed answers (Right, Bear left, Right, Left, 25 mph; B17 fixed), none greyed (B5 fixed). Three
  of the five rows show a STOP / 0 MPH / 0m15s pause row, untaught until Module 4. Every card's pointer begins "New:" even the
  fifth. The speed card's verdict again says "40 MPH" on a 25 MPH row. Recap "5 of 5 right".
- m2 p1 ICE (52 words), p2 turn mini-sim ("1st paved road", left CAMEO; Correct + why), p3 "He says it back" introduces the
  read-back, "Mark" and the bar (Mark and the bar are now taught before they are used; B2/B3 terms fixed).
- m2 p4 speed change: the card now waits under a big **Start** with the instructions visible; the CDT clock, watch and bar are frozen
  (pt17-26). The pointer is right: "Tap CALL when the bar reaches the CALL tick, just before the driver's Mark." and a CALL tick is
  drawn on the bar. Wrong tap first (early) by touch: the red verdict stays, Try again needs its own tap (B1 fixed).
- **But the time spent reading before Start is still on the clock.** The watch face and the time-of-day strip are frozen under Start,
  yet the tap-watch's clock keeps running: 60 ms after I tapped Start on m2/6 (having read for 4 s) the watch jumped from 0:00.00 to
  0:04.19 and the CDT clock from 9:20:06 to 9:20:10 (`pt17-10-follow-watch.ts`). The sign bar, by contrast, does start at Start. So:
  - cards cued by the **bar** (speed change CALL at the tick, the stopwatch card's START at the first sign, timed hold START on Mark)
    grade you late by exactly your reading time: read 0.3 s then tap as the fill reaches the CALL tick -> "Correct +0.5 s"; read 3 s ->
    "CALL 3.3 s late"; read 6 s -> "CALL 6.3 s late" (`pt17-07-bar.ts`). On my own m2/4 retry I tapped on the tick and was told
    "CALL 1.7 s late". Same on m3/2 ("START 4.3 s late"), m5/4, m5/7.
  - cards cued by the **watch or the clock** (pause GO, restart LAUNCH) can be passed if you follow the digits, but the watch leaps
    forward by your reading time when you tap Start, so the timer did run before Start (SCH-022 in substance fails) and the wait you
    are practising is shortened by however long you read.
  - run cards (try-its, daily) behave the same: m4 try-it, five pause cards, tapping by the card clock after 4 s of reading -> each
    "GO 4.3 s late" (`pt17-09-run-readdelay.ts`); in the m2 try-it the watch read 0:01.26 150 ms after Start.
  Cause (file hint): src/ui/mobile/tapwatch.ts `begin()` sets `t0 = now()` before calling `o.onStart()`, and the `now` it is given
  (`cardNow` in src/ui/school2/minisim.ts and src/ui/mobile/run.ts) still returns the old `shownAt` at that moment; onStart then moves
  `shownAt` to the Start time, so watch elapsed = now - (page show time). The SCH-022 e2e checks only that the frozen face does not
  change before Start and taps Start at once, so it cannot see this. This is the new top bug: a newcomer who reads the card and then
  taps Start (exactly what the page invites) fails every bar-cued timed card while doing the right thing.
- m2 p6 GO card: "Stopped at line 2. Pause 15 s, in 30, out 30: sit 8.6 s on the watch, then tap GO." The sit time is on the card
  (SCH-026). The wrong verdict's rule still says "dwell = pause minus Dec(in) minus Acc(out)" (untaught jargon in Module 2; it
  was listed as not done in the LOG). The watch digits vanish behind the verdict, so you cannot see what you tapped.
- m2 try-it: turn, three pauses, pre-read; nothing hidden or greyed (B3 fixed). Recap "Module 2 done ★★★ 2 of 5 right".
- **Stars do not follow the score**: m3 try-it "★★★ 0 of 5 right · 6.5 s off"; m4 try-it "★★★ 0 of 5 right · 6.8 s off"; m2 "★★★ 2 of 5".
  (Those misses came from the reading-time leak at about 1 s of reading, which is enough on the 1 s tolerance cards.)
- m3: a real stopwatch card (START at the water tower, LAP at the grain elevator, "your lap reads 0m14.0s"), concept on laps,
  tapLap widget (LAP stays put, list inside; B9 fixed), interval/cumulative example (16:05 - 7:23 = 8:42, correct), check
  (5:00 - 2:10 = 2:50). The tapLap widget's clock ticks from page show with no Start. Late LAP by touch: verdict stays, Try again works.
- **m4 numbers disagree again (B8 regressed in a new form):** p1 figure "This app's car: 30 -> 40, sit 7.1 s" and p2 worked example
  "Printed pause 15; in 30, out 40, the chart loss is 7.9. So sit 7.1 s" -- then p3, the very next page, "Pause 15 s, in 30, out 40:
  sit 5.6 s on the watch" with a chart cell "30 -> 40 sit 5.6 s" (pt17-31, pt17-32); the m2 try-it also said 5.6 for 30/40. p1 is 79 words.
  The worked example now comes before the first pause mini-sim (SCH-026 structure met), but its number is not the app's number.
- m5: split the sign (35 -> 30 cross at 32.5), CALL mini-sim, lead concept ("like 1.4 s. **the** driver's Mark is still the sign"
  -- a lower-case sentence start left by the Dad -> driver sweep), CALL at the tick (B2 pointer fixed: "Tap CALL half a ramp before the
  Mark, when the bar reaches the tick."), then p5 asks "You lapped 1m07.0s at the sign ... 30 for 0m18s, then 25; lead 1.0 s. Call 25
  at?" one page **before** p6 teaches timed holds (the arithmetic lap + hold - lead is only shown in the why line afterwards).
  p7 timed start: pointer "about 2 s before the hold ends", card "2.5 s before". Check 40 -> 30 pass at 35 (correct).
- m6: base + position (9:05 + 27 = 9:32), launch early (9:31:57), restart mini-sims (TOD clock, LAUNCH), loose minute hand,
  clock question, "Wait your turn" concept, whose mini-sim (p8) is a plain restart that does not test the queue at all.
  Try-it: 2 clock + 3 restart. Recap: "Free runs are open."
- Home after m6: "Continue course: Module 7, page 1" (B14 fixed), daily set, skills.
- **First unguided run (daily run 1, 12 cards):** stopwatch lead (option), restart, turn, pause, pre-read, speed change, pause,
  restart, timed start, stopwatch lead, timed start, clock; rule cards: timed changes count from departure, base + position, follow the
  bold CAMEO arrow. Every kind comes from Modules 0-6 (B4 fixed). Controls: option buttons, Start, GO, LAUNCH, CALL, START + CALL, START
  + LAP, "details", "source" chip, "Got it", Next card. All taught; no High. Only word not taught: "Watch, chrono" (card 12 and m6 p6;
  the course says "stopwatch" and "time-of-day mode", never "chrono").

## Pass 2 (critical): course.ts read, Modules 7-12, references, widgets, routes
- **Modules 7-12** play cleanly; all pointers match their cards; arithmetic checked and correct: m7 47 s back -> ~94 lost; m8 4 s late at
  40 -> 44 for 40 s, 10 % = 6 s/min, 20 % = 12 s/min, 8 s at 40 -> 48 for 40 s, check 6 s at 30 -> 33 for 60 s, mini-sims 5 s / 110 s
  road -> +10 % for 50 s, 12 s at 35 / 125 s -> +10 % for 120 s; m9 3m47 -> claim 3m40, 56 s - 13 = 43 -> claim 40 s, 34 s - 10 = 24 ->
  claim 20 s; m10 IN 9:15:23 + 2m -> 9:17:23, 10:17:29 + 1m -> 10:18:29, 2:41:20 + 20 m -> 3:01:20, restart 2:55 + 12 = 3:07 -> lunch
  2:22, check 10:14:30 + 25 m -> 10:39:30; m11 caps (3 min late -> 120 points), scorecard 11+0+8+8+5 = 32 x 0.845 = 27.04 (every leg
  difference checked); m12 Desk text now matches the app ("opens when you finish this module").
- Order slips: m5 p5 asks "lap 1m07.0s + hold 0m18s - lead 1.0 s = ?" one page before **m5 p6** teaches timed holds;
  m10 p2 asks an exact-transit OUT time one page before p3 teaches IN + interval. m7 p4 and p6 (lost) have the same answer
  ("Turn around, time it"); p6 ("rejoins, a detour about 45 s longer") is not deducible from the pages. m9 p7's why line is about leg
  numbers while the question is the claim amount. m6 p8 "Wait your turn" is a plain restart: nothing about the car ahead is tested.
- **Reference chips:** 78 chips on 99 pages, every one opens a bottom sheet (20-78 words, title, citation), closes with Close, never
  pasted into the page (`pt17-13-audit.ts`, pt17-35). Citations are now plain ("Rookie Handbook, 'Preparing for the Great Race' (Croker,
  rev. Sept 2015), p.15"), no repo paths. None of the 36 video chips can open a video (no URLs yet). Verdict chips open the same sheets.
  Off-topic or loose: m11 p4 (crawling near green) cites REG V.A.1 in the verdict, not V.E.3.
- **Widgets:** holdSpeed and whereCheckpoint read correct engine numbers (0.2 mi at 35 mph = 20.6 s ghost, shown; "You tapped at 20.4 s"
  matches the clock, B24 fixed). tapLap's split question is right. readScorecard right. All four widgets start their clocks on page show.
- **Module 1 trap cases (SCH-025):** normal case first, then six traps (posted limit vs Column C, blank C at a curve, partial quote,
  twin limit signs, overhead sign, bracketed old speed). Each correct answer names the trap ("Trap: a posted limit is not your speed").
  Deducible from m1 p5 for limit, blank and bracket; the partial quote and overhead rules are not taught before they are asked (fine as
  "make you think", and the why line teaches them). The twin-sign case gives itself away ("the book quotes SPEED LIMIT 45 ... at that
  sign?"). The wrong-answer box never names the trap and always says "... one item per line: 40 MPH" (content/rules.ts:277, first
  sentence of the generic Column C rule), including on the case where the sign says 40 and Column C says 30.
- **Module 2 GO card / Module 4 arithmetic (SCH-026):** m2 p6 gives the sit time ("sit 8.6 s on the watch"); m4 p1 + p2 teach "sit =
  pause minus loss" with a worked example before the first pause mini-sim. But the worked example's number for 30 in / 40 out (7.1 s,
  STOP_EXAMPLE in content/course.ts) is not what the mini-sim on the next page uses (5.6 s), and losses for equal speeds wander between
  cards: 40/40 sit 6.1 of 15 (loss 8.9) on m4 p2 vs sit 9.6 of 20 (loss 10.4) in the m4 try-it; 30/30 loss 6.4 on m2 p6 and m12 p2.
- **"right" as praise (SCH-021):** verdict heads, checks and widgets now say "Correct" / "Not quite" / "Held it: well done." But every
  try-it and run recap reads "**5 of 5 right**" (src/ui/school2/tryit.ts:47, src/ui/mobile/recap.ts:16). Non-praise uses remain in
  "You can now sit the right wait" (m4) and "pass a checkpoint the right way" (m11), and Desk scorecard "used the right instrument".
- **"Dad" (SCH-027):** none in src/, content/, public/ or on any screen visited; Home has "Driver's card" and "Driver's voice". One
  sweep artefact: m5 p3 "... like 1.4 s. the driver's Mark is still the sign itself." (lower-case sentence start).
- **Vibe strip and three parties (SCH-024):** m0 p5 shows three credited stills (lapboard slide, rally clock, STOP board), ~110 px wide,
  not tappable to enlarge, on page 5 rather than as an opener; the slide thumbnail is unreadable at that size. m0 p6 "Three parties" is
  clear and short; its 'two-seats' figure (listed in FIGURES) is not drawn, leaving half the screen empty.
- **Desk width** (1366 x 768, mouse): 786 px column, mini-sim card at the top of the column (B20 fixed, pt17-36), ArrowRight advances.
- **Landscape** (844 x 390): School pages show "Turn your phone upright: the School is made for portrait." (B21 fixed); Home scrolls.
- **Continue course:** × after page 3 -> Home "Continue course: Module 0, page 4" -> back to m0/4; after Module 6 Home shows
  "Continue course: Module 7, page 1" (B14 fixed). But opening the bare URL and closing without tapping still consumes the first visit:
  the second open lands on Home with the install banner (B13), where "Play daily run 1 of 3" serves a brand-new visitor a speed change
  with "lead = half the ramp", a TA claim, a transit OUT and clock cards (`pt17-38`, the "Start on time" skill opens on an exact-transit rule).
- Old ids: #/school/ice-calls and #/school/nonsense still land on #/school (B23).

## PT-16 bugs: status
| # | PT-16 sev | Status | Evidence |
|---|---|---|---|
| B1 touch restart | HIGH | FIXED | m2/4, m2/6, m3/2, m4/3, m5/2, m6/3 wrong taps by touch: verdict still there 1.5 s later, attempt unchanged, Try again disabled 0.4 s then needs its own tap (pt17-27, pt17-16) |
| B2 callAtMark pointer | HIGH | FIXED | "Tap CALL half a ramp before the Mark, when the bar reaches the tick." + CALL tick on the bar; tapping on the tick (after a quick Start) is Correct |
| B3 m2 try-it speed change | HIGH | FIXED | m2 try-it: turn, 3 pauses, pre-read; no hidden or greyed control |
| B4 untaught kinds in first run | HIGH | FIXED | daily run 1 after m6: 12 cards, all m0-m6 kinds (but see N6 for a visitor with no progress) |
| B5 greyed m1 answers | MED | FIXED | no .g-grey in the m1 try-it |
| B6 m3 no stopwatch | MED | FIXED | START at the first sign, LAP at the second, lap read-off |
| B7 whereCheckpoint | MED | FIXED | sign + ghost drawn, strip = leg, result explained (pt17-07); clock still runs without Start (N5) |
| B8 m4 numbers | MED | **REGRESSED** | 30/40: 7.1 s on p1/p2, 5.6 s on p3 (pt17-31, pt17-32) |
| B9 tapLap | MED | FIXED | LAP fixed, list inside |
| B10 inline citations | MED | FIXED | verdict rules carry no "(HB ...)" text; sources are chips |
| B11 pointer vs card | MED | FIXED | every pointer seen matches its card; nits: m3 try-it "Tap LAP as the car reaches the sign" while START comes first; m5 p7 "about 2 s" vs card "2.5 s" |
| B12 first page 91 words | LOW | FIXED | 68 words on the page |
| B13 first visit consumed | LOW | NOT FIXED | `pt17-15-continue.ts`: open 1 #/school, open 2 Home |
| B14 Continue after m6 | LOW | FIXED | "Continue course: Module 7, page 1" (pt17-33) |
| B15 0-star recap no nudge | LOW | **REGRESSED** | "★★★ 0 of 5 right" (m3, m4); primary is still the next module |
| B16 red boards in m0 try-it | LOW | FIXED | 5 green cards |
| B17 m1 try-it sameness | LOW | FIXED | Right, Bear left, Right, Left, 25 mph |
| B18 m6 p2 why line | LOW | FIXED | base + position card with a base + position why; CDT chip and m6 p1 explain CDT |
| B19 m1 figures | LOW | NOT FIXED (partly) | CAMEO now in column A; "Comes quick" still overflows D, labels touch; p2 still the five-column strip (pt17-14) |
| B20 desk mini-sim | LOW | FIXED | card at top (pt17-36) |
| B21 landscape | LOW | FIXED | rotate card |
| B22 chips' sources | LOW | NOT FIXED (partly) | repo paths gone; 0 of 36 video chips open a video |
| B23 rule-card ids | LOW | NOT FIXED | #/school/ice-calls -> #/school |
| B24 44.4 vs 44.3 | LOW | FIXED | "You tapped at 20.4 s" with the clock at 20.4 s |
Totals: 18 FIXED, 4 NOT FIXED (B13, B19, B22, B23), 2 REGRESSED (B8, B15).

## PT-16 top-10: status
| # | Item | Status |
|---|---|---|
| 1 | touch ghost click | FIXED |
| 2 | callAtMark pointer + pointer audit | FIXED (two nits) |
| 3 | first unguided run taught kinds only | FIXED (zero-progress Home runs still untaught, N6) |
| 4 | m2 try-it, m1 greys | FIXED |
| 5 | real stopwatch card in m3 | FIXED |
| 6 | whereCheckpoint redesign | FIXED (no Start, N5) |
| 7 | reconcile m4 numbers | **REGRESSED** (new contradiction) |
| 8 | no inline citations | FIXED |
| 9 | tapLap polish | FIXED |
| 10 | newcomer polish bundle | PARTIAL: first page, green-only m0 try-it, Continue until m12, m1 variety, m6 p2, CDT, repo paths done; 0-star nudge regressed; video URLs missing |
Totals: 8 FIXED, 1 PARTIAL, 1 REGRESSED.

## Josh's notes SCH-021..027
| Id | Note | Result | Evidence |
|---|---|---|---|
| SCH-021 | no "right" as praise | **FAIL** | verdicts say Correct; but every try-it / run recap says "5 of 5 right" |
| SCH-022 | Start before timers | **FAIL** | Start gates the face, not the clock: reading time is graded (bar cards) or added to the watch (watch/clock cards); Hold 35, Hold 40, Where is the checkpoint and tapLap tick from page show with no Start |
| SCH-023 | meaningful checks | PASS | m0 "4 seconds after the ghost -> 4 points"; every check has distinct options that test the page (m12's "lowest meter" is easy but fair) |
| SCH-024 | three parties + vibe strip | PASS (weak strip) | m0 p6 clear; p5 credited stills, small, on page 5, no video |
| SCH-025 | Module 1 trap cases | PASS (bug on the wrong path) | 1 normal + 6 traps, each named on success; wrong box prints "40 MPH" (N2) |
| SCH-026 | go time given before taught | PASS (numbers disagree) | m2 card gives 8.6 s; m4 worked example before the mini-sim, but 7.1 vs 5.6 |
| SCH-027 | "the driver" | PASS | no "Dad" anywhere; one lower-case "the driver's" |
Totals: 5 PASS, 2 FAIL.

## Rubric (0-5)
| | PT-17 | PT-16 | Why |
|---|---|---|---|
| Clarity for a newcomer | 3 | 3 | terms now arrive in order and pointers are right; but m4's two sit times, "Dec(in) minus Acc(out)" and "half a ramp" in Module 2 verdicts, "+65.5 s" and "CAMEO" on a which-way miss, "40 MPH" on the trap cases, and two pages that ask before they teach |
| Interaction density | 4 | 4 | something to do every page or two; Module 1's trap rounds are dense in a good way; m0 try-it is five copies of one question |
| Fun | 3 | 3 | the trap cases, the stopwatch card and the checkpoint widget are fun; being told "CALL 3.3 s late" after tapping on the tick, and ★★★ for 0 of 5, are not |
| I know what to do next | 4 | 3 | big Start, correct pointers, Try again that stays, Continue course to m12; minus Home offering untaught runs to a second-visit newcomer |
| Reference access | 3 | 3 | chips everywhere, verdict chips, clean citations; still no video can be opened |
Average 3.4 (PT-16 3.2).

**Would I send this to a friend who has never heard of TSD?** Modules 0 and 1 yes; the whole course not yet, because the first time my friend reads a timed card before tapping Start they will tap exactly when the bar says and be told they were late.

## New bugs
| # | Sev | Steps | Expected | Actual | File hint |
|---|---|---|---|---|---|
| N1 | HIGH | #/school/m2/4 (any timed mini-sim or run card), read the card ~3 s, tap Start, tap CALL as the fill reaches the CALL tick | Correct | "CALL 3.3 s late" (read 6 s: 6.3 s late; read 0.3 s: Correct +0.5 s). Watch/TOD digits jump forward by the reading time on Start (0:00.00 -> 0:04.19). Same on m2/6, m3/2, m4/3, m5/4, m5/7, m6/3 and run cards (m4 try-it) | src/ui/mobile/tapwatch.ts begin() sets t0 before o.onStart(); cardNow in src/ui/school2/minisim.ts:74 and src/ui/mobile/run.ts:166 still returns the old shownAt then. Call onStart first (or take t0 after it); add an e2e that waits 3 s before Start and taps on the oracle second |
| N2 | HIGH | #/school/m1/6, case 2 (sign SPEED LIMIT 40, Column C 30 MPH), tap 40 mph | the trap named, Column C's 30 quoted | "Not quite: the speed in Column C ... Column C prints the speed to drive from that line on, one item per line: 40 MPH." (pt17-20); the same "40 MPH" on every wrong case of m1 p6/p7 and on the m1 try-it speed card | content/rules.ts:277 example clause; give SCH-025 rounds their own wrong-answer line (content/course.ts rounds, src/ui/school2/minisim.ts verdict()) |
| N3 | MED | m4 p1-p3 | one number for 30 in / 40 out | 7.1 s (figure, worked example) then 5.6 s (mini-sim and chart cell); 40/40 loss 8.9 vs 10.4 across cards | content/course.ts STOP_EXAMPLE vs the pause scenario's car (src/core/decision runner / perf table); B8 |
| N4 | MED | finish a try-it with 0 of 5 | 0 stars, "Try again" first | "★★★ 0 of 5 right · 6.5 s off", primary "Module 4" | src/ui/school2/tryit.ts (stars), src/ui/mobile/recap.ts |
| N5 | MED | open #/school/m0/2, m0/4, m0/7, m3/4 | the clock waits for a Start | Hold drift, leg clock and lap clock run from page show (0.0 s, 1.0 s a second later) | src/ui/school2/widgets.ts mountHoldSpeed / mountWhereCheckpoint / mountTapLap |
| N6 | MED | fresh profile: open the bare URL, close, reopen (B13) -> Home -> "Play daily run 1 of 3" | taught kinds only, or a nudge to the course | speed change with "lead = half the ramp", TA claim, transit OUT; "Start on time" skill opens on an exact-transit rule (pt17-38) | src/ui/main.ts first-visit; daily/skill plan filter (the B4 filter applies only once the course is started) |
| N7 | MED | wrong answer on an option mini-sim (m1/3 Left; m1/6 40 mph) | a verdict about the choice | "+65.5 s", "−15.8 s", "+36.0 s" printed on which-way and speed questions; "+0.1 s" on checkpoint try-it cards | src/ui/mobile/cards.ts verdictParts: hide seconds for option kinds in the School |
| N8 | MED | m5 p5; m10 p2 | taught before asked | lap + hold - lead asked before "Timed holds" (p6); exact-transit OUT asked before "Exact transits" (p3) | content/course.ts page order |
| N9 | LOW | m2 p6 wrong GO; m2 p4 wrong CALL | Module 2 words | "dwell = pause minus Dec(in) minus Acc(out)"; "half a ramp" | content/rules.ts pause/speedChange rule text (known in LOG) |
| N10 | LOW | m5 p3 | sentence case | "like 1.4 s. the driver's Mark ..." | content/course.ts m5 'The lead' |
| N11 | LOW | m6 p8; m9 p7; m7 p6 | mini-sim tests its page | restart with no queue; claim amount with a leg-number why; "detour 45 s longer" answer not deducible | content/course.ts |
| N12 | LOW | m1 p3-p7, m1 try-it | taught words only | "PRE-READ" title never explained; blank-C case hides "holding 30" under details; try-it rows show STOP/0 MPH/0m15s pause rows (Module 4); every try-it pointer starts "New:" | src/ui/mobile/guided.ts pointer prefix; scenarios |
| N13 | LOW | m0 p4 tap at the sign | an understandable score | "0.2 s before it. The crew counts whole seconds: 1 point." No retry | widgets.ts whereCheckpoint result text |
| N14 | LOW | m0 p6, m1 p1/p2 | figure | 'two-seats' figure not drawn; 'cameo' figure is the five-column strip; "Comes quick" overflows | src/ui/school2/figures.ts |
| N15 | LOW | m6 p6, daily run card 12 | taught word | "Watch, chrono" | runner clock options |
| N16 | LOW | m10 p2 | readable row | odometer digits "0 0 0 3" under the hourglass, unexplained (pt17-34) | cards row render for transit |
| N17 | LOW | m3 try-it | about a minute | 91 s (five stopwatch cards) | content m3 tryIt cards |

## Confusing pages
| Page | What confused |
|---|---|
| m0 p2 / p7 | the car is already falling behind before I touched the slider |
| m0 p4 | the clock started while I was reading; 0.2 s early = 1 point |
| m0 try-it | five copies of one question; "Stop and check in" never taught; "+0.1 s" |
| m1 p3 miss | "+65.5 s" and "CAMEO" |
| m1 p6 / p7 misses | "40 MPH" when the row says 30 (or 25) |
| m2 p4 / p6 retry | tapped on the tick / on the watch time and was told I was late (reading time) |
| m4 p2 -> p3 | 7.1 s, then 5.6 s for the same speeds |
| m5 p5 | lap + hold - lead before timed holds are explained |
| m10 p2 | exact-transit OUT before exact transits; the "0003" digits |
| try-it recaps | ★★★ with 0 of 5 |

## Factual slips
- m4: STOP_EXAMPLE (30/40 sit 7.1, 40/40 6.1, 50/30 6.7) vs the cards' car (30/40 5.6, 35/40 5.2, 40/40 pause 20 sit 9.6, 30/30 8.6, 35/35 6.0): two cars, both called "this app's car".
- m1 wrong-answer rule quotes "40 MPH" regardless of the row.
- m11 p4 verdict chip REG V.A.1 for the 5 mph-near-green rule (V.E.3).
- Checked and correct: everything in the Pass 2 arithmetic list; m0 "nine days, about 150 teams, a third new, Route 66 Springfield to Pasadena"; 1 point per second; Packard 30 -> 40 loss 6.4 (sit 8.6, HB p.8); split 35 -> 30 at 32.5; base 9:05 + 27 = 9:32, launch 9:31:57; restart mini-sims' TOD truths within 0.6 s of base + position - loss (display truncates fractional seconds).

## Three best pages
1. **m1 p7, the four trap cases** (pt17-22): "Welcome to" on a WELCOME TO GRANITE CITY sign, twin limits, an overhead sign, a bracketed old speed; each correct answer says "Trap: ..." and why. This is what Josh asked for and it is fun.
2. **m3 p2, the stopwatch card**: START at the water tower, LAP at the grain elevator, "your lap reads 0m14.0s". Hands-on and exactly the skill.
3. **m0 p4, Where is the checkpoint?** (pt17-06/07): sign and ghost drawn, a fair test, a clear result line.
(Honourable mention: m2 p4's Start screen with the CALL tick on the bar, pt17-26, until the grading leak bites.)

## Three worst pages
1. **m4 p2 -> p3**: the worked example says sit 7.1 s for 30 in / 40 out; the next page's card says 5.6 s for the same speeds.
2. **Any bar-cued timed card after reading** (m2 p4, m3 p2, m5 p4, m5 p7): you follow the bar to the tick and are told you were seconds late.
3. **m1 p6 wrong path**: you fall for the 40 on the sign and the red box confirms "40 MPH".

## Top-10 fixes (ranked)
1. **Start must start the clock** (N1): in src/ui/mobile/tapwatch.ts `begin()`, call `o.onStart?.()` before `t0 = now()` (or have the watch use the card clock directly); same path for src/ui/mobile/run.ts. e2e: wait 3 s under Start, tap Start, tap on the oracle second -> Correct; watch digits read under 0.2 s right after Start.
2. **Module 1 wrong-answer lines** (N2): per-round wrong text naming the trap and quoting the row's Column C (content/course.ts rounds; src/ui/school2/minisim.ts verdict()); drop the "40 MPH" example from content/rules.ts:277 for the verdict.
3. **One car in Module 4** (N3, B8): derive STOP_EXAMPLE from the same car and chart the pause cards use, and make m4 p3 a 30/40 card whose sit equals the example; keep losses for equal speeds equal across m2, m4, m12 and the try-its.
4. **Stars that mean something** (N4, B15): stars from correct answers (0 of 5 = 0 stars), "Try again" as primary below 3 of 5, and "5 of 5 correct" instead of "right" (SCH-021) in src/ui/school2/tryit.ts and src/ui/mobile/recap.ts.
5. **Start on the widgets** (N5): holdSpeed, whereCheckpoint, tapLap wait under a Start like the cards (src/ui/school2/widgets.ts); offer "Try again" on whereCheckpoint.
6. **A newcomer's second visit** (B13, N6): do not consume the first visit until a tap (src/ui/main.ts); until Module 0 is started, Home leads with the course and daily/skill runs draw only Module 0-1 kinds or say "finish Module 6 first".
7. **No seconds on option-card verdicts in the School** (N7): src/ui/mobile/cards.ts verdictParts; keep seconds for timed kinds.
8. **Teach before ask** (N8): move m5 p5 after "Timed holds"; move m10 p2 after "Exact transits"; m6 p8 should test the queue; fix m9 p7's why line (content/course.ts).
9. **Module-aware rule text** (N9, N12, N15): no Dec/Acc or "half a ramp" before Module 4/5; explain "pre-read" in m1; "stopwatch" instead of "chrono"; drop "New:" after the first try-it card.
10. **Polish**: m5 p3 capital T; draw 'two-seats' on m0 p6 and a junction on m1 p2; fix "Comes quick" overflow; bigger, tappable vibe stills nearer the start; vary the m0 try-it; video URLs (Josh); B23 redirect.

## Scripts (playtest-scripts/, run from the repo root with `npx tsx`, against `npx vite preview --port 4189`)
- `pt17-common.ts` (fresh persistent profile, `PT17_PROFILE` override, touch tap/drag), `pt17-01-first-open.ts`, `pt17-02-step.ts`
  (naive stepper: go/bare/text/sel/next/start/at/wait/shot/dump), `pt17-03-hold.ts`, `pt17-04-where.ts`, `pt17-05-run.ts` (run/try-it
  player, taps Start, records whether the clock moved before Start), `pt17-06-timed.ts` (wrong tap first by touch, verdict persistence,
  Try again), `pt17-07-bar.ts` (follow the bar to the CALL tick after N ms of reading), `pt17-08-readdelay.ts` (every timed mini-sim at
  0.3 s and 4 s of reading), `pt17-09-run-readdelay.ts` (same on run cards), `pt17-10-follow-watch.ts` (watch jump on Start),
  `pt17-11-walk.ts` (module walker), `pt17-12-oracle.ts`, `pt17-13-audit.ts` (every page: words, scroll, chips, sheets; `390 844 1`,
  `360 780 0`; its "SHEET OFF-SCREEN" flag is the 0.18 s pop animation, sheets fit, see pt17-35), `pt17-14-desk-landscape.ts`, `pt17-15-continue.ts`.
- Screenshots: 33 `docs/playtest/screenshots/pt17-*.png`, all under 100 KB.

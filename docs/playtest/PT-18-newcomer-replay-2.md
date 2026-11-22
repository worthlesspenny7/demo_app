# PT-18: Rally School replay by a newcomer, after fix sprint PT-17 (2026-11-22)

Tester: independent agent playing someone who has never heard of TSD rallying and got the link from a friend.
Build: `npm run build` of HEAD 50f769a (fix sprint PT-17), `npx vite preview --port 4190`.
Chromium at /opt/pw-browsers/chromium, 390 x 844 (360 x 780 for geometry), `hasTouch` + `isMobile`, real touch taps
(`page.touchscreen.tap`, CDP touch drags), one fresh persistent profile. Scripts: `playtest-scripts/pt18-*.ts`.
Screenshots: `docs/playtest/screenshots/pt18-*.png`. Nothing under src/, tests/, content/ or public/ edited; nothing committed.

## Verdict in one paragraph
The fix sprint removed the defect that sank PT-17: **Start now starts the clock.** I read eleven timed cards for 3 to 5 seconds
under Start, tapped Start, then tapped on what the screen showed (the bar reaching the CALL tick, the watch reaching the "sit"
seconds, "Mark!", the CDT clock reaching base + position - loss): 11 of 11 Correct, none late, and the watch reads 0:00.05 just after
Start however long you read. Module 1's trap cases now explain each wrong answer with the row's own Column C, Module 4 quotes one
car (30 in / 40 out is sit 7.1 s on the figure, the worked example and the card), try-it stars follow correct answers with Try again
first at 0 of 5, the widgets wait under Start, option verdicts in the School carry no seconds, and a newcomer lands back in the
School (on the page they left) until Module 0 is done. What is left is small: Module 0's "Where is the checkpoint?" still charges a
point for tapping exactly as the car reaches the drawn sign (the drawing leads the timing by ~0.3 s) and offers no retry; a 0-of-5
recap still says "Module 1 done ... You can now read a line of the book" and "175.5 s off"; the restart rule quotes 9:32:00 / 9:31:57
on every restart card; two figures have overlapping labels; no video opens. Rubric 3.8 / 5 (was 3.4). 15 of 17 PT-17 items fixed or
mostly fixed, none regressed. No High found.

## Timings (pass 1, modelled as in PT-17: 200 wpm on every word shown, 1.5 s per navigation tap, 3 s per choice, real widget/timed durations, one miss per mini-sim)
| Moment | PT-18 | PT-17 | Notes |
|---|---|---|---|
| Page 1 painted | 0.16 s | 0.15 s | bare URL -> #/school, Module 0 page 1 (68 words on the page, 81 on screen) |
| First interaction (Start) | ~22 s | ~21 s | |
| First mini-sim in hand (Hold 35 started) | ~31 s | ~22 s | +8 s: the widget now waits under its own Start (by design, SCH-032) |
| First decision-card mini-sim (m1 p3) | ~5.1 min | ~5.2 min | |
| Module 0 done (incl. 5-card try-it) | ~4.5 min | ~4.5 min | widgets 16 / 21 / 16 s from Start |
| Module 1 done (incl. try-it, one miss per sim) | ~6.0 min | ~6.3 min | 3 sims, 8 cases; miss lines now longer but trap whys shorter |
| **Modules 0 + 1** | **~10.5 min** | ~10.8 min | ~9.5 min with no misses; ~9.0 min for a 250 wpm reader |
| Modules 2-6 reading + play (excl. try-its) | ~2.3 / 2.6 / 2.7 / 3.0 / 3.2 min | 2.3 / 2.6 / 2.6 / 3.0 / 3.0 | m6 grew by the two-case queue card |
| Try-its m0-m6 (wall, 3.5 s reading per timed card) | 8 / 8 / 23 / **106** / 82 / 56 / 42 s | - / - / 28 / 91 / 47 / 69 / 54 | "a one-minute run" is ~1.8 min in m3 |
| First unguided run (12 cards) | 92 s wall | | |

## SCH-009 targets, re-measured
| Target | PT-18 | Pass? (PT-17) |
|---|---|---|
| First mini-sim within 90 s | Hold 35 started at ~31 s; first decision card ~5.1 min | Yes (yes) |
| Modules 0 + 1 under 10 min | ~10.5 min modelled with one miss per mini-sim, ~9.5 without | **No, by a hair** (no, 10.8) |
| >= 8 interactions in M0 + M1 | 8 interaction pages, 13 graded decisions (m1 trap pages hold 7), 2 try-its | Yes (yes) |
| No page over one screen | 0 of 99 pages scroll at 390 x 844 or 360 x 780 before answering; 0 of 53 interactive pages after a wrong answer at 360 x 780 (`pt18-14-geom.ts`) | Yes (yes) |
| No page over 70 words | max m4 p1: 72 counting the figure's labels, 63 in the text; first-visit page 68 | Yes on text (no) |
| At most 2 chips per page | 78 chips on 99 pages, max 2 | Yes (yes) |
| No reference text inline | clean on pages and verdicts | Yes (yes) |
| Controls in the first unguided run taught before | all 12 cards are m0-m6 kinds, all controls taught; "chrono" gone | Yes (yes) |
| Rubric each >= 4 | 4 / 4 / 4 / 4 / 3 | **No** (no) |

## Rubric (0-5)
| | PT-18 | PT-17 | Why |
|---|---|---|---|
| Clarity for a newcomer | 4 | 3 | terms arrive in order, trap misses quote the row, one car in Module 4, no seconds on option misses; minus checks that print the answer with no why, the restart rule's 9:32 example on every restart card, m12/m5 pointers that disagree with their cards, the m10 odometer digits |
| Interaction density | 4 | 4 | something to do every page or two; m0 try-it still five copies of one question; m3 try-it long |
| Fun | 4 | 3 | following the bar or the watch is now rewarded; trap cases, stopwatch card, start-queue card are fun; m0 p4's "1 point" for an honest tap and the m0 try-it are not |
| I know what to do next | 4 | 4 | Start on every timer, Try again that stays, Try again first below 3 of 5, newcomer lands back where they left; minus "Module 1 done / You can now ..." after 0 of 5 and two orange buttons (Start, Next) on widget pages |
| Reference access | 3 | 3 | 78 chips, all open a sheet; still no video can be opened; m8's verdict chip is a bare "Source" with a raw citation string |
Average 3.8 (PT-17 3.4, PT-16 3.2).

**Would I send this to a friend who has never heard of TSD?** Yes, Modules 0-6 today; they will no longer be told "late" for doing
what the screen says. I would warn them that the checkpoint widget on page 4 is fussy and that the school's videos are not linked yet.

## Pass 1 log (naive, course.ts not read)
- Bare URL, fresh profile: first paint 156 ms, lands on #/school, Module 0 page 1 of 9, 68 words on the page, 81 on screen.
  One primary button: Start. Same as PT-17 (pt18-01).
- m0 p2 Hold 35 now waits under **Start** with the goal shown ("Hold 35 ± 1 for 10 s"); after 3 s of reading the car is still 25 mph
  and the readout "on time" (N5 fixed, pt18-02). After Start: drag to 46 then 35 by touch, "Held it: well done." 16 s after Start.
  The screen shows two big orange buttons at once, Start (widget) and Next (page): a newcomer can skip the widget with Next.
- m0 p4 Where is the checkpoint: Start gate, clock 0.0 s after 3 s reading. Tapping when my car's nose visibly reaches the
  green sign (clock 20.3-20.4 s) scores "0.2 s before it ... The crew counts whole seconds: 1 point." (pt18-04); tapping 0.3 s
  after visual contact gives "exactly with it ... an Ace!" (pt18-04b). The drawing leads the timing by about 0.3 s, so the honest
  tap costs a point. Still no Try again (button "Done", disabled). N13 not fixed.
- m0 p5 vibe strip unchanged (three ~110 px stills, page 5). m0 p6 Three parties now draws the two-seats figure, but its
  captions run into each other: "road, speed book, clock, watch" on one line under the boxes, and the "0:08" watch overlaps
  the clock icon (pt18-06).
- m0 p8 check unchanged: "Not quite: 4 points." on a wrong tap gives the answer with no why.
- m0 try-it: still five copies of one checkpoint question (650/450/650/600/600 ft, 30/40 mph), "Stop and check in" never
  taught. Verdicts now "Correct" with no seconds (N7 fixed). Recap: "Module 0 done ★★★ 5 of 5 correct · **0.7 s off**" -- five
  option cards and the recap still reports seconds off. Header of the run: "Safety and course".
- m1 p1-p2 (68 / 50 words): p1 now says "Reading ahead in the book is the pre-read" (N12 term fixed). p2 "The little map" is still the
  five-column strip, not a junction drawing.
- m1 p3 which-way, wrong tap Left by touch: red box "Not quite: the bold arrow" + the CAMEO rule, **no seconds** (N7 fixed); Try
  again is disabled for ~0.4 s after a miss, then works on touch (a tap inside that window is swallowed silently).
- **m1 p6 / p7 trap cases (N2): every wrong option on all seven cases now names the trap and quotes the row's own Column C**
  (`pt18-06-traps.ts`, pt18-10): sign 40 / Column C 30, tap 40 -> "Not quite: the posted limit is not your speed" + "Trap: the posted
  limit. This row's Column C says "30 MPH": call 30." Blank C -> "...says nothing: keep 30." The normal case -> "Sign and book agree:
  this row's Column C says "25 MPH", call 25." No "40 MPH" anywhere. Nits: the twin-sign prompt still gives itself away; the blank-C
  case's current speed (30) is still only in the option label "Hold 30" or under details.
- m1 p8 check: wrong -> "Not quite: The speed you had." (capital T mid-sentence).
- m1 try-it: 3 what-speed + 2 which-way (Bear right, Left), no STOP rows (N12 fixed), "New:" only on card 1 (fixed). "Bear left/right"
  is not on the which-way example page (m1 p4 shows left, straight, main road). Recap "5 of 5 correct · **0.0 s off**" (seconds on
  an all-option run).
- m2: ICE, turn mini-sim (no seconds on the miss), "He says it back" (Mark, bar), speed change under Start with CALL tick, "Always end
  on GO", GO card with "sit 8.6 s on the watch", check. Wrong CALL (late) -> "Call at the CALL tick, a moment before the driver's
  Mark..." and wrong GO -> "Sit the seconds the card gives, counting out loud, then say GO" -- no "half a ramp", no Dec/Acc (N9 fixed).
- m3: stopwatch card (START at the water tower, LAP at the grain elevator), laps concept, tapLap widget behind Start (N5 fixed),
  interval/cumulative example, check. tapLap's split options are printed to two decimals (1.22 s / 2.43 s / 3.65 s) while the watch
  shows tenths (0m02.4s).
- m4: p1 72 words incl. figure labels (63 in the text), figure "This app's car: 30 -> 40 sit 7.1 s"; p2 "in 30, out 40, the chart loss
  is 7.9. So sit 7.1 s"; **p3 "Pause 15 s, in 30, out 40: sit 7.1 s", chart cell 30 -> 40 sit 7.1 s** (N3 fixed on the pages).
- m5: split the sign, CALL mini-sim, "The lead" (capital T now, N10 fixed), CALL at the tick, **Timed holds now before the lap + hold -
  lead card** (N8 fixed), timed start, check. Pointer "about 2 s before the hold ends" vs card "2.5 s before" (nit unchanged).
- m6: base + position, launch early, two LAUNCH cards, loose minute hand, clock question ("Watch, stopwatch mode" replaces "chrono",
  N15 fixed in the School), "Wait your turn", **a real two-case start-queue card** (car ahead not yet due: wait back; car sitting past
  its minute: go around) (N11 part fixed). The clock card's why line talks about the minute while the question asks for the second.

### Timed cards: read first, then follow the screen (SCH-022 / N1)
`pt18-07-cue.ts` reads each card 3-5 s under Start, taps Start, then taps on what the screen shows (bar fill reaching the CALL tick,
watch digits reaching the "sit" seconds, "Mark!"/0 ft for START and LAP, watch reaching hold - lead, CDT digits reaching base +
position - loss), by touch, zero or 250 ms reaction:
| Card | Read | Cue | Verdict |
|---|---|---|---|
| m2/4 speed change | 4 s | bar at CALL tick (6.60) | Correct +0.2 s (+0.4 s with 250 ms reaction) |
| m2/6 GO | 4 s | watch 0:08.60 | Correct +0.1 s |
| m3/2 stopwatch | 4 s | START at Mark, LAP at grain elevator 0 ft | Correct +0.2 s, "your lap reads 0m14.0s" |
| m4/3 GO | 4 s | watch 0:07.10 | Correct 0.0 s |
| m4/5 GO | 4 s | watch 0:08.40 | Correct 0.0 s |
| m4/6 GO | 3 s | watch 0:08.90 | Correct 0.0 s |
| m5/2 speed change | 3 s | bar at tick | Correct +0.1 s |
| m5/4 speed change | 3 s | bar at tick | Correct 0.0 s |
| m5/7 timed start | 3-4 s | Mark!, then watch 0:07.50 | Correct +0.1 s (+0.6 s with reaction) |
| m6/3 restart | 3 s | CDT 9:02:54 (8:48 + 15 min - 6.1 s) | Correct +0.1 s |
| m6/4 restart | 3 s | CDT 10:56:57 | Correct 0.0 s |
11 of 11 Correct, **no "late" verdict**; the watch reads 0:00.05 and the CDT clock has not moved 60 ms after Start, whatever the
reading time. **N1 fixed.** (One oddity: on the stopwatch cards, if you tap START a hair before "Mark!" appears, the first sign's
"Mark!" then shows for ~1.3 s beside the next cue's label, "grain elevator 720 ft Mark!"; a tap on that would be a 13 s early LAP.)

### Wrong first, then Try again, by touch (`pt18-08-wrongfirst.ts`)
| Card | Wrong tap | Verdict after 1.5 s | Try again | Retry |
|---|---|---|---|---|
| m2/6 GO | 3 s early | "Not quite: GO 3.0 s early", stays (pt18-11) | card back under Start | Correct +0.2 s |
| m5/4 CALL | 2.5 s late | "Not quite: CALL 2.5 s late", stays | works | Correct +0.2 s |
| m6/4 LAUNCH | 4 s early | "Not quite: LAUNCH 4.0 s early", stays | works | Correct +0.2 s |
| m3/6 LAP | 3 s late | "Not quite: LAP 3.0 s late ... your lap reads 0m13.7s", stays | works | Correct +0.2 s |
All good. One wrong line still quotes another card's numbers: m6/4 (your time 10:57:00, loss 3.0 s) misses with "Launch at your time
minus the car's standing-start loss: **9:32:00 minus 3 s is 9:31:57**" -- the N2 pattern on the restart rule.

### Try-its m2-m6 (read each timed card 3.5 s under Start, then tap on the cue)
| Module | Cards | Wall | Recap |
|---|---|---|---|
| m2 | turn (under Start on the run), pre-read, pause, turn, pre-read | 23 s | ★★★ 5 of 5 correct · 0.1 s off |
| m3 | 5 stopwatch cards (START + LAP) | **106 s** | ★★★ 5 of 5 correct · 0.5 s off |
| m4 | 5 pause cards (25/35 13.3, 25/30 14.1, 35/25 8.9, 35/40 11.6, 45/35 11.5) | 82 s | ★★★ 5 of 5 correct · 0.9 s off |
| m5 | 2 timed starts, 2 lap + hold - lead option cards, 1 speed change | 56 s | ★★★ 5 of 5 correct · 0.4 s off |
| m6 | 3 clock questions, 2 restarts | 42 s | ★★★ 5 of 5 correct · 0.2 s off |
No timed card graded late after reading (N1 fixed on run cards too). The m3 "one-minute run" is now 106 s with reading (N17 not
fixed). The m3 try-it pointer still says "Tap LAP as the car reaches the sign" while START comes first. The m4 try-it's 35/25 sit 8.9
equals m4 p6 (one car). The m6 restart verdict's why line quotes "9:32:00 minus 3 s is 9:31:57" on a 10:30:00 / 4.4 s card even when
you are correct.

### Closing and reopening
- Fresh profile, close on m0 p4, reopen the bare URL: lands on #/school at **m0 p4** (where I was). Fresh profile, open and close
  without a tap, reopen: lands on m0 p1 again, no Home, no install banner (B13 / N6 fixed).
- Main profile after Module 6 (Module 0 done), close on m7 p3, reopen: Home, with "**Continue course: Module 7, page 3**" as the first
  big button under the install banner (pt18-12). Not the School itself, but the next step is obvious.

### First unguided run (Home, "Play daily run 1 of 3", after Module 6)
12 cards + 3 rule cards: lap + hold - lead (option), restart, turn, pause, pre-read, speed change, clock, restart, checkpoint, lap +
hold - lead, timed start, clock; rule cards "timed changes count from departure", "start = base + position", "follow the bold CAMEO
arrow". Controls: option buttons, Start, LAUNCH, GO, CALL, START + CALL, "details", "source" chip, Got it, Next card, See the run.
**Every kind and control was taught in Modules 0-6; no High.** Recap ★★★ 12 of 12 correct, per-skill table, "worst three".
Carry-over outside the School: option cards on the run still print seconds ("Correct | 0.0 s" on a turn, "**+0.3 s**" on the
checkpoint "Hold speed" card, and "Checkpoint: correct, 0.3 s" in the worst three). Turn cards on runs now wait under Start (options
disabled until Start); in the School the turn mini-sim (m2 p2) had no Start, so the first time you meet it is in the m2 try-it.

## Pass 2 (critical): course.ts read, Modules 7-12, chips, widgets, numbers, words
- **Modules 7-12** (`pt18-11-walk.ts`, one deliberate miss per module): every page plays; arithmetic checked and correct: m7 47 s back
  -> ~94 lost (check 94); m8 4 s late at 40 -> 44 for 40 s (6 s/min), 5 s at 30 -> 33 for 50 s, 8 s at 40 -> 48 for 40 s (12 s/min),
  mini-sims 5 s at 40 / limit 45 -> +10 % for 50 s (+20 % = 48 > 45, its miss says so), 6 s at 40 before a timed interval -> +10 % for
  60 s, 12 s at 35 / 125 s -> +10 % for 120 s (+20 % for 60 s is also accepted), check 6 s at 30 -> 33 for 60 s; m9 3m47 -> claim 3m40,
  56 s - 13 = 43 -> claim 0m40s (misses name the excess), TA form: 1 checkpoint passed -> leg 2 (misses: "1 passed, so leg 2"); m10
  2:41:20 + 20 m = 3:01:20, 9:15:23 + 2 m = 9:17:23, 10:17:29 + 1 m = 10:18:29, lunch 2:55 + 12 = 3:07 - 45 = 2:22, check 10:14:30 + 25 m =
  10:39:30; m11 3 min late -> 120 (cap), scorecard 11 + 0 + 8 + 8 + 5 = 32 x 0.845 = 27.04 (every leg checked against PERFECT/YOURS);
  m12 pause 15, 30/30, loss 6.4 -> sit 8.6; 35/35 sit 7.4; timed start 0m12s, lead 1.0 -> CALL 11 s after START.
- **Module 4's numbers (N3):** STOP_EXAMPLE is now computed from the engine's car. 30/40: figure 7.1, example "loss 7.9, sit 7.1",
  card "sit 7.1", chart cell "30 -> 40 sit 7.1 s". Equal speeds rise smoothly across every card I saw: 30/30 loss 6.4 (m2 p6, m12 p2),
  35/35 7.6 (m12 p4), 40/40 8.9 (m4 p2); 35/25 sit 8.9 on m4 p6 and in the m4 try-it. One car. **FIXED.**
- **Module 1 traps (N2):** all 14 wrong options on the seven cases name the trap and quote the row's Column C (table in pass 1). FIXED.
- **Try-it stars (N4)** on the m1 try-it, by touch (`MISSN` in `pt18-05-run.ts`):
  | Correct | Stars | Line | Buttons (primary right) |
  |---|---|---|---|
  | 0 of 5 | ☆☆☆ | "0 of 5 correct · 175.5 s off" | Module 2 / **Try again** (pt18-m1stars5-recap) |
  | 3 of 5 | ★★☆ | "3 of 5 correct · 17.3 s off" | Again / **Module 2** (pt18-m1stars2-recap) |
  | 4 of 5 | ★★★ | "4 of 5 correct · 4.5 s off" | Again / Module 2 |
  | 5 of 5 | ★★★ | "5 of 5 correct · 0.0 s off" | Again / Module 2 (pt18-m1try-recap) |
  Stars now mean something and "right" is gone ("correct"). But the 0-of-5 screen still heads "Module 1 done" and says "You can now
  read a line of the book: which way and what speed.", and every recap prints seconds off for option-only runs (175.5 s for five
  which-way/what-speed misses; 0.7 s for five correct checkpoint answers in m0).
- **Start-queue card (m6 p8):** two cases, both deducible from "Wait your turn": car ahead due 9:40:00, now 9:39:50, it waits -> wait back;
  car ahead due 11:13:00, now 11:13:15, still sitting -> go around and leave on your minute. Each wrong option gets the case's own line
  ("pull up only after the car ahead leaves" / "go around a car that sits past its minute"). Good. m10 p7 "The queue" mini-sim is still
  a plain LAUNCH card whose why line talks about the car ahead.
- **TA form card (m9 p7):** "TA web form. You passed 1 checkpoint before the tractor held you. Which leg do you enter?" Leg 5/2/1/3;
  taught on the page before ("The leg number is checkpoints passed plus one"); misses say "1 passed, so leg 2 goes on the form". Good.
  m9 p5's miss headline "claimed 10 s more than you could not make up" is a double negative.
- **Widgets' arithmetic:** holdSpeed (35 +- 1 for 10 s; drift readout frozen at 0.8 s early while at 35, correct); whereCheckpoint (0.2 mi
  at 35 mph = 20.57 s, "ghost reached the sign at 20.6 s", correct, but the drawn sign is reached ~0.3 s earlier, see R1); tapLap (split at
  marker 2 = cumulative, options 1.22 / 2.43 / 3.65 s, correct; two decimals against a tenths display); readScorecard (27.04, correct).
- **Reference chips:** 78 chips on 99 pages, every one opens its sheet and closes (`pt18-13-audit.ts`, 390 x 844); 0 of 36 video
  chips can open a video (no URLs yet). Verdict chips: m8's make-up verdicts carry a bare "**Source**" chip whose sheet reads "Where
  this rule comes from: Making Up Time [03:08]; REG V.F.1.c" (raw string, no excerpt; pt18-14). m11 p4 (crawling near green) still
  cites REG V.A.1 in the verdict, not V.E.3.
- **"right" as praise (SCH-021):** none on any screen I visited or in src/ui and content (`grep`); recaps say "N of M correct". Remaining
  uses are directions, "Slow right down" (an option label) and a quoted video line in an excerpt. PASS.
- **"Dad" (SCH-027):** none in src/, content/, public/ or on screen. PASS.
- **Terms before their module:** "half a ramp" first in m5 (m2 and m4 verdicts use the early rule text); "Dec(" / "Acc(" nowhere; "chrono"
  only as an internal option id ("Watch, stopwatch mode" on screen); "pre-read" explained on m1 p1 before the PRE-READ cards. Leftovers:
  the restart cards' details show a chart key "Acc / dec" (m6 p3, under "details"); "CDT" appears on m2 cards before m6 explains it (the
  "CDT?" chip explains it on tap); m2 p4 says "Call 30 1.4 s before Mark!" two modules before "lead" (fine: the card gives the number).
- **Pointers vs cards:** m12 p6 pointer "CALL about 2 s before the hold ends" vs card "CALL 30 1.0 s before the 0m12s ends"; m5 p7
  "about 2 s" vs "2.5 s"; m3 try-it "Tap LAP as the car reaches the sign" while START comes first. All others match.
- **Geometry:** 0 of 99 pages scroll at either size; 53 interactive pages answered wrong at 360 x 780: no scroll, no overflow. Two
  figures overflow or collide: m4 p1 "This app's car: 30 -> 40" runs off the right edge at 360 (and 3 px at 390) under the sit box
  (pt18-13-m4p1-360); m0 p6 captions collide (pt18-06).
- **Home for a visitor who leaves Module 0 with ×:** "Continue course: Module 0, page 1" first; the daily run serves Module 0-6 kinds
  (watch, restart, timed start ...), none of which this visitor has seen, and Home lists **Desk mode**, which the course taker's Home
  after Module 6 does not.

## PT-17 items: status
| # | PT-17 sev | Status | Evidence |
|---|---|---|---|
| N1 reading time graded | HIGH | **FIXED** | 11 of 11 timed mini-sims Correct after 3-5 s of reading, tapping on the screen cue (`pt18-07-cue.ts`); watch 0:00.05 60 ms after Start; try-its m2-m6 and daily run with 3-3.5 s reading: no late verdict |
| N2 m1 trap wrong lines | HIGH | **FIXED** | 14 wrong options, each "Trap: ... this row's Column C says "30 MPH"" (pt18-10) |
| N3 m4 numbers | MED | **FIXED** | 7.1 on figure, example, card and chart cell; equal-speed losses consistent |
| N4 stars | MED | **FIXED** (nit) | 0 of 5 = ☆☆☆ with Try again primary; but "Module 1 done / You can now ..." and seconds off (R2) |
| N5 widgets tick before Start | MED | **FIXED** | Hold 35/40, whereCheckpoint, tapLap frozen after 3 s reading; start on Start (pt18-02) |
| N6 second visit / Home runs | MED | **FIXED** | reopen lands on #/school (page left, or p1 if untouched); Home runs Module 0-6 kinds |
| N7 seconds on option verdicts | MED | **FIXED in the School** | no seconds on m1/m2/m6-m12 option misses; still in recaps and on runs outside the School (R2, R9) |
| N8 ask before teach | MED | **FIXED** | m5 "Timed holds" before the lap + hold - lead card; m10 "Exact transits" before its OUT cards |
| N9 module words | LOW | **FIXED** | no "half a ramp" or Dec/Acc before m5/m4; pause and CALL misses use plain words |
| N10 m5 p3 capital | LOW | **FIXED** | "The driver's Mark is still the sign itself." |
| N11 sims test their page | LOW | **PARTLY** | m6 p8 queue and m9 p7 leg fixed; m7 p4 and p6 still the same answer; m10 p7 plain launch |
| N12 m1 taught words | LOW | **FIXED** (nit) | pre-read explained, no STOP rows in m1 try-it, "New:" once; blank-C case's "holding 30" still only in details/option label |
| N13 whereCheckpoint result | LOW | **NOT FIXED** | honest tap at the drawn sign = "0.2 s before it ... 1 point"; no Try again (pt18-04, R1) |
| N14 figures | LOW | **PARTLY** | 'two-seats' drawn but captions collide; m1 p2 still the five-column strip; "Comes quick" fits |
| N15 "chrono" | LOW | **FIXED** (School and runs) | "Watch, stopwatch mode"; Desk still says CHRONO (known) |
| N16 m10 odometer digits | LOW | **NOT FIXED** | "0 0 0 3" squares under the hourglass, unexplained (pt18-m10-minisim) |
| N17 m3 try-it length | LOW | **NOT FIXED** | 106 s with reading (91 s in PT-17) |
Totals: **12 FIXED** (N1-N10, N12, N15; three with nits), **2 PARTLY** (N11, N14), **3 NOT FIXED** (N13, N16, N17), **0 REGRESSED**.

## PT-17 top-10: status
| # | Item | Status |
|---|---|---|
| 1 | Start must start the clock | FIXED |
| 2 | Module 1 wrong-answer lines | FIXED |
| 3 | One car in Module 4 | FIXED |
| 4 | Stars that mean something, "correct" not "right" | FIXED (0-of-5 recap still says "done" / "You can now") |
| 5 | Start on the widgets; Try again on whereCheckpoint | PARTLY (Start done; no Try again) |
| 6 | A newcomer's second visit | FIXED |
| 7 | No seconds on option verdicts in the School | FIXED |
| 8 | Teach before ask (m5, m10, m6 p8, m9 p7) | FIXED |
| 9 | Module-aware rule text | FIXED |
| 10 | Polish bundle | PARTLY: m5 capital, two-seats drawn, Comes quick, B23 redirect done; m1 p2 junction, vibe stills, m0 try-it variety, video URLs not |
Totals: 7 FIXED, 1 FIXED with a nit, 2 PARTLY, 0 regressed.

## New bugs
| # | Sev | Steps | Expected | Actual | File hint |
|---|---|---|---|---|---|
| R1 | MED | #/school/m0/4, Start, tap the moment your car's nose reaches the drawn green sign | Ace (the page says "Tap as the cars reach the green sign") | clock 20.4 s, "The ghost reached the sign at 20.6 s. You tapped at 20.4 s, 0.2 s before it ... 1 point."; tapping 0.3 s after visual contact gives the Ace; button becomes a disabled "Done", no retry (pt18-04, pt18-04b) | src/ui/school2/widgets.ts mountWhereCheckpoint / widget-models.ts: place the sign where the car is at the ghost's 20.6 s (or grade to the drawn sign); add Try again |
| R2 | MED | m1 try-it, answer all five wrong | "Not yet" heading, no "You can now", no seconds on an option run | "Module 1 done", "You can now read a line of the book ...", "0 of 5 correct · 175.5 s off"; all-option runs print "0.0 s off" / "0.7 s off" when correct (pt18-m1stars5-recap) | src/ui/school2/tryit.ts recap, src/ui/mobile/recap.ts: below 3 of 5 say "Not passed yet"; omit "s off" when the run has no timed cards |
| R3 | LOW | m6/4 (your time 10:57:00, loss 3.0 s) tap 4 s early; m6 try-it restart (10:30:00, 4.4 s) | the card's own sum | "Launch at your time minus the car's standing-start loss: 9:32:00 minus 3 s is 9:31:57." on misses and as the why on correct taps; same on the daily run | content/rules.ts restart / launch rule example clause; give the runner a per-card line like signCaseMiss |
| R4 | LOW | m12 p6; m5 p7; m3 try-it | pointer = card | "CALL about 2 s before the hold ends" vs "CALL 30 1.0 s before"; "about 2 s" vs "2.5 s"; "Tap LAP as the car reaches the sign" before START | content/course.ts m12 sim pointer; src/ui/mobile/guided.ts pointer for watch try-its |
| R5 | LOW | m0 p6 | readable two-seats figure | "road, speed" and "book, clock, watch" run together on one line; "0:08" overlaps the clock icon (pt18-06) | src/ui/school2/figures.ts 'seats' |
| R6 | LOW | m4 p1 at 360 x 780 | label inside the screen | "This app's car: 30 -> 40" runs off the right edge behind the sit box (pt18-13-m4p1-360) | figures.ts 'magic-stop' / chart label width |
| R7 | LOW | m8 p2 tap +20 %, or m8 p7 tap +20 % | a citation chip with an excerpt | a bare "Source" chip; the sheet says "Making Up Time [03:08]; REG V.F.1.c" twice (pt18-14) | verdict chip mapping for the make-up rule's source (src/ui/school2/minisim.ts verdict chips; content/excerpts.ts) |
| R8 | LOW | any check, wrong option | why it is wrong | "Not quite: 4 points." / "Not quite: The speed you had." (the answer, capitalised mid-sentence, no reason) | src/ui/school2/player.ts check feedback; optional `why` on check() in content/course.ts |
| R9 | LOW | daily run after m6 | no seconds on choices | "Correct · 0.0 s" on turn, pre-read, clock cards; "+0.3 s" on the checkpoint "Hold speed" card; worst three "Checkpoint: correct, 0.3 s" | src/ui/mobile/cards.ts verdictParts: extend noSeconds to option kinds on every run |
| R10 | LOW | fresh profile: tap × on m0 p1 -> Home | the course first, Desk hidden as for course takers | "Desk mode" link listed; daily run 1 serves timed starts and restarts to someone who has seen one page | src/ui/mobile home (Desk link rule), core runKinds for zero progress (or a "start the course first" note) |
| R11 | LOW | m3/2, tap START ~0.1 s before "Mark!" appears | Mark for the first sign only | the first "Mark!" stays ~1.3 s beside "grain elevator 720 ft"; a tap on it is a 13 s early LAP | src/ui/mobile tap-watch sign bar: clear the mark when the bar switches to the next cue |
| R12 | LOW | miss any option mini-sim, tap Try again within ~0.4 s | the tap works or the button looks disabled | tap swallowed silently | src/ui/school2/minisim.ts try-again guard: dim it while disabled |
| R13 | LOW | m9 p5 claim 0m50s | plain words | "Not quite: claimed 10 s more than you could not make up" | runner ta miss headline |
| R14 | LOW | m6 p6 / m6 try-it clock card "What do you count the second in from?" | a why about the second | why: "Near :55 the minute hand runs ahead. The stopwatch's time of day settles the minute." | content/course.ts m6 p6 why |
| R15 | LOW | m1 try-it, card 5 | taught options | "Bear right / Straight / Bear left": m1 p4 teaches left, straight, main road only | content m1 p4 example: add a bear line |
| R16 | LOW | m0 p2, m0 p4, any mini-sim | one obvious next step | two big orange buttons, Start (widget) and Next (page); Next skips an unfinished widget or mini-sim | src/ui/school2/player.ts: make Next secondary until the page is complete |

## Confusing pages
| Page | What confused |
|---|---|
| m0 p4 | I tapped as my car touched the sign and lost a point; then the button died |
| m0 p6 | the captions under the two seats read as one line |
| m0 try-it | five copies of one question; "Stop and check in" never taught |
| m1 try-it recap at 0 of 5 | empty stars, but "Module 1 done" and "You can now read a line of the book" |
| m6 p4 miss | "9:32:00 minus 3 s" on a 10:57:00 card |
| m10 p3 | the "0 0 0 3" squares under the hourglass |
| m12 p6 | pointer says 2 s, card says 1.0 s |

## Factual slips
- Restart rule example (9:32:00 - 3 s = 9:31:57) shown as the why on every restart card regardless of its numbers.
- m11 p4 verdict chip REG V.A.1 for the 5-mph-near-green rule (V.E.3) (unchanged).
- m8 p7: +20 % for 60 s is accepted alongside +10 % for 120 s (both gain 12 s; fine, but the page teaches 20 % only for "a big chunk").
- Stale header comment in content/course.ts says stop waits use the handbook Packard; they now use the app's car (code comment only).
- Checked and correct: all arithmetic listed in pass 2; m0 facts; whereCheckpoint 20.57 s; restart truths within 0.1 s of base +
  position - loss on m6/3 (9:02:53.9), m6/4 (10:56:57), try-it (11:27:54.8, 10:29:55.6); timed start 0m10s - 2.5 = 7.5 s on the watch.

## Three best pages
1. **m1 p6 / p7, the trap cases**, now on the wrong path too: fall for the 40 on the sign and the red box says "Trap: the posted limit.
   This row's Column C says "30 MPH": call 30." (pt18-10). Exactly what Josh asked for.
2. **m2 p4, the speed change under Start**: read as long as you like, tap Start, follow the bar to the CALL tick, Correct. The card that
   was the worst page in PT-17 is now one of the best (pt18-m2-minisim shows m2's turn card; the CALL card is m2 p4).
3. **m6 p8, Wait your turn**: two short queue cases that need the page you just read, each miss with its own line.
(Honourable mention: m3 p2's stopwatch card, "your lap reads 0m14.0s".)

## Three worst pages
1. **m0 p4, Where is the checkpoint?**: the honest tap costs a point, the explanation ("0.2 s before it ... whole seconds: 1 point")
   does not help, and there is no second go. It is the first scored thing a newcomer does.
2. **m0 try-it**: five identical checkpoint questions, one with an untaught option, then "0.7 s off".
3. **m10 p3 / p7**: unexplained odometer squares, and a "queue" mini-sim that is a plain launch.

## Top-10 fixes (ranked)
1. **whereCheckpoint fair and retryable** (R1, N13): draw the sign where the car is at the ghost's arrival time, or grade the tap against
   the drawn sign; replace "Done" with Try again; say "0.2 s early rounds to 1 point" plainly (src/ui/school2/widgets.ts, widget-models.ts).
2. **Honest try-it recap** (R2): below 3 of 5 head it "Not passed yet", drop "You can now"; no "s off" on option-only runs
   (src/ui/school2/tryit.ts, src/ui/mobile/recap.ts).
3. **Per-card restart line** (R3): quote the card's own time and loss, as signCaseMiss does for Module 1 (content/rules.ts restart rule;
   src/core/decision/runner.ts).
4. **Pointers from the card** (R4): build the timed-start pointer from the card's lead (m12 p6, m5 p7) and the m3 try-it pointer from
   the first control (content/course.ts, src/ui/mobile/guided.ts).
5. **Checks explain** (R8): a short why on wrong check answers, lower-case after the colon (src/ui/school2/player.ts; check() in content/course.ts).
6. **Figures** (R5, R6, N14): two-seats captions on two lines, m4 p1 label inside the screen, a real junction drawing on m1 p2
   (src/ui/school2/figures.ts).
7. **Try-it shape** (N17, m0 try-it): three stopwatch cards in m3 (or shorter legs); give m0 a mix (score-the-gap, green sign at
   different speeds, "hold speed") and drop "Stop and check in" until Module 11 (content/course.ts tryIt).
8. **No seconds on choices anywhere** (R9): extend the School's noSeconds to option kinds on every run (src/ui/mobile/cards.ts).
9. **m10 and m7 leftovers** (N16, N11): hide or label the odometer squares on transit rows; make m10 p7 a queue card (form 'queue'); give
   m7 p6 an answer that differs from p4 (content/course.ts, src/ui/mobile cards row render).
10. **Chips and Home polish** (R7, R10, R16, B22): give the make-up verdict a real excerpt chip; hide Desk for a zero-progress visitor;
    make Next secondary until a page is complete; video URLs when Josh sends them.

## Verdict for Josh
Yes: you can send the link today to someone who has never heard of TSD. The thing that made PT-17 a "not yet" is gone: they can
read a timed card as long as they like, tap Start, and doing what the bar or the watch says is graded correct, every time I tried
(11 cards, 3-5 s of reading each). They land back in the School where they left off, Module 1's traps teach on the wrong path,
Module 4 tells one story about the car, and the stars are honest. What they will still trip over: on page 4 of Module 0 the
checkpoint widget docks a point for tapping exactly as the car reaches the sign and will not let them try again (the very first
scored thing they do); Module 0's try-it is the same question five times; if they flunk a try-it the recap still says "done" and
"You can now ..."; the restart verdicts quote 9:32:00 on cards that say 10:57:00; a couple of figure labels overlap on small
phones; and none of the video chips opens a video yet. None of these blocks the course; fix 1 and 2 above before a wide send.

## Scripts (playtest-scripts/, run from the repo root with `npx tsx`, against `npx vite preview --port 4190`)
- `pt18-common.ts` (fresh persistent profile, `PT18_PROFILE` override, touch tap/drag), `pt18-01-first-open.ts`, `pt18-02-step.ts`
  (naive stepper; adds `wstart` for widget Start and `try` for Try again), `pt18-03-hold.ts`, `pt18-04-where.ts` (tap at visual contact
  plus an offset), `pt18-05-run.ts` (run/try-it player; `READMS` reading time under Start, `MISSN` first N cards wrong),
  `pt18-06-traps.ts` (every wrong option of multi-case mini-sims; any route list), `pt18-07-cue.ts` (read N ms, Start, tap on the screen
  cue), `pt18-08-wrongfirst.ts` (wrong timed tap, verdict persistence, Try again), `pt18-11-walk.ts` (module walker, widget Start),
  `pt18-13-audit.ts` (words, scroll, chips, sheets; `390 844 1`, `360 780 0`), `pt18-14-geom.ts` (every interactive page after a wrong
  answer), `pt18-90-dom.ts`, `pt18-91-offscreen.ts` (probes).
- Screenshots: 33 `docs/playtest/screenshots/pt18-*.png`, each under 100 KB.

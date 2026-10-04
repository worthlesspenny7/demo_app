# PT-08: Playability on the curriculum build (the new Start-here path, education sprint v3 + UI sprint PT-07)

Build under test: HEAD 8b8a59f, which carries e7d77d5 (education sprint v3) and 07961f4 (UI sprint PT-07); ENGINE 3.1.0.

## Method
I ran `npm run build`, copied `dist` to a pinned scratch snapshot and served it with `vite preview --port 4179`. The browser was Chromium at /opt/pw-browsers/chromium, driven by Playwright at 1366x768.
- Every player action was a real key press or a real click or fill.
- Sim time moved only through `window.__rally.advance`, with the cockpit loop held.

**The evening.** One browser profile carried the whole evening. Josh started from a fresh profile and followed the Start-here buttons in order:
- lessons four-s, griid-cameo and protocol;
- D09;
- the lost lesson, then D10;
- the transits lesson, then D16;
- the ghost-car lesson, then D01, D03, D04, D05 and D06;
- then, past the two hours, D08, D07 and D18.

**Scratch copies.** These used copies of the profile that were never saved (`PT08_NOSAVE=1`):
- the day stage `builtin/stage/1` at Bronze;
- D11 at Silver (rung 1, legal);
- the D08b TA checks;
- the probes.

**Scripts.** All are in `playtest-scripts/pt08-*.ts`.
- `pt08-common.ts`, `pt08-run.ts` and `pt08-human.ts` are the PT-07 harness. The changes:
  - port 4179;
  - a no-save mode;
  - K when the Bronze card says "Read the clock now (K)";
  - L at a timed landmark;
  - for a compound STOP + timed line, the card's new "s after Stopped" anchor;
  - the 10 % rule from the Bronze pace aid, P behind a slow vehicle, and no make-up past a checkpoint;
  - the restart speed is called with GO.
- Steps: `01` (path lessons), `02` (D09), `03` (any lesson), `04` (D10 with the lost drill), `05` (D16), `06` (D01), `07` (D06), `08` (D07), `09` (Home), `10` (stage), `11` (D08b), `12`–`14` (low items, campaign, printable book).
- Probes: `pt08-probe-ff-start.ts` and `pt08-probe-d08-makeup.ts`.

**Screenshots.** `docs/playtest/screenshots/pt08-*.png`: 38 files, 6.9 MB in total, the largest 0.28 MB.

**Sub-agents and errors.** No Agent tool was available, so I drove every drill group myself. There were no uncaught page errors.

**Harness slips.** Five slips were mine, not the app's. Each was re-run, and none is counted as a bug:
- a D10 watch stopped at "Heading back";
- a D07 lap parse;
- the restart speed was not called;
- a regex escape;
- D08 was first played with the fast-forward overshoot of N-B3, which left the car parked for 30 minutes because my model never pressed D.

## 1. The evening as played (wall time at the scale the drill card suggests)

| t | Step (from the Start-here / "Next on your path" button) | Result | Wall |
|---|---|---|---|
| 0:00 | Home, fresh. Lessons: The Four S's (1042 words), The GRIID page and the CAMEO (978), Team protocol (1915, Dad's card). One slip on the TA check, then right. | Each lesson's primary button goes to the next path step. After protocol it is "Next on your path: D09". | ~20 min of reading before any driving |
| 0:20 | D09 trap quiz (20 cards; I answered as a rookie who had just read three lessons). | 19/20 ★★★. The only miss was card 17, where two options are true rules (N-B5). The result page offers only Again / Home. | 5 min |
| 0:25 | Lesson "When you are lost" (528 words). | Clear and short. "Next on your path: D10". | 4 min |
| 0:29 | D10 Bronze at 4x, full start (W, Q, count). Josh takes the side road 350 ft before the real STOP-T, notices after 20 s, presses U, resets and starts the watch, then stops it at the junction the first time on "Heading back". | 79 s ★☆☆: "lost time not doubled … your 55 s is more than 2 s off". | 8 min |
| 0:37 | D10 retry, watch stopped on Dad's "Back on course". | 79 s ★★☆: "doubled = 84.6 s … your 85 s is within 2 s". The path ticks. | 8 min |
| 0:45 | Lesson "Transits and restarts" (1446 words, the first-morning checklist). | "Next on your path: D16". The next lesson in the list, "Which timer, when", is skipped. | 7 min |
| 0:52 | D16 Bronze at 4x by the card: queue, W/Q, count, exact transit, lunch "leave AT", restart. | 1 s, 2 aces, ★★☆, capped by "3 x time of day taken without reading the clock". Every departure was on its second, and the lunch now has the same 4-s lead (N6 fixed). | 26 min + 3 |
| 1:21 | Lesson "The ghost car" (299 words). | "Next on your path: D01". | 2 min |
| 1:23 | D01 Bronze: Fast-forward to the launch, Space, L at every marker. | 0 s ★★★, "Clean run". | 7 min (1x) |
| 1:30 | D03 Bronze by the card, X count. | 3 s ★★★. | 11 min (1x) |
| 1:41 | D04 Bronze by the card at 4x. | First run ★★☆: my old model counted from GO. The retry used the card's new "= 27.7 s after Stopped" anchor: 1 s ★★★. But "2 x no stopwatch start or lap at the landmark" denied the Clean run (N-B8). | 7 + 7 min |
| 1:55 | D05 Bronze by the card at 4x. | 1 s ★★★. | 6 min |
| 2:01 | D06 Bronze at 4x, measured as the MARK lines say: lap each MARK, read the pace aid in and out, note "stopgo 50>40 = 7.4" and so on. | 7/10 cells ★★☆. Stop & go 3/3, turns 3/3 and stop-in-the-middle 1/1, but accel/decel 0/3 (N-B4). | 15 min |
| **2:16** | **End of the two-hour evening (it ran over during D06).** | Path: 13 of 17 ticked. | |
| next evening | D08 Bronze: card follower, then with P and the 10 % rule. | ☆☆☆ 30 s until he passes the truck (P) and makes up with the 10 % rule. The recovery lesson is not on the path (N-B1). Then 0 s ★★★. | 4 runs × 5 min |
| | D07 Bronze: Space at the asterisk, L at six boxes, "cal N = i / c" notes, k = 1080 / 1062.7 = 1.016 typed and set while parked. | 3 s ★★★, read-offs 6/6. | 14 min + 3 |
| | D18 Bronze (the path button opens it although its card says 🔒, N-B2). | 0 s ★★★. Then "Path complete. Take the whole-leg drills (D11) and the full stage (D12)", and both are locked. | 5 min + 2 |
| scratch | Day stage `builtin/stage/1`, Bronze, by the card at 8x. | 227 raw, "blown" (PT-07: 307). **The cockpit fits at 1366x768: road 205 px, book 392, watch 206, drawer 253 (N1 fixed).** | 96 min |
| scratch | D11 Silver (legal rung): dwell from chart (b) in the C overlay. | 27 s ☆☆☆. Dad asks "Restart line. What is our time?". The headline still says "go earlier" (N3 partly). | 23 min at 4x |

**Does the evening hold together?** Yes, and better than in PT-07: no step blocks and every Next button leads somewhere sensible. But the new order front-loads about 30 minutes of reading and the 26-minute D16, so a two-hour evening now ends inside D06 (PT-07's ended after D16). The stay-on-time drills D08, D07 and D18 move to a second evening, and the stage to a third.

## 2. PT-07 bugs N1-N18: FIXED / NOT FIXED / REGRESSED

| PT-07 bug | Status | Evidence on this build |
|---|---|---|
| N1 Stage cockpit collapses at 1366x768 (High) | **FIXED** | Pre-read: road 205, book 392, watch 206 and drawer 253 px; the pre-read box is 140 px with all buttons visible. The same after the launch and mid-stage. `pt08-stage-preread.png`, `pt08-stage-midrun.png`, `10-stage.txt`. |
| N2 TA credit counted twice | **FIXED** | D08b: "Time allowance credit -50" for 0m50s allowed; no stray residual on that leg. |
| N3 "Go earlier" for a no-pause STOP | **NOT FIXED (partly)** | The worked row is right: "Stop, line 10: no pause printed … make the seconds up with the 10 % rule". But the D11 legal headline and "Fix this next" still say "Your stops cost more than the printed pause, so go earlier" with all six dwells within +0.6 s (bias row +0.3, sd 0.2). `pt08-d11-legal-debrief.png`. |
| N4 False "you never called N at line X" | **FIXED** | D03 and D05 ★★★ runs have no such line. The remaining "never called" lines were true (my early model did not call the restart speed in D06/D07). |
| N5 No anchor on compound STOP + timed lines | **FIXED** (new side effect, N-B8) | Card: "Count from the ghost's departure = arrival + the 15 s pause (11.8 s after "Stopped"), not from your go: call 35 15.9 s after that = 27.7 s after "Stopped"". The card follower calls at +0.6 and +0.6 s: ★★★. |
| N6 Lunch graded on the second | **FIXED** | "Lunch departure (line 5): left 10:26:56, due 10:27:00 (on the second)". The meal card says "Say go at 10:26:56: … the same lead at every hold". |
| N7 D16 clock reads never prompted | **NOT FIXED (partly)** | The D16 keys list "K read the clock at every IN, OUT and restart", and the hold cards say "Read the clock now (K): the out time is 10 s away". But the exact-transit IN prompt shows from the start line, 2 min 18 s before the IN sign. The model pressed K when told and still got "Exact-transit IN time (line 2) … no clock read within a minute of the sign" (N-B7). |
| N8 Drill-start leftovers (warn/count text) | **FIXED** | D01: "A drill start: the car launches itself on that second", no warn line, no "no warning to the driver" in the Debrief. |
| N9 Start line titled "Restart, line 1 … leave at that second" | **FIXED** (leftover on restarts) | The start card is "Start, line 1 … do not pull up before the car ahead has left". The restart card still reads "your time 11:12:00, leave at that second" right under "launch at 11:11:56 (minus 4 s)" (`pt08-d16-bronze-restart-T5.png`). |
| N10 Pre-read buttons below the fold | **FIXED** | "Fast-forward to the launch" and "Depart early (D)" sit at the top of the box (`pt08-d01-preread.png`). |
| N11 T focused a removed field | **FIXED** | After T the focus is on `#ta-car` (login page). |
| N12 Done closed the day with a claim pending | **FIXED** | Confirm: "Leg 1 has a measured delay (0m59s) and no Time Allowance request filed. Cancel to file it first …". |
| N13 Mark… prompt far from its row; ICE wording when empty | **FIXED** | The prompt is at x 1197, y 412, inside row 2 (y 287-445). Empty: "Nothing written on line 4: type time of day (9:34:00), or Esc to cancel". |
| N14 Pace chip in untimed states | **FIXED** | Stage warm-up ledger: "Nothing is timed here (transit, warm-up or hold): no early / late number"; no chip or arrow in the holds. |
| N15 Legal rung does the base + ASP sum | **FIXED** | D11 rung 1: "Restart line. What is our time? Give me 30 seconds …"; clock caption "official start = printed base 08:00:00 + your ASP"; no launch arithmetic in the pre-read. |
| N16 Echoed count floods the driver log | **FIXED** | One updating line ("09:52:46 10"); Dad's question stays in view. |
| N17 Sawtooth hands look alike | **FIXED** (by eye) | The minute hand reaches the minute track and WWV clears the tail. The "outer numbered track" is still not done (LOG). |
| N18 Turn chart (c) cliff at 12→15 | **FIXED** | Chart (c) now starts at 15. 15→15 0.0, 20→15 0.2, 25→15 0.3, 30→15 0.9: no cliff. |

**Counts: 16 FIXED, 2 NOT FIXED (both partly: N3, N7), 0 REGRESSED.**

### PT-07 top-10

| # | Item | Status |
|---|---|---|
| 1 | Stage layout (N1) | **FIXED** |
| 2 | Debrief truth (N4, N2, N3, B16 leftovers) | **PARTLY**: N4 and N2 fixed; the "entry ?" rows are gone. The N3 headline remains, and D10 off-course still prints "(buckets sum +115, rounding residual -36)". |
| 3 | "Clean run" gating (B7) | **FIXED**: D04 ★★★ with instrument findings leads "Leg times are clean, but the instruments were not used as taught"; D16 ★★ has no "Clean run". |
| 4 | Compound-line anchor (N5) | **FIXED** |
| 5 | D16 coaching (N6, N7) | **PARTLY**: N6 fixed; N7 IN prompt fires too early. |
| 6 | Drill-start clean-up (N8, N9, N10) | **FIXED**: only the restart "leave at that second" remains. |
| 7 | Untimed chips, count flood (N14, N16) | **FIXED** |
| 8 | TA form polish (N11, N12, worksheet with Josh's lap) | **PARTLY**: N11 and N12 fixed. The Bronze helper still says "measured 0m59s = stopped 0m51s + chart loss 7.8 s", not his own laps (listed as not done). |
| 9 | Legal-rung giveaways (N15) | **FIXED** |
| 10 | Book realism and leftovers | **PARTLY**: section arrows, the "Day stage 1" footer, marks on the printable page (`pt08-book-print-marks.png`: P23.5 printed), B20 tiers Bronze/Silver/Gold with "You … play a stage", B22 "14 readings, 3 to 9 minutes each (74 minutes in all)" and the "at 1x · at 4x" card minutes are all fixed. Still open: the cockpit hint bar, pre-read title and Debrief title say "fullStage #1"; 39 pages for the day. |

**Top-10: 6 FIXED, 4 PARTLY, 0 REGRESSED.**

## 3. Rubric (0-5; PT-07 in brackets)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First-run clarity | **3.5** (4.0) | The path's buttons work end to end and the lessons read well. But Josh reads about 3,900 words before he drives anything. The path skips the lessons its drills need (which-timer, pause-arithmetic, timed-leads, recovery, measure-car, calibration: N-B1). D09 is called "which way?" but asks for a rule. The path ends at a locked D18, then "Path complete" points at locked D11/D12 (N-B2). |
| 2 | Control scheme | **4.0** (4.0) | T focuses the form, the Mark… prompt opens beside its row, the D16 keys list K, and Q/W/G work. D06 and D07 notes are typed in a mouse-only notes box (no key); acceptable. |
| 3 | Information layout (1366x768) | **4.0** (3.0) | The stage now fits (road 205, book 392, watch 206). Costs: the cockpit book shows 3-4 rows; the D10 road view overlaps "This does not look like the route…" with "DEAD END". |
| 4 | Pace | **3.5** (3.5) | D16 takes 26 min at 4x as the 4th activity, D06 15 min and D07 17 min; the stage 96 min at 8x. The full-start fast-forward overshoots the launch (N-B3). |
| 5 | Feedback and progression | **3.5** (3.5) | Gone: the doubled TA credit, false "never called" lines and "Clean run" under 3 stars. The lost-doctrine grading is excellent. Still wrong: the D11 "go earlier" headline, the instrument anchor on compound lines, a 10 %-rule make-up blamed on the driver, D06 negative accel cells as "outliers", and progression that dead-ends on locks. |
| 6 | Dad's messages | **4.0** (4.0) | He asks for the warm-up speed and asks "What is our time?" at the legal rung; the count is one line; "Back on course" and "Heading back" are clear. Wrong: "Rolling on time" after a late fast-forwarded start, and "Straight on past line 4, you did not call a turn" at a T where he turned left. |
| 7 | Difficulty curve | **3.5** (3.0) | Card follower: ★★★ D01/D03/D04/D05/D07/D18, ★★ D10/D16/D06. D08 is ☆☆☆ until Josh applies a rule from a lesson the path never shows him. Stage 227 raw (was 307). D11 legal ☆☆☆. |
| 8 | Session-length fit | **4.0** (4.0) | Two hours reach D06 and never block. Three evenings to the stage; resume and confirms work. |
| 9 | Delight / polish | **4.0** (4.0) | The lost drill (U, watch, "lost 85", graded), the printed card, the arrows down Columns B/C and the cleaner Debrief are good. Offsetting them: stale alerts, "fullStage #1", and a duplicated "Drill start: no queue and no count" sentence in the D01 pre-read. |
| 10 | Frustration / recoverability | **4.0** (3.5) | No blockers or layout traps. The fast-forward overshoot, the D08 zero-star loop and the locked path end are the frustrations. |
| 11 | Realism integrity | **4.0** (4.5) | The lost doctrine, start queue, ASP prompts, web TA and calibration arithmetic are right. Lost half a point for D09: a spelling trap that REG VII.D rules out, and a TA tip from the paper-form era ("declare the measured wait at the checkpoint"). |
| | **Total** | **42.0 / 55** (41.0) | The PT-07 fixes landed (16/18, 0 regressed). The curriculum reorder adds reading and a long D16 early, and it routes past half the lessons. |

## 4. Verdicts on the new order

**Course before time.**
- **Does a rookie understand why course comes before time? Yes.**
  - Lesson 1 says it plainly: rookies "concentrate on the first 3 S's where the errors are usually in minutes", and a missed checkpoint costs 180 s against ten seconds for a bad stop.
  - D10's Debrief repeats it ("On course all the way, but the leg ran 180 s off: stay on course first, then stay on time").
- Two things blur it:
  - The path flips the handbook's own numbering, putting S3 (course) before S2 (start on time) without saying why. Lesson 1 says "the order is the priority".
  - D09, the first "course" drill, is a rule-matching quiz, not a "which way" decision (N-B5).
- D10 itself is the best new piece of the evening. It is short, the distractor is fair, and Dad's "This does not look like the route…" and "Back on course" cue the doctrine. It grades "lost 85" against the doubled 84.6 s.

**D16 early: right idea, too heavy as the 4th activity.**
- A card follower gets ★★ on the first try, so it is playable at Bronze. But it takes 26 minutes at 4x, and it uses vocabulary and grading the path has not taught yet:
  - the ghost and the standing-start loss (the ghost-car lesson comes after D16);
  - clock vs chrono reads, three findings (the "Which timer, when" lesson is never on the path, though D16's card says "Read first: … Which timer, when").
- Two traps make it harder than it needs to be:
  - "Fast-forward to the start time" lands 4 s past the launch, which caps D16 at one star (N-B3);
  - the K prompt for the IN shows two minutes too early (N-B7).
- Keep D16 in the start-on-time slot, but put "Which timer, when" and "The ghost car" before it and fix the fast-forward. It would then feel right.

**D06 (measuring the car): half playable, and the raw-run part is not.**
- What works: the MARK lines tell Josh to lap and compare against the ghost, and the Bronze pace aid makes stop & go (3/3 within 1 s), turns (3/3) and stop-in-the-middle (1/1) measurable.
- What does not:
  - Acceleration/deceleration cannot be measured while following the card. The B1 row says "Restart: leave on the second", but the card says "launch at minus 6 s", so the 0>50 loss reads 1 s (truth 6.4). At the speed-change MARKs the card's half-ramp early call makes the net loss come out at -0.5 s, which the Debrief calls "a negative net loss, an outlier: delete it or re-run".
  - The raw-run format ("const 25 runs 19.8 19.9 …", four runs per speed) cannot be produced inside the drill: each pair is driven once, and notes do not carry across retries. It only works for typing in Dad's real-car numbers.
  - The Bronze tip ends "At Bronze every pair is on the printed Packard charts: copy the cell", which tells Josh the measuring was optional.
- Silver, measured the same way: 5/10, ★☆☆.

**Dad's 12-line card printed: the content reads well; the print and wording need a pass.**
- Good: the twelve lines cover the right things (full stop at every STOP, ICE, "Stopped" / GO / "keep counting", the restart queue, green vs red signs, calibration silence, lost, GR signs, phones).
- The print:
  - "Print this card" produces one page of content and two blank pages (`dad-card.pdf`, 3 pages);
  - the title prints in pale orange;
  - the text is about 9 pt, about 420 words, and several lines carry three or four rules (line 6 has 50 words).
- The wording:
  - it calls the navigator "she" ("so she starts the stopwatch", "until she changes it", "She does the arithmetic"), but Josh is the navigator;
  - "no digital watch" sits awkwardly next to the digital stopwatch rule (REG II.H.1.d(2) bans a digital wristwatch).
- See `pt08-dad-card-print.png` and `pt08-protocol-card-screen.png`.

## 5. New bugs, ranked

| # | Sev | Bug | Steps / expected / actual | Evidence / file hint |
|---|---|---|---|---|
| N-B1 | **High** (education) | The Start-here path skips the lessons its own drills depend on | Follow the Next buttons from Home. **Expected:** the drill's "Read first" lesson comes before the drill. **Actual:** the path has 6 of 14 lessons. "Which timer, when" (D16, D01), "Pause arithmetic" (D03), "Timed segments" (D04), "Measure your car" (D06), "Early, late and the 10 % rule" (D08, D18) and "Calibration" (D07) are never offered; every Debrief's "Next on your path" goes straight to the next drill. Effect: D16 with 3 clock findings, and D08 ☆☆☆ for a card follower until he uses the 10 % rule the path never showed him (Bronze gives a pace aid but no make-up speed). | `09-home-after-d07.txt`, `run-d08-card2.txt`; `src/ui/viewmodels/curriculum.ts` START_PATH, the next-path buttons in `screens/debrief.ts` and `school.ts` |
| N-B2 | Medium | The path ends on a locked drill, and "Path complete" points at locked drills | After D07 at Bronze, Home shows "Next: D18 Miniature leg" while the D18 card says "🔒 Locked: needs D03 ★★, D04 ★★, D05 ★★, D08 ★★, D10 ★★, D16 ★ at Silver or Gold". The Next button opens D18 anyway. After D18: "Path complete. Take the whole-leg drills (D11) and the full stage (D12)"; D11 needs D18 ★ and D07 ★★ at Silver, D12 more. Nothing tells Josh to replay at Silver. | `pt08-home-after-d07.png`, `run-d18-card.txt` ("🔒 Next drill: D11"); `curriculum.ts`, `screens/home.ts` path-end text, `drills/staged.ts` unlocks |
| N-B3 | Medium | "Fast-forward to the start time" on a full start lands past the launch second | D08/D16 pre-read, press the button. **Expected:** stop before the 30-s warning, or at the launch. **Actual:** tod = own time (T-0.0), `secondsToLaunch` -5 (D08) / -4 (D16). The W/Q/count are skipped and no count shows. D one second later: Dad says "Rolling on time" while 6 s late against the launch. D16 caps a late launch at ★. It affects every full-start drill (D06, D08, D10, D16, D18, D11, stage). | `probe-ff-d08.txt`, `probe-ff-d16.txt`, `pt08-ff-d16-after-ff.png`; `src/ui/screens/cockpit.ts` `#skip` (full start), `sim.ts` depart message |
| N-B4 | Medium | D06 acceleration cells cannot be measured as coached; raw runs cannot be produced in the drill | D06 Bronze measured by the MARK texts. B1 (restart 0>50): the card launches 6 s early, so the measured value is 1 s against truth 6.4. B2/B3 (35>20, 40>25): the card's early call gives -0.5, which the Debrief flags as "a negative net loss, an outlier" and then "not noted". Silver gives the same picture (0>55 measured 0.2 against 8.9). The "const/acc/brk runs" notes need four passes over the same marks, which one run never offers. | `07-d06-bronze.txt`, `07-d06-silver-probe.txt`, `pt08-d06-bronze-debrief.png`; `src/core/drills/d06.ts` (B1 text, objective), `cockpitinfo.ts` (no launch lead or early call on d06 MARK sections) |
| N-B5 | Medium | D09 trap quiz contradicts the regulations and the lesson, and grades rule-matching | (1) Card "Right at "SMITH RD"": the right answer is "Quoted text must appear exactly (… spelling not)" with a ROAD/RD trap, but REG VII.D and the griid-cameo lesson say "there are no "traps" based on spelling". (2) The RR crossing card, named "Speed change at RR crossing", has the tip "A train is a Time Allowance: … declare the measured wait at the checkpoint", which is the pre-2026 paper method (2026: web form at the TA point within 15 min). (3) "Which statement is right?" while most options are true rules; card 17 offers both "Quoted text must appear exactly" and "Count only exact matches". (4) The Home card says "pick the exit". (5) Card 2's tip says "set the bezel to 15 minus your stop loss" on the digital-watch build. | `02-d09-dump.txt`, `pt08-d09-card1-play.png`; `src/core/generator/traps.ts` (quoted-sign-mismatch, rr-crossing, forgotten pause), `src/ui/screens/quiz.ts`, `drills/index.ts` D09 objective |
| N-B6 | Medium | D11 legal headline still says "go earlier" (N3 leftover) | See N3: dwells +0.3 ± 0.2; the +16 stop bucket is line 10's no-pause STOP (12.2 s). | `run-d11-legal.txt`; `rubrics.ts` basicRubric / drill tip (use `stopCauses`) |
| N-B7 | Medium-low | The D16 IN clock prompt fires at the start line | "Read the clock now (K) as you pass this sign: that is your IN time" is on the card from 09:52:56 (line 2 current), and the IN sign is at 09:55:14. K pressed when told does not count (the window is ±60 s). | `d16-k-probe.txt`; `cockpitinfo.ts` `clockReadPrompt` (show it only when the IN sign is in sight) |
| N-B8 | Medium-low | The compound STOP + timed instrument anchor disagrees with the card | Lap at the ghost's departure, Stopped + 11.8 s, as the card says. **Actual:** "Timed segment at line 4 had no stopwatch start or lap within 2 s of its anchor: count intervals on the stopwatch, never off the clock". The engine's anchor is the car's node crossing after GO. This denies the Clean run on a ★★★ run and tells Josh he used the clock when he did not. | `run-d04-retry.txt`, `run-d04-probe.txt`; `src/core/sim.ts` anchors (`nodeCrossTod` for pause + timed lines) vs `cockpitinfo.ts` `timed.fromGhost` |
| N-B9 | Medium-low | Dad's card print and wording | 3 printed pages (2 blank), pale orange title, "she" for the navigator, "no digital watch", lines of up to 50 words. | `dad-card.pdf` (scratch), `pt08-dad-card-print.png`; `content/lessons.ts` protocol card, `styles.css` `.print-card-only` |
| N-B10 | Low-Medium | A 10 %-rule make-up is blamed on the driver | D08b: 7 s made up at 38.5 and logged in the make-up box. Debrief: "Leg 1: ratio 1.022 -> -4.1 s … the driver wandered over the speed: call -1 sooner." | `11-d08b.txt`; `src/ui/viewmodels/debrief.ts` cruise rows (exclude logged make-up) |
| N-B11 | Low | Stale alert line | "Pulled up to the sign: wait for your launch time." still shows three minutes later while off course (D10) and at the D08b TA point. | `pt08-d10-retry-offcourse.png`, `11-d08b-donefirst.txt`; `cockpit.ts` flash timeout |
| N-B12 | Low | D10 off-course bucket double count | "(buckets sum +115, rounding residual -36)": off course +62 and turns +52. | `04-d10-retry.txt`; `debrief.ts` buckets, `sim.ts` off-course bucket |
| N-B13 | Low | Ledger box suggests a TA where none qualifies | "Hazard held you? Time it on the watch and press T to declare a TA" behind the slow truck in D08 (whose objective says never) and while off course in D10. | `probe-d08-makeup.txt`; `cockpit.ts` ledger box |
| N-B14 | Low | Turn call 500 ft out is spent on a distractor; the check-off is wrong at a T | D10: L called at 500 ft (the protocol's house habit). The side road 500 ft before the STOP-T takes it ("Too late, I can't make that left"). At the T Dad says "Straight on past line 4, you did not call a turn" although he turned left. | `run-d10-probe.txt`; `sim.ts` `processCheckoffs` (l.1502), `peekExit` |
| N-B15 | Low | Pre-read and card wording leftovers | (1) "expect the driver's warning about 30 seconds before": the navigator warns. (2) "Space starts the stopwatch; most navigators start it on the official second and run it as time-of-day all day", against "TOD (M) is your time of day … never read time of day off a running chrono". (3) "(set the bezel with ] )" on the digital watch. (4) The restart card says "leave at that second" under "launch … (minus 4 s)". (5) "fullStage #1" in the stage hint bar, pre-read and Debrief title. (6) "Drill start: no queue and no count" twice in the D01 pre-read. | `d16-bronze.txt`, `06-d01.txt`, `10-stage.txt`; `cockpit.ts` pre-read text, `cockpitinfo.ts` `holdCardFor` |
| N-B16 | Low | Small path and lesson gaps | (1) The D09 result offers only Again / Home, with no "Next on your path". (2) The prompt shows doubled quotes: `"Right at "SMITH RD""`. (3) The Four S's check tests TA arithmetic, not the priority order, and about 40 % of lesson 1 is TA procedure before Josh knows what a leg is. (4) The campaign standings show the benchmark totals (2.49, 11.12 …) with 0 stages played, though the note says "for the stages you have played". | `02-d09-play.txt`, `01-lessons.txt`, `13-campaign.txt` |

## 6. Where the Debrief advice was wrong or unhelpful

1. **D11 legal:** "Your stops cost more than the printed pause, so go earlier". Every dwell was within +0.6 s, and the loss is a no-pause STOP (N-B6).
2. **D04 by the card ★★★:** "count intervals on the stopwatch, never off the clock". He lapped the stopwatch exactly where the card said (N-B8).
3. **D06:** "accel/decel 35>20: a run of -0.5 s is a negative net loss, an outlier: delete it or re-run". The value is what following the card produces, and deleting or re-running will not change it. The Silver tip "Measure each pair again (four runs, average them …)" cannot be done in one run (N-B4).
4. **D08b:** "the driver wandered over the speed: call -1 sooner" after a deliberate, logged 10 % make-up (N-B10).
5. **D16 ★★:** the instrument line is right, but it points to a lesson the path never shows (N-B1).
6. **Helpful and right:**
   - D10 "Lost (LOST-001): turn-around 08:03:02, back at the junction 08:03:44: doubled = 84.6 s … Your 85 s is within 2 s".
   - D08 "Lights, trains or traffic cost you … 10 % rule (4 s lost at 35 -> 38.5 mph for 40 s)".
   - D08b "delayed 58 s by the train, 4 s could have been made up; you requested 50 s, the committee allowed 50 s".
   - D07 per-point read-offs and the k formula.
   - D06 stop & go and turn rows.
   - Stage rows "no pause printed … make the seconds up with the 10 % rule".

## 7. Confusing moments (in the order Josh meets them)

- **Home:** the path text says "staying on course … starting on time", the reverse of the Four S's he is about to read.
- **Lesson 1:** half of it is Time Allowance procedure (web form, 10-s multiples, witnesses), and the check question is about a tractor.
- **D09:** the screen says "Which statement is right?" and most options are true. Card 1's spelling trap contradicts what he read ten minutes earlier.
- **D10:** called "left" 500 ft out as the protocol says, Dad tried the side road. Later he watches an "offcourse" chip while the alert still says "Pulled up to the sign".
- **D16:**
  - the pre-read talks about "the ghost" and "pause minus your car's stop/start loss" before the ghost-car lesson;
  - "Read the clock now (K) as you pass this sign" sits on the card two minutes before the sign;
  - the big "Fast-forward to the start time" button makes him late.
- **D06:** "Chart pause time = your dwell + your seconds early/late against the 15 s pause" needs the pace aid, which the MARK text does not name. The B1 row says "leave on the second" while the card says "launch at minus 6 s".
- **D08:** ☆☆☆ three times with "recover a little more" before he finds P and the 10 % rule. The recovery lesson was never on his path.
- **After D07:** the path's Next is a drill whose card says 🔒.

## 8. Top-10 fixes (ranked; file hints)

1. **Route the path through the drills' lessons (N-B1).**
   - Put "Which timer, when" and "The ghost car" before D16, "Pause arithmetic" before D03, "Timed segments" before D04, "Measure your car" before D06, "Early, late and the 10 % rule" before D08 and "Calibration" before D07.
   - Or make "Next on your path" open a drill's unread "Read first" lesson first.
   - Files: `src/ui/viewmodels/curriculum.ts` START_PATH, the next-path buttons in `screens/debrief.ts` and `screens/school.ts`.
2. **Make the path's end honest (N-B2).**
   - Either count the path's Bronze stars toward D18's unlock, or add an explicit "replay D03/D04/D05/D08/D10 at Silver" step.
   - Do not open a locked drill from Next, and change "Path complete" to say what unlocks D11.
   - Files: `curriculum.ts`, `screens/home.ts`, `src/core/drills/staged.ts`.
3. **Full-start fast-forward (N-B3).** Stop at about T-40 s before the launch second (before the 30-s warning), never past it. Dad must not say "Rolling on time" when the car leaves after its launch second. Files: `src/ui/screens/cockpit.ts` `#skip`, `src/core/sim.ts` depart message.
4. **D06 measurable as taught (N-B4).**
   - On d06 MARK sections, print "leave ON the second / call AT the sign: you are measuring", with no launch lead or half-ramp lead.
   - Say plainly that the raw-run notes are for the real car, or add a "four passes" mode.
   - Decide whether Bronze is "copy the Packard" or "measure", not both.
   - Files: `src/core/drills/d06.ts`, `src/ui/viewmodels/cockpitinfo.ts`.
5. **D09 content (N-B5).**
   - Replace the spelling trap (REG VII.D).
   - Give the RR card the 2026 procedure (web form at the TA point within 15 min) and a matching name; drop "bezel".
   - Ask "Which rule decides this line?" and never show two applicable rules on one card; fix the objective and the doubled quotes; add "Next on your path" to the result.
   - Files: `src/core/generator/traps.ts`, `src/ui/screens/quiz.ts`, `src/core/drills/index.ts`.
6. **Debrief truth leftovers (N-B6, N-B8, N-B10, N-B12).**
   - The drill headline uses `stopCauses` (`rubrics.ts`).
   - The compound-line instrument anchor is the ghost's departure, as on the card (`sim.ts` anchors).
   - Cruise rows exclude logged make-up (`debrief.ts`).
   - Fix the off-course bucket double count.
7. **D16 prompts (N-B7, N-B15 restart line).**
   - Show the IN clock prompt only when the IN sign is in sight (`cockpitinfo.ts` `clockReadPrompt`).
   - Restart card: drop "leave at that second" (`holdCardFor`).
8. **Dad's card (N-B9).**
   - One printed page with no blank pages (`.print-card-only` must `display:none` the rest) and a dark title.
   - "the navigator" instead of "she"; "no digital wristwatch".
   - One rule per line, about 25 words.
   - Files: `content/lessons.ts`, `src/ui/styles.css`.
9. **Cockpit text hygiene (N-B11, N-B13, N-B15).**
   - Time out the alert line.
   - Show the ledger's TA hint only for a train, accident or tractor.
   - Fix "expect the driver's warning", "run it as time-of-day all day", the digital-watch "bezel" and "fullStage #1" (`stageDisplayName` in the cockpit and Debrief).
   - Remove the duplicate drill-start sentence.
   - File: `src/ui/screens/cockpit.ts`.
10. **Carried over from PT-07, plus the lesson-1 check.**
    - At Bronze, show the TA worksheet with Josh's own lapped delay beside the engine's.
    - Make lesson 1's check question test the S priority, and move most of its TA procedure to the recovery lesson.
    - Show no benchmark totals in the campaign before a stage is played.
    - At a T, Dad's check-off should say what he did ("Did the left at the T").
    - Files: `cockpit.ts` TA helper, `content/lessons.ts`, `screens/campaign.ts`, `sim.ts` `processCheckoffs`.

Ratings: realism 4.0/5, fun 4/5. Verdict on the curriculum build: **yes, with fixes 1-4 first.** The PT-07 debt is paid (16 of 18 fixed, 0 regressed, and the stage fits a laptop). The new course-first order is understood and D10 is a good drill. But the path skips the lessons its drills depend on, ends on locks, and has two traps early (the fast-forward overshoot and D06's accel cells).

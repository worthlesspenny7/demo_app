# Rally School 2.0: a guided, interactive, beginner-friendly course (Phase IX, 2026-11-22)

Josh after playing: the lessons are a wall of text that sucks the fun out; the full sim is overwhelming when
jumped into cold; he wants the School to expose every control and expectation slowly, with examples and
mini-sims, short enough to send to friends who have never heard of a TSD rally. Content is good; presentation
and interactivity are not.

## Principles
1. **Pages, not lessons.** A module is 4 to 8 swipeable pages. A page is one of four kinds and is never more than
   one screen on a phone: concept (<= 70 words + one picture), example (worked numbers, <= 50 words), mini-sim (one
   interactive card with one control), check (one tap). No page scrolls on a 390 x 844 screen.
2. **Teach, then do, immediately.** Every concept page is followed within two pages by a mini-sim that uses it.
3. **One control at a time.** Module n may use only the controls modules 0..n taught. The full run UI shows only
   controls already taught ("guided controls") until the course's core modules are done; the Desk cockpit is
   unlocked by the last module.
4. **References are links, not text.** A page carries at most two reference chips: "HB p.8" opens the handbook
   excerpt in a sheet; "REG V.H.3" opens the regulation text; "Video 2026 110:28" opens the transcript excerpt and,
   when the URL is known, the video at that second. Nothing from a reference is pasted into the page.
5. **Beginner first.** Module 0 assumes nothing: what a TSD rally is, what the Great Race is, how you score, what
   the navigator does. A newcomer should be able to finish Module 0 and 1 in ten minutes and want Module 2.
6. **Every module ends with a one-minute "try it" run** of 5 cards using only what has been taught, and a one-line
   "you can now ..." statement.

## The course (draft order; the content agent may adjust with reasons)
| # | Module | Teaches | Controls introduced | Mini-sims |
|---|---|---|---|---|
| 0 | What is a TSD rally? | ghost car, assigned speeds, hidden checkpoints, 1 point per second, Ace; the Great Race in two sentences; driver and navigator roles | none (watch a car vs the ghost) | "Hold 35": slide the car's speed, watch the seconds drift; "Where is the checkpoint?" tap when you think a leg ended |
| 1 | The book and the car | the five columns, CAMEO dot and arrow, Column C numbers, "which way" | the book row, next/previous | which way (3 rows), what speed (2 rows) |
| 2 | Calling the driver | ICE, read-backs, "mark", the stop count, GO | call a turn, call a speed, say GO | call the turn before the point; call the speed at the sign |
| 3 | The stopwatch | start, stop, lap; interval vs cumulative; the tap-watch | START/STOP, LAP | lap at three markers; read a split |
| 4 | Stops and pauses | the printed pause, the car's loss, the chart cell, sit N seconds, GO | the chart card (one cell) | tap GO at the chart second (three stops) |
| 5 | Speed changes and timed holds | split at the sign, lead = half the ramp, timed counts from the ghost's departure | the distance bar, Mark!, CALL | call at the Mark; START at the sign then CALL |
| 6 | The clock and starting on time | base + position, launch early by the start loss, the loose minute hand, watch TOD mode | the dash clock, TOD strip, LAUNCH | read the minute; tap the launch second |
| 7 | Staying on course | course before time, traps (sideroads, signs that are not the sign), lost procedure, the car behind as your clock | none new | which way with distractors; lost: what now |
| 8 | Early, late and recovery | the 10 % and 20 % rules, chunks, never inside a timed interval, shortening a stop | the make-up buttons | make-up choices (three cases) |
| 9 | Delays and time allowances | what qualifies, measured delay = stopped + chart loss, 10 s steps, the TA point and web form | the TA card | hazard choices; claim amount |
| 10 | Transits, lunch and restarts | advisory vs exact, IN + interval = OUT, lunch inside the transit, the queue at the sign | the hold card | OUT time; pull up when the car ahead leaves |
| 11 | Checkpoints and scoring | green vs red signs, never 5 mph or slower in sight of a green, caps, missed checkpoint, age factor | none | checkpoint choices; read a scorecard |
| 12 | Your first full run | what a run is, the daily set, meters, the Boss, Desk mode | all; Desk unlocked | a 10-card run with hints |

Modules 0 to 6 are the core: finishing them unlocks the unguided runs. Modules 7 to 12 unlock the rest.

## Interaction model
- Page navigation: swipe or tap-right for next, with a page dot strip; the module remembers the page.
- Mini-sim page: the decision card from phone mode (DecisionRunner, fixed seed, one kind) rendered with a
  pointer on the one control it teaches and a "why" line after the verdict; wrong answers get a second try with
  the rule shown; the page is complete after one right answer.
- Widget pages for Module 0 and 3 (slider, tap-to-lap) are small purpose-built components that read from the
  same engine (ghost time, perf table), not re-implementations of the rules.
- Reference chips open a bottom sheet: the excerpt (from docs/research extractions, stored as content/excerpts.ts),
  the citation, and an "open video at 110:28" button when content/videos.ts has the URL.
- Progress: per module (pages done, try-it stars) in the shared Storage; Home shows "Continue course" with the
  module and page.

## Validation targets (agent playtest at 390 x 844, as a newcomer)
- Module 0 + 1 finish in under 10 minutes with at least 8 interactions.
- No page over one screen; no page over 70 words; at most 2 chips per page; no reference text inline.
- A newcomer's first mini-sim within 90 seconds of opening the School.
- Every control used in the first unguided run was introduced by a module before it.
- Rubric (0-5): clarity for a newcomer, interaction density, fun, "I know what to do next", reference access.

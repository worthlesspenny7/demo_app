# Validation summary (for Josh) - Rally Trainer v1, 2026-10-03

Four independent validation passes were run on the built simulator by separate
agents, each with its own lens, after three bug-hunting playtests (protocol,
drills, UI). Every pass returned the same verdict: **yes, with fixes**. The
fixes they ranked highest were applied the same day (see "What changed after
validation"). The full reports are in this folder:

| Pass | Report | Score | Verdict |
|------|--------|-------|---------|
| Realism vs the Great Race | VALIDATION-realism.md | 47/70 before fixes | yes with fixes |
| Education (skills P1-P13) | VALIDATION-education.md | coverage matrix | yes with fixes |
| Playability + enjoyment | VALIDATION-playability-enjoyment.md | 32.5/55 before fixes | yes with fixes |
| UI bug hunt | PT-03-ui-bughunt.md | 0 crashes, 3 wrong-data, 10 confusing, 4 cosmetic | all fixed |
| Protocol/engine bug hunt | PT-01-protocol-bughunt.md | 26 bugs (2 HIGH) | HIGH/MEDIUM fixed |
| Drill curriculum playtest | PT-02-drills-education.md | 14 bugs | fixed |
| Re-validation after fixes | REVALIDATION-ui.md, REVALIDATION-education.md | (see files) | |

## What is confirmed to work
- The timing model is right: ghost car with instantaneous speed changes, pauses
  add their printed seconds, leg clock resets at every checkpoint, 1 point per
  second, Ace at zero, age factor 0.845 for 1939. The 1939 Ford preset loses
  7.6 s in a stop from 35 mph and takes 10 s from 0 to 35, matching the
  research (docs/research/07).
- The lessons transfer: naive play on the pause, timed-change, recovery and
  combo drills scores 0 stars; playing by the paper card (dwell = pause minus
  stop/start loss, call changes half a ramp early, count timed segments from
  the ghost's departure) scores 3 stars and aces. The debrief's "what if you
  had called go at X" counterfactuals were singled out by every reviewer as
  the best teaching device.
- A scripted "oracle" navigator with the expert driver scores 1-2 s per day
  on generated full stages (champion territory); the rookie bot scores 20-45
  s per day (the real rookie band), so the difficulty is calibrated to the
  research benchmarks.
- No crashes in any UI session; the engine never crashed under random input.

## What changed after validation (highest-impact first)
1. Turn calls made too late are now refused by the driver ("Too late, I can't
   make that turn") instead of a physically impossible speed snap; the UI tells
   you to call turns 500-600 ft out.
2. The calibration run is a transit followed by an official restart, so the
   first leg no longer scores the error you were still measuring.
3. Legal mode (Gold and full stages) hides every digital readout and the
   computed answer card: analog dials, your own annotations, nothing else.
4. The recovery rule was wrong in the lessons (v/5 + 1); it is now t = E x v / d
   (8 s late at 35 mph: hold 40 for 56 s). The 10%-for-10x rule is exact.
5. The debrief's headline tip is now chosen from the real largest cause and
   no longer blames the speedometer under a perfect Timewise.
6. Stops at a STOP sign track the stopped line automatically ("STOPPED HERE",
   wait X more s); restart holds are judged against the out-time, not as stops.
7. Hazard rates: at most one blocking train per stage; speed-limit signs never
   post less than the assigned speed; cross traffic at 15% of stops.
8. Stars per tier; a "Start here" path; resume after reload; 1280px layout.
9. Stage stars follow the research benchmarks (13 / 25 / 46 s per day).

## What is still open (be aware when you play)
- Unverified rules (docs/spec/OPEN-QUESTIONS.md): whether Column C prints
  cumulative times all day (Q1), calibration on the clock (Q14), pauses at
  signals (Q15), TA mechanics (Q16), the stock '39 speedometer's real error
  (Q21). The sim's defaults are documented; please confirm with the Rookie
  Handbook / regulations and tell me which to flip.
- Not yet taught or weak: the driver/navigator callout protocol (P10) is not
  scored; SCCA odometer-style rallies (P13) are reference-only; the Gold tier
  does not re-randomise the hidden car; stages are ~115-150 miles, shorter
  than a real 250-mile day.
- The web research budget ran out mid-way, so some rule details are from
  search snippets rather than the full PDFs (docs/research/*.md mark them
  UNVERIFIED). The MBCA PeachTube rally school video could not be read from
  this environment.

## How to start on Sunday
1. `npm install && npm run dev`, open http://localhost:5173.
2. Follow "Start here": School lesson 1, D01, D03 (naive once, then by the
   card), D04, D05, D08, D10, D18, then D11 and a full stage at Rookie.
3. Keep the Reference page open for the first evening; by D18 close it.

# Review: learning design and enjoyability - Rally Trainer v1 design

Reviewer role: learning-science + game-design critic (trainer/sim lens).
Reviewed: REQUIREMENTS.md (esp. §2 P1-P13), DESIGN.md (§14 drills, §16 UI),
SPECS.md (DRILLS, UI), research 05 §7, 03 §9, 06 "Implications".
Date: 2026-10-03. State of code: pre-engine (only units/rng/course), so every
change below is cheap now and expensive after Phase III-c.

Verdict in one line: the engine and scoring design is sound; the *trainer*
wrapped around it is a list of 14 isolated tests, not a curriculum. It will
teach the parts and then drop the learner off a cliff at D11, with nothing
that makes a solo player come back on day 4.

---

## 1. Does D01-D14 build P1-P13?

### 1.1 Coverage matrix

| Skill | Drill(s) | Verdict |
|---|---|---|
| P1 stopwatch handling | D01, D02 | Covered, but single-task only. The real failure is lapping *while* reading the next line. No "both hands busy" variant (03 §9.1). D02 shows a static dial; the real skill is reading a moving hand and the minute register during a 20-min calibration run. |
| P2 pause/stop with loss model | D03 | Covered, but **circular**: D03 needs the car's loss numbers and D06 (build the table) comes after it. DESIGN does not say where D03's numbers come from. Also no bezel-countdown variant (Rowland's actual method, 07 §2.1). |
| P3 timed changes | D04 | Covered. Missing the short-interval case (< 20 s, "start the watch before you finish reading", 03 §9.3). |
| P4 landmark speed changes | D05 | Covered. |
| P5 calibration | D07 | Covered **once**. This is consensus "what wins" #1 (03 §1.7) and it appears a single time before D12. The mechanical-speedo version (per-speed cheat card from a 50-mph-only run, i.e. extrapolation) is not a distinct drill, yet it is Josh's actual equipment. |
| P6 early/late ledger + recovery, TA | D08 | Thin. One drill, one CP. The ledger is the *continuous* background task of the whole day; there is no drill for "stop correcting before likely CP spots", none for not overshooting into early, and **no Time Allowance drill at all** although the train stop is the single most concrete rookie loss in the sources (06 §6.2, 48-s leg). |
| P7 instruction reading under load | none | **Gap.** The official #1 skill (03 §1.6). There is no pre-read/triage drill (03 §9.6, 06 #1), no read-ahead protocol drill, and the UI shows the whole book, road and watch at once, so the "look down" cost that P7 is about does not exist in the sim. |
| P8 traps / course following | D09, D10 | Covered. D10's rubric is "off-course events"; it should score *time-to-detect* ("landmark did not appear") because that is the recoverable skill. Wrong-way start (06 #2) not present. |
| P9 TOD discipline | none | **Gap.** No out-time/bezel drill, no minute-rollover case, no lunch-restart drill except implicitly inside D12 (03 §9.7 asks for exactly this; whole-minute catastrophes). |
| P10 protocol | none (implicit) | **Gap.** Dad reads back, but nothing is scored: no "call the next landmark before looking down", no penalty for a turn callout issued after the decision point. |
| P11 endurance / score interpretation | D12, D13 | Covered for endurance. Score interpretation (06 #10: what 2/13/21/46 s mean) is nowhere in the drills or the result screen except a "division ladder" label in D13. |
| P12 performance-table building | D06 | Covered. Missing "sanity check your charts" (06 #8): an injected implausible row the learner must spot. "Free runs" is unstructured; the sources say >= 4 runs per speed. |
| P13 SCCA mode | D14 | Fine as secondary; but D14 is pure arithmetic and is sequenced last when it should be a parallel track from day 1. |

Also missing against the research-prioritised lists: stopwatch-loss recovery
(03 §9.8), checkpoint-density surprise (06 #4), checkpoint approach discipline
(hold speed through the sight zone, 06 #5), observation-checkpoint stop (06 #6).

### 1.2 Ordering problems

1. **D03 before D06** (circular). Fix: D03 tier 1 hands the player a printed
   card for a *known* car; D06 builds the card for a hidden car; D03 tier 3
   re-runs with the player's own card on a re-randomised car (03 §9.2 "learn
   to read the table, not memorise one number").
2. **D09 Trap quiz is gated like a timing drill.** It needs no timing skill;
   make it available from minute one as the "coffee-break" track. Same for
   D14.
3. **D11 unlock = 2 stars on D03, D04, D07** but D11 will contain hazards and
   traps the learner has only seen in D08/D10 once. Either D11a is a clean
   leg (no traps, no hazards, expert driver) and D11b adds them, or the gate
   includes D08 and D10.
4. **D07 before D06?** Fine as-is; both are measurement drills. But D07 must
   come again as the *opening* of every D12/D13 stage, not as a one-off.
5. **D08 (recovery) assumes a working ledger** that was never taught: the
   ledger needs its own short lesson + drill before recovery.

### 1.3 Repetition and transfer - the cliff

The design has isolated part-tasks (D01-D10) then whole-task (D11-D13) with
no bridge. Flight trainers and Duolingo both avoid this with (a) *interleaved*
part-task combos and (b) *progressive de-scaffolding*, neither of which is
specified:

- Aids are binary: ON for D01-D05, OFF for D11+ (DRILL-005). D06-D10 are
  unspecified. There must be a graded aids ladder (see CR-2) and every drill
  must be playable at each rung.
- Nothing is repeated. A drill with 3 stars is "done". Stopwatch jitter,
  pause arithmetic and card reading are motor/retrieval skills that decay in
  days; they need a 5-minute daily warm-up set with re-randomised parameters
  (CR-5).
- No combo drill. Add D18 "miniature leg": 4-6 minutes, one of everything
  (stop, timed change, landmark change, trap, hazard, hidden CP). This is the
  single highest-value addition; it is where transfer happens.

### 1.4 Feedback loops

- In D01-D05 the per-event error is immediate. Good.
- In D11+ the only feedback is the CP error and the debrief. For training
  tiers the CP crossing should pop a 3-second card ("+7 late; biggest: stop
  #43 +4") - immediate feedback is the proven learning accelerator (05 §7.1);
  hide it only at the "legal" rung.
- No *in-run* ghost. In tier 1 of D03/D04/D05 render the ghost car as a
  translucent car on the road view so the learner *sees* why "34 not 36".
  Remove it at rung 2.
- The driver should "check off" executed lines ("Right at the stop, done")
  so losing your place in the book is detectable within one line, not three
  miles later (02 §4.1 Gary Starr: the driver checks off).

---

## 2. Enjoyability: what keeps a solo engineer playing for two weeks

### 2.1 The macro loop that is missing

There is a date (June 2026) and a car. The game should be *"get this crew
ready"*. Concretely:

- **Readiness meter** on Home: 12 skill ratings (P1-P12), each 0-100, each
  an exponentially-weighted average of recent drill performance with decay
  (a skill untouched for 5 days visibly fades). Readiness = weighted
  minimum, not mean, so the weakest skill is always the obvious next thing.
  This is the "type rating" progress bar of flight trainers, and it gives a
  reason to open the app every day.
- **Division ladder against bots on the same seed.** Every stage/leg result
  is placed against the scripted bots (random, rookie, sportsman, expert,
  oracle) run on the identical seed, labelled with real benchmarks: Rookie
  day 20-46 s, best rookie 13 s, Grand Champion ~2 s (06 §4). Promotion =
  three consecutive stages under the division line; demotion is possible.
  This also implements P11 "score interpretation" for free.
- **Aces wall.** Real Great Race aces are stickers on the car. Render the
  1939 Ford on Home with one sticker per ace, grouped by stage. Zero-second
  legs are rare enough to be a thrill and common enough (4-7 CPs/day) to
  happen.
- **Personal bests and streaks** per drill (already in U2) plus two that
  matter more: "stops without a missed pause" and "legs without going off
  course", because those are the catastrophes.

### 2.2 Session design

- **Daily set (10-12 min):** 3 warm-ups (20 stopwatch laps -> sd; 6 pause
  computations with a random card; 10 trap cards) then one "focus" drill
  chosen by the readiness meter. This is the Duolingo shape and it fits a
  weekday evening.
- **Long session (45-90 min, weekends):** one leg (D11/D18) or one stage
  chunk. A full stage at 1x is 6-8 h; at 4x still 1.5-2 h. **Stages must be
  resumable at leg boundaries and at lunch**, with the lapboard, ledger and
  card persisted. Nobody will finish a D12 otherwise.
- **Adaptive time scale** instead of a fixed 1x-8x knob: run at up to 4x
  while nothing is in sight and no countdown is within 15 s; drop to 1x
  automatically when a feature enters sight range, a stopwatch target is
  near, or a hazard starts. Reaction tasks stay honest at 1x; the dead cruise
  is compressed. Make it default for every drill below D12-legal.

### 2.3 Dad

Dad is the only other character and the main source of texture. Minimum
viable personality (text + optional speech synthesis, no audio assets):

- Read-backs in his words ("Thirty-six, holding." / "Right at the stop,
  got it."), 2-3 variants each so it does not feel robotic.
- Situation lines that are *also* training cues: at a T with no call: "Left
  or right, bud?"; after a long dwell: "That felt like a long fifteen";
  after a wrong turn detected late: "Haven't seen a sign in a while";
  passing a CP crew: "There's one." Keep them short; never mid-countdown.
- Selectable skill (rookie/sportsman/expert) and a **trust meter**: the more
  consistent the navigator's callout timing, the fewer "Going?"/"Which way?"
  prompts and the shorter his hesitation at ambiguous intersections. Do NOT
  tie trust to speed-hold accuracy; that would make the physics feel rigged.
- He checks off lines ("Did the stop; next is the curve sign?") - the real
  driver does this and it is the best anti-lost-my-place mechanic.

### 2.4 Surprise and difficulty

- Hidden CPs, trap density, hazard luck and speedo drift already give
  variance. Add the two **documented surprises**: a 12-CP day (06 #4) and
  the wrong-way start (06 #2), each unlocked once the learner is at
  Sportsman so they are earned, not random abuse.
- Three tiers per drill (Bronze/Silver/Gold = aids rung 3/2/1 + driver
  skill expert/sportsman/rookie). Stars are per tier; Gold-3-star is the
  mastery signal. This gives every drill replay value without new content.
- Difficulty knobs from 07 §9.5 (lines/mile, pause count, signal luck,
  speedo nonlinearity, reaction noise, CP count) should be exposed as a
  "profile" string on the result card so a hard run reads as hard.

### 2.5 What will make it boring or frustrating, and the fix

| Risk | Fix |
|---|---|
| Real-time cruise with nothing to do | Adaptive time scale (2.2); in training tiers a ledger prompt every ~2 min ("where are we? +/-") that is scored. |
| 250 instructions of mostly turns | Only D12/D13 use the full density; D11/D18 use 25-40 lines. Dad checks off lines. Book shows current + next 2 lines large (UI §4). |
| Unclear "why was I 7 s late" | Immediate CP card in training tiers; attribution + worked arithmetic in debrief (§3). |
| Being lost for miles with no signal | Dad's "haven't seen a sign" after N minutes without a landmark (training tiers only); `call.uturn` always available; off-course excursions capped at 1.5 mi already. |
| Accidental stopwatch reset (R key) | Reset requires a chord/long-press; see §4. |
| Analog 1/5-s dial unreadable on a laptop | Stopwatch >= 240 px, zoom on hold key; digital variant allowed at Bronze. |
| Mechanical speedo bounce feels random | Bounce amplitude must be visibly periodic (sinusoid, not noise) so averaging by eye works; show the Timewise first. |
| "Done" after 3 stars, nothing left | Tiers + daily set + ladder (2.1-2.4). |
| Long stage lost to a browser tab close | Resume at leg boundaries (2.2); autosave every CP. |

---

## 3. Debrief design

The debrief is where learning actually happens; it deserves its own design
section (DESIGN §18 proposed). Content, top to bottom:

1. **Headline card (fits without scrolling).** Per-CP rows: actual, perfect,
   error, ace flag; stage raw, age-factored, division placement vs bots on
   this seed; **one** "fix this next" sentence derived from the largest
   attribution bucket with a systematic sign (e.g. "Your 'go' calls average
   2.1 s late - react on 'one', not 'go'"). One tip, not a list.
2. **Seconds-lost-by-cause** stacked bar per leg (ATTR buckets). Click a
   bucket to filter the timeline below.
3. **Timeline e(t) = t_car - t_ghost** across the leg, with every maneuver
   and hazard as a marker; CP crossings as vertical lines where e resets.
   Hover/click a marker opens the worked arithmetic for that event.
4. **Worked arithmetic per maneuver** (U4 "worked solution", made concrete):
   - Stop #43: entry 35 / exit 40; card says loss 7.2 s; correct dwell =
     15 - 7.2 = 7.8 s; you called go at 11.1 s; +3.3 s. Shows the exact
     dwell-vs-ghost speed-time diagram (two profiles, shaded area = lost
     distance).
   - Timed change #58: T = 36, ramp 30->40 = 4.0 s, call at 34.0; you
     called at 36.4; +0.6 s at 40 mph.
   - Cruise segment: mean true speed 34.7 for assigned 35 -> ratio 0.991 ->
     8 s over this 15-min leg -> "your card is 0.3 mph low at 35".
5. **Counterfactuals** (the single most convincing teaching device; cheap
   because SIM-007 makes the action script replayable). Re-run the sim with
   substituted actions and show the resulting CP error for each:
   "If you had called go at the card dwell at every stop: +1 (was +7)";
   "If your calibration card were exact: -2"; "If the train had not
   happened / if you had declared the 92-s TA: 0"; "If you had held the
   speed through the CP sight zone: ...". Three to five rows, always the
   same order, each a replay button.
6. **Bias vs noise by maneuver type** (the "heatmap"): rows = stop / timed /
   landmark change / turn / cruise / CP approach; columns = mean error and sd
   over this run and over the last 10 runs. Bias is fixable by a number on
   the card; noise is fixable only by practice. Say which it is.
7. **Reading errors as their own list**: missed pause, wrong turn, line
   lost (time between Dad's check-off and your line.set), late turn callout
   (issued after the decision point). These are not timing errors and must
   not be buried in buckets.
8. **Replay**: scrub the timeline; road view shows both cars; the book
   highlights the current line; stopwatch replays. 2x/4x/8x.
9. **Trend across runs** (small): sd of stopwatch reaction, card accuracy,
   aces per stage, division position. This is the mastery signal.

Rule: in training tiers the per-CP card appears at the crossing; at the
"legal" rung all of the above appears only after the stage, as in reality.

---

## 4. UI/UX critique of the cockpit and keyboard

### 4.1 The cognitive task the layout must model

The real task is eyes on the road, stopwatch in hand, book on the lap, and
the *cost* is the look down. On a laptop everything is visible at once and
the look-down cost vanishes, which means P7 is untrained and the sim feels
easier than the car. The current layout (road top, instruments left, book
right, callouts/log/lapboard bottom) also puts the stopwatch - the one
instrument the navigator holds - in a corner, far from the road view.

### 4.2 Proposed layout (laptop, 1366x768 minimum)

```
+-----------------------------------------------+------------------+
| ROAD VIEW (full width of left pane, ~45% h)   | GRIID BOOK       |
|   pending callout + Dad's read-back overlaid  |  prev line small |
|   bottom-left; pace bar (aid) bottom-right    |  CURRENT line xl |
+----------------+----------------+-------------+  next 2 lines lg |
| CLOCK + bezel  | STOPWATCH      | SPEEDO      |  rest dimmed     |
| (large)        | (largest, >=   | (small,     |  (hold Tab for   |
|                |  240 px, lap   |  driver's   |   full page;     |
|                |  list below)   |  gauge)     |   road dims)     |
+----------------+----------------+-------------+------------------+
| LAPBOARD drawer: ledger +/- | perf card | cheat card | notes     |
+------------------------------------------------------------------+
```

Reasons: stopwatch next to the road because that is the eye path; speedo
small because "drive to the clock, not the speedo" (03 §3.5) and it is the
driver's gauge; book shows a 4-line window because that is what a lap-held
page gives you between glances; the full page behind a held key simulates
the look down (at Gold rung the road view dims and newly visible features are
not announced while the page is open). Driver log is not a panel: the last
line of Dad's speech is an overlay on the road; the full transcript lives in
the debrief.

### 4.3 Keyboard

Current: Space start/stop, L lap, R reset, 1-9 speed presets, arrows L/R/S,
B bear, G go, U u-turn, T TA, N next line.

- **R reset is a landmine.** One slip mid-leg destroys the run (and the real
  pusher needs a deliberate press). Reset = Shift+R or hold R 600 ms, with
  on-screen confirmation.
- **1-9 presets cannot express a cheat card.** Assigned speeds are 20-50 by
  5 but the indicated value Josh calls is 36 or 36.5. Replace with: digits
  type a number, Enter calls it, Up/Down nudge by 1 (mechanical) or 0.5
  (Timewise); if `useCard` is on, typing the assigned speed shows the
  card's indicated value before Enter.
- **Turn vocabulary is incomplete**: no acute, no jog. Arrows for L/R/S,
  B+arrow bear, A+arrow acute, J+arrow jog. Show the pending callout queue
  on the road view with a 150-ft decision-point marker so "late callout" is
  visible, not mysterious.
- Space start/stop and L lap are right. Add **Enter on the stopwatch = lap**
  as an alternative so the right hand can stay on the arrows.
- N next line is fine; add P previous and Home/End. Do not auto-advance in
  legal rung (keeping your place is the skill); Dad's check-off is the
  realistic scaffold.
- Add: `+`/`-` time scale, `Esc` pause, `Tab` hold = full book page, `H`
  hold = zoom stopwatch.
- **Audio is not optional** for an eyes-on-road task: watch click on
  start/stop/lap, Dad's read-back via speechSynthesis (free in browsers),
  3-2-1 beeps as an aid, train/light sounds. Keyboard-only without sound
  forces eyes onto the watch to confirm every press.

### 4.4 Pre-read phase has no UI

SIM-006 gives 30 min of pre-read, but there is nothing to *do* in it. Add
book annotation: highlighter colours (pause / speed / turn / quoted sign per
02 §4.1), a "GO at" scratch column next to pauses, and a cheat-card panel.
Annotations persist into the run. This is where P7 is trained and it is
free content.

### 4.5 Analog instruments

- Stopwatch: 30-s or 60-s sweep selectable (McKelvie prefers the 30-s dial
  for readability); 1/5-s ticks need >= 240 px to read; rotating countdown
  bezel on the stopwatch (Rowland's actual pause method) is missing from
  DESIGN §8 - add `stopwatch.bezel.set`.
- Clock: the bezel is there; add a "set bezel to next restart seconds"
  affordance and show bezelRemaining as a hand, not a number, at Gold rung.

---

## 5. Change requests (CR) with proposed spec text

New ids continue existing sequences (DRILL-006+, UI-009+, SIM-018+, DRV-013+,
SCORE-010+) plus new families PROG-, DEBRIEF-, ATTN-.

### CR-1 DESIGN §14: rewrite the drill list

Replace the D01-D14 list with the following (keep ids stable, add D15-D20,
tracks and tiers):

```
Tracks: TIMING (D01-D08, D15-D19), COURSE (D09, D10), ARITH (D14, D02),
WHOLE (D18, D11, D12, D13). ARITH and COURSE tracks are open from the start.
Every drill has three tiers (Bronze/Silver/Gold) = aids rung 3/2/1 and
driver expert/sportsman/rookie; stars are recorded per tier.

D01 Stopwatch reaction: lap at the sign; score |error| and sd; Gold variant
    requires typing the next line's turn letter between laps (dual task).
D02 Reading the dial: moving sweep hand, minute register, 30/60-s dials,
    bezel countdown; also "is the 15 up yet?" questions.
D03 Pause execution: tier Bronze with a printed card for a known car; Gold
    with the player's own card on a re-randomised hidden car; bezel method
    or count method; includes 2 red-signal pauses (burn now vs ledger).
D04 Timed speed changes: 8 changes incl. >= 2 with T < 20 s.
D05 Landmark speed changes: lead-time practice; leading-edge convention.
D06 Build your performance table: structured 4 runs per speed for stop loss
    and ramp lead; enter table; score vs truth; then a sanity-check quiz
    with one injected implausible row to find.
D07 Calibration run: (a) Timewise: compute k, set factor; (b) mechanical:
    per-speed cheat card extrapolated from a 50-mph run plus one 35-mph
    interval; run a 10-min leg; score leg error and card error.
D08 Ledger and recovery: (a) ledger: injected disruptions, state the running
    offset at prompts, choose +5/+10 plan, do not overshoot early, stop
    correcting before a CP zone; (b) Time Allowance: signals and a train,
    time the stop, declare TA at the CP; over/under-declaration scored.
D09 Trap quiz (static, 20 cards) - open from start.
D10 Course following in motion: 15 lines with distractors; score off-course
    events AND time-to-detect; includes one wrong-way start scenario.
D11 Full leg: (a) clean (no hazards, no traps, expert driver), (b) real
    (hazards, traps, sportsman driver). 25-40 lines, one hidden CP.
D12 Full stage: resumable at leg boundaries and lunch; opens with D07 as its
    calibration section every time; 12-CP surprise variant at Sportsman+.
D13 Campaign: Trophy Run + 9 stages, age factor, division ladder.
D14 Mental math: seconds arithmetic, dwell = pause - loss, recovery factors,
    s/mile; 60-s rounds; open from start.
D15 Pre-read triage: a 20-30 line page, 3 min (scaled) to highlight pauses,
    speed changes, turns and write GO times; then run it; score missed
    marks and cold-read execution.
D16 Time-of-day discipline: out-time with seconds, set bezel, leave on the
    minute; minute and hour rollover; lunch restart; stopwatch-as-TOD.
D17 Stopwatch loss recovery: watch reset mid-leg by the sim; re-derive from
    clock + Column C at the next landmark; score time-to-recover.
D18 Miniature leg (combo): 4-6 min with one stop, one timed change, one
    landmark change, one trap, one hazard, one hidden CP. Gate for D11.
D19 Checkpoint approach: hold speed through blind corners and town entries;
    sight-zone rule; observation CP stop at the finish.
D20 Protocol: call the next landmark before opening the book (Tab); turn
    callouts before the decision point; read-back acknowledged; scored.
Daily set: 3 warm-ups (D01 x20, D03-arith x6, D09 x10) + readiness-chosen
focus drill; ~10 min.
```

### CR-2 SPECS DRILLS: unlock rules, aids ladder, tiers

```
DRILL-004 (replace) Curriculum unlock: D09 and D14 are unlocked at start;
  D18 requires 2 stars (any tier) on D03, D04, D05, D08a, D10;
  D11a requires D18 passed and 2 stars on D07; D11b requires D11a passed and
  D08b, D19 passed; D12 requires D11b passed and D15, D16 passed;
  D13 requires D12 passed.
DRILL-005 (replace) Aids ladder: rung 3 = pace bar numeric + 3-2-1 cue +
  cumulative perfect times printed + ghost car rendered + immediate CP card
  + Dad's lost prompt; rung 2 = pace bar coarse (early/late arrow only) +
  3-2-1 cue + immediate CP card + Dad's check-off; rung 1 = Dad's check-off
  only; rung 0 = "Great Race legal" (none; perfect times on the calibration
  run only). Bronze/Silver/Gold tiers use rungs 3/2/1; the legal mode uses
  rung 0 and cannot enable any aid.
DRILL-006 Every drill has three tiers (Bronze, Silver, Gold) that set the
  aids rung and driver skill; stars are stored per tier; the drill card shows
  the best tier reached.
DRILL-007 D18 scenario factory produces, deterministically per seed, exactly
  one of each: STOP with Pause, timed segment, landmark speed change, trap
  node from the library, hazard (signal or slow vehicle), hidden timing CP;
  duration 4-6 min of ghost time.
DRILL-008 D15 rubric: score = marked pauses / total pauses, marked speed
  changes / total, GO-time arithmetic errors, plus run execution misses;
  3 stars if all pauses marked and no GO-time error > 1 s.
DRILL-009 D16 rubric: whole-minute error at the start/restart = fail
  regardless of seconds; 3 stars if |departure - out-time| <= 1 s on all
  cases including a minute rollover and an hour rollover.
DRILL-010 D17: the sim issues a forced watch reset at a random point between
  two landmarks; rubric scores seconds until elapsed is re-established
  within 1 s of truth (via clock + Column C) and the residual CP error.
DRILL-011 D20 rubric counts (a) book opened (Tab held) with no landmark
  called in the previous 20 s, (b) turn callouts issued after the decision
  point, (c) callouts not acknowledged; 3 stars at zero of each.
DRILL-012 Daily set: three warm-ups re-randomised per calendar day with
  per-day best; completion increments a daily streak stored with progress.
```

### CR-3 Progression (new family PROG, DESIGN §19 "Progression and
meta-game")

```
PROG-001 Skill ratings P1..P12 are each 0-100, updated after every run as an
  exponentially weighted average (alpha 0.3) of the run's normalised score
  for the skills the drill maps to, and decay 2 points per idle day after
  3 days.
PROG-002 Readiness = weighted minimum of skill ratings (weights from
  REQUIREMENTS §2 priority: P1-P8 weight 1, P9-P12 weight 0.5); Home shows
  readiness and names the lowest skill as "next".
PROG-003 Division ladder: each stage result is compared with the bots random,
  rookie, sportsman, expert, oracle run on the same seed and driver; the UI
  shows the player's position and the real benchmark labels (Rookie 20-46
  s/day, best rookie 13, Grand Champion ~2); promotion after three
  consecutive stages below the division line; demotion after three above.
PROG-004 Aces are stored with stage id and CP id and rendered as stickers on
  the Home car; total aces and "aces this stage" appear on the result card.
PROG-005 Streaks: "stops without a missed pause" and "legs without going off
  course" are tracked across runs and shown on Home; a miss resets them with
  the number achieved recorded as a best.
PROG-006 Full stages (D12/D13) are resumable: state is autosaved at every CP
  crossing and at lunch, including lapboard, ledger, card and annotations;
  resume reproduces identical result() for the same actions (deterministic).
```

### CR-4 Adaptive time scale and attention model

```
SIM-018 Adaptive time scale: when options.adaptiveTimeScale is on, the
  effective scale is min(maxScale, 1x whenever any feature is within sight
  range, a hazard is active, a stopwatch countdown target or bezel index is
  within 15 s, or a CP sight zone is active); no node, hazard or CP event may
  occur while the scale is above 1x within 10 s of its visibility onset.
SIM-019 Replay: act log + scenario reproduce observe() frames; a replay
  cursor can be set to any TOD and the view model renders both cars.
ATTN-001 Book focus: act('book.open') / act('book.close'); while open at
  aids rung <= 1, observe().ahead omits sign text and new features are
  marked unannounced=true until closed; the UI dims the road view.
ATTN-002 Look-down log: every book.open interval is recorded with TOD so
  the debrief can list "book open while a landmark came into sight".
```

### CR-5 Driver ("Dad")

```
DRV-013 Check-off: on executing an instruction (turn taken, pause done,
  speed reached) the driver emits a check-off message naming the line
  ("Did the stop, forty-three"); observe().driver.lastExecutedLine carries n.
DRV-014 Lost prompt (aids rung >= 2): after 4 minutes with no route landmark
  passed while off course the driver says "Haven't seen a sign in a while".
DRV-015 Personality: read-backs and questions are drawn from >= 3 phrasing
  variants per intent, seeded; no driver speech is emitted during an active
  3-2-1 countdown.
DRV-016 Trust: a 0..1 value rising with on-time callouts (turn before the
  decision point, go within 2 s of card dwell) and falling with late ones;
  it scales the frequency of "Going?"/"Which way?" prompts and the driver's
  hesitation time at ambiguous intersections (0.5-3 s); it never changes
  speed-hold error.
DRV-017 Late callout: a turn callout received after the decision point is
  still executed if the car can (speed <= turn cap) but is logged as
  lateCallout with the overshoot in feet; otherwise the driver stops and
  asks, and the stop is attributed to 'turn'.
```

### CR-6 Debrief (new family DEBRIEF, DESIGN §18)

```
DEBRIEF-001 Headline view-model: per-CP rows (actual, perfect, error, ace),
  stage raw and factored, division placement vs same-seed bots, and exactly
  one tip string chosen from the largest attribution bucket whose per-event
  mean has |mean| > sd (systematic), else from the largest sd bucket.
DEBRIEF-002 Worked arithmetic: for every stop, timed change and landmark
  change the view-model yields {cardValue, correctCall, yourCall, delta,
  formulaText} e.g. "dwell = 15 - 7.2 = 7.8 s; you called go at 11.1 s;
  +3.3 s"; for every cruise segment {assigned, meanTrue, ratio, secondsOver,
  cardCorrection}.
DEBRIEF-003 Counterfactuals: the debrief re-runs the scenario with the
  player's action log modified by each of: (a) go calls at card dwell, (b)
  calls at T - rampLead, (c) exact calibration card, (d) qualifying hazards
  fully declared as TA, (e) no sight-zone slowdown; each yields per-CP error
  and is replayable; ATTR-001 holds for each run.
DEBRIEF-004 Bias/noise table per maneuver type (stop, timed, landmark,
  turn, cruise, cpApproach): mean and sd for this run and for the last 10
  runs, with a label 'bias' (|mean| > sd) or 'noise'.
DEBRIEF-005 Reading errors list: missed pause, wrong turn, late turn callout,
  line lost (line.set lagging DRV-013 check-off by > 1 line for > 60 s),
  forgotten TA declaration; each with the line number and TOD.
DEBRIEF-006 Immediate CP card: at aids rung >= 2 a CP crossing yields a
  card {error, largestBucket, largestEvent} for 3 s of sim time; at rung
  <= 1 nothing is shown until the debrief.
DEBRIEF-007 Trend: the debrief shows sd of stopwatch reaction (D01), card
  accuracy (D06), aces per stage and division position over the last 10
  runs from localStorage.
```

### CR-7 UI (DESIGN §16 replace the layout paragraph; SPECS UI-009+)

```
UI-009 Cockpit layout: road view spans the left pane top (>= 45% height);
  below it clock (left), stopwatch (centre, largest, >= 240 px dial), speedo
  (right, smaller); the GRIID book is a right column showing previous line
  small, current line extra-large, next two large, rest dimmed; the
  lapboard is a bottom drawer; Dad's last line and the pending callout
  queue with a decision-point marker are overlaid on the road view.
UI-010 Stopwatch dial: selectable 30-s or 60-s sweep, 1/5-s ticks, minute
  register, countdown bezel (act 'watch.bezel.set'); H held zooms the dial
  to 2x; lap list below the dial shows the last 3 laps.
UI-011 Keyboard: Space start/stop; L or Enter lap; Shift+R or R held 600 ms
  reset (with confirmation flash); digits type a speed, Enter calls it,
  Up/Down nudge by 1 (mechanical) or 0.5 (Timewise); arrows L/R/S, B+arrow
  bear, A+arrow acute, J+arrow jog; G go; U u-turn; T TA; N/P next/prev
  line; Tab held opens the full book page; +/- time scale; Esc pause.
UI-012 Speed entry with useCard shows the card's indicated value for the
  typed assigned speed before Enter and calls the indicated value.
UI-013 Audio: watch click on start/stop/lap, Dad's speech via
  speechSynthesis when available (text fallback), 3-2-1 beeps when the aid
  is on, train and signal sounds; a mute toggle; the Playwright smoke test
  runs muted.
UI-014 Pre-read annotation: during phase 'preread' the book supports four
  highlight colours, a GO-time column next to pauses, and a cheat-card
  panel; annotations persist through the run and appear in the debrief.
UI-015 Pace bar (aid) is drawn on the stopwatch bezel area, not as a
  separate widget; coarse mode shows only an early/late arrow.
UI-016 Book focus dims the road view and hides sign text per ATTN-001.
UI-017 Readiness, skill ratings, aces wall and streaks render on Home from
  localStorage (PROG-001..005); the lowest skill links to its drill.
UI-018 Resume: Home offers "Resume stage" when PROG-006 state exists.
```

### CR-8 Scoring / result card

```
SCORE-010 Every stage result carries benchmark labels: the raw day score is
  classified against {champion <= 3, expert <= 13, sportsman <= 25, rookie
  <= 46, blown > 46} and the result card shows the label and the nearest
  bot's score on the same seed.
```

### CR-9 Small DESIGN text fixes

- §8: add a rotating countdown bezel to the stopwatch (Rowland's method),
  and a `watch.bezel.set` action in §9.
- §14 last line: replace the binary aids statement with the ladder in
  DRILL-005.
- §16: replace "1-9 speed presets" with numeric entry (UI-011); add audio.
- §7: add check-off, lost prompt, trust, late-callout handling (DRV-013..017).
- Add §18 Debrief, §19 Progression, §20 Attention model, each pointing to
  the spec families above.
- OPEN-QUESTIONS: add Q14 "Does the Great Race navigator typically use a
  countdown bezel on the stopwatch (Rowland) or count?" (affects D03 UI).

---

## Priority order if time is short

1. D18 combo leg + the aids ladder (DRILL-005/006/007) - transfer.
2. Debrief worked arithmetic + counterfactuals (DEBRIEF-002/003) - learning.
3. Adaptive time scale + resumable stages (SIM-018, PROG-006) - playability.
4. Readiness meter + division ladder + aces wall (PROG-001..004) - retention.
5. Keyboard fixes (UI-011) and stopwatch size (UI-010) - frustration.
6. D15/D16/D20 (pre-read, TOD, protocol) - the three uncovered skills.
7. Dad check-off and lines (DRV-013..016) - texture.
8. Book focus / attention model (ATTN-001) - fidelity of P7, last.

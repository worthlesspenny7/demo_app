# REQUIREMENTS - Rally Trainer (Great Race style TSD navigator simulator)

Distilled 2026-10-03 from docs/research/00..07. Each requirement cites its
source doc (R01 = docs/research/01-..., etc.). Confidence: [V] sourced from
rule text / multiple sources, [S] single source or paraphrase, [M] model
knowledge or inference (UNVERIFIED; implement as configurable default).

## 0. Who / why
- Learner: Josh, engineer, will navigate a 1939 Ford Deluxe for his dad
  (driver) and brother in the Great Race (June 2026, Route 66 centennial,
  9 stages + Trophy Run). [V R01 §4]
- Equipment the learner EXPECTS: rally book, mechanical stopwatch, calculator.
  REALITY: calculators are prohibited ("any calculating device ... is
  prohibited, except as specifically allowed"); phone calculator prohibited by
  name. One stopwatch per team (digital OR analog, split allowed). One analog
  time-of-day clock (no stopwatch/split/digital). Analog non-stopwatch
  wristwatch each. Odometer covered/unreadable. Paper tables, notes and
  "race tables" are legal. [V R01 §1, R03 §7] => THE SIMULATOR MUST TRAIN
  CALCULATOR-FREE WORK WITH PAPER TABLES.
- Age factor for a 1939 car: 0.845 (raw seconds x 0.845). [S R01 §3.2]

## 1. What the Great Race actually is (format the sim must reproduce)
R1.1 [V] Speed-and-time rally: no distances given, no odometer. Instructions
     are landmark-triggered actions + assigned speeds + timed elements in
     whole seconds. 220-250 instructions per stage, 18-20 pages. (R01 §2)
R1.2 [V] GRIID page: 5 columns: #, A = CAMEO diagram (dot=entry, arrow=exit,
     bold=route, thin=roads not taken, dashed/omitted=driveways, lots,
     unpaved, dead-ends), B = section symbols (tire warm-up, calibration run,
     transit, free zone, lunch, refuel, pit), C = speeds & timing (speed,
     pause, timed segment; on the calibration run also perfect interval and
     cumulative times), D = hints ("Comes quick", "Look sharp", "1st paved
     road", "Follow this Curve Warning Sign"). (R04 §2.2, R03 §0)
R1.3 [M] Whether perfect cumulative times are printed for EVERY landmark all
     day, or only on the calibration run, is unresolved (R01 §2.2 vs R03 §0).
     Default: printed only for the calibration run; option to print them
     everywhere ("open book" practice mode).
R1.4 [V] Instruction vocabulary: Right/Left/Straight/Bear/Jog/Acute at
     STOP/T/Y/SIGNAL/landmark/quoted sign/"1st paved road"; "Speed NN";
     "Pause NN" (seconds, added to leg time); timed segment "NN mph for M:SS
     then NN"; STOP SIGN = official octagon; Great Race never routes onto
     private/driveway/lot/unpaved/dead-end without an instruction.
     Typical stop: "stop, pause 15, proceed at assigned speed". (R01 §2,
     R04 §1-3)
R1.5 [V] Ghost car model: perfect time assumes instantaneous speed changes
     and stops; pauses add exactly their printed seconds. Real cars lose time
     in every maneuver; teams compensate from a car-specific performance
     table (e.g. 15 s pause - 6.5 s loss = 8.5 s dwell; 0->40 costs 4.5 s).
     (R01 §2.3-2.4, R03 §0, §2.3, R07 §2)
R1.6 [V] Daily structure: instructions issued 30 min before start (older
     sources: 20) -> tire warm-up -> speedometer calibration run >= 15 mi
     (mostly at 50 mph, dozen+ landmarks with Column C perfect times) ->
     timed legs with 4-7 hidden Timing Checkpoints (sometimes 12) -> lunch
     45 min, roll out one per minute, restart penalty if >5 min early ->
     afternoon legs -> Observation Checkpoint at finish (must stop).
     Start = stage start + position in minutes; one car per minute.
     (R01 §4, R06 §1)
R1.7 [V] Checkpoint: green Day-Glo sign, time recorded to nearest second when
     front wheels cross the line; do not stop or go <= 5 mph within sight
     (penalty); crossing ENDS the leg and the next leg's start time = your
     actual arrival time (error does not compound). >30 min late = missed.
     1 point per second early or late; 0 = "Ace". (R01 §3.1)
R1.8 [V] Traffic lights are NOT built into the instructions: if stopped at a
     light the team times the stop and may request a Time Allowance (TA),
     or make up the time. Trains/accidents qualify for TA; mechanical failure,
     inability to hold speed, personal failure do not. (R04 §2.3)
R1.9 [S] Score benchmarks: champions ~1 s per leg (2025 winner 49.72 s over
     9 days), best rookie day ~13 s, ordinary rookie day 20-46 s, one blown
     leg 48 s (untimed train stop), rookie wrong turn 1:05, wrong-way start
     10 minutes. Rookie division may drop a bad leg (rule UNVERIFIED).
     (R06 §4, R04 §2.3)
R1.10 [V] Speeds rarely above 50 mph; road names rare; landmarks are signs,
     intersections, RR crossings, bridges, pavement changes. (R01 §2)
R1.11 [V] Speedometer: analog needle, 1-mph graduations by rule; Timewise 825
     used by >90% (calibrated by a factor after the morning run). A stock
     1939 mechanical speedometer has non-linear error, lag and bounce; the
     learner plans to use the stock unit, so BOTH must be modeled. 1 mph
     error ~ 10-15 s/day. (R01 §1.2, R03 §2.1-2.2, R07 §3)

## 2. Skills the simulator must teach (prioritized)
From the "consensus what wins" (R03 §1.7, §9), official coaching (R01 §5),
failure anecdotes (R06), trap literature (R04) and timing math (R07).
P1  Flawless stopwatch handling: start/stop/lap on the landmark cue, reading
    an analog dial (1/5 s), consistency (low jitter) > low bias.
P2  Pause/stop execution with the car's loss model: dwell = pause - loss;
    countdown "3-2-1-go"; different entry/exit speeds.
P3  Timed speed changes: start the watch at the anchor, call the change at
    T - ramp/2 (e.g. 34 not 36).
P4  Speed changes at landmarks: be mid-ramp at the sign; leading edge of
    intersection convention.
P5  Morning calibration run: read splits vs Column C, compute k = P/A or %
    error, build the "speedo cheat card" (indicated speed to hold per
    assigned speed) or set the Timewise factor; apply all day.
P6  Running early/late ledger + recovery: 10% over for 10x the delay or 20%
    for 5x; never overshoot into early (penalty symmetric); stop correcting
    before likely checkpoint spots; time allowances for lights/trains.
P7  Instruction reading accuracy under load: GRIID page literacy, CAMEO
    diagrams, hints, pre-read triage in 20-30 min, never miss a pause,
    read ahead and call the next landmark BEFORE looking down.
P8  Course following / trap recognition: STOP vs YIELD vs blinker; T vs
    not-a-T; Y; bear vs turn vs acute; jog; 1st paved road vs driveway/lot/
    dead end; quoted-sign exactness; ONTO/AT/AFTER (secondary, SCCA);
    straight-as-possible at forks; off-course detection ("landmark did not
    appear") and recovery arithmetic; never follow the car ahead.
P9  Time-of-day discipline: start on the exact minute, stopwatch-as-TOD
    technique, lunch restart, rotating bezel.
P10 Driver/navigator protocol: callout -> read-back -> countdown -> "Mark";
    the driver holds speed and looks for the landmark; consistent words.
P11 Endurance/consistency: full day (200+ instructions, 4-7 CPs), full
    9-stage campaign; fatigue; score interpretation (what 2/13/21/46 s mean).
P12 Performance-table building: measure the car's stop/start and speed-
    change losses with repeated runs (>= 4 per speed); sanity-check charts.
P13 (secondary) SCCA-style TSD with odometer and CAST, mileage math,
    minutes-per-mile tables, hundredths-of-minute pauses, for local practice
    rallies before June.

## 3. Simulation fidelity requirements
F1  1-D course with hidden arc-length positions; landmarks visible to the
    player as they come into sight range; intersections rendered in CAMEO
    grammar plus a schematic road-ahead view with distractors (driveways,
    gravel roads, wrong-shaped signs, side-road stop signs facing away).
F2  Ghost-car perfect-time integrator exactly as R1.5; pauses add time;
    timed segments create virtual landmarks at s_a + v1*T.
F3  Physical car: acceleration/deceleration limits (1939 Ford Deluxe 85 hp:
    0-35 in ~9-11 s; modest hydraulic brakes), driver speed-holding noise
    and lag by driver skill level, consistent repeatable ramps so a
    performance table is learnable (R01 §5 "the more consistent the driver,
    the more useful the charts").
F4  Speedometer model: Timewise (near-exact after calibration) and stock
    mechanical (gain error growing with speed, offset, lag, bounce, daily
    drift so calibration must be redone each morning).
F5  Hazards: stop signs (with/without cross traffic wait), signals (random
    red), trains, slow vehicles, construction; each timeable by the player.
F6  Checkpoints hidden; sight-zone rule; leg reset; observation checkpoint
    stop at finish; missed-checkpoint rule; age factor; divisions and
    benchmark comparison.
F7  Instruments: exactly one stopwatch (analog Heuer-style with 1/5 s sweep
    and minute register, or digital with lap), one analog clock with
    rotating bezel, speedometer needle, paper lapboard (performance table,
    cheat card, notes), the GRIID book. No odometer, no calculator in
    "Great Race legal" mode; optional training aids (early/late pace bar,
    3-2-1 cues, cumulative perfect times) that can be switched off and are
    progressively removed by the curriculum.
F8  Time scale: real time default; 2x/4x/8x and step mode for agents.
F9  Deterministic seeded scenarios; replayable; every run produces a debrief
    with per-checkpoint error and ATTRIBUTION of lost seconds (speed hold,
    uncompensated stop loss, late/early speed change, pause miscount,
    wrong turn, light/train, calibration residual).

## 4. Product / UX requirements
U1  Playable in a browser (Vite static build), keyboard-first, no backend.
U2  Curriculum map with unlockable drills (P1..P12), each drill 2-10 minutes,
    with instant score, personal best, "aces" collected, streaks.
U3  Full-stage and campaign modes with realistic durations but adjustable
    time scale; pause/resume; progress saved locally.
U4  Debrief after every run: timeline of actual vs ghost car, seconds lost by
    cause, the correct arithmetic shown ("worked solution"), tips tied to
    the mistake, replay.
U5  Rally School: short interactive lessons (ghost car, pause math, GRIID
    page, calibration, recovery rule, protocol) with checks.
U6  Reference cards in-app: seconds-per-mile table, +5/+10 mph recovery
    factors, pause arithmetic, GI definitions, CAMEO legend, rules summary
    with citations.
U7  Two-seat option later: a human driver on a second device is out of scope
    for v1; v1 has an AI driver "Dad" with selectable skill and personality
    (asks "which way?" at T, reads back callouts).
U8  Accessibility: large readable dials, color-safe, works on a laptop screen.

## 5. Engineering requirements
E1  Pure TypeScript core engine with no DOM dependency; UI and CLI/agent
    harness are thin layers over it.
E2  Agent harness: JSON observation/action protocol over stdin/stdout and an
    in-process API; scripted bots (oracle/perfect, naive rookie, random,
    "forgot the pause") used both for playtesting and as validation targets
    (R07 §9.6: oracle ~1-3 s/leg; ignoring stop loss ~6-9 s per stop; 1%
    speedo error ~9 s per 15-min leg; wrong turn costs once per leg).
E3  Spec-driven: docs/spec/SPECS.md numbered specs; every spec has >= 1 test
    whose name contains the spec id; `npm run spec:check` fails if a spec
    has no test. `npm test` green before every commit.
E4  Content authored as data (JSON/TS scenario files) + seeded procedural
    generator; trap library as data with CAMEO + road layout + correct exit.
E5  Status files (docs/status/STATUS.md, LOG.md) updated at every milestone
    so a fresh context can resume.
E6  Unverified rules are configuration with the defaults stated here, and
    are listed in docs/spec/OPEN-QUESTIONS.md for Josh to confirm against
    the Rookie Handbook / Regulations PDFs.

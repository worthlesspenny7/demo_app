# 00 - Domain baseline (from model knowledge, NOT web-sourced)

> Provenance: written by the assistant from general training knowledge of TSD
> rallying and the Great Race. Everything here is a fallback for the sourced
> research in 01-07. Where 01-07 contradict this file, 01-07 win.
> Items marked (GR) are Great Race specific; (TSD) are generic SCCA-style TSD.

## 1. What a TSD rally is
- Teams (driver + navigator) follow route instructions on public roads and try
  to be at the exact right place at the exact right time. Hidden checkpoints
  record arrival time; penalty = |actual - perfect| in seconds (GR) or in
  hundredths of a minute (TSD). Lowest total wins. Zero error at a checkpoint
  is an "ace" (GR) / "zero" (TSD).
- Two families:
  - (TSD) Odometer-based: instructions give mileages and CAST (Change Average
    Speed To). Navigator computes time = distance / speed continuously; an
    odometer (often a calibrated rally odometer) is the primary instrument.
  - (GR) Speedometer-and-time based: odometer is covered. Instructions say what
    speed to hold and where/when to change it. Everything is driven by holding
    exact speed between landmarks and timing with a stopwatch. Perfect time for
    a leg is implicit in the course design (rallymaster measured the course and
    computed perfect times).

## 2. Great Race specifics (GR)
- Hemmings Motor News Great Race, ~9 days, ~2,300 miles, ~120 cars, pre-1975
  vehicles (age factor favors older cars; pre-war cars get the largest factor).
- Each morning teams receive the day's course instructions (~200-250 lines).
  Instructions are landmark-based: "Right at STOP", "Left at T", "Speed 35 at
  SPEED LIMIT 35 sign", "Pause 15" (at stop signs/lights), "Speed 40 for 1:20
  then 30" (timed speed change), "Stop" at the end of a leg, transit
  (untimed) sections to lunch/finish.
- The day starts with a tire warm-up then a Speedometer Calibration run:
  hold assigned speeds between listed landmarks; Column C lists the perfect
  interval times; the team compares its measured intervals to perfect to
  learn its speedometer error and applies that all day (either by driving a
  corrected indicated speed or by adjusting the Timewise 825 calibration).
- The Timewise 825 is a GR-legal electronic speedometer (no odometer display)
  used by ~90% of teams. A stock 1939 Ford mechanical speedometer will have
  non-linear error, needle bounce, and lag; relying on it is a real handicap
  but is exactly what the user plans to do, so the simulator must model it.
- Allowed: one stopwatch (analog or approved digital), one analog time-of-day
  clock, speedometer, compass, paper, pencil. Prohibited: calculators,
  odometers, GPS, phones, computers. => the navigator's arithmetic is MENTAL
  (plus pre-made paper tables, which are legal).
- Checkpoints: 4-7 per day, hidden, at inconvenient places. Timing is taken
  as the car passes the checkpoint line. Within sight of a checkpoint the car
  must not stop or go under 5 mph. Each second early or late = 1 point.
- Legs: a day is a chain of legs; each ends at a checkpoint where (after the
  checkpoint) timing is reset: the next leg's perfect time counts from the
  checkpoint's perfect time (UNVERIFIED: whether from perfect or actual
  passage; the common GR practice is that the car's "out time" from the
  checkpoint area is a fixed restart, so error does not carry forward).
- Scoring: daily sum of checkpoint errors x age factor; divisions: Rookie,
  Sportsman, Expert, Grand Championship, X-Cup (students). Expert teams
  often total under ~10 s for a whole day; good rookies maybe 30-90 s/day;
  bad days are hundreds of seconds (a wrong turn costs minutes).

## 3. The navigator's job minute-by-minute (GR)
1. Read ahead: always know the next 2-3 instructions and what the landmark
   looks like.
2. Call the instruction to the driver early, confirm execution ("Right at the
   stop ahead... stop... pause fifteen... go").
3. Manage time: at a pause, run the stopwatch; subtract the car's known
   stop/start loss (e.g. a full stop from 35 and back to 35 costs ~6-7 s of
   distance-time for a vintage car), so for "Pause 15" you hold only ~8 s.
4. Timed speed changes: start the watch at the landmark, call the change a
   second or two early so the car's speed crosses the target at the right
   moment (accel/decel lag).
5. Track "ahead/behind" in seconds continuously; if the driver drifted 1 mph
   low for 2 minutes at 35 mph, you are ~3.4 s behind; recover by driving
   +2 mph for a computed period, never by hard speeding (checkpoint sight
   rule and traffic).
6. Handle traffic: slow truck -> compute loss, recover gradually; traffic
   light: pauses are usually built into instructions at lights; if you must
   stop longer than the pause, the excess is loss to recover.
7. At a checkpoint: do not slow down; after passing, note time, reset mental
   state for the new leg.

## 4. Core arithmetic the navigator must do without a calculator
- Minutes per mile = 60 / mph. Seconds per mile = 3600 / mph.
  | mph | s/mile | min:sec per mile |
  | 20 | 180 | 3:00 | | 24 | 150 | 2:30 | | 25 | 144 | 2:24 |
  | 30 | 120 | 2:00 | | 32 | 112.5 | 1:52.5 | | 35 | 102.86 | 1:42.9 |
  | 36 | 100 | 1:40 | | 40 | 90 | 1:30 | | 45 | 80 | 1:20 |
  | 48 | 75 | 1:15 | | 50 | 72 | 1:12 | | 55 | 65.45 | 1:05.5 |
  | 60 | 60 | 1:00 |
- Time error from a speed error: driving v_act instead of v for time t
  gives distance error; time gained/lost = t * (v_act - v)/v_act (seconds
  per second). Rule of thumb at 35 mph: 1 mph off for 1 minute ~ 1.7 s.
- Recovery: to make up E seconds at base speed v by running v+d:
  t_needed = E * (v + d) / d. E.g. 10 s late at 40, run 45 for 90 s.
  Simple rule: "+5 mph makes up ~1 second every ~9 seconds at 40 mph."
- Stop/start losses: stopping from v and accelerating back costs roughly
  (v / a_dec + v / a_acc) / 2 seconds of distance-time, plus dwell time.
  A vintage car (0-35 in ~10 s) loses ~5 s per full stop from 35 plus dwell.
- Pause arithmetic: watch time to hold = pause - (stop/start loss).
- Timed speed change: start the clock at the landmark; subtract lead time
  (1-2 s) to call the change early.

## 5. Common traps and mistakes (both)
- Taking "straight" literally when the main road bends; taking a bear as a
  turn; "Left at T" when the first left is a driveway/private road (not a
  road); sign text mismatch ("STOP" vs "STOP AHEAD"); counting a yield as a
  stop; taking the first of two closely spaced roads; speed-change landmark
  hidden around a curve or on the far side of intersection.
- Forgetting a pause, double-counting a pause, starting the watch late,
  stopping the watch instead of lapping, resetting the wrong watch.
- Over-correcting: speeding to recover 5 s then arriving 5 s early.
- Driver holds indicated speed on an uncalibrated speedometer.
- Panicking after a wrong turn: not computing lost time, not re-finding the
  course from the last known landmark.
- Communication failures: ambiguous callouts ("next left" when two lefts),
  navigator looking down at the watch during the one landmark that matters.

## 6. Learning progression recommended by experienced crews
1. Learn the mph <-> s/mile table cold.
2. Learn your car: stop/start loss at 25/35/45, speedo error curve.
3. Practice single instruction types in isolation (pauses, timed changes).
4. Practice chaining 10-20 instructions with a checkpoint.
5. Practice recovery scenarios (late/early, missed turn, slow traffic).
6. Full-day stamina runs with fatigue, multiple checkpoints, lunch restart.
7. Team practice: callouts and confirmation protocol with the real driver.

## 7. User-suggested source: MBCA PeachTube "TSD Road Rally School" (2021, YouTube)
- Suggested by Josh on 2026-10-03 as a strong resource. NOT YET READ: youtube.com
  is blocked by this session's network egress policy and the web-search budget
  was exhausted. TODO for a future session with network access (or paste the
  transcript into docs/research/08-mbca-rally-school-transcript.md): watch it
  and reconcile with this file and docs/spec/REQUIREMENTS.md.
- What club-level TSD rally schools (SCCA regions, MBCA/PCA/BMW CCA sections)
  typically cover, from model knowledge (UNVERIFIED for this specific video):
  1. Rally is not a race: scoring is on precision, not speed; everyone drives
     legal speeds; the winner is the team closest to perfect time.
  2. Reading the general instructions (GIs) before the route instructions;
     definitions (T, Y, STOP, SIGNAL, "onto", "at", "after", main road rule).
  3. Odometer calibration: an official odometer check leg; computing your
     correction factor (official miles / your miles) and applying it.
  4. CAST and time computation: minutes per mile table, how to compute the
     time due at each mileage, "being on time" vs "being at the right place".
  5. Checkpoint procedure: do not slow down; in-time vs out-time; how time is
     restarted after a checkpoint; scoring units (hundredths of a minute or
     seconds; early counts the same as late).
  6. Pauses and gains, free zones / transit zones, DIYC (do-it-yourself
     checkpoints) and passage controls.
  7. Classes: Equipped (rally computers), Limited/Stock (odometer + stopwatch),
     SOP/Novice ("seat of pants").
  8. Teamwork: navigator reads ahead and calls, driver holds speed and looks
     for landmarks; agree on vocabulary; never both look down at once.
  9. Common novice errors: wrong start time, forgetting a pause, misreading a
     mileage, arguing, overdriving to catch up, missing the first instruction
     because you were still setting up.
- Relevance to the Great Race: the MBCA/SCCA style is odometer + mileage based.
  The Great Race is speedometer + landmark + time based with the odometer
  covered. The simulator must support both styles, but the Great Race style is
  the default, and the odometer-based style is a secondary mode for practising
  general TSD skills (and because many local practice rallies Josh can enter
  before the Great Race will be SCCA-style).

# 07 - Great Race timing model and navigator math (for the simulator engine)

Compiled 2026-10-03.

## 0. Provenance / method note (read first)

- This run had NO working web access: the session's WebSearch budget was already
  exhausted (200/200) before the first query, WebFetch is blocked by network policy,
  and direct fetches of every rally-domain host (greatrace.com, ronrowland.com,
  fifthaveinternetgarage.blogspot.com, stevemckelvie.wordpress.com, hagerty.com,
  cokertire.com) were refused with HTTP 403 at the egress proxy. GitHub code/repo
  search for Great Race / TSD material returned zero hits.
- Therefore nothing below is a fresh quotation. Each item is tagged with one of:
  - [GIVEN]   fact supplied by the project lead in the research brief (treated as
              verified by the lead against the blogs listed in section 10).
  - [DERIVED] pure arithmetic/physics that follows from [GIVEN] facts; checkable.
  - [TSD]     generic SCCA-style TSD convention, sourced in
              docs/research/02-tsd-fundamentals-and-newbie-advice.md.
  - [MODEL]   from the assistant's training knowledge of the Great Race.
              Every [MODEL] item is UNVERIFIED and carries the URL(s) it should be
              checked against. Do not treat as rule text.
- The highest-value verification targets are listed in section 10 with the exact
  question each source should answer.

---------------------------------------------------------------------------------

## 1. Instruction types and their semantics

The Great Race ("Hemmings Motor News Great Race presented by Hagerty";
https://www.greatrace.com/) is a speedometer-and-stopwatch TSD rally: odometers are
covered, no GPS/phones/calculators, one approved stopwatch, one analog time-of-day
clock, speedometer, compass. [GIVEN] Course instructions run roughly 220-250 lines per
day with 4-7 hidden checkpoints; penalty is 1 point per second early or late; an "ace"
is 0. [GIVEN]

Every instruction is executed AT a visible landmark (sign, intersection shape,
road feature), never at a mileage, because the team has no odometer. [GIVEN]

### 1.1 Turn instructions
| Text (typical)            | Meaning                                                              | Tag |
|---------------------------|----------------------------------------------------------------------|-----|
| Right at STOP             | Turn right at the intersection controlled by a STOP sign facing you  | [GIVEN]/[TSD] |
| Left at T                 | Turn left where your road ends at a T intersection                   | [GIVEN]/[TSD] |
| Bear Left / Bear Right    | Follow the lesser-angle fork; not a 90-degree turn                   | [TSD] |
| Right at SIGNAL           | Turn at the traffic light                                            | [MODEL] |
| Left onto "Main St"       | Turn at the road whose sign reads exactly that text                  | [TSD] |
| Straight at STOP          | Continue through a stop-controlled intersection                      | [TSD] |

Landmark conventions carried over from SCCA-style generals [TSD, see doc 02]:
a word in capitals (STOP, YIELD, T, SIGNAL, RR) means a sign/feature you can see;
"onto" names a road by its sign; a turn executes at the intersection; a "road" is a
public, maintained road (driveways/private roads do not count). The Great Race
publishes its own General Instructions each year [MODEL: verify at
https://www.greatrace.com/ under Rules/Competitor info].

Where does a new speed begin when it is paired with a turn? Convention in Great Race
instructions is that the speed listed on a turn line applies AFTER the turn is
completed (you are at the intersection reference point when you make the turn and the
new speed is "from here on") [MODEL, UNVERIFIED; SCCA CAST-at-a-turn convention is
"at the turn", doc 02]. The engine should treat the instruction point as the
intersection center; the ambiguity is a few car-lengths (< 0.5 s at 30 mph) [DERIVED].

### 1.2 Speed instructions at landmarks
"Speed 35 at SPEED LIMIT 35 sign", "Speed 40 at the end of the bridge", or simply a
speed column value on the landmark line. [GIVEN] The new speed takes effect AT the
landmark (your front bumper abeam the sign) [TSD convention; MODEL for GR wording].
Because a real car needs several seconds to change speed, experts begin the change
early so the car is at (or passing through the midpoint of) the change when the sign
is reached (see section 2.3 for why "half the ramp time early" is exact). [DERIVED]

### 1.3 Timed speed changes
"Speed 30 for 0:36 then 40" (or "30 MPH for 36 seconds, then 40 MPH"). [GIVEN]
Semantics: from the instant the preceding instruction point is passed (the point at
which 30 became the assigned speed), hold 30 for exactly 36 seconds, then change to
40. There is no landmark for the change; the navigator times it on the stopwatch.
Brief from the lead: experts "start after 34 instead of 36 to account for vehicle
performance". [GIVEN] The logic is derived in section 2.3.

### 1.4 Pause nn
"Pause 15" (also written "P15", "15 sec pause") attached to a stop sign, signal,
railroad crossing or sharp turn. [GIVEN]
Semantics: the rallymaster has added nn seconds to the perfect time at that point.
You are therefore EXPECTED to be nn seconds "later" past this point than constant
speed would make you. A physical stop consumes part of that budget as rolling loss
(deceleration + acceleration); the remainder is stationary dwell. [GIVEN example]:
"performance table indicating a loss of 6.5 seconds for the stop/start speeds, rotate
bezel to 8.5 = 15 - 6.5" i.e. after a full stop from/to the assigned speed the car
should sit still 8.5 s, then go. [GIVEN]
Interaction cases [DERIVED from the definition]:
- Stop sign, no traffic: stop, dwell (nn - loss), go. Net = on time.
- Stop sign, must wait for cross traffic longer than (nn - loss): you are late by the
  excess; recover later (section 6).
- "Pause" at a signal that is GREEN: you still must consume nn seconds. Options:
  (a) slow to a crawl/brief stop to burn the time, (b) carry the surplus as "early"
  and bleed it off by driving slightly under speed (section 6). Nothing requires a
  physical stop at a green; only the TIME must be consumed. [MODEL: rule reading;
  verify in Rundle's "How It Works" post, section 10.]
- Signal RED longer than the pause: the excess is lost time to recover. [GIVEN sense]
- Do not confuse the stopwatch "pause" button with the instruction. [TSD]

### 1.5 Stop / Yield
A STOP sign requires a legal stop (traffic law applies throughout). Great Race
instructions normally pair every STOP and SIGNAL on the route with a Pause so that a
legal stop does not cost time [MODEL, UNVERIFIED]. If a STOP appears with no Pause,
the car still must stop and the loss (section 2.1) must be recovered. YIELD does not
require a stop; experts roll it. [TSD]

### 1.6 Traffic signals
Handled by Pauses as above. Signal timing is the single biggest luck factor on the
day. A long red of 90 s against a Pause 30 leaves 60 s to recover, which at +5 mph
over 35 takes 8 minutes of driving (section 6) - often impossible before the next
hidden checkpoint. [DERIVED] Teams therefore protect against lights by knowing their
recovery tables cold. [MODEL]

### 1.7 Transit zones / parade / town entries
Timed competition ends at the last checkpoint before the lunch city and before the
overnight city; the remaining miles into town, through the downtown "show" line,
are untimed transit with a time allowance (arrive by a stated time; no checkpoints).
[MODEL, UNVERIFIED; wording may be "transit", "free zone" or an explicit arrival
time. Verify: Rundle "How It Works", greatrace.com daily schedule.] Cars are
announced into the overnight city one at a time for spectators. [MODEL]

### 1.8 Start of the day / of a leg
Each car has an assigned start time; cars leave the start line at one-minute
intervals. [MODEL, UNVERIFIED - see section 5]. The first instruction line reads
like "START at your assigned time, Speed 25" [MODEL]. Perfect time of everything that
follows is anchored to that start time (section 4).

### 1.9 End of day
After the last checkpoint: transit to the finish city, cross the finish banner; the
finish itself is not a scored checkpoint [MODEL, UNVERIFIED]. Scores are posted that
evening; teams learn their checkpoint errors only then (no slips at hidden
checkpoints) [MODEL, UNVERIFIED but strongly implied by "hidden" checkpoints].

---------------------------------------------------------------------------------

## 2. Performance table / car calibration

### 2.1 Loss from a full stop and restart (the "stop/start" number)
Define v = assigned speed, a_d = average deceleration, a_a = average acceleration
(both as constants). Compared with rolling through at v, a complete stop with ZERO
dwell costs:

    L_stop(v) = v/(2*a_d) + v/(2*a_a)          [DERIVED]

(each ramp covers the same distance as v/2 would in the ramp time, so half the ramp
time is "lost"). Add dwell D seconds stationary for the total: L = L_stop + D.

Worked values (v in ft/s: 25 mph = 36.7, 30 = 44.0, 35 = 51.3, 40 = 58.7, 45 = 66.0):
| Car                                  | a_a (ft/s^2) | a_d (ft/s^2) | L_stop @25 | @30 | @35 | @40 | @45 |
|--------------------------------------|--------------|--------------|-----------|-----|-----|-----|-----|
| Slow prewar (0-35 in ~14 s)          | 3.7          | 7            | 7.6 | 9.1 | 10.6| 12.1| 13.6|
| Typical 1930s V8 (0-35 in ~9 s)      | 5.7          | 8            | 5.5 | 6.6 | 7.7 | 8.8 | 9.9 |
| Quick post-war car (0-35 in ~6 s)    | 8.5          | 9            | 4.2 | 5.0 | 5.9 | 6.7 | 7.6 |
[DERIVED, illustrative; the brief's example "6.5 s" matches the middle row at ~30 mph.]

How teams measure it [MODEL + GIVEN practice]: on a practice road at speed v, start
the stopwatch at a marker, make a normal stop at a second marker with zero dwell,
accelerate back to v, and stop the watch at a third marker; repeat the run without
stopping. Difference = L_stop(v). Record for each assigned speed in a "performance
table" card. [GIVEN: "performance table"] A Great Race team usually builds the table
once per car and re-checks after mechanical changes. [MODEL]

How it is applied: dwell at a Pause = nn - L_stop(v_in, v_out). With an analog
stopwatch that has a rotating countdown bezel, the navigator rotates the bezel so
the hand will reach the index after (nn - L_stop) seconds of dwell, starts the watch
when the car stops, and calls "go" at the index. [GIVEN, from ronrowland.com
"Analog Stopwatch With Countdown Bezel: Application Notes".]
If the stop is from speed X and the restart to a different speed Y (turn + new
speed), use L = X/(2 a_d) + Y/(2 a_a). [DERIVED]

### 2.2 Loss/gain from a speed change between two speeds (no stop)
Changing from v1 to v2 over ramp time T_r (linear ramp) costs, relative to an
instantaneous change AT the landmark:
    delta_distance = (v1 - v2) * T_r / 2      (positive = you end up ahead in
                                              distance when slowing, behind when speeding up)
    delta_time at the new speed = (v1 - v2)*T_r/(2*v2)   [DERIVED]
Example 40 -> 30 in 4 s: you are ahead by (58.7-44.0)*4/2 = 29.3 ft = 0.67 s at 30.
Example 30 -> 40 in 5 s: you are behind by (44.0-58.7)*5/2 = -36.7 ft = 0.63 s at 40.
Small per event, but 60 speed changes a day at ~0.6 s each would be 36 s if all
ignored in the same direction, which is why experts center the ramp (2.3). [DERIVED]

### 2.3 Why "start the change at 34, not 36" is exactly right
Ideal profile: hold v1 for T seconds (T = 36), then instantly v2. Real car: hold v1
until t0, then ramp linearly to v2 over T_r seconds. Equating distance travelled:

    v1*T + v2*(t - T)  =  v1*t0 + ((v1+v2)/2)*T_r + v2*(t - t0 - T_r)
    =>  t0 = T - T_r/2                        [DERIVED]

The result does not depend on whether v2 > v1 or v2 < v1: in both cases begin the
transition HALF THE RAMP TIME early so that the ramp is centered on the ideal change
instant. If the car needs ~4 s to go 30 -> 40, start at 36 - 2 = 34. [DERIVED;
matches the [GIVEN] "34 instead of 36".] The same rule applies to a speed change at a
landmark: be mid-ramp as the bumper passes the sign. The lead time in the
performance table is therefore T_r(v1 -> v2)/2 for each pair used on the rally.

### 2.4 Suggested performance-card layout (what the simulator should let the player build)
| From\To | 20 | 25 | 30 | 35 | 40 | 45 | 50 |  rows = starting speed
| stop    | lead/dwell numbers: L_stop(v) per column
| 20..50  | T_r/2 for each (from,to) pair, sign-agnostic
[DERIVED; the real paper card used by teams is referenced as a "performance table" in
the brief, format UNVERIFIED.]

---------------------------------------------------------------------------------

## 3. Speedometer calibration run math

### 3.1 The run
Each morning after a tire warm-up, the first part of the course is a calibration
section: several landmarks with assigned speeds, and "Column C" of the instruction
sheet lists the PERFECT interval time between consecutive landmarks at the assigned
speed. The team records its ACTUAL interval times on its stopwatch while holding the
indicated speed. [GIVEN] (The brief's naming: Column C = perfect times.)

### 3.2 The math
For an interval with perfect time P (seconds) and measured time A at indicated speed S:

    true speed  V = S * P / A
    factor      k = P / A        (true = k * indicated)
    error %     e = (A - P)/P    (positive => car slower than speedo says)
    indicated speed to hold for a desired true speed V_target:  S_hold = V_target / k
                                                               ~= V_target * (1 + e)
[DERIVED]

Worked example: P = 1:40 (100 s), A = 1:43 (103 s) at indicated 36.
  k = 0.9709; the car was really doing 34.95 mph.
  To run a true 35, hold indicated 36.05 (call it 36); true 40 -> hold 41.2;
  true 45 -> 46.3; true 30 -> 30.9.
Average k over all calibration intervals (weight by time) to beat stopwatch
reaction error: a 0.3 s reaction error on a 100 s interval is 0.3 % = 0.1 mph at 35,
so use the longest intervals available. [DERIVED]

### 3.3 How the correction is applied when the only tool is a speedometer
You cannot correct the TIMES: the checkpoint perfect times are fixed by the
rallymaster. You correct the SPEED you hold. Two equivalent ways [DERIVED + GIVEN
practice]:
1. Electronic speedometer (Timewise 825, used by > 90 % of teams [GIVEN]): adjust the
   unit's calibration constant by the factor k (new_cal = old_cal * P/A or its inverse
   depending on the unit's definition) so the display reads true speed; thereafter
   drive exactly the printed speeds. The 825 displays to 0.1 mph and has a
   user-settable calibration number entered after a measured run [MODEL, UNVERIFIED;
   verify at stevemckelvie.wordpress.com Timewise posts and the greatrace.com blog
   "Life Before the Timewise Speedometer"].
2. Mechanical speedometer (the 1939 Ford case): build a "speedo cheat card" mapping
   each assigned speed (20, 25, 30 ... 50) to the needle position to hold. Mechanical
   error is NOT a constant factor: it typically grows with speed (magnetic
   drag-cup speedos read higher at higher speed), has hysteresis/needle lag of 1-2 s
   and bounce of +-1 mph, and shifts ~1 % with tire pressure/temperature, which is
   exactly why the calibration run is repeated every morning after the tires warm up.
   [MODEL for the physics, UNVERIFIED for the GR-specific lore; see greatrace.com blog
   "Life Before the Timewise Speedometer" and Hagerty "What makes The Great Race so
   great? The challenge".]
   The cheat card is therefore built per speed from calibration intervals run at
   different speeds where available, and interpolated.

### 3.4 Sensitivity (why calibration dominates the score)
A residual speed error of fraction e over a leg of perfect duration T produces a
checkpoint error of about e*T:
  e = 1 % (0.35 mph at 35) over a 15-minute leg = 9 s.
  e = 0.3 % over 15 min = 2.7 s.
Winning teams score ~1-2 s per checkpoint, which implies averaged speed control
within ~0.1-0.2 mph plus timing within ~0.5 s. [DERIVED]

---------------------------------------------------------------------------------

## 4. Checkpoint mechanics

### 4.1 Recording
Checkpoints are hidden (not in the instructions) and staffed; the checkpoint crew
records the time of day when the front of the car passes the checkpoint marker
(sign/flag/line), read from a synchronized clock. Cars do NOT stop. [GIVEN: hidden,
4-7/day; MODEL for the "front bumper at the sign" detail, UNVERIFIED.]
"Within sight of a checkpoint do not stop or go under 5 mph" [GIVEN] - a penalty rule
that prevents teams from fine-tuning their arrival once they spot the crew. Penalty
amount: UNVERIFIED [MODEL: additional points or a maximum-time score; check
greatrace.com rules].

### 4.2 Perfect time
    perfect(CP_k) = anchor_time + SUM(segment_i distance / segment_i speed)
                                + SUM(pauses) over everything from the anchor to CP_k.
Distances are known only to the rallymaster (measured course); teams never see them.
Timed speed changes contribute their fixed durations. [DERIVED from course design]

### 4.3 CRITICAL - does error carry across checkpoints?  (UNVERIFIED either way)
Two possible models; the engine MUST support both behind a flag.

  Model R ("leg reset", anchor = your own actual pass time):
    perfect(CP_k+1) = actual_pass(CP_k) + leg_(k+1) perfect duration.
    When you see the checkpoint crew, the navigator laps/restarts the stopwatch and
    notes the time-of-day; a mistake costs you at ONE checkpoint only.

  Model C ("cumulative", anchor = day start time or perfect(CP_k)):
    perfect(CP_k+1) = start_time + all intervals to CP_k+1.
    Since you do not learn your error until the evening, a 20 s error made early
    repeats at every later checkpoint unless you happen to fix it.

Assistant's best recollection [MODEL, ~65 % confidence]: the Great Race uses Model R -
competitors describe a day as a series of LEGS, each ending at a checkpoint, with
"timing starting over" at each checkpoint, and first-person accounts speak of a
wrong turn costing "N seconds at one checkpoint" rather than at every remaining one.
This is consistent with the sight-of-checkpoint rule (the crew is visible as you pass,
so you know the instant your new leg began). Verify with: Randy Rundle "The Great
Race...How It Works" (fifthaveinternetgarage.blogspot.com), Hagerty "What makes The
Great Race so great? The challenge", cokertire.com/great-race-101, greatrace.com FAQ.

Implementation note: under Model R the perfect leg duration is the rallymaster's
number (sum of intervals + pauses within the leg); the team's anchor is its own
actual pass time, so "checkpoint error" = (actual_pass(CP_k+1) - actual_pass(CP_k))
- perfect_leg_duration. The scoring crew computes it from the two recorded times.
Under Model C the error is simply actual - perfect with the day-start anchor.

### 4.4 After the checkpoint
Instructions continue unchanged; the checkpoint is at an arbitrary point between
instruction lines. The navigator's workload after passing: lap the watch, write
time-of-day, re-zero the mental "ahead/behind" ledger (Model R) or keep it (Model C).
[DERIVED]

---------------------------------------------------------------------------------

## 5. Start procedure, lunch, restart  (all [MODEL], UNVERIFIED)

- Daily course instructions are handed out a fixed time before each car's start
  (order of 30-60 minutes); teams use that time to read ahead and mark the book.
- Cars leave the start banner one per minute at the time printed beside their car
  number; the first car around 8:00-8:30 am local. Start order: by car number or by
  division; unverified whether it rotates.
- Start time is a time-of-day; the analog clock is set to official rally time
  (a master clock at the start). The stopwatch is started at the start line.
- Lunch: the morning's last checkpoint precedes the lunch city; transit into town;
  cars display for ~1 hour; afternoon restart times are assigned per car (again at
  one-minute intervals) from the lunch location; the afternoon instructions begin at
  that restart with a new anchor time. A timed (non-transit) restart is the norm.
- Penalty for a late start: scored as late by the amount, or a fixed penalty -
  UNVERIFIED (section 8).
Verify all of the above at greatrace.com (Rules / Daily schedule) and Rundle's
"How It Works".

---------------------------------------------------------------------------------

## 6. Running early/late: recovery with only a stopwatch and speedometer

Let v = assigned speed (mph), E = seconds late (positive) to recover, d = extra mph.

    time to drive at (v + d) to recover E seconds:   t = E * (v + d) / d
    seconds recovered per second at (v + d):         d / (v + d)
    to burn E seconds (early) at (v - d):            t = E * (v - d) / d      [DERIVED]

Multiplier table "drive +5 mph for (factor x E) seconds":
| v (mph) | +5 factor | +2 factor | +10 factor | -5 factor (early) |
|---------|-----------|-----------|------------|-------------------|
| 25      | 6.0       | 13.5      | 3.5        | 4.0 |
| 30      | 7.0       | 16.0      | 4.0        | 5.0 |
| 35      | 8.0       | 18.5      | 4.5        | 6.0 |
| 40      | 9.0       | 21.0      | 5.0        | 7.0 |
| 45      | 10.0      | 23.5      | 5.5        | 8.0 |
| 50      | 11.0      | 26.0      | 6.0        | 9.0 |
Rule of thumb: "+5 factor = v/5 + 1". 8 s late at 35: run 40 for 64 s. [DERIVED]

Cost of a drift: holding 1 mph low for one minute at v loses about 60/(v) seconds
(exactly 60*1/(v-1)): 2.0 s at 30, 1.7 s at 35, 1.5 s at 40, 1.2 s at 50. [DERIVED]

Expert practice [MODEL, UNVERIFIED]: recover gradually (+2 to +5 mph), never above
the posted limit, and never while in sight of a possible checkpoint location; finish
the correction well before likely checkpoint spots (long straight rural roads with a
shoulder). Keep a running ledger on paper: "+3" / "-2" per event.

---------------------------------------------------------------------------------

## 7. Scoring aggregation, age factor, divisions, typical scores

- Checkpoint score = |actual - perfect| in whole seconds; daily raw score = sum of
  checkpoint scores. [GIVEN: 1 point/second; sum is the natural aggregation, [MODEL]
  for "whole seconds" rounding - UNVERIFIED.]
- Age (handicap) factor: the raw score is multiplied by a factor < 1 that shrinks
  with vehicle age so older cars are favored (e.g. a 1916 car's factor in the
  neighborhood of 0.7-0.8, a 1960s-70s car near 1.0). Exact formula UNVERIFIED
  [MODEL]; verify in greatrace.com rules. Possible shape: factor = 1 - c*(cutoff_year
  - model_year). The engine should expose factor(year) as a table/config.
- Divisions [MODEL, UNVERIFIED]: Rookie (first-time teams), Sportsman, Expert,
  Grand Championship (teams with a prior overall win), X-Cup (student teams);
  eligibility pre-1975 (cutoff has moved: 1972 earlier). Divisions are ranked
  separately and overall.
- Typical scores [MODEL, UNVERIFIED]: overall winners post 9-day totals on the order
  of 1-2 minutes, i.e. roughly 5-15 s per day across 4-7 checkpoints, with multiple
  aces; daily winners are often single digits. Competitive Sportsman teams run tens of
  seconds per day; rookies commonly post 1-5 minutes per day, and a single wrong turn
  can add several minutes. Verify with Hagerty / greatrace.com results pages.

---------------------------------------------------------------------------------

## 8. Maximum penalties and special penalties  (all UNVERIFIED [MODEL])

- Maximum per checkpoint / missed checkpoint: a cap exists so one disaster does not
  decide the event; magnitude unknown (candidates seen in TSD rallies: 5, 10 or 15
  minutes = 300/600/900 points). Verify in greatrace.com rules.
- Late to the start line: scored as late (seconds) or fixed penalty - unknown.
- Passing / being passed: no inherent penalty; being passed means you are slow or the
  other team is fast; passing in a checkpoint sight zone could violate the 5 mph/no-
  stop rule for the slower car. Unknown.
- Breakdown / tow: the day's remaining checkpoints are scored at maximum; teams may
  continue the event next day ("trailer" allowance) - UNVERIFIED.
- Prohibited equipment (GPS, phone, calculator, odometer visible): disqualification
  or maximum day score - UNVERIFIED.

---------------------------------------------------------------------------------

## 9. Engine model proposal (formula level)

### 9.1 Course representation
Route = polyline in 1-D arc-length s (ft). Objects positioned by s:
  - instruction i: s_i, type, parameters {speed, pause, turn, timed_duration, ...}
  - checkpoint k: s_ck (hidden from the player until "visible range" s_ck - V_k)
  - traffic controls: s, kind (STOP/SIGNAL/RR), signal cycle (red length, phase seed)
  - leg anchors: start, lunch restart.
Instruction sheet shown to the player = the lines WITHOUT s (landmark text only).
Calibration section: first N lines carry Column C = perfect interval seconds.

### 9.2 Ideal (perfect) time integration
State (s, t, v_assigned, pending_timed_change). Walk the objects in s order:
  - speed-at-landmark: v_assigned := new speed at s_i (instant).
  - timed change "v1 for T then v2": at its anchor s_a, schedule a change at
    t_a + T; ideal position of the change s_a + v1*T; thereafter v2. (This creates a
    virtual landmark at s_a + v1*T.)
  - pause nn: t += nn at s_i, no distance.
  - segment travel: t += (s_next - s)/v_assigned.
  - checkpoint k: perfect_k := t (Model C) or record leg duration since anchor (Model R).
All speeds in ft/s (mph * 1.46667). Store perfect_k and the per-leg durations.

### 9.3 Physical car
Continuous sim at dt = 0.1 s:
  v_true(t+dt) = v_true + clamp(a_cmd, -a_d_max(v), a_a_max(v)) * dt
  a_cmd from a driver controller tracking the DRIVER's target indicated speed:
    target_true = inverse_speedo(target_indicated)
    first-order lag tau_driver (1-3 s) plus Gaussian hold error sigma_v
    (rookie 1.0 mph, sportsman 0.5, expert 0.2) with slow random walk (bias).
  speedo(v_true) = v_true * (1 + g1) + g0 + g2*v_true^2 + daily_drift + jitter,
    quantized to needle resolution (1 mph marks; 0.1 for Timewise with g* ~ 0 after
    calibration). Needle lag tau_needle ~ 1 s for mechanical.
  Stops: at STOP, v -> 0 (decel a_d), dwell D chosen by the navigator (watch), then
    accel a_a to target. SIGNAL: red with probability p; red remaining time drawn from
    U(0, red_len); car must wait it out.
  Record actual_k when s crosses s_ck. Sight-zone violation if v < 5 mph or stopped
    for s in [s_ck - V_k, s_ck].

### 9.4 Scoring
  err_k = round(|actual_k - perfect_k|)                  (Model C)
  err_k = round(|(actual_k - actual_{k-1}) - leg_k|)      (Model R; actual_0 = start)
  day_raw = SUM err_k (capped per checkpoint at CAP, default 300 s, config)
  day_score = day_raw * age_factor(year)                   (age_factor table, config)
  event = SUM day_score. "Ace" when err_k = 0.

### 9.5 Navigator workload per instruction type (what the UI must make the player do)
  - Turn at landmark: identify landmark early; call turn; confirm; if a speed is paired,
    call "speed X after the turn"; log nothing.
  - Speed at landmark: call "change to X" at lead = T_r(v1,v2)/2 before the sign;
    the player must know T_r from their performance card.
  - Timed change: start/lap watch at the anchor; call the change at T - T_r/2; the
    player must read the watch while watching the road.
  - Pause nn with stop: compute dwell = nn - L_stop(v_in, v_out) from the card; set
    bezel/watch; count dwell; call "go". Excess waiting goes to the ledger.
  - Pause nn at green signal: decide burn-now (slow/stop) or ledger "-nn".
  - Ledger management: keep +/- seconds; choose recovery speed and duration via the
    multiplier table (section 6); stop recovery before likely checkpoints.
  - Speedometer calibration (morning): record 3-6 interval times, compute k or e%,
    build the cheat card (or set the Timewise constant).
  - Checkpoint: lap watch, note time-of-day, reset ledger (Model R).
  Difficulty knobs: instruction density (lines/mile), pause count, signal luck,
  speedo nonlinearity, navigator reaction noise (0.2-0.5 s per watch action),
  hidden checkpoint count 4-7.

### 9.6 Validation targets for the engine (so the sim "feels" like the real thing)
  - An "ideal" scripted expert team (0.2 mph hold, 0.3 s watch noise, perfect card)
    should score ~1-3 s per checkpoint.
  - Ignoring stop/start loss on every Pause 15 should cost ~6-9 s per stop.
  - A 1 % uncalibrated speedo over a 15-minute leg should cost ~9 s.
  - A missed turn with 2 minutes of recovery should cost ~120 s at the next
    checkpoint only (Model R) or at every remaining checkpoint (Model C).

---------------------------------------------------------------------------------

## 10. Verification list (sources named in the brief; could not be fetched here)

| Question                                                        | Source to check |
|-----------------------------------------------------------------|-----------------|
| Pause semantics, bezel math, dwell = pause - loss               | https://ronrowland.com/ (Rally category: "Analog Stopwatch With Countdown Bezel: Application Notes"; "Rally Clock With Rotating Bezel: Application Notes"; 2023/2024/2025 Great Race posts) |
| Checkpoint reset vs cumulative; what happens at a green light; transit zones; start/lunch procedure | https://fifthaveinternetgarage.blogspot.com/ ("The Great Race...How It Works", Randy Rundle) |
| Timewise 825 calibration procedure and display                   | https://stevemckelvie.wordpress.com/ (Timewise posts); https://www.greatrace.com/ blog "Life Before the Timewise Speedometer" |
| Mechanical speedometer era practice, score magnitudes            | Hagerty "What makes The Great Race so great? The challenge" (https://www.hagerty.com/media/) |
| Rules: age factor, divisions, max penalty, sight-zone penalty    | https://www.cokertire.com/great-race-101 ; https://www.greatrace.com/ (Rules / FAQ) |
| Generic TSD instruction conventions already sourced              | docs/research/02-tsd-fundamentals-and-newbie-advice.md |

Nothing in sections 5, 7, 8 and the Model R/C question in 4.3 should be hard-coded
without one of these confirmations; implement them as configuration with the defaults
stated above.

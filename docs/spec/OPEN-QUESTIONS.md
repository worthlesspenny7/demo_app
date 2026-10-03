# Open questions (verify against greatrace.com Rookie Handbook, Great_Race_101.pdf, Event Regulations PDF)

| # | Question | Sim default | Where used |
|---|----------|-------------|------------|
| Q1 | Are perfect cumulative times printed for every landmark all day, or only on the calibration run? | Calibration run only; "open book" option | book rendering, difficulty |
| Q2 | Exact wording/format of Column C entries (e.g. "35", "P15", "30 for 0:36 then 40") | Our own GRIID-like syntax | content |
| Q3 | Where does a landmark speed change take effect: near edge of sign / leading edge of intersection / apex of turn? | Near edge of sign; leading edge of intersection; speed on a turn line applies after the turn | engine |
| Q4 | Green light with a printed Pause: must the time still be consumed? | Yes, pause always adds time | engine |
| Q5 | Time Allowance mechanics for lights/trains: how declared, caps, accuracy requirement? | Declare seconds at the next CP; TA credited = min(declared, actual delay); over-declaring flagged | engine, UI |
| Q6 | Missed checkpoint / max penalty value (V.E.2), sight-zone penalty (V.E.3.a), late start penalty | 300 s cap per CP (config); sight-zone = 30 s (config); late start = seconds late | scoring |
| Q7 | Full age factor table (have 1954+ 1.000, 1953 .915, 1940 .850, 1939 .845, 1926 .760, 1925 .750, 1912 .620, 1911 .610) | Linear interpolation between known points | scoring |
| Q8 | Rookie "drop worst leg" rule | Off by default; toggle | scoring |
| Q9 | Does Trophy Run count toward overall? | Tiebreaker only | campaign |
| Q10 | Instructions 20 or 30 min before start | 30 | pre-read phase |
| Q11 | Lunch restart: timed restart with new anchor at assigned minute | Yes | stage model |
| Q12 | 1939 Ford Deluxe performance (0-35 time, braking), stock speedo error curve | 0-35 ~10 s; decel 8 ft/s^2; speedo +2% gain +1 mph offset, 1 s lag | car model |
| Q13 | MBCA PeachTube 2021 TSD rally school video content (user-suggested) | Not read (network blocked) | curriculum |

## Additional assumptions to confirm (from the realism review, docs/spec/reviews/review-realism.md §4)

| # | Question | Sim default |
|---|----------|-------------|
| Q14 | Is the calibration run on the clock (part of leg 1) or followed by a restart line? | On the clock (leg 1 begins at the stage start) |
| Q15 | Are there printed pauses at signals / RR crossings / sharp turns, or STOP-only with lights handled by Time Allowance? | STOP-only; lights and trains = TA |
| Q16 | Time Allowance mechanics: who requests, how, when, granularity, evidence; do lights qualify? | Declared any time before the leg's CP via ta.declare; 1 s granularity; lights qualify (rules.taForSignals) |
| Q17 | Start/lunch restart: official release at your minute vs self-start to your own clock; master clock location; how restart times are assigned | Self-start on your own clock; restart = arrival + 45 min rounded up to the minute |
| Q18 | Is the finish Observation Checkpoint timed for score or only a mandatory stop? | Mandatory stop only (penalty if missed), not timed |
| Q19 | Rookie division worst-leg drop: per stage, per event, or none? | Off by default (rules.rookieDropWorstLeg) |
| Q20 | Are assigned speeds always multiples of 5; is 20 or lower used in towns/school zones? | Multiples of 5 from 25 to 50 |
| Q21 | Stock 1939 Ford speedometer: mark spacing (2 or 5 mph), error at 30/40/50 on Josh's car, needle wobble; will the team really run the stock unit? | 5-mph navigator marks, +3% gain +1 mph offset, 0.7 mph bounce, 1 s lag |
| Q22 | Josh's car: 0-35 and 0-50 times, braking, 90-degree turn speed, grade sag | 0-35 ~11 s, 0-50 ~19 s, 8 ft/s^2 braking, 12 mph turns, no grade model |
| Q23 | Dad's callout protocol preferences ("Mark", "Stopped", 3-count vs 5-count, speed read-backs) | Driver says Stopped / At NN / read-backs; countdown is the navigator's |
| Q24 | Stopwatch choice: digital with lap vs analog with bezel; stopwatch-as-TOD from the start second? | Analog 60 s dial with countdown bezel by default; digital selectable |
| Q25 | Checkpoint density/placement in recent events: how often right after a stop or turn; still 12 in a day sometimes? | 4-7 per stage, some 500-1500 ft after a STOP |
| Q26 | Does the GRIID book print the written instruction with the CAMEO in Column A or in a separate column? | Separate text column next to the CAMEO |

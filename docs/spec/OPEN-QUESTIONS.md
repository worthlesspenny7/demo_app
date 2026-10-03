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

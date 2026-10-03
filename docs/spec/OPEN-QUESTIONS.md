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

## Answers from the Rookie Handbook (HB) and the 2026 Event Regulations (REG), 2026-10-03
Full extractions: docs/research/08-rookie-handbook-body.md, 08b-rookie-handbook-appendices.md, 09-event-regulations-2026.md (section 21 has every Q with citations). Spec deltas: SPECS.md "V2" section.

| # | Status | Answer | Spec |
|---|--------|--------|------|
| Q1 | ANSWERED | Official times printed only on the calibration run, interval + cumulative to 0.1 s (REG VII.F.1) | GRIID-002, STAGE-006 |
| Q2 | ANSWERED | "40 MPH"; pause "0 MPH / 0m15s / 45 MPH"; timed "30 MPH / 0m36s / 45 MPH"; "(0m30s)" advisory; "CDT 8:55:00" (REG VII.B.3.c(4)) | GRIID-002 |
| Q3 | ANSWERED | Front tires even with the sign; at intersections at the referenced control sign, else centre/apex (REG VII.E.2) | GRIID-007 |
| Q4 | PARTIAL | "The pause time is added to the time for the leg" (glossary); green-light case not stated; default stands | REG-006 |
| Q5/Q16 | ANSWERED | Multiples of 10 s up to 29m30s, filed at printed TA points within 15 min with stage/car/leg/instruction numbers; committee may reduce/refuse; wrong leg not corrected (REG V.H) | TA-001..006 |
| Q6 | ANSWERED | 1 s per second; max late 2 min, max early 5 min; missed CP 3 min; >30 min late = missed; final CP missed = DNF/FNS; sight-zone 30 s is "stopping or <= 5 mph within sight of a Timing Checkpoint"; no late-start penalty (REG V.E) | REG-001, REG-005 |
| Q7 | ANSWERED | Full table (REG V.D): 1939 = 0.845; steps of 0.005/yr to 1930, 0.010/yr to 1900 | REG-002 |
| Q8/Q19 | ANSWERED | Championship discards pooled over stages 1-7: GC 3, Expert 4, Sportsman 5, Rookie 6, X-Cup 5 (REG I.F.3); none per stage | REG-003 |
| Q9 | ANSWERED | Trophy Run is tiebreak only, after older Scoring Year (REG V.C.2.f) | REG-004 |
| Q10 | ANSWERED | Exactly 30 minutes before the team's start (REG VII.B.2.a) | - |
| Q11/Q17 | ANSWERED | Every start/restart = printed time of day + assigned start position in minutes; lunch sits inside a transit ("leave 45 min prior to end-of-transit"); self-start on your own clock, nobody releases you (HB p.13) | STAGE-002, STAGE-005 |
| Q12/Q22 | NOT IN DOCS | Handbook example car: 0->35 loses 3.8 s net (about 7.6 s), brakes ~11-12 ft/s2; Packard apex 15 mph. Josh to measure the Ford. | CHART-001 |
| Q13 | OPEN | MBCA video not read; Josh to supply YouTube transcripts (.vtt) | - |
| Q14 | ANSWERED | Tire warm-up and calibration run are free zones with transit allowances; leg 1 starts at the time-of-day restart (REG V.B.2) | STAGE-001, STAGE-006 |
| Q15 | ANSWERED | Pauses only where printed; 2014 Trophy Run: every STOP + some signals; 2026 example: two controls without | REG-006 |
| Q18 | ANSWERED | Finish Observation Checkpoint is a mandatory stop, not timed; TA submitted at TA points, scorecard acknowledged (REG V.A.1.b) | STAGE-001, TA-002 |
| Q20 | ANSWERED | 15 to 55 in steps of 5; 50/55 on highways, 20 common in 2014 | STAGE-007 |
| Q21 | PARTIAL | Timewise 825 is the official unit, stock allowed, digital displays prohibited (REG II.H); Timewise factor/clicks in HB App. C | CHART-005 |
| Q23 | NOT IN DOCS | Dad has no preferences yet; HB p.15 tips become the protocol lesson | LESSON-002 |
| Q24 | PARTIAL | HB: digital stopwatch with lap/split + TOD "a necessity"; analog dash clock; count "3, 2, 1, GO"; bezel never mentioned. Josh defers to the documents: digital stopwatch with lap/split + TOD by default, analog clock; analog stopwatch kept as an option | UI-033, WATCH-008/009, LESSON-006, DRILL-026 |
| Q25 | NOT IN DOCS | Checkpoint density not stated; 2014 sheet shows a declared checkpoint-free zone | STAGE-004 |
| Q26 | ANSWERED | Written text is Column D (example rally); real race sheets carry only remarks there | GRIID-001, GRIID-009 |

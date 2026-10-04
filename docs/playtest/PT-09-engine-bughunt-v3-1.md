# PT-09 - Engine and agent-protocol bug hunt, round 2 (v3.1 build)

Date: 2026-10-04. Build under test: `8b8a59f` (HEAD, tree clean except untracked playtest files), `ENGINE_VERSION` 3.1.0, 558 unit tests green (`npx vitest run`, 25 files). Read-only on `src/`, `tests/`, git; every
probe is a standalone script `playtest-scripts/pt09-*.ts` (`npx tsx playtest-scripts/<name>.ts`, no build needed). The PT-08 playability agent was working the UI at the same time; no overlap.

Method: STATUS HANDOFF, PT-06, API.md, LOG "Fix sprint PT-05/PT-06", "Education fix sprint v3" and "UI fix sprint PT-07", then the code of the new rubrics (`src/core/drills/*`), the protocol (`src/agent/protocol.ts`) and the
scoring/campaign code, then sweeps: all 43 PT-06 repro scripts re-run, 16 drive drills x 3 tiers x 10 seeds x 8 bots (3 840 runs), 1 800 determinism runs, 50 'day' + 50 fullLeg + 50 'varied' + 120 other-profile
generator runs, 34 checkpoint-note and 20 elapsed-note format cases, 15 per-driver D06 cases, protocol sessions at rungs 0-3. Hidden truth was used only to explain a finding after it showed up.

**Result: 0 HIGH, 5 MEDIUM, 13 LOW new; PT-06 MEDIUM 1-8 and LOW 9-13, 15-19 are all closed, 0 regressions.** The determinism and protocol-redaction work is solid. The new problems are in the rubrics (a faithful
measurer cannot earn D06 stars; four gates can be passed by the team the drill is meant to stop; D17 can be sprayed) and in one protocol gap (`untilEvent` sleeps through an exact-transit OUT).

Severity (PT-01 scale): HIGH = wrong result or a lost session in a documented path; MEDIUM = corrupt or stuck state on plausible input, a debrief or rubric that blames or credits the player wrongly, hidden-state or scoring semantics wrong; LOW = edge, hygiene, doc or latent.

---------------------------------------------------------------------------------

## 0. Ranked list of new findings

| # | Sev | Area | One line | Repro |
|---|-----|------|----------|-------|
| 1 | MEDIUM | D06 rubric | A faithful measurer cannot earn the stars: honest measurements from the run's own events give 3 stars on 7/10 Bronze seeds, 1/10 Silver, 0/10 Gold. Causes: speed-DOWN pairs of chart (a) are graded against a sign the sim never produces (40>20: chart +1.4, measured against the ghost -2.2); Section A stop-and-go stops are L/R turning stops (1.4 s dearer than the straight chart (b) cell) | pt09-d06.ts, pt09-accel-fidelity.ts, pt09-d06-turnstop.ts, pt09-chartb.ts |
| 2 | MEDIUM | protocol | `advance {untilEvent}` wakes for the launch at a time-of-day restart and in the pre-read only; at an exact-transit OUT hold and at the lunch (promoted-stop) hold `launchInfo()` is null, so the advance runs 2 942 s past the departure time without a stop | pt09-hold-launch2.ts, pt09-hold-launch.ts |
| 3 | MEDIUM | gates / rubrics | The team each drill exists to stop passes it: D04 `goCount` (counts from its own go) gets 2 stars on 10/10 Silver seeds (gate D18 needs 2) and 3 stars on 4/10 Gold seeds; D08 with no recovery passes the 2-star gate on 5/10 Silver seeds and earns 3 stars on 5/10 Gold seeds; D18 with no recovery earns 3 stars on 7-10/10 seeds at every tier and the rookie passes the D18 gate (D11) on 4/10 Silver seeds; a D15 "number spray" earns 1 star (gate for D12) | pt09-matrix.ts D04,D08,D18,D15 + pt09-matrix-report.ts, pt09-notes.ts section 3 |
| 4 | MEDIUM | D17 rubric | `elapsedAfterReset` keeps the best of ALL notes written after the reset: 1 201 guessed "elapsed m:ss" notes (one per 2 s) = 3 stars on 9/9 runs; a trailing period ("elapsed 4:05.") is unparsed (1 star), unit words are mis-parsed ("elapsed 12 min 25 s" -> 12 s) | pt09-spray.ts, pt09-notes.ts section 2 |
| 5 | MEDIUM | engine / oracle | The perfect-navigator oracle takes the wrong road and DNFs on a 55 > 20 (D12 Gold seed 2) and a 50 > 25 (D06 Gold seed 7) 90-degree turn with the rookie driver: "Too late, I can't make that turn" fires at > 1.6 x the 12 mph turn cap (19 mph) and a missed turn on a stage is an unrecoverable DNF | pt09-turnmiss.ts, pt09-offcourse.ts |
| 6 | LOW | generator (PT-06 LOW 14, open) | 25 of 611 timed lines (4.1 %) span an unprinted node or the plain slow zone (21 slow zones, 3 YIELD + 1 BLINKER); 19 of 100 generated scenarios have at least one | pt09-gen.ts |
| 7 | LOW | generator | The 2-minute free zone after a transit end is sized with the END ROW's speed (20 mph restart speed), not the ghost's time: day 43 puts the first CP 117.7 s after the end row; restarts are not checked at all by `validateScenario` | pt09-day43.ts, pt09-gen.ts |
| 8 | LOW | D15 grading | Bare numbers are not chart losses: the card's own example "10.2" is ungraded (`lossNumbers("10.2") = []`), "restart 9:41:00 -2" reads a stray 2, "loss: -2.3" counts twice; the pause / speed notations accept ANY number in the note | pt09-notes.ts section 1, 3 |
| 9 | LOW | D16 / D15 CP notes | `parseCpNotes` allows 6 filler characters ("CP1 at 9:14:22" ok, "CP1 arrived 9:14:22" and "Checkpoint 1 9:14:22" not graded); several notes for one CP are any-of (spray) | pt09-notes.ts section 1 |
| 10 | LOW | protocol | A scheduled `{watchReads: 0}` fires in the first tick of the pre-read; `{event:'featureVisible'}` with no label fires at tick 1 (the start banner is the first feature); a `when` with both `elapsed` and `event` is accepted (first key wins) | pt09-protocol.ts section 2 |
| 11 | LOW | protocol | `truth` (exact pace, car position) and `result` (perfect times, attribution, events) are answered at any aids rung and mid-run, so the rung <= 1 redaction (ENG-018) only binds a caller who does not ask; `truth` is documented as "for debugging only" | pt09-protocol.ts section 3 |
| 12 | LOW | oracle bot | `OracleBot` never laps at plain markers: D01 oracle = 0 stars at every tier (the lap skill is only in my `skill` bot); D06/D07/D15/D17 need their note-writing skill bots too. Not an engine bug, but "oracle fails 3 stars" is true for six drills for that reason | pt09-matrix.ts |
| 13 | LOW | D10 | The oracle gets 2 stars on 2 of 10 Bronze seeds (raw 12 and 15): the single leg of 12-15 turns loses 35-43 s and the recovery caps at 22 s, so the seed (not the navigator) decides 3 stars | pt09-why.ts D10 0 2 |
| 14 | LOW | debrief tip | D08 Bronze seed 10: "You lost 40 s in hazard and recovered 41 s in cruise; recover a little more" (the unrecovered 8 s is the no-pause STOP bucket, not hazard) | pt09-why.ts D08 0 10 |
| 15 | LOW | campaign | `championshipTotal` accepts fractional stage numbers (1.5 counts, whole, as a stage 8-9 style entry); `recordCampaignStage` stores a NaN / negative / Infinity score and a stored NaN then locks the stage (`e.score < prev.score` is never true) | pt09-campaign.ts |
| 16 | LOW | engine | `Simulator.act` throws for a `note` over 2 000 characters (Session answers an error; a direct caller, e.g. the UI, has to catch) | pt09-d06.ts section 1 |
| 17 | LOW | open from PT-06 | LOW 20 (CLI defaults to the analog watch, `gen:day` unknown), 21 (`observe({clock:true})` read lost by `replay`), 25 (`stopLoss(0,x)` -Infinity), 26 (`quit` answers an error), 27 (sub-second advance 0.1 s) are unchanged; LOW 22 (`rng.fork`) and LOW 24 (oracle laps at timed lines: discipline findings 0) turn out to be closed | pt06-*.ts re-run |

---------------------------------------------------------------------------------

## 1. Regression table: PT-06 bugs on the 3.1.0 build

All 43 `pt06-*.ts` scripts were re-run (outputs kept in the session scratchpad). "Closed" means the repro now gives the expected behaviour AND a negative control still flags the real mistake.

| PT-06 # | Sev | Subject | Now | Evidence |
|---|---|---|---|---|
| 1 | MED | stale `call.go` at v = 0 off a stop line | **closed** | pt06-stale-go: "premature go right after start: released not yet (waiting for the navigator)" |
| 2 | MED | `call.pullover` permanent | **closed** | pt06-pullover: after `call.go` v = 29.7 mph, target 30 |
| 3 | MED | `untilEvent` blows through the launch | **closed for the pre-read and restart** (new gap at transit OUT / lunch: new #2) | pt06-proto-start: wakes at 45 s, 30 s, 0 s; pt09-protocol: stops `launch` at toLaunch 30.0 and 0.0, never past |
| 4 | MED | hidden hazards depend on navigator actions | **closed** | pt06-rng-coupling: identical holds for oracle / rookie / noPause on 4 seeds; pt09-determinism: 5 families x 20 seeds x 9 bots, 0 divergent holds |
| 5 | MED | `oneMinuteMistake` / `lateLaunch` blame a late arrival | **closed**, negative control still flags | pt06-onemin-late-arrival / -restart: findings []; pt06-transit: go 56 s early / 60 s late still `oneMinuteMistake`; pt06-launch-edges thresholds unchanged (2.0 / 3.0 / 50-70 s) |
| 6 | MED | exact-transit IN clock read judged too early | **closed**, negative control still flags | pt06-in-clockread: reads at +0.5 s, +1 s, -1 s -> []; pt06-transit (no read) still `clockForTimeOfDay` |
| 7 | MED | `ta.request` after the finish / result peeking | **closed** | pt06-ta: "after finish: request refused; leg error 123 -> 123; reason: (empty)"; one request per leg now (11 retries refused) |
| 8 | MED | legacy / partial scenario files | **closed** | pt06-legacy-json: validate refuses; pt09-regress: an old file (no asp, partial rules) through `normalizeScenario` validates clean and the oracle finishes it, finite score |
| 9 | LOW | TA window closes one tick early | **closed** | pt06-ta-window 0/300 refused at exactly 900.0 s; pt06-ta-window-day 0 of 16 end-of-stage windows |
| 10 | LOW | printed-pause STOP inside a zone counted as delay | **closed** (residual 2.1 s is the stop's own cost reported in the stop bucket) | pt06-ta-stop-in-zone: qualifying 33.4 s with the STOP inside (hazard bucket 15.7, stop 17.3) vs 35.5 outside (was 47.0 vs 35.4) |
| 11 | LOW | TA form hygiene | **closed** | pt06-ta: 0.4 / 3 / 4.9 / 5 / 9.99 s refused ("at least 0m10s"), second request for a leg refused, 1.5 / 2.5 refused |
| 12 | LOW | stage score half-rounding | **closed** | pt06-score-rounding: mismatches 0 (5 x 0.845 -> 4.23) |
| 13 | LOW | standings float ties, repeated stage, `ageFactor(NaN)` | **closed** | pt06-standings: older Scoring Year first; pt09-campaign: repeated stage counts once, `ageFactor(NaN)` throws RangeError (pt06-scoring itself now exits on that throw, as intended); residual hygiene in new #15 |
| 14 | LOW | unprinted nodes inside timed intervals | **still open** (new #6) | pt06-gen-timed-nodes: 22 of 442; pt09-gen: 25 of 611 |
| 15 | LOW | stale events, `seconds` + `untilEvent` | **closed** | pt06-advance-args: `{seconds:10, untilEvent:true}` -> 3 s on the first event; a quiet stretch -> exactly 10 s; stops after `start` / `go` are now the real `carStarted` event |
| 16 | LOW | scheduling | **closed** (new nits in #10) | pt06-sched: `carStopped` never fires in the pre-read; `elapsed:"x"` and `event:"bogus"` -> error; cap 100; negative `elapsed` -> error |
| 17 | LOW | extra action fields kept | **closed** | pt06-extra-fields: no non-finite number in events, `result()` 1 590 bytes, actions not kept verbatim |
| 18 | LOW | observation leaks | **closed in `Session`** (UI reads `Simulator.observe` by design); see section 8 | pt09-protocol: rung 0 / 1 observations have no fractional field at all |
| 19 | LOW | pace cars in the calibration run | **closed** | pt06-pace-cal: paceCars present 0 of 1 269 samples at rungs 0, 1, 3 |
| 20 | LOW | CLI defaults | open | `cli.ts` `arg('watch','analog')`; `--scenario gen:day` -> "unknown profile day" |
| 21 | LOW | `observe({clock:true})` not replayable | open | pt06-replay-clock: live 1, replay 0 |
| 22 | LOW | `rng.fork` | **closed** (not on the "known open" list) | pt06-rng-fork: fork before and after 2 draws identical |
| 23 | LOW | lap memory / reset spec | not re-run (known open) | - |
| 24 | LOW | oracle `clockForInterval` at every timed line | **closed** | pt06-discipline: findings {} (was 114 of 114) |
| 25 | LOW | `stopLoss(0,x)` | open | pt06-accel: `stopLoss(0,35) = -Infinity`, `stopLoss(35,0) = NaN` |
| 26 | LOW | `quit` answers an error | open | `{"type":"quit"}` -> `{"type":"error","message":"unknown request"}` |
| 27 | LOW | small notes | open | `advance {seconds:0.05}` -> 0.1 s |

Regressions: none. Also unchanged: the `day` oracle sweep (11 of 50 seeds with raw >= 14 from trains and missing-pause traps, same as PT-06's 12), pt06-fuzz / fuzz2 (0 problems, 4 000 hostile payloads), pt06-replay (0 problems).

---------------------------------------------------------------------------------

## 2. Bot / star matrix per drill

`npx tsx playtest-scripts/pt09-matrix.ts <ids> 10 <out.jsonl>` then `pt09-matrix-report.ts` / `pt09-matrix-md.ts`. Each cell is the stars of seeds 1-10 in order (one digit per seed), then the median raw seconds (and the number of DNF seeds).
Bots: `oracle` = OracleBot with the stopwatch; `rookie` = ignores every loss (full pause, no lead, no recovery); `noPause` = goes at once and never recovers; `goCount` = counts timed segments from its own go; `wrongMinute` = leaves the first restart a minute late;
`noClockReads` = never reads the clock; `noCalibration` = never applies the morning factor; `skill` = the oracle plus the one thing the drill grades that the stock oracle never does (D01: lap at each marker; D06: write the true chart cells; D15: the ideal
notations plus the OUT time; D17: the "elapsed m:ss" note after the reset and restart the watch; D07: see pt09-d07.ts, notes + k; every other drill: identical to the oracle).
The D07 skill row is from `pt09-d07.ts` (full skill = 3 stars on all 30 runs; notes without k, or k without notes, = 0). Raw seconds are the stage raw (before the age factor).

| Drill | Tier | oracle | skill | rookie | noPause | goCount | wrongMinute | noClockReads | noCalibration |
|---|---|---|---|---|---|---|---|---|---|
| D01 | B | 0000000000 (0s) | 3333333333 (1s) | 0000000000 (0s) | 0000000000 (0s) | 0000000000 (0s) | 0000000000 (0s) | 0000000000 (0s) | 0000000000 (0s) |
| D01 | S | 0000000000 (1s) | 3333333333 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) |
| D01 | G | 0000000000 (1s) | 3333333333 (2s) | 0000000000 (2s) | 0000000000 (2s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) |
| D03 | B | 3333333333 (1s) | 3333333333 (1s) | 0000000000 (33s) | 0000000000 (76s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) |
| D03 | S | 3333333333 (2s) | 3333333333 (2s) | 0000000000 (49s) | 0000000000 (62s) | 3333333333 (2s) | 3333333333 (2s) | 3333333333 (2s) | 3333333333 (2s) |
| D03 | G | 3333323333 (3s) | 3333323333 (3s) | 1111100011 (49s) | 1000012201 (59s) | 3333323333 (3s) | 3333323333 (3s) | 3333323333 (3s) | 3333323333 (3s) |
| D04 | B | 3332333333 (1s) | 3332333333 (1s) | 0000000000 (17s) | 0000000000 (14s) | 2111122112 (1s) | 3332333333 (1s) | 3332333333 (1s) | 3332333333 (1s) |
| D04 | S | 3332333333 (1s) | 3332333333 (1s) | 1000011011 (16s) | 1010011101 (15s) | 2222222222 (1s) | 3332333333 (1s) | 3332333333 (1s) | 3332333333 (1s) |
| D04 | G | 3332333333 (2s) | 3332333333 (2s) | 1111111111 (16s) | 1121112111 (17s) | 3222223233 (2s) | 3332333333 (2s) | 3332333333 (2s) | 3332333333 (2s) |
| D05 | B | 3333333333 (1s) | 3333333333 (1s) | 0000000000 (2s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) |
| D05 | S | 3333333333 (1s) | 3333333333 (1s) | 1011111110 (3s) | 3332333333 (3s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) |
| D05 | G | 3333333333 (1s) | 3333333333 (1s) | 2122211111 (6s) | 3322332322 (5s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) | 3333333333 (1s) |
| D06 | B | 0000000000 (6s) | 3333333333 (6s) | 0000000000 (50s) | 0000000000 (47s) | 0000000000 (6s) | 0000000000 (39s) | 0000000000 (6s) | 0000000000 (6s) |
| D06 | S | 0000000000 (10s) | 3333333333 (10s) | 0000000000 (76s) | 0000000000 (50s) | 0000000000 (10s) | 0000000000 (45s) | 0000000000 (10s) | 0000000000 (10s) |
| D06 | G | 0000000000 (18s, DNF1) | 3333333333 (18s, DNF1) | 0000000000 (74s) | 0000000000 (57s) | 0000000000 (18s, DNF1) | 0000000000 (48s) | 0000000000 (18s, DNF1) | 0000000000 (18s, DNF1) |
| D07 | B | 0000000000 (2s) | 3333333333 (pt09-d07: notes + k) | 0000000000 (26s) | 0000000000 (32s) | 0000000000 (2s) | 0000000000 (2s) | 0000000000 (2s) | 0000000000 (2s) |
| D07 | S | 0000000000 (2s) | 3333333333 (pt09-d07: notes + k) | 0000000000 (27s) | 0000000000 (31s) | 0000000000 (2s) | 0000000000 (2s) | 0000000000 (2s) | 0000000000 (2s) |
| D07 | G | 0000000000 (1s) | 3333333333 (pt09-d07: notes + k) | 0000000000 (22s) | 0000000000 (10s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (1s) | 0000000000 (11s) |
| D08 | B | 3333333332 (0s) | 3333333332 (0s) | 0000000000 (31s) | 0000222220 (26s) | 3333333332 (0s) | 3333333332 (0s) | 3333333332 (0s) | 3333333332 (0s) |
| D08 | S | 3333333332 (1s) | 3333333332 (1s) | 1000101110 (31s) | 1010222330 (27s) | 3333333332 (1s) | 3333333332 (1s) | 3333333332 (1s) | 3333333332 (1s) |
| D08 | G | 3333333333 (2s) | 3333333333 (2s) | 1111111111 (32s) | 1311323331 (11s) | 3333333333 (2s) | 3333333333 (2s) | 3333333333 (2s) | 3333333333 (2s) |
| D08b | B | 3333333333 (25s) | 3333333333 (25s) | 0000000000 (107s) | 0000000000 (89s) | 3333333333 (25s) | 3333333333 (25s) | 3333333333 (25s) | 3333333333 (25s) |
| D08b | S | 3333333333 (27s) | 3333333333 (27s) | 0000000000 (108s) | 0000000000 (89s) | 3333333333 (27s) | 3333333333 (27s) | 3333333333 (27s) | 3333333333 (27s) |
| D08b | G | 3333333333 (28s) | 3333333333 (28s) | 0000000000 (108s) | 0000000000 (89s) | 3333333333 (28s) | 3333333333 (28s) | 3333333333 (28s) | 3333333333 (28s) |
| D10 | B | 3233333233 (5s) | 3233333233 (5s) | 1111111111 (69s) | 2223333232 (11s) | 3233333233 (5s) | 3233333233 (5s) | 3233333233 (5s) | 3233333233 (5s) |
| D10 | S | 3333333233 (5s) | 3333333233 (5s) | 1111111112 (67s) | 3233333232 (11s) | 3333333233 (5s) | 3333333233 (5s) | 3333333233 (5s) | 3333333233 (5s) |
| D10 | G | 3333333333 (5s) | 3333333333 (5s) | 1111111113 (65s) | 3333333333 (14s) | 3333333333 (5s) | 3333333333 (5s) | 3333333333 (5s) | 3333333333 (5s) |
| D11 | B | 3333333332 (1s) | 3333333332 (1s) | 0000000000 (120s) | 3000000000 (21s) | 3333333332 (0s) | 3323332332 (1s) | 3333333332 (1s) | 3333333332 (1s) |
| D11 | S | 3333333332 (0s) | 3333333332 (0s) | 0000000000 (120s) | 3001011000 (21s) | 3333333332 (0s) | 3323332332 (1s) | 3333333332 (0s) | 3333333332 (0s) |
| D11 | G | 3333333332 (1s) | 3333333332 (1s) | 0000000000 (120s) | 3011021110 (25s) | 3333333332 (1s) | 3323332232 (1s) | 3333333332 (1s) | 3333333332 (1s) |
| D12 | B | 3333321233 (12s) | 3333321233 (12s) | 0000000000 (519s) | 0000000000 (169s) | 3333321233 (11s) | 1003320011 (39s) | 3333321233 (12s) | 3333321233 (12s) |
| D12 | S | 2133321133 (15s) | 2133321133 (15s) | 0000000000 (533s) | 0000000000 (160s) | 2133321133 (15s) | 1003320011 (40s) | 2133321133 (15s) | 0000000000 (466s) |
| D12 | G | 3023321133 (17s, DNF1) | 3023321133 (17s, DNF1) | 0000000000 (519s) | 0000000001 (156s) | 3020221133 (21s, DNF2) | 0003330011 (67s, DNF2) | 3023321133 (17s, DNF1) | 0000000000 (414s, DNF1) |
| D13 | B | 3322333333 (7s) | 3322333333 (7s) | 0000000000 (460s) | 0000000000 (113s) | 3322333333 (7s) | 3322301130 (23s) | 3322333333 (7s) | 3322333333 (7s) |
| D13 | S | 3312323330 (8s) | 3312323330 (8s) | 0000000000 (490s) | 0000000000 (130s) | 3222323330 (18s) | 3312301130 (28s) | 3312323330 (8s) | 0000000000 (422s) |
| D13 | G | 3311323330 (9s) | 3311323330 (9s) | 0000000000 (487s) | 0000000000 (146s) | 3211323330 (23s) | 3311301130 (28s) | 3311323330 (9s) | 0000000000 (325s) |
| D15 | B | 0000000000 (10s) | 3333333333 (10s) | 0000000000 (114s) | 0000000000 (45s) | 0000000000 (10s) | 0000000000 (56s) | 0000000000 (10s) | 0000000000 (10s) |
| D15 | S | 0000000000 (11s) | 3333333333 (11s) | 0000000000 (115s) | 0000000000 (46s) | 0000000000 (11s) | 0000000000 (55s) | 0000000000 (11s) | 0000000000 (11s) |
| D15 | G | 0000000000 (11s) | 3333333333 (11s) | 0000000000 (116s) | 0000000000 (47s) | 0000000000 (11s) | 0000000000 (57s) | 0000000000 (11s) | 0000000000 (11s) |
| D16 | B | 3333333333 (0s) | 3333333333 (0s) | 1111111111 (13s) | 3333333333 (1s) | 3333333333 (0s) | 0000000000 (36s) | 2222222222 (0s) | 3333333333 (0s) |
| D16 | S | 3333333333 (1s) | 3333333333 (1s) | 1111111111 (14s) | 3333333333 (3s) | 3333333333 (1s) | 0000000000 (37s) | 2222222222 (1s) | 3333333333 (1s) |
| D16 | G | 3333333333 (1s) | 3333333333 (1s) | 1111111111 (15s) | 3333333333 (5s) | 3333333333 (1s) | 0000000000 (37s) | 2222222222 (1s) | 3333333333 (1s) |
| D17 | B | 1111111111 (2s) | 3333333333 (2s) | 1111110001 (26s) | 1010011000 (32s) | 1111111111 (2s) | 1111111111 (2s) | 1111111111 (2s) | 1111111111 (2s) |
| D17 | S | 1111111111 (2s) | 3333333333 (2s) | 1111111001 (27s) | 1111011110 (31s) | 1111111111 (2s) | 1111111111 (2s) | 1111111111 (2s) | 1111111111 (2s) |
| D17 | G | 1111111111 (1s) | 3333333333 (1s) | 1111111111 (22s) | 1111111111 (10s) | 1111111111 (1s) | 1111111111 (1s) | 1111111111 (1s) | 1111111111 (11s) |
| D18 | B | 3333333333 (0s) | 3333333333 (0s) | 0000000000 (24s) | 2333332332 (3s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) |
| D18 | S | 3333333333 (0s) | 3333333333 (0s) | 0011010010 (24s) | 2333333332 (3s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) |
| D18 | G | 3333333333 (0s) | 3333333333 (0s) | 1111111121 (24s) | 3333333333 (4s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) | 3333333333 (0s) |

### 2.1 Reading the matrix

- **The oracle earns 3 stars at Bronze on D03, D05, D08b, D18 (10/10), and 9/10 on D04 (seed 4: 2 stars, raw 3), D08 (seed 10: 2, raw 7: signal + slow truck), D11 (seed 10: a train), 8/10 on D10 (seeds 2, 8: 12 and 15 s of unrecoverable turn loss) and D13 (seeds 3, 4: 2 stars), 7/10 on D12 (seeds 6 and 8: 2 stars, seed 7: 1 star; trains and missing-pause traps).** D01, D06, D07, D15, D17 are 0-1 stars for the stock oracle because they grade notes or laps the bot never makes; the `skill` bots earn 3 stars on 10/10 seeds at every tier (D06 and D15 are graded from the printed truth, so that only proves reachability from the answer sheet; D06 from honest measurement is new #1).
- **Naive teams that correctly stay below 3 stars**: D03 rookie / noPause 0 at Bronze and Silver, 1-2 at Gold; D04 rookie / noPause 0 at Bronze, <= 2 at Silver and Gold; D05 rookie 0 (Bronze), 1 (Silver), <= 2 (Gold); D08 rookie 0-1; D10 rookie 1 (one Gold seed 3); D11 rookie 0, noPause 0-3 (only seed 1); D12 rookie / noPause 0; D16 rookie 1 star, wrongMinute 0, noClockReads 2 (so "no clock reads" cannot reach 3), D17 oracle 1 (no elapsed note); D18 rookie 0 / 1; D01 / D06 / D07 / D15 without the skill: 0.
- **Naive teams that reach 3 stars** (the bot is the drill's naive team; irrelevant bots such as `goCount` on D03 are not listed):
  - D04 `goCount` (the drill's exact error): Silver 2 stars on 10/10 seeds, Gold 3 stars on seeds 1, 7, 9, 10 (3222223233). It is wrong only at the two STOP + timed lines, the rubric averages over six changes (new #3).
  - D08 `noPause` (never recovers; D08 teaches recovery): Bronze 2 stars on 5/10, Silver 3 stars on 2/10 and >= 2 on 5/10, Gold 3 stars on 5/10 (1311323331). Gold's three-star threshold is a 4.4 s mean leg error (2 x 2.2) and the unrecovered loss is spread over the legs (median raw 11).
  - D18 `noPause` (never recovers): 3 stars on 7/10 Bronze, 8/10 Silver, 10/10 Gold; the hazard costs about 3 s against a 4 s three-star threshold. The rookie passes the D18 >= 1 gate (opens D11) on 4/10 Silver seeds (0011010010).
  - D10 `noPause` (no recovery): 3 stars on 5/10 Bronze, 7/10 Silver, 10/10 Gold; D10 grades staying on course first, so this is mostly design, but the 2-star gate (D18) is passed 10/10 at Silver.
  - D15 number spray (new #3, #8): 1 star at every tier.
  - D17 guess spray: 3 stars (new #4).
- **Gates a naive team passes at Silver** (Silver is what `unlockBest` counts): D04 >= 2 (10/10 `goCount`), D08 >= 2 (5/10 `noPause`), D10 >= 2 (10/10 `noPause`, 1/10 rookie), D18 >= 1 (4/10 rookie, 10/10 `noPause`), D16 >= 1 (10/10 rookie: by design, the late-launch cap is 1 star), D11 >= 1 (4/10 `noPause`), D15 >= 1 (spray). Gates the naive team does NOT pass: D03 >= 2, D05 >= 2, D07 >= 2, D16 >= 2 (rookie 1; `noClockReads` passes it with 2 stars but is not naive about departures), D12 >= 1 (rookie / noPause 0), D06 >= 1 without notes.
- **DNFs from an off-course oracle**: D12 Gold seed 2 (oracle, `skill`, `noClockReads`, `wrongMinute`, `goCount`), D12 Gold seed 1 (`wrongMinute`), D12 Gold seed 4 (`goCount`, `noCalibration`), D06 Gold seed 7 (oracle, `goCount`, `noClockReads`, `noCalibration`, `skill`): new #5. No DNF at Bronze or Silver anywhere.
- **Silver D12 / D13 `noCalibration`**: 0 stars everywhere (raw 466 / 422): the hidden stock speedometer is only drivable with the factor, as designed; at Bronze the speedometer is perfect, so `noCalibration` = oracle.
- **D11 / D12 `wrongMinute`**: the D12 bot leaves the first restart one minute late and still gets 3 stars on 2/10 Bronze seeds (the oracle recovers 56 s in the next leg): the `oneMinuteMistake` finding does not touch D12's stars (basicRubric reads only leg errors). D11 has no restart row after line 1, so the bot never fires there (bot gap).

---------------------------------------------------------------------------------

## 3. D06 raw-run parsing and grading (task 3)

`pt09-d06.ts`, `pt09-accel-fidelity.ts`, `pt09-chartb.ts`, `pt09-d06-turnstop.ts`.

**Parsing is robust.** 41 malformed notes (empty, "stopgo 30>40 = abc", "= Infinity", "= NaN", "runs" with nothing after, "runs 8.4 8.6 x 8.5", ">40 = 8", "30>40>50", comma decimals, "A: B:" stacked tags, 200 000 characters of "a", 100 000 spaces then a valid note) never throw (except as below), never produce NaN / Infinity in the rubric, and the 200 000-run note parses in 132 ms. A note over 2 000 characters is refused by `validateAction`, which `Simulator.act` throws on (LOW #16; `Session.handle` answers an error).
**Raw runs.** Generated const / acc / brk runs for 25-55 mph through `parseRawRuns` + `deriveFromRaw` reproduce chart (b) exactly (worst error 0.00 s over all 49 IN > OUT pairs; derived acc cells 0.00 s). Negative derived cells are named ("Your chart cell accel 0>30 = -1.00 s is NEGATIVE ...") and a stop-and-go above 15 s is flagged ("16.5 s: you would sit longer than the printed pause"); a negative derived cell is not credited.
**Per-driver tags.** At a driver-A scenario "A:", "a:", "driver A", "driver A:", "A -" and "A <note>" all count; "B: <correct>" is ignored ("not noted"); "B: wrong then A: right" credits A; two untagged notes: the last wins; a tag in the middle of a note ("... B: stopgo ...") works. At Bronze the driver is always A (the Packard table car); at Silver / Gold a 50 % seeded driver-B variant (a0 x 0.9, aDec x 0.93) is hidden behind the tag.
**55 mph at Silver.** Pairs with a 55 mph leg (10 of 12 Silver seeds) are graded against the model Ford's own 55 cell and are NOT flagged "extrapolated" (that list is only the Packard's `[55]`): the Silver / Gold hidden car is a model, so there is nothing extrapolated, and the note is consistent.

**Fairness (new #1).** The run's own events give what a person with a stopwatch can measure between the MARK lines (rookie bot = no lead, no recovery, full pause; measurement = loss against the ghost; for a stop and go, dwell + seconds early):

| Cell kind | Bronze (Packard table) | Silver | Gold |
|---|---|---|---|
| stop & go (A) | 30 of 30 within 1 s | 16 of 30 outside 1 s, mean bias -1.1 s | 14 of 30 outside, mean bias -1.0 s |
| accel / decel (B) | 16 of 30 outside, worst 3.9 s | 11 of 30 outside, worst 7.1 s | 13 of 30 outside, worst 8.1 s |
| turn (C) | 30 of 30 within 1 s | 5 of 30 outside | 10 of 30 outside (rookie driver noise) |
| stop in the middle (D) | 1 of 10 outside | 2 of 10 | 6 of 10 |
| **stars of an honest measurer (notes = what the run measured)** | **2 2 3 2 3 2 3 3 3 3** | **1 1 2 2 2 2 3 1 2 2** | **1 1 2 1 1 0 2 1 2 1** |

Two causes found:
1. **Speed-down pairs of chart (a).** `speedChangeLoss` defines a deceleration cell as the time over staying at the OLD speed (`t - c.s / mphToFps(vFrom)`, positive), but the drill text says "net seconds lost against the ghost", and against the ghost a slow-down gains time. pt09-accel-fidelity.ts (Ford, call at the sign, 3 seeds): 30>40 chart 0.50 / measured 0.50; 20>40 1.60 / 1.60; 25>50 2.40 / 2.30 (speed-ups agree to 0.1 s) but 40>30 0.50 / **-0.50**, 40>20 1.40 / **-2.23**, 50>25 1.70 / **-2.47**, 35>20 1.00 / **-1.20**. D06 draws speed-down pairs (`pick3(..., minGap 10, firstFromZero)`) in one of two or three Section B pairs, so a correct measurement of a decel pair is graded wrong by up to 4 s.
2. **Turning stops in Section A.** `b.stop(r.pick(['L','R']), vo, { pause: 15 })` makes every stop-and-go a 90-degree turning stop, which the sim charges about 1.4 s more than a straight stop (pt09-d06-turnstop.ts: 30>30 straight 9.3, L 7.9, R 7.9 s of measured chart pause; 35>40 7.3 / 5.8 / 5.8), while the graded truth is the straight chart (b) cell (verified equal to 15 - physical `stopLoss` to 0.1 s for the Ford, pt09-chartb.ts). The Packard (Bronze) is table-driven so it ignores the turn: that is why Bronze is exact and Silver / Gold are not.

Proposed fix: `src/core/drills/d06.ts` `D06.scenario`: Section A `.stop('S', vo, { pause: 15 })`; Section B `pick3(...)` only pairs with `vOut > vIn` (keep `0 > v`), or label the decel cell "seconds over staying at the old speed" and grade the measured value as `-measured`; `D06.rubric` `truth()` stays. Add a test that a measurement-from-events passes within 1 s for every generated pair on the Ford at Silver.

---------------------------------------------------------------------------------

## 4. D15 / D16 / D17 note grading edges (task 4)

`pt09-notes.ts`, `pt09-spray.ts`.

**Checkpoint notes (D15, D16; `parseCpNotes` + `gradeCheckpointNotes`).** 32 of 34 cases behave as designed: "CP1 9:14:22" and "CP1 09:14:22" are the same time (both graded, and "CP1 21:14:22", "CP1 9:14:22 PM", 12 h wrap at 12:59:59 / 1:05:10 / 13:05:10 are equal modulo 12 h); case, "CP 1", "CP#1", "CP1:", "CP1 - ", "CP1=", leading / trailing / tab / newline whitespace, "CP01", "CP1 9:14:22.4" all parse; 2 s early / late is right (9:14:20 and 9:14:24), 3 s is not (9:14:19, 9:14:25); "CP2 9:14:22" for CP1 and "CP10" are not credited; "9:14:22 CP1" (time first) and "CP1 9:14" (no seconds) are not graded (acceptable); only `line.annotate` notes count (a `note` action is "attempted false").
Edges: "CP1 arrived 9:14:22" and "Checkpoint 1 9:14:22" are not parsed (`\D{0,6}?` allows six filler characters; LOW #9); `mine.some(...)` is any-of, so several notes for one CP are a free spray.
**Chart losses (D15, `lossNumbers`).** "loss 10.2", "-2.3", "+10.2", "chart: 2.3", "lost 4" parse; **bare "10.2" does not** (the PREREAD-001 hint prints `"10.2", "-2.3"` as examples), "35 mph - 2.3" gives nothing, "restart 9:41:00 -2" gives 2, "loss: -2.3" gives 2.3 twice, "loss 2,3" gives 2 (LOW #8). `needsSpeed`, pause and carry notations accept any number within 0.5 / 1 of the target anywhere in the note: a note of every multiple of 0.5 from 0 to 60 plus "comes quick" on every line (`pt09-notes.ts` section 3) earns 1 star at every tier (no restart / OUT knowledge needed; the restart time lifts it to 2; the printed-pause answer is the only thing that scores 0).
**D17 elapsed note (`elapsedAfterReset`).** Graded as designed: "elapsed 4:05", "Elapsed 4:05", "elapsed: 4:05", "elapsed = 4:05", "elapsed 4m05.0s", "elapsed 245.3", extra whitespace, upper case, "elapsed 4:05 (restarted)", "elapsed 4:05, cal at 2:00" all 3 stars when within 2 s and the watch restarted; 2 s off = 2 stars, 6 s off = 1; a note before the reset, a note anchored at the start instead of the asterisk: 1 star; no watch restart: 2. Not parsed (1 star): bare "4:05", "el 4:05", "elapsed time 4:05", "elapsed is 4:05", "elapsed since asterisk 4:05", **"elapsed 4:05." (trailing period)**, "elapsed 0:04:05" (hh:mm:ss), "elapsed 4:5" is read as 4:05; **"elapsed 12 min 25 s" is read as 12 s** (wrong parse, error 733 s; `parseDuration` has no unit-word form). **Spray (new #4):** the grader keeps the best of every note after the reset (`for (const n of notes) ... best = min err`), so 1 201 guessed notes written in one instant (every 2 s from 0:00 to 40:00) = 3 stars on 9 of 9 runs (3 tiers x 3 seeds).
Proposed fixes: `src/core/drills/index.ts` `elapsedAfterReset` (grade the first, or last, "elapsed" note after the reset, and cap at N notes; accept a trailing `.`/`,`; teach `parseDuration` "4 min 5 s"); `preread.ts` `lossNumbers` (accept a bare number only when the line is a stop or turn, and drop `|x|` duplicates) and `parseCpNotes` (accept up to 12 filler characters and the word "checkpoint"); D15 `rubric` (count a pause notation only for the number that follows "pause"/"dwell" or is the only number).

---------------------------------------------------------------------------------

## 5. Determinism after the keyed RNG change (task 5)

`pt09-determinism.ts 20`: five scenario families (builtin `varied`, D18 Gold, D03 Gold, D16 Silver with asp, a generated fullLeg with `trafficWaitProbability` 0.5) x seeds 1-20 x nine bots (oracle, rookie, noPause, lateCall, goCount, wrongMinute, noClockReads, noCalibration, random) = 900 combinations, each run twice live (1 800 runs) and replayed with `replay()` (900 replays), plus seeds 1-4 re-run with `observe({peek:true})` and `pace()` called every tick.
Result: **0 problems.** Two live runs give identical `result()` JSON for all 900; `replay(scenario, sim.actions)` equals the live result for all 900 (including the random bot and bots with 1.5 s latency); extra `observe()` / `pace()` peeks do not change any run (the pace-car draws no longer consume the shared stream); the cross-traffic hold at each STOP (sampled as `trafficClearTod - tod` at the first waiting tick) is the same for every bot: of the 20 seeds per family the holds exist on 10 (varied), 5 (D18), 16 (D03), 20 (fullLeg) seeds and never diverge by more than the 0.2 s sampling step (PT-06 #4 was 0 / 10.8 / 7.6 s for the same node). Stepping a no-bot run in 0.1 / 0.5 / 1 / 2.5 s chunks lands on the same position and speed (the tick counter reads 3 001 vs 3 000 only because my loop accumulates float 0.1).
Not covered here: `observe({clock:true})` (LOW 21 stays open: the read is not an action, so replay drops it).

---------------------------------------------------------------------------------

## 6. Generator sweep (task 6)

`pt09-gen.ts all 50` (80 s).

- **'day' (fullStage), 50 seeds:** `validateScenario` and `checkRouteExits` clean on all 50; the oracle finishes 50 / 50 (no DNF, no missed CP, no off-course); mean raw 8.1, max 40, 11 seeds >= 14 (trains and the missing-pause traps, as in PT-06); every assigned / timed speed is 10-55; 4-6 timing checkpoints on every day; Column C prints a pause exactly where `ins.pause` is set and no pause sits on a control-less node; every End timed portion is followed by a TA point (also the end of stage); calibration runs have 3-6 points (min 3, max 6; asterisk not counted); one violation of "no checkpoint within 2 minutes of a transit end / restart": **seed 43** (new #7, below).
- **fullLeg x 50:** clean, oracle finishes 50 / 50, mean raw 3.7, max 34 (6 seeds >= 14). **builtin 'varied' x 50:** valid, speeds 10-55, oracle mean raw 1.6, max 8. **pauseDrill, timedDrill, landmarkDrill, calibration, recovery, combo x 20 seeds:** clean, mean raw 0.3-1.5, max 10 (recovery).
- **LOW 14 frequency (day x 50 + fullLeg x 50):** 611 stopwatch-timed lines; **25 (4.1 %)** span something the book does not print: 21 the plain slow-vehicle zone (3.4 %), 4 an unprinted control (3 YIELD: day 14 line 104, day 20 line 162, fullLeg 30 line 3; 1 BLINKER: day 19 line 134); 19 of the 100 scenarios have at least one. PT-06 measured 22 of 442 (5.0 %) on days only, so the frequency is unchanged. A make-up inside the interval is a `timedIntervalDisturbed` finding.
- **New #7:** `validateScenario` / `generate.ts` (`freeZoneFtAfterTransit`, "2-minute free zone after the transit") size the zone as `end-row speed x 120 s`. Day 43's restart line assigns 20 mph, then line 11 assigns 35 mph, so the zone is 3 520 ft but 120 s of ghost time is about 4 300 ft; cp1 sits at 4 382 ft = 117.7 s of ghost time (pt09-day43.ts). The validator checks only `transit.end` rows, not time-of-day restarts. Fix: `src/core/course.ts` `validateScenario` (use `ghostTimeAt` for both the end row and each restart) and `src/core/generator/generate.ts` (`chooseCheckpoint` with `freeZoneFtAfterTransit` from ghost time).

---------------------------------------------------------------------------------

## 7. Campaign (task 7)

`pt09-campaign.ts`: 25 checks.
Closed / correct: discards per division (grand 3, expert 4, sportsman 5, rookie 6, xcup 5) over the pool of stages 1-7 only, stages 8-9 kept whole, the age factor 0.845 from `opts.year` 1939 (summary uses `FORD_1939.year`), `roundFactored` half-up; stage 0 and stage 10 / negative / NaN stage numbers ignored; a repeated stage counts once (the later entry); fewer items than discards -> 0; DNF on stage 8 or 9 removes eligibility, on 1-7 or a replayed-clean 8 does not; `ageFactor` table 1953 0.915 / 1954 1 / 1939 0.845 / 1930 0.8 / 1929 0.79 / 1900 0.5 / 1899 0.5; ties (to the 0.01 s, then older Scoring Year, then Trophy Run position, no position last; 0.004 apart is a tie, 0.005 is not); store: `recordCampaignStage` maps stage 10 (seed 10) to stage 0 and keeps the lower score, ignores stages 11 / -1 / 2.5, keeps the better replay and ignores a worse one; tiers 0-2 are independent (D13 names them Bronze / Silver / Gold, `legalTiers`; an unknown tier is an empty campaign); a stage stored without `penaltyItems` counts whole and is listed in `withoutDetail`; the division switch changes the discard count; corrupt JSON and null / string stage entries do not throw.
Findings (LOW #15): `championshipTotal` takes `stage` 1.5 (the filter is `>= 1 && <= 9`, not integer; unreachable from the UI, which checks `Number.isInteger`); `recordCampaignStage` stores NaN / Infinity / negative scores (a NaN is saved as null) and `e.score < prev.score` is then never true, so a later real score can never replace it; items with NaN or Infinity in `penaltyItems` give an `afterDiscards` of 0 (NaN is swallowed by the sort). Hand-edited localStorage only. Fix: `src/core/scoring.ts` `championshipTotal` (`Number.isInteger(stage)`, drop non-finite items), `src/ui/viewmodels/campaign.ts` `recordCampaignStage` (reject non-finite or negative `score` / `raw`; replace when `prev.score` is not finite).

---------------------------------------------------------------------------------

## 8. Protocol (task 8)

`pt09-protocol.ts`, `pt09-hold-launch.ts`, `pt09-hold-launch2.ts`.

- **untilEvent and readbacks:** after `call.speed 41` a 5 s untilEvent advance runs the full 5 s (the "Holding 41" readback is not a stop; the act's own events are in the next reply's `events`, not stop reasons). Quiet stretches return `stoppedOn: null` at exactly `seconds`.
- **Pre-read:** with asp 2 and a 300 s pre-read at rung 0 and 2, three advances stop at `driverMessage:Give me about 30 seconds before we go` (toLaunch 45.0), `launch` (30.0) and `launch` (0.0); the next advance stops after 0.1 s at -0.1: it never runs past the launch. A drill-sized start (D03) wakes `launch` 26 s in, then `Leaving 4 s early`, `carStarted`, `At 35`, the first feature, the first stop.
- **New #2:** `launchInfo()` is non-null only at the start and at a time-of-day restart. At D16's exact-transit OUT hold (OUT 772 s ahead) an untilEvent advance ran 713 s (one `featureVisible`) and then 3 000 s with no stop, ending 2 942 s past the departure with the car still waiting; the lunch (promoted) hold behaves the same (`holdGoTod` is 246 s ahead, `launchInfo` null). `observe()` carries no seconds-to-go for either hold at rungs <= 1. Fix: `src/core/sim.ts` `launchInfo()` (add kinds `transitOut` / `lunch` using `holdGoTod`, same fields) and `src/agent/protocol.ts` `advance` (the existing `launch` stop logic then applies); keep the rung <= 1 redaction (`launch: null`) but have `advance` read `this.sim.launchInfo()` directly, as it does now.
- **Scheduled actions in the pre-read:** `{elapsed: 100}` armed at the pre-read start fires at +100.0 s (start executed at 28 780 against a start time of 28 800); `{elapsed:5}` note fires at 5.0 s; `{event:'carStarted'}` does not fire in the pre-read (ENG-016); schedule + `cancel` -> `cancelled 1`; `elapsed:-1` -> error. Nits (LOW #10): `{watchReads:0}` and `{event:'featureVisible'}` (no label) fire in the first tick of the pre-read; `{elapsed:1, event:'carStopped'}` is accepted. Fix: `src/agent/protocol.ts` `validateWhen` (exactly one trigger key; `watchReads > 0`) and `fireScheduled` (`watchReads` only while the watch runs; `featureVisible` needs a label or a feature that appeared after arming).
- **Redaction at aids rung <= 1 (ENG-018):** at rungs 0 and 1 the pre-read and running observations contain **no fractional number** outside the geometry and instrument fields (tod, secondsToStart whole; `launch` null; `startQueue.carAheadLeavesTod` null and `cars[].leavesTod/sitting` stripped; `paceCars.*.errorSeconds` stripped until the finish; hourAngle coarsened to 2.5 steps (5 minutes) while the minute is ambiguous, `clock.minute` null). **Rungs 2 and 3 still get them:** `launch` {ownTime, netLoss 5.2, launchTime, secondsToLaunch}, fractional `tod` (28 856.1), fractional `secondsToStart`, the exact hourAngle (240.468) and `clock.minute`, `aids.earlyLate`. The second hand and minuteAngle stay exact (the minute is resolvable from them with the seconds, as on a real dial; the hidden `looseness` is +-5 s). `truth` and `result` are not gated (LOW #11).

---------------------------------------------------------------------------------

## 9. Proposed fixes by bug (file, function)

| # | File | Function | Change |
|---|------|----------|--------|
| 1 | src/core/drills/d06.ts | `D06.scenario` (Section A and B), `rubric` | straight stops in A; B pairs speed-up only (or grade decel as `-measured`); tolerance 1 s stays; test: honest measurement within 1 s for all pairs |
| 2 | src/core/sim.ts / src/agent/protocol.ts | `launchInfo`, `advance` | launch info for exact-transit OUT and the promoted lunch hold from `holdGoTod`; `launch` stop at -30 s and 0 |
| 3 | src/core/drills/index.ts (D04, D08), staged.ts (D18), d15.ts | rubrics | D04: also take the worst per-STOP-line call error (`callErrors` for lines with `pause`) so the goCount error costs a star; D08: `taRecoverable`-based or thresholds not x2.2 at Gold and require recovered >= lost - 3; D18: make the hazard cost >= 8 s or thresholds 2 / 4 / 8; D15: pause credit only for the number after "pause"/"dwell" |
| 4 | src/core/drills/index.ts | `elapsedAfterReset`; src/core/drills/d07.ts `parseDuration` | first note after reset, trailing punctuation, unit words |
| 5 | src/core/sim.ts / src/agent/bots.ts | `crossNode` turn check, `driverStep` braking for an armed turn; `OracleBot` turn lead | start braking for an armed 90-degree turn at a distance from the approach speed (rookie too); oracle calls the turn at max(600 ft, 9 s) |
| 6 | src/core/generator/generate.ts, src/core/course.ts | slow-zone placement, `validateScenario` | any control node, route turn or slow zone bounds a timed interval |
| 7 | src/core/course.ts, generate.ts | `validateScenario`, `chooseCheckpoint` | free zone from ghost time; check restarts |
| 8, 9 | src/core/drills/preread.ts, d15.ts | `lossNumbers`, `parseCpNotes`, rubric | see section 4 |
| 10 | src/agent/protocol.ts | `validateWhen`, `fireScheduled` | see section 8 |
| 11 | src/agent/protocol.ts | `handle` `truth` / `result` | refuse mid-run or at rung <= 1 (or document as debug) |
| 15, 16 | scoring.ts, campaign.ts, sim.ts | see sections 7 and 3 | - |

---------------------------------------------------------------------------------

## 10. Coverage and limits

- Covered: tasks 1-8 as listed; all drive drills D01-D13, D15-D18 (D09 and D14 are quiz / math, no engine) at all tiers, seeds 1-10, 8 bots.
- Not covered: the UI (PT-08 does that); `observe({clock:true})` replay (open LOW 21); human reaction on D01 (the lapper bot has zero latency, so Gold 3 stars on D01 says nothing about thresholds a person can hit); the D13 campaign beyond its stage scenarios; paper-mode TA (`taMode:'paper'`) in drills.
- D06 `skill` and D15 `skill` bots use the printed truth, so they prove reachability only; D06 from honest measurement is the finding in section 3.

## 11. Script index (all in `playtest-scripts/`)
pt09-matrix.ts (the bot x drill x tier x seed matrix, JSON lines) | pt09-matrix-report.ts, pt09-matrix-md.ts (tables and flags) | pt09-d06.ts, pt09-accel-fidelity.ts, pt09-chartb.ts, pt09-d06-turnstop.ts (D06) | pt09-d07.ts (D07 skill) |
pt09-notes.ts, pt09-spray.ts (note grading) | pt09-determinism.ts | pt09-gen.ts, pt09-day43.ts, pt09-oracle-high.ts (generator) | pt09-campaign.ts | pt09-protocol.ts, pt09-hold-launch.ts, pt09-hold-launch2.ts (protocol) |
pt09-regress.ts (negative controls, file loader) | pt09-offcourse.ts, pt09-turnmiss.ts, pt09-why.ts, pt09-tiers.ts (diagnostics). Matrix runs take about 30 minutes in four processes (D12 / D13 dominate); pt09-gen.ts 80 s; pt09-determinism.ts a few minutes; the rest seconds.

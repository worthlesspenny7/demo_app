# Engine / harness issues found while building the generator (src/core/generator)

Each entry: symptom, minimal repro, status, and the generator-side workaround. The generator never modifies
sim.ts / course.ts / ghost.ts; it shapes courses so the OracleBot (truth-reading autopilot) stays within +-5 s per leg.

## 1. OracleBot: a stale timed change fires the next segment's speed early (intermittent)

- Where: `src/agent/bots.ts` OracleBot, "timed segment anchor" + "timed change call" blocks; `Simulator.timedChangeGhostTod()`.
- Symptom: with two timed lines back to back ("50 for 0:46 then 35" then, 350 ft after the first change point,
  "30 for 1:06 then 40") the oracle sometimes calls the SECOND segment's `then` speed (40) in the same tick it arms the
  segment (at the node), so the car never holds 30 and the leg ends ~5 s early (seen: `generateLeg(2, PROFILES.timedDrill)`
  before the workaround, leg error -5).
- Cause: the bot arms a timed segment when `d <= 1` ft, i.e. sometimes one tick BEFORE `Simulator.crossNode` replaces
  `sim.timedChange`. It then evaluates `due = tod >= sim.timedChangeGhostTod() - lead` against the PREVIOUS segment's
  change (which the sim keeps for 60 s after its instant), which is already in the past, so it fires at once. It needs
  the tick to land in the 1-ft window before the node (about 15-25 % of crossings at 30-50 mph), hence intermittent.
- Repro (vitest or tsx):
  ```ts
  const sc = new ScenarioBuilder({ startTime: hms(8,0,0) }).start(50).advanceMiles(1)
    .timedAt('bridge', { holdSpeed: 50, seconds: 46, thenSpeed: 35 }).advanceFt(50 * 1.4667 * 46 + 350)
    .timedAt('church', { holdSpeed: 30, seconds: 66, thenSpeed: 40 }).advanceMiles(1.5).checkpoint().advanceFt(400).finish().build();
  // run OracleBot; shift the second node by a few feet across seeds: in the failing phase the call.speed log shows
  // "30" and "40" at the same s (the node) instead of 40 at node + 2904 - lead.
  ```
- Suggested fix (bots.ts): arm the pending segment only once the node is crossed (`car.s >= p.s`), or compare
  `sim.timedChange.atS` with the pending plan's expected change s before trusting `timedChangeGhostTod()`.
- Generator workaround: after a timed line the next timed line must sit >= `reach + 350 ft + 65 s of cruise` later
  (`noTimedWithin` in generate.ts), so the previous change has been cleared by the time the next one is armed.

## 2. OracleBot: a new turn callout within 600 ft replaces a pending one (design consequence, not a bug)

- Where: OracleBot calls every line's turn word (including Straight) when `d <= 600 ft`; `Simulator.act('call.turn')`
  replaces `pendingTurn` (DRV-015: one armed callout).
- Symptom: `Right at STOP` at a T followed 547 ft later by `Straight at SIGNAL`: while the car waits at the STOP the
  bot calls "S" for the signal, the T has no straight exit, the driver takes the main road (-90) and the car is off
  course for the rest of the stage (seen in an early `generateStage(1)`).
- Generator rule: every line carrying a turn word sits >= 720 ft after the previous instruction node (short-notice
  "Comes quick" cards 680-790 ft), and distractors with a real road inside the upcoming callout's band sit >= 650 ft
  before the real node. Human navigators meet the same constraint in the GRIID book ("Comes quick" is the warning).

## 3. OracleBot per-tick cost was O(all lines x all nodes) (fixed, one line)

- `bots.ts` iterated every already-passed plan each tick and called `nodeById` for each: a 220-line stage took
  ~10.7 s of bot time for 0.4 s of simulator time. Added `if (d < -100) continue;` after the `crossedTod` bookkeeping
  (nothing below that line applies to a node more than 100 ft behind the car). A full stage now simulates in ~1.5-2.5 s.

## 4. SIM-021 timeout shapes where the last checkpoint can go (constraint, not a bug)

- `checkFinish` ends the stage 30 min (rules.missedCpLateMinutes) after the LAST perfect CP time. A course that keeps
  going for > 30 min after its final timing checkpoint is cut off before the finish and the observation CP is missed.
- Generator rule: the final leg's checkpoint lies in the last ~40 % of that leg's lines and <= 8 mi before its last
  line; the finish banner follows 0.3-0.6 mi after the last line.

## Checked and NOT a bug

- Lunch hold vs driver patience: `beginWait` at a restart node uses reason 'hold' and the patience auto-depart applies
  only to reason 'stop', so the driver waits for `call.go` at the restart (verified with no bot: the car sits at the
  restart node indefinitely). An earlier test-side "re-issue call.stop during lunch" hack was wrong (it leaves
  `holdRequested` set and the driver then stops at the next node) and was removed.
- TA credit with recovery: scoring caps `taCredit` at `max(rawError, 0)`, so a bot that both recovers lost time and
  declares the measured hazard wait never ends up early.

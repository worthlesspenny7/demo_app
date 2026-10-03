# Engine requests from the UI build (src/core is owned by the engine agent; the UI works around each of these)

Status after the UI fix sprint: #1 is resolved by the engine (the Debrief now reads `attribution[].stops`; the event log only supplies the wait/go/release times and the unscored tail). New requests are #10-#15 at the end.

1. **`attribution[].stops` is always empty / `curStop` never closes.** In `Simulator.routeStep` the stop record closes only while
   `releasedNodeId` is set, but `releasedNodeId` is cleared 5 ft past the node, long before the car is back at target speed.
   Effects: `legStops` never receives an entry, the `stop` bucket keeps absorbing cruise time after every STOP (the stop
   record even survives into the next leg), and `stop.end` is never logged. Workaround: `src/ui/viewmodels/debrief.ts` rebuilds
   stops from the `wait` / `call.go` / `release` events (`stopsFromEvents`). Suggested fix: close the stop when
   `car.s > node.s + 5 && |car.v - target| < 0.5` using the stop's own nodeId, independent of `releasedNodeId`.
2. **`watch.*`, `line.set`, `note`, `card.set`, `bezel.set` are not in `events`** (SIM-015 says every callout is logged).
   `result().actions` now has them by tick, which is enough for exact replay; the UI's counterfactual replayer
   (`src/ui/viewmodels/counterfactual.ts`) fires position-dependent calls by the `s` recorded on the event, so events remain the
   source. A per-event `s` on actions (or `s` in every logged action) would let the two converge.
3. **`observe().driver.messages` is drained on every `observe()` call.** The cockpit must buffer messages itself and any second
   observer (agent harness, dev tools) steals them. A monotonic message id / `messagesSince(id)` would be safer.
4. **Stopwatch dial is fixed at 60 s** (`new Stopwatch(kind)` in the Simulator; no `dialSeconds` option). UI-001's 30-s
   McKelvie dial exists in the view-model only; the cockpit renders whatever `observe().stopwatch.dialSeconds` says.
5. **Per-stop entry/exit speeds and the turn cap are not exposed**; the UI recomputes them from the book
   (`speedsByNode`) and `turnSpeedMph`. A `stopLossFor(nodeId)` helper on the engine would avoid drift when the driver
   model changes.
6. **Counterfactual "go at card dwell" cannot be expressed with `replay(scenario, actions)`** because the tick of the substituted
   `call.go` depends on when the replayed car stops. The UI steps its own Simulator and acts live; an engine `replay` that
   accepts a `(sim) => Action | null` hook per tick would make DEBRIEF-002 a one-liner.
7. **`skipPreread` jumps to exactly `startTime`**; there is no way to jump to "T minus N seconds" so the player can still lead the
   start by the acceleration loss. The cockpit offers the time-scale buttons instead.
8. **Observation `legIndex` is null at rung <= 1** (SIM-027): fine, but `taDeclared` keys on the hidden leg index, so the UI
   cannot tell the player which leg a TA was booked against.
9. **Unrelated, noticed while running the suite:** `tests/engine-p2.test.ts` DET-001 currently fails on the new
   `src/core/generator/traps.ts` (matches the Math.random/Date/DOM regex, probably in a comment).

10. **`Observation` does not declare `stoppedAtLine`** although `observe()` returns it (tsc error TS2353 in sim.ts). The UI declares it through module augmentation in `src/ui/engine-augment.ts` (identical type, so it merges cleanly once the engine adds it; the augmentation file can then be deleted).
11. **`replay(scenario, actions)` always runs to the end of the run.** Live-run resume (Home "Resume") needs "replay up to tick N and hand back the live simulator". The UI does this itself in `src/ui/viewmodels/resume.ts restoreSim` with the same loop as `replay` (apply actions with tick <= sim.tick, then `step(0.1)`), which is exact, but an engine `replay(scenario, actions, { untilTick })` would remove the duplicate. Resume is refused (and the UI offers "Restart the same seed") when `ENGINE_VERSION` differs.
12. **`result()` has no `aborted` flag.** The UI detects an ended run from the `abort` event and does not record it (no stars, history or bias). A `result().aborted` and `score` excluding the unscored tail would be cleaner.
13. **Restart / lunch holds are not first-class.** The Debrief identifies them from the book (`section === 'restart'`, `restartTime`) and judges `go` against `restartTime - accelLoss(vOut)`. An engine record `{ line, outTod, goTod, releasedTod }` per restart (and the standing-start loss it applied) would remove the recomputation.
14. **Turn-callout distance is recomputed in the UI.** `workedTurns` measures `node.s - call.s` from the `call.turn` event and compares it with braking distance from the assigned speed to the car's turn cap plus 1 s. An engine-side "callDistanceFt / neededFt" on the `node` event (and `turnMissed` carrying the call distance) would keep the Debrief and the driver model in agreement when the car model changes.
15. **Legal-mode hiding is UI-only.** `observe()` still returns `stopwatch.reading`, `bezelRemaining`, `speedo.reading` and `ahead[].approxDistanceFt` at every rung. The UI hides digital readouts at aids rung <= 1, but an agent or a dev-tools user can still read them; if legal mode should be enforced, `observe()` should return coarse values (analog resolution, no feet) at rung <= 1. Also: a `watch.recall` key and split-recall display for the digital watch are not wired (the Settings text promises "split recall").

# Rally Trainer

A time-speed-distance (TSD) rally navigator simulator built for the Great Race
(Hemmings Motor News Great Race) in a 1939 Ford Deluxe: rally book, one
stopwatch, an analog clock and the car's speedometer. No odometer, no
calculator, exactly as the event's rules require.

You are the navigator. "Dad" drives: he holds whatever indicated speed you call,
obeys stop signs and lights, and turns only where you tell him to. Hidden
checkpoints end each leg; every second early or late is a penalty point; zero
is an Ace. The engine models the "ghost car" the rallymaster uses (instant
speed changes, pauses add exactly their printed seconds) and the real car's
losses (braking, acceleration, turns, lights, trains, traffic), so the core
skills of the event can be drilled at home: pause arithmetic, timed speed
changes, calibration runs, early/late recovery, time allowances, course
following with traps, and full stages.

## Playing it (Josh's first evening)

```bash
npm install
npm run build && npm run preview     # then open the printed URL (usually http://localhost:4173)
```

1. Home shows the **Start here** path in the handbook's order: Safety, Start on time, Stay on course, Stay on
   time. Press **Next on your path** every time; it opens the lesson a drill needs before the drill.
2. Use a laptop at 1366x768 or larger. The default instruments are the handbook's: a digital lap/split stopwatch
   with a time-of-day mode (Space start/stop, L lap, R recall, M mode, K = "I read the clock") and an analog dash
   clock with no digital readout. Settings keeps the analog bezel watch as an option.
3. Keys: `?` opens the key help; `C` the charts; `N`/`P` move the book; digits + Enter call a speed; arrows call
   turns; `G` go; `T` the time-allowance form at a TA point; `>` / `<` change the time scale.
4. Print **Dad's card** from the Team protocol lesson (one page) before the first drive together.
5. Evening one reaches about D04; evening two finishes Bronze and the Silver replays; a third evening reaches
   D18, D11 and the generated day stage (Home > Day stage).
6. If something looks wrong, note the drill, seed and tier shown on the Debrief; every run is replayable.

Measurements the simulator still needs from you (docs/spec/OPEN-QUESTIONS.md Q12/Q22): the Ford's 0-35 and
0-50 times, braking distance from 35, comfortable 90-degree turn speed, speedometer reading at a GPS-true
30/40/50, and whether the car is 6 V or 12 V (the Timewise needs 12 V). Enter them in D06 or tell the next
session; every Ford number in the app is labelled "simulator default".

## Run it

```bash
npm install
npm run dev          # browser UI (Vite) -> http://localhost:5173
npm test             # engine, drill and view-model tests (vitest)
npm run spec:check   # every spec id in docs/spec/SPECS.md has a test
npm run sim -- --scenario builtin:varied --seed 3 --bot oracle   # headless bot run
npm run sim -- --scenario drill:D18 --seed 2 --bot rookie
npm run sim -- --scenario builtin:onestop --stdin               # JSON-lines protocol for agents
npm run build && npm run preview                                # production build
```

## Where things are
- `docs/research/`   Phase I research (Great Race rules, techniques, traps, first-person accounts, timing math). Many items are marked UNVERIFIED; see `docs/spec/OPEN-QUESTIONS.md`.
- `docs/spec/`       REQUIREMENTS, DESIGN, numbered SPECS (tests carry the ids), design reviews.
- `docs/status/`     STATUS.md and LOG.md (resume here), API.md.
- `docs/playtest/`   agent playtest reports and validation.
- `src/core/`        pure TypeScript engine: ghost integrator, car, speedometer, stopwatch, driver, scoring, attribution, drills, generator.
- `src/agent/`       bots, JSON protocol, CLI.
- `src/ui/`          browser cockpit, school, debrief.

## Status
See `docs/status/STATUS.md`.

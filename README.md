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

# Project Status (read this first after any context reset)

Project: Time-Speed-Distance Rally Simulator ("Rally Trainer") to prepare for the
Great Race (Hemmings Motor News Great Race, formerly Great American Race) in a
1939 Ford Deluxe, navigator toolkit = rally book + mechanical stopwatch(es) +
calculator (if permitted) + car's speedometer.

Owner: Josh (engineer, will be navigator / co-driver for dad + brother).
Owner is hands-off until ~Sunday afternoon (2026-10-04/05). Goal: a fully
verified, validated, enjoyable simulator that teaches everything needed.

## Phases
- [ ] Phase I  - Research TSD rallies / Great Race -> docs/research/*.md, distilled into docs/spec/REQUIREMENTS.md
- [ ] Phase II - Design the simulator -> docs/spec/DESIGN.md + docs/spec/SPECS.md (numbered, testable specs)
- [ ] Phase III - Build + agent playtest + validate -> src/, tests/, docs/playtest/*.md

## Current step
Phase I just started. Repo was wiped of the old Rails demo app (unrelated).

## Key decisions log
- 2026-10-03: Stack = TypeScript (Node 22), pure core engine (no DOM) + CLI/agent
  harness + browser UI (Vite). Reason: agent-runnable headless + enjoyable UI.

## How to resume
1. Read this file, then docs/status/LOG.md (chronological), then docs/spec/*.
2. Run `npm test` to see the current health of the specs.
3. Continue from "Current step".

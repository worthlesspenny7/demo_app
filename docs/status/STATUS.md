# Project Status (read this first after any context reset)

Project: Rally Trainer - Great Race style time-speed-distance navigator
simulator for Josh (navigator) + dad (driver) in a 1939 Ford Deluxe.
Owner is hands-off until ~Sunday afternoon 2026-10-04/05.

## Phases
- [x] Phase I  - Research -> docs/research/00..07 (web budget exhausted; many items UNVERIFIED, see docs/spec/OPEN-QUESTIONS.md)
- [x] Phase II - Design -> docs/spec/REQUIREMENTS.md, DESIGN.md, SPECS.md (critic review pending)
- [x] Phase III-a core engine + tests (src/core, tests/) - 156 tests green
- [x] Phase III-b agent harness + bots (src/agent): protocol (hello/act/advance/observe/result, scheduled actions), CLI `npm run sim`, bots oracle/rookie/noPause/lateCall/goCount/random, scripts/rally-session.sh for live LLM sessions
- [x] Phase III-c browser UI (src/ui): Vite app, cockpit/school/debrief/reference/quiz/math/settings; Playwright smoke green
- [x] Generator + 24-card trap library (src/core/generator); drills D11/D12/D13 use it
- [x] Drill curriculum D01-D18 (src/core/drills) with rubrics/tiers/unlocks
- [x] Phase III-d agent playtesting (bugs): PT-01 protocol (26 bugs, HIGH/MEDIUM fixed), PT-02 drills (14 bugs, fixed), PT-03 UI bug hunt (running)
- [~] Phase III-e validation: VALIDATION-realism.md, VALIDATION-education.md, VALIDATION-playability-enjoyment.md (agents running) -> then fixes -> final VALIDATION.md summary

## Current step
Validation passes running. Next: apply their top fixes, re-run tests + e2e, write docs/playtest/VALIDATION.md (summary for Josh), final status.
Spec coverage: `npm run spec:check` should report 0 missing (BACKLOG section excluded).

## Environment constraints (this session)
- WebFetch blocked by egress policy; WebSearch budget 200/session exhausted.
- git push -> 403 (Claude GitHub App not installed on worthlesspenny7/demo_app). Commit locally, retry push at milestones.

## Key facts that drive the design (see REQUIREMENTS.md)
- Calculators prohibited in the Great Race; one stopwatch; analog clock; odometer covered; paper tables legal.
- Ghost car: instantaneous speed changes; pauses add printed seconds; teams subtract measured car losses.
- Checkpoint crossing resets the leg clock (errors do not compound). 1 pt/second, Ace = 0.
- 1939 age factor 0.845. Champions ~1 s/leg; rookies 20-46 s/day.

## How to resume
1. Read this file, docs/status/LOG.md, docs/spec/SPECS.md.
2. `npm install && npm test && npm run spec:check`.
3. Continue from "Current step"; keep LOG.md appended.

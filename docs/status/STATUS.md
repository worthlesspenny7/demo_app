# Project Status (read this first after any context reset)

Project: Rally Trainer - Great Race style time-speed-distance navigator
simulator for Josh (navigator) + dad (driver) in a 1939 Ford Deluxe.
Owner is hands-off until ~Sunday afternoon 2026-10-04/05.

## Phases
- [x] Phase I  - Research -> docs/research/00..07 (web budget exhausted; many items UNVERIFIED, see docs/spec/OPEN-QUESTIONS.md)
- [x] Phase II - Design -> docs/spec/REQUIREMENTS.md, DESIGN.md, SPECS.md (critic review pending)
- [x] Phase III-a core engine + tests (src/core, tests/) - 218 unit tests, 26 Playwright e2e, 177/177 specs covered
- [x] Phase III-b agent harness + bots (src/agent): protocol (hello/act/advance/observe/result, scheduled actions), CLI `npm run sim`, bots oracle/rookie/noPause/lateCall/goCount/random, scripts/rally-session.sh for live LLM sessions
- [x] Phase III-c browser UI (src/ui): Vite app, cockpit/school/debrief/reference/quiz/math/settings; Playwright smoke green
- [x] Generator + 24-card trap library (src/core/generator); drills D11/D12/D13 use it
- [x] Drill curriculum D01-D18 (src/core/drills) with rubrics/tiers/unlocks
- [x] Phase III-d agent playtesting (bugs): PT-01 protocol (26 bugs, HIGH/MEDIUM fixed), PT-02 drills (14 bugs, fixed), PT-03 UI bug hunt (running)
- [x] Phase III-e validation: realism 47/70, playability 32.5/55, education and UI passes all 'yes with fixes'; top fixes applied; summary in docs/playtest/VALIDATION.md
- [x] Re-validation (education): tip accuracy 97%, naive 0-1 vs oracle 3 stars; its remaining fixes applied (RUB-001/002, DRILL-018/019/020) - docs/playtest/REVALIDATION-education.md
- [x] Re-validation (UI): verdict yes, playability 39.5/55 (was 32.5), 34/51 prior issues fixed, 0 regressions -> docs/playtest/REVALIDATION-ui.md
- [x] UI fix sprint 2 (all 12 items from that report + engine SIM-032/DRV-019/DRILL-005 cliff fix)
- [x] Polish sprint 3: N5 perf card no longer clips, N11 'holding for restart' pace text, Start-here path counts Silver/Gold stars only (UI-028)

## Current step
Ready for Josh. Everything from both re-validation reports is closed except the design-level items listed in docs/playtest/VALIDATION.md (Dad personality, pace-aid at Bronze). Optional: a third playability pass on this build. Pushes to origin succeed (remote still named demo_app; GitHub redirects).
Spec coverage: `npm run spec:check` should report 0 missing (BACKLOG section excluded).

## Environment constraints (this session)
- WebFetch blocked by egress policy; WebSearch budget 200/session exhausted.
- git push works again (user reconnected GitHub). Use Sonnet sub-agents that may spawn their own sub-agents for playtests/validation.

## Key facts that drive the design (see REQUIREMENTS.md)
- Calculators prohibited in the Great Race; one stopwatch; analog clock; odometer covered; paper tables legal.
- Ghost car: instantaneous speed changes; pauses add printed seconds; teams subtract measured car losses.
- Checkpoint crossing resets the leg clock (errors do not compound). 1 pt/second, Ace = 0.
- 1939 age factor 0.845. Champions ~1 s/leg; rookies 20-46 s/day.

## How to resume
1. Read this file, docs/status/LOG.md, docs/spec/SPECS.md.
2. `npm install && npm test && npm run spec:check`.
3. Continue from "Current step"; keep LOG.md appended.

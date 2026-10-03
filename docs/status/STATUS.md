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

## Phase IV (2026-10-03 evening): Rookie Handbook + 2026 Event Regulations supplied by Josh
- [x] Extracted: docs/research/08-rookie-handbook-body.md, 08b-...-appendices.md, 09-event-regulations-2026.md; OPEN-QUESTIONS answered (Q1-Q26 table at the bottom)
- [x] SPECS.md 'V2' section (REG, TA, GRIID, STAGE, CHART, LESSON, DRILL-021..025, CAMP, UI-029..034)
- [x] Core engine V2 (commit 283af32): scoring caps/age table/discards, TA at TA points in 10 s multiples, Column C/B data (src/core/griid.ts), stage skeleton with ASP restarts, exact transits, free zones, handbook charts + Packard, digital lap/split stopwatch + instrument discipline; 294 unit tests
- [x] Lessons + reference pages (aafc36a, 98da6c2): Four S's, Which timer when, team protocol (Dad's card), notations, transits/restarts, regs tables
- [x] UI V2 (d7dec78): five-column GRIID book + printable #/book view, Column B icons, stacked Column C, charts overlay (C key), TA point form, restart/transit/promoted-stop cards, official-style scorecard with instrument discipline, digital lap/split watch display, built-in generated day stage
- [x] Drills V2: D16 (ASP restarts, exact transit, lunch, rollovers), D08b at a TA point with committee credit, D06 builds the three charts (Bronze = Packard), D15 grades the six notations over 3+ pages, D18/D11/D12/D13 on the STAGE-001 skeleton, D01/D07 on the digital watch, campaign division/ASP/discards/standings vs benchmark teams; oracle 3 stars and naive 0 on D01/D03/D06/D07/D08b/D15/D16/D18; D11 2-3; D12/D13 oracle 1-3 stars on stock-speedo tiers (red lights no longer earn a TA and town recovery is limited)
- [x] Verification: typecheck clean, 362 unit, 38 e2e, build clean, 246/246 specs (after the V2 fix sprint; was 340 / 34 / 232)
- [x] Realism re-validation (54/70, docs/playtest/REVALIDATION-v2-realism.md) and its V2 fix sprint (clock without digital readout, TA per V.H.1/V.H.3, exact-transit flag, oracle calibration and clock glances, lesson slips, book realism, collapsed debrief): see LOG.md. 362 unit, 38 e2e, 246/246 specs, not committed
- [ ] Re-validate education against the two documents (agent), push
- Josh's standing instruction: the organizers' documents win over his own preferences. Hence: digital stopwatch with lap/split + TOD by default (HB p.5 'a necessity'), analog dash clock; teach which device for which purpose (LESSON-006, WATCH-008/009, DRILL-026). Dad has no protocol yet: teach best practices. YouTube transcripts (.vtt) may arrive

## Current step
Phase IV complete and verified. Open items: Josh's Ford measurements (Q12/Q22), YouTube transcripts (Q13), ASP + 30-min pre-read on the built-in stage route, GR emergency signs (backlog). Everything from both re-validation reports is closed except the design-level items listed in docs/playtest/VALIDATION.md (Dad personality, pace-aid at Bronze). Optional: a third playability pass on this build. Pushes to origin succeed (remote still named demo_app; GitHub redirects).
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

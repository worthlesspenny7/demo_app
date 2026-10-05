# Project Status (read this first after any context reset)

## HANDOFF (keep this block current; it is the resume point)
- Branch: claude/rally-simulator-j3kqzq (remote demo_app, renamed TSD-simulator on GitHub; push works).
- Verify: `npm install && npx tsc -p tsconfig.json && npm test && npm run build && npm run spec:check && npm run test:e2e`
  (last known, after the PT-11/realism v4 fix sprint, NOT committed: tsc clean, 650 unit, 94 e2e, 360/360 specs, ENGINE_VERSION 3.4.0).
- Standing rules from Josh: the organizers' documents and videos override his preferences and ours; digital
  lap/split stopwatch with TOD mode is the default (HB p.5, REG II.H.1.d(3)); the dash clock has no digital
  readout (REG II.H.1.d(1)); mark simulator conventions as such in lessons; keep STATUS/LOG current; commit and
  push at every green step; use right-sized sub-agents (Sonnet for mechanical work, Opus for judgement) that may
  spawn their own; never commit a tree that fails the five checks.
- Sources of truth, in order: docs/research/09-event-regulations-2026.md, 08 + 08b (Rookie Handbook),
  10 + 10a/b/c (video transcripts), 11a/b/c (video frames), then 00-07 (web research, partly unverified).
- Spec: docs/spec/SPECS.md (ids before "## BACKLOG" must each appear in a test name; V2 and V3 sections hold
  the document- and video-derived rules). Open questions: docs/spec/OPEN-QUESTIONS.md (bottom tables).
- Playtest/validation reports: docs/playtest/*.md (latest: REVALIDATION-v2-realism.md 54/70).
- In flight (2026-10-05): PT-12 playability replay (Opus, read-only) on the fix-sprint PT-11/realism-v4 commit (650 unit,
  94 e2e, 360/360, ENGINE 3.4.0). When it lands: commit the report; fix sprint if warranted; five checks; commit; push.
  Known not-done: PT-06 LOW 14, 20, 21, 25-27; PT-09 LOW 10, 12-14; realism v4 items 6, 8-10 (place-name calibration
  signs, race-style builtin default, mid-skill bot, pace-car visibility); D06 Bronze is a full drive graded on copying;
  two of 50 generated days have one leg over 5 s (seeds 31, 38).
- If a sub-agent's report arrives after a reset: its file is on disk under docs/research or docs/playtest; read
  it, fold it, commit.


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

## Phase V (2026-10-04): rally school video transcripts supplied by Josh
- [x] 13 transcripts in docs/research/transcripts (raw .vtt + cleaned txt); analyses 10a/10b/10c; synthesis + decisions in docs/research/10-rally-school-videos.md; OPEN-QUESTIONS updated (Q17/20/23/24/25 answered)
- [x] Screenshot plan: docs/research/transcripts/screenshots.txt (86 cues) + scripts/grab-frames.sh; Josh fills urls.txt and uploads frames
- [x] Spec V3 (INST, START, TAF, MAKEUP, PROTO, SPEED, CAL-006, LOST, PREREAD, CHART-006, CPX, LESSON-008, UI-037)
- [x] Core V3 (ENGINE 3.0.0): loose minute hand + director's setup, start queue/launch/pace cars, 2026 TA web form fields + paper mode + measured = stopped + chart loss, make-up ledger (10 %/20 %, chunks, drops, disturbed-interval finding), callout protocol lines, speeds 10-55 with 48, no live feedback in calibration, lost doctrine in D10, pre-read checkpoint notes, D06 4-run tool, 4-6 checkpoints/day
- [x] UI/lessons V3: LESSON-008 "What the rally school adds" (every claim cited by video + mm:ss), LESSON-002/003/004/006 rewritten, start card with count landing on the launch second, TA form fields, make-up ledger, ambiguous clock rendering, pace cars, calibration cue suppression, new keys W/Q/I/X
- [x] Verification: tsc clean, 447 unit, 51 e2e, build clean, 262/262 specs

## Phase VI (2026-10-04): video frames fix sprint (docs/research/11a, 11b, 11c)
- [x] Book renderer to the real page anatomy (column proportions 4:30:20:23.5:26.5, bold centred unboxed Column C, calibration box and start, digital-watch restart and end-timed pictograms, odometer squares, no Column B TA symbol, Information Box row, countdown advisories, content-driven pages of 5-10 rows, three-block footer, no page header, race-style Column D except rung 3)
- [x] One CAMEO renderer in src/core/cameo.ts (elbows, bears, full-width thin roads, dashed roads, bold names, bracketed names, outlined controls, overhead/left/right sign faces, SignShape library) used by the book, the trap cards, the reference and the quiz
- [x] Simple chart on the performance card (CHART-007), matrix axis labels/footnotes/blank diagonal, 12 mph row, D06 raw run times
- [x] Sawtooth clock (default) and bezel clock option (Settings.clockFace), black palm digital watch with lanyard
- [x] TA web form as labelled (login + entry pages, no witness field), paper Time Delay Form (three requests, witnesses, status, +30 s formal problem)
- [x] Pre-read annotation presets on every book row (P10.2, circled loss, carried speed, COMES QUICK, TOD, CP time, TRAIN Delay + star), graded by D15
- [x] Red GREAT RACE STOP / green timing checkpoint signs, lost order-of-start step and hacking in LESSON-008
- Not done / follow-ups: the printable book view does not show the hand marks (they live in the cockpit); the generator still draws a railroad crossing as one row (real sheets use two: the round RR sign, then the tracks with a pause); the Packard simple chart rows 10/12/48 interpolate its printed 15-50 table; web TA login accepts any 4-digit password.

## Current step
Phase V complete and verified. Open items: Josh's Ford measurements (Q12/Q22) and 6 V vs 12 V; video frames from scripts/grab-frames.sh (then compare the book renderer with the real 2026 page); Dad's own protocol preferences once he has played; GR emergency signs (backlog); a fresh playability pass on V3. Everything from both re-validation reports is closed except the design-level items listed in docs/playtest/VALIDATION.md (Dad personality, pace-aid at Bronze). Optional: a third playability pass on this build. Pushes to origin succeed (remote still named demo_app; GitHub redirects).
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

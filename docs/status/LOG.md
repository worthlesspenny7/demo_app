# Chronological work log

- 2026-10-03 Session 1 start. Wiped old demo app. Created docs skeleton. Began Phase I research (parallel agents).
- 2026-10-03 Environment constraints discovered: (a) WebFetch blocked by egress policy for nearly all hosts, only WebSearch works; (b) WebSearch budget is 200 calls/session and was exhausted by the 7 research agents ~04:15; (c) git push returns 403 (Claude GitHub App not installed for worthlesspenny7/demo_app). Work continues locally; push retried at milestones.
- 2026-10-03 ~05:30 All 7 research reports done (docs/research/00-07). Wrote REQUIREMENTS.md, OPEN-QUESTIONS.md, DESIGN.md, SPECS.md (120 specs). spec-check script added.
- 2026-10-03 ~06:30 Core engine first pass: units, rng, course types, builder, ghost, car, speedo, stopwatch/clock, hazards, scoring, perf-table, sim (driver+world+attribution). 53 tests green. Three design reviews written to docs/spec/reviews/. Found+fixed: mph/fps unit bug in driver target; stop-node crossing order; fixed 0.1 s tick sub-stepping. Realism: standstill start costs ~4 s (accelLoss) - navigator must leave early or make up.

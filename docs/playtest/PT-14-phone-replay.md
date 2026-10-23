# PT-14: phone replay of PT-13 on the fix-sprint build

Status: complete (2026-10-23). Read-only playtest: nothing under src/, tests/, content/ or public/ was changed; nothing committed.

- Build: commit 56213b8 (fix sprint PT-13), `npm run build && npx vite preview --port 4186`.
- Browser: Playwright Chromium (/opt/pw-browsers/chromium), 390x844 (geometry also 360x780 and 844x390), touch on, isMobile, real
  `touchscreen.tap`, one shared persistent profile for sessions 1-6 (fresh at the start of session 1); throwaway profiles for the
  geometry sweep, the evidence cards and the word-count probe.
- Tester: one agent playing Josh (rookie navigator, a few minutes at a time on his phone). No sub-agents: the Agent tool was not available
  in this session, so every skill run was played here.
- Player: playtest-scripts/pt14-player.ts drives the screen with real taps; its brain (pt14-follower.ts) answers from what the screen
  shows, by the rule cards (or as a naive rookie). Timed cards are tapped in real time from the screen (watch digits, TOD digits, the sign
  bar, the "Mark!" text) with a 0.15-0.35 s reaction. The oracle is used only as the CAMEO arrow reader on turn / which-way cards.
  Sim time is never advanced by hand.
- Boss: the first attempt seeded every meter to at least 50 % (stated in session 5); headless, the Boss opens on its own after the first
  Daily set for a careful player.
- Scripts: playtest-scripts/pt14-*.ts (01 first open + Daily, 02 Continue, 03 School Try it x5, 04 landscape, 05 Boss, 06 PWA offline,
  07 geometry + words sweep, 09 evidence cards, 10 follower audit, 11 timed-start probe, 12 guess audit, 13 unlock simulation, 14 word
  probe; harness pt14-common.ts, player pt14-player.ts, brain pt14-follower.ts). Raw JSON in the session scratchpad, not committed.
- Screenshots: docs/playtest/screenshots/pt14-*.png (39 files, all under 200 KB).

## Verdict in one paragraph
The fix sprint did what PT-13 asked. A player who follows the rule cards is now right on every card of 13 of the 14 kinds over 160 seeds each,
including the pause card on turn rows and the TA claim that PT-13 found graded against the cards; the timed cards have a sign (a bar that
runs down, "Mark!" in text, voice and a buzz); the Boss shows its chart, covers every kind and opens after the first Daily set; Continue
is protected; no kind repeats more than twice; the restarts vary and ask base + position; words on screen are under 40. 17 of the 19
PT-13 bugs are fixed, none regressed. Two contradictions remain, both HIGH: the hazard card treats a tractor as a Time Allowance cause and
a slow truck not, which no rule card says (the documents do), and on a Boss leg the timed start is graded off the ghost, so the follower
can be told "CALL 5 s late" by a card that closed before the time it printed. The new costs are pace (timed cards now wait for the sign:
a third of gaps over 15 s, Stay-on-time runs at 3.4 decisions a minute, Boss timed holds up to 84 s), rule cards that do not match the
card that follows, skill runs that are mostly other skills, and four option cards whose right answer always sits in the same place.
Engagement 31/40 (PT-13: 25).

## A. Central test: does a rule-card follower ever get "Not quite"? (headless, saved first)
Script: playtest-scripts/pt14-10-follower-audit.ts with the player brain in pt14-follower.ts (the same brain drives the browser player).
The follower answers from what the phone screen shows (prompt, Column C, the chart cell under "details" or the Chart button, the sign
bar, the watch card, the option labels) by the rule cards in content/rules.ts, with a 0.15-0.35 s human reaction on every timed tap;
the oracle is used only as the CAMEO arrow reader on turn / which-way cards. 14 kinds x 4 variants x 40 seeds, at rung 2 (Daily,
practice, first Boss) and rung 1 (later Boss: chart behind the Chart button, which the follower opens). Then whole runs through the
Scheduler: 15 Daily runs (5 days x 3), 35 practice runs, 10 Boss runs at rung 2 and 10 at rung 1.

| Kind (rule used) | rung 2 | rung 1 | naive rookie (rung 2) |
|---|---|---|---|
| pause, 15 s rows with turns included (RULE-016/017: sit the printed number, rounded) | 160/160 | 160/160 | 160/160 |
| TA claim (RULE-033: floor((delay - made up) / 10) x 10) | 160/160 | 160/160 | 0/160 |
| timed start, micro (START on Mark!, CALL at interval - lead on the watch) | 160/160 | 160/160 | 27/160 |
| speed change (CALL when the bar reaches the call tick / lead before Mark!) | 160/160 | 160/160 | 0/160 (CALL on Mark!) |
| restart: own time, base + position, transit OUT (RULE-010/011 off the TOD digits) | 160/160 | 160/160 | 0/160 (tap on the printed time) |
| clock: minute / second / interval (RULE-038/039) | 158/158 | 158/158 | 27/158 |
| watch (RULE-021 lap + interval - lead) | 160/160 | 160/160 | 0/160 |
| make-up (RULE-025/026/005/027 with the room and the limit printed) | 159/159 | 159/159 | 120/159 |
| lost (RULE-034/043: detour vs 2 x ago + 20) | 160/160 | 160/160 | 0/160 (claim a TA) |
| checkpoint green / red / car ahead (RULE-003/004) | 160/160 | 160/160 | 40/160 |
| transit OUT (RULE-014) | 160/160 | 160/160 | 160/160 |
| pre-read which way / speed / pause (RULE-041/042/016) | 160/160 | 160/160 | 151/160 |
| turn (RULE-041, tapped at 2.5 s) | 160/160 | 160/160 | 160/160 |
| **hazard (RULE-031/032/033)** | **140/160** | **140/160** | 0/160 |

Whole runs (follower): Daily 166/168 right, practice 374/380, Boss rung 2 215/220, Boss rung 1 211/220. Naive Daily: 50/168.
Every follower miss is one of two contradictions:

**C-1 (HIGH): hazard: a tractor qualifies for a TA and a slow truck does not, and no rule card says so.** "A tractor at 18 mph 400 ft
ahead; no room to pass for miles" wants "Make up what you can, claim the rest" (20/20); "A truck pulls out 400 ft ahead at 24 mph, no
room to pass" wants "Make it all up" (40/40). RULE-031 says "only for a delay beyond your control, such as a train or helping at an
accident" (REG V.H.1 the same words); both vehicles are equally beyond the navigator's control. Reading the card strictly (only the
named causes) loses every long tractor (20/20 wrong, about 21-28 s each); reading it broadly loses every truck (40/40). The engine's
TA_CAUSES (src/core/sim.ts: train, tractor, schoolBus, construction, combine, accident) is the hidden rule. In whole runs this is
2 of 168 Daily cards, 6 of 380 practice cards and 4 of 220 rung-1 Boss cards. The verdict then cites RULE-033's "odd seconds"
example, which does not explain why a tractor is a TA cause.

**C-2 (HIGH, Boss leg only): timed start graded against the ghost, not against the sign.** The card says "START on Dad's Mark!, then
CALL 45 1.4 s before the 1m07s ends"; the follower does exactly that and is graded "CALL 24.5 s late" (Boss rung 2 seed 9), "CALL 25.6 s
early" (seed 8), "CALL 7.4 s late" (seed 5), "CALL 23.7 s late" (rung 1 seed 2). In every miss the car was off the ghost's pace at the
sign (pace +7.0, +23.8, -25.8, +23.3, +8.5 s; pt14-11-timed-probe.ts); the truth is `ghostSign + seconds - lead`
(src/core/decision/runner.ts detectTimed), so it moves by the car's error. REG VII.E.2.d: "the interval starts at the same place as that
speed change"; the watch card (same rule, RULE-021) is graded from the lap at the car's own crossing and agrees with REG, so the two
cards contradict each other. Micro cards (Daily, practice) start on pace and never show it. 9 of 32 Boss timed starts were missed this
way, including two at a pace of only 1.0-1.3 s, where a 0.2 s reaction tips the call past the 1.3 s tolerance.

No other contradiction: pause with turns, TA claims, timed START at the Mark, speed change at the Mark, restart base + position, clock
minute vs watch, make-up choices, lost, checkpoint and transit OUT all agree with the rule cards on every seed.

## B. Guessable-card audit (40 seeds per kind, variant = seed % 4 as the Scheduler draws it)
Script: playtest-scripts/pt14-12-guess-audit.ts. A guess needs no skill; "right" is the grader's verdict.

| Card | PT-13 guess, right | PT-14 mix | Best skill-free guess now, right | Verdict |
|---|---|---|---|---|
| Clock | always "Stopwatch in TOD mode" 40/40 | minute 20, count the second in 10, interval 10 | always "Watch, TOD mode" **30/40** (TOD is also accepted for "count the second in") | FIXED as a fixed answer; still 75 % one button |
| Checkpoint | always "Hold speed" 40/40 | green 20, car ahead 10, red board 10 | always "Hold speed" **30/40** | FIXED (the colour decides, which is the skill) |
| Lost | always "Turn around" 40/40 | rejoins 20, dead end 20 | always "Turn around" **28/40** | FIXED |
| Make-up | always "+20 %" 60/60 | room and limit vary | always "+10 %" **32/40**, always "+20 %" 30/40 | FIXED (partly: 80 % for one button) |
| Hazard | by label 60/60 | gates 10, tractor 10, signal 10, truck 10 | always "Make it all up" **25/40** | FIXED as a guess; but see C-1 |
| Pre-read speed | the "in · out" chip 60/60 | chip gone; Column C carries it | "highest that is not the current speed" 3/20 | FIXED |
| Pre-read pause | (not audited) | 8 of 40 | **the middle of the three waits 8/8** (the chart wait always lies between "Go at once" and the printed pause) | NEW give-away |
| Transit OUT | IN always 9:00:31 | 40 distinct IN times, 7 intervals | **the middle of the three times 40/40** (options are OUT, OUT - 60 s, OUT + 60 s) | NEW give-away |
| TA claim | (grader wrong) | | **the second-smallest claim 40/40** | NEW give-away |
| Watch | (new kind) | | **the second-smallest reading 40/40** | NEW give-away |
| Restart | "your time 9:03:00, loss 4.4 s" memorised | own time 20, base + position 10, transit OUT 10; losses 3.0 / 3.7 / 4.4 / 5.2 / 6.1 s | none (a timed tap) | FIXED |

So the fixed answers PT-13 found are gone, but four option cards now have a positional give-away: the right answer is always the middle
value (pre-read pause, transit OUT) or the second-smallest (TA, watch). A player notices this within a day.

## C. Session notes (browser, 390x844, one shared profile)

### Session 1: first open, first 60 s, Daily set (fresh profile) - pt14-01-first-and-daily.ts
First 60 s: Home visible 0.2 s; tapped the yellow "Play daily run 1 of 3" at 1.9 s; rule card RULE-025 glanced;
**first decision at 4.5 s** (make-up), first tap 6.6 s. In 60 s: 5 decisions and 3 rule cards (PT-13: 8 and 3). The difference is the
speed-change card, which now waits for the sign: 13.8 s and 15.8 s on the card.

| run | policy | wall | decisions | rule cards | right | dec/min | median gap | p75 gap | max gap | recap |
|---|---|---|---|---|---|---|---|---|---|---|
| Daily 1 | naive | 147 s | 10 | 3 | 2 | 4.1 | 18.3 s | 20.0 s | 23.1 s | 0 stars, 2 of 10, 61.6 s off |
| Daily 2 | rules | 164 s | 10 | 2 | 10 | **3.7** | 11.2 s | 21.7 s | 28.8 s | 3 stars, 10 of 10, 1.9 s off |
| Daily 3 | rules | 162 s | 12 | 3 | 12 | 4.4 | 6.2 s | 18.9 s | 23.4 s | 3 stars, 12 of 12, 1.3 s off |

- The rules player was right 22 of 22 (PT-13: 23 of 26, with 3 pause cards marked wrong for following the card). The naive player
  was right 2 of 10 (makeup +20 % over a posted 35; stopping at a green sign; calling on Mark! instead of before it; launching on the
  printed time; calling the timed change when the interval is up). Every naive miss is a real lesson.
- "Card n of N" never moved: 1/10 .. 10/10, 1/12 .. 12/12 (PT-13 BUG-16 fixed).
- Daily 2 (two weakest skills: Safety and course, Stay on time) was speedChange x2, preread x2, checkpoint x2, timedStart x2, turn, pause:
  no kind more than twice (BUG-05 fixed). Daily 3 had 12 different kinds in 12 cards.
- Pace: the timed cards now hold the player longer than in PT-13: speed change 8.8-15.8 s, timed start 14.6-26.4 s, restart 11.6-19.9 s,
  a "Pause 30 s ... sit 24.8 s" card 25.3 s. A run with 6 timed cards of 10 (Daily 1) has a median gap of 18 s; Daily 2 falls to 3.7
  decisions a minute (target 4).
- Rule card before the wrong card: Daily 3 showed RULE-007 ("Copy the speed at the bottom of each page...") before a "How long do you sit?"
  pre-read, and RULE-033 (TA arithmetic) before a red-light hazard; Daily 2 showed RULE-006 before a speed pre-read. The rule the card
  needs (RULE-016, RULE-031, RULE-042) was not the one shown (see BUG-N3).
- Verdict sentences now match the card: red light "A traffic light is not named: make that time up"; turn and which-way cite RULE-041
  (the bold CAMEO arrow); speed pre-read RULE-042; TA RULE-033; checkpoint red RULE-003 red board; make-up over the limit "Never go above
  the posted limit".
- Home after the set: Streak 1, three pills done; meters Safety and course 59 %, Start on time 45 %, Stay on time 64 %, Recovery 23 %,
  Instruments 23 %. Boss locked ("opens when every skill is at 50 %"). No console or page errors.

### Session 2: Continue after closing mid-run, and the "Continue / Start over" prompt - pt14-02-continue.ts
- Tapped "Daily set done: practise", answered 3 cards by the rules, then closed the whole browser context on a fresh speed-change card.
- Reopened: Home shows **"Continue run (3 of 11 done)" as the yellow primary button at the top** (y 74); "Daily set done: practise" is
  now a grey button below it (y 280) (pt14-11-home-continue.png). BUG-06 FIXED.
- Tapping the grey practise button opens a "Run in progress" screen: "You have a run in progress (3 of 11 done). Starting another one
  ends it." with "Continue my run" (primary), "Start over" and "Home" (pt14-12-confirm-start-over.png). "Continue my run" brought back
  **the same card** (speedChange:2:1, card 4, same prompt) 0.9 s after the page load (pt14-10-before-close.png / pt14-13-after-continue.png).
- After Continue: 8 decisions in 71 s, 6.8 decisions/min, median gap 5.0 s, p75 9.5 s; recap 10 of 11 right, 2 stars.
- Start over works too: a Recovery run with one answer -> Home shows "Continue run (1 of 10 done)"; tapping the Instruments meter asks
  first; "Start over" starts the new run and the old one is gone.
- The one miss of the session was C-1 live: "A tractor at 18 mph 400 ft ahead; no room to pass for miles." -> "Make it all up" ->
  "Not quite: the delay you could not make up was not claimed +24.6 s", with RULE-033's "odd seconds" sentence under it.
- Part 1 had three rule cards in its first three decisions (57 s for 3 decisions, 3.2/min): a run that starts with three new skills
  front-loads its reading.
- Small gap: a run is saved for Continue only after its first answer; closing on the first rule card loses it (the run has no answers,
  so nothing is lost but the seed).

### Session 3: a skill run per skill from School "Try it" - pt14-03-school-tryit.ts
- **Home now has a School button** (y 719 of 844, in view without scrolling; BUG-14 FIXED). The School page itself is unchanged: 43 "Try it"
  buttons (64 x 56 px, top right of each card), 18,951 px tall, 122 text elements under 16 px (13 px sources, 15 px notes). Reference is
  unchanged: 1,048 elements under 16 px (12 px table heads), 20,294 px tall (BUG-10 NOT FIXED; pt14-20-reference-phone.png).
- Five skill runs, by the rules:

| Try it | wall | decisions | of the skill | dec/min | median / p75 gap | right | stars |
|---|---|---|---|---|---|---|---|
| Start on time | 160 s | 12 | 4 (restart x2, transit x2) | 4.5 | 5.4 / 15.8 s | 11 (tractor, C-1) | 2 |
| Safety and course | 110 s | 10 | 6 (turn, which-way/speed pre-read, checkpoint x2 each) | 5.5 | 4.7 / 5.4 s | 9 (tractor, C-1) | 2 |
| Stay on time | 174 s | 10 | 6 (timed start, pause, speed change x2 each) | **3.4** | **18.6 / 20.0 s** | 10 | 3 |
| Recovery | 94 s | 10 | 8 (hazard, TA, lost, make-up x2 each) | 6.4 | 4.9 / 6.1 s | 9 (tractor, C-1) | 2 |
| Instruments | 129 s | 10 | 4 (clock x2, watch x2) | 4.7 | 6.1 / 18.1 s | 10 | 3 |

- The repetition PT-13 found is gone: restart cards gave "your time 8:12:00, loss 4.4 s" then "base 10:45:00, you start 29th, loss 5.2 s";
  transit IN times 9:41:42 and 7:51:35. RULE-010 (base + position) is now exercised and the follower was right on it.
- New side effect of the per-kind cap (2): **a skill run is mostly other skills.** "Try it: Start on time" gave 4 start-on-time cards of
  12, "Try it: Clock and stopwatch" 4 of 10; the rest are filler from other skills (BUG-N4).
- The C-1 tractor card was missed in three of five skill runs (it is the one card the follower cannot answer from the rule cards).
- Stay on time is the slow skill: every card is a real-time wait (pause 11-20 s, speed change 12-15 s, timed start 18-22 s) and the run
  makes only 3.4 decisions a minute.
- Fixed wording repeats: every turn is "Line 2 is 600 ft ahead", every checkpoint "450 ft ahead", every tractor "at 18 mph 400 ft ahead",
  every signal "500 ft ahead". Not wrong, but the cards look stamped.
- Rule card before an unrelated card again: RULE-040 (sync at pickup) before a clock "interval" card, RULE-015 (lunch) before a transit OUT,
  RULE-002 (full stop) before a turn, RULE-012 (nobody releases you) before a transit OUT restart (BUG-N3).

### Session 4: landscape - pt14-04-landscape.ts
- Rotating to 844x390 on a speed-change card kept the run and the card (speedChange:2:1 before and after; also on the way back). Buttons /
  watch on the left half, card on the right; no text under 16 px, no tap target under 48 px, no horizontal scroll.
- The card side scrolls in landscape (the details button and the "Mark!" line sit at the bottom edge); the sign bar and "Mark!" were still
  visible when the sign arrived (pt14-31-landscape-mark.png).
- Four cards sideways (speed change, timed start, pause, speed change) all right; then 6 in portrait, 10 of 10, 3 stars. Dad's line is now useful: "Holding 30. I'll say mark at the sign." and then "Mark!".
- The CAMEO label still overlaps its icon ("church on" drawn through the church; pt14-31) and "End Road Work" still straddles the arrow
  stem with the box offset from the text (pt14-02-d1-speedChange.png): BUG-15 NOT FIXED.

### Session 5: Boss (shared profile) - pt14-05-boss.ts
- **Seeding, stated:** the first attempt of this session found the Boss and, as instructed, seeded every meter to at least 50 % in
  localStorage (rally-trainer.decision.v1) before playing; it played Boss 1 (22 of 22 right) and then crashed on a bug in my player on
  the rung-1 Boss, and its log was lost. For the rerun I reset `bossRuns` to 0 (so Boss 1 is again the rung-2 one) and re-applied the
  50 % floor; the meters were already 86-98 % from the earlier runs, so the floor changed nothing. Headless (pt14-13-unlock.ts): from an
  empty profile the Boss opens **after the first Daily set (3 runs)** for a rule-card follower, and after 12 runs over 3 days for a rookie
  who is right 70 % of the time (PT-13: still locked after 7 runs and 75 decisions). BUG-04's unlock part FIXED.

| Boss | rung | wall | cards | dec/min | median / p75 / max gap | right | kinds |
|---|---|---|---|---|---|---|---|
| 1 | 2 (chart on the card) | 244 s | 22 (strip 1/22 .. 22/22) | 5.4 | 5.3 / 6.8 / **84.0 s** | 21 | all 14 kinds; at most 2 of one kind |
| 2 | 1 (chart behind "Chart") | 205 s | 22 | 6.4 | 5.2 / 7.2 / **65.4 s** | 21 | all 14 kinds |

- **The Boss now shows what it grades.** Boss 1 prints "Pause 15 s, in 55, out 40: sit 3.3 s on the watch" (right); Boss 2 says "Sit the
  chart time" and the yellow "Chart" button opens the cell without leaving the card; the follower opened it on restart, timed start,
  watch, speed change and pause cards and was right on all of them (pt14-42-boss-*.png). PT-13's three pause misses and the start miss
  are gone. BUG-04 FIXED.
- Every kind appears in the Boss (hazard, TA, checkpoint, lost, transit, watch, clock...); turns are 2 of 22, not 9 of 24.
- Both misses were the leg's long timed start: "START on Dad's Mark!, then CALL 55 4.6 s before the 1m21s ends" (+1.5 s) and "CALL 35 half
  a ramp before the 1m00s ends" (+1.5 s): the C-2 drift (the leg's car is a second or so off the ghost) plus a human reaction.
- **A long timed start holds the player 63-82 s on one card** with nothing to do but watch the digits (max gap 84 s; MOBILE.md wants a
  decision every few seconds). The micro cards cap timed segments at 10-25 s; the Boss leg does not (BUG-N5).
- Evidence for C-2 in the browser (pt14-09-evidence.ts E2, the same Boss through the app's own Continue path, cards 1-7 answered as the
  follower did): card 8/22 "Line 18: START on Dad's Mark!, then CALL 45 1.4 s before the 1m07s ends." The player STARTs on Mark! (+0.3 s)
  and waits for the watch to read 1m05.6s; **the card closes itself at 61.6 s**, before that reading, and says "Not quite: CALL 5.0 s
  late. You: START +0.3 s, CALL at 51.6 s. Right: START on Mark!, CALL at 46.6 s" (pt14-7x-e2-boss-timed-verdict-wrong-timedStart.png).
  He never called, the card names a CALL time 20 s before the interval it printed ends, and the headline says "late".
- Meters after: Stay on time fell 98 -> 86 -> 78 % on the two timed-start misses; the others 91-99 % with "Legal" buttons.

### Session 6: install and offline (shared profile) - pt14-06-pwa-offline.ts
- Manifest 200, application/manifest+json, start_url ./?mode=mobile, display standalone, **orientation "any"** (BUG-13 FIXED), icons
  192 / 512 / maskable 512 / SVG all 200; Chromium installability errors [], manifest errors [].
- Service worker registered, active and controlling; one cache (rally-trainer-df9a62738ef4) with 10 entries.
- Offline (`context.setOffline(true)`): reload OK, Home visible, start_url OK, Reference OK, a practice run started (after the
  "Run in progress" prompt) and 2 cards were played, both right. No errors.

### Evidence cards (pt14-09-evidence.ts, throwaway profile, each card put on screen through the real Continue path)
| Card | Prompt (abridged) | Follower did | Verdict |
|---|---|---|---|
| E1 tractor (C-1) | "A tractor at 18 mph 400 ft ahead; no room to pass for miles." | Make it all up (RULE-031 names trains and accidents) | Not quite +23.3 s, "Right: Make up what you can, claim the rest" |
| E2 Boss timed start (C-2) | "CALL 45 1.4 s before the 1m07s ends" | START on Mark!, wait for 1m05.6s | card closed at 61.6 s; Not quite: CALL 5.0 s late |
| E3 pause 15 on a turn row (BUG-01) | "Pause 15 s, in 45, out 45: sit 3.3 s on the watch" | GO at 3 s | Right |
| E4 TA (BUG-02) | "delayed 0m37s by a train; about 11 s of it could be made up" | Claim 0m20s | Right |
| E5 transit | "IN 9:31:50, take exactly 2m30s" | 9:34:20 (the middle of 9:33:20 / 9:34:20 / 9:35:20) | Right |
| E6 watch | "35 for 0m17s, then 40. You lapped at the sign." | opened details: lap 1m10.7s + 17 - lead 1.4 = 1m26.3s | Right |
| E7 restart base + position | "base 10:57:00, you start 19th; loss 6.1 s" | LAUNCH when the TOD digits showed 11:15:54 | Right +0.4 s |
| E8 clock | "You launch at 7:55:34, in about 40 s. Where do you read the minute from?" | Watch, TOD mode | Right |
| E9 lost with detour | "left the route 15 s ago... a detour about 20 s longer" | Keep going (20 < 2 x 15 + 20) | Right |
| E10 pre-read pause | "STOP, pause 20 s, in 35, out 35. How long do you sit?" | opened details: 20 - loss 7.6 = 12.4 | Right |

## D. PT-13 bugs 1-19: FIXED / NOT FIXED / REGRESSED

| PT-13 | What | Now | Evidence |
|---|---|---|---|
| BUG-01 HIGH | pause card prints a "sit" time its grader rejects (15 s rows with a turn) | **FIXED** | follower 160/160 at rung 2 and rung 1 (A); E3 "Pause 15 s, in 45, out 45: sit 3.3 s" on a turn row, GO at 3 s: Right; all 10 pause cards in play right |
| BUG-02 HIGH | TA grader contradicts RULE-033 / V.H.5 | **FIXED** | RULE-033 recipe 160/160 (PT-13: 6/60); E4 "0m37s ... 11 s could be made up" -> Claim 0m20s: Right; all 9 TA cards in play right; the card text now says "rounded down to 10 s steps" |
| BUG-03 HIGH | timed cards ask for a tap "at the sign" with no sign | **FIXED** (with a caveat) | a distance bar with feet counting down, "Mark!" in 26 px yellow + speech + a buzz exactly at the sign (seen at 13.51 s for a 13.5 s sign, 4.11 s for 4.1 s), and a call tick on the bar at rung 2; speed change 160/160 and timed start 160/160 for the follower on micro cards. Caveat: the call tick has no label, and on the Boss leg the timed start is graded off the ghost (C-2) |
| BUG-04 HIGH | Boss hides the chart it grades | **FIXED** | first Boss at rung 2 prints the numbers, later Bosses keep them one tap away behind "Chart"; follower 21/22 and 21/22 (both misses are C-2); Boss opens after the first Daily set for a follower |
| BUG-05 HIGH | Daily run 2 is half one question | **FIXED** | at most 2 cards of a kind in every one of 85 headless runs and 14 browser runs; Daily 2 had 6 kinds in 10 cards; Instruments has two kinds (clock jobs, watch) |
| BUG-06 MED | starting a run throws away the unfinished one | **FIXED** | Continue is the yellow primary button; every other run button opens "Run in progress: Continue my run / Start over" (pt14-11, pt14-12) |
| BUG-07 MED | verdict's rule sentence is not the deciding rule | **FIXED** | turn -> RULE-041 bold arrow; speed pre-read -> RULE-042; light -> "A traffic light is not named: make that time up"; TA size -> RULE-033; over-claim -> RULE-032; make-up over limit -> "Never go above the posted limit". One weak spot: the C-1 tractor miss cites RULE-033's "odd seconds" example, which does not say why a tractor qualifies |
| BUG-08 MED | one chart label, two meanings | **FIXED** | chips say "sit", "loss" or "lead" (pre-read "Stop & go 35 -> 35 loss 7.6 s"; pause "sit 3.3 s") |
| BUG-09 MED | over 40 words on screen on 60 of 102 cards | **FIXED** (borderline) | rendered words (innerText of the phone shell, as e2e/mobile-helpers.ts counts; closed "details" not counted): decision screens median 34, max 40, 1 of 85 at 40 at 390x844 and 2 of 87 at 360x780 (a watch card and a timed start); rule cards max 59. The PT-13 text-node counter over-counts closed "details" in Chromium (pt14-14-words-probe.ts), so its 44-word median is not comparable |
| BUG-10 MED | Reference and School are Desk pages squeezed to 390 px | **NOT FIXED** | Reference 1,048 elements under 16 px, 20,294 px tall; School 122 under 16 px, 18,951 px tall |
| BUG-11 MED | timed-start headline shows the part he got right | **FIXED** | START 2.0 s early, CALL right -> "Not quite: START 2.0 s early, -2.0 s", sentence RULE-022 "starts the stopwatch ... on that word" |
| BUG-12 LOW | restart card makes the needed number small | **FIXED** | TOD is now the big digits (47 px at 390 wide), the elapsed count small (pt14-22-try-restart.png); the 360 px chips are behind "details" |
| BUG-13 LOW | installed app cannot rotate | **FIXED** | manifest orientation "any" |
| BUG-14 LOW | no School link on the phone Home | **FIXED** | "School" button on Home (y 719, in view) |
| BUG-15 LOW | CAMEO labels overlap their arrows / icons | **NOT FIXED** (partly: "bridge" is now clear of its icon, pt14-60-360-timedStart.png) | "End Road Work" still straddles the arrow stem with its box offset (pt14-02-d1-speedChange.png); "grain elevator" and "church on" are drawn through their icons (pt14-22-try-watch.png, pt14-31-landscape-mark.png) |
| BUG-16 LOW | "Card n of N" moves backwards | **FIXED** | 1/10 .. 10/10, 1/22 .. 22/22 in every run; repeats replace a later card |
| BUG-17 LOW | lost card "0 s ago" | **FIXED** | 9-16 s ago in play, 6-24 s by design |
| BUG-18 LOW | chip noise | **FIXED** | chips are behind "details" and labelled ("to the checkpoint 6550 ft", "limit 35", "11 s late") |
| BUG-19 LOW | clock card "Not quite, 0.0 s" | **FIXED** | a wrong minute source costs 60 s on all 26 wrong answers (headless); the card now asks one of three jobs |

**19 PT-13 bugs: 17 FIXED, 2 NOT FIXED (BUG-10 Reference/School, BUG-15 CAMEO labels), 0 REGRESSED.**

Source note on C-1: the engine is right and the card is short. REG V.H.5's own example reads "Delayed 0m45s by a farm tractor", and the
Rally School videos name "train, tractor, school bus, construction, combine; never flat tire, oversleeping, getting lost, breakdown"
(docs/research/10-rally-school-videos.md line 24). RULE-031 names only "a train or helping at an accident", so a player who knows only the
cards cannot tell a tractor (qualifies) from a slow truck (does not).

## E. Metrics (target vs PT-13 vs now)
Human model: 149 decisions over 14 runs in sessions 1-5 (Daily 1-3, practice before / after Continue, five School "Try it" runs,
landscape practice, two Boss runs); gaps are wall time between two answer taps as Josh would feel them. Machine numbers and every
geometry figure come from the sweep (pt14-07-geometry.ts: 200 screens at 390x844, 204 at 360x780, 8 runs each, oracle taps).

| Target (MOBILE.md, MOB-040..042, MOB-061) | PT-13 | PT-14 | Verdict |
|---|---|---|---|
| First decision within 20 s (new player) | 5.1 s (machine 0.40 / 0.44 s) | **4.5 s**, first tap 6.6 s (machine 0.37 s at 390, 0.44 s at 360) | Pass |
| Median gap between decisions under 15 s | 6.5 s pooled; p75 17.1 s; 29 % over 15 s | **5.7 s** pooled (9.0 s without the Boss); p75 **18.7 s**, p90 22.8 s, max **84.0 s** (a 1m21s timed start on the Boss leg); 32 % over 15 s | Pass on the median; the tail is longer |
| At least 4 decisions a minute | Daily 6.8 / 4.2 / 4.6; School 4.5; landscape 4.7; after Continue 7.6; Boss 6.1 | Daily 4.1 / **3.7** / 4.4; Try it 4.5 / 5.5 / **3.4** (Stay on time) / 6.4 / 4.7; after Continue 6.8; landscape **3.8** / **3.3**; Boss 5.4 / 6.4 | **Fail** on 5 of 14 runs (the timed-card-heavy ones) |
| Words on screen before the first tap under 40 | median 44, 60 of 102 over 40 | rendered words median **34**, max **40**: 1 of 85 decision screens at 40 at 390 (a watch card), 2 of 87 at 360 | Pass (borderline) |
| Rule cards under 60 words | 56-71 on screen, 6 of 15 over 60 | max **59** rendered (title + rule + "source" + "Got it" + strip) | Pass |
| A run finishes in under 5 minutes at 1x | 133-235 s | 94-174 s for Daily / skill runs, 205 / 244 s for the 22-card Boss | Pass |
| Controls in the bottom 40 %, at least 56 px tall | Pass on cards | 0 bad screens of 404 (both sizes); 1-4 action controls. Not counted: the "details" and "Chart" buttons sit mid-card (about 40-50 % from the top), outside the thumb zone | Pass (cards); see BUG-N9 |
| Tap targets at least 48 px | 0 under 48 | 0 under 48 | Pass |
| No text under 16 px | shell 16 px; School 116 / Reference 1,048 under 16 | shell min 16 px (Home 17 px); **School 122, Reference 1,048** under 16 px | Pass in the shell; fail on School / Reference |
| No horizontal scroll | none | none (390 and 360, portrait and landscape) | Pass |
| No page or console errors | 0 | **0** in all sessions and sweeps | Pass |
| Manifest valid, service worker | Pass (orientation portrait) | Pass, orientation **any** | Pass |
| Offline after one load | Pass | Pass (reload, start_url, Reference, a run of 2 cards) | Pass |
| Time on a card (median) | option cards 2.2-3.0 s; pause 12.2, speed change 10.6, restart 17.0, timed start 26.3 s | option cards 2.2-3.5 s (watch 3.5 s with "details"); pause 11.8, **speed change 12.6**, restart 16.6, timed start 21.7 s; Boss timed starts 63-82 s | n/a |

Card mix the human saw (149): speed change 16, timed start 15, checkpoint 13, hazard 12, watch 12, restart 11, transit OUT 10, pre-read
10, pause 10, clock 10, TA 9, make-up 8, turn 8, lost 5. The most frequent kind is 11 % of cards (PT-13: clock 17 %). Rule-card
follower right on 133 of 139 (the six misses: four C-1 tractors, two Boss leg timed starts); naive rookie 2 of 10.

## F. Engagement rubric (0-5)

| Question | PT-13 | PT-14 | Why |
|---|---|---|---|
| A decision every few seconds | 4 | **3** | Option cards come every 5 s and the first decision is 4.5 s after opening. But the timed cards now (honestly) wait for the sign: speed change 12.6 s, timed start 22 s, a 30 s pause sits 25 s, and a Boss leg timed start holds you 63-84 s. A third of the gaps are over 15 s and the Stay on time run makes 3.4 decisions a minute. |
| Each card teaches one thing | 3 | **4** | Each card now has its own rule and its own numbers; base + position is asked; the clock asks three different jobs; the watch card is a real stopwatch reading. Lost a point's worth to the rule card shown before a run, which is often not the rule the next card uses (BUG-N3). |
| The verdict is clear and fair | 2 | **4** | A rule-card follower is right on every card of 13 of the 14 kinds over 160 seeds each. Headlines name the miss ("START 2.0 s early", "+20 % is above the posted 35"), sentences match the outcome. Two contradictions remain (C-1 tractor vs truck, C-2 Boss timed start). |
| The tap-stopwatch feels like a stopwatch | 2 | **4** | The bar runs down to the sign, Dad says "Mark!" exactly there, START on the word, CALL off the digits, LAUNCH off big TOD digits, the whole face is GO at a pause. Minus: the call tick on the bar is not explained, the big elapsed digits run uselessly on speed-change cards, and the watch card reads "1m01.8s" where the watch reads "0:00.00". |
| Rule cards short enough | 3 | **3** | Now under 60 rendered words with a title (good), but still a paragraph, read before a card that often needs a different rule; the naive player taps through in 2.5 s. |
| Progress feels real | 3 | **4** | "n/N" is fixed, the Boss opens after the first Daily set for a careful player (12 runs for a 70 % one), and the meters move by skill. But the meters are soon all "Legal" (86-98 % after about 15 runs), and a skill run is mostly other skills (4 of 12 cards for Start on time). |
| Would you come back tomorrow | 3 | **4** | The numbers vary (restart times and losses, transit IN times, lateness, room, limits), every kind turns up, the Boss is reachable on day one. Against it: stamped wording ("Line 2 is 600 ft ahead", "450 ft", "18 mph 400 ft") and four cards whose right answer sits in a fixed position. |
| Beats Desk mode for a few minutes on a phone | 5 | **5** | Unchanged: a decision in 5 s, a run in 2-3 minutes, Continue, offline. |

**Total 31 / 40** (PT-13: 25).

## G. The new pieces, judged
- **Mark cue (speed change, timed start).** It works: the bar shrinks with feet counting down ("590 ft" .. "0 ft"), "Mark!" appears in
  26 px yellow, Dad's line says "Mark!", speech and a 40 ms buzz fire, and it lands on the sign second (4.11 s for a 4.1 s sign, 13.51 s
  for 13.5 s). START on Mark is natural; CALL "2.3 s before Dad's Mark!" is an anticipation tap against the bar's yellow tick, which
  nothing on screen explains (it is the call point at rung 2; it is absent at rung 1). The naive player calls on Mark and is 2.3-2.9 s
  late every time, which is exactly the lesson. Good; label the tick.
- **Watch card.** A clean stopwatch question ("35 for 0m22s, then 40. You lapped at the sign. Call 40 when the main digits read?") that
  makes RULE-021 concrete. Two flaws: the lead it needs is behind "details" (one more tap, mid-screen), and the right reading is always
  the second-smallest option (lap + interval - lead sits between lap + interval - lead - 3 and lap + interval).
- **Boss with chart.** Fixed. Rung 2 prints the numbers; rung 1 keeps them behind a yellow "Chart" button that opens in place; every kind
  appears; 21/22 twice. The remaining problems are the leg's long timed segments (63-84 s on one card) and C-2.
- **Varied restarts.** Fixed and good: own time, base + position ("base 10:57:00, you start 19th" -> 11:15:54), transit OUT holds, five
  different standing-start losses (3.0-6.1 s), TOD as the big digits. This is now the best timing card in the game.

## H. Confusing cards and wrong or unhelpful verdicts (checked against content/rules.ts and the documents)
Wrong verdicts:
- C-1 tractor (long) -> "Make it all up" graded wrong; RULE-031 does not name tractors (the documents do). Slow truck -> claim graded
  wrong; nothing on the cards says a truck is not a TA cause. The verdict cites RULE-033's "odd seconds" example, which does not explain.
- C-2 Boss leg timed start: graded against the ghost's arrival at the sign, not the car's (REG VII.E.2.d: "the interval starts at the
  same place"); the card can close before the CALL time it printed; the headline then says "CALL 5.0 s late" for a call never made.

Unhelpful or confusing:
- The rule card shown before a run's first card of a skill is often another rule: RULE-007 (carry the speed to the next page) before
  "How long do you sit?"; RULE-033 (TA arithmetic) before a red light; RULE-040 (sync at pickup) before "What do you time it with?";
  RULE-015 (lunch) before a transit OUT; RULE-002 (full stop) before a turn.
- Speed change: "Call 40 2.3 s before Dad's Mark!" with an unlabelled yellow tick on the bar; the big elapsed digits run but mean nothing.
- Watch card: "1m01.8s" format next to a tap-stopwatch that reads "0:00.06"; the lead hides under "details".
- Verdict seconds wrap at 390 px ("+23.3 / s", "+5.0 / s" on two lines) next to a three-line headline (pt14-7x-e1, pt14-7x-e2).
- Prompts print 12-hour times ("7:55:34") while the TOD digits are 24-hour ("08:02:04"); harmless before 1 pm, confusing after.
- CAMEO labels still drawn through icons ("STOP" over the octagon, "church on", "grain elevator", "End Road Work").

## I. New bugs (ranked)
Severity as PT-13: HIGH = teaches the wrong thing or a rule-card follower is marked wrong; MEDIUM = misleading, breaks a target or
loses value; LOW = cosmetic or rare. Numbered BUG-N1.. to keep them apart from PT-13's BUG-01..19.

**BUG-N1 HIGH (C-1): the hazard card's TA causes are not on any rule card.**
Steps: Recovery run (or any run with a hazard, variant 2) -> "A tractor at 18 mph 400 ft ahead; no room to pass for miles. Your plan?"
-> by RULE-031 ("only for a delay beyond your control, such as a train or helping at an accident") pick "Make it all up".
Expected: right, or a card that names tractors. Actual: "Not quite: the delay you could not make up was not claimed +23.3 s"
(pt14-7x-e1-tractor-verdict-wrong-hazard.png). Reading the card broadly instead fails every slow truck ("A truck pulls out 400 ft ahead
at 24 mph, no room to pass" wants "Make it all up", 40/40). Missed in 3 of 5 skill runs and once after Continue. Cause: TA_CAUSES in
src/core/sim.ts (train, tractor, schoolBus, construction, combine, accident; sourced: REG V.H.5's "farm tractor" example and the videos)
versus content/rules.ts RULE-031; verdict sentence from src/core/decision/rules.ts PREFERRED.hazard.claim (RULE-033 "odd seconds").

**BUG-N2 HIGH (C-2): Boss-leg timed start graded off the ghost, and the card can close before its own CALL time.**
Steps: Boss (rung 2 seed 9 x 1237 reproduces it; pt14-11-timed-probe.ts lists 9 of 32 Boss timed starts) -> card 8/22 "Line 18: START
on Dad's Mark!, then CALL 45 1.4 s before the 1m07s ends." -> START on Mark!, wait for the watch to read 1m05.6s.
Expected: CALL then, graded right (REG VII.E.2.d: the interval starts where the speed change is). Actual: the card closes at 61.6 s
(maxSeconds = truth + 15 = 46.6 + 15) and says "Not quite: CALL 5.0 s late. You: START +0.3 s, CALL at 51.6 s. Right: START on Mark!,
CALL at 46.6 s." (pt14-7x-e2-boss-timed-verdict-wrong-timedStart.png). Cause: src/core/decision/runner.ts detectTimed computes
`t2 = ghostSign + seg.seconds - lead - tod`, which moves with the car's pace error (+7.0, +23.8, -25.8 s seen); the watch card
(detectWatch) uses the car's own lap and agrees with REG. Micro cards start on pace and never show it.

**BUG-N3 MEDIUM: the rule card before a skill's first card is often not the rule that card needs.** RULE-007 before "How long do you
sit?" (needs RULE-016), RULE-033 before a red light (RULE-031), RULE-040 before "What do you time it with?" (RULE-039), RULE-015 before a
transit OUT (RULE-014), RULE-002 before a turn (RULE-041), RULE-006 before a speed pre-read (RULE-042). Cause: src/core/decision/scheduler.ts
plan() picks a card for the skill preferring one not in rulesSeen, not the card of the slot's kind and variant (rules.ts introCardFor /
ruleCardFor(kind, variant)).

**BUG-N4 MEDIUM: four option cards have a positional give-away.** Pre-read pause: the right wait is always the middle of
"Go at once" / the chart wait / the printed pause (8/8); transit OUT: the middle of OUT - 60 s / OUT / OUT + 60 s (40/40); TA: the
second-smallest claim (40/40); watch: the second-smallest reading (40/40). Cause: the option sets in runner.ts detectPreread,
detectTransitOut, detectTa, detectWatch are symmetric around (or anchored on) the truth.

**BUG-N5 MEDIUM: a skill run is mostly other skills.** "Try it: Start on time" gave 4 start-on-time cards of 12; "Try it: Clock and
stopwatch" 4 of 10 (the per-kind cap of 2 times two kinds), the rest filler. A player who taps the weakest meter to work on it gets a
third of what he asked for. Cause: scheduler.ts MAX_PER_KIND with KINDS_OF_SKILL of two kinds; fill from `others`.

**BUG-N6 MEDIUM: Boss-leg timed segments hold the player 63-84 s on one card.** "CALL 55 4.6 s before the 1m21s ends" kept the human on
the card 81.6 s; "1m00s" 63 s. Micro cards cap timed segments at 10-25 s; the generated leg does not. Max gap 84 s against "a decision
every few seconds". Cause: scenarios.ts bossScenario (generateLeg fullLeg) + runner.ts detectTimed (no cap on seg.seconds for a card).

**BUG-N7 MEDIUM: Stay-on-time runs miss the 4 decisions/min target.** Try it Stay on time 3.4/min (median gap 18.6 s), Daily 2 3.7/min,
the landscape practice 3.3-3.8/min. Every card waits in real time (pause sits up to 25 s, timed starts 18-27 s). Options: cap pause
cards at 15 s rows, keep timed holds to 10-15 s, or interleave an option card between two timed ones (scheduler.ts plan order).

**BUG-N8 LOW: the speed-change call tick is unexplained and the big digits are noise.** The yellow tick on the sign bar is where to CALL
(rung 2) but nothing says so; the 64 px elapsed digits run on a speed-change card though the player times nothing (pt14-02-d1-speedChange.png).
Files: src/ui/mobile/cards.ts signBarHtml, tapwatch.ts (go mode).

**BUG-N9 LOW: "details" and "Chart" are mid-screen, outside the thumb zone,** and the watch card and the pre-read pause need them
(the lead / loss is not in the prompt). Files: cards.ts detailsHtml / decisionCardHtml; runner.ts prompts for watch and pre-read pause.

**BUG-N10 LOW: verdict seconds wrap** ("+23.3 / s", "+5.0 / s") beside a three-line headline at 390 px. File: styles.css .mv-head / .mv-sec.

**BUG-N11 LOW: stamped wording.** On micro cards every turn "Line 2 is 600 ft ahead", every checkpoint "450 ft ahead", every tractor "at 18 mph 400 ft
ahead", every signal "500 ft ahead", every micro card on "Line 2". File: scenarios.ts (fixed distances), runner.ts (rounding to 50 ft).

**BUG-N12 LOW: 12-hour times in prompts, 24-hour TOD digits.** "You launch at 7:55:34" vs "TOD 08:02:04"; after 1 pm "1:05:00" vs
"13:05:00". Files: runner.ts clockStr (formatClockFace) vs tapwatch.ts todText (formatClock).

**BUG-N13 LOW: a run is saved for Continue only after its first answer.** Closing on the first rule card loses the run (nothing answered,
so little is lost). File: src/ui/mobile/run.ts persist().

Still open from PT-13: BUG-10 (Reference / School not phone pages), BUG-15 (CAMEO labels through icons and arrows).

## J. Best and worst cards
Best three
1. **Restart / launch, now varied.** "base 10:57:00, you start 19th; standing-start loss 6.1 s" -> launch at 11:15:54 off big TOD digits.
   Two rules (RULE-010, RULE-011) in one real-time tap; the naive "tap on the printed time" costs +4.3 / +6.3 s and the verdict says
   "launched on your own time, not early by the loss".
2. **Lost with a detour.** "You left the route 15 s ago. This road rejoins it: a detour about 20 s longer. What now?" Real arithmetic
   (2 x 15 + 20 = 50 > 20: keep going), the dead-end variant flips it, and "claim a TA" is never right. Not guessable (always-turn-around 28/40).
3. **Timed start on a micro card.** START on Dad's "Mark!", CALL off the watch digits "2.3 s before the 0m15s ends": the bar, the word and
   the watch make it feel like the car; the naive "call when the interval is up" is late by the lead every time.
(Runner-up: the make-up card with room and a posted limit: "11 s late at 30 mph, posted limit 35; about 145 s of open road left".)

Worst three
1. **Hazard, long tractor** (C-1): the one card a rule-card follower cannot answer; it costs 21-28 s and cites a sentence that does not explain.
2. **Boss-leg timed start** (C-2 + BUG-N6): a minute or more of watching digits, then graded against a time the card did not show,
   sometimes after the card closed itself.
3. **Transit OUT** (and the TA claim): good arithmetic, but the right answer is always the middle (or second-smallest) option, so by the
   third one you stop adding.

## K. PT-13 top-10, now
| # | PT-13 fix | Now | Note |
|---|---|---|---|
| 1 | pause number = graded number; chip says what it means | FIXED | 160/160; "sit" / "loss" / "lead" |
| 2 | TA grader and cards agree | FIXED | 160/160; RULE-033 text "rounded down to 10 s steps" |
| 3 | give the timed cards a sign | FIXED | bar, feet, "Mark!" text + speech + buzz, call tick; Boss leg still C-2 |
| 4 | cap repeats, widen Instruments | FIXED | max 2 per kind; clock jobs + watch card; but see BUG-N5 |
| 5 | show the rule that decided the verdict | FIXED | sentences by outcome; headline names the miss |
| 6 | fix the Boss | FIXED (mostly) | chart on card / behind Chart, every kind, opens at 50 %; long leg timed holds (BUG-N6) and C-2 remain |
| 7 | remove the give-aways | PARTLY | fixed answers gone (clock 30/40, checkpoint 30/40, lost 28/40, make-up 32/40, hazard 25/40), but four positional give-aways (BUG-N4) and C-1 |
| 8 | vary the numbers | FIXED | 40 distinct transit IN times, 5 losses, base + position; wording still stamped (BUG-N11) |
| 9 | protect the unfinished run | FIXED | Continue primary + "Run in progress" prompt |
| 10 | 40 words, display details | PARTLY | rendered words median 34 / max 40, TOD big, chips behind details; CAMEO labels not fixed (BUG-15) |
| also | School link, Reference phone layout, orientation any, fixed n/N, "0 s ago" | 4 of 5 | Reference / School still Desk pages (BUG-10) |

## L. Top-10 fixes (ranked)
1. **C-1: put the TA causes on the card.** Add to RULE-031 (or a new card before hazard cards) the named causes with their sources: "a
   train, a farm tractor, a school bus, road construction, a combine (REG V.H.5 example; Rally School); slow traffic you could pass later
   is not one", and show RULE-031's cause sentence (not RULE-033's example) on a cause miss. Files: content/rules.ts RULE-031;
   src/core/decision/rules.ts PREFERRED.hazard; runner.ts hazardScene (say "farm tractor").
2. **C-2: grade the timed start from the car's own crossing** (lap at the sign + interval - lead, as detectWatch already does), and never
   close the card before the CALL time it printed (maxSeconds from the car-based time). Files: src/core/decision/runner.ts detectTimed /
   grade 'timedStart'.
3. **Show the rule card the next card needs** (ruleCardFor(kind, variant) of the slot, falling back to the skill card only when that one
   was seen). Files: src/core/decision/scheduler.ts plan(); rules.ts introCardFor.
4. **Break the positional give-aways**: draw the distractors asymmetrically (transit: OUT +/- 60 s and +/- 10 s, or IN + wrong interval;
   TA: truth +/- 10 and the unrounded rest; watch and pre-read pause: a near-miss on both sides). Files: runner.ts detectTransitOut,
   detectTa, detectWatch, detectPreread.
5. **Cap Boss-leg timed holds for the card** (show a timed start only when the hold is 10-25 s, or let the navigator fly the rest and ask
   the watch card instead). Files: runner.ts detectTimed (seg.seconds limit), scenarios.ts bossScenario.
6. **Make a skill run mostly that skill**: allow 3-4 of a kind when the run is a single-skill practice, or add kinds to the two-kind
   skills (Start on time: lunch departure, base + position as its own kind; Instruments: read TOD at a minute change, count-in). Files:
   scheduler.ts MAX_PER_KIND / plan(); scenarios.ts KINDS_OF_SKILL.
7. **Pace the Stay-on-time runs**: interleave an option card between two timed cards, and prefer 15-20 s pause rows and 10-15 s holds,
   so every run makes 4 decisions a minute. Files: scheduler.ts plan order; scenarios.ts pause / timed micro builders.
8. **Explain the call tick and quiet the digits**: label the tick "CALL" on the bar, and on a speed-change card show the feet / seconds to
   the sign big instead of an elapsed count. Files: src/ui/mobile/cards.ts signBarHtml, tapwatch.ts go mode, run.ts animateSign.
9. **Put the numbers a card needs in the prompt**: the lead on the watch card and the loss on the pre-read pause card (both now behind
   "details", mid-screen); keep "details" for the rest. Files: runner.ts detectWatch / detectPreread prompts; cards.ts detailsHtml.
10. **Display finish**: CAMEO labels clear of icons and arrows (BUG-15), verdict seconds on one line (BUG-N10), one clock format (BUG-N12),
    varied distances in the micro scenarios (BUG-N11), and a phone layout for Reference and the School (BUG-10). Files:
    src/ui/render/griid.ts / src/core/cameo.ts, src/ui/styles.css, runner.ts clockStr, scenarios.ts, src/ui/screens/reference.ts and school.ts.

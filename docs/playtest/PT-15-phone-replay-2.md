# PT-15: phone replay of PT-14 on the fix-sprint build

Status: complete (2026-10-23). Read-only playtest: nothing under src/, tests/, content/ or public/ was changed; nothing committed.

- Build: commit 1332b41 (fix sprint PT-14), `npm run build && npx vite preview --port 4187`.
- Browser: Playwright Chromium (/opt/pw-browsers/chromium), 390x844 (geometry also 360x780; landscape 844x390), touch on, isMobile,
  real `touchscreen.tap`, one shared persistent profile for sessions 1-6 (fresh at the start of session 1); throwaway profiles for the
  geometry sweep and the evidence cards.
- Tester: one agent playing Josh. No sub-agents: the Agent tool was not available in this session, so every skill run was played here.
- Player: playtest-scripts/pt15-player.ts reads the card from the DOM (kind title, prompt, option buttons, Column C, the TOD strip, the sign
  bar, the cell behind "Chart" at rung 1) and answers with the current rule-card follower (tests/pt14-follower.ts, wrapped by
  playtest-scripts/pt15-follower.ts) or a naive rookie. Timed cards are tapped in real time from what the screen shows (watch digits, TOD
  digits, the CALL tick, "Mark!") with a 0.15-0.35 s reaction. The oracle is used only as the CAMEO arrow reader. Sim time is never advanced.
- Independence check on the follower: pt15-follower.ts adds my own reading of RULE-031/032 for the hazard card (written from the card text,
  not the grader); it agreed with the grader on 320 of 320 hazard cards. Seeds in every audit are my own (not the fix sprint's test seeds).
- Boss: **not seeded.** The Boss was open by play at the start of session 5 (meters 87-97 % after the Daily set, Continue, five School skill
  runs and landscape, about 13 runs). The first Boss was the rung-2 one (`bossRuns` 0).
- Scripts: playtest-scripts/pt15-*.ts (01 first open + Daily, 02 Continue + N13, 03 Reference/School + Try it x5, 04 landscape, 05 Boss,
  06 PWA offline, 07 geometry + words, 09 evidence cards, 10 follower audit, 11 compressed-hold probe, 12 give-away audit; harness
  pt15-common.ts, player pt15-player.ts, brains pt15-follower.ts). Raw JSON in the session scratchpad, not committed.
- Screenshots: docs/playtest/screenshots/pt15-*.png (34 files, all under 230 KB).

## Verdict for Josh (one paragraph)
Yes, this is now the few-minutes-on-the-phone trainer you asked for. You open it and are deciding within 5 seconds; a Daily run takes about
two minutes; every run I played made more than 4 decisions a minute (the slow Stay-on-time runs now 4.6); Continue brings back the exact
card after a close; it works offline and sideways. Most important, if you do what the rule cards say you are never marked wrong: a
headless follower was right on all 4,468 micro cards and all 1,437 cards of whole Daily, practice, skill and Boss runs, and in the browser
142 of 142. The tractor-versus-truck trap and the Boss timed start that graded you off the ghost are both gone, and the minute-long holds
in the Boss now jump ahead with a visible "Jumped ahead 57 s." What you would still trip over: the exact-transit restart card is preceded
by a rule that says "leave exactly on the OUT second" but grades you on leaving early by the standing-start loss; if you are more than 2 s
late tapping START on a long Boss hold, the watch jumps without you and the verdict says "START 27.5 s late"; with Dad's voice on (or held
sideways) Dad says "Green sign up ahead" when the card shows a red STOP board; a run you close before your first answer is lost; and
after one evening every meter reads "Legal", so the meters stop telling you much. The pre-read "What speed" card and the clock card are
still easy points rather than lessons.

## FIXED table: PT-14 items

| PT-14 | What | Now | Evidence |
|---|---|---|---|
| C-1 / N1 HIGH | hazard TA causes not on any rule card (tractor vs truck) | **FIXED** | RULE-031 names the causes and the non-causes; scenes say "you can pass it soon" / "you cannot pass for miles". Follower 160/160 at rung 2 and rung 1; my own RULE-031 reading 320/320 agree; naive "claim it" 0/160. Browser: E1 long tractor -> "Make up what you can, claim the rest" Right; E1b slow truck -> "Make it all up" Right, sentence "A slow truck you can pass ... are not: make that time up"; E1c "Gates down: the last cars are passing" -> Make it all up, Right (pt15-7x-e1*-verdict.png). Whole runs: 66 Boss hazard cards right. |
| C-2 / N2 HIGH | Boss timed start graded off the ghost; card closed before its own CALL | **FIXED** | PT-14's exact card (Boss rung 2, seed 9 x 1237, card 8/22, "CALL 45 1.4 s before the 1m07s ends") replayed through Continue: START on Mark +0.4 s, the hold jumps, CALL at 70.3 s card time: **Right +0.7 s**, 11.4 s on the card (PT-14: closed at 61.6 s, "CALL 5.0 s late") (pt15-7x-e2-boss-timed-verdict.png). Headless 62/62 Boss timed starts right (40 Boss runs); 0 of 1,280 timed micro cards close before the follower's last tap. |
| N3 MED | rule card before a slot is another rule | **FIXED** (2 % residue) | Headless 143 rule-card -> next-card pairs: 140 are the card's own rule (RULE-014 -> transit, RULE-020 -> speed change, RULE-031 -> red light, RULE-010 -> base + position ...). Residue: RULE-016 (pause) before a pre-read that asks "Which way" (3 of 143; the pre-read "pause" sub-case asks "Which way" on 43 of 60 seeds because its STOP row also turns; E5). See also BUG-P1 (RULE-014 before a transit-OUT launch). |
| N4 MED | positional give-aways (middle / second-smallest) | **FIXED** | Best skill-free guess now: transit OUT 18/40 (was 40/40), TA claim 13/40 (was 40/40), watch 13/40 (was 40/40), pre-read pause 16/40 (was 8/8). Right answer's rank is spread (watch ranks 13/11/8/8; TA 11/10/13/6). |
| N5 MED | a skill run is mostly other skills | **FIXED** | Browser Try it: Start on time 8/12, Safety 9/10, Stay on time 8/11, Recovery 12/12, Instruments 8/11; headless 20 single-skill runs 67-100 %. |
| N6 MED | Boss-leg timed holds 63-84 s on one card | **FIXED** | 23 of 253 Boss timed cards are compressed (jumps 16.5-78 s); longest wall time on a timed card 20.4 s headless; browser Boss max gap 16.4 s / 20.8 s (PT-14: 84 / 65 s); "Long hold: the watch skips ahead ..." in the prompt, "Jumped ahead 57 s." when it jumps (pt15-41/42-boss-skip-jump.png). New edge: BUG-P2. |
| N7 MED | Stay-on-time runs under 4 decisions/min | **FIXED** | Try it Stay on time 4.64/min (PT-14 3.4), median gap 10.0 s; headless model 5.2-5.6/min; Daily 4.6 / 5.0 / 5.0 (PT-14 4.1 / 3.7 / 4.4). Every full run in the browser >= 4.1/min. |
| N8 LOW | call tick unexplained, elapsed digits noise | **FIXED** | "CALL" label under the tick at rung 2; speed-change card hides the elapsed digits (pt15-02-d1-speedChange.png). |
| N9 LOW | "details" / "Chart" mid-screen | **NOT FIXED** (less needed) | Not attempted. At rung 2 the numbers a card needs are now in the prompt (watch lead, pre-read loss), so the follower never opened "details" at rung 2. At rung 1 "Chart" is still mid-card (pt15-42-boss-pause.png), and on a long Boss timed card "details" is pushed to the edge of the action zone and clipped (pt15-42-boss-skip-jump.png). |
| N10 LOW | verdict seconds wrap | **FIXED** | "+4.3 s" on one line beside a three-line headline (pt15-7x-e4-transit-out-strict-verdict.png). |
| N11 LOW | stamped wording | **PARTLY** | Distances vary (checkpoint 350-650 ft, hazards 350-700 ft, turns 800-900 ft). Every micro card is still "Line 2" / "Pre-read, line 2". |
| N12 LOW | 12-hour prompts, 24-hour TOD | **FIXED** | One format: prompt "your time CDT 9:19:52", TOD strip "CDT 9:19:41", chips "CDT h:mm:ss". |
| N13 LOW | run saved only after the first answer | **NOT FIXED** | Started a Safety run, closed on its first rule card, reopened: no Continue (pt15-02). |
| BUG-10 MED (PT-13) | Reference / School not phone pages | **FIXED** | Reference: 30 collapsible sections, 0 text under 16 px closed and with every section open, no horizontal scroll, 9 wide tables scroll inside, 1,588 px tall closed (PT-14: 20,294 px, 1,048 small). School: 6 groups (first open), 0 under 16 px, no horizontal scroll; Try it reachable in 1 tap (first group) or 2 (open the group). Leftovers: BUG-P10. |
| BUG-15 LOW (PT-13) | CAMEO labels through icons / arrows | **FIXED** | "church on R", "grain elevator", "water tower", "toll booth" under their icons; "End Road Work" boxed right of the stem (pt15-02-d1-*.png, pt15-31-landscape-mark.png, pt15-60-360-watch.png). |

**15 PT-14 items: 12 FIXED, 1 PARTLY (N11), 2 NOT FIXED (N9, N13, both not in the sprint's top 10), 0 REGRESSED.**

PT-14 top-10, now: 1 C-1 FIXED; 2 C-2 FIXED; 3 rule card of the slot FIXED (2 % residue); 4 give-aways FIXED; 5 cap Boss holds FIXED;
6 skill runs FIXED; 7 Stay-on-time pace FIXED; 8 call tick FIXED; 9 numbers in the prompt FIXED (watch lead, pre-read loss at rung 2);
10 display finish PARTLY (CAMEO, verdict wrap, clock format, distances, Reference/School fixed; "Line 2" remains). **9 FIXED, 1 PARTLY.**

## A. Central test: a rule-card follower on every card kind (headless, pt15-10-follower-audit.ts)
14 kinds x 4 variants x 40 seeds, rung 2 (chart numbers on the card) and rung 1 (the follower opens "Chart"), 0.15-0.35 s reaction on
every timed tap; a "Not quite" for the follower is a contradiction between the cards and the grader.

| Kind | rung 2 | rung 1 | naive (rung 2) |
|---|---|---|---|
| pre-read (which way / speed / pause) | 160/160 | 160/160 | 149/160 |
| turn | 160/160 | 160/160 | 160/160 |
| speed change | 160/160 | 160/160 | 0/160 |
| timed start | 160/160 | 160/160 | 0/160 |
| pause | 160/160 | 160/160 | 0/160 |
| restart (own / transit OUT / base + position) | 160/160 | 160/160 | 0/160 |
| transit OUT | 160/160 | 160/160 | 160/160 |
| make-up | 155/155 | 155/155 | 120/155 |
| **hazard** | **160/160** (PT-14 140/160) | **160/160** (140/160) | 0/160 |
| TA claim | 160/160 | 160/160 | 19/160 |
| lost | 160/160 | 160/160 | 0/160 |
| checkpoint | 160/160 | 160/160 | 40/160 |
| clock | 159/159 | 159/159 | 29/159 |
| watch | 160/160 | 160/160 | 53/160 |

Whole runs through the Scheduler (follower): Daily 15 runs 168/168, practice 15 runs 161/161, single-skill 20 runs 228/228, Boss rung 2
20 runs 440/440, Boss rung 1 20 runs 440/440. Naive Daily 41/168. In the browser: 142 of 142 rule-card answers right over 14 runs
(sessions 1-5); the naive Daily 1 was 2 of 10.

**Contradictions: none.** (PT-14: two, both High.) The closest thing is a wording conflict between two cards (BUG-P1, below), which the
follower survives because the card prints the loss and RULE-011 applies to every launch.

## B. Give-away audit (pt15-12-guess-audit.ts; 40 seeds per kind, variant = seed % 4; "right" is the grader's verdict)

| Card | PT-14 best guess | Now: position (best of 4) | rank / middle | best fixed label | Verdict |
|---|---|---|---|---|---|
| Transit OUT | middle 40/40 | 18/40 | 18/40 | n/a | FIXED |
| TA claim | 2nd smallest 40/40 | 13/40 | 13/40 | n/a | FIXED |
| Watch | 2nd smallest 40/40 | 12/40 | 13/40 | n/a | FIXED |
| Pre-read pause ("How long") | middle 8/8 | 16/40 | 15/40 | n/a | FIXED |
| Pre-read speed ("What speed") | 3/20 | 15/40 | **middle 23/40** (never the lowest or highest option) | n/a | mild new tell; the answer is printed in Column C anyway (BUG-P7) |
| Clock | TOD 30/40 | 15/40 | n/a | **"Watch, TOD mode" 30/40** (accepted for "count the second in" too) | NOT FIXED (unchanged, BUG-P6) |
| Checkpoint | Hold speed 30/40 | 14/40 | n/a | Hold speed 30/40 | unchanged; the colour decides (fine) |
| Lost | Turn around 28/40 | 15/40 | n/a | Turn around 32/40 | unchanged (dead end half the time) |
| Make-up | +10 % 32/40 | 22/40 | n/a | any label <= 22/40 | improved |
| Hazard | Make it all up 25/40 | 18/40 | n/a | Make it all up 26/40 | unchanged; "Claim the whole delay" is never right (0/40) |

## C. Sessions (browser, 390x844, one shared profile)

### Session 1: first open, first 60 s, Daily set (fresh profile), pt15-01
Home at 0.2 s; tapped "Play daily run 1 of 3" at 1.9 s; **first decision 4.5 s**, first tap 6.6 s. In 60 s: 6 decisions and 3 rule cards
(PT-14: 5 and 3). Home: 69 words, no text under 16 px, Daily button at y 264 (pt15-01-home-first-open.png).

| run | policy | wall | dec | rules | right | dec/min | median / p75 / max gap | recap |
|---|---|---|---|---|---|---|---|---|
| Daily 1 | naive | 131 s | 10 | 3 | 2 | 4.6 | 15.1 / 18.1 / 20.0 s | 0 stars, 62.4 s off |
| Daily 2 | rules | 121 s | 10 | 2 | 10 | 5.0 | 7.8 / 17.3 / 19.3 s | 3 stars, 3.2 s off |
| Daily 3 | rules | 144 s | 12 | 3 | 12 | 5.0 | 6.4 / 15.0 / 20.1 s | 3 stars, 2.0 s off |

- Every naive miss is a real lesson: +20 % over a posted 35 ("+20 % is above the posted 35"), stopping at a green sign (+40.3 s), calling
  on Mark (+2.6 / +3.0 s), launching on the printed time (+4.3 / +6.2 s), calling when the interval is up (+2.8 / +2.9 s).
- The rule card is the slot's own rule every time in this session: RULE-026 -> make-up with a posted limit, RULE-003 -> checkpoint,
  RULE-020 -> speed change, RULE-042 -> "What speed", RULE-010 -> base + position, RULE-016 -> "How long do you sit?", RULE-031 -> red light.
- "n/N" 1/10 .. 10/10 and 1/12 .. 12/12. Rendered words on decision screens 23-40, rule cards 47-57.
- Home after: Streak 1, three pills done, meters 59 / 45 / 64 / 23 / 23 %, Boss locked. No console or page errors.

### Session 2: Continue and the Continue / Start over prompt, pt15-02
- Closed the browser on card 4 (a train hazard). Reopened: "Continue run (3 of 10 done)" is the yellow primary at y 74; "Daily set done:
  practise" grey at y 280 (pt15-11-home-continue.png). Tapping it opens "Run in progress ... Continue my run / Start over / Home"
  (pt15-12-confirm-start-over.png). "Continue my run" brought back **the same card** (hazard:0:1, card 4, same prompt) 0.9 s after the
  load (pt15-13-after-continue.png); then 7 cards in 47 s (8.9/min), 10 of 10, 3 stars.
- Start over works (a Recovery run with one answer, then an Instruments meter -> Start over -> new run, old one gone).
- N13 still open: a Safety run closed on its first rule card leaves no Continue.
- The first three cards of the practice run each came after a rule card: 3 decisions in 70 s (2.6/min) before the run settles.

### Session 3: Reference, School and a skill run per skill from "Try it", pt15-03
- Reference on the phone is now a phone page: 30 collapsible sections, 0 text under 16 px (closed, one open, all open), no horizontal scroll,
  wide tables scroll inside (pt15-20, pt15-21). School: 6 groups, the first open, 11 Try it buttons in view of 43, 0 under 16 px (pt15-22).

| Try it | wall | dec | of the skill | dec/min | median / p75 gap | right | stars |
|---|---|---|---|---|---|---|---|
| Start on time | 146 s | 12 | 8 (restart 4, transit 4) | 4.9 | 5.0 / 16.7 s | 12 | 3 |
| Safety and course | 64 s | 10 | 9 | 9.4 | 4.3 / 4.4 s | 10 | 3 |
| Stay on time | 142 s | 11 | 8 (pause 3, speed change 3, timed 2) | **4.6** | 10.0 / 15.9 s | 11 | 3 |
| Recovery | 68 s | 12 | 12 | 10.6 | 4.7 / 4.8 s | 12 | 3 |
| Clock and stopwatch | 75 s | 11 | 8 (watch 4, clock 4) | 8.8 | 4.4 / 4.8 s | 11 | 3 |

(PT-14: of the skill 4/12, 6/10, 6/10, 8/10, 4/10; Stay on time 3.4/min.) The Stay-on-time run interleaves option cards (watch, transit,
checkpoint) between the timed ones. Restarts vary (own time, base + position "base CDT 8:31:00, you start 29th", transit OUT).

### Session 4: landscape, pt15-04
Rotating on a speed-change card kept the run and the card both ways; buttons and watch on the left, card on the right; no text under 16 px,
no small target, no horizontal scroll; the card side scrolls. Four cards sideways (speed change, timed start, transit, pause) and six in
portrait: 10 of 10, 3 stars; "Mark!" visible at the sign (pt15-31-landscape-mark.png). Landscape shows 44-48 rendered words on timed cards
(the TOD strip, digits and labels sit in view).

### Session 5: Boss (not seeded; open by play), pt15-05

| Boss | rung | wall | cards | dec/min | median / p75 / max gap | right | compressed holds |
|---|---|---|---|---|---|---|---|
| 1 | 2 (chart on the card) | 132 s | 22 (1/22 .. 22/22) | 10.0 | 4.5 / 5.0 / 16.4 s | 22 | restart 14.3 s, timed start 11.5 s ("Jumped ahead 20 s.") |
| 2 | 1 (chart behind "Chart") | 155 s | 22 | 8.5 | 4.4 / 7.4 / 20.8 s | 22 | restart 18.7 s, pause 5.3 s, timed start 11.2 s ("Jumped ahead 57 s.") |

All 14 kinds in both. The follower opened "Chart" on 9 cards of Boss 2 and was right on all. Long timed starts carry "Long hold: the watch
skips ahead to 5 s before the CALL." and then "Jumped ahead N s." (pt15-41/42-boss-skip-jump.png); START on Mark, the digits jump about 2 s
later, then 5 s to the CALL: easy to follow. These cards show 51-57 rendered words (BUG-P4). Meters after: 92-99 %, all "Legal".

### Session 6: install and offline, pt15-06
Manifest 200 (application/manifest+json), start_url ./?mode=mobile, standalone, orientation any, icons 192/512/maskable/SVG all 200;
installability errors [], manifest errors []; service worker active and controlling, one cache of 10 entries. Offline: reload OK, Home,
start_url, Reference OK, a practice run of 2 cards played, both right (pt15-50, pt15-51). No errors.

### Evidence cards (pt15-09-evidence.ts, through the real Continue path, throwaway profile)
| Card | Prompt | Played | Verdict |
|---|---|---|---|
| E1 long tractor (C-1) | "A farm tractor 350 ft ahead at 18 mph; you cannot pass for miles." | Make up what you can, claim the rest | Right, RULE-032 "Claim only what you could not make up" |
| E1b slow truck | "A slow truck 400 ft ahead at 25 mph; you can pass it soon." | Make it all up | Right, RULE-031 "... are not: make that time up" |
| E1c short train | "Gates down 600 ft ahead: the last cars are passing." | Make it all up | Right |
| E2 PT-14's C-2 card | "Line 18: START on Dad's Mark!, then CALL 45 1.4 s before the 1m07s ends. Long hold: ..." | START +0.4 s, CALL after the jump at 70.3 s | **Right +0.7 s**, 11.4 s on the card |
| E3 red board | "A red GREAT RACE STOP board is 350 ft ahead." | Stop and check in | Right; but Dad's line is "Green sign up ahead." (BUG-P3) |
| E4 transit OUT after RULE-014 | rule card RULE-014 ("leave exactly on the OUT second"), then "Transit OUT, line 3: your time CDT 9:19:52; standing-start loss 3.7 s. Tap LAUNCH on the launch second." | LAUNCH exactly on 9:19:52, as the card just shown says | **Not quite +4.3 s**: "launched on your own time, not early by the loss" (BUG-P1, pt15-7x-e4) |
| E5 pre-read pause slot | rule card RULE-016 (pause), then "Pre-read, line 2. Which way does the book send you here?" | the arrow | Right; the rule card was for another question (BUG-P5) |

## D. Metrics (target / PT-14 / now)
Human model: 152 decisions over 14 runs in sessions 1-5 (Daily 1-3, practice before/after Continue, five Try it runs, landscape practice,
two Boss runs). Geometry and words: pt15-07-geometry.ts, 204 screens at 390x844 and 204 at 360x780, 8 runs each, oracle taps.

| Target (MOBILE.md) | PT-14 | PT-15 | Verdict |
|---|---|---|---|
| First decision within 20 s | 4.5 s (machine 0.37 s) | **4.5 s**, first tap 6.6 s (machine 0.40 s at 390, 0.35 s at 360) | Pass |
| Median gap under 15 s | 5.7 s; p75 18.7, p90 22.8, max 84.0 s; 32 % over 15 s | **4.8 s**; p75 13.5, p90 17.8, max 28.6 s; **22 %** over 15 s (without Boss: 4.9 / p75 15.9) | Pass; the tail is much shorter |
| At least 4 decisions a minute | Fail on 5 of 14 runs (3.3-3.8) | Daily 4.6 / 5.0 / 5.0; Try it 4.9 / 9.4 / **4.6** / 10.6 / 8.8; after Continue 8.9; landscape 5.3 / 6.0; Boss 10.0 / 8.5 | **Pass on every full run** |
| Words before the first tap under 40 | median 34, max 40 | sweep median 35 / 34, max 40 (5 of 88 screens at 40 at 390, 3 at 360); Boss long holds **51-57**, rung-1 Boss watch / pre-read 41, landscape 44-48 | Pass (borderline) in the sweep; fail on Boss long holds (BUG-P4) |
| Rule cards under 60 words | max 59 | max **57** | Pass |
| A run under 5 minutes | 94-244 s | 64-146 s (Daily / skill), 132 / 155 s (22-card Boss) | Pass |
| Controls bottom 40 %, >= 56 px | 0 bad of 404 | **0 bad of 408**; "details" / "Chart" still mid-card | Pass (cards) |
| Tap targets >= 48 px | 0 under 48 | 0 under 48 in the shell; Reference 12 inline links 17 px tall, School "Long form" 23 px | Pass (shell); Low on Reference / School |
| No text under 16 px | shell 16; School 122 / Reference 1,048 | shell min 16 px; **School 0, Reference 0** (all sections open) | Pass |
| No horizontal scroll | none | none (390, 360, landscape, Reference, School) | Pass |
| No page / console errors | 0 | 0 | Pass |
| Manifest, service worker | Pass | Pass | Pass |
| Offline after one load | Pass | Pass | Pass |
| Time on a card (median) | option 2.2-3.5 s; pause 11.8, speed change 12.6, restart 16.6, timed start 21.7 s; Boss holds 63-82 s | option 1.6-2.8 s; pause 12.2, **speed change 8.1**, restart 16.3, **timed start 15.1** s; Boss holds 11-19 s | n/a |

Card mix the human saw (152): speed change 16, transit OUT 14, timed start 14, checkpoint 13, restart 12, watch 12, clock 12, pre-read 11,
pause 9, hazard 9, make-up 8, turn 8, TA 8, lost 6. Rule-card answers 142/142 right; naive 2/10.

## E. Engagement rubric (0-5)

| Question | PT-14 | PT-15 | Why |
|---|---|---|---|
| A decision every few seconds | 3 | **4** | Median gap 4.8 s, 22 % over 15 s (was 32 %), max 28.6 s (was 84 s); every run >= 4.6/min. Still: speed change 8 s, pause 12 s, restart 16 s, timed start 15 s of waiting, and a run that opens with three rule cards runs at 2.6/min for its first minute. |
| Each card teaches one thing | 4 | **4** | The rule card is the slot's own rule (98 %); skill runs are two-thirds or more their skill. Minus: "What speed" just reads Column C; the pre-read pause slot mostly asks "Which way"; the transit-OUT launch needs two cards but shows one. |
| The verdict is clear and fair | 4 | **5** | No contradiction in 5,905 headless cards and 142 browser answers; headlines name the miss; seconds no longer wrap; the hazard verdicts quote the exact RULE-031 sentence. Two flaws are counted elsewhere (BUG-P1 wording, BUG-P2 a misreported late START). |
| The tap-stopwatch feels like a stopwatch | 4 | **4** | CALL tick labelled, no idle digits on a speed change, Boss timed starts are timed off your own lap; the jump on long holds is clear. Minus: the jump is an artifice, a late START misses it (BUG-P2), and the long-hold note crowds the card. |
| Rule cards short enough | 3 | **4** | 47-57 words with a title and a phone "short" (RULE-031), and now the rule the next card uses. Still a paragraph; three of them in the first 20 s of a first run. |
| Progress feels real | 4 | **4** | Boss opened by play in the first sitting; meters move per skill. But all five meters are 87-99 % "Legal" after about 13 runs, the same evening. |
| Would you come back tomorrow | 4 | **4** | No fixed or positional answers on the arithmetic cards; distances, times, losses vary; every kind shows up. Against: every micro card is "Line 2", the clock card is still "tap TOD" 75 % of the time. |
| Beats Desk mode for a few minutes on a phone | 5 | **5** | A decision in 5 s, a run in 1-2.5 minutes, Continue, offline, landscape, and now a readable Reference and School. |

**Total 34 / 40** (PT-14: 31, PT-13: 25).

## F. The judgement questions
- **Do the hazard scenes make the right answer deducible from the rule card?** Yes. Each scene carries the words RULE-031 decides on
  ("slow truck ... you can pass it soon", "farm tractor ... you cannot pass for miles", "a flagger holding traffic", "the signal ... has just
  turned red"), and a short delay ("the last cars are passing", "turning into a field gate") accepts both make-up answers, so RULE-032 is
  not a trap. My own reading of the card agreed with the grader on 320/320. The cost: the card is now partly phrase-matching; "Claim the
  whole delay" is never right, so the choice is really two-way.
- **Do compressed holds feel fair?** Yes for anyone who starts on Mark: the prompt warns, the watch and TOD jump together 2 s after the sign,
  "Jumped ahead N s." appears, and 5 s remain to the CALL (Boss 22/22 twice, 62/62 headless). Unfair edge: a START more than 2 s late is
  booked after the jump (BUG-P2). The note pushes these cards to 51-57 words.
- **Are skill runs now about their skill?** Yes: 8/12, 9/10, 8/11, 12/12, 8/11 in the browser, 67-100 % headless.
- **Is the Stay-on-time pace acceptable?** Yes, just: 4.6 decisions a minute, median gap 10 s, p75 15.9 s, because option cards now sit
  between the timed ones (pauses 15-20 s, holds 10-15 s). It is still the slowest skill and the one with the most waiting.
- **Do Reference and School work on a phone?** Yes. Both are one column of collapsible sections with no text under 16 px and no sideways
  scroll; Try it is one or two taps. Leftovers are polish (BUG-P10).

## G. Confusing cards and wrong or unhelpful verdicts
- Transit-OUT restart after RULE-014: the card says "leave exactly on the OUT second"; the grader wants OUT minus the standing-start loss
  (RULE-011). The verdict explains it, but the card shown seconds before says the opposite (BUG-P1).
- Red STOP board: Dad's line "Green sign up ahead." (BUG-P3).
- Compressed hold with a late START: "Not quite: START 27.5 s late" for a START 2.5 s late (BUG-P2).
- Pre-read "pause" slot: RULE-016 card, then "Which way does the book send you here?" (BUG-P5).
- Clock "count the second in": "Watch, TOD mode" is graded right as well as "Clock second hand", while RULE-038 says to use the clock only
  for its second hand there (BUG-P6).
- The verdict box covers the last line of a three-line prompt (pt15-7x-e4: "LAUNCH on the launch second" cut).
- Reference lists internal file paths ("[docs/research/09 §5 ...]") and opens with "Seconds per mile (SCCA / odometer-style rallies only)".

## H. New bugs (ranked)
Severity as before: HIGH = teaches the wrong thing or a rule-card follower is marked wrong; MEDIUM = misleading, breaks a target or loses
value; LOW = cosmetic or rare. **No HIGH.**

**BUG-P1 MEDIUM: the transit-OUT launch is preceded by a rule card that says the opposite of the grader.**
Steps: a Start-on-time slot of sub-case transitOut (restart variant 1) as the skill's first slot -> rule card RULE-014 ("Arrive early,
pull up to the sign, and leave exactly on the OUT second") -> "Transit OUT, line 3: your time CDT 9:19:52; standing-start loss 3.7 s. Tap
LAUNCH on the launch second." -> LAUNCH on 9:19:52. Expected: right, or a card that says to lead by the loss. Actual: "Not quite: launched
on your own time, not early by the loss +4.3 s" citing RULE-011 (pt15-7x-e4-transit-out-strict-verdict.png). The rule-card follower is
right only because it also applies RULE-011. Files: content/rules.ts RULE-014 (add "launch early by the standing-start loss, RULE-011"),
or src/core/decision/rules.ts INTRO.restart.transitOut (show RULE-011, or both).

**BUG-P2 MEDIUM: a START more than 2 s late on a compressed hold is booked after the jump.**
Steps: Boss, a long timed start ("... before the 0m33s ends. Long hold: ..."; skip at 6.1 -> 31.1 card s) -> tap START 2.5 s after Mark.
Expected: "START 2.5 s late". Actual: "Not quite: START 27.5 s late", 27.5 s added to the run total; the watch then counts from the
post-jump moment, so the CALL reading the card asks for comes far too late (pt15-11-skip-probe.ts; a START 1.0 s late is right).
Files: src/core/decision/runner.ts fitWall (skip.at fixed at truth + 2), src/ui/mobile/run.ts cardSeconds: jump only after the START tap
(or at max(START, truth) + 2), and grade START in wall seconds.

**BUG-P3 MEDIUM: Dad says "Green sign up ahead." on the red GREAT RACE STOP board card**. Seen in landscape
and spoken when Dad's voice is on; the colour is the whole decision on that card. File: src/ui/mobile/cards.ts driverLine 'checkpoint'.

**BUG-P4 LOW: Boss long-hold timed starts show 51-57 words.** The note "Long hold: the watch skips ahead to 5 s before the CALL." adds 11
words to a three-line prompt; at rung 1 the Boss watch and pre-read cards reach 41. Files: runner.ts fitWall note (e.g. "Long hold: the
watch jumps."), cards.ts (show the note only when it jumps).

**BUG-P5 LOW: the pre-read "pause" sub-case asks "Which way" on 43 of 60 seeds** (its STOP row also turns), so the pause question is rare
(about 7 % of pre-read cards) and RULE-016 is sometimes shown before a which-way card (3 of 143 rule cards). Files: scenarios.ts preread
shape 1 (STOP straight on, or a hint), runner.ts detectPreread (ask "How long" when the slot is the pause sub-case).

**BUG-P6 LOW: the clock card is still "tap Watch, TOD mode" 30 of 40 times** (TOD is accepted for "count the second in"). Files:
runner.ts clock grading (second hand only for the second, or accept TOD and say so on RULE-038), scenarios.ts clock variant mix.

**BUG-P7 LOW: pre-read "What speed" is a reading card.** Column C prints the speed and the options are it +/- 5 or 10, never the extreme
(middle guess 23/40). File: runner.ts detectPreread speed options (ask about a row whose speed is not printed: RULE-007's carried speed).

**BUG-P8 LOW: on long Boss cards "details" is pushed to the edge of the action zone and clipped** (pt15-42-boss-skip-jump.png); "Chart"
at rung 1 is mid-card (pt15-42-boss-pause.png). Part of N9. Files: cards.ts decisionCardHtml / detailsHtml, styles.css .mob-main.

**BUG-P9 LOW: the verdict box covers the last line of a long prompt** (pt15-7x-e4). File: styles.css .mob-verdict.

**BUG-P10 LOW: Reference polish.** Internal paths "[docs/research/09 §5 ...]" in the rules summary; the first section is SCCA seconds per
mile; 12 inline links 17 px tall; School "Long form" links 23 px. File: src/ui/screens/reference.ts, school.ts.

**BUG-P11 LOW: meters saturate in one sitting.** After the Daily set and about 10 more runs all five meters were 87-97 % with "Legal"
buttons. File: src/core/decision/progress.ts METER_GAIN / LEGAL_UNLOCK (or count only distinct days).

Still open from PT-14: N9 (details/Chart mid-screen), N11 ("Line 2" on every micro card), N13 (run saved only after the first answer).

## I. Best and worst cards
Best three
1. **Restart / launch, base + position.** "base CDT 10:44:00, you start 29th; standing-start loss 6.1 s" -> launch off big TOD digits;
   two rules in one real-time tap, and the naive "tap on the printed time" costs 4-6 s with a verdict that says why.
2. **Timed start, micro and Boss.** START on Dad's "Mark!", CALL off your own watch; on the Boss the long count jumps ahead and is graded
   from your own lap. Feels like the car.
3. **Hazard, now.** Four scenes, one rule card that decides them, the short train and the field gate forgive either make-up answer. It
   teaches a real REG V.H distinction (a tractor you cannot pass vs a truck you can).
(Runner-up: lost with a detour, 2 x ago + 20 vs the detour.)

Worst three
1. **Transit-OUT launch after RULE-014** (BUG-P1): do what the card just said and be told "Not quite +4.3 s".
2. **Pre-read "What speed"**: the answer is printed in the row and sits in the middle of the options.
3. **Clock**: "Watch, TOD mode" is right three times in four.

## J. Top-10 fixes (ranked, with file hints)
1. **RULE-014 and the transit-OUT launch agree** (BUG-P1): add "launch early by the standing-start loss (RULE-011)" to RULE-014, or show
   RULE-011 before that sub-case. content/rules.ts; src/core/decision/rules.ts INTRO.
2. **Jump only after START** (BUG-P2): the compressed hold starts its jump at max(START tap, sign) + 2 s and START is graded in wall time.
   src/core/decision/runner.ts fitWall / grade 'timedStart'; src/ui/mobile/run.ts cardSeconds.
3. **Dad's checkpoint line by variant** (BUG-P3): "Red board up ahead." for the observation checkpoint src/ui/mobile/cards.ts driverLine.
4. **Save the run when it starts** (N13): persist before the first rule card. src/ui/mobile/run.ts persist / renderRun.
5. **Keep long-hold cards under 40 words** (BUG-P4): a 4-word note, shown when it jumps. runner.ts fitWall; cards.ts.
6. **Make the pre-read pause slot ask "How long"** (BUG-P5) and give "What speed" a row without a printed speed (BUG-P7).
   src/core/decision/scenarios.ts preread; runner.ts detectPreread.
7. **Vary the line numbers on micro cards** (N11): "Line 2" on every card makes them look stamped. scenarios.ts (lead-in rows) / runner.ts.
8. **Clock card**: grade "count the second in" by RULE-038 (second hand) or change the mix so one button is not 75 % (BUG-P6).
   runner.ts clock; scenarios.ts clock.
9. **Thumb-zone details and Chart, verdict below the prompt** (N9, BUG-P8, BUG-P9): put "details" / "Chart" in the action zone; keep the
   verdict from covering the prompt. cards.ts; styles.css.
10. **Meters and Reference polish** (BUG-P11, BUG-P10): slower meter gain or per-day credit so "Legal" means something; hide internal paths,
    put Great Race sections first, larger inline links. src/core/decision/progress.ts; src/ui/screens/reference.ts, school.ts.

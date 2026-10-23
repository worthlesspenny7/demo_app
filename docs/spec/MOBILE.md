# Mobile-first, decision-first redesign (Phase VIII, 2026-10-23)

Josh's verdict after playing: too much reading, too few decisions, and he will play for a few minutes on his
phone, not at a desk. This document is the design the build follows. The engine, the rules and the sources of
truth do not change; the way they are presented does.

## Principles
1. A decision every few seconds. The player never waits for the car to cruise. The engine runs in "decision
   mode": it fast-forwards between decision points and presents one card per decision.
2. Read less than 40 words before acting. Rules are taught as a rule card (two or three lines) shown just before
   the first card that needs it, then practised at once. The long lessons move to Reference.
3. Real time only where the timing itself is the skill: counting a pause and tapping GO, the launch count, a
   short timed segment with the stopwatch running. Everything else is instant.
4. Phone first, one thumb, portrait. Big tap targets in the bottom third, no hover, no keyboard, haptics on
   verdicts, optional speech. Works offline from the home screen as an installable web app (manifest + service
   worker). No native app.
5. Desk mode stays. The existing cockpit becomes "Desk mode" for long sessions; both modes share the engine.
6. Honest, short feedback: every card ends with seconds gained or lost and one sentence naming the rule, then
   the next card. Scores are per skill (the Four S's), with streaks and a daily set.

## The decision loop
A **run** is 10 to 15 cards and takes 3 to 5 minutes. A card is one decision point (DP) the engine found by
fast-forwarding a real scenario (a drill or a generated leg) to the next moment the navigator must act:

| DP kind | What the player sees | Action | Verdict |
|---|---|---|---|
| preread | the next book row (CAMEO, Column C, remark) | tap: which way / what speed / what to mark | right or wrong, the rule |
| turn | approach view, distance to the decision point | tap the direction before the point passes (time-limited) | taken / late / wrong road, seconds |
| speedChange | the sign ahead, current and assigned speed | tap "call now" when the split is right (or pick the split speed) | seconds early/late |
| timedStart | the sign, Column C chain | tap START at the sign, then tap the next speed at the right stopwatch time | seconds off |
| pause | "Stopped" at the sign, in/out speeds, chart | the phone is the stopwatch: tap GO at the chart second | dwell error |
| restart | the clock face and the printed base time | tap the launch second (minute and second) | early/late/minute mistake |
| transitOut | IN time shown, printed interval | enter or tap the OUT time | right/wrong |
| makeup | you are N s late, assigned speed, distance left | pick 10 % / 20 % / shorten a stop / leave it | seconds recovered, disturbed interval |
| hazard | a train, tractor, red light, slow truck | pick: wait and claim TA / make it up / both | correct per REG V.H |
| ta | the TA point box, your ledger | pick the claim in 10 s steps | credit vs claim |
| lost | you missed a turn N s ago | pick: turn around and time it / keep going / rejoin behind a car | seconds lost, rule |
| checkpoint | the green sign ahead | tap: do nothing / slow / stop | penalty or none |
| clock | a launch coming up, the dash clock | which instrument for the job: the minute, the launch second, the next interval | right/wrong |
| watch | the stopwatch just after the lap at a timed line's sign | the main-digit reading at which to call the next speed | seconds off |

Cards are chosen by a scheduler that mixes skills, repeats what was missed, and never shows a rule card twice
unless the skill is failing.

## Sessions and progression
- **Daily set**: three runs (about 12 minutes) re-randomised per calendar day; streak counter.
- **Skill meters**: Safety and course, Start on time, Stay on time (pauses, timed, speed changes), Recovery (make-up,
  TA, lost), Instruments (clock, stopwatch). Each fills with correct cards; the legal rung (no hints) unlocks per
  skill at 80 %.
- **Boss runs**: a full generated leg in decision mode then a card of every kind it missed (22 cards), opening at 50 % on every meter; the first Boss shows the chart on the card, later ones keep it behind a Chart button; then a full day in Desk mode.
- Dad's card and the reference stay one tap away.

## Mobile shell
- Portrait 360 to 430 px wide: a top strip (skill, streak, card n of N), the card in the middle, the action zone
  in the bottom third with 1 to 4 buttons of at least 56 px height, or the tap-stopwatch face.
- The tap-stopwatch is the handbook's digital lap/split watch: big digits, left half START/STOP, right half LAP,
  a TOD strip; in a pause card the whole face is the GO button.
- Landscape phone: a mini cockpit (watch large, book row, driver line).
- PWA: manifest (any orientation, so the installed app reaches the landscape cockpit), icons, service worker caching the app shell and content for offline play, "Add to Home Screen"
  hint once; state in localStorage (progress, streak, settings) as today.
- Haptics via navigator.vibrate on verdicts; speech via speechSynthesis for the driver's lines when enabled.

## Validation targets (agent playtest on a 390 x 844 viewport)
- First decision within 20 s of opening the app for a new player.
- Median gap between decisions under 15 s; at least four decisions per minute.
- Words on screen before the first tap of a card: under 40 (rule cards under 60).
- A run finishes in under 5 minutes of wall time at 1x.
- Every button reachable with one thumb (bottom 40 % of the screen) and at least 56 px tall.
- Installable PWA (manifest valid, service worker registered), runs offline after one load.
- No horizontal scroll, no text under 16 px, no page errors.

## Fix sprint PT-13 (2026-10-23)
A player who follows the rule cards is never marked wrong (MOB-050..061 in SPECS.md): the pause card prints the number it grades, the TA
grader is RULE-033, timed cards show the sign arriving (a distance bar and Dad's "Mark!"), at most two cards of a kind per run with a
fixed "Card n of N", verdicts cite the sentence that decided them, the Boss covers every kind, no card has a fixed answer, restart numbers
vary (base + position too), Continue is the primary button while a run is unfinished, and a screen stays under 40 words (rule cards 60)
with the chips behind "details".

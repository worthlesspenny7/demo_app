/**
 * MOB-010: the rule cards of Phase VIII. One card is one rule with the one number the player must apply, in at most 60 words, with its source.
 * The long lessons (content/lessons.ts) moved to the Reference page under "Long form"; these cards are what the School, the Scheduler (MOB-005) and
 * "Dad reads this" (MOB-011) show. Pure data, no DOM, so tests can check the words and the sources.
 *
 * Sources are exact: a REG rule number (docs/research/09-event-regulations-2026.md), a Rookie Handbook page (08, 08b) or a video with its caption
 * timestamp [mm:ss] (10, 10a, 10b, 10c; the captions were read, not watched, so a timestamp is good to about 30 seconds). A claim that only a video
 * makes carries `videoOnly` and is labelled "(video, not in the documents)", like LESSON-008. A card that rests on the simulator's own car model or
 * on a house habit carries `sim` and is labelled "(simulator convention)": the Ford numbers are a simulator default, measure your car.
 */

/** The five skills of the skill meters (MOBILE.md, MOB-006). The first two cover the first and third S of the Four S's, the third the fourth S. */
export const RULE_SKILLS = ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'] as const;
export type RuleSkill = (typeof RULE_SKILLS)[number];

/** The decision kinds of MOB-002, in the order the spec lists them. A rule card names the kinds it precedes (the Scheduler shows it before the first such decision). */
export const DECISION_KINDS = ['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock', 'watch'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export interface RuleCard {
  id: string;              // 'RULE-001' ...
  skill: RuleSkill;
  title: string;           // at most 6 words
  text: string;            // at most 60 words, plain, one rule
  source: string;          // REG rule / HB page / video [mm:ss]
  kinds: DecisionKind[];   // the decision kinds this card precedes
  /** the long lesson (content/lessons.ts id) that explains it, for the "Long form" link */
  lesson?: string;
  /** the rule rests on a video alone: the card says "(video, not in the documents)" */
  videoOnly?: boolean;
  /** the card carries a simulator convention (car model numbers, house habit): the card says "(simulator convention)" */
  sim?: boolean;
}

export const VIDEO_LABEL = '(video, not in the documents)';
export const SIM_LABEL = '(simulator convention)';

/** The source line as the School prints it, with the video and simulator labels. */
export function sourceLine(c: Pick<RuleCard, 'source' | 'videoOnly' | 'sim'>): string {
  return `${c.source}${c.videoOnly ? ` ${VIDEO_LABEL}` : ''}${c.sim ? ` ${SIM_LABEL}` : ''}`;
}

export const RULE_TITLE_MAX_WORDS = 6;
export const RULE_TEXT_MAX_WORDS = 60;
export const words = (s: string): number => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);

export const SKILL_GROUPS: { skill: RuleSkill; title: string; fourS: string }[] = [
  { skill: 'safetyCourse', title: 'Safety and course', fourS: "Four S's 1 and 3" },
  { skill: 'startOnTime', title: 'Start on time', fourS: "Four S's 2" },
  { skill: 'stayOnTime', title: 'Stay on time', fourS: "Four S's 4" },
  { skill: 'recovery', title: 'Recovery', fourS: 'Make up, claim, lost' },
  { skill: 'instruments', title: 'Clock and stopwatch', fourS: 'Instruments' },
];

export const RULES: RuleCard[] = [
  // ---------------------------------------------------------------- Safety and course (Four S's 1 and 3)
  {
    id: 'RULE-001', skill: 'safetyCourse', title: "Safety, start, course, time", lesson: 'four-s', kinds: ['hazard', 'makeup', 'lost'],
    text: "The Four S's are a priority list: Safety first, Start on time, Stay on course, Stay on time. When two clash, the earlier one wins. A wrong turn costs minutes and a late stop costs seconds, so never speed to catch up.",
    source: "HB p.13-14",
  },
  {
    id: 'RULE-002', skill: 'safetyCourse', title: 'Full stop at every STOP', lesson: 'four-s', kinds: ['pause', 'turn'],
    text: "Come to a full stop at every STOP sign, including one with no pause printed in the book. Failure to stop at a STOP sign is a DNF. A rolling stop is not a stop.",
    source: "REG V.E.3.e",
  },
  {
    id: 'RULE-003', skill: 'safetyCourse', title: 'Green: do nothing. Red: stop.', lesson: 'rally-school', kinds: ['checkpoint'],
    text: "A green sign is a timing checkpoint: the minimum you need to do at a green sign is nothing. A red GREAT RACE STOP board is an observation checkpoint: stop and talk to the worker.",
    source: "REG V.A.1.a, V.A.1.b; Rally School Part 1 [04:08], [02:37]",
  },
  {
    id: 'RULE-004', skill: 'safetyCourse', title: 'Never 5 mph near green', lesson: 'rally-school', kinds: ['checkpoint', 'lost'],
    text: "Never stop, and never drive 5 mph or slower, within sight of a green timing checkpoint sign. The penalty is 30 seconds. If you must pull off to work out where you are, do it out of sight of one.",
    source: "REG V.E.3.a, V.A.1.a(3); Rally School Part 2 [35:33]",
  },
  {
    id: 'RULE-005', skill: 'safetyCourse', title: 'Posted limits: obey, then recover', lesson: 'recovery', kinds: ['speedChange', 'makeup', 'hazard'],
    text: "Never drive above a posted limit to make up time: dangerous driving, which may include speeding, is disqualification. Where a posted limit is below your assigned speed, hold the limit; the course leaves room to recover the lost time before the next timing checkpoint.",
    source: "HB p.1; REG V.F.1.c, VII.E.1.c",
  },
  {
    id: 'RULE-006', skill: 'safetyCourse', title: 'This line and the next', lesson: 'markup', kinds: ['preread', 'turn'],
    text: "Always work the current instruction and the next one, especially when Column D says comes quick. In the pre-read, highlight every comes quick; if one is at the top of a page, note it at the bottom of the page before.",
    source: "HB p.13, p.15 tip 8",
  },
  {
    id: 'RULE-007', skill: 'safetyCourse', title: 'Carry the speed to next page', lesson: 'markup', kinds: ['preread'],
    text: "Copy the speed at the bottom of each page to the top of the next. Write a speed on every row that shows none: a row without a speed continues the previous average speed.",
    source: "HB p.15 tip 8; HB Appendix D (railroad crossing)",
  },
  {
    id: 'RULE-008', skill: 'safetyCourse', title: 'Driver reads back every call', lesson: 'protocol', kinds: ['turn', 'speedChange', 'preread'],
    text: "The driver repeats every turn and every speed he hears: Right, 35. After several lefts it is easy to hear left for right. Every few minutes the driver also says holding 35, and the navigator confirms.",
    source: "HB p.15 tip 4; holding 35: 2026 Training Session [10:53] (video)",
  },
  {
    id: 'RULE-009', skill: 'safetyCourse', title: 'ICE: identify, confirm, execute', lesson: 'protocol', kinds: ['turn', 'speedChange', 'preread'], videoOnly: true,
    text: "The navigator names the sign to look for: identify. Whoever sees it first says I see it, the other says I see it too: confirm. Only then does the navigator say what to do at that sign: execute.",
    source: "Rally School Part 2 [15:45]; 2026 Training Session [10:53]",
  },

  // ---------------------------------------------------------------- Start on time (Four S's 2)
  {
    id: 'RULE-010', skill: 'startOnTime', title: 'Start = base + position', lesson: 'transits', kinds: ['restart'],
    text: "A time-of-day restart is the printed base time plus your starting position in minutes. Position 1 leaves at base plus 1 minute. Base 9:05:00 and position 27 is 9:32:00. Your position is not your car number.",
    source: "REG VII.B.2.a; position 1 = base + 1: Starting on Time [01:07], 2026 Training Session [53:47] (video)",
  },
  {
    id: 'RULE-011', skill: 'startOnTime', title: 'Launch early by the start loss', lesson: 'transits', kinds: ['restart'],
    text: "Launch at your time minus the car's standing-start loss: 9:32:00 minus 3 s is 9:31:57. About 30 seconds before, warn the driver, then count so the last count lands on the launch second.",
    source: "HB p.7; Starting on Time [03:41], [04:12] (video)",
  },
  {
    id: 'RULE-012', skill: 'startOnTime', title: 'Nobody releases you', lesson: 'transits', kinds: ['restart'],
    text: "No official, flag or crew tells you when to go. After a time-of-day restart it is assumed you left on time. Leaving on the wrong minute takes a lot of make up to get back on time, if you even notice.",
    source: "HB p.13; Rally School Part 2 [14:10]",
  },
  {
    id: 'RULE-013', skill: 'startOnTime', title: 'Pull up when car ahead leaves', lesson: 'transits', kinds: ['restart'],
    text: "Wait back among the cars. Pull up to the start sign only after the car ahead has left on its own minute, never a minute early. If the car ahead just sits there, go around it and leave on your own minute.",
    source: "HB p.15 tip 6; Rally School Part 2 [12:36], [14:10]; going around: Rally School Part 1 [44:27] (video)",
  },
  {
    id: 'RULE-014', skill: 'startOnTime', title: 'Exact transit: IN plus interval', lesson: 'transits', kinds: ['transitOut'],
    text: "For an exact transit (take exactly 20 minutes), write the time of day at the IN sign and add the interval: IN 2:41:20 plus 20m00s is OUT 3:01:20. Arrive early, pull up to the sign, and leave exactly on the OUT second.",
    source: "HB p.11-12; 2026 Example Rally #31",
  },
  {
    id: 'RULE-015', skill: 'startOnTime', title: 'Lunch is inside the transit', lesson: 'transits', kinds: ['transitOut', 'restart'],
    text: "Lunch says leave 45 minutes prior to your end-of-transit time. The end of the transit is the restart time plus your position: 2:55:00 plus 12 minutes is 3:07:00. Leave lunch at 3:07:00 minus 0:45:00, which is 2:22:00.",
    source: "HB Appendix D (Example Rally #21)",
  },

  // ---------------------------------------------------------------- Stay on time (Four S's 4)
  {
    id: 'RULE-016', skill: 'stayOnTime', title: 'Pause = chart cell, not 15', lesson: 'pause-arithmetic', kinds: ['pause'], sim: true,
    text: "Wait the chart time, not the printed pause: dwell = pause minus Dec(in) minus Acc(out), the stop-and-go loss for your two speeds. The handbook's Packard chart gives 8.6 s for 30 in, 40 out. Dec and Acc are the simulator's performance card; measure your car.",
    source: "HB p.8; Rally School Part 2 [22:02]",
  },
  {
    id: 'RULE-017', skill: 'stayOnTime', title: 'Round the chart pause', lesson: 'pause-arithmetic', kinds: ['pause'], videoOnly: true,
    text: "You cannot count tenths of a second aloud. Round the chart pause to the nearest whole second: 8.6 becomes 9, 7.4 becomes 7. Then use the same rhythm at every stop.",
    source: "Rally School Part 2 [22:02]",
  },
  {
    id: 'RULE-018', skill: 'stayOnTime', title: 'Count from the rock-back; say GO', lesson: 'protocol', kinds: ['pause'],
    text: "Start the stopwatch when the car rocks back to a stop. Count to the chart pause and always end the count with the word GO: the driver may forget when to move, so GO is the only signal to move.",
    source: "HB Appendix B step 2; Rally School Part 2 [19:57]",
  },
  {
    id: 'RULE-019', skill: 'stayOnTime', title: 'Split the change at the sign', lesson: 'timed-leads', kinds: ['speedChange'],
    text: "Cross the sign at the midpoint speed and keep changing: 35 to 30 means 32.5 mph as the bumper passes the sign. The gain before the sign and the loss after it cancel. The change counts when the front tires come even with the sign.",
    source: "HB p.12; REG VII.E.2.b",
  },
  {
    id: 'RULE-020', skill: 'stayOnTime', title: 'Lead = half the ramp', lesson: 'timed-leads', kinds: ['speedChange', 'timedStart'], sim: true,
    text: "Start the new speed half a ramp early so the ramp straddles the sign. If the car needs 4.6 s to go from 30 to 40 mph (simulator Ford, measure yours), call it 2.3 s early. For a timed hold, call about 2 s early.",
    source: "HB p.12; timed hold: 2026 Training Session [120:16] (video)",
  },
  {
    id: 'RULE-021', skill: 'stayOnTime', title: 'Timed changes count from departure', lesson: 'timed-leads', kinds: ['timedStart', 'watch'], sim: true,
    text: "A timed segment such as 30 for 0m36s counts from where the ghost leaves the landmark: your arrival plus any pause, not your own go. Lap the watch as the car leaves, then call the next speed half a ramp early.",
    source: "REG VII.E.2.d",
  },
  {
    id: 'RULE-022', skill: 'stayOnTime', title: 'The driver says mark', lesson: 'protocol', kinds: ['speedChange', 'timedStart'], videoOnly: true,
    text: "The driver says mark when the two posts of the sign line up. The navigator starts the stopwatch or takes the split on that word, so the whole team uses one instant instead of a guess.",
    source: "2026 Training Session [80:03]",
  },
  {
    id: 'RULE-023', skill: 'stayOnTime', title: 'Caps: 2 min late, 5 early', lesson: 'four-s', kinds: ['checkpoint', 'makeup'],
    text: "Each second early or late at a timing checkpoint is 1 point. The late penalty stops at 2 minutes and the early penalty at 5 minutes. A missed timing checkpoint costs 3 minutes.",
    source: "REG V.E.1, V.E.2.a",
  },
  {
    id: 'RULE-024', skill: 'stayOnTime', title: 'Turn: take the chart loss', lesson: 'pause-arithmetic', kinds: ['turn'],
    text: "Slow to the apex speed, turn, accelerate to the assigned speed, then make up the chart loss with the 10 % rule as soon as it is safe. On the handbook's Packard chart, approach 40 and exit 35 loses 4.0 s.",
    source: "HB p.9, p.11-12",
  },

  // ---------------------------------------------------------------- Recovery (make up, claim, lost)
  {
    id: 'RULE-025', skill: 'recovery', title: '10 %: over for ten times', lesson: 'recovery', kinds: ['makeup'],
    text: "To make up S seconds, drive 10 % above the assigned speed for 10 times S seconds. Late 4.4 s at 40 mph: drive 44 mph for 44 seconds. It gains 6 seconds per minute. Then return to the assigned speed.",
    source: "HB p.10; Making Up Time [01:03]",
  },
  {
    id: 'RULE-026', skill: 'recovery', title: '20 %: over for five times', lesson: 'recovery', kinds: ['makeup'], videoOnly: true,
    text: "When the delay is a big chunk, drive 20 % above the assigned speed for 5 times the seconds owed. Late 8 s at 40 mph: 48 mph for 40 seconds. It gains 12 seconds per minute. Never go above the posted limit.",
    source: "Making Up Time [03:08]; REG V.F.1.c",
  },
  {
    id: 'RULE-027', skill: 'recovery', title: 'No make-up inside a timed interval', lesson: 'recovery', kinds: ['makeup', 'timedStart'], videoOnly: true,
    text: "While an interval is running on the stopwatch (30 for 7 minutes), hold the assigned speed. Speeding up inside it ruins the count you are keeping. Make the time up before or after the interval.",
    source: "Making Up Time [05:11]",
  },
  {
    id: 'RULE-028', skill: 'recovery', title: 'Drop the extra at next sign', lesson: 'recovery', kinds: ['makeup', 'speedChange'], videoOnly: true,
    text: "At the next speed-change sign drop your extra speed and settle at the new assigned speed. Work out how much you made up, then take 10 % of the new speed. From 40 to 35: back to 35, then 38.5.",
    source: "Making Up Time [03:39]",
  },
  {
    id: 'RULE-029', skill: 'recovery', title: 'Shorten a stop to gain time', lesson: 'recovery', kinds: ['makeup', 'pause'], videoOnly: true,
    text: "A stop is a place to recover: leave after 1 second of a 10 second pause and you gain 9. You must still come to a full stop at a STOP sign. Veterans avoid shortening a stop where a checkpoint could be in sight.",
    source: "Making Up Time [04:41]; REG V.E.3.e",
  },
  {
    id: 'RULE-030', skill: 'recovery', title: 'A checkpoint resets you', lesson: 'four-s', kinds: ['makeup', 'checkpoint', 'lost'],
    text: "You are automatically on time the instant you reach a checkpoint. The leg ends with whatever error it had and the next leg starts clean. Do not carry a loss across a checkpoint or keep making it up after it.",
    source: "HB p.13; Rally School Part 1 [15:59]",
  },
  {
    id: 'RULE-031', skill: 'recovery', title: 'TA only for outside delays', lesson: 'recovery', kinds: ['hazard', 'ta', 'lost'],
    text: "Ask for a Time Allowance only for a delay beyond your control, such as a train or helping at an accident. Never for a wrong turn, a flat tire or a breakdown. A traffic light is not named: make that time up.",
    source: "REG V.H.1; HB p.13",
  },
  {
    id: 'RULE-032', skill: 'recovery', title: 'TA: 10 s steps, 15 minutes', lesson: 'recovery', kinds: ['ta'],
    text: "Request time in multiples of 10 seconds, within the time the book gives (15 minutes in the 2026 example). Claim only what you could not make up: the committee denies time you could have made up. An odd amount is rounded, possibly against you.",
    source: "REG V.H.3, V.H.5, V.H.6; 2026 Example Rally #18",
  },
  {
    id: 'RULE-033', skill: 'recovery', title: 'Measured delay = stopped + loss', lesson: 'recovery', kinds: ['ta'], videoOnly: true,
    text: "The delay is the time stood still, wheels stopped to go, plus your chart's stop-and-go loss. Take off what you can make up, claim the rest rounded down to 10 s steps, make up the odd seconds: delayed 3m47s, make up 7 s, claim 3m40s.",
    source: "Time Delay Form [01:38], [02:10], [04:44]; REG V.H.5, V.H.6",
  },
  {
    id: 'RULE-034', skill: 'recovery', title: 'Lost: turn around, time, double', lesson: 'lost', kinds: ['lost'], videoOnly: true,
    text: "When you know you missed a turn, turn around where it is safe and start the stopwatch, unless a shorter way back is in sight. The trip back to the junction is half the time you lost: 47 seconds back means about 94 lost.",
    source: "2026 Training Session [94:27]; 2024 Training Session [120:16]",
  },
  {
    id: 'RULE-035', skill: 'recovery', title: 'Rejoin 30 s behind a car', lesson: 'lost', kinds: ['lost'], videoOnly: true,
    text: "Rejoin the route about 30 seconds behind a car you know is on course. Write the leg off: the next checkpoint resets you. A wrong turn is never a Time Allowance, and speeding to catch up is never worth it.",
    source: "2024 Training Session [119:15], [121:18]; 2026 Training Session [115:37]",
  },
  {
    id: 'RULE-036', skill: 'recovery', title: 'The car behind is your clock', lesson: 'lost', kinds: ['lost'], videoOnly: true,
    text: "Pull over where it is safe: the car a minute behind you in the order of start either shows up or you are off course. If the car due ten minutes behind you is already ahead, you are over ten minutes late.",
    source: "2024 Training Session [119:15], [121:49]; 2026 Training Session [125:28]",
  },

  // ---------------------------------------------------------------- Clock and stopwatch (instruments)
  {
    id: 'RULE-037', skill: 'instruments', title: 'The minute hand is loose', lesson: 'which-timer', kinds: ['clock', 'restart'], videoOnly: true,
    text: "The dash clock's second hand is consistent, its minute hand is loose. With the second hand at about 55 or 56 the minute hand has already moved on and it is easy to read the wrong minute. That is a 60 second error.",
    source: "Clock and Stopwatch [00:37], [01:39]",
  },
  {
    id: 'RULE-038', skill: 'instruments', title: 'Read the minute off the watch', lesson: 'which-timer', kinds: ['clock', 'restart'],
    text: "Take the hour and minute from the stopwatch in time-of-day mode. Use the clock only for its second hand, counting the second in: 56, 57, 58, 59, mark. Then switch the watch back to chrono.",
    source: "REG II.H.1.d(3); Clock and Stopwatch [01:08]; 2026 Training Session [101:15] (video)",
  },
  {
    id: 'RULE-039', skill: 'instruments', title: 'Stopwatch for intervals, clock for time', lesson: 'which-timer', kinds: ['clock', 'watch', 'pause', 'timedStart', 'transitOut'],
    text: "The stopwatch measures how long something takes: pauses, timed changes, calibration laps, make-up counts. The clock or watch gives the time of day: restarts, exact transits, the TA deadline. Never time an interval off the clock's second hand.",
    source: "HB p.5; Clock and Stopwatch [01:39] (video)",
  },
  {
    id: 'RULE-040', skill: 'instruments', title: 'Sync clock and watch at pickup', lesson: 'which-timer', kinds: ['clock', 'restart'],
    text: "At instruction pickup, 30 minutes before your start, check your clock and stopwatch against the officials' digital clock, which is set to WWV: trust but verify. Use the time zone of the stage start all day.",
    source: "REG V.C.1.b, V.C.1.c, VII.B.2.a; HB p.13; Rally School Part 2 [02:05]",
  },
  // ---------------------------------------------------------------- added by the PT-13 fix sprint (MOB-054, MOB-056)
  {
    id: 'RULE-041', skill: 'safetyCourse', title: 'Follow the bold CAMEO arrow', lesson: 'markup', kinds: ['preread', 'turn'],
    text: "The CAMEO in Column A is the junction seen from above: the dot at the bottom is you, the bold arrow is the route and thin lines are the other roads. Call the turn the bold arrow takes.",
    source: "HB Appendix D (Column A)",
  },
  {
    id: 'RULE-042', skill: 'safetyCourse', title: 'Column C prints the speed', lesson: 'markup', kinds: ['preread'],
    text: "Column C prints the speed to drive from that line on, one item per line: 40 MPH. A pause row reads 0 MPH, the pause, then the speed to leave at: 0 MPH, 0m15s, 45 MPH.",
    source: "HB Appendix D (Column C)",
  },
  {
    id: 'RULE-043', skill: 'recovery', title: 'Rejoin ahead when it is closer', lesson: 'lost', kinds: ['lost'], sim: true,
    text: "Turning around costs twice the time since you left the route plus about 20 s to turn. If your road meets the route again and that detour costs less, keep going and rejoin it. A wrong turn is never a Time Allowance.",
    source: "2026 Training Session [94:27] (the way back is half the loss); REG V.H.1",
  },
];

export const ruleById = (id: string): RuleCard | undefined => RULES.find(r => r.id === id);
export const rulesForSkill = (skill: RuleSkill): RuleCard[] => RULES.filter(r => r.skill === skill);
/** The cards that precede a decision kind, most specific first (fewest kinds), for the Scheduler (MOB-005). */
export const rulesForKind = (kind: DecisionKind): RuleCard[] => RULES.filter(r => r.kinds.includes(kind)).sort((a, b) => a.kinds.length - b.kinds.length || a.id.localeCompare(b.id));

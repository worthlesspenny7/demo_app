/** School lessons: short readings, one check question each. Sources are the research docs under docs/research/. Numbers that come from the car are computed from FORD_1939 so lessons, Reference and cockpit never disagree. */
import { FORD_1939 } from '../src/core/course.js';
import { stopLoss, rampLead } from '../src/core/perf-table.js';

const r1 = (x: number): number => Math.round(x * 10) / 10;
const LOSS_35_35 = r1(stopLoss(35, 35, FORD_1939));
const LOSS_40_30 = r1(stopLoss(40, 30, FORD_1939));
const LEAD_30_40 = r1(rampLead(30, 40, FORD_1939));
const RAMP_30_40 = r1(LEAD_30_40 * 2);
const fmt1 = (x: number): string => x.toFixed(1);
/** Timewise worked example, HB Appendix C: correct 28m43.2s vs actual 28m47.3s at factor 4315. */
const CAL_CORRECT = 28 * 60 + 43.2, CAL_ACTUAL = 28 * 60 + 47.3, CAL_FACTOR = 4315;
const CAL_NEW_FACTOR = Math.round(CAL_FACTOR * CAL_CORRECT / CAL_ACTUAL);
const CAL_CLICKS = Math.round(CAL_FACTOR / 3600 * 10) / 10 * (2 * (CAL_ACTUAL - CAL_CORRECT)); // 1.2 clicks per s/h x 8.2 s/h = 9.84

/** Calibration-run laps, worked example (Example Rally #5-#10 box values; the lap readings are an illustrative run that finishes 4.3 s late). */
const CAL_BOX_CUM = [109.3, 441.3, 962.0, 1517.8];            // 1m49.3s, 7m21.3s, 16m02.0s, 25m17.8s printed in the boxes
const CAL_LAPS = [110.1, 443.0, 965.3, 1522.1];               // 1m50.1s, 7m23.0s, 16m05.3s, 25m22.1s read off the stopwatch
const mmss = (x: number): string => `${Math.floor(x / 60)}m${(x % 60).toFixed(1).padStart(4, '0')}s`;
const LAP_ERR = CAL_LAPS[3]! - CAL_BOX_CUM[3]!;                // 4.3 s late at the last point
const LAP_SPH = LAP_ERR * 3600 / CAL_BOX_CUM[3]!;              // seconds per hour
const LAP_NEW = Math.round(CAL_FACTOR * CAL_BOX_CUM[3]! / CAL_LAPS[3]!);

/** A lesson paragraph is plain text, or a richer block: a bulleted/numbered list, preformatted lines (call patterns, worked examples), a table or a printable card. */
export type LessonBlock = string | { list: string[]; ordered?: boolean } | { pre: string[]; caption?: string } | { table: { head: string[]; rows: string[][] }; caption?: string } | { card: { title: string; lines: string[] } };
export interface Lesson { id: string; title: string; minutes: number; body: LessonBlock[]; check: { question: string; options: string[]; answer: number; explain: string }; source: string }

/** Every word of a lesson (body, blocks, check and source) as one string: used by tests and search. */
export function lessonText(l: Lesson): string {
  const parts: string[] = [l.title];
  for (const b of l.body) {
    if (typeof b === 'string') parts.push(b);
    else if ('list' in b) parts.push(...b.list);
    else if ('pre' in b) parts.push(...(b.caption ? [b.caption] : []), ...b.pre);
    else if ('table' in b) parts.push(...(b.caption ? [b.caption] : []), ...b.table.head, ...b.table.rows.flat());
    else parts.push(b.card.title, ...b.card.lines);
  }
  parts.push(l.check.question, ...l.check.options, l.check.explain, l.source);
  return parts.join('\n');
}
/** The first plain paragraph, for card teasers. */
export function lessonIntro(l: Lesson): string { const b = l.body.find((x): x is string => typeof x === 'string'); return b ?? l.title; }

export const LESSONS: Lesson[] = [
  {
    id: 'ghost-car', title: 'The ghost car', minutes: 3, source: 'docs/research/07 §1, §4; DESIGN §4',
    body: [
      'The Great Race gives you no distances and no odometer. Every instruction is a landmark, an action and a speed: "Right at STOP. Pause 15. Speed 35." Hidden somewhere on the leg is a timing checkpoint, and you are scored one point for every second you cross it early or late.',
      'The rallymaster computes the perfect time with a ghost car: it drives exactly the assigned speeds, changes speed instantly at each landmark, and spends exactly the printed pause at every Pause. Your real car cannot change speed instantly: it loses time at every stop and every speed-up (the handbook\'s chart (a) books a net time loss for every speed change, deceleration included: 50 to 30 mph loses 1.4 s, 40 to 15 mph also 1.4 s), so you plan stops and ramps instead of changing speed at the sign.',
      'A checkpoint resets the clock: the next leg is timed from your actual crossing, not the ghost\'s. Errors do not compound, which is why champions can average about one second per leg over a nine-day event.',
    ],
    check: { question: 'The ghost car arrives at a STOP with "Pause 15". How long does the ghost spend there?', options: ['Nothing: the ghost never stops', 'Exactly 15 seconds, then it is instantly back at speed', '15 seconds plus the braking and acceleration time'], answer: 1, explain: 'The ghost spends the printed pause and nothing else. Your car also loses braking and acceleration time, which you must subtract from your dwell.' },
  },
  {
    id: 'four-s', title: "The Four S's", minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §6 (HB p.13-14); docs/research/09-event-regulations-2026.md §7.3, §13, §14 (REG V.C.1.b, V.E, V.H)',
    body: [
      'The Rookie Handbook (HB p.13-14) boils the whole event down to four S\'s, and the order is the priority: Safety first, Start on time, Stay on course, Stay on time. When two of them pull against each other, the one earlier in the list wins.',
      '1. Safety first. Signal your intentions, do not pass blind, and never run a stop sign or a signal: reckless driving, running stop signs or signals, or a ticket means a penalty or disqualification for the day. Failure to stop at a STOP sign is a DNF (REG V.E.3.e). If you lose a lot of time, file a time allowance instead of chasing it.',
      '2. Start on time. Nobody tells you when to start. After a time-of-day restart it is assumed you left on time. There are two parts: your clock must be synchronised to the officials\' WWV radio clock when you pick up the instructions (the officials\' master clock is a digital clock set to WWV at the start location each day, REG V.C.1.b; your own clock must be analog, REG II.H.1.d(1)), and you must actually leave at the indicated time. Leave on the wrong minute and it "will take a lot of make up to get back on time, assuming you even recognize that you left on the wrong time."',
      '3. Stay on course. This is "much more important than trying to maintain perfect times". A wrong or missed turn usually costs several minutes. Always work the current instruction and the next one, especially with "comes quick" in Column D, and if you do not know the next instruction, stop and read it (REG VII.B.3.b). The navigator always tells the driver the next sign or intersection to look for, because the navigator\'s head is down.',
      '4. Stay on time. Execute every stop and turn the same way each time, per your charts, and make up the losses before the checkpoint. But "the errors associated with stops and turns are usually in seconds and not minutes. So for rookies, concentrate on the first 3 S\'s where the errors are usually in minutes."',
      'One more rule from the same page: "Do not continue to make up time after passing a checkpoint. You are automatically on time the instant you reach a checkpoint." At a checkpoint the previous leg is complete with whatever errors were incurred, and the next leg begins with no penalty. Stop chasing seconds the moment you cross.',
      'Time allowances (TA), in plain words (REG V.H):',
      { list: [
        'What qualifies: a delay on the route that is beyond your control or unsafe, such as a train blocking the route or stopping to help at an accident (V.H.1; HB p.13). Emergency reduced speeds in fog, bad weather or on a grade with two-wheel brakes are also requested this way (V.H.2).',
        'What never does: mechanical failure (a flat tire), not being able to hold the assigned speed, personal failure, and, in the handbook\'s words, navigation errors and wrong turns.',
        'The amount is in multiples of 10 s (0m10s, 0m20s, 4m50s), at most 29m30s. A request that is not a multiple of 10 s is rounded up or down, "to the possible detriment of the contestant" (V.H.3, V.H.6).',
        'You submit it by the method printed in the day\'s instructions (a web page, a phone call, or at the Observation Checkpoint), at the TA point printed in the book, within 15 minutes when the instruction says so (the 2026 Example Rally #18 prints "Within 15m00s"; V.H.3 names the cellular telephone and the Great Race Scoring Crew). Give the Stage, your car number, the leg number, the instruction numbers where the delay happened, and a short description. A wrong car number is not allowed; a wrong leg number is usually not corrected.',
        'You are expected to make up what you can. The committee "will deny time allowances where in their judgment the team could have made up the lost time" (V.H.5), so say what you made up and list witnesses, especially for delays over 1m00s.',
        'The wording pattern: "Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s." Delay, minus what you made up, equals the request.',
      ] },
      'The real penalties (REG V.E), so you know what each S is worth:',
      { table: { head: ['Event', 'Penalty'], rows: [
        ['Each second early or late at a timing checkpoint', '1 s per second'],
        ['Late cap / early cap', '2 min late, 5 min early'],
        ['Missed timing checkpoint', '3 min'],
        ['More than 30 min after the computed cumulative perfect time', 'scored as a missed checkpoint (3 min)'],
        ['Stopping or doing 5 MPH or less within sight of a timing checkpoint', '30 s'],
        ['Failure to stop at a STOP sign', 'DNF'],
      ] } },
      'Read the table with the priorities in mind: a missed checkpoint costs 180 s, ten wrong seconds on a stop costs ten. That is why the first three S\'s come first.',
    ],
    check: { question: 'A farm tractor held you 0m45s. You made up 0m25s before the checkpoint. What do you request?', options: ['0m45s: the whole delay', 'Request 0m20s', 'Request 0m25s', 'Nothing: tractors never qualify'], answer: 1, explain: 'Delayed 0m45s, made up 0m25s: request 0m20s, a multiple of 10 s. The committee denies time you could have made up, so request only what you could not recover.' },
  },
  {
    id: 'which-timer', title: 'Which timer, when', minutes: 4, source: 'docs/research/08-rookie-handbook-body.md §2, §5, §6, §8 (HB p.5, p.11-13); docs/research/09-event-regulations-2026.md §7.3, §8.5, §14 (REG V.C.1.b, VII.F, V.H.3)',
    body: [
      'You carry two timers and they do different jobs (HB p.5). The analog dash clock tells you what time of day it is. The digital stopwatch, with its lap/split and time-of-day functions, measures how long something takes. Most mistakes come from using one for the other\'s job.',
      'The clock, synced to the WWV clock when the instructions are picked up (REG V.C.1.b), is the only source for time of day: starts and restarts (the printed base time plus your assigned start position), the IN and OUT times of an exact transit, and the 15-minute Time Allowance window.',
      'The stopwatch is for every interval: the calibration run (start it at the asterisk sign and lap at every calibration point), timed speed changes (start at the sign, hold until the interval), pauses (count from the moment the wheels stop and go at the chart time), and the 10 % make-up count. An exact transit can also be run off the stopwatch if the navigator prefers an interval, but the OUT time is still checked against the clock.',
      'Two things never to do: never read time of day off a running chrono, and never time an interval off the clock\'s second hand. The stopwatch\'s time-of-day mode is a backup, for when the clock fails; the regulations allow it (REG II.H.1.d(3): the stopwatch "may also have split-action, time-of-day, date, and alarm functions"), while the clock itself must be analog with no digital readout (II.H.1.d(1)).',
      { table: { head: ['Situation', 'Device', 'What you write down'], rows: [
        ['Start or restart', 'Clock', 'Restart time = base + ASP, on the restart line'],
        ['Exact transit', 'Clock (or stopwatch interval)', 'IN time and OUT time = IN + interval'],
        ['TA window (15 min)', 'Clock', 'Time you reached the TA point and the deadline'],
        ['Calibration run', 'Stopwatch: start at the asterisk, lap at every point', 'Interval and cumulative for each point, against the box'],
        ['Timed speed change', 'Stopwatch, started at the sign', 'The call time (interval minus the ramp lead)'],
        ['Pause', 'Stopwatch, started when the wheels stop', 'The chart time beside the printed pause'],
        ['10 % make-up count', 'Stopwatch', 'Seconds to hold the higher speed'],
        ['Clock failure', 'Stopwatch time-of-day mode (backup only)', 'The offset to the clock, once it is back'],
      ] }, caption: 'Which timer, when' },
      'Worked example, the calibration run. The book prints a box at each calibration point with the interval over the cumulative official time (REG VII.F.1); the asterisk marks where the stopwatch starts. Lap at each point and compare the cumulative lap with the box, not the intervals, so errors do not stack.',
      { pre: [
        'point      box cumulative   your lap       late',
        ...CAL_BOX_CUM.map((c, i) => `${("#" + [6, 7, 9, 10][i]).padEnd(11)}${mmss(c).padEnd(16)} ${mmss(CAL_LAPS[i]!).padEnd(14)} +${(CAL_LAPS[i]! - c).toFixed(1)} s`),
        `Late ${LAP_ERR.toFixed(1)} s in ${mmss(CAL_BOX_CUM[3]!)}  ->  ${LAP_SPH.toFixed(1)} s per hour`,
        `Timewise factor ${CAL_FACTOR} x ${CAL_BOX_CUM[3]!.toFixed(1)} / ${CAL_LAPS[3]!.toFixed(1)} = ${(CAL_FACTOR * CAL_BOX_CUM[3]! / CAL_LAPS[3]!).toFixed(1)} -> ${LAP_NEW}`,
      ], caption: 'Calibration laps (box values from the Example Rally #6-#10; the laps are an illustration)' },
    ],
    check: { question: 'A timed segment reads "30 MPH / 0m36s / 45 MPH". How do you time the 36 seconds?', options: ['Note the clock\'s second hand at the sign and watch for 36 s later', 'Start the stopwatch at the sign and count the interval on it', 'Read the time of day off the running stopwatch', 'Use the stopwatch\'s time-of-day mode'], answer: 1, explain: 'Intervals belong to the stopwatch, started at the sign. The clock is for time of day only; never time an interval off its second hand, and never read time of day off a running chrono.' },
  },
  {
    id: 'pause-arithmetic', title: 'Pause arithmetic: dwell = pause - loss', minutes: 4, source: 'docs/research/08-rookie-handbook-body.md §3b (HB p.8), §5; docs/research/07 §2.1; CHART-004',
    body: [
      `Stopping from 35 mph and getting back to 35 costs the 1939 Ford about ${fmt1(LOSS_35_35)} seconds compared with the ghost, before you have waited at all. That number is your car's stop/start loss, measured on the performance table and written on your card for each entry/exit speed pair. (A stop that is also a turn loses a little more, because the car must crawl through the turn: the cockpit card and the Debrief both include that.)`,
      `The handbook calls this the Stop & Go chart (HB p.8): the instructions "usually say stop at the sign, pause for 15 seconds, and proceed at the assigned speed", and you replace the 15 s with the chart value for your IN/OUT speed pair. On the Packard example chart, 30 in and 40 out is 8.6 s. For the Ford here, the same arithmetic is dwell = pause - loss: at "STOP. Pause 15" you wait 15 - ${fmt1(LOSS_35_35)} = ${fmt1(15 - LOSS_35_35)} seconds after the wheels stop, then call "go". Wait the whole 15 and you arrive ${fmt1(LOSS_35_35)} seconds late; call go immediately and you are ${fmt1(LOSS_35_35)} seconds early.`,
      'Always check the course instructions carefully: "sometimes the instructed pause time may be different than 15 seconds." Then the chart value is not your answer. The chart loss is 15 minus the chart value (Packard 30 in, 40 out: 15 - 8.6 = 6.4 s); keep the printed pause and subtract that loss. Pause 20 at 30 in, 40 out: 20 - 6.4 = 13.6 s. If traffic holds you past your planned pause, make up the difference.',
      'Start the stopwatch (or set the analog bezel so the sweep hand reaches the index) at the dwell, count down out loud ("3, 2, 1, GO", always ending on GO) and keep the rhythm identical at every stop. A constant bias calibrates out on the card; scatter does not.',
    ],
    check: { question: `Pause 20, entering at 40 and leaving at 30. Your card says the stop/start loss for 40 in / 30 out is ${fmt1(LOSS_40_30)} s. How long do you dwell?`, options: ['20 s', `${fmt1(20 - LOSS_40_30)} s`, `${fmt1(20 + LOSS_40_30)} s`, `${fmt1(LOSS_40_30)} s`], answer: 1, explain: `dwell = pause - loss = 20 - ${fmt1(LOSS_40_30)} = ${fmt1(20 - LOSS_40_30)} s after the driver says "stopped".` },
  },
  {
    id: 'timed-leads', title: 'Timed segments and ramp leads: 34 not 36', minutes: 3, source: 'docs/research/08-rookie-handbook-body.md §5 (HB p.12); docs/research/09 §8.4 (REG VII.E.2); docs/research/07 §2.2, §4',
    body: [
      'A speed change is instant for the ghost and a ramp for your car. The handbook rule is: split the speed change at the sign (HB p.12). Cross the sign at the midpoint speed and keep changing: going from 35 to 30, be at 32.5 as the bumper passes the sign and keep slowing. The gain before the sign and the loss after it cancel. (The regulations put the change when the front tires come even with the sign, VII.E.2.b.)',
      `Half a ramp early is the same thing, seen from the stopwatch. Your car needs time to ramp from 30 to 40 (about ${fmt1(RAMP_30_40)} s on the Ford). To centre the ramp on the instant the ghost changes, start the new speed half a ramp early: ${fmt1(LEAD_30_40)} s here. Being at the midpoint speed at the sign and calling the change ${fmt1(LEAD_30_40)} s early are one idea.`,
      `A timed segment such as "30 for 0:36 then 40" counts from where the previous speed change took effect, or, for a delayed change, from the row's own point (VII.E.2.d); in the sim that is the ghost's departure from the landmark: arrival plus any Pause, not your own "go". After 36 ghost seconds the ghost is at 40. So call 40 at 36 - ${fmt1(LEAD_30_40)} = ${fmt1(36 - LEAD_30_40)} s, not at 36.`,
      'Lap the watch at the landmark (after the pause, when the car leaves), read the lap rather than the sweep (or set the analog bezel to the call time). A call that counts from your own "go" is late by the stop/start time.',
    ],
    check: { question: `A timed segment reads "30 for 0:36 then 40". The ramp lead for 30 to 40 is ${fmt1(LEAD_30_40)} s. When, counted from the ghost's departure, do you call 40?`, options: ['At 36 s', `At ${fmt1(36 - LEAD_30_40)} s`, `At ${fmt1(36 + LEAD_30_40)} s`, 'When the sign appears'], answer: 1, explain: `Split the change at the sign, i.e. call half a ramp early: 36 - ${fmt1(LEAD_30_40)} = ${fmt1(36 - LEAD_30_40)} s after the ghost leaves the landmark.` },
  },
  {
    id: 'recovery', title: 'Early, late and the 10 % rule', minutes: 4, source: 'docs/research/08-rookie-handbook-body.md §4 (HB p.10), §7 tip 7; docs/research/03 §4.3, 07 §6; CHART-004',
    body: [
      'A truck, a long stop or a train makes you late by a known number of seconds: you measured it on the stopwatch. Write it in the ledger (press E in the cockpit). Then recover it as soon as it can be done safely, because you do not know where the next checkpoint is (HB p.15 tip 7), and stop correcting once the ledger reads zero.',
      'The handbook\'s ten per cent rule (HB p.10): drive 10 % above the instructed speed for 10 x the seconds lost. 38.5 mph for 40 s makes up 4 s at 35; 44 mph for 44 s makes up 4.4 s at 40. The same works for losing time: drive 10 % below for 10 x the seconds.',
      'The field variant is 20 % over for 5 times the delay: at 40 mph, 8 s late is 48 mph for 40 s. On the stopwatch both rules are exact, not conservative, so stop when the ledger reads zero: being early costs exactly as much as being late.',
      'The lost-time formula, for driving slower than assigned (HB p.10): (Assigned - Actual) / Assigned x seconds at the reduced speed = seconds lost. 40 assigned, 30 actual, 20 s = (40 - 30) / 40 x 20 = 5 s lost.',
      'In watch terms: holding +d mph recovers E seconds after t = E x v / d seconds. At +5 mph that is t = E x v / 5: 8 s late at 35 mph means 40 mph for 56 s (not 64: the (v/5 + 1) form counts ghost time, which your watch never shows). A delay of the kind V.H.1 names (a train blocking the route, or stopping to help at the scene of an accident) may instead be requested as a Time Allowance, but never both request and make up the same seconds, and only the wait itself is creditable: the stop/start loss of braking and accelerating is not, so recover that part yourself. A traffic light is not named in V.H.1; the simulator can be set to credit one (rules.taForSignals), but the regulations do not promise it.',
    ],
    check: { question: 'You are 4.4 s late at an assigned 40 mph. Using the handbook\'s ten per cent rule, what do you drive?', options: ['44 mph for 44 s', '44 mph for 4.4 s', '40 mph for 44 s', '36 mph for 44 s'], answer: 0, explain: '10 % over 40 is 44 mph, held for 10 x 4.4 = 44 seconds. Then back to 40 and ledger zero. (36 mph for 44 s would lose another 4.4 s.)' },
  },
  {
    id: 'calibration', title: 'The morning calibration run', minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §2 (HB p.3), §5 (HB p.11); docs/research/08b-rookie-handbook-appendices.md §2 (HB Appendix C); docs/research/07 §3; CHART-005',
    body: [
      'Your speedometer lies, and the tires change the lie every day. The handbook (HB p.3): "if your stock speedometer is only off by 1 per cent, your error will be 36 seconds per hour." Most teams, including rookies, score under 10 seconds per hour. Each morning the route book opens with a calibration run: hold an assigned speed between marked landmarks whose perfect cumulative times are printed in Column C. Lap the stopwatch at each mark and compare.',
      'k = sum of perfect splits / sum of your actual splits. If your splits are longer than perfect, the car is slower than the speedometer says, and you must hold a higher indicated speed: indicated = assigned / k. Write the result for 20, 25, 30 ... 50 mph on a cheat card, or set the factor on a Timewise speedometer.',
      'The Timewise rule (HB Appendix C) is the same ratio applied to the factor: new factor = old factor x correct time / actual time. Late (slow) means correct is smaller than actual, so the factor goes down; early (fast) means it goes up. Method #1 needs no calculator: clicks per second-per-hour = factor / 3600 (4315 / 3600 = 1.2).',
      { pre: [
        'Correct 28m43.2s (1723.2 s)   Actual 28m47.3s (1727.3 s)',
        `Late by ${fmt1(CAL_ACTUAL - CAL_CORRECT)} s in about 29 min  ->  x 2 = ${fmt1(2 * (CAL_ACTUAL - CAL_CORRECT))} s per hour`,
        `1.2 clicks per s/h x ${fmt1(2 * (CAL_ACTUAL - CAL_CORRECT))} s/h = ${CAL_CLICKS.toFixed(2)} -> 10 clicks`,
        `Slow, so reduce: ${CAL_FACTOR} - 10 = ${CAL_FACTOR - 10}`,
        `Check: ${CAL_FACTOR} x 1723.2 / 1727.3 = ${(CAL_FACTOR * CAL_CORRECT / CAL_ACTUAL).toFixed(1)} -> ${CAL_NEW_FACTOR}`,
      ], caption: 'Worked example, HB Appendix C: 4.1 s late = 8.2 s/h = 10 clicks, factor 4315 -> 4305' },
      'A one percent speedometer error is nine seconds over a fifteen-minute leg. Calibration dominates the score. The run is at least 15 miles (about 18-20 minutes at 50), so it costs real attention at the start of the day, and you redo it every day because tires and temperature change the lie.',
      'Three cautions. Compare against the cumulative Column C times, not interval sums, so errors do not stack. A single k measured at 50 mph does not extend to 25 mph on a stock mechanical speedometer, whose error grows with speed: build a per-speed card. And a Timewise unit has one factor to set; the cockpit calibration box in D07 sets it.',
    ],
    check: { question: 'Perfect splits sum to 300 s, yours to 306 s at an indicated 50. What indicated speed holds a true 50?', options: ['49.0', '50.0', '51.0', '53.0'], answer: 2, explain: 'k = 300 / 306 = 0.980; indicated = 50 / 0.980 = 51.0. Your splits were long, so the car is slow for the reading: hold more. (On a Timewise the same ratio, correct / actual, scales the factor down.)' },
  },
  {
    id: 'griid-cameo', title: 'The GRIID page and the CAMEO', minutes: 5, source: 'docs/research/09-event-regulations-2026.md §8.1 (REG VII.B.3.c, VII.D); docs/research/08-rookie-handbook-body.md §8 (HB Appendix D); docs/research/01 §2, 04 §2.2',
    body: [
      'A Great Race route page uses the GRIID format (REG VII.B.3.c): five columns. The first is the instruction number. Then A = the CAMEO diagram, B = section symbols, C = speeds and timing, D = additional information.',
      'Column B symbols: tire warm-up, speedometer calibration run, transit (a full hourglass begins it, an empty one ends it, with an odometer-style box giving the approximate miles in tenths), free zone (crossed-out camera begins, camera ends), lunch (knife and fork), refuel (pump), pit stop (cup), rest stop, and the checkered flag at the finish. The two clock-face symbols are not in Column B: the watch face of a time-of-day restart and the crossed-out watch that ends the timed portion sit in Column C with the times (HB p.27, Example #17).',
      'Column C is the one you execute. It also carries the restart watch-face icon (the time zone and time of day, with the speed under it) and the crossed-out watch of "End timed portion". Times of day have colons: 7:30:00 is a start or restart time. Intervals are written 3h15m00s (3 hours 15 minutes) or 0m45s (45 seconds). An interval in parentheses, such as (35m00s), is advisory and not official (VII.B.3.c(4)). An interval without parentheses is not automatically an exact transit: the handbook\'s Example prints 9m00s and 30m00s plain for ordinary transits. Only Column D saying "take exactly" (Example #30, "take exactly 20 minutes") makes it exact: IN + interval = OUT. Any other number is an assigned average speed in mph, like 45 MPH. A pause is stacked "0 MPH / 0m15s / 45 MPH"; a timed segment is "30 MPH / 0m36s / 45 MPH / 1m12s / 50 MPH".',
      'Column D holds the written instruction and remarks. In the regulations Column D "may contain additional information", things such as "Comes quick", "Look sharp", "1st paved road". In the handbook\'s Example Rally it also carries the full sentence ("Turn right onto Buchanan Blvd at a crossroad at a Traffic Light."), but on a real race sheet it may be empty apart from remarks, and then the CAMEO and Column C carry the instruction. The sim shows the example sentences at the lower aid levels and the bare remarks at the race level.',
      'The CAMEO is read from the dot: the dot is the road you arrive on, the arrow is the road you leave on, the bold line between them is the route. Thin lines are roads you do not take. Dashed or omitted lines are driveways, parking lots, unpaved roads and dead ends: they do not count as roads, and the route never enters one without an instruction.',
      'Sign text in a CAMEO is the sign\'s own text; spelling is supposed to be exact, but there are no traps based on spelling, and a referenced sign may be quoted in whole or in part (continuous, the principal part). Simulator convention, not in the documents (the regulations\' glossary has no T or Y, and the handbook only gives "soft right curve"): a T is where your road ends; a Y is a fork where both branches turn less than 90 degrees, approached from the tail; "bear" is a gentle change of heading, "acute" is sharper than 90 degrees, a "jog" is a short offset.',
    ],
    check: { question: 'Column C shows "(35m00s)" next to a transit. What does the parenthesis mean?', options: ['The time is official and you must take exactly 35 minutes', 'It is an advisory time, a guide to reach the next restart on time', 'It is a time of day', 'It is a speed of 35 mph'], answer: 1, explain: 'Interval times in parentheses are advisory, not official (REG VII.B.3.c(4)). Leaving the parentheses off does not make a transit exact: only Column D saying "take exactly" does (Example #30).' },
  },
  {
    id: 'protocol', title: 'Team protocol', minutes: 6, source: 'docs/research/08-rookie-handbook-body.md §7 (HB p.15, driver and navigator tips 1-8), §6 (HB p.13); docs/research/08b-rookie-handbook-appendices.md §1.3 (HB Appendix B step 2); docs/research/03 §1, 04 §4',
    body: [
      'This is the page the navigator teaches the driver from. These are starting rules, not laws: we agree on them before we leave the driveway, run them for a week, and keep what works. Nearly all of them are the handbook\'s own (HB p.15). The point of all of them is the second S, Stay on course: the driver drives and looks for landmarks, the navigator reads the book and holds the stopwatch and clock, and between the two of us nothing gets dropped.',
      'Rule 1: one word for one thing, every time (HB p.15 tip 1). Here is our glossary; the sim\'s driver uses the same words.',
      { table: { head: ['Say', 'It means'], rows: [
        ['crossroad', 'A road crossing ours: it continues on both sides.'],
        ['sideroad', 'A road that joins from one side only. Straight on unless told otherwise.'],
        ['T', 'Our road ends. We must turn left or right.'],
        ['Y', 'A fork where both branches turn less than 90 degrees. The call says bear left or bear right.'],
        ['soft right curve', 'The road itself bends gently right. No turn: stay on the road.'],
        ['soft offset right curve', 'A gentle right bend where the road also shifts sideways a little (a jog). Still no turn.'],
        ['blinker', 'A flashing red or yellow light. It may or may not be working. The book decides whether there is a pause.'],
        ['yield', 'The triangle sign. Slow, give way, stop only if we must. The book decides whether there is a pause.'],
        ['comes quick', 'The next instruction follows almost at once. Driver: eyes up and ready. Navigator: read the next two lines aloud now.'],
      ] }, caption: 'Sign vocabulary glossary (our own team vocabulary: the T, Y and jog definitions are simulator convention, not in the documents)' },
      'Rule 2: the navigator always names the next sign before looking down (HB p.13). The driver can only look for what he has been told to look for. A call has three parts: the sign, the road, the action, then what comes after. We use this pattern at every stop:',
      { pre: [
        'Navigator: "Next: STOP sign, crossroad, turn right, 35 after."',
        'Driver:    "STOP sign, crossroad, right, 35."',
        '           ... the car stops ...',
        'Driver:    "Stopped."',
        'Navigator: (counts the dwell on the stopwatch)  "3, 2, 1, GO."',
        'Driver:    "Going. Right, 35."',
      ], caption: 'The call pattern. The count always ends with GO (HB Appendix B)' },
      'The navigator always ends a countdown with the word GO. The driver often forgets when he should begin the maneuver, so the word GO is always the signal to execute. A count that trails off at "1" is a count that has not finished.',
      { list: [
        'Rule 3: the driver repeats back every turn and every speed he hears (HB p.15 tip 4). After several lefts it is easy to hear "left" for "right". "Right at the stop, got it." "Thirty-five." "Holding thirty-five."',
        'Rule 4: in a timed section only the talk that follows the instructions: calls, read-backs, counts. Scenery and post-mortems wait (tip 3). Silence is how the driver hears the call.',
        'Rule 5: cross off each instruction when it is done (tip 5), with a large transparent marker, especially for identical instructions in a row, so neither of us loses the line. The driver says "done" and the navigator marks it.',
        'Rule 6: never pull up to a restart point before your minute (tip 6). Sit short of it, count to your time, then roll up and leave exactly on it.',
        'Rule 7: make up a loss as soon as it is safe to (tip 7). We do not know where the next checkpoint is. Use the 10 % rule, then back to the assigned speed.',
        'Rule 8: team errors only (tip 2). After a mistake there is no "you missed it". We both make the correction, and we work together on a hard sign or street name.',
        'Rule 9, "comes quick": the driver watches the road; the navigator, head down in the book, reads the next two instructions out loud so the driver knows both signs to look for. The navigator\'s head is down, so the driver is the eyes: he says "got it" for each sign he sees, and "not yet" if he does not.',
        'Rule 10 (simulator convention, not in the documents): if a landmark does not appear when it should, do not keep driving. Stop before the leading edge of the next intersection and work out where we are. A wrong turn is the biggest loss in the game (the handbook says a wrong or missed turn "usually costs several minutes"). If the driver has to ask "left or right?", the call was late: our house habit is to call turns 500-600 ft out, a number from our own research notes, not the handbook or regulations.',
      ] },
      { card: { title: 'Card for the driver (print and keep in the car)', lines: [
        'Eyes on the road. The navigator has the book.',
        'Say back every turn and every speed: "Right, 35."',
        'Say "Stopped" when the wheels stop. Do not move until you hear GO.',
        '"3, 2, 1, GO": GO is the only signal to go.',
        'Look for the sign the navigator named. Say "got it" when you see it, "not yet" if you do not.',
        'In a timed section, talk only about the instructions.',
        '"Comes quick": eyes up, be ready for the next two. Not sure where we are: stop short of the intersection and say so.',
        'Any mistake is ours. Fix it together and move on.',
      ] } },
    ],
    check: { question: 'The navigator counts "3, 2, 1" and then says nothing. What should the driver do, and what should the count have been?', options: ['Go at "1"; the count was fine', 'Wait: the count must end with the word GO, and GO is the only signal to move', 'Go after one second of silence'], answer: 1, explain: 'The navigator always ends a countdown with GO (HB Appendix B). GO is the one word that tells the driver to execute, so the driver does not move without it.' },
  },
  {
    id: 'markup', title: 'Marking up the instructions', minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §7 tip 8 (HB p.15), §3b (HB p.8), §5 (HB p.11-12); docs/research/09-event-regulations-2026.md §7.1, §7.4 (REG VII.B.2.a, V.C); DRILL-024',
    body: [
      'The instructions are handed out about 30 minutes before your start time (REG VII.B.2.a), and notes may be made in that time (HB p.11). Use it. There are six notations, and they all exist to take a decision off your plate at 45 mph.',
      { list: [
        '1. Carry the speed from the bottom of each page to the top of the next, so a page that begins without a speed does not leave you guessing (HB p.15 tip 8).',
        '2. Write every speed not shown on the instructions. A row with no speed in Column C means "continue previous average speed since no speed is given" (the railroad crossing in the Example Rally): write the number beside it.',
        '3. Highlight every "comes quick" and other Column D item.',
        '4. If a "comes quick" is at the top of a page, note it at the bottom of the previous page, where you can see it before you turn over.',
        '5. Write the chart pause time beside every printed pause. A printed "Pause 15" at 30 in and 40 out becomes 8.6 on the Packard Stop & Go chart (HB p.8).',
        '6. Write the times you must compute: the restart time (the printed base time plus your assigned start position) at every restart, and the OUT time (IN time plus the interval) at every exact transit.',
      ], ordered: true },
      { pre: [
        'PAGE 2 of 6 (bottom)',
        ' #12  sign "Wilson Rd"                 30 MPH',
        ' #13  STOP, crossroad, turn left       0 MPH / 0m15s / 40 MPH          [write 8.6: 30 in, 40 out]',
        '       -> next page: #14 COMES QUICK                                   [note 4: written here]',
        '',
        'PAGE 3 of 6 (top)                                                      [note 1: write 40 at the top]',
        ' #14  Turn right at a T                (no speed)    comes quick       [notes 2 and 3: write 40, highlight]',
        ' #15  Pass sign "Mill Rd"              (no speed)                      [note 2: write 40]',
      ], caption: 'A page break, marked up: the speed at the bottom of page 2 is 40 after the pause, and the first lines of page 3 print no speed' },
      'Notation 6 is arithmetic. A restart line says "Leave this point at 8:55:00 plus your assigned start position in minutes." With a start position of 12, write 8:55:00 + 12 min = 9:07:00 on that line. An exact transit says "take exactly 20 minutes": if you pass the IN sign at 10:41:20, write OUT 11:01:20 at the end-of-transit instruction. Your start position is not your car number and it changes every day.',
      'Do the markup before you start, not on the road. The drill D15 grades all six.',
    ],
    check: { question: 'The bottom of page 2 ends "STOP: 0 MPH / 0m15s / 40 MPH". The first row of page 3 prints no speed. What do you write at the top of page 3?', options: ['0 MPH', '15 MPH', '40 MPH', 'Nothing: the page starts fresh'], answer: 2, explain: 'The speed carries over from the bottom of the previous page: after the pause you leave at 40 MPH, so write 40 at the top of page 3 (HB p.15 tip 8).' },
  },
  {
    id: 'transits', title: 'Transits and restarts', minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §5, §6, §8 (HB p.11-14, Appendix D); docs/research/09-event-regulations-2026.md §7.4, §8.1, §13.3 (REG V.B.2, VII.B.3.c(4), VII.C.5, VII.E.1.b, V.E.3.h)',
    body: [
      'A transit is an untimed stretch with no timing checkpoints and no assigned speed; a time for the passage, or a restart time at the end, is given (glossary; REG VII.E.1.b). A full hourglass in Column B begins it and an empty one ends it. Lunch, fuel, pit stops and rest stops all happen inside a transit.',
      'Advisory transit: the time is in parentheses, like (3h25m00s) or (0m30s). It is a guide so you arrive at the next time-of-day restart on time. Nothing times you inside it, but you must still be at the restart at your minute.',
      'Exact transit: when a transit comes after a time-of-day restart, between timed pieces, the handbook says it "is critical ... must be executed exactly." The row says something like "take exactly 20 minutes". Record the exact time of day you pass the IN sign, add the printed interval, and write the result at the end-of-transit instruction: IN + interval = OUT. Example: IN 2:41:20 + 20m00s = OUT 3:01:20. Arrive a few minutes early, pull up to the sign close to the OUT time, and depart exactly then at the assigned speed. Cars are no longer exactly one minute apart after such a transit. Only "take exactly" makes a transit exact: a plain interval such as the calibration run\'s 26m00s or the end-of-stage transit\'s 30m00s (Example #34) is a guide, not a time you must hit (HB p.11; REG VII.B.3.c(4)).',
      'Lunch inside the transit: the book says "After lunch, leave here 45 minutes prior to your end-of-transit time." Work backwards from your own restart time. If the transit ends at a 2:55:00 restart and your start position is 12, your end-of-transit time is 3:07:00 and you leave lunch at 2:22:00. Refuel (for example 3h10m prior), a pit stop (2h10m prior) and a rest stop (3 min prior) work the same way. Leaving a promoted lunch, pit or rest stop more than 5 minutes before the scheduled departure costs 1 minute the first time and 5 minutes the second (REG V.E.3.h).',
      'A time-of-day restart is the base time plus your assigned start position (ASP) in minutes: "Leave this point at 8:55:00 plus your assigned start position in minutes." The ASP is not your car number and it changes daily. In the handbook\'s Trophy Run example the ASP was 42, so a noon start became 12:42, and the instructions were handed out at 12:12. A morning adds up like this: start 8:00:00, tire warm-up 20m00s, calibration 26m00s, transit 9m00s, restart 8:55:00 plus your ASP.',
      'There is a 2-minute free zone after the end of every transit (REG VII.C.5.c): no timing checkpoint will be there, so you can park along the route if the end of the transit is crowded.',
      'The Four S\'s warning applies here more than anywhere. "Start on time" has two parts: the clock set to WWV, and leaving at the indicated time. Leaving on the wrong minute "will take a lot of make up to get back on time, assuming you even recognize that you left on the wrong time." One minute off is 60 seconds at the next checkpoint. Never pull up to a restart before your minute, and never leave one early.',
    ],
    check: { question: 'Lunch says "leave here 45 minutes prior to your end-of-transit time". The transit ends at a 2:55:00 restart plus your start position of 12 minutes. When do you leave lunch?', options: ['2:10:00', '2:22:00', '2:37:00', '3:07:00'], answer: 1, explain: 'End of transit = 2:55:00 + 12 min = 3:07:00. Leave 45 minutes prior: 3:07:00 - 0:45:00 = 2:22:00.' },
  },
];

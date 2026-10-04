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

/**
 * LESSON-008: one claim from the rally school videos. `cite` names the video and its caption timestamp(s) as [mm:ss] (the captions were read, not watched,
 * so a timestamp is good to about 30 s); `doc` is the document that also says it, or undefined for a claim only a video makes, which is labelled so.
 */
export const VIDEO_ONLY = '(video, not in the documents)';
/** The sentence the lesson and the Reference page use to say what the label means. */
export const VIDEO_ONLY_NOTE = 'A claim that only a video makes is labelled (video, not in the documents).';
export function schoolClaim(claim: string, cite: string, doc?: string): string { return `${claim} (${cite}) ${doc ? `(in the documents: ${doc})` : VIDEO_ONLY}`; }
const V = {
  clock: 'Clock and Stopwatch', start: 'Starting on Time', delay: 'Time Delay Form', makeup: 'Making Up Time',
  p1: 'Rally School Part 1, Classen', p2: 'Rally School Part 2, Croker', t24: '2024 Training Session', t26: '2026 Training Session',
};

/** A lesson paragraph is plain text, or a richer block: a bulleted/numbered list, preformatted lines (call patterns, worked examples), a table or a printable card. */
export type LessonBlock = string | { heading: string } | { list: string[]; ordered?: boolean } | { pre: string[]; caption?: string } | { table: { head: string[]; rows: string[][] }; caption?: string } | { card: { title: string; lines: string[] } };
export interface Lesson { id: string; title: string; minutes: number; body: LessonBlock[]; check: { question: string; options: string[]; answer: number; explain: string }; source: string }

/** Every word of a lesson (body, blocks, check and source) as one string: used by tests and search. */
export function lessonText(l: Lesson): string {
  const parts: string[] = [l.title];
  for (const b of l.body) {
    if (typeof b === 'string') parts.push(b);
    else if ('heading' in b) parts.push(b.heading);
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
    id: 'which-timer', title: 'Which timer, when', minutes: 4, source: 'docs/research/08-rookie-handbook-body.md §2, §5, §6, §8 (HB p.5, p.11-13); docs/research/09-event-regulations-2026.md §7.3, §8.5, §14 (REG V.C.1.b, VII.F, V.H.3); docs/research/10c-short-videos.md Clock and Stopwatch [00:37]-[02:41]; docs/research/10b-rally-school-classen-croker.md P2 13:08; docs/research/10a-training-sessions-2024-2026.md 2026 101:15',
    body: [
      'You carry two timers and they do different jobs (HB p.5). The stopwatch measures how long something takes. The analog dash clock is a time-of-day instrument, but it has a weakness that the rally school (the video series, see What the rally school adds) is blunt about: its second hand is very consistent, its minute hand is loose. Most mistakes come from using one device for the other\'s job, and the costliest one is the one-minute mistake.',
      'The director\'s method (Jeff Stumb, Clock and Stopwatch [00:37], [01:08]; video, not in the documents). His words: the clock "has a very consistent second hand. But it has a rather loose minute hand and it is quite easy to make a 1 minute mistake with the clock." So time of day comes from the digital stopwatch in its time-of-day (TOD) mode, the clock is used only for its second hand, and you switch the watch back to chrono when you need an interval. Veterans do the same at restarts (Croker, Rally School Part 2 [13:08]). The clock is still synced to the WWV clock when the instructions are picked up (REG V.C.1.b) and it is still legal and useful; the regulations allow the TOD function on the stopwatch (REG II.H.1.d(3): the stopwatch "may also have split-action, time-of-day, date, and alarm functions") while the clock itself must be analog with no digital readout (II.H.1.d(1)).',
      'Why the minute hand fails (Clock and Stopwatch [01:39]; video, not in the documents): near the end of a minute, with the second hand at about 55 or 56, the minute hand has already moved on, and it is hard to tell which minute it is. In the simulator the minute hand is drawn between the numerals and, within 5 seconds either side of the minute change, it is ambiguous: at the lower aids rungs there is no resolved minute, only the hand. Reading the minute off the clock there is the one-minute mistake, and it is a one-minute error at the next checkpoint (60 s on the scorecard) because you left a restart on the wrong minute, which the Four S\'s call out ("it will take a lot of make up to get back on time, assuming you even recognize that you left on the wrong time", HB p.13).',
      'So the routine at every start, restart, transit IN and OUT, and TA window is: stopwatch in TOD mode for the hour, minute and second to write down, clock second hand to count the seconds in, then toggle the watch back to chrono. The 2026 training session\'s navigator does both at once: watch the clock, write the hour and minute, watch the second come round "56, 57, 58, 59, there is the sign, hit the stopwatch, and write the 59" (2026 Training Session [101:15]; video, not in the documents). In the simulator a stopwatch TOD-mode read counts as a clock read (WATCH-009), so the instrument-discipline line does not flag it.',
      'Two things never to do: never read time of day off a running chrono (a chrono shows an interval, not the hour), and never time an interval off the clock\'s second hand. The stopwatch is for every interval: the calibration run (start it at the asterisk sign and lap at every calibration point), timed speed changes (start at the sign, hold until the interval), pauses (count from the moment the wheels stop and go at the chart time), and the 10 % make-up count. An exact transit can also be run off the stopwatch if the navigator prefers an interval, but the OUT time is still checked against the time of day.',
      { table: { head: ['Situation', 'Device', 'What you write down'], rows: [
        ['Start or restart', 'Stopwatch in TOD mode for the minute, clock second hand for the second', 'Restart time = base + ASP (position 1 = base + 1 minute), on the restart line; launch time = that minus your start loss'],
        ['Exact transit', 'TOD mode (or a stopwatch interval)', 'IN time and OUT time = IN + interval'],
        ['TA window (15 min)', 'TOD mode', 'Time you reached the TA point and the deadline'],
        ['Calibration run', 'Stopwatch: start at the asterisk, lap at every point', 'Interval and cumulative for each point, against the box'],
        ['Timed speed change', 'Stopwatch, started at the sign', 'The call time (interval minus the ramp lead)'],
        ['Pause', 'Stopwatch, started when the wheels stop', 'The chart time beside the printed pause'],
        ['10 % make-up count', 'Stopwatch', 'Seconds to hold the higher speed'],
        ['Clock minute hand near the top of a minute', 'Do not trust it: TOD mode, then the second hand to count in', 'The minute from the watch, never from the hand'],
      ] }, caption: 'Which timer, when' },
      'Worked example, the calibration run. The book prints a box at each calibration point with the interval over the cumulative official time (REG VII.F.1); the asterisk marks where the stopwatch starts. Lap at each point and compare the cumulative lap with the box, not the intervals, so errors do not stack.',
      { pre: [
        'point      box cumulative   your lap       late',
        ...CAL_BOX_CUM.map((c, i) => `${("#" + [6, 7, 9, 10][i]).padEnd(11)}${mmss(c).padEnd(16)} ${mmss(CAL_LAPS[i]!).padEnd(14)} +${(CAL_LAPS[i]! - c).toFixed(1)} s`),
        `Late ${LAP_ERR.toFixed(1)} s in ${mmss(CAL_BOX_CUM[3]!)}  ->  ${LAP_SPH.toFixed(1)} s per hour`,
        `Timewise factor ${CAL_FACTOR} x ${CAL_BOX_CUM[3]!.toFixed(1)} / ${CAL_LAPS[3]!.toFixed(1)} = ${(CAL_FACTOR * CAL_BOX_CUM[3]! / CAL_LAPS[3]!).toFixed(1)} -> ${LAP_NEW}`,
      ], caption: 'Calibration laps (box values from the Example Rally #6-#10; the laps are an illustration)' },
    ],
    check: { question: 'A timed segment reads "30 MPH / 0m36s / 45 MPH". How do you time the 36 seconds?', options: ['Note the clock\'s second hand at the sign and watch for 36 s later', 'Start the stopwatch at the sign and count the interval on it', 'Read the time of day off the running stopwatch', 'Use the stopwatch\'s time-of-day mode'], answer: 1, explain: 'Intervals belong to the stopwatch, started at the sign. Time of day comes from the watch\'s TOD mode (the clock is for its second hand); never time an interval off the clock\'s second hand, and never read time of day off a running chrono.' },
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
    id: 'recovery', title: 'Early, late and the 10 % rule', minutes: 6, source: 'docs/research/08-rookie-handbook-body.md §4 (HB p.10), §7 tip 7; docs/research/03 §4.3, 07 §6; CHART-004; docs/research/10c-short-videos.md Making Up Time [01:03]-[05:11]; docs/research/10b-rally-school-classen-croker.md P1 15:59, P2 04:08',
    body: [
      'A truck, a long stop or a train makes you late by a known number of seconds: you measured it on the stopwatch. Write it in the ledger (press E in the cockpit). Then recover it as soon as it can be done safely, because you do not know where the next checkpoint is (HB p.15 tip 7), and stop correcting once the ledger reads zero.',
      'The handbook\'s ten per cent rule (HB p.10): drive 10 % above the instructed speed for 10 x the seconds lost. 38.5 mph for 40 s makes up 4 s at 35; 44 mph for 44 s makes up 4.4 s at 40. The same works for losing time: drive 10 % below for 10 x the seconds.',
      'The field variant is 20 % over for 5 times the delay: at 40 mph, 8 s late is 48 mph for 40 s. On the stopwatch both rules are exact, not conservative, so stop when the ledger reads zero: being early costs exactly as much as being late.',
      'The rally school\'s make-up rules (Making Up Time, Jeff Stumb; the 10 % rule is in the handbook, the rest is video, not in the documents):',
      { list: [
        '10 % over the assigned speed gains 1 s per 10 s, 6 s per minute: 44 at 40, 38.5 at 35 (Making Up Time [01:03], [01:36]; in the documents: HB p.10).',
        '20 % over gains 12 s per minute: 48 at 40, once you are comfortable and the delay is a big chunk (Making Up Time [03:08]; video, not in the documents). The 20 % rule: drive 5 x the seconds owed (the 10 % rule needs 10 x).',
        'Keep a running total and work it in chunks: you will not always get 30 s in one go; a minute at +10 % is 6 s, another minute is 12 s, and so on until the ledger is clear (Making Up Time [02:37]; video, not in the documents). The ledger (E) shows what is still owed and the 10 % and 20 % options in mph and seconds.',
        'Keep watching for signs while you hurry: some of them are new instructions and new speeds. Drop the extra speed at the next speed-change sign, get settled at the new assigned speed, work out how much you made up, then take +10 % of the new speed again (40 to 35: back to 35, then 38.5) (Making Up Time [03:39]; video, not in the documents).',
        'A stop is a place to recover: stop for 1 s of a 10 s pause and you gained 9 s (Making Up Time [04:41]; video, not in the documents). Stop shortening is legal only on a pause that is printed; veterans avoid it for fear of a checkpoint at the sign, a rookie may find it more comfortable than speeding.',
        'Never make up time inside a stopwatch-timed interval ("30 for seven minutes ... do not make up time during that time, it will mess up what you are already doing", Making Up Time [05:11]; video, not in the documents). The debrief flags it as a disturbed timed interval.',
        'Do not carry a loss across a checkpoint: you are automatically on time the instant you cross it (Classen, Rally School Part 1 [15:59]; in the documents: HB p.13), and a safe speed always wins over the seconds (Croker, Rally School Part 2 [04:08]).',
      ] },
      'The lost-time formula, for driving slower than assigned (HB p.10): (Assigned - Actual) / Assigned x seconds at the reduced speed = seconds lost. 40 assigned, 30 actual, 20 s = (40 - 30) / 40 x 20 = 5 s lost.',
      'In watch terms: holding +d mph recovers E seconds after t = E x v / d seconds. At +5 mph that is t = E x v / 5: 8 s late at 35 mph means 40 mph for 56 s (not 64: the (v/5 + 1) form counts ghost time, which your watch never shows). A delay of the kind V.H.1 names (a train blocking the route, or stopping to help at the scene of an accident) may instead be requested as a Time Allowance, but never both request and make up the same seconds, and only the wait itself is creditable: the stop/start loss of braking and accelerating is not, so recover that part yourself. A traffic light is not named in V.H.1; the simulator can be set to credit one (rules.taForSignals), but the regulations do not promise it.',
    ],
    check: { question: 'You are 4.4 s late at an assigned 40 mph. Using the handbook\'s ten per cent rule, what do you drive?', options: ['44 mph for 44 s', '44 mph for 4.4 s', '40 mph for 44 s', '36 mph for 44 s'], answer: 0, explain: '10 % over 40 is 44 mph, held for 10 x 4.4 = 44 seconds. Then back to 40 and ledger zero. (36 mph for 44 s would lose another 4.4 s.)' },
  },
  {
    id: 'calibration', title: 'The morning calibration run', minutes: 7, source: 'docs/research/08-rookie-handbook-body.md §2 (HB p.3), §5 (HB p.11); docs/research/08b-rookie-handbook-appendices.md §2 (HB Appendix C); docs/research/07 §3; CHART-005; docs/research/10a-training-sessions-2024-2026.md 2024 44:06, 86:16, 88:22, 90:59, 2026 29:02, 83:11, 122:52',
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
      'What the rally school adds to the calibration run (all video, not in the documents unless stated):',
      { list: [
        'No live feedback. Do not tell the driver "we are running early" or "late" during the run: he holds the indicated 50 exactly and you do the arithmetic afterwards ("As a driver, my best deal of the day is holding that speed exactly", 2026 Training Session [122:52]; 2024 Training Session [88:22]). In the simulator the pace bar and the early/late cues are hidden for the whole calibration section at every aids rung.',
        'Use the split, not stop and start, and write each split beside the instruction; compare against the cumulative column, not to match it but "to compare what I have to what the optimal time is" (2024 Training Session [86:16]; 2026 Training Session [78:30]).',
        'Clicks = error (s/h) x factor / 3600 (2026 Training Session [29:02]; 2024 Training Session [44:06]; in the documents: HB Appendix C). With factor 4057 that is about 1.13 clicks per second per hour: 9 s per hour, about 10 clicks.',
        'On a run of about 28 minutes, double the error to get seconds per hour: the official total is 28m43.2s, whatever you differ by is your error for 28 minutes, and doubling it gives the seconds early or late in an hour; "3 seconds early in the hour, every 20 minutes correct a second" (2026 Training Session [83:11]; in the documents: HB Appendix C method 1).',
        'Stock speedometer, nothing to click: correct by schedule instead. "If five seconds late in 25 minutes you are one second late every five minutes, so correct one second every five minutes or two every ten" (2024 Training Session [90:59]). The ledger offers this as "1 s per N minutes" from the error you measured.',
        'Do not adjust at once: you may miss the next instruction. Adjust parked at the end of the run (2024 Training Session [90:27]). And do not assume yesterday\'s factor: "even if you won the previous day" (2024 Training Session [69:11]).',
      ] },
      { pre: [
        'Schedule correction for a stock speedometer',
        '5 s late in 25 min  ->  1 s per 5 min  (or 2 s per 10 min)',
        `${fmt1(CAL_ACTUAL - CAL_CORRECT)} s late in ${fmt1(CAL_CORRECT / 60)} min (the HB example)  ->  1 s per ${(CAL_CORRECT / 60 / (CAL_ACTUAL - CAL_CORRECT)).toFixed(1)} min`,
        'Add the second at the next convenient moment: a held speed for the right number of seconds, never inside a timed interval',
      ], caption: 'Manual correction schedule (2024 Training Session [90:59]; the HB example numbers are Appendix C)' },
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
    id: 'protocol', title: 'Team protocol', minutes: 8, source: 'docs/research/08-rookie-handbook-body.md §7 (HB p.15, driver and navigator tips 1-8), §6 (HB p.13); docs/research/08b-rookie-handbook-appendices.md §1.3 (HB Appendix B step 2); docs/research/03 §1, 04 §4; docs/research/10a-training-sessions-2024-2026.md 2026 10:53, 80:03, 121:20; docs/research/10b-rally-school-classen-croker.md P2 15:45, 19:57',
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
      'ICE: identify, confirm, execute (Croker, Rally School Part 2 [15:45]; 2026 Training Session [10:53]; video, not in the documents; the handbook\'s own rule is the read-back, HB p.15 tip 4). The navigator says what to look for. Whoever sees it first says "I see it", the other says "I see it too" (that is the confirm), and only then does the navigator tell the driver what to do at that sign. At the sign the driver says "mark" when the two posts of the sign line up (2026 Training Session [80:03]; video, not in the documents). After the sign the driver says the speed he is holding, and every few minutes, unprompted, "okay, I\'m holding 35"; the navigator confirms or corrects it (2026 Training Session [10:53]; video, not in the documents).',
      { pre: [
        'Navigator: "Next: hard left 25, then 20 after."          (identify)',
        'Driver:    "Hard left 25."                               (read-back)',
        '           ... the sign comes into view ...',
        'Driver:    "I see it."      Navigator: "I see it too."   (confirm)',
        'Driver:    "Mark."                                       (the posts line up: the navigator takes the time or the split)',
        'Navigator: "At that sign, go to 20."                     (execute)',
        'Driver:    "Going to 20 ... holding 20."',
        '           ... a few minutes later, unprompted ...',
        'Driver:    "Okay, I\'m holding 35."   Navigator: "Confirmed, 35."',
      ], caption: 'ICE with the read-back, "mark" and "holding 35" (2026 Training Session [10:53], [80:03]; Croker [15:45]; video, not in the documents)' },
      'The stop count, as the 2026 session runs it (2026 Training Session [121:20]; video, not in the documents): the navigator announces the stop before it happens ("coming in at 20, out 35, holding for nine"), the driver says "stopped" when the car rocks back (2026 [38:54]; 2024 [53:20]), and she counts from the rock-back, "9, 8, 7, 6 ... 1, go 35". If he is watching cross traffic he says "keep counting", and she carries on "0, 1, 2" until he goes, which tells her how long the stop really was. Croker counts the other way, up from the rock-back to the chart time, but also always ends on the word GO (Rally School Part 2 [19:57]; video, not in the documents).',
      { pre: [
        'Navigator: "Coming in at 20, out 35, holding for nine."',
        'Driver:    "Stopped."                      (the car rocks back: the navigator starts the watch)',
        'Navigator: "9, 8, 7, 6, 5 ..."',
        'Driver:    "Keep counting."                (cross traffic)',
        'Navigator: "... 2, 1, GO ... 0, 1, 2 ..."   (the count carries on past zero until the car goes)',
        'Driver:    "Going. 35."',
      ], caption: 'The stop count with "keep counting" (2026 Training Session [121:20]; video, not in the documents)' },
      { list: [
        'Rule 3: the driver repeats back every turn and every speed he hears (HB p.15 tip 4). After several lefts it is easy to hear "left" for "right". "Right at the stop, got it." "Thirty-five." "Holding thirty-five."',
        'Rule 4: in a timed section only the talk that follows the instructions: calls, read-backs, counts. Scenery and post-mortems wait (tip 3). Silence is how the driver hears the call.',
        'Rule 5: cross off each instruction when it is done (tip 5), with a large transparent marker, especially for identical instructions in a row, so neither of us loses the line. The driver says "done" and the navigator marks it.',
        'Rule 6: never pull up to a restart point before your minute (tip 6). Sit short of it, count to your time, then roll up and leave exactly on it.',
        'Rule 7: make up a loss as soon as it is safe to (tip 7). We do not know where the next checkpoint is. Use the 10 % rule, then back to the assigned speed.',
        'Rule 8: team errors only (tip 2). After a mistake there is no "you missed it". We both make the correction, and we work together on a hard sign or street name.',
        'Rule 9, "comes quick": the driver watches the road; the navigator, head down in the book, reads the next two instructions out loud so the driver knows both signs to look for. The navigator\'s head is down, so the driver is the eyes: he says "I see it" for each sign he sees (the navigator answers "I see it too", the ICE confirm), and "not yet" if he does not.',
        'Rule 10 (simulator convention, not in the documents): if a landmark does not appear when it should, do not keep driving. Stop before the leading edge of the next intersection and work out where we are. A wrong turn is the biggest loss in the game (the handbook says a wrong or missed turn "usually costs several minutes"). If the driver has to ask "left or right?", the call was late: our house habit is to call turns 500-600 ft out, a number from our own research notes, not the handbook or regulations.',
      ] },
      { card: { title: 'Card for the driver (print and keep in the car)', lines: [
        'Eyes on the road. The navigator has the book.',
        'Say back every turn and every speed: "Right, 35." Every few minutes, unprompted: "Holding 35."',
        'ICE: the navigator names the sign; say "I see it" or "I see it too"; say "mark" as you pass it.',
        'Say "Stopped" when the car rocks back. Do not move until you hear GO.',
        '"9 ... 1, GO": GO is the only signal to go. Watching traffic? Say "keep counting": the count goes 0, 1, 2 until you go.',
        'In a timed section, talk only about the instructions. Never ask "are we early or late?": hold the speed.',
        '"Comes quick": eyes up, be ready for the next two. Not sure where we are: stop short of the intersection and say so.',
        'Any mistake is ours. Fix it together and move on.',
      ] } },
    ],
    check: { question: 'The navigator counts "3, 2, 1" and then says nothing. What should the driver do, and what should the count have been?', options: ['Go at "1"; the count was fine', 'Wait: the count must end with the word GO, and GO is the only signal to move', 'Go after one second of silence'], answer: 1, explain: 'The navigator always ends a countdown with GO (HB Appendix B). GO is the one word that tells the driver to execute, so the driver does not move without it.' },
  },
  {
    id: 'markup', title: 'Marking up the instructions', minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §7 tip 8 (HB p.15), §3b (HB p.8), §5 (HB p.11-12); docs/research/09-event-regulations-2026.md §7.1, §7.4 (REG VII.B.2.a, V.C); DRILL-024; docs/research/10b-rally-school-classen-croker.md P1 06:11, P2 08:53; docs/research/10a-training-sessions-2024-2026.md 2026 75:26, 97:02, 105:53',
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
      'The rally school adds three more habits (each labelled; none is in the handbook or regulations), and D15 and D16 grade the Column D note:',
      { list: [
        'Page count: before you leave the scoring table, flip to every page and check "page 1 of 26, 2 of 26, 3 of 26" in the footer, so you do not learn at two in the afternoon that page 26 is missing (2026 Training Session [75:26]; Croker, Rally School Part 2 [08:53]; video, not in the documents). The sim\'s book carries the same "Page n of m" footer.',
        'Pre-write the chart loss beside every stop and every turn: "10.2" for a stop, "-2.3" for a 35 to 30 right turn, then make the seconds up afterwards with the 10 % rule (2026 Training Session [97:02]; video, not in the documents; the handbook already has you write the chart pause time beside a printed pause).',
        'Number every timing checkpoint and write your exact arrival time of day in Column D: "1  9:22:14", "2  10:41:07" (Classen, Rally School Part 1 [06:11]; 2026 Training Session [105:53]; video, not in the documents). If a team disputes a score, "mark me at 9:12:17 and I think I got there at 9:13" can be investigated; "I don\'t know" cannot.',
      ] },
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
      'Do the markup before you start, not on the road. The drill D15 grades all six notations, and D15 and D16 grade the checkpoint number and arrival time you write in Column D to within 2 s (PREREAD-001).',
    ],
    check: { question: 'The bottom of page 2 ends "STOP: 0 MPH / 0m15s / 40 MPH". The first row of page 3 prints no speed. What do you write at the top of page 3?', options: ['0 MPH', '15 MPH', '40 MPH', 'Nothing: the page starts fresh'], answer: 2, explain: 'The speed carries over from the bottom of the previous page: after the pause you leave at 40 MPH, so write 40 at the top of page 3 (HB p.15 tip 8).' },
  },
  {
    id: 'transits', title: 'Transits and restarts', minutes: 5, source: 'docs/research/08-rookie-handbook-body.md §5, §6, §8 (HB p.11-14, Appendix D); docs/research/09-event-regulations-2026.md §7.4, §8.1, §13.3 (REG V.B.2, VII.B.3.c(4), VII.C.5, VII.E.1.b, V.E.3.h); docs/research/10c-short-videos.md Starting on Time [01:07]-[04:12]; docs/research/10b-rally-school-classen-croker.md P1 42:26, 44:27, P2 12:36, 14:10; docs/research/10a-training-sessions-2024-2026.md 2026 53:47, 70:49',
    body: [
      'A transit is an untimed stretch with no timing checkpoints and no assigned speed; a time for the passage, or a restart time at the end, is given (glossary; REG VII.E.1.b). A full hourglass in Column B begins it and an empty one ends it. Lunch, fuel, pit stops and rest stops all happen inside a transit.',
      'Advisory transit: the time is in parentheses, like (3h25m00s) or (0m30s). It is a guide so you arrive at the next time-of-day restart on time. Nothing times you inside it, but you must still be at the restart at your minute.',
      'Exact transit: when a transit comes after a time-of-day restart, between timed pieces, the handbook says it "is critical ... must be executed exactly." The row says something like "take exactly 20 minutes". Record the exact time of day you pass the IN sign, add the printed interval, and write the result at the end-of-transit instruction: IN + interval = OUT. Example: IN 2:41:20 + 20m00s = OUT 3:01:20. Arrive a few minutes early, pull up to the sign close to the OUT time, and depart exactly then at the assigned speed. Cars are no longer exactly one minute apart after such a transit. Only "take exactly" makes a transit exact: a plain interval such as the calibration run\'s 26m00s or the end-of-stage transit\'s 30m00s (Example #34) is a guide, not a time you must hit (HB p.11; REG VII.B.3.c(4)).',
      'Lunch inside the transit: the book says "After lunch, leave here 45 minutes prior to your end-of-transit time." Work backwards from your own restart time. If the transit ends at a 2:55:00 restart and your start position is 12, your end-of-transit time is 3:07:00 and you leave lunch at 2:22:00. Refuel (for example 3h10m prior), a pit stop (2h10m prior) and a rest stop (3 min prior) work the same way. Leaving a promoted lunch, pit or rest stop more than 5 minutes before the scheduled departure costs 1 minute the first time and 5 minutes the second (REG V.E.3.h).',
      'A time-of-day restart is the base time plus your assigned start position (ASP) in minutes: "Leave this point at 8:55:00 plus your assigned start position in minutes." The ASP is not your car number and it changes daily. In the handbook\'s Trophy Run example the ASP was 42, so a noon start became 12:42, and the instructions were handed out at 12:12. A morning adds up like this: start 8:00:00, tire warm-up 20m00s, calibration 26m00s, transit 9m00s, restart 8:55:00 plus your ASP.',
      'There is a 2-minute free zone after the end of every transit (REG VII.C.5.c): no timing checkpoint will be there, so you can park along the route if the end of the transit is crowded.',
      'Leaving the restart sign, step by step (Starting on Time [01:07]-[04:12]; Classen, Rally School Part 1 [42:26]; Croker, Rally School Part 2 [12:36], [14:10]; 2026 Training Session [53:47], [70:49]):',
      { list: [
        'Your position is your leave time: position n leaves at the base time plus n minutes. Position 1 leaves at base + 1 minute, not at the base time (2026 Training Session [53:47]; video, not in the documents; REG VII.B.2.a says the base time plus your starting position in minutes). Base 9:05 and position 27 is 9:32:00.',
        'Nobody releases you. No official, no flag, no checkpoint crew: "it is your total responsibility to know when to leave" (Croker [14:10]; in the documents: HB p.13, "Nobody tells you when to start").',
        'Wait among the cars away from the action. Pull up to the sign only after the car ahead of you has left on its own minute, and never a minute early (Croker [12:36]; Classen [42:26]; in the documents: HB p.15 tip 6). If the car ahead sits there and does not go, pull up around it and leave on your minute (Croker [14:10]; video, not in the documents). Running starts are not recommended (Classen [44:27]; video, not in the documents).',
        'Launch at your own time minus the car\'s standing-start net loss, because you cannot get from 0 to 30 mph instantly: your time 9:32:00, loss 3 s, launch at 9:31:57 (Starting on Time [03:41]; in the documents: HB p.7, 0 to 40 mph costs 4.5 s, start 4.5 s early).',
        'About 30 seconds before the launch, tell the driver ("9:31:30, we are going in about 30 seconds"), then count down so that the last count lands on the launch second: 9:31:57, wheels already rolling, at speed at 9:32:00 (Starting on Time [04:12]; video, not in the documents; the caption says "about 25 seconds", and 9:31:30 to 9:31:57 is 27).',
      ], ordered: true },
      { pre: [
        'base 9:05:00 + position 27 min      = your time 9:32:00',
        'launch = 9:32:00 - 3 s start loss   = 9:31:57',
        '9:31:30   "We go in about 30 seconds."',
        '9:31:47   "10 ... 9 ... 8 ... 7 ..."',
        '9:31:57   "... 2, 1, GO."           the last count lands on the launch second',
      ], caption: 'A start, worked (Starting on Time [03:41], [04:12]; video, not in the documents)' },
      'The Four S\'s warning applies here more than anywhere. "Start on time" has two parts: the clock set to WWV, and leaving at the indicated time. Leaving on the wrong minute "will take a lot of make up to get back on time, assuming you even recognize that you left on the wrong time." One minute off is 60 seconds at the next checkpoint. Never pull up to a restart before your minute, and never leave one early.',
    ],
    check: { question: 'Lunch says "leave here 45 minutes prior to your end-of-transit time". The transit ends at a 2:55:00 restart plus your start position of 12 minutes. When do you leave lunch?', options: ['2:10:00', '2:22:00', '2:37:00', '3:07:00'], answer: 1, explain: 'End of transit = 2:55:00 + 12 min = 3:07:00. Leave 45 minutes prior: 3:07:00 - 0:45:00 = 2:22:00.' },
  },
  {
    id: 'rally-school', title: 'What the rally school adds', minutes: 9,
    source: 'docs/research/10-rally-school-videos.md; docs/research/10a-training-sessions-2024-2026.md; docs/research/10b-rally-school-classen-croker.md; docs/research/10c-short-videos.md (the 13 official Great Race rally school videos, auto-captions)',
    body: [
      'The Great Race published a set of rally school videos: Jeff Stumb\'s short how-to series (Clock and Stopwatch, Starting on Time, Filling Out a Time Delay Form, Making Up Time), John Classen\'s and Bill Croker\'s rally school (Part 1 and Part 2), and the 2024 and 2026 rookie training sessions. They settle things the handbook and the regulations leave open, and they show what veterans actually do. The rule of this page: the 2026 Event Regulations and the Rookie Handbook win wherever they speak. Every claim below names its video and the caption timestamp [mm:ss] (the captions were read, not watched, so a timestamp is good to about 30 seconds), and a claim that only a video makes is labelled (video, not in the documents).',
      { heading: 'The director\'s clock method' },
      { list: [
        schoolClaim('The Sawtooth clock has "a very consistent second hand. But it has a rather loose minute hand and it is quite easy to make a 1 minute mistake"; the director no longer uses a watch for time of day', `${V.clock} [00:37]`),
        schoolClaim('Near the top of the minute, with the second hand at 55 or 56, the minute hand has already moved to the next minute and it is hard to tell which minute it is', `${V.clock} [01:39]`),
        schoolClaim('Time of day comes from the digital three-button stopwatch toggled to time-of-day mode ("if you set up this stopwatch correctly, you won\'t need that watch"); some people use the clock only for its second hand', `${V.clock} [01:08]`),
        schoolClaim('Veterans use the stopwatch\'s time of day to be on the absolute right minute at a restart, then switch the watch back to its normal function', `${V.p2} [13:08]`),
        schoolClaim('At a restart or a stop-ahead sign do both: read the clock, write the hour and minute, count the second hand round ("56, 57, 58, 59, there is the sign, hit the stopwatch, write the 59")', `${V.t26} [101:15]`),
        schoolClaim('A wristwatch must be analog without a stopwatch mode; the stopwatch may have a time-of-day function', `${V.clock} [02:41]`, 'REG II.H.1.d(2), II.H.1.d(3)'),
        schoolClaim('Check clock and stopwatch against the WWV clock at the instruction pickup every morning, "trust but verify"', `${V.p2} [02:05], [03:07]`, 'HB p.13, REG V.C.1.b'),
      ] },
      { heading: 'The start procedure' },
      { list: [
        schoolClaim('Position 1 leaves at base + 1 minute, not at the base time; position n leaves at base + n minutes (base 9:05 and position 27 is 9:32:00)', `${V.t26} [53:47]; ${V.start} [01:07]; ${V.t24} [92:29]`),
        schoolClaim('Nobody releases you: no official, no flag, no checkpoint crew, "just that sign, you and the clock and your order of start"', `${V.t26} [70:49]; ${V.p2} [14:10]`, 'HB p.13 "Nobody tells you when to start"'),
        schoolClaim('Do not pull up to the start sign until the car ahead of you has left on its own minute, and never a minute early', `${V.p2} [12:36]; ${V.p1} [42:26]`, 'HB p.15 tip 6'),
        schoolClaim('If the car ahead sits at the sign and does not go, pull up around it and leave on your minute; running starts are not recommended', `${V.p2} [14:10]; ${V.p1} [44:27]`),
        schoolClaim('Launch at your own time minus the standing-start net loss (your time 9:32:00, loss 3 s, launch 9:31:57): "you cannot instantaneously get from 0 to 30 miles an hour"', `${V.start} [01:38], [03:41]`, 'HB p.7 (0 to 40 mph, 4.5 s early)'),
        schoolClaim('About 30 seconds before the launch tell the driver, then count down so the last count lands on the launch second (the caption says "about 25 seconds"; 9:31:30 to 9:31:57 is 27)', `${V.start} [04:12]`),
        schoolClaim('The car one minute ahead and the one behind are the only live early/late hint: if you keep running up on the car ahead you are fast, if someone is always in your mirror you are slow ("run your own race"; do not change your second because an expert left at a different one)', `${V.t26} [125:28], [102:16]`),
      ] },
      { heading: 'The Time Allowance web form and arithmetic' },
      { list: [
        schoolClaim('The 2026 form asks for car number, a four-digit password, the phone number, the leg, the instruction numbers it happened between, and the time; submitted "within 15 minutes" at the lunch and finish TA points', `${V.t26} [110:28]`, 'REG V.H.3, Example #18 "Within 15m00s" for the 15 minutes; the form fields themselves are video-only'),
        schoolClaim('At the end of the day the red "done" button prints the scorecard; the paper forms (car number, stage, leg, instruction numbers, time, description, signature, the cars stopped with you) are the older method', `${V.t26} [110:28]; ${V.delay} [02:41], [04:13]`),
        schoolClaim('Leg number = checkpoints passed + 1: passed checkpoint 4, you are on leg 5', `${V.delay} [02:41]`),
        schoolClaim('Measured delay = stopped time (stopwatch from wheels-stop to go) + the stop-and-go loss for your speeds from the chart', `${V.delay} [01:38], [04:44]`),
        schoolClaim('Times go in as multiples of 10 s', `${V.delay} [02:10]`, 'REG V.H.3'),
        schoolClaim('Make up the odd seconds yourself so the request is a multiple of 10: delayed 3:47, make up 7, claim 3:40', `${V.delay} [02:10]`),
        schoolClaim('Causes named: a train, a tractor, a school bus, construction, a combine; never a flat tire, oversleeping, getting lost or a breakdown', `${V.delay} [00:04]; ${V.p2} [05:43]`, 'REG V.H.1 for what never qualifies; the tractor, bus, construction and combine list is video-only'),
        schoolClaim('If a checkpoint arrives while you still carry the delay, go through as usual and mark the instruction number the delay belongs to', `${V.delay} [02:41]`),
      ] },
      { heading: 'Making up time' },
      { list: [
        schoolClaim('10 % over the assigned speed gains 1 s per 10 s, 6 s per minute (44 at 40, 38.5 at 35)', `${V.makeup} [01:03], [01:36]`, 'HB p.10'),
        schoolClaim('20 % over gains 12 s per minute (48 at 40)', `${V.makeup} [03:08]`),
        schoolClaim('Keep a running total and work it in chunks: a minute at +10 % is 6 s, another minute 12 s', `${V.makeup} [02:37]`),
        schoolClaim('Drop the extra speed at the next speed-change sign, then take 10 % of the new speed again', `${V.makeup} [03:39]`),
        schoolClaim('A stop is a place to recover: stop for 1 s of a 10 s pause and you gain 9 s', `${V.makeup} [04:41]`),
        schoolClaim('Never make up time inside a stopwatch-timed interval: "it will mess up what you\'re already doing"', `${V.makeup} [05:11]`),
        schoolClaim('Make the correction at the first safe opportunity and do not carry it from page to page: a checkpoint will show up', `${V.p2} [24:02]`, 'HB p.15 tip 7'),
      ] },
      { heading: 'When you are lost' },
      { list: [
        schoolClaim('Warning signs: a speed that does not suit the road, a stop sign that is not in your instructions, a long stretch with no cars behind. Pull over where it is safe: the car a minute behind arrives, or you are off course', `${V.t24} [119:15]; ${V.t26} [113:35]`),
        schoolClaim('Hit the stopwatch when you turn around: the return trip is half the lost time, so double it', `${V.t26} [94:27]; ${V.t24} [120:16]`),
        schoolClaim('Rejoin 30 seconds behind a car you know is on course; write the leg off, the next checkpoint resets you', `${V.t24} [119:15], [121:18]; ${V.t26} [115:37]`, 'HB p.13 for the checkpoint reset; the 30 seconds and the stopwatch are video-only'),
        schoolClaim('Do not try to make up the lost minutes after a wrong turn: "no score is worth an accident"', `${V.p2} [04:08]`),
      ] },
      { heading: 'Checkpoints' },
      { list: [
        schoolClaim('A green sign is a timing checkpoint: "the minimum that you need to do at a green sign is nothing"; you are not told your score', `${V.p1} [04:08], [05:39]`, 'REG V.A.1.a'),
        schoolClaim('A red sign is an observation checkpoint: stop and talk to the worker (equipment inspection, collecting Time Allowances, the finish)', `${V.p1} [02:37], [03:07]`, 'REG V.A.1.b'),
        schoolClaim('Never stop within sight of a green checkpoint, and never go slower than 5 mph (30 s, REG V.E.3.a); wave, smile, honk, but do not talk to the crew', `${V.p2} [35:33]; ${V.t26} [64:10]`, 'REG V.E.3.a'),
        schoolClaim('Write the checkpoint number and your arrival time to the second in Column D ("nine o\'clock, 22 minutes, 14 seconds") so a score dispute can be investigated', `${V.p1} [06:11]; ${V.t26} [105:53]`),
        schoolClaim('Expect at least four or five timing checkpoints a day, always one in the morning, and one may come minutes after you think the last one has passed: run it out', `${V.p1} [07:42]; ${V.p2} [36:10], [36:40]`),
        schoolClaim('There is no timing checkpoint before the first time-of-day restart; the tire warm-up and the calibration are unscored', `${V.p1} [42:57]`, 'REG V.B.2'),
      ] },
      { heading: 'The callout protocol' },
      { list: [
        schoolClaim('ICE: identify, confirm, execute. The navigator says what to look for; "I see it" / "I see it too"; then the navigator says what to do at that sign', `${V.p2} [15:45]; ${V.t26} [10:53]`),
        schoolClaim('The navigator states the speed, the driver repeats it and now and then says "okay, I\'m holding 35"; the navigator confirms', `${V.t26} [10:53]`, 'HB p.15 tip 4 for the read-back; "holding 35" is video-only'),
        schoolClaim('The driver says "mark" when the two posts of the sign line up', `${V.t26} [80:03]`),
        schoolClaim('The stop count: "coming in at 20, out 35, holding for nine, rock back, 9 ... 1 go"; if the driver says "keep counting" the count goes on 0, 1, 2 until he goes', `${V.t26} [121:20]`),
        schoolClaim('Start the watch when the car rocks back; count up and end on GO ("the last word is always GO"); the chart pause rounded to whole seconds', `${V.p2} [19:57], [22:02]; ${V.t24} [53:20]`, 'HB Appendix B for the countdown ending on GO'),
        schoolClaim('A timed hold: call the next speed about 2 s early (a "virtual split") and count "3, 2, 1" to cover reaction time', `${V.t26} [120:16]`),
        schoolClaim('Give the driver no early/late feedback during the calibration run: the navigator does the math after', `${V.t26} [122:52]; ${V.t24} [88:22]`),
      ] },
      { heading: 'A few more numbers' },
      { list: [
        schoolClaim('Speeds run 10 to 55: 55 appears in the warm-up, calibration and transits, and 48 "is something you will see on quite a few occasions"', `${V.t26} [58:56], [137:14]`, 'REG VII.E.1.a for 50 or 55'),
        schoolClaim('A simple chart is enough for a rookie: compare the plain chart with one refined for 25 years', `${V.t24} [54:51]`),
        schoolClaim('The late cap is 2 minutes, the early cap 5 minutes; early and late do not cancel', `${V.p1} [13:25], [17:00]`, 'REG V.E.1'),
      ] },
      { table: { head: ['Video', 'Who', 'Used for'], rows: [
        ['Clock and Stopwatch', 'Jeff Stumb, director', 'the director\'s clock method'],
        ['Starting on Time', 'Jeff Stumb', 'position + launch time, the 30-second warning and the count'],
        ['Filling Out a Time Delay Form', 'Jeff Stumb', 'TA arithmetic, form fields, causes'],
        ['Making Up Time', 'Jeff Stumb', '10 % and 20 %, chunks, drop at the sign, stop shortening, timed intervals'],
        ['Rally School Part 1', 'John Classen, Director of Competition', 'checkpoints, scoring, the restart, the day\'s skeleton'],
        ['Rally School Part 2', 'Bill Croker, handbook author', 'ICE, stops, the minute hand, restarts, pre-read'],
        ['2024 / 2026 Training Session', 'Steve and Janet, rookie coordinators', 'the TA web form, callouts, lost, calibration, pace cars'],
      ] }, caption: 'The videos cited above. Timestamps are caption markers, good to about 30 seconds.' },
    ],
    check: { question: 'Your restart time is 9:32:00 and your car loses 3 s getting to 30 mph. Which is right?', options: ['Leave at 9:32:00 on the dot; the car will be late by 3 s and you make it up later', 'Launch at 9:31:57; warn the driver at about 9:31:30 and count so the last count lands on 9:31:57', 'Leave when the car ahead leaves; that is your time', 'Wait for the official to release you at 9:32:00'], answer: 1, explain: 'Nobody releases you, and the car cannot go from 0 to 30 instantly: launch the standing-start loss early (9:32:00 - 3 s = 9:31:57), about 30 s of warning, and a count whose last beat lands on the launch second (Starting on Time [03:41], [04:12]). The car ahead leaving only tells you when to pull up to the sign.' },
  },
];

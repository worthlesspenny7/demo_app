/**
 * SCH-001..004, SCH-010: Rally School 2.0, the course (docs/spec/SCHOOL.md). 13 modules in the SCHOOL.md order, each 4-8
 * one-screen pages, written for someone who has never heard of a TSD rally. Numbers appear only where the player uses them.
 * References are chips (Ref -> content/excerpts.ts), never text in the page. Pure data, tested in tests/sch-content.test.ts.
 *
 * Example numbers: stop waits use the Rookie Handbook's sample 1936 Packard chart (HB p.8), which the handbook offers to
 * rookies without a chart of their own; the runs themselves use the simulator's car.
 */
import type { ControlId, Module, Page, Ref, WidgetParams, WidgetId } from './course-types.js';
import { CONTROL_IDS } from './course-types.js';
import type { DecisionKind } from './rules.js';
import { words } from './rules.js';
import { videoByKey, type VideoKey } from './videos.js';
import { stopLoss } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';

// ------------------------------------------------------------------ budgets (tested)
export const CONCEPT_MAX_WORDS = 70;
export const EXAMPLE_MAX_WORDS = 50;
export const WHY_MAX_WORDS = 25;
export const TEACHES_MAX_WORDS = 20;
export const REFS_MAX = 2;
export const PAGES_MIN = 4;
export const PAGES_MAX = 8;
export const FIRST_TWO_MAX_WORDS = 900;
export const FIRST_TWO_MIN_INTERACTIONS = 8;
export const FIRST_VISIT_MAX_WORDS = 30;

/** PT-16 B8: Module 4's worked stops quote this app's car (the simulator's 1939 Ford), the car its stop cards use, not the handbook's
 *  sample Packard: printed pause 15 minus the car's stop-and-go loss, straight through (tests check them against src/core/perf-table.ts). */
// PT-17 N3: computed from the engine when the content loads (the car the stop cards drive, straight through, the 'straight' School pause
// form), so the worked example, the chart figure and the Module 4 pause cards are one car to 0.1 s
export const STOP_EXAMPLE: readonly { vIn: number; vOut: number; sit: number }[] = ([[30, 40], [40, 40], [50, 30]] as const).map(([vIn, vOut]) => ({ vIn, vOut, sit: Math.round((15 - stopLoss(vIn, vOut, FORD_1939)) * 10) / 10 }));

// ------------------------------------------------------------------ chip helpers
const hb = (page: string): Ref => ({ type: 'hb', key: `hb:${page}`, label: page === 'appD' ? 'HB App. D' : `HB p.${page.slice(1)}` });
const reg = (rule: string): Ref => ({ type: 'reg', key: `reg:${rule}`, label: `REG ${rule}` });
const vid = (key: VideoKey, at: string): Ref => ({ type: 'video', key: `video:${key}:${at}`, label: `Video ${videoByKey(key)?.short ?? key} ${at}` });

// ------------------------------------------------------------------ page helpers
const concept = (title: string, text: string, refs: Ref[] = [], figure?: string): Page =>
  (figure ? { kind: 'concept', title, words: text, figure, refs } : { kind: 'concept', title, words: text, refs });
const example = (title: string, lines: string[], refs: Ref[] = []): Page => ({ kind: 'example', title, lines, refs });
type SimOpts = { variant?: number; form?: import('../src/core/decision/types.js').MicroForm; pointer?: string; rounds?: { seed: number; form?: import('../src/core/decision/types.js').MicroForm; variant?: number; why: string; pointer?: string }[] };
const sim = (decisionKind: DecisionKind, seed: number, control: ControlId, why: string, refs: Ref[] = [], o: SimOpts = {}): Page => ({ kind: 'minisim', decisionKind, seed, control, why, refs, ...o });
const widget = (w: WidgetId, params: WidgetParams, refs: Ref[] = []): Page => ({ kind: 'widget', widget: w, params, refs });
const check = (question: string, options: string[], answer: number, why: string, refs: Ref[] = []): Page => ({ kind: 'check', question, options, answer, why, refs });

/** Concept figures the page player draws (id -> what it shows). */
export const FIGURES: Record<string, { alt: string }> = {
  'ghost-car': { alt: 'Your car beside a see-through ghost car on a country road.' },
  'green-sign': { alt: 'A green checkpoint sign at the roadside with a crew car parked behind it.' },
  'photos': { alt: 'Stills from the Great Race rally school videos: a lapboard with the book and a rally clock, a rally clock face, a red GREAT RACE STOP board.' },
  'route-66': { alt: 'A map line from Springfield, Illinois to Pasadena, California along Route 66.' },
  'two-seats': { alt: 'Driver eyes on the road and speedometer; navigator with the book, clock and stopwatch.' },
  'griid-row': { alt: 'One instruction line: number, then columns A, B, C and D.' },
  'cameo': { alt: 'A junction from above: a dot at the bottom, a bold line turning left to an arrow, thin side roads.' },
  'column-c': { alt: 'Column C boxes: "40 MPH"; a stop "0 MPH, 0m15s, 45 MPH"; an empty box.' },
  'ice': { alt: 'Navigator points ahead at a sign, driver nods: identify, confirm, execute.' },
  'stopwatch': { alt: 'A digital stopwatch with START/STOP and LAP buttons and a split on the display.' },
  'magic-stop': { alt: 'The ghost stops and leaves in an instant; your car slows down and speeds up around the sign.' },
  'chart-cell': { alt: 'A stop chart: the row for speed in, the column for speed out, the meeting cell circled.' },
  'split-sign': { alt: 'Speed falling from 35 to 30 with the sign at the middle of the ramp.' },
  'mark': { alt: 'Two sign posts lining up from the driver\'s seat: "mark".' },
  'minute-hand': { alt: 'A dash clock at 9:31:56 whose minute hand already points at 32.' },
  'launch': { alt: 'A start sign; the car rolls 3 seconds before its minute and reaches speed on the minute.' },
  'lost': { alt: 'An empty road behind you in the mirror.' },
  'make-up': { alt: 'Speedometer a little over the book speed, a stopwatch counting.' },
  'train': { alt: 'Crossing gates down, a freight train passing, a stopwatch running.' },
  'hourglass': { alt: 'Column B hourglass symbols: full to begin a transit, empty to end it.' },
  'red-green': { alt: 'A green timing checkpoint sign next to a red GREAT RACE STOP board.' },
  'scorecard': { alt: 'A day\'s scorecard: legs, seconds, total, age factor, final score.' },
};

// ------------------------------------------------------------------ the course
export const COURSE: Module[] = [
  {
    id: 'm0', title: 'What is a TSD rally?',
    teaches: 'A race where exact timing wins: the ghost car, hidden checkpoints, points, the Great Race, two seats.',
    controls: [], covers: ['ghost-car'],
    pages: [
      concept('Not a speed race', 'TSD means time, speed, distance. Nobody wins by going fast. A book tells you which roads to take and what speed to drive. A ghost car drives the book perfectly. Your job: stay beside the ghost all day.', [reg('I.A.1'), hb('p1')], 'ghost-car'),
      widget('holdSpeed', { speed: 35, miles: 0.5, goal: 'Slide the speed. Keep your car level with the ghost.' }),
      concept('Checkpoints you cannot see', 'Somewhere along the road, a crew waits by a green sign. Nobody tells you where. Drive past at your speed; they note the second you cross. Every second early or late costs one point. Low score wins. A perfect zero is an Ace.', [reg('V.A.1'), reg('V.E.1')], 'green-sign'),
      widget('whereCheckpoint', { speed: 35, miles: 0.2, goal: 'Tap as the cars reach the green sign.' }),
      concept('The Great Race', 'The Great Race is the big one: nine days of rallying in old cars, about 150 teams, a third of them new. In 2026 it ran Route 66, from Springfield, Illinois to Pasadena, California.', [reg('I.A.3'), vid('2026', '04:44')], 'photos'),
      concept('Three parties', 'The organizers never ride along: they speak to you only through the Course Instructions, the morning\'s book. The navigator, also called the co-driver, reads it and tells the driver what to do. The driver drives, holds the speed and says each call back. You are the navigator.', [hb('p15'), vid('2026', '07:47')], 'two-seats'),
      widget('holdSpeed', { speed: 40, miles: 0.5, goal: 'The book says 40 here. Hold it the way the driver must.' }),
      check('You pass the green sign 4 seconds after the ghost. What do you score?', ['4 points', '0 points', '8 points', '40 points'], 0, 'One point per second off, early or late: 4 seconds is 4 points.'),
    ],
    tryIt: { skills: ['safetyCourse'], kinds: ['checkpoint'], cards: 5, variants: { checkpoint: [0, 3, 6, 9] } },   // PT-16 B16: green signs only (red boards are Module 11)
    youCanNow: 'You can now explain a TSD rally: stay with the ghost and score zero.',
  },
  {
    id: 'm1', title: 'The book and the car',
    teaches: 'Read one line of the book: the little map, the speed column, and which way to go.',
    controls: ['book'], covers: ['griid-cameo', 'markup'],
    pages: [
      concept('One line, five columns', 'The book is a stack of numbered lines, each one thing to do. Column A is a little map. B holds symbols for special parts of the day. C is the speed. D says it in words. Do the lines in order. Reading ahead in the book is the pre-read.', [reg('VII.B.3'), vid('reading', '00:34')], 'griid-row'),
      concept('The little map', 'Column A shows the junction from above. The dot at the bottom is you, arriving. The bold line is your route. The arrow is where you leave. Thin lines are roads you skip.', [hb('appD'), vid('2026', '76:28')], 'cameo'),
      sim('preread', 100, 'book', 'The bold line from the dot to the arrow is the only road that counts. Thin lines are roads you skip.'),
      example('Which way?', ['Bold line bends left: turn left.', 'Bold line goes straight up past thin side roads: go straight.', 'A junction that is not in the book: stay on the main road.'], [reg('VII.C.1')]),
      concept('Column C is the speed', 'Column C prints the speed from this line on, like 40 MPH. You tell the driver that speed at the sign the line names. An empty box means keep the speed you have. Signs and notes on the road can tempt you to call something else.', [hb('appD'), vid('2026', '93:25')], 'column-c'),
      sim('preread', 110, 'book', 'The sign and Column C agree: call the new speed at the sign.', [], { form: 'sign:normal', rounds: [
        { seed: 111, form: 'sign:limit', why: 'Trap: a posted limit is not your speed. Column C is.' },
        { seed: 112, form: 'sign:blank', why: 'Trap: a blank Column C means no change.' },
      ] }),
      sim('preread', 113, 'book', 'Trap: the book quotes only the start of the sign.', [], { form: 'sign:partial', rounds: [
        { seed: 114, form: 'sign:twin', why: 'Trap: only the quoted SPEED LIMIT sign counts.' },
        { seed: 115, form: 'sign:overhead', why: 'Trap: an overhead sign is still the sign.' },
        { seed: 116, form: 'sign:bracket', why: 'Trap: bracketed text is only a note.' },
      ] }),
      check('Column C is empty on this line. What speed do you drive?', ['The posted limit', 'The speed you had', 'Any safe speed', 'The next line\'s speed'], 1, 'An empty Column C means no change: keep the speed you already have.'),
    ],
    tryIt: { skills: ['safetyCourse'], kinds: ['preread'], cards: 5, variants: { preread: [0, 2] } },   // PT-17 N9: which way and what speed (no pause arithmetic before Module 4)
    youCanNow: 'You can now read a line of the book: which way and what speed.',
  },
  {
    id: 'm2', title: 'Calling the driver',
    teaches: 'Tell the driver what is coming, early, in the same words every time; he says it back.',
    controls: ['callTurn', 'distanceBar', 'callSpeed', 'go'], covers: ['protocol'],
    pages: [
      concept('Name the sign first', 'Your head is down in the book; his is up. So first say what to look for: "hard left 25 sign". Whoever spots it says "I see it." The other says "I see it too." Only then say what to do there. That is ICE: identify, confirm, execute.', [vid('croker2', '15:45'), hb('p13')]),
      sim('turn', 201, 'callTurn', 'Call the turn before the turn point, so the driver has time to slow and signal.'),
      concept('He says it back', 'The driver repeats every call: "Left, 35." Use the same words every time. As the car reaches a sign, the driver says "Mark". On a card, a bar shows the sign coming: it empties at the Mark.', [vid('2026', '10:53'), vid('2026', '80:03')], 'mark'),
      sim('speedChange', 202, 'callSpeed', 'Call at the tick, a moment before the driver\'s Mark, then listen for the read-back.', [], { pointer: 'Tap CALL when the bar reaches the CALL tick, just before the driver\'s Mark.' }),
      concept('Always end on GO', 'At a stop, the driver watches traffic, not you. Count the wait out loud and always finish with the word GO. He may forget the number. GO is the only signal to move.', [vid('croker2', '19:57')]),
      sim('pause', 203, 'go', 'The driver may forget the number. He never misses GO.', [], { form: 'straight' }),
      check('When do you call a turn?', ['Before the car reaches it', 'As the car reaches it', 'After the car passes it', 'When the driver asks for it'], 0, 'Call the turn early, so the driver can slow and turn at it.'),
    ],
    tryIt: { skills: ['safetyCourse', 'stayOnTime'], kinds: ['preread', 'turn', 'pause'], cards: 5, forms: { pause: 'straight' }, variants: { preread: [0, 2] } },   // PT-16 B3: no speed changes before Module 5
    youCanNow: 'You can now call a turn, call a speed and send the car on GO.',
  },
  {
    id: 'm3', title: 'The stopwatch',
    teaches: 'Time how long things take: start, stop and lap, and one gap versus the running total.',
    controls: ['watchStartStop', 'watchLap'], covers: ['calibration'],
    pages: [
      concept('The stopwatch measures', 'The stopwatch measures how long something takes: a wait at a stop, a timed stretch, the gap between two signs. Press START on the moment and STOP at the end. Never try to time a gap by staring at a clock.', [hb('p5'), vid('clock', '01:39')]),
      sim('watch', 301, 'watchStartStop', 'Start the watch on the moment itself. A second late there makes every count late.', [], { form: 'lap' }),
      concept('Lap: a snapshot', 'LAP freezes a reading while the watch keeps running. Each reading is a split. The gap since the last sign is the interval. The time since you started is the cumulative. On the morning calibration run the book prints both.', [reg('VII.F.1'), vid('2026', '78:30')]),
      widget('tapLap', { markers: 3, goal: 'Tap LAP as the car passes each marker.' }),
      example('Interval or cumulative?', ['Laps read 1:50, 7:23 and 16:05.', 'Cumulative at the third sign: 16:05.', 'Interval from sign two to three: 16:05 minus 7:23 is 8:42.']),
      sim('watch', 302, 'watchLap', 'A lap is a snapshot. The watch keeps running for the next one.', [], { form: 'lap', pointer: 'Tap START at the first sign, then LAP as the car reaches the second.' }),
      check('Laps read 2:10 and 5:00. How long between the two signs?', ['5:00', '2:50', '7:10', '2:10'], 1, 'The gap between two laps is the later total minus the earlier: 5:00 minus 2:10 is 2:50.'),
    ],
    tryIt: { skills: ['instruments'], kinds: ['watch'], cards: 5, forms: { watch: 'lap' } },   // PT-16 B6: START / LAP at two signs, no lead arithmetic
    youCanNow: 'You can now time a gap, take a split and tell interval from cumulative.',
  },
  {
    id: 'm4', title: 'Stops and pauses',
    teaches: 'A printed pause includes slowing and speeding up; sit only the chart\'s seconds, then say GO.',
    controls: ['chartCell'], covers: ['pause-arithmetic', 'measure-car'],
    pages: [
      concept('The magic car and the chart', 'The book says: stop, pause 15, go. The ghost stops and starts in an instant; your car loses seconds braking and speeding up, so you sit less. Your chart\'s cell for the speeds in and out gives that loss. The handbook shows a sample Packard; this app\'s car is not that Packard and has its own chart.', [hb('p8'), vid('croker2', '21:30')], 'chart-cell'),
      example('Sit = pause minus loss, this app\'s car', [`Printed pause 15; in ${STOP_EXAMPLE[0]!.vIn}, out ${STOP_EXAMPLE[0]!.vOut}, the chart loss is ${(15 - STOP_EXAMPLE[0]!.sit).toFixed(1)}.`, `So sit ${STOP_EXAMPLE[0]!.sit.toFixed(1)} s (15 minus ${(15 - STOP_EXAMPLE[0]!.sit).toFixed(1)}), then say GO.`, ...STOP_EXAMPLE.slice(1).map(x => `In ${x.vIn}, out ${x.vOut}: sit ${x.sit.toFixed(1)}.`)], [hb('p8'), vid('croker2', '22:02')]),
      sim('pause', 401, 'chartCell', 'The cell for speed in and speed out is your wait. The printed 15 is for the ghost.', [], { form: 'straight' }),
      concept('Count from the rock-back', 'Start the watch when the car rocks back to a stop, not before. Count out loud and end on GO. If traffic holds you longer, note how late you left. That is time to make up.', [vid('2026', '121:20'), vid('croker2', '23:32')]),
      sim('pause', 402, 'go', 'Start the count at the rock-back, sit the chart time, then GO.', [], { form: 'straight' }),
      sim('pause', 403, 'chartCell', 'Every stop has its own cell: the speeds in and out change the wait.', [], { form: 'straight' }),
      check('The book says pause 15. What do you sit?', ['The full 15 seconds', 'Half the 15 seconds', 'The chart\'s own seconds', 'No seconds at all'], 2, 'The chart gives its own seconds for a stop; sit those, not the book\'s number.'),
    ],
    tryIt: { skills: ['stayOnTime'], kinds: ['pause'], cards: 5, forms: { pause: 'straight' } },
    youCanNow: 'You can now sit the chart\'s wait at any stop and send the car on GO.',
  },
  {
    id: 'm5', title: 'Speed changes and timed holds',
    teaches: 'Change speed so the change straddles the sign; time a hold from where the ghost leaves.',
    controls: ['callAtMark'], covers: ['timed-leads'],
    pages: [
      concept('Split the sign', 'The ghost changes speed in an instant, right at the sign. Your car needs a few seconds: that is the ramp. So start early and pass the sign halfway through. Going from 35 to 30, cross the sign at 32.5. What you gain before it, you lose after.', [hb('p12'), reg('VII.E.2')], 'split-sign'),
      sim('speedChange', 501, 'distanceBar', 'Call half a ramp before the sign, so the change straddles it.'),
      concept('The lead', 'Half the ramp is your lead: how early you call. Your chart gives it for each pair of speeds, like 1.4 s. The driver\'s Mark is still the sign itself. You call the lead before it, when the bar reaches the CALL tick.', [hb('p12'), vid('2026', '92:24')], 'mark'),
      sim('speedChange', 502, 'callAtMark', 'The Mark is the sign. The call comes one lead earlier, at the tick.'),
      concept('Timed holds', 'Sometimes Column C says: 30 MPH for 0m36s, then 45. Start the watch where the ghost leaves the sign. When the time is nearly up, call the next speed about two seconds early.', [reg('VII.E.2'), vid('2026', '119:47')]),
      sim('watch', 504, 'chartCell', 'The lap at the sign, plus the hold, minus the lead: that is when to call.', [], { pointer: 'Read the lap and the lead, then tap when to call.' }),
      sim('timedStart', 503, 'callAtMark', 'START on Mark at the sign, then CALL a little before the hold runs out.', [], { pointer: 'Tap START on the Mark, then CALL about 2 s before the hold ends.' }),
      check('The speed goes from 40 to 30 at a sign. How fast do you pass the sign?', ['30 mph', '40 mph', '25 mph', '35 mph'], 3, 'Halfway through the change you pass the sign: 40 to 30 is 35 mph at the sign.'),
    ],
    tryIt: { skills: ['stayOnTime', 'instruments'], kinds: ['speedChange', 'timedStart', 'watch'], cards: 5 },
    youCanNow: 'You can now split a speed change at the sign and run a timed hold.',
  },
  {
    id: 'm6', title: 'The clock and starting on time',
    teaches: 'Work out your start minute, read it safely, and launch early by your car\'s start loss.',
    controls: ['clock', 'todStrip', 'launch'], covers: ['which-timer'], unlocks: 'runs',
    pages: [
      concept('Your minute', 'Nobody waves you off. The book prints a base time. Add your starting position in minutes. Base 9:05:00, position 27: you leave at 9:32:00. Times are local: CDT is Central Daylight Time. Your position changes every day.', [reg('VII.B.2'), vid('start', '01:07')]),
      concept('Launch early', 'Your car needs a few seconds to reach speed. The ghost does not. So leave early by your start loss: 9:32:00 minus 3 seconds is 9:31:57. Warn the driver half a minute ahead. Count so the last word lands on the launch second.', [vid('start', '03:41'), hb('p7')], 'launch'),
      sim('restart', 601, 'todStrip', 'Base plus position in minutes. Nobody will tell you if you get it wrong.', [], { variant: 2, pointer: 'Read the time of day, then tap LAUNCH early by the start loss.' }),
      sim('restart', 603, 'launch', 'Leave early by the start loss, so you reach speed exactly on your minute.'),
      concept('The loose minute hand', 'The dash clock\'s second hand is steady. Its minute hand is loose. Near the top of a minute it has already moved on, and you can read the wrong minute. Take the minute from the stopwatch\'s time-of-day mode. Use the clock for the seconds.', [vid('clock', '00:37'), reg('II.H.1')], 'minute-hand'),
      sim('clock', 602, 'clock', 'Near :55 the minute hand runs ahead. The stopwatch\'s time of day settles the minute.'),
      concept('Wait your turn', 'Arrive early and wait back from the start sign. Pull up only when the car ahead has left on its minute. If it just sits there, go around it and leave on yours.', [vid('croker2', '12:36'), vid('classen1', '43:57')]),
      sim('restart', 604, 'book', 'Wait back until the car ahead leaves on its minute; your minute belongs to you alone.', [], { form: 'queue', variant: 0, pointer: 'Read the times, then tap what you do.', rounds: [
        { seed: 605, form: 'queue', variant: 1, why: 'A car that sits past its minute does not hold you: go around and leave on yours.', pointer: 'Read the times, then tap what you do.' },
      ] }),
    ],
    tryIt: { skills: ['startOnTime', 'instruments'], kinds: ['restart', 'clock'], cards: 5 },
    youCanNow: 'You can now leave a start sign on your second. Free runs are open.',
  },
  {
    id: 'm7', title: 'Staying on course',
    teaches: 'Course comes before time: spot the traps, notice you are lost, and get back without heroics.',
    controls: [], covers: ['lost', 'four-s'],
    pages: [
      concept('Course beats time', 'A late stop costs seconds. A wrong turn costs minutes. So staying on the route matters more than perfect times. Always know this line and the next. Tell the driver the next sign to look for before you look down.', [hb('p13'), reg('VII.B.3')]),
      sim('turn', 701, 'callTurn', 'The bold line wins over driveways, look-alike signs and roads that look bigger.'),
      concept('Signs you are lost', 'A speed that does not suit the road. A STOP sign that is not in the book. A long straight with no rally cars. Pull over somewhere safe. The car a minute behind you either shows up, or you are the one off course.', [vid('2026', '113:35'), vid('2024', '119:15')]),
      sim('lost', 702, 'callTurn', 'If the car one minute behind never comes, you are the one off course.', [], { pointer: 'Tap what you tell the driver now.' }),
      concept('Getting back', 'Turn around where it is safe and start the watch. The trip back to the turn is half what you lost: 47 seconds back means about 94 lost. Rejoin about 30 seconds behind a car that is on course. The next checkpoint resets you.', [vid('2026', '94:27'), vid('2024', '121:18')]),
      sim('lost', 703, 'callTurn', 'Time the trip back and double it. Then let the leg go: the next checkpoint starts you fresh.', [], { pointer: 'Tap what you tell the driver now.' }),
      check('The trip back to the missed turn took 47 seconds. About how much did you lose?', ['24 seconds', '47 seconds', '141 seconds', '94 seconds'], 3, 'Back to the turn and out again is the same trip twice: 47 s doubled is 94 s.'),
    ],
    tryIt: { skills: ['safetyCourse', 'recovery'], kinds: ['turn', 'lost'], cards: 5 },
    youCanNow: 'You can now spot a wrong road and get back without speeding.',
  },
  {
    id: 'm8', title: 'Early, late and recovery',
    teaches: 'Win back lost seconds safely: the 10 % and 20 % rules, soon, and never inside a timed hold.',
    controls: ['makeup'], covers: ['recovery'],
    pages: [
      concept('The 10 % rule', 'To win back seconds, drive 10 % over your speed for ten times the seconds you owe. Late 4 seconds at 40: drive 44 for 40 seconds. That gains 6 seconds a minute. Then go back to 40. Never go over the posted limit.', [hb('p10'), vid('makeup', '01:03')]),
      sim('makeup', 801, 'makeup', 'Ten percent over for ten times the seconds owed, then back to the book speed.'),
      example('Two make-ups', ['Late 5 s at 30: drive 33 for 50 s.', 'Late 8 s at 40, a big chunk: 20 % over is 48 for 40 s.', '20 % over gains 12 s a minute.'], [vid('makeup', '01:03')]),
      concept('When not to', 'Never speed up inside a timed hold you are running on the watch. It ruins the count. At the next speed sign, drop the extra and settle first. A stop can help: leave after 1 second of a 10 second wait and you gain 9. Still stop fully at a STOP sign.', [vid('makeup', '05:11'), vid('makeup', '04:41')]),
      sim('makeup', 802, 'makeup', 'Hold the timed speed exactly. Make the time up before or after the hold.'),
      concept('Do it soon', 'Make up a loss as soon as it is safe. You never know where the next checkpoint is. Once you cross one, you are back on time, and the old error stays with the old leg.', [hb('p15'), hb('p13')]),
      sim('makeup', 803, 'makeup', 'Fix it now. A checkpoint may be around the next bend.'),
      check('You are 6 seconds late at 30 mph. What do you drive?', ['33 mph for 60 s', '36 mph for 60 s', '33 for only 6 s', 'Keep 30, do nothing'], 0, '10 percent faster for 60 s earns back about 6 s: 30 mph plus 10 percent is 33.'),
    ],
    tryIt: { skills: ['recovery'], kinds: ['makeup'], cards: 5 },
    youCanNow: 'You can now win back seconds safely, and know when to leave them.',
  },
  {
    id: 'm9', title: 'Delays and time allowances',
    teaches: 'Claim time only for delays beyond your control: measure, make up what you can, claim in 10 s steps.',
    controls: ['taCard'], covers: [],
    pages: [
      concept('What counts', 'A train, a school bus, a farm tractor you cannot pass, road work holding traffic, helping at an accident: these are beyond your control. A flat tire, a wrong turn or a truck you can pass are not. The rules list only examples; this app also counts a red light as yours to make up.', [reg('V.H.1'), vid('delay', '00:04')]),
      sim('hazard', 901, 'taCard', 'Only a delay you could not avoid or pass earns time. Everything else you make up.'),
      concept('Measure it', 'When the car stops, start the watch. Stop it when you roll again. Add your chart\'s stop-and-go loss for that speed. That is the delay.', [vid('delay', '01:38')]),
      example('Make it a round number', ['Delayed 3m47s.', 'Make up the 7 odd seconds yourself.', 'Claim 3m40s: claims go in 10 s steps.', 'Say what held you, what you made up, what you ask.'], [reg('V.H.3')]),
      sim('ta', 902, 'taCard', 'Claim whole 10 s steps of what you could not make up. Odd amounts get rounded, maybe against you.'),
      concept('Where to claim', 'The book prints a place to claim, usually at lunch and at the finish. Within 15 minutes, fill in the web form: car, leg, the line numbers, the time, what happened. The leg number is checkpoints passed plus one.', [vid('2026', '110:28'), reg('V.H.3')]),
      sim('ta', 903, 'taCard', 'Leg is checkpoints passed plus one. The line numbers are what the committee checks.', [], { form: 'taLeg', pointer: 'Count the checkpoints passed, then tap the leg.' }),
      check('A slow truck held you 30 seconds, then you passed it. What now?', ['Claim the 30 seconds', 'Claim 20 of the seconds', 'Forget the 30 seconds', 'Make the 30 seconds up'], 3, 'Only a delay beyond your control counts, and the claim is the seconds it cost: all 30.'),
    ],
    tryIt: { skills: ['recovery'], kinds: ['hazard', 'ta'], cards: 5 },
    youCanNow: 'You can now tell a real delay from your own and claim it properly.',
  },
  {
    id: 'm10', title: 'Transits, lunch and restarts',
    teaches: 'Untimed stretches: reach the next restart on time, work out exact OUT times, and queue properly.',
    controls: ['holdCard'], covers: ['transits'],
    pages: [
      concept('Transits', 'A transit is a stretch with no checkpoints and no set speed. Times in brackets are only a guide. Fuel, rest stops and lunch happen inside transits. The point is to reach the next restart sign in time.', [hb('p11'), reg('VII.B.3')]),
      concept('Exact transits', 'Some transits say: take exactly 20 minutes. Write the time you pass the IN sign. Add the interval. IN 2:41:20 plus 20 minutes is OUT 3:01:20. Leave then, early by your start loss.', [hb('p11'), vid('croker2', '30:45')]),
      sim('transitOut', 1001, 'holdCard', 'In a transit you only owe the restart: be there early, and leave on the second.'),
      sim('transitOut', 1002, 'holdCard', 'IN plus the interval is OUT. Write it down before you get out of the car.'),
      concept('Lunch', 'Lunch sits inside a transit. The book says: leave 45 minutes before your end-of-transit time. Restart 2:55:00, position 12: your restart is 3:07:00. So you leave lunch at 2:22:00.', [hb('appD'), vid('classen1', '25:21')]),
      example('The queue', ['After an exact transit, cars are no longer a minute apart.', 'Two or three may share one minute.', 'Wait back, watch the car ahead go, then pull up.'], [vid('croker2', '32:58')]),
      sim('restart', 1003, 'launch', 'Pull up only after the car ahead has gone, then launch early by your start loss.'),
      check('You pass the IN sign at 10:14:30. Take exactly 25 minutes. When do you leave?', ['10:40:30', '10:39:00', '10:39:30', '10:14:55'], 2, 'Add the time you must take to the IN time: 10:14:30 plus 25 minutes is 10:39:30.'),
    ],
    tryIt: { skills: ['startOnTime'], kinds: ['transitOut', 'restart'], cards: 5 },
    youCanNow: 'You can now get through a transit and lunch and restart on time.',
  },
  {
    id: 'm11', title: 'Checkpoints and scoring',
    teaches: 'Green and red signs, never crawling near green, caps, missed checkpoints and the age factor.',
    controls: [], covers: [],
    pages: [
      concept('Green and red', 'A green sign is a timing checkpoint. The least you do there is nothing: drive past at your speed. A red GREAT RACE STOP board is different. Stop and talk to the crew.', [reg('V.A.1'), vid('classen1', '05:39')]),
      sim('checkpoint', 1101, 'callSpeed', 'Green: keep your speed. Red: stop and have your book signed.', [], { pointer: 'Tap what you do at the sign.' }),
      concept('Never crawl near green', 'Never stop, or drive 5 mph or slower, where you can see a green sign. That costs 30 seconds. Need to stop and think? Do it out of sight.', [reg('V.E.3'), vid('croker2', '35:33')]),
      sim('checkpoint', 1102, 'callSpeed', 'Within sight of green, 5 mph or slower is a penalty, even when you are early.', [], { pointer: 'Tap what you do at the sign.' }),
      concept('Caps and misses', 'Each second off is a point, but a late leg stops counting at 2 minutes and an early one at 5. Missing a checkpoint costs 3 minutes. More than 30 minutes late counts as missing it.', [reg('V.E.1'), reg('V.E.2')]),
      concept('Old cars get a discount', 'At the end of the day your points are added up and multiplied by your car\'s age factor. A 1954 or newer car keeps them all. A 1939 car multiplies by 0.845. Older cars get more help.', [reg('V.D')]),
      widget('readScorecard', { ask: 'total', goal: 'Find the day\'s score after the age factor.' }),
      check('You reach a checkpoint 3 minutes late. How many points?', ['3 points', '120 points', '180 points', '300 points'], 1, '3 minutes is 180 seconds, but a late checkpoint costs at most 120 points.'),
    ],
    tryIt: { skills: ['safetyCourse', 'stayOnTime'], kinds: ['checkpoint'], cards: 5 },
    youCanNow: 'You can now pass any checkpoint safely and read your scorecard.',
  },
  {
    id: 'm12', title: 'Your first full run',
    teaches: 'Put it together: what a run is, the daily set, your meters, the Boss and Desk mode.',
    controls: ['desk'], covers: ['rally-school'], unlocks: 'desk',
    pages: [
      concept('What a run is', 'A run is a string of moments from a real day: read, call, count, launch. Each card is one moment. Answer, see the verdict, move on. A few minutes is plenty.', [hb('p13')]),
      sim('preread', 1201, 'book', 'Every run starts with the book. Read the line before the moment arrives.'),
      concept('Your meters', 'Five meters track you: safety and course, starting on time, staying on time, recovery, instruments. The lowest one is what to practise next. The daily set is a short mixed run, new each day.'),
      sim('pause', 1202, 'chartCell', 'Mixed runs jump between skills. Each card still has one correct move.', [], { form: 'straight' }),
      concept('The Boss and Desk mode', 'The Boss is a long run with every kind of card. Desk mode opens when you finish this module: the full cockpit on a big screen, a whole day with the book, road, clock and watch at once.'),
      sim('timedStart', 1203, 'callAtMark', 'The Boss mixes everything. Same rules, faster pace.', [], { pointer: 'Tap START on the Mark, then CALL about 2 s before the hold ends.' }),
      check('Which meter do you practise next?', ['The lowest one', 'The highest one', 'The newest one', 'The oldest one'], 0, 'Practise the lowest meter: that is where the next gain is.'),
    ],
    tryIt: { skills: ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'], kinds: ['preread', 'turn', 'pause', 'speedChange', 'restart'], cards: 5, forms: { pause: 'straight' } },
    youCanNow: 'You can now run a full day. Desk mode is open.',
  },
];

/** PT-17 N9: words that belong to a module: no page, pointer or verdict before that module may use them (99 = no module teaches it, so
 *  the School never shows it). Tested over every page, pointer, card prompt and verdict of the modules before. */
export const TERM_MODULE: Readonly<Record<string, number>> = { 'half a ramp': 5, 'Dec(': 99, 'Acc(': 99, 'chrono': 99, 'pre-read': 1 };
/** PT-17 N9: a kind's verdict rule as a module before `before` says it (that module has not taught the words of the full rule yet). */
export const EARLY_RULE: Partial<Record<DecisionKind, { before: number; text: string }>> = {
  speedChange: { before: 5, text: 'Call at the CALL tick, a moment before the driver\'s Mark, so the speed changes as the car reaches the sign.' },
  pause: { before: 4, text: 'Sit the seconds the card gives, counting out loud, then say GO: the driver moves only on GO.' },
};
/** The verdict rule a mini-sim or try-it card shows in module `moduleIndex` (SCH-036). */
export function moduleRule(rule: string, kind: DecisionKind, moduleIndex: number): string {
  const e = EARLY_RULE[kind]; return e && moduleIndex >= 0 && moduleIndex < e.before ? e.text : rule;
}

/** SCH-010: the line a brand-new visitor sees above Module 0. */
export const FIRST_VISIT = {
  title: 'What is this?',
  text: 'A free trainer for time-speed-distance rallies like the Great Race, one short page at a time.',
  /** the same line with its heading, as one string (what src/ui/school2/sources.ts reads) */
  line: 'What is this? A free trainer for time-speed-distance rallies like the Great Race, one short page at a time.',
  start: 'Start Module 0',
} as const;

// ------------------------------------------------------------------ helpers (pure)
/** Every word a page shows (titles, text, lines, question and options, the why line, the widget goal). */
export const pageText = (p: Page): string => {
  switch (p.kind) {
    case 'concept': return `${p.title} ${p.words}`;
    case 'example': return `${p.title} ${p.lines.join(' ')}`;
    case 'minisim': return p.why;
    case 'widget': return p.params.goal ?? '';
    case 'check': return `${p.question} ${p.options.join(' ')}`;
  }
};
export const pageWords = (p: Page): number => words(pageText(p));
export const moduleWords = (m: Module): number => m.pages.reduce((a, p) => a + pageWords(p), 0) + words(m.teaches) + words(m.youCanNow);
export const isInteraction = (p: Page): boolean => p.kind === 'minisim' || p.kind === 'widget' || p.kind === 'check';
/** The module that introduces a control (index into COURSE), or -1. */
export const controlModule = (c: ControlId): number => COURSE.findIndex(m => m.controls.includes(c));
/** The controls taught by modules 0..i. */
export const controlsThrough = (i: number): ControlId[] => COURSE.slice(0, i + 1).flatMap(m => m.controls);
/** The newest control a guided run points at after module i (undefined when module i adds none). */
export const newestControl = (i: number): ControlId | undefined => COURSE[i]?.controls.at(-1);
export const allRefs = (): Ref[] => COURSE.flatMap(m => m.pages.flatMap(p => p.refs));
/** The module that covers an old lesson id (SCH-008 redirect #/school/<old id>). */
export const moduleForLesson = (lessonId: string): Module | undefined => COURSE.find(m => m.covers?.includes(lessonId));
/** Core modules (0..6) unlock unguided runs; the last module unlocks Desk mode. */
export const CORE_MODULES = COURSE.slice(0, COURSE.findIndex(m => m.unlocks === 'runs') + 1).map(m => m.id);
export { CONTROL_IDS };

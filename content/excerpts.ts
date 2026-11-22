/**
 * SCH-002: the reference excerpts behind the School's chips. A chip ("HB p.8", "REG V.H.3", "Video 2026 110:28") opens
 * one of these in a bottom sheet; nothing here is pasted into a page. Texts are short (<= 120 words) and faithful to the
 * extractions in docs/research: words in quote marks are verbatim from the document or the auto-captions (captions are
 * a machine transcript, good to about 30 seconds, and occasionally mangle numbers); the rest is a close paraphrase.
 * Keys: 'hb:p8' (Rookie Handbook printed page), 'reg:V.H.3' (2026 Event Regulations rule), 'video:2026:110:28'
 * (video key from content/videos.ts, then the caption time mm:ss).
 */
import { videoByKey, mmssToSeconds, type VideoKey } from './videos.js';

export interface Excerpt {
  key: string;
  title: string;
  text: string;
  citation: string;
  /** where the extraction lives in this repository (maintainers only; never shown) */
  source?: string;
  video?: { key: VideoKey; seconds: number };
  /** flat copies of video.key / video.seconds for readers that expect them at the top level */
  videoKey?: VideoKey;
  seconds?: number;
}

const HB_CITE = 'Rookie Handbook, "Preparing for the Great Race" (Croker, rev. Sept 2015)';
const REG_CITE = '2026 Hemmings Great Race Event Regulations';

// PT-16 B22: the citation a reader sees names the document and the page, rule or time only; where the extraction lives in this repo
// (`source`) is kept for maintainers and never shown.
const hb = (page: string, printed: string, title: string, text: string, section: string): Excerpt =>
  ({ key: `hb:${page}`, title, text, citation: `${HB_CITE}, ${printed}`, source: `docs/research/${section}` });
const reg = (rule: string, title: string, text: string, section: string): Excerpt =>
  ({ key: `reg:${rule}`, title, text, citation: `${REG_CITE}, ${rule}`, source: `docs/research/09-event-regulations-2026.md ${section}` });
const vid = (key: VideoKey, at: string, title: string, text: string, analysis: string): Excerpt => {
  const v = videoByKey(key);
  return { key: `video:${key}:${at}`, title, text, citation: `"${v?.title ?? key}" at ${at} (from the video's auto-captions)`, source: `docs/research/${analysis}`, video: { key, seconds: mmssToSeconds(at) }, videoKey: key, seconds: mmssToSeconds(at) };
};

const LIST: Excerpt[] = [
  // ------------------------------------------------------------------ Rookie Handbook
  hb('p1', 'p.1', 'What the event is',
    'The handbook calls the Great Race "a timed, navigation, controlled speed, endurance race" on public roads, with all speeds at or below the limits. The objective is to match the precise time allowed for each section, using Course Instructions issued each morning. "It is not difficult. However, excellent scores require skill on the part of both the driver and navigator."',
    '08-rookie-handbook-body.md §1'),
  hb('p5', 'p.5', 'Clock and stopwatch',
    'Analog clock: mount it on the dash or lapboard where both of you can read it; many teams use a Sawtooth Rally Clock with every second numbered. Stopwatch: "A good digital stopwatch is a necessity for accurate rallying. Be sure to get one that has a lap-split function and a time-of-day function." Wear it on a lanyard or fix it to the lapboard.',
    '08-rookie-handbook-body.md §2'),
  hb('p7', 'p.7-9', 'Charts show net time lost',
    'The three calibration charts are IN speed rows by OUT speed columns, in net seconds lost. "The times on this chart are NOT the actual acceleration and deceleration times. The chart shows the NET time lost." Example for the sample 1936 Packard: from a stop to 40 mph loses 4.5 s, so either start 4.5 s before the instructed time or make it up after.',
    '08-rookie-handbook-body.md §3a'),
  hb('p8', 'p.8', 'Stop and go: sit the chart time',
    'Instructions "usually say stop at the sign, pause for 15 seconds, and proceed at the assigned speed"; replace the 15 s with the chart value for your IN and OUT speeds. Sample Packard: 30 in, 40 out = 8.6 s. "Always check the course instructions carefully since sometimes the instructed pause time may be different than 15 seconds." If traffic holds you past the planned pause, make up the difference.',
    '08-rookie-handbook-body.md §3b'),
  hb('p10', 'p.10', 'The ten per cent rule',
    'Ten per cent rule: drive 10 % above the instructed speed for 10 times the seconds lost. Examples: 38.5 mph for 40 s makes up 4 s at 35 mph; 44 mph for 44 s makes up 4.4 s at 40 mph. It works the other way too: 10 % below the speed for 10 times the seconds to lose time.',
    '08-rookie-handbook-body.md §4'),
  hb('p11', 'p.11-12', 'Transits and exact transits',
    'Transit zones (hourglass full = begin, empty = end) are untimed; the printed time is a guide so you arrive at the next time-of-day restart on time. Lunch, pit, fuel and rest stops happen inside transits. A transit after a time-of-day restart "must be executed exactly": record the time of day you pass the IN sign, add the printed transit time, write it as your OUT time, arrive a few minutes early and depart exactly then at the assigned speed.',
    '08-rookie-handbook-body.md §5'),
  hb('p12', 'p.12', 'Split the speed change at the sign',
    'Speed changes: "split the speed change at the sign": cross the sign at the midpoint speed (35 to 30: cross at 32.5 and keep slowing). The gain and the loss cancel. Turns: slow to the chart\'s apex speed, turn, accelerate to the indicated speed, then make up the chart loss with the 10 % rule as soon as practical.',
    '08-rookie-handbook-body.md §5'),
  hb('p13', 'p.13-14', "The Four S's",
    'Safety first, Start on time, Stay on course, Stay on time. Nobody tells you when to start. Staying on course is "much more important than trying to maintain perfect times"; a wrong or missed turn usually costs several minutes. "You are automatically on time the instant you reach a checkpoint. At a checkpoint the previous leg is complete with whatever errors were incurred and the next leg begins with no penalty."',
    '08-rookie-handbook-body.md §6'),
  hb('p15', 'p.15', 'Driver and navigator tips',
    'Use the same words every time for a road sign. Errors are team errors. In timed sections talk only about the instructions. The driver repeats the instruction he hears: after several lefts it is easy to hear "left" for "right". Cross off each instruction when done. At restarts do not pull up until it is your minute. Make up losses as soon as it is safe: you do not know where the next checkpoint is.',
    '08-rookie-handbook-body.md §7'),
  hb('appD', 'Appendix D (p.25-30)', 'Reading the instruction rows',
    'Column A, the CAMEO: a dot at the bottom (you), a bold arrow for the route, thin lines for other roads, signs drawn as boxes with their text. Column C: speeds and times stacked one per line, "40 MPH"; a pause reads "0 MPH / 0m15s / 45 MPH". A railroad crossing with no speed: "Continue previous average speed ... since no speed is given." Lunch (#21) is left 45 minutes before the end of its transit.',
    '08-rookie-handbook-body.md §8'),

  // ------------------------------------------------------------------ 2026 Event Regulations
  reg('I.A.1', 'Nature of the event',
    '"The Events are timed, controlled-speed, endurance rallies---not top-speed races. Each vehicle must follow a prescribed common route while attempting to maintain assigned average speeds." They are "automotive competitions based on precision driving and navigational skills in classic, antique, and vintage automobiles."',
    '§1'),
  reg('I.A.3', 'The 2026 Great Race',
    '"GREAT RACE is June 20 to June 28, 2026, from Springfield, Illinois to Pasadena, California, an official Route 66 Centennial activity." The competition is the optional Trophy Run (Stage 0) on June 19, followed by 9 Stages: Stages 1 to 7 qualify, Stages 8 and 9 are a two-Stage Championship Run.',
    '§1'),
  reg('II.H.1', 'Timepieces allowed',
    'One analog clock is "the primary timepiece"; it "must not have stopwatch, compensating, calculating, or split-action functions, or digital readout." Driver and navigator may each wear one analog wristwatch without stopwatch function. "Each Team may have one approved digital or analog stopwatch; the stopwatch may also have split-action, time-of-day, date, and alarm functions." Self-setting radio or GPS clocks are prohibited.',
    '§5'),
  reg('V.A.1', 'Timing and observation checkpoints',
    '"You will usually not be told in advance the location of Checkpoints." A Timing Checkpoint is identified by "a green Day-Glo Timing Checkpoint sign"; "Do not stop at a Timing Checkpoint. As you cross the timing line, the previous leg ends and the next leg begins." An Observation Checkpoint has a red sign: "You must stop at an Observation Checkpoint and have your Course Instructions endorsed".',
    '§9'),
  reg('V.D', 'Age factor',
    '"To make older vehicles more competitive with the mechanically improved vehicles of newer years," each Stage score is multiplied by the car\'s Age Factor and rounded to 0.01 s (V.C.2.e). From the table: 1954 and newer 1.000; 1953 0.915; 1939 0.845; 1930 0.800; 1900 0.500. The lowest total score wins the Stage.',
    '§11.2, §12'),
  reg('V.E.1', 'One point per second, with caps',
    '"Each second early or late at a Timing Checkpoint compared to the computed perfect time ... 1 second." "Maximum late penalty ... 2 Minutes." "Maximum early penalty ... 5 Minutes." A perfect leg scores zero, an Ace (I.F.5.d).',
    '§13.1'),
  reg('V.E.2', 'Missed checkpoints',
    '"Missing a Timing Checkpoint, except the final Timing Checkpoint of a Stage ... 3 Minutes"; missing the final one is DNF or FNS. A vehicle arriving "more than 30 minutes after the computed cumulative perfect time from the most recent Stage Start or Restart" is scored as having missed the Checkpoint (V.C.2.b).',
    '§11.2, §13.2'),
  reg('V.E.3', 'Other penalties',
    '"Stopping or traveling 5 MPH or slower within sight of a Timing Checkpoint ... 30 Seconds." "Failure to stop at a Stop Sign ... DNF." Dangerous or reckless driving, "which may include speeding", is disqualification (V.F.1.c).',
    '§13.3, §13.4'),
  reg('V.H.1', 'What earns a time allowance',
    '"If you are delayed on the instructed route by circumstances beyond your control, such as blockage of the route by a train or need to assist at the scene of an accident, you may request time allowance". "Mechanical failure (flat tire or other vehicle failures), lack of vehicle capability (inability to maintain assigned speed), and personal failure are not grounds for Time Allowance Requests."',
    '§14'),
  reg('V.H.3', 'How to request time',
    'A request gives the Stage, car number, leg number, the Course Instruction numbers where the delay occurred and a brief description. "The time allowance requested may be any amount of time in multiples of 10 seconds (e.g., 0m10s, 0m20s, 4m50s)". V.H.5: "we expect you to attempt to make up the time"; give information such as "Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s."',
    '§14'),
  reg('VII.B.2', 'Your official start time',
    'Course Instructions are available "exactly 30 minutes before the official time for the Team to start the Stage." "Each Team\'s official starting time is determined by adding their starting position ... in minutes to the official Stage start time." Example Rally #1: "Leave here at 8:00:00 plus your assigned start position in minutes".',
    '§7.1, §7.2'),
  reg('VII.B.3', 'Using the instructions',
    '"You must complete each instruction before you can consider the next instruction for execution." "It is recommended that you always be aware of at least the next two instructions". The CAMEO shows the approach road "with a dot", the exit "with an arrow"; "The route ... is represented by a bold line from the dot to the arrow. Thin line(s) ... represent road(s) not taken." "Interval times in parentheses are advisory, but not official".',
    '§8.1'),
  reg('VII.C.1', 'Following the route',
    '"At each intersection, you will execute the active instruction if it applies. If no instruction applies at an intersection, you will continue on the obvious principal road. Do not take an exit from an interstate highway or limited-access highway without an instruction."',
    '§8.2'),
  reg('VII.E.2', 'Where speed changes happen',
    'A speed change at a sign or landmark "is executed when the front tires of the vehicle passes (comes even with) the sign or landmark". At an intersection with no referenced sign it occurs "at the center of the intersection or the apex of the turn". "Timed speed changes occur after the time interval specified in Column C has elapsed."',
    '§8.4'),
  reg('VII.F.1', 'Interval and cumulative times',
    'On Speedometer Calibration Runs Column C shows two official times in a box: "The first time will be the interval time to the instruction from the previous instruction for which a time was given; the second time will be the cumulative official speedometer calibration time to that point". Example: "8m40.7s / 16m02.0s".',
    '§8.5'),

  // ------------------------------------------------------------------ Videos (auto-captions)
  vid('2026', '04:44', 'Have fun, stay on course, then be on time',
    'Brad\'s priorities, in order: have fun and make friends; try not to get lost ("if you follow the instructions, even if you\'re not exactly on time, you\'re gonna get there"); third, be "dead nuts on time". About 150 teams, one third of them rookies.', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '07:47', 'Why drivers seem forgetful',
    '"People will say that drivers are stupid. It\'s just that 85% of your concentration is on that speedometer." Mount the speedometer high. The navigator has the brain power for the course; the driver holds the speed.', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '10:53', 'The read-back loop',
    'The navigator states the speed, the driver repeats it, and from time to time says "okay, I\'m holding 35"; the navigator confirms, and keeps telling the driver the speed when he asks.', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '76:28', 'You are the dark arrow',
    'On the instruction diagrams you are the dark arrow; the light lines are roads you do not take. It is not a trick rally: "everything is as clear as they can make it".', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '78:30', 'Interval and cumulative on the calibration run',
    'The calibration instructions print the interval and the cumulative time (example "elapsed time 7 minutes 19.7 seconds"). Record your split in Column D: "I\'m not trying to match that; I\'m comparing it to the optimal time."', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '80:03', 'The driver says mark',
    'The driver helps by turning his head to the sign and saying "mark" when the two posts of the sign are parallel; for overhead signs use the bridge abutment. It is especially helpful for signs on the left.', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '92:24', 'Splitting a sign',
    'Steve on splitting a sign: do not wait until you are abeam the sign; "start the speed change before you get there" and "hit that sign right about the middle of your speed change". Doing 30 and going down to 20, be at 25 abeam the sign; it works going up and going down.', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '93:25', 'A blank box keeps the speed',
    'A blank Column C box is a sign where you do not change speed: write the previous speed in it. Write the speed from the bottom of each page at the top of the next: "they don\'t remember what speed you told them".', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '94:27', 'Missed the turn: time the way back',
    'Visual clues help: power lines, traffic turning the other way; driveways trick you. If you pass the turn, turn around when safe and hit the stopwatch when you start back: "that\'s half the time you\'ve lost; double that."', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '110:28', 'The 2026 time allowance web form',
    'The instructions contain a box: within 15 minutes go to the time allowance page. Enter the car number, "a four-digit password" and the phone number, then each allowance (example: leg 3 between instructions 44 and 45, stopped 3 min 40 s by a train). Twice a day, at lunch and at the end of the day; at day end click the red box, done, "you may now print my scorecard".', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '113:35', 'Signs that you are lost',
    'Lost indicators: a speed that does not suit the road; a stop sign not on your instruction; a long straight with no cars. Pull over; the car a minute behind arrives or not. "If the speed limit says 30 and they\'ve got you at 50, you know you\'re wrong."', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '119:47', 'Call a timed change a little early',
    '"If it says to hold 20 for a minute and 12 seconds then go to 35, I usually back up about 2 seconds beforehand and say go to 35 now; it\'ll be at 1 minute 10 instead of 1 minute 12". Janet counts "3, 2, 1" to cover reaction time, "splitting the sign virtually".', '10a-training-sessions-2024-2026.md B2'),
  vid('2026', '121:20', 'The stop count',
    'The navigator counts the stop: "coming in at 20, out-speed 35, holding for nine; rock back, 9 8 7 6 5 4 3 2 1 go 35." The driver looks at cross traffic while she counts; if he says "keep counting" she goes on, 3 2 1 0 1 2, until he goes.', '10a-training-sessions-2024-2026.md B2'),
  vid('2024', '119:15', 'The car behind is your clock',
    'Lost: the speed does not match the road, an unexpected stop sign, or no cars behind. Pull over where safe; the car one minute behind either shows up or you are off course. Compare with the order of start: if the next car is 10 minutes behind, you are 10 minutes late.', '10a-training-sessions-2024-2026.md A2'),
  vid('2024', '121:18', 'Write the leg off and rejoin',
    'Ten minutes is not makeable at 45-50 mph: write the leg off, insert yourself 30 seconds behind a car that is on course, lose that leg at the checkpoint, then run the next leg. The checkpoint resets you: a blown leg is a lost leg, the next leg starts clean.', '10a-training-sessions-2024-2026.md A2'),
  vid('classen1', '05:39', 'Green means go',
    'John Classen, Director of Competition: a red sign means stop, "you need to stop and talk to the worker". A green sign is a timing checkpoint: "Green means go; the minimum that you need to do at a green sign is nothing". The organizers do the timing and the scoring.', '10b-rally-school-classen-croker.md A3'),
  vid('classen1', '25:21', 'Leaving lunch',
    'Lunch departure, 45 minutes for lunch that day: "you can leave earlier than your official start time here without penalty ... but don\'t leave too early or you\'ll just be sitting out in" the field waiting for the restart.', '10b-rally-school-classen-croker.md A4'),
  vid('classen1', '43:57', 'Leave on your minute',
    'Asked whether to leave on time even if the car ahead is not there: "yes leave at your time, but ... wait till it\'s your minute to pull up". "Don\'t pull up to that sign until it\'s your minute, because the car that\'s a minute ahead of you will want to pull up and leave there exactly on his minute."', '10b-rally-school-classen-croker.md A5'),
  vid('croker2', '12:36', 'Waiting at the restart',
    'Bill Croker: you arrive early and "probably there\'ll be 10 to 20 cars sitting there; find a safe place to wait away from the action". Watch the others go; after the car in front of you has left, it is your minute: pull up to the start position and wait for your exact time.', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '15:45', 'ICE: identify, confirm, execute',
    'The navigator says what to look for ("hard left 25"); as signs appear, one says "that\'s it, I see it" and the other "I see it too" (confirm); then the navigator gives the action at that sign ("at that hard left 25 you\'re going to change speeds to 20"). After the sign the driver announces the speed he is holding.', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '19:57', 'The last word is always GO',
    'The driver stops, the navigator starts the stopwatch and says "we\'re going to turn left on 8 seconds", then counts "4, 5, 6, 7, GO": "the last word is always GO because the driver forgot when he was supposed to go even though he heard it four seconds earlier; he\'s watching traffic".', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '21:30', 'No car stops instantly',
    'The printed 15-second stop-sign pause assumes instantaneous stopping and starting; no car, not even a Corvette or a 426 Hemi Plymouth, can do that, "so you need to stop for less time".', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '22:02', 'Use the chart, round the seconds',
    'Use the stop chart in the Rookie Handbook: read the IN speed, go across to the OUT speed; it says for example 8.6 s instead of 15. "You\'re probably not going to be able to handle tenths of a second; round off to the nearest whole second." No chart of your own? Drive "like a \'36 Packard" and use the handbook\'s.', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '23:32', 'Held up at a stop',
    'If oncoming traffic holds the driver, let the watch run, stop it when he goes and subtract the planned pause: chart 8 s, held 15 s, you are 7 s behind; make that up. If he leaves early, at 6 instead of 8, you are 2 s fast and must lose it.', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '30:45', 'Write the OUT time first',
    'At the start of a transit, write down the time of day as you cross the IN sign; beforehand write a blank and "+25" in Column D. Add the two and immediately transfer the sum to the end-of-transit line. "Don\'t get out of the car until you know that departure time."', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '32:58', 'After a transit, cars bunch up',
    '"When you get to line 45 and you\'ve got your time to go, the cars will no longer be a minute apart. You may be perfect but the car in front of you and behind you will not be". At the start point "you may not have a full minute; there may be two or three of you trying to leave" in the same minute.', '10b-rally-school-classen-croker.md B2'),
  vid('croker2', '35:33', 'Never slow near a green sign',
    '"You cannot stop within sight of a green checkpoint; in fact you cannot go slower than five miles an hour."', '10b-rally-school-classen-croker.md B2'),
  vid('clock', '00:37', 'The loose minute hand',
    'Jeff Stumb on the Sawtooth clock: "It has a very consistent second hand. But it has a rather loose minute hand and it\'s quite easy to make a 1 minute mistake with the clock." "Some people use the watch only for the second hand, to see the seconds pass, but they don\'t use it to see the time of day."', '10c-short-videos.md §1'),
  vid('clock', '01:39', 'What the stopwatch is for',
    'Near the top of the minute, "when the second hand is in the 55 or 56 second range ... the minute hand has already moved to the next minute". The stopwatch does the timed jobs: "many maneuvers in this race will require the stopwatch to make you perform a specific maneuver for 25 seconds, maybe a minute and a half, maybe 6 or 7 minutes".', '10c-short-videos.md §1'),
  vid('start', '01:07', 'Base plus position',
    'The scored start is "a sign that is designated as the starting location for every car for that day"; "if the start time at that sign is 9:05 and we\'re car number 27 then our start time at that sign becomes 9:32 ... 9:05 plus 27 positions which is 27 minutes". (He means start position 27: the position is drawn each day.)', '10c-short-videos.md §2'),
  vid('start', '03:41', 'Launch early by the start loss',
    'Start time 9:32, start loss 3 s, "so we\'re going to start at that sign 3 seconds early ... 9:31 and 57 seconds". When the car in front leaves, pull up to the sign. Warn the driver about half a minute before and count down so "that countdown should finish at 9:31 and 57 seconds so that you\'re already going and at speed and on time".', '10c-short-videos.md §2'),
  vid('delay', '00:04', 'Delays happen',
    '"inevitably on the Great Race you\'re going to get stopped at some point in the 2400 miles in nine days by a train, a tractor, possibly a school bus or construction". "Don\'t panic"; first stop the vehicle and start your stopwatch.', '10c-short-videos.md §3'),
  vid('delay', '01:38', 'Measuring a delay',
    'Start the stopwatch when the vehicle stops and stop it when it starts moving, then "add back in the stop and go time" from your performance chart. "3 minutes and 47 seconds is not a multiple of 10 seconds so first thing you want to do is make up 7 seconds to get time delay down to 3 minutes and 40 seconds".', '10c-short-videos.md §3'),
  vid('makeup', '01:03', 'Six seconds a minute',
    '"if I go 10 % over the prescribed speed for every ten seconds I can make up one second ... so in a minute at ten percent over I can make up six seconds". 40 becomes 44, 35 becomes 38.5. In a big chunk "you may choose to do 20 % over ... now you\'re making up 12 seconds for every minute".', '10c-short-videos.md §4'),
  vid('makeup', '04:41', 'A stop is a place to recover',
    '"A lot of veterans don\'t like to do this because they\'re afraid of a checkpoint ... if you\'re doing 40 and you\'re going to stop at that stop sign for 10 seconds and you stop for one you\'ve made up nine seconds right there".', '10c-short-videos.md §4'),
  vid('makeup', '05:11', 'Not inside a timed interval',
    '"Do not try to make up time in a timed interval. If you\'re doing a certain speed and it tells you to do 30 miles an hour for seven minutes and you\'re using the stopwatch to do that, do not make up time during that time, it will mess up what you\'re already doing."', '10c-short-videos.md §4'),
  vid('reading', '00:34', 'Numbers down the side, A to D across',
    'Jeff Stumb walks through a sample sheet: instruction numbers down the side, columns A, B, C and D across the top. "Obviously the most important instruction out of the columns is column A". Column D gives "hints to what\'s going to happen". Later [03:41]: "notice the little dot and the arrow, the dot is your car, the arrow shows you the direction you\'re going".', '10c-short-videos.md §5'),
];

export const EXCERPTS: Record<string, Excerpt> = Object.fromEntries(LIST.map(e => [e.key, e]));
export const excerptFor = (key: string): Excerpt | undefined => EXCERPTS[key];

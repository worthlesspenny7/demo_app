/** Static reference data for the Reference page (LESSON-005, CHART-004): regulations tables and the handbook's Packard example charts. Pure data, no DOM, so tests can check the numbers. Sources: docs/research/09-event-regulations-2026.md and docs/research/08-rookie-handbook-body.md. */

export interface ChartData { id: 'accel' | 'stopgo' | 'turn'; title: string; note: string; rowLabel: string; cols: number[]; rows: { label: number; values: (number | null)[] }[] }

/** "1936 Packard example, HB p.7-9": the three handbook charts, net seconds, IN speed rows x OUT speed columns. */
export const PACKARD_LABEL = '1936 Packard example, HB p.7-9';
export const PACKARD_CHARTS: ChartData[] = [
  {
    id: 'accel', title: 'Acceleration - Deceleration (net time lost)', rowLabel: 'start \\ end', note: 'Net seconds lost, not the real times. 0 to 40 from a stop = 4.5 s: either start 4.5 s before the instructed time or make it up after.',
    cols: [0, 15, 20, 25, 30, 35, 40, 45, 50],
    rows: [
      { label: 0, values: [null, 1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4] },
      { label: 15, values: [1, null, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4] },
      { label: 20, values: [1.2, 0.2, null, 0.5, 1.6, 2.3, 3.2, 4.3, 5.3] },
      { label: 25, values: [1.3, 0.3, 0.1, null, 1.1, 1.8, 2.7, 3.8, 4.6] },
      { label: 30, values: [1.9, 0.9, 0.7, 0.6, null, 0.7, 1.6, 2.7, 3.5] },
      { label: 35, values: [2, 1, 0.8, 0.7, 0.1, null, 0.9, 2, 2.8] },
      { label: 40, values: [2.4, 1.4, 1.2, 1.1, 0.5, 0.4, null, 1.1, 1.9] },
      { label: 45, values: [2.8, 1.8, 1.6, 1.5, 0.9, 0.8, 0.4, null, 0.8] },
      { label: 50, values: [3.3, 2.3, 2.1, 2, 1.4, 1.3, 0.9, 0.5, null] },
    ],
  },
  {
    id: 'stopgo', title: 'Stop & Go pause times (15 s stop)', rowLabel: 'in \\ out', note: 'Wait this long after the wheels stop, instead of the printed 15 s. 30 in, 40 out = 8.6 s. If the printed pause is not 15 s, the chart loss is 15 minus the chart value: subtract it from the printed pause.',
    cols: [15, 20, 25, 30, 35, 40, 45, 50],
    rows: [
      { label: 15, values: [13, 12.7, 12.2, 11.1, 10.4, 9.5, 8.4, 7.6] },
      { label: 20, values: [12.8, 12.5, 12, 10.9, 10.2, 9.3, 8.2, 7.4] },
      { label: 25, values: [12.7, 12.4, 11.9, 10.8, 10.1, 9.2, 8.1, 7.3] },
      { label: 30, values: [12.1, 11.8, 11.3, 10.2, 9.5, 8.6, 7.5, 6.7] },
      { label: 35, values: [12, 11.7, 11.2, 10.1, 9.4, 8.5, 7.4, 6.6] },
      { label: 40, values: [11.6, 11.3, 10.8, 9.7, 9, 8.1, 7, 6.2] },
      { label: 45, values: [11.2, 10.9, 10.4, 9.3, 8.6, 7.7, 6.6, 5.8] },
      { label: 50, values: [10.7, 10.4, 9.9, 8.8, 8.1, 7.2, 6.1, 5.3] },
    ],
  },
  {
    id: 'turn', title: 'Turns (time lost)', rowLabel: 'in \\ out', note: 'The Packard slows to 15 mph at the apex in 2nd gear. The instructions assume instant speed changes at the apex. Approach 40, exit 35 = 4.0 s lost: make it up after you leave the turn (10 % rule).',
    cols: [15, 20, 25, 30, 35, 40, 45, 50],
    rows: [
      { label: 15, values: [0, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4] },
      { label: 20, values: [0.2, 0.5, 1, 2.1, 2.8, 3.7, 4.8, 5.6] },
      { label: 25, values: [0.3, 0.6, 1.1, 2.2, 2.9, 3.8, 4.9, 5.7] },
      { label: 30, values: [0.9, 1.2, 1.7, 2.8, 3.5, 4.4, 5.5, 6.3] },
      { label: 35, values: [1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4] },
      { label: 40, values: [1.4, 1.7, 2.2, 3.3, 4, 4.9, 6, 6.8] },
      { label: 45, values: [1.8, 2.1, 2.6, 3.7, 4.4, 5.3, 6.4, 7.2] },
      { label: 50, values: [2.3, 2.6, 3.1, 4.2, 4.9, 5.8, 6.9, 7.7] },
    ],
  },
];
/** Look a Packard chart value up by chart id, IN speed and OUT speed (null when the pair is not on the chart). */
export function packardValue(id: ChartData['id'], vIn: number, vOut: number): number | null {
  const c = PACKARD_CHARTS.find(x => x.id === id); const r = c?.rows.find(x => x.label === vIn); const i = c ? c.cols.indexOf(vOut) : -1;
  return r && i >= 0 ? (r.values[i] ?? null) : null;
}

/** REG V.D age factors, keyed by Scoring Year: 1954+ = 1.000, 1953 = 0.915, -0.005 per year back to 1930 = 0.800, then -0.010 per year back to 1900 = 0.500. */
export function ageFactorFor(year: number): number {
  if (year >= 1954) return 1;
  if (year === 1953) return 0.915;
  if (year >= 1930) return Math.round((0.8 + (year - 1930) * 0.005) * 1000) / 1000;
  if (year >= 1900) return Math.round((0.8 - (1930 - year) * 0.01) * 1000) / 1000;
  return 0.5;
}
export const AGE_FACTOR_ROWS: { year: string; factor: number }[] = [{ year: '1954+', factor: 1 }, ...Array.from({ length: 54 }, (_, i) => 1953 - i).map(y => ({ year: String(y), factor: ageFactorFor(y) }))];

/** REG V.E penalties (as printed in the 2026 Event Regulations). seconds is the numeric value when there is one. */
export interface PenaltyRow { rule: string; what: string; penalty: string; seconds: number | null }
export const PENALTY_ROWS: PenaltyRow[] = [
  { rule: 'V.E.1.a', what: 'Each second early or late at a Timing Checkpoint', penalty: '1 s per s', seconds: 1 },
  { rule: 'V.E.1.b', what: 'Maximum late penalty', penalty: '2 minutes (120 s)', seconds: 120 },
  { rule: 'V.E.1.c', what: 'Maximum early penalty', penalty: '5 minutes (300 s)', seconds: 300 },
  { rule: 'V.E.2.a, V.C.2.b', what: 'Missing a Timing Checkpoint (not the final one), or arriving more than 30 minutes after the computed cumulative perfect time', penalty: '3 minutes (180 s)', seconds: 180 },
  { rule: 'V.E.2.b', what: 'Missing the final Timing Checkpoint of a Stage', penalty: 'DNF or FNS', seconds: null },
  { rule: 'V.E.2.c', what: 'Missing an Observation Checkpoint (not the final one)', penalty: '3 minutes (180 s)', seconds: 180 },
  { rule: 'V.E.2.d', what: 'Missing the final Observation Checkpoint of a Stage', penalty: 'DNF or FNS', seconds: null },
  { rule: 'V.E.3.a', what: 'Stopping or traveling 5 MPH or slower within sight of a Timing Checkpoint', penalty: '30 s', seconds: 30 },
  { rule: 'V.E.3.b', what: 'Blocking a Checkpoint in line, or interfering with Checkpoint operations', penalty: '5 minutes or DNF', seconds: 300 },
  { rule: 'V.E.3.e', what: 'Failure to stop at a Stop Sign', penalty: 'DNF', seconds: null },
  { rule: 'V.E.3.g', what: 'Towed or pushed on any part of a Stage (except to start, get back on the road or leave a dangerous place)', penalty: '2 minutes (120 s)', seconds: 120 },
  { rule: 'V.E.3.h', what: 'Leaving a promoted Lunch, Pit or Rest Stop more than 5 minutes before the scheduled departure', penalty: '1 minute first offense, 5 minutes second', seconds: 60 },
];

/** REG V.H Time Allowance procedure, in plain words. */
export const TA_STEPS: { rule: string; text: string }[] = [
  { rule: 'V.H.1', text: 'Qualifies: a delay on the route beyond your control, such as a train blocking the route or stopping to help at an accident (V.H.1 names those two; it does not name traffic lights). Never qualifies: mechanical failure (flat tire), inability to hold the assigned speed, personal failure; the handbook adds navigation errors and wrong turns.' },
  { rule: 'V.H.2', text: 'Emergency reduced speeds (fog, weather, poor road, two-wheel brakes on a grade): you may slow to travel safely, then request the extra time, one request per leg. The request must be verifiable and in good faith.' },
  { rule: 'V.H.3', text: 'Submit it by the method printed in the day\'s instructions (web page, phone, or at the Observation Checkpoint) at the TA point printed in the book (a full-width yellow row), within the time it gives (the 2026 Example Rally #18: "Within 15m00s"). V.H.3 names the cellular telephone and the Great Race Scoring Crew. Give Stage number, car number, leg number, the instruction numbers on or between which the delay happened, and a short description. Amount: multiples of 10 s, not more than 29m30s.' },
  { rule: 'V.H.4', text: 'The Time Allowance Committee reviews it and, if allowed, subtracts the time from the leg in which the delay occurred.' },
  { rule: 'V.H.5', text: 'You are expected to try to make the time up. The committee considers the distance from the delay to the checkpoint and denies time you could have made up. List witnesses, especially for delays over 1m00s.' },
  { rule: 'V.H.6', text: 'Wrong car number: not allowed. Wrong leg number: usually not corrected. An amount that is not a multiple of 10 s is rounded up or down to the contestant\'s possible detriment (1m17s becomes 1m10s or 1m20s).' },
  { rule: 'V.H.7', text: 'Abuse of the procedure is penalized under VI.B.3.' },
];
export const TA_PATTERN = 'Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.';

/** REG VII.B.3.c(4) Column C syntax. */
export const COLUMN_C_ROWS: { shows: string; means: string }[] = [
  { shows: '7:30:00', means: 'A time of day (colons: hours, minutes, seconds) for a Start or Restart.' },
  { shows: '3h15m00s', means: 'An interval of 3 hours 15 minutes (tire warm-up, calibration run, transit, pause, timed speed change).' },
  { shows: '0m45s', means: 'An interval of 45 seconds.' },
  { shows: '(35m00s)', means: 'An interval in parentheses is advisory, not official.' },
  { shows: '(0m30s)', means: 'On the row before the end of a transit: the time left to the end of the transit, a guide (HB p.26, #11).' },
  { shows: '26m00s', means: 'A plain interval is not automatically an exact transit: the Example prints 9m00s and 30m00s plain for ordinary transits. Only Column D saying "take exactly" (Example #30) makes it exact: IN + interval = OUT.' },
  { shows: '45 MPH', means: 'Any other number is an assigned average speed in miles per hour.' },
  { shows: '0 MPH / 0m15s / 45 MPH', means: 'A pause: stop, wait the printed seconds, then go at 45.' },
  { shows: '30 MPH / 0m36s / 45 MPH / 1m12s / 50 MPH', means: 'Timed speed changes: 30 for 36 s, then 45 for 1m12s, then 50.' },
  { shows: '1m12s / 40 MPH', means: 'A delayed speed change: interval first, so it starts at the point of the row, then 40.' },
  { shows: '* / 0m00.0s', means: 'Calibration: the asterisk marks the point from which the next interval time is measured. Boxes show interval over cumulative official time to 0.1 s.' },
];

/** REG VII.E.2 where a speed change takes effect. */
export const SPEED_CHANGE_ROWS: { rule: string; where: string; when: string }[] = [
  { rule: 'VII.E.2.b', where: 'Sign or landmark only', when: 'When the front tires pass (come even with) the sign or landmark.' },
  { rule: 'VII.E.2.c', where: 'Intersection with a referenced sign (such as a stop sign)', when: 'At the sign.' },
  { rule: 'VII.E.2.c', where: 'Intersection with no referenced sign', when: 'At the centre of the intersection or the apex of the turn.' },
  { rule: 'VII.E.2.d', where: 'Timed change preceded by a speed change', when: 'The interval starts where that speed change takes effect.' },
  { rule: 'VII.E.2.d', where: 'Delayed change (interval is the first item in Column C)', when: 'The interval starts at the sign, landmark or intersection point of the row (E.2.b or E.2.c).' },
  { rule: 'HB p.12', where: 'Your car on a speed change', when: 'Split the speed change at the sign: cross at the midpoint speed (35 to 30: cross at 32.5 and keep slowing). The gain and loss cancel.' },
];

/**
 * "Rally school" reference panel (LESSON-008, TAF-001): the 2026 Time Allowance web form fields and the checkpoint facts, each with its video and caption timestamp.
 * `inDocs` says whether the regulations or the handbook also say it; a false entry is video-only and the panel labels it.
 */
export interface TaFormField { id: string; field: string; example: string; note: string; cite: string; /** where the field comes from */ form: 'web 2026' | 'paper' | 'both'; inDocs: boolean }
export const TA_FORM_FIELDS: TaFormField[] = [
  { id: 'car', field: 'Car number', example: '99', note: 'Your car number, not your start position. A wrong car number is not allowed (REG V.H.6).', cite: '2026 Training Session [110:28]; Time Delay Form [02:41]', form: 'both', inDocs: true },
  { id: 'password', field: 'Password', example: '4 digits', note: 'The four-digit password the web form asks for.', cite: '2026 Training Session [110:28]', form: 'web 2026', inDocs: false },
  { id: 'phone', field: 'Phone number', example: 'the number used for time allowances', note: 'Your phone stays out of reach while driving (REG II.H.1.i): file at lunch or at the finish.', cite: '2026 Training Session [110:28], [59:59]', form: 'web 2026', inDocs: false },
  { id: 'stage', field: 'Stage', example: '2', note: 'What day of the rally it is: the second day is stage 2.', cite: 'Time Delay Form [02:41]', form: 'paper', inDocs: false },
  { id: 'leg', field: 'Leg', example: '5', note: 'Checkpoints passed + 1: passed checkpoint 4, you are on leg 5. The simulator fills it in.', cite: 'Time Delay Form [02:41]', form: 'both', inDocs: false },
  { id: 'instructions', field: 'Instruction numbers, from / to', example: '102 to 103', note: '"The most important part": the instruction numbers the delay happened between.', cite: '2026 Training Session [110:28]; Time Delay Form [02:41]', form: 'both', inDocs: true },
  { id: 'time', field: 'Time', example: '3m40s', note: 'In multiples of 10 s (REG V.H.3, V.H.6). Measured delay = stopped time + chart stop-and-go loss; make up the odd seconds first: 3:47 delayed, make up 7, claim 3:40.', cite: 'Time Delay Form [01:38], [02:10], [04:44]', form: 'both', inDocs: false },
  { id: 'cause', field: 'Cause', example: 'train, tractor, school bus, construction, combine', note: 'Never a flat tire, oversleeping, getting lost or a breakdown (REG V.H.1).', cite: 'Time Delay Form [00:04]; Rally School Part 2 [05:43]', form: 'both', inDocs: true },
  { id: 'witnesses', field: 'Witnesses (cars ahead / behind)', example: 'car 2 ahead, car 8 behind', note: 'List witnesses, especially for delays over 1m00s (REG V.H.5).', cite: 'Time Delay Form [02:41]', form: 'both', inDocs: true },
  { id: 'done', field: 'Red "done" button', example: 'end of the day', note: 'Prints the scorecard; needed whether or not you made a request. Filed twice a day: at lunch and at the finish, within 15 minutes of the TA point.', cite: '2026 Training Session [110:28]', form: 'web 2026', inDocs: false },
];
export const TA_FORM_NOTE = 'The 2026 web form takes the first six fields; the paper sheets (older rally schools, 2024) add the stage, the cause and the witnesses and are handed to an official at lunch or at the finish. Regulation V.H.3 only says "by the method printed in the day\'s instructions".';

export interface CheckpointFact { fact: string; cite: string; doc: string | null }
export const CHECKPOINT_FACTS: CheckpointFact[] = [
  { fact: 'Green sign = timing checkpoint. Do nothing: "the minimum that you need to do at a green sign is nothing." You are not told your score.', cite: 'Rally School Part 1 [04:08], [05:39]', doc: 'REG V.A.1.a' },
  { fact: 'Red sign = observation checkpoint (a red board reading GREAT RACE STOP, hung on a wire stand). Stop and talk to the worker: equipment inspection, collecting Time Allowances, the finish.', cite: 'Rally School Part 1 [02:37], [03:07]', doc: 'REG V.A.1.b' },
  { fact: 'Never stop within sight of a green checkpoint and never go slower than 5 mph (30 s).', cite: 'Rally School Part 2 [35:33]', doc: 'REG V.E.3.a' },
  { fact: 'Wave, smile, honk, run your headlights; do not talk to the crew.', cite: '2026 Training Session [64:10]', doc: 'REG V.A.1.a(2)' },
  { fact: 'Write the checkpoint number and your arrival time of day to the second in Column D.', cite: 'Rally School Part 1 [06:11]; 2026 Training Session [105:53]', doc: null },
  { fact: 'Four or five checkpoint crews: at least four or five timing checkpoints a day, always one in the morning, and one can come minutes after you think you are done.', cite: 'Rally School Part 1 [07:42]; Rally School Part 2 [36:10], [36:40]', doc: null },
  { fact: 'No timing checkpoint before the first time-of-day restart; the warm-up and the calibration run are unscored.', cite: 'Rally School Part 1 [42:57]', doc: 'REG V.B.2' },
  { fact: 'Each leg starts from scratch at the green sign: you are on time for the next leg the instant you cross it. Early and late do not cancel.', cite: 'Rally School Part 1 [13:25], [15:59]', doc: 'HB p.13' },
  { fact: 'Late cap 2 minutes, early cap 5 minutes; more than 30 minutes late counts as missed; the final observation checkpoint (the finish) must be checked in at.', cite: 'Rally School Part 1 [17:00], [52:19], [53:22]', doc: 'REG V.E.1, V.E.2' },
];

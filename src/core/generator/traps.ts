/**
 * Trap library (DESIGN §13, research 04 §1/§6). Pure data + tiny helpers; no DOM.
 *
 * Every card describes ONE route node as the simulator sees it (exits relative to the approach heading,
 * negative = left) plus optional distractor nodes placed shortly before it. Exit geometry is consistent with
 * sim.ts peekExit/chooseExit: angle bands L[-120,-60] BL[-60,-20] S[-20,20] BR[20,60] R[60,120] AL<-120 AR>120,
 * driveway/lot/private exits are never taken by the driver, and with no callout the driver takes the
 * straight-as-possible real road, paved roads first (`mainRoadExit`).
 */
import type { Exit, Control, Sign, TurnDir, Node } from '../course.js';
import { EXITS, type NodeSpec, type InsSpec } from '../builder.js';
import type { Rng } from '../rng.js';
import { cameoSvg as renderCameo } from '../cameo.js';

export type TrapCategory =
  | 'controls' | 'intersection-type' | 'turn-vocabulary' | 'counting' | 'signs' | 'main-road'
  | 'speed-change' | 'timing' | 'wording' | 'onto' | 'notice' | 'checkpoint';

export interface TrapDistractor {
  /** Node WITHOUT an instruction, placed `beforeFt` before the real node. */
  node: NodeSpec;
  minBeforeFt: number;
  maxBeforeFt: number;
  why: string;
}

export interface TrapCard {
  id: string;
  name: string;
  category: TrapCategory;
  /** The route-following part of the line ("Right at STOP"); pause/speed are appended by trapToNodeSpec. */
  instructionText: string;
  /** Exits at the real node; exactly one isRoute. Empty only for sign/landmark nodes (no intersection). */
  exits: Exit[];
  /** Control on OUR approach. */
  control: Control;
  sign?: Sign;
  /** Column-D hint printed with the line. */
  hint?: string;
  wrongExits: { angle: number; why: string }[];
  tip: string;
  /** Top-down description for the road view / quiz. */
  visual: string;
  source: string;
  /** Callout the instruction implies; undefined = Main Road Rule (no turn word). */
  turn?: TurnDir;
  /** undefined = default (15 at a STOP, none otherwise); null = deliberately NOT printed (missing-pause trap). */
  pause?: number | null;
  sightDistance?: number;
  label?: string;
  /** Node kind when the card is not an intersection (sign / landmark). */
  nodeKind?: Node['kind'];
  distractors?: TrapDistractor[];
  /** Ask the generator to place the leg's timing CP this far after the node. */
  cpAfterFt?: [number, number];
  /** Place <= 0.15 mi after the previous line ("Comes quick"). */
  shortNotice?: boolean;
  /** The line must carry a (changed) speed. */
  speedChange?: boolean;
}

const GR_REGS = 'Great Race Event Regulations 2026 (GRIID / CAMEO definitions)';
const JCNA = 'JCNA rally chapter 2 (T, Y, Bear, Acute definitions)';
const RRH = 'Road Rally Handbook / Detroit SCCA road_rally_104 sample';
const MCNJ = 'MCNJ Rallye Tips (ONTO / AT / AFTER)';
const PCA = 'PCA Parade TSD appendix VII glossary';
const RAINIER = 'Rainier Auto Sports "overview" (ONTO trap)';
const GR_BASICS = 'greatrace.com Driver/Navigator Basics';
const R04 = 'docs/research/04-traps-and-course-design.md §6';

const paved = (angle: number, isRoute: boolean, extra: Partial<Exit> = {}): Exit => ({ angle, surface: 'paved', kind: 'road', isRoute, ...extra });
const octagon: Sign = { text: 'STOP', shape: 'octagon', side: 'R' };

export const TRAPS: TrapCard[] = [
  {
    id: 'stop-vs-yield', name: 'STOP vs YIELD', category: 'controls',
    instructionText: 'Right at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('R'), turn: 'R',
    distractors: [{ node: { control: 'YIELD', exits: EXITS.crossroads('S'), sign: { text: 'YIELD', shape: 'triangle', side: 'R' }, sightDistance: 600, label: 'YIELD at a crossroads' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'A triangle is a YIELD, not a STOP; the octagon is the next one' }],
    wrongExits: [{ angle: 0, why: 'Driving past the octagon' }, { angle: -90, why: 'Wrong side' }],
    tip: 'STOP SIGN means an official octagon. Triangle = YIELD, flasher = BLINKER, three-light head = SIGNAL.',
    visual: 'A YIELD-controlled crossroads first, then 700 ft later the real 4-way with an octagon facing you; side road right at both.',
    source: `${GR_REGS}; ${R04} #1`,
  },
  {
    id: 'stop-vs-blinker', name: 'STOP vs flashing blinker', category: 'controls',
    instructionText: 'Left at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('L'), turn: 'L',
    distractors: [{ node: { control: 'BLINKER', exits: EXITS.crossroads('S'), sightDistance: 700, label: 'Flashing yellow blinker over a crossroads' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'An alternating flasher is a BLINKER; it does not satisfy STOP' }],
    wrongExits: [{ angle: 0, why: 'Straight through the octagon' }, { angle: 90, why: 'Wrong side' }],
    tip: 'Shape and colour discipline: octagon = STOP. A yellow flasher is a warning, not a stop.',
    visual: 'Overhead flashing yellow at a crossroads, then a 4-way with an octagon; the route goes left at the octagon.',
    source: `${PCA} (Blinker); ${R04} §1.8`,
  },
  {
    id: 'not-a-t', name: 'Not a T (you are on the crossbar)', category: 'intersection-type',
    instructionText: 'Left at T', control: 'none', exits: EXITS.tee('L'), turn: 'L',
    distractors: [{ node: { exits: EXITS.sideRoad('L'), sightDistance: 600, label: 'Side road ends at ours (we are the crossbar)' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'A T counts only when YOUR road ends; here the side road ends at yours' }],
    wrongExits: [{ angle: 90, why: 'Right at the T' }],
    tip: 'A T is approached from the stem: your road ends. A road ending at yours is not a T for you.',
    visual: 'A road joins from the left and ends at yours; 700 ft on, your road ends against a crossroad: that is the T.',
    source: `${JCNA}; ${R04} #7`,
  },
  {
    id: 'y-vs-fork', name: 'Y vs near-straight fork', category: 'intersection-type',
    instructionText: 'Bear Right at Y', control: 'none', exits: EXITS.wye('BR'), turn: 'BR',
    distractors: [{ node: { exits: [paved(8, true), paved(-35, false)], sightDistance: 600, label: 'Fork: one branch continues nearly straight' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'Not a Y: one branch is a continuation, both branches of a Y must be turns' }],
    wrongExits: [{ angle: -35, why: 'Bearing left at the Y' }],
    tip: 'At a Y BOTH branches require a turn of substantially less than 90 degrees. If one branch is straight, it is a fork with a side road, not a Y.',
    visual: 'A fork whose left branch leaves at 35 degrees while the road continues almost straight; then the true Y with 35-degree branches both sides.',
    source: `${JCNA}; ${R04} §1.5`,
  },
  {
    id: 'bear-vs-turn', name: 'Bear vs Turn (two lefts at one node)', category: 'turn-vocabulary',
    instructionText: 'Bear Left', control: 'none', exits: [paved(-90, false), paved(-45, true), paved(0, false)], turn: 'BL',
    wrongExits: [{ angle: -90, why: 'That is a Turn (about 90), not a Bear' }, { angle: 0, why: 'Straight: ignoring the instruction' }],
    tip: 'Bear = perceptibly less than 90 (about 45). Turn = about 90. Acute = more than 90. Map the word to an angle before you arrive.',
    visual: 'A five-way: roads leave at 45 left and 90 left and the pavement continues straight; the route is the 45.',
    source: `${JCNA}; ${R04} #8`,
  },
  {
    id: 'acute-vs-turn', name: 'Acute Right (doubling back)', category: 'turn-vocabulary',
    instructionText: 'Acute Right', control: 'none', exits: [paved(0, false), paved(90, false), paved(150, true)], turn: 'AR',
    wrongExits: [{ angle: 90, why: 'Taking the 90-degree right instead of the sharp one' }, { angle: 0, why: 'Straight on' }],
    tip: 'Acute means more than 90 degrees: you double back. Teams rarely expect it and take the ordinary right.',
    visual: 'A right at 90 and a sharp right at 150 degrees leave the same node; straight continues.',
    source: `${JCNA}; ${R04} #15`,
  },
  {
    id: 'jog-left-at-stop', name: 'Jog Left at STOP', category: 'turn-vocabulary',
    instructionText: 'Jog Left at STOP', control: 'STOP', sign: octagon, exits: EXITS.tee('L'), turn: 'JL', label: 'T; then right in 100 ft to continue',
    wrongExits: [{ angle: 90, why: 'Right at the T' }],
    tip: 'A jog is TWO turns: left at the T then right a short distance on, to continue in the same general direction. Teams do the first half only.',
    visual: 'Your road ends at a crossroad (STOP). 100 ft to the left the continuation leaves to the right.',
    source: `${RRH} ("Jog Left at STOP"); ${R04} #14`,
  },
  {
    id: 'first-paved-road', name: '1st paved road vs driveway / lot', category: 'counting',
    instructionText: 'Right at 1st paved road', control: 'none', exits: EXITS.sideRoad('R', { route: 'turn' }), turn: 'R', hint: '1st paved road',
    distractors: [
      { node: { exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'Paved driveway on R' }, minBeforeFt: 300, maxBeforeFt: 900, why: 'A driveway is not a road' },
      { node: { exits: EXITS.sideRoad('R', { kind: 'lot' }), sightDistance: 400, label: 'Parking lot entrance on R' }, minBeforeFt: 300, maxBeforeFt: 900, why: 'A parking-lot entrance is not a road' },
    ],
    wrongExits: [{ angle: 0, why: 'Missing the road' }],
    tip: 'Before counting, exclude driveways, parking lots and dead ends; the Great Race may omit them from the CAMEO or draw them dashed.',
    visual: 'A paved driveway and/or a parking-lot entrance on the right, then the first real paved road on the right.',
    source: `${GR_REGS}; greatrace.com FAQ ("turn right at the first paved road")`,
  },
  {
    id: 'first-paved-vs-gravel', name: '1st paved road vs gravel / dead end', category: 'counting',
    instructionText: 'Right at 1st paved road', control: 'none', exits: EXITS.sideRoad('R', { route: 'turn' }), turn: 'R', hint: '1st paved road',
    distractors: [
      { node: { exits: EXITS.sideRoad('R', { surface: 'gravel' }), sightDistance: 500, label: 'Gravel road on R' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'Unpaved does not count as paved' },
      { node: { exits: EXITS.sideRoad('R', { kind: 'deadend', name: 'DEAD END' }), sightDistance: 500, label: 'Paved road on R signed DEAD END' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'A road signed DEAD END / NO OUTLET is never the route' },
    ],
    wrongExits: [{ angle: 0, why: 'Missing the road' }],
    tip: 'Gravel is not paved; DEAD END, NO OUTLET and NOT A THROUGH STREET roads never count.',
    visual: 'A gravel road and/or a DEAD END street on the right, then the first real paved road on the right.',
    source: `${GR_REGS} (dead-end definition); ${R04} #6`,
  },
  {
    id: 'straight-as-possible-fork', name: 'Main Road Rule: paved curve vs gravel straight', category: 'main-road',
    instructionText: 'Follow pavement (Main Road Rule)', control: 'none',
    exits: [paved(-25, true), { angle: 0, surface: 'gravel', kind: 'road', isRoute: false }],
    wrongExits: [{ angle: 0, why: 'Dead-ahead gravel: under a pavement-first GI the main road is the paved curve' }],
    tip: 'Read the General Instructions main-road priority before the start. Pavement-first: stay on pavement. Straight-as-possible: least direction change.',
    visual: 'The pavement curves gently left; a gravel road continues dead ahead. No turn instruction applies.',
    source: `Indy SCCA Novice_3 (MRDs); Rally WNY; ${R04} #9`,
  },
  {
    id: 'side-road-stop-facing-away', name: 'Side-road STOP faces away', category: 'controls',
    instructionText: 'Right at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('R'), turn: 'R',
    distractors: [{ node: { exits: EXITS.sideRoad('R', { control: 'STOP' }), sightDistance: 600, label: 'Octagon faces the side road, not us' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'That STOP controls the side road; it does not control your direction of travel' }],
    wrongExits: [{ angle: 0, why: 'Driving past the octagon' }, { angle: -90, why: 'Wrong side' }],
    tip: 'A STOP in an instruction controls YOUR approach. You will see the back of the side road\'s octagon; that is not your STOP.',
    visual: 'A side road right with an octagon facing it (you see its back); 700 ft later the 4-way with the octagon facing you.',
    source: `${R04} §1.8 (sign facing away)`,
  },
  {
    id: 'hidden-speed-sign', name: 'Hidden speed-change sign', category: 'speed-change',
    instructionText: 'At "CURVE" sign', control: 'none', exits: [], nodeKind: 'sign', sign: { text: 'CURVE', shape: 'curve', side: 'R', plaque: 35 }, sightDistance: 150, hint: 'Look sharp', speedChange: true,
    wrongExits: [{ angle: 0, why: 'Changing speed late because the sign appears only past the bend' }],
    tip: 'Speed changes happen at the near edge of the sign. When column D says Look sharp, have the driver pre-brief the change.',
    visual: 'Yellow diamond just past a blind bend, visible 150 ft out.',
    source: `Cascade rallymaster guide (near edge); ${R04} #5`,
  },
  {
    id: 'forgotten-pause', name: 'Forgotten pause (column C)', category: 'timing',
    instructionText: 'Left at STOP at T', control: 'STOP', sign: octagon, exits: EXITS.tee('L'), turn: 'L', pause: 15,
    wrongExits: [{ angle: 90, why: 'Right at the T' }],
    tip: 'Pause 15 rides in column C where eyes slide past it. Highlight every pause before the start and write the GO time beside it: the pause minus your stop and go loss, counted on the stopwatch.',
    visual: 'Standard STOP at a T, route left; the pause is printed in the timing column.',
    source: `${GR_BASICS}; ronrowland.com bezel notes; ${R04} #3`,
  },
  {
    id: 'missing-pause', name: 'STOP without a printed pause', category: 'timing',
    instructionText: 'Right at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('R'), turn: 'R', pause: null,
    wrongExits: [{ angle: 0, why: 'Straight through' }],
    tip: 'Not every STOP carries a pause. If column C is blank you still stop (the law) but the ghost does not: you are late by your stop loss unless you make it up.',
    visual: '4-way STOP, route right, timing column blank.',
    source: `${GR_REGS} (pause definition); ${R04} §1.12`,
  },
  {
    id: 'after-sign', name: 'AFTER = first opportunity past the sign', category: 'wording',
    instructionText: 'Right after "CHURCH"', control: 'none', exits: [paved(0, false), { angle: 70, surface: 'paved', kind: 'driveway', isRoute: false }, paved(90, true)], turn: 'R',
    distractors: [{ node: { kind: 'sign', sign: { text: 'CHURCH', shape: 'rect', side: 'R' }, sightDistance: 500, label: 'Church on R' }, minBeforeFt: 300, maxBeforeFt: 600, why: 'The sign is the reference; the action is at the first real road past it' }],
    wrongExits: [{ angle: 70, why: 'The church driveway is not a road' }, { angle: 0, why: 'Missing the first opportunity' }],
    tip: 'AFTER: the first real opportunity following the landmark. Driveways do not count as opportunities.',
    visual: 'Church sign on the right, then its paved driveway, then the first road right 300-600 ft past the sign.',
    source: `${PCA} (After); ${MCNJ}; ${R04} #11`,
  },
  {
    id: 'at-sign', name: 'AT = in the vicinity of (for turns)', category: 'wording',
    instructionText: 'Right at "CHURCH"', control: 'none', sign: { text: 'CHURCH', shape: 'rect', side: 'R' }, exits: EXITS.sideRoad('R', { route: 'turn' }), turn: 'R',
    wrongExits: [{ angle: 0, why: 'Waiting to pass the sign before turning' }],
    tip: 'For turns AT means the intersection where the sign is in view; for speed changes and pauses it means even with the sign.',
    visual: 'The church sign stands at the intersection; the road right leaves right there.',
    source: `${PCA} (At); ${R04} §1.3`,
  },
  {
    id: 'second-occurrence', name: 'Counting the 2nd occurrence', category: 'counting',
    instructionText: 'Right at 2nd "OAK ST"', control: 'none', exits: [paved(-90, false, { name: 'OAK ST' }), paved(0, false), paved(90, true, { name: 'OAK ST' })], turn: 'R',
    distractors: [
      { node: { exits: [paved(-90, false, { name: 'OAK CT' }), paved(0, true), paved(90, false, { name: 'OAK CT' })], sightDistance: 600, label: 'OAK CT crossing' }, minBeforeFt: 650, maxBeforeFt: 900, why: '"OAK CT" is not "OAK ST": it does not count' },
      { node: { exits: [paved(-90, false, { name: 'OAK ST' }), paved(0, true), paved(90, false, { name: 'OAK ST' })], sightDistance: 600, label: '1st OAK ST crossing' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'The first OAK ST: keep counting' },
    ],
    wrongExits: [{ angle: 0, why: 'Lost count' }, { angle: -90, why: 'Wrong side' }],
    tip: 'Count only exact matches. Grid towns cross the same street twice; near-matches (CT vs ST) do not count.',
    visual: 'OAK CT crossing, then OAK ST crossing, then OAK ST again: turn right at the second OAK ST.',
    source: `${R04} #16; Rally WNY generals`,
  },
  {
    id: 'onto-follows-name', name: 'ONTO follows the name', category: 'onto',
    instructionText: 'Bear Right to stay ONTO "OAK RD"', control: 'none', exits: [paved(0, false, { name: 'MAIN ST' }), paved(40, true, { name: 'OAK RD' })], turn: 'BR', hint: 'ONTO: follow the name',
    wrongExits: [{ angle: 0, why: 'The wide road straight ahead is now MAIN ST; Oak Rd turns right' }],
    tip: 'Once placed ONTO a road, follow its name wherever it turns until a later course-directing instruction. Read every blade.',
    visual: 'Wide pavement continues straight (blade MAIN ST); a narrower road bears right with the blade OAK RD.',
    source: `${RAINIER}; Richta GPS addendum (ONTO); ${R04} #2`,
  },
  {
    id: 'off-course-loop', name: 'Off-course loop that rejoins', category: 'main-road',
    instructionText: 'Left at STOP', control: 'STOP', sign: octagon, exits: [paved(-90, true), paved(0, false, { name: 'LOOP RD' }), paved(90, false)], turn: 'L',
    wrongExits: [{ angle: 0, why: 'Straight: LOOP RD rejoins the course two miles on; you never see the missed checkpoint' }, { angle: 90, why: 'Wrong side' }],
    tip: 'A loop that rejoins the course hides the error: confirm each landmark; if the next one does not appear within about 10 percent of the expected time, stop before the next intersection.',
    visual: '4-way STOP; straight ahead a paved road loops back to the course further on.',
    source: `${RAINIER}; Mike Roberts 2021 account; ${R04} #18`,
  },
  {
    id: 'comes-quick', name: '"Comes quick" short-notice turn', category: 'notice',
    instructionText: 'Right at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('R'), turn: 'R', hint: 'Comes quick', sightDistance: 300, shortNotice: true,
    wrongExits: [{ angle: 0, why: 'Still reading the previous line' }],
    tip: 'Column D "Comes quick" means the next line executes within about 0.15 mi: call it before the current one is finished.',
    visual: 'Two intersections 700 ft apart; the second is a STOP with the route right, visible only 300 ft out.',
    source: `${GR_REGS} (column D hints); ${GR_BASICS}`,
  },
  {
    id: 'cp-after-stop', name: 'Checkpoint right after a STOP', category: 'checkpoint',
    instructionText: 'Straight at STOP', control: 'STOP', sign: octagon, exits: EXITS.crossroads('S'), turn: 'S', cpAfterFt: [500, 1500],
    wrongExits: [{ angle: -90, why: 'Wrong side' }, { angle: 90, why: 'Wrong side' }],
    tip: 'Rallymasters put checkpoints in the most inopportune places. Leave the stop exactly on your dwell; there is no road left to recover on. A GREEN sign is a Timing checkpoint (do nothing, never slow below 5 mph in sight of it); the RED GREAT RACE STOP board is the Observation Checkpoint (stop).',
    visual: 'Plain 4-way STOP; the green Timing checkpoint sign stands 500-1500 ft past it (the Observation Checkpoint is the red GREAT RACE STOP board: red = stop, green = keep going).',
    source: `docs/research/06 §1 ("most inopportune places"); GEN-007`,
  },
  {
    id: 'speed-at-signal', name: 'Speed change at SIGNAL (leading edge, no pause)', category: 'speed-change',
    instructionText: 'Straight at SIGNAL', control: 'SIGNAL', exits: EXITS.crossroads('S'), turn: 'S', speedChange: true,
    wrongExits: [{ angle: -90, why: 'Wrong side' }, { angle: 90, why: 'Wrong side' }],
    tip: 'No pause is printed at a signal. A red light is not a Time Allowance by default: make it up with the 10 % rule; a TA is for delays such as a train or an accident scene (REG V.H.1). The new speed applies at the leading edge.',
    visual: 'Three-light signal over a crossroads; the route is straight with a new speed.',
    source: `${GR_BASICS} (time allowance); Cascade guide (leading edge); HAZ-005`,
  },
  {
    id: 'rr-crossing', name: 'Speed change at the rails (RR crossing)', category: 'speed-change',
    instructionText: 'At RR crossing', control: 'RR', exits: [], nodeKind: 'landmark', sign: { text: 'RR', shape: 'rr-advance', side: 'R' }, label: 'RR crossing', speedChange: true,
    wrongExits: [{ angle: 0, why: 'Changing speed at the crossbuck sign instead of the rails' }],
    tip: 'The new speed starts at the rails, not at the crossbuck sign. A train that holds you is a Time Allowance: time the wait on the stopwatch and file it on the 2026 web form at the TA point printed in the book, within 15 minutes (REG V.H.3, Example #18).',
    visual: 'Crossbuck and gates; rails cross the road at the node.',
    source: `${GR_REGS} (TA for trains, V.H.1, V.H.3, Example #18); HAZ-002`,
  },
];

/**
 * PLAY-025 (REG VII.D, PT-08 N-B5): the D09 question for each card is a decision, "which way / what do you do", never "which statement is right".
 * One right action and three wrong ones a rookie would really take. REG VII.D: there are no spelling traps, so no card turns on spelling.
 */
export interface TrapQuiz { ask?: string; right: string; wrong: [string, string, string] }
export const TRAP_QUIZ: Record<string, TrapQuiz> = {
  'stop-vs-yield': { right: 'Drive on through the YIELD, then stop fully and turn right at the octagon', wrong: ['Turn right at the YIELD triangle, slowing down but never stopping', 'Stop fully at the YIELD triangle, then turn right there at once', 'Drive on past the octagon slowly, then turn right at the next road'] },
  'stop-vs-blinker': { right: 'Drive on under the flasher, then stop and turn left at the octagon', wrong: ['Turn left under the flashing yellow light after slowing right down there', 'Come to a full stop under the flasher, then turn left from there', 'Drive straight on past the octagon and look for the next left'] },
  'not-a-t': { right: 'Drive past the road that ends at yours, then turn left where yours ends', wrong: ['Turn left into the first road on the left that you see along this stretch', 'Turn right at the end of your own road, rather than turning to the left there', 'Stop where the side road meets yours and ask the driver the way'] },
  'y-vs-fork': { right: 'Keep straight past the side road, then bear right at the true Y', wrong: ['Bear right into the first fork you reach, since it looks like a Y', 'Take the left branch of the first fork and stay on that road for now', 'Drive straight on through the true Y, keeping to the road that you are on'] },
  'bear-vs-turn': { right: 'Take the road that leaves at about 45 degrees left, a bear and not a turn', wrong: ['Take the road at 90 degrees left, treating it as a full left turn', 'Stay on the pavement straight ahead and ignore the side road', 'Take the sharpest left you can see at the intersection ahead'] },
  'acute-vs-turn': { right: 'Take the sharp right turn that doubles back at about 150 degrees', wrong: ['Take the ordinary right at 90 degrees, the very first one you come to', 'Drive straight on and wait for a turn the book names outright', 'Slow down for the right, then pass it and take the next road'] },
  'jog-left-at-stop': { right: 'Stop fully, turn left at the T, then turn right about 100 ft on', wrong: ['Stop fully and turn left at the T, then stay on that road past the jog', 'Stop fully and turn right at the T, then turn left about 100 ft on', 'Roll through the STOP turning left, then go right 100 ft on'] },
  'first-paved-road': { right: 'Skip the driveway and lot, turn right at the first paved road', wrong: ['Turn right into the paved driveway, because it is the first pavement', 'Turn right at the parking-lot entrance, since its surface is paved too', 'Drive on and turn right at the second paved road that you come to first'] },
  'first-paved-vs-gravel': { right: 'Skip the gravel road and the dead end, and turn right at the first paved road', wrong: ['Turn right onto the gravel road because it is the first road on the right', 'Turn right into the DEAD END street, the first paved road you see', 'Drive on to the next intersection that has a street sign on it'] },
  'straight-as-possible-fork': { right: 'Follow the paved road as it curves left, not the straighter gravel', wrong: ['Drive straight on onto the gravel, since it is the straightest way ahead', 'Stop at the fork and wait for a sign to tell you which way to go', 'Turn around and read the line again before choosing a branch'] },
  'side-road-stop-facing-away': { right: 'Drive past the back of the side road\'s octagon and stop at the 4-way', wrong: ['Stop at the first octagon you see on the side road, then turn right there', 'Turn right into the side road, since its STOP sign is the first you meet', 'Drive straight on through the 4-way without stopping at the line'] },
  'hidden-speed-sign': { right: 'Brief the driver, then call the new speed at the sign as it appears', wrong: ['Call the new speed once the bend is behind you and the road is clear', 'Ignore the sign, because a CURVE sign is only a warning and gives no speed', 'Call the new speed at the far edge of the sign, once you have read all of it'] },
  'forgotten-pause': { right: 'Stop fully, sit the pause minus your stop loss, say GO, then turn left at the T', wrong: ['Stop fully and go at once, then take the left at the T that follows', 'Sit the full 15 s at the stop line, call GO, then turn left at the T', 'Roll through the STOP slowly to keep time, then turn left at the T'] },
  'missing-pause': { right: 'Stop fully, go when safe, turn right, and make up the loss by the 10 % rule', wrong: ['Roll through the STOP to keep time, then turn right when the traffic allows it', 'Sit 15 s at the STOP as if a pause were printed, then turn right', 'File a Time Allowance for the stop, since the book gives no pause'] },
  'after-sign': { right: 'Pass the church sign and its driveway, then turn right at the first road', wrong: ['Turn right into the church driveway, just past the church sign you can see', 'Turn right at the road just before the sign, as it is the closest road to it', 'Turn right at the second real road after the church sign you see'] },
  'at-sign': { right: 'Turn right at the intersection where the church sign stands', wrong: ['Drive past the sign and turn right at the next road after it', 'Turn right into the church parking lot beside the sign itself', 'Stop at the sign and ask the driver which of the roads is meant'] },
  'second-occurrence': { right: 'Drive past OAK CT and the first OAK ST, then turn right at the second OAK ST', wrong: ['Turn right at OAK CT, since it is the first Oak street that you meet', 'Turn right at the first OAK ST, the first exact match that you see', 'Turn left at the second OAK ST, counting only the exact name matches'] },
  'onto-follows-name': { right: 'Bear right and follow OAK RD, the narrower road that carries the name', wrong: ['Stay on the wide road straight ahead, since it is clearly the bigger road', 'Turn left at the junction, away from both of the named roads', 'Pull over and read the next line before choosing either road'] },
  'off-course-loop': { right: 'Stop fully at the STOP and turn left as the line says, ignoring LOOP RD', wrong: ['Drive straight on, because LOOP RD comes back onto the course further on', 'Turn right at the STOP instead, since the road to the left looks less used', 'Pull off and read the next line before deciding which way to go'] },
  'comes-quick': { right: 'Read both lines now, then stop and turn right at the STOP 300 ft on', wrong: ['Finish reading the first line, then read the next one out to the driver', 'Drive straight through the second intersection that follows the first one', 'Turn right at the first intersection, since it has a STOP sign as well'] },
  'cp-after-stop': { ask: 'A green sign may stand just past this STOP. What do you do?', right: 'Stop fully, go on your dwell, then drive straight on past the green sign at speed', wrong: ['Stop again at the green sign to check the checkpoint number on it', 'Slow to 5 mph at the green sign so that you can read what it says', 'Turn at the STOP to look for the place where the checkpoint stands'] },
  'speed-at-signal': { right: 'Go straight on, new speed at the leading edge, and make up a red with the 10 % rule', wrong: ['File a Time Allowance for any red light you sit through, as it is outside your control', 'Sit a 15 s pause at the signal, then call the new speed once you leave it', 'Call the new speed once the signal is behind you, and never before it'] },
  'rr-crossing': { ask: 'A speed change at the RR crossing, and a train may come. What do you do?', right: 'Call the new speed at the rails, time a train wait and file a TA on the web form', wrong: ['Make up the train wait with the 10 % rule and also file a TA for the same seconds', 'Call the new speed at the crossbuck sign, since that is the first marker you reach', 'Tell the crew about the train wait at the next checkpoint instead'] },
};

export function trapById(id: string): TrapCard {
  const c = TRAPS.find(t => t.id === id);
  if (!c) throw new Error(`unknown trap ${id}`);
  return c;
}

/** Generic distractors (GEN-006) the generator may drop on ordinary segments. */
export const GENERIC_DISTRACTORS: TrapDistractor[] = [
  { node: { exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'Driveway on R' }, minBeforeFt: 300, maxBeforeFt: 900, why: 'driveway' },
  { node: { exits: EXITS.sideRoad('L', { kind: 'driveway' }), sightDistance: 400, label: 'Driveway on L' }, minBeforeFt: 300, maxBeforeFt: 900, why: 'driveway' },
  { node: { exits: EXITS.sideRoad('R', { kind: 'lot' }), sightDistance: 400, label: 'Parking lot on R' }, minBeforeFt: 300, maxBeforeFt: 900, why: 'lot' },
  { node: { exits: EXITS.sideRoad('L', { surface: 'gravel' }), sightDistance: 500, label: 'Gravel road on L' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'gravel' },
  { node: { exits: EXITS.sideRoad('R', { surface: 'gravel' }), sightDistance: 500, label: 'Gravel road on R' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'gravel' },
  { node: { exits: EXITS.sideRoad('R', { kind: 'deadend', name: 'NO OUTLET' }), sightDistance: 500, label: 'Street on R signed NO OUTLET' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'deadend' },
  { node: { exits: EXITS.sideRoad('L', { control: 'STOP' }), sightDistance: 600, label: 'Side road L with its own STOP' }, minBeforeFt: 650, maxBeforeFt: 900, why: 'side-road STOP facing away' },
];

/** Angle band for a callout (same table as sim.ts bandFor / DRV-007). */
export function turnBand(dir: TurnDir): [number, number] {
  switch (dir) {
    case 'L': case 'JL': return [-120, -60];
    case 'BL': return [-60, -20];
    case 'S': return [-20, 20];
    case 'BR': return [20, 60];
    case 'R': case 'JR': return [60, 120];
    case 'AL': return [-180, -120];
    case 'AR': return [120, 180];
  }
}

/** The exit the driver takes with no callout (mirror of sim.ts chooseExit). */
export function mainRoadExit(exits: Exit[], rule: 'pavement-first' | 'straight-as-possible' = 'pavement-first'): Exit {
  const roads = exits.filter(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private');
  const pool = rule === 'pavement-first' && roads.some(e => e.surface === 'paved') ? roads.filter(e => e.surface === 'paved') : roads;
  return (pool.length ? pool : exits).slice().sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0]!;
}

/** The exit the driver takes with a callout `dir` armed (mirror of sim.ts chooseExit). */
export function exitForCallout(exits: Exit[], dir: TurnDir, rule: 'pavement-first' | 'straight-as-possible' = 'pavement-first'): Exit {
  const roads = exits.filter(e => e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private');
  const [lo, hi] = turnBand(dir); const mid = (lo + hi) / 2;
  const cands = roads.filter(e => e.angle >= lo && e.angle <= hi).sort((a, b) => Math.abs(a.angle - mid) - Math.abs(b.angle - mid));
  return cands[0] ?? mainRoadExit(exits, rule);
}

export function routeExit(exits: Exit[]): Exit | undefined { return exits.find(e => e.isRoute); }

/** Structural problems with a card (empty = fine). */
export function validateTrapCard(card: TrapCard): string[] {
  const p: string[] = [];
  const routes = card.exits.filter(e => e.isRoute);
  if (card.exits.length && routes.length !== 1) p.push(`${card.id}: ${routes.length} route exits`);
  if (!card.exits.length && !card.nodeKind) p.push(`${card.id}: no exits and no nodeKind`);
  if (!card.wrongExits.length) p.push(`${card.id}: no wrong exits`);
  if (!card.tip || !card.instructionText || !card.visual || !card.source) p.push(`${card.id}: missing text`);
  if (card.exits.length) {
    const taken = card.turn ? exitForCallout(card.exits, card.turn) : mainRoadExit(card.exits);
    if (!taken.isRoute) p.push(`${card.id}: driver would take angle ${taken.angle} (not the route)`);
    if (!card.turn && !card.exits.some(e => Math.abs(e.angle) < 20 && e.kind === 'road')) p.push(`${card.id}: no turn word and no straight road: driver would stop and ask`);
  }
  for (const d of card.distractors ?? []) {
    const ex = d.node.exits;
    if (ex) {
      if (ex.filter(e => e.isRoute).length !== 1) p.push(`${card.id}: distractor has != 1 route exit`);
      if (!mainRoadExit(ex).isRoute) p.push(`${card.id}: distractor main road is not the route`);
      if (!ex.some(e => Math.abs(e.angle) < 20 && e.kind === 'road')) p.push(`${card.id}: distractor has no straight road (driver would ask)`);
      // a real road in the upcoming callout's band must sit beyond the oracle's 600 ft callout window
      if (card.turn) {
        const [lo, hi] = turnBand(card.turn);
        const conflict = ex.some(e => !e.isRoute && e.kind !== 'driveway' && e.kind !== 'lot' && e.kind !== 'private' && e.angle >= lo && e.angle <= hi);
        if (conflict && d.minBeforeFt < 650) p.push(`${card.id}: distractor with a road in the ${card.turn} band must be >= 650 ft before the node`);
      }
    }
    if (d.minBeforeFt < 300 || d.maxBeforeFt > 900 || d.minBeforeFt > d.maxBeforeFt) p.push(`${card.id}: distractor range out of 300-900`);
  }
  return p;
}

export interface TrapPlacement { node: NodeSpec; ins: InsSpec }

/** Builder specs for the real node of a card. `speed` is appended to the text; `pause` overrides the default 15 at a STOP. */
export function trapToNodeSpec(card: TrapCard, opts: { speed?: number; pause?: number } = {}): TrapPlacement {
  const node: NodeSpec = {
    kind: card.nodeKind, control: card.control, exits: card.exits.length ? card.exits.map(e => ({ ...e })) : undefined,
    sign: card.sign, sightDistance: card.sightDistance ?? (card.control === 'STOP' ? 700 : 600), label: card.label,
  };
  let pause: number | undefined;
  if (card.control === 'STOP') pause = card.pause === null ? undefined : opts.pause ?? card.pause ?? 15;
  else if (typeof card.pause === 'number') pause = card.pause;
  // the card's own wording first, then the GRIID-004 pause / speed sentences (Column D, 'example' style)
  const parts = [/[.!?]$/.test(card.instructionText) ? card.instructionText : `${card.instructionText}.`];
  if (pause !== undefined && opts.speed !== undefined) parts.push(`Pause ${pause} seconds, then change average speed to ${opts.speed} miles per hour.`);
  else if (pause !== undefined) parts.push(`Pause ${pause} seconds.`);
  else if (opts.speed !== undefined) parts.push(`Change average speed to ${opts.speed} miles per hour.`);
  const ins: InsSpec = { text: parts.join(' '), turn: card.turn, pause, speed: opts.speed, hint: card.hint };
  return { node, ins };
}

export interface DistractorPlacement { node: NodeSpec; beforeFt: number; why: string }

/** Pick one of the card's distractors (if any) with a seeded offset 300-900 ft before the real node. */
export function trapDistractorBefore(card: TrapCard, rng: Rng): DistractorPlacement | null {
  const ds = card.distractors;
  if (!ds || !ds.length) return null;
  const d = rng.pick(ds);
  return { node: { ...d.node, exits: d.node.exits?.map(e => ({ ...e })) }, beforeFt: rng.int(d.minBeforeFt, d.maxBeforeFt), why: d.why };
}

/**
 * GRIID CAMEO as an SVG string: the one renderer in cameo.ts (bold route, thin roads, dashed driveways / lots / dead ends / gravel, names, control glyph, sign face).
 * Throws when the exits do not describe exactly one route.
 */
export function cameoSvg(exits: Exit[], opts: { size?: number; control?: Control; title?: string; sign?: Sign; turn?: TurnDir } = {}): string {
  if (exits.length && exits.filter(e => e.isRoute).length !== 1) throw new Error('cameo: exits must have exactly one route');
  return renderCameo(exits.length ? exits : [{ angle: 0, kind: 'road', isRoute: true }], opts.control, opts.turn ?? null, opts.size ?? 100, { sign: opts.sign ?? null });
}

export function trapCameo(card: TrapCard): string { return cameoSvg(card.exits, { control: card.control, title: card.name, sign: card.sign, turn: card.turn }); }

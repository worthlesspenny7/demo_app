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
    id: 'quoted-sign-mismatch', name: 'Quoted sign must match exactly', category: 'signs',
    instructionText: 'Right at "SMITH RD"', control: 'none', exits: EXITS.sideRoad('R', { route: 'turn', name: 'SMITH RD' }), turn: 'R',
    distractors: [{ node: { exits: EXITS.sideRoad('R', { name: 'SMITH ROAD' }), sightDistance: 500, label: 'Blade reads SMITH ROAD' }, minBeforeFt: 650, maxBeforeFt: 900, why: '"SMITH ROAD" is not "SMITH RD": spelling inside quotes must match exactly' }],
    wrongExits: [{ angle: 0, why: 'Missing the road' }],
    tip: 'Quoted text must appear exactly (case and punctuation ignored, spelling not). Parts of words never count.',
    visual: 'First right has a blade "SMITH ROAD"; the next right is "SMITH RD".',
    source: `${RRH}; Rally WNY generals; ${R04} #10`,
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
    instructionText: 'At "CURVE" sign', control: 'none', exits: [], nodeKind: 'sign', sign: { text: 'CURVE', shape: 'diamond', side: 'R' }, sightDistance: 150, hint: 'Look sharp', speedChange: true,
    wrongExits: [{ angle: 0, why: 'Changing speed late because the sign appears only past the bend' }],
    tip: 'Speed changes happen at the near edge of the sign. When column D says Look sharp, have the driver pre-brief the change.',
    visual: 'Yellow diamond just past a blind bend, visible 150 ft out.',
    source: `Cascade rallymaster guide (near edge); ${R04} #5`,
  },
  {
    id: 'forgotten-pause', name: 'Forgotten pause (column C)', category: 'timing',
    instructionText: 'Left at STOP at T', control: 'STOP', sign: octagon, exits: EXITS.tee('L'), turn: 'L', pause: 15,
    wrongExits: [{ angle: 90, why: 'Right at the T' }],
    tip: 'Pause 15 rides in column C where eyes slide past it. Highlight every pause before the start and set the bezel to 15 minus your stop loss.',
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
    tip: 'Rallymasters put checkpoints in the most inopportune places. Leave the stop exactly on your dwell; there is no road left to recover on.',
    visual: 'Plain 4-way STOP; the green checkpoint sign stands 500-1500 ft past it.',
    source: `docs/research/06 §1 ("most inopportune places"); GEN-007`,
  },
  {
    id: 'speed-at-signal', name: 'Speed change at SIGNAL (leading edge, no pause)', category: 'speed-change',
    instructionText: 'Straight at SIGNAL', control: 'SIGNAL', exits: EXITS.crossroads('S'), turn: 'S', speedChange: true,
    wrongExits: [{ angle: -90, why: 'Wrong side' }, { angle: 90, why: 'Wrong side' }],
    tip: 'No pause is printed at a signal. A red light is a Time Allowance, never a make-up AND a TA. The new speed applies at the leading edge.',
    visual: 'Three-light signal over a crossroads; the route is straight with a new speed.',
    source: `${GR_BASICS} (time allowance); Cascade guide (leading edge); HAZ-005`,
  },
  {
    id: 'rr-crossing', name: 'Speed change at RR crossing', category: 'speed-change',
    instructionText: 'At RR crossing', control: 'RR', exits: [], nodeKind: 'landmark', sign: { text: 'RR', shape: 'rr', side: 'R' }, label: 'RR crossing', speedChange: true,
    wrongExits: [{ angle: 0, why: 'Changing speed at the crossbuck sign instead of the rails' }],
    tip: 'A train is a Time Allowance: start the stopwatch when the gates drop, declare the measured wait at the checkpoint.',
    visual: 'Crossbuck and gates; rails cross the road at the node.',
    source: `${GR_REGS} (TA for trains); HAZ-002`,
  },
];

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
 * GRIID CAMEO as an SVG string: dot = approach, bold line dot->arrow = route, thin = roads not taken,
 * dashed = driveway / lot / dead end / unpaved. Throws when the exits do not describe exactly one route.
 */
export function cameoSvg(exits: Exit[], opts: { size?: number; control?: Control; title?: string } = {}): string {
  if (exits.length && exits.filter(e => e.isRoute).length !== 1) throw new Error('cameo: exits must have exactly one route');
  const S = opts.size ?? 120, cx = S / 2, cy = S * 0.6, L = S * 0.38;
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${esc(opts.title ?? 'CAMEO')}">`];
  out.push(`<line x1="${cx}" y1="${cy + L}" x2="${cx}" y2="${cy}" stroke="currentColor" stroke-width="4"/>`);
  out.push(`<circle cx="${cx}" cy="${cy + L}" r="5" fill="currentColor"/>`);
  for (const e of exits) {
    const a = e.angle * Math.PI / 180;
    const x2 = cx + Math.sin(a) * L, y2 = cy - Math.cos(a) * L;
    const dashed = e.kind !== 'road' || e.surface !== 'paved';
    const w = e.isRoute ? 4 : 1.5;
    out.push(`<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="${w}"${dashed ? ' stroke-dasharray="4 3"' : ''}/>`);
    if (e.isRoute) {
      const hx = x2 - Math.sin(a) * 10, hy = y2 + Math.cos(a) * 10;
      const px = Math.cos(a) * 5, py = Math.sin(a) * 5;
      out.push(`<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(hx + px).toFixed(1)},${(hy + py).toFixed(1)} ${(hx - px).toFixed(1)},${(hy - py).toFixed(1)}" fill="currentColor"/>`);
    }
    if (e.name) out.push(`<text x="${(x2 + Math.sin(a) * 8).toFixed(1)}" y="${(y2 - Math.cos(a) * 8).toFixed(1)}" font-size="8" text-anchor="middle" fill="currentColor">${esc(e.name)}</text>`);
  }
  if (!exits.length) out.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - L}" stroke="currentColor" stroke-width="4"/>`);
  if (opts.control && opts.control !== 'none') out.push(`<text x="${cx + 10}" y="${cy + 4}" font-size="9" font-weight="bold" fill="currentColor">${esc(opts.control)}</text>`);
  out.push('</svg>');
  return out.join('');
}

export function trapCameo(card: TrapCard): string { return cameoSvg(card.exits, { control: card.control, title: card.name }); }

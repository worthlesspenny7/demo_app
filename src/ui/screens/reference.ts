/** Reference: seconds per mile, recovery factors, pause arithmetic, CAMEO legend, GI definitions, rules with citations, and the LESSON-005 pages: penalties (REG V.E), TA procedure (V.H), age factors (V.D), Column C syntax (VII.B.3.c(4)), speed-change positions (VII.E.2) and the handbook's Packard charts. */
import { PACKARD_CHARTS, PACKARD_LABEL, AGE_FACTOR_ROWS, PENALTY_ROWS, TA_STEPS, TA_PATTERN, COLUMN_C_ROWS, SPEED_CHANGE_ROWS, TA_FORM_FIELDS, TA_FORM_NOTE, CHECKPOINT_FACTS, type ChartData } from '../../../content/reference-data.js';
import { FORD_1939 } from '../../core/course.js';
import { stopLoss, rampLead, accelLoss, SPEEDS } from '../../core/perf-table.js';
import { cameoSvg } from '../viewmodels/cameo.js';
import { EXITS } from '../../core/builder.js';
import { app, el } from '../state.js';
import { LESSONS, LESSON_REFERENCE } from '../../../content/lessons.js';
import { renderBlock } from './school.js';

let perfCache: { stop: number[][]; lead: number[][]; accel: number[] } | null = null;
function perf(): { stop: number[][]; lead: number[][]; accel: number[] } {
  if (perfCache) return perfCache;
  const stop: number[][] = [], lead: number[][] = [], accel: number[] = [];
  try {
    for (const v of SPEEDS) { stop.push(SPEEDS.map(w => Math.round(stopLoss(v, w, FORD_1939) * 10) / 10)); lead.push(SPEEDS.map(w => (v === w ? 0 : Math.round(rampLead(v, w, FORD_1939) * 10) / 10))); accel.push(Math.round(accelLoss(v, FORD_1939) * 10) / 10); }
  } catch { /* leave partial */ }
  perfCache = { stop, lead, accel };
  return perfCache;
}

function rt(head: string[], rows: (string | HTMLElement)[][], numFrom = -1): HTMLTableElement {
  const t = el('table', { class: 'reftable' }, el('thead', {}, el('tr', {}, ...head.map((h, i) => el('th', { class: numFrom >= 0 && i >= numFrom ? 'num' : '' }, h)))));
  const tb = el('tbody', {}); for (const r of rows) tb.append(el('tr', {}, ...r.map((c, i) => el('td', { class: numFrom >= 0 && i >= numFrom ? 'num' : '' }, c)))); t.append(tb); return t;
}
const rule = (r: string): HTMLElement => el('span', { class: 'rulecite' }, r);
const fmtNum = (x: number | null): string => (x === null ? '-' : String(x));

function chartTable(c: ChartData): HTMLElement {
  const t = el('table', { class: 'charttable', 'data-chart': c.id }, el('thead', {}, el('tr', {}, el('th', {}, c.rowLabel), ...c.cols.map(w => el('th', {}, String(w))))));
  const tb = el('tbody', {}); for (const r of c.rows) tb.append(el('tr', {}, el('td', {}, String(r.label)), ...r.values.map(v => el('td', {}, fmtNum(v))))); t.append(tb);
  return el('div', { class: 'charttable-wrap' }, t);
}

/** EDU-009: the simulator's Ford answer sheet is open only once D06 is passed (one star at any tier): measure your own chart first. */
export function answerSheetOpen(d06: { stars?: number } | null | undefined): boolean { return (d06?.stars ?? 0) >= 1; }

/** The LESSON-005 reference pages. Each carries its rule number; the Packard charts are labelled as the handbook example. */
function regPanels(): HTMLElement[] {
  const pen = el('div', { class: 'panel', id: 'ref-penalties', style: 'grid-column:1/3' }, el('h3', {}, 'Penalties (REG V.E, II.H.1.i, V.F.1)'), el('p', { class: 'muted' }, 'As printed in the 2026 Event Regulations. The late cap (2 minutes) is lower than the early cap (5 minutes) and lower than a missed checkpoint (3 minutes). Every STOP sign is a full stop, also one with no pause in the book.'),
    rt(['Rule', 'Event', 'Penalty'], PENALTY_ROWS.map(r => [rule(r.rule), r.what, r.penalty])));
  const ta = el('div', { class: 'panel', id: 'ref-ta', style: 'grid-column:1/3' }, el('h3', {}, 'Time Allowance procedure (REG V.H)'), el('p', { class: 'muted' }, 'Wording pattern for the request:'), el('div', { class: 'pattern' }, TA_PATTERN),
    rt(['Rule', 'In plain words'], TA_STEPS.map(r => [rule(r.rule), r.text])));
  const colc = el('div', { class: 'panel', id: 'ref-column-c', style: 'grid-column:1/3' }, el('h3', {}, 'Column C syntax (REG VII.B.3.c(4))'), rt(['Column C shows', 'Meaning'], COLUMN_C_ROWS.map(r => [el('span', { class: 'mono' }, r.shows), r.means])));
  const spd = el('div', { class: 'panel', id: 'ref-speed-change', style: 'grid-column:1/3' }, el('h3', {}, 'Where a speed change happens (REG VII.E.2)'), rt(['Rule', 'Where', 'When'], SPEED_CHANGE_ROWS.map(r => [rule(r.rule), r.where, r.when])));
  const age = el('div', { class: 'panel', id: 'ref-age-factor', style: 'grid-column:1/3' }, el('h3', {}, 'Age factor table (REG V.D)'), el('p', { class: 'muted' }, 'Stage score = raw penalty seconds x the factor for the Scoring Year (not necessarily the model year), rounded to 0.01 s (V.C.2.e). 1954 and later = 1.000, 1953 = 0.915, then 0.005 less per year to 1930 = 0.800, then 0.010 less per year to 1900 = 0.500.'));
  const grid = el('div', { class: 'agefactors' });
  for (let i = 0; i < AGE_FACTOR_ROWS.length; i += 14) grid.append(rt(['Year', 'Factor'], AGE_FACTOR_ROWS.slice(i, i + 14).map(r => [r.year, r.factor.toFixed(3)]), 1));
  age.append(grid);
  const pack = el('div', { class: 'panel', id: 'ref-packard', style: 'grid-column:1/3' }, el('h3', {}, `The three handbook charts: ${PACKARD_LABEL}`), el('p', { class: 'muted' }, 'Net seconds, IN speed in the rows and OUT speed in the columns. Teams make their own charts (HB Appendix B); a rookie with no time may use these as-is ("better than nothing"). The 1939 Ford card above is the simulator\'s own car model (simulator default, measure your car).'));
  for (const c of PACKARD_CHARTS) pack.append(el('h3', { style: 'margin-top:12px' }, `${c.title} (${PACKARD_LABEL})`), el('p', { class: 'cite' }, c.note), chartTable(c));
  return [pen, ta, ...schoolPanels(), colc, spd, age, pack];
}

/** LESSON-008: the "Rally school" panel: the 2026 TA web form fields and the checkpoint facts, each with its video and timestamp; video-only items are labelled. */
function schoolPanels(): HTMLElement[] {
  const label = (inDocs: boolean): string => (inDocs ? '' : ' (video, not in the documents)');
  const panel = el('div', { class: 'panel', id: 'ref-rally-school', style: 'grid-column:1/3' }, el('h3', {}, 'Rally school'), el('p', { class: 'muted' }, 'From the official rally school videos (see the lesson "What the rally school adds"). Each row names its video and caption timestamp; where only a video says it, the row is labelled.'),
    el('h3', { id: 'ref-ta-form', style: 'margin-top:10px' }, 'The Time Allowance web form'), el('p', { class: 'muted' }, TA_FORM_NOTE),
    rt(['Field', 'Example', 'What to put', 'Source'], TA_FORM_FIELDS.map(f => [el('span', { 'data-field': f.id }, `${f.field} [${f.form}]`), f.example, `${f.note}${label(f.inDocs)}`, el('span', { class: 'cite' }, f.cite)])),
    el('h3', { id: 'ref-checkpoints', style: 'margin-top:12px' }, 'The checkpoint facts'), el('p', { class: 'muted' }, 'Green = do nothing, red = stop, never 5 mph or slower in sight of a green one.'),
    rt(['Fact', 'Source', 'Also in the documents'], CHECKPOINT_FACTS.map(f => [f.fact, el('span', { class: 'cite' }, f.cite), f.doc ?? '(video, not in the documents)'])));
  return [panel];
}

export function renderReference(root: HTMLElement, sub?: string): void {
  const page = el('div', { class: 'page ref' }, el('h1', {}, 'Reference'), el('p', { class: 'muted' }, 'Everything here is legal on paper in the car. Calculators are not.'));
  const g = el('div', { class: 'grid2' });
  // seconds per mile
  const spm = el('div', { class: 'panel' }, el('h3', {}, 'Seconds per mile (SCCA / odometer-style rallies only)'), el('p', { class: 'muted' }, '3600 / mph. A 0.1-mile error at 30 mph is 12 s. The Great Race covers the odometer and gives no distances, so this table is odometer-rally arithmetic, not a Great Race tool.'));
  const t1 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'mph'), el('th', { class: 'num' }, 's / mile'), el('th', { class: 'num' }, 's / 0.1 mile'), el('th', { class: 'num' }, 'ft / s'))));
  const tb1 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb1.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (3600 / v).toFixed(1)), el('td', { class: 'num' }, (360 / v).toFixed(1)), el('td', { class: 'num' }, (v * 1.46667).toFixed(1)))); t1.append(tb1); spm.append(t1);
  // recovery factors
  const rec = el('div', { class: 'panel' }, el('h3', {}, 'Recovery factors'), el('p', { class: 'muted' }, 'On your stopwatch, holding +d mph recovers E seconds after t = E x v / d seconds: +5 mph needs v/5 watch seconds per second owed, +10 mph needs v/10 (8 s late at 35: 40 mph for 56 s). The 10 % rule (10 % over for 10x the delay) and the 20 % rule (5x) are the same formula and are exact on the watch. In ghost time the factors are v/d + 1 (the older table), which a watch cannot show.'));
  const t2 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'assigned'), el('th', { class: 'num' }, '+5 mph: watch s per s (v/5)'), el('th', { class: 'num' }, '+10 mph: watch s per s (v/10)'), el('th', { class: 'num' }, '10 % rule'), el('th', { class: 'num' }, '20 % rule'))));
  const tb2 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb2.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (v / 5).toFixed(1)), el('td', { class: 'num' }, (v / 10).toFixed(1)), el('td', { class: 'num' }, `${(v * 1.1).toFixed(1)} for 10x`), el('td', { class: 'num' }, `${(v * 1.2).toFixed(1)} for 5x`))); t2.append(tb2); rec.append(t2, el('p', { class: 'warn', id: 'ref-speed-caution' }, 'Caution: every make-up speed stays at or below the posted limit (HB p.1; Making Up Time, video). The 20 % column on 55 is 66 mph: illegal on most roads, and dangerous or reckless driving, which may include speeding, is a disqualification (REG V.F.1.c). On a fast road use the 10 % rule or make the time up in chunks.'));   // ENG-028 (realism v4 slip 8)
  // pause arithmetic / performance table
  const P = perf();
  const d06 = answerSheetOpen(app.progress.get('D06'));
  const pa = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Pause arithmetic: the 1939 Ford performance card (simulator default, measure your car)'), el('p', { class: 'muted' }, 'dwell = printed pause - stop/start loss (entry -> exit). Every number on this card is a simulator default from the car model (DESIGN §12), not Dad\'s Ford: measure your car (lesson "Measure your car", HB Appendix B, four runs per speed). A stop that is also a turn loses a little more (the car crawls through the turn): the cockpit card and the Debrief include it, the straight-stop table below does not. Standing-start loss (leave early by this at the start line): ' + SPEEDS.map((v, i) => `${v}: ${P.accel[i] ?? '?'} s`).join(', ') + '.'));
  // EDU-009: the answer sheet stays closed until D06 is passed (measure first); after that it opens, to compare with your own chart
  const answerSheet = el('details', { id: 'answer-sheet' }, el('summary', {}, d06 ? 'The simulator\'s Ford table (you passed D06: compare it with your own measured chart)' : 'The simulator\'s Ford table (answer sheet, closed until you pass D06: measure these yourself first; Gold and legal runs hide the card)'));
  if (d06) answerSheet.setAttribute('open', '');
  const t3 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'in \\ out'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb3 = el('tbody', {}); SPEEDS.forEach((v, i) => tb3.append(el('tr', {}, el('td', {}, `${v} in`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.stop[i]?.[j] ?? '?')))))); t3.append(tb3);
  answerSheet.append(el('h3', {}, 'Stop/start loss (s)'), t3);
  const t4 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'from \\ to'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb4 = el('tbody', {}); SPEEDS.forEach((v, i) => tb4.append(el('tr', {}, el('td', {}, `${v}`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.lead[i]?.[j] ?? '?')))))); t4.append(tb4);
  answerSheet.append(el('h3', {}, 'Ramp lead (s): call the new speed this early so the ramp straddles the landmark'), t4);
  pa.append(answerSheet);
  // CAMEO legend
  const cam = el('div', { class: 'panel' }, el('h3', {}, 'CAMEO legend'));
  const legend = el('div', { style: 'display:grid;grid-template-columns:120px 1fr;gap:6px 10px;align-items:center;color:var(--text)' });
  const items: [string, string][] = [
    [cameoSvg(EXITS.crossroads('R'), 'STOP', 'R'), 'Dot = road you arrive on. Arrow = road you leave on. Bold = route. Thin = roads not taken. The octagon is the control on your approach.'],
    [cameoSvg(EXITS.tee('L'), 'none', 'L'), 'T: your road ends. Without a callout the driver stops and asks.'],
    [cameoSvg(EXITS.wye('BR'), 'none', 'BR'), 'Y: bear right (20-60 degrees). "Bear" is not "turn". (Simulator convention, not in the documents.)'],
    [cameoSvg(EXITS.sideRoad('R', { kind: 'driveway' }), 'none', 'S'), 'Dashed = driveway, lot, dead end, private, unpaved: not a road. Continue straight.'],
    [cameoSvg([{ angle: 0, surface: 'paved', kind: 'road', isRoute: false }, { angle: 150, surface: 'paved', kind: 'road', isRoute: true }], 'YIELD', 'AR'), 'Acute right (more than 120 degrees) at a YIELD. (Simulator convention, not in the documents.)'],
    [cameoSvg(EXITS.crossroads('S'), 'SIGNAL', 'S'), 'Straight through a signal. A traffic light is not one of the delays V.H.1 names for a Time Allowance (a train blocking the route, assisting at an accident).'],
    // SIGN-001 / GRIID-015: the sign faces as the 2014 and 2019 sheets draw them (11a section 3), inside the box, on the side of the road they stand
    [cameoSvg(EXITS.straightRoad(), 'none', 'S', 64, { sign: { text: 'SPEED LIMIT 65', shape: 'speedlimit', side: 'R' } }), '"Speed Limit 65": the posted limit, NOT your assigned speed (the sheet shows Speed Limit 65 over an assigned 50 MPH). A sign to the right of the arrow stands on the right.'],
    [cameoSvg(EXITS.straightRoad(), 'none', 'S', 64, { sign: { text: 'CURVE', shape: 'curve', side: 'L', plaque: 35 } }), 'A white warning diamond with a pictogram (curve, reverse curve, stop ahead, speed limit ahead, crossroad) and a plaque under it: the advisory speed, large number over MPH.'],
    [cameoSvg(EXITS.straightRoad(), 'none', 'S', 64, { sign: { text: 'LEAVING ELDORA CITY LIMIT', shape: 'rect', side: 'O' } }), 'A box centred on the arrow is an overhead sign. Sign legends are printed in mixed case; a white-on-black box is a business sign.'],
    [cameoSvg(EXITS.straightRoad(), 'RR', 'S', 64, { sign: { text: 'RR', shape: 'rr-advance', side: 'R' } }), 'Railroad: the round RR sign, then the tracks (two rails with ties) with a yield triangle. A train is a Time Allowance delay.'],
  ];
  for (const [svg, text] of items) legend.append(el('div', { html: svg }), el('div', { style: 'font-size:13px' }, text));
  legend.querySelectorAll('svg.cameo').forEach(v => { (v as SVGElement).setAttribute('style', 'width:112px;height:auto;background:#fff;color:#111;border-radius:3px'); });
  cam.append(legend);
  // GI definitions
  const gi = el('div', { class: 'panel' }, el('h3', {}, 'General Instructions: definitions'));
  const defs: [string, string][] = [
    ['Pause: "0 MPH / 0m15s / 45 MPH"', 'Column C stacks the speed you stop to (0 MPH), the pause (0m15s) and the speed you leave at (45 MPH). Add the pause to the perfect time at this point. Add N seconds to the perfect time at this point. The ghost spends N seconds standing still; you spend N minus your stop/start loss.'],
    ['Timed segment: "30 MPH / 0m36s / 45 MPH"', 'Column C stacks the speed to hold, how long (0m36s) and the speed to change to. Hold 30 for 36 s counted from the ghost\'s departure from the landmark (arrival plus any pause), then 40. Call the change half a ramp early.'],
    ['Speed change at a landmark', 'REG VII.E.2: at a sign or landmark when the front tires come even with it; at an intersection, at the referenced sign if there is one, otherwise at the centre of the intersection or the apex of the turn. Handbook: split the speed change at the sign, crossing it at the midpoint speed. Be mid-ramp as the bumper passes it.'],
    ['Checkpoint', 'A hidden timing line; your crossing is recorded to the second and the next leg is timed from it. Never stop or travel 5 MPH or slower within sight of a Timing Checkpoint: 30 s (REG V.E.3.a).'],
    ['Observation checkpoint', 'A manned stop (typically the finish, where you also submit any Time Allowance Requests). Missing one costs 3 minutes, or DNF/FNS for the final one (REG V.E.2.c-d).'],
    ['Time Allowance (TA)', 'Request the seconds a train or an accident held you (V.H.1; V.H.5\'s own example is a farm tractor), in multiples of 10 s, by the method printed in the day\'s instructions (web page, phone, or at the Observation Checkpoint; in 2026 the web form) at the TA point within the time it gives (REG V.H; see the TA procedure below). The committee denies time you could have made up. The measured delay is the time stopped plus the chart stop-and-go loss for your speeds (Time Delay Form [01:38], [04:44]; video, not in the documents). Never also make the same seconds up.'],
    ['Ace', 'A checkpoint crossed at exactly the perfect second (error 0).'],
    ['Age factor', 'Raw seconds times a factor for the car\'s year: 0.845 for a 1939 car.'],
    ['Transit / free zone', 'A transit has no timing checkpoints and no assigned speed: a time for the passage (or a restart time at its end) is given, and transit times are part of the scoring time (glossary; REG V.B.2.c), so it is not scored but not untimed: an exact transit ("take exactly") must be left on IN + interval. A free zone has no timing checkpoint (section symbols in Column B).'],
    ['Early restart', 'Leaving a promoted lunch, pit or rest stop more than 5 minutes before its scheduled departure costs 1 minute, then 5 minutes (REG V.E.3.h). Go at the printed out-time minus your standing-start loss; a restart hold is not a stop.'],
  ];
  const dl = el('dl', {}); for (const [k, v] of defs) dl.append(el('dt', { style: 'font-weight:700;margin-top:6px' }, k), el('dd', { style: 'margin:0 0 4px 0;color:var(--muted)' }, v)); gi.append(dl);
  // rules summary with citations
  const rules = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Rules summary (with sources)'));
  const rl = el('ul', {});
  const cites: [string, string][] = [
    ['Permitted timing equipment: one analog speedometer, one analog time-of-day clock with no digital readout (II.H.1.d(1)), one stopwatch that may be digital or analog with split and time-of-day functions (II.H.1.d(3)), analog wristwatches (II.H.1.d(2)); calculators prohibited; a cellular phone only for emergencies and for submitting Time Allowance Requests (II.H.1.i), its clock, calculator and maps never; paper tables legal; odometer covered.', 'docs/research/09 §5 (REG II.H.1.d, II.H.1.i); docs/research/01-great-race-rules-and-format.md §1'],
    ['Scoring: one point per second early or late at each hidden checkpoint; Ace = 0; capped at 2 minutes late and 5 minutes early per checkpoint, 3 minutes for a missed one (REG V.E.1-2); stage raw multiplied by the age factor (1939 Ford: 0.845).', 'docs/research/01 §3; docs/research/07 §7; DESIGN §10'],
    ['The perfect time is integrated by a ghost car with instantaneous speed changes; pauses add the printed seconds; the leg clock resets at every checkpoint.', 'docs/research/07 §1, §4; DESIGN §4'],
    ['Stop/start and speed-change losses are measured per car (performance table); teams subtract them from the printed pause ("34 not 36").', 'docs/research/07 §2.1-2.3; docs/research/03 §1.7'],
    ['Calibration run each morning: k = perfect / actual; indicated speed to hold = assigned / k; a 1 % error is about 9 s over 15 minutes.', 'docs/research/07 §3; DESIGN §12'],
    ['Recovery: 10 % over for 10x the delay or 20 % over for 5x (exact on the stopwatch: t = E x v / d); penalties are symmetric so never overshoot into early; stop correcting before likely checkpoint spots.', 'docs/research/03 §4.3; docs/research/07 §6'],
    ['Time allowances are requested by the method printed in the day\'s instructions (web page, phone, or at the Observation Checkpoint), at the TA point, within the time it gives (15 minutes in the 2026 example), in multiples of 10 s, for delays beyond your control that V.H.1 names (a train, an accident); the committee denies time you could have made up.', 'docs/research/09 §14 (REG V.H); docs/research/08 §6'],
    ['Typical scores: champions about 1 s per leg; a normal rookie day is 20-46 s (Team Hagerty 34, 46 and 20 s; 13 s is the best rookie on record); well over 46 s is a blown day.', 'docs/research/06 §4; STATUS.md key facts'],
    ['Course following: dashed CAMEO lines are driveways/lots/unpaved/dead ends; spelling is supposed to be exact but there are no traps based on spelling, and a referenced sign may be quoted in whole or in part (REG VII.D); never go past the leading edge of an intersection you are unsure of.', 'docs/research/04 §2.2, §4; REQUIREMENTS P8'],
  ];
  for (const [t, c] of cites) rl.append(el('li', {}, t, ' ', el('span', { class: 'cite' }, `[${c}]`)));
  rules.append(rl, el('p', { class: 'cite' }, 'Penalty and Time Allowance values come from the 2026 Event Regulations (docs/research/09-event-regulations-2026.md, REG V.E and V.H); the tables below quote them with their rule numbers. The regulations list no penalty for starting late: the leg score is the penalty.'));
  g.append(spm, rec, pa, cam, gi, rules, ...regPanels(), lessonPanel());
  page.append(g);
  root.replaceChildren(page);
  // PLAY-048: a lesson's "On the Reference page" link opens #/reference/<id> at its section
  if (sub) { const t = (page.querySelector(`#ref-lesson-${CSS.escape(sub)}`) ?? page.querySelector(`#ref-${CSS.escape(sub)}`)) as HTMLElement | null; if (t) { t.classList.add('ref-target'); try { t.scrollIntoView({ block: 'start' }); } catch { /* jsdom */ } } }
}

/** PLAY-048: the tables, lists and worked examples the evening-one lessons link to (every rule kept, with its source). */
function lessonPanel(): HTMLElement {
  const panel = el('div', { class: 'panel', id: 'ref-from-lessons', style: 'grid-column:1/3' }, el('h3', {}, 'From the lessons'), el('p', { class: 'muted' }, 'The tables and lists the lessons link to. Each section names the lesson it belongs to.'));
  for (const r of LESSON_REFERENCE) {
    const title = LESSONS.find(l => l.id === r.lesson)?.title ?? r.lesson;
    const sec = el('section', { class: 'ref-lesson', id: `ref-lesson-${r.id}` }, el('h4', {}, r.title), el('p', { class: 'cite' }, 'From the lesson ', el('a', { href: `#/school/${r.lesson}` }, title)));
    for (const b of r.blocks) sec.append(renderBlock(b));
    panel.append(sec);
  }
  return panel;
}

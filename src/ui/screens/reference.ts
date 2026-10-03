/** Reference: seconds per mile, recovery factors, pause arithmetic, CAMEO legend, GI definitions, rules with citations, and the LESSON-005 pages: penalties (REG V.E), TA procedure (V.H), age factors (V.D), Column C syntax (VII.B.3.c(4)), speed-change positions (VII.E.2) and the handbook's Packard charts. */
import { PACKARD_CHARTS, PACKARD_LABEL, AGE_FACTOR_ROWS, PENALTY_ROWS, TA_STEPS, TA_PATTERN, COLUMN_C_ROWS, SPEED_CHANGE_ROWS, type ChartData } from '../../../content/reference-data.js';
import { FORD_1939 } from '../../core/course.js';
import { stopLoss, rampLead, accelLoss, SPEEDS } from '../../core/perf-table.js';
import { cameoSvg } from '../viewmodels/cameo.js';
import { EXITS } from '../../core/builder.js';
import { app, el } from '../state.js';

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

/** The LESSON-005 reference pages. Each carries its rule number; the Packard charts are labelled as the handbook example. */
function regPanels(): HTMLElement[] {
  const pen = el('div', { class: 'panel', id: 'ref-penalties', style: 'grid-column:1/3' }, el('h3', {}, 'Penalties (REG V.E)'), el('p', { class: 'muted' }, 'As printed in the 2026 Event Regulations. The late cap (2 minutes) is lower than the early cap (5 minutes) and lower than a missed checkpoint (3 minutes).'),
    rt(['Rule', 'Event', 'Penalty'], PENALTY_ROWS.map(r => [rule(r.rule), r.what, r.penalty])));
  const ta = el('div', { class: 'panel', id: 'ref-ta', style: 'grid-column:1/3' }, el('h3', {}, 'Time Allowance procedure (REG V.H)'), el('p', { class: 'muted' }, 'Wording pattern for the request:'), el('div', { class: 'pattern' }, TA_PATTERN),
    rt(['Rule', 'In plain words'], TA_STEPS.map(r => [rule(r.rule), r.text])));
  const colc = el('div', { class: 'panel', id: 'ref-column-c', style: 'grid-column:1/3' }, el('h3', {}, 'Column C syntax (REG VII.B.3.c(4))'), rt(['Column C shows', 'Meaning'], COLUMN_C_ROWS.map(r => [el('span', { class: 'mono' }, r.shows), r.means])));
  const spd = el('div', { class: 'panel', id: 'ref-speed-change', style: 'grid-column:1/3' }, el('h3', {}, 'Where a speed change happens (REG VII.E.2)'), rt(['Rule', 'Where', 'When'], SPEED_CHANGE_ROWS.map(r => [rule(r.rule), r.where, r.when])));
  const age = el('div', { class: 'panel', id: 'ref-age-factor', style: 'grid-column:1/3' }, el('h3', {}, 'Age factor table (REG V.D)'), el('p', { class: 'muted' }, 'Stage score = raw penalty seconds x the factor for the Scoring Year (not necessarily the model year), rounded to 0.01 s (V.C.2.e). 1954 and later = 1.000, 1953 = 0.915, then 0.005 less per year to 1930 = 0.800, then 0.010 less per year to 1900 = 0.500.'));
  const grid = el('div', { class: 'agefactors' });
  for (let i = 0; i < AGE_FACTOR_ROWS.length; i += 14) grid.append(rt(['Year', 'Factor'], AGE_FACTOR_ROWS.slice(i, i + 14).map(r => [r.year, r.factor.toFixed(3)]), 1));
  age.append(grid);
  const pack = el('div', { class: 'panel', id: 'ref-packard', style: 'grid-column:1/3' }, el('h3', {}, `The three handbook charts: ${PACKARD_LABEL}`), el('p', { class: 'muted' }, 'Net seconds, IN speed in the rows and OUT speed in the columns. Teams make their own charts (HB Appendix B); a rookie with no time may use these as-is ("better than nothing"). The 1939 Ford card above is the sim\'s own car.'));
  for (const c of PACKARD_CHARTS) pack.append(el('h3', { style: 'margin-top:12px' }, `${c.title} (${PACKARD_LABEL})`), el('p', { class: 'cite' }, c.note), chartTable(c));
  return [pen, ta, colc, spd, age, pack];
}

export function renderReference(root: HTMLElement): void {
  const page = el('div', { class: 'page ref' }, el('h1', {}, 'Reference'), el('p', { class: 'muted' }, 'Everything here is legal on paper in the car. Calculators are not.'));
  const g = el('div', { class: 'grid2' });
  // seconds per mile
  const spm = el('div', { class: 'panel' }, el('h3', {}, 'Seconds per mile (SCCA / odometer-style rallies only)'), el('p', { class: 'muted' }, '3600 / mph. A 0.1-mile error at 30 mph is 12 s. The Great Race covers the odometer and gives no distances, so this table is odometer-rally arithmetic, not a Great Race tool.'));
  const t1 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'mph'), el('th', { class: 'num' }, 's / mile'), el('th', { class: 'num' }, 's / 0.1 mile'), el('th', { class: 'num' }, 'ft / s'))));
  const tb1 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb1.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (3600 / v).toFixed(1)), el('td', { class: 'num' }, (360 / v).toFixed(1)), el('td', { class: 'num' }, (v * 1.46667).toFixed(1)))); t1.append(tb1); spm.append(t1);
  // recovery factors
  const rec = el('div', { class: 'panel' }, el('h3', {}, 'Recovery factors'), el('p', { class: 'muted' }, 'On your stopwatch, holding +d mph recovers E seconds after t = E x v / d seconds: +5 mph needs v/5 watch seconds per second owed, +10 mph needs v/10 (8 s late at 35: 40 mph for 56 s). The 10 % rule (10 % over for 10x the delay) and the 20 % rule (5x) are the same formula and are exact on the watch. In ghost time the factors are v/d + 1 (the older table), which a watch cannot show.'));
  const t2 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'assigned'), el('th', { class: 'num' }, '+5 mph: watch s per s (v/5)'), el('th', { class: 'num' }, '+10 mph: watch s per s (v/10)'), el('th', { class: 'num' }, '10 % rule'), el('th', { class: 'num' }, '20 % rule'))));
  const tb2 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb2.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (v / 5).toFixed(1)), el('td', { class: 'num' }, (v / 10).toFixed(1)), el('td', { class: 'num' }, `${(v * 1.1).toFixed(1)} for 10x`), el('td', { class: 'num' }, `${(v * 1.2).toFixed(1)} for 5x`))); t2.append(tb2); rec.append(t2);
  // pause arithmetic / performance table
  const P = perf();
  const d06 = (app.progress.get('D06')?.stars ?? 0) >= 1;
  const pa = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Pause arithmetic: the 1939 Ford performance card'), el('p', { class: 'muted' }, 'dwell = printed pause - stop/start loss (entry -> exit). Measured by simulating the car model (DESIGN §12); your real car needs four runs per speed. A stop that is also a turn loses a little more (the car crawls through the turn): the cockpit card and the Debrief include it, the straight-stop table below does not. Standing-start loss (leave early by this at the start line): ' + SPEEDS.map((v, i) => `${v}: ${P.accel[i] ?? '?'} s`).join(', ') + '.'));
  const answerSheet = el('details', { id: 'answer-sheet' }, el('summary', {}, d06 ? 'Show the true Ford table anyway (you passed D06: build and use your own measured table)' : 'The true Ford table (answer sheet: in D06 you measure these yourself; Gold and legal runs hide the card)'));
  if (!d06) answerSheet.setAttribute('open', '');
  const t3 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'in \\ out'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb3 = el('tbody', {}); SPEEDS.forEach((v, i) => tb3.append(el('tr', {}, el('td', {}, `${v} in`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.stop[i]?.[j] ?? '?')))))); t3.append(tb3);
  answerSheet.append(el('h3', {}, 'Stop/start loss (s)'), t3);
  const t4 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'from \\ to'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb4 = el('tbody', {}); SPEEDS.forEach((v, i) => tb4.append(el('tr', {}, el('td', {}, `${v}`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.lead[i]?.[j] ?? '?')))))); t4.append(tb4);
  answerSheet.append(el('h3', {}, 'Ramp lead (s): call the new speed this early so the ramp straddles the landmark'), t4);
  pa.append(answerSheet);
  // CAMEO legend
  const cam = el('div', { class: 'panel' }, el('h3', {}, 'CAMEO legend'));
  const legend = el('div', { style: 'display:grid;grid-template-columns:72px 1fr;gap:6px 10px;align-items:center;color:var(--text)' });
  const items: [string, string][] = [
    [cameoSvg(EXITS.crossroads('R'), 'STOP', 'R'), 'Dot = road you arrive on. Arrow = road you leave on. Bold = route. Thin = roads not taken. The octagon is the control on your approach.'],
    [cameoSvg(EXITS.tee('L'), 'none', 'L'), 'T: your road ends. Without a callout the driver stops and asks.'],
    [cameoSvg(EXITS.wye('BR'), 'none', 'BR'), 'Y: bear right (20-60 degrees). "Bear" is not "turn".'],
    [cameoSvg(EXITS.sideRoad('R', { kind: 'driveway' }), 'none', 'S'), 'Dashed = driveway, lot, dead end, private, unpaved: not a road. Continue straight.'],
    [cameoSvg([{ angle: 0, surface: 'paved', kind: 'road', isRoute: false }, { angle: 150, surface: 'paved', kind: 'road', isRoute: true }], 'YIELD', 'AR'), 'Acute right (more than 120 degrees) at a YIELD.'],
    [cameoSvg(EXITS.crossroads('S'), 'SIGNAL', 'S'), 'Straight through a signal. A red light may qualify for a Time Allowance.'],
  ];
  for (const [svg, text] of items) legend.append(el('div', { html: svg }), el('div', { style: 'font-size:13px' }, text));
  cam.append(legend);
  // GI definitions
  const gi = el('div', { class: 'panel' }, el('h3', {}, 'General Instructions: definitions'));
  const defs: [string, string][] = [
    ['Pause: "0 MPH / 0m15s / 45 MPH"', 'Column C stacks the speed you stop to (0 MPH), the pause (0m15s) and the speed you leave at (45 MPH). Add the pause to the perfect time at this point. Add N seconds to the perfect time at this point. The ghost spends N seconds standing still; you spend N minus your stop/start loss.'],
    ['Timed segment: "30 MPH / 0m36s / 45 MPH"', 'Column C stacks the speed to hold, how long (0m36s) and the speed to change to. Hold 30 for 36 s counted from the ghost\'s departure from the landmark (arrival plus any pause), then 40. Call the change half a ramp early.'],
    ['Speed change at a landmark', 'REG VII.E.2: at a sign or landmark when the front tires come even with it; at an intersection, at the referenced sign if there is one, otherwise at the centre of the intersection or the apex of the turn. Handbook: split the speed change at the sign, crossing it at the midpoint speed. Be mid-ramp as the bumper passes it.'],
    ['Checkpoint', 'A hidden timing line; your crossing is recorded to the second and the next leg is timed from it. Never stop or travel 5 MPH or slower within sight of a Timing Checkpoint: 30 s (REG V.E.3.a).'],
    ['Observation checkpoint', 'A manned stop (typically the finish, where you also submit any Time Allowance Requests). Missing one costs 3 minutes, or DNF/FNS for the final one (REG V.E.2.c-d).'],
    ['Time Allowance (TA)', 'Request the seconds a train or an accident held you, in multiples of 10 s, at the TA point within 15 minutes (REG V.H; see the TA procedure below). The committee denies time you could have made up. Only the wait is creditable, not your braking and acceleration loss. Never also make the time up.'],
    ['Ace', 'A checkpoint crossed at exactly the perfect second (error 0).'],
    ['Age factor', 'Raw seconds times a factor for the car\'s year: 0.845 for a 1939 car.'],
    ['Transit / free zone', 'Untimed sections between legs (section symbols in Column B). Drive normally, reset for the next start time.'],
    ['Early restart', 'Leaving a promoted lunch, pit or rest stop more than 5 minutes before its scheduled departure costs 1 minute, then 5 minutes (REG V.E.3.h). Go at the printed out-time minus your standing-start loss; a restart hold is not a stop.'],
  ];
  const dl = el('dl', {}); for (const [k, v] of defs) dl.append(el('dt', { style: 'font-weight:700;margin-top:6px' }, k), el('dd', { style: 'margin:0 0 4px 0;color:var(--muted)' }, v)); gi.append(dl);
  // rules summary with citations
  const rules = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Rules summary (with sources)'));
  const rl = el('ul', {});
  const cites: [string, string][] = [
    ['Permitted timing equipment: one analog speedometer, one analog time-of-day clock, one stopwatch; calculators and phones prohibited; paper tables legal; odometer covered.', 'docs/research/01-great-race-rules-and-format.md §1; docs/research/05 §5.3; REQUIREMENTS §0'],
    ['Scoring: one point per second early or late at each hidden checkpoint; Ace = 0; capped at 2 minutes late and 5 minutes early per checkpoint, 3 minutes for a missed one (REG V.E.1-2); stage raw multiplied by the age factor (1939 Ford: 0.845).', 'docs/research/01 §3; docs/research/07 §7; DESIGN §10'],
    ['The perfect time is integrated by a ghost car with instantaneous speed changes; pauses add the printed seconds; the leg clock resets at every checkpoint.', 'docs/research/07 §1, §4; DESIGN §4'],
    ['Stop/start and speed-change losses are measured per car (performance table); teams subtract them from the printed pause ("34 not 36").', 'docs/research/07 §2.1-2.3; docs/research/03 §1.7'],
    ['Calibration run each morning: k = perfect / actual; indicated speed to hold = assigned / k; a 1 % error is about 9 s over 15 minutes.', 'docs/research/07 §3; DESIGN §12'],
    ['Recovery: 10 % over for 10x the delay or 20 % over for 5x (exact on the stopwatch: t = E x v / d); penalties are symmetric so never overshoot into early; stop correcting before likely checkpoint spots.', 'docs/research/03 §4.3; docs/research/07 §6'],
    ['Time allowances are requested at the TA point within 15 minutes, in multiples of 10 s, for delays beyond your control (a train, an accident); the committee denies time you could have made up.', 'docs/research/09 §14 (REG V.H); docs/research/08 §6'],
    ['Typical scores: champions about 1 s per leg; a normal rookie day is 20-46 s (Team Hagerty 34, 46 and 20 s; 13 s is the best rookie on record); well over 46 s is a blown day.', 'docs/research/06 §4; STATUS.md key facts'],
    ['Course following: dashed CAMEO lines are driveways/lots/unpaved/dead ends; quoted signs must match exactly; never go past the leading edge of an intersection you are unsure of.', 'docs/research/04 §2.2, §4; REQUIREMENTS P8'],
  ];
  for (const [t, c] of cites) rl.append(el('li', {}, t, ' ', el('span', { class: 'cite' }, `[${c}]`)));
  rules.append(rl, el('p', { class: 'cite' }, 'Penalty and Time Allowance values come from the 2026 Event Regulations (docs/research/09-event-regulations-2026.md, REG V.E and V.H); the tables below quote them with their rule numbers. The regulations list no penalty for starting late: the leg score is the penalty.'));
  g.append(spm, rec, pa, cam, gi, rules, ...regPanels());
  page.append(g);
  root.replaceChildren(page);
}

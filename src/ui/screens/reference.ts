/** Reference: seconds per mile, recovery factors, pause arithmetic, CAMEO legend, GI definitions, rules with citations. */
import { FORD_1939 } from '../../core/course.js';
import { stopLoss, rampLead, accelLoss, SPEEDS } from '../../core/perf-table.js';
import { cameoSvg } from '../viewmodels/cameo.js';
import { EXITS } from '../../core/builder.js';
import { el } from '../state.js';

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

export function renderReference(root: HTMLElement): void {
  const page = el('div', { class: 'page ref' }, el('h1', {}, 'Reference'), el('p', { class: 'muted' }, 'Everything here is legal on paper in the car. Calculators are not.'));
  const g = el('div', { class: 'grid2' });
  // seconds per mile
  const spm = el('div', { class: 'panel' }, el('h3', {}, 'Seconds per mile'), el('p', { class: 'muted' }, '3600 / mph. A 0.1-mile error at 30 mph is 12 s.'));
  const t1 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'mph'), el('th', { class: 'num' }, 's / mile'), el('th', { class: 'num' }, 's / 0.1 mile'), el('th', { class: 'num' }, 'ft / s'))));
  const tb1 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb1.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (3600 / v).toFixed(1)), el('td', { class: 'num' }, (360 / v).toFixed(1)), el('td', { class: 'num' }, (v * 1.46667).toFixed(1)))); t1.append(tb1); spm.append(t1);
  // recovery factors
  const rec = el('div', { class: 'panel' }, el('h3', {}, 'Recovery factors'), el('p', { class: 'muted' }, 'Seconds of ghost time at the higher speed needed to make up one second: (v / 5 + 1) at +5 mph, (v / 10 + 1) at +10. Field rule: 10 % over for 10x the delay, 20 % over for 5x (slightly conservative on purpose).'));
  const t2 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'assigned'), el('th', { class: 'num' }, '+5 mph: s per s'), el('th', { class: 'num' }, '+10 mph: s per s'), el('th', { class: 'num' }, '10 % rule'), el('th', { class: 'num' }, '20 % rule'))));
  const tb2 = el('tbody', {}); for (let v = 20; v <= 60; v += 5) tb2.append(el('tr', {}, el('td', {}, String(v)), el('td', { class: 'num' }, (v / 5 + 1).toFixed(0)), el('td', { class: 'num' }, (v / 10 + 1).toFixed(0)), el('td', { class: 'num' }, `${(v * 1.1).toFixed(1)} for 10x`), el('td', { class: 'num' }, `${(v * 1.2).toFixed(1)} for 5x`))); t2.append(tb2); rec.append(t2);
  // pause arithmetic / performance table
  const P = perf();
  const pa = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Pause arithmetic: the 1939 Ford performance card'), el('p', { class: 'muted' }, 'dwell = printed pause - stop/start loss (entry -> exit). Measured by simulating the car model (DESIGN §12); your real car needs four runs per speed. Standing-start loss (leave early by this at the start line): ' + SPEEDS.map((v, i) => `${v}: ${P.accel[i] ?? '?'} s`).join(', ') + '.'));
  const t3 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'in \\ out'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb3 = el('tbody', {}); SPEEDS.forEach((v, i) => tb3.append(el('tr', {}, el('td', {}, `${v} in`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.stop[i]?.[j] ?? '?')))))); t3.append(tb3);
  pa.append(el('h3', {}, 'Stop/start loss (s)'), t3);
  const t4 = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'from \\ to'), ...SPEEDS.map(w => el('th', { class: 'num' }, String(w))))));
  const tb4 = el('tbody', {}); SPEEDS.forEach((v, i) => tb4.append(el('tr', {}, el('td', {}, `${v}`), ...SPEEDS.map((_, j) => el('td', { class: 'num' }, String(P.lead[i]?.[j] ?? '?')))))); t4.append(tb4);
  pa.append(el('h3', {}, 'Ramp lead (s): call the new speed this early so the ramp straddles the landmark'), t4);
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
    ['Pause N', 'Add N seconds to the perfect time at this point. The ghost spends N seconds standing still; you spend N minus your stop/start loss.'],
    ['Timed segment "30 for 0:36 then 40"', 'Hold 30 for 36 s counted from the ghost\'s departure from the landmark (arrival plus any pause), then 40. Call the change half a ramp early.'],
    ['Speed change at a landmark', 'The new speed applies from the leading edge of the landmark. Be mid-ramp as the bumper passes it.'],
    ['Checkpoint', 'A hidden timing line; your crossing is recorded to the second and the next leg is timed from it. Never stop or crawl inside the sight zone of the checkpoint sign (30 s penalty).'],
    ['Observation checkpoint', 'A manned stop (typically the finish): stop within 200 ft after the line or take the 60 s penalty.'],
    ['Time Allowance (TA)', 'Declare the seconds a train or signal held you; credited up to the measured delay, over-declaration beyond 5 s is flagged. Never also make the time up.'],
    ['Ace', 'A checkpoint crossed at exactly the perfect second (error 0).'],
    ['Age factor', 'Raw seconds times a factor for the car\'s year: 0.845 for a 1939 car.'],
    ['Transit / free zone', 'Untimed sections between legs (section symbols in Column B). Drive normally, reset for the next start time.'],
    ['Early restart', 'Leaving a lunch or restart more than 5 minutes early costs 60 s.'],
  ];
  const dl = el('dl', {}); for (const [k, v] of defs) dl.append(el('dt', { style: 'font-weight:700;margin-top:6px' }, k), el('dd', { style: 'margin:0 0 4px 0;color:var(--muted)' }, v)); gi.append(dl);
  // rules summary with citations
  const rules = el('div', { class: 'panel', style: 'grid-column:1/3' }, el('h3', {}, 'Rules summary (with sources)'));
  const rl = el('ul', {});
  const cites: [string, string][] = [
    ['Permitted timing equipment: one analog speedometer, one analog time-of-day clock, one stopwatch; calculators and phones prohibited; paper tables legal; odometer covered.', 'docs/research/01-great-race-rules-and-format.md §1; docs/research/05 §5.3; REQUIREMENTS §0'],
    ['Scoring: one point per second early or late at each hidden checkpoint; Ace = 0; maximum per checkpoint capped; stage raw multiplied by the age factor (1939 Ford: 0.845).', 'docs/research/01 §3; docs/research/07 §7; DESIGN §10'],
    ['The perfect time is integrated by a ghost car with instantaneous speed changes; pauses add the printed seconds; the leg clock resets at every checkpoint.', 'docs/research/07 §1, §4; DESIGN §4'],
    ['Stop/start and speed-change losses are measured per car (performance table); teams subtract them from the printed pause ("34 not 36").', 'docs/research/07 §2.1-2.3; docs/research/03 §1.7'],
    ['Calibration run each morning: k = perfect / actual; indicated speed to hold = assigned / k; a 1 % error is about 9 s over 15 minutes.', 'docs/research/07 §3; DESIGN §12'],
    ['Recovery: 10 % over for 10x the delay or 20 % over for 5x; penalties are symmetric so never overshoot into early; stop correcting before likely checkpoint spots.', 'docs/research/03 §4.3; docs/research/07 §6'],
    ['Time allowances for trains and signals are declared at the checkpoint and credited up to the measured delay.', 'docs/research/01 §1 (R1.8); DESIGN §10'],
    ['Typical scores: champions about 1 s per leg; a good rookie day 13-21 s; 46 s is a blown day.', 'docs/research/06 §4; STATUS.md key facts'],
    ['Course following: dashed CAMEO lines are driveways/lots/unpaved/dead ends; quoted signs must match exactly; never go past the leading edge of an intersection you are unsure of.', 'docs/research/04 §2.2, §4; REQUIREMENTS P8'],
  ];
  for (const [t, c] of cites) rl.append(el('li', {}, t, ' ', el('span', { class: 'cite' }, `[${c}]`)));
  rules.append(rl, el('p', { class: 'cite' }, 'Items marked UNVERIFIED in the research were paraphrased from search snippets; treat the exact numbers as configurable defaults (docs/spec/OPEN-QUESTIONS.md).'));
  g.append(spm, rec, pa, cam, gi, rules);
  page.append(g);
  root.replaceChildren(page);
}

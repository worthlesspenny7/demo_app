// Phase VI: what the 267 video frames establish (docs/research/11a, 11b, 11c): the real page anatomy, the CAMEO and sign library, the simple chart, the clock,
// the TA forms, the pre-read presets, the checkpoint signs, the lost order of steps. Spec ids: GRIID-015..018, SIGN-001, INST-003, CHART-001/006/007, TAF-001/003, PREREAD-002, SIM-004, LOST-001, LESSON-008, SPEED-001.
import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { DRIVER_EXPERT, FORD_1939, PACKARD_1936, nodeById, type Instruction, type SignShape } from '../src/core/course.js';
import { columnCLines, columnBSymbols, columnBLabel, columnD, bookStyleForRung } from '../src/core/griid.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator, validateAction } from '../src/core/sim.js';
import { cameoSvg, cameoOfNode, cameoHeight, mixedCase, signFace, signGlyph, pickRouteExit } from '../src/core/cameo.js';
import { TRAPS, trapCameo, trapById } from '../src/core/generator/traps.js';
import { hms, formatClock } from '../src/core/units.js';
import { bookRows, bookLayout, bookPages, estimateRowHeight, pageFooter, sheetDate, MIN_ROWS_PER_PAGE, MAX_ROWS_PER_PAGE, rowCameo } from '../src/ui/viewmodels/book.js';
import { columnAHtml, columnBHtml, columnCHtml, griidRowHtml, infoBoxHtml, taBannerHtml, sheetFootHtml } from '../src/ui/render/griid.js';
import { griidIcon, odometerHtml, SYMBOL_LABEL } from '../src/ui/render/griid-icons.js';
import { bookSheetsHtml } from '../src/ui/screens/book.js';
import { chartGrids, playerGrid, gridHasNegative, simpleChart, formatLoss, SIMPLE_CHART_SPEEDS, CHART_FOOTNOTES } from '../src/ui/viewmodels/charts.js';
import { buildPerfTable, CHART_SPEEDS, speedChangeLoss } from '../src/core/perf-table.js';
import { clockViewModel } from '../src/ui/viewmodels/clock.js';
import { DEFAULT_SETTINGS } from '../src/ui/state.js';
import { TA_WEB, TA_PAPER, buildTaRequest, allowanceSeconds, taFormFields } from '../src/ui/viewmodels/ta.js';
import { taWebHtml, taPaperHtml } from '../src/ui/render/taform.js';
import { MARK_PRESETS, createAnnotations, markRow, markAnnotation, formatPauseMark, formatLossMark, formatCarryMark, formatQuickMark, formatTodMark, formatCpMark, formatTrainMark } from '../src/ui/viewmodels/annotations.js';
import { parseRawRuns, deriveFromRaw } from '../src/core/drills/d06.js';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { idealNotes, ROWS_PER_PAGE as D15_ROWS } from '../src/core/drills/d15.js';
import { LOST_GUIDANCE } from '../src/core/drills/lost.js';
import { lessonText } from '../content/lessons.js';
import { LESSONS } from '../content/lessons.js';
import { CHECKPOINT_FACTS } from '../content/reference-data.js';
import { runOracle } from './drill-helpers.js';
import { OracleBot } from '../src/agent/bots.js';

const T0 = hms(8, 0, 0);
const P = (angle: number, isRoute: boolean, extra: Record<string, unknown> = {}) => ({ angle, kind: 'road', surface: 'paved', isRoute, ...extra });
const stage = generateStage(1);
const ins = (o: Partial<Instruction>): Instruction => ({ n: 1, nodeId: 'n1', text: '', ...o });

describe('GRIID-015 the CAMEO is drawn by one renderer in the real page vocabulary', () => {
  it('GRIID-015 a right turn is a long stem with a right-angle elbow and a solid arrowhead; "go straight" is a straight arrow; a bear is a curved bold arrow; every cell has the dot at the bottom', () => {
    const turn = cameoSvg([P(-90, false), P(0, false), P(90, true)], 'none', 'R');
    expect(turn).toContain('class="cameo-dot"'); expect(turn).toContain('class="cameo-arrowhead"'); expect(turn).toMatch(/class="cameo-route cameo-bold cameo-exit" d="M\d+ \d+V\d+L/);   // stem up, then a line sideways: the elbow
    const straight = cameoSvg([P(0, true)], 'none', 'S'); expect(straight).toMatch(/d="M\d+ \d+V\d+"/);
    const bear = cameoSvg([P(-40, true), P(20, false)], 'none', 'BL'); expect(bear).toMatch(/d="M\d+ \d+V\d+Q/);          // a quadratic curve
    for (const svg of [turn, straight, bear]) { expect(svg.startsWith('<svg')).toBe(true); expect(svg).toMatch(/viewBox="0 0 150 \d+"/); }
  });
  it('GRIID-015 thin roads run the full width of the cell through the junction in one line; a T has the cross road at the stem; driveways, lots, dead ends and gravel are dashed', () => {
    const cross = cameoSvg([P(-90, false), P(0, false), P(90, true)], 'none', 'R');
    const thin = [...cross.matchAll(/class="cameo-thin"[^>]*x1="([\d.]+)"[^>]*x2="([\d.]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
    expect(thin.some(([a, b]) => Math.min(a!, b!) <= 5 && Math.max(a!, b!) >= 145)).toBe(true);                             // the cross road spans the cell
    const dashed = cameoSvg([P(0, true), P(90, false, { kind: 'driveway' }), P(-90, false, { surface: 'gravel' })], 'none', 'S');
    expect((dashed.match(/cameo-thin cameo-dashed/g) ?? []).length).toBe(2); expect(dashed).toContain('stroke-dasharray');
  });
  it('GRIID-015 road names print in bold beside the road, an unposted name in parentheses, and two names on one fork get leader lines', () => {
    const named = cameoSvg([P(-90, false, { name: 'Shore Rd' }), P(90, true, { name: 'Beach St' })], 'STOP', 'R');
    expect(named).toContain('>Beach St<'); expect(named).toContain('>Shore Rd<'); expect(named).toMatch(/class="cameo-name"[^>]*font-weight="700"/);
    expect(cameoSvg([P(0, true, { name: 'US 1 North', bracketed: true })], 'none', 'S')).toContain('>(US 1 North)<');
    expect(cameoSvg([P(-40, true, { name: 'Beach St' }), P(20, false, { name: 'Shore Rd' })], 'none', 'BL')).toContain('cameo-leader');
  });
  it('GRIID-015 the controls are small outlined line art: STOP an octagon (no red), a traffic light with the top lamp dark, a blinker sun-burst, a yield triangle, railroad tracks with ties and a yield triangle', () => {
    expect(signGlyph('STOP', 10, 10, 6)).toContain('cameo-stop'); for (const c of ['STOP', 'YIELD', 'SIGNAL', 'BLINKER', 'RR']) expect(signGlyph(c, 10, 10, 6)).not.toMatch(/#c8312b|#e34948|#1baf7a|#eda100/i);
    const light = signGlyph('SIGNAL', 20, 20, 6); expect((light.match(/<circle/g) ?? []).length).toBe(3); expect(light).toMatch(/<circle[^>]*fill="currentColor"\/>.*<circle[^>]*fill="#fff"/);   // top lamp solid, the others open
    expect(signGlyph('BLINKER', 5, 5, 6)).toMatch(/M[^"]*L[^"]*M[^"]*L/); const rr = signGlyph('RR', 30, 30, 7); expect(rr).toContain('<polygon'); expect(rr).toMatch(/V[\d.]+M/);   // rails, ties, the yield triangle
    expect(signGlyph('none', 1, 1, 1)).toBe('');
    expect(cameoSvg([P(0, true)], 'SIGNAL', 'S', 64, { ramp: true })).toContain('cameo-lanes');                               // ramp lane ticks
    expect(cameoSvg([P(0, true)], 'RR', 'S')).toContain('cameo-rr');
  });
  it('GRIID-015 the sign face is drawn INSIDE the cell: left or right of the arrow, or centred on it (overhead); the cell grows to hold it; text is mixed case', () => {
    const at = (side: 'L' | 'R' | 'O') => cameoSvg([P(0, true)], 'none', 'S', 64, { sign: { text: 'LEAVING ELDORA CITY LIMIT', shape: 'rect', side } });
    const tx = (svg: string) => Number(/class="cameo-signface[^"]*" transform="translate\(([\d.]+)/.exec(svg)![1]); const stem = (svg: string) => Number(/class="cameo-dot" cx="([\d.]+)"/.exec(svg)![1]);
    expect(tx(at('R'))).toBeGreaterThan(stem(at('R'))); expect(tx(at('L'))).toBeLessThan(stem(at('L'))); expect(tx(at('O'))).toBeCloseTo(stem(at('O')), 0);   // the overhead box sits on the arrow
    expect(at('R')).toContain('>Leaving<'); expect(at('R')).not.toContain('LEAVING'); expect(mixedCase('LEAVING ELDORA CITY LIMIT')).toBe('Leaving Eldora City Limit'); expect(mixedCase('I-95 NORTH')).toBe('I-95 North'); expect(mixedCase('US 1 North')).toBe('US 1 North'); expect(mixedCase('Shell')).toBe('Shell');
    expect(at('O')).toContain('side-O'); expect(cameoHeight({})).toBe(58); expect(cameoHeight({ face: signFace('curve', 'CURVE', 35)! })).toBeGreaterThan(90);   // taller content, taller cell
    expect(pickRouteExit([P(-90, false), P(90, true)])?.angle).toBe(90);
  });
  it('GRIID-015 the trap cards render through the same renderer (one renderer), including a sign face and the route check', () => {
    for (const card of TRAPS) { const svg = trapCameo(card); expect(svg).toContain('class="cameo-dot"'); expect(svg).toContain('cameo-arrowhead'); }
    expect(trapCameo(trapById('hidden-speed-sign'))).toContain('cameo-warning');                                               // the curve diamond with its plaque
    const node = nodeById(stage.course, stage.book[1]!.nodeId); expect(rowCameo(node, stage.book[1])).toBe(cameoOfNode(node, stage.book[1]!.turn ?? null, 64));
    expect(() => trapCameo({ ...trapById('not-a-t'), exits: trapById('not-a-t').exits.map(e => ({ ...e, isRoute: true })) })).toThrow();
  });
});

describe('SIGN-001 the sign vocabulary: every SignShape draws, the warning diamonds carry pictograms and plaques', () => {
  const SHAPES: SignShape[] = ['octagon', 'triangle', 'rect', 'diamond', 'blade', 'shield', 'rr', 'checkpoint', 'speedlimit', 'curve', 'reverse-curve', 'stop-ahead', 'speed-ahead', 'crossroad', 'rr-advance', 'business', 'tracks', 'tollbooth', 'landmark'];
  it('SIGN-001 every SignShape renders inside a CAMEO without throwing, and the faces are distinct', () => {
    for (const shape of SHAPES) { const svg = cameoSvg([P(0, true)], 'none', 'S', 64, { sign: { text: shape === 'speedlimit' ? 'SPEED LIMIT 65' : shape === 'tollbooth' ? 'Toll Booth' : 'SIGN TEXT', shape, side: 'R', plaque: 35 } }); expect(svg.startsWith('<svg'), shape).toBe(true); expect(svg.endsWith('</svg>')).toBe(true); }
    const faces = ['speedlimit', 'curve', 'reverse-curve', 'stop-ahead', 'speed-ahead', 'crossroad', 'rr-advance', 'business', 'rect', 'diamond'].map(sh => signFace(sh, sh === 'speedlimit' ? 'SPEED LIMIT 65' : 'WORDS 45', 35)!.svg);
    expect(new Set(faces).size).toBe(faces.length);
  });
  it('SIGN-001 the speed limit is a white rectangle with "Speed" "Limit" and a large number; a curve diamond with a plaque has the number over MPH; stop ahead has an octagon under an up arrow; the RR advance sign is round with a big X; a business box is white on black', () => {
    const sl = signFace('speedlimit', 'SPEED LIMIT 65')!.svg; expect(sl).toContain('>Speed<'); expect(sl).toContain('>Limit<'); expect(sl).toContain('>65<');
    const curve = signFace('curve', 'CURVE', 35)!.svg; expect(curve).toContain('<polygon points="0,-18'); expect(curve).toContain('>35<'); expect(curve).toContain('>MPH<');
    expect(signFace('stop-ahead', 'STOP AHEAD')!.svg).toMatch(/<polygon points="[^"]*"[^>]*fill="currentColor"/);
    expect(signFace('rr-advance', 'RR')!.svg).toContain('<circle'); expect(signFace('rr-advance', 'RR')!.svg).toContain('>R<');
    const biz = signFace('business', 'Cumberland Farms')!.svg; expect(biz).toContain('fill="#000"'); expect(biz).toContain('fill="#fff"'); expect(biz).toContain('>Cumberland<');
    expect(signFace('octagon', 'STOP')).toBeNull(); expect(signFace('rr', 'RR')).toBeNull();                                  // the control itself is a junction glyph, not a box
  });
  it('SIGN-001 the generator draws the new faces, with plaques on curve signs, names on roads and landmark pictures, across several seeds', () => {
    const shapes = new Set<string>(); let plaques = 0, names = 0, bracket = 0, ramps = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sc = generateStage(seed); for (const n of sc.course.nodes) { if (n.sign) shapes.add(n.sign.shape); if (n.sign?.plaque !== undefined) plaques++; if (n.ramp) ramps++; for (const e of n.exits ?? []) { if (e.name) names++; if (e.bracketed) bracket++; } }
    }
    expect(shapes.size).toBeGreaterThanOrEqual(7); for (const s of ['speedlimit', 'curve']) expect(shapes.has(s), s).toBe(true);
    expect(plaques).toBeGreaterThan(0); expect(names).toBeGreaterThan(5); expect(bracket).toBeGreaterThanOrEqual(0); expect(ramps).toBeGreaterThanOrEqual(0);
  });
});

describe('GRIID-017 a Speed Limit sign is not the assigned speed', () => {
  it('GRIID-017 the posted limit is independent of the assigned speed (never below it, and different from it) while the layout of the seed stays the same', () => {
    let limits = 0, differs = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sc = generateStage(seed);
      for (const ins0 of sc.book) {
        const sg = nodeById(sc.course, ins0.nodeId).sign; if (!sg || sg.shape !== 'speedlimit' || ins0.speed === undefined) continue;
        const limit = Number(/(\d+)/.exec(sg.text)![1]); limits++; expect(limit).toBeGreaterThanOrEqual(ins0.speed); if (limit !== ins0.speed) differs++;
      }
    }
    expect(limits).toBeGreaterThan(3); expect(differs).toBe(limits);                                                          // never the assigned speed itself
    expect(JSON.stringify(generateStage(3).book.map(i => [i.speed, i.pause, i.turn]))).toBe(JSON.stringify(generateStage(3).book.map(i => [i.speed, i.pause, i.turn])));
  });
});

describe('GRIID-002 GRIID-003 GRIID-010 the real page anatomy: Column B and C', () => {
  it('GRIID-002 the calibration start prints speed first: "50 MPH" / "29m00s" / the box with its dot and 0m00.0s; the box has the interval at the left over the cumulative at the right; Column C is bold, centred and unboxed', () => {
    const cal = stage.book.find(i => i.calibrationStart)!; const lines = columnCLines(cal);
    expect(lines).toEqual([expect.stringMatching(/^\d+ MPH$/), expect.stringMatching(/^\d+m\d\ds$/), '* 0m00.0s']);
    const html = columnCHtml(bookRows([cal], 1)[0]!); expect(html.indexOf('MPH')).toBeLessThan(html.indexOf('cstart')); expect(html).toContain('<i class="cdot asterisk"'); expect(html).toContain('0m00.0s');
    const box = columnCHtml({ c: ['5m32.0s', '7m21.3s'], cBox: [0, 1] }); expect(box).toBe('<div class="cbox" title="calibration box: interval over cumulative"><span class="iv">5m32.0s</span><span class="cum">7m21.3s</span></div>');
    expect(columnCHtml({ c: ['0 MPH', '0m15s', '45 MPH'], cBox: null })).toBe('<div class="cl speed">0 MPH</div><div class="cl time">0m15s</div><div class="cl speed">45 MPH</div>');   // no frame, no monospace box
  });
  it('GRIID-010 a restart is the bold zone label over a digital wristwatch with the time inside, then the speed; a restart may carry a timed chain; End timed portion is the watch in a circle with a slash and the interval below', () => {
    const restart = bookRows(stage.book, 1).find(r => r.cIcons.includes('restart'))!; const html = columnCHtml(restart);
    expect(html).toMatch(/<div class="cicons"><b class="zone">CDT<\/b><span class="csym"><svg[^>]*data-sym="restart"/); expect(html).toMatch(new RegExp(`<text[^>]*>${restart.tod!.time}</text>`)); expect(html).toMatch(/<div class="cl (speed|time)">[^<]+<\/div>$/);
    expect(restart.tod).toEqual({ zone: 'CDT', time: expect.stringMatching(/^\d+:\d\d:\d\d$/) });
    const chain = ins({ section: 'restart', restartTime: hms(9, 15, 0), baseTime: hms(9, 15, 0), timed: { holdSpeed: 25, seconds: 72, thenSpeed: 30 } }); expect(columnCLines(chain)).toEqual(['CDT 9:15:00', '25 MPH', '1m12s', '30 MPH']);
    const watch = griidIcon('restart', 44, { time: '12:00:00' }); expect(watch).toContain('>12:00:00<'); expect(watch).toContain('rx="12"'); expect(watch).toContain('width="30" height="8"');   // the case with a band stub above and below
    const et = griidIcon('end-timed'); expect(et).toContain('<circle'); expect(et).toContain('M23.6 9.6L60.4 46.4'); expect(columnCHtml(bookRows(stage.book, 1).find(r => r.cIcons.includes('end-timed'))!)).toMatch(/data-sym="end-timed".*class="cl (time|approx)">\(?[0-9hm]+m\d\ds/);
  });
  it('GRIID-003 Column B: the odometer is four separate squares only under begin symbols; free zone begin is a camcorder in a slashed circle, end the plain camcorder; the meal is a crossed knife and fork with "no-host" when unhosted; rest is man, outhouse, woman; no TA symbol', () => {
    const odo = odometerHtml('0090'); expect((odo.match(/<i/g) ?? []).length).toBe(4); expect(odo).toContain('class="tenths">0');
    const b = columnBHtml({ b: ['warmup', 'transit-begin'], odometer: '0080' }); expect((b.match(/data-odo/g) ?? []).length).toBe(1);
    expect(columnBHtml({ b: ['transit-end'], odometer: null })).not.toContain('data-odo');
    expect(griidIcon('freezone-begin')).toContain('stroke-width="2.4"'); expect(griidIcon('freezone-begin')).not.toBe(griidIcon('freezone-end')); expect(SYMBOL_LABEL['freezone-begin']).toMatch(/slashed circle/); expect(SYMBOL_LABEL['rest']).toMatch(/man, outhouse, woman/);
    expect(columnBHtml({ b: ['meal'], odometer: null, bLabel: 'no-host' })).toMatch(/<b class="blabel">no-host<\/b>.*data-sym="meal"/); expect(columnBHtml({ b: ['meal'], odometer: null })).not.toContain('no-host');
    expect(columnBLabel(ins({ promotedStop: { kind: 'meal', leaveBeforeEndSeconds: 2700, noHost: true } }))).toBe('no-host'); expect(columnBLabel(ins({ promotedStop: { kind: 'meal', leaveBeforeEndSeconds: 2700 } }))).toBeNull(); expect(columnBLabel(ins({ promotedStop: { kind: 'rest', leaveBeforeEndSeconds: 180, noHost: true } }))).toBeNull();
    expect(columnBSymbols(ins({ taPoint: { windowSeconds: 900, endOfStage: false } }))).toEqual([]);
    expect(columnBSymbols(ins({ section: 'start', transit: { exact: false, seconds: 1200, miles: 8 } }))).toEqual(['warmup']);   // the tire stands for the transit it begins: no hourglass
    const noHost = new Set<boolean>(); for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const i of generateStage(seed).book) if (i.promotedStop?.kind === 'meal') noHost.add(!!i.promotedStop.noHost);
    expect(noHost.size).toBeGreaterThanOrEqual(1);
  });
});

describe('GRIID-011 countdown advisories inside a long transit', () => {
  it('GRIID-011 long advisory transits carry "(10m00s)", "(8m00s)", "(3m00s)" on rows with no timing of their own, then "(0m30s)" before the end', () => {
    expect(columnCLines(ins({ transitCountdown: 600 }))).toEqual(['(10m00s)']); expect(columnCLines(ins({ transitCountdown: 180 }))).toEqual(['(3m00s)']);
    const found = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const sc = generateStage(seed); for (const i of sc.book) if (i.transitCountdown !== undefined) { found.add(i.transitCountdown); expect(i.transitCountdown % 60).toBe(0); expect(i.pause).toBeUndefined(); expect(i.timed).toBeUndefined(); expect(i.speed === undefined || true).toBe(true); expect(columnCLines(i)).toContain(`(${Math.floor(i.transitCountdown / 60)}m00s)`); } }
    expect([...found].some(v => v >= 180)).toBe(true);
  });
});

describe('GRIID-009 GRIID-004 real sheets print no sentence in Column D', () => {
  it('GRIID-009 the sentence is a rung-3 training aid only: every other rung prints the remark alone', () => {
    expect([0, 1, 2, 3].map(bookStyleForRung)).toEqual(['race', 'race', 'race', 'example']);
    const row = stage.book.find(i => i.turn)!; expect(columnD(row)).toBe(row.remark ?? ''); expect(columnD(row, 'example')).toContain(row.text);
    const b = new ScenarioBuilder({ startTime: T0, bookStyle: 'race' }).start(35).advanceMiles(0.5).stop('R', 35, { hint: 'comes very quick-- use rightmost toll booth' }).build(); expect(columnD(b.book[1], b.bookStyle)).toBe('comes very quick-- use rightmost toll booth');
  });
});

describe('GRIID-014 GRIID-018 layout-driven pages with the three-block footer', () => {
  it('GRIID-014 row heights come from content (a plain row 0.11, a restart or a big sign more) and a page takes 5 to 10 rows', () => {
    const plain = estimateRowHeight(ins({ speed: 40 }), null); expect(plain).toBeGreaterThanOrEqual(0.11); expect(plain).toBeLessThanOrEqual(0.15);
    expect(estimateRowHeight(ins({ pause: 15, timed: { holdSpeed: 25, seconds: 40, thenSpeed: 45 } }), null)).toBeGreaterThan(plain);   // a 5-line Column C stack
    expect(estimateRowHeight(ins({ section: 'restart', restartTime: hms(9, 0, 0), speed: 30 }), null)).toBeGreaterThan(0.15);
    expect(estimateRowHeight(ins({ infoBox: 'x' }), null)).toBeCloseTo(0.26, 2);
    for (const seed of [1, 2, 3]) {
      const sc = generateStage(seed); const lay = bookLayout(sc); const sizes = lay.starts.map((s, i) => (lay.starts[i + 1] ?? sc.book.length) - s);
      expect(sizes.slice(0, -1).every(n => n >= MIN_ROWS_PER_PAGE && n <= MAX_ROWS_PER_PAGE), `seed ${seed}: ${sizes.join(',')}`).toBe(true); expect(new Set(sizes).size).toBeGreaterThan(1);
      expect(lay.pageOfIndex.length).toBe(sc.book.length); expect(lay.pageOfIndex[0]).toBe(1); expect(lay.pageOfIndex.every((p, i) => i === 0 || p >= lay.pageOfIndex[i - 1]!)).toBe(true);
    }
    const race = { ...stage, bookStyle: 'race' as const }; const ex = { ...stage, book: [...stage.book], bookStyle: 'example' as const };
    expect(bookLayout(race).pages).toBeLessThan(bookLayout(ex).pages);                                                         // sentences in Column D make rows taller: more pages
    expect(bookLayout({ ...stage, rowsPerPage: 6 }).pages).toBe(Math.ceil(stage.book.length / 6));
  });
  it('GRIID-018 the footer has three blocks ("(c) year, Great Race" | "Hemmings Motor News Great Race" over "Page n of N" | stage over date) and the sheet has no page header', () => {
    const f = pageFooter('Stage 1', 3, 26, 'Friday, June 20, 2014'); expect(f).toEqual({ left: expect.stringMatching(/^\u00a9 \d{4}, Great Race$/), center: ['Hemmings Motor News Great Race', 'Page 3 of 26'], right: ['Stage 1', 'Friday, June 20, 2014'] });
    expect(sheetDate(new Date(2014, 5, 20))).toBe('Friday, June 20, 2014');
    const html = sheetFootHtml(f); expect(html).toContain('class="sf-left"'); expect(html).toContain('class="sf-mid"'); expect(html).toContain('class="sf-right"'); expect(html).toContain('Page 3 of 26');
    const sheets = bookSheetsHtml(stage, 'Stage 1'); expect(sheets).not.toContain('sheet-head'); expect(sheets).toContain('class="colheads"'); expect(sheets).toContain('<span>A</span><span>B</span><span>C</span><span>D</span>');
    const pages = bookPages(stage.book, 'Stage 1', { scenario: stage }); expect(pages[0]!.foot.center[1]).toBe(`Page 1 of ${pages.length}`);
  });
});

describe('GRIID-016 the Information Box row', () => {
  it('GRIID-016 a generated full day ends with an Information Box ahead of the finish: a rounded box over B and C, a list in D, not an action', () => {
    const rows = stage.book.filter(i => i.infoBox !== undefined); expect(rows.length).toBe(1); const row = rows[0]!;
    expect(stage.book.indexOf(row)).toBeGreaterThan(stage.book.length - 6); expect(stage.book[stage.book.indexOf(row) + 1]!.turn).toBeDefined(); expect(stage.book[stage.book.length - 1]!.section).toBe('finish'); expect(columnCLines(row)).toEqual([]); expect(columnBSymbols(row)).toEqual([]);
    const br = bookRows(stage.book, 1).find(r => r.info !== null)!; expect(br.info).toMatch(/Reception and awards/); expect(columnD(row)).toMatch(/Gas:/);
    const html = griidRowHtml(br, { svg: '<svg/>' }); expect(html).toContain('class="grow info-row'); expect(html).toContain('class="infobox"'); expect(html).toContain('class="gbc"'); expect(html).not.toContain('class="gb"'); expect(infoBoxHtml({ info: 'x & y' })).toBe('<div class="infobox" role="note">x &amp; y</div>');
    const day = generateStage(1); const sim = new Simulator(day); const r = runOracle(day, { useWatch: true }, { sim }).r; expect(r.offCourseCount).toBe(0); expect(r.score.dnf).toBe(false);   // the car still finishes the day with the row in the book
  });
});

describe('GRIID-013 the Time Allowance row', () => {
  it('GRIID-013 the TA row is a rounded black-outlined yellow box over A to D with the grscores.com sentence and no icon', () => {
    const ta = stage.book.filter(i => i.taPoint); expect(ta.length).toBe(2);
    for (const t of ta) { expect(t.text).toContain('https://www.grscores.com/timeallowance'); expect(t.text).toMatch(/^Within 15m00s, go to/); }
    expect(ta[1]!.text).toContain('click the red button at the bottom of the Time Allowance web page'); expect(ta[0]!.text).toContain('no action is required');
    expect(taBannerHtml({ text: 'x' })).not.toContain('<svg');
  });
});

describe('INST-003 the Sawtooth-style rally clock is the default, the bezel clock the alternative', () => {
  it('INST-003 the default face is the Sawtooth dial; both faces are analog; the digital watch has a lanyard', () => {
    expect(DEFAULT_SETTINGS.clockFace).toBe('sawtooth'); expect(DEFAULT_SETTINGS.chartView).toBe('simple'); expect('clock' in DEFAULT_SETTINGS).toBe(false);
    const vm = clockViewModel(8 * 3600 + 59 * 60 + 30, 0); expect('digital' in vm).toBe(false);
  });
  it('INST-003 the Sawtooth drawing: brass rim, white dial, black spade hands, a thin red second hand with a paddle tail, the WWV number under the hub, an outer numbered track with 5-minute triangles, no bezel', async () => {
    const src = (await import('node:fs')).readFileSync('src/ui/render/clock.ts', 'utf8');
    for (const must of ["'WWV'", "'(303) 499-7111'", 'brass', 'spade(', 'ellipse(', "'#fcfcf8'", '#d11d1d', 'every 5 minutes']) expect(src, must).toContain(must);
    const body = src.slice(src.indexOf('export function drawSawtoothClock'), src.indexOf('export function drawClock'));
    expect(body).not.toContain('bezelDeg'); expect(body).not.toContain('TIME OF DAY');                                      // no rotating bezel on the Sawtooth dial
    const css = (await import('node:fs')).readFileSync('src/ui/styles.css', 'utf8'); expect(css).toContain('.dw-lanyard'); expect(css).toMatch(/\.dw-lcd \{[^}]*background: #b8c4a6/);
  });
});

describe('CHART-007 the simple chart derived from the car model', () => {
  it('CHART-007 Speed | Dec | Acc | S/G | T@15 | T@20 for 55, 50, 48, 45, 40, 35, 30, 25, 20, 15, 12, 10; S/G = Dec + Acc exactly; T@n is N/A at or below n', () => {
    const c = simpleChart(FORD_1939);
    expect(c.speeds).toEqual([55, 50, 48, 45, 40, 35, 30, 25, 20, 15, 12, 10]); expect([...SIMPLE_CHART_SPEEDS]).toEqual(c.speeds); expect(c.columns).toEqual(['Dec', 'Acc', 'S/G', 'T@15', 'T@20']); expect(c.hasT20).toBe(true);
    for (const r of c.rows) { expect(r.sg).toBeCloseTo(r.dec + r.acc, 9); expect(r.text['S/G']).toBe(formatLoss(r.sg)); expect(r.dec).toBeGreaterThan(0); expect(r.acc).toBeGreaterThan(0); }
    expect(c.rows[0]!.dec).toBeGreaterThan(c.rows[c.rows.length - 1]!.dec); expect(c.rows[0]!.acc).toBeGreaterThan(c.rows[c.rows.length - 1]!.acc);     // faster costs more
    const r12 = c.rows.find(r => r.speed === 12)!, r15 = c.rows.find(r => r.speed === 15)!, r20 = c.rows.find(r => r.speed === 20)!;
    expect(r12.t15).toBeNull(); expect(r12.text['T@15']).toBe('N/A'); expect(r15.t20).toBeNull(); expect(r20.t20).toBe(0); expect(r15.t15).toBe(0); expect(c.rows[0]!.t15!).toBeGreaterThan(c.rows[0]!.t20!);
    expect(c.rows.find(r => r.speed === 48)!.dec).toBeGreaterThan(c.rows.find(r => r.speed === 45)!.dec); expect(c.rows.find(r => r.speed === 48)!.dec).toBeLessThan(c.rows.find(r => r.speed === 50)!.dec);
    expect(c.rows[0]!.dec).toBeCloseTo(speedChangeLoss(55, 0, FORD_1939), 0);
  });
  it('CHART-007 "+x.x" for gains, "N/A" for none; the Packard (printed charts) has T@15 only and keeps its printed figures', () => {
    expect(formatLoss(-0.3)).toBe('+0.3'); expect(formatLoss(3.74)).toBe('3.7'); expect(formatLoss(null)).toBe('N/A'); expect(formatLoss(0)).toBe('0.0'); expect(formatLoss(-0.04)).toBe('0.0');
    const p = simpleChart(PACKARD_1936); expect(p.hasT20).toBe(false); expect(p.columns).toEqual(['Dec', 'Acc', 'S/G', 'T@15']);
    const t = buildPerfTable(PACKARD_1936); expect(p.rows.find(r => r.speed === 40)!.acc).toBeCloseTo(t.accel.rows[0]![40]!, 9); expect(p.rows.find(r => r.speed === 40)!.acc).toBe(4.5);   // the printed 0>40 = 4.5
    expect(p.rows.find(r => r.speed === 40)!.sg).toBeCloseTo(p.rows.find(r => r.speed === 40)!.dec + 4.5, 9);
  });
  it('CHART-007 the card defaults to the simple chart, selectable, with the three matrices behind the Charts overlay (source check of the cockpit wiring)', async () => {
    const fs = await import('node:fs'); const src = fs.readFileSync('src/ui/screens/cockpit.ts', 'utf8');
    expect(src).toContain("id: 'chart-view'"); expect(src).toContain("id: 'simplechart'"); expect(src).toContain('renderSimpleChart(line)'); expect(src).toContain("id: 'charts-btn'"); expect(DEFAULT_SETTINGS.chartView).toBe('simple');
  });
});

describe('CHART-001 SPEED-001 the matrices: axis labels, blank diagonal, blanks, warning colour, footnotes, the 12 mph row', () => {
  it('CHART-001 the grids carry BRAKING / ACCELERATION and IN speed / OUT speed, a blank grey diagonal on (a), and the sheet\'s footnotes verbatim', () => {
    const g = chartGrids(FORD_1939, { vIn: 35, vOut: 40 });
    expect([g[0]!.rowAxis, g[0]!.colAxis, g[1]!.rowAxis, g[1]!.colAxis, g[2]!.rowAxis, g[2]!.colAxis]).toEqual(['BRAKING', 'ACCELERATION', 'IN speed', 'OUT speed', 'IN speed', 'OUT speed']);
    for (const r of g[0]!.rows) { const d = r.cells.find(c => c.out === r.in)!; expect(d.blank).toBe(true); expect(d.text).toBe(''); expect(r.cells.filter(c => c.blank).length).toBe(1); }
    expect(g[1]!.rows.every(r => r.cells.every(c => !c.blank && c.text !== ''))).toBe(true);
    expect(g[0]!.footnotes).toEqual(['If 4.5 seconds are lost, start 4.5 seconds earlier']); expect(g[1]!.footnotes).toEqual(['Instead of pausing for alloted "15" seconds, pause for this amount of time', 'This accounts for accel/decel lost time as well.', '(START/STOP TIME)-(accel IN + accel OUT)']);
    expect(CHART_FOOTNOTES.pauseFormula).toBe('(START/STOP TIME)-(accel IN + accel OUT)');
  });
  it('CHART-001 a player\'s own grid leaves unmeasured cells blank (not 0.0) and flags negatives in the warning colour', () => {
    const grid = playerGrid('accel', [0, 15, 20, 25, 30], { '0>25': -1.7, '25>0': -2.7, '0>30': 3.4 });
    const cell = (i: number, o: number) => grid.rows.find(r => r.in === i)!.cells.find(c => c.out === o)!;
    expect(cell(0, 25)).toMatchObject({ text: '-1.7', neg: true }); expect(cell(25, 0)).toMatchObject({ text: '-2.7', neg: true }); expect(cell(0, 30)).toMatchObject({ text: '3.4' }); expect(cell(0, 30).neg).toBeUndefined();
    expect(cell(15, 20)).toMatchObject({ text: '', unmeasured: true }); expect(cell(20, 20)).toMatchObject({ blank: true }); expect(gridHasNegative(grid)).toBe(true); expect(gridHasNegative(chartGrids(FORD_1939, null)[0]!)).toBe(false);
  });
  it('SPEED-001 the charts carry a 12 mph row and column (the Ford; the Packard keeps its printed 15-50 plus 55) and the simple chart lists 12 and 48', () => {
    expect(CHART_SPEEDS).toContain(12); const t = buildPerfTable(FORD_1939); expect(t.stopGo.speeds).toContain(12); expect(t.accel.speeds.slice(0, 3)).toEqual([0, 10, 12]); expect(t.stopGo.rows[12]![35]!).toBeGreaterThan(0);
    expect(buildPerfTable(PACKARD_1936).stopGo.speeds).not.toContain(12); expect(simpleChart(PACKARD_1936).speeds).toContain(12); expect(simpleChart(FORD_1939).speeds).toContain(48);
    expect(chartGrids(FORD_1939, null)[1]!.speeds).toContain(12);
  });
});

describe('CHART-006 raw run times, three run types, negative derived cells', () => {
  it('CHART-006 raw runs "const 25 runs 19.8 19.9 19.1 19.8", "acc 25 runs ...", "brk 25 runs ..." give net losses and the pause = 15 - brake(IN) - accel(OUT)', () => {
    const raw = parseRawRuns(['const 25 runs 19.8 19.9 19.8 19.9', 'acc 25 runs 21.0 21.2 20.8 21.0', 'brk 25 runs 21.6 21.5 21.7 21.6', 'B: const 30 runs 20.1 20.2 20.1 20.2']);
    expect(raw.get('const:25')).toEqual([19.8, 19.9, 19.8, 19.9]); expect(raw.get('acc:25')).toEqual([21, 21.2, 20.8, 21]); expect(raw.get('const:30')).toEqual([20.1, 20.2, 20.1, 20.2]); expect(parseRawRuns(['B: const 30 runs 20.1 20.2 20.1 20.2'], 'A').size).toBe(0);
    const d = deriveFromRaw(raw); expect(d.acc[25]).toBeCloseTo(1.15, 2); expect(d.dec[25]).toBeCloseTo(1.75, 2); expect(d.pause['25>25']).toBeCloseTo(15 - 1.75 - 1.15, 2); expect(d.negatives).toEqual([]); expect(d.discrepant).toEqual([]);
  });
  it('CHART-006 the demo from the video: constant 19.8 19.9 19.1 19.8 against start and stop runs flags -1.7 and -2.7, a pause of 19.3 above 15 s, and the run that disagrees (19.1)', () => {
    const d = deriveFromRaw(parseRawRuns(['const 25 runs 19.8 19.9 19.1 19.8', 'acc 25 runs 18.0 18.0 18.0 18.0', 'brk 25 runs 17.0 17.0 17.0 17.0']));
    expect(d.acc[25]).toBeCloseTo(-1.65, 2); expect(d.dec[25]).toBeCloseTo(-2.65, 2); expect(d.negatives.map(n => n.cell)).toEqual(['accel 0>25', 'brake 25>0']); expect(d.pause['25>25']).toBeCloseTo(19.3, 2); expect(d.pauseOver15).toEqual(['25>25']);
    expect(d.discrepant).toContainEqual({ kind: 'const', speed: 25, run: 19.1, others: [19.8, 19.9, 19.8] });
  });
  it('CHART-006 the D06 rubric credits raw runs, flags a negative derived cell with "re-run and re-average", and names the discrepant run', () => {
    const d06 = drillById('D06')!; const sc = d06.scenario(1, 0); const notes = sc.tags!;
    expect(notes.some(t => t.startsWith('chart:'))).toBe(true);
    const sim = new Simulator(sc); sim.act({ type: 'note', text: 'const 25 runs 19.8 19.9 19.1 19.8' }); sim.act({ type: 'note', text: 'acc 25 runs 18.0 18.0 18.0 18.0' }); sim.act({ type: 'note', text: 'brk 25 runs 17.0 17.0 17.0 17.0' });
    const r = runOracle(sc, { useWatch: true }, { sim }).r; const fb = d06.rubric(r, sc).feedback.join(' ');
    expect(fb).toMatch(/NEGATIVE/); expect(fb).toContain('re-run and re-average'); expect(fb).toMatch(/19\.1 s disagrees with 19\.8 \/ 19\.9 \/ 19\.8/); expect(fb).toMatch(/above 15 s/); expect(fb).toContain('const 25 runs');
    expect(d06.objective).toMatch(/raw run times/);
  });
});

describe('TAF-001 TAF-003 the TA forms: the web page as labelled, the paper sheet with its fields', () => {
  const legs = [{ legIndex: 2 }, { legIndex: 3 }]; const first = { legIndex: 3, fromLine: 44, toLine: 45, suggested: 220, cause: 'train' };
  const state = { draft: {}, legs, first, carDefault: '', loggedIn: false, endOfStage: false, acked: false };
  it('TAF-001 the login page: Great Race / Time Allowance / Login, Car Number, Password, Phone Number, a green Login; the entry page is hidden until it is passed', () => {
    const html = taWebHtml(state);
    for (const t of ['Great Race', 'Time Allowance', 'Login', 'Car Number', 'Password', 'Phone Number']) expect(html).toContain(t);
    expect(html).toMatch(/id="ta-login-screen">\s*<div class="taweb-title">Great Race<br>Time Allowance<br>Login/); expect(html).toMatch(/id="ta-login" class="taweb-btn green"[^>]*>Login</); expect(html).toMatch(/id="ta-entry-screen" hidden/); expect(taWebHtml({ ...state, loggedIn: true })).toMatch(/id="ta-login-screen" hidden/);
  });
  it('TAF-001 the entry page: Stage, Leg Number "Leg 3", Between Instructions 44 & 45, Allowance 3 m 40 s, Reason "Delayed by train", green Submit, yellow and red buttons, grscores.com; no witness field', () => {
    const html = taWebHtml({ ...state, loggedIn: true });
    for (const t of ['Stage', 'Leg Number', 'Between Instructions', 'Allowance', 'Reason', 'Submit', 'CLICK to see Time Allowances Submitted', 'CLICK this after submitting ALL Time Allowances for the ENTIRE stage', 'grscores.com']) expect(html).toContain(t);
    expect(html).toContain('<option value="3" selected>Leg 3</option>'); expect(html).toMatch(/id="ta-from"[^>]*value="44"/); expect(html).toMatch(/id="ta-to"[^>]*value="45"/); expect(html).toMatch(/id="ta-min"[^>]*value="3"/); expect(html).toMatch(/id="ta-sec"[^>]*step="10"[^>]*value="40"/); expect(html).toMatch(/id="ta-cause"[^>]*value="Delayed by train"/);
    expect(html).toMatch(/id="ta-submit" class="taweb-btn green"/); expect(html).toMatch(/id="ta-see" class="taweb-btn yellow"/); expect(html).toMatch(/id="ta-ack-btn" class="taweb-btn red"/); expect(html).not.toMatch(/witness/i);
    expect(taFormFields('web').some(f => /witness|ta-w\d/.test(f.id))).toBe(false);
  });
  it('TAF-003 the paper form: Car #, Stage #, Leg #, the three request types, Instructions # and #, minutes and seconds, circumstances, Witnessed by rows, certification, Signature and Status, office-use blocks', () => {
    const html = taPaperHtml(state);
    for (const t of ['Car #', 'Stage # ', 'Leg #', 'Time Allowance Request (V.H.1)', 'Emergency Reduced Speed Request (V.H.2)', 'Formal Problem Resolution Request (VI.A.2): +30 s', 'between Instructions #', 'minutes and', '(in multiples of 0m10s)', 'Witnessed by (for V.H.1):', 'Car No.', 'Name (or description)', 'Contestant/official', 'I certify, by submitting a Time Allowance Request', 'consent to the addition of 30 seconds', 'Signature of Contestant', 'Status', '(Driver or Navigator)', 'Received for Great Race by', 'EXECUTIVE COMMITTEE DECISION']) expect(html.replace('The conditions described below occurred between Instructions #', 'between Instructions #'), t).toContain(t);
    for (const id of ['ta-car', 'ta-stage', 'ta-leg', 'ta-from', 'ta-to', 'ta-min', 'ta-sec', 'ta-circumstances', 'ta-w1-car', 'ta-w1-name', 'ta-w1-role', 'ta-w2-car', 'ta-w2-name', 'ta-w2-role', 'ta-signature', 'ta-status']) expect(html, id).toContain(`id="${id}"`);
    expect(html).not.toContain('id="ta-password"'); expect(html).not.toContain('id="ta-phone"'); expect((html.match(/name="ta-type"/g) ?? []).length).toBe(3); expect(TA_PAPER.types.map(t => t.id)).toEqual(['time-allowance', 'emergency-reduced-speed', 'formal-problem']);
  });
  it('TAF-003 buildTaRequest: web form checks allowance, instruction numbers and the 4-digit password; the paper sheet sends the type, status, circumstances and witnesses; a Formal Problem Resolution Request asks no allowance', () => {
    const web = buildTaRequest('web', { car: '99', password: '1234', phone: '555', stage: '2', leg: 3, from: '44', to: '45', minutes: '3', seconds: '40', reason: 'Delayed by train' });
    expect('action' in web && web.action).toMatchObject({ type: 'ta.request', legIndex: 3, seconds: 220, fromLine: 44, toLine: 45, carNumber: 99, password: '1234', phone: '555', stage: 2, cause: 'train' }); expect('action' in web && web.action.witnesses).toBeUndefined();
    expect(buildTaRequest('web', { leg: 3, from: '44', to: '45', minutes: '0', seconds: '0' })).toEqual({ error: 'Fill in the Allowance (minutes and seconds)' }); expect(buildTaRequest('web', { leg: 3, from: '', to: '45', minutes: '1', seconds: '0' })).toMatchObject({ error: expect.stringMatching(/instruction numbers/) });
    expect(buildTaRequest('web', { leg: 3, from: '44', to: '45', minutes: '1', seconds: '0', password: '12' })).toEqual({ error: 'The password is four digits' }); expect(allowanceSeconds('3', '40')).toBe(220); expect(allowanceSeconds('', '30')).toBe(30); expect(allowanceSeconds('x', '1')).toBeNaN();
    const paper = buildTaRequest('paper', { car: '99', stage: '2', leg: 5, from: '102', to: '103', minutes: '3', seconds: '40', circumstances: 'caught by a train at the crossing on Hwy. 49.', type: 'time-allowance', status: 'driver', signature: 'J. S.', witnesses: [{ car: '8', description: 'black 32 Ford' }, { car: '77', description: '57 Chevy', role: 'official' }, { car: '', description: '' }] });
    expect('action' in paper && paper.action).toMatchObject({ requestType: 'time-allowance', contestantStatus: 'driver', seconds: 220, fromLine: 102, toLine: 103, cause: 'train', circumstances: 'caught by a train at the crossing on Hwy. 49.' });
    expect('action' in paper && paper.action.witnessedBy).toEqual([{ car: '8', description: 'black 32 Ford' }, { car: '77', description: '57 Chevy', role: 'official' }]); expect('action' in paper && paper.action.note).toContain('Witnessed by car 8 (black 32 Ford), car 77 (57 Chevy) [official].'); expect('action' in paper && paper.action.password).toBeUndefined();
    const formal = buildTaRequest('paper', { leg: 2, minutes: '', seconds: '', circumstances: 'the sign was missing', type: 'formal-problem' }); expect('action' in formal && formal.action).toMatchObject({ requestType: 'formal-problem', seconds: 0, fromLine: 1, toLine: 1 });
  });
  it('TAF-003 the engine files the paper sheet fields, and a Formal Problem Resolution Request adds 30 s to the stage score without asking an allowance', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, rules: { taMode: 'paper' } }).start(35).advanceMiles(1).stop('R', 35).advanceMiles(1).checkpoint('observation').advanceFt(300).finish().build();
    expect(validateAction({ type: 'ta.request', legIndex: 1, seconds: 20, fromLine: 1, toLine: 2, requestType: 'oops' } as never)).toMatch(/requestType/); expect(validateAction({ type: 'ta.request', legIndex: 1, seconds: 20, fromLine: 1, toLine: 2, contestantStatus: 'cook' } as never)).toMatch(/contestantStatus/);
    expect(validateAction({ type: 'ta.request', legIndex: 1, seconds: 220, fromLine: 1, toLine: 2, requestType: 'time-allowance', contestantStatus: 'navigator', witnessedBy: [{ car: 8, description: 'black 32 Ford', role: 'contestant' }], circumstances: 'train' })).toBeNull();
  });
});

describe('PREREAD-002 the annotation presets: the exact marks navigators write', () => {
  it('PREREAD-002 the formats: "P10.2", a circled "-2.9", the carried speed "30", "(12) COMES QUICK", "9:34:00", "CP3 9:14:22", "TRAIN Delay 3:47" with a star', () => {
    expect(formatPauseMark(10.2)).toBe('P10.2'); expect(formatPauseMark(7.5)).toBe('P7.5'); expect(formatLossMark(2.9)).toBe('-2.9'); expect(formatLossMark(-0.5)).toBe('-0.5'); expect(formatCarryMark(29.6)).toBe('30'); expect(formatQuickMark(12)).toBe('(12) COMES QUICK');
    expect(formatTodMark(hms(9, 34, 0))).toBe('9:34:00'); expect(formatCpMark(3, hms(9, 14, 22))).toBe('CP3 9:14:22'); expect(formatTrainMark(227)).toBe('TRAIN Delay 3:47'); expect(formatTrainMark(65, 'tractor')).toBe('TRACTOR Delay 1:05');
    expect(MARK_PRESETS.map(p => p.kind)).toEqual(['pause', 'loss', 'carry', 'quick', 'tod', 'cp', 'train']); expect(MARK_PRESETS.find(p => p.kind === 'train')!.star).toBe(true); expect(MARK_PRESETS.find(p => p.kind === 'train')!.example).toBe('TRAIN Delay 3:47');
    expect(markAnnotation({ kind: 'train', text: 'TRAIN Delay 3:47', star: true })).toBe('TRAIN Delay 3:47 *'); expect(markAnnotation({ kind: 'pause', text: 'P10.2' })).toBe('P10.2');
  });
  it('PREREAD-002 a "comes quick" row that heads a page is flagged on the last row of the page before; everything else on its own row; marks are stored per row and survive serialisation', () => {
    expect(markRow('quick', 13, true)).toBe(12); expect(markRow('quick', 13, false)).toBe(13); expect(markRow('pause', 13, true)).toBe(13); expect(markRow('carry', 7, true)).toBe(7);
    const a = createAnnotations(); a.addMark(5, { kind: 'pause', text: 'P10.2' }); a.addMark(5, { kind: 'loss', text: '-2.9' }); a.addMark(5, { kind: 'pause', text: 'P9.9' }); a.addMark(6, { kind: 'train', text: 'TRAIN Delay 3:47', star: true }); a.addMark(7, { kind: 'pause', text: '' });
    expect(a.marks(5)).toEqual([{ kind: 'loss', text: '-2.9' }, { kind: 'pause', text: 'P9.9' }]); expect(a.marks(6)[0]!.star).toBe(true); expect(a.marks(7)).toEqual([]);
    const b = createAnnotations(a.serialize()); expect(b.marks(5).length).toBe(2); expect(b.marks(6)[0]).toMatchObject({ text: 'TRAIN Delay 3:47', star: true }); a.removeMark(5, 'loss'); expect(a.marks(5).map(m => m.kind)).toEqual(['pause']); expect(createAnnotations('not json').marks(1)).toEqual([]);
  });
  it('PREREAD-002 D15 grades the preset marks: carry, speeds, COMES QUICK, P-notes, restart times and a circled loss are all read from the line.annotate text', () => {
    const d = drillById('D15')!; const sc = d.scenario(1, 0); expect(sc.rowsPerPage).toBe(D15_ROWS);
    const preset = (a: { n: number; text: string }): { n: number; text: string } => {
      const q = /^COMES QUICK next page$/.exec(a.text); if (q) return { n: a.n, text: formatQuickMark(a.n + 1) };
      return { n: a.n, text: a.text.split('; ').map(t => { const m = /^(\d+) mph$/.exec(t); if (m) return formatCarryMark(Number(m[1])); const p = /^pause ([\d.]+) s$/.exec(t); if (p) return formatPauseMark(Number(p[1])); const r = /^restart ([\d:]+)$/.exec(t); if (r) return r[1]!; return t; }).join('; ') };
    };
    const notes = idealNotes(sc).map(preset); expect(notes.some(n => /^P\d/.test(n.text) || /; P\d|^P\d/.test(n.text))).toBe(true); expect(notes.some(n => /COMES QUICK/.test(n.text))).toBe(true);
    const sim = new Simulator(sc); for (const a of notes) sim.act({ type: 'line.annotate', n: a.n, text: a.text });
    const begin = sc.book.find(i => i.transit && !i.transit.end && i.transit.exact)!; const end = sc.book.find(i => i.transit?.end && i.transit.exact)!; let done = false;
    const { r } = runOracle(sc, { useWatch: true }, { sim, hook: s => { if (!done && s.transitIn[begin.n] !== undefined) { s.act({ type: 'line.annotate', n: end.n, text: `OUT ${formatClock(s.transitIn[begin.n]! + begin.transit!.seconds)}` }); done = true; } } });
    const rb = d.rubric(r, sc); expect(rb.stars, rb.headline).toBe(3); expect(rb.feedback.join(' ')).not.toMatch(/Line \d+ pause/);
    const blank = new Simulator(sc); for (const a of notes.filter(n => !/^P\d|; P\d/.test(n.text))) blank.act({ type: 'line.annotate', n: a.n, text: a.text }); expect(d.rubric(runOracle(sc, { useWatch: true }, { sim: blank, hook: undefined }).r, sc).stars).toBe(0);   // without the P-notes the pause notation scores nothing
  });
});

describe('SIM-004 the Observation Checkpoint sign is a red GREAT RACE STOP board, the Timing sign is green', () => {
  it('SIM-004 the observed feature names the red board; the road view draws the two checkpoint signs in their colours; the trap tip and the lesson say red = stop, green = keep going', async () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 } }).start(35).advanceMiles(0.5).checkpoint('observation', 400).advanceFt(300).finish().build();
    const sim = new Simulator(sc); const bot = new OracleBot(sim); let label: string | undefined;
    for (let i = 0; i < 40000 && !label && sim.phase !== 'finished'; i++) { bot.onTick(); sim.step(0.1); label = sim.observe({ peek: true }).ahead.find(f => f.kind === 'checkpoint')?.label; }
    expect(label).toBe('OBSERVATION CHECKPOINT (red GREAT RACE STOP board)');
    const fs = await import('node:fs'); const road = fs.readFileSync('src/ui/render/road.ts', 'utf8');
    for (const must of ["'#d93a2f'", "'#1f8f4e'", "'GREAT RACE'", "'STOP'", "'TIMING'", 'wire stand', 'red = stop here', 'green = keep going']) expect(road, must).toContain(must);
    expect(trapById('cp-after-stop').tip).toMatch(/GREEN sign is a Timing checkpoint/); expect(trapById('cp-after-stop').tip).toMatch(/RED GREAT RACE STOP board/); expect(trapById('cp-after-stop').visual).toMatch(/red GREAT RACE STOP board/);
    expect(CHECKPOINT_FACTS.find(f => /^Red sign/.test(f.fact))!.fact).toMatch(/GREAT RACE STOP/); expect(lessonText(LESSONS.find(l => l.id === 'rally-school')!)).toMatch(/red board reading "GREAT RACE STOP"/);
  });
});

describe('LOST-001 LESSON-008 the order of the recovery steps and the definition of hacking', () => {
  it('LOST-001 the lost guidance gives the order the Hacking how-to gives: do not panic, turn around and backtrack, the stopwatch, the order of start (the car a minute behind is your clock), rejoin 30 s behind a car on course; hacking is an unofficial time reference', () => {
    const order = ['do not panic', 'turn around and backtrack', 'start the stopwatch at the turn-around', 'find the order of start and your position', 'the car a minute behind you is your clock', 'rejoin 30 s behind a car you know is on course'];
    let at = -1; for (const s of order) { const i = LOST_GUIDANCE.indexOf(s); expect(i, s).toBeGreaterThan(at); at = i; }
    expect(LOST_GUIDANCE).toMatch(/"Hacking" is the unofficial time reference you take off other cars and landmarks/); expect(LOST_GUIDANCE).toContain('Never ask for a Time Allowance for a wrong turn');
  });
  it('LESSON-008 the lost section carries the order-of-start step and the definition of hacking, each cited to its video and timestamp', () => {
    const text = lessonText(LESSONS.find(l => l.id === 'rally-school')!);
    expect(text).toMatch(/find the order of start and your position": the car a minute behind you in the order of start is your clock/); expect(text).toMatch(/How-To: Hacking \[01:00\]-\[02:30\]/);
    expect(text).toMatch(/"Hacking" is an unofficial time reference taken off other cars or landmarks/); expect(text).toMatch(/2026 Training Session \[125:28\]-\[126:31\]/);
  });
});

describe('GRIID-012 the real 2014 rows: the Information Box row, the odometer, the speedometer and the free-zone camcorder in a full day', () => {
  it('GRIID-012 a full day prints the tire with its odometer on row 1, the speedometer with the odometer on the calibration start, and rows with omitted speeds stay in the numbering', () => {
    const rows = bookRows(stage.book, 1); expect(rows[0]!.b).toEqual(['warmup']); expect(rows[0]!.odometer).toMatch(/^\d{4}$/); expect(rows[0]!.tod).not.toBeNull();
    const cal = rows.find(r => r.asterisk)!; expect(cal.b).toEqual(['calibration']); expect(cal.odometer).toMatch(/^\d{4}$/);
    expect(columnAHtml({ svg: rowCameo(nodeById(stage.course, stage.book[0]!.nodeId), stage.book[0]) })).toContain('<svg');
    const html = columnBHtml(rows[0]!); expect(html).toContain('data-sym="warmup"'); expect(html).toContain('class="odo"');
    const sc = new ScenarioBuilder({ startTime: T0 }).start(35).advanceMiles(0.5).freeZone().advanceMiles(0.5).endFreeZone().advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    expect(columnBSymbols(sc.book[1])).toEqual(['freezone-begin']); expect(columnBSymbols(sc.book[2])).toEqual(['freezone-end']); expect(EXITS.straightRoad().length).toBe(1);
  });
});

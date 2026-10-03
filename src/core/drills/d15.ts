/** D15 "Pre-read triage": the six notations of LESSON-003 on a 48-line, 8-page book (DRILL-024, HB p.15, LESSON-003). */
import { EXITS } from '../builder.js';
import { annotatePerfectTimes, buildGhost, ghostTimeAt, exactTransitBegin } from '../ghost.js';
import { dwellFor } from '../perf-table.js';
import { formatClock } from '../units.js';
import { rng } from '../rng.js';
import type { Instruction, Scenario, TurnDir } from '../course.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base, aspForSeed, bookStyleFor } from './common.js';
import { driverScale, headlineTip, legErrors, meanAbs, starsFromMeanAbs, instrumentFindingLines } from './rubrics.js';

/** Rows per page of the printed book (UI-029). */
export const ROWS_PER_PAGE = 6;
export const pageOf = (n: number): number => Math.floor((n - 1) / ROWS_PER_PAGE) + 1;
const isPageTop = (n: number): boolean => n > 1 && (n - 1) % ROWS_PER_PAGE === 0;
const isQuick = (i: Instruction): boolean => /comes quick/i.test(i.remark ?? i.hint ?? '');

export type NotationId = 'carry' | 'speeds' | 'quick' | 'pause' | 'restart' | 'transit';
export const NOTATION_NAMES: Record<NotationId, string> = {
  carry: 'speed carried to the top of the next page', speeds: 'speeds not shown written on the line', quick: '"comes quick" noted on the previous page',
  pause: 'chart pause time next to each pause', restart: 'restart time (base + ASP)', transit: 'exact-transit OUT time',
};

interface Ctx { speedBefore: Map<number, number>; inTransit: Set<number> }
function context(sc: Scenario): Ctx {
  const speedBefore = new Map<number, number>(); const inTransit = new Set<number>(); let v = 0; let open = false;
  for (const ins of sc.book) {
    speedBefore.set(ins.n, v);
    if (ins.transit && !ins.transit.end) open = true;
    if (open) inTransit.add(ins.n);
    if (ins.transit?.end || ins.restartTime !== undefined && ins.section === 'restart') open = false;
    v = ins.timed ? ins.timed.thenSpeed : ins.speed ?? v;
  }
  return { speedBefore, inTransit };
}
/** Lines that need a speed written on them: no speed printed, not in a transit, not the start or the finish. */
function needsSpeed(ins: Instruction, c: Ctx): boolean { return ins.speed === undefined && !ins.timed && ins.section !== 'start' && ins.section !== 'finish' && !c.inTransit.has(ins.n) && (c.speedBefore.get(ins.n) ?? 0) > 0; }

function chartPause(sc: Scenario, ins: Instruction, vIn: number): number {
  const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? vIn;
  const cap = ins.turn && ins.turn !== 'S' ? (['BL', 'BR'].includes(ins.turn) ? sc.car.turnSpeedMph.bear : ['AL', 'AR'].includes(ins.turn) ? sc.car.turnSpeedMph.acute : sc.car.turnSpeedMph.turn) : undefined;
  return dwellFor(ins.pause!, vIn || vOut, vOut, sc.car, cap);
}

/** The ideal pre-read notes for a book (notations 1-5; the OUT time needs the IN time, which only exists in the run). Used by tests and as the answer sheet. */
export function idealNotes(sc: Scenario): { n: number; text: string }[] {
  const c = context(sc); const out = new Map<number, string[]>(); const add = (n: number, t: string): void => { out.set(n, [...(out.get(n) ?? []), t]); };
  for (const ins of sc.book) {
    const vIn = c.speedBefore.get(ins.n) ?? 0;
    if (isPageTop(ins.n) && vIn > 0) add(ins.n, `${vIn} mph`);
    else if (needsSpeed(ins, c)) add(ins.n, `${vIn} mph`);
    if (isQuick(ins) && isPageTop(ins.n)) add(ins.n - 1, 'COMES QUICK next page');
    if (ins.pause) add(ins.n, `pause ${chartPause(sc, ins, vIn).toFixed(1)} s`);
    if (ins.section === 'restart' && ins.restartTime !== undefined) add(ins.n, `restart ${formatClock(ins.restartTime)}`);
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([n, t]) => ({ n, text: t.join('; ') }));
}

const numbers = (t: string): number[] => (t.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
/** "9:41:00", "09:41", "9:41:00 AM": seconds into a 12-hour day. */
function parseTimes(t: string): number[] { return [...t.matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g)].map(m => ((Number(m[1]) % 12) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0))); }
const sameTime = (a: number, b: number): boolean => { const d = Math.abs(((a - b) % 43200 + 43200) % 43200); return Math.min(d, 43200 - d) <= 1; };

export const D15: Drill = {
  id: 'D15', title: 'Pre-read triage', objective: 'The book arrives 30 minutes early. Mark it up with the six notations (speed carried to each page top, every speed not shown, "comes quick" on the previous page, the chart pause time at every pause, the restart time = base + ASP, the exact-transit OUT time), then run it cold.', skills: ['P7'], minutes: 40, kind: 'drive',
  tiers: tiers([2, 1, 0]), unlock: [],
  scenario(seed, t) {
    const tier = tierOf(D15, t); const r = rng(seed * 4513 + 15); const asp = aspForSeed(seed, 15);
    const b = base('D15', 'Pre-read triage', seed, tier, { prereadSeconds: 600, asp, startTime: 8 * 3600 + 55 * 60, bookStyle: bookStyleFor(tier.aids) }).start(35);
    const LAND = ['church on R', 'grain elevator', 'overpass', 'cemetery on L', 'bridge', 'water tower', 'fire station on R', 'cattle guard', 'county line sign', 'creek bridge'];
    const gap = (lo = 0.2, hi = 0.5): void => { b.advanceMiles(lo + r.next() * (hi - lo)); };
    const land = (): void => { gap(); const l = r.pick(LAND); b.instruction({ label: l, sightDistance: 500 }, { text: `Pass the ${l}.` }); };
    const turn = (remark?: string): void => { gap(); const d: TurnDir = r.pick(['L', 'R'] as const); b.instruction({ exits: EXITS.crossroads(d), sightDistance: 700 }, { turn: d, remark }); };
    const stopP = (pause: number, speed?: number): void => { gap(); const d = r.pick(['L', 'R', 'S'] as const); b.instruction({ control: 'STOP', exits: EXITS.crossroads(d), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: d, pause, speed }); };
    const sign = (v: number): void => { gap(); b.speedAtSign(`SPEED LIMIT ${v}`, v); };
    const expect = (n: number): void => { if (b.lineCount !== n) throw new Error(`D15 layout: expected ${n} lines, have ${b.lineCount}`); };
    land(); turn(); stopP(15); sign(30); land(); expect(6);                                   // page 1
    land(); stopP(20); turn(); sign(40); stopP(15); b.advanceMiles(0.3).checkpoint(); land(); expect(12); // page 2 (the last row is the line before a page-top "comes quick")
    turn('Comes quick'); land(); stopP(30, 35); turn(); land(); sign(45); expect(18);         // page 3: "comes quick" at the top, a speed change at the bottom
    land(); expect(19);                                                                      // page 4 top
    b.advanceMiles(0.3).transit({ exact: true, seconds: 600, miles: 1.4 });
    b.advanceMiles(0.7); b.instruction({ label: 'bridge', sightDistance: 500 }, { text: 'Pass the bridge. (in the transit)' });
    b.advanceMiles(0.7); b.endTransit({ speed: 35 });
    expect(22);
    b.advanceMiles(0.6); stopP(15); turn(); b.advanceMiles(0.3).checkpoint(); expect(24); // page 4: the first checkpoint after the 2-minute free zone
    land(); stopP(20); land(); turn(); sign(40); land(); expect(30);                           // page 5
    turn('Comes quick'); stopP(15); land(); expect(33);                                       // page 6: "comes quick" at the top
    // lunch-style hold: the restart at base + ASP, after the car has had time to arrive
    gap(0.3, 0.4);
    const g = buildGhost(b.build()); const arrive = ghostTimeAt(g, b.position);
    const restartAt = Math.ceil((arrive + 150) / 60) * 60;
    b.restart(35, restartAt - asp * 60);
    expect(34);
    land(); sign(30); expect(36);                                                             // page 6 bottom: a speed change
    b.advanceMiles(0.4).checkpoint();
    land(); stopP(30); turn(); stopP(15, 40); land(); stopP(20); expect(42);                  // page 7
    land(); turn(); land(); stopP(15); land(); expect(47);                                    // page 8
    b.advanceMiles(0.35).checkpoint().advanceMiles(0.2);
    b.finish(); expect(48);
    const sc = b.build();
    sc.tags = [...(sc.tags ?? []), 'd15', `asp:${asp}`, 'watch:digital'];
    annotatePerfectTimes(sc, true);
    return sc;
  },
  rubric(r, sc) {
    const startTick = r.actions.find(a => a.action.type === 'start')?.tick ?? Infinity;
    const ann = (n: number, before: boolean): string[] => r.actions.filter(a => a.action.type === 'line.annotate' && a.action.n === n && (!before || a.tick <= startTick)).map(a => (a.action as { text: string }).text).filter(t => t.trim() !== '');
    const c = context(sc); const miss: string[] = [];
    const tally: Record<NotationId, { good: number; total: number }> = { carry: { good: 0, total: 0 }, speeds: { good: 0, total: 0 }, quick: { good: 0, total: 0 }, pause: { good: 0, total: 0 }, restart: { good: 0, total: 0 }, transit: { good: 0, total: 0 } };
    const grade = (k: NotationId, ok: boolean, why: string): void => { tally[k].total++; if (ok) tally[k].good++; else miss.push(why); };
    for (const ins of sc.book) {
      const vIn = c.speedBefore.get(ins.n) ?? 0; const texts = ann(ins.n, true);
      const hasSpeed = (xs: string[]): boolean => xs.some(t => numbers(t).some(x => Math.abs(x - vIn) < 0.5));
      if (isPageTop(ins.n) && vIn > 0) grade('carry', hasSpeed(texts), `Line ${ins.n} heads page ${pageOf(ins.n)}: write the speed carried from the page before (${vIn} mph).`);
      if (needsSpeed(ins, c)) grade('speeds', hasSpeed(texts), `Line ${ins.n} prints no speed: write the speed in force (${vIn} mph).`);
      if (isQuick(ins)) {
        const prev = isPageTop(ins.n) ? ann(ins.n - 1, true) : texts; const where = isPageTop(ins.n) ? `the last row of page ${pageOf(ins.n) - 1} (line ${ins.n - 1})` : `line ${ins.n}`;
        grade('quick', prev.some(t => /quick|cq|comes/i.test(t)), `"Comes quick" at line ${ins.n}${isPageTop(ins.n) ? ` heads page ${pageOf(ins.n)}` : ''}: flag it on ${where}.`);
      }
      if (ins.pause) { const ideal = chartPause(sc, ins, vIn); grade('pause', texts.some(t => numbers(t).some(x => Math.abs(x - ideal) <= 1 && x !== vIn)), `Line ${ins.n} pause ${ins.pause} s: write the chart pause time (${ideal.toFixed(1)} s for ${vIn} in / ${ins.timed ? ins.timed.holdSpeed : ins.speed ?? vIn} out).`); }
      if (ins.section === 'restart' && ins.restartTime !== undefined) grade('restart', texts.some(t => parseTimes(t).some(x => sameTime(x, ins.restartTime!))), `Line ${ins.n} restart: write base ${formatClock(ins.baseTime ?? ins.restartTime)} + ASP ${sc.asp} min = ${formatClock(ins.restartTime)}.`);
      if (ins.transit?.end && ins.transit.exact && ins.restartTime === undefined) {
        const begin = exactTransitBegin(sc.book, sc.book.indexOf(ins)); const inEv = begin ? r.events.find(e => e.type === 'transit.in' && e.detail?.n === begin.n) : undefined;
        const out = inEv && begin ? Number(inEv.detail!.tod) + begin.transit!.seconds : null;
        grade('transit', out !== null && ann(ins.n, false).some(t => parseTimes(t).some(x => sameTime(x, out))), `Line ${ins.n} ends the exact transit: write OUT = IN + ${begin ? begin.transit!.seconds / 60 : '?'}m00s${out !== null ? ` = ${formatClock(out)}` : ''}.`);
      }
    }
    const pct = (k: NotationId): number => tally[k].total ? tally[k].good / tally[k].total : 1;
    const ids = Object.keys(tally) as NotationId[]; const worst = Math.min(...ids.map(pct));
    const markStars: 0 | 1 | 2 | 3 = worst >= 0.9 ? 3 : worst >= 0.7 ? 2 : worst >= 0.5 ? 1 : 0;
    const errs = legErrors(r); const mean = meanAbs(errs); const k = driverScale(sc.driver.skill);
    const exec: 1 | 2 | 3 = r.offCourseCount > 0 ? 1 : starsFromMeanAbs(mean, [8 * k, 16 * k, 1e9]) >= 3 ? 3 : starsFromMeanAbs(mean, [8 * k, 16 * k, 1e9]) >= 2 ? 2 : 1;
    const stars = Math.min(markStars, exec) as 0 | 1 | 2 | 3;
    const summary = ids.map(i => `${NOTATION_NAMES[i]} ${tally[i].good}/${tally[i].total}`).join('; ');
    const feedback = [`Notations: ${summary}.`, markStars === 0 && ids.every(i => tally[i].good === 0) ? 'No pre-read marks were made before the start: use the 30 minutes (HB p.15: carry the speed, write the speeds not shown, flag every "comes quick", then the pauses and the restart and transit times).' : 'Triage order: pauses and stops first (chart pause time), restart and transit times second, speeds and "comes quick" third.', ...miss.slice(0, 8)];
    if (exec < markStars) feedback.push(r.offCourseCount ? 'Cold run: you went off course; markings do not help if the turn is missed.' : `Cold run: leg errors averaged ${mean.toFixed(1)} s, which holds the stars down.`);
    feedback.push(headlineTip(r, sc), ...instrumentFindingLines(r.instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay')).slice(0, 1));
    return { score: Math.round(worst * 100), stars, headline: `${summary}; cold run ${mean.toFixed(1)} s mean error`, feedback };
  },
};

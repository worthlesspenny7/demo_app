/** D07 "Morning calibration run" on the digital stopwatch (DRILL-026, STAGE-006, CHART-005, WATCH-009). */
import { PERFECT_TIMEWISE, STOCK_1939_SPEEDO } from '../builder.js';
import { annotatePerfectTimes, buildGhost, ghostTimeAt } from '../ghost.js';
import { rng } from '../rng.js';
import { formatInterval } from '../griid.js';
import type { Scenario } from '../course.js';
import type { StageResult } from '../sim.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base } from './common.js';
import { basicRubric, instrumentFindingLines, withSkillTip } from './rubrics.js';

/** "5m32.0s", "5m32.0", "5:32.0", "332.0" -> seconds. */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/s$/, '');
  let m = /^(\d+)m(\d+(?:\.\d+)?)$/.exec(t); if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(t); if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d+)?)$/.exec(t); if (m) return Number(m[1]);
  return null;
}
/** "cal 3 = 5m32.0 / 7m21.3": the interval and cumulative read off the watch at calibration point 3. */
export function parseCalNotes(notes: string[]): Map<number, { interval: number; cumulative: number }> {
  const out = new Map<number, { interval: number; cumulative: number }>();
  const re = /cal(?:ibration)?\s*(?:pt|point|#)?\s*(\d+)\s*[=:]\s*([0-9ms:.]+)\s*[/|]\s*([0-9ms:.]+)/gi;
  for (const text of notes) for (const m of text.matchAll(re)) { const a = parseDuration(m[2]!), b = parseDuration(m[3]!); if (a !== null && b !== null) out.set(Number(m[1]), { interval: a, cumulative: b }); }
  return out;
}

export interface CalTruth { point: number; line: number; printedInterval: number; printedCumulative: number; crossTod: number | null; lapTod: number | null; watchInterval: number | null; watchCumulative: number | null }
/** What the stopwatch displayed at each calibration point (from the instrument log) next to the printed official times. */
export function calibrationTruth(r: StageResult, sc: Scenario): { points: CalTruth[]; trueK: number | null } {
  const cal = sc.book.filter(i => i.section === 'calibration');
  const first = cal[0]; if (!first) return { points: [], trueK: null };
  const cross = (n: number): number | null => { const ins = sc.book[n - 1]!; const e = r.events.find(x => x.type === 'node' && x.detail?.nodeId === ins.nodeId); return e ? e.tod : null; };
  const laps = r.instrumentLog.filter(e => e.kind === 'watch.lap').map(e => e.tod); const starts = r.instrumentLog.filter(e => e.kind === 'watch.start').map(e => e.tod);
  const t0 = cross(first.n); const startTod = t0 === null ? null : [...starts].reverse().find(s => s <= t0 + 3) ?? null;
  const points: CalTruth[] = []; let prevLap: number | null = startTod;
  cal.slice(1).forEach((ins, i) => {
    const c = cross(ins.n); const lap = c === null ? null : laps.reduce<number | null>((best, l) => Math.abs(l - c) <= 6 && (best === null || Math.abs(l - c) < Math.abs(best - c)) ? l : best, null);
    const interval = lap !== null && prevLap !== null ? lap - prevLap : null; const cumulative = lap !== null && startTod !== null ? lap - startTod : null;
    points.push({ point: i + 1, line: ins.n, printedInterval: ins.perfectInterval ?? 0, printedCumulative: ins.perfectCumulative ?? 0, crossTod: c, lapTod: lap, watchInterval: interval, watchCumulative: cumulative });
    prevLap = lap ?? prevLap;
  });
  const last = points[points.length - 1]; const tEnd = last?.crossTod ?? null;
  const trueK = t0 !== null && tEnd !== null && tEnd > t0 && last ? last.printedCumulative / (tEnd - t0) : null;
  return { points, trueK };
}

/** The factor the player applied: the last speedo.setFactor, else the card's 50 mph entry, else a note "k = 1.0213". */
export function playerFactor(r: StageResult): number | null {
  let k: number | null = null;
  for (const a of r.actions) {
    if (a.action.type === 'speedo.setFactor') k = a.action.k;
    else if (a.action.type === 'card.set' && a.action.card['50']) k = 50 / a.action.card['50'];
    else if (a.action.type === 'note') { const m = /\bk\s*=\s*(\d(?:\.\d+)?)/i.exec(a.action.text); if (m) k = Number(m[1]); }
  }
  return k;
}

export const D07: Drill = {
  id: 'D07', title: 'Morning calibration run', objective: 'Start the stopwatch at the asterisk, lap at every calibration point, read interval and cumulative against the printed box (note "cal 3 = 5m32.0 / 7m21.3"), work out k and set the Timewise factor (or build a cheat card), then run a leg.', skills: ['P5'], minutes: 45, kind: 'drive',
  tiers: tiers([3, 2, 1]), unlock: [], readFirst: ['calibration'],
  scenario(seed, t) {
    const tier = tierOf(D07, t); const r = rng(seed);
    const hiddenGain = 1 + (r.chance(0.5) ? 1 : -1) * (0.015 + r.next() * 0.02); // +-1.5..3.5%: uncorrected = 15-30 s over the 15-minute leg
    const b = base('D07', 'Calibration run', seed, tier, { speedo: t >= 2 ? { ...STOCK_1939_SPEEDO, gain: 1.02 + (r.next() - 0.5) * 0.03 } : { ...PERFECT_TIMEWISE, gain: hiddenGain } }).start(50);
    b.advanceMiles(0.5);
    // STAGE-006: 15 miles at 50 with six calibration points; the printed box gives interval over cumulative to 0.1 s. A short transit follows into the restart.
    b.calibrationRun({ miles: 15, speed: 50, points: 6, thenTransit: { exact: false, seconds: 420 } });
    b.advanceMiles(0.3);
    const g = buildGhost(b.build()); const arrive = ghostTimeAt(g, b.position);
    const restartAt = Math.ceil((arrive + 180) / 60) * 60;
    b.restart(40, restartAt, { text: 'Calibration done. Time-of-day restart at your out-time. Speed 40' });
    b.advanceMiles(3).speedAtSign('SPEED LIMIT 35', 35).advanceMiles(2.5).stop('S', 45).advanceMiles(3).speedAtSign('SPEED LIMIT 40', 40).advanceMiles(2).checkpoint().advanceMiles(1.5).speedAtSign('SPEED LIMIT 45', 45).advanceMiles(3).checkpoint().advanceFt(300).finish();
    const sc = b.build(); sc.tags = [...(sc.tags ?? []), 'd07', 'watch:digital']; annotatePerfectTimes(sc); return sc;
  },
  rubric(r, sc) {
    const rb = basicRubric(r, [3, 8, 15], ['k = sum(perfect)/sum(actual); indicated to hold = assigned / k. Apply it to every speed all day. 1% uncorrected = ~9 s per 15 minutes.'], sc.driver.skill, sc);
    const { points, trueK } = calibrationTruth(r, sc); const notes = parseCalNotes(r.actions.filter(a => a.action.type === 'note').map(a => (a.action as { text: string }).text));
    const feedback: string[] = []; let good = 0;
    for (const p of points) {
      const n = notes.get(p.point); const lab = `Point ${p.point} (printed ${formatInterval(p.printedInterval, true)} / ${formatInterval(p.printedCumulative, true)})`;
      if (p.watchInterval === null || p.watchCumulative === null) { feedback.push(`${lab}: no lap on the stopwatch here, nothing to read.`); continue; }
      if (!n) { feedback.push(`${lab}: not noted. The watch showed ${formatInterval(p.watchInterval, true)} / ${formatInterval(p.watchCumulative, true)}.`); continue; }
      const ok = Math.abs(n.interval - p.watchInterval) <= 0.3 && Math.abs(n.cumulative - p.watchCumulative) <= 0.3; if (ok) good++;
      feedback.push(`${lab}: you read ${formatInterval(n.interval, true)} / ${formatInterval(n.cumulative, true)}, the watch showed ${formatInterval(p.watchInterval, true)} / ${formatInterval(p.watchCumulative, true)} (${ok ? 'within 0.3 s' : 'off'}).`);
    }
    const pct = points.length ? good / points.length : 0; const readStars: 0 | 1 | 2 | 3 = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.5 ? 1 : 0;
    const k = playerFactor(r); const dk = k !== null && trueK !== null ? Math.abs(k - trueK) : Infinity;
    const kStars: 0 | 1 | 2 | 3 = dk <= 0.004 ? 3 : dk <= 0.01 ? 2 : dk <= 0.02 ? 1 : 0;
    const noLap = r.instrumentDiscipline.some(f => f.kind === 'calibrationWithoutLap');
    let stars = Math.min(rb.stars, readStars, kStars, noLap ? 2 : 3) as 0 | 1 | 2 | 3;
    if (!points.length) stars = rb.stars;
    feedback.unshift(`Read-offs within 0.3 s: ${good}/${points.length}. Factor k: ${k === null ? 'not set' : k.toFixed(4)}${trueK === null ? '' : ` (the run says ${trueK.toFixed(4)})`}${k !== null && trueK !== null && kStars < 3 ? '; recompute k = sum(perfect)/sum(actual) from the last cumulative, or the Timewise clicks (CHART-005: new factor = old x correct / actual)' : ''}.`);
    if (noLap) feedback.push(...instrumentFindingLines(r.instrumentDiscipline.filter(f => f.kind === 'calibrationWithoutLap')).slice(0, 1), 'A calibration point passed without a lap caps this drill at two stars.');
    // EDU-002: when the reads, the factor or a missing lap held the stars down, that is the tip, not the leg error
    const tip = stars === 3 || !points.length ? null
      : noLap && stars <= 2 && readStars >= 2 && kStars >= 2 ? 'A calibration point passed without a lap: lap the stopwatch at every calibration point (start it at the asterisk), then read interval and cumulative against the printed box.'
        : readStars <= kStars && readStars < 3 ? `Read-offs within 0.3 s: ${good}/${points.length}. Lap at every calibration point and write what the watch shows, interval over cumulative ("cal 3 = 5m32.0 / 7m21.3"), beside the printed box.`
          : kStars < 3 ? `Factor k ${k === null ? 'was never set' : `${k.toFixed(4)} is off`}${trueK === null ? '' : ` (the run says ${trueK.toFixed(4)})`}: k = printed cumulative / your cumulative at the last point; set the Timewise factor (old x correct / actual) or build the cheat card, parked, before the leg.` : null;
    const out = withSkillTip({ score: rb.score, stars, headline: `${rb.headline} · read-offs ${good}/${points.length}, k ${k === null ? 'not set' : k.toFixed(4)}`, feedback: [...rb.feedback.slice(0, 1), ...feedback, ...rb.feedback.slice(1)], tip: rb.tip }, r, sc, tip);
    return out;
  },
};

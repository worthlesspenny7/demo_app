/** D08b "Time Allowance: the train": file at the printed TA point (DRILL-022, TA-001..004, REG V.H). */
import { EXITS } from '../builder.js';
import { nodeById, type Scenario } from '../course.js';
import { buildGhost, ghostTimeAt } from '../ghost.js';
import { rng } from '../rng.js';
import { formatInterval } from '../griid.js';
import { mphToFps } from '../units.js';
import type { StageResult } from '../sim.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base, T0 } from './common.js';
import { headlineTip } from './rubrics.js';

/** The quote shown when a request is filed for a navigation error (REG V.H.1, HB p.13). */
export const NAV_ERROR_QUOTE = 'REG V.H.1 allows a Time Allowance only for delays "beyond your control, such as blockage of the route by a train or need to assist at the scene of an accident"; mechanical failure, lack of vehicle capability and personal failure are not grounds, and the Rookie Handbook adds "navigation errors, wrong turns, etc." A wrong turn is your own error: stay on course (the third S) and take the time penalty.';

export interface LegDelay { leg: number; measured: number; recoverable: number; possible: number }
/**
 * The committee's view of each leg, rebuilt from the event log with the engine's TA-003/TA-004 rules: waits at a train and (rules.taForSignals) at a red light
 * qualify, less the printed pause the book already grants; the committee deducts what 10 % over the assigned speed could have made up before the checkpoint.
 */
export function committeeView(r: StageResult, sc: Scenario): LegDelay[] {
  const legs = new Map<number, { measured: number; recoverable: number }>(); let leg = 1;
  const timing = sc.checkpoints.filter(c => c.kind === 'timing');
  r.events.forEach((e, i) => {
    if (e.type === 'checkpoint' && e.detail?.kind === 'timing') leg++;
    if (e.type !== 'wait') return;
    const reason = e.detail?.reason; if (reason !== 'train' && reason !== 'signal') return;
    if (reason === 'signal' && !sc.rules.taForSignals) return;
    const rel = r.events.slice(i + 1).find(x => x.type === 'release'); if (!rel) return;
    const node = nodeById(sc.course, String(e.detail!.nodeId)); const ins = sc.book.find(b => b.nodeId === node.id);
    const delay = Math.max(0, rel.tod - e.tod - (reason === 'signal' ? ins?.pause ?? 0 : 0));
    let v = 0; for (const b of sc.book) { if (nodeById(sc.course, b.nodeId).s > node.s) break; v = b.timed ? b.timed.holdSpeed : b.speed ?? v; }
    const cp = timing.find(c => c.s > node.s);
    const rec = cp && v > 0 ? Math.min(delay, (cp.s - node.s) / mphToFps(v) * 0.1) : 0;
    const a = legs.get(leg) ?? { measured: 0, recoverable: 0 }; a.measured += delay; a.recoverable += rec; legs.set(leg, a);
  });
  const n = sc.checkpoints.filter(c => c.kind === 'timing').length;
  return Array.from({ length: n }, (_, k) => { const a = legs.get(k + 1) ?? { measured: 0, recoverable: 0 }; return { leg: k + 1, measured: a.measured, recoverable: a.recoverable, possible: Math.max(0, a.measured - Math.min(a.measured, a.recoverable)) }; });
}

export const D08b: Drill = {
  id: 'D08b', title: 'Time Allowance: the train', objective: 'Gates down. Time the train, keep the ledger, make up the red light yourself (V.H.1 names a train blockage and an accident, not lights), and at the printed TA point file one request for the leg that was blocked: instruction numbers, a multiple of 10 s, never more than the delay you could not make up. A tractor is not a Time Allowance and a wrong turn never is.', skills: ['P6'], minutes: 9, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) {
    const tier = tierOf(D08b, t); const r = rng(seed * 31 + 8); const b = base('D08b', 'Time allowance', seed, tier).start(35);
    // leg 1: two stops with printed pauses, a red light, a railroad crossing with a train (60-120 s), then a short run to the checkpoint
    b.advanceMiles(0.45).stop('R', 35, { pause: 30 });
    b.advanceMiles(0.5).stop('L', 35, { pause: 40 });
    b.advanceMiles(0.4).instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 });
    b.hazard({ kind: 'signal', redSeconds: r.int(28, 40), greenSeconds: 45, offset: T0 + r.int(0, 60) });
    b.advanceMiles(0.55).instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { text: 'RR crossing (gates may be down)', speed: 35 });
    const g1 = buildGhost(b.build()); const arrival = ghostTimeAt(g1, b.position);
    b.hazard({ kind: 'train', startTod: arrival - 35, durationSeconds: r.int(75, 120) }); // gates are already down when the car arrives, even a few seconds early
    b.advanceMiles(0.35).checkpoint();
    // leg 2: a farm tractor holds the car up; it does not qualify, so make it up
    b.advanceMiles(0.5).speedAtSign('SPEED LIMIT 35', 35);
    b.advanceMiles(0.3); b.hazard({ kind: 'slow', speedMph: 18, lengthFt: 1700, passWindowAfterFt: 900 });
    b.advanceMiles(1.6).checkpoint();
    // leg 3: a driveway, then a crossroad where the route turns right: a wrong turn here is a navigation error, never a Time Allowance
    b.advanceMiles(0.4).node({ exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'driveway' });
    b.advanceFt(450).instruction({ exits: EXITS.crossroads('R'), sightDistance: 600 }, { turn: 'R', speed: 35 });
    b.advanceMiles(0.9).checkpoint();
    // the timed portion ends: End timed portion, the TA point (end of stage: acknowledge the scorecard) and a transit to the finish
    b.advanceMiles(0.3).endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 600, miles: 2.5 } });
    b.advanceMiles(2.5);
    const sc = b.observationFinish().build();
    sc.tags = [...(sc.tags ?? []), 'ta:navLeg:3', 'ta:trainLeg:1', 'ta:tractorLeg:2'];
    return sc;
  },
  rubric(r, sc) {
    const filed = r.ta.requests.filter(q => q.status === 'filed');
    const lastByLeg = new Map<number, number>(); for (const q of filed) lastByLeg.set(q.legIndex, q.adjusted);
    const view = committeeView(r, sc);
    const acked = r.ta.scorecardAcked === true;
    const navLegs = r.attribution.filter(a => a.buckets.offCourse >= 5).map(a => a.legIndex);
    const navFiled = [...new Set(r.ta.requests.map(q => q.legIndex))].filter(l => navLegs.includes(l));
    const feedback: string[] = [];
    if (navFiled.length) {
      feedback.push(`You filed for leg ${navFiled.join(', ')}, where the delay was a wrong turn. ${NAV_ERROR_QUOTE}`);
      return { score: 0, stars: 0, headline: `Request filed for a navigation error (leg ${navFiled.join(', ')}): 0 stars`, feedback: [...feedback, headlineTip(r, sc)] };
    }
    if (!filed.length) {
      const owed = view.filter(v => v.possible >= 10).map(v => `leg ${v.leg} (about ${formatInterval(Math.floor(v.possible / 10) * 10)})`);
      return { score: 0, stars: 0, headline: view.some(v => v.measured > 0) ? 'No Time Allowance request was filed' : 'No qualifying delay and no request: the gates were open when you arrived', feedback: [owed.length ? `Time you could have claimed at the TA point: ${owed.join(', ')}. File within 15 minutes of the yellow box: leg number, instruction numbers, an amount in multiples of 10 s ("Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.").` : 'You reached the crossing before the train (running early?): there was no delay to claim, and the drill needs the delay. Hold your pauses and the clock; then file at the TA point.', headlineTip(r, sc)] };
    }
    let worst = 0;
    for (const v of view.concat(Array.from(lastByLeg.keys()).filter(l => !view.some(x => x.leg === l)).map(l => ({ leg: l, measured: 0, recoverable: 0, possible: 0 })))) {
      const sl = r.score.legs[v.leg - 1]; const target = Math.min(v.possible, Math.max(sl?.rawError ?? 0, 0)); const req = lastByLeg.get(v.leg) ?? 0; const credit = sl?.taCredit ?? 0;
      const e = Math.abs(req - target); worst = Math.max(worst, e);
      if (v.measured > 0 || req > 0) feedback.push(`Leg ${v.leg}: delayed ${Math.round(v.measured)} s by the train, ${Math.round(Math.min(v.measured, v.recoverable))} s could have been made up; you requested ${req} s, the committee allowed ${credit} s${sl?.taReason ? ` (${sl.taReason})` : ''}.`);
    }
    const stars: 0 | 1 | 2 | 3 = worst <= 10 && acked ? 3 : worst <= 30 ? 2 : 1;
    if (!acked) feedback.push('At the end-of-stage TA point acknowledge the scorecard, whether or not you filed anything (Example Rally #36).');
    if (worst > 10) feedback.push('Request what the delay was less what you made up, never more; the same seconds are never both a Time Allowance and made-up time.');
    feedback.push(headlineTip(r, sc));
    return { score: Math.round(worst), stars, headline: `${filed.length} request(s) filed, worst miss against the committee credit ${Math.round(worst)} s${acked ? ', scorecard acknowledged' : ', scorecard not acknowledged'}`, feedback };
  },
};

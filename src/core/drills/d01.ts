/** D01 "Stopwatch on the landmark": lap timing on the digital stopwatch (DRILL-026, WATCH-008, WATCH-009). */
import { rng } from '../rng.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base } from './common.js';
import { instrumentFindingLines } from './rubrics.js';

export const D01: Drill = {
  id: 'D01', title: 'Stopwatch on the landmark', objective: 'Start the digital stopwatch, then keep your eyes on the marker, not on the watch, and press lap as the front bumper passes each one. A lap taken while watching the display comes late; a lap while the last split is still frozen is lost (recall first, or wait for the display to release).', skills: ['P1'], minutes: 5, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['which-timer'],
  scenario(seed, t) {
    const tier = tierOf(D01, t); const r = rng(seed); const b = base('D01', 'Stopwatch reaction', seed, tier, { startProcedure: 'drill' }).start(35);
    for (let i = 0; i < 8; i++) { b.advanceMiles(0.15 + r.next() * 0.25); b.instruction({ sign: { text: `MARKER ${i + 1}`, shape: 'rect', side: r.chance(0.5) ? 'L' : 'R' }, sightDistance: 400 }, { text: `Lap at "MARKER ${i + 1}"`, speed: 35 }); }
    const sc = b.advanceMiles(0.2).checkpoint().advanceFt(300).plainFinish().build(); // PLAY-005: no Observation Checkpoint in a stopwatch drill
    sc.tags = [...(sc.tags ?? []), 'd01', 'watch:digital'];
    return sc;
  },
  rubric(r) {
    // the moment the car passed each marker (the node event) against the nearest lap the player pressed (the simulator logs every lap as an instrument event)
    const nodeEvents = r.events.filter(e => e.type === 'node' && String(e.detail?.kind) === 'sign');
    const laps = r.instrumentLog.filter(e => e.kind === 'watch.lap').map(e => e.tod);
    const errs: number[] = [];
    for (const ne of nodeEvents) { const nearest = laps.reduce((best, t) => Math.abs(t - ne.tod) < Math.abs(best - ne.tod) ? t : best, Infinity); if (isFinite(nearest) && Math.abs(nearest - ne.tod) < 10) errs.push(nearest - ne.tod); }
    const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0; const sd = errs.length ? Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / errs.length) : 99;
    // EDU-006: graded on knowledge, not on hand jitter: the mean absolute lap error against the bumper passing the marker. Lapping at the marker
    // (eyes on the road) lands within a few tenths; lapping off the display (eyes on the watch) is late by the look-down-and-up time every time.
    const absErr = errs.length ? errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length : 99;
    const base3: 0 | 1 | 2 | 3 = errs.length < nodeEvents.length * 0.75 ? 0 : absErr <= 0.4 ? 3 : absErr <= 0.8 ? 2 : absErr <= 1.5 ? 1 : 0;
    const frozen = r.instrumentDiscipline.filter(f => f.kind === 'lapWhileFrozen');
    // the frozen-split rule is the other piece of knowledge: a lap pressed while the split is frozen is lost, so the drill stops at one star
    const stars = (frozen.length ? Math.min(1, base3) : base3) as 0 | 1 | 2 | 3;
    const r1 = (x: number): string => (Math.round(x * 10) / 10).toFixed(1);
    const tip = stars === 3 ? 'Clean run: every lap within a few tenths of the bumper passing the marker.'
      : errs.length < nodeEvents.length * 0.75 ? `Only ${errs.length} of ${nodeEvents.length} markers were lapped: start the watch with Space before the first marker, then lap with L at every marker.`
        : frozen.length ? `${frozen.length} lap(s) were pressed while the last split was still frozen, so they were lost: press recall (or wait for the display to release) before the next marker.`
          : mean > 0.3 ? `Your laps were ${r1(mean)} s late on average: that is the look down at the watch and back up. Keep your eyes on the marker, not on the display, and press as the front bumper passes it.`
            : mean < -0.3 ? `Your laps were ${r1(-mean)} s early on average: you anticipate. Press as the front bumper passes the marker, not as it comes up.`
              : `Your laps scatter by ${r1(sd)} s around the marker: pick one reference (the post against the A-pillar) and press on it every time.`;
    const feedback = [tip, sd > 0.6 ? 'Watch the sign, not the dial: lap by feel as the post passes the A-pillar.' : 'Good hands. Keep the eyes on the road and the thumb on the lap button.',
      errs.length ? `Lap errors (s): ${errs.map(e => (e > 0 ? '+' : '') + r1(e)).join(', ')} (mean absolute ${r1(absErr)} s; three stars need 0.4 s or less).` : 'No laps pressed near a marker: Start with Space, lap with L as the bumper passes.',
      ...(frozen.length ? [...instrumentFindingLines(frozen), 'A lap taken while the split was frozen holds this drill at one star.'] : [])];
    return { score: Math.round(absErr * 100) / 100, stars, tip, headline: `${errs.length}/${nodeEvents.length} markers lapped, ${r1(absErr)} s off on average (bias ${r1(mean)} s, jitter ${r1(sd)} s)${frozen.length ? `, ${frozen.length} lap(s) while frozen` : ''}`, feedback };
  },
};

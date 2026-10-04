/** D01 "Stopwatch on the landmark": lap timing on the digital stopwatch (DRILL-026, WATCH-008, WATCH-009). */
import { rng } from '../rng.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base } from './common.js';
import { instrumentFindingLines } from './rubrics.js';

export const D01: Drill = {
  id: 'D01', title: 'Stopwatch on the landmark', objective: 'Start the digital stopwatch and press lap as the front bumper passes each marker. Consistency beats bias; a lap while the last split is still frozen is lost (recall first, or wait for the display to release).', skills: ['P1'], minutes: 3, kind: 'drive',
  tiers: tiers(), unlock: [],
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
    const base3: 0 | 1 | 2 | 3 = errs.length < nodeEvents.length * 0.75 ? 0 : sd <= 0.3 ? 3 : sd <= 0.6 ? 2 : sd <= 1.0 ? 1 : 0;
    const frozen = r.instrumentDiscipline.filter(f => f.kind === 'lapWhileFrozen');
    const stars = Math.max(0, base3 - (frozen.length && base3 > 0 ? 1 : 0)) as 0 | 1 | 2 | 3;
    const r1 = (x: number): string => (Math.round(x * 10) / 10).toFixed(1);
    const feedback = [sd > 0.6 ? 'Watch the sign, not the dial: lap by feel as the post passes the A-pillar.' : 'Good hands. A constant bias calibrates out; jitter does not.',
      errs.length ? `Lap errors (s): ${errs.map(e => (e > 0 ? '+' : '') + r1(e)).join(', ')}.` : 'No laps pressed near a marker: Start with Space, lap with L as the bumper passes.',
      ...(frozen.length ? [...instrumentFindingLines(frozen), 'A lap taken while the split was frozen costs a star.'] : [])];
    return { score: Math.round(sd * 100) / 100, stars, headline: `${errs.length}/${nodeEvents.length} markers lapped, bias ${r1(mean)} s, jitter ${r1(sd)} s${frozen.length ? `, ${frozen.length} lap(s) while frozen` : ''}`, feedback };
  },
};

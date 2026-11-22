/** Pass 2 rule checks on the widget models (pure): holdSpeed drift for a 1 % fast car over an hour (expect 36 s early), integer slider steps,
 *  whereCheckpoint perfect time for 0.3 mi at 35 (expect 30.86 s) and the strip scale, readScorecard arithmetic for seeds 1-5. */
import { HoldSpeedModel, WhereCheckpointModel, sampleScorecard, scorecardTotal, cardTotal } from '../src/ui/school2/widget-models.js';
const h = new HoldSpeedModel(35, 35 * 1.01, 0); for (let i = 0; i < 36000; i++) h.step(0.1);
console.log('hold 1% fast for 3600 s: drift', h.drift().toFixed(2), 's (expect -36: early)');
const h2 = new HoldSpeedModel(35, 36, 0); for (let i = 0; i < 600; i++) h2.step(0.1);
console.log('hold 36 vs 35 for 60 s (slider step 1 mph = 2.9 %): drift', h2.drift().toFixed(2), 's');
const w = new WhereCheckpointModel(35, 0.3, 1);
console.log('where 0.3 mi @35: perfect', w.perfect.toFixed(2), 's; car mph', w.carMph, 'car at CP', w.carAtCheckpoint().toFixed(2), 's; strip = 1.5 x leg, so the CP sits at', (1 / 1.5 * 100).toFixed(0), '% of the strip; car reaches strip end at', (w.legFt * 1.5 / (w.carMph * 5280 / 3600)).toFixed(1), 's; leg gives up at', w.maxSeconds().toFixed(1));
for (let s = 1; s <= 5; s++) { const legs = sampleScorecard(s); const t = scorecardTotal(legs, 1939); const ok = legs.every(l => l.score.penalty === Math.min(Math.abs(Math.round(l.actual) - l.perfect), l.actual > l.perfect ? 120 : 300)); console.log('scorecard seed', s, legs.map(l => `${l.perfect}->${l.actual}=${l.score.penalty}`).join(' '), 'raw', cardTotal(legs), 'x0.845 =', t.score, (t.raw * 0.845).toFixed(4), 'per-leg ok', ok); }

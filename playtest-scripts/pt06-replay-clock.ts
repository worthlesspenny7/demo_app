/** PT-06 area 9: observe({clock:true}) records an instrumentLog entry but is not an action, so a replay of live.actions loses it. */
import { simpleStart, Simulator, adv, log } from './pt06-common.js';
const sc = simpleStart(0, 0, 2, 60);
const live = new Simulator(sc, { watch: 'digital' });
live.act({ type: 'start' }); adv(live, 5);
live.observe({ peek: true, clock: true });   // the UI's clock-glance path (API.md: observe({peek:true, clock:true}) logs a clock read)
adv(live, 60);
const rep = new Simulator(sc, { watch: 'digital' }); let i = 0;
while (rep.tick <= live.tick) { while (i < live.actions.length && live.actions[i]!.tick <= rep.tick) rep.act(live.actions[i++]!.action); if (rep.tick === live.tick) break; rep.step(0.1); }
log('live   clock reads', live.instrumentLog.filter(e => e.kind === 'clock.read').length, ' discipline', live.result().instrumentDiscipline.length);
log('replay clock reads', rep.instrumentLog.filter(e => e.kind === 'clock.read').length, ' discipline', rep.result().instrumentDiscipline.length);

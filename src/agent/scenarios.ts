/** Built-in scenario sources for the CLI and tests. */
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE, STOCK_1939_SPEEDO } from '../core/builder.js';
import { DRIVER_EXPERT, DRIVER_DAD_SPORTSMAN, DRIVER_DAD_ROOKIE, LEGAL_AIDS, type Scenario } from '../core/course.js';
import { hms } from '../core/units.js';
import { rng } from '../core/rng.js';

export function builtinScenario(name: string, seed = 1): Scenario {
  const T0 = hms(8, 0, 0);
  switch (name) {
    case 'straight': return new ScenarioBuilder({ id: 'straight', name: 'One mile straight', startTime: T0, seed, driver: DRIVER_EXPERT }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    case 'onestop': return new ScenarioBuilder({ id: 'onestop', name: 'One stop', startTime: T0, seed, driver: DRIVER_EXPERT }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    case 'varied': {
      const r = rng(seed);
      const b = new ScenarioBuilder({ id: `varied-${seed}`, name: 'Varied leg', startTime: T0, seed, driver: DRIVER_DAD_SPORTSMAN, speedo: PERFECT_TIMEWISE, aids: LEGAL_AIDS, prereadSeconds: 120, trafficWaitProbability: 0.2 });
      b.start(r.pick([30, 35, 40]));
      b.advanceMiles(0.4 + r.next()).stop(r.pick(['L', 'R', 'S']), r.pick([30, 35, 40]), { hint: 'Comes quick' });
      b.advanceMiles(0.3 + r.next()).speedAtSign('SPEED LIMIT 45', 45);
      b.advanceMiles(0.3 + r.next()).timedAt('bridge', { holdSpeed: 30, seconds: 20 + r.int(0, 40), thenSpeed: 40 });
      b.advanceMiles(0.5 + r.next()).instruction({ exits: EXITS.tee('L'), sightDistance: 600 }, { turn: 'L', speed: 35 });
      b.advanceMiles(0.4 + r.next()).stop('R', 40);
      b.advanceMiles(0.3 + r.next()).checkpoint();
      b.advanceMiles(0.6 + r.next()).instruction({ exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 500 }, { text: 'Continue (driveway on R)', speed: 40 });
      b.advanceMiles(0.4 + r.next()).stop('L', 35);
      b.advanceMiles(0.5 + r.next()).checkpoint();
      b.advanceFt(400).finish();
      return b.build();
    }
    case 'mechanical': return new ScenarioBuilder({ id: 'mechanical', name: 'Stock speedo straight', startTime: T0, seed, driver: DRIVER_DAD_ROOKIE, speedo: STOCK_1939_SPEEDO }).start(40).advanceMiles(5).checkpoint().advanceFt(300).finish().build();
    default: throw new Error(`unknown builtin scenario ${name}`);
  }
}

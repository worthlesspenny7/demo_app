/** EDUCATION validation: debrief VM tip + rubric tip + counterfactuals on real results. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot, OracleBot, type BotName } from '../src/agent/bots.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';
import { counterfactuals } from '../src/ui/viewmodels/counterfactual.js';

const cases = (process.argv[2] ?? 'D03:0:1:oracle,D03:0:1:rookie,D03:0:1:noPause,D04:0:1:goCount,D05:0:1:rookie,D07:0:1:oracle,D07:2:1:oracleNoRec,D08:0:1:oracleNoRec,D08b:0:1:oracle,D16:0:1:rookie,D18:0:1:oracle,D11:0:1:oracle,D11:0:1:rookie,D10:0:1:rookie').split(',');
const cf = process.argv[3] !== 'nocf';
for (const c of cases) {
  const [id, t, s, bn] = c.split(':'); const d = drillById(id!)!; const sc = d.scenario(Number(s), Number(t)); const sim = new Simulator(sc);
  const bot = bn === 'oracleNoRec' ? new OracleBot(sim, { useWatch: true, noRecovery: true }) : makeBot(bn as BotName, sim, Number(s));
  const r = runBot(sim, bot); const rb = d.rubric(r, sc); const vm = debriefViewModel(r, sc, {});
  console.log(`\n=== ${c}  legs=[${r.score.legs.map(l => l.error).join(',')}] stars=${rb.stars}`);
  console.log(` rubric.headline: ${rb.headline}`);
  console.log(` rubric.tip[0]  : ${rb.feedback[0]}`);
  console.log(` vm.headline    : ${vm.headline}`);
  console.log(` vm.TIP         : ${vm.tip}`);
  console.log(` vm.totals      : ${Object.entries(vm.totals).filter(([, v]) => Math.abs(v) >= 0.5).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}  | residuals ${vm.legs.map(l => l.residual).join(',')}`);
  if (vm.stops.length) console.log(` stops: ${vm.stops.slice(0, 3).map(x => `ideal ${x.correctDwell?.toFixed(1)} yours ${x.yourDwell.toFixed(1)} d ${x.delta.toFixed(1)}`).join(' | ')}`);
  if (vm.timed.length) console.log(` timed: ${vm.timed.slice(0, 2).map(x => x.text).join(' | ').slice(0, 300)}`);
  if (vm.landmarks.length) console.log(` landm: ${vm.landmarks.slice(0, 2).map(x => x.text).join(' | ').slice(0, 300)}`);
  if (vm.cruise.length) console.log(` cruise: ${vm.cruise.slice(0, 2).map(x => x.text).join(' | ').slice(0, 300)}`);
  if (vm.bias.rows.length) console.log(` bias: ${vm.bias.rows.filter(x => x.n).map(x => `${x.type} n${x.n} mean ${x.mean} sd ${x.sd} ${x.verdict}`).join('; ')}`);
  if (cf) { try { for (const row of counterfactuals(r, sc, { perStop: false })) console.log(`  CF ${row.id}: ${row.applicable ? `raw ${row.rawBefore} -> ${row.rawAfter}` : 'n/a'}`); } catch (e) { console.log('  CF error', (e as Error).message); } }
}

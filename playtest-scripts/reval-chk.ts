import '../src/core/drills/index.js';
import { drillById, allDrills } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const d = drillById('D07')!;
console.log('D07 gains seeds1-12 t0:', [1,2,3,4,5,6,7,8,9,10,11,12].map(s => d.scenario(s, 0).speedo.gain.toFixed(3)).join(' '));
console.log('registered drills:', allDrills().map(x => x.id + '(' + x.minutes + 'm)').join(' '));
// attribution tail check
const d3 = drillById('D03')!; const sc = d3.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
console.log('D03 rookie legs', r.score.legs.length, 'attribution entries', r.attribution.length, r.attribution.map(a => a.legIndex + ':' + Object.entries(a.buckets).filter(([,v]) => Math.abs(v)>=1).map(([k,v]) => k + v.toFixed(0)).join(',')).join(' | '), 'errs', r.score.legs.map(l => l.error).join(','));
// D12 length: sim minutes
const d12 = drillById('D12')!; for (const s of [1,2,3]) { const sc12 = d12.scenario(s, 0); const sim12 = new Simulator(sc12); const r12 = runBot(sim12, new OracleBot(sim12, { useWatch: true })); console.log('D12 s'+s, 'lines', sc12.book.length, 'sim minutes (tod span)', ((sim12.tod - sc12.startTime)/60).toFixed(0)); }

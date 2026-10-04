import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { allDrills } from '../src/core/drills/registry.js';
await registerAll();
// ENG-007: ta.request after finish refused; ENG-019 pace cars none in calibration
{ const sc = generateStage(1, { ...PROFILES.fullStage, asp: 37 } as any); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true }); (bot as any).declareTA = () => {};
  let calSamples = 0, calCars = 0;
  for (let t = 0; t < 2_000_000 && sim.phase !== 'finished'; t++) { bot.onTick(sim); sim.step(0.1); if (t % 20 === 0 && (sim as any).inCalibrationRun()) { calSamples++; const o = sim.observe({ peek: true }); if (o.paceCars.ahead || o.paceCars.behind) calCars++; } }
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2, toLine: 2 } as any); const r = sim.taRequests[sim.taRequests.length - 1];
  console.log(`ENG-007 request after finish: ${r?.status} (${r?.reason?.slice(0, 70)})`); console.log(`ENG-019 pace cars in calibration: ${calCars}/${calSamples} samples`); }
// ENG-021: launchInfo kinds at the exact-transit OUT and lunch in D16
{ const d16 = allDrills().find(d => d.id === 'D16')!; const sc = d16.scenario(2, 1); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true }); const kinds = new Set<string>();
  for (let t = 0; t < 2_000_000 && sim.phase !== 'finished'; t++) { bot.onTick(sim); sim.step(0.1); if (t % 10 === 0) { const li = sim.launchInfo(); if (li) kinds.add(li.kind); } }
  console.log('ENG-021 launchInfo kinds seen in D16:', [...kinds].join(',')); }

/** PT-09 area 1 extras: negative controls and the ENG-008 file loader path. */
import { normalizeScenario, validateScenario } from '../src/core/course.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { writeFileSync } from 'node:fs';
const sc = JSON.parse(JSON.stringify(builtinScenario('varied', 4)));
// an "older" file: no asp, no timeZone, no bookStyle, partial rules, no baseStartTime
delete sc.asp; delete sc.timeZone; delete sc.bookStyle; delete sc.baseStartTime; for (const k of ['maxLate', 'maxEarly', 'missedCheckpoint', 'clockMinuteSlop', 'splitHoldSeconds', 'taMaxRequestSeconds', 'earlyDeparturePenalties']) delete sc.rules[k];
writeFileSync('/tmp/pt09-legacy.json', JSON.stringify(sc));
const loaded = normalizeScenario(JSON.parse(JSON.stringify(sc)));
console.log('validate(raw old file):', validateScenario(sc as never).length, 'problems | validate(normalized):', validateScenario(loaded).join('; ') || 'clean');
const sim = new Simulator(loaded, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
console.log('run of the normalized old file: phase', sim.phase, 'raw', r.score.raw, 'finite', Number.isFinite(r.score.score), 'pace cars at +30 s:', JSON.stringify(sim.observe({ peek: true }).paceCars));
// scenario that has asp but a partial rules object with strings
const bad = JSON.parse(JSON.stringify(builtinScenario('varied', 4))); bad.rules.maxLate = '120'; bad.asp = -3;
console.log('string rule / negative asp ->', validateScenario(normalizeScenario(bad)).join('; ') || 'clean (silently accepted)');

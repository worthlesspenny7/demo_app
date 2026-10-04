import { accelLoss, stopLoss, rampLead, buildPerfTable, PACKARD_1936 } from '../src/core/perf-table.js';
import { FORD_1939, MODERN_CAR } from '../src/core/course.js';
const speeds = [5, 10, 15, 20, 25, 30, 35, 40, 45, 48, 50, 55, 60, 80];
for (const car of [FORD_1939, MODERN_CAR]) console.log(car.name, speeds.map(v => `${v}:${accelLoss(v, car).toFixed(2)}`).join(' '));
console.log('stopLoss 55>55', stopLoss(55, 55, FORD_1939).toFixed(2), '10>10', stopLoss(10, 10, FORD_1939).toFixed(2), '48>48', stopLoss(48, 48, FORD_1939).toFixed(2), '0>35', stopLoss(0, 35, FORD_1939).toFixed(2), '35>0', stopLoss(35, 0, FORD_1939).toFixed(2));
const NaNs: string[] = []; for (const v of [0, 1, 5, 7.5, 10, 33, 48, 55, 70]) for (const w of [0, 1, 5, 10, 33, 48, 55, 70]) { for (const [n, f] of [['stopLoss', stopLoss(v, w, FORD_1939)], ['rampLead', rampLead(v, w, FORD_1939)]] as const) if (!Number.isFinite(f)) NaNs.push(`${n}(${v},${w})=${f}`); }
console.log('non-finite', NaNs.join(' ') || 'none');

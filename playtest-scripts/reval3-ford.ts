import { FORD_1939 } from '../src/core/course.js';
import { accelLoss, stopLoss, rampLead } from '../src/core/perf-table.js';
const f = (x: number) => x.toFixed(1);
console.log('accelLoss 0->v:', [20, 25, 30, 35, 40, 45, 50].map(v => `${v}=${f(accelLoss(v, FORD_1939))}`).join(' '));
console.log('stopLoss v->v:', [20, 25, 30, 35, 40, 45, 50].map(v => `${v}=${f(stopLoss(v, v, FORD_1939))}`).join(' '));
console.log('rampLead 30->40', f(rampLead(30, 40, FORD_1939)), ' 40->30', f(rampLead(40, 30, FORD_1939)), ' 35->30', f(rampLead(35, 30, FORD_1939)));

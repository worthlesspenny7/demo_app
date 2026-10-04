import { makeUpPlan, scheduleCorrection, MAKEUP_RATES } from '../src/core/ledger.js';
console.log('rates', JSON.stringify(MAKEUP_RATES));
for (const [s, v] of [[4, 35], [4.4, 40], [6, 40], [12, 40], [3, 48], [6, 55]] as const) console.log(`${s} s at ${v}:`, JSON.stringify(makeUpPlan(s, v)));
console.log('sched 5.6s/28min', scheduleCorrection(5.6, 28*60), '4.1/28:43', scheduleCorrection(4.1, 28*60+43), '0', scheduleCorrection(0, 1680));

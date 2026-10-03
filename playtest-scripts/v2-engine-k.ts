import { adjustFactor, clicksPerSecondPerHour, timewiseAdjustment } from '../src/core/calibration.js';
console.log('clicks/s/h at 4315', clicksPerSecondPerHour(4315), 'adjustFactor', adjustFactor(4315, 1723.2, 1727.3), 'timewise', JSON.stringify(timewiseAdjustment(4315, 1723.2, 1727.3)));

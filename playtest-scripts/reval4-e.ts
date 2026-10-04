/** V4 re-run of V2: calibration official times (0.1 s), Column C/D, pauses only where printed, speeds 15-55, miles in odometer box. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot } from '../src/agent/bots.js';
import { instructionS, nodeById } from '../src/core/course.js';
import { columnCLines, columnD, odometerBox, formatInterval } from '../src/core/griid.js';
import { mphToFps } from '../src/core/units.js';
const speedHist: Record<number, number> = {}; let totalRows = 0, rowsNoSpeed = 0, stops = 0, stopsPaused = 0, signalPaused = 0, signals = 0, rrPaused = 0, rrs = 0;
let calMaxErr = 0; let calPoints: number[] = []; let calOk = 0, calN = 0; const lens: number[] = [];
for (let seed = 1; seed <= 8; seed++) {
  for (const style of ['example', 'race'] as const) {
    const sc = generateStage(seed, { ...PROFILES.fullStage, bookStyle: style } as any);
    if (style === 'example') {
      // calibration
      const cal = sc.book.filter(i => i.section === 'calibration');
      const start = cal.find(i => i.calibrationStart)!; let prevS = instructionS(sc.course, start); let cum = 0; let n = 0;
      for (const i of cal) { if (i.calibrationStart) continue; const s = instructionS(sc.course, i); const iv = (s - prevS) / mphToFps(50); cum += iv; prevS = s; n++; calN++;
        const e1 = Math.abs(iv - (i.perfectInterval ?? NaN)), e2 = Math.abs(cum - (i.perfectCumulative ?? NaN)); calMaxErr = Math.max(calMaxErr, e1, e2);
        if (Math.abs(((i.perfectInterval ?? 0) * 10) - Math.round((i.perfectInterval ?? 0) * 10)) < 1e-6) calOk++; }
      calPoints.push(n);
      const miles = (prevS - instructionS(sc.course, start)) / 5280; lens.push(miles);
      if (seed <= 3) console.log(`seed ${seed}: calibration points ${n}, run length ${miles.toFixed(2)} mi, startRow C=[${columnCLines(start, sc.timeZone).join(' / ')}] box ${odometerBox(start)}`);
      // lengths: stage miles
      const last = sc.course.nodes[sc.course.nodes.length - 1]!; if (seed <= 3) console.log(`   stage length ${(last.s / 5280).toFixed(1)} mi, rows ${sc.book.length}, pages@6 ${Math.ceil(sc.book.length / 6)}, pages@8 ${Math.ceil(sc.book.length / 8)}, cps ${sc.checkpoints.length}`);
    }
    for (const ins of sc.book) {
      if (style !== 'example') continue;
      totalRows++;
      const cl = columnCLines(ins, sc.timeZone); const hasSpeed = cl.some(l => /^\d+ MPH$/.test(l)) ;
      if (!hasSpeed && !ins.section?.match(/start|warmup|transit|calibration/)) rowsNoSpeed++;
      for (const l of cl) { const m = /^(\d+) MPH$/.exec(l); if (m) speedHist[+m[1]!] = (speedHist[+m[1]!] ?? 0) + 1; }
      const node = nodeById(sc.course, ins.nodeId);
      const printedPause = cl.includes('0 MPH');
      if (node.control === 'STOP') { stops++; if (printedPause) stopsPaused++; }
      if (node.control === 'SIGNAL') { signals++; if (printedPause) signalPaused++; }
      if (node.control === 'RR') { rrs++; if (printedPause) rrPaused++; }
      if ((typeof ins.pause === 'number' && ins.pause > 0) !== printedPause) console.log('MISMATCH pause vs ColC', seed, ins.n, ins.pause, cl);
      if (printedPause && ins.pause !== 15 && seed <= 2) console.log('  non-15 pause', ins.n, ins.pause);
    }
  }
}
console.log('rows', totalRows, 'rows with NO speed in Col C (speed carried, outside start/warmup/transit/calibration):', rowsNoSpeed, `(${(100 * rowsNoSpeed / totalRows).toFixed(1)}%)`);
console.log('speed histogram', JSON.stringify(speedHist), 'min', Math.min(...Object.keys(speedHist).map(Number)), 'max', Math.max(...Object.keys(speedHist).map(Number)));
console.log(`STOP rows ${stops}, with printed pause ${stopsPaused} (${(100 * stopsPaused / stops).toFixed(0)}%); SIGNAL ${signals} paused ${signalPaused}; RR ${rrs} paused ${rrPaused}`);
console.log('calibration: points per run', calPoints.join(','), 'run lengths', lens.map(x => x.toFixed(1)).join(','), 'max |printed - computed| s', calMaxErr.toFixed(3), 'printed values on 0.1 s grid', calOk, '/', calN);

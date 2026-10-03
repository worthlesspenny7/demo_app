import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { columnCLines, columnBSymbols, odometerBox, columnD } from '../src/core/griid.js';
const seed = Number(process.argv[2] ?? 1); const style = (process.argv[3] ?? 'example') as 'example'|'race';
const from = Number(process.argv[4] ?? 1), to = Number(process.argv[5] ?? 60);
const sc = generateStage(seed, { ...PROFILES.fullStage, bookStyle: style } as any);
console.log('style', sc.bookStyle);
sc.book.forEach((ins, i) => { const n = i + 1; if (n < from || n > to) return;
  console.log(String(ins.number ?? n).padStart(3), '|B', columnBSymbols(ins).join(',') + (odometerBox(ins) ? ' ' + odometerBox(ins) : ''), '|C', columnCLines(ins, sc.timeZone).join(' / '), '|D', columnD(ins, style).slice(0, 110), ins.section ?? '', ins.taPoint ? 'TAPOINT' : ''); });

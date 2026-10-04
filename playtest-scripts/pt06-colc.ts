import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { columnCLines, columnBSymbols } from '../src/core/griid.js';
const bad: string[] = []; let withPause = 0, shown = 0;
for (let seed = 1; seed <= 50; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  for (const ins of sc.book) {
    const lines = columnCLines(ins, sc.timeZone).join(' | ');
    const printsPause = /^0 MPH/.test(lines) || /\| 0 MPH/.test(lines);
    if (ins.pause && !new RegExp(`0m${String(ins.pause).padStart(2, '0')}s`).test(lines)) bad.push(`seed ${seed} line ${ins.n}: pause ${ins.pause} printed as "${lines}"`);
    if (ins.pause) { withPause++; if (printsPause) shown++; else bad.push(`seed ${seed} line ${ins.n}: pause ${ins.pause} not printed: "${lines}"`); }
    else if (printsPause) bad.push(`seed ${seed} line ${ins.n}: Column C prints a pause but ins.pause is ${ins.pause}: "${lines}"`);
  }
}
console.log(withPause, shown, bad.length); console.log(bad.slice(0, 10).join('\n'));
const sc = generateStage(1, PROFILES.fullStage); const i = sc.book.find(x => x.pause)!; console.log(i.n, columnCLines(i, sc.timeZone), columnBSymbols(i));

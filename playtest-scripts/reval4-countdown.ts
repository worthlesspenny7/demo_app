import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { columnCLines } from '../src/core/griid.js';
let both = 0, guide = 0, cd = 0; const ex: string[] = [];
for (let seed = 1; seed <= 8; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  sc.book.forEach(b => { if (b.transitGuide !== undefined) guide++; if (b.transitCountdown !== undefined) cd++; if (b.transitGuide !== undefined && b.transitCountdown !== undefined) { both++; ex.push(`seed ${seed} row ${b.n}: ${columnCLines(b, sc.timeZone).join(' / ')}`); } });
  // list the countdown/guide sequence for the long lunch transit
  const seq = sc.book.filter(b => b.transitGuide !== undefined || b.transitCountdown !== undefined).map(b => `${b.n}:${b.transitCountdown ?? ''}/${b.transitGuide ?? ''}`);
  if (seed <= 2) console.log('seed', seed, seq.join(' '));
}
console.log({ guide, cd, both }); console.log(ex.join('\n'));

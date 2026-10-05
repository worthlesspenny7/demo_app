/** PT-12: copy of the PT-11 script, port 4183, scratch pt12. */
/** PT-11: static answer-tell audit of every lesson check (content/lessons.ts) and the D09 TRAP_QUIZ pool: is the right option the longest,
 *  second longest, the only one with a ';' or ':' ? Read-only import of the content. usage: npx tsx playtest-scripts/pt12-01-checks.ts */
import * as L from '../content/lessons.js';
const lessons: any[] = (L as any).LESSONS ?? Object.values(L).find((v: any) => Array.isArray(v) && v[0]?.check) ?? [];
let longest = 0, second = 0, n = 0, punctOnly = 0;
const rows: string[] = [];
for (const l of lessons) {
  const c = l.check; if (!c) continue; n++;
  const lens = c.options.map((o: string) => o.length); const order = [...lens.keys()].sort((a, b) => lens[b] - lens[a]);
  const rank = order.indexOf(c.answer) + 1; if (rank === 1) longest++; if (rank === 2) second++;
  const p = c.options.map((o: string) => /[;:]/.test(o)); if (p[c.answer] && p.filter(Boolean).length === 1) punctOnly++;
  rows.push(`${l.id.padEnd(16)} ${c.options.length} opts, right len ${lens[c.answer]} rank ${rank} lens ${lens.join('/')} ratio ${(Math.max(...lens) / Math.min(...lens)).toFixed(2)}${p[c.answer] && p.filter(Boolean).length === 1 ? ' ONLY-PUNCT' : ''}\n     right: ${c.options[c.answer]}\n     wrong: ${c.options.filter((_: string, i: number) => i !== c.answer).join(' | ')}`);
}
console.log(rows.join('\n'));
console.log(`\n${n} lesson checks: right is longest on ${longest}, second longest on ${second}, the only option with ; or : on ${punctOnly}`);

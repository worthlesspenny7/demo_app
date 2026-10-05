/** PT-12: answer-tell audit of the D09 deck dumps (02-d09-dump-<deck>.txt from pt12-02-d09.ts dump) and the lesson checks.
 *  Predictors tried "without reading the scene": longest, second longest, shortest, position, most commas, contains ', then', most words shared with the
 *  "Line reads:" text, most digits, the option that starts with the verb most common across the deck. usage: npx tsx pt12-03-tells.ts <dir> */
import { readFileSync, readdirSync } from 'node:fs';
import * as L from '../content/lessons.js';
const dir = process.argv[2]!;
type Card = { prompt: string; opts: string[]; right: number };
const cards: Record<string, Card[]> = {};
for (const f of readdirSync(dir).filter(f => /^02-d09-dump-\d+\.txt$/.test(f))) {
  const t = readFileSync(`${dir}/${f}`, 'utf8'); const out: Card[] = [];
  for (const blk of t.split('\n## card ').slice(1)) {
    const lines = blk.split('\n'); const prompt = lines[0]!.replace(/^\d+: /, '');
    const opts = lines.filter(l => /^   \d/.test(l)).map(l => l.trim().slice(1));
    const fb = lines.find(l => / -> pressed/.test(l)) ?? '';
    let right = -1; if (/: Right\./.test(fb)) right = 0; else { const m = /: No: (.*?)\. /.exec(fb + ' '); if (m) right = opts.findIndex(o => o.startsWith(m[1]!.slice(0, 40)) || m[1]!.startsWith(o.slice(0, 40))); }
    out.push({ prompt, opts, right });
  }
  cards[f.replace(/\D/g, '')] = out;
}
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const preds: Record<string, (c: Card) => number> = {
  longest: c => { const l = c.opts.map(o => o.length); return l.indexOf(Math.max(...l)); },
  secondLongest: c => { const l = c.opts.map(o => o.length); const s = [...l.keys()].sort((a, b) => l[b]! - l[a]!); return s[1]!; },
  shortest: c => { const l = c.opts.map(o => o.length); return l.indexOf(Math.min(...l)); },
  mostCommas: c => { const n = c.opts.map(o => (o.match(/,/g) ?? []).length); return n.indexOf(Math.max(...n)); },
  thenClause: c => c.opts.findIndex(o => /, then|then /.test(o)),
  mostOverlapWithLine: c => { const lr = /Line reads: (.*?)\./.exec(c.prompt)?.[1] ?? c.prompt; const W = words(lr); const sc = c.opts.map(o => [...words(o)].filter(w => W.has(w)).length); return sc.indexOf(Math.max(...sc)); },
  mostOverlapWithScene: c => { const W = words(c.prompt); const sc = c.opts.map(o => [...words(o)].filter(w => W.has(w)).length); return sc.indexOf(Math.max(...sc)); },
  noBecauseSince: c => { const i = c.opts.map(o => /\b(since|because|anyway|as well)\b/i.test(o)); return i.filter(x => !x).length === 1 ? i.indexOf(false) : -1; },
  excuseThenOverlap: c => { const W = words(c.prompt); const sc = c.opts.map(o => /\b(since|because|anyway|as well|instead)\b/i.test(o) ? -1 : [...words(o)].filter(w => W.has(w)).length); return sc.indexOf(Math.max(...sc)); },
  stopFully: c => c.opts.findIndex(o => /stop fully|full stop|read both/i.test(o)),
};
for (const [deck, cs] of Object.entries(cards)) {
  const pos = [0, 0, 0, 0]; for (const c of cs) if (c.right >= 0) pos[c.right]!++;
  const res = Object.entries(preds).map(([k, f]) => `${k} ${cs.filter(c => c.right >= 0 && f(c) === c.right).length}`);
  console.log(`deck ${deck}: ${cs.length} cards (unparsed ${cs.filter(c => c.right < 0).length}); right position 1-4: ${pos.join('/')}; predictors: ${res.join(', ')}`);
  const ranks = cs.map(c => { const l = c.opts.map(o => o.length); const s = [...l.keys()].sort((a, b) => l[b]! - l[a]!); return s.indexOf(c.right) + 1; });
  console.log(`   length rank of the right option per card: ${ranks.join(' ')}`);
  const reasons = cs.map(c => c.opts.filter((o, i) => i !== c.right && /\b(since|because|anyway|as well)\b/i.test(o)).length + '/' + (/\b(since|because|anyway|as well)\b/i.test(c.opts[c.right] ?? '') ? 'R' : '-'));
  console.log(`   wrong options with a "since/because/anyway" excuse / right has one: ${reasons.join(' ')}`);
}
// lesson checks: same predictors
const lessons: any[] = (L as any).LESSONS ?? [];
const lc = lessons.filter(l => l.check && l.check.options.some((o: string) => /[a-z]{4}/i.test(o) && o.split(' ').length > 3));
const lcards: Card[] = lc.map(l => ({ prompt: l.check.question ?? l.check.q ?? '', opts: l.check.options, right: l.check.answer }));
console.log(`lesson text checks (${lcards.length}): ` + Object.entries(preds).map(([k, f]) => `${k} ${lcards.filter(c => f(c) === c.right).length}`).join(', '));
for (const c of lcards) console.log('   ' + c.opts.map((o, i) => (i === c.right ? '*' : ' ') + o).join(' | '));

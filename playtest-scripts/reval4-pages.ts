import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { bookLayout } from '../src/ui/viewmodels/book.js';
const hist: Record<number, number> = {}; let pagesTot = 0;
for (let seed = 1; seed <= 12; seed++) {
  for (const style of ['race', 'example'] as const) {
    const sc = generateStage(seed, { ...PROFILES.fullStage, bookStyle: style } as any); const lay = bookLayout(sc as any);
    const per = lay.starts.map((s, i) => (lay.starts[i + 1] ?? sc.book.length) - s);
    if (seed <= 3) console.log(style, 'seed', seed, 'pages', lay.pages, 'rows/page', per.join(''));
    if (style === 'race') per.slice(0, -1).forEach(p => { hist[p] = (hist[p] ?? 0) + 1; pagesTot++; });
  }
}
console.log('race-style rows-per-page histogram (excluding last page):', JSON.stringify(hist), 'pages', pagesTot);

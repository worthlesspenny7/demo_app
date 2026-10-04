import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { chartPairs } from '../src/core/drills/d06.js';
import { packardValue } from '../content/reference-data.js';
const d = drillById('D06')!; const hist: Record<number, number> = {}; const ex: string[] = [];
for (let s = 1; s <= 20; s++) { const sc = d.scenario(s, 0); const off = chartPairs(sc.tags).filter(p => packardValue(p.kind === 'accel' ? 'accel' : p.kind === 'turn' ? 'turn' : 'stopgo', p.vIn, p.vOut) === null); hist[off.length] = (hist[off.length] ?? 0) + 1; if (s <= 5) ex.push(`s${s}: ${off.map(p => `${p.kind} ${p.vIn}>${p.vOut}`).join(', ') || 'none'}`); }
console.log('D06 Bronze: pairs not on the printed Packard charts per seed (count -> seeds):', hist); console.log(ex.join(' | '));

import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
await registerAll();
const sc = generateStage(1, PROFILES.fullStage); console.log('stage preread', sc.prereadSeconds, 'hazards', sc.hazards.map(h => h.kind).join(','), 'asp', sc.asp);
for (const s of [1, 2, 3, 4]) { const d = drillById('D13')!.scenario(s, 0); const h: Record<string, number> = {}; for (const x of d.hazards) h[x.kind] = (h[x.kind] ?? 0) + 1; console.log('D13 seed', s, 'asp', d.asp, 'preread', d.prereadSeconds, 'rows', d.book.length, 'hazards', JSON.stringify(h)); }
const hz: Record<string, number> = {}; for (let s = 1; s <= 8; s++) for (const x of generateStage(s, PROFILES.fullStage).hazards) hz[x.kind] = (hz[x.kind] ?? 0) + 1; console.log('fullStage hazards over 8 seeds', JSON.stringify(hz));

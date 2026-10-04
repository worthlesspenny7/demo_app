import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/registry.js';
for (const d of allDrills()) console.log(d.id, d.kind, d.title, '| skills', d.skills.join(','), '| min', d.minutes, '| unlock', JSON.stringify(d.unlock), '| tiers', d.tiers.map(t => t.name).join('/'), '\n   OBJ:', d.objective);

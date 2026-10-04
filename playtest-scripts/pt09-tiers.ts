import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/registry.js';
for (const d of allDrills()) console.log(d.id, d.kind, d.tiers.map(t => `${t.name}/rung${t.aids.rung}/${t.driver.skill}`).join(' '));

import type { Drill } from './types.js';
const drills: Drill[] = [];
export function registerDrill(d: Drill): void { if (!drills.some(x => x.id === d.id)) drills.push(d); }
export function allDrills(): Drill[] { return [...drills].sort((a, b) => a.id.localeCompare(b.id)); }
export function drillById(id: string): Drill | undefined { return drills.find(d => d.id === id); }

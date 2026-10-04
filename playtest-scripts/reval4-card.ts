import { LESSONS } from '../content/lessons.js';
const p = LESSONS.find(l => l.id === 'protocol')!;
const card = p.body.find((b): b is { card: { title: string; lines: string[] } } => typeof b === 'object' && 'card' in b)!;
console.log(card.card.title, card.card.lines.length, 'lines; max words', Math.max(...card.card.lines.map(l => l.split(/\s+/).length)), 'over 25:', card.card.lines.filter(l => l.split(/\s+/).length >= 25).length);
const must = ['ICE', 'mark', 'holding', 'keep counting', 'Stopped', 'GO'];
for (const m of must) console.log(m, card.card.lines.some(l => l.toLowerCase().includes(m.toLowerCase())));

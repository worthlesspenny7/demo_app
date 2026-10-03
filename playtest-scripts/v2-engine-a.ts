/** V2 revalidation: oracle on generated day stage; dumps structural facts. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot, runBot } from '../src/agent/bots.js';
const seed = Number(process.argv[2] ?? 1);
const sc = generateStage(seed, PROFILES.fullStage);
console.log('scenario', sc.id, sc.name, 'asp', sc.asp, 'base', sc.baseStartTime, 'tz', sc.timeZone, 'style', sc.bookStyle, 'rows', sc.book.length, 'rules', JSON.stringify(sc.rules));
const t0 = Date.now();
const sim = new Simulator(sc, { watch: 'digital' });
const bot = makeBot('oracle', sim, seed);
const r = runBot(sim, bot);
console.log('ms', Date.now() - t0, 'phase', sim.phase);
console.log('score', JSON.stringify({ ...r.score, legs: undefined, penaltyItems: r.score.penaltyItems }));
console.log('legs', r.score.legs.length, 'ace', r.score.aces);
for (const l of r.score.legs) console.log(JSON.stringify({ i: l.index, cp: l.cpId, err: l.error, pen: l.penalty, cap: (l as any).capped, ta: (l as any).taReason, ace: l.ace }));
console.log('ta', JSON.stringify(r.ta));
console.log('instrumentDiscipline', JSON.stringify(r.instrumentDiscipline));
console.log('dnf', r.dnf, 'earlyDepMin', r.earlyDepartureMinutes);
console.log('events sample', JSON.stringify(r.events.slice(0, 5)));

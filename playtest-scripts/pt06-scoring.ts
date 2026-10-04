/** PT-06 area 6: scoring edges via scoreLeg/scoreStage/championshipTotal/ageFactor. */
import { scoreLeg, scoreStage, ageFactor, championshipTotal, compareStandings, rankStandings, type LegScore } from '../src/core/scoring.js';
import { DEFAULT_RULES } from '../src/core/course.js';
import type { Leg } from '../src/core/ghost.js';
const log = console.log;
const leg = (dur = 600, cum = 600): Leg => ({ index: 1, cpId: 'cp1', perfectTod: 0, perfectDuration: dur, cumulativePerfect: cum } as unknown as Leg);
const mk = (err: number, extra: Partial<Parameters<typeof scoreLeg>[0]> = {}) => scoreLeg({ leg: leg(), record: { cpId: 'cp1', kind: 'timing', actualTod: 1000 + 600 + err, rawTod: 1000 + 600 + err, sightViolation: false }, anchorActual: 1000, taDeclared: 0, taQualifying: 0, cumulativeAnchorActual: 1000, ...extra }, DEFAULT_RULES);
for (const e of [119, 120, 121, -299, -300, -301, 1799, 1800, 1801]) { const r = mk(e); log(`err ${e}: error ${r.error} penalty ${r.penalty} capped ${r.capped} missed ${r.extras.missed}`); }
// 30 min boundary measured from cumulativeAnchor (restart): cumulative perfect 600 + 1800
for (const e of [1799, 1800, 1801]) { const r = mk(e); log(`late ${e}: missed=${r.extras.missed} penalty=${r.penalty}`); }
log('ageFactor', [1800, 1899, 1900, 1901, 1929, 1930, 1931, 1939, 1939.9, 1952, 1953, 1954, 2026, NaN, Infinity, -Infinity].map(y => `${y}:${ageFactor(y)}`).join(' '));
// championship with fewer items than discards
const st = (stage: number, pens: number[]) => ({ stage, score: scoreStage(pens.map((p, i) => ({ ...mk(p), index: i + 1 } as LegScore)), 1939, DEFAULT_RULES, { observationMissed: false }) });
const c1 = championshipTotal([st(1, [5, 0, 10]), st(2, [3])], 'rookie', { year: 1939 }); log('rookie fewer legs than discards', JSON.stringify(c1));
const c2 = championshipTotal([st(1, [5, 0, 10]), st(1, [5, 0, 10])], 'grand'); log('duplicate stage 1 counted twice?', JSON.stringify({ raw: c2.raw, stagesCounted: c2.stagesCounted, discarded: c2.discarded }));
const c3 = championshipTotal([st(0, [100]), st(10, [100]), st(8, [50]), st(9, [1])], 'expert', { year: 1939 }); log('stage 0 / 10 / 8,9', JSON.stringify(c3));
const c4 = championshipTotal([], 'rookie'); log('empty', JSON.stringify(c4));
log('ties', rankStandings([{ name: 'a', total: 10, scoringYear: 1939 }, { name: 'b', total: 10, scoringYear: 1936, trophyRunPosition: 3 }, { name: 'c', total: 10, scoringYear: 1936, trophyRunPosition: 1 }, { name: 'd', total: 0.1 + 0.2, scoringYear: 1950 }, { name: 'e', total: 0.3, scoringYear: 1920 }]).map(s => s.name).join(','));
// dnf: final leg missed
const missed = scoreLeg({ leg: leg(), record: undefined, anchorActual: 1000, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
const s = scoreStage([mk(5), missed], 1939, DEFAULT_RULES, { observationMissed: true, observationNeverReached: false }); log('dnf', s.dnf, s.raw, s.observationPenalty, s.penaltyItems);
// score rounding to 0.01 s, benchmarkLabel
log('score rounding', scoreStage([mk(7)], 1939, DEFAULT_RULES, { observationMissed: false }).score);
// TA credit rules
for (const [d, q, rec, err] of [[40, 98.2, 60.4, 54], [40, 98.2, 0, 30], [100, 100, 0, 95], [100, 100, 0, 100], [100, 100, 0, -5], [10, 9.99, 0, 20], [10, 10, 0, 20], [30, 30, 0, 0.4]] as const) { const r = mk(err, { taDeclared: d, taQualifying: q, taRecoverable: rec }); log(`TA declared ${d} measured ${q} recoverable ${rec} rawErr ${err}: credit ${r.taCredit} error ${r.error} over ${r.taOverDeclared} | ${r.taReason}`); }

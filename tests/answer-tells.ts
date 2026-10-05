/** PLAY-045 (PT-11 N-D4): the answer-tell predictors a test-wise player uses without reading the scene: option length rank and punctuation. */
export interface Q { options: string[]; answer: number }
const len = (s: string): number => s.trim().length;
const punct = (s: string): boolean => /[;:](?!\d)/.test(s.replace(/\d+:\d+(:\d+)?/g, ''));   // a ';' or ':' that is not part of a clock time
/** Probability that `pick` lands on the answer, with ties shared (a predictor that cannot choose among k options gets 1/k for each). */
function byRank(q: Q, rank: number, longest: boolean): number {
  const ls = q.options.map(len); const sorted = [...new Set(ls)].sort((a, b) => (longest ? b - a : a - b)); const target = sorted[Math.min(rank, sorted.length - 1)]!;
  const tied = ls.map((l, i) => (l === target ? i : -1)).filter(i => i >= 0); return tied.includes(q.answer) ? 1 / tied.length : 0;
}
function uniquePunct(q: Q): number | null { const p = q.options.map(punct); const n = p.filter(Boolean).length; return n === 1 ? p.indexOf(true) : null; }
function uniqueEnd(q: Q): number | null { const e = q.options.map(o => /[.!?]$/.test(o.trim())); const n = e.filter(Boolean).length; return n === 1 ? e.indexOf(true) : n === q.options.length - 1 ? e.indexOf(false) : null; }
/** Every predictor's hit rate over the questions, and the chance rate (mean of 1 / options). */
export function tellReport(qs: Q[]): { chance: number; rates: Record<string, number> } {
  const chance = qs.reduce((a, q) => a + 1 / q.options.length, 0) / qs.length;
  const preds: Record<string, (q: Q) => number> = {
    longest: q => byRank(q, 0, true), secondLongest: q => byRank(q, 1, true), shortest: q => byRank(q, 0, false), secondShortest: q => byRank(q, 1, false),
    punctElseLongest: q => { const u = uniquePunct(q); return u !== null ? Number(u === q.answer) : byRank(q, 0, true); },
    punctElseSecondLongest: q => { const u = uniquePunct(q); return u !== null ? Number(u === q.answer) : byRank(q, 1, true); },
    punctElseShortest: q => { const u = uniquePunct(q); return u !== null ? Number(u === q.answer) : byRank(q, 0, false); },
    endElseLongest: q => { const u = uniqueEnd(q); return u !== null ? Number(u === q.answer) : byRank(q, 0, true); },
  };
  const rates: Record<string, number> = {}; for (const [k, f] of Object.entries(preds)) rates[k] = Math.round(qs.reduce((a, q) => a + f(q), 0) / qs.length * 1000) / 1000;
  return { chance: Math.round(chance * 1000) / 1000, rates };
}

/**
 * Fix sprint PT-14: the rule-card follower as a pure function of what the phone card shows (the prompt, Column C, the option labels, the
 * sign moment, the CAMEO arrow). It applies content/rules.ts and nothing else: a "Not quite" for it is a contradiction between the cards
 * and the grader. At rung 2 it reads only the card's own text (no chart chip, no "details"); `chart` lets a rung-1 caller pass the cell
 * behind the Chart button. The oracle is used only as the CAMEO arrow reader (turn / which-way cards), as in PT-14.
 */
import type { Decision, DecisionResponse } from '../src/core/decision/index.js';

const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
/** 12-hour h:mm:ss, as the card prints times. */
export const face = (t: number): string => { t = Math.round(t); t = ((t % 86400) + 86400) % 86400; const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
/** A printed 12-hour time ("CDT 9:31:50") as seconds of the day nearest to `near` (the card's own time of day). */
function todNear(s: string, near: number): number { let T = hms(s); while (T - near > 21600) T -= 43200; while (near - T > 21600) T += 43200; return T; }

export interface FollowOpts { react?: () => number; arrow?: string; chart?: number | null }

/** RULE-031 (PT-14 C-1): the causes it names and the ones it says are not. */
export function hazardPlan(scene: string): 'claim' | 'makeup' {
  const notCause = /slow truck .*can pass|turned red|red light|traffic you can get around/i.test(scene);
  const cause = /Gates down|train|accident scene|school bus|farm tractor|combine .*cannot pass|flagger holding traffic/i.test(scene);
  // RULE-032: claim only what you could not make up; a delay that clears at once (the last cars passing, a tractor turning off) leaves nothing
  const short = /last cars are passing|turning into a field gate/i.test(scene);
  return cause && !notCause && !short ? 'claim' : 'makeup';
}

export function follow(d: Decision, o: FollowOpts = {}): DecisionResponse {
  const react = o.react ?? (() => 0.25);
  const p = d.prompt; const opts = d.options ?? [];
  const byLabel = (re: RegExp): string => { const x = opts.find(z => re.test(z.label)); if (!x) throw new Error(`no option ${re} in ${opts.map(z => z.label)}`); return x.id; };
  const nearest = (val: (l: string) => number, want: number): string => opts.map(x => ({ x, v: val(x.label) })).filter(z => Number.isFinite(z.v)).sort((a, b) => Math.abs(a.v - want) - Math.abs(b.v - want))[0]!.x.id;
  const dl = d.deadlineSeconds !== undefined ? { tapSeconds: 2.5 } : {};
  switch (d.kind) {
    case 'clock':
      if (/read the minute/.test(p)) return { optionId: byLabel(/TOD/) };           // RULE-038
      if (/count the second in/.test(p)) return { optionId: byLabel(/second hand/) };   // RULE-038
      return { optionId: byLabel(/chrono/) };                                           // RULE-039
    case 'checkpoint': return { optionId: /red GREAT RACE STOP/.test(p) ? byLabel(/^Stop/) : byLabel(/Hold speed/) };   // RULE-003 / RULE-004
    case 'lost': {
      const ago = Number(/left the route (\d+) s ago/.exec(p)?.[1]); const det = /detour about (\d+) s longer/.exec(p);
      if (!det) return { optionId: byLabel(/Turn around/) };                          // RULE-034
      return { optionId: Number(det[1]) < 2 * ago + 20 ? byLabel(/rejoin ahead/) : byLabel(/Turn around/) };   // RULE-043
    }
    case 'hazard': return { optionId: hazardPlan(p) === 'claim' ? byLabel(/Make up what you can/) : byLabel(/Make it all up/) };
    case 'ta': {                                                                         // RULE-033: floor((delay - made up) / 10) x 10
      const M = iv(/delayed (\d+m\d\ds)/.exec(p)?.[1] ?? ''); const R = Number(/about (\d+) s of it could be made up/.exec(p)?.[1] ?? 0);
      const want = Math.floor((M - R) / 10) * 10;
      return { optionId: want === 0 ? byLabel(/No claim/) : opts.find(x => iv(x.label) === want)!.id };
    }
    case 'makeup': {                                                                     // RULE-025 / 026 / 005 / 027 / 029
      const m = /(\d+) s (late|early) at (\d+) mph/.exec(p)!; const S = Number(m[1]); const a = Number(m[3]); const late = m[2] === 'late';
      const lim = /posted limit (\d+)/.exec(p); const T = Number(/about (\d+) s of open road|starts in about (\d+) s/.exec(p)?.slice(1).find(Boolean));
      const limOk = (f: number): boolean => !lim || !late || a * f <= Number(lim[1]) + 1e-9;
      if (10 * S <= T && limOk(1.1)) return { optionId: byLabel(/10 %/) };
      if (5 * S <= T && limOk(1.2)) return { optionId: byLabel(/20 %/) };
      return { optionId: opts.find(x => /Cut the stop/.test(x.label))?.id ?? byLabel(/10 %/) };
    }
    case 'transitOut': {                                                                 // RULE-014: IN + interval
      const m = /IN [A-Z]{3} (\d+:\d\d:\d\d), take exactly (\d+m\d\ds)/.exec(p)!;
      return { optionId: byLabel(new RegExp(`^${face(hms(m[1]!) + iv(m[2]!))}$`)) };
    }
    case 'preread': {
      if (/Which way/.test(p)) return { optionId: o.arrow! };                           // RULE-041
      if (/What speed/.test(p)) { const v = /(\d+) MPH/.exec((d.context.row?.columnC ?? []).join(' '))![1]; return { optionId: byLabel(new RegExp(`^${v} mph`)) }; }   // RULE-042
      const pause = Number(/pause (\d+) s/.exec(p)![1]); const loss = Number(/loss ([\d.]+) s/.exec(p)?.[1] ?? o.chart ?? NaN);
      const want = Math.round((pause - loss) * 10) / 10;                                  // RULE-016
      return { optionId: nearest(l => (/Go at once/.test(l) ? 0 : Number(/Wait ([\d.]+)/.exec(l)?.[1])), want) };
    }
    case 'turn': return { optionId: o.arrow!, ...dl };                                   // RULE-041
    case 'watch': {                                                                      // RULE-021: lap + interval - lead
      const seg = iv(/for (\d+m\d\ds)/.exec(p)![1]!); const lap = iv(/lapped (\d+m\d\d\.\ds)/.exec(p)![1]!);
      const L = Number(/lead ([\d.]+) s/.exec(p)?.[1] ?? o.chart ?? 2);
      return { optionId: nearest(l => iv(l), lap + seg - L) };
    }
    case 'pause': {                                                                      // RULE-016 / RULE-017: sit the printed chart time, rounded
      const sit = Number(/sit ([\d.]+) s/.exec(p)?.[1] ?? o.chart);
      return { tapSeconds: Math.round(sit) + react() };
    }
    case 'restart': {                                                                    // RULE-010 / RULE-011
      const leave = /leave at [A-Z]{3} (\d+:\d\d:\d\d)/.exec(p);
      const tod0 = d.context.tod;
      if (leave) return { tapSeconds: Math.max(0, todNear(leave[1]!, tod0) - tod0) + react() };
      const own = /your time [A-Z]{3} (\d+:\d\d:\d\d)/.exec(p); const base = /base [A-Z]{3} (\d+:\d\d:\d\d), you start (\d+)/.exec(p);
      const loss = Number(/standing-start loss ([\d.]+) s/.exec(p)?.[1] ?? o.chart);
      const t = own ? todNear(own[1]!, tod0) : todNear(base![1]!, tod0) + 60 * Number(base![2]);
      // the player taps when the TOD digits (whole seconds) show the launch second
      return { tapSeconds: Math.max(0, t - Math.round(loss) - tod0) + react() };
    }
    case 'speedChange': {                                                                // RULE-020: call the lead before Dad's Mark!
      const L = Number(/ ([\d.]+) s before Dad's Mark/.exec(p)?.[1] ?? o.chart);
      return { tapSeconds: Math.max(0.2, (d.timing!.signSeconds ?? 0) - L) + react() };
    }
    case 'timedStart': {                                                                 // RULE-022 START on the Mark, RULE-021 CALL off the watch
      const seg = iv(/before the (\d+m\d\ds) ends/.exec(p)![1]!); const L = Number(/CALL \d+ ([\d.]+) s before/.exec(p)?.[1] ?? o.chart);
      const a = (d.timing!.signSeconds ?? 0) + react(); const b = a + seg - L + react();
      return { taps: [a, b] };
    }
  }
  throw new Error(`no follower for ${d.kind}`);
}

/** A seeded human reaction of 0.15-0.35 s. */
export function reactions(seed: number): () => number { let s = seed % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return 0.15 + ((s - 1) / 2147483646) * 0.2; }; }

/**
 * PT-15: the player brains. The rule-card follower is the current one (tests/pt14-follower.ts `follow`, a pure function of what the phone
 * card shows: prompt, Column C, the option labels, the sign moment, the TOD digits, the CAMEO arrow; at rung 1 the cell behind "Chart").
 * PT-15 adds two independent readings of RULE-031 for the hazard card, to check the follower is not tuned to the grader:
 *   - `hazardStrict`: claim only for a cause RULE-031 names AND only when the scene says it will hold you (cannot pass / long / holding);
 *   - `hazardLiteral`: claim for any cause RULE-031 names, whatever the scene says about how long (a careless reader of the card).
 * And a naive rookie (skims the rule cards) for contrast. The oracle is used only as the CAMEO arrow reader (turn / which-way cards).
 */
import type { Decision, DecisionResponse } from '../src/core/decision/index.js';
import { follow as follow14, hazardPlan, reactions, face } from '../tests/pt14-follower.js';

export { hazardPlan, reactions, face };
export interface Opts { react?: () => number; arrow?: string; chart?: number | null }
const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
function todNear(s: string, near: number): number { let T = hms(s); while (T - near > 21600) T -= 43200; while (near - T > 21600) T += 43200; return T; }

export function follow(d: Decision, o: Opts = {}): DecisionResponse { return follow14(d, o); }

/** My own reading of RULE-031 / RULE-032 from the scene, written without looking at the grader. */
export function hazardMine(scene: string): 'claim' | 'makeup' | 'either' {
  if (/red|slow truck|you can pass/i.test(scene) && !/cannot pass/i.test(scene)) return 'makeup';          // "are not" sentence
  const named = /train|freight|Gates down|accident|school bus|farm tractor|combine|flagger|Road work/i.test(scene);
  if (!named) return 'makeup';
  if (/last cars are passing|turning into a field gate/i.test(scene)) return 'either';                       // RULE-032: little or nothing to claim
  return 'claim';
}

export function naive(d: Decision, o: Opts = {}): DecisionResponse {
  const react = o.react ?? (() => 0.25); const p = d.prompt; const opts = d.options ?? [];
  const by = (re: RegExp): string | undefined => opts.find(x => re.test(x.label))?.id;
  switch (d.kind) {
    case 'clock': return { optionId: by(/Clock minute hand/) ?? opts[0]!.id };
    case 'checkpoint': return { optionId: by(/Stop and check in|^Stop/) ?? opts[0]!.id };
    case 'lost': return { optionId: by(/claim a TA/i) ?? opts[0]!.id };
    case 'hazard': return { optionId: by(/Claim the whole/) ?? opts[0]!.id };
    case 'ta': { const best = opts.map(x => ({ x, v: iv(x.label) || 0 })).sort((a, b) => b.v - a.v)[0]!; return { optionId: best.x.id }; }
    case 'makeup': return { optionId: by(/20 %/) ?? opts[0]!.id };
    case 'pause': { const pz = Number(/Pause (\d+) s/i.exec(p)?.[1] ?? 15); return { tapSeconds: pz + react() }; }
    case 'restart': {
      const t = /your time [A-Z]{3} (\d+:\d\d:\d\d)|leave at [A-Z]{3} (\d+:\d\d:\d\d)|base [A-Z]{3} (\d+:\d\d:\d\d)|OUT [A-Z]{3} (\d+:\d\d:\d\d)/.exec(p);
      const s = t?.slice(1).find(Boolean); if (!s) return follow(d, o);
      return { tapSeconds: Math.max(0, todNear(s, d.context.tod) - d.context.tod) + react() };
    }
    case 'speedChange': return { tapSeconds: (d.timing?.signSeconds ?? 4) + react() };
    case 'timedStart': { const seg = iv(/before the (\d+m\d\ds) ends/.exec(p)?.[1] ?? ''); const a = (d.timing?.signSeconds ?? 2) + react(); return { taps: [a, a + seg + react()] }; }
    case 'watch': {
      const seg = iv(/for (\d+m\d\ds)/.exec(p)?.[1] ?? ''); const lap = iv(/lapped (\d+m\d\d\.\ds)/.exec(p)?.[1] ?? '');
      return { optionId: opts.map(x => ({ x, v: iv(x.label) })).sort((a, b) => Math.abs(a.v - (lap + seg)) - Math.abs(b.v - (lap + seg)))[0]!.x.id };
    }
    case 'preread': if (/How long/.test(p)) { const pz = Number(/pause (\d+) s/.exec(p)?.[1]); return { optionId: by(new RegExp(`^Wait ${pz} s`)) ?? opts[0]!.id }; } return follow(d, o);
    default: return follow(d, o);
  }
}

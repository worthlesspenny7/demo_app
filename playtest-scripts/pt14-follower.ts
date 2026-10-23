/**
 * PT-14: the rule-card follower and the naive rookie, as pure functions of what the phone screen shows (the prompt, Column C, the chart
 * cell under "details" / the Chart button, the sign bar, the watch card, the option labels). The same brain is used headless (from a
 * Decision, pt14-10-follower-audit.ts) and in the browser (from the DOM, pt14-player.ts), so a "wrong" verdict for the follower is a
 * contradiction between the rule cards (content/rules.ts) and the grader. The oracle is never consulted, except as the arrow reader on
 * turn / "which way" cards (the bold CAMEO arrow is on screen; reading it is RULE-041).
 */
export interface Screen {
  kind: string; prompt: string; rowC: string; options: { id: string; label: string }[];
  chart: number | null;            // the chart cell's seconds (sit / loss / lead), null when not on screen or behind nothing
  sign: number | null;             // seconds from the card to the sign (the bar reaches 0, Dad says Mark!)
  lapCum: number | null;           // watch card: the lap at the sign (cumulative)
  arrow?: string;                  // turn / which-way: the direction the bold arrow takes (the arrow reader)
}
export type Action = { optionId: string; why: string } | { tap: number; why: string } | { taps: [number, number]; why: string } | { tod: string; react: number; why: string };

const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
export const fmtTod = (t: number): string => { t = Math.round(t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; const hh = h % 12 === 0 ? 12 : h % 12; return `${hh}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const opt = (o: Screen['options'], re: RegExp): string | undefined => o.find(x => re.test(x.label))?.id;
const nearest = (o: Screen['options'], val: (l: string) => number, want: number): string | undefined =>
  o.map(x => ({ x, v: val(x.label) })).filter(z => Number.isFinite(z.v)).sort((a, b) => Math.abs(a.v - want) - Math.abs(b.v - want))[0]?.x.id;

export type Hazard = 'strict' | 'broad';
/**
 * The rule-card follower. `react()` returns a human reaction time (s). `hazard`: 'strict' claims only for what RULE-031 names (a train,
 * an accident); 'broad' reads "a delay beyond your control" as any vehicle or works that block you (truck, tractor, combine, bus, road work).
 */
export function follow(s: Screen, react: () => number, hazard: Hazard = 'strict'): Action {
  const p = s.prompt; const o = s.options;
  switch (s.kind) {
    case 'clock':
      if (/read the minute/.test(p)) return { optionId: opt(o, /TOD/)!, why: 'RULE-038 hour and minute from the watch in TOD mode' };
      if (/count the second in/.test(p)) return { optionId: opt(o, /second hand/)!, why: 'RULE-038 the clock only for its second hand, counting the second in' };
      return { optionId: opt(o, /chrono/)!, why: 'RULE-039 the stopwatch measures how long' };
    case 'checkpoint':
      if (/red GREAT RACE STOP/.test(p)) return { optionId: opt(o, /Stop/)!, why: 'RULE-003 red board: stop and talk to the worker' };
      return { optionId: opt(o, /Hold speed/)!, why: 'RULE-003 / RULE-004 green: do nothing, never crawl' };
    case 'lost': {
      const ago = Number(/left the route (\d+) s ago/.exec(p)?.[1]); const det = /detour about (\d+) s longer/.exec(p);
      if (!det) return { optionId: opt(o, /Turn around/)!, why: 'RULE-034 dead end: turn around and time it' };
      const back = 2 * ago + 20; const d = Number(det[1]);
      return d < back ? { optionId: opt(o, /rejoin ahead/)!, why: `RULE-043 detour ${d} < back 2x${ago}+20=${back}` } : { optionId: opt(o, /Turn around/)!, why: `RULE-043 back ${back} <= detour ${d}` };
    }
    case 'hazard': {
      const light = /signal .* turned red/i.test(p);
      const named = /Gates down|accident/i.test(p);
      const blocker = /truck|tractor|combine|school bus|Road work/i.test(p);
      const short = /last cars are passing|blinker on for a field gate/i.test(p);
      if (light) return { optionId: opt(o, /Make it all up/)!, why: 'RULE-031 a traffic light is not named: make it up' };
      const qual = named || (hazard === 'broad' && blocker);
      if (qual && !short) return { optionId: opt(o, /Make up what you can/)!, why: `RULE-031/032/033 beyond control (${hazard}), long: make up what you can, claim the rest` };
      return { optionId: opt(o, /Make it all up/)!, why: qual ? 'RULE-032 short: nothing you cannot make up' : `RULE-031 not a named cause (${hazard}): make it up` };
    }
    case 'ta': {
      const M = iv(/delayed (\d+m\d\ds)/.exec(p)?.[1] ?? ''); const R = Number(/about (\d+) s of it could be made up/.exec(p)?.[1] ?? 0);
      const want = Math.floor((M - R) / 10) * 10;
      const id = want === 0 ? opt(o, /No claim/) : o.find(x => iv(x.label) === want)?.id;
      return { optionId: id ?? nearest(o, l => (/No claim/.test(l) ? 0 : iv(l)), want)!, why: `RULE-033 floor((${M} - ${R}) / 10) x 10 = ${want}` };
    }
    case 'makeup': {
      const m = /(\d+) s (late|early) at (\d+) mph/.exec(p); const S = Number(m?.[1]); const a = Number(m?.[3]); const late = m?.[2] === 'late';
      const lim = /posted limit (\d+)/.exec(p); const T = Number(/about (\d+) s of open road|starts in about (\d+) s/.exec(p)?.slice(1).find(Boolean));
      const limOk = (f: number): boolean => !lim || !late || a * f <= Number(lim[1]) + 1e-9;
      if (10 * S <= T && limOk(1.1)) return { optionId: opt(o, /10 %/)!, why: `RULE-025 10 x ${S} = ${10 * S} s fits in ${T} s` };
      if (5 * S <= T && limOk(1.2)) return { optionId: opt(o, /20 %/)!, why: `RULE-026 10 x S does not fit, 5 x ${S} = ${5 * S} s fits in ${T} s` };
      const stop = opt(o, /Cut the stop/); if (stop) return { optionId: stop, why: 'RULE-029 neither rate fits: shorten the stop' };
      return { optionId: opt(o, /10 %/)!, why: 'nothing fits: 10 %' };
    }
    case 'transitOut': {
      const m = /IN (\d+:\d\d:\d\d), take exactly (\d+m\d\ds)/.exec(p); const want = m ? fmtTod(hms(m[1]!) + iv(m[2]!)) : '';
      return { optionId: o.find(x => x.label === want)?.id ?? o[0]!.id, why: `RULE-014 IN + interval = ${want}` };
    }
    case 'preread': {
      if (/Which way/.test(p)) return { optionId: s.arrow ?? o[0]!.id, why: 'RULE-041 the bold arrow' };
      if (/What speed/.test(p)) { const v = /(\d+) MPH/.exec(s.rowC)?.[1]; return { optionId: opt(o, new RegExp(`^${v} mph`)) ?? o[0]!.id, why: `RULE-042 Column C says ${v} MPH` }; }
      const pause = Number(/pause (\d+) s/.exec(p)?.[1]);
      if (s.chart !== null) { const want = Math.round((pause - s.chart) * 10) / 10; return { optionId: nearest(o, l => (/Go at once/.test(l) ? 0 : Number(/Wait ([\d.]+)/.exec(l)?.[1])), want)!, why: `RULE-016 ${pause} - loss ${s.chart} = ${want}` }; }
      return { optionId: o.find(x => !new RegExp(`Wait ${pause} s|Go at once`).test(x.label))?.id ?? o[0]!.id, why: 'RULE-016 not the printed pause (no chart)' };
    }
    case 'turn': return { optionId: s.arrow ?? o[0]!.id, why: 'RULE-041 the bold arrow' };
    case 'watch': {
      const seg = iv(/for (\d+m\d\ds)/.exec(p)?.[1] ?? ''); const L = s.chart ?? 2; const want = (s.lapCum ?? 0) + seg - L;
      return { optionId: nearest(o, l => iv(l), want)!, why: `RULE-021 lap ${s.lapCum} + ${seg} - lead ${L}${s.chart === null ? ' (no chart: RULE-020 about 2 s)' : ''} = ${want.toFixed(1)}` };
    }
    case 'pause': {
      const sit = /sit ([\d.]+) s/.exec(p)?.[1]; const v = sit !== undefined ? Number(sit) : s.chart;
      if (v === null || v === undefined) { const pz = Number(/Pause (\d+) s/.exec(p)?.[1] ?? 15); return { tap: pz + react(), why: 'no chart on screen: printed pause' }; }
      return { tap: Math.round(v) + react(), why: `RULE-017 round ${v} -> ${Math.round(v)}, GO` };
    }
    case 'restart': {
      const leave = /leave at (\d+:\d\d:\d\d)/.exec(p);
      if (leave) return { tod: leave[1]!, react: react(), why: 'lunch: leave on the printed time' };
      const own = /your time (\d+:\d\d:\d\d)/.exec(p); const base = /base (\d+:\d\d:\d\d), you start (\d+)/.exec(p);
      const loss = Number(/standing-start loss ([\d.]+) s/.exec(p)?.[1] ?? s.chart ?? NaN);
      const t = own ? hms(own[1]!) : hms(base![1]!) + 60 * Number(base![2]);
      const L = Number.isFinite(loss) ? Math.round(loss) : 3;
      return { tod: fmtTod(t - L), react: react(), why: `${base ? `RULE-010 base + ${base[2]} min = ${fmtTod(t)}; ` : ''}RULE-011 minus loss ${Number.isFinite(loss) ? loss : '? (3)'} -> ${fmtTod(t - L)}` };
    }
    case 'speedChange': {
      const L = Number(/ ([\d.]+) s before Dad's Mark/.exec(p)?.[1] ?? s.chart ?? 2.3);
      return { tap: Math.max(0.2, (s.sign ?? 0) - L) + react(), why: `bar at the call tick: sign ${s.sign} - lead ${L}` };
    }
    case 'timedStart': {
      const seg = iv(/before the (\d+m\d\ds) ends/.exec(p)?.[1] ?? ''); const L = Number(/CALL \d+ ([\d.]+) s before/.exec(p)?.[1] ?? s.chart ?? 2);
      const a = (s.sign ?? 0) + react(); const b = a + seg - L + react();
      return { taps: [a, b], why: `START on Mark! (+react), CALL when the watch reads ${seg} - ${L}` };
    }
  }
  return { optionId: o[0]!.id, why: 'unknown kind' };
}

/** The naive rookie (skims rule cards): does what the words suggest. */
export function naive(s: Screen, react: () => number): Action {
  const p = s.prompt; const o = s.options;
  switch (s.kind) {
    case 'clock': return { optionId: opt(o, /Clock minute hand/)!, why: 'the clock is right there' };
    case 'checkpoint': return { optionId: opt(o, /Stop and check in/)!, why: 'a checkpoint is where you check in' };
    case 'lost': return { optionId: opt(o, /claim a TA/)!, why: 'not my fault' };
    case 'hazard': return { optionId: opt(o, /Claim the whole/)!, why: 'not my fault, claim it' };
    case 'ta': { const best = o.map(x => ({ x, v: iv(x.label) || 0 })).sort((a, b) => b.v - a.v)[0]!; return { optionId: best.x.id, why: 'claim the most' }; }
    case 'makeup': return { optionId: opt(o, /20 %/)!, why: 'fastest way back' };
    case 'pause': { const sit = /sit ([\d.]+) s/.exec(p)?.[1]; return { tap: (sit ? Number(sit) : Number(/Pause (\d+) s/.exec(p)?.[1] ?? 15)) + react(), why: 'GO at the printed number' }; }
    case 'restart': { const own = /your time (\d+:\d\d:\d\d)|leave at (\d+:\d\d:\d\d)|base (\d+:\d\d:\d\d)/.exec(p); return { tod: (own?.[1] ?? own?.[2] ?? own?.[3])!, react: react(), why: 'tap on the time printed' }; }
    case 'speedChange': return { tap: (s.sign ?? 4) + react(), why: 'CALL on Mark!' };
    case 'timedStart': { const seg = iv(/before the (\d+m\d\ds) ends/.exec(p)?.[1] ?? ''); const a = (s.sign ?? 2) + react(); return { taps: [a, a + seg + react()], why: 'START on Mark!, CALL when the interval is up' }; }
    case 'watch': { const seg = iv(/for (\d+m\d\ds)/.exec(p)?.[1] ?? ''); const want = (s.lapCum ?? 0) + seg; return { optionId: nearest(o, l => iv(l), want)!, why: 'lap + interval' }; }
    case 'preread': {
      if (/How long/.test(p)) { const pz = Number(/pause (\d+) s/.exec(p)?.[1]); return { optionId: opt(o, new RegExp(`^Wait ${pz} s`)) ?? o[0]!.id, why: 'the book says pause' }; }
      return follow(s, react);
    }
    default: return follow(s, react);
  }
}

/** PT-14 guessable-card audit (no browser): 40 seeds per kind (variant = seed % 4, as the Scheduler draws them), each card answered by a
 *  fixed "guess" that needs no skill; counts how often the grader accepts it. Also the variety of the numbers on restart / transit cards. */
import { buildMicro, microRunner, type MicroSpec, type Decision } from '../src/core/decision/index.js';
const SK: Record<string, string> = { clock: 'instruments', watch: 'instruments', checkpoint: 'safetyCourse', preread: 'safetyCourse', lost: 'recovery', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', transitOut: 'startOnTime', restart: 'startOnTime' };
const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
function card(kind: string, seed: number, variant = seed % 4) { const r = microRunner(buildMicro({ kind, skill: SK[kind], seed: seed * 104729 + 17, variant } as MicroSpec, 2), 2); const d = r.next(); return d && d.kind === kind ? { r, d } : null; }
type G = (d: Decision) => string | undefined;
const byLabel = (re: RegExp): G => d => d.options?.find(o => re.test(o.label))?.id;
const middleBy = (val: (l: string) => number): G => d => { const s = [...(d.options ?? [])].map(o => ({ o, v: val(o.label) })).sort((a, b) => a.v - b.v); return s[Math.floor((s.length - 1) / 2)]?.o.id; };
const secondSmallest = (val: (l: string) => number): G => d => [...(d.options ?? [])].map(o => ({ o, v: val(o.label) })).sort((a, b) => a.v - b.v)[1]?.o.id;
function audit(kind: string, guesses: Record<string, G>, variants?: number[]) {
  const res: Record<string, string> = {}; let n = 0; const cnt: Record<string, number> = {}; const extra: Record<string, number> = {};
  for (let s = 1; s <= 40; s++) {
    const v = variants ? variants[s % variants.length]! : s % 4; const c = card(kind, s, v); if (!c) continue; n++;
    const key = kind === 'clock' ? (/count the second/.test(c.d.prompt) ? 'q:second' : /minute/.test(c.d.prompt) ? 'q:minute' : 'q:interval') : kind === 'checkpoint' ? (/red/.test(c.d.prompt) ? 'red' : /pulls off/.test(c.d.prompt) ? 'carAhead' : 'green') : kind === 'lost' ? (/does not meet/.test(c.d.prompt) ? 'deadEnd' : 'rejoins') : kind === 'hazard' ? (c.d.context.hazard?.label ?? '?') : kind === 'preread' ? (/Which way/.test(c.d.prompt) ? 'which' : /What speed/.test(c.d.prompt) ? 'speed' : 'pause') : 'all';
    extra[key] = (extra[key] ?? 0) + 1;
    for (const [name, g] of Object.entries(guesses)) {
      const c2 = card(kind, s, v)!; const id = g(c2.d); if (id === undefined) continue;
      const ok = c2.r.answer(c2.d, { optionId: id }).correct; cnt[name] = (cnt[name] ?? 0) + (ok ? 1 : 0); cnt[`${name}|n`] = (cnt[`${name}|n`] ?? 0) + 1;
    }
  }
  for (const name of Object.keys(guesses)) res[name] = `${cnt[name] ?? 0}/${cnt[`${name}|n`] ?? 0}`;
  return { n, mix: extra, guesses: res };
}
const out: Record<string, unknown> = {};
out.clock = audit('clock', { 'always Watch TOD': byLabel(/TOD/), 'always Clock second hand': byLabel(/second hand/), 'always Watch chrono': byLabel(/chrono/) });
out.checkpoint = audit('checkpoint', { 'always Hold speed': byLabel(/Hold speed/), 'always Stop': byLabel(/Stop/) });
out.lost = audit('lost', { 'always Turn around': byLabel(/Turn around/), 'always Keep going, rejoin': byLabel(/rejoin ahead/) });
out.makeup = audit('makeup', { 'always +10 %': byLabel(/10 %/), 'always +20 %': byLabel(/20 %/) });
out.hazard = audit('hazard', { 'always Make it all up': byLabel(/Make it all up/), 'always Make up what you can, claim the rest': byLabel(/Make up what you can/), 'always Claim the whole': byLabel(/Claim the whole/) });
out.preread = audit('preread', { 'pause: the middle wait': d => (/How long/.test(d.prompt) ? middleBy(l => (/Go at once/.test(l) ? 0 : Number(/Wait ([\d.]+)/.exec(l)?.[1])))(d) : undefined), 'speed: never the current speed, highest': d => !/What speed/.test(d.prompt) ? undefined : [...(d.options ?? [])].filter(o => Number(o.label.split(' ')[0]) !== d.context.speeds?.current).sort((a, b) => Number(b.label.split(' ')[0]) - Number(a.label.split(' ')[0]))[0]?.id }, [1, 2]);
out.transitOut = audit('transitOut', { 'the middle time': middleBy(l => hms(l)) });
out.ta = audit('ta', { 'second-smallest claim': secondSmallest(l => (/No claim/.test(l) ? 0 : iv(l))), 'always No claim': byLabel(/No claim/) });
out.watch = audit('watch', { 'second-smallest reading': secondSmallest(l => iv(l)) });
// variety of the numbers
const ins = new Set<string>(); const ivs = new Set<string>(); const restarts: string[] = []; const losses = new Set<string>(); const shapes: Record<string, number> = {};
for (let s = 1; s <= 40; s++) {
  const t = card('transitOut', s); if (t) { const m = /IN (\d+:\d\d:\d\d), take exactly (\d+m\d\ds)/.exec(t.d.prompt); if (m) { ins.add(m[1]!); ivs.add(m[2]!); } }
  const r = card('restart', s); if (r) { const p = r.d.prompt; restarts.push(p); const l = /loss ([\d.]+) s/.exec(p)?.[1]; if (l) losses.add(l); const sh = /Lunch/.test(p) ? 'lunch' : /base/.test(p) ? 'base + position' : /Transit OUT/.test(p) ? 'transit OUT' : 'your time'; shapes[sh] = (shapes[sh] ?? 0) + 1; }
}
out.variety = { transitDistinctIn: ins.size, transitDistinctIntervals: [...ivs], restartShapes: shapes, restartDistinctLosses: [...losses].sort(), restartSamples: restarts.slice(0, 8) };
console.log(JSON.stringify(out, null, 1));
const fs = await import('node:fs'); fs.writeFileSync('/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt14/s12-guess-audit.json', JSON.stringify(out, null, 1));

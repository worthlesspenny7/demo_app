/** RE-VALIDATION v3: does D15 (gate for D12 at >= 1 star) still pass on a token annotation? */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { idealNotes } from '../src/core/drills/d15.js';
const d = drillById('D15')!;
const modes: Record<string, (sc: ReturnType<typeof d.scenario>) => { n: number; text: string }[]> = {
  'one junk note "x"': () => [{ n: 1, text: 'x' }],
  'only speeds and carries (no pauses, restart)': sc => idealNotes(sc).map(x => ({ n: x.n, text: x.text.split(';').filter(t => /mph/.test(t) || /COMES/.test(t)).join(';') })).filter(x => x.text),
  'only pause times': sc => idealNotes(sc).map(x => ({ n: x.n, text: x.text.split(';').filter(t => /pause/.test(t)).join(';') })).filter(x => x.text),
  'everything but the restart': sc => idealNotes(sc).map(x => ({ n: x.n, text: x.text.split(';').filter(t => !/restart/.test(t)).join(';') })).filter(x => x.text),
};
for (const t of [0, 1, 2]) for (const [name, f] of Object.entries(modes)) {
  const stars: number[] = [];
  for (const s of [1, 2, 3, 4, 5]) { const sc = d.scenario(s, t); const sim = new Simulator(sc, { watch: 'digital' }); const inner = new OracleBot(sim, { useWatch: true }); let done = false;
    const bot: Bot = { name: 'p', onTick(ss) { if (!done) { done = true; for (const x of f(sc)) ss.act({ type: 'line.annotate', n: x.n, text: x.text } as Action); } inner.onTick(ss); } };
    const r = runBot(sim, bot); stars.push(d.rubric(r, sc).stars); }
  console.log(`D15 t${t} ${name.padEnd(46)} stars ${stars.join('/')}`);
}

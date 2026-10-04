/** PT-09: D17 brute-force probe: one 'elapsed m:ss' note for every 2 s of a plausible range at the moment after the reset (no knowledge of the true elapsed time). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const d = drillById('D17')!; const out: string[] = [];
for (const tier of [0, 1, 2]) for (const seed of [1, 2, 3]) {
  const sc = d.scenario(seed, tier); let done = false; const s = new Simulator(sc, { watch: 'digital' }); const o = new OracleBot(s, { useWatch: true });
  const r = runBot(s, { name: 'spray', onTick(ss) { if (!done && ss.events.some(e => e.type === 'watchLost')) { done = true; ss.act({ type: 'watch.start' }); for (let e = 0; e <= 2400; e += 2) ss.act({ type: 'note', text: `elapsed ${Math.floor(e / 60)}:${String(e % 60).padStart(2, '0')}` } as Action); } o.onTick(ss); } });
  out.push(`D17 ${['B', 'S', 'G'][tier]} seed ${seed}: 1201 guessed notes -> ${d.rubric(r, sc).stars} stars (actions kept ${r.actions.length})`);
}
console.log(out.join('\n'));

import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { idealNotes } from '../src/core/drills/d15.js';
import { Simulator } from '../src/core/sim.js';
const d = drillById('D15')!;
for (const tier of [0, 1, 2]) for (const seed of [1, 2]) {
  const sc = d.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' });
  const notes = idealNotes(sc); for (const nt of notes) sim.act({ type: 'line.annotate', n: nt.n, text: nt.text } as any);
  const r = sim.result(); const ru = d.rubric(r, sc);
  const empty = new Simulator(sc, { watch: 'digital' }).result(); const ru0 = d.rubric(empty, sc);
  console.log(`D15 tier ${tier} seed ${seed}: ideal notes ${notes.length} -> ${ru.stars} stars (${ru.headline}); none -> ${ru0.stars}`);
  if (tier === 0 && seed === 1) console.log('  sample notes:', notes.slice(0, 8).map(x => `#${x.n} "${x.text}"`).join('  '));
}

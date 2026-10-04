/** V4 realism: bot ladder on generated full stages (seeds 1-4) at default settings. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { makeBot, runBot, type BotName } from '../src/agent/bots.js';
const bots: BotName[] = ['oracle', 'noPause', 'rookie', 'lateCall', 'goCount', 'wrongMinute'];
for (const seed of [1, 2, 3, 4]) {
  const row: string[] = [];
  for (const b of bots) {
    const sc = generateStage(seed, { ...PROFILES.fullStage, asp: 37 } as any);
    const sim = new Simulator(sc, { watch: 'digital' });
    const r = runBot(sim, makeBot(b, sim, seed), 14 * 3600);
    const legs = r.score.legs.map(l => Math.round(l.error));
    row.push(`${b}: raw ${r.score.raw} legs[${legs.join(',')}] dnf ${r.dnf} findings ${r.findings.map(f => f.kind).join('|') || '-'} instr ${r.instrumentDiscipline.length}`);
  }
  console.log('seed', seed, '\n  ' + row.join('\n  '));
}

import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { instructionS } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
for (let seed = 1; seed <= 12; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage); const sim = new Simulator(sc);
  const g = (sim as any).ghost; // ghost time at s
  const { ghostTimeAt } = await import('../src/core/ghost.js');
  const t = (s: number) => ghostTimeAt(g, s);
  const cps = sc.checkpoints.filter(c => c.kind === 'timing').map(c => c.s);
  const endT = sc.book.filter(b => b.endTimed).map(b => instructionS(sc.course, b));
  const firstRestart = sc.book.find(b => b.restartTime !== undefined && b.n > 1);
  const rs = instructionS(sc.course, firstRestart!);
  const lastCp = Math.max(...cps); const nextEnd = endT.filter(e => e > lastCp)[0]!;
  // morning CPs: before the lunch promoted stop
  const lunch = sc.book.find(b => b.promotedStop)!; const ls = instructionS(sc.course, lunch);
  const morning = cps.filter(c => c < ls).length;
  const legMin = cps.map((c, i) => ((t(c) - t(i === 0 ? rs : cps[i - 1]!)) / 60).toFixed(0));
  console.log(`seed ${seed}: timing CPs ${cps.length}, morning ${morning}, last CP to End timed ${(t(nextEnd) - t(lastCp)).toFixed(0)} s ghost (${(t(nextEnd) - t(lastCp) <= 450) ? 'within 7m30s' : 'LATER than 7m30s'}), first CP ${((t(cps[0]!) - t(rs)) / 60).toFixed(0)} min after first restart; legs(min) ${legMin.join(',')}`);
}

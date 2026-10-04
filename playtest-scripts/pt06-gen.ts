/** PT-06 area 7: 50 seeds of the 'day' skeleton: validateScenario clean, oracle finishes, timed segments, pauses vs Column C, speeds, CP counts, TA points. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { validateScenario, instructionS, nodeById } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { columnCLines } from '../src/core/griid.js';

const problems: string[] = [];
const sum: string[] = [];
for (let seed = 1; seed <= 50; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  const v = validateScenario(sc); if (v.length) problems.push(`seed ${seed}: validate: ${v.join('; ')}`);
  const timing = sc.checkpoints.filter(c => c.kind === 'timing');
  if (timing.length < 4 || timing.length > 6) problems.push(`seed ${seed}: ${timing.length} timing CPs (want 4-6)`);
  // speeds
  for (const i of sc.book) { for (const sp of [i.speed, i.timed?.holdSpeed, i.timed?.thenSpeed]) if (sp !== undefined && (sp < 10 || sp > 55)) problems.push(`seed ${seed}: line ${i.n} speed ${sp} outside 10-55`); }
  // timed segments past next node
  sc.book.forEach((ins, i) => {
    if (!ins.timed) return;
    const s0 = instructionS(sc.course, ins); const reach = s0 + ins.timed.holdSpeed * 1.4666667 * ins.timed.seconds;
    const next = sc.book[i + 1]; if (next && instructionS(sc.course, next) < reach - 1e-6 && (next.speed !== undefined || next.pause !== undefined || next.turn !== undefined || next.timed)) problems.push(`seed ${seed}: timed @${ins.n} reaches past line ${next.n}`);
    const nextNode = sc.course.nodes.find(n => n.s > s0 + 1);
    if (nextNode && nextNode.s < reach) {/* intermediate non-instruction nodes are ok */}
  });
  // TA points after each endTimed
  sc.book.forEach((ins, i) => { if (ins.endTimed) { const nxt = sc.book[i + 1]; if (!nxt?.taPoint && !ins.taPoint) problems.push(`seed ${seed}: endTimed @${ins.n} not followed by TA point`); } });
  const ends = sc.book.filter(i => i.endTimed).length, tas = sc.book.filter(i => i.taPoint).length;
  if (tas < ends) problems.push(`seed ${seed}: ${ends} endTimed vs ${tas} taPoints`);
  // pauses printed only where Column C says: sim stops at STOP nodes; pause ghost is ins.pause. check pause only on STOP/SIGNAL/RR nodes and columnC shows it
  for (const ins of sc.book) if (ins.pause) { const n = nodeById(sc.course, ins.nodeId); if (n.control === 'none') problems.push(`seed ${seed}: pause at line ${ins.n} on control none`); const c = columnCLines(ins, sc.timeZone).join('|'); if (!/pause|0m15|Pause/i.test(c) && !c) problems.push(`seed ${seed}: pause line ${ins.n} not in column C: ${c}`); }
  // oracle
  const sim = new Simulator(sc, { watch: 'digital' });
  const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
  const bad = res.score.legs.filter(l => l.extras.missed).length;
  sum.push(`seed ${seed} raw ${res.score.raw} legs ${res.score.legs.length} missed ${bad} dnf ${res.dnf} phase ${sim.phase} off ${res.offCourseCount} disc ${res.instrumentDiscipline.length} findings ${res.findings.map(f => f.kind).join(',')}`);
  if (sim.phase !== 'finished' || res.dnf || bad) problems.push(`seed ${seed}: oracle did not finish cleanly raw ${res.score.raw} dnf ${res.dnf} missed ${bad}`);
}
console.log(sum.join('\n')); console.log('PROBLEMS', problems.length); console.log(problems.join('\n'));

/**
 * PT-09 area 6: generator sweep. 50 'day' seeds (fullStage), 50 fullLeg seeds, 50 builtin 'varied' seeds, plus a few other profiles.
 * Checks: validateScenario + checkRouteExits, oracle finishes (no DNF, no missed CP), speeds 10-55, 4-6 timing CPs (day), pauses only where printed
 * (Column C vs ins.pause, no pause on a control-less node), no timing CP within 120 s of a transit end / restart, TA point after every End timed portion,
 * calibration points 3-12, and LOW 14: unprinted control nodes / slow zones inside stopwatch-timed intervals (frequency).
 */
import { generateStage, generateLeg, PROFILES, checkRouteExits } from '../src/core/generator/generate.js';
import { validateScenario, instructionS, nodeById, type Scenario } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { columnCLines } from '../src/core/griid.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { builtinScenario } from '../src/agent/scenarios.js';

const mode = process.argv[2] ?? 'all';
const N = Number(process.argv[3] ?? 50);
const problems: string[] = []; const notes: string[] = [];
const lowFreq = { timedLines: 0, withUnprinted: 0, unprintedControl: 0, slowZone: 0, hazardOther: 0, turnNode: 0, seedsAffected: new Set<number>(), linesAffected: 0 };

function checks(label: string, sc: Scenario, day: boolean, seed: number): void {
  const v = validateScenario(sc); if (v.length) problems.push(`${label}: validate: ${v.join('; ')}`);
  const e = checkRouteExits(sc); if (e.length) problems.push(`${label}: routeExits: ${e.join('; ')}`);
  const timing = sc.checkpoints.filter(c => c.kind === 'timing');
  if (day && (timing.length < 4 || timing.length > 6)) problems.push(`${label}: ${timing.length} timing CPs (want 4-6)`);
  for (const i of sc.book) for (const sp of [i.speed, i.timed?.holdSpeed, i.timed?.thenSpeed]) if (sp !== undefined && (sp < 10 || sp > 55)) problems.push(`${label}: line ${i.n} speed ${sp} outside 10-55`);
  // pauses only where printed
  for (const ins of sc.book) {
    const c = columnCLines(ins, sc.timeZone).join('|'); const printed = /0m\d\ds|\d+m\d\ds/.test(c);
    if (ins.pause && !/0m|m\d\ds/.test(c)) problems.push(`${label}: line ${ins.n} pause ${ins.pause} not in column C: ${c}`);
    if (ins.pause) { const n = nodeById(sc.course, ins.nodeId); if (n.control === 'none' || !n.control) problems.push(`${label}: line ${ins.n} pause on a node with no control (${n.control})`); }
    if (!ins.pause && !ins.timed && !ins.transit && !ins.restartTime && !ins.calibrationStart && printed && /\b0m\d\ds\b/.test(c) && /pause/i.test(c)) problems.push(`${label}: line ${ins.n} Column C shows a pause the book does not carry: ${c}`);
  }
  // 2-minute free zone after a transit end / restart (ghost time between the row and the first timing CP after it)
  const g = buildGhost(sc);
  sc.book.forEach((ins, i) => {
    const rel = ins.transit?.end || (ins.section === 'restart' && ins.restartTime !== undefined && ins.n > 1);
    if (!rel) return;
    const s0 = instructionS(sc.course, ins); const next = timing.find(c => c.s > s0); if (!next) return;
    // transit end rows do not hold the car: the 2 min clock starts at the row crossing
    const gap = ghostTimeAt(g, next.s) - ghostTimeAt(g, s0);
    if (gap < 120) problems.push(`${label}: timing CP ${next.id} is ${gap.toFixed(0)} s after ${ins.transit?.end ? 'transit end' : 'restart'} line ${ins.n} (< 120 s)`);
    void i;
  });
  // TA point after every End timed portion
  const ends = sc.book.filter(i => i.endTimed).length, tas = sc.book.filter(i => i.taPoint).length;
  if (day) {
    sc.book.forEach((ins, i) => { if (ins.endTimed && !ins.taPoint && !sc.book[i + 1]?.taPoint) problems.push(`${label}: endTimed @${ins.n} not followed by a TA point`); });
    if (tas < ends) problems.push(`${label}: ${ends} endTimed vs ${tas} taPoints`);
    // calibration points
    const cal = sc.book.filter(i => i.section === 'calibration'); const pts = cal.filter(i => !i.calibrationStart).length;
    if (pts < 3 || pts > 12) problems.push(`${label}: ${pts} calibration points (rows ${cal.length}), want 3-12`);
    notes.push(`${label} calpts ${pts}`);
  }
  // LOW 14
  sc.book.forEach(ins => {
    if (!ins.timed) return; lowFreq.timedLines++;
    const s0 = instructionS(sc.course, ins); const reach = s0 + ins.timed.holdSpeed * 1.4666667 * ins.timed.seconds; let hit = false;
    for (const n of sc.course.nodes) if (n.s > s0 + 5 && n.s <= reach + 1 && !sc.book.some(b => b.nodeId === n.id)) {
      if (['STOP', 'SIGNAL', 'RR', 'YIELD', 'BLINKER'].includes(n.control ?? '')) { lowFreq.unprintedControl++; hit = true; notes.push(`LOW14 ${label} line ${ins.n}: unprinted ${n.control}`); }
      else if (n.kind === 'intersection' && (n.exits ?? []).some(x => x.isRoute && Math.abs(x.angle) >= 20)) { lowFreq.turnNode++; hit = true; }
    }
    for (const h of sc.hazards) { const hs = (h as { s?: number }).s; const len = (h as { lengthFt?: number }).lengthFt ?? 0; if (hs !== undefined && hs + len > s0 && hs <= reach) { if (h.kind === 'slow') lowFreq.slowZone++; else lowFreq.hazardOther++; hit = true; } }
    if (hit) { lowFreq.withUnprinted++; lowFreq.seedsAffected.add(seed); }
  });
}

function oracle(label: string, sc: Scenario, maxRaw = 60): number {
  const sim = new Simulator(sc, { watch: 'digital' }); const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
  const missed = res.score.legs.filter(l => l.extras.missed).length;
  if (sim.phase !== 'finished' || res.dnf || missed) problems.push(`${label}: oracle did not finish cleanly raw ${res.score.raw} dnf ${res.dnf} missed ${missed}`);
  if (res.score.raw > maxRaw) notes.push(`${label}: oracle raw ${res.score.raw} (high)`);
  if (res.offCourseCount) problems.push(`${label}: oracle off course ${res.offCourseCount}`);
  return res.score.raw;
}

const raws: Record<string, number[]> = {};
if (mode === 'all' || mode === 'day') for (let seed = 1; seed <= N; seed++) { const sc = generateStage(seed, PROFILES.fullStage); checks(`day ${seed}`, sc, true, seed); (raws.day ??= []).push(oracle(`day ${seed}`, sc)); }
if (mode === 'all' || mode === 'leg') {
  for (let seed = 1; seed <= N; seed++) { const sc = generateLeg(seed, PROFILES.fullLeg); checks(`fullLeg ${seed}`, sc, false, seed); (raws.fullLeg ??= []).push(oracle(`fullLeg ${seed}`, sc)); }
  for (let seed = 1; seed <= N; seed++) { const sc = builtinScenario('varied', seed); const v = validateScenario(sc); if (v.length) problems.push(`varied ${seed}: ${v.join('; ')}`); for (const i of sc.book) for (const sp of [i.speed, i.timed?.holdSpeed, i.timed?.thenSpeed]) if (sp !== undefined && (sp < 10 || sp > 55)) problems.push(`varied ${seed}: speed ${sp}`); (raws.varied ??= []).push(oracle(`varied ${seed}`, sc)); }
}
if (mode === 'all' || mode === 'other') for (const [name, p] of Object.entries(PROFILES)) { if (name === 'fullStage' || name === 'fullLeg') continue; for (let seed = 1; seed <= 20; seed++) { const sc = generateLeg(seed, p); checks(`${name} ${seed}`, sc, false, seed); (raws[name] ??= []).push(oracle(`${name} ${seed}`, sc)); } }
const mean = (a: number[]): string => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
for (const [k, a] of Object.entries(raws)) console.log(`${k}: n ${a.length} mean raw ${mean(a)} max ${Math.max(...a)} >=14: ${a.filter(x => x >= 14).length}`);
console.log('LOW14', JSON.stringify({ ...lowFreq, seedsAffected: [...lowFreq.seedsAffected].length }));
console.log('PROBLEMS', problems.length); console.log(problems.join('\n'));
console.log(notes.filter(n => n.startsWith('LOW14') || /high/.test(n)).join('\n'));
const cp = notes.filter(n => /calpts/.test(n)).map(n => Number(n.split('calpts ')[1])); if (cp.length) console.log('calibration points: min', Math.min(...cp), 'max', Math.max(...cp));

/**
 * PT-09 area 4: note grading edges for D15 / D16 (checkpoint times "CP3 9:14:22", chart losses) and D17 (elapsed m:ss), plus a D15 "spray" exploit probe.
 * Direct calls to the graders with synthetic results, then real runs for D17 and D15.
 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { parseCpNotes, gradeCheckpointNotes, lossNumbers, gradeChartLossNotes } from '../src/core/drills/preread.js';
import { elapsedAfterReset } from '../src/core/drills/index.js';
import { parseDuration } from '../src/core/drills/d07.js';
import { idealNotes } from '../src/core/drills/d15.js';
import { Simulator, type Action, type StageResult } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { formatClock } from '../src/core/units.js';

const issues: string[] = []; const log = console.log;
// ---------- 1. checkpoint note formats (graded within 2 s of the crossing, mod 12 h)
{
  const tod = 9 * 3600 + 14 * 60 + 22;   // 09:14:22
  const mk = (texts: string[]): StageResult => ({ actions: texts.map((t, i) => ({ tick: i, action: { type: 'line.annotate', n: 3, text: t } })), records: [{ kind: 'timing', actualTod: tod }] } as unknown as StageResult);
  const cases: [string, boolean][] = [
    ['CP1 9:14:22', true], ['CP1 09:14:22', true], ['cp1 09:14:22', true], ['CP 1 9:14:22', true], ['CP#1 9:14:22', true], ['CP1: 9:14:22', true], ['CP1 - 9:14:22', true], ['CP1=9:14:22', true], ['CP1 9:14:22 AM', true], ['CP1 9:14:22 PM', true], ['CP1 21:14:22', true],
    ['  CP1   9:14:22  ', true], ['CP1\t9:14:22', true], ['CP1\n9:14:22', true], ['CP1 at 9:14:22', true], ['CP1 arrived 9:14:22', true], ['Checkpoint 1 9:14:22', true], ['CP1 9:14', false], ['CP1 09.14.22', false], ['CP1 091422', false], ['CP1 9:14:22.4', true],
    ['CP01 9:14:22', true], ['CP1 9:14:24', true], ['CP1 9:14:25', false], ['CP1 9:14:20', true], ['CP1 9:14:19', false], ['CP1 9:14:22, CP2 9:30:00', true], ['CP2 9:14:22', false], ['CP10 9:14:22', false], ['9:14:22 CP1', false], ['CP1 9h14m22s', false], ['CP1 9:14:22:00', true],
    ['CP12:14:22', false], ['CP1 ９:14:22', false],
  ];
  const bad: string[] = [];
  for (const [t, want] of cases) { const g = gradeCheckpointNotes(mk([t])); const got = g.good === 1; if (got !== want) bad.push(`${JSON.stringify(t)} -> graded ${got ? 'right' : 'wrong'} (parsed ${JSON.stringify(parseCpNotes([t]))}), expected ${want ? 'right' : 'wrong'}`); }
  log(`CP note formats: ${cases.length - bad.length}/${cases.length} as expected`); for (const b of bad) { log('  ' + b); }
  // the 12-hour wrap: the true crossing at 13:05:10 written 1:05:10 and 13:05:10
  const mk2 = (t: string, at: number): StageResult => ({ actions: [{ tick: 0, action: { type: 'line.annotate', n: 3, text: t } }], records: [{ kind: 'timing', actualTod: at }] } as unknown as StageResult);
  log('13:05:10 crossing, "CP1 1:05:10" ->', gradeCheckpointNotes(mk2('CP1 1:05:10', 13 * 3600 + 310)).good, '| "CP1 13:05:10" ->', gradeCheckpointNotes(mk2('CP1 13:05:10', 13 * 3600 + 310)).good, '| 12:59:59 vs 00:00:01 wrap ->', gradeCheckpointNotes(mk2('CP1 12:59:59', 12 * 3600 + 3600 - 2)).good);
  // a blank note, a 'note' action (not annotate) is NOT graded
  const g = gradeCheckpointNotes({ actions: [{ tick: 0, action: { type: 'note', text: 'CP1 09:14:22' } }], records: [{ kind: 'timing', actualTod: tod }] } as unknown as StageResult); log('"CP1 09:14:22" written with the `note` action (not Column D) -> attempted', g.attempted, 'good', g.good);
  // two timing records, only second written
  const g2 = gradeCheckpointNotes({ actions: [{ tick: 0, action: { type: 'line.annotate', n: 3, text: 'CP2 9:30:00' } }], records: [{ kind: 'timing', actualTod: tod }, { kind: 'timing', actualTod: 9 * 3600 + 30 * 60 }] } as unknown as StageResult); log('only CP2 written: good', g2.good, 'total', g2.total, g2.lines.join(' | '));
  // loss numbers
  const L = (t: string): number[] => lossNumbers(t);
  log('lossNumbers:', JSON.stringify({ 'loss 10.2': L('loss 10.2'), '-2.3': L('-2.3'), '+10.2': L('+10.2'), 'chart: 2.3': L('chart: 2.3'), 'lost 4': L('lost 4'), '10.2': L('10.2'), '35 mph - 2.3': L('35 mph - 2.3'), 'restart 9:41:00 -2': L('restart 9:41:00 -2'), 'pause 7.5 s; loss 3.1': L('pause 7.5 s; loss 3.1'), 'CP3 9:14:22': L('CP3 9:14:22'), '40-35 = 4.0': L('40-35 = 4.0'), 'loss: -2.3': L('loss: -2.3'), 'loss 2,3': L('loss 2,3'), 'loss 10': L('loss 10') }));
}
// ---------- 2. D17 elapsed notes: parser and grading on a real run
{
  const d = drillById('D17')!; const sc = d.scenario(1, 1); const cal = sc.book.find(i => i.calibrationStart)!;
  const mmss = (x: number): string => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;
  log('parseDuration:', JSON.stringify(Object.fromEntries(['4:05', '4:05.0', '04:05', '4m05s', '4m05.5s', '245', '245.5', '4:5', '4 : 05', '4:05.', '4:05,', '1:04:05', '4m', '-4:05', ' 4:05 ', '4:05s', '4:60', '0:245'].map(s => [s, parseDuration(s)]))));
  const T = (n: number): string => mmss(n);
  const variants: [string, (e: number) => string, boolean][] = [
    ['elapsed m:ss.d', e => `elapsed ${T(e)}`, true], ['Elapsed 4:05', e => `Elapsed ${Math.floor(e / 60)}:${String(Math.round(e % 60)).padStart(2, '0')}`, true], ['elapsed: m:ss', e => `elapsed: ${T(e)}`, true], ['elapsed = m:ss', e => `elapsed = ${T(e)}`, true],
    ['elapsed 4m05.0s', e => `elapsed ${Math.floor(e / 60)}m${(e % 60).toFixed(1).padStart(4, '0')}s`, true], ['elapsed seconds', e => `elapsed ${e.toFixed(1)}`, true], ['whitespace', e => `  elapsed    ${T(e)}   `, true], ['ELAPSED upper', e => `ELAPSED ${T(e)}`, true],
    ['bare m:ss (no word)', e => T(e), false], ['"el 4:05"', e => `el ${T(e)}`, false], ['"elapsed time 4:05"', e => `elapsed time ${T(e)}`, false], ['"elapsed is 4:05"', e => `elapsed is ${T(e)}`, false], ['"elapsed since * 4:05"', e => `elapsed since asterisk ${T(e)}`, false],
    ['trailing period "elapsed 4:05."', e => `elapsed ${Math.floor(e / 60)}:${String(Math.round(e % 60)).padStart(2, '0')}.`, true], ['"elapsed 4:05 (restarted)"', e => `elapsed ${T(e)} (restarted)`, true], ['"elapsed 4:05, cal at 2:00"', e => `elapsed ${T(e)}, cal at 2:00`, true], ['"Elapsed 4 min 5 s"', e => `Elapsed ${Math.floor(e / 60)} min ${Math.round(e % 60)} s`, false],
    ['hh:mm:ss "elapsed 0:04:05"', e => `elapsed 0:0${Math.floor(e / 60)}:${String(Math.round(e % 60)).padStart(2, '0')}`, false], ['2 s off', e => `elapsed ${T(e + 2)}`, true], ['6 s off', e => `elapsed ${T(e + 6)}`, false],
  ];
  const stars: string[] = [];
  for (const [name, fn, shouldGrade] of variants) {
    let doneAfter = false; const s = new Simulator(sc, { watch: 'digital' }); const o = new OracleBot(s, { useWatch: true });
    const b: Bot = { name: 'v', onTick(ss) { if (!doneAfter && ss.events.some(e => e.type === 'watchLost')) { doneAfter = true; const t0 = ss.events.find(e => e.type === 'node' && e.detail?.nodeId === cal.nodeId)!.tod; ss.act({ type: 'clock.read' }); ss.act({ type: 'note', text: fn(ss.tod - t0) } as Action); ss.act({ type: 'watch.start' }); } o.onTick(ss); } };
    const r = runBot(s, b); const g = elapsedAfterReset(r, sc)!; const rb = d.rubric(r, sc);
    const parsed = g.noted !== null; if (parsed !== shouldGrade) issues.push(`D17 note format ${name}: parsed=${parsed}, expected ${shouldGrade}`);
    stars.push(`${name.padEnd(34)} noted ${g.noted === null ? 'none' : g.noted.toFixed(1)} err ${g.err === null ? '-' : g.err.toFixed(1)} restarted ${g.restarted} stars ${rb.stars}`);
  }
  log(stars.join('\n'));
  // wrong anchor: a note computed from the START instead of the asterisk, a note written BEFORE the reset, and a note with no watch restart
  const doNote = (when: 'before' | 'after', text: (e: number, t0: number, ss: Simulator) => string, restart: boolean): StageResult => { let done = false; const s = new Simulator(sc, { watch: 'digital' }); const o = new OracleBot(s, { useWatch: true });
    return runBot(s, { name: 'x', onTick(ss) { const lost = ss.events.some(e => e.type === 'watchLost'); if (!done && (when === 'after' ? lost : !lost && ss.tod > sc.startTime + 600)) { done = true; const t0 = ss.events.find(e => e.type === 'node' && e.detail?.nodeId === cal.nodeId)?.tod ?? sc.startTime; ss.act({ type: 'note', text: text(ss.tod - t0, t0, ss) } as Action); if (restart) ss.act({ type: 'watch.start' }); } o.onTick(ss); } }); };
  const rbOf = (r: StageResult) => d.rubric(r, sc).stars;
  log('note before the reset (should not count):', rbOf(doNote('before', e => `elapsed ${mmss(e)}`, true)), '| after reset but no watch restart:', rbOf(doNote('after', e => `elapsed ${mmss(e)}`, false)), '| anchored to the start instead of the asterisk:', rbOf(doNote('after', (e, t0, ss) => `elapsed ${mmss(ss.tod - sc.startTime)}`, true)));
}
// ---------- 3. D15 spray probe: can a team with no knowledge earn stars by writing every number everywhere?
{
  const d = drillById('D15')!; const res: string[] = [];
  for (const tier of [0, 1, 2]) for (const seed of [1, 2, 3]) {
    const sc = d.scenario(seed, tier);
    const spray = Array.from({ length: 121 }, (_, i) => i * 0.5).join(' ');
    const run = (mkNotes: (sc: typeof sc) => { n: number; text: string }[]): number => { let done = false; const s = new Simulator(sc, { watch: 'digital' }); const o = new OracleBot(s, { useWatch: true });
      return d.rubric(runBot(s, { name: 's', onTick(ss) { if (!done) { done = true; for (const x of mkNotes(sc)) ss.act({ type: 'line.annotate', n: x.n, text: x.text } as Action); } o.onTick(ss); } }), sc).stars; };
    const a = run(sc2 => sc2.book.map(i => ({ n: i.n, text: `${spray} comes quick` })));
    const b = run(sc2 => sc2.book.map(i => ({ n: i.n, text: `${spray} comes quick ${i.restartTime !== undefined && i.section === 'restart' ? formatClock(i.restartTime) : ''}` })));
    const ideal = run(sc2 => idealNotes(sc2));
    res.push(`${['B', 'S', 'G'][tier]} seed ${seed}: number-spray 'comes quick' on every line -> ${a} stars; + restart time -> ${b}; idealNotes (no OUT time) -> ${ideal}`);
  }
  log(res.join('\n'));
}
log('ISSUES', issues.length); log(issues.join('\n'));
void gradeChartLossNotes;

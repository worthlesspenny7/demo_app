import { parseRawRuns, deriveFromRaw } from '../src/core/drills/d06.js';
import { roundFactored, ageFactor, compareStandings, championshipTotal } from '../src/core/scoring.js';
import { TRAP_QUIZ } from '../src/core/generator/traps.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { Session } from '../src/agent/protocol.js';
import { simpleStart, until } from './pt06-common.js';
// CHART-006 raw runs
{ const raw = parseRawRuns(['const 25 runs 19.8 19.9 19.1 19.8', 'acc 25 runs 21.4 21.5 21.4 21.6', 'brk 25 runs 21.1 21.0 21.2 21.1', 'const 0 runs 1']);
  const d = deriveFromRaw(raw); console.log('CHART-006 acc', JSON.stringify(d.acc), 'dec', JSON.stringify(d.dec), 'pause', JSON.stringify(d.pause), 'negatives', JSON.stringify(d.negatives), 'discrepant', JSON.stringify(d.discrepant), 'pause>15', JSON.stringify(d.pauseOver15)); }
// ENG-012 half-up
console.log('ENG-012 5 x .845 =', roundFactored(5, 0.845), ' 3 x .845 =', roundFactored(3, 0.845), ' 1 x .845', roundFactored(1, 0.845));
// ENG-013 NaN age factor rejected
try { console.log('ENG-013 ageFactor(NaN)', ageFactor(NaN)); } catch (e) { console.log('ENG-013 ageFactor(NaN) throws', String(e).slice(0, 60)); }
// PLAY-036 quiz option length spread
{ let worst = 0, longestRight = 0, n = 0; for (const [id, q] of Object.entries(TRAP_QUIZ)) { const all = [q.right, ...q.wrong]; const lens = all.map(s => s.length); const r = Math.max(...lens) / Math.min(...lens); worst = Math.max(worst, r); if (q.right.length === Math.max(...lens)) longestRight++; n++; }
  console.log(`PLAY-036 ${n} cards, worst longest/shortest ratio ${worst.toFixed(2)}, right option longest on ${longestRight}`); }
console.log('PLAY-035 speed-at-signal:', JSON.stringify(TRAP_QUIZ['speed-at-signal']).slice(0, 400));
// GRIID-017 speed limit sign vs assigned
{ let signs = 0, below = 0, equalNum = 0; for (let seed = 1; seed <= 8; seed++) { const sc = generateStage(seed, PROFILES.fullStage); const speedAt = new Map<number, number>(); let v = 0; for (const b of sc.book) { if (b.timed) v = b.timed.thenSpeed; else if (typeof b.speed === 'number') v = b.speed; const nd = sc.course.nodes.find(n => n.id === b.nodeId); if (nd?.sign?.shape === 'speedlimit') { signs++; const m = /(\d+)/.exec(nd.sign.text); const lim = m ? Number(m[1]) : 0; if (lim < v) below++; if (lim === v) equalNum++; } } }
  console.log(`GRIID-017 speed limit signs ${signs}, limit below assigned ${below}, equal ${equalNum}`); }
// START-002 pace cars on the road with asp
{ const sc = generateStage(3, { ...PROFILES.fullStage, asp: 37 } as any); const sim = new Simulator(sc, { watch: 'digital' }); let seenAhead = 0, seenBehind = 0, n = 0;
  sim.act({ type: 'skipPreread', secondsBefore: 3 } as any); sim.act({ type: 'start' } as any);
  for (let t = 0; t < 30000 && sim.phase !== 'finished'; t++) { sim.step(0.1); if (t % 20) continue; n++; const o = sim.observe({ peek: true }); if (o.paceCars.ahead) seenAhead++; if (o.paceCars.behind) seenBehind++; }
  console.log(`START-002 pace cars (rung ${sc.aids.rung}): ahead visible in ${seenAhead}/${n} samples, behind in ${seenBehind}/${n} over the first 50 min`); }
// ENG-018 redaction through Session at rung 0
{ const sc = generateStage(1, { ...PROFILES.fullStage, asp: 5, aids: { rung: 0, paceBar: false, countdown: false, cumulativeTimes: false, autoAdvanceLine: false, showTruthAfter: true, showSpeedo: 'marks', checkOff: false, cpCard: false, offCourseAlert: false } } as any);
  const s = new Session(sc as any, { watch: 'digital' } as any); const r: any = s.handle({ type: 'observe' } as any); const o = r.observation;
  console.log('ENG-018 rung', sc.aids.rung, 'tod integer', Number.isInteger(o.tod), 'launch', o.launch, 'queue leaves', JSON.stringify(o.startQueue?.cars?.[0]?.leavesTod)); }
// ENG-003 untilEvent stops 30 s before launch
{ const sc = generateStage(1, { ...PROFILES.fullStage, asp: 5 } as any); const s = new Session(sc as any, { watch: 'digital' } as any); const o0: any = (s.handle({ type: 'observe' } as any) as any).observation; const li = (s.sim.observe({ peek: true }).launch)!;
  const r: any = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 3000 } as any); console.log('ENG-003 untilEvent stoppedOn', r.stoppedOn, 'seconds to launch after', (li.launchTime - s.sim.tod).toFixed(1)); }
// ENG-001 stale call.go
{ const sc = simpleStart(0, 3, 3, 120); const sim = new Simulator(sc); until(sim, () => sim.tod >= sc.startTime - 5, 400); sim.act({ type: 'start' } as any); sim.act({ type: 'call.go' } as any); console.log('ENG-001 stale go refused/ignored at start: phase', sim.phase); }

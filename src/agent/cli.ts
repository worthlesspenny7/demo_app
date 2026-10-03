#!/usr/bin/env tsx
/** CLI: run a bot headless, or serve the JSON-lines protocol over stdin/stdout.
 *  npm run sim -- --scenario builtin:varied --seed 3 --bot oracle
 *  npm run sim -- --scenario gen:fullLeg --seed 7 --stdin            (protocol mode)
 *  npm run sim -- --scenario file:content/x.json --bot rookie --json */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Session, type Request } from './protocol.js';
import { makeBot, runBot, type BotName } from './bots.js';
import { builtinScenario } from './scenarios.js';
import type { Scenario } from '../core/course.js';
import { validateScenario } from '../core/course.js';
import { formatClock } from '../core/units.js';

function arg(name: string, def?: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; }
function flag(name: string): boolean { return process.argv.includes(`--${name}`); }

export async function loadScenario(spec: string, seed: number): Promise<Scenario> {
  const [kind, rest] = spec.includes(':') ? [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)] : ['builtin', spec];
  if (kind === 'builtin') return builtinScenario(rest!, seed);
  if (kind === 'file') return JSON.parse(readFileSync(rest!, 'utf8')) as Scenario;
  if (kind === 'gen') {
    const genPath = '../core/generator/generate.js';
    const mod = await import(genPath).catch(() => null) as null | { generateStage?: (seed: number, profile: unknown) => Scenario; generateLeg?: (seed: number, profile: unknown) => Scenario; PROFILES?: Record<string, unknown> };
    if (!mod || !mod.PROFILES) throw new Error('generator not available');
    const profile = mod.PROFILES[rest!]; if (!profile) throw new Error(`unknown profile ${rest}; have ${Object.keys(mod.PROFILES).join(',')}`);
    const fn = rest === 'fullStage' || rest === 'stage' ? mod.generateStage! : (mod.generateLeg ?? mod.generateStage)!;
    return fn(seed, profile);
  }
  if (kind === 'drill') {
    const drillsPath = '../core/drills/index.js';
    await import(drillsPath).catch(() => null);
    const { drillById } = await import('../core/drills/registry.js');
    const d = drillById(rest!); if (!d) throw new Error(`unknown drill ${rest}`);
    return d.scenario(seed, Number(arg('tier', '0')));
  }
  throw new Error(`unknown scenario spec ${spec}`);
}

async function main(): Promise<void> {
  const seed = Number(arg('seed', '1'));
  const sc = await loadScenario(arg('scenario', 'builtin:varied')!, seed);
  const problems = validateScenario(sc);
  if (problems.length) { console.error('invalid scenario:', problems.join('; ')); process.exit(2); }
  const watch = (arg('watch', 'analog') as 'analog' | 'digital');
  if (flag('stdin')) {
    const session = new Session(sc, { watch });
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let req: Request;
      try { req = JSON.parse(line) as Request; } catch { process.stdout.write(JSON.stringify({ type: 'error', message: 'bad json' }) + '\n'); continue; }
      process.stdout.write(JSON.stringify(session.handle(req)) + '\n');
      if (req.type === 'result') break;
    }
    return;
  }
  const session = new Session(sc, { watch });
  const bot = makeBot((arg('bot', 'oracle') as BotName), session.sim, seed);
  const result = runBot(session.sim, bot);
  if (flag('json')) { console.log(JSON.stringify(result, null, flag('pretty') ? 2 : 0)); return; }
  console.log(`${sc.name} [${sc.id}] seed ${seed} bot ${bot?.name ?? 'none'} driver ${sc.driver.skill} speedo ${sc.speedo.kind}`);
  for (const l of result.score.legs) console.log(`  leg ${l.index} ${l.cpId}: perfect ${formatClock(Math.round(l.anchorTod + l.perfectDuration))} actual ${l.actualTod === null ? '-' : formatClock(l.actualTod)} error ${l.error ?? 'missed'} penalty ${l.penalty}${l.ace ? ' ACE' : ''}`);
  console.log(`  raw ${result.score.raw}  x${result.score.ageFactor} = ${result.score.score}  aces ${result.score.aces}  offCourse ${result.offCourseCount}  obsMissed ${result.observationMissed}`);
  for (const a of result.attribution) { const b = Object.entries(a.buckets).filter(([, v]) => Math.abs(v) > 0.3).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(', '); if (b) console.log(`  leg ${a.legIndex} attribution: ${b}`); }
}
main().catch(e => { console.error(e); process.exit(1); });

/**
 * PT-14 evidence (throwaway profile): put chosen cards on the phone through the real Continue path (a crafted unfinished run in
 * localStorage, exactly what the app saves), play each card by the rule cards with the PT-14 player, and screenshot card and verdict.
 *  E1 the C-1 tractor hazard; E2 a Boss-leg timed start where the car is off the ghost's pace (C-2; the first cards of that Boss are
 *  replayed from the follower's own answers); E3 a 15 s pause on a turn row (PT-13 BUG-01); E4 a TA claim (BUG-02); E5 transit OUT
 *  (middle-time give-away); E6 a watch card; E7 restart base + position; E8 a clock card; E9 lost with a detour; E10 pre-read pause.
 */
process.env.PT14_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt14-ev';
const { open, shot, writeJson, sleep, BASE, state } = await import('./pt14-common.js');
const { playRun, summarize, seedPlayer } = await import('./pt14-player.js');
const { buildMicro, microRunner, Scheduler, DecisionRun, emptyProgress } = await import('../src/core/decision/index.js');
const { follow } = await import('./pt14-follower.js');
const { screenOf, toResponse } = await import('./pt14-10-follower-audit.js');

const SK: Record<string, string> = { hazard: 'recovery', pause: 'stayOnTime', ta: 'recovery', transitOut: 'startOnTime', watch: 'instruments', restart: 'startOnTime', clock: 'instruments', lost: 'recovery', preread: 'safetyCourse', speedChange: 'stayOnTime' };
function find(kind: string, test: (d: any, r: any) => boolean, variants = [0, 1, 2, 3]): any {
  for (let s = 1; s < 400; s++) for (const variant of variants) {
    const spec = { kind, skill: SK[kind], seed: s * 7919 + variant * 31, variant };
    const r = microRunner(buildMicro(spec as any, 2), 2); const d = r.next();
    if (d && d.kind === kind && test(d, r)) return spec;
  }
  throw new Error(`no ${kind}`);
}
const turnRow = (d: any, r: any): boolean => { const ins = r.scenario.book.find((i: any) => i.n === d.context.line); return !!ins?.turn && ins.turn !== 'S'; };
const targets: { name: string; spec?: any; plan?: any; responses?: any[]; rung: number }[] = [
  { name: 'e1-tractor', spec: find('hazard', d => /tractor .* no room to pass for miles/i.test(d.prompt), [2]), rung: 2 },
  { name: 'e3-pause15-turn', spec: find('pause', (d, r) => /Pause 15 s/.test(d.prompt) && turnRow(d, r)), rung: 2 },
  { name: 'e4-ta', spec: find('ta', d => /could be made up/.test(d.prompt)), rung: 2 },
  { name: 'e5-transit', spec: find('transitOut', () => true), rung: 2 },
  { name: 'e6-watch', spec: find('watch', () => true), rung: 2 },
  { name: 'e7-restart-base', spec: find('restart', d => /base/.test(d.prompt), [2]), rung: 2 },
  { name: 'e8-clock-minute', spec: find('clock', d => /read the minute/.test(d.prompt) && d.context.clock?.minuteAmbiguous, [0, 1]), rung: 2 },
  { name: 'e9-lost-detour', spec: find('lost', d => /rejoins it/.test(d.prompt), [1, 3]), rung: 2 },
  { name: 'e10-preread-pause', spec: find('preread', d => /How long/.test(d.prompt), [1]), rung: 2 },
];
// E2: Boss rung 2, seed 9 x 1237: card 8 is a leg timed start with the car 23.8 s off the ghost (pt14-11-timed-probe.ts)
{
  const plan = Scheduler.boss(9 * 1237, null, 2).plan(); const run = new DecisionRun(plan); const responses: any[] = [];
  for (let i = 0; i < 100 && responses.length < 7; i++) { const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; } const d = st.decision; const r = run.currentRunner()!; const arrow = (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined; const resp = toResponse(follow(screenOf(d, 2, arrow), () => 0.2), d); run.answer(resp); responses.push(resp); }
  targets.splice(1, 0, { name: 'e2-boss-timed', plan, responses, rung: 2 });
}
const h = await open({ fresh: true }); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const found: Record<string, unknown> = {};
seedPlayer(99);
for (const t of targets) {
  const plan = t.plan ?? { seed: t.spec.seed, mode: 'practice', skills: [t.spec.skill], rung: t.rung, items: [{ type: 'decision', micro: t.spec }], decisionCount: 1 };
  const prog = { ...emptyProgress(), rulesSeen: [], unfinished: { plan, responses: t.responses ?? [] } };
  await page.evaluate(p => localStorage.setItem('rally-trainer.decision.v1', JSON.stringify(p)), prog);
  await page.goto(`${BASE}/?mode=mobile#/m/continue`); await page.waitForSelector('[data-screen=run]'); await sleep(300);
  const st = await state(page);
  const run = await playRun(page, { policy: 'rules', label: t.name, stopAfterDecisions: 1, shotPrefix: `7x-${t.name}`, shotKinds: new Set(['rule']), rung: t.rung });
  const c = run.cards.find(x => x.phase === 'decision');
  found[t.name] = { kind: st?.kind, n: st?.n, of: st?.of, prompt: c?.prompt, action: c?.action, verdict: c?.verdict, onCardS: c ? ((c.tTap! - c.tShown) / 1000).toFixed(1) : null, words: c?.words, opened: c?.opened };
}
writeJson('s09-evidence', { found, errors: h.errors });
console.log(JSON.stringify({ found, errors: h.errors }, null, 1));
await h.close();

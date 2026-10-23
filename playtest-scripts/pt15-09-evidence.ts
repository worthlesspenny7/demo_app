/**
 * PT-15 evidence (throwaway profile): chosen cards put on the phone through the real Continue path (a crafted unfinished run in localStorage,
 * exactly what the app saves), each played as stated, verdict screenshotted.
 *  E1 the PT-14 C-1 tractor (long) by RULE-031; E1b a slow truck; E1c a train whose last cars are passing (RULE-032);
 *  E2 PT-14's C-2 Boss (rung 2, seed 9 x 1237, card 8, the first 7 answered by the follower) by the rule cards;
 *  E3 the red GREAT RACE STOP board (Dad's line); E4 a transit-OUT restart after RULE-014, launched exactly on the OUT second as RULE-014
 *  says (the strict reading); E5 a pre-read "pause" slot after RULE-016 that asks "Which way".
 */
process.env.PT15_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt15-ev';
const { open, writeJson, sleep, BASE, state } = await import('./pt15-common.js');
const { playRun, seedPlayer } = await import('./pt15-player.js');
const { buildMicro, microRunner, Scheduler, DecisionRun, emptyProgress, ruleCardById } = await import('../src/core/decision/index.js');
const { follow } = await import('./pt15-follower.js');

const SK: Record<string, string> = { hazard: 'recovery', checkpoint: 'safetyCourse', restart: 'startOnTime', preread: 'safetyCourse' };
function find(kind: string, test: (d: any) => boolean, variants: number[]): any {
  for (let s = 1; s < 600; s++) for (const variant of variants) {
    const spec = { kind, skill: SK[kind], seed: s * 6151 + variant * 17, variant };
    const r = microRunner(buildMicro(spec as any, 2), 2); const d = r.next();
    if (d && d.kind === kind && test(d)) return spec;
  }
  throw new Error(`no ${kind}`);
}
type T = { name: string; spec?: any; plan?: any; responses?: any[]; rung: number; policy: 'rules' | 'naive'; rule?: string };
const targets: T[] = [
  { name: 'e1-tractor-long', spec: find('hazard', d => /farm tractor .*cannot pass/i.test(d.prompt), [2]), rung: 2, policy: 'rules' },
  { name: 'e1b-truck', spec: find('hazard', d => /slow truck/i.test(d.prompt), [0]), rung: 2, policy: 'rules' },
  { name: 'e1c-train-short', spec: find('hazard', d => /last cars are passing/i.test(d.prompt), [1]), rung: 2, policy: 'rules' },
  { name: 'e3-red-board', spec: find('checkpoint', d => /red GREAT RACE STOP/.test(d.prompt), [1]), rung: 2, policy: 'rules' },
  { name: 'e4-transit-out-strict', spec: find('restart', d => /Transit OUT/.test(d.prompt), [1]), rung: 2, policy: 'naive', rule: 'RULE-014' },
  { name: 'e5-pause-slot-which-way', spec: find('preread', d => /Which way/.test(d.prompt), [1]), rung: 2, policy: 'rules', rule: 'RULE-016' },
];
{
  const plan = Scheduler.boss(9 * 1237, null, 2).plan(); const run = new DecisionRun(plan); const responses: any[] = [];
  for (let i = 0; i < 100 && responses.length < 7; i++) { const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; } const d = st.decision; const r = run.currentRunner()!; const arrow = (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined; const resp = follow(d, { react: () => 0.2, arrow }); run.answer(d.deadlineSeconds !== undefined && resp.optionId ? { ...resp, tapSeconds: 2.5 } : resp); responses.push(d.deadlineSeconds !== undefined && resp.optionId ? { ...resp, tapSeconds: 2.5 } : resp); }
  targets.splice(3, 0, { name: 'e2-boss-timed', plan, responses, rung: 2, policy: 'rules' });
}
const h = await open({ fresh: true }); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const found: Record<string, unknown> = {};
seedPlayer(159);
for (const t of targets) {
  const items = [...(t.rule ? [{ type: 'rule', card: ruleCardById(t.rule) }] : []), { type: 'decision', micro: t.spec }];
  const plan = t.plan ?? { seed: t.spec.seed, mode: 'practice', skills: [t.spec.skill], rung: t.rung, items, decisionCount: 1 };
  const prog = { ...emptyProgress(), rulesSeen: [], unfinished: { plan, responses: t.responses ?? [] } };
  await page.evaluate(p => localStorage.setItem('rally-trainer.decision.v1', JSON.stringify(p)), prog);
  await page.goto(`${BASE}/?mode=mobile#/m/continue`); await page.waitForSelector('[data-screen=run]'); await sleep(300);
  const st = await state(page);
  const run = await playRun(page, { policy: t.policy, label: t.name, stopAfterDecisions: 1, shotPrefix: `7x-${t.name}`, shotKinds: new Set(['rule', 'preread', 'turn', 'hazard', 'checkpoint', 'restart', 'timedStart']), shotVerdict: true, rung: t.rung });
  const c = run.cards.find(x => x.phase === 'decision');
  found[t.name] = { kind: st?.kind, n: st?.n, of: st?.of, rule: run.cards.find(x => x.phase === 'rule')?.ruleId, prompt: c?.prompt, dad: c?.dad, action: c?.action, verdict: c?.verdict, onCardS: c?.cardWall, skipSeen: c?.skipSeen, note: c?.note, words: c?.words };
}
writeJson('s09-evidence', { found, errors: h.errors });
console.log(JSON.stringify({ found, errors: h.errors }, null, 1));
await h.close();

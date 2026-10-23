/**
 * PT-13 evidence (throwaway profile): reproduce and screenshot the verdict bugs found in sessions 1-2.
 *  A. a pause card whose printed "the chart says sit X s" is followed exactly (GO at X s) and graded wrong;
 *  B. a TA card answered by RULE-033 (claim the unrecoverable part, rounded down to 10 s) and graded wrong;
 *  C. the yellow "practise" button on Home while a run is unfinished: does it replace the run Continue would resume?
 * Practice runs are played with the oracle except on the two card kinds under test.
 */
process.env.PT13_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13-ev';
const { open, state, oracle, cardInfo, verdictInfo, tapEl, tapAtElapsed, shot, sleep, writeJson, BASE } = await import('./pt13-common.js');
const h = await open({ fresh: true }); const { page } = h;
const found: Record<string, unknown> = {}; const misc: unknown[] = [];
const parseIv = (s: string): number => { const m = /(\d+)m(\d\d)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
for (let r = 0; r < 12 && !(found.pause && found.ta); r++) {
  await page.goto(`${BASE}/?mode=mobile#/m/play/skill/${r % 2 ? 'recovery' : 'stayOnTime'}`);
  await page.waitForSelector('[data-screen=run], [data-screen=recap]');
  for (let i = 0; i < 80; i++) {
    const st = await state(page); if (!st) { await sleep(80); continue; }
    if (st.screen === 'recap') break;
    if (st.phase === 'rule') { await tapEl(page, '[data-action=ack]'); await sleep(60); continue; }
    if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(60); continue; }
    if (st.phase !== 'decision') { await sleep(60); continue; }
    const info = await cardInfo(page); const o = await oracle(page);
    const sit = /chart says sit ([\d.]+) s/.exec(info.prompt); const p15 = /Pause 15 s/.test(info.prompt);
    if (st.kind === 'pause' && sit && p15 && !found.pause && Math.abs(Number(sit[1]) - o.tapSeconds) > 1.0) {
      await shot(page, '70-pause15-card');
      await tapAtElapsed(page, '[data-action=go]', Number(sit[1]) + 0.05);
      await page.waitForSelector('[data-testid=verdict]'); await sleep(400);
      await shot(page, '71-pause15-verdict');
      found.pause = { prompt: info.prompt, chart: info.chartV, oracleTap: o.tapSeconds, verdict: await verdictInfo(page) };
      continue;
    }
    if (st.kind === 'ta' && !found.ta) {
      const m = /delayed (\d+m\d\ds)/.exec(info.prompt); const rec = /about (\d+) s of it could be made up/.exec(info.prompt);
      const want = Math.floor((parseIv(m![1]!) - Number(rec?.[1] ?? 0)) / 10) * 10;
      const pick = info.options.find(x => (want === 0 ? /No claim/.test(x.label) : parseIv(x.label) === want));
      if (pick && pick.id !== o.optionId) {
        await shot(page, '72-ta-card');
        await tapEl(page, `[data-option="${pick.id}"]`);
        await page.waitForSelector('[data-testid=verdict]'); await sleep(400);
        await shot(page, '73-ta-verdict');
        found.ta = { prompt: info.prompt, options: info.options.map(x => x.label), rule033: want, oracle: o.optionId, verdict: await verdictInfo(page) };
        continue;
      }
      misc.push({ taAgreed: info.prompt, want, oracle: o.optionId });
    }
    if (o?.optionId !== undefined && st.options.length) await tapEl(page, `[data-option="${o.optionId}"]`);
    else if (o?.taps) { await tapAtElapsed(page, '[data-action=startstop]', o.taps[0]); await tapAtElapsed(page, '[data-action=lap]', o.taps[1]); }
    else if (o?.tapSeconds !== undefined) await tapAtElapsed(page, '[data-action=go]', o.tapSeconds);
    await page.waitForSelector('[data-testid=verdict]');
  }
}
// C. unfinished run + the big yellow button
await page.goto(`${BASE}/?mode=mobile#/m/play/skill/safetyCourse`); await page.waitForSelector('[data-screen=run]');
let answered = 0;
for (let i = 0; i < 20 && answered < 2; i++) {
  const st = await state(page); if (!st) { await sleep(80); continue; }
  if (st.phase === 'rule') { await tapEl(page, '[data-action=ack]'); await sleep(60); continue; }
  if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(60); continue; }
  if (st.phase !== 'decision') { await sleep(60); continue; }
  const o = await oracle(page);
  if (o?.optionId !== undefined) await tapEl(page, `[data-option="${o.optionId}"]`); else if (o?.tapSeconds !== undefined) await tapAtElapsed(page, '[data-action=go]', o.tapSeconds);
  await page.waitForSelector('[data-testid=verdict]'); answered++;
}
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
const c1 = await page.locator('[data-testid=continue]').textContent({ timeout: 2000 }).catch(() => null);
const yellow = await page.locator('[data-testid=play-daily]').textContent();
await tapEl(page, '[data-testid=play-daily]'); await page.waitForSelector('[data-screen=run]');
const yellowRun = await state(page);
await sleep(500);
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
const c2 = await page.locator('[data-testid=continue]').textContent({ timeout: 2000 }).catch(() => null);
const unfinished = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1') ?? '{}').unfinished);
await page.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt13-74-home-after-yellow.png' });
let contRun: Awaited<ReturnType<typeof state>> = null;
if (c2) { await tapEl(page, '[data-testid=continue]'); await page.waitForSelector('[data-screen=run]'); await sleep(300); contRun = await state(page); }
found.continueVsYellow = { continueBefore: c1, yellow, yellowRunSkill: yellowRun?.kind, continueAfterYellow: c2, unfinishedAfterYellow: unfinished ? { mode: unfinished.plan?.mode, skills: unfinished.plan?.skills, responses: unfinished.responses?.length } : null, continueResumes: { kind: contRun?.kind, n: contRun?.n, answered: contRun?.answered } };
writeJson('s09-evidence', { found, misc, errors: h.errors });
console.log(JSON.stringify({ found, misc, errors: h.errors }, null, 1));
await h.close();

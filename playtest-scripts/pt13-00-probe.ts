/** PT-13 probe (throwaway profile): play practice runs with the oracle's answers to catalogue every card kind's text, options and facts. */
process.env.PT13_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13-probe';
const { open, state, oracle, cardInfo, verdictInfo, screenWords, tapEl, tapAtElapsed, writeJson, BASE, OUT } = await import('./pt13-common.js');
const h = await open({ fresh: true });
const { page } = h;
const cards: any[] = [];
const runs = Number(process.argv[2] ?? 3);
const route = process.argv[3] ?? 'practice';
for (let r = 0; r < runs; r++) {
  await page.goto(`${BASE}/?mode=mobile#/m/play/${route}`);
  await page.waitForSelector('[data-screen=run], [data-screen=recap]');
  for (let i = 0; i < 80; i++) {
    const st = await state(page); if (!st) { await page.waitForTimeout(100); continue; }
    if (st.screen === 'recap') break;
    if (st.phase === 'rule') { const w = await screenWords(page); cards.push({ run: r, type: 'rule', text: w.cardText, words: w.card }); await tapEl(page, '[data-action=ack]'); await page.waitForTimeout(50); continue; }
    if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await page.waitForFunction(() => (window as any).__rally.decision.state().phase !== 'verdict', null, { timeout: 30000 }); continue; }
    if (st.phase !== 'decision') { await page.waitForTimeout(50); continue; }
    const info = await cardInfo(page); const w = await screenWords(page); const o = await oracle(page);
    const t0 = Date.now();
    if (o?.optionId !== undefined && st.options.length) await tapEl(page, `[data-option="${o.optionId}"]`);
    else if (o?.taps) { await tapAtElapsed(page, '[data-action=startstop]', o.taps[0]); await tapAtElapsed(page, '[data-action=lap]', o.taps[1]); }
    else if (o?.tapSeconds !== undefined) await tapAtElapsed(page, '[data-action=go]', o.tapSeconds);
    const tTap = Date.now();
    await page.waitForSelector('[data-testid=verdict]', { timeout: 60000 });
    const v = await verdictInfo(page);
    cards.push({ run: r, type: 'decision', st, info, words: w.total, cardWords: w.card, oracle: o, verdict: v, answerMs: Date.now() - tTap, onCardMs: tTap - t0 });
  }
}
writeJson(`probe-${route}`, cards);
console.log(JSON.stringify(cards.map(c => c.type === 'rule' ? `RULE(${c.words}w) ${c.text.slice(0, 80)}` : `${c.st.kind} [${c.words}w] ${c.info.prompt} | opts=${c.info.options.map((o: any) => o.label).join(' / ')} | facts=${c.info.facts.join(', ')} | chart=${c.info.chart} | C=${c.info.rowC} | D=${c.info.rowD} | timing=${c.st.timing ? JSON.stringify(c.st.timing) : ''} => ${c.verdict.head} ${c.verdict.sec} :: ${c.verdict.detail} :: ${c.verdict.rule} (answer ${c.answerMs} ms)`), null, 1));
console.log('errors', h.errors);
await h.close();

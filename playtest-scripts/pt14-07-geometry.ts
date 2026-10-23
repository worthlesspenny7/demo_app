/** PT-14 geometry and words sweep (throwaway profiles, oracle answers at the oracle's second): every screen of three runs plus a skill
 *  run per skill at 390x844 and 360x780: horizontal scroll, text under 16 px, controls in the bottom 40 % and >= 56 px, tap targets,
 *  words on screen (two counters: visible text nodes as PT-13 counted, and innerText as e2e/mobile-helpers.ts counts), first decision. */
process.env.PT14_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt14-geo';
const { open, state, oracle, geometry, screenWords, tapEl, tapAtElapsed, writeJson, shot, sleep, BASE } = await import('./pt14-common.js');
const result: Record<string, unknown> = {};
const innerWords = (page: any): Promise<{ n: number; text: string }> => page.evaluate(() => { const t = (document.querySelector('.mob') as HTMLElement | null)?.innerText ?? ''; return { n: t.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length, text: t.replace(/\s+/g, ' ').slice(0, 400) }; });
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
  const h = await open({ fresh: true, viewport: vp }); const { page } = h;
  const t0 = Date.now();
  await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]'); const tHome = Date.now() - t0;
  const homeGeo = await geometry(page);
  await tapEl(page, '[data-testid=play-daily]');
  let tFirst = 0; const per: any[] = []; const kinds = new Set<string>();
  const routes = ['', '#/m/play/practice', '#/m/play/practice', '#/m/play/skill/safetyCourse', '#/m/play/skill/startOnTime', '#/m/play/skill/stayOnTime', '#/m/play/skill/recovery', '#/m/play/skill/instruments'];
  for (let run = 0; run < routes.length; run++) {
    if (run > 0) { await page.goto(`${BASE}/?mode=mobile${routes[run]}`); }
    await page.waitForSelector('[data-screen=run], [data-screen=confirm]');
    if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
    for (let i = 0; i < 80; i++) {
      const st = await state(page); if (!st) { await sleep(50); continue; }
      if (st.screen === 'recap') { const g = await geometry(page); per.push({ screen: 'recap', hscroll: g.hscroll, small: g.small, tiny: g.tiny, out: g.controls.filter(c => !c.inBottom40 && c.label !== '×').map(c => `${c.label}@${c.top}`) }); break; }
      if (st.phase === 'rule' || st.phase === 'verdict' || st.phase === 'decision') {
        const g = await geometry(page); const w = await screenWords(page); const iw = await innerWords(page);
        per.push({ phase: st.phase, kind: st.kind, hscroll: g.hscroll, small: g.small, tiny: g.tiny, minFont: g.minFont, controls: g.controls.filter(c => c.inBottom40).length, out: g.controls.filter(c => !c.inBottom40 && !/^×$|details|Chart|source/.test(c.label)).map(c => `${c.label}@${c.top}`), short: g.controls.filter(c => c.inBottom40 && c.height < 56).map(c => `${c.label} h${c.height}`), offscreen: g.controls.filter(c => c.bottom > g.vh + 1).map(c => c.label), words: w.total, inner: iw.n, text: iw.text });
        if (st.phase === 'decision' && st.kind && !kinds.has(st.kind)) { kinds.add(st.kind); if (vp.width === 360 && ['restart', 'speedChange', 'timedStart', 'watch', 'hazard', 'makeup'].includes(st.kind)) await shot(page, `60-360-${st.kind}`); }
      }
      if (st.phase === 'rule') { await tapEl(page, '[data-action=ack]'); await sleep(30); continue; }
      if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(30); continue; }
      if (st.phase !== 'decision') { await sleep(30); continue; }
      if (!tFirst) tFirst = Date.now() - t0;
      const o = await oracle(page);
      if (o?.optionId !== undefined && st.options.length) await tapEl(page, `[data-option="${o.optionId}"]`);
      else if (o?.taps) { await tapAtElapsed(page, '[data-action=startstop]', o.taps[0]); await tapAtElapsed(page, '[data-action=lap]', o.taps[1]); }
      else if (o?.tapSeconds !== undefined) await tapAtElapsed(page, '[data-action=go]', o.tapSeconds);
      await page.waitForSelector('[data-testid=verdict]');
    }
  }
  const bad = per.filter((p: any) => p.hscroll || p.small?.length || p.tiny?.length || p.out?.length || p.short?.length || p.offscreen?.length);
  const dec = per.filter(p => p.phase === 'decision'); const rules = per.filter(p => p.phase === 'rule');
  const byKind: Record<string, number[]> = {}; for (const p of dec) (byKind[p.kind] ??= []).push(p.inner);
  result[`${vp.width}x${vp.height}`] = { tHomeMs: tHome, tFirstDecisionMsInstantTaps: tFirst, homeGeo: { hscroll: homeGeo.hscroll, small: homeGeo.small, tiny: homeGeo.tiny, minFont: homeGeo.minFont }, screens: per.length, decisionScreens: dec.length, kinds: [...kinds], bad: bad.slice(0, 20), badCount: bad.length,
    wordsDecisionInner: { max: Math.max(...dec.map(p => p.inner)), over40: dec.filter(p => p.inner >= 40).length, median: dec.map(p => p.inner).sort((a, b) => a - b)[dec.length >> 1] }, wordsDecisionVisible: { max: Math.max(...dec.map(p => p.words)), over40: dec.filter(p => p.words >= 40).length, median: dec.map(p => p.words).sort((a, b) => a - b)[dec.length >> 1] },
    wordsRuleInner: { max: Math.max(...rules.map(p => p.inner)), over60: rules.filter(p => p.inner >= 60).length }, wordsRuleVisible: { max: Math.max(...rules.map(p => p.words)), over60: rules.filter(p => p.words >= 60).length }, byKindInner: byKind, minFont: Math.min(...per.filter(p => p.minFont).map(p => p.minFont)), samples: dec.filter(p => p.words >= 45).slice(0, 4).map(p => `${p.kind} visible ${p.words} inner ${p.inner}: ${p.text}`), errors: h.errors };
  await h.close();
}
writeJson('s07-geometry', result);
console.log(JSON.stringify(result, null, 1));

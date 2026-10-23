/** PT-13 geometry sweep (separate throwaway profile, oracle answers, instant taps): every screen at 390x844 and 360x780; machine time to first decision. */
process.env.PT13_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13-geo';
const { open, state, oracle, geometry, screenWords, tapEl, tapAtElapsed, writeJson, shot, sleep, BASE } = await import('./pt13-common.js');
const result: Record<string, unknown> = {};
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
  const h = await open({ fresh: true, viewport: vp }); const { page } = h;
  const t0 = Date.now();
  await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]'); const tHome = Date.now() - t0;
  const homeGeo = await geometry(page);
  await tapEl(page, '[data-testid=play-daily]');
  let tFirst = 0; const per: Record<string, unknown>[] = []; const kinds = new Set<string>();
  for (let run = 0; run < 3; run++) {
    if (run > 0) { await page.goto(`${BASE}/?mode=mobile#/m/play/practice`); }
    await page.waitForSelector('[data-screen=run]');
    for (let i = 0; i < 80; i++) {
      const st = await state(page); if (!st) { await sleep(50); continue; }
      if (st.screen === 'recap') { const g = await geometry(page); per.push({ screen: 'recap', hscroll: g.hscroll, small: g.small, tiny: g.tiny, out: g.controls.filter(c => !c.inBottom40 && c.label !== '×').map(c => `${c.label}@${c.top}`) }); break; }
      if (st.phase === 'rule' || st.phase === 'verdict' || st.phase === 'decision') {
        const g = await geometry(page); const w = await screenWords(page);
        per.push({ phase: st.phase, kind: st.kind, hscroll: g.hscroll, small: g.small, tiny: g.tiny, minFont: g.minFont, controls: g.controls.length, out: g.controls.filter(c => !c.inBottom40 && c.label !== '×').map(c => `${c.label}@${c.top}`), short: g.controls.filter(c => c.inBottom40 && c.height < 56).map(c => `${c.label} h${c.height}`), offscreen: g.controls.filter(c => c.bottom > g.vh + 1).map(c => c.label), words: w.total });
        if (st.phase === 'decision' && st.kind && !kinds.has(st.kind)) { kinds.add(st.kind); if (vp.width === 360 && (st.kind === 'restart' || st.kind === 'hazard')) await shot(page, `60-360-${st.kind}`); }
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
  result[`${vp.width}x${vp.height}`] = { tHomeMs: tHome, tFirstDecisionMsInstantTaps: tFirst, homeGeo: { hscroll: homeGeo.hscroll, small: homeGeo.small, tiny: homeGeo.tiny, minFont: homeGeo.minFont, aboveFold: homeGeo.controls.filter(c => c.bottom <= vp.height).map(c => c.label) }, screens: per.length, kinds: [...kinds], bad, errors: h.errors };
  await h.close();
}
writeJson('s07-geometry', result);
console.log(JSON.stringify(result, null, 1));

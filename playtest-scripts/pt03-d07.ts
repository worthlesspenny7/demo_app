/** PT-03 scenario 3: D07 calibration run (Bronze seed 1). Lap at every MILE sign, compare Column C with the laps, look for a speedo-factor control. */
import { launch, goto, shot, pause, adv, obs, text } from './common.js';
const log = (...a: unknown[]) => console.log(...a);

async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  await goto(page, '#/cockpit/drill/D07/0/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  log('D07 bar:', await text(page, '.drawer .bar .muted:last-child'));
  const rows = await page.evaluate(() => [...document.querySelectorAll('#book .row')].map(r => `${r.getAttribute('data-n')}: ${(r.querySelector('.text') as HTMLElement).innerText.replace(/\n/g, ' / ')} | C=${r.querySelector('.colc')?.textContent}`));
  for (const r of rows) log('  ', r);
  // any control for the speedo factor / cheat card in the cockpit?
  const controls = await page.evaluate(() => [...document.querySelectorAll('#cockpit button, #cockpit input, #cockpit select')].map(e => `${e.tagName}:${(e as HTMLElement).id || (e as HTMLInputElement).placeholder || e.textContent?.trim()}`));
  log('cockpit controls:', controls.join(' | '));
  log('mentions of factor/calibration/card in the cockpit DOM:', await page.evaluate(() => (document.querySelector('#cockpit') as HTMLElement).innerText.split('\n').filter(l => /factor|calibrat|cheat/i.test(l))));
  await adv(page, 56); await page.keyboard.press('d'); await adv(page, 4); await page.keyboard.press(' ');
  // drive: call 50 at the calibration start; lap at every MILE sign (as the bumper passes it: node event)
  const laps: { sign: string; lapReading: number; colC: string; perfectCum?: number }[] = [];
  const res = await page.evaluate(() => {
    const r = window.__rally; const o0 = r.observe(); const book = o0.book; const w = window as any; w.__seen = 0; const out: any[] = []; const called = new Set<number>(); let hold = false;
    for (let k = 0; k < 6000 && r.sim.phase !== 'finished'; k++) {
      const o = r.observe();
      for (const f of o.ahead) {
        if (f.kind === 'finish' && f.approxDistanceFt < 700 && !hold) { r.act({ type: 'call.stop' }); hold = true; }
        if (!f.nodeId) continue; const ins = book.find((b: any) => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 250) { r.act({ type: 'call.turn', dir: ins.turn }); called.add(ins.n); }
        if (ins.speed !== undefined && f.approxDistanceFt <= 100 && !called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); called.add(ins.n + 10000); }
      }
      const evs = r.sim.events; for (let i = w.__seen; i < evs.length; i++) { const e = evs[i]; if (e.type === 'node' && e.detail?.kind === 'sign') { const ins = book.find((b: any) => b.nodeId === e.detail?.nodeId); if (ins && /MILE|CALIBRATION/.test(ins.text)) { r.act({ type: 'watch.lap' }); const oo = r.observe(); out.push({ line: ins.n, text: ins.text, lap: oo.stopwatch.laps[oo.stopwatch.laps.length - 1], perfectCum: ins.perfectCumulative, tod: e.tod - oo.startTime }); } } } w.__seen = evs.length;
      if (o.driver.waitingForGo && o.driver.state.includes('stop')) { if (!w.__ws) w.__ws = o.tod; if (o.tod - w.__ws > 7) { r.act({ type: 'call.go' }); w.__ws = 0; } }
      r.advance(0.1);
      if (out.length === 3 && !w.__shot) { w.__shot = true; return { partial: true, out }; }
    }
    return { out, phase: r.sim.phase };
  });
  log('laps so far:', JSON.stringify(res.out));
  log('lap list in the instrument:', (await page.locator('#laps').innerText()).replace(/\n/g, ' '));
  log('stopwatch caption:', await text(page, '.instruments .instrument:nth-child(2) .caption'));
  log('book current row text (Col C perfect shown?):', await page.locator('#book .row.current').innerText());
  await shot(page, 'd07-calibration-laps');
  // digital split recall? press Shift+R while running -> crown refusal flash
  await page.keyboard.press('Shift+R'); await page.waitForTimeout(50); log('after Shift+R while running: alert chip =', await text(page, '#alert'), 'reading', (await obs(page)).stopwatch.reading);
  // note the computed factor on the lapboard as a navigator would
  const note = page.locator('.drawer input[type=text]'); await note.click(); await note.fill('k = perfect/actual, hold 50/k'); await note.press('Enter'); await page.locator('#view').focus();
  log('notes list:', (await page.locator('.drawer .box').nth(2).innerText()).replace(/\n/g, ' | '));
  const res2 = await page.evaluate(() => {
    const r = window.__rally; const book = r.observe().book; const w = window as any; const out: any[] = []; const called = new Set<number>([1, 10001]); let hold = false;
    for (let k = 0; k < 20000 && r.sim.phase !== 'finished'; k++) {
      const o = r.observe();
      for (const f of o.ahead) {
        if (f.kind === 'finish' && f.approxDistanceFt < 700 && !hold) { r.act({ type: 'call.stop' }); hold = true; }
        if (!f.nodeId) continue; const ins = book.find((b: any) => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 250) { r.act({ type: 'call.turn', dir: ins.turn }); called.add(ins.n); }
        if (ins.speed !== undefined && f.approxDistanceFt <= 100 && !called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); called.add(ins.n + 10000); }
      }
      const evs = r.sim.events; for (let i = w.__seen; i < evs.length; i++) { const e = evs[i]; if (e.type === 'node' && e.detail?.kind === 'sign') { const ins = book.find((b: any) => b.nodeId === e.detail?.nodeId); if (ins && /MILE/.test(ins.text)) { r.act({ type: 'watch.lap' }); const oo = r.observe(); out.push({ line: ins.n, lap: oo.stopwatch.laps[oo.stopwatch.laps.length - 1], perfectCum: ins.perfectCumulative, tod: e.tod - oo.startTime }); } } } w.__seen = evs.length;
      if (o.driver.waitingForGo && o.driver.state.includes('stop')) { if (!w.__ws) w.__ws = o.tod; if (o.tod - w.__ws > 7) { r.act({ type: 'call.go' }); w.__ws = 0; } }
      r.advance(0.1);
    }
    return { out, phase: r.sim.phase, hold };
  });
  log('rest of laps:', JSON.stringify(res2));
  await page.waitForSelector('#debrief', { timeout: 15000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 15000 });
  log('D07 headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'));
  log('D07 rubric:', (await page.locator('.debrief .panel').first().innerText()).replace(/\n/g, ' | '));
  log('tip:', await text(page, '#tip'));
  for (const w of await page.locator('#worked li').allInnerTexts()) log('  worked:', w);
  for (const c of await page.locator('#counterfactuals .cf-row').allInnerTexts()) log('  cf:', c.replace(/\n/g, ' | '));
  log('cp:', (await page.locator('#cp-table tbody tr').allInnerTexts()).join(' ; '));
  await shot(page, 'debrief-d07', true);
  log('page errors:', h.errors); log('console:', h.consoleErrors.slice(0, 10));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

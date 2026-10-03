/** PT-03 scenario 2: D04 Silver (rung 2: pace bar + countdown) and D18 Silver (rung 1: no aids). Aids per rung, line following, GO-time persistence, full D18 debrief. */
import { launch, goto, shot, pause, adv, obs, text } from './common.js';
import type { Page } from 'playwright';
const log = (...a: unknown[]) => console.log(...a);

/** In-page driver: turns, speeds, timed changes (from the node crossing), card dwell at stops, S before the finish. Steps `seconds` of sim time in 0.5 s ticks; returns when a condition fires. */
async function drive(page: Page, seconds: number, stopWhen: 'countdown' | 'waiting' | 'never' | 'timedDone' = 'never'): Promise<any> {
  return page.evaluate(({ seconds, stopWhen }) => {
    const r = window.__rally; if (!r) return { phase: 'gone' };
    const w = window as any; w.__called ??= new Set<number>(); w.__timers ??= []; w.__seenEv ??= 0; w.__waitSince ??= null; w.__hold ??= false;
    const book = r.observe().book; const car = r.sim.sc.car;
    const speeds = new Map<number, { vIn: number | null; vOut: number | null }>(); let v: number | null = null;
    for (const ins of book) { const vIn = v; if (ins.timed) v = ins.timed.holdSpeed; else if (typeof ins.speed === 'number') v = ins.speed; speeds.set(ins.n, { vIn, vOut: v }); if (ins.timed) v = ins.timed.thenSpeed; }
    let out: any = null;
    for (let k = 0; k < seconds * 2 && r.sim.phase !== 'finished'; k++) {
      const o = r.observe();
      // node crossings: schedule the timed change (ghost departure = crossing + pause; call at seconds - lead)
      const evs = r.sim.events; for (let i = w.__seenEv; i < evs.length; i++) { const e = evs[i]; if (e.type === 'node') { const ins = book.find((b: any) => b.nodeId === e.detail?.nodeId); if (ins?.timed) w.__timers.push({ at: e.tod + (ins.pause ?? 0) + ins.timed.seconds - 2.0, mph: ins.timed.thenSpeed, n: ins.n }); } } w.__seenEv = evs.length;
      for (const t of w.__timers.filter((t: any) => !t.done && o.tod >= t.at)) { r.act({ type: 'call.speed', mph: t.mph }); t.done = true; if (stopWhen === 'timedDone') out = { timed: t, tod: o.tod }; }
      for (const f of o.ahead) {
        if (f.kind === 'finish' && f.approxDistanceFt < 700 && !w.__hold) { r.act({ type: 'call.stop' }); w.__hold = true; }
        if (!f.nodeId) continue;
        const ins = book.find((b: any) => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !w.__called.has(ins.n) && f.approxDistanceFt < 250) { r.act({ type: 'call.turn', dir: ins.turn }); w.__called.add(ins.n); }
        if (ins.speed !== undefined && !ins.timed && f.approxDistanceFt <= 100 && !w.__called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); w.__called.add(ins.n + 10000); }
        if (ins.timed && f.approxDistanceFt <= 100 && !w.__called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.timed.holdSpeed }); w.__called.add(ins.n + 10000); }
      }
      if (o.driver.waitingForGo && o.driver.state.includes('stop')) {
        if (w.__waitSince === null) { w.__waitSince = o.tod; if (stopWhen === 'waiting') { out = { waitingAt: o.tod, line: o.currentLine }; return out; } }
        const line = book.find((b: any) => b.n === (o.driver.lastExecutedLine ?? 0) + 1) ?? book[o.currentLine - 1];
        const sp = speeds.get(line?.n ?? 0); const dwell = Math.max(0, (line?.pause ?? 15) - 8);
        if (o.tod - w.__waitSince >= dwell) { r.act({ type: 'call.go' }); w.__waitSince = null; }
      } else if (o.driver.waitingForGo && o.driver.state.includes('finish')) { /* stay */ }
      else w.__waitSince = null;
      if (stopWhen === 'countdown' && o.aids.countdown !== undefined && o.aids.countdown !== null && o.aids.countdown > 2 && o.aids.countdown < 12) return { countdown: o.aids.countdown, tod: o.tod };
      if (out) return out;
      r.advance(0.5);
    }
    return { phase: r.sim.phase, tod: r.observe().tod };
  }, { seconds, stopWhen });
}

async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  // ---------- D04 Silver ----------
  await goto(page, '#/cockpit/drill/D04/1/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  log('D04 drawer bar:', await text(page, '.drawer .bar .muted:last-child'));
  let o = await obs(page); log('D04 aids at preread:', JSON.stringify(o.aids), 'ledger box:', (await page.locator('.drawer .box').nth(0).innerText()).replace(/\n/g, ' | '));
  const rows = await page.evaluate(() => [...document.querySelectorAll('#book .row')].map(r => `${r.getAttribute('data-n')}: ${(r.querySelector('.text') as HTMLElement).innerText.replace(/\n/g, ' / ')} | C=${r.querySelector('.colc')?.textContent} | ann=${(r.querySelector('.ann') as HTMLElement).innerText.replace(/\n/g, ' ')}`));
  for (const r of rows) log('  ', r);
  // line following: N / Shift+N / click / Home / End
  await page.keyboard.press('n'); log('after N current =', await page.locator('#book .row.current').getAttribute('data-n'));
  await page.keyboard.press('n'); await page.keyboard.press('n'); log('after N N N current =', await page.locator('#book .row.current').getAttribute('data-n'));
  await page.keyboard.press('Shift+N'); log('after Shift+N current =', await page.locator('#book .row.current').getAttribute('data-n'));
  await page.keyboard.press('End'); log('after End current =', await page.locator('#book .row.current').getAttribute('data-n'));
  await page.keyboard.press('Home'); log('after Home current =', await page.locator('#book .row.current').getAttribute('data-n'));
  await page.locator('#book .row[data-n="5"] .text').click(); log('after click row 5 current =', await page.locator('#book .row.current').getAttribute('data-n'));
  // GO-time edits persist across re-renders
  const pauseRows = await page.evaluate(() => [...document.querySelectorAll('#book .row')].filter(r => r.querySelector('input.go-time')).map(r => Number(r.getAttribute('data-n'))));
  log('pause lines:', pauseRows);
  if (pauseRows.length) {
    const n = pauseRows[0]!; const inp = page.locator(`#book .row[data-n="${n}"] input.go-time`);
    await inp.click(); await inp.fill('8.2'); await inp.press('Enter');
    log('typed 8.2 on line', n, '-> engine annotations', JSON.stringify((await obs(page)).annotations), '| callout chip after typing digits in the box:', await text(page, '#callout'));
    await page.locator('#view').focus(); await page.keyboard.press('n'); await page.keyboard.press('n');
    log('after two N presses GO value =', await inp.inputValue());
    // highlight buttons
    await page.locator(`#book .row[data-n="${n}"] .hl-btn.pause`).click();
    log('row classes after highlight click:', await page.locator(`#book .row[data-n="${n}"]`).getAttribute('class'));
    await page.keyboard.press('Home');
  }
  await shot(page, 'd04-preread-book');
  // run
  { let q = await obs(page); await adv(page, Math.max(0, q.secondsToStart - 3)); await page.keyboard.press('d'); q = await obs(page); await adv(page, Math.max(0, q.secondsToStart)); await page.keyboard.press(' '); }
  const cd = await drive(page, 400, 'countdown'); log('D04 first countdown moment:', JSON.stringify(cd));
  o = await obs(page); log('aids now:', JSON.stringify(o.aids), '| ledger box:', (await page.locator('.drawer .box').nth(0).innerText()).replace(/\n/g, ' | '), '| perf card:', (await page.locator('.drawer .box').nth(1).innerText()).replace(/\n/g, ' | '));
  await shot(page, 'd04-countdown-aid');
  const st = await drive(page, 600, 'waiting'); log('D04 first stop:', JSON.stringify(st));
  o = await obs(page); log('at stop: current line', o.currentLine, 'lastExecuted', o.driver.lastExecutedLine, 'book current row:', await page.locator('#book .row.current').getAttribute('data-n'), '| perf card:', (await page.locator('.drawer .box').nth(1).innerText()).replace(/\n/g, ' | '));
  // scale: ask 8x while stopped -> must stay 1x
  await page.keyboard.press('Escape'); // resume
  await page.keyboard.press('.'); await page.keyboard.press('.'); await page.keyboard.press('.');
  await page.waitForTimeout(120); log('scale chip while waiting at a stop with 8x asked:', await text(page, '#scale'));
  await page.keyboard.press('Escape'); // pause again
  const fin = await drive(page, 1500); log('D04 finished?', JSON.stringify(fin));
  await page.waitForSelector('#debrief', { timeout: 15000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 15000 });
  log('D04 headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'));
  log('D04 rubric:', await page.locator('.debrief .pill').first().textContent(), '| tip:', await text(page, '#tip'));
  for (const w of await page.locator('#worked li').allInnerTexts()) log('  worked:', w);
  log('D04 cp:', (await page.locator('#cp-table tbody tr').allInnerTexts()).join(' ; '));
  await shot(page, 'debrief-d04', true);

  // ---------- D18 Silver (rung 1) ----------
  await goto(page, '#/cockpit/drill/D18/1/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  log('D18 drawer bar:', await text(page, '.drawer .bar .muted:last-child'));
  o = await obs(page); log('D18 aids at preread:', JSON.stringify(o.aids), '| legIndex', o.legIndex, '| chip leg:', await page.locator('.hud .chip').nth(2).textContent());
  const rows18 = await page.evaluate(() => [...document.querySelectorAll('#book .row')].map(r => `${r.getAttribute('data-n')}: ${(r.querySelector('.text') as HTMLElement).innerText.replace(/\n/g, ' / ')} | C=${r.querySelector('.colc')?.textContent} | ann=${(r.querySelector('.ann') as HTMLElement).innerText.replace(/\n/g, ' ')}`));
  for (const r of rows18) log('  ', r);
  { let q = await obs(page); await adv(page, Math.max(0, q.secondsToStart - 3)); await page.keyboard.press('d'); q = await obs(page); await adv(page, Math.max(0, q.secondsToStart)); await page.keyboard.press(' '); }
  const t18 = await drive(page, 500, 'timedDone'); log('D18 timed change called:', JSON.stringify(t18));
  o = await obs(page); log('D18 aids mid-run:', JSON.stringify(o.aids), '| ledger box:', (await page.locator('.drawer .box').nth(0).innerText()).replace(/\n/g, ' | '));
  await shot(page, 'd18-midrun-no-aids');
  // at rung 1 the book does not auto-advance: does the navigator have to press N? check current vs lastExecuted
  log('D18 currentLine', o.currentLine, 'lastExecuted', o.driver.lastExecutedLine, 'book current row', await page.locator('#book .row.current').getAttribute('data-n'));
  const fin18 = await drive(page, 1500); log('D18 finished?', JSON.stringify(fin18));
  await page.waitForSelector('#debrief', { timeout: 15000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 15000 });
  log('D18 headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'));
  log('D18 rubric:', await page.locator('.debrief .pill').first().textContent(), '| tip:', await text(page, '#tip'));
  for (const w of await page.locator('#worked li').allInnerTexts()) log('  worked:', w);
  log('D18 cp:', (await page.locator('#cp-table tbody tr').allInnerTexts()).join(' ; '));
  for (const c of await page.locator('#counterfactuals .cf-row').allInnerTexts()) log('  cf:', c.replace(/\n/g, ' | '));
  log('D18 bars legend:', (await page.locator('.bars .legend').innerText()).replace(/\n/g, ' | '));
  log('D18 transcript head:', (await page.locator('details pre').innerText()).split('\n').slice(0, 5).join(' // '));
  await shot(page, 'debrief-d18', true);
  await goto(page, '#/'); log('home D18 card:', (await page.locator('.card[data-drill="D18"]').innerText()).replace(/\n/g, ' | '));
  log('page errors:', h.errors); log('console:', h.consoleErrors.slice(0, 10));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

/** PT-03 scenario 1: D03 Bronze seed 1 end to end, played like a navigator (depart early, bezel = card dwell, G on the index). */
import { launch, goto, shot, pause, adv, obs, text, autoDrive } from './common.js';

const log = (...a: unknown[]) => console.log(...a);

async function main(): Promise<void> {
  const h = await launch();
  const { page } = h;
  await goto(page, '#/cockpit/drill/D03/0/1');
  await page.waitForSelector('#cockpit');
  await page.locator('#view').focus();
  log('preread chip:', await text(page, '#phase'), '| scale chip:', await text(page, '#scale'));
  log('book head:', await text(page, '.book-head'));
  const rowsN = await page.locator('#book .row').count(); log('book rows:', rowsN);
  await shot(page, 'd03-preread');
  // pause the wall clock so every second below is sim time
  await pause(page);
  log('after Esc scale chip:', await text(page, '#scale'));
  let o = await obs(page);
  log('secondsToStart at open:', o.secondsToStart, 'startTime', o.startTime, 'tod', o.tod);
  // mark GO times in the pre-read like a navigator: read the "card X s" numbers of every pause line
  const cards = await page.evaluate(() => [...document.querySelectorAll('#book .row')].map(r => ({ n: r.getAttribute('data-n'), text: (r.querySelector('.text') as HTMLElement)?.innerText, colc: r.querySelector('.colc')?.textContent, ann: (r.querySelector('.ann') as HTMLElement)?.innerText })));
  for (const c of cards) log(`  line ${c.n}: ${JSON.stringify(c.text)} C=${c.colc} ann=${JSON.stringify(c.ann)}`);
  // type a GO time in the first pause line's box
  const firstPause = cards.find(c => c.ann && c.ann.includes('card'));
  if (firstPause) {
    const inp = page.locator(`#book .row[data-n="${firstPause.n}"] input.go-time`);
    await inp.click(); await inp.fill('7.5'); await inp.press('Enter');
    log('GO-time typed on line', firstPause.n, 'value now', await inp.inputValue(), '| sim annotations:', JSON.stringify((await obs(page)).annotations));
    await page.locator('#view').focus();
  }
  await adv(page, 56); o = await obs(page);
  log('T-', o.secondsToStart, 'countdown text:', await text(page, '#countdown'));
  await page.keyboard.press('d');
  o = await obs(page); log('after D: phase', o.phase, 'secondsToStart', o.secondsToStart, 'preread visible?', await page.locator('#preread').isVisible(), 'driver state', o.driver.state);
  const departTod = o.tod;
  await adv(page, o.secondsToStart); // official second
  await page.keyboard.press(' ');
  o = await obs(page); log('Space at official second: watch running', o.stopwatch.running, 'reading', o.stopwatch.reading, 'tod-start', (o.tod - o.startTime).toFixed(2), 'speedo', o.speedo.reading);
  log('departed early by', (o.startTime - departTod).toFixed(1), 's');

  // the leg: drive at 0.5 s steps, call turns and speeds as features appear, handle every stop by hand
  const stops: { line: number | null; cardDwell: number | null; perfCardDwell: string; bezelSet: number; waitTod: number; goTod: number; bezelRemainingAtGo: number; readingAtGo: number }[] = [];
  const called = new Set<number>();
  let stopShot = false; let guard = 0;
  while (guard++ < 4000) {
    o = await obs(page);
    if (o.phase === 'finished') break;
    for (const f of o.ahead) {
      if (!f.nodeId) continue;
      const ins = o.book.find((b: any) => b.nodeId === f.nodeId); if (!ins) continue;
      if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 900) {
        const key = ins.turn === 'L' ? 'ArrowLeft' : ins.turn === 'R' ? 'ArrowRight' : 'ArrowUp';
        await page.keyboard.press(key); called.add(ins.n);
        log(`  t+${(o.tod - o.startTime).toFixed(1)} called turn ${ins.turn} for line ${ins.n} at ${Math.round(f.approxDistanceFt)} ft; callout: ${await text(page, '#callout')}`);
      }
      if (ins.speed !== undefined && f.approxDistanceFt <= 120 && !called.has(ins.n + 10000)) {
        await page.keyboard.type(String(ins.speed)); await page.keyboard.press('Enter'); called.add(ins.n + 10000);
      }
    }
    if (o.driver.waitingForGo) {
      const waitTod = o.tod;
      let cur = Number(await page.locator('#book .row.current').getAttribute('data-n'));
      let ann = await text(page, '#book .row.current .ann');
      if (!/card/.test(ann)) { log(`  !! book current line ${cur} is not the pause line while waiting at the STOP (perf card shows the wrong line); reading the next line as a navigator would`); const nxt = page.locator(`#book .row[data-n="${cur + 1}"] .ann`); ann = (await nxt.textContent() ?? '').trim(); cur = cur + 1; }
      const perfCard = await page.locator('.drawer .box').nth(1).innerText();
      const m = /card ([\d.]+) s/.exec(ann); const cardDwell = m ? Number(m[1]) : null;
      const pm = /dwell ([\d.]+) s/.exec(perfCard);
      const dwell = cardDwell ?? (pm ? Number(pm[1]) : 8);
      // bezel: rotate the index to (hand + dwell)
      const pos = o.stopwatch.reading % 60; const target = ((pos + dwell) % 60 + 60) % 60;
      let delta = ((target - o.stopwatch.bezel) % 60 + 60) % 60; if (delta > 30) delta -= 60;
      const whole = Math.trunc(delta); const frac = Math.round((delta - whole) * 5); // 0.2 s steps
      for (let i = 0; i < Math.abs(whole); i++) await page.keyboard.press(whole > 0 ? ']' : '[');
      for (let i = 0; i < Math.abs(frac); i++) await page.keyboard.press(frac > 0 ? 'Shift+]' : 'Shift+[');
      o = await obs(page);
      log(`STOP line ${cur}: ann="${ann}" perfCard="${perfCard.replace(/\n/g, ' | ')}" -> dwell ${dwell}; hand ${pos.toFixed(1)} bezel now ${o.stopwatch.bezel.toFixed(1)} remaining ${o.stopwatch.bezelRemaining.toFixed(1)}; caption: ${await text(page, '.instruments .instrument:nth-child(2) .caption')}`);
      if (!stopShot) { await shot(page, 'cockpit-stop-bezel'); stopShot = true; }
      // wait for the hand to reach the index, then G
      let k = 0;
      while (k++ < 400) { o = await obs(page); if (o.stopwatch.bezelRemaining <= 0.1 || o.stopwatch.bezelRemaining > 59) break; if (!o.driver.waitingForGo) { log('  !! driver left before the count (patience?)', o.driver.state); break; } await adv(page, 0.1); }
      const before = await obs(page);
      await page.keyboard.press('g');
      o = await obs(page);
      stops.push({ line: cur, cardDwell, perfCardDwell: pm ? pm[1]! : '?', bezelSet: before.stopwatch.bezel, waitTod, goTod: o.tod, bezelRemainingAtGo: before.stopwatch.bezelRemaining, readingAtGo: before.stopwatch.reading });
      log(`  G at reading ${before.stopwatch.reading.toFixed(1)} (remaining ${before.stopwatch.bezelRemaining.toFixed(1)}); waited ${(o.tod - waitTod).toFixed(1)} s; driver now ${o.driver.state}; waitingForGo=${o.driver.waitingForGo}; log: ${(await page.locator('#driverlog').innerText()).split('\n').slice(-2).join(' / ')}`);
      if (stops.length === 2) await shot(page, 'book-midrun');
      if (stops.length === 3) await shot(page, 'lapboard-drawer');
    }
    await adv(page, 0.5);
    if ((await obs(page)).phase === 'finished') break;
  }
  if ((await obs(page)).phase !== 'finished') { log('manual loop did not finish; autodriving the rest'); await autoDrive(page); }
  await page.waitForSelector('#debrief', { timeout: 15000 });
  await page.waitForSelector('#counterfactuals .cf-row', { timeout: 15000 });
  log('hash now', await page.evaluate(() => location.hash));
  log('headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'));
  log('rubric:', await page.locator('.debrief .pill').first().textContent());
  const cp = await page.locator('#cp-table tbody tr').allInnerTexts(); log('cp table:', cp);
  log('tip:', await text(page, '#tip'));
  const worked = await page.locator('#worked li').allInnerTexts();
  for (const w of worked) log('  worked:', w);
  log('my stops:');
  for (const s of stops) log(`  line ${s.line}: card ${s.cardDwell} / perfcard ${s.perfCardDwell}; waited ${(s.goTod - s.waitTod).toFixed(1)} s (G at remaining ${s.bezelRemainingAtGo.toFixed(1)})`);
  const cf = await page.locator('#counterfactuals .cf-row').allInnerTexts(); for (const c of cf) log('  cf:', c.replace(/\n/g, ' | '));
  const ledger = await page.locator('.debrief .panel h3:has-text("ledger")').locator('..').innerText(); log('ledger panel:', ledger.replace(/\n/g, ' | '));
  const bias = await page.locator('.debrief .panel h3:has-text("Bias")').locator('..').innerText(); log('bias panel:', bias.replace(/\n/g, ' | ').slice(0, 600));
  await shot(page, 'debrief-d03', true);
  // Home: stars saved?
  await goto(page, '#/');
  log('home D03 card:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '));
  log('home last runs:', await page.locator('.page > p.muted').nth(1).textContent());
  await shot(page, 'home-after-d03');
  // Retry and Next seed from the debrief
  await goto(page, '#/debrief');
  await page.locator('#retry').click(); await page.waitForTimeout(200);
  log('after Retry: hash', await page.evaluate(() => location.hash), 'cockpit visible', await page.locator('#cockpit').isVisible());
  page.once('dialog', d => d.accept());
  await page.locator('button:has-text("End run")').click();
  await page.waitForSelector('#debrief', { timeout: 10000 });
  log('after End run in preread: debrief headline', await text(page, '.debrief .headline'), '| cp rows', await page.locator('#cp-table tbody tr').count(), '| worked', (await page.locator('#worked li').allInnerTexts()).join(' / '));
  await shot(page, 'debrief-aborted-preread', true);
  await page.locator('#next').click(); await page.waitForTimeout(200);
  log('after Next seed: hash', await page.evaluate(() => location.hash), 'book head', await text(page, '.book-head'));
  await goto(page, '#/');
  log('home D03 card after abort:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '));
  log('page errors:', h.errors); log('console errors:', h.consoleErrors.slice(0, 10));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

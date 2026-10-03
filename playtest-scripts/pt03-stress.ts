/** PT-03 scenario 7: stress. Rapid keys, resize, reload mid-run, debrief with no run, back/forward, End run mid-leg, pause/resume, 8x through a stop, E/T prompts, preread overlay vs HUD. */
import { launch, goto, shot, pause, adv, obs, text, autoDrive } from './common.js';
const log = (...a: unknown[]) => console.log(...a);

async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  // debrief with no run (fresh context)
  await goto(page, '#/debrief'); log('debrief no run:', (await page.locator('#view').innerText()).replace(/\n/g, ' | '));
  await goto(page, '#/cockpit/drill/NOPE/0/1'); log('bad drill route:', (await page.locator('#view').innerText()).replace(/\n/g, ' | ').slice(0, 120));
  await goto(page, '#/cockpit/bogus'); log('bogus cockpit route -> h1:', await text(page, 'h1'));
  await goto(page, '#/quiz/D03'); log('quiz with a drive drill id -> h1:', await text(page, 'h1'));
  // preread overlay vs HUD buttons
  await goto(page, '#/cockpit/builtin/varied/3'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus();
  const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('.hud button')].find(x => x.textContent === 'End run') as HTMLElement; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `${e?.tagName}.${(e as HTMLElement)?.className} (button at ${Math.round(r.x)},${Math.round(r.y)})`; });
  log('element under the End run button during pre-read:', hit);
  const hit2 = await page.evaluate(() => { const b = document.querySelector('#pause') as HTMLElement; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + 2, r.y + 2); return `${e?.tagName}#${e?.id}.${(e as HTMLElement)?.className}`; });
  log('element under the Pause button during pre-read:', hit2);
  // E / T prompts
  await pause(page); await page.keyboard.press('e'); log('E -> prompt input present:', await page.locator('#prompt input').count(), 'placeholder:', await page.locator('#prompt input').getAttribute('placeholder'));
  await page.keyboard.type('g5'); log('typed "g5" into the ledger prompt -> did G leak as a go call? driver log:', (await page.locator('#driverlog').innerText()).replace(/\n/g, ' / '));
  await page.keyboard.press('Enter'); log('after Enter on "g5": ledger =', (await obs(page)).ledger, '| prompt still open:', await page.locator('#prompt input').count());
  await page.keyboard.press('e'); await page.keyboard.type('-4'); await page.keyboard.press('Enter'); log('ledger -4 ->', (await obs(page)).ledger, '| ledger box:', (await page.locator('.drawer .box').nth(0).innerText()).split('\n')[1]);
  await page.keyboard.press('t'); await page.keyboard.type('12'); await page.keyboard.press('Escape'); log('T then Esc -> prompt closed:', (await page.locator('#prompt input').count()) === 0, '| paused chip:', await text(page, '#scale'));
  await page.keyboard.press('t'); await page.keyboard.type('12'); await page.keyboard.press('Enter'); log('TA 12 before the start -> alert chip:', await text(page, '#alert'), '| driver log tail:', (await page.locator('#driverlog').innerText()).split('\n').slice(-1)[0]);
  // digits + Esc: Esc clears the buffer rather than pausing
  await page.keyboard.type('35'); log('buffer callout:', await text(page, '#callout')); await page.keyboard.press('Escape'); log('after Esc with buffer: callout =', await text(page, '#callout'), '| scale chip =', await text(page, '#scale'));
  // rapid keys
  await page.locator('#skip').click(); await page.keyboard.press('d'); await page.keyboard.press(' ');
  const keysPool = [' ', 'l', 'g', 's', 'n', 'Shift+N', '[', ']', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '3', '5', 'Enter', 'b', 'a', 'j', 'u', 'p', 'Home', 'End', '.', ',', 'Backspace'];
  const t0 = Date.now(); for (let i = 0; i < 300; i++) await page.keyboard.press(keysPool[(i * 7) % keysPool.length]!, { delay: 0 }); log(`300 rapid keys in ${Date.now() - t0} ms; errors so far:`, h.errors.length, '| callout:', await text(page, '#callout'), '| modifiers stuck?', await page.evaluate(() => document.querySelector('#callout')?.textContent));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); // clear buffer, then pause
  let o = await obs(page); log('state after burst: phase', o.phase, 'line', o.currentLine, 'watch running', o.stopwatch.running, 'laps', o.stopwatch.laps.length, 'bezel', o.stopwatch.bezel, 'target', o.driver.targetIndicated, 'pending', o.driver.pendingTurn);
  // held modifier stuck test: press B down, then release outside focus
  await page.keyboard.down('b'); await page.keyboard.press('ArrowLeft'); log('B+Left callout:', await text(page, '#callout')); await page.keyboard.up('b'); log('after B up:', await text(page, '#callout'));
  // pause / resume with wall clock
  await page.keyboard.press('Escape'); // make sure we are paused? (toggle) check chip
  let chip = await text(page, '#scale'); if (!chip.includes('PAUSED')) await page.keyboard.press('Escape');
  const todA = (await obs(page)).tod; await page.waitForTimeout(600); const todB = (await obs(page)).tod; log('paused: tod moved', (todB - todA).toFixed(2), 's over 0.6 s wall; chip', await text(page, '#scale'), '| pause button label:', await text(page, '#pause'));
  await page.locator('#pause').click(); await page.waitForTimeout(600); const todC = (await obs(page)).tod; log('resumed via button: tod moved', (todC - todB).toFixed(2), 's over 0.6 s wall; chip', await text(page, '#scale'));
  // 8x through a stop (real time): ask 8x, watch the chip as the car nears the first STOP
  await page.keyboard.press('.'); await page.keyboard.press('.'); await page.keyboard.press('.');
  const trace: string[] = []; let lastChip = ''; let sawOne = false; let sawWait = false;
  for (let i = 0; i < 400; i++) {
    const c = await text(page, '#scale'); const oo = await obs(page); const near = oo.ahead?.length ? Math.round(Math.min(...oo.ahead.map((f: any) => f.approxDistanceFt))) : null;
    if (c !== lastChip) { trace.push(`t+${((oo.tod ?? 0) - (oo.startTime ?? 0)).toFixed(0)}s nearest=${near}ft -> "${c}" state=${oo.driver?.state}`); lastChip = c; }
    if (c.startsWith('1x')) sawOne = true;
    if (oo.driver?.waitingForGo) { sawWait = true; if (!trace.some(t => t.includes('WAITING'))) trace.push(`WAITING at t+${(oo.tod - oo.startTime).toFixed(0)} chip "${c}"`); await page.waitForTimeout(400); await page.keyboard.press('g'); }
    if (oo.phase === 'finished') break;
    if (sawWait && c.startsWith('8x')) { trace.push(`back to 8x at t+${(oo.tod - oo.startTime).toFixed(0)}`); break; }
    await page.waitForTimeout(100);
  }
  log('8x scale trace:'); for (const t of trace) log('   ', t); log('saw 1x:', sawOne, 'saw a stop:', sawWait);
  await pause(page);
  // End run mid-leg
  page.once('dialog', d => d.accept()); await page.locator('button:has-text("End run")').click(); await page.waitForSelector('#debrief', { timeout: 10000 });
  log('End run mid-leg -> debrief headline:', await text(page, '.debrief .headline'), '| muted:', await text(page, '.debrief .panel p.muted'), '| cp rows:', await page.locator('#cp-table tbody tr').count(), '| tip:', await text(page, '#tip'));
  log('worked after abort:', (await page.locator('#worked li').allInnerTexts()).slice(0, 3));
  await page.waitForSelector('#counterfactuals .cf-row, #counterfactuals .muted', { timeout: 15000 }); log('cf after abort:', (await page.locator('#counterfactuals').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await shot(page, 'debrief-aborted-midleg', true);
  await goto(page, '#/'); log('home after aborted builtin run, last runs:', await page.locator('.page > p.muted').nth(1).textContent());
  // back / forward
  await goto(page, '#/cockpit/builtin/onestop/1'); await page.waitForSelector('#cockpit'); await page.locator('#skip').click(); await page.keyboard.press('d');
  await page.goBack(); await page.waitForTimeout(200); log('after back: hash', await page.evaluate(() => location.hash), '| __rally present:', await page.evaluate(() => !!window.__rally), '| body.in-cockpit:', await page.evaluate(() => document.body.classList.contains('in-cockpit')), '| h1:', await text(page, 'h1'));
  await page.goForward(); await page.waitForTimeout(200); log('after forward: hash', await page.evaluate(() => location.hash), '| cockpit:', await page.locator('#cockpit').count(), '| phase:', (await obs(page)).phase, '(fresh preread = the run was lost)');
  // reload mid-run
  await page.locator('#skip').click(); await page.keyboard.press('d'); await adv(page, 30); await page.reload(); await page.waitForTimeout(300);
  log('after reload mid-run: hash', await page.evaluate(() => location.hash), '| phase:', (await obs(page)).phase, '| any warning text?', (await page.locator('#view').innerText()).includes('lost'));
  await goto(page, '#/debrief'); log('debrief after reload:', (await page.locator('#view').innerText()).replace(/\n/g, ' | ').slice(0, 80));
  log('page errors:', h.errors); log('console:', h.consoleErrors.slice(0, 10));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

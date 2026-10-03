/** PT-03 probe: false storage banner, keyboard focus traps after using the mouse, Next seed / Retry, pre-read overlay vs HUD buttons. */
import { launch, goto, shot, adv, obs, text, autoDrive } from './common.js';
const log = (...a: unknown[]) => console.log(...a);
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  for (const r of ['#/cockpit/builtin/onestop/1', '#/school', '#/settings', '#/reference', '#/']) {
    await page.goto('about:blank'); await goto(page, r);
    log('banner on direct load of', r, '=>', JSON.stringify(await text(page, '#navnote')));
  }
  await goto(page, '#/cockpit/builtin/onestop/1'); await page.waitForSelector('#cockpit');
  log('banner after cockpit then Home click:'); await page.locator('a[data-nav="#/"]').click(); log('  ', JSON.stringify(await text(page, '#navnote')));
  // pre-read overlay vs HUD
  await goto(page, '#/cockpit/builtin/onestop/1'); await page.waitForSelector('#preread');
  const cover = await page.evaluate(`(() => { const out = {}; for (const b of document.querySelectorAll('.hud button')) { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); out[b.textContent] = e === b ? 'ok' : (e ? e.tagName + '.' + e.className : 'none'); } return out; })()`);
  log('HUD button hit-test during pre-read:', JSON.stringify(cover));
  await shot(page, 'preread-hud-covered');
  await page.locator('#skip').click(); await page.keyboard.press('d');
  const hit2 = await page.evaluate(`(() => { const out = {}; for (const b of document.querySelectorAll('.hud button')) { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); out[b.textContent] = e === b ? 'ok' : (e ? e.tagName + '.' + e.className : 'none'); } return out; })()`);
  log('HUD button hit-test while running:', JSON.stringify(hit2));
  // focus traps
  await page.locator('#pause').click(); log('after clicking Pause: chip', await text(page, '#scale'), '| focused:', await page.evaluate(() => document.activeElement?.tagName + '#' + (document.activeElement as HTMLElement)?.id));
  await page.keyboard.press(' '); log('Space with Pause button focused -> stopwatch running:', (await obs(page)).stopwatch.running, '| chip', await text(page, '#scale'));
  await page.keyboard.press(' '); log('Space again -> stopwatch running:', (await obs(page)).stopwatch.running, '| chip', await text(page, '#scale'));
  await page.keyboard.press('Enter'); log('Enter with Pause button focused -> laps', (await obs(page)).stopwatch.laps.length, '| chip', await text(page, '#scale'));
  await page.locator('#view').focus();
  const note = page.locator('.drawer input[type=text]'); await note.click(); await note.fill('cp at 3:00'); await note.press('Enter');
  const w0 = (await obs(page)).stopwatch.running; await page.keyboard.press(' ');
  log('after note Enter, Space -> watch running before/after:', w0, (await obs(page)).stopwatch.running, '| note input value now:', JSON.stringify(await note.inputValue()), '| active:', await page.evaluate(() => document.activeElement?.tagName));
  await page.keyboard.press('Escape'); await page.keyboard.press(' '); log('after Esc then Space -> running:', (await obs(page)).stopwatch.running);
  // GO input focus trap
  await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForSelector('#preread');
  const go = page.locator('#book input.go-time').first(); await go.click(); await go.fill('7'); 
  await page.keyboard.press('d'); log('typing d in GO box -> preread still there?', await page.locator('#preread').isVisible(), '| box value', await go.inputValue());
  await go.press('Enter'); await page.keyboard.press('d'); log('Enter in GO box then d -> preread visible?', await page.locator('#preread').isVisible());
  // tab order: tab from body
  // Debrief Retry / Next seed
  log('autoDrive ->', await autoDrive(page));
  await page.waitForSelector('#debrief', { timeout: 15000 });
  await page.locator('#next').click(); await page.waitForTimeout(300);
  log('Next seed ->', await page.evaluate(() => location.hash), '| cockpit:', await page.locator('#cockpit').isVisible(), '| book head:', await text(page, '.book-head'));
  await page.locator('#skip').click(); await page.keyboard.press('d'); log('autoDrive2 ->', await autoDrive(page)); await page.waitForSelector('#debrief', { timeout: 15000 });
  log('debrief of unattended run: headline:', await text(page, '.debrief .headline'));
  await page.locator('#retry').click(); await page.waitForTimeout(300);
  log('Retry ->', await page.evaluate(() => location.hash), '| cockpit', await page.locator('#cockpit').isVisible(), '| phase', (await obs(page)).phase);
  await page.goBack(); await page.waitForTimeout(300); log('Back from retried cockpit ->', await page.evaluate(() => location.hash));
  await page.goBack(); await page.waitForTimeout(300); log('Back again ->', await page.evaluate(() => location.hash), '| body text start:', (await page.locator('#view').innerText()).slice(0, 60).replace(/\n/g, ' '));
  log('errors', h.errors);
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

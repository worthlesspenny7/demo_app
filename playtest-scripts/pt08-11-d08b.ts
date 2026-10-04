/** PT-08 step 11 (copy of pt07-03; N2 TA credit, N11 T focus, N12 Done with a claim pending; PT08_DONEFIRST=1 presses Done before filing). PT-07 step 3 (copy of pt05-06 plus the Done-button geometry check): D08b at Bronze: the train, the red light, the ledger/make-up box and the 2026 TA web form, played as Josh would after
 *  reading lesson 2 (Four S's) and the rally-school lesson: lap the watch when the wheels stop and when they roll, put the delay in the
 *  ledger (E), make up the light with the 10 % rule, and at the TA point open the form (T) and fill it from the helper line. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv, type } from './pt08-common.js';
import { playHuman } from './pt08-human.js';
const DONEFIRST = !!process.env.PT08_DONEFIRST;
const F = DONEFIRST ? '11-d08b-donefirst.txt' : '11-d08b.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/cockpit/drill/D08b/0/1'); await hold(page);
log(F, 'preread: ' + await txt(page, '#preread'));
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as const;
let first = true; let o: any;
for (let round = 0; round < 12; round++) {
  const r = await playHuman(page, { ...base, keepState: !first, until: "o.driver.state === 'waiting:train' || o.driver.state === 'waiting:signal' || (o.ta && o.ta.windowOpen && !S.taDone)" });
  first = false;
  o = await obs(page); if (!o || o.phase === 'finished' || r.finished) break;
  log(F, `\n== hold: ${o.driver.state} tod ${o.tod.toFixed(1)} line ${o.currentLine}; ta ${JSON.stringify(o.ta).slice(0, 300)}`);
  if (o.driver.state === 'waiting:train' || o.driver.state === 'waiting:signal') {
    const kind = o.driver.state.split(':')[1];
    await page.keyboard.press('l'); const t0 = o.tod;   // lap when the wheels stop
    log(F, 'driver: ' + (await txt(page, '#driverlog')).split('\n').slice(-4).join(' / ') + '\nledgerbox: ' + await txt(page, '#ledgerbox'));
    // wait until the car rolls (the driver goes by himself when the gate lifts / green?) - press G if Dad asks
    for (let i = 0; i < 3000; i++) { o = await obs(page); if (!o.driver.waitingForGo) break; if (/Going\?|green/i.test((await txt(page, '#driverlog')).split('\n').slice(-1)[0] ?? '') && o.ahead.every((f: any) => !f.gateDown && f.signalColor !== 'red')) { await page.keyboard.press('g'); } await adv(page, 0.5); }
    await page.keyboard.press('l'); o = await obs(page);
    const delay = Math.round(o.tod - t0);
    log(F, `${kind}: stopped ${delay} s (lapped); watch: ${(await txt(page, '#stopwatch')).replace(/\n/g, ' ')}`);
    // ledger: E then the seconds late
    await page.keyboard.press('e'); await adv(page, 0.1);
    log(F, 'after E prompt: ' + await txt(page, '#prompt'));
    await type(page, String(delay)); await page.keyboard.press('Enter'); await adv(page, 0.2);
    log(F, 'ledgerbox after E: ' + await txt(page, '#ledgerbox'));
    
    if (kind === 'signal') {
      // make up with +10 %: read the makeup table and drive 38.5 for 10 x the seconds owed (a chunk of a minute at a time)
      const mk = await txt(page, '#makeup'); log(F, 'makeup box: ' + mk);
      const v = o.driver.targetIndicated ?? 35; const fast = Math.round(v * 1.1 * 10) / 10;
      await type(page, String(fast)); await page.keyboard.press('Enter');
      await adv(page, Math.min(10 * delay, 120));
      await type(page, String(v)); await page.keyboard.press('Enter');
      await page.locator('#makeup-chunk').fill(String(Math.round(Math.min(10 * delay, 120) / 10))).catch(() => {});
      await page.locator('#makeup-log').click().catch(() => {});
      await adv(page, 0.2); log(F, 'after make-up chunk: ' + await txt(page, '#ledgerbox'));
    }
  } else if (o.ta?.windowOpen) {
    await page.evaluate(() => { (window as any).__HS.taDone = true; });
    await page.keyboard.press('t'); await adv(page, 0.2);
    log(F, 'N11 focus after T: ' + await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || document.activeElement?.tagName));
    if (DONEFIRST) { const d0 = page.locator('#ta-panel button', { hasText: /done/i }); await d0.first().click().catch(e => log(F, 'done-first ' + e)); await adv(page, 0.2); log(F, 'N12 Done before filing: dialogs ' + JSON.stringify(h.dialogs) + ' alert ' + await txt(page, '#alert') + ' panel ' + (await txt(page, '#ta-panel')).slice(0, 300)); }
    log(F, '== TA PANEL ==\n' + await txt(page, '#ta-panel'));
    const helper = await txt(page, '#ta-helper'); log(F, 'helper: ' + helper);
    const claim = /claim (\d+)m(\d\d)s/.exec(helper); const sec = claim ? Number(claim[1]) * 60 + Number(claim[2]) : 0;
    const book = o.book as any[]; const rr = book.find(b => /RR crossing/.test(b.text));
    await page.locator('#ta-car').fill('39'); await page.locator('#ta-password').fill('1939').catch(() => {}); await page.locator('#ta-phone').fill('555-0139').catch(() => {});
    await page.locator('#ta-login').click().catch(e => log(F, 'login ' + e)); await adv(page, 0.1);   // PT-07: the 2026 web form has a login page first
    log(F, 'after login: alert ' + await txt(page, '#alert'));
    await page.locator('#ta-panel button', { hasText: /^Use$/ }).first().click().catch(e => log(F, 'use ' + e)); await adv(page, 0.1);
    await page.locator('#ta-stage').fill('1').catch(() => {});
    if (rr) { await page.locator('#ta-from').fill(String(rr.n)).catch(() => {}); await page.locator('#ta-to').fill(String(rr.n + 1)).catch(() => {}); }
    await page.locator('#ta-min').fill(String(Math.floor(sec / 60)), { timeout: 3000 }).catch(e => log(F, 'min fill ' + String(e).slice(0, 120))); await page.locator('#ta-sec').fill(String(sec % 60), { timeout: 3000 }).catch(() => {});
    await page.locator('#ta-cause').fill('Delayed by train', { timeout: 3000 }).catch(() => {});
    log(F, 'leg field: ' + await page.locator('#ta-leg').inputValue().catch(() => '?') + '; pattern: ' + await txt(page, '#ta-pattern'));
    if (!DONEFIRST) await shot(page, 'd08b-ta-form-filled');
    await page.locator('#ta-submit').click({ timeout: 5000 }).catch(e => log(F, 'submit ' + String(e).slice(0, 200))); await adv(page, 0.2);
    log(F, 'filed: ' + await txt(page, '#ta-filed') + '\npanel after: ' + (await txt(page, '#ta-panel')).slice(0, 800));
    // the red "done" button
    const done = page.locator('#ta-panel button', { hasText: /done/i }); log(F, 'done buttons: ' + await done.count() + ' ' + JSON.stringify(await done.first().boundingBox().catch(() => null)) + ' panel ' + JSON.stringify(await page.locator('#ta-panel').boundingBox().catch(() => null)));
    if (await done.count()) { await done.first().click(); await adv(page, 0.2); log(F, 'after done: ' + (await txt(page, '#ta-panel')).slice(0, 400) + ' alert ' + await txt(page, '#alert')); }
    await page.locator('#view').focus();
  }
}
await page.waitForTimeout(600);
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
if (!DONEFIRST) await shot(page, 'd08b-debrief');
log(F, '== DEBRIEF ==\n' + (await page.locator('#view').innerText()).slice(0, 7000));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.close();

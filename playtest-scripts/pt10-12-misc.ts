/** PT-10 step 12: the PT-08 low items in a scratch copy of the evening-two profile (PT10_NOSAVE=1, PT10_OUT=<scratch>/misc):
 *  N-B11 stale alert (is the chip VISIBLE minutes later?), N-B13 ledger TA hint behind the D08 truck, N-B15 pre-read wording (D01 duplicate sentence,
 *  driver's warning, TOD sentence, bezel on the digital watch, D16 restart card), N-B16 campaign totals before play, the stage title, the School index. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt10-common.js';
import { playHuman } from './pt10-human.js';
const F = '12-misc.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
const vis = async (sel: string) => { const l = page.locator(sel).first(); return (await l.count()) ? `${await l.isVisible() ? 'VISIBLE' : 'hidden'}: "${(await l.textContent())?.trim()}"` : 'absent'; };
// N-B11 + N-B13: D08 Bronze, pull up (alert), launch, then behind the slow truck
await goto(page, '#/cockpit/drill/D08/0/2'); await hold(page);
await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as any;
await playHuman(page, { ...base, until: "o.phase === 'preread' && o.startQueue && o.startQueue.pulledUp" }).catch(() => {});
log(F, 'just after Q: alert ' + await vis('#alert'));
await playHuman(page, { ...base, keepState: true, until: "o.phase === 'running' && o.tod > o.startTime + 60" });
log(F, '60 s after the start: alert ' + await vis('#alert'));
let o = await playHuman(page, { ...base, keepState: true, until: "o.ahead.some(f => f.kind === 'slow' && f.approxDistanceFt < 120)" });
await adv(page, 5); o = await obs(page);
log(F, `behind the slow truck (tod ${o.tod.toFixed(0)}): ta-hint ${await vis('#ta-hint')} | ledger: ${(await txt(page, '#ledgerbox')).replace(/\n/g, ' / ').slice(0, 300)}`);
await shot(page, 'misc-d08-truck');
// N-B15: pre-read texts
for (const hash of ['drill/D01/0/1', 'drill/D03/0/1', 'drill/D08/0/1', 'drill/D16/0/1', 'drill/D06/0/1', 'builtin/stage/1']) {
  await goto(page, `#/cockpit/${hash}`); await hold(page); await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
  const pr = await txt(page, '#preread'); const hb = await txt(page, '#hintbar');
  const count = (re: RegExp) => (pr.match(re) ?? []).length;
  log(F, `\n== ${hash}: "Drill start" x${count(/Drill start/g)}, "driver's warning" ${/driver's warning/.test(pr)}, "run it as time-of-day all day" ${/time-of-day all day/.test(pr)}, "bezel" ${/bezel/i.test(pr + hb)}, "fullStage" ${/fullStage/.test(pr + hb)}, "launch your standing-start loss early" ${/launch your standing-start loss early/.test(pr)}, "no launch lead" ${/no launch lead/.test(pr)}`);
  log(F, pr.slice(0, 1600));
}
// D16 restart card at T-20 (N-B9 leftover "leave at that second")
await goto(page, '#/cockpit/drill/D16/0/1'); await hold(page); await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
await page.locator('#skip').click().catch(() => {});
await playHuman(page, { ...base, until: "o.driver.state === 'waiting:hold' && o.launch && o.launch.line > 1 && o.launch.secondsToLaunch <= 20" });
log(F, '\n== D16 restart T-20: hold card ' + await txt(page, '#holdcard') + '\n startcard-road ' + await txt(page, '#startcard-road') + '\n perf ' + (await txt(page, '#perfcard')).slice(0, 600));
await shot(page, 'misc-d16-restart');
// N-B16: campaign before any stage
await goto(page, '#/campaign'); await page.waitForTimeout(300); log(F, '\n== CAMPAIGN ==\n' + (await page.locator('#view').innerText()).slice(0, 1800));
await goto(page, '#/school'); log(F, '\n== SCHOOL ==\n' + (await page.locator('#view').innerText()).slice(0, 300));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();

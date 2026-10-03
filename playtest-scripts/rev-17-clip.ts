import { launch, shot, goto, obs, adv } from './rev-common.js';
import { startRun, drive } from './rev-player.js';
for (const [w, hh] of [[1280, 720], [1366, 768], [1920, 1080]]) {
  const h = await launch({ width: w, height: hh }, true); const { page } = h;
  await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await startRun(page);
  await drive(page, { name: 'D03', dwellFull: true }, 'o.stoppedAtLine !== null && o.tod > 28800+20');
  await adv(page, 3); await page.waitForTimeout(150);
  console.log(w + 'x' + hh, await page.evaluate(() => { const c = document.querySelector('#perfcard') as HTMLElement; const d = document.querySelector('.lapboard') as HTMLElement; const r = c.getBoundingClientRect(); return JSON.stringify({ boxBottom: Math.round(r.bottom), vh: innerHeight, scrollH: c.scrollHeight, clientH: c.clientHeight, overflowY: getComputedStyle(c).overflowY, lastLineBottom: Math.round((c.querySelector('.hintline') as HTMLElement | null)?.getBoundingClientRect().bottom ?? -1) }); }));
  if (w === 1280) await shot(page, 'perfcard-at-stop-1280x720');
  await h.browser.close();
}

import { launch, shot, goto, txt, obs, adv } from './rev-common.js';
const h = await launch(); const { page } = h;
const log = (...a: any[]) => console.log(...a);
// ---- Reference table vs lessons
await goto(page, '#/reference');
const ref = await page.evaluate(() => { const t = document.querySelector('#answer-sheet table')!; const heads = [...t.querySelectorAll('thead th')].slice(1).map(x => Number(x.textContent)); const rows = [...t.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('td')].slice(1).map(x => Number(x.textContent))); return { heads, rows }; });
const L = (i: number, o: number) => ref.rows[ref.heads.indexOf(i)]![ref.heads.indexOf(o)];
log('Reference stop loss 35/35', L(35, 35), '40/30', L(40, 30), '40/40', L(40, 40), '50/50', L(50, 50), '35/40', L(35, 40), '30/40', L(30, 40));
const lessons = ['ghost-car', 'pause-arithmetic', 'timed-leads', 'griid-cameo', 'calibration', 'recovery', 'protocol'];
await goto(page, '#/school'); log('school index cards', await page.locator('.card[data-lesson]').count());
for (const id of lessons) { await goto(page, `#/school/${id}`); const t = await txt(page, '.lesson'); if (t.includes('NaN') || t.includes('undefined')) log('LESSON BAD TEXT', id); if (id === 'pause-arithmetic' || id === 'timed-leads' || id === 'calibration') log(`--- ${id}:\n`, t.slice(0, 1800).replace(/\n+/g, '\n')); }
// click through the lesson-2 check right answer
await goto(page, '#/school/pause-arithmetic'); const opts = await page.locator('.opt').allInnerTexts(); log('lesson2 options', opts);
// ---- Keys overlay
await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
await page.locator('.hud button', { hasText: 'Keys' }).click(); await page.waitForTimeout(200);
const kb = await page.evaluate(() => { const n = document.querySelector('nav, header')!.getBoundingClientRect(); const e = document.querySelector('.help') as HTMLElement; const b = e.getBoundingClientRect(); return { nav: [n.top, n.bottom], help: [b.left, b.top, b.right, b.bottom], vis: getComputedStyle(e).display }; });
log('Keys overlay', JSON.stringify(kb)); await shot(page, 'keys-overlay-1366');
await page.locator('.hud button', { hasText: 'Keys' }).click();
// ---- C4 notes blur, C10 silent input
await page.keyboard.press('d'); await page.keyboard.press(' '); await adv(page, 5);
const note = page.locator('.lapboard input[placeholder^="note"]'); await note.click(); await note.fill('hello'); await page.keyboard.press('Enter');
log('note blurred?', !(await note.evaluate(e => e === document.activeElement)));
const run1 = await page.evaluate(() => (window as any).__rally.observe().stopwatch.running); await page.keyboard.press(' '); const run2 = await page.evaluate(() => (window as any).__rally.observe().stopwatch.running); log('space after note toggles watch:', run1, '->', run2);
await page.keyboard.press('e'); await page.keyboard.type('g5'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
log('E + g5 feedback chip:', JSON.stringify(await txt(page, '#alert')), 'visible', await page.locator('#alert').isVisible());
// ---- C7 aborted run on an unplayed drill
await goto(page, '#/cockpit/drill/D05/0/1'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.keyboard.press('d'); await adv(page, 20);
await page.locator('#abort').click(); await page.waitForSelector('#debrief'); log('abort banner:', (await txt(page, '#aborted')).slice(0, 160));
await goto(page, '#/'); log('D05 after abort:', (await txt(page, '.card[data-drill="D05"]')).replace(/\n/g, ' | ').slice(-120), '| lastruns has D05?', /D05/.test(await txt(page, '#lastruns')));
// ---- C9: Retry then Back, reload on debrief
await goto(page, '#/cockpit/drill/D01/0/2'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.keyboard.press('d'); await page.keyboard.press(' '); await adv(page, 300);
await page.evaluate(() => (window as any).__rally.finish()); await page.waitForSelector('#debrief');
await page.locator('#retry').click(); await page.waitForTimeout(400); log('after Retry hash', await page.evaluate(() => location.hash));
await page.goBack(); await page.waitForTimeout(400); log('Back from retry lands on', await page.evaluate(() => location.hash), '| debrief visible', await page.locator('#debrief').count());
await page.reload(); await page.waitForTimeout(500); log('reload on #/debrief ->', await page.evaluate(() => location.hash), 'debrief visible', await page.locator('#debrief').count());
await page.waitForSelector('#cp-table tbody tr', { timeout: 3000 }).then(() => log('debrief table renders after reload')).catch(() => log('debrief table missing after reload'));
// ---- C5 digital watch
await goto(page, '#/settings'); log('SETTINGS:', (await txt(page, '#view')).replace(/\n/g, ' | ').slice(0, 700));
await page.locator('select').first().selectOption('digital');
await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.keyboard.press('d'); await page.keyboard.press(' '); await adv(page, 7);
log('digital: #lcd', await page.locator('#lcd').count(), JSON.stringify(await page.locator('.instruments .caption').nth(1).innerText()));
await shot(page, 'cockpit-digital-1366');
await page.locator('select').count();
await goto(page, '#/settings'); await page.locator('select').first().selectOption('analog');
// ---- K2 light theme
await page.locator('select').nth(3).selectOption('light'); await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.keyboard.press('d'); await page.keyboard.press(' '); await adv(page, 6); await page.keyboard.press('l');
log('light chips:', JSON.stringify(await page.evaluate(() => ['#phase', '#tod', '#scale'].map(s => { const c = getComputedStyle(document.querySelector(s)!); return [s, c.color, c.backgroundColor]; }))));
await shot(page, 'cockpit-light-1366');
await page.keyboard.press('Shift+R'); await page.waitForTimeout(100);
await goto(page, '#/settings'); await page.locator('select').nth(3).selectOption('dusk');
log('errors', h.errors);
await h.browser.close();

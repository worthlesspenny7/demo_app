/** PT-03 scenarios 4-6: D09 quiz, D14 math, School lessons, Settings applied in the cockpit. */
import { launch, goto, shot, text, obs } from './common.js';
const log = (...a: unknown[]) => console.log(...a);

async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  // ---------- D09 quiz ----------
  await goto(page, '#/quiz/D09'); await page.waitForSelector('.quiz');
  log('quiz h1:', await text(page, 'h1'), '| sub:', await text(page, '.quiz p.muted'));
  log('first card options:', await page.locator('.quiz button.opt').allInnerTexts(), '| has svg:', await page.locator('.quiz svg').count());
  await shot(page, 'quiz-d09');
  let wrongShown = ''; let rightShown = '';
  for (let i = 0; i < 20; i++) {
    const opts = page.locator('.quiz button.opt'); const n = await opts.count();
    // find the correct one by trying: click a deliberately wrong option on cards 1-5 (first option unless it is the answer... we cannot know, so click option 0 and see)
    if (i < 5) {
      await opts.nth(5).click();   // "Stop and ask" is right on one card only
      const fb = await page.locator('.quiz .panel > p:not([style])').last().textContent();
      if (!wrongShown && fb?.startsWith('No')) wrongShown = fb;
      if (i === 0) { await opts.nth(0).click(); log('clicking a second option after answering changes feedback?', (await page.locator('.quiz .panel > p:not([style])').last().textContent()) === fb ? 'no (locked)' : 'YES (bug)'); await shot(page, 'quiz-d09-wrong'); }
    } else {
      // brute force: the right class appears when correct; try each option until one is right (only the first click counts, so read the feedback)
      await opts.nth(0).click();
      const fb = (await page.locator('.quiz .panel > p:not([style])').last().textContent()) ?? '';
      if (fb.startsWith('Right') && !rightShown) rightShown = fb;
    }
    const nextBtn = page.locator('.quiz button.primary:has-text("Next")'); log(`  card ${i + 1}: options ${n}, next buttons: ${await nextBtn.count()}, sub: ${await text(page, '.quiz p.muted')}`);
    await nextBtn.first().click();
  }
  log('wrong feedback sample:', wrongShown); log('right feedback sample:', rightShown);
  log('quiz result:', (await page.locator('.quiz .panel').innerText()).replace(/\n/g, ' | '));
  await shot(page, 'quiz-d09-result');
  await goto(page, '#/'); log('home D09 card:', (await page.locator('.card[data-drill="D09"]').innerText()).replace(/\n/g, ' | ')); log('last runs:', await page.locator('.page > p.muted').nth(1).textContent());
  // ---------- D14 math ----------
  await goto(page, '#/math/D14'); await page.waitForSelector('.quiz');
  log('math h1:', await text(page, 'h1'));
  const prompts: string[] = [];
  for (let i = 0; i < 20; i++) {
    const prompt = await page.locator('.quiz .panel > p').first().textContent(); prompts.push(prompt ?? '');
    const opts = page.locator('.quiz button.opt'); const texts = await opts.allInnerTexts();
    // compute the right answer ourselves from the prompt to verify grading
    let pick = 0; let expected: string | null = null;
    let m: RegExpExecArray | null;
    if ((m = /Pause (\d+), entering at (\d+) and leaving at (\d+). The card says the stop\/start loss is ([\d.]+) s/.exec(prompt ?? ''))) expected = `${Math.max(0, Math.round((Number(m[1]) - Number(m[4])) * 10) / 10).toFixed(1)} s`;
    else if ((m = /Seconds per mile at (\d+) mph/.exec(prompt ?? ''))) expected = `${(3600 / Number(m[1])).toFixed(1)} s`;
    else if ((m = /You are (\d+) s late at an assigned (\d+)/.exec(prompt ?? ''))) expected = `${Math.round(Number(m[1]) * (Number(m[2]) / 5 + 1))} s`;
    else if ((m = /Stopwatch reads (\d+):(\d+). Add a Pause (\d+)/.exec(prompt ?? ''))) { const t = Number(m[1]) * 60 + Number(m[2]) + Number(m[3]); expected = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
    if (expected) pick = Math.max(0, texts.indexOf(expected));
    if (i === 3) pick = (pick + 1) % texts.length;   // one deliberate mistake
    await opts.nth(pick).click();
    const fb = (await page.locator('.quiz .panel > p:not([style])').last().textContent()) ?? '';
    if (i < 4 || !fb.startsWith('Right')) log(`  math ${i + 1}: "${prompt}" opts=${JSON.stringify(texts)} expected=${expected} picked=${texts[pick]} -> ${fb}`);
    if (i === 3) await shot(page, 'math-d14-wrong');
    await page.locator('.quiz button.primary:has-text("Next")').first().click();
  }
  log('math result:', (await page.locator('.quiz .panel').innerText()).replace(/\n/g, ' | '));
  await shot(page, 'math-d14-result');
  await page.locator('.quiz button:has-text("Again")').click(); log('Again -> sub:', await text(page, '.quiz p.muted'), 'h1 count on page:', await page.locator('h1').count());
  // ---------- School ----------
  await goto(page, '#/school'); const lessonIds = await page.evaluate(() => [...document.querySelectorAll('.card[data-lesson]')].map(c => c.getAttribute('data-lesson')));
  log('school lessons:', lessonIds);
  for (const id of lessonIds) {
    await goto(page, `#/school/${id}`);
    const title = await text(page, '.lesson h1'); const paras = await page.locator('.lesson .body p').count(); const opts = page.locator('.lesson .quiz button.opt'); const n = await opts.count();
    const bodyHeights = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
    // answer wrong first then find the right one
    await opts.nth(n - 1).click(); const fb1 = await text(page, '.lesson .quiz p.muted, .lesson .quiz p.ok, .lesson .quiz p.danger');
    let rightIdx = -1; for (let k = 0; k < n; k++) { await opts.nth(k).click(); if ((await opts.nth(k).getAttribute('class'))?.includes('right')) { rightIdx = k; break; } }
    const fb2 = await text(page, '.lesson .quiz p.ok');
    log(`  ${id}: "${title}" paras=${paras} options=${n} wrong->"${fb1.slice(0, 50)}" right idx ${rightIdx} -> "${fb2.slice(0, 50)}" nav: ${(await page.locator('.lesson .actions button').allInnerTexts()).join(' / ')} overflow=${bodyHeights.scrollW > bodyHeights.innerW}`);
    if (id === lessonIds[1]) await shot(page, 'school-lesson', true);
  }
  await goto(page, '#/school'); log('school cards after passing all:', (await page.locator('.card[data-lesson] .meta').allInnerTexts()).join(' ; '));
  // ---------- Settings ----------
  await goto(page, '#/settings'); await shot(page, 'settings');
  const selects = page.locator('.page select');
  await selects.nth(0).selectOption('digital'); await selects.nth(1).selectOption('4'); await selects.nth(2).selectOption('rookie'); await selects.nth(3).selectOption('light');
  log('settings saved:', await page.evaluate(() => localStorage.getItem('rally-trainer.settings.v1')), '| html theme:', await page.evaluate(() => document.documentElement.dataset.theme));
  await shot(page, 'settings-light');
  await page.reload(); await page.waitForTimeout(200); log('after reload theme:', await page.evaluate(() => document.documentElement.dataset.theme), 'select values:', await page.locator('.page select').evaluateAll(els => els.map(e => (e as HTMLSelectElement).value)));
  await goto(page, '#/cockpit/builtin/onestop/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus();
  log('cockpit with settings: bar =', await text(page, '.drawer .bar .muted:last-child'), '| scale chip =', await text(page, '#scale'), '| sw caption =', await text(page, '.instruments .instrument:nth-child(2) .caption'), '| watch kind =', (await obs(page)).stopwatch.kind);
  await page.keyboard.press('Escape'); await page.locator('#skip').click(); await page.keyboard.press('d'); await page.keyboard.press(' ');
  await page.evaluate(() => window.__rally!.advance(7.37));
  log('digital reading text:', await text(page, '.instruments .instrument:nth-child(2) .caption'));
  await page.keyboard.press('Shift+R'); log('digital Shift+R while running -> reading', (await obs(page)).stopwatch.reading, 'alert:', await text(page, '#alert'));
  await page.keyboard.press('l'); await page.keyboard.press('l'); log('laps text:', (await page.locator('#laps').innerText()).replace(/\n/g, ' '));
  await page.evaluate(() => window.__rally!.advance(20));
  await shot(page, 'cockpit-light-digital');
  // reset back to defaults for the other scripts
  await goto(page, '#/settings'); page.once('dialog', d => d.accept()); await page.locator('button:has-text("Reset progress")').click(); await page.waitForTimeout(100);
  log('after reset theme:', await page.evaluate(() => document.documentElement.dataset.theme), 'progress:', await page.evaluate(() => localStorage.getItem('rally-trainer.progress.v1')));
  log('page errors:', h.errors); log('console:', h.consoleErrors.slice(0, 10));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

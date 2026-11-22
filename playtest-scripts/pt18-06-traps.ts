/** PT-18: Module 1 trap cases (m1 p6, p7): every wrong option on every case, read the verdict head + rule, Try again (touch), then the right one. */
import { open, shot, tap, BASE } from './pt18-common.js';
const { ctx, page, errors } = await open();
const pages = (process.argv[2] ?? "6,7").split(",").map(x => x.includes("/") ? x : "m1/" + x);
for (const pg of pages) {
  await page.goto(BASE + `/?mode=mobile#/school/${pg}`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(300);
  for (let r = 0; r < 6; r++) {
    const m = await page.evaluate(() => (window as any).__rally.school.mini());
    const o = await page.evaluate(() => (window as any).__rally.school.oracle());
    const prompt = await page.locator('.s2-minisim .mprompt').innerText().catch(() => '?');
    const row = await page.evaluate(() => (document.querySelector('.s2-minisim .mrow, .s2-minisim [data-testid=book-row], .s2-minisim .bookrow') as HTMLElement | null)?.innerText.replace(/\n+/g, ' / ') ?? '');
    console.log(`\n## ${pg} case ${r + 1}: ${prompt}  [row: ${row}] options=${m.options} right=${o.optionId}`);
    for (const w of m.options.filter((x: string) => x !== o.optionId)) {
      const label = await page.locator(`.s2-miniacts [data-option="${w}"]`).innerText();
      await tap(page, `.s2-miniacts [data-option="${w}"]`); await page.waitForTimeout(1200);
      const head = await page.locator('[data-testid=mini-verdict] .mv-head').innerText().catch(() => '');
      const sec = await page.locator('[data-testid=mini-verdict] .mv-sec').innerText().catch(() => '');
      const rule = await page.locator('[data-testid=mini-rule]').innerText().catch(() => '');
      console.log(`  WRONG "${label}" -> head="${head}" sec="${sec}" rule="${rule}" stays=${await page.locator('[data-testid=mini-verdict]').count()}`);
      if (pg === "m1/6" && r === 1 && w.startsWith('v4')) await shot(page, '10-m1-trap-wrong');
      await tap(page, '[data-action=try-again]'); await page.waitForTimeout(400);
      console.log('    after Try again: options visible', await page.locator('.s2-miniacts [data-option]').count());
    }
    await tap(page, `.s2-miniacts [data-option="${o.optionId}"]`); await page.waitForTimeout(400);
    if (await page.locator('[data-action=next-case]').count()) { await tap(page, '[data-action=next-case]'); await page.waitForTimeout(400); } else break;
  }
}
console.log('errors', errors); await ctx.close();

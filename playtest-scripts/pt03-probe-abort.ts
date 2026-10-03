/** PT-03 probe: what does End run (via keyboard-only flow + confirm) record? Pre-read abort and mid-leg abort on D03. */
import { launch, goto, adv, obs, text } from './common.js';
const log = (...a: unknown[]) => console.log(...a);
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  page.on('dialog', d => d.accept());
  await goto(page, '#/'); log('home before:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '));
  await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForSelector('#preread');
  await page.evaluate(() => window.__rally!.act({ type: 'abort' } as any)); await page.evaluate(() => window.__rally!.finish());
  await page.waitForSelector('#debrief'); log('abort in preread -> headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'));
  log('  worked:', (await page.locator('#worked li').allInnerTexts()).join(' / '));
  log('  rubric:', (await page.locator('.debrief .pill').first().textContent()));
  await goto(page, '#/'); log('home after preread abort:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '), '|', await page.locator('.page > p.muted').nth(1).textContent());
  await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForSelector('#preread');
  await page.locator('#skip').click(); await page.keyboard.press('d'); await page.keyboard.press(' '); await page.keyboard.press('Escape'); await adv(page, 30);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); await page.keyboard.press('Escape');
  await page.locator('button:has-text("End run")').click(); await page.waitForSelector('#debrief');
  log('abort 30 s in -> headline:', await text(page, '.debrief .headline'), '|', await text(page, '.debrief .panel p.muted'), '| cp rows', await page.locator('#cp-table tbody tr').count());
  log('  tip:', await text(page, '#tip')); log('  bias:', (await page.locator('.debrief .panel h3:has-text("Bias")').locator('..').innerText()).replace(/\n/g, ' | ').slice(0, 500));
  await goto(page, '#/'); log('home after mid-leg abort:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '), '|', await page.locator('.page > p.muted').nth(1).textContent());
  log('errors', h.errors); await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });

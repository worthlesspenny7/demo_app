import { launch, BASE, SHOTS } from './reval4-common.js';
const { browser, page, errors } = await launch(1366, 900);
await page.goto(`${BASE}/#/settings`); await page.waitForTimeout(300);
const st = await page.locator('#view').innerText(); console.log('SETTINGS:', st.replace(/\n+/g, ' | ').slice(0, 1400));
console.log('digital readout offered:', /digital readout/i.test(st));
await page.screenshot({ path: `${SHOTS}/v4-16-settings.png` });
await page.goto(`${BASE}/#/reference`); await page.waitForTimeout(300);
const rs = page.locator('#ref-rally-school'); console.log('ref rally-school', await rs.count());
const ref = await page.locator('#view').innerText(); console.log('ref headings', (await page.locator('#view h2, #view h3').allInnerTexts()).join(' | ').slice(0, 800));
await page.goto(`${BASE}/#/school`); await page.waitForTimeout(300);
console.log('SCHOOL', (await page.locator('#view').innerText()).replace(/\n+/g, ' | ').slice(0, 900));
console.log('errors', errors);
// stopwatch: black palm watch
await page.goto(`${BASE}/#/cockpit/builtin/stage/1`); await page.waitForSelector('#stopwatch');
await page.locator('#stopwatch').screenshot({ path: `${SHOTS}/v4-17-digital-watch-sim.png` });
await browser.close();

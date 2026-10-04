// V3 UI (UI-037, LESSON-008; INST-001/002, START-001/002, TAF-001/002, MAKEUP-001, PROTO-001, CAL-006): the start card and its count, the TA web form,
// the make-up ledger, the ambiguous clock, the debrief findings, the rally school lesson and the Reference panel.
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';

async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
/** Hold the UI clock so the test steps the simulator by hand (the cockpit's own loop keeps drawing). */
async function hold(page: Page): Promise<void> { await page.locator('#pause').click(); }
async function advance(page: Page, seconds: number): Promise<void> { await page.evaluate(s => { window.__rally!.advance(s); }, seconds); }
const secs = (t: string): number => { const m = /(\d\d):(\d\d):(\d\d)/.exec(t)!; return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]); };

async function resumeAtFirstTaWindow(page: Page, seed: number): Promise<void> {
  const sim = new Simulator(generateStage(seed), { watch: 'digital' });
  const bot = new OracleBot(sim);
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && !sim.taState().windowOpen; n++) { bot.onTick(); sim.step(0.1); }
  expect(sim.taState().windowOpen).toBe(true);
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/');
  await page.locator('#resume').click();
  await expect(page.locator('#cockpit')).toBeVisible();
}

test('UI-037 START-001 the start card shows "your time, launch at (minus N s)" and the car queue; Q is refused while the car ahead is at the sign', async ({ page }) => {
  await openDrill(page, 'D16');                                                   // aids rung 2: the numbers are on the card
  await hold(page);
  const plan = page.locator('#launch-plan');
  await expect(plan).toHaveText(/Line 1: your time \d\d:\d\d:\d\d, launch at \d\d:\d\d:\d\d \(minus \d+ s\)/);
  const t = await plan.innerText(); const own = secs(/your time (\d\d:\d\d:\d\d)/.exec(t)![1]!), launch = secs(/launch at (\d\d:\d\d:\d\d)/.exec(t)![1]!), minus = Number(/minus (\d+) s/.exec(t)![1]);
  expect(own - launch).toBe(minus); expect(minus).toBeGreaterThan(0);              // launch = your time minus the standing-start loss
  await expect(page.locator('#start-queue')).toContainText(/car ahead is still at the sign.*wait until it leaves on its minute/);
  await page.locator('#pull-up').click();
  await expect(page.locator('#alert')).toContainText(/Refused: the car ahead is still at the sign/);
  expect(await page.evaluate(() => (window.__rally!.observe() as unknown as { startQueue: { pulledUp: boolean } }).startQueue.pulledUp)).toBe(false);
  await advance(page, 140);                                                       // the car ahead has left on its minute
  await expect(page.locator('#start-queue')).toContainText(/car ahead has left: pull up/);
  await page.locator('#pull-up').click();
  await expect(page.locator('#start-queue')).toContainText(/Pulled up to the sign/);
  expect(await page.evaluate(() => (window.__rally!.observe() as unknown as { startQueue: { pulledUp: boolean } }).startQueue.pulledUp)).toBe(true);
});

test('UI-037 START-001 the 30-second warning banner comes up and the visible count ends with GO exactly on the launch second', async ({ page }) => {
  await openDrill(page, 'D16');
  await hold(page);
  const L = secs(/launch at (\d\d:\d\d:\d\d)/.exec(await page.locator('#launch-plan').innerText())![1]!);
  const left = (): Promise<number> => page.evaluate(() => window.__rally!.observe().tod).then(t => L - t);
  await advance(page, (await left()) - 40);                                       // 40 s before: nothing yet
  await expect(page.locator('#start-warning')).toBeHidden(); await expect(page.locator('#start-count')).toBeHidden();
  await advance(page, 9.5);                                                       // 30.5 s before
  await expect(page.locator('#start-warning')).toBeHidden();
  await advance(page, 1);                                                         // 29.5 s before: the warning banner
  await expect(page.locator('#start-warning')).toBeVisible(); await expect(page.locator('#start-warning')).toContainText('About 30 seconds'); await expect(page.locator('#start-count')).toBeHidden();
  await advance(page, (await left()) - 10.5);                                     // 10.5 s before: still only the banner
  await expect(page.locator('#start-count')).toBeHidden();
  await advance(page, 0.5);                                                       // exactly 10 s before the launch second: the count starts
  const beats: string[] = [];
  for (let i = 0; i < 11; i++) {
    await expect(page.locator('#start-count')).toBeVisible();
    beats.push(await page.locator('#start-count').innerText());
    if (i < 10) { expect(await left()).toBeCloseTo(10 - i, 1); await advance(page, 1); }
  }
  expect(beats).toEqual(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'GO']);
  expect(await left()).toBeCloseTo(0, 1);                                         // the last beat, GO, lands on the launch second
  await expect(page.locator('#start-count')).toHaveClass(/go/);
  await advance(page, 3); await expect(page.locator('#start-count')).toBeHidden();
});

test('UI-037 START-001 the restart card and the count work at a time-of-day restart too (D16 hold), and W warns the driver', async ({ page }) => {
  await openDrill(page, 'D16');
  await page.locator('#warn-driver').click();
  await expect(page.locator('#alert')).toContainText('about 30 seconds');
  expect(await page.evaluate(() => (window.__rally!.observe() as unknown as { launch: { warned: boolean } }).launch.warned)).toBe(true);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  const rs = await page.evaluate(() => window.__rally!.observe().book.find(i => i.section === 'restart')!.n);
  await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), rs);
  await expect(page.locator('#launchcard')).toContainText(/your time \d\d:\d\d:\d\d, launch at \d\d:\d\d:\d\d \(minus \d+ s\)/);   // the perf card shows the plan for the restart line
  await expect(page.locator('#holdcard')).toContainText(/base \d\d:\d\d:\d\d \+ ASP \d+ min = your time/);                           // the V2 restart card is unchanged
});

test('UI-037 TAF-001 TAF-002 the TA form carries the web form fields, the make-up helper, and a classic paper toggle', async ({ page }) => {
  await resumeAtFirstTaWindow(page, 6);
  await expect(page.locator('#ta-panel')).toBeVisible();
  for (const id of ['ta-car', 'ta-password', 'ta-phone', 'ta-stage', 'ta-leg', 'ta-from', 'ta-to', 'ta-request', 'ta-cause', 'ta-witness-ahead', 'ta-witness-behind']) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('#ta-request')).toHaveAttribute('step', '10');                                   // time in 10 s steps
  await expect(page.locator('#ta-leg')).toHaveValue('3');                                                    // the leg is filled in
  await expect(page.locator('#ta-helper')).toContainText(/measured \d+m\d\ds = stopped \d+m\d\ds \+ chart loss [\d.]+ s; make up the odd \d+ s, claim \d+m\d0s\./);
  await expect(page.locator('#ta-causes option')).toHaveCount(6);
  // classic paper: no password, no phone, a signature line
  await page.locator('#ta-paper').check();
  await expect(page.locator('#ta-password')).toHaveCount(0); await expect(page.locator('#ta-phone')).toHaveCount(0); await expect(page.locator('#ta-signature')).toBeVisible();
  await expect(page.locator('#ta-panel .ta-head b')).toContainText('classic paper');
  await page.locator('#ta-paper').uncheck();
  await expect(page.locator('#ta-password')).toBeVisible();
  // file it with the form fields; they travel with the request
  await page.locator('#ta-car').fill('99'); await page.locator('#ta-password').fill('1234'); await page.locator('#ta-phone').fill('555-0100'); await page.locator('#ta-stage').fill('2');
  await page.locator('#ta-cause').fill('a school bus'); await page.locator('#ta-witness-ahead').fill('2'); await page.locator('#ta-witness-behind').fill('8');
  await expect(page.locator('#ta-pattern')).toContainText('by a school bus'); await expect(page.locator('#ta-pattern')).toContainText('Witness: car 2 ahead, car 8 behind.');
  await page.locator('#ta-submit').click();
  await expect(page.locator('#ta-filed')).toContainText(/Leg 3: /);
  const rec = await page.evaluate(() => window.__rally!.sim.taRequests[0] as unknown as Record<string, unknown>);
  expect(rec['carNumber']).toBe(99); expect(rec['password']).toBe('1234'); expect(rec['cause']).toBe('schoolBus'); expect(rec['witnesses']).toEqual({ ahead: '2', behind: '8' });
});

test('UI-037 MAKEUP-001 the ledger shows the make-up total with the 10 % and 20 % options in mph and seconds and the drop-at-the-next-sign reminder; a logged chunk lowers the total', async ({ page }) => {
  await openDrill(page, 'D03');
  await hold(page);
  await expect(page.locator('#makeup')).toHaveCount(0);                                                       // nothing owed, nothing shown
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); r.act({ type: 'ledger.set', seconds: 4 }); });
  await expect(page.locator('#makeup-owed')).toHaveText('+4 s');
  const ten = page.locator('#makeup-opts tr[data-pct="10"]'), twenty = page.locator('#makeup-opts tr[data-pct="20"]');
  await expect(ten).toContainText(/\+10 %.*\d+(\.\d)? mph.*40 s.*6 s per minute/); await expect(twenty).toContainText(/\+20 %.*\d+(\.\d)? mph.*20 s.*12 s per minute/);
  await expect(page.locator('#makeup-drop')).toContainText('Drop the extra speed at the next speed-change sign');
  await expect(page.locator('#makeup-chunks')).toContainText('1 min = 6 s (+10 %) / 12 s (+20 %)');
  await page.locator('#makeup-chunk').fill('1'); await page.locator('#makeup-log').click();
  await expect(page.locator('#makeup-owed')).toHaveText('+3 s');
  await expect(page.locator('#makeup-entries')).toContainText('made up -1');
});

test('UI-037 INST-001 INST-002 the clock hand is drawn between the numerals within 5 s of the minute change at rung <= 1 and the watch TOD mode reads the time of day', async ({ page }) => {
  await openDrill(page, 'D16', 2);                                                                            // Gold: aids rung 0, the loose minute hand shows
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  await hold(page);
  const toSec = async (target: number): Promise<void> => { const tod = await page.evaluate(() => window.__rally!.observe().tod); await advance(page, ((target - (tod % 60)) % 60 + 60) % 60 + 0.05); };
  await toSec(30); await expect(page.locator('#clock')).toHaveAttribute('data-minute-ambiguous', 'false'); await expect(page.locator('#clock-warn')).toHaveCount(0);
  await toSec(57); await expect(page.locator('#clock')).toHaveAttribute('data-minute-ambiguous', 'true'); await expect(page.locator('#clock-warn')).toContainText('read the minute on the watch');
  await toSec(2); await expect(page.locator('#clock')).toHaveAttribute('data-minute-ambiguous', 'true');
  await toSec(20); await expect(page.locator('#clock')).toHaveAttribute('data-minute-ambiguous', 'false');
  // the watch: TOD mode is the obvious time-of-day source
  await expect(page.locator('#dw-hint')).toContainText('TOD (M) is your time of day');
  await toSec(57); await expect(page.locator('#dw-mode')).toHaveClass(/attn/);                                // the mode chip calls for attention while the hand is ambiguous
  await page.locator('#dw-mode').click();
  await expect(page.locator('#dw-mode')).toHaveText('TOD'); await expect(page.locator('#lcd')).toHaveText(/^\d\d:\d\d:\d\d\.\d\d$/);
  await expect(page.locator('#dw-mode')).not.toHaveClass(/attn/);
  await page.locator('#lcd').click();                                                                          // a read of the watch's TOD mode counts as a clock read (WATCH-009)
  expect(await page.evaluate(() => window.__rally!.sim.instrumentLog.some(e => e.kind === 'clock.read' && e.source === 'stopwatch'))).toBe(true);
  // rung 2 does not hide the minute: the hand is not flagged
  await openDrill(page, 'D16', 0); await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); }); await hold(page); await toSec(57); await expect(page.locator('#clock')).toHaveAttribute('data-minute-ambiguous', 'false');
});

test('CAL-006 UI-037 the calibration box offers the schedule correction for a stock speedometer: "1 s per N min" from the error and the run length', async ({ page }) => {
  await openDrill(page, 'D07');
  await expect(page.locator('#cal-schedule')).toContainText('enter the error');
  await page.locator('#cal-err').fill('5'); await page.locator('#cal-run').fill('25');
  await expect(page.locator('#cal-schedule')).toHaveText('late 5 s in 25 min = 12 s per hour: gain 1 s per 5 min');
  await page.locator('#cal-err').fill('-3'); await page.locator('#cal-run').fill('28');
  await expect(page.locator('#cal-schedule')).toContainText('early 3 s in 28 min'); await expect(page.locator('#cal-schedule')).toContainText('lose 1 s per');
});

test('UI-037 the debrief lists the one-minute mistake, the disturbed timed interval and the late launch separately, and the starts against their launch times', async ({ page }) => {
  await page.goto('/#/cockpit/builtin/straight/1');
  await expect(page.locator('#cockpit')).toBeVisible();
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); r.act({ type: 'call.speed', mph: 30 }); });
  await page.evaluate(() => { window.__rally!.advance(900); });
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#start-findings')).toBeVisible();
  for (const k of ['oneMinuteMistake', 'timedIntervalDisturbed', 'lateLaunch', 'earlyLaunch']) await expect(page.locator(`#finding-${k}`)).toBeVisible();
  await expect(page.locator('#finding-oneMinuteMistake')).toContainText('One-minute mistake');
  await expect(page.locator('#finding-timedIntervalDisturbed')).toContainText('Timed interval disturbed');
  await expect(page.locator('#finding-lateLaunch')).toContainText('Late launch');
});

test('LESSON-008 the rally school lesson renders its headings and every claim with a video timestamp and the "(video, not in the documents)" label', async ({ page }) => {
  await page.goto('/#/school/rally-school');
  await expect(page.locator('.lesson h1')).toHaveText('What the rally school adds');
  for (const h of ['The director\'s clock method', 'The start procedure', 'The Time Allowance web form and arithmetic', 'Making up time', 'When you are lost', 'Checkpoints', 'The callout protocol']) await expect(page.locator('.lesson h3.lesson-h', { hasText: h })).toBeVisible();
  const items = await page.locator('.lesson ul.lesson-list li').allInnerTexts();
  expect(items.length).toBeGreaterThanOrEqual(35);
  for (const it of items) { expect(it).toMatch(/\[\d{2,3}:\d{2}\]/); expect(it).toMatch(/\(video, not in the documents\)|\(in the documents: /); }
  await expect(page.locator('.lesson')).toContainText('delayed 3:47, make up 7, claim 3:40');
});

test('LESSON-008 the Reference page has a "Rally school" panel with the TA web form fields and the checkpoint facts', async ({ page }) => {
  await page.goto('/#/reference');
  const panel = page.locator('#ref-rally-school');
  await expect(panel).toBeVisible(); await expect(panel.locator('h3').first()).toHaveText('Rally school');
  for (const f of ['car', 'password', 'phone', 'stage', 'leg', 'instructions', 'time', 'cause', 'witnesses', 'done']) await expect(panel.locator(`[data-field="${f}"]`)).toHaveCount(1);
  await expect(panel).toContainText('Checkpoints passed + 1'); await expect(panel).toContainText('Green sign = timing checkpoint'); await expect(panel).toContainText('Red sign = observation checkpoint'); await expect(panel).toContainText('5 mph');
  await expect(panel).toContainText('(video, not in the documents)');
});

test('LESSON-002 LESSON-006 the team protocol lesson teaches ICE and "keep counting", and the clock lesson is the director\'s method', async ({ page }) => {
  await page.goto('/#/school/protocol');
  await expect(page.locator('.lesson')).toContainText('ICE: identify, confirm, execute'); await expect(page.locator('.lesson')).toContainText('keep counting'); await expect(page.locator('.printcard li')).toHaveCount(8);
  await page.goto('/#/school/which-timer');
  await expect(page.locator('.lesson')).toContainText('one-minute mistake'); await expect(page.locator('.lesson')).toContainText('time-of-day (TOD) mode');
});

test('UI-037 PROTO-001 W warns the driver, the count beats are echoed in the driver log, I identifies the next sign ("I see it too") and the next-call prompt has its place', async ({ page }) => {
  await openDrill(page, 'D16');
  await hold(page);
  await page.locator('#warn-driver').click();
  await expect(page.locator('#driverlog .dl')).toContainText(['About 30 seconds, got it']);
  const L = secs(/launch at (\d\d:\d\d:\d\d)/.exec(await page.locator('#launch-plan').innerText())![1]!);
  await page.evaluate(l => { const o = window.__rally!.observe(); window.__rally!.advance(l - o.tod - 10); }, L);
  for (let i = 0; i < 6; i++) await advance(page, 1);                             // the beats 10 ... 4 go to the driver as the navigator's count
  await advance(page, 0.1);
  const nums = (await page.locator('#driverlog .dl-count').allInnerTexts()).map(t => /(\d+)\s*$/.exec(t)![1]);
  expect(nums).toEqual(['10', '9', '8', '7', '6', '5', '4']);                      // the driver echoes each number
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  await expect(page.locator('#next-call')).toHaveCount(1);                           // the rung >= 2 reminder of the next call (empty until a call is due, it follows the engine's nextCall)
  await page.keyboard.press('i');
  await page.locator('#prompt input').fill('hard left 25'); await page.keyboard.press('Enter');
  await expect(page.locator('#driverlog .dl-confirm').last()).toContainText('I see it too');
});

test('UI-037 START-001 a late launch is listed on its own in the debrief, with the start against its launch time and no warning to the driver', async ({ page }) => {
  await openDrill(page, 'D16');
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 0 } as never); r.act({ type: 'start' }); r.advance(5); r.finish(); });   // leaves on its own time instead of the launch second
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#finding-lateLaunch li')).toContainText(/line 1: Start \(line 1\) left [\d.]+ s after the launch time/);
  await expect(page.locator('#finding-oneMinuteMistake li')).toHaveCount(0); await expect(page.locator('#finding-timedIntervalDisturbed li')).toHaveCount(0);
  await expect(page.locator('#start-findings-summary')).toContainText('Late launch x1');
  await expect(page.locator('#start-deltas li').first()).toContainText(/line 1 start: own time \d\d:\d\d:\d\d, launch \d\d:\d\d:\d\d, left \d\d:\d\d:\d\d \(\+[\d.]+ s\), no warning to the driver/);
});

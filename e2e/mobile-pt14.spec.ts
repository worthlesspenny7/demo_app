// Fix sprint PT-14 (docs/playtest/PT-14-phone-replay.md section L), phone parts: the labelled call tick and no elapsed digits on a
// speed-change card (MOB-069), a compressed Boss hold that jumps the watch and says so (MOB-067), the Stay-on-time pace with the
// human-model pauses (MOB-068), and the display finish: one clock format, CAMEO labels at their own size, verdict seconds on one line,
// phone layouts for the Reference and the School (MOB-071).
import { test, expect, type Page } from '@playwright/test';
import { PHONES, state, step, collectErrors, type W } from './mobile-helpers.js';
import { Scheduler, DecisionRun, emptyProgress, type DecisionResponse } from '../src/core/decision/index.js';

test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

/** Play (by the oracle, real time) until a decision of `kind` is on screen; restarts the route when a run ends. */
async function toKind(page: Page, route: string, kind: string, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    const st = await state(page);
    if (st.screen === 'recap') { await page.goto(route); continue; }
    if (st.phase === 'decision' && st.kind === kind) return;
    await step(page);
  }
  throw new Error(`no ${kind} card`);
}

test('MOB-069 a speed-change card labels its call tick CALL and shows no elapsed digits (the bar is the cue); the TOD strip reads CDT h:mm:ss', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  const route = '/?mode=mobile#/m/play/skill/stayOnTime';
  await page.goto(route);
  await toKind(page, route, 'speedChange');
  await expect(page.locator('[data-testid=call-tick]')).toHaveText('CALL');
  await expect(page.locator('[data-testid=call-tick]')).toBeVisible();
  await expect(page.locator('[data-testid=watch-digits]')).toBeHidden();
  await expect(page.locator('.mw-tod')).toHaveText(/^CDT (1[0-2]|[1-9]):\d\d:\d\d$/);
  // the tick and its label line up (the label sits under the tick)
  const tick = await page.locator('.msign-call').boundingBox(); const lbl = await page.locator('[data-testid=call-tick]').boundingBox();
  expect(Math.abs((tick!.x + tick!.width / 2) - (lbl!.x + lbl!.width / 2))).toBeLessThan(lbl!.width);
  await step(page);
  // a pause card still runs its digits (it times the sit)
  await toKind(page, route, 'pause');
  await expect(page.locator('[data-testid=watch-digits]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('MOB-067 a Boss-leg hold over 25 s jumps the watch to 5 s before the CALL and says so; the card is answered right within 30 s of wall time', async ({ page }) => {
  test.setTimeout(180_000);
  // a Boss run whose generated leg gives a compressed timed start; the cards before it answered by the oracle, saved as the unfinished run
  let found: { plan: ReturnType<Scheduler['plan']>; responses: (DecisionResponse | null)[] } | null = null;
  for (let s = 1; s <= 200 && !found; s++) {
    const plan = Scheduler.boss(s * 1237, null, 2).plan(); const run = new DecisionRun(plan); const responses: (DecisionResponse | null)[] = [];
    for (let i = 0; i < 40; i++) {
      const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
      if (st.decision.timing?.skip && st.decision.kind === 'timedStart') { found = { plan, responses }; break; }
      const o = run.oracle(); responses.push(o); run.answer(o);
    }
  }
  expect(found).not.toBeNull();
  const p = emptyProgress(); p.unfinished = { plan: found!.plan, responses: found!.responses };
  await page.goto('/?mode=mobile#/m');
  await page.evaluate(s => localStorage.setItem('rally-trainer.decision.v1', s), JSON.stringify(p));
  await page.goto('/?mode=mobile#/m/continue');
  await expect.poll(async () => (await state(page)).kind, { timeout: 20_000 }).toBe('timedStart');
  const st = await state(page); const t = st.timing as { truthSeconds: number; secondTapSeconds: number; skip: { at: number; to: number; note: string } };
  await expect(page.locator('[data-testid=skip-detail]')).toContainText('the watch jumps ahead to 5 s before the CALL');   // behind "details" (PT-15 P5)
  await expect(page.locator('[data-testid=skip-note]')).toBeHidden();
  const wall0 = Date.now();
  const o = await page.evaluate(() => (window as unknown as W).__rally.decision.oracle());
  const tapCard = async (sel: string, sec: number): Promise<void> => {
    const box = (await page.locator(sel).boundingBox())!;
    await page.waitForFunction(x => (window as unknown as W).__rally.decision.elapsed() >= x - 0.04, sec, { polling: 'raf', timeout: 60_000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await tapCard('.mob-actions [data-action=startstop]', o!.taps![0]!);
  // the jump: shortly after START the card clock is past skip.to and the note says so; the watch reads the interval run so far
  await expect(page.locator('[data-testid=skip-note]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid=skip-note]')).toHaveText(/^Jumped ahead \d+ s\.$/);
  const card = await page.evaluate(() => (window as unknown as W).__rally.decision.elapsed()); expect(card).toBeGreaterThanOrEqual(t.skip.to);
  const digits = await page.locator('[data-testid=watch-digits]').textContent(); const [m, sec] = digits!.split(':'); expect(Number(m) * 60 + Number(sec)).toBeGreaterThan(t.skip.to - o!.taps![0]! - 0.5);
  await tapCard('.mob-actions [data-action=lap]', o!.taps![1]!);
  await expect(page.locator('[data-testid=verdict]')).toHaveAttribute('data-correct', 'true');
  expect((Date.now() - wall0) / 1000).toBeLessThan(30);
});

test('MOB-068 Try it: Stay on time with the human-model pauses makes at least 4 decisions a minute', async ({ page }) => {
  test.setTimeout(420_000);
  // human model (PT-14 section E): 2.5 s to read an option card, a timed tap 0.3 s after its second, 2 s on a verdict, 3 s on a rule card
  await page.goto('/?mode=mobile#/m/play/skill/stayOnTime');
  await expect(page.locator('[data-screen=run]')).toBeVisible();
  let first = 0; let n = 0; let lastId: string | null = null;
  for (let i = 0; i < 80; i++) {
    const st = await state(page);
    if (st.screen === 'recap') break;
    if (st.phase === 'rule') { await page.waitForTimeout(3000); await page.locator('.mob-actions [data-action=ack]').click(); continue; }
    if (st.phase === 'verdict') { await page.waitForTimeout(2000); await page.locator('.mob-actions [data-action=next]').click(); continue; }
    if (st.phase !== 'decision' || st.id === lastId) { await page.waitForTimeout(30); continue; }
    lastId = st.id; n++; if (!first) first = Date.now() - st.elapsed * 1000;
    const o = await page.evaluate(() => (window as unknown as W).__rally.decision.oracle());
    const at = async (sel: string, sec: number): Promise<void> => {
      const box = (await page.locator(sel).boundingBox())!;
      await page.waitForFunction(x => (window as unknown as W).__rally.decision.elapsed() >= x, sec + 0.3, { polling: 'raf', timeout: 60_000 });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    if (o?.optionId !== undefined) { await page.waitForTimeout(2500); await page.locator(`.mob-actions [data-option="${o.optionId}"]`).click(); }
    else if (o?.taps?.length) { await at('.mob-actions [data-action=startstop]', o.taps[0]! - 0.3); await at('.mob-actions [data-action=lap]', o.taps[1]! - 0.3); }
    else if (o?.tapSeconds !== undefined) await at('.mob-actions [data-action=go]', o.tapSeconds - 0.3);
    await expect(page.locator('[data-testid=verdict]')).toBeVisible();
  }
  await expect(page.locator('[data-screen=recap]')).toBeVisible();
  const minutes = (Date.now() - first) / 60_000; const perMinute = n / minutes;
  test.info().annotations.push({ type: 'MOB-068', description: `${n} cards in ${(minutes * 60).toFixed(0)} s: ${perMinute.toFixed(1)}/min` }); console.log(`MOB-068: ${n} cards in ${(minutes * 60).toFixed(0)} s: ${perMinute.toFixed(1)}/min`);
  expect(n).toBeGreaterThanOrEqual(10);
  expect(perMinute).toBeGreaterThanOrEqual(4);
});

test('MOB-071 display finish: CAMEO labels keep their own size, verdict seconds stay on one line', async ({ page }) => {
  test.setTimeout(240_000);
  const route = '/?mode=mobile#/m/play/skill/stayOnTime';
  await page.goto(route);
  await toKind(page, route, 'speedChange');
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.mrow-a svg text')].map(t => ({ attr: Number(t.getAttribute('font-size')), css: parseFloat(getComputedStyle(t).fontSize) })));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s.css).toBeCloseTo(s.attr, 1);
  // a wrong answer: the verdict headline wraps, the seconds keep one line
  await step(page, { wrong: true });
  const sec = page.locator('.mv-sec'); await expect(sec).toBeVisible();
  const h = await sec.evaluate(e => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).fontSize) * 1.6 }));
  expect(h.h).toBeLessThan(h.lh);
});

for (const where of ['reference', 'school'] as const) {
  test(`MOB-071 the ${where} on a 390 px phone: one column, no text under 16 px, collapsible sections, no horizontal scroll`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.goto(`/?mode=mobile#/${where}`);
    await expect(page.locator('.page h1')).toBeVisible();
    const secSel = where === 'reference' ? 'details.ref-sec' : 'details.school-sec';
    const secs = page.locator(secSel); expect(await secs.count()).toBeGreaterThanOrEqual(where === 'reference' ? 8 : 5);
    // open every section, then measure
    await page.evaluate(sel => document.querySelectorAll<HTMLDetailsElement>(sel).forEach(d => { d.open = true; }), secSel);
    const g = await page.evaluate(() => {
      const vw = window.innerWidth; const small: string[] = []; const xs = new Set<number>();
      const hscroll = document.documentElement.scrollWidth > vw + 1;
      for (const e of document.querySelectorAll('.page *')) {
        if (e.closest('svg') || e.closest('details:not([open]) > :not(summary)')) continue;
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue;
        const fs = parseFloat(cs.fontSize); if (fs < 16 - 0.01) small.push(`${e.tagName}.${(e as HTMLElement).className}: ${fs}px "${(e.textContent ?? '').trim().slice(0, 30)}"`);
      }
      for (const c of document.querySelectorAll('.rule-grid > .card, .grid2 > .panel')) xs.add(Math.round(c.getBoundingClientRect().left));
      return { hscroll, small: small.slice(0, 10), nSmall: small.length, columns: xs.size };
    });
    expect(g.hscroll).toBe(false);
    expect(g.small, `${g.nSmall} elements under 16 px`).toEqual([]);
    expect(g.columns).toBe(1);
    if (where === 'school') {
      // the first group starts open, its Try it buttons one tap away
      await page.goto(`/?mode=mobile#/school`); await page.reload();
      await expect(page.locator('details.school-sec').first()).toHaveAttribute('open', '');
      await expect(page.locator('details.school-sec').nth(1)).not.toHaveAttribute('open', '');
      await expect(page.locator('.try-it').first()).toBeVisible();
    } else {
      await page.goto(`/?mode=mobile#/reference`); await page.reload();
      await expect(page.locator('details.ref-sec[open]')).toHaveCount(0);
      await page.locator('details.ref-sec > summary').first().click();
      await expect(page.locator('details.ref-sec[open]')).toHaveCount(1);
      // a link into a section opens it (and the section around it)
      await page.goto(`/?mode=mobile#/reference/penalties`);
      await expect(page.locator('#ref-lesson-penalties')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

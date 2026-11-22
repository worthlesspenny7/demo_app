// PT-18 copy of pt17-13 (port 4190; the CDT? time-zone chip has no data-ref and is skipped).
/** Pass 2 audit: every page of every module at the given viewport: words on the page, page/document scroll, chips (<= 2), each chip's
 *  sheet (excerpt text, citation, video button, sheet fits), inline reference text in the page, and the sheet text not pasted into the page.
 *  usage: <width> <height> [chips=1] */
import { open, words, BASE } from './pt18-common.js';
import { COURSE } from '../content/course.js';
const W = Number(process.argv[2] ?? 390), H = Number(process.argv[3] ?? 844), doChips = (process.argv[4] ?? '1') === '1';
const { ctx, page, errors } = await open({ width: W, height: H, profile: `/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt18-audit-${W}` });
const INLINE = /\b(REG [IVX]+\.|HB p\.\d|HB Appendix|Rally School Part|\[\d+:\d\d\]|Training Session|\(video\))/;
const out: string[] = []; let maxW = { w: 0, at: '' }; let chipsTotal = 0;
for (const m of COURSE) {
  for (let p = 1; p <= m.pages.length; p++) {
    await page.goto(`${BASE}/?mode=mobile#/school/${m.id}/${p}`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(150);
    const info = await page.evaluate(() => { const pg = document.querySelector('[data-testid=page]') as HTMLElement; const ptr = pg.querySelector('[data-testid=pointer]'); return { text: pg.innerText, s: pg.scrollHeight, c: pg.clientHeight, ds: document.scrollingElement!.scrollHeight, dw: document.scrollingElement!.scrollWidth, chips: [...document.querySelectorAll('.s2-chip[data-ref]')].map(c => ({ label: (c as HTMLElement).innerText, key: (c as HTMLElement).dataset.ref })), clipped: [...pg.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).length }; });
    const w = words(info.text); if (w > maxW.w) maxW = { w, at: `${m.id}/${p}` };
    const flags: string[] = [];
    if (info.s > info.c + 1) flags.push(`PAGE-SCROLL ${info.s}>${info.c}`);
    if (info.ds > H + 1) flags.push(`DOC-SCROLL ${info.ds}`);
    if (info.dw > W + 1) flags.push(`HSCROLL ${info.dw}`);
    if (info.clipped) flags.push(`offscreen-elements ${info.clipped}`);
    if (w > 70) flags.push(`WORDS ${w}`);
    if (info.chips.length > 2) flags.push(`CHIPS ${info.chips.length}`);
    if (INLINE.test(info.text)) flags.push(`INLINE-REF "${INLINE.exec(info.text)![0]}"`);
    chipsTotal += info.chips.length;
    const chipNotes: string[] = [];
    if (doChips) for (const c of info.chips) {
      const b = (await page.locator(`.s2-chip[data-ref="${c.key}"]`).boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(120);
      const sh = await page.evaluate(() => { const s = document.getElementById('s2-sheet'); if (!s) return null; const body = s.querySelector('.s2-sheet-body') as HTMLElement; const r = body.getBoundingClientRect(); return { title: (s.querySelector('.s2-sheet-head b') as HTMLElement)?.innerText, text: (s.querySelector('[data-testid=sheet-text]') as HTMLElement).innerText, cite: (s.querySelector('[data-testid=sheet-cite]') as HTMLElement).innerText, video: (s.querySelector('[data-testid=open-video]') as HTMLElement | null)?.innerText ?? null, fits: r.top >= -1 && r.bottom <= innerHeight + 1, bodyScroll: body.scrollHeight > body.clientHeight + 1 }; });
      if (!sh) { chipNotes.push(`  CHIP ${c.label}: NO SHEET`); continue; }
      const pasted = info.text.includes(sh.text.slice(0, 40));
      chipNotes.push(`  chip ${c.label} -> "${sh.title}" (${words(sh.text)} w${sh.video ? ', ' + sh.video : ', no video link'}${sh.fits ? '' : ', SHEET OFF-SCREEN'}${sh.bodyScroll ? ', sheet scrolls' : ''}${pasted ? ', PASTED' : ''}${/not in the app yet/.test(sh.text) ? ', MISSING' : ''}): ${sh.text.slice(0, 170).replace(/\n/g, ' ')}`);
      const x = page.locator('[data-action=close-sheet]'); const xb = (await x.boundingBox())!; await page.touchscreen.tap(xb.x + xb.width / 2, xb.y + xb.height / 2); await page.waitForTimeout(80);
      if (await page.locator('#s2-sheet').count()) chipNotes.push('  SHEET DID NOT CLOSE');
    }
    out.push(`${m.id}/${p} ${m.pages[p - 1]!.kind} w=${w} chips=${info.chips.length} ${flags.join(' ')}`, ...chipNotes);
  }
}
console.log(out.join('\n'));
console.log(`max words on a page: ${maxW.w} at ${maxW.at}; chips total ${chipsTotal}; errors ${JSON.stringify(errors)}`);
await ctx.close();

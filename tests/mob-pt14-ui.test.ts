/** Fix sprint PT-14, phone display (MOB-069, MOB-071): the labelled call tick, the CAMEO labels clear of icons and arrows at phone width,
 *  the verdict seconds on one line. DOM behaviour (hidden digits, the jump of a compressed hold, Reference / School layouts): e2e/mobile-pt14.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cameoSvg, cameoOfNode, signFace, CAMEO_W } from '../src/core/cameo.js';
import { EXITS } from '../src/core/builder.js';
import { signBarHtml, decisionCardHtml, factsHtml } from '../src/ui/mobile/cards.js';
import { microScenario, microRunner, type Decision } from '../src/core/decision/index.js';
import { nodeById } from '../src/core/course.js';

type Box = { x0: number; x1: number; y0: number; y1: number; what: string };
const overlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const num = (s: string | undefined): number => Number(s);

/** The boxes of a CAMEO's labels (text outside a sign face), its icons (landmark pictures, sign faces, control glyphs) and the bold arrow. */
function layout(svg: string): { labels: Box[]; icons: Box[]; faceTexts: { text: Box; face: Box }[]; sizes: { attr: number; style: number }[] } {
  const labels: Box[] = []; const icons: Box[] = []; const faceTexts: { text: Box; face: Box }[] = []; const sizes: { attr: number; style: number }[] = [];
  const textBox = (m: RegExpExecArray, dx = 0, dy = 0, k = 1): Box => {
    const x = num(m[1]) * k + dx, y = num(m[2]) * k + dy, size = num(m[3]) * k, anchor = m[4], s = m[5]!; const w = s.length * size * 0.6;
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    return { x0, x1: x0 + w, y0: y - size * 0.75, y1: y + size * 0.2, what: s };
  };
  const TEXT = /<text[^>]* x="([\d.-]+)" y="([\d.-]+)" font-size="([\d.]+)" style="font-size:([\d.]+)px" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g;
  for (const m of svg.matchAll(TEXT)) sizes.push({ attr: num(m[3]), style: num(m[4]) });
  // sign faces: a translated (and maybe scaled) group holding a box and its text
  const faceRe = /<g class="cameo-signface side-\w" transform="translate\(([\d.-]+) ([\d.-]+)\)(?: scale\(([\d.]+)\))?">([\s\S]*?)<\/g><\/g>/g;
  let rest = svg;
  for (const f of svg.matchAll(faceRe)) {
    const cx = num(f[1]), cy = num(f[2]), k = f[3] ? num(f[3]) : 1; const inner = f[4]!;
    const rect = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/.exec(inner);
    const poly = /<polygon points="0,(-?[\d.]+) ([\d.]+),0/.exec(inner);
    const face: Box = rect ? { x0: cx + num(rect[1]) * k, x1: cx + (num(rect[1]) + num(rect[3])) * k, y0: cy + num(rect[2]) * k, y1: cy + (num(rect[2]) + num(rect[4])) * k, what: 'face' }
      : poly ? { x0: cx - num(poly[2]) * k, x1: cx + num(poly[2]) * k, y0: cy + num(poly[1]) * k, y1: cy - num(poly[1]) * k, what: 'face' } : { x0: cx - 10, x1: cx + 10, y0: cy - 10, y1: cy + 10, what: 'face' };
    icons.push(face);
    if (rect) for (const t of inner.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" font-size="([\d.]+)" style="[^"]*" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)) faceTexts.push({ text: textBox(t as RegExpExecArray, cx, cy, k), face });
    rest = rest.replace(f[0], '');
  }
  // landmark pictures (local box -13..13 x -10..12, scaled)
  for (const g of rest.matchAll(/<g class="cameo-landmark-wrap" transform="translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)">([\s\S]*?)<\/g><\/g>/g)) {
    const x = num(g[1]), y = num(g[2]), k = num(g[3]); icons.push({ x0: x - 13 * k, x1: x + 15 * k, y0: y - 10 * k, y1: y + 12 * k, what: 'landmark' }); rest = rest.replace(g[0], '');
  }
  // control glyphs: the octagon (its own STOP word sits inside it and is part of the glyph)
  for (const g of rest.matchAll(/<g class="cameo-sign cameo-stop"><polygon points="([^"]+)"[^>]*\/>[\s\S]*?<\/g>/g)) {
    const pts = g[1]!.split(' ').map(p => p.split(',').map(Number)); const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!);
    icons.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), what: 'octagon' }); rest = rest.replace(g[0], '');
  }
  // the bold arrow: the stem (and its legs) as thin boxes, the arrowhead as its box
  const route = /class="cameo-route[^"]*" d="([^"]+)"/.exec(rest);
  if (route) {
    const toks = route[1]!.match(/[MVLQH]|-?[\d.]+/g)!; let x = 0, y = 0; let i = 0;
    while (i < toks.length) {
      const c = toks[i++]!;
      if (c === 'M') { x = num(toks[i++]); y = num(toks[i++]); }
      else if (c === 'V') { const y2 = num(toks[i++]); icons.push({ x0: x - 2, x1: x + 2, y0: Math.min(y, y2), y1: Math.max(y, y2), what: 'stem' }); y = y2; }
      else if (c === 'L') { const x2 = num(toks[i++]), y2 = num(toks[i++]); icons.push({ x0: Math.min(x, x2) - 2, x1: Math.max(x, x2) + 2, y0: Math.min(y, y2) - 2, y1: Math.max(y, y2) + 2, what: 'leg' }); x = x2; y = y2; }
      else if (c === 'Q') { const x2 = num(toks[i + 2]), y2 = num(toks[i + 3]); i += 4; icons.push({ x0: Math.min(x, x2) - 2, x1: Math.max(x, x2) + 2, y0: Math.min(y, y2) - 2, y1: Math.max(y, y2) + 2, what: 'bend' }); x = x2; y = y2; }
      else i++;
    }
  }
  const head = /<g class="cameo-arrowhead"><polygon points="([^"]+)"/.exec(rest);
  if (head) { const pts = head[1]!.split(' ').map(p => p.split(',').map(Number)); icons.push({ x0: Math.min(...pts.map(p => p[0]!)), x1: Math.max(...pts.map(p => p[0]!)), y0: Math.min(...pts.map(p => p[1]!)), y1: Math.max(...pts.map(p => p[1]!)), what: 'arrowhead' }); }
  for (const m of rest.matchAll(TEXT)) labels.push(textBox(m as unknown as RegExpExecArray));
  return { labels, icons, faceTexts, sizes };
}

/** The PT-14 cases (section C session 4, H, BUG-15): landmark captions, the road-work text sign on either side, speed limits, a curve, a STOP junction. */
function cases(): { name: string; svg: string }[] {
  const out: { name: string; svg: string }[] = [];
  for (const lm of ['church on R', 'grain elevator', 'water tower', 'bridge']) out.push({ name: `landmark ${lm}`, svg: cameoSvg(EXITS.straightRoad(), 'none', 'S', 96, { landmark: lm }) });
  for (const side of ['L', 'R', 'O'] as const) {
    out.push({ name: `End Road Work ${side}`, svg: cameoSvg(EXITS.straightRoad(), 'none', 'S', 96, { sign: { text: 'END ROAD WORK', shape: 'rect', side } }) });
    out.push({ name: `Speed Limit 45 ${side}`, svg: cameoSvg(EXITS.straightRoad(), 'none', 'S', 96, { sign: { text: 'SPEED LIMIT 45', shape: 'speedlimit', side } }) });
  }
  out.push({ name: 'Curve L', svg: cameoSvg(EXITS.straightRoad(), 'none', 'S', 96, { sign: { text: 'CURVE', shape: 'curve', side: 'L', plaque: 35 } }) });
  for (const dir of ['L', 'R'] as const) out.push({ name: `STOP ${dir}`, svg: cameoSvg(EXITS.crossroads(dir), 'STOP', dir, 96) });
  // and every timed-start / speed-change row the micro cards draw on the phone (96 px tall)
  for (let s = 1; s <= 40; s++) for (const k of ['timedStart', 'speedChange'] as const) {
    const r = microRunner(microScenario(k, s, 0), 2); const d = r.next(); if (!d) continue;
    const ins = r.scenario.book.find(i => i.n === d.context.line)!; const node = nodeById(r.scenario.course, ins.nodeId);
    out.push({ name: `${k} ${s} ${node.label ?? node.sign?.text}`, svg: cameoOfNode(node, ins.turn ?? null, 96) });
  }
  return out;
}

describe('MOB-071 CAMEO labels are never drawn through icons or arrows at phone width', () => {
  it('MOB-071 every label carries its size as an inline style, so the phone shell\'s 16 px floor cannot enlarge it (the cause of BUG-15)', () => {
    for (const c of cases()) {
      const all = [...c.svg.matchAll(/<text[^>]*>/g)].length; const { sizes } = layout(c.svg);
      expect(sizes.length, c.name).toBe(all);
      for (const z of sizes) expect(z.style, c.name).toBe(z.attr);
    }
    const css = readFileSync('src/ui/styles.css', 'utf8'); expect(css).toMatch(/\.mob \* \{ font-size: max\(16px, 1em\); \}/);   // the rule that used to reach the SVG text
  });
  it('MOB-071 captions sit outside the landmark picture, road names and captions off the bold arrow, sign text inside its own box (church on R, grain elevator, End Road Work, speed limits, STOP)', () => {
    let n = 0;
    for (const c of cases()) {
      const { labels, icons, faceTexts } = layout(c.svg);
      for (const l of labels) for (const ic of icons) expect(overlap(l, ic), `${c.name}: "${l.what}" over the ${ic.what} ${JSON.stringify(l)} ${JSON.stringify(ic)}`).toBe(false);
      for (const { text, face } of faceTexts) { expect(text.x0, `${c.name}: "${text.what}" inside its box`).toBeGreaterThanOrEqual(face.x0 - 0.5); expect(text.x1).toBeLessThanOrEqual(face.x1 + 0.5); expect(text.y0).toBeGreaterThanOrEqual(face.y0 - 0.5); expect(text.y1).toBeLessThanOrEqual(face.y1 + 0.5); }
      // (an overhead sign is drawn over the arrow on purpose, as the sheets do: its white box hides the stem, so nothing is drawn through its text)
      if (!/side-O/.test(c.svg)) for (const ic of icons.filter(i => i.what === 'face' || i.what === 'landmark')) for (const a of icons.filter(i => i.what === 'stem' || i.what === 'arrowhead')) expect(overlap(ic, a), `${c.name}: the ${ic.what} on the arrow`).toBe(false);
      for (const l of labels) { expect(l.x0, `${c.name} ${l.what}`).toBeGreaterThanOrEqual(0); expect(l.x1).toBeLessThanOrEqual(CAMEO_W); }
      n++;
    }
    expect(n).toBeGreaterThan(40);
    expect(signFace('rect', 'END ROAD WORK')!.w).toBeGreaterThan(40);
  });
});

describe('MOB-069 item 8: the call tick is labelled on the sign bar', () => {
  const card = (rung: 0 | 1 | 2, s = 4): Decision => microRunner(microScenario('speedChange', s, 0, rung), rung).next()!;
  it('MOB-069 a speed-change card at rung 2 labels its call tick CALL under the bar, at the tick (clamped inside the bar); no tick or label at rung 1', () => {
    for (let s = 1; s <= 12; s++) {
      const d = card(2, s); const html = signBarHtml(d, 2);
      const tick = Number(/class="msign-call" style="left:([\d.]+)%"/.exec(html)![1]); const lbl = Number(/data-testid="call-tick" style="left:([\d.]+)%"/.exec(html)![1]);
      expect(/>CALL<\/span>/.test(html)).toBe(true); expect(lbl).toBeCloseTo(Math.min(90, Math.max(10, tick)), 1);
      expect(decisionCardHtml(d, 2)).toContain('data-testid="call-tick"');
    }
    expect(signBarHtml(card(1), 1)).not.toContain('call-tick');
    const ts = microRunner(microScenario('timedStart', 3), 2).next()!; expect(signBarHtml(ts, 2)).not.toContain('call-tick');
  });
  it('MOB-069 the chips print times as the card does: zone first, 12-hour', () => {
    const d = microRunner(microScenario('transitOut', 2), 2).next()!;
    expect(factsHtml(d, 2)).toMatch(/IN CDT (1[0-2]|[1-9]):\d\d:\d\d/);
  });
});

describe('MOB-071 verdict seconds never wrap', () => {
  it('MOB-071 the verdict seconds keep one line (nowrap, never shrunk) beside a headline that wraps', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8');
    expect(css).toMatch(/\.mv-sec \{ white-space: nowrap; flex: none; \}/); expect(css).toMatch(/\.mv-head > span \{ min-width: 0;/);
  });
});

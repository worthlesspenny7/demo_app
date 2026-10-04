/**
 * Analog time-of-day clock, no digital readout (REG II.H.1.d(1)). Two faces (INST-003):
 * 'sawtooth' (default): the rally clock the schools hold up (10c clock video, 11a): a white dial in a brass rim on an oak cup, black numerals 1-12, a printed outer numbered
 * track with small triangles every 5 minutes, "WWV (303) 499-7111" under the hub, black SPADE hands, a thin red second hand with a wide paddle tail, a hub nut, and NO rotating bezel;
 * 'bezel': the bezel rally clock of the 2026 school (a rotating ring of minute numerals).
 */
import type { ClockVm } from '../viewmodels/clock.js';
import { type Theme, hand, ticks, label, polar } from './common.js';

export type ClockFace = 'sawtooth' | 'bezel';

/** A black spade hand (a pointed spade on a thin stalk), drawn pointing up and rotated by `degCW`. */
function spade(ctx: CanvasRenderingContext2D, cx: number, cy: number, degCW: number, len: number, w: number, color: string): void {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(degCW * Math.PI / 180);
  const L = len;
  ctx.beginPath(); ctx.moveTo(0, -L);
  ctx.bezierCurveTo(0.25 * w, -0.9 * L, w, -0.82 * L, w, -0.68 * L);
  ctx.bezierCurveTo(w, -0.57 * L, 0.38 * w, -0.55 * L, 0.12 * w, -0.46 * L);
  ctx.lineTo(0.12 * w, 0.14 * L); ctx.lineTo(-0.12 * w, 0.14 * L); ctx.lineTo(-0.12 * w, -0.46 * L);
  ctx.bezierCurveTo(-0.38 * w, -0.55 * L, -w, -0.57 * L, -w, -0.68 * L);
  ctx.bezierCurveTo(-w, -0.82 * L, -0.25 * w, -0.9 * L, 0, -L);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

/** The Sawtooth-style rally clock: white dial, brass rim, outer numbered track, 5-minute triangles, WWV line, spade hands, red paddle second hand. */
export function drawSawtoothClock(ctx: CanvasRenderingContext2D, vm: ClockVm, size: number): void {
  const cx = size / 2, cy = size / 2, R = size / 2 - 2;
  // oak cup, then the brass rim
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); const oak = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); oak.addColorStop(0, '#b87a2e'); oak.addColorStop(0.5, '#d49a46'); oak.addColorStop(1, '#8f5a1f'); ctx.fillStyle = oak; ctx.fill();
  const rb = R * 0.93; ctx.beginPath(); ctx.arc(cx, cy, rb, 0, Math.PI * 2); const brass = ctx.createLinearGradient(cx - rb, cy - rb, cx + rb, cy + rb); brass.addColorStop(0, '#f2dc8a'); brass.addColorStop(0.45, '#c9a43f'); brass.addColorStop(1, '#8a6a1c'); ctx.fillStyle = brass; ctx.fill();
  const rd = R * 0.86; ctx.beginPath(); ctx.arc(cx, cy, rd, 0, Math.PI * 2); ctx.fillStyle = '#fcfcf8'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#8a6a1c'; ctx.stroke();
  // printed outer track: 60 minute ticks, small numerals every 5 minutes, small triangles at the 5-minute positions
  ticks(ctx, cx, cy, rd - 2, 60, i => (i % 5 === 0 ? { len: rd * 0.05, width: 1.6, color: '#111' } : { len: rd * 0.03, width: 0.8, color: '#333' }));
  if (size >= 190) for (let i = 1; i <= 12; i++) { const [x, y] = polar(cx, cy, rd * 0.86, i * 30); label(ctx, String(i * 5), x, y, Math.max(6, rd * 0.06), '#222', '600'); }   // the printed numbered track (dropped on a small dial, where it would only blur)
  for (let i = 0; i < 12; i++) {
    const [tx, ty] = polar(cx, cy, rd * 0.78, i * 30); const [lx, ly] = polar(cx, cy, rd * 0.745, i * 30 - 2.4); const [rx, ry] = polar(cx, cy, rd * 0.745, i * 30 + 2.4);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fillStyle = '#111'; ctx.fill();
  }
  // black hour numerals 1-12
  for (let i = 1; i <= 12; i++) { const [x, y] = polar(cx, cy, rd * 0.62, i * 30); label(ctx, String(i), x, y, Math.max(11, rd * 0.2), '#111', '700'); }
  label(ctx, 'WWV', cx, cy + rd * 0.36, Math.max(6, rd * 0.06), '#222', '700');
  label(ctx, '(303) 499-7111', cx, cy + rd * 0.43, Math.max(6, rd * 0.055), '#222', '600');
  // hands: black spades for hour and minute (no tint: a loose minute hand is merely displaced, INST-001), thin red second hand with a paddle tail
  spade(ctx, cx, cy, vm.hourDeg, rd * 0.42, Math.max(4, rd * 0.095), '#111');   // PT-07 N17: the hour hand stops inside the numerals, the minute hand reaches the minute track
  spade(ctx, cx, cy, vm.minuteDeg, rd * 0.93, Math.max(3.2, rd * 0.06), '#111');
  const red = '#d11d1d';
  hand(ctx, cx, cy, vm.secondDeg, rd * 0.96, Math.max(1, rd * 0.013), red, rd * 0.12);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(vm.secondDeg * Math.PI / 180); ctx.fillStyle = red; ctx.beginPath(); ctx.ellipse(0, rd * 0.2, Math.max(2.5, rd * 0.04), rd * 0.085, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // hub nut
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, rd * 0.045), 0, Math.PI * 2); ctx.fillStyle = '#2b2b2b'; ctx.fill(); ctx.beginPath(); ctx.arc(cx - rd * 0.01, cy - rd * 0.012, Math.max(1.2, rd * 0.018), 0, Math.PI * 2); ctx.fillStyle = '#9a9a9a'; ctx.fill();
}

export function drawClock(ctx: CanvasRenderingContext2D, vm: ClockVm, size: number, th: Theme, face: ClockFace = 'sawtooth'): void {
  if (face === 'sawtooth') { drawSawtoothClock(ctx, vm, size); return; }
  drawBezelClock(ctx, vm, size, th);
}

/** The bezel rally clock (Heuer Master Time style) with a rotating seconds bezel, kept as the alternative face. */
function drawBezelClock(ctx: CanvasRenderingContext2D, vm: ClockVm, size: number, th: Theme): void {
  const cx = size / 2, cy = size / 2, R = size / 2 - 2; const bezelW = Math.max(12, R * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#1c232e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(vm.bezelDeg * Math.PI / 180);
  for (let i = 0; i < 12; i++) { const [x, y] = polar(0, 0, R - bezelW * 0.5, i * 30); label(ctx, String(i * 5), x, y, bezelW * 0.6, i === 0 ? th.accent2 : th.tickMinor, '700'); }
  ticks(ctx, 0, 0, R - 1, 60, i => (i % 5 === 0 ? null : { len: bezelW * 0.3, width: 1, color: '#55637a' }));
  ctx.beginPath(); const [tx, ty] = polar(0, 0, R - bezelW - 2, 0); const [lx, ly] = polar(0, 0, R - 3, -4); const [rx, ry] = polar(0, 0, R - 3, 4);
  ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fillStyle = th.accent2; ctx.fill();
  ctx.restore();
  const rd = R - bezelW - 4;
  ctx.beginPath(); ctx.arc(cx, cy, rd, 0, Math.PI * 2); ctx.fillStyle = '#f3efe4'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  ticks(ctx, cx, cy, rd - 2, 60, i => (i % 5 === 0 ? { len: rd * 0.12, width: 2.2, color: '#1a1a1a' } : { len: rd * 0.06, width: 1, color: '#555' }));
  for (let i = 1; i <= 12; i++) { const [x, y] = polar(cx, cy, rd * 0.74, i * 30); label(ctx, String(i), x, y, Math.max(10, rd * 0.17), '#111', '700'); }
  label(ctx, 'TIME OF DAY', cx, cy + rd * 0.42, Math.max(7, rd * 0.08), '#555', '600');
  hand(ctx, cx, cy, vm.hourDeg, rd * 0.55, Math.max(3, rd * 0.05), '#111', rd * 0.08);
  // INST-001: a loose minute hand near the minute change is drawn between two marks: its minute cannot be read (use the stopwatch TOD mode)
  hand(ctx, cx, cy, vm.minuteDeg, rd * 0.86, Math.max(2.5, rd * 0.035), '#111', rd * 0.1);   // a loose minute hand is merely displaced, not tinted (11a: it is a normal black hand)
  hand(ctx, cx, cy, vm.secondDeg, rd * 0.92, Math.max(1, rd * 0.012), th.danger, rd * 0.15);
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, rd * 0.03), 0, Math.PI * 2); ctx.fillStyle = th.danger; ctx.fill();
}

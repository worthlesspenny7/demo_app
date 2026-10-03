/** Heuer Monte Carlo style stopwatch: central 1/5 s sweep, central minute register, jumping hour disc at 6, rotating countdown bezel. */
import type { StopwatchVm } from '../viewmodels/stopwatch.js';
import { type Theme, hand, ticks, label, polar } from './common.js';

export function drawStopwatch(ctx: CanvasRenderingContext2D, vm: StopwatchVm, size: number, th: Theme, opts: { bezelOn?: boolean } = {}): void {
  const cx = size / 2, cy = size / 2, R = size / 2 - 2;
  const bezelW = Math.max(14, R * 0.13);
  // case + bezel ring
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#1c232e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  // bezel: rotating ring with 0..dialSeconds in steps of 5, index triangle at bezelDeg
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(vm.bezelDeg * Math.PI / 180);
  const stepsRing = vm.dialSeconds / 5;
  for (let i = 0; i < stepsRing; i++) {
    const a = (i / stepsRing) * 360;
    const [x, y] = polar(0, 0, R - bezelW * 0.5, a);
    label(ctx, String(i * 5), x, y, bezelW * 0.62, i === 0 ? th.accent : th.tickMinor, '700');
  }
  ticks(ctx, 0, 0, R - 1, vm.dialSeconds, i => (i % 5 === 0 ? null : { len: bezelW * 0.3, width: 1, color: '#55637a' }));
  // index triangle at 0 of the bezel
  ctx.beginPath(); const [tx, ty] = polar(0, 0, R - bezelW - 2, 0); const [lx, ly] = polar(0, 0, R - 3, -4); const [rx, ry] = polar(0, 0, R - 3, 4);
  ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fillStyle = th.accent; ctx.fill();
  ctx.restore();
  // dial
  const rd = R - bezelW - 4;
  ctx.beginPath(); ctx.arc(cx, cy, rd, 0, Math.PI * 2); ctx.fillStyle = th.dial; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  // 1/5 s ticks: 5 per second
  const n = vm.tickCount;
  ticks(ctx, cx, cy, rd - 2, n, i => {
    if (i % 25 === 0) return { len: rd * 0.12, width: 2.2, color: th.tick };
    if (i % 5 === 0) return { len: rd * 0.08, width: 1.6, color: th.tick };
    return { len: rd * 0.04, width: 0.8, color: th.tickMinor };
  });
  // numerals every 5 s
  const numerals = vm.dialSeconds / 5;
  for (let i = 0; i < numerals; i++) {
    const a = (i / numerals) * 360; const [x, y] = polar(cx, cy, rd * 0.76, a);
    label(ctx, String(i === 0 ? vm.dialSeconds : i * 5), x, y, Math.max(10, rd * 0.13), th.text, '600');
  }
  // minute register ticks (inner ring) and the hour aperture at 6
  const rm = rd * 0.5;
  ticks(ctx, cx, cy, rm, vm.registerMinutes, i => ({ len: rm * 0.1, width: i % 5 === 0 ? 1.6 : 0.8, color: i % 5 === 0 ? th.tick : th.tickMinor }));
  for (let i = 0; i < vm.registerMinutes; i += 5) { const [x, y] = polar(cx, cy, rm * 0.78, (i / vm.registerMinutes) * 360); label(ctx, String(i === 0 ? vm.registerMinutes : i), x, y, Math.max(8, rm * 0.2), th.tickMinor, '600'); }
  const aw = rd * 0.26, ah = rd * 0.16; const ax = cx - aw / 2, ay = cy + rd * 0.46;
  ctx.fillStyle = '#f3efe4'; ctx.fillRect(ax, ay, aw, ah); ctx.strokeStyle = th.dialEdge; ctx.strokeRect(ax, ay, aw, ah);
  label(ctx, String(Math.floor(vm.minutes / 60) % 12), cx, ay + ah / 2, ah * 0.75, '#111', '700');
  label(ctx, 'HOURS', cx, ay - ah * 0.45, Math.max(7, rd * 0.06), th.tickMinor, '600');
  label(ctx, 'RALLY TRAINER', cx, cy - rd * 0.3, Math.max(8, rd * 0.075), th.tickMinor, '700');
  label(ctx, '1/5 SEC', cx, cy - rd * 0.2, Math.max(7, rd * 0.055), th.tickMinor, '500');
  // hands: minute register (short, thick), sweep (long, thin)
  hand(ctx, cx, cy, vm.registerDeg, rm * 0.88, Math.max(3, rd * 0.03), th.hand2, rd * 0.06);
  hand(ctx, cx, cy, vm.sweepDeg, rd * 0.93, Math.max(1.5, rd * 0.014), th.hand, rd * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, rd * 0.035), 0, Math.PI * 2); ctx.fillStyle = th.hand2; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, rd * 0.015), 0, Math.PI * 2); ctx.fillStyle = th.dial; ctx.fill();
  // crown (start/stop at 12) and the digital readout under the dial
  ctx.fillStyle = vm.running ? th.ok : th.muted; ctx.fillRect(cx - 6, 0, 12, 6);
  if (opts.bezelOn !== false) label(ctx, `bezel ${vm.bezelRemaining.toFixed(1)}s`, cx, cy + rd * 0.3, Math.max(8, rd * 0.07), th.accent, '600');
}

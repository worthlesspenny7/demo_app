/** Top-down road-ahead schematic from observe().ahead. The car sits at the bottom; features scroll down as they approach. */
import type { Observation, VisibleFeature } from '../../core/sim.js';
import { type Theme, label, roundRect } from './common.js';

export interface RoadOverlay {
  pendingCallout: string | null; driverLine: string | null; pace: number | null; countdown: number | null; aheadDimmed?: boolean; offCourseHint?: boolean;
  /** 'seconds' = signed early/late seconds; 'arrow' = only EARLY / LATE; 'wait' = "wait X more s" at a stop (rung 3). */
  paceMode?: 'seconds' | 'arrow' | 'wait'; waitMore?: number | null;
  /** Legal mode (aids rung <= 1) shows relative markers only: no feet labels. Default true. */
  showDistances?: boolean;
  /** START-002: the cars one minute ahead and one minute behind, when the engine reports them (feet; ahead positive, behind negative). */
  paceCars?: { side: 'ahead' | 'behind'; distanceFt: number; label: string }[];
  /** START-002: we are closing on the car one minute ahead: the only live early/late cue in legal mode. */
  gaining?: boolean;
}

const VIEW_FT = 1500;
/** Turns are called 500-600 ft out (braking from 45 to 12 mph alone needs ~250 ft). */
const CALL_TURN_FT = 550;

export function drawRoad(ctx: CanvasRenderingContext2D, obs: Observation | null, w: number, h: number, th: Theme, ov: RoadOverlay): void {
  // ground
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0e12'); g.addColorStop(0.5, th.grass); g.addColorStop(1, '#1d261d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const cx = w / 2; const roadW = Math.max(60, Math.min(120, w * 0.14));
  const carY = h - 70; const scale = (carY - 30) / VIEW_FT; // px per ft
  const yOf = (ft: number): number => carY - ft * scale;
  // road
  ctx.fillStyle = th.road; ctx.fillRect(cx - roadW / 2, 0, roadW, h);
  ctx.strokeStyle = th.roadEdge; ctx.lineWidth = 2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(cx - roadW / 2, 0); ctx.lineTo(cx - roadW / 2, h); ctx.moveTo(cx + roadW / 2, 0); ctx.lineTo(cx + roadW / 2, h); ctx.stroke();
  ctx.strokeStyle = '#d9b84a'; ctx.lineWidth = 2; ctx.setLineDash([14, 18]); ctx.lineDashOffset = -((obs?.tod ?? 0) * 60) % 32;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([]);
  const showFt = ov.showDistances !== false;
  // distance scale on the left: feet in training mode, unnumbered markers in legal mode
  for (let d = 250; d <= VIEW_FT; d += 250) { const y = yOf(d); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(cx - roadW / 2 - (showFt ? 40 : 24), y); ctx.lineTo(cx - roadW / 2 - 8, y); ctx.stroke(); if (showFt) label(ctx, `${d} ft`, cx - roadW / 2 - 44, y, 11, th.muted, '500', 'right'); }
  // decision-point marker: call turns before here (500-600 ft out)
  const yd = yOf(CALL_TURN_FT); ctx.strokeStyle = 'rgba(79,209,197,0.55)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx - roadW / 2 - 6, yd); ctx.lineTo(cx + roadW / 2 + 6, yd); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, 'call turns before here', cx + roadW / 2 + 10, yd, 10, 'rgba(79,209,197,0.8)', '500', 'left');
  // features
  const feats = (obs?.ahead ?? []).filter(f => f && Number.isFinite(f.approxDistanceFt));
  const sightLimit = feats.length ? Math.max(...feats.map(f => f.approxDistanceFt)) : 0;
  for (const f of [...feats].sort((a, b) => b.approxDistanceFt - a.approxDistanceFt)) drawFeature(ctx, f, cx, yOf(Math.min(VIEW_FT, f.approxDistanceFt)), roadW, th, showFt);
  // fog beyond sight: dim everything farther than the farthest visible feature (or 700 ft)
  const fogFrom = yOf(Math.max(700, sightLimit + 100));
  const fog = ctx.createLinearGradient(0, 0, 0, Math.max(1, fogFrom + 60)); fog.addColorStop(0, 'rgba(10,13,18,0.92)'); fog.addColorStop(1, 'rgba(10,13,18,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, w, Math.max(1, fogFrom + 60));
  label(ctx, 'beyond sight', cx, Math.max(14, fogFrom * 0.5), 11, 'rgba(200,210,220,0.5)', '500');
  if (ov.aheadDimmed) { ctx.fillStyle = 'rgba(10,13,18,0.7)'; ctx.fillRect(0, 0, w, h); label(ctx, 'eyes on the book', cx, h / 2, 16, th.muted, '600'); }
  // START-002: the pace cars, drawn smaller and in grey-blue so they are never mistaken for our own car
  for (const pc of ov.paceCars ?? []) {
    const y = pc.side === 'ahead' ? yOf(Math.min(VIEW_FT, Math.max(60, Math.abs(pc.distanceFt)))) : Math.min(h - 14, carY + 46 + Math.min(18, Math.abs(pc.distanceFt) / 80));
    ctx.save(); ctx.translate(cx + roadW * 0.18, y); roundRect(ctx, -9, -15, 18, 30, 5); ctx.fillStyle = '#5f7fa8'; ctx.fill(); ctx.strokeStyle = '#dbe6f5'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#c7defa'; ctx.fillRect(-6, -9, 12, 6); ctx.restore();
    label(ctx, pc.label, cx + roadW * 0.18 + 16, y, 10, th.muted, '600', 'left');
  }
  if (ov.gaining) label(ctx, 'we are gaining on them', cx + roadW * 0.18 + 16, 40, 11, th.accent2, '700', 'left');
  // car
  ctx.save(); ctx.translate(cx, carY);
  roundRect(ctx, -14, -24, 28, 48, 7); ctx.fillStyle = '#c8312b'; ctx.fill(); ctx.strokeStyle = '#f3efe4'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#9fd3ff'; ctx.fillRect(-10, -14, 20, 9); ctx.fillRect(-10, 8, 20, 7);
  ctx.restore();
  if (obs?.carStopped) label(ctx, 'STOPPED', cx, carY + 38, 12, th.accent, '700');
  if (ov.offCourseHint) label(ctx, 'This does not look like the route...', cx, carY - 60, 13, th.danger, '700');
  // overlays: pending callout + driver line (bottom-left), pace bar (bottom-right)
  const pad = 10; let y = h - pad;
  if (ov.driverLine) { boxText(ctx, `Dad: ${ov.driverLine}`, pad, y, 13, th, '#f3efe4', 'rgba(20,26,34,0.85)'); y -= 30; }
  if (ov.pendingCallout) boxText(ctx, `Pending: ${ov.pendingCallout}`, pad, y, 13, th, th.accent, 'rgba(20,26,34,0.85)');
  if (ov.paceMode === 'wait' && ov.waitMore !== null && ov.waitMore !== undefined) {
    const more = ov.waitMore; const txt = more > 0.05 ? `wait ${more.toFixed(1)} more s` : 'GO now';
    const col = more > 0.05 ? th.accent : th.ok;
    ctx.font = '700 14px Inter, sans-serif'; const tw = ctx.measureText(txt).width + 20;
    roundRect(ctx, w - pad - tw, h - pad - 26, tw, 26, 6); ctx.fillStyle = 'rgba(20,26,34,0.85)'; ctx.fill();
    label(ctx, txt, w - pad - tw / 2, h - pad - 13, 14, col, '700');
  } else if (ov.pace !== null && Number.isFinite(ov.pace)) {
    const arrow = ov.paceMode === 'arrow';
    const txt = arrow ? (ov.pace > 0.5 ? 'LATE \u25BC' : ov.pace < -0.5 ? 'EARLY \u25B2' : 'on time') : `${ov.pace > 0 ? '+' : ''}${ov.pace.toFixed(1)} s ${ov.pace > 0.05 ? 'late' : ov.pace < -0.05 ? 'early' : ''}`;
    const col = Math.abs(ov.pace) < 1 ? th.ok : ov.pace > 0 ? th.danger : th.accent2;
    ctx.font = '700 14px Inter, sans-serif'; const tw = ctx.measureText(txt).width + 20;
    roundRect(ctx, w - pad - tw, h - pad - 26, tw, 26, 6); ctx.fillStyle = 'rgba(20,26,34,0.85)'; ctx.fill();
    label(ctx, txt, w - pad - tw / 2, h - pad - 13, 14, col, '700');
    if (!arrow) { const bw = 160, bx = w - pad - bw, by = h - pad - 40; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, 6);
      const frac = Math.max(-1, Math.min(1, ov.pace / 30)); ctx.fillStyle = col; ctx.fillRect(bx + bw / 2, by, frac * bw / 2, 6); }
  }
  if (ov.countdown !== null && Number.isFinite(ov.countdown) && ov.countdown > -1 && ov.countdown < 60) label(ctx, `change in ${Math.max(0, ov.countdown).toFixed(1)} s`, w - pad - 80, h - pad - 60, 14, th.accent, '700');
}

function boxText(ctx: CanvasRenderingContext2D, text: string, x: number, bottom: number, size: number, th: Theme, color: string, bg: string): void {
  ctx.font = `600 ${size}px Inter, sans-serif`; const tw = Math.min(ctx.measureText(text).width + 16, 520);
  roundRect(ctx, x, bottom - 24, tw, 24, 6); ctx.fillStyle = bg; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(x, bottom - 24, tw, 24); ctx.clip(); label(ctx, text, x + 8, bottom - 12, size, color, '600', 'left'); ctx.restore(); void th;
}

function drawFeature(ctx: CanvasRenderingContext2D, f: VisibleFeature, cx: number, y: number, roadW: number, th: Theme, showFt = true): void {
  const d = showFt ? `~${Math.round(f.approxDistanceFt)} ft` : '';
  switch (f.kind) {
    case 'intersection': {
      for (const e of f.exits ?? []) {
        const a = (e.angle - 90) * Math.PI / 180; // 0 = straight up
        const len = e.kind === 'road' ? 110 : 55;
        const ex = cx + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        ctx.lineWidth = e.kind === 'road' ? roadW * 0.8 : roadW * 0.35; ctx.strokeStyle = e.surface === 'gravel' ? '#5a4a36' : th.road; ctx.lineCap = 'butt';
        ctx.setLineDash(e.kind === 'road' ? [] : [6, 6]);
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 1.5; ctx.strokeStyle = th.roadEdge; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(ex, ey); ctx.setLineDash([2, 6]); ctx.stroke(); ctx.setLineDash([]);
        if (e.name) label(ctx, e.name, ex, ey - 10, 11, th.text, '600');
        if (e.controlOnExit && e.controlOnExit !== 'none') label(ctx, e.controlOnExit, ex, ey + 10, 9, th.muted, '600');
      }
      ctx.fillStyle = th.road; ctx.fillRect(cx - roadW / 2, y - roadW * 0.4, roadW, roadW * 0.8);
      if (f.control && f.control !== 'none') signGlyph(ctx, f.control, cx + roadW / 2 + 22, y - 26, 16, th, f.signalColor, f.gateDown);
      label(ctx, d, cx - roadW / 2 - 50, y, 11, th.accent, '600', 'right');
      break;
    }
    case 'sign': case 'landmark': case 'start': case 'finish': {
      const side = f.sign?.side === 'L' ? -1 : 1; const x = cx + side * (roadW / 2 + 26);
      if (f.sign) signShape(ctx, f.sign.shape, f.sign.text ?? null, x, y, th);
      else { ctx.fillStyle = f.kind === 'start' || f.kind === 'finish' ? th.accent : '#6b7a90'; roundRect(ctx, x - 22, y - 10, 44, 20, 4); ctx.fill(); label(ctx, f.kind === 'start' ? 'START' : f.kind === 'finish' ? 'FINISH' : (f.label ?? 'landmark').slice(0, 14), x, y, 9, '#111', '700'); }
      if (f.label && f.sign) label(ctx, f.label, x, y + 22, 10, th.muted, '500');
      if (f.control && f.control !== 'none') signGlyph(ctx, f.control, cx + roadW / 2 + 22, y - 26, 16, th, f.signalColor, f.gateDown);
      label(ctx, d, cx - roadW / 2 - 50, y, 11, th.accent, '600', 'right');
      break;
    }
    case 'checkpoint': {
      const x = cx + roadW / 2 + 30; ctx.fillStyle = '#1f8f4e'; roundRect(ctx, x - 30, y - 14, 60, 28, 4); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, f.label?.startsWith('OBS') ? 'OBS CP' : 'CHECKPOINT', x, y, 9, '#fff', '700');
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(cx - roadW / 2, y); ctx.lineTo(cx + roadW / 2, y); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, d, cx - roadW / 2 - 50, y, 11, th.ok, '600', 'right');
      break;
    }
    case 'slow': case 'construction': {
      if (f.kind === 'slow') { ctx.fillStyle = '#8a6d3b'; roundRect(ctx, cx - 12, y - 22, 24, 44, 5); ctx.fill(); label(ctx, 'SLOW', cx, y, 8, '#fff', '700'); }
      else { for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(cx - roadW / 2 + 8 + i * 12, y + 6); ctx.lineTo(cx - roadW / 2 + 12 + i * 12, y - 8); ctx.lineTo(cx - roadW / 2 + 16 + i * 12, y + 6); ctx.fill(); } }
      label(ctx, (f.label ?? f.kind).slice(0, 36), cx + roadW / 2 + 8, y, 11, th.accent, '600', 'left');
      label(ctx, d, cx - roadW / 2 - 50, y, 11, th.accent, '600', 'right');
      break;
    }
    case 'roadEnd': { ctx.fillStyle = '#c8312b'; ctx.fillRect(cx - roadW / 2, y - 6, roadW, 12); label(ctx, 'DEAD END', cx, y - 18, 12, th.danger, '700'); label(ctx, d, cx - roadW / 2 - 50, y, 11, th.danger, '600', 'right'); break; }
    case 'paceCar' as VisibleFeature['kind']: case 'car' as VisibleFeature['kind']: { ctx.save(); ctx.translate(cx + roadW * 0.18, y); roundRect(ctx, -9, -15, 18, 30, 5); ctx.fillStyle = '#5f7fa8'; ctx.fill(); ctx.strokeStyle = '#dbe6f5'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); label(ctx, (f.label ?? 'car one minute ahead').slice(0, 28), cx + roadW * 0.18 + 16, y, 10, th.muted, '600', 'left'); break; }
    default: label(ctx, `${f.kind} ${d}`, cx + roadW / 2 + 8, y, 11, th.muted, '500', 'left');
  }
}

function signShape(ctx: CanvasRenderingContext2D, shape: string, text: string | null, x: number, y: number, th: Theme): void {
  const t = text ?? '?';
  switch (shape) {
    case 'octagon': { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(x + 16 * Math.cos(a), y + 16 * Math.sin(a)); } ctx.closePath(); ctx.fillStyle = '#c8312b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); label(ctx, text ? 'STOP' : '', x, y, 9, '#fff', '700'); break; }
    case 'triangle': { ctx.beginPath(); ctx.moveTo(x - 16, y - 12); ctx.lineTo(x + 16, y - 12); ctx.lineTo(x, y + 14); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#c8312b'; ctx.lineWidth = 4; ctx.stroke(); if (text) label(ctx, 'YIELD', x, y - 4, 7, '#c8312b', '700'); break; }
    case 'diamond': { ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 18, y); ctx.lineTo(x, y + 18); ctx.lineTo(x - 18, y); ctx.closePath(); ctx.fillStyle = '#f0b35b'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke(); if (text) label(ctx, t.slice(0, 8), x, y, 7, '#111', '700'); break; }
    case 'rr': { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 16, y - 7); ctx.lineTo(x + 16, y + 7); ctx.moveTo(x - 16, y + 7); ctx.lineTo(x + 16, y - 7); ctx.stroke(); break; }
    case 'checkpoint': { ctx.fillStyle = '#1f8f4e'; roundRect(ctx, x - 24, y - 12, 48, 24, 4); ctx.fill(); label(ctx, 'CP', x, y, 10, '#fff', '700'); break; }
    case 'blade': case 'shield': case 'rect': default: {
      const w = Math.max(44, Math.min(120, (t.length * 6.5) + 14));
      ctx.fillStyle = shape === 'shield' ? '#2b58a8' : shape === 'blade' ? '#1f6f3f' : '#f3efe4'; roundRect(ctx, x - w / 2, y - 11, w, 22, 3); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
      label(ctx, text ? t.slice(0, 18) : '…', x, y, 9, shape === 'rect' ? '#111' : '#fff', '700');
    }
  }
  void th;
}

function signGlyph(ctx: CanvasRenderingContext2D, control: string, x: number, y: number, r: number, th: Theme, signalColor?: 'red' | 'green', gateDown?: boolean): void {
  switch (control) {
    case 'SIGNAL': { ctx.fillStyle = '#222'; roundRect(ctx, x - r * 0.45, y - r, r * 0.9, r * 2, 3); ctx.fill(); ctx.fillStyle = signalColor === 'red' ? '#e34948' : '#333'; ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = signalColor === 'green' ? '#1baf7a' : '#333'; ctx.beginPath(); ctx.arc(x, y + r * 0.55, r * 0.3, 0, 7); ctx.fill(); break; }
    case 'RR': { ctx.strokeStyle = gateDown ? th.danger : '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.45); ctx.lineTo(x + r, y + r * 0.45); ctx.moveTo(x - r, y + r * 0.45); ctx.lineTo(x + r, y - r * 0.45); ctx.stroke(); if (gateDown) label(ctx, 'GATES DOWN', x, y + r + 10, 9, th.danger, '700'); break; }
    case 'STOP': signShape(ctx, 'octagon', 'STOP', x, y, th); break;
    case 'YIELD': signShape(ctx, 'triangle', 'YIELD', x, y, th); break;
    case 'BLINKER': { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.fill(); ctx.fillStyle = '#eda100'; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, 7); ctx.fill(); break; }
    default: break;
  }
}

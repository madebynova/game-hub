import { rand } from '../core/math';
import { AirPocketSystem, COLLAPSE_WARNING_SECONDS, currentWeight, type CollapseState } from '../systems/hazards';
import type { AirPocketDef, Rect } from '../world/wreck';
import type { Current } from '../world/world';

type Ctx = CanvasRenderingContext2D;

export interface View {
  l: number;
  r: number;
  t: number;
  b: number;
}

const overlaps = (r: Rect, v: View, pad = 0) => r.x1 > v.l - pad && r.x0 < v.r + pad && r.y1 > v.t - pad && r.y0 < v.b + pad;

interface Streak {
  x: number;
  y: number;
  life: number;
  max: number;
  len: number;
  current: Current;
}

/** Flowing streaks that make currents readable before you swim into them. */
export class CurrentStreaks {
  private streaks: Streak[] = [];

  update(dt: number, currents: Current[], v: View) {
    for (const c of currents) {
      if (!overlaps(c.rect, v, 100)) continue;
      const x0 = Math.max(c.rect.x0, v.l - 100);
      const x1 = Math.min(c.rect.x1, v.r + 100);
      const y0 = Math.max(c.rect.y0, v.t - 100);
      const y1 = Math.min(c.rect.y1, v.b + 100);
      const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
      const target = Math.min(70, area / 9000);
      const have = this.streaks.filter((s) => s.current === c).length;
      for (let i = have; i < target && i < have + 4; i++) {
        this.streaks.push({ x: rand(x0, x1), y: rand(y0, y1), life: 0, max: rand(0.8, 1.8), len: rand(24, 70), current: c });
      }
    }
    for (const s of this.streaks) {
      const w = currentWeight(s.current.rect, s.x, s.y);
      s.x += s.current.fx * w * dt * 1.4;
      s.y += s.current.fy * w * dt * 1.4;
      s.life += dt;
    }
    this.streaks = this.streaks.filter((s) => s.life < s.max && overlaps(s.current.rect, v, 200));
  }

  draw(ctx: Ctx) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    for (const s of this.streaks) {
      const k = s.life / s.max;
      const w = currentWeight(s.current.rect, s.x, s.y);
      const alpha = Math.sin(k * Math.PI) * 0.3 * w;
      if (alpha < 0.01) continue;
      const mag = Math.hypot(s.current.fx, s.current.fy) || 1;
      const dx = (s.current.fx / mag) * s.len;
      const dy = (s.current.fy / mag) * s.len;
      ctx.strokeStyle = `rgba(200,240,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
  }
}

/** Cracked beams overhead, shaking before they fall, rubble afterwards. */
export function drawCollapses(ctx: Ctx, states: CollapseState[], t: number, v: View) {
  for (const s of states) {
    const r = s.def.rect;
    if (!overlaps(r, v, 80)) continue;
    const w = r.x1 - r.x0;
    ctx.lineCap = 'round';

    if (s.phase === 'fallen') {
      ctx.strokeStyle = '#3e342b';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(r.x0 + 8, r.y1 - 12);
      ctx.lineTo(r.x0 + w * 0.7, r.y1 - 24);
      ctx.moveTo(r.x0 + w * 0.35, r.y1 - 8);
      ctx.lineTo(r.x1 - 6, r.y1 - 16);
      ctx.stroke();
      ctx.fillStyle = '#2e2822';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(r.x0 + ((i * 37) % w), r.y1 - 6 - (i % 3) * 4, 5 + (i % 2) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    const warn = s.phase === 'warning' ? s.timer / COLLAPSE_WARNING_SECONDS : 0;
    const shake = warn > 0 ? Math.sin(t * 45) * 3 * (0.4 + warn) : 0;
    const sag = warn * 16;

    if (warn > 0) {
      ctx.fillStyle = `rgba(255,120,60,${0.05 + 0.06 * Math.sin(t * 12) ** 2})`;
      ctx.fillRect(r.x0, r.y0, w, r.y1 - r.y0);
    }
    // Two sagging beams with crack marks.
    ctx.strokeStyle = '#4a3f35';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(r.x0 + 6 + shake, r.y0 + 14);
    ctx.lineTo(r.x1 - 10 + shake, r.y0 + 44 + sag);
    ctx.moveTo(r.x0 + 12 - shake, r.y0 + 46 + sag);
    ctx.lineTo(r.x1 - 4 - shake, r.y0 + 20);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,90,0.55)';
    ctx.lineWidth = 1.5;
    const cx = (r.x0 + r.x1) / 2 + shake;
    const cy = r.y0 + 30 + sag * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 6);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 4, cy + 8);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 9, cy + 3);
    ctx.stroke();
    // Dust sifting down (faint when stable, heavy while groaning).
    const specks = warn > 0 ? 26 : 6;
    ctx.fillStyle = `rgba(200,180,150,${warn > 0 ? 0.55 : 0.25})`;
    for (let i = 0; i < specks; i++) {
      const fall = ((t * (warn > 0 ? 90 : 18) + i * 53) % (r.y1 - r.y0));
      ctx.fillRect(r.x0 + ((i * 71) % w), r.y0 + fall, 2, 2);
    }
  }
}

/** Shimmering trapped air under the wreck's ceiling, and a bubbling vent in the abyss. */
export function drawAirPockets(ctx: Ctx, defs: AirPocketDef[], sys: AirPocketSystem, t: number, v: View) {
  for (const d of defs) {
    if (d.x < v.l - 120 || d.x > v.r + 120 || d.y < v.t - 160 || d.y > v.b + 160) continue;
    const frac = sys.fraction(d.id);
    if (d.kind === 'trapped') {
      const rx = d.r * (0.45 + 0.55 * frac) + Math.sin(t * 3) * 1.5;
      const ry = rx * 0.6;
      const g = ctx.createRadialGradient(d.x, d.y - ry * 0.3, 1, d.x, d.y, rx);
      g.addColorStop(0, `rgba(235,250,255,${0.25 + 0.45 * frac})`);
      g.addColorStop(1, `rgba(170,220,240,${0.08 + 0.15 * frac})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx, ry, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.5 * frac})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x - rx, d.y);
      for (let x = -rx; x <= rx; x += 4) ctx.lineTo(d.x + x, d.y + Math.sin(x * 0.3 + t * 4) * 1.5);
      ctx.stroke();
    } else {
      const baseY = d.y + 70;
      const glow = ctx.createRadialGradient(d.x, baseY, 2, d.x, baseY, 60);
      glow.addColorStop(0, `rgba(255,160,90,${0.25 + 0.3 * frac})`);
      glow.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(d.x - 60, baseY - 60, 120, 120);
      ctx.fillStyle = '#2b2530';
      ctx.beginPath();
      ctx.moveTo(d.x - 26, baseY + 6);
      ctx.lineTo(d.x - 8, baseY - 10);
      ctx.lineTo(d.x + 8, baseY - 10);
      ctx.lineTo(d.x + 26, baseY + 6);
      ctx.fill();
      const n = Math.round(6 + 14 * frac);
      ctx.strokeStyle = 'rgba(220,245,255,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const rise = ((t * 60 + i * 23) % 150);
        const bx = d.x + Math.sin(t * 2 + i) * (4 + rise * 0.08);
        ctx.beginPath();
        ctx.arc(bx, baseY - 10 - rise, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

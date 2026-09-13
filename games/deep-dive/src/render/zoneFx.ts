import { damp } from '../core/math';
import { ZONES, zoneAt } from '../world/zones';
import type { View } from './hazardArt';

type Ctx = CanvasRenderingContext2D;

interface School {
  homeX: number;
  homeY: number;
  phase: number;
  color: string;
  offsets: { dx: number; dy: number; s: number; p: number }[];
}

const parseRgba = (s: string) => (s.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number) as [number, number, number, number];
const TINTS = Object.fromEntries(Object.values(ZONES).map((z) => [z.id, parseRgba(z.tint)]));

const MOTE_TILE = 600;

/** Ambient life and atmosphere that tell the zones apart at a glance. */
export class ZoneAmbience {
  private schools: School[];
  private tint: [number, number, number, number] = [...TINTS.reef] as [number, number, number, number];
  private motes = Array.from({ length: 26 }, () => ({ x: Math.random() * MOTE_TILE, y: Math.random() * MOTE_TILE, p: Math.random() * 10, s: 0.6 + Math.random() }));

  constructor() {
    const homes: [number, number, string][] = [
      [600, 380, '#ffb35c'], [1100, 330, '#7fd6ff'], [1500, 520, '#ffe07a'], [1780, 640, '#ff8fa3'], [350, 260, '#9df5c8'],
    ];
    this.schools = homes.map(([homeX, homeY, color], i) => ({
      homeX, homeY, color, phase: i * 1.7,
      offsets: Array.from({ length: 7 + (i % 3) * 2 }, (_, k) => ({ dx: Math.cos(k * 2.4) * (12 + k * 5), dy: Math.sin(k * 3.1) * (8 + k * 2), s: 0.8 + ((k * 37) % 10) / 20, p: k })),
    }));
  }

  /** Reef fish that scatter from the diver. Purely decorative. */
  drawFish(ctx: Ctx, v: View, t: number, px: number, py: number) {
    for (const sc of this.schools) {
      const cx = sc.homeX + Math.sin(t * 0.12 + sc.phase) * 220;
      const cy = sc.homeY + Math.sin(t * 0.21 + sc.phase) * 60;
      if (cx < v.l - 200 || cx > v.r + 200 || cy < v.t - 200 || cy > v.b + 200) continue;
      const dir = Math.cos(t * 0.12 + sc.phase) >= 0 ? 1 : -1;
      ctx.fillStyle = sc.color;
      for (const f of sc.offsets) {
        let x = cx + f.dx + Math.sin(t * 1.3 + f.p) * 6;
        let y = cy + f.dy + Math.cos(t * 1.1 + f.p) * 4;
        const d = Math.hypot(x - px, y - py);
        if (d < 170) {
          const push = ((170 - d) / 170) ** 2 * 90;
          x += ((x - px) / (d || 1)) * push;
          y += ((y - py) / (d || 1)) * push;
        }
        const wiggle = Math.sin(t * 12 + f.p) * 0.25;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir * f.s, f.s);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
        ctx.moveTo(-6, 0);
        ctx.lineTo(-12, -4 + wiggle * 8);
        ctx.lineTo(-12, 4 + wiggle * 8);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Glowing plankton in the abyss, rusty flecks around the wreck. Drawn above the darkness. */
  drawMotes(ctx: Ctx, v: View, t: number) {
    const tx0 = Math.floor(v.l / MOTE_TILE);
    const tx1 = Math.floor(v.r / MOTE_TILE);
    const ty0 = Math.floor(Math.max(500, v.t) / MOTE_TILE);
    const ty1 = Math.floor(v.b / MOTE_TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        for (const m of this.motes) {
          const x = tx * MOTE_TILE + m.x + Math.sin(t * 0.3 + m.p) * 14;
          const y = ty * MOTE_TILE + ((m.y - t * 5 * m.s) % MOTE_TILE + MOTE_TILE) % MOTE_TILE;
          const zone = zoneAt(x, y);
          if (zone === 'abyss') {
            const a = (0.35 + 0.35 * Math.sin(t * 1.5 + m.p * 3)) * m.s;
            ctx.fillStyle = m.p > 5 ? `rgba(140,230,255,${a})` : `rgba(200,150,255,${a})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.4 * m.s + 0.6, 0, Math.PI * 2);
            ctx.fill();
          } else if (zone === 'wreck') {
            ctx.fillStyle = 'rgba(190,160,120,0.22)';
            ctx.fillRect(x, y, 2.2 * m.s, 1.4 * m.s);
          }
        }
      }
    }
  }

  /** Screen-space colour wash that eases towards the zone the camera is in. */
  drawTint(ctx: Ctx, w: number, h: number, camX: number, camY: number, dt: number) {
    const target = camY <= 0 ? [0, 0, 0, 0] : TINTS[zoneAt(camX, camY)];
    for (let i = 0; i < 4; i++) this.tint[i] = damp(this.tint[i], target[i], 1.5, dt);
    if (this.tint[3] < 0.005) return;
    const [r, g, b, a] = this.tint;
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
    ctx.fillRect(0, 0, w, h);
  }
}

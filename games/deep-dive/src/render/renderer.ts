import { BOAT, PX_PER_METER, WORLD } from '../config';
import { clamp, damp } from '../core/math';
import type { LostSatchel } from '../core/save';
import { RARITIES, TREASURES } from '../data/treasures';
import type { Player } from '../entities/player';
import type { TreasureField } from '../entities/treasure';
import type { OxygenStatus } from '../systems/oxygen';
import type { World } from '../world/world';
import { drawDiver } from './diverArt';
import type { Effects } from './effects';
import { drawSatchel, drawTreasure } from './treasureArt';

export interface InteractTarget {
  x: number;
  y: number;
  progress: number;
  color: string;
  blocked: boolean;
}

export interface Scene {
  time: number;
  dt: number;
  world: World;
  player: Player;
  treasures: TreasureField;
  effects: Effects;
  satchel: LostSatchel | null;
  lightRadius: number;
  interact: InteractTarget | null;
  oxygenStatus: OxygenStatus;
  /** 0..1 progress through the out-of-air grace period. */
  drowning: number;
  /** 0..1 fade to black. */
  fade: number;
}

interface View {
  l: number;
  r: number;
  t: number;
  b: number;
}

export const boatBob = (t: number) => Math.sin(t * 1.3) * 2;
const wave = (x: number, t: number) => Math.sin(x * 0.018 + t * 1.4) * 3 + Math.sin(x * 0.047 - t * 2.2) * 1.6;

const SNOW_TILE = 700;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dark = document.createElement('canvas');
  private dctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  scale = 1;
  cam = { x: BOAT.x + 120, y: -40 };
  private snow = Array.from({ length: 55 }, () => ({ x: Math.random() * SNOW_TILE, y: Math.random() * SNOW_TILE, s: 0.6 + Math.random() * 1.5, p: Math.random() * 10 }));

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.dctx = this.dark.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.dark.width = Math.ceil(this.w / 2);
    this.dark.height = Math.ceil(this.h / 2);
    this.scale = clamp(this.h / 820, 0.75, 1.5);
  }

  follow(tx: number, ty: number, dt: number, rate = 3.5) {
    this.cam.x = damp(this.cam.x, tx, rate, dt);
    this.cam.y = damp(this.cam.y, ty, rate, dt);
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    this.cam.x = WORLD.width < halfW * 2 ? WORLD.width / 2 : clamp(this.cam.x, halfW, WORLD.width - halfW);
    this.cam.y = clamp(this.cam.y, -halfH * 0.8, WORLD.bottom - halfH);
  }

  private view(): View {
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    return { l: this.cam.x - halfW, r: this.cam.x + halfW, t: this.cam.y - halfH, b: this.cam.y + halfH };
  }

  private applyWorld(ctx: CanvasRenderingContext2D, parallax = 1) {
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, this.dpr * (this.w / 2 - this.cam.x * parallax * this.scale), this.dpr * (this.h / 2 - this.cam.y * parallax * this.scale));
  }

  render(s: Scene) {
    const { ctx } = this;
    const v = this.view();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#030a1a';
    ctx.fillRect(0, 0, this.w, this.h);

    this.applyWorld(ctx);
    if (v.t < 20) this.drawSky(s, v);
    this.drawWater(s, v);
    this.drawRays(s, v);
    this.drawRidge(s, 0.35, 250, 'rgba(38,92,128,0.28)', 70);
    this.drawRidge(s, 0.6, 180, 'rgba(18,56,88,0.42)', 45);
    this.applyWorld(ctx);
    this.drawWreck(s);
    this.drawShrine(s);
    this.drawKelp(s, v, false);
    this.drawAnchorLine(s);
    this.drawTerrain(s, v);
    this.drawCorals(s, v);
    this.drawRocks(s, v);
    this.drawGlowPlants(s, v);
    this.drawCliffs(v);
    this.drawTreasures(s, v);
    if (s.satchel) drawSatchel(ctx, s.satchel.x, s.satchel.y, s.time);
    this.drawBoat(s);
    drawDiver(ctx, s.player, s.player.mode === 'deck' ? boatBob(s.time) : 0);
    this.drawKelp(s, v, true);
    s.effects.drawParticles(ctx);
    this.drawSnow(s, v);
    this.drawSurface(s, v);

    this.drawDarkness(s, v);

    this.applyWorld(ctx);
    this.drawGlints(s, v);
    this.drawInteract(s);
    s.effects.drawTexts(ctx);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawVignettes(s);
  }

  // ---------------------------------------------------------------- sky & water

  private drawSky(s: Scene, v: View) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, -760, 0, 0);
    g.addColorStop(0, '#0d1430');
    g.addColorStop(0.45, '#2f3566');
    g.addColorStop(0.78, '#a4607a');
    g.addColorStop(1, '#f2a46c');
    ctx.fillStyle = g;
    ctx.fillRect(v.l, v.t, v.r - v.l, -v.t + 20);

    // Low sun that drifts slowly with the camera (feels far away).
    const sx = this.cam.x * 0.9 + 300;
    const sy = -120;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 320);
    sg.addColorStop(0, 'rgba(255,214,150,0.55)');
    sg.addColorStop(0.2, 'rgba(255,170,110,0.25)');
    sg.addColorStop(1, 'rgba(255,150,110,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 320, sy - 320, 640, 340);
    ctx.fillStyle = '#ffe2b0';
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.fill();

    // Wispy clouds.
    ctx.fillStyle = 'rgba(255,200,190,0.16)';
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 830 + s.time * 6) % 5200) - 500 + this.cam.x * 0.8 - 1400;
      const cy = -260 - (i % 3) * 90;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 160 + (i % 2) * 90, 9 + (i % 3) * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant islands on the horizon.
    ctx.fillStyle = '#3e2f55';
    ctx.beginPath();
    const ox = this.cam.x * 0.85;
    ctx.moveTo(v.l, 2);
    for (let x = v.l; x <= v.r + 40; x += 40) {
      const lx = x - ox;
      const h = Math.max(0, Math.sin(lx * 0.004) * 30 + Math.sin(lx * 0.011) * 12 - 8);
      ctx.lineTo(x, -h);
    }
    ctx.lineTo(v.r + 40, 2);
    ctx.fill();
  }

  private drawWater(s: Scene, v: View) {
    const { ctx } = this;
    if (v.b < -10) return;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.bottom);
    g.addColorStop(0, '#3aa1b3');
    g.addColorStop(0.05, '#1f7896');
    g.addColorStop(0.22, '#11507a');
    g.addColorStop(0.48, '#0b2c52');
    g.addColorStop(0.75, '#071837');
    g.addColorStop(1, '#030a1a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(v.l - 10, v.b + 10);
    for (let x = v.l - 10; x <= v.r + 20; x += 12) ctx.lineTo(x, wave(x, s.time));
    ctx.lineTo(v.r + 20, v.b + 10);
    ctx.fill();
  }

  private drawRays(s: Scene, v: View) {
    if (v.t > 1100) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spacing = 230;
    for (let k = Math.floor(v.l / spacing) - 3; k <= Math.ceil(v.r / spacing) + 1; k++) {
      const x0 = k * spacing + Math.sin(k * 12.9) * 80;
      const sway = Math.sin(s.time * 0.35 + k) * 40;
      const w = 26 + (Math.sin(k * 7.1) * 0.5 + 0.5) * 56;
      const alpha = (0.5 + 0.5 * Math.sin(s.time * 0.6 + k * 1.7)) * 0.07 + 0.015;
      const len = 650 + (((k % 3) + 3) % 3) * 220;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(190,245,255,${alpha})`);
      g.addColorStop(1, 'rgba(190,245,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - w / 2, 0);
      ctx.lineTo(x0 + w / 2, 0);
      ctx.lineTo(x0 + w * 1.3 + 200 + sway, len);
      ctx.lineTo(x0 - w * 0.3 + 200 + sway, len);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Distant underwater ridges drawn with parallax for depth. */
  private drawRidge(s: Scene, f: number, offset: number, color: string, amp: number) {
    const { ctx } = this;
    this.applyWorld(ctx, f);
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    const l = this.cam.x * f - halfW - 30;
    const r = this.cam.x * f + halfW + 30;
    const bottom = this.cam.y * f + halfH + 30;
    const surfaceY = this.cam.y * (f - 1) + 40;
    if (surfaceY > bottom) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(l, bottom);
    for (let lx = l; lx <= r + 24; lx += 24) {
      const y = f * (s.world.floorY(lx / f) - 380) + offset + Math.sin(lx * 0.009 / f) * amp + Math.sin(lx * 0.031) * amp * 0.35;
      ctx.lineTo(lx, Math.max(surfaceY, y));
    }
    ctx.lineTo(r + 24, bottom);
    ctx.fill();
  }

  // ---------------------------------------------------------------- landmarks

  private drawWreck(s: Scene) {
    const { ctx } = this;
    const { x, y, angle } = s.world.wreck;
    ctx.save();
    ctx.translate(x, y + 18);
    ctx.rotate(angle);
    // Hull
    ctx.fillStyle = '#2e3236';
    ctx.beginPath();
    ctx.moveTo(-210, -70);
    ctx.lineTo(170, -86);
    ctx.quadraticCurveTo(230, -60, 200, 10);
    ctx.lineTo(-180, 16);
    ctx.quadraticCurveTo(-225, -20, -210, -70);
    ctx.fill();
    // Planks
    ctx.strokeStyle = 'rgba(120,110,95,0.35)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-205, -70 + i * 17);
      ctx.lineTo(200, -84 + i * 18);
      ctx.stroke();
    }
    // Broken hole revealing the hold
    ctx.fillStyle = '#0d1a2a';
    ctx.beginPath();
    ctx.moveTo(-120, -60);
    ctx.lineTo(-40, -74);
    ctx.lineTo(10, -50);
    ctx.lineTo(90, -70);
    ctx.lineTo(110, -10);
    ctx.lineTo(-130, -2);
    ctx.fill();
    // Ribs
    ctx.strokeStyle = '#3d4247';
    ctx.lineWidth = 7;
    for (const rx of [-90, -30, 30, 80]) {
      ctx.beginPath();
      ctx.moveTo(rx, -4);
      ctx.quadraticCurveTo(rx + 10, -50, rx + 4, -76);
      ctx.stroke();
    }
    // Broken mast
    ctx.strokeStyle = '#3a3531';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(20, -80);
    ctx.lineTo(90, -250);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60, -180);
    ctx.lineTo(140, -170);
    ctx.stroke();
    ctx.restore();
  }

  private drawShrine(s: Scene) {
    const { ctx } = this;
    const { x, y } = s.world.shrine;
    ctx.save();
    ctx.translate(x, y + 10);
    ctx.fillStyle = '#2b3846';
    // Pillars
    ctx.fillRect(-120, -210, 34, 210);
    ctx.fillRect(86, -150, 34, 150);
    ctx.fillRect(-130, -225, 54, 18);
    // Broken arch
    ctx.beginPath();
    ctx.moveTo(-86, -205);
    ctx.quadraticCurveTo(-20, -265, 40, -232);
    ctx.lineTo(34, -214);
    ctx.quadraticCurveTo(-20, -240, -86, -185);
    ctx.fill();
    // Altar
    ctx.fillStyle = '#34465a';
    ctx.fillRect(-60, -34, 120, 34);
    ctx.fillRect(-72, -44, 144, 12);
    // Glowing glyphs
    const glow = 0.35 + 0.25 * Math.sin(s.time * 1.5);
    ctx.fillStyle = `rgba(120,240,255,${glow})`;
    for (const gy of [-180, -140, -100, -60]) {
      ctx.fillRect(-108, gy, 10, 4);
      ctx.fillRect(-104, gy + 8, 3, 10);
    }
    ctx.fillRect(-20, -24, 40, 3);
    ctx.restore();
  }

  private drawAnchorLine(s: Scene) {
    const { ctx } = this;
    const x = BOAT.deckLeft - 52;
    const floor = s.world.floorY(x);
    ctx.save();
    ctx.strokeStyle = 'rgba(220,205,170,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.quadraticCurveTo(x + Math.sin(s.time * 0.8) * 10, floor / 2, x + 8, floor - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 11px Rubik, system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let m = 10; m * PX_PER_METER < floor - 30; m += 10) {
      const my = m * PX_PER_METER;
      const mx = x + Math.sin(s.time * 0.8) * 10 * (1 - Math.abs(my / floor - 0.5) * 2) * 0.5;
      ctx.fillStyle = '#e9b64c';
      ctx.fillRect(mx - 5, my - 2, 10, 4);
      ctx.fillStyle = 'rgba(230,240,245,0.55)';
      ctx.fillText(`${m}m`, mx + 9, my + 4);
    }
    // Anchor
    ctx.strokeStyle = '#6f7880';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 8, floor - 30);
    ctx.lineTo(x + 8, floor - 6);
    ctx.arc(x + 8, floor - 16, 11, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- terrain

  private drawTerrain(s: Scene, v: View) {
    const { ctx } = this;
    const w = s.world;
    const step = w.floorStep;
    const i0 = Math.max(0, Math.floor(v.l / step) - 1);
    const i1 = Math.min(w.floor.length - 1, Math.ceil(v.r / step) + 1);
    const bottom = v.b + 20;

    const path = (offset: number) => {
      ctx.beginPath();
      ctx.moveTo(i0 * step, bottom);
      for (let i = i0; i <= i1; i++) ctx.lineTo(i * step, w.floorSample(i) + offset);
      ctx.lineTo(i1 * step, bottom);
      ctx.closePath();
    };

    const g = ctx.createLinearGradient(0, 400, 0, 3000);
    g.addColorStop(0, '#c7ab7a');
    g.addColorStop(0.2, '#8e7a5b');
    g.addColorStop(0.45, '#4a4a50');
    g.addColorStop(1, '#171b26');
    ctx.fillStyle = g;
    path(0);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    path(34);
    ctx.fill();
    path(120);
    ctx.fill();

    // Pebbles
    for (let i = i0; i <= i1; i++) {
      const h = Math.abs(Math.sin(i * 91.7) * 43758) % 1;
      if (h < 0.55) continue;
      ctx.fillStyle = h > 0.8 ? 'rgba(255,240,210,0.16)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(i * step + h * 12, w.floorSample(i) + 7 + h * 22, 2 + h * 3, 1.5 + h * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sunlit rim
    ctx.strokeStyle = 'rgba(255,240,205,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const y = w.floorSample(i);
      if (i === i0) ctx.moveTo(i * step, y);
      else ctx.lineTo(i * step, y);
    }
    ctx.stroke();
  }

  private drawRocks(s: Scene, v: View) {
    const { ctx } = this;
    for (const rock of s.world.rocks) {
      if (rock.x + rock.r < v.l || rock.x - rock.r > v.r || rock.y - rock.r > v.b || rock.y + rock.r < v.t) continue;
      const n = rock.shape.length;
      const pts = rock.shape.map((m, k) => {
        const a = (k / n) * Math.PI * 2;
        return [rock.x + Math.cos(a) * rock.r * m, rock.y + Math.sin(a) * rock.r * m * 0.88];
      });
      const g = ctx.createLinearGradient(0, rock.y - rock.r, 0, rock.y + rock.r);
      const lt = 95 + rock.tone * 25;
      g.addColorStop(0, `rgb(${lt - 20},${lt},${lt + 15})`);
      g.addColorStop(1, '#1e242d');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const [x1, y1] = pts[k];
        const [x2, y2] = pts[(k + 1) % n];
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        if (k === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(x1, y1, mx, my);
      }
      const [x1, y1] = pts[0];
      const [x2, y2] = pts[1];
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
      ctx.fill();
      // Algae cap in the sunlit shallows
      if (rock.y < 1300 && rock.r > 20) {
        ctx.strokeStyle = 'rgba(110,170,90,0.45)';
        ctx.lineWidth = Math.max(3, rock.r * 0.12);
        ctx.beginPath();
        ctx.ellipse(rock.x, rock.y, rock.r * 0.8, rock.r * 0.72, 0, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
    }
  }

  private drawKelp(s: Scene, v: View, front: boolean) {
    const { ctx } = this;
    ctx.lineCap = 'round';
    for (const k of s.world.kelp) {
      if (k.front !== front || k.x < v.l - 60 || k.x > v.r + 60 || k.baseY - k.height > v.b || k.baseY < v.t) continue;
      const segs = 9;
      ctx.strokeStyle = front ? 'rgba(20,62,44,0.92)' : k.baseY < 900 ? '#3b8a55' : '#2a6448';
      ctx.lineWidth = front ? k.width * 1.5 : k.width;
      ctx.beginPath();
      ctx.moveTo(k.x, k.baseY);
      let px = k.x;
      let py = k.baseY;
      const pts: [number, number][] = [];
      for (let j = 1; j <= segs; j++) {
        py = k.baseY - (k.height * j) / segs;
        px = k.x + Math.sin(s.time * 0.9 + k.phase + j * 0.45) * j * 2.4;
        ctx.lineTo(px, py);
        pts.push([px, py]);
      }
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      for (let j = 1; j < pts.length; j += 2) {
        const [lx, ly] = pts[j];
        const side = j % 4 === 1 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(lx + side * 8, ly + 4, 10, 3.5, side * 0.6 + Math.sin(s.time + j) * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCorals(s: Scene, v: View) {
    const { ctx } = this;
    for (const c of s.world.corals) {
      if (c.x < v.l - 40 || c.x > v.r + 40 || c.y < v.t || c.y - c.size > v.b) continue;
      const col = `hsl(${c.hue},62%,58%)`;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      if (c.kind === 'brain') {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.size * 0.8, c.size * 0.55, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = `hsla(${c.hue},60%,35%,0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.size * 0.5, c.size * 0.3, 0, Math.PI, 0);
        ctx.stroke();
      } else if (c.kind === 'tube') {
        for (let i = -1; i <= 1; i++) {
          const h = c.size * (1 - Math.abs(i) * 0.3);
          ctx.beginPath();
          ctx.roundRect(c.x + i * 7 - 3, c.y - h, 6, h, 3);
          ctx.fill();
        }
      } else {
        ctx.lineWidth = 2;
        const sway = Math.sin(s.time * 0.8 + c.x) * 0.08;
        for (let i = -3; i <= 3; i++) {
          const a = -Math.PI / 2 + i * 0.22 + sway;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.cos(a) * c.size, c.y + Math.sin(a) * c.size);
          ctx.stroke();
        }
      }
    }
  }

  private drawGlowPlants(s: Scene, v: View) {
    const { ctx } = this;
    for (const g of s.world.glowPlants) {
      if (g.x < v.l - 40 || g.x > v.r + 40 || g.y < v.t || g.y - g.height > v.b) continue;
      const tip = g.x + Math.sin(s.time * 0.7 + g.phase) * 6;
      ctx.strokeStyle = `hsla(${g.hue},50%,30%,0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x, g.y - g.height * 0.6, tip, g.y - g.height);
      ctx.stroke();
      const pulse = 0.6 + 0.4 * Math.sin(s.time * 1.8 + g.phase);
      ctx.fillStyle = `hsla(${g.hue},95%,70%,${pulse})`;
      ctx.beginPath();
      ctx.arc(tip, g.y - g.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Rock walls marking the edges of the dive site. */
  private drawCliffs(v: View) {
    const { ctx } = this;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? WORLD.wallMargin - 14 : WORLD.width - WORLD.wallMargin + 14;
      if (side < 0 && v.l > edge + 60) continue;
      if (side > 0 && v.r < edge - 60) continue;
      const outer = side < 0 ? -200 : WORLD.width + 200;
      const g = ctx.createLinearGradient(0, -120, 0, 2600);
      g.addColorStop(0, '#4b4a5c');
      g.addColorStop(0.15, '#2e3a48');
      g.addColorStop(1, '#0c111a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(outer, -150);
      const top = -110;
      ctx.lineTo(edge - side * 60, top);
      for (let y = top + 40; y <= WORLD.bottom + 40; y += 40) {
        const jag = Math.sin(y * 0.021 + side) * 18 + Math.sin(y * 0.063) * 8;
        ctx.lineTo(edge + side * jag * -1 + (y < 0 ? -side * 40 * (1 - (y - top) / -top) : 0), y);
      }
      ctx.lineTo(outer, WORLD.bottom + 40);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- entities

  private drawTreasures(s: Scene, v: View) {
    for (const t of s.treasures.items) {
      if (t.collected || t.x < v.l - 40 || t.x > v.r + 40 || t.y < v.t - 40 || t.y > v.b + 40) continue;
      drawTreasure(this.ctx, t.item.defId, t.x, t.y, s.time, t.phase);
    }
  }

  private drawBoat(s: Scene) {
    const { ctx } = this;
    const t = s.time;
    const L = BOAT.deckLeft;
    const R = BOAT.deckRight;
    const D = BOAT.deckY + boatBob(t);
    ctx.save();
    ctx.translate(BOAT.x, D);
    ctx.rotate(Math.sin(t * 1.1) * 0.01);
    ctx.translate(-BOAT.x, -D);

    // Mast, boom and diver-down flag
    const mx = L + 150;
    ctx.strokeStyle = '#5a4636';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(mx, D);
    ctx.lineTo(mx, D - 160);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(230,220,200,0.6)';
    ctx.beginPath();
    ctx.moveTo(mx, D - 150);
    ctx.lineTo(R + 30, D + 14);
    ctx.moveTo(mx, D - 150);
    ctx.lineTo(L - 60, D - 14);
    ctx.stroke();
    const fw = Math.sin(t * 4) * 3;
    ctx.fillStyle = '#d6453d';
    ctx.beginPath();
    ctx.moveTo(mx + 2, D - 160);
    ctx.lineTo(mx + 44, D - 158 + fw);
    ctx.lineTo(mx + 44, D - 130 + fw);
    ctx.lineTo(mx + 2, D - 132);
    ctx.fill();
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(mx + 3, D - 158);
    ctx.lineTo(mx + 43, D - 132 + fw);
    ctx.stroke();

    // Cabin with warm lantern windows
    const cx = L + 10;
    ctx.fillStyle = '#e3d8bf';
    ctx.fillRect(cx, D - 80, 118, 80);
    ctx.fillStyle = '#8f3a2f';
    ctx.beginPath();
    ctx.moveTo(cx - 10, D - 80);
    ctx.lineTo(cx + 128, D - 80);
    ctx.lineTo(cx + 116, D - 96);
    ctx.lineTo(cx + 2, D - 96);
    ctx.fill();
    const lg = ctx.createRadialGradient(cx + 60, D - 50, 0, cx + 60, D - 50, 110);
    lg.addColorStop(0, 'rgba(255,210,120,0.35)');
    lg.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - 50, D - 160, 220, 200);
    ctx.fillStyle = '#ffd680';
    ctx.fillRect(cx + 16, D - 64, 30, 22);
    ctx.fillRect(cx + 62, D - 64, 30, 22);
    ctx.fillStyle = 'rgba(90,60,40,0.6)';
    ctx.fillRect(cx + 30, D - 64, 2, 22);
    ctx.fillRect(cx + 76, D - 64, 2, 22);
    // Treasure crates by the cabin (the trading spot)
    ctx.fillStyle = '#9a6d3f';
    ctx.fillRect(cx + 128, D - 26, 30, 26);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 128, D - 26, 30, 26);
    ctx.fillStyle = '#e9b64c';
    ctx.fillRect(cx + 139, D - 16, 8, 6);

    // Hull
    const hg = ctx.createLinearGradient(0, D - 6, 0, D + 48);
    hg.addColorStop(0, '#f2ead8');
    hg.addColorStop(0.36, '#ded2b8');
    hg.addColorStop(0.37, '#c2463a');
    hg.addColorStop(0.52, '#c2463a');
    hg.addColorStop(0.53, '#243a4f');
    hg.addColorStop(1, '#142333');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(L - 80, D - 18);
    ctx.lineTo(L - 20, D);
    ctx.lineTo(R + 8, D);
    ctx.lineTo(R + 8, D + 44);
    ctx.lineTo(L + 20, D + 48);
    ctx.quadraticCurveTo(L - 45, D + 34, L - 80, D - 18);
    ctx.fill();
    ctx.fillStyle = '#b7aa8e';
    ctx.fillRect(L - 20, D - 3, R - L + 28, 4);
    // Stern swim platform + ladder
    ctx.fillStyle = '#8b6b4a';
    ctx.fillRect(R + 8, D + 14, 34, 6);
    ctx.strokeStyle = '#c9cfd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R + 20, D + 20);
    ctx.lineTo(R + 20, D + 58);
    ctx.moveTo(R + 32, D + 20);
    ctx.lineTo(R + 32, D + 58);
    for (let ly = D + 30; ly < D + 58; ly += 10) {
      ctx.moveTo(R + 20, ly);
      ctx.lineTo(R + 32, ly);
    }
    ctx.stroke();
    // Bow rail
    ctx.strokeStyle = '#dcd5c3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L - 70, D - 40);
    ctx.lineTo(L + 10, D - 24);
    for (let x = L - 60; x <= L + 10; x += 22) {
      ctx.moveTo(x, D - 38 + (x - L + 60) * 0.2);
      ctx.lineTo(x, D - 8 + Math.min(0, (x - L + 20) * 0.3));
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawSnow(s: Scene, v: View) {
    const { ctx } = this;
    if (v.b < 40) return;
    ctx.fillStyle = 'rgba(210,235,245,0.35)';
    const tx0 = Math.floor(v.l / SNOW_TILE);
    const tx1 = Math.floor(v.r / SNOW_TILE);
    const ty0 = Math.floor(Math.max(0, v.t) / SNOW_TILE);
    const ty1 = Math.floor(v.b / SNOW_TILE);
    for (const p of this.snow) {
      p.y = (p.y + s.dt * 7 * p.s) % SNOW_TILE;
      p.p += s.dt;
    }
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        for (const p of this.snow) {
          const x = tx * SNOW_TILE + p.x + Math.sin(p.p * 0.6) * 8;
          const y = ty * SNOW_TILE + p.y;
          if (y < 30) continue;
          ctx.fillRect(x, y, p.s * 1.4, p.s * 1.4);
        }
      }
    }
  }

  private drawSurface(s: Scene, v: View) {
    if (v.t > 90 || v.b < -30) return;
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, 80);
    g.addColorStop(0, 'rgba(170,235,255,0.25)');
    g.addColorStop(1, 'rgba(170,235,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(v.l - 10, 80);
    for (let x = v.l - 10; x <= v.r + 20; x += 12) ctx.lineTo(x, wave(x, s.time));
    ctx.lineTo(v.r + 20, 80);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,252,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = v.l - 10; x <= v.r + 20; x += 12) {
      if (x === v.l - 10) ctx.moveTo(x, wave(x, s.time));
      else ctx.lineTo(x, wave(x, s.time));
    }
    ctx.stroke();
  }

  // ---------------------------------------------------------------- lighting

  private drawDarkness(s: Scene, v: View) {
    const d = this.dctx;
    const k = 0.5;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, this.dark.width, this.dark.height);
    if (v.b < 200) return;
    d.setTransform(this.scale * k, 0, 0, this.scale * k, (this.w / 2 - this.cam.x * this.scale) * k, (this.h / 2 - this.cam.y * this.scale) * k);

    const c = (a: number) => `rgba(2,7,18,${a})`;
    const g = d.createLinearGradient(0, 200, 0, 3000);
    g.addColorStop(0, c(0));
    g.addColorStop(0.18, c(0.3));
    g.addColorStop(0.36, c(0.62));
    g.addColorStop(0.54, c(0.85));
    g.addColorStop(0.79, c(0.94));
    g.addColorStop(1, c(0.97));
    d.fillStyle = g;
    const top = Math.max(v.t, 0);
    d.fillRect(v.l - 10, top, v.r - v.l + 20, v.b - top + 10);

    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a: number) => {
      const hg = d.createRadialGradient(x, y, 0, x, y, r);
      hg.addColorStop(0, `rgba(0,0,0,${a})`);
      hg.addColorStop(0.5, `rgba(0,0,0,${a * 0.8})`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = hg;
      d.beginPath();
      d.arc(x, y, r, 0, Math.PI * 2);
      d.fill();
    };

    const p = s.player;
    if (p.mode === 'swim') {
      const R = s.lightRadius * (1 - s.drowning * 0.5);
      hole(p.x, p.y, R, 1);
      if (p.depth > 80) {
        const L = R * 2;
        const hx = p.x + Math.cos(p.angle) * 18;
        const hy = p.y + Math.sin(p.angle) * 18;
        const cg = d.createRadialGradient(hx, hy, 0, hx, hy, L);
        cg.addColorStop(0, 'rgba(0,0,0,0.9)');
        cg.addColorStop(0.55, 'rgba(0,0,0,0.5)');
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = cg;
        d.beginPath();
        d.moveTo(hx, hy);
        d.arc(hx, hy, L, p.angle - 0.42, p.angle + 0.42);
        d.closePath();
        d.fill();
      }
    }
    for (const gp of s.world.glowPlants) {
      if (gp.x < v.l - 80 || gp.x > v.r + 80 || gp.y < v.t - 80 || gp.y > v.b + 80) continue;
      hole(gp.x, gp.y - gp.height, 46 + Math.sin(s.time * 1.8 + gp.phase) * 8, 0.55);
    }
    for (const t of s.treasures.items) {
      if (t.collected || t.x < v.l - 80 || t.x > v.r + 80 || t.y < v.t - 80 || t.y > v.b + 80) continue;
      const tier = RARITIES[TREASURES[t.item.defId].rarity].tier;
      if (tier >= 2) hole(t.x, t.y, 26 + tier * 9 + Math.sin(s.time * 2 + t.phase) * 4, 0.35 + tier * 0.1);
    }
    if (s.satchel) hole(s.satchel.x, s.satchel.y, 70, 0.8);
    const shrine = s.world.shrine;
    hole(shrine.x - 100, shrine.y - 110, 70, 0.35);

    d.globalCompositeOperation = 'source-over';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.drawImage(this.dark, 0, 0, this.w, this.h);
  }

  /** Twinkles on valuable treasure, drawn above the darkness to lure the player. */
  private drawGlints(s: Scene, v: View) {
    const { ctx } = this;
    for (const t of s.treasures.items) {
      if (t.collected || t.x < v.l || t.x > v.r || t.y < v.t || t.y > v.b) continue;
      const r = RARITIES[TREASURES[t.item.defId].rarity];
      const pulse = Math.pow(Math.max(0, Math.sin(s.time * 1.7 + t.phase * 3)), 8);
      if (pulse < 0.02) continue;
      const size = 5 + r.tier * 2.5;
      const x = t.x + 7;
      const y = t.y - 9 + Math.sin(s.time * 2 + t.phase) * 2;
      ctx.globalAlpha = pulse * (0.45 + r.tier * 0.14);
      ctx.fillStyle = r.tier === 0 ? '#fff6d8' : r.color;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.quadraticCurveTo(x, y, x + size, y);
      ctx.quadraticCurveTo(x, y, x, y + size);
      ctx.quadraticCurveTo(x, y, x - size, y);
      ctx.quadraticCurveTo(x, y, x, y - size);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawInteract(s: Scene) {
    const it = s.interact;
    if (!it) return;
    const { ctx } = this;
    const col = it.blocked ? '#ff6b6b' : it.color;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(3,10,22,0.55)';
    ctx.beginPath();
    ctx.arc(it.x, it.y, 25, 0, Math.PI * 2);
    ctx.stroke();
    if (it.progress > 0) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(it.x, it.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, it.progress));
      ctx.stroke();
    }
    const bob = Math.sin(s.time * 5) * 2;
    ctx.fillStyle = 'rgba(6,16,30,0.9)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(it.x - 12, it.y - 58 + bob, 24, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px Rubik, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(it.blocked ? '✕' : 'E', it.x, it.y - 41 + bob);
  }

  private drawVignettes(s: Scene) {
    const { ctx, w, h } = this;
    const p = s.player;
    const underwater = p.mode === 'swim' && !p.atSurface;
    const R = Math.hypot(w, h) / 2;
    if (underwater) {
      const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.45, w / 2, h / 2, R);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,4,12,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (underwater && (s.oxygenStatus === 'critical' || s.oxygenStatus === 'empty' || s.oxygenStatus === 'low')) {
      const strong = s.oxygenStatus !== 'low';
      const pulse = 0.5 + 0.5 * Math.sin(s.time * (strong ? 7 : 3.5));
      const a = (strong ? 0.32 : 0.14) * (0.4 + 0.6 * pulse);
      const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.5, w / 2, h / 2, R);
      g.addColorStop(0, 'rgba(255,40,40,0)');
      g.addColorStop(1, strong ? `rgba(220,30,40,${a})` : `rgba(255,150,40,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.drowning > 0) {
      const inner = R * (0.75 - 0.6 * s.drowning);
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.max(1, inner * 0.4), w / 2, h / 2, Math.max(2, inner));
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.6 + s.drowning * 0.35})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.fade})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

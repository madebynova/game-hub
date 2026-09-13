import { BOAT, WORLD } from '../config';
import { clamp, damp } from '../core/math';
import type { LostSatchel } from '../core/save';
import { RARITIES, TREASURES } from '../data/treasures';
import type { Player } from '../entities/player';
import type { TreasureField } from '../entities/treasure';
import type { AirPocketSystem, CollapseState } from '../systems/hazards';
import type { OxygenStatus } from '../systems/oxygen';
import type { World } from '../world/world';
import { drawDiver } from './diverArt';
import type { Effects } from './effects';
import { CurrentStreaks, drawAirPockets, drawCollapses, type View } from './hazardArt';
import {
  MarineSnow, boatBob, drawAnchorLine, drawBoat, drawCliffs, drawCorals, drawDepthMarkers, drawGlowPlants, drawKelp,
  drawRays, drawRidge, drawRocks, drawShrine, drawSky, drawSurface, drawTerrain, drawWater,
} from './sceneryArt';
import { drawSatchel, drawTreasure } from './treasureArt';
import { drawProps, drawWreck } from './wreckArt';
import { ZoneAmbience } from './zoneFx';

export { boatBob };

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
  /** Effective flashlight reach after the zone's visibility penalty. */
  lightRadius: number;
  interact: InteractTarget | null;
  oxygenStatus: OxygenStatus;
  /** 0..1 progress through the out-of-air grace period. */
  drowning: number;
  /** 0..1 fade to black. */
  fade: number;
  collapses: CollapseState[];
  airPockets: AirPocketSystem;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dark = document.createElement('canvas');
  private dctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private baseScale = 1;
  private shakeAmount = 0;
  private shakeX = 0;
  private shakeY = 0;
  private snow = new MarineSnow();
  private streaks = new CurrentStreaks();
  private ambience = new ZoneAmbience();
  scale = 1;
  cam = { x: BOAT.x + 120, y: -40 };

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
    this.baseScale = clamp(this.h / 820, 0.75, 1.5);
    this.scale = this.baseScale;
  }

  /** Short camera shake for collapses and big discoveries. */
  shake(amount: number) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  follow(tx: number, ty: number, dt: number, rate = 3.5) {
    this.cam.x = damp(this.cam.x, tx, rate, dt);
    this.cam.y = damp(this.cam.y, ty, rate, dt);
    // The view closes in slightly as you descend — the deep should feel tighter.
    this.scale = this.baseScale * (1 - 0.1 * clamp(this.cam.y / 4000, 0, 1));
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    this.cam.x = WORLD.width < halfW * 2 ? WORLD.width / 2 : clamp(this.cam.x, halfW, WORLD.width - halfW);
    this.cam.y = clamp(this.cam.y, -halfH * 0.8, WORLD.bottom - halfH);
    this.shakeAmount *= Math.exp(-5 * dt);
    this.shakeX = (Math.random() * 2 - 1) * this.shakeAmount;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeAmount;
  }

  private view(): View {
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    return { l: this.cam.x - halfW, r: this.cam.x + halfW, t: this.cam.y - halfH, b: this.cam.y + halfH };
  }

  private applyWorld(ctx: CanvasRenderingContext2D, parallax = 1) {
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s,
      this.dpr * (this.w / 2 - this.cam.x * parallax * this.scale + this.shakeX),
      this.dpr * (this.h / 2 - this.cam.y * parallax * this.scale + this.shakeY));
  }

  private applyScreen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(s: Scene) {
    const { ctx } = this;
    const v = this.view();
    const t = s.time;
    const w = s.world;
    const p = s.player;
    this.applyScreen();
    ctx.fillStyle = '#02060f';
    ctx.fillRect(0, 0, this.w, this.h);

    this.applyWorld(ctx);
    if (v.t < 20) drawSky(ctx, v, t, this.cam.x);
    drawWater(ctx, v, t);
    drawRays(ctx, v, t);
    this.drawRidges(w);

    this.applyWorld(ctx);
    drawShrine(ctx, w, t);
    drawWreck(ctx, w, t);
    drawProps(ctx, w.props);
    drawKelp(ctx, w, v, t, false);
    drawAnchorLine(ctx, w, t);
    drawTerrain(ctx, w, v);
    drawCorals(ctx, w, v, t);
    drawRocks(ctx, w, v);
    drawGlowPlants(ctx, w, v, t);
    drawCliffs(ctx, v);
    drawAirPockets(ctx, w.airPockets, s.airPockets, t, v);
    drawCollapses(ctx, s.collapses, t, v);
    this.drawTreasures(s, v);
    if (s.satchel) drawSatchel(ctx, s.satchel.x, s.satchel.y, t);
    drawBoat(ctx, t);
    drawDiver(ctx, p, p.mode === 'deck' ? boatBob(t) : 0);
    drawKelp(ctx, w, v, t, true);
    if (v.t < 1200) this.ambience.drawFish(ctx, v, t, p.x, p.y);
    s.effects.drawParticles(ctx);
    this.streaks.update(s.dt, w.currents, v);
    this.streaks.draw(ctx);
    this.snow.draw(ctx, v, s.dt);
    drawSurface(ctx, v, t);
    drawDepthMarkers(ctx, v);

    this.applyScreen();
    this.ambience.drawTint(ctx, this.w, this.h, this.cam.x, this.cam.y, s.dt);
    this.drawDarkness(s, v);

    this.applyWorld(ctx);
    this.ambience.drawMotes(ctx, v, t);
    this.drawGlints(s, v);
    this.drawPeekLabels(s, v);
    s.effects.drawBursts(ctx);
    this.drawInteract(s);
    s.effects.drawTexts(ctx);

    this.applyScreen();
    this.drawVignettes(s);
  }

  private drawRidges(world: World) {
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    for (const [f, offset, color, amp] of [[0.35, 250, 'rgba(38,92,128,0.28)', 70], [0.6, 180, 'rgba(18,56,88,0.42)', 45]] as const) {
      this.applyWorld(this.ctx, f);
      const l = this.cam.x * f - halfW - 30;
      const r = this.cam.x * f + halfW + 30;
      drawRidge(this.ctx, world, l, r, this.cam.y * f + halfH + 30, this.cam.y * (f - 1) + 40, f, offset, color, amp);
    }
  }

  private drawTreasures(s: Scene, v: View) {
    for (const t of s.treasures.items) {
      if (t.collected || t.x < v.l - 40 || t.x > v.r + 40 || t.y < v.t - 40 || t.y > v.b + 40) continue;
      drawTreasure(this.ctx, t.item.defId, t.x, t.y, s.time, t.phase);
    }
  }

  // ---------------------------------------------------------------- lighting

  private drawDarkness(s: Scene, v: View) {
    const d = this.dctx;
    const k = 0.5;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, this.dark.width, this.dark.height);
    if (v.b < 200) return;
    d.setTransform(this.scale * k, 0, 0, this.scale * k, (this.w / 2 - this.cam.x * this.scale + this.shakeX) * k, (this.h / 2 - this.cam.y * this.scale + this.shakeY) * k);

    const c = (a: number) => `rgba(2,7,18,${a})`;
    const g = d.createLinearGradient(0, 250, 0, 4250);
    g.addColorStop(0, c(0));
    g.addColorStop(0.11, c(0.28));
    g.addColorStop(0.225, c(0.52));
    g.addColorStop(0.36, c(0.76));
    g.addColorStop(0.46, c(0.88));
    g.addColorStop(0.69, c(0.95));
    g.addColorStop(1, c(0.975));
    d.fillStyle = g;
    const top = Math.max(v.t, 0);
    d.fillRect(v.l - 10, top, v.r - v.l + 20, v.b - top + 10);

    // The wreck's interior is darker than the water around it.
    const hull = s.world.wreck.hull;
    d.fillStyle = 'rgba(2,5,10,0.4)';
    d.beginPath();
    hull.forEach(([x, y], i) => (i ? d.lineTo(x, y) : d.moveTo(x, y)));
    d.fill();

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
    const near = (x: number, y: number, pad = 80) => x > v.l - pad && x < v.r + pad && y > v.t - pad && y < v.b + pad;
    for (const gp of s.world.glowPlants) {
      if (near(gp.x, gp.y)) hole(gp.x, gp.y - gp.height, 46 + Math.sin(s.time * 1.8 + gp.phase) * 8, 0.55);
    }
    for (const t of s.treasures.items) {
      if (t.collected || !near(t.x, t.y)) continue;
      const tier = RARITIES[TREASURES[t.item.defId].rarity].tier;
      if (tier >= 2) hole(t.x, t.y, 26 + tier * 9 + Math.sin(s.time * 2 + t.phase) * 4, 0.35 + tier * 0.1);
    }
    for (const ap of s.world.airPockets) {
      if (!near(ap.x, ap.y, 120)) continue;
      const f = s.airPockets.fraction(ap.id);
      hole(ap.x, ap.kind === 'vent' ? ap.y + 60 : ap.y, ap.kind === 'vent' ? 90 : 55, 0.25 + 0.35 * f);
    }
    if (s.satchel) hole(s.satchel.x, s.satchel.y, 70, 0.8);
    const shrine = s.world.shrine;
    hole(shrine.x - 130, shrine.y - 130, 80, 0.35);

    d.globalCompositeOperation = 'source-over';
    this.applyScreen();
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

  /** Name tags on lit, valuable treasure so the player can judge whether it's worth the detour. */
  private drawPeekLabels(s: Scene, v: View) {
    const p = s.player;
    if (p.mode !== 'swim') return;
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.font = '700 12px Rubik, system-ui, sans-serif';
    const reach = Math.min(s.lightRadius * 0.95, 320);
    // Only the three nearest lit finds get a tag, so clusters (like the shrine) stay readable.
    const lit = s.treasures.items
      .filter((t) => !t.collected && RARITIES[t.item.rarity].tier >= 1)
      .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) }))
      .filter(({ d }) => d <= reach && d >= 40)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { t, d } of lit) {
      if (t.x < v.l || t.x > v.r || t.y < v.t || t.y > v.b) continue;
      const r = RARITIES[t.item.rarity];
      const a = Math.min(1, (reach - d) / 80);
      const label = `${t.item.name}`;
      const y = t.y - 30 + Math.sin(s.time * 2 + t.phase) * 2;
      const tw = ctx.measureText(label).width + 16;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = 'rgba(4,12,24,0.8)';
      ctx.beginPath();
      ctx.roundRect(t.x - tw / 2, y - 13, tw, 18, 9);
      ctx.fill();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = r.color;
      ctx.fillText(label, t.x, y);
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
      // Crushing pressure: a slow violet squeeze at the edges of the abyss.
      const deep = clamp((p.depth - 2100) / 1900, 0, 1);
      if (deep > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(s.time * 0.9);
        const pg = ctx.createRadialGradient(w / 2, h / 2, R * (0.62 - 0.12 * deep), w / 2, h / 2, R);
        pg.addColorStop(0, 'rgba(20,0,40,0)');
        pg.addColorStop(1, `rgba(20,0,40,${0.35 * deep * pulse})`);
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, w, h);
      }
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

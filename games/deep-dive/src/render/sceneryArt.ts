import { BOAT, PX_PER_METER, WORLD } from '../config';
import type { World } from '../world/world';
import type { View } from './hazardArt';

type Ctx = CanvasRenderingContext2D;

export const boatBob = (t: number) => Math.sin(t * 1.3) * 2;
export const wave = (x: number, t: number) => Math.sin(x * 0.018 + t * 1.4) * 3 + Math.sin(x * 0.047 - t * 2.2) * 1.6;

// ------------------------------------------------------------------ sky & water

export function drawSky(ctx: Ctx, v: View, t: number, camX: number) {
  const g = ctx.createLinearGradient(0, -760, 0, 0);
  g.addColorStop(0, '#0d1430');
  g.addColorStop(0.45, '#2f3566');
  g.addColorStop(0.78, '#a4607a');
  g.addColorStop(1, '#f2a46c');
  ctx.fillStyle = g;
  ctx.fillRect(v.l, v.t, v.r - v.l, -v.t + 20);

  const sx = camX * 0.9 + 300;
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

  ctx.fillStyle = 'rgba(255,200,190,0.16)';
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 830 + t * 6) % 6400) - 500 + camX * 0.8 - 1400;
    const cy = -260 - (i % 3) * 90;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 160 + (i % 2) * 90, 9 + (i % 3) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#3e2f55';
  ctx.beginPath();
  const ox = camX * 0.85;
  ctx.moveTo(v.l, 2);
  for (let x = v.l; x <= v.r + 40; x += 40) {
    const lx = x - ox;
    const h = Math.max(0, Math.sin(lx * 0.004) * 30 + Math.sin(lx * 0.011) * 12 - 8);
    ctx.lineTo(x, -h);
  }
  ctx.lineTo(v.r + 40, 2);
  ctx.fill();
}

export function drawWater(ctx: Ctx, v: View, t: number) {
  if (v.b < -10) return;
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.bottom);
  g.addColorStop(0, '#3aa1b3');
  g.addColorStop(0.04, '#1f7896');
  g.addColorStop(0.16, '#11507a');
  g.addColorStop(0.3, '#0e3a52');
  g.addColorStop(0.45, '#0a2440');
  g.addColorStop(0.7, '#060f26');
  g.addColorStop(1, '#02060f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(v.l - 10, v.b + 10);
  for (let x = v.l - 10; x <= v.r + 20; x += 12) ctx.lineTo(x, wave(x, t));
  ctx.lineTo(v.r + 20, v.b + 10);
  ctx.fill();
}

export function drawRays(ctx: Ctx, v: View, t: number) {
  if (v.t > 1100) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const spacing = 230;
  for (let k = Math.floor(v.l / spacing) - 3; k <= Math.ceil(v.r / spacing) + 1; k++) {
    const x0 = k * spacing + Math.sin(k * 12.9) * 80;
    const sway = Math.sin(t * 0.35 + k) * 40;
    const w = 26 + (Math.sin(k * 7.1) * 0.5 + 0.5) * 56;
    const alpha = (0.5 + 0.5 * Math.sin(t * 0.6 + k * 1.7)) * 0.07 + 0.015;
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

/** Distant ridges in layer space (the caller sets a parallax transform first). */
export function drawRidge(ctx: Ctx, world: World, l: number, r: number, bottom: number, surfaceY: number, f: number, offset: number, color: string, amp: number) {
  if (surfaceY > bottom) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(l, bottom);
  for (let lx = l; lx <= r + 24; lx += 24) {
    const y = f * (world.floorY(lx / f) - 380) + offset + Math.sin((lx * 0.009) / f) * amp + Math.sin(lx * 0.031) * amp * 0.35;
    ctx.lineTo(lx, Math.max(surfaceY, y));
  }
  ctx.lineTo(r + 24, bottom);
  ctx.fill();
}

export function drawSurface(ctx: Ctx, v: View, t: number) {
  if (v.t > 90 || v.b < -30) return;
  const g = ctx.createLinearGradient(0, 0, 0, 80);
  g.addColorStop(0, 'rgba(170,235,255,0.25)');
  g.addColorStop(1, 'rgba(170,235,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(v.l - 10, 80);
  for (let x = v.l - 10; x <= v.r + 20; x += 12) ctx.lineTo(x, wave(x, t));
  ctx.lineTo(v.r + 20, 80);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,252,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = v.l - 10; x <= v.r + 20; x += 12) {
    if (x === v.l - 10) ctx.moveTo(x, wave(x, t));
    else ctx.lineTo(x, wave(x, t));
  }
  ctx.stroke();
}

const SNOW_TILE = 700;

/** Marine snow drifting everywhere underwater. */
export class MarineSnow {
  private specks = Array.from({ length: 55 }, () => ({ x: Math.random() * SNOW_TILE, y: Math.random() * SNOW_TILE, s: 0.6 + Math.random() * 1.5, p: Math.random() * 10 }));

  draw(ctx: Ctx, v: View, dt: number) {
    if (v.b < 40) return;
    for (const p of this.specks) {
      p.y = (p.y + dt * 7 * p.s) % SNOW_TILE;
      p.p += dt;
    }
    ctx.fillStyle = 'rgba(210,235,245,0.35)';
    for (let tx = Math.floor(v.l / SNOW_TILE); tx <= Math.floor(v.r / SNOW_TILE); tx++) {
      for (let ty = Math.floor(Math.max(0, v.t) / SNOW_TILE); ty <= Math.floor(v.b / SNOW_TILE); ty++) {
        for (const p of this.specks) {
          const y = ty * SNOW_TILE + p.y;
          if (y < 30) continue;
          ctx.fillRect(tx * SNOW_TILE + p.x + Math.sin(p.p * 0.6) * 8, y, p.s * 1.4, p.s * 1.4);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ landmarks

export function drawShrine(ctx: Ctx, world: World, t: number) {
  const { x, y } = world.shrine;
  ctx.save();
  ctx.translate(x, y + 10);
  ctx.fillStyle = '#2b3846';
  ctx.fillRect(-150, -230, 38, 230);
  ctx.fillRect(112, -160, 38, 160);
  ctx.fillRect(-160, -246, 58, 18);
  ctx.beginPath();
  ctx.moveTo(-112, -224);
  ctx.quadraticCurveTo(-30, -290, 50, -252);
  ctx.lineTo(44, -232);
  ctx.quadraticCurveTo(-30, -262, -112, -202);
  ctx.fill();
  ctx.fillStyle = '#34465a';
  ctx.fillRect(-46, -40, 92, 40);
  ctx.fillRect(-58, -50, 116, 12);
  const glow = 0.35 + 0.25 * Math.sin(t * 1.5);
  ctx.fillStyle = `rgba(120,240,255,${glow})`;
  for (const gy of [-200, -160, -120, -80]) {
    ctx.fillRect(-137, gy, 12, 4);
    ctx.fillRect(-133, gy + 8, 3, 10);
  }
  ctx.fillRect(-20, -28, 40, 3);
  ctx.restore();
}

export function drawAnchorLine(ctx: Ctx, world: World, t: number) {
  const x = BOAT.deckLeft - 52;
  const floor = world.floorY(x);
  ctx.save();
  ctx.strokeStyle = 'rgba(220,205,170,0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(x, 8);
  ctx.quadraticCurveTo(x + Math.sin(t * 0.8) * 10, floor / 2, x + 8, floor - 12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 11px Rubik, system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let m = 10; m * PX_PER_METER < floor - 30; m += 10) {
    const my = m * PX_PER_METER;
    const mx = x + Math.sin(t * 0.8) * 10 * (1 - Math.abs(my / floor - 0.5) * 2) * 0.5;
    ctx.fillStyle = '#e9b64c';
    ctx.fillRect(mx - 5, my - 2, 10, 4);
    ctx.fillStyle = 'rgba(230,240,245,0.55)';
    ctx.fillText(`${m}m`, mx + 9, my + 4);
  }
  ctx.strokeStyle = '#6f7880';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 8, floor - 30);
  ctx.lineTo(x + 8, floor - 6);
  ctx.arc(x + 8, floor - 16, 11, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** Depth markers on the seabed at each zone boundary, so descending reads as progress. */
export function drawDepthMarkers(ctx: Ctx, v: View) {
  ctx.font = '700 12px Rubik, system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const [x, y, label, color] of [[1985, 1150, 'THE WRECK · 72m', '#a8d98f'], [3440, 2100, 'THE ABYSS · 131m', '#c586ff']] as const) {
    if (x < v.l - 200 || x > v.r + 50 || y < v.t - 20 || y > v.b + 20) continue;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 160, y);
    ctx.lineTo(x + 40, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.fillText(label, x - 156, y - 6);
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ terrain & flora

export function drawTerrain(ctx: Ctx, world: World, v: View) {
  const step = world.floorStep;
  const i0 = Math.max(0, Math.floor(v.l / step) - 1);
  const i1 = Math.min(world.floor.length - 1, Math.ceil(v.r / step) + 1);
  const bottom = v.b + 20;
  const path = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(i0 * step, bottom);
    for (let i = i0; i <= i1; i++) ctx.lineTo(i * step, world.floorSample(i) + offset);
    ctx.lineTo(i1 * step, bottom);
    ctx.closePath();
  };

  const g = ctx.createLinearGradient(0, 400, 0, 4200);
  g.addColorStop(0, '#c7ab7a');
  g.addColorStop(0.12, '#8e7a5b');
  g.addColorStop(0.35, '#4f4a44');
  g.addColorStop(0.6, '#2c2c36');
  g.addColorStop(1, '#12151e');
  ctx.fillStyle = g;
  path(0);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  path(34);
  ctx.fill();
  path(120);
  ctx.fill();

  for (let i = i0; i <= i1; i++) {
    const h = Math.abs(Math.sin(i * 91.7) * 43758) % 1;
    if (h < 0.55) continue;
    ctx.fillStyle = h > 0.8 ? 'rgba(255,240,210,0.16)' : 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(i * step + h * 12, world.floorSample(i) + 7 + h * 22, 2 + h * 3, 1.5 + h * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,240,205,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const y = world.floorSample(i);
    if (i === i0) ctx.moveTo(i * step, y);
    else ctx.lineTo(i * step, y);
  }
  ctx.stroke();
}

export function drawRocks(ctx: Ctx, world: World, v: View) {
  for (const rock of world.rocks) {
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
    for (let k = 0; k <= n; k++) {
      const [x1, y1] = pts[k % n];
      const [x2, y2] = pts[(k + 1) % n];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      if (k === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(x1, y1, mx, my);
    }
    ctx.fill();
    if (rock.y < 1150 && rock.r > 20) {
      ctx.strokeStyle = 'rgba(110,170,90,0.45)';
      ctx.lineWidth = Math.max(3, rock.r * 0.12);
      ctx.beginPath();
      ctx.ellipse(rock.x, rock.y, rock.r * 0.8, rock.r * 0.72, 0, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
  }
}

export function drawKelp(ctx: Ctx, world: World, v: View, t: number, front: boolean) {
  ctx.lineCap = 'round';
  for (const k of world.kelp) {
    if (k.front !== front || k.x < v.l - 60 || k.x > v.r + 60 || k.baseY - k.height > v.b || k.baseY < v.t) continue;
    const segs = 9;
    ctx.strokeStyle = front ? 'rgba(20,62,44,0.92)' : k.baseY < 800 ? '#3b8a55' : '#2a6448';
    ctx.lineWidth = front ? k.width * 1.5 : k.width;
    ctx.beginPath();
    ctx.moveTo(k.x, k.baseY);
    const pts: [number, number][] = [];
    for (let j = 1; j <= segs; j++) {
      const py = k.baseY - (k.height * j) / segs;
      const px = k.x + Math.sin(t * 0.9 + k.phase + j * 0.45) * j * 2.4;
      ctx.lineTo(px, py);
      pts.push([px, py]);
    }
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (let j = 1; j < pts.length; j += 2) {
      const [lx, ly] = pts[j];
      const side = j % 4 === 1 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(lx + side * 8, ly + 4, 10, 3.5, side * 0.6 + Math.sin(t + j) * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawCorals(ctx: Ctx, world: World, v: View, t: number) {
  for (const c of world.corals) {
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
      const sway = Math.sin(t * 0.8 + c.x) * 0.08;
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

export function drawGlowPlants(ctx: Ctx, world: World, v: View, t: number) {
  for (const g of world.glowPlants) {
    if (g.x < v.l - 40 || g.x > v.r + 40 || g.y < v.t || g.y - g.height > v.b) continue;
    const tip = g.x + Math.sin(t * 0.7 + g.phase) * 6;
    ctx.strokeStyle = `hsla(${g.hue},50%,30%,0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.quadraticCurveTo(g.x, g.y - g.height * 0.6, tip, g.y - g.height);
    ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.8 + g.phase);
    ctx.fillStyle = `hsla(${g.hue},95%,70%,${pulse})`;
    ctx.beginPath();
    ctx.arc(tip, g.y - g.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Rock walls marking the edges of the dive site. */
export function drawCliffs(ctx: Ctx, v: View) {
  for (const side of [-1, 1]) {
    const edge = side < 0 ? WORLD.wallMargin - 14 : WORLD.width - WORLD.wallMargin + 14;
    if (side < 0 && v.l > edge + 60) continue;
    if (side > 0 && v.r < edge - 60) continue;
    const outer = side < 0 ? -200 : WORLD.width + 200;
    const g = ctx.createLinearGradient(0, -120, 0, 3600);
    g.addColorStop(0, '#4b4a5c');
    g.addColorStop(0.12, '#2e3a48');
    g.addColorStop(1, '#0a0e16');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(outer, -150);
    const top = -110;
    ctx.lineTo(edge - side * 60, top);
    for (let y = top + 40; y <= WORLD.bottom + 40; y += 40) {
      const jag = Math.sin(y * 0.021 + side) * 18 + Math.sin(y * 0.063) * 8;
      const lean = y < 0 ? -side * 40 * (1 - (y - top) / -top) : 0;
      ctx.lineTo(edge - side * jag + lean, y);
    }
    ctx.lineTo(outer, WORLD.bottom + 40);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ the boat

export function drawBoat(ctx: Ctx, t: number) {
  const L = BOAT.deckLeft;
  const R = BOAT.deckRight;
  const D = BOAT.deckY + boatBob(t);
  ctx.save();
  ctx.translate(BOAT.x, D);
  ctx.rotate(Math.sin(t * 1.1) * 0.01);
  ctx.translate(-BOAT.x, -D);

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
  ctx.fillStyle = '#9a6d3f';
  ctx.fillRect(cx + 128, D - 26, 30, 26);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx + 128, D - 26, 30, 26);
  ctx.fillStyle = '#e9b64c';
  ctx.fillRect(cx + 139, D - 16, 8, 6);

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

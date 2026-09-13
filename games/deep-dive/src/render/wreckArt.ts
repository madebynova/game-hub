import type { Prop, World } from '../world/world';

type Ctx = CanvasRenderingContext2D;

/** The wreck is drawn as a cutaway so the diver can read its decks, gaps and passages. */
export function drawWreck(ctx: Ctx, world: World, t: number) {
  const wr = world.wreck;
  const P = wr.toWorld;

  // Broken mast leaning out of the top deck.
  const [m0x, m0y] = P(-20, -250);
  const [m1x, m1y] = P(150, -560);
  ctx.strokeStyle = '#2f2a26';
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(m0x, m0y);
  ctx.lineTo(m1x, m1y);
  ctx.stroke();
  const [c0x, c0y] = P(60, -420);
  const [c1x, c1y] = P(210, -400);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c0x, c0y);
  ctx.lineTo(c1x, c1y);
  ctx.stroke();
  // Torn sail rag drifting from the crossbar.
  const sway = Math.sin(t * 0.8) * 10;
  ctx.fillStyle = 'rgba(170,160,130,0.18)';
  ctx.beginPath();
  ctx.moveTo(c0x + 20, c0y);
  ctx.quadraticCurveTo(c0x + 60 + sway, c0y + 60, c0x + 40 + sway * 1.5, c0y + 120);
  ctx.lineTo(c1x - 30 + sway, c1y + 70);
  ctx.lineTo(c1x - 10, c1y);
  ctx.fill();

  // Interior back wall.
  ctx.save();
  ctx.beginPath();
  wr.hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  const [, topY] = P(0, -250);
  const g = ctx.createLinearGradient(0, topY, 0, wr.y);
  g.addColorStop(0, '#2d2823');
  g.addColorStop(1, '#16130f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,220,180,0.06)';
  ctx.lineWidth = 2;
  for (let ly = -240; ly <= 0; ly += 22) {
    const [ax, ay] = P(-470, ly);
    const [bx, by] = P(480, ly);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 8;
  for (let lx = -400; lx <= 420; lx += 110) {
    const [ax, ay] = P(lx, -250);
    const [bx, by] = P(lx + 6, 10);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  // Cargo left in the holds.
  drawLocalBox(ctx, P, -260, -14, 26, 26, '#4a3a28');
  drawLocalBox(ctx, P, -232, -12, 22, 22, '#3e3122');
  drawLocalBarrel(ctx, P, 30, -16);
  drawLocalBarrel(ctx, P, 330, -150);
  drawLocalBox(ctx, P, -200, -150, 30, 24, '#4a3a28');
  // A dead lantern swinging in the captain's cabin.
  const [lx, ly] = P(-360, -246);
  const swing = Math.sin(t * 1.2) * 0.25;
  ctx.strokeStyle = '#3a342d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + Math.sin(swing) * 26, ly + Math.cos(swing) * 26);
  ctx.stroke();
  ctx.fillStyle = '#5a4b33';
  ctx.fillRect(lx + Math.sin(swing) * 26 - 5, ly + Math.cos(swing) * 26, 10, 12);
  ctx.restore();

  // Hull planking and decks. Thick strokes match the collision walls exactly.
  const interior = new Set(wr.interior);
  for (const w of world.walls) {
    const inner = interior.has(w);
    ctx.lineCap = 'round';
    ctx.strokeStyle = inner ? '#3b322a' : '#4d4239';
    ctx.lineWidth = w.half * 2 + 2;
    ctx.beginPath();
    ctx.moveTo(w.ax, w.ay);
    ctx.lineTo(w.bx, w.by);
    ctx.stroke();
    ctx.strokeStyle = inner ? 'rgba(255,230,190,0.07)' : 'rgba(255,230,190,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.ax, w.ay - w.half * 0.5);
    ctx.lineTo(w.bx, w.by - w.half * 0.5);
    ctx.stroke();
    if (!inner) {
      // Barnacles and algae crust.
      const len = Math.hypot(w.bx - w.ax, w.by - w.ay);
      ctx.fillStyle = 'rgba(140,170,120,0.35)';
      for (let d = 12; d < len; d += 23) {
        const k = d / len;
        const jitter = Math.sin(d * 12.7 + w.ax) * 3;
        ctx.beginPath();
        ctx.arc(w.ax + (w.bx - w.ax) * k, w.ay + (w.by - w.ay) * k - w.half + jitter * 0.3, 2 + Math.abs(jitter) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Splintered edges around each opening.
  ctx.strokeStyle = '#5b4d40';
  ctx.lineWidth = 3;
  for (const [ex, ey, dx, dy] of [[-125, -250, 10, 14], [-65, -250, -8, 16], [205, -248, 16, 18], [290, -247, -14, 20], [441, -100, -18, -6], [456, -182, -20, 8]]) {
    const [ax, ay] = P(ex, ey);
    const [bx, by] = P(ex + dx, ey + dy);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

function drawLocalBox(ctx: Ctx, P: (x: number, y: number) => [number, number], lx: number, ly: number, w: number, h: number, color: string) {
  const [x, y] = P(lx, ly);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.stroke();
}

function drawLocalBarrel(ctx: Ctx, P: (x: number, y: number) => [number, number], lx: number, ly: number) {
  const [x, y] = P(lx, ly);
  ctx.fillStyle = '#4f3b26';
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f2a24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 6);
  ctx.lineTo(x + 11, y - 6);
  ctx.moveTo(x - 11, y + 6);
  ctx.lineTo(x + 11, y + 6);
  ctx.stroke();
}

/** Cannons, crates and barrels scattered around the wreck field. */
export function drawProps(ctx: Ctx, props: Prop[]) {
  for (const p of props) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.kind === 'cannon') {
      ctx.fillStyle = '#2b2f33';
      ctx.beginPath();
      ctx.roundRect(-30, -22, 58, 16, 7);
      ctx.fill();
      ctx.fillStyle = '#3a3027';
      ctx.fillRect(-20, -10, 30, 10);
      ctx.fillStyle = '#1b1e21';
      ctx.beginPath();
      ctx.arc(26, -14, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'crate') {
      ctx.fillStyle = '#4a3a28';
      ctx.fillRect(-18, -32, 36, 32);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-18, -32, 36, 32);
      ctx.beginPath();
      ctx.moveTo(-18, -32);
      ctx.lineTo(18, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#4f3b26';
      ctx.beginPath();
      ctx.ellipse(0, -14, 13, 15, Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2f2a24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -28);
      ctx.lineTo(-6, 0);
      ctx.moveTo(6, -28);
      ctx.lineTo(6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

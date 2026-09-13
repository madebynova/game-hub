import { RARITIES, TREASURES, type TreasureId } from '../data/treasures';

type Ctx = CanvasRenderingContext2D;

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const ART: Record<TreasureId, (ctx: Ctx, t: number) => void> = {
  coins(ctx) {
    for (const [dx, dy] of [[-6, 4], [5, 5], [0, -1]]) {
      ctx.fillStyle = '#8f7a3e';
      ctx.beginPath();
      ctx.ellipse(dx, dy + 1.5, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a54e';
      ctx.beginPath();
      ctx.ellipse(dx, dy, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,170,110,0.55)';
      ctx.beginPath();
      ctx.ellipse(dx + 2, dy, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  doubloon(ctx, t) {
    const squash = 0.75 + Math.abs(Math.sin(t * 1.4)) * 0.25;
    ctx.save();
    ctx.scale(squash, 1);
    circle(ctx, 0, 0, 10, '#b8801f');
    circle(ctx, 0, 0, 8.5, '#ffd24a');
    ctx.strokeStyle = '#d99a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.stroke();
    circle(ctx, -3, -4, 1.8, 'rgba(255,255,255,0.8)');
    ctx.restore();
  },
  amphora(ctx) {
    ctx.fillStyle = '#b8582f';
    ctx.beginPath();
    ctx.moveTo(-3, -13);
    ctx.lineTo(3, -13);
    ctx.quadraticCurveTo(4, -8, 9, -3);
    ctx.quadraticCurveTo(11, 6, 2, 13);
    ctx.lineTo(-2, 13);
    ctx.quadraticCurveTo(-11, 6, -9, -3);
    ctx.quadraticCurveTo(-4, -8, -3, -13);
    ctx.fill();
    ctx.strokeStyle = '#8e3f1f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-7, -8, 3.5, Math.PI * 0.5, Math.PI * 1.5);
    ctx.moveTo(7, -11.5);
    ctx.arc(7, -8, 3.5, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.strokeStyle = '#e8b27a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, 1); ctx.lineTo(9, 1);
    ctx.stroke();
  },
  compass(ctx, t) {
    circle(ctx, 0, 0, 10.5, '#8a6326');
    circle(ctx, 0, 0, 8.5, '#d8a852');
    circle(ctx, 0, 0, 6.5, '#f1e4c2');
    ctx.save();
    ctx.rotate(Math.sin(t * 1.7) * 0.6);
    ctx.fillStyle = '#d33c2e';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(2, 0); ctx.lineTo(-2, 0);
    ctx.fill();
    ctx.fillStyle = '#34424e';
    ctx.beginPath();
    ctx.moveTo(0, 6); ctx.lineTo(2, 0); ctx.lineTo(-2, 0);
    ctx.fill();
    ctx.restore();
    circle(ctx, 0, -11.5, 2.5, '#8a6326');
  },
  brooch(ctx) {
    ctx.fillStyle = '#e0b04a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      circle(ctx, Math.cos(a) * 9, Math.sin(a) * 7.5, 1.4, '#fff1c4');
    }
    ctx.fillStyle = '#2c6fe0';
    ctx.beginPath();
    ctx.moveTo(0, -6.5); ctx.lineTo(5.5, 0); ctx.lineTo(0, 6.5); ctx.lineTo(-5.5, 0);
    ctx.fill();
    ctx.fillStyle = '#9cd2ff';
    ctx.beginPath();
    ctx.moveTo(0, -6.5); ctx.lineTo(5.5, 0); ctx.lineTo(0, 0);
    ctx.fill();
  },
  pearls(ctx) {
    ctx.strokeStyle = 'rgba(200,190,170,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -6, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = (0.12 + (i / 8) * 0.76) * Math.PI;
      const x = Math.cos(a) * 12;
      const y = Math.sin(a) * 12 - 6;
      circle(ctx, x, y, 2.9, '#e9e4d8');
      circle(ctx, x - 0.9, y - 0.9, 1, '#ffffff');
    }
    circle(ctx, 0, 9.5, 4.2, '#f7f1ff');
    circle(ctx, -1.3, 8.3, 1.4, '#ffffff');
  },
  idol(ctx) {
    ctx.fillStyle = '#1f8a5e';
    ctx.beginPath();
    ctx.moveTo(-8, 14); ctx.lineTo(8, 14); ctx.lineTo(6, -2); ctx.lineTo(-6, -2);
    ctx.fill();
    circle(ctx, 0, -8, 8, '#2fb57b');
    ctx.fillStyle = '#3fd694';
    ctx.fillRect(-9, -17, 18, 4);
    ctx.fillStyle = '#0b3524';
    ctx.fillRect(-4.5, -9.5, 3, 2.5);
    ctx.fillRect(1.5, -9.5, 3, 2.5);
    ctx.fillRect(-3, -4, 6, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-6, 1, 3, 11);
  },
  heart(ctx, t) {
    const pulse = 1 + Math.sin(t * 3) * 0.06;
    ctx.save();
    ctx.scale(pulse, pulse);
    const g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, '#ffe7a3');
    g.addColorStop(0.5, '#ff9a3c');
    g.addColorStop(1, '#d9412b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(10, -4); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(4, -4); ctx.lineTo(0, 8); ctx.lineTo(-4, -4);
    ctx.fill();
    ctx.restore();
  },
};

export function drawTreasure(ctx: Ctx, id: TreasureId, x: number, y: number, t: number, phase: number) {
  const rarity = RARITIES[TREASURES[id].rarity];
  const bob = Math.sin(t * 2 + phase) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  if (rarity.tier >= 1) {
    const r = 18 + rarity.tier * 5 + Math.sin(t * 3 + phase) * 2;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rarity.color + '66');
    g.addColorStop(1, rarity.color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ART[id](ctx, t + phase);
  ctx.restore();
}

export function drawSatchel(ctx: Ctx, x: number, y: number, t: number) {
  const bob = Math.sin(t * 1.6) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  const r = 34 + Math.sin(t * 4) * 4;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, 'rgba(255,181,71,0.5)');
  g.addColorStop(1, 'rgba(255,181,71,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2e';
  ctx.beginPath();
  ctx.roundRect(-13, -8, 26, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#8a6240';
  ctx.beginPath();
  ctx.roundRect(-13, -9, 26, 9, 4);
  ctx.fill();
  ctx.strokeStyle = '#4a3220';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -8, 9, Math.PI, 0);
  ctx.stroke();
  circle(ctx, 0, -3, 2.5, '#ffcf6a');
  ctx.restore();
}

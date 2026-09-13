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
  bottle(ctx) {
    ctx.save();
    ctx.rotate(-0.5);
    ctx.fillStyle = 'rgba(120,200,160,0.75)';
    ctx.beginPath();
    ctx.roundRect(-5, -6, 10, 18, 4);
    ctx.fill();
    ctx.fillRect(-2.5, -13, 5, 8);
    ctx.fillStyle = '#8a5a32';
    ctx.fillRect(-3, -15, 6, 4);
    ctx.fillStyle = '#efe2bd';
    ctx.fillRect(-2.5, -2, 5, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -4, 1.5, 12);
    ctx.restore();
  },
  tools(ctx) {
    ctx.save();
    ctx.rotate(0.6);
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(-2, -2, 4, 16);
    ctx.fillStyle = '#b8903e';
    ctx.fillRect(-8, -8, 16, 6);
    ctx.restore();
    ctx.save();
    ctx.rotate(-0.7);
    ctx.fillStyle = '#9a8a66';
    ctx.fillRect(-1.5, -12, 3, 22);
    ctx.beginPath();
    ctx.arc(0, -12, 4.5, Math.PI * 0.2, Math.PI * 1.8);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#9a8a66';
    ctx.stroke();
    ctx.restore();
  },
  silver(ctx) {
    ctx.fillStyle = '#c9d3da';
    ctx.beginPath();
    ctx.ellipse(0, 12, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2, -6, 4, 18);
    ctx.beginPath();
    ctx.ellipse(0, -7, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef3f6';
    ctx.fillRect(-2.5, -15, 5, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(-1.5, -4, 1.2, 14);
  },
  ring(ctx, t) {
    ctx.strokeStyle = '#e8b64a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c28a2a';
    ctx.beginPath();
    ctx.roundRect(-6, -9, 12, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(-3.5, -7.5, 7, 5);
    circle(ctx, -4 + Math.sin(t * 2) * 1.5, 0, 1.2, 'rgba(255,255,255,0.8)');
  },
  bell(ctx) {
    ctx.fillStyle = '#b07a2c';
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.quadraticCurveTo(-8, 4, -15, 12);
    ctx.lineTo(15, 12);
    ctx.quadraticCurveTo(8, 4, 7, -12);
    ctx.quadraticCurveTo(0, -18, -7, -12);
    ctx.fill();
    ctx.fillStyle = '#7e5519';
    ctx.fillRect(-15, 10, 30, 4);
    ctx.fillRect(-2, -20, 4, 5);
    circle(ctx, 0, 15, 3, '#5d3f14');
    ctx.fillStyle = 'rgba(255,230,160,0.35)';
    ctx.fillRect(-5, -9, 3, 17);
  },
  chalice(ctx) {
    ctx.fillStyle = '#e0ad3e';
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(10, -12);
    ctx.quadraticCurveTo(9, 0, 0, 2);
    ctx.quadraticCurveTo(-9, 0, -10, -12);
    ctx.fill();
    ctx.fillRect(-1.5, 1, 3, 8);
    ctx.beginPath();
    ctx.ellipse(0, 11, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, -4, -6, 2, '#e0344a');
    circle(ctx, 3, -6, 2, '#3c7cf0');
    circle(ctx, 0, -2, 1.6, '#3fd07a');
  },
  emerald(ctx, t) {
    const g = ctx.createLinearGradient(-8, -10, 8, 10);
    g.addColorStop(0, '#9dffc8');
    g.addColorStop(1, '#0f8a4e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, -11); ctx.lineTo(7, -9); ctx.lineTo(11, 2); ctx.lineTo(3, 11); ctx.lineTo(-9, 7); ctx.lineTo(-11, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(-6, -11); ctx.lineTo(1, -2); ctx.lineTo(-11, -3);
    ctx.fill();
    circle(ctx, 4, -5, 1.2 + Math.abs(Math.sin(t * 2)), 'rgba(255,255,255,0.9)');
  },
  astrolabe(ctx, t) {
    ctx.strokeStyle = '#b8742f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 1, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 1, 6.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, 1);
    ctx.rotate(t * 0.4);
    ctx.fillStyle = '#e1a85a';
    ctx.fillRect(-11, -1, 22, 2);
    ctx.restore();
    circle(ctx, 0, -11.5, 3, '#b8742f');
  },
  bust(ctx) {
    ctx.fillStyle = '#d8d4cc';
    ctx.beginPath();
    ctx.moveTo(-14, 16); ctx.lineTo(14, 16); ctx.quadraticCurveTo(13, 2, 6, 0); ctx.lineTo(-6, 0); ctx.quadraticCurveTo(-13, 2, -14, 16);
    ctx.fill();
    ctx.fillRect(-4, -5, 8, 7);
    ctx.beginPath();
    ctx.ellipse(0, -12, 7.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9b3a8';
    ctx.fillRect(-10, 13, 20, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-4, -14, 2.5, 2);
    ctx.fillRect(1.5, -14, 2.5, 2);
    ctx.fillStyle = 'rgba(90,140,90,0.35)';
    ctx.fillRect(3, -8, 5, 10);
  },
  crown(ctx, t) {
    ctx.fillStyle = '#f0c24a';
    ctx.beginPath();
    ctx.moveTo(-13, 9); ctx.lineTo(-13, -6); ctx.lineTo(-7, 1); ctx.lineTo(0, -11); ctx.lineTo(7, 1); ctx.lineTo(13, -6); ctx.lineTo(13, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8861f';
    ctx.fillRect(-13, 5, 26, 4);
    circle(ctx, 0, 2, 2.6, '#d42a52');
    circle(ctx, -8, 4, 2, '#3a8cff');
    circle(ctx, 8, 4, 2, '#3a8cff');
    circle(ctx, 0, -11, 1.6 + Math.abs(Math.sin(t * 3)) * 0.8, '#fff6d0');
    ctx.fillStyle = 'rgba(80,130,110,0.45)';
    ctx.fillRect(4, 5, 8, 4);
  },
  mask(ctx, t) {
    const glow = 0.5 + 0.5 * Math.sin(t * 2.5);
    ctx.fillStyle = '#2a3b4e';
    ctx.beginPath();
    ctx.moveTo(0, -15); ctx.quadraticCurveTo(14, -12, 12, 2); ctx.quadraticCurveTo(8, 15, 0, 16); ctx.quadraticCurveTo(-8, 15, -12, 2); ctx.quadraticCurveTo(-14, -12, 0, -15);
    ctx.fill();
    ctx.strokeStyle = '#7c6bd6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(140,240,255,${0.5 + glow * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(-5, -3, 3.5, 2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(5, -3, 3.5, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c6bd6';
    ctx.fillRect(-1, -13, 2, 8);
    ctx.fillRect(-5, 8, 10, 1.5);
  },
  leviathan(ctx, t) {
    const pulse = 1 + Math.sin(t * 2.2) * 0.07;
    ctx.save();
    ctx.scale(pulse, pulse);
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 14);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#dff4ff');
    g.addColorStop(0.75, '#9fb4ff');
    g.addColorStop(1, '#6a58c9');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,220,140,${0.4 + 0.3 * Math.sin(t * 3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 16, t % (Math.PI * 2), (t % (Math.PI * 2)) + Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();
  },
};

/** Paint one treasure into a small standalone canvas (used by the discovery card). */
export function renderTreasureIcon(canvas: HTMLCanvasElement, id: TreasureId, t = 0) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 36;
  ctx.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height / 2);
  ART[id](ctx, t);
}

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

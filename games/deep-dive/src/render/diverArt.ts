import type { Player } from '../entities/player';

const SUIT = '#17344a';
const SUIT_LIGHT = '#21607a';
const ACCENT = '#f2b84b';
const FIN = '#f08a3a';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws the diver in body space: head toward +x, air tank on the -y (back) side. */
export function drawDiver(ctx: CanvasRenderingContext2D, p: Player, yOffset = 0) {
  const cos = Math.cos(p.angle);
  const flip = Math.abs(cos) < 0.2 ? p.facing < 0 : cos < 0;
  const onDeck = p.mode === 'deck';
  const kick = onDeck ? Math.sin(p.anim) * 0.35 : Math.sin(p.anim) * 0.45 * p.kickStrength;

  ctx.save();
  ctx.translate(p.x, p.y + yOffset);
  ctx.rotate(p.angle);
  if (flip) ctx.scale(1, -1);

  // Fins + legs (two, opposite phase).
  for (const side of [1, -1]) {
    const k = kick * side;
    ctx.save();
    ctx.translate(-8, side * 3.5);
    ctx.rotate(k * 0.35);
    ctx.fillStyle = side > 0 ? SUIT : '#132a3c';
    roundRect(ctx, -14, -3.5, 16, 7, 3.5);
    ctx.fill();
    ctx.translate(-14, 0);
    ctx.rotate(k);
    ctx.fillStyle = side > 0 ? FIN : '#c96a28';
    ctx.beginPath();
    ctx.moveTo(1, -3);
    ctx.lineTo(-18, -7 + k * 4);
    ctx.lineTo(-19, 6 + k * 4);
    ctx.lineTo(1, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Air tank on the back.
  ctx.fillStyle = ACCENT;
  roundRect(ctx, -9, -14.5, 22, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#9aa9b4';
  ctx.fillRect(12, -13, 3, 5);

  // Torso.
  ctx.fillStyle = SUIT_LIGHT;
  ctx.beginPath();
  ctx.ellipse(3, 0, 13, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -7.5);
  ctx.lineTo(-2, 7.5);
  ctx.stroke();

  // Arm reaching forward.
  const reach = onDeck ? Math.sin(p.anim + 1) * 2 : Math.sin(p.anim * 0.5) * 2;
  ctx.strokeStyle = SUIT;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(19 + reach, 8);
  ctx.stroke();

  // Head, mask and regulator.
  ctx.fillStyle = '#0f2231';
  ctx.beginPath();
  ctx.arc(19, -1, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fe3ff';
  roundRect(ctx, 21.5, -5.5, 6.5, 7, 2.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(23, -4.5, 1.6, 3);
  ctx.fillStyle = '#2a2f36';
  ctx.beginPath();
  ctx.arc(25, 3.5, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Head lamp glows once underwater.
  if (p.mode === 'swim' && p.depth > 20) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(21, -8, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Shared canvas drawing helpers + the game palette.
 *
 * All art in Phase 1 is drawn with primitives — no image assets — which keeps
 * the download tiny, dodges every asset-path problem, and scales cleanly. When
 * real art arrives later it can replace individual `draw` functions on props
 * without touching any system.
 */

export const PAL = {
  portal: '#97ce4c',
  portalDeep: '#4e7a24',
  portalGlow: '#d7ff96',
  metal: '#5c6b78',
  metalDark: '#39454f',
  metalLight: '#8a9aa6',
  concrete: '#2b3138',
  concreteLight: '#3a424b',
  wood: '#6b4a2f',
  woodDark: '#4a3120',
  ink: '#d7f2ff',
  inkDim: '#7f98a8',
  odd: '#c46bff',
  warn: '#ffc857',
  danger: '#ff5f6d',
  skin: '#e8c39e',
  shirt: '#4aa3c7',
  pants: '#2f4b63',
};

export function roundRect(ctx, x, y, w, h, r = 4) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Soft elliptical ground shadow — the cheapest way to sell "this sits here". */
export function shadow(ctx, cx, cy, rx, ry, alpha = 0.32) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Radial glow blob. Used sparingly — these are the most expensive thing we draw. */
export function glow(ctx, cx, cy, radius, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The green portal. This is the visual anchor of the whole game, so it gets
 * more love than anything else on screen: rotating fringe, inner swirl,
 * drifting spark motes.
 * @param {number} scale 0..1 opening animation
 */
export function drawPortal(ctx, cx, cy, rx, ry, t, scale = 1) {
  if (scale <= 0.001) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Outer bloom
  glow(ctx, 0, 0, rx * 1.9, 'rgba(151,206,76,0.55)', 0.55 + Math.sin(t * 2) * 0.05);

  // Fringe rings — rotate at different speeds for a churning look
  for (let i = 0; i < 4; i++) {
    const k = i / 4;
    const wob = Math.sin(t * (1.4 + i * 0.35) + i) * (3 + i * 1.6);
    ctx.strokeStyle = i % 2 ? 'rgba(215,255,150,0.75)' : 'rgba(78,122,36,0.85)';
    ctx.lineWidth = 6 - i;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (1 - k * 0.16) + wob, ry * (1 - k * 0.16) + wob * 0.5,
      t * (0.3 + i * 0.1), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Interior
  const inner = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
  inner.addColorStop(0, '#e9ffc4');
  inner.addColorStop(0.4, '#97ce4c');
  inner.addColorStop(0.82, '#37631a');
  inner.addColorStop(1, 'rgba(20,40,10,0.15)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swirl arms
  ctx.globalCompositeOperation = 'lighter';
  for (let a = 0; a < 3; a++) {
    ctx.strokeStyle = 'rgba(233,255,196,0.30)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let s = 0; s <= 28; s++) {
      const p = s / 28;
      const ang = t * 1.5 + a * (Math.PI * 2 / 3) + p * 5.2;
      const r = rx * 0.94 * (1 - p);
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r * (ry / rx);
      s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Motes spat out by the rim
  for (let i = 0; i < 7; i++) {
    const ang = t * 0.9 + i * 1.7;
    const r = rx * (1.05 + 0.12 * Math.sin(t * 2 + i * 2.1));
    ctx.fillStyle = 'rgba(215,255,150,0.8)';
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r * (ry / rx), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/**
 * The player: a small stylised figure. Deliberately simple — readable at a
 * glance, cheap to draw, and easy to replace with a sprite sheet later.
 */
export function drawPlayer(ctx, x, y, facing, walkPhase, isMoving) {
  const bob = isMoving ? Math.sin(walkPhase * 2) * 1.6 : Math.sin(walkPhase * 0.35) * 0.6;
  const legSwing = isMoving ? Math.sin(walkPhase * 2) * 4 : 0;

  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 2, 11, 4.5, 0.35);
  ctx.translate(0, bob);

  // legs
  ctx.fillStyle = PAL.pants;
  ctx.fillRect(-6, -14, 4.5, 14 + legSwing * 0.3);
  ctx.fillRect(1.5, -14, 4.5, 14 - legSwing * 0.3);

  // torso
  ctx.fillStyle = PAL.shirt;
  roundRect(ctx, -8, -30, 16, 18, 4);
  ctx.fill();
  // jacket shading
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(facing === 'left' ? 2 : -8, -30, 6, 18);

  // arms
  ctx.fillStyle = PAL.shirt;
  const armSwing = isMoving ? Math.sin(walkPhase * 2 + Math.PI) * 3 : 0;
  ctx.fillRect(-11, -29 + armSwing * 0.3, 3.5, 13);
  ctx.fillRect(7.5, -29 - armSwing * 0.3, 3.5, 13);

  // head
  ctx.fillStyle = PAL.skin;
  ctx.beginPath();
  ctx.arc(0, -37, 8, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = '#3a2b22';
  ctx.beginPath();
  ctx.arc(0, -39.5, 8, Math.PI, Math.PI * 2);
  ctx.fill();

  // eyes (Rick-and-Morty-ish: big whites, small pupils)
  if (facing !== 'up') {
    const dx = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-3 + dx * 0.4, -37, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 + dx * 0.4, -37, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-3 + dx, -36.8, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 + dx, -36.8, 1.25, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Pulsing ring used to mark interactable props the player is near. */
export function drawFocusRing(ctx, cx, cy, r, t, color = PAL.portal) {
  const pulse = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = -t * 18;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * pulse, r * 0.42 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Small floating "!" style marker for undiscovered points of interest. */
export function drawMarker(ctx, cx, cy, t, color = PAL.warn) {
  const y = cy + Math.sin(t * 2.6) * 3;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, y + 7);
  ctx.lineTo(cx - 4.5, y - 2);
  ctx.lineTo(cx + 4.5, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw centred text with an outline so it reads over any background. */
export function label(ctx, text, x, y, size = 11, color = PAL.ink) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

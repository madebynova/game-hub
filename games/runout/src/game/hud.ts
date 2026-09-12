import { clamp, dist } from '../engine/math';
import type { Stage } from '../engine/stage';
import { HEAT } from './config';
import type { Run } from './run';

/** Screen-space overlay: everything the player needs to make the next decision. */
export function drawHud(stage: Stage, run: Run, bankedCash: number): void {
  const { ctx, width } = stage;

  ctx.save();
  ctx.textBaseline = 'middle';

  drawHeatFlash(stage, run);
  drawSpotted(stage, run);
  drawStash(ctx, run, bankedCash);
  drawHeat(ctx, run, width);
  drawClock(ctx, run, width);
  drawStamina(stage, run);
  drawChaseBanner(stage, run);
  drawToasts(stage, run);
  drawVanCompass(stage, run);
  drawControls(stage, run);

  ctx.restore();
}

/** A single orange pulse when the neighbourhood steps up a gear. */
function drawHeatFlash(stage: Stage, run: Run): void {
  if (run.heatFlash <= 0) return;
  const { ctx, width, height } = stage;
  const t = clamp(run.heatFlash, 0, 1);

  const wash = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  wash.addColorStop(0, 'rgba(251, 146, 60, 0)');
  wash.addColorStop(1, `rgba(251, 146, 60, ${0.5 * t})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
}

/**
 * The instant someone lays eyes on you. Without this the first you know about
 * being seen is a chaser appearing, often from off screen.
 */
function drawSpotted(stage: Stage, run: Run): void {
  if (run.spottedFlash <= 0) return;
  const { ctx, width, height } = stage;
  const t = clamp(run.spottedFlash, 0, 1);

  ctx.save();
  ctx.globalAlpha = t;
  ctx.textAlign = 'center';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText('SPOTTED', width / 2, height / 2 - 90 - (1 - t) * 18);
  ctx.restore();
}

function drawStash(ctx: CanvasRenderingContext2D, run: Run, bankedCash: number): void {
  const x = 18;
  const w = 236;

  ctx.fillStyle = 'rgba(8, 11, 18, 0.66)';
  roundRect(ctx, x, 16, w, 62, 10);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = '#8b94a8';
  ctx.fillText('STASH — AT RISK', x + 14, 33);

  if (run.clips > 0) {
    ctx.textAlign = 'right';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#8b94a8';
    ctx.fillText(`${run.clips} CLIP${run.clips === 1 ? '' : 'S'}`, x + w - 14, 33);
  }

  // The at-risk number is the whole decision, so it gets the loudest treatment.
  ctx.textAlign = 'left';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = run.stash > 0 ? '#4ade80' : '#5b6474';
  ctx.fillText(`$${run.stash}`, x + 14, 58);

  ctx.textAlign = 'right';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`banked $${bankedCash}`, x + w - 14, 59);
}

function drawHeat(ctx: CanvasRenderingContext2D, run: Run, width: number): void {
  // Shrink on narrow windows so the bar never runs under the stash or clock panels.
  const barW = clamp(width - 520, 170, 300);
  const x = width / 2 - barW / 2;
  const y = 26;
  const tier = run.heatTier;

  ctx.textAlign = 'center';
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.fillStyle = tier.color;
  ctx.fillText(`HEAT — ${tier.name}`, width / 2, y - 12);

  ctx.fillStyle = 'rgba(8, 11, 18, 0.72)';
  roundRect(ctx, x - 3, y - 3, barW + 6, 18, 9);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  roundRect(ctx, x, y, barW, 12, 6);
  ctx.fill();

  ctx.fillStyle = tier.color;
  roundRect(ctx, x, y, Math.max(6, barW * run.heatFraction), 12, 6);
  ctx.fill();

  // The floor: Heat will never fall below this again tonight. Showing it is what
  // turns "I've been here a while" into a number you can decide against.
  if (run.heatFloorFraction > 0.01) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    roundRect(ctx, x, y, barW * run.heatFloorFraction, 12, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.fillRect(x + barW * run.heatFloorFraction - 1, y - 3, 2, 18);
  }

  // Tier ticks, so the next escalation is always visible ahead of time.
  ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
  for (const step of HEAT.tiers) {
    if (step.at === 0) continue;
    ctx.fillRect(x + (barW * step.at) / HEAT.max, y, 2, 12);
  }

  if (run.exposure > 0) {
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = '#fb923c';
    ctx.fillText(
      run.exposure >= 1 ? 'THE DARK IS NO LONGER HIDING YOU' : 'LIGHTS COMING ON — LESS COVER',
      width / 2,
      y + 30,
    );
  }

  if (run.heatFraction > 0.78) {
    const pulse = 0.5 + Math.sin(Date.now() / 140) * 0.5;
    ctx.globalAlpha = pulse * 0.8;
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText('EXTRACT WHILE YOU STILL CAN', width / 2, y + 46);
    ctx.globalAlpha = 1;
  }
}

function drawClock(ctx: CanvasRenderingContext2D, run: Run, width: number): void {
  const minutes = Math.floor(run.timeLeft / 60);
  const seconds = Math.floor(run.timeLeft % 60);
  const label = run.timeLeft > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : 'SUNRISE';

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8, 11, 18, 0.66)';
  roundRect(ctx, width - 150, 16, 132, 46, 10);
  ctx.fill();

  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = '#8b94a8';
  ctx.fillText('NIGHT LEFT', width - 32, 31);

  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = run.timeLeft > 60 ? '#e6e9f0' : '#fb7185';
  ctx.fillText(label, width - 32, 51);
}

function drawStamina(stage: Stage, run: Run): void {
  const { ctx, width, height } = stage;
  const barW = 260;
  const x = width / 2 - barW / 2;
  const y = height - 54;
  const fraction = clamp(run.player.stamina / run.player.maxStamina, 0, 1);

  ctx.fillStyle = 'rgba(8, 11, 18, 0.6)';
  roundRect(ctx, x - 3, y - 3, barW + 6, 16, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  roundRect(ctx, x, y, barW, 10, 5);
  ctx.fill();

  ctx.fillStyle = run.player.exhausted ? '#f87171' : run.player.sprinting ? '#fbbf24' : '#7dd3fc';
  roundRect(ctx, x, y, Math.max(4, barW * fraction), 10, 5);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(run.player.exhausted ? 'OUT OF BREATH' : 'SHIFT TO SPRINT', width / 2, y + 22);

  if (run.hasDecoys) {
    const none = run.player.decoys === 0;
    ctx.textAlign = 'left';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = none ? '#5b6474' : '#fbbf24';
    ctx.fillText(`[Q] FIRECRACKERS  x${run.player.decoys}`, x + barW + 22, y + 5);
  }
}

function drawChaseBanner(stage: Stage, run: Run): void {
  const chaser = run.chasedBy;
  if (!chaser) return;

  const { ctx, width } = stage;
  const gap = dist(chaser.x, chaser.y, run.player.x, run.player.y);
  const danger = clamp(1 - gap / 420, 0, 1);

  // Red vignette that tightens as they close in.
  const vignette = ctx.createRadialGradient(
    width / 2,
    stage.height / 2,
    Math.min(width, stage.height) * 0.32,
    width / 2,
    stage.height / 2,
    Math.max(width, stage.height) * 0.72,
  );
  vignette.addColorStop(0, 'rgba(248, 113, 113, 0)');
  vignette.addColorStop(1, `rgba(248, 113, 113, ${0.42 * danger})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, stage.height);

  ctx.textAlign = 'center';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText(`RUN!  ${chaser.spec.label}`, width / 2, 92);
}

function drawToasts(stage: Stage, run: Run): void {
  const { ctx, width, height } = stage;
  ctx.textAlign = 'center';

  let y = height - 120;
  for (let i = run.toasts.length - 1; i >= 0; i--) {
    const toast = run.toasts[i];
    if (!toast) continue;

    const fade = clamp(toast.life / 0.6, 0, 1);
    ctx.globalAlpha = fade;

    ctx.font = '700 14px system-ui, sans-serif';
    const boxW = ctx.measureText(toast.text).width + 30;

    ctx.fillStyle = 'rgba(8, 11, 18, 0.8)';
    roundRect(ctx, width / 2 - boxW / 2, y - 15, boxW, 30, 8);
    ctx.fill();

    ctx.fillStyle = toast.color;
    ctx.fillText(toast.text, width / 2, y);

    ctx.globalAlpha = 1;
    y -= 38;
  }
}

/** An arrow to the van whenever it is off screen — the way out is never lost. */
function drawVanCompass(stage: Stage, run: Run): void {
  const { ctx, width, height } = stage;
  const van = run.world.van;

  const sx = run.camera.worldToScreenX(van.x, stage);
  const sy = run.camera.worldToScreenY(van.y, stage);
  const margin = 64;
  if (sx > margin && sx < width - margin && sy > margin && sy < height - margin) return;

  const angle = Math.atan2(sy - height / 2, sx - width / 2);
  const radius = Math.min(width, height) / 2 - 70;
  const x = width / 2 + Math.cos(angle) * radius;
  const y = height / 2 + Math.sin(angle) * radius;
  const metres = Math.round(dist(run.player.x, run.player.y, van.x, van.y) / 10);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = run.stash > 0 ? '#4ade80' : '#7dd3fc';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-9, -9);
  ctx.lineTo(-9, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
  ctx.fillText(`VAN ${metres}m`, x, y + 24);
}

function drawControls(stage: Stage, run: Run): void {
  // Only while the player has yet to ring anything — then it gets out of the way.
  if (run.doorbells > 0 || run.elapsed > 22) return;

  const { ctx, width, height } = stage;
  ctx.textAlign = 'center';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(139, 148, 168, 0.9)';
  // Don't advertise a key the player hasn't unlocked yet.
  const keys = ['WASD MOVE', 'SHIFT SPRINT', 'E RING / EXTRACT'];
  if (run.hasDecoys) keys.push('Q FIRECRACKER');
  keys.push('M MUTE');
  ctx.fillText(keys.join('    '), width / 2, height - 88);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

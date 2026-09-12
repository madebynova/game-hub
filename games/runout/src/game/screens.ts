import type { Stage } from '../engine/stage';
import type { RunSummary } from './run';
import type { SaveData } from './save';
import { UPGRADES, upgradeCost } from './upgrades';
import { jobEffects, type Job } from './jobs';

export interface Button {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  enabled: boolean;
}

/** Buttons produced by the last screen draw, hit-tested against the pointer. */
export type ButtonList = Button[];

export function buttonAt(buttons: ButtonList, x: number, y: number): Button | null {
  for (const button of buttons) {
    const r = button.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return button;
  }
  return null;
}

// ------------------------------------------------------------------- title

export function drawTitle(stage: Stage, save: SaveData): ButtonList {
  const { ctx, width, height } = stage;
  backdrop(stage);

  const cx = width / 2;
  const top = Math.max(70, height / 2 - 210);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `900 ${Math.min(86, width / 8)}px system-ui, sans-serif`;
  ctx.fillStyle = '#e6e9f0';
  ctx.fillText('RUNOUT', cx, top);

  ctx.font = `800 ${Math.min(30, width / 20)}px system-ui, sans-serif`;
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('DING DONG', cx, top + 54);

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#8b94a8';
  ctx.fillText('Ring it. Run. Get the clip. Get back to the van.', cx, top + 96);

  const steps = [
    ['1', 'Walk up to a door and press E.'],
    ['2', 'DING DONG. Somebody is coming.'],
    ['3', 'Be seen legging it — that is the clip.'],
    ['4', 'Lose them, and the house pays out.'],
    ['5', 'Heat rises with every bell. Extract before it buries you.'],
  ] as const;

  let y = top + 146;
  ctx.textAlign = 'left';
  for (const [index, text] of steps) {
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(index, cx - 210, y);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(text, cx - 188, y);
    y += 27;
  }

  ctx.textAlign = 'center';
  const buttons: ButtonList = [];
  buttons.push(primaryButton(stage, 'START THE NIGHT', cx, y + 34, '[ E ]'));

  if (save.stats.runs > 0) {
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      `$${save.cash} banked  ·  ${save.stats.runs} runs  ·  ${save.stats.extractions} clean  ·  ${save.stats.busts} busted  ·  ${save.stats.doorbells} doorbells`,
      cx,
      y + 92,
    );
  }

  return buttons;
}

// ----------------------------------------------------------------- summary

export function drawSummary(stage: Stage, summary: RunSummary, save: SaveData): ButtonList {
  const { ctx, width, height } = stage;
  backdrop(stage);

  const cx = width / 2;
  const top = Math.max(90, height / 2 - 170);
  const won = summary.outcome === 'EXTRACTED';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `900 ${Math.min(58, width / 11)}px system-ui, sans-serif`;
  ctx.fillStyle = won ? '#4ade80' : '#f87171';
  ctx.fillText(won ? 'EXTRACTED' : 'BUSTED', cx, top);

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(
    won
      ? 'Van doors shut. The clips are yours.'
      : summary.recovered > 0
        ? 'Caught on the lawn — but not everything was still on you.'
        : 'Caught on the lawn. Every clip on you is gone.',
    cx,
    top + 46,
  );

  const rows: Array<[string, string, string]> = [
    ['JOB', summary.jobName, '#7dd3fc'],
    ['DOORBELLS RUNG', `${summary.doorbells}`, '#e6e9f0'],
    ['CLIPS LANDED', `${summary.clips}`, '#e6e9f0'],
    ['PEAK HEAT', `${summary.maxHeat}`, summary.maxHeat > 75 ? '#f87171' : '#e6e9f0'],
    ['TIME OUT THERE', `${Math.floor(summary.duration / 60)}:${Math.floor(summary.duration % 60).toString().padStart(2, '0')}`, '#e6e9f0'],
    [won ? 'BANKED' : 'LOST', `$${won ? summary.stash : summary.stash - summary.recovered}`, won ? '#4ade80' : '#f87171'],
  ];

  if (summary.quotaBonus > 0) {
    rows.push(['JOB BONUS', `$${summary.quotaBonus}`, '#fbbf24']);
  }

  if (!won && summary.recovered > 0) {
    rows.push(['SALVAGED FROM THE DRAINPIPE', `$${summary.recovered}`, '#4ade80']);
  }

  let y = top + 96;
  for (const [label, value, color] of rows) {
    ctx.textAlign = 'left';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(label, cx - 170, y);

    ctx.textAlign = 'right';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(value, cx + 170, y);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 170, y + 15);
    ctx.lineTo(cx + 170, y + 15);
    ctx.stroke();

    y += 34;
  }

  ctx.textAlign = 'center';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText(`TOTAL BANKED  $${save.cash}`, cx, y + 12);

  return [primaryButton(stage, 'TO THE GARAGE', cx, y + 62, '[ E ]')];
}

// -------------------------------------------------------------------- jobs

/**
 * Pick the night. Every card says what it pays, what it costs to take, and the
 * concrete things it changes — so the choice is made on readable trade-offs
 * rather than on which number is biggest.
 */
export function drawJobSelect(stage: Stage, save: SaveData, offers: readonly Job[], message: string): ButtonList {
  const { ctx, width, height } = stage;
  backdrop(stage);

  const buttons: ButtonList = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const top = Math.max(48, height / 2 - 280);

  ctx.font = '900 32px system-ui, sans-serif';
  ctx.fillStyle = '#e6e9f0';
  ctx.fillText('TONIGHT’S WORK', width / 2, top);

  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`$${save.cash} banked`, width / 2, top + 32);

  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = message ? '#f87171' : '#64748b';
  ctx.fillText(message || 'Click a job, or press 1-3. The fence takes their cut up front.', width / 2, top + 56);

  const columns = width > 1000 ? 3 : 1;
  const cardW = columns === 1 ? Math.min(560, width - 60) : Math.min(300, (width - 70) / columns - 14);
  const cardH = columns === 1 ? 124 : 250;
  const gap = 14;
  const gridW = columns * cardW + (columns - 1) * gap;
  const startX = width / 2 - gridW / 2;
  const startY = top + 84;

  offers.forEach((job, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * (cardW + gap);
    const y = startY + row * (cardH + gap);
    const affordable = save.cash >= job.entryCost;

    ctx.fillStyle = 'rgba(14, 18, 28, 0.92)';
    roundRect(ctx, x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = affordable ? riskColor(job.risk) : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = affordable ? '#e6e9f0' : '#64748b';
    ctx.fillText(`${index + 1}. ${job.name}`, x + 14, y + 22);

    // Risk pips, so danger reads before any of the text does.
    for (let pip = 0; pip < 4; pip++) {
      ctx.fillStyle = pip < job.risk ? riskColor(job.risk) : 'rgba(255,255,255,0.1)';
      roundRect(ctx, x + cardW - 68 + pip * 14, y + 15, 10, 8, 2);
      ctx.fill();
    }

    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = affordable ? '#4ade80' : '#475569';
    ctx.fillText(`PAYS x${job.payMultiplier}`, x + 14, y + 48);

    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = job.entryCost === 0 ? '#4ade80' : affordable ? '#fbbf24' : '#f87171';
    ctx.fillText(job.entryCost === 0 ? 'NO CUT — FREE TO TAKE' : `CUT: $${job.entryCost}`, x + 14, y + 68);

    // The reasons a job is dangerous are the whole point of the card, so they
    // are shown at every width — stacked under the price on a tall card, beside
    // it on a wide one.
    const effects = jobEffects(job).slice(0, 4);
    if (columns > 1) {
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillStyle = '#8b94a8';
      let lineY = wrapText(ctx, job.blurb, x + 14, y + 90, cardW - 28, 14);

      ctx.fillStyle = '#cbd5e1';
      lineY += 6;
      for (const effect of effects) {
        ctx.fillText(`· ${effect}`, x + 14, lineY);
        lineY += 15;
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px system-ui, sans-serif';
      wrapText(ctx, `Suits: ${job.suits}`, x + 14, y + cardH - 32, cardW - 28, 12);
    } else {
      const right = x + cardW * 0.42;
      // Leave the top-right corner clear for the risk pips.
      const rightW = cardW - (right - x) - 86;

      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillStyle = '#8b94a8';
      let lineY = wrapText(ctx, job.blurb, right, y + 22, rightW, 13);

      ctx.fillStyle = '#cbd5e1';
      lineY += 4;
      for (const effect of effects) {
        ctx.fillText(`· ${effect}`, right, lineY);
        lineY += 14;
      }

      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      wrapText(ctx, `Suits: ${job.suits}`, x + 14, y + cardH - 26, cardW * 0.4 - 14, 11);
    }

    if (!affordable) {
      ctx.textAlign = 'right';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`NEED $${job.entryCost - save.cash} MORE`, x + cardW - 14, y + cardH - 14);
    }

    buttons.push({ id: `job:${job.id}`, rect: { x, y, w: cardW, h: cardH }, enabled: affordable });
  });

  ctx.textAlign = 'center';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  const rows = Math.ceil(offers.length / columns);
  ctx.fillText(
    'Only the stash you are carrying is ever at risk. Banked cash is safe.',
    width / 2,
    startY + rows * (cardH + gap) + 16,
  );

  return buttons;
}

const ROLE_COLORS: Record<string, string> = {
  MOBILITY: '#7dd3fc',
  ENDURANCE: '#4ade80',
  STEALTH: '#a3e635',
  INSURANCE: '#fbbf24',
  INFO: '#c084fc',
  TOOLS: '#fb923c',
};

const RISK_COLORS = ['#4ade80', '#4ade80', '#fbbf24', '#fb923c', '#f87171'] as const;

function riskColor(risk: number): string {
  return RISK_COLORS[Math.min(Math.max(risk, 0), 4)] ?? '#4ade80';
}

// -------------------------------------------------------------------- shop

export function drawShop(stage: Stage, save: SaveData, message: string): ButtonList {
  const { ctx, width, height } = stage;
  backdrop(stage);

  const buttons: ButtonList = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const top = Math.max(54, height / 2 - 270);

  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillStyle = '#e6e9f0';
  ctx.fillText('THE GARAGE', width / 2, top);

  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`$${save.cash}`, width / 2, top + 34);

  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = message ? '#fbbf24' : '#64748b';
  ctx.fillText(message || 'Click a card to buy. Press 1-6 for the keyboard.', width / 2, top + 58);

  // Three across where there is room, two when the window is narrow.
  const columns = width > 900 ? 3 : 2;
  const cardW = Math.min(258, (width - 80) / columns - 16);
  const cardH = 136;
  const gapX = 16;
  const gapY = 14;
  const rows = Math.ceil(UPGRADES.length / columns);
  const gridW = columns * cardW + (columns - 1) * gapX;
  const startX = width / 2 - gridW / 2;
  const startY = top + 86;

  UPGRADES.forEach((upgrade, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    const level = save.upgrades[upgrade.id] ?? 0;
    const maxed = level >= upgrade.maxLevel;
    const cost = upgradeCost(upgrade, level);
    const affordable = !maxed && save.cash >= cost;

    ctx.fillStyle = 'rgba(14, 18, 28, 0.9)';
    roundRect(ctx, x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = maxed
      ? 'rgba(74, 222, 128, 0.45)'
      : affordable
        ? 'rgba(125, 211, 252, 0.55)'
        : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = '#e6e9f0';
    ctx.fillText(`${index + 1}. ${upgrade.name}`, x + 14, y + 22);

    // One-word role, so what kind of build this belongs to reads instantly.
    ctx.textAlign = 'right';
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.fillStyle = ROLE_COLORS[upgrade.role] ?? '#8b94a8';
    ctx.fillText(upgrade.role, x + cardW - 14, y + 22);
    ctx.textAlign = 'left';

    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#8b94a8';
    ctx.fillText(upgrade.tagline, x + 14, y + 40);

    // Level pips.
    for (let pip = 0; pip < upgrade.maxLevel; pip++) {
      ctx.fillStyle = pip < level ? '#7dd3fc' : 'rgba(255, 255, 255, 0.12)';
      roundRect(ctx, x + 14 + pip * 18, y + 54, 13, 6, 3);
      ctx.fill();
    }

    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    wrapText(ctx, upgrade.describe(level), x + 14, y + 80, cardW - 28, 14);

    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = maxed ? '#4ade80' : affordable ? '#4ade80' : '#64748b';
    ctx.fillText(maxed ? 'MAXED' : `$${cost}`, x + 14, y + cardH - 18);

    if (!maxed) {
      ctx.textAlign = 'right';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = affordable ? '#7dd3fc' : '#475569';
      ctx.fillText(affordable ? 'BUY ▸' : 'NOT ENOUGH', x + cardW - 14, y + cardH - 18);
    }

    buttons.push({ id: `buy:${upgrade.id}`, rect: { x, y, w: cardW, h: cardH }, enabled: affordable });
  });

  ctx.textAlign = 'center';
  const goY = startY + rows * (cardH + gapY) + 34;
  buttons.push(primaryButton(stage, 'PICK TONIGHT’S JOB', width / 2, goY, '[ E ]'));

  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Upgrades are permanent. Cash only burns when you spend it.', width / 2, goY + 48);

  return buttons;
}

// ----------------------------------------------------------------- helpers

function backdrop(stage: Stage): void {
  const { ctx, width, height } = stage;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height * 0.5, Math.max(width, height) * 0.75);
  glow.addColorStop(0, 'rgba(40, 60, 92, 0.55)');
  glow.addColorStop(1, 'rgba(11, 13, 18, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function primaryButton(stage: Stage, label: string, cx: number, cy: number, hint: string): Button {
  const { ctx } = stage;
  const w = 268;
  const h = 50;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.fillStyle = 'rgba(125, 211, 252, 0.14)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillStyle = '#e6f6ff';
  ctx.fillText(label, cx, cy - 1);

  ctx.font = '700 10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(125, 211, 252, 0.8)';
  ctx.fillText(hint, cx, cy + 16);

  return { id: 'primary', rect: { x, y, w, h }, enabled: true };
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(' ');
  let line = '';
  let cursorY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
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

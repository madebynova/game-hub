/**
 * THE GLASS FLATS — dimension J-19-ZETA-7.
 *
 * The first dimension. It is not a level: there are no enemies, no timers and
 * nothing chasing you. It exists to teach the loop — wander, notice, take,
 * carry home, analyse — and to hide one object that matters.
 *
 * Layout is hand-placed in Phase 1. The area builder receives the api (and,
 * later, a per-visit seed from the dimension registry) so a future version can
 * scatter its minor props procedurally while keeping the landmarks fixed.
 */

import { makeArea } from '../../world/area.js';
import { pickup, examine, scenery } from '../../world/props.js';
import { PAL, roundRect, shadow, glow, drawPortal } from '../../world/draw.js';
import { portalPanel, h } from '../../ui/panels.js';
import { RNG } from '../../core/rng.js';

const W = 1800, H = 1150;
const AREA = 'glassflats';

export function buildGlassFlats(api) {
  // A fixed seed for Phase 1: the flats look the same every visit. Swapping
  // this for a per-visit seed is how "different versions of the same
  // dimension" will work later.
  const rng = new RNG('glassflats-v1');

  // Pre-rolled decorative scatter, baked into the static layer.
  const scatter = [];
  for (let i = 0; i < 90; i++) {
    scatter.push({
      x: rng.range(40, W - 40),
      y: rng.range(120, H - 40),
      r: rng.range(1.5, 4.5),
      a: rng.range(0.05, 0.22),
    });
  }
  const cracks = [];
  for (let i = 0; i < 52; i++) {
    const cx = rng.range(0, W), cy = rng.range(140, H);
    const pts = [[cx, cy]];
    let a = rng.range(0, Math.PI * 2);
    for (let s = 0; s < 5; s++) {
      a += rng.range(-0.7, 0.7);
      const len = rng.range(30, 90);
      const last = pts[pts.length - 1];
      pts.push([last[0] + Math.cos(a) * len, last[1] + Math.sin(a) * len]);
    }
    cracks.push(pts);
  }

  // ── Glass tree drawing (shared by several props) ─────────────────────────
  const drawTree = (ctx, x, y, hgt, tint, t, seedPhase = 0) => {
    shadow(ctx, x, y, hgt * 0.24, hgt * 0.07, 0.28);
    const sway = Math.sin(t * 0.6 + seedPhase) * 2;

    // Shards pushed up out of the salt around the base — these things grew here.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * hgt * 0.10;
      const sh = hgt * (0.06 + (i % 2) * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + dx, y - sh);
      ctx.lineTo(x + dx + 4, y + 2);
      ctx.lineTo(x + dx - 4, y + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Faceted trunk: two strokes, one bright edge, so it reads as glass not wood.
    ctx.strokeStyle = tint;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - hgt * 0.6, x + sway * 2, y - hgt);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - hgt * 0.05);
    ctx.quadraticCurveTo(x + sway - 2, y - hgt * 0.6, x + sway * 2 - 1, y - hgt * 0.95);
    ctx.stroke();

    ctx.strokeStyle = tint;
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const by = y - hgt * (0.42 + i * 0.14);
      const dir = i % 2 ? 1 : -1;
      const bx = x + sway * (0.4 + i * 0.2);
      const tipX = bx + dir * hgt * (0.18 + i * 0.035);
      const tipY = by - hgt * 0.15;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // a blunt crystal on the end of each branch
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY - 6);
      ctx.lineTo(tipX + 4, tipY);
      ctx.lineTo(tipX, tipY + 5);
      ctx.lineTo(tipX - 4, tipY);
      ctx.closePath();
      ctx.fill();
    }
    // glints
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 3; i++) {
      const gy = y - hgt * (0.4 + i * 0.22);
      const tw = (Math.sin(t * 2 + i * 2 + seedPhase) + 1) * 0.5;
      if (tw > 0.7) {
        ctx.beginPath();
        ctx.arc(x + sway + (i % 2 ? 6 : -6), gy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // ── Props ────────────────────────────────────────────────────────────────

  /** Return portal — stays open behind you. */
  const homePortal = {
    id: 'home_portal', x: 260, y: 900, radius: 110, focusRadius: 84,
    focusColor: PAL.portalGlow, label: 'Open portal', hint: 'Travel',
    draw(ctx, t) {
      shadow(ctx, this.x, this.y + 4, 84, 22, 0.3);
      drawPortal(ctx, this.x, this.y - 74, 80, 94, t, 1);
      glow(ctx, this.x, this.y + 6, 130, 'rgba(151,206,76,0.28)', 0.45);
    },
    onInteract(api) {
      api.audio.play('ui_blip');
      api.ui.openPanel('portal', 'PORTAL — COORDINATE DIAL', portalPanel);
    },
  };

  /** The crashed transit pod — the centrepiece. */
  const pod = examine({
    id: 'pod', area: AREA, x: 1250, y: 420, w: 210, h: 90, solid: true,
    radius: 104, label: 'Crashed transit pod', hint: 'Search the pod',
    marker: true, markerColor: PAL.warn, markerHeight: 110,
    clues: ['clue_pod_crash', 'clue_pod_empty'],
    sound: 'examine',
    lines: [
      'A Citadel civil-transit pod, nose-down in the salt, hull split along one seam.',
      'It has been here a while — long enough for the glass dust to drift against the underside. Nobody has come to collect it, and on the Citadel, everything gets collected.',
      'Inside: four seats. Four restraint harnesses. All four harnesses cut, and cut from the inside, by someone in a hurry with something sharp.',
      'The interior lights still work. They come on when you lean in, which you were not expecting, and you say something undignified.',
      'There is a compartment under the third seat, and it is not locked so much as jammed. You get it open.',
    ],
    repeatLines: [
      'The pod, still here, still nose-down, still four cut harnesses.',
      'You check the compartment again out of hope rather than logic.',
    ],
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 4, 112, 24, 0.38);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.16);
      // hull
      ctx.fillStyle = '#8e969c';
      roundRect(ctx, -105, -86, 210, 86, 34); ctx.fill();
      ctx.fillStyle = '#6f777d';
      roundRect(ctx, -105, -44, 210, 44, 22); ctx.fill();
      // buried nose — the front third is under the salt
      ctx.fillStyle = '#9aa2a8';
      ctx.beginPath();
      ctx.moveTo(-105, -70);
      ctx.quadraticCurveTo(-148, -44, -104, -6);
      ctx.closePath(); ctx.fill();
      // dorsal fin, bent
      ctx.fillStyle = '#7d858b';
      ctx.beginPath();
      ctx.moveTo(52, -84); ctx.lineTo(74, -116); ctx.lineTo(88, -112); ctx.lineTo(82, -80);
      ctx.closePath(); ctx.fill();
      // window band
      ctx.fillStyle = '#1b2d38';
      roundRect(ctx, -76, -72, 150, 30, 14); ctx.fill();
      ctx.fillStyle = 'rgba(151,206,76,0.20)';
      roundRect(ctx, -70, -68, 138, 22, 10); ctx.fill();
      // split seam
      ctx.strokeStyle = '#2b3238'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(22, -86); ctx.lineTo(34, -6); ctx.stroke();
      // scorch
      ctx.fillStyle = 'rgba(20,16,14,0.55)';
      ctx.beginPath(); ctx.ellipse(-62, -30, 34, 18, 0.2, 0, Math.PI * 2); ctx.fill();
      // route stencil, half burnt
      ctx.fillStyle = 'rgba(30,36,40,0.8)';
      ctx.font = 'bold 15px ui-monospace, Consolas, monospace';
      ctx.fillText('9-OR', -96, -12);
      ctx.restore();
      // interior light spilling out of the split
      const a = 0.25 + Math.sin(t * 1.7) * 0.08;
      glow(ctx, x + 40, y - 40, 60, `rgba(180,220,255,${a})`, 0.7);
    },
    onFirst(api) {
      api.state.log('Found a crashed Citadel transit pod on the flats.', 'find');
      api.ui.toast('The compartment under the third seat is open.', { kind: 'warn', label: 'POD' });
    },
  });

  /** Contents of the pod — only exist once it has been searched. */
  const insidePod = (s) => !!s.world.opened[`${AREA}:pod`];

  const shard = pickup({
    id: 'cortex_shard', area: AREA, item: 'cortex_shard',
    x: 1205, y: 500, radius: 62, requires: insidePod,
    marker: true, markerColor: PAL.warn, markerHeight: 44,
    label: 'Something wet-looking', hint: 'Take',
    pickupLabel: 'This one matters',
    focusColor: PAL.warn,
    draw(ctx, t) {
      const x = this.x, y = this.y;
      glow(ctx, x, y - 8, 34, 'rgba(255,200,87,0.35)', 0.4 + Math.sin(t * 2.4) * 0.15);
      ctx.save();
      ctx.translate(x, y - 8);
      ctx.rotate(Math.sin(t * 0.5) * 0.15);
      ctx.fillStyle = '#d9c6a0';
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(3, 12); ctx.lineTo(-7, 8); ctx.lineTo(-8, -4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,150,0.85)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-6 + i * 3, -12);
        ctx.lineTo(-2 + i * 2, 10);
        ctx.stroke();
      }
      ctx.restore();
    },
    clues: [],
    lines: [
      'It is the size of your thumb and it is warm, which nothing in this dimension is.',
      'Hair-fine filaments run through it, and when you turn it over, your own handwriting appears behind your eyes — a shopping list, a name you do not recognise, the number 42 written eleven times.',
      'Then it stops, and your hand is shaking, and the flats are very quiet.',
      'Take it home. Put it under the scanner. Find out what it is before it finds out what you are.',
    ],
  });

  const bolt = pickup({
    id: 'bolt', area: AREA, item: 'rusted_bolt', x: 1350, y: 520,
    requires: insidePod, radius: 54, label: 'Sheared bolt', hint: 'Take',
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#8b7d6b';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 4);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b5f4f'; ctx.fillRect(x - 2, y, 4, 8);
    },
  });

  const chit = pickup({
    id: 'chit', area: AREA, item: 'transit_key', x: 1160, y: 440,
    requires: insidePod, radius: 54, label: 'Burnt card', hint: 'Take',
    focusColor: PAL.odd,
    lines: ['A transit chit, mostly ash. The route stencil survived: 9-ORPH.',
      'The same four characters stencilled on the pod\'s hull. Whoever was in this thing was not going anywhere on the public map.'],
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(0.4);
      ctx.fillStyle = '#c9b48f'; roundRect(ctx, -10, -7, 20, 14, 2); ctx.fill();
      ctx.fillStyle = '#3a2f22'; ctx.fillRect(-9, -6, 9, 12);
      ctx.restore();
    },
  });

  /** Harvestable glass tree. */
  const brokenTree = examine({
    id: 'broken_tree', area: AREA, x: 430, y: 720, radius: 72,
    label: 'Cracked glass tree', hint: 'Break off a shard',
    sound: 'pickup',
    draw(ctx, t) { drawTree(ctx, this.x, this.y, 120, '#9fd4e0', t, 1.2); },
    lines: [
      'The trees are not wood and they are not really trees. They grow, though — slowly, upwards, in the direction of the nearer sun.',
      'This one has a crack running through its lower trunk. A shard comes away in your hand with an unpleasantly musical noise.',
      'The note hangs in the air for four full seconds. Every other tree within sight repeats it back, a quarter-tone flat.',
    ],
    repeatLines: [
      'The crack has already given up everything loose. You could pry another shard out if you needed one.',
    ],
    // Renewable on purpose: a small, repeatable resource node, which is the
    // shape future gatherables will take.
    onEvery(api) {
      if (api.inventory.has('glass_shard')) return;
      api.inventory.add('glass_shard');
      api.ui.toastItem('glass_shard');
    },
  });

  /** The mounted optic — surveillance, torn down. */
  const optic = pickup({
    id: 'optic', area: AREA, item: 'cracked_lens', x: 1520, y: 830,
    radius: 66, label: 'Something metal at the base of a tree', hint: 'Take',
    focusColor: PAL.odd, clues: [],
    marker: true, markerColor: PAL.odd, markerHeight: 40,
    lines: [
      'A camera. Small, expensive, and violently removed — the mount is still screwed into the glass, bent sideways.',
      'It was aimed at the salt pans. Not at the pod. Not at the portal site. At the flat, empty, boring middle of nowhere.',
      'Whoever tore it down did it recently enough that the screw threads are still bright.',
    ],
    draw(ctx, t) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#2f3740';
      roundRect(ctx, x - 11, y - 12, 22, 14, 3); ctx.fill();
      ctx.fillStyle = '#12303a';
      ctx.beginPath(); ctx.arc(x + 12, y - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(196,107,255,${0.4 + Math.sin(t * 3) * 0.2})`;
      ctx.beginPath(); ctx.arc(x + 12, y - 5, 2.4, 0, Math.PI * 2); ctx.fill();
    },
  });

  /** Salt crystals — the "ordinary" collectible, repeatable-feeling. */
  const saltA = pickup({
    id: 'salt_a', area: AREA, item: 'salt_crystal', x: 770, y: 980, radius: 52,
    label: 'Salt bloom', hint: 'Take a crystal',
    draw(ctx) { drawSalt(ctx, this.x, this.y, 1); },
  });
  const saltB = pickup({
    id: 'salt_b', area: AREA, item: 'salt_crystal', x: 900, y: 1060, radius: 52,
    label: 'Salt bloom', hint: 'Take a crystal',
    draw(ctx) { drawSalt(ctx, this.x, this.y, 0.8); },
  });

  function drawSalt(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#e7eef2';
    for (const [dx, dy, r] of [[0, 0, 9], [-9, 3, 6], [8, 4, 5], [2, -7, 5]]) {
      ctx.beginPath();
      ctx.moveTo(dx, dy - r); ctx.lineTo(dx + r, dy); ctx.lineTo(dx, dy + r * 0.7); ctx.lineTo(dx - r, dy);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(160,190,210,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 5, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Spore pod in the bloom field. */
  const sporePickup = pickup({
    id: 'spore', area: AREA, item: 'spore_pod', x: 790, y: 270, radius: 58,
    label: 'Twitching pod', hint: 'Take',
    lines: ['It flinches. You take it anyway, which says something about you that you may want to examine later.'],
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 12, 4, 0.25);
      const sq = 1 + Math.sin(t * 2.2) * 0.06;
      ctx.save();
      ctx.translate(x, y - 12);
      ctx.scale(1 / sq, sq);
      ctx.fillStyle = '#9d7f4f';
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7b6339';
      ctx.beginPath(); ctx.ellipse(-3, -3, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  });

  /** The humming cube — the deliberate dead end that promises later content. */
  const cube = pickup({
    id: 'cube', area: AREA, item: 'humming_cube', x: 1010, y: 1030, radius: 62,
    label: 'A black cube, half buried', hint: 'Dig it out',
    focusColor: PAL.odd,
    marker: true, markerColor: PAL.odd, markerHeight: 40,
    lines: [
      'It takes both hands and a lot of swearing to get it out of the salt.',
      'It is a matte black cube with no seams, no markings and no temperature. Well — it has a temperature. It is four degrees colder than everything else, and it stays four degrees colder no matter what you do.',
      'It hums. Not loudly. At exactly the pitch of the glass trees.',
    ],
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 18, 6, 0.4);
      ctx.fillStyle = '#0d1014';
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(0.2);
      roundRect(ctx, -14, -14, 28, 28, 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = `rgba(196,107,255,${0.12 + Math.sin(t * 1.3) * 0.08})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y - 10, 22 + Math.sin(t * 1.3) * 3, 0, Math.PI * 2); ctx.stroke();
    },
  });

  /** BIPP — the local. Not a quest giver; just someone who lives here. */
  const bipp = {
    id: 'bipp', x: 560, y: 540, w: 34, h: 40, radius: 78,
    label: 'A salt farmer', hint: 'Talk',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 14, 5, 0.3);
      const bob = Math.sin(t * 1.4) * 1.5;
      ctx.save();
      ctx.translate(0, bob);
      // body: a squat three-legged lump in a poncho
      ctx.fillStyle = '#7a5f8c';
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x - 14, y - 34);
      ctx.quadraticCurveTo(x, y - 46, x + 14, y - 34);
      ctx.lineTo(x + 20, y);
      ctx.closePath(); ctx.fill();
      // head
      ctx.fillStyle = '#c8a6dd';
      ctx.beginPath(); ctx.ellipse(x, y - 50, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      // three eyes on stalks, blinking out of sync
      for (let i = 0; i < 3; i++) {
        const ex = x - 8 + i * 8;
        const ey = y - 60 - Math.abs(Math.sin(t * 0.9 + i * 1.7)) * 4;
        ctx.strokeStyle = '#c8a6dd'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex, y - 54); ctx.lineTo(ex, ey); ctx.stroke();
        const open = Math.sin(t * 1.6 + i * 2.3) > -0.85;
        ctx.fillStyle = open ? '#fff' : '#8f6aa8';
        ctx.beginPath(); ctx.arc(ex, ey - 2, 3.4, 0, Math.PI * 2); ctx.fill();
        if (open) {
          ctx.fillStyle = '#20141f';
          ctx.beginPath(); ctx.arc(ex, ey - 2, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      // rake in the salt next to them
      ctx.strokeStyle = '#6b5f4f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 30, y); ctx.lineTo(x + 24, y - 44); ctx.stroke();
    },
    onInteract(api) { talkToBipp(api); },
  };

  /** Signpost — flavour + a nudge that there is more world than this. */
  const signpost = examine({
    id: 'signpost', area: AREA, x: 330, y: 660, radius: 62,
    label: 'A signpost', hint: 'Read sign',
    lines: [
      'A signpost, in the middle of a salt flat, pointing in four directions.',
      'NORTH: MORE SALT.\nEAST: MORE SALT (BETTER).\nSOUTH: THE THING.\nWEST: DO NOT.',
      'You are currently, as far as you can tell, west.',
    ],
    draw(ctx) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 8, 3, 0.3);
      ctx.fillStyle = '#6b5f4f'; ctx.fillRect(x - 3, y - 70, 6, 70);
      const arms = [[-34, -58, '#8d7c64'], [22, -46, '#7e6e58'], [-28, -34, '#8d7c64']];
      for (const [dx, dy, c] of arms) {
        ctx.fillStyle = c;
        ctx.fillRect(x + (dx < 0 ? dx : 0), y + dy, Math.abs(dx) + 12, 10);
      }
    },
  });

  /** Broken vending machine — the Citadel reaches everywhere. */
  const vendor = examine({
    id: 'vendor', area: AREA, x: 1610, y: 330, w: 60, h: 90, solid: true, radius: 70,
    label: 'A vending machine', hint: 'Use machine',
    sound: 'denied',
    lines: [
      'A Citadel-branded vending machine, upright, powered, in the middle of an uninhabited dimension.',
      'It accepts your input immediately and cheerfully. It dispenses nothing. The display says THANK YOU and then, after a pause, THANK YOU.',
      'The restock label on the side is dated four days ago.',
    ],
    repeatLines: ['THANK YOU.', 'THANK YOU.'],
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 32, 9, 0.35);
      ctx.fillStyle = '#b3453f'; roundRect(ctx, x - 30, y - 92, 60, 92, 5); ctx.fill();
      ctx.fillStyle = '#16232c'; roundRect(ctx, x - 24, y - 84, 38, 56, 3); ctx.fill();
      ctx.fillStyle = 'rgba(151,206,76,0.25)';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x - 21 + c * 12, y - 80 + r * 18, 9, 13);
      ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ffd76b' : '#6b5a2b';
      ctx.fillRect(x + 18, y - 76, 8, 8);
      ctx.fillStyle = '#2a1c1a'; ctx.fillRect(x - 24, y - 22, 46, 14);
    },
  });

  /** Bones — someone else got here first, a long time ago. */
  const bones = examine({
    id: 'bones', area: AREA, x: 1180, y: 920, radius: 58,
    label: 'Bones', hint: 'Examine bones',
    lines: [
      'A skeleton, picked clean and bleached by two suns. Bipedal. Not human — too many joints in the wrong places.',
      'It is lying on its back with its arms folded, which is not how anyone dies by accident.',
      'Someone arranged this. Someone tidy.',
    ],
    clues: [],
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#ddd6c4';
      ctx.save();
      ctx.translate(x, y); ctx.rotate(0.25);
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-32, -2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ddd6c4'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 9, -9); ctx.lineTo(i * 9, 9); ctx.stroke();
      }
      ctx.restore();
    },
  });

  // Decorative trees
  const trees = [];
  const treeSpots = [
    [180, 420, 150], [300, 300, 110], [620, 200, 130], [980, 340, 100],
    [1450, 620, 160], [1520, 820, 140], [1680, 980, 120], [740, 700, 90],
    [1050, 760, 115], [420, 1020, 105], [200, 760, 125], [1350, 1080, 95],
    [880, 480, 85], [1620, 520, 105],
  ];
  treeSpots.forEach(([x, y, hgt], i) => {
    trees.push(scenery({
      id: `tree_${i}`, x, y, sortY: y,
      draw(ctx, t) { drawTree(ctx, x, y, hgt, i % 3 ? '#8fc6d6' : '#a9d9c8', t, i * 1.3); },
    }));
  });

  const props = [
    ...trees, homePortal, pod, shard, bolt, chit, brokenTree, optic,
    saltA, saltB, sporePickup, cube, bipp, signpost, vendor, bones,
  ];

  // ── The area ─────────────────────────────────────────────────────────────

  return makeArea({
    id: AREA,
    name: 'The Glass Flats',
    sub: 'J-19-ZETA-7',
    w: W, h: H,
    bg: '#c8c2b4',
    spawn: { x: 340, y: 860 },
    portalArrival: { x: 340, y: 960 },
    ambience: 'flats',
    colliders: [
      { x: 0, y: 0, w: W, h: 110 },
      { x: 0, y: 0, w: 24, h: H },
      { x: W - 24, y: 0, w: 24, h: H },
      { x: 0, y: H - 24, w: W, h: 24 },
    ],
    props,

    paintStatic(ctx) {
      // Sky band at the top — this is a horizon, not a wall.
      const sky = ctx.createLinearGradient(0, 0, 0, 240);
      sky.addColorStop(0, '#6f5f8f');
      sky.addColorStop(0.55, '#b98a8e');
      sky.addColorStop(1, '#e0cfae');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 240);

      // Two suns.
      glow(ctx, 380, 70, 130, 'rgba(255,240,190,0.9)', 0.9);
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(380, 70, 26, 0, Math.PI * 2); ctx.fill();
      glow(ctx, 1240, 46, 80, 'rgba(255,150,170,0.75)', 0.8);
      ctx.fillStyle = '#ffb3c0';
      ctx.beginPath(); ctx.arc(1240, 46, 13, 0, Math.PI * 2); ctx.fill();

      // Distant mountain range of shattered glass.
      ctx.fillStyle = 'rgba(120,120,150,0.45)';
      ctx.beginPath();
      ctx.moveTo(0, 190);
      for (let x = 0; x <= W; x += 60) {
        ctx.lineTo(x, 190 - Math.abs(Math.sin(x * 0.011)) * 58 - ((x * 37) % 23));
      }
      ctx.lineTo(W, 240); ctx.lineTo(0, 240); ctx.closePath(); ctx.fill();

      // The flats themselves.
      const ground = ctx.createLinearGradient(0, 200, 0, H);
      ground.addColorStop(0, '#ded6c2');
      ground.addColorStop(0.35, '#cfc7b3');
      ground.addColorStop(1, '#b8b2a2');
      ctx.fillStyle = ground;
      ctx.fillRect(0, 200, W, H - 200);

      // Salt pan polygons.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      for (const pts of cracks) {
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }

      // Wet-looking salt pan around the blooms.
      ctx.fillStyle = 'rgba(210,225,232,0.55)';
      ctx.beginPath(); ctx.ellipse(840, 1010, 230, 96, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230,240,245,0.5)';
      ctx.beginPath(); ctx.ellipse(760, 300, 180, 70, -0.2, 0, Math.PI * 2); ctx.fill();

      // Scattered glitter.
      for (const s of scatter) {
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }

      // Mineral staining — broad, soft patches so the plain is not one flat tan.
      const patches = [
        [1180, 640, 380, 150, 'rgba(150,170,190,0.12)'],
        [520, 420, 300, 120, 'rgba(190,160,180,0.14)'],
        [1500, 300, 260, 110, 'rgba(160,185,170,0.14)'],
        [700, 820, 340, 130, 'rgba(175,175,200,0.13)'],
        [250, 1050, 260, 100, 'rgba(200,175,150,0.12)'],
      ];
      for (const [px, py, prx, pry, colour] of patches) {
        ctx.fillStyle = colour;
        ctx.beginPath(); ctx.ellipse(px, py, prx, pry, 0.2, 0, Math.PI * 2); ctx.fill();
      }

      // The furrow the pod ploughed on the way in: a gouge in the salt, drawn as
      // overlapping soft ellipses so it tapers away instead of reading as a beam.
      for (let i = 0; i < 26; i++) {
        const k = i / 25;                       // 0 = far end, 1 = at the pod
        const fx = 1250 - 560 * (1 - k);
        const fy = 470 - 46 * k;
        const rx = 34 + 26 * k;
        const ry = 7 + 13 * k;
        ctx.fillStyle = `rgba(122,112,96,${0.05 + 0.13 * k})`;
        ctx.beginPath(); ctx.ellipse(fx, fy, rx, ry, -0.08, 0, Math.PI * 2); ctx.fill();
        // salt thrown up along the rim
        ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.10 * k})`;
        ctx.beginPath(); ctx.ellipse(fx, fy - ry * 0.9, rx * 0.9, ry * 0.45, -0.08, 0, Math.PI * 2); ctx.fill();
      }
      const debris = new RNG('glassflats-debris');
      ctx.fillStyle = 'rgba(90,96,100,0.75)';
      for (let i = 0; i < 40; i++) {
        const dx = 1250 - debris.range(0, 620);
        const dy = 470 + debris.range(-40, 130) + (1250 - dx) * 0.10;
        const ds = debris.range(2, 7);
        ctx.fillRect(dx, dy, ds, ds * debris.range(0.4, 1));
      }

      // Scorch ring where the portal keeps opening.
      ctx.fillStyle = 'rgba(90,110,60,0.18)';
      ctx.beginPath(); ctx.ellipse(260, 905, 110, 40, 0, 0, Math.PI * 2); ctx.fill();
    },

    /** Heat haze + drifting dust, drawn cheaply. */
    paintOverlay(ctx, t, { cam }) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#ffe9c0';
      // A few slow dust motes, positioned from the camera so they always show.
      for (let i = 0; i < 18; i++) {
        const px = cam.x + ((i * 137 + t * 22) % 960);
        const py = cam.y + ((i * 89 + Math.sin(t * 0.4 + i) * 30 + 120) % 540);
        ctx.beginPath(); ctx.arc(px, py, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },

    onEnter(api, visits) {
      api.ui.setLocation('The Glass Flats', 'J-19-ZETA-7');
      api.audio.ambience('flats');
      if (visits === 1) {
        api.state.log('Stepped through the portal for the first time. The Glass Flats.', 'travel');
        api.ui.narrate([
          'You step through and the temperature drops eleven degrees and the sound changes shape.',
          'A salt plain under two suns, stretching further than you can see. Trees made of glass, growing in patches, ringing very faintly in a wind you cannot feel.',
          'Nothing here wants to kill you. That is the first thing you check for, which is itself worth thinking about.',
          'Somebody dialled this place and then never came. Go and find out why.',
        ]);
      }
    },
  });
}

/**
 * Bipp's dialogue. Branching, but small — a demonstration of the shape NPC
 * conversations will take rather than a full dialogue system.
 */
function talkToBipp(api) {
  api.audio.play('ui_blip');
  const first = !api.state.flag('metBipp');
  api.state.setFlag('metBipp', true);

  // setPanel, not openPanel: each dialogue node replaces the previous one, and
  // openPanel would treat the repeated id as a request to close.
  const say = (lines, choices) => {
    api.ui.setPanel('bipp', 'BIPP — SALT FARMER', (body) => {
      for (const l of lines) body.appendChild(h('p', { text: l }));
      const wrap = h('div.choices');
      for (const c of choices) {
        wrap.appendChild(h('button', {
          text: c.label,
          onclick: () => { api.audio.play('ui_blip'); c.go(); },
        }));
      }
      body.appendChild(wrap);
    });
  };

  const topics = () => say(
    ['Bipp waits. Three eyes, three different speeds of blinking.'],
    [
      {
        label: '"Has anyone else been out here?"',
        go: () => {
          api.state.addClue('clue_bipp');
          say([
            '"A Rick comes. Every few sleeps. Never buys salt."',
            '"Stands where the pod is. Looks at it. Doesn\'t touch it. Then walks back into his portal facing the wrong way — backwards, understand? Watching the flats the whole time he leaves."',
            '"I said hello once. He said my name. I never told him my name."',
          ], [{ label: 'Ask something else', go: topics }, { label: 'Leave', go: () => api.ui.closePanel() }]);
        },
      },
      {
        label: '"What crashed over there?"',
        go: () => say([
          '"Pod fell. Eleven days back. Loud."',
          '"Four came out. Three walked east." Bipp\'s middle eye swivels. "One got carried. Carried by someone who came out of a portal after, not out of the pod."',
          '"I mind my salt."',
        ], [{ label: 'Ask something else', go: topics }, { label: 'Leave', go: () => api.ui.closePanel() }]),
      },
      {
        label: '"What is this place?"',
        go: () => say([
          '"Flats. Salt. Trees that sing. Two suns, one is rude."',
          '"Citadel buys the salt. Pays in vouchers for a machine that doesn\'t work." Bipp gestures at the vending machine with an eye. "I am very rich in thank yous."',
        ], [{ label: 'Ask something else', go: topics }, { label: 'Leave', go: () => api.ui.closePanel() }]),
      },
      { label: 'Say nothing and leave', go: () => api.ui.closePanel() },
    ],
  );

  if (first) {
    say([
      'The salt farmer sees you coming from a long way off and does not stop raking.',
      '"You came out of the green hole," it says. "People who come out of the green hole either buy salt or ask questions."',
      '"You have no money. So."',
    ], [{ label: 'Ask questions', go: topics }, { label: 'Walk away', go: () => api.ui.closePanel() }]);
  } else {
    topics();
  }
}

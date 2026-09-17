/**
 * THE GARAGE — permanent home base.
 *
 * Small on purpose: one screen and a bit, densely furnished. Every station the
 * player will use for the rest of the game lives here, plus several things that
 * do nothing yet and say so honestly.
 *
 * Expansion seams:
 *   - `props` is a flat list; a garage upgrade in Phase 2 adds or unhides props
 *     (see the `gone()` predicates, which already read save state).
 *   - The sealed hatch and the house door are real props with real interactions
 *     that currently refuse — they are the doors Phase 2 opens.
 */

import { makeArea } from '../../world/area.js';
import { PAL, roundRect, shadow, glow, drawPortal, label } from '../../world/draw.js';
import { researchPanel, memoryPanel, portalPanel, h } from '../../ui/panels.js';

const W = 1160, H = 720;
const FLOOR_TOP = 130;

export function buildGarage(api) {
  // ── Props ────────────────────────────────────────────────────────────────

  /** THE PORTAL — the visual anchor and the way out. */
  const portal = {
    id: 'portal', x: 880, y: 360, w: 170, h: 30,
    radius: 120, focusRadius: 92, focusColor: PAL.portalGlow,
    label: 'The green portal', hint: 'Use portal',
    sortY: 362,
    draw(ctx, t) {
      // Wall rig that holds the portal gun
      ctx.fillStyle = PAL.metalDark;
      roundRect(ctx, this.x - 16, FLOOR_TOP - 34, 32, 60, 5); ctx.fill();
      ctx.fillStyle = PAL.metal;
      roundRect(ctx, this.x - 11, FLOOR_TOP - 24, 22, 40, 4); ctx.fill();
      ctx.fillStyle = PAL.portal;
      ctx.fillRect(this.x - 4, FLOOR_TOP + 12, 8, 26);

      // Floor scorch
      shadow(ctx, this.x, this.y + 6, 108, 30, 0.35);
      // The hole itself
      drawPortal(ctx, this.x, this.y - 82, 92, 108, t, 1);
      // Light spill on the floor
      glow(ctx, this.x, this.y + 8, 150, 'rgba(151,206,76,0.30)', 0.5);
    },
    onInteract(api) {
      api.audio.play('ui_blip');
      api.ui.openPanel('portal', 'PORTAL — COORDINATE DIAL', portalPanel);
    },
  };

  /** RESEARCH STATION */
  const research = {
    id: 'research', x: 250, y: 250, w: 190, h: 54, solid: true,
    radius: 88, label: 'Research station', hint: 'Analyse discoveries',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 2, 98, 12, 0.3);
      // counter
      ctx.fillStyle = PAL.metalDark; roundRect(ctx, x - 95, y - 54, 190, 54, 4); ctx.fill();
      ctx.fillStyle = PAL.metal; roundRect(ctx, x - 95, y - 60, 190, 14, 4); ctx.fill();
      // scanner arch
      ctx.strokeStyle = PAL.metalLight; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x - 40, y - 60, 26, Math.PI, 0); ctx.stroke();
      // sample plate
      const busy = !!api.state.data.research.active;
      ctx.fillStyle = busy ? PAL.odd : '#1d2a33';
      ctx.beginPath(); ctx.ellipse(x - 40, y - 58, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (busy) {
        glow(ctx, x - 40, y - 70, 42, 'rgba(196,107,255,0.55)', 0.5 + Math.sin(t * 6) * 0.2);
        ctx.strokeStyle = 'rgba(196,107,255,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 40, y - 84 + Math.sin(t * 4) * 8);
        ctx.lineTo(x - 40, y - 58);
        ctx.stroke();
      }
      // monitor
      ctx.fillStyle = '#0b1218'; roundRect(ctx, x + 18, y - 96, 62, 40, 3); ctx.fill();
      ctx.fillStyle = busy ? '#7be0a0' : '#2b4a3a';
      for (let i = 0; i < 4; i++) {
        const wdt = 10 + ((i * 17 + Math.floor(t * (busy ? 8 : 1))) % 40);
        ctx.fillRect(x + 23, y - 90 + i * 8, wdt, 3);
      }
    },
    onInteract(api) {
      api.audio.play('ui_blip');
      api.ui.openPanel('research', 'RESEARCH STATION', researchPanel);
    },
  };

  /** MEMORY DEVICE */
  const memory = {
    id: 'memory', x: 540, y: 250, w: 110, h: 48, solid: true,
    radius: 86, label: 'Memory reconstruction rig', hint: 'Use the rig',
    marker: true, markerColor: PAL.odd, markerHeight: 96,
    markerDone: (s) => !s.flags.memoryDeviceOnline || s.memory.fragments.length > 0,
    draw(ctx, t) {
      const x = this.x, y = this.y;
      const online = api.state.data.flags.memoryDeviceOnline;
      shadow(ctx, x, y + 2, 58, 11, 0.3);
      // chair
      ctx.fillStyle = '#3c2c36'; roundRect(ctx, x - 26, y - 48, 52, 48, 6); ctx.fill();
      ctx.fillStyle = '#4d3a46'; roundRect(ctx, x - 30, y - 96, 60, 52, 8); ctx.fill();
      // head rig arm
      ctx.strokeStyle = PAL.metal; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x + 26, y - 92); ctx.quadraticCurveTo(x + 56, y - 130, x + 6, y - 132); ctx.stroke();
      // halo
      ctx.strokeStyle = online ? PAL.odd : PAL.metalDark;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x - 2, y - 132, 22, 9, 0, 0, Math.PI * 2); ctx.stroke();
      if (online) {
        glow(ctx, x - 2, y - 132, 50, 'rgba(196,107,255,0.5)', 0.35 + Math.sin(t * 2.2) * 0.12);
        // dangling electrodes flicker
        ctx.fillStyle = 'rgba(196,107,255,0.9)';
        for (let i = 0; i < 3; i++) {
          const px = x - 16 + i * 16;
          ctx.fillRect(px, y - 128 + Math.sin(t * 3 + i) * 2, 2, 12);
        }
      }
      // readout
      ctx.fillStyle = '#0b1218'; roundRect(ctx, x - 58, y - 70, 26, 34, 3); ctx.fill();
      label(ctx, `${api.state.data.memory.recovery}%`, x - 45, y - 53, 9, online ? PAL.odd : PAL.inkDim);
    },
    onInteract(api) {
      api.audio.play(api.memory.isOnline() ? 'ui_blip' : 'denied');
      api.ui.openPanel('memory', 'MEMORY RECONSTRUCTION RIG', memoryPanel);
    },
  };

  /** TERMINAL */
  const terminal = {
    id: 'terminal', x: 760, y: 240, w: 130, h: 44, solid: true,
    radius: 80, label: 'Rick\'s terminal', hint: 'Read terminal',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 2, 68, 11, 0.3);
      ctx.fillStyle = PAL.woodDark; roundRect(ctx, x - 65, y - 44, 130, 44, 3); ctx.fill();
      ctx.fillStyle = PAL.wood; roundRect(ctx, x - 65, y - 50, 130, 12, 3); ctx.fill();
      // CRT
      ctx.fillStyle = '#242c33'; roundRect(ctx, x - 44, y - 106, 88, 62, 6); ctx.fill();
      const awake = api.state.data.flags.watcherEvent1;
      ctx.fillStyle = awake ? '#071a10' : '#050c0a';
      roundRect(ctx, x - 38, y - 100, 76, 48, 3); ctx.fill();
      ctx.fillStyle = awake ? '#6fdc7a' : '#1d3a26';
      for (let i = 0; i < 5; i++) {
        const w2 = 8 + ((i * 23 + Math.floor(t * 3)) % 52);
        ctx.fillRect(x - 33, y - 94 + i * 8, w2, 2.5);
      }
      if (awake) glow(ctx, x, y - 76, 62, 'rgba(111,220,122,0.35)', 0.4);
      // keyboard
      ctx.fillStyle = '#2d3841'; roundRect(ctx, x - 30, y - 40, 60, 16, 2); ctx.fill();
    },
    onInteract(api) { openTerminal(api); },
  };

  /** WORKBENCH — Phase 2 crafting, honest about it now. */
  const workbench = {
    id: 'workbench', x: 300, y: 600, w: 180, h: 50, solid: true,
    radius: 84, label: 'Workbench', hint: 'Examine bench',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 2, 92, 12, 0.3);
      ctx.fillStyle = PAL.woodDark; roundRect(ctx, x - 90, y - 50, 180, 50, 3); ctx.fill();
      ctx.fillStyle = PAL.wood; roundRect(ctx, x - 90, y - 58, 180, 14, 3); ctx.fill();
      // vice
      ctx.fillStyle = PAL.metal; ctx.fillRect(x + 54, y - 74, 22, 18);
      // scattered tools
      ctx.fillStyle = '#b0483a'; ctx.fillRect(x - 74, y - 64, 26, 5);
      ctx.fillStyle = PAL.metalLight; ctx.fillRect(x - 34, y - 63, 34, 3);
      ctx.fillStyle = PAL.warn; ctx.beginPath(); ctx.arc(x + 6, y - 62, 5, 0, Math.PI * 2); ctx.fill();
      // the scratched sigil — an open eye
      ctx.strokeStyle = 'rgba(20,10,4,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x - 12, y - 30, 13, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 12, y - 37); ctx.lineTo(x - 12, y - 23); ctx.stroke();
    },
    onInteract(api) {
      api.audio.play('examine');
      const first = api.state.addClue('clue_sigil');
      api.ui.narrate([
        'A workbench that has been used hard by someone who never once tidied it.',
        'Half-built gadgets, a soldering iron still faintly warm, and a schematic for something with the words "DO NOT" written across it and no further instructions.',
        first
          ? 'Scratched into the wood, deep, recent: a circle with a vertical slit through it. An open eye.\nYou have seen it before. You cannot think where, and trying feels like pressing a bruise.'
          : 'The scratched eye is still there. It has not blinked. You checked.',
        'You could build something here, if you knew how, and had parts, and had any idea what you were doing.',
      ]);
    },
  };

  /** STORAGE */
  const storage = {
    id: 'storage', x: 640, y: 620, w: 130, h: 60, solid: true,
    radius: 78, label: 'Storage crates', hint: 'Search crates',
    draw(ctx) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 2, 70, 12, 0.32);
      ctx.fillStyle = '#4b5a3c'; roundRect(ctx, x - 65, y - 56, 78, 56, 4); ctx.fill();
      ctx.fillStyle = '#5d6f4a'; roundRect(ctx, x - 65, y - 62, 78, 12, 3); ctx.fill();
      ctx.fillStyle = '#3f4c33'; roundRect(ctx, x + 6, y - 44, 58, 44, 4); ctx.fill();
      ctx.fillStyle = '#4e5e3f'; roundRect(ctx, x + 6, y - 50, 58, 11, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 58, y - 34, 64, 3);
      ctx.fillRect(x + 14, y - 26, 42, 3);
    },
    onInteract(api) {
      api.audio.play('examine');
      api.ui.narrate([
        'Crates. Most are empty. One is full of identical unlabelled batteries, which is either very useful or a war crime.',
        'One crate is nailed shut and hums when you put your ear to it. The nails are new.',
        'Nothing you can do with any of this yet. You put the lid back the way you found it, roughly.',
      ]);
    },
  };

  /** TARP — a mysterious object. Phase 2 hook. */
  const tarp = {
    id: 'tarp', x: 1010, y: 610, w: 140, h: 70, solid: true,
    radius: 84, label: 'Something under a tarp', hint: 'Lift the tarp',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y + 2, 78, 14, 0.34);
      ctx.fillStyle = '#4a4f57';
      ctx.beginPath();
      ctx.moveTo(x - 72, y);
      ctx.lineTo(x - 58, y - 64);
      ctx.quadraticCurveTo(x, y - 92, x + 60, y - 58);
      ctx.lineTo(x + 72, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 6, y - 80); ctx.lineTo(x + 8, y - 78); ctx.lineTo(x + 4, y); ctx.closePath(); ctx.fill();
      // a single green LED breathing under the fabric
      const a = 0.35 + Math.sin(t * 1.5) * 0.25;
      ctx.fillStyle = `rgba(151,206,76,${a})`;
      ctx.beginPath(); ctx.arc(x + 30, y - 30, 3.5, 0, Math.PI * 2); ctx.fill();
    },
    onInteract(api) {
      api.audio.play('examine');
      api.ui.narrate([
        'You lift the corner of the tarp.',
        'Underneath is a machine roughly the size of a motorcycle, with no wheels, no seat, and eleven separate warning stickers in a language that uses too many exclamation marks.',
        'A green LED on its flank is breathing slowly, like something asleep that would prefer to stay that way.',
        'You put the tarp back. You are not ready for this and you know it.',
      ]);
    },
  };

  /** STOOL — the thing that moves while you are away. */
  const stool = {
    id: 'stool', x: 430, y: 440, w: 34, h: 30,
    radius: 60, label: 'Stool', hint: 'Look at the stool',
    draw(ctx) {
      const x = this.x, y = this.y;
      const upright = api.state.data.flags.watcherEvent1;
      shadow(ctx, x, y + 2, 20, 6, 0.3);
      ctx.save();
      if (!upright) { ctx.translate(x, y); ctx.rotate(1.45); ctx.translate(-x, -y + 10); }
      ctx.fillStyle = PAL.metalDark;
      ctx.fillRect(x - 13, y - 30, 4, 30);
      ctx.fillRect(x + 9, y - 30, 4, 30);
      ctx.fillStyle = PAL.metal;
      ctx.beginPath(); ctx.ellipse(x, y - 32, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    onInteract(api) {
      api.audio.play('examine');
      if (api.state.data.flags.watcherEvent1) {
        api.ui.narrate([
          'The stool is upright.',
          'You knocked it over on your way out. You are certain, in the specific way you are certain of very little today.',
          'Someone set it back on its feet. Someone tidy. Someone who was in here.',
        ]);
      } else {
        api.ui.narrate(['A metal stool, on its side. You may have done that. Recent history is not your strong suit.']);
      }
    },
  };

  /** WALL BOARD — Rick's handwriting. Establishes whose garage this is. */
  const board = {
    id: 'board', x: 120, y: 190, w: 120, h: 20,
    radius: 78, label: 'Scribbled board', hint: 'Read the board',
    interactYOffset: -20,
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#20262b'; roundRect(ctx, x - 70, y - 118, 140, 96, 4); ctx.fill();
      ctx.fillStyle = '#161b1f'; roundRect(ctx, x - 65, y - 113, 130, 86, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,255,0.45)'; ctx.lineWidth = 1.4;
      // fake handwriting
      const lines = [[-56, -100, 40], [-56, -88, 56], [-56, -76, 30], [-56, -64, 48], [-56, -52, 20]];
      for (const [lx, ly, len] of lines) {
        ctx.beginPath();
        for (let i = 0; i <= len; i += 4) {
          ctx.lineTo(x + lx + i, y + ly + Math.sin(i * 0.9) * 1.8);
        }
        ctx.stroke();
      }
      // a circled thing, angrily circled
      ctx.strokeStyle = 'rgba(255,95,109,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + 26, y - 70, 24, 14, -0.2, 0, Math.PI * 2); ctx.stroke();
    },
    onInteract(api) {
      api.audio.play('examine');
      api.state.addClue('clue_not_your_garage');
      api.ui.narrate([
        'Equations. Pages of them, in handwriting that gets angrier as it goes down the board.',
        'Most of it is notation you do not recognise. Some of it is notation you are fairly sure is being rude about other notation.',
        'One cluster is circled three times in red, and next to it, in block capitals: "IT ISN\'T A SIDE EFFECT."',
        'At the bottom, smaller, in a different pen: a tally. Forty-one marks. The forty-second is started and unfinished.',
      ]);
    },
  };

  /** SEALED HATCH — locked content, Phase 2. */
  const hatch = {
    id: 'hatch', x: 170, y: 460, w: 76, h: 50,
    radius: 66, label: 'Sealed floor hatch', hint: 'Try the hatch',
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#242a30';
      ctx.beginPath(); ctx.ellipse(x, y - 8, 40, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PAL.metal; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y - 8, 34, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PAL.metalDark;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 30, y - 8 + Math.sin(a) * 17, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = PAL.danger;
      ctx.fillRect(x - 10, y - 11, 20, 6);
    },
    onInteract(api) {
      api.audio.play('door_locked');
      api.ui.narrate([
        'A hatch set into the concrete, sealed with six bolts and a lock that reads your hand and does not like it.',
        'A red strip above the lock says: OWNER ONLY. Below that, scratched in by hand: "AND NOT EVEN THEN."',
        'Something moves down there. Not much. Once.',
      ]);
    },
  };

  /** DOOR TO THE HOUSE — locked. */
  const door = {
    id: 'door', x: 1085, y: 200, w: 40, h: 90,
    radius: 70, label: 'Door into the house', hint: 'Try the door',
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#5a4030'; roundRect(ctx, x - 30, y - 128, 60, 128, 3); ctx.fill();
      ctx.fillStyle = '#6b4c39'; roundRect(ctx, x - 25, y - 122, 50, 116, 2); ctx.fill();
      ctx.fillStyle = PAL.warn; ctx.beginPath(); ctx.arc(x + 16, y - 64, 4, 0, Math.PI * 2); ctx.fill();
      // hand-written note taped to it
      ctx.fillStyle = '#e8e2cf'; ctx.fillRect(x - 16, y - 100, 26, 20);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 13, y - 95 + i * 5); ctx.lineTo(x + 6, y - 95 + i * 5); ctx.stroke(); }
    },
    onInteract(api) {
      api.audio.play('door_locked');
      api.ui.narrate([
        'Locked. Not deadbolted — locked in the way a door is locked when the lock is newer than the door.',
        'The note taped at eye level says, in tired handwriting:\n"IF YOU\'RE READING THIS YOU\'RE NOT SUPPOSED TO BE IN THERE EITHER. DON\'T KNOCK."',
        'You do not knock.',
      ]);
    },
  };

  /** THE SHUTTER — where the figure appears. */
  const shutter = {
    id: 'shutter', x: 580, y: 700, w: 300, h: 26,
    radius: 76, label: 'Garage shutter', hint: 'Check the shutter',
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#2f373d';
      ctx.fillRect(x - 170, y - 26, 340, 26);
      ctx.strokeStyle = '#1d2429'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(x - 170, y - 22 + i * 5); ctx.lineTo(x + 170, y - 22 + i * 5); ctx.stroke();
      }
      // the gap at the bottom, and whatever light comes under it
      ctx.fillStyle = 'rgba(120,150,170,0.18)';
      ctx.fillRect(x - 168, y - 3, 336, 4);
    },
    onInteract(api) {
      api.audio.play('door_locked');
      const seen = api.state.data.flags.watcherEvent2;
      api.ui.narrate([
        'The shutter is down and locked from the outside, which is an interesting choice for a garage door.',
        'There is a two-inch gap at the bottom. Through it: pavement, the bottom of a streetlight, and the ordinary orange half-dark of a Citadel night cycle.',
        seen
          ? 'Nobody is standing there now. There are no footprints. The dust under the gap is perfectly smooth, and you find you do not like that either.'
          : 'No sound. Not even the distant traffic you would expect on a residential ring.',
      ]);
    },
  };

  /** PLANT — pure flavour, zero mechanics, deliberately. */
  const plant = {
    id: 'plant', x: 990, y: 240, w: 40, h: 40,
    radius: 58, label: 'Dead plant', hint: 'Examine plant',
    draw(ctx, t) {
      const x = this.x, y = this.y;
      shadow(ctx, x, y, 16, 5, 0.3);
      ctx.fillStyle = '#7a5138'; roundRect(ctx, x - 14, y - 22, 28, 22, 3); ctx.fill();
      ctx.strokeStyle = '#4e5f33'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.quadraticCurveTo(x + i * 16, y - 44, x + i * 22, y - 30 + Math.sin(t * 0.8 + i) * 1.5);
        ctx.stroke();
      }
    },
    onInteract(api) {
      api.audio.play('examine');
      api.ui.narrate([
        'A houseplant that died of neglect some time ago and has been left as a warning to other houseplants.',
        'Someone has stuck a label in the soil. It says "STEVE". Under that, in the same hand: "NOT A CONTROL GROUP ANYMORE".',
      ]);
    },
  };

  const props = [board, research, memory, terminal, plant, door, portal, stool, hatch, workbench, storage, tarp, shutter];

  // ── The area ─────────────────────────────────────────────────────────────

  return makeArea({
    id: 'garage',
    name: "Rick's Garage",
    sub: 'HOME · CITADEL',
    kind: 'home',
    w: W, h: H,
    bg: '#20262c',
    spawn: { x: 560, y: 430 },
    portalArrival: { x: 880, y: 470 },
    ambience: 'garage',
    colliders: [
      { x: 0, y: 0, w: W, h: FLOOR_TOP - 8 },          // back wall
      { x: 0, y: 0, w: 46, h: H },                      // left wall
      { x: W - 46, y: 0, w: 46, h: H },                 // right wall
      { x: 0, y: H - 28, w: W, h: 28 },                 // shutter wall
    ],
    props,

    /** Baked once: floor, walls, clutter that never changes. */
    paintStatic(ctx) {
      // floor
      ctx.fillStyle = '#2b3138';
      ctx.fillRect(0, FLOOR_TOP - 8, W, H - FLOOR_TOP + 8);
      // floor grime + oil stains
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const stains = [[300, 350, 70, 26], [700, 520, 90, 30], [520, 300, 50, 18], [980, 420, 60, 22]];
      for (const [sx, sy, rx, ry] of stains) {
        ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // floor seams
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
      for (let x = 0; x <= W; x += 145) { ctx.beginPath(); ctx.moveTo(x, FLOOR_TOP - 8); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = FLOOR_TOP + 60; y <= H; y += 145) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // back wall
      const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
      wall.addColorStop(0, '#171c21');
      wall.addColorStop(1, '#333c44');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, FLOOR_TOP - 8);
      ctx.fillStyle = '#434d56';
      ctx.fillRect(0, FLOOR_TOP - 12, W, 6);

      // side walls
      ctx.fillStyle = '#272d33';
      ctx.fillRect(0, 0, 46, H);
      ctx.fillRect(W - 46, 0, 46, H);

      // wall clutter: pegboard + hanging tools
      ctx.fillStyle = '#2c3339'; roundRect(ctx, 380, 22, 150, 86, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let gx = 390; gx < 525; gx += 12) for (let gy = 32; gy < 104; gy += 12) ctx.fillRect(gx, gy, 3, 3);
      ctx.strokeStyle = PAL.metalLight; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(404, 40); ctx.lineTo(404, 76); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(430, 40); ctx.lineTo(444, 70); ctx.stroke();
      ctx.beginPath(); ctx.arc(474, 52, 12, 0.4, Math.PI * 1.6); ctx.stroke();

      // shelves
      ctx.fillStyle = '#3a3229';
      ctx.fillRect(600, 30, 130, 8);
      ctx.fillRect(600, 72, 130, 8);
      const jars = ['#6fa05a', '#a05a6f', '#5a7fa0', '#a0925a'];
      jars.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(610 + i * 30, 12, 16, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(612 + i * 30, 14, 4, 14);
      });
      ctx.fillStyle = '#4b5a3c';
      ctx.fillRect(618, 52, 28, 20);
      ctx.fillRect(660, 48, 22, 24);

      // hazard stripe by the portal rig
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? '#1d2126' : '#c8a83c';
        ctx.fillRect(790 + i * 13, FLOOR_TOP - 8, 13, 7);
      }
      ctx.restore();

      // grimy corner light pools
      const lamp = (cx, cy, r) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255, 238, 200, 0.10)');
        g.addColorStop(1, 'rgba(255, 238, 200, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      };
      lamp(280, 320, 260);
      lamp(760, 360, 280);
      lamp(560, 620, 220);
    },

    /** Dynamic overlay: the apparition, plus a subtle vignette. */
    paintOverlay(ctx, t) {
      const app = api.world.apparition;
      if (app > 0) {
        // A silhouette standing in the shutter gap, fading in and out.
        const a = Math.min(1, app) * (0.55 + Math.sin(t * 9) * 0.12);
        // Left of the storage crates so the silhouette reads as a clean shape.
        const x = 470, y = 700;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#05070a';
        ctx.beginPath();
        ctx.moveTo(x - 26, y - 6);
        ctx.lineTo(x - 21, y - 120);
        ctx.quadraticCurveTo(x, y - 156, x + 21, y - 120);
        ctx.lineTo(x + 26, y - 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 132, 15, 0, Math.PI * 2); ctx.fill();
        // spiked hair suggestion
        ctx.beginPath();
        ctx.moveTo(x - 16, y - 140);
        ctx.lineTo(x - 6, y - 162);
        ctx.lineTo(x + 2, y - 143);
        ctx.lineTo(x + 12, y - 160);
        ctx.lineTo(x + 17, y - 138);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = PAL.portal;
        ctx.fillRect(x - 5, y - 128, 2.5, 2.5);
        ctx.fillRect(x + 3, y - 128, 2.5, 2.5);
        ctx.restore();
      }
    },

    onEnter(api, visits) {
      api.ui.setLocation("Rick's Garage", 'HOME · CITADEL');
      api.audio.ambience('garage');
      if (visits > 1) api.state.log('Returned to the garage.', 'travel');
    },
  });
}

/**
 * The terminal is its own little screen with several readable "files". It is
 * the main lore delivery device and grows every phase — new entries just get
 * appended to `files` with a `when` predicate.
 */
function openTerminal(api) {
  api.audio.play('ui_blip');
  api.state.addClue('clue_terminal_locked');

  const files = [
    {
      id: 'welcome', name: 'session.log', always: true,
      body: (s) => [
        'GARAGE TERMINAL — SESSION LOG',
        '',
        '> SESSION 0441 ........ OWNER — 6h 12m — normal',
        '> SESSION 0442 ........ OWNER — 0h 04m — portal rig armed, coordinate loaded, NOT USED',
        '> SESSION 0443 ........ GUEST — active now — hello',
        s.flags.watcherEvent1
          ? '> SESSION 0444 ........ OWNER — 0h 00m — local console, while you were out\n>>> touched: session.log, camera.feed, rig.status\n>>> left no notes'
          : '',
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'rig', name: 'rig.status', always: true,
      body: (s) => [
        'PORTAL RIG — STATUS',
        '',
        `FLUID          : 94%`,
        `CLAMP          : engaged`,
        `BUFFER         : 1 coordinate loaded (J-19-ZETA-7)`,
        `LAST TRAVEL    : ${s.stats.portalTrips ? `${s.stats.portalTrips} trip(s) this session` : 'none this session'}`,
        '',
        'NOTE (OWNER): the buffer coordinate was dialled and then not used. The rig has been',
        'sitting armed for eleven days. Whoever loaded it changed their mind, or stopped being',
        'available to press the button.',
      ].join('\n'),
    },
    {
      id: 'camera', name: 'camera.feed', always: true,
      body: (s) => [
        'EXTERIOR CAMERA — DRIVEWAY',
        '',
        s.flags.watcherEvent1
          ? 'FEED: offline (cable cut, interior side)\nLAST FRAME RETAINED: 1\n\n[ frame shows the driveway, empty, and in the lower right corner a shoe.\n  Just a shoe. Whoever it belongs to is standing outside the frame, close\n  enough to have reached up and cut the cable without moving their feet. ]'
          : 'FEED: online\n\n[ the driveway. empty. a streetlight doing its best. nothing has moved in\n  the six hours of footage the buffer holds, including the leaves. ]',
      ].join('\n'),
    },
    {
      id: 'locked', name: 'owner/', always: true,
      body: () => [
        'ACCESS DENIED — OWNER CREDENTIAL REQUIRED',
        '',
        '  owner/notes/            [locked]',
        '  owner/subjects/         [locked]',
        '  owner/subjects/041/     [locked]',
        '  owner/subjects/042/     [locked]  (created 11 days ago)',
        '  owner/DONOTOPEN/        [locked]  (0 bytes)',
        '',
        'Three failed access attempts will notify the owner.',
        'You have made zero. The counter says two.',
      ].join('\n'),
    },
    {
      id: 'research_index', name: 'archive.idx', always: true,
      body: (s) => [
        'LOCAL RESEARCH ARCHIVE',
        '',
        `ENTRIES ON FILE : ${s.research.completed.length}`,
        `MEMORY RECOVERY : ${s.memory.recovery}%`,
        `CLUES INDEXED   : ${s.clues.length}`,
        '',
        s.research.completed.length
          ? 'Full reports are readable at the research station.'
          : 'Nothing analysed yet. The station is three metres behind you and it is not shy.',
      ].join('\n'),
    },
  ];

  api.ui.openPanel('terminal', "RICK'S TERMINAL", (body, a, refresh) => {
    const s = a.state.data;
    body.appendChild(h('p.p-lead', { text: 'A terminal that has decided you are a guest. Guests get the boring directories.' }));

    const nav = h('div', { style: 'display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px' });
    for (const f of files) {
      nav.appendChild(h('button.act.ghost', {
        text: f.name,
        onclick: () => { a.audio.play('ui_blip'); openFile(f); },
      }));
    }
    body.appendChild(nav);

    const out = h('div.term');
    body.appendChild(out);

    const openFile = (f) => {
      out.textContent = '';
      const text = f.body(s);
      // Typewriter reveal, paced by the clock rather than by frames so it reads
      // the same on a 60fps desktop and a Chromebook having a bad day.
      const CPS = 900;
      const t0 = performance.now();
      const tick = () => {
        if (!a.ui.isPanelOpen() || a.ui.panelId() !== 'terminal') return;
        const shown = Math.min(text.length, Math.floor(((performance.now() - t0) / 1000) * CPS));
        out.textContent = text.slice(0, shown);
        if (shown < text.length) requestAnimationFrame(tick);
      };
      tick();
    };
    openFile(files[0]);
  });
}

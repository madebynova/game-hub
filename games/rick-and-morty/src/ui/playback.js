/**
 * Memory playback.
 *
 * A fragment is more than a text box: the device takes over the screen, paints
 * the fragment's own visual, and feeds the transcript through one line at a
 * time. Built as a standalone overlay so future fragment types (audio-only,
 * interactive, corrupted) can reuse or replace the presentation.
 */

import { getFragment } from '../data/memories.js';
import { normaliseCode } from '../core/input.js';

export class Playback {
  constructor(api) {
    this.api = api;
    this.active = false;
  }

  /**
   * @param {string} fragId
   * @param {boolean} replay true = already owned, skip the grant + fanfare
   */
  async play(fragId, replay = false) {
    if (this.active) return;
    const frag = getFragment(fragId);
    if (!frag) return;

    const { ui, audio, fx, memory, bus } = this.api;
    this.active = true;
    ui.closePanel();
    ui.lockInput(true);

    await fx.fadeOut(600);
    audio.play('memory');

    // ── Build the overlay ────────────────────────────────────────────────
    const host = document.createElement('div');
    host.style.cssText = `position:absolute;inset:0;z-index:30;background:#04060a;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:18px;padding:5vh 6vw;pointer-events:auto;cursor:pointer;`;

    const canvas = document.createElement('canvas');
    canvas.width = 720; canvas.height = 260;
    canvas.style.cssText = 'width:min(720px,92%);height:auto;border:1px solid #3a2350;border-radius:8px;background:#04060a;';
    host.appendChild(canvas);

    const head = document.createElement('div');
    head.style.cssText = `font-family:ui-monospace,Consolas,monospace;font-size:10px;
      letter-spacing:.28em;color:#c46bff;text-transform:uppercase;`;
    head.textContent = frag.title;
    host.appendChild(head);

    const line = document.createElement('p');
    line.style.cssText = `max-width:720px;min-height:5.2em;margin:0;text-align:center;
      font-size:17px;line-height:1.6;color:#d7f2ff;`;
    host.appendChild(line);

    const more = document.createElement('div');
    more.style.cssText = `font-family:ui-monospace,Consolas,monospace;font-size:10px;
      letter-spacing:.24em;color:#7f98a8;`;
    more.textContent = 'CLICK OR PRESS SPACE';
    host.appendChild(more);

    document.getElementById('stage').appendChild(host);
    await fx.fadeIn(500);

    // ── Animate the visual ───────────────────────────────────────────────
    const ctx = canvas.getContext('2d');
    const t0 = performance.now();
    let raf = 0;
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      try { frag.paint(ctx, canvas.width, canvas.height, t); } catch (err) { console.error(err); }
      raf = requestAnimationFrame(draw);
    };
    draw();

    // ── Feed the transcript ──────────────────────────────────────────────
    let i = 0;
    const show = () => {
      line.textContent = frag.transcript[i];
      audio.play('ui_blip', { gain: 0.35 });
    };
    show();

    await new Promise((resolve) => {
      let cooling = true;
      setTimeout(() => { cooling = false; }, 350);
      const advance = () => {
        if (cooling) return;
        i++;
        if (i >= frag.transcript.length) { cleanup(); resolve(); return; }
        cooling = true;
        setTimeout(() => { cooling = false; }, 140);
        show();
      };
      const onKey = (e) => {
        if (['Space', 'Enter', 'KeyE', 'Escape'].includes(normaliseCode(e))) { e.preventDefault(); advance(); }
      };
      const onClick = () => advance();
      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        host.removeEventListener('click', onClick);
      };
      window.addEventListener('keydown', onKey);
      host.addEventListener('click', onClick);
    });

    // ── Device's own cold note ───────────────────────────────────────────
    if (frag.note) {
      line.style.color = '#7f98a8';
      line.style.fontSize = '14px';
      line.textContent = frag.note;
      more.textContent = 'CLICK TO CLOSE';
      await new Promise((resolve) => {
        const done = () => { window.removeEventListener('keydown', onKey); host.removeEventListener('click', done); resolve(); };
        const onKey = (e) => { if (['Space', 'Enter', 'KeyE', 'Escape'].includes(normaliseCode(e))) { e.preventDefault(); done(); } };
        setTimeout(() => {
          window.addEventListener('keydown', onKey);
          host.addEventListener('click', done);
        }, 300);
      });
    }

    // ── Tear down ────────────────────────────────────────────────────────
    cancelAnimationFrame(raf);
    await fx.fadeOut(420);
    host.remove();

    if (!replay) {
      memory.recover(fragId);
      audio.play('discovery');
    }

    await fx.fadeIn(600);
    ui.lockInput(false);
    this.active = false;
    bus.emit('memory:playback-done', { fragId, replay });
  }
}

/**
 * UI manager.
 *
 * Owns every DOM overlay: location tag, interaction hint, toasts, narration
 * queue, the modal panel host and the research ticker. Systems call into this
 * and never touch the DOM themselves.
 */

import { getItem } from '../data/items.js';

export class UI {
  /**
   * @param {import('../core/input.js').Input} input
   * @param {import('../core/events.js').EventBus} bus
   */
  constructor(input, bus) {
    this.input = input;
    this.bus = bus;
    this.api = null; // set by main once the service bundle exists

    this.el = {
      locName: document.getElementById('location-name'),
      locSub: document.getElementById('location-sub'),
      hint: document.getElementById('hint'),
      hintText: document.getElementById('hint-text'),
      toasts: document.getElementById('toasts'),
      narration: document.getElementById('narration'),
      narrationText: document.getElementById('narration-text'),
      panelHost: document.getElementById('panel-host'),
      panel: document.getElementById('panel'),
      panelTitle: document.getElementById('panel-title'),
      panelBody: document.getElementById('panel-body'),
      panelClose: document.getElementById('panel-close'),
      ticker: document.getElementById('research-ticker'),
      tickerName: document.querySelector('#research-ticker .rt-name'),
      tickerBar: document.querySelector('#research-ticker .rt-bar i'),
      bottomBar: document.getElementById('bottom-bar'),
      audioToggle: document.getElementById('audio-toggle'),
    };

    /** @type {{lines: string[], index: number, done?: Function}|null} */
    this._narration = null;
    /**
     * Timestamp before which narration will not advance. Wall-clock rather
     * than a per-frame counter on purpose: clicking must stay responsive even
     * if requestAnimationFrame is being throttled (background tab, a very slow
     * machine, a Chromebook deciding to think about its life).
     */
    this._advanceAfter = 0;
    this._panel = null;   // { id, refresh }

    this.el.panelClose.addEventListener('click', () => this.closePanel());
    this.el.narration.addEventListener('click', () => this._advanceNarration());

    // Bottom-bar buttons are wired by main (they need the api bundle).
  }

  /** Called once by main.js with the full service bundle. */
  attach(api) { this.api = api; }

  // ── Location tag ────────────────────────────────────────────────────────
  setLocation(name, sub = '') {
    this.el.locName.textContent = name;
    this.el.locSub.textContent = sub;
  }

  // ── Interaction hint ────────────────────────────────────────────────────
  showHint(text) {
    if (this.el.hintText.textContent !== text) this.el.hintText.textContent = text;
    this.el.hint.classList.remove('hidden');
  }
  hideHint() { this.el.hint.classList.add('hidden'); }

  // ── Toasts ──────────────────────────────────────────────────────────────
  toast(text, { kind = '', label = '', ms = 4200 } = {}) {
    const div = document.createElement('div');
    div.className = `toast ${kind}`;
    if (label) {
      const small = document.createElement('small');
      small.textContent = label;
      div.appendChild(small);
    }
    div.appendChild(document.createTextNode(text));
    this.el.toasts.appendChild(div);
    setTimeout(() => {
      div.classList.add('fading');
      setTimeout(() => div.remove(), 450);
    }, ms);
    // Keep the stack short so it never covers the play area.
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  /** Convenience for item pickups. */
  toastItem(itemId, note = 'Picked up') {
    const item = getItem(itemId);
    if (!item) return;
    this.toast(`${item.glyph}  ${item.name}`, {
      kind: item.rarity === 'common' ? '' : item.rarity === 'rare' ? 'warn' : 'odd',
      label: note,
    });
  }

  // ── Narration ───────────────────────────────────────────────────────────

  get narrating() { return !!this._narration; }

  /**
   * Show a sequence of lines, one at a time. Returns a promise resolved when
   * the player has clicked through all of them.
   * @param {string|string[]} lines
   */
  narrate(lines, { sound = true } = {}) {
    const arr = Array.isArray(lines) ? lines.slice() : [lines];
    if (this._narration) {
      // Queue onto the current sequence rather than clobbering it.
      this._narration.lines.push(...arr);
      return this._narration.promise;
    }
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this._narration = { lines: arr, index: 0, resolve, promise, sound };
    this._advanceAfter = performance.now() + 220;
    this.lockInput(true);
    this.el.narration.classList.remove('hidden');
    this._renderNarration();
    return promise;
  }

  _renderNarration() {
    const n = this._narration;
    if (!n) return;
    this.el.narrationText.textContent = n.lines[n.index];
    if (n.sound && this.api) this.api.audio.play('ui_blip', { gain: 0.5 });
  }

  _advanceNarration() {
    const n = this._narration;
    if (!n || performance.now() < this._advanceAfter) return;
    n.index++;
    if (n.index >= n.lines.length) {
      this._narration = null;
      this.el.narration.classList.add('hidden');
      this.lockInput(false);
      n.resolve();
      this.bus.emit('ui:narration-done');
      return;
    }
    this._advanceAfter = performance.now() + 140;
    this._renderNarration();
  }

  // ── Panels ──────────────────────────────────────────────────────────────

  isPanelOpen() { return !!this._panel; }
  panelId() { return this._panel?.id ?? null; }

  /**
   * @param {string} id        logical panel id (used for toggling)
   * @param {string} title     header text
   * @param {(body: HTMLElement, api: object, refresh: Function) => void} build
   */
  openPanel(id, title, build) {
    // Toggle off if the same panel is already open. This is the entry point for
    // hotkeys and props — pressing I twice should close the inventory.
    if (this._panel?.id === id) { this.closePanel(); return; }
    this.setPanel(id, title, build);
  }

  /**
   * Open a panel, or swap the contents of the one already open, without the
   * toggle behaviour. Multi-step screens (dialogue trees, reports, wizards)
   * must use this: calling openPanel again with the same id would close them.
   */
  setPanel(id, title, build) {
    const wasOpen = !!this._panel;
    this._panel = { id, title, build };
    this.el.panelTitle.textContent = title;
    this.el.panelHost.classList.remove('hidden');
    this.lockInput(true);
    this.refreshPanel();
    if (!wasOpen) this.bus.emit('ui:panel-opened', id);
  }

  /** Re-run the current panel's builder — call after state changes. */
  refreshPanel() {
    if (!this._panel) return;
    const body = this.el.panelBody;
    const scroll = body.scrollTop;
    body.textContent = '';
    try {
      this._panel.build(body, this.api, () => this.refreshPanel());
    } catch (err) {
      console.error('[ui] panel build failed', err);
      body.textContent = 'This panel broke. Sorry. Try closing and reopening it.';
    }
    body.scrollTop = scroll;
  }

  setPanelTitle(title) {
    if (this._panel) this._panel.title = title;
    this.el.panelTitle.textContent = title;
  }

  closePanel() {
    if (!this._panel) return;
    const id = this._panel.id;
    this._panel = null;
    this.el.panelHost.classList.add('hidden');
    this.el.panelBody.textContent = '';
    if (!this._narration) this.lockInput(false);
    this.api?.audio.play('ui_close');
    this.bus.emit('ui:panel-closed', id);
  }

  // ── Research ticker ─────────────────────────────────────────────────────
  updateTicker(job, pct) {
    if (!job) { this.el.ticker.classList.add('hidden'); return; }
    this.el.ticker.classList.remove('hidden');
    this.el.tickerName.textContent = job.title;
    this.el.tickerBar.style.width = `${Math.round(pct * 100)}%`;
  }

  // ── Misc ────────────────────────────────────────────────────────────────
  lockInput(locked) { this.input.locked = locked; }
  wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  flashTab(panelId) {
    const btn = this.el.bottomBar.querySelector(`[data-panel="${panelId}"]`);
    if (!btn) return;
    btn.classList.add('alert');
    setTimeout(() => btn.classList.remove('alert'), 6000);
  }

  /** Per-frame: keyboard handling for narration and panels. */
  update() {
    if (this._narration) {
      if (this.input.pressedRaw('interact') || this.input.pressedRaw('cancel')) {
        this._advanceNarration();
      }
      return;
    }

    if (this._panel && this.input.pressedRaw('cancel')) this.closePanel();
  }
}

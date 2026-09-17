/**
 * Keyboard + mouse input.
 *
 * Exposes an intent-level API (`moveVector()`, `pressed('interact')`) rather
 * than raw key codes so rebinding or adding gamepad support later touches only
 * this file.
 */

const BINDINGS = {
  up:       ['KeyW', 'ArrowUp'],
  down:     ['KeyS', 'ArrowDown'],
  left:     ['KeyA', 'ArrowLeft'],
  right:    ['KeyD', 'ArrowRight'],
  interact: ['KeyE', 'Space', 'Enter'],
  inventory:['KeyI'],
  journal:  ['KeyJ'],
  help:     ['KeyH'],
  cancel:   ['Escape'],
  sprint:   ['ShiftLeft', 'ShiftRight'],
};

/**
 * Normalise an event into a KeyboardEvent.code string.
 *
 * `code` is the right thing to bind to (it is layout-independent, so WASD stays
 * under the same fingers on AZERTY). A few environments — some remote-control
 * and automation stacks, a handful of on-screen keyboards — deliver keydown
 * with an empty `code`, so fall back to `key`.
 */
export function normaliseCode(e) {
  if (e.code) return e.code;
  const k = e.key;
  if (!k) return '';
  if (k === ' ' || k === 'Spacebar') return 'Space';
  if (k === 'Escape' || k === 'Esc') return 'Escape';
  if (k === 'Enter') return 'Enter';
  if (k === 'Shift') return 'ShiftLeft';
  if (k.startsWith('Arrow')) return k;
  if (k.length === 1) {
    const c = k.toUpperCase();
    if (c >= 'A' && c <= 'Z') return `Key${c}`;
    if (c >= '0' && c <= '9') return `Digit${c}`;
  }
  return '';
}

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./events.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
    this.down = new Set();          // codes currently held
    this.justPressed = new Set();   // codes pressed since last frame flush
    /** Pointer position in *logical* canvas coordinates. */
    this.mouse = { x: 0, y: 0, inside: false };
    this.clicked = false;           // consumed once per frame
    /** When true, gameplay input is ignored (a panel or cutscene owns the keys). */
    this.locked = false;

    this._onKeyDown = (e) => {
      const code = normaliseCode(e);
      if (!code) return;
      // Stop the page scrolling out from under the game.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.down.add(code);
      this.justPressed.add(code);
      this.bus.emit('input:key', code);
    };
    this._onKeyUp = (e) => this.down.delete(normaliseCode(e));
    this._onBlur = () => { this.down.clear(); };

    this._onMove = (e) => this._track(e);
    this._onClick = (e) => {
      // Take the position from the click itself. A tap (or a synthetic click)
      // can arrive without a preceding mousemove, and a stale pointer position
      // would then aim the interaction at the wrong place.
      this._track(e);
      if (!this.locked) this.clicked = true;
    };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('click', this._onClick);
  }

  /** Update the cached pointer position from a mouse/pointer event. */
  _track(e) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
    this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    this.mouse.inside =
      this.mouse.x >= 0 && this.mouse.y >= 0 &&
      this.mouse.x <= this.canvas.width && this.mouse.y <= this.canvas.height;
  }

  /** Is any key bound to `action` currently held? */
  held(action) {
    if (this.locked) return false;
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  /** Was `action` pressed during this frame? */
  pressed(action) {
    if (this.locked) return false;
    return BINDINGS[action].some((c) => this.justPressed.has(c));
  }

  /** Raw check that ignores the input lock — used by UI/cutscene code. */
  pressedRaw(action) {
    return BINDINGS[action].some((c) => this.justPressed.has(c));
  }

  /** Normalised movement vector, {x, y} in [-1, 1]. */
  moveVector() {
    let x = 0, y = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1;
    if (this.held('down')) y += 1;
    if (x && y) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
    return { x, y };
  }

  consumeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  /** Called at the end of every frame by the loop. */
  flush() {
    this.justPressed.clear();
    this.clicked = false;
  }
}

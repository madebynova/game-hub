/** Full-screen effects: fades, flashes, glitches. Pure DOM/CSS — free. */

export class FX {
  constructor(el) {
    this.el = el;
    this.el.style.opacity = '0';
  }

  /** @param {number} ms transition duration */
  fadeOut(ms = 500) {
    this.el.classList.remove('flash', 'glitch');
    this.el.style.transitionDuration = `${ms}ms`;
    this.el.style.background = '#000';
    this.el.style.opacity = '1';
    return new Promise((r) => setTimeout(r, ms));
  }

  fadeIn(ms = 500) {
    this.el.style.transitionDuration = `${ms}ms`;
    this.el.style.opacity = '0';
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Instant opaque black, no transition — for hard cuts. */
  blackout() {
    this.el.style.transitionDuration = '0ms';
    this.el.style.background = '#000';
    this.el.style.opacity = '1';
  }

  async flash(color = '#97ce4c', ms = 220) {
    this.el.style.transitionDuration = '0ms';
    this.el.style.background = color;
    this.el.style.opacity = '0.85';
    await new Promise((r) => setTimeout(r, 40));
    this.el.style.transitionDuration = `${ms}ms`;
    this.el.style.opacity = '0';
    await new Promise((r) => setTimeout(r, ms));
    this.el.style.background = '#000';
  }

  /** Short purple/red interference burst — the house style for "wrongness". */
  glitch() {
    this.el.classList.remove('glitch');
    // reflow so the animation restarts even if it is already playing
    void this.el.offsetWidth;
    this.el.classList.add('glitch');
    setTimeout(() => this.el.classList.remove('glitch'), 1200);
  }
}

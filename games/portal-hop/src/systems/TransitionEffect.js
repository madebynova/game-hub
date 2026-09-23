const FADE_OUT_MS = 220;
const HOLD_MS = 160;
const FADE_IN_MS = 320;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives the full-screen "#transition-overlay" div to produce a quick
 * green flash/fade for stepping through the portal. Deliberately simple:
 * fade to green, run a callback while the screen is covered (to move the
 * player/swap the zone without it being visible), then fade back in.
 */
export class TransitionEffect {
  constructor(overlayElement) {
    this.el = overlayElement;
    this.el.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
  }

  /**
   * @param {() => void} onCovered called at the moment the screen is
   *   fully covered — do the actual teleport/zone-swap here.
   */
  async play(onCovered) {
    this.el.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
    this.el.style.opacity = "1";
    await wait(FADE_OUT_MS);

    onCovered?.();
    await wait(HOLD_MS);

    this.el.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
    this.el.style.opacity = "0";
    await wait(FADE_IN_MS);
  }
}

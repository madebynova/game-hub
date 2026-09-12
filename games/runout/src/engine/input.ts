import { audio } from './audio';

/**
 * Keyboard + pointer state.
 *
 * `isDown` is level-triggered (held this frame); `wasPressed` is edge-triggered
 * and clears on `endFrame()`, so a jump fires once per keypress.
 */

export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();

  pointerDown = false;
  pointerPressed = false;
  pointerX = 0;
  pointerY = 0;

  private detach: Array<() => void> = [];

  attach(target: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent) => {
      // Keep browser shortcuts (reload, devtools, tab switching) working.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      audio.unlock();
      this.down.add(e.code);
      this.pressed.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    };
    // A lost focus with keys held would otherwise leave them stuck down.
    const onBlur = () => this.clear();

    const onPointerDown = (e: PointerEvent) => {
      audio.unlock();
      target.setPointerCapture(e.pointerId);
      this.pointerDown = true;
      this.pointerPressed = true;
      this.trackPointer(target, e);
    };
    const onPointerMove = (e: PointerEvent) => this.trackPointer(target, e);
    const onPointerUp = (e: PointerEvent) => {
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      this.pointerDown = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);

    this.detach = [
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('blur', onBlur),
      () => target.removeEventListener('pointerdown', onPointerDown),
      () => target.removeEventListener('pointermove', onPointerMove),
      () => target.removeEventListener('pointerup', onPointerUp),
      () => target.removeEventListener('pointercancel', onPointerUp),
    ];
  }

  dispose(): void {
    for (const off of this.detach) off();
    this.detach = [];
    this.clear();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  wasReleased(...codes: string[]): boolean {
    return codes.some((code) => this.released.has(code));
  }

  /** Call once at the end of every frame to drop edge-triggered state. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.pointerPressed = false;
  }

  clear(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.pointerDown = false;
    this.pointerPressed = false;
  }

  private trackPointer(target: HTMLElement, e: PointerEvent): void {
    const rect = target.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
  }
}

/** Keys the game owns; the page must not scroll when they are pressed. */
const GAME_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyE',
  'KeyQ',
  'KeyR',
  'KeyM',
  'ShiftLeft',
  'ShiftRight',
]);

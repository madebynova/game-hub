/**
 * Keyboard-only input for a side-view platformer. Deliberately has no
 * notion of mouse position at all — the mouse is reserved for
 * menus/buttons/UI later, never player movement.
 *
 * A / D — walk, W / Space — jump. S is reserved for a future
 * crouch/drop-down and intentionally does nothing yet.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  _onKeyDown(event) {
    if (!this.keys.has(event.code)) this.justPressed.add(event.code);
    this.keys.add(event.code);
  }

  _onKeyUp(event) {
    this.keys.delete(event.code);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** True only on the frame the key transitioned from up to down. */
  wasPressed(code) {
    return this.justPressed.has(code);
  }

  /** -1 (left), 0, or 1 (right) from A/D or the arrow keys. */
  getHorizontal() {
    const left = this.isDown("KeyA") || this.isDown("ArrowLeft");
    const right = this.isDown("KeyD") || this.isDown("ArrowRight");
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  isJumpDown() {
    return this.isDown("KeyW") || this.isDown("Space") || this.isDown("ArrowUp");
  }

  wasJumpPressed() {
    return this.wasPressed("KeyW") || this.wasPressed("Space") || this.wasPressed("ArrowUp");
  }

  /** Call once per frame after game logic has read this frame's input. */
  endFrame() {
    this.justPressed.clear();
  }

  dispose() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
  }
}

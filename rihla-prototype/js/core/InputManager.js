// Centralises keyboard + mouse-drag input so gameplay code never touches
// window/document listeners directly. Movement keys expose a normalised
// axis vector; camera orbit exposes a yaw delta consumed once per frame.
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    // Separate from `keys` (continuous "is held" state) so a key that is
    // pressed and released between two animation frames — as happens with
    // synthetic/automated input, and can happen with a quick real tap —
    // still registers as one completed press instead of racing the loop.
    this._justPressed = new Set();
    this.orbitDeltaX = 0;
    this.orbitDeltaY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      this._justPressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    domElement.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { this._dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      this.orbitDeltaX += e.clientX - this._lastX;
      this.orbitDeltaY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
  }

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Returns { x, z } in [-1, 1], x = strafe (A/D), z = forward (W/S).
  moveAxis() {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW', 'ArrowUp')) z -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) z += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    return { x, z };
  }

  // Consumes accumulated pointer-drag delta (call once per frame).
  consumeOrbitDelta() {
    const d = { x: this.orbitDeltaX, y: this.orbitDeltaY };
    this.orbitDeltaX = 0;
    this.orbitDeltaY = 0;
    return d;
  }

  consumeKeyPress(code) {
    if (this._justPressed.has(code)) {
      this._justPressed.delete(code);
      return true;
    }
    return false;
  }
}

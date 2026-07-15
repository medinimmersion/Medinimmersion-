import * as THREE from 'three';
import { Character } from './Character.js';

// Non-player character: stationary or scripted-path, driven by narrative
// sequences rather than input. Adds "seated" posture (Abou Adam behind his
// desk, doc 006) and a smooth face-toward-point helper used when greeting
// the player.
export class NPC extends Character {
  constructor(options) {
    super(options);
    this._seated = false;
    this._standProgress = 1; // 1 = standing, 0 = seated
    this._faceTarget = null;
  }

  sitDown() {
    this._seated = true;
    this._standProgress = 0;
    this.root.position.y = -this.height * 0.16;
  }

  standUp() {
    this._seated = false;
  }

  faceToward(point) {
    this._faceTarget = point.clone();
  }

  update(dt, { moving = false } = {}) {
    if (!this._seated) {
      this._standProgress = Math.min(1, this._standProgress + dt * 1.5);
      this.root.position.y = THREE.MathUtils.lerp(-this.height * 0.16, 0, this._standProgress);
    }

    if (this._faceTarget) {
      const dx = this._faceTarget.x - this.root.position.x;
      const dz = this._faceTarget.z - this.root.position.z;
      const targetYaw = Math.atan2(dx, dz);
      let yawDiff = targetYaw - this.root.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      this.root.rotation.y += yawDiff * Math.min(1, dt * 4);
    }

    super.update(dt, { moving });
  }
}

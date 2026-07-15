import * as THREE from 'three';
import { damp, degToRad, clamp } from './utils.js';

// Implements the camera language from Document 002 (Direction Artistique):
// third-person view, ~2.8m behind the character, slight downward tilt (~18deg),
// slow easing — never a hard cut except on scripted scene transitions.
export class ThirdPersonCamera {
  constructor(camera, input, { distance = 2.8, tiltDeg = 18, height = 1.55 } = {}) {
    this.camera = camera;
    this.input = input;
    this.distance = distance;
    this.tilt = degToRad(tiltDeg);
    this.height = height;
    this.yaw = Math.PI; // start facing the same way as the character
    this.target = null;
    this._desired = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
  }

  followTarget(object3D) {
    this.target = object3D;
  }

  update(dt) {
    if (!this.target) return;

    const orbit = this.input.consumeOrbitDelta();
    this.yaw -= orbit.x * 0.005;

    const dist = this.distance;
    const camHeight = this.height + Math.sin(this.tilt) * dist;
    const camBack = Math.cos(this.tilt) * dist;

    this._desired.set(
      this.target.position.x + Math.sin(this.yaw) * camBack,
      this.target.position.y + camHeight,
      this.target.position.z + Math.cos(this.yaw) * camBack,
    );

    const smoothing = 6;
    this.camera.position.x = damp(this.camera.position.x, this._desired.x, smoothing, dt);
    this.camera.position.y = damp(this.camera.position.y, this._desired.y, smoothing, dt);
    this.camera.position.z = damp(this.camera.position.z, this._desired.z, smoothing, dt);

    this._lookAt.set(this.target.position.x, this.target.position.y + 1.3, this.target.position.z);
    this.camera.lookAt(this._lookAt);
  }

  // Forward vector on the horizontal plane matching current camera yaw,
  // used so WASD movement is always relative to what the player sees.
  // (The camera sits behind the character along +D from target; forward
  // for movement purposes is the opposite direction, -D.)
  getPlanarForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  getPlanarRight() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  snapBehind(object3D, facingYaw) {
    this.yaw = facingYaw + Math.PI;
    this.target = object3D;
  }

  clampYaw(min, max) {
    this.yaw = clamp(this.yaw, min, max);
  }
}

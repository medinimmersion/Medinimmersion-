import * as THREE from 'three';
import { Character } from './Character.js';

// The player-controlled Character. Movement is analytic (no physics engine):
// a scene supplies simple circular/box obstacles and Player resolves
// collisions against those, which is enough fidelity for an art/UX
// prototype without pulling in a physics dependency.
export class Player extends Character {
  constructor(options) {
    super(options);
    this.speed = 2.6;
    this.colliders = [];
    this.bounds = null; // { minX, maxX, minZ, maxZ }
  }

  setColliders(colliders) {
    this.colliders = colliders;
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  update(dt, { input, camera }) {
    const axis = input.moveAxis();
    let moving = false;

    if (axis.x !== 0 || axis.z !== 0) {
      const forward = camera.getPlanarForward();
      const right = camera.getPlanarRight();
      const move = new THREE.Vector3()
        .addScaledVector(forward, -axis.z)
        .addScaledVector(right, axis.x);

      if (move.lengthSq() > 0) {
        move.normalize();
        const targetYaw = Math.atan2(move.x, move.z);
        let yawDiff = targetYaw - this.root.rotation.y;
        yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
        this.root.rotation.y += yawDiff * Math.min(1, dt * 10);

        const nextX = this.root.position.x + move.x * this.speed * dt;
        const nextZ = this.root.position.z + move.z * this.speed * dt;
        if (!this._collides(nextX, nextZ)) {
          this.root.position.x = nextX;
          this.root.position.z = nextZ;
        }
        moving = true;
      }
    }

    if (this.bounds) {
      this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, this.bounds.minX, this.bounds.maxX);
      this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, this.bounds.minZ, this.bounds.maxZ);
    }

    super.update(dt, { moving });
  }

  _collides(x, z) {
    const r = 0.3;
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < (c.radius + r) * (c.radius + r)) return true;
      } else if (c.type === 'box') {
        if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
      }
    }
    return false;
  }
}

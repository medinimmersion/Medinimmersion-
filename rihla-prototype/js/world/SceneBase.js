import * as THREE from 'three';

// Every playable place (academy exterior, hall, Cairo square, ...) extends
// this. A scene owns its own geometry, NPCs and portals and is otherwise
// self-contained — it never reaches into another scene, and never imports
// UI classes; it talks to the rest of the app only through the services
// handed to it in `context` (bus, systems, player) and through portals.
export class SceneBase {
  constructor(context) {
    this.ctx = context; // { bus, quests, passport, inventory, dialogue, ai, player }
    // A real THREE.Scene (not a bare Group) so background/fog are honoured
    // by the renderer — see builders/environment.js createSky().
    this.object3D = new THREE.Scene();
    // Generic "things the player can press E near": doors/portals to other
    // scenes, NPCs to talk to, objects to examine. A portal is simply an
    // interactable whose onInteract() calls ctx.sceneManager.transitionTo(...).
    this.interactables = []; // { id, position: Vector3, radius, label, onInteract(ctx) }
    // Things that fire the moment the player walks near, no key press —
    // doors opening, a cinematic kicking off. "once: true" (default) fires
    // a single time per scene visit, per Document 034: no floating menus,
    // interactions happen with real objects in the world.
    this.autoTriggers = []; // { id, position: Vector3, radius, once?, onEnter(ctx) }
    this._firedAutoTriggers = new Set();
    this.spawnPoints = {}; // id -> { position: Vector3, yaw }
  }

  // Override: construct meshes/lights/NPCs, populate this.interactables and
  // this.spawnPoints. May be async (character/asset factories are async).
  async build() {}

  // Override: per-frame scene-specific logic (NPC idle animation, ambient
  // motion...). Player movement itself is handled by SceneManager.
  update(dt) {}

  // Override: dispose of anything that isn't garbage-collected automatically
  // (rare with plain Three.js meshes, kept for future audio/timers).
  dispose() {}

  getSpawn(spawnId) {
    return this.spawnPoints[spawnId] ?? Object.values(this.spawnPoints)[0] ?? { position: new THREE.Vector3(), yaw: 0 };
  }

  checkAutoTriggers(playerPosition, context) {
    for (const trig of this.autoTriggers) {
      if (trig.once !== false && this._firedAutoTriggers.has(trig.id)) continue;
      if (playerPosition.distanceTo(trig.position) <= trig.radius) {
        this._firedAutoTriggers.add(trig.id);
        trig.onEnter?.(context);
      }
    }
  }
}

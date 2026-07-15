import { Events } from '../systems/events.js';
import { sceneRegistry } from './SceneRegistry.js';

const INTERACT_KEY = 'KeyE';

// Owns "which scene is currently active" and the player's presence within
// it. Scenes themselves stay ignorant of each other; SceneManager is the
// only thing that removes the player from one scene's graph and places it
// into the next one's, fading through black so it never reads as a hard
// teleport (Document 034: "Le joueur ne se téléporte jamais").
export class SceneManager {
  constructor({ engine, camera, player, fadeOverlay, bus, buildContext }) {
    this.engine = engine;
    this.camera = camera;
    this.player = player;
    this.fadeOverlay = fadeOverlay;
    this.bus = bus;
    this.buildContext = buildContext; // () => context object passed to every scene
    this.current = null;
    this.currentSceneId = null;
    this._nearestInteractable = null;
    this._transitioning = false;
  }

  async goTo(sceneId, spawnId, { instant = false } = {}) {
    if (this._transitioning) return;
    this._transitioning = true;
    try {
      if (!instant) await this.fadeOverlay.toBlack();

      if (this.current) {
        this.current.object3D.remove(this.player.object3D);
        this.current.dispose();
      }

      const scene = sceneRegistry.create(sceneId, this._fullContext());
      await scene.build();

      const spawn = scene.getSpawn(spawnId);
      this.player.setPosition(spawn.position.x, spawn.position.y, spawn.position.z);
      this.player.faceYaw(spawn.yaw ?? 0);
      scene.object3D.add(this.player.object3D);

      this.current = scene;
      this.currentSceneId = sceneId;
      this.engine.setActiveScene(scene);
      this.camera.snapBehind(this.player.object3D, spawn.yaw ?? 0);

      this.bus.emit(Events.SCENE_READY, { sceneId, spawnId });

      if (!instant) await this.fadeOverlay.toClear();
    } finally {
      this._transitioning = false;
    }
  }

  hasScene(sceneId) {
    return sceneRegistry.has(sceneId);
  }

  update(dt, input) {
    if (!this.current || this._transitioning) return;
    this.current.update(dt);

    const playerPos = this.player.object3D.position;
    let nearest = null;
    let nearestDist = Infinity;
    for (const it of this.current.interactables) {
      const d = playerPos.distanceTo(it.position);
      if (d <= it.radius && d < nearestDist) {
        nearest = it;
        nearestDist = d;
      }
    }
    if (nearest !== this._nearestInteractable) {
      this._nearestInteractable = nearest;
      this.bus.emit(Events.HUD_SET_PROMPT, { text: nearest ? `Appuyez sur E — ${nearest.label}` : '' });
    }

    if (this._nearestInteractable && input.consumeKeyPress(INTERACT_KEY)) {
      this._nearestInteractable.onInteract?.(this._fullContext());
    }

    this.current.checkAutoTriggers(playerPos, this._fullContext());
  }

  // Context handed to scenes/interactables always includes a reference to
  // this manager (so a door can call ctx.sceneManager.goTo(...)), on top of
  // whatever independent systems `buildContext` (from main.js) exposes.
  _fullContext() {
    return { ...this.buildContext(), sceneManager: this };
  }
}

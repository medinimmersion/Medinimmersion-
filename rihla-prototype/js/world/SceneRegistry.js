// Scenes register themselves here by id instead of SceneManager importing
// every scene class directly. Adding "Le Caire, place centrale" or, later,
// a whole new country, is one registerScene() call away — SceneManager's
// own code never grows a switch/case per scene.
export class SceneRegistry {
  constructor() {
    this._factories = new Map();
  }

  register(sceneId, factory) {
    this._factories.set(sceneId, factory);
  }

  has(sceneId) {
    return this._factories.has(sceneId);
  }

  create(sceneId, context) {
    const factory = this._factories.get(sceneId);
    if (!factory) throw new Error(`SceneRegistry: no scene registered for "${sceneId}"`);
    return factory(context);
  }
}

export const sceneRegistry = new SceneRegistry();

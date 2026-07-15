// Seam between "what the prototype uses today" (procedural placeholder
// geometry) and "what production will use later" (rigged GLTF models).
//
// Every entry is registered as an async factory, even though today's
// factories are synchronous under the hood. When real assets are ready,
// swap a factory's implementation for one that does
// `await gltfLoader.loadAsync(url)` — no caller anywhere in the codebase
// needs to change, because they already `await registry.create(...)`.
export class AssetRegistry {
  constructor() {
    this._factories = new Map();
  }

  register(key, factory) {
    this._factories.set(key, factory);
  }

  async create(key, options) {
    const factory = this._factories.get(key);
    if (!factory) {
      throw new Error(`AssetRegistry: no factory registered for "${key}"`);
    }
    return factory(options);
  }

  has(key) {
    return this._factories.has(key);
  }
}

export const assetRegistry = new AssetRegistry();

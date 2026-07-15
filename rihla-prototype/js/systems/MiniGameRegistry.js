// Mini-games are self-contained modules (see js/minigames/*.js) that only
// know how to start(), stop(), and report a win via the EventBus
// (Events.MINIGAME_WON). This registry is how a scene asks for "the
// panier d'Alif game" or any future mini-game by id without importing its
// class directly, so new mini-games can be dropped in independently.
export class MiniGameRegistry {
  constructor() {
    this._factories = new Map();
  }

  register(id, factory) {
    this._factories.set(id, factory);
  }

  create(id, context) {
    const factory = this._factories.get(id);
    if (!factory) throw new Error(`MiniGameRegistry: no mini-game registered for "${id}"`);
    return factory(context);
  }
}

export const miniGameRegistry = new MiniGameRegistry();

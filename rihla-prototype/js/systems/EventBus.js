// The only thing every independent system is allowed to depend on.
// Scenes, dialogue, quests, passport, inventory, mini-games and the AI
// conversation layer never call each other directly — they emit and
// listen for events here. This is what lets any one of them be rewritten
// or replaced without touching the others.
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    // Copy to array: a handler may subscribe/unsubscribe during emit.
    for (const handler of Array.from(handlers)) handler(payload);
  }
}

// A single shared bus for the whole app. Systems still receive it via
// constructor injection (see main.js) rather than importing this directly,
// so they stay unit-testable with an isolated bus if needed.
export const globalEventBus = new EventBus();

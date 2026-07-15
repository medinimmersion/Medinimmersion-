import { Events } from '../systems/events.js';

// Renders whatever objective/prompt text is currently emitted on the bus.
// Deliberately dumb: it doesn't know what a "quest" or a "portal" is.
export class HUD {
  constructor(bus, { objectiveEl, promptEl }) {
    this.objectiveEl = objectiveEl;
    this.promptEl = promptEl;
    bus.on(Events.HUD_SET_OBJECTIVE, ({ text }) => { this.objectiveEl.textContent = text ?? ''; });
    bus.on(Events.HUD_SET_PROMPT, ({ text }) => { this.promptEl.textContent = text ?? ''; });
  }
}

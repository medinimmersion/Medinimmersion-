import { Events } from './events.js';

// Drives the "current objective" line in the HUD. Data-driven so the 11
// levels/countries can each ship their own quest list later without
// changing this class — only data passed to startQuest() grows.
export class QuestSystem {
  constructor(bus) {
    this.bus = bus;
    this.active = null;
  }

  // quest: { id, title, objectives: [{ id, label }] }
  startQuest(quest) {
    this.active = {
      ...quest,
      completed: new Set(),
      objectiveIndex: 0,
    };
    this.bus.emit(Events.QUEST_STARTED, { id: quest.id, title: quest.title });
    this._announceCurrentObjective();
  }

  completeObjective(objectiveId) {
    if (!this.active) return;
    const idx = this.active.objectives.findIndex((o) => o.id === objectiveId);
    if (idx === -1 || this.active.completed.has(objectiveId)) return;
    this.active.completed.add(objectiveId);
    this.bus.emit(Events.QUEST_OBJECTIVE_COMPLETED, { questId: this.active.id, objectiveId });

    if (this.active.completed.size >= this.active.objectives.length) {
      this.bus.emit(Events.QUEST_COMPLETED, { questId: this.active.id });
      this.bus.emit(Events.HUD_SET_OBJECTIVE, { text: '' });
      this.active = null;
      return;
    }
    this.active.objectiveIndex = this.active.objectives.findIndex(
      (o) => !this.active.completed.has(o.id),
    );
    this._announceCurrentObjective();
  }

  _announceCurrentObjective() {
    const obj = this.active?.objectives[this.active.objectiveIndex];
    this.bus.emit(Events.HUD_SET_OBJECTIVE, { text: obj ? obj.label : '' });
  }
}

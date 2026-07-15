import { Events } from './events.js';

// Separate from the passport on purpose: the passport is the *record* of a
// journey (stamps, certificates, countries), the inventory is the set of
// physical objects the student is carrying/has unlocked (Document 010 –
// carnet, crayon, livres...). Keeping them apart means either can grow
// (e.g. real item icons, drag-and-drop, a shop) without the other caring.
export class InventorySystem {
  constructor(bus) {
    this.bus = bus;
    this.items = [];
  }

  addItem({ id, label, icon = '' }) {
    if (this.hasItem(id)) return;
    const item = { id, label, icon };
    this.items.push(item);
    this.bus.emit(Events.INVENTORY_ITEM_ADDED, item);
    this.bus.emit(Events.INVENTORY_UPDATED, this.items);
  }

  hasItem(id) {
    return this.items.some((i) => i.id === id);
  }
}

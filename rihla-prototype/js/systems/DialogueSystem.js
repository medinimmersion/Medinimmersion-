import { Events } from './events.js';

// Owns "what line of dialogue is currently showing" and nothing else.
// It has no idea a DOM exists — DialogueBoxUI renders whatever this system
// emits, and forwards user input back via advance()/submitInput(). Any
// other system (quests, passport, AI) reacts to DIALOGUE_SEQUENCE_ENDED
// over the bus instead of being told about directly.
export class DialogueSystem {
  constructor(bus) {
    this.bus = bus;
    this._queue = [];
    this._index = -1;
    this._onComplete = null;
  }

  get currentLine() {
    return this._queue[this._index] ?? null;
  }

  get isActive() {
    return this._index >= 0 && this._index < this._queue.length;
  }

  // lines: [{ speaker, text, arabic?, requiresInput?, inputPlaceholder?, onInput?(value) }]
  play(lines, { onComplete } = {}) {
    this._queue = lines;
    this._index = -1;
    this._onComplete = onComplete ?? null;
    this._advance();
  }

  advance() {
    if (!this.isActive) return;
    const line = this.currentLine;
    if (line?.requiresInput) return; // must submit input first, not click through
    this._advance();
  }

  // Inserts a line right after the one currently showing — how a reply
  // from the AI teacher (Document 019) gets woven into an otherwise
  // static, scripted sequence.
  insertNext(line) {
    this._queue.splice(this._index + 1, 0, line);
  }

  async submitInput(value) {
    const line = this.currentLine;
    if (!line?.requiresInput) return;
    await line.onInput?.(value);
    this.bus.emit(Events.DIALOGUE_INPUT_SUBMITTED, { line, value });
    this._advance();
  }

  _advance() {
    this._index += 1;
    if (this._index >= this._queue.length) {
      this._index = -1;
      const queueWasActive = this._queue.length > 0;
      this._queue = [];
      if (queueWasActive) {
        this.bus.emit(Events.DIALOGUE_SEQUENCE_ENDED, {});
        this._onComplete?.();
      }
      return;
    }
    this.bus.emit(Events.DIALOGUE_LINE_SHOWN, this.currentLine);
  }
}

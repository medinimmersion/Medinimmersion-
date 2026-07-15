import { Events } from '../systems/events.js';

// Presentation layer for DialogueSystem. Owns the DOM; the system owns the
// data. Swapping this for a different visual treatment (or adding real
// voice-over playback) never touches DialogueSystem.
export class DialogueBoxUI {
  constructor(bus, dialogueSystem, els) {
    this.bus = bus;
    this.dialogue = dialogueSystem;
    this.els = els;

    bus.on(Events.DIALOGUE_LINE_SHOWN, (line) => this._render(line));
    bus.on(Events.DIALOGUE_SEQUENCE_ENDED, () => this._hide());

    this.els.box.addEventListener('click', (e) => {
      if (e.target === this.els.input || e.target === this.els.submit) return;
      this.dialogue.advance();
    });
    this.els.submit.addEventListener('click', (e) => {
      e.stopPropagation();
      this._submit();
    });
    this.els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
    });
  }

  _submit() {
    const value = this.els.input.value.trim();
    if (!value) return;
    this.dialogue.submitInput(value);
    this.els.input.value = '';
  }

  _render(line) {
    this.els.box.classList.remove('hidden');
    this.els.speaker.textContent = line.speaker ?? '';
    this.els.arabic.textContent = line.arabic ?? '';
    this.els.text.textContent = line.text ?? '';
    const needsInput = Boolean(line.requiresInput);
    this.els.inputWrap.classList.toggle('hidden', !needsInput);
    this.els.continueHint.classList.toggle('hidden', needsInput);
    if (needsInput) {
      this.els.input.placeholder = line.inputPlaceholder ?? '';
      this.els.input.focus();
    }
  }

  _hide() {
    this.els.box.classList.add('hidden');
  }
}

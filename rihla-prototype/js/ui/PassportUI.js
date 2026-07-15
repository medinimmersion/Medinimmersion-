import { Events } from '../systems/events.js';

// Renders PassportSystem's state (Document 009). Never mutates the system,
// only reads whatever it broadcasts on PASSPORT_UPDATED.
export class PassportUI {
  constructor(bus, els) {
    this.bus = bus;
    this.els = els;
    this._latest = null;

    bus.on(Events.PASSPORT_UPDATED, (data) => {
      this._latest = data;
      this._render(data);
    });
    bus.on(Events.PASSPORT_TOGGLE_UI, () => this.toggle());

    this.els.closeBtn.addEventListener('click', () => this.close());
    this.els.root.addEventListener('click', (e) => {
      if (e.target === this.els.root) this.close();
    });
  }

  toggle() {
    this.els.root.classList.contains('hidden') ? this.open() : this.close();
  }

  open() {
    this.els.root.classList.remove('hidden');
  }

  close() {
    this.els.root.classList.add('hidden');
  }

  _render(data) {
    this.els.name.textContent = data.student.name || 'Nouvel élève';
    this.els.level.textContent = `Niveau : ${data.student.level}`;

    this.els.countries.innerHTML = '';
    for (const c of data.countries) {
      const li = document.createElement('li');
      li.textContent = c.unlocked ? c.name : `${c.name} 🔒`;
      li.className = c.unlocked ? 'unlocked' : 'locked';
      this.els.countries.appendChild(li);
    }

    this.els.stamps.innerHTML = '';
    if (data.stamps.length === 0) {
      const span = document.createElement('span');
      span.className = 'passport-empty';
      span.textContent = 'Aucun tampon pour le moment.';
      this.els.stamps.appendChild(span);
    } else {
      for (const s of data.stamps) {
        const div = document.createElement('div');
        div.className = 'passport-stamp earned';
        div.title = s.label;
        div.textContent = '✦';
        this.els.stamps.appendChild(div);
      }
    }

    this.els.certificates.innerHTML = '';
    if (data.certificates.length === 0) {
      const span = document.createElement('span');
      span.className = 'passport-empty';
      span.textContent = 'Aucun certificat pour le moment.';
      this.els.certificates.appendChild(span);
    } else {
      for (const c of data.certificates) {
        const div = document.createElement('div');
        div.textContent = c.label;
        this.els.certificates.appendChild(div);
      }
    }
  }
}

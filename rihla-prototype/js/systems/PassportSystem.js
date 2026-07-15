import { Events } from './events.js';

// Data model behind "Document 009 – Passeport MédinImmersion" and
// "Document 021 – Système de récompenses". Pure state + events: it does
// not know PassportUI exists. Seeded from worldData so every one of the
// 11 levels/countries already has a slot, even though only Egypt has
// content today.
export class PassportSystem {
  constructor(bus, worldData) {
    this.bus = bus;
    this.student = { name: '', level: worldData.levels[0].name };
    this.countries = worldData.countries.map((c) => ({
      id: c.id,
      name: c.name,
      unlocked: Boolean(c.unlockedByDefault),
    }));
    this.stamps = [];
    this.certificates = [];
  }

  setStudentProfile(partial) {
    Object.assign(this.student, partial);
    this._emitUpdated();
  }

  unlockCountry(countryId) {
    const country = this.countries.find((c) => c.id === countryId);
    if (!country || country.unlocked) return;
    country.unlocked = true;
    this.bus.emit(Events.PASSPORT_COUNTRY_UNLOCKED, { countryId });
    this._emitUpdated();
  }

  awardStamp({ id, countryId, label }) {
    if (this.stamps.some((s) => s.id === id)) return;
    this.stamps.push({ id, countryId, label });
    this.bus.emit(Events.PASSPORT_STAMP_AWARDED, { id, countryId, label });
    this._emitUpdated();
  }

  addCertificate(certificate) {
    this.certificates.push(certificate);
    this._emitUpdated();
  }

  toJSON() {
    return {
      student: this.student,
      countries: this.countries,
      stamps: this.stamps,
      certificates: this.certificates,
    };
  }

  loadFrom(data) {
    if (!data) return;
    this.student = data.student ?? this.student;
    this.countries = data.countries ?? this.countries;
    this.stamps = data.stamps ?? this.stamps;
    this.certificates = data.certificates ?? this.certificates;
    this._emitUpdated();
  }

  _emitUpdated() {
    this.bus.emit(Events.PASSPORT_UPDATED, this.toJSON());
  }
}

import { Events } from '../systems/events.js';

// Document 014 (mini-jeux) — « Le panier d'Alif » : parmi des mots arabes,
// l'étudiant met dans le panier uniquement ceux qui contiennent la lettre
// Alif. Tout est DOM (overlay au-dessus du canvas 3D) : le mini-jeu ne
// touche jamais à la scène — il ne connaît que le bus d'événements.
const WORDS = [
  { ar: 'أَسَد', fr: 'lion', hasAlif: true },
  { ar: 'قَمَر', fr: 'lune', hasAlif: false },
  { ar: 'أَرْنَب', fr: 'lapin', hasAlif: true },
  { ar: 'شَمْس', fr: 'soleil', hasAlif: false },
  { ar: 'كِتَاب', fr: 'livre', hasAlif: true },
  { ar: 'بَحْر', fr: 'mer', hasAlif: false },
  { ar: 'بَاب', fr: 'porte', hasAlif: true },
  { ar: 'نَجْم', fr: 'étoile', hasAlif: false },
];

export class PanierAlifGame {
  constructor(ctx) {
    this.bus = ctx.bus;
    this.root = null;
    this._toWin = 0;
  }

  start() {
    this.bus.emit(Events.MINIGAME_STARTED, { gameId: 'panier-alif' });
    this._toWin = WORDS.filter((w) => w.hasAlif).length;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 60; display: flex;
      align-items: center; justify-content: center;
      background: rgba(20, 12, 6, 0.55); backdrop-filter: blur(2px);
      font-family: Georgia, 'Times New Roman', serif;`;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(680px, 92vw); border-radius: 14px; padding: 26px 30px;
      background: linear-gradient(160deg, #f3ead6, #e6d5b3);
      border: 2px solid #b08d3f; box-shadow: 0 18px 60px rgba(0,0,0,0.5);
      color: #3a2416; text-align: center;`;
    overlay.appendChild(panel);

    panel.innerHTML = `
      <div style="font-size: 1.5rem; letter-spacing: 0.04em; margin-bottom: 4px;">Le panier d'Alif</div>
      <div style="font-size: 0.95rem; opacity: 0.75; margin-bottom: 18px;">
        Clique uniquement sur les mots qui contiennent la lettre <span style="font-size:1.3rem; font-weight:bold;">ا</span> (Alif)
      </div>
      <div id="panier-words" style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center; margin-bottom:20px;"></div>
      <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 6px;">Le panier</div>
      <div id="panier-basket" style="
        min-height: 64px; border-radius: 50% / 38%; padding: 10px 16px;
        background: radial-gradient(ellipse at center, #b0885c 0%, #8a5f36 100%);
        border: 3px solid #5b3a26; display:flex; flex-wrap:wrap; gap:8px;
        align-items:center; justify-content:center; color:#f3ead6;"></div>
      <div id="panier-feedback" style="height: 1.4em; margin-top: 12px; font-style: italic;"></div>`;

    const wordsEl = panel.querySelector('#panier-words');
    const basketEl = panel.querySelector('#panier-basket');
    const feedbackEl = panel.querySelector('#panier-feedback');

    const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
    for (const word of shuffled) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.style.cssText = `
        font-family: inherit; font-size: 1.25rem; padding: 8px 18px;
        border-radius: 10px; border: 2px solid #5b3a26; cursor: pointer;
        background: #fdf6e3; color: #2c1f14; transition: transform 0.15s, opacity 0.3s;`;
      chip.innerHTML = `<div style="font-size:1.45rem;">${word.ar}</div><div style="font-size:0.7rem; opacity:0.6;">${word.fr}</div>`;
      chip.addEventListener('click', () => {
        if (word.hasAlif) {
          chip.disabled = true;
          chip.style.opacity = '0';
          setTimeout(() => {
            chip.remove();
            const inBasket = document.createElement('span');
            inBasket.textContent = word.ar;
            inBasket.style.cssText = 'font-size:1.2rem; padding: 2px 10px; background: rgba(0,0,0,0.25); border-radius: 8px;';
            basketEl.appendChild(inBasket);
          }, 250);
          this._toWin -= 1;
          feedbackEl.textContent = 'Bien joué ! Ce mot contient bien un Alif.';
          feedbackEl.style.color = '#0f6b4c';
          if (this._toWin <= 0) setTimeout(() => this._win(overlay, panel), 700);
        } else {
          chip.style.transform = 'translateX(-4px)';
          setTimeout(() => { chip.style.transform = 'translateX(4px)'; }, 80);
          setTimeout(() => { chip.style.transform = ''; }, 160);
          feedbackEl.textContent = `Non — « ${word.ar} » (${word.fr}) ne contient pas d'Alif. Regarde bien !`;
          feedbackEl.style.color = '#8a2f2f';
        }
      });
      wordsEl.appendChild(chip);
    }

    document.body.appendChild(overlay);
    this.root = overlay;
  }

  _win(overlay, panel) {
    panel.innerHTML = `
      <div style="font-size: 2.4rem; margin-bottom: 8px;">ممتاز</div>
      <div style="font-size: 1.3rem; margin-bottom: 6px;">Moumtaz — Excellent !</div>
      <div style="opacity: 0.75; margin-bottom: 18px;">Tu as trouvé tous les mots contenant la lettre Alif.</div>
      <button id="panier-close" type="button" style="
        font-family: inherit; font-size: 1.05rem; padding: 10px 26px;
        border-radius: 10px; border: 2px solid #5b3a26; cursor: pointer;
        background: linear-gradient(160deg, #d9b45a, #b08d3f); color: #2c1f14;">Récupérer mon tampon</button>`;
    panel.querySelector('#panier-close').addEventListener('click', () => {
      this.stop();
      this.bus.emit(Events.MINIGAME_WON, { gameId: 'panier-alif' });
    });
  }

  stop() {
    this.root?.remove();
    this.root = null;
  }
}

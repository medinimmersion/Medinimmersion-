// Thin controller around the #fade-overlay div. Kept in ui/ (not core/)
// because it is the one piece of "engine" behaviour that is unavoidably a
// DOM concern; SceneManager awaits its promises without knowing it's CSS.
export class FadeOverlay {
  constructor(element, durationMs = 600) {
    this.element = element;
    this.durationMs = durationMs;
  }

  toBlack() {
    this.element.classList.add('visible');
    return new Promise((resolve) => setTimeout(resolve, this.durationMs));
  }

  toClear() {
    this.element.classList.remove('visible');
    return new Promise((resolve) => setTimeout(resolve, this.durationMs));
  }
}

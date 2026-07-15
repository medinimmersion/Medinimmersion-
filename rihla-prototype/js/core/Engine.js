import * as THREE from 'three';

// Thin wrapper around the renderer + render loop. Scenes and systems register
// per-frame callbacks instead of the app owning a monolithic update() method.
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);

    this.clock = new THREE.Clock();
    this._updateCallbacks = [];
    this._activeScene = null;

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
  }

  setActiveScene(scene) {
    this._activeScene = scene;
  }

  onUpdate(fn) {
    this._updateCallbacks.push(fn);
    return () => {
      this._updateCallbacks = this._updateCallbacks.filter((f) => f !== fn);
    };
  }

  start() {
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    for (const fn of this._updateCallbacks) fn(dt);
    if (this._activeScene) {
      this.renderer.render(this._activeScene.object3D, this.camera);
    }
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

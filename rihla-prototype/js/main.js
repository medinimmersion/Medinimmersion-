import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { ThirdPersonCamera } from './core/ThirdPersonCamera.js';
import { globalEventBus } from './systems/EventBus.js';
import { Events } from './systems/events.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { PassportSystem } from './systems/PassportSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { MockConversationAI } from './systems/ConversationAI.js';
import { worldData } from './data/worldData.js';
import { createPlayer } from './entities/characterFactory.js';
import { SceneManager } from './world/SceneManager.js';
import { FadeOverlay } from './ui/FadeOverlay.js';
import { HUD } from './ui/HUD.js';
import { DialogueBoxUI } from './ui/DialogueBoxUI.js';
import { PassportUI } from './ui/PassportUI.js';
import './world/scenes/index.js'; // side-effect: registers every scene by id
import './minigames/index.js'; // side-effect: registers every mini-game by id

async function main() {
  const canvas = document.getElementById('viewport');
  const engine = new Engine(canvas);
  const input = new InputManager(canvas);
  const camera = new ThirdPersonCamera(engine.camera, input);

  const bus = globalEventBus;
  const dialogue = new DialogueSystem(bus);
  const passport = new PassportSystem(bus, worldData);
  const inventory = new InventorySystem(bus);
  const quests = new QuestSystem(bus);
  const ai = new MockConversationAI();

  const player = await createPlayer();
  camera.followTarget(player.object3D);

  inventory.addItem({ id: 'carnet', label: 'Carnet MédinImmersion', icon: '📓' });
  inventory.addItem({ id: 'crayon', label: 'Crayon', icon: '✏️' });

  const fadeOverlay = new FadeOverlay(document.getElementById('fade-overlay'));

  const buildContext = () => ({ bus, quests, passport, inventory, dialogue, ai, player });

  const sceneManager = new SceneManager({
    engine,
    camera,
    player,
    fadeOverlay,
    bus,
    buildContext,
  });

  // eslint-disable-next-line no-new
  new HUD(bus, {
    objectiveEl: document.getElementById('hud-objective'),
    promptEl: document.getElementById('hud-prompt'),
  });

  // eslint-disable-next-line no-new
  new DialogueBoxUI(bus, dialogue, {
    box: document.getElementById('dialogue-box'),
    speaker: document.getElementById('dialogue-speaker'),
    arabic: document.getElementById('dialogue-arabic'),
    text: document.getElementById('dialogue-text'),
    inputWrap: document.getElementById('dialogue-input-wrap'),
    input: document.getElementById('dialogue-input'),
    submit: document.getElementById('dialogue-input-submit'),
    continueHint: document.getElementById('dialogue-continue'),
  });

  // eslint-disable-next-line no-new
  new PassportUI(bus, {
    root: document.getElementById('passport-ui'),
    closeBtn: document.getElementById('passport-close'),
    name: document.getElementById('passport-name'),
    level: document.getElementById('passport-level'),
    countries: document.getElementById('passport-countries'),
    stamps: document.getElementById('passport-stamps'),
    certificates: document.getElementById('passport-certificates'),
  });
  passport.setStudentProfile({}); // triggers an initial PASSPORT_UPDATED so the UI has data whenever it opens

  document.getElementById('hud-passport-btn').addEventListener('click', () => bus.emit(Events.PASSPORT_TOGGLE_UI));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') bus.emit(Events.PASSPORT_TOGGLE_UI);
  });

  engine.onUpdate((dt) => {
    if (!sceneManager.current) return;
    player.update(dt, { input, camera });
    camera.update(dt);
    sceneManager.update(dt, input);
  });

  const startScreen = document.getElementById('start-screen');
  const loadingScreen = document.getElementById('loading-screen');
  document.getElementById('start-btn').addEventListener('click', async () => {
    startScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    engine.start();
    await sceneManager.goTo('academy-exterior', 'entrance', { instant: true });
    loadingScreen.classList.add('hidden');
  });

  // Kept for debugging from the browser console during art-direction review.
  window.__rihla = { bus, passport, inventory, quests, sceneManager };
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('RIHLA prototype failed to start:', err);
});

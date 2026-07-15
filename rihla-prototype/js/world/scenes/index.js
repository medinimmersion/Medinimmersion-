import { sceneRegistry } from '../SceneRegistry.js';
import { AcademyExteriorScene } from './AcademyExteriorScene.js';
import { HallScene } from './HallScene.js';
import { CairoSquareScene } from './CairoSquareScene.js';
import { RueDesLettresScene } from './RueDesLettresScene.js';
import { ChezAlifScene } from './ChezAlifScene.js';

// The only file that knows every scene class exists. Adding a new scene
// (a new country, a new room) means: write the class, add one line here.
// SceneManager and everything else only ever refers to scenes by string id.
sceneRegistry.register('academy-exterior', (ctx) => new AcademyExteriorScene(ctx));
sceneRegistry.register('hall', (ctx) => new HallScene(ctx));
sceneRegistry.register('cairo-square', (ctx) => new CairoSquareScene(ctx));
sceneRegistry.register('rue-des-lettres', (ctx) => new RueDesLettresScene(ctx));
sceneRegistry.register('chez-alif', (ctx) => new ChezAlifScene(ctx));

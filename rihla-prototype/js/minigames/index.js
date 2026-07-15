import { miniGameRegistry } from '../systems/MiniGameRegistry.js';
import { PanierAlifGame } from './PanierAlifGame.js';

// Le seul fichier qui connaît la liste des mini-jeux. Ajouter un mini-jeu =
// écrire sa classe + une ligne ici ; les scènes ne les créent que par id.
miniGameRegistry.register('panier-alif', (ctx) => new PanierAlifGame(ctx));

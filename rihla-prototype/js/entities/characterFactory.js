import { Player } from './Player.js';
import { NPC } from './NPC.js';
import { assetRegistry } from '../core/AssetRegistry.js';

const PRESETS = {
  player: { robeColor: 0xcbb489, accentColor: 0x8a7350, skinColor: 0xd8b48c, headwear: 'ghutra', headwearColor: 0xf3ecd8 },
  abou_adam: { robeColor: 0x33513a, accentColor: 0xc9a44c, skinColor: 0xc89468, headwear: 'ghutra', headwearColor: 0xf3ecd8 },
  abdallah: { robeColor: 0x2f4858, accentColor: 0xd8c6a1, skinColor: 0xce9f79, headwear: 'ghutra', headwearColor: 0xf3ecd8 },
  abdel_wadoud: { robeColor: 0x241f1a, accentColor: 0xc9a44c, skinColor: 0xc4936a, headwear: 'ghutra', headwearColor: 0xece2c4 },
};

assetRegistry.register('character:player', async () => new Player(PRESETS.player));
for (const key of ['abou_adam', 'abdallah', 'abdel_wadoud']) {
  assetRegistry.register(`character:${key}`, async () => new NPC(PRESETS[key]));
}

export async function createPlayer() {
  return assetRegistry.create('character:player');
}

export async function createNPC(key) {
  return assetRegistry.create(`character:${key}`);
}

import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addOutdoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, moucharabiehWindow, woodenDoor, lantern, signboard, stoneMaterial, woodMaterial } from '../../builders/architecture.js';
import { pottedPlant, wickerBasket, rug } from '../../builders/furniture.js';
import { sandTexture } from '../../builders/textures.js';
import { Events } from '../../systems/events.js';

// Document 040 — la Rue des Lettres : chaque boutique porte le nom d'une
// lettre arabe. La première leçon se déroule « Chez Alif ».
export class RueDesLettresScene extends SceneBase {
  async build() {
    createSky(this.object3D, 0xcfe8f5, 0xe8d8b5, 20, 60);
    addOutdoorLighting(this.object3D, { sunAzimuthDeg: 65, sunElevationDeg: 30 });

    const length = 28;
    const width = 7;
    const halfL = length / 2;
    const halfW = width / 2;

    const floor = createGround(length + 8, PALETTE.sand, { roughness: 0.9, map: sandTexture({ repeat: 9 }) });
    this.object3D.add(floor);

    const mat = stoneMaterial();

    // Boutiques de chaque côté de la rue : façade + porte + enseigne.
    const shops = [
      { letter: 'ا', name: 'Chez Alif', z: -6, side: -1, isAlif: true },
      { letter: 'ب', name: 'Chez Ba', z: 0, side: -1 },
      { letter: 'ت', name: 'Chez Ta', z: 6, side: -1 },
      { letter: 'ث', name: 'Chez Tha', z: -6, side: 1 },
      { letter: 'ج', name: 'Chez Jim', z: 0, side: 1 },
      { letter: 'ح', name: 'Chez Ha', z: 6, side: 1 },
    ];

    for (const shop of shops) {
      const x = shop.side * halfW;
      const facade = wallSegment({ width: 5.6, height: 4.6, depth: 0.4, material: mat });
      facade.rotation.y = shop.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      facade.position.set(x, 2.3, shop.z);
      this.object3D.add(facade);

      const door = woodenDoor({ width: 1.0, height: 2.2 });
      door.rotation.y = shop.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      door.position.set(x - shop.side * 0.25, 0, shop.z + (shop.side === -1 ? 0.5 : -0.5));
      this.object3D.add(door);
      if (shop.isAlif) this._alifDoor = door;

      const sign = signboard({ label: shop.name, letterAr: shop.letter });
      sign.rotation.y = shop.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      sign.position.set(x - shop.side * 0.32, 3.1, shop.z);
      this.object3D.add(sign);

      const win = moucharabiehWindow({ width: 0.9, height: 1.2 });
      win.rotation.y = shop.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      win.position.set(x - shop.side * 0.24, 2.0, shop.z - 1.7);
      this.object3D.add(win);
    }

    // Murs de fin de rue (avec passage côté place).
    const endWall = wallSegment({ width, height: 4.6, depth: 0.4, material: mat });
    endWall.position.set(0, 2.3, -halfL);
    this.object3D.add(endWall);

    // Décor de rue : lanternes murales, plantes, paniers, tapis suspendus.
    for (const z of [-9, -3, 3, 9]) {
      for (const side of [-1, 1]) {
        const lamp = lantern({ lit: false });
        lamp.position.set(side * (halfW - 0.35), 3.0, z);
        this.object3D.add(lamp);
      }
    }
    for (const [x, z] of [[-2.6, -3.4], [2.6, 2.6], [-2.4, 8.5], [2.6, -8.5]]) {
      const plant = pottedPlant({ scale: 1.1 });
      plant.position.set(x, 0, z);
      this.object3D.add(plant);
    }
    for (const [x, z] of [[-2.8, -5], [2.8, 5.6], [2.8, -1]]) {
      const basket = wickerBasket({ radius: 0.24, height: 0.3 });
      basket.position.set(x, 0.15, z);
      this.object3D.add(basket);
    }

    // Tapis d'accueil devant Chez Alif.
    const alifRug = rug({ width: 1.6, depth: 1.0 });
    alifRug.position.set(-halfW + 1.2, 0.01, -6);
    this.object3D.add(alifRug);

    // Caisses en bois empilées.
    const crateMat = woodMaterial();
    for (const [x, y, z] of [[2.7, 0.25, 8.6], [2.7, 0.75, 8.6], [2.2, 0.25, 8.9], [-2.7, 0.25, 1.2]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), crateMat);
      crate.position.set(x, y, z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.object3D.add(crate);
    }

    // --- Spawns et navigation.
    this.spawnPoints.fromSquare = { position: new THREE.Vector3(0, 0, halfL - 1.5), yaw: Math.PI };
    this.spawnPoints.fromAlif = { position: new THREE.Vector3(-halfW + 1.6, 0, -6), yaw: Math.PI / 2 };

    this.interactables.push({
      id: 'enter-chez-alif',
      position: new THREE.Vector3(-halfW + 1.0, 0, -6),
      radius: 1.6,
      label: 'Entrer Chez Alif',
      onInteract: (ctx) => {
        this._alifDoor?.userData.setOpen(true);
        setTimeout(() => ctx.sceneManager.goTo('chez-alif', 'entrance'), 450);
      },
    });

    this.interactables.push({
      id: 'back-to-square',
      position: new THREE.Vector3(0, 0, halfL + 0.3),
      radius: 1.6,
      label: 'Retourner sur la place',
      onInteract: (ctx) => ctx.sceneManager.goTo('cairo-square', 'fromRue'),
    });

    this.ctx.bus.emit(Events.HUD_SET_OBJECTIVE, { text: 'Trouve la boutique « Chez Alif » et entre (E).' });
  }

  update(dt) {
    this._alifDoor?.userData.update(dt);
  }
}

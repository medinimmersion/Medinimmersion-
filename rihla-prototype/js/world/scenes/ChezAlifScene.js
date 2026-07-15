import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addIndoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, moucharabiehWindow, lantern, lightShaft, stoneMaterial, woodMaterial } from '../../builders/architecture.js';
import { bookshelf, desk, rug, pottedPlant, wickerBasket } from '../../builders/furniture.js';
import { tileFloorTexture, signboardTexture } from '../../builders/textures.js';
import { createNPC } from '../../entities/characterFactory.js';
import { playAlifLessonSequence } from '../../narrative/sequences/alifLessonSequence.js';
import { Events } from '../../systems/events.js';

// Document 040 + 013 — l'intérieur de « Chez Alif » : la boutique-école où
// Abdallah donne la toute première leçon (la lettre Alif), suivie du
// mini-jeu du panier d'Alif.
export class ChezAlifScene extends SceneBase {
  async build() {
    createSky(this.object3D, PALETTE.woodDark, PALETTE.woodDark, 10, 26);
    addIndoorLighting(this.object3D, { intensity: 1.0 });

    const W = 9;
    const D = 9;
    const wallHeight = 4.2;
    const halfW = W / 2;
    const halfD = D / 2;

    const floor = createGround(W + 2, PALETTE.stoneLight, { roughness: 0.35, map: tileFloorTexture({ repeat: 6 }) });
    this.object3D.add(floor);

    const mat = stoneMaterial();
    const walls = [
      { w: W, x: 0, z: -halfD, ry: 0 },
      { w: D, x: -halfW, z: 0, ry: Math.PI / 2 },
      { w: D, x: halfW, z: 0, ry: Math.PI / 2 },
      { w: W, x: 0, z: halfD, ry: 0 },
    ];
    for (const c of walls) {
      const wall = wallSegment({ width: c.w, height: wallHeight, depth: 0.35, material: mat });
      wall.position.set(c.x, wallHeight / 2, c.z);
      wall.rotation.y = c.ry;
      this.object3D.add(wall);
    }

    // Plafond simple avec poutres.
    const beamMat = woodMaterial();
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.3, D - 0.3),
      new THREE.MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.85 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight - 0.04;
    this.object3D.add(ceiling);
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.18, 0.2), beamMat);
      beam.position.set(0, wallHeight - 0.14, i * 1.7);
      beam.castShadow = true;
      this.object3D.add(beam);
    }

    // Fenêtre + rayon de lumière.
    const win = moucharabiehWindow({ width: 1.1, height: 1.5 });
    win.rotation.y = Math.PI / 2;
    win.position.set(-halfW + 0.15, 2.4, -1);
    this.object3D.add(win);
    const shaft = lightShaft({ length: 3.4, radiusTop: 0.1, radiusBottom: 1.0, opacity: 0.13 });
    shaft.rotation.z = Math.PI / 2 - 0.5;
    shaft.position.set(-halfW + 1.5, 3.4, -1);
    this.object3D.add(shaft);

    // Grand tableau « ا » au mur du fond — l'objet de la leçon.
    const boardTex = signboardTexture('Alif — la première lettre', { bg: '#2c1f14', fg: '#e9dcbd', letterAr: 'ا' });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 }),
    );
    board.position.set(0, 2.3, -halfD + 0.19);
    this.object3D.add(board);

    // Mobilier : étagères de lettres, bureau d'Abdallah, tapis central.
    const shelfL = bookshelf({ width: 1.8, height: 2.2 });
    shelfL.rotation.y = Math.PI / 2;
    shelfL.position.set(-halfW + 0.45, 0, 2.2);
    this.object3D.add(shelfL);

    const shelfR = bookshelf({ width: 1.8, height: 2.2 });
    shelfR.rotation.y = -Math.PI / 2;
    shelfR.position.set(halfW - 0.45, 0, 2.2);
    this.object3D.add(shelfR);

    const alifDesk = desk({ width: 1.5, depth: 0.8 });
    alifDesk.position.set(1.6, 0, -2.6);
    this.object3D.add(alifDesk);

    const centralRug = rug({ width: 3.0, depth: 2.2 });
    centralRug.position.set(0, 0.01, 0.4);
    this.object3D.add(centralRug);

    const plant = pottedPlant({ scale: 1.0 });
    plant.position.set(halfW - 0.7, 0, -3.4);
    this.object3D.add(plant);

    // Le fameux panier d'Alif, posé au centre.
    const panier = wickerBasket({ radius: 0.3, height: 0.35 });
    panier.position.set(-0.8, 0.18, -1.6);
    this.object3D.add(panier);

    const lant = lantern({ lit: true });
    lant.position.set(0, wallHeight - 0.5, 0.5);
    this.object3D.add(lant);

    // --- Abdallah, derrière son bureau.
    const abdallah = await createNPC('abdallah');
    abdallah.setPosition(1.6, 0, -3.3);
    abdallah.faceYaw(Math.PI * 0.05);
    this.object3D.add(abdallah.object3D);
    this._abdallah = abdallah;
    this._lessonStarted = false;

    // --- Spawns et navigation.
    this.spawnPoints.entrance = { position: new THREE.Vector3(0, 0, halfD - 1.3), yaw: Math.PI };

    this.interactables.push({
      id: 'start-alif-lesson',
      position: new THREE.Vector3(1.0, 0, -2.2),
      radius: 2.4,
      label: "Commencer la leçon d'Alif",
      onInteract: (ctx) => {
        if (this._lessonStarted) return;
        this._lessonStarted = true;
        this._abdallah.faceToward(ctx.player.object3D.position);
        playAlifLessonSequence(ctx, this._abdallah);
      },
    });

    this.interactables.push({
      id: 'exit-to-rue',
      position: new THREE.Vector3(0, 0, halfD + 0.3),
      radius: 1.4,
      label: 'Sortir dans la rue',
      onInteract: (ctx) => ctx.sceneManager.goTo('rue-des-lettres', 'fromAlif'),
    });

    this.ctx.bus.emit(Events.HUD_SET_OBJECTIVE, { text: "Approche-toi d'Abdallah pour commencer la leçon (E)." });
  }

  update(dt) {
    this._abdallah?.update(dt);
  }
}

import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addIndoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, column, moucharabiehWindow, archDoorway, lightShaft, lantern, stoneMaterial, woodMaterial } from '../../builders/architecture.js';
import { bookshelf, pottedPlant, desk, armchair, passportCase, wallMap, rug, wickerBasket } from '../../builders/furniture.js';
import { tileFloorTexture } from '../../builders/textures.js';
import { createNPC } from '../../entities/characterFactory.js';
import { playWelcomeSequence } from '../../narrative/sequences/welcomeSequence.js';
import { Events } from '../../systems/events.js';

export class HallScene extends SceneBase {
  async build() {
    createSky(this.object3D, PALETTE.woodDark, PALETTE.woodDark, 14, 34);
    addIndoorLighting(this.object3D, { intensity: 1.15 });

    const W = 14;
    const D = 14;
    const wallHeight = 5.6;
    const halfW = W / 2;
    const halfD = D / 2;

    const floor = createGround(W + 2, PALETTE.stoneLight, { roughness: 0.3, map: tileFloorTexture({ repeat: 8 }) });
    this.object3D.add(floor);

    const centralRug = rug({ width: 3.8, depth: 2.6 });
    centralRug.position.set(0, 0.01, 0);
    this.object3D.add(centralRug);

    const wallMat = stoneMaterial();

    const backWall = wallSegment({ width: W, height: wallHeight, depth: 0.35, material: wallMat });
    backWall.position.set(0, wallHeight / 2, -halfD);
    this.object3D.add(backWall);

    const corridorArch = archDoorway({ width: 1.6, height: 2.8, depth: 0.38, horseshoe: true });
    corridorArch.position.set(0, 0, -halfD + 0.12);
    this.object3D.add(corridorArch);
    const corridorVoid = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x0e0a06, roughness: 1 }),
    );
    corridorVoid.position.set(0, 1.4, -halfD + 0.02);
    this.object3D.add(corridorVoid);

    const sideWallL = wallSegment({ width: D, height: wallHeight, depth: 0.35, material: wallMat });
    sideWallL.rotation.y = Math.PI / 2;
    sideWallL.position.set(-halfW, wallHeight / 2, 0);
    this.object3D.add(sideWallL);

    const sideWallR = sideWallL.clone();
    sideWallR.position.set(halfW, wallHeight / 2, 0);
    this.object3D.add(sideWallR);

    const doorGap = 1.8;
    const frontPanelW = (W - doorGap) / 2;
    const frontL = wallSegment({ width: frontPanelW, height: wallHeight, depth: 0.35, material: wallMat });
    frontL.position.set(-doorGap / 2 - frontPanelW / 2, wallHeight / 2, halfD);
    this.object3D.add(frontL);
    const frontR = frontL.clone();
    frontR.position.x = doorGap / 2 + frontPanelW / 2;
    this.object3D.add(frontR);
    const lintel = wallSegment({ width: doorGap + 0.4, height: wallHeight - 2.8, depth: 0.35, material: wallMat });
    lintel.position.set(0, wallHeight - (wallHeight - 2.8) / 2, halfD);
    this.object3D.add(lintel);

    const entryArch = archDoorway({ width: doorGap, height: 2.8, depth: 0.38, horseshoe: true });
    entryArch.position.set(0, 0, halfD - 0.1);
    this.object3D.add(entryArch);

    // Colonnes — rangée intérieure de chaque côté, style islamique.
    const colH = wallHeight;
    const colInset = halfW - 1.8;
    for (const zOff of [-4.5, -1.5, 1.5, 4.5]) {
      const colL = column({ height: colH, radius: 0.2 });
      colL.position.set(-colInset, 0, zOff);
      this.object3D.add(colL);
      const colR = column({ height: colH, radius: 0.2 });
      colR.position.set(colInset, 0, zOff);
      this.object3D.add(colR);
    }

    // Fenêtres moucharabieh — mur gauche, avec rayons de lumière.
    for (const z of [-4.0, -0.5, 3.0]) {
      const win = moucharabiehWindow({ width: 1.2, height: 1.8 });
      win.rotation.y = Math.PI / 2;
      win.position.set(-halfW + 0.16, 2.8, z);
      this.object3D.add(win);

      const shaft = lightShaft({ length: 4, radiusTop: 0.12, radiusBottom: 1.3, opacity: 0.14 });
      shaft.rotation.z = Math.PI / 2 - 0.45;
      shaft.position.set(-halfW + 1.8, 4.2, z);
      this.object3D.add(shaft);
    }

    // Fenêtre droite (une seule, derrière le bureau d'Abou Adam).
    const winR = moucharabiehWindow({ width: 1.0, height: 1.5 });
    winR.rotation.y = -Math.PI / 2;
    winR.position.set(halfW - 0.16, 2.8, -3.5);
    this.object3D.add(winR);

    // Plafond bois — poutres + panneaux.
    const beamMat = woodMaterial();
    const ceilingMat = new THREE.MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.85 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D - 0.4), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight - 0.05;
    ceiling.receiveShadow = true;
    this.object3D.add(ceiling);

    for (let i = -3; i <= 3; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.24, 0.26), beamMat);
      beam.position.set(0, wallHeight - 0.18, i * 1.85);
      beam.castShadow = true;
      this.object3D.add(beam);
    }
    for (let i = -1; i <= 1; i++) {
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, D - 0.6), beamMat);
      crossBeam.position.set(i * 4.2, wallHeight - 0.2, 0);
      crossBeam.castShadow = true;
      this.object3D.add(crossBeam);
    }

    // Lanternes suspendues.
    for (const [x, z] of [[0, 0], [-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]]) {
      const lant = lantern({ lit: true });
      lant.position.set(x, wallHeight - 0.6, z);
      this.object3D.add(lant);
    }

    // --- Mobilier côté gauche : bibliothèque + coin lecture.
    const shelf1 = bookshelf({ width: 2.2, height: 2.5 });
    shelf1.rotation.y = Math.PI / 2;
    shelf1.position.set(-halfW + 0.5, 0, -2.5);
    this.object3D.add(shelf1);

    const shelf2 = bookshelf({ width: 1.6, height: 2.0 });
    shelf2.rotation.y = Math.PI / 2;
    shelf2.position.set(-halfW + 0.5, 0, 1.0);
    this.object3D.add(shelf2);

    const readingChair = armchair();
    readingChair.position.set(-4.5, 0, -0.5);
    readingChair.rotation.y = Math.PI / 4;
    this.object3D.add(readingChair);

    // --- Plantes.
    for (const [x, z] of [[-5.8, 5.5], [5.8, 5.5], [-5.8, -5.5], [5.8, -5.5]]) {
      const plant = pottedPlant({ scale: 1.15 });
      plant.position.set(x, 0, z);
      this.object3D.add(plant);
    }

    // --- Bureau d'Abou Adam (côté droit, vers le fond).
    const abouDesk = desk({ width: 1.8, depth: 0.9 });
    abouDesk.position.set(5.0, 0, -4.5);
    this.object3D.add(abouDesk);

    const map = wallMap({ width: 1.4, height: 0.9 });
    map.position.set(halfW - 0.16, 2.2, -4.5);
    map.rotation.y = -Math.PI / 2;
    this.object3D.add(map);

    const pCase = passportCase();
    pCase.position.set(5.8, 0, -3.2);
    this.object3D.add(pCase);

    const visitorChair = armchair();
    visitorChair.position.set(3.8, 0, -3.4);
    visitorChair.rotation.y = Math.PI * 0.2;
    this.object3D.add(visitorChair);

    const basket = wickerBasket({ radius: 0.18, height: 0.25 });
    basket.position.set(4.2, 0.12, -2.6);
    this.object3D.add(basket);

    // Petit tapis devant le bureau.
    const deskRug = rug({ width: 2.0, depth: 1.4 });
    deskRug.position.set(4.5, 0.01, -3.5);
    this.object3D.add(deskRug);

    // --- Abou Adam (NPC).
    const abouAdam = await createNPC('abou_adam');
    abouAdam.setPosition(5.0, 0, -5.2);
    abouAdam.faceYaw(Math.PI);
    abouAdam.sitDown();
    this.object3D.add(abouAdam.object3D);
    this._abouAdam = abouAdam;
    this._welcomePlayed = false;

    // --- Points d'apparition et déclencheurs.
    this.spawnPoints.entrance = { position: new THREE.Vector3(0, 0, 5.5), yaw: Math.PI };

    this.autoTriggers.push({
      id: 'exit-to-courtyard',
      position: new THREE.Vector3(0, 0, halfD + 0.5),
      radius: 0.9,
      onEnter: (ctx) => ctx.sceneManager.goTo('academy-exterior', 'fromHall'),
    });

    this.interactables.push({
      id: 'talk-abou-adam',
      position: new THREE.Vector3(5.0, 0, -4.0),
      radius: 2.2,
      label: 'Saluer Abou Adam',
      onInteract: (ctx) => {
        if (this._welcomePlayed) return;
        this._welcomePlayed = true;
        this._abouAdam.faceToward(ctx.player.object3D.position);
        playWelcomeSequence(ctx, this._abouAdam);
      },
    });

    this.ctx.bus.emit(Events.HUD_SET_OBJECTIVE, { text: "Approche-toi d'Abou Adam et appuie sur E pour le saluer." });
  }

  update(dt) {
    this._abouAdam?.update(dt);
  }
}

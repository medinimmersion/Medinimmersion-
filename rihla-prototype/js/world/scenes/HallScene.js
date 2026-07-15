import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addIndoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, moucharabiehWindow, archDoorway, lightShaft, stoneMaterial, woodMaterial } from '../../builders/architecture.js';
import { bookshelf, pottedPlant, desk, armchair, passportCase, wallMap, rug } from '../../builders/furniture.js';
import { tileFloorTexture } from '../../builders/textures.js';
import { createNPC } from '../../entities/characterFactory.js';
import { playWelcomeSequence } from '../../narrative/sequences/welcomeSequence.js';
import { Events } from '../../systems/events.js';

// "Document 005 – Hall d'accueil" + "Document 034 – Académie
// MédinImmersion (Partie 1)": vast, calm, sunlit hall. Library to the
// left, Abou Adam at his desk facing the entrance. This is where the very
// first greeting happens (Document 005); the deeper registration
// interview (Document 006) happens once the player is invited into his
// private office — a separate scene, not yet built in this slice.
//
// This scene is the one pushed to higher visual polish per the user's
// request: proportions, materials, light and the character all get more
// attention here than in the other (still placeholder) scenes.
export class HallScene extends SceneBase {
  async build() {
    createSky(this.object3D, PALETTE.woodDark, PALETTE.woodDark, 14, 34);
    addIndoorLighting(this.object3D, { intensity: 1.05 });

    const wallHeight = 5.2;

    const floor = createGround(16, PALETTE.stoneLight, { roughness: 0.35, map: tileFloorTexture() });
    this.object3D.add(floor);
    this.object3D.add(rug({ width: 3.2, depth: 2.1 }));

    const wallMat = stoneMaterial();
    const backWall = wallSegment({ width: 12, height: wallHeight, depth: 0.3, material: wallMat });
    backWall.position.set(0, wallHeight / 2, -6);
    this.object3D.add(backWall);

    // A recessed arch in the back wall hints at the corridor to the
    // classrooms (Document 034) without needing it to be walkable yet.
    const corridorArch = archDoorway({ width: 1.5, height: 2.6, depth: 0.32 });
    corridorArch.position.set(0, 0, -5.86);
    this.object3D.add(corridorArch);
    const corridorVoid = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x140f09, roughness: 1 }),
    );
    corridorVoid.position.set(0, 1.3, -5.98);
    this.object3D.add(corridorVoid);

    const sideWallL = wallSegment({ width: 12, height: wallHeight, depth: 0.3, material: wallMat });
    sideWallL.rotation.y = Math.PI / 2;
    sideWallL.position.set(-6, wallHeight / 2, 0);
    this.object3D.add(sideWallL);

    const sideWallR = sideWallL.clone();
    sideWallR.position.set(6, wallHeight / 2, 0);
    this.object3D.add(sideWallR);

    // Front wall with a doorway gap back to the courtyard.
    const frontL = wallSegment({ width: 4.2, height: wallHeight, depth: 0.3, material: wallMat });
    frontL.position.set(-3.9, wallHeight / 2, 6);
    this.object3D.add(frontL);
    const frontR = frontL.clone();
    frontR.position.set(3.9, wallHeight / 2, 6);
    this.object3D.add(frontR);
    const lintel = wallSegment({ width: 1.6, height: wallHeight - 2.6, depth: 0.3, material: wallMat });
    lintel.position.set(0, wallHeight - (wallHeight - 2.6) / 2, 6);
    this.object3D.add(lintel);

    for (const z of [-3.2, 1.2]) {
      const win = moucharabiehWindow({ width: 1.15, height: 1.7 });
      win.rotation.y = Math.PI / 2;
      win.position.set(-5.83, 2.6, z);
      this.object3D.add(win);

      const shaft = lightShaft({ length: 3.6, radiusTop: 0.1, radiusBottom: 1.1, opacity: 0.13 });
      shaft.rotation.z = Math.PI / 2 - 0.5;
      shaft.position.set(-4.6, 3.9, z);
      this.object3D.add(shaft);
    }

    // Wooden ceiling beams (Document 034: "plafond haut avec poutres en bois").
    const beamMat = woodMaterial();
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.22, 0.24), beamMat);
      beam.position.set(0, wallHeight - 0.15, i * 2.2);
      beam.castShadow = true;
      this.object3D.add(beam);
    }

    const shelf = bookshelf({ width: 1.9, height: 2.3 });
    shelf.rotation.y = Math.PI / 2;
    shelf.position.set(-5.6, 0, -1.6);
    this.object3D.add(shelf);

    for (const [x, z] of [[-4.6, 5.2], [4.6, 5.2]]) {
      const plant = pottedPlant({ scale: 1.25 });
      plant.position.set(x, 0, z);
      this.object3D.add(plant);
    }

    // Abou Adam's reception corner: desk, wall map, passport case, a
    // visitor's armchair — richer than a bare table (Document 006).
    const abouDesk = desk({ width: 1.7, depth: 0.85 });
    abouDesk.position.set(4.3, 0, -4.2);
    this.object3D.add(abouDesk);

    const map = wallMap({ width: 1.3, height: 0.85 });
    map.position.set(5.83, 2.4, -4.2);
    map.rotation.y = -Math.PI / 2;
    this.object3D.add(map);

    const pCase = passportCase();
    pCase.position.set(5.4, 0, -3.1);
    this.object3D.add(pCase);

    const visitorChair = armchair();
    visitorChair.position.set(3.5, 0, -2.9);
    visitorChair.rotation.y = Math.PI * 0.15;
    this.object3D.add(visitorChair);

    const abouAdam = await createNPC('abou_adam');
    abouAdam.setPosition(4.3, 0, -4.9);
    abouAdam.faceYaw(Math.PI);
    abouAdam.sitDown();
    this.object3D.add(abouAdam.object3D);
    this._abouAdam = abouAdam;
    this._welcomePlayed = false;

    this.spawnPoints.entrance = { position: new THREE.Vector3(0, 0, 4.6), yaw: Math.PI };

    this.autoTriggers.push({
      id: 'exit-to-courtyard',
      position: new THREE.Vector3(0, 0, 6.3),
      radius: 0.9,
      onEnter: (ctx) => ctx.sceneManager.goTo('academy-exterior', 'fromHall'),
    });

    this.interactables.push({
      id: 'talk-abou-adam',
      position: new THREE.Vector3(4.3, 0, -3.9),
      radius: 1.7,
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

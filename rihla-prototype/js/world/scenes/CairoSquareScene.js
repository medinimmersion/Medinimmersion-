import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addOutdoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, archDoorway, palmTree, lantern, signboard, stoneMaterial } from '../../builders/architecture.js';
import { pottedPlant, wickerBasket } from '../../builders/furniture.js';
import { sandTexture } from '../../builders/textures.js';
import { createNPC } from '../../entities/characterFactory.js';
import { playAbdallahMeetingSequence } from '../../narrative/sequences/abdallahMeetingSequence.js';
import { Events } from '../../systems/events.js';

// Document 040 — Égypte / Le Caire : la place centrale, premier contact
// avec Abdallah, l'enseignant du parcours Égypte.
export class CairoSquareScene extends SceneBase {
  async build() {
    createSky(this.object3D, 0xcfe8f5, 0xe8d8b5, 25, 80);
    addOutdoorLighting(this.object3D, { sunAzimuthDeg: 40, sunElevationDeg: 38 });

    const size = 26;
    const half = size / 2;

    const floor = createGround(size + 10, PALETTE.sand, { roughness: 0.9, map: sandTexture({ repeat: 10 }) });
    this.object3D.add(floor);

    // Façades autour de la place (bâtiments de fond simples mais habillés).
    const mat = stoneMaterial();
    const facades = [
      { w: size, x: 0, z: -half, ry: 0 },
      { w: size, x: -half, z: 0, ry: Math.PI / 2 },
      { w: size, x: half, z: 0, ry: -Math.PI / 2 },
    ];
    for (const f of facades) {
      const wall = wallSegment({ width: f.w, height: 6.5, depth: 0.4, material: mat });
      wall.position.set(f.x, 3.25, f.z);
      wall.rotation.y = f.ry;
      this.object3D.add(wall);
    }

    // Arche d'arrivée (sud) et arche vers la Rue des Lettres (nord).
    const arrivalArch = archDoorway({ width: 2.2, height: 3.2, depth: 0.5, horseshoe: true });
    arrivalArch.position.set(0, 0, half);
    this.object3D.add(arrivalArch);

    const rueArch = archDoorway({ width: 2.0, height: 3.0, depth: 0.5, horseshoe: true });
    rueArch.position.set(0, 0, -half + 0.2);
    this.object3D.add(rueArch);

    const rueSign = signboard({ label: 'Rue des Lettres', letterAr: 'حروف' });
    rueSign.position.set(0, 3.6, -half + 0.5);
    this.object3D.add(rueSign);

    // Fontaine centrale.
    const fountain = new THREE.Group();
    const basinMat = stoneMaterial();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.5, 24), basinMat);
    basin.position.y = 0.25;
    basin.castShadow = true;
    fountain.add(basin);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x7fc4d8, roughness: 0.15, metalness: 0.1 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 24), waterMat);
    water.position.y = 0.48;
    fountain.add(water);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.0, 12), basinMat);
    pillar.position.y = 0.9;
    pillar.castShadow = true;
    fountain.add(pillar);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.22, 16), basinMat);
    bowl.position.y = 1.45;
    bowl.castShadow = true;
    fountain.add(bowl);
    fountain.position.set(0, 0, 0);
    this.object3D.add(fountain);
    this._water = water;

    // Palmiers et végétation.
    for (const [x, z, h] of [[-8, -6, 4.8], [8, -6, 5.2], [-9, 6, 4.5], [9, 7, 5.0], [-4, -10, 4.2], [5, -10, 4.6]]) {
      const palm = palmTree({ height: h });
      palm.position.set(x, 0, z);
      this.object3D.add(palm);
    }
    for (const [x, z] of [[-6, 3], [6, 3], [-3, -7], [3, -7]]) {
      const plant = pottedPlant({ scale: 1.3 });
      plant.position.set(x, 0, z);
      this.object3D.add(plant);
    }

    // Lampadaires (lanternes sur poteaux).
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6, metalness: 0.5 });
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 5], [5, 5]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), postMat);
      post.position.set(x, 1.7, z);
      post.castShadow = true;
      this.object3D.add(post);
      const lamp = lantern({ lit: false });
      lamp.position.set(x, 3.4, z);
      this.object3D.add(lamp);
    }

    // Étals de marché près des façades.
    for (const [x, z, ry] of [[-9.5, -9, 0.4], [9.5, -9, -0.4]]) {
      const stall = new THREE.Group();
      const tableMat = new THREE.MeshStandardMaterial({ color: PALETTE.woodLight, roughness: 0.85 });
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.9), tableMat);
      table.position.y = 0.8;
      table.castShadow = true;
      stall.add(table);
      for (const lx of [-0.85, 0.85]) {
        for (const lz of [-0.35, 0.35]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), tableMat);
          leg.position.set(lx, 0.4, lz);
          stall.add(leg);
        }
      }
      const awningMat = new THREE.MeshStandardMaterial({ color: 0xa8552f, roughness: 0.9, side: THREE.DoubleSide });
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), awningMat);
      awning.position.set(0, 2.0, -0.2);
      awning.rotation.x = -0.5;
      stall.add(awning);
      for (const px of [-0.6, 0, 0.6]) {
        const basket = wickerBasket({ radius: 0.2, height: 0.22 });
        basket.position.set(px, 0.95, 0);
        stall.add(basket);
      }
      stall.position.set(x, 0, z);
      stall.rotation.y = ry;
      this.object3D.add(stall);
    }

    // --- Abdallah, près de la fontaine.
    const abdallah = await createNPC('abdallah');
    abdallah.setPosition(1.8, 0, 3.2);
    abdallah.faceYaw(Math.PI);
    this.object3D.add(abdallah.object3D);
    this._abdallah = abdallah;
    this._met = false;

    // --- Spawns et navigation.
    this.spawnPoints.arrival = { position: new THREE.Vector3(0, 0, half - 1.5), yaw: Math.PI };
    this.spawnPoints.fromRue = { position: new THREE.Vector3(0, 0, -half + 1.8), yaw: 0 };

    this.interactables.push({
      id: 'talk-abdallah',
      position: new THREE.Vector3(1.8, 0, 3.2),
      radius: 2.2,
      label: 'Saluer Abdallah',
      onInteract: (ctx) => {
        if (this._met) return;
        this._met = true;
        this._abdallah.faceToward(ctx.player.object3D.position);
        playAbdallahMeetingSequence(ctx, this._abdallah);
      },
    });

    this.interactables.push({
      id: 'to-rue-des-lettres',
      position: new THREE.Vector3(0, 0, -half + 0.6),
      radius: 1.6,
      label: 'Entrer dans la Rue des Lettres',
      onInteract: (ctx) => ctx.sceneManager.goTo('rue-des-lettres', 'fromSquare'),
    });

    this.ctx.bus.emit(Events.HUD_SET_OBJECTIVE, { text: 'Approche-toi de la fontaine et salue Abdallah (E).' });
  }

  update(dt) {
    this._abdallah?.update(dt);
    if (this._water) this._water.position.y = 0.48 + Math.sin(performance.now() / 600) * 0.008;
  }
}

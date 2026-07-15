import * as THREE from 'three';
import { SceneBase } from '../SceneBase.js';
import { addOutdoorLighting, createSky, createGround, PALETTE } from '../../builders/environment.js';
import { wallSegment, woodenDoor, palmTree, stoneMaterial } from '../../builders/architecture.js';
import { signboardTexture } from '../../builders/textures.js';
import { Events } from '../../systems/events.js';

// "Document 034 – Académie MédinImmersion (Partie 1)": stone enclosure
// wall, big carved wood door, the academy's name engraved above the
// entrance, palm trees, warm end-of-day light. Free-roam courtyard; the
// door opens automatically as the player nears it and walking through
// carries them straight into the Hall — no menu, no teleport cut.
export class AcademyExteriorScene extends SceneBase {
  async build() {
    createSky(this.object3D, PALETTE.sky, PALETTE.sky, 10, 70);
    addOutdoorLighting(this.object3D, { sunElevationDeg: 22 });

    const ground = createGround(50, PALETTE.sand);
    this.object3D.add(ground);

    const wallHeight = 4.6;
    const doorWidth = 1.5;
    const wallZ = -9;

    const leftWall = wallSegment({ width: 5.6, height: wallHeight, depth: 0.6 });
    leftWall.position.set(-(doorWidth / 2 + 5.6 / 2), wallHeight / 2, wallZ);
    this.object3D.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = doorWidth / 2 + 5.6 / 2;
    this.object3D.add(rightWall);

    const lintel = wallSegment({ width: doorWidth + 0.6, height: 0.9, depth: 0.6, material: stoneMaterial() });
    lintel.position.set(0, wallHeight - 0.45, wallZ);
    this.object3D.add(lintel);

    const door = woodenDoor({ width: doorWidth, height: 2.6 });
    door.position.set(-doorWidth / 2, 0, wallZ + 0.31);
    this.object3D.add(door);
    this._door = door;

    const nameTex = signboardTexture('Académie MédinImmersion', { bg: '#3a2416', fg: '#e9dcbd' });
    const nameMat = new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.6 });
    const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), nameMat);
    namePlate.position.set(0, wallHeight + 0.55, wallZ + 0.31);
    this.object3D.add(namePlate);

    for (const [x, z] of [[-3.2, -6], [3.2, -6], [-4.4, -2], [4.4, -2]]) {
      const palm = palmTree({ height: 4 + Math.random() * 0.8 });
      palm.position.set(x, 0, z);
      this.object3D.add(palm);
    }

    const bench = wallSegment({ width: 1.4, height: 0.42, depth: 0.5, material: stoneMaterial() });
    bench.position.set(-2.2, 0.21, -3.5);
    this.object3D.add(bench);

    this.spawnPoints.entrance = { position: new THREE.Vector3(0, 0, 6), yaw: Math.PI };
    this.spawnPoints.fromHall = { position: new THREE.Vector3(0, 0, wallZ + 1.4), yaw: 0 };

    this.autoTriggers.push({
      id: 'open-door',
      position: new THREE.Vector3(0, 0, wallZ + 2.2),
      radius: 2.6,
      once: false,
      onEnter: () => this._door.userData.setOpen(true),
    });

    this.autoTriggers.push({
      id: 'enter-hall',
      position: new THREE.Vector3(0, 0, wallZ + 0.6),
      radius: 0.9,
      onEnter: (ctx) => ctx.sceneManager.goTo('hall', 'entrance'),
    });

    this.ctx.bus.emit(Events.HUD_SET_OBJECTIVE, { text: "Avance vers l'académie et entre par la grande porte." });
  }

  update(dt) {
    this._door?.userData.update(dt);
    const playerPos = this.ctx.player?.object3D.position;
    if (playerPos && playerPos.distanceTo(this._door.position) > 6) {
      this._door.userData.setOpen(false);
    }
  }
}

import * as THREE from 'three';

// Faceless, same-outfit-throughout humanoid per Document 002/003: "l'oustaz
// principal est toujours sans visage détaillé", "les vêtements restent
// identiques tout au long du jeu, les proportions et la silhouette ne
// changent pas". This is a deliberately simple placeholder rig — a real
// skinned/rigged GLTF character can later be registered under the same
// AssetRegistry key (see entities/characterFactory.js) without any calling
// code changing, because everything outside this file only talks to the
// Character API (playGreet/playTeach/update...), never to raw meshes.
//
// v2: the robe is a single lathed silhouette (flowing thobe, wide at the
// hem) instead of a stacked-cylinder snowman, and headwear can be a
// draped ghutra + agal (still faceless) instead of a flat cap, so the
// placeholder already reads as "Hijaz-inspired" rather than "grey-box".
export class Character {
  constructor({
    robeColor = 0xcbb489,
    accentColor = 0xc9a44c,
    skinColor = 0xd8b48c,
    height = 1.75,
    headwear = null, // null | 'ghutra' | 'kufi'
    headwearColor = 0xf3ecd8,
  } = {}) {
    this.height = height;
    this.root = new THREE.Group();
    this._animT = 0;
    this._state = 'idle';
    this._gestureTimer = 0;
    this._gestureDuration = 0;

    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.82, metalness: 0.02 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55, metalness: 0.2 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.92 });

    // --- Robe: a lathed (rotated-profile) silhouette, flowing from a wide
    // hem at the ankle up to the shoulders, in place of a plain cylinder.
    const hemR = height * 0.145;
    const shoulderR = height * 0.115;
    const shoulderY = height * 0.62;
    const profile = [
      [hemR * 1.08, 0],
      [hemR, height * 0.05],
      [hemR * 0.94, height * 0.16],
      [hemR * 0.86, height * 0.3],
      [hemR * 0.78, height * 0.42],
      [hemR * 0.74, height * 0.5],
      [hemR * 0.82, height * 0.56],
      [shoulderR, shoulderY],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const robeGeo = new THREE.LatheGeometry(profile, 24);
    const robe = new THREE.Mesh(robeGeo, robeMat);
    robe.castShadow = true;
    robe.receiveShadow = true;
    this.root.add(robe);
    this.body = robe;
    this._shoulderY = shoulderY;

    // Waist sash / accent trim — distinguishes characters without altering silhouette.
    const trim = new THREE.Mesh(new THREE.TorusGeometry(hemR * 0.8, height * 0.014, 8, 24), accentMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = height * 0.46;
    this.root.add(trim);

    // --- Neck + head (faceless: a plain rounded head, no eyes/mouth ever).
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.055, height * 0.065, height * 0.05, 12), skinMat);
    neck.position.y = shoulderY + height * 0.02;
    this.root.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.y = neck.position.y + height * 0.075;
    const head = new THREE.Mesh(new THREE.SphereGeometry(height * 0.082, 20, 20), skinMat);
    head.castShadow = true;
    headGroup.add(head);

    if (headwear === 'ghutra') {
      const clothMat = new THREE.MeshStandardMaterial({ color: headwearColor, roughness: 0.75 });
      const agalMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.5 });
      // Domed cloth draped over the head.
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(height * 0.095, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8),
        clothMat,
      );
      dome.position.y = height * 0.015;
      headGroup.add(dome);
      // Side/back drape flaps, angled outward like a ghutra falling past the neck.
      for (const side of [-1, 1]) {
        const flap = new THREE.Mesh(new THREE.ConeGeometry(height * 0.075, height * 0.16, 4, 1, true), clothMat);
        flap.scale.set(1, 1, 0.35);
        flap.position.set(side * height * 0.06, -height * 0.05, -height * 0.02);
        flap.rotation.z = side * 0.28;
        flap.rotation.x = 0.15;
        headGroup.add(flap);
      }
      const agal = new THREE.Mesh(new THREE.TorusGeometry(height * 0.086, height * 0.012, 8, 20), agalMat);
      agal.rotation.x = Math.PI / 2 + 0.05;
      agal.position.y = height * 0.03;
      headGroup.add(agal);
    } else if (headwear === 'kufi') {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.075, height * 0.08, height * 0.06, 16, 1, true), accentMat);
      cap.position.y = height * 0.06;
      headGroup.add(cap);
      const capTop = new THREE.Mesh(new THREE.SphereGeometry(height * 0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
      capTop.position.y = height * 0.09;
      headGroup.add(capTop);
    }
    // Beard — dense, natural, slightly irregular (Doc 062).
    const beardMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.95 });
    const beardGeo = new THREE.SphereGeometry(height * 0.058, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.45);
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, -height * 0.03, height * 0.035);
    beard.scale.set(1.1, 1.3, 0.7);
    headGroup.add(beard);
    const beardTip = new THREE.Mesh(new THREE.ConeGeometry(height * 0.028, height * 0.04, 8), beardMat);
    beardTip.position.set(0, -height * 0.065, height * 0.04);
    beardTip.rotation.x = 0.2;
    headGroup.add(beardTip);

    this.root.add(headGroup);
    this.head = headGroup;

    // --- Arms.
    const armGeo = new THREE.CylinderGeometry(height * 0.03, height * 0.026, height * 0.32, 10);
    armGeo.translate(0, -height * 0.16, 0);

    this.armL = new THREE.Group();
    this.armL.position.set(-shoulderR * 1.35, shoulderY, 0);
    const armLMesh = new THREE.Mesh(armGeo, robeMat);
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);
    this.root.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(shoulderR * 1.35, shoulderY, 0);
    const armRMesh = new THREE.Mesh(armGeo.clone(), robeMat);
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);
    this.root.add(this.armR);

    this._restArmRot = -0.06;
    this.armL.rotation.x = this._restArmRot;
    this.armR.rotation.x = this._restArmRot;

    this.root.traverse((obj) => {
      if (obj.isMesh) obj.receiveShadow = true;
    });
  }

  get object3D() {
    return this.root;
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  faceYaw(yaw) {
    this.root.rotation.y = yaw;
  }

  setState(state) {
    if (this._state === state) return;
    this._state = state;
    this._animT = 0;
  }

  // Plays a one-shot gesture (greet/teach) then returns to idle.
  playGreet() {
    this.setState('greet');
    this._gestureDuration = 2.2;
    this._gestureTimer = 0;
  }

  playTeach() {
    this.setState('teach');
    this._gestureDuration = 1.6;
    this._gestureTimer = 0;
  }

  update(dt, { moving = false } = {}) {
    this._animT += dt;

    if (this._state === 'greet') {
      this._gestureTimer += dt;
      const t = Math.min(this._gestureTimer / 0.5, 1);
      const holdEnd = this._gestureDuration - 0.5;
      let armT;
      if (this._gestureTimer < 0.5) armT = t;
      else if (this._gestureTimer < holdEnd) armT = 1;
      else armT = Math.max(0, 1 - (this._gestureTimer - holdEnd) / 0.5);
      this.armR.rotation.x = this._restArmRot + armT * -2.15;
      this.armR.rotation.z = armT * 0.35;
      this.head.rotation.x = armT * 0.12;
      if (this._gestureTimer >= this._gestureDuration) this.setState('idle');
      return;
    }

    if (this._state === 'teach') {
      this._gestureTimer += dt;
      const wave = Math.sin(this._gestureTimer * 3.2) * 0.35;
      this.armR.rotation.x = this._restArmRot - 1.1 + wave * 0.3;
      this.armR.rotation.z = 0.5 + wave * 0.2;
      this.head.rotation.y = Math.sin(this._gestureTimer * 1.2) * 0.15;
      if (this._gestureTimer >= this._gestureDuration) this.setState('idle');
      return;
    }

    if (moving) {
      const cycle = this._animT * 7.5;
      this.armL.rotation.x = this._restArmRot + Math.sin(cycle) * 0.5;
      this.armR.rotation.x = this._restArmRot - Math.sin(cycle) * 0.5;
      this.root.position.y = Math.abs(Math.sin(cycle)) * 0.02;
      this.head.rotation.y = Math.sin(cycle * 0.5) * 0.04;
      this.body.rotation.y = Math.sin(cycle * 0.5) * 0.02;
    } else {
      const breathe = Math.sin(this._animT * 1.4) * 0.01;
      this.body.scale.y = 1 + breathe;
      this.armL.rotation.x = this._restArmRot;
      this.armR.rotation.x = this._restArmRot;
      this.root.position.y = 0;
      this.head.rotation.y *= 0.9;
      this.head.rotation.x *= 0.9;
      this.body.rotation.y *= 0.9;
    }
  }
}

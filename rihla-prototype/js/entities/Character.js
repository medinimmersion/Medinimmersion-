import * as THREE from 'three';

export class Character {
  constructor({
    robeColor = 0xcbb489,
    accentColor = 0xc9a44c,
    skinColor = 0xd8b48c,
    height = 1.75,
    headwear = null,
    headwearColor = 0xf3ecd8,
    gender = 'male',
  } = {}) {
    this.height = height;
    this.root = new THREE.Group();
    this._animT = 0;
    this._state = 'idle';
    this._gestureTimer = 0;
    this._gestureDuration = 0;

    const s = height / 1.75;

    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.82, metalness: 0.02 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55, metalness: 0.2 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.92 });

    const shoulderY = 1.44 * s;
    const waistY = 1.05 * s;
    const hemY = 0.12 * s;
    const headR = 0.10 * s;
    const shoulderW = 0.21 * s;

    // --- Qamis / Abaya : profil droit, vêtement ample (PAS un pion d'échecs) ---
    const profile = [
      [0.20 * s, hemY],
      [0.19 * s, 0.25 * s],
      [0.185 * s, 0.45 * s],
      [0.175 * s, 0.65 * s],
      [0.165 * s, waistY],
      [0.175 * s, 1.20 * s],
      [0.19 * s, 1.35 * s],
      [shoulderW, shoulderY],
      [0.07 * s, shoulderY + 0.03 * s],
    ].map(([r, y]) => new THREE.Vector2(r, y));

    const qamis = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), robeMat);
    qamis.castShadow = true;
    qamis.receiveShadow = true;
    this.root.add(qamis);
    this.body = qamis;
    this._shoulderY = shoulderY;

    if (gender === 'male') {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072 * s, 0.076 * s, 0.035 * s, 16, 1, true),
        robeMat,
      );
      collar.position.y = shoulderY + 0.015 * s;
      this.root.add(collar);

      const seamColor = new THREE.Color(robeColor).multiplyScalar(0.82);
      const seamMat = new THREE.MeshStandardMaterial({ color: seamColor, roughness: 0.7, depthWrite: true });

      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.006 * s, (shoulderY - hemY) * 0.8), seamMat);
      seam.position.set(0, (shoulderY + hemY) / 2, 0.191 * s);
      this.root.add(seam);

      const pocket = new THREE.Mesh(new THREE.PlaneGeometry(0.055 * s, 0.06 * s), seamMat);
      pocket.position.set(-0.065 * s, 1.28 * s, 0.193 * s);
      this.root.add(pocket);
    }

    // --- Jambes (sous le qamis, visibles pendant la marche) ---
    const legH = hemY * 0.9;
    const legGeo = new THREE.CylinderGeometry(0.04 * s, 0.038 * s, legH, 8);
    legGeo.translate(0, -legH / 2, 0);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.075 * s, hemY, 0);
    this.legL.add(new THREE.Mesh(legGeo, robeMat));
    this.root.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.075 * s, hemY, 0);
    this.legR.add(new THREE.Mesh(legGeo.clone(), robeMat));
    this.root.add(this.legR);

    // --- Sandales ---
    const sandalMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const sandalGeo = new THREE.BoxGeometry(0.085 * s, 0.02 * s, 0.16 * s);
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 });
    const strapGeo = new THREE.BoxGeometry(0.085 * s, 0.008 * s, 0.012 * s);

    for (const leg of [this.legL, this.legR]) {
      const sandal = new THREE.Mesh(sandalGeo, sandalMat);
      sandal.position.set(0, -legH + 0.01 * s, 0.015 * s);
      sandal.castShadow = true;
      leg.add(sandal);
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.position.set(0, 0.015 * s, 0.03 * s);
      sandal.add(strap);
    }

    // --- Cou ---
    const neckH = 0.045 * s;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05 * s, 0.06 * s, neckH, 12),
      skinMat,
    );
    neck.position.y = shoulderY + neckH / 2;
    this.root.add(neck);

    // --- Tête (sans visage, ovale allongé) ---
    const headGroup = new THREE.Group();
    headGroup.position.y = shoulderY + neckH + headR * 0.85;

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 20), skinMat);
    head.scale.set(1, 1.1, 0.95);
    head.castShadow = true;
    headGroup.add(head);

    // --- Coiffure ---
    if (headwear === 'ghutra') {
      const clothMat = new THREE.MeshStandardMaterial({ color: headwearColor, roughness: 0.75, side: THREE.DoubleSide });
      const agalMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.5 });

      const kufiMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7 });
      const kufiSide = new THREE.Mesh(
        new THREE.CylinderGeometry(headR * 0.8, headR * 0.83, headR * 0.42, 16, 1, true),
        kufiMat,
      );
      kufiSide.position.y = headR * 0.32;
      headGroup.add(kufiSide);
      const kufiTop = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        kufiMat,
      );
      kufiTop.position.y = headR * 0.53;
      headGroup.add(kufiTop);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.05, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7),
        clothMat,
      );
      dome.position.y = headR * 0.18;
      headGroup.add(dome);

      for (const [r, y] of [[headR * 0.96, headR * 0.42], [headR * 1.0, headR * 0.37]]) {
        const agal = new THREE.Mesh(new THREE.TorusGeometry(r, headR * 0.032, 8, 20), agalMat);
        agal.rotation.x = Math.PI / 2 + 0.05;
        agal.position.y = y;
        headGroup.add(agal);
      }

      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 * s, 0.30 * s, 0.32 * s, 16, 1, true),
        clothMat,
      );
      drape.position.y = shoulderY - 0.05 * s;
      this.root.add(drape);

      for (const xSign of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.10 * s, 0.22 * s), clothMat);
        tail.position.set(xSign * 0.12 * s, shoulderY - 0.30 * s, 0.16 * s);
        tail.rotation.y = xSign * 0.15;
        this.root.add(tail);
      }

      const backDrape = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * s, 0.35 * s), clothMat);
      backDrape.position.set(0, shoulderY - 0.32 * s, -0.17 * s);
      backDrape.rotation.x = 0.1;
      this.root.add(backDrape);

    } else if (headwear === 'kufi') {
      const capSide = new THREE.Mesh(
        new THREE.CylinderGeometry(headR * 0.76, headR * 0.8, headR * 0.48, 16, 1, true),
        accentMat,
      );
      capSide.position.y = headR * 0.38;
      headGroup.add(capSide);
      const capTop = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.76, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        accentMat,
      );
      capTop.position.y = headR * 0.62;
      headGroup.add(capTop);

    } else if (gender === 'female') {
      const khimarMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.78, side: THREE.DoubleSide });
      const covering = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.12, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65),
        khimarMat,
      );
      covering.position.y = headR * 0.1;
      headGroup.add(covering);
      const khimarDrape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.38 * s, 16, 1, true),
        khimarMat,
      );
      khimarDrape.position.y = -0.15 * s;
      headGroup.add(khimarDrape);
    }

    // --- Barbe (hommes uniquement) ---
    if (gender === 'male') {
      const beardMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.95 });
      const beardMain = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.65, 12, 10, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.5),
        beardMat,
      );
      beardMain.position.set(0, -headR * 0.12, headR * 0.22);
      beardMain.scale.set(1.15, 1.45, 0.75);
      headGroup.add(beardMain);

      const beardTip = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.32, headR * 0.5, 8), beardMat);
      beardTip.position.set(0, -headR * 0.58, headR * 0.18);
      beardTip.rotation.x = 0.12;
      headGroup.add(beardTip);

      const mustache = new THREE.Mesh(
        new THREE.BoxGeometry(headR * 0.45, headR * 0.07, headR * 0.12),
        beardMat,
      );
      mustache.position.set(0, -headR * 0.02, headR * 0.82);
      headGroup.add(mustache);
    }

    this.root.add(headGroup);
    this.head = headGroup;

    // --- Bras + mains ---
    const sleeveLen = 0.40 * s;
    const sleeveGeo = new THREE.CylinderGeometry(0.028 * s, 0.038 * s, sleeveLen, 10);
    sleeveGeo.translate(0, -sleeveLen / 2, 0);
    const handGeo = new THREE.BoxGeometry(0.038 * s, 0.055 * s, 0.022 * s);

    this.armL = new THREE.Group();
    this.armL.position.set(-shoulderW - 0.015 * s, shoulderY, 0);
    const sleeveL = new THREE.Mesh(sleeveGeo, robeMat);
    sleeveL.castShadow = true;
    this.armL.add(sleeveL);
    this.armL.add(new THREE.Mesh(handGeo, skinMat)).position.y = -sleeveLen - 0.022 * s;
    this.root.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(shoulderW + 0.015 * s, shoulderY, 0);
    const sleeveR = new THREE.Mesh(sleeveGeo.clone(), robeMat);
    sleeveR.castShadow = true;
    this.armR.add(sleeveR);
    this.armR.add(new THREE.Mesh(handGeo.clone(), skinMat)).position.y = -sleeveLen - 0.022 * s;
    this.root.add(this.armR);

    this._restArmRot = -0.06;
    this.armL.rotation.x = this._restArmRot;
    this.armR.rotation.x = this._restArmRot;

    // --- Ceinture accent ---
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.17 * s, 0.01 * s, 8, 24), accentMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = waistY + 0.02 * s;
    this.root.add(trim);

    this.root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
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
      this.legL.rotation.x = Math.sin(cycle) * 0.35;
      this.legR.rotation.x = -Math.sin(cycle) * 0.35;
      this.root.position.y = Math.abs(Math.sin(cycle)) * 0.02;
      this.head.rotation.y = Math.sin(cycle * 0.5) * 0.04;
      this.body.rotation.y = Math.sin(cycle * 0.5) * 0.02;
    } else {
      const breathe = Math.sin(this._animT * 1.4) * 0.01;
      this.body.scale.y = 1 + breathe;
      this.armL.rotation.x = this._restArmRot;
      this.armR.rotation.x = this._restArmRot;
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      this.root.position.y = 0;
      this.head.rotation.y *= 0.9;
      this.head.rotation.x *= 0.9;
      this.body.rotation.y *= 0.9;
    }
  }
}

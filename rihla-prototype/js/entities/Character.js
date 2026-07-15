import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Personnage de référence RYHLA — Document 064 (référence officielle).
//
// Étudiant en science religieuse : pudeur, calme, sérénité, noblesse,
// simplicité. Sans visage (choix artistique). Qamis modélisé avec plis
// réels dans la géométrie, ghutra drapée avec bord ondulé, agal 3D
// indépendant avec cordons, mains à cinq doigts, sandales semelle+brides,
// textures tissu/cuir générées (grain, tissage), animations fluides.
//
// Limite assumée : ceci est la meilleure version réalisable en géométrie
// procédurale Three.js. Le modèle artiste (Blender/CC4, cloth sim, PBR
// complet — Documents 062/064/065) le remplacera via characterFactory
// sans changer une ligne des scènes.
// ---------------------------------------------------------------------------

// --- Textures générées (grain tissu, cuir) --------------------------------

let _fabricTex = null;
function fabricTexture() {
  if (_fabricTex) return _fabricTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  // Tissage : fines lignes croisées à peine visibles.
  g.strokeStyle = 'rgba(0,0,0,0.05)';
  g.lineWidth = 1;
  for (let i = 0; i < 256; i += 3) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  // Grain irrégulier du fil.
  for (let i = 0; i < 2600; i++) {
    const v = 235 + Math.random() * 20;
    g.fillStyle = `rgba(${v},${v},${v},0.22)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  _fabricTex = new THREE.CanvasTexture(c);
  _fabricTex.wrapS = _fabricTex.wrapT = THREE.RepeatWrapping;
  _fabricTex.repeat.set(3, 3);
  return _fabricTex;
}

let _leatherTex = null;
function leatherTexture() {
  if (_leatherTex) return _leatherTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a5a30';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const d = Math.random() * 40 - 20;
    g.fillStyle = `rgb(${138 + d},${90 + d * 0.7},${48 + d * 0.5})`;
    const r = 1 + Math.random() * 2;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, r, 0, Math.PI * 2);
    g.fill();
  }
  _leatherTex = new THREE.CanvasTexture(c);
  _leatherTex.wrapS = _leatherTex.wrapT = THREE.RepeatWrapping;
  return _leatherTex;
}

function fabricMaterial(color, { roughness = 0.88 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: fabricTexture(),
    bumpMap: fabricTexture(),
    bumpScale: 0.35,
    roughness,
    metalness: 0.0,
  });
}

// Plis verticaux : déplace radialement les sommets d'une géométrie lathe,
// amplitude croissante vers l'ourlet — le tissu « tombe » avec du poids.
function addVerticalFolds(geometry, { foldCount = 9, amplitude = 0.006, topY, bottomY }) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const t = THREE.MathUtils.clamp((topY - y) / (topY - bottomY), 0, 1);
    const angle = Math.atan2(z, x);
    const fold = Math.sin(angle * foldCount) * amplitude * Math.pow(t, 1.6)
      + Math.sin(angle * (foldCount * 2.7) + 1.3) * amplitude * 0.35 * t;
    const nr = r + fold;
    pos.setX(i, (x / r) * nr);
    pos.setZ(i, (z / r) * nr);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export class Character {
  constructor({
    robeColor = 0xcbb489,
    accentColor = 0xc9a44c,
    skinColor = 0xd8b48c,
    height = 1.75,
    headwear = null, // null | 'ghutra' | 'kufi'
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
    this._s = s;

    // Proportions humaines réelles (homme ~7,5 têtes).
    const M = {
      shoulderY: 1.445 * s,
      shoulderW: 0.175 * s,   // demi-largeur d'épaules
      waistY: 1.02 * s,
      hipY: 0.92 * s,
      hemY: 0.10 * s,        // ourlet du qamis à la cheville
      headR: 0.098 * s,
      neckH: 0.05 * s,
      flatten: 0.62,          // section elliptique du corps
    };
    this._M = M;

    const robeMat = fabricMaterial(robeColor);
    const clothMat = fabricMaterial(headwearColor, { roughness: 0.8 });
    clothMat.side = THREE.DoubleSide;
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.15 });

    this._buildQamis(robeMat, robeColor, gender, M, s);
    this._buildLegsAndSandals(robeMat, skinMat, M, s);
    this._buildHeadAndNeck(skinMat, M, s);
    if (headwear === 'ghutra') this._buildGhutra(clothMat, M, s);
    else if (headwear === 'kufi') this._buildKufi(accentMat, M, s);
    if (gender === 'female') this._buildKhimar(fabricMaterial(robeColor), M, s);
    if (gender === 'male') this._buildBeard(M, s);
    this._buildArmsAndHands(robeMat, skinMat, M, s);

    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  // --- Qamis : lathe ample avec épaules tombantes + plis réels ------------
  _buildQamis(robeMat, robeColor, gender, M, s) {
    const profile = [
      [0.225 * s, M.hemY],
      [0.21 * s, 0.30 * s],
      [0.19 * s, 0.60 * s],
      [0.172 * s, M.hipY],
      [0.163 * s, M.waistY],
      [0.162 * s, 1.16 * s],
      [0.168 * s, 1.30 * s],
      [0.172 * s, 1.385 * s],
      [M.shoulderW, M.shoulderY - 0.025 * s],  // épaule
      [0.115 * s, M.shoulderY + 0.012 * s],    // trapèzes
      [0.062 * s, M.shoulderY + 0.03 * s],     // base du cou
    ].map(([r, y]) => new THREE.Vector2(r, y));

    const geo = new THREE.LatheGeometry(profile, 48);
    addVerticalFolds(geo, { foldCount: 9, amplitude: 0.007 * s, topY: M.waistY, bottomY: M.hemY });
    const qamis = new THREE.Mesh(geo, robeMat);
    qamis.scale.z = M.flatten;
    this.root.add(qamis);
    this.body = qamis;

    if (gender === 'male') {
      // Col officier + patte de boutonnage + boutons + coutures.
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068 * s, 0.073 * s, 0.038 * s, 24, 1, true),
        robeMat,
      );
      collar.scale.z = 0.85;
      collar.position.y = M.shoulderY + 0.022 * s;
      this.root.add(collar);

      const seamColor = new THREE.Color(robeColor).multiplyScalar(0.8);
      const seamMat = new THREE.MeshStandardMaterial({ color: seamColor, roughness: 0.85 });

      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.34 * s, 0.004 * s), robeMat);
      placket.position.set(0, M.shoulderY - 0.16 * s, 0.104 * s);
      placket.rotation.x = -0.06;
      this.root.add(placket);

      for (let i = 0; i < 3; i++) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.006 * s, 8, 8), seamMat);
        button.position.set(0, M.shoulderY - 0.05 * s - i * 0.09 * s, 0.109 * s - i * 0.004 * s);
        this.root.add(button);
      }

      // Couture centrale sous la patte, jusqu'à l'ourlet.
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.005 * s, 1.0 * s), seamMat);
      seam.position.set(0, 0.62 * s, 0.126 * s);
      seam.rotation.x = -0.045;
      this.root.add(seam);

      // Poche de poitrine.
      const pocket = new THREE.Mesh(new THREE.PlaneGeometry(0.055 * s, 0.062 * s), seamMat);
      pocket.position.set(-0.068 * s, 1.245 * s, 0.102 * s);
      pocket.rotation.x = -0.05;
      this.root.add(pocket);
    }
  }

  // --- Jambes, pieds réalistes, sandales semelle + brides -----------------
  _buildLegsAndSandals(robeMat, skinMat, M, s) {
    const legH = M.hemY * 0.92;
    const legGeo = new THREE.CylinderGeometry(0.037 * s, 0.033 * s, legH, 12);
    legGeo.translate(0, -legH / 2, 0);

    const soleTex = leatherTexture();
    const soleMat = new THREE.MeshStandardMaterial({ map: soleTex, roughness: 0.9 });
    const strapMat = new THREE.MeshStandardMaterial({ map: soleTex, color: 0xb98f60, roughness: 0.8 });

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, sideX] of [[this.legL, -1], [this.legR, 1]]) {
      leg.position.set(sideX * 0.072 * s, M.hemY, 0);
      const shin = new THREE.Mesh(legGeo.clone(), robeMat);
      leg.add(shin);

      // Pied : cou-de-pied + avant-pied.
      const foot = new THREE.Group();
      foot.position.y = -legH;
      const instep = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 10, 8), skinMat);
      instep.scale.set(1.05, 0.62, 1.5);
      instep.position.set(0, 0.018 * s, 0.02 * s);
      foot.add(instep);
      const toes = new THREE.Mesh(new THREE.SphereGeometry(0.026 * s, 10, 8), skinMat);
      toes.scale.set(1.25, 0.45, 1.0);
      toes.position.set(0, 0.008 * s, 0.062 * s);
      foot.add(toes);

      // Sandale : semelle profilée + bride en Y + passant arrière.
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.078 * s, 0.016 * s, 0.165 * s), soleMat);
      sole.position.set(0, -0.002 * s, 0.028 * s);
      foot.add(sole);
      const soleFront = new THREE.Mesh(new THREE.CylinderGeometry(0.039 * s, 0.039 * s, 0.016 * s, 10, 1, false, 0, Math.PI), soleMat);
      soleFront.rotation.z = Math.PI / 2;
      soleFront.rotation.y = Math.PI / 2;
      soleFront.position.set(0, -0.002 * s, 0.11 * s);
      foot.add(soleFront);

      const strapA = new THREE.Mesh(new THREE.BoxGeometry(0.075 * s, 0.008 * s, 0.014 * s), strapMat);
      strapA.position.set(0, 0.02 * s, 0.045 * s);
      strapA.rotation.x = 0.25;
      foot.add(strapA);
      const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.01 * s, 0.008 * s, 0.05 * s), strapMat);
      strapB.position.set(0, 0.024 * s, 0.075 * s);
      strapB.rotation.x = -0.35;
      foot.add(strapB);

      leg.add(foot);
      this.root.add(leg);
    }
  }

  // --- Cou + tête sans visage (ovale lisse) -------------------------------
  _buildHeadAndNeck(skinMat, M, s) {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046 * s, 0.056 * s, M.neckH, 16),
      skinMat,
    );
    neck.position.y = M.shoulderY + M.neckH / 2 + 0.008 * s;
    this.root.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.y = M.shoulderY + M.neckH + M.headR * 0.92;

    const head = new THREE.Mesh(new THREE.SphereGeometry(M.headR, 28, 24), skinMat);
    head.scale.set(0.92, 1.12, 0.98);
    headGroup.add(head);

    // Mâchoire légèrement dessinée (le visage reste totalement lisse).
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(M.headR * 0.72, 16, 12), skinMat);
    jaw.scale.set(0.85, 0.75, 0.9);
    jaw.position.set(0, -M.headR * 0.45, M.headR * 0.1);
    headGroup.add(jaw);

    this.root.add(headGroup);
    this.head = headGroup;
  }

  // --- Ghutra : dôme ondulé + pans drapés + V arrière + agal 3D -----------
  _buildGhutra(clothMat, M, s) {
    const headGroup = this.head;
    const headR = M.headR;

    // Kufi blanc visible sous la ghutra.
    const kufiMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, map: fabricTexture(), roughness: 0.8 });
    const kufi = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.88, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      kufiMat,
    );
    kufi.position.y = headR * 0.34;
    headGroup.add(kufi);

    // Calotte de la ghutra : posée sur le crâne, le visage reste dégagé.
    const capGeo = new THREE.SphereGeometry(headR * 1.12, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const cap = new THREE.Mesh(capGeo, clothMat);
    cap.position.y = headR * 0.22;
    headGroup.add(cap);

    // Jupe de tissu : couvre uniquement les côtés et l'arrière de la tête,
    // tombe vers les épaules avec un bord ondulé — le visage reste ouvert.
    const skirtGeo = new THREE.SphereGeometry(headR * 1.16, 28, 14, 0, Math.PI * 1.44, Math.PI * 0.3, Math.PI * 0.52);
    const sp = skirtGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      if (y < headR * 0.15) {
        const x = sp.getX(i);
        const z = sp.getZ(i);
        const ang = Math.atan2(z, x);
        const spread = 1 + (headR * 0.15 - y) / headR * 0.22;
        const wave = 1 + Math.sin(ang * 6 + 0.4) * 0.05;
        sp.setX(i, x * spread * wave);
        sp.setZ(i, z * spread * wave);
        sp.setY(i, y + Math.sin(ang * 4) * headR * 0.04);
      }
    }
    skirtGeo.computeVertexNormals();
    const skirt = new THREE.Mesh(skirtGeo, clothMat);
    // La découpe (Math.PI*1.44) laisse une ouverture : on la tourne vers
    // l'avant pour dégager le visage.
    skirt.rotation.y = Math.PI / 2 + (Math.PI * 2 - Math.PI * 1.44) / 2;
    skirt.position.y = headR * 0.2;
    headGroup.add(skirt);

    // Agal : véritable objet 3D indépendant — double anneau noir + cordons.
    const agalGroup = new THREE.Group();
    const agalMat = new THREE.MeshStandardMaterial({ color: 0x0d0a07, roughness: 0.5 });
    for (const [ry, tilt] of [[headR * 0.62, 0.06], [headR * 0.48, -0.04]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(headR * 1.02, headR * 0.07, 12, 36), agalMat);
      ring.rotation.x = Math.PI / 2 + tilt;
      ring.position.y = ry;
      agalGroup.add(ring);
    }
    // Cordons qui pendent à l'arrière de l'agal, terminés par des pompons.
    for (const xSign of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.02, headR * 0.02, headR * 0.9, 6), agalMat);
      cord.position.set(xSign * headR * 0.22, headR * 0.05, -headR * 0.95);
      cord.rotation.x = 0.28;
      agalGroup.add(cord);
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.05, headR * 0.14, 8), agalMat);
      tassel.position.set(xSign * headR * 0.22, -headR * 0.42, -headR * 1.08);
      agalGroup.add(tassel);
    }
    headGroup.add(agalGroup);

    // Retombée sur les épaules (cape courte, section elliptique).
    const drape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082 * s, 0.19 * s, 0.19 * s, 28, 3, true),
      clothMat,
    );
    const drp = drape.geometry.attributes.position;
    for (let i = 0; i < drp.count; i++) {
      const y = drp.getY(i);
      if (y < -0.05 * s) {
        const x = drp.getX(i);
        const z = drp.getZ(i);
        const ang = Math.atan2(z, x);
        const wave = 1 + Math.sin(ang * 6 + 1.1) * 0.05;
        drp.setX(i, x * wave);
        drp.setZ(i, z * wave);
        drp.setY(i, y + Math.sin(ang * 4 + 0.4) * 0.012 * s);
      }
    }
    drape.geometry.computeVertexNormals();
    drape.scale.z = 0.74;
    drape.position.y = M.shoulderY + 0.03 * s;
    this.root.add(drape);

    // Deux pans qui tombent sur la poitrine (strips incurvés, bord libre),
    // décollés du torse pour ne jamais traverser le tissu du qamis.
    for (const xSign of [-1, 1]) {
      const panGeo = new THREE.PlaneGeometry(0.075 * s, 0.22 * s, 4, 9);
      const pp = panGeo.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const y = pp.getY(i);
        const x = pp.getX(i);
        const t = (0.11 * s - y) / (0.22 * s); // 0 en haut, 1 en bas
        // Le pan s'écarte du corps en tombant + ondulation du bord.
        pp.setZ(i, t * 0.028 * s + Math.sin(x * 70 + y * 30) * 0.004 * s);
      }
      panGeo.computeVertexNormals();
      const pan = new THREE.Mesh(panGeo, clothMat);
      pan.position.set(xSign * 0.07 * s, M.shoulderY - 0.12 * s, 0.118 * s);
      pan.rotation.y = xSign * 0.1;
      pan.rotation.x = -0.08;
      this.root.add(pan);
    }

    // Pointe arrière en V, bombée vers l'extérieur (jamais dans le dos).
    const backGeo = new THREE.PlaneGeometry(0.17 * s, 0.17 * s, 6, 6);
    const bp = backGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i);
      const y = bp.getY(i);
      bp.setZ(i, -((Math.abs(x) + Math.abs(y)) * 0.16) - Math.sin(x * 40) * 0.003 * s);
    }
    backGeo.computeVertexNormals();
    const backDrape = new THREE.Mesh(backGeo, clothMat);
    backDrape.position.set(0, M.shoulderY - 0.12 * s, -0.128 * s);
    backDrape.rotation.z = Math.PI / 4;
    backDrape.rotation.x = 0.14;
    this.root.add(backDrape);
    this._backDrape = backDrape;
  }

  _buildKufi(accentMat, M, s) {
    const headR = M.headR;
    const capSide = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.78, headR * 0.82, headR * 0.46, 24, 1, true),
      accentMat,
    );
    capSide.position.y = headR * 0.4;
    this.head.add(capSide);
    const capTop = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.78, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      accentMat,
    );
    capTop.position.y = headR * 0.62;
    this.head.add(capTop);
  }

  // --- Khimar féminin : voile couvrant tête, épaules et poitrine ----------
  _buildKhimar(khimarMat, M, s) {
    khimarMat.side = THREE.DoubleSide;
    const headR = M.headR;
    const covering = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.12, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
      khimarMat,
    );
    covering.position.y = headR * 0.08;
    this.head.add(covering);

    const cape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * s, 0.24 * s, 0.42 * s, 28, 4, true),
      khimarMat,
    );
    const cp = cape.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      if (y < -0.1 * s) {
        const x = cp.getX(i);
        const z = cp.getZ(i);
        const ang = Math.atan2(z, x);
        const wave = 1 + Math.sin(ang * 5 + 0.8) * 0.05;
        cp.setX(i, x * wave);
        cp.setZ(i, z * wave);
      }
    }
    cape.geometry.computeVertexNormals();
    cape.scale.z = 0.78;
    cape.position.y = M.shoulderY - 0.02 * s;
    this.root.add(cape);
  }

  // --- Barbe discrète et naturelle (menton/mâchoire) ----------------------
  _buildBeard(M, s) {
    const headR = M.headR;
    const beardMat = new THREE.MeshStandardMaterial({
      color: 0x241a12,
      roughness: 0.98,
      bumpMap: fabricTexture(),
      bumpScale: 0.5,
    });
    const beard = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.58, 18, 14), beardMat);
    beard.position.set(0, -headR * 0.88, headR * 0.42);
    beard.scale.set(1.08, 1.15, 0.7);
    this.head.add(beard);

    const beardTip = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.3, headR * 0.5, 12), beardMat);
    beardTip.position.set(0, -headR * 1.55, headR * 0.44);
    beardTip.rotation.x = Math.PI;
    this.head.add(beardTip);

    const mustache = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.045, headR * 0.045, headR * 0.4, 8), beardMat);
    mustache.rotation.z = Math.PI / 2;
    mustache.position.set(0, -headR * 0.48, headR * 0.85);
    this.head.add(mustache);
  }

  // --- Bras deux segments + mains à cinq doigts ---------------------------
  _buildArmsAndHands(robeMat, skinMat, M, s) {
    const upperLen = 0.27 * s;
    const foreLen = 0.24 * s;

    const upperGeo = new THREE.CylinderGeometry(0.036 * s, 0.042 * s, upperLen, 14);
    upperGeo.translate(0, -upperLen / 2, 0);
    const foreGeo = new THREE.CylinderGeometry(0.042 * s, 0.048 * s, foreLen, 14);
    foreGeo.translate(0, -foreLen / 2, 0);

    const buildHand = (xSign) => {
      const hand = new THREE.Group();
      // Paume.
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 12, 10), skinMat);
      palm.scale.set(0.9, 1.25, 0.5);
      hand.add(palm);
      // Quatre doigts (capsules) qui prolongent la paume vers le bas.
      for (let f = 0; f < 4; f++) {
        const fingerLen = [0.042, 0.05, 0.046, 0.036][f] * s;
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0058 * s, fingerLen, 3, 8), skinMat);
        finger.position.set((f - 1.5) * 0.0125 * s, -0.036 * s - fingerLen / 2, 0.002 * s);
        finger.rotation.x = 0.1;
        hand.add(finger);
      }
      // Pouce, écarté vers l'avant.
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062 * s, 0.032 * s, 3, 8), skinMat);
      thumb.position.set(xSign * -0.026 * s, -0.012 * s, 0.012 * s);
      thumb.rotation.z = xSign * 0.7;
      thumb.rotation.x = 0.35;
      hand.add(thumb);
      return hand;
    };

    const buildArm = (xSign) => {
      const arm = new THREE.Group(); // pivot épaule
      arm.position.set(xSign * (M.shoulderW + 0.012 * s), M.shoulderY - 0.01 * s, 0);

      const upper = new THREE.Mesh(upperGeo.clone(), robeMat);
      arm.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -upperLen;
      elbow.rotation.x = -0.14; // léger pli naturel du coude
      arm.add(elbow);

      const fore = new THREE.Mesh(foreGeo.clone(), robeMat);
      elbow.add(fore);

      // Manchette (l'ourlet de la manche, un peu plus large).
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052 * s, 0.056 * s, 0.035 * s, 14, 1, true), robeMat);
      cuff.position.y = -foreLen + 0.01 * s;
      elbow.add(cuff);

      const hand = buildHand(xSign);
      hand.position.y = -foreLen - 0.028 * s;
      elbow.add(hand);

      arm.userData.elbow = elbow;
      arm.userData.hand = hand;
      return arm;
    };

    this.armL = buildArm(-1);
    this.armR = buildArm(1);
    this.root.add(this.armL, this.armR);

    this._restArmRot = -0.04;
    this.armL.rotation.x = this._restArmRot;
    this.armR.rotation.x = this._restArmRot;
    this.armL.rotation.z = 0.075;
    this.armR.rotation.z = -0.075;
  }

  // --- API publique (inchangée pour Player/NPC/scènes) --------------------

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

  // Salutation pudique : main droite portée au cœur + légère inclinaison.
  playGreet() {
    this.setState('greet');
    this._gestureDuration = 2.2;
    this._gestureTimer = 0;
  }

  playTeach() {
    this.setState('teach');
    this._gestureDuration = 1.8;
    this._gestureTimer = 0;
  }

  update(dt, { moving = false } = {}) {
    this._animT += dt;

    if (this._state === 'greet') {
      this._gestureTimer += dt;
      const t = Math.min(this._gestureTimer / 0.45, 1);
      const holdEnd = this._gestureDuration - 0.5;
      let k;
      if (this._gestureTimer < 0.45) k = t * t * (3 - 2 * t); // easing
      else if (this._gestureTimer < holdEnd) k = 1;
      else k = Math.max(0, 1 - (this._gestureTimer - holdEnd) / 0.5);

      // Main droite sur le cœur, coude plié, tête légèrement inclinée.
      this.armR.rotation.x = this._restArmRot - k * 0.75;
      this.armR.rotation.z = -0.075 - k * 0.35;
      this.armR.userData.elbow.rotation.x = -0.14 - k * 1.45;
      this.head.rotation.x = k * 0.14;
      this.body.rotation.x = k * 0.045;
      if (this._gestureTimer >= this._gestureDuration) {
        this.armR.userData.elbow.rotation.x = -0.14;
        this.body.rotation.x = 0;
        this.setState('idle');
      }
      return;
    }

    if (this._state === 'teach') {
      this._gestureTimer += dt;
      const wave = Math.sin(this._gestureTimer * 3.0) * 0.3;
      this.armR.rotation.x = this._restArmRot - 0.9 + wave * 0.25;
      this.armR.rotation.z = -0.075 - 0.3 - wave * 0.15;
      this.armR.userData.elbow.rotation.x = -0.5 + wave * 0.2;
      this.head.rotation.y = Math.sin(this._gestureTimer * 1.1) * 0.12;
      if (this._gestureTimer >= this._gestureDuration) {
        this.armR.userData.elbow.rotation.x = -0.14;
        this.setState('idle');
      }
      return;
    }

    if (moving) {
      const cycle = this._animT * 7.2;
      const swing = Math.sin(cycle);
      // Bras : balancement opposé aux jambes, coude qui accompagne.
      this.armL.rotation.x = this._restArmRot + swing * 0.45;
      this.armR.rotation.x = this._restArmRot - swing * 0.45;
      this.armL.userData.elbow.rotation.x = -0.14 - Math.max(0, swing) * 0.25;
      this.armR.userData.elbow.rotation.x = -0.14 - Math.max(0, -swing) * 0.25;
      // Jambes.
      this.legL.rotation.x = swing * 0.4;
      this.legR.rotation.x = -swing * 0.4;
      // Corps : rebond léger + roulis + le qamis suit le mouvement.
      this.root.position.y = Math.abs(swing) * 0.018;
      this.body.rotation.y = Math.sin(cycle * 0.5) * 0.025;
      this.body.rotation.z = Math.sin(cycle) * 0.012;
      this.head.rotation.y = Math.sin(cycle * 0.5) * 0.035;
      if (this._backDrape) this._backDrape.rotation.x = 0.16 + Math.sin(cycle * 0.9) * 0.06;
    } else {
      // Respiration calme, retour progressif au repos.
      const breathe = Math.sin(this._animT * 1.3) * 0.008;
      this.body.scale.y = 1 + breathe;
      this.armL.rotation.x += (this._restArmRot - this.armL.rotation.x) * Math.min(1, 8 * dt);
      this.armR.rotation.x += (this._restArmRot - this.armR.rotation.x) * Math.min(1, 8 * dt);
      this.armL.rotation.z += (0.075 - this.armL.rotation.z) * Math.min(1, 8 * dt);
      this.armR.rotation.z += (-0.075 - this.armR.rotation.z) * Math.min(1, 8 * dt);
      this.legL.rotation.x *= 0.88;
      this.legR.rotation.x *= 0.88;
      this.root.position.y = 0;
      this.head.rotation.y *= 0.92;
      this.head.rotation.x *= 0.92;
      this.body.rotation.y *= 0.92;
      this.body.rotation.z *= 0.92;
      if (this._backDrape) this._backDrape.rotation.x += (0.16 - this._backDrape.rotation.x) * Math.min(1, 4 * dt);
    }
  }
}

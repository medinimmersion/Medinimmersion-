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

    // Proportions humaines réelles (homme ~7,5 têtes), qamis droit
    // conforme à l'image de référence : épaules naturelles, chute droite.
    const M = {
      shoulderY: 1.445 * s,
      shoulderW: 0.195 * s,   // demi-largeur d'épaules
      waistY: 1.02 * s,
      hipY: 0.92 * s,
      hemY: 0.10 * s,        // ourlet du qamis à la cheville
      headR: 0.098 * s,
      neckH: 0.05 * s,
      flatten: 0.6,           // section elliptique du corps
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
    // Chute droite comme sur la référence : largeur quasi constante des
    // épaules à l'ourlet, très léger cintrage à la taille.
    const profile = [
      [0.195 * s, M.hemY],
      [0.19 * s, 0.35 * s],
      [0.183 * s, 0.70 * s],
      [0.176 * s, M.hipY],
      [0.172 * s, M.waistY],
      [0.174 * s, 1.18 * s],
      [0.181 * s, 1.30 * s],
      [0.187 * s, 1.365 * s],
    ].map(([r, y]) => new THREE.Vector2(r, y));

    // Épaule HUMAINE : arc convexe continu du sommet du deltoïde jusqu'à
    // la base du cou — pente tombante naturelle, aucune cassure.
    const shoulderTipR = 0.185 * s;
    const shoulderTipY = M.shoulderY - 0.03 * s;
    const neckBaseY = M.shoulderY + 0.035 * s;
    const neckR = 0.058 * s;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = neckR + (shoulderTipR - neckR) * Math.pow(Math.cos(t * Math.PI / 2), 0.85);
      const y = shoulderTipY + (neckBaseY - shoulderTipY) * Math.pow(Math.sin(t * Math.PI / 2), 1.7);
      profile.push(new THREE.Vector2(r, y));
    }

    const geo = new THREE.LatheGeometry(profile, 64);
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

  // --- Ghutra conforme à l'image de référence : kufi brodé qui dépasse en
  // haut, agal noir épais, tissu qui encadre le visage en V et tombe en
  // longs pans triangulaires devant les épaules, grand triangle pointu
  // dans le dos jusqu'au milieu du dos. -------------------------------------
  _buildGhutra(clothMat, M, s) {
    const headGroup = this.head;
    const headR = M.headR;

    // Kufi blanc brodé : dépasse AU-DESSUS de l'agal (sommet visible).
    const kufiMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: fabricTexture(),
      bumpMap: fabricTexture(),
      bumpScale: 0.6,
      roughness: 0.75,
    });
    const kufi = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.04, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.34),
      kufiMat,
    );
    kufi.position.y = headR * 0.28;
    headGroup.add(kufi);

    // Tissu de la ghutra sur le crâne : bande complète sous le kufi qui
    // couvre le front — le visage (sans traits) commence sous le tissu.
    const bandGeo = new THREE.SphereGeometry(headR * 1.1, 28, 10, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.34);
    const band = new THREE.Mesh(bandGeo, clothMat);
    band.position.y = headR * 0.16;
    headGroup.add(band);

    // Agal : double anneau noir épais — objet 3D indépendant.
    const agalMat = new THREE.MeshStandardMaterial({ color: 0x0c0906, roughness: 0.45 });
    for (const [ry, tilt] of [[headR * 0.56, 0.05], [headR * 0.42, -0.035]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(headR * 1.06, headR * 0.085, 12, 40), agalMat);
      ring.rotation.x = Math.PI / 2 + tilt;
      ring.position.y = ry;
      headGroup.add(ring);
    }

    // Voile de la ghutra : UNE seule pièce conique qui tombe de la tête
    // jusqu'à la poitrine — ouverte devant le visage, pointes qui pendent
    // plus bas devant les épaules et dans le dos (drapé de la référence).
    const veilH = 0.42 * s;
    const gap = Math.PI * 0.5; // ouverture faciale (90°), centrée devant
    const veilGeo = new THREE.CylinderGeometry(
      headR * 1.08, 0.2 * s, veilH, 36, 6, true,
      gap / 2, Math.PI * 2 - gap,
    );
    const vp = veilGeo.attributes.position;
    const vHalf = veilH / 2;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i);
      const y = vp.getY(i);
      const z = vp.getZ(i);
      const ang = Math.atan2(x, z); // 0 = devant (+z)
      const t = (vHalf - y) / veilH; // 0 haut → 1 bas
      // Les bords libres de l'ouverture (devant) et l'axe arrière pendent
      // plus bas : pointes du tissu.
      const edgeDist = Math.min(Math.abs(ang - gap / 2), Math.abs(ang + gap / 2));
      const frontPoint = Math.max(0, 1 - edgeDist / 0.7) * 0.11 * s;
      const backPoint = Math.max(0, 1 - Math.abs(Math.abs(ang) - Math.PI) / 0.9) * 0.13 * s;
      vp.setY(i, y - (frontPoint + backPoint) * t);
      // Ondulation légère du tissu.
      const wave = 1 + Math.sin(ang * 6 + 0.5) * 0.03 * t;
      vp.setX(i, x * wave);
      vp.setZ(i, z * wave);
    }
    veilGeo.computeVertexNormals();
    const veil = new THREE.Mesh(veilGeo, clothMat);
    // Section elliptique : étroit sur les côtés (les bras restent libres),
    // profond devant/derrière pour les pointes.
    veil.scale.set(0.85, 1, 1);
    veil.position.y = -vHalf + headR * 0.45;
    headGroup.add(veil);
    this._backDrape = veil;
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

  // --- Barbe longue et fournie (conforme à l'image de référence) ----------
  _buildBeard(M, s) {
    const headR = M.headR;
    const beardMat = new THREE.MeshStandardMaterial({
      color: 0x1e150e,
      roughness: 0.98,
      bumpMap: fabricTexture(),
      bumpScale: 0.7,
    });

    // Masse principale : devant les joues et le menton, en RELIEF sur le
    // visage (jamais enfoncée dedans).
    const beard = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.6, 20, 16), beardMat);
    beard.position.set(0, -headR * 1.0, headR * 0.45);
    beard.scale.set(0.95, 1.15, 0.8);
    this.head.add(beard);

    // Longueur : la barbe descend en s'arrondissant jusqu'au haut de la
    // poitrine, légèrement plus étroite en bas.
    const beardLow = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.46, 18, 14), beardMat);
    beardLow.position.set(0, -headR * 1.75, headR * 0.42);
    beardLow.scale.set(0.8, 1.05, 0.65);
    this.head.add(beardLow);

    // Moustache au-dessus de la masse.
    const mustache = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.28, 12, 8), beardMat);
    mustache.position.set(0, -headR * 0.62, headR * 0.82);
    mustache.scale.set(1.15, 0.4, 0.5);
    this.head.add(mustache);
  }

  // --- Bras deux segments + mains à cinq doigts ---------------------------
  _buildArmsAndHands(robeMat, skinMat, M, s) {
    const upperLen = 0.27 * s;
    const foreLen = 0.24 * s;

    // Manches amples : larges à la racine (elles émergent de la pente de
    // l'épaule) et s'élargissant doucement vers la manchette.
    const upperGeo = new THREE.CylinderGeometry(0.052 * s, 0.046 * s, upperLen, 14);
    upperGeo.translate(0, -upperLen / 2, 0);
    const foreGeo = new THREE.CylinderGeometry(0.046 * s, 0.05 * s, foreLen, 14);
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
      const arm = new THREE.Group(); // pivot sous l'épaule, manche dans la pente
      arm.position.set(xSign * 0.168 * s, M.shoulderY - 0.02 * s, 0);

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

    // Bras le long du corps, mains près des cuisses (référence).
    this._restArmRot = -0.04;
    this._restArmZ = 0.055;
    this.armL.rotation.x = this._restArmRot;
    this.armR.rotation.x = this._restArmRot;
    this.armL.rotation.z = this._restArmZ;
    this.armR.rotation.z = -this._restArmZ;
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
      this.armR.rotation.z = -this._restArmZ - k * 0.3;
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
      this.armR.rotation.z = -this._restArmZ - 0.3 - wave * 0.15;
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
      this.armL.rotation.z += (this._restArmZ - this.armL.rotation.z) * Math.min(1, 8 * dt);
      this.armR.rotation.z += (-this._restArmZ - this.armR.rotation.z) * Math.min(1, 8 * dt);
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

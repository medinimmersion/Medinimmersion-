import * as THREE from 'three';
import { PALETTE } from './environment.js';
import { stoneTexture, woodTexture, moucharabiehAlphaTexture, signboardTexture } from './textures.js';

// Reusable structural pieces shared by every scene, styled per Document 002
// (Direction Artistique): warm stone, dark carved wood, brass fittings,
// moucharabieh lattice windows. Kept geometrically simple (boxes/cylinders)
// per the brief — "tu peux utiliser des formes simplifiées" — while still
// reading as intentional architecture rather than a grey-box.

let _stoneMat = null;
export function stoneMaterial() {
  if (!_stoneMat) {
    _stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.92, metalness: 0.02 });
  }
  return _stoneMat;
}

let _woodMat = null;
export function woodMaterial() {
  if (!_woodMat) {
    _woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75, metalness: 0.05 });
  }
  return _woodMat;
}

export function brassMaterial() {
  return new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.35, metalness: 0.85 });
}

export function wallSegment({ width = 4, height = 4, depth = 0.4, material = stoneMaterial() } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function column({ height = 4, radius = 0.22 } = {}) {
  const group = new THREE.Group();
  const mat = stoneMaterial();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height * 0.82, 16), mat);
  shaft.position.y = height * 0.1 + height * 0.41;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.45, height * 0.1, 16), mat);
  base.position.y = height * 0.05;
  base.castShadow = true;
  group.add(base);
  const capitalH = height * 0.08;
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.5, radius * 0.95, capitalH, 16), mat);
  capital.position.y = height - capitalH / 2;
  capital.castShadow = true;
  group.add(capital);
  const abacus = new THREE.Mesh(new THREE.BoxGeometry(radius * 3, height * 0.03, radius * 3), mat);
  abacus.position.y = height;
  group.add(abacus);
  return group;
}

// A carved wood door mounted on a hinge pivot so it can swing open smoothly
// (Document 034: "les portes s'ouvrent avec une animation").
export function woodenDoor({ width = 1.1, height = 2.4 } = {}) {
  const pivot = new THREE.Group();
  const doorMat = woodMaterial();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), doorMat);
  panel.position.x = width / 2;
  panel.position.y = height / 2;
  panel.castShadow = true;
  pivot.add(panel);

  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), brassMaterial());
  handle.position.set(width - 0.12, height / 2, 0.07);
  pivot.add(handle);

  pivot.userData.open = false;
  pivot.userData.setOpen = (open) => {
    pivot.userData.open = open;
    pivot.userData.targetRotation = open ? -Math.PI / 2 : 0;
  };
  pivot.userData.targetRotation = 0;
  pivot.userData.update = (dt) => {
    const target = pivot.userData.targetRotation;
    pivot.rotation.y += (target - pivot.rotation.y) * Math.min(1, dt * 2.5);
  };

  return pivot;
}

export function archDoorway({ width = 1.6, height = 2.6, depth = 0.4, horseshoe = true } = {}) {
  const group = new THREE.Group();
  const mat = stoneMaterial();
  const sideW = 0.35;
  const pillarH = height * 0.7;
  const left = new THREE.Mesh(new THREE.BoxGeometry(sideW, pillarH, depth), mat);
  left.position.set(-width / 2 - sideW / 2, pillarH / 2, 0);
  const right = left.clone();
  right.position.x = width / 2 + sideW / 2;
  [left, right].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  group.add(left, right);

  const archR = width / 2 + sideW;
  const archSegments = 20;
  const archMat = stoneMaterial();
  for (let i = 0; i <= archSegments; i++) {
    const angle = (i / archSegments) * Math.PI;
    const x = Math.cos(angle) * archR;
    const y = pillarH + Math.sin(angle) * archR * (horseshoe ? 0.55 : 0.5);
    const blockW = (Math.PI * archR) / archSegments + 0.02;
    const block = new THREE.Mesh(new THREE.BoxGeometry(blockW, 0.18, depth), archMat);
    block.position.set(-x, y, 0);
    block.rotation.z = angle - Math.PI / 2;
    block.castShadow = true;
    group.add(block);
  }

  const keystoneGeo = new THREE.BoxGeometry(0.22, 0.28, depth + 0.02);
  const keystone = new THREE.Mesh(keystoneGeo, archMat);
  keystone.position.y = pillarH + archR * (horseshoe ? 0.55 : 0.5);
  keystone.castShadow = true;
  group.add(keystone);

  return group;
}

export function moucharabiehWindow({ width = 1.2, height = 1.6 } = {}) {
  const group = new THREE.Group();
  const frameMat = woodMaterial();
  const frameThickness = 0.08;
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, 0.1), frameMat);
  top.position.y = height / 2;
  const bottom = top.clone();
  bottom.position.y = -height / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height, 0.1), frameMat);
  left.position.x = -width / 2;
  const right = left.clone();
  right.position.x = width / 2;
  group.add(top, bottom, left, right);

  const latticeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.woodDark,
    alphaMap: moucharabiehAlphaTexture(),
    transparent: true,
    roughness: 0.7,
  });
  const lattice = new THREE.Mesh(new THREE.PlaneGeometry(width - frameThickness, height - frameThickness), latticeMat);
  group.add(lattice);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function palmTree({ height = 4.5 } = {}) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, height, 8), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = 0.03;
  trunk.castShadow = true;
  group.add(trunk);

  const frondMat = new THREE.MeshStandardMaterial({ color: PALETTE.olive, roughness: 0.85, side: THREE.DoubleSide });
  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.9, 4, 1, true), frondMat);
    frond.position.y = height;
    frond.rotation.z = Math.PI / 2.3;
    frond.rotation.y = (i / frondCount) * Math.PI * 2;
    frond.position.x = Math.cos((i / frondCount) * Math.PI * 2) * 0.5;
    frond.position.z = Math.sin((i / frondCount) * Math.PI * 2) * 0.5;
    frond.castShadow = true;
    group.add(frond);
  }
  return group;
}

export function lantern({ lit = true } = {}) {
  const group = new THREE.Group();
  const bodyMat = brassMaterial();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffdd99,
    emissive: lit ? 0xffb04d : 0x000000,
    emissiveIntensity: lit ? 1.4 : 0,
    transparent: true,
    opacity: 0.85,
  });
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8, 1, true), bodyMat);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8), glassMat);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 8), bodyMat);
  cap.position.y = 0.15;
  group.add(cage, glass, cap);
  if (lit) {
    const light = new THREE.PointLight(0xffb673, 1.1, 4, 2);
    group.add(light);
  }
  return group;
}

// A soft, additive-blended cone of warm light standing in for a sunbeam
// through a window — cheap, no volumetric lighting pipeline needed, but it
// reads immediately as "warm afternoon light" (Document 002 ambiance).
export function lightShaft({ length = 4, radiusTop = 0.15, radiusBottom = 1.4, color = 0xffdd99, opacity = 0.16 } = {}) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -length / 2;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return pivot;
}

export function signboard({ label, letterAr = '', bg = PALETTE.wood, fg = PALETTE.stoneLight } = {}) {
  const tex = signboardTexture(label, { bg: `#${bg.toString(16).padStart(6, '0')}`, fg: `#${fg.toString(16).padStart(6, '0')}`, letterAr });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), mat);
  mesh.castShadow = true;
  return mesh;
}

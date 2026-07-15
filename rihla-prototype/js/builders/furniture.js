import * as THREE from 'three';
import { PALETTE } from './environment.js';
import { woodMaterial, brassMaterial } from './architecture.js';
import { rugTexture } from './textures.js';

export function rug({ width = 3, depth = 2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  mesh.receiveShadow = true;
  return mesh;
}

export function desk({ width = 1.6, depth = 0.8, height = 0.78 } = {}) {
  const group = new THREE.Group();
  const mat = woodMaterial();
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), mat);
  top.position.y = height;
  const legGeo = new THREE.BoxGeometry(0.08, height, 0.08);
  const positions = [
    [-width / 2 + 0.08, height / 2, -depth / 2 + 0.08],
    [width / 2 - 0.08, height / 2, -depth / 2 + 0.08],
    [-width / 2 + 0.08, height / 2, depth / 2 - 0.08],
    [width / 2 - 0.08, height / 2, depth / 2 - 0.08],
  ];
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(x, y, z);
    group.add(leg);
  }
  group.add(top);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function bookshelf({ width = 1.4, height = 2.1, depth = 0.35, shelves = 4 } = {}) {
  const group = new THREE.Group();
  const mat = woodMaterial();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  frame.position.y = height / 2;
  group.add(frame);

  const bookColors = [0x7a3b3b, 0x36573f, 0x3a4f73, 0x8a6a2f, 0x5b3a26, 0x6b3f57];
  for (let s = 0; s < shelves; s++) {
    const y = 0.25 + s * ((height - 0.3) / shelves);
    let x = -width / 2 + 0.1;
    while (x < width / 2 - 0.1) {
      const bw = 0.04 + Math.random() * 0.05;
      const bh = 0.22 + Math.random() * 0.1;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, depth * 0.7),
        new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(Math.random() * bookColors.length)], roughness: 0.8 }),
      );
      book.position.set(x + bw / 2, y + bh / 2, 0);
      book.castShadow = true;
      group.add(book);
      x += bw + 0.01;
    }
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function armchair({ color = PALETTE.fabric } = {}) {
  const group = new THREE.Group();
  const fabricMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const woodMat = woodMaterial();

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.55), fabricMat);
  seat.position.y = 0.42;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.1), fabricMat);
  back.position.set(0, 0.7, -0.22);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.5), woodMat);
  armL.position.set(-0.3, 0.55, 0);
  const armR = armL.clone();
  armR.position.x = 0.3;
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
  const legPositions = [[-0.25, 0.2, -0.2], [0.25, 0.2, -0.2], [-0.25, 0.2, 0.2], [0.25, 0.2, 0.2]];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, y, z);
    group.add(leg);
  }
  group.add(seat, back, armL, armR);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function pottedPlant({ scale = 1 } = {}) {
  const group = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: PALETTE.stoneDark, roughness: 0.9 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.15 * scale, 0.28 * scale, 12), potMat);
  pot.position.y = 0.14 * scale;
  group.add(pot);

  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.olive, roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.55 * scale, 4), leafMat);
    leaf.position.set(0, 0.45 * scale, 0);
    leaf.rotation.z = (Math.random() - 0.5) * 0.9;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = 0.3;
    group.add(leaf);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

// Glass display case holding passports (Document 006). Kept abstract:
// a stack of small parchment-coloured rectangles behind glass.
export function passportCase() {
  const group = new THREE.Group();
  const frameMat = woodMaterial();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbcdff0, transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.35), frameMat);
  base.position.y = 0.75;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.33), glassMat);
  glass.position.y = 1.02;
  group.add(base, glass);

  const passportMat = new THREE.MeshStandardMaterial({ color: PALETTE.emerald, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.22), passportMat);
    p.position.set(-0.2 + i * 0.1, 0.79 + i * 0.022, 0);
    group.add(p);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function wallMap({ width = 1.3, height = 0.9 } = {}) {
  const group = new THREE.Group();
  const frameMat = woodMaterial();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.04), frameMat);
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 512;
  canvasEl.height = 356;
  const ctx = canvasEl.getContext('2d');
  ctx.fillStyle = '#e9dcbd';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.strokeStyle = '#8a6a2f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 300);
  for (let i = 0; i < 10; i++) {
    ctx.lineTo(60 + i * 42, 300 - Math.sin(i) * 60 - i * 8);
  }
  ctx.stroke();
  ctx.fillStyle = '#5b3a26';
  ctx.font = '20px Georgia';
  ctx.fillText('Le voyage vers Médine', 130, 40);
  const tex = new THREE.CanvasTexture(canvasEl);
  const mapMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mapMat);
  map.position.z = 0.03;
  group.add(frame, map);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function wickerBasket({ radius = 0.16, height = 0.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb08a4f, roughness: 1 });
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 0.85, height, 12, 4, true), mat);
  basket.castShadow = true;
  basket.receiveShadow = true;
  return basket;
}

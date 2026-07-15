import * as THREE from 'three';

// Shared palette lifted directly from Document 002 (Direction Artistique).
export const PALETTE = {
  stone: 0xd8c6a1,
  stoneDark: 0xa98f66,
  stoneLight: 0xe9dcbd,
  wood: 0x5b3a26,
  woodDark: 0x3a2416,
  woodLight: 0x7a5236,
  olive: 0x6b7a3a,
  sky: 0xbfe3f2,
  skyWarm: 0xe8c98f,
  emerald: 0x0f6b4c,
  gold: 0xc9a44c,
  sand: 0xe3cd9c,
  fabric: 0xcbb489,
  brass: 0xb08d3f,
};

// Warm morning/late-afternoon lighting rig, per Document 002 ("privilégier
// le matin et la fin d'après-midi... lumière douce, ombres naturelles").
export function addOutdoorLighting(root, { sunAzimuthDeg = 55, sunElevationDeg = 32 } = {}) {
  const hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.sand, 0.75);
  root.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe4b0, 2.1);
  const az = (sunAzimuthDeg * Math.PI) / 180;
  const el = (sunElevationDeg * Math.PI) / 180;
  const dist = 40;
  sun.position.set(Math.cos(az) * dist, Math.sin(el) * dist, Math.sin(az) * dist);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  sun.shadow.bias = -0.0015;
  root.add(sun);
  root.add(sun.target);

  const fill = new THREE.AmbientLight(0xfff2da, 0.25);
  root.add(fill);

  return { hemi, sun };
}

export function addIndoorLighting(root, { warmth = 0xffe0b0, intensity = 0.9 } = {}) {
  const hemi = new THREE.HemisphereLight(0xffecd2, PALETTE.woodDark, 0.55);
  root.add(hemi);

  const window1 = new THREE.DirectionalLight(warmth, intensity);
  window1.position.set(-6, 6, 3);
  window1.castShadow = true;
  window1.shadow.mapSize.set(2048, 2048);
  window1.shadow.camera.left = -12;
  window1.shadow.camera.right = 12;
  window1.shadow.camera.top = 12;
  window1.shadow.camera.bottom = -12;
  window1.shadow.bias = -0.001;
  root.add(window1);
  root.add(window1.target);

  const window2 = new THREE.DirectionalLight(0xffd89e, intensity * 0.45);
  window2.position.set(5, 5, -2);
  root.add(window2);

  const fill = new THREE.AmbientLight(0xfff0d4, 0.3);
  root.add(fill);

  return { hemi, window1 };
}

export function createSky(scene, color = PALETTE.sky, fogColor = color, fogNear = 18, fogFar = 90) {
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
}

export function createGround(size = 60, color = PALETTE.stone, { roughness = 0.95, map = null } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, map, roughness, metalness: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}


import * as THREE from 'three';

// Small procedural canvas textures so surfaces read as stone/wood/fabric
// instead of flat plastic-looking color, without shipping any binary asset.
// All of this is disposable placeholder detail — swap for photographed /
// hand-painted textures later without touching the builders that call these.

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function speckle(ctx, size, { base, spots, alpha = 0.08, count = 900, minR = 0.5, maxR = 2.2 }) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = minR + Math.random() * (maxR - minR);
    ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.8);
    ctx.fillStyle = spots[Math.floor(Math.random() * spots.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function stoneTexture({ base = '#d8c6a1', repeat = 4 } = {}) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  speckle(ctx, size, { base, spots: ['#c2ac80', '#e9dcbd', '#a98f66'], count: 1400 });
  // Faint mortar joints.
  ctx.strokeStyle = 'rgba(90,70,40,0.12)';
  ctx.lineWidth = 2;
  const rows = 6;
  for (let r = 0; r <= rows; r++) {
    const y = (size / rows) * r;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function woodTexture({ base = '#5b3a26', repeat = 2 } = {}) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(30,18,10,${0.06 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 20, size * 0.7, y + (Math.random() - 0.5) * 20, size, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function sandTexture({ base = '#e3cd9c', repeat = 8 } = {}) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  speckle(ctx, size, { base, spots: ['#d9bd82', '#f1e0b8', '#c9ac74'], count: 2200, alpha: 0.06, minR: 0.4, maxR: 1.4 });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Alpha-mapped lattice pattern for moucharabieh screens/windows.
export function moucharabiehAlphaTexture(size = 256, cell = 16) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-cell * 0.18, -cell * 0.42, cell * 0.36, cell * 0.84);
      ctx.fillRect(-cell * 0.42, -cell * 0.18, cell * 0.84, cell * 0.36);
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Two-tone polished limestone floor tiles (Document 034: "sol en pierre
// calcaire polie").
export function tileFloorTexture({ light = '#e9dcbd', dark = '#d3c19a', repeat = 6 } = {}) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const half = size / 2;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  ctx.strokeStyle = 'rgba(90,70,40,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A simple geometric-bordered rug, evoking traditional patterns without
// depicting anything figurative.
export function rugTexture({ base = '#7a2f2f', border = '#c9a44c', accent = '#2f4858' } = {}) {
  const size = 512;
  const c = canvas(size);
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = border;
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, size - 40, size - 40);
  ctx.lineWidth = 5;
  ctx.strokeRect(44, 44, size - 88, size - 88);
  ctx.fillStyle = accent;
  const cell = size / 8;
  for (let i = 0; i < 8; i++) {
    const cx = cell * i + cell / 2;
    ctx.save();
    ctx.translate(cx, 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.save();
    ctx.translate(cx, size - 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.strokeRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Simple painted signboard texture with carved-looking lettering.
export function signboardTexture(label, { bg = '#5b3a26', fg = '#e9dcbd', letterAr = '' } = {}) {
  const c = canvas(512);
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (letterAr) {
    ctx.font = '110px serif';
    ctx.fillText(letterAr, c.width / 2, c.height * 0.38);
  }
  ctx.font = 'bold 40px Georgia';
  ctx.fillText(label, c.width / 2, c.height * 0.78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

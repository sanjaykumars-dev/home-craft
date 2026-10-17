// Procedural PBR-ish textures painted on canvases, so the app needs no image assets.
import * as THREE from 'three';
import { seeded } from './catalog.js';

const SIZE = 512;
let maxAniso = 8;
export const setMaxAnisotropy = (n) => { maxAniso = n; };

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function grain(g, size, rnd, amount) {
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}
function blotches(g, size, rnd, count, col, rMin, rMax, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = rMin + rnd() * (rMax - rMin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', alpha * rnd())); gr.addColorStop(1, col.replace('A', 0));
    g.fillStyle = gr;
    // draw wrapped so the texture stays tileable
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
  }
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// Each definition: meters covered by one tile, whether user colour tints it, and surface params.
const DEFS = {
  grass: { m: 3, rough: 0.95, draw(g, r) {
    g.fillStyle = '#4f7d33'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, SIZE, r, 40, 'rgba(110,150,60,A)', 20, 70, 0.5);
    blotches(g, SIZE, r, 30, 'rgba(40,70,25,A)', 20, 60, 0.5);
    for (let i = 0; i < 9000; i++) {
      const x = r() * SIZE, y = r() * SIZE, h = 3 + r() * 7;
      g.strokeStyle = `hsl(${85 + r() * 30},${35 + r() * 25}%,${22 + r() * 25}%)`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - h); g.stroke();
    }
    grain(g, SIZE, r, 18);
  } },
  plaster: { m: 2, tint: true, rough: 0.92, bump: 0.6, draw(g, r) {
    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, SIZE, r, 50, 'rgba(0,0,0,A)', 20, 90, 0.04);
    grain(g, SIZE, r, 22);
  } },
  brick: { m: 1, rough: 0.9, bump: 2, draw(g, r) {
    const rows = 14, cols = 4, rh = SIZE / rows, cw = SIZE / cols;
    g.fillStyle = '#cbc2b3'; g.fillRect(0, 0, SIZE, SIZE);
    const pal = ['#9c4a33', '#a8553b', '#8f412d', '#b05e42', '#93503a', '#a14d36', '#7f3b29'];
    for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
      const ox = (y % 2) * cw / 2;
      g.fillStyle = shade(pick(r, pal), 0.9 + r() * 0.2);
      g.fillRect(x * cw + ox + 3, y * rh + 3, cw - 6, rh - 6);
    }
    blotches(g, SIZE, r, 60, 'rgba(0,0,0,A)', 5, 25, 0.12);
    grain(g, SIZE, r, 26);
  } },
  laterite: { m: 1.2, rough: 0.95, bump: 2.5, draw(g, r) {
    // Kerala laterite (vettukallu) blocks: porous red-brown stone with thin joints
    const rows = 6, cols = 3, h = SIZE / rows, w = SIZE / cols;
    g.fillStyle = '#c9b8a0'; g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
      g.fillStyle = shade(pick(r, ['#a6553a', '#b0603f', '#9c4d34', '#b86a46', '#a35a3d']), 0.9 + r() * 0.2);
      g.fillRect(x * w + (y % 2) * w / 2 + 3, y * h + 3, w - 6, h - 6);
    }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,25,15' : '220,170,120'},${0.2 + r() * 0.4})`; g.beginPath(); g.arc(r() * SIZE, r() * SIZE, 0.8 + r() * 2.2, 0, 7); g.fill(); }
    grain(g, SIZE, r, 26);
  } },
  stone: { m: 2, rough: 0.95, bump: 2.5, draw(g, r) {
    g.fillStyle = '#7d776d'; g.fillRect(0, 0, SIZE, SIZE);
    const pal = ['#a39b8c', '#b3a994', '#8f887c', '#c0b6a2', '#9a8f7b', '#aaa196'];
    let y = 0;
    while (y < SIZE) {
      const h = 30 + r() * 30; let x = -r() * 60;
      while (x < SIZE) {
        const w = 40 + r() * 70;
        g.fillStyle = pick(r, pal);
        g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, Math.min(h, SIZE - y) - 6, 6); g.fill();
        x += w;
      }
      y += h;
    }
    grain(g, SIZE, r, 30);
  } },
  siding: { m: 2, tint: true, rough: 0.8, bump: 1.5, draw(g, r) {
    const n = 12, bh = SIZE / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
      gr.addColorStop(0, '#fbfbfb'); gr.addColorStop(0.85, '#e8e8e8'); gr.addColorStop(1, '#9a9a9a');
      g.fillStyle = gr; g.fillRect(0, i * bh, SIZE, bh);
    }
    grain(g, SIZE, r, 12);
  } },
  concrete: { m: 3, tint: true, rough: 0.85, bump: 0.6, draw(g, r) {
    g.fillStyle = '#c4c1bb'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, SIZE, r, 70, 'rgba(90,90,90,A)', 15, 70, 0.12);
    blotches(g, SIZE, r, 40, 'rgba(255,255,255,A)', 15, 60, 0.12);
    grain(g, SIZE, r, 24);
  } },
  wood: { m: 2, tint: true, rough: 0.55, bump: 0.8, draw(g, r) { planks(g, r, 10, ['#a5733f', '#b07d48', '#9a6a38', '#b98a55', '#a87845'], 3); } },
  deck: { m: 2, tint: true, rough: 0.8, bump: 1, draw(g, r) { planks(g, r, 8, ['#8d6e52', '#977657', '#80644a', '#9c7e60'], 6); } },
  tile: { m: 2.4, tint: true, rough: 0.35, draw(g, r) {
    const n = 4, s = SIZE / n;
    g.fillStyle = '#bdb5a8'; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = shade('#ebe6dc', 0.96 + r() * 0.06); g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
    blotches(g, SIZE, r, 30, 'rgba(160,140,110,A)', 10, 50, 0.08);
    grain(g, SIZE, r, 8);
  } },
  marble: { m: 2, tint: true, rough: 0.18, draw(g, r) {
    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(120,115,110,${0.1 + r() * 0.25})`; g.lineWidth = 0.5 + r() * 2;
      g.beginPath(); let x = r() * SIZE, y = 0; g.moveTo(x, y);
      while (y < SIZE) { x += (r() - 0.5) * 60; y += 20 + r() * 30; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2;
    g.strokeRect(0, 0, SIZE / 2, SIZE / 2); g.strokeRect(SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2);
    grain(g, SIZE, r, 6);
  } },
  carpet: { m: 1, tint: true, rough: 1, draw(g, r) { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, SIZE, SIZE); grain(g, SIZE, r, 50); } },
  fabric: { m: 0.5, tint: true, rough: 0.95, draw(g, r) {
    g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = 'rgba(0,0,0,.06)';
    for (let i = 0; i < SIZE; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, SIZE); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(SIZE, i); g.stroke(); }
    grain(g, SIZE, r, 30);
  } },
  asphalt: { m: 4, rough: 0.9, bump: 1, draw(g, r) {
    g.fillStyle = '#4b4d50'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, SIZE, r, 40, 'rgba(30,30,30,A)', 20, 80, 0.25);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '200,200,200' : '20,20,20'},${r() * 0.5})`; g.fillRect(r() * SIZE, r() * SIZE, 1.5, 1.5); }
    grain(g, SIZE, r, 25);
  } },
  pavers: { m: 1.6, rough: 0.85, bump: 2, draw(g, r) {
    const cols = 8, rows = 16, w = SIZE / cols, h = SIZE / rows;
    g.fillStyle = '#c7b892'; g.fillRect(0, 0, SIZE, SIZE);
    const pal = ['#a8573f', '#b5694d', '#9a4f3a', '#8d6655', '#b37359', '#7e5446'];
    for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
      g.fillStyle = shade(pick(r, pal), 0.9 + r() * 0.2);
      g.beginPath(); g.roundRect(x * w + (y % 2) * w / 2 + 2, y * h + 2, w - 4, h - 4, 3); g.fill();
    }
    grain(g, SIZE, r, 22);
  } },
  flagstone: { m: 2.5, rough: 0.9, bump: 2, draw(g, r) {
    g.fillStyle = '#8c8a7b'; g.fillRect(0, 0, SIZE, SIZE);
    const pal = ['#c9bfa8', '#b8ae98', '#d3c9b3', '#ada393', '#c2b59b'];
    for (let i = 0; i < 26; i++) {
      const cx = r() * SIZE, cy = r() * SIZE, rad = 40 + r() * 45, n = 6 + Math.floor(r() * 3);
      g.fillStyle = pick(r, pal);
      for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) {
        g.beginPath();
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, q = rad * (0.75 + r() * 0.25); g.lineTo(cx + ox + Math.cos(a) * q, cy + oy + Math.sin(a) * q); }
        g.closePath(); g.fill();
      }
    }
    grain(g, SIZE, r, 26);
  } },
  gravel: { m: 1.5, rough: 1, bump: 2, draw(g, r) {
    g.fillStyle = '#a69c89'; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 9000; i++) {
      const v = 140 + r() * 90;
      g.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
      g.beginPath(); g.ellipse(r() * SIZE, r() * SIZE, 1.5 + r() * 3, 1.2 + r() * 2.5, r() * 3, 0, Math.PI * 2); g.fill();
    }
  } },
  shingles: { m: 2, tint: true, rough: 0.9, bump: 2, draw(g, r) {
    const rows = 10, cols = 6, h = SIZE / rows, w = SIZE / cols;
    for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
      const v = 150 + r() * 70;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x * w + (y % 2) * w / 2, y * h, w - 2, h);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x * w + (y % 2) * w / 2, y * h + h - 4, w, 4);
    }
    grain(g, SIZE, r, 40);
  } },
  clay: { m: 1.6, rough: 0.7, bump: 2.5, draw(g, r) {
    const rows = 7, cols = 8, h = SIZE / rows, w = SIZE / cols;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const base = pick(r, ['#b5532e', '#a84a2a', '#c0603a', '#9e4527']);
      const gr = g.createLinearGradient(x * w, 0, (x + 1) * w, 0);
      gr.addColorStop(0, shade(base, 0.55)); gr.addColorStop(0.45, shade(base, 1.15)); gr.addColorStop(1, shade(base, 0.6));
      g.fillStyle = gr; g.fillRect(x * w, y * h, w, h);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x * w, y * h + h - 5, w, 5);
    }
    grain(g, SIZE, r, 20);
  } },
  metal: { m: 1, tint: true, rough: 0.4, metal: 0.6, bump: 1.5, draw(g, r) {
    const n = 4, w = SIZE / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, '#d0d0d0'); gr.addColorStop(0.05, '#ffffff'); gr.addColorStop(0.1, '#b0b0b0'); gr.addColorStop(0.15, '#dedede'); gr.addColorStop(1, '#d6d6d6');
      g.fillStyle = gr; g.fillRect(i * w, 0, w, SIZE);
    }
    grain(g, SIZE, r, 8);
  } },
};

function planks(g, r, rows, pal, gap) {
  const h = SIZE / rows;
  g.fillStyle = '#3b2a1a'; g.fillRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < rows; y++) {
    let x = -r() * 200;
    while (x < SIZE) {
      const len = 120 + r() * 220, base = shade(pick(r, pal), 0.9 + r() * 0.2);
      for (const ox of [-SIZE, 0, SIZE]) {
        g.fillStyle = base; g.fillRect(x - ox + 1, y * h + gap / 2, len - 2, h - gap);
      }
      g.save(); g.beginPath(); g.rect(Math.max(0, x), y * h + gap / 2, len, h - gap); g.clip();
      for (let k = 0; k < 9; k++) {
        g.strokeStyle = `rgba(60,35,15,${0.08 + r() * 0.15})`; g.lineWidth = 0.6 + r() * 1.2;
        const yy = y * h + gap / 2 + r() * (h - gap);
        g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.6, yy + (r() - 0.5) * 6, x + len, yy); g.stroke();
      }
      g.restore();
      x += len;
    }
  }
  grain(g, SIZE, r, 14);
}

const texCache = {};
export function texture(kind) {
  if (texCache[kind]) return texCache[kind];
  const def = DEFS[kind];
  const [c, g] = canvas();
  def.draw(g, seeded(kind.length * 7919 + kind.charCodeAt(0)));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / def.m, 1 / def.m);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  texCache[kind] = t;
  return t;
}

const matCache = {};
// Material for a named finish. UVs of the geometry are expected in metres.
export function finishMat(kind, color = '#ffffff', { side = THREE.FrontSide } = {}) {
  const def = DEFS[kind] || DEFS.plaster;
  const tint = def.tint ? color || '#ffffff' : '#ffffff';
  const key = `${kind}|${tint}|${side}`;
  if (!matCache[key]) {
    const map = texture(DEFS[kind] ? kind : 'plaster');
    matCache[key] = new THREE.MeshStandardMaterial({
      map, color: tint, roughness: def.rough, metalness: def.metal || 0,
      bumpMap: def.bump ? map : null, bumpScale: def.bump || 0, side,
    });
  }
  return matCache[key];
}
export function colorMat(color, rough = 0.6, metal = 0, extra = {}) {
  const key = `c|${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  return (matCache[key] ??= new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
}
export function paintMat(color) {
  const key = `paint|${color}`;
  return (matCache[key] ??= new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 }));
}
export const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#9fc3d6', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32,
  envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false,
});
export const darkGlassMat = new THREE.MeshPhysicalMaterial({ color: '#1b2430', roughness: 0.05, metalness: 0.3, envMapIntensity: 2 });
export const waterMat = new THREE.MeshPhysicalMaterial({
  color: '#3fa7cf', roughness: 0.04, metalness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 1.8,
});
export function waterTint(color) {
  const key = `water|${color}`;
  return (matCache[key] ??= (() => { const m = waterMat.clone(); m.color.set(color); return m; })());
}

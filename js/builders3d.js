// Turns document objects into Three.js meshes. Plan (x, y) maps to world (x, z); y is up.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEG, wallLen, wallAng, wallArc, wallPointAt, levelElev, baseElev, openingsOf, levelCentroid, outwardSign, toLocal, toWorld } from './state.js';
import { finishMat, colorMat, paintMat, glassMat, darkGlassMat, waterTint } from './textures.js';
import { seeded, seedOf, gazeboVerts, carportPosts, floorPoly, stairLayout, pointInPoly } from './catalog.js';

// ---------------------------------------------------------------- primitives
// UVs in metres from vertex positions, projected along the dominant normal axis.
function planarUV(geo, ox = 0, oy = 0, oz = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  let uv = geo.attributes.uv;
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); geo.setAttribute('uv', uv); }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (nx >= ny && nx >= nz) uv.setXY(i, z, y);
    else if (ny >= nx && ny >= nz) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return geo;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const g = planarUV(new THREE.BoxGeometry(w, h, d), x, y, z);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}
const boxB = (w, h, d, mat, x, y0, z) => box(w, h, d, mat, x, y0 + h / 2, z);
function cyl(rt, rb, h, mat, x, y0, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y0 + h / 2, z);
  return m;
}
function mergedBoxes(list, mat) {
  if (!list.length) return new THREE.Group();
  const geos = list.map((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    if (b.ry) g.rotateY(b.ry);
    g.translate(b.x, b.y, b.z);
    return g;
  });
  return new THREE.Mesh(planarUV(mergeGeometries(geos)), mat);
}
// Box spanning two points (used for rails and beams).
function beam(p0, p1, size, mat) {
  const v = new THREE.Vector3().subVectors(p1, p0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, v.length()), mat);
  m.position.copy(p0).addScaledVector(v, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());
  return m;
}
function tri(a, b, c, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  planarUV(g);
  return new THREE.Mesh(g, mat);
}
const glassy = (m) => { m.userData.noShadow = true; return m; };

const METAL_DARK = () => colorMat('#2f343b', 0.45, 0.6);
const CHROME = () => colorMat('#d9dcdf', 0.18, 1);
const WHITE_TRIM = () => colorMat('#f6f4ef', 0.55);

// ---------------------------------------------------------------- walls, doors, windows
export function buildWall(w, doc) {
  const L = wallLen(w);
  if (L < 0.01) return null;
  const T = w.thickness, H = w.height;
  const g = new THREE.Group();
  // curved walls are built in plan coordinates from short tangent segments; straight walls in their own frame
  const arc = wallArc(w);
  if (arc) g.position.set(0, levelElev(w.level, doc), 0);
  else { g.position.set(w.x1, levelElev(w.level, doc), w.y1); g.rotation.y = -wallAng(w); }
  // put something built in the wall's straight local frame (x = distance along the wall) at distance t
  const attach = (obj, t) => {
    if (!arc) { g.add(obj); return; }
    const q = wallPointAt(w, t), holder = new THREE.Group();
    holder.position.set(q.x, 0, q.y); holder.rotation.y = -q.a;
    obj.position.x -= t;
    holder.add(obj); g.add(holder);
    return holder;
  };
  const ext = w.kind !== 'interior';
  const out = ext ? outwardSign(w, levelCentroid(w.level, doc)) : 1;
  const inner = finishMat('plaster', w.innerColor || '#f4f1ea');
  const outer = ext ? finishMat(w.finish || 'plaster', w.color || '#efe6d6') : inner;
  const mats = [outer, outer, inner, inner, out > 0 ? outer : inner, out < 0 ? outer : inner];

  const ops = openingsOf(w.id, doc).filter((o) => !o.hidden).map((o) => {
    const y0 = o.type === 'door' ? 0 : o.sill;
    return { o, a: Math.max(0, o.t - o.width / 2), b: Math.min(L, o.t + o.width / 2), y0, y1: Math.min(H - 0.02, y0 + o.height) };
  }).sort((p, q) => p.a - q.a);

  const piece = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.002 || y1 - y0 < 0.002) return;
    if (!arc) { g.add(box(x1 - x0, y1 - y0, T, mats, (x0 + x1) / 2, (y0 + y1) / 2, 0)); return; }
    const n = Math.max(1, Math.ceil((x1 - x0) / 0.3)), step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const m = x0 + (i + 0.5) * step, q = wallPointAt(w, m);
      const seg = box(step * 1.04, y1 - y0, T, mats, m, (y0 + y1) / 2, 0); // UVs keep running along the arc
      seg.position.set(q.x, (y0 + y1) / 2, q.y); seg.rotation.y = -q.a;
      g.add(seg);
    }
  };
  let cur = -T / 2;
  for (const p of ops) {
    piece(cur, p.a, 0, H);
    piece(p.a, p.b, 0, p.y0);
    piece(p.a, p.b, p.y1, H);
    cur = Math.max(cur, p.b);
  }
  piece(cur, L + T / 2, 0, H);
  // spandrel infill above arched openings, one half per wall face so each side keeps its finish
  for (const p of ops) {
    if (p.o.style !== 'arch' && p.o.style !== 'arched') continue;
    const r = (p.b - p.a) / 2, ys = Math.max(p.y0 + 0.1, p.y1 - r - 0.03), cx = (p.a + p.b) / 2;
    const sh = new THREE.Shape();
    sh.moveTo(p.a, p.y1); sh.lineTo(p.a, ys); sh.absarc(cx, ys, r, Math.PI, 0, true); sh.lineTo(p.b, p.y1); sh.closePath();
    for (const side of [1, -1]) {
      const geo = new THREE.ExtrudeGeometry(sh, { depth: T / 2, bevelEnabled: false, curveSegments: 20 });
      if (side < 0) geo.translate(0, 0, -T / 2);
      attach(new THREE.Mesh(planarUV(geo), side > 0 ? mats[4] : mats[5]), arc ? cx : 0);
    }
  }
  for (const p of ops) {
    const m = p.o.type === 'door' ? buildDoor(p.o, T, out) : buildWindow(p.o, T, out);
    m.userData.id = p.o.id;
    if (p.o.type === 'door' && p.o.style !== 'garage') m.userData.passable = 'door'; // the character walks through; the camera does not
    const holder = attach(m, p.o.t);
    if (holder) { holder.userData.id = p.o.id; holder.userData.passable = m.userData.passable; }
  }
  g.userData.id = w.id;
  return g;
}

function buildWindow(o, T, out) {
  const g = new THREE.Group();
  const W = o.width, H = o.height, f = 0.06, fd = Math.min(0.1, T);
  g.position.set(o.t, o.sill, 0);
  const fm = colorMat(o.frameColor || '#f7f5f0', 0.45);
  if (o.shade) {
    const sm = finishMat('concrete', '#ebe6dc');
    g.add(box(W + 0.4, 0.08, 0.55, sm, 0, H + 0.2, out * (T / 2 + 0.27)));
  }
  if (o.style === 'arched') {
    const R = W / 2, Hr = Math.max(0.2, H - R - 0.03);
    g.add(box(W, f, fd, fm, 0, f / 2, 0));
    g.add(box(f, Hr, fd, fm, -W / 2 + f / 2, Hr / 2, 0), box(f, Hr, fd, fm, W / 2 - f / 2, Hr / 2, 0));
    const ring = new THREE.Shape();
    ring.absarc(0, 0, R, 0, Math.PI, false); ring.lineTo(-(R - f), 0); ring.absarc(0, 0, R - f, Math.PI, 0, true); ring.closePath();
    const rg = new THREE.ExtrudeGeometry(ring, { depth: fd, bevelEnabled: false, curveSegments: 24 });
    rg.translate(0, Hr, -fd / 2);
    g.add(new THREE.Mesh(rg, fm));
    g.add(glassy(box(W - 2 * f, Hr - f, 0.012, glassMat, 0, (Hr + f) / 2, 0)));
    const half = new THREE.Shape(); half.absarc(0, 0, R - f, 0, Math.PI, false); half.closePath();
    const hg = new THREE.ShapeGeometry(half, 24); hg.translate(0, Hr, 0);
    g.add(glassy(new THREE.Mesh(hg, glassMat)));
    g.add(box(0.045, Hr + R - f, fd * 0.8, fm, 0, (Hr + R - f) / 2, 0), box(W - 2 * f, 0.045, fd * 0.8, fm, 0, Hr, 0));
    g.add(box(W + 0.14, 0.045, 0.14, colorMat('#e4ded3', 0.75), 0, -0.022, out * (T / 2 + 0.03)));
    return g;
  }
  g.add(box(W, f, fd, fm, 0, f / 2, 0), box(W, f, fd, fm, 0, H - f / 2, 0));
  g.add(box(f, H, fd, fm, -W / 2 + f / 2, H / 2, 0), box(f, H, fd, fm, W / 2 - f / 2, H / 2, 0));
  g.add(glassy(box(W - 2 * f, H - 2 * f, 0.012, glassMat, 0, H / 2, 0)));
  const mul = (x, y, w, h) => g.add(box(w, h, fd * 0.8, fm, x, y, 0));
  if (o.style === 'casement') { mul(0, H / 2, 0.05, H - 2 * f); if (H > 1) mul(0, H * 0.72, W - 2 * f, 0.045); }
  if (o.style === 'sliding') mul(0, H / 2, 0.075, H - 2 * f);
  if (o.style === 'vent') for (let i = 1; i < 4; i++) { const s = box(W - 2 * f, 0.02, fd, fm, 0, (i * H) / 4, 0); s.rotation.x = 0.5; g.add(s); }
  g.add(box(W + 0.14, 0.045, 0.14, colorMat('#e4ded3', 0.75), 0, -0.022, out * (T / 2 + 0.03)));
  g.add(box(W + 0.06, 0.03, 0.08, colorMat('#f2efe8', 0.6), 0, -0.015, -out * (T / 2 + 0.02)));
  return g;
}

function buildDoor(o, T, out) {
  const g = new THREE.Group();
  const W = o.width, H = o.height, f = 0.06;
  g.position.set(o.t, 0, 0);
  const fm = colorMat(o.frameColor || '#f4f1ea', 0.5);
  if (o.style === 'arch') return g;
  if (o.style !== 'garage') {
    g.add(box(f, H, T + 0.02, fm, -W / 2 + f / 2, H / 2, 0), box(f, H, T + 0.02, fm, W / 2 - f / 2, H / 2, 0));
    g.add(box(W, f, T + 0.02, fm, 0, H - f / 2, 0));
    g.add(box(W, 0.02, T + 0.04, colorMat('#9a958c', 0.6), 0, 0.01, 0));
  }
  const s = o.flip ? -1 : 1, ang = (o.open || 0) * DEG;
  const lm = colorMat(o.color || '#8a5a33', 0.5);
  const panel = colorMat(new THREE.Color(o.color || '#8a5a33').multiplyScalar(0.82).getStyle(), 0.5);
  const leaf = (hx, lw, e) => {
    const pivot = new THREE.Group();
    pivot.position.set(hx, 0, 0);
    pivot.rotation.y = -s * e * ang;
    const lt = 0.045, lh = H - f - 0.015;
    pivot.add(box(lw, lh, lt, lm, (e * lw) / 2, lh / 2 + 0.01, 0));
    for (const zz of [lt / 2 + 0.004, -lt / 2 - 0.004]) {
      pivot.add(box(lw * 0.64, lh * 0.36, 0.008, panel, (e * lw) / 2, lh * 0.25, zz));
      pivot.add(box(lw * 0.64, lh * 0.36, 0.008, panel, (e * lw) / 2, lh * 0.7, zz));
      pivot.add(box(0.13, 0.022, 0.022, CHROME(), e * (lw - 0.1), 1.0, zz + Math.sign(zz) * 0.035));
      pivot.add(box(0.03, 0.07, 0.03, CHROME(), e * (lw - 0.06), 1.0, zz + Math.sign(zz) * 0.015));
    }
    pivot.userData.doorLeaf = { id: o.id, e, lw, h: lh + 0.01, designAngle: pivot.rotation.y };
    g.add(pivot);
  };
  if (o.style === 'single') { if (o.hinge) leaf(W / 2 - f, W - 2 * f, -1); else leaf(-W / 2 + f, W - 2 * f, 1); }
  else if (o.style === 'double') { leaf(-W / 2 + f, W / 2 - f, 1); leaf(W / 2 - f, W / 2 - f, -1); }
  else if (o.style === 'sliding') {
    const pw = (W - 2 * f) / 2 + 0.04, ph = H - f, am = colorMat(o.color || '#3a3f47', 0.4, 0.5);
    [[-W / 2 + f + pw / 2, 0.025], [W / 2 - f - pw / 2, -0.025]].forEach(([x, z], i) => {
      const panel = new THREE.Group();
      panel.add(box(pw, 0.05, 0.04, am, x, 0.025, z), box(pw, 0.05, 0.04, am, x, ph - 0.025, z));
      panel.add(box(0.05, ph, 0.04, am, x - pw / 2 + 0.025, ph / 2, z), box(0.05, ph, 0.04, am, x + pw / 2 - 0.025, ph / 2, z));
      panel.add(glassy(box(pw - 0.1, ph - 0.1, 0.01, glassMat, x, ph / 2, z)));
      if (i === 0) panel.userData.slideDoor = { id: o.id, x0: x - pw / 2, x1: x + pw / 2, travel: pw - 0.06, z, h: ph };
      else panel.userData.fixedPanel = { x0: x - pw / 2, x1: x + pw / 2, z, h: ph };
      g.add(panel);
    });
  } else if (o.style === 'garage') {
    const n = 4, ph = H / n, gm = colorMat(o.color || '#e9e6df', 0.45, 0.2), z = out * (T / 2 - 0.04);
    for (let i = 0; i < n; i++) {
      g.add(box(W, ph - 0.012, 0.045, gm, 0, i * ph + ph / 2, z));
      for (let k = 0; k < 4; k++) g.add(box(W / 4 - 0.12, ph * 0.55, 0.01, gm, -W / 2 + (k + 0.5) * (W / 4), i * ph + ph / 2, z + out * 0.027));
    }
    g.add(box(W + 0.16, 0.1, 0.05, WHITE_TRIM(), 0, H + 0.05, out * (T / 2 + 0.01)));
    g.add(box(0.08, H + 0.1, 0.05, WHITE_TRIM(), -W / 2 - 0.04, H / 2, out * (T / 2 + 0.01)), box(0.08, H + 0.1, 0.05, WHITE_TRIM(), W / 2 + 0.04, H / 2, out * (T / 2 + 0.01)));
  }
  return g;
}

// ---------------------------------------------------------------- rect items (local frame: x = width, z = depth, +z = front)
const B = {};

B.floor = (o, g, doc) => {
  const th = o.level > 0 ? 0.22 : 0.1, fin = finishMat(o.finish, o.color), under = finishMat('plaster', '#f4f2ee');
  // stairwell openings for stairs on the storey below
  const holes = [];
  if (o.level > 0) {
    for (const s of doc.objects) {
      if ((s.type !== 'stairs' && s.type !== 'spiral') || s.level !== o.level - 1) continue;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toLocal(o, ...toWorld(s, (sx * s.w) / 2, (sy * s.d) / 2)));
      if (!pts.some(([x, y]) => Math.abs(x) < o.w / 2 && Math.abs(y) < o.d / 2)) continue;
      const hole = pts.map(([x, y]) => [Math.max(-o.w / 2 + 0.02, Math.min(o.w / 2 - 0.02, x)), Math.max(-o.d / 2 + 0.02, Math.min(o.d / 2 - 0.02, y))]);
      holes.push(hole);
      if (!o.z) stairwellRail(g, o, s, hole);
    }
  }
  g.add(slab(o, th, 0.02, fin, under, holes));
};

// Guard rail round a stairwell opening, with a gap only where you step off the top of the stairs.
function stairwellRail(g, o, s, hole) {
  let p, d, gap;
  if (s.type === 'spiral') {
    // top tread of the spiral and the way you walk off it (same sweep as B.spiral)
    const R = s.w / 2, n = Math.max(8, Math.round(s.h / 0.19)), fe = ((n - 1) * 2 * Math.PI) / 14;
    p = [R * 0.6 * Math.cos(fe), -R * 0.6 * Math.sin(fe)]; d = [-Math.sin(fe), -Math.cos(fe)]; gap = 1.1;
  } else {
    const path = stairLayout(s).path, a = path[path.length - 2], b = path[path.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    p = b; d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; gap = (s.flightW || 1) + 0.3;
  }
  // into floor coordinates
  const P = toLocal(o, ...toWorld(s, p[0], p[1])), Q = toLocal(o, ...toWorld(s, p[0] + d[0], p[1] + d[1])), dx = Q[0] - P[0], dy = Q[1] - P[1];
  let cx = P[0], cy = P[1];
  for (let k = 0; k < 80 && pointInPoly(cx, cy, hole); k++) { cx += dx * 0.05; cy += dy * 0.05; }
  const rail = new THREE.Group(); rail.position.y = 0.02;
  for (let i = 0; i < hole.length; i++) {
    const [ax, ay] = hole[i], [bx, by] = hole[(i + 1) % hole.length], L = Math.hypot(bx - ax, by - ay);
    if (L < 0.2) continue;
    const ux = (bx - ax) / L, uy = (by - ay) / L, t = (cx - ax) * ux + (cy - ay) * uy, off = Math.abs((cx - ax) * -uy + (cy - ay) * ux);
    const segs = off < 0.3 && t > -0.3 && t < L + 0.3 ? [[0, t - gap / 2], [t + gap / 2, L]] : [[0, L]];
    for (const [t0, t1] of segs) {
      const u0 = Math.max(0, t0), u1 = Math.min(L, t1);
      if (u1 - u0 > 0.15) railing(rail, [[ax + ux * u0, ay + uy * u0], [ax + ux * u1, ay + uy * u1]], 1.0, 'iron', '#2f343b');
    }
  }
  g.add(rail);
}

// Polygon slab (any floor shape) with optional holes and ramp slope; top surface at `top`.
function slab(o, th, top, topMat, sideMat, holes = []) {
  const toV = ([x, y]) => new THREE.Vector2(x, -y);
  const shape = new THREE.Shape(floorPoly(o).map(toV));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(toV)));
  const cap = new THREE.ShapeGeometry(shape, 24);
  cap.rotateX(-Math.PI / 2);
  const body = new THREE.ExtrudeGeometry(shape, { depth: th - 0.004, bevelEnabled: false, curveSegments: 24 });
  body.rotateX(-Math.PI / 2);
  body.translate(0, -th, 0);
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(planarUV(cap), topMat), new THREE.Mesh(planarUV(body), sideMat));
  const pivot = new THREE.Group();
  if (o.slope) {
    // hinge on the front edge so the ramp rises toward the back
    pivot.position.set(0, top, o.d / 2);
    inner.position.z = -o.d / 2;
    pivot.rotation.x = o.slope * DEG;
  } else pivot.position.y = top;
  pivot.add(inner);
  return pivot;
}

B.paving = (o, g) => {
  const m = finishMat(o.finish, '#ffffff');
  g.add(slab(o, 0.05, 0.026, m, m));
  if (o.finish === 'asphalt' && o.d > 2 && o.w > 2 && (!o.shape || o.shape === 'rect') && !o.slope) {
    const along = o.d >= o.w, L = along ? o.d : o.w, n = Math.floor(L / 1.6);
    for (let i = 0; i < n; i++) {
      const c = -L / 2 + 0.8 + i * 1.6;
      g.add(box(along ? 0.1 : 0.8, 0.005, along ? 0.8 : 0.1, colorMat('#f2f2ee', 0.7), along ? 0 : c, 0.028, along ? c : 0));
    }
  }
};

// Traditional Kerala roof: steep clay-tiled hip roof whose ridge ends in small vertical gablets
// ("mukhappu") faced with dark wooden jaali, with wooden fascia and a brass finial on each gablet.
function keralaRoof(g, W, D, p, yE, mat, woodColor) {
  if (D > W) { const sub = new THREE.Group(); sub.rotation.y = Math.PI / 2; keralaRoof(sub, D, W, p, yE, mat, woodColor); g.add(sub); return; }
  const top = yE + (D / 2) * Math.tan(p), rx = Math.max(0.2, (W - D) / 2 + D * 0.12), f = 0.55;
  const pos = [], uv = [];
  const push = (a, b, c, axis) => { for (const v of [a, b, c]) { pos.push(...v); uv.push(axis === 'z' ? v[0] : v[2], (axis === 'z' ? Math.abs(v[2]) : Math.abs(v[0])) / Math.cos(p) + v[1]); } };
  const quad = (a, b, c, d, ax) => { push(a, b, c, ax); push(a, c, d, ax); };
  const wood = colorMat(woodColor, 0.55), brass = colorMat('#c9a227', 0.3, 0.9);
  quad([-W / 2, yE, D / 2], [W / 2, yE, D / 2], [rx, top, 0], [-rx, top, 0], 'z');
  quad([W / 2, yE, -D / 2], [-W / 2, yE, -D / 2], [-rx, top, 0], [rx, top, 0], 'z');
  for (const s of [1, -1]) {
    const C = [s * W / 2, yE, D / 2], C2 = [s * W / 2, yE, -D / 2], R = [s * rx, top, 0];
    const G = C.map((v, i) => v + f * (R[i] - v)), G2 = [G[0], G[1], -G[2]], A = [G[0], top, 0];
    quad(C, C2, G2, G, 'x');           // lower hip face
    push(G, R, A, 'z'); push(G2, A, R, 'z'); // little caps between ridge and gablet
    const panel = new THREE.BufferGeometry();
    const inset = s * -0.04;
    panel.setAttribute('position', new THREE.Float32BufferAttribute([G[0] + inset, G[1] + 0.02, G[2] - 0.05, G2[0] + inset, G2[1] + 0.02, G2[2] + 0.05, A[0] + inset, A[1] - 0.06, 0], 3));
    panel.computeVertexNormals();
    g.add(new THREE.Mesh(panel, colorMat(woodColor, 0.6, 0, { side: THREE.DoubleSide })));
    // jaali lattice on the gablet
    const bars = [], hgt = top - G[1];
    for (let y = G[1] + 0.12; y < top - 0.08; y += 0.12) {
      const half = G[2] * (1 - (y - G[1]) / hgt);
      if (half > 0.05) bars.push({ w: 0.025, h: 0.025, d: half * 2, x: G[0] + inset + s * 0.015, y, z: 0 });
    }
    for (let z = -G[2] + 0.12; z < G[2]; z += 0.12) {
      const yTop = top - (Math.abs(z) / G[2]) * hgt;
      if (yTop - G[1] > 0.06) bars.push({ w: 0.025, h: yTop - G[1] - 0.04, d: 0.025, x: G[0] + inset + s * 0.015, y: (G[1] + yTop) / 2, z });
    }
    if (bars.length) g.add(mergedBoxes(bars, colorMat('#3b2414', 0.6)));
    g.add(beam(new THREE.Vector3(...G), new THREE.Vector3(A[0], A[1] + 0.05, 0), 0.07, wood));
    g.add(beam(new THREE.Vector3(...G2), new THREE.Vector3(A[0], A[1] + 0.05, 0), 0.07, wood));
    g.add(cyl(0.02, 0.06, 0.28, brass, A[0], top + 0.02, 0, 10));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), brass); ball.position.set(A[0], top + 0.34, 0); g.add(ball);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  g.add(box(rx * 2 + 0.1, 0.12, 0.18, colorMat('#7a3a26', 0.7), 0, top + 0.03, 0));
  // dark wooden fascia boards with a scalloped look along the eaves
  g.add(box(W, 0.2, 0.05, wood, 0, yE - 0.06, D / 2), box(W, 0.2, 0.05, wood, 0, yE - 0.06, -D / 2));
  g.add(box(0.05, 0.2, D, wood, W / 2, yE - 0.06, 0), box(0.05, 0.2, D, wood, -W / 2, yE - 0.06, 0));
  g.add(box(W, 0.02, D, colorMat('#6b4a2e', 0.7), 0, Math.min(-0.01, yE + 0.02), 0));
}

B.roof = (o, g) => {
  const ov = o.overhang || 0, W = o.w + 2 * ov, D = o.d + 2 * ov, p = Math.max(1, o.pitch || 25) * DEG;
  const mat = finishMat(o.finish, o.color, { side: THREE.DoubleSide });
  const gableMat = finishMat('plaster', o.gableColor || '#efe8dc', { side: THREE.DoubleSide });
  const fascia = WHITE_TRIM();
  if (o.style === 'flat') {
    g.add(boxB(W, 0.25, D, [fascia, fascia, mat, fascia, fascia, fascia], 0, 0, 0));
    const pm = finishMat('plaster', o.gableColor || '#efe8dc');
    g.add(boxB(W, 0.35, 0.12, pm, 0, 0.25, D / 2 - 0.06), boxB(W, 0.35, 0.12, pm, 0, 0.25, -D / 2 + 0.06));
    g.add(boxB(0.12, 0.35, D, pm, W / 2 - 0.06, 0.25, 0), boxB(0.12, 0.35, D, pm, -W / 2 + 0.06, 0.25, 0));
    return;
  }
  if (o.style === 'kerala') { keralaRoof(g, W, D, p, -ov * Math.tan(p), mat, o.gableColor || '#5a3a22'); return; }
  const R = (o.d / 2) * Math.tan(p), th = 0.1;
  if (o.style === 'gable') {
    const run = D / 2, sl = run / Math.cos(p);
    for (const s of [1, -1]) {
      const m = box(W, th, sl, mat, 0, 0, 0);
      m.position.set(0, R - (run / 2) * Math.tan(p) + th / 2, (s * run) / 2);
      m.rotation.x = s * p;
      g.add(m);
      g.add(box(W, 0.2, 0.04, fascia, 0, R - run * Math.tan(p) - 0.04, s * run));
    }
    for (const sx of [1, -1]) g.add(tri([(sx * o.w) / 2, 0, -o.d / 2], [(sx * o.w) / 2, 0, o.d / 2], [(sx * o.w) / 2, R, 0], gableMat));
    g.add(boxB(W + 0.02, 0.08, 0.26, colorMat('#4a4d52', 0.7), 0, R + 0.03, 0));
    return;
  }
  // hip roof as a surface; ridge along the longer side
  const yE = -ov * Math.tan(p), top = R + 0.02;
  const pos = [], uv = [];
  const push = (a, b, c, axis) => {
    for (const v of [a, b, c]) {
      pos.push(...v);
      uv.push(axis === 'z' ? v[0] : v[2], (axis === 'z' ? Math.abs(v[2]) : Math.abs(v[0])) / Math.cos(p));
    }
  };
  const quad = (a, b, c, d, ax) => { push(a, b, c, ax); push(a, c, d, ax); };
  if (W >= D) {
    const rx = (W - D) / 2;
    quad([-W / 2, yE, D / 2], [W / 2, yE, D / 2], [rx, top, 0], [-rx, top, 0], 'z');
    quad([W / 2, yE, -D / 2], [-W / 2, yE, -D / 2], [-rx, top, 0], [rx, top, 0], 'z');
    push([W / 2, yE, D / 2], [W / 2, yE, -D / 2], [rx, top, 0], 'x');
    push([-W / 2, yE, -D / 2], [-W / 2, yE, D / 2], [-rx, top, 0], 'x');
  } else {
    const rz = (D - W) / 2;
    quad([W / 2, yE, D / 2], [W / 2, yE, -D / 2], [0, top, -rz], [0, top, rz], 'x');
    quad([-W / 2, yE, -D / 2], [-W / 2, yE, D / 2], [0, top, rz], [0, top, -rz], 'x');
    push([-W / 2, yE, D / 2], [W / 2, yE, D / 2], [0, top, rz], 'z');
    push([W / 2, yE, -D / 2], [-W / 2, yE, -D / 2], [0, top, -rz], 'z');
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  // fascia boards and a soffit to give the roof edge some thickness
  g.add(box(W, 0.18, 0.04, fascia, 0, yE - 0.07, D / 2), box(W, 0.18, 0.04, fascia, 0, yE - 0.07, -D / 2));
  g.add(box(0.04, 0.18, D, fascia, W / 2, yE - 0.07, 0), box(0.04, 0.18, D, fascia, -W / 2, yE - 0.07, 0));
  g.add(box(W, 0.02, D, colorMat('#f1eee8', 0.8), 0, -0.01, 0));
};

B.column = (o, g) => {
  const m = colorMat(o.color || '#f3efe7', 0.6), r = o.w / 2;
  g.add(boxB(o.w * 1.3, 0.12, o.w * 1.3, m, 0, 0, 0), boxB(o.w * 1.3, 0.12, o.w * 1.3, m, 0, o.h - 0.12, 0));
  if (o.shape === 'square') g.add(boxB(o.w, o.h - 0.24, o.w, m, 0, 0.12, 0));
  else g.add(cyl(r * 0.92, r, o.h - 0.24, m, 0, 0.12, 0, 28));
};

// Prism from a plan polygon ([x, y] local metres) between heights y0 and y1.
function prism(pts, y0, y1, mat) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, -y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.005, y1 - y0), bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return new THREE.Mesh(planarUV(geo), mat);
}

B.stairs = (o, g) => {
  const L = stairLayout(o), mat = finishMat(o.finish || 'wood', '#ffffff');
  const solid = o.style === 'solid' || o.shape === 'winder';
  const body = finishMat('plaster', '#efeae2');
  for (const s of L.steps) {
    if (solid || s.landing) {
      // waist-slab look: masonry/RCC under each tread, finish on top
      g.add(prism(s.pts, solid ? 0 : s.top - 0.15, s.top - 0.03, body));
      g.add(prism(s.pts, s.top - 0.03, s.top, mat));
    } else {
      // floating tread with a little nosing
      g.add(prism(s.pts, s.top - 0.045, s.top, mat));
    }
  }
  if (!solid) {
    // steel stringer under the walking line of each straight run
    const pth = L.path;
    for (let i = 0; i < pth.length - 1; i++) {
      const top = (i + 1) / (pth.length - 1);
      const a = new THREE.Vector3(pth[i][0], o.h * (i / (pth.length - 1)) - 0.12, pth[i][1]);
      const b = new THREE.Vector3(pth[i + 1][0], o.h * top - 0.12, pth[i + 1][1]);
      g.add(beam(a, b, 0.12, METAL_DARK()));
    }
  }
  if (o.railing) {
    const wood = colorMat('#6b4a2e', 0.5);
    for (const r of L.rails) {
      r.forEach(([x, y, t], i) => { if (i % 3 === 0 || i === r.length - 1) g.add(cyl(0.018, 0.018, 0.9, CHROME(), x, t, y, 10)); });
      for (let i = 0; i < r.length - 1; i++) {
        const [x0, y0, t0] = r[i], [x1, y1, t1] = r[i + 1];
        g.add(beam(new THREE.Vector3(x0, t0 + 0.9, y0), new THREE.Vector3(x1, t1 + 0.9, y1), 0.05, wood));
      }
    }
  }
};

const sectorCache = {};
B.spiral = (o, g) => {
  const R = o.w / 2, n = Math.max(8, Math.round(o.h / 0.19)), rise = o.h / n, dt = (2 * Math.PI) / 14;
  const key = R.toFixed(2);
  if (!sectorCache[key]) {
    const sh = new THREE.Shape();
    sh.moveTo(0.05 * Math.cos(-dt / 2), 0.05 * Math.sin(-dt / 2));
    sh.absarc(0, 0, R, -dt / 2 - 0.03, dt / 2 + 0.03, false);
    sh.lineTo(0.05 * Math.cos(dt / 2), 0.05 * Math.sin(dt / 2));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 8 });
    geo.rotateX(-Math.PI / 2);
    geo.userData.shared = true;
    sectorCache[key] = planarUV(geo);
  }
  const mat = finishMat('wood', '#ffffff'), metal = colorMat(o.color || '#3a3f47', 0.4, 0.6);
  g.add(cyl(0.07, 0.07, o.h + 1, metal, 0, 0, 0, 16));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sectorCache[key], mat), phi = i * dt, y = rise * (i + 1);
    m.position.y = y - 0.05; m.rotation.y = phi;
    g.add(m);
    const bx = (R - 0.05) * Math.cos(phi), bz = -(R - 0.05) * Math.sin(phi);
    g.add(cyl(0.012, 0.012, 0.9, metal, bx, y, bz, 8));
    pts.push(new THREE.Vector3(bx, y + 0.9, bz));
  }
  if (pts.length > 1) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 4, 0.025, 8), colorMat('#6b4a2e', 0.5)));
};

function classicColumn(g, x, z, y0, h, r, mat) {
  g.add(boxB(r * 2.7, 0.1, r * 2.7, mat, x, y0, z));
  g.add(cyl(r * 1.25, r * 1.25, 0.06, mat, x, y0 + 0.1, z, 24));
  g.add(cyl(r * 0.88, r, h - 0.32, mat, x, y0 + 0.16, z, 24));
  g.add(cyl(r * 1.25, r * 0.9, 0.08, mat, x, y0 + h - 0.16, z, 24));
  g.add(boxB(r * 2.6, 0.08, r * 2.6, mat, x, y0 + h - 0.08, z));
}

B.portico = (o, g) => {
  const P = 0.2, base = finishMat('concrete', '#e6e0d6'), top = finishMat('marble', '#ffffff');
  g.add(boxB(o.w, P, o.d, [base, base, top, base, base, base], 0, 0, 0));
  if (o.steps) g.add(boxB(o.w * 0.7, 0.1, 0.35, [base, base, top, base, base, base], 0, 0, o.d / 2 + 0.175));
  const style = o.style || 'pediment', col = o.column || 'classic';
  const cm = colorMat(o.color || '#f6f3ec', 0.6), n = Math.max(2, o.columns | 0), zc = o.d / 2 - 0.3, trim = WHITE_TRIM();
  const xs = Array.from({ length: n }, (_, i) => -o.w / 2 + 0.3 + (i * (o.w - 0.6)) / (n - 1));
  if (style === 'modern') {
    for (const x of xs) columnOf(col, g, x, zc, P, o.h - P - 0.18, cm);
    const c = finishMat('concrete', o.roofColor || '#e7e3dc'), wood = finishMat('wood', '#ffffff');
    g.add(boxB(o.w + 0.8, 0.18, o.d + 0.6, [c, c, c, wood, c, c], 0, o.h - 0.18, 0.3));
    return;
  }
  let colH = o.h - P - 0.3;
  if (style === 'arched') {
    const gap = (o.w - 0.6) / (n - 1), r = Math.max(0.25, gap / 2 - 0.2), ys = o.h - 0.3 - r, W2 = o.w / 2 + 0.15;
    colH = ys - P;
    const sh = new THREE.Shape();
    sh.moveTo(-W2, o.h); sh.lineTo(W2, o.h); sh.lineTo(W2, ys);
    for (let i = n - 2; i >= 0; i--) { const mid = (xs[i] + xs[i + 1]) / 2; sh.lineTo(mid + r, ys); sh.absarc(mid, ys, r, 0, Math.PI, false); }
    sh.lineTo(-W2, ys); sh.closePath();
    const pm = finishMat('plaster', o.color || '#efe6d6');
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 20 });
    geo.translate(0, 0, zc - 0.15);
    g.add(new THREE.Mesh(planarUV(geo), pm));
    for (const sx of [-1, 1]) g.add(boxB(0.3, o.h - ys, o.d, pm, sx * (o.w / 2), ys, 0));
    g.add(boxB(o.w + 0.4, 0.15, o.d + 0.4, [pm, pm, finishMat('concrete', '#d8d4cc'), pm, pm, pm], 0, o.h, 0));
  } else g.add(boxB(o.w + 0.3, 0.3, o.d + 0.3, trim, 0, o.h - 0.3, 0));
  for (const x of xs) columnOf(col, g, x, zc, P, colH, cm);
  if (style === 'hip') {
    const rg = new THREE.Group();
    B.roof({ w: o.w + 0.3, d: o.d + 0.3, overhang: 0.3, pitch: 24, style: 'hip', finish: 'shingles', color: o.roofColor || '#5a4a42' }, rg);
    rg.position.y = o.h; g.add(rg);
  } else if (style === 'balcony') {
    g.add(boxB(o.w + 0.4, 0.12, o.d + 0.4, [trim, trim, finishMat('tile', '#ffffff'), trim, trim, trim], 0, o.h, 0));
    const hw = o.w / 2 + 0.12, hd = o.d / 2 + 0.12, rg = new THREE.Group();
    rg.position.y = o.h + 0.12;
    railing(rg, [[-hw, -hd], [-hw, hd], [hw, hd], [hw, -hd]], 0.95, 'baluster', '#f6f4ef');
    g.add(rg);
  } else if (style === 'pediment') {
    const p = 25 * DEG, half = o.w / 2 + 0.28, rise = half * Math.tan(p), rm = finishMat('shingles', o.roofColor || '#6b6f76', { side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const m = box(half / Math.cos(p), 0.1, o.d + 0.45, rm, 0, 0, 0);
      m.position.set((sx * half) / 2, o.h + rise - (half / 2) * Math.tan(p) + 0.05, 0);
      m.rotation.z = -sx * p;
      g.add(m);
    }
    const pw = o.w / 2 + 0.15, pr = pw * Math.tan(p), tm = colorMat('#f6f4ef', 0.6, 0, { side: THREE.DoubleSide });
    for (const z of [o.d / 2 + 0.15, -o.d / 2 - 0.15]) g.add(tri([-pw, o.h, z], [pw, o.h, z], [0, o.h + pr, z], tm));
  } else if (style === 'flat') {
    g.add(boxB(o.w + 0.4, 0.08, o.d + 0.4, finishMat('concrete', '#d8d4cc'), 0, o.h, 0));
  } else if (style === 'kerala') {
    const rg = new THREE.Group(), p = 35 * DEG, ov = 0.55;
    keralaRoof(rg, o.w + 0.3 + 2 * ov, o.d + 0.3 + 2 * ov, p, -ov * Math.tan(p), finishMat('clay', '#ffffff', { side: THREE.DoubleSide }), o.color || '#5a3a22');
    rg.position.y = o.h; g.add(rg);
  } else if (style === 'kerala-gable') {
    // front-facing gable: ridge runs toward the front, the gable triangle is a wooden jaali "mukhappu"
    const p = 32 * DEG, half = o.w / 2 + 0.5, rise = half * Math.tan(p), rm = finishMat('clay', '#ffffff', { side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const m = box(half / Math.cos(p), 0.08, o.d + 0.9, rm, 0, 0, 0);
      m.position.set((sx * half) / 2, o.h + rise - (half / 2) * Math.tan(p) + 0.04, 0.2);
      m.rotation.z = -sx * p; g.add(m);
    }
    const wood = colorMat(o.color || '#5a3a22', 0.6, 0, { side: THREE.DoubleSide }), zf = o.d / 2 + 0.55, pw = o.w / 2 + 0.2, pr = pw * Math.tan(p);
    g.add(tri([-pw, o.h, zf - 0.1], [pw, o.h, zf - 0.1], [0, o.h + pr, zf - 0.1], wood));
    const bars = [];
    for (let x = -pw + 0.12; x < pw; x += 0.12) { const ht = pr * (1 - Math.abs(x) / pw); if (ht > 0.06) bars.push({ w: 0.025, h: ht - 0.03, d: 0.025, x, y: o.h + (ht - 0.03) / 2, z: zf - 0.06 }); }
    for (let y = 0.12; y < pr; y += 0.12) { const hw2 = pw * (1 - y / pr); if (hw2 > 0.05) bars.push({ w: hw2 * 2, h: 0.025, d: 0.025, x: 0, y: o.h + y, z: zf - 0.06 }); }
    g.add(mergedBoxes(bars, colorMat('#2e1b0f', 0.6)));
    for (const sx of [-1, 1]) g.add(beam(new THREE.Vector3(sx * (half + 0.02), o.h - 0.06, zf), new THREE.Vector3(0, o.h + rise + 0.08, zf), 0.09, colorMat(o.color || '#5a3a22', 0.55)));
    g.add(cyl(0.02, 0.06, 0.3, colorMat('#c9a227', 0.3, 0.9), 0, o.h + rise + 0.05, zf, 10));
  }
  if (o.charupadi && (style === 'kerala' || style === 'kerala-gable')) {
    // charupadi: low side parapet seat with a leaning wooden backrest
    const seat = finishMat('laterite', '#ffffff'), wood = colorMat(o.color || '#5a3a22', 0.5), L = o.d - 0.8;
    for (const sx of [-1, 1]) {
      const x = sx * (o.w / 2 - 0.2);
      g.add(boxB(0.36, 0.42, L, seat, x, P, -0.15), boxB(0.42, 0.05, L + 0.04, wood, x, P + 0.42, -0.15));
      const back = box(0.04, 0.55, L, wood, 0, 0, 0);
      back.position.set(sx * (o.w / 2 - 0.02), P + 0.72, -0.15); back.rotation.z = sx * 0.32; g.add(back);
      const k = Math.floor(L / 0.25);
      for (let i = 0; i <= k; i++) g.add(beam(new THREE.Vector3(x + sx * 0.16, P + 0.47, -0.15 - L / 2 + (i * L) / k), new THREE.Vector3(sx * (o.w / 2 - 0.08), P + 0.98, -0.15 - L / 2 + (i * L) / k), 0.035, wood));
    }
  }
};

function columnOf(style, g, x, z, y0, h, mat) {
  if (style === 'square') {
    g.add(boxB(0.36, 0.12, 0.36, mat, x, y0, z), boxB(0.28, h - 0.24, 0.28, mat, x, y0 + 0.12, z), boxB(0.36, 0.12, 0.36, mat, x, y0 + h - 0.12, z));
  } else if (style === 'craftsman') {
    const ph = Math.min(1, h * 0.35);
    g.add(boxB(0.5, ph, 0.5, finishMat('stone', '#ffffff'), x, y0, z), boxB(0.58, 0.06, 0.58, mat, x, y0 + ph, z));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * Math.SQRT2, 0.2 * Math.SQRT2, h - ph - 0.06, 4, 1), mat);
    c.rotation.y = Math.PI / 4; c.position.set(x, y0 + ph + 0.06 + (h - ph - 0.06) / 2, z);
    g.add(c);
  } else if (style === 'steel') g.add(boxB(0.1, h, 0.1, METAL_DARK(), x, y0, z));
  else if (style === 'wood') {
    // turned wooden pillar on a carved granite base (traditional Kerala)
    const granite = finishMat('stone', '#d8d4cc'), wood = colorMat(mat.color ? '#' + mat.color.getHexString() : '#5a3a22', 0.5);
    g.add(boxB(0.36, 0.45, 0.36, granite, x, y0, z), boxB(0.3, 0.06, 0.3, granite, x, y0 + 0.45, z));
    g.add(cyl(0.1, 0.12, h - 0.75, wood, x, y0 + 0.51, z, 16));
    for (const t of [0.6, 0.66, h - 0.32]) g.add(cyl(0.14, 0.14, 0.04, wood, x, y0 + t, z, 16));
    g.add(boxB(0.32, 0.2, 0.32, wood, x, y0 + h - 0.24, z), boxB(0.5, 0.06, 0.18, wood, x, y0 + h - 0.06, z));
  }
  else classicColumn(g, x, z, y0, h, 0.13, mat);
}

// Railing along a polyline of [x, z] points; style: glass | iron | baluster | solid.
function railing(g, pts, h, style, color) {
  const bars = [], solids = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const ry = Math.atan2(-(bz - az), bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (style === 'solid') { solids.push({ w: len + 0.12, h, d: 0.12, x: mx, y: h / 2, z: mz, ry }); continue; }
    bars.push({ w: len + 0.05, h: 0.05, d: 0.07, x: mx, y: h, z: mz, ry }, { w: 0.06, h, d: 0.06, x: ax, y: h / 2, z: az, ry });
    if (style === 'glass') {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(len - 0.06, h - 0.1, 0.015), glassMat);
      gl.position.set(mx, (h - 0.1) / 2 + 0.03, mz); gl.rotation.y = ry; gl.userData.noShadow = true; g.add(gl);
    } else {
      const k = Math.max(1, Math.floor(len / (style === 'baluster' ? 0.16 : 0.12))), s = style === 'baluster' ? 0.06 : 0.02;
      for (let j = 1; j < k; j++) { const t = j / k; bars.push({ w: s, h: h - 0.1, d: s, x: ax + (bx - ax) * t, y: (h - 0.1) / 2 + 0.05, z: az + (bz - az) * t, ry }); }
      bars.push({ w: len, h: 0.05, d: 0.06, x: mx, y: 0.05, z: mz, ry });
    }
  }
  const [lx, lz] = pts[pts.length - 1];
  if (style !== 'solid') bars.push({ w: 0.06, h, d: 0.06, x: lx, y: h / 2, z: lz });
  const metal = style === 'baluster' ? colorMat(color, 0.55) : colorMat(color, 0.4, 0.6);
  if (bars.length) g.add(mergedBoxes(bars, metal));
  if (solids.length) g.add(mergedBoxes(solids, finishMat('plaster', color)));
}

// ---------------------------------------------------------------- gates, boundary & facade
function gateLeaf(style, lw, h, mat, e, ow) {
  const g = new THREE.Group(), bars = [], spikes = [];
  const X = (u) => e * u;
  if (style === 'wood' || style === 'padippura') {
    const k = Math.max(2, Math.round(lw / 0.15)), bw = lw / k;
    for (let i = 0; i < k; i++) bars.push({ w: bw - 0.012, h: h - 0.05, d: 0.04, x: X((i + 0.5) * bw), y: (h - 0.05) / 2 + 0.05, z: 0 });
    for (const y of [0.3, h - 0.3]) bars.push({ w: lw - 0.04, h: 0.12, d: 0.03, x: X(lw / 2), y, z: -0.035 });
  } else if (style === 'modern' || style === 'slats') {
    bars.push({ w: 0.06, h, d: 0.06, x: X(0.03), y: h / 2, z: 0 }, { w: 0.06, h, d: 0.06, x: X(lw - 0.03), y: h / 2, z: 0 });
    for (let y = 0.12; y < h - 0.05; y += 0.14) bars.push({ w: lw, h: 0.1, d: 0.03, x: X(lw / 2), y, z: 0 });
  } else {
    const top = (u) => {
      if (style !== 'arch') return h;
      const dist = Math.abs(ow / 2 - u) / (ow / 2); // 0 at the centre of the opening
      return h + 0.45 * (1 - dist * dist);
    };
    bars.push({ w: 0.05, h: top(0), d: 0.05, x: X(0.025), y: top(0) / 2, z: 0 }, { w: 0.05, h: top(lw), d: 0.05, x: X(lw - 0.025), y: top(lw) / 2, z: 0 });
    for (const y of [0.12, h * 0.35]) bars.push({ w: lw, h: 0.05, d: 0.04, x: X(lw / 2), y, z: 0 });
    const k = Math.max(2, Math.floor(lw / 0.12));
    for (let i = 1; i < k; i++) {
      const u = (i * lw) / k, t = top(u);
      bars.push({ w: 0.022, h: t - 0.12, d: 0.022, x: X(u), y: 0.12 + (t - 0.12) / 2, z: 0 });
      const c = new THREE.ConeGeometry(0.03, 0.1, 6); c.translate(X(u), t + 0.05, 0); spikes.push(c);
    }
    // top rail follows the curve in short segments
    const seg = 10;
    for (let i = 0; i < seg; i++) {
      const u0 = (i * lw) / seg, u1 = ((i + 1) * lw) / seg, y0 = top(u0) - 0.12, y1 = top(u1) - 0.12;
      g.add(beam(new THREE.Vector3(X(u0), y0, 0), new THREE.Vector3(X(u1), y1, 0), 0.045, mat));
    }
    if (style === 'iron') for (let i = 0; i < Math.floor(k / 2); i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), mat);
      ring.position.set(X(((i + 0.5) * lw) / Math.floor(k / 2)), h * 0.35 + 0.16, 0); g.add(ring);
    }
  }
  g.add(mergedBoxes(bars, mat));
  if (spikes.length) g.add(new THREE.Mesh(mergeGeometries(spikes), mat));
  return g;
}

B.gate = (o, g) => {
  const pill = o.pillar !== 'none', p = pill ? 0.45 : 0.12, ow = Math.max(0.6, o.w - 2 * p), h = o.h;
  const pm = pill ? finishMat(o.pillar, '#ece3d3') : METAL_DARK();
  for (const sx of [-1, 1]) {
    const x = sx * (o.w / 2 - p / 2);
    g.add(boxB(p, h + (pill ? 0.3 : 0.1), p, pm, x, 0, 0));
    if (!pill) continue;
    g.add(boxB(p + 0.1, 0.08, p + 0.1, finishMat('concrete', '#e2ddd3'), x, h + 0.3, 0));
    if (o.lamps) {
      const glow = colorMat('#fff3cf', 0.3, 0, { emissive: '#ffcf70', emissiveIntensity: 2 });
      g.add(cyl(0.05, 0.07, 0.1, METAL_DARK(), x, h + 0.38, 0, 8), cyl(0.13, 0.09, 0.3, glow, x, h + 0.48, 0, 6), cyl(0.02, 0.16, 0.08, METAL_DARK(), x, h + 0.78, 0, 6));
    }
  }
  if (o.style === 'padippura') {
    // gatehouse roof spanning the pillars, with wooden double doors below
    const rg = new THREE.Group(), p = 35 * DEG;
    keralaRoof(rg, o.w + 0.9, Math.max(1.6, o.d + 1.1), p, -0.45 * Math.tan(p), finishMat('clay', '#ffffff', { side: THREE.DoubleSide }), o.color || '#5a3a22');
    rg.position.y = h + 0.55; g.add(rg);
    g.add(boxB(o.w, 0.25, Math.max(0.5, o.d), colorMat(o.color || '#5a3a22', 0.55), 0, h + 0.3, 0));
  }
  const gm = o.style === 'wood' || o.style === 'padippura' ? finishMat('wood', o.color || '#7a5230') : colorMat(o.color || '#22252a', 0.4, 0.7);
  if (o.style === 'sliding') {
    // the leaf rolls along its track; in Spectate it slides open as you walk up to it
    const slider = new THREE.Group(), leaf = gateLeaf('slats', ow, h - 0.05, gm, 1, ow);
    leaf.position.set(-ow / 2, 0.05, -0.15); slider.add(leaf);
    slider.position.x = ((o.open || 0) / 100) * ow;
    slider.userData.slideDoor = { id: o.id, x0: -ow / 2, x1: ow / 2, travel: ow - 0.15, z: -0.15, h: h - 0.05, rest: slider.position.x };
    slider.userData.passable = 'door';
    g.add(slider, boxB(ow * 2 + 0.2, 0.03, 0.06, METAL_DARK(), ow / 2, 0, -0.15));
    return;
  }
  const a = Math.min(100, o.open || 0) * DEG;
  for (const [sx, e] of [[-1, 1], [1, -1]]) {
    // each leaf swings on its hinge pillar; in Spectate it is pushed open like a door
    const pivot = new THREE.Group(), lw = ow / 2 - 0.02;
    pivot.position.set((sx * ow) / 2, 0.05, 0);
    pivot.rotation.y = e * a;
    pivot.add(gateLeaf(o.style, lw, h - 0.05, gm, e, ow));
    pivot.userData.doorLeaf = { id: o.id, e, lw, h: h - 0.05, designAngle: pivot.rotation.y };
    pivot.userData.passable = 'door';
    g.add(pivot);
  }
};

B.boundary = (o, g) => {
  const st = o.style || 'plaster', th = Math.max(0.1, o.d);
  const m = finishMat(st === 'railing' ? 'plaster' : st, o.color || '#e9e2d4');
  const wallH = st === 'railing' ? Math.min(0.7, o.h) : o.h, cap = finishMat('concrete', '#ddd7cc');
  g.add(boxB(o.w, wallH, th, m, 0, 0, 0), boxB(o.w + 0.04, 0.06, th + 0.08, cap, 0, wallH, 0));
  const n = Math.max(1, Math.round(o.w / 3));
  for (let i = 0; i <= n; i++) {
    const x = -o.w / 2 + (i * o.w) / n;
    g.add(boxB(th + 0.15, o.h + 0.12, th + 0.15, m, x, 0, 0), boxB(th + 0.25, 0.08, th + 0.25, cap, x, o.h + 0.12, 0));
  }
  if (st === 'railing') {
    const rg = new THREE.Group();
    rg.position.y = wallH + 0.06;
    railing(rg, [[-o.w / 2, 0], [o.w / 2, 0]], o.h - wallH - 0.06, 'iron', o.railColor || '#22252a');
    g.add(rg);
  }
};

B.balcony = (o, g) => {
  const c = finishMat('plaster', '#f2efe9'), t = finishMat('tile', '#ffffff');
  g.add(boxB(o.w, 0.15, o.d, [c, c, t, c, c, c], 0, -0.15, 0));
  const hw = o.w / 2 - 0.03, hd = o.d / 2 - 0.03;
  railing(g, [[-hw, -o.d / 2], [-hw, hd], [hw, hd], [hw, -o.d / 2]], 1.0, o.rail || 'glass', o.color || '#3a3f47');
};

B.pergola = (o, g) => {
  const wood = colorMat(o.color || '#8a5a33', 0.75), list = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) list.push({ w: 0.15, h: o.h, d: 0.15, x: sx * (o.w / 2 - 0.1), y: o.h / 2, z: sz * (o.d / 2 - 0.1) });
  for (const sz of [-1, 1]) list.push({ w: o.w + 0.4, h: 0.22, d: 0.08, x: 0, y: o.h + 0.11, z: sz * (o.d / 2 - 0.1) });
  for (let x = -o.w / 2; x <= o.w / 2 + 0.01; x += 0.45) list.push({ w: 0.06, h: 0.18, d: o.d + 0.5, x, y: o.h + 0.31, z: 0 });
  for (let z = -o.d / 2; z <= o.d / 2 + 0.01; z += 0.3) list.push({ w: o.w + 0.2, h: 0.05, d: 0.05, x: 0, y: o.h + 0.43, z });
  g.add(mergedBoxes(list, wood));
};

B.chimney = (o, g) => {
  const b = finishMat('brick', '#ffffff');
  g.add(boxB(o.w, o.h, o.d, b, 0, 0, 0), boxB(o.w + 0.12, 0.1, o.d + 0.12, finishMat('concrete', '#cfcac2'), 0, o.h, 0));
  g.add(cyl(0.09, 0.11, 0.35, colorMat('#a0522d', 0.8), -o.w / 5, o.h + 0.1, 0, 12), cyl(0.09, 0.11, 0.3, colorMat('#a0522d', 0.8), o.w / 5, o.h + 0.1, 0, 12));
};

B.cladding = (o, g) => g.add(boxB(o.w, o.h, Math.max(0.01, o.d), finishMat(o.finish || 'stone', o.color || '#ffffff'), 0, 0, 0));

B.louvers = (o, g) => {
  const list = [], gap = Math.max(0.05, o.gap || 0.15), m = colorMat(o.color || '#8a5a33', 0.6, 0.1);
  if (o.dir === 'h') for (let y = 0.02; y <= o.h; y += gap) list.push({ w: o.w, h: 0.04, d: o.d, x: 0, y, z: 0 });
  else for (let x = -o.w / 2; x <= o.w / 2 + 0.001; x += gap) list.push({ w: 0.04, h: o.h, d: o.d, x, y: o.h / 2, z: 0 });
  list.push({ w: o.w + 0.04, h: 0.05, d: o.d, x: 0, y: o.h + 0.025, z: 0 });
  g.add(mergedBoxes(list, m));
};

B.frame = (o, g) => {
  const b = o.band || 0.2, m = finishMat(o.finish || 'concrete', o.color || '#3a3f47');
  g.add(boxB(o.w, b, o.d, m, 0, o.h - b, 0), boxB(o.w, b * 0.6, o.d, m, 0, 0, 0));
  g.add(boxB(b, o.h, o.d, m, -o.w / 2 + b / 2, 0, 0), boxB(b, o.h, o.d, m, o.w / 2 - b / 2, 0, 0));
};

B.gazebo = (o, g) => {
  const n = o.sides || 8, R = o.w / 2, v = gazeboVerts(o), wood = colorMat(o.color || '#f2ede4', 0.6);
  const deckGeo = planarUV(new THREE.CylinderGeometry(R, R, 0.3, n, 1, false, Math.PI / n));
  const deck = new THREE.Mesh(deckGeo, finishMat('deck', '#ffffff'));
  deck.position.y = 0.15; g.add(deck);
  g.add(boxB(1.3, 0.15, 0.4, finishMat('deck', '#ffffff'), 0, 0, R * Math.cos(Math.PI / n) + 0.2));
  const h = o.h, y0 = 0.3, postIn = 0.94, rails = [];
  for (const [x, z] of v) g.add(boxB(0.13, h, 0.13, wood, x * postIn, y0, z * postIn));
  for (let i = 0; i < n; i++) {
    const [ax, az] = v[i], [bx, bz] = v[(i + 1) % n];
    const p0 = new THREE.Vector3(ax * postIn, 0, az * postIn), p1 = new THREE.Vector3(bx * postIn, 0, bz * postIn);
    const len = p0.distanceTo(p1), ry = Math.atan2(-(p1.z - p0.z), p1.x - p0.x), mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
    rails.push({ w: len, h: 0.12, d: 0.08, x: mx, y: y0 + h - 0.06, z: mz, ry }); // top beam
    if (i === n - 1) continue; // entrance
    rails.push({ w: len, h: 0.06, d: 0.07, x: mx, y: y0 + 0.9, z: mz, ry }, { w: len, h: 0.05, d: 0.06, x: mx, y: y0 + 0.1, z: mz, ry });
    const k = Math.floor(len / 0.14);
    for (let j = 1; j < k; j++) { const t = j / k; rails.push({ w: 0.035, h: 0.78, d: 0.035, x: p0.x + (p1.x - p0.x) * t, y: y0 + 0.51, z: p0.z + (p1.z - p0.z) * t, ry }); }
  }
  g.add(mergedBoxes(rails, wood));
  const rh = R * 0.75, roofGeo = new THREE.ConeGeometry(R * 1.22, rh, n, 1, true, Math.PI / n);
  const roof = new THREE.Mesh(planarUV(roofGeo), finishMat('shingles', o.roofColor || '#5d6168', { side: THREE.DoubleSide }));
  roof.position.y = y0 + h + rh / 2 - 0.02; g.add(roof);
  g.add(cyl(0.03, 0.06, 0.4, METAL_DARK(), 0, y0 + h + rh - 0.1, 0, 10));
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), METAL_DARK()); fin.position.y = y0 + h + rh + 0.32; g.add(fin);
  // bench seats along the sides
  const bench = [];
  for (let i = 0; i < n - 1; i += 2) {
    const [ax, az] = v[i], [bx, bz] = v[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az) * 0.75, ry = Math.atan2(-(bz - az), bx - ax);
    bench.push({ w: len, h: 0.05, d: 0.38, x: ((ax + bx) / 2) * 0.8, y: y0 + 0.45, z: ((az + bz) / 2) * 0.8, ry });
  }
  g.add(mergedBoxes(bench, finishMat('deck', '#ffffff')));
};

function buildCar(L, Wd, color) {
  const g = new THREE.Group();
  const shape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
  const ext = (s, depth, bev) => {
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev[0], bevelSize: bev[1], bevelSegments: 3, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };
  const wr = 0.34, wx = L * 0.31;
  const arch = (cx, dir) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); pts.push([cx + dir * Math.cos(a) * (wr + 0.06), wr + Math.sin(a) * (wr + 0.06)]); } return pts; };
  const body = [[-L / 2, 0.38], [-L / 2, 0.78], [-L / 2 + 0.15, 0.92], [-L * 0.3, 0.97], [-L * 0.2, 1.36], [L * 0.08, 1.4], [L * 0.2, 1.0], [L / 2 - 0.2, 0.86], [L / 2, 0.72], [L / 2, 0.38],
    ...arch(wx, 1), ...arch(-wx, 1)];
  g.add(new THREE.Mesh(ext(shape(body), Wd - 0.16, [0.08, 0.06]), paintMat(color)));
  const glass = [[-L * 0.3 + 0.04, 0.99], [-L * 0.2 + 0.03, 1.33], [L * 0.08 - 0.03, 1.37], [L * 0.2 - 0.04, 1.02]];
  g.add(new THREE.Mesh(ext(shape(glass), Wd - 0.16, [0.09, 0.07]), darkGlassMat));
  const tire = colorMat('#1d1f22', 0.85), rim = CHROME();
  for (const x of [-wx, wx]) for (const z of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.24, 24), tire);
    t.rotation.x = Math.PI / 2; t.position.set(x, wr, z * (Wd / 2 - 0.13)); g.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.25, 16), rim);
    r.rotation.x = Math.PI / 2; r.position.copy(t.position); g.add(r);
  }
  const head = colorMat('#ffffff', 0.2, 0, { emissive: '#fff6e0', emissiveIntensity: 0.6 });
  const tail = colorMat('#b3121b', 0.3, 0, { emissive: '#600', emissiveIntensity: 0.6 });
  for (const z of [-1, 1]) {
    g.add(box(0.05, 0.09, 0.32, head, L / 2 + 0.04, 0.66, z * (Wd / 2 - 0.3)));
    g.add(box(0.05, 0.08, 0.36, tail, -L / 2 - 0.05, 0.74, z * (Wd / 2 - 0.28)));
  }
  g.add(box(0.06, 0.12, Wd - 0.3, colorMat('#2a2d31', 0.5), L / 2 + 0.03, 0.42, 0));
  return g;
}
B.car = (o, g) => g.add(buildCar(o.w, o.d, o.color || '#1d4e89'));

B.carport = (o, g) => {
  g.add(boxB(o.w, 0.06, o.d, finishMat('concrete', '#e2dfd9'), 0, -0.02, 0));
  const pm = colorMat(o.color || '#3d4148', 0.45, 0.5);
  for (const [x, z] of carportPosts(o)) g.add(boxB(0.12, o.h, 0.12, pm, x, 0, z));
  for (const x of [-(o.w / 2 - 0.15), o.w / 2 - 0.15]) g.add(boxB(0.1, 0.22, o.d + 0.1, pm, x, o.h - 0.1, 0));
  const roof = box(o.w + 0.5, 0.06, o.d + 0.5, finishMat('metal', o.roofColor || '#9aa1a9', { side: THREE.DoubleSide }), 0, 0, 0);
  roof.position.y = o.h + 0.18; roof.rotation.x = 3 * DEG; g.add(roof);
  g.add(boxB(0.08, 0.004, o.d - 0.4, colorMat('#f4f4f0', 0.7), -o.w / 2 + 0.35, 0.04, 0), boxB(0.08, 0.004, o.d - 0.4, colorMat('#f4f4f0', 0.7), o.w / 2 - 0.35, 0.04, 0));
  if (o.withCar) {
    const car = buildCar(Math.min(4.5, o.d - 0.6), Math.min(1.85, o.w - 0.6), o.carColor || '#8a1c1c');
    car.rotation.y = -Math.PI / 2; car.position.y = 0.04; g.add(car);
  }
};

B.fence = (o, g) => {
  const m = colorMat(o.color || '#f5f2ea', 0.7), n = Math.max(1, Math.round(o.w / 2)), list = [];
  for (let i = 0; i <= n; i++) list.push({ w: 0.1, h: o.h + 0.06, d: 0.1, x: -o.w / 2 + (i * o.w) / n, y: (o.h + 0.06) / 2, z: 0 });
  if (o.style === 'panel') list.push({ w: o.w, h: o.h * 0.95, d: 0.04, x: 0, y: o.h * 0.5, z: 0 });
  else if (o.style === 'rail') for (const f of [0.3, 0.6, 0.9]) list.push({ w: o.w, h: 0.1, d: 0.04, x: 0, y: o.h * f, z: 0.05 });
  else {
    for (const f of [0.25, 0.75]) list.push({ w: o.w, h: 0.07, d: 0.035, x: 0, y: o.h * f, z: 0.04 });
    const k = Math.floor(o.w / 0.14);
    for (let i = 0; i <= k; i++) list.push({ w: 0.075, h: o.h - 0.08, d: 0.02, x: -o.w / 2 + i * (o.w / k), y: (o.h - 0.08) / 2 + 0.04, z: 0.068 });
  }
  g.add(mergedBoxes(list, o.style === 'panel' ? finishMat('deck', '#ffffff') : m));
};

B.pool = (o, g) => {
  const c = finishMat('concrete', '#efebe3'), cw = 0.3;
  g.add(boxB(o.w, 0.06, cw, c, 0, 0, o.d / 2 - cw / 2), boxB(o.w, 0.06, cw, c, 0, 0, -o.d / 2 + cw / 2));
  g.add(boxB(cw, 0.06, o.d - 2 * cw, c, o.w / 2 - cw / 2, 0, 0), boxB(cw, 0.06, o.d - 2 * cw, c, -o.w / 2 + cw / 2, 0, 0));
  g.add(boxB(o.w - 2 * cw, 0.01, o.d - 2 * cw, colorMat('#2f8fb8', 0.4), 0, 0, 0));
  const water = boxB(o.w - 2 * cw, 0.01, o.d - 2 * cw, waterTint(o.color || '#3fa7cf'), 0, 0.025, 0);
  water.userData.noShadow = true; g.add(water);
  for (const z of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 8, 16, Math.PI), CHROME());
    rail.rotation.y = Math.PI / 2; rail.position.set(o.w / 2 - cw - 0.05, 0.06, z); g.add(rail);
  }
};

function blob(r, rnd, mat) {
  let geo = new THREE.IcosahedronGeometry(r, 2);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 1 + (rnd() - 0.5) * 0.38; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.92, p.getZ(i) * f); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.userData.passable = true; // foliage does not block the Spectate character
  return m;
}
const LEAF = ['#4f7d32', '#5b8a3a', '#466f2c', '#64913f', '#3f6a2a'];
B.tree = (o, g) => {
  const rnd = seeded(seedOf(o)), H = o.h, R = o.w / 2, bark = colorMat('#5a4330', 0.95);
  if (o.variety === 'conifer') {
    g.add(cyl(0.1, 0.16, H * 0.3, bark, 0, 0, 0, 10));
    const mat = colorMat('#2f5b35', 0.85, 0, { flatShading: true });
    for (let i = 0; i < 4; i++) {
      const cr = R * (1 - i * 0.2), ch = H * 0.36, c = new THREE.Mesh(new THREE.ConeGeometry(cr, ch, 12), mat);
      c.position.y = H * 0.2 + i * H * 0.18 + ch / 2; c.rotation.y = rnd() * 3; g.add(c);
    }
    return;
  }
  if (o.variety === 'cypress') {
    g.add(cyl(0.08, 0.12, H * 0.15, bark, 0, 0, 0, 8));
    const m = blob(1, rnd, colorMat('#2d5a3a', 0.85, 0, { flatShading: true }));
    m.scale.set(R, H * 0.45, R); m.position.y = H * 0.52; g.add(m);
    return;
  }
  if (o.variety === 'coconut') {
    // tall, gently curving trunk with drooping fronds and a cluster of coconuts
    const lean = 0.05 + rnd() * 0.07, dir = rnd() * Math.PI * 2, pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, off = Math.sin(t * 1.6) * H * lean; pts.push(new THREE.Vector3(Math.cos(dir) * off, t * H * 0.95, Math.sin(dir) * off)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.15, 8), finishMat('deck', '#8a7a68')));
    const top = pts[pts.length - 1], leaf = colorMat('#55862f', 0.8, 0, { flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.25, droop = 0.25 + rnd() * 0.6, L = R * (0.8 + rnd() * 0.3);
      const curve = new THREE.QuadraticBezierCurve3(top.clone(), top.clone().add(new THREE.Vector3(Math.cos(a) * L * 0.5, L * 0.25, Math.sin(a) * L * 0.5)),
        top.clone().add(new THREE.Vector3(Math.cos(a) * L, -L * droop, Math.sin(a) * L)));
      const geo = new THREE.TubeGeometry(curve, 8, 0.12, 2, false); geo.scale(1, 1, 1);
      g.add(new THREE.Mesh(geo, leaf));
    }
    const nut = colorMat('#6b7d2a', 0.6);
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), nut); const a = rnd() * 6.28; s.position.set(top.x + Math.cos(a) * 0.2, top.y - 0.25 - rnd() * 0.2, top.z + Math.sin(a) * 0.2); g.add(s); }
    return;
  }
  if (o.variety === 'banana') {
    const rnd2 = rnd, leaf = colorMat('#7fb03c', 0.75, 0, { flatShading: true, side: THREE.DoubleSide });
    for (let s = 0; s < 3; s++) {
      const bx = (rnd2() - 0.5) * 0.6, bz = (rnd2() - 0.5) * 0.6, sh = H * (0.5 + rnd2() * 0.2);
      g.add(cyl(0.08, 0.13, sh, colorMat('#8aa04a', 0.8), bx, 0, bz, 8));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rnd2(), lf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 4), leaf);
        lf.scale.set(R * 0.45, 0.02, 0.22); lf.position.set(bx + Math.cos(a) * R * 0.38, sh + 0.25, bz + Math.sin(a) * R * 0.38);
        lf.rotation.set(0, -a, -0.5); g.add(lf);
      }
    }
    return;
  }
  if (o.variety === 'bamboo') {
    const culm = colorMat('#8a9a3a', 0.6), leaf = colorMat('#6a9a3c', 0.8, 0, { flatShading: true });
    for (let i = 0; i < 16; i++) {
      const a = rnd() * 6.28, d = rnd() * R * 0.4, h2 = H * (0.7 + rnd() * 0.3), x = Math.cos(a) * d, z = Math.sin(a) * d;
      g.add(beam(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 2.2, h2, z * 2.2), 0.04, culm));
      const b = blob(0.35 + rnd() * 0.2, rnd, leaf); b.scale.y = 0.5; b.position.set(x * 2.2, h2 - 0.2, z * 2.2); g.add(b);
    }
    return;
  }
  if (o.variety === 'gulmohar' || o.variety === 'mango') {
    // spreading umbrella canopy; gulmohar is covered in red-orange flowers
    g.add(cyl(0.14, 0.26, H * 0.45, bark, 0, 0, 0, 10));
    for (const a of [0.4, 2.4, 4.4]) g.add(beam(new THREE.Vector3(0, H * 0.4, 0), new THREE.Vector3(Math.cos(a) * R * 0.5, H * 0.62, Math.sin(a) * R * 0.5), 0.12, bark));
    const cols = o.variety === 'gulmohar' ? ['#d9442a', '#e8622e', '#4f7d32', '#c93a22', '#5b8a3a'] : ['#2f5a2a', '#3a6a2e', '#2a5226', '#466f2c'];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = i === 0 ? 0 : R * (0.3 + rnd() * 0.45), r = R * (0.35 + rnd() * 0.2);
      const m = blob(r, rnd, colorMat(cols[Math.floor(rnd() * cols.length)], 0.85, 0, { flatShading: true }));
      m.scale.y = o.variety === 'gulmohar' ? 0.6 : 0.85;
      m.position.set(Math.cos(a) * d, H * (o.variety === 'gulmohar' ? 0.72 : 0.66) + (rnd() - 0.5) * H * 0.12, Math.sin(a) * d); g.add(m);
    }
    return;
  }
  if (o.variety === 'palm') {
    const segs = 8, lean = 0.06 + rnd() * 0.08, pts = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * H * lean, t * H * 0.92, 0)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.13, 8), colorMat('#7a6248', 0.95)));
    const topP = pts[pts.length - 1], leaf = colorMat('#5d8f36', 0.8, 0, { flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const fr = new THREE.Group(), a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), leaf);
      m.scale.set(R * 0.55, 0.05, 0.28); m.position.x = R * 0.5; fr.add(m);
      fr.position.copy(topP); fr.rotation.set(0, a, -0.35 - rnd() * 0.3); g.add(fr);
    }
    return;
  }
  g.add(cyl(0.09, 0.2, H * 0.55, bark, 0, 0, 0, 10));
  for (const a of [0.6, 2.7, 4.6]) {
    const br = cyl(0.04, 0.08, H * 0.25, bark, 0, 0, 0, 6);
    br.position.set(Math.cos(a) * 0.25, H * 0.5, Math.sin(a) * 0.25); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(br);
  }
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = R * (0.42 + rnd() * 0.22), a = rnd() * Math.PI * 2, d = i === 0 ? 0 : R * (0.25 + rnd() * 0.3);
    const m = blob(r, rnd, colorMat(LEAF[Math.floor(rnd() * LEAF.length)], 0.85, 0, { flatShading: true }));
    m.position.set(Math.cos(a) * d, H * 0.62 + (rnd() - 0.3) * H * 0.22 + (i === 0 ? H * 0.08 : 0), Math.sin(a) * d);
    g.add(m);
  }
};

B.shrub = (o, g) => {
  const rnd = seeded(seedOf(o)), R = o.w / 2, mat = colorMat(o.color || '#4f7f3a', 0.9, 0, { flatShading: true });
  for (let i = 0; i < 3; i++) {
    const m = blob(R * (0.55 + rnd() * 0.2), rnd, mat), a = rnd() * 6.28, d = i ? R * 0.35 : 0;
    m.userData.passable = false; // a bush is dense enough to stop you
    m.position.set(Math.cos(a) * d, o.h * 0.45, Math.sin(a) * d); m.scale.y = o.h / (R * 1.3); g.add(m);
  }
};

B.lamp = (o, g) => {
  const m = METAL_DARK();
  g.add(cyl(0.12, 0.14, 0.2, m, 0, 0, 0, 12), cyl(0.04, 0.05, o.h - 0.4, m, 0, 0.2, 0, 10));
  const glow = colorMat('#fff3cf', 0.3, 0, { emissive: '#ffcf70', emissiveIntensity: 2.2 });
  g.add(cyl(0.16, 0.1, 0.3, glow, 0, o.h - 0.4, 0, 6), cyl(0.04, 0.22, 0.12, m, 0, o.h - 0.1, 0, 6));
};

B.sofa = (o, g) => {
  const f = finishMat('fabric', o.color || '#7d8a99'), lighter = finishMat('fabric', new THREE.Color(o.color || '#7d8a99').offsetHSL(0, 0, 0.06).getStyle());
  const { w, d } = o, legs = colorMat('#3b2a1c', 0.5);
  if (o.shape === 'lshape') {
    // a seat run along the back (no right arm) joined to a full-depth chaise on the right
    const s = Math.min(0.95, d * 0.6), c = Math.min(0.95, w * 0.45), xc = w / 2 - c / 2;
    const run = new THREE.Group(); B.sofa({ ...o, shape: 'straight', w: w - c, d: s, noRightArm: true }, run); run.position.set(-c / 2, 0, -d / 2 + s / 2); g.add(run);
    g.add(boxB(c, 0.3, d, f, xc, 0.08, 0), boxB(c - 0.22, 0.14, d - 0.24, lighter, xc - 0.1, 0.38, 0.1));
    g.add(boxB(0.2, 0.28, d, f, w / 2 - 0.1, 0.38, 0), boxB(c, 0.5, 0.2, f, xc, 0.38, -d / 2 + 0.1));
    for (const [x, z] of [[w / 2 - c + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08], [w / 2 - 0.08, -d / 2 + 0.08]]) g.add(boxB(0.05, 0.08, 0.05, legs, x, 0, z));
    return;
  }
  for (const [x, z] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) g.add(boxB(0.05, 0.08, 0.05, legs, x, 0, z));
  g.add(boxB(w, 0.3, d, f, 0, 0.08, 0), boxB(w, 0.5, 0.2, f, 0, 0.38, -d / 2 + 0.1));
  g.add(boxB(0.2, 0.28, d, f, -w / 2 + 0.1, 0.38, 0));
  if (!o.noRightArm) g.add(boxB(0.2, 0.28, d, f, w / 2 - 0.1, 0.38, 0));
  const n = Math.max(1, Math.round((w - 0.4) / 0.7)), cw = (w - 0.4) / n;
  for (let i = 0; i < n; i++) {
    g.add(boxB(cw - 0.02, 0.14, d - 0.24, lighter, -w / 2 + 0.2 + cw * (i + 0.5), 0.38, 0.1));
    const back = boxB(cw - 0.04, 0.42, 0.14, lighter, -w / 2 + 0.2 + cw * (i + 0.5), 0.5, -d / 2 + 0.26); back.rotation.x = -0.12; g.add(back);
  }
};

B.bed = (o, g) => {
  const { w, d } = o, wood = finishMat('wood', '#c9a27c'), white = finishMat('fabric', '#f6f4f0');
  g.add(boxB(w, 0.3, d, wood, 0, 0, 0), boxB(w + 0.04, 1.05, 0.08, wood, 0, 0, -d / 2 + 0.04));
  g.add(boxB(w - 0.06, 0.24, d - 0.12, white, 0, 0.3, 0.02));
  const pw = w > 1.3 ? (w - 0.3) / 2 : w - 0.2, cnt = w > 1.3 ? 2 : 1;
  for (let i = 0; i < cnt; i++) g.add(boxB(pw, 0.13, 0.4, white, -w / 2 + 0.1 + pw / 2 + i * (pw + 0.1), 0.54, -d / 2 + 0.35));
  g.add(boxB(w + 0.02, 0.07, d * 0.66, finishMat('fabric', o.color || '#4a6b8a'), 0, 0.52, d / 2 - (d * 0.66) / 2 + 0.01));
  g.add(boxB(w + 0.03, 0.075, 0.25, finishMat('fabric', '#ffffff'), 0, 0.52, d / 2 - d * 0.66 + 0.1));
};

B.table = (o, g) => {
  const { w, d } = o, wood = finishMat('wood', o.color || '#9c6b3f'), dark = colorMat('#2f2a26', 0.6);
  g.add(boxB(w, 0.045, d, wood, 0, 0.73, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(boxB(0.06, 0.73, 0.06, dark, x * (w / 2 - 0.1), 0, z * (d / 2 - 0.1)));
  const n = Math.max(1, Math.floor(w / 0.65)), seat = finishMat('fabric', '#d7d0c4');
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    for (const s of [-1, 1]) {
      const z = s * (d / 2 + 0.22);
      g.add(boxB(0.44, 0.05, 0.42, seat, x, 0.45, z), boxB(0.44, 0.45, 0.04, dark, x, 0.5, z + s * 0.2));
      for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) g.add(boxB(0.03, 0.45, 0.03, dark, x + lx, 0, z + lz));
    }
  }
};

B.kitchen = (o, g) => {
  const { w, d } = o, cab = colorMat(o.color || '#f2f0eb', 0.45), top = finishMat('marble', '#5a5d63');
  g.add(boxB(w, 0.1, d - 0.06, colorMat('#2a2c30', 0.7), 0, 0, -0.03));
  g.add(boxB(w, 0.76, d - 0.02, cab, 0, 0.1, 0));
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) g.add(boxB(0.006, 0.7, 0.005, colorMat('#c9c6bf', 0.6), -w / 2 + (i * w) / doors, 0.13, d / 2));
  for (let i = 0; i < doors; i++) g.add(box(0.15, 0.015, 0.02, CHROME(), -w / 2 + (i + 0.5) * (w / doors), 0.78, d / 2 + 0.01));
  g.add(boxB(w + 0.02, 0.04, d + 0.03, top, 0, 0.86, 0.01));
  const sx = -w / 2 + w * 0.18 + Math.min(0.8, w * 0.25) / 2;
  g.add(boxB(Math.min(0.8, w * 0.25) - 0.04, 0.012, d - 0.24, colorMat('#b8bec6', 0.2, 0.9), sx, 0.895, 0));
  const tap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16, Math.PI), CHROME()); tap.position.set(sx, 0.9, -d / 2 + 0.1); g.add(tap);
  const cx = w / 2 - Math.min(0.9, w * 0.3);
  g.add(boxB(0.6, 0.01, d - 0.12, darkGlassMat, cx, 0.9, 0));
  g.add(boxB(w, 0.7, 0.35, cab, 0, 1.45, -d / 2 + 0.175));
};

// ---------------------------------------------------------------- bath, interior & services
const CERAMIC = () => colorMat('#f7f7f4', 0.12, 0.05);
B.wc = (o, g) => {
  const c = CERAMIC();
  if (o.style === 'indian') {
    g.add(boxB(o.w, 0.06, o.d, finishMat('tile', '#ffffff'), 0, 0, 0));
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 0.03, 24), c); pan.scale.set(o.w * 0.32, 1, o.d * 0.4); pan.position.set(0, 0.07, 0.05); g.add(pan);
    return;
  }
  g.add(boxB(o.w, 0.38, 0.18, c, 0, 0.42, -o.d / 2 + 0.09), boxB(o.w + 0.02, 0.03, 0.2, c, 0, 0.8, -o.d / 2 + 0.1));
  const bowl = cyl(0.19, 0.13, 0.4, c, 0, 0, 0.06, 24); bowl.scale.z = 1.35; g.add(bowl);
  const seat = cyl(0.2, 0.2, 0.03, c, 0, 0.4, 0.06, 24); seat.scale.z = 1.35; g.add(seat);
};
B.basin = (o, g) => {
  const c = CERAMIC();
  if (o.style === 'counter') {
    g.add(boxB(o.w, 0.78, o.d, colorMat('#d9cbb6', 0.5), 0, 0, 0), boxB(o.w + 0.02, 0.04, o.d + 0.02, finishMat('marble', '#ffffff'), 0, 0.78, 0));
    const b = cyl(0.2, 0.16, 0.12, c, 0, 0.82, 0.02, 24); b.scale.z = 0.8; g.add(b);
  } else {
    g.add(cyl(0.07, 0.09, 0.72, c, 0, 0, -0.05, 16));
    const b = boxB(o.w, 0.16, o.d, c, 0, 0.7, 0); g.add(b);
  }
  g.add(beam(new THREE.Vector3(0, 0.86, -o.d / 2 + 0.06), new THREE.Vector3(0, 1.0, -o.d / 2 + 0.06), 0.03, CHROME()));
  g.add(beam(new THREE.Vector3(0, 1.0, -o.d / 2 + 0.06), new THREE.Vector3(0, 1.0, -o.d / 2 + 0.18), 0.025, CHROME()));
  g.add(boxB(Math.min(o.w, 0.6), 0.75, 0.02, colorMat('#c9d6df', 0.05, 0.9), 0, 1.2, -o.d / 2 + 0.01));
};
B.shower = (o, g) => {
  g.add(boxB(o.w, 0.04, o.d, finishMat('tile', '#e1e8ec'), 0, 0, 0));
  if (o.glass) g.add(glassy(boxB(o.w, 1.95, 0.012, glassMat, 0, 0.05, o.d / 2)));
  g.add(beam(new THREE.Vector3(o.w / 2 - 0.15, 0.9, -o.d / 2 + 0.03), new THREE.Vector3(o.w / 2 - 0.15, 2.05, -o.d / 2 + 0.03), 0.025, CHROME()));
  g.add(beam(new THREE.Vector3(o.w / 2 - 0.15, 2.05, -o.d / 2 + 0.03), new THREE.Vector3(o.w / 2 - 0.15, 2.05, -o.d / 2 + 0.3), 0.025, CHROME()));
  g.add(cyl(0.11, 0.11, 0.02, CHROME(), o.w / 2 - 0.15, 1.99, -o.d / 2 + 0.32, 20));
};
B.bathtub = (o, g) => {
  const c = CERAMIC();
  g.add(boxB(o.w, 0.55, o.d, c, 0, 0, 0));
  g.add(boxB(o.w - 0.16, 0.01, o.d - 0.16, waterTint('#bfe3ee'), 0, 0.5, 0));
  g.add(cyl(0.025, 0.025, 0.2, CHROME(), -o.w / 2 + 0.12, 0.55, 0, 10));
};
B.washer = (o, g) => {
  g.add(boxB(o.w, 0.85, o.d, colorMat('#f4f4f2', 0.3), 0, 0, 0));
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28), darkGlassMat); door.rotation.x = Math.PI / 2; door.position.set(0, 0.45, o.d / 2 + 0.01); g.add(door);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 28), CHROME()); ring.position.set(0, 0.45, o.d / 2 + 0.02); g.add(ring);
};
B.wardrobe = (o, g) => {
  const m = colorMat(o.color || '#c8b8a2', 0.5), h = o.h || 2.1;
  g.add(boxB(o.w, h, o.d, m, 0, 0, 0));
  if (o.sliding) {
    // two overlapping sliding panels on tracks, one with a mirror strip
    const pw = o.w / 2 + 0.03, edge = colorMat('#8d7f6c', 0.6);
    g.add(boxB(pw, h - 0.08, 0.02, m, -o.w / 4 + 0.015, 0.04, o.d / 2 + 0.01), boxB(pw, h - 0.08, 0.02, m, o.w / 4 - 0.015, 0.04, o.d / 2 + 0.035));
    g.add(boxB(pw * 0.42, h * 0.7, 0.005, colorMat('#c9d6df', 0.05, 0.9), o.w / 4 - 0.015, h * 0.15, o.d / 2 + 0.048));
    g.add(boxB(o.w, 0.03, 0.06, edge, 0, h - 0.03, o.d / 2 + 0.02), boxB(o.w, 0.03, 0.06, edge, 0, 0, o.d / 2 + 0.02));
    return;
  }
  const n = Math.max(2, Math.round(o.w / 0.6));
  for (let i = 1; i < n; i++) g.add(boxB(0.008, h - 0.1, 0.01, colorMat('#8d7f6c', 0.6), -o.w / 2 + (i * o.w) / n, 0.05, o.d / 2));
  for (let i = 0; i < n; i++) g.add(boxB(0.02, 0.3, 0.03, CHROME(), -o.w / 2 + ((i + (i % 2 ? 0.15 : 0.85)) * o.w) / n, h * 0.45, o.d / 2 + 0.015));
};
B.tvunit = (o, g) => {
  g.add(boxB(o.w, 0.45, o.d, colorMat(o.color || '#8a6a4a', 0.5), 0, 0, 0));
  g.add(boxB(Math.min(1.6, o.w * 0.8), 0.7, 0.05, darkGlassMat, 0, 0.75, -o.d / 2 + 0.05));
  g.add(boxB(o.w, 1.1, 0.03, finishMat('deck', '#ffffff'), 0, 0.45, -o.d / 2 - 0.02));
};
B.desk = (o, g) => {
  const m = colorMat(o.color || '#b48a5e', 0.5), dark = colorMat('#2f2a26', 0.6);
  g.add(boxB(o.w, 0.04, o.d, m, 0, 0.72, 0));
  for (const sx of [-1, 1]) g.add(boxB(0.04, 0.72, o.d - 0.05, dark, sx * (o.w / 2 - 0.04), 0, 0));
  g.add(boxB(0.5, 0.33, 0.04, darkGlassMat, 0, 0.78, -o.d / 2 + 0.12));
  g.add(boxB(0.46, 0.06, 0.46, finishMat('fabric', '#3f4a5a'), 0, 0.45, o.d / 2 + 0.3), boxB(0.46, 0.5, 0.05, finishMat('fabric', '#3f4a5a'), 0, 0.5, o.d / 2 + 0.52));
  g.add(cyl(0.03, 0.03, 0.45, dark, 0, 0, o.d / 2 + 0.3, 8));
};
B.bookshelf = (o, g) => {
  const m = colorMat(o.color || '#8a6a4a', 0.55), h = o.h || 2, n = Math.max(3, Math.round(h / 0.4)), books = [];
  g.add(boxB(o.w, h, 0.02, m, 0, 0, -o.d / 2 + 0.01), boxB(0.03, h, o.d, m, -o.w / 2 + 0.015, 0, 0), boxB(0.03, h, o.d, m, o.w / 2 - 0.015, 0, 0));
  const rnd = seeded(seedOf(o));
  for (let i = 0; i <= n; i++) {
    g.add(boxB(o.w, 0.025, o.d, m, 0, (i * h) / n - (i === n ? 0.025 : 0), 0));
    if (i === n) continue;
    let x = -o.w / 2 + 0.04;
    while (x < o.w / 2 - 0.08) { const bw = 0.03 + rnd() * 0.04, bh = 0.2 + rnd() * 0.12; books.push({ w: bw, h: bh, d: o.d * 0.8, x: x + bw / 2, y: (i * h) / n + 0.025 + bh / 2, z: 0 }); x += bw + 0.005; }
  }
  g.add(mergedBoxes(books, colorMat(['#7c2d12', '#1e3a8a', '#14532d', '#78350f', '#4c1d95'][Math.floor(rnd() * 5)], 0.7)));
};
B.pooja = (o, g) => {
  const wood = colorMat(o.color || '#8a5a33', 0.45), gold = colorMat('#c9a227', 0.3, 0.9), h = o.h || 1.8;
  g.add(boxB(o.w, 0.75, o.d, wood, 0, 0, 0), boxB(o.w + 0.04, 0.04, o.d + 0.04, finishMat('marble', '#ffffff'), 0, 0.75, 0));
  g.add(boxB(o.w, h - 0.79, 0.05, wood, 0, 0.79, -o.d / 2 + 0.025));
  for (const sx of [-1, 1]) g.add(boxB(0.08, h - 0.79, 0.08, wood, sx * (o.w / 2 - 0.04), 0.79, o.d / 2 - 0.06));
  g.add(boxB(o.w + 0.06, 0.08, o.d + 0.06, wood, 0, h, 0));
  const dome = new THREE.Mesh(new THREE.ConeGeometry(Math.min(o.w, o.d) * 0.55, 0.35, 4), gold); dome.rotation.y = Math.PI / 4; dome.position.y = h + 0.25; g.add(dome);
  g.add(boxB(o.w * 0.5, 0.45, 0.04, colorMat('#e7b04b', 0.3, 0.5, { emissive: '#7a4a00', emissiveIntensity: 0.4 }), 0, 0.95, -o.d / 2 + 0.06));
  for (const sx of [-1, 1]) {
    g.add(cyl(0.04, 0.06, 0.12, gold, sx * o.w * 0.3, 0.79, 0.05, 10));
    g.add(cyl(0.012, 0.012, 0.05, colorMat('#ffb347', 0.3, 0, { emissive: '#ff9a1f', emissiveIntensity: 3 }), sx * o.w * 0.3, 0.91, 0.05, 6));
  }
};
B.fridge = (o, g) => {
  const m = colorMat('#d7dadd', 0.25, 0.6), seam = colorMat('#555', 0.5);
  if (o.w > 0.82) {
    // side-by-side double door
    g.add(boxB(o.w, 1.8, o.d, m, 0, 0, 0), boxB(0.01, 1.76, 0.01, seam, 0, 0.02, o.d / 2));
    for (const s of [-1, 1]) g.add(boxB(0.02, 0.6, 0.03, CHROME(), s * 0.05, 0.7, o.d / 2 + 0.02));
    return;
  }
  g.add(boxB(o.w, 1.8, o.d, m, 0, 0, 0), boxB(o.w, 0.01, 0.01, seam, 0, 1.15, o.d / 2));
  for (const y of [0.7, 1.35]) g.add(boxB(0.02, 0.35, 0.03, CHROME(), o.w / 2 - 0.08, y, o.d / 2 + 0.02));
};
B.nightstand = (o, g) => {
  const m = colorMat(o.color || '#8a6a4a', 0.5), knob = CHROME();
  g.add(boxB(o.w, 0.5, o.d, m, 0, 0.05, 0), boxB(o.w - 0.04, 0.05, o.d - 0.04, colorMat('#2f2a26', 0.6), 0, 0, 0));
  for (const y of [0.17, 0.39]) g.add(boxB(o.w - 0.04, 0.005, 0.005, colorMat('#5a4632', 0.6), 0, y, o.d / 2), box(0.08, 0.015, 0.02, knob, 0, y + 0.07, o.d / 2 + 0.01));
  g.add(cyl(0.06, 0.08, 0.04, colorMat('#e5e0d6', 0.5), -o.w / 4, 0.55, 0, 16), cyl(0.012, 0.012, 0.25, CHROME(), -o.w / 4, 0.59, 0, 8));
  g.add(cyl(0.07, 0.11, 0.16, colorMat('#f6efe0', 0.8, 0, { emissive: '#ffd9a0', emissiveIntensity: 0.6 }), -o.w / 4, 0.82, 0, 18));
};
B.dressing = (o, g) => {
  const m = colorMat(o.color || '#b48a5e', 0.5);
  g.add(boxB(o.w, 0.76, o.d, m, 0, 0, 0), boxB(o.w + 0.02, 0.03, o.d + 0.02, finishMat('marble', '#ffffff'), 0, 0.76, 0));
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(1, 40), colorMat('#c9d6df', 0.03, 0.95)); mirror.scale.set(o.w * 0.32, 0.42, 1); mirror.position.set(0, 1.3, -o.d / 2 + 0.03); g.add(mirror);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), m); frame.scale.set(o.w * 0.32, 0.42, 0.4); frame.position.copy(mirror.position); g.add(frame);
  g.add(cyl(0.18, 0.18, 0.06, finishMat('fabric', '#e5e0d6'), 0, 0.42, o.d / 2 + 0.25, 20), cyl(0.03, 0.03, 0.42, colorMat('#2f2a26', 0.6), 0, 0, o.d / 2 + 0.25, 8));
};
B.cot = (o, g) => {
  const m = colorMat(o.color || '#f3ede3', 0.5), rails = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(boxB(0.05, 0.95, 0.05, m, x * (o.w / 2 - 0.025), 0, z * (o.d / 2 - 0.025)));
  g.add(boxB(o.w - 0.06, 0.12, o.d - 0.06, finishMat('fabric', '#ffffff'), 0, 0.3, 0));
  for (let x = -o.w / 2 + 0.07; x < o.w / 2 - 0.04; x += 0.075) for (const z of [-1, 1]) rails.push({ w: 0.02, h: 0.5, d: 0.02, x, y: 0.67, z: z * (o.d / 2 - 0.025) });
  for (let z = -o.d / 2 + 0.07; z < o.d / 2 - 0.04; z += 0.075) for (const x of [-1, 1]) rails.push({ w: 0.02, h: 0.5, d: 0.02, x: x * (o.w / 2 - 0.025), y: 0.67, z });
  g.add(mergedBoxes(rails, m));
  for (const z of [-1, 1]) g.add(boxB(o.w, 0.04, 0.05, m, 0, 0.92, z * (o.d / 2 - 0.025)));
  for (const x of [-1, 1]) g.add(boxB(0.05, 0.04, o.d, m, x * (o.w / 2 - 0.025), 0.92, 0));
};
B.coffeetable = (o, g) => {
  const wood = finishMat('wood', o.color || '#8a6a4a'), dark = colorMat('#2f2a26', 0.6);
  g.add(boxB(o.w, 0.04, o.d, wood, 0, 0.4, 0), boxB(o.w - 0.12, 0.02, o.d - 0.12, wood, 0, 0.12, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(boxB(0.04, 0.4, 0.04, dark, x * (o.w / 2 - 0.06), 0, z * (o.d / 2 - 0.06)));
  g.add(cyl(0.06, 0.05, 0.12, colorMat('#e7e2d6', 0.3), o.w * 0.2, 0.44, 0, 14));
};
B.shoerack = (o, g) => {
  const m = colorMat(o.color || '#9a7b5b', 0.55), h = 0.95, rnd = seeded(seedOf(o)), shoes = [];
  g.add(boxB(o.w, h, 0.02, m, 0, 0, -o.d / 2 + 0.01), boxB(0.02, h, o.d, m, -o.w / 2 + 0.01, 0, 0), boxB(0.02, h, o.d, m, o.w / 2 - 0.01, 0, 0));
  for (let i = 0; i <= 3; i++) {
    g.add(boxB(o.w, 0.02, o.d, m, 0, (i * h) / 3 - (i === 3 ? 0.02 : 0), 0));
    if (i < 3) for (let x = -o.w / 2 + 0.12; x < o.w / 2 - 0.1; x += 0.2) shoes.push({ w: 0.09, h: 0.08, d: o.d * 0.75, x: x + rnd() * 0.03, y: (i * h) / 3 + 0.06, z: 0 });
  }
  g.add(mergedBoxes(shoes, colorMat(['#3f3f46', '#7c2d12', '#1e3a8a', '#e5e7eb'][Math.floor(rnd() * 4)], 0.6)));
};
B.floorlamp = (o, g) => {
  const metal = colorMat('#2f2a26', 0.4, 0.6), r = o.w / 2;
  g.add(cyl(r * 0.6, r * 0.7, 0.03, metal, 0, 0, 0, 20), cyl(0.012, 0.012, 1.45, metal, 0, 0.03, 0, 8));
  g.add(cyl(r * 0.55, r, 0.32, colorMat(o.color || '#f1e6cf', 0.8, 0, { emissive: '#ffd9a0', emissiveIntensity: 0.55, side: THREE.DoubleSide }), 0, 1.38, 0, 24));
};
B.island = (o, g) => {
  g.add(boxB(o.w, 0.86, o.d, colorMat(o.color || '#f2f0eb', 0.45), 0, 0, 0), boxB(o.w + 0.1, 0.04, o.d + 0.3, finishMat('marble', '#5a5d63'), 0, 0.86, 0.15));
  for (const x of [-o.w / 3, 0, o.w / 3]) g.add(cyl(0.17, 0.17, 0.05, finishMat('fabric', '#3f4a5a'), x, 0.65, o.d / 2 + 0.3, 16), cyl(0.025, 0.025, 0.65, CHROME(), x, 0, o.d / 2 + 0.3, 8));
};
B.armchair = (o, g) => B.sofa(o, g);
B.rug = (o, g) => { const m = boxB(o.w, 0.012, o.d, finishMat('carpet', o.color || '#9c7a55'), 0, 0.022, 0); m.userData.passable = true; g.add(m); };
B.watertank = (o, g) => {
  const m = colorMat('#1f2937', 0.6), h = o.h || 1.3, r = o.w / 2;
  g.add(cyl(r, r, h, m, 0, 0, 0, 28), cyl(r * 0.35, r * 0.35, 0.08, m, 0, h, 0, 20));
  for (let i = 1; i < 4; i++) g.add(cyl(r + 0.01, r + 0.01, 0.03, colorMat('#111827', 0.5), 0, (i * h) / 4, 0, 28));
};
B.solar = (o, g) => {
  const t = (o.tilt ?? 12) * DEG, panel = colorMat('#1e3a8a', 0.15, 0.6), frame = colorMat('#cbd5e1', 0.3, 0.8);
  const p = new THREE.Group(); p.rotation.x = -t; p.position.y = 0.3 + (o.d / 2) * Math.sin(t);
  p.add(box(o.w, 0.04, o.d, panel), box(o.w + 0.03, 0.03, 0.03, frame, 0, 0, o.d / 2), box(o.w + 0.03, 0.03, 0.03, frame, 0, 0, -o.d / 2));
  const lines = [];
  for (let x = -o.w / 2 + 1; x < o.w / 2; x += 1) lines.push({ w: 0.015, h: 0.045, d: o.d, x, y: 0, z: 0 });
  for (let z = -o.d / 2 + 1; z < o.d / 2; z += 1) lines.push({ w: o.w, h: 0.045, d: 0.015, x: 0, y: 0, z });
  if (lines.length) p.add(mergedBoxes(lines, frame));
  g.add(p);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hh = 0.3 + (o.d / 2) * Math.sin(t) - sz * (o.d / 2 - 0.2) * Math.sin(t);
    g.add(boxB(0.05, hh, 0.05, frame, sx * (o.w / 2 - 0.2), 0, sz * (o.d / 2 - 0.2)));
  }
};
B.septic = (o, g) => {
  const c = finishMat('concrete', '#bdb8af');
  g.add(boxB(o.w, 0.06, o.d, c, 0, 0, 0));
  for (const x of [-o.w / 4, o.w / 4]) g.add(cyl(0.3, 0.3, 0.03, colorMat('#4b5563', 0.6, 0.4), x, 0.06, 0, 20));
};
B.well = (o, g) => {
  const r = o.w / 2, h = o.h || 0.9, lat = finishMat('laterite', '#ffffff'), wood = colorMat('#5a3a22', 0.6);
  const ring = new THREE.Mesh(planarUV(new THREE.CylinderGeometry(r, r, h, 32, 1, true)), lat); ring.position.y = h / 2; g.add(ring);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.22, r - 0.22, h, 32, 1, true), finishMat('laterite', '#bbbbbb', { side: THREE.BackSide })); inner.position.y = h / 2; g.add(inner);
  const top = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r + 0.02, 32), finishMat('stone', '#ffffff')); top.rotation.x = -Math.PI / 2; top.position.y = h + 0.001; g.add(top);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.22, 32), waterTint('#2f5d73')); water.rotation.x = -Math.PI / 2; water.position.y = 0.05; water.userData.noShadow = true; g.add(water);
  for (const sx of [-1, 1]) g.add(boxB(0.12, 1.6, 0.12, wood, sx * (r - 0.06), h, 0));
  g.add(box(o.w + 0.1, 0.12, 0.12, wood, 0, h + 1.6, 0));
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), colorMat('#7c6a58', 0.5, 0.6)); pulley.position.set(0, h + 1.45, 0); pulley.rotation.y = Math.PI / 2; g.add(pulley);
  g.add(beam(new THREE.Vector3(0, h + 1.45, 0.12), new THREE.Vector3(0, h + 0.3, 0.12), 0.01, colorMat('#c2a77a', 0.9)));
};
B.acunit = (o, g) => {
  g.add(boxB(o.w, 0.55, o.d, colorMat('#eef1f3', 0.4), 0, 0.2, 0));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), colorMat('#475569', 0.5)); fan.rotation.x = Math.PI / 2; fan.position.set(o.w * 0.15, 0.47, o.d / 2 + 0.005); g.add(fan);
  for (const sx of [-1, 1]) g.add(boxB(0.04, 0.2, o.d, colorMat('#64748b', 0.4, 0.6), sx * (o.w / 2 - 0.08), 0, 0));
};

// ---------------------------------------------------------------- garden & sit-outs
B.hedge = (o, g) => {
  const geo = new THREE.BoxGeometry(o.w, o.h, Math.max(0.2, o.d), Math.ceil(o.w * 5), Math.ceil(o.h * 5), Math.ceil(o.d * 5));
  const p = geo.attributes.position, jit = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return (s - Math.floor(s) - 0.5) * 0.12; };
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + jit(x, y, z), y + jit(y, z, x), z + jit(z, x, y)); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, colorMat(o.color || '#3f6b2e', 0.9, 0, { flatShading: true })); m.position.y = o.h / 2; g.add(m);
};
B.flowerbed = (o, g) => {
  const edge = o.edge === 'none' ? null : finishMat(o.edge === 'stone' ? 'stone' : 'brick', '#ffffff');
  g.add(slab(o, 0.12, 0.1, colorMat('#5b4030', 1), edge || colorMat('#5b4030', 1)));
  const pts = floorPoly(o), rnd = seeded(seedOf(o)), n = Math.min(900, Math.floor(o.w * o.d * 40));
  const cols = ['#d9354c', '#f0a020', '#f3d23a', '#e86fb0', '#8a5cd6', '#ffffff'];
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 0), colorMat('#ffffff', 0.6), n);
  const lv = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), colorMat('#4c7a32', 0.85, 0, { flatShading: true }), n);
  const M = new THREE.Matrix4(), c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = (rnd() - 0.5) * o.w, y = (rnd() - 0.5) * o.d;
    if (!pointInPolyLocal(x, y, pts)) continue;
    const h = 0.18 + rnd() * 0.15;
    M.makeTranslation(x, 0.1 + h, y); fl.setMatrixAt(k, M);
    c.set(o.color === 'mix' || !o.color ? cols[Math.floor(rnd() * cols.length)] : o.color); fl.setColorAt(k, c);
    M.makeTranslation(x, 0.1 + h * 0.55, y); lv.setMatrixAt(k, M);
    k++;
  }
  fl.count = lv.count = k;
  g.add(fl, lv);
};
const pointInPolyLocal = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
B.pot = (o, g) => {
  const r = o.w / 2, ph = r * 1.4;
  g.add(cyl(r, r * 0.72, ph, colorMat(o.color || '#b5653d', 0.8), 0, 0, 0, 20), cyl(r * 0.9, r * 0.9, 0.02, colorMat('#4a3526', 1), 0, ph - 0.03, 0, 20));
  const rnd = seeded(seedOf(o)), leaf = colorMat('#4f7f3a', 0.8, 0, { flatShading: true, side: THREE.DoubleSide }), H = Math.max(0.3, o.h - ph);
  if (o.variety === 'cactus') { g.add(cyl(r * 0.35, r * 0.4, H, colorMat('#5f8a4a', 0.8), 0, ph, 0, 8)); return; }
  if (o.variety === 'palm') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, stem = beam(new THREE.Vector3(0, ph, 0), new THREE.Vector3(Math.cos(a) * H * 0.3, ph + H, Math.sin(a) * H * 0.3), 0.02, colorMat('#6b7d3a', 0.8)); g.add(stem);
      const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), leaf); fr.scale.set(0.18, 0.02, H * 0.25); fr.position.set(Math.cos(a) * H * 0.35, ph + H * 0.95, Math.sin(a) * H * 0.35); fr.rotation.y = -a + Math.PI / 2; g.add(fr);
    }
    return;
  }
  const m = blob(Math.max(0.2, Math.min(r * 1.4, H * 0.6)), rnd, colorMat('#4f7f3a', 0.85, 0, { flatShading: true }));
  m.position.y = ph + H * 0.5; g.add(m);
  if (o.variety === 'flower') for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), colorMat(['#e86fb0', '#d9354c', '#f3d23a'][i % 3], 0.6)); f.position.set((rnd() - 0.5) * r * 2, ph + H * (0.5 + rnd() * 0.45), (rnd() - 0.5) * r * 2); g.add(f); }
};
B.tulsi = (o, g) => {
  const m = finishMat('plaster', o.color || '#e9dcc2'), red = colorMat('#9b2c2c', 0.7), h = o.h || 1.1;
  g.add(boxB(o.w, 0.15, o.w, m, 0, 0, 0), boxB(o.w * 0.85, 0.12, o.w * 0.85, red, 0, 0.15, 0), boxB(o.w * 0.7, h - 0.45, o.w * 0.7, m, 0, 0.27, 0));
  g.add(boxB(o.w * 0.85, 0.08, o.w * 0.85, red, 0, h - 0.18, 0), boxB(o.w * 0.75, 0.1, o.w * 0.75, m, 0, h - 0.1, 0));
  g.add(boxB(0.16, 0.18, 0.02, colorMat('#2b1d14', 1), 0, 0.45, o.w * 0.35 + 0.005));
  const p = blob(0.22, seeded(seedOf(o)), colorMat('#3f7a2e', 0.85, 0, { flatShading: true })); p.position.y = h + 0.18; g.add(p);
};
B.bench = (o, g) => {
  const wood = finishMat('wood', o.color || '#8a5a33'), iron = METAL_DARK(), slats = [];
  for (let i = 0; i < 4; i++) slats.push({ w: o.w, h: 0.03, d: o.d / 5, x: 0, y: 0.43, z: -o.d / 2 + (i + 0.6) * (o.d / 4.2) });
  for (let i = 0; i < 3; i++) slats.push({ w: o.w, h: 0.08, d: 0.025, x: 0, y: 0.55 + i * 0.12, z: -o.d / 2 - 0.02 });
  g.add(mergedBoxes(slats, wood));
  for (const sx of [-1, 1]) { g.add(boxB(0.05, 0.42, o.d - 0.05, iron, sx * (o.w / 2 - 0.12), 0, 0), boxB(0.05, 0.45, 0.05, iron, sx * (o.w / 2 - 0.12), 0.42, -o.d / 2)); }
};
B.swing = (o, g) => {
  const wood = colorMat(o.color || '#7a5230', 0.55), sw = o.w * 0.75, chain = colorMat('#a8a29e', 0.3, 0.9), top = o.h;
  const sy = 0.45;
  g.add(boxB(sw, 0.06, 0.55, finishMat('wood', '#ffffff'), 0, sy, 0), boxB(sw, 0.4, 0.04, wood, 0, sy + 0.06, -0.26));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(beam(new THREE.Vector3(sx * (sw / 2 - 0.05), sy + 0.06, sz * 0.24), new THREE.Vector3(sx * (sw / 2 - 0.05), top, sz * 0.05), 0.015, chain));
  if (o.style !== 'hanging') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(beam(new THREE.Vector3(sx * o.w / 2, 0, sz * o.d / 2), new THREE.Vector3(sx * o.w / 2, top, 0), 0.08, wood));
    g.add(box(o.w + 0.2, 0.1, 0.1, wood, 0, top + 0.03, 0));
  }
};
B.sitout = (o, g) => {
  const wood = colorMat('#7a5230', 0.55), cush = finishMat('fabric', o.color || '#c9b28a');
  if (o.style === 'charupadi') {
    g.add(boxB(o.w, 0.42, o.d, finishMat('laterite', '#ffffff'), 0, 0, 0), boxB(o.w + 0.04, 0.05, o.d + 0.04, wood, 0, 0.42, 0));
    const back = box(o.w, 0.55, 0.04, wood, 0, 0, 0); back.position.set(0, 0.72, -o.d / 2 - 0.08); back.rotation.x = -0.3; g.add(back);
    return;
  }
  const table = cyl(0.3, 0.3, 0.03, finishMat('wood', '#ffffff'), 0, 0.45, o.d / 2 - 0.35, 20); g.add(table, cyl(0.03, 0.12, 0.45, wood, 0, 0, o.d / 2 - 0.35, 10));
  const seat = (x, z, w, rot = 0) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rot;
    s.add(boxB(w, 0.12, 0.6, cush, 0, 0.32, 0), boxB(w, 0.45, 0.1, cush, 0, 0.44, -0.27), boxB(w + 0.08, 0.32, 0.66, wood, 0, 0, 0));
    g.add(s);
  };
  if (o.style === 'sofa') { seat(0, -o.d / 2 + 0.35, Math.min(2.2, o.w * 0.8)); seat(-o.w / 2 + 0.35, 0.1, 0.7, Math.PI / 2); }
  else { seat(-o.w / 2 + 0.38, -o.d / 2 + 0.38, 0.65, 0.4); seat(o.w / 2 - 0.38, -o.d / 2 + 0.38, 0.65, -0.4); }
};
B.fountain = (o, g) => {
  const r = o.w / 2, st = finishMat('stone', '#ffffff');
  g.add(cyl(r, r, 0.45, st, 0, 0, 0, 32));
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(r - 0.12, 32), waterTint('#5cc4e6')); w1.rotation.x = -Math.PI / 2; w1.position.y = 0.42; g.add(w1);
  g.add(cyl(0.12, 0.18, o.h - 0.2, st, 0, 0.45, 0, 16), cyl(r * 0.45, r * 0.3, 0.15, st, 0, o.h * 0.65, 0, 24));
  const w2 = new THREE.Mesh(new THREE.CircleGeometry(r * 0.4, 24), waterTint('#5cc4e6')); w2.rotation.x = -Math.PI / 2; w2.position.y = o.h * 0.65 + 0.151; g.add(w2);
  g.add(cyl(0.05, 0.08, 0.2, st, 0, o.h * 0.65 + 0.15, 0, 10));
};
B.rocks = (o, g) => {
  const rnd = seeded(seedOf(o)), m = colorMat('#8f8a82', 0.95, 0, { flatShading: true });
  for (let i = 0; i < 5; i++) {
    const s = 0.2 + rnd() * 0.35, r = blob(s, rnd, m);
    r.userData.passable = false; // stones are solid
    r.scale.set(o.w / 2.5, (o.h || 0.6) / 0.8, o.d / 2.5); r.position.set((rnd() - 0.5) * o.w * 0.6, s * 0.4, (rnd() - 0.5) * o.d * 0.6); g.add(r);
  }
};

export function buildItem(o, doc) {
  const fn = B[o.type];
  if (!fn) return null;
  const g = new THREE.Group();
  const lift = o.type === 'portico' && o.level === 0 ? Math.max(0, (doc.plinth || 0) - 0.2) : 0;
  if (lift > 0.01) {
    // raise the portico to the plinth and give it a solid base with a flight of front steps
    const inner = new THREE.Group();
    fn({ ...o, steps: false }, inner, doc);
    inner.position.y = lift; g.add(inner);
    const base = finishMat(doc.plinthFinish || 'stone', '#ffffff'), tread = finishMat('marble', '#ffffff');
    g.add(boxB(o.w, lift, o.d, base, 0, 0, 0));
    const total = lift + 0.2, n = Math.max(1, Math.round(total / 0.15)), r = total / n, t = 0.3;
    for (let i = 0; i < n; i++) g.add(boxB(o.w * 0.7, r * (i + 1), t, [base, base, tread, base, base, base], 0, 0, o.d / 2 + (n - i - 0.5) * t));
  } else fn(o, g, doc);
  g.position.set(o.x, baseElev(o, doc) + (o.z || 0), o.y);
  g.rotation.y = -(o.rot || 0) * DEG;
  g.userData.id = o.id;
  return g;
}

// Plinth: solid base from ground to finished floor level under every ground-floor slab.
export function buildPlinth(doc) {
  const h = doc.plinth || 0;
  if (h < 0.02) return null;
  const g = new THREE.Group(), mat = finishMat(doc.plinthFinish || 'stone', '#ffffff'), band = finishMat('concrete', '#cfc9bf');
  for (const o of doc.objects) {
    if (o.type !== 'floor' || o.level !== 0 || o.z || o.hidden) continue;
    const pts = floorPoly(o), part = new THREE.Group();
    part.add(prism(pts, 0, h - 0.1, mat), prism(pts, h - 0.1, h - 0.005, band)); // plinth beam band on top
    part.position.set(o.x, 0, o.y); part.rotation.y = -(o.rot || 0) * DEG;
    g.add(part);
  }
  // plinth walls under every ground-floor wall, slightly projecting like a real plinth offset
  for (const w of doc.objects) {
    if (w.type !== 'wall' || w.level !== 0 || w.hidden) continue;
    const L = wallLen(w), T = w.thickness + (w.kind === 'interior' ? 0 : 0.06);
    if (wallArc(w)) {
      const n = Math.max(1, Math.ceil(L / 0.3)), step = L / n;
      for (let i = 0; i < n; i++) {
        const q = wallPointAt(w, (i + 0.5) * step), seg = box(step * 1.05, h, T, mat, 0, h / 2, 0);
        seg.position.set(q.x, h / 2, q.y); seg.rotation.y = -q.a; g.add(seg);
      }
      continue;
    }
    const m = new THREE.Group();
    m.add(box(L + T, h - 0.1, T, mat, L / 2, (h - 0.1) / 2, 0), box(L + T, 0.1, T, band, L / 2, h - 0.05, 0));
    m.position.set(w.x1, 0, w.y1); m.rotation.y = -wallAng(w);
    g.add(m);
  }
  return g;
}

// The plot on the ground: a white property line with a concrete survey peg at every corner.
export function buildPlotMarks(doc) {
  const pts = doc.plot?.pts;
  if (!pts || pts.length < 3) return null;
  const g = new THREE.Group(), line = colorMat('#f8fafc', 0.8), peg = finishMat('concrete', '#d6d3cc');
  pts.forEach(([x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length], L = Math.hypot(x2 - x, y2 - y);
    const m = box(L, 0.012, 0.08, line, (x + x2) / 2, 0.012, (y + y2) / 2);
    m.rotation.y = -Math.atan2(y2 - y, x2 - x); m.userData.passable = true; m.userData.noShadow = true;
    g.add(m, boxB(0.15, 0.3, 0.15, peg, x, 0, y));
  });
  return g;
}

export function finalizeShadows(root) {
  root.traverse((m) => {
    if (m.isMesh) { m.castShadow = !m.userData.noShadow; m.receiveShadow = true; }
  });
}

// Interactive 2D floor-plan editor drawn on a canvas.
import {
  store, emit, checkpoint, dropIfUnchanged, wallsOn, openingsOf, wallLen, wallAng, projectToSegment, projectToWall, wallArc, wallPointAt, wallSamples,
  toLocal, toWorld, levelCentroid, outwardSign, fmtLen, snapVal, fromUnit, toUnit, DEG, FT, uid,
  dims, wallDimLen, setWallLength, fmtArea, getObj, openingTags, isDimLocked,
} from './state.js';
import { plotOf, setbackPoly, setSide, plotEditBlock, CENT, SQFT } from './plot.js';
import { TYPES, CATALOG_INDEX, drawOpening2D, floorPoly, polyArea, pointInPoly, normalizeCustom, setSideLength, ROOM_PRESETS, inScope, presetItems } from './catalog.js';

const PAPER = '#fbfaf7';
// a typed length in the current unit; in feet, 10'6 means 10 ft 6 in
const typedLen = (s) => {
  const m = String(s).match(/^\s*([\d.]*)\s*'\s*([\d.]*)/);
  return fromUnit(m ? (parseFloat(m[1]) || 0) + (parseFloat(m[2]) || 0) / 12 : parseFloat(s));
};
const chordHalf = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 2;
const SLABS = new Set(['floor', 'paving', 'flowerbed']);
// drawing order: the type's layer plus the user's bring-forward / send-back offset
const zOrder = (o) => (TYPES[o.type]?.z2d ?? 5) + (o.zb || 0);
const signedArea = (pts) => pts.reduce((s, [x1, y1], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x1 * y2 - x2 * y1; }, 0) / 2;
const ACCENT = '#2563eb';
const GUIDE = '#0891b2';
// crossing of two infinite lines given as {x1,y1,x2,y2}; null when parallel
const lineX = (a, b) => {
  const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1, den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
  return { x: a.x1 + d1x * t, y: a.y1 + d1y * t };
};
// nearest point on the infinite line through a guide
const projLine = (px, py, g) => {
  const dx = g.x2 - g.x1, dy = g.y2 - g.y1, t = ((px - g.x1) * dx + (py - g.y1) * dy) / (dx * dx + dy * dy || 1);
  const x = g.x1 + dx * t, y = g.y1 + dy * t;
  return { x, y, d: Math.hypot(px - x, py - y) };
};
const HANDLE = 9;

export class Plan2D {
  constructor(canvas, app) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.scale = 36; this.ox = 120; this.oy = 120;
    this.vr = 0; // view rotation (radians, clockwise on screen); the plan is always seen from the top
    this.mouse = { sx: 0, sy: 0, x: 0, y: 0, inside: false };
    this.drag = null; this.draft = null; this.preview = null; this.measure = null;
    this.typed = ''; this.hoverId = null; this.snapMark = null; this.shift = false; this.space = false;
    this.dragOver = false; this.ghostCache = {};
    this.dirty = true;

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointerleave', () => { this.mouse.inside = false; this.hoverId = null; this.redraw(); });
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      if (store.tool === 'wall') { this.finishDraft(); return; }
      const p = this.evPos(e);
      const hv = this.hitHandle(p);
      if (hv?.mode === 'vertex' && hv.o.pts.length > 3) {
        checkpoint(); hv.o.pts.splice(hv.i, 1); normalizeCustom(hv.o); emit('doc'); this.app.toast('Corner removed');
        return;
      }
      const hit = (this.dimHits || []).find((b) => Math.abs(p.sx - b.x) <= b.w / 2 + 3 && Math.abs(p.sy - b.y) <= b.h / 2 + 3);
      if (hit) this.editDim(hit);
      else if (store.selectedId) this.app.focusProps();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dragover', (e) => {
      if (!store.dragKey) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      Object.assign(this.mouse, this.evPos(e), { inside: true });
      this.dragOver = true; this.redraw();
    });
    canvas.addEventListener('dragleave', () => { this.dragOver = false; this.redraw(); });
    canvas.addEventListener('drop', (e) => {
      e.preventDefault(); this.dragOver = false;
      const key = store.dragKey || e.dataTransfer.getData('text/plain');
      store.dragKey = null;
      const p = this.snapPoint(this.evPos(e));
      if (key) this.app.placeAt(key, p.x, p.y);
    });
    const loop = () => { if (this.dirty) { this.dirty = false; this.draw(); } requestAnimationFrame(loop); };
    loop();
  }

  // ------------------------------------------------------------ view transform
  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.W = r.width; this.H = r.height;
    this.c.width = Math.max(1, r.width * this.dpr); this.c.height = Math.max(1, r.height * this.dpr);
    this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    if (!this.userMoved && r.width > 50) this.fit();
    this.redraw();
  }
  redraw() { this.dirty = true; }
  w2s(x, y) {
    const c = Math.cos(this.vr), s = Math.sin(this.vr);
    return [(x * c - y * s) * this.scale + this.ox, (x * s + y * c) * this.scale + this.oy];
  }
  s2w(sx, sy) {
    const c = Math.cos(this.vr), s = Math.sin(this.vr), u = (sx - this.ox) / this.scale, v = (sy - this.oy) / this.scale;
    return [u * c + v * s, -u * s + v * c];
  }
  // Turn the top view: by a step, or so that a compass direction points up the screen.
  setRotation(rad) {
    const cx = this.W / 2, cy = this.H / 2, [wx, wy] = this.s2w(cx, cy);
    this.vr = Math.atan2(Math.sin(rad), Math.cos(rad));
    const [sx, sy] = this.w2s(wx, wy);
    this.ox += cx - sx; this.oy += cy - sy; // keep the same spot in the middle of the screen
    this.redraw();
  }
  // compass bearing (degrees, clockwise from north) that points up the screen
  get upBearing() { return ((((-this.vr * 180) / Math.PI - (store.doc.north || 0)) % 360) + 360) % 360; }
  evPos(e) {
    const r = this.c.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [x, y] = this.s2w(sx, sy);
    return { sx, sy, x, y };
  }
  worldT() {
    const d = this.dpr, s = this.scale, c = Math.cos(this.vr), n = Math.sin(this.vr);
    this.ctx.setTransform(d * s * c, d * s * n, -d * s * n, d * s * c, d * this.ox, d * this.oy);
  }
  screenT() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  bounds(all = true) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const o of store.doc.objects) {
      if (!all && o.level !== store.level) continue;
      if (o.type === 'wall') { add(o.x1, o.y1); add(o.x2, o.y2); if (wallArc(o)) for (const [x, y] of wallSamples(o)) add(x, y); }
      else if (o.w) {
        const ov = o.overhang || 0;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(...toWorld(o, sx * (o.w / 2 + ov), sy * (o.d / 2 + ov)));
      }
    }
    const plot = plotOf(store.doc);
    if (plot) for (const [x, y] of plot.pts) add(x, y);
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
  fit() {
    const b = this.bounds();
    if (!b || !this.W) { this.scale = 36; this.ox = this.W / 2 || 200; this.oy = this.H / 2 || 200; this.redraw(); return; }
    const pad = 70, c = Math.cos(this.vr), s = Math.sin(this.vr);
    // extents of the bounds as they appear on the (possibly rotated) screen
    const rot = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
    const rx0 = Math.min(...rot.map((p) => p[0])), rx1 = Math.max(...rot.map((p) => p[0])), ry0 = Math.min(...rot.map((p) => p[1])), ry1 = Math.max(...rot.map((p) => p[1]));
    this.scale = Math.max(4, Math.min(200, Math.min((this.W - pad * 2) / (rx1 - rx0 || 1), (this.H - pad * 2) / (ry1 - ry0 || 1))));
    this.ox = this.W / 2 - ((rx0 + rx1) / 2) * this.scale;
    this.oy = this.H / 2 - ((ry0 + ry1) / 2) * this.scale;
    this.redraw();
  }
  zoomBy(f, sx = this.W / 2, sy = this.H / 2) {
    this.userMoved = true;
    const ns = Math.max(4, Math.min(400, this.scale * f));
    this.ox = sx - ((sx - this.ox) * ns) / this.scale;
    this.oy = sy - ((sy - this.oy) * ns) / this.scale;
    this.scale = ns;
    this.redraw();
  }

  // ------------------------------------------------------------ snapping
  snapOn() { return store.view.snap && !this.shift; }
  findEndpoint(p, excludeId) {
    const tol = 12 / this.scale;
    let best = null, bd = tol;
    const faces = store.tool === 'dimension' || store.tool === 'measure';
    for (const w of wallsOn(store.level)) {
      if (w.id === excludeId) continue;
      // dimension & measure tools also snap to the wall face corners (outside/inside faces)
      const pts = [[w.x1, w.y1], [w.x2, w.y2], ...(faces ? this.wallPoly(w) : [])];
      for (const [x, y] of pts) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    if (faces) for (const op of store.doc.objects) {
      if (!op.wallId || op.level !== store.level) continue;
      const w = getObj(op.wallId);
      if (!w) continue;
      const a = wallAng(w);
      for (const t of [op.t - op.width / 2, op.t + op.width / 2]) for (const s of [-1, 1]) {
        const x = w.x1 + Math.cos(a) * t - Math.sin(a) * s * (w.thickness / 2), y = w.y1 + Math.sin(a) * t + Math.cos(a) * s * (w.thickness / 2);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    return best;
  }
  findWallLine(p, excludeId) {
    const tol = 10 / this.scale;
    for (const w of wallsOn(store.level)) {
      if (w.id === excludeId) continue;
      const pr = projectToWall(p.x, p.y, w);
      if (pr.d < Math.max(tol, w.thickness / 2)) return { x: pr.x, y: pr.y };
    }
    return null;
  }
  snapPoint(p, excludeId) {
    if (!this.snapOn()) return { x: p.x, y: p.y };
    const ep = this.findEndpoint(p, excludeId);
    if (ep) { this.snapMark = ep; return { ...ep }; }
    if (store.tool === 'measure' || store.tool === 'dimension') {
      const from = store.tool === 'measure' ? this.measure?.a : this.dimDraft;
      const f = this.snapFace(p, from);
      if (f) { this.snapMark = f; this.snapLine = f; return { x: f.x, y: f.y }; }
    }
    const gp = this.snapGuide(p);
    if (gp) { this.snapMark = gp; return { x: gp.x, y: gp.y }; }
    if (store.tool !== 'select' && store.tool !== 'place') {
      const al = this.alignTo(p);
      if (al.x || al.y) return this.aligned(p, al);
    }
    return { x: snapVal(p.x), y: snapVal(p.y) };
  }
  guides() { return store.view.guides === false ? [] : store.doc.objects.filter((o) => o.type === 'guide' && o.level === store.level && !o.hidden); }
  // Guide snapping: crossings first (guide x guide, guide x straight wall), then any point on the nearest guide.
  snapGuide(p) {
    const gs = this.guides();
    if (!gs.length) return null;
    const tol = 10 / this.scale;
    let best = null, bd = tol * 1.4;
    const lines = [...gs, ...wallsOn(store.level).filter((w) => !wallArc(w))];
    for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const x = lineX(gs[i], lines[j]);
      if (!x) continue;
      if (lines[j].type === 'wall' && projectToWall(x.x, x.y, lines[j]).d > 0.01) continue; // only where the wall actually is
      const d = Math.hypot(p.x - x.x, p.y - x.y);
      if (d < bd) { bd = d; best = x; }
    }
    if (best) return { ...best, kind: 'cross' };
    let g0 = null, pr0 = null;
    for (const g of gs) { const pr = projLine(p.x, p.y, g); if (pr.d < tol && (!pr0 || pr.d < pr0.d)) { g0 = g; pr0 = pr; } }
    if (!g0) return null;
    let { x, y } = pr0;
    // along a horizontal or vertical guide, keep snapping to the grid step
    if (Math.abs(g0.y2 - g0.y1) < 1e-6) x = snapVal(x); else if (Math.abs(g0.x2 - g0.x1) < 1e-6) y = snapVal(y);
    return { x, y, kind: 'line', g: g0 };
  }
  // Wall reference lines: both faces and the centre line of every straight wall on this storey.
  wallLines() {
    const out = [];
    for (const w of wallsOn(store.level)) {
      if (wallArc(w) || w.hidden) continue;
      const a = wallAng(w), nx = -Math.sin(a), ny = Math.cos(a);
      for (const [k, off] of [['centre', 0], ['face', w.thickness / 2], ['face', -w.thickness / 2]]) {
        out.push({ kind: k, w, x1: w.x1 + nx * off, y1: w.y1 + ny * off, x2: w.x2 + nx * off, y2: w.y2 + ny * off });
      }
    }
    return out;
  }
  // Snap onto a wall face or centre line; from a first point, prefer the perpendicular foot (clear widths).
  snapFace(p, from) {
    const tol = 10 / this.scale;
    let best = null;
    for (const l of this.wallLines()) {
      if (from) {
        const f = projectToSegment(from.x, from.y, l.x1, l.y1, l.x2, l.y2);
        const fx = l.x1 + (l.x2 - l.x1) * f.t, fy = l.y1 + (l.y2 - l.y1) * f.t;
        const d = Math.hypot(p.x - fx, p.y - fy);
        if (f.t > 0.001 && f.t < 0.999 && f.d > 0.05 && d < tol * 1.6 && (!best || best.kind !== 'perp' || d < best.dist)) best = { x: fx, y: fy, kind: 'perp', line: l, dist: d };
      }
    }
    if (best) return best;
    for (const l of this.wallLines()) {
      const pr = projectToSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2);
      const score = pr.d + (l.kind === 'centre' ? 0.3 / this.scale : 0); // faces win ties: measurements are usually face to face
      if (pr.d < tol && (!best || score < best.dist)) best = { x: l.x1 + (l.x2 - l.x1) * pr.t, y: l.y1 + (l.y2 - l.y1) * pr.t, kind: l.kind, line: l, dist: score };
    }
    return best;
  }
  // Alignment (tracking) with existing corners: the pointer lines up with a point straight across or straight down.
  alignTo(p) {
    if (!this.snapOn()) return {};
    const tol = 7 / this.scale, pts = [];
    for (const w of wallsOn(store.level)) pts.push([w.x1, w.y1], [w.x2, w.y2]);
    if (this.draft) for (const q of this.draft.pts) pts.push([q.x, q.y]);
    for (const q of [this.measure?.a, this.dimDraft, this.guideDraft]) if (q) pts.push([q.x, q.y]);
    let ax = null, ay = null;
    for (const [x, y] of pts) {
      const dx = Math.abs(p.x - x), dy = Math.abs(p.y - y);
      if (dx < tol && dy > tol && (!ax || dx < ax.d)) ax = { v: x, from: [x, y], d: dx };
      if (dy < tol && dx > tol && (!ay || dy < ay.d)) ay = { v: y, from: [x, y], d: dy };
    }
    return { x: ax, y: ay };
  }
  aligned(p, al) {
    const x = al.x ? al.x.v : snapVal(p.x), y = al.y ? al.y.v : snapVal(p.y);
    this.alignMarks = [al.x && { from: al.x.from, to: [x, y] }, al.y && { from: al.y.from, to: [x, y] }].filter(Boolean);
    return { x, y };
  }
  // second point of a new guide: a wall corner, or the pointer at a 15 degree step from the first point
  guidePoint(p) {
    const a = this.guideDraft;
    if (!a) return this.snapPoint(p);
    if (!this.snapOn()) return { x: p.x, y: p.y };
    const ep = this.findEndpoint(p);
    if (ep) { this.snapMark = ep; return { ...ep }; }
    const L = Math.hypot(p.x - a.x, p.y - a.y), sa = Math.round(Math.atan2(p.y - a.y, p.x - a.x) / (15 * DEG)) * 15 * DEG, Ls = Math.max(snapVal(L), 0.1);
    return { x: +(a.x + Math.cos(sa) * Ls).toFixed(4), y: +(a.y + Math.sin(sa) * Ls).toFixed(4) };
  }
  snapWallPoint(p) {
    if (!this.snapOn()) return { x: p.x, y: p.y };
    const ep = this.findEndpoint(p);
    if (ep) { this.snapMark = ep; return { ...ep }; }
    const gp = this.snapGuide(p);
    if (gp?.kind === 'cross') { this.snapMark = gp; return { x: gp.x, y: gp.y }; }
    const last = this.draft?.pts[this.draft.pts.length - 1];
    if (last) {
      const dx = p.x - last.x, dy = p.y - last.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const sa = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      if (Math.abs(a - sa) < 7 * DEG) {
        if (gp) {
          // keep the straight angle and stop exactly on the guide
          const x = lineX({ x1: last.x, y1: last.y, x2: last.x + Math.cos(sa), y2: last.y + Math.sin(sa) }, gp.g);
          if (x && Math.hypot(x.x - p.x, x.y - p.y) < 14 / this.scale) { this.snapMark = x; return x; }
        } else {
          const Ls = snapVal(L), s = { x: +(last.x + Math.cos(sa) * Ls).toFixed(4), y: +(last.y + Math.sin(sa) * Ls).toFixed(4) };
          // a horizontal or vertical wall stops where it lines up with another corner
          const al = this.alignTo(p), horiz = Math.abs(Math.sin(sa)) < 1e-6, vert = Math.abs(Math.cos(sa)) < 1e-6;
          if (horiz && al.x) { s.x = al.x.v; this.alignMarks = [{ from: al.x.from, to: [s.x, s.y] }]; }
          if (vert && al.y) { s.y = al.y.v; this.alignMarks = [{ from: al.y.from, to: [s.x, s.y] }]; }
          return s;
        }
      }
    }
    if (gp) { this.snapMark = gp; return { x: gp.x, y: gp.y }; }
    const wl = this.findWallLine(p);
    if (wl) { this.snapMark = wl; return wl; }
    const al = this.alignTo(p);
    if (al.x || al.y) return this.aligned(p, al);
    return { x: snapVal(p.x), y: snapVal(p.y) };
  }

  // walls whose endpoints coincide with (x, y)
  linkedAt(x, y, excludeId) {
    const out = [];
    for (const w of wallsOn(store.level)) {
      if (w.id === excludeId) continue;
      if (isDimLocked(w, 'length') || w.locked) continue;
      if (Math.hypot(w.x1 - x, w.y1 - y) < 0.02) out.push({ w, e: 1, ox: w.x1, oy: w.y1 });
      if (Math.hypot(w.x2 - x, w.y2 - y) < 0.02) out.push({ w, e: 2, ox: w.x2, oy: w.y2 });
    }
    return out;
  }

  // ------------------------------------------------------------ hit testing
  hitHandle(p) {
    const o = this.app.selected();
    if (!o || o.level !== store.level || o.locked || o.hidden) return null;
    const near = (x, y) => { const [sx, sy] = this.w2s(x, y); return Math.hypot(sx - p.sx, sy - p.sy) < HANDLE; };
    if (o.type === 'wall' || o.type === 'dimension' || o.type === 'guide') {
      const link = (x, y) => (o.type === 'wall' ? this.linkedAt(x, y, o.id) : []);
      if (o.type === 'wall') {
        const m = this.bendPoint(o);
        if (near(m.x, m.y)) return { mode: 'bend', o };
      }
      if (near(o.x1, o.y1)) return { mode: 'endpoint', o, e: 1, linked: link(o.x1, o.y1) };
      if (near(o.x2, o.y2)) return { mode: 'endpoint', o, e: 2, linked: link(o.x2, o.y2) };
      return null;
    }
    if (TYPES[o.type]?.kind !== 'rect') return null;
    if (o.shape === 'custom' && o.pts) {
      for (let i = 0; i < o.pts.length; i++) if (near(...toWorld(o, ...o.pts[i]))) return { mode: 'vertex', o, i };
    }
    const [rx, ry] = toWorld(o, 0, -o.d / 2 - 28 / this.scale);
    if (near(rx, ry)) return { mode: 'rotate', o };
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [x, y] = toWorld(o, (sx * o.w) / 2, (sy * o.d) / 2);
      if (near(x, y)) return { mode: 'resize', o, sx, sy, orig: { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot || 0, pts: o.pts?.map((p) => [...p]) } };
    }
    return null;
  }
  hitTest(p) {
    const objs = store.doc.objects.filter((o) => o.level === store.level && !o.locked && !o.hidden && inScope(o, store.view.scope));
    const tol = 4 / this.scale;
    const walls = objs.filter((o) => o.type === 'wall');
    for (const o of objs) {
      if (o.type !== 'dimension') continue;
      const [a, b] = this.dimPoints(o);
      if (projectToSegment(p.x, p.y, a[0], a[1], b[0], b[1]).d < 7 / this.scale) return o;
    }
    for (const w of walls) {
      const pr = projectToWall(p.x, p.y, w), u = pr.t * wallLen(w);
      for (const op of openingsOf(w.id)) if (Math.abs(u - op.t) <= op.width / 2 && pr.d <= w.thickness / 2 + tol * 2) return op;
    }
    for (const w of walls) if (projectToWall(p.x, p.y, w).d <= w.thickness / 2 + tol) return w;
    if (store.view.guides !== false) for (const g of objs) if (g.type === 'guide' && projLine(p.x, p.y, g).d < 5 / this.scale) return g;
    const items = objs.filter((o) => TYPES[o.type]?.kind === 'rect').sort((a, b) => zOrder(b) - zOrder(a));
    for (const o of items) {
      const hit = TYPES[o.type].hit;
      if (hit === 'low') continue;
      const [lx, ly] = toLocal(o, p.x, p.y);
      if (hit === 'edge') {
        const ov = o.overhang || 0, hw = o.w / 2 + ov, hd = o.d / 2 + ov, t = 8 / this.scale;
        const inOuter = Math.abs(lx) <= hw + t && Math.abs(ly) <= hd + t, inInner = Math.abs(lx) < hw - t && Math.abs(ly) < hd - t;
        if (inOuter && !inInner) return o;
        continue;
      }
      if (Math.abs(lx) <= o.w / 2 + tol && Math.abs(ly) <= Math.max(o.d / 2, 0.1) + tol) return o;
    }
    for (const o of items) {
      if (TYPES[o.type].hit !== 'low') continue;
      const [lx, ly] = toLocal(o, p.x, p.y);
      if (pointInPoly(lx, ly, floorPoly(o))) return o;
    }
    return null;
  }

  // ------------------------------------------------------------ pointer events
  onDown(e) {
    this.c.setPointerCapture(e.pointerId);
    const p = this.evPos(e);
    if (this.compass && Math.hypot(p.sx - this.compass.x, p.sy - this.compass.y) < this.compass.r && e.button === 0) {
      const northUp = -((store.doc.north || 0) * Math.PI) / 180;
      this.setRotation(Math.abs(Math.atan2(Math.sin(this.vr - northUp), Math.cos(this.vr - northUp))) < 1e-3 ? 0 : northUp);
      this.app.onViewRotate?.(this);
      return;
    }
    this.shift = e.shiftKey;
    if (e.button === 1 || this.space || (e.button === 2 && store.tool === 'select')) {
      this.drag = { mode: 'pan', sx: p.sx, sy: p.sy, ox: this.ox, oy: this.oy };
      this.c.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 2) {
      if (store.tool === 'wall' && this.draft) this.finishDraft();
      else this.app.setTool('select');
      return;
    }
    const plot = plotOf(store.doc);
    if (store.tool === 'select' && plot?.edit && e.button === 0) {
      const i = plot.pts.findIndex(([x, y]) => { const [sx, sy] = this.w2s(x, y); return Math.hypot(sx - p.sx, sy - p.sy) < HANDLE + 2; });
      if (i >= 0) {
        const why = plotEditBlock(plot, 'corner', i);
        if (why) { this.app.toast(why, true); return; }
        checkpoint(); this.drag = { mode: 'plotCorner', plot, i }; return;
      }
    }
    switch (store.tool) {
      case 'place': {
        const s = this.snapPoint(p);
        this.app.placeAt(store.armed, s.x, s.y);
        return;
      }
      case 'wall': {
        if (this.draft?.bend) { this.confirmBend(p); this.redraw(); return; }
        const pt = this.snapWallPoint(p);
        if (!this.draft) this.draft = { pts: [pt] };
        else if (store.wallCurve) {
          const last = this.draft.pts[this.draft.pts.length - 1];
          if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.05) this.draft.bend = { a: last, b: pt, bulge: 0 };
        } else this.addWallTo(pt);
        this.redraw();
        return;
      }
      case 'room': case 'stairdraw': {
        const a = this.snapPoint(p);
        this.drag = { mode: store.tool, a, b: a };
        return;
      }
      case 'measure': {
        const a = this.snapPoint(p);
        this.measure = { a, b: a };
        this.drag = { mode: 'measure' };
        return;
      }
      case 'guide': {
        const pt = this.guidePoint(p);
        if (!this.guideDraft) { this.guideDraft = pt; this.redraw(); return; }
        if (Math.hypot(pt.x - this.guideDraft.x, pt.y - this.guideDraft.y) > 0.02) this.app.addGuide(this.guideDraft, pt);
        this.guideDraft = null;
        this.redraw();
        return;
      }
      case 'dimension': {
        const pt = this.snapPoint(p);
        if (!this.dimDraft) { this.dimDraft = pt; this.redraw(); return; }
        if (Math.hypot(pt.x - this.dimDraft.x, pt.y - this.dimDraft.y) > 0.02) {
          checkpoint();
          const o = { id: uid(), type: 'dimension', level: store.level, x1: this.dimDraft.x, y1: this.dimDraft.y, x2: pt.x, y2: pt.y, offset: 0.6, color: '#334155' };
          store.doc.objects.push(o);
          store.selectedId = o.id;
          emit('doc'); emit('selection');
        }
        this.dimDraft = null;
        return;
      }
      default: {
        const h = this.hitHandle(p);
        if (h) { checkpoint(); this.drag = h; return; }
        const hit = this.hitTest(p);
        if (!hit) { this.app.select(null); this.drag = { mode: 'pan', sx: p.sx, sy: p.sy, ox: this.ox, oy: this.oy }; return; }
        if (store.selectedId !== hit.id) this.app.select(hit.id);
        checkpoint();
        if (hit.type === 'wall' || hit.type === 'dimension' || hit.type === 'guide') {
          this.drag = { mode: 'moveWall', o: hit, start: p, orig: { x1: hit.x1, y1: hit.y1, x2: hit.x2, y2: hit.y2 },
            linked: hit.type === 'wall' ? [...this.linkedAt(hit.x1, hit.y1, hit.id), ...this.linkedAt(hit.x2, hit.y2, hit.id)] : [] };
        } else if (hit.wallId) this.drag = { mode: 'moveOpening', o: hit };
        else this.drag = { mode: 'move', o: hit, start: p, ox: hit.x, oy: hit.y };
      }
    }
  }

  onMove(e) {
    const p = this.evPos(e);
    Object.assign(this.mouse, p, { inside: true });
    this.shift = e.shiftKey;
    this.snapMark = null; this.snapLine = null; this.alignMarks = [];
    this.app.showCoords(p.x, p.y);
    const d = this.drag;
    if (!d) {
      const pl = plotOf(store.doc);
      if (store.tool === 'select' && pl?.edit && pl.pts.some(([x, y]) => { const [sx, sy] = this.w2s(x, y); return Math.hypot(sx - p.sx, sy - p.sy) < HANDLE + 2; })) { this.c.style.cursor = 'move'; this.redraw(); return; }
      if (store.tool === 'select') {
        const h = this.hitHandle(p);
        const hit = h ? null : this.hitTest(p);
        this.hoverId = hit?.id || null;
        this.c.style.cursor = h ? (h.mode === 'rotate' ? 'alias' : 'nwse-resize') : hit ? 'move' : 'default';
      } else this.c.style.cursor = 'crosshair';
      if (store.tool === 'wall') this.preview = this.snapWallPoint(p);
      else if (store.tool === 'guide') this.preview = this.guidePoint(p);
      else if (store.tool !== 'select') this.snapPoint(p);
      this.redraw();
      return;
    }
    const snap = this.snapOn();
    switch (d.mode) {
      case 'pan': this.ox = d.ox + p.sx - d.sx; this.oy = d.oy + p.sy - d.sy; this.userMoved = true; break;
      case 'move': {
        let nx = d.ox + p.x - d.start.x, ny = d.oy + p.y - d.start.y;
        if (snap) { nx = snapVal(nx); ny = snapVal(ny); }
        d.o.x = nx; d.o.y = ny; emit('doc');
        break;
      }
      case 'moveWall': {
        let dx = p.x - d.start.x, dy = p.y - d.start.y;
        if (snap) { dx = snapVal(dx); dy = snapVal(dy); }
        Object.assign(d.o, { x1: d.orig.x1 + dx, y1: d.orig.y1 + dy, x2: d.orig.x2 + dx, y2: d.orig.y2 + dy });
        for (const l of d.linked) { l.w['x' + l.e] = l.ox + dx; l.w['y' + l.e] = l.oy + dy; }
        emit('doc');
        break;
      }
      case 'bend': {
        // signed distance of the pointer from the chord = the bulge (sagitta); snaps to straight near zero
        if (isDimLocked(d.o, 'length')) break;
        const a = wallAng(d.o), mx = (d.o.x1 + d.o.x2) / 2, my = (d.o.y1 + d.o.y2) / 2;
        let b = (p.x - mx) * -Math.sin(a) + (p.y - my) * Math.cos(a);
        if (snap) b = Math.abs(b) < 0.15 ? 0 : snapVal(b, 0.05);
        d.o.bulge = Math.max(-chordHalf(d.o), Math.min(chordHalf(d.o), +b.toFixed(3)));
        this.clampOpenings(d.o);
        emit('doc');
        break;
      }
      case 'endpoint': {
        const pt = this.snapPoint(p, d.o.id);
        if (isDimLocked(d.o, 'length')) {
          const f = d.e === 1 ? 2 : 1, ox = d.o['x' + f], oy = d.o['y' + f], L = Math.hypot(d.o.x2 - d.o.x1, d.o.y2 - d.o.y1), a = Math.atan2(pt.y - oy, pt.x - ox);
          pt.x = ox + Math.cos(a) * L; pt.y = oy + Math.sin(a) * L;
        }
        d.o['x' + d.e] = pt.x; d.o['y' + d.e] = pt.y;
        for (const l of d.linked) { l.w['x' + l.e] = pt.x; l.w['y' + l.e] = pt.y; }
        this.clampOpenings(d.o);
        emit('doc');
        break;
      }
      case 'moveOpening': if (!isDimLocked(d.o, 't')) { this.slideOpening(d.o, p); emit('doc'); } break;
      case 'resize': {
        const { orig, sx, sy, o } = d;
        const [lx, ly] = toLocal(orig, p.x, p.y);
        const fx = (-sx * orig.w) / 2, fy = (-sy * orig.d) / 2;
        let nw = Math.max(0.2, sx * (lx - fx)), nd = Math.max(0.05, sy * (ly - fy));
        if (TYPES[o.type].uniform) nw = nd = Math.max(nw, nd);
        if (isDimLocked(o, 'w')) nw = orig.w;
        if (isDimLocked(o, 'd')) nd = orig.d;
        if (snap) { nw = Math.max(0.1, snapVal(nw)); nd = Math.max(0.05, snapVal(nd)); }
        const [cx, cy] = toWorld(orig, fx + (sx * nw) / 2, fy + (sy * nd) / 2);
        Object.assign(o, { w: +nw.toFixed(4), d: +nd.toFixed(4), x: cx, y: cy });
        if (orig.pts) o.pts = orig.pts.map(([x, y]) => [(x * nw) / orig.w, (y * nd) / orig.d]);
        emit('doc');
        break;
      }
      case 'vertex': {
        const n = d.o.pts.length;
        if (isDimLocked(d.o, 'side' + d.i) || isDimLocked(d.o, 'side' + ((d.i - 1 + n) % n))) { this.app.toast('A side next to this corner is locked', true); this.drag = null; break; }
        const pt = this.snapPoint(p);
        d.o.pts[d.i] = toLocal(d.o, pt.x, pt.y).map((v) => +v.toFixed(4));
        emit('doc');
        break;
      }
      case 'rotate': {
        let deg = Math.atan2(p.y - d.o.y, p.x - d.o.x) / DEG + 90;
        if (snap) deg = Math.round(deg / 15) * 15;
        d.o.rot = ((Math.round(deg) % 360) + 360) % 360;
        emit('doc');
        break;
      }
      case 'room': case 'stairdraw': d.b = this.snapPoint(p); break;
      case 'plotCorner': { const pt = this.snapPoint(p); d.plot.pts[d.i] = [+pt.x.toFixed(4), +pt.y.toFixed(4)]; emit('doc'); break; }
      case 'measure': this.measure.b = this.snapPoint(p); break;
    }
    this.redraw();
  }

  onUp() {
    const d = this.drag;
    this.drag = null;
    this.c.style.cursor = store.tool === 'select' ? 'default' : 'crosshair';
    if (!d) return;
    if (d.mode === 'room') this.createRoom(d.a, d.b);
    if (d.mode === 'stairdraw') this.createStairs(d.a, d.b);
    if (d.mode === 'vertex') normalizeCustom(d.o);
    if (['move', 'moveWall', 'endpoint', 'moveOpening', 'resize', 'rotate', 'vertex', 'bend', 'plotCorner'].includes(d.mode)) { dropIfUnchanged(); emit('doc'); }
    this.redraw();
  }

  onWheel(e) {
    e.preventDefault();
    const p = this.evPos(e);
    this.zoomBy(Math.exp(-e.deltaY * 0.0015), p.sx, p.sy);
  }

  onKey(e) {
    if (store.tool === 'wall' && this.draft) {
      if (/^[0-9.]$/.test(e.key) || (e.key === "'" && store.doc.units === 'ft')) { this.typed += e.key; this.redraw(); return true; }
      if (e.key === 'Backspace' && this.typed) { this.typed = this.typed.slice(0, -1); this.redraw(); return true; }
      if (e.key === 'Enter') {
        const L = typedLen(this.typed);
        const last = this.draft.pts[this.draft.pts.length - 1], pv = this.preview || this.mouse;
        const a = Math.atan2(pv.y - last.y, pv.x - last.x);
        if (L > 0) this.addWallTo({ x: +(last.x + Math.cos(a) * L).toFixed(4), y: +(last.y + Math.sin(a) * L).toFixed(4) });
        else this.finishDraft();
        this.typed = '';
        return true;
      }
      if (e.key === 'Escape') { this.finishDraft(); return true; }
    }
    if (e.key === 'Escape' && (this.measure || this.dimDraft || this.guideDraft || this.drag?.mode === 'room')) { this.measure = null; this.dimDraft = null; this.guideDraft = null; this.drag = null; this.redraw(); return true; }
    if (e.key === ' ') { this.space = e.type === 'keydown'; return false; }
    return false;
  }

  // ------------------------------------------------------------ editing helpers
  newWall(a, b, kind) {
    return {
      id: uid(), type: 'wall', level: store.level, x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind,
      thickness: kind === 'interior' ? 0.12 : 0.25, height: store.doc.levels[store.level]?.height ?? 3,
      finish: 'plaster', color: '#ece3d3', innerColor: '#f4f1ea',
    };
  }
  addWallTo(pt) {
    const last = this.draft.pts[this.draft.pts.length - 1];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.05) return;
    checkpoint();
    store.doc.objects.push(this.newWall(last, pt, store.wallKind));
    emit('doc');
    const first = this.draft.pts[0];
    if (this.draft.pts.length > 1 && Math.hypot(pt.x - first.x, pt.y - first.y) < 0.03) this.draft = null;
    else this.draft.pts.push(pt);
    this.typed = '';
  }
  finishDraft() { this.draft = null; this.typed = ''; this.redraw(); }

  bendPoint(w) {
    const a = wallAng(w), b = w.bulge || 0;
    return { x: (w.x1 + w.x2) / 2 - Math.sin(a) * b, y: (w.y1 + w.y2) / 2 + Math.cos(a) * b };
  }
  bendFromPointer(p) {
    const { a, b } = this.draft.bend, ang = Math.atan2(b.y - a.y, b.x - a.x);
    let bulge = (p.x - (a.x + b.x) / 2) * -Math.sin(ang) + (p.y - (a.y + b.y) / 2) * Math.cos(ang);
    if (this.snapOn()) bulge = Math.abs(bulge) < 0.15 ? 0 : snapVal(bulge, 0.05);
    return Math.max(-Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.min(Math.hypot(b.x - a.x, b.y - a.y) / 2, bulge));
  }
  confirmBend(p) {
    const { a, b } = this.draft.bend, bulge = this.bendFromPointer(p);
    checkpoint();
    const w = this.newWall(a, b, store.wallKind);
    if (Math.abs(bulge) >= 0.01) w.bulge = +bulge.toFixed(3);
    store.doc.objects.push(w);
    emit('doc');
    this.draft.bend = null;
    const first = this.draft.pts[0];
    if (this.draft.pts.length > 1 && Math.hypot(b.x - first.x, b.y - first.y) < 0.03) this.draft = null;
    else this.draft.pts.push(b);
  }

  // ------------------------------------------------------------ dimension objects & inline editing
  dimPoints(o) {
    const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), off = o.offset ?? 0.6, nx = -Math.sin(a) * off, ny = Math.cos(a) * off;
    return [[o.x1 + nx, o.y1 + ny], [o.x2 + nx, o.y2 + ny]];
  }
  // Double-clicking a dimension label opens a small input to type the exact value.
  editDim(hit) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.className = 'dim-editor';
    inp.value = +toUnit(hit.value).toFixed(4);
    inp.title = `Type the exact value in ${store.doc.units} and press Enter`;
    Object.assign(inp.style, { left: `${hit.x - 48}px`, top: `${hit.y - 14}px` });
    this.c.parentElement.appendChild(inp);
    inp.focus(); inp.select();
    const done = (ok) => {
      if (!inp.isConnected) return;
      const v = fromUnit(parseFloat(inp.value));
      inp.remove();
      if (ok && v > 0 && Math.abs(v - hit.value) > 1e-6) this.applyDim(hit, v);
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true));
  }
  applyDim(hit, v) {
    if (hit.kind === 'plotSide') {
      const why = plotEditBlock(hit.o, 'len', hit.i);
      if (why) { this.app.toast(why, true); return; }
      checkpoint(); setSide(hit.o, hit.i, v); emit('doc'); this.app.toast(`Plot side set to ${fmtLen(v)}`);
      return;
    }
    const o = hit.o, key = { wall: 'length', itemW: 'w', itemD: 'd', opWidth: 'width', gap: 't', gapEnd: 't', dimobj: 'length', side: 'side' + hit.i }[hit.kind];
    if (isDimLocked(o, key) || o.locked) { this.app.toast('That dimension is locked — unlock it in the properties panel', true); return; }
    if (hit.kind === 'side' && isDimLocked(o, 'side' + ((hit.i + 1) % (o.pts?.length || 4)))) { this.app.toast('The next side is locked, so this corner cannot move', true); return; }
    checkpoint();
    switch (hit.kind) {
      case 'wall': setWallLength(o, Math.max(0.1, v - (wallDimLen(o) - wallLen(o)))); break;
      case 'gap': o.t = hit.from + v + o.width / 2; break;
      case 'gapEnd': o.t = hit.L - v - o.width / 2; break;
      case 'opWidth': o.width = v; break;
      case 'itemW': o.w = v; if (TYPES[o.type].uniform) o.d = v; break;
      case 'itemD': o.d = v; if (TYPES[o.type].uniform) o.w = v; break;
      case 'side': setSideLength(o, hit.i, v); break;
      case 'dimobj': { const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1); o.x2 = o.x1 + Math.cos(a) * v; o.y2 = o.y1 + Math.sin(a) * v; break; }
    }
    if (o.wallId) this.clampOpenings(getObj(o.wallId));
    emit('doc');
    this.app.toast(`Set to ${fmtLen(v)}`);
  }

  // Render the plan into another canvas for printing (white paper, no grid or UI), at a given scale.
  renderTo(canvas, { level, scale, ox, oy, width, height, filter }) {
    this.printFilter = filter || null;
    const save = { c: this.c, ctx: this.ctx, W: this.W, H: this.H, dpr: this.dpr, scale: this.scale, ox: this.ox, oy: this.oy, vr: this.vr, level: store.level, sel: store.selectedId, hover: this.hoverId };
    Object.assign(this, { c: canvas, ctx: canvas.getContext('2d'), W: width, H: height, dpr: canvas.width / width, scale, ox, oy, vr: 0, print: true, hoverId: null });
    store.level = level; store.selectedId = null;
    try { this.draw(); } finally {
      Object.assign(this, { c: save.c, ctx: save.ctx, W: save.W, H: save.H, dpr: save.dpr, scale: save.scale, ox: save.ox, oy: save.oy, vr: save.vr, print: false, hoverId: save.hover });
      store.level = save.level; store.selectedId = save.sel;
      this.printFilter = null;
      this.redraw();
    }
  }

  createRoom(a, b) {
    let x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const preset = ROOM_PRESETS[store.roomPreset];
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5) {
      if (!preset) return;
      // a single click drops the preset at its standard size, centred on the click
      x0 = snapVal(a.x - preset.w / 2); y0 = snapVal(a.y - preset.d / 2); x1 = x0 + preset.w; y1 = y0 + preset.d;
    }
    checkpoint();
    const existing = wallsOn(store.level);
    const kind = existing.some((w) => w.kind !== 'interior') ? 'interior' : 'exterior';
    const onWall = (p) => existing.some((w) => projectToSegment(p.x, p.y, w.x1, w.y1, w.x2, w.y2).d < 0.05);
    const c = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    for (let i = 0; i < 4; i++) {
      const p = c[i], q = c[(i + 1) % 4];
      if (onWall(p) && onWall(q) && onWall({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })) continue; // already covered
      store.doc.objects.push(this.newWall(p, q, kind));
    }
    const overlaps = store.doc.objects.some((o) => o.type === 'floor' && o.level === store.level);
    store.doc.objects.push({ id: uid(), type: 'floor', level: store.level, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0, rot: 0, z: overlaps ? 0.006 : 0,
      finish: preset?.finish || (kind === 'exterior' ? 'wood' : 'tile'), color: preset?.color || '#ffffff', name: preset?.label || '' });
    if (preset) this.furnishRoom(preset, x0, y0, x1, y1);
    emit('doc');
    if (preset) this.app.setTool('select');
    this.app.toast(`${preset?.label || 'Room'} ${fmtLen(x1 - x0)} × ${fmtLen(y1 - y0)} added`);
  }

  // Door in the bottom wall (swinging inward) and the preset's fittings placed against the walls.
  furnishRoom(preset, x0, y0, x1, y1) {
    const W = x1 - x0, Dd = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, inset = 0.15;
    const dx = x0 + Math.min(W / 2, Math.max(0.3 + preset.door / 2, W * 0.75));
    const w = wallsOn(store.level).find((o) => projectToWall(dx, y1, o).d < 0.05);
    if (w) {
      const L = wallLen(w), t = projectToWall(dx, y1, w).t * L, a = wallAng(w);
      const width = Math.min(preset.door, L - 0.2);
      store.doc.objects.push({ id: uid(), type: 'door', level: store.level, wallId: w.id, style: preset.doubleDoor ? 'double' : 'single', width, height: 2.1,
        t: Math.max(width / 2, Math.min(L - width / 2, t)), open: 30, flip: -Math.cos(a) <= 0, color: '#8a5a33', frameColor: '#f4f1ea' });
    }
    store.doc.objects.push(...presetItems(store.roomPreset, x0, y0, x1, y1, store.level, inset));
  }

  // Stairs fill the dragged rectangle; a straight flight runs along the longer side, starting at the
  // end where the drag began.
  createStairs(a, b) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const W = x1 - x0, Dd = y1 - y0;
    if (W < 0.6 || Dd < 0.6) { if (store.stairKey) this.app.placeAt(store.stairKey, snapVal(a.x), snapVal(a.y)); return; }
    const shape = store.stairShape || 'straight', h = store.doc.levels[store.level]?.height ?? 3;
    let w = W, d = Dd, rot = 0;
    if (shape === 'straight') {
      if (W > Dd) { w = Dd; d = W; rot = b.x >= a.x ? 90 : 270; } else rot = b.y >= a.y ? 180 : 0;
    }
    checkpoint();
    const o = { id: uid(), type: 'stairs', level: store.level, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, d, rot, z: 0, h, shape, flightW: Math.min(1.1, Math.min(W, Dd) / 2 - 0.05), finish: 'wood', style: shape === 'straight' ? 'open' : 'solid', railing: true };
    store.doc.objects.push(o);
    store.selectedId = o.id;
    emit('doc'); emit('selection');
    this.app.setTool('select');
  }

  slideOpening(o, p) {
    let best = null, bd = 1.2;
    for (const w of wallsOn(store.level)) {
      const pr = projectToWall(p.x, p.y, w);
      const d = pr.d - (w.id === o.wallId ? 0.15 : 0);
      if (d < bd) { bd = d; best = { w, pr }; }
    }
    if (!best) return;
    const L = wallLen(best.w);
    let t = best.pr.t * L;
    if (this.snapOn()) t = snapVal(t, 0.05);
    o.wallId = best.w.id;
    o.t = L <= o.width ? L / 2 : Math.max(o.width / 2, Math.min(L - o.width / 2, t));
  }
  clampOpenings(w) {
    const L = wallLen(w);
    for (const op of openingsOf(w.id)) op.t = L <= op.width ? L / 2 : Math.max(op.width / 2, Math.min(L - op.width / 2, op.t));
  }

  ghostFor(key, p) {
    const item = CATALOG_INDEX[key];
    if (!item?.make) return null;
    const g = (this.ghostCache[key] ??= { id: 'ghost-' + key, level: store.level, rot: 0, ...item.make() });
    if (g.type === 'door' || g.type === 'window') {
      let best = null, bd = 1.2;
      for (const w of wallsOn(store.level)) {
        const pr = projectToWall(p.x, p.y, w);
        if (pr.d < bd) { bd = pr.d; best = { w, pr }; }
      }
      if (!best) return { ...g, noWall: true, px: p.x, py: p.y };
      const L = wallLen(best.w);
      return { ...g, wall: best.w, t: L <= g.width ? L / 2 : Math.max(g.width / 2, Math.min(L - g.width / 2, snapVal(best.pr.t * L, 0.05))) };
    }
    g.x = p.x; g.y = p.y;
    return g;
  }

  // ------------------------------------------------------------ drawing
  draw() {
    const { ctx } = this;
    if (!this.W) return;
    this.screenT();
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, this.W, this.H);
    this.dimHits = [];
    if (this.print) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.W, this.H); }
    else if (store.view.grid) this.drawGrid();
    if (store.level > 0 && !this.print) { ctx.globalAlpha = 0.2; this.drawLevel(store.level - 1, true); ctx.globalAlpha = 1; }
    this.drawPlot(store.level > 0 && !this.print);
    this.drawLevel(store.level, false);
    if (store.view.dims || this.print) this.drawDims();
    if (this.print) return;
    for (const g of this.guides()) this.drawGuide(g);
    this.drawSelection();
    this.drawTools();
    this.drawScaleBar();
  }

  gridSteps() {
    const ft = store.doc.units === 'ft';
    const cands = ft ? [FT / 4, FT, FT * 2, FT * 5, FT * 10, FT * 50] : [0.1, 0.25, 0.5, 1, 2, 5, 10, 50];
    const minor = cands.find((s) => s * this.scale >= 11) || cands[cands.length - 1];
    const major = ft ? (minor < FT ? FT : minor * 5) : (minor < 1 ? 1 : minor * 5);
    return { minor, major };
  }
  drawGrid() {
    const { ctx } = this, { minor, major } = this.gridSteps();
    const cs = [this.s2w(0, 0), this.s2w(this.W, 0), this.s2w(this.W, this.H), this.s2w(0, this.H)];
    const x0 = Math.min(...cs.map((p) => p[0])), x1 = Math.max(...cs.map((p) => p[0])), y0 = Math.min(...cs.map((p) => p[1])), y1 = Math.max(...cs.map((p) => p[1]));
    const straight = Math.abs(Math.sin(this.vr * 2)) < 1e-6;
    const lines = (step, color, lw) => {
      ctx.strokeStyle = color; ctx.beginPath();
      if (straight) {
        // axis-aligned view: crisp pixel-snapped lines
        this.screenT(); ctx.lineWidth = lw;
        for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { const [ax, ay] = this.w2s(x, y0), [bx, by] = this.w2s(x, y1); ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5); ctx.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5); }
        for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { const [ax, ay] = this.w2s(x0, y), [bx, by] = this.w2s(x1, y); ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5); ctx.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5); }
      } else {
        this.worldT(); ctx.lineWidth = lw / this.scale;
        for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      }
      ctx.stroke();
      this.screenT();
    };
    lines(minor, '#eeede8', 1);
    lines(major, '#dcdad3', 1);
    const [ax, ay] = this.w2s(0, 0);
    ctx.strokeStyle = '#c9c6bd'; ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.lineTo(ax + 8, ay); ctx.moveTo(ax, ay - 8); ctx.lineTo(ax, ay + 8); ctx.stroke();
  }

  drawItem(o) {
    const { ctx } = this;
    ctx.save(); this.worldT();
    if (!this.print && !inScope(o, store.view.scope)) ctx.globalAlpha *= 0.3; // locked in this workspace
    ctx.translate(o.x, o.y); ctx.rotate((o.rot || 0) * DEG);
    TYPES[o.type].draw2d(ctx, o, 1 / this.scale);
    ctx.restore();
  }

  drawLevel(level, ghost) {
    const objs = store.doc.objects.filter((o) => o.level === level && !o.hidden && (!this.printFilter || this.printFilter(o)));
    const items = objs.filter((o) => TYPES[o.type]?.kind === 'rect').sort((a, b) => zOrder(a) - zOrder(b));
    items.filter((o) => zOrder(o) < 5).forEach((o) => this.drawItem(o));
    if (!ghost) this.drawAreas(items);
    this.drawWalls(objs.filter((o) => o.type === 'wall'));
    items.filter((o) => zOrder(o) >= 5).forEach((o) => this.drawItem(o));
    if (ghost) return;
    if (store.view.pro || this.print) this.drawTags(objs.filter((o) => o.type === 'wall'));
    for (const o of objs) if (o.type === 'dimension') this.drawDimObj(o);
  }

  // Room labels: name, size and area at the centre of each floor slab.
  drawAreas(items) {
    const { ctx } = this, D = dims();
    if (!D.rooms) return;
    this.screenT();
    const ts = D.textSize, named = items.some((o) => o.type === 'floor' && o.name);
    for (const o of items) {
      if (o.type !== 'floor' || (named && !o.name)) continue;
      const pts = floorPoly(o), area = polyArea(pts);
      if (area < 1.5 || o.w * this.scale < 50) continue;
      const [sx, sy] = this.w2s(o.x, o.y);
      const rect = !o.shape || o.shape === 'rect';
      const lines = [o.name ? o.name.toUpperCase() : null, rect ? `${fmtLen(o.w)} × ${fmtLen(o.d)}` : null, fmtArea(area)].filter(Boolean);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((t, i) => {
        const bold = i === 0 && o.name;
        ctx.font = `${bold ? 700 : 600} ${bold ? ts + 1 : ts - 1}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = bold ? 'rgba(40,35,30,.85)' : 'rgba(70,60,45,.65)';
        ctx.fillText(t, sx, sy + (i - (lines.length - 1) / 2) * (ts + 3));
      });
    }
  }

  // Door / window tags (D1, W2 …) placed on the inside face of each opening.
  drawTags(walls) {
    const { ctx } = this, tags = openingTags(), c = levelCentroid(store.level);
    this.screenT();
    for (const w of walls) {
      const s = w.kind === 'interior' ? 1 : -outwardSign(w, c);
      for (const op of openingsOf(w.id)) {
        const off = w.thickness / 2 + 13 / this.scale, q = wallPointAt(w, op.t), a = q.a;
        const x = q.x - Math.sin(a) * s * off, y = q.y + Math.cos(a) * s * off;
        const [sx, sy] = this.w2s(x, y), tag = tags[op.id];
        ctx.font = '700 9px Inter, system-ui, sans-serif';
        const tw = Math.max(18, ctx.measureText(tag).width + 8);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = op.type === 'door' ? '#7c4a1e' : '#1d4ed8'; ctx.lineWidth = 1;
        ctx.beginPath();
        if (op.type === 'door') ctx.ellipse(sx, sy, tw / 2, 8, 0, 0, Math.PI * 2); else ctx.roundRect(sx - tw / 2, sy - 7.5, tw, 15, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, sx, sy + 0.5);
      }
    }
  }

  drawDimObj(o) {
    const [a, b] = this.dimPoints(o), { ctx } = this;
    this.screenT();
    ctx.strokeStyle = o.color || '#334155'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 2]); ctx.beginPath();
    for (const [p, q] of [[[o.x1, o.y1], a], [[o.x2, o.y2], b]]) { const [x1, y1] = this.w2s(...p), [x2, y2] = this.w2s(...q); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke(); ctx.setLineDash([]);
    const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    this.dimLine(a, b, o.label || fmtLen(L), o.color || '#334155', true, { kind: 'dimobj', o, value: L });
  }

  // Property line (dash-dot), corner letters, a length on every side and the setback line.
  drawPlot(faint) {
    const p = plotOf(store.doc);
    if (!p || this.printFilter) return;
    const { ctx } = this, pts = p.pts, n = pts.length, scr = pts.map(([x, y]) => this.w2s(x, y));
    this.screenT();
    ctx.save(); ctx.globalAlpha = faint ? 0.35 : 1;
    ctx.beginPath(); scr.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    if (!this.print) { ctx.fillStyle = 'rgba(22,101,52,.035)'; ctx.fill(); }
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.setLineDash([14, 4, 3, 4]); ctx.stroke(); ctx.setLineDash([]);
    const sb = setbackPoly(p);
    if (sb) {
      ctx.beginPath(); sb.forEach(([x, y], i) => { const [sx, sy] = this.w2s(x, y); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath();
      ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    // a length on every side, outside the plot; double-click to type it
    const cx = scr.reduce((s, q) => s + q[0], 0) / n, cy = scr.reduce((s, q) => s + q[1], 0) / n;
    ctx.restore();
    if (!faint) for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const [sx1, sy1] = scr[i], [sx2, sy2] = scr[(i + 1) % n], mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
      let nx = -(sy2 - sy1), ny = sx2 - sx1; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      const off = 24 / this.scale, [wx, wy] = this.s2w(sx1 + nx, sy1 + ny), [ox, oy] = [(wx - a[0]) * off * this.scale, (wy - a[1]) * off * this.scale];
      this.dimLine([a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], `${String.fromCharCode(65 + i)}–${String.fromCharCode(65 + ((i + 1) % n))}  ${fmtLen(L)}`, '#166534', true, { kind: 'plotSide', o: p, i, value: L });
    }
    this.screenT();
    ctx.save(); ctx.globalAlpha = faint ? 0.35 : 1;
    scr.forEach(([x, y], i) => {
      const live = p.edit && !p.locked && !this.print;
      ctx.beginPath(); ctx.arc(x, y, live ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = live ? '#fff' : '#166534'; ctx.fill(); ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.stroke();
      let dx = x - cx, dy = y - cy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#166534'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String.fromCharCode(65 + i), x + dx * 14, y + dy * 14);
    });
    if (!faint) {
      const area = Math.abs(pts.reduce((s, [x1, y1], i) => { const [x2, y2] = pts[(i + 1) % n]; return s + x1 * y2 - x2 * y1; }, 0) / 2);
      const top = scr.reduce((m, q) => (q[1] < m[1] ? q : m), scr[0]);
      const label = `PLOT  ${store.doc.units === 'ft' ? `${Math.round(area * SQFT)} sq ft` : `${area.toFixed(1)} m²`}  ·  ${(area / CENT).toFixed(2)} cents`;
      ctx.font = '700 11px Inter, system-ui, sans-serif'; const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(240,253,244,.95)'; ctx.beginPath(); ctx.roundRect(top[0] - tw / 2 - 7, top[1] - 46, tw + 14, 19, 5); ctx.fill();
      ctx.fillStyle = '#166534'; ctx.fillText(label, top[0], top[1] - 36);
    }
    ctx.restore();
  }

  // A guide is drawn across the whole view, with its two points marked and an optional grid bubble at the edge.
  drawGuide(g, color = g.color || GUIDE, lw = 1.1) {
    const { ctx } = this;
    this.screenT();
    const [ax, ay] = this.w2s(g.x1, g.y1), [bx, by] = this.w2s(g.x2, g.y2), L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-6) return;
    const ux = (bx - ax) / L, uy = (by - ay) / L, m = 14;
    // clip the infinite line to the inset view rectangle (Liang-Barsky)
    let t0 = -1e6, t1 = 1e6;
    for (const [p, q] of [[-ux, ax - m], [ux, this.W - m - ax], [-uy, ay - m], [uy, this.H - m - ay]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    }
    if (t0 > t1) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = g.locked ? 0.8 : 1;
    ctx.setLineDash(g.locked ? [8, 4] : [4, 3]);
    ctx.beginPath(); ctx.moveTo(ax + ux * (t0 - m), ay + uy * (t0 - m)); ctx.lineTo(ax + ux * (t1 + m), ay + uy * (t1 + m)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = color;
    for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
    if (g.label) {
      // grid bubble at the top end of a vertical-ish line, the left end of a horizontal-ish one
      const e0 = [ax + ux * t0, ay + uy * t0], e1 = [ax + ux * t1, ay + uy * t1], k = Math.abs(uy) > Math.abs(ux) ? 1 : 0;
      const [cx, cy] = e0[k] <= e1[k] ? e0 : e1;
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = color; ctx.font = '700 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(g.label).slice(0, 3), cx, cy + 0.5);
    }
    ctx.restore();
  }

  wallPoly(w) {
    if (wallArc(w)) return [...wallSamples(w, w.thickness / 2), ...wallSamples(w, -w.thickness / 2).reverse()];
    const a = wallAng(w), c = Math.cos(a), s = Math.sin(a), h = w.thickness / 2;
    const x1 = w.x1 - c * h, y1 = w.y1 - s * h, x2 = w.x2 + c * h, y2 = w.y2 + s * h, nx = -s * h, ny = c * h;
    return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
  }
  pathPoly(pts) { const { ctx } = this; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

  drawWalls(walls) {
    const { ctx } = this, P = 1 / this.scale;
    ctx.save(); this.worldT();
    const sorted = [...walls].sort((a, b) => (a.kind === 'interior' ? 0 : 1) - (b.kind === 'interior' ? 0 : 1));
    ctx.lineJoin = 'miter'; ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 2.4 * P;
    for (const w of sorted) { this.pathPoly(this.wallPoly(w)); ctx.stroke(); }
    for (const w of sorted) { this.pathPoly(this.wallPoly(w)); ctx.fillStyle = w.kind === 'interior' ? '#7c838e' : '#434954'; ctx.fill(); }
    for (const w of sorted) {
      const ops = openingsOf(w.id);
      if (!ops.length) continue;
      for (const op of ops) {
        if (op.hidden) continue;
        const q = wallPointAt(w, op.t);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.translate(-op.t, 0);
        drawOpening2D(ctx, op, w, P, PAPER);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // dimension line between two world points, offset already applied
  dimLine(p1, p2, label, color = '#334155', strong = false, hit = null) {
    const { ctx } = this, ts = dims().textSize;
    this.screenT();
    const [x1, y1] = this.w2s(p1[0], p1[1]), [x2, y2] = this.w2s(p2[0], p2[1]);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 18) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    ctx.strokeStyle = color; ctx.lineWidth = strong ? 1.2 : 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      ctx.moveTo(x - (ux - uy) * 4, y - (uy + ux) * 4); ctx.lineTo(x + (ux - uy) * 4, y + (uy + ux) * 4);
      ctx.moveTo(x + uy * 6, y - ux * 6); ctx.lineTo(x - uy * 6, y + ux * 6);
    }
    ctx.stroke();
    let ang = Math.atan2(uy, ux);
    if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
    ctx.save();
    ctx.translate((x1 + x2) / 2, (y1 + y2) / 2); ctx.rotate(ang);
    ctx.font = `${strong ? 700 : 600} ${ts}px Inter, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    if (tw + 10 < len) {
      ctx.fillStyle = this.print ? '#ffffff' : 'rgba(251,250,247,.95)';
      ctx.beginPath(); ctx.roundRect(-tw / 2 - 5, -(ts + 5) / 2, tw + 10, ts + 5, 4); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0.5);
      if (hit) {
        const vert = Math.abs(Math.sin(ang)) > 0.7;
        this.dimHits.push({ ...hit, x: (x1 + x2) / 2, y: (y1 + y2) / 2, w: vert ? ts + 5 : tw + 10, h: vert ? tw + 10 : ts + 5 });
      }
    }
    ctx.restore();
  }

  // Wall dimensions (with optional opening chains) and overall footprint, following the dimension settings.
  drawDims() {
    const D = dims(), walls = wallsOn(store.level).filter((w) => !w.hidden), c = levelCentroid(store.level), px = 1 / this.scale;
    const chains = D.openings || store.view.pro || this.print;
    if (this.scale >= 14) for (const w of walls) {
      const ext = w.kind !== 'interior', L = wallLen(w);
      if (ext ? !D.exterior : !D.interior) continue;
      const arc = wallArc(w);
      if (arc) {
        const a = wallAng(w), sgn = Math.sign(w.bulge), off = Math.abs(w.bulge) + w.thickness / 2 + 20 * px;
        const nx = -Math.sin(a) * sgn * off, ny = Math.cos(a) * sgn * off;
        this.dimLine([w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], `arc ${fmtLen(L)} · R ${fmtLen(arc.r)}`, ext ? '#334155' : '#64748b', false, { kind: 'wall', o: w, value: L });
        continue;
      }
      if (L < 0.2 || (!ext && L * this.scale < 70)) continue;
      const a = wallAng(w), s = ext ? outwardSign(w, c) : 1, cs = Math.cos(a), sn = Math.sin(a);
      const nrm = (off) => [-sn * s * off, cs * s * off];
      const ext0 = D.mode === 'outside' && ext ? w.thickness / 2 : D.mode === 'clear' ? -(ext ? w.thickness / 2 : 0.125) : 0;
      const ops = ext && chains ? openingsOf(w.id).sort((p, q) => p.t - q.t) : [];
      // chain: wall end → opening edges → wall end, nearest to the wall
      let off = w.thickness / 2 + (ext ? 20 : 10) * px;
      if (ops.length) {
        const [nx, ny] = nrm(off), at = (t) => [w.x1 + cs * t + nx, w.y1 + sn * t + ny];
        let prev = 0;
        for (const op of ops) {
          const l = op.t - op.width / 2, r = op.t + op.width / 2;
          if (l - prev > 0.01) this.dimLine(at(prev), at(l), fmtLen(l - prev), '#c2410c', false, { kind: 'gap', o: op, from: prev, value: l - prev });
          this.dimLine(at(l), at(r), fmtLen(op.width), '#1d4ed8', false, { kind: 'opWidth', o: op, value: op.width });
          prev = r;
        }
        if (L - prev > 0.01) this.dimLine(at(prev), at(L), fmtLen(L - prev), '#c2410c', false, { kind: 'gapEnd', o: ops[ops.length - 1], L, value: L - prev });
        off += 22 * px;
      }
      const [nx, ny] = nrm(off);
      this.dimLine([w.x1 - cs * ext0 + nx, w.y1 - sn * ext0 + ny], [w.x2 + cs * ext0 + nx, w.y2 + sn * ext0 + ny], fmtLen(wallDimLen(w)), ext ? '#334155' : '#64748b', false, { kind: 'wall', o: w, value: wallDimLen(w) });
    }
    const ext = walls.filter((w) => w.kind !== 'interior');
    if (D.overall && ext.length >= 3) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const w of ext) { const h = w.thickness / 2; x0 = Math.min(x0, w.x1 - h, w.x2 - h); x1 = Math.max(x1, w.x1 + h, w.x2 + h); y0 = Math.min(y0, w.y1 - h, w.y2 - h); y1 = Math.max(y1, w.y1 + h, w.y2 + h); }
      const o = (chains ? 74 : 52) * px;
      this.dimLine([x0, y0 - o], [x1, y0 - o], fmtLen(x1 - x0), '#1d4ed8', true);
      this.dimLine([x0 - o, y1], [x0 - o, y0], fmtLen(y1 - y0), '#1d4ed8', true);
    }
  }

  outlineRect(o, color, lw, dash) {
    const { ctx } = this;
    ctx.save(); this.worldT();
    ctx.translate(o.x, o.y); ctx.rotate((o.rot || 0) * DEG);
    ctx.strokeStyle = color; ctx.lineWidth = lw / this.scale;
    if (dash) ctx.setLineDash(dash.map((v) => v / this.scale));
    const ov = o.type === 'roof' ? o.overhang || 0 : 0;
    if (o.type === 'gazebo' || o.type === 'tree' || o.type === 'shrub' || o.type === 'spiral') { ctx.beginPath(); ctx.arc(0, 0, o.w / 2, 0, Math.PI * 2); ctx.stroke(); }
    else if (SLABS.has(o.type) && o.shape && o.shape !== 'rect') { this.pathPoly(floorPoly(o)); ctx.stroke(); }
    else ctx.strokeRect(-o.w / 2 - ov, -Math.max(o.d, 0.1) / 2 - ov, o.w + 2 * ov, Math.max(o.d, 0.1) + 2 * ov);
    ctx.restore();
  }
  outlineObj(o, color, lw) {
    const { ctx } = this;
    if (o.type === 'guide') { this.drawGuide(o, color === ACCENT ? o.color || GUIDE : color, lw); return; }
    if (o.type === 'wall') {
      ctx.save(); this.worldT(); this.pathPoly(this.wallPoly(o));
      ctx.strokeStyle = color; ctx.lineWidth = lw / this.scale; ctx.stroke(); ctx.restore();
    } else if (o.wallId) {
      const w = store.doc.objects.find((x) => x.id === o.wallId);
      if (!w) return;
      ctx.save(); this.worldT(); ctx.translate(w.x1, w.y1); ctx.rotate(wallAng(w));
      ctx.strokeStyle = color; ctx.lineWidth = lw / this.scale;
      ctx.strokeRect(o.t - o.width / 2, -w.thickness / 2 - 0.05, o.width, w.thickness + 0.1);
      ctx.restore();
    } else this.outlineRect(o, color, lw);
  }
  handle(x, y, round = false) {
    const { ctx } = this;
    this.screenT();
    const [sx, sy] = this.w2s(x, y);
    ctx.beginPath();
    if (round) ctx.arc(sx, sy, 5.5, 0, Math.PI * 2); else ctx.rect(sx - 4.5, sy - 4.5, 9, 9);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.stroke();
  }

  drawSelection() {
    const sel = this.app.selected();
    if (this.hoverId && this.hoverId !== sel?.id) {
      const h = store.doc.objects.find((o) => o.id === this.hoverId);
      if (h) this.outlineObj(h, 'rgba(37,99,235,.45)', 1.5);
    }
    if (!sel || sel.level !== store.level) return;
    this.outlineObj(sel, ACCENT, 2.2);
    const px = 1 / this.scale;
    if (sel.type === 'wall' || sel.type === 'dimension' || sel.type === 'guide') {
      if (sel.type === 'guide' && (sel.locked || store.view.guides === false)) return;
      this.handle(sel.x1, sel.y1, true); this.handle(sel.x2, sel.y2, true);
      if (sel.type === 'wall') {
        const m = this.bendPoint(sel), [sx, sy] = this.w2s(m.x, m.y), { ctx } = this;
        this.screenT();
        ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 7, sy); ctx.closePath();
        ctx.fillStyle = '#fff7ed'; ctx.fill(); ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 2; ctx.stroke();
      }
      return;
    }
    if (sel.wallId) {
      const w = store.doc.objects.find((x) => x.id === sel.wallId);
      if (!w || wallArc(w)) return;
      const a = wallAng(w), L = wallLen(w), s = w.kind === 'interior' ? -1 : -outwardSign(w, levelCentroid(store.level));
      const off = w.thickness / 2 + 22 * px, nx = -Math.sin(a) * s * off, ny = Math.cos(a) * s * off;
      const at = (t) => [w.x1 + Math.cos(a) * t + nx, w.y1 + Math.sin(a) * t + ny];
      const l = sel.t - sel.width / 2, r = sel.t + sel.width / 2;
      this.dimLine(at(0), at(l), fmtLen(l), '#c2410c', false, { kind: 'gap', o: sel, from: 0, value: l });
      this.dimLine(at(l), at(r), fmtLen(sel.width), ACCENT, true, { kind: 'opWidth', o: sel, value: sel.width });
      this.dimLine(at(r), at(L), fmtLen(L - r), '#c2410c', false, { kind: 'gapEnd', o: sel, L, value: L - r });
      return;
    }
    if (TYPES[sel.type]?.kind !== 'rect') return;
    const o = sel, off = 16 * px;
    if (SLABS.has(o.type) && o.shape && o.shape !== 'rect' && o.shape !== 'circle') {
      // every side gets its own editable dimension; custom shapes also get draggable corners
      const pts = floorPoly(o), n = pts.length, ccw = signedArea(pts) > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n], L = Math.hypot(bx - ax, by - ay);
        if (L < 0.05) continue;
        const nx = (-(by - ay) / L) * -ccw * off * 1.2, ny = ((bx - ax) / L) * -ccw * off * 1.2;
        this.dimLine(toWorld(o, ax + nx, ay + ny), toWorld(o, bx + nx, by + ny), fmtLen(L), '#0f766e', true, { kind: 'side', o, i, value: L });
      }
      if (o.shape === 'custom') for (const p of pts) this.handle(...toWorld(o, ...p), true);
      return;
    }
    if (dims().items) {
      this.dimLine(toWorld(o, -o.w / 2, -o.d / 2 - off), toWorld(o, o.w / 2, -o.d / 2 - off), fmtLen(o.w), ACCENT, true, { kind: 'itemW', o, value: o.w });
      if (o.d > 0.15) this.dimLine(toWorld(o, o.w / 2 + off, -o.d / 2), toWorld(o, o.w / 2 + off, o.d / 2), fmtLen(o.d), ACCENT, true, { kind: 'itemD', o, value: o.d });
    }
    const [tx, ty] = toWorld(o, 0, -o.d / 2), [rx, ry] = toWorld(o, 0, -o.d / 2 - 28 * px);
    this.screenT();
    const [a1, b1] = this.w2s(tx, ty), [a2, b2] = this.w2s(rx, ry);
    this.ctx.strokeStyle = ACCENT; this.ctx.lineWidth = 1.5; this.ctx.beginPath(); this.ctx.moveTo(a1, b1); this.ctx.lineTo(a2, b2); this.ctx.stroke();
    this.handle(rx, ry, true);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.handle(...toWorld(o, (sx * o.w) / 2, (sy * o.d) / 2));
  }

  // Centre lines (dash-dot) and face lines of every straight wall, shown while drawing or measuring.
  drawWallLines() {
    const { ctx } = this;
    this.screenT();
    ctx.save();
    for (const l of this.wallLines()) {
      const [x1, y1] = this.w2s(l.x1, l.y1), [x2, y2] = this.w2s(l.x2, l.y2);
      if (l.kind === 'centre') { ctx.strokeStyle = 'rgba(220,38,38,.75)'; ctx.lineWidth = 1; ctx.setLineDash([10, 3, 2, 3]); }
      else { ctx.strokeStyle = 'rgba(37,99,235,.55)'; ctx.lineWidth = 1; ctx.setLineDash([]); }
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    for (const w of wallsOn(store.level)) {
      if (!wallArc(w) || w.hidden) continue;
      ctx.strokeStyle = 'rgba(220,38,38,.75)'; ctx.setLineDash([10, 3, 2, 3]); ctx.beginPath();
      wallSamples(w).forEach(([x, y], i) => { const [sx, sy] = this.w2s(x, y); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    ctx.restore();
  }
  drawSnapAids() {
    const { ctx } = this;
    this.screenT();
    ctx.save();
    // alignment lines back to the corner the pointer lines up with
    for (const m of this.alignMarks || []) {
      const [x1, y1] = this.w2s(...m.from), [x2, y2] = this.w2s(...m.to);
      ctx.strokeStyle = '#db2777'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1 - 4, y1 - 4); ctx.lineTo(x1 + 4, y1 + 4); ctx.moveTo(x1 + 4, y1 - 4); ctx.lineTo(x1 - 4, y1 + 4); ctx.stroke();
    }
    // the wall line being snapped to, and a right-angle mark for a perpendicular snap
    const s = this.snapLine;
    if (s) {
      const l = s.line, [x1, y1] = this.w2s(l.x1, l.y1), [x2, y2] = this.w2s(l.x2, l.y2);
      ctx.strokeStyle = s.kind === 'centre' ? '#dc2626' : '#f97316'; ctx.lineWidth = 2.5; ctx.setLineDash(s.kind === 'centre' ? [10, 3, 2, 3] : []);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      const [sx, sy] = this.w2s(s.x, s.y);
      ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(s.kind === 'perp' ? '⟂ perpendicular' : s.kind === 'centre' ? 'centre line' : 'wall face', sx + 9, sy + 8);
      if (s.kind === 'perp') {
        const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, k = 8;
        ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(sx + ux * k, sy + uy * k); ctx.lineTo(sx + ux * k - uy * k, sy + uy * k + ux * k); ctx.lineTo(sx - uy * k, sy + ux * k); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTools() {
    const { ctx } = this, px = 1 / this.scale;
    if (['wall', 'measure', 'dimension', 'guide', 'room', 'stairdraw'].includes(store.tool)) this.drawWallLines();
    // curved wall being bent
    if (store.tool === 'wall' && this.draft?.bend && this.mouse.inside) {
      const { a, b } = this.draft.bend, bulge = this.bendFromPointer(this.mouse);
      const w = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, bulge, thickness: store.wallKind === 'interior' ? 0.12 : 0.25 };
      ctx.save(); this.worldT(); this.pathPoly(this.wallPoly(w));
      ctx.fillStyle = 'rgba(234,88,12,.3)'; ctx.fill(); ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.restore();
      const arc = wallArc(w);
      this.screenT();
      const [sx, sy] = this.w2s(this.mouse.x, this.mouse.y);
      this.badge(sx + 14, sy + 14, arc ? `arc ${fmtLen(arc.len)} · R ${fmtLen(arc.r)} — click to place` : `straight ${fmtLen(Math.hypot(b.x - a.x, b.y - a.y))} — move to bend`, '#ea580c');
      return;
    }
    // wall draft
    if (store.tool === 'wall' && this.draft) {
      const pts = this.draft.pts, last = pts[pts.length - 1];
      let pv = this.preview || last;
      if (this.typed) {
        const L = typedLen(this.typed) || 0, a = Math.atan2(pv.y - last.y, pv.x - last.x);
        pv = { x: last.x + Math.cos(a) * L, y: last.y + Math.sin(a) * L };
      }
      const L = Math.hypot(pv.x - last.x, pv.y - last.y);
      if (L > 0.01) {
        const w = { x1: last.x, y1: last.y, x2: pv.x, y2: pv.y, thickness: store.wallKind === 'interior' ? 0.12 : 0.25 };
        ctx.save(); this.worldT(); this.pathPoly(this.wallPoly(w));
        ctx.fillStyle = 'rgba(37,99,235,.35)'; ctx.fill(); ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.restore();
        const a = Math.atan2(pv.y - last.y, pv.x - last.x), off = w.thickness / 2 + 20 * px;
        this.dimLine([last.x - Math.sin(a) * off, last.y + Math.cos(a) * off], [pv.x - Math.sin(a) * off, pv.y + Math.cos(a) * off], fmtLen(L), ACCENT, true);
        this.screenT();
        const [sx, sy] = this.w2s(pv.x, pv.y);
        let deg = Math.round(-a / DEG); if (deg < 0) deg += 360;
        this.badge(sx + 14, sy + 16, `${this.typed ? 'Length: ' + this.typed + ' ' + store.doc.units + ' ⏎' : fmtLen(L)} · ${deg}°`);
      }
      this.screenT();
      for (const p of pts) { const [sx, sy] = this.w2s(p.x, p.y); ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill(); }
    }
    // guide-line draft
    if (store.tool === 'guide' && this.guideDraft && this.mouse.inside) {
      const a = this.guideDraft, b = this.preview || this.mouse;
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.01) {
        this.drawGuide({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, ACCENT, 1.6);
        this.screenT();
        const [sx, sy] = this.w2s(b.x, b.y);
        let deg = Math.round(-Math.atan2(b.y - a.y, b.x - a.x) / DEG); if (deg < 0) deg += 360;
        this.badge(sx + 14, sy + 16, (deg % 180 === 0 ? 'Horizontal' : deg % 180 === 90 ? 'Vertical' : deg + '°') + ' · click to place', GUIDE);
      }
      this.screenT();
      const [sx, sy] = this.w2s(a.x, a.y);
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fillStyle = GUIDE; ctx.fill();
    }
    // dimension-line draft
    if (store.tool === 'dimension' && this.dimDraft && this.mouse.inside) {
      const a = this.dimDraft, b = this.snapOn() ? this.snapPoint(this.mouse) : this.mouse;
      this.drawDimObj({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, offset: 0.6, color: ACCENT });
    }
    // room / stairs draft
    if (this.drag?.mode === 'room' || this.drag?.mode === 'stairdraw') {
      const { a, b } = this.drag;
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      ctx.save(); this.worldT();
      ctx.fillStyle = 'rgba(37,99,235,.08)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 8 * px * 0.6; ctx.globalAlpha = 0.6; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
      this.dimLine([x0, y0 - 18 * px], [x1, y0 - 18 * px], fmtLen(x1 - x0), ACCENT, true);
      this.dimLine([x1 + 18 * px, y0], [x1 + 18 * px, y1], fmtLen(y1 - y0), ACCENT, true);
      const area = (x1 - x0) * (y1 - y0);
      this.screenT();
      const [cx, cy] = this.w2s((x0 + x1) / 2, (y0 + y1) / 2);
      this.badge(cx - 30, cy - 10, store.doc.units === 'ft' ? `${(area * 10.7639).toFixed(0)} ft²` : `${area.toFixed(1)} m²`);
    }
    // measure
    if (this.measure) {
      const { a, b } = this.measure;
      this.screenT();
      const [x1, y1] = this.w2s(a.x, a.y), [x2, y2] = this.w2s(b.x, b.y);
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#c2410c'; ctx.fill(); }
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L > 0.01) {
        let deg = Math.round(-Math.atan2(b.y - a.y, b.x - a.x) / DEG); if (deg < 0) deg += 360;
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), axis = dx < 0.005 || dy < 0.005;
        this.badge((x1 + x2) / 2 + 10, (y1 + y2) / 2 - 24, `📏 ${fmtLen(L)}` + (axis ? '' : `  ·  ΔX ${fmtLen(dx)}  ΔY ${fmtLen(dy)}  ·  ${deg}°`), '#c2410c');
      }
    }
    // placement ghost
    const key = store.tool === 'place' ? store.armed : this.dragOver ? store.dragKey : null;
    if (key && this.mouse.inside) {
      const p = this.snapOn() ? { x: snapVal(this.mouse.x), y: snapVal(this.mouse.y) } : this.mouse;
      const g = this.ghostFor(key, p);
      if (g) {
        ctx.save(); ctx.globalAlpha = 0.65;
        if (g.noWall) {
          this.screenT();
          const [sx, sy] = this.w2s(g.px, g.py);
          ctx.globalAlpha = 1;
          this.badge(sx + 12, sy + 12, 'Move onto a wall', '#b91c1c');
        } else if (g.wall) {
          this.worldT(); ctx.translate(g.wall.x1, g.wall.y1); ctx.rotate(wallAng(g.wall));
          drawOpening2D(ctx, g, g.wall, px, 'rgba(219,234,254,1)');
          ctx.strokeStyle = ACCENT; ctx.lineWidth = 2 * px; ctx.strokeRect(g.t - g.width / 2, -g.wall.thickness / 2, g.width, g.wall.thickness);
        } else this.drawItem(g);
        ctx.restore();
      }
    }
    this.drawSnapAids();
    if (this.snapMark && store.tool !== 'select') {
      this.screenT();
      const [sx, sy] = this.w2s(this.snapMark.x, this.snapMark.y);
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.stroke();
    }
  }

  badge(x, y, text, color = ACCENT) {
    const { ctx } = this;
    this.screenT();
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, 22, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7, y + 11.5);
  }

  drawScaleBar() {
    const { ctx } = this, ft = store.doc.units === 'ft';
    const cands = ft ? [1, 2, 5, 10, 20, 50, 100].map((v) => v * FT) : [0.5, 1, 2, 5, 10, 20, 50];
    const m = cands.find((v) => v * this.scale >= 70) || cands[cands.length - 1];
    const w = m * this.scale, x = 16, y = this.H - 22;
    this.screenT();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.roundRect(x - 8, y - 20, w + 16, 30, 6); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.fillRect(x, y, w / 2, 4); ctx.strokeStyle = '#334155'; ctx.strokeRect(x + 0.5, y + 0.5, w, 4);
    ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(ft ? `${Math.round(m / FT)} ft` : `${m} m`, x + w / 2, y - 6);
    // compass: north as set for the site, turned with the view (click it to put north up)
    const nx = this.W - 36, ny = 42, a = ((store.doc.north || 0) * Math.PI) / 180 + this.vr;
    this.compass = { x: nx, y: ny, r: 22 };
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(nx, ny, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(a);
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
    ctx.font = '700 8px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [t, x, y] of [['N', 0, -19.5], ['E', 18.5, 0], ['S', 0, 18.5], ['W', -18.5, 0]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-a); ctx.fillStyle = t === 'N' ? '#dc2626' : '#64748b'; ctx.fillText(t, 0, 0.5); ctx.restore();
    }
    ctx.restore();
  }
}

// Central document store, undo/redo, persistence, units and geometry helpers.
export const DEG = Math.PI / 180;
export const FT = 0.3048;
const STORAGE_KEY = 'homecraft.doc.v1';

export function newDoc() {
  return {
    version: 1,
    name: 'My Home',
    units: 'm',
    levels: [{ name: 'Ground Floor', height: 3 }],
    objects: [],
  };
}

export const store = {
  doc: newDoc(),
  selectedId: null,
  level: 0,
  tool: 'select',      // select | wall | room | measure | place
  armed: null,         // catalog key when tool === 'place'
  wallKind: 'exterior',
  dragKey: null,       // catalog key being dragged from the palette
  view: { dims: true, snap: true, grid: true, guides: true, roof: true, upper: true, mode: 'split' },
};

// ---------- events ----------
const listeners = new Set();
export const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let saveTimer = null;
export function emit(kind = 'doc') {
  for (const fn of listeners) fn(kind);
  if (kind === 'doc') { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
}

// ---------- persistence ----------
export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store.doc)); } catch { /* storage unavailable */ }
}
export function loadSaved() {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ---------- undo / redo ----------
let undoStack = [];
let redoStack = [];
export function checkpoint() {
  undoStack.push(JSON.stringify(store.doc));
  if (undoStack.length > 150) undoStack.shift();
  redoStack = [];
}
export function dropIfUnchanged() {
  if (undoStack.length && undoStack[undoStack.length - 1] === JSON.stringify(store.doc)) undoStack.pop();
}
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(JSON.stringify(store.doc));
  store.doc = JSON.parse(undoStack.pop());
  fixup(); emit('doc'); emit('selection');
  return true;
}
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(JSON.stringify(store.doc));
  store.doc = JSON.parse(redoStack.pop());
  fixup(); emit('doc'); emit('selection');
  return true;
}
function fixup() {
  if (store.selectedId && !getObj(store.selectedId)) store.selectedId = null;
  if (store.level >= store.doc.levels.length) store.level = store.doc.levels.length - 1;
}
export function setDoc(doc) {
  store.doc = doc;
  undoStack = []; redoStack = [];
  store.selectedId = null;
  store.level = 0;
  emit('doc'); emit('selection'); emit('level');
}

// ---------- object helpers ----------
export const uid = () => Math.random().toString(36).slice(2, 10);
export const getObj = (id) => store.doc.objects.find((o) => o.id === id);
// Finished floor level of a storey above natural ground (includes the plinth height).
export function levelElev(level, doc = store.doc) {
  let e = doc.plinth || 0;
  for (let i = 0; i < level; i++) e += doc.levels[i]?.height ?? 3;
  return e;
}
// Site / landscape objects sit on natural ground rather than on the plinth.
export const SITE_TYPES = new Set(['ramp', 'steps', 'paving', 'tree', 'shrub', 'gate', 'boundary', 'fence', 'car', 'carport', 'pool', 'gazebo', 'lamp', 'hedge',
  'flowerbed', 'pot', 'tulsi', 'bench', 'swing', 'fountain', 'rocks', 'portico', 'pergola', 'well', 'septic', 'sitout']);
export const baseElev = (o, doc = store.doc) => (o.level === 0 && SITE_TYPES.has(o.type) && !o.onPlinth ? 0 : levelElev(o.level, doc));
export const wallsOn = (level, doc = store.doc) => doc.objects.filter((o) => o.type === 'wall' && o.level === level);
export const openingsOf = (wallId, doc = store.doc) => doc.objects.filter((o) => o.wallId === wallId);
export function removeObj(id) {
  store.doc.objects = store.doc.objects.filter((o) => o.id !== id && o.wallId !== id);
  if (store.selectedId === id) store.selectedId = null;
}

// ---------- geometry ----------
export const chordLen = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
// Length along the wall: the arc length for curved walls.
export const wallLen = (w) => { const a = wallArc(w); return a ? a.len : chordLen(w); };
export const wallAng = (w) => Math.atan2(w.y2 - w.y1, w.x2 - w.x1);

// Curved walls: `bulge` is the signed sagitta (offset of the arc's midpoint from the chord, + = left side).
export function wallArc(w) {
  const b = w.bulge || 0, c = chordLen(w);
  if (Math.abs(b) < 0.01 || c < 0.01) return null;
  const a = wallAng(w), nx = -Math.sin(a), ny = Math.cos(a);
  const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
  const r = (c * c) / 4 / (2 * Math.abs(b)) + Math.abs(b) / 2;
  const sb = Math.sign(b), cx = mx + nx * sb * (Math.abs(b) - r), cy = my + ny * sb * (Math.abs(b) - r);
  const a0 = Math.atan2(w.y1 - cy, w.x1 - cx);
  const sweep = 4 * Math.atan((2 * Math.abs(b)) / c) * (sb > 0 ? -1 : 1);
  return { cx, cy, r, a0, sweep, len: r * Math.abs(sweep) };
}
// Point and tangent direction at distance t along the wall (works for straight and curved walls).
export function wallPointAt(w, t) {
  const arc = wallArc(w);
  if (!arc) { const a = wallAng(w); return { x: w.x1 + Math.cos(a) * t, y: w.y1 + Math.sin(a) * t, a }; }
  const ang = arc.a0 + (arc.sweep * t) / arc.len;
  return { x: arc.cx + Math.cos(ang) * arc.r, y: arc.cy + Math.sin(ang) * arc.r, a: ang + (arc.sweep > 0 ? Math.PI / 2 : -Math.PI / 2) };
}
// Closest point on a wall: t is the fraction along it, d the distance from (px, py).
export function projectToWall(px, py, w) {
  const arc = wallArc(w);
  if (!arc) return projectToSegment(px, py, w.x1, w.y1, w.x2, w.y2);
  let da = Math.atan2(py - arc.cy, px - arc.cx) - arc.a0;
  while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  let f = da / arc.sweep;
  if (f < 0 || f > 1) f = Math.hypot(px - w.x1, py - w.y1) < Math.hypot(px - w.x2, py - w.y2) ? 0 : 1;
  const p = wallPointAt(w, f * arc.len);
  return { t: f, x: p.x, y: p.y, d: Math.hypot(px - p.x, py - p.y) };
}
// Points along a wall (for drawing); offset shifts sideways (+ = left).
export function wallSamples(w, offset = 0, n) {
  const L = wallLen(w), arc = wallArc(w), k = n || (arc ? Math.max(8, Math.ceil(L / 0.25)) : 1), out = [];
  for (let i = 0; i <= k; i++) {
    const p = wallPointAt(w, (i / k) * L);
    out.push([p.x - Math.sin(p.a) * offset, p.y + Math.cos(p.a) * offset]);
  }
  return out;
}
export function projectToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { t, x, y, d: Math.hypot(px - x, py - y) };
}
export function toLocal(o, px, py) {
  const r = -(o.rot || 0) * DEG, dx = px - o.x, dy = py - o.y;
  return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
}
export function toWorld(o, lx, ly) {
  const r = (o.rot || 0) * DEG;
  return [o.x + lx * Math.cos(r) - ly * Math.sin(r), o.y + lx * Math.sin(r) + ly * Math.cos(r)];
}
// Centroid of the exterior walls on a level, used to decide which wall face is "outside".
export function levelCentroid(level, doc = store.doc) {
  const ws = wallsOn(level, doc).filter((w) => w.kind !== 'interior');
  const list = ws.length ? ws : wallsOn(level, doc);
  if (!list.length) return null;
  let sx = 0, sy = 0, sl = 0;
  for (const w of list) {
    const L = wallLen(w);
    sx += (w.x1 + w.x2) / 2 * L; sy += (w.y1 + w.y2) / 2 * L; sl += L;
  }
  return sl ? { x: sx / sl, y: sy / sl } : null;
}
// +1 if the wall's left normal (-dy, dx) points outside the building, -1 otherwise.
export function outwardSign(w, centroid) {
  if (!centroid) return 1;
  const a = wallAng(w);
  const nx = -Math.sin(a), ny = Math.cos(a);
  const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
  return ((centroid.x - mx) * nx + (centroid.y - my) * ny) > 0 ? -1 : 1;
}
export function openingCenter(op, w) {
  const a = wallAng(w);
  return { x: w.x1 + Math.cos(a) * op.t, y: w.y1 + Math.sin(a) * op.t, a };
}

// ---------- units & dimension settings ----------
export const UNITS = {
  m: { f: 1, label: 'm', name: 'Metres', dec: 2 },
  cm: { f: 0.01, label: 'cm', name: 'Centimetres', dec: 0 },
  mm: { f: 0.001, label: 'mm', name: 'Millimetres', dec: 0 },
  ft: { f: FT, label: 'ft', name: 'Feet & inches', dec: 2 },
};
export const DEFAULT_DIMS = {
  overall: true, exterior: true, interior: true, openings: false, rooms: true, items: true,
  mode: 'center',      // center | outside | clear  (how wall lengths are measured)
  precision: null,     // decimals in the display unit (null = unit default); for ft: inch fraction denominator
  snap: null,          // snap step in metres (null = unit default)
  textSize: 11,
  areaUnit: 'auto',    // auto | m2 | sqft | cent | all
};
export const dims = () => ({ ...DEFAULT_DIMS, ...(store.doc.dims || {}) });
const unitOf = (u = store.doc.units) => UNITS[u] || UNITS.m;

export function fmtLen(m, units = store.doc.units, precision) {
  const sign = m < 0 ? '-' : '';
  m = Math.abs(m);
  const p = precision ?? dims().precision;
  if (units === 'ft') {
    const den = p && p >= 1 ? p : 1; // 1, 2, 4, 8, 16 → whole, ½, ¼, ⅛, 1/16 inch
    const totalIn = Math.round((m / 0.0254) * den) / den;
    let ft = Math.floor(totalIn / 12), inch = totalIn - ft * 12;
    if (inch >= 12 - 1e-9) { ft += 1; inch = 0; }
    const whole = Math.floor(inch + 1e-9), frac = Math.round((inch - whole) * den);
    return `${sign}${ft}′ ${whole}${frac ? ` ${frac / gcd(frac, den)}/${den / gcd(frac, den)}` : ''}″`;
  }
  const u = unitOf(units), v = m / u.f, d = p ?? (units === 'm' && v >= 10 ? 1 : u.dec);
  return `${sign}${v.toFixed(Math.max(0, Math.min(4, d)))} ${u.label}`;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const toUnit = (m) => m / unitOf().f;
export const fromUnit = (v) => v * unitOf().f;
export const unitLabel = () => unitOf().label;
export const gridStep = () => dims().snap || (store.doc.units === 'ft' ? FT / 4 : 0.1);
export const snapVal = (v, g = gridStep()) => Math.round(v / g) * g;
export const isImperial = () => store.doc.units === 'ft';
// Areas in the unit chosen in dimension settings: auto (m² or ft² with the drawing units), m², ft², cents or all three.
export const CENT_M2 = 40.4686;
export const fmtArea = (a, unit = dims().areaUnit) => {
  const m2 = `${a.toFixed(2)} m²`, ft2 = `${Math.round(a * 10.7639).toLocaleString()} ft²`, ct = `${(a / CENT_M2).toFixed(2)} cents`;
  if (unit === 'm2') return m2;
  if (unit === 'sqft') return ft2;
  if (unit === 'cent') return ct;
  if (unit === 'all') return isImperial() ? `${ft2} · ${ct}` : `${m2} · ${ct}`;
  return isImperial() ? ft2 : m2;
};
// every unit at once, for measurements
export const fmtAreaAll = (a) => `${a.toFixed(2)} m²  ·  ${Math.round(a * 10.7639).toLocaleString()} ft²  ·  ${(a / CENT_M2).toFixed(3)} cents`;
// Wall length as displayed for the chosen measuring convention.
export function wallDimLen(w) {
  const L = wallLen(w), mode = dims().mode;
  if (mode === 'outside' && w.kind !== 'interior') return L + w.thickness;
  if (mode === 'clear') return Math.max(0, L - (w.kind === 'interior' ? 0.25 : w.thickness));
  return L;
}

// Door/window tags for drawings & schedules. Openings of identical type and size share a tag (D1, W2…);
// a user-entered tag always wins.
export function openingTags(doc = store.doc) {
  const map = {}, types = {}, count = { door: 0, window: 0 };
  const ops = doc.objects.filter((o) => o.wallId).sort((a, b) => a.level - b.level || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0) || b.width - a.width);
  for (const o of ops) {
    if (o.tag) { map[o.id] = o.tag; continue; }
    const key = `${o.type}|${o.style}|${o.width.toFixed(3)}|${o.height.toFixed(3)}|${(o.sill || 0).toFixed(3)}`;
    types[key] ??= `${o.type === 'door' ? 'D' : 'W'}${++count[o.type]}`;
    map[o.id] = types[key];
  }
  return map;
}

// A user can lock individual dimensions of an object (e.g. width) so no edit changes them.
export const isDimLocked = (o, key) => !!o?.lockDims?.[key];

// ---------- precise edits ----------
// Change a wall's length; anchor keeps 'start', 'end' or 'center' fixed. Joined walls follow.
export function setWallLength(w, L, anchor = w.lenAnchor || 'start') {
  const a = wallAng(w), old = { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, c = Math.cos(a), s = Math.sin(a), oldLen = wallLen(w);
  if (wallArc(w)) {
    // curved wall: scale the arc uniformly (same sweep), so chord and bulge grow together
    const k = L / wallLen(w);
    w.bulge *= k;
    L = chordLen(w) * k;
  }
  if (anchor === 'end') { w.x1 = w.x2 - c * L; w.y1 = w.y2 - s * L; }
  else if (anchor === 'center') {
    const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
    w.x1 = mx - (c * L) / 2; w.y1 = my - (s * L) / 2; w.x2 = mx + (c * L) / 2; w.y2 = my + (s * L) / 2;
  } else { w.x2 = w.x1 + c * L; w.y2 = w.y1 + s * L; }
  followJoints(w, old);
  const newLen = wallLen(w);
  for (const op of openingsOf(w.id)) op.t = Math.max(op.width / 2, Math.min(newLen - op.width / 2, anchor === 'end' ? op.t + (newLen - oldLen) : op.t));
}
export function setWallAngle(w, deg) {
  const L = chordLen(w), old = { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, a = -deg * DEG;
  w.x2 = w.x1 + Math.cos(a) * L; w.y2 = w.y1 + Math.sin(a) * L;
  followJoints(w, old);
}
export function followJoints(w, old) {
  for (const o of wallsOn(w.level)) {
    if (o.id === w.id || isDimLocked(o, 'length') || o.locked) continue;
    for (const e of [1, 2]) for (const f of [1, 2]) {
      if (Math.hypot(o['x' + e] - old['x' + f], o['y' + e] - old['y' + f]) < 0.02) { o['x' + e] = w['x' + f]; o['y' + e] = w['y' + f]; }
    }
  }
}

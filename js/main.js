// App shell: palette, tools, properties panel, levels, shortcuts and wiring between 2D and 3D.
import {
  store, on, emit, checkpoint, dropIfUnchanged, undo, redo, setDoc, newDoc, loadSaved, getObj, uid, removeObj,
  wallsOn, openingsOf, wallLen, projectToSegment, projectToWall, toUnit, fromUnit, unitLabel, fmtLen, snapVal, DEG,
  setWallLength, setWallAngle, followJoints, fmtArea, UNITS, dims, DEFAULT_DIMS, isImperial, isDimLocked, openingTags,
} from './state.js';
import { CATALOG, CATALOG_INDEX, TYPES, ICONS, iconForObj, labelForObj, floorPoly, polyArea, setSideLength, inScope, objScope as objScopeOf } from './catalog.js';
import { Plan2D } from './plan2d.js';
import { plotOf, rect, shapePlot, siteBounds, sideLen, setSide, cornerAngle, setCornerAngle, sideBearing, setSideBearing, sideFacing, setbackPoly, alignSide, plotStats, plotEditBlock, solveQuad, dividePlot, CENT, SQFT } from './plot.js';
import { DESIGNS, keralaTraditional } from './designs.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c);
  return el;
};

// ------------------------------------------------------------------ app facade used by the views
const app = {
  selected: () => (store.selectedId ? getObj(store.selectedId) : null),
  select(id) { store.selectedId = id; emit('selection'); },
  setTool,
  placeAt,
  toast,
  addGuide,
  showCoords(x, y) { $('#status-coords').textContent = `X ${fmtLen(x)}   Y ${fmtLen(y)}`; },
  focusProps() { $('#props input, #props select')?.focus(); },
  onWalkChange(onWalk) { $('[data-act=walk]').classList.toggle('on', onWalk); },
  onPlayerChange(on) { $('#play-hud').hidden = !on; $('#btn-tour').classList.toggle('on', on); },
  onPlayerTick(p) {
    const now = performance.now();
    if (now - (this._hudT || 0) < 150) return;
    this._hudT = now;
    const where = p.whereAmI();
    $('#ph-room').textContent = where.room; $('#ph-level').textContent = where.level || '';
    $('#ph-speed').textContent = `${Math.hypot(p.vel.x, p.vel.z).toFixed(1)} m/s`;
    $('#ph-state').textContent = p.grounded ? 'on ground' : p.vel.y > 0 ? 'jumping' : 'falling';
    $('#ph-height').textContent = `feet at +${fmtLen(p.pos.y)}`;
  },
  onViewRotate() { syncViewDir(); },
  onElevationChange(side) {
    $('#elev-select').value = side || '';
    $('#pane-3d .pane-tag').lastChild.textContent = side ? { front: 'Front elevation', rear: 'Rear elevation', left: 'Left elevation', right: 'Right elevation' }[side] : '3D View';
  },
};

const plan = new Plan2D($('#plan'), app);
let view = null;

// ------------------------------------------------------------------ tools & placement
const HINTS = {
  select: 'Click to select · drag to move · drag empty space to pan · scroll to zoom',
  wall: 'Click to start · click each corner · type a length + Enter for exact size · double-click or Esc to finish · Shift = free angle',
  room: 'Drag a rectangle to create a room — four walls plus a floor',
  measure: 'Click point to point to measure · click the first point to close an area (m², ft², cents) · Enter keeps it · Esc clears · hover a room for its area · select something and hold Alt for distances',
  dimension: 'Click the first point, then the second, to add a permanent dimension line · double-click any dimension to type a value',
  stairdraw: 'Drag the stair area — the steps re-flow to fit · a single click places a standard size',
  guide: 'Click two points to lay a guide line (15° steps, Shift = free) · guides lock in place · walls snap to guides and crossings',
};
function setTool(tool, opts = {}) {
  if (store.tool === 'wall' && tool !== 'wall') plan.finishDraft();
  if (tool !== 'measure') { plan.mchain = null; plan.hoverArea = null; }
  plan.dimDraft = null; plan.guideDraft = null;
  store.tool = tool;
  store.armed = tool === 'place' ? opts.armed : null;
  if (tool === 'stairdraw') { store.stairShape = opts.stairShape || 'straight'; store.stairKey = opts.key; }
  if (tool === 'room') { store.roomPreset = opts.preset || null; store.roomKey = opts.key; }
  if (tool === 'wall') { store.wallKind = opts.wallKind || store.wallKind; store.wallCurve = !!opts.curve; plan.finishDraft(); }
  let hint = (opts.key && CATALOG_INDEX[opts.key]?.hint) || HINTS[tool] || '';
  if (tool === 'place') {
    const it = CATALOG_INDEX[opts.armed], m = it.make();
    hint = m.type === 'door' || m.type === 'window'
      ? `Click on a wall to place the ${it.label.toLowerCase()} · Esc to cancel`
      : `Click in the plan or 3D view to place the ${it.label.toLowerCase()} · Esc to cancel`;
  }
  $('#hint').textContent = tool === 'select' ? '' : hint;
  $('#status-tool').textContent = hint;
  $$('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  $$('.card').forEach((c) => {
    const it = CATALOG_INDEX[c.dataset.key];
    c.classList.toggle('active', (tool === 'place' && store.armed === it.key) || (tool === 'wall' && it.tool === 'wall' && it.wallKind === store.wallKind && !!it.curve === !!store.wallCurve)
      || ((tool === 'stairdraw' || tool === 'room') && (store.stairKey === it.key || store.roomKey === it.key) && it.tool === tool) || (tool === 'room' && !store.roomPreset && it.key === 'room') || ((tool === 'dimension' || tool === 'guide') && it.tool === tool));
  });
  plan.c.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  plan.redraw();
}

function nearestWall(x, y, maxD = 1.2) {
  let best = null, bd = maxD;
  for (const w of wallsOn(store.level)) {
    const pr = projectToWall(x, y, w);
    if (pr.d < bd) { bd = pr.d; best = { w, pr }; }
  }
  return best;
}
function exteriorBounds(level) {
  const ws = wallsOn(level).filter((w) => w.kind !== 'interior');
  if (ws.length < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ws) {
    const t = w.thickness / 2;
    x0 = Math.min(x0, w.x1 - t, w.x2 - t); x1 = Math.max(x1, w.x1 + t, w.x2 + t);
    y0 = Math.min(y0, w.y1 - t, w.y2 - t); y1 = Math.max(y1, w.y1 + t, w.y2 + t);
  }
  return { x0, y0, x1, y1 };
}

function placeAt(key, x, y, { onWall } = {}) {
  const it = CATALOG_INDEX[key];
  if (!it) return;
  if (it.tool && !it.make) { setTool(it.tool, { wallKind: it.wallKind }); return; }
  const lvl = store.doc.levels[store.level];
  const o = { id: uid(), level: store.level, rot: 0, ...it.make() };
  if (o.type === 'door' || o.type === 'window') {
    const nw = onWall ? { w: onWall.wall, pr: projectToWall(onWall.x, onWall.y, onWall.wall) } : nearestWall(x, y);
    if (!nw) { toast('Doors and windows go on a wall — drop it onto a wall', true); return; }
    const L = wallLen(nw.w);
    o.wallId = nw.w.id;
    o.t = L <= o.width ? L / 2 : Math.max(o.width / 2, Math.min(L - o.width / 2, snapVal(nw.pr.t * L, 0.05)));
    if (o.type === 'door' && o.height > nw.w.height - 0.1) o.height = nw.w.height - 0.1;
  } else {
    Object.assign(o, { x: +x.toFixed(3), y: +y.toFixed(3), z: o.z ?? 0 });
    if (o.type === 'roof') {
      o.z = lvl.height;
      const b = exteriorBounds(store.level);
      if (b && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) Object.assign(o, { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, d: b.y1 - b.y0 });
    }
    if (o.type === 'stairs' || o.type === 'spiral') o.h = lvl.height;
    // ramps and sit-out steps rise to the plinth (finished floor) and size themselves for it
    if (o.type === 'ramp' || o.type === 'steps') {
      o.h ||= Math.max(0.15, store.doc.plinth || 0.45);
      if (o.type === 'ramp') o.d ||= +(o.h * (o.ratio || 12)).toFixed(2);
      if (o.type === 'steps' && !o.d) o.d = o.style === 'round' ? o.w / 2 : +(Math.max(1, Math.round(o.h / 0.15)) * 0.3).toFixed(2);
    }
  }
  checkpoint();
  store.doc.objects.push(o);
  store.selectedId = o.id;
  emit('doc'); emit('selection');
  if (store.tool === 'place' || store.tool === 'stairdraw') setTool('select');
  toast(`${it.label} added`);
}

// ------------------------------------------------------------------ guide lines
// New guides are locked straight away so they can't be nudged while walls are drawn over them.
function addGuide(a, b, extra = {}) {
  checkpoint();
  const o = { id: uid(), type: 'guide', level: store.level, x1: +a.x.toFixed(4), y1: +a.y.toFixed(4), x2: +b.x.toFixed(4), y2: +b.y.toFixed(4), color: '#0891b2', locked: true, ...extra };
  store.doc.objects.push(o);
  if (store.view.guides === false) { store.view.guides = true; syncToggles(); }
  store.selectedId = o.id;
  emit('doc'); emit('selection');
  toast('Guide placed and locked · walls snap to it · unlock it in Properties to move it');
  return o;
}
// Turn a guide into a wall between its two points.
function wallOnGuide(g, kind) {
  checkpoint();
  const w = plan.newWall({ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }, kind);
  w.level = g.level;
  store.doc.objects.push(w);
  store.selectedId = w.id;
  emit('doc'); emit('selection');
  toast(`${kind === 'interior' ? 'Interior' : 'Exterior'} wall built on the guide · ${fmtLen(wallLen(w))}`);
}
// A copy of the guide moved sideways by an exact distance.
function parallelGuide(g) {
  const v = prompt(`Distance for the parallel guide (${unitLabel()}). Use a negative value for the other side.`, String(+toUnit(1).toFixed(3)));
  const d = fromUnit(parseFloat(v));
  if (!d) return;
  const L = Math.hypot(g.x2 - g.x1, g.y2 - g.y1) || 1, nx = (-(g.y2 - g.y1) / L) * d, ny = ((g.x2 - g.x1) / L) * d;
  addGuide({ x: g.x1 + nx, y: g.y1 + ny }, { x: g.x2 + nx, y: g.y2 + ny }, { color: g.color, label: '' });
}
// Structural grid: vertical guides 1, 2, 3… and horizontal guides A, B, C… at the given spacings.
function openGuideGrid() {
  const ws = wallsOn(store.level);
  const x0 = ws.length ? Math.min(...ws.flatMap((w) => [w.x1, w.x2])) : 0, y0 = ws.length ? Math.min(...ws.flatMap((w) => [w.y1, w.y2])) : 0;
  const u = (m) => +toUnit(m).toFixed(3);
  const inp = (id, value, ph) => h('input', { id, type: 'text', value, placeholder: ph, style: 'width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:8px' });
  const row = (label, el, note) => h('div', { style: 'margin:12px 0' }, h('label', { style: 'display:block;font-weight:600;margin-bottom:4px' }, label), el, note ? h('p', { class: 'note' }, note) : null);
  const ft = store.doc.units === 'ft';
  const fx = inp('gg-x', ft ? '10, 12, 10' : '3, 4, 3', 'e.g. 3, 4, 3'), fy = inp('gg-y', ft ? '12, 12' : '4, 4', 'e.g. 4, 4');
  const ox = inp('gg-ox', String(u(x0))), oy = inp('gg-oy', String(u(y0)));
  const build = () => {
    const list = (el) => el.value.split(/[,;\s]+/).map(parseFloat).filter((n) => n > 0).map(fromUnit);
    const sx = list(fx), sy = list(fy), bx = fromUnit(parseFloat(ox.value) || 0), by = fromUnit(parseFloat(oy.value) || 0);
    const xs = [bx, ...sx.map((_, i) => bx + sx.slice(0, i + 1).reduce((a, b) => a + b, 0))];
    const ys = [by, ...sy.map((_, i) => by + sy.slice(0, i + 1).reduce((a, b) => a + b, 0))];
    const xEnd = xs[xs.length - 1], yEnd = ys[ys.length - 1];
    checkpoint();
    xs.forEach((x, i) => store.doc.objects.push({ id: uid(), type: 'guide', level: store.level, x1: +x.toFixed(4), y1: +by.toFixed(4), x2: +x.toFixed(4), y2: +(yEnd > by ? yEnd : by + 1).toFixed(4), label: String(i + 1), color: '#0891b2', locked: true }));
    ys.forEach((y, i) => store.doc.objects.push({ id: uid(), type: 'guide', level: store.level, x1: +bx.toFixed(4), y1: +y.toFixed(4), x2: +(xEnd > bx ? xEnd : bx + 1).toFixed(4), y2: +y.toFixed(4), label: String.fromCharCode(65 + (i % 26)), color: '#0891b2', locked: true }));
    store.view.guides = true; syncToggles();
    emit('doc'); closeModal();
    toast(`Guide grid placed: ${xs.length} × ${ys.length} lines, locked · draw walls along it`);
  };
  openModal(h('div', { class: 'modal-h' }, h('h2', {}, 'Guide grid'), h('button', { class: 'x', onclick: closeModal }, '✕')),
    h('div', { style: 'max-width:460px' },
      h('p', { class: 'note' }, `Lay out the setting-out grid first, then draw walls over it. Spacings are in ${unitLabel()}, separated by commas.`),
      row('Spacings between vertical lines (1, 2, 3…)', fx, 'Three spacings make four lines.'),
      row('Spacings between horizontal lines (A, B, C…)', fy),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, row(`Start X (${unitLabel()})`, ox), row(`Start Y (${unitLabel()})`, oy)),
      h('p', { class: 'note' }, 'The start defaults to the top-left wall corner on this storey. All grid lines are locked when placed.'),
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px' }, h('button', { onclick: closeModal }, 'Cancel'), h('button', { class: 'primary', onclick: build }, 'Place grid'))));
  fx.focus();
}

// ------------------------------------------------------------------ lock / hide / layer order
function setFlag(o, flag, v) {
  checkpoint(); o[flag] = v;
  if (o.type === 'wall') for (const op of openingsOf(o.id)) op[flag] = v;
  emit('doc'); renderProps(true);
}
function arrange(o, how) {
  const z = (x) => (TYPES[x.type]?.z2d ?? 5) + (x.zb || 0);
  const peers = store.doc.objects.filter((x) => x.level === o.level && TYPES[x.type]?.kind === 'rect' && x.id !== o.id);
  const base = TYPES[o.type]?.z2d ?? 5;
  checkpoint();
  if (how === 'front') o.zb = Math.max(z(o), ...peers.map(z)) + 0.1 - base;
  if (how === 'back') o.zb = Math.min(z(o), ...peers.map(z)) - 0.1 - base;
  if (how === 'forward') o.zb = (o.zb || 0) + 1;
  if (how === 'backward') o.zb = (o.zb || 0) - 1;
  emit('doc');
  toast({ front: 'Brought to front', back: 'Sent to back', forward: 'Moved forward', backward: 'Moved backward' }[how]);
}

// Elements tree: storey → group → element, with select, hide and lock.
const TREE_GROUPS = [
  ['Walls', (o) => o.type === 'wall'], ['Doors & windows', (o) => !!o.wallId], ['Rooms & floors', (o) => o.type === 'floor'],
  ['Stairs', (o) => o.type === 'stairs' || o.type === 'spiral'], ['Roof & facade', (o) => ['roof', 'balcony', 'cladding', 'louvers', 'frame', 'chimney', 'column', 'portico'].includes(o.type)],
  ['Furniture & fittings', (o) => objScopeOf(o) === 'indoor'], ['Outdoor & garden', (o) => objScopeOf(o) === 'outdoor'],
  ['Dimensions', (o) => o.type === 'dimension'], ['Guides', (o) => o.type === 'guide'], ['Areas', (o) => o.type === 'area'],
];
const groupOf = (o) => TREE_GROUPS.find(([, f]) => f(o))?.[0] || 'Other';
const treeOpen = new Set(['L0']);
let treeFilter = '';
function renderTree(panel) {
  const doc = store.doc, tags = openingTags();
  const body = h('div');
  panel.append(h('div', { class: 'tree' },
    h('div', { class: 'tree-search' }, h('input', { type: 'search', placeholder: 'Filter elements…', value: treeFilter, oninput: (e) => { treeFilter = e.target.value.toLowerCase(); draw(); } })),
    body));
  const nameOf = (o) => {
    if (o.wallId) return `${tags[o.id]} · ${labelForObj(o)} ${fmtLen(o.width)}`;
    if (o.type === 'wall') return `${labelForObj(o)} ${fmtLen(wallLen(o))}`;
    if (o.type === 'floor') return `${o.name || 'Floor'} · ${fmtArea(polyArea(floorPoly(o)))}`;
    return labelForObj(o);
  };
  const row = (o) => h('div', { class: 'tree-item' + (o.id === store.selectedId ? ' sel' : '') + (o.hidden ? ' dim' : ''),
    onclick: (e) => { if (e.target.closest('button')) return; if (store.level !== o.level) { store.level = o.level; emit('level'); } app.select(o.id); } },
    h('span', { class: 'ti-ico', html: iconForObj(o) }), h('span', { class: 'ti-name', title: nameOf(o) }, nameOf(o)),
    h('button', { title: o.hidden ? 'Show' : 'Hide', onclick: () => setFlag(o, 'hidden', !o.hidden) }, o.hidden ? '🙈' : '👁'),
    h('button', { title: o.locked ? 'Unlock' : 'Lock', onclick: () => setFlag(o, 'locked', !o.locked) }, o.locked ? '🔒' : '🔓'));
  const node = (key, label, count, kids) => {
    const open = treeOpen.has(key) || !!treeFilter;
    return h('div', { class: 'tree-node' },
      h('div', { class: 'tree-h', onclick: () => { if (treeOpen.has(key)) treeOpen.delete(key); else treeOpen.add(key); draw(); } }, h('span', { class: 'chev' }, open ? '▾' : '▸'), h('span', {}, label), h('i', {}, String(count))),
      open ? h('div', { class: 'tree-kids' }, kids()) : null);
  };
  function draw() {
    body.innerHTML = '';
    doc.levels.forEach((l, li) => {
      const objs = doc.objects.filter((o) => o.level === li && (!treeFilter || nameOf(o).toLowerCase().includes(treeFilter)));
      body.append(node('L' + li, l.name, objs.length, () => [...TREE_GROUPS.map(([g]) => g), 'Other'].map((g) => {
        const list = objs.filter((o) => groupOf(o) === g);
        return list.length ? node(`L${li}:${g}`, g, list.length, () => list.map(row)) : null;
      })));
    });
  }
  draw();
}

// ------------------------------------------------------------------ editing commands
function deleteSelected() {
  const o = app.selected();
  if (!o) return;
  if (o.locked) { toast('This element is locked — unlock it first', true); return; }
  checkpoint();
  removeObj(o.id);
  emit('doc'); emit('selection');
}
function duplicateSelected() {
  const o = app.selected();
  if (!o) return;
  checkpoint();
  const c = { ...structuredClone(o), id: uid() };
  if (o.type === 'area') c.pts = o.pts.map(([x, y]) => [x + 1, y + 1]);
  else if (o.x1 !== undefined) {
    const off = 1;
    Object.assign(c, { x1: o.x1 + off, y1: o.y1 + off, x2: o.x2 + off, y2: o.y2 + off });
  } else if (o.wallId) {
    const L = wallLen(getObj(o.wallId));
    c.t = Math.min(L - o.width / 2, o.t + o.width + 0.3);
  } else { c.x += 1; c.y += 1; }
  store.doc.objects.push(c);
  if (o.type === 'wall') for (const op of openingsOf(o.id)) store.doc.objects.push({ ...structuredClone(op), id: uid(), wallId: c.id });
  store.selectedId = c.id;
  emit('doc'); emit('selection');
}
function rotateSelected(deg = 90) {
  const o = app.selected();
  if (!o) return;
  if (o.locked) { toast('This element is locked — unlock it first', true); return; }
  checkpoint();
  if (o.type === 'area') {
    const cx = o.pts.reduce((s, q) => s + q[0], 0) / o.pts.length, cy = o.pts.reduce((s, q) => s + q[1], 0) / o.pts.length, r = deg * DEG;
    o.pts = o.pts.map(([x, y]) => [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)]);
  } else if (o.x1 !== undefined) {
    const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2, r = deg * DEG;
    const rot = (x, y) => [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)];
    [o.x1, o.y1] = rot(o.x1, o.y1); [o.x2, o.y2] = rot(o.x2, o.y2);
  } else if (o.wallId) {
    if (o.type === 'door') { if (o.flip) o.hinge = !o.hinge; o.flip = !o.flip; }
  } else o.rot = ((((o.rot || 0) + deg) % 360) + 360) % 360;
  emit('doc');
}
function nudge(dx, dy) {
  const o = app.selected();
  if (!o) return;
  if (o.locked) { toast('This element is locked — unlock it first', true); return; }
  checkpoint();
  if (o.type === 'area') o.pts = o.pts.map(([x, y]) => [x + dx, y + dy]);
  else if (o.x1 !== undefined) { o.x1 += dx; o.x2 += dx; o.y1 += dy; o.y2 += dy; }
  else if (o.wallId) { const w = getObj(o.wallId); o.t = Math.max(o.width / 2, Math.min(wallLen(w) - o.width / 2, o.t + (dx || dy))); }
  else { o.x += dx; o.y += dy; }
  emit('doc');
}
// Computed properties (getters/setters named in the catalog schema).
const GETTERS = {
  openingLeft: (o) => o.t - o.width / 2,
  openingRight: (o) => wallLen(getObj(o.wallId)) - o.t - o.width / 2,
};
export const SETTERS = {
  wallLength: (o, v) => setWallLength(o, Math.max(0.1, v)),
  wallAngle: (o, v) => setWallAngle(o, v),
  guideAngle: (o, v) => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, a = -v * DEG; o.x2 = +(o.x1 + Math.cos(a) * L).toFixed(4); o.y2 = +(o.y1 + Math.sin(a) * L).toFixed(4); },
  dimLength: (o, v) => { const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1); o.x2 = o.x1 + Math.cos(a) * v; o.y2 = o.y1 + Math.sin(a) * v; },
  openingLeft: (o, v) => { o.t = v + o.width / 2; },
  openingRight: (o, v) => { o.t = wallLen(getObj(o.wallId)) - v - o.width / 2; },
  head: (o, v) => { o.height = Math.max(0.3, v - (o.sill || 0)); },
};

// ------------------------------------------------------------------ palette
function buildPalette() {
  const root = $('#palette');
  root.innerHTML = '';
  for (const cat of CATALOG) {
    const grid = h('div', { class: 'grid' });
    for (const it of cat.items) {
      const card = h('div', { class: 'card', 'data-key': it.key, title: it.hint || `${it.label} — click, then click the plan; or drag it in`, draggable: it.make ? 'true' : 'false' },
        h('span', { class: 'ci', html: ICONS[it.icon] }), h('span', {}, it.label));
      card.addEventListener('click', () => {
        if (it.action === 'guideGrid') openGuideGrid();
        else if (it.tool) setTool(it.tool, { wallKind: it.wallKind, stairShape: it.stairShape, preset: it.preset, key: it.key, curve: it.curve });
        else if (store.tool === 'place' && store.armed === it.key) setTool('select');
        else setTool('place', { armed: it.key });
      });
      card.addEventListener('dragstart', (e) => {
        store.dragKey = it.key;
        e.dataTransfer.setData('text/plain', it.key);
        e.dataTransfer.effectAllowed = 'copy';
      });
      card.addEventListener('dragend', () => { store.dragKey = null; plan.dragOver = false; plan.redraw(); });
      grid.append(card);
    }
    const sec = h('div', { class: 'cat', 'data-cat': cat.id, 'data-scope': cat.scope },
      h('button', { class: 'cat-h', onclick: () => sec.classList.toggle('closed') }, cat.label, h('span', { class: 'chev', html: '▾' })),
      grid);
    root.append(sec);
  }
  $$('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  $('#search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('.card').forEach((c) => { c.style.display = !q || c.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    $$('.cat').forEach((s) => {
      const any = $$('.card', s).some((c) => c.style.display !== 'none');
      s.style.display = any ? '' : 'none';
      if (q) s.classList.remove('closed');
    });
  });
}

// ------------------------------------------------------------------ properties panel
function field(o, p) {
  const id = 'f-' + p.key;
  const get = () => (typeof p.get === 'function' ? p.get(o) : p.get ? GETTERS[p.get](o) : o[p.key]);
  const commit = (v) => {
    if (o.locked) { toast('This element is locked — unlock it first', true); renderProps(true); return; }
    checkpoint();
    if (p.set) SETTERS[p.set](o, v);
    else if (o.type === 'wall' && /^[xy][12]$/.test(p.key)) { const old = { x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }; o[p.key] = v; followJoints(o, old); }
    else o[p.key] = v;
    if (o.wallId && (p.key === 'width' || p.key === 't')) {
      const L = wallLen(getObj(o.wallId));
      o.t = Math.max(o.width / 2, Math.min(L - o.width / 2, o.t));
    }
    if (TYPES[o.type]?.uniform && (p.key === 'w' || p.key === 'd')) o.w = o.d = v;
    emit('doc');
  };
  let input;
  if (p.kind === 'len' || p.kind === 'num') {
    const isLen = p.kind === 'len', v = get() ?? 0, locked = isDimLocked(o, p.key), lockable = isLen || p.key === 'rot' || p.key === 'angle';
    input = h('div', { class: 'inp' + (locked ? ' locked' : '') },
      h('input', {
        id, type: 'number', disabled: locked || o.locked, step: isLen ? { ft: 0.25, m: 0.05, cm: 1, mm: 10 }[store.doc.units] || 0.05 : p.step || 1,
        value: isLen ? +toUnit(v).toFixed(3) : +(+v).toFixed(2),
        onchange: (e) => {
          let n = parseFloat(e.target.value);
          if (Number.isNaN(n)) return renderProps(true);
          if (isLen) n = fromUnit(n);
          if (p.min !== undefined) n = Math.max(p.min, n);
          if (p.max !== undefined) n = Math.min(p.max, n);
          commit(+n.toFixed(4));
        },
      }),
      h('span', { class: 'u' }, isLen ? unitLabel() : p.label.includes('°') ? '°' : ''),
      lockable ? h('button', { class: 'dlock' + (locked ? ' on' : ''), title: locked ? 'Unlock this dimension' : 'Lock this dimension so nothing can change it',
        onclick: () => { checkpoint(); o.lockDims = { ...(o.lockDims || {}), [p.key]: !locked }; emit('doc'); renderProps(true); } }, locked ? '🔒' : '🔓') : null);
  } else if (p.kind === 'info') {
    const v = get();
    return h('div', { class: 'info-row' + (/⚠/.test(v) ? ' warn' : '') }, h('label', {}, p.label), h('div', {}, v));
  } else if (p.kind === 'text') {
    input = h('div', { class: 'inp' }, h('input', { id, type: 'text', value: get() || '', placeholder: 'auto', disabled: !!o.locked, onchange: (e) => commit(e.target.value.trim()) }));
  } else if (p.kind === 'color') {
    input = h('input', { id, type: 'color', value: get() || '#ffffff', disabled: !!o.locked, onchange: (e) => commit(e.target.value) });
  } else if (p.kind === 'select') {
    const cur = get();
    input = h('select', { id, disabled: !!o.locked, onchange: (e) => commit(typeof cur === 'number' ? +e.target.value : e.target.value) },
      p.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l)));
  } else if (p.kind === 'bool') {
    input = h('label', { class: 'switch' }, h('input', { id, type: 'checkbox', checked: !!get(), disabled: !!o.locked, onchange: (e) => commit(e.target.checked) }), h('span'));
  }
  return h('div', { class: 'row' }, h('label', { for: id }, p.label.replace(' °', '')), input);
}

function renderProps(force = false) {
  const panel = $('#props');
  if (!force && panel.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;
  panel.innerHTML = '';
  panel.append(h('div', { class: 'rtabs' },
    h('button', { class: store.view.rightTab !== 'tree' ? 'on' : '', onclick: () => { store.view.rightTab = 'props'; renderProps(true); } }, 'Properties'),
    h('button', { class: store.view.rightTab === 'tree' ? 'on' : '', onclick: () => { store.view.rightTab = 'tree'; renderProps(true); } }, 'Elements')));
  if (store.view.rightTab === 'tree') return renderTree(panel);
  const o = app.selected();
  if (!o) return renderProject(panel);
  const t = TYPES[o.type];
  const lvlName = store.doc.levels[o.level]?.name || '';
  panel.append(h('div', { class: 'ph' }, h('span', { class: 'pi', html: iconForObj(o) }), h('div', {}, h('h3', {}, labelForObj(o)), h('small', {}, lvlName))));

  const groups = { Label: [], Placement: [], Size: [], Style: [], 'Engineering check': [] };
  for (const p of t.props) {
    if (p.kind === 'text') groups.Label.push(p);
    else if (p.kind === 'info') groups['Engineering check'].push(p);
    else if (['x', 'y', 'rot', 'z', 't', 'x1', 'y1', 'x2', 'y2', 'angle', 'lenAnchor', 'edgeL', 'edgeR', 'offset'].includes(p.key)) groups.Placement.push(p);
    else if (p.kind === 'len' || p.kind === 'num') groups.Size.push(p);
    else groups.Style.push(p);
  }
  for (const [name, ps] of Object.entries(groups)) {
    if (!ps.length) continue;
    panel.append(h('div', { class: 'psec' }, h('h4', {}, name), ps.map((p) => field(o, p))));
  }
  if (TYPES[o.type].kind !== 'opening' && store.doc.levels.length > 1) {
    panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Storey'),
      h('div', { class: 'row' }, h('label', {}, 'On level'),
        h('select', { disabled: !!o.locked, onchange: (e) => { checkpoint(); o.level = +e.target.value; for (const op of openingsOf(o.id)) op.level = o.level; store.level = o.level; emit('doc'); emit('level'); } },
          store.doc.levels.map((l, i) => h('option', { value: i, selected: i === o.level }, l.name))))));
  }
  const acts = [
    h('button', { onclick: duplicateSelected, title: 'Ctrl+D' }, 'Duplicate'),
    h('button', { onclick: () => rotateSelected(90), title: 'R' }, o.type === 'door' ? 'Flip swing' : o.wallId ? null : 'Rotate 90°'),
    h('button', { class: 'danger', onclick: deleteSelected, title: 'Delete' }, 'Delete'),
  ].filter((b) => b.textContent);
  if (o.type === 'guide') {
    acts.unshift(h('button', { onclick: () => wallOnGuide(o, 'exterior'), title: 'Build an exterior wall between the two guide points' }, '🧱 Wall on guide'),
      h('button', { onclick: () => wallOnGuide(o, 'interior') }, 'Interior wall on guide'),
      h('button', { onclick: () => parallelGuide(o), title: 'Copy the guide sideways by an exact distance' }, '∥ Parallel guide…'));
  }
  if (['floor', 'paving', 'flowerbed'].includes(o.type) && !o.locked) {
    if (o.shape !== 'custom') acts.unshift(h('button', { onclick: () => { checkpoint(); o.pts = floorPoly(o).map((p) => [...p]); o.shape = 'custom'; emit('doc'); renderProps(true); toast('Now drag the corners or double-click any side length to type it'); } }, 'Edit every side'));
    else acts.unshift(h('button', { onclick: () => {
      checkpoint();
      let best = 0, bl = 0;
      o.pts.forEach((p, i) => { const q = o.pts[(i + 1) % o.pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
      const p = o.pts[best], q = o.pts[(best + 1) % o.pts.length];
      o.pts.splice(best + 1, 0, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      emit('doc'); renderProps(true); toast('Corner added on the longest side — drag it into place');
    } }, '+ Add corner'));
  }
  panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Actions'), h('div', { class: 'actions' }, acts)));
  panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Arrange'), h('div', { class: 'actions' },
    h('button', { onclick: () => setFlag(o, 'locked', !o.locked), class: o.locked ? 'on' : '' }, o.locked ? '🔒 Locked' : '🔓 Lock'),
    h('button', { onclick: () => setFlag(o, 'hidden', !o.hidden), class: o.hidden ? 'on' : '' }, o.hidden ? '🙈 Hidden' : '👁 Hide'),
    o.wallId ? null : h('button', { onclick: () => arrange(o, 'front'), title: 'Draw above everything else' }, '⤒ Front'),
    o.wallId ? null : h('button', { onclick: () => arrange(o, 'forward') }, '↑ Forward'),
    o.wallId ? null : h('button', { onclick: () => arrange(o, 'backward') }, '↓ Backward'),
    o.wallId ? null : h('button', { onclick: () => arrange(o, 'back'), title: 'Draw below everything else' }, '⤓ Back'))));
  if (o.shape === 'custom' && o.pts) {
    // one editable length per side
    const sec = h('div', { class: 'psec' }, h('h4', {}, 'Side lengths'));
    o.pts.forEach((p, i) => {
      const q = o.pts[(i + 1) % o.pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const key = 'side' + i, locked = isDimLocked(o, key), nextLocked = isDimLocked(o, 'side' + ((i + 1) % o.pts.length));
      sec.append(h('div', { class: 'row' }, h('label', {}, `Side ${String.fromCharCode(65 + (i % 26))}–${String.fromCharCode(65 + ((i + 1) % o.pts.length % 26))}`),
        h('div', { class: 'inp' + (locked ? ' locked' : '') }, h('input', { type: 'number', step: 'any', disabled: locked, value: +toUnit(L).toFixed(3), onchange: (e) => {
          const v = fromUnit(parseFloat(e.target.value));
          if (nextLocked) { toast('The next side is locked, so this corner cannot move', true); renderProps(true); return; }
          if (v > 0.05) { checkpoint(); setSideLength(o, i, v); emit('doc'); }
        } }), h('span', { class: 'u' }, unitLabel()),
        h('button', { class: 'dlock' + (locked ? ' on' : ''), title: locked ? 'Unlock this side' : 'Lock this side length', onclick: () => { checkpoint(); o.lockDims = { ...(o.lockDims || {}), [key]: !locked }; emit('doc'); renderProps(true); } }, locked ? '🔒' : '🔓'))));
    });
    sec.append(h('p', { class: 'note' }, 'Changing a side moves its end corner along the same direction. Drag corners in the plan; double-click a corner to delete it.'));
    panel.append(sec);
  }
}

// ------------------------------------------------------------------ plot & orientation
let plotDraft = null; // the shape being filled in before the plot exists
const BOUNDARY_TYPES = new Set(['boundary', 'fence', 'gate', 'hedge']);
function makePlot(pts) { survey = null; checkpoint(); store.doc.plot = { pts, setbacks: pts.map(() => 0) }; emit('doc'); plan.fit(); renderProps(true); }
function fitPlot(kind) {
  const doc = store.doc, b = kind === 'boundary' ? siteBounds(doc, BOUNDARY_TYPES) : siteBounds(doc);
  if (!b) { toast(kind === 'boundary' ? 'No boundary walls, fences or gates yet' : 'Nothing drawn yet', true); return; }
  const m = kind === 'boundary' ? 0.12 : 1.5;
  makePlot(rect(b.x0 - m, b.y0 - m, b.x1 - b.x0 + 2 * m, b.y1 - b.y0 + 2 * m));
  toast(kind === 'boundary' ? 'Plot fitted to the boundary' : 'Plot fitted around everything with 1.5 m margin');
}
function plotArea(a) {
  const ft = store.doc.units === 'ft';
  return `${ft ? Math.round(a * SQFT) + ' sq ft' : a.toFixed(1) + ' m²'} · ${(a / CENT).toFixed(2)} cents${ft ? '' : ` · ${Math.round(a * SQFT)} sq ft`}`;
}
function renderPlot(panel) {
  const doc = store.doc, p = plotOf(doc), sec = h('div', { class: 'psec' }, h('h4', {}, 'Plot & orientation'));
  panel.append(sec);
  const lenInput = (v, on, title) => h('div', { class: 'inp' }, h('input', { type: 'number', step: 'any', min: 0, value: +toUnit(v).toFixed(3), title, onchange: (e) => { const n = fromUnit(parseFloat(e.target.value)); if (n >= 0) on(n); } }), h('span', { class: 'u' }, unitLabel()));
  // north
  sec.append(h('div', { class: 'row' }, h('label', {}, 'North'), h('div', { class: 'inp' },
    h('input', { type: 'number', step: 5, value: doc.north || 0, title: 'Where true north points, in degrees clockwise from the top of the plan', onchange: (e) => { checkpoint(); doc.north = ((parseFloat(e.target.value) || 0) % 360 + 360) % 360; emit('doc'); view?.setSun(view.sunHour); } }),
    h('span', { class: 'u' }, '°'))),
    h('div', { class: 'chips' }, [['↑ Top', 0], ['→ Right', 90], ['↓ Bottom', 180], ['← Left', 270]].map(([l, v]) => h('button', { class: (doc.north || 0) === v ? 'on' : '', title: `North points to the ${l.slice(2).toLowerCase()} of the plan`, onclick: () => { checkpoint(); doc.north = v; emit('doc'); view?.setSun(view.sunHour); renderProps(true); } }, l))),
    h('p', { class: 'note' }, 'North sets the sun path in 3D, the compass and which way each side faces. Click the compass on the plan to turn the view north-up.'));
  if (!p) {
    const ft = store.doc.units === 'ft', f = (m, feet) => (ft ? feet * 0.3048 : m);
    const v = (plotDraft ??= { kind: 'rect', w: f(10, 30), d: f(15, 40), w2: f(8, 25), side: f(15, 40), angle: 75 });
    const row = (label, el) => h('div', { class: 'row' }, h('label', {}, label), el);
    const shapes = [['rect', '▭ Rectangle'], ['skew', '▱ Skewed'], ['trapezoid', '⏢ Trapezoid']];
    sec.append(h('p', { class: 'note' }, doc.plotNote ? `Plot note: ${doc.plotNote}` : 'No plot yet. Choose its shape and size, or fit it to what you have drawn. Every side and angle can be fine-tuned afterwards.'),
      h('div', { class: 'chips' }, shapes.map(([k, l]) => h('button', { class: v.kind === k ? 'on' : '', onclick: () => { v.kind = k; renderProps(true); } }, l))),
      row(v.kind === 'rect' ? 'Width' : 'Front width', lenInput(v.w, (n) => (v.w = n), 'Front side')),
      v.kind === 'rect' ? row('Depth', lenInput(v.d, (n) => (v.d = n), 'Plot depth')) : null,
      v.kind === 'trapezoid' ? row('Back width', lenInput(v.w2, (n) => (v.w2 = n), 'Back side')) : null,
      v.kind === 'trapezoid' ? row('Depth', lenInput(v.d, (n) => (v.d = n), 'Distance front to back')) : null,
      v.kind === 'skew' ? row('Side length', lenInput(v.side, (n) => (v.side = n), 'Length of the slanting sides')) : null,
      v.kind === 'skew' ? row('Front-left angle', h('div', { class: 'inp' }, h('input', { type: 'number', step: 1, min: 20, max: 160, value: v.angle, title: 'Inside angle at the front-left corner (90° = rectangle; less leans right, more leans left)', onchange: (e) => { const a = parseFloat(e.target.value); if (a > 10 && a < 170) v.angle = a; } }), h('span', { class: 'u' }, '°'))) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => {
          const pts = shapePlot(v.kind, v), b = siteBounds(doc);
          const px = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2, py = (Math.min(...pts.map((q) => q[1])) + Math.max(...pts.map((q) => q[1]))) / 2;
          const cx = b ? (b.x0 + b.x1) / 2 : px, cy = b ? (b.y0 + b.y1) / 2 : py;
          makePlot(pts.map(([x, y]) => [+(x - px + cx).toFixed(4), +(y - py + cy).toFixed(4)]));
          plotDraft = null;
        } }, 'Set plot'),
        h('button', { onclick: () => fitPlot('boundary') }, 'Fit to boundary walls'),
        h('button', { onclick: () => fitPlot('all') }, 'Fit around everything')));
    return;
  }
  const n = p.pts.length, st = plotStats(doc, p);
  const stat = (k, v, warn) => h('div', { class: 'stat' + (warn ? ' warn' : '') }, h('span', {}, k), h('b', {}, v));
  sec.append(stat('Plot area', plotArea(st.area)));
  // one card per side: length, bearing (line angle) and setback, plus the corner angle where it starts
  const north = doc.north || 0, L = (i) => String.fromCharCode(65 + (i % n));
  const degInput = (v, on, title, locked) => h('div', { class: 'inp' + (locked ? ' locked' : '') }, h('input', { type: 'number', step: 0.5, value: +v.toFixed(1), title, disabled: !!locked, onchange: (e) => { const d = parseFloat(e.target.value); if (Number.isFinite(d)) on(d); } }), h('span', { class: 'u' }, '°'));
  const lenIn = (v, on, title, locked) => { const el = lenInput(v, on, title); if (locked) { el.classList.add('locked'); el.querySelector('input').disabled = true; } return el; };
  // refuse an edit that would move a locked side; otherwise apply it
  const tryEdit = (what, i, fn) => { const why = plotEditBlock(p, what, i); if (why) { toast(why, true); renderProps(true); return; } checkpoint(); fn(); emit('doc'); renderProps(true); };
  const lockBtn = (key, label) => { const on = !!p.lockDims?.[key]; return h('button', { class: 'dlock' + (on ? ' on' : ''), disabled: !!p.locked, title: `${on ? 'Unlock' : 'Lock'} this ${label}`, onclick: () => { checkpoint(); p.lockDims = { ...(p.lockDims || {}), [key]: !on }; emit('doc'); renderProps(true); } }, on ? '🔒' : '🔓'); };
  const sides = h('div', { class: 'plot-sides' });
  for (let i = 0; i < n; i++) {
    const name = `${L(i)}–${L(i + 1)}`;
    sides.append(h('div', { class: 'ps-card' },
      h('div', { class: 'ps-t' }, h('b', {}, `Side ${name}`), h('small', {}, `faces ${sideFacing(p.pts, i, north)}`)),
      h('div', { class: 'ps-grid' },
        h('label', {}, h('span', { class: 'ps-l' }, 'Length', lockBtn('len' + i, 'length')), lenIn(sideLen(p.pts, i), (v) => { if (v > 0.1) tryEdit('len', i, () => setSide(p, i, v)); }, `Length of side ${name}`, p.locked || p.lockDims?.['len' + i])),
        h('label', {}, h('span', { class: 'ps-l' }, 'Bearing', lockBtn('brg' + i, 'bearing')), degInput(sideBearing(p.pts, i, north), (d) => tryEdit('brg', i, () => setSideBearing(p, i, ((d % 360) + 360) % 360, north)), `Direction of ${name} from ${L(i)}, degrees clockwise from north (90° = east). Corner ${L(i + 1)} moves.`, p.locked || p.lockDims?.['brg' + i])),
        h('label', {}, `Angle at ${L(i)}`, degInput(cornerAngle(p.pts, i), (d) => { if (d > 5 && d < 355) tryEdit('brg', i, () => setCornerAngle(p, i, d, north)); }, `Inside angle at corner ${L(i)}; side ${name} turns and corner ${L(i + 1)} moves`, p.locked || p.lockDims?.['brg' + i])),
        h('label', {}, 'Setback', lenIn(p.setbacks[i] || 0, (v) => { checkpoint(); p.setbacks[i] = v; emit('doc'); }, `Building setback from side ${name}`, p.locked)))));
  }
  const gap = Math.hypot(p.pts[0][0] - p.pts[n - 1][0], p.pts[0][1] - p.pts[n - 1][1]);
  if (n === 4) sec.append(surveyBox(p));
  sec.append(divideBox(p));
  // the setback line: a straight buildable rectangle (default) or parallel to every side
  const sb = setbackPoly(p), rectMode = p.setbackMode !== 'follow';
  const sbBox = h('div', { class: 'psec-in' },
    h('div', { class: 'row' }, h('label', {}, 'Setback line'), h('select', { disabled: !!p.locked, onchange: (e) => { checkpoint(); p.setbackMode = e.target.value; emit('doc'); renderProps(true); } },
      [['rect', 'Straight rectangle'], ['follow', 'Follow plot sides']].map(([v, t]) => h('option', { value: v, selected: (rectMode ? 'rect' : 'follow') === v }, t)))),
    rectMode ? h('div', { class: 'row' }, h('label', {}, 'Square to side'), h('select', { disabled: !!p.locked, onchange: (e) => { checkpoint(); p.setbackAlign = +e.target.value; emit('doc'); renderProps(true); } },
      p.pts.map((_, i) => h('option', { value: i, selected: alignSide(p) === i }, `${L(i)}–${L(i + 1)}`)))) : null,
    sb && rectMode ? h('div', { class: 'stat' }, h('span', {}, 'Buildable rectangle'), h('b', {}, `${fmtLen(Math.hypot(sb[1][0] - sb[0][0], sb[1][1] - sb[0][1]))} × ${fmtLen(Math.hypot(sb[2][0] - sb[1][0], sb[2][1] - sb[1][1]))}`)) : null,
    !sb ? h('p', { class: 'note' }, 'Add a setback to any side to see the buildable area.') : null);
  sec.append(sides,
    sbBox,
    h('p', { class: 'note' }, `Length and bearing move the side's end corner; the last side ${L(n - 1)}–A always closes the plot (now ${fmtLen(gap)}). Bearings are compass directions from the first corner: 0° north, 90° east, 180° south, 270° west.`),
    stat('Ground coverage', `${(st.coverage * 100).toFixed(1)} %`, st.coverage > 0.65),
    stat('Floor area ratio (FAR)', st.far.toFixed(2)),
    ...[st.insideSetback ? stat('Setback', `${st.insideSetback} wall${st.insideSetback > 1 ? 's' : ''} inside the setback`, true) : null,
      st.offPlot ? stat('Outside plot', `${st.offPlot} wall${st.offPlot > 1 ? 's' : ''} cross the boundary`, true) : null].filter(Boolean),
    h('div', { class: 'actions' },
      h('button', { class: p.locked ? 'on' : '', title: 'Lock every side, angle and corner of the plot', onclick: () => { checkpoint(); p.locked = !p.locked; if (p.locked) p.edit = false; emit('doc'); renderProps(true); toast(p.locked ? 'Plot locked — no side, angle or corner can change' : 'Plot unlocked'); } }, p.locked ? '🔒 Plot locked' : '🔓 Lock plot'),
      h('button', { class: p.edit ? 'on' : '', disabled: !!p.locked, title: 'Drag the plot corners in the plan', onclick: () => { p.edit = !p.edit; emit('doc'); renderProps(true); toast(p.edit ? 'Drag the green corners in the plan' : 'Plot corners locked'); } }, p.edit ? '✓ Editing corners' : 'Edit corners in plan'),
      h('button', { disabled: !!p.locked, title: 'Split the longest side so you can make an irregular plot', onclick: () => {
        checkpoint(); let best = 0; for (let i = 1; i < n; i++) if (sideLen(p.pts, i) > sideLen(p.pts, best)) best = i;
        const a = p.pts[best], b = p.pts[(best + 1) % n]; p.pts.splice(best + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); p.setbacks.splice(best + 1, 0, p.setbacks[best]); p.edit = true; emit('doc'); renderProps(true);
      } }, '+ Corner'),
      n > 3 ? h('button', { disabled: !!p.locked, title: 'Remove the last corner', onclick: () => { checkpoint(); p.pts.pop(); p.setbacks.pop(); emit('doc'); renderProps(true); } }, '− Corner') : null,
      h('button', { title: 'Typical Kerala (KMBR) setbacks: 3 m front, 1.5 m rear, 1.2 m and 1 m sides', onclick: () => {
        checkpoint();
        const mids = p.pts.map((a, i) => (a[1] + p.pts[(i + 1) % n][1]) / 2), front = mids.indexOf(Math.max(...mids)), rear = mids.indexOf(Math.min(...mids));
        p.setbacks = p.pts.map((_, i) => (i === front ? 3 : i === rear ? 1.5 : 1.2));
        emit('doc'); renderProps(true); toast('Setbacks: front 3 m (the side nearest the bottom of the plan), rear 1.5 m, sides 1.2 m — check your local rules');
      } }, 'Typical setbacks'),
      h('button', { disabled: !!p.locked, onclick: () => fitPlot('boundary') }, 'Fit to boundary'),
      h('button', { disabled: !!p.locked, title: 'Start the plot again as a rectangle, skewed plot or trapezoid', onclick: () => { if (!confirm('Replace this plot with a new shape?')) return; checkpoint(); delete doc.plot; emit('doc'); renderProps(true); } }, 'New shape…'),
      h('button', { class: 'danger', disabled: !!p.locked, onclick: () => { checkpoint(); delete doc.plot; emit('doc'); renderProps(true); } }, 'Remove plot')));
}

// Divide the plot into equal parts (family partition, two houses on one plot …): areas plus the cut lines.
const division = { n: 2, side: null, open: false };
function divideBox(p) {
  const n = p.pts.length, L = (i) => String.fromCharCode(65 + (i % n)), side = division.side ?? alignSide(p);
  const COLORS = ['#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#db2777', '#ca8a04'];
  const has = store.doc.objects.some((o) => o.division);
  const run = () => {
    const { parts, lines } = dividePlot(p, division.n, side);
    checkpoint();
    store.doc.objects = store.doc.objects.filter((o) => !o.division);
    parts.forEach((pts, i) => store.doc.objects.push({ id: uid(), type: 'area', level: 0, division: true, label: `Part ${i + 1} of ${division.n}`, color: COLORS[i % COLORS.length], pts: pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]) }));
    for (const [a, b] of lines) store.doc.objects.push({ id: uid(), type: 'dimension', level: 0, division: true, x1: a[0], y1: a[1], x2: b[0], y2: b[1], offset: 0, color: '#b91c1c' });
    emit('doc'); renderProps(true);
    const each = polyArea(parts[0]);
    toast(`Divided into ${division.n} equal parts of ${(each / CENT).toFixed(3)} cents (${each.toFixed(2)} m²) each`);
  };
  return h('details', { class: 'survey', open: division.open, ontoggle: (e) => { division.open = e.target.open; } },
    h('summary', {}, '✂ Divide into equal parts'),
    h('p', { class: 'note' }, 'For a family partition or two houses on one plot: every part gets exactly the same area, with straight cuts you can set out on site.'),
    h('div', { class: 'row' }, h('label', {}, 'Parts'), h('select', { onchange: (e) => { division.n = +e.target.value; } }, [2, 3, 4, 5, 6].map((k) => h('option', { value: k, selected: division.n === k }, k === 2 ? '2 (halves)' : String(k))))),
    h('div', { class: 'row' }, h('label', {}, 'Cuts parallel to'), h('select', { onchange: (e) => { division.side = +e.target.value; } }, p.pts.map((_, i) => h('option', { value: i, selected: side === i }, `${L(i)}–${L(i + 1)}`)))),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: run }, has ? 'Divide again' : 'Divide plot'),
      has ? h('button', { onclick: () => { checkpoint(); store.doc.objects = store.doc.objects.filter((o) => !o.division); emit('doc'); renderProps(true); } }, 'Remove division') : null));
}

// Rebuild a four-sided plot from survey measurements: four lengths, which side is straight and which way it runs,
// and one more measurement (an inside angle or a diagonal) — that fixes the shape exactly.
let survey = null;
function surveyBox(p) {
  const doc = store.doc, north = ((doc.north || 0) * Math.PI) / 180, L = (i) => String.fromCharCode(65 + (i % 4)), side = (i) => `${L(i)}–${L(i + 1)}`;
  if (survey && survey.plot !== p) survey = null; // another plot, or undo: start from what is there
  const s = (survey ??= { plot: p, lens: p.pts.map((_, i) => sideLen(p.pts, i)), base: 0, runs: 'ew', known: 'angle1', deg: cornerAngle(p.pts, 1), diag: Math.hypot(p.pts[2][0] - p.pts[0][0], p.pts[2][1] - p.pts[0][1]) });
  const sel = (val, opts, on) => h('select', { onchange: (e) => { on(e.target.value); renderProps(true); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));
  const len = (v, on) => h('div', { class: 'inp' }, h('input', { type: 'number', step: 'any', min: 0, value: +toUnit(v).toFixed(3), onchange: (e) => { const x = fromUnit(parseFloat(e.target.value)); if (x > 0) on(x); } }), h('span', { class: 'u' }, unitLabel()));
  const row = (label, el) => h('div', { class: 'row' }, h('label', {}, label), el);
  const isAngle = s.known.startsWith('angle'), k = +s.known.slice(-1);
  const apply = () => {
    if (p.locked) { toast('The plot is locked — unlock it first', true); return; }
    const cur = unit2(p.pts[(s.base + 1) % 4], p.pts[s.base]);
    let dir = s.runs === 'ew' ? [Math.cos(north), Math.sin(north)] : s.runs === 'ns' ? [Math.sin(north), -Math.cos(north)] : cur;
    if (dir[0] * cur[0] + dir[1] * cur[1] < 0) dir = [-dir[0], -dir[1]]; // keep the side running the same way round
    const pts = solveQuad(s.lens, s.base, dir, isAngle ? { kind: 'angle', corner: k, deg: s.deg } : { kind: 'diag', from: k, len: s.diag }, p.pts);
    if (!pts) { toast("Those measurements don't close into a plot — check the lengths and the angle or diagonal", true); return; }
    const c0 = centroid(p.pts), c1 = centroid(pts);
    checkpoint();
    p.pts = pts.map(([x, y]) => [+(x - c1[0] + c0[0]).toFixed(4), +(y - c1[1] + c0[1]).toFixed(4)]);
    emit('doc'); plan.fit(); renderProps(true);
    toast(`Plot rebuilt: ${side(s.base)} runs ${s.runs === 'ew' ? 'east–west' : s.runs === 'ns' ? 'north–south' : 'as before'}, every side as measured`);
  };
  return h('details', { class: 'survey', open: !!s.open, ontoggle: (e) => { s.open = e.target.open; } },
    h('summary', {}, '📐 Rebuild from measurements'),
    h('p', { class: 'note' }, 'Type the four sides from your survey sketch, say which side is straight, and add one more measurement. The plot is rebuilt exactly; the other sides lean as they must.'),
    ...[0, 1, 2, 3].map((i) => row(`Side ${side(i)}`, len(s.lens[i], (v) => (s.lens[i] = v)))),
    row('Straight side', sel(s.base, [0, 1, 2, 3].map((i) => [i, `${side(i)} (faces ${sideFacing(p.pts, i, doc.north || 0)})`]), (v) => { s.base = +v; })),
    row('It runs', sel(s.runs, [['ew', 'East – west'], ['ns', 'North – south'], ['keep', 'As it is now']], (v) => { s.runs = v; })),
    row('Also known', sel(s.known, [...[0, 1, 2, 3].map((i) => [`angle${i}`, `Angle at ${L(i)}`]), ['diag0', 'Diagonal A–C'], ['diag1', 'Diagonal B–D']], (v) => { s.known = v; })),
    isAngle ? row(`Angle at ${L(k)}`, h('div', { class: 'inp' }, h('input', { type: 'number', step: 0.5, value: +s.deg.toFixed(1), onchange: (e) => { const d = parseFloat(e.target.value); if (d > 5 && d < 355) s.deg = d; } }), h('span', { class: 'u' }, '°')))
      : row(`Diagonal ${L(k)}–${L(k + 2)}`, len(s.diag, (v) => (s.diag = v))),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: apply }, 'Rebuild plot'),
      h('button', { onclick: () => { survey = null; renderProps(true); } }, 'Reset to current')));
}
const unit2 = (b, a) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
const centroid = (pts) => [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];

// 2D view direction: plan-up, or a compass direction up the screen
function syncViewDir() {
  const sel = $('#view-dir'); if (!sel) return;
  const n = store.doc.north || 0, up = Math.round(plan.upBearing) % 360, opts = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };
  sel.value = Math.abs(plan.vr) < 1e-6 ? 'plan' : opts[up] || 'custom';
  void n;
}
function setViewDir(v) {
  const n = ((store.doc.north || 0) * Math.PI) / 180, bearing = { north: 0, east: 90, south: 180, west: 270 }[v];
  plan.setRotation(v === 'plan' ? 0 : -n - (bearing * Math.PI) / 180);
  syncViewDir();
}

// New project: name and plot size first
function openNewProject() {
  const u = store.doc.units || 'm', ft = u === 'ft';
  const presets = [['5 cents · 14 × 14.5 m', 14, 14.45], ['10 cents · 18 × 22.5 m', 18, 22.48], ['30 × 40 ft', 9.144, 12.192], ['40 × 60 ft', 12.192, 18.288], ['50 × 80 ft', 15.24, 24.384], ['20 × 30 m', 20, 30]];
  const name = h('input', { type: 'text', value: 'My home', style: 'width:100%' });
  const W = h('input', { type: 'number', step: 'any', value: ft ? 30 : 15, style: 'width:100%' }), D = h('input', { type: 'number', step: 'any', value: ft ? 40 : 25, style: 'width:100%' });
  const units = h('select', { style: 'width:100%' }, [['m', 'Metres'], ['ft', 'Feet']].map(([v, l]) => h('option', { value: v, selected: (ft ? 'ft' : 'm') === v }, l)));
  const area = h('p', { class: 'note' });
  const k = () => (units.value === 'ft' ? 0.3048 : 1);
  const upd = () => { const a = (parseFloat(W.value) || 0) * (parseFloat(D.value) || 0) * k() * k(); area.textContent = `Plot area ${a.toFixed(1)} m² · ${(a / CENT).toFixed(2)} cents · ${Math.round(a * SQFT)} sq ft`; };
  W.oninput = D.oninput = upd; units.onchange = () => { const f = units.value === 'ft' ? 1 / 0.3048 : 0.3048; W.value = +(W.value * f).toFixed(2); D.value = +(D.value * f).toFixed(2); upd(); };
  const field = (l, el) => h('label', { style: 'display:block;margin:10px 0' }, h('span', { style: 'display:block;font-weight:600;margin-bottom:4px' }, l), el);
  const create = (withPlot) => {
    if (store.doc.objects.length && !confirm('Start a new project? Unsaved changes will be lost (Save first if needed).')) return;
    const doc = newDoc(); doc.name = name.value.trim() || 'My home'; doc.units = units.value;
    if (withPlot) { const w = parseFloat(W.value) * k(), d = parseFloat(D.value) * k(); if (w > 0 && d > 0) doc.plot = { pts: rect(0, 0, w, d), setbacks: [0, 0, 0, 0] }; }
    setDoc(doc); closeModal(); plan.userMoved = false; plan.fit(); view?.frame();
    toast(withPlot ? 'New project with your plot — set setbacks and north in the panel on the right' : 'New empty project');
  };
  openModal(h('div', { class: 'modal-h' }, h('h2', {}, 'New project'), h('button', { class: 'x', onclick: closeModal }, '✕')),
    h('div', { style: 'max-width:440px' },
      field('Project name', name),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px' }, field('Plot width (front)', W), field('Plot depth', D), field('Units', units)), area,
      h('div', { class: 'chips' }, presets.map(([l, w, d]) => h('button', { onclick: () => { const f = units.value === 'ft' ? 1 / 0.3048 : 1; W.value = +(w * f).toFixed(2); D.value = +(d * f).toFixed(2); upd(); } }, l))),
      h('p', { class: 'note' }, 'You can change every side afterwards, make the plot irregular, and set setbacks and north in the Plot & orientation panel.'),
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px' }, h('button', { onclick: () => create(false) }, 'Skip plot'), h('button', { class: 'primary', onclick: () => create(true) }, 'Create project'))));
  upd(); name.focus(); name.select();
}

function renderProject(panel) {
  const doc = store.doc;
  panel.append(h('div', { class: 'welcome' }, h('h2', {}, doc.name || 'My Home'),
    h('p', {}, 'Pick items on the left and place them in the 2D plan or 3D view. Select anything to edit its exact dimensions here.')));

  const lv = h('div', { class: 'psec' }, h('h4', {}, 'Storeys'));
  doc.levels.forEach((l, i) => {
    lv.append(h('div', { class: 'lvl' + (i === store.level ? ' cur' : '') },
      h('input', { value: l.name, title: 'Name', 'data-lvl': i, onfocus: () => { if (store.level !== i) { store.level = i; emit('level'); requestAnimationFrame(() => { const f = $(`#props input[data-lvl="${i}"]`); f?.focus(); f?.select(); }); } }, onchange: (e) => { checkpoint(); l.name = e.target.value; emit('doc'); emit('level'); } }),
      h('input', { type: 'number', step: 0.1, min: 2, value: +toUnit(l.height).toFixed(2), title: `Storey height (${unitLabel()})`, onchange: (e) => setLevelHeight(i, fromUnit(parseFloat(e.target.value))) }),
      i === doc.levels.length - 1 && i > 0 ? h('button', { class: 'danger', title: 'Remove this storey', onclick: () => removeLevel(i) }, '✕') : h('span')));
  });
  lv.append(h('button', { onclick: addLevel, style: 'width:100%' }, '+ Add storey'));
  const projField = (label, input) => h('div', { class: 'row' }, h('label', {}, label), input);
  panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Project'),
    projField('Name', h('div', { class: 'inp' }, h('input', { value: doc.name || '', onchange: (e) => { checkpoint(); doc.name = e.target.value; emit('doc'); } }))),
    projField('Client / owner', h('div', { class: 'inp' }, h('input', { value: doc.client || '', placeholder: 'for the title block', onchange: (e) => { checkpoint(); doc.client = e.target.value; emit('doc'); } }))),
    projField('Site / location', h('div', { class: 'inp' }, h('input', { value: doc.site || '', placeholder: 'e.g. Kochi, Kerala', onchange: (e) => { checkpoint(); doc.site = e.target.value; emit('doc'); } })))), lv);
  renderPlot(panel);
  panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Raise house above ground (plinth)'),
    projField(`Plinth height (${unitLabel()})`, h('div', { class: 'inp' }, h('input', { type: 'number', step: { ft: 0.25, m: 0.05, cm: 5, mm: 50 }[doc.units] || 0.05, min: 0, value: +toUnit(doc.plinth || 0).toFixed(3),
      onchange: (e) => { const v = fromUnit(parseFloat(e.target.value)); if (v >= 0 && v < 20) { checkpoint(); doc.plinth = v; emit('doc'); } } }))),
    projField('Plinth finish', h('select', { onchange: (e) => { checkpoint(); doc.plinthFinish = e.target.value; emit('doc'); } },
      [['stone', 'Rubble stone'], ['laterite', 'Laterite'], ['brick', 'Brick'], ['plaster', 'Plastered'], ['concrete', 'Concrete']].map(([v, l]) => h('option', { value: v, selected: (doc.plinthFinish || 'stone') === v }, l)))),
    h('p', { class: 'note' }, 'Typical plinth: 0.45–0.60 m (flood-prone areas 0.9 m+). The whole house sits on it; gates, garden and paving stay at ground level and the portico gets steps automatically.')));

  const objs = doc.objects.filter((o) => o.level === store.level);
  const walls = objs.filter((o) => o.type === 'wall');
  const floorArea = objs.filter((o) => o.type === 'floor' && !o.z).reduce((s, o) => s + polyArea(floorPoly(o)), 0);
  const area = (a) => fmtArea(a);
  const b = exteriorBounds(store.level);
  const st = (k, v) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, v));
  panel.append(h('div', { class: 'psec' }, h('h4', {}, `${doc.levels[store.level].name} summary`),
    b ? st('Footprint', `${fmtLen(b.x1 - b.x0)} × ${fmtLen(b.y1 - b.y0)}`) : null,
    st('Built-up area', b ? area((b.x1 - b.x0) * (b.y1 - b.y0)) : '—'),
    st('Floor area', floorArea ? area(floorArea) : '—'),
    st('Walls', `${walls.length} · ${fmtLen(walls.reduce((s, w) => s + wallLen(w), 0))}`),
    st('Doors', objs.filter((o) => o.type === 'door').length),
    st('Windows', objs.filter((o) => o.type === 'window').length)));

  const keys = [['V', 'Select'], ['W / I', 'Exterior / interior wall'], ['E', 'Room'], ['M', 'Measure'], ['D', 'Dimension line'], ['G', 'Guide line'], ['C', '3D camera'], ['Enter', 'Take a snap (camera open)'], ['Dbl-click', 'Type an exact dimension'], ['P', 'Spectate tour'], ['R', 'Rotate 90°'], ['Del', 'Delete'],
    ['Ctrl D', 'Duplicate'], ['Ctrl Z / Y', 'Undo / redo'], ['Arrows', 'Nudge (Shift ×10)'], ['F', 'Fit plan'], ['1 2 3', '2D / split / 3D'], ['Shift', 'Bypass snapping'], ['Space+drag', 'Pan']];
  panel.append(h('div', { class: 'psec' }, h('h4', {}, 'Shortcuts'), h('div', { class: 'keys' }, keys.flatMap(([k, v]) => [h('kbd', {}, k), h('span', {}, v)]))));
}

// ------------------------------------------------------------------ levels
function refreshLevels() {
  const sel = $('#level-select');
  sel.innerHTML = '';
  store.doc.levels.forEach((l, i) => sel.append(h('option', { value: i, selected: i === store.level }, l.name)));
  $('#tag-2d').textContent = `2D Plan · ${store.doc.levels[store.level]?.name || ''}`;
}
function addLevel() {
  checkpoint();
  const doc = store.doc, below = doc.levels.length - 1, idx = doc.levels.length;
  doc.levels.push({ name: idx === 1 ? 'First Floor' : `Floor ${idx}`, height: doc.levels[below].height });
  const ext = doc.objects.filter((o) => o.level === below && o.type === 'wall' && o.kind !== 'interior');
  for (const w of ext) {
    const nw = { ...structuredClone(w), id: uid(), level: idx, height: doc.levels[idx].height };
    doc.objects.push(nw);
    for (const op of openingsOf(w.id)) if (op.type === 'window') doc.objects.push({ ...structuredClone(op), id: uid(), level: idx, wallId: nw.id });
  }
  const floors = doc.objects.filter((o) => o.level === below && o.type === 'floor').sort((a, b) => b.w * b.d - a.w * a.d);
  if (floors[0]) doc.objects.push({ ...structuredClone(floors[0]), id: uid(), level: idx, z: 0, finish: 'wood', color: '#ffffff' });
  for (const r of doc.objects.filter((o) => o.level === below && o.type === 'roof')) r.level = idx;
  store.level = idx;
  emit('doc'); emit('level');
  toast(ext.length ? 'Storey added — outer walls, windows and floor copied from below. Add stairs on the floor below to connect.' : 'Storey added');
}
function removeLevel(i) {
  if (!confirm(`Remove "${store.doc.levels[i].name}" and everything on it?`)) return;
  checkpoint();
  const doc = store.doc;
  for (const r of doc.objects.filter((o) => o.level === i && o.type === 'roof')) r.level = i - 1;
  doc.objects = doc.objects.filter((o) => o.level !== i);
  doc.levels.splice(i, 1);
  store.level = Math.min(store.level, doc.levels.length - 1);
  store.selectedId = null;
  emit('doc'); emit('level'); emit('selection');
}
function setLevelHeight(i, hgt) {
  if (!(hgt > 1.5)) return;
  checkpoint();
  const old = store.doc.levels[i].height;
  store.doc.levels[i].height = hgt;
  for (const o of store.doc.objects) {
    if (o.level !== i) continue;
    if (o.type === 'wall' && Math.abs(o.height - old) < 0.01) o.height = hgt;
    if ((o.type === 'stairs' || o.type === 'spiral') && Math.abs(o.h - old) < 0.01) o.h = hgt;
    if (o.type === 'roof' && Math.abs(o.z - old) < 0.01) o.z = hgt;
  }
  emit('doc');
}

// ------------------------------------------------------------------ misc UI
function toast(msg, warn = false) {
  const t = h('div', { class: 'toast' + (warn ? ' warn' : '') }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2600);
}
function download(name, href) {
  const a = h('a', { href, download: name });
  document.body.append(a); a.click(); a.remove();
}
const fileName = (ext) => `${(store.doc.name || 'home').replace(/[^\w-]+/g, '_')}.${ext}`;
function setView(mode) {
  store.view.mode = mode;
  $('#stage').className = `stage mode-${mode}`;
  $$('#view-seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === mode));
}
function syncToggles() {
  store.view.guides ??= true;
  $$('[data-toggle]').forEach((b) => b.classList.toggle('on', !!store.view[b.dataset.toggle]));
  $('#units-select').value = store.doc.units;
  $('#btn-pro').classList.toggle('on', !!store.view.pro);
  if (!$('#dim-pop').hidden) toggleDimSettings(true);
}
function updateStatus() {
  const n = store.doc.objects.length;
  $('#status-count').textContent = `${n} object${n === 1 ? '' : 's'}`;
  $('#status-saved').textContent = 'Autosaved ✓';
}

// ------------------------------------------------------------------ wiring
function wire() {
  $('#btn-new').onclick = openNewProject;
  $('#view-dir').onchange = (e) => setViewDir(e.target.value);
  $('#btn-designs').onclick = openDesigns;
  $('#btn-pro').onclick = () => { store.view.pro = !store.view.pro; syncToggles(); plan.redraw(); toast(store.view.pro ? 'Engineer mode: tags, opening chains and engineering checks shown' : 'Simple mode'); };
  $('#units-select').onchange = (e) => { checkpoint(); store.doc.units = e.target.value; store.doc.dims = { ...(store.doc.dims || {}), precision: null }; emit('doc'); syncToggles(); renderProps(true); };
  $$('#scope-seg button').forEach((b) => (b.onclick = () => setScope(b.dataset.scope)));
  $('#elev-select').onchange = (e) => view?.setElevation(e.target.value || null);
  $('#btn-tour').onclick = startTour;
  $('#ph-exit').onclick = () => view?.player?.stop();
  $('#ph-auto').onclick = startAutoTour;
  $('#ph-physics').onclick = () => { const p = $('#ph-physics-panel'); p.hidden = !p.hidden; };
  $('#btn-pdf').onclick = exportPdf;
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('#btn-open').onclick = () => $('#file-input').click();
  $('#file-input').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const doc = JSON.parse(await f.text());
      if (!Array.isArray(doc.objects) || !Array.isArray(doc.levels)) throw new Error('bad file');
      setDoc(doc); plan.fit(); view?.frame();
      toast(`Opened ${f.name}`);
    } catch { toast('That file is not a HomeCraft project', true); }
    e.target.value = '';
  };
  $('#btn-save').onclick = saveFile;
  $('#btn-undo').onclick = () => undo();
  $('#btn-redo').onclick = () => redo();
  $('#level-select').onchange = (e) => { store.level = +e.target.value; store.selectedId = null; emit('level'); emit('selection'); };
  $('#btn-add-level').onclick = addLevel;
  $$('#view-seg button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $$('.tool').forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  $$('[data-toggle]').forEach((b) => (b.onclick = () => { const k = b.dataset.toggle; store.view[k] = !store.view[k]; syncToggles(); plan.redraw(); view?.markDirty(); }));
  $('#tools-2d').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'rot-l') { plan.setRotation(plan.vr - Math.PI / 2); syncViewDir(); }
    if (a === 'rot-r') { plan.setRotation(plan.vr + Math.PI / 2); syncViewDir(); }
    if (a === 'zoom-in') plan.zoomBy(1.25);
    if (a === 'zoom-out') plan.zoomBy(0.8);
    if (a === 'fit') plan.fit();
    if (a === 'png') download(fileName('plan.png'), plan.c.toDataURL('image/png'));
    if (a === 'dimset') toggleDimSettings();
  });
  $('#tools-3d').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!view || !a) return;
    if (['walk', 'frame', 'top'].includes(a) && view.elev) { view.setElevation(null); }
    if (a === 'walk') view.setWalk(!view.walk);
    if (a === 'frame') { view.setWalk(false); view.frame(); }
    if (a === 'top') view.topView();
    if (a === 'camera') toggleCamera();
    if (a === 'full') toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === $('#pane-3d');
    // only the 3D pane is on screen in full screen, so messages and dialogs move into it
    for (const el of [$('#toasts'), $('#modal')]) (on ? $('#pane-3d') : document.body).append(el);
    $('[data-act=full]').classList.toggle('on', on);
    $('[data-act=full]').textContent = on ? '⛶ Exit full screen' : '⛶ Full screen';
  });
  $('#sun').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('#sun-val').textContent = `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`;
    view?.setSun(v);
  });
  $('#props').addEventListener('focusout', () => setTimeout(() => { if (!$('#props').contains(document.activeElement)) renderProps(); }, 0));

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', (e) => { if (e.key === ' ') plan.space = false; });

  on((kind) => {
    if (kind === 'doc') { plan.redraw(); view?.markDirty(); renderProps(); updateStatus(); refreshLevels(); }
    if (kind === 'selection') { plan.redraw(); view?.updateSelection(); renderProps(true); }
    if (kind === 'level') { refreshLevels(); plan.redraw(); view?.markDirty(); renderProps(true); }
  });
}

// ------------------------------------------------------------------ workspaces, dimension settings, modal
function setScope(scope) {
  store.view.scope = scope;
  $$('#scope-seg button').forEach((b) => b.classList.toggle('on', b.dataset.scope === scope));
  $$('.cat').forEach((s) => { const sc = s.dataset.scope; s.classList.toggle('scope-hidden', scope !== 'all' && sc !== 'both' && sc !== scope); });
  const sel = app.selected();
  if (sel && scope !== 'all' && !inScope(sel, scope)) app.select(null);
  plan.redraw(); view?.markDirty();
  if (scope !== 'all') toast(scope === 'indoor' ? 'Indoor: roof hidden, garden & site locked' : 'Outdoor: house interior locked');
}

function toggleDimSettings(force) {
  const pop = $('#dim-pop');
  if (force === false || (!pop.hidden && force !== true)) { pop.hidden = true; return; }
  const D = dims(), doc = store.doc;
  const set = (k, v) => { checkpoint(); doc.dims = { ...(doc.dims || {}), [k]: v }; emit('doc'); };
  const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!D[k], onchange: (e) => set(k, e.target.checked) }), label);
  const ft = doc.units === 'ft';
  const precOpts = ft ? [[1, 'Nearest inch'], [2, '½ inch'], [4, '¼ inch'], [8, '⅛ inch'], [16, '1/16 inch']]
    : [[null, 'Default'], [0, '0 decimals'], [1, '1 decimal'], [2, '2 decimals'], [3, '3 decimals']];
  const snapOpts = ft ? [[null, '3 in (default)'], [0.0254, '1 in'], [0.0762, '3 in'], [0.1524, '6 in'], [0.3048, '1 ft']]
    : [[null, '10 cm (default)'], [0.001, '1 mm'], [0.01, '1 cm'], [0.05, '5 cm'], [0.1, '10 cm'], [0.25, '25 cm'], [0.5, '50 cm']];
  const sel = (k, opts) => h('select', { onchange: (e) => set(k, e.target.value === '' ? null : +e.target.value) },
    opts.map(([v, l]) => h('option', { value: v ?? '', selected: String(D[k] ?? '') === String(v ?? '') }, l)));
  pop.innerHTML = '';
  pop.append(
    h('div', { class: 'pop-h' }, h('b', {}, 'Dimension settings'), h('button', { class: 'x', onclick: () => toggleDimSettings(false) }, '✕')),
    h('div', { class: 'pop-sec' }, h('small', {}, 'SHOW'), chk('overall', 'Overall footprint'), chk('exterior', 'Exterior walls'), chk('interior', 'Interior walls'),
      chk('openings', 'Door & window chains'), chk('rooms', 'Room names, sizes & areas'), chk('items', 'Selected item width/depth')),
    h('div', { class: 'pop-sec' }, h('small', {}, 'WALL LENGTHS MEASURED'),
      ...[['center', 'Centre-line (setting-out)'], ['outside', 'Outside faces'], ['clear', 'Inside clear (room size)']].map(([v, l]) =>
        h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'dmode', checked: D.mode === v, onchange: () => set('mode', v) }), l))),
    h('div', { class: 'pop-grid' },
      h('label', {}, 'Area unit'), h('select', { onchange: (e) => set('areaUnit', e.target.value) },
        [['auto', 'Auto (m² / ft²)'], ['m2', 'Square metres'], ['sqft', 'Square feet'], ['cent', 'Cents'], ['all', 'm² + cents']].map(([v, l]) => h('option', { value: v, selected: (D.areaUnit || 'auto') === v }, l))),
      h('label', {}, 'Precision'), sel('precision', precOpts),
      h('label', {}, 'Snap step'), sel('snap', snapOpts),
      h('label', {}, 'Text size'), h('input', { type: 'range', min: 8, max: 16, value: D.textSize, onpointerdown: () => checkpoint(), oninput: (e) => { doc.dims = { ...(doc.dims || {}), textSize: +e.target.value }; plan.redraw(); }, onchange: () => { dropIfUnchanged(); emit('doc'); } })),
    h('p', { class: 'note' }, 'Tip: double-click any dimension in the plan to type an exact value. Use the Dimension tool for your own dimension lines.'));
  pop.hidden = false;
}

function openModal(...content) { $('#modal-box').innerHTML = ''; $('#modal-box').append(...content); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }

function openDesigns() {
  const cards = DESIGNS.map((d) => h('button', { class: 'design', onclick: () => {
    if (store.doc.objects.length && !confirm(`Load "${d.name}"? This replaces the current project (save it first if needed).`)) return;
    setDoc(d.build()); closeModal(); plan.userMoved = false; plan.fit(); view?.frame(); toast(`${d.name} loaded — explore it, then press ▶ Spectate for a guided tour`);
  } }, h('span', { class: 'dz', html: d.icon }), h('b', {}, d.name), h('small', {}, d.desc), h('span', { class: 'tags' }, d.tags.map((t) => h('i', {}, t)))));
  openModal(h('div', { class: 'modal-h' }, h('h2', {}, 'Start from a design'), h('button', { class: 'x', onclick: closeModal }, '✕')),
    h('p', { class: 'note' }, 'Every design is fully editable — change any wall, room, roof, portico or garden item.'), h('div', { class: 'designs' }, cards));
}

// 3D camera panel (loaded on first use) and full-screen 3D.
let camera = null;
async function toggleCamera(force) {
  if (!view) { toast('The 3D engine is still loading', true); return; }
  if (!camera) { const { CameraPanel } = await import('./camera.js'); camera = new CameraPanel(view, app); }
  if (store.view.mode === '2d') setView('split');
  camera.toggle(force);
  $('[data-act=camera]').classList.toggle('on', camera.open);
}
function toggleFullscreen() {
  const pane = $('#pane-3d');
  if (document.fullscreenElement) document.exitFullscreen();
  else {
    if (store.view.mode === '2d') setView('split');
    pane.requestFullscreen?.().catch(() => toast('Full screen is not available in this browser', true));
  }
}

// Spectate: a playable character you walk through the house (with collision physics).
async function startTour() {
  if (!view) { toast('The 3D engine is still loading', true); return; }
  if (store.view.mode === '2d') setView('split');
  const { Player, PHYSICS } = await import('./player.js');
  view.player ??= new Player(view, app);
  if (view.player.active) return;
  view.tour?.active && view.tour.stop();
  // spawn on the path in front of the house, facing the entrance
  const ws = store.doc.objects.filter((o) => o.type === 'wall' && o.level === 0);
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ws) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y1 = Math.max(y1, w.y1, w.y2); }
  const por = store.doc.objects.find((o) => o.type === 'portico' && o.level === 0);
  const sx = por ? por.x : ws.length ? (x0 + x1) / 2 : 0, sz = por ? por.y + por.d / 2 + 3.2 : ws.length ? y1 + 4 : 5;
  const THREE = await import('three');
  await busy($('#btn-tour'), 'Loading character…', () => view.player.start({ pos: new THREE.Vector3(sx, 0, sz), yaw: 0 }));
  const panel = $('#ph-physics-panel');
  panel.innerHTML = '';
  const rows = [['Body', `capsule ${PHYSICS.radius * 2} m wide × ${PHYSICS.height} m tall`], ['Steering', `A/D turn ${PHYSICS.turnRate} rad/s, backwards at ${Math.round(PHYSICS.backFactor * 100)} %, camera follows the face`], ['Walk / run', `${PHYSICS.walk} / ${PHYSICS.run} m/s (accel ${PHYSICS.accel} m/s²)`],
    ['Gravity', `${PHYSICS.gravity} m/s²`], ['Jump', `${PHYSICS.jump} m/s take-off ≈ ${((PHYSICS.jump ** 2) / (2 * PHYSICS.gravity)).toFixed(2)} m`],
    ['Step-up', `climbs edges up to ${PHYSICS.stepUp} m (stairs, kerbs, steps)`], ['Max slope', `${Math.round((Math.acos(PHYSICS.maxSlopeNormalY) * 180) / Math.PI)}°`],
    ['Doors', `hinged leaves swing when pushed, friction ${PHYSICS.doorFriction}/s, stop at ±${Math.round((PHYSICS.doorMax * 180) / Math.PI)}°, self-close after ${PHYSICS.doorCloserDelay} s`],
    ['Sliding doors', `open automatically within ${PHYSICS.slideSense} m`],
    ['Solid', 'walls, windows, door leaves, railings, columns, furniture, trunks, boundary walls'], ['Passable', 'open doorways, foliage, rugs']];
  for (const [k, v] of rows) panel.append(h('b', {}, k), h('span', {}, v));
}
async function startAutoTour() {
  view.player?.active && view.player.stop();
  const { Tour } = await import('./tour.js');
  view.tour ??= new Tour(view, app);
  await busy($('#ph-auto'), 'Loading guide…', () => view.tour.start());
}
// show a loading label on a button while the character downloads (instant once preloaded)
async function busy(btn, label, fn) {
  const text = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { await fn(); } finally { btn.disabled = false; btn.textContent = text; }
}

async function exportPdf() {
  if (!view) { toast('The 3D engine is still loading', true); return; }
  const btn = $('#btn-pdf');
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const { exportDrawingSet } = await import('./pdf.js');
    await exportDrawingSet({ plan, view, toast, progress: (t) => { btn.textContent = t; } });
  } catch (err) {
    console.error(err);
    toast('PDF export failed: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Export PDF';
    view.forceNoRoof = undefined; view.forceLevel = undefined; view.markDirty();
  }
}

function saveFile() {
  const blob = new Blob([JSON.stringify(store.doc, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(fileName('json'), url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Project downloaded');
}

function onKey(e) {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (e.key === 'Escape') e.target.blur(); return; }
  if (view?.walk) {
    if (e.key === 'Escape') view.setWalk(false);
    return;
  }
  if (camera?.open && e.key === 'Enter' && !plan.draft) { e.preventDefault(); camera.capture(); return; }
  if (view?.player?.active || view?.tour?.active) { if (e.key === 'c' && !e.ctrlKey) toggleCamera(); return; } // the character uses the rest of the keyboard
  if (plan.onKey(e)) { e.preventDefault(); return; }
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); redo(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (ctrl && k === 's') { e.preventDefault(); saveFile(); return; }
  if (ctrl) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (e.key === 'Escape') { if (store.tool !== 'select') setTool('select'); else app.select(null); return; }
  if (e.key === ' ') { plan.space = true; e.preventDefault(); return; }
  const step = (e.shiftKey ? 10 : 1) * (store.doc.units === 'ft' ? 0.0762 : 0.05);
  const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (arrows[e.key] && store.selectedId) { e.preventDefault(); nudge(...arrows[e.key]); return; }
  const map = { v: () => setTool('select'), w: () => setTool('wall', { wallKind: 'exterior' }), i: () => setTool('wall', { wallKind: 'interior' }),
    e: () => setTool('room'), m: () => setTool('measure'), d: () => setTool('dimension'), g: () => setTool('guide'), c: () => toggleCamera(), p: () => startTour(), r: () => rotateSelected(e.shiftKey ? 15 : 90), f: () => plan.fit(),
    1: () => setView('2d'), 2: () => setView('split'), 3: () => setView('3d') };
  if (map[k]) { e.preventDefault(); map[k](); }
}

// ------------------------------------------------------------------ boot
buildPalette();
wire();
const saved = loadSaved();
setDoc(saved && Array.isArray(saved.objects) ? saved : keralaTraditional());
setView('split');
syncToggles();
setTool('select');
setScope('all');
requestAnimationFrame(() => plan.fit());

import('./view3d.js').then(({ View3D }) => {
  view = new View3D($('#pane-3d'), app);
  window.homecraft = { store, plan, view };
  view.rebuild();
  view.frame();
  $('#loading3d').classList.add('hidden');
  // fetch the Spectate character in the background so it's ready when Spectate is pressed
  setTimeout(() => import('./character.js').then((c) => c.preloadCharacter()), 1500);
}).catch((err) => {
  console.error(err);
  const el = $('#loading3d');
  el.classList.add('error');
  el.textContent = 'The 3D engine could not be loaded (it is fetched from cdn.jsdelivr.net). Check your internet connection — the 2D planner still works.';
});

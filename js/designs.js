// Ready-made house designs for the Designs gallery. Every design is plain document data, fully editable.
import { uid } from './state.js';
import { ROOM_PRESETS, presetItems } from './catalog.js';
import { sampleHouse } from './templates.js';

// ---------------------------------------------------------------- design-authoring helper
function builder() {
  const objects = [];
  const api = {
    objects,
    wall(x1, y1, x2, y2, o = {}) {
      const kind = o.kind || 'exterior';
      const w = { id: uid(), type: 'wall', level: o.level || 0, x1, y1, x2, y2, kind, thickness: o.t ?? (kind === 'interior' ? 0.115 : 0.23), height: o.h ?? 3,
        finish: o.finish || 'plaster', color: o.color || '#f4efe6', innerColor: o.inner || '#f7f3ec' };
      objects.push(w);
      return w;
    },
    // four walls clockwise: [top (back), right, bottom (front), left]
    box(x0, y0, x1, y1, o) { return [api.wall(x0, y0, x1, y0, o), api.wall(x1, y0, x1, y1, o), api.wall(x1, y1, x0, y1, o), api.wall(x0, y1, x0, y0, o)]; },
    // openings are positioned by the world coordinate of their centre along the wall
    at(w, c) { return Math.abs(Math.abs(w.y2 - w.y1) < 1e-6 ? c - w.x1 : c - w.y1); },
    door(w, c, o = {}) { objects.push({ id: uid(), type: 'door', level: w.level, wallId: w.id, t: api.at(w, c), style: 'single', width: 0.9, height: 2.1, open: 30, color: '#6b4226', frameColor: '#efe8dc', ...o }); },
    win(w, c, o = {}) { objects.push({ id: uid(), type: 'window', level: w.level, wallId: w.id, t: api.at(w, c), style: 'casement', width: 1.2, height: 1.35, sill: 0.9, frameColor: '#5a3a22', ...o }); },
    item(p) { const o = { id: uid(), level: 0, rot: 0, z: 0, ...p }; objects.push(o); return o; },
    // named room floor + the preset's furniture
    room(key, x0, y0, x1, y1, o = {}) {
      const p = ROOM_PRESETS[key];
      api.item({ type: 'floor', level: o.level || 0, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0, z: 0.006, name: o.name || p?.label || '',
        finish: o.finish || p?.finish || 'tile', color: o.color || p?.color || '#ffffff' });
      if (p && o.furnish !== false) objects.push(...presetItems(key, x0, y0, x1, y1, o.level || 0));
    },
  };
  return api;
}
const find = (objs, fn) => objs.find(fn);

// ---------------------------------------------------------------- Kerala traditional (single storey)
export function keralaTraditional() {
  const b = builder(), W = { finish: 'plaster', color: '#f6f1e7' }, I = { kind: 'interior' };
  const [back, right, front, left] = b.box(0, 0, 14, 11, W);
  const x4 = b.wall(4, 0, 4, 11, I), x10 = b.wall(10, 0, 10, 11, I);
  const y6L = b.wall(0, 6, 4, 6, I); b.wall(10, 6, 14, 6, I); b.wall(0, 3.8, 4, 3.8, I); b.wall(2.4, 3.8, 2.4, 6, I);
  const y35 = b.wall(10, 3.5, 14, 3.5, I); b.wall(12.4, 3.5, 12.4, 6, I);
  const wood = { color: '#5a3a22', frameColor: '#3b2414' };
  b.door(front, 7, { style: 'double', width: 1.4, height: 2.2, open: 25, ...wood });
  b.door(x4, 8.5, { open: 40, ...wood }); b.door(x10, 8.5, { flip: true, open: 40, ...wood }); b.door(x4, 1.9, { open: 40, ...wood });
  b.door(y6L, 1.2, { flip: true, width: 0.75, ...wood }); b.door(x4, 4.9, { style: 'double', width: 0.9, height: 2.0, ...wood, color: '#8a5a33' });
  b.door(x10, 1.75, { flip: true, ...wood }); b.door(x10, 4.75, { flip: true, width: 0.75, ...wood });
  b.door(y35, 13.2, { style: 'arch', width: 1.0, height: 2.2 }); b.door(right, 4.8, { ...wood }); b.door(back, 7, { ...wood });
  for (const x of [2, 5.2, 8.8, 12]) b.win(front, x, { width: 1.2, height: 1.4, sill: 0.75 });
  b.win(left, 8.5); b.win(left, 4.9, { style: 'vent', width: 0.6, height: 0.45, sill: 1.8 }); b.win(left, 1.9);
  b.win(right, 1.75, { sill: 1.1, height: 1.1 }); b.win(right, 8.5);
  b.win(back, 2); b.win(back, 5.2, { style: 'arched', width: 1.0, height: 1.8, sill: 0.7 }); b.win(back, 8.8, { style: 'arched', width: 1.0, height: 1.8, sill: 0.7 }); b.win(back, 12, { sill: 1.1, height: 1.1 });
  b.item({ type: 'floor', x: 7, y: 5.5, w: 14, d: 11, finish: 'tile', color: '#f3e3cf' });
  b.room('living', 4, 6, 10, 11, { name: 'Living', furnish: false }); b.room('dining', 4, 0, 10, 6, { name: 'Dining' });
  // living room laid out clear of the front door and both bedroom doors
  b.item({ type: 'sofa', x: 5.35, y: 10.35, rot: 180, w: 2.1, d: 0.9, color: '#7d8a99' }); b.item({ type: 'armchair', x: 9.0, y: 10.3, rot: 180, w: 0.85, d: 0.85, color: '#b4a58c' });
  b.item({ type: 'tvunit', x: 5.35, y: 7.6, w: 1.6, d: 0.45, color: '#8a6a4a' }); b.item({ type: 'rug', x: 5.6, y: 9.0, w: 2.0, d: 1.4, color: '#9c7a55' });
  b.room('master', 0, 6, 4, 11, { name: 'Bedroom 1' }); b.room('bedroom', 10, 6, 14, 11, { name: 'Bedroom 2' }); b.room('bedroom', 0, 0, 4, 3.8, { name: 'Bedroom 3' });
  b.room('attached', 0, 3.8, 2.4, 6, { name: 'Toilet 1' }); b.room('pooja', 2.4, 3.8, 4, 6, { name: 'Pooja' });
  b.room('kitchen', 10, 0, 14, 3.5, { name: 'Kitchen' }); b.room('toilet', 10, 3.5, 12.4, 6, { name: 'Toilet 2' }); b.room('utility', 12.4, 3.5, 14, 6, { name: 'Work area' });
  b.item({ type: 'roof', style: 'kerala', x: 7, y: 5.5, w: 14.23, d: 11.23, z: 3, pitch: 33, overhang: 0.9, finish: 'clay', color: '#b9583a', gableColor: '#4a2c18' });
  b.item({ type: 'portico', x: 7, y: 12.415, w: 5, d: 2.6, h: 2.7, columns: 4, style: 'kerala', column: 'wood', steps: true, charupadi: true, color: '#5a3a22', roofColor: '#b9583a' });
  // site
  b.item({ type: 'gate', x: 7, y: 21, w: 4.2, d: 0.6, h: 2.1, style: 'padippura', open: 35, pillar: 'laterite', lamps: false, color: '#5a3a22' });
  b.item({ type: 'boundary', x: -0.45, y: 21, w: 10.7, d: 0.23, h: 1.5, style: 'laterite', color: '#ffffff' });
  b.item({ type: 'boundary', x: 14.45, y: 21, w: 10.7, d: 0.23, h: 1.5, style: 'laterite', color: '#ffffff' });
  b.item({ type: 'boundary', x: -5.8, y: 7.5, rot: 90, w: 27, d: 0.23, h: 1.5, style: 'laterite', color: '#ffffff' });
  b.item({ type: 'boundary', x: 19.8, y: 7.5, rot: 90, w: 27, d: 0.23, h: 1.5, style: 'laterite', color: '#ffffff' });
  b.item({ type: 'boundary', x: 7, y: -6, w: 25.6, d: 0.23, h: 1.5, style: 'laterite', color: '#ffffff' });
  b.item({ type: 'paving', x: 7, y: 18.1, w: 1.6, d: 5.6, finish: 'flagstone' });
  b.item({ type: 'paving', x: 7, y: 24, w: 30, d: 5, finish: 'asphalt' });
  for (const [x, y, h] of [[-3, 14, 10], [-4, 2, 11], [17, 16, 9.5], [17.5, 1, 10.5], [-2.5, -4, 9], [12, -4, 10]]) b.item({ type: 'tree', x, y, w: 5, d: 5, h, variety: 'coconut' });
  b.item({ type: 'tree', x: -3, y: 8.5, w: 6, d: 6, h: 7.5, variety: 'mango' });
  for (const [x, y] of [[17.6, 8], [18.2, 10.2], [16.8, 11.8]]) b.item({ type: 'tree', x, y, w: 2.6, d: 2.6, h: 3.4, variety: 'banana' });
  b.item({ type: 'tulsi', x: 3.2, y: 16.5, w: 0.7, d: 0.7, h: 1.1, color: '#efe2c8' });
  b.item({ type: 'well', x: 15.5, y: -2.5, w: 2.2, d: 2.2, h: 0.9 });
  b.item({ type: 'flowerbed', x: 5.3, y: 18.4, w: 1, d: 4.4, shape: 'rect', color: 'mix', edge: 'brick' });
  b.item({ type: 'flowerbed', x: 8.7, y: 18.4, w: 1, d: 4.4, shape: 'rect', color: '#d9354c', edge: 'brick' });
  b.item({ type: 'swing', x: -1.5, y: 16.5, w: 2.2, d: 1.4, h: 2.4, style: 'frame', color: '#5a3a22' });
  for (const [x, y] of [[1, 12], [13, 12], [0.4, 13.6], [13.6, 13.6]]) b.item({ type: 'shrub', x, y, w: 1, d: 1, h: 0.9, color: '#3f7a2e' });
  return { version: 1, name: 'Kerala traditional home', units: 'm', plinth: 0.6, plinthFinish: 'laterite', site: 'Kerala', levels: [{ name: 'Ground Floor', height: 3 }], objects: b.objects };
}

// ---------------------------------------------------------------- Modern villa (two storeys, flat roofs, terrace)
export function modernVilla() {
  const b = builder(), W = { finish: 'plaster', color: '#f2f0eb', h: 3.2 }, I = { kind: 'interior', h: 3.2 };
  const [back, right, front, left] = b.box(0, 0, 14, 10, W);
  const mid = b.wall(6.5, 0, 6.5, 10, I), cross = b.wall(6.5, 5, 14, 5, I), wc = b.wall(10.5, 5, 10.5, 10, I);
  const dark = { color: '#2f2a26', frameColor: '#2f343b' }, glassDoor = { style: 'sliding', color: '#2f343b', frameColor: '#2f343b' };
  b.door(front, 4, { width: 1.2, height: 2.4, ...dark });
  b.door(front, 9, { ...glassDoor, width: 2.6, height: 2.4 });
  b.win(front, 12.4, { style: 'picture', width: 1.8, height: 2.0, sill: 0.4, frameColor: '#2f343b' });
  b.door(back, 3.5, { ...glassDoor, width: 3.0, height: 2.4 }); b.win(back, 10, { style: 'sliding', width: 2.0, frameColor: '#2f343b', shade: true });
  b.win(left, 7, { style: 'sliding', width: 2.0, frameColor: '#2f343b', shade: true }); b.win(left, 2.5, { width: 1.2, frameColor: '#2f343b' });
  b.win(right, 2.5, { style: 'sliding', width: 1.6, frameColor: '#2f343b', shade: true }); b.win(right, 7.5, { style: 'vent', width: 0.6, height: 0.45, sill: 1.9, frameColor: '#2f343b' });
  b.door(mid, 3.8, { width: 1.0 }); b.door(cross, 9.2, { width: 0.9 }); b.door(wc, 7.2, { width: 0.75, flip: true });
  b.item({ type: 'floor', x: 7, y: 5, w: 14, d: 10, finish: 'marble', color: '#ffffff' });
  b.room('living', 0, 5, 6.5, 10, { name: 'Living' }); b.room('kitchen', 0, 0, 6.5, 2.8, { name: 'Kitchen' });
  b.room('dining', 0, 2.8, 6.5, 5, { name: 'Dining', furnish: false }); b.item({ type: 'table', x: 3.6, y: 3.9, w: 1.8, d: 0.9, color: '#3b2a1c' });
  b.room('master', 6.5, 0, 14, 5, { name: 'Guest bedroom' }); b.room('pooja', 6.5, 8.2, 8.0, 10, { name: 'Pooja' }); b.room('toilet', 10.5, 5, 14, 10, { name: 'Common toilet' });
  b.item({ type: 'stairs', shape: 'ushape', x: 8.5, y: 6.75, w: 2.6, d: 3.2, rot: 0, h: 3.2, flightW: 1.2, finish: 'marble', style: 'solid', railing: true });
  // first floor (terrace in front)
  const L1 = { ...W, level: 1 }, I1 = { ...I, level: 1 };
  // the stairs arrive in an open lobby (x 7–10) between the lounge and the master bedroom
  const [b1, r1, f1, l1] = b.box(0, 0, 14, 8.4, L1);
  const m1 = b.wall(10, 0, 10, 8.4, I1), m2 = b.wall(0, 4.2, 7, 4.2, I1);
  b.door(f1, 4, { ...glassDoor, width: 2.4, height: 2.4 });
  b.win(f1, 12, { style: 'picture', width: 2.4, height: 2.2, sill: 0.4, frameColor: '#2f343b' });
  b.win(b1, 3, { style: 'sliding', width: 1.6, frameColor: '#2f343b', shade: true }); b.win(b1, 12, { style: 'sliding', width: 1.6, frameColor: '#2f343b', shade: true });
  b.win(l1, 2.1, { width: 1.4, frameColor: '#2f343b' }); b.win(r1, 4.2, { width: 1.4, frameColor: '#2f343b' });
  b.door(m1, 6.6, { width: 0.9, flip: true }); b.door(m2, 5.6, { width: 0.9, flip: true });
  b.item({ type: 'floor', level: 1, x: 7, y: 5, w: 14, d: 10, finish: 'tile', color: '#ffffff' });
  b.room('master', 10, 0, 14, 8.4, { level: 1, name: 'Master bedroom' }); b.room('bedroom', 0, 0, 7, 4.2, { level: 1, name: 'Bedroom 2' });
  b.room('study', 0, 4.2, 7, 8.4, { level: 1, name: 'Family lounge', furnish: false });
  b.item({ type: 'sofa', level: 1, x: 2.5, y: 7.6, rot: 180, w: 2.4, d: 0.95, color: '#a3a8ad' });
  b.item({ type: 'balcony', level: 1, x: 7, y: 9.3, w: 14, d: 1.6, rail: 'glass', color: '#2f343b' });
  b.item({ type: 'roof', style: 'flat', level: 1, x: 7, y: 4.2, w: 14.23, d: 8.63, z: 3.2, overhang: 0.6, finish: 'concrete', color: '#d6d1c8' });
  b.item({ type: 'frame', level: 1, x: 12, y: 8.77, w: 3.2, d: 0.5, h: 3.0, z: 0.05, band: 0.22, finish: 'concrete', color: '#2f343b' });
  b.item({ type: 'cladding', level: 1, x: 1.6, y: 8.54, w: 2.6, h: 3.2, d: 0.04, finish: 'deck', color: '#ffffff' });
  b.item({ type: 'cladding', x: 6.2, y: 10.14, w: 2.0, h: 3.2, d: 0.05, finish: 'stone', color: '#ffffff' });
  b.item({ type: 'louvers', x: 12.4, y: 10.25, w: 2.4, h: 2.7, d: 0.12, gap: 0.15, dir: 'v', color: '#8a5a33', z: 0.2 });
  b.item({ type: 'portico', x: 4, y: 10.9, w: 3.2, d: 1.6, h: 2.9, columns: 2, style: 'modern', column: 'steel', steps: false, color: '#2f343b', roofColor: '#e7e3dc' });
  b.item({ type: 'watertank', level: 1, x: 12.5, y: 1.5, w: 1.3, d: 1.3, h: 1.3, z: 3.45, litres: 2000 });
  b.item({ type: 'solar', level: 1, x: 5, y: 2.5, w: 5, d: 2.2, tilt: 12, z: 3.45 });
  // site
  b.item({ type: 'paving', x: 7, y: -1.6, w: 10, d: 3, finish: 'pavers' }); b.item({ type: 'pool', x: 7, y: -5, w: 8, d: 3.6 });
  b.item({ type: 'pergola', x: 2.6, y: -1.6, w: 4, d: 3, h: 2.6, color: '#5a3a22' }); b.item({ type: 'sitout', x: 2.6, y: -1.6, w: 2.4, d: 1.8, style: 'sofa', color: '#e2d6bf' });
  b.item({ type: 'paving', x: 11, y: 13, w: 3.6, d: 6, finish: 'concrete' }); b.item({ type: 'car', x: 11, y: 12.8, rot: 90, w: 4.6, d: 1.9, color: '#1f2937' });
  b.item({ type: 'paving', x: 4, y: 13.9, w: 1.3, d: 4.2, finish: 'flagstone' });
  b.item({ type: 'gate', x: 11, y: 16, w: 4.4, d: 0.45, h: 2.0, style: 'sliding', open: 0, pillar: 'plaster', lamps: true, color: '#2f343b' });
  b.item({ type: 'gate', x: 4, y: 16, w: 1.9, d: 0.45, h: 2.0, style: 'modern', open: 0, pillar: 'plaster', lamps: true, color: '#2f343b' });
  b.item({ type: 'boundary', x: -0.45, y: 16, w: 6.0, d: 0.23, h: 1.8, style: 'plaster', color: '#e9e5dd' });
  b.item({ type: 'boundary', x: 6.875, y: 16, w: 3.85, d: 0.23, h: 1.8, style: 'plaster', color: '#e9e5dd' });
  b.item({ type: 'boundary', x: 15.1, y: 16, w: 3.8, d: 0.23, h: 1.8, style: 'plaster', color: '#e9e5dd' });
  b.item({ type: 'paving', x: 7, y: 19.5, w: 32, d: 6, finish: 'asphalt' });
  for (const [x, y] of [[-2.5, 4], [17, 2], [16.5, 9]]) b.item({ type: 'tree', x, y, w: 3.5, d: 3.5, h: 7, variety: 'palm' });
  b.item({ type: 'tree', x: -3, y: -6, w: 3.2, d: 3.2, h: 8, variety: 'cypress' });
  b.item({ type: 'hedge', x: 1.5, y: 15.2, w: 5, d: 0.6, h: 1, color: '#3f6b2e' });
  b.item({ type: 'flowerbed', x: 7.1, y: 14.3, w: 2.2, d: 1.4, shape: 'circle', color: '#e86fb0', edge: 'stone' });
  return { version: 1, name: 'Modern villa', units: 'm', plinth: 0.45, plinthFinish: 'stone', levels: [{ name: 'Ground Floor', height: 3.2 }, { name: 'First Floor', height: 3.2 }], objects: b.objects };
}

// ---------------------------------------------------------------- Kerala contemporary (sloped tiled roof over two storeys)
export function keralaContemporary() {
  const b = builder(), W = { finish: 'plaster', color: '#f7f4ee', h: 3.1 }, I = { kind: 'interior', h: 3.1 };
  const [back, right, front, left] = b.box(0, 0, 13, 10, W);
  const m = b.wall(5, 0, 5, 10, I), c1 = b.wall(5, 5.5, 13, 5.5, I), c2 = b.wall(0, 4, 5, 4, I), t = b.wall(9.5, 5.5, 9.5, 10, I);
  const D = { color: '#5a3a22', frameColor: '#3b2414' }, Wn = { frameColor: '#3b2414', shade: true };
  b.door(front, 7, { style: 'double', width: 1.5, height: 2.3, ...D }); b.win(front, 2.5, { style: 'sliding', width: 2.0, ...Wn }); b.win(front, 11.2, { width: 1.4, ...Wn });
  b.win(left, 7, { width: 1.4, ...Wn }); b.win(left, 2, { width: 1.2, ...Wn }); b.win(right, 2.8, { width: 1.4, ...Wn }); b.win(right, 7.8, { style: 'vent', width: 0.6, height: 0.45, sill: 1.9, frameColor: '#3b2414' });
  b.door(back, 2.5, { ...D }); b.win(back, 9, { style: 'sliding', width: 1.8, ...Wn });
  b.door(m, 2, { ...D, open: 40 }); b.door(c1, 7.2, { ...D, flip: true }); b.door(t, 7.8, { width: 0.75, ...D }); b.door(c2, 1.2, { ...D, flip: true, style: 'double', width: 0.9 });
  b.item({ type: 'floor', x: 6.5, y: 5, w: 13, d: 10, finish: 'tile', color: '#f6efe4' });
  b.room('living', 0, 4, 5, 10, { name: 'Living', furnish: false }); b.room('pooja', 0, 2.2, 1.8, 4, { name: 'Pooja' }); b.room('kitchen', 0, 0, 5, 2.2, { name: 'Kitchen', furnish: false });
  b.item({ type: 'kitchen', x: 2.6, y: 0.45, w: 3.6, d: 0.62, color: '#f2f0eb' });
  b.room('dining', 5, 5.5, 9.5, 10, { name: 'Dining' }); b.room('toilet', 9.5, 5.5, 13, 10, { name: 'Toilet' }); b.room('master', 5, 0, 13, 5.5, { name: 'Bedroom 1' });
  b.item({ type: 'stairs', shape: 'lshape', x: 3.4, y: 8.2, w: 3, d: 3.2, h: 3.1, flightW: 1, finish: 'wood', style: 'solid', railing: true, rot: 0 });
  b.item({ type: 'sofa', x: 0.65, y: 5.4, rot: 270, w: 2.0, d: 0.9, color: '#8a7a66' }); b.item({ type: 'rug', x: 2.0, y: 5.2, w: 1.4, d: 1.8, color: '#9c7a55' });
  const L1 = { ...W, level: 1 }, I1 = { ...I, level: 1 };
  const [b1, r1, f1, l1] = b.box(0, 0, 13, 8.5, L1);
  const mm = b.wall(6.5, 0, 6.5, 8.5, I1);
  b.door(f1, 3.2, { style: 'sliding', width: 2.0, height: 2.3, color: '#3b2414', frameColor: '#3b2414' }); b.win(f1, 10, { width: 1.6, ...Wn });
  b.win(b1, 3, { width: 1.4, ...Wn }); b.win(b1, 10, { width: 1.4, ...Wn }); b.win(l1, 4.2, { width: 1.2, ...Wn }); b.win(r1, 4.2, { width: 1.2, ...Wn }); b.door(mm, 6.5, { ...D, flip: true });
  b.item({ type: 'floor', level: 1, x: 6.5, y: 5, w: 13, d: 10, finish: 'wood', color: '#ffffff' });
  b.room('bedroom', 6.5, 0, 13, 8.5, { level: 1, name: 'Bedroom 2' }); b.room('bedroom', 0, 0, 6.5, 5, { level: 1, name: 'Bedroom 3' });
  b.item({ type: 'balcony', level: 1, x: 6.5, y: 9.25, w: 13, d: 1.5, rail: 'iron', color: '#3b2414' });
  b.item({ type: 'roof', style: 'kerala', level: 1, x: 6.5, y: 4.25, w: 13.23, d: 8.73, z: 3.1, pitch: 32, overhang: 1.0, finish: 'clay', color: '#b9583a', gableColor: '#3b2414' });
  b.item({ type: 'portico', x: 7, y: 11.3, w: 4.2, d: 2.4, h: 2.8, columns: 2, style: 'kerala-gable', column: 'wood', steps: true, charupadi: true, color: '#3b2414', roofColor: '#b9583a' });
  b.item({ type: 'carport', x: 16.2, y: 6, w: 3.6, d: 6, h: 2.7, withCar: true, carColor: '#f2f2f0', color: '#3b2414', roofColor: '#b9583a' });
  b.item({ type: 'paving', x: 16.2, y: 13.1, w: 3.6, d: 8.2, finish: 'pavers' });
  b.item({ type: 'gate', x: 16.2, y: 18.2, w: 4.4, d: 0.45, h: 1.8, style: 'arch', open: 20, pillar: 'laterite', lamps: true, color: '#1f2328' });
  b.item({ type: 'boundary', x: 5.8, y: 18.2, w: 16.4, d: 0.23, h: 1.4, style: 'railing', color: '#efe9de' });
  b.item({ type: 'paving', x: 7, y: 15.9, w: 1.4, d: 4.4, finish: 'flagstone' });
  b.item({ type: 'paving', x: 9, y: 21.5, w: 34, d: 5, finish: 'asphalt' });
  for (const [x, y, h] of [[-3, 13, 10], [-3.5, 2, 9.5], [20.5, 0, 10]]) b.item({ type: 'tree', x, y, w: 5, d: 5, h, variety: 'coconut' });
  b.item({ type: 'tree', x: 11.5, y: 15.5, w: 5, d: 5, h: 6.5, variety: 'gulmohar' });
  b.item({ type: 'tulsi', x: 4.5, y: 15.5, w: 0.7, d: 0.7, h: 1.1 });
  b.item({ type: 'flowerbed', x: 2, y: 16.8, w: 5, d: 1, shape: 'rect', color: 'mix', edge: 'brick' });
  return { version: 1, name: 'Kerala contemporary home', units: 'm', plinth: 0.6, plinthFinish: 'laterite', site: 'Kerala',
    levels: [{ name: 'Ground Floor', height: 3.1 }, { name: 'First Floor', height: 3.1 }], objects: b.objects };
}

// ---------------------------------------------------------------- Colonial two-storey
export function colonialHome() {
  const b = builder(), W = { finish: 'brick', color: '#ffffff', inner: '#f4efe6' }, I = { kind: 'interior' };
  const [back, right, front, left] = b.box(0, 0, 12, 9, W);
  const a = b.wall(4, 0, 4, 9, I), c = b.wall(8, 0, 8, 9, I);
  b.wall(0, 4.5, 4, 4.5, I); b.wall(8, 4.5, 12, 4.5, I);
  const Wh = { frameColor: '#ffffff', width: 1.2, height: 1.6, sill: 0.8 };
  b.door(front, 6, { style: 'double', width: 1.6, height: 2.4, color: '#1f3b2c', frameColor: '#ffffff' });
  b.win(front, 2, Wh); b.win(front, 10, Wh); b.win(back, 2, Wh); b.win(back, 10, Wh); b.door(back, 7.2, { color: '#1f3b2c', frameColor: '#ffffff' });
  b.win(left, 2.2, Wh); b.win(left, 6.8, Wh); b.win(right, 2.2, Wh); b.win(right, 6.8, Wh);
  b.door(a, 6.8, { open: 40 }); b.door(a, 2.2, { open: 40 }); b.door(c, 6.8, { flip: true, open: 40 }); b.door(c, 2.2, { flip: true, open: 40 });
  b.item({ type: 'floor', x: 6, y: 4.5, w: 12, d: 9, finish: 'wood', color: '#ffffff' });
  b.room('living', 0, 4.5, 4, 9, { name: 'Formal living' }); b.room('study', 0, 0, 4, 4.5, { name: 'Study' });
  b.room('dining', 8, 4.5, 12, 9, { name: 'Dining' }); b.room('kitchen', 8, 0, 12, 4.5, { name: 'Kitchen' });
  b.item({ type: 'stairs', shape: 'ushape', x: 6, y: 2.2, w: 2.6, d: 3.6, h: 3, flightW: 1.2, finish: 'wood', style: 'solid', railing: true, rot: 0 });
  const L1 = { ...W, level: 1 }, I1 = { ...I, level: 1 };
  const [b1, r1, f1, l1] = b.box(0, 0, 12, 9, L1);
  const a1 = b.wall(4, 0, 4, 9, I1), c1 = b.wall(8, 0, 8, 9, I1), t1 = b.wall(8, 6.5, 12, 6.5, I1);
  for (const x of [2, 6, 10]) { b.win(f1, x, Wh); b.win(b1, x, Wh); }
  b.win(l1, 4.5, Wh); b.win(r1, 2.2, Wh);
  b.door(a1, 7, {}); b.door(c1, 3, { flip: true }); b.door(t1, 9.2, { width: 0.75, flip: true });
  b.item({ type: 'floor', level: 1, x: 6, y: 4.5, w: 12, d: 9, finish: 'wood', color: '#ffffff' });
  b.room('master', 0, 0, 4, 9, { level: 1, name: 'Master bedroom' }); b.room('bedroom', 8, 0, 12, 6.5, { level: 1, name: 'Bedroom 2' });
  b.room('attached', 8, 6.5, 12, 9, { level: 1, name: 'Bath' });
  b.room('pooja', 4, 7.4, 5.6, 9, { level: 1, name: 'Prayer' });
  b.item({ type: 'roof', style: 'gable', level: 1, x: 6, y: 4.5, w: 12.23, d: 9.23, z: 3, pitch: 35, overhang: 0.5, finish: 'shingles', color: '#3f444b', gableColor: '#ffffff' });
  b.item({ type: 'portico', x: 6, y: 10.4, w: 4.6, d: 2.6, h: 6, columns: 4, style: 'pediment', column: 'classic', steps: true, color: '#ffffff', roofColor: '#3f444b' });
  b.item({ type: 'chimney', x: -0.6, y: 4.5, w: 1.0, d: 0.8, h: 8.6 });
  b.item({ type: 'gate', x: 6, y: 17, w: 4.4, d: 0.45, h: 1.9, style: 'arch', open: 0, pillar: 'brick', lamps: true, color: '#1f2328' });
  b.item({ type: 'boundary', x: -2.1, y: 17, w: 11.8, d: 0.23, h: 1.5, style: 'railing', color: '#ffffff' });
  b.item({ type: 'boundary', x: 14.1, y: 17, w: 11.8, d: 0.23, h: 1.5, style: 'railing', color: '#ffffff' });
  b.item({ type: 'paving', x: 6, y: 15.2, w: 2, d: 3.4, finish: 'pavers' });
  b.item({ type: 'paving', x: 6, y: 20.5, w: 36, d: 5, finish: 'asphalt' });
  for (const x of [-3, 15]) { b.item({ type: 'tree', x, y: 12.5, w: 6, d: 6, h: 8, variety: 'round' }); b.item({ type: 'tree', x, y: 1, w: 3, d: 3, h: 8, variety: 'conifer' }); }
  for (const x of [1, 3, 9, 11]) b.item({ type: 'hedge', x, y: 10.2, w: 1.8, d: 0.6, h: 0.9 });
  b.item({ type: 'fountain', x: 6, y: -4, w: 2.4, d: 2.4, h: 1.5 }); b.item({ type: 'bench', x: 2, y: -4, w: 1.6, d: 0.6, rot: 90, color: '#5a3a22' });
  return { version: 1, name: 'Colonial two-storey', units: 'm', plinth: 0.45, plinthFinish: 'stone', levels: [{ name: 'Ground Floor', height: 3 }, { name: 'First Floor', height: 3 }], objects: b.objects };
}

const ic = (body) => `<svg viewBox="0 0 200 92" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${body}</svg>`;
export const DESIGNS = [
  { name: 'Kerala traditional', desc: 'Clay-tiled mukhappu roof, wooden sit-out with charupadi, padippura gate, pooja room, open well and coconut grove.', tags: ['1 storey', '3 BHK', '~154 m²'], build: keralaTraditional,
    icon: ic('<path d="M30 52l30-26h80l30 26z" fill="#b9583a" stroke="#7a3a26"/><path d="M90 26l10-12 10 12z" fill="#5a3a22"/><rect x="45" y="52" width="110" height="30" fill="#f6f1e7"/><rect x="88" y="62" width="24" height="20" fill="#5a3a22"/><path d="M20 82h160" stroke="#555"/>') },
  { name: 'Kerala contemporary', desc: 'Two storeys under a sweeping tiled roof, gable porch with wooden jaali, balcony, carport and arched iron gate.', tags: ['2 storeys', '3 BHK', '~230 m²'], build: keralaContemporary,
    icon: ic('<path d="M40 30l25-16h70l25 16z" fill="#b9583a" stroke="#7a3a26"/><rect x="50" y="30" width="100" height="52" fill="#f7f4ee"/><path d="M80 56l20-14 20 14z" fill="#b9583a"/><rect x="60" y="38" width="20" height="10" fill="#9fc3d6"/><rect x="120" y="38" width="20" height="10" fill="#9fc3d6"/><path d="M20 82h160" stroke="#555"/>') },
  { name: 'Modern villa', desc: 'Flat roofs, front terrace with glass balcony, elevation frame, louvers, stone cladding, pool, pergola and sliding gate.', tags: ['2 storeys', '3 BHK', '~250 m²'], build: modernVilla,
    icon: ic('<rect x="40" y="46" width="120" height="36" fill="#f2f0eb"/><rect x="40" y="20" width="120" height="26" fill="#f2f0eb"/><rect x="36" y="16" width="128" height="5" fill="#555"/><rect x="110" y="24" width="34" height="20" fill="none" stroke="#2f343b" stroke-width="4"/><rect x="60" y="56" width="40" height="22" fill="#9fc3d6"/><path d="M20 82h160" stroke="#555"/>') },
  { name: 'Colonial two-storey', desc: 'Symmetrical brick facade, two-storey classical portico, gable roof, chimney, iron railings and formal garden.', tags: ['2 storeys', '3 BHK', '~216 m²'], build: colonialHome,
    icon: ic('<path d="M40 30l60-20 60 20z" fill="#3f444b"/><rect x="45" y="30" width="110" height="52" fill="#b5654a"/><path d="M80 30l20-12 20 12z" fill="#fff"/><path d="M84 30v52M93 30v52M107 30v52M116 30v52" stroke="#fff" stroke-width="4"/><path d="M20 82h160" stroke="#555"/>') },
  { name: 'Family bungalow', desc: 'Single-storey hip-roof home with classical portico, carport, pool, gazebo and backyard patio.', tags: ['1 storey', '2 BHK', '~108 m²'], build: sampleHouse,
    icon: ic('<path d="M40 44l25-20h70l25 20z" fill="#b9583a"/><rect x="50" y="44" width="100" height="38" fill="#ece3d3"/><path d="M60 44l15-10 15 10z" fill="#7a4a35"/><rect x="95" y="56" width="20" height="26" fill="#5a3a22"/><path d="M20 82h160" stroke="#555"/>') },
];

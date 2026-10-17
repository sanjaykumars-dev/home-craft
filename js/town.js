// "Green Meadows" township: eight unique houses on a tree-lined avenue, a park and a community pool.
// Each house is laid out by a small planner (outer walls, a back row of rooms, a central hall, a front row),
// so every room door opens into the hall, every outside wall gets windows, and furniture is fitted around
// a clear zone on both sides of every door.
import { uid } from './state.js';
import { CATALOG_INDEX } from './catalog.js';

const LH = 3.1, PLINTH = 0.45, ET = 0.23, IT = 0.115, INSET = 0.15;
const mk = (key, over = {}) => ({ ...CATALOG_INDEX[key].make(), ...over });
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const ROT = { N: 0, E: 90, S: 180, W: 270 };
const NORMAL = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }; // from the wall into the room
const ov = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6;
const inside = (r, b) => r.x0 >= b.x0 - 1e-6 && r.x1 <= b.x1 + 1e-6 && r.y0 >= b.y0 - 1e-6 && r.y1 <= b.y1 + 1e-6;
const rect = (x, y, w, d) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2 });

// ---------------------------------------------------------------- local plot frame → world
// rot is 0 (front of the plot faces +y) or 180 (front faces −y); every object is rotated rigidly.
function frame(objects, ox, oy, rot) {
  const c = Math.round(Math.cos((rot * Math.PI) / 180)), s = Math.round(Math.sin((rot * Math.PI) / 180));
  const P = (x, y) => [+(ox + x * c - y * s).toFixed(4), +(oy + x * s + y * c).toFixed(4)];
  return {
    wall(x1, y1, x2, y2, o = {}) {
      const kind = o.kind || 'exterior', [a, b] = P(x1, y1), [e, f] = P(x2, y2);
      const w = { id: uid(), type: 'wall', level: o.level || 0, x1: a, y1: b, x2: e, y2: f, kind, thickness: kind === 'interior' ? IT : ET, height: LH,
        finish: o.finish || 'plaster', color: o.color || '#f4efe6', innerColor: o.inner || '#f7f3ec' };
      if (o.bulge) w.bulge = o.bulge;
      Object.defineProperty(w, '_l', { value: { x1, y1, x2, y2 }, enumerable: false });
      objects.push(w);
      return w;
    },
    // an opening centred at local coordinate `at` along the wall (x for horizontal walls, y for vertical ones)
    open(w, key, at, over = {}) {
      const l = w._l, t = over.t ?? Math.abs(Math.abs(l.y2 - l.y1) < 1e-6 ? at - l.x1 : at - l.y1);
      const { t: _, ...rest } = over;
      const o = { id: uid(), level: w.level, wallId: w.id, ...mk(key), ...rest, t: +t.toFixed(4) };
      objects.push(o);
      return o;
    },
    item(p) {
      const [x, y] = P(p.x, p.y);
      const o = { id: uid(), level: 0, rot: 0, z: 0, ...p, x, y, rot: ((((p.rot || 0) + rot) % 360) + 360) % 360 };
      objects.push(o);
      return o;
    },
    put(key, x, y, over = {}) { return this.item({ ...mk(key), ...over, x, y }); },
  };
}

// ---------------------------------------------------------------- furniture fitter
// Works in local plot coordinates on axis-aligned rooms. Zones are door clearances; `taken` holds furniture
// and the working space reserved in front of it.
class Fitter {
  constructor(F, level) { this.F = F; this.level = level; this.zones = []; this.taken = []; }
  inner(room) { return { x0: room.x0 + INSET, y0: room.y0 + INSET, x1: room.x1 - INSET, y1: room.y1 - INSET }; }
  ok(r, room, { zones = true, taken = true, soft = false } = {}) {
    return inside(r, this.inner(room)) && !(zones && this.zones.some((z) => !(soft && z.soft) && ov(r, z))) && !(taken && this.taken.some((t) => ov(r, t)));
  }
  add(key, over, x, y, rot) { return this.F.item({ ...mk(key), ...over, x: +x.toFixed(3), y: +y.toFixed(3), rot, level: this.level }); }
  // against a wall, back to the wall, optionally keeping `front` metres clear in front
  wall(room, key, over = {}, sides = ['N', 'S', 'W', 'E'], { pref = 'center', front = 0, keep = true } = {}) {
    const m = mk(key, over), I = this.inner(room);
    for (const side of sides) {
      const horiz = side === 'N' || side === 'S', ew = horiz ? m.w : m.d, ed = horiz ? m.d : m.w;
      const lo = horiz ? I.x0 + ew / 2 : I.y0 + ed / 2, hi = horiz ? I.x1 - ew / 2 : I.y1 - ed / 2;
      if (hi < lo - 1e-6) continue;
      const target = pref === 'center' ? (lo + hi) / 2 : pref === 'start' ? lo : pref === 'end' ? hi : Math.max(lo, Math.min(hi, pref));
      const cands = [];
      for (let v = lo; v <= hi + 1e-6; v += 0.05) cands.push(v);
      cands.push(target);
      cands.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      const perp = { N: I.y0 + ed / 2, S: I.y1 - ed / 2, W: I.x0 + ew / 2, E: I.x1 - ew / 2 }[side];
      for (const v of cands) {
        const x = horiz ? v : perp, y = horiz ? perp : v, r = rect(x, y, ew, ed), [nx, ny] = NORMAL[side];
        const fr = front ? rect(x + nx * (ed / 2 + front / 2), y + ny * (ed / 2 + front / 2), horiz ? ew : front, horiz ? front : ed) : null;
        if (!this.ok(r, room) || (fr && !this.ok(fr, room, { zones: false }))) continue;
        this.taken.push(r); if (fr && keep) this.taken.push(fr);
        const o = this.add(key, over, x, y, ROT[side]);
        return { o, side, x, y, ew, ed, along: v, rect: r };
      }
    }
    return null;
  }
  // a free-standing piece; pad reserves space around it (chairs, walkway)
  center(room, key, over = {}, { padW = 0, padD = 0, rot = 0, near, soft = false } = {}) {
    const m = mk(key, over), I = this.inner(room), sw = rot % 180 ? m.d : m.w, sd = rot % 180 ? m.w : m.d;
    const tx = near?.x ?? (I.x0 + I.x1) / 2, ty = near?.y ?? (I.y0 + I.y1) / 2, cands = [];
    for (let x = I.x0 + (sw + padW) / 2; x <= I.x1 - (sw + padW) / 2 + 1e-6; x += 0.1) for (let y = I.y0 + (sd + padD) / 2; y <= I.y1 - (sd + padD) / 2 + 1e-6; y += 0.1) cands.push([x, y]);
    cands.sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty));
    for (const [x, y] of cands) {
      const r = rect(x, y, sw + padW, sd + padD);
      if (!this.ok(r, room, { soft })) continue;
      this.taken.push(r);
      return { o: this.add(key, over, x, y, rot), x, y, rect: r };
    }
    return null;
  }
  // at an exact spot (beside the bed, in front of the sofa)
  at(room, key, over, x, y, rot, { taken = true, reserve = true } = {}) {
    const m = mk(key, over), r = rect(x, y, rot % 180 ? m.d : m.w, rot % 180 ? m.w : m.d);
    if (!this.ok(r, room, { taken })) return null;
    if (reserve) this.taken.push(r);
    return { o: this.add(key, over, x, y, rot), rect: r };
  }
}

// ---------------------------------------------------------------- room recipes
const R = {
  living(fit, room, H) {
    const s = fit.wall(room, H.sofa || 'sofa', { color: H.fabric || '#7d8a99' }, H.sofaSides || ['W', 'E', 'N'], { pref: 'center' });
    if (s) {
      const [nx, ny] = NORMAL[s.side], ct = mk('coffeetable'), off = s.ed / 2 + 0.45 + (s.side === 'N' || s.side === 'S' ? ct.d : ct.w) / 2;
      const cx = s.x + nx * off, cy = s.y + ny * off;
      if (fit.at(room, 'coffeetable', { color: H.wood || '#8a6a4a' }, cx, cy, ROT[s.side])) {
        for (const [w, d] of [[2.0, 1.4], [1.6, 1.1], [1.3, 0.9]]) if (fit.at(room, 'rug', { color: H.rug || '#9c7a55', w, d }, cx, cy, ROT[s.side], { taken: false, reserve: false })) break;
      }
      fit.wall(room, 'tvunit', { color: H.wood || '#8a6a4a' }, [OPP[s.side]], { pref: s.along, front: 1.2, keep: false });
      fit.wall(room, 'floorlamp', {}, [s.side], { pref: 'start' });
    }
    fit.wall(room, 'armchair', { color: H.fabric2 || '#b4a58c' }, ['N', 'S', 'E', 'W'].filter((x) => x !== s?.side), { pref: 'end', front: 0.3 });
    if (H.mainDoorAt != null) fit.wall(room, 'shoerack', { color: H.wood || '#9a7b5b' }, ['S'], { pref: H.mainDoorAt, front: 0.4 });
    if (H.poojaInLiving) fit.wall(room, 'pooja', { color: '#8a5a33' }, ['N', 'E', 'W'], { pref: 'end', front: 0.8 });
  },
  dining(fit, room, H) {
    const t = fit.center(room, H.table || 'dining6', { color: H.tableColor || '#9c6b3f' }, { padD: 1.15, padW: 0.4 });
    // a breakfast island beside the dining table, toward the kitchen end of the hall
    if (H.island) fit.center(room, 'island', { w: 1.6, d: 0.7, color: H.cabinet || '#f2f0eb' }, { padW: 1.0, padD: 1.7, near: { x: room.x0, y: (room.y0 + room.y1) / 2 } });
    void t;
    fit.wall(room, 'vanity', { w: 0.9, d: 0.5 }, ['W', 'E'], { front: 0.6 });
  },
  lounge(fit, room, H) {
    const s = fit.wall(room, 'sofa-2', { color: H.fabric || '#8a7d6b' }, ['W', 'E', 'N', 'S'], { pref: 'center' });
    if (s) {
      const [nx, ny] = NORMAL[s.side], off = s.ed / 2 + 0.4 + 0.3;
      fit.at(room, 'coffeetable', { w: 0.9, d: 0.5, color: H.wood || '#8a6a4a' }, s.x + nx * off, s.y + ny * off, ROT[s.side]);
      fit.wall(room, 'tvunit', { w: 1.4, color: H.wood || '#8a6a4a' }, [OPP[s.side]], { pref: s.along, front: 1.0, keep: false });
    }
    fit.wall(room, 'bookshelf', { w: 1.0, color: H.wood || '#8a6a4a' }, ['N', 'S', 'E', 'W'], { pref: 'end', front: 0.5 });
  },
  kitchen(fit, room, H) {
    const w = Math.min(3.0, room.x1 - room.x0 - 0.9);
    fit.wall(room, 'kitchen', { w, color: H.cabinet || '#f2f0eb' }, ['N', 'W', 'E'], { front: 0.9 }) || fit.wall(room, 'kitchen', { w: 2.0, color: H.cabinet || '#f2f0eb' }, ['N', 'W', 'E', 'S'], { front: 0.9 });
    fit.wall(room, H.fridge || 'fridge', {}, ['W', 'E', 'N', 'S'], { pref: 'end', front: 0.7 });
  },
  bedroom(fit, room, H, spec) {
    const head = spec.head || (room.row === 'front' ? ['S', 'W', 'E'] : ['N', 'W', 'E']);
    const b = fit.wall(room, spec.bed || 'bed-queen', { color: spec.spread || '#4a6b8a' }, head, { pref: 'center', front: 0.6 });
    if (b) {
      const ns = mk('nightstand'), horiz = b.side === 'N' || b.side === 'S';
      for (const sg of [-1, 1]) {
        const off = (horiz ? b.ew : b.ed) / 2 + ns.w / 2 + 0.03, perpOff = ((horiz ? b.ed : b.ew) - ns.d) / 2;
        const [nx, ny] = NORMAL[b.side];
        const x = horiz ? b.x + sg * off : b.x - nx * perpOff, y = horiz ? b.y - ny * perpOff : b.y + sg * off;
        fit.at(room, 'nightstand', { color: H.wood || '#8a6a4a' }, x, y, ROT[b.side]);
      }
    }
    const others = ['W', 'E', 'N', 'S'].filter((x) => x !== b?.side);
    fit.wall(room, spec.wardrobe || 'wardrobe', { color: H.wardrobe || '#c8b8a2' }, others, { pref: 'end', front: 0.75 })
      || fit.wall(room, 'wardrobe-2', { color: H.wardrobe || '#c8b8a2' }, ['W', 'E', 'N', 'S'], { pref: 'end', front: 0.7 });
    for (const k of spec.extras || []) fit.wall(room, k, { color: k === 'cot' ? '#f3ede3' : H.wood || '#b48a5e' }, others, { pref: 'start', front: k === 'desk' ? 0.8 : 0.55 });
  },
  study(fit, room, H) {
    fit.wall(room, 'desk', { color: H.wood || '#b48a5e' }, ['N', 'S', 'W', 'E'], { front: 0.8 });
    fit.wall(room, 'bookshelf', { color: H.wood || '#8a6a4a' }, ['W', 'E', 'N', 'S'], { pref: 'end', front: 0.5 });
    fit.wall(room, 'armchair', { color: H.fabric2 || '#b4a58c' }, ['S', 'N', 'E', 'W'], { pref: 'end', front: 0.3 });
  },
  toilet(fit, room, H, spec) {
    const away = room.row === 'front' ? ['S', 'W', 'E', 'N'] : ['N', 'W', 'E', 'S'];
    fit.wall(room, spec.wc || 'wc', {}, away, { pref: 'start', front: 0.55 });
    fit.wall(room, spec.vanity ? 'vanity' : 'basin', spec.vanity ? { w: 0.9 } : {}, ['W', 'E', 'N', 'S'], { pref: 'start', front: 0.6 });
    if (spec.bathtub) fit.wall(room, 'bathtub', {}, away, { pref: 'end', front: 0.5 }) || fit.wall(room, 'shower', {}, away, { pref: 'end' });
    else fit.wall(room, 'shower', {}, away, { pref: 'end' });
  },
  pooja(fit, room) { fit.wall(room, 'pooja', { w: Math.min(1.1, room.x1 - room.x0 - 0.5), color: '#8a5a33' }, room.row === 'front' ? ['S'] : ['N'], { front: 0.6 }); },
  utility(fit, room) {
    fit.wall(room, 'washer', {}, ['N', 'S', 'W', 'E'], { pref: 'start', front: 0.6 });
    fit.wall(room, 'vanity', { w: 0.9, d: 0.55 }, ['N', 'S', 'W', 'E'], { pref: 'end', front: 0.6 });
  },
  store(fit, room) {
    fit.wall(room, 'bookshelf', { w: Math.min(1.6, room.x1 - room.x0 - 0.5), d: 0.45, h: 2.1, color: '#9a958c' }, ['N', 'S'], { front: 0.6 });
    fit.wall(room, 'shoerack', { color: '#9a958c' }, ['W', 'E'], { front: 0.4 });
  },
  // the car may stand in front of the garage door (that's how it got in) but not in front of the house door
  garage(fit, room, H) { fit.center(room, 'car', { color: H.car || '#2f343b' }, { rot: 90, soft: true }); },
};
const LABEL = { living: 'Living', dining: 'Dining hall', lounge: 'Family lounge', kitchen: 'Kitchen', bedroom: 'Bedroom', master: 'Master bedroom', study: 'Study',
  toilet: 'Toilet', pooja: 'Pooja', utility: 'Work area', store: 'Store', garage: 'Garage', stair: 'Staircase', stairwell: 'Stair landing' };
const FIN = { living: 'wood', dining: 'tile', lounge: 'wood', kitchen: 'tile', bedroom: 'wood', master: 'wood', study: 'wood', toilet: 'tile', pooja: 'marble',
  utility: 'tile', store: 'concrete', garage: 'concrete', stair: 'marble', stairwell: 'marble' };

// ---------------------------------------------------------------- house planner
function planLevel(F, H, L, spec) {
  const { x0, y0, w, d, db, dh } = H, x1 = x0 + w, y1 = y0 + d, yA = y0 + db, yB = yA + dh;
  const ext = { level: L, ...H.walls }, int = { level: L, kind: 'interior', inner: H.walls?.inner };
  const N = F.wall(x0, y0, x1, y0, ext), E = F.wall(x1, y0, x1, y1, ext);
  // front wall: one straight wall, or straight – curved bay – straight
  const front = [];
  if (L === 0 && H.bay) {
    const [b0, b1] = H.bay;
    front.push({ w: F.wall(x1, y1, b1, y1, ext), a: b1, b: x1 }, { w: F.wall(b1, y1, b0, y1, { ...ext, bulge: -H.bayDepth }), a: b0, b: b1, bay: true }, { w: F.wall(b0, y1, x0, y1, ext), a: x0, b: b0 });
  } else front.push({ w: F.wall(x1, y1, x0, y1, ext), a: x0, b: x1 });
  const S = front[0].w, frontAt = (x) => front.find((f) => !f.bay && x > f.a + 0.2 && x < f.b - 0.2)?.w;
  const W = F.wall(x0, y1, x0, y0, ext);
  const A = F.wall(x0, yA, x1, yA, int), B = F.wall(x0, yB, x1, yB, int);
  const fit = new Fitter(F, L), rooms = [], doors = [];
  const zoneH = (x, y, dw, deep = 1.0) => fit.zones.push({ x0: x - dw / 2 - 0.15, x1: x + dw / 2 + 0.15, y0: y - deep, y1: y + deep });
  const zoneV = (x, y, dw, deep = 1.0) => fit.zones.push({ x0: x - deep, x1: x + deep, y0: y - dw / 2 - 0.15, y1: y + dw / 2 + 0.15 });
  const D = { color: H.door?.color || '#5a3a22', frameColor: H.door?.frame || '#3b2414' }, WIN = { frameColor: H.winFrame || '#5a3a22', ...(H.winOver || {}) };
  const row = (list, ry0, ry1, name) => {
    const fixed = list.reduce((a, r) => a + (r.w || 0), 0), auto = list.filter((r) => !r.w).length;
    let cx = x0;
    list.forEach((r, i) => {
      const rw = r.w || (w - fixed) / Math.max(1, auto), room = { ...r, x0: cx, x1: cx + rw, y0: ry0, y1: ry1, row: name, i, last: i === list.length - 1 };
      if (i < list.length - 1) room.part = F.wall(cx + rw, ry0, cx + rw, ry1, int);
      rooms.push(room); cx += rw;
    });
  };
  row(spec.back, y0, yA, 'back');
  row(spec.front, yB, y1, 'front');
  const hall = { type: spec.hall || 'dining', x0, x1, y0: yA, y1: yB, row: 'hall', name: spec.hallName };
  rooms.push(hall);

  // doors: every back/front room opens into the hall, toward the middle of the house
  const mid = x0 + w / 2;
  for (const r of rooms) {
    if (r.row === 'hall') continue;
    const wallAB = r.row === 'back' ? A : B, yW = r.row === 'back' ? yA : yB, rw = r.x1 - r.x0;
    if (r.type === 'stair' || r.type === 'stairwell') {
      const ow = Math.min(1.3, rw - 0.5), at = r.entry === 'left' ? r.x0 + 0.3 + ow / 2 : r.entry === 'right' ? r.x1 - 0.3 - ow / 2 : (r.x0 + r.x1) / 2;
      F.open(wallAB, 'door-arch', at, { width: ow, height: 2.4 }); zoneH(at, yW, ow, 0.9);
      continue;
    }
    if (r.type === 'living') {
      const ow = Math.min(2.0, rw - 1.2), at = (r.x0 + r.x1) / 2;
      F.open(wallAB, 'door-arch', at, { width: ow, height: 2.4 }); zoneH(at, yW, ow, 0.9);
      continue;
    }
    if (r.attach) {
      // attached toilet: door from the neighbouring bedroom through the shared partition
      const nb = rooms.find((q) => q.row === r.row && q.i === r.i + (r.attach === 'left' ? -1 : 1)), part = r.attach === 'left' ? nb.part : r.part, xP = r.attach === 'left' ? r.x0 : r.x1;
      const dw = 0.75, at = r.row === 'back' ? r.y0 + 0.3 + dw / 2 : r.y1 - 0.3 - dw / 2;
      F.open(part, 'door-single', at, { ...D, width: dw, height: 2.1, flip: r.attach === 'right' }); zoneV(xP, at, dw);
      nb.awayFrom = r.attach === 'left' ? 'right' : 'left';
      continue;
    }
    r.pending = true;
  }
  for (const r of rooms.filter((q) => q.pending)) {
    const wallAB = r.row === 'back' ? A : B, yW = r.row === 'back' ? yA : yB;
    const dw = r.type === 'garage' ? 0.9 : r.type === 'toilet' ? 0.75 : r.type === 'pooja' ? 0.8 : 0.9;
    let right = (r.x0 + r.x1) / 2 < mid;
    if (r.awayFrom === 'right') right = false; if (r.awayFrom === 'left') right = true;
    const at = right ? r.x1 - 0.3 - dw / 2 : r.x0 + 0.3 + dw / 2;
    F.open(wallAB, r.type === 'pooja' ? 'door-double' : 'door-single', at, { ...D, width: dw, height: r.type === 'pooja' ? 2.0 : 2.1, flip: r.row === 'front' });
    zoneH(at, yW, dw);
    doors.push({ r, at });
  }

  // outside openings: front door, kitchen back door, balconies, garage door, windows on every outside wall
  const winKey = H.win || 'win-casement', winW = mk(winKey, WIN).width;
  for (const r of rooms) {
    const rw = r.x1 - r.x0, rd = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const vent = r.type === 'toilet' || r.type === 'store' || r.type === 'utility';
    const win = (wall, at, span) => {
      if (span < 1.2) return;
      if (vent) F.open(wall, 'win-vent', at, { ...WIN });
      else F.open(wall, r.type === 'stair' || r.type === 'stairwell' ? 'win-arched' : winKey, at, { ...WIN, width: Math.min(winW, span - 0.8) });
    };
    if (r.row === 'back') {
      if (r.type === 'kitchen' && L === 0) {
        const dw = 0.9, at = r.x0 + 0.35 + dw / 2;
        F.open(N, 'door-single', at, { ...D, width: dw, flip: true }); zoneH(at, y0, dw);
        win(N, (at + dw / 2 + r.x1) / 2, r.x1 - at - dw / 2);
      } else win(N, cx, rw);
    }
    if (r.row === 'front') {
      if (L === 0 && r.type === 'living') {
        const md = mk(H.mainDoor || 'door-double', { ...D, ...(H.mainDoorOver || {}) }), at = H.mainDoorX ?? cx;
        F.open(frontAt(at), H.mainDoor || 'door-double', at, { ...D, ...(H.mainDoorOver || {}) }); zoneH(at, y1, md.width);
        H.mainDoorAt = at; H.mainDoorWidth = md.width;
        if (!H.bay) for (const sg of [-1, 1]) {
          const wc = at + sg * (md.width / 2 + 0.6 + winW / 2);
          if (wc - winW / 2 > r.x0 + 0.4 && wc + winW / 2 < r.x1 - 0.4) F.open(S, winKey, wc, { ...WIN });
        }
      } else if (L === 0 && r.type === 'garage') {
        F.open(S, 'door-garage', cx, { width: Math.min(2.6, rw - 0.6), color: H.garageColor || '#e7e3dc' }); zoneH(cx, y1, 2.6); fit.zones[fit.zones.length - 1].soft = true;
      } else if (L === 1 && r.balcony) {
        const bw = Math.min(2.2, rw - 1.0);
        F.open(S, 'door-sliding', cx, { width: bw, height: 2.2, frameColor: H.winFrame || '#3a3f47' }); zoneH(cx, y1, bw);
      } else if (frontAt(cx)) win(frontAt(cx), cx, rw);
    }
    if (r.row !== 'hall' && r.i === 0) win(W, cy, rd);
    if (r.row !== 'hall' && r.last) win(E, cy, rd);
    if (r.row === 'hall') { win(W, cy, rd); win(E, cy, rd); }
  }
  // the bay: a picture window in the curved wall, the front door on the straight part beside it
  if (L === 0 && H.bay) {
    const c = H.bay[1] - H.bay[0], s = H.bayDepth, Rr = (c * c / 4 + s * s) / (2 * s), arc = 2 * Rr * Math.asin(c / (2 * Rr));
    F.open(front[1].w, 'win-picture', 0, { t: arc / 2, width: Math.min(2.2, arc - 1), height: 1.7, sill: 0.6, frameColor: H.winFrame });
  }

  // floors (the ground slab carries the plinth) and named room floors
  F.item({ type: 'floor', level: L, x: x0 + w / 2, y: y0 + d / 2, w, d, finish: H.floorFinish || 'tile', color: H.floorColor || '#efe6d8' });
  for (const r of rooms) {
    F.item({ type: 'floor', level: L, x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, w: r.x1 - r.x0, d: r.y1 - r.y0, z: 0.006, name: r.name || LABEL[r.type] || '',
      finish: r.finish || FIN[r.type] || 'tile', color: r.type === 'toilet' ? '#e7eef2' : '#ffffff' });
  }
  if (L === 0 && H.bay) {
    // floor and plinth under the bay so the room extends into it
    const [b0, b1] = H.bay, n = 10, c = b1 - b0, s = H.bayDepth, Rr = (c * c / 4 + s * s) / (2 * s), cxb = (b0 + b1) / 2, cyb = y1 + s - Rr;
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = -1 + (2 * i) / n, ang = Math.asin(((c / 2) * t) / Rr); pts.push([+(Rr * Math.sin(ang)).toFixed(3), +(cyb + Rr * Math.cos(ang) - (y1 + s / 2)).toFixed(3)]); }
    F.item({ type: 'floor', level: 0, shape: 'custom', pts, x: cxb, y: y1 + s / 2, w: c, d: s, finish: 'wood', color: '#ffffff' });
  }

  // stairs
  for (const r of rooms) {
    if (r.type !== 'stair') continue;
    const st = mk(r.stairs), rw = r.x1 - r.x0, rd = r.y1 - r.y0;
    if (r.stairs === 'stairs') {
      // straight flight along the room, starting at the left end and climbing to a landing on the right
      const len = Math.min(rw - 1.3, 4.6);
      F.item({ ...st, level: L, w: 1.05, d: len, h: LH, rot: 90, x: r.x0 + INSET + len / 2, y: r.y1 - INSET - 0.55, finish: H.stairFinish || st.finish });
    } else if (r.stairs === 'spiral') {
      F.item({ ...st, level: L, w: 1.9, d: 1.9, h: LH, x: (r.x0 + r.x1) / 2, y: r.y0 + INSET + 0.95 });
    } else {
      const sw = Math.min(st.w, rw - (r.stairs === 'stairs-u' ? 0.3 : 1.25)), sd = Math.min(st.d, rd - 0.3);
      F.item({ ...st, level: L, w: sw, d: sd, h: LH, x: r.x1 - INSET - sw / 2, y: r.y0 + INSET + sd / 2, finish: H.stairFinish || st.finish });
    }
  }

  // furniture
  for (const r of rooms) {
    const recipe = { master: 'bedroom', bedroom: 'bedroom' }[r.type] || r.type;
    R[recipe]?.(fit, r, H, r);
  }
  return { N, E, S, W, A, B, rooms, x1, y1, fit };
}

function house(F, H) {
  const g = planLevel(F, H, 0, H.ground);
  if (H.upper) planLevel(F, H, 1, H.upper);
  const top = H.upper ? 1 : 0, { x0, y0, w, d } = H, x1 = x0 + w, y1 = y0 + d;
  F.put(H.roof, x0 + w / 2, y0 + d / 2, { level: top, w: w + ET, d: d + ET, z: LH, ...(H.roofOver || {}) });
  if (H.portico) {
    const p = mk(H.portico, H.porticoOver || {});
    F.put(H.portico, H.mainDoorAt ?? x0 + w / 2, y1 + ET / 2 + p.d / 2, H.porticoOver || {});
    H.porchFront = y1 + ET / 2 + p.d;
  }
  return g;
}

// ---------------------------------------------------------------- plot: boundary, gates, drive, garden
function plot(F, H) {
  const g = house(F, H), P = H.plot || {};
  const px = H.mainDoorAt ?? H.x0 + H.w / 2, gx = P.gateX === 'door' ? px : P.gateX ?? 16, gw = mk(P.gate || 'gate-iron').w;
  // front boundary with the vehicle gate and a pedestrian gate on the path to the door
  const pw = mk('gate-ped').w, segs = [];
  const openings = [[gx, gw, P.gate || 'gate-iron'], ...(P.pedGate ? [[px, pw, 'gate-ped']] : [])].sort((a, b) => a[0] - b[0]);
  let cur = 0.3;
  for (const [x, ow] of openings) { segs.push([cur, x - ow / 2]); cur = x + ow / 2; }
  segs.push([cur, 19.7]);
  const bkey = P.boundary || 'boundary', bover = { h: P.wallH ?? mk(bkey).h, ...(P.boundaryOver || {}) };
  for (const [a, b] of segs) if (b - a > 0.3) F.put(P.fence ? 'fence' : bkey, (a + b) / 2, 25.7, { w: +(b - a).toFixed(3), ...(P.fence ? {} : bover) });
  for (const [x, , key] of openings) F.put(key, x, 25.7, P.gateOver || {});
  for (const x of [0.3, 19.7]) F.put(P.sideFence ? 'fence' : bkey, x, 13, { w: 25.4, rot: 90, ...(P.sideFence ? {} : bover) });
  F.put(bkey, 10, 0.3, { w: 19.4, ...bover });
  // drive from the gate to the carport / garage, path from the pedestrian gate to the portico steps
  const driveEnd = P.driveTo ?? 13, pathFrom = (H.porchFront ?? H.y0 + H.d) + 0.5;
  if (!P.noDrive) F.put('driveway', gx, (25.7 + driveEnd) / 2, { w: Math.min(3.4, gw - 0.6), d: 25.7 - driveEnd, finish: P.driveFinish || 'pavers' });
  if (P.carport) F.put('carport', gx, driveEnd - 3, { d: 6, w: 3.4, carColor: P.carColor || '#8a1c1c' });
  if (P.car) F.put('car', gx, driveEnd + 1.2 + 2.25, { rot: 90, color: P.carColor || '#1f4e79' });
  if (P.pedGate || P.noDrive) F.put('path', px, (25.7 + pathFrom) / 2, { w: 1.4, d: 25.7 - pathFrom, finish: P.pathFinish || 'flagstone' });
  else {
    // the path runs out from the steps and turns to meet the drive
    const yT = Math.min(22.6, pathFrom + 3.2), xa = Math.min(px, gx), xb = Math.max(px, gx);
    F.put('path', px, (pathFrom + yT + 0.7) / 2, { w: 1.4, d: yT + 0.7 - pathFrom, finish: P.pathFinish || 'flagstone' });
    F.put('path', (xa + xb) / 2, yT, { w: xb - xa, d: 1.4, finish: P.pathFinish || 'flagstone' });
  }
  for (const it of P.garden || []) F.put(it[0], it[1], it[2], it[3] || {});
  return g;
}

// ---------------------------------------------------------------- the eight houses (local plot coordinates, front at y = 26)
const HOUSES = [
  // 1. Kerala traditional: mukhappu roof, sit-out with charupadi, padippura, well and coconut palms
  { name: 'Thekkini — Kerala traditional', x0: 1.4, y0: 3.4, w: 13, d: 11.2, db: 3.8, dh: 3.6,
    walls: { finish: 'plaster', color: '#f6f1e7' }, door: { color: '#5a3a22', frame: '#3b2414' }, winFrame: '#5a3a22', floorColor: '#f3e3cf',
    ground: { back: [{ type: 'kitchen', w: 3.6 }, { type: 'utility', w: 2.2 }, { type: 'toilet', w: 2.0 }, { type: 'pooja', w: 1.8 }, { type: 'bedroom', name: 'Bedroom 3', bed: 'bed-double', wardrobe: 'wardrobe-2', spread: '#7a8f6a' }],
      front: [{ type: 'master', name: 'Bedroom 1', w: 3.8, bed: 'bed', spread: '#6a4a3a', extras: ['dressing'] }, { type: 'living' }, { type: 'bedroom', name: 'Bedroom 2', w: 3.8, bed: 'bed-queen', extras: ['desk'] }] },
    sofa: 'sofa', table: 'dining6', fridge: 'fridge', roof: 'roof-kerala', roofOver: { pitch: 33, overhang: 0.9, color: '#b9583a', gableColor: '#4a2c18' },
    portico: 'portico-kerala', porticoOver: { w: 4.6, color: '#5a3a22' }, mainDoorOver: { width: 1.4, height: 2.2, color: '#5a3a22' },
    plot: { gate: 'gate-padippura', gateX: 16.6, boundary: 'boundary', boundaryOver: { style: 'laterite', h: 1.5 }, carport: true, carColor: '#f4f4f2', driveTo: 13.5, driveFinish: 'pavers',
      garden: [['coconut', 0.9, 21], ['coconut', 18.6, 3.5], ['coconut', 0.9, 2.4], ['mango', 4, 22.4], ['banana', 13.2, 1.6], ['banana', 14.6, 2.0], ['tulsi', 4.2, 18.8], ['well', 17.6, 1.6],
        ['flowerbed', 6.8, 20.5, { w: 0.9, d: 3.4, color: 'mix' }], ['flowerbed', 9.0, 20.5, { w: 0.9, d: 3.4, color: '#d9354c' }], ['shrub', 1.0, 15.4], ['shrub', 14.0, 15.7]] } },

  // 2. Modern villa: flat roofs, garage, U-stairs, glass balcony, frame, louvers, stone cladding, pool, solar
  { name: 'Skyline — modern villa', x0: 4.0, y0: 2.6, w: 12, d: 12.8, db: 3.6, dh: 4.4,
    walls: { finish: 'plaster', color: '#f2f0eb' }, door: { color: '#2f2a26', frame: '#2f343b' }, winFrame: '#2f343b', win: 'win-sliding', floorFinish: 'marble', floorColor: '#ffffff',
    ground: { back: [{ type: 'kitchen', w: 4.2 }, { type: 'utility', w: 2.0 }, { type: 'stair', w: 2.6, stairs: 'stairs-u', entry: 'right' }, { type: 'toilet', name: 'Guest toilet', bathtub: true }],
      front: [{ type: 'garage', w: 3.6 }, { type: 'living' }, { type: 'bedroom', name: 'Guest bedroom', w: 3.4, bed: 'bed-queen', spread: '#a3a8ad', wardrobe: 'wardrobe-2' }] },
    upper: { hall: 'lounge', hallName: 'Family lounge', back: [{ type: 'bedroom', name: 'Kids room', w: 4.2, bed: 'bed-single', spread: '#3b82f6', extras: ['desk', 'bookshelf'] }, { type: 'toilet', w: 2.0 }, { type: 'stairwell', w: 2.6, entry: 'left' }, { type: 'study' }],
      front: [{ type: 'master', w: 5.0, balcony: true, bed: 'bed', spread: '#4b5563', wardrobe: 'wardrobe-slide', extras: ['dressing'] }, { type: 'toilet', name: 'Master bath', w: 2.4, vanity: true }, { type: 'bedroom', name: 'Bedroom 3', bed: 'bed-double', spread: '#9c7a55' }] },
    sofa: 'sofa-l', fabric: '#6b7684', table: 'dining8', tableColor: '#3b2a1c', fridge: 'fridge-double', island: true, cabinet: '#e7e3dc', poojaInLiving: true, wardrobe: '#e8e2d8',
    mainDoor: 'door-single', mainDoorOver: { width: 1.2, height: 2.4, color: '#2f2a26' }, roof: 'roof-flat', roofOver: { overhang: 0.5, color: '#d6d1c8' },
    portico: 'portico-modern', porticoOver: { w: 3.0 },
    plot: { gate: 'gate-slide', gateX: 5.8, boundary: 'boundary-rail', driveTo: 15.4, driveFinish: 'concrete',
      garden: [['pool', 2.1, 9.0, { w: 6, d: 3.0, rot: 90 }], ['palm', 1.6, 22.5], ['palm', 18.4, 22.5], ['pot-palm', 9.6, 17.8], ['pot-palm', 12.0, 17.8], ['rocks', 17.6, 17.6], ['lawn', 13.5, 21.5, { w: 9, d: 6 }],
        ['balcony', 6.5, 15.4 + 0.8 + ET / 2, { level: 1, w: 4.4, d: 1.6, rail: 'glass', color: '#2f343b' }], ['frame', 13.6, 15.4 + 0.25 + ET / 2, { level: 1, w: 4.6, d: 0.5, h: 3.0, z: 0.05, color: '#2f343b' }],
        ['clad-stone', 12.0, 15.4 + ET / 2 + 0.03, { w: 1.1, h: 3.1 }], ['louvers', 16.2, 9.0, { rot: 90, w: 2.4, h: 2.8, level: 1, z: 0.1 }],
        ['watertank', 13.0, 4.4, { level: 1, z: LH + 0.3 }], ['solar', 8.0, 5.6, { level: 1, z: LH + 0.3, w: 4.4 }], ['acunit', 16.45, 12.2, { rot: 90 }]] } },

  // 3. Colonial two-storey: brick, two-storey portico, gable roof, chimney, L-stairs, hedges and fountain
  { name: 'Windsor — colonial two-storey', x0: 2.0, y0: 3.4, w: 12, d: 11, db: 3.8, dh: 3.6,
    walls: { finish: 'brick', color: '#ffffff', inner: '#f7f3ec' }, door: { color: '#1f2937', frame: '#ffffff' }, winFrame: '#ffffff', floorFinish: 'wood', floorColor: '#e8d9c4',
    ground: { back: [{ type: 'kitchen', w: 3.8 }, { type: 'stair', w: 4.3, stairs: 'stairs-l', entry: 'right' }, { type: 'toilet', w: 2.0 }, { type: 'store' }],
      front: [{ type: 'study', name: 'Library', w: 3.4 }, { type: 'living' }, { type: 'bedroom', name: 'Guest room', w: 3.4, bed: 'bed-double', spread: '#7c2d12', wardrobe: 'wardrobe-2' }] },
    upper: { hall: 'lounge', hallName: 'Upper hall', back: [{ type: 'bedroom', w: 3.8, bed: 'bed-queen', spread: '#14532d' }, { type: 'stairwell', w: 4.3, entry: 'left' }, { type: 'toilet', w: 2.0 }, { type: 'utility', name: 'Laundry' }],
      front: [{ type: 'bedroom', name: 'Bedroom 3', w: 3.4, bed: 'bed-double', spread: '#1e3a8a' }, { type: 'master', bed: 'bed', spread: '#7c2d12', extras: ['dressing'] }, { type: 'bedroom', name: 'Bedroom 4', w: 3.4, bed: 'bed-single', spread: '#9c7a55', extras: ['desk'] }] },
    sofa: 'sofa', fabric: '#7c2d12', table: 'dining6', tableColor: '#5a3a22', roof: 'roof-gable', roofOver: { pitch: 32, overhang: 0.5, finish: 'shingles', color: '#3f444b', gableColor: '#b5654a' },
    portico: 'portico-colonial', porticoOver: { w: 4.6, h: 5.9, color: '#ffffff' }, mainDoorOver: { width: 1.5, height: 2.4, color: '#1f2937' },
    plot: { gate: 'gate-iron', gateX: 17.2, boundary: 'boundary-brick', boundaryOver: { h: 1.4 }, carport: true, carColor: '#1e3a8a', driveTo: 13.2,
      garden: [['chimney', 1.75, 6.2, { w: 0.9, d: 0.6, h: 7.4 }], ['fountain', 8.0, 21.0], ['hedge', 3.5, 18.0, { w: 4.2 }], ['hedge', 12.4, 18.0, { w: 3.4 }], ['cypress', 1.0, 18.5], ['cypress', 1.0, 21.5], ['cypress', 1.0, 24.5],
        ['flowerbed-round', 4.4, 21.6], ['tree', 12.8, 22.4, { w: 4, d: 4, h: 6 }], ['septic', 16.8, 1.8]] } },

  // 4. Kerala contemporary: tiled roof over two storeys, gable porch, winder stairs, iron balcony, pergola, wood cladding
  { name: 'Ambalam — Kerala contemporary', x0: 1.5, y0: 3.4, w: 11, d: 11, db: 3.8, dh: 3.6,
    walls: { finish: 'plaster', color: '#f7f4ee' }, door: { color: '#6b4226', frame: '#4a2c18' }, winFrame: '#4a2c18', win: 'win-shade', floorColor: '#efe6d8',
    ground: { back: [{ type: 'kitchen', w: 3.6 }, { type: 'stair', w: 4.1, stairs: 'stairs-w', entry: 'right' }, { type: 'toilet' }],
      front: [{ type: 'bedroom', name: 'Parents room', w: 3.6, bed: 'bed-queen', spread: '#7a5c48' }, { type: 'living' }, { type: 'pooja', w: 1.8 }] },
    upper: { hall: 'lounge', back: [{ type: 'bedroom', name: 'Kids room', w: 3.6, bed: 'bed-single', spread: '#16a34a', extras: ['desk'] }, { type: 'stairwell', w: 4.1, entry: 'left' }, { type: 'toilet' }],
      front: [{ type: 'master', w: 5.6, balcony: true, bed: 'bed', spread: '#6a4a3a', wardrobe: 'wardrobe', extras: ['cot', 'dressing'] }, { type: 'study', name: 'Reading room' }] },
    sofa: 'sofa', fabric: '#8a7d6b', table: 'dining4', fridge: 'fridge', roof: 'roof-kerala', roofOver: { pitch: 30, overhang: 0.8, color: '#a84c32', gableColor: '#4a2c18' },
    portico: 'portico-kgable', porticoOver: { w: 3.6 }, mainDoorOver: { width: 1.3, height: 2.2, color: '#6b4226' },
    plot: { gate: 'gate-arch', gateX: 16.2, boundary: 'boundary', carport: true, carColor: '#64748b', driveTo: 13.0,
      garden: [['balcony-iron', 4.3, 14.4 + 0.6 + ET / 2, { level: 1, w: 3.2, d: 1.2 }], ['clad-wood', 9.0, 14.4 + ET / 2 + 0.025, { w: 2.0, h: 3.1 }],
        ['pergola', 4.6, 21.0, { w: 4, d: 3 }], ['sitout-sofa', 4.6, 21.0], ['banana', 13.6, 1.8], ['banana', 15.2, 2.4], ['banana', 17.4, 1.6], ['bamboo', 1.2, 1.4], ['gulmohar', 10.6, 22.6],
        ['flowerbed-round', 8.4, 18.6, { w: 1.6, d: 1.6 }], ['pot', 6.4, 16.0], ['pot', 11.2, 16.0], ['acunit', 12.75, 6.0, { rot: 90 }]] } },

  // 5. Craftsman bungalow: hip roof, porch, curved bay window, bathtub, picket fence, wooden gate
  { name: 'Maple — craftsman bungalow', x0: 1.4, y0: 3.4, w: 13, d: 10.8, db: 3.8, dh: 3.6, bay: [5.4, 8.4], bayDepth: 0.9, mainDoorX: 10.1,
    walls: { finish: 'plaster', color: '#efe3cc' }, door: { color: '#7c4a1e', frame: '#f4f1ea' }, winFrame: '#f4f1ea', win: 'win-shade', floorFinish: 'wood', floorColor: '#e2c9a6',
    ground: { back: [{ type: 'kitchen', w: 3.4 }, { type: 'utility', w: 2.2 }, { type: 'toilet', w: 2.4, bathtub: true }, { type: 'bedroom', name: 'Bedroom 3', bed: 'bed-double', spread: '#9c4221' }],
      front: [{ type: 'bedroom', name: 'Bedroom 1', w: 3.6, bed: 'bed-queen', spread: '#3f6212', extras: ['dressing'] }, { type: 'living', w: 6.0 }, { type: 'bedroom', name: 'Bedroom 2', bed: 'bed-double', spread: '#1e40af', wardrobe: 'wardrobe-2' }] },
    sofa: 'sofa', fabric: '#57534e', sofaSides: ['W', 'N', 'E'], table: 'dining6', tableColor: '#7c4a1e', fridge: 'fridge-double', roof: 'roof-hip', roofOver: { pitch: 24, overhang: 0.7, color: '#5a4a42', finish: 'shingles' },
    portico: 'portico-porch', porticoOver: { w: 3.0 }, mainDoor: 'door-single', mainDoorOver: { width: 1.0, color: '#7c4a1e' },
    plot: { gate: 'gate-wood', gateX: 16.8, fence: true, sideFence: true, boundary: 'boundary', car: true, carColor: '#b45309', driveTo: 13.6, driveFinish: 'gravel',
      garden: [['bench', 4.0, 22.8], ['flowerbed', 3.2, 19.0, { w: 3.0, d: 0.9 }], ['flowerbed', 8.8, 19.6, { w: 2.6, d: 0.9, color: '#facc15' }], ['shrub', 1.4, 16.0], ['shrub', 14.3, 15.8],
        ['pine', 1.2, 1.4], ['pine', 4.4, 1.2], ['mango', 9.4, 23.0], ['flowerbed-round', 6.4, 22.6, { w: 1.6, d: 1.6 }]] } },

  // 6. Courtyard house: arched portico, modern gate, L-shaped deck with pergola, swing, sit-out
  { name: 'Nadumuttam — courtyard house', x0: 1.4, y0: 3.4, w: 12, d: 10.8, db: 3.8, dh: 3.6,
    walls: { finish: 'plaster', color: '#fbf6ee' }, door: { color: '#3b2a1c', frame: '#f4f1ea' }, winFrame: '#3b2a1c', win: 'win-arched', floorColor: '#f1e4cf',
    ground: { back: [{ type: 'kitchen', w: 3.6 }, { type: 'toilet', w: 2.0 }, { type: 'master', name: 'Master bedroom', bed: 'bed', spread: '#0f766e', wardrobe: 'wardrobe-slide', extras: ['dressing'] }],
      front: [{ type: 'bedroom', name: 'Guest room', w: 3.4, bed: 'bed-double', spread: '#b45309', wardrobe: 'wardrobe-2' }, { type: 'living' }, { type: 'study', w: 3.0 }] },
    sofa: 'sofa-l', fabric: '#a16207', table: 'dining4', fridge: 'fridge-double', roof: 'roof-hip', roofOver: { pitch: 22, overhang: 0.8, color: '#b9583a', finish: 'clay' },
    portico: 'portico-arched', porticoOver: { w: 4.4 }, mainDoorOver: { width: 1.4, height: 2.3, color: '#3b2a1c' },
    plot: { gate: 'gate-modern', gateX: 16.4, boundary: 'boundary', boundaryOver: { h: 1.6 }, carport: true, carColor: '#065f46', driveTo: 13.2,
      garden: [['floor-l', 4.5, 20.4, { w: 6, d: 4.6, z: 0.12, finish: 'deck' }], ['pergola', 3.6, 19.6, { w: 3.6, d: 2.8, z: 0.12 }], ['sitout', 3.6, 19.6, { z: 0.12 }], ['swing', 9.6, 22.8],
        ['floor-custom', 16.8, 1.6, { w: 4.6, d: 2.4, z: 0.1, pts: [[-2.3, -1.2], [2.3, -1.2], [2.3, 1.2], [-1.6, 1.2]] }], ['charupadi', 16.8, 1.4, { z: 0.1 }],
        ['gulmohar', 1.4, 24.0, { w: 5, d: 5 }], ['shrub', 13.2, 16.0], ['pot', 7.6, 17.0], ['tree', 9.0, 1.4, { w: 3.6, d: 3.6, h: 5 }]] } },

  // 7. Duplex: balcony portico, spiral stairs, flat roof, louvers, solar
  { name: 'Helix — contemporary duplex', x0: 3.0, y0: 3.4, w: 10, d: 11, db: 3.8, dh: 3.6,
    walls: { finish: 'plaster', color: '#e9edf1' }, door: { color: '#334155', frame: '#1f2937' }, winFrame: '#1f2937', win: 'win-sliding', floorFinish: 'marble', floorColor: '#ffffff',
    ground: { back: [{ type: 'kitchen', w: 3.4 }, { type: 'stair', w: 2.4, stairs: 'spiral' }, { type: 'toilet', w: 2.0, wc: 'wc-indian' }, { type: 'store' }],
      front: [{ type: 'living', w: 5.6 }, { type: 'bedroom', name: 'Bedroom 1', bed: 'bed-queen', spread: '#475569' }] },
    upper: { hall: 'lounge', back: [{ type: 'bedroom', name: 'Bedroom 3', w: 3.4, bed: 'bed-single', spread: '#db2777', extras: ['desk'] }, { type: 'stairwell', w: 2.4 }, { type: 'toilet', w: 2.0, vanity: true }, { type: 'utility' }],
      front: [{ type: 'master', w: 5.6, balcony: true, bed: 'bed', spread: '#1f2937', wardrobe: 'wardrobe-slide' }, { type: 'bedroom', name: 'Bedroom 2', bed: 'bed-double', spread: '#0e7490' }] },
    sofa: 'sofa', fabric: '#334155', table: 'dining6', tableColor: '#1f2937', poojaInLiving: true, roof: 'roof-flat', roofOver: { overhang: 0.4, color: '#cbd5e1' },
    portico: 'portico-balcony', porticoOver: { w: 3.6 }, mainDoor: 'door-single', mainDoorX: 4.6, mainDoorOver: { width: 1.1, height: 2.3, color: '#334155' },
    plot: { gate: 'gate-iron', gateX: 16.6, pedGate: true, boundary: 'boundary', carport: true, carColor: '#991b1b', driveTo: 12.8,
      garden: [['louvers-h', 10.6, 14.4 + ET / 2 + 0.06, { w: 2.4, h: 2.2, level: 1, z: 0.4 }], ['louvers', 13.06, 7.0, { rot: 90, w: 2.0, h: 2.6 }], ['solar', 8.0, 6.0, { level: 1, z: LH + 0.3 }],
        ['watertank', 4.4, 5.0, { level: 1, z: LH + 0.3 }], ['cypress', 1.0, 15.0], ['cypress', 1.0, 18.0], ['cypress', 1.0, 21.0], ['rocks', 10.6, 21.4], ['pot', 2.4, 16.6], ['lawn', 9.0, 21.0, { w: 6, d: 5 }]] } },

  // 8. Compact family home: classical portico, straight stairs, gable roof, ramp, sit-out deck, septic tank
  { name: 'Nest — compact family home', x0: 2.4, y0: 4.0, w: 10.4, d: 10.6, db: 3.6, dh: 3.6,
    walls: { finish: 'plaster', color: '#fdf0d5' }, door: { color: '#92400e', frame: '#f4f1ea' }, winFrame: '#f4f1ea', win: 'win-casement', floorColor: '#efe6d8',
    ground: { back: [{ type: 'kitchen', w: 3.0 }, { type: 'stair', w: 5.6, stairs: 'stairs', entry: 'left' }, { type: 'toilet', wc: 'wc-indian' }],
      front: [{ type: 'bedroom', name: 'Bedroom 1', w: 3.6, bed: 'bed-double', spread: '#92400e', wardrobe: 'wardrobe-2' }, { type: 'living' }] },
    upper: { hall: 'lounge', back: [{ type: 'bedroom', name: 'Bedroom 3', w: 3.0, bed: 'bed-single', spread: '#7c3aed', wardrobe: 'wardrobe-2' }, { type: 'stairwell', w: 5.6, entry: 'right' }, { type: 'toilet' }],
      front: [{ type: 'bedroom', name: 'Bedroom 2', w: 5.2, bed: 'bed-queen', spread: '#be123c', extras: ['desk'] }, { type: 'study', name: 'Hobby room' }] },
    sofa: 'sofa-2', fabric: '#a16207', table: 'dining4', fridge: 'fridge', roof: 'roof-gable', roofOver: { pitch: 28, overhang: 0.5, color: '#7f1d1d', finish: 'clay', gableColor: '#fdf0d5' },
    portico: 'portico', porticoOver: { w: 3.4 }, mainDoorOver: { width: 1.3, color: '#92400e' },
    plot: { gate: 'gate-ped', gateX: 'door', noDrive: true, boundary: 'boundary', boundaryOver: { h: 1.5 },
      garden: [['ramp', 6.9, 17.3, { w: 1.2, d: 3.4 }], ['floor-trap', 16.4, 20.0, { w: 4.4, d: 3.0, z: 0.12, finish: 'pavers' }], ['sitout', 16.4, 20.0, { z: 0.12 }],
        ['septic', 16.0, 1.8], ['coconut', 1.0, 23.0], ['tree', 17.6, 24.0, { w: 3.2, d: 3.2, h: 4.5, variety: 'round' }], ['shrub', 13.6, 16.4], ['pot', 10.8, 17.0], ['flowerbed', 10.0, 22.6, { w: 3.2, d: 0.9 }]] } },
];

// ---------------------------------------------------------------- street, park and community pool
function street(F, objects) {
  F.put('driveway', 51, 0, { w: 132, d: 9, finish: 'asphalt' });
  for (const y of [-5.5, 5.5]) F.put('path', 51, y, { w: 132, d: 2, finish: 'pavers' });
  const gates = objects.filter((o) => o.type === 'gate');
  const clear = (x, side) => gates.every((g) => Math.sign(g.y) !== side || Math.abs(g.x - x) > g.w / 2 + 1.6);
  const spot = (x, side) => { for (let k = 0; k < 12; k++) for (const dx of [k * 0.6, -k * 0.6]) if (clear(x + dx, side)) return x + dx; return null; };
  const avenue = ['gulmohar', 'tree', 'mango', 'gulmohar', 'tree', 'gulmohar', 'mango', 'tree'];
  for (const side of [-1, 1]) {
    for (let x = -10 + (side > 0 ? 8 : 0); x <= 112; x += 16) { const sx = spot(x, side); if (sx != null) F.put('lamp', sx, side * 5.9, { h: 4.2 }); }
    for (let i = 0; i < 8; i++) { const sx = spot(6 + 15 * i + (side > 0 ? 7 : 0), side); if (sx != null && sx < 114) F.put(avenue[(i + (side > 0 ? 3 : 0)) % 8], sx, side * 5.0, { w: 4.5, d: 4.5, h: 6.5 }); }
  }
}
function park(F) {
  // north: the park
  F.put('boundary-rail', 97, -32.2, { w: 30, h: 1.2 });
  for (const x of [82.3, 111.7]) F.put('hedge', x, -19.4, { w: 25.6, rot: 90, h: 1.1 });
  F.put('hedge', 89.2, -6.9, { w: 14.2, h: 0.9 }); F.put('hedge', 104.8, -6.9, { w: 14.2, h: 0.9 });
  F.put('column', 95.5, -7.0, { w: 0.45, d: 0.45, h: 3.2 }); F.put('column', 98.5, -7.0, { w: 0.45, d: 0.45, h: 3.2 });
  F.put('path', 97, -12, { w: 2.4, d: 10, finish: 'flagstone' });
  F.put('floor-skew', 97, -19, { w: 9, d: 5, z: 0.05, skew: 14, finish: 'pavers' });
  F.put('fountain', 97, -19, { w: 2.6, d: 2.6, h: 1.6 });
  F.put('floor-hex', 89, -26, { w: 5.2, d: 4.6, z: 0.15 }); F.put('gazebo', 89, -26, { w: 4.4, d: 4.4, z: 0.15 });
  F.put('path', 97, -27.5, { w: 18, d: 1.6, finish: 'flagstone' });
  for (const [x, y, r] of [[92.4, -16.0, 0], [101.6, -16.0, 0], [92.4, -22.0, 180], [101.6, -22.0, 180]]) F.put('bench', x, y, { rot: r });
  F.put('swing', 106, -26, {}); F.put('sitout', 105.5, -12.5, {}); F.put('charupadi', 88.5, -12.0, {});
  for (const [x, y] of [[86, -10], [108, -10]]) F.put('flowerbed', x, y, { w: 3.6, d: 1.0 });
  F.put('flowerbed-round', 97, -24.2, { w: 2.2, d: 2.2 }); F.put('rocks', 108.5, -20.5); F.put('rocks', 85.5, -20.0);
  for (const [k, x, y] of [['gulmohar', 85.5, -14.5], ['mango', 108.5, -15.0], ['pine', 85.0, -30.0], ['pine', 109.5, -30.0], ['palm', 100.5, -30.0], ['cypress', 94.0, -30.2], ['cypress', 92.0, -30.2], ['bamboo', 110.4, -24.0]]) F.put(k, x, y);
  for (const [x, y] of [[93, -12], [101, -12], [93, -25.5], [101, -25.5]]) F.put('lamp', x, y, { h: 3.2 });
  // south: community pool, club sit-outs and visitor parking
  F.put('boundary-rail', 97, 32.2, { w: 30, h: 1.2 });
  for (const x of [82.3, 111.7]) F.put('boundary-rail', x, 19.4, { w: 25.6, rot: 90, h: 1.2 });
  F.put('floor-round', 90.5, 22, { w: 13, d: 13, finish: 'pavers' });
  F.put('pool', 90.5, 22, { w: 9, d: 4.5 });
  F.put('sitout-sofa', 86.0, 28.0, {}); F.put('sitout-sofa', 95.0, 28.0, {});
  for (const [x, y] of [[85.0, 16.5], [96.0, 16.5]]) F.put('pot-palm', x, y);
  F.put('lawn', 90.5, 11, { w: 14, d: 6 });
  F.put('driveway', 104.5, 15.5, { w: 12.5, d: 16, finish: 'asphalt' });
  F.put('carport', 101.5, 26.5, { w: 3.4, d: 6, carColor: '#0f766e' });
  F.put('car', 105.0, 13.0, { rot: 90, color: '#9ca3af' }); F.put('car', 108.0, 13.0, { rot: 90, color: '#7f1d1d' }); F.put('car', 106.5, 25.5, { rot: 90, color: '#1e3a8a' });
  F.put('lamp', 104.5, 20.0, { h: 4.2 }); F.put('palm', 110.0, 30.0); F.put('palm', 84.0, 30.5);
}

export function township() {
  const objects = [];
  HOUSES.forEach((H0, i) => {
    const H = structuredClone(H0), north = i < 4, col = i % 4;
    const ox = col * 20 + (north ? 0 : 20), oy = north ? -32.5 : 32.5;
    const F = frame(objects, ox, oy, north ? 0 : 180);
    plot(F, H);
  });
  const W = frame(objects, 0, 0, 0);
  park(W); street(W, objects);
  return { version: 1, name: 'Green Meadows township', units: 'm', plinth: PLINTH, plinthFinish: 'laterite', site: 'Green Meadows, Kerala',
    levels: [{ name: 'Ground Floor', height: LH }, { name: 'First Floor', height: LH }], objects };
}

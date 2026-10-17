// The plot (site boundary): a polygon in plan metres with an editable length on every side,
// optional setbacks per side, and the planning numbers people ask about first (area, coverage, FAR).
import { polyArea, pointInPoly, floorPoly } from './catalog.js';

export const CENT = 40.4686; // 1 cent = 1/100 acre, the usual plot unit in Kerala
export const SQFT = 10.7639;

// The plot of a document, upgrading the old free-text "15 × 25 m" field to a real rectangle.
export function plotOf(doc) {
  if (typeof doc.plot === 'string') {
    const nums = doc.plot.match(/[\d.]+/g)?.map(Number).filter((n) => n > 0) || [];
    const note = doc.plot;
    delete doc.plot;
    if (nums.length >= 2) {
      const ft = /ft|feet|'/i.test(note), k = ft ? 0.3048 : 1, b = siteBounds(doc), w = nums[0] * k, d = nums[1] * k;
      const cx = b ? (b.x0 + b.x1) / 2 : w / 2, cy = b ? (b.y0 + b.y1) / 2 : d / 2;
      doc.plot = { pts: rect(cx - w / 2, cy - d / 2, w, d), setbacks: [0, 0, 0, 0] };
    } else if (note.trim()) doc.plotNote = note;
  }
  const p = doc.plot;
  if (!p?.pts || p.pts.length < 3) return null;
  if (!p.setbacks || p.setbacks.length !== p.pts.length) p.setbacks = p.pts.map((_, i) => p.setbacks?.[i] || 0);
  return p;
}
export const rect = (x0, y0, w, d) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]].map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

// Starting shapes, front side at the bottom of the plan; corners A back-left, B back-right, C front-right, D front-left.
//   rect:      width × depth
//   skew:      front width, side length and the inside angle at the front-left corner (a parallelogram)
//   trapezoid: front width, back width and depth (back side centred)
export function shapePlot(kind, { w, d, w2, side, angle }) {
  if (kind === 'skew') {
    const t = ((angle || 90) * Math.PI) / 180, dx = Math.cos(t) * side, dy = Math.sin(t) * side;
    return [[dx, 0], [dx + w, 0], [w, dy], [0, dy]].map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
  }
  if (kind === 'trapezoid') {
    const o = (w - w2) / 2;
    return [[o, 0], [o + w2, 0], [w, d], [0, d]].map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
  }
  return rect(0, 0, w, d);
}

// Everything built on the site, for fitting a plot around it.
export function siteBounds(doc, types) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const o of doc.objects) {
    if (o.level !== 0 || (types && !types.has(o.type))) continue;
    if (o.type === 'wall') { add(o.x1, o.y1); add(o.x2, o.y2); continue; }
    if (!o.w || o.wallId || o.type === 'guide' || o.type === 'dimension') continue;
    const r = ((o.rot || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = (sx * o.w) / 2, ly = (sy * o.d) / 2; add(o.x + lx * c - ly * s, o.y + lx * s + ly * c); }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

// Locks: a whole-plot lock, or a side's length / bearing. An edit that would move a locked side is refused.
export const sideLocked = (p, j) => { const n = p.pts.length, k = ((j % n) + n) % n; return !!(p.lockDims?.['len' + k] || p.lockDims?.['brg' + k]); };
// why an edit can't be made (or null): changing side i's length or bearing moves its end corner, which also moves the next side
export function plotEditBlock(p, what, i) {
  const n = p.pts.length, name = (j) => `${String.fromCharCode(65 + (j % n))}–${String.fromCharCode(65 + ((j + 1) % n))}`;
  if (p.locked) return 'The plot is locked — unlock it first';
  if (what === 'len' && p.lockDims?.['len' + i]) return `The length of ${name(i)} is locked`;
  if (what === 'brg' && p.lockDims?.['brg' + i]) return `The bearing of ${name(i)} is locked`;
  if (what === 'corner') { if (sideLocked(p, i - 1) || sideLocked(p, i)) return `A side meeting corner ${String.fromCharCode(65 + i)} is locked`; return null; }
  if (sideLocked(p, i + 1)) return `Side ${name(i + 1)} is locked, so corner ${String.fromCharCode(65 + ((i + 1) % n))} can't move`;
  return null;
}
export const sideLen = (pts, i) => { const a = pts[i], b = pts[(i + 1) % pts.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };
// Change one side's length: its end corner moves along the side, like the custom floor shapes.
export function setSide(p, i, L) {
  const n = p.pts.length, a = p.pts[i], b = p.pts[(i + 1) % n], cur = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  p.pts[(i + 1) % n] = [+(a[0] + ((b[0] - a[0]) / cur) * L).toFixed(4), +(a[1] + ((b[1] - a[1]) / cur) * L).toFixed(4)];
}
// Direction of a side as a compass bearing (degrees clockwise from north), from its first corner to its second.
export function sideBearing(pts, i, north = 0) {
  const a = pts[i], b = pts[(i + 1) % pts.length];
  return ((((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI - north) % 360) + 360) % 360;
}
// Turn a side to a bearing around its first corner, keeping its length (its second corner moves).
export function setSideBearing(p, i, bearing, north = 0) {
  const n = p.pts.length, a = p.pts[i], L = sideLen(p.pts, i), t = ((bearing + north) * Math.PI) / 180;
  p.pts[(i + 1) % n] = [+(a[0] + Math.sin(t) * L).toFixed(4), +(a[1] - Math.cos(t) * L).toFixed(4)];
}
// Set the inside angle at a corner by turning the side that leaves it (the next corner moves).
export function setCornerAngle(p, i, deg, north = 0) {
  const n = p.pts.length, prev = (i - 1 + n) % n;
  const back = (sideBearing(p.pts, prev, north) + 180) % 360, ccw = signedArea(p.pts) > 0;
  // plan y points down, so a positive signed area means the corners run clockwise on screen
  setSideBearing(p, i, ((back + (ccw ? -deg : deg)) % 360 + 360) % 360, north);
}
const signedArea = (pts) => pts.reduce((s, [x1, y1], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x1 * y2 - x2 * y1; }, 0) / 2;
// Corner angle in degrees (interior).
export function cornerAngle(pts, i) {
  const n = pts.length, p = pts[(i - 1 + n) % n], q = pts[i], r = pts[(i + 1) % n];
  const a1 = Math.atan2(p[1] - q[1], p[0] - q[0]), a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
  let d = Math.abs(((a1 - a2) * 180) / Math.PI) % 360; if (d > 180) d = 360 - d;
  return d;
}
// Which way each side faces on the compass (north = doc.north degrees clockwise from the top of the plan).
export function sideFacing(pts, i, north = 0) {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  let nx = b[1] - a[1], ny = -(b[0] - a[0]);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; } // outward normal
  const bearing = ((((Math.atan2(nx, -ny) * 180) / Math.PI - north) % 360) + 360) % 360;
  return ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'][Math.round(bearing / 45) % 8];
}
// Buildable area: every side moved inward by its setback (intersection of the offset lines).
export function setbackPoly(p) {
  const pts = p.pts, n = pts.length, ccw = signed(pts) > 0 ? 1 : -1;
  if (!p.setbacks.some((v) => v > 0)) return null;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / L) * ccw, ny = ((b[0] - a[0]) / L) * ccw, s = p.setbacks[i] || 0;
    return [[a[0] + nx * s, a[1] + ny * s], [b[0] + nx * s, b[1] + ny * s]];
  });
  return lines.map((l, i) => cross(lines[(i - 1 + n) % n], l) || l[0]);
}
const signed = (pts) => pts.reduce((s, [x1, y1], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x1 * y2 - x2 * y1; }, 0) / 2;
function cross([a, b], [c, d]) {
  const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = d[0] - c[0], d2y = d[1] - c[1], den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * d2y - (c[1] - a[1]) * d2x) / den;
  return [a[0] + d1x * t, a[1] + d1y * t];
}

// Planning numbers: plot area, ground coverage, floor area ratio, and walls outside the setback line.
export function plotStats(doc, p) {
  const area = polyArea(p.pts);
  const slabs = doc.objects.filter((o) => o.type === 'floor' && !o.z && !o.name);
  const level = (l) => slabs.filter((o) => o.level === l).reduce((s, o) => s + polyArea(floorPoly(o)), 0);
  const ground = level(0), total = doc.levels.reduce((s, _, i) => s + level(i), 0);
  const sb = setbackPoly(p), out = [];
  if (sb) for (const w of doc.objects) if (w.type === 'wall' && w.level === 0) for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) if (!pointInPoly(x, y, sb)) { out.push(w.id); break; }
  const offPlot = doc.objects.filter((w) => w.type === 'wall' && w.level === 0 && (!pointInPoly(w.x1, w.y1, p.pts) || !pointInPoly(w.x2, w.y2, p.pts))).length;
  return { area, ground, total, coverage: area ? ground / area : 0, far: area ? total / area : 0, insideSetback: out.length, offPlot };
}

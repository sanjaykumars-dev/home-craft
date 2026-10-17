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
// By default the buildable area is a straight rectangle: the largest one that fits inside every setback,
// squared to one side of the plot (p.setbackAlign, or the side closest to the plan grid). p.setbackMode = 'follow'
// keeps the setback line parallel to every side instead.
export function setbackPoly(p) {
  const follow = followSetback(p);
  if (!follow || p.setbackMode === 'follow') return follow;
  return largestRect(follow, alignSide(p)) || follow;
}
// the side the buildable rectangle is squared to
export function alignSide(p) {
  if (Number.isInteger(p.setbackAlign) && p.setbackAlign < p.pts.length) return p.setbackAlign;
  let best = 0, bd = Infinity;
  p.pts.forEach((a, i) => {
    const b = p.pts[(i + 1) % p.pts.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), off = Math.abs(Math.sin(2 * ang)); // 0 when on the grid
    if (off < bd - 1e-6 || (Math.abs(off - bd) < 1e-6 && sideLen(p.pts, i) > sideLen(p.pts, best))) { bd = off; best = i; }
  });
  return best;
}
// Largest rectangle with one side parallel to side `k` inside a convex polygon.
function largestRect(poly, k) {
  const a = poly[k], b = poly[(k + 1) % poly.length], t = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(t), s = Math.sin(t);
  const loc = poly.map(([x, y]) => [x * c + y * s, -x * s + y * c]); // side k becomes horizontal
  const ys = loc.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // left and right edges of the polygon at height y
  const span = (y) => {
    const xs = [];
    loc.forEach((p0, i) => { const p1 = loc[(i + 1) % loc.length]; if ((p0[1] - y) * (p1[1] - y) <= 0 && p0[1] !== p1[1]) xs.push(p0[0] + ((y - p0[1]) / (p1[1] - p0[1])) * (p1[0] - p0[0])); else if (p0[1] === y) xs.push(p0[0]); });
    return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
  };
  const N = 48, best = { area: 0 };
  for (let i = 0; i <= N; i++) for (let j = i + 1; j <= N; j++) {
    const ya = y0 + ((y1 - y0) * i) / N, yb = y0 + ((y1 - y0) * j) / N, sa = span(ya), sb = span(yb);
    if (!sa || !sb) continue;
    const l = Math.max(sa[0], sb[0]), r = Math.min(sa[1], sb[1]), area = (r - l) * (yb - ya);
    if (r > l && area > best.area) Object.assign(best, { area, l, r, ya, yb });
  }
  if (!best.area) return null;
  // refine around the best pair of heights
  for (let pass = 0, h = (y1 - y0) / N; pass < 3; pass++, h /= 8) {
    const ca = best.ya, cb = best.yb;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const ya = Math.max(y0, ca + (i * h) / 8), yb = Math.min(y1, cb + (j * h) / 8), sa = span(ya), sb = span(yb);
      if (yb <= ya || !sa || !sb) continue;
      const l = Math.max(sa[0], sb[0]), r = Math.min(sa[1], sb[1]), area = (r - l) * (yb - ya);
      if (r > l && area > best.area) Object.assign(best, { area, l, r, ya, yb });
    }
  }
  return [[best.l, best.ya], [best.r, best.ya], [best.r, best.yb], [best.l, best.yb]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
function followSetback(p) {
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

// ---------------------------------------------------------------- survey solver (four-sided plots)
// From the four side lengths, one straight side laid along `dir`, and one more measurement — the inside angle
// at a corner or a diagonal — find the corners. Returns the points in the plot's own corner order, or null when
// the measurements can't close.
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], addv = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
function circles(P, r, Q, s) {
  const d = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  if (d < 1e-9 || d > r + s + 1e-6 || d < Math.abs(r - s) - 1e-6) return [];
  const a = (r * r - s * s + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r * r - a * a)), u = unit(sub(Q, P)), m = addv(P, mul(u, a));
  return [[m[0] - u[1] * h, m[1] + u[0] * h], [m[0] + u[1] * h, m[1] - u[0] * h]];
}
const crosses = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
export function solveQuad(lens, base, dir, known, near) {
  const l = [0, 1, 2, 3].map((j) => lens[(base + j) % 4]), V0 = [0, 0], V1 = mul(unit(dir), l[0]), out = [];
  const tri = (a, b, deg) => Math.sqrt(Math.max(0, a * a + b * b - 2 * a * b * Math.cos((deg * Math.PI) / 180)));
  const push = (V2, V3) => out.push([V0, V1, V2, V3]);
  if (known.kind === 'angle') {
    const j = (known.corner - base + 4) % 4, t = (known.deg * Math.PI) / 180;
    if (j === 1) for (const s of [1, -1]) { const V2 = addv(V1, mul(rot(unit(sub(V0, V1)), s * t), l[1])); for (const V3 of circles(V2, l[2], V0, l[3])) push(V2, V3); }
    if (j === 0) for (const s of [1, -1]) { const V3 = addv(V0, mul(rot(unit(sub(V1, V0)), s * t), l[3])); for (const V2 of circles(V1, l[1], V3, l[2])) push(V2, V3); }
    if (j === 2) { const dg = tri(l[1], l[2], known.deg); for (const V3 of circles(V0, l[3], V1, dg)) for (const V2 of circles(V1, l[1], V3, l[2])) push(V2, V3); }
    if (j === 3) { const dg = tri(l[2], l[3], known.deg); for (const V2 of circles(V1, l[1], V0, dg)) for (const V3 of circles(V2, l[2], V0, l[3])) push(V2, V3); }
  } else {
    const j = (known.from - base + 4) % 4;
    if (j % 2 === 0) { for (const V2 of circles(V1, l[1], V0, known.len)) for (const V3 of circles(V2, l[2], V0, l[3])) push(V2, V3); }
    else for (const V3 of circles(V0, l[3], V1, known.len)) for (const V2 of circles(V1, l[1], V3, l[2])) push(V2, V3);
  }
  // keep simple quadrilaterals that run the same way round as the plot, closest in shape to it now
  const sgn = Math.sign(signedArea(near)), want = near.map((_, i) => cornerAngle(near, i));
  const ok = out.map((q) => { const r = []; q.forEach((p, j) => (r[(base + j) % 4] = p)); return r; })
    .filter((r) => Math.sign(signedArea(r)) === sgn && !crosses(r[0], r[1], r[2], r[3]) && !crosses(r[1], r[2], r[3], r[0]));
  if (!ok.length) return null;
  ok.sort((a, b) => a.reduce((s, _, i) => s + (cornerAngle(a, i) - want[i]) ** 2, 0) - b.reduce((s, _, i) => s + (cornerAngle(b, i) - want[i]) ** 2, 0));
  return ok[0];
}

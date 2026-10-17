// Complete A3 drawing set + construction guide as a PDF: cover, site plan, scaled floor plans,
// centre-line setting-out plan, elevations, 3D views, schedules, quantity estimate and specifications.
import * as THREE from 'three';
import {
  store, levelElev, wallLen, wallAng, wallArc, wallPointAt, wallSamples, openingsOf, wallsOn, fmtLen, fmtArea, openingTags, toUnit, unitLabel, isImperial, FT,
} from './state.js';
import { TYPES, floorPoly, polyArea, labelForObj, stairCheck, objScope } from './catalog.js';

const PAGE = { w: 420, h: 297 };          // A3 landscape, mm
const M = 10;                             // border margin
const TB = 30;                            // title block height
const AREA = { x: M + 5, y: M + 5, w: PAGE.w - 2 * M - 10, h: PAGE.h - 2 * M - TB - 10 };
const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
const PX_PER_MM = 3.7795;                 // CSS px per mm (the plan's text sizes are in CSS px)

// The built-in PDF fonts are Latin-1 only; swap the few typographic characters we use.
const T = (s) => String(s ?? '').replace(/′/g, "'").replace(/″/g, '"').replace(/[—–]/g, '-').replace(/✓/g, 'OK').replace(/⚠/g, '!').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');

let jsPDFCtor = null;
function loadJsPDF() {
  if (jsPDFCtor) return Promise.resolve(jsPDFCtor);
  if (window.jspdf?.jsPDF) return Promise.resolve((jsPDFCtor = window.jspdf.jsPDF));
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => { jsPDFCtor = window.jspdf.jsPDF; resolve(jsPDFCtor); };
    s.onerror = () => reject(new Error('could not load the PDF library from cdnjs (check the internet connection)'));
    document.head.appendChild(s);
  });
}
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function exportDrawingSet({ plan, view, toast, progress }) {
  const JsPDF = await loadJsPDF();
  const doc = store.doc, pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const sheets = [];
  let first = true;
  const ulabel = isImperial() ? 'feet & inches' : { m: 'metres', cm: 'centimetres', mm: 'millimetres' }[doc.units] || 'metres';

  // ---------------------------------------------------------------- page furniture
  function sheet(no, title, scale = 'As shown') {
    if (!first) pdf.addPage('a3', 'landscape');
    first = false;
    sheets.push([no, title]);
    pdf.setDrawColor(30); pdf.setLineWidth(0.6); pdf.rect(M, M, PAGE.w - 2 * M, PAGE.h - 2 * M);
    pdf.setLineWidth(0.3); pdf.rect(M + 2, M + 2, PAGE.w - 2 * M - 4, PAGE.h - 2 * M - 4);
    // title block across the bottom
    const y = PAGE.h - M - 2 - TB, x0 = M + 2, w = PAGE.w - 2 * M - 4;
    pdf.setLineWidth(0.4); pdf.line(x0, y, x0 + w, y);
    const cols = [
      [95, 'PROJECT', doc.name || 'House design', 13],
      [70, 'CLIENT / SITE', [doc.client || '-', doc.site || ''].filter(Boolean).join(' · '), 9],
      [85, 'SHEET TITLE', title, 11],
      [32, 'SCALE (A3)', scale, 10],
      [36, 'UNITS / DATE', `${ulabel}\n${date}`, 8],
      [40, 'DRAWN / CHECKED', 'HomeCraft\nChecked: __________', 8],
    ];
    let x = x0;
    for (const [cw, head, val, fs] of cols) {
      pdf.setFontSize(6.5); pdf.setTextColor(110); pdf.text(T(head), x + 3, y + 5);
      pdf.setFontSize(fs); pdf.setTextColor(20); pdf.setFont('helvetica', 'bold');
      pdf.text(pdf.splitTextToSize(T(val), cw - 6), x + 3, y + 12);
      pdf.setFont('helvetica', 'normal');
      x += cw; pdf.line(x, y, x, y + TB);
    }
    pdf.setFontSize(6.5); pdf.setTextColor(110); pdf.text('SHEET NO.', x + 3, y + 5);
    pdf.setFontSize(20); pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.text(no, x + 3, y + 17); pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5); pdf.setTextColor(120);
    pdf.text(pdf.splitTextToSize('Do not scale - use written dimensions. Verify on site.', x0 + w - x - 5), x + 3, y + 23);
    pdf.setTextColor(0);
  }
  const h1 = (t, x, y, size = 14) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(size); pdf.text(T(t), x, y); pdf.setFont('helvetica', 'normal'); };
  const para = (t, x, y, w, size = 9, gap = 1.25) => { pdf.setFontSize(size); const lines = pdf.splitTextToSize(T(t), w); pdf.text(lines, x, y, { lineHeightFactor: gap }); return y + lines.length * size * 0.3528 * gap; };
  // simple table: rows of strings, column widths in mm; returns the y after the table
  function table(x, y, widths, head, rows, opts = {}) {
    const rh = opts.rh || 5.6, fs = opts.fs || 8;
    const W = widths.reduce((a, b) => a + b, 0);
    pdf.setFillColor(235, 239, 245); pdf.rect(x, y, W, rh, 'F');
    pdf.setFontSize(fs); pdf.setFont('helvetica', 'bold');
    let cx = x;
    head.forEach((c, i) => { pdf.text(T(c), cx + 1.5, y + rh - 1.8); cx += widths[i]; });
    pdf.setFont('helvetica', 'normal');
    let cy = y + rh;
    for (const [ri, r] of rows.entries()) {
      if (opts.maxY && cy + rh > opts.maxY) break;
      if (ri % 2) { pdf.setFillColor(248, 249, 251); pdf.rect(x, cy, W, rh, 'F'); }
      cx = x;
      r.forEach((c, i) => { pdf.text(pdf.splitTextToSize(T(c), widths[i] - 2)[0] || '', cx + 1.5, cy + rh - 1.8); cx += widths[i]; });
      cy += rh;
    }
    pdf.setDrawColor(180); pdf.setLineWidth(0.15); pdf.rect(x, y, W, cy - y);
    cx = x; for (const w of widths.slice(0, -1)) { cx += w; pdf.line(cx, y, cx, cy); }
    pdf.setDrawColor(30);
    return cy;
  }
  function scaleBar(x, y, S) {
    const m = isImperial() ? [1, 2, 5, 10, 20].map((v) => v * FT * 5) : [1, 2, 5, 10, 20];
    const len = m.find((v) => (v * 1000) / S >= 25) || m[m.length - 1], mm = (len * 1000) / S;
    pdf.setLineWidth(0.3);
    for (let i = 0; i < 4; i++) { pdf.setFillColor(i % 2 ? 255 : 30); pdf.rect(x + (i * mm) / 4, y, mm / 4, 1.6, 'FD'); }
    pdf.setFontSize(7); pdf.text('0', x - 0.8, y + 5); pdf.text(T(fmtLen(len)), x + mm - 4, y + 5);
    pdf.text(`SCALE 1:${S}`, x, y - 1.5);
  }
  function northArrow(x, y) {
    pdf.setLineWidth(0.3); pdf.circle(x, y, 6);
    pdf.setFillColor(30); pdf.triangle(x, y - 5, x + 2.6, y + 3, x - 2.6, y + 3, 'F');
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.text('N', x - 1.3, y - 7); pdf.setFont('helvetica', 'normal');
  }
  const pickScale = (wM, hM, wMm, hMm) => SCALES.find((S) => (wM * 1000) / S <= wMm && (hM * 1000) / S <= hMm) || 1000;

  // ---------------------------------------------------------------- geometry helpers
  const boundsOf = (objs) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const o of objs) {
      if (o.type === 'wall' || o.type === 'dimension') { add(o.x1, o.y1); add(o.x2, o.y2); if (o.type === 'wall' && wallArc(o)) for (const [x, y] of wallSamples(o)) add(x, y); continue; }
      if (o.wallId || !o.w) continue;
      const r = ((o.rot || 0) * Math.PI) / 180, ov = o.type === 'roof' ? o.overhang || 0 : 0;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = sx * (o.w / 2 + ov), ly = sy * (o.d / 2 + ov);
        add(o.x + lx * Math.cos(r) - ly * Math.sin(r), o.y + lx * Math.sin(r) + ly * Math.cos(r));
      }
    }
    return x0 === Infinity ? { x0: 0, y0: 0, x1: 10, y1: 10 } : { x0, y0, x1, y1 };
  };
  // Draw the plan of one storey into the drawing area at a standard scale.
  async function planImage(level, objs, filter, area, pad = 3.2) {
    const b = boundsOf(objs), bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
    const S = pickScale(bw, bh, area.w, area.h);
    const wmm = Math.min(area.w, (bw * 1000) / S + 10), hmm = Math.min(area.h, (bh * 1000) / S + 10);
    const cssW = wmm * PX_PER_MM, cssH = hmm * PX_PER_MM, dpr = 2.4;
    const cv = document.createElement('canvas'); cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    const scale = (1000 / S) * PX_PER_MM;          // CSS px per metre
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    plan.renderTo(cv, { level, scale, ox: cssW / 2 - cx * scale, oy: cssH / 2 - cy * scale, width: cssW, height: cssH, filter });
    await tick();
    return { img: cv.toDataURL('image/jpeg', 0.9), wmm, hmm, S };
  }
  const placeImg = (im, area) => {
    const x = area.x + (area.w - im.wmm) / 2, y = area.y + (area.h - im.hmm) / 2;
    pdf.addImage(im.img, 'JPEG', x, y, im.wmm, im.hmm);
    return { x, y };
  };

  // ---------------------------------------------------------------- data for schedules
  const tags = openingTags();
  const objs = doc.objects;
  const walls = objs.filter((o) => o.type === 'wall');
  const ops = objs.filter((o) => o.wallId);
  const rooms = objs.filter((o) => o.type === 'floor' && o.name);
  const levelArea = doc.levels.map((_, i) => objs.filter((o) => o.type === 'floor' && o.level === i && !o.z).reduce((a, o) => a + polyArea(floorPoly(o)), 0));
  const roofObj = objs.find((o) => o.type === 'roof');
  const topH = levelElev(doc.levels.length - 1) + doc.levels[doc.levels.length - 1].height;

  // ---------------------------------------------------------------- A-00 cover
  progress('PDF: cover…');
  sheet('A-00', 'Cover sheet & drawing index', 'NTS');
  view.rebuild();
  const box3 = view.buildingBox(), c3 = box3.getCenter(new THREE.Vector3()), s3 = box3.getSize(new THREE.Vector3());
  const camAt = (dx, dy, dz) => {
    const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 5000);
    const r = Math.max(s3.x, s3.z) * 1.05;
    cam.position.set(c3.x + dx * r, Math.max(2, topH * 0.5) + dy * r, c3.z + dz * r);
    cam.lookAt(c3.x, Math.min(3, topH * 0.4), c3.z);
    return cam;
  };
  view.forceNoRoof = false; view.forceLevel = Infinity; view.rebuild();
  const hero = view.renderImage(1920, 1080, { camera: camAt(0.55, 0.12, 1.15) });
  h1(doc.name || 'House design', AREA.x, AREA.y + 6, 22);
  pdf.setFontSize(11); pdf.setTextColor(90);
  pdf.text(T(`Architectural drawing set & construction guide  ·  ${doc.site || ''}  ·  ${date}`), AREA.x, AREA.y + 13);
  pdf.setTextColor(0);
  pdf.addImage(hero, 'JPEG', AREA.x, AREA.y + 18, 250, 140.6);
  // key data
  const kx = AREA.x + 260, kw = AREA.w - 260;
  h1('Key data', kx, AREA.y + 22, 11);
  const kd = [['Storeys', String(doc.levels.length)], ...doc.levels.map((l, i) => [`${l.name} area`, fmtArea(levelArea[i])]),
    ['Total floor area', fmtArea(levelArea.reduce((a, b) => a + b, 0))], ['Plinth height', fmtLen(doc.plinth || 0)],
    ['Height to top', fmtLen(topH + (roofObj && roofObj.style !== 'flat' ? (roofObj.d / 2) * Math.tan((roofObj.pitch * Math.PI) / 180) : 0))],
    ['Rooms', String(rooms.length)], ['Doors / windows', `${ops.filter((o) => o.type === 'door').length} / ${ops.filter((o) => o.type === 'window').length}`],
    ['Plot', doc.plot || '-'], ['Units', ulabel]];
  table(kx, AREA.y + 25, [kw * 0.55, kw * 0.45], ['Item', 'Value'], kd, { rh: 6.2, fs: 8.5 });
  const idxY = AREA.y + 168;
  h1('Drawing index', AREA.x, idxY, 11);
  // the index is filled in at the end once every sheet exists
  const indexPage = pdf.getNumberOfPages();
  para('How to read these drawings: thick dark bands are walls; arcs show which way doors swing; thin blue triple lines are windows; tags such as D1 / W2 refer to the door & window schedule; dimension lines with ticks give lengths; +0.60 style marks on elevations are heights above ground. All lengths are in ' + ulabel + '. Wall lengths on the floor plans are centre-line lengths unless stated.',
    kx, idxY + 4, kw, 8);
  para('IMPORTANT: this drawing set communicates the design. Structural sizes, foundations and reinforcement given in the specification are typical guidance only and must be checked and signed by a licensed structural engineer, and the plans approved by the local authority (e.g. KMBR / municipal building rules) before construction starts.', kx, idxY + 34, kw, 8);

  // ---------------------------------------------------------------- A-01 site plan
  progress('PDF: site plan…');
  {
    const area = { ...AREA, h: AREA.h - 8 };
    const im = await planImage(0, objs.filter((o) => o.level === 0), null, area, 2);
    sheet('A-01', 'Site plan', `1:${im.S}`);
    const p = placeImg(im, area);
    northArrow(AREA.x + AREA.w - 10, AREA.y + 10);
    scaleBar(AREA.x + 4, AREA.y + AREA.h - 4, im.S);
    pdf.setFontSize(8); pdf.text(T(`Site plan showing the building footprint, portico, gate, boundary, paving and landscape. Ground level ±0.00; finished floor level +${fmtLen(doc.plinth || 0)}.`), AREA.x + 4, AREA.y + 4);
  }

  // ---------------------------------------------------------------- floor plans
  const building = (o) => objScope(o) !== 'outdoor' || ['portico', 'balcony', 'roof', 'chimney', 'cladding', 'louvers', 'frame'].includes(o.type);
  for (const [li, lvl] of doc.levels.entries()) {
    progress(`PDF: ${lvl.name} plan…`);
    const area = { ...AREA, h: AREA.h - 8 };
    const lv = objs.filter((o) => o.level === li && building(o) && o.type !== 'roof');
    const im = await planImage(li, lv, (o) => building(o) && o.type !== 'roof', area);
    sheet(`A-${String(2 + li).padStart(2, '0')}`, `${lvl.name} plan`, `1:${im.S}`);
    placeImg(im, area);
    northArrow(AREA.x + AREA.w - 10, AREA.y + 10);
    scaleBar(AREA.x + 4, AREA.y + AREA.h - 4, im.S);
    pdf.setFontSize(8);
    pdf.text(T(`${lvl.name}: FFL +${fmtLen(levelElev(li))}, floor-to-floor ${fmtLen(lvl.height)}, floor area ${fmtArea(levelArea[li])}. Door/window tags refer to the schedule on sheet S-01.`), AREA.x + 4, AREA.y + 4);
  }

  // ---------------------------------------------------------------- setting-out (centre-line) plan for the mason
  for (const [li, lvl] of doc.levels.entries()) {
    const ws = walls.filter((w) => w.level === li);
    if (!ws.length) continue;
    progress(`PDF: setting-out plan ${li + 1}…`);
    const b = boundsOf(ws), ref = { x: b.x0, y: b.y0 };
    const dw = 245, dh = AREA.h - 14, S = pickScale(b.x1 - b.x0 + 3, b.y1 - b.y0 + 3, dw, dh);
    sheet(`A-${String(10 + li).padStart(2, '0')}`, `${lvl.name} centre-line setting-out plan`, `1:${S}`);
    const ox = AREA.x + 8 + (dw - ((b.x1 - b.x0) * 1000) / S) / 2, oy = AREA.y + 10 + (dh - ((b.y1 - b.y0) * 1000) / S) / 2;
    const X = (x) => ox + ((x - b.x0) * 1000) / S, Y = (y) => oy + ((y - b.y0) * 1000) / S;
    // wall faces (light) and centre lines (dash-dot)
    const poly = (pts) => { for (let i = 0; i < pts.length - 1; i++) pdf.line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1])); };
    for (const w of ws) {
      // faces (grey) and centre line (red dash-dot); curved walls are drawn as true arcs
      pdf.setDrawColor(150); pdf.setLineWidth(0.2);
      for (const s of [1, -1]) poly(wallSamples(w, (s * w.thickness) / 2));
      pdf.setDrawColor(200, 30, 30); pdf.setLineWidth(0.35); pdf.setLineDashPattern([3, 1, 0.6, 1], 0);
      poly(wallSamples(w));
      pdf.setLineDashPattern([], 0);
      const arc = wallArc(w);
      if (arc) {
        // mark the arc centre and a radius line so the curve can be set out with a peg and string
        pdf.setDrawColor(20, 90, 200); pdf.setLineWidth(0.25); pdf.setLineDashPattern([1.2, 1], 0);
        const mid = wallPointAt(w, arc.len / 2);
        pdf.line(X(arc.cx), Y(arc.cy), X(mid.x), Y(mid.y));
        pdf.setLineDashPattern([], 0);
        pdf.line(X(arc.cx) - 2, Y(arc.cy), X(arc.cx) + 2, Y(arc.cy)); pdf.line(X(arc.cx), Y(arc.cy) - 2, X(arc.cx), Y(arc.cy) + 2);
        pdf.setFontSize(6.5); pdf.setTextColor(20, 90, 200); pdf.text(T(`R ${fmtLen(arc.r)}`), X((arc.cx + mid.x) / 2) + 1, Y((arc.cy + mid.y) / 2)); pdf.setTextColor(0);
      }
    }
    pdf.setDrawColor(30);
    ws.forEach((w, i) => {
      const q = wallPointAt(w, wallLen(w) / 2), mx = X(q.x), my = Y(q.y);
      pdf.setFillColor(255); pdf.circle(mx, my, 2.6, 'FD');
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(`W${i + 1}`, mx, my + 0.9, { align: 'center' }); pdf.setFont('helvetica', 'normal');
    });
    // reference point
    pdf.setDrawColor(20, 90, 200); pdf.setLineWidth(0.5);
    pdf.line(X(ref.x) - 5, Y(ref.y), X(ref.x) + 5, Y(ref.y)); pdf.line(X(ref.x), Y(ref.y) - 5, X(ref.x), Y(ref.y) + 5);
    pdf.circle(X(ref.x), Y(ref.y), 2.2);
    pdf.setFontSize(7.5); pdf.setTextColor(20, 90, 200); pdf.text('REF. POINT (0,0)', X(ref.x) + 3, Y(ref.y) - 3); pdf.setTextColor(0); pdf.setDrawColor(30);
    northArrow(AREA.x + 245, AREA.y + 10);
    scaleBar(AREA.x + 4, AREA.y + AREA.h - 4, S);
    pdf.setFontSize(8);
    pdf.text(T('Mark the reference point on site, then measure every wall centre line from it using the table. X runs to the right (east), Y downward on the sheet (south).'), AREA.x + 4, AREA.y + 4);
    if (ws.some((w) => wallArc(w))) pdf.text(T('Curved walls: drive a peg at the listed arc centre and swing a string of length R to mark the centre line between the start and end points.'), AREA.x + 4, AREA.y + 8);
    // coordinates table
    const rows = [];
    ws.forEach((w, i) => {
      const arc = wallArc(w);
      rows.push([`W${i + 1}`, (w.kind === 'interior' ? 'Int.' : 'Ext.') + (arc ? ' arc' : ''), `${fmtLen(w.x1 - ref.x)}, ${fmtLen(w.y1 - ref.y)}`, `${fmtLen(w.x2 - ref.x)}, ${fmtLen(w.y2 - ref.y)}`, fmtLen(wallLen(w)), fmtLen(w.thickness)]);
      if (arc) rows.push(['', '', `centre ${fmtLen(arc.cx - ref.x)}, ${fmtLen(arc.cy - ref.y)}`, `R ${fmtLen(arc.r)}`, `chord ${fmtLen(Math.hypot(w.x2 - w.x1, w.y2 - w.y1))}`, '']);
    });
    h1('Wall setting-out table (centre lines)', AREA.x + 256, AREA.y + 6, 10);
    table(AREA.x + 256, AREA.y + 9, [11, 10, 38, 38, 19, 17], ['ID', 'Type', 'Start (X, Y)', 'End (X, Y)', 'Length', 'Thick'], rows, { rh: 5, fs: 7, maxY: AREA.y + AREA.h });
    if (rows.length > Math.floor((AREA.h - 12) / 5)) para(`(${rows.length - Math.floor((AREA.h - 12) / 5)} more walls — see the JSON project file or split the plan.)`, AREA.x + 256, AREA.y + AREA.h - 2, 130, 7);
  }

  // ---------------------------------------------------------------- elevations
  progress('PDF: elevations…');
  for (const [no, pair] of [['A-20', ['front', 'rear']], ['A-21', ['left', 'right']]]) {
    const halfW = AREA.w / 2 - 4, h = AREA.h - 10;
    const bb = boundsOf(objs.filter((o) => ['wall', 'roof', 'portico', 'balcony'].includes(o.type)));
    const ridge = topH + (roofObj && roofObj.style !== 'flat' ? (Math.min(roofObj.w, roofObj.d) / 2) * Math.tan((roofObj.pitch * Math.PI) / 180) : 0.5);
    // leave room around the building for the level labels and the height dimension chain
    const S = pickScale(Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 1.45 + 7, ridge * 1.3 + 4, halfW, h);
    const shots = [];
    for (const side of pair) {
      const wpx = Math.round(halfW * 6), hpx = Math.round(h * 6);
      shots.push(view.renderImage(wpx, hpx, { elevation: side, metresWide: (halfW * S) / 1000, fs: 11, overlayScale: (6 * 2.6) / 11 }));
      await tick();
    }
    sheet(no, `${pair.map((s) => s[0].toUpperCase() + s.slice(1)).join(' & ')} elevations`, `1:${S}`);
    shots.forEach((img, i) => pdf.addImage(img, 'JPEG', AREA.x + i * (halfW + 8), AREA.y + 4, halfW, h));
    pdf.setDrawColor(200); pdf.line(AREA.x + halfW + 4, AREA.y + 4, AREA.x + halfW + 4, AREA.y + 4 + h); pdf.setDrawColor(30);
    scaleBar(AREA.x + 4, AREA.y + AREA.h - 2, S);
  }

  // ---------------------------------------------------------------- 3D views
  progress('PDF: 3D views…');
  {
    const views = [['Front-right view', camAt(0.75, 0.15, 1.0)], ['Front-left view', camAt(-0.9, 0.2, 0.9)], ['Rear view', camAt(0.5, 0.2, -1.2)], ['Aerial view', camAt(0.6, 1.4, 0.8)]];
    const imgs = [];
    for (const [, cam] of views) { imgs.push(view.renderImage(1600, 900, { camera: cam })); await tick(); }
    sheet('A-30', '3D views', 'NTS');
    const w = AREA.w / 2 - 3, hh = w * 9 / 16;
    imgs.forEach((im, i) => {
      const x = AREA.x + (i % 2) * (w + 6), y = AREA.y + Math.floor(i / 2) * (hh + 8);
      pdf.addImage(im, 'JPEG', x, y, w, hh);
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.text(views[i][0], x, y + hh + 4.5); pdf.setFont('helvetica', 'normal');
    });
  }
  view.forceNoRoof = undefined; view.forceLevel = undefined; view.markDirty();

  // ---------------------------------------------------------------- S-01 schedules
  progress('PDF: schedules…');
  sheet('S-01', 'Door & window schedule, room schedule, area statement', 'NTS');
  {
    const groups = new Map();
    for (const o of ops) {
      const k = tags[o.id];
      const g = groups.get(k) || { o, count: 0, levels: new Set() };
      g.count++; g.levels.add(doc.levels[o.level]?.name || ''); groups.set(k, g);
    }
    const remark = (o) => o.type === 'door' ? ({ single: 'Hinged, wood', double: 'Double leaf', sliding: 'Sliding glazed', garage: 'Sectional garage', arch: 'Open arch' }[o.style] || '') : ({ casement: 'Casement, glazed', sliding: 'Sliding, glazed', picture: 'Fixed glazing', vent: 'Louvred vent', arched: 'Arched top' }[o.style] || '') + (o.shade ? ' + sunshade' : '');
    const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([tag, g]) => [tag, labelForObj(g.o), `${fmtLen(g.o.width)} x ${fmtLen(g.o.height)}`, g.o.type === 'window' ? fmtLen(g.o.sill || 0) : '-', g.o.type === 'window' ? fmtLen((g.o.sill || 0) + g.o.height) : fmtLen(g.o.height), String(g.count), [...g.levels].join(', '), remark(g.o)]);
    h1('Door & window schedule', AREA.x, AREA.y + 4, 11);
    let y = table(AREA.x, AREA.y + 7, [14, 38, 34, 18, 20, 12, 40, 44], ['Tag', 'Type', 'W x H', 'Sill', 'Head', 'Qty', 'Level', 'Remarks'], rows, { maxY: AREA.y + 120 });
    para('Lintels: RCC 150 mm deep over every opening, bearing 150 mm each side. Head heights are measured from finished floor level.', AREA.x, y + 4, 220, 7.5);
    // room schedule
    const rx = AREA.x + 232, rrows = rooms.map((r) => [r.name, doc.levels[r.level]?.name || '', `${fmtLen(r.w)} x ${fmtLen(r.d)}`, fmtArea(polyArea(floorPoly(r))),
      { wood: 'Wooden flooring', tile: 'Vitrified tiles', marble: 'Marble', carpet: 'Carpet', concrete: 'IPS / concrete', deck: 'Timber deck', flagstone: 'Stone' }[r.finish] || r.finish]);
    h1('Room schedule', rx, AREA.y + 4, 11);
    y = table(rx, AREA.y + 7, [38, 28, 34, 22, 36], ['Room', 'Level', 'Size', 'Area', 'Floor finish'], rrows, { maxY: AREA.y + 150 });
    // area statement
    h1('Area statement', AREA.x, AREA.y + 140, 11);
    const fp = boundsOf(walls.filter((w) => w.level === 0 && w.kind !== 'interior'));
    const arows = doc.levels.map((l, i) => {
      const bb = boundsOf(walls.filter((w) => w.level === i && w.kind !== 'interior'));
      const carpet = rooms.filter((r) => r.level === i).reduce((a, r) => a + polyArea(floorPoly(r)), 0);
      return [l.name, fmtArea((bb.x1 - bb.x0) * (bb.y1 - bb.y0)), fmtArea(levelArea[i]), carpet ? fmtArea(carpet) : '-', fmtLen(l.height)];
    });
    arows.push(['TOTAL', '', fmtArea(levelArea.reduce((a, b) => a + b, 0)), '', '']);
    table(AREA.x, AREA.y + 143, [40, 40, 40, 40, 30], ['Floor', 'Built-up (outer)', 'Floor slab area', 'Carpet (rooms)', 'Floor height'], arows);
    para(`Footprint ${fmtLen(fp.x1 - fp.x0)} x ${fmtLen(fp.y1 - fp.y0)}. Built-up area is measured to the outside faces of the external walls; carpet area is the sum of the named rooms.`, AREA.x, AREA.y + 143 + 6 * 5.6 + 6, 220, 7.5);
    // stairs
    const stairs = objs.filter((o) => o.type === 'stairs');
    if (stairs.length) {
      h1('Staircase check', rx, AREA.y + 165, 11);
      table(rx, AREA.y + 168, [40, 118], ['Stair', 'Risers / treads'], stairs.map((s, i) => [`${s.shape || 'straight'} #${i + 1}`, stairCheck(s).text]));
    }
  }

  // ---------------------------------------------------------------- S-02 quantities
  progress('PDF: quantities…');
  sheet('S-02', 'Approximate quantities (for budgeting)', 'NTS');
  {
    const m3 = (v) => `${v.toFixed(2)} m³`, m2 = (v) => `${v.toFixed(1)} m²`;
    const extWalls = walls.filter((w) => w.kind !== 'interior'), intWalls = walls.filter((w) => w.kind === 'interior');
    const runLen = (ws) => ws.reduce((a, w) => a + wallLen(w), 0);
    const opArea = (ws) => ws.reduce((a, w) => a + openingsOf(w.id).reduce((b, o) => b + o.width * o.height, 0), 0);
    const masonry = walls.reduce((a, w) => a + wallLen(w) * w.height * w.thickness, 0) - walls.reduce((a, w) => a + openingsOf(w.id).reduce((b, o) => b + o.width * o.height * w.thickness, 0), 0);
    const gWalls = walls.filter((w) => w.level === 0), fLen = runLen(gWalls);
    const exc = fLen * 0.9 * 1.2, pcc = fLen * 0.9 * 0.1, found = fLen * 0.6 * 1.0, plinthBeam = fLen * 0.23 * 0.2;
    const plinthFill = (doc.plinth || 0) * (levelArea[0] || 0);
    const slabs = levelArea.slice(1).reduce((a, b) => a + b, 0) + objs.filter((o) => o.type === 'roof' && o.style === 'flat').reduce((a, o) => a + o.w * o.d, 0);
    const sloped = objs.filter((o) => o.type === 'roof' && o.style !== 'flat').reduce((a, o) => a + ((o.w + 2 * (o.overhang || 0)) * (o.d + 2 * (o.overhang || 0))) / Math.cos((o.pitch * Math.PI) / 180), 0);
    const extPlaster = runLen(extWalls) * (extWalls[0]?.height || 3) - opArea(extWalls);
    const intPlaster = runLen(extWalls) * (extWalls[0]?.height || 3) + runLen(intWalls) * 2 * (intWalls[0]?.height || 3) - opArea(extWalls) - 2 * opArea(intWalls);
    const lintels = ops.reduce((a, o) => { const w = doc.objects.find((x) => x.id === o.wallId); return a + (o.width + 0.3) * (w?.thickness || 0.23) * 0.15; }, 0);
    const floorBy = {};
    for (const o of objs.filter((x) => x.type === 'floor')) { const k = o.finish; floorBy[k] = (floorBy[k] || 0) + polyArea(floorPoly(o)) * (o.z ? 1 : 0); }
    const baseFloors = objs.filter((x) => x.type === 'floor' && !x.z).reduce((a, o) => a + polyArea(floorPoly(o)), 0);
    const rcc = plinthBeam + slabs * 0.125 + lintels;
    const rows = [
      ['1', 'Earthwork excavation for foundations (0.9 m wide x 1.2 m deep, typical)', m3(exc)],
      ['2', 'PCC 1:4:8 bed under foundations, 100 mm', m3(pcc)],
      ['3', 'Foundation masonry (random rubble / laterite) up to ground level', m3(found)],
      ['4', `Plinth filling with earth / sand (${fmtLen(doc.plinth || 0)} high)`, m3(plinthFill)],
      ['5', 'RCC plinth beam 230 x 200 mm, M20', m3(plinthBeam)],
      ['6', 'Superstructure masonry (net of openings)', m3(masonry)],
      ['', `   ≈ bricks @ 500 / m³  (or laterite blocks @ ~110 / m³)`, `${Math.round(masonry * 500).toLocaleString()} nos`],
      ['7', 'RCC lintels over openings, 150 mm', m3(lintels)],
      ['8', 'RCC floor / roof slabs, 125 mm', `${m3(slabs * 0.125)}  (${m2(slabs)})`],
      ['9', 'Reinforcement steel Fe500 (~90 kg per m³ of RCC)', `${Math.round(rcc * 90).toLocaleString()} kg`],
      ['10', 'Sloped roof covering (on slope)', `${m2(sloped)}  ≈ ${Math.round(sloped * 15)} clay tiles`],
      ['11', 'Internal plastering 12 mm, 1:4', m2(Math.max(0, intPlaster))],
      ['12', 'External plastering 18 mm, 1:4 in two coats', m2(Math.max(0, extPlaster))],
      ['13', 'Painting (2 coats emulsion inside, weatherproof outside)', m2(Math.max(0, intPlaster + extPlaster))],
      ['14', 'Flooring (all floors, base slabs)', m2(baseFloors)],
      ...Object.entries(floorBy).filter(([, v]) => v > 0).map(([k, v]) => ['', `   of which ${k} in named rooms`, m2(v)]),
      ['15', 'Doors / windows (see schedule)', `${ops.filter((o) => o.type === 'door').length} / ${ops.filter((o) => o.type === 'window').length} nos`],
      ['16', 'Cement (approx: 8 bags / m³ RCC, 1.3 bags / m³ masonry, 0.15 bags / m² plaster)',
        `${Math.round(rcc * 8 + masonry * 1.3 + (intPlaster + extPlaster) * 0.15 + pcc * 3.4).toLocaleString()} bags`],
    ];
    h1('Bill of quantities - approximate', AREA.x, AREA.y + 4, 11);
    table(AREA.x, AREA.y + 7, [12, 250, 80], ['No.', 'Item', 'Quantity'], rows, { rh: 6.2, fs: 8.5 });
    para('These are rule-of-thumb quantities derived from the model to help with early budgeting. Wastage, foundations to the actual soil report, electrical, plumbing and finishing items are not included. Get a detailed estimate prepared by a quantity surveyor or engineer before tendering.',
      AREA.x, AREA.y + 7 + (rows.length + 1) * 6.2 + 8, 340, 8);
  }

  // ---------------------------------------------------------------- S-03 specifications
  progress('PDF: specifications…');
  sheet('S-03', 'Construction specifications & guide', 'NTS');
  {
    const ext = walls.find((w) => w.kind !== 'interior'), int = walls.find((w) => w.kind === 'interior');
    const items = [
      ['1. General', `All dimensions are in ${ulabel}. Wall dimensions on plans are centre-line unless noted. Check all dimensions on site; report discrepancies before work starts. Do not scale drawings.`],
      ['2. Site & setting out', 'Clear the site, fix the reference point and level datum (±0.00 = natural ground at the entrance). Set out wall centre lines from sheet A-10 using a measuring tape and builder\'s square; check diagonals of every room for squareness.'],
      ['3. Foundations', 'Depth and type as per soil investigation; typical strip/isolated footings minimum 1.0–1.2 m below ground on firm strata. PCC 1:4:8 levelling course 100 mm under all footings.'],
      ['4. Plinth', `Plinth height ${fmtLen(doc.plinth || 0)} above ground in ${doc.plinthFinish || 'stone'} masonry, capped with an RCC plinth beam 230 x 200 mm (typ. 4 nos 10 mm bars, 8 mm stirrups @ 150 c/c — engineer to confirm). Damp-proof course 40 mm CC 1:2:4 with waterproofing at plinth level. Fill and compact the plinth in 150 mm layers; provide 600 mm wide apron around the building.`],
      ['5. Walls', `External walls ${ext ? fmtLen(ext.thickness) : '230 mm'} in CM 1:6; internal walls ${int ? fmtLen(int.thickness) : '115 mm'} in CM 1:4 with reinforcement every 4th course. Laterite or brick to be well soaked before laying; joints max. 10 mm.`],
      ['6. Lintels & sunshades', 'RCC lintel band 150 mm deep at door-head level (2.1 m above FFL) over all openings; sunshades (chajjas) 600 mm projection where shown, with drip mould.'],
      ['7. RCC', 'Concrete M20 (1:1.5:3) minimum, Fe500 steel. Clear cover: footings 50 mm, columns 40 mm, beams 25 mm, slabs 20 mm. Vibrate all concrete; cure for at least 7 days (14 days for slabs). Column and beam sizes to the structural engineer\'s design.'],
      ['8. Roof', roofObj ? (roofObj.style === 'flat' ? 'RCC roof slab 125–150 mm with 1:100 fall to rain-water outlets; integral waterproofing plus weathering course / membrane; parapet 1.0 m.' : `Pitched roof at ${roofObj.pitch}°, ${roofObj.finish === 'clay' ? 'Mangalore-pattern clay tiles on wooden reepers/rafters or steel purlins over an RCC sloped slab' : roofObj.finish + ' roofing'}; overhang ${fmtLen(roofObj.overhang || 0)} all round to protect the walls; wooden barge boards and fascia treated against termites.`) : 'As per design.'],
      ['9. Stairs', 'Risers 150–190 mm, treads min. 250 mm, waist slab 150 mm RCC; handrail 900 mm high; headroom min. 2.1 m.'],
      ['10. Doors & windows', 'Frames in seasoned hardwood or as scheduled, fixed with holdfasts; main door in teak or equivalent. Windows with 5 mm glass, MS grills where required for security.'],
      ['11. Plastering & painting', 'Internal plaster 12 mm CM 1:4, ceiling 6 mm CM 1:3, external 18–20 mm CM 1:4 in two coats with waterproof compound. Primer + 2 coats emulsion inside, weatherproof exterior emulsion outside.'],
      ['12. Flooring', 'Flooring as per room schedule over 40–50 mm CC bed. Toilets: waterproofing treatment, anti-skid tiles with 1:100 slope to floor trap; dado tiles to 2.1 m.'],
      ['13. Services', 'Plumbing in CPVC/uPVC with concealed lines; overhead tank on roof; septic tank and soak pit at least 15 m from any well. Electrical in concealed conduits with MCB distribution board and earthing; provide rain-water harvesting.'],
      ['14. Approvals & safety', 'Obtain building permit before starting. This set is for design communication — structural design to be verified by a licensed structural engineer. Follow site safety: helmets, scaffolding, no work near live wires.'],
    ];
    let y = AREA.y + 4, col = 0;
    const cw = AREA.w / 2 - 6;
    for (const [head, text] of items) {
      pdf.setFontSize(9);
      const lines = pdf.splitTextToSize(T(text), cw);
      const need = 5 + lines.length * 3.9;
      if (y + need > AREA.y + AREA.h && col === 0) { col = 1; y = AREA.y + 4; }
      const x = AREA.x + col * (cw + 12);
      h1(head, x, y, 9.5);
      pdf.setFontSize(8.6); pdf.text(lines, x, y + 4.5, { lineHeightFactor: 1.3 });
      y += need + 2.5;
    }
  }

  // ---------------------------------------------------------------- drawing index on the cover
  pdf.setPage(indexPage);
  table(AREA.x, idxY + 3, [24, 110], ['Sheet', 'Title'], sheets.map(([n, t]) => [n, t]), { rh: 5.4, fs: 8 });
  pdf.setPage(pdf.getNumberOfPages());

  progress('PDF: saving…');
  const name = `${(doc.name || 'house').replace(/[^\w-]+/g, '_')}_drawings.pdf`;
  pdf.save(name);
  toast(`Drawing set saved: ${name} (${sheets.length} sheets)`);
}

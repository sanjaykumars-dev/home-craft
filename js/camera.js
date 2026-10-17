// 3D camera: frame a shot (aspect, lens, resolution), take snaps into a gallery, and save named views in the project.
import { store, emit, checkpoint } from './state.js';

const DEG = Math.PI / 180;
const ASPECTS = [['view', 'Match the view'], ['16:9', '16:9 wide'], ['3:2', '3:2 photo'], ['4:3', '4:3'], ['1:1', '1:1 square'], ['4:5', '4:5 portrait'], ['9:16', '9:16 phone']];
const QUALITY = [[1280, 'HD · 1280 px'], [1920, 'Full HD · 1920 px'], [2560, '2.5K · 2560 px'], [3840, '4K · 3840 px']];
const PREFS = 'homecraft.camera';

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
// full-frame equivalent focal length for a vertical field of view (24 mm sensor height)
const focal = (fov) => Math.round(12 / Math.tan((fov * DEG) / 2));

export class CameraPanel {
  constructor(view, app) {
    this.view = view; this.app = app; this.snaps = []; this.open = false;
    this.opts = { aspect: '16:9', quality: 1920, format: 'jpeg', grid: true, caption: false };
    try { Object.assign(this.opts, JSON.parse(localStorage.getItem(PREFS) || '{}')); } catch { /* storage unavailable */ }
    this.frameEl = h('div', { class: 'cam-frame', hidden: true }, h('div', { class: 'cam-thirds' }));
    this.flashEl = h('div', { class: 'cam-flash' });
    this.panel = h('div', { class: 'cam-panel', hidden: true });
    view.el.append(this.frameEl, this.flashEl, this.panel);
    new ResizeObserver(() => this.open && this.layoutFrame()).observe(view.el);
  }

  savePrefs() { try { localStorage.setItem(PREFS, JSON.stringify(this.opts)); } catch { /* storage unavailable */ } }
  toggle(force) {
    this.open = force ?? !this.open;
    this.panel.hidden = this.frameEl.hidden = !this.open;
    if (this.open) { this.render(); this.layoutFrame(); }
    this.app.onCameraChange?.(this.open);
  }

  // target aspect (width / height) for the chosen setting
  aspect() {
    const r = this.view.el.getBoundingClientRect(), V = r.width / Math.max(1, r.height);
    if (this.opts.aspect === 'view') return V;
    const [a, b] = this.opts.aspect.split(':').map(Number);
    return a / b;
  }
  // The capture frame drawn over the view: as large as fits, everything outside it is dimmed.
  layoutFrame() {
    const r = this.view.el.getBoundingClientRect(), V = r.width / Math.max(1, r.height), A = this.aspect();
    const w = A > V ? r.width : r.height * A, hgt = A > V ? r.width / A : r.height;
    Object.assign(this.frameEl.style, { width: `${w}px`, height: `${hgt}px`, left: `${(r.width - w) / 2}px`, top: `${(r.height - hgt) / 2}px` });
    this.frameEl.classList.toggle('grid', !!this.opts.grid);
  }

  render() {
    const o = this.opts, v = this.view, cam = v.camera, p = this.panel;
    const sel = (key, list, cast = String) => h('select', { onchange: (e) => { o[key] = cast(e.target.value); this.savePrefs(); this.layoutFrame(); this.render(); } },
      list.map(([val, label]) => h('option', { value: val, selected: String(val) === String(o[key]) }, label)));
    const chk = (key, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!o[key], onchange: (e) => { o[key] = e.target.checked; this.savePrefs(); this.layoutFrame(); } }), label);
    const lensVal = h('span', { class: 'cam-val' }, `${Math.round(cam.fov)}° · ≈${focal(cam.fov)} mm`);
    const lens = h('input', { type: 'range', min: 15, max: 100, step: 1, value: Math.round(cam.fov), disabled: !!v.elev,
      oninput: (e) => { cam.fov = +e.target.value; cam.updateProjectionMatrix(); v.markDirty(); lensVal.textContent = `${cam.fov}° · ≈${focal(cam.fov)} mm`; } });
    const views = store.doc.cameras || [];
    p.innerHTML = '';
    p.append(...[
      h('div', { class: 'cam-h' }, h('b', {}, '📷 Camera'), h('button', { class: 'x', title: 'Close (C)', onclick: () => this.toggle(false) }, '✕')),
      h('div', { class: 'cam-grid' },
        h('label', {}, 'Frame'), sel('aspect', ASPECTS),
        h('label', {}, 'Size'), sel('quality', QUALITY, Number),
        h('label', {}, 'Format'), sel('format', [['jpeg', 'JPG (smaller)'], ['png', 'PNG (lossless)']]),
        h('label', {}, 'Lens'), h('div', { class: 'cam-lens' }, lens, lensVal,
          h('button', { title: 'Back to the standard 50° lens', disabled: !!v.elev, onclick: () => { cam.fov = 50; cam.updateProjectionMatrix(); v.markDirty(); this.render(); } }, 'Reset'))),
      h('div', { class: 'cam-checks' }, chk('grid', 'Thirds grid'), chk('caption', 'Caption with project name')),
      h('div', { class: 'cam-acts' },
        h('button', { class: 'primary cam-shoot', title: 'Take a snap (Enter)', onclick: () => this.capture() }, '📸 Take snap'),
        h('button', { title: 'Remember this camera position in the project', disabled: !!v.elev || !!v.player?.active, onclick: () => this.saveView() }, '＋ Save view')),
      views.length ? h('div', { class: 'cam-sec' }, h('small', {}, 'Saved views'), h('div', { class: 'cam-views' }, views.map((cv, i) =>
        h('span', { class: 'cam-chip' }, h('button', { title: 'Go to this view', onclick: () => this.goTo(cv) }, cv.name),
          h('button', { class: 'del', title: 'Delete this view', onclick: () => { checkpoint(); store.doc.cameras.splice(i, 1); emit('doc'); this.render(); } }, '×'))))) : null,
      this.snaps.length ? h('div', { class: 'cam-sec' },
        h('small', {}, `Snaps (${this.snaps.length}) · kept until you reload`,
          h('button', { class: 'link', onclick: () => this.snaps.forEach((s, i) => setTimeout(() => this.download(s), i * 250)) }, 'Download all')),
        h('div', { class: 'cam-gallery' }, this.snaps.map((s, i) => h('figure', {},
          h('img', { src: s.url, alt: s.name, title: `${s.name} · ${s.w}×${s.h}`, onclick: () => this.preview(s) }),
          h('div', {}, h('button', { title: 'Download', onclick: () => this.download(s) }, '⬇'),
            h('button', { title: 'Remove', onclick: () => { this.snaps.splice(i, 1); this.render(); } }, '✕')))))) : null,
    ].filter(Boolean));
  }

  async capture() {
    const v = this.view, o = this.opts, A = this.aspect();
    const r = v.el.getBoundingClientRect(), V = r.width / Math.max(1, r.height);
    const w = A >= 1 ? o.quality : Math.round(o.quality * A), hgt = A >= 1 ? Math.round(o.quality / A) : o.quality;
    const type = o.format === 'png' ? 'image/png' : 'image/jpeg';
    let url;
    if (v.elev) url = v.renderImage(w, hgt, { elevation: v.elev, type });
    else {
      const src = v.activeCam, cam = src.clone();
      // keep exactly what's inside the frame: a wider frame than the view needs a narrower vertical angle
      if (cam.isPerspectiveCamera && A > V) cam.fov = (2 * Math.atan(Math.tan((src.fov * DEG) / 2) * (V / A))) / DEG;
      url = v.renderImage(w, hgt, { camera: cam, type, quality: 0.93 });
    }
    if (o.caption) url = await this.addCaption(url, w, hgt, type);
    const n = this.snaps.length + 1, base = (store.doc.name || 'house').replace(/[^\w-]+/g, '-').toLowerCase();
    const snap = { url, w, h: hgt, name: `${base}-snap-${String(n).padStart(2, '0')}.${o.format === 'png' ? 'png' : 'jpg'}` };
    this.snaps.unshift(snap);
    this.flashEl.classList.remove('go'); void this.flashEl.offsetWidth; this.flashEl.classList.add('go');
    this.render();
    this.app.toast(`Snap taken · ${w}×${hgt} · click it to view, ⬇ to download`);
    return snap;
  }
  async addCaption(url, w, hgt, type) {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = hgt;
    const x = c.getContext('2d'), s = Math.max(1, w / 1280);
    x.drawImage(img, 0, 0);
    const bar = 46 * s, g = x.createLinearGradient(0, hgt - bar * 1.8, 0, hgt);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = g; x.fillRect(0, hgt - bar * 1.8, w, bar * 1.8);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    x.font = `700 ${20 * s}px Inter, system-ui, sans-serif`;
    x.fillText(store.doc.name || 'My home', 22 * s, hgt - 24 * s);
    x.font = `500 ${13 * s}px Inter, system-ui, sans-serif`; x.textAlign = 'right';
    x.fillText([store.doc.site, new Date().toLocaleDateString()].filter(Boolean).join('  ·  ') + '  ·  HomeCraft', w - 22 * s, hgt - 24 * s);
    return c.toDataURL(type, 0.93);
  }
  download(s) { const a = document.createElement('a'); a.href = s.url; a.download = s.name; a.click(); }
  preview(s) {
    const box = h('div', { class: 'cam-preview', onclick: (e) => { if (e.target === box) box.remove(); } },
      h('img', { src: s.url, alt: s.name }),
      h('div', {}, h('span', {}, `${s.name} · ${s.w}×${s.h}`), h('button', { onclick: () => this.download(s) }, '⬇ Download'), h('button', { onclick: () => box.remove() }, 'Close')));
    (document.fullscreenElement || document.body).append(box);
  }

  saveView() {
    const v = this.view, name = prompt('Name this view', `View ${(store.doc.cameras?.length || 0) + 1}`);
    if (!name) return;
    checkpoint();
    (store.doc.cameras ??= []).push({ name: name.slice(0, 24), pos: v.camera.position.toArray().map((n) => +n.toFixed(3)), target: v.controls.target.toArray().map((n) => +n.toFixed(3)), fov: v.camera.fov });
    emit('doc');
    this.render();
    this.app.toast(`View "${name}" saved in the project`);
  }
  // glide the orbit camera to a saved view
  goTo(cv) {
    const v = this.view;
    if (v.player?.active || v.tour?.active) { this.app.toast('Leave Spectate to jump to a saved view', true); return; }
    if (v.elev) v.setElevation(null);
    if (v.walk) v.setWalk(false);
    const p0 = v.camera.position.clone(), t0 = v.controls.target.clone(), f0 = v.camera.fov, t1 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t1) / 700), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      v.camera.position.set(...p0.toArray().map((a, i) => a + (cv.pos[i] - a) * e));
      v.controls.target.set(...t0.toArray().map((a, i) => a + (cv.target[i] - a) * e));
      v.camera.fov = f0 + ((cv.fov || 50) - f0) * e; v.camera.updateProjectionMatrix();
      v.controls.update(); v.markDirty();
      if (k < 1) requestAnimationFrame(step); else this.render();
    };
    step();
  }
}

// Realistic 3D viewer: sky, sun shadows, PBR materials, orbit + walk-through, direct manipulation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { store, emit, checkpoint, dropIfUnchanged, getObj, levelElev, baseElev, wallLen, projectToSegment, snapVal, fmtLen } from './state.js';
import { buildWall, buildItem, finalizeShadows, buildPlinth } from './builders3d.js';

// Things left out of elevation drawings so the facade reads clearly.
const ELEV_HIDE = new Set(['tree', 'shrub', 'car', 'lamp', 'paving', 'hedge', 'flowerbed', 'pot', 'rocks', 'bench', 'sitout', 'swing', 'fountain', 'boundary', 'gate', 'fence', 'carport', 'pool', 'gazebo', 'pergola', 'well', 'septic', 'tulsi', 'sofa', 'bed', 'table', 'kitchen']);
const ELEV_DIRS = { front: [0, 0, 1], rear: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] };
export const ELEV_NAMES = { front: 'Front elevation', rear: 'Rear elevation', left: 'Left side elevation', right: 'Right side elevation' };
import { texture, setMaxAnisotropy } from './textures.js';

export class View3D {
  constructor(container, app) {
    this.el = container;
    this.app = app;
    this.walk = false;
    this.keys = {};
    this.sunHour = 15.5;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());

    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog('#d5dde4', 160, 700);
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.12; // reflections only; strong env light would wash out the sun shadows

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 6000);
    this.camera.position.set(22, 16, 28);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 400;

    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    Object.assign(this.sky.material.uniforms.turbidity, { value: 4 });
    this.sky.material.uniforms.rayleigh.value = 1.2;
    this.sky.material.uniforms.mieCoefficient.value = 0.004;
    this.sky.material.uniforms.mieDirectionalG.value = 0.85;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#dfeaff', '#5d6b46', 0.9);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff4e2', 3.2));
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 300;
    scene.add(sun, sun.target);

    const grass = texture('grass').clone();
    grass.needsUpdate = true;
    grass.repeat.set(1200 / 3, 1200 / 3);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: grass, roughness: 1, color: '#aab295' }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.ground = true;
    scene.add(ground);
    this.ground = ground;

    this.content = new THREE.Group();
    scene.add(this.content);
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), 0xf59e0b);
    this.selBox.visible = false;
    scene.add(this.selBox);

    this.raycaster = new THREE.Raycaster();
    this.setSun(this.sunHour);
    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.dirty = true;
    this.clock = new THREE.Clock();
    r.setAnimationLoop(() => this.tick());
  }

  // ------------------------------------------------------------ environment
  setSun(hour) {
    this.sunHour = hour;
    const t = (hour - 6) / 13;
    const elev = Math.max(2, 68 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))) * (Math.PI / 180);
    const az = (90 + 180 * t) * (Math.PI / 180);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
    this.sunDir = dir;
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const low = 1 - Math.min(1, Math.sin(elev) / 0.45);
    this.sun.color.setHSL(0.09, 0.4 + 0.5 * low, 0.88 - 0.18 * low);
    this.sun.intensity = 1.2 + 2.2 * (1 - low);
    this.hemi.intensity = 0.4 + 0.45 * (1 - low);
    this.renderer.toneMappingExposure = 0.75 + 0.2 * (1 - low);
    this.updateSunPos();
  }
  updateSunPos() {
    const c = this.focus || new THREE.Vector3();
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 120);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.elev) this.fitElevation(true);
  }
  get activeCam() { return this.elev ? this.ortho : this.camera; }

  // ------------------------------------------------------------ elevations (orthographic, dimensioned)
  buildingBox() {
    const b = new THREE.Box3();
    for (const o of store.doc.objects) {
      if (o.wallId || ELEV_HIDE.has(o.type) || !this.index?.[o.id]) continue;
      b.expandByObject(this.index[o.id]);
    }
    if (b.isEmpty()) b.setFromObject(this.content);
    b.min.y = 0;
    return b;
  }
  setElevation(side) {
    this.elev = side || null;
    if (side) {
      if (this.walk) this.setWalk(false);
      this.savedFog ??= this.scene.fog;
      this.scene.fog = null;
      this.ortho ??= new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 2000);
      this.overlay ??= Object.assign(document.createElement('canvas'), { className: 'elev-overlay' });
      if (!this.overlay.isConnected) this.el.appendChild(this.overlay);
      this.overlay.style.display = 'block';
      this.rebuild();
      this.fitElevation();
      this.controls.object = this.ortho;
      this.controls.enableRotate = false;
    } else {
      if (this.savedFog) this.scene.fog = this.savedFog;
      if (this.overlay) this.overlay.style.display = 'none';
      this.controls.object = this.camera;
      this.controls.enableRotate = true;
      this.rebuild();
      this.frame();
    }
    this.app.onElevationChange?.(side);
  }
  // Frame the building square-on; `keepZoom` preserves the user's pan/zoom after a resize.
  fitElevation(keepZoom = false, aspectOverride, margin = 4) {
    const o = this.ortho, b = this.buildingBox(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const d = new THREE.Vector3(...ELEV_DIRS[this.elev]);
    const aspect = aspectOverride || this.el.clientWidth / Math.max(1, this.el.clientHeight);
    const across = Math.abs(d.x) > 0 ? s.z : s.x;
    const halfH = Math.max(s.y / 2 + margin * 0.7, (across / 2 + margin) / aspect);
    Object.assign(o, { top: halfH, bottom: -halfH, left: -halfH * aspect, right: halfH * aspect });
    if (!keepZoom) {
      o.zoom = 1;
      o.position.copy(c).addScaledVector(d, 300);
      o.position.y = s.y / 2;
      this.controls.target.set(c.x, s.y / 2, c.z);
      o.lookAt(this.controls.target);
    }
    o.updateProjectionMatrix();
    this.elevBox = b;
  }
  drawOverlay(canvas = this.overlay, W = this.el.clientWidth, H = this.el.clientHeight, scale = window.devicePixelRatio || 1, fs = 11) {
    if (!canvas) return;
    canvas.width = W * scale; canvas.height = H * scale;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const b = this.elevBox, cam = this.ortho;
    if (!b) return;
    const P = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H]; };
    const side = this.elev, along = side === 'front' || side === 'rear';
    const c = b.getCenter(new THREE.Vector3());
    const ends = along ? [P(b.min.x, 0, c.z), P(b.max.x, 0, c.z)] : [P(c.x, 0, b.min.z), P(c.x, 0, b.max.z)];
    const xL = Math.min(ends[0][0], ends[1][0]), xR = Math.max(ends[0][0], ends[1][0]), gy = ends[0][1];
    const yAt = (y) => P(c.x, y, c.z)[1];
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    // ground line
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xL - 60, gy); ctx.lineTo(xR + 60, gy); ctx.stroke();
    ctx.lineWidth = 1;
    for (let x = xL - 60; x < xR + 60; x += 10) { ctx.beginPath(); ctx.moveTo(x, gy + 1); ctx.lineTo(x - 6, gy + 8); ctx.stroke(); }
    // level markers on the right, height chain on the left
    const marks = [{ y: 0, label: '±0.00 GROUND LEVEL' }];
    const doc = store.doc;
    if (doc.plinth) marks.push({ y: doc.plinth, label: `+${fmtLen(doc.plinth)} PLINTH / FFL` });
    doc.levels.forEach((l, i) => { if (i > 0) marks.push({ y: levelElev(i), label: `+${fmtLen(levelElev(i))} ${l.name.toUpperCase()} FFL` }); });
    const lastTop = levelElev(doc.levels.length - 1) + doc.levels[doc.levels.length - 1].height;
    marks.push({ y: lastTop, label: `+${fmtLen(lastTop)} TOP OF WALL` });
    if (b.max.y > lastTop + 0.2) marks.push({ y: b.max.y, label: `+${fmtLen(b.max.y)} RIDGE / TOP` });
    const ink = '#1d4ed8';
    for (const m of marks) {
      const y = yAt(m.y);
      ctx.strokeStyle = 'rgba(29,78,216,.55)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xL - 10, y); ctx.lineTo(xR + 30, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(xR + 30, y); ctx.lineTo(xR + 24, y - 8); ctx.lineTo(xR + 36, y - 8); ctx.closePath(); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(m.label, xR + 42, y - 1);
    }
    const sorted = [...marks].sort((a, b2) => a.y - b2.y), dx = xL - 36;
    ctx.strokeStyle = '#334155'; ctx.fillStyle = '#334155'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx, yAt(sorted[0].y)); ctx.lineTo(dx, yAt(sorted[sorted.length - 1].y)); ctx.stroke();
    for (let i = 0; i < sorted.length; i++) {
      const y = yAt(sorted[i].y);
      ctx.beginPath(); ctx.moveTo(dx - 5, y + 5); ctx.lineTo(dx + 5, y - 5); ctx.moveTo(dx - 8, y); ctx.lineTo(dx + 8, y); ctx.stroke();
      if (i > 0) {
        const y0 = yAt(sorted[i - 1].y), v = sorted[i].y - sorted[i - 1].y;
        if (Math.abs(y - y0) > fs * 2.2) {
          ctx.save(); ctx.translate(dx - 6, (y + y0) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(fmtLen(v), 0, 0); ctx.restore();
        }
      }
    }
    // overall width below the ground line
    const wy = gy + 34, width = along ? b.max.x - b.min.x : b.max.z - b.min.z;
    ctx.beginPath(); ctx.moveTo(xL, wy); ctx.lineTo(xR, wy);
    for (const x of [xL, xR]) { ctx.moveTo(x - 5, wy + 5); ctx.lineTo(x + 5, wy - 5); ctx.moveTo(x, gy + 10); ctx.lineTo(x, wy + 6); }
    ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(fmtLen(width), (xL + xR) / 2, wy - 3);
    ctx.font = `700 ${fs + 3}px Inter, system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#111827'; ctx.fillText(ELEV_NAMES[side].toUpperCase(), 14, H - fs * 3.2);
  }

  // Off-screen render (for the PDF): returns a PNG data URL at the requested pixel size.
  renderImage(w, h, { camera, elevation, metresWide, fs = 11, overlayScale = 1 } = {}) {
    const r = this.renderer, oldSize = r.getSize(new THREE.Vector2()), oldPR = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(w, h, false);
    let cam = camera || this.camera, img;
    if (elevation) {
      const was = this.elev;
      this.elev = elevation; this.ortho ??= new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 2000);
      const fog = this.scene.fog; this.scene.fog = null;
      this.rebuild();
      this.fitElevation(false, w / h);
      if (metresWide) { const half = metresWide / 2; Object.assign(this.ortho, { left: -half, right: half, top: (half * h) / w, bottom: (-half * h) / w }); this.ortho.updateProjectionMatrix(); }
      r.render(this.scene, this.ortho);
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const octx = out.getContext('2d'); octx.drawImage(r.domElement, 0, 0, w, h);
      const ov = document.createElement('canvas');
      this.drawOverlay(ov, w / overlayScale, h / overlayScale, overlayScale, fs);
      octx.drawImage(ov, 0, 0, w, h);
      img = out.toDataURL('image/jpeg', 0.92);
      this.scene.fog = fog; this.elev = was;
      this.rebuild(); if (was) this.fitElevation();
    } else {
      if (cam.isPerspectiveCamera) { cam = cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      r.render(this.scene, cam);
      img = r.domElement.toDataURL('image/jpeg', 0.9);
    }
    r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y, false);
    return img;
  }

  // ------------------------------------------------------------ scene building
  rebuild() {
    const doc = store.doc;
    for (const c of [...this.content.children]) {
      this.content.remove(c);
      c.traverse((m) => { if (m.isMesh && !m.geometry.userData?.shared) m.geometry.dispose(); });
    }
    // indoor workspace = doll's-house cut-away: no roof, nothing above the current storey
    const indoor = store.view.scope === 'indoor' && !this.elev;
    const maxLevel = this.forceLevel ?? (store.view.upper && !indoor ? Infinity : store.level);
    const hideRoof = this.forceNoRoof ?? (!store.view.roof || indoor);
    this.index = {};
    for (const o of doc.objects) {
      if (o.wallId || o.hidden) continue;
      if (o.level > maxLevel) continue;
      if (o.type === 'roof' && hideRoof) continue;
      if (this.elev && ELEV_HIDE.has(o.type)) continue;
      const m = o.type === 'wall' ? buildWall(o, doc) : buildItem(o, doc);
      if (!m) continue;
      this.content.add(m);
      this.index[o.id] = m;
    }
    const plinth = buildPlinth(doc);
    if (plinth) this.content.add(plinth);
    finalizeShadows(this.content);
    if (this.elev) this.fitElevation();
    this.player?.collect();
    // keep sun shadow frustum around the model
    const box = new THREE.Box3().setFromObject(this.content);
    if (!box.isEmpty()) {
      this.focus = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()), r = Math.max(20, Math.max(size.x, size.z) * 0.75 + 8);
      const sc = this.sun.shadow.camera;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix();
      this.updateSunPos();
    }
    this.updateSelection();
  }
  updateSelection() {
    const id = store.selectedId;
    let target = id && this.index?.[id];
    if (!target && id) {
      // openings live inside their wall group
      this.content.traverse((m) => { if (!target && m.userData.id === id) target = m; });
    }
    if (target) { this.selBox.box.setFromObject(target); this.selBox.visible = true; }
    else this.selBox.visible = false;
  }
  markDirty() { this.dirty = true; }

  frame() {
    const box = new THREE.Box3().setFromObject(this.content);
    if (box.isEmpty()) { this.controls.target.set(0, 0, 0); this.camera.position.set(20, 15, 25); return; }
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.z, 6);
    this.controls.target.copy(c).setY(Math.min(c.y, 2));
    this.camera.position.set(c.x + r * 0.9, r * 0.75 + 4, c.z + r * 1.2);
    this.controls.update();
  }
  topView() {
    const box = new THREE.Box3().setFromObject(this.content);
    const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const r = box.isEmpty() ? 20 : Math.max(...box.getSize(new THREE.Vector3()).toArray());
    this.setWalk(false);
    this.controls.target.set(c.x, 0, c.z);
    this.camera.position.set(c.x, r * 1.6 + 8, c.z + 0.01);
    this.controls.update();
  }

  // ------------------------------------------------------------ walk mode
  setWalk(on) {
    this.walk = on;
    this.controls.enabled = !on;
    this.el.classList.toggle('walking', on);
    if (on) {
      const t = this.controls.target, p = this.camera.position;
      const eye = levelElev(store.level) + 1.65;
      const dir = new THREE.Vector3(t.x - p.x, 0, t.z - p.z).normalize();
      // start just outside the front of the model, looking at it
      const start = new THREE.Vector3(t.x, eye, t.z).addScaledVector(dir, -Math.min(14, p.distanceTo(t) * 0.6));
      this.camera.position.copy(start);
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = 0;
      this.applyLook();
      this.el.focus();
    } else {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.controls.target.copy(this.camera.position).addScaledVector(fwd, 6);
      this.controls.update();
    }
    this.app.onWalkChange?.(on);
  }
  applyLook() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.el.offsetWidth) return;
    if (this.dirty) { this.dirty = false; this.rebuild(); }
    if (this.player?.active) this.player.update(dt);
    else if (this.tour?.active) this.tour.update(dt);
    else if (this.walk) {
      const k = this.keys, sp = (k.ShiftLeft || k.ShiftRight ? 6 : 2.6) * dt;
      const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      if (f || s) {
        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        this.camera.position.addScaledVector(fwd, f * sp).addScaledVector(right, s * sp);
      }
      if (k.KeyQ) this.camera.position.y -= sp; if (k.KeyE) this.camera.position.y += sp;
    } else this.controls.update();
    this.renderer.render(this.scene, this.activeCam);
    if (this.elev) this.drawOverlay();
  }

  // ------------------------------------------------------------ interaction
  ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  pickId(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.activeCam);
    const hits = this.raycaster.intersectObjects(this.content.children, true);
    for (const h of hits) {
      let m = h.object;
      while (m && !m.userData.id) m = m.parent;
      if (m) return { id: m.userData.id, point: h.point };
    }
    return null;
  }
  groundPoint(e, y = 0) {
    this.raycaster.setFromCamera(this.ndc(e), this.activeCam);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }

  bindEvents() {
    const el = this.renderer.domElement;
    this.el.tabIndex = 0;
    // capture phase so we run before OrbitControls and can take over drags
    this.el.addEventListener('pointerdown', (e) => {
      if (this.player?.active || this.tour?.active) return; // the character controller owns the mouse
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.walk) { this.look = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; return; }
      if (e.button !== 0) return;
      if (store.tool === 'place' && store.armed) {
        const p = this.groundPoint(e, levelElev(store.level));
        if (p) this.app.placeAt(store.armed, snapVal(p.x), snapVal(p.z));
        e.stopPropagation();
        return;
      }
      const hit = this.pickId(e);
      const o = hit && getObj(hit.id);
      if (o && !o.locked && o.id === store.selectedId && o.level === store.level) {
        const base = o.type === 'wall' || o.wallId ? levelElev(o.level) : baseElev(o);
        const gp = this.groundPoint(e, base);
        if (!gp) return;
        checkpoint();
        this.controls.enabled = false;
        this.drag = { o, start: gp, base, orig: { ...o } };
        el.setPointerCapture(e.pointerId);
        e.stopPropagation();
      }
    }, true);
    this.el.addEventListener('pointermove', (e) => {
      if (this.walk && this.look) {
        this.yaw = this.look.yaw - (e.clientX - this.look.x) * 0.004;
        this.pitch = Math.max(-1.3, Math.min(1.3, this.look.pitch - (e.clientY - this.look.y) * 0.004));
        this.applyLook();
        return;
      }
      if (!this.drag) return;
      const gp = this.groundPoint(e, this.drag.base);
      if (!gp) return;
      const { o, orig, start } = this.drag;
      let dx = gp.x - start.x, dz = gp.z - start.z;
      if (store.view.snap && !e.shiftKey) { dx = snapVal(dx); dz = snapVal(dz); }
      if (o.type === 'wall') Object.assign(o, { x1: orig.x1 + dx, y1: orig.y1 + dz, x2: orig.x2 + dx, y2: orig.y2 + dz });
      else if (o.wallId) {
        const w = getObj(o.wallId);
        if (w) {
          const pr = projectToSegment(gp.x, gp.z, w.x1, w.y1, w.x2, w.y2), L = wallLen(w);
          o.t = Math.max(o.width / 2, Math.min(L - o.width / 2, snapVal(pr.t * L, 0.05)));
        }
      } else { o.x = orig.x + dx; o.y = orig.y + dz; }
      emit('doc');
    });
    const up = (e) => {
      if (this.player?.active || this.tour?.active) return;
      this.look = null;
      if (this.drag) {
        this.drag = null;
        this.controls.enabled = !this.walk;
        dropIfUnchanged();
        emit('doc');
        return;
      }
      if (!this.down || this.walk) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved < 5 && e.button === 0 && store.tool !== 'place') {
        const hit = this.pickId(e);
        const o = hit && getObj(hit.id);
        if (o && o.level !== store.level) { store.level = o.level; emit('level'); }
        this.app.select(o ? o.id : null);
      }
    };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('dblclick', (e) => {
      if (this.walk) return;
      const hit = this.pickId(e);
      if (hit) { this.controls.target.copy(hit.point); this.controls.update(); }
    });
    this.el.addEventListener('keydown', (e) => { if (this.walk) { this.keys[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); } });
    this.el.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.el.addEventListener('blur', () => { this.keys = {}; });
    this.el.addEventListener('dragover', (e) => { if (store.dragKey) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      const key = store.dragKey || e.dataTransfer.getData('text/plain');
      store.dragKey = null;
      const p = this.groundPoint(e, levelElev(store.level));
      if (key && p) this.app.placeAt(key, snapVal(p.x), snapVal(p.z));
    });
  }

  snapshot() { this.renderer.render(this.scene, this.activeCam); return this.renderer.domElement.toDataURL('image/png'); }
}

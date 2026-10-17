// Playable third-person character for Spectate.
//
// Physics model (all SI units):
//   • Body: a vertical capsule, radius 0.25 m, height 1.75 m (eye height 1.62 m).
//   • Walking 1.4 m/s, running 3.6 m/s (hold Shift), backwards at 55 %. Acceleration 12 m/s².
//   • Steering: A/D turn the body at 2.4 rad/s (or drag the mouse); W/S move along the facing direction;
//     Q/E side-step. The camera always looks the way the character's face points (V: first person).
//   • Gravity 9.81 m/s² downward; terminal fall speed 20 m/s.
//   • Jump: take-off speed 4.2 m/s (≈ 0.9 m clear jump), only when standing on something.
//   • Step-up: the feet automatically climb any edge up to 0.35 m — that is how stairs, kerbs and the plinth
//     steps are climbed; anything taller blocks you like a wall.
//   • Walkable ground: surfaces whose normal points up at least 50° from horizontal (≤ 40° slope).
//   • Solid: walls, windows, railings, columns, furniture, pillars, tree trunks, boundary walls, cars…
//     Passable: open doorways and door leaves (you "open" doors as you walk through), leaves and flowers, rugs, water.
//   • Collision: rays at knee, waist and head height in eight directions push the capsule out of anything
//     closer than its radius, and movement into a surface is projected along it so you slide along walls.
//   • Doors start closed. Each hinged leaf is a rigid panel turning on its hinge: when the character walks
//     into it, the push becomes angular velocity (the contact point must move away at least as fast as the
//     character), hinge friction slows it (2.2 /s), a stop limits it to ±100°, and after 2.5 s without contact
//     a door-closer spring swings it gently shut and latches it. The character is slowed while pushing.
//     Sliding doors glide open when you come within 1.4 m and close again behind you.
import * as THREE from 'three';
import { store, levelElev } from './state.js';
import { floorPoly, pointInPoly } from './catalog.js';
import { makeCharacter, preloadCharacter } from './character.js';

export const PHYSICS = {
  radius: 0.25, height: 1.75, eye: 1.62,
  walk: 1.4, run: 3.6, accel: 12,
  gravity: 9.81, jump: 4.2, maxFall: 20,
  stepUp: 0.35, maxSlopeNormalY: 0.64,
  turnRate: 2.4, backFactor: 0.55,
  doorMax: 1.75, doorFriction: 2.2, doorCloser: 1.6, doorCloserDelay: 2.5, doorPushDrag: 2.5,
  slideSpeed: 0.9, slideSense: 1.4,
};

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const DIRS8 = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 4), 0, Math.sin((i * Math.PI) / 4)));

export class Player {
  constructor(view, app) {
    this.view = view; this.app = app;
    this.active = false;
    this.pos = new THREE.Vector3();        // feet position
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.yaw = 0; this.pitch = 0.18; this.dist = 3.4; this.facing = 0;
    this.keys = {};
    this.ray = new THREE.Raycaster();
    this.solids = [];
    this.onKey = (e) => {
      if (!this.active || e.target.tagName === 'INPUT') return;
      const down = e.type === 'keydown';
      this.keys[e.code] = down;
      if (down && e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (down && e.code === 'Escape') this.stop();
      if (down && e.code === 'KeyV') { this.firstPerson = !this.firstPerson; this.app.onViewModeChange?.(this.firstPerson); }
      if (/^Arrow|^Space/.test(e.code)) e.preventDefault();
    };
    this.onDown = (e) => { if (this.active) { this.drag = { x: e.clientX, y: e.clientY, facing: this.facing, pitch: this.pitch }; view.el.focus(); } };
    this.onMove = (e) => {
      if (!this.active || !this.drag) return;
      this.facing = this.drag.facing - (e.clientX - this.drag.x) * 0.006;
      this.pitch = Math.max(-0.5, Math.min(1.2, this.drag.pitch + (e.clientY - this.drag.y) * 0.005));
    };
    this.onUp = () => { this.drag = null; };
    this.onWheel = (e) => { if (this.active) { e.preventDefault(); this.dist = Math.max(1.2, Math.min(8, this.dist * Math.exp(e.deltaY * 0.001))); } };
  }

  // Meshes the character can collide with (rebuilt whenever the model changes).
  collect() {
    this.solids = []; this.camSolids = [];
    this.view.content.updateMatrixWorld(true);
    this.view.content.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh) return;
      let p = m, pass = false;
      while (p && p !== this.view.content) { if (p.userData.passable) { pass = p.userData.passable; break; } p = p.parent; }
      if (!pass) this.solids.push(m);
      if (!pass || pass === 'door') this.camSolids.push(m); // doors and glass still stop the camera
    });
    // moving door parts; their state survives rebuilds, and every door starts closed
    const prev = new Map((this.doors || []).map((d) => [d.key, d]));
    this.doors = []; this.sliders = []; this.panels = [];
    this.view.content.traverse((o) => {
      const L = o.userData.doorLeaf, S = o.userData.slideDoor, F = o.userData.fixedPanel;
      if (L) {
        const key = `${L.id}:${L.e}`, old = prev.get(key);
        const d = { key, pivot: o, e: L.e, lw: L.lw, h: L.h, angle: old?.angle ?? 0, omega: old?.omega ?? 0, idle: 99,
          hinge: o.getWorldPosition(new THREE.Vector3()), frame: o.parent.getWorldQuaternion(new THREE.Quaternion()) };
        o.rotation.y = d.angle;
        this.doors.push(d);
      }
      if (S) { o.position.x = 0; this.sliders.push({ g: o, ...S, off: 0, idle: 99 }); }
      if (F) this.panels.push({ g: o, ...F });
    });
  }

  async start(spawn) {
    const v = this.view;
    if (this.starting) return;
    // wait for the real figure; the simple one is only a fallback if it can't be loaded
    if (!this.body) { this.starting = true; this.body = (await preloadCharacter()) || makeCharacter(); this.starting = false; }
    if (v.elev) v.setElevation(null);
    if (v.walk) v.setWalk(false);
    v.tour?.active && v.tour.stop();
    this.saved = { pos: v.camera.position.clone(), target: v.controls.target.clone() };
    v.controls.enabled = false;
    v.scene.add(this.body);
    this.body.visible = true;
    v.forceNoRoof = undefined; v.forceLevel = undefined;
    v.rebuild();
    this.collect();
    this.pos.copy(spawn.pos); this.vel.set(0, 0, 0);
    // spawn.yaw uses the old camera convention (0 = looking toward −z); facing is the body's heading (0 = +z)
    this.facing = spawn.yaw + Math.PI; this.camYaw = this.facing; this.pitch = 0.22;
    this.pos.y = this.groundAt(this.pos, 50)?.y ?? spawn.pos.y;
    this.active = true;
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    v.el.addEventListener('pointerdown', this.onDown); window.addEventListener('pointermove', this.onMove); window.addEventListener('pointerup', this.onUp);
    v.el.addEventListener('wheel', this.onWheel, { passive: false });
    v.el.classList.add('playing');
    v.el.focus();
    this.app.onPlayerChange?.(true);
  }
  stop() {
    if (!this.active) return;
    const v = this.view;
    this.active = false; this.keys = {};
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    v.el.removeEventListener('pointerdown', this.onDown); window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp);
    v.el.removeEventListener('wheel', this.onWheel);
    v.scene.remove(this.body);
    v.el.classList.remove('playing');
    v.markDirty(); // put the doors back to their designed positions
    v.controls.enabled = true;
    if (this.saved) { v.camera.position.copy(this.saved.pos); v.controls.target.copy(this.saved.target); }
    this.app.onPlayerChange?.(false);
  }

  // Highest walkable surface under the capsule (searching from just above the step-up height).
  groundAt(p, from = PHYSICS.stepUp + 0.05) {
    let best = null;
    const offs = [[0, 0], [0.16, 0], [-0.16, 0], [0, 0.16], [0, -0.16]];
    for (const [dx, dz] of offs) {
      this.ray.set(new THREE.Vector3(p.x + dx, p.y + from, p.z + dz), DOWN);
      this.ray.far = from + 3;
      for (const h of this.ray.intersectObjects(this.solids, false)) {
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (n.y < PHYSICS.maxSlopeNormalY) continue; // too steep to stand on
        if (!best || h.point.y > best.y) best = h.point.clone();
        break;
      }
    }
    // natural ground
    if (!best || best.y < 0) best = new THREE.Vector3(p.x, Math.max(0, best?.y ?? 0), p.z);
    return best;
  }

  // Push the capsule out of nearby solids at knee, waist and head height.
  depenetrate() {
    const r = PHYSICS.radius;
    for (const h of [PHYSICS.stepUp + 0.08, 0.95, 1.55]) {
      for (const d of DIRS8) {
        this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + h, this.pos.z), d);
        this.ray.far = r;
        const hit = this.ray.intersectObjects(this.solids, false)[0];
        if (!hit) continue;
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        if (Math.abs(n.y) > 0.7) continue; // floors/ceilings are handled by the ground logic
        this.pos.addScaledVector(d, -(r - hit.distance));
      }
    }
  }

  // Remove the part of the move that would go into a wall, so the character slides along it.
  slide(move) {
    const r = PHYSICS.radius, len = move.length();
    if (len < 1e-6) return move;
    for (let iter = 0; iter < 3; iter++) {
      const dir = move.clone().normalize();
      let blocked = false;
      for (const h of [PHYSICS.stepUp + 0.08, 0.95, 1.55]) {
        this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + h, this.pos.z), dir);
        this.ray.far = r + move.length();
        const hit = this.ray.intersectObjects(this.solids, false)[0];
        if (!hit) continue;
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).setY(0);
        if (n.lengthSq() < 0.25) continue;
        n.normalize();
        const into = move.dot(n);
        if (into < 0) { move.addScaledVector(n, -into); blocked = true; }
      }
      if (!blocked) break;
    }
    return move;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    const P = PHYSICS, k = this.keys, v = this.view;
    // ---- input: A/D turn the character, W/S walk along where he faces, Q/E side-step
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const turn = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
    const strafe = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0);
    this.facing += turn * P.turnRate * dt;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), right = new THREE.Vector3(-Math.cos(this.facing), 0, Math.sin(this.facing));
    const wish = fwd.clone().multiplyScalar(f > 0 ? 1 : f < 0 ? -P.backFactor : 0).addScaledVector(right, strafe * 0.7);
    const speed = k.ShiftLeft || k.ShiftRight ? P.run : P.walk;
    if (wish.lengthSq() > 0) wish.multiplyScalar(speed / Math.max(1, wish.length()));
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const dv = wish.clone().sub(hv), maxDv = P.accel * dt * (this.grounded ? 1 : 0.35);
    if (dv.length() > maxDv) dv.setLength(maxDv);
    hv.add(dv);
    this.vel.x = hv.x; this.vel.z = hv.z;

    // ---- vertical: gravity and jumping
    if (this.jumpQueued && this.grounded) { this.vel.y = P.jump; this.grounded = false; }
    this.jumpQueued = false;
    this.vel.y = Math.max(-P.maxFall, this.vel.y - P.gravity * dt);

    // ---- horizontal move with sliding collision
    const move = this.slide(new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt));
    this.pos.add(move);
    this.depenetrate();
    this.simulateDoors(dt);

    // ---- ground: step up onto stairs/kerbs, fall otherwise
    this.pos.y += this.vel.y * dt;
    const g = this.groundAt(this.pos);
    if (this.pos.y <= g.y + 0.001 && this.vel.y <= 0) {
      const rise = g.y - this.pos.y;
      // smooth the step-up so climbing stairs does not jitter
      this.pos.y = rise > 0.02 ? this.pos.y + Math.min(rise, Math.max(0.05, rise * 0.5)) : g.y;
      if (this.pos.y > g.y) this.pos.y = g.y;
      this.vel.y = 0; this.grounded = true;
    } else if (this.grounded && this.pos.y - g.y < P.stepUp && this.vel.y <= 0) {
      // walking down stairs: stick to the next tread instead of hopping off it
      this.pos.y = g.y; this.vel.y = 0;
    } else this.grounded = false;
    if (this.pos.y < -5) { this.pos.y = 0.5; this.vel.set(0, 0, 0); }

    // ---- animate the body: it always faces its heading; walking backwards plays the cycle in reverse
    const b = this.body, hs = Math.hypot(this.vel.x, this.vel.z), along = this.vel.x * fwd.x + this.vel.z * fwd.z;
    b.rotation.y = this.facing;
    b.userData.animate(dt, { speed: hs, grounded: this.grounded, firstPerson: this.firstPerson, reverse: along < -0.05 });
    b.position.copy(this.pos);
    if (this.grounded) b.position.y += b.userData.bob || 0;

    // ---- camera looks where the character's face points
    // the camera heading eases toward the body's heading so turns feel smooth, never lagging more than ~25°
    let dyaw = this.facing - this.camYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.camYaw += dyaw * Math.min(1, dt * 7);
    dyaw = Math.atan2(Math.sin(this.facing - this.camYaw), Math.cos(this.facing - this.camYaw));
    if (Math.abs(dyaw) > 0.45) this.camYaw = this.facing - Math.sign(dyaw) * 0.45;
    const look = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.camYaw) * Math.cos(this.pitch));
    const eyeH = b.userData.height ? b.userData.height * 0.92 : P.eye; // small or tall avatars get a matching eye level
    const eyeY = this.pos.y + eyeH + (this.grounded ? b.userData.bob || 0 : 0);
    if (this.firstPerson) {
      // first person: from the eyes, looking straight ahead (pitch from mouse drag)
      const eye = new THREE.Vector3(this.pos.x, eyeY, this.pos.z).addScaledVector(fwd, 0.1);
      v.camera.position.copy(eye);
      v.camera.lookAt(eye.clone().add(look));
      v.controls.target.copy(eye.clone().add(look));
    } else {
      // over the shoulder: behind and slightly above the head, looking past it in the facing direction
      const head = new THREE.Vector3(this.pos.x, eyeY, this.pos.z);
      const back = new THREE.Vector3(-look.x, Math.sin(this.pitch) * 0.9 + 0.12, -look.z).normalize();
      this.ray.set(head, back); this.ray.far = this.dist;
      const hit = this.ray.intersectObjects(this.camSolids, false)[0];
      const d = hit ? Math.max(0.35, hit.distance - 0.2) : this.dist;
      v.camera.position.lerp(head.clone().addScaledVector(back, d), Math.min(1, dt * 12));
      const target = head.clone().addScaledVector(look, 3).add(new THREE.Vector3(0, -0.15, 0));
      v.camera.lookAt(target);
      v.controls.target.copy(target);
    }
    this.app.onPlayerTick?.(this);
  }

  // Push-out from a thin vertical panel between a and b (world xz); returns the contact or null.
  panelContact(a, b, y0, h, thick = 0.03) {
    if (this.pos.y + 1.6 < y0 || this.pos.y > y0 + h) return null;
    const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz || 1e-9;
    let u = ((this.pos.x - a.x) * abx + (this.pos.z - a.z) * abz) / L2; u = Math.max(0, Math.min(1, u));
    const cx = a.x + abx * u, cz = a.z + abz * u, dx = this.pos.x - cx, dz = this.pos.z - cz, d = Math.hypot(dx, dz), r = PHYSICS.radius + thick;
    if (d >= r) return null;
    const n = d > 1e-5 ? new THREE.Vector3(dx / d, 0, dz / d) : new THREE.Vector3(-abz, 0, abx).normalize();
    this.pos.addScaledVector(n, r - d); // panels are solid
    return { n, u };
  }

  simulateDoors(dt) {
    const P = PHYSICS;
    for (const d of this.doors) {
      // the leaf runs from the hinge along ±x of its pivot, turned by the current angle
      const dir = new THREE.Vector3(d.e, 0, 0).applyAxisAngle(UP, d.angle).applyQuaternion(d.frame).setY(0).normalize();
      const end = d.hinge.clone().addScaledVector(dir, d.lw);
      const c = this.panelContact(d.hinge, end, d.hinge.y, d.h);
      if (c) {
        d.idle = 0;
        const vin = -(this.vel.x * c.n.x + this.vel.z * c.n.z); // how hard we walk into the leaf
        if (vin > 0.05) {
          // a positive angle moves leaf points along m; push direction is −n
          const m = new THREE.Vector3(dir.z, 0, -dir.x), sign = Math.sign(-(m.x * c.n.x + m.z * c.n.z)) || 1;
          const lever = Math.max(0.15, c.u * d.lw), want = (sign * (vin * 1.15 + 0.15)) / lever;
          if (sign * d.omega < sign * want) d.omega += (want - d.omega) * Math.min(1, dt * 18);
          const drag = Math.max(0, 1 - P.doorPushDrag * dt);
          this.vel.x *= drag; this.vel.z *= drag;
        }
      } else d.idle += dt;
      if (d.idle > P.doorCloserDelay) d.omega -= P.doorCloser * d.angle * dt; // door closer
      d.omega *= Math.exp(-P.doorFriction * dt);
      d.angle += d.omega * dt;
      if (Math.abs(d.angle) > P.doorMax) { d.angle = Math.sign(d.angle) * P.doorMax; d.omega *= -0.25; } // door stop
      if (d.idle > P.doorCloserDelay && Math.abs(d.angle) < 0.02 && Math.abs(d.omega) < 0.3) { d.angle = 0; d.omega = 0; } // latch
      d.pivot.rotation.y = d.angle;
    }
    for (const s of this.sliders) {
      const g = s.g, parent = g.parent, near = (() => {
        const mid = parent.localToWorld(new THREE.Vector3((s.x0 + s.x1) / 2, 0, s.z));
        return Math.hypot(this.pos.x - mid.x, this.pos.z - mid.z) < P.slideSense && Math.abs(this.pos.y - mid.y) < 1.5;
      })();
      s.idle = near ? 0 : s.idle + dt;
      const target = near || s.idle < 1.5 ? s.travel : 0;
      s.off += Math.sign(target - s.off) * Math.min(Math.abs(target - s.off), P.slideSpeed * dt * (0.4 + Math.min(1, Math.abs(target - s.off) * 3)));
      g.position.x = s.off;
      const a = parent.localToWorld(new THREE.Vector3(s.x0 + s.off, 0, s.z)), b = parent.localToWorld(new THREE.Vector3(s.x1 + s.off, 0, s.z));
      this.panelContact(a, b, a.y, s.h, 0.02);
    }
    for (const f of this.panels) {
      const a = f.g.parent.localToWorld(new THREE.Vector3(f.x0, 0, f.z)), b = f.g.parent.localToWorld(new THREE.Vector3(f.x1, 0, f.z));
      this.panelContact(a, b, a.y, f.h, 0.02);
    }
  }

  // Where the character is: storey and room name (for the HUD).
  whereAmI() {
    const doc = store.doc;
    let level = 0;
    doc.levels.forEach((_, i) => { if (this.pos.y >= levelElev(i) - 0.3) level = i; });
    const room = doc.objects.find((o) => o.type === 'floor' && o.name && o.level === level && (() => {
      const r = -(o.rot || 0) * Math.PI / 180, dx = this.pos.x - o.x, dy = this.pos.z - o.y;
      return pointInPoly(dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r), floorPoly(o));
    })());
    const inside = !!room || doc.objects.some((o) => o.type === 'floor' && o.level === level && !o.z && Math.abs(this.pos.x - o.x) < o.w / 2 && Math.abs(this.pos.z - o.y) < o.d / 2);
    return { level: doc.levels[level]?.name, room: room?.name || (inside ? 'Inside' : 'Outside') };
  }
}

// "Spectate": a guided, narrated walkthrough of the whole house, the way an engineer would present it to a client.
import * as THREE from 'three';
import { store, levelElev, wallsOn, openingsOf, wallLen, wallAng, levelCentroid, outwardSign, fmtLen, fmtArea, getObj, baseElev } from './state.js';
import { floorPoly, polyArea, stairCheck, labelForObj } from './catalog.js';
import { makeCharacter, preloadCharacter } from './character.js';

const $ = (s) => document.querySelector(s);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const DIRS = ['north', 'east', 'south', 'west'];
// plan north is −y; compass direction a wall faces from its outward normal
const facing = (nx, ny) => DIRS[((Math.round(Math.atan2(nx, -ny) / (Math.PI / 2)) % 4) + 4) % 4];
const LIGHT = {
  north: 'soft, even daylight with no harsh glare',
  east: 'pleasant morning sun',
  south: 'strong daylight through the day — the overhangs and sunshades keep the glare down',
  west: 'warm evening sun — curtains or the sunshade help in the hot afternoons',
};
const list = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// Room descriptions keyed by words in the room name.
const ROOM_TALK = [
  [/pooja|prayer|mandir/i, (r) => `This is the pooja room. It is kept small and calm, finished in ${r.finish} that is easy to keep clean, with a double door so the shrine can be opened to the house during prayers.${r.dirNote} Traditionally the north-east corner is preferred for prayer spaces.`],
  [/toilet|bath|wc/i, (r) => `Here is the ${r.name.toLowerCase()}. The floor uses anti-skid ceramic tiles laid with a 1-in-100 fall towards the floor trap, and the walls are tiled to about 2.1 metres. ${r.vent ? `The window up high keeps it ventilated while maintaining privacy.` : `There is no outside window, so plan an exhaust fan here.`} The shower area is kept separate from the WC so the rest of the floor stays dry.`],
  [/kitchen/i, (r) => `This is the kitchen. The counter runs along the wall at the standard 85 centimetre height with a granite top, so the sink, stove and fridge form an efficient work triangle.${r.dirNote} Make sure the chimney or exhaust is placed above the hob.`],
  [/dining|nadum/i, (r) => `The dining area sits next to the kitchen so serving is easy. It comfortably seats a family around the table, with a wash basin close by.${r.dirNote}`],
  [/living|lounge|hall/i, (r) => `Welcome to the living room — the heart of the home, where guests are received. It is the largest space in the house.${r.dirNote} The furniture is arranged around the TV wall, leaving a clear walkway from the entrance.`],
  [/master/i, (r) => `This is the master bedroom. There is room for a king-size bed, a full-height wardrobe and a reading chair.${r.dirNote}`],
  [/bed/i, (r) => `This is ${r.name.toLowerCase()}. It fits a queen-size bed with space to walk around it and a wardrobe along the side wall.${r.dirNote}`],
  [/study|office/i, (r) => `The study is a quiet room for work and reading, with the desk facing the wall and shelving for books.${r.dirNote}`],
  [/work|utility|wash/i, (r) => `This is the work area — the utility space for washing and drying, with a service door straight outside so wet work stays out of the kitchen.`],
  [/store/i, () => `This is the store room for provisions and household items, with shelving on the back wall.`],
];

// The tour guide: a simple low-poly site engineer (hard hat + hi-vis vest) with swinging limbs.
export function makeGuide() {
  const mat = (c, r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const g = new THREE.Group(), skin = mat('#c68a5e', 0.6), pants = mat('#2f3a4a'), shirt = mat('#3b6ea5'), vest = mat('#ffb703', 0.5, { emissive: '#ff9500', emissiveIntensity: 0.15 });
  const limb = (r, len, m) => { const p = new THREE.Group(), c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); c.position.y = -len / 2 - r; p.add(c); return p; };
  const legL = limb(0.075, 0.72, pants), legR = limb(0.075, 0.72, pants);
  legL.position.set(-0.1, 0.93, 0); legR.position.set(0.1, 0.93, 0);
  for (const leg of [legL, legR]) { const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), mat('#222')); shoe.position.set(0, -0.9, 0.05); leg.add(shoe); }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 12), shirt); torso.position.y = 1.2; torso.scale.z = 0.7;
  const vestM = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 12), vest); vestM.position.y = 1.22; vestM.scale.set(1.02, 1, 0.74);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 16), mat('#e5e7eb', 0.2, { metalness: 0.6 })); stripe.position.y = 1.12; stripe.scale.z = 0.74;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.66;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f5c518', 0.35)); helmet.position.y = 1.7;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 20), mat('#f5c518', 0.35)); brim.position.set(0, 1.7, 0.03);
  const armL = limb(0.055, 0.5, shirt), armR = limb(0.055, 0.5, shirt);
  armL.position.set(-0.26, 1.47, 0); armR.position.set(0.26, 1.47, 0);
  for (const arm of [armL, armR]) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); hand.position.y = -0.68; arm.add(hand); }
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.02), mat('#8b5a2b')); clip.position.set(0, -0.6, 0.08); clip.rotation.x = -0.3; armL.add(clip);
  g.add(legL, legR, torso, vestM, stripe, head, helmet, brim, armL, armR);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData = { legL, legR, armL, armR, phase: 0 };
  return g;
}

export class Tour {
  constructor(view, app) {
    this.view = view; this.app = app;
    this.active = false; this.playing = true; this.voice = false;
    this.narrate = false; // the tour is a silent walkthrough; captions show only where we are
    $('#tour-prev').onclick = () => this.go(this.i - 1);
    $('#tour-next').onclick = () => this.go(this.i + 1);
    $('#tour-play').onclick = () => this.togglePlay();
    $('#tour-exit').onclick = () => this.stop();
    $('#tour-voice').onchange = (e) => { this.voice = e.target.checked; if (!this.voice) speechSynthesis?.cancel(); else this.speak(this.stops[this.i]); };
    this.fade = document.createElement('div');
    this.fade.className = 'tour-fade';
    Object.assign(this.fade.style, { position: 'absolute', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none', transition: 'opacity .35s', zIndex: 4 });
    view.el.appendChild(this.fade);
  }

  // ------------------------------------------------------------ stop generation
  buildStops() {
    const doc = store.doc, stops = [];
    const box = new THREE.Box3();
    for (const o of doc.objects) if (o.type === 'wall') { box.expandByPoint(new THREE.Vector3(o.x1, 0, o.y1)); box.expandByPoint(new THREE.Vector3(o.x2, 0, o.y2)); }
    if (box.isEmpty()) box.setFromObject(this.view.content);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const R = Math.max(s.x, s.z, 8), topH = levelElev(doc.levels.length - 1) + doc.levels[doc.levels.length - 1].height;
    const floors0 = doc.objects.filter((o) => o.type === 'floor' && o.level === 0 && !o.z);
    const built = doc.levels.map((_, i) => doc.objects.filter((o) => o.type === 'floor' && o.level === i && !o.z).reduce((a, o) => a + polyArea(floorPoly(o)), 0));
    const totalArea = built.reduce((a, b) => a + b, 0) || s.x * s.z;
    const rooms = doc.objects.filter((o) => o.type === 'floor' && o.name);
    const ext = (pos, target, extra = {}) => ({ pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), outside: true, ...extra });

    stops.push({ title: `Welcome to ${doc.name || 'your new home'}`, ...ext([c.x + R * 1.1, R * 0.9 + 6, c.z + R * 1.4], [c.x, 1.5, c.z]),
      text: `Let me walk you through ${doc.name || 'this home'}. It is a ${doc.levels.length > 1 ? `${doc.levels.length}-storey` : 'single-storey'} house with about ${fmtArea(totalArea)} of floor area${rooms.length ? `, arranged as ${rooms.length} rooms` : ''}. ${doc.plinth ? `The whole house is raised ${fmtLen(doc.plinth)} above the ground on a ${doc.plinthFinish || 'stone'} plinth, which keeps rain water and dampness out.` : ''}`,
      facts: [`${fmtLen(s.x)} × ${fmtLen(s.z)} footprint`, `${doc.levels.length} storey${doc.levels.length > 1 ? 's' : ''}`, `${fmtArea(totalArea)} floor area`, doc.plinth ? `Plinth ${fmtLen(doc.plinth)}` : null, doc.site || null].filter(Boolean) });

    // the street view of the facade
    const roof = doc.objects.find((o) => o.type === 'roof');
    const roofTalk = !roof ? '' : roof.style === 'kerala'
      ? `The roof is a traditional Kerala roof: steep ${roof.pitch}° slopes of clay tiles that shed the heavy monsoon rain quickly, with the small wooden gable ends — the mukhappu — that let hot air escape from the roof space. The ${fmtLen(roof.overhang || 0)} overhang shades the walls and protects them from rain.`
      : roof.style === 'flat' ? `The flat concrete roof doubles as a usable terrace and is the natural place for the water tank and solar panels. It should be laid to a slight slope with proper waterproofing.`
        : `The ${roof.style} roof is pitched at ${roof.pitch}° with ${roof.finish} covering, and the ${fmtLen(roof.overhang || 0)} overhang protects the walls from sun and rain.`;
    stops.push({ title: 'The front elevation', ...ext([c.x + s.x * 0.1, 1.7, box.max.z + R * 0.85], [c.x, topH * 0.45, c.z]),
      text: `This is the front of the house as you see it from the road. ${roofTalk}`,
      facts: [roof ? `${roof.style} roof · ${roof.pitch}°` : null, `Height to top ${fmtLen(topH)}`].filter(Boolean) });

    const gate = doc.objects.find((o) => o.type === 'gate');
    if (gate) {
      const gz = gate.y, gx = gate.x;
      stops.push({ title: 'Main gate', ...ext([gx + 1.5, 1.7, gz + 6], [gx, 1.2, gz]),
        text: `We enter through the ${labelForObj(gate).toLowerCase()}. The opening is about ${fmtLen(gate.w - (gate.pillar === 'none' ? 0.24 : 0.9))} wide between the pillars${gate.w > 3.5 ? ', enough for a car' : ''}. ${gate.style === 'padippura' ? 'The padippura is the traditional Kerala gatehouse with its own tiled roof — it gives the entrance a sense of arrival and shelter from rain.' : ''}`,
        facts: [`Width ${fmtLen(gate.w)}`, `Height ${fmtLen(gate.h)}`] });
    }

    const por = doc.objects.find((o) => o.type === 'portico' && o.level === 0);
    if (por) {
      const lift = Math.max(0, (doc.plinth || 0) - 0.2) + 0.2, steps = Math.max(1, Math.round(lift / 0.15));
      const talk = { kerala: 'This is the sit-out — the traditional Kerala verandah. The charupadi, the built-in seat with the sloping wooden backrest along the sides, is where the family relaxes in the evening and receives visitors.',
        'kerala-gable': 'The porch has a front-facing gable with a wooden jaali screen — a signature Kerala detail that lets breeze through while giving shade.',
        modern: 'A slim cantilevered canopy marks the entrance and keeps rain off the door.' }[por.style] || `The ${labelForObj(por).toLowerCase()} gives the entrance shade and a sense of arrival.`;
      stops.push({ title: por.style?.startsWith('kerala') ? 'Sit-out (poomukham)' : 'Entrance portico', ...ext([por.x + por.w * 0.9, baseElev(por) + 1.7, por.y + por.d + 3.2], [por.x, 1.6 + lift, por.y]),
        text: `${talk} ${steps} steps of about ${Math.round((lift / steps) * 1000)} millimetres lead up to it, which is a comfortable rise.`,
        facts: [`${fmtLen(por.w)} × ${fmtLen(por.d)}`, `${por.columns} columns`, `${steps} steps`] });
    }

    // every named room, storey by storey
    doc.levels.forEach((lvl, li) => {
      const lvRooms = rooms.filter((r) => r.level === li).sort((a, b) => b.y - a.y || a.x - b.x);
      if (li > 0) {
        const st = doc.objects.find((o) => o.type === 'stairs' && o.level === li - 1);
        if (st) {
          const chk = stairCheck(st);
          stops.push({ title: 'Staircase', level: li - 1, inside: true, overview: true, ...this.camFor(st, li - 1, true),
            text: `Now the staircase up to the ${lvl.name.toLowerCase()}. It is a ${{ straight: 'straight flight', lshape: 'L-shaped stair with a landing', winder: 'stair with winders at the turn', ushape: 'dog-legged stair with a half landing' }[st.shape || 'straight']}, with ${chk.n} risers of ${Math.round(chk.R)} millimetres and ${Math.round(chk.T)} millimetre treads. ${chk.ok ? 'These proportions are comfortable and within the usual code limits.' : 'The step proportions should be adjusted — aim for risers of 150 to 190 millimetres and treads of at least 250.'} The handrail is set at 900 millimetres.`,
            facts: [`${chk.n} risers × ${Math.round(chk.R)} mm`, `Tread ${Math.round(chk.T)} mm`, `Width ${fmtLen(st.flightW || st.w)}`] });
        }
      }
      for (const r of lvRooms) stops.push(this.roomStop(r, li));
      const bal = doc.objects.find((o) => o.type === 'balcony' && o.level === li);
      if (bal) stops.push({ title: 'Balcony / terrace', level: li, inside: true, ...this.camFor(bal, li, false),
        text: `Step out onto the balcony — ${fmtLen(bal.w)} by ${fmtLen(bal.d)}, with a ${bal.rail === 'glass' ? 'frameless glass' : bal.rail === 'iron' ? 'metal' : 'solid'} railing at one metre for safety. It is a lovely spot for morning tea with a view of the garden.`,
        facts: [`${fmtLen(bal.w)} × ${fmtLen(bal.d)}`, 'Rail height 1.0 m'] });
    });

    // walk around the outside: each side of the house
    stops.push({ title: 'Right side', text: '', ...ext([box.max.x + R * 0.7, 1.8, c.z + s.z * 0.3], [c.x, topH * 0.4, c.z]) });
    stops.push({ title: 'Rear of the house', text: '', ...ext([c.x + s.x * 0.3, 1.8, box.min.z - R * 0.7], [c.x, topH * 0.4, c.z]) });
    stops.push({ title: 'Left side', text: '', ...ext([box.min.x - R * 0.7, 1.8, c.z - s.z * 0.3], [c.x, topH * 0.4, c.z]) });

    // services on the roof
    const tank = doc.objects.find((o) => o.type === 'watertank'), solar = doc.objects.find((o) => o.type === 'solar');
    if (tank || solar) stops.push({ title: 'Roof & services', ...ext([c.x + R * 0.6, topH + 9, c.z - R * 0.4], [c.x, topH, c.z]),
      text: `${tank ? `On the roof there is a ${tank.litres || 1000}-litre overhead tank, high enough to give good water pressure to every tap. ` : ''}${solar ? `The solar panels are tilted at ${solar.tilt}° to face the sun and can cover a good share of the daytime electricity.` : ''}`,
      facts: [tank ? `OHT ${tank.litres || 1000} L` : null, solar ? `Solar ${fmtArea(solar.w * solar.d)}` : null].filter(Boolean) });

    // garden and site
    const count = (t, v) => doc.objects.filter((o) => o.type === t && (!v || o.variety === v)).length;
    const feats = [count('tree', 'coconut') && `${count('tree', 'coconut')} coconut palms`, count('tree') - count('tree', 'coconut') && `${count('tree') - count('tree', 'coconut')} other trees`,
      count('well') && 'an open well', count('pool') && 'a swimming pool', count('gazebo') && 'a gazebo', count('tulsi') && 'a tulsi thara', count('flowerbed') && 'flower beds',
      count('carport') && 'a covered carport', count('pergola') && 'a pergola', count('swing') && 'a swing'].filter(Boolean);
    if (feats.length) stops.push({ title: 'Garden & outdoors', ...ext([box.min.x - R * 0.5, R * 0.5 + 3, box.max.z + R * 0.6], [c.x, 0, c.z]),
      text: `Around the house the landscape includes ${list(feats)}. ${count('well') ? 'The well should be at least 15 metres from the septic tank. ' : ''}Keep the ground sloping away from the plinth so rain water drains off quickly.`,
      facts: feats.slice(0, 5) });

    stops.push({ title: 'That completes the tour', ...ext([c.x - R * 1.2, R * 0.8 + 5, c.z + R * 1.1], [c.x, 2, c.z]),
      text: `That is the complete house. Use Export PDF to get the full drawing set — floor plans with every dimension, elevations, door and window schedules, quantities and construction notes — which you can hand straight to your engineer or mason. Thank you for walking through it with me.`,
      facts: [`${rooms.length} rooms`, `${doc.objects.filter((o) => o.type === 'door').length} doors`, `${doc.objects.filter((o) => o.type === 'window').length} windows`] });
    return stops;
  }

  // Camera for an interior space: eye level from a corner for bigger rooms, a high corner view for small ones.
  camFor(o, level, high) {
    const e = levelElev(level), hw = o.w / 2, hd = o.d / 2;
    const r = ((o.rot || 0) * Math.PI) / 180, W = (lx, ly) => [o.x + lx * Math.cos(r) - ly * Math.sin(r), o.y + lx * Math.sin(r) + ly * Math.cos(r)];
    if (high) {
      const [px, pz] = W(hw + 0.6, hd + 0.6);
      return { pos: new THREE.Vector3(px, e + 4.2, pz), target: new THREE.Vector3(o.x, e + 0.6, o.y) };
    }
    const [px, pz] = W(-hw + 0.35, hd - 0.35), [tx, tz] = W(hw * 0.6, -hd * 0.6);
    return { pos: new THREE.Vector3(px, e + 1.6, pz), target: new THREE.Vector3(tx, e + 1.1, tz) };
  }

  roomStop(r, level) {
    const area = polyArea(floorPoly(r)), doc = store.doc;
    // windows on walls that bound this room
    const dirs = new Set(), wins = [];
    const c = levelCentroid(level);
    for (const w of wallsOn(level)) {
      for (const op of openingsOf(w.id)) {
        if (op.type !== 'window') continue;
        const a = wallAng(w), px = w.x1 + Math.cos(a) * op.t, py = w.y1 + Math.sin(a) * op.t;
        if (Math.abs(px - r.x) > r.w / 2 + 0.3 || Math.abs(py - r.y) > r.d / 2 + 0.3) continue;
        wins.push(op);
        if (w.kind !== 'interior') { const s = outwardSign(w, c); dirs.add(facing(-Math.sin(a) * s, Math.cos(a) * s)); }
      }
    }
    const winArea = wins.reduce((a, op) => a + op.width * op.height, 0), ratio = area ? winArea / area : 0;
    const d = [...dirs];
    const dirNote = d.length ? ` Its windows face ${list(d)}, giving ${list(d.map((x) => LIGHT[x]))}.` : '';
    const finish = { wood: 'wooden flooring', tile: 'vitrified tiles', marble: 'marble', carpet: 'carpet', concrete: 'polished concrete', deck: 'timber decking', flagstone: 'stone' }[r.finish] || r.finish;
    const info = { name: r.name, finish, dirNote, vent: wins.length > 0 };
    const talk = (ROOM_TALK.find(([re]) => re.test(r.name))?.[1] || ((x) => `This is the ${x.name.toLowerCase()}, finished in ${x.finish}.${x.dirNote}`))(info);
    const vent = ratio ? ` Window area is about ${Math.round(ratio * 100)}% of the floor area${ratio >= 0.1 ? ', which meets the usual one-tenth guideline for daylight and ventilation' : ' — a little low; a larger window would help'}.` : '';
    const small = area < 6;
    return { title: r.name, level, inside: true, ...this.camFor(r, level, small),
      text: `${talk} The room measures ${fmtLen(r.w)} by ${fmtLen(r.d)} — about ${fmtArea(area)} — with a clear ceiling height of ${fmtLen(doc.levels[level].height)}.${vent}`,
      facts: [`${fmtLen(r.w)} × ${fmtLen(r.d)}`, fmtArea(area), finish, wins.length ? `${wins.length} window${wins.length > 1 ? 's' : ''}` : 'No window', doc.levels[level].name] };
  }

  // ------------------------------------------------------------ playback
  async start() {
    if (this.starting) return;
    // the guide is a light-grey motion-captured figure; the simple one is only a fallback
    if (!this.guide) {
      this.starting = true;
      this.guide = (await preloadCharacter({ body: '#e7e2d9', joints: '#4b5563' })) || makeCharacter({ helmet: true, clipboard: true, shirt: '#e8eef5' });
      this.starting = false;
    }
    const v = this.view;
    if (v.elev) v.setElevation(null);
    if (v.walk) v.setWalk(false);
    this.saved = { pos: v.camera.position.clone(), target: v.controls.target.clone(), level: store.level };
    this.savedFov = v.camera.fov;
    this.stops = this.buildStops();
    this.active = true; this.playing = true;
    v.controls.enabled = false;
    v.el.classList.add('touring');
    v.scene.add(this.guide);
    this.guide.visible = false;
    $('#tour').hidden = false;
    $('#tour-play').textContent = '❚❚';
    this.go(0, true);
  }
  stop() {
    const v = this.view;
    this.active = false;
    speechSynthesis?.cancel();
    clearTimeout(this.timer); clearTimeout(this.fadeTimer);
    this.fade && (this.fade.style.opacity = 0);
    $('#tour').hidden = true;
    v.el.classList.remove('touring');
    if (this.guide) v.scene.remove(this.guide);
    v.forceNoRoof = undefined; v.forceLevel = undefined; v.markDirty();
    if (this.saved) { v.camera.position.copy(this.saved.pos); v.controls.target.copy(this.saved.target); }
    v.controls.enabled = true;
    v.camera.fov = this.savedFov ?? 45; v.camera.updateProjectionMatrix();
  }
  togglePlay() {
    this.playing = !this.playing;
    $('#tour-play').textContent = this.playing ? '❚❚' : '▶';
    if (!this.playing) { speechSynthesis?.pause(); clearTimeout(this.timer); }
    else if (!this.narrate) this.speak(this.stops[this.i]);
    else { if (speechSynthesis?.paused) speechSynthesis.resume(); else this.scheduleNext(); }
  }
  go(i, first = false) {
    if (i < 0 || i >= this.stops.length) { if (i >= this.stops.length) this.stop(); return; }
    clearTimeout(this.timer);
    speechSynthesis?.cancel();
    const prev = this.stops[this.i], st = this.stops[i], v = this.view;
    this.i = i;
    const setScene = () => {
      // interiors: cut the roof away and hide the storeys above so the room is open to daylight and view
      v.forceNoRoof = st.inside ? true : undefined;
      v.forceLevel = st.inside ? st.level : undefined;
      v.markDirty();
      v.camera.fov = st.inside && !st.overview ? 62 : 45; v.camera.updateProjectionMatrix();
    };
    // ground-level stops: the guide walks ahead and we follow over the shoulder
    const floorY = st.inside ? levelElev(st.level) : 0;
    const groundStop = !st.overview && st.pos.y - floorY < 2.6;
    const prevGround = prev && !prev.overview && prev.pos.y - (prev.inside ? levelElev(prev.level) : 0) < 2.6;
    const jump = first || st.inside || prev?.inside || groundStop || prevGround;
    const guide = this.guide;
    this.anim = null;
    const startStop = () => {
      if (groundStop) {
        const dir = st.target.clone().sub(st.pos).setY(0), dist = dir.length(); dir.normalize();
        const gy = st.pos.y - 1.65, start = st.pos.clone().setY(gy).addScaledVector(dir, 2.6);
        const end = start.clone().addScaledVector(dir, Math.min(dist * 0.55, st.inside ? 2.8 : 6));
        guide.visible = true; guide.position.copy(start);
        const side = new THREE.Vector3(dir.z, 0, -dir.x);
        v.camera.position.copy(start).addScaledVector(dir, -2.2).addScaledVector(side, 0.3).setY(gy + 1.75);
        this.anim = { follow: true, start, end, dir, gy, t: 0, dur: st.inside ? 6.5 : 6 };
      } else {
        // aerial views: the guide waits at the spot and waves
        const tp = st.target.clone(); tp.y = st.inside ? levelElev(st.level) : 0;
        guide.visible = true; guide.position.copy(tp);
        guide.rotation.y = Math.atan2(st.pos.x - tp.x, st.pos.z - tp.z);
        const pivot = st.pos, dir = st.target.clone().sub(pivot), swing = 0.2;
        const rot = (a) => pivot.clone().add(dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a));
        this.anim = this.anim?.flight ? this.anim : { to: st.pos.clone(), tf: rot(swing), tt: rot(-swing), t: 0, dur: 5.5, pan: true };
      }
    };
    if (jump) {
      this.fade.style.opacity = 1;
      clearTimeout(this.fadeTimer);
      this.fadeTimer = setTimeout(() => {
        if (!this.active) return;
        setScene();
        if (!groundStop) { v.camera.position.copy(st.pos); v.controls.target.copy(st.target); v.camera.lookAt(st.target); }
        startStop();
        this.fade.style.opacity = 0;
      }, first ? 50 : 380);
    } else {
      setScene();
      this.anim = { flight: true, from: v.camera.position.clone(), to: st.pos.clone(), tf: v.controls.target.clone(), tt: st.target.clone(), t: 0, dur: 3.2 };
      startStop();
    }
    $('#tour-step').textContent = `Stop ${i + 1} of ${this.stops.length}`;
    $('#tour-title').textContent = st.title;
    $('#tour-text').textContent = st.text;
    $('#tour-facts').innerHTML = '';
    for (const f of st.facts || []) { const s = document.createElement('span'); s.textContent = f; $('#tour-facts').append(s); }
    $('#tour-progress').style.width = `${((i + 1) / this.stops.length) * 100}%`;
    this.speak(st);
  }
  speak(st) {
    // silent cinematic tour: each stop gets a fixed screen time, no narration
    if (!this.narrate) { clearTimeout(this.timer); if (this.playing) this.timer = setTimeout(() => this.go(this.i + 1), (st.inside ? 6.5 : 5.5) * 1000); return; }
    const words = st.text.split(/\s+/).length;
    if (this.voice && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(st.text);
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((x) => /en-IN/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang)) || null;
      u.rate = 1; u.pitch = 1;
      u.onend = () => { if (this.active && this.playing && this.stops[this.i] === st) this.timer = setTimeout(() => this.go(this.i + 1), 1200); };
      speechSynthesis.speak(u);
      // fallback in case the browser never fires onend
      this.timer = setTimeout(() => { if (this.active && this.playing && this.stops[this.i] === st && !speechSynthesis.speaking) this.go(this.i + 1); }, (words / 2.3 + 6) * 1000);
    } else this.scheduleNext(words);
  }
  scheduleNext(words = this.stops[this.i].text.split(/\s+/).length) {
    clearTimeout(this.timer);
    if (this.playing) this.timer = setTimeout(() => this.go(this.i + 1), Math.max(6, words / 3.2) * 1000);
  }
  update(dt) {
    const a = this.anim, v = this.view, g = this.guide;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const ud = g?.userData;
    if (a.follow) {
      // walk forward for most of the stop, then turn round and gesture at the room
      const walkT = Math.min(1, a.t / 0.75);
      g.position.lerpVectors(a.start, a.end, walkT);
      const heading = Math.atan2(a.dir.x, a.dir.z);
      const walking = walkT < 1;
      if (walking) g.rotation.y = heading;
      else g.rotation.y = heading + Math.PI * 0.65 * Math.min(1, (a.t - 0.75) / 0.12); // turn round and point into the room
      ud.animate(dt, { speed: walking ? a.start.distanceTo(a.end) / (a.dur * 0.75) : 0, point: !walking });
      g.position.y = a.gy + (walking ? ud.bob || 0 : 0);
      const side = new THREE.Vector3(a.dir.z, 0, -a.dir.x);
      const camPos = g.position.clone().addScaledVector(a.dir, -2.2).addScaledVector(side, 0.3).setY(a.gy + 1.75);
      v.camera.position.lerp(camPos, 0.12);
      v.controls.target.copy(g.position).addScaledVector(a.dir, 3.5).setY(a.gy + 1.3);
      v.camera.lookAt(v.controls.target);
      return;
    }
    if (g?.visible && ud) {
      ud.animate(dt, { speed: 0, wave: true }); // idle wave
    }
    if (a.pan) {
      const k = ease(a.t);
      v.camera.position.copy(a.to);
      v.controls.target.lerpVectors(a.tf, a.tt, k);
      v.camera.lookAt(v.controls.target);
    } else {
      const k = ease(a.t);
      v.camera.position.lerpVectors(a.from, a.to, k);
      // arc the flight path upward a little so it does not clip the house
      v.camera.position.y += Math.sin(k * Math.PI) * Math.min(6, a.from.distanceTo(a.to) * 0.15);
      v.controls.target.lerpVectors(a.tf, a.tt, k);
      v.camera.lookAt(v.controls.target);
    }
  }
}

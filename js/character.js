// A realistic, articulated human figure (≈1.75 m) built from smooth primitives, with a joint rig
// (hips → spine → chest → neck → head; shoulders → elbows → wrists; hips → knees → ankles) and a
// procedural walk / run / idle / jump animation. The figure faces +z.
import * as THREE from 'three';

const mat = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// ---------------------------------------------------------------- motion-captured characters
// Preferred: a user-supplied rigged model at assets/character.glb with clips named like idle / walk / run
// (e.g. a Mixamo character exported to glTF). Fallback: the Mixamo "X Bot" figure from the three.js examples,
// which carries real motion-capture idle, walk and run clips.
const XBOT_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb';
let sourcePromise = null;
function loadSource() {
  sourcePromise ??= (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    try {
      const head = await fetch('assets/character.glb', { method: 'HEAD' });
      if (head.ok) return { gltf: await loader.loadAsync('assets/character.glb'), custom: true };
    } catch { /* no custom model */ }
    return { gltf: await loader.loadAsync(XBOT_URL), custom: false };
  })();
  return sourcePromise;
}
const findClip = (clips, ...names) => clips.find((c) => names.some((n) => c.name.toLowerCase().includes(n)));

// Returns a figure with the same animate(dt, state) interface as makeCharacter, or null if loading fails.
// ---------------------------------------------------------------- VRM avatars (assets/character.vrm)
// VRM avatars carry a standard humanoid skeleton but no locomotion, so the X Bot's motion-captured
// clips are retargeted onto it (same method as the three-vrm Mixamo example).
let xbotPromise = null;
const loadXbot = () => (xbotPromise ??= import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(XBOT_URL)));
const MIXAMO_TO_VRM = {
  mixamorigHips: 'hips', mixamorigSpine: 'spine', mixamorigSpine1: 'chest', mixamorigSpine2: 'upperChest', mixamorigNeck: 'neck', mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder', mixamorigLeftArm: 'leftUpperArm', mixamorigLeftForeArm: 'leftLowerArm', mixamorigLeftHand: 'leftHand',
  mixamorigRightShoulder: 'rightShoulder', mixamorigRightArm: 'rightUpperArm', mixamorigRightForeArm: 'rightLowerArm', mixamorigRightHand: 'rightHand',
  mixamorigLeftUpLeg: 'leftUpperLeg', mixamorigLeftLeg: 'leftLowerLeg', mixamorigLeftFoot: 'leftFoot', mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg', mixamorigRightLeg: 'rightLowerLeg', mixamorigRightFoot: 'rightFoot', mixamorigRightToeBase: 'rightToes',
};
for (const s of ['Left', 'Right']) for (const [m, v] of [['Thumb', 'Thumb'], ['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
  const names = v === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
  names.forEach((n, i) => { MIXAMO_TO_VRM[`mixamorig${s}Hand${m}${i + 1}`] = `${s.toLowerCase()}${v}${n}`; });
}
function retargetToVrm(clip, mixamoScene, vrm) {
  const tracks = [], restInv = new THREE.Quaternion(), parentRest = new THREE.Quaternion(), q = new THREE.Quaternion(), v3 = new THREE.Vector3();
  mixamoScene.updateMatrixWorld(true);
  const motionHipsHeight = mixamoScene.getObjectByName('mixamorigHips').position.y;
  const vrmHipsHeight = Math.abs(vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(v3).y - vrm.scene.getWorldPosition(new THREE.Vector3()).y);
  const hipsScale = vrmHipsHeight / motionHipsHeight, vrm0 = vrm.meta?.metaVersion === '0';
  // Short-legged avatars (chibi, children) cover less ground per step: swing the limbs wider and step faster
  // so the feet keep pace with the ground instead of sliding. Stride ∝ leg length × swing, speed = stride × cadence.
  const legRatio = Math.max(1, (motionHipsHeight * (mixamoScene.getObjectByName('mixamorigHips').getWorldScale(new THREE.Vector3()).y)) / Math.max(0.2, vrmHipsHeight));
  const swing = Math.min(1.8, Math.sqrt(legRatio)), limb = /UpLeg|Leg$|ForeArm|Arm$|Foot/;
  for (const track of clip.tracks) {
    const [rig, prop] = track.name.split('.');
    const node = vrm.humanoid.getNormalizedBoneNode(MIXAMO_TO_VRM[rig]), src = mixamoScene.getObjectByName(rig);
    if (!node || !src) continue;
    src.getWorldQuaternion(restInv).invert();
    src.parent.getWorldQuaternion(parentRest);
    if (prop === 'quaternion') {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parentRest).multiply(restInv).toArray(values, i);
        if (vrm0) { values[i] = -values[i]; values[i + 2] = -values[i + 2]; }
      }
      if (swing > 1.05 && limb.test(rig)) {
        // exaggerate each key's deviation from the clip's average pose (not from the T-pose)
        const mean = new THREE.Quaternion(0, 0, 0, 0), n = values.length / 4, k = new THREE.Quaternion();
        for (let i = 0; i < values.length; i += 4) { k.fromArray(values, i); if (k.dot(mean) < 0) k.set(-k.x, -k.y, -k.z, -k.w); mean.set(mean.x + k.x, mean.y + k.y, mean.z + k.z, mean.w + k.w); }
        mean.normalize();
        const inv = mean.clone().invert(), axis = new THREE.Vector3();
        for (let i = 0; i < values.length; i += 4) {
          const d = inv.clone().multiply(k.fromArray(values, i)).normalize(); if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
          const cw = Math.min(1, d.w), ang = 2 * Math.acos(cw), sn = Math.sqrt(Math.max(0, 1 - cw * cw)); // clamp rounding past 1
          if (sn < 1e-5) continue;
          axis.set(d.x / sn, d.y / sn, d.z / sn);
          mean.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, ang * swing)).toArray(values, i);
        }
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, track.times, values));
    } else if (prop === 'position' && rig === 'mixamorigHips') {
      const values = track.values.map((val, i) => (vrm0 && i % 3 !== 1 ? -val : val) * hipsScale);
      tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`, track.times, values));
    }
  }
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  out.userData = { cadence: legRatio / swing }; // remaining stride shortfall is made up by stepping faster
  return out;
}

export async function loadVrmCharacter(url) {
  const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }, xbot] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'), import('@pixiv/three-vrm'), loadXbot()]);
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('not a VRM file');
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons?.(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // VRM 0.x faces −z; make it face +z like everything else here
  vrm.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const root = new THREE.Group();
  root.add(vrm.scene);
  root.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(vrm.scene), clips = xbot.animations;
  const act = (c) => { if (!c) return null; const a = mixer.clipAction(retargetToVrm(c, xbot.scene, vrm)); a.play(); a.setEffectiveWeight(0); return a; };
  const A = { idle: act(findClip(clips, 'idle')), walk: act(findClip(clips, 'walk')), run: act(findClip(clips, 'run')), gesture: act(findClip(clips, 'agree')) };
  const hb = new THREE.Box3().setFromObject(vrm.scene, true);
  root.userData = { bob: 0, mocap: true, vrm, height: hb.max.y - hb.min.y }; // the camera aims at this avatar's own eye height
  const cadence = A.walk?.getClip().userData?.cadence || 1;
  root.userData.animate = makeBlender(A, mixer, (dt, s) => { vrm.update(s.grounded === false ? dt * 0.25 : dt); vrm.scene.visible = !s.firstPerson; }, cadence);
  return root;
}

// Speed-driven cross-fade between idle / walk / run (+ an optional gesture), shared by all mocap figures.
function makeBlender(A, mixer, after, cadence = 1) {
  const w = { idle: 1, walk: 0, run: 0, gesture: 0 };
  return (dt, s = {}) => {
    const speed = s.speed || 0, b = Math.min(1, speed / 1.0), run = Math.min(1, Math.max(0, (speed - 1.7) / 1.5));
    const gest = (s.wave || s.point) && speed < 0.1 ? 1 : 0;
    const target = { idle: (1 - b) * (1 - gest), walk: b * (1 - run), run: b * run, gesture: gest };
    if (!A.run) { target.walk += target.run; target.run = 0; }
    if (!A.gesture) { target.idle += target.gesture; target.gesture = 0; }
    for (const k of Object.keys(w)) { w[k] += (target[k] - w[k]) * Math.min(1, dt * 8); A[k]?.setEffectiveWeight(w[k]); }
    if (A.walk) A.walk.timeScale = (s.reverse ? -1 : 1) * Math.max(0.6, speed / 1.35) * cadence;
    if (A.run) A.run.timeScale = (s.reverse ? -1 : 1) * Math.min(1.3, Math.max(0.7, speed / 3.6)) * cadence;
    mixer.update(s.grounded === false ? dt * 0.25 : dt);
    after?.(dt, s);
  };
}

export async function loadMocapCharacter({ body = '#d8b99a', joints = '#6b4a36' } = {}) {
  // a VRM avatar placed at assets/character.vrm takes priority
  try {
    const head = await fetch('assets/character.vrm', { method: 'HEAD' });
    if (head.ok) return await loadVrmCharacter('assets/character.vrm');
  } catch (err) { console.warn('VRM avatar could not be used:', err); }
  let src;
  try { src = await loadSource(); } catch { return null; }
  const { clone } = await import('three/addons/utils/SkeletonUtils.js');
  const model = clone(src.gltf.scene);
  // fit to 1.75 m tall, feet on the ground, facing +z
  model.updateMatrixWorld(true); // measure with the armature's own scale applied
  const box = new THREE.Box3().setFromObject(model, true), h = box.max.y - box.min.y || 1;
  model.scale.multiplyScalar(1.75 / h);
  model.position.y = -box.min.y * (1.75 / h);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (!src.custom) {
      // recolour the X Bot as a warm, matte scale figure (body + darker joints)
      const isJoint = /joint/i.test(o.material.name);
      o.material = new THREE.MeshStandardMaterial({ color: isJoint ? joints : body, roughness: isJoint ? 0.45 : 0.62, metalness: 0.05 });
    }
  });
  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model), clips = src.gltf.animations;
  const act = (c) => { if (!c) return null; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); return a; };
  const A = { idle: act(findClip(clips, 'idle')), walk: act(findClip(clips, 'walk')), run: act(findClip(clips, 'run')), gesture: act(findClip(clips, 'agree', 'wave', 'yes')) };
  const w = { idle: 1, walk: 0, run: 0, gesture: 0 };
  root.userData.bob = 0;
  root.userData.mocap = true;
  root.userData.animate = (dt, s = {}) => {
    const speed = s.speed || 0, b = Math.min(1, speed / 1.0), run = Math.min(1, Math.max(0, (speed - 1.7) / 1.5));
    const gest = (s.wave || s.point) && speed < 0.1 ? 1 : 0;
    const target = { idle: (1 - b) * (1 - gest), walk: b * (1 - run), run: b * run, gesture: gest };
    if (!A.run) { target.walk += target.run; target.run = 0; }
    if (!A.gesture) { target.idle += target.gesture; target.gesture = 0; }
    for (const k of Object.keys(w)) {
      w[k] += (target[k] - w[k]) * Math.min(1, dt * 8); // smooth cross-fade between clips
      A[k]?.setEffectiveWeight(w[k]);
    }
    // play the stride at the speed the body actually moves (natural walk ≈ 1.35 m/s, run ≈ 3.6 m/s)
    if (A.walk) A.walk.timeScale = (s.reverse ? -1 : 1) * Math.max(0.6, speed / 1.35);
    if (A.run) A.run.timeScale = (s.reverse ? -1 : 1) * Math.min(1.3, Math.max(0.7, speed / 3.6));
    mixer.update(s.grounded === false ? dt * 0.25 : dt); // nearly freeze the pose in the air
    model.visible = !s.firstPerson;
  };
  return root;
}

// Smooth tapered limb segment hanging down from its joint (top at y = 0).
function limb(rTop, rBottom, len, material, seg = 14) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, y = -t * len;
    // slightly rounded profile (muscle bulge in the upper third)
    const r = rTop + (rBottom - rTop) * t + Math.sin(t * Math.PI) * 0.12 * rTop;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  pts.unshift(new THREE.Vector2(0.001, rTop * 0.5)); pts.push(new THREE.Vector2(0.001, -len - rBottom * 0.5));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), material);
  m.castShadow = true;
  return m;
}
function sphere(r, material, sx = 1, sy = 1, sz = 1, seg = 20) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), material);
  m.scale.set(sx, sy, sz); m.castShadow = true;
  return m;
}
const joint = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

export function makeCharacter({ skin = '#9c6a48', shirt = '#5b7fa3', trousers = '#3a3f47', shoes = '#3b2a1f', hair = '#1b1512', helmet = false, clipboard = false } = {}) {
  const SKIN = mat(skin, 0.55), SHIRT = mat(shirt, 0.8), PANTS = mat(trousers, 0.85), SHOE = mat(shoes, 0.45), HAIR = mat(hair, 0.9);
  const root = new THREE.Group();

  // ---- pelvis & legs
  const hips = joint(0, 0.94, 0, root);
  const pelvis = sphere(0.165, PANTS, 1, 0.62, 0.72); pelvis.position.y = 0.02; hips.add(pelvis);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.018, 8, 24), mat('#2a1f18', 0.4)); belt.rotation.x = Math.PI / 2; belt.scale.z = 0.72; belt.position.y = 0.09; hips.add(belt);
  const leg = (side) => {
    const hip = joint(side * 0.095, -0.02, 0, hips);
    hip.add(limb(0.078, 0.056, 0.42, PANTS));
    const knee = joint(0, -0.43, 0, hip);
    knee.add(limb(0.056, 0.042, 0.41, PANTS));
    const ankle = joint(0, -0.42, 0, knee);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 6, 12), SHOE);
    foot.rotation.x = Math.PI / 2; foot.scale.set(1.15, 1, 0.75); foot.position.set(0, -0.05, 0.055); foot.castShadow = true;
    ankle.add(foot);
    return { hip, knee, ankle };
  };
  const L = leg(-1), R = leg(1);

  // ---- torso
  const spine = joint(0, 0.1, 0, hips);
  const torsoPts = [[0.001, -0.02], [0.15, 0], [0.155, 0.08], [0.15, 0.18], [0.17, 0.3], [0.185, 0.4], [0.17, 0.46], [0.11, 0.5], [0.05, 0.52], [0.001, 0.525]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 24), SHIRT);
  torso.scale.z = 0.62; torso.castShadow = true; spine.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 8, 18), SHIRT); collar.rotation.x = Math.PI / 2; collar.position.y = 0.505; spine.add(collar);
  for (let i = 0; i < 4; i++) { const b = sphere(0.007, mat('#e5e7eb', 0.3)); b.position.set(0, 0.44 - i * 0.1, 0.112 - i * 0.004); spine.add(b); } // shirt buttons

  // ---- neck & head
  const neck = joint(0, 0.5, 0, spine);
  neck.add(limb(0.048, 0.045, 0.09, SKIN).translateY(0.09));
  const head = joint(0, 0.1, 0.005, neck);
  const skull = sphere(0.1, SKIN, 0.96, 1.17, 1.06, 28); skull.position.y = 0.105; head.add(skull);
  const jaw = sphere(0.075, SKIN, 1.05, 0.9, 1.0); jaw.position.set(0, 0.045, 0.03); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.045, 10), SKIN); nose.rotation.x = Math.PI / 2 + 0.25; nose.position.set(0, 0.1, 0.112); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = sphere(0.024, SKIN, 0.45, 1, 0.75); ear.position.set(s * 0.097, 0.105, 0.005); head.add(ear);
    const eye = sphere(0.0135, mat('#f5f1ea', 0.2)); eye.position.set(s * 0.035, 0.125, 0.093); head.add(eye);
    const iris = sphere(0.0075, mat('#2a1a10', 0.2)); iris.position.set(s * 0.035, 0.125, 0.105); head.add(iris);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.007, 0.01), HAIR); brow.position.set(s * 0.035, 0.148, 0.1); brow.rotation.z = s * -0.12; head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.005, 0.006), mat('#7a3e34', 0.5)); mouth.position.set(0, 0.06, 0.103); head.add(mouth);
  const mous = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.01, 0.01), HAIR); mous.position.set(0, 0.074, 0.103); head.add(mous);
  // short hair: a cap over the top and back of the skull
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.104, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR);
  hairCap.scale.set(0.98, 1.12, 1.08); hairCap.position.set(0, 0.118, -0.008); hairCap.rotation.x = -0.25; hairCap.castShadow = true; head.add(hairCap);
  if (helmet) {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f5c518', 0.35)); hat.position.y = 0.16; head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 24), mat('#f5c518', 0.35)); brim.position.set(0, 0.162, 0.025); brim.scale.z = 1.12; head.add(brim);
  }

  // ---- arms
  const arm = (side) => {
    const shoulder = joint(side * 0.18, 0.44, 0, spine);
    const deltoid = sphere(0.05, SHIRT, 0.95, 0.85, 0.85); deltoid.position.y = -0.01; shoulder.add(deltoid);
    shoulder.add(limb(0.048, 0.04, 0.3, SHIRT));
    const elbow = joint(0, -0.31, 0, shoulder);
    elbow.add(limb(0.04, 0.031, 0.26, SKIN));
    const wrist = joint(0, -0.27, 0, elbow);
    const palm = sphere(0.04, SKIN, 0.55, 1.1, 0.95); palm.position.y = -0.045; wrist.add(palm);
    const thumb = limb(0.012, 0.01, 0.045, SKIN, 8); thumb.position.set(0, -0.03, 0.022); thumb.rotation.x = -0.6; wrist.add(thumb);
    return { shoulder, elbow, wrist };
  };
  const AL = arm(-1), AR = arm(1);
  if (clipboard) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.012), mat('#8b5a2b', 0.6));
    board.position.set(0, -0.09, 0.05); board.rotation.x = -0.25; AL.wrist.add(board);
  }

  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  root.userData.rig = { hips, spine, neck, head, L, R, AL, AR, phase: 0, blend: 0 };
  root.userData.animate = (dt, s) => animate(root, dt, s);
  return root;
}

// s: { speed (m/s), grounded, vy, wave, point, firstPerson }
function animate(root, dt, s = {}) {
  const r = root.userData.rig, speed = s.speed || 0, grounded = s.grounded !== false;
  const run = Math.min(1, Math.max(0, (speed - 1.6) / 1.6));     // 0 walk … 1 run
  const move = Math.min(1, speed / 1.2);                          // 0 idle … 1 moving
  r.blend += (move - r.blend) * Math.min(1, dt * 8);
  const b = r.blend;
  // stride frequency rises with speed (≈1.8 steps/s walking, ≈2.8 running)
  r.phase += (s.reverse ? -1 : 1) * dt * (b > 0.02 ? 5.6 + speed * 1.6 : 0); // walking backwards plays the cycle in reverse
  const p = r.phase, sp = Math.sin(p), cp = Math.cos(p);
  const A = (0.42 + run * 0.32) * b;                              // thigh swing amplitude
  // legs: thigh swing, knee flexes during the forward swing, ankle keeps the sole level
  r.L.hip.rotation.x = -sp * A; r.R.hip.rotation.x = sp * A;
  r.L.knee.rotation.x = (Math.max(0, cp) * (0.75 + run * 0.6) + 0.06) * b;
  r.R.knee.rotation.x = (Math.max(0, -cp) * (0.75 + run * 0.6) + 0.06) * b;
  r.L.ankle.rotation.x = -r.L.knee.rotation.x * 0.35 + sp * 0.1 * b;
  r.R.ankle.rotation.x = -r.R.knee.rotation.x * 0.35 - sp * 0.1 * b;
  // arms counter-swing, elbows bend more when running
  r.AL.shoulder.rotation.x = sp * A * 0.85; r.AR.shoulder.rotation.x = -sp * A * 0.85;
  r.AL.shoulder.rotation.z = -0.07; r.AR.shoulder.rotation.z = 0.07;
  r.AL.elbow.rotation.x = -(0.18 + run * 1.1) * b - 0.08; r.AR.elbow.rotation.x = -(0.18 + run * 1.1) * b - 0.08;
  // body: vertical bob twice per stride, pelvis/chest counter-rotation, lean forward when running
  root.userData.bob = Math.abs(sp) * (0.025 + run * 0.03) * b;
  r.hips.rotation.y = -sp * 0.08 * b; r.spine.rotation.y = sp * 0.14 * b;
  r.spine.rotation.x = run * 0.18 * b;
  r.hips.rotation.z = cp * 0.03 * b;
  // idle: slow breathing and a slight weight shift
  const t = (root.userData.t = (root.userData.t || 0) + dt);
  r.spine.scale.set(1, 1 + Math.sin(t * 1.6) * 0.008 * (1 - b), 1 + Math.sin(t * 1.6) * 0.015 * (1 - b));
  r.head.rotation.y = Math.sin(t * 0.35) * 0.12 * (1 - b);
  r.neck.rotation.x = -r.spine.rotation.x * 0.6;
  // airborne pose: knees tucked, arms up for balance
  if (!grounded) {
    r.L.hip.rotation.x = -0.55; r.R.hip.rotation.x = -0.2;
    r.L.knee.rotation.x = 0.9; r.R.knee.rotation.x = 0.5;
    r.AL.shoulder.rotation.x = -0.6; r.AR.shoulder.rotation.x = -0.4;
    r.AL.shoulder.rotation.z = -0.35; r.AR.shoulder.rotation.z = 0.35;
  }
  if (s.wave) { r.AR.shoulder.rotation.x = -2.7; r.AR.shoulder.rotation.z = 0.25 + Math.sin(t * 7) * 0.3; r.AR.elbow.rotation.x = -0.4; }
  if (s.point) { r.AR.shoulder.rotation.x = -1.35; r.AR.shoulder.rotation.z = 0.35; r.AR.elbow.rotation.x = -0.05; }
  r.head.visible = !s.firstPerson;
}

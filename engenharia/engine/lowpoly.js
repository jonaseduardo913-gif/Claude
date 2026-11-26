// Low-poly stylized look (bright, faceted, sunny) + original character rig.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rand, lerp, clamp } from './kit.js';

// ---------------------------------------------------------------- materials (flat shaded)
export const lp = {
  color: (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.82, metalness: 0, ...o }),
  metal: (c = 0xa9b3bd, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.42, metalness: 0.55, ...o }),
  glass: (c = 0x9fdcff, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, ...o }),
  emissive: (c, k = 0.8) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, flatShading: true }),
};

/** jitter vertices of a geometry for a hand-made faceted look (deterministic) */
export function facet(geo, amount = 0.04, seed = 1) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const p = geo.attributes.position;
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const off = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    if (!off.has(k)) { const r = off.size + seed * 101; off.set(k, [rand(r) - 0.5, rand(r + 3) - 0.5, rand(r + 7) - 0.5]); }
    const o = off.get(k);
    p.setXYZ(i, p.getX(i) + o[0] * amount, p.getY(i) + o[1] * amount, p.getZ(i) + o[2] * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- environment
export function makeSkyStudio(renderer, scene, opts = {}) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = opts.envIntensity ?? 0.35;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(opts.top ?? 0x3d9be9) }, mid: { value: new THREE.Color(opts.mid ?? 0x8fd0ff) }, bottom: { value: new THREE.Color(opts.bottom ?? 0xe6f6ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bottom, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -100;
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(30, 60, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfeaff, 0x6b8a4a, 1.1); scene.add(hemi);
  // dummies so episode code written for the dark studio still works
  const floor = new THREE.Object3D(); floor.visible = false; scene.add(floor);
  return { sky, sun, hemi, floor, key: sun, rim: hemi, fill: hemi };
}

/** keep the shadow camera around a point of interest (big worlds) */
export function aimSun(studio, target, size = 20) {
  const s = studio.sun;
  s.target.position.set(...target);
  s.position.set(target[0] + 30, target[1] + 60, target[2] + 40);
  Object.assign(s.shadow.camera, { left: -size, right: size, top: size, bottom: -size });
  s.shadow.camera.updateProjectionMatrix();
}

export function cloud(seed = 1, scale = 1) {
  const g = new THREE.Group();
  const m = lp.color(0xffffff, { roughness: 1 });
  const n = 4 + Math.floor(rand(seed) * 3);
  for (let i = 0; i < n; i++) {
    const r = (0.7 + rand(seed + i) * 0.7) * scale;
    const b = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 1), 0.12 * scale, seed + i), m);
    b.position.set((i - n / 2) * 0.9 * scale, rand(seed + i * 3) * 0.5 * scale, (rand(seed + i * 5) - 0.5) * 0.8 * scale);
    g.add(b);
  }
  return g;
}

export function tree(seed = 1, h = 3) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * h / 3, 0.16 * h / 3, h * 0.35, 6), lp.color(0x7a5230));
  trunk.position.y = h * 0.175; g.add(trunk);
  const greens = [0x3f9e4a, 0x4fb357, 0x2f8a40];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * (0.42 - i * 0.09), h * 0.45, 7), lp.color(greens[i % 3]));
    c.position.y = h * (0.42 + i * 0.2); c.rotation.y = rand(seed + i); c.castShadow = true; g.add(c);
  }
  return g;
}

// ---------------------------------------------------------------- characters (original designs)
export const CAST = {
  otto: { skin: 0xd9a074, hair: 0x3b2a1e, shirt: 0x1fa3a3, vest: 0xffd23f, pants: 0x2d3e63, shoes: 0x5a3a22, hat: 0xff8a1f, mustache: true, glasses: false, hairStyle: 'short' },
  nova: { skin: 0xf2c6a8, hair: 0x7b46c9, shirt: 0x7fe0c4, vest: null, pants: 0x34507d, shoes: 0xe8433b, hat: null, mustache: false, glasses: true, hairStyle: 'bob' },
  crewA: { skin: 0xb9805a, hair: 0x1d1d1d, shirt: 0x3f6fd8, vest: 0xff7a2e, pants: 0x2b2b33, shoes: 0x3a2a1e, hat: 0xffffff, mustache: false, glasses: false, hairStyle: 'short' },
  crewB: { skin: 0xf0c9a0, hair: 0xc9862f, shirt: 0xd8463f, vest: 0xffd23f, pants: 0x2d3e63, shoes: 0x3a2a1e, hat: 0xffd23f, mustache: true, glasses: false, hairStyle: 'short' },
};

/**
 * Character rig ~1.75 units tall (big head, chunky body). Returns a Group with .pose(state).
 * state: {walk (phase, rad), armL/armR [x,y,z] rad, head [x,y], mouth 'smile'|'o'|'flat'|'grin',
 *         blink 0..1, brows -1..1 (worried..happy), lookAt [x,y,z] world (eyes), wave 0..1, point 0..1}
 */
export function makeCharacter(spec, opts = {}) {
  const c = typeof spec === 'string' ? CAST[spec] : spec;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const M = col => lp.color(col);
  const mesh = (geo, mat, parent, pos = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = true; parent.add(m); return m; };

  // legs
  const legs = [-0.13, 0.13].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.62, 0); body.add(hip);
    mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.52, 7), M(c.pants), hip, [0, -0.26, 0]);
    mesh(facet(new THREE.BoxGeometry(0.17, 0.11, 0.27), 0.02), M(c.shoes), hip, [0, -0.56, 0.04]);
    return hip;
  });
  // torso
  const torso = mesh(facet(new THREE.CylinderGeometry(0.25, 0.28, 0.62, 8), 0.03), M(c.shirt), body, [0, 0.93, 0]);
  if (c.vest) {
    const v = mesh(new THREE.CylinderGeometry(0.262, 0.292, 0.4, 8, 1, true), M(c.vest), body, [0, 0.95, 0]);
    v.material.side = THREE.DoubleSide;
    const stripe = mesh(new THREE.CylinderGeometry(0.266, 0.29, 0.05, 8, 1, true), lp.color(0xdfe6ea, { side: THREE.DoubleSide }), body, [0, 0.9, 0]);
    void stripe;
  }
  // arms
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(0.31 * s, 1.18, 0); body.add(sh);
    mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.3, 7), M(c.shirt), sh, [0, -0.15, 0]);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.27, 7), M(c.skin), el, [0, -0.135, 0]);
    mesh(new THREE.IcosahedronGeometry(0.085, 0), M(c.skin), el, [0, -0.29, 0]);
    return { sh, el };
  });
  // head
  const head = new THREE.Group(); head.position.set(0, 1.27, 0); body.add(head);
  mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 7), M(c.skin), head, [0, 0.02, 0]);
  const skull = mesh(facet(new THREE.IcosahedronGeometry(0.33, 2), 0.006, 3), M(c.skin), head, [0, 0.36, 0]);
  skull.scale.set(1, 1.02, 0.95);
  mesh(new THREE.IcosahedronGeometry(0.055, 0), M(c.skin), head, [0, 0.33, 0.32]); // nose
  [-1, 1].forEach(s => mesh(new THREE.IcosahedronGeometry(0.07, 0), M(c.skin), head, [0.33 * s, 0.34, 0])); // ears
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(0.12 * s, 0.42, 0.285); head.add(e);
    const ball = mesh(new THREE.SphereGeometry(0.058, 14, 10), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25 }), e);
    ball.scale.set(1, 1.15, 0.6);
    const hl = mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), e, [0.018, 0.028, 0.03]);
    void hl;
    return e;
  });
  const brows = [-1, 1].map(s => mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), M(c.hair), head, [0.12 * s, 0.52, 0.29]));
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5a1f1f, roughness: 0.6 });
  const mouth = mesh(new THREE.SphereGeometry(0.05, 12, 8), mouthMat, head, [0, 0.235, 0.3]);
  if (c.mustache) mesh(facet(new THREE.BoxGeometry(0.2, 0.05, 0.05), 0.015), M(c.hair), head, [0, 0.28, 0.315]);
  if (c.glasses) {
    const gm = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    [-1, 1].forEach(s => { const r = mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16), gm, head, [0.12 * s, 0.42, 0.31]); r.scale.y = 0.9; });
    mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), gm, head, [0, 0.43, 0.32]);
  }
  // hair / hat
  if (c.hairStyle === 'bob') {
    const hm = M(c.hair);
    const cap = mesh(facet(new THREE.SphereGeometry(0.355, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), 0.012, 5), hm, head, [0, 0.38, -0.015]);
    cap.scale.set(1.04, 1.05, 1.02);
    const back = mesh(facet(new THREE.CylinderGeometry(0.36, 0.33, 0.3, 10, 1, true, Math.PI * 0.55, Math.PI * 0.9), 0.02, 6), hm, head, [0, 0.27, -0.01]);
    back.material.side = THREE.DoubleSide;
    mesh(facet(new THREE.BoxGeometry(0.46, 0.08, 0.12), 0.015), hm, head, [0.02, 0.63, 0.22]).rotation.set(0.35, 0, -0.1); // fringe
  } else {
    const hm = M(c.hair);
    const cap = mesh(facet(new THREE.SphereGeometry(0.345, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), 0.02, 4), hm, head, [0, 0.39, -0.02]);
    void cap;
  }
  if (c.hat) {
    const hm = lp.color(c.hat, { roughness: 0.5 });
    mesh(facet(new THREE.SphereGeometry(0.37, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0.015, 9), hm, head, [0, 0.45, 0]);
    const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 14), hm, head, [0, 0.46, 0.05]);
    brim.scale.z = 1.08;
    mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), hm, head, [0, 0.78, 0]).scale.set(1, 1, 1);
  }

  root.userData = { body, legs, arms, head, eyes, brows, mouth, torso };
  root.pose = (s = {}) => {
    const t = s.walk ?? null;
    const sw = t !== null ? Math.sin(t) : 0;
    legs[0].rotation.x = 0.55 * sw; legs[1].rotation.x = -0.55 * sw;
    body.position.y = t !== null ? Math.abs(Math.cos(t)) * 0.05 : (s.bob ?? 0);
    const armDefault = (i) => [t !== null ? -0.5 * sw * (i ? -1 : 1) : 0.05, 0, (i ? 1 : -1) * 0.12];
    arms.forEach((a, i) => {
      const r = (i === 0 ? s.armL : s.armR) || armDefault(i);
      a.sh.rotation.set(r[0], r[1], r[2]);
      a.el.rotation.x = (i === 0 ? s.elbowL : s.elbowR) ?? -0.15;
    });
    if (s.wave) { const k = s.wave; arms[1].sh.rotation.set(0, 0, 2.6 * k); arms[1].el.rotation.set(0, 0, 0.5 * k + 0.35 * Math.sin((s.time || 0) * 12) * k); }
    if (s.point) { const k = s.point; arms[1].sh.rotation.set(-1.4 * k, 0, 0.25 * k); arms[1].el.rotation.x = -0.1 * k; }
    if (s.thumbs) { const k = s.thumbs; arms[1].sh.rotation.set(-1.1 * k, 0, 0.3 * k); arms[1].el.rotation.x = -1.3 * k; }
    if (s.cheer) { const k = s.cheer; arms.forEach((a, i) => { a.sh.rotation.set(0, 0, (i ? 1 : -1) * 2.7 * k); a.el.rotation.x = 0; }); }
    head.rotation.set((s.head?.[0]) ?? 0, (s.head?.[1]) ?? 0, (s.head?.[2]) ?? 0);
    const blink = s.blink ?? 0;
    eyes.forEach(e => (e.scale.y = Math.max(0.08, 1 - blink)));
    const b = s.brows ?? 0;
    brows.forEach((br, i) => { br.position.y = 0.52 + 0.025 * b; br.rotation.z = (i ? -1 : 1) * (b < 0 ? 0.35 * -b : -0.1 * b); });
    const m = s.mouth || 'smile';
    if (m === 'o') mouth.scale.set(0.9, 1.15, 0.6);
    else if (m === 'flat') mouth.scale.set(1.1, 0.25, 0.5);
    else if (m === 'grin') mouth.scale.set(1.9, 0.75, 0.6);
    else mouth.scale.set(1.5, 0.45, 0.55);
  };
  root.pose({});
  if (opts.scale) root.scale.setScalar(opts.scale);
  return root;
}

/** natural blink value for time t (seconds) with a per-character seed */
export function blinkAt(t, seed = 0) {
  const period = 2.7 + rand(seed) * 1.5;
  const ph = (t + rand(seed + 1) * period) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}

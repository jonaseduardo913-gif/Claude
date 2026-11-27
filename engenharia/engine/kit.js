// Reusable 3D production kit: studio, materials, cutaway (section) system, labels,
// springs, CSG helpers, camera poses, easing and color grading.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';

// ---------------------------------------------------------------- easing / time
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = u => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
export const easeIn = u => Math.pow(clamp(u), 3);
/** eased 0..1 progress of t inside [a,b] */
export const seg = (t, a, b, ease = smooth) => ease((t - a) / (b - a));
export const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
/** deterministic pseudo-random in [0,1) */
export const rand = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- camera
/** pose = {pos:[x,y,z], look:[x,y,z], fov} */
export function applyPose(cam, p) {
  cam.position.set(...p.pos);
  cam.lookAt(...p.look);
  if (p.roll) cam.rotateZ(p.roll);
  if (p.fov && cam.fov !== p.fov) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
}
export function mixPose(a, b, u) {
  return { pos: lerp3(a.pos, b.pos, u), look: lerp3(a.look, b.look, u),
           fov: lerp(a.fov ?? 32, b.fov ?? 32, u), roll: lerp(a.roll || 0, b.roll || 0, u) };
}
/** pose on a sphere around `look` (azimuth/elevation in degrees) */
export function orbit(look, dist, az, el, fov = 32) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return { pos: [look[0] + dist * Math.cos(e) * Math.sin(a), look[1] + dist * Math.sin(e),
                 look[2] + dist * Math.cos(e) * Math.cos(a)], look, fov };
}
/** multi-key camera path: keys = [[time, pose], ...] */
export function path(keys, t, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t <= t1) return mixPose(p0, p1, ease((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- materials
export const mat = {
  steel: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, metalness: 1, roughness: 0.32, clearcoat: 0.2, ...o }),
  darkSteel: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0x4a4f57, metalness: 1, roughness: 0.45, ...o }),
  brass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xd4a94f, metalness: 1, roughness: 0.28, clearcoat: 0.3, ...o }),
  nickel: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xd8d9d4, metalness: 1, roughness: 0.22, clearcoat: 0.4, ...o }),
  springSteel: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.25, ...o }),
  plastic: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.45, clearcoat: 0.3, ...o }),
  glow: (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false, ...o }),
};

let hatchTex = null;
function hatchTexture() {
  if (hatchTex) return hatchTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 7;
  for (let i = -256; i < 512; i += 42) { g.beginPath(); g.moveTo(i, 256); g.lineTo(i + 256, 0); g.stroke(); }
  hatchTex = new THREE.CanvasTexture(c);
  hatchTex.wrapS = hatchTex.wrapT = THREE.RepeatWrapping;
  hatchTex.colorSpace = THREE.SRGBColorSpace;
  hatchTex.anisotropy = 8;
  return hatchTex;
}
/** material for the flat section faces (technical-drawing hatch) */
export function capMaterial(color, tileSize = 0.35) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.1, envMapIntensity: 0.4, map: hatchTexture().clone(), side: THREE.DoubleSide });
  m.map.repeat.set(40 / tileSize, 40 / tileSize);
  m.map.needsUpdate = true;
  return m;
}

// ---------------------------------------------------------------- studio
export function makeStudio(renderer, scene, opts = {}) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = opts.envIntensity ?? 0.6;

  // gradient backdrop
  const bg = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(opts.top ?? 0x1c2a38) }, bottom: { value: new THREE.Color(opts.bottom ?? 0x05080c) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.35, 0.65, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  }));
  bg.renderOrder = -100;
  scene.add(bg);

  // floor with faint technical grid
  const gc = document.createElement('canvas'); gc.width = gc.height = 1024;
  const g = gc.getContext('2d');
  g.fillStyle = '#0b0f14'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(120,170,210,0.10)'; g.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(6, 6); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.75, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = opts.floorY ?? -1.2; floor.receiveShadow = true;
  scene.add(floor);

  const key = new THREE.DirectionalLight(0xfff2e2, 1.7);
  key.position.set(4, 8, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 2.2); rim.position.set(-6, 4, -7); scene.add(rim);
  const fill = new THREE.HemisphereLight(0xbfd6ff, 0x20160c, 0.35); scene.add(fill);
  return { bg, floor, key, rim, fill };
}

// ---------------------------------------------------------------- cutaway / section system
/**
 * True cross-sections of closed meshes: geometry with z > offset is clipped away and
 * the solid interior is capped (stencil technique) with a hatched section material.
 */
export class Cutaway {
  constructor(scene) {
    this.scene = scene;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);
    this.planes = [this.plane];
    this.caps = [];
    this.n = 0;
  }
  set offset(z) { this.plane.constant = z; this._placeCaps(); }
  get offset() { return this.plane.constant; }
  /** arbitrary section plane: keeps the side where normal·p + constant >= 0 */
  setPlane(normal, constant) { this.plane.normal.set(...normal).normalize(); this.plane.constant = constant; this._placeCaps(); }
  /** caps follow the visibility of their mesh (including hidden ancestors); call before each render */
  sync() {
    for (const cap of this.caps) {
      let o = cap.userData.owner, vis = true;
      while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
      cap.visible = vis;
    }
  }
  _placeCaps() {
    const n = this.plane.normal, c = this.plane.constant;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().negate());
    for (const cap of this.caps) { cap.position.copy(n).multiplyScalar(-c); cap.quaternion.copy(q); }
  }
  add(mesh, capMat) {
    mesh.material.clippingPlanes = this.planes;
    mesh.material.clipShadows = true;
    const order = 10 + this.n++ * 3;
    const base = { depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true,
                   stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: this.planes };
    const inc = THREE.IncrementWrapStencilOp, dec = THREE.DecrementWrapStencilOp;
    const back = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ ...base, side: THREE.BackSide, stencilFail: inc, stencilZFail: inc, stencilZPass: inc }));
    const front = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ ...base, side: THREE.FrontSide, stencilFail: dec, stencilZFail: dec, stencilZPass: dec }));
    back.renderOrder = front.renderOrder = order;
    back.raycast = front.raycast = () => {};
    mesh.add(back, front);
    const cm = capMat.clone();
    Object.assign(cm, { stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(this.capSize || 40, this.capSize || 40), cm);
    cap.renderOrder = order + 1;
    cap.userData.owner = mesh;
    this.scene.add(cap);
    this.caps.push(cap);
    this._placeCaps();
    return mesh;
  }
}

// ---------------------------------------------------------------- CSG
const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];
evaluator.useGroups = false;
/** brush(geometry, {pos:[..], rot:[..]}) */
export function brush(geo, { pos = [0, 0, 0], rot = [0, 0, 0] } = {}) {
  const g = geo.index ? geo : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const b = new Brush(g);
  b.position.set(...pos); b.rotation.set(...rot); b.updateMatrixWorld();
  return b;
}
/** csg(baseBrush, [['-', brush], ['+', brush], ['&', brush] ...]) -> BufferGeometry  (- subtract, + union, & intersect) */
export function csg(base, ops) {
  if (!ops.length) { const g = base.geometry.clone(); g.applyMatrix4(base.matrixWorld); g.computeBoundingSphere(); return g; }
  let r = base;
  for (const [op, b] of ops) r = evaluator.evaluate(r, b, op === '+' ? ADDITION : op === '&' ? INTERSECTION : SUBTRACTION);
  const geo = r.geometry; geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------- springs
class Helix extends THREE.Curve {
  constructor(r, turns) { super(); this.r = r; this.turns = turns; }
  getPoint(u, out = new THREE.Vector3()) {
    const a = u * this.turns * Math.PI * 2;
    return out.set(Math.cos(a) * this.r, u, Math.sin(a) * this.r);
  }
}
/** unit-height coil spring along +Y; scale.y = length */
export function springGeometry(radius, wire, turns) {
  return new THREE.TubeGeometry(new Helix(radius, turns), Math.round(turns * 28), wire, 10, false);
}

// ---------------------------------------------------------------- labels (3D callouts)
export class Label {
  /** text: string; opts: {accent, size} ; size = fraction of screen height */
  constructor(ctx, text, opts = {}) {
    this.ctx = ctx;
    (ctx.labels ||= []).push(this);
    const accent = opts.accent || '#39c6ff';
    const c = document.createElement('canvas');
    const fs = 72, padX = 44, padY = 26;
    const g0 = c.getContext('2d'); g0.font = `800 ${fs}px Inter`;
    const lines = text.split('\n');
    const tw = Math.max(...lines.map(l => g0.measureText(l).width + l.length * 3));
    c.width = Math.ceil(tw + padX * 2 + 14); c.height = Math.ceil(lines.length * fs * 1.12 + padY * 2);
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,12,18,0.82)';
    roundRect(g, 0, 0, c.width, c.height, 22); g.fill();
    g.fillStyle = accent; roundRect(g, 0, 0, 14, c.height, 7); g.fill();
    g.font = `800 ${fs}px Inter`; g.fillStyle = '#ffffff'; g.textBaseline = 'top';
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    lines.forEach((l, i) => g.fillText(l, padX + 14, padY + i * fs * 1.12 + 4));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    this.mat = new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true, toneMapped: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.renderOrder = 1000;
    const h = (opts.size ?? 0.032) * 2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov / 2));
    this.sprite.scale.set(h * c.width / c.height, h, 1);
    this.sprite.center.set(opts.alignRight ? 1 : 0, 0.5);
    this.lineMat = new LineMaterial({ color: new THREE.Color(accent), linewidth: 4, transparent: true, depthTest: false, toneMapped: false });
    this.lineMat.resolution.set(ctx.width, ctx.height);
    this.lineGeo = new LineGeometry(); this.lineGeo.setPositions([0, 0, 0, 0, 0, 0]);
    this.line = new Line2(this.lineGeo, this.lineMat); this.line.renderOrder = 999;
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: accent, depthTest: false, transparent: true, toneMapped: false }));
    this.dot.renderOrder = 999;
    this.group = new THREE.Group(); this.group.add(this.sprite, this.line, this.dot);
    ctx.scene.add(this.group);
    this.set(0);
  }
  /**
   * show with opacity; anchor = world point the leader line points to (or null for no leader);
   * at = label position in SCREEN coordinates [x, y] in -1..1 (left/bottom = -1), resolved after the camera is set.
   */
  set(opacity, anchor = null, at = [0, 0]) {
    this.pending = { opacity, anchor, at };
    this.group.visible = false;
  }
  update() {
    if (!this.pending) return;
    const { opacity, at: scr } = this.pending; let anchor = this.pending.anchor; this.pending = null;
    this.group.visible = opacity > 0.001;
    if (!this.group.visible) return;
    const cam = this.ctx.camera;
    cam.updateMatrixWorld();
    const at = new THREE.Vector3(scr[0], scr[1], 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(1.5).add(cam.position).toArray();
    this.line.visible = this.dot.visible = !!anchor;
    if (!anchor) anchor = at;
    this.mat.opacity = opacity; this.lineMat.opacity = opacity; this.dot.material.opacity = opacity;
    this.sprite.position.set(...at);
    this.lineGeo.setPositions([...anchor, ...at]);
    this.line.computeLineDistances();
    this.dot.position.set(...anchor);
    const d = this.ctx.camera.position.distanceTo(this.dot.position);
    this.dot.scale.setScalar(d * 0.0045);
  }
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------------------------------------------------------------- final grade
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.035 },
              fade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float seed; uniform float vignette; uniform float grain; uniform float fade;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed*1.618) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= 0.75;
      float v = smoothstep(0.85, 0.2, length(d));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb = mix(vec3(dot(c.rgb, vec3(0.299,0.587,0.114))), c.rgb, 1.06);
      c.rgb = (c.rgb - 0.5) * 1.04 + 0.5;
      c.rgb += (h(vUv*1000.0) - 0.5) * grain;
      c.rgb *= 1.0 - fade;
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
};

// ---------------------------------------------------------------- reusable mechanical parts
export const parts = {
  /** spur gear: teeth, module (tooth size), width; centered, axis = Z. Pitch radius = module*teeth/2 */
  gearGeometry({ teeth = 20, module = 0.1, width = 0.2, hole = 0.08 } = {}) {
    const rp = module * teeth / 2, ra = rp + module, rf = rp - 1.25 * module;
    const s = new THREE.Shape();
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [[rf, a - step * 0.5], [rf, a - step * 0.27], [ra, a - step * 0.12], [ra, a + step * 0.12], [rf, a + step * 0.27]];
      pts.forEach(([r, ang], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, r * Math.cos(ang), r * Math.sin(ang)));
    }
    s.closePath();
    if (hole > 0) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: module * 0.08, bevelThickness: module * 0.08, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -width / 2);
    g.userData = { pitchRadius: rp, teeth };
    return g;
  },
  /** angular speed of a gear meshing with another: w2 = -w1 * z1 / z2 */
  meshSpeed(w1, z1, z2) { return -w1 * z1 / z2; },

  /** force / flow arrow along +Y; call .setLength(l) */
  arrow(color = 0xff5a36, radius = 0.04) {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4, transparent: true });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 16), m);
    const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.6, radius * 6, 20), m);
    const g = new THREE.Group(); g.add(shaft, head);
    g.setLength = (l) => { const hl = radius * 6; shaft.scale.y = Math.max(0.001, l - hl); shaft.position.y = (l - hl) / 2; head.position.y = l - hl / 2; };
    g.setOpacity = (o) => { m.opacity = o; g.visible = o > 0.001; };
    g.setLength(1);
    return g;
  },

  /** tube along a path of points; returns {mesh, curve} */
  pipe(points, radius = 0.1, material = mat.steel()) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, radius, 24, false), material);
    mesh.castShadow = true;
    return { mesh, curve };
  },

  /** particles flowing along a curve (fluid, current, air). update(time, speed) */
  flow(curve, count = 80, color = 0x39c6ff, size = 0.03) {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 10, 6), mat.glow(color), count);
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
    mesh.update = (time, speed = 0.2, jitter = 0.0) => {
      for (let i = 0; i < count; i++) {
        const u = (i / count + time * speed) % 1;
        curve.getPointAt(u, p);
        if (jitter) p.add(new THREE.Vector3(rand(i) - 0.5, rand(i + 9) - 0.5, rand(i + 17) - 0.5).multiplyScalar(jitter));
        m4.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    mesh.update(0);
    return mesh;
  },

  /** shaft / axle along X */
  shaft(length, radius = 0.05, material = mat.darkSteel()) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32).rotateZ(Math.PI / 2), material);
    m.castShadow = true;
    return m;
  },

  /** see-through shell material for housings when a section cut is not wanted */
  ghost(color = 0x9fd8ff, opacity = 0.18) {
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  },
};

// =====================================================================
//  DINO CONTOS — tiny deterministic 3D cartoon engine (three.js)
//  Every frame is a pure function of time t.
// =====================================================================
import * as THREE from 'three';
export { THREE };

export const W = 1920, H = 1080, FPS = 30;

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const E = {
  lin: (t) => t,
  io: smooth,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  back: (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  step: (t) => (t < 1 ? 0 : 1),
};
const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k));
// keyframe track: [[t, value, ease?], ...] -> fn(t)
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1, e = 'io'] = keys[i + 1];
      if (t < t1) return mix(v0, v1, E[e](seg(t, t0, t1)));
    }
    return keys[keys.length - 1][1];
  };
}
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const noise = (x) => { const i = Math.floor(x), f = x - i; return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1; };
// decaying wobble after an event at time a (squash/stretch, shakes)
export const wob = (t, a, freq = 3, decay = 6) => (t < a ? 0 : Math.sin((t - a) * freq * Math.PI * 2) * Math.exp(-(t - a) * decay));
export const pulse = (t, a, decay = 8) => (t < a ? 0 : Math.exp(-(t - a) * decay));
export const hop = (t, a, d) => (t < a || t > a + d ? 0 : Math.sin(Math.PI * (t - a) / d));

// ------------------------------------------------------------ renderer
export let renderer, scene, camera, sun, hemi, amb;
export function init() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 900);
  hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b5a3a, 0.9); scene.add(hemi);
  amb = new THREE.AmbientLight(0xffffff, 0.15); scene.add(amb);
  sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 120;
  scene.add(sun); scene.add(sun.target);
  return canvas;
}
// sun follows the action so the shadow map stays sharp
export function sunAt(center, dir, size = 14) {
  const d = new THREE.Vector3(...dir).normalize();
  sun.target.position.set(...center);
  sun.position.set(center[0] + d.x * 50, center[1] + d.y * 50, center[2] + d.z * 50);
  const sc = sun.shadow.camera;
  if (sc.right !== size) { sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.updateProjectionMatrix(); }
}
export function cam(pos, look, fov = 40, shake = 0, t = 0) {
  const s = shake;
  camera.position.set(pos[0] + noise(t * 23) * s, pos[1] + noise(t * 29 + 9) * s, pos[2] + noise(t * 19 + 4) * s * 0.5);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.lookAt(look[0] + noise(t * 21 + 3) * s * 0.6, look[1] + noise(t * 25 + 7) * s * 0.6, look[2]);
}

// ------------------------------------------------------- geometry kit
const G = {};
export const geo = {
  get sph() { return G.sph ||= new THREE.SphereGeometry(1, 36, 24); },
  get sphLo() { return G.sphLo ||= new THREE.SphereGeometry(1, 16, 12); },
  get hemi() { return G.hemi ||= new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2); },
  get cyl() { return G.cyl ||= new THREE.CylinderGeometry(1, 1, 1, 28); },
  get cone() { return G.cone ||= new THREE.ConeGeometry(1, 1, 28); },
  get cone6() { return G.cone6 ||= new THREE.ConeGeometry(1, 1, 7); },
  get box() { return G.box ||= new THREE.BoxGeometry(1, 1, 1); },
  get dodec() { return G.dodec ||= new THREE.DodecahedronGeometry(1, 1); },
  get ico() { return G.ico ||= new THREE.IcosahedronGeometry(1, 0); },
  get torus() { return G.torus ||= new THREE.TorusGeometry(1, 0.25, 16, 48); },
  get disc() { return G.disc ||= new THREE.CircleGeometry(1, 40); },
  cap(rad, len) { const k = 'cap' + rad.toFixed(3) + '_' + len.toFixed(3); return G[k] ||= new THREE.CapsuleGeometry(rad, Math.max(0.001, len - 2 * rad), 8, 20); },
  get heart() {
    if (G.heart) return G.heart;
    const s = new THREE.Shape(); s.moveTo(0, -0.9);
    s.bezierCurveTo(-0.3, -0.55, -1.0, -0.2, -1.0, 0.3); s.bezierCurveTo(-1.0, 0.8, -0.4, 1.0, 0, 0.55);
    s.bezierCurveTo(0.4, 1.0, 1.0, 0.8, 1.0, 0.3); s.bezierCurveTo(1.0, -0.2, 0.3, -0.55, 0, -0.9);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 4, curveSegments: 18 });
    g.center(); return (G.heart = g);
  },
};
const MATS = {};
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (MATS[key]) return MATS[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, flatShading: !!o.flat });
  if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
  if (o.side) m.side = THREE.DoubleSide;
  if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
  return (MATS[key] = m);
}
const v3 = (s) => (Array.isArray(s) ? s : [s, s, s]);
// add a mesh to a parent: add(parent, geometry, color|material, pos, scale, rot, opts)
export function add(parent, g, color, pos = [0, 0, 0], scale = 1, rot = [0, 0, 0], o = {}) {
  const m = new THREE.Mesh(typeof g === 'string' ? geo[g] : g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(...pos); m.scale.set(...v3(scale)); m.rotation.set(...rot);
  m.castShadow = o.shadow !== false; m.receiveShadow = o.recv !== false;
  parent.add(m); return m;
}
export function grp(parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g); return g;
}
// limb: pivot at pos, capsule hanging along -Y, returns {pivot, end}
export function limb(parent, pos, len, rad, color, o = {}) {
  const pivot = grp(parent, pos);
  add(pivot, geo.cap(rad, len), color, [0, -len / 2, 0], 1, [0, 0, 0], o);
  const end = grp(pivot, [0, -len, 0]);
  return { pivot, end };
}

// world position of a local point on an object (call after poses are set)
export function worldOf(obj, v = [0, 0, 0]) { obj.updateWorldMatrix(true, false); const w = new THREE.Vector3(...v); obj.localToWorld(w); return [w.x, w.y, w.z]; }

// ------------------------------------------------------------ cartoon eye
// eye object with look(x,y) and blink(0..1)
export function eye(parent, pos, r, o = {}) {
  const g = grp(parent, pos);
  const inner = grp(g);
  add(inner, 'sph', mat(o.white || '#fbfbf6', { r: 0.25 }), [0, 0, 0], r);
  const piv = grp(inner);
  const pr = r * (o.pupil || 0.5);
  add(piv, 'sph', mat(o.iris || '#2a1a10', { r: 0.15 }), [0, 0, r * 0.78], [pr, pr, pr * 0.55]);
  add(piv, 'sph', mat('#ffffff', { e: '#ffffff', ei: 1.2 }), [pr * 0.35, pr * 0.4, r * 0.98], pr * 0.28, [0, 0, 0], { shadow: false });
  // eyelid (skin coloured upper shell)
  const lid = grp(g);
  const lidM = add(lid, new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), o.lid || '#888', [0, 0, 0], r * 1.06);
  lidM.castShadow = false;
  let lashes = null;
  if (o.lashes) {
    lashes = grp(lid);
    for (let i = -1; i <= 1; i++) add(lashes, 'box', '#1a1010', [i * r * 0.45 + (o.side || 1) * r * 0.25, r * 0.95, r * 0.45], [r * 0.08, r * 0.5, r * 0.08], [0.5, 0, -i * 0.35 - (o.side || 1) * 0.3]);
  }
  return {
    g,
    set({ look = [0, 0], blink = 0, lid: lidOpen = 0, squint = 0 } = {}) {
      piv.rotation.set(-look[1] * 0.55, look[0] * 0.6, 0);
      // lid rotation: -PI/2 (fully open, tucked back) .. ~0.05 (closed, covers front)
      const closed = clamp(Math.max(blink, lidOpen));
      lid.rotation.x = lerp(-1.75, 0.08, closed);
      lid.visible = closed > 0.02;
      inner.scale.y = 1 - squint * 0.45;
    },
  };
}
export function blinkAt(t, seed = 0) {
  // natural blinking: a blink every ~3s with jitter
  const period = 3.1 + hash(seed) * 1.5;
  const lt = (t + hash(seed + 3) * period) % period;
  return lt < 0.16 ? Math.sin((lt / 0.16) * Math.PI) : 0;
}

// --------------------------------------------------------------- sky
export function makeSky(o) {
  const u = {
    top: { value: new THREE.Color(o.top) }, mid: { value: new THREE.Color(o.mid) }, bot: { value: new THREE.Color(o.bot) },
    sunDir: { value: new THREE.Vector3(...o.sunDir).normalize() }, sunCol: { value: new THREE.Color(o.sunCol || '#fff3d0') },
    sunSize: { value: o.sunSize ?? 900 }, glow: { value: o.glow ?? 0.5 }, stars: { value: o.stars ?? 0 }, time: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,mid,bot,sunDir,sunCol; uniform float sunSize,glow,stars,time; varying vec3 vD;
      float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){ vec3 d=normalize(vD); float h=d.y;
        vec3 c = mix(bot, mid, smoothstep(-0.08, 0.12, h)); c = mix(c, top, smoothstep(0.1, 0.65, h));
        float s = max(dot(d, sunDir), 0.);
        c += sunCol * (smoothstep(1.0 - 1.0/sunSize*6.0, 1.0 - 1.0/sunSize*5.0, s) * 2.5 + pow(s, 10.) * glow + pow(s, 80.) * glow*0.8);
        if (stars > 0.) { vec3 q = floor(d * 260.); float r = h3(q); float tw = 0.6+0.4*sin(time*3.+r*60.);
          c += vec3(1.) * step(0.9965, r) * smoothstep(0.05, 0.4, h) * stars * tw; }
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), m);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  scene.add(mesh);
  // environment map from the sky -> coherent reflections & ambient
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(mesh.geometry, m));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  return { mesh, u, update(t) { mesh.position.copy(camera.position); u.time.value = t; } };
}

// -------------------------------------------------------------- ground
export function makeGround({ size = 420, seg = 220, height, color }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const cols = new Float32Array(p.count * 3); const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const h = height(x, z); p.setY(i, h);
    color(x, z, h, c); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true; scene.add(m); return m;
}

// --------------------------------------------------- particle sprites
let dotTex;
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (dotTex = new THREE.CanvasTexture(c));
}
export function makePoints(n, { color = '#ffffff', size = 0.1, additive = false, opacity = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, opacity, depthWrite: false, sizeAttenuation: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  return { pts, n, set(fn) { const a = g.attributes.position.array; for (let i = 0; i < n; i++) { const v = fn(i); a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; } g.attributes.position.needsUpdate = true; } };
}

// emote sprites drawn on canvas ("!", "?", "zzz", "♪", sweat, stars, "idea")
const EMO = {};
export function emoteTex(kind) {
  if (EMO[kind]) return EMO[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.lineJoin = 'round'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const txt = (s, col, size) => { x.font = `${size}px "Luckiest Guy"`; x.lineWidth = 22; x.strokeStyle = '#2b1606'; x.strokeText(s, 128, 140); x.fillStyle = col; x.fillText(s, 128, 140); };
  if (kind === '!') txt('!', '#ffd23f', 210);
  else if (kind === '!!') txt('!!', '#ff5a3c', 190);
  else if (kind === '?') txt('?', '#7fd3ff', 210);
  else if (kind === 'z') txt('Zz', '#c9b8ff', 150);
  else if (kind === 'note') txt('♪', '#ffffff', 190);
  else if (kind === 'sweat') { x.fillStyle = '#8fd8ff'; x.strokeStyle = '#1f4f7a'; x.lineWidth = 10; x.beginPath(); x.moveTo(128, 30); x.bezierCurveTo(200, 140, 200, 230, 128, 230); x.bezierCurveTo(56, 230, 56, 140, 128, 30); x.fill(); x.stroke(); }
  else if (kind === 'star') { x.fillStyle = '#ffe14a'; x.strokeStyle = '#7a4a00'; x.lineWidth = 10; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 50 : 115; x.lineTo(128 + Math.cos(a) * r, 135 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); }
  else if (kind === 'anger') { x.strokeStyle = '#ff2a2a'; x.lineWidth = 26; x.lineCap = 'round'; for (const [a, b] of [[[60, 100], [110, 100]], [[110, 100], [110, 50]], [[146, 50], [146, 100]], [[146, 100], [196, 100]], [[60, 156], [110, 156]], [[110, 156], [110, 206]], [[146, 206], [146, 156]], [[146, 156], [196, 156]]]) { x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); } }
  return (EMO[kind] = new THREE.CanvasTexture(c));
}
export function makeEmote(kind) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTex(kind), transparent: true, depthWrite: false }));
  s.visible = false; scene.add(s);
  return { s, set(vis, pos, size = 0.6, rot = 0) { s.visible = vis > 0.01; if (!s.visible) return; s.position.set(...pos); const k = size * vis; s.scale.set(k, k, 1); s.material.rotation = rot; } };
}

// ------------------------------------------------------------ speech
// Dialogue -> captions + syllable timings (drive mouths AND the audio blips)
export function speech(lines, voices) {
  const caps = [], syl = {}, cues = [];
  for (const L of lines) {
    const v = voices[L.who] || { pitch: 220, rate: 1 };
    const words = L.text.replace(/[*]/g, '');
    let t = L.t; const list = (syl[L.who] ||= []);
    let k = 0;
    for (const w of words.split(/\s+/)) {
      const n = Math.max(1, (w.match(/[aeiouáéíóúâêôãõàAEIOUÁÉÍÓÚÂÊÔÃÕ]+/g) || []).length);
      for (let i = 0; i < n; i++) {
        const d = (0.105 + hash(L.t * 13 + k) * 0.06) / (v.rate || 1);
        const loud = /[A-ZÁÉÍÓÚÃÕ]{3,}/.test(w) ? 1.35 : 1;
        list.push([t, t + d * 0.85, loud]);
        cues.push({ type: 'blip', t: +t.toFixed(3), d: +(d * 0.85).toFixed(3), who: L.who, pitch: v.pitch * (0.85 + hash(L.t * 7 + k * 3) * 0.35) * (loud > 1 ? 1.15 : 1), wave: v.wave || 'sq', gain: loud, pan: v.pan || 0 });
        t += d; k++;
      }
      if (/[,.!?…]$/.test(w)) t += 0.16; else t += 0.035;
    }
    caps.push({ t0: L.t, t1: Math.max(t + 0.7, L.t + 1.8, L.hold ? L.t + L.hold : 0), who: L.who, text: L.text, name: v.name, color: v.color });
  }
  // clip captions so they don't overlap the next one
  caps.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < caps.length - 1; i++) caps[i].t1 = Math.min(caps[i].t1, caps[i + 1].t0 - 0.05);
  const mouth = (who, t) => {
    const l = syl[who]; if (!l) return 0;
    for (const [a, b, g] of l) if (t >= a && t < b) return Math.sin(Math.PI * (t - a) / (b - a)) * 0.75 * g;
    return 0;
  };
  return { caps, cues, mouth };
}

// ------------------------------------------------------------ overlay
export function drawCaption(ctx, cap, t) {
  if (!cap) return;
  const a = clamp((t - cap.t0) / 0.15) * clamp((cap.t1 - t) / 0.15);
  if (a <= 0) return;
  const pop = E.back(clamp((t - cap.t0) / 0.22));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '600 50px Fredoka'; const tw = ctx.measureText(cap.text).width;
  ctx.font = '38px "Luckiest Guy"'; const nw = ctx.measureText(cap.name).width;
  const bw = Math.max(tw, nw) + 90, bh = 150, x = W / 2, y = H - 120;
  ctx.translate(x, y); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
  ctx.fillStyle = 'rgba(20,12,6,0.62)'; rrect(ctx, -bw / 2, -bh / 2 + 10, bw, bh - 20, 28); ctx.fill();
  // name tag
  ctx.font = '38px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = cap.color; rrect(ctx, -nw / 2 - 22, -bh / 2 - 22, nw + 44, 56, 18); ctx.fill();
  ctx.fillStyle = '#20120a'; ctx.fillText(cap.name, 0, -bh / 2 + 9);
  ctx.font = '600 50px Fredoka'; ctx.fillStyle = '#fff8ea';
  ctx.fillText(cap.text, 0, 28);
  ctx.restore();
}
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function outlined(ctx, text, x, y, size, fill, { stroke = '#2b1606', lw = 0.11, font = '"Luckiest Guy"', shadow = true } = {}) {
  const fm = font.match(/^(\d+)\s+(.*)$/); ctx.font = fm ? `${fm[1]} ${size}px ${fm[2]}` : `${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = size * lw; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(text, x + size * 0.04, y + size * 0.07); }
  ctx.lineWidth = size * lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
export function drawTitle(ctx, t, { t0, t1, title, ep, color = '#ffd23f' }) {
  if (t < t0 || t > t1) return;
  const a = clamp((t1 - t) / 0.4);
  ctx.save(); ctx.globalAlpha = a;
  const p1 = E.back(seg(t, t0, t0 + 0.6)), p2 = E.back(seg(t, t0 + 0.35, t0 + 1.0)), p3 = clamp((t - t0 - 0.8) / 0.4);
  const g = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.8);
  ctx.save(); ctx.translate(W / 2, 250); ctx.scale(p1, p1); ctx.rotate(-0.04);
  outlined(ctx, 'DINO CONTOS', 0, 0, 92, '#9be36a'); ctx.restore();
  ctx.save(); ctx.translate(W / 2, 420); ctx.scale(p2, p2); ctx.rotate(0.02 * Math.sin(t * 3));
  outlined(ctx, title, 0, 0, 150, color); ctx.restore();
  ctx.globalAlpha = a * p3;
  outlined(ctx, ep, W / 2, 545, 46, '#ffffff', { font: '600 Fredoka', lw: 0.16 });
  ctx.restore();
}
export function drawEnd(ctx, t, t0) {
  if (t < t0) return;
  const p = E.back(seg(t, t0, t0 + 0.7));
  ctx.save(); ctx.translate(W / 2, H / 2 - 40); ctx.scale(p, p); ctx.rotate(-0.05 + 0.03 * Math.sin(t * 2.5));
  outlined(ctx, 'FIM', 0, 0, 260, '#ffd23f'); ctx.restore();
  const q = clamp((t - t0 - 0.6) / 0.5);
  ctx.save(); ctx.globalAlpha = q;
  outlined(ctx, 'Dino Contos', W / 2, H / 2 + 130, 60, '#9be36a'); ctx.restore();
}
export function vignette(ctx, strength = 0.38) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

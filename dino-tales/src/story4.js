// =====================================================================
//  THE LOST EGG — narrator-only cinematic short (≈6:20, 24 fps)
//  Scenes and animation are keyed to the narrator's line timings
//  (src/narr4.json, produced by narration/tts.py).
// =====================================================================
import * as E from './engine.js';
import * as C from './chars.js';
import * as P from './props.js';
import { makeHearts, stepCues, walkPath, face, cueList } from './kit.js';
const { THREE, track, clamp, lerp, seg, hop, wob, pulse, noise, hash, blinkAt, worldOf } = E;
const Ez = E.E;
const PI = Math.PI;

// ------------------------------------------------------------ helpers
const hexC = (h) => new THREE.Color(h);
function instanced(geo, mat, items, { shadow = true, recv = true, chunk = 30 } = {}) {
  const buckets = {};
  for (const it of items) { const k = Math.floor(it.p[0] / chunk) + ',' + Math.floor(it.p[2] / chunk); (buckets[k] ||= []).push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (const list of Object.values(buckets)) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      e.set(...(it.r || [0, 0, 0])); q.setFromEuler(e); const s = it.s ?? 1; sc.set(...(Array.isArray(s) ? s : [s, s, s])); ps.set(...it.p);
      m4.compose(ps, q, sc); im.setMatrixAt(i, m4); if (it.c) im.setColorAt(i, hexC(it.c));
    });
    im.castShadow = shadow; im.receiveShadow = recv; im.computeBoundingSphere(); E.scene.add(im);
  }
}
function gradTex(fn, w = 64, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); }

function makeButterfly(col) {
  const tex = gradTex((x, w, h) => {
    x.fillStyle = col; x.beginPath(); x.ellipse(w * 0.5, h * 0.33, w * 0.48, h * 0.3, 0, 0, PI * 2); x.fill();
    x.beginPath(); x.ellipse(w * 0.45, h * 0.72, w * 0.35, h * 0.22, 0, 0, PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(w * 0.6, h * 0.3, w * 0.12, 0, PI * 2); x.fill();
    x.fillStyle = 'rgba(40,20,60,0.6)'; x.beginPath(); x.arc(w * 0.35, h * 0.68, w * 0.08, 0, PI * 2); x.fill();
  }, 64, 128);
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3, roughness: 0.6, emissive: hexC(col), emissiveIntensity: 0.25 });
  const root = E.grp(E.scene); const wings = [];
  for (const s of [1, -1]) { const piv = E.grp(root); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), m); pl.position.set(s * 0.06, 0, 0); pl.rotation.x = -PI / 2; pl.scale.x = s; piv.add(pl); wings.push({ piv, s }); }
  E.add(root, geo4.cap, E.mat('#2a1a30'), [0, 0, 0], [0.012, 0.012, 0.09], [PI / 2, 0, 0], { shadow: false });
  return { root, set(p, rot, t, k = 1) { root.visible = k > 0; root.position.set(...p); root.rotation.y = rot; wings.forEach(({ piv, s }) => (piv.rotation.z = s * (0.2 + Math.abs(Math.sin(t * 16)) * 1.1))); } };
}
const geo4 = { cap: new THREE.CapsuleGeometry(1, 2, 4, 8) };
function makeBird(col) {
  const root = E.grp(E.scene);
  E.add(root, 'sphLo', E.mat(col), [0, 0, 0], [0.09, 0.08, 0.14], [0, 0, 0], { shadow: false });
  E.add(root, 'sphLo', E.mat(col), [0, 0.05, 0.11], 0.06, [0, 0, 0], { shadow: false });
  E.add(root, 'cone', E.mat('#ffb020'), [0, 0.04, 0.19], [0.02, 0.06, 0.02], [PI / 2, 0, 0], { shadow: false });
  const wings = [1, -1].map((s) => { const piv = E.grp(root, [s * 0.05, 0.02, 0]); E.add(piv, 'sphLo', E.mat(col), [s * 0.11, 0, 0], [0.12, 0.01, 0.06], [0, 0, 0], { shadow: false }); return { piv, s }; });
  return { root, set(p, rot, t, flap = 1, vis = true) { root.visible = vis; root.position.set(...p); root.rotation.set(0, rot, 0); wings.forEach(({ piv, s }) => (piv.rotation.z = s * Math.sin(t * 22) * 0.9 * flap)); } };
}

export async function build() {
  const NR = await (await fetch('./src/narr4.json')).json();
  const L = NR.lines, DUR = Math.ceil(NR.duration);
  const T = (i) => L[i].t, TE = (i) => L[i].t + L[i].d;
  const SC = Object.fromEntries(NR.scenes.map((s) => [s.name, s]));

  // ------------------------------------------------------------ terrain
  const hill = (x, z) => 6.5 * Math.exp(-(((x - 112) ** 2) + (z ** 2) * 0.55) / (2 * 26 * 26));
  const H = (x, z) => hill(x, z) - 1.3 * Math.exp(-((x + 22) ** 2) / (2 * 1.6 * 1.6)) - 1.3 * Math.exp(-((x) ** 2 + (z + 9) ** 2) / (2 * 3.6 * 3.6))
    + E.smooth(clamp((Math.abs(z) - 45) / 45)) * 9 * (0.6 + 0.4 * noise(x * 0.03)) + noise(x * 0.25) * noise(z * 0.3 + 5) * 0.3 * clamp((Math.abs(z) - 3) / 3);
  const BR = [-25.5, -18.5];
  const bridgeY = (x) => 0.2 + 0.5 * Math.sin(PI * (x - BR[0]) / (BR[1] - BR[0]));
  const gy = (x, z) => (x > BR[0] && x < BR[1] && Math.abs(z) < 0.9 ? bridgeY(x) + 0.05 : H(x, z));

  // ------------------------------------------------------------ sky & light presets
  const PRE = {
    dawn: { top: '#5b7fd2', mid: '#ffc6a6', bot: '#ffe6bc', sun: [0.35, 0.11, -1], sunCol: '#ffd9a0', light: '#ffcf98', li: 2.1, hemi: '#d6e3ff', hg: '#7a6a4a', hi: 0.85, fog: '#f1dccb' },
    day: { top: '#3f86e0', mid: '#a2d6f6', bot: '#e8f7ef', sun: [0.35, 0.78, -0.5], sunCol: '#fff4d6', light: '#fff2dc', li: 2.6, hemi: '#d2eaff', hg: '#6d6a3a', hi: 0.95, fog: '#d3e9df' },
    golden: { top: '#4f70c4', mid: '#ffc58e', bot: '#ffe0a6', sun: [0.3, 0.3, 0.9], sunCol: '#ffe0a0', light: '#ffc888', li: 2.3, hemi: '#ffd8b8', hg: '#7a5a3a', hi: 0.85, fog: '#f2d0a6' },
    sunset: { top: '#39378e', mid: '#ff8d5e', bot: '#ffd07c', sun: [0.22, 0.1, 1], sunCol: '#ffdc9a', light: '#ffa064', li: 2.0, hemi: '#ffb898', hg: '#6a4a3a', hi: 0.72, fog: '#eba07c' },
  };
  const sky = E.makeSky({ top: PRE.day.top, mid: PRE.day.mid, bot: PRE.day.bot, sunDir: PRE.day.sun, sunCol: PRE.day.sunCol, glow: 0.75, sunSize: 420 });
  E.scene.fog = new THREE.Fog('#d3e9df', 40, 230);
  E.camera.far = 900; E.camera.updateProjectionMatrix();
  const phaseKeys = [[0, 'dawn'], [50, 'dawn'], [70, 'day'], [298, 'day'], [326, 'golden'], [336, 'sunset']];
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  const mixC = (a, b, k) => tmpA.set(a).lerp(tmpB.set(b), k).getHexString();
  function applyPhase(t) {
    let a = phaseKeys[0], b = phaseKeys[0];
    for (let i = 0; i < phaseKeys.length - 1; i++) if (t >= phaseKeys[i][0]) { a = phaseKeys[i]; b = phaseKeys[i + 1]; }
    if (t >= phaseKeys[phaseKeys.length - 1][0]) a = b = phaseKeys[phaseKeys.length - 1];
    const k = a === b ? 0 : E.smooth(seg(t, a[0], b[0])); const A = PRE[a[1]], B = PRE[b[1]];
    const c = (key) => '#' + mixC(A[key], B[key], k);
    sky.u.top.value.set(c('top')); sky.u.mid.value.set(c('mid')); sky.u.bot.value.set(c('bot')); sky.u.sunCol.value.set(c('sunCol'));
    const sd = A.sun.map((v, i) => lerp(v, B.sun[i], k)); sky.u.sunDir.value.set(...sd).normalize();
    E.sun.color.set(c('light')); E.sun.intensity = lerp(A.li, B.li, k);
    E.hemi.color.set(c('hemi')); E.hemi.groundColor.set(c('hg')); E.hemi.intensity = lerp(A.hi, B.hi, k);
    E.scene.fog.color.set(c('fog'));
    const ld = new THREE.Vector3(sd[0], Math.max(sd[1], 0.45), sd[2]).normalize();
    return [ld.x, ld.y, ld.z];
  }

  // ------------------------------------------------------------ ground
  E.makeGround({
    size: 460, seg: 260, height: H,
    color: (x, z, h, c) => {
      c.setHSL(0.27 + noise(x * 0.2 + z * 0.15) * 0.04, 0.5, 0.37 + noise(x * 0.8 - z * 0.6) * 0.05);
      const onPath = clamp(1 - (Math.abs(z) - 0.9) / 0.7) * clamp((x + 95) / 3) * clamp((101 - x) / 3);
      c.lerp(hexC('#c49a68'), onPath * 0.6);
      if (Math.abs(x + 22) < 2.4) c.lerp(hexC('#8a7a5a'), clamp((2.4 - Math.abs(x + 22)) / 1.2));
      if (Math.hypot(x, z + 9) < 5.2) c.lerp(hexC('#7a7a68'), clamp((5.2 - Math.hypot(x, z + 9)) / 1.2));
    },
  });
  // stream + sparkles, waterfall pool
  const waterM = new THREE.MeshStandardMaterial({ color: '#2f86b0', roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.85 });
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 260), waterM); stream.rotation.x = -PI / 2; stream.position.set(-22, -0.62, 0); stream.receiveShadow = true; E.scene.add(stream);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), waterM); pool.rotation.x = -PI / 2; pool.position.set(0, -0.45, -9); E.scene.add(pool);
  const glints = E.makePoints(160, { color: '#ffffff', size: 0.09, additive: true, opacity: 0.9 });

  // bridge
  const bridge = E.grp(E.scene); const planks = [];
  for (let i = 0; i < 15; i++) {
    const x = lerp(BR[0], BR[1], (i + 0.5) / 15), y = bridgeY(x);
    planks.push(E.add(bridge, 'box', E.mat(i % 2 ? '#a0703e' : '#b58050', { r: 0.85 }), [x, y - 0.04, 0], [0.42, 0.09, 1.7], [0, 0, Math.cos(PI * (x - BR[0]) / 7) * 0.22 * (i % 3 ? 1 : 0.8)]));
  }
  for (const s of [1, -1]) {
    for (const x of [BR[0], (BR[0] + BR[1]) / 2, BR[1]]) E.add(bridge, 'cyl', E.mat('#7a5030'), [x, bridgeY(x) + 0.3, s * 0.85], [0.06, 0.8, 0.06]);
    for (let i = 0; i < 12; i++) { const x0 = lerp(BR[0], BR[1], i / 12), x1 = lerp(BR[0], BR[1], (i + 1) / 12); const y0 = bridgeY(x0) + 0.62 - Math.sin(PI * (i % 6) / 6) * 0.08, y1 = bridgeY(x1) + 0.62 - Math.sin(PI * ((i + 1) % 6) / 6) * 0.08; E.add(bridge, 'cyl', E.mat('#d9c08a'), [(x0 + x1) / 2, (y0 + y1) / 2, s * 0.85], [0.022, Math.hypot(x1 - x0, y1 - y0), 0.022], [0, 0, PI / 2 - Math.atan2(y1 - y0, x1 - x0)]); }
  }
  // waterfall cliff
  const cliff = E.grp(E.scene, [0, 0, -14.5]);
  for (let i = 0; i < 26; i++) { const x = -11 + (i % 9) * 2.8 + hash(i) * 1.2, y = Math.floor(i / 9) * 3.4 + 1.5; E.add(cliff, 'dodec', E.mat(['#8a8f9c', '#7d8290', '#969aa6'][i % 3], { flat: true, r: 0.9 }), [x, y, hash(i * 3) * 1.5 - (Math.abs(x) < 2.5 ? 1.6 : 0)], [2.2 + hash(i * 5) * 0.8, 2.1, 2.0]); }
  for (let i = 0; i < 9; i++) E.add(cliff, 'sph', E.mat('#4f9a45', { r: 0.9 }), [-11 + i * 2.8, 9.6 + hash(i) * 0.6, 0.3], [1.6, 0.8, 1.6]);
  const fallTex = gradTex((x, w, h) => { for (let i = 0; i < 70; i++) { const xx = Math.random() * w; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.3 + Math.random() * 0.6})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(xx, Math.random() * h * 0.5, 1 + Math.random() * 3, h * (0.3 + Math.random() * 0.5)); } }, 128, 256);
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  const fallM = new THREE.MeshStandardMaterial({ color: '#d8f2ff', map: fallTex, transparent: true, opacity: 0.92, roughness: 0.1, emissive: hexC('#9fd8ff'), emissiveIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 10.6, 1, 1), fallM); fall.position.set(0, 4.6, -12.6); fall.rotation.x = -0.08; E.scene.add(fall);
  const fallBack = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 10.6), new THREE.MeshStandardMaterial({ color: '#7cc8ec', roughness: 0.1 })); fallBack.position.set(0, 4.6, -12.9); fallBack.rotation.x = -0.08; E.scene.add(fallBack);
  const mist = E.makePoints(140, { color: '#ffffff', size: 0.55, opacity: 0.35 });
  const rainbow = E.grp(E.scene, [0, -0.6, -8.0]);
  ['#ff4a4a', '#ff9a3a', '#ffe14a', '#5ad15a', '#4aa8ff', '#8a5aff'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(7.2 - i * 0.22, 0.11, 6, 80, PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); rainbow.add(m); });

  // ------------------------------------------------------------ vegetation (instanced)
  const avoid = (x, z) => {
    if (Math.abs(z) < (x > 58 && x < 100 ? 2.4 : 3.4) && x > -100 && x < 104) return true;
    if (Math.abs(x + 22) < 3.2 && Math.abs(z) < 14) return true;
    if (x > -13 && x < 13 && z > -20 && z < 12) return true;
    if (x > 12 && x < 48 && Math.abs(z) < 24) return true;
    if (Math.hypot(x - 113, z + 1) < 15) return true;
    if (Math.hypot(x + 46, z + 2.5) < 4.8) return true;
    if (x > 44 && x < 56 && Math.abs(z) < 7) return true;
    if (x > 100 && x < 122 && z > 3 && z < 22) return true; // sunset viewpoint
    if (x > -92 && x < -60 && z > 2 && z < 16) return true; // opening camera lane
    return false;
  };
  const trunks = [], canopy = [], mush = [], rocks = [];
  const pal = ['#3f8f45', '#4ea64a', '#2f7d3e', '#5cb85a', '#3a9a5a'], blossom = ['#ff9ec8', '#d8a6ff', '#ffc2e0'];
  const addTree = (x, z, h, r, seed, tall = false) => {
    const y = H(x, z);
    trunks.push({ p: [x, y + h / 2, z], s: [r, h, r], c: hash(seed) < 0.5 ? '#7a5234' : '#8a6040' });
    const bl = hash(seed * 7.7) < (tall ? 0.04 : 0.12);
    const n = tall ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const a = hash(seed + i * 3.1) * PI * 2, d = (0.4 + hash(seed + i) * 0.9) * (tall ? 1.3 : 1);
      const cs = (1.4 + hash(seed + i * 5) * 1.0) * (tall ? 1.4 : 1);
      canopy.push({ p: [x + Math.cos(a) * d, y + h + hash(seed + i * 2) * 1.6 - 0.3, z + Math.sin(a) * d], s: [cs, cs * 0.85, cs], c: bl ? blossom[i % 3] : pal[(Math.floor(hash(seed) * 5) + i) % 5] });
    }
    if (hash(seed * 3.3) < 0.5) for (let k = 0; k < 3; k++) { const a = hash(seed + k * 9) * PI * 2; mush.push({ x: x + Math.cos(a) * (r + 0.4), z: z + Math.sin(a) * (r + 0.4), s: 0.6 + hash(seed + k) * 0.6, seed: seed + k }); }
  };
  let sd = 1;
  for (let i = 0; i < 1600 && trunks.length < 620; i++) {
    const x = -115 + hash(i * 3.37) * 265, z = -75 + hash(i * 7.13) * 150;
    if (avoid(x, z)) continue;
    const tall = x > 56 && x < 102 && Math.abs(z) < 16;
    addTree(x, z, tall ? 8 + hash(i) * 5 : 3.5 + hash(i * 1.3) * 3.5, tall ? 0.38 : 0.24 + hash(i) * 0.12, sd++, tall);
  }
  // hero trees
  addTree(-49.6, -4.8, 4.5, 0.3, 501); addTree(-42.6, -5.6, 5, 0.32, 502); P.bush([-43.6, 0, -4.3], 0.75, 509); addTree(-52, 4.2, 4.2, 0.28, 503);
  const sphG = new THREE.SphereGeometry(1, 12, 9);
  instanced(new THREE.CylinderGeometry(0.75, 1, 1, 8), new THREE.MeshStandardMaterial({ roughness: 0.95 }), trunks);
  instanced(sphG, new THREE.MeshStandardMaterial({ roughness: 0.85 }), canopy);
  // giant tree in the clearing
  const giant = E.grp(E.scene, [121, H(121, -8), -8]);
  E.add(giant, 'cyl', E.mat('#6e4a2e', { r: 0.95 }), [0, 4.5, 0], [1.1, 9, 1.1]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; E.add(giant, 'cone', E.mat('#6e4a2e'), [Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1], [0.5, 1.6, 0.5], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]); }
  for (let i = 0; i < 16; i++) { const a = hash(i * 4.1) * PI * 2, d = 1 + hash(i) * 3.5; E.add(giant, 'sph', E.mat(i % 4 === 0 ? '#ffb3d6' : ['#4aa654', '#3f9550', '#5cbf60'][i % 3], { r: 0.85 }), [Math.cos(a) * d, 9 + hash(i * 2) * 3, Math.sin(a) * d], 2.2 + hash(i * 3) * 1.4); }
  // flowers: forest edges + big meadow
  const flowerCols = ['#ff6fa8', '#ffd23f', '#ff8a3c', '#c58cff', '#ffffff', '#7ac8ff', '#ff5a5a'];
  const petals = [], centers = [], stems = [], tufts = [];
  const addFlower = (x, z, s0, seed) => { const y = H(x, z); const s = s0 * 0.62; const c = flowerCols[Math.floor(hash(seed) * 7)]; stems.push({ p: [x, y + 0.14 * s, z], s: [0.012 * s, 0.28 * s, 0.012 * s] }); petals.push({ p: [x, y + 0.29 * s, z], s: [0.1 * s, 0.05 * s, 0.1 * s], c, r: [noise(seed) * 0.4, 0, noise(seed + 3) * 0.4] }); centers.push({ p: [x, y + 0.305 * s, z], s: 0.03 * s }); };
  for (let i = 0; i < 4200; i++) { const x = 12 + hash(i * 1.71) * 36, z = -24 + hash(i * 2.93) * 48; if (x > 44 && Math.abs(z) < 3) continue; if (Math.abs(z) < 1.0) continue; addFlower(x, z, 1 + hash(i) * 0.7, i); }
  for (let i = 0; i < 2600; i++) { const x = -95 + hash(i * 5.19) * 200, z = (hash(i * 6.7) < 0.5 ? -1 : 1) * (1.2 + hash(i * 8.3) ** 1.5 * 9); if (avoid(x, z) && Math.abs(z) > 3.4) continue; if (Math.abs(x + 22) < 3.2 || (x > -13 && x < 13 && z < 5 && z > -20)) continue; addFlower(x, z, 0.9 + hash(i) * 0.6, i + 9000); }
  for (let i = 0; i < 5200; i++) { const x = -100 + hash(i * 3.9) * 230, z = -30 + hash(i * 4.7) * 60; if (Math.abs(z) < 1.0 && x < 104) continue; if (Math.abs(x + 22) < 2.2) continue; if (Math.hypot(x, z + 9) < 4.8) continue; const y = H(x, z); tufts.push({ p: [x, y + 0.08, z], s: [0.06, 0.2 + hash(i) * 0.15, 0.06], c: ['#4c9a3c', '#5bb04a', '#3f8a36'][i % 3], r: [noise(i) * 0.3, 0, noise(i + 5) * 0.3] }); }
  instanced(new THREE.CylinderGeometry(1, 1, 1, 5), E.mat('#3f8f3a'), stems, { shadow: false });
  instanced(new THREE.SphereGeometry(1, 10, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), petals, { shadow: false });
  instanced(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffcf3a', roughness: 0.6 }), centers, { shadow: false });
  instanced(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshStandardMaterial({ roughness: 0.9 }), tufts, { shadow: false });
  // glowing mushrooms
  const mStem = [], mCap = [];
  for (const m of mush) { const y = H(m.x, m.z); mStem.push({ p: [m.x, y + 0.08 * m.s, m.z], s: [0.03 * m.s, 0.16 * m.s, 0.03 * m.s] }); mCap.push({ p: [m.x, y + 0.17 * m.s, m.z], s: [0.09 * m.s, 0.06 * m.s, 0.09 * m.s], c: ['#ff5a7a', '#5ad0ff', '#c07aff'][Math.floor(hash(m.seed) * 3)] }); }
  instanced(new THREE.CylinderGeometry(1, 1, 1, 6), E.mat('#f4ecd8'), mStem, { shadow: false });
  instanced(new THREE.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.12 }), mCap, { shadow: false });
  // rocks along the way, sunset rock
  for (let i = 0; i < 60; i++) { const x = -95 + hash(i * 9.1) * 200, z = (hash(i * 3) < 0.5 ? -1 : 1) * (2.4 + hash(i * 7) * 7); if (avoid(x, z) && Math.abs(z) > 3.4) continue; rocks.push({ p: [x, H(x, z) + 0.05, z], s: [0.35 + hash(i) * 0.4, 0.25 + hash(i + 1) * 0.2, 0.35 + hash(i + 2) * 0.3], r: [0, hash(i) * 6, 0], c: ['#8f8a80', '#9a948a', '#7f7a72'][i % 3] }); }
  instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), rocks);
  const SUNROCK = [109.5, H(109.5, 10.2), 10.2];
  E.add(E.scene, 'dodec', E.mat('#8f887e', { flat: true, r: 0.9 }), [SUNROCK[0], SUNROCK[1] + 0.05, SUNROCK[2]], [0.75, 0.45, 0.65], [0, 0.4, 0]);
  // giant footprints from the egg site to the clearing
  const fpM = E.mat('#7a5a3a', { r: 1 }); const fps = [];
  for (let x = -42; x < 100; x += 1.9) { if (Math.abs(x + 22) < 3.6 || (x > 12 && x < 46 && false)) continue; const z = (Math.round(x / 1.9) % 2 ? -0.55 : 0.55); fps.push([x, z]); }
  for (const [x, z] of fps) { const g = E.grp(E.scene, [x, H(x, z) + 0.012, z], [0, PI / 2 + noise(x) * 0.1, 0]); E.add(g, 'sph', fpM, [0, 0, 0], [0.34, 0.012, 0.42], [0, 0, 0], { shadow: false }); for (let k = -1; k <= 1; k++) E.add(g, 'sph', fpM, [k * 0.21, 0, 0.47], [0.09, 0.012, 0.13], [0, 0, 0], { shadow: false }); }
  // god rays
  const rayTex = gradTex((x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.15, 'rgba(0,0,0,0)'); v.addColorStop(0.75, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = v; x.fillRect(0, 0, w, h); });
  const rays = [];
  const rayM = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 46; i++) {
    const zone = i < 16 ? [-88, -42] : i < 30 ? [58, 100] : [100, 128];
    const x = lerp(zone[0], zone[1], hash(i * 2.3)), z = (hash(i * 4.4) - 0.5) * 16;
    const g = E.grp(E.scene, [x, H(x, z) + 6, z], [0, hash(i) * PI, 0.35]);
    const w = 0.8 + hash(i * 3) * 1.6;
    for (const ry of [0, PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 16), rayM); m.rotation.y = ry; g.add(m); }
    rays.push(g);
  }
  const clouds = [[-80, 48, -160, 7], [20, 55, -190, 8], [120, 46, -150, 6], [60, 50, 170, 7], [140, 44, 190, 8], [-40, 52, 180, 6]].map(([x, y, z, s], i) => P.cloud([x, y, z], s, i));

  // the egg bush (two halves that part) and the rustling bush
  const eggBush = [-46.0, 0, -1.9];
  const halves = [-1, 1].map((sg) => { const g = E.grp(E.scene, [eggBush[0], H(eggBush[0], eggBush[2]), eggBush[2]]); for (let i = 0; i < 5; i++) E.add(g, 'sph', E.mat(['#3b8f3a', '#4ca547', '#2e7a33'][i % 3], { r: 0.85 }), [sg * (0.12 + (i % 3) * 0.16), 0.28 + (i % 2) * 0.18, (i - 2) * 0.13], 0.27 + hash(i + sg) * 0.06); return g; });
  const rustle = E.grp(E.scene, [51.9, H(51.9, 0.9), 0.9]);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; E.add(rustle, 'sph', E.mat(['#4a9f45', '#5cb552', '#3e8a3e'][i % 3], { r: 0.85 }), [Math.cos(a) * 0.3, 0.32 + hash(i) * 0.18, Math.sin(a) * 0.28], 0.32 + hash(i * 2) * 0.1); }
  P.bush([53.2, H(53.2, -0.9), -0.9], 1.0, 71); P.bush([50.4, H(50.4, 4.6), 4.6], 0.9, 72); P.bush([47.5, H(47.5, -2.6), -2.6], 0.8, 73);

  // ------------------------------------------------------------ cast
  const tuca = C.makeHuman({ size: 0.8, headR: 0.34, nose: 1.4, style: 'spiky', cheeks: '#ff9a8a', cloth: '#f0a23a', spot: '#7a3f12' });
  const sib = C.makeTrike({ baby: true, size: 0.42, skin: '#86c96f', belly: '#fff1b8', frill: '#f39a4a', frillRim: '#e07a2a', spot: '#b8e69a' });
  const baby = C.makeTrike({ baby: true, size: 0.22, skin: '#a8de88', belly: '#fff6cc', frill: '#ffbf6a', frillRim: '#f39a4a', spot: '#d2f2b8' });
  const mom = C.makeTrike({ size: 1.75, lashes: true, skin: '#5aa86a', frill: '#e8703a', spot: '#86c98a' });
  const egg = C.makeEgg({ size: 0.55, color: '#fbeed2', spot: '#e7a74a' });
  const eggGlowTex = gradTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.4, 'rgba(255,190,80,0.35)'); g.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 128, 128);
  const eggGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: eggGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); E.scene.add(eggGlow);
  const eggLight = new THREE.PointLight('#ffc860', 0, 4, 1.5); E.scene.add(eggLight);
  egg.top.children.forEach((m) => { if (m.material && !m.userData.zig) { m.material = m.material.clone(); m.material.emissive = hexC('#ffb84a'); m.material.emissiveIntensity = 0.25; } });
  egg.bot.children.forEach((m) => { if (m.material) { m.material = m.material.clone(); m.material.emissive = hexC('#ffb84a'); m.material.emissiveIntensity = 0.25; } });
  const chip = E.add(E.scene, 'sph', E.mat('#fbeed2', { r: 0.5 }), [0, 0, 0], [0.06, 0.02, 0.05]);
  const hat = E.grp(baby.head, [0, 0.38, 0.25]); hat.scale.setScalar(1.15);
  E.add(hat, new THREE.SphereGeometry(1, 24, 8, 0, PI * 2, 0, 0.42 * PI), E.mat('#fbeed2', { side: 1, r: 0.5 }), [0, -0.12, 0], [0.55, 0.6, 0.55]);
  E.add(hat, 'sph', E.mat('#e7a74a'), [0.15, 0.32, 0.2], [0.1, 0.06, 0.1]);
  const butterflies = ['#ff7ab8', '#ffd23f', '#7ac8ff', '#c58cff', '#ff9a3c', '#9ff07a', '#ff7ab8', '#7ac8ff', '#ffd23f', '#c58cff'].map(makeButterfly);
  const birds = Array.from({ length: 8 }, (_, i) => makeBird(['#ff7a5a', '#5a9aff', '#ffd23f', '#ffffff'][i % 4]));
  const hearts = makeHearts(7), hearts2 = makeHearts(7);
  const sparkles = E.makePoints(220, { color: '#fff0a0', size: 0.07, additive: true, opacity: 0.9 });
  const fireflies = E.makePoints(160, { color: '#ffe27a', size: 0.1, additive: true, opacity: 0.0 });
  const boop = P.makeBurst(40, '#ffe6a0', { size: 0.07, additive: true });
  const hatchBurst = P.makeBurst(60, '#fff0b0', { size: 0.08, additive: true });
  const leafBurst = P.makeBurst(40, '#5aa84a', { size: 0.1 });
  const emo = { q: E.makeEmote('?'), ex: E.makeEmote('!'), sex: E.makeEmote('!'), note: E.makeEmote('note') };

  // ------------------------------------------------------------ choreography
  // TUCA path [t, [x, z]]
  const tPath = walkPath([
    [0, [-84, 0]], [6, [-84, 0]], [21.8, [-70, 0.2], 'lin'], [27.5, [-70, 0.2]], [37.6, [-51.6, 0.1], 'lin'],
    [46.7, [-51.6, 0.1]], [50.3, [-46.0, -0.95], 'io'], [75.6, [-46.0, -0.95]], [77.6, [-48.6, -3.6]], [81.6, [-48.6, -3.6]], [83.0, [-44.3, -3.4]], [89.6, [-44.3, -3.4]], [91.8, [-46.0, -2.15]],
    [102.6, [-46.0, -2.15]], [105.5, [-43.2, -0.3]],
    [105.51, [-44.5, 0]], [114.2, [-30, 0], 'lin'], [114.21, [-27.6, 0]], [121.0, [-16.2, 0], 'lin'], [121.01, [-9.5, 1.5]], [128.1, [9.5, 1.5], 'lin'],
    [128.11, [24, 0]], [136.0, [38, 0], 'lin'], [136.01, [45.6, 0]], [140.6, [49.5, 0], 'out'], [146.8, [49.5, 0]], [148.2, [48.9, 0], 'out'],
    [209.5, [48.9, 0]], [217.2, [48.9, 0]], [217.21, [60, 0]], [239.6, [78.8, 0], 'lin'], [255.6, [78.8, 0]], [261.5, [97.2, 0], 'in'], [262.7, [98.5, 0], 'out'],
    [262.71, [101.8, 0.6]], [266.5, [104.3, 0.9], 'out'], [330.1, [104.3, 0.9]], [330.11, [SUNROCK[0], SUNROCK[2]]],
  ], 1.5);
  const tRot = track([[0, PI / 2], [38, PI / 2], [39.2, 1.93], [46.6, 1.93], [47.0, 1.78], [49.8, 1.78], [50.3, PI], [75.6, PI], [76.0, 3.9], [81.6, 3.9], [82.1, 1.55], [82.8, 2.42], [89.6, 2.42], [90.2, 5.34], [91.6, 5.34], [92.2, PI], [100.5, PI], [101.6, PI / 2],
    [146.7, PI / 2], [147.2, PI / 2], [166, PI / 2], [209.5, PI / 2], [262.71, 1.4], [266.6, 1.2], [301, 1.2], [307.5, 1.25], [330.1, 1.25], [330.11, 0]]);
  const isKneel = (t) => (t >= 92.6 && t < 95.4) || (t >= 166.4 && t < 209.4);
  const kneelK = (t) => Math.max(Ez.io(seg(t, 92.6, 93.2)) * (1 - Ez.io(seg(t, 94.8, 95.4))), Ez.io(seg(t, 166.4, 167.2)) * (1 - Ez.io(seg(t, 208.8, 209.6))));
  // egg: on the grass -> in Tuca's arms (93.8 .. 182.2) -> on the grass in front of him
  const EGG0 = [-46.0, 0, -2.95];
  const EGG1 = [49.55, H(49.55, 0), 0]; const EY = EGG1[1];
  // sibling (little dinosaur) path
  const sPath = walkPath([[0, [52.45, 0.5]], [151.6, [52.45, 0.5]], [153.4, [51.0, 0.35], 'out'], [165.6, [51.0, 0.35]], [168.6, [49.85, 0.05], 'io'], [170.6, [49.85, 0.05]], [171.8, [50.45, -0.6], 'out'],
    [217.2, [50.45, -0.6]], [217.21, [61.2, -0.7]], [239.6, [80.0, -0.7], 'lin'], [255.6, [80.0, -0.7]], [261.5, [98.8, -0.6], 'in'], [262.7, [99.8, -0.6], 'out'],
    [262.71, [103.0, -0.3]], [266.0, [105.3, 0.0], 'out'], [281.4, [105.3, 0.0]], [284.6, [115.5, -2.4], 'in'], [322, [115.5, -2.4]], [330, [127.0, -14.4], 'lin']], 1.6);
  const sRot = track([[0, -2.0], [153.4, -PI / 2], [165.5, -PI / 2], [170.6, -PI / 2], [171.8, -1.03], [209, -1.03], [212.5, PI / 2], [217.21, PI / 2], [262.71, 1.3], [281.4, 1.3], [282, 1.65]]);
  // hatchling
  const bPath = walkPath([[0, EGG1.filter((_, i) => i !== 1)], [217.2, [EGG1[0] + 0.15, EGG1[2] + 0.1]], [217.21, [59.2, 0.7]], [239.6, [77.6, 0.7], 'lin'], [255.6, [77.6, 0.7]], [261.5, [96.0, 0.6], 'in'], [262.7, [97.0, 0.6], 'out'],
    [262.71, [103.2, 1.2]], [266.0, [104.9, 1.4], 'out'], [282.2, [104.9, 1.4]], [287.4, [114.9, -1.8], 'io']], 1.2);
  // mother
  const MOM0 = [118.6, -4.7];
  const mPath = walkPath([[0, MOM0], [321.5, MOM0], [330, [129.5, -16.5], 'lin']], 1.4);
  const mRot = track([[0, -2.6], [264, -2.6], [266.5, -2.2], [268.5, -2.9], [271, -2.3], [273.5, -2.75], [275.6, -2.6], [277.2, -1.0], [306.8, -1.0], [308.3, -1.2], [319.8, -1.2], [321.5, 2.38], [330, 2.38]]);

  // ------------------------------------------------------------ audio cues
  const cues = cueList();
  for (const l of L) cues.at(l.t, 'voice', { file: l.file, gain: 1.0 });
  const mus = (t0, t1, style, gain) => cues.at(t0, 'music', { style, t1, gain });
  mus(0, 56.5, 'magic', 0.42); mus(56.5, 105.5, 'tender', 0.36); mus(105.5, 136.0, 'adventure', 0.36); mus(136.0, 165.2, 'curious', 0.33);
  mus(165.2, 217.3, 'tender', 0.36); mus(217.3, 241.5, 'magic', 0.36); mus(246, 255.5, 'curious', 0.3); mus(255.5, 263, 'adventure', 0.34);
  mus(262.8, 301.1, 'tender', 0.42); mus(301.1, 330.2, 'magic', 0.38); mus(330.2, DUR, 'sunset', 0.42);
  cues.at(0, 'amb', { kind: 'forest', t1: 105.5, gain: 0.55 }).at(105.5, 'amb', { kind: 'stream', t1: 121.2, gain: 0.7 }).at(121.0, 'amb', { kind: 'falls', t1: 128.3, gain: 0.8 })
    .at(128.1, 'amb', { kind: 'forest', t1: 330, gain: 0.5 }).at(330, 'amb', { kind: 'night', t1: DUR, gain: 0.5 }).at(330, 'amb', { kind: 'forest', t1: 345, gain: 0.25 });
  stepCues(cues, 6, 21.8, 9, 'step', 0.25); stepCues(cues, 27.5, 37.6, 9, 'step', 0.25); stepCues(cues, 46.7, 50.3, 6, 'step', 0.18);
  cues.at(23.3, 'twinkle', { gain: 0.4 });
  for (const tt of [41.6, 43.2, 45.0]) cues.at(tt, 'twinkle', { gain: 0.35 });
  cues.at(50.8, 'rustle', { gain: 0.6 }).at(53.6, 'twinkle', { gain: 0.8 }).at(57.8, 'shimmer');
  cues.at(92.9, 'rustle', { gain: 0.25 }).at(94.0, 'twinkle', { gain: 0.4 });
  stepCues(cues, 106, 114.2, 9, 'step', 0.22); stepCues(cues, 114.2, 121, 9, 'plank', 0.4); stepCues(cues, 128.1, 140.6, 9, 'step', 0.22);
  cues.at(137.0, 'rustle', { gain: 1.0, d: 1.6 }).at(143.4, 'rustle', { gain: 1.0, d: 1.8 }).at(147.0, 'step', { gain: 0.4 }).at(150.8, 'rustle', { gain: 0.6 }).at(152.8, 'boing', { gain: 0.25 }).at(153.3, 'twinkle', { gain: 0.5 });
  stepCues(cues, 165.6, 168.6, 12, 'hop', 0.25); cues.at(169.6, 'boop').at(174.9, 'crack', { gain: 1.2 }).at(177.6, 'plop', { gain: 0.6 }).at(181.4, 'wobble').at(182.5, 'wobble').at(183.6, 'wobble');
  cues.at(186.0, 'crack', { gain: 0.6 }).at(188.5, 'crack', { gain: 0.7 }).at(190.8, 'pop', { gain: 0.8 }).at(193.2, 'shimmer');
  cues.at(200.4, 'squeak').at(201.2, 'heart').at(204.8, 'heart', { gain: 0.6 });
  stepCues(cues, 217.3, 239.6, 7, 'step', 0.2); stepCues(cues, 217.3, 239.6, 10, 'hop', 0.12);
  cues.at(245.6, 'roar', { gain: 0.55, soft: 1 }).at(245.8, 'flap', { gain: 0.6 }).at(246.1, 'flap', { gain: 0.5 }).at(246.4, 'flap', { gain: 0.4 }).at(252.5, 'squeak', { gain: 0.7 });
  stepCues(cues, 255.6, 261.5, 13, 'step', 0.3);
  cues.at(264.6, 'shimmer').at(276.2, 'twinkle').at(284.4, 'squeak', { gain: 0.6 }).at(289.5, 'heart').at(291.0, 'heart', { gain: 0.6 }).at(295.2, 'heart', { gain: 0.5 });
  stepCues(cues, 321.5, 330, 4, 'thud', 0.25);
  cues.at(363.0, 'shimmer').at(369.5, 'sting', { gain: 0.8 });

  // ------------------------------------------------------------ cameras
  const C2 = (t, a, b, p0, p1, l0, l1, f0 = 40, f1 = f0, ez = E.smooth) => { const k = ez(seg(t, a, b)); return [p0.map((v, i) => lerp(v, p1[i], k)), l0.map((v, i) => lerp(v, l1[i], k)), lerp(f0, f1, k)]; };
  const tp = (t) => { const p = tPath.pos(t); return [p[0], gy(p[0], p[2]), p[2]]; };
  const shots = [
    // 1 THE MAGICAL FOREST
    [0, (t) => C2(t, 0, 12, [-70, 26, 22], [-76, 3.2, 9], [-86, 9, -60], [-82, 1.2, 0], 44, 40)],
    [12, (t) => { const p = tp(t); return [[p[0] + 1.6, 1.0, 3.6], [p[0] + 0.3, 0.75, 0], 38]; }],
    [21.8, (t) => C2(t, 21.8, 27.5, [-68.4, 0.95, 2.9], [-68.7, 0.9, 2.4], [-70, 0.8, 0.2], [-70, 0.85, 0.2], 34, 30)],
    [27.5, (t) => { const p = tp(t); return [[p[0] + 4.2, 1.05, 0.4 + (t - 27.5) * 0.02], [p[0], 0.75, 0], 36]; }],
    // 2 A MYSTERIOUS SOUND
    [34.2, (t) => { const p = tp(t); return C2(t, 34.2, 41.5, [p[0] + 3.4, 0.95, 1.8], [-48.6, 1.0, 2.8], [p[0], 0.75, 0], [-51.6, 0.82, 0], 38, 32); }],
    [41.5, (t) => C2(t, 41.5, 46.7, [-54.6, 1.15, 2.4], [-54.0, 1.05, 2.0], [-46.0, 0.5, -1.9], [-46.0, 0.5, -1.9], 34, 28)],
    [46.7, (t) => { const p = tp(t); return [[p[0] - 0.6, 0.85, 2.6], [p[0] + 0.6, 0.6, -0.8], 40]; }],
    [50.4, (t) => C2(t, 50.4, 56.5, [-45.95, 0.42, -4.0], [-45.95, 0.42, -3.8], [-46.0, 0.8, -0.95], [-46.0, 0.85, -0.95], 42, 36)],
    // 3 THE LOST EGG
    [56.5, (t) => C2(t, 56.5, 63.4, [-44.9, 0.6, -3.6], [-45.4, 0.4, -3.35], [-46.0, 0.25, -2.95], [-46.0, 0.24, -2.95], 40, 34)],
    [63.4, (t) => { const a = lerp(-0.4, -2.6, E.smooth(seg(t, 63.4, 68.9))); return [[EGG0[0] + Math.cos(a) * 1.3, 0.42, EGG0[2] + Math.sin(a) * 1.3], [EGG0[0], 0.22, EGG0[2]], 34]; }],
    [68.9, (t) => C2(t, 68.9, 71.8, [-45.9, 0.8, -3.9], [-45.95, 0.8, -3.7], [-46.0, 0.8, -0.95], [-46.0, 0.82, -0.95], 26, 22)],
    [71.8, (t) => C2(t, 71.8, 75.6, [-46.0, 7.5, 3.5], [-46.0, 8.5, 4.0], [-46.0, 0, -2.2], [-46.0, 0, -2.2], 40)],
    [75.6, (t) => { const p = tp(t); return [[p[0] + 2.4, 1.3, p[2] + 3.2], [p[0] - 0.4, 0.7, p[2] - 0.6], 42]; }],
    [79.3, (t) => [[-47.0, 1.1, -1.8], [-48.9, 0.85, -4.0], 40]],
    [83.0, (t) => [[-42.6, 0.85, -1.9], [-44.2, 0.6, -3.7], 40]],
    [84.9, (t) => C2(t, 84.9, 88.3, [-43.0, 0.95, -4.9], [-43.2, 0.92, -4.7], [-44.3, 0.85, -3.4], [-44.3, 0.85, -3.4], 34, 30)],
    [88.3, (t) => C2(t, 88.3, 92.5, [-38, 3.0, 9], [-39, 3.6, 10], [-45.5, 0.8, -2.5], [-45.5, 1.0, -2.5], 40)],
    [92.5, (t) => [[-44.9, 0.7, -3.4], [-46.0, 0.45, -2.4], 40]],
    [96.5, (t) => C2(t, 96.5, 100, [-45.8, 0.85, -3.6], [-45.85, 0.84, -3.4], [-46.0, 0.8, -2.15], [-46.0, 0.8, -2.15], 32, 28)],
    [100, (t) => C2(t, 100, 105.5, [-49.6, 1.1, -1.0], [-49.8, 2.0, -0.6], [-46.0, 0.8, -1.6], [-40, 1.0, 0], 42)],
    // 4 FOLLOWING THE FOOTPRINTS
    [105.5, (t) => C2(t, 105.5, 109.5, [-43.1, 0.35, 1.1], [-43.6, 0.55, 1.0], [-43.4, 0.0, 0.4], [-41.0, 0.4, 0], 42)],
    [109.5, (t) => { const p = tp(t); return [[p[0] - 3.0, 1.3, 1.3], [p[0] + 2, 0.7, 0], 42]; }],
    [114.2, (t) => C2(t, 114.2, 121, [-24.5, 1.2, 6.2], [-20.0, 1.3, 6.0], [-24.0, 0.4, 0], [-18.5, 0.5, 0], 42)],
    [121.0, (t) => C2(t, 121.0, 128.1, [-4.5, 1.7, 7.6], [3.5, 1.8, 7.6], [-1.5, 3.0, -9], [1.5, 3.0, -9], 50)],
    [128.1, (t) => { const p = tp(t); const k = E.smooth(seg(t, 128.1, 136)); return [[p[0] - 1.5 + k * 1, lerp(0.45, 4.5, k), lerp(3.0, 8.5, k)], [p[0] + 1, lerp(0.5, 0.6, k), 0], lerp(36, 46, k)]; }],
    // 5 A LITTLE SURPRISE
    [136.0, (t) => { const p = tp(t); return [[p[0] - 2.6, 1.1, 2.6], [p[0] + 1.5, 0.65, 0.3], 40]; }],
    [140.7, (t) => C2(t, 140.7, 143.2, [50.9, 0.95, 1.6], [50.7, 0.92, 1.4], [49.4, 0.85, 0], [49.4, 0.85, 0], 32, 28)],
    [143.2, (t) => C2(t, 143.2, 146.7, [50.2, 0.6, 2.9], [50.5, 0.6, 2.6], [51.9, 0.55, 0.9], [51.9, 0.55, 0.9], 38, 32)],
    [146.7, (t) => [[47.2, 0.85, 2.6], [50.4, 0.6, 0.4], 40]],
    [149.3, (t) => C2(t, 149.3, 156.5, [50.0, 0.42, 2.3], [50.1, 0.4, 2.0], [51.7, 0.4, 0.9], [51.1, 0.32, 0.4], 34, 30)],
    [156.5, (t) => C2(t, 156.5, 160.7, [50.0, 0.42, 1.5], [50.1, 0.4, 1.35], [51.0, 0.32, 0.35], [51.0, 0.32, 0.35], 34, 30)],
    [160.7, (t) => [[50.8, 0.5, 1.9], [49.6, 0.55, 0.1], 42]],
    // 6 THE EGG HATCHES
    [165.2, (t) => C2(t, 165.2, 172.2, [49.4, 0.6, 2.4], [49.4, 0.55, 2.0], [49.45, 0.4, 0], [49.45, 0.4, 0], 38, 34)],
    [172.2, (t) => C2(t, 172.2, 176.9, [49.3, 0.48, 1.35], [49.3, 0.46, 1.15], [49.35, 0.42, 0], [49.35, 0.42, 0], 30, 26)],
    [176.9, (t) => C2(t, 176.9, 181.0, [49.0, 0.3, 1.3], [49.1, 0.25, 1.2], [49.5, 0.2, 0.1], [49.5, 0.15, 0.1], 38, 36)],
    [181.0, (t) => [[50.6, 0.75, 1.9], [49.4, 0.4, 0], 40]],
    [184.8, (t) => C2(t, 184.8, 192.8, [49.45, 0.5, 1.3], [49.45, 0.42, 1.0], [49.55, 0.22, 0], [49.55, 0.28, 0], 36, 30)],
    [192.8, (t) => C2(t, 192.8, 196.3, [49.4, 0.6, 1.7], [49.4, 0.58, 1.5], [49.6, 0.35, -0.1], [49.6, 0.35, -0.1], 36, 32)],
    [196.3, (t) => [[49.15, 0.36, 0.8], [49.57, 0.28, 0], 32]],
    [203.4, (t) => C2(t, 203.4, 209.3, [50.3, 0.75, 1.7], [50.1, 0.72, 1.5], [49.1, 0.65, 0], [49.1, 0.65, 0], 34, 30)],
    [209.3, (t) => C2(t, 209.3, 217.3, [47.2, 0.9, 1.6], [46.0, 1.4, 1.8], [49.6, 0.7, 0], [56, 1.2, 0], 40)],
    // 7 THE JOURNEY CONTINUES
    [217.3, (t) => { const p = tp(t); return [[p[0] + 0.3, 0.75, 3.2], [p[0] + 0.3, 0.6, 0], 40]; }],
    [227.0, (t) => C2(t, 227.0, 231.6, [68.5, 0.6, 0.5], [68.5, 1.4, 0.4], [76, 6, 0], [76, 8, 0], 52)],
    [231.6, (t) => { const p = tp(t); return [[p[0] - 3.4, 0.9, 1.1], [p[0] + 1, 0.5, 0], 38]; }],
    // 8 A FAMILIAR ROAR
    [239.9, (t) => C2(t, 239.9, 247.9, [80.6, 0.8, 2.3], [80.2, 0.75, 2.0], [79.0, 0.65, 0], [79.2, 0.75, 0], 38, 32)],
    [247.9, (t) => C2(t, 247.9, 252.3, [80.9, 0.32, 0.6], [80.8, 0.3, 0.4], [80.0, 0.33, -0.7], [80.0, 0.38, -0.7], 36, 32)],
    [252.3, (t) => [[81.4, 0.5, 1.6], [79.6, 0.4, -0.3], 40]],
    [255.6, (t) => { const k = E.smooth(seg(t, 255.6, 262.8)); return [[lerp(76, 93, k), lerp(0.9, 1.6, k), lerp(1.2, 1.2, k)], [lerp(80, 104, k), lerp(0.6, 1.2, k), 0], 44]; }],
    // 9 THE REUNION
    [262.8, (t) => C2(t, 262.8, 267.5, [103.6, H(104, 0) + 1.5, 3.4], [104.6, H(105, 0) + 1.4, 2.8], [118.6, H(118, -4) + 1.8, -4.7], [118.6, H(118, -4) + 2.0, -4.7], 34, 28)],
    [267.5, (t) => C2(t, 267.5, 275.5, [114.4, H(114, -10) + 1.5, -10.2], [114.8, H(114, -10) + 1.6, -9.8], [118.4, H(118, -5) + 2.0, -5.0], [118.4, H(118, -5) + 2.1, -5.0], 42, 38)],
    [275.5, (t) => C2(t, 275.5, 281.5, [112.6, H(113, -1) + 1.7, -0.6], [113.2, H(113, -1) + 1.75, -1.1], [116.2, H(116, -3) + 2.4, -3.0], [116.2, H(116, -3) + 2.4, -3.0], 36, 30)],
    [281.5, (t) => { const k = E.smooth(seg(t, 281.5, 288)); return [[lerp(106, 109, k), H(107, 3) + 1.0, lerp(4.5, 3.5, k)], [lerp(108, 113, k), H(110, -1) + 0.6, lerp(-0.5, -2.2, k)], 40]; }],
    [288.2, (t) => C2(t, 288.2, 294.8, [113.6, H(113, 0) + 1.0, 0.6], [114.0, H(114, 0) + 0.95, 0.2], [115.6, H(115, -2) + 0.8, -2.4], [115.6, H(115, -2) + 0.8, -2.4], 38, 32)],
    [294.8, (t) => C2(t, 294.8, 301.1, [108.5, H(108, 4) + 2.2, 6.5], [107.5, H(107, 4) + 4.5, 9], [115.5, H(115, -3) + 1.2, -3.2], [116, H(116, -3) + 1.5, -3.6], 40, 44)],
    // 10 A SPECIAL GOODBYE
    [301.1, (t) => C2(t, 301.1, 306.9, [106.0, H(106, 2) + 0.9, 2.6], [105.8, H(106, 2) + 0.9, 2.3], [104.3, H(104, 1) + 0.85, 0.9], [104.3, H(104, 1) + 0.85, 0.9], 34, 30)],
    [306.9, (t) => [[102.3, H(102, 2) + 1.5, 2.4], [117, H(117, -4) + 2.0, -3.6], 30]],
    [315.1, (t) => [[103.0, H(103, 3) + 1.1, 3.2], [108, H(108, -1) + 0.8, -1.0], 40]],
    [321.4, (t) => { const k = E.smooth(seg(t, 321.4, 330.2)); return [[lerp(103.5, 102.5, k), H(103, 2) + lerp(1.4, 2.4, k), lerp(2.6, 3.4, k)], [lerp(118, 126, k), H(118, -6) + 1.6, lerp(-6, -13, k)], 40]; }],
    // 11 A LESSON TO REMEMBER
    [330.2, (t) => C2(t, 330.2, 336.9, [SUNROCK[0] + 1.6, SUNROCK[1] + 1.25, SUNROCK[2] + 2.4], [SUNROCK[0] + 1.3, SUNROCK[1] + 1.2, SUNROCK[2] + 2.0], [SUNROCK[0], SUNROCK[1] + 1.15, SUNROCK[2]], [SUNROCK[0], SUNROCK[1] + 1.15, SUNROCK[2]], 34, 30)],
    [336.9, (t) => C2(t, 336.9, 346.0, [SUNROCK[0] - 1.6, SUNROCK[1] + 1.4, SUNROCK[2] - 2.6], [SUNROCK[0] - 1.2, SUNROCK[1] + 1.5, SUNROCK[2] - 2.2], [SUNROCK[0] + 2, SUNROCK[1] + 1.6, SUNROCK[2] + 12], [SUNROCK[0] + 2, SUNROCK[1] + 1.7, SUNROCK[2] + 12], 44)],
    [346.0, (t) => C2(t, 346.0, 353.3, [SUNROCK[0] + 0.9, SUNROCK[1] + 1.15, SUNROCK[2] + 1.9], [SUNROCK[0] + 0.75, SUNROCK[1] + 1.12, SUNROCK[2] + 1.7], [SUNROCK[0], SUNROCK[1] + 1.12, SUNROCK[2]], [SUNROCK[0], SUNROCK[1] + 1.12, SUNROCK[2]], 34, 30)],
    [353.3, (t) => C2(t, 353.3, DUR, [SUNROCK[0] - 0.8, SUNROCK[1] + 1.3, SUNROCK[2] - 2.2], [SUNROCK[0] - 9, SUNROCK[1] + 15, SUNROCK[2] - 22], [SUNROCK[0] + 1, SUNROCK[1] + 1.4, SUNROCK[2] + 10], [SUNROCK[0] + 4, SUNROCK[1] + 3, SUNROCK[2] + 40], 44, 50, Ez.io)],
  ];

  // ------------------------------------------------------------ frame
  function frame(t) {
    const ld = applyPhase(t); sky.update(t);
    fallTex.offset.y = (t * 1.6) % 1;
    // ---- mother (first: others depend on her)
    const mp = mPath.pos(t);
    let m = { pos: [mp[0], H(mp[0], mp[2]), mp[2]], rot: mRot(t), phase: t * 4.5, walk: mPath.walk(t), t, head: [0, 0, 0], look: [0, 0], blink: blinkAt(t, 21), lid: 0, squint: 0, tailWag: 0.2, mouth: 0 };
    if (t < 275.6) { m.head = [0.15 + Math.sin(t * 1.3) * 0.08, Math.sin(t * 0.9) * 0.4, 0]; m.lid = 0.25; m.look = [Math.sin(t * 0.9) * 0.6, -0.1]; }
    if (t >= 275.6 && t < 281.5) { const k = seg(t, 275.6, 276.6); m.head = [-0.15 * k, 0, 0]; m.squint = 0.7 * seg(t, 276.4, 277.4); m.mouth = 0.35 * k; m.look = [-0.2, -0.2]; m.tailWag = 1; }
    if (t >= 281.5 && t < 301) { const k = Ez.io(seg(t, 285.5, 288.5)); m.head = [0.75 * k, 0, Math.sin(t * 2.4) * 0.12 * seg(t, 288.5, 289)]; m.squint = 0.65; m.mouth = 0.2; m.tailWag = 1; m.look = [0, -0.5]; }
    if (t >= 301 && t < 321.5) { m.head = [0.15, 0, 0]; m.squint = 0.4; m.look = [-0.3, -0.3]; if (t > 308.4 && t < 312.8) { const b = Math.sin(PI * seg(t, 308.4, 312.8)); m.head = [0.15 + 0.6 * b, 0, 0]; m.lid = 0.6 * b; } }
    if (t >= 321.5) { m.squint = 0.3; }
    mom.set(m);

    // ---- Tuca
    const tpp = tp(t), kn = kneelK(t);
    const tw = tPath.walk(t);
    let u = { pos: [tpp[0], tpp[1], tpp[2]], rot: tRot(t), phase: t * 9, walk: tw, look: [0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], lean: 0, brow: 0, squint: 0, smile: 0.4, mouth: 0, blink: blinkAt(t, 1), lid: 0, legL: 0, legR: 0, legOut: 0, hairUp: 0 };
    const carrying = t >= 93.9 && t < 182.4;
    if (t < 21.8) { u.head = [0, Math.sin(t * 0.8) * 0.3, Math.sin(t * 2) * 0.05]; u.look = [Math.sin(t * 0.8) * 0.5, 0.15]; u.smile = 1; }
    if (t >= 21.8 && t < 27.5) { const k = seg(t, 22.3, 23.3); u.look = [0, -0.1 + 0.25 * k]; u.squint = 0.3 * k; u.smile = 1; u.mouth = 0.2 * k; u.head = [-0.1 * k, 0, 0.12 * k]; u.brow = 0.6 * k; }
    if (t >= 27.5 && t < 37.6) { u.smile = 1; u.look = [0.2, 0.1]; }
    if (t >= 37.6 && t < 46.7) { const k = seg(t, 38.4, 39.4); u.head = [0, 0.5 * k, 0.15 * k]; u.look = [0.6 * k, 0]; u.brow = 0.8 * k; u.smile = 0.3; if (t > 41.6) { u.armR = [-0.4, 0, 0.9]; } }
    if (t >= 46.7 && t < 50.4) { u.lean = 0.25; u.look = [0, -0.2]; u.brow = 0.6; u.walk = tw * 0.6; u.armL = [-0.7, 0, 0.3]; u.armR = [-0.7, 0, 0.3]; }
    if (t >= 50.4 && t < 56.5) { const k = Ez.out(seg(t, 50.6, 51.6)); u.armL = [-1.4, 0, -0.1 + 0.8 * k]; u.armR = [-1.4, 0, -0.1 + 0.8 * k]; u.lean = 0.15; if (t > 53.3) { u.brow = 1; u.mouth = 0.6; u.look = [0, -0.3]; u.squint = 0; u.lean = 0.05; } }
    if (t >= 56.5 && t < 75.6) { u.look = [0, -0.6]; u.head = [0.35, 0, 0]; u.brow = 0.8; u.mouth = 0.25; if (t > 68.9) { u.brow = 0; u.sad = 0.7; u.mouth = 0.1; u.head = [0.2, 0, 0.08]; u.smile = 0; } }
    if (t >= 75.6 && t < 88.3) { u.sad = 0.4; u.smile = 0; u.look = [Math.sin(t * 1.5) * 0.6, 0]; u.head = [0, Math.sin(t * 1.5) * 0.35, 0];
      if (t > 79.6 && t < 81.6) { u.lean = 0.3; u.head = [0, -0.5, 0.3]; u.look = [-0.7, 0]; u.armL = [-1.2, 0, 0.2]; }
      if (t > 83.0 && t < 85.0) { u.lean = 0.75; u.head = [0.5, 0, 0]; u.look = [0, -0.6]; }
      if (t > 85.2 && t < 88.3) { u.armR = [-2.4, 0, 1.3]; u.head = [0, 0.45, 0.25]; u.look = [0.6, 0.2]; u.squint = 0.3; u.brow = 0.6; }
    }
    if (t >= 88.3 && t < 92.6) { u.sad = 0.7; u.look = [0, -0.5]; u.head = [0.3, 0, 0]; u.smile = 0; }
    if (kn > 0) { u.pos[1] -= 0.27 * kn; u.legL = 1.45 * kn; u.legR = 1.45 * kn; }
    if (t >= 92.6 && t < 95.4) { const k = seg(t, 92.8, 93.8); u.armL = [-1.2 + 0.3 * k, 0, -0.32]; u.armR = [-1.2 + 0.3 * k, 0, -0.32]; u.lean = 0.35 * (1 - seg(t, 94, 95.2)); u.look = [0, -0.6]; u.head = [0.3, 0, 0]; u.smile = 0.8; }
    if (carrying) { u.armL = [-1.05, 0, -0.42]; u.armR = [-1.05, 0, -0.42]; }
    if (t >= 95.4 && t < 100) { u.look = [0, -0.4]; u.head = [0.25, 0, 0.1]; u.smile = 1; u.squint = 0.3; }
    if (t >= 100 && t < 105.5) { u.brow = 0.7; u.smile = 1; }
    if (t >= 105.5 && t < 110) { u.look = [0, -0.6]; u.head = [0.3, 0, 0]; }
    if (t >= 128.1 && t < 136) { u.smile = 1; u.squint = 0.3; u.look = [Math.sin(t) * 0.5, 0.1]; u.head = [0, Math.sin(t) * 0.25, 0]; }
    if (t >= 136.8 && t < 149.4) { u.brow = 1; u.look = [0, 0]; u.mouth = t > 140.8 ? 0.25 : 0; u.hairUp = t > 137.2 ? 0.7 : 0; u.tilt = t > 140.8 && t < 146.8 ? noise(t * 30) * 0.02 : 0; if (t > 146.8) u.lean = -0.15; }
    if (t >= 149.4 && t < 165.6) { u.brow = 0.8; u.mouth = 0.3; u.look = [0.2, -0.4]; u.head = [0.25, 0.1, 0]; if (t > 153.2) { u.smile = 1; u.mouth = 0.4; u.squint = 0.2; } }
    if (t >= 165.6 && t < 209.4) { u.look = [0, -0.5]; u.head = [0.35, 0, 0]; u.smile = 0.8;
      if (t > 172.3 && t < 176) { u.brow = 1; u.mouth = 0.35; u.smile = 0; }
      if (t >= 182.2) { const k = seg(t, 181.6, 182.4); if (t < 183) { u.armL = [-1.05 + 0.2 * k, 0, -0.42]; u.armR = [-1.05 + 0.2 * k, 0, -0.42]; u.lean = 0.3 * k; } }
      if (t > 184.8 && t < 193) { u.brow = 1; u.mouth = 0.5; u.lean = 0.15; u.smile = 0; }
      if (t > 193 && t < 203.6) { u.brow = 0.7; u.mouth = 0.5; u.smile = 1; u.squint = 0.2; }
      if (t > 203.6) { u.smile = 1; u.squint = 0.7; u.mouth = 0.55; u.head = [0.2, 0, 0.15]; u.armR = [-0.8 + Math.sin(t * 5) * 0.05, 0, 0.1]; }
    }
    if (t >= 209.4 && t < 217.3) { u.brow = 0.5; u.look = [0.6, 0.1]; u.head = [0, 0.3, 0]; u.smile = 0.6; }
    if (t >= 217.3 && t < 240) { u.smile = 1; u.look = [Math.sin(t * 0.7) * 0.5, 0.25]; u.head = [-0.1, Math.sin(t * 0.7) * 0.25, 0]; u.walk = clamp(tPath.speed(t) / 0.9); u.phase = t * 6.5; }
    if (t >= 241 && t < 255.6) { u.brow = 1; u.look = [0.6, 0.3]; u.head = [-0.1, 0.25, 0]; u.mouth = 0.2; if (t > 252.4) { u.smile = 1; u.mouth = 0.5; u.squint = 0.3; } }
    if (t >= 255.6 && t < 262.8) { u.phase = t * 13; u.lean = 0.2; u.smile = 1; u.armL[0] -= 0.3; }
    if (t >= 262.8 && t < 301.1) { u.look = [0.4, 0.35]; u.head = [-0.15, 0, 0]; u.brow = 0.9; u.mouth = 0.4; if (t > 276) { u.brow = 0.4; u.smile = 1; u.squint = 0.35; u.mouth = 0.45; } }
    if (t >= 301.1 && t < 330.2) { u.smile = 1; u.squint = 0.45; u.mouth = 0.4; u.look = [0.3, 0.3];
      if (t > 309 && t < 313) { u.head = [0.25 * Math.sin(PI * seg(t, 309.5, 312)), 0, 0]; }
      if (t > 315.2 && t < 322) { u.armR = [0, 0, 2.5 + Math.sin(t * 9) * 0.35]; }
      if (t > 322) { u.armR = [0, 0, 0.2]; u.sad = 0.2; }
    }
    if (t >= 330.2) { // sitting on the rock at sunset
      u.pos = [SUNROCK[0], SUNROCK[1] + 0.32, SUNROCK[2]]; u.rot = 0.15; u.legL = -1.45; u.legR = -1.35; u.legOut = 0.15; u.armL = [-0.3, 0, 0.35]; u.armR = [-0.3, 0, 0.35]; u.walk = 0;
      u.smile = 1; u.squint = 0.45; u.look = [0, 0.15]; u.head = [-0.1, 0, Math.sin(t * 0.6) * 0.06]; u.lid = 0.15; u.mouth = 0.35;
    }
    tuca.set(u);

    // ---- egg
    let eggPos = [EGG0[0], H(EGG0[0], EGG0[2]), EGG0[2]], eggShow = t < 217.3, wobble = 0, crackK = 0, open = 0;
    if (t >= 93.9 && t < 182.4) { const c = worldOf(tuca.torso, [0, 0.36, 0.46]); eggPos = [c[0], c[1] - 0.24, c[2]]; }
    if (t >= 92.6 && t < 93.9) { const k = Ez.io(seg(t, 93.1, 93.9)); const c = worldOf(tuca.torso, [0, 0.36, 0.46]); eggPos = [lerp(EGG0[0], c[0], k), lerp(H(EGG0[0], EGG0[2]), c[1] - 0.24, k), lerp(EGG0[2], c[2], k)]; }
    if (t >= 182.4) eggPos = [EGG1[0], EY, EGG1[2]];
    if (t >= 181.6 && t < 182.4) { const c = worldOf(tuca.torso, [0, 0.36, 0.46]); const k = Ez.io(seg(t, 181.6, 182.4)); eggPos = [lerp(c[0], EGG1[0], k), lerp(c[1] - 0.24, EY, k), lerp(c[2], EGG1[2], k)]; }
    if (t > 41.5 && t < 46) wobble = 0.08 * Math.max(0, Math.sin(t * 6));
    if (t > 169.6 && t < 170.3) wobble = 0.3;
    if (t >= 174.9) crackK = t < 186 ? 1 : 1.35;
    if (t >= 181.2 && t < 193) wobble = (t < 184 ? 0.6 : 0.25) * (0.6 + 0.4 * Math.sin(t * 3));
    const emerge = Ez.io(seg(t, 186.0, 191.0));
    open = 0;
    egg.set({ pos: eggPos, t, wobble, crack: crackK, open: 0, vis: eggShow });
    egg.root.rotation.y = t > 93 ? (tuca.root.rotation.y || 0) : 0.4;
    // top shell rises with the hatchling's head, then becomes its hat
    const hatOn = t >= 190.8;
    egg.top.visible = !hatOn && eggShow;
    if (t >= 186 && !hatOn) { egg.top.position.y = 0.42 + emerge * 0.3; egg.top.rotation.set(0, 0, -0.25 * emerge); }
    if (eggShow) { const ew = egg.root.getWorldPosition(new THREE.Vector3()); const gk = (t < 182 ? 1 : 0.6) * (0.85 + 0.15 * Math.sin(t * 2.2)) * (t > 191 ? Math.max(0.2, 1 - seg(t, 191, 196)) : 1); eggGlow.visible = true; eggGlow.position.set(ew.x, ew.y + 0.24, ew.z); eggGlow.scale.setScalar(1.4 * gk + pulse(t, 169.6, 3) * 1.2 + pulse(t, 174.9, 3) * 0.8); eggLight.position.set(ew.x, ew.y + 0.4, ew.z); eggLight.intensity = (t > 93 && t < 182.4 ? 0.9 : 2.2) * gk + pulse(t, 169.6, 3) * 2; eggLight.distance = 3; } else { eggGlow.visible = false; eggLight.intensity = 0; }
    // falling shell chip
    chip.visible = t > 177.2 && t < 217.3;
    if (chip.visible) { const k = Ez.in(seg(t, 177.3, 177.9)); const c0 = [eggPos[0] + 0.1, eggPos[1] + 0.35, eggPos[2] + 0.1]; const c1 = [49.7, H(49.7, 0.35) + 0.02, 0.35]; chip.position.set(lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k) + Math.sin(PI * k) * 0.1, lerp(c0[2], c1[2], k)); chip.rotation.set(k * 6, k * 3, 0); }

    // ---- hatchling
    const bornK = t >= 186 ? 1 : 0;
    const bp = bPath.pos(t);
    let bpos = [bp[0], H(bp[0], bp[2]), bp[2]];
    let b = { rot: PI / 2 + 0.3, phase: t * 16, walk: bPath.walk(t) * (t > 217 ? 1 : 0), t, head: [0, 0, 0], look: [0, 0], blink: blinkAt(t, 31), squint: 0, lid: 0, tailWag: 0.6, mouth: 0 };
    if (t >= 186 && t < 217.3) { bpos = [EGG1[0] + 0.12, EY - 0.22 + emerge * 0.2, EGG1[2] - 0.05]; b.rot = -PI / 2 + 0.45; b.lid = t < 196 ? 0.6 : 0; b.head = [-0.15, 0, 0]; }
    if (t >= 196.4 && t < 197.6) { b.blink = Math.max(Math.sin(PI * seg(t, 196.5, 196.8)), Math.sin(PI * seg(t, 197.0, 197.3))); }
    if (t >= 197.6 && t < 203.6) { b.look = [0, 0.5]; b.head = [-0.35, 0, 0.1 * Math.sin(t * 3)]; }
    if (t >= 200.3 && t < 201.4) { b.mouth = 0.9 * Math.sin(PI * seg(t, 200.3, 201.2)); b.squint = 0.8; bpos[1] += hop(t, 200.4, 0.35) * 0.1; }
    if (t >= 203.6 && t < 217.3) { b.squint = 0.4; b.look = [0, 0.3]; b.head = [-0.25, 0, 0]; }
    if (t >= 217.3) { b.rot = bPath.heading(t); if (bPath.speed(t) < 0.05) b.rot = t > 262 ? 1.2 : PI / 2; b.head = [-0.15, Math.sin(t * 1.3) * 0.35, 0]; b.look = [Math.sin(t * 1.3) * 0.5, 0.2]; bpos[1] += Math.abs(Math.sin(t * 16)) * 0.04 * bPath.walk(t); }
    if (t >= 287.4 && t < 301) { b.rot = -0.4; b.squint = 0.7; b.head = [-0.4, 0, 0.1]; }
    if (t >= 301) { // ride on mother's head
      bpos = worldOf(mom.head, [0, 0.55, 0.32]); bpos[1] -= 0.02; b.rot = mRot(t); b.squint = 0.5; b.head = [-0.1, 0, Math.sin(t * 4) * 0.1]; b.walk = 0;
      if (t < 309) { const k = Ez.io(seg(t, 301.0, 301.01)); }
    }
    baby.set({ pos: bpos, ...b });
    baby.root.visible = bornK > 0;
    hat.visible = hatOn;
    if (hatOn) { hat.position.set(0, 0.38 + Math.abs(wob(t, 190.8, 2, 5)) * 0.06, 0.25); hat.rotation.set(0, 0, -0.25); }

    // ---- sibling
    const sp = sPath.pos(t);
    let s = { pos: [sp[0], H(sp[0], sp[2]), sp[2]], rot: sRot(t), phase: t * 14, walk: sPath.walk(t), t, head: [0, 0, 0], look: [0, 0], blink: blinkAt(t, 41), squint: 0, lid: 0, tailWag: 0.5, mouth: 0 };
    const sVis = t >= 149.8;
    if (t >= 149.8 && t < 153.4) { s.head = [-0.2, 0, 0]; s.look = [0, 0.3]; s.pos[1] += hop(t, 152.6, 0.4) * 0.12; }
    if (t >= 153.4 && t < 160.7) { const a = Math.sin((t - 156.5) * 1.5); s.head = [-0.15, t > 156.5 ? a * 0.6 : 0, 0]; s.look = [t > 156.5 ? a * 0.8 : 0, 0.2]; s.squint = t < 156.5 ? 0.3 : 0; }
    if (t >= 160.7 && t < 165.6) { s.head = [0.05, 0.25, 0]; s.look = [0.5, 0]; s.lid = 0; s.squint = 0; }
    if (t >= 165.6 && t < 172) { s.head = [0.25, 0, 0]; s.look = [0, -0.3]; if (t > 169.3 && t < 170.4) s.head = [0.35 + hop(t, 169.4, 0.6) * 0.15, 0, 0]; s.squint = t > 169.4 ? 0.6 : 0; }
    if (t >= 172 && t < 217.3) { s.head = [0.2, 0, 0]; s.look = [-0.2, -0.3]; if (t > 193) { s.squint = 0.5; s.tailWag = 1; } if (t > 203.6 && t < 207.5) { s.head = [0.3, 0.3, 0.1]; } if (t > 209.4) { s.head = [0, 0, 0]; s.look = [0.5, 0]; } }
    if (t >= 217.3 && t < 248.2) { s.head = [-0.1, Math.sin(t * 1.1 + 1) * 0.3, 0]; s.look = [Math.sin(t * 1.1 + 1) * 0.5, 0.15]; s.pos[1] += Math.abs(Math.sin(t * 14)) * 0.05 * s.walk; }
    if (t >= 248.2 && t < 255.6) { s.head = [-0.5 * Ez.out(seg(t, 248.2, 248.8)), 0, 0]; s.look = [0, 0.6]; s.brow = 1; if (t > 252.4) { s.pos[1] += Math.abs(Math.sin(t * 9)) * 0.15; s.squint = 0.6; s.tailWag = 1.5; } }
    if (t >= 255.6 && t < 262.8) { s.phase = t * 20; s.pos[1] += Math.abs(Math.sin(t * 20)) * 0.06; }
    if (t >= 262.8 && t < 281.4) { s.head = [-0.3, 0, 0]; s.look = [0.2, 0.4]; s.lid = t < 276 ? 0.2 : 0; s.squint = t > 276.5 ? 0.6 : 0; s.tailWag = t > 276.5 ? 1.5 : 0.3; }
    if (t >= 281.4 && t < 287) { s.phase = t * 22; s.pos[1] += Math.abs(Math.sin(t * 22)) * 0.08 * s.walk; }
    if (t >= 287 && t < 301) { s.head = [-0.4, 0, Math.sin(t * 3) * 0.12]; s.squint = 0.7; s.tailWag = 1.5; }
    if (t >= 301 && t < 321) { s.head = [-0.1, 0.4, 0]; s.look = [0.5, 0]; s.squint = 0.3; }
    if (t >= 317 && t < 321.5) { s.head = [-0.15, 0.9, 0]; s.look = [0.7, 0.1]; }
    if (t >= 321.5) { s.rot = sPath.heading(t); if (t > 323.2 && t < 325.4) { s.head = [-0.1, -1.2, 0]; s.look = [-0.7, 0.1]; } }
    sib.set(s); sib.root.visible = sVis;

    // ---- bushes
    const part = Ez.out(seg(t, 50.7, 52.2));
    const wide = Ez.io(seg(t, 56.0, 57.0)) * (1 - Ez.io(seg(t, 104, 105)));
    halves.forEach((g, i) => { const sgn = i ? 1 : -1; g.rotation.set(0, 0, sgn * 0.6 * part + (t > 41.6 && t < 46 ? Math.sin(t * 20) * 0.03 : 0)); g.position.x = eggBush[0] + sgn * (0.05 + 0.4 * part + 0.7 * wide); });
    const rs = (t > 137 && t < 139 ? 1 : 0) + (t > 143.4 && t < 145.6 ? 1.4 : 0) + (t > 150.6 && t < 152.8 ? 0.8 : 0);
    rustle.rotation.set(Math.sin(t * 31) * 0.06 * rs, 0, Math.sin(t * 27) * 0.09 * rs);
    leafBurst.update(t, t < 143 ? 137.1 : t < 150 ? 143.5 : 150.7, [51.9, H(51.9, 0.9) + 0.6, 0.9], { speed: 1.2, up: 1.8, grav: 3, life: 1.4 });
    planks.forEach((p, i) => { const x = p.position.x; const near = Math.exp(-((tpp[0] - x) ** 2) * 4) * (t > 114 && t < 121.2 ? 1 : 0); p.position.y = bridgeY(x) - 0.04 - near * 0.05; });

    // ---- small animals, fx
    const anchor = t < 105.5 ? [tpp[0], tpp[1], tpp[2]] : t < 136 ? [tpp[0], tpp[1], tpp[2]] : t < 217.3 ? [49.8, EY, 0.3] : t < 262.8 ? [tpp[0], tpp[1], 0] : t < 330.2 ? [112, H(112, -1), -1] : SUNROCK;
    butterflies.forEach((bf, i) => {
      const r = 1.6 + hash(i) * 3, sp2 = 0.25 + hash(i * 3) * 0.3, ph = t * sp2 + i * 2.1;
      let p = [anchor[0] + Math.cos(ph) * r + Math.sin(ph * 2.3) * 0.5, anchor[1] + 0.8 + Math.sin(ph * 1.7 + i) * 0.5 + hash(i * 7) * 1.2, anchor[2] + Math.sin(ph) * r * 0.8 - 1 + hash(i * 5) * 2];
      if (i === 0 && t > 21.8 && t < 28.5) { // lands on Tuca's nose
        const nose = worldOf(tuca.head, [0, 0.0, 0.42]); const k = Ez.io(seg(t, 21.8, 23.2)) * (1 - Ez.io(seg(t, 26.8, 28.5)));
        p = [lerp(p[0], nose[0], k), lerp(p[1], nose[1] + 0.05, k), lerp(p[2], nose[2], k)];
      }
      const vis = t < 140 || (t > 200 && t < 240) || (t > 262 && t < 330);
      bf.set(p, -ph + PI / 2, t + i, vis ? 1 : 0);
    });
    birds.forEach((bd, i) => {
      let p, rot, vis = true;
      if (t > 245.6 && t < 252) { const lt = t - 245.6 - i * 0.12; const st = [82 + i * 1.5, 7 + hash(i) * 3, -4 + i]; p = [st[0] + lt * 1.5, st[1] + lt * 2.2, st[2] - lt * 3]; rot = PI + 0.4; vis = lt > 0; }
      else { const l = ((t * 0.03 + i * 0.13) % 1); const base = anchor; p = [base[0] + lerp(-40, 40, l), base[1] + 14 + i * 1.2 + Math.sin(t + i) * 0.6, base[2] - 18 - i * 3]; rot = PI / 2; }
      bd.set(p, rot, t + i, 1, vis);
    });
    sparkles.set((i) => { const a = hash(i) * PI * 2, r = 1 + hash(i * 3) * 7; return [anchor[0] + Math.cos(a) * r + Math.sin(t * 0.3 + i) * 0.4, anchor[1] + 0.3 + ((t * (0.1 + hash(i * 5) * 0.15) + hash(i * 7) * 4) % 4), anchor[2] + Math.sin(a) * r * 0.7]; });
    sparkles.pts.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(t * 0.7));
    fireflies.pts.material.opacity = seg(t, 336, 345) * 0.9;
    fireflies.set((i) => [SUNROCK[0] + (hash(i) - 0.5) * 14 + Math.sin(t * 0.7 + i) * 0.5, SUNROCK[1] + 0.3 + hash(i * 3) * 2.5 + Math.sin(t * 1.1 + i * 2) * 0.3, SUNROCK[2] + (hash(i * 7) - 0.3) * 12]);
    boop.update(t, 169.6, [EGG1[0] + 0.05, EY + 0.6, 0.05], { speed: 0.6, up: 0.8, grav: 0.5, life: 1.2 });
    hatchBurst.update(t, 190.8, [EGG1[0], EY + 0.5, EGG1[2]], { speed: 0.9, up: 1.2, grav: 0.8, life: 1.6 });
    glints.set((i) => i < 90 ? [-22 + (hash(i) - 0.5) * 2.8, -0.55, ((hash(i * 3) * 40 - t * 1.3) % 40 + 40) % 40 - 20] : [(hash(i) - 0.5) * 8, -0.38, -9 + (hash(i * 5) - 0.5) * 7]);
    glints.pts.material.opacity = 0.5 + 0.4 * Math.sin(t * 9);
    mist.set((i) => { const l = (t * 0.25 + hash(i)) % 1; return [(hash(i * 3) - 0.5) * 4 + Math.sin(i) * l, -0.2 + l * 2.5, -11.8 + l * 2.5 + (hash(i * 7) - 0.5)]; });
    rays.forEach((g, i) => (g.children.forEach((m) => (m.material.opacity = (t > 300 ? 0.08 : 0.12) * (0.75 + 0.25 * Math.sin(t * 0.4 + i))))));
    // hearts
    const sh = sib.headWorld(), bh = baby.headWorld(), mh = mom.headWorld();
    hearts.update(t, [[201.2, [bh[0], bh[1] + 0.25, bh[2]], 0.5], [289.4, [(sh[0] + mh[0]) / 2, mh[1] + 0.3, (sh[2] + mh[2]) / 2], 1.2]]);
    hearts2.update(t, [[204.8, [(sh[0] + bh[0]) / 2, sh[1] + 0.3, (sh[2] + bh[2]) / 2], 0.6], [295.0, [mh[0] - 0.6, mh[1] + 0.6, mh[2] + 0.6], 1.3]]);
    const th = tuca.headWorld();
    emo.q.set(t > 38.6 && t < 40.6 ? Ez.back(seg(t, 38.6, 38.8)) : 0, [th[0], th[1] + 0.48, th[2]], 0.32);
    emo.ex.set(t > 137.2 && t < 138.6 ? Ez.back(seg(t, 137.2, 137.4)) : 0, [th[0], th[1] + 0.5, th[2]], 0.35);
    emo.sex.set(t > 160.9 && t < 162.6 ? Ez.back(seg(t, 160.9, 161.1)) : 0, [sh[0], sh[1] + 0.4, sh[2]], 0.28);
    emo.note.set(t > 252.4 && t < 254.4 ? 1 : 0, [sh[0] + 0.15, sh[1] + 0.35 + (t % 0.5) * 0.3, sh[2]], 0.22, Math.sin(t * 5) * 0.3);

    // ---- camera
    let shf = shots[0][1]; for (const [t0, f] of shots) if (t >= t0) shf = f;
    let [cp, cl, fov] = shf(t);
    if (t < 262.8) { cp = [cp[0], cp[1] + H(cp[0], cp[2]), cp[2]]; cl = [cl[0], cl[1] + H(cl[0], cl[2]), cl[2]]; }
    const shake = (t > 245.6 && t < 247.5 ? 0.012 : 0);
    E.cam(cp, cl, fov, shake, t);
    E.sunAt(cl, ld, fov > 43 && (t < 12 || t > 353) ? 30 : 9);
  }

  // ------------------------------------------------------------ overlay (title & final message)
  function overlay(ctx, t) {
    const W = E.W, Hh = E.H;
    if (t > 1.2 && t < 9.5) {
      const a = clamp((t - 1.2) / 1.0) * clamp((9.5 - t) / 1.0);
      ctx.save(); ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(0, Hh * 0.15, 0, Hh * 0.62); g.addColorStop(0, 'rgba(40,20,10,0.28)'); g.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh * 0.7);
      E.outlined(ctx, 'Dino Contos presents', W / 2, Hh * 0.26, 46, '#fff6e0', { font: '600 Fredoka', lw: 0.12, stroke: '#4a2a10' });
      const p = Ez.back(seg(t, 1.6, 2.6));
      ctx.translate(W / 2, Hh * 0.4); ctx.scale(p, p);
      E.outlined(ctx, 'The Lost Egg', 0, 0, 170, '#ffd75a', { stroke: '#5a2a08' });
      ctx.restore();
    }
    if (t > 369.2) {
      const a = clamp((t - 369.2) / 1.2);
      ctx.save(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#1a0c06'; ctx.fillRect(0, 0, W, Hh); ctx.restore();
      ctx.save(); ctx.globalAlpha = a;
      E.outlined(ctx, 'Every little act of kindness', W / 2, Hh * 0.42, 74, '#fff3d6', { font: '600 Fredoka', lw: 0.1, stroke: '#5a2a08' });
      E.outlined(ctx, 'can lead to something truly magical.', W / 2, Hh * 0.53, 74, '#ffd75a', { font: '600 Fredoka', lw: 0.1, stroke: '#5a2a08' });
      ctx.globalAlpha = clamp((t - 371.5) / 1.0);
      E.outlined(ctx, 'The End', W / 2, Hh * 0.7, 64, '#ffffff', { stroke: '#5a2a08' });
      ctx.restore();
    }
  }

  return {
    fps: 24, duration: DUR, caps: [], cues: [...cues], frame, overlay,
    fades: [[0, 1.6, 'in'], [DUR - 2.2, DUR, 'out'], [217.0, 217.3, 'out'], [217.3, 217.8, 'in'], [329.8, 330.2, 'out'], [330.2, 331.2, 'in']],
  };
}

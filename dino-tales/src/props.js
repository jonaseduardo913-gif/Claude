// =====================================================================
//  Environment props
// =====================================================================
import { THREE, scene, add, grp, mat, geo, hash, noise, lerp, clamp, makePoints } from './engine.js';
const P = Math.PI;

export function palm(pos, h = 4, lean = 0.25, seed = 0, o = {}) {
  const root = grp(scene, pos, [0, hash(seed) * 6.28, 0]);
  const segs = 9; let par = root;
  const trunk = o.trunk || '#8a6440';
  for (let i = 0; i < segs; i++) {
    const s = grp(par, i ? [0, h / segs, 0] : [0, 0, 0], [lean / segs * (1 + i * 0.15), 0, 0]);
    add(s, 'cyl', mat(i % 2 ? trunk : '#a07650', { r: 0.9 }), [0, h / segs / 2, 0], [0.13 - i * 0.006, h / segs * 1.05, 0.13 - i * 0.006]);
    par = s;
  }
  const top = grp(par, [0, h / segs, 0]);
  const leafM = mat(o.leaf || '#3f9e3a', { r: 0.7 }), leafM2 = mat(o.leaf2 || '#56b84a', { r: 0.7 });
  const fronds = [];
  for (let i = 0; i < 8; i++) {
    const f = grp(top, [0, 0, 0], [0, i / 8 * P * 2 + hash(seed + i) * 0.3, 0]);
    let fp = f;
    for (let k = 0; k < 6; k++) {
      const s = grp(fp, k ? [0, 0, 0.36] : [0, 0, 0.1], [k ? 0.22 : -0.5, 0, 0]);
      add(s, 'sph', k % 2 ? leafM : leafM2, [0, 0, 0.2], [0.24 - k * 0.025, 0.03, 0.26]);
      fp = s;
    }
    fronds.push(f);
  }
  for (let i = 0; i < 3; i++) add(top, 'sph', mat('#6b4a24'), [Math.cos(i * 2.1) * 0.13, -0.1, Math.sin(i * 2.1) * 0.13], 0.11);
  return { root, update(t) { fronds.forEach((f, i) => { f.rotation.x = Math.sin(t * 1.5 + i + seed) * 0.05; }); } };
}

export function jungleTree(pos, h = 5, seed = 0, o = {}) {
  const root = grp(scene, pos, [0, hash(seed) * 6.28, 0]);
  add(root, 'cyl', mat(o.trunk || '#6e4b2e', { r: 0.95 }), [0, h / 2, 0], [0.32, h, 0.32]);
  add(root, 'cone', mat(o.trunk || '#6e4b2e', { r: 0.95 }), [0, 0.4, 0], [0.6, 0.9, 0.6]);
  const cols = o.cols || ['#2f7d32', '#3c9440', '#2a6e2e', '#4aa14a'];
  for (let i = 0; i < 9; i++) {
    const a = hash(seed + i * 7) * 6.28, r = 0.6 + hash(seed + i * 3) * 1.4;
    add(root, 'sph', mat(cols[i % cols.length], { r: 0.8 }), [Math.cos(a) * r, h + hash(seed + i) * 1.4 - 0.2, Math.sin(a) * r], 1.0 + hash(seed + i * 11) * 0.8);
  }
  return root;
}

export function fern(pos, s = 1, seed = 0, col = '#3e9a3c') {
  const root = grp(scene, pos, [0, hash(seed) * 6.28, 0]);
  const m = mat(col, { r: 0.75, side: 1 }), m2 = mat('#5bb550', { r: 0.75 });
  for (let i = 0; i < 7; i++) {
    const f = grp(root, [0, 0, 0], [0, i / 7 * P * 2, 0]);
    const s1 = grp(f, [0, 0.05, 0], [-0.9 + hash(seed + i) * 0.3, 0, 0]);
    add(s1, 'sph', i % 2 ? m : m2, [0, 0, 0.35 * s], [0.12 * s, 0.025, 0.42 * s]);
    const s2 = grp(s1, [0, 0, 0.7 * s], [0.6, 0, 0]);
    add(s2, 'sph', i % 2 ? m : m2, [0, 0, 0.25 * s], [0.09 * s, 0.02, 0.3 * s]);
  }
  return root;
}

export function bush(pos, s = 1, seed = 0, cols = ['#3b8f3a', '#4ca547', '#2e7a33']) {
  const root = grp(scene, pos);
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + seed; add(root, 'sph', mat(cols[i % cols.length], { r: 0.85 }), [Math.cos(a) * 0.45 * s, (0.35 + hash(seed + i) * 0.3) * s, Math.sin(a) * 0.4 * s], (0.45 + hash(seed + i * 2) * 0.25) * s); }
  return root;
}

export function flower(pos, col = '#ff6fa8', s = 1) {
  const root = grp(scene, pos);
  add(root, 'cyl', '#3d8f3a', [0, 0.15 * s, 0], [0.012 * s, 0.3 * s, 0.012 * s]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * P * 2; add(root, 'sph', mat(col, { r: 0.6 }), [Math.cos(a) * 0.05 * s, 0.31 * s, Math.sin(a) * 0.05 * s], [0.045 * s, 0.02 * s, 0.045 * s]); }
  add(root, 'sph', '#ffd23f', [0, 0.32 * s, 0], 0.03 * s);
  return root;
}

export function rock(pos, s = 1, seed = 0, col = '#8d8577') {
  const r = add(scene, 'dodec', mat(col, { r: 0.95, flat: true }), pos, [s * (0.9 + hash(seed) * 0.4), s * (0.55 + hash(seed + 1) * 0.3), s * (0.9 + hash(seed + 2) * 0.3)], [hash(seed + 3), hash(seed + 4) * 6, hash(seed + 5) * 0.3]);
  return r;
}

export function volcano(pos, s = 1) {
  const root = grp(scene, pos);
  const pts = [];
  for (let i = 0; i <= 20; i++) { const y = i / 20; pts.push(new THREE.Vector2(lerp(1, 0.2, Math.pow(y, 0.7)) * 30 * s, y * 26 * s)); }
  const g = new THREE.LatheGeometry(pts, 48);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const a = Math.atan2(z, x); const k = 1 + noise(a * 5 + y * 0.2) * 0.06 + Math.sin(a * 9) * 0.03; p.setX(i, x * k); p.setZ(i, z * k); }
  g.computeVertexNormals();
  const m = add(root, g, mat('#6b4c3b', { r: 0.95 }), [0, 0, 0]); m.castShadow = false;
  add(root, 'cyl', mat('#ff6a1a', { e: '#ff4a00', ei: 2.5 }), [0, 25.6 * s, 0], [6 * s, 1, 6 * s], [0, 0, 0], { shadow: false });
  // lava streaks
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; add(root, 'cone', mat('#ff7a22', { e: '#ff3c00', ei: 1.8 }), [Math.cos(a) * 9 * s, 18 * s, Math.sin(a) * 9 * s], [0.9 * s, 14 * s, 0.4 * s], [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45 + 0], { shadow: false }); }
  const puffs = [];
  for (let i = 0; i < 10; i++) puffs.push(add(root, 'sph', mat('#8b8682', { r: 1, op: 0.85 }), [0, 0, 0], 1, [0, 0, 0], { shadow: false }));
  return {
    root, update(t) {
      puffs.forEach((m, i) => {
        const l = ((t * 0.12 + i / puffs.length) % 1);
        m.position.set(Math.sin(i * 2.3) * 2 * s + l * 14 * s, (27 + l * 30) * s, Math.cos(i * 1.7) * 2 * s);
        m.scale.setScalar((3 + l * 9) * s); m.material.opacity = 0.75 * (1 - l);
      });
    },
  };
}

export function mountain(pos, r, h, col = '#7a8aa0', snow = '#ffffff', seed = 0, snowLine = 0.55) {
  const g = new THREE.ConeGeometry(r, h, 24, 8);
  const p = g.attributes.position; const cols = new Float32Array(p.count * 3);
  const c1 = new THREE.Color(col), c2 = new THREE.Color(snow), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
    const k = 1 + noise(a * 4 + seed) * 0.12 + noise(y * 0.3 + seed * 3) * 0.06;
    p.setX(i, x * k); p.setZ(i, z * k);
    const yy = (y + h / 2) / h; c.copy(c1).lerp(c2, clamp((yy - snowLine + noise(a * 7 + seed) * 0.06) * 12));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.position.set(pos[0], pos[1] + h / 2, pos[2]); scene.add(m); m.receiveShadow = true;
  return m;
}

export function pine(pos, h = 3, seed = 0, snow = true) {
  const root = grp(scene, pos, [0, hash(seed) * 6, 0]);
  add(root, 'cyl', mat('#5a3c26'), [0, h * 0.12, 0], [0.12, h * 0.25, 0.12]);
  for (let i = 0; i < 4; i++) {
    const y = h * (0.22 + i * 0.2), r = h * (0.36 - i * 0.075);
    add(root, 'cone', mat('#2d5e4a', { r: 0.85 }), [0, y + h * 0.13, 0], [r, h * 0.32, r]);
    if (snow) add(root, 'cone', mat('#f4f8ff', { r: 0.7 }), [0, y + h * 0.2, 0], [r * 0.8, h * 0.2, r * 0.8]);
  }
  return root;
}

export function cloud(pos, s = 1, seed = 0, col = '#ffffff') {
  const root = grp(scene, pos);
  for (let i = 0; i < 6; i++) add(root, 'sph', mat(col, { r: 1, e: col, ei: 0.25 }), [(i - 2.5) * 1.1 * s, Math.sin(i * 1.7 + seed) * 0.4 * s + (i % 2) * 0.5 * s, hash(seed + i) * s], (1.1 + hash(seed + i * 3) * 0.7) * s, [0, 0, 0], { shadow: false });
  return root;
}

// fire: teardrop flames (additive) + glow + embers + light. update(t, k) with k = intensity 0..1
let flameGeo, glowTex;
function flameGeometry() {
  if (flameGeo) return flameGeo;
  const pts = []; for (let i = 0; i <= 16; i++) { const y = i / 16; pts.push(new THREE.Vector2(Math.pow(Math.sin(Math.PI * Math.min(1, y * 1.15 + 0.02)), 0.9) * Math.pow(1 - y, 0.5) * 0.5 + 0.001, y)); }
  return (flameGeo = new THREE.LatheGeometry(pts, 20));
}
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,200,120,1)'); g.addColorStop(0.35, 'rgba(255,140,40,0.45)'); g.addColorStop(1, 'rgba(255,90,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (glowTex = new THREE.CanvasTexture(c));
}
export function makeFire(pos, s = 1, { logs = true } = {}) {
  const root = grp(scene, pos);
  if (logs) {
    for (let i = 0; i < 7; i++) { const g = grp(root, [0, 0, 0], [0, i / 7 * P * 2, 0]); add(g, 'cyl', mat(i % 2 ? '#8a5a34' : '#a06a3c', { r: 0.9 }), [0, 0.3 * s, 0.17 * s], [0.045 * s, 0.75 * s, 0.045 * s], [-0.5, 0, 0]); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * P * 2; add(root, 'dodec', mat('#7d756c', { flat: true }), [Math.cos(a) * 0.45 * s, 0.06 * s, Math.sin(a) * 0.45 * s], 0.12 * s); }
  }
  const fl = grp(root);
  const cols = ['#ff3a08', '#ff7a12', '#ffb428', '#fff0a0'];
  const flames = [];
  for (let L = 0; L < 4; L++) for (let i = 0; i < (L < 3 ? 4 - L : 1); i++) {
    const m = new THREE.Mesh(flameGeometry(), new THREE.MeshBasicMaterial({ color: cols[L], transparent: true, opacity: [0.5, 0.45, 0.45, 0.55][L], blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.renderOrder = 5 + L; fl.add(m); flames.push({ m, L, i, n: L < 3 ? 4 - L : 1 });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.set(0, 0.5 * s, 0); root.add(glow);
  const light = new THREE.PointLight('#ff9a3c', 0, 16 * s, 1.5); light.position.set(0, 0.8 * s, 0); root.add(light);
  const embers = makePoints(70, { color: '#ffb347', size: 0.08 * s, additive: true });
  return {
    root, light,
    update(t, k = 1) {
      fl.visible = glow.visible = k > 0.01;
      flames.forEach(({ m, L, i, n }) => {
        const a = i / n * P * 2 + L * 0.9, r = (0.22 - L * 0.06) * s;
        const fh = (1.25 - L * 0.22 + noise(t * 7 + i * 3 + L * 5) * 0.3) * s * k;
        const w = (0.75 - L * 0.12) * s * Math.sqrt(k);
        m.position.set(Math.cos(a) * r, 0.08 * s, Math.sin(a) * r);
        m.scale.set(w, Math.max(0.001, fh), w);
        m.rotation.set(noise(t * 5 + i) * 0.18, 0, noise(t * 4.4 + i * 2 + L) * 0.22);
      });
      const gs = (2.2 + noise(t * 8) * 0.25) * s * k; glow.scale.set(gs, gs, 1);
      light.intensity = k * (16 + noise(t * 9) * 5) * s;
      const base = new THREE.Vector3(); root.getWorldPosition(base);
      embers.pts.visible = k > 0.05;
      embers.set((i) => { const l = (t * 0.55 + hash(i)) % 1; return [base.x + (hash(i * 3) - 0.5) * 0.5 * s + Math.sin(t * 2 + i) * 0.25 * l, base.y + 0.3 * s + l * 2.6 * s * k, base.z + (hash(i * 7) - 0.5) * 0.5 * s]; });
    },
  };
}

// animated water plane (CPU waves)
export function makeWater({ size = 300, seg = 160, y = 0, color = '#2a8fb0', center = [0, 0], fn }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-P / 2);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(g, m); mesh.position.set(center[0], y, center[1]); mesh.receiveShadow = true; scene.add(mesh);
  const base = Float32Array.from(g.attributes.position.array);
  return {
    mesh,
    update(t) {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i] + center[0], z = base[i + 2] + center[1];
        a[i + 1] = fn(x, z, t);
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    },
  };
}

// ring of expanding splash droplets / dust: returns update(t, t0, pos)
export function makeBurst(n, color, { size = 0.12, additive = false, opacity = 1 } = {}) {
  const pts = makePoints(n, { color, size, additive, opacity });
  pts.pts.visible = false;
  return {
    pts,
    update(t, t0, pos, { speed = 3, up = 3, grav = 6, life = 1.2, spread = 1 } = {}) {
      const lt = t - t0;
      pts.pts.visible = lt >= 0 && lt < life;
      if (!pts.pts.visible) return;
      pts.pts.material.opacity = opacity * clamp(1 - lt / life) ** 0.6;
      pts.set((i) => {
        const a = hash(i * 3.1) * P * 2, v = speed * (0.4 + hash(i * 1.7) * 0.6) * spread, vu = up * (0.5 + hash(i * 5.3) * 0.7);
        return [pos[0] + Math.cos(a) * v * lt, pos[1] + vu * lt - grav * lt * lt / 2, pos[2] + Math.sin(a) * v * lt];
      });
    },
  };
}

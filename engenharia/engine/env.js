// Reusable environments for low-poly episodes: ocean (+ underwater look), particles, cloud sea, city, wind.
import * as THREE from 'three';
import { rand, clamp, lerp } from './kit.js';
import { lp, facet, cloud, tree } from './lowpoly.js';

// ---------------------------------------------------------------- ocean
export function makeOcean(ctx, { size = 2400, segs = 90, color = 0x2a8fd8 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs); geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();
  const mat = lp.color(color, { roughness: 0.3, metalness: 0.05, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; ctx.scene.add(mesh);
  const under = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.BackSide, fog: true }));
  ctx.scene.add(under);
  const o = {
    mesh, under, mat,
    /** amp: wave height; mask(x,z) -> 0..1 optional (0 = flat, e.g. around a hull) */
    waves(t, amp = 1, mask = null) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i], z = base[i + 2];
        let h = amp * (0.7 * Math.sin(x * 0.05 + t * 1.2) + 0.5 * Math.sin(z * 0.07 - t) + 0.25 * Math.sin((x + z) * 0.13 + t * 2));
        if (mask) h *= mask(x, z);
        a[i + 1] = h;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    },
    seeThrough(k) { mat.transparent = k < 1; mat.opacity = k; mat.depthWrite = k >= 1; under.visible = k >= 1; },
    reset() { o.seeThrough(1); mesh.visible = true; under.visible = true; },
  };
  return o;
}

/** underwater look driven by camera depth (call after setting the camera) */
export function underwater(ctx, { shallow = 0x14598f, deep = 0x020b17, depthRange = 140, density = 0.0095 } = {}) {
  const y = ctx.camera.position.y;
  if (y >= 0) return false;
  const d = clamp(-y / depthRange);
  const col = new THREE.Color(shallow).lerp(new THREE.Color(deep), d);
  ctx.scene.fog = new THREE.FogExp2(col, density + 0.004 * d);
  ctx.scene.background = col; ctx.studio.sky.visible = false;
  ctx.studio.sun.intensity = 2.6 * (1 - 0.75 * d); ctx.studio.hemi.intensity = 1.2 - 0.6 * d;
  return true;
}
export function resetEnv(ctx) {
  ctx.scene.fog = null; ctx.scene.background = null; ctx.studio.sky.visible = true;
  ctx.studio.sun.intensity = 2.6; ctx.studio.hemi.intensity = 1.1;
  goldenHour(ctx, 0);
}

// ---------------------------------------------------------------- particles
export function makeParticles(ctx, { n = 800, color = 0xe8fbff, emissive = 0x9fe6ff, geo = null, emissiveIntensity = 0.4 } = {}) {
  const mesh = new THREE.InstancedMesh(geo || new THREE.IcosahedronGeometry(1, 0), lp.color(color, { emissive, emissiveIntensity }), n);
  ctx.scene.add(mesh);
  const M4 = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  let k = 0;
  const p = {
    mesh,
    begin() { k = 0; },
    end() { mesh.count = k; mesh.instanceMatrix.needsUpdate = true; },
    put(pos, size, stretch = null) {
      if (k >= n) return;
      if (stretch) { Q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), stretch.clone().normalize()); S.set(Math.max(size, stretch.length()), size, size); M4.compose(pos, Q, S); }
      else M4.makeScale(size, size, size).setPosition(pos);
      mesh.setMatrixAt(k++, M4);
    },
    /** periodic emitter; toWorld(v) optional transform (e.g. object.localToWorld) */
    emit(t, count, { origin, vel = [0, 4, 0], spread = [0.8, 0.3, 0.8], life = 1.5, size = 0.18, gravity = 0, seed = 0, maxY = Infinity, minY = -Infinity, toWorld = null, grow = 0.3 }) {
      const sp = Array.isArray(spread) ? spread : [spread, spread * 0.3, spread];
      for (let i = 0; i < count; i++) {
        const age = (t + rand(i + seed) * life) % life;
        V.set(origin[0] + (rand(i * 3 + seed) - 0.5) * sp[0], origin[1] + (rand(i * 3 + 1 + seed) - 0.5) * sp[1], origin[2] + (rand(i * 3 + 2 + seed) - 0.5) * sp[2]);
        const f = 0.7 + 0.6 * rand(i + seed + 9);
        V.x += vel[0] * age * f; V.y += vel[1] * age * f - 0.5 * gravity * age * age; V.z += vel[2] * age * f;
        if (toWorld) toWorld(V);
        if (V.y > maxY || V.y < minY) continue;
        p.put(V, size * (0.6 + 0.8 * rand(i + seed + 5)) * (1 + age * grow));
      }
    },
  };
  return p;
}

// ---------------------------------------------------------------- cloud sea (seen from above)
export function makeCloudSea(ctx, { y = 0, radius = 900, count = 260, seed = 1 } = {}) {
  const g = new THREE.Group(); ctx.scene.add(g);
  const m = lp.color(0xffffff, { roughness: 1 });
  const geo = facet(new THREE.IcosahedronGeometry(1, 1), 0.12, seed);
  const inst = new THREE.InstancedMesh(geo, m, count * 4);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  let k = 0;
  for (let i = 0; i < count; i++) {
    const a = rand(i + seed) * Math.PI * 2, r = Math.sqrt(rand(i * 7 + seed)) * radius;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    for (let j = 0; j < 4; j++) {
      const s = 14 + rand(i * 13 + j) * 26;
      E.set(rand(i + j) * 3, rand(i * 2 + j) * 3, 0); Q.setFromEuler(E);
      M4.compose(new THREE.Vector3(cx + (j - 1.5) * s * 0.9, y + rand(i * 5 + j) * 8, cz + (rand(i * 11 + j) - 0.5) * s), Q, new THREE.Vector3(s, s * 0.5, s));
      inst.setMatrixAt(k++, M4);
    }
  }
  inst.count = k; g.add(inst);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.6, 48).rotateX(-Math.PI / 2), lp.color(0xf3f6fa, { roughness: 1 }));
  floor.position.y = y - 4; g.add(floor);
  return g;
}

// ---------------------------------------------------------------- city block
export function makeCity(ctx, { count = 60, rMin = 60, rMax = 420, hMin = 20, hMax = 160, avoid = 40, seed = 3, ground = 0x6cc04a } = {}) {
  const g = new THREE.Group(); ctx.scene.add(g);
  const gr = new THREE.Mesh(new THREE.CircleGeometry(1400, 48).rotateX(-Math.PI / 2), lp.color(ground)); gr.receiveShadow = true; g.add(gr);
  const cols = [0xf2b8a2, 0xa9c7e8, 0xf4e1a1, 0xc5e3b8, 0xd9c2ec, 0xe8e8e8, 0x9fb6c9];
  const win = lp.color(0x5d7fa6);
  for (let i = 0; i < count; i++) {
    const a = rand(i + seed) * Math.PI * 2, r = rMin + rand(i * 3 + seed) * (rMax - rMin);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < avoid) continue;
    const h = hMin + Math.pow(rand(i * 5 + seed), 2) * (hMax - hMin), w = 14 + rand(i * 7) * 16, d = 14 + rand(i * 9) * 16;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lp.color(cols[i % cols.length])); b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; g.add(b);
    for (let f = 4; f < h - 2; f += 4.2) { const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1.2, d + 0.1), win); s.position.set(x, f, z); g.add(s); }
  }
  for (let i = 0; i < 50; i++) { const t = tree(i, 6 + rand(i) * 4); const a = rand(i + 70) * Math.PI * 2, r = avoid + rand(i + 80) * 120; t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); t.scale.setScalar(2); g.add(t); }
  return g;
}

export function skyClouds(ctx, { n = 10, y = 120, spread = 900, scale = 9, seed = 21 } = {}) {
  const g = new THREE.Group(); ctx.scene.add(g);
  for (let i = 0; i < n; i++) { const c = cloud(i + seed, scale + rand(i) * scale * 0.7); c.position.set(-spread / 2 + i * spread / n, y + rand(i + 1) * 40, -260 - rand(i) * 160); g.add(c); }
  return g;
}

/** golden-hour lighting */
export function goldenHour(ctx, k = 1) {
  const s = ctx.studio;
  s.sun.color.set(new THREE.Color(0xfff1d6).lerp(new THREE.Color(0xffb35c), k));
  s.sky.material.uniforms.top.value.set(new THREE.Color(0x3d9be9).lerp(new THREE.Color(0x3a5fa8), k));
  s.sky.material.uniforms.mid.value.set(new THREE.Color(0x8fd0ff).lerp(new THREE.Color(0xffb36b), k));
  s.sky.material.uniforms.bottom.value.set(new THREE.Color(0xe6f6ff).lerp(new THREE.Color(0xffd9a0), k));
}

// EPISODE — Why don't 800-meter skyscrapers fall over? (low-poly style, generic supertall)
// Units: meters. Tower axis = y. Wind blows along +x. Section plane z = 0 (camera on +z side).
import { makeCity, makeCloudSea, makeParticles, resetEnv, goldenHour } from '/engine/env.js';
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { Label, seg, smooth, easeOut, lerp, clamp, path, applyPose, rand, csg, brush } = kit;
  const { lp, makeCharacter, blinkAt, aimSun } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 36) => ({ pos, look, fov });
  const add = (m, parent) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
  cut.capSize = 2400;

  // ------------------------------------------------------------------ tower: chained tiers (each tier rotates slightly -> bending)
  const TIERS = [{ w: 64, h: 120 }, { w: 58, h: 110 }, { w: 52, h: 105 }, { w: 46, h: 100 }, { w: 40, h: 95 }, { w: 34, h: 90 }, { w: 28, h: 85 }, { w: 22, h: 75 }];
  const SPIRE = 70;
  const H = TIERS.reduce((s, t) => s + t.h, 0) + SPIRE;      // ~850 m
  const glass = lp.glass(0x8fd3ff, { opacity: 0.3, clippingPlanes: cut.planes });
  const mullionMat = lp.color(0x3d4b5c, { clippingPlanes: cut.planes });
  const slabMat = lp.color(0xe8e2d6, { clippingPlanes: cut.planes });
  const tiers = [];
  let parent = new THREE.Group(); scene.add(parent);
  const towerRoot = parent;
  TIERS.forEach((T, i) => {
    const g = new THREE.Group(); if (i > 0) g.position.y = TIERS[i - 1].h; parent.add(g);
    // glass skin (4 faces, clipped) + vertical mullions
    const half = T.w / 2;
    [[T.w, T.h, 0.3, 0, T.h / 2, half], [T.w, T.h, 0.3, 0, T.h / 2, -half], [0.3, T.h, T.w, half, T.h / 2, 0], [0.3, T.h, T.w, -half, T.h / 2, 0]].forEach(([a, b, c, x, y, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), glass); m.position.set(x, y, z); g.add(m); });
    const mul = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, T.h, 0.8), mullionMat, 40); g.add(mul);
    { const m4 = new THREE.Matrix4(); let k = 0; const n = 6;
      for (let j = 0; j <= n; j++) { const s = -half + j * T.w / n; [[s, half], [s, -half], [half, s], [-half, s]].forEach(([x, z]) => { if (k < 40) { m4.makeTranslation(x, T.h / 2, z); mul.setMatrixAt(k++, m4); } }); }
      mul.count = k; }
    // floor slabs every 12 m (clipped)
    const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(T.w - 1, 0.9, T.w - 1), slabMat, 12); g.add(slabs);
    { const m4 = new THREE.Matrix4(); let k = 0; for (let y = 6; y < T.h; y += 12) { m4.makeTranslation(0, y, 0); slabs.setMatrixAt(k++, m4); } slabs.count = k; }
    // structural core (concrete tube, sectioned) + mega columns at the corners (sectioned)
    const cw = Math.max(10, T.w * 0.36);
    const core = add(new THREE.Mesh(csg(brush(new THREE.BoxGeometry(cw, T.h, cw), { pos: [0, T.h / 2, 0] }), [['-', brush(new THREE.BoxGeometry(cw - 2.4, T.h + 2, cw - 2.4), { pos: [0, T.h / 2, 0] })]]), lp.color(0xb9b3a7)), g);
    cut.add(core, capMat(0x9d978c));
    const cols = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const c = add(new THREE.Mesh(new THREE.BoxGeometry(3.2, T.h, 3.2), lp.color(0x8d98a5)), g); c.position.set(sx * (half - 3), T.h / 2, sz * (half - 3)); cut.add(c, capMat(0x6f7884)); cols.push(c); });
    // outrigger / belt truss at the top of each tier
    const belt = add(new THREE.Mesh(new THREE.BoxGeometry(T.w - 1, 4, T.w - 1), lp.color(0xd89a22, { clippingPlanes: cut.planes })), g); belt.position.y = T.h - 2;
    tiers.push({ g, T, core, cols, belt });
    parent = g;
  });
  const spire = add(new THREE.Mesh(new THREE.ConeGeometry(4, SPIRE, 8), lp.metal(0xc9d2d9)), tiers[tiers.length - 1].g); spire.position.y = TIERS[TIERS.length - 1].h + SPIRE / 2;
  // tuned mass damper inside the top tier (pendulum hung by cables, with hydraulic dampers)
  const top = tiers[tiers.length - 2];                     // second highest tier = "upper floors"
  const TMD = { y: top.T.h * 0.55, L: 26, r: 6.5 };
  const pend = new THREE.Group(); pend.position.y = TMD.y + TMD.L; top.g.add(pend);
  const sphere = add(new THREE.Mesh(lowpoly.facet(new THREE.IcosahedronGeometry(TMD.r, 2), 0.04), lp.metal(0xe0b44a, { roughness: 0.25 })), pend); sphere.position.y = -TMD.L;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, TMD.L, 6), lp.metal(0x6f7a85)), pend); c.position.set(Math.cos(a) * 2.5, -TMD.L / 2, Math.sin(a) * 2.5); }
  const dampers = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const d = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8).rotateZ(Math.PI / 2), lp.color(0x2f7fd1)), top.g); d.position.set(Math.cos(a) * 11, TMD.y - 3, Math.sin(a) * 11); d.rotation.y = -a; dampers.push(d); }
  add(new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 1.2, 24), lp.color(0xe8e2d6, { clippingPlanes: cut.planes })), top.g).position.y = TMD.y - 8;
  const otto = makeCharacter('otto', { scale: 1.6 }); otto.position.set(9, TMD.y - 7.4, -6); otto.rotation.y = -0.6; top.g.add(otto);
  const nova = makeCharacter('nova', { scale: 1.6 }); scene.add(nova);

  // ------------------------------------------------------------------ ground: city + foundation (sectioned soil, raft, piles)
  const city = makeCity(ctx, { count: 110, rMin: 150, rMax: 650, hMin: 25, hMax: 220, avoid: 150 });
  const plaza = add(new THREE.Mesh(new THREE.BoxGeometry(150, 1, 150), lp.color(0xd8d2c4)), scene); plaza.position.y = -0.4;
  cut.add(plaza, capMat(0xb5ad9f));
  const soils = [[-1, -30, 0x9a7b55], [-30, -70, 0xb08a5a], [-70, -130, 0x7d6a5a]].map(([y0, y1, c]) => {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(300, y0 - y1, 300), lp.color(c)), scene); m.position.y = (y0 + y1) / 2; cut.add(m, capMat(c)); return m; });
  // soil boxes are hidden except for the foundation scene (they would cover the city ground)
  const raft = add(new THREE.Mesh(new THREE.BoxGeometry(84, 5, 84), lp.color(0xc9c4ba)), scene); raft.position.y = -3.5; cut.add(raft, capMat(0xa9a397));
  const piles = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const p = add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 10), lp.color(0xb9b3a7)), scene); p.position.set(-36 + i * 12, -36, -36 + j * 12); cut.add(p, capMat(0x9d978c)); piles.push(p); }
  const loadArrows = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 5, 8).rotateX(Math.PI), lp.color(0xff8a3a, { emissive: 0xff8a3a, emissiveIntensity: 0.6 }), 49); scene.add(loadArrows);

  // clouds around the upper tower
  const clouds = makeCloudSea(ctx, { y: 430, radius: 1100, count: 120, seed: 4 });

  // ------------------------------------------------------------------ wind particles + arrows + labels
  const wind = makeParticles(ctx, { n: 1100, color: 0xffffff, emissive: 0xe6f6ff, emissiveIntensity: 0.8 });
  function windField(t, n, yMin, yMax, strength = 1, seed = 0) {
    for (let i = 0; i < n; i++) {
      const life = 3.2, age = (t + rand(i + seed) * life) % life;
      const y = yMin + rand(i * 3 + seed) * (yMax - yMin), z0 = (rand(i * 5 + seed) - 0.5) * 240;
      let x = -260 + age * 170 * strength, z = z0;
      const w = Math.max(18, 64 - y / 18);
      if (Math.abs(z) < w * 1.3 && x > -w * 1.5 && x < w * 0.7) z += Math.sign(z || 1) * (w * 1.3 - Math.abs(z)) * 0.9;   // flow around the tower
      if (x > w * 0.7) z += Math.sin((x - w) * 0.05 + y * 0.02 + (z > 0 ? 0 : Math.PI)) * 14 * Math.exp(-(Math.abs(z) - w) / 60); // vortex wake
      wind.put(new THREE.Vector3(x, y, z), 0.6, new THREE.Vector3(9 * strength, 0, 0));
    }
  }
  const swayArrow = kit.parts.arrow(0xff4d4d, 2.6), tmdArrow = kit.parts.arrow(0x52ff9a, 2.6);
  scene.add(swayArrow, tmdArrow);
  const L = {
    core: new Label(ctx, 'CONCRETE CORE', { accent: '#b9b3a7', size: 0.034 }), cols: new Label(ctx, 'MEGA COLUMNS', { accent: '#8d98a5', size: 0.034 }),
    out: new Label(ctx, 'OUTRIGGER BELTS', { accent: '#d89a22', size: 0.034 }), raft: new Label(ctx, 'CONCRETE RAFT', { accent: '#c9c4ba', size: 0.034 }),
    piles: new Label(ctx, 'DEEP PILES', { accent: '#b9b3a7', size: 0.034 }), wind: new Label(ctx, 'WIND', { accent: '#e6f6ff', size: 0.04 }),
    exag: new Label(ctx, 'SWAY EXAGGERATED FOR CLARITY', { accent: '#9fb0bf', size: 0.024 }), tmd: new Label(ctx, 'TUNED MASS DAMPER', { accent: '#e0b44a', size: 0.036 }),
    sway: new Label(ctx, 'BUILDING SWAY', { accent: '#ff4d4d' }), counter: new Label(ctx, 'DAMPER MOVES\nTHE OPPOSITE WAY', { accent: '#52ff9a' }),
    hyd: new Label(ctx, 'HYDRAULIC DAMPERS', { accent: '#2f7fd1' }),
  };

  // ------------------------------------------------------------------ state + sway kinematics
  const W = 2 * Math.PI / 6.5;                  // sway period (s) shown on screen
  function sway(t, amp) {                        // amp = top deflection in meters (visual)
    const per = amp / H * 1.6;
    tiers.forEach((tr, i) => (tr.g.rotation.z = -per * Math.sin(W * t) * (0.4 + i * 0.16)));
  }
  function tmd(t, ampDeg) { pend.rotation.z = ampDeg * Math.PI / 180 * Math.sin(W * t); } // positive building sway -> damper swings the opposite way
  const tierWorld = (i, y = 0) => { const v = new THREE.Vector3(0, y, 0); tiers[i].g.localToWorld(v); return v; };
  function reset() {
    resetEnv(ctx); cut.setPlane([0, 0, -1], 900);
    sway(0, 0); pend.rotation.z = 0;
    soils.forEach(m => (m.visible = false)); raft.visible = false; piles.forEach(p => (p.visible = false)); loadArrows.count = 0;
    clouds.visible = true; city.visible = true; nova.visible = false; otto.visible = true;
    swayArrow.setOpacity(0); tmdArrow.setOpacity(0);
    Object.values(L).forEach(l => l.set(0));
    tiers.forEach(tr => { tr.core.material.emissive = new THREE.Color(0); tr.cols.forEach(c => (c.material.emissive = new THREE.Color(0))); tr.belt.material.emissive = new THREE.Color(0); });
    wind.begin();
    ctx.grade.uniforms.fade.value = 0;
  }
  function finish(t) { otto.pose({ blink: blinkAt(t, 3), head: [-0.3, 0.3, 0], mouth: 'o' }); wind.end(); }
  const glowTier = (prop, color, k) => tiers.forEach(tr => { const ms = prop === 'cols' ? tr.cols : [tr[prop]]; ms.forEach(m => (m.material.emissive = new THREE.Color(color).multiplyScalar(k))); });

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      const u = t / d;
      sway(t, 2); nova.visible = true; nova.position.set(56, 0.6, 76); nova.rotation.y = -2.4;
      nova.pose({ blink: blinkAt(t, 2), head: [-0.6, 0, 0], mouth: 'o', brows: -0.3 });
      windField(t, 500, 20, 800, 1, 0);
      set(path([[0, P([62, 3.2, 84], [48, 4.5, 60], 50)], [0.25 * d, P([72, 4, 96], [20, 120, 0], 50)], [d, P([96, 50, 120], [0, 650, 0], 46)]], t));
      L.wind.set(seg(u, 0.6, 0.7), null, [-0.7, 0.3]);
      aimSun(ctx.studio, [0, 300, 0], 500);
      finish(t);
    },
    S02(t, d) {
      const u = t / d;
      sway(t, 2); clouds.visible = false;
      cut.setPlane([0, 0, -1], lerp(70, 0, seg(u, 0.1, 0.8)));
      set(path([[0, P([700, 420, 900], [0, 400, 0], 40)], [d, P([520, 400, 1050], [0, 410, 0], 40)]], t));
      aimSun(ctx.studio, [0, 400, 0], 500);
      finish(t);
    },
    S03(t, d) {
      const u = t / d;
      sway(t, 2); cut.setPlane([0, 0, -1], 0); clouds.visible = false;
      glowTier('core', 0xffd8a0, 0.5 * seg(u, 0.1, 0.25)); glowTier('cols', 0x9fd0ff, 0.6 * seg(u, 0.4, 0.55)); glowTier('belt', 0xffa020, 0.6 * seg(u, 0.65, 0.8));
      set(path([[0, P([120, 160, 240], [0, 190, 0], 40)], [d, P([90, 330, 230], [0, 360, 0], 40)]], t));
      const y = lerp(190, 360, u);
      L.core.set(seg(u, 0.12, 0.22), tierWorld(1, 60).add(new THREE.Vector3(5, 0, 0.5)).toArray(), [-0.85, 0.5]);
      L.cols.set(seg(u, 0.42, 0.52), tierWorld(2, 60).add(new THREE.Vector3(23, 0, -23)).toArray(), [-0.85, -0.3]);
      L.out.set(seg(u, 0.66, 0.76), tierWorld(2, 103).add(new THREE.Vector3(10, 0, 0.5)).toArray(), [0.05, 0.58]);
      void y;
      aimSun(ctx.studio, [0, 250, 0], 300);
      finish(t);
    },
    S04(t, d) {
      const u = t / d;
      cut.setPlane([0, 0, -1], 0);
      soils.forEach(m => (m.visible = true)); raft.visible = true; piles.forEach(p => (p.visible = true)); city.visible = false;
      const k = seg(u, 0.35, 0.9);
      const m4 = new THREE.Matrix4(); let n = 0;
      piles.forEach((p, i) => { const s = 0.6 + 0.4 * Math.sin(t * 4 - i * 0.2); m4.compose(new THREE.Vector3(p.position.x, -66 - k * 8, p.position.z + 2), new THREE.Quaternion(), new THREE.Vector3(s * k, s * k, s * k)); loadArrows.setMatrixAt(n++, m4); });
      loadArrows.count = n; loadArrows.instanceMatrix.needsUpdate = true;
      set(path([[0, P([150, 60, 230], [0, 10, 0], 40)], [0.5 * d, P([110, -20, 190], [0, -30, 0], 40)], [d, P([100, -30, 170], [0, -40, 0], 40)]], t));
      L.raft.set(seg(u, 0.3, 0.42), [20, -3.5, 0.5], [-0.85, 0.45]);
      L.piles.set(seg(u, 0.5, 0.62), [24, -40, 0.5], [-0.85, -0.3]);
      aimSun(ctx.studio, [0, -20, 0], 150);
      finish(t);
    },
    S05(t, d) {
      const u = t / d;
      sway(t, 18);
      windField(t, 900, 150, 840, 1.15, 7);
      const tw = tierWorld(7, 0);
      set(path([[0, P([380, 520, 620], [0, 560, 0], 40)], [d, P([-150, 560, 700], [0, 570, 0], 40)]], t));
      L.wind.set(seg(u, 0.1, 0.2), null, [-0.75, 0.55]);
      L.exag.set(seg(u, 0.3, 0.4), null, [-0.6, -0.55]);
      void tw;
      aimSun(ctx.studio, [0, 550, 0], 400);
      finish(t);
    },
    S06(t, d) {
      const u = t / d;
      sway(t, 3); tmd(t, 3);
      cut.setPlane([0, 0, -1], lerp(40, 0, seg(u, 0.0, 0.3)));
      dampers.forEach((m, i) => (m.material.emissive = new THREE.Color(0x2f7fd1).multiplyScalar(0.5 * seg(u, 0.6, 0.7) * (0.6 + 0.4 * Math.sin(t * 5 + i)))));
      const c = tierWorld(6, TMD.y);
      set(path([[0, P([c.x + 160, c.y + 60, 240], [c.x, c.y, 0], 40)], [0.35 * d, P([c.x + 30, c.y + 6, 62], [c.x, c.y - 2, 0], 40)], [d, P([c.x - 26, c.y + 4, 56], [c.x, c.y - 1, 0], 40)]], t));
      L.tmd.set(seg(u, 0.35, 0.45), tierWorld(6, TMD.y).add(new THREE.Vector3(0, 6, 1)).toArray(), [-0.75, 0.55]);
      L.hyd.set(seg(u, 0.62, 0.72), tierWorld(6, TMD.y - 3).add(new THREE.Vector3(8, 0, 2)).toArray(), [-0.85, -0.35]);
      aimSun(ctx.studio, [c.x, c.y, 0], 60);
      finish(t);
    },
    S07(t, d) {
      const u = t / d;
      const decay = lerp(14, 6, seg(u, 0.3, 0.9));
      sway(t, decay); tmd(t, 9);
      cut.setPlane([0, 0, -1], 0);
      const c = tierWorld(6, TMD.y);
      const s = Math.sin(W * t);
      swayArrow.setOpacity(seg(u, 0.1, 0.2)); swayArrow.position.set(c.x, c.y + 70, 30); swayArrow.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; swayArrow.setLength(10 + 12 * Math.abs(s) * decay / 14);
      tmdArrow.setOpacity(seg(u, 0.25, 0.35)); tmdArrow.position.set(c.x, c.y - 4, 30); tmdArrow.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2; tmdArrow.setLength(8 + 14 * Math.abs(s));
      set(path([[0, P([c.x + 40, c.y + 20, 170], [c.x, c.y + 20, 0], 40)], [d, P([c.x - 20, c.y + 18, 160], [c.x, c.y + 18, 0], 40)]], t));
      L.sway.set(seg(u, 0.15, 0.25), [c.x, c.y + 72, 30], [-0.85, 0.55]);
      L.counter.set(seg(u, 0.3, 0.4), [c.x, c.y - 6, 30], [-0.85, -0.38]);
      L.exag.set(seg(u, 0.5, 0.6), null, [-0.6, -0.6]);
      aimSun(ctx.studio, [c.x, c.y, 0], 120);
      finish(t);
    },
    S08(t, d) {
      sway(t, 2);
      windField(t, 500, 400, 840, 1.1, 13);
      set(path([[0, P([900, 560, 900], [0, 560, 0], 38)], [d, P([820, 600, 980], [0, 580, 0], 38)]], t));
      aimSun(ctx.studio, [0, 600, 0], 500);
      finish(t);
    },
    S09(t, d) {
      const u = t / d;
      goldenHour(ctx, seg(u, 0, 0.5));
      sway(t, 1.5); clouds.visible = u < 0.4;
      set(path([[0, P([300, 520, 520], [0, 520, 0], 38)], [d, P([1600, 520, 2300], [0, 300, 0], 38)]], t));
      aimSun(ctx.studio, [0, 300, 0], 900);
      finish(t);
    },
  };
  return { reset, scenes };
}

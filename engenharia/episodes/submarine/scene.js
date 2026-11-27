// EPISODE — How does a submarine sink and rise again? (low-poly style, original cast)
// Units: meters. Submarine axis = x (bow at +x). Sea surface y = 0. Section plane z = 0 (camera on +z side).
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { brush, csg, Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, orbit, applyPose, rand } = kit;
  const { lp, facet, makeCharacter, cloud, blinkAt, aimSun } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 34) => ({ pos, look, fov });
  const add = (m, parent = scene) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
  cut.capSize = 400;

  // ------------------------------------------------------------------ hull profile (revolution about x)
  const R = 5, XB = 50, XS = -50;
  const r = x => x > 38 ? R * Math.sqrt(Math.max(0, 1 - ((x - 38) / 12) ** 2))
    : x > -22 ? R : 0.7 + (R - 0.7) * Math.pow((x + 50) / 28, 1.35);
  function lathe(fr, x0, x1, n = 80, seg = 28) {
    const pts = [new THREE.Vector2(0, x0)];
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push(new THREE.Vector2(Math.max(0.05, fr(x)), x)); }
    pts.push(new THREE.Vector2(0, x1));
    const g = new THREE.LatheGeometry(pts, seg); g.rotateZ(-Math.PI / 2); // lathe axis y -> +x (bow at +x)
    return g;
  }
  const outerSolid = lathe(r, XS, XB);
  const innerFn = x => r(x) - 0.35;
  const innerSolid = lathe(innerFn, XS + 1.2, XB - 0.8);
  const PH = { r: 4.0, x0: -33, x1: 36 };            // pressure hull

  const sub = new THREE.Group(); scene.add(sub);
  const hullMat = lp.color(0x2b3139, { roughness: 0.55, metalness: 0.25 });
  const hullGeo = csg(brush(outerSolid.clone()), [['-', brush(innerSolid.clone())]]);
  const hull = add(new THREE.Mesh(hullGeo, hullMat), sub); cut.add(hull, capMat(0x59626d));
  // pressure hull shell (closed ends = bulkheads)
  const X = g => g.rotateZ(-Math.PI / 2);
  const phGeo = csg(brush(X(new THREE.CylinderGeometry(PH.r, PH.r, PH.x1 - PH.x0, 36)), { pos: [(PH.x0 + PH.x1) / 2, 0, 0] }),
    [['-', brush(X(new THREE.CylinderGeometry(PH.r - 0.3, PH.r - 0.3, PH.x1 - PH.x0 - 0.6, 36)), { pos: [(PH.x0 + PH.x1) / 2, 0, 0] })]]);
  const phull = add(new THREE.Mesh(phGeo, lp.metal(0x8d98a5)), sub); cut.add(phull, capMat(0xb8c1cb));
  // sail (fin) + planes + stern cross + propeller
  const sailGeo = csg(brush(new THREE.BoxGeometry(9, 8, 2.6), { pos: [24, R + 3.4, 0] }), [['+', brush(new THREE.CylinderGeometry(1.3, 1.3, 8, 16), { pos: [28.5, R + 3.4, 0] })]]);
  const sail = add(new THREE.Mesh(sailGeo, hullMat), sub); cut.add(sail, capMat(0x59626d));
  [-1, 1].forEach(s => { const pl = add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 3.2), hullMat), sub); pl.position.set(26, R + 4.4, s * 2.9); });
  const fins = new THREE.Group(); fins.position.set(-44, 0, 0); sub.add(fins);
  add(new THREE.Mesh(new THREE.BoxGeometry(5, 5.5, 0.4), hullMat), fins).position.set(0, 3.2, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(5, 5.5, 0.4), hullMat), fins).position.set(0, -3.2, 0);
  [-1, 1].forEach(s => add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 5.5), hullMat), fins).position.set(0, 0, s * 3.2));
  const prop = new THREE.Group(); prop.position.set(-50.6, 0, 0); sub.add(prop);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 12).rotateZ(Math.PI / 2), lp.metal(0x9a7b3c)), prop);
  for (let i = 0; i < 7; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 1.2), lp.metal(0xb08a3e)), prop); b.geometry.translate(0, 1.7, 0); b.rotation.x = i / 7 * Math.PI * 2; b.rotation.y = 0.35; }

  // ------------------------------------------------------------------ interior (inside the pressure hull)
  const interior = new THREE.Group(); sub.add(interior);
  const clipM = (c, o = {}) => lp.color(c, { clippingPlanes: cut.planes, ...o });
  [[-1.4, 0xc9c2b4], [1.3, 0xbdb6a8]].forEach(([y, c]) => add(new THREE.Mesh(new THREE.BoxGeometry(PH.x1 - PH.x0 - 1, 0.25, 6.6), clipM(c)), interior).position.set((PH.x0 + PH.x1) / 2, y, 0));
  for (let i = 0; i < 9; i++) {
    const x = PH.x0 + 4 + i * 7.3;
    add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), clipM([0x3f6fd8, 0xe5483e, 0x3fb36a, 0xf2b632][i % 4])), interior).position.set(x, -0.6, -1.8);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.2), clipM(0x6b7580)), interior).position.set(x + 2.5, 2.0, -2.0);
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(PH.x1 - PH.x0 - 2, 0.12, 0.6), lp.emissive(0xfff0c8, 1.0)), interior).position.set((PH.x0 + PH.x1) / 2, 3.4, -1.2);
  // periscope from the sail into the control room
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 10), lp.metal(0xa9b3bd)), interior).position.set(25.5, 4.1, -0.6);
  const otto = makeCharacter('otto'); otto.position.set(24.2, -1.27, -0.6); otto.rotation.y = Math.PI / 2; sub.add(otto);
  // trim tanks (small, inside the pressure hull fore and aft)
  const trimMat = lp.color(0x37d2ff, { transparent: true, opacity: 0.7, clippingPlanes: cut.planes });
  const trims = [33, -30].map(x => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.5), trimMat.clone()), interior); m.position.set(x, -2.6, 0); return m; });
  // high-pressure air flasks + pipes to both ballast tanks
  const flasks = [];
  for (let i = 0; i < 3; i++) { const f = add(new THREE.Mesh(X(new THREE.CylinderGeometry(0.45, 0.45, 5, 12)), clipM(0x2f7fd1)), interior); f.position.set(29, -2.85 + 0 * i, -0.9 - i * 1.0); flasks.push(f); }
  const pipeBow = kit.parts.pipe([[31.5, -2.7, -1.5], [34.5, -1.5, -1.5], [36.6, 1.5, -1.5], [40.5, 2.6, -1.2]], 0.16, clipM(0xf2b632));
  const pipeAft = kit.parts.pipe([[26.5, -2.7, -1.5], [0, -3.2, -2.0], [-31, -3.0, -1.6], [-34.5, -1.0, -1.4], [-38, 1.5, -1.2]], 0.16, clipM(0xf2b632));
  sub.add(pipeBow.mesh, pipeAft.mesh);
  const flowBow = kit.parts.flow(pipeBow.curve, 26, 0x9ff6ff, 0.13), flowAft = kit.parts.flow(pipeAft.curve, 60, 0x9ff6ff, 0.13);
  sub.add(flowBow, flowAft);

  // ------------------------------------------------------------------ main ballast tanks: air / water volumes
  const TANKS = [{ x0: 36.3, x1: 48.2, vent: 44, ports: [40.5, 45.5] }, { x0: -45.5, x1: -33.3, vent: -38, ports: [-42.5, -36.5] }];
  const tankParts = TANKS.map(T => {
    const geo = csg(brush(innerSolid.clone()), [['&', brush(new THREE.BoxGeometry(T.x1 - T.x0, 12, 12), { pos: [(T.x0 + T.x1) / 2, 0, 0] })]]);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const levelW = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), levelA = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0f4fa8, transparent: true, opacity: 0.82, roughness: 0.3, flatShading: true, side: THREE.DoubleSide, clippingPlanes: [cut.plane, levelW], depthWrite: false }));
    const air = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x3fd0ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.42, flatShading: true, side: THREE.DoubleSide, clippingPlanes: [cut.plane, levelA], depthWrite: false }));
    water.renderOrder = 60; air.renderOrder = 61;
    sub.add(water, air);
    // vent valve on top, flood ports (dark slots) at the bottom
    const vt = r(T.vent);
    const ventG = new THREE.Group(); ventG.position.set(T.vent, vt - 0.1, 0); sub.add(ventG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 12), lp.metal(0x6b7580)), ventG).position.y = 0.2;
    const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.15, 12), lp.color(0xe5483e)), ventG); disc.position.y = 0.5;
    const ports = T.ports.map(px => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.0), lp.color(0x0b0e12)), sub); m.position.set(px, -r(px) + 0.05, 0.6); return m; });
    return { T, geo, bb, water, air, levelW, levelA, disc, ventG, ports };
  });
  /** fill = fraction of the tank volume height filled with water (0 = all air) */
  function setFill(i, fill) {
    const tp = tankParts[i];
    const yb = tp.bb.min.y, yt = tp.bb.max.y;
    const local = new THREE.Vector3((tp.T.x0 + tp.T.x1) / 2, lerp(yb, yt, clamp(fill)), 0);
    sub.updateMatrixWorld(); const w = sub.localToWorld(local);
    tp.levelW.constant = w.y; tp.levelA.constant = -w.y;   // world-horizontal water surface
  }
  const tankGlow = k => tankParts.forEach(tp => { tp.air.material.emissiveIntensity = 0.55 + 1.2 * k; tp.water.material.emissive = new THREE.Color(0x1a6fff).multiplyScalar(0.8 * k); });

  // ------------------------------------------------------------------ ocean (surface + underside + rays)
  const oceanGeo = new THREE.PlaneGeometry(1600, 1600, 80, 80); oceanGeo.rotateX(-Math.PI / 2);
  const base = oceanGeo.attributes.position.array.slice();
  const oceanMat = lp.color(0x2a8fd8, { roughness: 0.3, metalness: 0.05, transparent: true, opacity: 1 });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat); ocean.receiveShadow = true; scene.add(ocean);
  const under = new THREE.Mesh(oceanGeo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.BackSide, fog: true }));
  scene.add(under);
  function waves(t, amp = 1) {
    const a = oceanGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const x = base[i], z = base[i + 2];
      a[i + 1] = amp * (0.7 * Math.sin(x * 0.05 + t * 1.2) + 0.5 * Math.sin(z * 0.07 - t) + 0.25 * Math.sin((x + z) * 0.13 + t * 2)); }
    oceanGeo.attributes.position.needsUpdate = true; oceanGeo.computeVertexNormals();
  }
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + rand(i) * 5, 160), new THREE.MeshBasicMaterial({ color: 0xbff2ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, -80, 0); scene.add(m); rays.push(m);
  }
  function placeRays(t, around, strength) {
    rays.forEach((m, i) => {
      m.visible = strength > 0;
      m.position.set(around[0] + (rand(i + 3) - 0.5) * 120 + Math.sin(t * 0.3 + i) * 3, 0, around[2] + (rand(i + 7) - 0.5) * 90 - 20);
      m.rotation.set(0.12 * Math.sin(i), Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), 0.18 * (rand(i) - 0.5));
      m.material.opacity = 0.7 * strength * (0.035 + 0.03 * Math.sin(t * 0.7 + i * 1.3));
    });
  }
  for (let i = 0; i < 8; i++) { const c = cloud(i + 21, 8 + rand(i) * 6); c.position.set(-300 + i * 90, 90 + rand(i + 1) * 40, -260 - rand(i) * 120); scene.add(c); }

  // ------------------------------------------------------------------ particles (bubbles, water jets, spray)
  const NP = 700;
  const parts = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lp.color(0xe8fbff, { emissive: 0x9fe6ff, emissiveIntensity: 0.4 }), NP);
  scene.add(parts);
  const waterDrops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lp.color(0x2f8ff0, { emissive: 0x0f4fa8, emissiveIntensity: 0.3 }), NP);
  scene.add(waterDrops);
  let np = 0, nw = 0; const M4 = new THREE.Matrix4(), V = new THREE.Vector3();
  function beginParticles() { np = 0; nw = 0; }
  function endParticles() { parts.count = np; waterDrops.count = nw; parts.instanceMatrix.needsUpdate = true; waterDrops.instanceMatrix.needsUpdate = true; }
  function put(mesh, pos, size) { const k = mesh === parts ? np++ : nw++; if (k >= NP) return; M4.makeScale(size, size, size).setPosition(pos); mesh.setMatrixAt(k, M4); }
  /** generic emitter: origin in sub-local or world coords, velocity, gravity, spread */
  function emit(mesh, t, n, { origin, local = true, vel = [0, 4, 0], spread = 0.8, life = 1.5, size = 0.18, gravity = 0, seed = 0, maxY = Infinity }) {
    for (let i = 0; i < n; i++) {
      const age = ((t + rand(i + seed) * life) % life);
      V.set(origin[0] + (rand(i * 3 + seed) - 0.5) * spread, origin[1] + (rand(i * 3 + 1 + seed) - 0.5) * spread * 0.3, origin[2] + (rand(i * 3 + 2 + seed) - 0.5) * spread);
      V.x += vel[0] * age * (0.7 + 0.6 * rand(i + seed + 9)); V.y += vel[1] * age * (0.7 + 0.6 * rand(i + seed + 11)) - 0.5 * gravity * age * age; V.z += vel[2] * age;
      if (local) { sub.updateMatrixWorld(); sub.localToWorld(V); }
      if (V.y > maxY) continue;
      put(mesh, V, size * (0.6 + 0.8 * rand(i + seed + 5)) * (1 + age * 0.3));
    }
  }

  // ------------------------------------------------------------------ force arrows + labels
  const arrowUp = kit.parts.arrow(0x52ff9a, 0.45), arrowDn = kit.parts.arrow(0xff4d4d, 0.45);
  scene.add(arrowUp, arrowDn); arrowDn.rotation.z = Math.PI;
  function forces(k, up, dn) {
    arrowUp.setOpacity(k); arrowDn.setOpacity(k);
    if (k <= 0) return;
    const c = sub.position;
    arrowUp.position.set(c.x + 5, c.y + R + 9, c.z + 6); arrowUp.setLength(up);
    arrowDn.position.set(c.x - 5, c.y - R - 1, c.z + 6); arrowDn.setLength(dn);
  }
  const L = {
    tanks: new Label(ctx, 'MAIN BALLAST TANKS', { accent: '#37d2ff', size: 0.034 }), tank2: new Label(ctx, 'BALLAST TANK', { accent: '#37d2ff' }),
    ph: new Label(ctx, 'PRESSURE HULL', { accent: '#b8c1cb' }), air: new Label(ctx, 'AIR', { accent: '#7fe9ff', size: 0.036 }),
    water: new Label(ctx, 'SEAWATER', { accent: '#2f8ff0', size: 0.036 }), vent: new Label(ctx, 'VENT OPEN', { accent: '#e5483e' }),
    ports: new Label(ctx, 'FLOOD PORTS', { accent: '#9fb0bf' }), hp: new Label(ctx, 'HIGH-PRESSURE AIR', { accent: '#f2b632' }),
    buoy: new Label(ctx, 'BUOYANCY', { accent: '#52ff9a' }), weight: new Label(ctx, 'WEIGHT', { accent: '#ff4d4d' }),
    neutral: new Label(ctx, 'NEUTRAL BUOYANCY', { accent: '#52ff9a', size: 0.038 }), trim: new Label(ctx, 'TRIM TANKS', { accent: '#37d2ff' }),
  };

  // ------------------------------------------------------------------ state
  function reset() {
    cut.setPlane([0, 0, -1], 100);
    sub.position.set(0, -1.5, 0); sub.rotation.set(0, 0, 0);
    Object.values(L).forEach(l => l.set(0));
    forces(0);
    tankParts.forEach((tp, i) => { setFill(i, 0); tp.disc.position.y = 0.5; });
    tankGlow(0);
    trims.forEach(m => m.material.emissive = new THREE.Color(0));
    flowBow.visible = flowAft.visible = false;
    oceanMat.opacity = 1; oceanMat.transparent = false; oceanMat.depthWrite = true;
    interior.visible = true; otto.visible = true;
    scene.fog = null; scene.background = null; ctx.studio.sky.visible = true;
    under.visible = true;
    rays.forEach(m => (m.visible = false));
    ctx.studio.sun.intensity = 2.6; ctx.studio.hemi.intensity = 1.1;
    ctx.grade.uniforms.fade.value = 0;
    beginParticles();
  }
  /** underwater look based on camera depth */
  function environment(t, raysK = 1) {
    const y = camera.position.y;
    if (y < 0) {
      const d = clamp(-y / 140);
      const col = new THREE.Color(0x14598f).lerp(new THREE.Color(0x020b17), d);
      scene.fog = new THREE.FogExp2(col, 0.0095 + 0.004 * d);
      scene.background = col; ctx.studio.sky.visible = false;
      ctx.studio.sun.intensity = 2.6 * (1 - 0.75 * d); ctx.studio.hemi.intensity = 1.2 - 0.6 * d;
      placeRays(t, [sub.position.x, 0, sub.position.z], raysK * (1 - d * 0.6));
    }
  }
  function finish(t) {
    prop.rotation.x = -t * 2.5;
    otto.pose({ blink: blinkAt(t, 3), head: [0.15, 0, 0], armL: [-2.6, 0, -0.2], armR: [-2.6, 0, 0.2] });
    endParticles();
  }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      waves(t);
      const u = t / d;
      sub.position.set(-20 + 3 * t, lerp(-1.5, -16, seg(u, 0.05, 1, x => smooth(x) * 0.7 + x * 0.3)), 0);
      sub.rotation.z = -0.05 * seg(u, 0, 0.4) * (1 - seg(u, 0.7, 1));
      tankParts.forEach((tp, i) => setFill(i, 0.6 + 0.4 * u));
      interior.visible = false; otto.visible = false;
      TANKS.forEach((T, i) => emit(parts, t, 90, { origin: [T.vent, r(T.vent) + 0.6, 0], vel: [0, 7, 0], spread: 1.2, life: 2.2, size: 0.32, seed: i * 50, maxY: 0 }));
      set(path([[0, P([70, -46, 78], [2, -4, 0], 38)], [d, P([62, -50, 70], [4, -12, 0], 38)]], t));
      environment(t, 1.3);
      aimSun(ctx.studio, [0, -10, 0], 70);
      finish(t);
    },
    S02(t, d) {
      const u = t / d;
      sub.position.set(0, -32 + Math.sin(t * 0.6) * 0.3, 0);
      tankParts.forEach((tp, i) => setFill(i, 1));
      cut.setPlane([0, 0, -1], lerp(12, 0, seg(u, 0.0, 0.45)));
      tankGlow(seg(u, 0.5, 0.65) * (0.6 + 0.4 * Math.sin(t * 5)));
      set(path([[0, P([84, -20, 84], [6, -32, 0], 36)], [0.5 * d, P([40, -26, 84], [10, -32, 0], 36)], [d, P([50, -29.5, 44], [33, -32, 0], 36)]], t));
      environment(t, 0.9);
      L.ph.set(seg(u, 0.38, 0.48), [28, -32 + 3.9, 0.2], [-0.85, 0.48]);
      L.tanks.set(seg(u, 0.55, 0.65), [43, -32 + 0.5, 0.3], [-0.6, -0.3]);
      
      aimSun(ctx.studio, [0, -30, 0], 70);
      finish(t);
    },
    S03(t, d) {
      waves(t, 0.6);
      const u = t / d;
      sub.position.set(0, -1.5 + 0.25 * Math.sin(t * 1.2), 0); sub.rotation.z = 0.01 * Math.sin(t);
      cut.setPlane([0, 0, -1], 0);
      tankParts.forEach((tp, i) => setFill(i, 0.04));
      oceanMat.transparent = true; oceanMat.opacity = 0.45; oceanMat.depthWrite = false; under.visible = false;
      tankGlow(0.3 + 0.2 * Math.sin(t * 4));
      forces(seg(u, 0.4, 0.55), 14, 9);
      set(path([[0, P([44, 4, 46], [32, -1, 0], 36)], [d, P([45, 3, 40], [34, -1, 0], 36)]], t));
      L.air.set(seg(u, 0.25, 0.35), [44, 0.5, 0.3], [-0.15, -0.38]);
      L.buoy.set(seg(u, 0.5, 0.6), [sub.position.x + 5, sub.position.y + R + 14, 6], [-0.85, 0.62]);
      L.weight.set(seg(u, 0.55, 0.65), [sub.position.x - 5, sub.position.y - R - 9, 6], [-0.85, -0.48]);
      aimSun(ctx.studio, [10, 0, 0], 50);
      finish(t);
    },
    S04(t, d) {
      waves(t, 0.6);
      const u = t / d;
      const fill = seg(u, 0.12, 0.95, x => x);
      sub.position.set(0, lerp(-1.5, -4.5, seg(u, 0.25, 1)), 0); sub.rotation.z = -0.03 * seg(u, 0.3, 1);
      cut.setPlane([0, 0, -1], 0);
      tankParts.forEach((tp, i) => { setFill(i, fill); tp.disc.position.y = 0.5 + 0.7 * seg(u, 0.04, 0.12); });
      oceanMat.transparent = true; oceanMat.opacity = 0.45; oceanMat.depthWrite = false; under.visible = false;
      const T = TANKS[0];
      if (u > 0.1) {
        emit(parts, t, 160, { origin: [T.vent, r(T.vent) + 1.0, 0], vel: [0, 9, 0], spread: 0.8, life: 1.0, size: 0.22, gravity: 6, seed: 3 });  // air jet / spray
        T.ports.forEach((px, j) => emit(waterDrops, t, 70, { origin: [px, -r(px) - 0.8, 0.4], vel: [0, 3.2, 0], spread: 1.6, life: 1.1, size: 0.2, seed: 40 + j * 20 }));
      }
      set(path([[0, P([52, 1.5, 26], [42.5, -1.2, 0], 36)], [d, P([53, -0.5, 23], [42.5, -2.8, 0], 36)]], t));
      L.vent.set(seg(u, 0.12, 0.22), [T.vent, r(T.vent) + 0.8 - 1.5, 0.3], [-0.85, 0.5]);
      L.ports.set(seg(u, 0.3, 0.4), [T.ports[0], -r(T.ports[0]) - 1.5, 0.6], [-0.85, -0.45]);
      L.water.set(seg(u, 0.55, 0.65), [42.5, -3.0, 0.2], [0.15, -0.3]);
      aimSun(ctx.studio, [42, 0, 0], 20);
      finish(t);
    },
    S05(t, d) {
      const u = t / d;
      sub.position.set(-5 + 2 * t, lerp(-10, -26, u), 0); sub.rotation.z = -0.06;
      tankParts.forEach((tp, i) => setFill(i, 1));
      interior.visible = false; otto.visible = false;
      TANKS.forEach((T, i) => emit(parts, t, 50, { origin: [T.vent, r(T.vent) + 0.6, 0], vel: [0, 6, 0], spread: 1.5, life: 3, size: 0.28, seed: i * 31 }));
      forces(seg(u, 0.2, 0.4), 7, 13);
      set(path([[0, P([96, -6, 92], [2, -14, 0], 38)], [d, P([88, -18, 84], [4, -26, 0], 38)]], t));
      environment(t, 1.1);
      aimSun(ctx.studio, [0, -18, 0], 70);
      finish(t);
    },
    S06(t, d) {
      const u = t / d;
      cut.setPlane([0, 0, -1], 0);
      if (u < 0.56) {
        const k = seg(u, 0.08, 0.52, x => x);
        sub.position.set(0, -40, 0);
        tankParts.forEach((tp, i) => setFill(i, 1 - 0.88 * k));
        flowBow.visible = flowAft.visible = u > 0.05;
        flowBow.update(t, 0.6); flowAft.update(t, 0.25);
        flasks.forEach(f => (f.material.emissive = new THREE.Color(0x2f7fd1).multiplyScalar(0.6 * (0.5 + 0.5 * Math.sin(t * 6)))));
        TANKS.forEach((T, i) => T.ports.forEach((px, j) => emit(waterDrops, t, 60, { origin: [px, -r(px) + 0.2, 0.4], vel: [0, -3.5, 0], spread: 1.4, life: 1.2, size: 0.2, seed: 70 + i * 40 + j * 20 })));
        set(path([[0, P([30, -36, 30], [33, -40, -0.5], 36)], [0.56 * d, P([36, -37, 25], [37, -40, -0.5], 36)]], t));
        L.hp.set(seg(u, 0.1, 0.18), [29, -42.8, -0.9], [-0.85, -0.4]);
        L.air.set(seg(u, 0.3, 0.38), [42.5, -38.5, 0.2], [0.1, 0.55]);
        environment(t, 0.6);
        aimSun(ctx.studio, [34, -40, 0], 16);
      } else {
        const k = seg(u, 0.56, 1);
        tankParts.forEach((tp, i) => setFill(i, 0.12));
        cut.setPlane([0, 0, -1], 100);
        sub.position.set(-10 + 3 * (t - 0.56 * d), lerp(-40, -9, k), 0); sub.rotation.z = 0.06 * seg(u, 0.56, 0.7);
        interior.visible = false; otto.visible = false;
        forces(seg(u, 0.62, 0.72), lerp(10, 16, k), 9);
        set(path([[0.56 * d, P([62, -52, 60], [0, -34, 0], 40)], [d, P([58, -40, 54], [4, -10, 0], 40)]], t));
        L.buoy.set(seg(u, 0.72, 0.8), [sub.position.x + 5, sub.position.y + R + 14, 6], [-0.85, 0.6]);
        environment(t, 1.2);
        aimSun(ctx.studio, [0, -20, 0], 70);
      }
      finish(t);
    },
    S07(t, d) {
      const u = t / d;
      sub.position.set(0, -70 + Math.sin(t * 0.8) * 0.15, 0);
      tankParts.forEach((tp, i) => setFill(i, 1));
      cut.setPlane([0, 0, -1], lerp(100, 0, seg(u, 0.45, 0.65)));
      trims.forEach((m, i) => (m.material.emissive = new THREE.Color(0x37d2ff).multiplyScalar(0.8 * seg(u, 0.6, 0.7) * (0.6 + 0.4 * Math.sin(t * 5 + i)))));
      forces(seg(u, 0.25, 0.4), 11, 11);
      set(path([[0, P([80, -58, 92], [0, -70, 0], 38)], [d, P([24, -62, 112], [0, -70, 0], 38)]], t, x => x));
      L.neutral.set(seg(u, 0.3, 0.42), null, [-0.6, 0.6]);
      L.trim.set(seg(u, 0.66, 0.76), [33, -72.6, 0.2], [-0.4, -0.42]);
      environment(t, 1.4);
      aimSun(ctx.studio, [0, -70, 0], 70);
      finish(t);
    },
    S08(t, d) {
      waves(t, 1.1);
      const u = t / d;
      // emergency-blow style breach: bow rises out of the water, then settles at the surface
      const rise = seg(u, 0.0, 0.32, easeOut), settle = seg(u, 0.32, 0.62);
      sub.position.set(-6 + 2 * t, lerp(-22, 5.5, rise) - 7 * settle, 0);
      sub.rotation.z = 0.36 * rise * (1 - settle);
      tankParts.forEach((tp, i) => setFill(i, 0.05));
      interior.visible = false; otto.visible = false;
      if (u > 0.22) {
        const w = 1 - seg(u, 0.55, 0.95);
        if (w > 0) {
          emit(waterDrops, t, 220, { origin: [30, R + 0.5, 0], vel: [-2, -3, 0], spread: 30, life: 1.0, size: 0.32 * w + 0.05, gravity: 9, seed: 5 });   // water cascading off the hull
          emit(parts, t, 200, { origin: [44, 0.5, 0], local: false, vel: [3, 9, 0], spread: 14, life: 1.3, size: 0.45 * w + 0.05, gravity: 11, seed: 9 });   // spray at the breach
        }
      }
      set(path([[0, P([110, 3.0, 88], [20, 6, 0], 38)], [0.45 * d, P([116, 3.6, 96], [18, 6, 0], 38)], [d, P([170, 22, 170], [6, 3, 0], 38)]], t));
      if (camera.position.y < 0) environment(t);
      aimSun(ctx.studio, [10, 0, 0], 70);
      finish(t);
    },
  };
  return { reset, scenes };
}

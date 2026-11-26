// EPISODE 01 — What actually stops an elevator from falling? (low-poly style, original cast)
// Units: meters. Shaft centered near x=0.5; section plane cuts at z = SECTION (camera on +z side).
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { brush, csg, Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, orbit, applyPose, springGeometry, rand } = kit;
  const { lp, facet, makeCharacter, cloud, tree, blinkAt, aimSun } = lowpoly;
  const set = p => applyPose(camera, p);
  const add = (m, parent = scene) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, pos, parent) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent); m.position.set(...pos); return m; };
  const cyl = (r, h, mat, pos, parent, seg = 16, axis = 'y') => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    if (axis === 'z') g.rotateX(Math.PI / 2); if (axis === 'x') g.rotateZ(Math.PI / 2);
    const m = add(new THREE.Mesh(g, mat), parent); m.position.set(...pos); return m;
  };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });

  // ------------------------------------------------------------------ layout
  const FLOORS = 15, FH = 3.6, ROOF = FLOORS * FH;      // 54 m
  const PIT = -1.6;
  const SX0 = -1.35, SX1 = 2.35, SZ = 1.25;            // shaft inner box
  const SECTION = 0.95;
  const CAR_RAIL_X = 0.98, CW_X = 1.75;
  const DEF = { x: 0.25, y: ROOF + 0.45, r: 0.25 };      // deflector sheave
  const SHV = { x: 1.43, y: ROOF + 1.0, r: 0.32 };       // traction sheave
  const GOV = { x: -1.12, y: ROOF + 0.75, z: 0.35, r: 0.18 };
  const TEN = { x: -1.12, y: PIT + 0.55, z: 0.35 };
  const CAB = { w: 1.6, h: 2.4, d: 1.5 };

  const M = {
    concrete: lp.color(0xc9c4ba), concreteDark: lp.color(0x9d978c), slab: lp.color(0xe8e2d6),
    glass: lp.glass(0x8fd3ff, { opacity: 0.32 }), mullion: lp.color(0x3d4b5c),
    rail: lp.metal(0x8d98a3), steel: lp.metal(0x9fb0bf), dark: lp.metal(0x3c4652), cabin: lp.color(0xd6dde3),
    cabinIn: lp.color(0xf1e6cf), weight: lp.color(0x5f6872), rope: lp.metal(0x6f7a85, { roughness: 0.35 }),
    motor: lp.color(0x2f7fd1), brake: lp.color(0xe5483e), gold: lp.metal(0xe0b44a), yellow: lp.color(0xffc93c),
    governor: lp.color(0xff8a1f), grass: lp.color(0x6cc04a), road: lp.color(0x5b6068), floorTile: lp.color(0x7d8a96),
  };

  // ------------------------------------------------------------------ city
  const gShape = new THREE.Shape(); gShape.absarc(0, 0, 700, 0, Math.PI * 2, false);
  const gHole = new THREE.Path(); gHole.moveTo(-6.5, -6); gHole.lineTo(7.5, -6); gHole.lineTo(7.5, 6); gHole.lineTo(-6.5, 6); gHole.closePath(); gShape.holes.push(gHole);
  const ground = add(new THREE.Mesh(new THREE.ShapeGeometry(gShape, 48), M.grass)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  box(600, 0.04, 14, M.road, [0, 0.0, 22]); box(14, 0.04, 600, M.road, [-26, 0.0, 0]);
  { const pl = add(new THREE.Mesh(csg(brush(new THREE.BoxGeometry(30, 0.3, 26), { pos: [0, 0.15, 0] }), [['-', brush(new THREE.BoxGeometry(14, 1, 12), { pos: [0.5, 0, 0] })]]), lp.color(0xd8d2c4))); void pl; } // plaza
  const cityCols = [0xf2b8a2, 0xa9c7e8, 0xf4e1a1, 0xc5e3b8, 0xd9c2ec, 0xe8e8e8];
  for (let i = 0; i < 26; i++) {
    const ang = rand(i) * Math.PI * 2, r = 45 + rand(i + 5) * 130;
    const h = 10 + rand(i + 9) * 40, w = 10 + rand(i + 2) * 12;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r - 20;
    if (Math.abs(x) < 25 && z > -10) continue;
    const b = box(w, h, w * (0.7 + rand(i + 3) * 0.6), lp.color(cityCols[i % cityCols.length]), [x, h / 2, z]);
    for (let f = 3; f < h - 1; f += 3.4) box(w + 0.05, 0.9, b.geometry.parameters.depth + 0.05, lp.color(0x5d7fa6), [x, f, z]);
  }
  for (let i = 0; i < 30; i++) { const t = tree(i, 3 + rand(i) * 3); const a = rand(i + 40) * Math.PI * 2, r = 18 + rand(i + 50) * 40; t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 8); if (Math.abs(t.position.x) < 9 && Math.abs(t.position.z) < 9) continue; scene.add(t); }
  for (let i = 0; i < 9; i++) { const c = cloud(i + 3, 5 + rand(i) * 4); c.position.set(-150 + i * 40, 90 + rand(i + 1) * 40, -120 - rand(i + 2) * 80); scene.add(c); }

  // ------------------------------------------------------------------ building (dollhouse section)
  const bW = 14, bD = 12, bx = 0.5;
  const slabGeo = csg(brush(new THREE.BoxGeometry(bW, 0.3, bD), { pos: [bx, 0, 0] }), [['-', brush(new THREE.BoxGeometry(SX1 - SX0 + 0.5, 1, SZ * 2 + 0.5), { pos: [(SX0 + SX1) / 2, 0, 0] })]]);
  for (let f = 0; f <= FLOORS; f++) {
    const s = add(new THREE.Mesh(slabGeo, M.slab.clone())); s.position.y = f * FH - 0.15;
    cut.add(s, capMat(0xf3eee4));
  }
  // furniture and plants on floors (instanced), clipped by the section
  const furn = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.75, 0.7), lp.color(0xb07a4f, { clippingPlanes: cut.planes }), 60);
  const plants = new THREE.InstancedMesh(facet(new THREE.IcosahedronGeometry(0.45, 0), 0.05), lp.color(0x3f9e4a, { clippingPlanes: cut.planes }), 45);
  { const m4 = new THREE.Matrix4(); let k = 0, q = 0;
    for (let f = 0; f < FLOORS; f++) for (let j = 0; j < 4; j++) {
      const x = [-5, -3.2, 4.5, 5.8][j], z = [3.2, -3.5, 3.6, -3.2][(j + f) % 4];
      if (k < 60) { m4.makeTranslation(x, f * FH + 0.38, z); furn.setMatrixAt(k++, m4); }
      if (q < 45 && j % 2 === 0) { m4.makeTranslation(x + 1.2, f * FH + 0.5, z * 0.8); plants.setMatrixAt(q++, m4); }
    } }
  add(furn); add(plants);
  // shaft walls (closed shell -> section caps)
  const wallGeo = csg(brush(new THREE.BoxGeometry(SX1 - SX0 + 0.5, ROOF - PIT + 0.3, SZ * 2 + 0.5), { pos: [(SX0 + SX1) / 2, (ROOF + PIT) / 2, 0] }),
    [['-', brush(new THREE.BoxGeometry(SX1 - SX0, ROOF - PIT + 2, SZ * 2), { pos: [(SX0 + SX1) / 2, (ROOF + PIT) / 2, 0] })]]);
  const walls = add(new THREE.Mesh(wallGeo, M.concrete)); cut.add(walls, capMat(0xb5ada0));
  // pit floor
  box(SX1 - SX0, 0.2, SZ * 2, M.concreteDark, [(SX0 + SX1) / 2, PIT - 0.1, 0]);
  // glass facade + mullions (clipped, no caps needed)
  const gm = M.glass; gm.clippingPlanes = cut.planes;
  box(bW, ROOF, 0.1, gm, [bx, ROOF / 2, bD / 2]); box(bW, ROOF, 0.1, gm, [bx, ROOF / 2, -bD / 2]);
  box(0.1, ROOF, bD, gm, [bx - bW / 2, ROOF / 2, 0]); box(0.1, ROOF, bD, gm, [bx + bW / 2, ROOF / 2, 0]);
  M.mullion.clippingPlanes = cut.planes;
  const mul = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, ROOF, 0.16), M.mullion, 40);
  { const m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i <= 8; i++) { const x = bx - bW / 2 + i * bW / 8; m4.makeTranslation(x, ROOF / 2, bD / 2); mul.setMatrixAt(k++, m4); m4.makeTranslation(x, ROOF / 2, -bD / 2); mul.setMatrixAt(k++, m4); }
    for (let i = 1; i < 7; i++) { const z = -bD / 2 + i * bD / 7; m4.makeTranslation(bx - bW / 2, ROOF / 2, z); mul.setMatrixAt(k++, m4); m4.makeTranslation(bx + bW / 2, ROOF / 2, z); mul.setMatrixAt(k++, m4); }
    mul.count = k; }
  add(mul);
  // roof + machine room
  box(bW + 0.4, 0.4, bD + 0.4, lp.color(0x56616e), [bx, ROOF + 0.05, 0]);
  const mrGeo = csg(brush(new THREE.BoxGeometry(6, 3.4, 5), { pos: [0.5, ROOF + 1.9, -0.3] }), [
    ['-', brush(new THREE.BoxGeometry(5.6, 3.0, 4.6), { pos: [0.5, ROOF + 1.9, -0.3] })],
    ['-', brush(new THREE.BoxGeometry(1.0, 2.0, 0.6), { pos: [-1.6, ROOF + 1.2, 2.2] })]]);
  const mroom = add(new THREE.Mesh(mrGeo, lp.color(0xe0d8c8))); cut.add(mroom, capMat(0xcfc6b4));

  // ------------------------------------------------------------------ guide rails (T profile)
  function tRail(height, blade = 'x', dir = 1) {
    const s = new THREE.Shape();
    if (blade === 'x') { // flange in z, blade pointing along x*dir
      const f = [[0, -0.065], [0.02, -0.065], [0.02, -0.008], [0.1, -0.008], [0.1, 0.008], [0.02, 0.008], [0.02, 0.065], [0, 0.065]];
      f.forEach(([a, b], i) => (i ? s.lineTo(a * dir, b) : s.moveTo(a * dir, b)));
    } else {
      const f = [[-0.065, 0], [-0.065, 0.02], [-0.008, 0.02], [-0.008, 0.1], [0.008, 0.1], [0.008, 0.02], [0.065, 0.02], [0.065, 0]];
      f.forEach(([a, b], i) => (i ? s.lineTo(a, -b * dir) : s.moveTo(a, -b * dir)));
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const railH = ROOF - PIT + 0.4;
  const railL = add(new THREE.Mesh(tRail(railH, 'x', 1), M.rail)); railL.position.set(-CAR_RAIL_X - 0.1, PIT, 0);
  const railR = add(new THREE.Mesh(tRail(railH, 'x', -1), M.rail)); railR.position.set(CAR_RAIL_X + 0.1, PIT, 0);
  [-1, 1].forEach(s => { const r = add(new THREE.Mesh(tRail(railH, 'z', s), M.rail)); r.position.set(CW_X, PIT, -s * 0.62 + s * 0.0); });

  // ------------------------------------------------------------------ car (cabin + sling + safety gear)
  const car = new THREE.Group(); scene.add(car);
  const cabGeo = csg(brush(new THREE.BoxGeometry(CAB.w, CAB.h, CAB.d), { pos: [0, CAB.h / 2, 0] }), [
    ['-', brush(new THREE.BoxGeometry(CAB.w - 0.08, CAB.h - 0.08, CAB.d - 0.08), { pos: [0, CAB.h / 2, 0] })],
    ['-', brush(new THREE.BoxGeometry(CAB.w - 0.2, CAB.h - 0.25, 0.3), { pos: [0, CAB.h / 2, CAB.d / 2] })]]);
  add(new THREE.Mesh(cabGeo, M.cabin), car);
  box(CAB.w - 0.1, 0.04, CAB.d - 0.1, lp.color(0x8a6a4a), [0, 0.06, 0], car);                     // floor
  box(CAB.w - 0.3, 0.03, CAB.d - 0.4, lp.emissive(0xfff3d1, 1.2), [0, CAB.h - 0.06, 0], car);    // light panel
  box(CAB.w - 0.2, 0.05, 0.05, M.steel, [0, 0.95, -CAB.d / 2 + 0.08], car);                      // handrail
  const doorGlass = box(CAB.w - 0.2, CAB.h - 0.25, 0.03, lp.glass(0xbfe8ff, { opacity: 0.18 }), [0, CAB.h / 2, CAB.d / 2 - 0.02], car);
  void doorGlass;
  [-1, 1].forEach(s => box(0.08, 3.05, 0.12, M.dark, [s * 0.86, CAB.h / 2 + 0.05, 0], car));     // stiles
  box(1.95, 0.18, 0.16, M.dark, [0, CAB.h + 0.35, 0], car);                                      // crosshead
  box(1.76, 0.2, 0.18, M.dark, [0, -0.2, 0], car);                                               // safety plank
  box(0.2, 0.08, 0.2, M.steel, [0, CAB.h + 0.48, 0], car);                                       // rope hitch
  // governor rope lever on the crosshead (left) + lift rod
  const lever = new THREE.Group(); lever.position.set(-0.86, CAB.h + 0.35, GOV.z); car.add(lever);
  box(0.36, 0.06, 0.06, M.yellow, [-0.1, 0, 0], lever);
  box(0.05, 0.1, 0.05, M.yellow, [-0.26, 0, 0], lever);
  const liftRod = box(0.025, CAB.h + 0.5, 0.025, M.yellow, [-0.93, CAB.h / 2 + 0.05, -0.16], car);
  void liftRod;
  // safety gear (housing + 2 wedges) at each rail, at the bottom of the car frame
  const gears = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * (CAR_RAIL_X + 0.04), -0.2, 0); car.add(g);
    const housing = box(0.22, 0.36, 0.26, lp.metal(0x30363e, { transparent: true, opacity: 1, depthWrite: true }), [0, 0, 0], g);
    const wedges = [-1, 1].map(w => {
      const sh = new THREE.Shape(); sh.moveTo(0, -0.12); sh.lineTo(0.035, -0.12); sh.lineTo(0.065, 0.12); sh.lineTo(0, 0.12); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); geo.translate(0, 0, -0.05); geo.rotateY(-Math.PI / 2);
      const m = add(new THREE.Mesh(geo, lp.metal(0xffc23a, { roughness: 0.3 })), g);
      m.scale.z = w;
      return { m, w };
    });
    return { g, housing, wedges, s };
  });
  // guide shoes
  [-1, 1].forEach(s => [0.05, CAB.h + 0.3].forEach(y => box(0.12, 0.16, 0.14, M.steel, [s * (CAR_RAIL_X - 0.02), y, 0], car)));
  // passenger
  const nova = makeCharacter('nova'); nova.position.set(0.1, 0.08, 0.05); nova.rotation.y = -0.2; car.add(nova);

  // ------------------------------------------------------------------ counterweight
  const cw = new THREE.Group(); scene.add(cw); cw.position.x = CW_X;
  [-1, 1].forEach(s => box(0.08, 2.9, 0.08, M.dark, [0, 1.45, s * 0.5], cw));
  box(0.5, 0.14, 1.12, M.dark, [0, 2.9, 0], cw); box(0.5, 0.14, 1.12, M.dark, [0, 0, 0], cw);
  for (let i = 0; i < 12; i++) box(0.42, 0.2, 0.94, i % 2 ? M.weight : lp.color(0x6b7580), [0, 0.18 + i * 0.215, 0], cw);
  box(0.16, 0.1, 0.16, M.steel, [0, 3.0, 0], cw);

  // ------------------------------------------------------------------ machine room equipment
  box(2.6, 0.35, 1.6, M.dark, [0.85, ROOF + 0.42, -0.35]);                                       // bedplate
  const sheave = cyl(SHV.r, 0.26, M.steel, [SHV.x, SHV.y, 0], scene, 24, 'z');
  for (let i = 0; i < 6; i++) { const sp = box(0.05, SHV.r * 1.7, 0.05, M.dark, [0, 0, 0.14], sheave); sp.rotation.z = (i * Math.PI) / 6; }
  const deflector = cyl(DEF.r, 0.22, M.steel, [DEF.x, DEF.y, 0], scene, 20, 'z');
  for (let i = 0; i < 4; i++) { const sp = box(0.04, DEF.r * 1.6, 0.04, M.dark, [0, 0, 0.12], deflector); sp.rotation.z = (i * Math.PI) / 4; }
  cyl(0.06, 1.6, M.dark, [SHV.x, SHV.y, -0.65], scene, 12, 'z');                                 // shaft
  const drum = cyl(0.28, 0.16, lp.metal(0xc8ced4), [SHV.x, SHV.y, -0.42], scene, 24, 'z');
  const motor = cyl(0.4, 0.8, M.motor, [SHV.x, SHV.y, -1.0], scene, 16, 'z');
  for (let i = 0; i < 8; i++) { const f = box(0.04, 0.84, 0.82, lp.color(0x2569b0), [0, 0, 0], motor); f.rotation.z = i * Math.PI / 8; f.position.set(0, 0, 0); }
  box(0.5, 0.5, 0.3, lp.color(0x1f5ea3), [SHV.x, SHV.y - 0.25, -1.45]);
  // brake arms (move toward drum when applied)
  const brakeArms = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(SHV.x + s * 0.34, SHV.y - 0.05, -0.42); scene.add(g);
    box(0.08, 0.9, 0.1, M.brake, [0, 0, 0], g);
    box(0.06, 0.34, 0.14, lp.color(0x3b2a20), [-s * 0.05, 0.0, 0], g);   // shoe
    return { g, s };
  });
  box(0.9, 0.06, 0.08, M.brake, [SHV.x, SHV.y + 0.45, -0.42]);
  const brakeSpring = add(new THREE.Mesh(springGeometry(0.05, 0.012, 6), M.steel)); brakeSpring.rotation.z = Math.PI / 2; brakeSpring.position.set(SHV.x + 0.42, SHV.y + 0.45, -0.42); brakeSpring.scale.y = 0.3;
  // overspeed governor
  const govG = new THREE.Group(); govG.position.set(GOV.x, GOV.y, GOV.z); scene.add(govG);
  box(0.5, 0.6, 0.12, M.governor, [0, -0.45, -0.12], govG);                    // stand
  box(0.5, 0.06, 0.3, M.governor, [0, -0.75, 0], govG);
  const govSheave = cyl(GOV.r, 0.08, M.steel, [0, 0, 0], govG, 20, 'z');
  const flyW = new THREE.Group(); flyW.position.z = 0.07; govSheave.add(flyW);
  const weights = [-1, 1].map(s => {
    const arm = new THREE.Group(); arm.position.set(s * 0.04, 0, 0); flyW.add(arm);
    box(0.03, 0.16, 0.025, M.dark, [0, s * 0.08, 0], arm);
    const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.yellow), arm); ball.position.set(0, s * 0.16, 0);
    return { arm, s };
  });
  const jaw = box(0.1, 0.08, 0.12, M.brake, [GOV.r + 0.02, 0.18, 0], govG);
  // tension pulley in the pit
  const tenG = new THREE.Group(); tenG.position.set(TEN.x, TEN.y, TEN.z); scene.add(tenG);
  const tenSheave = cyl(GOV.r, 0.08, M.steel, [0, 0, 0], tenG, 20, 'z');
  box(0.3, 0.25, 0.2, M.weight, [0, -0.3, 0], tenG);
  // buffers in the pit
  const bufs = [];
  [[-0.45, 0], [0.45, 0], [CW_X, 0]].forEach(([x]) => {
    const g = new THREE.Group(); g.position.set(x, PIT, 0); scene.add(g);
    box(0.36, 0.1, 0.36, M.dark, [0, 0.05, 0], g);
    const sp = add(new THREE.Mesh(springGeometry(0.13, 0.025, 6), lp.metal(0xffc93c)), g); sp.position.y = 0.1; sp.scale.y = 0.7;
    box(0.3, 0.06, 0.3, M.dark, [0, 0.83, 0], g);
    bufs.push(g);
  });

  // ------------------------------------------------------------------ ropes
  const ROPE_Z = [-0.09, -0.03, 0.03, 0.09], ROPE_R = 0.016;
  function tangentTop(c1, c2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), a = Math.acos((c1.r - c2.r) / d);
    return { a1: phi + a, p1: [c1.x + c1.r * Math.cos(phi + a), c1.y + c1.r * Math.sin(phi + a)], p2: [c2.x + c2.r * Math.cos(phi + a), c2.y + c2.r * Math.sin(phi + a)] };
  }
  const tg = tangentTop(DEF, SHV);
  const upperPts = [];
  for (let a = Math.PI; a >= tg.a1; a -= 0.08) upperPts.push([DEF.x + DEF.r * Math.cos(a), DEF.y + DEF.r * Math.sin(a)]);
  upperPts.push(tg.p1, tg.p2);
  for (let a = tg.a1; a >= 0; a -= 0.08) upperPts.push([SHV.x + SHV.r * Math.cos(a), SHV.y + SHV.r * Math.sin(a)]);
  upperPts.push([SHV.x + SHV.r, SHV.y]);
  const ropeUp = [], ropeCar = [], ropeCw = [];
  ROPE_Z.forEach(z => {
    const curve = new THREE.CatmullRomCurve3(upperPts.map(([x, y]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.0);
    ropeUp.push(add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, ROPE_R, 6), M.rope)));
    ropeCar.push(cyl(ROPE_R, 1, M.rope, [0, 0, z], scene, 6));
    ropeCw.push(cyl(ROPE_R, 1, M.rope, [CW_X, 0, z], scene, 6));
  });
  // governor rope loop (static lines) + moving markers
  const govRopeTop = GOV.y, govRopeBot = TEN.y;
  [GOV.x + GOV.r, GOV.x - GOV.r].forEach(x => cyl(0.009, govRopeTop - govRopeBot, M.rope, [x, (govRopeTop + govRopeBot) / 2, GOV.z], scene, 6));
  const markers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), lp.emissive(0x37d2ff, 1.4), 60);
  scene.add(markers);
  function placeMarkers(phase) {
    const m4 = new THREE.Matrix4(); const L = govRopeTop - govRopeBot;
    for (let i = 0; i < 60; i++) {
      const u = ((i / 60) * 2 * L + phase) % (2 * L);
      const up = u > L; const y = up ? govRopeBot + (u - L) : govRopeTop - u;
      m4.makeTranslation(up ? GOV.x - GOV.r : GOV.x + GOV.r, y, GOV.z + 0.01); markers.setMatrixAt(i, m4);
    }
    markers.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ engineer in the machine room
  const otto = makeCharacter('otto'); scene.add(otto);

  // ------------------------------------------------------------------ macro steel rope model (isolated macro set)
  const MAC = [0, -400, 0];
  const macro = new THREE.Group(); macro.position.set(...MAC); scene.add(macro);
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'varying vec3 vP; void main(){ float h=smoothstep(-0.6,0.8,vP.y); gl_FragColor=vec4(mix(vec3(0.10,0.16,0.24),vec3(0.42,0.62,0.82),h),1.0);} ' }));
  macro.add(backdrop);
  const macroRope = new THREE.Group(); macro.add(macroRope);
  const RS = { R: 0.6, rs: 0.19, rw: 0.062, strands: 8, len: 6 };
  const wireMat = lp.metal(0xb7c2cc, { roughness: 0.3, flatShading: false });
  const strandFns = [];
  class WireCurve extends THREE.Curve {
    constructor(si, wi, spread) { super(); this.si = si; this.wi = wi; this.spread = spread; }
    getPoint(u, out = new THREE.Vector3()) {
      const y = -RS.len / 2 + u * RS.len;
      const open = this.spread * Math.max(0, (-y - 0.6) / 2.4);      // strands splay apart at the bottom end
      const ang = (this.si / RS.strands) * Math.PI * 2 + y * 0.9;
      const R = RS.R + open * 0.9;
      const cx = Math.cos(ang) * R, cz = Math.sin(ang) * R;
      if (this.wi === 0) return out.set(cx, y, cz);
      const wa = (this.wi / 6) * Math.PI * 2 + y * 2.6;
      const rr = RS.rs - RS.rw + open * 0.12;
      return out.set(cx + Math.cos(ang) * Math.cos(wa) * rr - Math.sin(ang) * Math.sin(wa) * rr, y + 0.0, cz + Math.sin(ang) * Math.cos(wa) * rr + Math.cos(ang) * Math.sin(wa) * rr);
    }
  }
  function buildMacro(spread) {
    while (macroRope.children.length) { const c = macroRope.children.pop(); c.geometry.dispose(); }
    for (let si = 0; si < RS.strands; si++) for (let wi = 0; wi < 7; wi++) {
      const m = new THREE.Mesh(new THREE.TubeGeometry(new WireCurve(si, wi, spread), 90, RS.rw, 6), wi === 0 ? lp.metal(0x9aa7b3) : wireMat);
      macroRope.add(m);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(RS.R - RS.rs + 0.02, RS.R - RS.rs + 0.02, RS.len, 16), lp.color(0x8a6a3a));
    macroRope.add(core);
  }
  const macroCache = new Map();
  function macroAt(spread) {
    const k = Math.round(spread * 20) / 20;
    if (!macroCache.has(k)) {
      buildMacro(k);
      macroCache.set(k, macroRope.children.map(c => c.geometry));
      macroRope.children.length = 0;
    }
    const geos = macroCache.get(k);
    while (macroRope.children.length < geos.length) macroRope.add(new THREE.Mesh(geos[0], wireMat));
    geos.forEach((g, i) => { const m = macroRope.children[i]; m.geometry = g; m.material = i === geos.length - 1 ? lp.color(0x8a6a3a) : (i % 7 === 0 ? lp.metal(0x9aa7b3) : wireMat); });
  }
  const loadArrow = kit.parts.arrow(0xff5a36, 0.09); macro.add(loadArrow); loadArrow.rotation.z = Math.PI; loadArrow.position.set(1.8, 2.2, 0);

  // ------------------------------------------------------------------ safety gear detail set (enlarged section)
  const GM = [0, -800, 0];
  const gearMacro = new THREE.Group(); gearMacro.position.set(...GM); scene.add(gearMacro);
  gearMacro.add(backdrop.clone());
  const TAPER = 0.1875;
  // guide rail: blade (thin in z) + flange behind, with moving marks to show sliding
  const railBlade = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.16), lp.metal(0xaab6c1)), gearMacro);
  const railFl = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 7, 1.3), lp.metal(0x8d98a3)), gearMacro); railFl.position.x = -0.31;
  const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.05, 0.17), lp.color(0x5d6873), 10); gearMacro.add(marks);
  // tapered housing (back half only = section view), two mirrored side blocks
  const hMat = lp.metal(0x66727f);
  [-1, 1].forEach(sd => {
    const sh = new THREE.Shape();
    sh.moveTo(0.4 + TAPER * 1.0, -1.0); sh.lineTo(0.8, -1.0); sh.lineTo(0.8, 1.0); sh.lineTo(0.4 - TAPER * 1.0, 1.0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(-Math.PI / 2);
    const m = add(new THREE.Mesh(g, hMat), gearMacro); m.scale.z = sd; m.position.x = -0.05;
  });
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.7), hMat), gearMacro).position.set(-0.3, 1.09, 0);
  const gw = [-1, 1].map(sd => {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.4); sh.lineTo(0, 0.4); sh.lineTo(0.12, 0.4); sh.lineTo(0.12 + 0.8 * TAPER, -0.4); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.44, bevelEnabled: false }); g.translate(0, 0, -0.22); g.rotateY(-Math.PI / 2);
    const m = add(new THREE.Mesh(g, lp.metal(0xffc23a, { roughness: 0.3 })), gearMacro); m.scale.z = sd;
    const rod = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), M.yellow), m); rod.position.set(0, 1.2, 0.06);
    return { m, sd };
  });
  const sparks = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.02), lp.emissive(0xffa83a, 2.5), 40); gearMacro.add(sparks);
  function solveGear(t, engage, railSpeed) {
    const yc = lerp(-0.6, 0.667, engage);
    const zin = 0.205 - TAPER * yc;
    gw.forEach(({ m, sd }) => m.position.set(0.0, yc, sd * Math.max(0.08, zin)));
    const m4 = new THREE.Matrix4();
    const off = (st.railTravel || 0) % 0.8;
    for (let i = 0; i < 10; i++) { m4.makeTranslation(0.0, -3.4 + i * 0.8 + off, 0); marks.setMatrixAt(i, m4); }
    marks.instanceMatrix.needsUpdate = true;
    const contact = zin <= 0.085 && railSpeed > 0.05;
    for (let i = 0; i < 40; i++) {
      const life = ((t * 3 + rand(i)) % 1);
      const sd = i % 2 ? 1 : -1;
      if (contact) m4.makeTranslation(0.26 + life * 0.5 * rand(i + 3), yc - 0.3 - life * 0.9, sd * (0.09 + life * 0.25 * rand(i + 7)));
      else m4.makeScale(0, 0, 0);
      sparks.setMatrixAt(i, m4);
    }
    sparks.instanceMatrix.needsUpdate = true;
  }
  const LG = { rail: new Label(ctx, 'GUIDE RAIL', { accent: '#9fb0bf' }), wedge: new Label(ctx, 'WEDGES', { accent: '#ffc24a' }) };

  // ------------------------------------------------------------------ labels & hud
  const L = {
    motor: new Label(ctx, 'ELECTRIC MOTOR', { accent: '#2f7fd1' }), sheave: new Label(ctx, 'TRACTION SHEAVE', { accent: '#ffc24a' }),
    cw: new Label(ctx, 'COUNTERWEIGHT', { accent: '#9fb0bf' }), cab: new Label(ctx, 'CABIN', { accent: '#7fe0c4' }),
    rails: new Label(ctx, 'GUIDE RAILS', { accent: '#9fb0bf' }), gov: new Label(ctx, 'OVERSPEED\nGOVERNOR', { accent: '#ff8a1f' }),
    safety: new Label(ctx, 'SAFETY GEAR', { accent: '#ffc24a' }), brake: new Label(ctx, 'MOTOR BRAKE', { accent: '#e5483e' }),
    machine: new Label(ctx, 'TRACTION MACHINE', { accent: '#2f7fd1' }), buffers: new Label(ctx, 'BUFFERS', { accent: '#ffc93c' }),
    over: new Label(ctx, 'OVERSPEED!', { accent: '#ff4d4d', size: 0.04 }), rope: new Label(ctx, 'STEEL WIRE ROPE', { accent: '#9fb0bf' }),
    strand: new Label(ctx, 'STRANDS OF\nSTEEL WIRES', { accent: '#9fb0bf' }),
  };

  // ------------------------------------------------------------------ state + kinematics
  const st = {};
  const glow = (obj, color, k) => obj.traverse(o => { if (o.isMesh && o.material && 'emissive' in o.material) { if (!o.userData.mat0) { o.userData.mat0 = o.material; o.material = o.material.clone(); } o.material.emissive.set(color).multiplyScalar(k); } });
  const unglowAll = [];
  function reset() {
    Object.assign(st, { yCar: 20, brakeOn: 0, flyOut: 0, jaw: 0, wedge: 0, ropeStopAt: null, govPhase: 0 });
    cut.offset = SECTION;
    macro.visible = false; gearMacro.visible = false; LG.rail.set(0); LG.wedge.set(0);
    gears.forEach(g => { g.housing.material.opacity = 1; g.housing.material.depthWrite = true; });
    for (const l of Object.values(L)) l.set(0);
    for (const o of unglowAll) glow(o, 0x000000, 0);
    nova.pose({}); otto.pose({}); otto.visible = true;
    otto.position.set(-0.2, ROOF + 0.25, 0.75); otto.rotation.y = 0.5;
    ctx.grade.uniforms.fade.value = 0;
  }
  [sheave, motor, drum, govG, ...gears.map(g => g.g), ...bufs, cw, ...brakeArms.map(b => b.g)].forEach(o => unglowAll.push(o));

  function solve(t) {
    const y = st.yCar;
    car.position.y = y;
    const yCw = 50 - y + 0.0;
    cw.position.y = yCw;
    const carTop = y + CAB.h + 0.52, cwTop = yCw + 3.05;
    ropeCar.forEach(r => { const l = DEF.y - carTop; r.scale.y = l; r.position.y = carTop + l / 2; });
    ropeCw.forEach(r => { const l = SHV.y - cwTop; r.scale.y = l; r.position.y = cwTop + l / 2; });
    sheave.rotation.z = -y / SHV.r; deflector.rotation.z = -y / DEF.r;
    const ropeTravel = st.ropeStopAt !== null ? st.ropeStopAt : y;
    govSheave.rotation.z = ropeTravel / GOV.r; tenSheave.rotation.z = ropeTravel / GOV.r;
    placeMarkers(-ropeTravel);
    drum.rotation.z = -y / SHV.r; motor.rotation.z = -y / SHV.r;
    weights.forEach(w => (w.arm.rotation.z = w.s * 0.9 * st.flyOut));
    jaw.position.y = 0.18 - 0.1 * st.jaw;
    lever.rotation.z = -0.5 * st.wedge;
    // wedges ride up the tapered housing and close onto the rail blade (blade half-thickness 0.008)
    gears.forEach(g => g.wedges.forEach(({ m, w }) => { m.position.set(0, -0.05 + 0.08 * st.wedge, w * (0.01 + 0.04 * (1 - st.wedge))); }));
    brakeArms.forEach(b => (b.g.position.x = SHV.x + b.s * (0.36 - 0.035 * st.brakeOn)));
    nova.pose({ blink: blinkAt(t, 2), ...st.novaPose });
    otto.pose({ blink: blinkAt(t, 5), ...st.ottoPose });
  }
  const P = (pos, look, fov = 32) => ({ pos, look, fov });

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      st.yCar = 34 - 1.9 * t; st.novaPose = { head: [-0.45, 0.2, 0], mouth: 'o', brows: -0.3 };
      cut.offset = lerp(7.5, SECTION, seg(t, 0.2 * d, 0.48 * d));
      solve(t);
      aimSun(ctx.studio, [0.5, st.yCar, 0], 30);
      set(path([[0, P([62, 75, 120], [0.5, 30, 0], 34)], [0.45 * d, P([8, 34, 26], [0.5, 31, 0], 34)],
                [0.66 * d, P([1.8, st.yCar + 3.2, 6.5], [0.3, st.yCar + 1.2, 0], 36)], [d, P([1.4, st.yCar + 2.6, 4.8], [0.2, st.yCar + 1.0, 0], 36)]], t,
               u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2));
    },
    S02(t, d) {
      st.yCar = 25 - 0.15 * t; st.novaPose = { head: [-0.2, 0, 0], mouth: 'smile' };
      solve(t);
      aimSun(ctx.studio, [0.5, st.yCar, 0], 20);
      const macroOn = t > 0.4 * d;
      if (!macroOn) {
        set(path([[0, P([1.6, st.yCar + 1.6, 5.4], [0.2, st.yCar + 1.6, 0])], [0.4 * d, P([0.15, st.yCar + 4.6, 0.55], [0.0, st.yCar + 5.0, 0], 34)]], t));
        L.rope.set(seg(t, 0.12 * d, 0.2 * d) * (1 - seg(t, 0.34 * d, 0.4 * d)), [0, st.yCar + 4.2, 0.1], [-0.75, 0.5]);
        L.cab.set(seg(t, 0.05 * d, 0.13 * d) * (1 - seg(t, 0.25 * d, 0.32 * d)), [0.4, st.yCar + 1.5, 0.75], [-0.1, -0.35]);
      } else {
        macro.visible = true;
        const u = (t - 0.4 * d) / (0.6 * d);
        macroAt(seg(u, 0.35, 0.85));
        macroRope.rotation.y = 0.25 * t;
        loadArrow.setLength(1.6 + 0.3 * Math.sin(t * 2));
        const c = MAC;
        set(path([[0, P([c[0] + 0.4, c[1] + 2.6, c[2] + 4.2], [c[0], c[1] + 1.8, c[2]], 34)], [0.55, P([c[0] + 2.2, c[1] + 0.2, c[2] + 6.2], [c[0], c[1] - 0.6, c[2]], 34)],
                  [1, P([c[0] + 2.6, c[1] - 4.6, c[2] + 5.2], [c[0], c[1] - 2.6, c[2]], 34)]], u));
        L.strand.set(seg(u, 0.25, 0.4), [c[0] + 0.7, c[1] - 1.8, c[2] + 0.6], [-0.85, 0.55]);
      }
    },
    S03(t, d) {
      const u = t / d;
      // up, pause, down (car and counterweight move opposite: 1:1 roping)
      st.yCar = 23 + 4 * seg(u, 0.38, 0.62) - 4 * seg(u, 0.72, 0.97);
      st.ottoPose = u < 0.36 ? { point: seg(u, 0.05, 0.14), mouth: 'grin', head: [0, -0.3, 0] } : { thumbs: 1, mouth: 'smile' };
      otto.rotation.y = 0.9;
      solve(t);
      if (u < 0.36) {
        aimSun(ctx.studio, [0.8, ROOF, 0], 8);
        set(path([[0, orbit([0.5, ROOF + 1.1, 0.0], 8.4, -18, 12, 34)], [0.36 * d, orbit([0.6, ROOF + 1.0, 0.0], 7.4, 16, 9, 34)]], t));
        L.motor.set(seg(u, 0.08, 0.13), [SHV.x, SHV.y + 0.2, -1.0], [0.05, 0.55]);
        L.sheave.set(seg(u, 0.16, 0.21), [SHV.x + 0.2, SHV.y + 0.2, 0.1], [-0.85, 0.42]);
      } else {
        aimSun(ctx.studio, [0.5, 25, 0], 16);
        set(path([[0.36 * d, P([0.5, 26.5, 15.5], [0.5, 25.5, 0], 34)], [d, P([0.9, 25.6, 13.8], [0.5, 25.4, 0], 34)]], t));
        L.cab.set(seg(u, 0.42, 0.47), [0.3, st.yCar + 1.5, 0.75], [-0.85, -0.42]);
        L.cw.set(seg(u, 0.48, 0.53), [CW_X, 50 - st.yCar + 1.5, 0.5], [0.05, 0.62]);
        L.rails.set(seg(u, 0.56, 0.61), [-CAR_RAIL_X - 0.1, 28.5, 0.05], [-0.85, 0.3]);
      }
    },
    S04(t, d) {
      st.yCar = 30 - 1.0 * t; st.flyOut = 0.12 + 0.05 * Math.sin(t * 3);
      st.ottoPose = { head: [0.25, -0.5, 0], mouth: 'flat', brows: -0.5 };
      otto.position.set(-0.4, ROOF + 0.25, 1.2); otto.rotation.y = -0.9;
      solve(t);
      aimSun(ctx.studio, [GOV.x, GOV.y, 0], 6);
      if (t < 0.28 * d) set(path([[0, P([1.4, st.yCar + 1.6, 5.2], [0.3, st.yCar + 1.4, 0])], [0.28 * d, P([1.0, st.yCar + 1.7, 4.4], [0.3, st.yCar + 1.4, 0])]], t));
      else set(path([[0.28 * d, P([GOV.x + 1.6, GOV.y + 0.6, GOV.z + 2.6], [GOV.x, GOV.y - 0.1, GOV.z])], [d, P([GOV.x + 0.55, GOV.y + 0.15, GOV.z + 0.95], [GOV.x, GOV.y, GOV.z])]], t));
      L.gov.set(seg(t, 0.4 * d, 0.5 * d), [GOV.x, GOV.y + 0.15, GOV.z + 0.08], [-0.85, 0.5]);
    },
    S05(t, d) {
      // kinematics: overspeed (brake fault) -> governor trip -> rope held -> wedges grip rails -> progressive stop
      const tTrip = 0.28 * d, tGrip = 0.46 * d, tStop = 0.76 * d;
      const v0 = 1.6, a = 2.2, vTrip = v0 + a * tTrip;
      const dec = vTrip / (tStop - tGrip);
      const vt = tt => tt < tGrip ? v0 + a * Math.min(tt, tGrip) : Math.max(0, vTrip + a * (tGrip - tTrip) - dec * (tt - tGrip));
      let yd = 0; const n = 60; for (let i = 0; i < n; i++) yd += vt((i + 0.5) * t / n) * t / n;
      st.yCar = 32 - yd;
      st.flyOut = clamp(0.15 + 0.85 * seg(t, 0.12 * d, tTrip));
      st.jaw = seg(t, tTrip, tTrip + 0.2);
      // governor rope stops at trip; the car keeps moving -> lever pulls the safety linkage
      st.ropeStopAt = t > tTrip ? 32 - (v0 * tTrip + 0.5 * a * tTrip * tTrip) : null;
      st.wedge = seg(t, tTrip + 0.15, tGrip + 0.25);
      const scared = t > 0.08 * d && t < tStop + 0.3;
      st.novaPose = scared ? { mouth: 'o', brows: -0.9, head: [-0.2, 0, 0], armL: [-0.6, 0, -0.6], armR: [-0.6, 0, 0.6] } : { mouth: 'grin', brows: 0.7, thumbs: seg(t, tStop + 0.4, tStop + 0.9) };
      solve(t);
      ctx.studio.sun.intensity = 2.6;
      if (t < tTrip) {
        aimSun(ctx.studio, [0.5, st.yCar, 0], 14);
        set(P([1.8, st.yCar + 1.2 + 0.15 * Math.sin(t * 40), 7.5], [0.3, st.yCar + 1.6, 0], 36));
        L.over.set(seg(t, 0.12 * d, 0.18 * d), null, [-0.38, 0.55]);
      } else if (t < tGrip) {
        aimSun(ctx.studio, [GOV.x, GOV.y, 0], 5);
        set(path([[tTrip, P([GOV.x + 0.75, GOV.y + 0.25, GOV.z + 1.15], [GOV.x, GOV.y, GOV.z])], [tGrip, P([GOV.x + 0.5, GOV.y + 0.05, GOV.z + 0.85], [GOV.x + 0.1, GOV.y, GOV.z])]], t));
      } else if (t < tStop + 0.25) {
        gearMacro.visible = true;
        const vrel = vt(t); st.railTravel = yd;
        solveGear(t, seg(t, tGrip - 0.1, tGrip + 0.35), vrel);
        const c = GM;
        set(path([[tGrip, P([c[0] + 6.4, c[1] + 1.2, c[2] + 2.2], [c[0], c[1] + 0.25, c[2]], 32)], [tStop + 0.25, P([c[0] + 5.4, c[1] + 0.9, c[2] + 1.4], [c[0], c[1] + 0.3, c[2]], 32)]], t));
        L.safety.set(seg(t, tGrip + 0.2, tGrip + 0.5), [c[0] - 0.3, c[1] + 1.1, c[2] + 0.4], [-0.85, 0.62]);
        LG.wedge.set(seg(t, tGrip + 0.5, tGrip + 0.8), [c[0] + 0.2, c[1] + 0.5, c[2] + 0.2], [0.15, 0.45]);
        LG.rail.set(seg(t, tGrip + 0.8, tGrip + 1.1), [c[0] + 0.25, c[1] - 1.9, c[2]], [0.1, -0.45]);
      } else {
        gears[0].housing.material.opacity = 1; gears[0].housing.material.depthWrite = true;
        aimSun(ctx.studio, [0.5, st.yCar, 0], 14);
        set(path([[tStop + 0.25, P([1.2, st.yCar + 1.4, 4.6], [0.2, st.yCar + 1.2, 0])], [d, P([1.6, st.yCar + 1.6, 5.6], [0.2, st.yCar + 1.2, 0])]], t));
      }
    },
    S06(t, d) {
      st.yCar = 24; st.brakeOn = seg(t, 0.0, 0.12 * d);
      st.ottoPose = { thumbs: 1, mouth: 'grin' }; otto.rotation.y = 0.9;
      solve(t);
      const beats = [0, 0.2, 0.4, 0.6, 0.8, 1].map(x => x * d);
      const which = beats.findIndex((b, i) => t >= b && t < beats[i + 1]);
      const k = i => seg(t, beats[i], beats[i] + 0.12) * (1 - seg(t, beats[i + 1] - 0.1, beats[i + 1]));
      glow(brakeArms[0].g, 0xff5a36, 0.6 * k(0)); glow(brakeArms[1].g, 0xff5a36, 0.6 * k(0));
      glow(motor, 0x3fa0ff, 0.5 * k(1)); glow(sheave, 0xffc24a, 0.5 * k(1));
      glow(govG, 0xff8a1f, 0.5 * k(2));
      glow(gears[0].g, 0xffd23f, 0.4 * k(3)); glow(gears[1].g, 0xffd23f, 0.4 * k(3));
      if (which === 3) { gearMacro.visible = true; st.railTravel = 0; solveGear(t, seg(t, beats[3] + 0.05, beats[3] + 0.5), 0); }
      bufs.forEach(b => glow(b, 0xffd23f, 0.6 * k(4)));
      L.brake.set(k(0), [SHV.x + 0.36, SHV.y, -0.42], [-0.85, 0.5]);
      L.machine.set(k(1), [SHV.x, SHV.y, -1.0], [-0.85, 0.5]);
      L.gov.set(k(2), [GOV.x, GOV.y, GOV.z], [-0.85, 0.5]);
      L.safety.set(k(3), [GM[0] - 0.3, GM[1] + 1.1, GM[2] + 0.4], [-0.85, 0.5]);
      L.buffers.set(k(4), [-0.45, PIT + 0.6, 0.2], [-0.85, 0.5]);
      const shots = [
        P([SHV.x + 1.6, SHV.y + 0.5, 1.4], [SHV.x, SHV.y, -0.4]), P([SHV.x + 1.9, SHV.y + 0.8, 2.6], [SHV.x, SHV.y, -0.6]),
        P([GOV.x + 0.9, GOV.y + 0.4, GOV.z + 1.6], [GOV.x, GOV.y - 0.1, GOV.z]), P([GM[0] + 6.0, GM[1] + 1.1, GM[2] + 2.0], [GM[0], GM[1] + 0.25, GM[2]]),
        P([0.9, PIT + 1.5, 3.0], [0.5, PIT + 0.4, 0])];
      aimSun(ctx.studio, shots[Math.max(0, which)].look, 6);
      const i = Math.max(0, which), lu = (t - beats[i]) / (beats[i + 1] - beats[i]);
      const s0 = shots[i], s1 = { ...s0, pos: [s0.pos[0] - 0.3, s0.pos[1] + 0.15, s0.pos[2] - 0.35] };
      set(kit.mixPose(s0, s1, smooth(lu)));
    },
    S07(t, d) {
      st.yCar = 14 + 1.1 * t; st.novaPose = { wave: seg(t, 0.05 * d, 0.15 * d) * (1 - seg(t, 0.4 * d, 0.5 * d)), time: t, mouth: 'grin', brows: 0.7, head: [0.1, 0.25, 0] };
      cut.offset = lerp(SECTION, 7.5, seg(t, 0.55 * d, 0.8 * d));
      solve(t);
      aimSun(ctx.studio, [0.5, st.yCar, 0], lerp(10, 40, seg(t, 0.3 * d, 0.8 * d)));
      [sheave, govG, ...gears.map(g => g.g), ...bufs].forEach((o, i) => glow(o, 0x52ff9a, 0.45 * seg(t, (0.3 + i * 0.04) * d, (0.36 + i * 0.04) * d) * (1 - seg(t, 0.58 * d, 0.66 * d))));
      set(path([[0, P([0.9, st.yCar + 1.5, 3.6], [0.1, st.yCar + 1.3, 0], 34)], [0.3 * d, P([1.8, st.yCar + 4, 14], [0.4, st.yCar + 2, 0], 34)],
                [0.55 * d, P([4, 26, 42], [0.5, 25, 0], 34)], [d, P([70, 46, 118], [0.5, 27, 0], 34)]], t));
      ctx.grade.uniforms.fade.value = 0;
    },
  };
  return { reset, scenes };
}

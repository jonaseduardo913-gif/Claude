// EPISODE 02 — How did they build a tunnel under the ocean? (Channel Tunnel; low-poly style, original cast)
// Units: meters. x = route (England -x, France +x), y up (sea level 0), z across the route.
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { brush, csg, Label, seg, smooth, easeOut, lerp, clamp, path, orbit, applyPose, rand } = kit;
  const { lp, facet, makeCharacter, cloud, blinkAt, aimSun } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 34) => ({ pos, look, fov });
  const add = (m, parent = scene) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, pos, parent) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent); m.position.set(...pos); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });
  const X = g => g.rotateZ(-Math.PI / 2); // cylinder along X
  cut.capSize = 1400;

  // ------------------------------------------------------------------ dimensions (Channel Tunnel)
  const SEABED = -45, AXIS = -72;
  const ZN = 15, ZS = 0, ZSo = -15;            // north rail, service, south rail
  const RAIL_IN = 3.8, RAIL_OUT = 4.4, SERV_IN = 2.4, SERV_OUT = 2.9;
  const XL = -300, XR = 300;                   // section block extent along the route
  const LAYERS = [
    { name: 'sediment', y0: -47, y1: SEABED, c: 0xcdb98e },
    { name: 'chalk', y0: -60, y1: -47, c: 0xeee9da },
    { name: 'marl', y0: -84, y1: -60, c: 0xa9b6bb },
    { name: 'gault', y0: -112, y1: -84, c: 0x657178 },
  ];

  // ------------------------------------------------------------------ geology block (sectioned)
  const layerMeshes = {};
  LAYERS.forEach(L => {
    let g = brush(new THREE.BoxGeometry(XR - XL, L.y1 - L.y0, 140), { pos: [0, (L.y0 + L.y1) / 2, -30] });
    let geo;
    if (L.name === 'marl') {
      geo = csg(g, [
        ['-', brush(X(new THREE.CylinderGeometry(RAIL_OUT, RAIL_OUT, XR - XL + 2, 40)), { pos: [0, AXIS, ZN] })],
        ['-', brush(X(new THREE.CylinderGeometry(SERV_OUT, SERV_OUT, XR - XL + 2, 32)), { pos: [0, AXIS, ZS] })],
        ['-', brush(X(new THREE.CylinderGeometry(RAIL_OUT, RAIL_OUT, XR - XL + 2, 40)), { pos: [0, AXIS, ZSo] })]]);
    } else geo = csg(g, []);
    const m = add(new THREE.Mesh(geo, lp.color(L.c)));
    cut.add(m, capMat(L.c));
    layerMeshes[L.name] = m;
  });
  // coasts: chalk cliffs and land on both ends (also sectioned)
  const land = [];
  [[XL - 160, 22, 0x6fbf4f], [XR + 160, 14, 0x7cc95a]].forEach(([cx, top, grass]) => {
    const body = add(new THREE.Mesh(csg(brush(new THREE.BoxGeometry(320, top + 112, 140), { pos: [cx, (top - 112) / 2, -30] }), []), lp.color(0xeee9da)));
    cut.add(body, capMat(0xe4ddca));
    const turf = add(new THREE.Mesh(csg(brush(new THREE.BoxGeometry(320, 1.2, 140), { pos: [cx, top + 0.6, -30] }), []), lp.color(grass)));
    cut.add(turf, capMat(grass));
    land.push(body, turf);
  });
  // water volume above the seabed + animated ocean surface
  const waterMat = lp.glass(0x1a6fb0, { opacity: 0.62, clippingPlanes: cut.planes });
  const water = add(new THREE.Mesh(new THREE.BoxGeometry(XR - XL, -SEABED, 140), waterMat)); water.position.set(0, SEABED / 2, -30); water.castShadow = false;
  const oceanGeo = new THREE.PlaneGeometry(2400, 2400, 90, 90); oceanGeo.rotateX(-Math.PI / 2);
  const oceanBase = oceanGeo.attributes.position.array.slice();
  const ocean = new THREE.Mesh(oceanGeo, lp.color(0x2c8fd6, { roughness: 0.35, metalness: 0.05 })); ocean.receiveShadow = true; scene.add(ocean);
  function waves(t) {
    const a = oceanGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = oceanBase[i], z = oceanBase[i + 2];
      const onLand = (x < XL - 2 || x > XR + 2) && z < 40 && z > -100;
      a[i + 1] = onLand ? -3 : 0.9 * Math.sin(x * 0.045 + t * 1.3) + 0.7 * Math.sin(z * 0.06 - t * 1.1) + 0.35 * Math.sin((x + z) * 0.11 + t * 2.1);
    }
    oceanGeo.attributes.position.needsUpdate = true; oceanGeo.computeVertexNormals();
  }
  // seabed life (clipped by the section)
  const rocks = new THREE.InstancedMesh(facet(new THREE.IcosahedronGeometry(1, 0), 0.25), lp.color(0x8a7d68, { clippingPlanes: cut.planes }), 160);
  const weeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 3.2, 5), lp.color(0x3f9e4a, { clippingPlanes: cut.planes }), 120);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 160; i++) { const sc = 0.6 + rand(i) * 2.4; e.set(rand(i + 1) * 3, rand(i + 2) * 3, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(-150 + rand(i + 3) * 300, SEABED + sc * 0.3, -60 + rand(i + 4) * 100), q, new THREE.Vector3(sc, sc * 0.6, sc)); rocks.setMatrixAt(i, m4); }
    for (let i = 0; i < 120; i++) { m4.makeTranslation(-150 + rand(i + 33) * 300, SEABED + 1.5, -60 + rand(i + 34) * 100); weeds.setMatrixAt(i, m4); } }
  add(rocks); add(weeds);
  const fishGeo = new THREE.ConeGeometry(0.45, 1.6, 5).rotateZ(-Math.PI / 2);
  const fish = new THREE.InstancedMesh(fishGeo, lp.color(0xffb347, { clippingPlanes: cut.planes }), 40); scene.add(fish);
  function swim(t) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 40; i++) {
      const a = t * 0.35 + i * 0.16, r = 9 + rand(i) * 5;
      const pos = new THREE.Vector3(-5 + Math.cos(a) * r, -24 + Math.sin(i * 1.7 + t) * 2 + rand(i + 5) * 6, 48 + Math.sin(a) * r * 0.5);
      e.set(0, -a - Math.PI / 2, 0); q.setFromEuler(e); m4.compose(pos, q, new THREE.Vector3(1, 1, 1)); fish.setMatrixAt(i, m4);
    }
    fish.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < 10; i++) { const c = cloud(i + 11, 9 + rand(i) * 6); c.position.set(-500 + i * 110, 120 + rand(i + 2) * 50, -300 - rand(i + 4) * 200); scene.add(c); }

  // ------------------------------------------------------------------ tunnel linings (sectioned) + ring joints
  const concrete = lp.color(0xc8c4bb), concreteCap = 0xb9b3a7;
  function liningGeo(rin, rout) { // unit length along +X from 0 to 1
    const g = csg(brush(X(new THREE.CylinderGeometry(rout, rout, 1, 40)), { pos: [0.5, 0, 0] }), [['-', brush(X(new THREE.CylinderGeometry(rin, rin, 1.2, 40)), { pos: [0.5, 0, 0] })]]);
    return g;
  }
  const railLin = liningGeo(RAIL_IN, RAIL_OUT), servLin = liningGeo(SERV_IN, SERV_OUT);
  const lin = {
    N: add(new THREE.Mesh(railLin, concrete)), S: add(new THREE.Mesh(railLin, concrete)), SV: add(new THREE.Mesh(servLin, concrete)),
  };
  lin.N.position.set(XL, AXIS, ZN); lin.S.position.set(XL, AXIS, ZSo); lin.SV.position.set(XL, AXIS, ZS);
  Object.values(lin).forEach(m => { m.scale.x = XR - XL; cut.add(m, capMat(concreteCap)); });
  // service-tunnel second heading (from France) for the breakthrough scene
  const linSV2 = add(new THREE.Mesh(servLin, concrete)); linSV2.position.set(0, AXIS, ZS); cut.add(linSV2, capMat(concreteCap));
  // unexcavated rock plugs
  const plugN = add(new THREE.Mesh(csg(brush(X(new THREE.CylinderGeometry(RAIL_OUT + 0.01, RAIL_OUT + 0.01, 1, 40)), { pos: [0.5, 0, 0] }), []), lp.color(0xa9b6bb)));
  plugN.position.set(0, AXIS, ZN); cut.add(plugN, capMat(0xa9b6bb));
  const plugSV = add(new THREE.Mesh(csg(brush(X(new THREE.CylinderGeometry(SERV_OUT + 0.01, SERV_OUT + 0.01, 1, 32)), { pos: [0.5, 0, 0] }), []), lp.color(0xa9b6bb)));
  plugSV.position.set(0, AXIS, ZS); cut.add(plugSV, capMat(0xa9b6bb));
  const ghostRock = lp.color(0xa9b6bb, { transparent: true, opacity: 0.16, depthWrite: false });
  // ring joints (instanced thin tori, clipped)
  const jointMat = lp.color(0x8d877c, { clippingPlanes: cut.planes });
  const joints = new THREE.InstancedMesh(new THREE.TorusGeometry(RAIL_IN + 0.02, 0.05, 4, 40).rotateY(Math.PI / 2), jointMat, 400);
  scene.add(joints);
  function placeJoints(x0, x1, z) {
    const m4 = new THREE.Matrix4(); let k = 0;
    for (let x = x0; x < x1 && k < 400; x += 1.5) { m4.makeTranslation(x, AXIS, z); joints.setMatrixAt(k++, m4); }
    joints.count = k; joints.instanceMatrix.needsUpdate = true;
  }
  // tunnel lights + track
  const lampMat = lp.emissive(0xfff0c8, 1.6);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.12, 0.2), lampMat, 400); scene.add(lamps);
  const track = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.25, 2.6), lp.color(0x6b5a4a), 600); scene.add(track);
  const rails = []; [ZN, ZSo].forEach(z => [-0.72, 0.72].forEach(o => { const r = box(XR - XL, 0.16, 0.12, lp.metal(0x9aa5ad), [0, AXIS - 2.95, z + o]); rails.push(r); }));
  const floors = [ZN, ZSo].map(z => box(XR - XL, 0.4, 5.6, lp.color(0x9a948a), [0, AXIS - 3.3, z]));
  const sfloor = box(XR - XL, 0.3, 3.2, lp.color(0x9a948a), [0, AXIS - 1.9, ZS]);
  { const m4 = new THREE.Matrix4(); let k = 0, q = 0;
    for (let x = XL; x < XR; x += 8) [ZN, ZSo].forEach(z => { m4.makeTranslation(x, AXIS + 2.9, z + 2.4); lamps.setMatrixAt(k++, m4); });
    for (let x = XL; x < XR; x += 1.0) [ZN, ZSo].forEach(z => { m4.makeTranslation(x, AXIS - 3.1, z); if (q < 600) track.setMatrixAt(q++, m4); });
    lamps.count = k; track.count = q; }
  // cross-passages every 375 m (two inside the section block)
  const passages = [];
  [-187.5, 187.5].forEach(x => [[SERV_OUT, ZN - RAIL_OUT], [ZSo + RAIL_OUT, -SERV_OUT]].forEach(([za, zb]) => {
    const len = Math.abs(zb - za);
    const g = new THREE.CylinderGeometry(1.6, 1.6, len, 20); g.rotateX(Math.PI / 2);
    const m = add(new THREE.Mesh(g, lp.color(0xd8d2c6))); m.position.set(x, AXIS - 1, (za + zb) / 2); passages.push(m);
  }));

  // ------------------------------------------------------------------ tunnel boring machine (faces +x)
  const TBM_R = 4.2;
  function makeTBM(face = 1) {
    const g = new THREE.Group();
    const yellow = lp.color(0xf2b632), gray = lp.metal(0x8f9aa4), dark = lp.metal(0x3c4652);
    const head = new THREE.Group(); g.add(head);
    const disc = add(new THREE.Mesh(X(new THREE.CylinderGeometry(TBM_R, TBM_R, 0.9, 36)), yellow), head);
    void disc;
    for (let i = 0; i < 6; i++) { const sp = box(0.5, TBM_R * 2 - 0.2, 0.9, lp.color(0xd89a22), [0.55 * face, 0, 0], head); sp.rotation.x = i * Math.PI / 6; }
    const cutters = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), lp.metal(0x2e353d), 48);
    { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let k = 0;
      for (let ring = 1; ring <= 4; ring++) for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2 + ring * 0.4, r = ring * TBM_R / 4.6;
        e.set(a, 0, Math.PI / 2); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(1.05 * face, Math.cos(a) * r, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1)); cutters.setMatrixAt(k++, m4);
      } }
    head.add(cutters);
    const cone = add(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 10).rotateZ(-Math.PI / 2 * face), lp.metal(0x2e353d)), head); cone.position.x = 1.0 * face;
    const shield = add(new THREE.Mesh(X(new THREE.CylinderGeometry(TBM_R - 0.05, TBM_R - 0.05, 10, 36, 1, true)), gray), g);
    shield.material.side = THREE.DoubleSide; shield.position.x = -5.4 * face;
    // thrust rams around the periphery, pushing on the last ring
    const rams = [];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const r = add(new THREE.Mesh(X(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8)), lp.metal(0xdfe6ea)), g);
      r.position.set(-8.5 * face, Math.cos(a) * 3.4, Math.sin(a) * 3.4); rams.push(r);
    }
    // erector ring + arm
    const erector = new THREE.Group(); erector.position.x = -9.8 * face; g.add(erector);
    const ringE = add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 6, 24).rotateY(Math.PI / 2), dark), erector); void ringE;
    const arm = new THREE.Group(); erector.add(arm);
    const armBeam = box(0.7, 3.0, 0.8, lp.color(0xe5483e), [0, 2.2, 0], arm); void armBeam;
    // back-up gantry with conveyor and lamps
    const gantry = new THREE.Group(); g.add(gantry);
    for (let i = 0; i < 6; i++) {
      const x = (-14 - i * 8) * face;
      [-1, 1].forEach(s => box(0.3, 4.2, 0.3, yellow, [x, -0.6, s * 2.3], gantry));
      box(0.3, 0.3, 4.9, yellow, [x, 1.5, 0], gantry);
      box(7.5, 0.2, 4.6, dark, [x - 3.8 * face, -2.4, 0], gantry);
    }
    const conveyor = box(52, 0.25, 1.0, lp.color(0x2f3640), [-36 * face, 1.0, 0], gantry);
    void conveyor;
    const cleats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.12, 0.9), lp.color(0x8d6a3a), 60); gantry.add(cleats);
    const cab = box(3.2, 2.0, 2.2, lp.color(0x2f7fd1), [-20 * face, -1.3, 1.4], gantry);
    box(0.05, 1.0, 1.6, lp.glass(0xbfe8ff, { opacity: 0.45 }), [-18.4 * face, -1.0, 1.4], gantry);
    void cab;
    return { g, head, rams, erector, arm, cleats, face, gantry };
  }
  const tbm = makeTBM(1); scene.add(tbm.g);
  const tbmFR = makeTBM(-1); scene.add(tbmFR.g);           // a French-side machine (service tunnel, breakthrough scene)
  tbmFR.g.scale.setScalar(SERV_IN / RAIL_IN * 0.98);
  // spoil on the conveyor + muck wagons
  const spoil = new THREE.InstancedMesh(facet(new THREE.IcosahedronGeometry(0.28, 0), 0.06), lp.color(0xd9d3c1), 160); scene.add(spoil);
  const wagons = new THREE.Group(); scene.add(wagons);
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Group(); w.position.x = -70 - i * 6; wagons.add(w);
    box(5, 1.6, 2.0, lp.color(0x3f6fd8), [0, 0, 0], w);
    box(4.6, 0.5, 1.7, lp.color(0xd9d3c1), [0, 0.9, 0], w);
    [-1.6, 1.6].forEach(x => [-0.9, 0.9].forEach(z => { const wh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 10).rotateX(Math.PI / 2), lp.metal(0x30363e)), w); wh.position.set(x, -0.95, z); }));
  }
  // segment being placed + segments of the current ring
  function segmentGeo(a0, a1) {
    const s = new THREE.Shape();
    const n = 10;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const p = [Math.cos(a) * RAIL_OUT * 0.985, Math.sin(a) * RAIL_OUT * 0.985]; i ? s.lineTo(...p) : s.moveTo(...p); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(a) * RAIL_IN, Math.sin(a) * RAIL_IN); }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.45, bevelEnabled: false }); g.rotateY(Math.PI / 2); // extrude along +x
    return g;
  }
  const SEGS = [];
  const segA = (Math.PI * 2 - 0.35) / 6;
  for (let i = 0; i < 6; i++) SEGS.push({ a0: -Math.PI / 2 + 0.175 + i * segA, a1: -Math.PI / 2 + 0.175 + (i + 1) * segA - 0.01 });
  SEGS.push({ a0: -Math.PI / 2 - 0.175, a1: -Math.PI / 2 + 0.165, key: true });
  const ringSegs = SEGS.map(sg => { const m = add(new THREE.Mesh(segmentGeo(sg.a0, sg.a1), lp.color(sg.key ? 0xf5d08a : 0xf1e4c4))); return m; });

  // ------------------------------------------------------------------ trains
  function passengerTrain(cars = 7) {
    const g = new THREE.Group();
    const body = lp.color(0xf4f6f8, { side: THREE.DoubleSide }), stripe = lp.color(0x1fa3a3), win = lp.color(0x1f2a36);
    for (let i = 0; i < cars; i++) {
      const c = new THREE.Group(); c.position.x = -i * 19; g.add(c);
      box(18.4, 3.6, 2.9, body, [0, 0, 0], c); box(18.5, 0.5, 2.95, stripe, [0, -0.9, 0], c); box(17, 0.7, 2.96, win, [0, 0.6, 0], c);
      if (i === 0) { const nose = add(new THREE.Mesh(new THREE.ConeGeometry(1.8, 6, 6).rotateZ(-Math.PI / 2), body), c); nose.scale.set(1, 1, 0.8); nose.position.set(12.2, -0.2, 0); }
    }
    return g;
  }
  function shuttleTrain(cars = 6) {
    const g = new THREE.Group();
    const body = lp.color(0xdfe3e8, { side: THREE.DoubleSide }), stripe = lp.color(0xe5483e);
    const carCols = [0xe5483e, 0x2f7fd1, 0xf2b632, 0x3fb36a, 0xf4f6f8];
    for (let i = 0; i < cars; i++) {
      const c = new THREE.Group(); c.position.x = -i * 27; g.add(c);
      box(26, 5.2, 3.9, body, [0, 0.6, 0], c); box(26.1, 0.5, 3.95, stripe, [0, -1.2, 0], c);
      for (let k = 0; k < 3; k++) { const car = new THREE.Group(); car.position.set(-8 + k * 8, -0.9, 0); c.add(car);
        box(4.2, 1.0, 1.8, lp.color(carCols[(i + k) % 5]), [0, 0, 0], car); box(2.4, 0.7, 1.7, lp.color(0x22303c), [-0.3, 0.8, 0], car); }
    }
    return g;
  }
  const train = passengerTrain(); scene.add(train);
  const shuttle = shuttleTrain(); scene.add(shuttle);
  const svVeh = new THREE.Group(); scene.add(svVeh);
  box(5, 1.6, 1.8, lp.color(0xf2b632), [0, 0, 0], svVeh); box(1.6, 1.0, 1.7, lp.color(0x22303c), [1.6, 1.1, 0], svVeh);

  // everything inside the tunnels is clipped by the section plane (no protruding trains/tracks)
  const clipAll = o => o.traverse(m => { if (m.isMesh && m.material) m.material.clippingPlanes = cut.planes; });
  [train, shuttle, svVeh, lamps, track, sfloor, ...floors, ...rails].forEach(clipAll);
  const passMat = passages[0].material; passages.forEach(m => (m.material = passMat));
  // ------------------------------------------------------------------ people
  const otto = makeCharacter('otto'); scene.add(otto);
  const crewA = makeCharacter('crewA'); scene.add(crewA);
  const crewB = makeCharacter('crewB'); scene.add(crewB);
  const crewC = makeCharacter('crewA'); scene.add(crewC);
  const workLight = new THREE.PointLight(0xfff0d0, 0, 60, 1.2); scene.add(workLight);
  const workLight2 = new THREE.PointLight(0xfff0d0, 0, 60, 1.2); scene.add(workLight2);
  const chunks = new THREE.InstancedMesh(facet(new THREE.IcosahedronGeometry(0.35, 0), 0.08), lp.color(0xa9b6bb), 50); scene.add(chunks);

  // ------------------------------------------------------------------ map set (geography)
  const MAP = [0, 1500, 0];
  const mapG = new THREE.Group(); mapG.position.set(...MAP); scene.add(mapG);
  const sea = add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), lp.color(0x2c8fd6)), mapG); void sea;
  function landPoly(pts, color, h = 2) {
    const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = add(new THREE.Mesh(g, lp.color(color)), mapG); return m;
  }
  // stylized coastlines (1 unit ≈ 1 km); north = -z
  landPoly([[-160, -20], [-60, -8], [-34, -5], [-18, -7], [-11, -11], [-8, -20], [-10, -30], [-5, -40], [-22, -52], [-60, -56], [-160, -70]], 0x6fbf4f);  // England (Kent)
  landPoly([[-60, 160], [-8, 70], [2, 40], [5, 24], [8, 9], [14, 5], [22, 2], [40, -3], [70, -8], [160, -10], [160, 160]], 0x7cc95a);               // France (Pas-de-Calais)
  const FOLK = [-18, -7], COQ = [15, 6];
  const routeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(FOLK[0] - 6, 2.4, -(FOLK[1] - 3)), new THREE.Vector3(FOLK[0], 2.4, -FOLK[1]), new THREE.Vector3(0, 2.4, 1), new THREE.Vector3(COQ[0], 2.4, -COQ[1]), new THREE.Vector3(COQ[0] + 5, 2.4, -(COQ[1] + 3))]);
  const route = add(new THREE.Mesh(new THREE.TubeGeometry(routeCurve, 80, 0.9, 8), lp.emissive(0xffc23a, 1.2)), mapG);
  route.geometry.setDrawRange(0, 0);
  const routeCount = route.geometry.index.count;

  // ------------------------------------------------------------------ labels
  const L = {
    seabed: new Label(ctx, 'SEABED', { accent: '#cdb98e' }), marl: new Label(ctx, 'CHALK MARL', { accent: '#a9b6bb' }),
    tbm: new Label(ctx, 'TUNNEL BORING\nMACHINE', { accent: '#f2b632' }), head: new Label(ctx, 'CUTTERHEAD', { accent: '#f2b632' }),
    conv: new Label(ctx, 'CONVEYOR', { accent: '#8d6a3a' }), seg: new Label(ctx, 'PRECAST CONCRETE\nSEGMENTS', { accent: '#cfc9bd' }),
    rail: new Label(ctx, 'RAIL TUNNEL · 7.6 m', { accent: '#1fa3a3' }), rail2: new Label(ctx, 'RAIL TUNNEL · 7.6 m', { accent: '#e5483e' }),
    serv: new Label(ctx, 'SERVICE TUNNEL · 4.8 m', { accent: '#f2b632' }), pass: new Label(ctx, 'CROSS-PASSAGE\nEVERY 375 m', { accent: '#9fb0bf' }),
    date: new Label(ctx, 'DECEMBER 1990', { accent: '#ffc24a', size: 0.04 }),
    eng: new Label(ctx, 'ENGLAND', { accent: '#6fbf4f', size: 0.036 }), fra: new Label(ctx, 'FRANCE', { accent: '#7cc95a', size: 0.036 }),
    folk: new Label(ctx, 'FOLKESTONE', { accent: '#ffc23a' }), cal: new Label(ctx, 'CALAIS', { accent: '#ffc23a' }),
    len: new Label(ctx, '50 km', { accent: '#ffc23a', size: 0.04 }),
  };

  // ------------------------------------------------------------------ state
  const st = {};
  function reset() {
    cut.setPlane([0, 0, -1], ZN);            // longitudinal section through the north rail tunnel
    scene.fog = null;
    Object.values(L).forEach(l => l.set(0));
    mapG.visible = false; tbmFR.g.visible = false; train.visible = false; shuttle.visible = false; svVeh.visible = false;
    tbm.g.visible = true; tbm.gantry.visible = true; tbm.head.visible = true;
    tbm.g.traverse(m => { if (m.isMesh) m.material.clippingPlanes = []; }); wagons.visible = true; spoil.visible = true; chunks.visible = false;
    ringSegs.forEach(m => (m.visible = false));
    [otto, crewA, crewB, crewC].forEach(c => { c.visible = false; c.pose({}); });
    workLight.intensity = 0; workLight2.intensity = 0;
    passMat.clippingPlanes = cut.planes;
    plugN.material = plugN.userData.mat || (plugN.userData.mat = plugN.material);
    linSV2.visible = false; plugSV.visible = false;
    lin.SV.position.x = XL; lin.SV.scale.x = XR - XL;   // never inherit state from the previous frame
    Object.assign(st, { xFront: 40 });
    ctx.studio.sun.intensity = 2.6; ctx.studio.hemi.intensity = 1.1;
    ctx.grade.uniforms.fade.value = 0;
  }
  /** construction state of the north rail tunnel: machine face at xFront, lining finished up to the shield tail */
  function construction(t, xFront, spin = 1) {
    tbm.g.position.set(xFront, AXIS, ZN);
    tbm.head.rotation.x = t * 0.8 * spin;
    const linEnd = xFront - 10.4;
    lin.N.position.x = XL; lin.N.scale.x = linEnd - XL;
    plugN.position.x = xFront + 0.4; plugN.scale.x = XR - xFront;
    placeJoints(linEnd - 140, linEnd, ZN);
    // spoil travelling back on the conveyor
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) {
      const u = ((i / 160) + t * 0.35) % 1;
      const onBelt = i < 120;
      const x = onBelt ? xFront - 2 - u * 56 : xFront + 0.6;
      const y = onBelt ? AXIS + 1.35 : AXIS - 3 + (u * 6) % 6 - 3;
      const z = ZN + (rand(i) - 0.5) * (onBelt ? 0.7 : 5);
      if (onBelt) m4.makeTranslation(x, y, z); else m4.makeTranslation(xFront - 1.2, AXIS - 2.5 + (1 - u) * 2.2, ZN + (rand(i) - 0.5) * 3); spoil.setMatrixAt(i, m4);
    }
    spoil.instanceMatrix.needsUpdate = true;
    const c4 = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) { c4.makeTranslation(-36 + ((i * 0.9 + t * 4) % 52) - 26, 1.18, 0); tbm.cleats.setMatrixAt(i, c4); }
    tbm.cleats.instanceMatrix.needsUpdate = true;
    wagons.position.set(xFront, AXIS - 1.9, ZN);
    wagons.children.forEach((w, i) => (w.position.x = -70 - i * 6 - (t * 1.5) % 6));
  }
  function trains(t) {
    train.visible = shuttle.visible = svVeh.visible = true;
    train.position.set(-80 + ((t * 30) % 400) - 100, AXIS - 0.9, ZN);
    shuttle.position.set(150 - ((t * 22) % 400), AXIS - 0.3, ZSo);
    svVeh.position.set(-20 + t * 6, AXIS - 0.95, ZS);
  }
  function finished() {
    tbm.g.visible = false; wagons.visible = false; spoil.visible = false;
    lin.N.position.x = XL; lin.N.scale.x = XR - XL; plugN.position.x = XR + 50; plugN.scale.x = 0.001;
    placeJoints(-100, 140, ZN);
  }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      waves(t); finished(); trains(t + 30); swim(t);
      const u = t / d;
      cut.setPlane([0, 0, -1], lerp(160, ZN, seg(u, 0.6, 0.9)));
      const camY = path([[0, P([0, 0, 0], [0, 0, 0])]], 0);
      void camY;
      const pose = path([[0, P([-420, 75, 120], [-200, 0, -30])], [0.3 * d, P([-90, 9, 95], [10, -6, 0])], [0.45 * d, P([-20, -6, 60], [10, -40, 0])],
                         [0.7 * d, P([10, -40, 95], [10, -62, 0])], [d, P([16, -48, 120], [16, -66, 0])]], t);
      set(pose);
      if (camera.position.y < 0.5) { scene.fog = new THREE.FogExp2(0x1d6fa8, camera.position.y > SEABED ? 0.0045 : 0.0015); ctx.studio.hemi.intensity = 1.5; }
      aimSun(ctx.studio, [0, -40, 0], 160);
      L.seabed.set(seg(u, 0.75, 0.82), [-20, SEABED, ZN + 0.5], [-0.85, 0.42]);
      L.marl.set(seg(u, 0.82, 0.9), [30, -62, ZN], [-0.05, -0.38]);
    },
    S02(t, d) {
      waves(t);
      const xf = 40 + 0.08 * t; construction(t, xf, 1.6);
      plugN.material = ghostRock;
      otto.visible = true; otto.position.set(xf - 18.4 + 0.6, AXIS - 2.3, ZN + 1.2); otto.rotation.y = Math.PI / 2;
      otto.pose({ blink: blinkAt(t, 3), point: seg(t, 0.6 * d, 0.7 * d), mouth: 'grin', head: [0, 0, 0] });
      workLight.intensity = 60; workLight.position.set(xf + 9, AXIS + 2, ZN + 6);
      workLight2.intensity = 30; workLight2.position.set(xf - 16, AXIS + 1, ZN + 2);
      aimSun(ctx.studio, [xf, AXIS, ZN], 20);
      set(path([[0, P([xf + 26, AXIS + 3, ZN + 18], [xf - 4, AXIS, ZN])], [0.55 * d, P([xf + 14, AXIS + 1.5, ZN + 9], [xf, AXIS, ZN], 34)],
                [d, P([xf + 7, AXIS + 0.6, ZN + 4.2], [xf + 0.8, AXIS, ZN], 34)]], t));
      L.tbm.set(seg(t, 0.15 * d, 0.25 * d) * (1 - seg(t, 0.5 * d, 0.56 * d)), [xf - 6, AXIS + 3, ZN + 3], [-0.85, 0.5]);
      L.head.set(seg(t, 0.6 * d, 0.68 * d), [xf + 1, AXIS + 2, ZN + 1.5], [-0.8, 0.55]);
    },
    S03(t, d) {
      waves(t);
      const xf = 41 + 0.25 * t; construction(t, xf, 1.6);
      otto.visible = true; otto.position.set(xf - 18.4 + 0.6, AXIS - 2.3, ZN + 1.2); otto.rotation.y = 0.8; otto.pose({ blink: blinkAt(t, 3), thumbs: 1 });
      workLight.intensity = 40; workLight.position.set(xf - 20, AXIS + 2, ZN + 6);
      const u = t / d;
      aimSun(ctx.studio, [xf - 20, AXIS + 10, ZN], 60);
      set(path([[0, P([xf - 6, AXIS + 1, ZN + 22], [xf - 18, AXIS, ZN])], [0.45 * d, P([xf - 34, AXIS + 1, ZN + 24], [xf - 38, AXIS, ZN])],
                [d, P([xf - 30, AXIS + 18, ZN + 120], [xf - 30, AXIS + 30, ZN])]], t));
      L.conv.set(seg(u, 0.12, 0.2) * (1 - seg(u, 0.5, 0.56)), [xf - 30, AXIS + 1.2, ZN + 0.6], [-0.85, 0.45]);
      L.seabed.set(seg(u, 0.75, 0.82), [xf - 40, SEABED, ZN + 0.5], [-0.85, 0.3]);
    },
    S04(t, d) {
      waves(t);
      const xf = 44; construction(t, xf, 1.6);
      tbm.gantry.visible = false; spoil.visible = false; wagons.visible = false;
      const u = t / d;
      // ring under construction at the shield tail; segments 0..4 placed, 5 carried by the erector, then the key
      const xr = xf - 10.4;
      const carry = (i, a, b) => {
        const k = seg(u, a, b);
        const sg = SEGS[i], mid = (sg.a0 + sg.a1) / 2;
        const m = ringSegs[i]; m.visible = true;
        m.position.set(xr + lerp(-3, 0, k), AXIS, ZN);
        m.rotation.x = lerp(-Math.PI / 2 - mid + -Math.PI / 2 + 0.0, 0, k) * 0 + lerp(-(mid + Math.PI / 2), 0, k);
        m.scale.setScalar(1); m.position.y = AXIS + lerp(-0.6, 0, k);
        m.material.emissive.set(0xff9a1a).multiplyScalar(k > 0 && k < 1 ? 0.7 : 0);
        return k;
      };
      for (let i = 0; i < 4; i++) { const m = ringSegs[i]; m.visible = true; m.position.set(xr, AXIS, ZN); m.rotation.x = 0; }
      const k5 = carry(4, 0.05, 0.36), k6 = carry(5, 0.38, 0.62), kk = carry(6, 0.62, 0.8);
      const armAng = u < 0.37 ? lerp(Math.PI, (SEGS[4].a0 + SEGS[4].a1) / 2 - Math.PI / 2, k5) : u < 0.62 ? lerp(Math.PI, (SEGS[5].a0 + SEGS[5].a1) / 2 - Math.PI / 2, k6) : lerp(Math.PI, -Math.PI, kk);
      tbm.erector.rotation.x = armAng;
      lin.N.scale.x = (u > 0.82 ? xr + 1.45 : xr) - XL;
      workLight.intensity = 50; workLight.position.set(xr - 6, AXIS + 1.5, ZN + 1);
      cut.setPlane([0, 0, -1], ZN);          // longitudinal section: shield + rings cut in half
      tbm.g.traverse(m => { if (m.isMesh) m.material.clippingPlanes = cut.planes; });
      ringSegs.forEach(m => (m.material.clippingPlanes = cut.planes));
      aimSun(ctx.studio, [xr, AXIS, ZN], 12);
      set(path([[0, P([xr - 5.5, AXIS + 2.5, ZN + 10.5], [xr + 0.8, AXIS - 0.2, ZN - 1.5], 36)], [0.8 * d, P([xr - 7.5, AXIS + 2.8, ZN + 11.5], [xr + 0.8, AXIS - 0.2, ZN - 1.5], 36)],
                [d, P([xr - 24, AXIS + 5, ZN + 20], [xr - 6, AXIS, ZN - 1])]], t));
      L.seg.set(seg(u, 0.15, 0.25), [xr + 0.7, AXIS + 3.9, ZN - 1.5], [-0.85, 0.55]);
    },
    S05(t, d) {
      waves(t); finished(); trains(t); passMat.clippingPlanes = [];
      const u = t / d;
      // rotate from longitudinal to cross-section: plane normal swings from -z to -x
      const r = seg(u, 0.12, 0.42);
      const ang = r * Math.PI / 2;
      const XC = 186;
      cut.setPlane([-Math.sin(ang), 0, -Math.cos(ang)], lerp(ZN, XC, r) * 0 + (r < 1 ? lerp(ZN, XC, r) : XC));
      if (r > 0.999) cut.setPlane([-1, 0, 0], XC);
      train.position.x = XC - 30 + t * 4; shuttle.position.x = XC + 40 - t * 4; svVeh.position.x = XC - 4;
      aimSun(ctx.studio, [XC, AXIS, 0], 40);
      set(path([[0, P([XC - 70, AXIS + 4, 62], [XC - 30, AXIS, ZN])], [0.45 * d, P([XC + 70, AXIS + 14, 50], [XC, AXIS, 0])], [d, P([XC + 104, AXIS + 9, 0], [XC, AXIS - 1, 0])]], t));
      L.rail.set(seg(u, 0.48, 0.55), [XC, AXIS + 2, ZN], [0.05, 0.55]);
      L.serv.set(seg(u, 0.6, 0.67), [XC, AXIS + 1.5, ZS], [-0.85, 0.4]);
      L.rail2.set(seg(u, 0.7, 0.77), [XC, AXIS + 2, ZSo], [-0.85, 0.6]);
      L.pass.set(seg(u, 0.82, 0.89), [185, AXIS - 1, 7.5], [-0.1, -0.4]);
    },
    S06(t, d) {
      waves(t); finished();
      const u = t / d;
      cut.setPlane([0, 0, -1], ZS);           // section through the service tunnel
      linSV2.visible = true; plugSV.visible = true;
      // English heading from the left, French heading from the right; last rock wall at x=0..3
      const wall = 1 - seg(u, 0.45, 0.55);
      lin.SV.position.x = XL; lin.SV.scale.x = -0.2 - XL;
      linSV2.position.x = 3.2; linSV2.scale.x = XR - 3.2;
      plugSV.position.x = -0.2; plugSV.scale.x = Math.max(0.001, 3.4 * wall);
      plugSV.visible = wall > 0.01;
      chunks.visible = u > 0.45 && u < 0.85;
      if (chunks.visible) { const m4 = new THREE.Matrix4(); const k = seg(u, 0.45, 0.75, easeOut); for (let i = 0; i < 50; i++) { m4.makeTranslation(1.5 + (rand(i) - 0.5) * 3 * (1 + k), AXIS + (rand(i + 1) - 0.5) * 4 - k * k * 2.2 * rand(i + 2), ZS + (rand(i + 3) - 0.5) * 3); chunks.setMatrixAt(i, m4); } chunks.instanceMatrix.needsUpdate = true; }
      otto.visible = crewB.visible = crewA.visible = crewC.visible = true;
      const meet = seg(u, 0.55, 0.75);
      otto.position.set(lerp(-3.5, -0.8, meet), AXIS - 1.75, ZS - 0.4); otto.rotation.y = Math.PI / 2;
      crewB.position.set(lerp(6.5, 2.2, meet), AXIS - 1.75, ZS - 0.4); crewB.rotation.y = -Math.PI / 2;
      crewA.position.set(-6, AXIS - 1.75, ZS + 0.6); crewA.rotation.y = Math.PI / 2;
      crewC.position.set(9, AXIS - 1.75, ZS + 0.6); crewC.rotation.y = -Math.PI / 2;
      const shake = seg(u, 0.72, 0.8);
      otto.pose({ walk: meet > 0 && meet < 1 ? t * 9 : null, point: shake * 0.75, mouth: 'grin', brows: 0.6, blink: blinkAt(t, 3) });
      crewB.pose({ walk: meet > 0 && meet < 1 ? t * 9 + 1 : null, point: shake * 0.75, mouth: 'grin', brows: 0.6, blink: blinkAt(t, 7) });
      crewA.pose({ cheer: seg(u, 0.78, 0.85), mouth: 'grin' }); crewC.pose({ cheer: seg(u, 0.8, 0.87), mouth: 'grin' });
      workLight.intensity = 25; workLight.position.set(-4, AXIS + 1.2, ZS + 2);
      workLight2.intensity = 25; workLight2.position.set(6, AXIS + 1.2, ZS + 2);
      aimSun(ctx.studio, [0, AXIS, 0], 50);
      set(path([[0, P([0, -20, 260], [0, -60, 0], 34)], [0.4 * d, P([0.7, AXIS + 1, 26], [0.7, AXIS, 0])], [d, P([0.7, AXIS + 0.3, 12.5], [0.7, AXIS - 0.2, 0], 32)]], t));
      L.date.set(seg(u, 0.78, 0.86), null, [-0.48, 0.5]);
    },
    S07(t, d) {
      waves(t); finished();
      const u = t / d;
      if (u < 0.28) {                          // front tracking inside the lit tunnel
        train.visible = true; cut.setPlane([0, 0, -1], ZN + 30);
        train.position.set(-60 + t * 34, AXIS - 0.9, ZN);
        const tx = train.position.x;
        workLight.intensity = 40; workLight.position.set(tx + 22, AXIS + 2, ZN);
        set(path([[0, P([tx + 30, AXIS + 0.6, ZN + 0.6], [tx, AXIS - 0.4, ZN])], [0.28 * d, P([tx + 22, AXIS + 0.4, ZN + 1.6], [tx, AXIS - 0.4, ZN])]], t));
      } else if (u < 0.52) {                   // side tracking in section
        train.visible = true;
        train.position.set(-60 + t * 34, AXIS - 0.9, ZN);
        const tx = train.position.x;
        aimSun(ctx.studio, [tx, AXIS, ZN], 30);
        set(P([tx - 30 + (u - 0.28) * 30, AXIS + 2, ZN + 34], [tx - 36, AXIS, ZN]));
      } else if (u < 0.8) {                     // geography
        mapG.visible = true;
        const k = seg(u, 0.55, 0.7);
        route.geometry.setDrawRange(0, Math.floor(routeCount * k / 3) * 3);
        const c = MAP;
        set(path([[0.52 * d, P([c[0] - 10, c[1] + 70, c[2] + 70], [c[0], c[1], c[2] - 2])], [0.8 * d, P([c[0] - 4, c[1] + 120, c[2] + 95], [c[0], c[1], c[2] - 4])]], t));
        L.eng.set(seg(u, 0.56, 0.6), null, [-0.7, 0.42]);
        L.fra.set(seg(u, 0.58, 0.62), null, [0.15, -0.2]);
        L.folk.set(seg(u, 0.62, 0.66), [c[0] + FOLK[0], c[1] + 2.5, c[2] - FOLK[1]], [-0.85, 0.15]);
        L.cal.set(seg(u, 0.64, 0.68), [c[0] + COQ[0], c[1] + 2.5, c[2] - COQ[1]], [0.25, 0.05]);
        L.len.set(seg(u, 0.68, 0.72), null, [-0.2, 0.62]);
        aimSun(ctx.studio, c, 200);
      } else {                                   // final wide: three tunnels beneath the sea
        trains(t);
        cut.setPlane([-1, 0, 0], 150);
        aimSun(ctx.studio, [150, -40, 0], 160);
        set(path([[0.8 * d, P([210, -40, 60], [150, -62, -2])], [d, P([330, 10, 150], [150, -50, -10])]], t));
        ctx.grade.uniforms.fade.value = seg(t, d - 0.6, d - 0.05);
      }
    },
  };
  return { reset, scenes };
}

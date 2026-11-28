// EPISODE — How do they build a soccer stadium? (low-poly style, original cast/kits)
// Units: meters. Pitch 105 x 68 centred at the origin (length along x). The "south" stand (+z) is the one built on screen.
import { makeParticles, resetEnv, goldenHour, skyClouds } from '/engine/env.js';
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, applyPose, rand, csg, brush } = kit;
  const { lp, makeCharacter, blinkAt, aimSun, facet, tree } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 38) => ({ pos, look, fov });
  const add = (m, parent = scene) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, pos, parent = scene) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent); m.position.set(...pos); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
  const clipC = (c, o = {}) => lp.color(c, { clippingPlanes: cut.planes, ...o });
  cut.capSize = 700;
  const PL = 105, PW = 68, HL = PL / 2, HW = PW / 2;

  // ------------------------------------------------------------------ ground + surroundings
  const site = new THREE.Group(); scene.add(site);
  const grassOut = add(new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2), lp.color(0x6cc04a, { clippingPlanes: cut.planes })), site); grassOut.position.y = -0.7;
  const dirt = add(new THREE.Mesh(new THREE.BoxGeometry(170, 0.2, 140), lp.color(0xb08a5a, { clippingPlanes: cut.planes })), site); dirt.position.y = -0.02;
  for (let i = 0; i < 70; i++) { const a = rand(i) * Math.PI * 2, r = 150 + rand(i + 3) * 300; const t = tree(i, 9 + rand(i) * 6); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); site.add(t); }
  const skyc = skyClouds(ctx, { n: 10, y: 200, spread: 1600, scale: 16 });
  // soil layers below the south stand (sectioned)
  const soils = [[-0.2, -4, 0x9a7b55], [-4, -20, 0xb08a5a], [-20, -34, 0x8a7560], [-34, -50, 0x6f6a66]].map(([a, b, c]) => {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(150, a - b, 80), lp.color(c))); m.position.set(0, (a + b) / 2, 60); cut.add(m, capMat(c)); return m; });

  // ------------------------------------------------------------------ pitch (layered for the section) + markings + goals
  const pitch = new THREE.Group(); scene.add(pitch);
  const layers = [[0, -0.06, 0x3f9e4a], [-0.06, -0.36, 0xd9c08a], [-0.36, -0.62, 0x8d98a5], [-0.62, -2.2, 0x8a6a45]].map(([a, b, c]) => {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(PL + 12, a - b, PW + 12), lp.color(c)), pitch); m.position.y = (a + b) / 2; cut.add(m, capMat(c)); return m; });
  for (let i = 0; i < 12; i++) box(PL / 12, 0.02, PW, lp.color(i % 2 ? 0x4fb357 : 0x46a64f, { clippingPlanes: cut.planes }), [-HL + PL / 24 + i * PL / 12, 0.01, 0], pitch);
  const lineM = lp.color(0xffffff, { clippingPlanes: cut.planes });
  const line = (w, d, x, z) => box(w, 0.03, d, lineM, [x, 0.03, z], pitch);
  line(PL, 0.12, 0, HW); line(PL, 0.12, 0, -HW); line(0.12, PW, HL, 0); line(0.12, PW, -HL, 0); line(0.12, PW, 0, 0);
  [-1, 1].forEach(s => { line(0.12, 40.3, s * (HL - 16.5), 0); line(16.5, 0.12, s * (HL - 8.25), 20.15); line(16.5, 0.12, s * (HL - 8.25), -20.15);
    line(0.12, 18.3, s * (HL - 5.5), 0); line(5.5, 0.12, s * (HL - 2.75), 9.15); line(5.5, 0.12, s * (HL - 2.75), -9.15); });
  add(new THREE.Mesh(new THREE.TorusGeometry(9.15, 0.07, 4, 64).rotateX(Math.PI / 2), lineM), pitch).position.y = 0.03;
  const goals = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * HL, 0, 0); pitch.add(g);
    const post = lp.color(0xffffff);
    [-3.66, 3.66].forEach(z => box(0.12, 2.44, 0.12, post, [0, 1.22, z], g)); box(0.12, 0.12, 7.44, post, [0, 2.44, 0], g);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, wireframe: true }));
    net.position.set(s * 1, 1.22, 0); g.add(net);
    return { g, net, s };
  });
  // drainage + heating pipes (visible only in the pitch section)
  const drains = [], heats = [];
  for (let i = 0; i < 9; i++) { const z = -HW + 4 + i * 8 - 2 + (i === 6 ? 0 : 0); const d = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, PL, 10).rotateZ(Math.PI / 2), clipC(0x2f7fd1)), pitch); d.position.set(0, -0.5, z); drains.push(d); }
  for (let i = 0; i < 34; i++) { const z = -HW + 1 + i * 2; const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, PL, 6).rotateZ(Math.PI / 2), clipC(0xe5483e, { emissive: 0xff5a2a, emissiveIntensity: 0 })), pitch); h.position.set(0, -0.26, z); heats.push(h); }

  // ------------------------------------------------------------------ stand profile (two tiers) -> straight sides + rounded corners
  const ROW_D = 0.85, LOW = { d0: 8, rows: 26, rise: 0.42, y0: 0.8 }, UP = { d0: 34, rows: 24, rise: 0.58, y0: 15.5 };
  const profile = [];  // (d, y) along the top of the steps, outward from the pitch edge
  profile.push([LOW.d0 - 1, 0]); profile.push([LOW.d0 - 1, LOW.y0]);
  for (let i = 0; i < LOW.rows; i++) { const d = LOW.d0 + i * ROW_D, y = LOW.y0 + i * LOW.rise; profile.push([d, y], [d + ROW_D, y]); profile[profile.length - 1][1] = y; profile.push([d + ROW_D, y + LOW.rise]); }
  profile.push([UP.d0 - 1, LOW.y0 + LOW.rows * LOW.rise], [UP.d0 - 1, UP.y0]);
  for (let i = 0; i < UP.rows; i++) { const d = UP.d0 + i * ROW_D, y = UP.y0 + i * UP.rise; profile.push([d, y], [d + ROW_D, y]); profile.push([d + ROW_D, y + UP.rise]); }
  const D_BACK = UP.d0 + UP.rows * ROW_D + 1.5, Y_BACK = UP.y0 + UP.rows * UP.rise + 2;
  profile.push([D_BACK, Y_BACK], [D_BACK, 0]);
  const seatPos = (tier, i) => { const T = tier ? UP : LOW; return [T.d0 + i * ROW_D + ROW_D * 0.5, T.y0 + i * T.rise]; };
  function sideGeometry(len) {
    const s = new THREE.Shape(); profile.forEach(([d, y], i) => (i ? s.lineTo(d, y) : s.moveTo(d, y))); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); // x=d (outward), y=up, z=along
    return g;
  }
  function cornerGeometry() { return new THREE.LatheGeometry(profile.map(([d, y]) => new THREE.Vector2(d, y)), 10, 0, Math.PI / 2); }
  const concrete = lp.color(0xbdb6a8);
  const stands = new THREE.Group(); scene.add(stands);
  const sides = [ // [length, position, rotationY] : local +x of the profile must point outward
    { len: PL, pos: [0, 0, HW], rot: -Math.PI / 2, key: 'S' }, { len: PL, pos: [0, 0, -HW], rot: Math.PI / 2, key: 'N' },
    { len: PW, pos: [HL, 0, 0], rot: 0, key: 'E' }, { len: PW, pos: [-HL, 0, 0], rot: Math.PI, key: 'W' }];
  const sideMeshes = {};
  sides.forEach(sd => { const m = add(new THREE.Mesh(sideGeometry(sd.len), concrete), stands); m.position.set(...sd.pos); m.rotation.y = sd.rot; cut.add(m, capMat(0x9d978c)); sideMeshes[sd.key] = m; });
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => { const m = add(new THREE.Mesh(cornerGeometry(), concrete), stands); m.position.set(sx * HL, 0, sz * HW); m.rotation.y = -i * Math.PI / 2 + Math.PI / 2; return m; });
  // fix corner orientation: lathe starts at +z and sweeps toward +x; rotate each to face its corner
  corners.forEach((m, i) => (m.rotation.y = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][i]));

  // ------------------------------------------------------------------ crowd (instanced bodies + heads), seats rows sampled around the bowl
  const seats = [];
  const addSeat = (x, y, z, face) => seats.push({ x, y, z, face });
  sides.forEach(sd => {
    const ca = Math.cos(sd.rot), sa = Math.sin(sd.rot);
    for (let tier = 0; tier < 2; tier++) { const T = tier ? UP : LOW;
      for (let r = 0; r < T.rows; r += 2) { const [d, y] = seatPos(tier, r);
        for (let a = -sd.len / 2 + 0.8; a < sd.len / 2; a += 1.4) {
          const lx = d, lz = a; const wx = sd.pos[0] + lx * ca + lz * sa, wz = sd.pos[2] - lx * sa + lz * ca;
          addSeat(wx, y, wz, Math.atan2(-(wx - sd.pos[0]) * 0, 1) + sd.rot + Math.PI / 2);
        } } } });
  corners.forEach((m, i) => { const cx = m.position.x, cz = m.position.z, a0 = [0, Math.PI / 2, Math.PI, -Math.PI / 2][i];
    for (let tier = 0; tier < 2; tier++) { const T = tier ? UP : LOW;
      for (let r = 0; r < T.rows; r += 2) { const [d, y] = seatPos(tier, r); const n = Math.floor(d * Math.PI / 2 / 1.4);
        for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) / n * Math.PI / 2; addSeat(cx + Math.sin(a) * d, y, cz + Math.cos(a) * d, a + Math.PI); } } } });
  const NC = seats.length;
  const bodyM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.75, 0.4), lp.color(0xffffff, { clippingPlanes: cut.planes }), NC);
  const headM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), lp.color(0xffffff, { clippingPlanes: cut.planes }), NC);
  { const kitCols = [0xffd23f, 0xffd23f, 0x1d1d1d, 0x7b46c9, 0xffffff, 0xe5483e], skins = [0xf2c6a8, 0xd9a074, 0xb9805a, 0x8a5a3c, 0xf0c9a0], c = new THREE.Color();
    for (let i = 0; i < NC; i++) { bodyM.setColorAt(i, c.set(kitCols[Math.floor(rand(i * 1.3) * kitCols.length)])); headM.setColorAt(i, c.set(skins[Math.floor(rand(i * 2.1) * 5)])); } }
  scene.add(bodyM, headM);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  function crowd(t, fill = 1, cheer = 0, onlyKey = null) {
    let k = 0;
    for (let i = 0; i < NC; i++) {
      if (rand(i * 0.77) > fill) continue;
      const s = seats[i];
      const jump = cheer * Math.max(0, Math.sin(t * 9 + rand(i) * 6.28)) * 0.5;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.face);
      M4.compose(V.set(s.x, s.y + 0.4 + jump, s.z), Q, ONE); bodyM.setMatrixAt(k, M4);
      M4.compose(V.set(s.x, s.y + 0.98 + jump, s.z), Q, ONE); headM.setMatrixAt(k, M4);
      if (k !== i) { bodyM.setColorAt(k, new THREE.Color().fromArray(bodyM.instanceColor.array, i * 3)); headM.setColorAt(k, new THREE.Color().fromArray(headM.instanceColor.array, i * 3)); }
      k++;
    }
    bodyM.count = headM.count = k; bodyM.instanceMatrix.needsUpdate = headM.instanceMatrix.needsUpdate = true;
    if (bodyM.instanceColor) bodyM.instanceColor.needsUpdate = headM.instanceColor.needsUpdate = true;
  }
  void crowd;
  // keep original colors stable when compacting: precompute arrays
  const bodyCols = bodyM.instanceColor.array.slice(), headCols = headM.instanceColor.array.slice();
  function crowdStable(t, fill = 1, cheer = 0) {
    let k = 0;
    for (let i = 0; i < NC; i++) {
      if (rand(i * 0.77) > fill) continue;
      const s = seats[i], jump = cheer * Math.max(0, Math.sin(t * 9 + rand(i) * 6.28)) * 0.5;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.face);
      M4.compose(V.set(s.x, s.y + 0.4 + jump, s.z), Q, ONE); bodyM.setMatrixAt(k, M4);
      M4.compose(V.set(s.x, s.y + 0.98 + jump, s.z), Q, ONE); headM.setMatrixAt(k, M4);
      bodyM.instanceColor.array.set(bodyCols.subarray(i * 3, i * 3 + 3), k * 3); headM.instanceColor.array.set(headCols.subarray(i * 3, i * 3 + 3), k * 3);
      k++;
    }
    bodyM.count = headM.count = k; bodyM.instanceMatrix.needsUpdate = headM.instanceMatrix.needsUpdate = true;
    bodyM.instanceColor.needsUpdate = headM.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ cantilever roof (trusses anchored at the back) + floodlights
  const roof = new THREE.Group(); scene.add(roof);
  const steel = lp.metal(0xd9dfe5);
  const trussG = new THREE.Group();
  { const backD = D_BACK, tipD = 12, yb = Y_BACK + 2, yt = Y_BACK + 8;
    const beam = (a, b, r = 0.35) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const m = add(new THREE.Mesh(new THREE.BoxGeometry(r, r, A.distanceTo(B)), steel), trussG); m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); return m; };
    beam([backD, yt, 0], [tipD, yt - 1, 0], 0.6); beam([backD, yb, 0], [tipD, yt - 2.2, 0], 0.5);
    for (let i = 0; i <= 8; i++) { const d = lerp(backD, tipD, i / 8); beam([d, lerp(yb, yt - 2.2, i / 8), 0], [d, lerp(yt, yt - 1, i / 8), 0], 0.3); if (i < 8) beam([d, lerp(yb, yt - 2.2, i / 8), 0], [lerp(backD, tipD, (i + 1) / 8), lerp(yt, yt - 1, (i + 1) / 8), 0], 0.25); }
    beam([backD, 0, 0], [backD, yt, 0], 1.0); beam([backD + 12, 0, 0], [backD, yt, 0], 0.5);   // back column + backstay (the anchor)
  }
  const trusses = [], roofPanels = [];
  sides.forEach(sd => {
    const ca = Math.cos(sd.rot), sa = Math.sin(sd.rot);
    for (let a = -sd.len / 2 + 5; a <= sd.len / 2 - 4; a += 10) { const g = trussG.clone(); g.position.set(sd.pos[0] + a * sa, 0, sd.pos[2] + a * ca); g.rotation.y = sd.rot; roof.add(g); trusses.push({ g, key: sd.key, a }); }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(D_BACK - 11, 0.4, sd.len), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, flatShading: true, roughness: 0.4 }));
    const pd = (D_BACK + 12) / 2; panel.position.set(sd.pos[0] + pd * ca, Y_BACK + 7.4, sd.pos[2] - pd * sa); panel.rotation.y = sd.rot; panel.castShadow = true; roof.add(panel); roofPanels.push({ m: panel, key: sd.key });
  });
  const floods = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), lp.emissive(0xfff6d8, 0.0), 80); roof.add(floods);
  { let k = 0; sides.forEach(sd => { const ca = Math.cos(sd.rot), sa = Math.sin(sd.rot); for (let a = -sd.len / 2 + 4; a < sd.len / 2; a += 7) { M4.makeTranslation(sd.pos[0] + 13 * ca + a * sa, Y_BACK + 6, sd.pos[2] - 13 * sa + a * ca); floods.setMatrixAt(k++, M4); } }); floods.count = k; }
  const pitchLight = new THREE.PointLight(0xfff3dc, 0, 400, 1.0); pitchLight.position.set(0, 60, 0); scene.add(pitchLight);

  // ------------------------------------------------------------------ construction: piles, rakers, precast units, cranes
  const piles = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
    const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 32, 10), lp.color(0xb9b3a7))); p.geometry.translate(0, -16, 0); p.position.set(-HL + 4 + i * 9, -0.2, HW + 12 + j * 12); cut.add(p, capMat(0x9d978c)); piles.push(p); }
  const rig = new THREE.Group(); scene.add(rig);
  box(7, 2.2, 4.5, lp.color(0xf2b632), [0, 1.8, 0], rig); [-1.8, 1.8].forEach(z => box(8, 1.2, 1.2, lp.color(0x2f3640), [0, 0.6, z], rig));
  box(0.9, 26, 0.9, lp.color(0xf2b632), [3, 14, 0], rig);
  const auger = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20, 8), lp.metal(0x6f7a85)), rig); auger.position.set(3, 8, 0);
  const otto = makeCharacter('otto', { scale: 1.4 }); scene.add(otto);
  // rakers (sloped beams) + columns for the south stand, and the precast terrace units
  const rakers = new THREE.Group(); scene.add(rakers);
  for (let a = -HL + 2; a <= HL - 2; a += 9) {
    const g = new THREE.Group(); g.position.set(a, 0, HW); rakers.add(g);
    const r1 = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, Math.hypot(LOW.rows * ROW_D, LOW.rows * LOW.rise)), lp.color(0x9d978c)), g);
    r1.position.set(0, LOW.y0 + LOW.rows * LOW.rise / 2 - 0.9, LOW.d0 + LOW.rows * ROW_D / 2); r1.rotation.x = -Math.atan2(LOW.rise, ROW_D);
    const r2 = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, Math.hypot(UP.rows * ROW_D, UP.rows * UP.rise)), lp.color(0x9d978c)), g);
    r2.position.set(0, UP.y0 + UP.rows * UP.rise / 2 - 0.9, UP.d0 + UP.rows * ROW_D / 2); r2.rotation.x = -Math.atan2(UP.rise, ROW_D);
    [[LOW.d0 + 4, LOW.y0 + 2], [LOW.d0 + LOW.rows * ROW_D - 1, LOW.y0 + LOW.rows * LOW.rise - 1], [UP.d0 + 2, UP.y0], [UP.d0 + UP.rows * ROW_D, UP.y0 + UP.rows * UP.rise]].forEach(([d, h]) => box(1.1, h, 1.1, lp.color(0xa9a397), [0, h / 2, d], g));
  }
  const NU = 2 * (LOW.rows + UP.rows);
  const units = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 0.45, ROW_D + 0.02), lp.color(0xd8d2c4), (LOW.rows + UP.rows) * 12);
  scene.add(units);
  const unitList = [];
  for (let tier = 0; tier < 2; tier++) { const T = tier ? UP : LOW; for (let r = 0; r < T.rows; r++) for (let a = -HL + 6.5; a <= HL - 6.5; a += 9) { const [d, y] = seatPos(tier, r); unitList.push([a, y - 0.2, HW + d]); } }
  void NU;
  const crane = new THREE.Group(); crane.position.set(-10, 0, HW + 64); scene.add(crane);
  { const yel = lp.color(0xffc23a); for (let i = 0; i < 14; i++) { box(2.2, 0.25, 2.2, yel, [0, 4 + i * 5, 0], crane); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => box(0.25, 5, 0.25, yel, [x * 1.1, 1.5 + i * 5, z * 1.1], crane)); }
    box(6, 2, 6, lp.color(0x6f7a85), [0, 1, 0], crane); }
  const jib = new THREE.Group(); jib.position.y = 72; crane.add(jib);
  box(70, 1.5, 1.5, lp.color(0xffc23a), [22, 0, 0], jib); box(5, 3, 3, lp.color(0x6f7a85), [-12, 0, 0], jib); box(3, 3, 3, lp.color(0x2f7fd1), [1.5, -2, 0], jib);
  const hookLine = box(0.1, 1, 0.1, lp.color(0x333333), [0, 0, 0], scene);
  const hanging = box(9, 0.45, ROW_D, lp.color(0xd8d2c4), [0, 0, 0], scene);

  // ------------------------------------------------------------------ players + ball
  const kitA = { skin: 0xb9805a, hair: 0x1d1d1d, shirt: 0xffd23f, vest: null, pants: 0x1d1d1d, shoes: 0x111111, hat: null, mustache: false, glasses: false, hairStyle: 'short' };
  const kitB = { ...kitA, skin: 0xf0c9a0, hair: 0xc9862f, shirt: 0x7b46c9, pants: 0xffffff };
  const keeper = { ...kitA, skin: 0xd9a074, shirt: 0x3fb36a, pants: 0x1d1d1d };
  const players = [makeCharacter(kitA, { scale: 1.05 }), makeCharacter({ ...kitA, skin: 0x8a5a3c }, { scale: 1.05 }), makeCharacter(kitB, { scale: 1.05 }), makeCharacter({ ...kitB, skin: 0xd9a074 }, { scale: 1.05 }), makeCharacter(keeper, { scale: 1.05 })];
  players.forEach(p => scene.add(p));
  const nova = makeCharacter('nova'); scene.add(nova);
  const ball = add(new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.11, 1), 0.004), lp.color(0xffffff)));
  // ------------------------------------------------------------------ macro turf set (hybrid grass)
  const MAC = [0, -600, 0];
  const turf = new THREE.Group(); turf.position.set(...MAC); scene.add(turf);
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'varying vec3 vP; void main(){ float h=smoothstep(-0.5,0.8,vP.y); gl_FragColor=vec4(mix(vec3(0.42,0.62,0.4),vec3(0.62,0.82,0.98),h),1.0);} ' }));
  turf.add(backdrop);
  const sand = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), lp.color(0xd9c08a)), turf); sand.position.y = -0.25;
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.008, 0.09, 3), lp.color(0x4fb357), 2600);
  const fibres = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.3, 4), lp.color(0xf4f6f8, { emissive: 0xffffff, emissiveIntensity: 0.15 }), 180);
  { const q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 2600; i++) { e.set((rand(i) - 0.5) * 0.5, 0, (rand(i + 1) - 0.5) * 0.5); q.setFromEuler(e); M4.compose(V.set((rand(i + 2) - 0.5) * 1.5, 0.045, (rand(i + 3) - 0.5) * 1.5), q, ONE); blades.setMatrixAt(i, M4); }
    for (let i = 0; i < 180; i++) { M4.makeTranslation((rand(i + 7) - 0.5) * 1.5, -0.08, (rand(i + 8) - 0.5) * 1.5); fibres.setMatrixAt(i, M4); } }
  turf.add(blades, fibres);
  const boot = new THREE.Group(); turf.add(boot);
  box(0.12, 0.08, 0.3, lp.color(0x111111), [0, 0, 0], boot); for (let i = 0; i < 6; i++) box(0.02, 0.02, 0.02, lp.color(0xdfe5ea), [(i % 2 - 0.5) * 0.07, -0.05, -0.1 + Math.floor(i / 2) * 0.1], boot);

  // ------------------------------------------------------------------ particles, sightlines, arrows, labels
  const drops = makeParticles(ctx, { n: 700, color: 0x6fb8ff, emissive: 0x2f8ff0, emissiveIntensity: 0.4 });
  const dust = makeParticles(ctx, { n: 300, color: 0xc9a77a, emissive: 0x000000 });
  const sightMat = new THREE.MeshBasicMaterial({ color: 0x37d2ff, transparent: true, opacity: 0.85, toneMapped: false, clippingPlanes: [] });
  const sight = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), sightMat); m.renderOrder = 90; scene.add(m); return m; });
  const loads = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 3, 8).rotateX(Math.PI), lp.color(0xff8a3a, { emissive: 0xff8a3a, emissiveIntensity: 0.6 }), 60); scene.add(loads);
  const L = {
    piles: new Label(ctx, 'CONCRETE PILES', { accent: '#b9b3a7', size: 0.036 }), solid: new Label(ctx, 'FIRM GROUND', { accent: '#8a7560' }),
    rakers: new Label(ctx, 'RAKER BEAMS', { accent: '#9d978c', size: 0.036 }), units: new Label(ctx, 'PRECAST SEATING UNITS', { accent: '#d8d2c4' }),
    sight: new Label(ctx, 'SIGHTLINES', { accent: '#37d2ff', size: 0.036 }), anchor: new Label(ctx, 'ANCHORED AT THE BACK', { accent: '#ffc23a' }),
    nocol: new Label(ctx, 'NO COLUMNS IN FRONT', { accent: '#52ff9a' }),
    grass: new Label(ctx, 'GRASS', { accent: '#4fb357' }), rootzone: new Label(ctx, 'SAND ROOTZONE', { accent: '#d9c08a' }),
    gravel: new Label(ctx, 'GRAVEL + DRAINS', { accent: '#2f7fd1' }), heat: new Label(ctx, 'HEATING PIPES', { accent: '#e5483e' }),
    hybrid: new Label(ctx, 'SYNTHETIC FIBERS\nSTITCHED INTO REAL GRASS', { accent: '#f4f6f8', size: 0.032 }),
  };

  // ------------------------------------------------------------------ state
  function reset() {
    resetEnv(ctx); cut.setPlane([0, 0, -1], 900);
    soils.forEach(m => (m.visible = false)); piles.forEach(p => { p.visible = false; p.scale.y = 1; }); rig.visible = false;
    stands.visible = true; roof.visible = true; rakers.visible = false; units.visible = false; crane.visible = false; hookLine.visible = false; hanging.visible = false;
    trusses.forEach(tr => (tr.g.visible = true)); roofPanels.forEach(p => (p.m.visible = true));
    pitch.visible = true; turf.visible = false; site.visible = true; dirt.visible = false; skyc.visible = true;
    players.forEach(p => (p.visible = false)); nova.visible = false; otto.visible = false; ball.visible = false;
    floods.material.emissiveIntensity = 0; pitchLight.intensity = 0;
    heats.forEach(h => (h.material.emissiveIntensity = 0));
    sight.forEach(m => (m.visible = false)); loads.count = 0;
    goals.forEach(g => { g.net.scale.set(1, 1, 1); g.net.position.x = g.s; });
    bodyM.visible = headM.visible = true; crowdStable(0, 1, 0);
    Object.values(L).forEach(l => l.set(0));
    drops.begin(); dust.begin();
    ctx.grade.uniforms.fade.value = 0;
  }
  const finish = () => { drops.end(); dust.end(); };
  const beamBetween = (m, a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(1, A.distanceTo(B), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); };
  /** construction stage for S02..S06 (stands hidden, rakers / units / roof progressively) */
  function constructionSite() { stands.visible = false; bodyM.visible = headM.visible = false; roof.visible = false; dirt.visible = true; }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      const u = t / d;
      // attack on the east goal: pass, shot, goal; crowd erupts
      const [st, w1, df, d2, gk] = players; players.forEach(p => (p.visible = true));
      const tShot = 0.9, tGoal = 1.5;
      st.position.set(lerp(36, 40, seg(t, 0, tShot)), 0, 6); st.rotation.y = Math.PI / 2 - 0.3; st.pose({ walk: t < tShot ? t * 10 : null, armL: [-0.4, 0, -0.5], armR: t > tGoal ? [0, 0, 2.6] : [0.6, 0, 0.5], mouth: t > tGoal ? 'grin' : 'flat', blink: blinkAt(t, 1) });
      w1.position.set(30, 0, -8); w1.rotation.y = 1.2; w1.pose({ cheer: seg(t, tGoal, tGoal + 0.5), mouth: 'grin' });
      df.position.set(44, 0, 3); df.rotation.y = -Math.PI / 2; df.pose({ walk: t * 8, mouth: 'o' });
      d2.position.set(46, 0, -6); d2.rotation.y = -Math.PI / 2 + 0.4; d2.pose({ mouth: 'o' });
      gk.position.set(51.5, lerp(0, 0.6, seg(t, tShot, tGoal)), lerp(0, 2.6, seg(t, tShot, tGoal))); gk.rotation.set(lerp(0, 0.9, seg(t, tShot, tGoal)), -Math.PI / 2, 0); gk.pose({ armL: [0, 0, -2.6], armR: [0, 0, 2.6], mouth: 'o' });
      ball.visible = true;
      if (t < tShot) ball.position.set(lerp(36.6, 40.6, seg(t, 0, tShot)), 0.11, 6.2);
      else { const k = seg(t, tShot, tGoal, x => x); ball.position.set(lerp(40.6, 53.4, k), 0.11 + Math.sin(Math.PI * k) * 1.2 + k * 0.9, lerp(6.2, -2.4, k)); }
      goals[1].net.scale.x = 1 + 0.35 * seg(t, tGoal, tGoal + 0.15) * (1 - seg(t, tGoal + 0.15, tGoal + 0.8));
      crowdStable(t, 1, seg(t, tGoal, tGoal + 0.3));
      set(path([[0, P([30, 1.6, 14], [44, 1.4, 2], 40)], [tGoal + 0.2, P([33, 2.2, 15], [48, 1.6, 0], 40)], [d, P([-40, 85, 170], [10, 0, 0], 40)]], t));
      aimSun(ctx.studio, [0, 0, 0], 140);
      finish();
    },
    S02(t, d) {
      const u = t / d;
      constructionSite(); pitch.visible = false; soils.forEach(m => (m.visible = true)); rig.visible = true;
      cut.setPlane([0, 0, -1], lerp(200, HW + 24, seg(u, 0.35, 0.55)));
      const n = Math.floor(piles.length * seg(u, 0.05, 0.95, x => clamp(x)));
      piles.forEach((p, i) => { p.visible = i < n; p.scale.y = i === n - 1 ? 0.3 + 0.7 * ((u * piles.length * 1.1) % 1) : 1; });
      const cur = piles[Math.max(0, n - 1)];
      rig.position.set(cur.position.x - 3, 0, cur.position.z + 0.01); auger.rotation.y = t * 12; auger.position.y = 8 - 6 * ((t * 1.3) % 1);
      dust.emit(t, 60, { origin: [cur.position.x, 0.3, cur.position.z], vel: [0, 2.5, 0], spread: [3, 0.2, 3], life: 1.4, size: 0.4, gravity: 2, seed: 3 });
      otto.visible = true; otto.position.set(cur.position.x - 12, 0, cur.position.z - 8); otto.rotation.y = 0.9; otto.pose({ point: 1, blink: blinkAt(t, 3), mouth: 'grin' });
      set(path([[0, P([60, 40, 150], [0, 0, 50], 40)], [0.5 * d, P([25, 6, 140], [0, -14, 50], 40)], [d, P([20, -6, 130], [0, -18, 50], 40)]], t));
      L.piles.set(seg(u, 0.55, 0.65), [-HL + 22, -14, HW + 24.5], [-0.85, 0.45]);
      L.solid.set(seg(u, 0.7, 0.8), [0, -40, HW + 24.5], [-0.85, -0.42]);
      aimSun(ctx.studio, [0, 0, 50], 120);
      finish();
    },
    S03(t, d) {
      const u = t / d;
      constructionSite(); soils.forEach(m => (m.visible = true)); piles.forEach(p => (p.visible = true));
      stands.visible = true; sideMeshes.S.material.transparent = false;
      cut.setPlane([0, 0, -1], HW + 24);
      const k = seg(u, 0.1, 0.4); let n = 0;
      piles.forEach((p, i) => { if (Math.abs(p.position.z - (HW + 24)) > 1 && Math.abs(p.position.z - (HW + 12)) > 1) return; const s = (0.6 + 0.4 * Math.sin(t * 5 - i)) * k; M4.compose(V.set(p.position.x, -33 - ((t * 6 + i) % 6), p.position.z + 1.5), Q.identity(), new THREE.Vector3(s, s, s)); loads.setMatrixAt(n++, M4); });
      loads.count = n; loads.instanceMatrix.needsUpdate = true;
      set(path([[0, P([30, 10, 160], [0, -8, 50], 40)], [d, P([15, -4, 140], [0, -16, 50], 40)]], t));
      aimSun(ctx.studio, [0, 0, 50], 120);
      finish();
    },
    S04(t, d) {
      const u = t / d;
      constructionSite(); rakers.visible = true; units.visible = true; crane.visible = true;
      const total = unitList.length, placed = Math.floor(total * seg(u, 0.05, 0.98, x => clamp(x)));
      for (let i = 0; i < total; i++) { const [x, y, z] = unitList[i]; M4.makeTranslation(x, i < placed ? y : -999, z); units.setMatrixAt(i, M4); }
      units.count = total; units.instanceMatrix.needsUpdate = true;
      const nxt = unitList[Math.min(total - 1, placed)], f = (u * total * 1.05) % 1;
      const hy = lerp(nxt[1] + 14, nxt[1], seg(f, 0.2, 0.9));
      hanging.visible = true; hanging.position.set(nxt[0], hy, nxt[2]);
      hookLine.visible = true; beamBetween(hookLine, [nxt[0], 71, nxt[2]], [nxt[0], hy + 0.3, nxt[2]]);
      jib.rotation.y = Math.atan2(-(nxt[2] - crane.position.z), nxt[0] - crane.position.x);
      otto.visible = true; otto.position.set(20, 0, HW + 2); otto.rotation.y = 2.6; otto.pose({ point: 0.8, blink: blinkAt(t, 3), head: [-0.3, 0, 0] });
      set(path([[0, P([80, 30, 10], [0, 12, HW + 20], 40)], [d, P([-60, 45, 0], [0, 14, HW + 22], 40)]], t, x => x));
      L.rakers.set(seg(u, 0.15, 0.25), [-HL + 2 + 9 * 5, 8, HW + 16], [-0.85, 0.5]);
      L.units.set(seg(u, 0.45, 0.55), [nxt[0], hy, nxt[2]], [-0.2, -0.38]);
      aimSun(ctx.studio, [0, 10, 60], 120);
      finish();
    },
    S05(t, d) {
      const u = t / d;
      cut.setPlane([-1, 0, 0], 0.5);       // section across the south stand
      crowdStable(t, 1, 0);
      const eyes = []; for (let r = 2; r < LOW.rows; r += 4) { const [dd, y] = seatPos(0, r); eyes.push([0.2, y + 1.0, HW + dd]); }
      for (let r = 2; r < UP.rows; r += 8) { const [dd, y] = seatPos(1, r); eyes.push([0.2, y + 1.0, HW + dd]); }
      const focus = [0.2, 0.2, HW - 1.5];
      sight.forEach((m, i) => { const e = eyes[i]; if (!e) return; const k = seg(u, 0.1 + i * 0.06, 0.25 + i * 0.06); m.visible = k > 0;
        beamBetween(m, e, [lerp(e[0], focus[0], k), lerp(e[1], focus[1], k), lerp(e[2], focus[2], k)]); });
      nova.visible = true; const [nd, ny] = seatPos(0, 10); nova.position.set(-0.6, ny + 0.05, HW + nd); nova.rotation.y = Math.PI; nova.pose({ mouth: 'grin', blink: blinkAt(t, 2) });
      set(path([[0, P([46, 12, HW + 22], [0, 10, HW + 22], 40)], [d, P([40, 14, HW + 24], [0, 12, HW + 24], 40)]], t));
      L.sight.set(seg(u, 0.4, 0.5), [0.2, 8, HW + 12], [-0.85, 0.5]);
      aimSun(ctx.studio, [0, 10, HW + 20], 60);
      finish();
    },
    S06(t, d) {
      const u = t / d;
      crowdStable(t, 0, 0); bodyM.visible = headM.visible = false;
      const visibleTrusses = Math.floor(trusses.length * seg(u, 0.0, 0.55, x => clamp(x)));
      trusses.forEach((tr, i) => { tr.g.visible = i < visibleTrusses; tr.g.position.y = 0; });
      roofPanels.forEach((p, i) => (p.m.visible = u > 0.55 + i * 0.03));
      if (u > 0.6) cut.setPlane([-1, 0, 0], 5.5);
      const c = [0, Y_BACK, HW + 30];
      set(path([[0, P([0, 3, 0], [0, 30, HW + 30], 46)], [0.55 * d, P([-10, 4, 8], [0, 34, HW + 30], 46)], [d, P([60, 30, HW + 30], [0, 22, HW + 30], 40)]], t));
      L.anchor.set(seg(u, 0.7, 0.8), [5, 20, HW + D_BACK], [-0.85, 0.45]);
      L.nocol.set(seg(u, 0.78, 0.88), [5, 30, HW + 16], [-0.85, -0.3]);
      void c;
      aimSun(ctx.studio, [0, 20, HW + 30], 90);
      finish();
    },
    S07(t, d) {
      const u = t / d;
      const xc = 30;                                          // section across the pitch: pipes appear as circles
      cut.setPlane([-1, 0, 0], lerp(HL + 6, xc, seg(u, 0.0, 0.15)));
      bodyM.visible = headM.visible = false;
      const zc = 16;                                          // a drain runs at z = 16
      drops.emit(t, 220, { origin: [xc - 2, 5, zc], vel: [0, -9, 0], spread: [3, 0.5, 6], life: 0.7, size: 0.035, seed: 1, minY: 0.02 });
      drops.emit(t, 160, { origin: [xc - 0.05, -0.03, zc], vel: [0, -0.55, 0], spread: [0.05, 0.05, 5], life: 0.85, size: 0.03, seed: 9, minY: -0.5 });
      drops.emit(t, 50, { origin: [xc - 0.05, -0.38, zc], vel: [0, -0.1, 0], spread: [0.05, 0.02, 0.6], life: 1.2, size: 0.03, seed: 13 });
      const hk = seg(u, 0.65, 0.75); heats.forEach(h => (h.material.emissiveIntensity = 0.9 * hk));
      set(path([[0, P([xc + 8, 3, zc + 2], [xc, 0, zc], 40)], [0.2 * d, P([xc + 3.2, 0.3, zc + 0.6], [xc, -0.4, zc], 40)], [d, P([xc + 2.6, 0.2, zc + 0.3], [xc, -0.42, zc], 40)]], t));
      L.grass.set(seg(u, 0.2, 0.28), [xc + 0.01, -0.03, zc - 1.2], [-0.85, 0.48]);
      L.rootzone.set(seg(u, 0.3, 0.38), [xc + 0.01, -0.2, zc - 1.0], [-0.85, 0.3]);
      L.gravel.set(seg(u, 0.42, 0.5), [xc + 0.01, -0.5, zc], [-0.85, -0.3]);
      L.heat.set(seg(u, 0.66, 0.74), [xc + 0.01, -0.26, zc + 1], [0.0, 0.45]);
      aimSun(ctx.studio, [xc, 0, zc], 20);
      finish();
    },
    S08(t, d) {
      const u = t / d;
      turf.visible = true; pitch.visible = false; site.visible = false; stands.visible = false; roof.visible = false; bodyM.visible = headM.visible = false; skyc.visible = false;
      cut.setPlane([0, 0, -1], MAC[2] + 0.05);
      const stomp = seg(u, 0.35, 0.45) * (1 - seg(u, 0.6, 0.75));
      boot.position.set(0.15, lerp(0.6, 0.1, stomp), 0.1);
      fibres.material.emissiveIntensity = 0.15 + 0.6 * seg(u, 0.5, 0.65);
      const c = MAC;
      set(path([[0, P([c[0] + 0.6, c[1] + 0.5, c[2] + 1.6], [c[0], c[1], c[2]], 40)], [d, P([c[0] + 0.3, c[1] + 0.1, c[2] + 0.9], [c[0], c[1] - 0.05, c[2]], 40)]], t));
      L.hybrid.set(seg(u, 0.55, 0.65), [c[0] - 0.2, c[1] - 0.1, c[2] + 0.06], [-0.85, 0.5]);
      aimSun(ctx.studio, c, 4);
      finish();
    },
    S09(t, d) {
      const u = t / d;
      goldenHour(ctx, 0.75); ctx.studio.sun.intensity = 1.3;
      const on = seg(u, 0.05, 0.3); floods.material.emissiveIntensity = 2.5 * on; pitchLight.intensity = 500 * on;
      crowdStable(t, seg(u, 0.1, 0.6, x => clamp(x)), seg(u, 0.7, 0.8));
      players.forEach((p, i) => { p.visible = u > 0.5; p.position.set(-6 + (i % 3) * 6, 0, -6 + Math.floor(i / 3) * 10); p.rotation.y = i < 2 ? -Math.PI / 2 : Math.PI / 2; p.pose({ walk: t * 7 + i, mouth: 'grin' }); });
      ball.visible = u > 0.5; ball.position.set(0, 0.11, 0);
      set(path([[0, P([0, 2, 22], [0, 20, -40], 44)], [0.45 * d, P([20, 18, 60], [0, 5, 0], 40)], [d, P([-150, 140, 300], [0, 0, 0], 40)]], t));
      aimSun(ctx.studio, [0, 0, 0], 160);
      finish();
    },
  };
  return { reset, scenes };
}

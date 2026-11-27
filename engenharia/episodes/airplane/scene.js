// EPISODE — How can a 300-ton airplane stay in the air? (low-poly style)
// Units: meters. Aircraft nose = +x, right wing = +z, up = +y. The aircraft flies along +x.
import { makeCloudSea, makeParticles, resetEnv, goldenHour, skyClouds } from '/engine/env.js';
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, applyPose, rand, csg, brush } = kit;
  const { lp, makeCharacter, blinkAt, aimSun, tree } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 34) => ({ pos, look, fov });
  const add = (m, parent) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7, side: THREE.DoubleSide });
  cut.capSize = 300;

  // ------------------------------------------------------------------ airfoils + loft
  function naca(m, p, t) { // returns (x 0..1) -> [yUpper, yLower] (chord-normalized)
    return x => {
      const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
      return [yc + yt, yc - yt];
    };
  }
  const WING_AF = naca(0.04, 0.4, 0.13), TAIL_AF = naca(0, 0.3, 0.1);
  const NX = 16, xs = Array.from({ length: NX + 1 }, (_, i) => 0.5 - 0.5 * Math.cos(Math.PI * i / NX)); // cosine spacing
  /** closed loft between airfoil stations. st = [{le:[x,y,z], chord, twist}], span axis 'z' or 'y' */
  function loft(af, st, axis = 'z') {
    const ring = s => {
      const pts = [];
      for (let i = NX; i >= 0; i--) { const [yu] = af(xs[i]); pts.push([xs[i], yu]); }
      for (let i = 1; i < NX; i++) { const [, yl] = af(xs[i]); pts.push([xs[i], yl]); }
      return pts.map(([x, y]) => axis === 'z' ? [s.le[0] - x * s.chord, s.le[1] + y * s.chord, s.le[2]] : [s.le[0] - x * s.chord, s.le[1], s.le[2] + y * s.chord]);
    };
    const rings = st.map(ring), n = rings[0].length;
    const pos = [];
    const tri = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
      const a = rings[k][i], b = rings[k][(i + 1) % n], c = rings[k + 1][(i + 1) % n], d = rings[k + 1][i];
      tri(a, b, c); tri(a, c, d);
    }
    [0, rings.length - 1].forEach((k, e) => { const r = rings[k]; const c = r.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]);
      for (let i = 0; i < n; i++) e ? tri(c, r[i], r[(i + 1) % n]) : tri(c, r[(i + 1) % n], r[i]); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // make winding consistent (outward) by checking signed volume
    let vol = 0; for (let i = 0; i < pos.length; i += 9) { const a = new THREE.Vector3(...pos.slice(i, i + 3)), b = new THREE.Vector3(...pos.slice(i + 3, i + 6)), c = new THREE.Vector3(...pos.slice(i + 6, i + 9)); vol += a.dot(b.cross(c)); }
    if (vol < 0) { g.index = null; const p2 = g.attributes.position.array; for (let i = 0; i < p2.length; i += 9) for (let j = 0; j < 3; j++) { const t = p2[i + 3 + j]; p2[i + 3 + j] = p2[i + 6 + j]; p2[i + 6 + j] = t; } g.computeVertexNormals(); }
    return g;
  }
  const mirrorZ = g => { const m = g.clone(); m.scale(1, 1, -1); const p = m.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; } m.computeVertexNormals(); return m; };

  // ------------------------------------------------------------------ airliner
  const plane = new THREE.Group(); scene.add(plane);
  const white = lp.color(0xf4f6f8, { roughness: 0.45 }), grayB = lp.color(0xc9d0d7), teal = lp.color(0x1fa3a3), yellow = lp.color(0xffc23a), dark = lp.color(0x1d2733);
  const fr = x => x > 22 ? 3 * Math.sqrt(Math.max(0, 1 - ((x - 22) / 8) ** 2)) : x > -16 ? 3 : 0.4 + 2.6 * Math.pow((x + 30) / 14, 0.9);
  const latPts = [new THREE.Vector2(0, -30)]; for (let i = 0; i <= 70; i++) { const x = -30 + 60 * i / 70; latPts.push(new THREE.Vector2(Math.max(0.05, fr(x)), x)); } latPts.push(new THREE.Vector2(0, 30));
  const fusGeo = new THREE.LatheGeometry(latPts, 24); fusGeo.rotateZ(-Math.PI / 2);
  const fus = add(new THREE.Mesh(fusGeo, white), plane);
  cut.add(fus, capMat(0xd9dfe5));
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.02, 3.02, 30, 24, 1, true, Math.PI * 0.75, Math.PI * 0.5).rotateZ(-Math.PI / 2), grayB), plane).position.set(3, 0, 0);
  // windows + cockpit
  const winGeo = new THREE.BoxGeometry(0.45, 0.6, 0.1);
  const wins = new THREE.InstancedMesh(winGeo, lp.color(0x1d2733, { clippingPlanes: cut.planes }), 80); plane.add(wins);
  { const m4 = new THREE.Matrix4(); let k = 0; for (let i = 0; i < 40; i++) [-1, 1].forEach(s => { m4.makeTranslation(18 - i * 0.95, 0.9, s * 2.97); wins.setMatrixAt(k++, m4); }); }
  [-1, 1].forEach(s => { const w = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.6), dark), plane); w.position.set(27.2, 1.15, s * 1.0); w.rotation.y = s * 0.5; });
  // wings (real airfoil loft: sweep, taper, dihedral) + winglets
  const wingR = loft(WING_AF, [{ le: [8, -1.2, 2.6], chord: 10 }, { le: [-1, -0.2, 14], chord: 6.5 }, { le: [-10.5, 1.2, 31], chord: 2.6 }]);
  const wingRm = add(new THREE.Mesh(wingR, white), plane), wingLm = add(new THREE.Mesh(mirrorZ(wingR), white), plane);
  cut.add(wingRm, capMat(0x7f8b99)); cut.add(wingLm, capMat(0x7f8b99));
  [-1, 1].forEach(s => { const wl = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.25), teal), plane); wl.position.set(-11.5, 2.6, s * 31); wl.rotation.z = -0.35; });
  // tail
  const hstab = loft(TAIL_AF, [{ le: [-21, 1, 1.5], chord: 6 }, { le: [-27, 1.6, 11], chord: 2.4 }]);
  add(new THREE.Mesh(hstab, white), plane); add(new THREE.Mesh(mirrorZ(hstab), white), plane);
  const fin = loft(TAIL_AF, [{ le: [-19, 2.5, 0], chord: 8 }, { le: [-27.5, 12, 0], chord: 3.2 }], 'y');
  add(new THREE.Mesh(fin, teal), plane);
  add(new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.6, 0.62), yellow), plane).position.set(-24.5, 7.5, 0);
  // engines (nacelle shell + fan + core), one under each wing
  function engine(zc) {
    const g = new THREE.Group(); g.position.set(5.5, -3.2, zc); plane.add(g);
    const nac = csg(brush(new THREE.CylinderGeometry(1.75, 1.45, 6.2, 24).rotateZ(-Math.PI / 2)), [['-', brush(new THREE.CylinderGeometry(1.5, 1.2, 7, 24).rotateZ(-Math.PI / 2))]]);
    const nm = add(new THREE.Mesh(nac, lp.color(0xdfe5ea)), g); cut.add(nm, capMat(0xb8c1cb));
    add(new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.14, 8, 24).rotateY(Math.PI / 2), teal), g).position.x = 3.1;
    const fan = new THREE.Group(); fan.position.x = 2.3; g.add(fan);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 14).rotateZ(-Math.PI / 2), lp.metal(0xbfc8d0)), fan).position.x = 0.45;
    for (let i = 0; i < 18; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.42), lp.metal(0x6f7a85)), fan); b.geometry.translate(0, 0.78, 0); b.rotation.x = i / 18 * Math.PI * 2; b.rotation.y = 0.5; }
    // core: compressor discs, combustor ring, turbine discs, exhaust cone (visible in the section)
    const core = new THREE.Group(); g.add(core);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 4.6, 16, 1, true).rotateZ(-Math.PI / 2), lp.metal(0x8d98a5, { side: THREE.DoubleSide })), core).position.x = -0.4;
    for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.68 - i * 0.04, 0.68 - i * 0.04, 0.12, 14).rotateZ(-Math.PI / 2), lp.metal(0x5d6873)), core).position.x = 1.4 - i * 0.35;
    const comb = add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 8, 20).rotateY(Math.PI / 2), lp.emissive(0xff7a1a, 1.6)), core); comb.position.x = -0.6;
    for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14).rotateZ(-Math.PI / 2), lp.metal(0x7a5c3a)), core).position.x = -1.3 - i * 0.35;
    add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 14).rotateZ(Math.PI / 2), lp.metal(0x6f7a85)), core).position.x = -3.3;
    add(new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 0.5), lp.color(0xdfe5ea)), plane).position.set(4, -1.8, zc); // pylon
    return { g, fan, comb };
  }
  const engR = engine(10.5), engL = engine(-10.5);
  // landing gear
  const gear = new THREE.Group(); plane.add(gear);
  [[20, 0], [-1, 3.5], [-1, -3.5]].forEach(([x, z]) => { add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), lp.metal(0x8d98a5)), gear).position.set(x, -3.6, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12).rotateX(Math.PI / 2), dark), gear).position.set(x, -4.8, z); });
  const otto = makeCharacter('otto', { scale: 0.75 }); otto.position.set(25.5, -0.4, 0.9); otto.rotation.y = Math.PI / 2; plane.add(otto);

  // ------------------------------------------------------------------ worlds: cloud sea + airport
  const SKY_Y = 80;
  const clouds = makeCloudSea(ctx, { y: 0, radius: 1100, count: 280 });
  const airport = new THREE.Group(); scene.add(airport); airport.position.set(0, -2000, 0);
  { const g = airport;
    add(new THREE.Mesh(new THREE.CircleGeometry(1600, 48).rotateX(-Math.PI / 2), lp.color(0x7cc95a)), g);
    add(new THREE.Mesh(new THREE.BoxGeometry(2200, 0.3, 50), lp.color(0x4f555c)), g).position.set(400, 0.15, 0);
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 0.32, 1.2), lp.color(0xffffff), 90); g.add(dash);
    const m4 = new THREE.Matrix4(); for (let i = 0; i < 90; i++) { m4.makeTranslation(-600 + i * 24, 0.2, 0); dash.setMatrixAt(i, m4); }
    for (let i = 0; i < 8; i++) add(new THREE.Mesh(new THREE.BoxGeometry(60, 14 + rand(i) * 10, 40), lp.color([0xdfe5ea, 0xa9c7e8, 0xf4e1a1][i % 3])), g).position.set(-300 + i * 90, 8, -150);
    add(new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 50, 8), lp.color(0xdfe5ea)), g).position.set(100, 25, -120);
    for (let i = 0; i < 60; i++) { const t = tree(i, 8 + rand(i) * 5); t.position.set(-800 + rand(i + 3) * 2400, 0, (rand(i + 5) > 0.5 ? 1 : -1) * (90 + rand(i + 7) * 400)); g.add(t); }
  }
  const groundClouds = skyClouds(ctx, { n: 10, y: 160, spread: 1600, scale: 14 }); groundClouds.position.y = -2000;

  // ------------------------------------------------------------------ airfoil flow visualization (in the section plane)
  const SEC_Z = 12.5;                                     // spanwise section station on the right wing
  // local chord frame at the section: interpolate between wing stations 0 and 1
  const s01 = (SEC_Z - 2.6) / (14 - 2.6);
  const SEC = { le: [lerp(8, -1, s01), lerp(-1.2, -0.2, s01)], chord: lerp(10, 6.5, s01) };
  const flowPts = (h) => { // streamline at height h (chord units) relative to chord line, from -0.8c to 1.8c
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = -0.8 + 2.6 * i / 60;
      const inC = x >= 0 && x <= 1;
      const [yu, yl] = WING_AF(clamp(x, 0, 1));
      const env = Math.exp(-Math.abs(h) * 2.2);
      let y = h;
      if (h >= 0) y += inC ? yu * 1.0 * (0.55 + 0.45 * (1 - Math.min(1, h * 3))) + env * 0.04 : 0;
      else y += inC ? yl * env : 0;
      y += env * (x < 0 ? 0.06 * Math.exp(x * 4) : 0);           // upwash ahead of the leading edge
      if (x > 0.7) y -= env * 0.22 * (x - 0.7);                     // downwash behind the trailing edge
      pts.push(new THREE.Vector3(SEC.le[0] - x * SEC.chord, SEC.le[1] + y * SEC.chord, SEC_Z + 0.25));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const streams = [-0.5, -0.32, -0.18, -0.08, 0.08, 0.16, 0.28, 0.45, 0.65].map(h => ({ h, curve: flowPts(h) }));
  const streamLines = new THREE.Group(); plane.add(streamLines);
  streams.forEach(s => { const m = new THREE.Mesh(new THREE.TubeGeometry(s.curve, 80, 0.035, 4), new THREE.MeshBasicMaterial({ color: s.h > 0 ? 0x8fd8ff : 0xffc39a, transparent: true, opacity: 0.55, toneMapped: false })); streamLines.add(m); });
  // pressure regions (low above = blue, high below = orange), flat shapes in the section plane
  function regionShape(top) {
    const s = new THREE.Shape(); const n = 30;
    for (let i = 0; i <= n; i++) { const x = i / n; const [yu, yl] = WING_AF(x); const y = top ? yu : yl; const px = SEC.le[0] - x * SEC.chord, py = SEC.le[1] + y * SEC.chord; i ? s.lineTo(px, py) : s.moveTo(px, py); }
    for (let i = n; i >= 0; i--) { const x = i / n; const [yu, yl] = WING_AF(x); const bulge = Math.sin(Math.PI * Math.pow(x, 0.6)) * (top ? 0.32 : -0.16); const y = (top ? yu : yl) + bulge; s.lineTo(SEC.le[0] - x * SEC.chord, SEC.le[1] + y * SEC.chord); }
    return s;
  }
  const lowP = new THREE.Mesh(new THREE.ShapeGeometry(regionShape(true)), new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const highP = new THREE.Mesh(new THREE.ShapeGeometry(regionShape(false)), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  lowP.position.z = highP.position.z = SEC_Z + 0.2; plane.add(lowP, highP);

  // ------------------------------------------------------------------ particles + arrows + labels
  const streaks = makeParticles(ctx, { n: 900, color: 0xffffff, emissive: 0xcfefff, emissiveIntensity: 0.9 });
  const hot = makeParticles(ctx, { n: 300, color: 0xffa14a, emissive: 0xff7a1a, emissiveIntensity: 1.2 });
  const arrows = { lift: kit.parts.arrow(0x52ff9a, 0.5), weight: kit.parts.arrow(0xff4d4d, 0.5), thrust: kit.parts.arrow(0x37d2ff, 0.4) };
  Object.values(arrows).forEach(a => plane.add(a));
  arrows.weight.rotation.z = Math.PI; arrows.thrust.rotation.z = -Math.PI / 2;
  const L = {
    low: new Label(ctx, 'LOW PRESSURE', { accent: '#3aa0ff' }), high: new Label(ctx, 'HIGH PRESSURE', { accent: '#ff8a3a' }),
    lift: new Label(ctx, 'LIFT', { accent: '#52ff9a', size: 0.038 }), weight: new Label(ctx, 'WEIGHT', { accent: '#ff4d4d' }),
    profile: new Label(ctx, 'AIRFOIL PROFILE', { accent: '#e7ecf1' }), thrust: new Label(ctx, 'THRUST', { accent: '#37d2ff', size: 0.036 }),
    bypass: new Label(ctx, 'BYPASS AIR', { accent: '#8fd8ff' }), core: new Label(ctx, 'COMBUSTION', { accent: '#ff7a1a' }),
    speed: new Label(ctx, 'SPEED ↑  LIFT ↑', { accent: '#52ff9a', size: 0.036 }), off: new Label(ctx, 'ENGINES OFF', { accent: '#ff4d4d', size: 0.036 }),
    glide: new Label(ctx, '≈ 15 m FORWARD\nFOR EVERY 1 m DOWN', { accent: '#ffc23a', size: 0.036 }),
  };
  const toWorldPlane = v => plane.localToWorld(v);

  // ------------------------------------------------------------------ state
  function reset() {
    resetEnv(ctx); cut.setPlane([0, 0, -1], 500);
    plane.position.set(0, SKY_Y, 0); plane.rotation.set(0, 0, 0); plane.visible = true;
    gear.visible = false; streamLines.visible = false; lowP.visible = highP.visible = false;
    Object.values(arrows).forEach(a => { a.setOpacity(0); a.scale.setScalar(1); });
    Object.values(L).forEach(l => l.set(0));
    clouds.visible = true; fus.visible = wins.visible = otto.visible = true;
    engR.comb.material.emissiveIntensity = engL.comb.material.emissiveIntensity = 1.6;
    streaks.begin(); hot.begin();
    ctx.grade.uniforms.fade.value = 0;
  }
  function spin(t, rate = 9) { engR.fan.rotation.x = engL.fan.rotation.x = -t * rate; }
  function finish(t) { otto.pose({ blink: blinkAt(t, 3), armL: [-1.2, 0, -0.3], armR: [-1.2, 0, 0.3] }); streaks.end(); hot.end(); }
  /** relative airflow streaks around the whole aircraft (plane-local), speed = visual speed */
  function airflow(t, n, speed = 60, zone = [40, 14, 70]) {
    for (let i = 0; i < n; i++) {
      const life = 1.2, age = (t + rand(i) * life) % life;
      const v = new THREE.Vector3(40 - age * speed * (0.8 + 0.4 * rand(i + 3)), (rand(i + 5) - 0.5) * zone[1] + 1, (rand(i + 7) - 0.5) * zone[2]);
      if (Math.abs(v.z) < 32 && Math.abs(v.y) < 1.5 && v.x > -12 && v.x < 9) v.y += Math.sign(v.y || 1) * 1.2; // part around the wing
      plane.localToWorld(v);
      streaks.put(v, 0.07, new THREE.Vector3(-3.5, 0, 0));
    }
  }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      const u = t / d;
      plane.position.set(70 * t, SKY_Y, 0); spin(t);
      const x = plane.position.x;
      set(path([[0, P([x + 70, SKY_Y - 8, 46], [x, SKY_Y + 1, 0], 38)], [d, P([x + 22, SKY_Y - 4, 66], [x - 2, SKY_Y + 1, 0], 38)]], t));
      airflow(t, 120, 90);
      aimSun(ctx.studio, [x, SKY_Y, 0], 60);
      finish(t);
    },
    S02(t, d) {
      plane.position.set(70 * (t + 5), SKY_Y, 0); spin(t);
      const x = plane.position.x;
      set(path([[0, P([x - 13, SKY_Y - 3.2, 5], [x - 4, SKY_Y + 0.8, 22], 42)], [d, P([x - 12, SKY_Y - 3.0, 7], [x - 5, SKY_Y + 0.8, 24], 42)]], t));
      // dense streaks over and under the wing surface
      for (let i = 0; i < 260; i++) {
        const life = 0.7, age = (t + rand(i) * life) % life, zz = 4 + rand(i + 1) * 26;
        const s = (zz - 2.6) / (31 - 2.6), le = lerp(8, -10.5, s), ch = lerp(10, 2.6, s), up = rand(i + 2) > 0.45;
        const xx = le + 4 - age * (ch + 9) / life * 0.9, cx = clamp((le - xx) / ch, 0, 1);
        const [yu, yl] = WING_AF(cx);
        const y = lerp(-1.2, 1.2, s) + (up ? yu * ch + 0.15 + rand(i + 4) * 0.5 : yl * ch - 0.15 - rand(i + 4) * 0.5);
        streaks.put(plane.localToWorld(new THREE.Vector3(xx, y, zz)), 0.05, new THREE.Vector3(-(up ? 1.6 : 1.1), 0, 0));
      }
      aimSun(ctx.studio, [x, SKY_Y, 15], 30);
      finish(t);
    },
    S03(t, d) {
      const u = t / d;
      plane.position.set(0, SKY_Y, 0); spin(t);
      clouds.visible = u < 0.18; arrows.lift.scale.setScalar(0.45); arrows.weight.scale.setScalar(0.45);
      fus.visible = wins.visible = otto.visible = u < 0.2;
      cut.setPlane([0, 0, -1], lerp(40, SEC_Z, seg(u, 0.0, 0.2)));
      streamLines.visible = u > 0.22; lowP.visible = highP.visible = u > 0.4;
      lowP.material.opacity = 0.35 * seg(u, 0.4, 0.5); highP.material.opacity = 0.4 * seg(u, 0.46, 0.56);
      // particles travelling along the streamlines (faster above)
      streams.forEach((s, j) => { for (let i = 0; i < 14; i++) { const sp = s.h > 0 ? 0.42 : 0.3; const k = ((t * sp + i / 14 + rand(j) * 0.1) % 1); const p = s.curve.getPointAt(k); plane.localToWorld(p); streaks.put(p, 0.09, new THREE.Vector3(-0.6, 0, 0)); } });
      arrows.lift.setOpacity(seg(u, 0.6, 0.7)); arrows.lift.position.set(SEC.le[0] - SEC.chord * 0.3, SEC.le[1] + 1.5, SEC_Z + 0.4); arrows.lift.setLength((2 + 5 * seg(u, 0.6, 0.85)) / 0.45);
      arrows.weight.setOpacity(seg(u, 0.68, 0.76)); arrows.weight.position.set(SEC.le[0] - SEC.chord * 0.62, SEC.le[1] - 1.2, SEC_Z + 0.4); arrows.weight.setLength(4.5 / 0.45);
      const c = [SEC.le[0] - SEC.chord * 0.45, SKY_Y + SEC.le[1], SEC_Z];
      set(path([[0, P([c[0] + 18, c[1] + 6, c[2] + 26], [c[0], c[1], c[2] - 2], 36)], [0.25 * d, P([c[0] + 1, c[1] + 1.5, c[2] + 22], [c[0], c[1], c[2]], 34)], [d, P([c[0] + 0.5, c[1] + 1.2, c[2] + 19], [c[0], c[1] + 0.6, c[2]], 34)]], t));
      L.profile.set(seg(u, 0.18, 0.26) * (1 - seg(u, 0.38, 0.42)), [c[0], c[1] - 0.2, c[2] + 0.3], [-0.6, -0.35]);
      L.low.set(seg(u, 0.44, 0.52), [c[0], c[1] + 1.4, c[2] + 0.3], [-0.85, 0.45]);
      L.high.set(seg(u, 0.5, 0.58), [c[0] + 0.5, c[1] - 0.8, c[2] + 0.3], [-0.85, -0.4]);
      L.lift.set(seg(u, 0.65, 0.73), [SEC.le[0] - SEC.chord * 0.3, SKY_Y + SEC.le[1] + 6.5, SEC_Z + 0.4], [0.2, 0.6]);
      L.weight.set(seg(u, 0.72, 0.8), [SEC.le[0] - SEC.chord * 0.62, SKY_Y + SEC.le[1] - 5.7, SEC_Z + 0.4], [0.2, -0.45]);
      aimSun(ctx.studio, c, 20);
      finish(t);
    },
    S04(t, d) {
      const u = t / d;
      plane.position.set(0, SKY_Y, 0); spin(t, 14);
      clouds.visible = u > 0.62;
      cut.setPlane([0, 0, -1], -10.5);               // through the left engine axis
      const e = [5.5, SKY_Y - 3.2, -10.5];
      // bypass (blue) around the core, hot core flow (orange) out of the nozzle
      for (let i = 0; i < 160; i++) { const life = 0.5, age = (t + rand(i) * life) % life, a = rand(i + 3) * Math.PI * 2, r = 0.85 + rand(i + 5) * 0.55;
        const x = 3.5 - age * 22; const rr = x < -0.5 ? r + (x + 0.5) * -0.02 : r;
        streaks.put(new THREE.Vector3(e[0] + x, e[1] + Math.cos(a) * rr, e[2] + Math.sin(a) * rr * 0.5 + 0.2), 0.05, new THREE.Vector3(-1.2, 0, 0)); }
      for (let i = 0; i < 120; i++) { const life = 0.45, age = (t + rand(i + 50) * life) % life, a = rand(i + 9) * Math.PI * 2, r = rand(i + 11) * 0.4;
        hot.put(new THREE.Vector3(e[0] - 0.6 - age * 24, e[1] + Math.cos(a) * r, e[2] + Math.sin(a) * r * 0.5 + 0.2), 0.07 + age * 0.1, new THREE.Vector3(-1.0, 0, 0)); }
      arrows.thrust.setOpacity(seg(u, 0.35, 0.45)); arrows.thrust.position.set(e[0] + 4.5, e[1] + 2.6, e[2] + 0.4); arrows.thrust.setLength(6);
      const u2 = seg(u, 0.62, 1);
      set(path([[0, P([e[0] - 4, e[1] + 3, e[2] + 21], [e[0] - 0.5, e[1], e[2]], 36)], [0.6 * d, P([e[0] + 3, e[1] + 2, e[2] + 19], [e[0] - 1, e[1], e[2]], 36)],
                [d, P([e[0] + 12, e[1] - 17, e[2] + 44], [e[0] - 4, e[1] + 1, e[2] + 6], 38)]], t));
      if (u2 > 0) { cut.setPlane([0, 0, -1], lerp(-10.5, 500, seg(u, 0.62, 0.7))); airflow(t, 140 * u2, 70); }
      L.bypass.set(seg(u, 0.12, 0.2) * (1 - u2), [e[0] + 1, e[1] + 1.1, e[2] + 0.3], [-0.85, 0.48]);
      L.core.set(seg(u, 0.2, 0.28) * (1 - u2), [e[0] - 0.6, e[1] + 0.5, e[2] + 0.3], [-0.85, -0.4]);
      L.thrust.set(seg(u, 0.4, 0.5) * (1 - seg(u, 0.6, 0.66)), [e[0] + 10.5, e[1] + 2.6, e[2] + 0.4], [0.15, 0.6]);
      aimSun(ctx.studio, e, 14);
      finish(t);
    },
    S05(t, d) {
      const u = t / d;
      clouds.visible = false; gear.visible = true;
      const tR = 0.62 * d;                                  // rotation
      const xRun = t < tR ? 4 * t * t : 4 * tR * tR + 8 * tR * (t - tR) + 6 * (t - tR) ** 2;
      const climb = t > tR ? Math.pow(t - tR, 2) * 3.2 : 0;
      plane.position.set(-200 + xRun, -2000 + 5.3 + climb, 0);
      plane.rotation.z = 0.16 * seg(t, tR - 0.2, tR + 0.5);
      gear.scale.setScalar(1 - 0.9 * seg(t, tR + 1.0, tR + 1.8)); gear.visible = gear.scale.x > 0.15;
      spin(t, 16);
      const x = plane.position.x;
      for (let i = 0; i < 60; i++) { const life = 0.4, age = (t + rand(i) * life) % life; hot.put(plane.localToWorld(new THREE.Vector3(2 - age * 30, -3.2 + (rand(i) - 0.5) * 0.8, (rand(i + 1) > 0.5 ? 1 : -1) * 10.5)), 0.08 + age * 0.2, new THREE.Vector3(-1.2, 0, 0)); }
      arrows.lift.setOpacity(seg(u, 0.1, 0.2)); arrows.lift.position.set(-2, 6, 0); arrows.lift.setLength(2 + 10 * clamp(xRun / 900));
      L.speed.set(seg(u, 0.15, 0.25), null, [-0.55, 0.6]);
      set(path([[0, P([x + 20, -2000 + 4, 62], [x, -2000 + 4, 0], 38)], [0.6 * d, P([x + 10, -2000 + 5, 66], [x, -2000 + 5, 0], 38)], [d, P([x - 70, -2000 + 10, 54], [x, plane.position.y, 0], 38)]], t));
      aimSun(ctx.studio, [x, -2000, 0], 60);
      finish(t);
    },
    S06(t, d) {
      const u = t / d;
      const tOff = 0.25 * d;
      plane.position.set(60 * t, SKY_Y + 18 - 4 * t, 0); plane.rotation.z = -0.03;
      const wind = t < tOff ? 9 : lerp(9, 1.2, seg(t, tOff, tOff + 1.5));
      engR.fan.rotation.x = engL.fan.rotation.x = -(t < tOff ? t * 9 : tOff * 9 + (t - tOff) * wind);
      engR.comb.material.emissiveIntensity = engL.comb.material.emissiveIntensity = 1.6 * (1 - seg(t, tOff, tOff + 0.6));
      const x = plane.position.x;
      airflow(t, 120, 60);
      L.off.set(seg(t, tOff, tOff + 0.4), null, [-0.38, 0.62]);
      L.glide.set(seg(u, 0.55, 0.65), null, [-0.55, -0.32]);
      set(path([[0, P([x - 10, plane.position.y + 6, 80], [x, plane.position.y, 0], 38)], [d, P([x + 20, plane.position.y + 2, 74], [x, plane.position.y, 0], 38)]], t));
      aimSun(ctx.studio, [x, SKY_Y, 0], 60);
      finish(t);
    },
    S07(t, d) {
      goldenHour(ctx, 1);
      plane.position.set(70 * t, SKY_Y + 10, 0); spin(t);
      const x = plane.position.x;
      set(path([[0, P([x - 120, SKY_Y + 60, 260], [x, SKY_Y + 4, 0], 38)], [d, P([x - 60, SKY_Y + 50, 270], [x + 30, SKY_Y + 4, 0], 38)]], t));
      aimSun(ctx.studio, [x, SKY_Y, 0], 120);
      finish(t);
    },
    S08(t, d) {
      goldenHour(ctx, 1);
      plane.position.set(70 * t + 30 * t * t / 2, SKY_Y + 10 + t * 1.5, 0); spin(t);
      const x = plane.position.x;
      set(path([[0, P([-60, SKY_Y + 18, 26], [x + 10, SKY_Y + 9, 0], 38)], [d, P([-40, SKY_Y + 22, 18], [x + 40, SKY_Y + 12, 0], 38)]], t, x => x));
      aimSun(ctx.studio, [x, SKY_Y, 0], 100);
      finish(t);
    },
  };
  return { reset, scenes };
}

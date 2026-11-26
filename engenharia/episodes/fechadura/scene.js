// Episode: Como funciona uma fechadura com chave (pin tumbler lock)
// Units: 1 unit ~ 5 mm. Lock axis = +X (front face at x=0). Section plane = z (camera on +z side).
export async function build(ctx) {
  const { THREE, kit, scene, camera, cut } = ctx;
  const { mat, brush, csg, capMaterial, Label, seg, smooth, easeOut, lerp, clamp, path, orbit, applyPose, springGeometry, rand } = kit;
  ctx.studio.floor.position.y = -1.3;

  // ------------------------------------------------------------ dimensions (pin tumbler)
  const L = 3.2;          // cylinder length
  const R = 0.62;         // plug radius  => shear line at y = R (top of plug)
  const RH = 0.9;         // housing radius
  const TW = 0.36, TT = 1.95; // tower half-width / height
  const RC = 0.135, RP = 0.12; // chamber radius / pin radius
  const XS = [0.55, 1.05, 1.55, 2.05, 2.55]; // pin positions along axis
  const Y_TOP = 2.05;     // top of pin chambers (springs rest against it)
  const Y_REST = -0.06;   // key pin tip resting height with no key
  const LD = 0.45;        // driver pin length
  const KW = { y0: -0.42, y1: 0.38, hz: 0.085 }; // keyway
  const BIT_OK = [0.06, 0.24, 0.02, 0.18, 0.12];  // cut heights of the correct key
  const BIT_BAD = [0.06, 0.12, 0.02, 0.18, 0.12]; // pin 2 cut too deep
  const KP = BIT_OK.map(h => R - h);              // key pin lengths: correct key puts every gap on the shear line
  const KEY_IN = -0.06;   // key shoulder x when fully inserted
  const KEY_OUT = -3.6;

  const lockG = new THREE.Group(); scene.add(lockG);
  const plugRot = new THREE.Group(); lockG.add(plugRot); // rotates about X axis

  // ------------------------------------------------------------ housing (CSG)
  const X = (geo) => geo.rotateZ(-Math.PI / 2); // cylinder along X
  const housingGeo = csg(brush(X(new THREE.CylinderGeometry(RH, RH, L, 112)), { pos: [L / 2, 0, 0] }), [
    ['+', brush(new THREE.BoxGeometry(L, TT, TW * 2), { pos: [L / 2, TT / 2, 0] })],
    ['+', brush(X(new THREE.CylinderGeometry(TW, TW, L, 64)), { pos: [L / 2, TT, 0] })],
    ['-', brush(X(new THREE.CylinderGeometry(R + 0.006, R + 0.006, L + 0.4, 112)), { pos: [L / 2, 0, 0] })],
    ...XS.map(x => ['-', brush(new THREE.CylinderGeometry(RC, RC, Y_TOP - 0.3, 40), { pos: [x, (Y_TOP + 0.3) / 2, 0] })]),
  ]);
  const housing = new THREE.Mesh(housingGeo, mat.steel({ color: 0xaeb4bc, roughness: 0.36 }));
  housing.castShadow = housing.receiveShadow = true;
  lockG.add(housing);
  cut.add(housing, capMaterial(0x6f7884));

  // ------------------------------------------------------------ plug (CSG) + cam
  const plugGeo = csg(brush(X(new THREE.CylinderGeometry(R, R, L, 112)), { pos: [L / 2, 0, 0] }), [
    ['+', brush(X(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.08, 112)), { pos: [-0.04, 0, 0] })],
    ['-', brush(new THREE.BoxGeometry(3.3, KW.y1 - KW.y0, KW.hz * 2), { pos: [1.45 - 0.25, (KW.y0 + KW.y1) / 2, 0] })],
    ...XS.map(x => ['-', brush(new THREE.CylinderGeometry(RC, RC, R + 0.4, 40), { pos: [x, (R + 0.25 - 0.15) / 2, 0] })]),
  ]);
  const plug = new THREE.Mesh(plugGeo, mat.brass());
  plug.castShadow = plug.receiveShadow = true;
  plugRot.add(plug);
  cut.add(plug, capMaterial(0xa9822f));

  const camGeo = csg(brush(X(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 64)), { pos: [L + 0.1, 0, 0] }), [
    ['+', brush(new THREE.BoxGeometry(0.16, 0.9, 0.26), { pos: [L + 0.1, -0.62, 0] })],
    ['+', brush(X(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 32)), { pos: [L + 0.1, -1.07, 0] })],
  ]);
  const cam = new THREE.Mesh(camGeo, mat.brass({ color: 0xc89b3c, roughness: 0.35 }));
  cam.castShadow = true;
  plugRot.add(cam);

  // ------------------------------------------------------------ pins & springs
  const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  const keyPins = KP.map((len) => {
    const m = new THREE.Mesh(lathe([[0, 0], [0.035, 0], [RP, 0.075], [RP, len - 0.015], [RP - 0.015, len], [0, len]]), mat.brass({ color: 0xdcb257 }));
    m.castShadow = true; m.position.set(0, 0, 0); plugRot.add(m); return m;
  });
  keyPins.forEach((m, i) => (m.position.x = XS[i]));
  const drivers = XS.map(x => {
    const m = new THREE.Mesh(lathe([[0, 0], [RP - 0.02, 0], [RP, 0.02], [RP, LD - 0.02], [RP - 0.02, LD], [0, LD]]), mat.steel({ color: 0x9aa1aa, roughness: 0.25 }));
    m.castShadow = true; m.position.x = x; lockG.add(m); return m;
  });
  const springGeo = springGeometry(0.095, 0.017, 9);
  const springs = XS.map(x => { const m = new THREE.Mesh(springGeo, mat.springSteel()); m.position.x = x; m.castShadow = true; lockG.add(m); return m; });

  // ------------------------------------------------------------ keys
  function keyTop(lx, bits) {
    if (lx < -0.001 || lx > 2.9) return -Infinity;
    let y = 0.32;
    bits.forEach((h, i) => { const p = XS[i] - KEY_IN; y = Math.min(y, h + Math.max(0, Math.abs(lx - p) - 0.035) * 1.1); });
    if (lx > 2.62) y = Math.min(y, 0.32 - (lx - 2.62) * 1.5);
    return y;
  }
  function keyGeometry(bits) {
    const s = new THREE.Shape();
    s.moveTo(-0.06, -0.4); s.lineTo(2.7, -0.4); s.lineTo(2.9, -0.14);
    for (let x = 2.9; x >= 0; x -= 0.01) s.lineTo(x, keyTop(x, bits));
    s.lineTo(0, 0.32); s.lineTo(-0.06, 0.32); s.closePath();
    const blade = new THREE.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 4 });
    blade.translate(0, 0, -0.065);
    return blade;
  }
  const bowShape = new THREE.Shape();
  { const x0 = -1.55, x1 = -0.04, y0 = -0.72, y1 = 0.66, r = 0.32;
    bowShape.moveTo(x0 + r, y0); bowShape.lineTo(x1, y0 + 0.25); bowShape.lineTo(x1, y1 - 0.25); bowShape.lineTo(x0 + r, y1);
    bowShape.quadraticCurveTo(x0, y1, x0, y1 - r); bowShape.lineTo(x0, y0 + r); bowShape.quadraticCurveTo(x0, y0, x0 + r, y0);
    const hole = new THREE.Path(); hole.absarc(-1.17, -0.03, 0.17, 0, Math.PI * 2, true); bowShape.holes.push(hole); }
  const bowGeo = new THREE.ExtrudeGeometry(bowShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 24 });
  bowGeo.translate(0, 0, -0.09);
  const keyMat = mat.nickel();
  function makeKey(bits) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(keyGeometry(bits), keyMat); b.castShadow = true;
    const w = new THREE.Mesh(bowGeo, keyMat); w.castShadow = true;
    g.add(b, w); return g;
  }
  const keyOK = makeKey(BIT_OK), keyBad = makeKey(BIT_BAD);
  plugRot.add(keyOK, keyBad);

  // ------------------------------------------------------------ helpers / overlays
  const shear = new THREE.Mesh(new THREE.BoxGeometry(1, 0.016, 0.004), mat.glow(0x37d2ff));
  shear.geometry.translate(0.5, 0, 0); shear.position.set(-0.25, R, 0.135); shear.renderOrder = 50; lockG.add(shear);
  const rings = XS.map(x => { const m = new THREE.Mesh(new THREE.TorusGeometry(RP + 0.018, 0.014, 10, 48), mat.glow(0x52ff9a)); m.rotation.x = Math.PI / 2; m.position.set(x, R, 0); lockG.add(m); return m; });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.6), mat.glow(0x37d2ff, { opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const sheetEdge = new THREE.LineSegments(new THREE.EdgesGeometry(sheet.geometry), new THREE.LineBasicMaterial({ color: 0x8fe6ff, transparent: true, toneMapped: false }));
  sheet.add(sheetEdge); sheet.position.set(1.4, 0.6, 0); scene.add(sheet);

  const lab = {
    corpo: new Label(ctx, 'CORPO'), tambor: new Label(ctx, 'TAMBOR', { accent: '#ffc24a' }),
    inf: new Label(ctx, 'PINOS INFERIORES', { accent: '#ffc24a' }), sup: new Label(ctx, 'PINOS SUPERIORES'),
    molas: new Label(ctx, 'MOLAS'), linha: new Label(ctx, 'LINHA DE\nCISALHAMENTO', { accent: '#37d2ff' }),
    trava: new Label(ctx, 'TRAVADO', { accent: '#ff4d4d' }), came: new Label(ctx, 'CAME → LINGUETA', { accent: '#ffc24a' }),
    combo1: new Label(ctx, '5 PINOS × 10 ALTURAS', { size: 0.036 }), combo2: new Label(ctx, '100.000 COMBINAÇÕES', { size: 0.042, accent: '#52ff9a' }),
    yale: new Label(ctx, '1848 · LINUS YALE SR.', { size: 0.034, accent: '#ffc24a' }),
  };

  // grid of different keys for the combinations scene
  const gridG = new THREE.Group(); scene.add(gridG);
  const gridKeys = [];
  for (let i = 0; i < 28; i++) {
    const bits = XS.map((_, j) => 0.02 + Math.floor(rand(i * 7 + j * 3.1) * 10) * 0.025);
    const k = makeKey(bits); k.scale.setScalar(0.62); gridG.add(k); gridKeys.push(k);
  }

  // ------------------------------------------------------------ state
  const st = {};
  function reset() {
    Object.assign(st, { keyX: KEY_OUT, keyBits: null, angle: 0, explode: 0, lift: 0 });
    cut.offset = 100;
    lockG.visible = true; gridG.visible = false;
    keyOK.visible = keyBad.visible = false;
    shear.visible = false; shear.scale.x = 3.7; shear.material.color.set(0x37d2ff);
    rings.forEach(r => (r.visible = false));
    sheet.visible = false;
    for (const l of Object.values(lab)) l.set(0);
    [...keyPins, ...drivers, plug].forEach(m => m.material.emissive.set(0x000000));
    ctx.grade.uniforms.fade.value = 0;
    ctx.studio.floor.visible = true;
  }

  function hl(m, color, k) { m.material.emissive.set(color).multiplyScalar(k); }

  /** apply kinematics: key pins ride on the key profile, drivers sit on key pins, springs fill the rest */
  function solve() {
    const e = st.explode;
    const key = st.keyBits === BIT_OK ? keyOK : st.keyBits === BIT_BAD ? keyBad : null;
    if (key) { key.visible = true; key.position.set(st.keyX - e * 2.4, 0, 0); }
    plugRot.rotation.x = st.angle;
    plugRot.position.x = -e * 1.7;
    XS.forEach((x, i) => {
      const kt = key ? keyTop(x - st.keyX, st.keyBits) : -Infinity;
      const yb = Math.max(Y_REST, kt) + st.lift;
      keyPins[i].position.y = yb + e * (0.9 + i * 0.05);
      // driver sits on the key pin (when the plug turns, the gap is on the shear line so it stays in the housing)
      drivers[i].position.y = yb + KP[i] + e * 1.75;
      const top0 = yb + KP[i] + LD;
      springs[i].position.y = top0 + e * 2.5;
      springs[i].scale.y = Math.max(0.05, Y_TOP - top0);
    });
  }

  // camera presets
  const C = [1.55, 0.72, 0];
  const FRONT = { pos: [1.55, 0.8, 13.2], look: [1.55, 0.72, 0], fov: 32 };
  const set = p => applyPose(camera, p);

  // ------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      st.keyBits = BIT_OK;
      st.keyX = lerp(KEY_OUT, KEY_IN, seg(t, 0.12 * d, 0.92 * d));
      const c = seg(t, 0.4 * d, 0.7 * d);
      cut.offset = lerp(1.6, 0, c);
      sheet.visible = c > 0.001 && c < 0.999; sheet.position.z = cut.offset;
      sheet.material.opacity = 0.07 * Math.sin(Math.PI * c); sheetEdge.material.opacity = Math.sin(Math.PI * c);
      solve();
      set(path([[0, orbit([0.3, 0.35, 0], 6.2, -58, 14, 30)], [0.55 * d, orbit([0.9, 0.6, 0], 8.2, -30, 9, 31)], [d, orbit([1.2, 0.7, 0], 10.2, -10, 5, 32)]], t));
    },
    S02(t, d) {
      cut.offset = 0; solve();
      set(path([[0, orbit(C, 13.2, -32, 10)], [0.7 * d, FRONT]], t));
      const a = seg(t, 0.22 * d, 0.36 * d), b = seg(t, 0.55 * d, 0.68 * d);
      lab.corpo.set(a, [2.9, 1.7, 0], [0.2, 0.62]);
      lab.tambor.set(b, [2.6, -0.25, 0.02], [-0.55, -0.55]);
      hl(plug, 0xffa020, 0.25 * b * (0.6 + 0.4 * Math.sin(t * 6)));
    },
    S03(t, d) {
      cut.offset = 0;
      st.lift = 0.12 * Math.sin(Math.PI * seg(t, 0.62 * d, 0.95 * d, x => x));
      solve();
      set(path([[0, FRONT], [d, { pos: [1.55, 1.25, 8.3], look: [1.55, 1.15, 0], fov: 32 }]], t));
      const a = seg(t, 0.08 * d, 0.22 * d), b = seg(t, 0.35 * d, 0.48 * d), c = seg(t, 0.6 * d, 0.72 * d);
      keyPins.forEach((m, i) => hl(m, 0xffa020, 0.55 * seg(t, (0.08 + i * 0.04) * d, (0.16 + i * 0.04) * d) * (1 - 0.6 * b)));
      drivers.forEach((m, i) => hl(m, 0x3fb8ff, 0.5 * seg(t, (0.35 + i * 0.04) * d, (0.43 + i * 0.04) * d) * (1 - 0.6 * c)));
      lab.inf.set(a, [XS[0], 0.2, 0.12], [-0.85, -0.5]);
      lab.sup.set(b, [XS[4], 0.95, 0.12], [-0.2, 0.62]);
      lab.molas.set(c, [XS[2], 1.6, 0.12], [-0.85, 0.75]);
    },
    S04(t, d) {
      cut.offset = 0;
      st.lift = 0.32 * (1 - seg(t, 0.06 * d, 0.24 * d, easeOut));
      const j = seg(t, 0.55 * d, 0.92 * d, x => x);
      st.angle = j > 0 && j < 1 ? 0.03 * Math.abs(Math.sin(j * Math.PI * 5)) : 0;
      st.keepDrivers = undefined;
      solve();
      const r = seg(t, 0.3 * d, 0.42 * d);
      drivers.forEach(m => hl(m, 0xff2a2a, 0.9 * r));
      lab.trava.set(seg(t, 0.62 * d, 0.7 * d), [XS[2], R + 0.1, 0.12], [0.1, -0.5]);
      set(path([[0, FRONT], [d, { pos: [1.55, 0.7, 8.0], look: [1.55, 0.62, 0], fov: 32 }]], t));
    },
    S05(t, d) {
      cut.offset = 0; solve();
      shear.visible = true; shear.scale.x = Math.max(0.001, 3.7 * seg(t, 0.03 * d, 0.38 * d));
      lab.linha.set(seg(t, 0.3 * d, 0.42 * d), [0.6, R, 0.14], [-0.8, 0.45]);
      set(path([[0, { pos: [0.4, 0.95, 6.4], look: [0.9, 0.62, 0], fov: 32 }], [d, { pos: [2.6, 0.9, 6.0], look: [2.0, 0.62, 0], fov: 32 }]], t));
    },
    S06(t, d) {
      cut.offset = 0;
      st.keyBits = BIT_OK;
      st.keyX = lerp(KEY_OUT, KEY_IN, seg(t, 0.06 * d, 0.8 * d, u => smooth(u) * 0.85 + u * 0.15));
      solve();
      shear.visible = true; shear.material.opacity = 0.55;
      set(path([[0, { pos: [0.7, 0.55, 10.2], look: [0.6, 0.5, 0], fov: 32 }], [d, { pos: [1.5, 0.7, 9.2], look: [1.45, 0.6, 0], fov: 32 }]], t));
    },
    S07(t, d) {
      cut.offset = 0; st.keyBits = BIT_OK; st.keyX = KEY_IN; solve();
      shear.visible = true; shear.material.color.set(0x52ff9a);
      rings.forEach((r, i) => { const k = seg(t, (0.12 + i * 0.1) * d, (0.2 + i * 0.1) * d); r.visible = k > 0; r.scale.setScalar(lerp(1.6, 1, k)); r.material.opacity = k; });
      keyPins.forEach((m, i) => hl(m, 0x52ff9a, 0.25 * seg(t, (0.12 + i * 0.1) * d, (0.2 + i * 0.1) * d)));
      set(path([[0, { pos: [1.55, 0.8, 7.6], look: [1.55, 0.62, 0], fov: 32 }], [d, { pos: [1.55, 0.95, 5.6], look: [1.55, 0.62, 0], fov: 30 }]], t));
    },
    S08(t, d) {
      cut.offset = 0; st.keyBits = BIT_OK; st.keyX = KEY_IN; st.aligned = true;
      st.angle = -Math.PI / 2 * seg(t, 0.15 * d, 0.6 * d);
      solve();
      lab.came.set(seg(t, 0.62 * d, 0.74 * d), [L + 0.1, -0.2, -0.75], [-0.75, 0.55]);
      set(path([[0, FRONT], [0.25 * d, orbit(C, 11.2, 25, 12)], [d, orbit([1.9, 0.4, 0], 10.6, 128, 22)]], t));
    },
    S09(t, d) {
      cut.offset = 0; st.keyBits = BIT_BAD;
      st.keyX = lerp(KEY_OUT, KEY_IN, seg(t, 0.05 * d, 0.55 * d));
      const j = seg(t, 0.66 * d, 0.95 * d, x => x);
      st.angle = j > 0 && j < 1 ? 0.03 * Math.abs(Math.sin(j * Math.PI * 4)) : 0;
      st.aligned = false;
      solve();
      shear.visible = true; shear.material.opacity = 0.6;
      const r = seg(t, 0.56 * d, 0.64 * d);
      hl(drivers[1], 0xff2a2a, 1.1 * r * (0.7 + 0.3 * Math.sin(t * 14)));
      lab.trava.set(seg(t, 0.72 * d, 0.8 * d), [XS[1], R, 0.12], [0.15, -0.45]);
      set(path([[0, { pos: [1.2, 0.7, 10.4], look: [1.1, 0.6, 0], fov: 32 }], [d, { pos: [1.15, 0.75, 6.4], look: [1.1, 0.62, 0], fov: 32 }]], t));
    },
    S10(t, d) {
      lockG.visible = false; gridG.visible = true; ctx.studio.floor.visible = false;
      const s = seg(t, 0.0, 0.55 * d, easeOut);
      gridKeys.forEach((k, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const tx = (col - 1.5) * 2.45 + 0.5, ty = (row - 3) * 1.15 + 0.4, tz = -(rand(i) * 2.0);
        k.position.set(lerp(0.5, tx, s), lerp(0.4, ty, s), lerp(-4, tz, s));
        k.rotation.set(0.15 * Math.sin(t * 0.8 + i), 0.5 * Math.sin(t * 0.6 + i * 1.7), 0);
      });
      set(path([[0, { pos: [0.3, 0.4, 7], look: [0.3, 0.3, -1], fov: 32 }], [d, { pos: [0, 0.4, 23], look: [0, 0.3, -1], fov: 32 }]], t));
      lab.combo1.set(seg(t, 0.15 * d, 0.27 * d), null, [-0.62, 0.55]);
      lab.combo2.set(seg(t, 0.55 * d, 0.65 * d), null, [-0.72, -0.05]);
    },
    S11(t, d) {
      cut.offset = 0; st.keyBits = BIT_OK; st.keyX = KEY_IN;
      st.explode = seg(t, 0.0, 0.5 * d);
      solve();
      lab.yale.set(seg(t, 0.5 * d, 0.62 * d), null, [-0.6, -0.6]);
      set(path([[0, orbit([1.0, 1.0, 0], 15.5, -25, 14)], [d, orbit([0.7, 1.3, 0], 17.5, 30, 18)]], t, x => x));
    },
    S12(t, d) {
      st.keyBits = BIT_OK; st.keyX = KEY_IN; st.aligned = true;
      st.explode = 1 - seg(t, 0, 0.38 * d);
      st.angle = -Math.PI / 2 * seg(t, 0.5 * d, 0.7 * d);
      cut.offset = lerp(0, 1.6, seg(t, 0.32 * d, 0.55 * d));
      solve();
      set(path([[0, orbit([0.7, 1.3, 0], 17.5, 30, 18)], [0.45 * d, orbit([1.3, 0.6, 0], 10.5, -28, 12)], [d, orbit([1.4, 0.5, 0], 11.8, -38, 14)]], t));
      ctx.grade.uniforms.fade.value = seg(t, d - 0.7, d - 0.05);
    },
  };

  return { reset, scenes };
}

// EPISODE — How does a 200,000-ton steel ship float? (low-poly style)
// Units: meters. Ship bow = +x, waterline y = 0. Section plane z = 0 (camera on +z side).
import { makeOcean, underwater, resetEnv, makeParticles, goldenHour, skyClouds } from '/engine/env.js';
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, applyPose, rand, csg, brush } = kit;
  const { lp, makeCharacter, blinkAt, aimSun } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 36) => ({ pos, look, fov });
  const add = (m, parent = scene) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, pos, parent) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent); m.position.set(...pos); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
  cut.capSize = 700;

  // ------------------------------------------------------------------ hull from a plan shape (extruded vertically)
  function planShape(x0, x1, B, bowStart, inset = 0) {
    const s = new THREE.Shape(), b = B / 2 - inset, r = Math.min(8, B * 0.17);
    s.moveTo(x0 + inset + r, -b); s.lineTo(bowStart, -b);
    for (let i = 1; i <= 12; i++) { const u = i / 12; s.lineTo(lerp(bowStart, x1 - inset, u), -b * Math.cos(u * Math.PI / 2)); }
    for (let i = 11; i >= 0; i--) { const u = i / 12; s.lineTo(lerp(bowStart, x1 - inset, u), b * Math.cos(u * Math.PI / 2)); }
    s.lineTo(x0 + inset + r, b); s.quadraticCurveTo(x0 + inset, b, x0 + inset, b - r); s.lineTo(x0 + inset, -b + r); s.quadraticCurveTo(x0 + inset, -b, x0 + inset + r, -b);
    return s;
  }
  function hullSolid(x0, x1, B, bowStart, y0, y1, inset = 0) {
    const g = new THREE.ExtrudeGeometry(planShape(x0, x1, B, bowStart, inset), { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return g;
  }
  function paintByHeight(geo, below, above, line = 0, stripe = null) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), A = new THREE.Color(above), Bc = new THREE.Color(below), S = stripe && new THREE.Color(stripe);
    for (let i = 0; i < p.count; i += 3) { // per triangle (flat colors)
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const col = y < line ? Bc : (S && y < line + 1.5 ? S : A);
      for (let j = 0; j < 3; j++) c.set([col.r, col.g, col.b], (i + j) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }
  const toNonIndexed = g => (g.index ? g.toNonIndexed() : g);

  // ------------------------------------------------------------------ container ship
  const S = { x0: -140, x1: 140, B: 46, bow: 80, keel: -14, deck: 14 };
  const ship = new THREE.Group(); scene.add(ship);
  const outer = hullSolid(S.x0, S.x1, S.B, S.bow, S.keel, S.deck);
  const inner = hullSolid(S.x0, S.x1, S.B, S.bow, S.keel + 2.4, S.deck - 1.0, 1.4);
  const shellGeo = paintByHeight(toNonIndexed(csg(brush(outer.clone()), [['-', brush(inner.clone())]])), 0xb3392f, 0x22345e, 0, 0xf4f6f8);
  const hull = add(new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 })), ship);
  cut.add(hull, capMat(0x6b7580));
  // interior: double bottom plate, bulkheads, engine room
  const intMat = c => lp.color(c, { clippingPlanes: cut.planes });
  box(270, 0.6, 43, intMat(0x8d98a5), [-2, S.keel + 2.6, 0], ship);
  const bulkX = [-100, -64, -28, 8, 44, 80];
  bulkX.forEach(x => box(0.8, 25, 43, intMat(0x9aa5b1), [x, 0, 0], ship));
  box(26, 9, 14, intMat(0x3f6fd8), [-120, -7, 0], ship);                       // main engine
  box(30, 1, 40, intMat(0x5d6873), [-120, -11.5, 0], ship);
  // holds: translucent "air" volumes (shown in the cutaway) + containers inside and on deck
  const airMat = new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x3fd0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.0, depthWrite: false, clippingPlanes: cut.planes, side: THREE.DoubleSide });
  const airVols = [];
  for (let i = 0; i < bulkX.length - 1; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(bulkX[i + 1] - bulkX[i] - 1.2, 24, 42), airMat); m.position.set((bulkX[i] + bulkX[i + 1]) / 2, -0.5, 0); m.renderOrder = 70; ship.add(m); airVols.push(m); }
  const contCols = [0xd8463f, 0x2f7fd1, 0x3fb36a, 0xf2a03a, 0x8d98a5, 0xf4f6f8, 0x7b46c9, 0xe5c33a];
  const contGeo = new THREE.BoxGeometry(12.0, 2.5, 2.35);
  const containers = new THREE.InstancedMesh(contGeo, lp.color(0xffffff, { clippingPlanes: cut.planes }), 3000);
  { const m4 = new THREE.Matrix4(), col = new THREE.Color(); let k = 0;
    for (let bx = -90; bx < 76; bx += 12.6) for (let row = 0; row < 17; row++) {
      const z = -20 + row * 2.5;
      const hDeck = 4 + Math.floor(rand(bx * 3 + row) * 4);
      for (let lv = 0; lv < hDeck; lv++) { m4.makeTranslation(bx, S.deck + 1.3 + lv * 2.55, z); containers.setMatrixAt(k, m4); containers.setColorAt(k++, col.set(contCols[Math.floor(rand(k * 1.7) * 8)])); }
      if (row % 2 === 0) for (let lv = 0; lv < 6; lv++) { m4.makeTranslation(bx, S.keel + 4.4 + lv * 2.55 * 1.55, z); containers.setMatrixAt(k, m4); containers.setColorAt(k++, col.set(contCols[Math.floor(rand(k * 2.3) * 8)])); }
    }
    containers.count = k; }
  ship.add(containers);
  // superstructure + funnel + bow details
  const sup = new THREE.Group(); ship.add(sup);
  box(14, 26, 36, lp.color(0xf4f6f8), [-106, S.deck + 13, 0], sup);
  box(16, 3, 50, lp.color(0xf4f6f8), [-106, S.deck + 25, 0], sup);
  for (let f = 0; f < 7; f++) box(14.1, 1.0, 36.1, lp.color(0x1d2733), [-106, S.deck + 4 + f * 3.4, 0], sup);
  box(10, 16, 9, lp.color(0x22345e), [-126, S.deck + 8, 0], sup);
  box(10.2, 3, 9.2, lp.color(0xd8463f), [-126, S.deck + 15.5, 0], sup);
  const otto = makeCharacter('otto'); otto.scale.setScalar(1.6); otto.position.set(-106, S.deck + 26.5, 22); otto.rotation.y = 0.6; ship.add(otto);

  // ------------------------------------------------------------------ aircraft carrier
  const carrier = new THREE.Group(); scene.add(carrier);
  { const g = paintByHeight(toNonIndexed(hullSolid(-160, 160, 40, 110, -11, 18)), 0x8a2f2a, 0x6b7580, 0);
    add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 })), carrier);
    box(330, 2, 76, lp.color(0x4a525c), [0, 19, 4], carrier);
    const ang = box(190, 2.1, 26, lp.color(0x4a525c), [-20, 19.1, 40], carrier); ang.rotation.y = 0.16;
    for (let i = 0; i < 12; i++) box(18, 2.2, 0.8, lp.color(0xf4f6f8), [-150 + i * 26, 19.2, 4], carrier);
    box(24, 22, 10, lp.color(0x8d98a5), [40, 31, -30], carrier); box(8, 12, 6, lp.color(0x6b7580), [42, 47, -30], carrier);
    for (let i = 0; i < 10; i++) { const j = new THREE.Group(); j.position.set(-100 + i * 18, 21, -14 + (i % 2) * 22); j.rotation.y = 0.4 * (i % 3 - 1); carrier.add(j);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.9, 14, 8).rotateZ(-Math.PI / 2), lp.color(0x9aa5b1)), j);
      add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 11), lp.color(0x8d98a5)), j).position.x = -2; }
  }

  // ------------------------------------------------------------------ ocean (+ cut-out of the water inside the hull footprint)
  const ocean = makeOcean(ctx, { size: 1600, segs: 140 });
  const hole = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
  ocean.mat.clippingPlanes = hole; ocean.mat.clipIntersection = true;
  ocean.under.material.clippingPlanes = hole; ocean.under.material.clipIntersection = true;
  function holeAt(x0, x1, z0, z1, yMin) { // clipIntersection: removed where ALL planes are negative = inside the box
    hole[0].set(new THREE.Vector3(-1, 0, 0), x0); hole[1].set(new THREE.Vector3(1, 0, 0), -x1);
    hole[2].set(new THREE.Vector3(0, 0, -1), z0); hole[3].set(new THREE.Vector3(0, 0, 1), -z1);
    hole[4].set(new THREE.Vector3(0, -1, 0), yMin);
  }
  const sky = skyClouds(ctx, { n: 9, y: 140, spread: 1400, scale: 14 });
  const wake = makeParticles(ctx, { n: 900, color: 0xffffff, emissive: 0xe6f6ff, emissiveIntensity: 0.6 });
  const bubbles = makeParticles(ctx, { n: 400, color: 0xe8fbff, emissive: 0x9fe6ff });

  // ------------------------------------------------------------------ lab set (Archimedes demos)
  const LAB = [5000, 0, 0];
  const lab = new THREE.Group(); lab.position.set(...LAB); scene.add(lab);
  box(60, 0.5, 60, lp.color(0xd9cdb8), [0, -0.25, 0], lab);
  box(12, 0.4, 5, lp.color(0x9a6b43), [0, 1.0, 0], lab);
  [-5.5, 5.5].forEach(x => [-2, 2].forEach(z => box(0.3, 1, 0.3, lp.color(0x7a5230), [x, 0.4, z], lab)));
  box(40, 20, 0.5, lp.color(0xbfe0f0), [0, 10, -12], lab);
  const glass = lp.glass(0xcfeeff, { opacity: 0.18 });
  function tank(x, w = 3, h = 2.2, d = 1.8) {
    const g = new THREE.Group(); g.position.set(x, 1.2, 0); lab.add(g);
    const walls = [[w, h, 0.05, 0, h / 2, d / 2], [w, h, 0.05, 0, h / 2, -d / 2], [0.05, h, d, w / 2, h / 2, 0], [0.05, h, d, -w / 2, h / 2, 0], [w, 0.05, d, 0, 0.02, 0]];
    walls.forEach(([a, b, c, px, py, pz]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), glass); m.position.set(px, py, pz); m.renderOrder = 80; g.add(m); });
    const wPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
    const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 1, d - 0.08), new THREE.MeshStandardMaterial({ color: 0x2f8ff0, transparent: true, opacity: 0.55, flatShading: true, depthWrite: false, clippingPlanes: wPlanes, clipIntersection: true }));
    water.geometry.translate(0, 0.5, 0); water.position.y = 0.05; water.renderOrder = 79; g.add(water);
    return { g, water, w, h, d, wPlanes };
  }
  function waterLevel(tk, level, hullBox = null) {
    tk.water.scale.y = Math.max(0.01, level);
    // cut the water out of the floating hull's footprint (x0,x1,z0,z1 world, above keel y)
    const pl = tk.wPlanes;
    if (hullBox) { const [x0, x1, z0, z1, y0] = hullBox;
      pl[0].set(new THREE.Vector3(-1, 0, 0), x0); pl[1].set(new THREE.Vector3(1, 0, 0), -x1); pl[2].set(new THREE.Vector3(0, 0, -1), z0); pl[3].set(new THREE.Vector3(0, 0, 1), -z1); pl[4].set(new THREE.Vector3(0, -1, 0), y0);
    } else pl.forEach(p => p.set(new THREE.Vector3(0, -1, 0), 1e6));   // positive everywhere = nothing removed
  }
  function modelShip(hollow = true, sc = 1) {
    const g = new THREE.Group(); lab.add(g);
    const steel = lp.metal(0x8d98a5);
    if (hollow) {
      const o = hullSolid(-0.8, 0.8, 0.6, 0.45, -0.3, 0.3), i = hullSolid(-0.8, 0.8, 0.6, 0.45, -0.25, 0.4, 0.05);
      add(new THREE.Mesh(paintByHeight(toNonIndexed(csg(brush(o), [['-', brush(i)]])), 0xb3392f, 0x22345e, -0.05), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })), g);
      for (let k = 0; k < 6; k++) { const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.09), lp.color(contCols[k])), g); c.position.set(-0.45 + (k % 3) * 0.25, 0.35, k < 3 ? -0.06 : 0.06); }
    } else add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), steel), g);
    g.scale.setScalar(sc);
    return g;
  }
  const tankA = tank(-3.2), tankB = tank(3.2);
  const spout = box(0.25, 0.08, 0.3, glass, [0, 0, 0], lab);
  const beaker = tank(1.6, 0.9, 0.9, 0.9); beaker.g.position.y = 1.2;
  const scaleBox = box(1.3, 0.25, 1.1, lp.color(0x2f3640), [1.6, 1.32, 0], lab);
  const toyShip = modelShip(true, 1), toyShip2 = modelShip(true, 1), block = modelShip(false, 1);
  const nova = makeCharacter('nova'); nova.position.set(-6.2, 0, 1.4); nova.rotation.y = 0.9; lab.add(nova);
  const string = box(0.015, 2, 0.015, lp.color(0x333333), [0, 0, 0], lab);
  const labDrops = makeParticles(ctx, { n: 200, color: 0x5fb0ff, emissive: 0x2f8ff0, emissiveIntensity: 0.3 });

  // ------------------------------------------------------------------ arrows + labels
  const buoy = kit.parts.arrow(0x52ff9a, 2.2), wgt = kit.parts.arrow(0xff4d4d, 2.2);
  scene.add(buoy, wgt); wgt.rotation.z = Math.PI;
  const press = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 3.2, 8), lp.color(0x37d2ff, { emissive: 0x37d2ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }), 120);
  scene.add(press);
  const L = {
    displaced: new Label(ctx, 'DISPLACED WATER', { accent: '#2f8ff0', size: 0.036 }), same: new Label(ctx, 'WEIGHT OF DISPLACED WATER\n= WEIGHT OF THE SHIP', { accent: '#52ff9a' }),
    buoy: new Label(ctx, 'BUOYANCY', { accent: '#52ff9a', size: 0.038 }), weight: new Label(ctx, 'WEIGHT', { accent: '#ff4d4d', size: 0.038 }),
    solid: new Label(ctx, 'SOLID STEEL\nSINKS', { accent: '#ff4d4d', size: 0.034 }), hollow: new Label(ctx, 'SAME STEEL, HOLLOW\nFLOATS', { accent: '#52ff9a', size: 0.034 }),
    air: new Label(ctx, 'AIR', { accent: '#7fe9ff', size: 0.04 }), dens: new Label(ctx, 'AVERAGE DENSITY\n< SEAWATER', { accent: '#7fe9ff', size: 0.034 }),
    holds: new Label(ctx, 'CARGO HOLDS', { accent: '#f2a03a' }), bulk: new Label(ctx, 'BULKHEADS', { accent: '#9aa5b1' }), db: new Label(ctx, 'DOUBLE BOTTOM', { accent: '#8d98a5' }),
  };

  // ------------------------------------------------------------------ state
  function reset() {
    resetEnv(ctx); cut.setPlane([0, 0, -1], 500);
    ship.visible = true; carrier.visible = false; lab.visible = false; ocean.reset(); sky.visible = true;
    ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0);
    airMat.opacity = 0;
    buoy.setOpacity(0); wgt.setOpacity(0); press.count = 0;
    Object.values(L).forEach(l => l.set(0));
    holeAt(-142, 142, -23.5, 23.5, -14);
    // lab props: every frame starts from the same visible state
    [tankA.g, tankB.g, beaker.g, scaleBox, spout, string, toyShip, toyShip2, block].forEach(o => (o.visible = true));
    tankA.g.position.x = -2.0; tankB.g.position.x = 2.0; beaker.g.position.set(1.6, 1.55, 0); scaleBox.position.set(1.6, 1.32, 0);
    nova.position.set(-6.2, 0, 1.4); nova.rotation.y = 0.9;
    wake.begin(); bubbles.begin(); labDrops.begin();
    ctx.grade.uniforms.fade.value = 0;
  }
  function sail(t, speed = 9) {
    ship.position.x = speed * t; ship.rotation.x = 0.004 * Math.sin(t * 0.7); ship.position.y = 0.25 * Math.sin(t * 0.9);
    const x = ship.position.x;
    holeAt(x - 142, x + 142, -23.5, 23.5, -14.5);
    wake.emit(t, 260, { origin: [x - 145, 0.6, 0], vel: [-6, 0.4, 0], spread: [10, 0.4, 40], life: 6, size: 1.1, seed: 1, grow: 0.25 });
    [-1, 1].forEach(s => wake.emit(t, 120, { origin: [x + 135, 0.8, s * 6], vel: [-7, 0.6, s * 5], spread: [6, 0.5, 4], life: 4, size: 0.9, seed: s > 0 ? 7 : 13 }));
    return x;
  }
  function finish(t) { otto.pose({ blink: blinkAt(t, 3), wave: 0 }); wake.end(); bubbles.end(); labDrops.end(); }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      ocean.waves(t, 1.0);
      const x = sail(t);
      set(path([[0, P([x + 320, 180, 260], [x - 10, 0, 0], 36)], [d, P([x + 230, 95, 250], [x - 20, 8, 0], 36)]], t));
      aimSun(ctx.studio, [x, 0, 0], 220);
      finish(t);
    },
    S02(t, d) {
      ocean.waves(t, 0.8);
      const x = sail(t + 5);
      set(path([[0, P([x + 40, 30, 70], [x + 20, 4, 23], 38)], [0.55 * d, P([x + 20, 2.5, 52], [x + 5, -1, 23], 38)], [d, P([x + 8, -9, 50], [x - 5, -8, 23], 40)]], t));
      if (underwater(ctx)) bubbles.emit(t, 80, { origin: [x, -6, 26], vel: [0, 1.2, 0], spread: [80, 6, 6], life: 4, size: 0.18, seed: 3 });
      aimSun(ctx.studio, [x, 0, 0], 120);
      finish(t);
    },
    S03(t, d) {
      const u = t / d;
      ship.visible = false; ocean.mesh.visible = false; ocean.under.visible = false; sky.visible = false; lab.visible = true;
      tankB.g.visible = false; toyShip2.visible = false; block.visible = false;
      tankA.g.position.x = -1.2; spout.position.set(-1.2 + 1.55, 1.2 + 2.12, 0);
      nova.position.set(-3.6, 0, 1.6); nova.rotation.y = 0.7;
      // lower the hollow model into a brim-full tank; overflow = submerged volume
      const k = seg(u, 0.12, 0.6);
      const keelY = lerp(4.2, 1.2 + 0.05 + 1.95 - 0.12, k); // world (lab-local) keel height
      toyShip.position.set(-1.2, keelY + 0.3, 0);
      string.position.set(-1.2, keelY + 0.3 + 1.2, 0); string.visible = k < 0.98;
      const brim = 2.1;
      const sub = clamp((brim + 1.2 - keelY) / 0.3);                         // fraction of the hull below the brim level
      waterLevel(tankA, brim, sub > 0 ? [LAB[0] - 1.2 - 0.8, LAB[0] - 1.2 + 0.8, -0.3, 0.3, keelY] : null);
      waterLevel(beaker, 0.08 + 0.55 * sub);
      if (k > 0.2 && k < 0.98) labDrops.emit(t, 60, { origin: [LAB[0] - 1.2 + 1.65, 1.2 + 2.1, 0], vel: [0.4, -1.5, 0], spread: [0.1, 0.05, 0.15], life: 0.6, size: 0.04, gravity: 6, seed: 2 });
      nova.pose({ blink: blinkAt(t, 2), point: k < 0.98 ? 0.9 : 0, mouth: u > 0.7 ? 'grin' : 'o', head: [0.1, 0.4, 0] });
      const c = [LAB[0] - 0.1, 2.6, 0];
      set(path([[0, P([c[0] - 0.5, 5.2, 16], [c[0] - 0.5, 2.6, 0], 36)], [d, P([c[0] + 0.6, 4.4, 13], [c[0] + 0.4, 2.5, 0], 36)]], t));
      L.displaced.set(seg(u, 0.55, 0.65), [LAB[0] + 1.6, 1.8, 0.5], [-0.1, -0.35]);
      L.same.set(seg(u, 0.75, 0.85), null, [-0.75, 0.6]);
      aimSun(ctx.studio, c, 10);
      finish(t);
    },
    S04(t, d) {
      const u = t / d;
      ocean.waves(t, 0.6);
      ocean.seeThrough(0.42);
      ship.position.set(0, lerp(3, 0, seg(u, 0.05, 0.6, easeOut)) + 0.2 * Math.sin(t), 0);
      holeAt(-142, 142, -23.5, 23.5, -14.5 + ship.position.y);
      // pressure arrows on the submerged hull (bottom pointing up, sides pointing in)
      const k = seg(u, 0.1, 0.3); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let n = 0;
      for (let i = 0; i < 14; i++) { const x = -120 + i * 18; m4.compose(new THREE.Vector3(x, S.keel - 3 + ship.position.y, 10), q.identity(), new THREE.Vector3(k, k, k)); press.setMatrixAt(n++, m4); }
      for (let i = 0; i < 10; i++) { const x = -110 + i * 22; q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); m4.compose(new THREE.Vector3(x, -7 + ship.position.y, 26.5), q, new THREE.Vector3(k, k * 0.7, k)); press.setMatrixAt(n++, m4); }
      press.count = n; press.instanceMatrix.needsUpdate = true;
      const b = seg(u, 0.35, 0.65);
      buoy.setOpacity(seg(u, 0.3, 0.4)); buoy.position.set(10, S.keel - 2 + ship.position.y - 30 + 30, 30); buoy.position.y = -50; buoy.setLength(lerp(20, 42, b));
      wgt.setOpacity(seg(u, 0.4, 0.5)); wgt.position.set(-10, 75, 30); wgt.setLength(42);
      set(path([[0, P([150, 30, 220], [0, 0, 0], 36)], [d, P([120, 12, 210], [0, 2, 0], 36)]], t));
      L.buoy.set(seg(u, 0.4, 0.5), [10, -50 + lerp(20, 42, b), 30], [0.15, -0.42]);
      L.weight.set(seg(u, 0.5, 0.6), [-10, 75 - 42, 30], [-0.85, 0.55]);
      aimSun(ctx.studio, [0, 0, 0], 180);
      finish(t);
    },
    S05(t, d) {
      const u = t / d;
      ship.visible = false; ocean.mesh.visible = false; ocean.under.visible = false; sky.visible = false; lab.visible = true;
      tankA.g.position.x = -2.0; tankB.g.position.x = 2.0; beaker.g.visible = false; scaleBox.visible = false; spout.visible = false; string.visible = false; toyShip.visible = false;
      const lvl = 1.4;
      // solid block falls through the water to the bottom
      const fall = seg(u, 0.15, 0.5, easeIn), drag = seg(u, 0.3, 0.62);
      const by = lerp(4.5, 1.2 + 0.25, Math.min(1, fall * 0.6 + drag * 0.4));
      block.position.set(-2.0, by, 0);
      waterLevel(tankA, lvl + 0.08 * clamp((1.2 + lvl - (by - 0.21)) / 0.42));
      // hollow hull (same steel) floats
      const fy = lerp(4.5, 1.2 + lvl + 0.02, seg(u, 0.2, 0.55, easeOut)) + 0.03 * Math.sin(t * 3) * seg(u, 0.55, 0.7);
      toyShip2.position.set(2.0, fy, 0);
      const keel = fy - 0.3;
      waterLevel(tankB, lvl + 0.05, keel < 1.2 + lvl ? [LAB[0] + 2.0 - 0.8, LAB[0] + 2.0 + 0.8, -0.3, 0.3, keel] : null);
      if (u > 0.3 && u < 0.55) labDrops.emit(t, 60, { origin: [LAB[0] - 2.0, 1.2 + lvl + 0.1, 0], vel: [0, 2.2, 0], spread: [0.6, 0.05, 0.4], life: 0.5, size: 0.05, gravity: 9, seed: 4 });
      nova.position.set(-4.4, 0, 2.2); nova.rotation.y = 0.5; nova.pose({ blink: blinkAt(t, 2), mouth: u > 0.6 ? 'grin' : 'o', brows: 0.5 });
      set(path([[0, P([LAB[0] - 0.5, 5.5, 21], [LAB[0] - 0.5, 2.5, 0], 36)], [d, P([LAB[0] - 0.3, 5.0, 19], [LAB[0] - 0.3, 2.4, 0], 36)]], t));
      L.solid.set(seg(u, 0.55, 0.65), [LAB[0] - 2.0, 1.5, 0.3], [-0.9, 0.55]);
      L.hollow.set(seg(u, 0.62, 0.72), [LAB[0] + 2.0, 2.7, 0.3], [-0.05, 0.4]);
      aimSun(ctx.studio, [LAB[0], 2, 0], 10);
      finish(t);
    },
    S06(t, d) {
      const u = t / d;
      ocean.waves(t, 0.5);
      cut.setPlane([0, 0, -1], lerp(40, 0, seg(u, 0.0, 0.3)));
      airMat.opacity = 0.32 * seg(u, 0.38, 0.5);
      airVols.forEach((m, i) => (m.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 4 + i)));
      set(path([[0, P([120, 70, 220], [0, 0, 0], 36)], [0.35 * d, P([40, 18, 200], [-10, 0, 0], 36)], [d, P([20, 10, 170], [-12, 0, 0], 36)]], t));
      L.holds.set(seg(u, 0.28, 0.36) * (1 - seg(u, 0.5, 0.55)), [30, -2, 0.3], [-0.85, 0.5]);
      L.db.set(seg(u, 0.32, 0.4) * (1 - seg(u, 0.5, 0.55)), [0, S.keel + 2.6, 0.3], [-0.85, -0.4]);
      L.air.set(seg(u, 0.45, 0.55), [-46, 4, 0.3], [-0.2, 0.55]);
      L.dens.set(seg(u, 0.62, 0.72), null, [-0.6, -0.4]);
      aimSun(ctx.studio, [0, 0, 0], 180);
      finish(t);
    },
    S07(t, d) {
      ocean.waves(t, 0.8);
      const x = sail(t + 20, 6);
      set(path([[0, P([x + 60, -42, 70], [x + 10, -12, 0], 42)], [d, P([x + 20, -46, 64], [x - 20, -13, 0], 42)]], t));
      underwater(ctx);
      bubbles.emit(t, 200, { origin: [x - 142, -9, 0], vel: [-3, 1.5, 0], spread: [8, 6, 10], life: 4, size: 0.35, seed: 5 });
      bubbles.emit(t, 120, { origin: [x, -14, 0], vel: [0, 1.0, 0], spread: [260, 2, 40], life: 5, size: 0.2, seed: 9 });
      aimSun(ctx.studio, [x, -10, 0], 160);
      finish(t);
    },
    S08(t, d) {
      ocean.waves(t, 1.0);
      ship.visible = false; carrier.visible = true;
      carrier.position.set(5 * t, 0.3 * Math.sin(t * 0.8), 0);
      const x = carrier.position.x;
      holeAt(x - 162, x + 162, -20, 20, -11.5);
      wake.emit(t, 260, { origin: [x - 165, 0.6, 0], vel: [-5, 0.4, 0], spread: [10, 0.4, 36], life: 6, size: 1.1, seed: 21 });
      set(path([[0, P([x + 260, 150, 260], [x, 10, 0], 36)], [d, P([x - 120, 120, 330], [x, 14, 0], 36)]], t, u => u));
      aimSun(ctx.studio, [x, 0, 0], 220);
      finish(t);
    },
    S09(t, d) {
      goldenHour(ctx, 1);
      ocean.waves(t, 0.9);
      const x = sail(t + 40, 8);
      set(path([[0, P([x - 260, 40, 190], [x + 40, 10, -30], 36)], [d, P([x - 380, 70, 280], [x + 80, 12, -40], 36)]], t));
      aimSun(ctx.studio, [x, 0, 0], 220);
      finish(t);
    },
  };
  return { reset, scenes };
}

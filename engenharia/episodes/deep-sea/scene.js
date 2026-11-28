// EPISODE — You are 10,000 meters under the ocean (low-poly style, original cast)
// Units: meters. Submersible at the origin, forward = +z, up = +y.
// Pressure sphere (titanium) centred at the origin: inside radius 0.75 m, wall 0.09 m (stylised after
// full-ocean-depth subs such as DSV Limiting Factor). Conical acrylic viewport on the +z axis.
import { makeParticles } from '/engine/env.js';
export const style = 'lowpoly';

export async function build(ctx) {
  const { THREE, kit, lowpoly, scene, camera, cut } = ctx;
  const { brush, csg, Label, seg, smooth, easeOut, easeIn, lerp, clamp, path, applyPose, rand } = kit;
  const { lp, facet, makeCharacter, CAST, blinkAt } = lowpoly;
  const set = p => applyPose(camera, p);
  const P = (pos, look, fov = 40) => ({ pos, look, fov });
  const add = (m, parent = scene) => { m.castShadow = false; m.receiveShadow = false; parent.add(m); return m; };
  const capMat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7, side: THREE.DoubleSide });
  const clipM = (c, o = {}) => lp.color(c, { clippingPlanes: cut.planes, ...o });
  cut.capSize = 12;

  const RI = 0.75, RO = 0.84;            // pressure sphere radii
  const WZ = 0.74;                       // inner face of the viewport
  const coneR = z => 0.24 + (z - WZ) * 0.9;   // viewport radius along z (cone opens outward)
  const Z = g => g.rotateX(Math.PI / 2);      // cylinder axis y -> z (top at +z)

  const sub = new THREE.Group(); scene.add(sub);

  // ------------------------------------------------------------------ titanium pressure sphere
  const holeGeo = Z(new THREE.CylinderGeometry(coneR(1.25), coneR(0.5), 0.75, 28));
  const sphereGeo = csg(brush(new THREE.SphereGeometry(RO, 40, 28)),
    [['-', brush(new THREE.SphereGeometry(RI, 40, 28))], ['-', brush(holeGeo.clone(), { pos: [0, 0, 0.875] })]]);
  const sphereMat = lp.metal(0x9aa3ad, { roughness: 0.38, metalness: 0.6, side: THREE.DoubleSide });
  const sphere = add(new THREE.Mesh(sphereGeo, sphereMat), sub); cut.add(sphere, capMat(0xd4d9df));
  // inner liner (slightly lighter so the cabin reads), clipped with the section
  const liner = add(new THREE.Mesh(new THREE.SphereGeometry(RI - 0.004, 40, 28), clipM(0x4a5560, { side: THREE.BackSide })), sub);
  liner.visible = true;
  // the liner must not cover the window: cut a disc out with a clipping-free CSG instead
  liner.geometry = csg(brush(new THREE.SphereGeometry(RI - 0.004, 40, 28)), [['-', brush(new THREE.SphereGeometry(RI - 0.03, 40, 28))], ['-', brush(holeGeo.clone(), { pos: [0, 0, 0.875] })]]);
  liner.material.side = THREE.DoubleSide;
  // equator bolt flange (hemispheres are bolted, not welded)
  // hemispheres are bolted together at a flange (kept clear of the viewport)
  const FZ = -0.12, FR = Math.sqrt(RO * RO - FZ * FZ);
  const flange = add(new THREE.Mesh(new THREE.TorusGeometry(FR + 0.015, 0.03, 6, 40), clipM(0x7d8791, { metalness: 0.5, roughness: 0.4 })), sub); flange.position.z = FZ;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 6), clipM(0x5c646d)), sub);
    b.position.set(Math.cos(a) * (FR + 0.03), Math.sin(a) * (FR + 0.03), FZ); b.rotation.z = a - Math.PI / 2;
  }
  void flange;

  // ------------------------------------------------------------------ conical acrylic viewport
  const z0 = WZ - 0.004, z1 = 0.93;
  const winGeo = Z(new THREE.CylinderGeometry(coneR(z1), coneR(z0), z1 - z0, 32));
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: cut.planes });
  const glass = add(new THREE.Mesh(winGeo, glassMat), sub); glass.position.z = (z0 + z1) / 2; glass.renderOrder = 40;
  const frame = add(new THREE.Mesh(new THREE.TorusGeometry(coneR(WZ) + 0.012, 0.028, 8, 36), clipM(0x3b434c, { metalness: 0.5, roughness: 0.4 })), sub); frame.position.z = WZ - 0.01;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), clipM(0xb8c0c8)), sub); b.position.set(Math.cos(a) * (coneR(WZ) + 0.012), Math.sin(a) * (coneR(WZ) + 0.012), WZ - 0.035); }
  // reflections of the cabin lights on the inner face of the glass
  const reflTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const blob = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); };
    blob(70, 200, 60, '255,190,120', 0.55); blob(185, 205, 40, '120,230,255', 0.5); blob(128, 215, 28, '120,255,170', 0.4); blob(60, 60, 30, '255,210,160', 0.25);
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(40, 110); g.lineTo(110, 40); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(60, 135); g.lineTo(135, 60); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const reflMat = new THREE.MeshBasicMaterial({ map: reflTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
  const refl = add(new THREE.Mesh(new THREE.CircleGeometry(coneR(WZ), 36), reflMat), sub); refl.position.z = WZ + 0.002; refl.rotation.y = Math.PI; refl.renderOrder = 41;

  // ------------------------------------------------------------------ syntactic-foam body (buoyancy) + frame
  const body = new THREE.Group(); sub.add(body);
  const BC = [0, 0.75, -0.95];
  const bodyGeo = csg(brush(new THREE.BoxGeometry(2.0, 2.9, 3.9), { pos: BC }),
    [['&', brush(new THREE.SphereGeometry(2.3, 20, 14).scale(0.62, 0.8, 0.85), { pos: BC })],
     ['-', brush(new THREE.SphereGeometry(RO + 0.01, 32, 20))],
     ['-', brush(holeGeo.clone(), { pos: [0, 0, 0.875] })]]);
  const foam = add(new THREE.Mesh(bodyGeo, lp.color(0xf2a531, { roughness: 0.75 })), body); { const fc = capMat(0xffd88a); fc.emissive = new THREE.Color(0x5a3a08); fc.emissiveIntensity = 0.6; cut.add(foam, fc); }
  // white top cowling with hatch trunk
  const cowl = add(new THREE.Mesh(facet(new THREE.CylinderGeometry(0.36, 0.42, 0.4, 10), 0.01), clipM(0xe9edf0)), body); cowl.position.set(0, 2.35, -0.5);
  // skids + side frame rails
  [-1, 1].forEach(s => {
    const sk = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), clipM(0x30363d, { metalness: 0.4 })), body); sk.position.set(s * 0.75, -0.95, -0.9);
    [0.4, -1.0, -2.2].forEach(z => { const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), clipM(0x30363d)), body); leg.position.set(s * 0.75, -0.7, z); });
  });
  // thrusters (ducted) at the rear corners
  const props = [];
  [[-1, 0.2], [1, 0.2], [-1, 1.7], [1, 1.7]].forEach(([s, y]) => {
    const g = new THREE.Group(); g.position.set(s * 1.12, y, -2.6); body.add(g);
    add(new THREE.Mesh(Z(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 16, 1, true)), clipM(0x2a3037, { side: THREE.DoubleSide })), g);
    const pr = new THREE.Group(); g.add(pr); props.push(pr);
    for (let i = 0; i < 3; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.03), clipM(0x9aa3ad)), pr); b.geometry.translate(0, 0.11, 0); b.rotation.z = i / 3 * Math.PI * 2; }
  });
  // lamp bar with LED lamps above and beside the viewport
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, fog: false, toneMapped: false, clippingPlanes: cut.planes });
  const lampPos = [[-0.62, 0.62, 1.05], [0.62, 0.62, 1.05], [-0.75, -0.55, 0.85], [0.75, -0.55, 0.85]];
  const lampHeads = lampPos.map(p => {
    const h = add(new THREE.Mesh(Z(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 12)), clipM(0x262b31)), body); h.position.set(...p);
    const e = add(new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), lampMat), body); e.position.set(p[0], p[1], p[2] + 0.075); return e;
  });
  
  // spotlights (real lighting) + additive light cones
  const spots = lampPos.slice(0, 2).map(p => {
    const s = new THREE.SpotLight(0xfff1d8, 90, 40, 0.5, 0.55, 1.6);
    s.position.set(p[0], p[1], p[2] + 0.1); s.target.position.set(p[0] * 0.5, -2.2, 7); sub.add(s, s.target); return s;
  });
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = k * 0.11 * pow(vY, 2.2) * edge; gl_FragColor = vec4(vec3(1.0,0.93,0.78)*a, a); }',
  });
  const cones = lampPos.slice(0, 2).map(p => {
    const len = 9, g = new THREE.ConeGeometry(2.6, len, 24, 1, true); g.translate(0, -len / 2, 0);   // apex at origin, opens to -y
    const m = add(new THREE.Mesh(g, coneMat), sub); m.position.set(p[0], p[1], p[2] + 0.1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(p[0] * 0.5 - p[0], -2.2 - p[1], 7 - p[2]).normalize());
    m.renderOrder = 30; return m;
  });

  // ------------------------------------------------------------------ cabin interior
  const cabin = new THREE.Group(); sub.add(cabin);
  const cabinLight = new THREE.PointLight(0xffc08a, 0.9, 3, 1.5); cabinLight.position.set(0, 0.55, -0.15); cabin.add(cabinLight);
  const deck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), clipM(0x3c444d)), cabin); deck.position.y = -0.55;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 40).rotateX(Math.PI / 2), clipM(0xc8ccd0)), cabin).position.y = 0.42;
  // small equipment boxes on the walls
  [[-0.55, 0.05, -0.2, 0x2f6fb3], [0.55, 0.0, -0.25, 0x4a525c], [-0.42, -0.38, 0.35, 0x4a525c], [0.5, -0.3, 0.3, 0xc0392b]].forEach(([x, y, z, c]) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), clipM(c)), cabin).position.set(x, y, z);
  });
  const leds = [];
  [[-0.47, 0.13, -0.11, 0x52ff9a], [0.47, 0.08, -0.15, 0xff4d4d], [-0.34, -0.3, 0.45, 0x39c6ff]].forEach(([x, y, z, c]) => {
    const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, clippingPlanes: cut.planes })), cabin); m.position.set(x, y, z); leds.push(m);
  });

  // control panel (tilted toward the pilot) with live screens
  const panel = new THREE.Group(); panel.position.set(0, -0.27, 0.42); panel.rotation.x = -0.55; cabin.add(panel);
  const pbox = add(new THREE.Mesh(facet(new THREE.BoxGeometry(0.86, 0.06, 0.32), 0.0), clipM(0x262c33, { metalness: 0.3, roughness: 0.5 })), panel);
  cut.add(pbox, capMat(0x3a424b));
  function screen(w, h, x, z, draw) {
    const c = document.createElement('canvas'); c.width = Math.round(512 * w / h); c.height = 512;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, clippingPlanes: cut.planes })), panel);
    m.rotation.set(-Math.PI / 2, 0, Math.PI); m.position.set(x, 0.032, z);
    let last = null;
    return (state) => { const key = JSON.stringify(state); if (key === last) return; last = key; draw(c.getContext('2d'), c.width, c.height, state); tex.needsUpdate = true; };
  }
  const FONT = '"Inter", "DejaVu Sans", sans-serif';
  const bg = (g, W, H) => { g.fillStyle = '#04131c'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,220,255,0.35)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8); };
  const depthScreen = screen(0.3, 0.17, 0, -0.03, (g, W, H, s) => {
    bg(g, W, H); g.fillStyle = '#7fe9ff'; g.font = `700 70px ${FONT}`; g.textAlign = 'center'; g.fillText('DEPTH', W / 2, 110);
    g.fillStyle = '#ffffff'; g.font = `800 190px ${FONT}`; g.fillText(Math.round(s.d).toLocaleString('en-US'), W / 2, 330);
    g.fillStyle = '#7fe9ff'; g.font = `700 80px ${FONT}`; g.fillText('METERS', W / 2, 450);
  });
  const sonarScreen = screen(0.17, 0.15, -0.3, -0.02, (g, W, H, s) => {
    bg(g, W, H); const cx = W / 2, cy = H / 2 + 20, R = 190;
    g.strokeStyle = 'rgba(82,255,154,0.45)'; g.lineWidth = 5; [1, 0.66, 0.33].forEach(k => { g.beginPath(); g.arc(cx, cy, R * k, 0, Math.PI * 2); g.stroke(); });
    const a = s.a; const gr = g.createConicGradient ? g.createConicGradient(a - 0.9, cx, cy) : null;
    if (gr) { gr.addColorStop(0, 'rgba(82,255,154,0)'); gr.addColorStop(0.14, 'rgba(82,255,154,0.55)'); gr.addColorStop(0.15, 'rgba(82,255,154,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#52ff9a'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    g.fillStyle = '#52ff9a'; g.font = `700 52px ${FONT}`; g.textAlign = 'center'; g.fillText('SONAR', cx, 70);
  });
  const presScreen = screen(0.17, 0.15, 0.3, -0.02, (g, W, H, s) => {
    bg(g, W, H); g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.font = `700 52px ${FONT}`; g.fillText('OUTSIDE', W / 2, 80);
    g.fillStyle = '#ffffff'; g.font = `800 140px ${FONT}`; g.fillText(Math.round(s.p).toLocaleString('en-US'), W / 2, 270);
    g.fillStyle = '#ffd23f'; g.font = `700 64px ${FONT}`; g.fillText('BAR', W / 2, 360);
    g.fillStyle = s.ok ? '#52ff9a' : '#ff4d4d'; g.fillRect(W * 0.2, 410, W * 0.6, 40);
  });
  // buttons
  for (let i = 0; i < 10; i++) {
    const c = [0x52ff9a, 0xffd23f, 0x39c6ff, 0xff4d4d][i % 4];
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.03), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, clippingPlanes: cut.planes })), panel);
    b.position.set(-0.36 + (i % 5) * 0.035 + (i >= 5 ? 0.55 : 0), 0.035, 0.11);
  }
  const joy = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.09, 8), clipM(0x111418)), panel); joy.position.set(0.33, 0.07, 0.1);

  // first-person hands ("you"), resting on the panel; sleeves match the pilot's shirt
  const hands = new THREE.Group(); panel.add(hands);
  const skin = lp.color(CAST.otto.skin), sleeve = lp.color(CAST.otto.shirt);
  const fingers = [];
  [-1, 1].forEach(s => {
    const wrist = new THREE.Vector3(s * 0.17, 0.05, 0.02), elbow = new THREE.Vector3(s * 0.3, -0.16, -0.42);
    const dir = wrist.clone().sub(elbow), len = dir.length();
    const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, len, 8), sleeve), hands);
    arm.position.copy(elbow).addScaledVector(dir, 0.5); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const cuff = add(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 8), lp.color(0x167f7f)), hands);
    cuff.position.copy(wrist).addScaledVector(dir.clone().normalize(), -0.02); cuff.quaternion.copy(arm.quaternion);
    const hand = new THREE.Group(); hand.position.copy(wrist); hands.add(hand);
    add(new THREE.Mesh(facet(new THREE.BoxGeometry(0.085, 0.03, 0.09), 0.003), skin), hand).position.set(0, 0, 0.045);
    for (let f = 0; f < 4; f++) {
      const fg = new THREE.Group(); fg.position.set(-0.03 + f * 0.02, 0, 0.09); hand.add(fg);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.05 - Math.abs(f - 1.5) * 0.006), skin), fg).position.set(0, -0.004, 0.022);
      fingers.push({ fg, s, f });
    }
    const th = add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.045), skin), hand); th.position.set(-s * 0.05, -0.004, 0.035); th.rotation.y = s * 0.6;
  });

  // pilot for the cutaway (Otto, without hard hat), sitting on the deck
  const otto = makeCharacter({ ...CAST.otto, hat: null }, { scale: 0.72 });
  otto.position.set(-0.22, -0.53 - 0.62 * 0.72 + 0.07, -0.12); cabin.add(otto);
  otto.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.clippingPlanes = cut.planes; } });
  otto.userData.legs.forEach(l => (l.rotation.x = -1.45));

  // ------------------------------------------------------------------ deep water: marine snow + bioluminescence
  const snow = makeParticles(ctx, { n: 1400, color: 0xd8e6ee, emissive: 0x8fb4c8, emissiveIntensity: 0.35 });
  const glow = makeParticles(ctx, { n: 120, color: 0x6fffe0, emissive: 0x4fffd0, emissiveIntensity: 2.2 });
  glow.mesh.material.fog = false;
  const W = (v, h) => ((v + h) % (2 * h) + 2 * h) % (2 * h) - h;
  const V = new THREE.Vector3();
  /** fixed-in-water particles in a box around `c`, rising past the descending sub at `rise` m/s */
  function marineSnow(t, c, half, count, size, rise = 0.25) {
    for (let i = 0; i < count; i++) {
      V.set(c.x + W(rand(i * 3) * 97 - c.x, half), c.y + W(rand(i * 3 + 1) * 97 + rise * t - c.y, half), c.z + W(rand(i * 3 + 2) * 97 - c.z, half));
      V.x += Math.sin(t * 0.4 + i) * 0.05;
      if (V.length() < 2.1 && V.z < 1.3 && Math.abs(V.x) < 1.15) continue;   // never inside the submersible
      snow.put(V, size * (0.5 + rand(i + 7)));
    }
  }
  function biolum(t, count, near, far, k = 1) {
    for (let i = 0; i < count; i++) {
      const r = lerp(near, far, rand(i + 300)), a = (rand(i + 301) - 0.5) * 1.6, b = (rand(i + 302) - 0.5) * 1.1;
      V.set(Math.sin(a) * r, Math.sin(b) * r * 0.6, Math.cos(a) * r);
      V.x += Math.sin(t * 0.3 + i) * 0.2; V.y += Math.cos(t * 0.25 + i * 2) * 0.15;
      const blink = Math.max(0, Math.sin(t * (1.2 + rand(i + 303) * 2.5) + i * 7)) ** 4;
      const s = 0.035 * k * blink * (0.6 + rand(i + 304));
      if (s > 0.002) glow.put(V, s);
    }
  }

  // jellyfish (translucent, bioluminescent)
  const jelly = new THREE.Group(); scene.add(jelly);
  const bellMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3fc8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.42, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false, flatShading: true, fog: false });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), bellMat); bell.scale.y = 0.75; jelly.add(bell);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), new THREE.MeshBasicMaterial({ color: 0xff7ae0, transparent: true, opacity: 0.75, fog: false, toneMapped: false })); core.position.y = 0.08; jelly.add(core);
  const rimDots = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9ffcff, fog: false, toneMapped: false })); m.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32); jelly.add(m); rimDots.push(m); }
  const tentMat = new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
  const tentacles = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, rr = i % 2 ? 0.28 : 0.1, n = i % 2 ? 7 : 5, segL = i % 2 ? 0.13 : 0.11;
    let parent = new THREE.Group(); parent.position.set(Math.cos(a) * rr, -0.01, Math.sin(a) * rr); jelly.add(parent);
    const chain = [];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, segL, 4), tentMat); m.geometry.translate(0, -segL / 2, 0);
      parent.add(m); chain.push(m); const nx = new THREE.Group(); nx.position.y = -segL; m.add(nx); parent = nx;
    }
    tentacles.push({ chain, ph: i * 0.7 });
  }
  function jellyPose(t) {
    const p = Math.sin(t * 2.4);
    bell.scale.set(1 - 0.08 * p, 0.75 + 0.1 * p, 1 - 0.08 * p);
    rimDots.forEach((m, i) => { m.material.color.setHSL(0.5 + 0.05 * Math.sin(t * 3 + i), 1, 0.65 + 0.25 * Math.sin(t * 4 + i * 0.8)); });
    tentacles.forEach(tc => tc.chain.forEach((m, k) => { m.rotation.x = 0.25 * Math.sin(t * 2.0 - k * 0.6 + tc.ph); m.rotation.z = 0.15 * Math.cos(t * 1.7 - k * 0.5 + tc.ph); }));
  }

  // distant anglerfish-like predator: dark body, glowing lure
  const fish = new THREE.Group(); scene.add(fish);
  const fishMat = lp.color(0x1a2026, { roughness: 0.6, emissive: 0x0a1820, emissiveIntensity: 0.5 });
  const fbody = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(1, 1), 0.08, 4), fishMat); fbody.scale.set(0.9, 0.75, 1.2); fish.add(fbody);
  const jaw = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.7, 1), 0.05, 5), fishMat); jaw.position.set(0, -0.45, 0.7); jaw.scale.set(1.05, 0.45, 0.8); fish.add(jaw);
  const toothM = new THREE.MeshBasicMaterial({ color: 0xc8d6dc });
  for (let i = 0; i < 9; i++) { const tt = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), toothM); const a = (i / 8 - 0.5) * 2.2; tt.position.set(Math.sin(a) * 0.62, -0.18, 0.95 + Math.cos(a) * 0.2); tt.rotation.x = Math.PI; fish.add(tt); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), fishMat); tail.rotation.x = -Math.PI / 2; tail.position.z = -1.5; tail.scale.x = 0.25; fish.add(tail);
  const eyeF = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8fa6ad })); eyeF.position.set(0.55, 0.25, 0.6); fish.add(eyeF);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.3, 5), fishMat); rod.position.set(0, 1.0, 0.75); rod.rotation.x = 0.7; fish.add(rod);
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc8ff9a, fog: false, toneMapped: false })); lure.position.set(0, 1.5, 1.25); fish.add(lure);
  const lureHalo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fff7a, transparent: true, opacity: 0.12, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); lure.add(lureHalo);
  const lureLight = new THREE.PointLight(0xb0ff8a, 0.8, 4, 1.6); lure.add(lureLight);

  // ------------------------------------------------------------------ trench floor (S06)
  const floorGeo = new THREE.PlaneGeometry(160, 160, 70, 70); floorGeo.rotateX(-Math.PI / 2);
  { const a = floorGeo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const x = a[i], z = a[i + 2]; a[i + 1] = 0.35 * Math.sin(x * 0.3) * Math.cos(z * 0.25) + (rand(i) - 0.5) * 0.35 + 0.004 * (x * x) * 0.2; } floorGeo.computeVertexNormals(); }
  const floor = new THREE.Mesh(floorGeo, lp.color(0x8a8172, { roughness: 1 })); floor.position.y = -2.6; floor.receiveShadow = true; scene.add(floor);
  const rocks = new THREE.Group(); floor.add(rocks);
  for (let i = 0; i < 40; i++) { const r = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.25 + rand(i + 50) * 0.6, 0), 0.08, i), lp.color(0x6e675c)); r.position.set((rand(i + 51) - 0.5) * 40, 0.1, (rand(i + 52) - 0.5) * 40); r.scale.y = 0.5; rocks.add(r); }
  // sea cucumbers (common on hadal floors)
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.25, 3, 6).rotateZ(Math.PI / 2), lp.color(0xd98ab0, { emissive: 0x401020, emissiveIntensity: 0.3 })); c.position.set(-1.5 + rand(i + 80) * 3, 0.1, 3 + rand(i + 81) * 4); c.rotation.y = rand(i + 82) * 3; rocks.add(c); }

  // ------------------------------------------------------------------ S03 pressure arrows + depth gauge
  const arrows = [];
  for (let i = 0; i < 18; i++) {
    const y = 1 - (i + 0.5) / 18 * 2, rr = Math.sqrt(1 - y * y), a = i * 2.399963;
    const n = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const ar = kit.parts.arrow(0xff5a4d, 0.05); ar.traverse(o => { if (o.material) o.material.fog = false; }); scene.add(ar); arrows.push({ ar, n });
  }
  function placeArrows(k, c, rStart, rEnd, pulse) {
    arrows.forEach(({ ar, n }, i) => {
      const r0 = rStart + 0.25 * Math.sin(pulse + i);
      ar.position.set(c[0] + n.x * r0 * 0.8, c[1] + n.y * r0, c[2] + n.z * r0 * 1.15);
      ar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
      ar.setLength(Math.max(0.2, r0 - rEnd)); ar.setOpacity(k);
    });
  }
  // ring of arrows lying on the section plane (S04): x = +0.03
  const ring = [];
  for (let i = 0; i < 14; i++) { const ar = kit.parts.arrow(0xff5a4d, 0.03); ar.traverse(o => { if (o.material) o.material.fog = false; }); scene.add(ar); ring.push({ ar, a: i / 14 * Math.PI * 2 }); }
  function placeRing(k, t) {
    ring.forEach(({ ar, a }, i) => {
      const r0 = 1.35 + 0.08 * Math.sin(t * 4 + i);
      const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      ar.position.set(0.05, n.y * r0, n.z * r0); ar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
      ar.setLength(r0 - RO - 0.02); ar.setOpacity(k);
    });
  }
  const gauge = new THREE.Group(); scene.add(gauge);
  const GTOP = 40, GBOT = 2, gy = m => lerp(GBOT, GTOP, 1 - m / 10000);   // metres of depth -> scene y
  const gaugeMat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 1 }, top: { value: GTOP }, bot: { value: GBOT } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying float vy; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vy = w.y; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'uniform float k, top, bot; varying float vy; void main(){ float h = clamp((vy-bot)/(top-bot),0.0,1.0); vec3 c = mix(vec3(0.08,0.25,0.45), vec3(0.55,0.95,1.0), pow(h,2.0)); gl_FragColor = vec4(c, k*(0.35+0.65*h)); }',
  });
  const gline = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GTOP - GBOT, 8), gaugeMat); gline.position.set(2.2, (GTOP + GBOT) / 2, 0); gauge.add(gline);
  const ticks = [];
  for (let m = 0; m <= 10000; m += 1000) { const tk = new THREE.Mesh(new THREE.BoxGeometry(m % 5000 ? 0.5 : 1.0, 0.06, 0.06), gaugeMat); tk.position.set(2.2, gy(m), 0); gauge.add(tk); ticks.push(tk); }
  const surface = new THREE.Mesh(new THREE.CircleGeometry(3.5, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.35, fog: false, side: THREE.DoubleSide, depthWrite: false })); surface.position.set(2.2, GTOP + 0.05, 0); gauge.add(surface);
  const sunRays = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.5, 4, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending, uniforms: { k: gaugeMat.uniforms.k },
    vertexShader: 'varying float v; void main(){ v = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float k; varying float v; void main(){ float a = k*0.18*pow(v,1.5); gl_FragColor = vec4(vec3(0.6,0.9,1.0)*a, a); }',
  })); sunRays.position.set(2.2, GTOP - 2, 0); gauge.add(sunRays);

  // ------------------------------------------------------------------ labels
  const L = {
    press: new Label(ctx, '≈1,000× SURFACE PRESSURE', { accent: '#ff5a4d', size: 0.03 }),
    you: new Label(ctx, 'YOU · 10,000 m', { accent: '#ffd23f' }),
    surf: new Label(ctx, 'SURFACE · 0 m', { accent: '#7fe9ff' }),
    sun: new Label(ctx, 'SUNLIGHT FADES OUT · ~1,000 m', { accent: '#7fe9ff', size: 0.026 }),
    sphere: new Label(ctx, 'TITANIUM PRESSURE SPHERE', { accent: '#d4d9df', size: 0.028 }),
    wall: new Label(ctx, '9 cm THICK WALL', { accent: '#ff5a4d' }),
    foam: new Label(ctx, 'BUOYANCY FOAM', { accent: '#f2a531' }),
    win: new Label(ctx, 'THICK ACRYLIC WINDOW', { accent: '#7fe9ff', size: 0.026 }),
  };

  // ------------------------------------------------------------------ state
  const hemiColor = ctx.studio.hemi.color.clone(), hemiGround = ctx.studio.hemi.groundColor.clone(), sunColor = ctx.studio.sun.color.clone();
  function reset() {
    cut.setPlane([-1, 0, 0], 100);
    sub.position.set(0, 0, 0); sub.rotation.set(0, 0, 0);
    Object.values(L).forEach(l => l.set(0));
    arrows.forEach(a => a.ar.setOpacity(0)); ring.forEach(a => a.ar.setOpacity(0));
    gauge.visible = false; gaugeMat.uniforms.k.value = 0;
    jelly.visible = false; fish.visible = false; floor.visible = false;
    cabin.visible = true; hands.visible = true; otto.visible = false;
    cones.forEach(c => (c.visible = true)); coneMat.uniforms.k.value = 1; spots.forEach(s => (s.intensity = 90));
    reflMat.opacity = 0.22;
    ctx.studio.sky.visible = false;
    ctx.studio.sun.intensity = 0.0; ctx.studio.sun.color.copy(sunColor); ctx.studio.sun.castShadow = false;
    ctx.studio.hemi.intensity = 0.25; ctx.studio.hemi.color.set(0x2a5a80); ctx.studio.hemi.groundColor.set(0x000000);
    ctx.grade.uniforms.fade.value = 0;
    camera.near = 0.1; camera.updateProjectionMatrix();
    snow.begin(); glow.begin();
  }
  function water(col, density) { const c = new THREE.Color(col); scene.background = c; scene.fog = new THREE.FogExp2(c, density); }
  function firstPerson() { camera.near = 0.015; camera.updateProjectionMatrix(); }
  const vib = (t, a = 1) => [a * 0.0025 * Math.sin(t * 37) + a * 0.0015 * Math.sin(t * 61), a * 0.002 * Math.sin(t * 43 + 1), 0];
  const addV = (p, v) => [p[0] + v[0], p[1] + v[1], p[2] + v[2]];
  function finish(t, depth = 10000) {
    props.forEach((p, i) => (p.rotation.z = t * (6 + i)));
    fingers.forEach(({ fg, s, f }) => { fg.rotation.x = s > 0 && f === 1 ? 0.35 * Math.max(0, Math.sin(t * 5)) ** 6 : 0.12; });
    leds.forEach((m, i) => (m.visible = Math.sin(t * (2 + i) + i) > -0.6));
    depthScreen({ d: depth }); sonarScreen({ a: Math.round(t * 2.2 * 30) / 30 }); presScreen({ p: depth * 0.0994 + 1, ok: true });
    otto.pose({ blink: blinkAt(t, 5), armL: [-1.25, 0, -0.1], armR: [-1.25, 0, 0.1], elbowL: -0.35, elbowR: -0.35, head: [0.05, 0, 0], mouth: 'o', brows: 0.4 });
    otto.userData.legs.forEach(l => (l.rotation.x = -1.45));
    snow.end(); glow.end();
  }

  // ------------------------------------------------------------------ scenes
  const scenes = {
    S01(t, d) {
      const u = t / d;
      firstPerson();
      const depth = lerp(9930, 10000, seg(u, 0, 0.75, easeOut));
      water(new THREE.Color(0x0a3552).lerp(new THREE.Color(0x01070e), seg(u, 0, 0.8)), 0.1);
      ctx.studio.hemi.intensity = lerp(0.6, 0.25, seg(u, 0, 0.8));
      const look = [0.04 * Math.sin(t * 0.4), lerp(-1.0, -0.85, seg(u, 0, 1)), 2];
      set(P(addV([0, lerp(0.28, 0.25, u), lerp(-0.16, -0.02, seg(u, 0, 1))], vib(t)), look, 64));
      marineSnow(t, camera.position, 5, 900, 0.014, lerp(1.4, 0.35, seg(u, 0, 0.8)));
      biolum(t, 20, 3, 10, seg(u, 0.5, 1));
      finish(t, depth);
    },
    S02(t, d) {
      const u = t / d;
      firstPerson();
      water(0x01070e, 0.1);
      reflMat.opacity = lerp(0.22, 0.34, seg(u, 0.2, 0.6));
      const lx = 0.55 * Math.sin(seg(u, 0.35, 1, x => clamp(x)) * Math.PI * 2) * seg(u, 0.3, 0.45);
      const pos = path([[0, P([0, 0.25, -0.02], [0, -0.85, 2], 64)], [0.4 * d, P([0, 0.08, 0.4], [0, -0.05, 2], 64)], [d, P([0, 0.07, 0.44], [0, -0.02, 2], 64)]], t);
      pos.look = [pos.look[0] + lx * 0.9, pos.look[1] + 0.05 * Math.sin(t * 0.7), 2]; pos.pos = addV(pos.pos, vib(t, 0.6));
      set(pos);
      marineSnow(t, camera.position, 5, 900, 0.014, 0.3);
      biolum(t, 110, 2.0, 11, 1.2);
      finish(t);
    },
    S03(t, d) {
      const u = t / d;
      water(0x020a14, 0.016);
      cabin.visible = false; hands.visible = false;
      ctx.studio.sun.intensity = 0.9; ctx.studio.sun.color.set(0x7fb4ff); ctx.studio.sun.position.set(6, 12, 8); ctx.studio.sun.target.position.set(0, 0, 0);
      ctx.studio.hemi.intensity = 0.55;
      const A = a => P([Math.sin(a) * 7.5, 1.0, Math.cos(a) * 7.5], [0, 0.4, -0.6], 40);
      if (u < 0.46) set(A(0.9 - 0.8 * (u / 0.46)));
      else set(path([[0.46 * d, A(0.1)], [d, P([14, 10, 48], [1.2, 18, 0], 54)]], t));
      placeArrows(seg(u, 0.05, 0.15) * (1 - 0.5 * seg(u, 0.6, 0.8)), [0, 0.6, -0.9], 3.4, 2.15, t * 5);
      L.press.set(seg(u, 0.12, 0.2) * (1 - seg(u, 0.5, 0.56)), [0, 2.3, -0.6], [-0.75, 0.38]);
      gauge.visible = u > 0.4; gaugeMat.uniforms.k.value = seg(u, 0.42, 0.62);
      L.you.set(seg(u, 0.6, 0.68), [2.2, GBOT, 0], [0.15, -0.55]);
      L.sun.set(seg(u, 0.72, 0.8), [2.2, gy(1000), 0], [-0.9, 0.62]);
      L.surf.set(seg(u, 0.66, 0.74), [2.2, GTOP, 0], [0.2, 0.86]);
      marineSnow(t, new THREE.Vector3(0, 6, 4), 14, 1300, 0.05, 0.25);
      biolum(t, 40, 6, 25, 2.0);
      finish(t);
    },
    S04(t, d) {
      const u = t / d;
      water(0x020a14, 0.02);
      hands.visible = false; otto.visible = true;
      ctx.studio.sun.intensity = 0.9; ctx.studio.sun.color.set(0x8fbcff); ctx.studio.sun.position.set(8, 10, 6); ctx.studio.sun.target.position.set(0, 0, 0);
      ctx.studio.hemi.intensity = 0.7;
      cut.setPlane([-1, 0, 0], lerp(1.4, 0.0, seg(u, 0.1, 0.32)));
      cones.forEach(c => (c.visible = u < 0.2)); coneMat.uniforms.k.value = 1 - seg(u, 0.05, 0.2);
      cabinLight.intensity = 1.4 + 1.2 * seg(u, 0.25, 0.4);
      const a = lerp(0.95, -0.55, seg(u, 0.0, 1, x => smooth(clamp(x))));
      const r = lerp(5.6, 3.4, seg(u, 0.05, 0.45));
      set(P([Math.cos(a) * r + 0.0, lerp(1.6, 0.6, seg(u, 0, 0.5)), Math.sin(a) * r * 0.9 - 0.2], [0, 0.05, -0.15], 38));
      placeRing(seg(u, 0.42, 0.52), t);
      L.sphere.set(seg(u, 0.36, 0.44), [0, RO * 0.72, -RO * 0.72], [-0.82, 0.42]);
      L.wall.set(seg(u, 0.5, 0.58), [0, -RO * 0.7, RO * 0.7 - 0.06], [0.12, -0.36]);
      L.foam.set(seg(u, 0.64, 0.72), [0, 1.6, -1.4], [-0.8, 0.3]);
      marineSnow(t, new THREE.Vector3(0, 0.5, 0), 9, 700, 0.035, 0.2);
      finish(t);
    },
    S05(t, d) {
      const u = t / d;
      firstPerson();
      water(0x01070e, 0.1);
      jelly.visible = true; fish.visible = u > 0.3;
      const k = seg(u, 0.02, 0.8, x => clamp(x));
      jelly.position.set(lerp(-2.4, 2.3, k), lerp(0.7, -0.15, k) + 0.08 * Math.sin(t * 2.4), lerp(3.2, 2.5, Math.sin(k * Math.PI)));
      jelly.rotation.set(0.25 * Math.sin(t * 0.8), t * 0.3, lerp(-0.4, 0.3, k));
      jellyPose(t);
      // the predator far away, drifting, lure pulsing
      fish.position.set(-3.6 + 0.3 * Math.sin(t * 0.3), 1.0 + 0.2 * Math.sin(t * 0.5), 13);
      fish.rotation.set(0, 2.4 + 0.1 * Math.sin(t * 0.4), 0);
      const lk = seg(u, 0.35, 0.6) * (0.75 + 0.25 * Math.sin(t * 3.1));
      lure.scale.setScalar(Math.max(0.01, lk)); lureLight.intensity = 0.8 * lk;
      const follow = jelly.position.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0, 1.2));
      const target = new THREE.Vector3(-3.6, 1.2, 13).normalize().multiplyScalar(2);
      const lookV = follow.lerp(target, seg(u, 0.78, 0.95));
      set(P(addV([0, 0.065, 0.38], vib(t, 0.5)), [lookV.x, lookV.y, lookV.z], 64));
      marineSnow(t, camera.position, 5, 800, 0.014, 0.25);
      biolum(t, 50, 3, 11, 1.0);
      finish(t);
    },
    S06(t, d) {
      const u = t / d;
      water(0x01060c, 0.03);
      cabin.visible = true; hands.visible = false; otto.visible = true; floor.visible = true;
      ctx.studio.hemi.intensity = 0.12;
      spots.forEach(s => (s.intensity = 140)); coneMat.uniforms.k.value = 1.2;
      sub.position.y = 0.05 * Math.sin(t * 0.7);
      set(path([[0, P([2.8, 0.7, 5.0], [0, -0.4, 1.8], 40)], [0.35 * d, P([5.5, 2.5, 10], [0, -0.8, 2.0], 40)], [d, P([16, 15, 36], [0, -1.0, 2.5], 40)]], t, x => smooth(clamp(x)) * 0.7 + clamp(x) * 0.3));
      marineSnow(t, new THREE.Vector3(camera.position.x * 0.5, 2, camera.position.z * 0.5), 14, 1300, 0.025, 0.15);
      biolum(t, 30, 8, 30, 2.4);
      ctx.grade.uniforms.fade.value = seg(t, d - 1.8, d - 0.25);
      finish(t);
    },
  };
  return { reset, scenes };
}

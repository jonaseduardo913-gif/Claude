// =====================================================================
//  Characters — caricature cavepeople and dinosaurs built from primitives
//  Every character faces +Z. set(p) poses it from scratch each frame.
// =====================================================================
import { THREE, scene, add, grp, limb, eye, mat, geo, clamp, lerp } from './engine.js';

const P = Math.PI;
const g3 = (v, d = 0) => (Array.isArray(v) ? v : [d, d, d]);

// ---------------------------------------------------------------- humans
export function makeHuman(o = {}) {
  const skin = o.skin || '#e2a477', hair = o.hair || '#3b2414', cloth = o.cloth || '#e8902e', spot = o.spot || '#7a3f12';
  const hr = o.headR ?? 0.3, bw = (o.bodyW ?? 0.3), bh = o.bodyH ?? 0.34, bd = o.bodyD ?? 0.26, legLen = o.legLen ?? 0.36;
  const root = new THREE.Group(); scene.add(root);
  const body = grp(root);
  const hips = grp(body, [0, legLen + 0.04, 0]);
  const torso = grp(hips);
  add(torso, 'sph', skin, [0, bh * 0.95, 0], [bw, bh, bd]);
  // fur tunic (lower part of a slightly bigger ellipsoid) with leopard spots and a shoulder strap
  const tun = add(torso, new THREE.SphereGeometry(1, 32, 20, 0, P * 2, o.tunicTop ?? 1.2, P - (o.tunicTop ?? 1.2)), cloth, [0, bh * 0.95, 0], [bw * 1.07, bh * 1.07, bd * 1.09]);
  tun.material = mat(cloth, { r: 0.85, side: 1 });
  for (let i = 0; i < 11; i++) {
    const th = 1.35 + (i * 0.37) % 1.1, ph = i * 2.4;
    add(torso, 'sph', mat(spot, { r: 0.9 }), [Math.sin(th) * Math.cos(ph) * bw * 1.08, bh * 0.95 + Math.cos(th) * bh * 1.08, Math.sin(th) * Math.sin(ph) * bd * 1.1], [bw * 0.13, bh * 0.11, bd * 0.13]);
  }
  add(torso, geo.cap(bw * 0.12, bh * 1.5), mat(cloth, { r: 0.85 }), [-bw * 0.35, bh * 1.35, bd * 0.15], 1, [0.25, 0, -0.75]);
  add(torso, geo.cap(bw * 0.12, bh * 1.5), mat(cloth, { r: 0.85 }), [-bw * 0.35, bh * 1.35, -bd * 0.15], 1, [-0.25, 0, -0.75]);
  if (o.belt) add(torso, 'torus', o.belt, [0, bh * 0.45, 0], [bw * 1.02, bd * 1.04, 0.5], [P / 2, 0, 0]);

  // head
  const neck = grp(torso, [0, bh * 1.75, 0]);
  const head = grp(neck, [0, hr * 0.85, 0]);
  add(head, 'sph', skin, [0, 0, 0], [hr, hr * (o.headTall ?? 1), hr * 0.98]);
  const eyeR = hr * 0.27 * (o.eyes ?? 1);
  const eyeL = eye(head, [hr * 0.37, hr * 0.17, hr * 0.78], eyeR, { lid: skin, lashes: o.lashes, side: 1, iris: o.iris });
  const eyeRr = eye(head, [-hr * 0.37, hr * 0.17, hr * 0.78], eyeR, { lid: skin, lashes: o.lashes, side: -1, iris: o.iris });
  const nz = o.nose ?? 1;
  add(head, 'sph', mat(o.noseCol || skin, { r: 0.5 }), [0, -hr * 0.08, hr * (0.95 + 0.05 * nz)], [hr * 0.22 * nz, hr * 0.19 * nz, hr * 0.24 * nz]);
  if (o.cheeks) for (const s of [1, -1]) add(head, 'sph', mat(o.cheeks, { r: 0.7 }), [s * hr * 0.6, -hr * 0.22, hr * 0.62], [hr * 0.17, hr * 0.11, hr * 0.08]);
  for (const s of [1, -1]) add(head, 'sph', skin, [s * hr * 0.97, 0, 0], [hr * 0.13, hr * 0.2, hr * 0.13]);
  const mouth = grp(head, [0, -hr * 0.47, hr * 0.8]);
  const mIn = add(mouth, 'sph', mat('#4a1214', { r: 0.6 }), [0, 0, 0], [hr * 0.3, hr * 0.05, hr * 0.13]);
  const tongue = add(mouth, 'sph', mat('#e0606a', { r: 0.5 }), [0, -hr * 0.03, hr * 0.03], [hr * 0.17, hr * 0.04, hr * 0.08]);
  const teeth = grp(mouth);
  for (const tx of (o.teeth || [0.06])) add(teeth, 'box', mat('#fffdf2', { r: 0.3 }), [tx * hr, 0, hr * 0.1], [hr * 0.11, hr * 0.13, hr * 0.05]);
  const fangs = grp(mouth);
  if (o.fangs) for (const s of [1, -1]) add(fangs, 'cone', mat('#fffdf2', { r: 0.3 }), [s * hr * 0.18, 0, hr * 0.1], [hr * 0.05, hr * 0.12, hr * 0.05]);
  // brows
  const browL = grp(head, [hr * 0.37, hr * 0.48, hr * 0.84]), browR = grp(head, [-hr * 0.37, hr * 0.48, hr * 0.84]);
  if (o.unibrow) {
    add(browL, geo.cap(hr * 0.07, hr * 0.62), hair, [-hr * 0.2, 0, 0], 1, [0, 0, P / 2]);
    add(browR, geo.cap(hr * 0.07, hr * 0.62), hair, [hr * 0.2, 0, 0], 1, [0, 0, P / 2]);
  } else for (const b of [browL, browR]) add(b, geo.cap(hr * 0.05, hr * 0.36), o.browCol || hair, [0, 0, 0], 1, [0, 0, P / 2]);

  // hair styles
  const hairG = grp(head);
  const style = o.style || 'spiky';
  add(hairG, 'hemi', mat(hair, { r: 0.8 }), [0, hr * 0.08, -hr * 0.06], [hr * 1.05, hr * 1.0, hr * 1.04], [-0.35, 0, 0]);
  const spikes = grp(hairG, [0, hr * 0.7, -hr * 0.1]);
  if (style === 'spiky') {
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.42; add(spikes, 'cone', mat(hair, { r: 0.8 }), [Math.sin(a) * hr * 0.5, hr * 0.2, -Math.abs(a) * hr * 0.1 - hr * 0.1], [hr * 0.22, hr * 0.8, hr * 0.22], [-0.35, 0, -a * 0.9]); }
  } else if (style === 'bun') {
    add(spikes, 'sph', mat(hair, { r: 0.8 }), [0, hr * 0.42, -hr * 0.12], hr * 0.45);
    add(spikes, 'cyl', mat('#f3ead2', { r: 0.5 }), [0, hr * 0.45, -hr * 0.12], [hr * 0.05, hr * 1.4, hr * 0.05], [0, 0, P / 2 - 0.3]);
    for (const s of [1, -1]) add(spikes, 'sph', mat('#f3ead2', { r: 0.5 }), [s * Math.cos(0.3) * hr * 0.7, hr * 0.45 + s * Math.sin(0.3) * hr * 0.7, -hr * 0.12], hr * 0.08);
  } else if (style === 'shaggy') {
    for (let i = 0; i < 13; i++) { const a = (i / 12 - 0.5) * 3.6; add(hairG, 'sph', mat(hair, { r: 0.85 }), [Math.sin(a) * hr * 0.92, hr * (0.05 + 0.25 * Math.cos(a * 0.8)) - (i % 2) * hr * 0.15, -Math.cos(a) * hr * 0.55 - hr * 0.1], hr * (0.3 + (i % 3) * 0.04)); }
    for (let i = 0; i < 4; i++) add(spikes, 'cone', mat(hair, { r: 0.85 }), [(i - 1.5) * hr * 0.3, hr * 0.0, hr * 0.15], [hr * 0.16, hr * 0.42, hr * 0.16], [0.5, 0, (i - 1.5) * -0.5]);
  } else if (style === 'pigtails') {
    for (const s of [1, -1]) {
      add(hairG, 'sph', mat(hair, { r: 0.8 }), [s * hr * 1.05, hr * 0.15, -hr * 0.25], hr * 0.32);
      add(hairG, 'cone', mat('#ff5d8f', { r: 0.5 }), [s * hr * 1.0, hr * 0.5, -hr * 0.2], [hr * 0.12, hr * 0.25, hr * 0.12], [0, 0, s * 1.2]);
    }
    add(spikes, 'sph', mat('#ff5d8f', { r: 0.5 }), [0, hr * 0.15, hr * 0.25], hr * 0.1);
  }
  if (o.beard) {
    const bc = mat(o.beardCol || hair, { r: 0.9 });
    add(head, 'sph', bc, [0, -hr * 0.62, hr * 0.42], [hr * 0.78, hr * 0.62, hr * 0.55]);
    for (const s of [1, -1]) add(head, 'sph', bc, [s * hr * 0.62, -hr * 0.3, hr * 0.38], [hr * 0.35, hr * 0.45, hr * 0.4]);
  }
  if (o.glasses) for (const s of [1, -1]) add(head, 'torus', mat('#5a3418', { r: 0.4 }), [s * hr * 0.37, hr * 0.17, hr * 0.98], [eyeR * 1.15, eyeR * 1.15, eyeR * 1.5]);
  if (o.earrings) for (const s of [1, -1]) add(head, 'sph', mat(o.earrings, { r: 0.3 }), [s * hr * 1.0, -hr * 0.28, 0], hr * 0.08);
  if (o.necklace) for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; add(torso, 'cone', mat('#f6f1e0', { r: 0.4 }), [Math.sin(a) * bw * 0.75, bh * 1.55 - Math.cos(a) * bh * 0.08, Math.cos(a) * bd * 0.95], [0.025, 0.07, 0.025], [P, 0, 0]); }

  // arms & legs
  const armLen = (o.armLen ?? 0.42), armR = o.armRad ?? 0.07;
  const shoulderY = bh * 1.5;
  const aL = limb(torso, [bw * 1.0, shoulderY, 0], armLen, armR, skin);
  const aR = limb(torso, [-bw * 1.0, shoulderY, 0], armLen, armR, skin);
  for (const a of [aL, aR]) add(a.end, 'sph', skin, [0, -0.02, 0], armR * 1.45);
  const lL = limb(hips, [bw * 0.5, 0.06, 0], legLen + 0.04, o.legRad ?? 0.085, skin);
  const lR = limb(hips, [-bw * 0.5, 0.06, 0], legLen + 0.04, o.legRad ?? 0.085, skin);
  const fs = o.feet ?? 1;
  for (const l of [lL, lR]) add(l.end, 'sph', skin, [0, 0.02, 0.06 * fs], [0.1 * fs, 0.065, 0.16 * fs]);
  root.scale.setScalar(o.size ?? 1);
  const S = o.size ?? 1;

  const c = {
    root, head, torso, handL: aL.end, handR: aR.end, hairG, S,
    headWorld() { const v = new THREE.Vector3(); head.getWorldPosition(v); return [v.x, v.y, v.z]; },
    set(p = {}) {
      root.position.set(...(p.pos || [0, 0, 0])); root.rotation.set(0, p.rot || 0, p.tilt || 0);
      const ph = p.phase || 0, wa = p.walk || 0, sq = p.squash || 0;
      body.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1 + sq * 0.18);
      body.rotation.set(p.fall || 0, 0, 0);
      hips.position.y = legLen + 0.04 + Math.abs(Math.cos(ph)) * 0.05 * wa;
      torso.rotation.set((p.lean || 0) + 0.06 * wa, 0, Math.sin(ph) * 0.06 * wa + (p.sway || 0));
      const al = g3(p.armL), ar = g3(p.armR);
      aL.pivot.rotation.set(-Math.sin(ph) * 0.7 * wa + al[0], al[1] || 0, 0.12 + al[2]);
      aR.pivot.rotation.set(Math.sin(ph) * 0.7 * wa + ar[0], -(ar[1] || 0), -0.12 - ar[2]);
      lL.pivot.rotation.set(Math.sin(ph) * 0.75 * wa + (p.legL || 0), 0, p.legOut || 0);
      lR.pivot.rotation.set(-Math.sin(ph) * 0.75 * wa + (p.legR || 0), 0, -(p.legOut || 0));
      const hd = g3(p.head);
      neck.rotation.set(hd[0], hd[1], hd[2]);
      const look = p.look || [0, 0];
      const lid = p.lid ?? o.lid ?? 0;
      eyeL.set({ look, blink: p.blink || 0, lid, squint: p.squint || 0 }); eyeRr.set({ look, blink: p.blink || 0, lid, squint: p.squint || 0 });
      const m = clamp(p.mouth || 0, 0, 1.6);
      mIn.scale.y = hr * (0.035 + 0.24 * m); tongue.position.y = -hr * (0.02 + 0.13 * m); tongue.visible = m > 0.2;
      mIn.scale.x = hr * (0.3 + 0.08 * m + 0.1 * (p.smile || 0));
      teeth.position.y = hr * 0.2 * m + hr * 0.02; fangs.position.y = -hr * 0.2 * m - hr * 0.01; fangs.rotation.x = P;
      mouth.rotation.z = 0;
      const mood = p.brow || 0; // +1 surprised/raised, -1 angry, sad = 'sad'
      const by = hr * (0.48 + 0.1 * Math.max(0, mood) + (p.browY || 0));
      browL.position.y = browR.position.y = by;
      const ang = mood < 0 ? -mood * 0.45 : -(p.sad || 0) * 0.4;
      browL.rotation.z = -ang; browR.rotation.z = ang;
      hairG.position.y = hr * 0.25 * (p.hairUp || 0); spikes.scale.y = 1 + 0.8 * (p.hairUp || 0);
      root.scale.setScalar(S * (p.scale || 1));
    },
  };
  return c;
}

// ------------------------------------------------------------ Triceratops
export function makeTrike(o = {}) {
  const skin = o.skin || '#6db36f', belly = o.belly || '#efe2ad', fr = o.frill || '#f08a3c', fr2 = o.frill2 || '#ffcf5a';
  const horn = '#f6efd8', baby = !!o.baby;
  const root = new THREE.Group(); scene.add(root);
  const body = grp(root);
  const legH = baby ? 0.42 : 0.62;
  const hipG = grp(body, [0, legH, 0]);
  const bs = baby ? [0.62, 0.58, 0.82] : [0.95, 0.82, 1.35];
  add(hipG, 'sph', skin, [0, bs[1] * 0.42, 0], bs);
  add(hipG, 'sph', belly, [0, bs[1] * 0.2, bs[2] * 0.1], [bs[0] * 0.82, bs[1] * 0.72, bs[2] * 0.88]);
  for (let i = 0; i < 7; i++) {
    const zz = (i / 6 - 0.5) * 1.5, yy = bs[1] * 0.42 + bs[1] * Math.sqrt(Math.max(0, 1 - (zz / bs[2]) ** 2)) * 0.97;
    add(hipG, 'sph', mat(o.spot || '#8fd08a'), [0, yy, zz * bs[2] * 0.62], [bs[0] * 0.16, bs[1] * 0.07, bs[2] * 0.09]);
  }
  // legs
  const legR = baby ? 0.15 : 0.24;
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
    const l = limb(hipG, [sx * bs[0] * 0.58, 0.1, sz * bs[2] * 0.52], legH + 0.12, legR, skin);
    add(l.end, 'sph', skin, [0, 0.04, 0.02], [legR * 1.15, legR * 0.6, legR * 1.25]);
    for (let k = -1; k <= 1; k++) add(l.end, 'sph', horn, [k * legR * 0.55, 0.02, legR * 1.05], legR * 0.28);
    return l;
  });
  // tail
  const tail = []; let parent = grp(hipG, [0, bs[1] * 0.5, -bs[2] * 0.9]);
  for (let i = 0; i < 4; i++) {
    const r = (baby ? 0.24 : 0.38) * (1 - i * 0.22), L = (baby ? 0.32 : 0.5);
    const seg = grp(parent, i === 0 ? [0, 0, 0] : [0, 0, -L * 0.85]);
    add(seg, 'sph', skin, [0, 0, -L * 0.45], [r, r * 0.9, L * 0.62]);
    tail.push(seg); parent = seg;
  }
  // head
  const neck = grp(hipG, [0, bs[1] * 0.62, bs[2] * 0.82]);
  const head = grp(neck);
  const hs = baby ? 1.0 : 1.0;
  const sk = baby ? [0.5, 0.46, 0.52] : [0.55, 0.5, 0.62];
  add(head, 'sph', skin, [0, 0, sk[2] * 0.55], sk);
  // frill
  const frill = grp(head, [0, sk[1] * 0.45, -sk[2] * 0.05], [-1.15, 0, 0]);
  const fR = baby ? 0.55 : 0.92;
  add(frill, 'cyl', mat(fr, { r: 0.55 }), [0, 0, 0], [fR, 0.13, fR * 0.92]);
  for (let i = 0; i < 13; i++) { const a = (i / 12) * P * 1.25 - P * 0.125 + P; add(frill, 'sph', mat(o.frillRim || '#d9662a', { r: 0.5 }), [Math.cos(a) * fR * 0.98, 0, Math.sin(a) * fR * 0.9], [fR * 0.1, 0.06, fR * 0.08]); }
  for (let i = 0; i < 4; i++) { const a = P + 0.5 + i * 0.7; add(frill, 'sph', mat(fr2, { r: 0.6 }), [Math.cos(a) * fR * 0.55, 0.04, Math.sin(a) * fR * 0.5], [fR * 0.12, 0.03, fR * 0.12]); }
  // horns
  if (baby) {
    for (const s of [1, -1]) add(head, 'cone', horn, [s * sk[0] * 0.42, sk[1] * 0.78, sk[2] * 0.75], [0.06, 0.13, 0.06], [0.6, 0, 0]);
  } else {
    for (const s of [1, -1]) { const hg = grp(head, [s * sk[0] * 0.42, sk[1] * 0.7, sk[2] * 0.7], [0.95, 0, -s * 0.18]); add(hg, 'cone', horn, [0, 0.38, 0], [0.09, 0.8, 0.09]); }
    { const hg = grp(head, [0, sk[1] * 0.25, sk[2] * 1.3], [0.5, 0, 0]); add(hg, 'cone', horn, [0, 0.13, 0], [0.075, 0.3, 0.075]); }
  }
  add(head, 'cone', mat('#7b6a58', { r: 0.4 }), [0, -sk[1] * 0.1, sk[2] * 1.45], [sk[0] * 0.3, sk[2] * 0.6, sk[1] * 0.35], [P / 2, 0, 0]);
  const er = baby ? 0.19 : 0.17;
  const eL = eye(head, [sk[0] * 0.62, sk[1] * 0.38, sk[2] * 0.95], er, { lid: skin, lashes: o.lashes, side: 1 });
  const eR = eye(head, [-sk[0] * 0.62, sk[1] * 0.38, sk[2] * 0.95], er, { lid: skin, lashes: o.lashes, side: -1 });
  for (const s of [1, -1]) add(head, 'sph', mat(o.cheek || '#ff8f9a', { r: 0.7 }), [s * sk[0] * 0.78, -sk[1] * 0.12, sk[2] * 0.95], [0.11, 0.07, 0.07]);
  const mHole = add(head, 'sph', mat('#6a1a22', { r: 0.6 }), [0, -sk[1] * 0.42, sk[2] * 1.12], [sk[0] * 0.42, 0.01, sk[2] * 0.32]);
  const mTongue = add(head, 'sph', mat('#e86a78'), [0, -sk[1] * 0.5, sk[2] * 1.15], [sk[0] * 0.25, 0.01, sk[2] * 0.2]);
  const jaw = grp(head, [0, -sk[1] * 0.42, sk[2] * 0.35]);
  add(jaw, 'sph', belly, [0, -0.02, sk[2] * 0.42], [sk[0] * 0.72, sk[1] * 0.3, sk[2] * 0.72]);
  add(jaw, 'sph', mat('#8a2b30', { r: 0.6 }), [0, 0.06, sk[2] * 0.5], [sk[0] * 0.55, sk[1] * 0.12, sk[2] * 0.55]);
  add(jaw, 'sph', mat('#e86a78'), [0, 0.09, sk[2] * 0.6], [sk[0] * 0.3, sk[1] * 0.08, sk[2] * 0.3]);
  if (o.bow) { const b = grp(head, [sk[0] * 0.3, sk[1] * 0.95, sk[2] * 0.25]); for (const s of [1, -1]) add(b, 'cone', mat(o.bow), [s * 0.12, 0, 0], [0.08, 0.2, 0.08], [0, 0, s * P / 2]); add(b, 'sph', mat(o.bow), [0, 0, 0], 0.06); }
  root.scale.setScalar(o.size ?? 1); const S = o.size ?? 1;

  return {
    root, head, hip: hipG, S,
    headWorld() { const v = new THREE.Vector3(); head.getWorldPosition(v); return [v.x, v.y, v.z]; },
    set(p = {}) {
      root.position.set(...(p.pos || [0, 0, 0])); root.rotation.set(0, p.rot || 0, 0);
      const ph = p.phase || 0, wa = p.walk || 0, sq = p.squash || 0;
      body.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1 + sq * 0.1);
      hipG.position.y = legH + Math.abs(Math.sin(ph)) * 0.05 * wa + (p.hop || 0);
      hipG.rotation.set(p.pitch || 0, 0, Math.sin(ph) * 0.03 * wa + (p.roll || 0));
      const sw = [1, -1, -1, 1];
      legs.forEach((l, i) => { l.pivot.rotation.x = Math.sin(ph) * 0.55 * wa * sw[i] + (p.legs || 0) * (i < 2 ? -1 : 1); });
      const tw = p.tailWag || 0, tt = p.t || 0;
      tail.forEach((s, i) => { s.rotation.y = Math.sin(tt * 3 - i * 0.8) * (0.1 + tw * 0.25); s.rotation.x = 0.12 + (p.tailUp || 0) * -0.2; });
      const hd = g3(p.head);
      neck.rotation.set(hd[0], hd[1], hd[2]);
      const mo = clamp(p.mouth || 0, 0, 1.4);
      jaw.rotation.x = mo * 0.55;
      mHole.scale.y = 0.01 + mo * sk[1] * 0.42; mHole.position.y = -sk[1] * (0.42 + mo * 0.18);
      mTongue.scale.y = 0.01 + mo * 0.06; mTongue.position.y = -sk[1] * (0.42 + mo * 0.42); mTongue.visible = mo > 0.15;
      const look = p.look || [0, 0];
      eL.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 }); eR.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 });
      root.scale.setScalar(S * (p.scale || 1));
    },
  };
}

// ---------------------------------------------------------- Ankylosaurus
export function makeAnky(o = {}) {
  const skin = o.skin || '#b98a52', plate = o.plate || '#7a5634', belly = o.belly || '#ecd9a8';
  const root = new THREE.Group(); scene.add(root);
  const body = grp(root);
  const legH = 0.45;
  const hip = grp(body, [0, legH, 0]);
  const bs = [1.15, 0.62, 1.55];
  add(hip, 'sph', skin, [0, bs[1] * 0.45, 0], bs);
  add(hip, 'sph', belly, [0, bs[1] * 0.18, 0.1], [bs[0] * 0.85, bs[1] * 0.55, bs[2] * 0.85]);
  // armour: rows of studs and side spikes
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) {
    const z = (r / 4 - 0.5) * 1.8, a = (k / 5 - 0.5) * 2.2;
    const y0 = bs[1] * 0.45 + Math.cos(a) * bs[1] * Math.sqrt(Math.max(0, 1 - (z / bs[2]) ** 2)) * 0.98;
    const x0 = Math.sin(a) * bs[0] * Math.sqrt(Math.max(0, 1 - (z / bs[2]) ** 2)) * 0.98;
    const st = add(hip, 'cone6', mat(plate, { r: 0.7 }), [x0, y0, z], [0.13, 0.14, 0.13]);
    st.rotation.set(0, 0, -a * 0.9);
  }
  for (let k = 0; k < 5; k++) for (const s of [1, -1]) { const z = (k / 4 - 0.5) * 2.1; add(hip, 'cone', mat('#f1e4c4', { r: 0.4 }), [s * bs[0] * 0.98 * Math.sqrt(1 - (z / bs[2]) ** 2 * 0.9), bs[1] * 0.35, z], [0.09, 0.32, 0.09], [0, 0, -s * P / 2]); }
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
    const l = limb(hip, [sx * bs[0] * 0.6, 0.12, sz * bs[2] * 0.55], legH + 0.12, 0.2, skin);
    add(l.end, 'sph', skin, [0, 0.04, 0.03], [0.24, 0.12, 0.27]);
    return l;
  });
  // tail with club
  const tail = []; let par = grp(hip, [0, bs[1] * 0.45, -bs[2] * 0.92]);
  for (let i = 0; i < 6; i++) {
    const r = 0.3 * (1 - i * 0.12), L = 0.42;
    const seg = grp(par, i === 0 ? [0, 0, 0] : [0, 0, -L * 0.9]);
    add(seg, 'sph', skin, [0, 0, -L * 0.45], [r, r * 0.85, L * 0.6]);
    add(seg, 'cone6', mat(plate), [0, r * 0.75, -L * 0.45], [0.07, 0.1, 0.07]);
    tail.push(seg); par = seg;
  }
  const club = grp(par, [0, 0, -0.55]);
  add(club, 'sph', mat(plate, { r: 0.6 }), [0, 0, 0], [0.32, 0.24, 0.3]);
  for (const s of [1, -1]) add(club, 'sph', mat(plate, { r: 0.6 }), [s * 0.24, 0, 0.03], [0.22, 0.2, 0.24]);
  // head
  const neck = grp(hip, [0, bs[1] * 0.45, bs[2] * 0.9]);
  const head = grp(neck);
  add(head, 'sph', skin, [0, 0.02, 0.3], [0.45, 0.36, 0.48]);
  add(head, 'sph', mat(plate), [0, 0.22, 0.25], [0.42, 0.18, 0.42]);
  for (const s of [1, -1]) add(head, 'cone6', mat('#f1e4c4', { r: 0.4 }), [s * 0.4, 0.2, 0.05], [0.07, 0.22, 0.07], [0, 0, -s * 1.9]);
  add(head, 'sph', mat('#8b5f3a', { r: 0.5 }), [0, -0.02, 0.78], [0.2, 0.15, 0.13]);
  for (const s of [1, -1]) add(head, 'sph', mat('#2a160c'), [s * 0.08, 0.0, 0.89], [0.035, 0.028, 0.02]);
  const eL = eye(head, [0.24, 0.17, 0.62], 0.13, { lid: plate });
  const eR = eye(head, [-0.24, 0.17, 0.62], 0.13, { lid: plate });
  const jaw = grp(head, [0, -0.18, 0.25]);
  add(jaw, 'sph', belly, [0, -0.02, 0.28], [0.36, 0.12, 0.4]);
  add(jaw, 'sph', mat('#8a2b30'), [0, 0.04, 0.32], [0.28, 0.06, 0.32]);
  root.scale.setScalar(o.size ?? 1); const S = o.size ?? 1;
  return {
    root, head, club,
    clubWorld() { const v = new THREE.Vector3(); club.getWorldPosition(v); return [v.x, v.y, v.z]; },
    headWorld() { const v = new THREE.Vector3(); head.getWorldPosition(v); return [v.x, v.y, v.z]; },
    set(p = {}) {
      root.position.set(...(p.pos || [0, 0, 0])); root.rotation.set(0, p.rot || 0, 0);
      const ph = p.phase || 0, wa = p.walk || 0, sq = p.squash || 0;
      body.scale.set(1 + sq * 0.12, 1 - sq * 0.18, 1 + sq * 0.08);
      hip.position.y = legH + Math.abs(Math.sin(ph)) * 0.04 * wa + (p.hop || 0);
      hip.rotation.set(p.pitch || 0, 0, Math.sin(ph) * 0.04 * wa);
      const sw = [1, -1, -1, 1];
      legs.forEach((l, i) => { l.pivot.rotation.x = Math.sin(ph) * 0.5 * wa * sw[i] + (p.legs || 0); });
      const tt = p.t || 0, swing = p.swing || 0;
      tail.forEach((s, i) => { s.rotation.y = swing / 6 + Math.sin(tt * 2 - i * 0.7) * 0.07 * (1 - Math.abs(swing)); s.rotation.x = 0.04 - (p.tailUp || 0) * 0.12; });
      const hd = g3(p.head); neck.rotation.set(hd[0], hd[1], hd[2]);
      jaw.rotation.x = clamp(p.mouth || 0, 0, 1.5) * 0.5;
      const look = p.look || [0, 0];
      const lid = p.lid ?? 0.45;
      eL.set({ look, blink: p.blink || 0, lid, squint: p.squint || 0 }); eR.set({ look, blink: p.blink || 0, lid, squint: p.squint || 0 });
      root.scale.setScalar(S * (p.scale || 1));
    },
  };
}

// ------------------------------------------------------------ Pteranodon
export function makePtero(o = {}) {
  const skin = o.skin || '#7c6fd6', belly = o.belly || '#d8d0ff', beak = o.beak || '#f4b334', crest = o.crest || '#ff6a3d', wing = o.wing || '#a99bf0';
  const root = new THREE.Group(); scene.add(root);
  const body = grp(root);
  const torso = grp(body, [0, 0.62, 0]);
  add(torso, 'sph', skin, [0, 0, 0], [0.26, 0.3, 0.36]);
  add(torso, 'sph', belly, [0, -0.06, 0.08], [0.2, 0.24, 0.28]);
  const neck = grp(torso, [0, 0.22, 0.22]);
  const head = grp(neck);
  add(head, 'sph', skin, [0, 0.12, 0.08], [0.22, 0.2, 0.24]);
  add(head, 'cone', mat(beak, { r: 0.4 }), [0, 0.07, 0.6], [0.11, 0.85, 0.09], [P / 2, 0, 0]);
  const jaw = grp(head, [0, 0.0, 0.18]);
  add(jaw, 'cone', mat('#e09a22', { r: 0.4 }), [0, 0, 0.36], [0.08, 0.7, 0.05], [P / 2, 0, 0]);
  add(jaw, 'sph', mat('#e86a78'), [0, 0.02, 0.2], [0.05, 0.02, 0.18]);
  add(head, 'cone', mat(crest, { r: 0.5 }), [0, 0.26, -0.28], [0.07, 0.65, 0.12], [-P / 2 + 0.45, 0, 0]);
  const eL = eye(head, [0.15, 0.2, 0.2], 0.11, { lid: skin, pupil: 0.42 });
  const eR = eye(head, [-0.15, 0.2, 0.2], 0.11, { lid: skin, pupil: 0.42 });
  // wings: inner + outer membrane, left wing built along +X, right mirrored
  const wingShape = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) s.lineTo(...pts[i]); const g = new THREE.ShapeGeometry(s); g.rotateX(P / 2); return g; };
  const gIn = wingShape([[0, 0.12], [0.85, 0.09], [0.85, -0.3], [0.4, -0.38], [0, -0.42]]);
  const gOut = wingShape([[0, 0.09], [0.5, 0.06], [1.0, -0.02], [0.55, -0.2], [0, -0.3]]);
  const wm = mat(wing, { side: 1, r: 0.7 });
  const wings = [1, -1].map((s) => {
    const sh = grp(torso, [s * 0.18, 0.12, 0.05]); sh.scale.x = s;
    add(sh, gIn, wm, [0, 0, 0], 1, [0, 0, 0], { recv: true });
    add(sh, geo.cap(0.035, 0.9), skin, [0.42, 0, 0.1], 1, [0, 0, P / 2]);
    const el = grp(sh, [0.85, 0, 0]);
    add(el, gOut, wm, [0, 0, 0]);
    add(el, geo.cap(0.03, 1.0), skin, [0.5, 0, 0.06], 1, [0, 0, P / 2]);
    return { sh, el, s };
  });
  const lL = limb(torso, [0.1, -0.2, -0.05], 0.4, 0.04, skin), lR = limb(torso, [-0.1, -0.2, -0.05], 0.4, 0.04, skin);
  for (const l of [lL, lR]) for (let k = -1; k <= 1; k++) add(l.end, 'cone', mat(beak), [k * 0.04, -0.02, 0.06], [0.02, 0.12, 0.02], [P / 2, 0, 0]);
  root.scale.setScalar(o.size ?? 1); const S = o.size ?? 1;
  return {
    root, head, footL: lL.end,
    headWorld() { const v = new THREE.Vector3(); head.getWorldPosition(v); return [v.x, v.y, v.z]; },
    feetWorld() { const v = new THREE.Vector3(); lL.end.getWorldPosition(v); const w = new THREE.Vector3(); lR.end.getWorldPosition(w); v.add(w).multiplyScalar(0.5); return [v.x, v.y, v.z]; },
    set(p = {}) {
      root.position.set(...(p.pos || [0, 0, 0])); root.rotation.set(p.pitch || 0, p.rot || 0, p.bank || 0);
      const sq = p.squash || 0; body.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1 + sq * 0.15);
      const fl = p.flap || 0, fold = p.fold ?? 0, ph = p.phase || 0;
      for (const w of wings) {
        const a = Math.sin(ph) * 0.75 * fl;
        // folded: wing swept down & back along the body; open: spread
        w.sh.rotation.set(0, w.s * lerp(0, 0.25, fold), w.s * (lerp(a, -1.38, fold) + (p.wingUp || 0)));
        w.el.rotation.set(0, 0, w.s * lerp(Math.sin(ph - 0.9) * 0.45 * fl, 2.9, fold));
        w.sh.scale.set(w.s * (1 - 0.42 * fold), 1, 1 - 0.3 * fold);
      }
      torso.position.y = 0.62 + Math.abs(Math.sin(p.walkPh || 0)) * 0.04 * (p.walk || 0) + (p.bob || 0);
      torso.rotation.set(p.lean || 0, 0, 0);
      lL.pivot.rotation.x = Math.sin(p.walkPh || 0) * 0.6 * (p.walk || 0) + (p.legs || 0);
      lR.pivot.rotation.x = -Math.sin(p.walkPh || 0) * 0.6 * (p.walk || 0) + (p.legs || 0);
      const hd = g3(p.head); neck.rotation.set(hd[0], hd[1], hd[2]);
      jaw.rotation.x = clamp(p.mouth || 0, 0, 1.5) * 0.45;
      const look = p.look || [0, 0];
      eL.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 }); eR.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 });
      root.scale.setScalar(S * (p.scale || 1));
    },
  };
}

// ------------------------------------------------------------ Plesiosaur
export function makePlesio(o = {}) {
  const skin = o.skin || '#3fa9b8', belly = o.belly || '#d6efdc', spot = o.spot || '#2f8794';
  const root = new THREE.Group(); scene.add(root);
  const body = grp(root);
  add(body, 'sph', skin, [0, 0, 0], [1.05, 0.6, 1.6]);
  add(body, 'sph', belly, [0, -0.22, 0.1], [0.9, 0.42, 1.4]);
  for (let i = 0; i < 8; i++) add(body, 'sph', mat(spot), [Math.sin(i * 2.3) * 0.55, 0.5 - Math.abs(Math.sin(i * 2.3)) * 0.12, (i / 7 - 0.5) * 2.0], [0.16, 0.06, 0.14]);
  const flips = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
    const f = grp(body, [sx * 0.85, -0.2, sz * 0.8]);
    add(f, 'sph', skin, [sx * 0.5, 0, 0], [0.6, 0.08, 0.25], [0, sx * sz * 0.3, 0]);
    return { f, sx };
  });
  const tail = grp(body, [0, 0, -1.5]); add(tail, 'cone', skin, [0, 0, -0.4], [0.3, 1.0, 0.22], [-P / 2, 0, 0]);
  // neck chain
  const segs = []; let par = grp(body, [0, 0.25, 1.35]);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const r = 0.4 - i * 0.022;
    const s = grp(par, i === 0 ? [0, 0, 0] : [0, 0, 0.36]);
    add(s, 'sph', skin, [0, 0, 0.18], [r, r, 0.3]);
    add(s, 'sph', belly, [0, -r * 0.45, 0.2], [r * 0.75, r * 0.6, 0.27]);
    segs.push(s); par = s;
  }
  const head = grp(par, [0, 0, 0.42]);
  add(head, 'sph', skin, [0, 0.05, 0.12], [0.34, 0.3, 0.42]);
  const eL = eye(head, [0.22, 0.25, 0.28], 0.15, { lid: skin, lashes: o.lashes, side: 1 });
  const eR = eye(head, [-0.22, 0.25, 0.28], 0.15, { lid: skin, lashes: o.lashes, side: -1 });
  for (const s of [1, -1]) add(head, 'sph', mat('#ff9aa5'), [s * 0.27, -0.03, 0.3], [0.08, 0.05, 0.05]);
  const jaw = grp(head, [0, -0.1, 0.05]);
  add(jaw, 'sph', belly, [0, -0.04, 0.22], [0.28, 0.1, 0.36]);
  add(jaw, 'sph', mat('#8a2b30'), [0, 0.02, 0.26], [0.22, 0.05, 0.3]);
  for (let k = -2; k <= 2; k++) add(head, 'cone', mat('#fffdf2'), [k * 0.07, -0.1, 0.48 - Math.abs(k) * 0.03], [0.02, 0.06, 0.02], [P, 0, 0]);
  root.scale.setScalar(o.size ?? 1); const S = o.size ?? 1;
  return {
    root, head,
    headWorld() { const v = new THREE.Vector3(); head.getWorldPosition(v); return [v.x, v.y, v.z]; },
    mouthWorld() { const v = new THREE.Vector3(0, -0.1, 0.55); head.localToWorld(v); return [v.x, v.y, v.z]; },
    set(p = {}) {
      root.position.set(...(p.pos || [0, 0, 0])); root.rotation.set(0, p.rot || 0, 0);
      const tt = p.t || 0, sw = p.swim || 0.3;
      body.rotation.set(p.pitch || 0, 0, Math.sin(tt * 1.3) * 0.04);
      flips.forEach(({ f, sx }, i) => { f.rotation.z = sx * Math.sin(tt * 3 + i) * 0.35 * sw; });
      tail.rotation.y = Math.sin(tt * 2.2) * 0.3 * sw;
      // neck: rises from base, curls; params: rise (0 down..1 up), curl, sway, bend
      const rise = p.rise ?? 1, curl = p.curl ?? 0.12, swayA = p.sway ?? 0.08;
      segs.forEach((s, i) => {
        s.rotation.x = i === 0 ? lerp(0.1, -1.25, rise) : (i < 4 ? -0.05 : curl) + (p.bend || 0) * (i / N);
        s.rotation.y = Math.sin(tt * 1.6 - i * 0.4) * swayA + (p.turn || 0) / N;
      });
      const totalX = segs.reduce((a, s) => a + s.rotation.x, 0);
      const hd = g3(p.head);
      head.rotation.set(-totalX + hd[0], hd[1], hd[2]);
      jaw.rotation.x = clamp(p.mouth || 0, 0, 1.5) * 0.5;
      const look = p.look || [0, 0];
      eL.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 }); eR.set({ look, blink: p.blink || 0, lid: p.lid || 0, squint: p.squint || 0 });
      root.scale.setScalar(S * (p.scale || 1));
    },
  };
}

// ------------------------------------------------------------------ misc
export function makeFish(color = '#ff9a3c', size = 1, fin = '#ffd16a') {
  const root = new THREE.Group(); scene.add(root);
  const b = grp(root);
  add(b, 'sph', color, [0, 0, 0], [0.09, 0.14, 0.26]);
  const tail = grp(b, [0, 0, -0.24]);
  add(tail, 'cone', fin, [0, 0, -0.08], [0.02, 0.16, 0.12], [-P / 2, 0, 0]).scale.set(0.12, 0.16, 0.03);
  add(b, 'cone', fin, [0, 0.13, 0], [0.03, 0.1, 0.1]).scale.set(0.02, 0.09, 0.1);
  for (const s of [1, -1]) {
    add(b, 'sph', '#ffffff', [s * 0.07, 0.04, 0.15], 0.04);
    add(b, 'sph', '#111111', [s * 0.095, 0.045, 0.165], 0.022);
  }
  root.scale.setScalar(size);
  return { root, set(pos, rot = [0, 0, 0], t = 0, wig = 1, vis = true) { root.visible = vis; root.position.set(...pos); root.rotation.set(...rot); tail.rotation.y = Math.sin(t * 18) * 0.5 * wig; b.rotation.y = Math.sin(t * 18 + 1) * 0.12 * wig; } };
}

export function makeEgg(o = {}) {
  const root = new THREE.Group(); scene.add(root);
  const shell = o.color || '#f4ead0', sp = o.spot || '#8fc79a';
  const cut = 0.42 * P;
  const bot = grp(root);
  const bm = add(bot, new THREE.SphereGeometry(1, 32, 18, 0, P * 2, cut, P - cut), mat(shell, { side: 1, r: 0.5 }), [0, 0.42, 0], [0.32, 0.42, 0.32]);
  const top = grp(root, [0, 0.42, 0]);
  add(top, new THREE.SphereGeometry(1, 32, 12, 0, P * 2, 0, cut), mat(shell, { side: 1, r: 0.5 }), [0, 0, 0], [0.32, 0.42, 0.32]);
  // zig-zag rim on the top shell
  for (let i = 0; i < 14; i++) { const a = i / 14 * P * 2; add(top, 'cone6', mat(shell, { r: 0.5 }), [Math.cos(a) * 0.31 * Math.sin(cut), Math.cos(cut) * 0.42 - 0.03, Math.sin(a) * 0.31 * Math.sin(cut)], [0.045, 0.07, 0.012], [P, -a, 0]).userData.zig = 1; }
  const spots = [[0.3, 0.4], [1.6, 0.9], [2.9, 0.55], [4.1, 1.2], [5.2, 0.7], [0.9, 1.5], [3.5, 1.8], [5.8, 1.65]];
  for (const [a, th] of spots) {
    const par = th < cut ? top : bot; const yOff = th < cut ? 0 : 0.42;
    add(par, 'sph', mat(sp), [Math.cos(a) * Math.sin(th) * 0.32, yOff + Math.cos(th) * 0.42 - (th < cut ? 0 : 0), Math.sin(a) * Math.sin(th) * 0.32], [0.06, 0.05, 0.06]);
  }
  const crack = grp(root);
  for (let i = 0; i < 6; i++) add(crack, 'box', mat('#3a2a18'), [Math.cos(0.5 + i * 0.3) * 0.33, 0.55 + (i % 2) * 0.05, Math.sin(0.5 + i * 0.3) * 0.33], [0.012, 0.08, 0.012], [0, -(0.5 + i * 0.3), (i % 2 ? 0.7 : -0.7)]);
  root.scale.setScalar(o.size ?? 1);
  return {
    root, top, bot,
    set({ pos = [0, 0, 0], wobble = 0, crack: ck = 0, open = 0, t = 0, vis = true }) {
      root.visible = vis; root.position.set(...pos);
      root.rotation.set(Math.sin(t * 25) * wobble * 0.18, 0, Math.cos(t * 23) * wobble * 0.2);
      crack.visible = ck > 0 && open < 1; crack.scale.setScalar(Math.max(0.01, ck));
      top.children.forEach((m) => { if (m.userData.zig) m.visible = ck > 0; });
      top.visible = open < 1;
      top.position.set(0, 0.42 + open * 1.4, open * 0.25);
      top.rotation.set(-open * 2.5, open * 1.5, 0);
    },
  };
}

// bone club / fishing pole etc. attach to a hand group
export function bone(parent, len = 0.6, r = 0.04) {
  const g = grp(parent);
  add(g, 'cyl', mat('#f3ead2', { r: 0.5 }), [0, len / 2, 0], [r, len, r]);
  for (const s of [-1, 1]) for (const yy of [0, len]) add(g, 'sph', mat('#f3ead2', { r: 0.5 }), [s * r * 1.1, yy, 0], r * 1.6);
  return g;
}

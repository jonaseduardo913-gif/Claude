// =====================================================================
//  Episódio 3 — "Vovó Zuza e o Peixão"  (praia ao pôr do sol)
//  Vovó Zuza pesca numa pedra; Bico, um pteranodonte guloso, rouba os
//  peixes dela... até que algo ENORME morde a isca.
// =====================================================================
import * as E from './engine.js';
import * as C from './chars.js';
import * as P from './props.js';
import { makeHearts, makeDizzy, stepCues, walkPath, face, cueList } from './kit.js';
const { THREE, track, clamp, lerp, seg, hop, wob, pulse, noise, hash, blinkAt, worldOf } = E;
const Ez = E.E;
const PI = Math.PI;

// thin rope made of cylinder segments following a list of points
function rope(n, color = '#f4f0e6', r = 0.008) {
  const segs = []; for (let i = 0; i < n; i++) segs.push(E.add(E.scene, 'cyl', E.mat(color, { r: 0.5 }), [0, 0, 0], [r, 1, r], [0, 0, 0], { shadow: false }));
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  return {
    set(pts, vis = true) {
      segs.forEach((m, i) => {
        m.visible = vis; if (!vis) return;
        a.set(...pts[i]); b.set(...pts[i + 1]); d.subVectors(b, a); const L = d.length();
        m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(r, Math.max(L, 1e-4), r);
        m.quaternion.setFromUnitVectors(up, d.normalize());
      });
    },
  };
}
function makeCrab() {
  const root = E.grp(E.scene); const b = E.grp(root);
  E.add(b, 'sph', E.mat('#ff5a3a', { r: 0.5 }), [0, 0.07, 0], [0.12, 0.06, 0.09]);
  for (const s of [1, -1]) {
    E.add(b, 'cyl', E.mat('#ff5a3a'), [s * 0.04, 0.13, 0.05], [0.008, 0.08, 0.008]);
    E.add(b, 'sph', '#ffffff', [s * 0.04, 0.18, 0.05], 0.022); E.add(b, 'sph', '#111111', [s * 0.04, 0.185, 0.068], 0.011);
    E.add(b, 'sph', E.mat('#ff5a3a'), [s * 0.15, 0.09, 0.07], [0.05, 0.035, 0.04]);
    for (let k = 0; k < 3; k++) E.add(b, 'cyl', E.mat('#e04a2a'), [s * (0.1 + k * 0.01), 0.04, -0.04 + k * 0.04], [0.008, 0.09, 0.008], [0, 0, s * 1.0]);
  }
  return { root, set(pos, rot, t, walk) { root.position.set(...pos); root.rotation.y = rot; b.position.y = Math.abs(Math.sin(t * 20)) * 0.012 * walk; b.rotation.z = Math.sin(t * 20) * 0.08 * walk; } };
}

export function build() {
  const DUR = 46;
  // ------------------------------------------------------------ world
  const sky = E.makeSky({ top: '#3a3f92', mid: '#ff8a5c', bot: '#ffd889', sunDir: [0.12, 0.06, -1], sunCol: '#ffe6a8', glow: 1.15, sunSize: 260, stars: 0 });
  E.scene.fog = new THREE.Fog('#f2a679', 60, 380);
  E.renderer.toneMappingExposure = 1.0;
  E.hemi.color.set('#ffc3a0'); E.hemi.groundColor.set('#c49a68'); E.hemi.intensity = 0.85;
  E.sun.color.set('#ffd2a0'); E.sun.intensity = 2.3;
  const SHORE = -2.0;
  const H = (x, z) => (z > SHORE ? (z - SHORE) * 0.06 + E.smooth(clamp((z - 14) / 30)) * 8 + noise(x * 0.3 + z * 0.2) * 0.04 : (z - SHORE) * 0.22 - Math.min(0, z + 12) * 0.0) + (z < SHORE ? noise(x * 0.2) * 0.1 : 0);
  E.makeGround({
    size: 420, seg: 230, height: (x, z) => Math.max(-3.5, H(x, z)),
    color: (x, z, h, c) => {
      c.set('#f1d29c').offsetHSL(0, 0, noise(x * 0.9 + z * 0.7) * 0.03);
      if (z < SHORE + 0.9) c.lerp(new THREE.Color('#b9915e'), clamp((SHORE + 0.9 - z) / 0.9));
      if (z < SHORE - 0.5) c.lerp(new THREE.Color('#3d7f86'), clamp((SHORE - 0.5 - z) / 3));
    },
  });
  const water = P.makeWater({
    size: 400, seg: 200, y: 0, color: '#2f8fb6', center: [0, -150],
    fn: (x, z, t) => {
      const near = clamp((-z - 1.5) / 6);
      let y = (0.09 * Math.sin(x * 0.25 + t * 1.1) + 0.07 * Math.sin(z * 0.45 - t * 1.5) + 0.035 * Math.sin((x + z) * 0.9 + t * 2.3)) * (0.35 + 0.65 * near) - 0.02;
      if (t > 27.6) { const r = Math.hypot(x - NES[0], z - NES[2]), lt = t - 27.6; y += 0.35 * Math.sin(r * 2.2 - lt * 7) * Math.exp(-lt * 0.6) * Math.exp(-r * 0.12) * clamp(lt * 6 - r * 0.5 + 1); }
      return y;
    },
  });
  // sun glitter path on the water
  const gc = document.createElement('canvas'); gc.width = 64; gc.height = 256; const gx = gc.getContext('2d');
  for (let i = 0; i < 900; i++) { const y = Math.random() ** 0.6 * 256, w = 2 + (256 - y) / 256 * 30; gx.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},140,${0.15 + Math.random() * 0.5})`; gx.fillRect(32 - w / 2 + (Math.random() - 0.5) * w, y, 2 + Math.random() * w * 0.5, 1.5); }
  const glitter = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.8 }));
  glitter.rotation.x = -PI / 2; glitter.position.set(8, 0.12, -150); glitter.scale.set(26, 290, 1); E.scene.add(glitter);
  const foam = E.add(E.scene, 'box', E.mat('#ffffff', { op: 0.55 }), [0, 0.02, SHORE], [120, 0.01, 0.35], [0, 0, 0], { shadow: false });
  // rocks, palms, shells
  const ROCK = [0, 0, -2.75], RT = 0.72;
  E.add(E.scene, 'dodec', E.mat('#8a7f76', { flat: true, r: 0.9 }), [0, -0.05, -2.75], [0.95, 0.78, 0.85], [0.2, 0.5, 0.1]);
  E.add(E.scene, 'dodec', E.mat('#7c736b', { flat: true, r: 0.9 }), [1.0, -0.1, -3.4], [0.6, 0.45, 0.55], [0.4, 1.2, 0.2]);
  P.rock([-3.5, 0, -4], 1.3, 3, '#857a70'); P.rock([-4.6, 0, -3.2], 0.8, 4, '#7d736a'); P.rock([6, 0, -5.5], 1.6, 6, '#857a70');
  const palms = [[-5, 0, 2.5, 5.0, 0.45], [-7.5, 0, 5, 6.0, 0.3], [10.5, 0, 2.5, 5.5, -0.4], [9.5, 0, 7.5, 6.5, -0.3], [-11, 0, 8, 5.5, 0.35], [14, 0, 10, 6, -0.2], [-16, 0, 12, 7, 0.2], [3, 0, 14, 6, 0.1]].map(([x, y, z, h, l], i) => P.palm([x, H(x, z), z], h, l, i + 10, { leaf: '#3d8f3a', leaf2: '#5fae47' }));
  for (let i = 0; i < 30; i++) { const x = -14 + hash(i * 3) * 28, z = -1.2 + hash(i * 5) * 9; E.add(E.scene, 'sph', E.mat(['#ffe9d6', '#ffc6b0', '#f7d7ff'][i % 3], { r: 0.4 }), [x, H(x, z) + 0.02, z], [0.07, 0.03, 0.06], [0, hash(i) * 6, 0]); }
  for (let i = 0; i < 8; i++) P.bush([-13 + hash(i * 7) * 26, 0.1, 9 + hash(i * 3) * 6], 1.1, i + 40, ['#3d8f3a', '#5fae47', '#2f7a33']);
  // starfish
  const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i * PI / 5 + PI / 2, r = i % 2 ? 0.05 : 0.13; starShape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const starG = new THREE.ExtrudeGeometry(starShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
  for (const [x, z, c] of [[2.2, 0.6, '#ff7a4a'], [-1.4, 1.4, '#ffb347'], [3.5, -0.9, '#ff6a8a']]) E.add(E.scene, starG, E.mat(c, { r: 0.5 }), [x, H(x, z) + 0.03, z], 1, [-PI / 2, 0, hash(x) * 6]);
  const clouds = [[-60, 30, -170, 6, '#ffb48a'], [40, 38, -190, 7, '#ff9f8a'], [110, 26, -150, 5, '#ffc39a'], [-120, 34, -140, 5, '#ffa88a']].map(([x, y, z, s, c], i) => P.cloud([x, y, z], s, i, c));

  // ------------------------------------------------------------ cast
  const zuza = C.makeHuman({ size: 0.7, style: 'bun', hair: '#f2f0ea', glasses: true, nose: 1.25, cheeks: '#ff8f9a', cloth: '#4fb3a3', spot: '#2a776c', skin: '#e9b28d', earrings: '#ffd23f', necklace: true, browCol: '#dddddd', tunicTop: 0.85 });
  const bico = C.makePtero({ size: 1.05, skin: '#7c6fd6', wing: '#b3a6ff', crest: '#ff6a3d' });
  const NES = [0.4, -0.75, -8.2];
  const nessa = C.makePlesio({ size: 1.35, lashes: true, skin: '#3fb0b8', spot: '#2f8a94' });
  const crab = makeCrab();
  const ZS = 0.7, ZH = (0.36 + 0.04) * ZS; // zuza hip height
  // fishing rod (4 bending segments) held in the right hand
  const rod = E.grp(zuza.handR, [0, -0.04, 0.02], [2.16, 0, 0]); rod.scale.setScalar(1 / ZS);
  const rodSeg = []; { let par = rod; for (let i = 0; i < 4; i++) { const g = E.grp(par, i ? [0, 0.42, 0] : [0, 0, 0]); E.add(g, 'cyl', E.mat(i % 2 ? '#e9dcc0' : '#d8c8a4', { r: 0.6 }), [0, 0.21, 0], [0.018 - i * 0.003, 0.43, 0.018 - i * 0.003]); rodSeg.push(g); par = g; } }
  const rodTip = E.grp(rodSeg[3], [0, 0.42, 0]);
  const line = rope(14);
  const bobber = E.grp(E.scene); E.add(bobber, 'sph', E.mat('#ff3a3a', { r: 0.3 }), [0, 0.03, 0], [0.07, 0.06, 0.07]); E.add(bobber, 'sph', E.mat('#ffffff', { r: 0.3 }), [0, -0.02, 0], [0.065, 0.05, 0.065]);
  const basket = E.grp(E.scene, [0.05, RT - 0.08, -2.12]);
  E.add(basket, 'cyl', E.mat('#b98a4a', { r: 0.9 }), [0, 0.12, 0], [0.2, 0.24, 0.2]);
  E.add(basket, 'torus', E.mat('#8a6030', { r: 0.9 }), [0, 0.24, 0], [0.2, 0.2, 0.5], [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) E.add(basket, 'torus', E.mat('#a67a40'), [0, 0.04 + i * 0.06, 0], [0.205, 0.205, 0.25], [PI / 2, 0, 0]);
  const fishA = C.makeFish('#ffb03a', 0.9), fishB = C.makeFish('#5ab0ff', 0.9, '#bfe4ff'), bigFish = C.makeFish('#ff7a5a', 2.8, '#ffd16a');
  const hearts = makeHearts(7), dizzy = makeDizzy(3);
  const emo = { note: E.makeEmote('note'), q: E.makeEmote('?'), ang: E.makeEmote('anger'), bnote: E.makeEmote('note'), ex: E.makeEmote('!!'), bex: E.makeEmote('!'), sweat: E.makeEmote('sweat') };
  const splash = P.makeBurst(120, '#e8fbff', { size: 0.16, opacity: 0.9 }), splash2 = P.makeBurst(40, '#e8fbff', { size: 0.1 }), sandPuff = P.makeBurst(30, '#f0d6a0', { size: 0.18, opacity: 0.8 }), plop = P.makeBurst(20, '#e8fbff', { size: 0.07 });
  const flock = [0, 1].map((i) => C.makePtero({ size: 0.9, skin: '#6a5aa8' }));

  // ------------------------------------------------------------ dialogue
  const voices = {
    zuza: { name: 'Vovó Zuza', color: '#7fe3d2', pitch: 380, rate: 1.0, wave: 'tri', pan: -0.1 },
    bico: { name: 'Bico', color: '#c2b6ff', pitch: 460, rate: 1.2, wave: 'sq', pan: 0.15 },
    nessa: { name: 'Nessa', color: '#7fd6ff', pitch: 240, rate: 0.95, wave: 'tri', pan: 0 },
  };
  const SP = E.speech([
    { t: 5.5, who: 'zuza', text: 'Hum-hum-hum... peixinho, vem pra vovó!' },
    { t: 8.9, who: 'zuza', text: 'Hehe! Mais um!' },
    { t: 12.6, who: 'bico', text: 'Uuuh... peixe!' },
    { t: 16.9, who: 'bico', text: 'Fiu-fiu... fiu-fiu...' },
    { t: 17.9, who: 'zuza', text: 'Bico! Seu ladrãozinho!' },
    { t: 23.2, who: 'zuza', text: 'Opa! Esse é dos GRANDES!' },
    { t: 24.9, who: 'bico', text: 'Segura, vovó! Eu te ajudo!' },
    { t: 27.9, who: 'zuza', text: 'AAAAAH!' },
    { t: 31.2, who: 'nessa', text: 'Hihihi! Desculpa, eu só queria brincar!' },
    { t: 33.9, who: 'nessa', text: 'Toma, um presente!' },
    { t: 35.6, who: 'zuza', text: 'Hahaha! Que peixão!' },
    { t: 37.6, who: 'zuza', text: 'Amanhã a gente pesca junto de novo?' },
    { t: 40.1, who: 'nessa', text: 'Combinado!' },
    { t: 41.3, who: 'bico', text: 'E eu como o rabinho!' },
  ], voices);

  // ------------------------------------------------------------ motion
  const bobberP = (t) => {
    if (t < 20.3) return [0, 0, -7.2];
    if (t < 20.9) { const k = seg(t, 20.3, 20.9); return [0, Math.sin(PI * k) * 1.8, lerp(-3.4, -7.2, k)]; }
    return [0, 0, -7.2];
  };
  // Bico path: flies in, tumbles on sand, sneaks to the basket, later hovers behind Zuza
  const bPath = walkPath([[0, [6, 18]], [10.0, [3.2, 4.2]], [11.0, [1.4, 1.0], 'out'], [11.7, [1.0, 0.45], 'out'], [13.2, [1.0, 0.45]], [14.9, [0.5, -1.45], 'lin'], [20.0, [0.5, -1.45]], [21.0, [0.75, -1.05]], [24.3, [0.75, -1.05]], [24.8, [0.15, -2.35]]], 1.0);
  const zFly = track([[26.45, [0, RT, -2.85]], [26.9, [0.6, 2.2, -3.9], 'out'], [27.5, [1.5, 2.9, -4.1]], [31.0, [1.9, 3.3, -3.9]], [32.4, [1.9, 3.3, -3.9]], [33.2, [NES[0], 0, NES[2]]]]);
  const nRise = (t) => (t < 27.6 ? 0 : Ez.back(seg(t, 27.6, 28.8)));

  // ------------------------------------------------------------ cues
  const cues = cueList();
  cues.at(0, 'amb', { kind: 'waves', t1: DUR, gain: 0.8 }).at(0, 'music', { style: 'beach', t1: 22.6, gain: 0.48 });
  cues.at(7.8, 'plop', { gain: 0.6 }).at(8.0, 'whoosh', { gain: 0.4 }).at(8.05, 'splash', { gain: 0.4 }).at(8.65, 'plop').at(8.7, 'twinkle', { gain: 0.6 });
  for (let k = 0; k < 6; k++) cues.at(10.0 + k * 0.17, 'flap', { gain: 0.6 });
  cues.at(11.0, 'thud', { gain: 0.35 }).at(11.05, 'boing', { gain: 0.6 }).at(11.4, 'tweet', { gain: 0.4 });
  stepCues(cues, 13.2, 14.9, 9, 'hop', 0.35);
  cues.at(15.15, 'chomp').at(16.25, 'freeze', { gain: 0.6 }).at(18.85, 'bonk').at(18.9, 'tweet', { gain: 0.4 }).at(19.0, 'whoosh', { gain: 0.3 }).at(19.4, 'plop');
  cues.at(20.3, 'cast').at(20.9, 'plop', { gain: 0.8 }).at(22.8, 'drop').at(22.85, 'splash', { gain: 0.5 }).at(22.6, 'music', { style: 'chase', t1: 31.0, gain: 0.5 });
  cues.at(23.0, 'reel', { d: 3.4 }); for (const tt of [23.4, 24.2, 25.0, 25.7, 26.2]) cues.at(tt, 'tug', { gain: 0.8 });
  for (let k = 0; k < 14; k++) cues.at(24.6 + k * 0.16, 'flap', { gain: 0.45 });
  cues.at(26.45, 'whoosh', { gain: 0.8 }); for (let k = 0; k < 20; k++) cues.at(26.6 + k * 0.15, 'flap', { gain: 0.5 });
  cues.at(27.6, 'bigsplash', { gain: 1.2 }).at(27.65, 'roar', { gain: 0.35 }).at(31.0, 'music', { style: 'sunset', t1: DUR, gain: 0.5 });
  cues.at(31.2, 'laugh', { f: 260, wave: 'tri', n: 3, gain: 0.5 }).at(34.4, 'splash', { gain: 0.7 }).at(35.25, 'chomp', { gain: 1.2 }).at(35.3, 'twinkle');
  cues.at(42.7, 'laugh', { f: 380, wave: 'tri', n: 4, gain: 0.5 }).at(42.75, 'laugh', { f: 470, wave: 'sq', n: 4, gain: 0.4 }).at(42.8, 'laugh', { f: 240, wave: 'tri', n: 3, gain: 0.4 }).at(43.6, 'sting');
  cues.at(37.0, 'amb', { kind: 'night', t1: DUR, gain: 0.6 });

  // ------------------------------------------------------------ cameras
  const shots = [
    [0, (t) => { const k = E.smooth(seg(t, 0.3, 5)); return [[lerp(9, 4.6, k), lerp(6, 1.5, k), lerp(14, 2.8, k)], [lerp(0, 0, k), lerp(4, 0.9, k), lerp(-40, -3.2, k)], 42]; }],
    [5, (t) => [[3.0, 1.0, -4.0], [0, 0.92, -2.6], 40]],
    [9.9, (t) => { const k = E.smooth(seg(t, 9.9, 12)); return [[lerp(4.6, 3.8, k), lerp(1.8, 1.35, k), lerp(-0.6, -0.9, k)], [lerp(1.8, 0.4, k), lerp(1.4, 0.75, k), lerp(0.8, -1.2, k)], 44]; }],
    [15.0, (t) => [[3.7, 1.3, -0.5], [0.3, 0.9, -2.0], 42]],
    [20.0, (t) => [[3.9, 1.3, -3.6], [0, 1.15, -2.6], 44]],
    [26.4, (t) => [[5.0, 2.2, 0.6], [0.3, 2.4, -6.0], 50]],
    [31.0, (t) => [[3.4, 2.6, -1.2], [0.3, 3.0, -6.5], 44]],
    [33.0, (t) => [[4.0, 3.0, -0.6], [0.5, 3.4, -6.8], 46]],
    [37.0, (t) => [[5.3, 2.1, 0.3], [0.4, 1.45, -3.4], 46]],
    [42.4, (t) => { const k = E.smooth(seg(t, 42.4, 46)); return [[lerp(5.3, 6.5, k), lerp(2.1, 5.0, k), lerp(0.3, 6.5, k)], [lerp(0.4, 0, k), lerp(1.45, 2.2, k), lerp(-3.4, -8, k)], 46]; }],
  ];
  const shake = (t) => (t > 22.8 && t < 26.45 ? 0.012 : 0) + pulse(t, 26.45, 6) * 0.04 + pulse(t, 27.6, 3) * 0.09;

  // ------------------------------------------------------------ frame
  function frame(t) {
    // the sun slowly sets
    const sk = seg(t, 0, DUR);
    sky.u.sunDir.value.set(0.12, lerp(0.07, -0.012, sk), -1).normalize();
    sky.u.stars.value = seg(t, 38, 46) * 0.7;
    sky.u.top.value.set('#3a3f92').lerp(new THREE.Color('#1c1f55'), seg(t, 30, 46));
    sky.u.mid.value.set('#ff8a5c').lerp(new THREE.Color('#d0607a'), seg(t, 30, 46));
    sky.update(t); water.update(t);
    E.sun.intensity = 2.3 - seg(t, 34, 46) * 0.9; E.hemi.intensity = 0.85 - seg(t, 34, 46) * 0.25;
    glitter.material.opacity = 0.8 - seg(t, 36, 46) * 0.4;
    foam.position.z = SHORE + 0.15 + Math.sin(t * 1.2) * 0.25; foam.material.opacity = 0.35 + 0.25 * Math.sin(t * 1.2 + 1);
    palms.forEach((p) => p.update(t));

    // ---------------- Nessa
    const nr = nRise(t);
    let n = { pos: [NES[0], NES[1] - 1.6 * (1 - nr), NES[2]], rot: 0, t, rise: nr * 0.95, curl: 0.12, sway: 0.06, head: [0, 0, 0], mouth: SP.mouth('nessa', t), blink: blinkAt(t, 11), look: [0, 0], squint: 0, swim: 0.4 };
    if (t > 27.6 && t < 31) { n.mouth = Math.max(n.mouth, 0.35); n.look = [-0.2, 0.4]; n.head = [-0.15, 0, 0]; }
    if (t > 31 && t < 33.9) { n.squint = 0.6; n.head = [0.1, 0, Math.sin(t * 6) * 0.08]; }
    if (t > 32.4 && t < 37) { n.curl = 0.1; n.head = [0.25, 0, Math.sin(t * 2) * 0.05]; n.look = [0, 0.3]; n.sway = 0.03; }
    if (t > 33.9 && t < 34.6) { n.head = [0.25, 0.25, 0]; }
    if (t >= 37) { n.pos = [-0.6, -0.75, -7.4]; n.rot = 0.3; n.rise = 0.82; n.curl = 0.24; n.bend = 0; n.head = [0.35, 0, 0]; n.look = [0.4, -0.2]; n.squint = 0.3; if (t > 42.6) { n.squint = 0.8; n.mouth = Math.max(n.mouth, 0.4 + 0.3 * Math.abs(Math.sin(t * 8))); } }
    nessa.set(n);
    nessa.root.visible = t > 27.4;

    // ---------------- Zuza
    const sitY = RT - ZH + 0.06;
    let z = { pos: [ROCK[0], sitY, ROCK[2] - 0.05], rot: PI, legL: -1.45, legR: -1.45, legOut: 0.2, armL: [-1.2, 0, -0.35], armR: [-1.2, 0, 0], mouth: SP.mouth('zuza', t), blink: blinkAt(t, 9), look: [0, 0], head: [0, 0, 0], lean: 0.05, brow: 0, smile: 0, squint: 0, lid: 0 };
    let bend = 0.04; // rod bend per segment
    let lineEnd = null, lineSag = 0.6, lineVis = true;
    if (t > 5 && t < 7.8) { z.head = [0, 0, Math.sin(t * 3.2) * 0.12]; z.squint = 0.5; z.smile = 1; }
    if (t > 7.8 && t < 8.5) { const y = hop(t, 7.95, 0.5); z.armL[0] -= y * 0.9; z.armR[0] -= y * 0.9; z.lean = -0.15 * y; z.brow = 1; }
    if (t > 8.5 && t < 10) { z.squint = 0.6; z.smile = 1; z.head = [0, -0.4, 0]; }
    if (t >= 16.0 && t < 20.0) { z.rot = PI - Ez.io(seg(t, 16.0, 16.5)) * 2.7; z.head = [0.25, 0, 0]; z.look = [0, -0.4];
      if (t > 16.6) { z.head = [0, -0.35, 0]; z.look = [-0.5, 0.1]; z.brow = t > 17.7 ? -1 : 0.5; z.squint = t > 17.7 ? 0.3 : 0; }
      if (t > 18.3 && t < 19.0) { const k = seg(t, 18.3, 18.75), d = seg(t, 18.75, 18.85); z.armR = [-1.2 - k * 1.6 + d * 2.0, 0, 0.2]; }
    }
    if (t >= 20.0 && t < 20.3) { z.rot = PI - 2.7 * (1 - Ez.io(seg(t, 20, 20.3))); z.armR = [-2.6, 0, 0]; z.armL = [-2.4, 0, -0.3]; }
    if (t >= 20.3 && t < 20.6) { const k = seg(t, 20.3, 20.5); z.armR = [-2.6 + k * 1.4, 0, 0]; z.armL = [-2.4 + k * 1.2, 0, -0.3]; }
    if (t >= 22.8 && t < 26.45) { // the big pull: stand up on the rock and pull back
      const s = Ez.out(seg(t, 22.85, 23.2));
      z.pos = [ROCK[0], lerp(sitY, RT - 0.02, s), lerp(ROCK[2] - 0.05, ROCK[2] - 0.32, seg(t, 23, 26.4))];
      z.legL = lerp(-1.45, 0.25, s); z.legR = lerp(-1.45, -0.2, s); z.legOut = 0.25;
      z.lean = -0.35 * s + Math.sin(t * 11) * 0.06; z.armL = [-1.0 + Math.sin(t * 11) * 0.15, 0, -0.3]; z.armR = [-1.0 + Math.sin(t * 11) * 0.15, 0, 0];
      z.brow = 1; z.squint = 0.5; z.mouth = Math.max(z.mouth, 0.25); bend = 0.22 + Math.sin(t * 11) * 0.05; lineSag = 0;
    }
    if (t >= 26.45 && t < 33.2) { // flying, carried by Bico
      const p = zFly(t); z.pos = [p[0], p[1] - (t > 32.4 ? 0 : 0), p[2]]; z.legL = 0.4 * Math.sin(t * 9); z.legR = -0.4 * Math.sin(t * 9); z.legOut = 0.3;
      z.armL = [-1.4, 0, -0.3]; z.armR = [-1.4, 0, 0]; z.brow = 1; z.mouth = Math.max(z.mouth, t > 27.8 && t < 29.5 ? 1.1 : 0.3); bend = 0.15; lineSag = 0.1;
      z.rot = PI; z.tilt = Math.sin(t * 3) * 0.1;
      if (t > 29.5) { z.mouth = Math.max(SP.mouth('zuza', t), 0.2); z.brow = 0.6; z.look = [0, -0.3]; }
    }
    if (t >= 32.4 && t < 37) { // sitting on Nessa's head
      const nh = nessa.headWorld(); const ON = worldOf(nessa.head, [0, 0.3, 0.02]);
      const k = Ez.io(seg(t, 32.4, 33.2));
      const fly = zFly(32.4);
      z.pos = [lerp(fly[0], ON[0], k), lerp(fly[1], ON[1] - ZH + 0.02, k), lerp(fly[2], ON[2], k)];
      z.rot = lerp(PI, 0.5, k); z.legL = lerp(0, -1.4, k); z.legR = lerp(0, -1.4, k); z.legOut = 0.35; z.tilt = 0;
      z.armL = [-0.6, 0, 0.3]; z.armR = [-1.0, 0, 0.1]; z.brow = 0.4; lineVis = false;
      if (t > 35.5) { z.squint = 0.7; z.smile = 1; z.armL = [-0.3, 0, 2.3 + Math.sin(t * 8) * 0.2]; z.head = [-0.15, 0, Math.sin(t * 10) * 0.08]; }
    }
    if (t >= 37) { // picnic on the rock
      z.pos = [ROCK[0] + 0.1, sitY, ROCK[2] + 0.05]; z.rot = 1.0; z.legL = -1.45; z.legR = -1.45; z.legOut = 0.2;
      z.armL = [-0.5, 0, 0.3]; z.armR = [-0.5, 0, 0.3]; z.smile = 1; z.squint = 0.3; z.look = [0.3, 0.2]; lineVis = false;
      if (t > 40 && t < 41.3) { z.head = [-0.2, -0.5, 0]; z.look = [-0.6, 0.4]; }
      if (t > 42.6) { z.squint = 0.8; z.mouth = 0.5 + 0.4 * Math.abs(Math.sin(t * 9)); z.head = [-0.2, 0, Math.sin(t * 9) * 0.06]; }
    }
    zuza.set(z);
    rodSeg.forEach((g, i) => (g.rotation.x = bend * (i ? 1 : 0.4)));
    rod.visible = t < 32.4;

    // ---------------- Bico
    const bp = bPath.pos(t), bw = bPath.walk(t);
    const bh = (x, zz) => Math.max(0, H(x, zz));
    let b = { pos: [bp[0], bh(bp[0], bp[2]), bp[2]], rot: bPath.heading(t), flap: 0, fold: 1, phase: t * 14, walk: 0, walkPh: t * 9, head: [0, 0, 0], look: [0, 0], mouth: SP.mouth('bico', t), blink: blinkAt(t, 13), bank: 0, pitch: 0, lean: 0, squash: 0 };
    if (t < 11.0) { b.flap = 1; b.fold = 0; b.pos[1] = lerp(6, 0.1, Ez.out(seg(t, 8, 11.0))) + 0.5 * (1 - seg(t, 10.6, 11)); b.pitch = 0.15; }
    if (t >= 11.0 && t < 11.7) { const k = seg(t, 11.0, 11.7); b.bank = -k * PI * 2; b.fold = 0.6; b.pos[1] += Math.sin(PI * k) * 0.35; }
    if (t >= 11.7 && t < 13.2) { b.squash = wob(t, 11.7, 3, 6) * 0.4; b.head = [0, Math.sin(t * 7) * 0.4 * (1 - seg(t, 11.7, 12.4)), 0]; if (t > 12.4) { b.look = [-0.5, -0.3]; b.head = [0.1, -0.3, 0]; b.mouth = Math.max(b.mouth, 0.3); } }
    if (t >= 14.9 && t < 15.6) b.rot = face(b.pos, [basket.position.x, 0, basket.position.z]);
    if (t >= 13.2 && t < 15.0) { b.walk = 1; b.walkPh = t * 9; b.lean = 0.35; b.legs = -0.2; b.head = [0.3, 0, 0]; b.look = [0, -0.4]; b.pos[1] += Math.abs(Math.sin(t * 9)) * 0.08; }
    if (t >= 15.0 && t < 15.6) { const k = hop(t, 15.0, 0.5); b.lean = 0.35 + k * 0.5; b.head = [0.5 * k + 0.3, 0, 0]; }
    if (t >= 15.6 && t < 20) { b.rot = 0.5; b.head = [-0.1, 0.4, 0]; b.look = [0.6, 0.4]; b.lean = 0; if (t > 18.85) { b.squash = wob(t, 18.85, 3, 6) * 0.5; b.lid = 0.5; b.look = [0, -0.4]; b.head = [0.25, 0, 0.15]; } }
    if (t >= 20 && t < 24.3) { b.rot = PI - 0.4; b.head = [0, 0.2, 0]; b.look = [0, 0]; b.lid = t < 22.8 ? 0.4 : 0; if (t > 22.8) { b.head = [-0.1, 0.6, 0]; b.look = [0.6, 0]; } }
    if (t >= 24.3 && t < 26.45) { // hover behind Zuza, gripping her bun
      const k = Ez.io(seg(t, 24.3, 24.8)); const top = worldOf(zuza.head, [0, 0.62, -0.1]);
      b.pos = [lerp(bp[0], top[0], k), lerp(0.1, top[1] + 0.15, k), lerp(bp[2], top[2] + 0.05, k)]; b.rot = PI; b.flap = 1; b.fold = 0; b.phase = t * 16; b.pitch = -0.2; b.legs = 0.3; b.lean = -0.2; b.look = [0, -0.5]; b.head = [0.4, 0, 0];
      b.pos = [b.pos[0], b.pos[1] - 0.55 * k, b.pos[2]];
    }
    if (t >= 26.45 && t < 33.4) {
      const top = worldOf(zuza.head, [0, 0.62, -0.1]);
      b.pos = [top[0], top[1] - 0.45, top[2] + 0.05]; b.rot = PI; b.flap = 1; b.fold = 0; b.phase = t * 18; b.pitch = -0.15; b.legs = 0.3; b.lean = -0.1;
      b.mouth = Math.max(b.mouth, t > 27.8 && t < 29.4 ? 1.0 : 0); b.look = [0.2, -0.2]; b.head = [0.2, 0, 0];
      if (t >= 32.4) { const k = seg(t, 32.4, 33.4); b.pos[0] += k * 1.5; b.pos[1] += k * 0.8; b.rot = PI - k * 2.0; }
    }
    if (t >= 33.4 && t < 37) { // hovering next to Nessa, catching the big fish
      b.pos = [NES[0] + 1.9 + Math.sin(t * 2) * 0.1, 4.0 + Math.sin(t * 3) * 0.15, NES[2] + 1.6]; b.rot = -2.2 + (t > 34.6 && t < 35.4 ? 0.4 : 0); b.flap = 1; b.fold = 0; b.phase = t * 15; b.pitch = 0.05;
      b.look = [-0.4, -0.2]; if (t > 35.25) { b.lid = 0.3; b.head = [0.1, 0, Math.sin(t * 5) * 0.1]; }
    }
    if (t >= 37) { // picnic on the sand
      b.pos = [1.45, bh(1.45, -1.2), -1.2]; b.rot = -2.2; b.fold = 1; b.flap = 0; b.look = [-0.3, 0.2]; b.head = [-0.1, 0, 0];
      if (t > 41.3 && t < 42.6) { b.head = [0.3, 0.3, 0]; b.look = [0, -0.6]; }
      if (t > 42.6) { b.mouth = 0.5 + 0.4 * Math.abs(Math.sin(t * 10)); b.lid = 0.6; b.head = [-0.2, 0, Math.sin(t * 10) * 0.08]; }
    }
    bico.set(b);

    // ---------------- fish & line
    const tip = worldOf(rodTip);
    // small fish #1: caught at 8.0, flies into the basket, stolen by Bico at 15.15, bonked back at 18.85
    const bas = [basket.position.x, basket.position.y + 0.25, basket.position.z];
    let fp = null, frot = [0, 0, 0], fw = 1;
    if (t > 7.95 && t < 8.65) { const k = seg(t, 7.95, 8.65); fp = [lerp(0, bas[0], k), Math.sin(PI * k) * 1.6 + lerp(0, bas[1], k), lerp(-7.2, bas[2], k)]; frot = [k * 8, 0, 0]; }
    else if (t >= 8.65 && t < 15.15) { fp = [bas[0], bas[1] - 0.02, bas[2]]; frot = [-1.2, 0.3, 0]; fw = 0.2; }
    else if (t >= 15.15 && t < 18.85) { fp = worldOf(bico.head, [0, 0.05, 0.75]); frot = [0, bico.root.rotation.y + PI / 2, 0]; fw = 0.5; }
    else if (t >= 18.85 && t < 19.4) { const k = seg(t, 18.85, 19.4), s0 = worldOf(bico.head, [0, 0.05, 0.75]); fp = [lerp(s0[0], bas[0], k), lerp(s0[1], bas[1], k) + Math.sin(PI * k) * 0.8, lerp(s0[2], bas[2], k)]; frot = [k * 9, 0, 0]; }
    else if (t >= 19.4 && t < 37) { fp = [bas[0], bas[1] - 0.02, bas[2]]; frot = [-1.2, 0.3, 0]; fw = 0.2; }
    fishA.set(fp || [0, -10, 0], frot, t, fw, !!fp);
    fishB.set([bas[0] - 0.05, bas[1] - 0.04, bas[2] + 0.04], [-1.3, 1.5, 0.2], t, 0.15, t < 37);
    // line end
    let bob = bobberP(t);
    if (t > 7.75 && t < 8.0) bob = [0, -0.15, -7.2];
    if (t >= 8.0 && t < 20.3) { bob = t < 8.65 ? fp : [tip[0], tip[1] - 0.6 + Math.sin(t * 2) * 0.05, tip[2]]; }
    if (t > 22.8 && t < 26.45) bob = [Math.sin(t * 5) * 0.4, -0.25, -7.2 + Math.sin(t * 3) * 0.2];
    if (t >= 20.9 && t < 22.8) bob = [0, Math.sin(t * 2.5) * 0.04, -7.2];
    if (t >= 7.0 && t < 7.8) bob = [0, Math.sin(t * 2.5) * 0.04 - (t > 7.5 ? 0.08 : 0), -7.2];
    if (t < 7.0) bob = [0, Math.sin(t * 2.5) * 0.04, -7.2];
    if (t >= 26.45 && t < 32.4) bob = nessa.mouthWorld();
    lineEnd = bob;
    bobber.position.set(...bob); bobber.visible = lineVis && !(t >= 26.45) && !(t > 7.95 && t < 8.65);
    const pts = []; for (let i = 0; i <= 14; i++) { const s = i / 14; pts.push([lerp(tip[0], lineEnd[0], s), lerp(tip[1], lineEnd[1], s) - lineSag * 4 * s * (1 - s), lerp(tip[2], lineEnd[2], s)]); }
    line.set(pts, lineVis);
    // big fish: jumps out of the sea into Bico's beak, then lies on the sand for the picnic
    let gp = null, grot = [0, 0, 0];
    if (t > 34.4 && t < 35.25) { const k = seg(t, 34.4, 35.25), tgt = worldOf(bico.head, [0, 0.05, 0.75]); gp = [lerp(NES[0] + 2.8, tgt[0], k), lerp(-0.3, tgt[1] - 0.3, k) + Math.sin(PI * k) * 2.2, lerp(NES[2] + 1.0, tgt[2], k)]; grot = [-0.6 + k * 1.2, -1.2, 0]; }
    else if (t >= 35.25 && t < 37) { gp = worldOf(bico.head, [0, -0.25, 0.75]); grot = [0, bico.root.rotation.y + PI / 2, 0]; }
    else if (t >= 37) { gp = [0.95, bh(0.95, -1.55) + 0.26, -1.55]; grot = [0, 1.2, PI / 2]; }
    bigFish.set(gp || [0, -10, 0], grot, t, t < 37 ? 0.6 : 0, !!gp);
    // crab scuttles across the sand
    const cz = t < 37 ? lerp(0.6, -1.5, seg(t, 4.5, 10)) : lerp(-0.2, -1.6, seg(t, 37, 45));
    crab.set([1.7, H(1.7, cz), cz], 0, t, (t > 4.5 && t < 10) || t > 37 ? 1 : 0);
    // flock far away
    flock.forEach((f, i) => { const l = (t * 0.04 + i * 0.3) % 1; f.set({ pos: [lerp(-70, 70, l), 16 + i * 2 + Math.sin(t + i) * 0.8, -70 - i * 8], rot: PI / 2, flap: 1, phase: t * 6 + i * 2, fold: 0 }); });

    // ---------------- fx & emotes
    splash.update(t, 27.6, [NES[0], 0, NES[2]], { speed: 3.2, up: 6.5, grav: 9, life: 1.6 });
    splash2.update(t, 34.4, [NES[0] + 2.8, 0, NES[2] + 1.0], { speed: 1.4, up: 3, grav: 9, life: 0.9 });
    plop.update(t, t < 15 ? 7.98 : 20.9, [0, 0, -7.2], { speed: 0.6, up: 1.4, grav: 8, life: 0.6 });
    sandPuff.update(t, 11.0, [3.0, 0.15, -0.45], { speed: 1.4, up: 0.8, grav: 1.5, life: 1.0 });
    const zh = zuza.headWorld(), bhw = bico.headWorld(), nhw = nessa.headWorld();
    emo.note.set(t > 5.3 && t < 7.7 ? 1 : 0, [zh[0] + 0.15, zh[1] + 0.4 + ((t * 0.5) % 0.2), zh[2]], 0.25, Math.sin(t * 4) * 0.3);
    dizzy.update(t, (t > 11.7 && t < 12.6) || (t > 18.85 && t < 20.2) ? 1 : 0, [bhw[0], bhw[1] + 0.35, bhw[2]], 0.28, 0.17);
    emo.q.set(t > 16.3 && t < 16.9 ? Ez.back(seg(t, 16.3, 16.45)) : 0, [zh[0], zh[1] + 0.45, zh[2]], 0.35);
    emo.ang.set(t > 17.8 && t < 19.0 ? 1 + Math.sin(t * 14) * 0.1 : 0, [zh[0] + 0.25, zh[1] + 0.4, zh[2]], 0.35);
    emo.bnote.set(t > 16.6 && t < 17.8 ? 1 : 0, [bhw[0] + 0.25, bhw[1] + 0.45 + ((t * 0.5) % 0.2), bhw[2]], 0.28, Math.sin(t * 5) * 0.3);
    emo.ex.set(t > 22.8 && t < 23.6 ? Ez.back(seg(t, 22.8, 23.0)) : 0, [zh[0], zh[1] + 0.5, zh[2]], 0.4);
    emo.bex.set(t > 12.3 && t < 12.9 ? Ez.back(seg(t, 12.3, 12.45)) : 0, [bhw[0], bhw[1] + 0.5, bhw[2]], 0.4);
    emo.sweat.set(t > 23.3 && t < 26.4 ? 1 : 0, [zh[0] - 0.2, zh[1] + 0.2 - ((t * 0.5) % 0.12), zh[2] + 0.1], 0.18);
    hearts.update(t, [[31.6, [nhw[0], nhw[1] + 0.6, nhw[2]], 1.2], [38.2, [zh[0], zh[1] + 0.35, zh[2]], 0.8]]);

    let sh = shots[0][1]; for (const [t0, f] of shots) if (t >= t0) sh = f;
    const [cp, cl, fov] = sh(t);
    E.cam(cp, cl, fov, shake(t), t);
    E.sunAt(cl, [0.55, 0.5, 0.65], t < 5 ? 20 : 11);
  }

  return {
    duration: DUR, caps: SP.caps, cues: [...cues, ...SP.cues], frame,
    title: { t0: 0.5, t1: 4.7, title: 'VOVÓ ZUZA E O PEIXÃO', ep: 'Episódio 3', color: '#7fe3d2' },
    endAt: 43.6, fades: [[0, 0.8, 'in'], [44.6, 46, 'out']],
  };
}

// =====================================================================
//  Episódio 1 — "O Ovo Perdido"  (selva vulcânica, dia)
//  Tuca, um menino das cavernas desastrado, tropeça num ovo. Dele nasce
//  Pipoca, um bebê tricerátops que acha que Tuca é a mãe dele...
// =====================================================================
import * as E from './engine.js';
import * as C from './chars.js';
import * as P from './props.js';
import { makeHearts, makeDizzy, stepCues, walkPath, face, cueList } from './kit.js';
const { THREE, track, clamp, lerp, seg, hop, wob, pulse, noise, hash, blinkAt, worldOf } = E;
const PI = Math.PI;
const Ez = E.E;

export function build() {
  const DUR = 50;
  // ------------------------------------------------------------ world
  const sky = E.makeSky({ top: '#2f7fd6', mid: '#8fd0f2', bot: '#e9f6e8', sunDir: [0.45, 0.55, -0.7], sunCol: '#fff4cf', glow: 0.55 });
  E.scene.fog = new THREE.Fog('#cfe6dc', 45, 260);
  E.hemi.color.set('#cfe9ff'); E.hemi.groundColor.set('#5d6b2e'); E.hemi.intensity = 0.95;
  E.sun.color.set('#fff0d0'); E.sun.intensity = 2.7;
  const H = (x, z) => { const r = Math.hypot(x - 5, z + 10); return E.smooth(clamp((r - 38) / 60)) * (6 + noise(x * 0.05) * 5 + noise(z * 0.06 + 3) * 5) + noise(x * 0.7) * noise(z * 0.6 + 1) * 0.05; };
  E.makeGround({
    size: 460, seg: 230, height: H,
    color: (x, z, h, c) => {
      const pathK = clamp(1 - (Math.abs(z - Math.sin(x * 0.15) * 0.3) - 0.8) / 0.8) * clamp((x + 22) / 4) * clamp((30 - x) / 4);
      c.setHSL(0.27 + noise(x * 0.3 + z * 0.2) * 0.03, 0.55, 0.36 + noise(x * 0.9 - z * 0.7) * 0.05 + h * 0.004);
      c.lerp(new THREE.Color('#b48a5a'), pathK * 0.75);
    },
  });
  const volc = P.volcano([-30, 0, -165], 2.4);
  // jungle
  const sway = [];
  const avoid = (x, z) => (z > 0 && z < 32 && x > -22 && x < 4) || (Math.abs(z) < 4.2 && x > -26 && x < 30) || (x > 8 && x < 27 && z > -24 && z < 2) || (z > 0 && z < 9) || (x > 14 && x < 30 && z > 0 && z < 15);
  for (let i = 0; i < 140; i++) {
    const x = -50 + hash(i * 3.3) * 105, z = -48 + hash(i * 7.1) * 75;
    if (avoid(x, z)) continue;
    if (hash(i * 1.9) < 0.45) P.palm([x, H(x, z), z], 4 + hash(i) * 3, 0.2 + hash(i * 2) * 0.3, i);
    else P.jungleTree([x, H(x, z), z], 4.5 + hash(i * 5) * 3, i);
  }
  sway.push({ g: P.jungleTree([17.8, 0, -8.6], 5.5, 91), t: 31.3, s: 1 }, { g: P.jungleTree([24.2, 0, -8.2], 6, 92), t: 31.6, s: -1 });
  for (let i = 0; i < 120; i++) {
    const x = -24 + hash(i * 5.7) * 52, side = hash(i * 9.1) < 0.7 ? -1 : 1;
    const z = side < 0 ? -2.2 - hash(i * 2.3) * 6 : 9 + hash(i * 2.3) * 8;
    if (x > 10 && x < 25 && z < -1.5 && z > -13) continue;
    const r = hash(i * 4.4);
    if (r < 0.45) P.fern([x, 0, z], 0.7 + hash(i) * 0.6, i);
    else if (r < 0.75) P.bush([x, 0, z], 0.6 + hash(i) * 0.6, i);
    else if (r < 0.9) P.flower([x, 0, z], ['#ff6fa8', '#ffd23f', '#ff8a3c', '#c58cff'][i % 4], 1 + hash(i));
    else P.rock([x, 0, z], 0.3 + hash(i) * 0.4, i);
  }
  for (let i = 0; i < 14; i++) P.flower([-10 + i * 1.6, 0, -1.6 - hash(i) * 0.8], ['#ff6fa8', '#ffd23f', '#c58cff'][i % 3], 1.1);
  // giant footprints on the path
  for (let i = 0; i < 6; i++) {
    const fp = E.grp(E.scene, [9.5 + i * 1.6, 0.01, -1.1 + (i % 2) * 0.7], [0, 0.5, 0]);
    E.add(fp, 'sph', E.mat('#6e5232', { r: 1 }), [0, 0, 0], [0.42, 0.02, 0.5], [0, 0, 0], { shadow: false });
    for (let k = -1; k <= 1; k++) E.add(fp, 'sph', E.mat('#6e5232', { r: 1 }), [k * 0.25, 0, 0.55], [0.11, 0.02, 0.15], [0, 0, 0], { shadow: false });
  }
  const clouds = [[-40, 40, -120, 4], [30, 46, -140, 5], [80, 38, -110, 3.5], [-90, 42, -90, 4.5], [5, 52, -200, 6]].map(([x, y, z, s], i) => P.cloud([x, y, z], s, i));
  const pollen = E.makePoints(260, { color: '#fff6c8', size: 0.05, opacity: 0.8 });
  const leaves = E.makePoints(90, { color: '#4f9a3a', size: 0.12 });

  // ------------------------------------------------------------ cast
  const tuca = C.makeHuman({ size: 0.8, headR: 0.34, nose: 1.4, style: 'spiky', cheeks: '#ff9a8a', cloth: '#f0a23a', spot: '#7a3f12' });
  const pip = C.makeTrike({ baby: true, size: 0.42, skin: '#9ad46a', belly: '#fff1b8', frill: '#ffb03a', frillRim: '#f08a2a', spot: '#c8ef9c' });
  const tete = C.makeTrike({ size: 1.6, lashes: true, bow: '#ff5d8f', skin: '#5aa86a', frill: '#e8703a', spot: '#86c98a' });
  const egg = C.makeEgg({ size: 1.25 });
  // the egg's top shell ends up as Pipoca's hat
  const hat = E.grp(pip.head, [0, 0.36, 0.28]); hat.scale.setScalar(1.25);
  E.add(hat, new THREE.SphereGeometry(1, 28, 10, 0, PI * 2, 0, 0.42 * PI), E.mat('#f4ead0', { side: 1, r: 0.5 }), [0, -0.12, 0], [0.5, 0.55, 0.5]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; E.add(hat, 'cone6', E.mat('#f4ead0'), [Math.cos(a) * 0.485, -0.0, Math.sin(a) * 0.485], [0.07, 0.1, 0.04], [PI, -a, 0]); }
  E.add(hat, 'sph', E.mat('#8fc79a'), [0.15, 0.3, 0.2], [0.09, 0.06, 0.09]);
  const flyers = [0, 1, 2].map((i) => C.makePtero({ size: 1.4, skin: ['#8f7ad6', '#d6807a', '#7ab8d6'][i] }));
  const hearts = makeHearts(7), hearts2 = makeHearts(6), dizzy = makeDizzy(3);
  const emo = { note: E.makeEmote('note'), ex: E.makeEmote('!'), ex2: E.makeEmote('!!'), q: E.makeEmote('?'), sweat: E.makeEmote('sweat'), pex: E.makeEmote('!'), pnote: E.makeEmote('note'), anger: E.makeEmote('anger') };

  // ------------------------------------------------------------ dialogue
  const voices = {
    tuca: { name: 'Tuca', color: '#ffb347', pitch: 330, rate: 1.1, pan: -0.1 },
    pipoca: { name: 'Pipoca', color: '#b6f07a', pitch: 640, rate: 1.25, wave: 'tri', pan: 0.1 },
    tete: { name: 'Dona Tetê', color: '#ff8fb3', pitch: 150, rate: 0.9, wave: 'saw', pan: 0.2 },
  };
  const SP = E.speech([
    { t: 5.6, who: 'tuca', text: 'Lá-lá-lá... que dia lindo!' },
    { t: 9.9, who: 'tuca', text: 'Ai, ai, ai... quem deixou essa pedra aqui?' },
    { t: 12.7, who: 'tuca', text: 'Hmm... que pedra mais esquisita.' },
    { t: 15.9, who: 'pipoca', text: 'Mamã! Mamã!' },
    { t: 17.1, who: 'tuca', text: 'Mamãe? Eu?! Não, não, não!' },
    { t: 22.5, who: 'tuca', text: 'Tá bom... vamos achar a sua mãe.' },
    { t: 28.6, who: 'tuca', text: 'Pi... Pipoca... você ouviu isso?' },
    { t: 32.8, who: 'tete', text: 'QUEM ESTÁ COM O MEU BEBÊ?!' },
    { t: 35.6, who: 'pipoca', text: 'Mamããe!' },
    { t: 40.3, who: 'tete', text: 'Obrigada por cuidar dele, pequeno!' },
    { t: 42.7, who: 'tuca', text: 'Hehe... de nada!' },
    { t: 45.4, who: 'tuca', text: 'Uhuuul! Vamos pra casa!' },
  ], voices);

  // ------------------------------------------------------------ motion
  const tPath = walkPath([[0, [-14, 0]], [3, [-12, 0]], [8.6, [-1.55, 0]], [9.1, [0.3, 0], 'out'], [12.6, [0.3, 0]], [13.2, [-0.12, 0]], [15.2, [-0.12, 0]], [15.45, [0.45, 0], 'out'],
    [18.9, [0.45, 0]], [20.4, [3.4, 0], 'lin'], [21.0, [3.4, 0]], [21.9, [5.0, 0], 'lin'], [25.5, [5.0, 0]], [25.5001, [8.0, 0]], [28.0, [14.5, 0], 'lin'],
    [42.0, [14.5, 0]], [42.4, [14.8, 0.2], 'out'], [43.2, [14.5, 0]]], 1.6);
  const tRot = track([[0, PI / 2], [11.6, PI / 2], [12.0, -PI / 2], [18.6, -PI / 2], [18.95, PI / 2], [22.1, PI / 2], [22.4, -PI / 2], [25.4, -PI / 2], [25.5, PI / 2], [28.2, PI / 2], [30.6, PI / 2], [31.0, 1.2], [36, 1.2], [36.4, 1.9], [40, 1.9], [40.4, 2.2]]);
  const pPath = walkPath([[0, [-1.05, 0.35]], [15.2, [-1.05, 0.35]], [15.75, [-0.5, 0.25], 'out'], [18.9, [-0.5, 0.25]], [19.4, [-0.3, 0.1]], [20.5, [2.45, 0], 'lin'], [21.1, [2.45, 0]], [22.0, [4.35, 0], 'lin'], [22.15, [4.25, 0], 'out'], [25.5, [4.25, 0]], [25.5001, [7.0, 0]], [28.1, [13.5, 0], 'lin'],
    [35.8, [13.5, 0]], [37.3, [18.0, -1.7], 'io'], [44, [18.0, -1.7]]], 2.0);
  const pRot = track([[0, PI / 2], [35.7, PI / 2], [35.9, 2.1], [44, 2.1]]);
  const mHead = (t) => tete.headWorld();
  const mPath = walkPath([[0, [21.8, -10]], [31.0, [21.8, -10]], [32.6, [19.0, -3.3], 'out'], [41.5, [19.0, -3.3]], [42.2, [17.4, -2.2], 'io'], [44.0, [17.4, -2.2]], [44.9, [17.0, -3.0]], [50, [13.4, -10.5], 'lin']], 1.4);
  const mRot = track([[0, -0.4], [31, -0.4], [32.6, -0.95], [44.0, -0.95], [44.9, -2.7], [50, -2.7]]);

  // ------------------------------------------------------------ cues
  const cues = cueList();
  cues.at(0, 'music', { style: 'jungle', t1: 27.6, gain: 0.55 }).at(0, 'amb', { kind: 'jungle', t1: DUR, gain: 0.45 });
  stepCues(cues, 3.0, 8.6, 10, 'step', 0.5); cues.at(8.62, 'whoosh', { gain: 0.5 }).at(9.08, 'bonk', { gain: 1 }).at(9.1, 'tweet', { gain: 0.5 });
  cues.at(13.45, 'knock').at(13.8, 'knock').at(14.05, 'wobble').at(14.3, 'crack').at(14.85, 'wobble').at(14.95, 'crack', { gain: 1.2 }).at(15.2, 'pop', { gain: 1.2 }).at(15.22, 'gasp', { who: 'tuca' }).at(15.75, 'boing', { gain: 0.6 }).at(16.25, 'heart');
  stepCues(cues, 18.9, 20.4, 10, 'step', 0.45); stepCues(cues, 19.4, 20.5, 14, 'hop', 0.5); cues.at(20.55, 'freeze'); stepCues(cues, 21.0, 21.9, 10, 'step', 0.45); stepCues(cues, 21.1, 22.0, 14, 'hop', 0.5); cues.at(22.02, 'boing');
  cues.at(24.25, 'heart'); stepCues(cues, 25.5, 28.0, 10, 'step', 0.45); stepCues(cues, 25.5, 28.1, 14, 'hop', 0.4);
  cues.at(27.7, 'music', { style: 'tension', t1: 35.3, gain: 0.6 });
  for (const tt of [28.0, 28.9, 29.8, 30.6, 31.3, 31.85, 32.4]) cues.at(tt, 'thud', { gain: 0.6 + (tt - 28) * 0.12 });
  cues.at(31.2, 'leaves').at(31.5, 'leaves').at(30.05, 'boing', { gain: 0.4 }).at(34.2, 'roar', { gain: 1.3 }).at(35.4, 'music', { style: 'happy', t1: DUR, gain: 0.55 });
  stepCues(cues, 35.8, 37.3, 16, 'hop', 0.6); cues.at(37.6, 'heart').at(38.4, 'heart').at(42.3, 'boing', { gain: 0.5 }).at(42.6, 'heart');
  stepCues(cues, 44.9, 50, 5, 'thud', 0.45);
  cues.at(47.0, 'sting');

  // ------------------------------------------------------------ cameras
  const shots = [
    [0, (t) => { const k = E.smooth(seg(t, 0.3, 5)); return [[lerp(-2, -8.5, k), lerp(17, 2.4, k), lerp(28, 9, k)], [lerp(-12, -7, k), lerp(9, 1.0, k), lerp(-60, 0, k)], 42]; }],
    [5, (t) => { const x = Math.min(tPath.pos(t)[0], -0.9); return [[x + 1.0, 1.05, 5.2], [x + 0.3, 0.68, 0], 38]; }],
    [9.5, (t) => { const k = E.smooth(seg(t, 10.2, 12.0)); return [[lerp(1.3, 0.85, k), 0.6, 2.9], [lerp(0.75, -0.15, k), 0.4, 0], 42]; }],
    [12.5, (t) => { const k = E.smooth(seg(t, 12.5, 16.5)); return [[lerp(-0.3, -0.4, k), lerp(0.95, 0.8, k), lerp(4.3, 3.5, k)], [-0.35, 0.58, 0], 38 - 4 * E.pulse(t, 15.2, 4)]; }],
    [17, (t) => { const k = E.smooth(seg(t, 18.5, 22)); return [[lerp(1.2, 3.2, k), 1.5, 7.2], [lerp(0.6, 3.2, k), 0.6, 0], 38]; }],
    [22.2, (t) => [[4.15, 0.85, 2.5], [4.65, 0.55, 0], 36]],
    [25.5, (t) => { const x = tPath.pos(t)[0]; return [[x + 2.6, 1.25, 4.4], [x - 0.3, 0.7, 0], 40]; }],
    [28.15, (t) => [[15.6, 0.85, 2.3], [14.5, 0.8, 0], 40]],
    [31.0, (t) => [[12.9, 0.45, 2.6], [19.5, 2.4, -4.5], 52]],
    [33.0, (t) => [[14.4, 0.45, 1.7], [17.2, 2.2, -2.2], 44]],
    [34.75, (t) => [[15.4, 0.95, 1.9], [14.5, 0.85, 0], 40]],
    [35.5, (t) => [[14.2, 1.6, 4.6], [17.6, 0.9, -1.6], 42]],
    [40.0, (t) => { const k = E.smooth(seg(t, 40, 44)); return [[lerp(13.6, 13.9, k), 1.4, lerp(4.0, 3.4, k)], [16.0, 1.15, -1.0], 44]; }],
    [44.0, (t) => { const m = mPath.pos(t), f = [Math.sin(-2.7), Math.cos(-2.7)], s = [Math.cos(-2.7), -Math.sin(-2.7)]; return [[m[0] + s[0] * 8.5 + f[0] * 2.5, 3.6, m[2] + s[1] * 8.5 + f[1] * 2.5], [m[0] + f[0] * 0.3, 2.3, m[2] + f[1] * 0.3], 30]; }],
    [46.8, (t) => { const k = E.smooth(seg(t, 46.8, 50)); const m = mPath.pos(t); return [[lerp(9.5, 8.0, k), lerp(4.5, 9.5, k), lerp(0, 1.5, k)], [lerp(m[0], 14, k), lerp(2.0, 3, k), lerp(m[2], -14, k)], 44]; }],
  ];
  const shake = (t) => {
    let s = 0;
    for (const tt of [28.0, 28.9, 29.8, 30.6, 31.3, 31.85, 32.4]) s += pulse(t, tt, 7) * (0.03 + (tt - 28) * 0.012);
    s += t > 34.2 && t < 35.4 ? 0.06 * (1 - seg(t, 34.2, 35.4)) : 0;
    return s;
  };

  // ------------------------------------------------------------ frame
  function frame(t) {
    sky.update(t); volc.update(t);
    // --- Tuca
    const tp = tPath.pos(t), tw = tPath.walk(t);
    let fall = 0, ty = 0, sq = 0;
    if (t >= 8.6 && t < 11) {
      fall = t < 9.1 ? lerp(0, 1.45, Ez.in(seg(t, 8.6, 9.08))) : lerp(1.45, 0, Ez.io(seg(t, 10.3, 10.95)));
      ty = hop(t, 8.6, 0.5) * 0.45; sq = -wob(t, 9.08, 3, 7) * 0.5;
    }
    const jumpBack = hop(t, 15.2, 0.3) * 0.35;
    let hairUp = clamp(pulse(t, 15.2, 2.5) * 1.3) + (t > 28.3 && t < 33 ? 0.6 : 0) + (t > 34.2 && t < 35.5 ? 0.6 : 0);
    const shakeNo = t > 17.1 && t < 18.6 ? Math.sin(t * 22) * 0.45 : 0;
    const tremble = (t > 28.3 && t < 35.6 ? 0.025 : 0) * noise(t * 40);
    const tMouth = SP.mouth('tuca', t) + (t > 15.2 && t < 15.9 ? 1 : 0) + (t > 34.2 && t < 35.3 ? 1.1 : 0);
    let armL = [0, 0, 0], armR = [0, 0, 0], lean = 0, head = [0, shakeNo, 0], look = [0, 0], lid = 0, brow = 0, sad = 0, squint = 0;
    if (t > 5 && t < 8.6) { head = [0, 0, Math.sin(t * 4) * 0.08]; }
    if (t >= 8.95 && t < 10.4) { armL = [-2.6, 0, 0.3]; armR = [-2.6, 0, 0.3]; }
    if (t >= 10.9 && t < 11.8) { armR = [-2.2, 0, 1.0 + Math.sin(t * 18) * 0.15]; squint = 0.4; sad = 1; }
    if (t > 12.0 && t < 13.3) { look = [0, -0.3]; head = [0.25, 0, 0]; brow = 0.6; }
    if (t > 13.3 && t < 14.0) { armR = [-1.3 - Math.max(0, Math.sin((t - 13.3) * 18)) * 0.4, 0, 0.1]; lean = 0.35; look = [0, -0.4]; head = [0.3, 0, 0]; }
    if (t > 14.0 && t < 15.2) { lean = 0.25 + seg(t, 14, 15.2) * 0.2; look = [0, -0.4]; head = [0.35, 0, 0]; brow = 1; }
    if (t >= 15.2 && t < 17.1) { lean = -0.25; armL = [-0.6, 0, 1.2]; armR = [-0.6, 0, 1.2]; brow = 1; look = [0, -0.25]; }
    if (t >= 17.1 && t < 18.6) { armL = [-1.4, 0, 0.5 + Math.sin(t * 20) * 0.25]; armR = [-1.4, 0, 0.5 - Math.sin(t * 20) * 0.25]; brow = 1; squint = 0.2; }
    if (t > 20.5 && t < 21.0) { head = [0, -0.6, 0]; look = [-0.6, 0]; brow = -0.6; }
    if (t > 21.9 && t < 22.2) { head = [0.15, 0, 0]; brow = 1; }
    if (t > 22.4 && t < 25.5) { lid = 0.35; head = [0.3, 0, 0.12]; look = [0, -0.4]; sad = 0.6; if (t > 23.9 && t < 24.9) { armR = [-1.0 + Math.sin(t * 16) * 0.12, 0, 0]; lean = 0.25; } }
    if (t > 28.3 && t < 31) { look = [Math.sin(t * 2.5) * 0.7, 0.1]; head = [0, Math.sin(t * 2.5) * 0.4, 0]; brow = 1; armL = [0, 0, 0.6]; armR = [0, 0, 0.6]; }
    if (t > 31 && t < 34.2) { look = [0, 0.6]; head = [-0.35, 0, 0]; brow = 1; armL = [-0.3, 0, 0.9]; armR = [-0.3, 0, 0.9]; }
    if (t >= 34.2 && t < 35.5) { lean = -0.35; squint = 0.7; armL = [-1.2, 0, 0.8]; armR = [-1.2, 0, 0.8]; }
    if (t >= 35.5 && t < 38.0) { look = [0.3, 0.3]; head = [-0.1, 0, 0]; brow = 0.5; }
    if (t >= 38.0 && t < 39.6) { armR = [-2.4, 0, 0.9]; lid = 0.4; head = [0, 0, 0.15]; }
    if (t >= 40 && t < 44) { look = [0, 0.45]; head = [-0.3, 0, 0]; brow = t < 42.3 ? 0.8 : 0.3; if (t > 42.6) { armR = [-2.2, 0, 1.2]; squint = 0.6; } }
    const tilt = wob(t, 42.3, 2.2, 3) * 0.35;
    // riding on mamma's back at the end
    let ride = t >= 44;
    // --- Tetê (mamma)
    const mp = mPath.pos(t), mw = mPath.walk(t);
    const roar = t > 34.2 && t < 35.3 ? E.smooth(seg(t, 34.2, 34.45)) * (1 - seg(t, 35.0, 35.3)) : 0;
    let mHeadRot = [0, 0, 0], mLid = 0, mLook = [0, 0], mSquint = 0;
    if (t > 32.6 && t < 34.2) { mHeadRot = [-0.15, 0, 0]; mLook = [0, -0.2]; mSquint = 0.25; }
    if (roar) mHeadRot = [-0.45 * roar, 0, Math.sin(t * 30) * 0.04 * roar];
    if (t >= 36.0 && t < 40) { mHeadRot = [0.45 * E.smooth(seg(t, 36, 37.2)), Math.sin(t * 3) * 0.12 * seg(t, 37.3, 37.6), 0]; mLid = 0.35; mLook = [0, -0.5]; }
    if (t >= 40 && t < 44) { mHeadRot = [0.25, -0.35 + 0.35 * seg(t, 43, 44), 0.1]; mLook = [-0.3, -0.4]; mLid = t > 42.2 && t < 43 ? 0.5 : 0.1; }
    if (t >= 44) mHeadRot = [-0.05, 0, 0];
    tete.set({
      pos: mp, rot: mRot(t), phase: t * 5, walk: mw, t, head: mHeadRot, mouth: SP.mouth('tete', t) * 1.1 + roar * 1.3,
      blink: blinkAt(t, 5), lid: mLid, look: mLook, squint: mSquint, tailWag: t > 36 ? 1 : 0.2,
    });
    // --- Pipoca
    const pp = pPath.pos(t), pw = pPath.walk(t);
    const born = t >= 15.2;
    const pScale = born ? Ez.elastic(seg(t, 15.2, 15.75)) : 0.001;
    const pHop = (t > 15.2 && t < 15.8 ? 0 : Math.abs(Math.sin(t * 14)) * 0.18 * pw) + hop(t, 30.0, 0.35) * 0.3 + hop(t, 15.2, 0.55) * 0.9;
    let pHead = [0, 0, 0], pLook = [0, 0], pMouth = SP.mouth('pipoca', t), pSq = 0, pLid = 0, pSquint = 0;
    if (t > 15.6 && t < 17.1) { pLook = [0, 0.25]; pHead = [-0.2, 0, 0.15 * Math.sin(t * 4)]; }
    if (t > 17.1 && t < 18.9) { pLook = [0, 0.3]; pHead = [-0.15, 0, 0]; }
    if (t > 20.5 && t < 21.05) { pHead = [-0.35, 0.5, 0]; pLook = [0.4, 0.8]; pLid = 0.25; }
    if (t > 22.0 && t < 22.5) pSq = wob(t, 22.02, 3, 6) * 0.8;
    if (t > 22.4 && t < 25.5) { pLook = [0, 0.4]; pHead = [-0.3, 0, 0]; if (t > 23.9 && t < 25.1) { pSquint = 0.7; pHead = [0.1, 0, Math.sin(t * 8) * 0.12]; } }
    if (t > 28.2 && t < 31) { pLook = [0.3, 0.5]; pHead = [-0.3, 0.3, 0]; }
    if (t > 37.3 && t < 40) { pHead = [-0.4, 0, Math.sin(t * 6) * 0.15]; pSquint = 0.6; }
    let pPos = [pp[0], pHop, pp[2]], pRotV = pRot(t);
    if (ride) { // ride on top of mamma's head
      pPos = worldOf(tete.head, [0, 0.58, 0.32]); pPos[1] -= 0.05; pRotV = mRot(t); pHead = [-0.1, 0, Math.sin(t * 5) * 0.1]; pSquint = 0.5;
    }
    pip.set({ pos: pPos, rot: pRotV, phase: t * 14, walk: pw, t, head: pHead, look: pLook, mouth: pMouth + (t > 15.25 && t < 15.6 ? 0.8 : 0), blink: blinkAt(t, 2), squash: pSq, scale: pScale, lid: pLid, squint: pSquint, tailWag: t > 22.4 ? 1 : 0.5, legs: t > 20.5 && t < 21.05 ? 0.4 : 0 });
    pip.root.visible = born;
    hat.visible = born;
    hat.position.set(0, 0.36 + (born ? Math.max(0, 2.2 * (1 - Ez.out(seg(t, 15.2, 15.75))) * (seg(t, 15.2, 15.75) < 0.4 ? 1 : 1)) + Math.abs(wob(t, 15.75, 2, 6)) * 0.1 : 0), 0.28);
    hat.rotation.set(0.25 * Math.sin(t * 2) * 0.3, 0, -0.18 + (born ? (1 - seg(t, 15.2, 15.75)) * 6 : 0));
    // egg
    egg.set({ pos: [-1.05, 0, 0.35], t, wobble: (t > 14.0 && t < 14.6 ? 0.6 : 0) + (t > 14.8 && t < 15.2 ? 1 : 0), crack: t > 14.3 ? (t > 14.95 ? 1.4 : 1) : 0, open: t >= 15.2 ? 1 : 0, vis: t < 25.5 });
    egg.root.visible = t < 25.5;
    egg.root.scale.setScalar(1.25 * (t > 15.2 && t < 15.5 ? 1 + wob(t, 15.2, 4, 10) * 0.08 : 1));
    // Tuca pose (after tete for ride)
    let tPos = [tp[0], ty + jumpBack, tp[2]], tRotV = tRot(t), legL = 0, legR = 0, legOut = 0;
    if (t > 20.5 && t < 21.0) tRotV = PI / 2;
    if (ride) {
      tPos = worldOf(tete.hip, [0, 1.12, -0.25]); tPos[1] -= 0.28; tRotV = mRot(t);
      legL = -1.35; legR = -1.35; legOut = 0.55; lean = 0;
      armL = [-0.3, 0, 2.4 + Math.sin(t * 9) * 0.35]; armR = [0, 0, 0.6]; look = [0, 0.1]; head = [0, 0, Math.sin(t * 3) * 0.1]; squint = 0.4;
    }
    tuca.set({
      pos: tPos, rot: tRotV, phase: t * 10, walk: ride ? 0 : tw, fall, squash: sq, lean, armL, armR, head, look, lid, brow, sad, squint,
      mouth: tMouth, blink: blinkAt(t, 1), hairUp, tilt: tilt + tremble, legL, legR, legOut, smile: t > 42.6 ? 1 : 0,
    });
    // --- flyers far away
    flyers.forEach((f, i) => {
      const l = (t * 0.05 + i * 0.12) % 1;
      f.set({ pos: [lerp(60, -80, l) + i * 6, 20 + i * 3 + Math.sin(t + i) * 1.5, -60 - i * 12], rot: -PI / 2 + 0.1, flap: 1, phase: t * 7 + i * 2, fold: 0, bank: 0.1 * Math.sin(t + i) });
    });
    // sway trees as mamma pushes through
    for (const s of sway) s.g.rotation.z = wob(t, s.t, 1.4, 1.6) * 0.18 * s.s;
    // --- emotes & fx
    const th = tuca.headWorld(), ph = pip.headWorld(), mh = tete.headWorld();
    emo.note.set(t > 5.2 && t < 8.4 ? 1 : 0, [th[0] + 0.25 + Math.sin(t * 3) * 0.05, th[1] + 0.45 + ((t * 0.6) % 0.3), th[2]], 0.32, Math.sin(t * 4) * 0.3);
    dizzy.update(t, t > 9.1 && t < 11.2 ? 1 : 0, [th[0], th[1] + 0.35, th[2]], 0.3, 0.18);
    emo.ex.set(t > 12.0 && t < 12.7 ? Ez.back(seg(t, 12.0, 12.2)) : 0, [th[0], th[1] + 0.6, th[2]], 0.45);
    emo.ex2.set(t > 15.22 && t < 16.1 ? Ez.back(seg(t, 15.22, 15.4)) : 0, [th[0], th[1] + 0.6, th[2]], 0.5);
    emo.q.set(t > 20.55 && t < 21.0 ? Ez.back(seg(t, 20.55, 20.7)) : 0, [th[0], th[1] + 0.55, th[2]], 0.42);
    emo.pnote.set(t > 20.6 && t < 21.05 ? 1 : 0, [ph[0] + 0.2, ph[1] + 0.5, ph[2]], 0.3, Math.sin(t * 6) * 0.3);
    emo.sweat.set(t > 28.6 && t < 33 || t > 38.1 && t < 39.4 ? 1 : 0, [th[0] - 0.22, th[1] + 0.25 - ((t * 0.5) % 0.15), th[2] + 0.15], 0.2);
    emo.pex.set(t > 30.0 && t < 30.6 ? Ez.back(seg(t, 30, 30.15)) : 0, [ph[0], ph[1] + 0.6, ph[2]], 0.4);
    emo.anger.set(t > 33.2 && t < 35.3 ? 1 + Math.sin(t * 12) * 0.1 : 0, [mh[0] + 0.6, mh[1] + 1.0, mh[2]], 0.6);
    hearts.update(t, [[16.2, [ph[0], ph[1] + 0.4, ph[2]], 0.8], [24.2, [ph[0], ph[1] + 0.4, ph[2]], 0.8], [37.6, [ph[0], ph[1] + 0.6, ph[2] + 0.3], 1.3]]);
    hearts2.update(t, [[38.4, [ph[0] - 0.3, ph[1] + 0.9, ph[2] + 0.5], 1.2], [42.6, [th[0], th[1] + 0.4, th[2]], 0.9]]);
    const ac = t < 9.5 ? tp : t < 25.5 ? [1.5, 0, 0] : t < 31 ? tp : [17, 0, -2];
    pollen.set((i) => [ac[0] + (hash(i) - 0.5) * 16 + Math.sin(t * 0.3 + i) * 0.6, 0.2 + hash(i * 3) * 4 + Math.sin(t * 0.5 + i * 2) * 0.3, ac[2] + (hash(i * 7) - 0.5) * 10]);
    leaves.pts.visible = t > 28 && t < 34;
    leaves.set((i) => { const l = ((t - 28) * 0.35 + hash(i)) % 1; return [13 + hash(i * 2) * 8 + Math.sin(t * 2 + i) * 0.4, 6 - l * 6.2, -4 + hash(i * 5) * 5]; });
    clouds.forEach((c, i) => { c.position.x += 0; c.rotation.y = 0; });
    // --- camera
    let sh = shots[0][1]; for (const [t0, f] of shots) if (t >= t0) sh = f;
    const [cp, cl, fov] = sh(t);
    E.cam(cp, cl, fov, shake(t), t);
    E.sunAt(cl, [0.45, 0.85, 0.35], t < 5 ? 30 : 11);
  }

  return {
    duration: DUR, caps: SP.caps, cues: [...cues, ...SP.cues], frame,
    title: { t0: 0.5, t1: 4.7, title: 'O OVO PERDIDO', ep: 'Episódio 1' },
    endAt: 47.2, fades: [[0, 0.8, 'in'], [48.6, 50, 'out']],
  };
}

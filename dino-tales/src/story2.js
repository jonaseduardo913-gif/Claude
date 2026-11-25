// =====================================================================
//  Episódio 2 — "Pedrão e o Fogo"  (vale nevado ao entardecer, aurora)
//  Grunk tenta fazer fogo para a filha Lili e falha feio. Pedrão, um
//  anquilossauro sonolento e alérgico, espirra... e a cauda dele faz faísca!
// =====================================================================
import * as E from './engine.js';
import * as C from './chars.js';
import * as P from './props.js';
import { makeHearts, makeDizzy, stepCues, walkPath, face, cueList } from './kit.js';
const { THREE, track, clamp, lerp, seg, hop, wob, pulse, noise, hash, blinkAt, worldOf } = E;
const Ez = E.E;
const PI = Math.PI;

function aurora(pos, w, h, seed, c1 = '#4dffa8', c2 = '#a66bff') {
  const g = new THREE.PlaneGeometry(w, h, 160, 1);
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `uniform float time, seed; varying vec2 vUv;
      void main(){ vUv = uv; vec3 p = position;
        p.z += sin(p.x*0.025 + time*0.25 + seed)*18.0 + sin(p.x*0.07 - time*0.4 + seed*2.0)*6.0;
        p.y += sin(p.x*0.03 + time*0.2)*4.0;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform float time, seed; uniform vec3 c1, c2; varying vec2 vUv;
      void main(){
        float bands = 0.55 + 0.45*sin(vUv.x*140.0 + time*1.3 + seed*3.0)*sin(vUv.x*47.0 - time*0.6);
        float a = smoothstep(0.0, 0.12, vUv.y) * pow(1.0 - vUv.y, 1.7) * bands;
        a *= smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        vec3 c = mix(c1, c2, smoothstep(0.25, 0.95, vUv.y));
        gl_FragColor = vec4(c * 1.2, a * 0.85);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.position.set(...pos); mesh.renderOrder = -5; E.scene.add(mesh);
  return m;
}

export function build() {
  const DUR = 48;
  // ------------------------------------------------------------ world
  const sky = E.makeSky({ top: '#121a44', mid: '#4a3c88', bot: '#ff9a6a', sunDir: [-0.35, -0.04, -1], sunCol: '#ffb38a', glow: 0.7, sunSize: 900, stars: 0.9 });
  E.scene.fog = new THREE.Fog('#4a4a7e', 50, 320);
  E.renderer.toneMappingExposure = 1.1;
  const auroras = [aurora([-20, 55, -170], 320, 55, 0.3), aurora([40, 62, -200], 300, 60, 2.1, '#5cffd0', '#ff6bd5'), aurora([-80, 50, -140], 220, 40, 4.0)];
  const moon = E.add(E.scene, 'sph', new THREE.MeshBasicMaterial({ color: '#fff4dc', fog: false }), [-95, 85, -230], 7, [0, 0, 0], { shadow: false });
  const H = (x, z) => { const r = Math.hypot(x - 3, z); return E.smooth(clamp((r - 20) / 50)) * (5 + noise(x * 0.04) * 6 + noise(z * 0.05 + 7) * 5) + noise(x * 0.35 + 3) * noise(z * 0.4) * 0.18 * clamp((r - 8) / 6); };
  E.makeGround({
    size: 500, seg: 240, height: H,
    color: (x, z, h, c) => { c.setHSL(0.6 + noise(x * 0.2) * 0.02, 0.35, 0.9 + noise(x * 0.5 + z * 0.4) * 0.04); },
  });
  // distant snowy mountains
  for (let i = 0; i < 16; i++) {
    const a = -PI * 0.95 + i / 15 * PI * 0.95 * 2 * 0.55 - 0.3, d = 170 + hash(i) * 90;
    P.mountain([Math.sin(a) * d, -2, -Math.cos(a) * d], 40 + hash(i * 3) * 40, 55 + hash(i * 5) * 70, '#56608a', '#f4f6ff', i, 0.45);
  }
  // cave
  const cave = E.grp(E.scene, [-1.2, 0, -7.5]);
  E.add(cave, 'dodec', E.mat('#7c84a0', { flat: true, r: 0.9 }), [0, 1.2, 0], [6, 4.2, 4.5]);
  E.add(cave, 'sph', E.mat('#f6f8ff', { r: 0.7 }), [0, 4.6, -0.4], [5.0, 1.4, 3.8]);
  E.add(cave, 'sph', E.mat('#14121e', { r: 1 }), [0.3, 1.0, 3.9], [1.7, 1.9, 0.9]);
  for (let i = 0; i < 9; i++) E.add(cave, 'cone', E.mat('#cfe6ff', { r: 0.15, m: 0.1 }), [-1.4 + i * 0.36, 2.8 - Math.abs(i - 4) * 0.06, 4.35 - Math.abs(i - 4) * 0.05], [0.07, 0.45 + hash(i) * 0.4, 0.07], [PI, 0, 0]);
  // pines (keep the action area and camera lanes clear)
  const avoid = (x, z) => (x > -5 && x < 14 && z > -5 && z < 14) || (x > -6 && x < 4 && z > -11 && z < -3);
  for (let i = 0; i < 150; i++) {
    const x = -45 + hash(i * 3.7) * 95, z = -45 + hash(i * 5.3) * 80;
    if (avoid(x, z)) continue;
    P.pine([x, H(x, z) - 0.1, z], 3 + hash(i * 2) * 3.5, i);
  }
  const bigPine = P.pine([-2.6, 0, -1.4], 4.4, 77);
  P.pine([10.5, 0, -4.5], 4.0, 78); P.pine([-4.6, 0, 3.0], 3.4, 79); P.pine([13.5, 0, 2.5], 3.6, 80);
  for (let i = 0; i < 26; i++) { const a = hash(i * 9) * PI * 2, r = 5 + hash(i * 4) * 9; const x = 3 + Math.cos(a) * r, z = Math.sin(a) * r * 0.7 - 2; if (z > 2 && x < 9) continue; E.add(E.scene, 'sph', E.mat('#eef2ff', { r: 0.8 }), [x, -0.1, z], [0.6 + hash(i) * 0.8, 0.35 + hash(i * 2) * 0.3, 0.6 + hash(i * 3) * 0.8]); }
  // frozen pond
  E.add(E.scene, 'cyl', E.mat('#a9d4ff', { r: 0.08, m: 0.2 }), [-9, 0.01, 7], [6, 0.02, 4], [0, 0.3, 0], { shadow: false });
  const snow = E.makePoints(2200, { color: '#ffffff', size: 0.07, opacity: 0.9 });

  // ------------------------------------------------------------ cast
  const grunk = C.makeHuman({ size: 1.15, style: 'shaggy', beard: true, unibrow: true, fangs: true, teeth: [], hair: '#5a2e14', cloth: '#9aa3b4', spot: '#4a4f5c', bodyW: 0.4, bodyD: 0.33, nose: 1.6, skin: '#d29a70', armRad: 0.095, legRad: 0.1, feet: 1.3, tunicTop: 0.9 });
  const lili = C.makeHuman({ size: 0.55, style: 'pigtails', hair: '#2b1a0e', lashes: true, cheeks: '#ff9a9a', cloth: '#b46ad8', spot: '#7a3a9a', headR: 0.36, tunicTop: 0.8 });
  const ped = C.makeAnky({ skin: '#c99a5e', plate: '#7d5a3a' });
  const HR = 0.3; // grunk head radius (local)
  // props
  const sticks = [grunk.handL, grunk.handR].map((h) => { const g = E.grp(h, [0, -0.05, 0.05], [1.3, 0, 0]); E.add(g, 'cyl', E.mat('#6a4428'), [0, 0.15, 0], [0.03, 0.5, 0.03]); return g; });
  const stones = [grunk.handL, grunk.handR].map((h) => E.add(h, 'dodec', E.mat('#6f6f7a', { flat: true }), [0, -0.08, 0.06], 0.09));
  const meat = E.grp(grunk.handR, [0, -0.05, 0.05], [PI - 0.5, 0, 0]);
  E.add(meat, 'cyl', E.mat('#6a4428'), [0, 0.4, 0], [0.025, 0.9, 0.025]);
  E.add(meat, 'sph', E.mat('#9a4a2a', { r: 0.5 }), [0, 0.8, 0], [0.12, 0.17, 0.12]);
  const snowHat = E.grp(grunk.head, [0, HR * 0.95, 0]);
  for (const [x, y, z, r] of [[0, 0.05, 0, 0.22], [0.14, -0.02, 0.06, 0.13], [-0.13, -0.01, -0.04, 0.14], [0.02, 0.2, 0.02, 0.12]]) E.add(snowHat, 'sph', E.mat('#ffffff', { r: 0.7 }), [x, y, z], r);
  const chunk = E.grp(E.scene); for (const [x, y, z, r] of [[0, 0, 0, 0.25], [0.15, -0.05, 0.1, 0.16], [-0.14, 0.05, -0.06, 0.18]]) E.add(chunk, 'sph', E.mat('#ffffff', { r: 0.7 }), [x, y, z], r);
  const feather = E.grp(lili.handL, [0, -0.06, 0.02]);
  E.add(feather, 'cyl', E.mat('#f3ead2'), [0, -0.2, 0], [0.012, 0.4, 0.012]);
  E.add(feather, 'sph', E.mat('#ff5a6a', { r: 0.6 }), [0, -0.3, 0.02], [0.06, 0.22, 0.02]);
  const fire = P.makeFire([0, 0, 0], 1.0);
  const beardFire = P.makeFire([0, 0, 0], 0.45, { logs: false });
  const sparks1 = P.makeBurst(70, '#ffd27a', { size: 0.1, additive: true }), sparks2 = P.makeBurst(90, '#ffd27a', { size: 0.11, additive: true }), sparks3 = P.makeBurst(20, '#ffd27a', { size: 0.09, additive: true }), spark0 = P.makeBurst(10, '#ffd27a', { size: 0.07, additive: true });
  const puff = P.makeBurst(30, '#d0d0e0', { size: 0.25, opacity: 0.6 });
  const hearts = makeHearts(7);
  const emo = { ang: E.makeEmote('anger'), ex: E.makeEmote('!'), sweat: E.makeEmote('sweat'), z: E.makeEmote('z'), ex2: E.makeEmote('!!'), note: E.makeEmote('note') };

  // where the tail club lands when it swings (boulder) -> where the fire is lit
  const PED = [2.9, 0, -0.2], SW = -1.05;
  ped.set({ pos: PED, rot: -PI / 2, swing: SW, t: 0 }); ped.root.updateMatrixWorld(true);
  const club = ped.clubWorld();
  const BOULDER = [club[0] + 0.1, 0, club[2] + 0.42];
  P.rock([BOULDER[0], 0.1, BOULDER[2]], 0.6, 5, '#77798a');
  E.add(E.scene, 'sph', E.mat('#f6f8ff', { r: 0.7 }), [BOULDER[0], 0.55, BOULDER[2]], [0.45, 0.14, 0.4]);
  const F2 = [BOULDER[0] - 1.0, 0, BOULDER[2] + 0.7];
  const PILE0 = [0, 0, 0];

  // ------------------------------------------------------------ dialogue
  const voices = {
    grunk: { name: 'Grunk', color: '#ffb36b', pitch: 150, rate: 0.95, wave: 'saw', pan: -0.15 },
    lili: { name: 'Lili', color: '#e3a6ff', pitch: 520, rate: 1.15, wave: 'tri', pan: 0.1 },
    ped: { name: 'Pedrão', color: '#ffd36b', pitch: 110, rate: 0.85, wave: 'saw', pan: 0.2 },
  };
  const SP = E.speech([
    { t: 5.4, who: 'lili', text: 'Brrr... papai, tô com muito frio!' },
    { t: 7.6, who: 'grunk', text: 'Calma, filha! O papai vai fazer FOGO!' },
    { t: 13.9, who: 'grunk', text: 'Grrr! Fogo bobo!' },
    { t: 15.8, who: 'lili', text: 'Hihihi!' },
    { t: 21.8, who: 'lili', text: 'Olha, papai! Um dinossauro!' },
    { t: 23.6, who: 'grunk', text: 'Ele... ele morde?' },
    { t: 25.4, who: 'ped', text: 'Ah... ah... ATCHIM!' },
    { t: 27.9, who: 'grunk', text: 'Faíscas! Pedrão, faz de novo!' },
    { t: 31.0, who: 'ped', text: 'Ah... ah... AAATCHIIIM!' },
    { t: 33.6, who: 'grunk', text: 'FOGO! Nós temos FOGO!' },
    { t: 36.6, who: 'lili', text: 'Obrigada, Pedrão! Você é o melhor!' },
    { t: 39.0, who: 'grunk', text: 'Pedrão... você é um gênio!' },
    { t: 40.7, who: 'ped', text: 'Ah... ATCHIM!' },
    { t: 41.8, who: 'grunk', text: 'AI, AI, AI! Minha barba!' },
    { t: 43.4, who: 'lili', text: 'Hahaha!' },
  ], voices);
  // sneeze timing (moment the "TCHIM" lands)
  const SNZ = [26.6, 32.4, 41.2];
  const sneezeAmt = (t) => { let pre = 0, hit = 0; for (const s of SNZ) { pre = Math.max(pre, s - t > 0 && s - t < 1.1 ? Ez.io(1 - (s - t) / 1.1) : 0); hit = Math.max(hit, t >= s && t < s + 0.7 ? 1 - seg(t, s, s + 0.7) : 0); } return { pre, hit }; };

  // ------------------------------------------------------------ motion
  const gPath = walkPath([[0, [-1.1, 0.55]], [10.0, [-1.1, 0.55]], [10.4, [-0.85, 0.35]], [22.5, [-0.85, 0.35]], [23.1, [0.35, 1.2], 'out'], [29.0, [0.35, 1.2]], [29.4, [0.05, 0.75]], [29.7, [0.05, 0.75]], [30.1, [1.2, 1.9]], [30.9, [F2[0] - 0.1, F2[2] + 0.7], 'lin'], [31.2, [F2[0] - 0.1, F2[2] + 0.7]], [31.6, [F2[0] - 1.2, F2[2] + 1.2]], [32.7, [F2[0] - 1.2, F2[2] + 1.2]], [32.95, [F2[0] - 1.5, F2[2] + 1.5], 'out']], 1.5);
  const gRot = track([[0, 0.5], [10.0, 0.5], [10.4, 1.3], [14.2, 1.3], [14.4, 0.6], [19, 0.6], [19.4, 1.4], [29.0, 1.4], [29.4, -2.6], [29.75, -2.6], [30.0, 1.0], [30.9, 1.6], [31.3, 1.6], [31.6, -1.0], [32.7, -1.0], [33.4, 0.4]]);
  const lPath = walkPath([[0, [0.85, 0.95]], [29.4, [0.85, 0.95]], [30.6, [-0.05, 0.55]], [32.4, [-0.05, 0.55]], [32.7, [-0.55, 1.1], 'out']], 1.0);
  const lRot = track([[0, -0.5], [19, -0.5], [19.4, 1.3], [29.4, 1.3], [29.6, -2.2], [30.4, -2.2], [30.7, 2.3], [32.4, 2.3], [33.6, 2.3], [34, 0.6]]);
  const pPath = walkPath([[0, [13, -0.2]], [19.3, [13, -0.2]], [23.0, [PED[0], PED[2]], 'out']], 2.2);
  const fireK = (t) => (t < 32.65 ? 0 : Math.min(1.15, Ez.back(seg(t, 32.65, 33.5))));

  // ------------------------------------------------------------ cues
  const cues = cueList();
  cues.at(0, 'amb', { kind: 'wind', t1: DUR, gain: 0.7 }).at(0, 'music', { style: 'snow', t1: 19.2, gain: 0.5 });
  cues.at(10.4, 'rub', { d: 2.0 }).at(12.6, 'fizzle', { gain: 0.5 }).at(13.05, 'clack').at(13.4, 'clack').at(13.55, 'spark', { gain: 0.4 }).at(13.75, 'fizzle', { gain: 0.6 });
  cues.at(14.45, 'thud', { gain: 0.45 }).at(14.55, 'leaves', { gain: 0.5 }).at(15.2, 'snowfall').at(15.25, 'bonk', { gain: 0.4 }).at(18.6, 'snowfall', { gain: 0.5 });
  cues.at(19.2, 'music', { style: 'comic', t1: 32.5, gain: 0.42 });
  stepCues(cues, 19.3, 23.0, 5, 'thud', 0.55); cues.at(21.0, 'yawn');
  cues.at(22.5, 'whoosh', { gain: 0.4 });
  for (const s of SNZ) { cues.at(s, 'whoosh', { gain: 0.6 }); }
  cues.at(SNZ[0] + 0.22, 'clack', { gain: 1.2 }).at(SNZ[0] + 0.25, 'spark').at(SNZ[0] + 0.9, 'fizzle').at(27.6, 'twinkle');
  stepCues(cues, 29.0, 30.9, 10, 'step', 0.45);
  cues.at(30.8, 'laugh', { f: 480, wave: 'tri', n: 3, gain: 0.4 });
  cues.at(SNZ[1] + 0.22, 'clack', { gain: 1.3 }).at(SNZ[1] + 0.25, 'spark', { gain: 1.2 }).at(32.65, 'ignite', { gain: 1.2 });
  cues.at(32.7, 'amb', { kind: 'fire', t1: DUR, gain: 0.8 }).at(33.0, 'music', { style: 'warm', t1: DUR, gain: 0.5 });
  cues.at(37.8, 'heart').at(SNZ[2] + 0.1, 'spark', { gain: 0.6 }).at(41.5, 'ignite', { gain: 0.35 }).at(42.6, 'fizzle', { gain: 0.8 });
  cues.at(43.5, 'laugh', { f: 140, wave: 'saw', n: 4, gain: 0.6 }).at(43.7, 'laugh', { f: 160, wave: 'saw', n: 4, gain: 0.5 });
  cues.at(45.5, 'sting');

  // ------------------------------------------------------------ cameras
  const shots = [
    [0, (t) => { const k = E.smooth(seg(t, 0.3, 5)); return [[lerp(9, 3.2, k), lerp(10, 1.9, k), lerp(24, 7.4, k)], [lerp(-6, 0, k), lerp(14, 1.0, k), lerp(-60, 0, k)], 44]; }],
    [5, (t) => [[0.1, 1.25, 4.6], [-0.15, 0.85, 0.5], 40]],
    [10, (t) => [[0.75, 0.75, 2.6], [-0.45, 0.55, 0.3], 42]],
    [14.2, (t) => [[0.2, 1.45, 4.3], [-1.0, 1.35, 0.2], 44]],
    [19, (t) => { const k = E.smooth(seg(t, 19, 23)); return [[lerp(-0.5, 0.8, k), 1.6, 8.0], [lerp(5, 2.4, k), 0.9, -0.2], 44]; }],
    [24, (t) => [[-0.6, 0.95, -2.6], [0.8, 0.6, -0.1], 42]],
    [26.5, (t) => [[club[0] - 3.4, 1.7, club[2] + 5.0], [club[0] - 1.2, 0.7, club[2]], 46]],
    [27.4, (t) => [[1.1, 1.75, 4.3], [0.3, 1.5, 1.1], 40]],
    [29.0, (t) => { const k = E.smooth(seg(t, 29, 31)); return [[lerp(2.2, 3.0, k), 2.3, lerp(8.5, 9.0, k)], [lerp(1.8, 3.2, k), 0.7, 0], 46]; }],
    [32.6, (t) => [[F2[0] + 0.8, 1.5, F2[2] + 5.4], [F2[0] - 0.6, 0.95, F2[2] + 0.4], 46]],
    [36, (t) => [[F2[0] + 0.2, 1.4, F2[2] + 4.4], [F2[0] - 0.5, 0.7, F2[2] - 0.8], 44]],
    [38.9, (t) => [[F2[0] + 2.5, 1.25, F2[2] + 0.9], [F2[0] + 1.0, 0.95, F2[2] - 0.75], 40]],
    [40.6, (t) => [[F2[0] + 0.5, 1.35, F2[2] + 4.0], [F2[0] - 0.2, 0.75, F2[2] - 0.8], 44]],
    [43.4, (t) => { const k = E.smooth(seg(t, 43.4, 48)); return [[lerp(F2[0] + 1.6, F2[0] + 4, k), lerp(1.6, 9, k), lerp(F2[2] + 4.5, F2[2] + 17, k)], [lerp(F2[0] - 0.8, F2[0] - 3, k), lerp(0.8, 4, k), lerp(F2[2], F2[2] - 12, k)], 44]; }],
  ];
  const shake = (t) => pulse(t, 14.45, 9) * 0.04 + pulse(t, SNZ[0] + 0.22, 7) * 0.08 + pulse(t, SNZ[1] + 0.22, 6) * 0.12 + [19.3, 19.93, 20.56, 21.2, 21.8, 22.45].reduce((a, s) => a + pulse(t, s, 10) * 0.025, 0);

  // ------------------------------------------------------------ frame
  function frame(t) {
    sky.update(t); auroras.forEach((m) => (m.uniforms.time.value = t));
    const fk = fireK(t);
    // lighting warms up when the fire is lit
    E.hemi.color.set('#8796d8').lerp(new THREE.Color('#ffc59a'), clamp(fk) * 0.35); E.hemi.groundColor.set('#c9d2f2'); E.hemi.intensity = 0.85 + 0.1 * clamp(fk);
    E.sun.color.set('#c9c4ff'); E.sun.intensity = 2.1;
    const sn = sneezeAmt(t);

    // --- Pedrão
    const pp = pPath.pos(t), pw = pPath.walk(t);
    let pHead = [0, 0, 0], pMouth = SP.mouth('ped', t) * 0.8, pLid = 0.5, pLook = [0, 0], pSwing = 0, pSq = 0, pPos = pp, pRot = -PI / 2, pHop = 0, pBlink = blinkAt(t, 4);
    if (t > 20.7 && t < 21.9) { const y = Math.sin(PI * seg(t, 20.7, 21.9)); pMouth = Math.max(pMouth, y * 1.4); pHead = [-0.35 * y, 0, 0]; pLid = 0.5 + 0.5 * y; }
    if (t > 23.0 && t < 24) { pHead = [0, 0.35, 0]; pLook = [0.5, 0]; }
    if (t > 24 && t < 26) { pHead = [0.35 + Math.sin(t * 9) * 0.04, 0, 0]; pLook = [0, -0.5]; pLid = 0.35; }
    if (sn.pre > 0) { pHead = [lerp(pHead[0], -0.4, sn.pre), 0, 0]; pMouth = Math.max(pMouth, sn.pre * 0.7); pLid = lerp(pLid, 0.95, sn.pre); }
    if (sn.hit > 0) { const h = sn.hit; pHead = [0.45 * h, 0, 0]; pMouth = Math.max(pMouth, 1.2 * h); pLid = 0.9 * h; pSq = wob(t, SNZ.find((s) => t >= s && t < s + 0.7), 3, 6) * 0.6; }
    for (const s of SNZ.slice(0, 2)) pSwing += SW * hop(t, s, 0.5);
    if (t > 27.4 && t < 29) { pHead = [0, 0.4, 0.1]; pLook = [0.6, 0]; pLid = 0.55; }
    if (t > 29 && t < sn.pre && false) pHead = [0, 0, 0];
    if (t >= 30.6 && t < 31.0) { pHead = [0.1, 0, 0]; pLook = [0, -0.6]; pLid = 0.3; }
    if (t >= 33.2 && t < 36) { pHead = [0, 0.4, 0]; pLook = [0.6, 0]; pLid = 0.25; pMouth = Math.max(pMouth, 0.3); }
    if (t >= 36) { // lying by the fire
      pPos = [F2[0] - 2.6, 0, F2[2] - 2.8]; pRot = face(pPos, F2); pHop = -0.22; pHead = [0.2, 0.25, 0]; pLook = [0.3, -0.3]; pLid = 0.45;
      if (sn.pre > 0) pHead = [lerp(0.2, -0.4, sn.pre), 0.25, 0];
      if (sn.hit > 0) pHead = [0.45 * sn.hit, 0.25, 0];
      if (t > 43.3) { pMouth = 0.6 + 0.3 * Math.sin(t * 14); pLid = 0.85; }
    }
    ped.set({ pos: pPos, rot: pRot, phase: t * 5, walk: pw, t, head: pHead, mouth: pMouth, lid: pLid, look: pLook, swing: pSwing, squash: pSq, hop: pHop, blink: pBlink, legs: t >= 36 ? 0.9 : 0 });

    // --- Grunk
    const gp = gPath.pos(t), gw = gPath.walk(t);
    let g = { pos: [gp[0], 0, gp[2]], rot: gRot(t), phase: t * 9, walk: gw, mouth: SP.mouth('grunk', t), blink: blinkAt(t, 7), look: [0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], lean: 0, brow: 0, sad: 0, squint: 0, hairUp: 0, legL: 0, legR: 0, legOut: 0, sway: 0 };
    const shiver = t < 10 || (t > 14.2 && t < 19) ? noise(t * 35) * 0.03 : 0;
    g.tilt = shiver;
    if (t < 10) { g.armL = [-0.6, 0, -0.35]; g.armR = [-0.6, 0, -0.35]; g.look = [0.3, 0]; if (t > 7.6 && t < 9.8) { g.armR = [-1.2 + Math.abs(Math.sin(t * 8)) * 0.3, 0, -0.5]; g.brow = 0.6; g.lean = -0.1; g.armL = [0, 0, 0.3]; g.look = [0, 0]; } }
    const sitting = t >= 10.2 && t < 14.25;
    if (sitting) {
      const k = Ez.io(seg(t, 10.0, 10.35)) * (1 - Ez.io(seg(t, 14.0, 14.25)));
      g.pos[1] = -0.3 * k * 1.15; g.legL = -1.45 * k; g.legR = -1.45 * k; g.legOut = 0.25 * k; g.lean = 0.25 * k; g.look = [0, -0.5]; g.head = [0.3, 0, 0];
      if (t < 12.5) { const r = Math.sin(t * 30); g.armL = [-1.25 + r * 0.12, 0, -0.35]; g.armR = [-1.25 - r * 0.12, 0, -0.35]; g.brow = -0.8; g.squint = 0.3; }
      else if (t < 12.9) { g.lean = 0.5; g.mouth = 0.4; g.armL = [-0.6, 0, 0]; g.armR = [-0.6, 0, 0]; }
      else if (t < 13.7) { const c = Math.max(Math.abs(Math.sin((t - 13.0) * 9)), 0); g.armL = [-1.3, 0, -0.1 - (1 - c) * 0.5]; g.armR = [-1.3, 0, -0.1 - (1 - c) * 0.5]; g.brow = -1; }
      else { g.brow = -1; g.squint = 0.4; g.armL = [-0.4, 0, 0.5]; g.armR = [-0.4, 0, 0.5]; g.head = [-0.2, 0, 0]; }
    }
    if (t >= 14.25 && t < 15.0) { g.legR = -1.0 * hop(t, 14.1, 0.45); g.brow = -1; g.armL = [0, 0, 0.6]; g.armR = [0, 0, 0.6]; g.squash = wob(t, 14.45, 3, 7) * 0.3; }
    if (t >= 15.0 && t < 19) { const k = seg(t, 15.25, 15.4); g.squash = wob(t, 15.25, 3, 6) * 0.4; g.sad = k; g.lid = 0.45 * k; g.look = [0, 0.3 * k]; g.head = [0, 0, 0.1]; if (t > 18.4) { g.head = [0, Math.sin(t * 30) * 0.3, 0]; g.squint = 0.5; } }
    if (t >= 19 && t < 22.5) { g.look = [0.5, 0]; g.brow = t > 20.8 ? 1 : 0.3; g.head = [0, 0.2, 0]; }
    if (t >= 22.5 && t < 27.4) { g.lean = 0.55; g.legOut = 0.15; g.brow = 1; g.look = [0.6, -0.1]; g.head = [-0.2, 0, 0]; g.armL = [-0.5, 0, 0.2]; g.armR = [-0.9, 0, 0.0]; g.tilt = noise(t * 40) * 0.03; g.hairUp = 0.2; }
    if (t >= 26.6 && t < 27.4) { g.brow = 1; g.hairUp = 0.6; }
    if (t >= 27.4 && t < 29) { g.lean = 0; g.brow = 1; g.armR = [-2.5, 0, 0.3]; g.armL = [0, 0, 0.3]; g.look = [0.5, 0]; g.smile = 1; }
    const carrying = t >= 29.5 && t < 31.0;
    if (carrying) { g.armL = [-1.1, 0, -0.25]; g.armR = [-1.1, 0, -0.25]; g.lean = 0.1; }
    if (t >= 31.2 && t < 32.65) { g.look = [-0.5, 0]; g.head = [0, -0.3, 0]; g.armL = [-0.6, 0, 0.6]; g.armR = [-0.6, 0, 0.6]; g.brow = 0.6; }
    if (t >= 32.65 && t < 33.6) { g.hairUp = 1; g.brow = 1; g.mouth = Math.max(g.mouth, 0.9); g.lean = -0.25; g.armL = [-0.5, 0, 1.3]; g.armR = [-0.5, 0, 1.3]; g.pos[1] = hop(t, 32.7, 0.4) * 0.5; }
    if (t >= 33.6 && t < 36) { g.armL = [0, 0, 2.6 + Math.sin(t * 10) * 0.3]; g.armR = [0, 0, 2.6 - Math.sin(t * 10) * 0.3]; g.pos[1] = Math.abs(Math.sin(t * 6)) * 0.25; g.smile = 1; g.brow = 0.8; }
    if (t >= 36) { // sitting by the fire, roasting meat
      g.pos = [F2[0] + 1.15, -0.33, F2[2] - 0.75]; g.rot = face(g.pos, F2); g.legL = -1.45; g.legR = -1.45; g.legOut = 0.3; g.lean = 0.1; g.walk = 0;
      g.armR = [-1.25 + Math.sin(t * 1.5) * 0.05, 0, 0]; g.armL = [-0.3, 0, 0.3]; g.smile = 1; g.lid = 0.15; g.look = [-0.2, -0.1];
      if (t > 39 && t < 40.6) { g.head = [0, -0.5, 0]; g.look = [-0.7, 0]; g.armL = [-0.4, 0, 1.0]; }
      if (t > 41.25 && t < 42.7) { g.armL = [-2.2, 0, 0.3 + Math.sin(t * 25) * 0.2]; g.armR = [-2.0, 0, 0.5 - Math.sin(t * 25) * 0.2]; g.brow = 1; g.hairUp = 0.8; g.mouth = Math.max(g.mouth, 0.7); g.pos[1] += Math.abs(Math.sin(t * 12)) * 0.12; g.squint = 0.3; }
      if (t > 42.7) { g.sad = 0.5; g.lid = 0.35; g.squint = 0.2; }
      if (t > 43.5) { g.mouth = 0.5 + 0.4 * Math.abs(Math.sin(t * 9)); g.squint = 0.7; g.head = [-0.2, 0, Math.sin(t * 9) * 0.05]; }
    }
    grunk.set(g);
    sticks.forEach((s) => (s.visible = t > 10.2 && t < 12.95));
    stones.forEach((s) => (s.visible = t > 12.95 && t < 14.2));
    meat.visible = t >= 36;
    snowHat.visible = t > 15.25 && t < 18.7; snowHat.scale.setScalar(1 + wob(t, 15.25, 3, 6) * 0.3);
    chunk.visible = t > 14.95 && t < 15.27;
    if (chunk.visible) { const hw = grunk.headWorld(); const k = Ez.in(seg(t, 14.95, 15.25)); chunk.position.set(lerp(-2.0, hw[0], k), lerp(3.3, hw[1] + 0.35, k), lerp(-0.8, hw[2], k)); }
    bigPine.rotation.z = wob(t, 14.45, 3, 4) * 0.04;

    // --- Lili
    const lp = lPath.pos(t), lw = lPath.walk(t);
    let l = { pos: [lp[0], 0, lp[2]], rot: lRot(t), phase: t * 12, walk: lw, mouth: SP.mouth('lili', t), blink: blinkAt(t, 3), look: [0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], lean: 0, brow: 0, squint: 0, smile: 0 };
    l.tilt = t < 10 || (t > 14 && t < 19) ? noise(t * 38 + 5) * 0.04 : 0;
    if (t < 10) { l.armL = [-0.9, 0, -0.5]; l.armR = [-0.9, 0, -0.5]; l.look = [-0.4, 0.2]; l.sad = 0.6; }
    if (t >= 10 && t < 15.6) { l.look = [-0.6, -0.2]; l.head = [0.2, -0.4, 0]; l.armL = [-0.9, 0, -0.5]; l.armR = [-0.9, 0, -0.5]; }
    if (t >= 15.6 && t < 17.5) { l.armL = [-2.3, 0, -0.35]; l.armR = [-2.3, 0, -0.35]; l.squint = 0.8; l.head = [-0.1, -0.4, Math.sin(t * 16) * 0.08]; l.pos[1] = Math.abs(Math.sin(t * 14)) * 0.04; }
    if (t >= 19 && t < 29.4) { l.look = [0.3, 0.3]; l.head = [-0.2, 0, 0]; l.brow = 0.8; if (t > 21.6 && t < 23.6) { l.armL = [-2.0, 0, 0.2]; l.mouth = Math.max(l.mouth, 0.2); } }
    if (t >= 26.6 && t < 27.3) { l.hairUp = 1; l.lean = -0.2; l.brow = 1; }
    if (t >= 30.6 && t < 32.4) { l.armL = [-2.5, 0, 0.1 + Math.sin(t * 22) * 0.25]; l.look = [0, 0.4]; l.head = [-0.3, 0, 0]; l.smile = 1; l.squint = 0.4; }
    if (t >= 32.4 && t < 33.6) { l.hairUp = 1; l.lean = -0.5; l.brow = 1; l.mouth = Math.max(l.mouth, 0.6); l.pos[1] = hop(t, 32.4, 0.3) * 0.2; }
    if (t >= 33.6 && t < 36) { l.pos[1] = Math.abs(Math.sin(t * 7)) * 0.2; l.armL = [0, 0, 2.6]; l.armR = [0, 0, 2.6]; l.smile = 1; l.mouth = Math.max(l.mouth, 0.3); }
    if (t >= 36) { // cuddling Pedrão's head
      const ph = ped.headWorld();
      l.pos = [ph[0] - 0.35, 0, ph[2] + 0.6]; l.rot = face(l.pos, ph) - 0.5; l.walk = 0; l.armL = [-1.5, 0, -0.2]; l.armR = [-1.5, 0, -0.2]; l.lean = 0.15; l.squint = 0.6; l.smile = 1; l.head = [0.1, -0.3, 0.25];
      if (t > 41.25 && t < 43.3) { l.squint = 0; l.brow = 1; l.look = [0.6, 0]; l.head = [0, 0.6, 0]; l.armL = [-0.5, 0, 0]; l.armR = [-0.5, 0, 0]; }
      if (t > 43.3) { l.squint = 0.8; l.mouth = Math.max(l.mouth, 0.5); l.head = [-0.2, 0.4, Math.sin(t * 14) * 0.08]; }
    }
    lili.set(l);
    feather.visible = t >= 30.4 && t < 32.5;

    // --- fire pile (carried by Grunk)
    let fpos = PILE0;
    if (t >= 29.55 && t < 30.95) { const gp2 = worldOf(grunk.torso, [0, 0.15, 0.62]); fpos = [gp2[0], gp2[1] - 0.15, gp2[2]]; }
    else if (t >= 30.95) fpos = F2;
    fire.root.position.set(...fpos); fire.root.rotation.set(0, 0, 0);
    fire.update(t, fk);
    fire.light.intensity = fk * (14 + noise(t * 9) * 4); fire.light.distance = 24; fire.light.decay = 1.3;
    // beard on fire
    const bk = t > 41.45 && t < 42.7 ? Math.min(1, seg(t, 41.45, 41.7) * 1.2) * (1 - seg(t, 42.45, 42.7)) : 0;
    const bw = worldOf(grunk.head, [0, -HR * 0.95, HR * 0.95]);
    beardFire.root.position.set(...bw); beardFire.update(t, bk); beardFire.light.intensity = bk * 3;
    // sparks
    const bTop = [BOULDER[0], 0.65, BOULDER[2] - 0.25];
    spark0.update(t, 13.55, worldOf(grunk.handR, [0, -0.1, 0.1]), { speed: 0.8, up: 1, grav: 4, life: 0.5 });
    sparks1.update(t, SNZ[0] + 0.25, bTop, { speed: 3.5, up: 3.2, grav: 8, life: 1.0 });
    sparks2.update(t, SNZ[1] + 0.25, bTop, { speed: 2.4, up: 3.0, grav: 8, life: 0.9 });
    const pw2 = ped.headWorld();
    sparks3.update(t, SNZ[2] + 0.05, [pw2[0], pw2[1], pw2[2]], { speed: 1.2, up: 2.5, grav: 6, life: 0.6 });
    puff.update(t, 42.6, bw, { speed: 0.4, up: 0.9, grav: -0.5, life: 1.3 });
    // emotes
    const gh = grunk.headWorld(), lh = lili.headWorld(), ph = ped.headWorld();
    emo.ang.set(t > 13.8 && t < 15 ? 1 + Math.sin(t * 14) * 0.1 : 0, [gh[0] + 0.35, gh[1] + 0.5, gh[2]], 0.45);
    emo.z.set(t > 21.0 && t < 24.0 ? 1 : 0, [ph[0], ph[1] + 0.8 + ((t * 0.4) % 0.3), ph[2]], 0.5);
    emo.sweat.set((t > 22.6 && t < 26.4) || (t > 41.3 && t < 42.8) ? 1 : 0, [gh[0] - 0.3, gh[1] + 0.35 - ((t * 0.5) % 0.15), gh[2] + 0.2], 0.25);
    emo.ex.set(t > 27.45 && t < 28.6 ? Ez.back(seg(t, 27.45, 27.65)) : 0, [gh[0], gh[1] + 0.75, gh[2]], 0.55);
    emo.ex2.set(t > 41.3 && t < 42.3 ? 1 : 0, [gh[0] + 0.35, gh[1] + 0.7, gh[2]], 0.5);
    emo.note.set(t > 15.9 && t < 17.4 ? 1 : 0, [lh[0] + 0.2, lh[1] + 0.35 + ((t * 0.5) % 0.2), lh[2]], 0.22);
    hearts.update(t, [[37.8, [lh[0], lh[1] + 0.35, lh[2]], 0.8]]);
    // snowfall around the camera target
    let sh = shots[0][1]; for (const [t0, f] of shots) if (t >= t0) sh = f;
    const [cp, cl, fov] = sh(t);
    snow.set((i) => {
      const bx = cl[0] - 9 + hash(i) * 18, bz = cl[2] - 9 + hash(i * 3) * 16;
      const y = 8 - ((t * (0.5 + hash(i * 5) * 0.4) + hash(i * 7) * 8) % 8);
      return [bx + Math.sin(t * 0.8 + i) * 0.4, y, bz + Math.cos(t * 0.6 + i * 2) * 0.3];
    });
    E.cam(cp, cl, fov, shake(t), t);
    E.sunAt(cl, [0.7, 0.55, 0.55], t < 5 ? 22 : 10);
  }

  return {
    duration: DUR, caps: SP.caps, cues: [...cues, ...SP.cues], frame,
    title: { t0: 0.5, t1: 4.7, title: 'PEDRÃO E O FOGO', ep: 'Episódio 2', color: '#ffb347' },
    endAt: 45.5, fades: [[0, 0.8, 'in'], [46.6, 48, 'out']],
  };
}

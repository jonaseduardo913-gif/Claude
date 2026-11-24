// =====================================================================
//  PULSO — Motion graphics Short (1080x1920 @ 30fps)
//  Every frame is a pure function of time t, so frames can be rendered
//  in any order / in parallel and the result is fully deterministic.
// =====================================================================
import { CONFIG } from './config.js';
import { G } from './three-layer.js';
import {
  W, H, CX, CY, PAL, clamp, lerp, prog, E, spring, wobble, hash, beatPulse,
  drawText, fitSize, capH, measure, cam, arrow, ring, handRing, burst, star4,
  sunburst, dotGrid, perspGrid, speedLines, roundRect, shapes, morphPath,
  particles, hexA,
} from './lib.js';

export const FPS = 30;
export const DURATION = 24;
export const FRAMES = DURATION * FPS;

// ---------------------------------------------------------------------
// canvases
// ---------------------------------------------------------------------
const out = document.getElementById('out');
const octx = out.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const buf = mk(), bufA = mk(), bufB = mk(), tmp = mk(), chR = mk(), chG = mk(), chB = mk();
const bctx = buf.getContext('2d');

// film grain tiles
const grain = [];
for (let k = 0; k < 6; k++) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 640;
  const g = c.getContext('2d'); const id = g.createImageData(360, 640);
  let s = 1234 + k * 777;
  for (let i = 0; i < id.data.length; i += 4) {
    s = (s * 16807) % 2147483647; const v = (s / 2147483647) * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); grain.push(c);
}

// ---------------------------------------------------------------------
// FX accumulator (camera shake, glitch, chroma, warp, flash)
// ---------------------------------------------------------------------
const newFx = () => ({ shake: 0, glitch: 0, rgb: 0, warp: 0, flash: 0, flashColor: '#ffffff', zoom: 1, rot: 0 });
const hit = (fx, lt, at, amp, decay = 9) => { if (lt >= at) fx.shake += amp * Math.exp(-(lt - at) * decay); };
const pulseFx = (fx, key, lt, at, amp, decay = 10) => { if (lt >= at) fx[key] += amp * Math.exp(-(lt - at) * decay); };

// =====================================================================
//  SCENES
// =====================================================================

// ---------- S0: HOOK "PARE DE ROLAR" (0.0 – 2.0) ---------------------
function sHook(ctx, lt, fx) {
  ctx.fillStyle = PAL.orange; ctx.fillRect(0, 0, W, H);
  const punch = E.inExpo(prog(lt, 1.72, 2.0));
  ctx.save();
  cam(ctx, { x: CX, y: 1240, z: 1 + 0.05 * lt + punch * 7, r: -0.02 + 0.03 * Math.sin(lt * 3) });
  sunburst(ctx, CX, 860, 28, 2200, lt * 0.35, '#E54A00');
  // radial vignette for depth
  const g = ctx.createRadialGradient(CX, 900, 100, CX, 900, 1300);
  g.addColorStop(0, 'rgba(255,190,80,0.35)'); g.addColorStop(1, 'rgba(120,20,0,0.45)');
  ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);

  // PARE — letters drop from the sky, land with squash & stretch
  const sz = fitSize(ctx, 'PARE', 'Anton', 980, 0.02);
  const ch = capH(ctx, 'Anton', sz);
  drawText(ctx, 'PARE', {
    fam: 'Anton', size: sz, x: CX, y: 690, track: 0.02, fill: PAL.black,
    ext: { dx: 0, dy: 26, n: 12, color: '#7A2400' },
    per: (i) => {
      const p = lt - i * 0.07;
      if (p < 0) return { a: 0 };
      const fall = clamp(p / 0.13);
      const land = p - 0.13;
      const sq = land > 0 ? wobble(land, 3.2, 7) : 0;
      const sy = land > 0 ? 1 - 0.38 * sq : 1.25;
      const sx = land > 0 ? 1 + 0.3 * sq : 0.85;
      return { dy: lerp(-1500, 0, E.inCubic(fall)) + (ch / 2) * (1 - sy), sx, sy, rot: (i % 2 ? 1 : -1) * 0.05 * sq };
    },
  });
  for (let i = 0; i < 4; i++) hit(fx, lt, 0.13 + i * 0.07, 14, 14);

  // DE — black pill popping
  if (lt > 0.5) {
    const s = spring(lt - 0.5, 2.6, 7);
    ctx.save(); ctx.translate(CX, 1000); ctx.rotate(-0.09 + 0.3 * (1 - s)); ctx.scale(s, s);
    ctx.fillStyle = PAL.black; roundRect(ctx, -150, -75, 300, 150, 75); ctx.fill();
    drawText(ctx, 'DE', { fam: 'Archivo Black', size: 112, x: 0, y: 0, fill: PAL.yellow });
    ctx.restore();
  }
  // ROLAR — electric blue band + horizontally stretched word
  if (lt > 0.95) {
    const bp = E.outExpo(prog(lt, 0.95, 1.2));
    ctx.save(); ctx.translate(CX, 1255); ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.fillStyle = PAL.blue; ctx.fillRect(-700 * bp, -190, 1400 * bp, 380);
    ctx.fillStyle = PAL.yellow; ctx.fillRect(-700 * bp, 172, 1400 * bp, 18);
    ctx.restore();
    const s2 = fitSize(ctx, 'ROLAR', 'Anton', 900, 0.03);
    const sx = Math.max(0, spring(lt - 1.0, 2.2, 6));
    drawText(ctx, 'ROLAR', {
      fam: 'Anton', size: s2, x: CX, y: 1255, track: 0.03, fill: PAL.white,
      ext: { dx: 14, dy: 14, n: 8, color: '#0A1580' },
      per: (i, n) => ({ dx: (i - (n - 1) / 2) * 120 * (1 - sx), sx: Math.max(0.01, sx), sy: 1 + 0.4 * (1 - sx), rot: 0.04 * Math.sin(lt * 9 + i) * prog(lt, 1.3, 1.5) }),
    });
    hit(fx, lt, 1.0, 26, 8);
  }
  // overlays: hand-drawn ring + arrow
  if (lt > 1.45) {
    handRing(ctx, CX, 1255, 560, 250, E.outCubic(prog(lt, 1.45, 1.75)), PAL.yellow, 16, 0.2);
    arrow(ctx, 960, 1720, 800, 1480, E.outExpo(prog(lt, 1.5, 1.7)), PAL.black, 22);
    arrow(ctx, 120, 300, 250, 470, E.outExpo(prog(lt, 1.55, 1.75)), PAL.black, 22);
  }
  ctx.restore();
  pulseFx(fx, 'rgb', lt, 1.5, 22, 14); pulseFx(fx, 'glitch', lt, 1.5, 1, 12);
  fx.rgb += punch * 18;
}

// ---------- S1: "ISSO É MOTION" + 3D flying objects (2.0 – 4.5) -----
function sMotion(ctx, lt, fx) {
  const g = ctx.createRadialGradient(CX, 900, 50, CX, 900, 1400);
  g.addColorStop(0, '#3D5BFF'); g.addColorStop(1, '#0A148F');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  cam(ctx, { z: 1.04 + 0.04 * Math.sin(lt * 2.2), r: 0.025 * Math.sin(lt * 1.7) });
  perspGrid(ctx, 1150, lt * 2.2, 'rgba(255,255,255,0.16)');

  // 3D back layer
  G.cam([0, 0, 10], [0, 0, 0], 45);
  const kz = lerp(-46, 13, E.inCubic(prog(lt, 0.0, 1.35)));
  G.put('knot', 'knot', { p: [lerp(-2.2, 0.8, prog(lt, 0, 1.35)), lerp(1.2, -0.6, prog(lt, 0, 1.35)), kz], r: [lt * 1.3, lt * 2.1, 0], s: 1.5, color: PAL.orange });
  G.put('ico', 'ico', { p: [1.45, 2.65 + 0.15 * Math.sin(lt * 4), -3], r: [lt * 1.4, lt * 1.9, 0.3], s: 0.85 * E.outBack(prog(lt, 0.25, 0.6)), color: PAL.yellow });
  for (let i = 0; i < 3; i++) {
    const a = lt * 2.2 + i * 2.1;
    G.put('sph' + i, 'sphere', { p: [Math.cos(a) * 2.2, -2.4 + Math.sin(a) * 0.5, -2 + Math.sin(a) * 2], s: 0.38 * E.outBack(prog(lt, 0.4 + i * 0.1, 0.7 + i * 0.1)), color: PAL.purple });
  }
  G.put('box0', 'box', { p: [-1.6, -2.9, -4], r: [lt * 1.1, lt * 1.6, 0.4], s: 0.7 * E.outBack(prog(lt, 0.6, 0.9)), color: PAL.yellow });
  G.draw(ctx);

  // "ISSO É"
  drawText(ctx, 'ISSO É', {
    fam: 'Archivo Black', size: 150, x: CX, y: 520, fill: PAL.white, track: 0.02,
    ext: { dx: 0, dy: 12, n: 6, color: '#0A148F' },
    per: (i) => { const s = E.outBack(prog(lt, 0.05 + i * 0.04, 0.3 + i * 0.04), 2.5); return { sx: s, sy: s, dy: 60 * (1 - s) }; },
  });

  // "MOTION" — letters assemble from chaos
  if (lt > 0.45) {
    const sz = fitSize(ctx, 'MOTION', 'Anton', 1010, 0.01);
    const echo = prog(lt, 1.45, 1.6);
    if (echo > 0) {
      for (let k = 3; k >= 1; k--) {
        const ph = (lt * 2 + k * 0.33) % 1;
        drawText(ctx, 'MOTION', { fam: 'Anton', size: sz, x: CX, y: 980, track: 0.01, stroke: hexA(PAL.yellow, (1 - ph) * 0.7 * echo), lw: 5, scale: 1 + ph * 0.45 });
      }
    }
    drawText(ctx, 'MOTION', {
      fam: 'Anton', size: sz, x: CX, y: 980, track: 0.01, fill: PAL.yellow,
      ext: { dx: 12, dy: 26, n: 12, color: '#060C5C' },
      per: (i) => {
        const p = Math.max(0, spring(lt - 0.45 - i * 0.035, 1.9, 6.5));
        const q = 1 - p;
        return { dx: (hash(i * 3.1) - 0.5) * 1800 * q, dy: (hash(i * 7.7) - 0.5) * 2200 * q, rot: (hash(i * 5.3) - 0.5) * 7 * q, sx: 1 + 2 * q, sy: 1 + 2 * q, a: clamp((lt - 0.45 - i * 0.035) * 8) };
      },
    });
    hit(fx, lt, 0.75, 18, 10);
  }
  // 3D front layer — giant ring flies through camera, small cubes zip
  const rz = lerp(-30, 12, E.inQuad(prog(lt, 0.95, 1.65)));
  if (lt > 0.95 && lt < 1.7) G.put('ringBig', 'torus', { p: [0, 0, rz], r: [0.25, 0.15, lt], s: 3.4, color: PAL.orange });
  for (let i = 0; i < 4; i++) {
    const p = prog(lt, 1.6 + i * 0.12, 2.1 + i * 0.12);
    if (p > 0 && p < 1) G.put('cubeF' + i, 'box', { p: [lerp(i % 2 ? 7 : -7, i % 2 ? -7 : 7, p), -3 + i * 1.9, 2 - i * 0.6], r: [lt * 5, lt * 4, 0], s: 0.45, color: i % 2 ? PAL.purple : PAL.white });
  }
  G.draw(ctx);
  hit(fx, lt, 1.55, 24, 8); pulseFx(fx, 'warp', lt, 1.55, 30, 7);

  // pointer arrows + circle highlight
  if (lt > 1.95) {
    const p = E.outExpo(prog(lt, 1.95, 2.2));
    arrow(ctx, 40, 1380, 250, 1180, p, PAL.white, 20);
    arrow(ctx, 1040, 1380, 830, 1180, p, PAL.white, 20);
    ring(ctx, CX, 980, 230 + 30 * beatPulse(lt), 12, PAL.white, E.outCubic(prog(lt, 1.95, 2.3)));
    burst(ctx, CX, 980, 16, 300, 420, PAL.yellow, lt * 0.5, 10, prog(lt, 1.95, 2.15));
  }
  ctx.restore();
}

// ---------- S2: "ENERGIA" squash / explode / reassemble (4.5 – 7.0) -
function sEnergia(ctx, lt, fx) {
  const g = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1300);
  g.addColorStop(0, '#9A4DFF'); g.addColorStop(1, '#2E0080');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const bp = beatPulse(lt);
  ctx.save();
  cam(ctx, { z: 1 + 0.06 * bp + 0.04 * lt, r: 0.03 * Math.sin(lt * 2.5) });
  speedLines(ctx, CX, CY, 90, lt, 'rgba(255,255,255,0.5)', 1.0);

  // scrolling outline rows
  const rowsIn = E.outExpo(prog(lt, 0.45, 0.85));
  if (rowsIn > 0) {
    const rs = 300;
    for (let r = -2; r <= 2; r++) {
      if (r === 0) continue;
      const dir = r % 2 ? 1 : -1;
      const off = dir * (lt * 520) + dir * (1 - rowsIn) * 1400;
      ctx.save(); ctx.translate(off % 1500, CY + r * 430);
      for (let k = -2; k <= 2; k++) drawText(ctx, 'ENERGIA', { fam: 'Anton', size: rs, x: k * 1500, y: 0, track: 0.02, stroke: hexA(PAL.yellow, 0.45), lw: 4 });
      ctx.restore();
    }
  }

  // 3D capsules zipping behind
  G.cam([0, 0, 10], [0, 0, 0], 45);
  for (let i = 0; i < 3; i++) {
    const p = prog(lt, 0.9 + i * 0.13, 1.35 + i * 0.13);
    if (p > 0 && p < 1) G.put('cap' + i, 'capsule', { p: [lerp(-8, 8, E.inOutCubic(p)), 2.6 - i * 2.6, -3 + i], r: [0, 0, Math.PI / 2], s: [0.9, 1.6, 0.9], color: [PAL.orange, PAL.blue, PAL.yellow][i] });
  }
  G.put('octa', 'octa', { p: [0, 0, lerp(-60, 11, E.inCubic(prog(lt, 1.9, 2.45)))], r: [lt * 3, lt * 2, 0], s: 1.4, color: PAL.yellow, metal: true });
  G.draw(ctx);

  // main word
  const sz = fitSize(ctx, 'ENERGIA', 'Anton', 1000, 0.02);
  const ch = capH(ctx, 'Anton', sz);
  const ex = E.outExpo(prog(lt, 1.45, 1.75)) * (1 - E.inOutBack(prog(lt, 1.85, 2.15)));
  drawText(ctx, 'ENERGIA', {
    fam: 'Anton', size: sz, x: CX, y: CY, track: 0.02, fill: PAL.yellow,
    ext: { dx: 0, dy: 30, n: 14, color: '#1E004F' },
    per: (i, n) => {
      const p = Math.max(0, spring(lt - i * 0.045, 2.2, 5.5));
      let sy = p; let sx = 1 / Math.sqrt(Math.max(0.15, p));
      if (lt > 0.6) { const w = 0.2 * Math.sin(lt * Math.PI * 4 - i * 0.8) * prog(lt, 0.6, 0.8); sy *= 1 + w; sx *= 1 - w * 0.6; }
      const ang = (i - (n - 1) / 2) * 0.55 - Math.PI / 2 + (hash(i) - 0.5) * 0.6;
      const dist = 520 * ex;
      return {
        dx: Math.cos(ang) * dist * 1.2, dy: (ch / 2) * (1 - sy) + Math.sin(ang) * dist + (i % 2 ? 1 : -1) * 200 * ex,
        sx: Math.max(0.01, sx), sy: Math.max(0.01, sy), rot: (hash(i * 9.1) - 0.5) * 9 * ex,
        fill: ex > 0.3 ? [PAL.yellow, PAL.orange, PAL.white][i % 3] : PAL.yellow,
      };
    },
  });
  // explosion sparks
  if (lt > 1.45) particles(ctx, CX, CY, 140, lt - 1.45, { speed: 2600, drag: 4, seed: 11, colors: [PAL.yellow, PAL.white, PAL.orange], len: 0.05, life: 0.8, width: 8 });
  // rings on the 2.0 beat
  if (lt > 2.0) for (let k = 0; k < 3; k++) {
    const p = prog(lt, 2.0 + k * 0.08, 2.5 + k * 0.08);
    if (p > 0 && p < 1) ring(ctx, CX, CY, 200 + 700 * E.outCubic(p), 14 * (1 - p), hexA(PAL.white, 1 - p), 1);
  }
  ctx.restore();
  hit(fx, lt, 0.0, 16, 10); hit(fx, lt, 1.45, 40, 6); hit(fx, lt, 2.15, 20, 10);
  pulseFx(fx, 'rgb', lt, 1.45, 26, 8); pulseFx(fx, 'glitch', lt, 1.45, 1, 9);
  pulseFx(fx, 'flash', lt, 1.45, 0.5, 14);
}

// ---------- S3: SHAPE MORPH -> lightning (7.0 – 9.5) -----------------
const MORPH = [
  { s: shapes.circle, c: PAL.orange, d: '#7A2400' },
  { s: shapes.square, c: PAL.blue, d: '#0A148F' },
  { s: shapes.triangle, c: PAL.purple, d: '#2E0080' },
  { s: shapes.star, c: PAL.white, d: '#6F6F80' },
  { s: shapes.bolt, c: PAL.yellow, d: '#6A7A00' },
];
function sMorph(ctx, lt, fx) {
  ctx.fillStyle = '#08080D'; ctx.fillRect(0, 0, W, H);
  const seg = Math.min(4, Math.floor(lt / 0.5));
  const ml = lt - seg * 0.5;
  // which pair / blend
  let a = seg, b = seg, k = 0;
  if (seg >= 1 && ml < 0.22) { a = seg - 1; b = seg; k = E.inOutCubic(ml / 0.22); }
  const col = k < 0.5 ? MORPH[a].c : MORPH[b].c;
  const dcol = k < 0.5 ? MORPH[a].d : MORPH[b].d;
  ctx.save();
  cam(ctx, { z: 1 + 0.05 * beatPulse(lt), r: 0.02 * Math.sin(lt * 3) });
  dotGrid(ctx, 54, 'rgba(255,255,255,0.10)', lt * 30);
  // glow
  const gl = ctx.createRadialGradient(CX, 900, 50, CX, 900, 900);
  gl.addColorStop(0, hexA(col, 0.55)); gl.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  // ripple rings at each morph
  for (let m = 1; m <= seg; m++) {
    const p = prog(lt, m * 0.5, m * 0.5 + 0.6);
    if (p > 0 && p < 1) ring(ctx, CX, 900, 320 + 800 * E.outCubic(p), 18 * (1 - p), hexA(MORPH[m].c, 1 - p), 1);
  }
  // the shape
  const enter = E.outElastic(prog(lt, 0, 0.6));
  const bump = 1 + 0.25 * wobble(ml, 2.5, 6) * (seg >= 1 ? 1 : 0);
  const R = 330 * enter * bump * (seg === 4 ? 1.25 : 1);
  const rot = (seg >= 1 ? spring(ml, 1.8, 6) * Math.PI / 2 : 0) + seg * Math.PI / 2 * 0 + lt * 0.3 * (seg === 4 ? 0 : 1);
  const pts = morphPath(MORPH[a].s, MORPH[b].s, k);
  const jit = seg === 4 ? 10 * Math.sin(lt * 90) * Math.exp(-ml * 4) : 0;
  ctx.save(); ctx.translate(CX + jit, 900); ctx.rotate(seg === 4 ? 0.12 : rot);
  for (let l = 16; l >= 0; l--) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const X = x * R + l * 2.2, Y = y * R + l * 3.2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.closePath(); ctx.fillStyle = l ? dcol : col; ctx.fill();
  }
  // highlight edge
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
  ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
  // electric arcs around the bolt
  if (seg === 4) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let e = 0; e < 7; e++) {
      const fr = Math.floor(lt * 15);
      ctx.beginPath(); let ang = hash(e * 13 + fr) * Math.PI * 2; let r0 = 420;
      ctx.moveTo(CX + Math.cos(ang) * r0, 900 + Math.sin(ang) * r0);
      for (let s = 1; s < 7; s++) { const rr = r0 + s * 45; const aa = ang + (hash(e * 31 + s + fr) - 0.5) * 0.4; ctx.lineTo(CX + Math.cos(aa) * rr, 900 + Math.sin(aa) * rr); }
      ctx.strokeStyle = hexA(PAL.yellow, 0.8); ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.restore();
  }
  // typography
  drawText(ctx, 'TUDO SE', {
    fam: 'Space Grotesk', weight: 700, size: 92, x: CX, y: 300, track: 0.25, fill: PAL.white,
    per: (i) => { const p = E.outBack(prog(lt, 0.1 + i * 0.03, 0.4 + i * 0.03)); return { sy: p, a: p > 0 ? 1 : 0 }; },
  });
  const tsz = fitSize(ctx, 'TRANSFORMA', 'Anton', 990, 0.01);
  drawText(ctx, 'TRANSFORMA', {
    fam: 'Anton', size: tsz, x: CX, y: 1520, track: 0.01, fill: PAL.white,
    ext: { dx: 0, dy: 16, n: 8, color: '#333344' },
    per: (i) => {
      // flip cascade on each morph beat
      const enterP = E.outBack(prog(lt, 0.2 + i * 0.025, 0.45 + i * 0.025));
      const fl = seg >= 1 ? prog(ml, i * 0.011, 0.11 + i * 0.011) : 1;
      const c = Math.cos(fl * Math.PI * 2);
      return { sy: Math.max(0.02, Math.abs(c)) * enterP, fill: c < 0 ? col : (i % 3 === 0 ? col : PAL.white), a: enterP > 0 ? 1 : 0 };
    },
  });
  // corner brackets
  const bp = E.outExpo(prog(lt, 0.3, 0.6));
  ctx.strokeStyle = hexA(PAL.white, 0.8); ctx.lineWidth = 8;
  [[120, 520, 1, 1], [960, 520, -1, 1], [120, 1290, 1, -1], [960, 1290, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * 90 * bp); ctx.lineTo(x, y); ctx.lineTo(x + sx * 90 * bp, y); ctx.stroke();
  });
  ctx.restore();
  for (let m = 1; m <= 4; m++) { hit(fx, lt, m * 0.5, 16, 10); pulseFx(fx, 'rgb', lt, m * 0.5, 10, 16); }
  pulseFx(fx, 'flash', lt, 2.0, 0.55, 10); fx.flashColor = '#F4FF9A';
  pulseFx(fx, 'glitch', lt, 2.0, 1, 8); hit(fx, lt, 2.0, 30, 6);
}

// ---------- S4: CRIATIVIDADE extreme close -> wide (9.5 – 12.0) ------
function sCriatividade(ctx, lt, fx) {
  ctx.fillStyle = PAL.yellow; ctx.fillRect(0, 0, W, H);
  const zo = E.inOutExpo(prog(lt, 0.3, 0.95));
  const sz1 = fitSize(ctx, 'CRIATI-', 'Anton', 1000, 0.01);
  const sz2 = fitSize(ctx, 'VIDADE', 'Anton', 1000, 0.01);
  const ch1 = capH(ctx, 'Anton', sz1);
  const y1 = CY - ch1 * 0.58 - 40, y2 = CY + capH(ctx, 'Anton', sz2) * 0.58 + 10;
  const m1 = measure(ctx, 'CRIATI-', 'Anton', sz1, 0.01);
  const cx0 = CX + m1.xs[0];
  ctx.save();
  // extreme close-up on the "C", whip out to wide
  const z = lerp(11, 1, zo) * (1 + 0.04 * beatPulse(lt));
  ctx.translate(CX, CY); ctx.rotate(lerp(-0.5, 0, zo) + 0.02 * Math.sin(lt * 3)); ctx.scale(z, z);
  ctx.translate(-lerp(cx0, CX, zo), -lerp(y1, CY, zo));
  // background pattern: diagonal stripes
  ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = PAL.black;
  for (let i = -40; i < 40; i++) { ctx.beginPath(); const x = i * 90 + (lt * 120) % 90; ctx.moveTo(x, -2000); ctx.lineTo(x + 30, -2000); ctx.lineTo(x + 30 + 2400, 4000); ctx.lineTo(x + 2400, 4000); ctx.fill(); }
  ctx.restore();

  // orbiting 3D objects (back half)
  G.cam([0, 0, 10], [0, 0, 0], 45);
  const orb = (front) => {
    const defs = [['sphere', PAL.orange, 0.55], ['box', PAL.blue, 0.5], ['cone', PAL.purple, 0.6], ['knot', PAL.orange, 0.33], ['ico', PAL.blue, 0.5]];
    defs.forEach(([geo, c, s], i) => {
      const a = lt * 1.6 + i * (Math.PI * 2 / defs.length);
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) return;
      const app = E.outBack(prog(lt, 0.85 + i * 0.06, 1.15 + i * 0.06));
      G.put('orb' + i, geo, { p: [Math.cos(a) * 2.5, Math.sin(a * 1) * 0.6 + (i - 2) * 0.9, Math.sin(a) * 3], r: [lt * 1.5 + i, lt * 2 + i, 0], s: s * app, color: c });
    });
    G.draw(ctx);
  };
  if (zo > 0.9) orb(false);

  const flipW = (i, line) => {
    const p = prog(lt, 1.7 + i * 0.04 + line * 0.1, 1.95 + i * 0.04 + line * 0.1);
    return Math.cos(p * Math.PI * 2);
  };
  const skew = 0.18 * Math.sin(lt * 4) * prog(lt, 2.0, 2.2);
  drawText(ctx, 'CRIATI-', {
    fam: 'Anton', size: sz1, x: CX, y: y1, track: 0.01, fill: PAL.black, skx: skew,
    ext: { dx: 14, dy: 18, n: 10, color: PAL.orange },
    per: (i) => { const c = flipW(i, 0); return { sx: Math.max(0.02, Math.abs(c)), fill: c < 0 ? PAL.purple : PAL.black, dy: -20 * wobble(lt - 1.0 - i * 0.03, 3, 6) }; },
  });
  drawText(ctx, 'VIDADE', {
    fam: 'Anton', size: sz2, x: CX, y: y2, track: 0.01, fill: PAL.purple, skx: -skew,
    ext: { dx: 14, dy: 18, n: 10, color: PAL.black },
    per: (i) => { const c = flipW(i, 1); const p = E.outBack(prog(lt, 0.55 + i * 0.05, 0.85 + i * 0.05)); return { sx: Math.max(0.02, Math.abs(c)) * p, sy: p, fill: c < 0 ? PAL.orange : PAL.purple }; },
  });
  if (zo > 0.9) orb(true);

  // doodles
  if (lt > 1.2) {
    const p = E.outCubic(prog(lt, 1.2, 1.5));
    ctx.save(); ctx.strokeStyle = PAL.orange; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath();
    const N = 40;
    for (let i = 0; i <= N * p; i++) { const x = 120 + i * (840 / N); const y = y2 + 260 + Math.sin(i * 0.7) * 22; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
    [[150, 520, 1.25], [930, 600, 1.32], [980, 1500, 1.4], [110, 1420, 1.48]].forEach(([x, y, at], i) => {
      const s = spring(lt - at, 2.5, 6);
      if (s > 0) star4(ctx, x, y, 70 * s, lt * 2 + i, i % 2 ? PAL.purple : PAL.black);
    });
  }
  ctx.restore();
  pulseFx(fx, 'rgb', lt, 0.3, 0, 10); fx.rgb += 14 * Math.sin(Math.PI * prog(lt, 0.3, 0.95));
  fx.warp += 22 * Math.sin(Math.PI * prog(lt, 0.35, 0.9));
  hit(fx, lt, 0.95, 26, 8); hit(fx, lt, 2.0, 12, 10);
}

// ---------- S5: "SEM LIMITES" 3D tunnel w/ speed ramp (12.0 – 15.0) --
const speedAt = (t) => {
  const slow = 1 - 0.88 * (E.inOutCubic(prog(t, 0.85, 1.05)) - E.inOutCubic(prog(t, 1.55, 1.8)));
  return slow * (1 + 2.6 * E.inCubic(prog(t, 1.7, 2.2)));
};
const distTable = (() => { const N = 900, dt = 3.2 / N, arr = [0]; for (let i = 1; i <= N; i++) arr.push(arr[i - 1] + speedAt(i * dt) * dt); return { arr, dt }; })();
const distAt = (t) => { const i = clamp(Math.floor(t / distTable.dt), 0, distTable.arr.length - 1); return distTable.arr[i]; };

function sTunnel(ctx, lt, fx) {
  ctx.fillStyle = '#040408'; ctx.fillRect(0, 0, W, H);
  const sp = speedAt(lt);
  const gl = ctx.createRadialGradient(CX, CY, 20, CX, CY, 900);
  gl.addColorStop(0, 'rgba(140,70,255,0.75)'); gl.addColorStop(0.4, 'rgba(60,20,160,0.35)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  ctx.save();
  cam(ctx, { z: 1 + 0.05 * beatPulse(lt), r: lt * 0.12 });
  speedLines(ctx, CX, CY, 140, distAt(lt) * 1.3, 'rgba(255,255,255,0.7)', 0.5 + sp * 0.7);
  // tunnel
  G.cam([0, 0, 0], [0, 0, -1], 70);
  const d = distAt(lt) * 26, SP = 5, N = 22;
  const base = Math.floor(d / SP), off = d % SP;
  const cols = [PAL.orange, PAL.blue, PAL.purple, PAL.yellow];
  for (let i = 0; i < N; i++) {
    const wi = base + i; const z = -(i * SP) + off - 2;
    if (z > 1) continue;
    G.put('tr' + i, 'tring', { p: [Math.sin(wi * 0.45) * 0.7, Math.cos(wi * 0.37) * 0.7, z], r: [0, 0, wi * 0.4 + lt], s: 1, color: cols[((wi % 4) + 4) % 4] });
  }
  G.draw(ctx);
  // text
  const s1 = fitSize(ctx, 'SEM', 'Anton', 640, 0.04);
  const inS = E.outExpo(prog(lt, 0.12, 0.4));
  const blur = E.inCubic(prog(lt, 1.75, 2.0)) * (1 - prog(lt, 2.4, 2.6));
  const fly = E.inExpo(prog(lt, 2.55, 3.0));
  const zt = (1 + fly * 8);
  ctx.save(); ctx.translate(CX, CY); ctx.scale(zt, zt); ctx.translate(-CX, -CY);
  for (let k = blur > 0 ? 5 : 0; k >= 0; k--) {
    const sk = 1 + k * 0.07 * blur;
    ctx.globalAlpha = k ? 0.22 : 1;
    if (inS > 0) drawText(ctx, 'SEM', { fam: 'Anton', size: s1, x: CX, y: 740, track: 0.04, fill: PAL.white, scale: (lerp(4, 1, inS)) * sk, ext: k ? null : { dx: 0, dy: 20, n: 10, color: '#3A1A8C' } });
    if (lt > 0.5) {
      const s2 = fitSize(ctx, 'LIMITES', 'Anton', 1000, 0.02);
      drawText(ctx, 'LIMITES', {
        fam: 'Anton', size: s2, x: CX, y: 1150, track: 0.02, fill: PAL.orange, scale: sk,
        ext: k ? null : { dx: 0, dy: 24, n: 12, color: '#5A1600' },
        per: (i) => { const p = prog(lt, 0.5 + i * 0.035, 0.6 + i * 0.035); const g2 = p < 1 ? (hash(i + Math.floor(lt * 30)) - 0.5) * 120 : 0; return { a: p > 0 ? 1 : 0, dx: g2, fill: i % 2 ? PAL.yellow : PAL.orange, sy: 1 + 0.15 * beatPulse(lt) }; },
      });
    }
  }
  ctx.restore();
  // slow-mo label
  if (lt > 0.95 && lt < 1.8) {
    const a = Math.sin(Math.PI * prog(lt, 0.95, 1.8));
    drawText(ctx, '● 0.25x', { fam: 'Space Grotesk', weight: 700, size: 46, x: CX, y: 1520, fill: hexA(PAL.yellow, a), track: 0.2 });
  }
  ctx.restore();
  fx.rgb += 10 * (1 - Math.abs(sp - 1) < 0.5 ? 0 : 1) * prog(lt, 0.9, 1.0) * (1 - prog(lt, 1.6, 1.8)) + blur * 20;
  fx.warp += blur * 18;
  hit(fx, lt, 0.15, 20, 10); hit(fx, lt, 0.5, 14, 10); hit(fx, lt, 1.75, 34, 4);
  pulseFx(fx, 'flash', lt, 2.9, 0, 10); fx.flash += fly * 0.9;
}

// ---------- S6: rapid-fire cuts (15.0 – 17.5) ------------------------
function sCuts(ctx, lt, fx) {
  const k = Math.min(4, Math.floor(lt / 0.5)); const ct = lt - k * 0.5;
  const cfgs = [
    { w: 'MAIS', bg: PAL.yellow, fg: PAL.black, ex: PAL.orange },
    { w: 'RÁPIDO', bg: PAL.blue, fg: PAL.white, ex: '#060C5C' },
    { w: 'MAIS', bg: PAL.purple, fg: PAL.yellow, ex: '#1E004F' },
    { w: 'FORTE', bg: PAL.orange, fg: PAL.black, ex: '#6A1A00' },
    { w: 'VIRAL', bg: '#06060A', fg: PAL.white, ex: null },
  ];
  const c = cfgs[k];
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  cam(ctx, { z: 1 + 0.12 * Math.exp(-ct * 8), r: (k % 2 ? 1 : -1) * 0.03 * Math.exp(-ct * 5) });
  // per-cut backdrop graphics
  if (k === 0) { for (let r = 0; r < 6; r++) ring(ctx, CX, CY, ((r * 190 + ct * 900) % 1140), 14, hexA(PAL.black, 0.25), 1); }
  if (k === 1) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 26; i++) { const y = hash(i) * H; const x = ((hash(i + 9) * 2000 - ct * 5200 * (0.6 + hash(i + 3))) % 2200 + 2200) % 2200 - 600; ctx.fillRect(x, y, 300 + hash(i + 5) * 500, 6 + hash(i + 7) * 10); } }
  if (k === 2) burst(ctx, CX, CY, 20, 0, 1600, hexA(PAL.yellow, 0.18), ct * 0.6, 60, 1);
  if (k === 3) sunburst(ctx, CX, CY, 20, 2200, -ct * 0.8, '#E54A00');
  if (k === 4) dotGrid(ctx, 60, 'rgba(255,255,255,0.12)', ct * 60);

  // 3D object per cut
  G.cam([0, 0, 10], [0, 0, 0], 45);
  if (k === 0) G.put('cs', 'sphere', { p: [1.6, 2.9, -2], s: 0.7 * E.outBack(prog(ct, 0, 0.2)), color: PAL.orange });
  if (k === 1) G.put('cb', 'box', { p: [lerp(6, -6, ct * 2), -2.6, -1], r: [ct * 8, ct * 6, 0], s: 0.9, color: PAL.yellow });
  if (k === 2) G.put('ct', 'torus', { p: [0, 0, lerp(-20, 11, E.inCubic(ct * 2))], r: [0.4, ct * 4, 0], s: 1.6, color: PAL.orange });
  if (k === 3) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; G.put('cf' + i, i % 2 ? 'ico' : 'box', { p: [Math.cos(a) * 2.6 * (1 + ct * 2), Math.sin(a) * 4 * (1 + ct * 2), lerp(-6, 6, ct * 2)], r: [ct * 6 + i, ct * 5, i], s: 0.6, color: i % 2 ? PAL.black : PAL.blue, metal: i % 2 === 0 }); }
  if (k !== 2) G.draw(ctx);

  const sz = fitSize(ctx, c.w, 'Anton', k === 2 ? 1700 : 990, 0.02);
  const o = { fam: 'Anton', size: sz, x: CX, y: CY, track: 0.02, fill: c.fg, ext: c.ex ? { dx: 0, dy: 26, n: 12, color: c.ex } : null };
  if (k === 0) { const s = spring(ct, 2.4, 6); drawText(ctx, c.w, { ...o, sx: 1, sy: 0.2 + 1.5 * s, per: (i) => ({ dy: -40 * wobble(ct - i * 0.03, 4, 8) }) }); }
  if (k === 1) {
    const x = lerp(1400, 0, E.outExpo(prog(ct, 0, 0.22)));
    for (let tr = 4; tr >= 0; tr--) { ctx.globalAlpha = tr ? 0.15 : 1; drawText(ctx, c.w, { ...o, ext: tr ? null : o.ext, x: CX + x + tr * 90 * (1 - prog(ct, 0.15, 0.3)), skx: -0.28 }); }
    ctx.globalAlpha = 1;
  }
  if (k === 2) { ctx.save(); ctx.translate(CX, CY); ctx.rotate(-Math.PI / 2 + 0.15 * (1 - spring(ct, 2, 6))); drawText(ctx, c.w, { ...o, x: 0, y: 0, scale: 1 + 0.6 * (1 - E.outExpo(prog(ct, 0, 0.25))) }); ctx.restore(); G.draw(ctx); }
  if (k === 3) { drawText(ctx, c.w, { ...o, scale: lerp(2.8, 1, E.outExpo(prog(ct, 0, 0.12))), ext: { dx: 18, dy: 36, n: 16, color: c.ex } }); }
  if (k === 4) {
    const cols = [PAL.orange, PAL.blue, PAL.yellow, PAL.purple];
    cols.forEach((cc, i) => { const d = (i + 1) * 14 * (1 + Math.sin(ct * 20)); drawText(ctx, c.w, { ...o, ext: null, fill: null, stroke: cc, lw: 7, x: CX + d * (i % 2 ? 1 : -1), y: CY + d * 0.6 * (i < 2 ? 1 : -1) }); });
    drawText(ctx, c.w, { ...o, ext: null, per: (i) => ({ dx: hash(i + Math.floor(ct * 30)) < 0.25 ? (hash(i * 3 + Math.floor(ct * 30)) - 0.5) * 80 : 0 }) });
  }
  // shared overlays: counter tag + brackets
  drawText(ctx, `0${k + 1} / 05`, { fam: 'Space Grotesk', weight: 700, size: 44, x: CX, y: 300, fill: k === 0 || k === 3 ? PAL.black : PAL.white, track: 0.3 });
  const ap = E.outExpo(prog(ct, 0.08, 0.3));
  const ac = k === 0 || k === 3 ? PAL.black : PAL.yellow;
  arrow(ctx, CX, 1700, CX, 1700 - 230 * ap, ap, ac, 18);
  ctx.restore();
  hit(fx, ct, 0, k === 3 ? 44 : 22, 9);
  pulseFx(fx, 'flash', ct, 0, 0.35, 22); fx.flashColor = '#ffffff';
  if (k === 4) { fx.rgb += 14; fx.glitch += 0.6; }
  if (k === 1) fx.warp += 10 * (1 - prog(ct, 0, 0.3));
}

// ---------- S7: COUNTDOWN 3-2-1 (17.5 – 19.0) ------------------------
function sCount(ctx, lt, fx) {
  const k = Math.min(2, Math.floor(lt / 0.5)); const ct = lt - k * 0.5;
  const bgs = [PAL.blue, PAL.orange, PAL.purple];
  const fgs = [PAL.yellow, PAL.black, PAL.white];
  ctx.fillStyle = bgs[k]; ctx.fillRect(0, 0, W, H);
  ctx.save();
  cam(ctx, { z: 1 + 0.1 * Math.exp(-ct * 7) + lt * 0.05, r: (k - 1) * 0.04 });
  burst(ctx, CX, CY, 36, 380, 1600, 'rgba(0,0,0,0.13)', lt * 0.4, 40, 1);
  // ticking arc
  ring(ctx, CX, CY, 520, 26, hexA('#ffffff', 0.25), 1);
  ring(ctx, CX, CY, 520, 26, fgs[k], E.outCubic(prog(ct, 0, 0.45)));
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2; const L = i % 5 ? 20 : 50;
    ctx.strokeStyle = hexA('#ffffff', 0.45); ctx.lineWidth = i % 5 ? 4 : 8;
    ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * 590, CY + Math.sin(a) * 590); ctx.lineTo(CX + Math.cos(a) * (590 + L), CY + Math.sin(a) * (590 + L)); ctx.stroke();
  }
  // expanding ring hit
  const rp = prog(ct, 0, 0.4);
  ring(ctx, CX, CY, 520 + 500 * E.outCubic(rp), 30 * (1 - rp), hexA(PAL.white, 1 - rp), 1);
  const num = String(3 - k);
  const s = lerp(3.4, 1, E.outExpo(prog(ct, 0, 0.18))) * (1 + 0.06 * ct);
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(lerp(-0.5, 0, spring(ct, 2, 6)));
  drawText(ctx, num, { fam: 'Anton', size: 1000, x: 0, y: 0, fill: fgs[k], scale: s, ext: { dx: 0, dy: 34, n: 14, color: 'rgba(0,0,0,0.45)' } });
  ctx.restore();
  drawText(ctx, ['PRONTO?', 'FOCO', 'AGORA!'][k], { fam: 'Space Grotesk', weight: 700, size: 70, x: CX, y: 1660, fill: PAL.white, track: 0.3, per: (i) => ({ a: prog(ct, 0.05 + i * 0.02, 0.1 + i * 0.02) }) });
  ctx.restore();
  hit(fx, ct, 0, 28 + k * 10, 9); pulseFx(fx, 'rgb', ct, 0, 12, 12);
  fx.shake += 6 * prog(lt, 1.0, 1.5);
}

// ---------- S8: EXPLOSION (19.0 – 20.0) -------------------------------
function sBoom(ctx, lt, fx) {
  ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, W, H);
  const gl = ctx.createRadialGradient(CX, CY, 10, CX, CY, 1200);
  const gA = Math.exp(-lt * 1.4);
  gl.addColorStop(0, `rgba(255,170,60,${0.95 * gA})`); gl.addColorStop(0.35, `rgba(255,70,0,${0.6 * gA})`); gl.addColorStop(1, 'rgba(60,0,120,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  ctx.save();
  cam(ctx, { z: 1 + 0.15 * Math.exp(-lt * 3) });
  // shockwaves
  [[0, PAL.white, 40], [0.05, PAL.yellow, 30], [0.1, PAL.blue, 24], [0.16, PAL.purple, 18]].forEach(([d, c, lw]) => {
    const p = prog(lt, d, d + 0.7); if (p > 0 && p < 1) ring(ctx, CX, CY, 60 + 1500 * E.outExpo(p), lw * (1 - p), hexA(c, 1 - p), 1);
  });
  // particles
  particles(ctx, CX, CY, 650, lt, { speed: 4600, drag: 3.0, seed: 3, colors: [PAL.orange, PAL.yellow, PAL.white, PAL.blue, PAL.purple], len: 0.05, life: 1.5, width: 12 });
  particles(ctx, CX, CY, 200, lt, { speed: 1800, drag: 2, seed: 9, colors: [PAL.yellow, PAL.orange, PAL.purple], len: 0.02, life: 1.3, width: 24, dots: true });
  // implosion: sparks get sucked into the point where the logo is born
  const ip = prog(lt, 0.5, 1.0);
  if (ip > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const cols5 = [PAL.orange, PAL.yellow, PAL.blue, PAL.purple, PAL.white];
    for (let i = 0; i < 260; i++) {
      const a = hash(i * 4.7) * Math.PI * 2 + ip * 2.5, r0 = 500 + hash(i * 6.1) * 900;
      const pi = E.inCubic(clamp((ip - hash(i * 2.2) * 0.35) / 0.65));
      const r = r0 * (1 - pi), rt = r0 * (1 - Math.max(0, pi - 0.12)) + 30;
      if (pi <= 0 || pi >= 1) continue;
      ctx.strokeStyle = cols5[i % 5]; ctx.globalAlpha = 0.9; ctx.lineWidth = 4 + 8 * pi;
      ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * r, 760 + Math.sin(a) * r); ctx.lineTo(CX + Math.cos(a - 0.15) * rt, 760 + Math.sin(a - 0.15) * rt); ctx.stroke();
    }
    const cg2 = ctx.createRadialGradient(CX, 760, 0, CX, 760, 420);
    cg2.addColorStop(0, `rgba(255,140,40,${E.inCubic(ip)})`); cg2.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = cg2; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // 3D debris flying at camera
  G.cam([0, 0, 10], [0, 0, 0], 50);
  const geos = ['tetra', 'box', 'ico', 'octa'];
  const cols = [PAL.orange, PAL.blue, PAL.yellow, PAL.purple, PAL.white];
  for (let i = 0; i < 22; i++) {
    const th = hash(i * 1.7) * Math.PI * 2, ph = hash(i * 2.9) * 0.9 + 0.1;
    const dir = [Math.cos(th) * ph * 0.7, Math.sin(th) * ph, 0.25 + hash(i * 4.3) * 0.9];
    const dist = 22 * (1 - Math.exp(-lt * (2 + hash(i) * 2)));
    G.put('db' + i, geos[i % 4], { p: [dir[0] * dist, dir[1] * dist, -2 + dir[2] * dist], r: [lt * (4 + i), lt * (3 + i * 0.5), i], s: 0.35 + hash(i * 8.1) * 0.5, color: cols[i % 5], metal: i % 3 === 0 });
  }
  G.draw(ctx);
  // the "1" shattering: core blast
  const core = Math.exp(-lt * 6);
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 500 * (1 + lt * 2));
  cg.addColorStop(0, `rgba(255,255,255,${core})`); cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  hit(fx, lt, 0, 80, 4.5); hit(fx, lt, 0.5, 10, 2); fx.rgb += 16 * E.inCubic(prog(lt, 0.6, 1.0)); pulseFx(fx, 'flash', lt, 0, 1, 7); fx.flashColor = '#FFFFFF';
  pulseFx(fx, 'rgb', lt, 0, 40, 4); pulseFx(fx, 'warp', lt, 0, 40, 4); pulseFx(fx, 'glitch', lt, 0, 1.2, 5);
}

// ---------- S9: END CARD (20.0 – 24.0) --------------------------------
function sEnd(ctx, lt, fx) {
  const g = ctx.createRadialGradient(CX, 820, 50, CX, 820, 1300);
  g.addColorStop(0, '#1B1B28'); g.addColorStop(1, '#07070A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  dotGrid(ctx, 60, 'rgba(255,255,255,0.05)', 0);
  const breathe = 1 + 0.012 * Math.sin(lt * 3);
  // entry rings
  [[0.0, PAL.orange], [0.08, PAL.yellow], [0.16, PAL.blue], [0.24, PAL.purple]].forEach(([d, c]) => {
    const p = prog(lt, d, d + 1.0); if (p > 0 && p < 1) ring(ctx, CX, 760, 180 + 700 * E.outExpo(p), 14 * (1 - p), hexA(c, 1 - p), 1);
  });
  // logo mark
  const s = spring(lt - 0.05, 1.6, 5.5);
  ctx.save(); ctx.translate(CX, 760); ctx.rotate(lerp(Math.PI / 4, 0, Math.min(1.2, spring(lt - 0.05, 1.2, 5)))); ctx.scale(s * breathe, s * breathe);
  ctx.fillStyle = '#7A2400'; roundRect(ctx, -150, -138, 300, 300, 72); ctx.fill();
  ctx.fillStyle = PAL.orange; roundRect(ctx, -150, -150, 300, 300, 72); ctx.fill();
  const tp = E.outBack(prog(lt, 0.3, 0.55), 3);
  ctx.save(); ctx.scale(tp, tp); ctx.fillStyle = PAL.white;
  ctx.beginPath(); ctx.moveTo(-42, -70); ctx.lineTo(78, 0); ctx.lineTo(-42, 70); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 26; ctx.strokeStyle = PAL.white; ctx.fill(); ctx.stroke();
  ctx.restore();
  // pulse bars (logo "pulse" motif)
  ctx.restore();
  // channel name
  drawText(ctx, CONFIG.channelName, {
    fam: 'Archivo Black', size: 190, x: CX, y: 1085, track: 0.04, fill: PAL.white,
    per: (i) => { const p = spring(lt - 0.38 - i * 0.05, 2.2, 6); return { dy: 120 * (1 - p), sy: Math.max(0.01, p), a: lt > 0.38 + i * 0.05 ? 1 : 0 }; },
  });
  // 4-colour bar
  const cols = [PAL.orange, PAL.blue, PAL.yellow, PAL.purple];
  cols.forEach((c, i) => { const p = E.outExpo(prog(lt, 0.7 + i * 0.05, 1.0 + i * 0.05)); ctx.fillStyle = c; ctx.fillRect(CX - 200 + i * 100 + 4, 1185, 92 * p, 12); });
  drawText(ctx, CONFIG.tagline, { fam: 'Space Grotesk', weight: 500, size: 40, x: CX, y: 1268, track: 0.28, fill: hexA('#B8B8CC', E.outCubic(prog(lt, 0.85, 1.2))) });
  // subscribe button + click
  const bp = E.outBack(prog(lt, 1.15, 1.45), 2.2);
  const click = prog(lt, 2.15, 2.2) * (1 - prog(lt, 2.2, 2.35));
  const done = lt > 2.25;
  if (bp > 0) {
    ctx.save(); ctx.translate(CX, 1470); const sc = bp * (1 - 0.08 * click); ctx.scale(sc, sc);
    ctx.fillStyle = done ? '#262633' : PAL.orange; roundRect(ctx, -290, -72, 580, 144, 72); ctx.fill();
    if (done) { ctx.strokeStyle = '#3A3A4A'; ctx.lineWidth = 4; roundRect(ctx, -290, -72, 580, 144, 72); ctx.stroke(); }
    drawText(ctx, done ? CONFIG.subscribed : CONFIG.subscribe, { fam: 'Archivo Black', size: 54, x: 0, y: 0, track: 0.06, fill: done ? PAL.white : PAL.black });
    ctx.restore();
    // ripple
    const rp = prog(lt, 2.2, 2.8);
    if (rp > 0 && rp < 1) ring(ctx, CX + 120, 1490, 30 + 420 * E.outCubic(rp), 10 * (1 - rp), hexA(PAL.orange, 1 - rp), 1);
    drawText(ctx, CONFIG.handle, { fam: 'Space Grotesk', weight: 700, size: 44, x: CX, y: 1625, track: 0.1, fill: hexA('#FFFFFF', 0.55 * prog(lt, 1.3, 1.6)) });
  }
  // bell wiggle after subscribe
  if (lt > 2.4) {
    const bs = E.outBack(prog(lt, 2.4, 2.6), 3);
    ctx.save(); ctx.translate(CX + 360, 1470); ctx.rotate(0.5 * wobble(lt - 2.5, 4, 3)); ctx.scale(bs, bs);
    ctx.fillStyle = PAL.yellow;
    ctx.beginPath(); ctx.moveTo(-34, 24); ctx.quadraticCurveTo(-34, -40, 0, -44); ctx.quadraticCurveTo(34, -40, 34, 24); ctx.lineTo(44, 34); ctx.lineTo(-44, 34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 44, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // cursor
  if (lt > 1.55 && lt < 3.0) {
    const mp = E.inOutCubic(prog(lt, 1.55, 2.1));
    const x = lerp(1000, CX + 120, mp), y = lerp(1900, 1495, mp);
    const a = 1 - prog(lt, 2.7, 3.0);
    const cs = 1 - 0.15 * click;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(cs * 1.6, cs * 1.6);
    ctx.fillStyle = PAL.white; ctx.strokeStyle = PAL.black; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.lineTo(11, 35); ctx.lineTo(20, 55); ctx.lineTo(28, 51); ctx.lineTo(19, 32); ctx.lineTo(34, 32); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  hit(fx, lt, 0.05, 10, 10); hit(fx, lt, 2.2, 8, 12);
}

// =====================================================================
//  TIMELINE
// =====================================================================
export const SCENES = [
  { name: 'hook', t0: 0.0, t1: 2.0, draw: sHook },
  { name: 'motion', t0: 2.0, t1: 4.5, draw: sMotion, trans: { type: 'iris', dur: 0.3 } },
  { name: 'energia', t0: 4.5, t1: 7.0, draw: sEnergia, trans: { type: 'whip', dur: 0.28 } },
  { name: 'morph', t0: 7.0, t1: 9.5, draw: sMorph, trans: { type: 'slices', dur: 0.32 } },
  { name: 'criatividade', t0: 9.5, t1: 12.0, draw: sCriatividade, trans: { type: 'flash', dur: 0.12 } },
  { name: 'tunnel', t0: 12.0, t1: 15.0, draw: sTunnel, trans: { type: 'diag', dur: 0.3 } },
  { name: 'cuts', t0: 15.0, t1: 17.5, draw: sCuts, trans: { type: 'flash', dur: 0.1 } },
  { name: 'count', t0: 17.5, t1: 19.0, draw: sCount, trans: { type: 'slices', dur: 0.22 } },
  { name: 'boom', t0: 19.0, t1: 20.0, draw: sBoom },
  { name: 'end', t0: 20.0, t1: 24.0, draw: sEnd, trans: { type: 'fadeFlash', dur: 0.35 } },
];

function drawScene(sc, canvas, t, fx) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  sc.draw(ctx, t - sc.t0, fx);
}

function composeTransition(type, p, ctx) {
  const e = E.inOutCubic(p);
  ctx.drawImage(bufA, 0, 0);
  ctx.save();
  if (type === 'iris') {
    const r = 1250 * E.outCubic(p);
    ctx.beginPath(); ctx.arc(CX, 1255, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(bufB, 0, 0); ctx.restore();
    ring(ctx, CX, 1255, r, 40 * (1 - p), PAL.yellow, 1); return;
  }
  if (type === 'whip') {
    ctx.restore(); ctx.save();
    const y = -H * E.inOutExpo(p);
    for (let k = 3; k >= 0; k--) { ctx.globalAlpha = k ? 0.25 : 1; ctx.drawImage(bufA, 0, y - k * 60 * Math.sin(Math.PI * p)); }
    for (let k = 3; k >= 0; k--) { ctx.globalAlpha = k ? 0.25 : 1; ctx.drawImage(bufB, 0, y + H + k * 60 * Math.sin(Math.PI * p)); }
    ctx.restore(); return;
  }
  if (type === 'slices') {
    const N = 10, h = H / N;
    for (let i = 0; i < N; i++) {
      const pi = E.outExpo(clamp((p - i * 0.04) / 0.6));
      const dir = i % 2 ? 1 : -1;
      const x = dir * W * (1 - pi);
      ctx.drawImage(bufB, 0, i * h, W, h, x, i * h, W, h);
    }
    ctx.restore(); return;
  }
  if (type === 'diag') {
    const x = lerp(-900, W + 900, e);
    ctx.beginPath(); ctx.moveTo(-200, 0); ctx.lineTo(x + 400, 0); ctx.lineTo(x - 400, H); ctx.lineTo(-200, H); ctx.closePath(); ctx.clip();
    ctx.drawImage(bufB, 0, 0); ctx.restore();
    ctx.save(); ctx.strokeStyle = PAL.orange; ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(x + 400, 0); ctx.lineTo(x - 400, H); ctx.stroke(); ctx.restore();
    return;
  }
  if (type === 'flash' || type === 'fadeFlash') {
    ctx.globalAlpha = type === 'flash' ? 1 : e; ctx.drawImage(bufB, 0, 0); ctx.restore();
    ctx.save(); ctx.globalAlpha = (1 - p) * (type === 'flash' ? 0.85 : 1); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); return;
  }
  ctx.drawImage(bufB, 0, 0); ctx.restore();
}

// =====================================================================
//  POST: shake, warp, RGB split, glitch, flash, grain, vignette
// =====================================================================
function tint(dst, src, color) {
  const c = dst.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
}

function post(t, fx, frame) {
  const tc = tmp.getContext('2d');
  // 1) camera shake + warp into tmp
  const sh = Math.min(fx.shake, 120);
  const sx = sh * (Math.sin(t * 91.7) * 0.6 + Math.sin(t * 53.3 + 1.3) * 0.4);
  const sy = sh * (Math.sin(t * 77.1 + 2.1) * 0.6 + Math.sin(t * 41.9) * 0.4);
  const sr = sh * 0.0009 * Math.sin(t * 63.1);
  tc.setTransform(1, 0, 0, 1, 0, 0); tc.fillStyle = '#000'; tc.fillRect(0, 0, W, H);
  tc.save(); tc.translate(CX + sx, CY + sy); tc.rotate(sr); const z = 1 + sh * 0.0012; tc.scale(z, z); tc.translate(-CX, -CY);
  if (fx.warp > 0.5) {
    const strip = 12;
    for (let y = 0; y < H; y += strip) {
      const off = fx.warp * Math.sin(y * 0.011 + t * 22) + fx.warp * 0.5 * Math.sin(y * 0.031 - t * 13);
      tc.drawImage(buf, 0, y, W, strip, off, y, W, strip);
    }
  } else tc.drawImage(buf, 0, 0);
  tc.restore();

  // 2) RGB split into out
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1;
  if (fx.rgb > 1) {
    const d = Math.min(fx.rgb, 60);
    tint(chR, tmp, '#ff0000'); tint(chG, tmp, '#00ff00'); tint(chB, tmp, '#0000ff');
    octx.globalCompositeOperation = 'source-over'; octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H);
    octx.globalCompositeOperation = 'lighter';
    octx.drawImage(chR, -d, -d * 0.25); octx.drawImage(chG, 0, 0); octx.drawImage(chB, d, d * 0.25);
    octx.globalCompositeOperation = 'source-over';
  } else octx.drawImage(tmp, 0, 0);

  // 3) block glitch
  if (fx.glitch > 0.08) {
    tc.drawImage(out, 0, 0);
    const n = Math.floor(4 + fx.glitch * 10);
    for (let i = 0; i < n; i++) {
      const r1 = hash(frame * 7.13 + i * 3.7), r2 = hash(frame * 1.31 + i * 9.1), r3 = hash(frame * 5.7 + i);
      if (r3 > fx.glitch + 0.2) continue;
      const y = r1 * H, h = 10 + r2 * 120, dx = (r3 - 0.5) * 260 * fx.glitch;
      octx.drawImage(tmp, 0, y, W, h, dx, y, W, h);
      if (r2 > 0.7) { octx.fillStyle = [PAL.yellow, PAL.blue, PAL.orange, PAL.purple][i % 4]; octx.globalAlpha = 0.6; octx.fillRect(r1 * W, y, 40 + r3 * 300, h * 0.3); octx.globalAlpha = 1; }
    }
  }
  // 4) flash
  if (fx.flash > 0.01) { octx.globalAlpha = Math.min(1, fx.flash); octx.fillStyle = fx.flashColor; octx.fillRect(0, 0, W, H); octx.globalAlpha = 1; }
  // 5) vignette + grain
  const vg = octx.createRadialGradient(CX, CY, 600, CX, CY, 1250);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
  octx.globalCompositeOperation = 'overlay'; octx.globalAlpha = 0.07;
  octx.drawImage(grain[frame % grain.length], 0, 0, W, H);
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
}

// =====================================================================
//  FRAME ENTRY
// =====================================================================
export function renderFrame(frame) {
  const t = frame / FPS;
  const fx = newFx();
  const idx = SCENES.findIndex((s) => t >= s.t0 && t < s.t1);
  const cur = SCENES[idx < 0 ? SCENES.length - 1 : idx];
  const prev = SCENES[idx - 1];
  const inTrans = cur.trans && prev && t < cur.t0 + cur.trans.dur;
  if (inTrans) {
    drawScene(prev, bufA, t, newFx());
    drawScene(cur, bufB, t, fx);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    composeTransition(cur.trans.type, (t - cur.t0) / cur.trans.dur, bctx);
  } else {
    drawScene(cur, buf, t, fx);
  }
  post(t, fx, frame);
}

window.__ready = (async () => {
  await Promise.all([
    document.fonts.load('100px "Anton"'), document.fonts.load('100px "Archivo Black"'),
    document.fonts.load('500 100px "Space Grotesk"'), document.fonts.load('700 100px "Space Grotesk"'),
  ]);
  await G.init(W, H);
  window.FRAMES = FRAMES; window.FPS = FPS;
  window.renderFrame = (f, q = 0.94) => { renderFrame(f); return out.toDataURL('image/jpeg', q); };
  window.renderFramePNG = (f) => { renderFrame(f); return out.toDataURL('image/png'); };
  return true;
})();

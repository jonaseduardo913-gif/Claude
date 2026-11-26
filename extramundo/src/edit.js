// =====================================================================
//  AUREN editor — "Estilo Leonida"
//  Plates (stills / trailer frames) + camera moves, word-by-word captions
//  with colour code, location chips, arrows, rings, transitions, end card.
//  Every frame is a pure function of build/timeline.json and the frame index.
// =====================================================================
const W = 1080, H = 1920;
// EXTRAMUNDO palette (caption colour keys kept: cyan=places, gold=time/numbers, pink=fire/danger)
const C = { white: '#FFFFFF', cyan: '#22D3C5', gold: '#FFC23D', pink: '#FF5A1F', orange: '#FF5A1F', red: '#E8202A', ink: '#07060B' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const E = {
  linear: (x) => x,
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  outBack: (x, s = 1.7) => (x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inCubic: (x) => x * x * x,
};
const spring = (t, f = 2.2, d = 6) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * 2 * Math.PI * t));

let TL, FPS;
const out = document.getElementById('out'); const octx = out.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const buf = mk(), prevBuf = mk(), tmp = mk();

// ---------------- plate cache ----------------
const cache = new Map();
async function loadImg(url) {
  if (cache.has(url)) return cache.get(url);
  const p = (async () => { const im = new Image(); im.src = url; await im.decode(); return im; })();
  cache.set(url, p);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return p;
}
function plateURL(shot, t) {
  const s = shot.src;
  if (s.type === 'still') return s.path;
  const i = clamp(Math.floor((t - shot.t0) * FPS * s.speed), 0, s.count - 1);
  return `${s.dir}/${String(i).padStart(4, '0')}.jpg`;
}

// ---------------- camera ----------------
function camRect(shot, t) {
  const s = shot.src, cam = shot.cam;
  const srcW = s.type === 'clip' ? s.srcW : s.w, srcH = s.h;
  const dur = cam.dur || (shot.t1 - shot.t0);
  const p = (E[cam.ease] || E.inOutSine)(prog(t, shot.t0, shot.t0 + dur));
  const cx = lerp(cam.from.cx, cam.to.cx, p), cy = lerp(cam.from.cy, cam.to.cy, p);
  const z = Math.exp(lerp(Math.log(cam.from.z), Math.log(cam.to.z), p));
  const vh = Math.min(srcH, srcW * 16 / 9) / z, vw = vh * 9 / 16;
  let x0 = clamp(cx * srcW - vw / 2, 0, srcW - vw), y0 = clamp(cy * srcH - vh / 2, 0, srcH - vh);
  if (s.type === 'clip') x0 = clamp(x0, s.bx0, s.bx0 + s.w - vw);
  return { x0, y0, vw, vh, srcW, srcH, bx: s.type === 'clip' ? s.bx0 : 0 };
}
const toScreen = (r, nx, ny) => ({ x: (nx * r.srcW - r.x0) / r.vw * W, y: (ny * r.srcH - r.y0) / r.vh * H, k: H / r.vh });

async function drawPlate(ctx, shot, t, opt = {}) {
  if (shot.src.type === 'anim' && shot.src.name === 'map') { await drawGeoMap(ctx, shot, t); return null; }
  if ((shot.src.type === 'still' || shot.src.type === 'clip') && shot.fit === 'blurfill') { await drawBlurFill(ctx, shot, t); return null; }
  if (shot.src.type === 'anim' && shot.src.name === 'cavitation') { drawCavitation(ctx, t - shot.t0, shot.t1 - shot.t0, shot.src.marks || {}); return null; }
  if (shot.src.type === 'anim' && shot.src.name === 'calcify') { drawCalcify(ctx, t - shot.t0, shot.t1 - shot.t0); return null; }
  if (shot.src.type === 'anim') { const cs = (shot.collapseAt || shot.t0) - shot.t0; drawCollapse(ctx, t - shot.t0, shot.t1 - shot.t0, cs); if (shot.filter === 'oldfilm' && t - shot.t0 < cs) oldFilm(ctx, t); return null; }
  if (shot.src.type === 'compare') { await drawCompare(ctx, shot, t); return null; }
  const r = await drawPlateImg(ctx, shot, t, opt);
  if (shot.filter === 'oldfilm') oldFilm(ctx, t);
  return r;
}
async function drawPlateImg(ctx, shot, t, { zoom = 1, blur = 0 } = {}) {
  const img = await loadImg(plateURL(shot, t));
  const r = camRect(shot, t);
  const vw = r.vw / zoom, vh = r.vh / zoom, x0 = r.x0 + (r.vw - vw) / 2, y0 = r.y0 + (r.vh - vh) / 2;
  ctx.save();
  ctx.filter = `saturate(1.14) contrast(1.06)${blur ? ` blur(${blur}px)` : ''}`;
  ctx.drawImage(img, x0 - r.bx, y0, vw, vh, 0, 0, W, H);
  ctx.restore();
  return r;
}

// ---------------- typography ----------------
const font = (size, weight = 900, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px "Montserrat"`;
function outlinedText(ctx, text, x, y, { size, color = C.white, stroke = 12, italic = false, weight = 900, align = 'center', shadow = true, track = 0 }) {
  ctx.save();
  ctx.font = font(size, weight, italic); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (track) ctx.letterSpacing = `${track}px`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8; }
  if (stroke > 0) { ctx.strokeStyle = '#000'; ctx.lineWidth = stroke * 2; ctx.strokeText(text, x, y); }
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

// caption card: words share a line, each with its own colour
function drawCard(ctx, card, t) {
  if (t < card.t0 || t >= card.t1) return;
  let size = 104;
  ctx.font = font(size);
  const sp = size * 0.28;
  const widths = () => card.words.map((w) => ctx.measureText(w.text).width);
  let ws = widths(), total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  const maxW = 880;
  if (total > maxW) { size = Math.floor(size * maxW / total); ctx.font = font(size); ws = widths(); total = ws.reduce((a, b) => a + b, 0) + size * 0.28 * (ws.length - 1); }
  const pop = card.pop ? 1 + 0.06 * (1 - prog(t, card.t0, card.t0 + 3 / FPS)) : 1;
  const cx = W / 2, cy = H * 0.70;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop);
  let x = -total / 2;
  card.words.forEach((w, i) => {
    outlinedText(ctx, w.text, x + ws[i] / 2, 0, { size, color: C[w.color] || C.white, stroke: Math.round(size * 0.115) });
    x += ws[i] + size * 0.28;
  });
  ctx.restore();
}

// ---------------- brand: AUREN sun emblem ----------------
function drawSun(ctx, x, y, r, { stripes = 1 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, C.gold); g.addColorStop(0.5, C.orange); g.addColorStop(1, C.pink);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  // synthwave cut lines in the lower half
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 4; k++) {
    const yy = y + r * (0.18 + k * 0.22), hh = r * (0.05 + k * 0.035) * stripes;
    ctx.fillRect(x - r, yy, 2 * r, hh);
  }
  ctx.restore();
}
function drawStamp(ctx, t) {
  const st = TL.stamp; if (!st) return; const lt = t - st.t; const dur = 0.8;
  if (lt < 0 || lt > dur) return;
  const s = lt < 2 / FPS ? lerp(2.4, 1, lt * FPS / 2) : 1 - E.inExpo(prog(lt, dur - 0.12, dur));
  const sh = lt < 0.2 ? (hash(Math.floor(t * FPS)) - 0.5) * 18 * (1 - lt / 0.2) : 0;
  ctx.save(); ctx.translate(W / 2 + sh, H * 0.3); ctx.rotate(-0.07); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(11,10,16,0.88)'; roundRect(ctx, -250, -78, 500, 156, 30); ctx.fill();
  ctx.strokeStyle = C.orange; ctx.lineWidth = 6; roundRect(ctx, -250, -78, 500, 156, 30); ctx.stroke();
  drawSun(ctx, -150, 0, 52);
  ctx.font = font(84); ctx.letterSpacing = '6px'; ctx.fillStyle = C.white; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('AUREN', -80, 4);
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------- overlays ----------------
function drawArrow(ctx, o, r, t, shot) {
  const lt = t - o.t; if (lt < 0) return;
  const p = toScreen(r, o.x, o.y);
  const dirs = { 'up-right': [1, -1], 'up-left': [-1, -1], 'down-right': [1, 1], 'down-left': [-1, 1] };
  const [dx, dy] = dirs[o.from] || [1, -1];
  const bob = 7 * Math.sin(t * Math.PI * 4);
  const tip = { x: p.x - dx * 46, y: p.y - dy * 46 + bob };
  const st = { x: tip.x + dx * 230, y: tip.y + dy * 300 };
  const ctl = { x: tip.x + dx * 250, y: tip.y + dy * 40 };
  const d = E.outCubic(prog(lt, 0, 5 / FPS));
  const q = (u) => ({ x: (1 - u) ** 2 * st.x + 2 * (1 - u) * u * ctl.x + u * u * tip.x, y: (1 - u) ** 2 * st.y + 2 * (1 - u) * u * ctl.y + u * u * tip.y });
  const path = () => { ctx.beginPath(); for (let i = 0; i <= 30; i++) { const pt = q(d * i / 30); i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y); } };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = '#000'; ctx.lineWidth = 34; ctx.stroke();
  path(); ctx.strokeStyle = C.orange; ctx.lineWidth = 18; ctx.stroke();
  if (d > 0.6) {
    const a = q(d), b = q(d - 0.04); const ang = Math.atan2(a.y - b.y, a.x - b.x); const hs = 46;
    const head = () => { ctx.beginPath(); ctx.moveTo(a.x + Math.cos(ang) * hs * 0.55, a.y + Math.sin(ang) * hs * 0.55); ctx.lineTo(a.x + Math.cos(ang + 2.4) * hs, a.y + Math.sin(ang + 2.4) * hs); ctx.lineTo(a.x + Math.cos(ang - 2.4) * hs, a.y + Math.sin(ang - 2.4) * hs); ctx.closePath(); };
    head(); ctx.strokeStyle = '#000'; ctx.lineWidth = 16; ctx.stroke(); ctx.fillStyle = C.orange; ctx.fill();
  }
  ctx.restore();
}
function drawRing(ctx, o, r, t) {
  const lt = t - o.t; if (lt < 0) return;
  const p = toScreen(r, o.x, o.y); const rad = o.r * r.srcH * p.k;
  const d = E.outCubic(prog(lt, 0, 7 / FPS));
  const ring = () => { ctx.beginPath(); for (let i = 0; i <= 80 * d; i++) { const a = -2.2 + i / 80 * Math.PI * 2.15; const k = 1 + 0.05 * Math.sin(i * 0.3); const x = p.x + Math.cos(a) * rad * k * 1.1, y = p.y + Math.sin(a) * rad * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
  ctx.save(); ctx.lineCap = 'round';
  ring(); ctx.strokeStyle = '#000'; ctx.lineWidth = 26; ctx.stroke();
  ring(); ctx.strokeStyle = C.orange; ctx.lineWidth = 13; ctx.stroke();
  ctx.restore();
}
function drawLoc(ctx, o, t, shot) {
  const lt = t - o.t; if (lt < 0) return;
  const sx = lerp(-520, 0, E.outExpo(prog(lt, 0, 7 / FPS)));
  ctx.save(); ctx.font = font(40, 800); ctx.letterSpacing = '3px';
  const w = ctx.measureText(o.text).width + 112;
  ctx.translate((W - w) / 2 + sx, H * 0.205);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#FFC21A'; roundRect(ctx, 0, -36, w, 72, 36); ctx.fill(); ctx.shadowColor = 'transparent';
  // pin
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(44, -6, 15, Math.PI, 0); ctx.lineTo(44, 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFC21A'; ctx.beginPath(); ctx.arc(44, -6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.fillText(o.text, 76, 2);
  ctx.restore();
}
function drawMapLabel(ctx, o, r, t) {
  const lt = t - o.t; if (lt < 0) return;
  const p = toScreen(r, o.x, o.y); const s = E.outBack(prog(lt, 0, 6 / FPS), 2.2);
  ctx.save(); ctx.translate(p.x, p.y - 40); ctx.scale(s, s);
  outlinedText(ctx, o.text, 0, 0, { size: 64, color: C.cyan, stroke: 9 });
  ctx.restore();
}
function drawBigTag(ctx, o, t) {
  const lt = t - o.t; if (lt < 0) return;
  const s = lt < 3 / FPS ? lerp(1.5, 1, E.outCubic(lt * FPS / 3)) : 1;
  ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.scale(s, s);
  outlinedText(ctx, o.text, 0, 0, { size: 168, color: C.cyan, stroke: 16, track: 10 });
  ctx.restore();
}
function drawPause(ctx, o, t) {
  const lt = t - o.t; if (lt < 0) return;
  const s = E.outBack(prog(lt, 0, 6 / FPS), 2.4);
  ctx.save(); ctx.translate(W / 2, H * 0.33); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(11,10,16,0.78)'; roundRect(ctx, -190, -70, 380, 140, 36); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; roundRect(ctx, -190, -70, 380, 140, 36); ctx.stroke();
  ctx.fillStyle = C.white; ctx.fillRect(-140, -32, 20, 64); ctx.fillRect(-106, -32, 20, 64);
  ctx.font = font(52, 800); ctx.letterSpacing = '4px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('PAUSED', -60, 4);
  ctx.restore();
}
function drawBigText(ctx, o, t) {
  const lt = t - o.t; if (lt < 0 || (o.t1 && t >= o.t1)) return;
  const size = o.size || 150, y = H * (o.y ?? 0.27);
  let s = 1, rot = 0;
  if (o.style === 'slam') { s = lt < 3 / FPS ? lerp(2.6, 1, E.outCubic(lt * FPS / 3)) : 1 + 0.03 * Math.sin(lt * 6); rot = -0.04; }
  else s = lerp(1.25, 1, E.outCubic(prog(lt, 0, 4 / FPS)));
  const lines = o.text.split('|');
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.font = font(size); const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width)); const k = Math.min(1, 940 / maxW);
  ctx.scale(k, k);
  if (o.style === 'slam') { ctx.shadowColor = 'rgba(255,90,31,0.9)'; ctx.shadowBlur = 60; }
  lines.forEach((l, i) => outlinedText(ctx, l, 0, (i - (lines.length - 1) / 2) * size * 1.02, { size, color: C[o.color] || C.white, stroke: Math.round(size * 0.09) }));
  ctx.restore();
}
function drawPin(ctx, o, r, t) {
  const lt = t - o.t; if (lt < 0) return;
  const p = toScreen(r, o.x, o.y);
  for (let k = 0; k < 3; k++) { const ph = ((lt * 1.2 + k / 3) % 1); ctx.beginPath(); ctx.arc(p.x, p.y, 20 + ph * 150, 0, Math.PI * 2); ctx.strokeStyle = `rgba(232,32,42,${(1 - ph) * 0.9})`; ctx.lineWidth = 8 * (1 - ph) + 2; ctx.stroke(); }
  const s = E.outBack(prog(lt, 0, 6 / FPS), 2.5);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
  ctx.fillStyle = C.red; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, -70, 34, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -72, 12, 0, Math.PI * 2); ctx.fill();
  if (o.label) { const ls = prog(lt, 0.25, 0.45); ctx.globalAlpha = ls; outlinedText(ctx, o.label, 0, -150, { size: 56, color: C.white, stroke: 8 }); }
  ctx.restore();
}
function drawSpeedo(ctx, o, t) {
  const lt = t - o.t; if (lt < 0) return;
  const cx = W / 2, cy = H * 0.3, R0 = 230;
  const fill = E.outCubic(prog(lt, 0.1, 0.9)), val = Math.round((o.value || 80) * fill);
  ctx.save();
  // motion streaks behind
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { const y = H * (0.12 + hash(i) * 0.5), len = 200 + hash(i * 3) * 500, x = ((hash(i * 7) * W * 2 - lt * 2600 * (0.6 + hash(i))) % (W + len) + W + len) % (W + len) - len;
    ctx.strokeStyle = `rgba(255,220,140,${0.12 + 0.2 * hash(i * 5)})`; ctx.lineWidth = 3 + hash(i * 9) * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  const s = E.outBack(prog(lt, 0, 6 / FPS), 2); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(5,8,14,0.72)'; ctx.beginPath(); ctx.arc(0, 0, R0 + 40, 0, Math.PI * 2); ctx.fill();
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  ctx.lineCap = 'round'; ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(0, 0, R0, a0, a1); ctx.stroke();
  const g = ctx.createLinearGradient(-R0, 0, R0, 0); g.addColorStop(0, '#FFE28A'); g.addColorStop(0.6, '#FFC21A'); g.addColorStop(1, '#FF5A1F');
  ctx.strokeStyle = g; ctx.shadowColor = 'rgba(255,170,40,0.8)'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(0, 0, R0, a0, a0 + (a1 - a0) * fill * 0.86); ctx.stroke(); ctx.shadowBlur = 0;
  for (let k = 0; k <= 10; k++) { const a = a0 + (a1 - a0) * k / 10 * 0.86 / 0.86 * 0.86; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = k % 5 ? 3 : 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R0 - 50), Math.sin(a) * (R0 - 50)); ctx.lineTo(Math.cos(a) * (R0 - 30), Math.sin(a) * (R0 - 30)); ctx.stroke(); }
  const na = a0 + (a1 - a0) * fill * 0.86; ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(na) * (R0 - 70), Math.sin(na) * (R0 - 70)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  outlinedText(ctx, '~' + val, 0, 95, { size: 130, color: '#FFC21A', stroke: 10 });
  outlinedText(ctx, 'KM/H', 0, 185, { size: 54, color: '#fff', stroke: 7 });
  ctx.restore();
}
function drawOverlays(ctx, shot, r, t) {
  for (const o of shot.overlays) {
    if (o.type === 'speedo') drawSpeedo(ctx, o, t);
    if (o.type === 'bigtext') drawBigText(ctx, o, t);
    if (o.type === 'pin' && r) drawPin(ctx, o, r, t);
    if (!r && ['arrow', 'ring', 'maplabel'].includes(o.type)) continue;
    if (o.type === 'arrow') drawArrow(ctx, o, r, t, shot);
    if (o.type === 'ring') drawRing(ctx, o, r, t);
    if (o.type === 'loc') drawLoc(ctx, o, t, shot);
    if (o.type === 'maplabel') drawMapLabel(ctx, o, r, t);
    if (o.type === 'bigtag') drawBigTag(ctx, o, t);
    if (o.type === 'pause') drawPause(ctx, o, t);
  }
}

// ---------------- headline (hook) ----------------
function drawHeadline(ctx, t) {
  const h = TL.headline; if (t >= h.t1) return;
  const out = E.inExpo(prog(t, h.t1 - 5 / FPS, h.t1));
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.34);
  g.addColorStop(0, `rgba(0,0,0,${0.55 * (1 - out)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.34);
  h.lines.forEach((line, i) => {
    const lt = t - i * 0.12; if (lt < 0) return;
    let size = 112; ctx.font = font(size, 900, true); const w = ctx.measureText(line).width; if (w > 950) size = Math.floor(size * 950 / w);
    const s = lerp(1.18, 1, E.outCubic(prog(lt, 0, 3 / FPS)));
    ctx.save(); ctx.translate(W / 2, H * 0.105 + i * size * 1.08 - out * 260); ctx.scale(s, s);
    outlinedText(ctx, line, 0, 0, { size, color: i ? C.pink : C.white, stroke: 12, italic: true });
    ctx.restore();
  });
}

// ---------------- transitions ----------------
function zoomStreak(ctx, src, amt) {
  ctx.drawImage(src, 0, 0);
  for (let k = 1; k <= 5; k++) { const z = 1 + amt * k * 0.035; ctx.globalAlpha = 0.22; ctx.drawImage(src, W / 2 - W * z / 2, H / 2 - H * z / 2, W * z, H * z); }
  ctx.globalAlpha = 1;
}
function glitch(ctx, src, f, amt) {
  const t = tmp.getContext('2d'); t.drawImage(src, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#000'; ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const d = 26 * amt;
  [['#FF0000', -d], ['#00FF00', 0], ['#0000FF', d]].forEach(([c, dx]) => {
    t.globalCompositeOperation = 'source-over'; t.drawImage(src, 0, 0); t.globalCompositeOperation = 'multiply'; t.fillStyle = c; t.fillRect(0, 0, W, H);
    ctx.drawImage(tmp, dx, 0);
  });
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const y = hash(f * 7.1 + i) * H, h = 20 + hash(f * 3.3 + i) * 150, dx = (hash(f * 1.7 + i * 5) - 0.5) * 220 * amt;
    ctx.drawImage(src, 0, y, W, h, dx, y, W, h);
    if (hash(f + i * 9) > 0.7) { ctx.fillStyle = [C.cyan, C.pink, C.gold][i % 3]; ctx.globalAlpha = 0.5; ctx.fillRect(hash(i + f) * W, y, 60 + hash(i * 2 + f) * 300, h * 0.25); ctx.globalAlpha = 1; }
  }
}

// ---------------- fire FX ----------------
function embers(ctx, t, amount = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const n = Math.round(70 * amount);
  for (let i = 0; i < n; i++) {
    const sp = 120 + hash(i * 3.1) * 260, life = H / sp;
    const ph = ((t + hash(i) * life) % life) / life;
    const x = hash(i * 7.7) * W + Math.sin(t * (1 + hash(i)) + i) * 40, y = H * (1.05 - ph * 1.1);
    const r = 2 + hash(i * 5.3) * 5;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * (0.5 + 0.5 * hash(i * 9.1));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, '#FFE3A0'); g.addColorStop(0.3, '#FF8A2A'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  ctx.restore();
}
function heatHaze(ctx, src, t, amp = 6) {
  const strip = 16;
  for (let y = 0; y < H; y += strip) { const off = amp * Math.sin(y * 0.03 + t * 9) * (0.5 + 0.5 * Math.sin(y * 0.007 - t * 2)); ctx.drawImage(src, 0, y, W, strip, off, y, W, strip); }
}
function oldFilm(ctx, t) {
  const f = Math.floor(t * FPS);
  ctx.save();
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#C9A26B'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${0.08 + 0.08 * hash(f)})`; ctx.fillRect(0, 0, W, H);           // flicker
  ctx.strokeStyle = 'rgba(255,245,220,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) if (hash(f * 3 + i) > 0.55) { const x = hash(f * 7 + i) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 6, H); ctx.stroke(); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(20,14,8,${0.4 * hash(f + i * 13)})`; ctx.beginPath(); ctx.arc(hash(f * 11 + i) * W, hash(f * 5 + i * 3) * H, 1 + hash(i + f) * 3, 0, Math.PI * 2); ctx.fill(); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,18,6,0.7)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// cross-section: ground cracks, collapses into a crater, gas escapes
function drawCollapse(ctx, lt, dur, cStart = 0) {
  const p = clamp((lt - cStart) / (dur - cStart));
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E0A14'); g.addColorStop(0.45, '#2A1A18'); g.addColorStop(1, '#120B08');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const gy = H * 0.5;                       // ground surface
  const sink = E.inOutCubic(prog(p, 0.18, 0.55));
  const crater = (x) => { const d = (x - W / 2) / 330; return d * d < 1 ? (1 - d * d) * 420 * sink : 0; };
  const layers = [['#D8B17A', 0], ['#B88A55', 60], ['#8E6238', 150], ['#6A4528', 260], ['#4A2E1C', 380]];
  layers.forEach(([c, dy], i) => {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) { const sh = i === 0 ? 0 : (hash(i * 31 + x) - 0.5) * 6; ctx.lineTo(x, gy + dy + crater(x) * (1 - i * 0.12) + sh); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  });
  // cracks before the collapse
  const cr = prog(p, 0.02, 0.2);
  if (cr > 0 && sink < 0.95) {
    ctx.strokeStyle = '#1A0E08'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    for (let k = 0; k < 6; k++) { ctx.beginPath(); let x = W / 2 + (k - 2.5) * 95, y = gy + crater(x); ctx.moveTo(x, y);
      for (let j = 1; j < 7 * cr; j++) { x += (hash(k * 13 + j) - 0.5) * 50; y += 40; ctx.lineTo(x, y + crater(x)); } ctx.stroke(); }
  }
  // drilling: string goes down while the rig vibrates
  const rx = W / 2 + 40, fall = E.inCubic(prog(p, 0.3, 0.6));
  if (cStart > 0 && p < 0.35) {
    const dp = clamp(lt / cStart); const depth = 80 + dp * 520;
    ctx.save(); ctx.globalAlpha = 1 - prog(p, 0.25, 0.35);
    ctx.strokeStyle = '#9A9AA2'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(rx, gy - 20); ctx.lineTo(rx, gy + depth); ctx.stroke();
    ctx.fillStyle = '#C9C9D0'; ctx.beginPath(); ctx.moveTo(rx - 16, gy + depth); ctx.lineTo(rx + 16, gy + depth); ctx.lineTo(rx, gy + depth + 34); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 14; i++) { const ph = (lt * 1.5 + hash(i)) % 1; ctx.fillStyle = `rgba(216,177,122,${0.5 * (1 - ph)})`; ctx.beginPath(); ctx.arc(rx + (hash(i * 3) - 0.5) * 220 * ph, gy - 10 - ph * 120, 10 + ph * 40, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1 - prog(p, 0.0, 0.08); outlinedText(ctx, 'PERFURAÇÃO SOVIÉTICA', W / 2, H * 0.18, { size: 70, color: '#F2E2C2', stroke: 9 }); ctx.globalAlpha = 1;
  }
  const vib = cStart > 0 && p <= 0 ? Math.sin(lt * 60) * 3 : 0;
  ctx.save(); ctx.translate(rx + vib, gy + fall * 380); ctx.rotate(fall * 0.9); ctx.globalAlpha = 1 - prog(p, 0.55, 0.62);
  ctx.strokeStyle = '#D9C6A5'; ctx.lineWidth = 11; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-95, 0); ctx.lineTo(0, -430); ctx.lineTo(95, 0); ctx.moveTo(-72, -100); ctx.lineTo(72, -100); ctx.moveTo(-48, -210); ctx.lineTo(48, -210); ctx.moveTo(-26, -320); ctx.lineTo(26, -320); ctx.moveTo(-72, -100); ctx.lineTo(48, -210); ctx.moveTo(72, -100); ctx.lineTo(-48, -210); ctx.stroke();
  ctx.fillStyle = '#FF5A1F'; ctx.beginPath(); ctx.arc(0, -440, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // debris
  for (let i = 0; i < 60; i++) { const d = prog(p, 0.25 + hash(i) * 0.2, 0.6 + hash(i) * 0.15); if (d <= 0 || d >= 1) continue;
    const x = W / 2 + (hash(i * 3) - 0.5) * 600 * (1 - d * 0.6), y = gy + d * d * 420 * sink; ctx.fillStyle = '#7A5534'; ctx.fillRect(x, y, 6 + hash(i) * 12, 6 + hash(i * 2) * 12); }
  // gas plumes
  const gas = prog(p, 0.55, 1);
  if (gas > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) { const ph = (gas * 1.6 + hash(i)) % 1; const x = W / 2 + (hash(i * 5) - 0.5) * 420 + Math.sin(ph * 6 + i) * 40, y = gy + 260 - ph * 760;
      const rr = 60 + ph * 160; const gg = ctx.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(170,220,150,${0.35 * (1 - ph) * gas})`); gg.addColorStop(1, 'rgba(170,220,150,0)');
      ctx.fillStyle = gg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    ctx.restore();
    ctx.globalAlpha = prog(p, 0.62, 0.72); outlinedText(ctx, 'GÁS NATURAL', W / 2, gy - 420, { size: 76, color: '#B8F0A0', stroke: 9 }); ctx.globalAlpha = 1; }
  // labels
  ctx.globalAlpha = 1 - prog(p, 0.25, 0.32); outlinedText(ctx, 'SOLO', W * 0.16, gy + 170, { size: 50, color: '#FFF', stroke: 7 }); ctx.globalAlpha = 1;
  { const a = prog(p, 0.5, 0.6); if (a > 0) { ctx.globalAlpha = a; ctx.strokeStyle = C.gold; ctx.lineWidth = 6; const x0 = W / 2 - 330, x1 = W / 2 + 330, yy = gy - 40;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.moveTo(x0, yy - 22); ctx.lineTo(x0, yy + 22); ctx.moveTo(x1, yy - 22); ctx.lineTo(x1, yy + 22); ctx.stroke();
    outlinedText(ctx, '≈ 70 M', W / 2, yy - 52, { size: 58, color: C.gold, stroke: 8 }); ctx.globalAlpha = 1; } }
}
// low-res photo: sharp full-width band over a blurred enlarged copy
async function drawBlurFill(ctx, shot, t) {
  const img = await loadImg(shot.src.type === 'clip' ? plateURL(shot, t) : shot.src.path); const cam = shot.cam;
  const p = (E[cam.ease] || E.inOutSine)(prog(t, shot.t0, shot.t1));
  const z = lerp(cam.from.z, cam.to.z, p), cx = lerp(cam.from.cx, cam.to.cx, p);
  const bs = Math.max(W / img.width, H / img.height) * 1.15;
  ctx.save(); ctx.filter = 'blur(38px) brightness(0.5) saturate(1.3)';
  ctx.drawImage(img, W / 2 - img.width * bs / 2, H / 2 - img.height * bs / 2, img.width * bs, img.height * bs); ctx.restore();
  const fw = W * z, fh = fw * img.height / img.width, fy = H * (shot.bandY ?? 0.45) - fh / 2;
  const fx = W / 2 - fw * clamp(cx, 0.5 / z, 1 - 0.5 / z);
  ctx.save(); ctx.beginPath(); ctx.rect(0, fy, W, fh); ctx.clip();
  ctx.filter = 'saturate(1.18) contrast(1.08)'; ctx.drawImage(img, fx, fy, fw, fh); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, fy - 3, W, 3); ctx.fillRect(0, fy + fh, W, 3);
}
// Natural Earth map: zoom from a wide view to a country, gold highlight + pin
let GEO = null;
async function drawGeoMap(ctx, shot, t) {
  if (!GEO) GEO = await (await fetch('input/ne_countries.geojson')).json();
  const m = shot.src.map; const p = E.inOutCubic(prog(t, shot.t0, shot.t0 + (m.dur || (shot.t1 - shot.t0) * 0.8)));
  const lon0 = lerp(m.from.lon, m.to.lon, p), lat0 = lerp(m.from.lat, m.to.lat, p), span = Math.exp(lerp(Math.log(m.from.span), Math.log(m.to.span), p));
  const k = W / span; const X = (lon) => W / 2 + (lon - lon0) * k, Y = (lat) => H * 0.45 - (lat - lat0) * k * 1.04;
  ctx.fillStyle = '#071018'; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, H * 0.8); glow.addColorStop(0, 'rgba(30,60,90,0.5)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const poly = (rings) => { for (const ring of rings) { ring.forEach(([lo, la], i) => (i ? ctx.lineTo(X(lo), Y(la)) : ctx.moveTo(X(lo), Y(la)))); ctx.closePath(); } };
  let target = null;
  for (const f of GEO.features) {
    const g = f.geometry; if (!g) continue; const name = f.properties.ADMIN || f.properties.NAME;
    ctx.beginPath(); (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly);
    if (name === m.country) { target = f; continue; }
    ctx.fillStyle = '#1C2630'; ctx.fill(); ctx.strokeStyle = 'rgba(160,190,210,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (target) {
    const g = target.geometry; ctx.beginPath(); (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly);
    const hl = prog(t, shot.t0 + 0.3, shot.t0 + 1.0);
    ctx.save(); ctx.shadowColor = 'rgba(255,194,26,0.8)'; ctx.shadowBlur = 40 * hl; ctx.fillStyle = `rgba(255,194,26,${0.25 + 0.6 * hl})`; ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#FFE28A'; ctx.lineWidth = 4; ctx.stroke();
  }
  if (m.label) { ctx.globalAlpha = prog(t, shot.t0 + 0.6, shot.t0 + 1.0); outlinedText(ctx, m.label, W / 2, H * 0.2, { size: 110, color: '#FFC21A', stroke: 11 }); ctx.globalAlpha = 1; }
  if (m.pin) {
    const lt = t - shot.t0 - (m.pinAt ?? 1.2); if (lt > 0) {
      const px = X(m.pin[0]), py = Y(m.pin[1]);
      for (let q = 0; q < 3; q++) { const ph = ((lt * 1.2 + q / 3) % 1); ctx.beginPath(); ctx.arc(px, py, 18 + ph * 140, 0, Math.PI * 2); ctx.strokeStyle = `rgba(232,32,42,${(1 - ph) * 0.9})`; ctx.lineWidth = 8 * (1 - ph) + 2; ctx.stroke(); }
      const s = E.outBack(prog(lt, 0, 6 / FPS), 2.5); ctx.save(); ctx.translate(px, py); ctx.scale(s, s);
      ctx.fillStyle = C.red; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -70, 34, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -72, 12, 0, Math.PI * 2); ctx.fill();
      if (m.pinLabel) { ctx.globalAlpha = prog(lt, 0.25, 0.45); outlinedText(ctx, m.pinLabel, 0, -150, { size: 58, color: '#fff', stroke: 8 }); }
      ctx.restore();
    }
  }
}
// explainer: club strikes a shell, cavitation bubble forms, collapses, shock wave
function drawCavitation(ctx, lt, dur, marks) {
  // marks: fractions of the shot where bubble forms / collapses (default 0.3 / 0.55)
  const pb = marks.bubble ?? 0.3, pc = marks.collapse ?? 0.55; const p = clamp(lt / dur);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04263A'); g.addColorStop(0.6, '#021624'); g.addColorStop(1, '#010A12'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // light rays + drifting particles
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(80,180,220,0.05)'; ctx.beginPath(); const x = W * (0.1 + 0.16 * i) + Math.sin(lt * 0.4 + i) * 40; ctx.moveTo(x, 0); ctx.lineTo(x + 90, 0); ctx.lineTo(x + 300, H); ctx.lineTo(x + 140, H); ctx.fill(); }
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(180,230,255,${0.15 + 0.25 * hash(i)})`; ctx.beginPath(); ctx.arc(hash(i * 3) * W, (hash(i * 7) * H - lt * 20 * (0.5 + hash(i))) % H + H * (hash(i * 7) * H - lt * 20 < 0 ? 1 : 0), 1.5 + hash(i * 5) * 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // sand floor
  ctx.fillStyle = '#2B2418'; ctx.beginPath(); ctx.moveTo(0, H * 0.74); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.74 + Math.sin(x * 0.01) * 14); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  const sx = W * 0.64, sy = H * 0.62;   // shell / impact point
  // snail shell
  const crack = prog(p, pc, pc + 0.15);
  ctx.save(); ctx.translate(sx, sy);
  const sg = ctx.createRadialGradient(-30, -30, 10, 0, 0, 160); sg.addColorStop(0, '#F3D9B1'); sg.addColorStop(1, '#9A6A3A');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(40, 0, 150, 120, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6E4522'; ctx.lineWidth = 7; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(40 - k * 10, 0, 120 - k * 30, -2.2, 2.4); ctx.stroke(); }
  if (crack > 0) { ctx.strokeStyle = '#1A0E06'; ctx.lineWidth = 6; for (let k = 0; k < 6; k++) { ctx.beginPath(); let x = -100, y = (k - 2.5) * 18; ctx.moveTo(x, y); for (let j = 0; j < 6 * crack; j++) { x += 30; y += (hash(k * 11 + j) - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); } }
  ctx.restore();
  // the club (raptorial appendage) swings in: slow-motion approach, contact at pb
  const sw = E.inCubic(prog(p, 0.05, pb)); const ang = lerp(-1.2, 0.05, sw) + (p > pb ? -0.08 * prog(p, pb, pb + 0.1) : 0);
  ctx.save(); ctx.translate(W * 0.18, H * 0.66); ctx.rotate(ang);
  const cg = ctx.createLinearGradient(0, -40, 0, 40); cg.addColorStop(0, '#5BD6B4'); cg.addColorStop(1, '#1F7F6A');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, -32, 420, 64, 30) : ctx.rect(0, -32, 420, 64); ctx.fill();
  ctx.fillStyle = '#F05A7E'; ctx.beginPath(); ctx.ellipse(440, 0, 70, 58, 0, 0, Math.PI * 2); ctx.fill();                  // dactyl club
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(425, -22, 30, 14, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (p < pb) { // speed streaks while swinging
    ctx.save(); ctx.globalAlpha = 0.5 * sw; ctx.strokeStyle = '#BFF3FF'; ctx.lineWidth = 6; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(W * 0.18, H * 0.66, 380 + k * 22, ang - 0.5, ang - 0.05); ctx.stroke(); } ctx.restore(); }
  // bubble: grows after contact, collapses at pc
  const ix = sx - 110, iy = sy;
  if (p >= pb && p < pc) {
    const gr = E.outCubic(prog(p, pb, pb + (pc - pb) * 0.6)); const shrink = E.inCubic(prog(p, pb + (pc - pb) * 0.7, pc));
    const br = 20 + 110 * gr * (1 - shrink);
    const bg = ctx.createRadialGradient(ix - br * 0.3, iy - br * 0.3, br * 0.1, ix, iy, br); bg.addColorStop(0, 'rgba(255,255,255,0.9)'); bg.addColorStop(0.6, 'rgba(190,240,255,0.35)'); bg.addColorStop(1, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ix, iy, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha = prog(p, pb, pb + 0.05); outlinedText(ctx, 'BOLHA DE CAVITAÇÃO', W / 2, H * 0.4, { size: 66, color: '#BFF3FF', stroke: 9 }); ctx.globalAlpha = 1;
    // arrow to the bubble
    ctx.strokeStyle = '#FFC21A'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W / 2, H * 0.43); ctx.quadraticCurveTo(W / 2 - 60, H * 0.5, ix - 10, iy - br - 20); ctx.stroke();
  }
  if (p >= pc) {
    const q = prog(p, pc, 1);
    const fl = Math.exp(-q * 30); if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(ix, iy, 0, ix, iy, 120); lg.addColorStop(0, `rgba(200,240,255,${Math.exp(-q * 12)})`); lg.addColorStop(1, 'rgba(200,240,255,0)'); ctx.fillStyle = lg; ctx.fillRect(ix - 120, iy - 120, 240, 240);
    ctx.restore();
    for (let k = 0; k < 4; k++) { const rq = prog(q, k * 0.08, k * 0.08 + 0.6); if (rq <= 0 || rq >= 1) continue;
      ctx.strokeStyle = `rgba(190,240,255,${1 - rq})`; ctx.lineWidth = 16 * (1 - rq) + 2; ctx.beginPath(); ctx.arc(ix, iy, 30 + rq * 900, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = prog(q, 0.05, 0.15); outlinedText(ctx, 'ONDA DE CHOQUE', W / 2, H * 0.4, { size: 80, color: '#FFC21A', stroke: 10 }); ctx.globalAlpha = 1;
  }
  // step labels
  ctx.save(); ctx.font = font(30, 800); ctx.letterSpacing = '4px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = p < pb ? '1 · O GOLPE' : p < pc ? '2 · A BOLHA SE FORMA' : '3 · A BOLHA COLAPSA';
  const lw = ctx.measureText(step).width + 48; ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, W / 2 - lw / 2, H * 0.085 - 26, lw, 52, 26); ctx.fill();
  ctx.fillStyle = '#F5DC9A'; ctx.fillText(step, W / 2, H * 0.085 + 2); ctx.restore();
}
// illustration: a flamingo on the soda crust gets covered by mineral crystals until it looks like stone
const CAL = {};
function flamingoPath(ctx) {
  // side view, standing; coordinates in a 1080x1920 frame
  ctx.beginPath();
  ctx.moveTo(380, 1060);                                   // tail
  ctx.bezierCurveTo(420, 960, 600, 930, 700, 990);         // back
  ctx.bezierCurveTo(735, 1010, 740, 1060, 700, 1090);      // chest
  ctx.bezierCurveTo(620, 1150, 470, 1140, 380, 1060);      // belly
  ctx.closePath();
  ctx.moveTo(690, 1000);                                   // neck (S-curve) as a thick band
  ctx.bezierCurveTo(800, 900, 560, 800, 600, 690);
  ctx.bezierCurveTo(612, 655, 660, 640, 690, 662);
  ctx.bezierCurveTo(665, 670, 640, 690, 640, 720);
  ctx.bezierCurveTo(630, 800, 860, 900, 722, 1030);
  ctx.closePath();
}
function drawCalcify(ctx, lt, dur) {
  const p = clamp(lt / dur);
  if (!CAL.crust) {      // crust texture: polygon plates
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H * 0.45); sky.addColorStop(0, '#1A0E14'); sky.addColorStop(1, '#5A2A2A'); g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.45);
    const water = g.createLinearGradient(0, H * 0.38, 0, H * 0.5); water.addColorStop(0, '#7A1E1E'); water.addColorStop(1, '#B4473A'); g.fillStyle = water; g.fillRect(0, H * 0.38, W, H * 0.14);
    g.fillStyle = '#D9C9BE'; g.fillRect(0, H * 0.5, W, H * 0.5);
    for (let i = 0; i < 260; i++) { const x = hash(i) * W, y = H * 0.5 + hash(i * 3) ** 0.8 * H * 0.5, r = 30 + hash(i * 7) * 90 * (y / H);
      const wv = 222 + hash(i * 5) * 26; g.fillStyle = hash(i * 13) > 0.9 ? `rgba(${150 + hash(i) * 40},${55 + hash(i * 2) * 25},${45 + hash(i * 4) * 20},0.85)` : `rgba(${wv},${wv - 12 - hash(i * 9) * 14},${wv - 22 - hash(i * 11) * 16},0.95)`; g.beginPath();
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + hash(i + k); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45); } g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,50,0.45)'; g.lineWidth = 3; g.stroke(); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(80,60,50,${0.08 * hash(i * 3)})`; g.fillRect(hash(i) * W, H * 0.5 + hash(i * 7) * H * 0.5, 2, 2); }
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,6,0.65)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    CAL.crust = c;
  }
  // slow push-in toward the head in the last third
  const z = 1 + 0.9 * E.inOutCubic(prog(p, 0.6, 1));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2 - (630 - W / 2) * (z - 1) / 0.9 * 0.9, -H / 2 - (760 - H / 2) * (z - 1) / 0.9 * 0.9);
  ctx.drawImage(CAL.crust, 0, 0);
  // legs
  const legCol = `rgb(${lerp(232, 205, p)},${lerp(110, 198, p)},${lerp(140, 190, p)})`;
  ctx.strokeStyle = legCol; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(560, 1120); ctx.lineTo(575, 1300); ctx.lineTo(560, 1480); ctx.moveTo(520, 1115); ctx.lineTo(500, 1290); ctx.lineTo(530, 1470); ctx.stroke();
  // body: pink -> stone
  const calc = E.inOutSine(prog(p, 0.12, 0.7));
  flamingoPath(ctx);
  const body = ctx.createLinearGradient(380, 650, 740, 1150);
  body.addColorStop(0, `rgb(${lerp(250, 222, calc)},${lerp(150, 214, calc)},${lerp(170, 204, calc)})`); body.addColorStop(1, `rgb(${lerp(226, 176, calc)},${lerp(92, 168, calc)},${lerp(122, 160, calc)})`);
  ctx.fillStyle = body; ctx.fill();
  // wing
  ctx.beginPath(); ctx.moveTo(450, 1010); ctx.bezierCurveTo(540, 960, 650, 970, 690, 1020); ctx.bezierCurveTo(600, 1060, 520, 1070, 450, 1010);
  ctx.fillStyle = `rgba(${lerp(200, 150, calc)},${lerp(60, 140, calc)},${lerp(90, 132, calc)},0.55)`; ctx.fill();
  // beak
  ctx.beginPath(); ctx.moveTo(686, 660); ctx.quadraticCurveTo(735, 670, 720, 735); ctx.quadraticCurveTo(705, 700, 672, 690); ctx.closePath();
  ctx.fillStyle = calc > 0.6 ? '#9C928A' : '#1A1012'; ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(652, 676, 5, 0, Math.PI * 2); ctx.fill();
  // crystals grow over the body (clipped to the silhouette)
  ctx.save(); flamingoPath(ctx); ctx.clip();
  const n = Math.floor(900 * prog(p, 0.08, 0.75));
  for (let i = 0; i < n; i++) {
    const x = 370 + hash(i * 1.3) * 400, y = 640 + hash(i * 2.7) * 520, r = 3 + hash(i * 4.1) * 12;
    const sv = hash(i * 9) > 0.55 ? 205 + hash(i) * 40 : 120 + hash(i) * 50; ctx.fillStyle = `rgba(${sv},${sv - 6},${sv - 12},${0.45 + 0.45 * hash(i * 7)})`;
    ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + hash(i + k); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // crust creeping up the legs
  ctx.strokeStyle = `rgba(236,230,222,${calc})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(560, 1480); ctx.lineTo(575, 1480 - 360 * calc); ctx.moveTo(530, 1470); ctx.lineTo(505, 1470 - 350 * calc); ctx.stroke();
  ctx.restore();
  // honesty label
  ctx.save(); ctx.font = font(30, 800); ctx.letterSpacing = '4px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lw = ctx.measureText('ILUSTRAÇÃO').width + 48; ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, W / 2 - lw / 2, H * 0.085 - 26, lw, 52, 26); ctx.fill();
  ctx.fillStyle = '#F5DC9A'; ctx.fillText('ILUSTRAÇÃO', W / 2, H * 0.085 + 2); ctx.restore();
}
async function drawCompare(ctx, shot, t) {
  const s = shot.src, lt = t - shot.t0;
  const half = async (path, y0, label, k) => {
    const img = await loadImg(path); const vh = H / 2, vw = W;
    const z = 1 + 0.06 * lt; const ih = img.height, iw = ih * (vw / vh); const sw = Math.min(img.width, iw) / z, sh = sw * vh / vw;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, vh); ctx.clip();
    ctx.filter = 'saturate(1.14) contrast(1.06)'; ctx.drawImage(img, (img.width - sw) / 2, (ih - sh) / 2, sw, sh, 0, y0, vw, vh); ctx.filter = 'none';
    const a = E.outCubic(prog(lt, 0.15 + k * 0.25, 0.4 + k * 0.25));
    ctx.translate(lerp(-300, 0, a), 0); ctx.fillStyle = k ? C.cyan : C.pink; roundRect(ctx, 50, y0 + 44, 300, 96, 18); ctx.fill();
    ctx.font = font(64); ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(label, 200, y0 + 94);
    ctx.restore();
  };
  await half(s.a, 0, s.la, 0); await half(s.b, H / 2, s.lb, 1);
  ctx.fillStyle = '#000'; ctx.fillRect(0, H / 2 - 5, W, 10);
}

// ---------------- end card ----------------
let MARK = null, COVER = null;
const GOLD = { hi: '#FFF1B8', mid: '#FFC21A', deep: '#C77700', glow: 'rgba(255,190,40,' };
function eclipse(ctx, cx, cy, r, on, t) {
  // dark planet with a lit golden rim and a flare breaking over the top
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.9);
  halo.addColorStop(0, GOLD.glow + (0.55 * on) + ')'); halo.addColorStop(0.35, GOLD.glow + (0.18 * on) + ')'); halo.addColorStop(1, 'rgba(255,190,40,0)');
  ctx.fillStyle = halo; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // light leaking inward from the rim, strongest at the top (like the channel avatar)
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const inner = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
  inner.addColorStop(0, 'rgba(255,190,40,0)'); inner.addColorStop(1, GOLD.glow + (0.55 * on) + ')');
  ctx.fillStyle = inner; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const top = ctx.createLinearGradient(0, cy - r, 0, cy - r * 0.25);
  top.addColorStop(0, GOLD.glow + (0.45 * on) + ')'); top.addColorStop(1, 'rgba(255,190,40,0)');
  ctx.fillStyle = top; ctx.fillRect(cx - r, cy - r, 2 * r, r);
  // faint surface texture
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,200,80,${0.05 * on * hash(i * 3)})`; ctx.beginPath(); ctx.arc(cx + (hash(i) - 0.5) * 1.8 * r, cy + (hash(i * 7) - 0.8) * r, 10 + hash(i * 5) * 40, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // rim lights up sweeping from the top both ways
  const sweep = Math.PI * E.outCubic(clamp(on * 1.15));
  ctx.lineCap = 'round';
  for (const [w, a, blur] of [[26, 0.35, 40], [12, 0.8, 18], [5, 1, 0]]) {
    ctx.shadowColor = GOLD.mid; ctx.shadowBlur = blur; ctx.strokeStyle = `rgba(255,${200 + (w < 8 ? 40 : 0)},${w < 8 ? 150 : 40},${a})`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 - sweep, -Math.PI / 2 + sweep); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // flare at the top
  const fl = on * (0.88 + 0.12 * Math.sin(t * 5));
  ctx.globalCompositeOperation = 'lighter';
  for (const [rad, a] of [[r * 0.9, 0.35], [r * 0.45, 0.7], [r * 0.18, 1]]) {
    const fg = ctx.createRadialGradient(cx, cy - r + 6, 0, cx, cy - r + 6, rad);
    fg.addColorStop(0, `rgba(255,248,220,${a * fl})`); fg.addColorStop(0.4, `rgba(255,200,60,${a * 0.6 * fl})`); fg.addColorStop(1, 'rgba(255,180,30,0)');
    ctx.fillStyle = fg; ctx.fillRect(cx - rad, cy - r + 6 - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}
function drawEnd(ctx, t) {
  const lt = t - TL.end.t0;
  ctx.fillStyle = '#030201'; ctx.fillRect(0, 0, W, H);
  // golden star dust drifting
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 220; i++) {
    const x = (hash(i) * W + lt * (6 + hash(i * 3) * 14)) % W, y = hash(i * 7) * H;
    ctx.globalAlpha = (0.15 + 0.6 * hash(i * 5)) * (0.7 + 0.3 * Math.sin(t * 3 + i));
    ctx.fillStyle = i % 4 ? '#FFC94A' : '#FFF2C8'; ctx.beginPath(); ctx.arc(x, y, 0.8 + hash(i * 11) * 2.4, 0, Math.PI * 2); ctx.fill();
  }
  for (let k = 0; k < 5; k++) { const nx = W * (0.15 + 0.7 * hash(k * 13)), ny = H * (0.12 + 0.75 * hash(k * 17)); const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 320);
    ng.addColorStop(0, 'rgba(200,140,20,0.10)'); ng.addColorStop(1, 'rgba(200,140,20,0)'); ctx.globalAlpha = 1; ctx.fillStyle = ng; ctx.fillRect(nx - 320, ny - 320, 640, 640); }
  ctx.restore();
  const on = prog(lt, 0.05, 1.0);
  const r = 250 * (1 + 0.03 * Math.sin(lt * 1.2));
  eclipse(ctx, W / 2, H * 0.4, r, on, t);
  // wordmark in gold
  const word = 'EXTRAMUNDO'; const size = 112; ctx.font = font(size);
  const ws = [...word].map((c) => ctx.measureText(c).width); const tr = 4; const tot = ws.reduce((a, b) => a + b, 0) + tr * (ws.length - 1);
  let x = W / 2 - tot / 2; const y = H * 0.66;
  const grad = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.45); grad.addColorStop(0, GOLD.hi); grad.addColorStop(0.5, GOLD.mid); grad.addColorStop(1, GOLD.deep);
  [...word].forEach((c, i) => {
    const p = spring(lt - 0.6 - i * 0.04, 2.2, 6);
    if (p > 0) { ctx.save(); ctx.translate(x + ws[i] / 2, y + 80 * (1 - p)); ctx.globalAlpha = clamp(p * 2);
      ctx.font = font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,190,40,0.55)'; ctx.shadowBlur = 30; ctx.fillStyle = grad; ctx.fillText(c, 0, 0); ctx.restore(); }
    x += ws[i] + tr;
  });
  const tg = prog(lt, 1.2, 1.7);
  ctx.save(); ctx.globalAlpha = tg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F5DC9A'; ctx.font = font(38, 800); ctx.letterSpacing = '6px';
  ctx.fillText('O EXTRAORDINÁRIO ESTÁ MAIS PERTO', W / 2, y + 130); ctx.fillText('DO QUE VOCÊ IMAGINA', W / 2, y + 184);
  ctx.restore();
}

// ---------------- frame ----------------
const shotAt = (t) => { let k = TL.shots.findIndex((s) => t >= s.t0 && t < s.t1); return k < 0 ? TL.shots.length - 1 : k; };
async function renderFrame(f) {
  const t = f / FPS;
  const b = buf.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.filter = 'none'; b.globalCompositeOperation = 'source-over';
  let shakeAmt = 0;
  if (f === 0 && COVER) { b.drawImage(COVER, 0, 0, W, H); }   // first frame = thumbnail cover
  else if (t < TL.shots[0].t0) { b.fillStyle = '#000'; b.fillRect(0, 0, W, H); }
  else if (t >= TL.end.t0) {
    drawEnd(b, t);
    const fl = 1 - prog(t, TL.end.t0, TL.end.t0 + 6 / FPS);
    if (fl > 0) { b.fillStyle = `rgba(255,255,255,${fl})`; b.fillRect(0, 0, W, H); }
  } else {
    const k = shotAt(t), shot = TL.shots[k], next = TL.shots[k + 1], prev = TL.shots[k - 1];
    const fIn = Math.round((t - shot.t0) * FPS), fOut = next ? Math.round((next.t0 - t) * FPS) : 99;
    let zoom = 1, blur = 0;
    // zoom-blur: last 3 frames out / first 4 frames in
    if (next && next.trans === 'zoomblur' && fOut <= 3) zoom = 1 + (4 - fOut) * 0.09;
    if (shot.trans === 'zoomblur' && fIn < 4) zoom = 1 + (4 - fIn) * 0.08;
    if (shot.trans === 'dip' && fIn < 8) blur = (8 - fIn) * 2.2;
    const r = await drawPlate(b, shot, t, { zoom, blur });
    if (shot.fx.includes('heat')) { prevBuf.getContext('2d').drawImage(buf, 0, 0); heatHaze(b, prevBuf, t, 5); }
    if (shot.fx.includes('embers')) embers(b, t, 1);
    if (shot.fx.includes('flicker')) { b.fillStyle = `rgba(255,120,30,${0.06 + 0.06 * Math.sin(t * 23) * Math.sin(t * 7.3)})`; b.globalCompositeOperation = 'overlay'; b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'source-over'; }
    drawOverlays(b, shot, r, t);
    for (const o of shot.overlays) if (o.style === 'slam' && t >= o.t) shakeAmt += 34 * Math.exp(-(t - o.t) * 7);
    if (shot.fx.includes('shake')) shakeAmt += 6;
    if ((next && next.trans === 'zoomblur' && fOut <= 3) || (shot.trans === 'zoomblur' && fIn < 4)) {
      const amt = next && fOut <= 3 ? (4 - fOut) / 3 : (4 - fIn) / 4;
      prevBuf.getContext('2d').drawImage(buf, 0, 0); b.clearRect(0, 0, W, H); zoomStreak(b, prevBuf, amt * 1.6);
    }
    if ((next && next.trans === 'glitch' && fOut <= 2) || (shot.trans === 'glitch' && fIn < 3)) {
      prevBuf.getContext('2d').drawImage(buf, 0, 0); glitch(b, prevBuf, f, 1);
    }
    if (next && next.trans === 'dip' && fOut <= 4) { b.fillStyle = `rgba(0,0,0,${(5 - fOut) / 5})`; b.fillRect(0, 0, W, H); }
    if (shot.trans === 'dip' && fIn < 8) { b.fillStyle = `rgba(0,0,0,${1 - fIn / 8})`; b.fillRect(0, 0, W, H); }
    if (shot.trans === 'xfade' && fIn < 10 && prev) {
      const p = prevBuf.getContext('2d'); p.filter = 'none';
      const pr = await drawPlate(p, prev, t); drawOverlays(p, prev, pr, t);
      b.save(); b.globalAlpha = 1 - fIn / 10; b.drawImage(prevBuf, 0, 0); b.restore();
    }
    if (TL.end.trans === 'flash' && !next) { const fl = prog(t, TL.end.t0 - 4 / FPS, TL.end.t0); if (fl > 0) { b.fillStyle = `rgba(255,255,255,${fl})`; b.fillRect(0, 0, W, H); } }
    // brand + hook + captions on top
    drawHeadline(b, t);
    drawStamp(b, t);
    for (const c of TL.cards) drawCard(b, c, t);
  }
  if (TL.end.fade && t > TL.duration - TL.end.fade) { b.fillStyle = `rgba(0,0,0,${clamp((t - (TL.duration - TL.end.fade)) / TL.end.fade)})`; b.fillRect(0, 0, W, H); }
  // post: vignette + light grain
  octx.setTransform(1, 0, 0, 1, 0, 0);
  if (shakeAmt > 0.5) { const sx = shakeAmt * Math.sin(t * 91.7), sy = shakeAmt * Math.sin(t * 77.3 + 1); octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H); octx.drawImage(buf, -20 + sx, -36 + sy, W + 40, H + 72); }
  else octx.drawImage(buf, 0, 0);
  const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
}

window.__ready = (async () => {
  await Promise.all([document.fonts.load('900 100px "Montserrat"'), document.fonts.load('italic 900 100px "Montserrat"'), document.fonts.load('800 100px "Montserrat"')]);
  TL = await (await fetch('build/timeline.json')).json(); FPS = TL.fps;
  try { COVER = await loadImg('output/capa-shorts-1080x1920.jpg'); } catch (err) { COVER = null; }
  window.FRAMES = Math.round(TL.duration * FPS);
  window.renderFrame = async (f, q = 0.93) => { await renderFrame(f); return out.toDataURL('image/jpeg', q); };
  return true;
})();

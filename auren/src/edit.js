// =====================================================================
//  AUREN editor — "Estilo Leonida"
//  Plates (stills / trailer frames) + camera moves, word-by-word captions
//  with colour code, location chips, arrows, rings, transitions, end card.
//  Every frame is a pure function of build/timeline.json and the frame index.
// =====================================================================
const W = 1080, H = 1920;
const C = { white: '#FFFFFF', cyan: '#2FE6FF', gold: '#FFD23F', pink: '#FF3EA5', orange: '#FF7A3D', ink: '#0B0A10' };
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

async function drawPlate(ctx, shot, t, { zoom = 1, blur = 0 } = {}) {
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
  const cx = W * 0.47, cy = H * 0.535;
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
  const st = TL.stamp; const lt = t - st.t; const dur = 0.8;
  if (lt < 0 || lt > dur) return;
  const s = lt < 2 / FPS ? lerp(2.4, 1, lt * FPS / 2) : 1 - E.inExpo(prog(lt, dur - 0.12, dur));
  const sh = lt < 0.2 ? (hash(Math.floor(t * FPS)) - 0.5) * 18 * (1 - lt / 0.2) : 0;
  ctx.save(); ctx.translate(W * 0.47 + sh, H * 0.3); ctx.rotate(-0.07); ctx.scale(s, s);
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
  ctx.save(); ctx.translate(56 + sx, H * 0.205);
  ctx.font = font(40, 800); ctx.letterSpacing = '3px';
  const w = ctx.measureText(o.text).width + 112;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = C.cyan; roundRect(ctx, 0, -36, w, 72, 36); ctx.fill(); ctx.shadowColor = 'transparent';
  // pin
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(44, -6, 15, Math.PI, 0); ctx.lineTo(44, 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(44, -6, 6, 0, Math.PI * 2); ctx.fill();
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
  ctx.save(); ctx.translate(W * 0.47, H * 0.3); ctx.scale(s, s);
  outlinedText(ctx, o.text, 0, 0, { size: 168, color: C.cyan, stroke: 16, track: 10 });
  ctx.restore();
}
function drawPause(ctx, o, t) {
  const lt = t - o.t; if (lt < 0) return;
  const s = E.outBack(prog(lt, 0, 6 / FPS), 2.4);
  ctx.save(); ctx.translate(W * 0.47, H * 0.33); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(11,10,16,0.78)'; roundRect(ctx, -190, -70, 380, 140, 36); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; roundRect(ctx, -190, -70, 380, 140, 36); ctx.stroke();
  ctx.fillStyle = C.white; ctx.fillRect(-140, -32, 20, 64); ctx.fillRect(-106, -32, 20, 64);
  ctx.font = font(52, 800); ctx.letterSpacing = '4px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('PAUSED', -60, 4);
  ctx.restore();
}
function drawOverlays(ctx, shot, r, t) {
  for (const o of shot.overlays) {
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
    ctx.save(); ctx.translate(W * 0.47, H * 0.105 + i * size * 1.08 - out * 260); ctx.scale(s, s);
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

// ---------------- end card ----------------
function drawEnd(ctx, t) {
  const lt = t - TL.end.t0;
  const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 50, W * 0.5, H * 0.46, H * 0.75);
  g.addColorStop(0, '#3A1640'); g.addColorStop(0.45, '#1A1028'); g.addColorStop(1, '#09080E');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // horizon glow + grid
  const hy = H * 0.5;
  const hg = ctx.createLinearGradient(0, hy - 220, 0, hy + 40); hg.addColorStop(0, 'rgba(255,62,165,0)'); hg.addColorStop(1, 'rgba(255,122,61,0.35)');
  ctx.fillStyle = hg; ctx.fillRect(0, hy - 220, W, 260);
  ctx.save(); ctx.strokeStyle = 'rgba(47,230,255,0.22)'; ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 22, hy); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
  for (let k = 0; k < 10; k++) { const f = ((k + lt * 0.8) % 10) / 10; const y = hy + (H - hy) * f * f; ctx.globalAlpha = f; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  // sun rises behind the horizon line
  const rise = E.outCubic(prog(lt, 0.0, 0.9));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
  ctx.shadowColor = 'rgba(255,122,61,0.8)'; ctx.shadowBlur = 80;
  drawSun(ctx, W / 2, hy + 40 - rise * 250, 230);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, hy, W, 2);
  // wordmark
  const word = 'AUREN'; ctx.font = font(196); ctx.letterSpacing = '18px';
  const tw = ctx.measureText(word).width; let x = W / 2 - tw / 2;
  [...word].forEach((ch, i) => {
    ctx.letterSpacing = '0px'; const cw = ctx.measureText(ch).width; ctx.font = font(196);
    const s = spring(lt - 0.25 - i * 0.06, 2.2, 6);
    if (s > 0) { ctx.save(); ctx.translate(x + cw / 2, hy + 170 + 140 * (1 - s)); ctx.globalAlpha = clamp(s * 2);
      outlinedText(ctx, ch, 0, 0, { size: 196, color: C.white, stroke: 0, shadow: true }); ctx.restore(); }
    x += cw + 18;
  });
  const tg = prog(lt, 0.75, 1.15);
  const tag = 'BEYOND THE GAME';
  ctx.save(); ctx.globalAlpha = tg; ctx.font = font(46, 800); ctx.letterSpacing = '14px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.cyan;
  ctx.fillText(tag.slice(0, Math.ceil(tag.length * E.outCubic(tg))), W / 2 + 7, hy + 330);
  ctx.restore();
  // drifting sparks
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 60; i++) { const y = (hash(i) * H + (1 - (lt * (20 + hash(i + 3) * 40)) % H)); const xx = hash(i * 7) * W; ctx.fillStyle = [C.pink, C.gold, C.cyan][i % 3]; ctx.globalAlpha = 0.35 * hash(i * 3); ctx.beginPath(); ctx.arc(xx, (y + H) % H, 2 + hash(i * 5) * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------------- frame ----------------
const shotAt = (t) => { let k = TL.shots.findIndex((s) => t >= s.t0 && t < s.t1); return k < 0 ? TL.shots.length - 1 : k; };
async function renderFrame(f) {
  const t = f / FPS;
  const b = buf.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.filter = 'none'; b.globalCompositeOperation = 'source-over';
  if (t >= TL.end.t0) {
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
    drawOverlays(b, shot, r, t);
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
  // post: vignette + light grain
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.drawImage(buf, 0, 0);
  const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
}

window.__ready = (async () => {
  await Promise.all([document.fonts.load('900 100px "Montserrat"'), document.fonts.load('italic 900 100px "Montserrat"'), document.fonts.load('800 100px "Montserrat"')]);
  TL = await (await fetch('build/timeline.json')).json(); FPS = TL.fps;
  window.FRAMES = Math.round(TL.duration * FPS);
  window.renderFrame = async (f, q = 0.93) => { await renderFrame(f); return out.toDataURL('image/jpeg', q); };
  return true;
})();

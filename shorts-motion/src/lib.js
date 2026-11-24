// Shared drawing helpers, easing curves and graphic primitives.
export const W = 1080, H = 1920, CX = W / 2, CY = H / 2;

export const PAL = {
  orange: '#FF5A00',
  blue: '#1F3BFF',
  yellow: '#E8FF1A',
  purple: '#7A2BFF',
  black: '#07070A',
  white: '#FFFFFF',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const E = {
  inQuad: (x) => x * x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => (x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)),
  inOutBack: (x) => { const c2 = 1.70158 * 1.525; return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2; },
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
// damped spring 0 -> 1 with overshoot (f = Hz, d = damping)
export const spring = (t, f = 3, d = 6) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * 2 * Math.PI * t));
// decaying impulse 0 -> ±1 -> 0 (for squash & stretch)
export const wobble = (t, f = 4, d = 8) => (t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(f * 2 * Math.PI * t));
// 120 BPM -> one kick every 0.5 s
export const beatPulse = (lt) => Math.exp(-(((lt % 0.5) + 0.5) % 0.5) * 10);

export function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

// ---------------- typography ----------------
const fontStr = (fam, size, weight) => `${weight ? weight + ' ' : ''}${size}px "${fam}"`;
const capCache = {};
export function capH(ctx, fam, size, weight) {
  const k = fam + (weight || '');
  if (!capCache[k]) { ctx.font = fontStr(fam, 200, weight); capCache[k] = ctx.measureText('H').actualBoundingBoxAscent / 200; }
  return capCache[k] * size;
}
export function measure(ctx, text, fam, size, track = 0, weight) {
  ctx.font = fontStr(fam, size, weight);
  const ch = [...text];
  const w = ch.map((c) => ctx.measureText(c).width);
  const tp = track * size;
  const tot = w.reduce((a, b) => a + b, 0) + tp * (ch.length - 1);
  let x = -tot / 2;
  const xs = w.map((wi) => { const c = x + wi / 2; x += wi + tp; return c; });
  return { ch, w, xs, tot };
}
export function fitSize(ctx, text, fam, targetW, track = 0, weight) {
  return (targetW / measure(ctx, text, fam, 200, track, weight).tot) * 200;
}

/**
 * Per-letter kinetic text. o.per(i, n) can return
 * {dx, dy, sx, sy, rot, a, fill, stroke}.
 */
export function drawText(ctx, text, o) {
  const { fam, size, weight, x = CX, y = CY, track = 0, per, ext, lw = 6, scale = 1, skx = 0 } = o;
  const m = measure(ctx, text, fam, size, track, weight);
  const by = capH(ctx, fam, size, weight) / 2;
  const n = m.ch.length;
  ctx.save();
  ctx.translate(x, y);
  if (skx) ctx.transform(1, 0, skx, 1, 0, 0);
  ctx.scale(scale * (o.sx ?? 1), scale * (o.sy ?? 1));
  ctx.font = fontStr(fam, size, weight);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const p = per ? per(i, n, m.ch[i]) || {} : {};
    const { dx = 0, dy = 0, sx = 1, sy = 1, rot = 0, a = 1 } = p;
    const fill = 'fill' in p ? p.fill : o.fill;
    const stroke = 'stroke' in p ? p.stroke : o.stroke;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.translate(m.xs[i] + dx, dy); ctx.rotate(rot); ctx.scale(sx, sy);
    const c = m.ch[i];
    if (ext) {
      ctx.fillStyle = ext.color;
      for (let k = ext.n; k >= 1; k--) ctx.fillText(c, (ext.dx * k) / ext.n, by + (ext.dy * k) / ext.n);
    }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(c, 0, by); }
    if (fill) { ctx.fillStyle = fill; ctx.fillText(c, 0, by); }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------- camera ----------------
export function cam(ctx, { x = CX, y = CY, z = 1, r = 0, tx = 0, ty = 0 } = {}) {
  ctx.translate(x + tx, y + ty); ctx.rotate(r); ctx.scale(z, z); ctx.translate(-x, -y);
}

// ---------------- graphic primitives ----------------
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function ring(ctx, x, y, r, lw, color, p = 1) {
  if (lw <= 0.2 || p <= 0 || r <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p)); ctx.stroke(); ctx.restore();
}
export function handRing(ctx, x, y, rx, ry, p, color, lw, tilt = 0) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  const N = 90, turns = 1.12;
  for (let i = 0; i <= N * p; i++) {
    const a = -2.4 + (i / N) * Math.PI * 2 * turns; const k = 1 + 0.06 * Math.sin(i * 0.21) + i * 0.0008;
    const X = Math.cos(a) * rx * k, Y = Math.sin(a) * ry * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.stroke(); ctx.restore();
}
export function arrow(ctx, x0, y0, x1, y1, p, color, lw) {
  if (p <= 0) return;
  const x = lerp(x0, x1, p), y = lerp(y0, y1, p);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  const hs = lw * 3.2 * clamp(p * 2);
  ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * hs * 0.6, y + Math.sin(a) * hs * 0.6);
  ctx.lineTo(x + Math.cos(a + 2.5) * hs, y + Math.sin(a + 2.5) * hs);
  ctx.lineTo(x + Math.cos(a - 2.5) * hs, y + Math.sin(a - 2.5) * hs); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function burst(ctx, cx, cy, n, r0, r1, color, rot, lw, p = 1) {
  if (p <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const a0 = lerp(r0, r1, 0) , a1 = lerp(r0, r1, clamp(p));
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * a0, cy + Math.sin(a) * a0); ctx.lineTo(cx + Math.cos(a) * a1, cy + Math.sin(a) * a1); ctx.stroke();
  }
  ctx.restore();
}
export function star4(ctx, x, y, r, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
export function sunburst(ctx, cx, cy, n, R, rot, color) {
  ctx.save(); ctx.fillStyle = color;
  for (let i = 0; i < n; i += 2) {
    const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
export function dotGrid(ctx, step, color, off = 0) {
  ctx.save(); ctx.fillStyle = color;
  const o = off % step;
  for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) { ctx.beginPath(); ctx.arc(x + o, y + o, 3.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export function perspGrid(ctx, hy, t, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3;
  for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(CX, hy); ctx.lineTo(CX + i * 260, H + 200); ctx.stroke(); }
  const N = 12;
  for (let k = 0; k < N; k++) {
    const f = Math.pow(((k + (t % 1)) / N), 2.2);
    const y = hy + (H + 200 - hy) * f;
    ctx.globalAlpha = clamp(f * 3); ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(W + 200, y); ctx.stroke();
  }
  ctx.restore();
}
export function speedLines(ctx, cx, cy, n, t, color, speed = 1) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(i * 1.37) * Math.PI * 2;
    const ph = (hash(i * 2.11 + 50) + t * speed * (0.6 + hash(i + 20))) % 1;
    const r0 = 160 + ph * ph * 1500, len = 60 + 520 * ph * ph;
    ctx.globalAlpha = clamp(ph * 2);
    ctx.lineWidth = 2 + 7 * ph;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); ctx.stroke();
  }
  ctx.restore();
}

/** Deterministic particle burst: streaks with drag, fading over life. */
export function particles(ctx, cx, cy, n, t, { speed = 2000, drag = 3, seed = 1, colors, len = 0.04, life = 1, width = 8, dots = false }) {
  if (t <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 1000 + i * 1.11), h2 = hash(seed * 2000 + i * 2.23), h3 = hash(seed * 3000 + i * 3.37);
    const a = h1 * Math.PI * 2, v = speed * (0.2 + 0.8 * h2 * h2), li = life * (0.5 + 0.5 * h3);
    const al = 1 - t / li; if (al <= 0) continue;
    const r = (v * (1 - Math.exp(-drag * t))) / drag;
    const vr = v * Math.exp(-drag * t);
    const gy = 260 * t * t;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r + gy;
    ctx.globalAlpha = al; ctx.strokeStyle = ctx.fillStyle = colors[i % colors.length];
    if (dots) { ctx.beginPath(); ctx.arc(x, y, width * (0.4 + h3) * al, 0, Math.PI * 2); ctx.fill(); continue; }
    const L = vr * len + 6;
    ctx.lineWidth = width * (0.3 + 0.7 * h3) * al;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * L, y - Math.sin(a) * L); ctx.stroke();
  }
  ctx.restore();
}

// ---------------- morphable shapes ----------------
const NPTS = 180;
function resample(poly) {
  const P = [...poly, poly[0]];
  const seg = []; let tot = 0;
  for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); tot += l; }
  const out = [];
  for (let k = 0; k < NPTS; k++) {
    let d = (k / NPTS) * tot, i = 0;
    while (d > seg[i] && i < seg.length - 1) { d -= seg[i]; i++; }
    const f = d / seg[i];
    out.push([lerp(P[i][0], P[i + 1][0], f), lerp(P[i][1], P[i + 1][1], f)]);
  }
  return out;
}
const starPoly = () => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? 0.45 : 1.05; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; };
export const shapes = {
  circle: Array.from({ length: NPTS }, (_, k) => { const a = -Math.PI / 2 + (k / NPTS) * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; }),
  square: resample([[0, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85], [-0.85, -0.85]]),
  triangle: resample([[0, -1.05], [0.98, 0.72], [-0.98, 0.72]]),
  star: resample(starPoly()),
  bolt: resample([[0.2, -1], [0.34, -1], [0.04, -0.16], [0.52, -0.16], [-0.24, 1.02], [-0.02, 0.1], [-0.5, 0.1]].map(([x, y]) => [x * 1.05, y])),
};
export const morphPath = (a, b, k) => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);

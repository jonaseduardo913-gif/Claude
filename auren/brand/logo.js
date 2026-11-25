// AUREN brand generator: vector logos (SVG, text converted to paths) + PNG exports.
//   node brand/logo.js            -> brand/out/*
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(path.join(OUT, 'svg'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });
const F900 = opentype.loadSync(path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff'));
const F800 = opentype.loadSync(path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff'));

const C = { ink: '#120E1A', night: '#1A1028', white: '#FFFFFF', cyan: '#2FE6FF', gold: '#FFD23F', orange: '#FF7A3D', pink: '#FF3EA5' };

// text -> SVG path, centred on (cx, baseline y), tracking in em/1000
function textPath(font, str, size, cx, y, track = 0, fill = C.white) {
  const glyphs = font.stringToGlyphs(str); const scale = size / font.unitsPerEm;
  const adv = glyphs.map((g) => g.advanceWidth * scale); const tr = track / 1000 * size;
  const total = adv.reduce((a, b) => a + b, 0) + tr * (glyphs.length - 1);
  let x = cx - total / 2; let d = '';
  glyphs.forEach((g, i) => { d += g.getPath(x, y, size).toPathData(2); x += adv[i] + tr; });
  return { svg: `<path d="${d}" fill="${fill}"/>`, width: total };
}
const capH = (font, size) => font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm * size;

// ---------------- the mark: "Sunrise A" ----------------
// A geometric A whose counter holds a synthwave sun; the crossbar is the horizon.
function sunriseA({ fg = C.white, id = 'm', horizon = C.cyan, gap = C.ink } = {}) {
  // geometric A in front of a big striped synthwave sun; the crossbar is the cyan horizon
  const apex = [256, 34], L = [44, 478], R = [468, 478], w = 78, hy = 352;
  const d = [apex[0] - L[0], apex[1] - L[1]]; const len = Math.hypot(...d);
  const n = [-d[1] / len, d[0] / len];
  const o = [L[0] + n[0] * w, L[1] + n[1] * w];
  const apexI = [256, o[1] + ((apex[0] - o[0]) / d[0]) * d[1]];
  const LI = [o[0] + ((L[1] - o[1]) / d[1]) * d[0], L[1]]; const RI = [512 - LI[0], L[1]];
  const P = (p) => p.map((v) => v.toFixed(1)).join(' ');
  const sunR = 214, sunY = 272;
  const cuts = [[hy + 34, 12], [hy + 66, 17], [hy + 100, 22], [hy + 138, 28]].map(([y, h]) => `<rect x="0" y="${y}" width="512" height="${h}"/>`).join('');
  const A = `M${P(apex)} L${P(R)} L${P(RI)} L${P(apexI)} L${P(LI)} L${P(L)} Z`;
  const xOut = (y) => L[0] + (y - L[1]) / d[1] * d[0];
  const bx0 = xOut(hy + 26) - 26, bw = 512 - 2 * bx0;
  return `
  <defs>
    <linearGradient id="${id}g" x1="0" y1="${sunY - sunR}" x2="0" y2="${sunY + sunR}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.gold}"/><stop offset="0.5" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.pink}"/>
    </linearGradient>
    <mask id="${id}k"><rect width="512" height="512" fill="#fff"/><g fill="#000">${cuts}</g></mask>
  </defs>
  <circle cx="256" cy="${sunY}" r="${sunR}" fill="url(#${id}g)" mask="url(#${id}k)"/>
  ${gap ? `<path fill-rule="evenodd" d="${A}" fill="none" stroke="${gap}" stroke-width="18" stroke-linejoin="miter"/>` : ''}
  <path fill-rule="evenodd" fill="${fg}" d="${A}"/>
  ${gap ? `<rect x="${(bx0 - 9).toFixed(1)}" y="${hy - 9}" width="${(bw + 18).toFixed(1)}" height="${24 + 18}" fill="${gap}"/>` : ''}
  <rect x="${bx0.toFixed(1)}" y="${hy}" width="${bw.toFixed(1)}" height="24" fill="${horizon}"/>`;
}

// ---------------- alternative concepts (for comparison) ----------------
function sunSeal(id = 's') {
  const cuts = [[300, 12], [338, 18], [378, 24], [420, 30]].map(([y, h]) => `<rect x="0" y="${y}" width="512" height="${h}"/>`).join('');
  const a = textPath(F900, 'A', 300, 256, 256 + capH(F900, 300) / 2, 0, C.white);
  return `<defs><linearGradient id="${id}g" x1="0" y1="26" x2="0" y2="486" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.gold}"/><stop offset=".55" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <mask id="${id}k"><rect width="512" height="512" fill="#fff"/><g fill="#000">${cuts}</g></mask></defs>
  <circle cx="256" cy="256" r="230" fill="url(#${id}g)" mask="url(#${id}k)"/>
  <g stroke="${C.ink}" stroke-width="22" stroke-linejoin="round">${a.svg.replace('<path', '<path paint-order="stroke"')}</g>`;
}
function visorWordmark(id = 'v') {
  const t = textPath(F900, 'AUREN', 112, 256, 300, 40, C.white);
  return `<defs><linearGradient id="${id}g" x1="0" y1="120" x2="0" y2="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.gold}"/><stop offset=".6" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient></defs>
  <circle cx="256" cy="250" r="150" fill="url(#${id}g)"/><rect x="0" y="300" width="512" height="212" fill="${C.ink}"/>
  <g stroke="${C.ink}" stroke-width="14" stroke-linejoin="round">${t.svg.replace('<path', '<path paint-order="stroke"')}</g>
  <rect x="40" y="322" width="432" height="10" fill="${C.cyan}"/>`;
}

// ---------------- lockups ----------------
const svgDoc = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;
const place = (inner, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

function horizontal({ fg = C.white, tag = C.cyan, id = 'h' } = {}) {
  const W = 1600, H = 512;
  const mark = place(sunriseA({ fg, id, gap: fg === C.white ? C.ink : '#FFFFFF' }), 0, 0, 1);
  const word = textPath(F900, 'AUREN', 250, 0, 0, 60, fg);
  const wx = 560, wordW = word.width;
  const w2 = textPath(F900, 'AUREN', 250, wx + wordW / 2, 330, 60, fg);
  const t2 = textPath(F800, 'BEYOND THE GAME', 62, wx + wordW / 2, 448, 330, tag);
  return svgDoc(Math.ceil(wx + wordW + 20), H, mark + w2.svg + t2.svg);
}
function stacked({ fg = C.white, tag = C.cyan, id = 'st' } = {}) {
  const W = 1000, H = 1120;
  const mark = place(sunriseA({ fg, id }), 250, 30, 1);
  const w = textPath(F900, 'AUREN', 210, 500, 820, 60, fg);
  const t = textPath(F800, 'BEYOND THE GAME', 58, 500, 935, 330, tag);
  return svgDoc(W, H - 120, mark + w.svg + t.svg);
}

// ---------------- channel assets ----------------
function profile() { // 800x800, safe inside the circular crop
  const bg = `<defs><radialGradient id="bgp" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#3A1640"/><stop offset=".55" stop-color="${C.night}"/><stop offset="1" stop-color="${C.ink}"/></radialGradient></defs><rect width="800" height="800" fill="url(#bgp)"/>`;
  const s = 1.18; return svgDoc(800, 800, bg + place(sunriseA({ id: 'p' }), 400 - 256 * s, 400 - 260 * s, s));
}
function banner() { // 2560x1440; everything important inside the 1546x423 safe area
  const W = 2560, H = 1440, hy = 760;
  let grid = '';
  for (let i = -26; i <= 26; i++) grid += `<line x1="${W / 2 + i * 40}" y1="${hy}" x2="${W / 2 + i * 300}" y2="${H}" />`;
  for (let k = 1; k < 12; k++) { const f = (k / 12) ** 2; grid += `<line x1="0" y1="${hy + (H - hy) * f}" x2="${W}" y2="${hy + (H - hy) * f}" opacity="${f}"/>`; }
  const bg = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="${hy}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.ink}"/><stop offset=".55" stop-color="#2A1238"/><stop offset="1" stop-color="#5A1A4A"/></linearGradient>
    <radialGradient id="glow" cx="${W / 2}" cy="${hy}" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.orange}" stop-opacity=".55"/><stop offset=".4" stop-color="${C.pink}" stop-opacity=".18"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${hy}" fill="url(#sky)"/><rect y="${hy}" width="${W}" height="${H - hy}" fill="${C.ink}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g stroke="${C.cyan}" stroke-opacity=".28" stroke-width="2">${grid}</g>
  <rect y="${hy - 2}" width="${W}" height="4" fill="${C.cyan}" opacity=".7"/>`;
  const s = 0.8, word = textPath(F900, 'AUREN', 230, 0, 0, 60).width, gapX = 70;
  const total = 512 * s + gapX + word, x0 = W / 2 - total / 2, cy = H / 2;
  const mark = place(sunriseA({ id: 'b' }), x0, cy - 260 * s, s);
  const tx = x0 + 512 * s + gapX + word / 2;
  const w = textPath(F900, 'AUREN', 230, tx, cy + 48, 60, C.white);
  const t = textPath(F800, 'BEYOND THE GAME', 56, tx, cy + 150, 330, C.cyan);
  return svgDoc(W, H, bg + mark + w.svg + t.svg);
}

const files = {
  'concepts/A-sunrise-a.svg': svgDoc(512, 512, sunriseA({ id: 'ca' }), C.ink),
  'concepts/B-sun-seal.svg': svgDoc(512, 512, sunSeal(), C.ink),
  'concepts/C-visor-wordmark.svg': svgDoc(512, 512, visorWordmark(), C.ink),
  'auren-mark.svg': svgDoc(512, 512, sunriseA({ id: 'k' })),
  'auren-mark-light.svg': svgDoc(512, 512, sunriseA({ id: 'kl', fg: C.ink, horizon: '#0FB8D4', gap: '#FFFFFF' })),
  'auren-horizontal.svg': horizontal(),
  'auren-horizontal-light.svg': horizontal({ fg: C.ink, tag: '#0E8FA6', id: 'hl' }),
  'auren-stacked.svg': stacked(),
  'youtube-profile-800.svg': profile(),
  'youtube-banner-2560x1440.svg': banner(),
};
for (const [n, s] of Object.entries(files)) { const p = path.join(OUT, 'svg', n); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }

// ---------------- PNG exports ----------------
const EXPORTS = [
  ['youtube-profile-800.svg', 'youtube-profile-800.png', 800, 800, false],
  ['youtube-banner-2560x1440.svg', 'youtube-banner-2560x1440.png', 2560, 1440, false],
  ['auren-mark.svg', 'youtube-watermark-150.png', 150, 150, true],
  ['auren-mark.svg', 'auren-mark-1024.png', 1024, 1024, true],
  ['auren-horizontal.svg', 'auren-horizontal-2000.png', 2000, null, true],
  ['auren-horizontal-light.svg', 'auren-horizontal-light-2000.png', 2000, null, true],
  ['auren-stacked.svg', 'auren-stacked-1000.png', 1000, null, true],
  ['concepts/A-sunrise-a.svg', 'concept-A.png', 512, 512, false],
  ['concepts/B-sun-seal.svg', 'concept-B.png', 512, 512, false],
  ['concepts/C-visor-wordmark.svg', 'concept-C.png', 512, 512, false],
];
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  for (const [src, dst, w, h, transparent] of EXPORTS) {
    const svg = fs.readFileSync(path.join(OUT, 'svg', src), 'utf8');
    const [vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
    const H = h || Math.round(w * vh / vw);
    await page.setViewportSize({ width: w, height: H });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${H}"`)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, 'png', dst), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: H } });
  }
  await b.close(); console.log('exported', EXPORTS.length, 'PNGs ->', path.join(OUT, 'png'));
})();

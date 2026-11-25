// EXTRAMUNDO brand generator: vector logo (text as paths) + PNG exports.
//   node brand/logo.js   -> brand/out/{svg,png}
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
['svg', 'png'].forEach((d) => fs.mkdirSync(path.join(OUT, d), { recursive: true }));
const FONT = (w) => opentype.loadSync(path.join(ROOT, `node_modules/@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff`));
const F900 = FONT(900), F800 = FONT(800);
const C = { void: '#07060B', night: '#140B12', white: '#FFFFFF', ember: '#FF5A1F', lava: '#FFC23D', red: '#E8202A', teal: '#22D3C5' };

function textPath(font, str, size, cx, y, track = 0, fill = C.white) {
  const glyphs = font.stringToGlyphs(str); const sc = size / font.unitsPerEm; const tr = track / 1000 * size;
  const adv = glyphs.map((g) => g.advanceWidth * sc); const total = adv.reduce((a, b) => a + b, 0) + tr * (glyphs.length - 1);
  let x = cx - total / 2, d = '';
  glyphs.forEach((g, i) => { d += g.getPath(x, y, size).toPathData(2); x += adv[i] + tr; });
  return { svg: `<path d="${d}" fill="${fill}"/>`, width: total, x0: cx - total / 2 };
}

// ---------------- mark: planet + ember orbit ----------------
function mark(id = 'm', { fg = C.white } = {}) {
  const cx = 256, cy = 262, R = 150, tilt = -18;
  const orbit = (half) => {   // half: 'back' (upper arc) or 'front' (lower arc) of the tilted ellipse
    const rx = 236, ry = 66; const a0 = half === 'back' ? Math.PI : 0, a1 = half === 'back' ? 2 * Math.PI : Math.PI;
    let d = ''; for (let i = 0; i <= 60; i++) { const a = a0 + (a1 - a0) * i / 60; d += `${i ? 'L' : 'M'}${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)} `; }
    return `<path d="${d}" fill="none" stroke="url(#${id}o)" stroke-width="${half === 'back' ? 16 : 24}" stroke-linecap="round" transform="rotate(${tilt} ${cx} ${cy})" ${half === 'back' ? 'opacity="0.55"' : ''}/>`;
  };
  return `<defs>
    <radialGradient id="${id}p" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#2A1424"/><stop offset=".7" stop-color="${C.night}"/><stop offset="1" stop-color="${C.void}"/></radialGradient>
    <linearGradient id="${id}o" x1="20" y1="0" x2="492" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.red}"/><stop offset=".5" stop-color="${C.ember}"/><stop offset="1" stop-color="${C.lava}"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="${cy - R}" x2="0" y2="${cy + R}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${fg}"/><stop offset="1" stop-color="${C.ember}"/></linearGradient>
    <clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
  </defs>
  ${orbit('back')}
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}p)"/>
  <g clip-path="url(#${id}c)" fill="none" stroke="${fg}" stroke-opacity=".35" stroke-width="7">
    <ellipse cx="${cx}" cy="${cy}" rx="${R * 0.42}" ry="${R}"/><ellipse cx="${cx}" cy="${cy}" rx="${R * 0.8}" ry="${R}"/>
    <line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none" stroke="url(#${id}r)" stroke-width="12"/>
  ${orbit('front')}
  <path d="M398 120 L408 146 L434 156 L408 166 L398 192 L388 166 L362 156 L388 146 Z" fill="${C.lava}"/>`;
}

const svgDoc = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;
const place = (inner, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

function wordmark(cx, y, size, id) {
  const a = textPath(F900, 'EXTRA', size, 0, 0, 40), b = textPath(F900, 'MUNDO', size, 0, 0, 40);
  const gap = size * 0.06, total = a.width + gap + b.width, x0 = cx - total / 2;
  const A = textPath(F900, 'EXTRA', size, x0 + a.width / 2, y, 40, `url(#${id}w)`);
  const B = textPath(F900, 'MUNDO', size, x0 + a.width + gap + b.width / 2, y, 40, C.white);
  return { svg: `<defs><linearGradient id="${id}w" x1="0" y1="${y - size * 0.72}" x2="0" y2="${y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.lava}"/><stop offset=".55" stop-color="${C.ember}"/><stop offset="1" stop-color="${C.red}"/></linearGradient></defs>${A.svg}${B.svg}`, width: total };
}
const TAG = 'O EXTRAORDINÁRIO ESTÁ MAIS PERTO DO QUE VOCÊ IMAGINA';

function stacked() {
  const W = 1200, H = 1080;
  const w = wordmark(600, 780, 118, 's');
  const t = textPath(F800, TAG, 23, 600, 860, 110, C.teal);
  return svgDoc(W, H, place(mark('s'), 600 - 256 * 1.15, 40, 1.15) + w.svg + t.svg);
}
function horizontal() {
  const s = 0.9, w = wordmark(0, 0, 170, 'h').width, H = 520;
  const tx = 512 * s + 60 + w / 2;
  const ww = wordmark(tx, 300, 170, 'h');
  const t = textPath(F800, TAG, 27, tx, 380, 120, C.teal);
  return svgDoc(Math.ceil(512 * s + 60 + Math.max(w, t.width) + 30), H, place(mark('h'), 0, 20, s) + ww.svg + t.svg);
}
function profile() {
  const bg = `<defs><radialGradient id="bgp" cx="50%" cy="48%" r="65%"><stop offset="0" stop-color="#3A1410"/><stop offset=".55" stop-color="${C.night}"/><stop offset="1" stop-color="${C.void}"/></radialGradient></defs><rect width="800" height="800" fill="url(#bgp)"/>`;
  const s = 1.3; return svgDoc(800, 800, bg + place(mark('p'), 400 - 256 * s, 400 - 262 * s, s));
}
function banner() {
  const W = 2560, H = 1440;
  const bg = `<defs><radialGradient id="bgb" cx="50%" cy="58%" r="60%"><stop offset="0" stop-color="#4A160C"/><stop offset=".5" stop-color="${C.night}"/><stop offset="1" stop-color="${C.void}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bgb)"/>`;
  let stars = ''; for (let i = 0; i < 160; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 37.3 + 1) * 0.5 + 0.5) * H; stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + (i % 3)).toFixed(1)}" fill="#fff" opacity="${(0.15 + (i % 5) * 0.08).toFixed(2)}"/>`; }
  const s = 0.72, w = wordmark(0, 0, 150, 'b').width, total = 512 * s + 50 + w, x0 = W / 2 - total / 2;
  const tx = x0 + 512 * s + 50 + w / 2;
  return svgDoc(W, H, bg + stars + place(mark('b'), x0, H / 2 - 262 * s, s) + wordmark(tx, H / 2 + 40, 150, 'b').svg + textPath(F800, TAG, 24, tx, H / 2 + 120, 120, C.teal).svg);
}

const files = {
  'extramundo-mark.svg': svgDoc(512, 512, mark('k')),
  'extramundo-stacked.svg': stacked(),
  'extramundo-horizontal.svg': horizontal(),
  'youtube-profile-800.svg': profile(),
  'youtube-banner-2560x1440.svg': banner(),
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync(path.join(OUT, 'svg', n), s);
const EXPORTS = [
  ['extramundo-mark.svg', 'extramundo-mark-1024.png', 1024, 1024, true],
  ['extramundo-mark.svg', 'youtube-watermark-150.png', 150, 150, true],
  ['extramundo-stacked.svg', 'extramundo-stacked-1200.png', 1200, null, true],
  ['extramundo-horizontal.svg', 'extramundo-horizontal-2000.png', 2000, null, true],
  ['youtube-profile-800.svg', 'youtube-profile-800.png', 800, 800, false],
  ['youtube-banner-2560x1440.svg', 'youtube-banner-2560x1440.png', 2560, 1440, false],
];
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  for (const [src, dst, w, h, transparent] of EXPORTS) {
    const svg = fs.readFileSync(path.join(OUT, 'svg', src), 'utf8');
    const [vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number); const H = h || Math.round(w * vh / vw);
    await page.setViewportSize({ width: w, height: H });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${H}"`)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, 'png', dst), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: H } });
  }
  await b.close(); console.log('exported', EXPORTS.length);
})();

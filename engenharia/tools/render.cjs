#!/usr/bin/env node
// Frame renderer: drives engine/page.html in headless Chromium (SwiftShader WebGL).
//
//   Preview stills:  node tools/render.cjs --ep fechadura --still S03:2.5 [--still S05:1] --out /tmp/x
//   Full timeline:   node tools/render.cjs --ep fechadura --timeline output/fechadura/timeline.json
//                    (writes output/<ep>/clips/<SCENE>.mp4, one clip per scene incl. transition tail)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const all = k => args.flatMap((a, i) => (a === '--' + k ? [args[i + 1]] : []));
const MIME = { '.js': 'application/javascript', '.html': 'text/html', '.json': 'application/json' };

async function openPage(ep, w, h) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    const file = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf ' + u.pathname });
    route.fulfill({ contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  page.on('console', m => { const t = m.text(); if (!/GPU stall|GL Driver/.test(t)) console.log('[page]', t); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://local/engine/page.html?ep=${ep}&w=${w}&h=${h}`);
  await page.waitForFunction('window.READY === true || window.BOOT_ERROR', null, { timeout: 180000 });
  const err = await page.evaluate('window.BOOT_ERROR');
  if (err) throw new Error(err);
  return { browser, page };
}

const b64 = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');

async function stills(ep) {
  const out = opt('out', path.join(ROOT, 'output', ep, 'stills'));
  fs.mkdirSync(out, { recursive: true });
  const durs = opt('durs') ? JSON.parse(opt('durs')) : {};
  const { browser, page } = await openPage(ep, +opt('w', 1080), +opt('h', 1920));
  for (const s of all('still')) {
    const [id, t] = s.split(':');
    const dur = durs[id] || 6;
    const t0 = Date.now();
    const data = await page.evaluate(([id, t, dur]) => window.renderFrame(id, t, dur, 1), [id, +t, dur]);
    const f = path.join(out, `${id}_${t}.jpg`);
    fs.writeFileSync(f, b64(data));
    console.log('still', f, Date.now() - t0, 'ms');
  }
  await browser.close();
}

function encoder(file, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  return { ff, done };
}

async function renderScenes(ep, tl, ids) {
  const { browser, page } = await openPage(ep, tl.width, tl.height);
  const dir = path.join(ROOT, 'output', ep, 'clips');
  for (const sc of tl.scenes.filter(s => ids.includes(s.id))) {
    const file = path.join(dir, `${sc.id}.mp4`);
    const n = Math.round(sc.clip_seconds * tl.fps);
    const t0 = Date.now();
    const { ff, done } = encoder(file, tl.fps);
    for (let f = 0; f < n; f++) {
      const t = f / tl.fps;
      const data = await page.evaluate(([id, t, dur, f]) => window.renderFrame(id, t, dur, f), [sc.id, t, sc.duration, sc.frame_offset + f]);
      if (!ff.stdin.write(b64(data))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    console.log(`clip ${sc.id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await browser.close();
}

async function full(ep) {
  const tl = JSON.parse(fs.readFileSync(opt('timeline'), 'utf8'));
  fs.mkdirSync(path.join(ROOT, 'output', ep, 'clips'), { recursive: true });
  const only = opt('only') ? opt('only').split(',') : tl.scenes.map(s => s.id);
  const workers = Math.max(1, +opt('workers', 2));
  // balance scenes across workers by frame count
  const buckets = Array.from({ length: workers }, () => ({ ids: [], n: 0 }));
  for (const s of tl.scenes.filter(s => only.includes(s.id)).sort((a, b) => b.clip_seconds - a.clip_seconds)) {
    const b = buckets.reduce((x, y) => (x.n <= y.n ? x : y)); b.ids.push(s.id); b.n += s.clip_seconds;
  }
  await Promise.all(buckets.filter(b => b.ids.length).map(b => renderScenes(ep, tl, b.ids)));
}

(async () => {
  const ep = opt('ep');
  if (!ep) throw new Error('--ep required');
  if (all('still').length) await stills(ep); else await full(ep);
})().catch(e => { console.error(e); process.exit(1); });

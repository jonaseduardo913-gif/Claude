// Renders frames with headless Chromium.
//   node render.js                         -> all frames, frames/00000.jpg ...
//   node render.js --only 0,45,90 --png    -> preview selected frames
//   node render.js --workers 3
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const has = (k) => args.includes(k);
const ROOT = __dirname;
const OUT = path.resolve(opt('--out', path.join(ROOT, 'frames')));
const WORKERS = +opt('--workers', 3);
const PNG = has('--png');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  const probe = await launch(); const pp = await probe.newPage();
  pp.on('pageerror', (e) => console.error('PAGE ERROR', e));
  await pp.goto(url); await pp.evaluate(() => window.__ready);
  const total = await pp.evaluate(() => window.FRAMES);
  await probe.close();

  let frames = has('--only') ? opt('--only').split(',').map(Number) : [...Array(total).keys()];
  if (has('--from')) frames = frames.filter((f) => f >= +opt('--from'));
  const queue = [...frames];
  const t0 = Date.now(); let done = 0;

  await Promise.all(Array.from({ length: Math.min(WORKERS, frames.length) }, async () => {
    const b = await launch(); const page = await b.newPage();
    page.on('pageerror', (e) => console.error('PAGE ERROR', e));
    page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
    await page.goto(url); await page.evaluate(() => window.__ready);
    while (queue.length) {
      const f = queue.shift();
      const data = await page.evaluate(([f, png]) => (png ? window.renderFramePNG(f) : window.renderFrame(f, 0.95)), [f, PNG]);
      const buf = Buffer.from(data.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, String(f).padStart(5, '0') + (PNG ? '.png' : '.jpg')), buf);
      if (++done % 30 === 0) console.log(`${done}/${frames.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await b.close();
  }));
  console.log(`done ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });

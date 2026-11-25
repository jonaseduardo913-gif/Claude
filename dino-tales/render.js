// Renders a story's frames with headless Chromium (WebGL via SwiftShader).
//   node render.js --story 1                 -> frames/s1/00000.jpg ... + frames/s1/cues.json
//   node render.js --story 1 --only 0,90 --png --out preview
//   node render.js --story 1 --workers 4 --from 300
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const has = (k) => args.includes(k);
const ROOT = __dirname;
const STORY = opt('--story', '1');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'frames', 's' + STORY)));
const WORKERS = +opt('--workers', 4);
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
  const url = `http://127.0.0.1:${server.address().port}/index.html?s=${STORY}`;
  const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (b) => {
    const page = await b.newPage();
    page.on('pageerror', (e) => console.error('PAGE ERROR', e));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
    await page.goto(url); await page.evaluate(() => window.__ready);
    return page;
  };

  const probe = await launch(); const pp = await open(probe);
  const total = await pp.evaluate(() => window.FRAMES);
  const cues = await pp.evaluate(() => window.CUES);
  const fps = await pp.evaluate(() => window.FPS);
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify({ duration: total / fps, fps, cues }));
  await probe.close();

  let frames = has('--only') ? opt('--only').split(',').map(Number) : [...Array(total).keys()];
  if (has('--from')) frames = frames.filter((f) => f >= +opt('--from'));
  if (has('--to')) frames = frames.filter((f) => f < +opt('--to'));
  if (has('--step')) frames = frames.filter((f) => f % +opt('--step') === 0);
  if (has('--skip-existing')) frames = frames.filter((f) => !fs.existsSync(path.join(OUT, String(f).padStart(5, '0') + '.jpg')));
  const queue = [...frames];
  const t0 = Date.now(); let done = 0;

  await Promise.all(Array.from({ length: Math.min(WORKERS, frames.length) }, async () => {
    const b = await launch(); const page = await open(b);
    while (queue.length) {
      const f = queue.shift();
      const data = await page.evaluate(([f, png]) => (png ? window.renderFramePNG(f) : window.renderFrame(f)), [f, PNG]);
      fs.writeFileSync(path.join(OUT, String(f).padStart(5, '0') + (PNG ? '.png' : '.jpg')), Buffer.from(data.split(',')[1], 'base64'));
      if (++done % 50 === 0) console.log(`s${STORY} ${done}/${frames.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await b.close();
  }));
  console.log(`s${STORY}: ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });

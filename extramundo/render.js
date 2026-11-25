// Headless frame renderer. Each worker gets a contiguous range (keeps plate cache warm).
//   node render.js [--workers 4] [--only 0,30,60] [--out build/frames]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const ROOT = process.cwd(), ENGINE = __dirname, OUT = path.resolve(opt('--out', path.join(ROOT, 'build/frames'))), WORKERS = +opt('--workers', 4);
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]); let p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) p = path.join(ENGINE, rel);
  if (!(p.startsWith(ROOT) || p.startsWith(ENGINE)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const open = async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', (e) => console.error('PAGE ERROR', e.message)); await p.goto(url); await p.evaluate(() => window.__ready); return { b, p }; };
  const probe = await open(); const total = await probe.p.evaluate(() => window.FRAMES); await probe.b.close();
  const frames = args.includes('--only') ? opt('--only').split(',').map(Number) : [...Array(total).keys()];
  const n = Math.min(WORKERS, frames.length), size = Math.ceil(frames.length / n);
  const t0 = Date.now(); let done = 0;
  await Promise.all([...Array(n).keys()].map(async (w) => {
    const { b, p } = await open();
    for (const f of frames.slice(w * size, (w + 1) * size)) {
      const d = await p.evaluate((f) => window.renderFrame(f), f);
      fs.writeFileSync(path.join(OUT, String(f).padStart(5, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
      if (++done % 100 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await b.close();
  }));
  console.log(`done ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`); server.close();
})().catch((e) => { console.error(e); process.exit(1); });

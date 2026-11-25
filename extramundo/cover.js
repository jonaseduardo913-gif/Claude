// Renders cover.html -> output/capa-shorts-1080x1920.jpg + output/capa-1280x720.jpg
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const ROOT = process.cwd(), ENGINE = __dirname; const MIME = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split('?')[0]); let p = path.join(ROOT, rel); if (!fs.existsSync(p)) p = path.join(ENGINE, rel); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); pg.on('pageerror', (e) => console.error(e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/cover.html`); await pg.evaluate(() => window.__ready);
  const o = await pg.evaluate(() => window.out); fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'output/capa-shorts-1080x1920.jpg'), Buffer.from(o.v.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'output/capa-1280x720.jpg'), Buffer.from(o.h.split(',')[1], 'base64'));
  await b.close(); srv.close(); console.log('covers written');
});

// Headless renderer: serves the repo, opens tools/studio.html in Chromium
// (software WebGL) and saves the PNG views it produces.
//   node tools/render.mjs [outDir] [query-string]
// e.g. node tools/render.mjs screenshots "views=side,front34&livery=krt"
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'screenshots'));
const query = process.argv[3] || '';
const page_ = process.env.PAGE || 'tools/studio.html';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('nf');
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// Serve three.js from node_modules instead of the CDN.
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, async (route) => {
  const m = route.request().url().match(/three@[^/]+\/(.*)$/);
  const f = path.join(root, 'node_modules/three', m[1]);
  if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
  route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/${page_}?${query}`);
await page.waitForFunction(() => window.__shots || window.__error, null, { timeout: 600000, polling: 500 });
const err = await page.evaluate(() => window.__error);
if (err) {
  console.error('render error:', err);
  process.exitCode = 1;
} else {
  const shots = await page.evaluate(() => window.__shots);
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of shots) {
    const buf = Buffer.from(s.data.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, `${s.name}.png`), buf);
    console.log('saved', path.join(outDir, `${s.name}.png`));
  }
  const stats = await page.evaluate(() => window.__stats);
  if (stats) console.log('stats', JSON.stringify(stats));
}
console.log('time', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
server.close();

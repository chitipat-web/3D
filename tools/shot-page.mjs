// Screenshot the viewer page (index.html) in headless Chromium.
//   node tools/shot-page.mjs <out.png> [width] [height] [light|dark] [script]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [out = 'page.png', W = '1440', H = '900', scheme = 'light', script = ''] = process.argv.slice(2);
const page_ = process.env.PAGE || 'index.html';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  const type = types[path.extname(f)] || 'application/octet-stream';
  if (type === 'text/html') {
    let body = fs.readFileSync(f, 'utf8');
    // simulate the artifact host skeleton for page fragments
    if (!/^\s*<!doctype/i.test(body)) {
      body = '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>';
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(body);
  }
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, colorScheme: scheme, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() !== 'debug') console.log('[page]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
  const m = route.request().url().match(/three@[^/]+\/(.*)$/);
  const f = path.join(root, 'node_modules/three', m[1]);
  route.fulfill({ status: fs.existsSync(f) ? 200 : 404, contentType: 'text/javascript', body: fs.existsSync(f) ? fs.readFileSync(f) : '' });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`http://127.0.0.1:${server.address().port}/${page_}`);
await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 120000 });
await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
if (script) await page.evaluate(script);
await page.evaluate(() => new Promise((r) => setTimeout(r, 1800)));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
server.close();
